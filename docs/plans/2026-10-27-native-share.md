# Native share button (execution-ready, not started)

Refreshed 2026-10-30 against origin/main b104da18 and origin/dev 47e1f224. Mode: plan. AFK: armed. Small task: one boundary (`copyLink()`, the `#share-copy` markup/glyph, the I18N selector row, `data/i18n/*.json`, and tests). One dev-first lane.

## Goal
On a touch device (`pointer:coarse`) that has `navigator.share`, `#share-copy` is a Share button that opens the system share sheet with the current link, called synchronously inside the tap. Everywhere else it copies the link, as today.

## Current state (verified on main b104da18; `copyLink()` body identical on dev 47e1f224)
- `copyLink()` tries `navigator.clipboard.writeText` FIRST (inside `Promise.resolve().then`), and only on rejection calls `share()`, which itself runs `navigator.share({url})` inside a microtask. So share is a fallback, outside the gesture, with no coarse-pointer or `canShare` gate.
- `reveal()` hard-codes `say("SELECT THE LINK AND COPY IT")`; `share.select` exists in all 8 tables.
- `share_copy {deck_kind, method}` with `clipboard|share|select` already ships.
- No `header.share` key; the I18N selector row `["#share-copy","aria-label","header.share_copy"]` is static.
- CLAUDE.md has no share-icon bullet: no CLAUDE.md patch is needed (removed from the plan).

## Non-goals
- No change to the share-link format (v6), `routeInfo`/`syncRoute`, or the `current()`/generation guards.
- No external asset (glyph stays inline SVG); no title/text/file payload.
- No new analytics event or param; `share_copy` stays `{deck_kind, method}` (no id, name or code - CLAUDE.md Analytics privacy).
- No desktop share sheet; no PWA/share-target work.

## Decisions
- D1: share applies when `navigator.share` exists AND `matchMedia('(pointer:coarse)').matches` AND (`!navigator.canShare || navigator.canShare({url})`). Evaluated at boot for glyph/label, and again in the click handler (R2-4). Otherwise: today's clipboard -> reveal chain. (AFK, reversible.)
- D2: payload `{url: location.href}` only.
- D3: when share applies, `navigator.share` is called synchronously in the click handler after the synchronous `current()` guard; no await, microtask or clipboard call before it.
- D4: outcomes. Resolve -> `done(t("share.shared"), "share")`. AbortError -> silent. Any other error -> clipboard; clipboard rejects or absent -> `reveal()`. A pending flag ignores taps while a share is in flight and clears on every settle path.
- D5: analytics unchanged in shape: `method` in `clipboard|share|select`.
- D6: i18n. New key `header.share` in all EIGHT tables (en, de, es, fr, it, ja, zh-Hans, zh-Hant); aria-label key chosen in the same function as the glyph, and re-applied after a language switch (the static I18N selector row must not reset it). `reveal()` uses `t("share.select")`. Run `python3 tools/sync_i18n.py`, then `--check`, plus the fit check at 380px (owner rule: keys, sync, audit, fit).
- D7: glyph: box-and-arrow share glyph when share applies, current two-stadium link glyph otherwise.

## Assumptions
- A1 (verified, MDN/WebKit): Web Share on iOS Safari 12.2+, Android Chrome 61+; HTTPS + transient activation required.
- A2 (accepted risk, owner QA): some in-app webviews resolve share without a sheet; announced as LINK SHARED.
- A3 (verified): `copyLink()` identical on main and dev, so base choice is free; base on origin/main per the "lane branches stack on main" memory rule.

## Why smallest
One function reorder plus a state-dependent glyph/label and one i18n key. No new module, harness or event.

