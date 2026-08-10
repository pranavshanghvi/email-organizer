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

> **Last updated:** 2026-08-09 (this session)

### What's working
- Gmail inbox scan: lists senders with email counts (up to 2500 emails across 5 pages)
- Batch categorization: dropdown actions (Keep, Route to folder, Delete + Block, Delete/Archive, Manual review)
- Folder management: auto-load existing Gmail labels, create new folders with auto-suggested names
- Sender preview: click email to open Gmail search in new tab
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

### Known issues
- Scan takes 15-30 seconds (fetching email metadata from Gmail)
- Pagination hardcoded to 5 pages (MAX_PAGES in gmail-api.js)
- No undo after commit — actions are permanent
- No dedup handling — same sender appears once with total count

---

## In-flight work

*(Priority list as reviewed 2026-08-09.)*

1. **Test the full workflow end-to-end** — scan → select senders → review → execute → verify success feedback displays correctly
2. **Mobile preview** — verify responsive layout works on iPhone viewport (375px)
3. **Deployment to Railway** — push to Railway, test production API URL detection
4. **Document setup steps** — create user-facing guide for Gmail OAuth setup (credentials.json creation, first-time auth)

### Also noted (low priority)
- **Optimize scan performance** — consider batching Gmail API calls, showing progress indicator
- **Add undo capability** — save pre-filter state, allow rollback
- **Bulk select** — select/deselect multiple senders at once
- **Search/filter senders** — find specific sender by email or domain

### Uncommitted changes

**All files committed and pushed as of 2026-08-09 end of session.**

Git status: clean. No uncommitted work.

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
