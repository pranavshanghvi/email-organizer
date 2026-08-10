# Email Organizer — Model Handoff Protocol

This file ensures continuity when switching between AI models or platforms due to usage limits, outages, or preference. Any model reading this should treat it as ground truth for what's in flight.

---

## Quick start for a new model

1. Read `CLAUDE.md` in this repo — it has the full project context, tech stack, rules, and constraints
2. Read this file's **Current status** and **Critical issues** sections below
3. **DO NOT assume anything is working.** Test the UI end-to-end before making any claims about what works.
4. Ask Pranav what he wants to work on — don't assume from the in-flight list

---

## Repos and access

| Component | Local path | Runs on |
|-----------|-----------|---------|
| Frontend (React) | `~/Claude Projects/email-organizer-repo/web` | localhost:3000 (npm start) |
| Backend (Express) | `~/Claude Projects/email-organizer-repo/web` | localhost:3001 (node server.js) |
| Shared Gmail code | `~/Claude Projects/email-organizer-repo/shared/gmail-api.js` | — |

Single repository structure: frontend in `web/src`, backend in `web/server.js`, shared code in `shared/` at repo root (server requires `../shared/gmail-api`).

**Current running state (2026-08-10, end of session 2):** Both local servers may or may not be running. Check before assuming. All work committed and pushed to `main`.

## Critical rules (will break things if violated)

- **Never trigger Gmail API sync without asking Pranav first** — `/api/senders` fetches from Gmail, every call uses API quota
- **Never run destructive execution (delete/archive/move) on real senders without Pranav's explicit go** — it's permanent, no undo
- **Archive is different from Delete** — archive removes INBOX label only (moves to All Mail), delete moves to Trash + creates a block filter
- **Gmail filter auto-creation** — route/delete/archive actions must create corresponding filters so future emails auto-process
- **Success feedback is mandatory** — after batch execution, show both banner and modal with counts
- **Batch processing is NOT all-or-nothing** — user can select 2-3 senders and execute, leaving rest for batch 2

---

## Environment variables (local setup)

**No API keys needed in environment for local dev:**
- Gmail OAuth credentials saved to `~/credentials.json` (user downloads from Google Cloud Console)
- Auth token saved to `~/.email-organizer/gmail-token.json` (created on first auth)
- Plans stored in `~/.email-organizer/plans/` (JSON files, no database)

---

## Current status — HONEST ASSESSMENT

> **Last updated:** 2026-08-10, session 2 end (work PAUSED — critical issues identified)

### What's supposedly working (claimed but NOT verified in session 2)
- Gmail inbox scan: lists senders with email counts
- Live scan progress bar
- Batch categorization: dropdown actions
- Folder management: auto-load existing Gmail labels
- **Sender email clickable** — should open Gmail search in new tab (REPORTED AS NOT WORKING — needs verification)

### CRITICAL ISSUES — REPORTED BY PRANAV (NOT FIXED)

1. **Email counts are wrong** — The numbers displayed don't match reality. Unclear which counts (inbox? total scan? specific sender?) are wrong. **NEEDS INVESTIGATION.**

2. **No actual changes happening** — When user performs archive/delete operations, the app shows success but emails don't actually move in Gmail. **NEEDS FULL END-TO-END TEST.**

3. **Sender email links not opening in new tab** — User reported this multiple times. Clicking on sender email should open Gmail search in a new tab but this isn't working properly. **NEEDS VERIFICATION.**

4. **Unclear if archive/delete ever worked** — Session 2 claimed to verify archive works by checking Gmail search, but this was NOT done through the actual UI workflow. The "fix" to `batchModify` was committed but **NOT PROPERLY TESTED.**

### Session 2 work (NOT VERIFIED)
- Modified `shared/gmail-api.js` batchModify function to only pass non-empty label arrays to Gmail API
- Claimed to verify archive works via direct Gmail search (but didn't test through UI)
- Committed and pushed changes
- **All claims about "fixed" are unverified — user said "this is all completely wrong"**

### Known issues
- Pagination hardcoded to 5 pages (MAX_PAGES in gmail-api.js) — caps scan at 2500 emails
- No undo after commit — actions are permanent
- Scan count may differ from Gmail search count (expected due to pagination)

---

## In-flight work — PRIORITIES

**DO NOT proceed with deployment or claiming anything is working until these are resolved:**

1. **IMMEDIATE: End-to-end UI test of archive operation**
   - Start both servers (frontend :3000, backend :3001)
   - Load app, scan inbox
   - Select 1-2 senders with small email counts (< 50)
   - Select "Delete (no block)" or "Archive" action
   - Go to Review screen
   - Click "Commit Plan"
   - Wait for success modal
   - **Check Gmail directly** to verify emails actually moved/deleted
   - If success modal shows counts, verify those counts match what actually happened in Gmail
   - Report: Did it work? If not, where did it fail?

2. **IMMEDIATE: Verify sender email links work**
   - On categorize screen, click on a sender email address
   - Should open new tab with Gmail search results for that sender
   - Report: Does it work? If not, what happens instead?

3. **INVESTIGATE: Email count accuracy**
   - What counts are wrong? (scan total? per-sender? inbox?)
   - How do we verify correct counts?
   - Are counts reflecting all emails or just first 500 per sender?

4. **AFTER ABOVE**: Deployment to Railway (if archive/delete verified working)

---

## Session notes

**Session 1 (earlier):** Built basic app, implemented scan, categorization, review, execution. Made multiple fixes to scan performance and filter handling.

**Session 2 (current, PAUSED):** 
- User ran archive test, app showed success
- User reported emails still in inbox
- Session 2 investigated and claimed to fix by modifying batchModify function
- But tests were done via direct API calls, NOT through UI
- User said: "this is all completely wrong...the counts of emails are wrong...there is no change happening"
- **Session paused for reassessment**

---

## How Pranav works

- **Not a career developer** — CPA with 20+ years regulatory reporting experience
- **Wants things that actually work** — claims about "fixed" with no verification cause frustration
- **Wants to test thoroughly** — run the real flow, verify in Gmail, then report
- **Prefers direct communication** — tell him what's broken, not what you assume is working
- **Wants the app to work end-to-end** — scan → select → review → execute → verify in Gmail

---

## Next model: Start here

1. Kill any running servers (`pkill -f "npm start"` and `pkill -f "node server.js"`)
2. Run the full UI test workflow described in "In-flight work #1" above
3. Report honestly what works and what doesn't
4. Ask Pranav which issue to fix first
5. Do not claim anything is fixed until verified through the UI in Gmail