## Lane NS (branch `claude/ns-native-share`, worktree off origin/main)
- **Owner:** lane agent. **Prereq:** fresh worktree; re-run `awk '/^function copyLink/,/^}/' index.html` on main and dev to confirm still identical (if not, base on the side carrying the newer block and say so in the PR).
- **TDD - write first, see red** (`tests/app.test.js`):
  1. Coarse + share: share called once with exactly `{url}`, call count already 1 when `click()` returns; clipboard untouched on resolve; `share.shared` announced.
  2. AbortError: silent, no clipboard write, no track of `select`.
  3. NotAllowedError: clipboard fallback, LINK COPIED, `method:"clipboard"`.
  4. Share rejects then clipboard rejects: field revealed with `t("share.select")` text (also checked in ja).
  5. Second tap while pending does nothing; a tap after resolve, after AbortError and after another error each works again.
  6. Fine pointer + share present: clipboard used, share not called.
  7. No share: clipboard; neither: reveal. `canShare` returning false: clipboard.
  8. Label/glyph follow share state and survive a language change (aria-label = `header.share` text in the new locale).
  9. `share_copy` carries only `deck_kind` and `method` in `clipboard|share|select`.
  10. `header.share` present in every `data/i18n/*.json` table (8).
- **Existing titles to update/rename:** "SU: COPY LINK copies location.href and announces LINK COPIED"; "SU: COPY LINK falls back to navigator.share when the clipboard rejects" (invert: clipboard is the fallback); "SU: COPY LINK reveals the readonly input when both are absent"; "SU: COPY LINK says nothing when the share sheet is dismissed"; "SU: COPY LINK tracks share_copy with no id, name or code"; "SI: #share-copy is the header's first control, a button labelled Copy link with an inline SVG and no external asset"; "SI: the glyph is two rotated stadiums at stroke-width 2.4" (scope to fine pointer); "SI: a second COPY LINK clears the message line before writing LINK COPIED again". Keep "over-cap ... disables COPY LINK" and "not a panel stop" green unchanged. In e2e keep "edge 9: a real COPY LINK click puts location.href, query included, on the clipboard" and "edge 10: COPY LINK is a 44px target..." green under fine pointer (touch emulation off) (R3-2).
- **e2e** (`tests/e2e.test.js`): 380x780, coarse pointer emulated, share stubbed: one tap -> stub count 1 on the same tick; fine pointer -> stub count 0.
- **Mutants:** if existing mutants anchor on the reordered lines, refresh per repo tooling (`tools/refresh_mutants.py`), strip `index` lines; owned by this lane.
- **Acceptance (observable):** tests 1-10 red before, green after; `python3 tools/sync_i18n.py --check` and `python3 tools/inline_engine.py --check` clean; CI `validate` conclusion success at the verified head SHA (`gh run list --commit <sha> --workflow validate.yml`); independent reviewer PASS/PASS_WITH_NITS at that SHA.
- **Verify:** `node --test tests/app.test.js`; `node --test --test-name-pattern "share|COPY LINK" tests/e2e.test.js` (CHROME_BIN); `python3 tools/sync_i18n.py --check` (audit: test 10 + the I18N describe block); `python3 tools/validate.py`. Fit check = the 380px self-check of the button aria-label/tooltip and the `share.select`/`share.shared` message line in en, ja and de (R3-1).
- **PRs:** M -> main (`Refs` the Linear issue if one exists), D -> dev from the same head. D merges under the AFK dev grant once M's validate is green at that head, review addressed, not CONFLICTING. M stays OPEN, held for owner iPhone QA.

