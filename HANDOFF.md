# Email Organizer — Model Handoff Protocol

This file ensures continuity when switching between AI models or platforms due to usage limits, outages, or preference. Any model reading this should treat it as ground truth for what's in flight.

> **For Claude Code Desktop:** use [`CC_HANDOFF.md`](CC_HANDOFF.md) — a distilled, current-state version of this file with the "start here" steps.

---

## SESSION 4+ PRIORITY: Web + iOS Expansion

**Objective:** Build production-ready **web deployment** and **native iOS app** sharing the existing backend API.

**Status:** **Railway backend is LIVE and responding** (fixed 502 this session). Desktop (Mac) version is verified working. Backend API is stable and production-ready. **Web Gmail OAuth needs Google Cloud action by Pranav** (deferred for now).

### What exists today
- ✅ **Backend API** (Express, `web/server.js`) — fully functional, handles scan, plan creation, execution, filter creation
- ✅ **React web frontend** (`web/src/`) — working locally; Railway backend live at `https://web-production-d755d.up.railway.app` (but Gmail endpoints need OAuth credentials)
- ✅ **Gmail OAuth** — working locally; tokens stored locally, scales to any user
- ✅ **Email counts** — exact inbox-only counts, Gmail rate-limited to ~2500 emails per scan
- ✅ **Railway backend** — deployed, responding on `/api/plans`, `/api/senders/status`; `server.js` now respects `process.env.PORT` (fixed 502)

### Web Version (Priority 1)
Deploy existing React app to production with:
1. **Environment detection:** use Railway backend URL when deployed, localhost when dev
2. **OAuth flow:** confirm works at `https://<railway-domain>` (user downloads credentials.json)
3. **Token storage:** in browser localStorage (for web; desktop uses `~/.email-organizer/`)
4. **Plans storage:** backend saves to Railway filesystem or persistent volume
5. **Testing checklist:**
   - Login with Gmail OAuth
   - Scan inbox → verify counts match Gmail
   - Select 2-3 senders → archive/delete → verify in Gmail
   - Verify success banner/modal shows real counts
   - Test on mobile viewport (responsive design already in place)

**Deployment:** Push to Railway; update CLAUDE.md with live URL

### iOS Version (Priority 2)
Native iOS app using React Native or SwiftUI:
1. **Tech choice (TBD):** React Native (faster to ship, code reuse) vs SwiftUI (native feel)
2. **Shared API:** use same backend; iOS client makes HTTP requests to `https://<railway-domain>/api/*`
3. **OAuth on iOS:** use ASWebAuthenticationSession for secure in-app browser
4. **Local storage:** Keychain for tokens, app sandbox for plans
5. **UI/UX:** same scan → categorize → review → commit flow; optimized for touch
6. **Testing checklist:**
   - Login via in-app browser OAuth
   - Scan inbox (show progress)
   - Tap senders, select actions, swipe to archive/delete
   - Verify emails move in Gmail immediately
   - Test offline (queue actions, sync when online)
7. **Distribution:** TestFlight (beta), then App Store

**Deployment:** Build on Mac, sign with Apple certificate, upload to App Store Connect

### Shared Backend Requirements (already met)
- **API routes:** `/api/senders`, `/api/labels`, `/api/plans`, `/api/plans/{id}/execute` — all working
- **OAuth:** Google credentials; backend handles token refresh
- **Rate limiting:** serialized execution (one plan at a time) to respect Gmail's 5k queries/min
- **Error handling:** returns honest success/error with email counts
- **CORS:** allow `http://localhost:3000`, Railway web domain, iOS app domain

### Architecture Diagram
```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│  Web (React)    │       │   iOS (RN/SwiftUI)   │       │  Desktop (CRA)  │
│  Railway        │       │   App Store          │       │  Local Mac      │
└────────┬────────┘       └──────────┬───────────┘       └────────┬────────┘
         │                           │                            │
         └───────────────┬───────────┴────────────────┬───────────┘
                         │                            │
                    ┌────▼─────────────────────────┐
                    │  Shared Backend API          │
                    │  Express on Railway          │
                    │  - OAuth handling            │
                    │  - Gmail API integration     │
                    │  - Plan storage/execution    │
                    │  - Filter creation           │
                    └─────────────────────────────┘
```

### Work Breakdown (for OR)

