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

async function createFilter(senderEmail, labelId) {
  const client = await authorize();

  const filterBody = {
    criteria: { from: senderEmail },
    action: { addLabelIds: [labelId] },
  };

  await client.users.settings.filters.create({
    userId: 'me',
    requestBody: filterBody,
  });
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

async function listAllSenders() {
  try {
    const client = await authorize();
    const senders = {};

    let pageToken = null;
    const MAX_PAGES = 5; // Limit to first 2500 emails for performance
    let pageCount = 0;

    while (pageCount < MAX_PAGES) {
      const res = await client.users.messages.list({
        userId: 'me',
        maxResults: 500,
        pageToken,
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) break;

      // Fetch each message with From header
      for (const msg of messages) {
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
            const senderEmail = match ? match[1].trim() : fromHeader.value.trim();
            if (senderEmail) {
              senders[senderEmail] = (senders[senderEmail] || 0) + 1;
            }
          }
        } catch (err) {
          // Skip messages we can't fetch
          continue;
        }
      }

      pageToken = res.data.nextPageToken;
      pageCount++;
      if (!pageToken) break;
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
  createLabel,
  createFilter,
  moveEmailsToLabel,
  trashEmails,
};