## Verification split
- Automated: tests 1-10, renamed titles, e2e, i18n check, validate, CI at head.
- Self: 380px DEV look at glyph and label in en + ja.
- Independent: fresh reviewer subagent at verified head SHA (`/review`, read-only).
- Human (owner, DEV https://handpan-cards-dev.pages.dev/): iPhone Safari + Chrome (sheet opens with link; dismiss is silent); Android Chrome; one in-app browser (Instagram); desktop Chrome/Safari copies the link (no sheet); iPad with trackpad acceptable either way.

## Risks / edge cases
- Pointer type changes at runtime (iPad trackpad): click re-evaluates D1; glyph may lag until next render - accepted.
- Clipboard after a failed share runs outside activation (Safari may reject) -> reveal covers it.
- Hidden page/sheet/about/panel during a pending share: existing `current()` guards drop the completion.

## Recovery
Revert on dev via `claude/dev-revert-ns`; main untouched until owner merges. No data or link-format change, so no saved scale is at risk.

## Continuation
Next action: dispatch lane NS from origin/main (authorized under AFK for lane work and dev merge only).

## Stop
DEV merged and owner device QA requested; main PR held for the owner.

## Decision log
- AFK 2026-10-30: base on origin/main (copyLink identical on both; memory rule). Dropped the CLAUDE.md patch (no share-icon bullet exists). Fit check = 380px self-check in en/ja/de. R3-1..R3-3 folded in.
- AFK: D1 coarse-pointer gate (R1-4, reviewer's recommendation; reversible).

## Review log
### Round 1 (2026-10-27, independent eng+design reviewer) - NOT READY
- R1-1 high: D5 is stale. `copyLink()` on origin/dev and origin/main already sends `share_copy {deck_kind, method}` with `clipboard|share|select`. Fix: keep the existing values and `deck_kind`; drop `copy|field`; test that the order change keeps them.
- R1-2 high: D7 conflicts with the code. Today `share()` runs `navigator.share` inside `Promise.resolve().then(...)`, and on fallback it runs only after a clipboard rejection, so it is no longer synchronous in the gesture. Fix: call `navigator.share` directly in the click handler, with no microtask, await or clipboard call before it, and keep the `current()` guard synchronous. The clipboard fallback after a non-Abort share error runs outside activation: Safari may reject it, so the chain must go on to `reveal()`. Add a test for share reject, then clipboard reject, then reveal.
- R1-3 medium: D2/D3 omit NotAllowedError (missing activation, or a second tap while a sheet is open: InvalidStateError). Fix: treat AbortError as silent, and send every other error down the clipboard-then-reveal chain. Ignore taps while a share is pending.
- R1-4 medium: desktop. macOS Safari, Windows/ChromeOS Chrome and Edge all expose `navigator.share`, so desktop gets the OS sheet, not a copy. That contradicts Phase 2's "desktop Chrome copies the link". Fix: pick one. Either accept the sheet on desktop and change the Phase 2 check, or gate on `matchMedia('(pointer:coarse)')`. Recommend the coarse-pointer gate, because a desktop user expects a copy.
- R1-5 medium: the label and glyph switch at boot (D4), so the i18n table row `["#share-copy","aria-label","header.share_copy"]` must become state-dependent, or a language switch resets it to "Copy link". Fix: add a `header.share` key and choose the key in the same place as the glyph. Test both after a language change. While fixing this, note that `reveal()` hard-codes "SELECT THE LINK AND COPY IT" although `share.select` exists in all 7 tables. That is the existing i18n gap: fold it in.
- R1-6 medium: the `{title}` payload. On iOS, adding `title` can make some targets (Messages, Notes) paste the title and the URL as two items. Several Android targets also drop the url when `text` or `title` is present. Fix: send `{url}` only, as today, or pin the choice with an owner QA check. Drop A3.
- R1-7 medium: prereq "dev's share block must agree with main" is unverified, and main/dev differ widely. Fix: diff `copyLink` on both in the lane brief, and base on whichever carries the current block (per memory, lanes go to dev first).
- R1-8 low: the existing SU/SI titles to rename are not listed: "SU: COPY LINK copies location.href and announces LINK COPIED", "SU: COPY LINK falls back to navigator.share when the clipboard rejects" (inverted), "SU: COPY LINK reveals the readonly input when both are absent", "SU: COPY LINK tracks share_copy...", "SI: #share-copy is the header's first control, a button labelled Copy link...", "SI: the glyph is two rotated stadiums...", and "SI: a second COPY LINK clears...". Fix: list them in Phase 1 along with the new titles.
- R1-9 low: in-app browsers. The Instagram, Facebook and LINE webviews expose `navigator.share` inconsistently, and some resolve it without showing a sheet. The chain already covers absence. Fix: add one Android in-app check to Phase 2.
- R1-10 low: e2e "inside the gesture" cannot be proven with a stub. Fix: assert the stub is called synchronously, with no microtask between the click and the call, by recording `navigator.userActivation.isActive` at call time in Chrome.
- R1-11 low: done text. On share success the code says `share.shared` ("LINK SHARED"), but iOS resolves share even when the target fails. That is acceptable, but D2 should say success is announced.
Smallest approach: yes, once the edits above are in. It is one function reorder plus a label/glyph switch.
### Round 2 (2026-10-27, independent eng+design reviewer) - READY
Round 1 status: R1-1 fixed (D5, test 9). R1-2 fixed (D3; test 4). R1-3 fixed (D4; tests 3, 5). R1-4 fixed (D1 coarse gate, Phase 2 desktop check, decision log). R1-5 fixed (D6, test 8). R1-6 fixed (D2; A3 gone). R1-7 fixed (Phase 1 prereq; origin/dev:15225 and origin/main:14487 `copyLink()` bodies are identical in the opening block, so either base works). R1-8 fixed (title list). R1-9 fixed (Phase 2 Instagram check). R1-10 partly fixed, see R2-1. R1-11 fixed (D4 success, Risks).
- R2-1 low: the e2e proof is weak. `navigator.userActivation.isActive` stays true for the transient-activation window (about 5 s in Chrome), so a call made after a microtask also reads true; it does not prove D3. Fix: in the e2e test, also assert that the stub's call count is 1 when the click dispatch returns (`el.click()` then read the counter on the same tick), and keep test 1's synchronous assertion as the primary proof.
- R2-2 low: Verify omits the i18n audit that D6 requires. Fix: name the audit command (or the locale-table test) in Verify.
- R2-3 low: the pending flag (D4) needs a clear on every settle path (resolve, AbortError, other error), or one rejected share locks the button. Fix: make test 5 also assert a tap after the share settles works again.
- R2-4 low: the share state is read once at boot (D7), but `(pointer:coarse)` can change (an iPad that gains a trackpad, a convertible laptop). Fix: either re-evaluate in the click handler as well as for the glyph, or record "boot-time only" as accepted in Risks.
Readiness: no open blocker or high; A1 verified, A2 recorded; Phase 1 has prereqs, acceptance and verify; Phase 2 has acceptance by owner QA; recovery, continuation and stop are present. Verdict: READY (the four lows can be folded into the lane brief).
### Round 3 (2026-10-30, independent eng+design reviewer) - READY
Current-state claims checked against origin/main b104da18: `copyLink()` clipboard-first with `share()` in `Promise.resolve().then` (true); `reveal()` hard-codes "SELECT THE LINK AND COPY IT" (true); `share.select`/`share.shared`/`share.copied` in all 8 tables (true); `share_copy {deck_kind, method}` with clipboard|share|select (true); no `header.share` key, static row `["#share-copy", "aria-label", "header.share_copy"]` (true). All eight listed SU/SI titles plus "over-cap" and "not a panel stop" exist in tests/app.test.js. `tools/sync_i18n.py --check`, `tools/refresh_mutants.py`, `tools/validate.py`, `tools/inline_engine.py` exist. Coarse emulation precedent exists in tests/e2e.test.js (`Emulation.setTouchEmulationEnabled`). R2-1, R2-3, R2-4 fixed (e2e same-tick count, test 5 settle paths, D1 click re-evaluation).
- R3-1 low: R2-2 still open. D6 requires "audit" and "fit check at 380px" but Verify names no command or test for either. Fix: name the existing i18n audit/fit test titles (or state the self-check at 380px in en + ja + de is the fit check) in Verify.
- R3-2 low: existing e2e "edge 9: a real COPY LINK click puts location.href, query included, on the clipboard" and "edge 10" are matched by the Verify pattern but not listed. Fix: list them as must-stay-green under fine pointer (edge 9 must not run with touch emulation on).
- R3-3 low: test 4 non-English check should name the locale (e.g. ja) so the assertion is concrete.
Readiness: no open blocker/high; assumptions verified; lane has prereq, owner, deliverable, acceptance, verify; failure cases (Abort, NotAllowed, double reject, pending, canShare false, fine pointer) covered; recovery, continuation, stop present. Verdict: READY.
