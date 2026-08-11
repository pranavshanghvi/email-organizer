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

**Current running state (2026-08-11, end of session 3):** Both local servers may or may not be running. Check before assuming. Work committed and pushed to `main`.

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

## Current status — SESSION 3 RESULT (2026-08-11)

> **Last updated:** 2026-08-11, session 3 end. Major bugs fixed and VERIFIED via Gmail.

### What's now VERIFIED working
- **Archive actually moves emails** — end-to-end test passed: archived `frontdesk@irondoorsforever.com` (1 inbox email) through the app's own API, then confirmed via Gmail the inbox count went 1 → 0. The email genuinely left the inbox. ✅
- **Email counts are now EXACT** — scan does discovery (newest 2,500 inbox emails) then refines each sender's count with a real `from:X in:inbox` paginated query. Verified: Citi=491, Experian=401, Amex=142 — all match Gmail's actual inbox totals precisely (previously 88/59/72). ✅
- **Scan scope is INBOX-only** — counts match what the user sees in Gmail's `from:X in:inbox`, not the whole mailbox. ✅
- **Execution scope is INBOX-only** — `listEmailsFromSender` now filters `labelIds:['INBOX']`, so actions target exactly the emails counted. ✅
- **The empty-array batchModify "fix" was unnecessary** — proven via no-op Gmail probes: the exact archive (`add:[], remove:[INBOX]`) and delete (`add:[TRASH], remove:[]`) request shapes both SUCCEED. Only both-arrays-empty fails, which the app never sends. ✅
- **Equifax mystery solved** — all 706 `info@e.equifax.com` emails are in TRASH (Pranav trashed them manually out of frustration). Gmail's default search EXCLUDES Trash, so the later "Delete + Block" found 0 and recorded "success, 0 emails" — a reporting lie, not a deletion failure. ✅

### What's implemented but needs a real browser click-through
- **Honest success feedback** — frontend now only shows the success banner/modal when EVERY action in the batch succeeded, and shows actual EMAIL counts (e.g. "491 emails archived") instead of sender counts. Any failure → error banner + modal listing what failed, no "success" claim. Backend records per-plan success/error/gmailCount truthfully.
- **Serialized execution** — backend now runs background plan executions one at a time (Promise chain queue) to avoid Gmail's per-user rate limit, which earlier batches tripped ("Quota exceeded ... Units per minute per user" recorded in plan files).
- **Transparent scan notice** — when the inbox is larger than the 2,500-email scan window, a notice explains counts are exact but older senders may be missing.
- **Sender email links** — code path looks correct (`target="_blank"`, Gmail search URL). **NOT yet click-tested by Pranav.**

### Known constraints (measured this session)
- **Gmail rate limit ≈ 5,000 queries per minute per user.** A full 15,500-message inbox scan trips it and fails the whole scan. Hence the 2,500-message discovery window + exact-count refinement design. The app shows a notice when the window is capped.
- Old plan files in `~/.email-organizer/plans/` include many failed/successful test runs (equifax archives, quota errors, "Invalid label: ARCHIVE" from an old code version, etc.) — don't read these as current behavior.

---

## In-flight work — PRIORITIES

**Remaining items, in order:**

1. **Pranav: do a real browser click-through** — scan → pick 2-3 small senders → archive/delete → verify in Gmail. Confirm the success modal shows real email counts, and the honest error modal appears if something fails. (I verified via API calls; the human UI flow is the last mile.)
2. **Verify sender email links** — click a sender email on the categorize screen; it should open a new Gmail search tab. Code looks right but hasn't been click-tested.
3. **Verify concurrent-batch execution** — serialization is implemented; a batch of 2-3 senders should now process sequentially without quota errors.
4. **Deployment to Railway** — still pending; only do after items 1-3 are confirmed.
5. **Optional future** — a full-inbox scan would need quota pacing (e.g. scan 5k, pause for a minute, resume) or Gmail quota increase. Not worth it now; the current window covers active senders.

---

## Session notes

**Session 1 (earlier):** Built basic app, implemented scan, categorization, review, execution. Made multiple fixes to scan performance and filter handling.

**Session 2 (PAUSED):** User ran archive test, app showed success, emails stayed in inbox (later found trashed manually). Session 2 committed a batchModify "fix" that was reverted as unverified. User said "this is all completely wrong."

**Session 3 (this session, COMPLETED + VERIFIED):**
- Ran read-only Gmail diagnostics (Pranav approved): confirmed 706 equifax emails in TRASH; proved archive/delete request shapes succeed via no-op probes; measured the ~5k/min quota.
- Fixed counts: inbox-only scan + exact per-sender count refinement (verified Citi=491 etc. against Gmail).
- Fixed execution scope: inbox-only (`labelIds:['INBOX']`).
- Fixed success reporting: honest success/error states with real email counts.
- Fixed concurrency: serialized background executions.
- Fixed CI build: silenced a pre-existing `react-hooks/exhaustive-deps` warning (functions are recreated each render; adding them to deps would cause re-renders — eslint-disable is correct).
- Ran end-to-end archive test through the app's own API: PASS (inbox 1→0 for frontdesk@irondoorsforever.com).

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
2. **Ask Pranav to do the browser click-through** (in-flight #1) — or ask what he wants next
3. If he tests and something fails, capture the exact Gmail API error from the backend log before fixing
4. Do not claim anything is fixed until verified through the UI in Gmail
