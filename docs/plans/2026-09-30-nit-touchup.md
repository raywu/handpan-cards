# Nit touch-up lanes (2026-09-30)

Drafted by the integrator, AFK, from `2026-09-30-nit-queue.md`. The per-row sources
(reviewer text plus current file:line) were harvested from the #165-#169 reviewer
transcripts on 2026-09-30. Line numbers below are at `origin/main` ed64c8a. They
drift, so grep for the quoted code rather than trusting a number.

## Goal and non-goals

**Goal.** Resolve or explicitly close every OPEN row of the nit queue. That
includes the fixes, their tests, their mutants and the doc corrections. Nothing
the user sees on the three built-in decks changes, except that jittery taps no
longer hop (Q9).

**Non-goals.**
- No roadmap or idea work (SM-2, stats, PWA, audio).
- No deck data, diagram geometry or visual-system change.
- No layout change for the Q15 shadow. Measure it and report; the owner decides.
- No refactor of the swipe code beyond the named guards.
- No change to the engine regions or the DECKS line.

## Auto-decisions (AFK; recorded for the owner)

| # | Decision | Rationale |
|---|---|---|
| AD1 | Q1 N3 (no mutant names the chip-position e2e test): **accept, CLOSED**. | This was O4's deliberate choice when the duplicate was retired. The test still runs. |
| AD2 | Q1 N4 (commit message wording): **CLOSED, informational**. | Fixing it would need `--amend`, which policy forbids. |
| AD3 | Q7, reviewer 2 nits: **CLOSED**. They were already fixed by the #168 integrator takeover (seq-ui-polish plan, A1/A3). | Verified on ed64c8a. |
| AD4 | Q7, reviewer 3 nits: (2) process only, **CLOSED**. (3) the unsupported-deck footer grid is D8 by design, **CLOSED**. (4) `#seq-style` not in a live region: **CLOSED, no change**. | `#count` already announces the re-roll. Adding a second live region would double-announce. Conservative. |
| AD5 | Q13 twin mutants: **retire `sw_flip_reset_animates.patch`** (the O4 precedent: one mutation, one patch) and keep `sw_button_path_reveal.patch`. Add both suites' kill note to the survivor's header. | A duplicate body is not two mutants. |
| AD6 | Q2 comment false positives: **reword** the two comments (`index.html` ~940 "#printroot, body.printing" and ~6501 "window.print()/openPrintSheet"), rather than strip comments in the test. | Simpler test, and the comments are stale-ish anyway. |
| AD7 | Q15 stuck drag: fix it (cancel on `contextmenu`, and on a mouse `pointermove` whose `buttons` lacks the primary bit), with a CDP test. Q15 shadow: **measure only**. | The fix is small, local and testable. The shadow fix would be a layout change, which is out of goal. |
| AD9 | Fold the stale `test_render_agreement` docstring into N2's ownership. | It is the same stale claim as Q3, and splitting it off would leave a new nit. |
| AD10 | Swipe thresholds: 3x (18px, 0.15 px/ms). | The owner asked for 3x-5x; start at the conservative end so taps and vertical scrolls stay safe. |
| AD8 | Two lanes, in parallel. Lane N2 merges second and resolves the README mutant-count line at rebase, by counting the patches on disk. | The lanes split on file ownership. The single shared line is mechanical. |

## Lanes

### Lane N1: harness and docs (`claude/nit-n1-harness`)

**Owns:**
- `tests/mutation_harness.test.js`
- `tests/mutants/f_pdfcards_blank_padding_skips.patch` (new)
- `tests/mutants/mh_reverse_apply_skip_dropped.patch`, `tests/mutants/mh_head_diff_guard_dropped.patch` (new)
- `tests/mutants/r1_print_ios_ipad_desktop_ua_dropped.patch` (header only)
- `docs/plans/2026-09-29-backlog-and-refactor.md`
- `docs/plans/2026-09-29-card-swipe-animation.md`
- `README.md` (only the mutant-count line, +3)

**Never touches:** `index.html`, `src/`, `tests/e2e.test.js`, `tests/app.test.js`,
`tests/suite_health.py`, and any other mutant.

1. **Q1 N5.** In `childEnv()` (`tests/mutation_harness.test.js` ~41), delete
   `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` from the copied env. Add a test
   that passes them through `childEnv({GIT_DIR: "x", GIT_WORK_TREE: "y",
   GIT_INDEX_FILE: "z"})` and asserts that all three are absent. Do not mutate
   `process.env`. The `extra` argument is merged before the deletes, so the test
   fails today and passes after the fix. [review: the process.env approach leaks
   between tests]
   Verify: `bash -c 'node --test tests/mutation_harness.test.js'`.
