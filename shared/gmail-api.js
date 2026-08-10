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
    const res = await client.users.messages.list({
      userId: 'me',
      q: query,
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
    // Gmail rejects an identical duplicate filter with 409 — this is normal
    // when a sender is processed more than once. Treat it as idempotent.
    const reason = err?.errors?.[0]?.reason;
    if (err.code === 409 || reason === 'duplicate') {
      return;
    }
    throw err;
  }
}

async function moveEmailsToLabel(messageIds, labelId) {
  const client = await authorize();
  let moved = 0;

  for (const msgId of messageIds) {
    await client.users.messages.modify({
      userId: 'me',
      id: msgId,
      requestBody: { addLabelIds: [labelId] },
    });
    moved++;
  }

  return moved;
}

async function trashEmails(messageIds) {
  const client = await authorize();
  let trashed = 0;

  for (const msgId of messageIds) {
    await client.users.messages.trash({
      userId: 'me',
      id: msgId,
    });
    trashed++;
  }

  return trashed;
}

async function archiveEmails(messageIds) {
  const client = await authorize();
  let archived = 0;

  for (const msgId of messageIds) {
    await client.users.messages.modify({
      userId: 'me',
      id: msgId,
      requestBody: { removeLabelIds: ['INBOX'] },
    });
    archived++;
  }

  return archived;
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

async function listAllSenders(onProgress) {
  try {
    const client = await authorize();
    const senders = {};

    let pageToken = null;
    const MAX_PAGES = 5; // Limit to first 2500 emails for performance
    const CONCURRENCY = 25; // Fetch this many messages' headers at the same time
    let pageCount = 0;
    let total = 0;
    let processed = 0;

    while (pageCount < MAX_PAGES) {
      const res = await client.users.messages.list({
        userId: 'me',
        maxResults: 500,
        pageToken,
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) break;

      total += messages.length;
      pageToken = res.data.nextPageToken;
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

    const result = Object.entries(senders)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count);

    return result;
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
