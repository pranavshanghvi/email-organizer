# Email Organizer

A zero-token-cost desktop application for organizing Gmail and Obsidian emails locally on your Mac.

## Overview

This is a standalone web app (React + Express) that runs on your Mac with **zero API costs per use**. After the initial build, all cleanup operations run locally without consuming tokens or API credits.

### What It Does

- **Cleanup Plans**: Define rules for email senders (delete, move to folder, or archive)
- **Gmail Integration**: Automatically find, label, filter, and delete emails from Gmail
- **Obsidian Integration**: Delete corresponding email files from your Obsidian vault
- **Local Storage**: All plans and execution history stored in `~/.email-organizer/`

## Architecture

```
email-organizer/
├── web/                    # React + Express app
│   ├── server.js          # Express API (port 3001)
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   └── components/    # Dashboard, PlanBuilder, ExecutionLog
│   └── public/
├── shared/                # Shared Node.js modules
│   ├── gmail-api.js       # Gmail API wrapper
│   └── obsidian-api.js    # Obsidian vault file operations
└── package.json           # Root monorepo config
```

## Setup

### Prerequisites

1. **Google Credentials**: Download your OAuth 2.0 credentials from Google Cloud Console
   - Create a project at https://console.cloud.google.com
   - Enable Gmail API
   - Create OAuth 2.0 credentials (Desktop app)
   - Download as `credentials.json` and place in your home directory: `~/credentials.json`

2. **Node.js**: v16+ installed

### Installation

```bash
cd /Users/pranavshanghvi/email-organizer
npm install
```

### First-Time Setup

The first time you run the app:
1. Start the app: `npm start` from the `web` directory
2. Navigate to `http://localhost:3000`
3. Create a test plan to trigger Gmail authentication
4. A browser window will open asking you to authorize Gmail access
5. Grant permission — your OAuth token is saved locally at `~/.email-organizer/gmail-token.json`

After that, the app uses the saved token and **no further authorization is needed**.

## Usage

### Running the App

```bash
cd /Users/pranavshanghvi/email-organizer/web
npm start
```

This starts both:
- **React frontend**: http://localhost:3000 (development server with hot reload)
- **Express API**: http://localhost:3001 (plan storage and execution)

### Creating a Plan

1. Click **"New Plan"** tab
2. Fill in:
   - **Plan Name**: e.g., "Delete USPS emails"
   - **Sender Email**: e.g., `USPSInformeddelivery@email.informeddelivery.usps.com`
   - **Action**: Choose one of:
     - **Delete from Gmail & Obsidian**: Remove emails from both services
     - **Move to Folder**: Create a Gmail label and auto-route future emails there
     - **Archive**: Auto-route future emails without deleting current ones
3. Click **"Create Plan"**

### Executing a Plan

1. Go to **"Dashboard"** tab
2. Find your plan in the list
3. Click **"Execute Plan"** button
4. Plan execution happens in the background — check **"History"** tab for results

### Checking Execution History

Click the **"History"** tab to see:
- When each plan was executed
- How many emails were deleted/moved from Gmail
- How many files were deleted from Obsidian vault

## Key Features

### Gmail Operations
- **List emails**: Search by sender, paginate through all results
- **Create labels**: Auto-create Gmail folders if they don't exist
- **Create filters**: Set up rules for future emails from a sender
- **Move emails**: Add Gmail labels to existing emails
- **Delete emails**: Move emails to trash (respects Gmail API permissions)

### Obsidian Integration
- Scans `~/Brain/conversations/` directory
- Matches email files by sender address in file content
- Deletes E_*.md files corresponding to cleaned up emails

### OAuth Token Management
- First run: Opens browser for user authorization
- Token saved to: `~/.email-organizer/gmail-token.json`
- Auto-refresh: Token automatically refreshes when expired
- **No token cost**: After initial build, all operations use the saved token

## File Structure

**Plans Storage**: `~/.email-organizer/plans/`
```
~/.email-organizer/
├── plans/
│   ├── <plan-id-1>.json
│   └── <plan-id-2>.json
└── gmail-token.json       # OAuth token (auto-saved)
```

**Plan Format**:
```json
{
  "id": "1728123456789abcd",
  "name": "Delete USPS emails",
  "sender": "USPSInformeddelivery@email.informeddelivery.usps.com",
  "action": "delete",
  "created": "2026-08-08T10:30:00Z",
  "lastExecuted": "2026-08-08T11:00:00Z",
  "executions": [
    {
      "timestamp": "2026-08-08T11:00:00Z",
      "status": "success",
      "gmailCount": 201,
      "obsidianCount": 201
    }
  ]
}
```

## API Endpoints

### GET `/api/plans`
List all saved plans

### POST `/api/plans`
Create a new plan
```json
{
  "name": "Plan name",
  "sender": "email@example.com",
  "action": "delete|folder|archive",
  "folderName": "Optional folder name (for 'folder' action)"
}
```

### POST `/api/plans/:id/execute`
Execute a plan by ID

## Development

### Modify the App
1. React components are hot-reloaded (changes appear instantly)
2. Server changes require restart: Stop `npm start` and run again
3. Add new routes to `web/server.js`
4. Add new API functions to `shared/gmail-api.js` or `shared/obsidian-api.js`

### View Server Logs
Check the terminal where `npm start` is running — server logs appear there

## Troubleshooting

### "credentials.json not found"
- Download OAuth credentials from Google Cloud Console
- Save as `~/credentials.json`

### "Authorization failed"
- Delete `~/.email-organizer/gmail-token.json`
- Run the app again to re-authorize

### No emails found
- Check sender email matches exactly (case-sensitive in Gmail search)
- Ensure Gmail account has the emails in question

### Port 3000/3001 already in use
- Change ports in `web/package.json` and `web/server.js`, or:
- Kill the process: `lsof -i :3000` then `kill -9 <PID>`

## Cost Summary

| Operation | Traditional | This App |
|-----------|------------|----------|
| Initial build | ~8-10K tokens | One-time cost |
| Each cleanup | 1-5K tokens | $0 |
| 100 cleanups | 100-500K tokens | $0 |

## Next Steps

- **Mobile version**: iOS app planned for later (uses same Gmail/Obsidian APIs)
- **Batch plans**: Execute multiple plans in sequence
- **Scheduling**: Auto-run plans on a schedule
- **Reporting**: Export cleanup summaries

## License

Personal use only