2. **Q1 N1 + N2.** The staleness test ("every mutant patch applies to the tree it
   will run against", ~375-410) is hardwired to `ROOT` and the real corpus. A
   fixture repo cannot reach it. Do this first:
   - Extract its per-patch logic into a helper, e.g. `staleMutants(root,
     mutantsDir)`, which returns the list of stale patches.
   - Make the existing test call `staleMutants(ROOT, <real mutants dir>)` with
     unchanged assertions.
   - The fixture tests call the same helper against a `makeFixture` repo.

   Then, in the helper's reverse-apply (`-R`) branch (~394-397), treat a patch as
   "already applied" only while `git diff --quiet HEAD -- <the patch's paths>`
   exits non-zero. Parse the paths from the patch's `+++ b/` lines. When the tree
   matches HEAD on those paths, the post-image was committed, so the patch is stale.

   Tests first:
   - (a) A patch applied to the working tree but uncommitted is NOT reported stale.
     This test PASSES today. It pins the E2 reverse-apply guard: it must fail if
     the `-R` branch is deleted.
   - (b) The same post-image committed to HEAD IS reported stale. This test FAILS
     today and passes after the fix.

   Add two mutants that pin the guard (N2's complaint was that nothing pins it):
   - `mh_reverse_apply_skip_dropped.patch` deletes the `-R` fallback. It is killed
     by (a).
   - `mh_head_diff_guard_dropped.patch` deletes the new `git diff --quiet HEAD`
     check. It is killed by (b).
   - Each has `# suite: node --test --test-name-pattern=<pattern> tests/mutation_harness.test.js`,
     using `.` wildcards and no quotes.
   - The README count goes +2 for these.

   The existing `mh_patch_context_drifted` mutant must still be killed. It still
   will be: while that patch is applied, `cdp.js` differs from HEAD, and
   `e_reap_ignores_signals` stays stale.
   Verify: as in step 1; for each mh_ mutant, apply it, run its suite and see it
   FAIL, then `git apply -R`.
3. **Q5.** Add `tests/mutants/f_pdfcards_blank_padding_skips.patch`. It changes the
   full-deck padding push in `src/engine/pdfcards.js` (~558, `["blank", null]`) to
   push `"skip"`, following the src-only pattern of
   `j_pdfcards_hairline_width.patch`. Header:
   `# suite: python3 -m unittest tests.test_pdf_parity.PrintParityTest.test_every_vector_matches_print`
   (word-split, no quotes). Set README's mutant count to +1.
   Verify: `git apply --check tests/mutants/f_pdfcards_blank_padding_skips.patch`;
   then apply it, run the suite command and see it FAIL; then
   `git apply -R` it. The reviewer already confirmed this: 2 failures, e.g.
   "full page 7 of pygmy". The baseline passes.
4. **Q4.** Rewrite lines 3-6 of the header of
   `r1_print_ios_ipad_desktop_ua_dropped.patch` to the current consequence. An
   iPad in desktop mode is not detected as iOS, so `downloadDeckPDF` takes the
   `<a download>` branch, which iOS Safari ignores: no file is saved. Keep the
   `kills`/`suite` header lines byte-identical and leave the hunk untouched.
   Verify: `git apply --check` on it, and `git diff` shows header lines only.
5. **Q6.** In `docs/plans/2026-09-29-backlog-and-refactor.md`:
   - remove B23 from the DEFER list (~371);
   - annotate the "NOT in scope ... Renaming the PRINTER_ONLY download (B22)" line
     (~447) as "(done in #164)";
   - append "(superseded by #164)" to E9 (~332) and E12 (~335).
6. **Q13 doc.** In `docs/plans/2026-09-29-card-swipe-animation.md` ~493:
   - rewrite claim (b) to "the two patches had identical bodies; one is retired
     by lane N2 of the 2026-09-30 nit touch-up (AD5)". N1 merges before N2, so do
     not use the past tense "was retired".
   - rewrite claim (d) to say the count is maintained in README.md, not restated.

**Acceptance:**
- `bash -c 'node --test tests/mutation_harness.test.js'` passes.
- `bash -c 'python3 -m pytest -q tests/test_readme_currency.py'` passes.
- Each of the three new mutants (f_, and both mh_), applied, fails its named suite.
- `mh_patch_context_drifted.patch`, applied, still fails its suite.
- `python3 tools/validate.py` passes.
- CI is green at the head.

### Lane N2: app fixes (`claude/nit-n2-app`)

**Owns:**
- `index.html`, outside the engine regions and the DECKS line
- `tests/app.test.js`, `tests/e2e.test.js`, `tests/suite_health.py` (FLOORS)
- `README.md` (only the mutant-count line)
- `tests/test_render_agreement.py`: only the docstring of
  `test_print_block_is_last_in_the_style_element`, reworded to match the Q3
  comment (integrator AD9, folded in from the eng review's follow-up)
- `tests/mutants/`: new `r1_lock_*` and `sw_*` patches; the retirement of
  `sw_flip_reset_animates.patch`; context refreshes of any existing mutant its own
  `index.html` edits restale. It never touches the header of
  `r1_print_ios_ipad_desktop_ua_dropped.patch`, which Lane N1 owns. If that patch
  needs a hunk refresh, take N1's header at rebase.

**Never touches:**
- `src/`
- `tests/mutation_harness.test.js`
- `docs/plans/` other than this doc (the integrator writes this doc)
- deck data

Write the tests first for every item.

1. **Q9 jitter hop.** In `release()`, when `!dir && !moved`, clear the transform
   and `swipeRest()` with no spring-back animation. `!moved` implies |dx| <=
   SLOP, so `swipeDecision` already returns 0 there. The guard is therefore
   equivalent to `!moved`, and fling behaviour is unchanged. The tap flip comes
   from the card's click listener, which `!moved` leaves alone (eatClick is not
   set).
   e2e test: a real-touch drag of 6px, which is below `SWIPE_SLOP_PX`, then:
   - Before the drag, install a page-side spy that wraps `scene.animate` and
     counts calls.
   - After pointerup, assert the count is 0.
   - Do NOT assert `getAnimations().length === 0` "right after pointerup". That
     races the 260 ms spring-back, and a slow CI frame could let it pass on the
     unfixed code.
   - The tap still flips the card. The existing 8px-flip test (~7872) must keep
     passing.

   Add mutant `sw_jitter_hop_guard_dropped.patch`, killed by the new test.
2. **Q11 right-click eatClick.** In the capture pointerdown handler (~8156), set
   `eatClick = inside && e.button === 0`. e2e test:
   - Start a flight, and keep it alive by pausing the fly-out animation
     (`a.pause()`), as the F1/F2 tests do.
   - Send a right-button pointerdown inside the rest box. A CDP `button: "right"`
     press gives pointerdown with button 2 plus contextmenu/auxclick, and no click.
   - Finish the flight. `land()` steps once, so record that index.
   - Press Enter on the focused `#next`. The deck must step once more
     (landing index + 1).

   Add mutant `sw_eatclick_any_button.patch`, which restores `eatClick = inside;`.
3. **Q12.** First, a dedicated e2e test for the `eatClick = false` reset in the
   capture handler's no-flight branch (~8164):
   - Positive control: with `eatClick = true` set through `b.eval`, a
     `document.getElementById("next").click()` (no pointerdown) must NOT step.
     This proves the eval writes the live top-level binding.
   - Then set `eatClick = true` again and do a real `b.click("#next")`. Its
     pointerdown finds no flight and resets eatClick, so the deck must step.

   Then add three mutants, each with a `# suite:` line naming its killing test
   with `.` wildcards:

   | Mutant | Change | Killed by |
   |---|---|---|
   | `sw_main_touch_action_dropped` | delete the `main{touch-action:pan-y pinch-zoom}` rule (~425) | "card swipe: a second real swipe from the REST position during flight is not dropped" (~8013) |
   | `sw_land_will_change_left_on` | delete `scene.style.willChange = "";` in `land()` (~8067-8080) | "card swipe: a commit flies the card out, then steps and deals the next card in from the opposite side" (~7800) |
   | `sw_no_flight_eatclick_reset_dropped` | drop the `eatClick = false;` reset | the new test above |

   Confirm each kill locally before writing the header.
4. **Q15 stuck drag.** In `swipeMove`, if `e.pointerType === "mouse" && !(e.buttons & 1)`,
   `release(e, true)` and return. Add a `contextmenu` listener on `#card` that
   calls `release(e, true)` only `if (drag)`.

   Reviewer probe, headless Chrome at ed64c8a:
   - A CDP `mouseMoved` with `buttons: 0` after a left `mousePressed` does arrive
     as `pointermove` with `buttons === 0`. There is no synthesized pointerup,
     and the drag stays live and follows the pointer: the bug reproduces.
   - `contextmenu` fires for a right press. It also fires for a ctrl+left press
     (on macOS only, so it is not portable to Linux CI).
   - A synthetic `dispatchEvent(new MouseEvent("contextmenu"))` reaches the
     listener while the drag is live.

   Two e2e tests (CDP):
   - (a) `mousePressed` left at the card, then `mouseMoved` 60px with
     `buttons: 0`. Assert that `drag` is null and there is no inline transform
     once animations finish, and that a later click still flips.
   - (b) Left press, then dispatch a synthetic `contextmenu` on `#card`. Assert
     that `drag` is null. Use the synthetic event, not ctrl+click, for CI
     portability.

   Add mutants `sw_mouse_buttons_check_dropped.patch` (killed by a) and
   `sw_contextmenu_release_dropped.patch` (killed by b).
5. **Q15 shadow, measure only.** At 380x800, compute whether `.face`'s box-shadow
   extent passes `main`'s padding box. Use `getBoundingClientRect` plus the parsed
   `box-shadow` offset, blur and spread. Report the numbers in the lane report. Do
   not change the CSS.
6. **Q10.**
   - E10/E11 (`tests/e2e.test.js` ~8045/~8061 and ~8069/~8088): replace the
     direct `panelOpen`/`sheetOpen` assignments with a real mid-drag
     `openPanel()` (~7919) / `showSheet()` (~7473) call. Use whatever function
     the menu button and sheet trigger call; find it by enumerating the
     listeners, not by grep alone.
     **Risk:** `showSheet()` always makes `main` inert. `openPanel()` does so
     off-desktop only; the e2e viewport is 900x900, which is desktop. Inerting
     can end the drag through `lostpointercapture`, which calls
     `release(e, true)`. The test would then pass by the cancel path, and
     `sw_panel_guard_dropped` / `sw_sheet_guard_dropped` would survive.
     Acceptance: both guard mutants, applied, still fail the rewritten tests. If
     either survives, keep the direct assignment for that test and record why in
     a one-line comment.
   - N40 test (~8346): the test asserts that NO transition runs, so polling for
     a running `CSSTransition` would hang on the correct code. Instead:
     - install a `transitionrun` listener on `#card` that counts events, before
       the action;
     - wait two animation frames (or `b.settle()`), not a fixed sleep;
     - assert the count is 0.

     `sw_button_path_reveal.patch` (the Q13 survivor) must still fail the
     rewritten test.
7. **Q2 print lock.** Extend the lock test (`tests/app.test.js` ~3900; existing
   asserts at 3905-3911) with code-shaped absence assertions:
   - `addEventListener\(\s*["']afterprint`
   - `body\.printing\b`
   - `\bwindow\.print\s*\(`
   - `printGridCSS\s*\(`
   - `typeof printGridCSS === "undefined"`

   The original `[>{.#]` / `\(\)\s*;` forms were too narrow: they miss
   `window.print()` without a trailing `;` and `body.printing)`. The two comment
   hits, `index.html:940` "(#printroot, body.printing)" and `:6501`
   "window.print()/openPrintSheet", DO match the broadened forms. So keep AD6 and
   reword both comments, e.g. "the old printing body class" and "the browser
   print dialog".

   Add mutants `r1_lock_afterprint`, `r1_lock_body_printing` and
   `r1_lock_window_print`, each re-introducing one pattern in code, not in a
   comment.
8. **Q3 stale comments.**
   - Rewrite the print-block header comment (~935-942): it forces print colour,
     clears the page background and padding, and resets the swipe transform.
     - Drop the `.face::before` claim (that rule is at ~465, outside the block)
       and the stale `test_render_agreement.py:238`/`:320` line refs.
     - KEEP one sentence saying the block is deliberately last in the `<style>`
       element, enforced by
       `test_render_agreement.py::test_print_block_is_last_in_the_style_element`
       (~562-587). That test still exists.
   - Fix the `.shuffle-wrap` comment (~989-990) to "markup grouping only
     (display:contents) in every mode". There is only one rule, at ~565.
   - Delete the orphaned fragment `/** The print sheet's page geometry…` fused
     into `/** D16's paper control…` at ~6474-6479, just above `PRINT_PAPER`.
9. **Q13 retire.** `git rm tests/mutants/sw_flip_reset_animates.patch`. Add to
   `sw_button_path_reveal.patch`'s header a comment line noting that the E7 and N40
   tests both kill it.
10. **Bookkeeping.**
    - Bump the FLOORS for `e2e.test.js` in `tests/suite_health.py` by the number of
      tests added.
    - Set the README mutant count to the number of `tests/mutants/*.patch` on disk.
    - Refresh any mutant restaled by the `index.html` edits.
    - Run `git apply --check` on every `tests/mutants/*.patch`, including the five
      h_* script patches.

**Acceptance:**
- Each new e2e test passes locally, run singly with CHROME_BIN and
  `--test-name-pattern`. Never run the full e2e file locally.
- Each new mutant, applied, fails its named suite.
- The existing guard mutants `sw_panel_guard_dropped`, `sw_sheet_guard_dropped`
  and `sw_button_path_reveal`, applied, still fail their suites after the Q10
  rewrites.
- `for p in tests/mutants/*.patch; do git apply --check "$p" || echo BAD $p; done`
  prints nothing.
- `bash -c 'node --test tests/app.test.js'` passes.
- `python3 tools/validate.py` passes: no engine-region or DECKS drift.
- CI (including the mutation gate) is green at the head.

## Merge gates (standing)

Same as every lane:
- a verified `pr_url` whose head SHA equals the local tip;
- CI green at that SHA;
- a fresh `swarm-reviewer` returning PASS or PASS_WITH_NITS at that SHA;
- then `gh pr merge --merge --match-head-commit`.

**Lane S (added 2026-09-30, OWNER REQUEST, not a nit).** The owner said: "Swipe
gesture is very difficult at low speed ... needs to be at least 3x-5x more
sensitive". Branch `claude/swipe-sensitivity`:
- `SWIPE_COMMIT_PX` 55 -> 18;
- `SWIPE_FLING_PX_MS` 0.5 -> 0.15 (AD10: the low end of the owner's range, about 3x;
  retune after the owner's device check);
- slop and fling window are unchanged.
It also includes the tests, the value-mutant updates and one new slow-drag e2e test.
S touches `index.html`, the e2e tests, FLOORS and mutants, so it overlaps N2.
**N2 is spawned only after S merges**, from the new main. N1 runs in parallel
with S.

Merge N1 first, since it is smaller. N2 rebases only if it conflicts; the README
count line will. Bounce cap: 2 per lane.

The integrator updates `2026-09-30-nit-queue.md` statuses after both merges.

## Follow-ups outside both lanes

- None. The test_render_agreement docstring follow-up is folded into N2 (AD9).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| Eng Review | `/plan-eng-review` (spawned) | Architecture and tests (required) | 1 | ISSUES_FIXED (APPROVE_WITH_CHANGES) | 11 fixed in plan, 0 critical gaps |
| Outside Voice | codex | Independent second opinion | 0 | SKIPPED | spawned reviewer, not run |
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | - | - |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | - | - |

The eng-review findings, all fixed in the plan text above:

- **N1 step 2:**
  - The staleness test was unreachable from a fixture repo, so the plan now
    extracts a helper.
  - Test (a) passes today, which the plan now says (its claim that both tests
    fail was wrong).
  - It adds two mh_ guard mutants.
- **N1 step 1:** the `childEnv(extra)` test no longer mutates `process.env`.
- **N2 step 1:** the animate-call spy replaces the racy `getAnimations()` check.
- **N2 step 2:** the flight is kept alive, and the landing step is accounted for.
- **N2 step 3:** the killing tests are named for two of the mutants, and a
  positive control is added for the eatClick eval.
- **N2 step 4:** the plan now records the CDP probe result. It adds a portable
  contextmenu test (synthetic event) and a second mutant.
- **N2 step 6:** the E10/E11 inert-capture risk is gated on guard-mutant kills,
  and the inverted N40 wait is fixed.
- **N2 step 7:** the regexes were broadened. AD6 is still needed, because the
  comments match the broadened forms.
- **N2 step 8:**
  - The "print block last" sentence is kept, because it is enforced by a test.
  - The orphan line ref was corrected to ~6474-6479.
- **Acceptance:** `tools/validate.py` was added to both lanes; N1 checks the
  mh_/f_ kills and N2 the guard-mutant kills.

**VERDICT:** ENG REVIEW: APPROVE_WITH_CHANGES. The changes are applied in this
doc and it is ready to execute.

NO UNRESOLVED DECISIONS
