# iOS Safari prints the app, not the card sheet

Workstream B shipped B1-B6 on PR #104 (`782d4d3`) and handed AC-B6 to the
owner as B7. The device check came back FAILED on its first run. This plan
fixes what it found. Workstream B stays open until it does.

## The defect, as observed

iPhone 14 / iOS 26.6, Safari, portrait, custom deck from the Amara seed
`(D3) A3 C4 D4 E4 F4 G4 A4 C5`, tapping FULL DECK PDF with LETTER selected.

**Expected:** a sheet of 6 chord cards per page, 3 across by 2 down.
**Observed:** the iOS print preview rendered the LIVE APP - the "Handpan
Chord Cards" title, the NAME -> NOTES / NOTES -> NAME toggles, the nav
arrows, "1 / 25", "SHUFFLE: OFF" and the generated-deck notice - on a single
sheet reading "Page 1 of 1". No card grid at all.

This is NOT the blank-preview symptom recorded as queue row 147. It is
worse: the feature produces a plausible-looking printed page of the wrong
document, which a user can mistake for a working feature with a bad layout.
Row 147 is superseded by this plan.

## Root cause

`index.html:4311-4332`. `openPrintSheet()` populates `#printroot`, adds
`body.printing`, calls `window.print()`, and tears all of it down in a
`finally` that runs the instant `print()` returns:

```js
    window.print();
  } finally {
    root.innerHTML = "";
    root.hidden = true;
    document.body.classList.remove("printing");
    document.getElementById("printgeom").textContent = "";
  }
```

Desktop Chrome **blocks** inside `window.print()` until the dialog is
dismissed, so the sheet is still in the DOM when the page is rasterized.
iOS Safari **returns immediately** and schedules the print UI
asynchronously. The `finally` therefore runs BEFORE iOS rasterizes, and
iOS prints the live app page.

Every desktop test passes because the synchronous assumption holds there.
The whole feature is built on it.

## Why 346 mutants and a page-level PDF oracle did not catch it

