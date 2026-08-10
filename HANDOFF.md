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

Single repository structure: frontend in `web/src`, backend in `web/server.js`, shared code in `web/shared/`.

## Critical rules (will break things if violated)

- **Never trigger Gmail API sync without asking Pranav first** — `/api/senders` fetches from Gmail, every call uses API quota
- **Never modify demo data without approval** — not applicable yet (no demo mode built)
- **Archive is different from Delete** — archive removes INBOX label only, delete moves to trash + creates filter
- **Gmail filter auto-creation** — route/delete/archive actions must create corresponding filters so future emails auto-process
- **Success feedback is mandatory** — after batch execution, show both banner and modal with accurate counts
- **Batch processing is NOT all-or-nothing** — user can select 2-3 senders and execute, leaving rest for batch 2
- **Sender emails must be clickable** — opens Gmail search in new tab, doesn't load emails in-app

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

> **Last updated:** 2026-08-10 (this session)

### What's working
- Gmail inbox scan: lists senders with email counts (up to 2500 emails across 5 pages) — **now ~11s** (was minutes) via 25-parallel header fetches
- **Live scan progress bar** on start screen ("Scanning 1,200 of 2,500 emails…")
- Batch categorization: dropdown actions (Keep, Route to folder, Delete + Block, Delete/Archive, Manual review)
- Folder management: auto-load existing Gmail labels, create new folders with auto-suggested names
- Sender preview: click email to open Gmail search in **new tab** (proper `<a target="_blank">` with Gmail's exact URL format)
- **Scan auto-saves** (sessionStorage) — reload or tab navigation restores senders + decisions, no data loss
- Plan review: summary cards grouped by action type
- Batch execution: send plans to backend, execute via Gmail API, clear processed senders
- Archive action: removes INBOX label (moves to All Mail)
- **SUCCESS FEEDBACK (JUST SHIPPED 2026-08-09):**
  - Success banner: displays counts, auto-dismisses after 5 seconds, has close button
  - Success modal: detailed breakdown of actions (Kept, Routed, Deleted+Blocked, Archived)
  - Counts accurately reflect processed senders
  - Light and dark mode styling included
  - Modal requires manual close
  - Both shown after batch execution completes

### Recent changes (this session, 2026-08-09)
- Fixed Dashboard.jsx file structure: converted multiple if-statement returns into single cohesive return with conditional stage rendering
- Added success banner component with auto-dismiss logic (5 second timer)
- Added success modal component with detailed breakdown
- Integrated success states into `commitPlan()` function
- Added comprehensive CSS styling for both components (light + dark modes)
- All state wired up: `successMessage` holds counts, `showSuccessModal` controls visibility
- Component lifecycle: success triggered after batch execution, banner auto-hides, modal requires close, then returns to categorize stage
- **FIXED: Execute button hanging** — added fetchWithTimeout (30s creation, 60s execution) on frontend, made backend async (fire-and-forget pattern) so large batch operations (137+ emails) don't block UI

### Today's fixes (2026-08-10)
1. **Scan speed** — was fetching each message header one-at-a-time (minutes); now 25 in parallel via `mapWithConcurrency` (~11s for 2500 emails). Live progress exposed via new `GET /api/senders/status` endpoint and shown on the start screen.
2. **Scan lost on sender click** — was a `<td onClick>` with `window.open`; replaced with a real `<a target="_blank" rel="noopener noreferrer">`. Also added **sessionStorage auto-save** of senders+decisions so a reload/navigation never loses work (restored on mount; "← Back" clears).
3. **Gmail preview wrong/empty** — search URL now encodes the full `from:` query exactly as Gmail does (`#search/from%3Asender%40domain.com`).
4. **Execute/Commit button stuck disabled** — `analyzeSenders()` never reset `loading` on success, so the Commit button stayed disabled. Now reset in `finally`.
5. **Execution was failing silently in the background** (found during testing — earlier runs recorded errors while the UI showed success):
   - `createFilter` now treats Gmail's duplicate-filter error as idempotent (status 400 / reason `failedPrecondition` / message "Filter already exists") so re-processing a sender no longer fails the run.
   - **Delete + Block** now actually blocks future emails (creates a TRASH filter) and no longer crashes when the Obsidian vault is missing (skipped gracefully).
   - **Archive** now creates the correct auto-archive filter (`removeLabelIds: ['INBOX']`) instead of an invalid ARCHIVE label.
   - `commitPlan` now executes **only the plans created in the current batch** — previously it re-ran all historical plans matching a sender, causing duplicate-filter failures.
6. **THE real "nothing happened on backend" bug (found via Pranav's live test):** move/archive/delete looped through emails **one at a time** (`users.messages.modify` per email) — 4,359 emails meant 4,359 sequential API calls (~30+ min), so execution looked dead. Replaced with Gmail's **`batchModify`** (up to 1,000 emails per call): 4,359 emails now finish in ~18s. Verified live: 704-equifax archive, 1-wellsfargo archive, and 4,359-emails→Personal all record `success`.
7. **Success message is now truthful, not optimistic** — `commitPlan` polls the created plans until the background jobs reach a final state, then alerts if any failed (with the error) before showing the banner.

### Known issues
- Pagination hardcoded to 5 pages (MAX_PAGES in gmail-api.js)
- No undo after commit — actions are permanent
- No dedup handling — same sender appears once with total count
- Success banner is optimistic — shows immediately; background job status is recorded on the plan (check history) but not surfaced live in the UI

---

## In-flight work

*(Reviewed 2026-08-10.)*

1. **Full workflow TESTED end-to-end (2026-08-10)** — automated browser test drove scan → categorize → review → commit-enabled → reload-restore. Execute pipeline tested against real Gmail with fake senders (delete/folder/archive all record `success`); test artifacts cleaned up after. Remaining: Pranav to do one real Commit click on senders he chooses.
2. **Mobile preview** — verify responsive layout works on iPhone viewport (375px)
3. **Deployment to Railway** — push to Railway, test production API URL detection
4. **Document setup steps** — create user-facing guide for Gmail OAuth setup (credentials.json creation, first-time auth)

### Also noted (low priority)
- **Add undo capability** — save pre-filter state, allow rollback
- **Bulk select** — select/deselect multiple senders at once
- **Search/filter senders** — find specific sender by email or domain

### Uncommitted changes

As of 2026-08-10: local dev servers running (frontend :3000, backend :3001). Most of today's work is committed; the final `commitPlan` batch-scoping fix is being committed at session close.

---

## How Pranav works

- **Not a career developer** — CPA with 20+ years regulatory reporting experience. Explain technical terms with plain English in parentheses.
- **Uses the app primarily on desktop** (localhost during dev, eventually via Railway URL)
- **Prefers clickable choices** — always use structured question tools, never plain-text yes/no
- **Wants to learn** — explain what you're doing and why
- **Wants elegance** — if a fix feels hacky, do the proper version
- **Commercial vision** — building toward a real product, not just personal use

---

## Verification checklist (abbreviated)

Before reporting any work as done:
1. React dev server compiles with no errors (`npm start`)
2. Backend runs with no errors (`node server.js`)
3. Test the feature on desktop and mobile viewports
4. Check browser console for errors
5. Verify Gmail API interactions via server logs

---

## Session handoff

When a session ends and handing off to OmniRoute:

1. **Commit and push** all changes to the git repo
2. **Update HANDOFF.md** with current status and what's next
3. **Tell Pranav:** What was done, what's in progress, what the next session should pick up
4. **Next model uses:** `omniroute launch --profile auto-coding-free`

When the next model picks up:
1. Read `CLAUDE.md` and this `HANDOFF.md`
2. Run `git status` to see any uncommitted work
3. Ask Pranav what he wants to work on next