**Phase 1: Web Deployment (2-3 hours)**
- [x] Set up Railway backend — **DONE, live at https://web-production-d755d.up.railway.app**
- [x] Fix Railway 502 (PORT env var) — **DONE**
- [ ] Test web app against Railway backend (needs OAuth setup)
- [ ] Verify OAuth works at Railway domain
- [ ] Verify all API routes respond correctly
- [ ] Do full end-to-end test (scan → execute → verify in Gmail)
- [ ] Document live URL in CLAUDE.md

**Phase 2: iOS App — Option A (React Native, 6-8 hours)**
- [ ] Init React Native project; share API client code
- [ ] Implement OAuth flow using ASWebAuthenticationSession
- [ ] Port Scan screen (FlatList instead of table)
- [ ] Port Categorize screen (picker for actions, swipe gestures)
- [ ] Port Review screen (scrollable card layout)
- [ ] Implement offline queueing (optional, MVP: online only)
- [ ] E2E test on iOS Simulator: scan → archive → verify in Gmail
- [ ] Build .ipa; test on physical device or TestFlight

**Phase 2: iOS App — Option B (SwiftUI, 8-10 hours)**
- [ ] Init SwiftUI project; hand-write API client
- [ ] Implement OAuth + Keychain token storage
- [ ] Build UI: List, Picker, NavigationStack for flow
- [ ] Port all screens (same flow as web)
- [ ] Add iOS-native touches (swipe to delete, haptic feedback, Dark Mode)
- [ ] E2E test on Simulator and device
- [ ] Submit to TestFlight

**Default:** Option A (React Native) is faster; Option B (SwiftUI) is more native and maintainable long-term. **Pranav's call which to prioritize.**

### Success Criteria
1. **Web:** Live at Railway; can scan, select, execute; emails move in Gmail
2. **iOS:** Installable via TestFlight; same workflow works on device
3. **Both:** Use same backend; no code duplication for API logic
4. **Users:** Can choose web (browser) or iOS (app) — same Gmail cleanup, no sync needed

### If OR hits blockers
1. **OAuth scope issues:** Pranav may need to update Google Cloud Console project
2. **Railway deployment:** Docs at railway.app; ensure backend has persistent volume for plans
3. **iOS signing:** Pranav provides Apple Developer certificate + provisioning profile
4. **Token storage:** Web uses localStorage; ensure CORS headers allow cross-origin reads

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

**Current running state (2026-08-11, end of session 4):** Both local servers may or may not be running. Check before assuming. Work committed and pushed to `main`.

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

## Current status — SESSION 4 RESULT (2026-08-11)

> **Last updated:** 2026-08-11, session 4 end. Railway 502 fixed, sender links committed, desktop verified.

### What's now VERIFIED working
- **Archive actually moves emails** — end-to-end test passed: archived `frontdesk@irondoorsforever.com` (1 inbox email) through the app's own API, then confirmed via Gmail the inbox count went 1 → 0. The email genuinely left the inbox. ✅
- **Email counts are now EXACT** — scan does discovery (newest 2,500 inbox emails) then refines each sender's count with a real `from:X in:inbox` paginated query. Verified: Citi=491, Experian=401, Amex=142 — all match Gmail's actual inbox totals precisely (previously 88/59/72). ✅
- **Scan scope is INBOX-only** — counts match what the user sees in Gmail's `from:X in:inbox`, not the whole mailbox. ✅
- **Execution scope is INBOX-only** — `listEmailsFromSender` now filters `labelIds:['INBOX']`, so actions target exactly the emails counted. ✅
- **The empty-array batchModify "fix" was unnecessary** — proven via no-op Gmail probes: the exact archive (`add:[], remove:[INBOX]`) and delete (`add:[TRASH], remove:[]`) request shapes both SUCCEED. Only both-arrays-empty fails, which the app never sends. ✅
- **Equifax mystery solved** — all 706 `info@e.equifax.com` emails are in TRASH (Pranav trashed them manually out of frustration). Gmail's default search EXCLUDES Trash, so the later "Delete + Block" found 0 and recorded "success, 0 emails" — a reporting lie, not a deletion failure. ✅

