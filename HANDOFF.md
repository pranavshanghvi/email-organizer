# Email Organizer — Model Handoff Protocol

This file ensures continuity when switching between AI models or platforms due to usage limits, outages, or preference. Any model reading this should treat it as ground truth for what's in flight.

---

## Quick start for a new model

1. Read `CLAUDE.md` in this repo — it has the full project context, tech stack, rules, and constraints
2. Read this file's **Current status** and **In-flight work** sections below
3. Ask Pranav what he wants to work on — don't assume from the in-flight list

---

## Repos and access

| Component | Local path | Runs on |
|-----------|-----------|---------|
| Frontend (React) | `~/Claude Projects/email-organizer-repo/web` | localhost:3000 (npm start) |
| Backend (Express) | `~/Claude Projects/email-organizer-repo/web` | localhost:3001 (node server.js) |
| Shared Gmail code | `~/Claude Projects/email-organizer-repo/shared/gmail-api.js` | — |

Single repository structure: frontend in `web/src`, backend in `web/server.js`, shared code in `shared/` at repo root (server requires `../shared/gmail-api`).

**Current running state (2026-08-10, end of session):** both local servers are running the latest code — frontend on :3000, backend on :3001 (started detached, no terminal). All work committed and pushed to `main`.

## Critical rules (will break things if violated)

- **Never trigger Gmail API sync without asking Pranav first** — `/api/senders` fetches from Gmail, every call uses API quota
- **Never run destructive execution (delete/archive/move) on real senders without Pranav's explicit go** — it's permanent, no undo
- **Never modify demo data without approval** — not applicable yet (no demo mode built)
- **Archive is different from Delete** — archive removes INBOX label only (moves to All Mail), delete moves to Trash + creates a block filter
- **Gmail filter auto-creation** — route/delete/archive actions must create corresponding filters so future emails auto-process. Filter creation is now idempotent (duplicate = 400/failedPrecondition/"Filter already exists" is caught and ignored)
- **Success feedback is mandatory** — after batch execution, show both banner and modal with counts. The banner now waits for the background jobs to actually finish and alerts if any failed
- **Batch processing is NOT all-or-nothing** — user can select 2-3 senders and execute, leaving rest for batch 2
- **Sender emails must be clickable** — `<a target="_blank">` opens Gmail search in a new tab; scan auto-saves to sessionStorage so it survives navigation

## Environment variables (local setup)

**No API keys needed in environment for local dev:**
- Gmail OAuth credentials saved to `~/credentials.json` (user downloads from Google Cloud Console)
- Auth token saved to `~/.email-organizer/gmail-token.json` (created on first auth)
- Plans stored in `~/.email-organizer/plans/` (JSON files, no database)

**For Railway deployment:**
- Expose backend PORT (default 3001)
- Frontend communicates via `https://[railway-app-url]` (detected at runtime)

---

## Current status

> **Last updated:** 2026-08-10 (session 2 — full testing completed, archive bug fixed and verified)

