const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TOKEN_PATH = path.join(process.env.HOME, '.email-organizer', 'gmail-token.json');
const CREDENTIALS_PATH = path.join(process.env.HOME, 'credentials.json');
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(q) {
  return new Promise(resolve => rl.question(q, resolve));
}

async function setupOAuth() {
  if (fs.existsSync(TOKEN_PATH)) {
    console.log('✅ Token already exists at', TOKEN_PATH);
    process.exit(0);
  }

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ credentials.json not found at', CREDENTIALS_PATH);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n📧 Email Organizer — Gmail OAuth Setup\n');
  console.log('1. Click this link to authorize:');
  console.log('   ' + authUrl);
  console.log('\n2. You will be redirected to http://localhost');
  console.log('3. Copy the full URL from the address bar');
  console.log('4. Paste it below\n');

  const redirectUrl = await question('Paste the full redirect URL: ');

  try {
    // Extract code from URL
    const urlObj = new URL(redirectUrl);
    const code = urlObj.searchParams.get('code');

    if (!code) {
      console.error('❌ No authorization code found in URL');
      process.exit(1);
    }

    const { tokens } = await oauth2Client.getToken(code);

    // Save token
    const tokenDir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    console.log('\n✅ Authorization successful!');
    console.log('✅ Token saved to:', TOKEN_PATH);
    console.log('\nYou can now use the Email Organizer app.\n');

    rl.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    rl.close();
    process.exit(1);
  }
}

setupOAuth();
