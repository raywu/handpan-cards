# Plan: click-to-move (handpan.raywu.org -> handpantheory.com)

Status: DRAFT, planning only. Prompt: `docs/plans/2026-11-04-click-to-move-prompt.md`. Linear key: `handpan-cards#click-to-move`.

## Goal

Replace the silent boot-time handoff (`moveForward()` calls `location.replace(MOVE_TARGET + ... "#move=<payload>")` from the `go` section's `moveFlow`) with a handoff the visitor starts by pressing a button on the old host. Saved scales still travel in the same `#move=` payload, and the receiver on the target is unchanged. The shipped lane keeps `MOVE_FROM = null` and `MOVE_TARGET = null`.

## Non-goals

DNS, Cloudflare settings, `_redirects` and server 301s, canonical tags, sitemaps, Search Console Change of Address, re-arming (a separate one-line PR, not scheduled here), deck data, engine, share-link format, the `#move=` payload format, and the receiver code (`moveThenOk`, the referrer-gated receiver block, `moveImport`, `moveNotice`, `moveReport`).

## Evidence (read 2026-11-04)

- `index.html` `saved-scale handoff` block: constants null, `MOVE_CAP = 20000`. `moveForward` returns false for non-durable modes, otherwise always calls `location.replace` (empty store: no payload; over cap: binary-searched prefix; nothing fits: no payload).
- `go` section: `if (!MOVE_ON_OLD) loadAnalytics();`. `moveFlow` runs `moveForward` on the old host, and `savedReady` never resolves after a jump.
- Served headers (`curl -sI`, 2026-11-04): `handpan.raywu.org`, `handpantheory.com` and `handpan-cards-dev.pages.dev` all send `referrer-policy: strict-origin-when-cross-origin`. A cross-origin top-level navigation therefore sends `Referer: https://handpan.raywu.org/` (origin only), so the receiver's `new URL(document.referrer).hostname === MOVE_FROM` check still passes. The e2e test "move: neither host sends a Referrer-Policy stricter than strict-origin-when-cross-origin" already guards `_headers` and the lack of a referrer meta tag.
- Tests: `tests/app.test.js` MV block (`movePage` rewrites the constants, then stubs `location.replace` to set `window.__replaced`; `OLD_HOST = "old.example"`, `TARGET = "https://new.example"`). `tests/e2e.test.js` "MV: the saved-scale handoff to the new host" (`moveMode` rewrites the constants at serve time; OLD = `http://127.0.0.1:<port>`, NEW = `http://localhost:<port>`, with two origins on one server). `tests/storage_corpus.test.js` SC forward test.
- Region freeze: the app test "the move region equals c6ef6b58's with only #790's dedupe-key line applied" pins everything from `const MOVE_FROM =` through `moveReport` to the shipped client fixture `tests/fixtures/shipped_client_c6ef6b58.html.txt`. `moveForward` is inside that region.
- Mutants that patch `moveForward` or the boot flow: `mv_forward_ignores_cap`, `mv_overcap_returns_false`, `mv_forward_drops_nonascii_rows`, `mv_forward_strips_profile`, `mv_old_host_loads_analytics`, plus `mv_committed_bytes_armed` (kept). README says 1791 mutants.
- Safe Browsing report, section 5, H1 (confirmed by timing in the Owner update): the silent `location.replace` to a new domain with an opaque payload, plus suppressed analytics, looked like a redirect kit. Section 6 item 3 proposes "a visible 'We moved' page with a user-clicked link".

## Decisions

| # | Decision | Tag |
|---|---|---|
| D1 | The old host boots the full app normally. The `moveFlow` branch for `MOVE_ON_OLD` is removed, and no code path on the old host calls `location.replace` or `location.assign` except the button's click handler, `moveGo()`. | owner (hard requirement) |
| D2 | UI: one banner on the old host only (`MOVE_ON_OLD`), rendered after `finishSavedBoot`, as an OVERLAY (owner 2026-11-04 "Banner should be an overlay. Fix"): `position:fixed` at the TOP, just below the header row (`header .hrow`, measured into `--move-top`; falls back to `safe-area-inset-top`), so it covers neither the footer controls nor the share and settings buttons (it does cover the scale-chip row and the top of the card while shown; dismiss clears it), `z-index:25` (under the sheet, panel and About; it is in the `background`, `panelBackground` and `aboutBackground` inert lists), first child of body, so it never pushes `#app` or the footer. It re-renders on every `updateSavedStatus()` (language change and every saved-scale snapshot) unless dismissed. It is a `role="region"` with an `aria-label`, contains a `<button type="button">` and a dismiss `<button>` with an `aria-label`, and keyboard focus order follows the DOM. It reuses the `.move-notice` palette (`#2a2620` / `#4a4336` / `#f1ead9`, Nunito Sans) so the visual system is unchanged. Before any UI edit, the lane runs `/impeccable` on the banner design, keeping the CARD-SPEC visual system (fonts, palettes). | owner 2026-11-04 Q1: "Like top banner. Use /impeccable." and "Banner should be an overlay. Fix" |
| D3 | Dismiss hides the banner for this tab (sessionStorage, wrapped in try/catch). The banner returns on the next visit, because the old host serves indefinitely and visitors should keep the way out. | owner 2026-11-04 Q2: "Hide this visit" |
| D4 | Click mechanics: a `<button>`, not an `<a>`. The handler builds the URL synchronously from `savedState` and calls `location.assign(url)`. No `href` ever holds the payload, so crawlers, long-press previews and "open in new tab" never see it (T2). `assign` keeps Back to the old host. The referrer is the same as for an anchor under the served policy, and a same-tab navigation has no popup rules. | AFK-recommended |
| D5 | The URL builder is the old `moveForward` body moved out of the frozen region as `moveUrl()`. It is pure: it returns `{url, carried, total}` and navigates nothing. The encoding, cap, binary search and row order are byte-identical. | AFK-recommended |
| D6 | One move only. A click carries as many scales as fit under `MOVE_CAP` (the existing binary-searched prefix, in store order). There is no MOVE THE REST, no repeated partial sends, and no `hpfc.move.sent` tracking. The rest stay on the old host, untouched. When over cap, the banner says so before the click (`move.banner_overcap`). After a click, Back (including a bfcache `pageshow`) shows the same banner as before; there is no state to re-render. | owner 2026-11-04 Q3: "One move only" |
| D7 | Receiver unchanged. The referrer gate and `moveThenOk` allowlist stay. Arrival imports automatically because the visitor already chose to move, and it shows the existing `move.notice` / `move.failed`. | past decision (#770/#789) plus AFK-recommended |
| D8 | With zero scales (and no hidden ids) the banner still shows, with plain copy and a button that opens the new address with the current `location.search + location.hash` and no payload. In protected or session mode it reads as having nothing to move: there is no payload (same as `moveForward`'s `savedMode !== "durable"` return) and the copy offers only the new address. | owner 2026-11-04 Q4: "Show, OPEN button" |
| D9 | Click carries the ARRIVAL route (`location.search + location.hash` captured at load), not the live route (owner nit D8, 2026-11-04; kept on the evidence below). The booted app rewrites a `#s=` arrival into a readable named share that matches a saved scale (probe: `#s=6/D3-A3-C4/x/y` becomes `#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/S1+xxx.../fa245e` with a 200-scale store). Carrying that live hash in `then` risks re-opening a share that duplicates a scale the same click already moves. Pinned by "an over-cap store with a #s= hash keeps the hash across the click". | lane nit decision |
| D10 | Analytics: the old host now calls `loadAnalytics()` like any host, because it is a real visit and suppression was one of the H1 signals. The `if (!MOVE_ON_OLD)` guard goes, and `analyticsAllowed()` still blocks DEV, previews, localhost and webdriver. No new event is added. | AFK-recommended |
| D11 | One serial lane. `index.html`, `data/i18n/*.json`, `tests/app.test.js`, `tests/e2e.test.js`, `tests/storage_corpus.test.js`, `tests/mutants/`, `tests/suite_health.py` and `README.md` all share ownership, so the work does not split. | AFK-recommended |

Copy (en). Other tables are translated by the lane. "scale", never "deck". `{host}` = `new URL(MOVE_TARGET).hostname`, as text only, never a link.
- `move.banner` {one, other}: "Handpan Theory now lives at {host}. Your saved scale can come with you." / "... Your {n} saved scales can come with you."
- `move.banner_empty`: "Handpan Theory now lives at {host}."
- `move.banner_overcap`: "{n} of your {total} saved scales fit in one move. The rest stay here at this address."
- `move.go`: "MOVE MY SCALES". `move.go_plain`: "OPEN {host}". `move.dismiss`: "Hide for now".

## Assumptions

| # | Assumption | Status |
|---|---|---|
| A1 | Both hosts and DEV send `strict-origin-when-cross-origin`. | VERIFIED with `curl -sI` (above). Guarded by the existing e2e header test. |
| A2 | `location.assign` from a click delivers the origin referrer in Chrome and in iOS Safari. | Chrome: GATED on new e2e E2 (CDP `Page.navigate` is not a click, so E2 clicks the real button). iOS Safari: GATED on owner QA in P8. |
| A3 | Re-sending rows never duplicates them. | VERIFIED by existing tests "a move link is stripped to the then hash and imports once" and "move: revisit after edit/delete re-imports nothing". |
| A4 | The receiver accepts the payload from c6ef6b58-shipped clients and from the new builder. | Bytes unchanged. GATED on the retargeted freeze test (P1 T-F). |
| A5 | Banner copy fits at 320px in every locale. | GATED on the fit check in P3. |

## Why smallest

- Chosen (A): move the builder out of the frozen region, delete the boot jump, add one banner, keep payload and receiver. The diff is about 60 lines of app JS, one CSS rule, 6 keys x 8 tables, and test updates. The receiver, payload and share links do not change, so every c6ef6b58 payload still imports.
- Alternative (B): an interstitial "We moved" page on the old host, with a static `index.html` variant or a full-screen sheet. Rejected: it blocks using the app (against the hard requirement), needs a second served file or a route, and still needs the same builder.
- Alternative (C): a 301 plus a manual export/import file. Rejected: DNS and `_redirects` are non-goals, it breaks "old host keeps serving", and it puts the work on 40 users.
- Alternative (D): an `<a href>` pre-filled with the payload. Rejected: it puts the payload in the DOM (T2) and in long-press previews.

## Phases

| P | Prereqs | Owner | Deliverable | Observable acceptance | Verify |
|---|---|---|---|---|---|
| P0 | main at or after 364567d4; worktree `wt-click-move` on `claude/click-to-move` from main | lane | worktree | `git -C wt-click-move log -1` = main tip | `git worktree list` |
| P1 tests first | P0 | lane | updated and new tests, red on main | the new tests fail on main for the stated reason | single titles below with `node --test --test-name-pattern` |
| P2 implement | P1 | lane | `index.html` changes per D1-D9 | P1 tests green; `MV: the committed bytes leave the move switched off` green | `./tests/run.sh` smoke |
| P3 i18n | P2 | lane | keys in all 8 `data/i18n/*.json`, then `python3 tools/sync_i18n.py`, audit, fit check | `python3 tools/validate.py` exits 0; fit check passes at 320px for every locale | `python3 tools/validate.py` |
| P4 mutants + floors | P2 | lane | mutants retargeted or replaced (below); FLOORS rows for app and e2e raised; README count set from main-PR CI artifacts | CI mutation gate green | CI `validate` at head |
| P5 PRs | P3, P4 | lane | PR M to main and PR D to dev, same head, `Refs TRI-n` | `gh pr view <M> --json headRefOid` = local tip; green `validate` run on M at that SHA | `gh run list --commit <sha> --workflow validate.yml` |
| P6 review | P5 | fresh `swarm-reviewer` | verdict at the verified SHA | PASS or PASS_WITH_NITS | reviewer report |
| P7 served rehearsal (two hosts) | P6 | lane/integrator | preview branches `claude/click-move-e2e-from` and `-to` built from the lane head plus ONE test-only commit setting `MOVE_FROM = "claude-click-move-e2e-from.handpan-cards-dev.pages.dev"` and `MOVE_TARGET = "https://claude-click-move-e2e-to.handpan-cards-dev.pages.dev"`. Never PR'd, never merged; deleted after QA. Old = `-from` alias, target = `-to` alias. | the from host boots with URL unchanged and a banner; seeded sets (rich 8, hidden-only, n100, n115, n200 over cap: one click carries the largest prefix, and a second click carries the same prefix, non-ASCII, paired-area v5, empty plus `#s=`) all arrive intact, with no duplicates on revisit | scripted kit against both aliases, `curl -s <from> \| grep -cE '#move=[A-Za-z0-9_-]{16,}'` = 0 (the inline script legitimately holds the literal `#move=`), plus a DOM check that `document.querySelectorAll('[href*="#move="],[action*="#move="]').length` = 0 |
| P8 owner iPhone QA | P7 | owner | owner's words | tap the banner on the `-from` alias, land on `-to`, scales present, Back returns to a working old host | owner message |
| P9 DEV | P6, P7, D not CONFLICTING | integrator | merge D (AFK grant) | served DEV root boots, URL unchanged, no banner (constants null), `#s=` and `#deck=` links open | `curl -s https://handpan-cards-dev.pages.dev/ \| grep -c 'const MOVE_FROM = null;'` = 1; browse check per `docs/testing/browser.md` |
| P10 main | P8, P9, owner says merge | owner | M merged | `released` | `gh pr view <M> --json state` |

The arm is not a phase. It needs Search Console clean for `handpantheory.com` and an explicit owner go, and it is its own PR.

## Tests (first)

Changed (`tests/app.test.js` MV block; `movePage` also stubs `location.assign` to set `window.__assigned`):
- "the old host forwards before any render, with the payload, and never loads analytics" becomes **T-B1** "the old host boots, never navigates at boot, shows the move banner and loads analytics". For each hash in `""`, `#deck=f-low-pygmy-18`, `#s=...`, `#add` and each store in empty, 1, 116, hidden-only: `__replaced` and `__assigned` stay undefined and `booted === true`. Analytics: with the existing `boot2` fixture (`webdriver: false`, host `old.example`, so `analyticsAllowed()` returns true unstubbed), assert `gtag(app).length === 1` and `analyticsLoaded === true`.
- "an empty old store forwards with no payload" becomes **T-C0**: the click with an empty store assigns `TARGET + "/" + search + hash`.
- "over-cap store of 116/200 ..." becomes **T-C1**: before the click, the banner shows `move.banner_overcap` with the right n and total. The click assigns exactly the largest prefix under `MOVE_CAP`, a second click carries the same prefix (no batching), and old storage is untouched.
- "when not even one record fits ..." becomes a click that assigns with no payload.
- Freeze test **T-F**: the region still runs from `const MOVE_FROM =` to `moveReport`, and the expected value = the shipped region with the `moveForward` function removed, plus the #790 line. The new `moveUrl` lives after the region.
- `tests/storage_corpus.test.js` SC forward test: it calls `moveUrl()` instead of reading `__replaced`.
- e2e MV tests that forwarded at boot ("two old tabs forwarding", "empty old store jumps", "over MOVE_CAP", "legacy storage keys", "non-ASCII", "paired-area", "redirected old path", "re-flip"): their `go(OLD)` step becomes `go(OLD)` + click `#move-banner button.move-go`.

New:
- **T-B2** static: outside the click handler, `index.html` has no `location.replace(MOVE_TARGET` and no `location.assign`. One `location.assign(` total, inside `moveGo`.
- **T-D1** (T2): after the old host boots, no attribute value in `querySelectorAll('[href],[action],[formaction]')` contains `#move=` or `MOVE_TARGET`'s origin (attribute values only; the script text holds the literal), and the banner buttons are `type="button"`.
- **T-D2**: dismiss hides the banner, and it stays hidden on reload in the same session. A fresh session shows it again.
- **T-D3**: in protected and session modes the banner shows `move.go_plain`, and clicking it assigns with no payload.
- **T-E1** (e2e, real click): seed 8 scales on OLD, load OLD, press the button, and land on NEW. The receiver saw a referrer whose hostname is `127.0.0.1`, all 8 arrive, and the notice shows "Your 8 saved scales moved here."
- **T-E2** (e2e): n200 over cap. The banner shows the over-cap line, and one click moves the largest prefix that fits to NEW, once each. Back to OLD shows the banner unchanged with all 200 still present on OLD.
- **T-E3** (e2e): an old-host `#s=` and a `#deck=` link open on OLD with the banner present and the route intact (T5).
- Unchanged and still required: the receiver tests (referrer gate, `then` allowlist, replay dedupe, NEEDS_NEWER_APP skip, failed-write retry).

Mutants:
- Delete `mv_old_host_loads_analytics` and replace it with `mv_old_host_skips_analytics` (restores the `!MOVE_ON_OLD` guard; killed by T-B1).
- Retarget `mv_forward_ignores_cap`, `mv_overcap_returns_false`, `mv_forward_drops_nonascii_rows` and `mv_forward_strips_profile` to `moveUrl` lines, re-anchored on the removed line (memory: hunk headers are stale).
- New: `mv_boot_navigates` (calls `moveGo()` after `finishSavedBoot`; killed by T-B1 and T-B2), `mv_href_holds_payload` (sets `href` on render; killed by T-D1), `mv_overcap_line_hidden` (drops the over-cap line; killed by T-C1), and `mv_dismiss_forever` (localStorage instead of sessionStorage; killed by T-D2).
- Kept: `mv_move_region_cap_drifts` (MOVE_CAP is in the region), re-checked against the retargeted T-F; it must still be killed. `mv_committed_bytes_armed` is kept too.
- Strip `index` lines from the patches. `# suite:` patterns use `.` wildcards. README count and FLOORS come from main-PR CI artifacts.

## Verification split

- Automated: CI `validate` on M at the head SHA (app, e2e, storage corpus, i18n, mutation gate).
- Self: local single titles with `CHROME_BIN`, and the P7 kit on the two preview aliases.
- Independent reviewer: fresh `swarm-reviewer` at the verified SHA. It also checks T1-T5 and that nothing in the receiver region changed.
- Human: owner iPhone Safari on the P7 aliases (tap, land, scales present, Back works), then the owner says merge for M.

## Risks

- iOS Safari strips the referrer on `assign` and the receiver imports nothing. Caught in P8. Fallback: none in this lane; it goes back to the owner as a question, and the receiver stays unchanged.
- The banner shifts layout and breaks fit tests that measure the top of the page. It only renders when `MOVE_ON_OLD`, which is false in every non-armed test.
- Over cap, scales past the prefix stay on the old host only. The banner states this before the click (D6), and that was the owner's choice (Q3).
- The freeze retarget could hide a receiver change. T-F removes only the `moveForward` text, and the reviewer diffs the receiver lines against c6ef6b58.

## Edge cases
- Over cap: the visitor sees "{n} of your {total} saved scales fit in one move. The rest stay here at this address." before clicking; the rest remain usable on the old host. Edits made after a move stay on the old host (shipped behaviour; receiver dedupe drops a resend).

Two old tabs clicked at once: each import is deduped (existing e2e). Hidden-only store: carries `h`. Clicking during a pending save: the builder reads committed `savedState`, so an unsaved draft is not carried (the copy says saved scales). A click while offline: the navigation fails in the browser, and the old host is unchanged. Visitors who already moved: the banner still shows, and re-clicking is harmless.

## Recovery

Revert the lane on dev with `claude/dev-revert-click-to-move`. With the constants null, no user sees any change from either the lane or its revert. Preview branches are deleted after QA.

## Continuation point

Start P0. Q1-Q4 were decided by the owner on 2026-11-04; nothing is open. The lane runs `/impeccable` on the banner before P2's UI edits.

## Stop

Stop when M is open with green `validate` at the verified SHA, the reviewer has passed, D is merged to dev, P7 and P8 are done, and the owner's main merge is recorded. No arm.

## Rubric self-check (frozen)

Readiness 1-9: no open blocker; A2 and A5 are gated on phases; the smallest approach is justified against B, C and D; each phase has prereqs, owner, deliverable, acceptance and verify; dependencies are listed; failure cases are covered (protected, over cap, referrer); recovery is a revert; the continuation point and stop are stated. T1: D1, T-B1, T-B2 and `mv_boot_navigates`. T2: D4, T-D1 and `mv_href_holds_payload`. T3: `MV: committed bytes` test plus `mv_committed_bytes_armed`, and P7's arm commit is never merged. T4: T-E1 (all under cap), T-C1/T-E2 (over cap: one move of the largest prefix; the banner states before the click how many fit and that the rest stay on the old host). T5: T-E3 and the unchanged receiver.

## Review log

### Round 1 (independent eng + light design/a11y reviewer, 2026-11-04)

/plan-eng-review not invoked as a skill; same dimensions done manually (architecture, tests, failure modes, scope) plus design/a11y. Verdict: NOT READY (one high).

| id | sev | finding | evidence | fix |
|---|---|---|---|---|
| R1 | high | P7 acceptance "`curl -s` of the from-host HTML showing no `#move=`" always fails, and T-D1's "outerHTML contains neither `#move=`" is ambiguous the same way: the inline script itself holds the literal `#move=` (receiver regex `/^#move=([A-Za-z0-9_-]*)&then=/`, builder string). | `index.html` saved-scale handoff block, `movePayload` receiver and `moveForward` | P7: replace with `curl -s <from> \| grep -cE '#move=[A-Za-z0-9_-]{16,}'` = 0, plus a DOM check that no `[href*="#move="]`/`[action*="#move="]` exists. T-D1: scope it to attribute values (`querySelectorAll('[href],[action],[formaction]')`), not raw outerHTML. |
| R2 | medium | T-E2/P7 "return to OLD with Back" then click again: the old page can come back from bfcache, so the banner's partial count and `go_rest` label stay stale from before the click. Plan doesn't say the banner re-renders on `pageshow`. | existing `window.addEventListener("pageshow", ...reconcileSavedCollection)` only reconciles the store | D6: re-read `hpfc.move.sent` and re-render the banner on `pageshow` (persisted); T-C1/T-E2 assert the label after Back. |
| R3 | low | `hpfc.move.sent` write is not stated as try/catch-wrapped; a quota/blocked write must not stop the `assign`. | D6 | D6: "written in try/catch; a failed write still navigates". |
| R4 | low | T-B1 analytics assertion "under a non-webdriver host fixture" is vague: `analyticsAllowed()` returns false for `navigator.webdriver` and for 127.0.0.1/localhost/.pages.dev. | `analyticsAllowed` | Name the exact mechanism (existing gtag/dataLayer stub used by the shipped-id test) or assert `loadAnalytics` was called rather than `gtag` length. |
| R5 | low | `mv_move_region_cap_drifts` patches the frozen region; not listed as kept/retargeted. | `tests/mutants/mv_move_region_cap_drifts.patch` | List it as kept and re-verified against T-F. |

Verified true: constants null; `MOVE_CAP = 20000`; freeze test bounds `const MOVE_FROM =` .. end of `moveReport` (so `go` section and new `moveUrl` sit outside); `moveForward` has no `await`, so a synchronous builder in the click handler is sound; 8 i18n tables; 7 keys; listed mutant files exist; receiver dedupe on `importedIds`.

Criteria: 1 FAIL (R1), 2-9 PASS. T1 PASS, T2 PASS in design but its verify is broken (R1), T3 PASS, T4 PASS (R2 hardens it), T5 PASS.

Dispositions (round 1):
- R1: FIXED. P7 uses the `grep -cE '#move=[A-Za-z0-9_-]{16,}'` = 0 check plus the DOM attribute check; T-D1 checks attribute values only.
- R2: SUPERSEDED by D6 (Q3). Was: D6 re-renders the banner on `pageshow` persisted; T-C1/T-E2 assert the banner after Back.
- R3: SUPERSEDED by D6 (Q3). Was: D6 wraps the write in try/catch, and a failed write still navigates.
- R4: FIXED. T-B1 names the fixture (`webdriver:false`, `old.example`, so `analyticsAllowed()` returns true) and asserts `analyticsLoaded`.
- R5: FIXED. `mv_move_region_cap_drifts` is listed as kept and re-checked against T-F.

### Round 2 (fresh independent eng + light design/a11y reviewer, 2026-11-04)

Verdict: READY. R1-R5 fixes hold (P7 grep + DOM attribute check; D6 pageshow re-render and try/catch; T-B1 names `boot2`/`old.example` and `analyticsLoaded`, which exists in `index.html`; `mv_move_region_cap_drifts` kept). Re-verified: `moveForward` (async, but no `await` in its body) holds the only three `location.replace` calls; `if (!MOVE_ON_OLD) loadAnalytics();` and `moveFlow`'s `MOVE_ON_OLD` branch exist; no `location.assign` exists today; 8 i18n tables; all 7 named mv_* patches exist; e2e titles named in Tests exist.

| id | sev | finding | fix |
|---|---|---|---|
| R6 | low | T-B2 names `moveGo`, but no Decision defines it (D4 says "click handler"). | D4: "the handler is `moveGo()`". |
| R7 | low | D6 tracks sent instance ids only. An edit made after a send is never re-prioritised, and the receiver dedupe drops it anyway. This is the existing behaviour, but the plan does not state it. | Edge cases: "edits after a move stay on the old host (unchanged from shipped behaviour)". |

Criteria 1-9 PASS. T1-T5 PASS.

R6/R7 applied by integrator 2026-11-04 (D1 names `moveGo()`; Edge cases line added).

Owner answers applied 2026-11-04 (Q1-Q4; D6 is now one move only; R2's pageshow re-render and R3's sent-list write are superseded because nothing is tracked).

### Round 3 (fresh independent reviewer, 2026-11-04, after owner Q1-Q4)

Verdict: NOT READY (two one-line leftovers from multi-send).

| id | sev | finding | fix |
|---|---|---|---|
| R8 | medium | P7 seeded sets say "n200 over cap with three clicks"; one-move has no batching, contradicting D6 and T-E2. | P7: "n200 over cap, one click carries the largest prefix; a second click carries the same prefix". |
| R9 | medium | D5 says "Only the row order changes (D6)", but D6 now keeps store order; contradicts "byte-identical" and A4/T-F. | D5: "The encoding, cap, binary search and row order are byte-identical." |
| R10 | low | Continuation point still lists R2/R3 as FIXED with pageshow re-render and sent-list write. Superseded note exists, but reads contradictory. | Mark R2/R3 "SUPERSEDED by D6 (Q3)". |

Clean: no `hpfc.move.sent`, MOVE THE REST, `move.go_rest`, `mv_sent_first` in plan body; 6 keys (banner, banner_empty, banner_overcap, go, go_plain, dismiss) x 8 tables in `data/i18n/` matches; `MOVE_CAP = 20000` and the binary search exist in `index.html` `moveForward`; T-C1/T-E2/mutants/edge cases match one move. Criteria 1-9 PASS except 4 (internal consistency) pending R8/R9; T1-T5 PASS.

- R8, R9, R10: FIXED as worded in the round 3 table.
- R11 (low): FIXED. The round-1 'D6 pageshow re-render and try/catch' and R7's 'D6 tracks sent instance ids' describe pre-Q3 D6; superseded by one-move D6 (Q3). Round 4: READY.