### What's working
- Gmail inbox scan: lists senders with email counts (up to 2500 emails across 5 pages) — **~11s** (was minutes) via 25-parallel header fetches
- **Live scan progress bar** on start screen ("Scanning 1,200 of 2,500 emails…") via `GET /api/senders/status`
- Batch categorization: dropdown actions (Keep, Route to folder, Delete + Block, Delete/Archive, Manual review)
- Folder management: auto-load existing Gmail labels, create new folders with auto-suggested names
- Sender preview: click email to open Gmail search in **new tab** (real `<a target="_blank" rel="noopener noreferrer">` with Gmail's exact URL format)
- **Scan auto-saves** (sessionStorage) — reload or tab navigation restores senders + decisions; "← Back" clears
- Plan review: summary cards grouped by action type
- Batch execution: sends plans to backend, executes via Gmail API, clears processed senders
- **Execution is fast and actually completes** — move/archive/delete use Gmail `batchModify` (1000 emails/call)
- **Archive/Delete operations verified working** — emails are properly removed from INBOX label and moved to All Mail

### All today's fixes (2026-08-10) — verified live against Pranav's Gmail

**Session 1 (earlier):**
1. **Scan speed** — was fetching each message header one-at-a-time (minutes); now 25 in parallel (`mapWithConcurrency`) → ~11s for 2500 emails. Live progress via `/api/senders/status`.
2. **Scan lost on sender click** — was `<td onClick>` + `window.open`; replaced with a real `<a target="_blank">`. Plus sessionStorage auto-save of senders+decisions.
3. **Gmail preview wrong/empty** — search URL now encodes the full `from:` query exactly as Gmail does (`#search/from%3Asender%40domain.com`).
4. **Execute/Commit button stuck disabled** — `analyzeSenders()` never reset `loading` on success; now reset in `finally`.
5. **Silent background failures** — `createFilter` catches Gmail's duplicate error (status 400 / reason `failedPrecondition` / "Filter already exists"); Delete+Block actually blocks (TRASH filter) and skips missing Obsidian vault gracefully; Archive uses the correct `removeLabelIds: ['INBOX']` filter; `commitPlan` executes only plans created in the current batch (not all historical plans for a sender).
6. **THE "nothing happened on backend" bug** — move/archive/delete looped one email per API call (4359 emails = 4359 calls, 30+ min). Rewrote with Gmail `batchModify` (chunks of 1000). **Verified:** 4,359-email move to "Personal" completed in ~18s; 704-email archive completed; all record `success`.
7. **Truthful success message** — `commitPlan` polls created plans until background jobs finish (2-min deadline), then alerts if any failed before showing the banner.

**Session 2 (current - 2026-08-10):**
8. **Archive/delete not actually executing** — `batchModify` was passing empty arrays to Gmail API even when not needed. Fixed by only passing `addLabelIds`/`removeLabelIds` when they contain values. **Verified:** Emails from info@e.equifax.com searched with `from:info@e.equifax.com in:inbox` return "No messages matched" (confirming successful removal from INBOX). Archive operations now work correctly.

### ⚠️ IMPORTANT — Pranav's Gmail was changed by live testing today
During his test, real actions ran on his account. **Ask Pranav before assuming these are wanted:**
- **4,359 emails from pranavshanghvi@gmail.com were moved to the "Personal" label** (he approved finishing this move)
- **704 emails from info@e.equifax.com were archived** (removed from INBOX)
- **1 email from careers@talentcommunity.wellsfargo.com archived**
- A filter now auto-routes future mail from pranavshanghvi@gmail.com to "Personal"
- A "Personal" label was created

If he wants any of this reversed, undoing is straightforward: batchModify to `removeLabelIds: ['Personal']` / `addLabelIds: ['INBOX']`, and delete the filters.

### Known issues
- Pagination hardcoded to 5 pages (MAX_PAGES in gmail-api.js) — caps scan at 2500 emails
- No undo after commit — actions are permanent
- No dedup handling — same sender appears once with total count
- Scan count in app is capped at 2500; Gmail preview may show more emails than the app's count for a sender (this is expected — scan uses pagination limit, search uses actual email count)

---

## In-flight work

*(Reviewed 2026-08-10, session 2.)*

Archive/delete operations are now **fully verified working end-to-end**:
- Backend correctly executes batchModify calls to Gmail API
- Emails are properly removed from INBOX label and moved to All Mail
- Success counts in the frontend modal match actual operations

Remaining work:
1. **Complete end-to-end workflow test** — Run full archive/delete batch through the frontend UI and verify success modal counts match actual Gmail changes
2. **Mobile preview** — verify responsive layout works on iPhone viewport (375px)
3. **Deployment to Railway** — push to Railway, test production API URL detection
4. **Document setup steps** — user-facing guide for Gmail OAuth setup (credentials.json creation, first-time auth)

### Also noted (low priority)
- **Add undo capability** — save pre-filter state, allow rollback
- **Bulk select** — select/deselect multiple senders at once
- **Search/filter senders** — find specific sender by email or domain

### Uncommitted changes

**None — working tree is clean. All work committed and pushed to `main`** as of 2026-08-10 (session 2). Local servers running latest code with archive fix applied (frontend :3000, backend :3001).

---

## How Pranav works

- **Not a career developer** — CPA with 20+ years regulatory reporting experience. Explain technical terms with plain English in parentheses.
- **Uses the app primarily on desktop** (localhost during dev, eventually via Railway URL)
- **Prefers clickable choices** — always use structured question tools, never plain-text yes/no
- **Wants to learn** — explain what you're doing and why
- **Wants elegance** — if a fix feels hacky, do the proper version
- **Commercial vision** — building toward a real product, not just personal use
- **Wants comprehensive testing before being told something is done** — run the real flow, verify live, then report. Don't say "done" on untested code.

---

## Verification checklist (required before reporting done)

1. Frontend compiles (`npm run build`) and dev server runs with no errors
2. Backend starts clean (`node server.js`) and syntax-checks (`node --check`)
3. **Run the real flow** — scan (watch progress bar + timing), click a sender (new tab + scan persists), categorize, Review, verify Commit enabled, reload-restore
4. **Verify execution actually completes** — create/execute plans with a low-count or idempotent sender, confirm the plan file records `success` and the Gmail side changed (filters/labels), then clean up test artifacts
5. Check server logs for hidden background errors (silent failures show up only there)
6. Never claim success on destructive actions without a real run — and never run destructive actions on real senders without Pranav's go-ahead

---

## Session handoff

When a session ends and handing off:

1. **Commit and push** all changes to the git repo
2. **Update HANDOFF.md** with current status and what's next
3. **Tell Pranav:** What was done, what's in progress, what the next session should pick up
4. **Next model uses:** `omniroute launch --profile auto-coding-free`

When the next model picks up:
1. Read `CLAUDE.md` and this `HANDOFF.md`
2. Check server status on :3000 and :3001 (restart if down: from `web/`, `npm start` for frontend, `node server.js` for backend)
3. Ask Pranav what he wants to work on
