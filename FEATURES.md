# Email Organizer — Features

## Dashboard

### Active Plans Tab
- View all saved cleanup plans as cards
- See plan name, sender email, and action type
- Display last execution date
- **Execute Plan** button to run the plan

### All Senders Tab
- Scan your entire Gmail account for all senders
- Display senders sorted by email count (highest first)
- Table columns: Sender Email | Count | Copy button
- Click **Copy** to copy sender email to clipboard
- Use copied email to quickly create new plans

## Plan Builder

**Create New Cleanup Plan** form:
- **Plan Name**: Descriptive name (e.g., "Delete USPS emails")
- **Sender Email**: Exact sender email address
- **Action**: Choose one of:
  - **Delete from Gmail & Obsidian** — Remove emails from both services permanently
  - **Move to Folder** — Create a Gmail label and route emails there (with optional folder name)
  - **Archive** — Set up filter to auto-archive future emails without deleting current ones

## Execution History

- Chronological list of all plan executions
- For each execution shows:
  - Plan name
  - Execution timestamp
  - Status (success/failure)
  - Number of emails deleted from Gmail
  - Number of files deleted from Obsidian vault

## Key Features

### Gmail Integration
- ✅ Find emails by sender (searches inbox, all folders)
- ✅ Create Gmail labels on-demand
- ✅ Set up automatic filters for future emails
- ✅ Move existing emails to labels
- ✅ Trash emails (respects Gmail API permissions)
- ✅ Pagination support for large sender volumes

### Obsidian Integration
- ✅ Scan ~/Brain/conversations/ for email files
- ✅ Match files by sender email in file content
- ✅ Delete E_*.md files when cleaning up sender
- ✅ Track deletion count in execution history

### OAuth & Auth
- ✅ First-run authorization flow (opens browser)
- ✅ OAuth token saved locally (~/.email-organizer/gmail-token.json)
- ✅ Auto-refresh when token expires
- ✅ No token cost after initial build

## Data Storage

**Plans Directory**: ~/.email-organizer/plans/
- Each plan saved as JSON file with unique ID
- Plan includes: name, sender, action, created date, execution history

**Gmail Token**: ~/.email-organizer/gmail-token.json
- Auto-generated after first authorization
- Auto-managed by app (refresh, expiry handling)

## Performance

- **All Senders scan**: First 5000 emails (10 pages × 500 max results)
- **Individual plan execution**: Processes one plan at a time
- **Pagination**: Full support for large sender volumes

## Next Steps

- Batch execution: Run multiple plans in sequence
- Scheduling: Auto-run plans on a schedule
- Advanced filtering: Filter senders by keyword before creating plans
- Import/export: Backup and restore plan configurations
- iOS app: Mobile version (uses same APIs)
