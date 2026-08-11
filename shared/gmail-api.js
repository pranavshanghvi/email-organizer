const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(process.env.HOME, '.email-organizer', 'gmail-token.json');
const CREDENTIALS_PATH = path.join(process.env.HOME, 'credentials.json');
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

let gmail = null;

async function authorize() {
  if (gmail) return gmail;

  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error('credentials.json not found at ' + CREDENTIALS_PATH);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed;

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Load saved token if exists
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oauth2Client.setCredentials(token);
      gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      return gmail;
    }

    // No token yet - generate auth URL for manual approval
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('Visit this URL to authorize:', authUrl);
    throw new Error('First-time auth required. Visit: ' + authUrl);
  } catch (err) {
    throw new Error(`Gmail auth failed: ${err.message}`);
  }
}

async function listEmailsFromSender(senderEmail) {
  const client = await authorize();
  const query = `from:${senderEmail}`;
  const allMessages = [];
  let pageToken = null;

  while (true) {
    // Scope to INBOX only so the actions match exactly what the scan showed
    // the user. Acting on archived/trashed messages (which the count never
    // reflected) would be surprising.
    const res = await client.users.messages.list({
      userId: 'me',
      q: query,
      labelIds: ['INBOX'],
      maxResults: 500,
      pageToken,
    });

    allMessages.push(...(res.data.messages || []));
    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }

  return allMessages;
}

async function createLabel(labelName) {
  const client = await authorize();

  // Check if exists
  const labels = await client.users.labels.list({ userId: 'me' });
  for (const label of labels.data.labels || []) {
    if (label.name.toLowerCase() === labelName.toLowerCase()) {
      return label.id;
    }
  }

  // Create new
  const res = await client.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });

  return res.data.id;
}

// Creates a Gmail filter for a sender. `action` is the filter action object,
// e.g. { addLabelIds: [labelId] } to route, { removeLabelIds: ['INBOX'] } to
// auto-archive, or { addLabelIds: ['TRASH'] } to block future emails.
async function createFilter(senderEmail, action) {
  const client = await authorize();

  const filterBody = {
    criteria: { from: senderEmail },
    action,
  };

  try {
    await client.users.settings.filters.create({
      userId: 'me',
      requestBody: filterBody,
    });
  } catch (err) {
    // Gmail rejects an identical duplicate filter with status 400 / reason
    // "failedPrecondition" / message "Filter already exists" — this is normal
    // when a sender is processed more than once. Treat it as idempotent.
    const reason = err?.response?.data?.error?.errors?.[0]?.reason
      || err?.errors?.[0]?.reason;
    const status = err?.response?.status || err?.status;
    const isDuplicate =
      status === 409 ||
      reason === 'duplicate' ||
      reason === 'failedPrecondition' ||
      /already exists/i.test(err?.message || '');
    if (isDuplicate) {
      return;
    }
    throw err;
  }
}

// Apply a label change to many messages in bulk using Gmail's batchModify,
// which handles up to 1000 messages per call. This replaces the old
// one-email-at-a-time loops that made execution take 30+ minutes for a
// sender with thousands of emails.
async function batchModify(messageIds, addLabelIds = [], removeLabelIds = []) {
  const client = await authorize();
  if (!messageIds.length) return 0;

  const CHUNK = 1000; // Gmail API limit per batchModify call
  let processed = 0;

  for (let i = 0; i < messageIds.length; i += CHUNK) {
    const chunk = messageIds.slice(i, i + CHUNK);
    await client.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: chunk,
        addLabelIds,
        removeLabelIds,
      },
    });
    processed += chunk.length;
  }

  return processed;
}

async function moveEmailsToLabel(messageIds, labelId) {
  return batchModify(messageIds, [labelId], []);
}

async function trashEmails(messageIds) {
  // Adding the TRASH label moves messages to Trash (recoverable), unlike
  // batchDelete which permanently deletes.
  return batchModify(messageIds, ['TRASH'], []);
}

async function archiveEmails(messageIds) {
  return batchModify(messageIds, [], ['INBOX']);
}