`tests/e2e.test.js:1189` ("every printed card keeps its full height on
every page") is the repo's only test that rasterizes a real page. It
**stubs `window.print()`**, captures `#printroot.innerHTML`, and re-injects
that HTML plus the `printing` class before calling `Page.printToPDF`. It
reconstructs the sheet rather than letting the app's own sequence deliver
it, so it validates the print CSS and is structurally blind to whether the
sheet survives to raster time.

`tests/app.test.js`'s `printed()` helper (line 3593) does the same thing for
the same reason, and `test("print sheet leaves no residue")` (line 3627)
actively asserts the synchronous teardown that causes the bug.

The lesson for AC-C4 below: a test that reconstructs the state it wants to
measure cannot catch a defect in how that state is produced.

## Decisions

- **D18. Teardown moves to `afterprint`, not to a timeout.** A timeout
  trades one race for another and its correct value is unknowable across
  devices. `afterprint` is the event the platform defines for exactly this.
  Rejected: `setTimeout(teardown, N)`.
  RISK NAMED at review (outside voice): the plan models "`afterprint` never
  fires" but not the symmetric failure - `afterprint` fires TOO EARLY.
  WebKit dispatches `beforeprint`/`afterprint` around its own pagination
  call, not around the user-visible preview, and on a platform whose
  `print()` is admittedly non-blocking there is no a-priori reason the event
  must come after raster. If iOS fires it synchronously inside `print()`,
  this fix is a no-op, AC-C1 and AC-C2 both go green in CI, and B7 fails a
  second time with the same symptom. There is no CI oracle for this; **B7 is
  the probe**, which is why C7 now gates merge on the device run.
  If B7 fails that way, the next step is a guarded `matchMedia("print")`
  handler (`!e.matches` only) as the teardown trigger - the shape D19 cut -
  NOT the snapshot-at-tap theory.
- **D19. WITHDRAWN at review (2026-09-22). No `matchMedia("print")`
  second trigger.** The original rationale - "Safari has historically been
  more reliable on the media-query transition than on `afterprint`" - was
  asserted without evidence and is backwards. MDN browser-compat-data records
  `Window.afterprint_event` as supported on **Safari iOS since 13**; the
  device is iOS 26.6, so the primary trigger is spec-supported on the exact
  target. The second trigger also carried a concrete regression: Chrome fires
  `matchMedia("print")` `change` with `matches === true` at print START, so a
  handler without a `!e.matches` guard would tear the sheet down before
  desktop Chrome rasterizes - reintroducing the shipped bug on the one
  platform that works today. Cut rather than guarded, per "keep solutions
  minimal".
- **D20. A stranded sheet is acceptable; a wrong printout is not.** If
  neither trigger ever fires, the sheet stays in the DOM. Verified safe:
  `.printing` appears ONLY inside `@media print` (`index.html:776-778`) and
  `#printroot` is `display:none` unconditionally on screen
  (`index.html:744`), so a stranded sheet is invisible to the user. The
  only ON-SCREEN cost is DOM residue - duplicate ids and a second copy of
  the deck's SVGs.
  CORRECTED AGAIN at review (outside voice): invisible is not harmless. A
  stranded sheet leaves `body.printing` set and `#printroot` populated
  INDEFINITELY, so the user's NEXT system-initiated print - iOS Share ->
  Print, or desktop Cmd+P, with no CTA involved - prints the stale card
  sheet instead of the app. That is the same class of defect this plan
  exists to fix, arriving through a different door, and it is unbounded in
  time rather than merely untidy. This is the real justification for the
  `afterprint` listener: not residue (already bounded below) but
  stale-next-print. D19 stays cut anyway - a guarded fallback costs a
  concrete desktop-Chrome regression risk today against a hazard B7 will
  report on directly.
  The residue bound itself is ASSIGNMENT
  SEMANTICS, not by D21. `root.innerHTML = printSheetHTML(...)` replaces the
  container's contents wholesale on every CTA press, so a stranded sheet can
  never become two. The original claim that D21's entry teardown provided
  this bound was wrong - see D21.
- **D21. REVISED at review (2026-09-22). The `afterprint` listener is
  registered ONCE at boot, not per CTA press.** The original D21 - "tear down
  defensively on entry" - is a no-op. `index.html:4317-4322` assigns
  `printgeom.textContent`, `root.className` and `root.innerHTML` as whole
  values, and `classList.add("printing")` is idempotent, so a second
  `openPrintSheet()` already replaces the first sheet rather than appending
  to it. Residue was never able to exceed one sheet, and an entry teardown
  changes nothing observable.
  The accumulation that IS real is listener stacking: registering
  `afterprint` inside `openPrintSheet()` adds one handler per CTA press.
  Registering once at boot removes it outright and needs no `{once:true}`
  option (which the sandbox stub does not honour). A boot-scope handler also
  fires on a user's own Cmd+P; teardown is idempotent, so clearing an already
  empty `#printroot` is harmless.
- **D22. The throw path stays synchronous.** If `window.print()` throws, no
  print is happening and no event will arrive, so teardown runs immediately.
  `tests/app.test.js:3645` keeps asserting exactly this.

## Acceptance criteria

- **AC-C1 The sheet survives a non-blocking `print()`.** With a
  `window.print()` stub that returns without firing `afterprint` - the iOS
  behaviour - `#printroot` is still populated, still `hidden === false`, and
  `body.printing` is still set after `openPrintSheet()` RETURNS.
  This is the regression test. It must be RED before the fix.
  Verify: `node --test --test-name-pattern sheet.survives tests/app.test.js`
- **AC-C2 `afterprint` tears the sheet down.** After dispatching
  `afterprint`, `#printroot` is empty and hidden, `#printgeom` is empty, and
  `body.printing` is gone. This is the existing "leaves no residue"
  invariant with its trigger corrected, not a weakened one.
  Verify: `node --test --test-name-pattern no.residue tests/app.test.js`
- **AC-C3 WITHDRAWN at review (2026-09-22).** It was first written as
  "residue never exceeds one sheet", which passes against every
  implementation including the unfixed one (`root.innerHTML = ...`
  overwrites). Re-aimed mid-review at "the `afterprint` listener does not
  accumulate", and the outside voice showed that version is not implementable
  against the stub this plan builds either: `winListeners`
  (`tests/helpers/sandbox.js:264`) is closed over and uncounted, and C4 adds
  only `fireWindow(type)`, no listener-count accessor. It is also
  behaviourally unobservable - teardown is idempotent by design, so firing
  `afterprint` once after two CTA presses produces identical state whether
  one handler ran or three. Rather than add a `windowListenerCount()` hook to
  guard a handful of duplicate idempotent handlers, the criterion is cut.
  Prior learning applied: `tdd-step-that-cannot-fail` (confidence 9/10, from
  2026-09-18). D21's once-at-boot registration STANDS on its own merits; it
  is simply not test-gated.
- **AC-C4 The page-level oracle stops stubbing `print()`.** NOT in scope -
  see Non-goals. The owner chose "add a sequencing test, keep the oracle".
  Recorded here so the gap is visible rather than forgotten: the geometry
  oracle at `tests/e2e.test.js:1189` still reconstructs its sheet.
- **AC-C5 The throw path is unchanged.** `tests/app.test.js:3645` passes
  untouched.
  Verify: `node --test --test-name-pattern dialog.throws tests/app.test.js`
- **AC-C6 Mutants.** At minimum: teardown restored to synchronous, i.e.
  `catch` reverted to `finally` (kills AC-C1); the `afterprint`
  listener never registered (kills AC-C2); and the closure-capture variant -
  `teardown` closing over a `getElementById("printroot")` result evaluated at
  REGISTRATION time rather than re-querying inside the body (also kills
  AC-C2, by throwing on the first `afterprint`). REVISED at review: the
  "entry-teardown dropped" mutant is gone with D21, and the "registration
  moved inside `openPrintSheet()`" mutant is gone with AC-C3. The
  closure-capture mutant replaces it because that is the variant a
  re-implementer is most likely to write - see C4.
  Verify: `bash tests/mutation_check.sh`
- **AC-C7 Owner device re-check.** B7's Run A, B and C re-run on the iPhone
  14. CI cannot close this; it is the whole reason the defect shipped.

## Tasks

- **C1** Write AC-C1's test. Run it, watch it FAIL against today's
  synchronous teardown. Do not write any fix first.
- **C2** Rewrite `test("print sheet leaves no residue")` to dispatch
  `afterprint` before asserting (AC-C2). It must still fail against a
  no-teardown implementation - check that by deleting the teardown locally
  before writing the fix.
- **C3** REMOVED with AC-C3.
- **C4** Implement. The load-bearing edit is one keyword: `index.html:4323`
  changes from `} finally {` to `} catch (e) { teardown(); throw e; }`. If
  that keyword stays `finally`, every other part of this fix is inert and
  AC-C1 still fails - name it explicitly rather than leaving it implied by
  "keep the catch-path teardown" (D22).
  Alongside it: extract the four teardown statements into one idempotent
  MODULE-SCOPE `teardown()`, and register
  `window.addEventListener("afterprint", teardown)` once at boot (D21), not
  inside `openPrintSheet()`. CORRECTED at review: the earlier wording said
  "local `teardown()`" AND "boot scope", which cannot both hold. It must be
  module scope, and it MUST re-query `document.getElementById("printroot")`
  and `"printgeom"` inside its own body rather than closing over
  `openPrintSheet`'s `root`. The inline CTA handlers
  (`index.html:4355-4356`) mean the app script is top-level and parsed before
  `</body>`, so a registration-time `getElementById` would capture `null` and
  throw on the first `afterprint`. AC-C6 carries a mutant for exactly this.
  `tests/helpers/sandbox.js:265-270` ALREADY serves window-level
  `addEventListener`/`removeEventListener` (added for `popstate`) - do not
  re-add them. The real stub gap is that a test has no way to FIRE a window
  event: `winListeners` is closed over and never exposed. Add a
  `fireWindow(type)` to the returned boot handle, beside `flushTimers` and
  `printCalls`. No `matchMedia` stub is needed (D19 withdrawn).
  Also correct the two comments that assert the old invariant, or the next
  reader reinstates the bug: `index.html:4324-4325` ("Unconditional: a print
  dialog that throws...") and the `printed()` helper docblock at
  `tests/app.test.js:3586-3588` ("the app empties it immediately
  afterwards"), and - added at review - `tests/e2e.test.js:1197`
  ("openPrintSheet() empties #printroot in its own finally as soon as
  print() returns"), which is attached to the oracle AC-C4 deliberately
  leaves unfixed and is therefore the stale comment most likely to be read
  next.
- **C5** Re-anchor `tests/mutants/p_print_container_left_populated.patch`;
  its context lines shift and its `# kills:` test now needs the corrected
  trigger. Add the three AC-C6 mutants. Stage the FIXED file first, then
  mutate, then `git diff -- index.html | grep -v '^index [0-9a-f]*\.\.'`.
  No embedded quotes in `# suite:` - use a dotted regex.
- **C5b** Before trusting any green from an AC verify command, confirm the
  `--test-name-pattern` actually selected a subtest. Prior learning applied:
  `handpan-e2e-targeted-run-reports-only-the-file` (confidence 9/10, from
  2026-09-20) - a pattern matching NOTHING reports the same passing line as
  a pattern that ran. C1's "watch it FAIL" covers AC-C1 only; AC-C2, AC-C3
  and AC-C5 have no equivalent guard. EXTENDED at review: the same hazard
  applies to each new mutant's `# suite:` dotted regex - one that selects
  nothing reports the same passing line, so a mutant can look killed by a
  command that ran zero subtests. Confirm each new `# suite:` line selects a
  subtest before trusting `mutation_check.sh`.
- **C6** Push, read CI's own `tests/app.test.js: ran N` line, raise the
  floor in a second commit (two-push protocol). Do not compute it locally.
- **C7** Fresh reviewer at the verified head SHA, then **re-run B7 with the
  owner, THEN merge**. REORDERED at review: the earlier order put merge
  before the device check, which repeats the exact sequence that shipped the
  bug - desktop-green plus an untested platform theory treated as evidence.
  This plan's own framing is that CI cannot close AC-C7, and the first device
  run already failed. B7 gates the merge, not the other way round.

## Non-goals

- Rewriting the `tests/e2e.test.js:1189` geometry oracle (owner decision;
  AC-C4 records the residual gap).
- Any change to print CSS, card geometry, slot arithmetic or deck data.
  This plan touches the teardown lifecycle and nothing else.
- Fixing queue rows 140-143, which the owner picked up separately.
- The D17 3x2 layout, ratified by the owner 2026-09-22 and not in question.
- **Printing a SEPARATE document instead of mutating the live one.** Named
  explicitly at review rather than left silent: mutate-print-unmutate is the
  only reason a teardown race exists at all, and a separate document has no
  lifecycle to race. Rejected because the browser-side way to do it is an
  iframe `contentWindow.print()`, which is itself unreliable on iOS Safari -
  trading a known race for an unknown one on the same platform. Revisit only
  if B7 fails a second time.

## What could sink this

If `afterprint` does not fire on iOS Safari either, the sheet is never torn
down and D20 carries the whole weight - correct printouts, residue bounded
to one sheet by assignment semantics, no visible breakage. That is an acceptable resting state, but it
means AC-C2 passes in CI and never fires on the device that matters. B7's
re-run is the only thing that can tell us - but only partly. D20 makes the
failure mode INVISIBLE by design: a stranded sheet does not render on screen,
so AC-C7 can confirm the PRINTOUT is right and cannot confirm that teardown
ran on the device. Treat a clean B7 as evidence for AC-C1 and the print path,
not as evidence for AC-C2.

If `afterprint` fires TOO EARLY on iOS - synchronously inside `print()`,
around WebKit's pagination rather than around the preview - the fix is a
no-op with a green CI. See D18: that is the first suspect on a second B7
failure, and the response is a `!e.matches`-guarded `matchMedia("print")`
trigger, not a rearchitecture.

Only if that is also ruled out is the next suspect iOS rasterizing from a
snapshot taken at the moment of the tap. That would point at building the sheet
BEFORE the user gesture rather than during it, which is a materially bigger
change - stop and re-plan rather than patching.

## What already exists

Reviewed for "does something here already solve a sub-problem, and does the
plan reuse it or rebuild it?"

| Sub-problem | What exists | Plan's posture |
|---|---|---|
| Window-level event registration in the unit sandbox | `tests/helpers/sandbox.js:265-270` already serves `addEventListener` / `removeEventListener` on the window stub, added for `popstate` | REUSE. C4 originally said "needs `addEventListener` on the window stub"; corrected at review - it is already there. |
| Firing a window event from a test | Nothing. `winListeners` is closed over and never exposed; only element-level `dispatchEvent` exists (`sandbox.js:90`) | BUILD. One `fireWindow(type)` on the boot handle. |
| Bounding print-sheet residue | `root.innerHTML = ...` assignment semantics (`index.html:4319`) already make residue unbounded-impossible | REUSE. D21's entry teardown was rebuilding a bound that already held; dropped at review. |
| Idempotent teardown | The four `finally` statements at `index.html:4324-4329` are already idempotent | REUSE. Extracted to a local, not rewritten. |
| A print-media-only visibility rule that makes a stranded sheet harmless | `#printroot{display:none}` (`index.html:744`) and `.printing` used only inside `@media print` (`index.html:776-778`) | REUSE. This is what makes D20 safe; no CSS change. |
| A page-level PDF oracle | `tests/e2e.test.js:1189` | REUSE AS-IS. Owner chose not to rework it; AC-C4 records the gap. |
| Mutation coverage for the teardown | `tests/mutants/p_print_container_left_populated.patch` | RE-ANCHOR, not replace (C5). |

## NOT in scope

- **Reworking the `tests/e2e.test.js:1189` geometry oracle to stop stubbing
  `print()`.** Owner decision ("add a sequencing test, keep the oracle"). The
  residual gap is recorded as AC-C4: nothing rasterizes a sheet the app's own
  sequence produced.
- **A `matchMedia("print")` fallback trigger.** Withdrawn at review (D19):
  `afterprint` is compat-supported on the target OS, and the second trigger
  carried a desktop-Chrome regression hazard.
- **A timeout-based teardown.** Rejected in D18; its correct value is
  unknowable across devices.
- **Any change to print CSS, `@page` sizing, card geometry, slot arithmetic
  or deck data.** This plan is the teardown lifecycle and nothing else.
- **Queue rows 140-143** (dead `printSlots()`, under-scoped CSS-literals test,
  AC-B5b text/code disagreement, dead `d.blank_cards` branch). Owner picked
  these up as separate work.
- **Queue row 146** (unpinned `pip install pymupdf` in four CI jobs). Owner
  chose "Keep it" without the pin; row stays open.
- **The D17 3x2 small-screen layout.** Ratified by the owner 2026-09-22.

## Coverage diagram

```
CODE PATHS                                        USER FLOWS
[~] index.html openPrintSheet()                   [+] Print a custom deck
  ├── try: build + show + print()                   ├── [GAP][->DEVICE] FULL DECK PDF on iOS  - AC-C7 Run A
  │   ├── [GAP] print() returns, no afterprint      ├── [GAP][->DEVICE] PRINT SHOP PDF on iOS - AC-C7 Run B
  │   │         -> sheet MUST survive   AC-C1       ├── [GAP][->DEVICE] LETTER vs A4           - AC-C7 Run C
  │   ├── [**  TESTED] wide/narrow slot count       └── [**  TESTED] paper picker keeps state - app.test.js:3660
  │   │         - app.test.js:3605
  │   └── [**  TESTED] print() throws -> teardown [+] Cancel the iOS print dialog
  │             + rethrow  AC-C5 - :3645             └── [GAP] does iOS fire afterprint on cancel?
  ├── catch: teardown(); throw        AC-C5                    Unobservable on device (D20). Accepted.
  └── [NEW] teardown() module-scope, idempotent
      ├── [GAP] fired by afterprint      AC-C2   [+] Press the CTA twice
      └── [GAP] fired twice -> no-op     AC-C2     └── [NOT GATED] one listener, not two
[~] boot scope                                          AC-C3 withdrawn: unobservable
  └── [NOT GATED] addEventListener("afterprint") x1     (teardown is idempotent)
[~] tests/helpers/sandbox.js
  └── [GAP] fireWindow(type) helper - exercised by AC-C2

COVERAGE before this plan: 3/10 paths (30%)   after C1-C6: 7/10 (70%)
Remaining 3 are AC-C7 device runs. CI cannot close them; that is the whole
reason the defect shipped.
```

## Failure modes

| New codepath | Realistic production failure | Test? | Error handling? | Silent? |
|---|---|---|---|---|
| `afterprint` never fires on iOS | Sheet stranded in DOM for the session | AC-C2 passes in CI and proves nothing about the device | D20: sheet is `display:none` on screen | Yes - and ACCEPTED. Not a critical gap: the printout is still correct, which is the whole user-visible outcome. |
| `afterprint` fires on a user's own Cmd+P with no sheet up | `teardown()` clears an empty container, removes an absent class | AC-C2 second-dispatch assertion | Idempotent by construction | Yes, harmlessly |
| `finally` left in place instead of `catch` | Fix is completely inert; iOS still prints the app | AC-C1 is RED, and the AC-C6 revert mutant kills it | None needed | No - AC-C1 catches it |
| `afterprint` registered per CTA press | One extra handler per press; teardown runs N times | NOT GATED (AC-C3 withdrawn) | Idempotent, so functionally harmless; it is a leak, not a bug | Yes - accepted: unobservable through behaviour, and gating it would need a listener-count hook in the stub |
| `teardown` closes over a registration-time `getElementById` | Throws on the first `afterprint`; sheet never torn down | AC-C2 + the AC-C6 closure-capture mutant | None - it is a TypeError | No |
| Sheet stranded, then the user hits Cmd+P / Share->Print | The stale card sheet prints instead of the app, indefinitely | Not directly; this is the hazard the `afterprint` listener exists to remove (D20) | None | Yes - the strongest argument for the listener |
| iOS rasterizes from a gesture-time snapshot instead | Fix does nothing; preview still shows the app | Nothing in CI can see this | None | No - AC-C7 catches it, and the plan says STOP and re-plan |

No critical gaps. The one silent-and-untested mode (`afterprint` never fires)
is silent BY DESIGN under D20 and costs a correct printout nothing.

## Worktree parallelization strategy

Sequential implementation, no parallelization opportunity. Every task touches
`index.html` or the two test files that assert against it, and C1-C3 are a TDD
chain whose whole value is ordering (RED before GREEN). C6's floor bump is
gated on C6's own CI output. One lane, one worktree.

## Implementation Tasks

Synthesized from this review's findings. Each derives from a specific finding.

- [ ] **T1 (P1, human: ~20min / CC: ~3min)** - index.html - Change `finally` to `catch (e) { teardown(); throw e; }`
  - Surfaced by: Architecture issue 3 - D22/C4 said "catch-path teardown" but `index.html:4323` is `finally`; leaving it inert makes every other change pointless
  - Files: `index.html:4312-4331`
  - Verify: `node --test --test-name-pattern sheet.survives tests/app.test.js`
- [ ] **T2 (P1, human: ~30min / CC: ~5min)** - index.html - Register `afterprint` once at boot, not per CTA press
  - Surfaced by: Architecture issue 2 - D21's entry teardown is a no-op; the real accumulation is listener stacking
  - Files: `index.html` (boot scope, near the existing `popstate` registration). `teardown()` is MODULE scope and re-queries its elements inside its own body - never a registration-time capture (see C4).
  - Verify: `node --test --test-name-pattern no.residue tests/app.test.js` (AC-C3 withdrawn; this task is not separately test-gated)
- [ ] **T3 (P1, human: ~15min / CC: ~3min)** - tests/helpers/sandbox.js - Add `fireWindow(type)` to the boot handle
  - Surfaced by: Code-quality issue 5 - `addEventListener` exists at `:265` but nothing can fire a window event; prior learning `plan-must-grep-for-the-helper-it-adds` (9/10). No listener-count accessor is added; AC-C3 was withdrawn rather than met with one.
  - Files: `tests/helpers/sandbox.js:265-270`, and the returned handle near `flushTimers`
  - Verify: `node --test --test-name-pattern no.residue tests/app.test.js`
- [ ] **T4 (P1, human: ~45min / CC: ~10min)** - tests/app.test.js - AC-C1 and AC-C2 tests, RED first
  - Surfaced by: Test review - AC-C3 as originally written could not fail; prior learning `tdd-step-that-cannot-fail` (9/10)
  - Files: `tests/app.test.js:3627` (rewrite trigger), plus AC-C1's new test
  - Verify: `node --test tests/app.test.js`
- [ ] **T5 (P2, human: ~10min / CC: ~2min)** - index.html, tests/app.test.js, tests/e2e.test.js - Correct the three comments asserting the old synchronous invariant
  - Surfaced by: Code-quality issue 4, extended by the outside voice - all three document the behaviour being removed
  - Files: `index.html:4324-4325`, `tests/app.test.js:3586-3588`, `tests/e2e.test.js:1197`
  - Verify: read-only; no command
- [ ] **T6 (P2, human: ~40min / CC: ~10min)** - tests/mutants/ - Re-anchor the existing patch, add the three AC-C6 mutants
  - Surfaced by: AC-C6, revised twice - "entry-teardown dropped" is gone with D21, "registration moved inside openPrintSheet" is gone with AC-C3, and the closure-capture mutant replaces it
  - Files: `tests/mutants/p_print_container_left_populated.patch` + 3 new (finally-revert, listener-never-registered, closure-capture). Confirm each `# suite:` regex selects a subtest (C5b).
  - Verify: `bash tests/mutation_check.sh`
- [ ] **T7 (P2, human: ~20min / CC: ~5min)** - tests/suite_health.py - Raise the app.test.js floor from CI's own printed count
  - Surfaced by: C6 two-push protocol; prior learning `floors-are-minimums-not-equalities` (9/10)
  - Files: `tests/suite_health.py`
  - Verify: CI `suite health`

- [ ] **T8 (P1, human: ~0 / CC: ~0)** - process - B7 device re-run GATES the merge
  - Surfaced by: Outside-voice finding 6 - C7 originally merged first, repeating the sequence that shipped the bug
  - Files: none; sequencing only
  - Verify: AC-C7 Runs A/B/C on the iPhone 14 before `gh pr merge`

## GSTACK REVIEW REPORT

Skill: `/plan-eng-review`. Target: this plan. Branch: `claude/ios-print-teardown`.
Session `22698-1790047877-22df6b58`. Model: claude (opus 5), medium effort per
the standing AFK execution default.

| Run | Source | Status | Findings |
|---|---|---|---|
| Step 0 complexity gate | self | PASS - does not trigger | 6 files, 0 new classes/services; no overlapping `TODOS.md` entry |
| Step 0 search check | WebSearch + direct `curl` of `@mdn/browser-compat-data` | COMPLETE (degraded) | `/browse` unavailable (`NEEDS_ASIDE`); BCD gave the authoritative answer that killed D19 |
| Architecture | self | 3 findings | D19 unevidenced + Chrome regression; D21 entry teardown is a no-op; `finally` vs `catch` never named |
| Code quality | self | 2 findings | 2 stale comments; sandbox gap misidentified |
| Tests | self | 1 finding + 1 note | AC-C3 could not fail; `--test-name-pattern` false-green guard (C5b) |
| Performance | self | 0 findings | one boot listener, one O(1) teardown |
| Outside voice | Claude subagent (opus, `general-purpose`) | 9 findings | codex unusable - see below; findings verbatim in the plan's amendment trail |
| Codex second opinion | codex CLI | UNAVAILABLE | `CODEX_MODE: model_unusable` - `failed to decode models response: unknown variant 'max'`. Stale CLI, not auth. Fix: `npm install -g @openai/codex` |

**Auto-decisions (AFK armed - no human at the keyboard).** Every one took the
recommended option; none was destructive.

1. Cut D19 entirely (self finding 1).
2. Drop D21's entry teardown; correct D20's bound to assignment semantics;
   register `afterprint` once at boot (self finding 2).
3. Name the `} finally {` -> `} catch (e) { teardown(); throw e; }` edit in C4
   (self finding 3).
4. Fold the comment corrections into C4 / T5 (self finding 4).
5. Add `fireWindow(type)` to the sandbox boot handle (self finding 5).
6. Add C5b, the pattern-selects-a-subtest guard (test note).
7. Withdraw AC-C3 outright rather than add a `windowListenerCount()` hook
   (outside voice 3). D21's once-at-boot registration stands untested.
8. Re-justify the `afterprint` listener on stale-next-print grounds and
   correct D20's cost statement (outside voice 2).
9. Make `teardown()` module scope and re-query its elements inside its body;
   add the closure-capture mutant (outside voice 4).
10. Add `tests/e2e.test.js:1197` to the stale-comment list (outside voice 5).
11. Reorder C7 so the B7 device run gates the merge (outside voice 6) - new T8.
12. Extend C5b to mutant `# suite:` regexes (outside voice 9).
13. Add the separate-document approach to Non-goals with its rejection reason
    (outside voice 8).
14. Record the `afterprint`-fires-too-early risk in D18 and in "What could
    sink this", with B7 as the probe (outside voice 1).

**CROSS-MODEL TENSION, resolved.** The outside voice argued (finding 2 + 7)
that cutting D19 leaves the stale-next-print hazard with no backstop.
Resolution: D19 stays cut. The `matchMedia` fallback costs a concrete
desktop-Chrome regression today - Chrome fires `change` with
`matches === true` at print START - against a hazard that B7 will report on
directly within one device run. If B7 shows `afterprint` does not fire, or
fires too early, the response is a `!e.matches`-guarded `matchMedia("print")`
trigger, now written into D18 as the named next step rather than left to be
rediscovered. The outside voice's underlying point was accepted in full: D20's
cost was mispriced and is corrected.

**VERDICT: REVISE-THEN-EXECUTE - revisions applied.** The plan as first drafted
had a step that could not fail (AC-C3), a no-op decision (D21's entry
teardown), an unnamed load-bearing edit (`finally`), and a merge ordered ahead
of the only check that can close AC-C7. All four are fixed above. The plan is
cleared for execution at T1.

NO UNRESOLVED DECISIONS