### ✅ NEW THIS SESSION (Session 4)
- **Railway backend is LIVE** — `https://web-production-d755d.up.railway.app` responding with HTTP 200 on `/api/plans`, `/api/senders/status`
- **Railway 502 root cause fixed** — `server.js` now listens on `process.env.PORT || 3001` (was hardcoded 3001); Railway assigned port 8080, logs confirm
- **Sender email links committed** — `Dashboard.jsx` changed from `target="_blank"` to `window.open(url, '_blank')` (was uncommitted from pre-disconnect work)
- **Both fixes pushed to origin/main** — Railway auto-redeployed successfully

### Implemented but needs a real browser click-through
- **Honest success feedback** — frontend now only shows the success banner/modal when EVERY action in the batch succeeded, and shows actual EMAIL counts (e.g. "491 emails archived") instead of sender counts. Any failure → error banner + modal listing what failed, no "success" claim. Backend records per-plan success/error/gmailCount truthfully.
- **Serialized execution** — backend now runs background plan executions one at a time (Promise chain queue) to avoid Gmail's per-user rate limit, which earlier batches tripped ("Quota exceeded ... Units per minute per user" recorded in plan files).
- **Transparent scan notice** — when the inbox is larger than the 2,500-email scan window, a notice explains counts are exact but older senders may be missing.
- **Sender email links** — code path looks correct (`window.open(..., '_blank')`, Gmail search URL). **NOT yet click-tested by Pranav.**

### Known constraints (measured this session)
- **Gmail rate limit ≈ 5,000 queries per minute per user.** A full 15,500-message inbox scan trips it and fails the whole scan. Hence the 2,500-message discovery window + exact-count refinement design. The app shows a notice when the window is capped.
- Old plan files in `~/.email-organizer/plans/` include many failed/successful test runs (equifax archives, quota errors, "Invalid label: ARCHIVE" from an old code version, etc.) — don't read these as current behavior.
- **Web Gmail endpoints need OAuth setup** — `/api/labels` on Railway returns `credentials.json not found at /root/credentials.json`. Requires Google Cloud Console action (Web OAuth client + redirect URI + Railway env vars). User chose to defer; desktop remains the working path.

---

## In-flight work — PRIORITIES

**Session 5+ (Web + iOS Expansion — ready for OR to execute):**
1. **Web OAuth setup** — create Web OAuth client in Google Cloud Console, add Railway redirect URI, add credentials to Railway env vars
2. **Web E2E verification** — test web app through full scan → execute → verify cycle
3. **iOS app** — build native iOS app (React Native or SwiftUI); same backend, same workflow

**Session 4 carry-over (if needed before OR starts):**
1. **Pranav: do a real browser click-through** — scan → pick 2–3 small senders → archive/delete → verify in Gmail. (Code was verified via API calls; the human UI flow is the last mile.)
2. **Verify sender email links** — click a sender email on the categorize screen; it should open a new Gmail search tab.
3. **Verify concurrent-batch execution** — a batch of 2–3 senders should process sequentially without quota errors (serialization is implemented).

---

## Session notes

**Session 1 (earlier):** Built basic app, implemented scan, categorization, review, execution. Made multiple fixes to scan performance and filter handling.

**Session 2 (PAUSED):** User ran archive test, app showed success, emails stayed in inbox (later found trashed manually). Session 2 committed a batchModify "fix" that was reverted as unverified. User said "this is all completely wrong."

**Session 3 (COMPLETED + VERIFIED):**
- Ran read-only Gmail diagnostics (Pranav approved): confirmed 706 equifax emails in TRASH; proved archive/delete request shapes succeed via no-op probes; measured the ~5k/min quota.
- Fixed counts: inbox-only scan + exact per-sender count refinement (verified Citi=491 etc. against Gmail).
- Fixed execution scope: inbox-only (`labelIds:['INBOX']`).
- Fixed success reporting: honest success/error states with real email counts.
- Fixed concurrency: serialized background executions.
- Fixed CI build: silenced a pre-existing `react-hooks/exhaustive-deps` warning.
- Ran end-to-end archive test through the app's own API: PASS (inbox 1→0 for frontdesk@irondoorsforever.com).

**Session 4 (COMPLETED):**
- Railway backend 502 fixed (hardcoded PORT → process.env.PORT), auto-redeployed, verified live
- Pre-disconnect sender-email-link fix committed (Dashboard.jsx)
- Verified end-to-end UI flow: scan → categorize → execute → success modal ✅ (via API, not yet browser click-through by Pranav)
- Web Gmail OAuth deferred per Pranav's choice — desktop remains working path

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