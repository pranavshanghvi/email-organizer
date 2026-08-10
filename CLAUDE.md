# Email Organizer — Project Context for Claude

## What this app is
Standalone desktop email cleanup organizer for Gmail inbox management:
- **Scans** Gmail inbox and groups emails by sender
- **Batch processes** senders with one of four actions: Keep, Route to folder, Delete + Block, Delete (no block/archive)
- **Creates Gmail filters** automatically to apply actions to future emails from the same sender
- **Runs locally** on Mac — zero token cost per use after initial setup
- **Uses Gmail API** directly for OAuth and email operations

Primary use: **desktop app** (runs on localhost or can be deployed to Railway for remote access).

## Live URLs
- **Frontend:** http://localhost:3000 (dev) or Railway deployment URL (production)
- **Backend API:** http://localhost:3001 (dev) or Railway backend URL (production)

## Tech stack
- **Frontend:** React 18 with Create React App, inline styles only
- **Backend:** Express.js on Node.js
- **Gmail Integration:** Google Gmail API v1 with OAuth2
- **Storage:** Local file system for plans (~/.email-organizer/), no database
- **Deployment:** Vercel (frontend), Railway (backend) — or standalone on Mac

## Environment & Setup
- **Gmail OAuth:** Requires `credentials.json` at `~/credentials.json` (Google Cloud Console OAuth credentials)
- **Token storage:** Tokens saved to `~/.email-organizer/gmail-token.json` after first auth
- **Plans storage:** Plans saved to `~/.email-organizer/plans/` (JSON files)

## Key rules
- **Never trigger sync without asking Pranav first** — use `/api/senders` to list senders; it hits Gmail API
- **Batch processing is NOT all-or-nothing** — user can select 2-3 senders and execute, leaving others for later
- **Archive vs Delete distinction:**
  - **Delete (no block)** = remove INBOX label (archives to All Mail), no filter created
  - **Delete + Block** = trash emails, create filter to block future emails
  - **Route to folder** = add Gmail label, create filter to auto-route future emails
- **Gmail filters are auto-created** for route/delete actions to prevent re-cleanup
- **Success feedback required** — after batch execution completes, show banner + modal with counts
- **Sender emails are clickable** — opens Gmail search in new tab to preview emails
- **Mobile access** — app can be deployed to Railway for remote access via URL

## Critical implementation notes
- API URL detection: `localhost` for dev, Railway URL for production (no rebuild needed)
- Review button: appears in navbar when in categorize stage, shortcuts to review without scrolling
- Success states: `successMessage` holds counts, `showSuccessModal` controls modal visibility
- Banner auto-dismisses after 5 seconds; modal requires manual close
- Sender decisions persist across page state — only cleared after batch execution

## Pages/Stages
- **Start:** Initial screen with "Scan & Analyze" button
- **Categorize:** Table of senders with action dropdowns, optional folder selection, notes field
- **Review:** Summary cards grouped by action type (Keep, Route, Delete+Block, Archive)
- **Done:** Brief confirmation before returning to categorize for batch 2, 3, etc.

## Database & Storage
No central database. All state is:
- **Frontend:** React component state (in-memory)
- **Backend:** Local JSON files in `~/.email-organizer/plans/`
- **Gmail:** Live labels and filters

## What's working (as of 2026-08-09)
- Scan Gmail and list all senders (up to 2500 emails, pagination hardcoded to 5 pages)
- Batch selection: users can select 2-3 senders and execute without completing the full list
- Dropdown actions: Keep, Route to folder, Delete + Block, Delete (no block), Manual review
- Gmail labels: auto-loaded from user's account, displayed in folder dropdown
- Create new folder: inline modal with auto-suggested name from sender domain
- Sender email clickable: opens Gmail search URL in new tab
- Archive action: removes INBOX label (moves to All Mail)
- Gmail filters: auto-created for route/delete/archive actions
- **Success feedback: JUST SHIPPED (2026-08-09)**
  - Success banner (auto-dismiss after 5 seconds)
  - Success modal (detailed breakdown with close button)
  - Displays counts: Kept, Routed, Deleted + Blocked, Archived
  - Light and dark mode styling included

## Known issues
- Scan can take 15-30 seconds (fetching 2500 emails metadata)
- Pagination hardcoded to 5 pages (MAX_PAGES = 5 in gmail-api.js)
- No duplicate handling — same sender listed once with cumulative count
- No undo — after commit, actions are permanent (filter and emails both modified)

## What's pending
1. **Test the full workflow end-to-end** — scan, select senders, review, execute, verify success feedback
2. **Add success count verification** — confirm counts displayed match actual actions taken
3. **Mobile preview** — test responsive layout on iPhone viewport
4. **Deployment to Railway** — push frontend and backend, test production API URL detection
5. **Document setup steps** — credentials.json creation, first-time auth flow for new users

## How Pranav works
- Not a career developer — CPA with deep regulatory/compliance background
- Primary use: desktop app (not mobile)
- Prefers clickable choices over yes/no text questions
- Wants elegance and proper implementations, not hacks
- Building toward a real commercial product with AI personalization

## Workflow rules (follow every session)
1. Plan before acting — write checklist for any task with 3+ steps
2. Verify before done — run build, check logs, demonstrate correctness
3. Demand elegance — if it feels hacky, do the proper version
4. No laziness — find root causes, not temporary fixes
5. Update HANDOFF.md at session end with current status and uncommitted changes
6. Commit and push before handing off