async function listLabels() {
  const client = await authorize();
  const res = await client.users.labels.list({ userId: 'me' });
  const labels = (res.data.labels || [])
    .filter(label => label.type === 'user' && !label.name.includes('[Gmail]'))
    .map(label => ({ id: label.id, name: label.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return labels;
}

// Run `mapper` over every item, executing up to `limit` of them at once.
// This is what turns a slow one-at-a-time Gmail scan into a parallel one.
async function mapWithConcurrency(items, limit, mapper, onItemDone) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
      onItemDone?.();
    }
  };

  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// Exact count of a sender's emails currently in the INBOX. Paginates the same
// `from:sender in:inbox` query a user would run in Gmail, so the number the app
// shows matches what they'd see there — this is the source of "true" counts.
// One query per 500 emails, so cheap for the vast majority of senders.
async function countInboxFromSender(client, senderEmail) {
  let total = 0;
  let pageToken = null;
  while (true) {
    const res = await client.users.messages.list({
      userId: 'me',
      q: `from:${senderEmail} in:inbox`,
      maxResults: 500,
      pageToken,
    });
    total += (res.data.messages || []).length;
    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }
  return total;
}

async function listAllSenders(onProgress) {
  try {
    const client = await authorize();
    const senders = {};

    let pageToken = null;
    // Phase 1 — discover who has email in the inbox by reading each message's
    // From header. This is deliberately bounded: fetching a message's header
    // costs one API query each, and Gmail rate-limits a user to roughly 5,000
    // queries per minute. A larger window reliably trips the limit and fails
    // the whole scan. We stay well under it here so the scan is dependable.
    // Counts are made exact afterwards in phase 2, so this window only bounds
    // which senders appear, not the accuracy of the numbers shown.
    const MAX_PAGES = 5;
    const CONCURRENCY = 25; // Fetch this many messages' headers at the same time
    let pageCount = 0;
    let total = 0;
    let processed = 0;
    let truncated = false;

    while (pageCount < MAX_PAGES) {
      // Scan INBOX only. The counts the user sees are inbox counts — they
      // should match a `from:sender in:inbox` search in Gmail, not the whole
      // mailbox (which includes archived/sent mail and was why counts looked
      // wrong).
      const res = await client.users.messages.list({
        userId: 'me',
        labelIds: ['INBOX'],
        maxResults: 500,
        pageToken,
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) break;

      total += messages.length;
      pageToken = res.data.nextPageToken;
      truncated = !!pageToken;
      pageCount++;

      // Fetch each message's From header in parallel batches instead of
      // one-at-a-time — this is the main reason the scan was so slow.
      const fromHeaders = await mapWithConcurrency(
        messages,
        CONCURRENCY,
        async (msg) => {
          try {
            const fullMsg = await client.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['From'],
            });

            const headers = fullMsg.data.payload?.headers || [];
            const fromHeader = headers.find(h => h.name === 'From');
            if (fromHeader && fromHeader.value) {
              // Extract email from "Name <email@example.com>" format
              const match = fromHeader.value.match(/<(.+?)>/);
              return match ? match[1].trim() : fromHeader.value.trim();
            }
          } catch (err) {
            // Skip messages we can't fetch
          }
          return null;
        },
        () => {
          processed++;
          onProgress?.({ fetched: processed, total });
        }
      );

      for (const email of fromHeaders) {
        if (email) {
          senders[email] = (senders[email] || 0) + 1;
        }
      }
    }

    let result = Object.entries(senders)
      .map(([email, count]) => ({ email, count }));

    // Phase 2 — replace the window counts with exact inbox totals. For each
    // discovered sender, paginate `from:sender in:inbox` once per 500 emails.
    // If we trip Gmail's rate limit mid-way, keep the discovery counts for the
    // remaining senders rather than failing the whole scan.
    const REFINE_CONCURRENCY = 10;
    let refined = 0;
    for (let i = 0; i < result.length; i += REFINE_CONCURRENCY) {
      const batch = result.slice(i, i + REFINE_CONCURRENCY);
      try {
        await Promise.all(batch.map(async (s) => {
          s.count = await countInboxFromSender(client, s.email);
        }));
        refined += batch.length;
      } catch (err) {
        const isQuota = /quota|rate limit/i.test(err.message || '');
        if (isQuota) {
          console.log(`Count refinement stopped early (rate limit) after ${refined} of ${result.length} senders`);
          break;
        }
        // A single bad sender shouldn't kill the scan — keep its window count.
        console.log('Count refinement skipped a sender:', err.message);
      }
    }

    result.sort((a, b) => b.count - a.count);
    return { senders: result, truncated };
  } catch (err) {
    console.error('listAllSenders error:', err.message);
    throw err;
  }
}

module.exports = {
  authorize,
  listEmailsFromSender,
  listAllSenders,
  listLabels,
  createLabel,
  createFilter,
  moveEmailsToLabel,
  trashEmails,
  archiveEmails,
};
