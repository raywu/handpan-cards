# Scale pages: the app's practice-card UX for one progression

Branch base: `claude/scale-page-swipe` @ 77540e21 (main PR 709 held, dev PR 710).

## Goal
The owner wants each scale page to recreate the real app UX with one chord progression. A page's progression (3 cards) should look and behave like the practice screen in `index.html`: the same card anatomy, tap or Space to flip with the same 3D turn, the same drag with tilt, fly-out, spring-back and land, the same PREV/NEXT controls and counter, and the same reduced-motion handling. It is limited to the cards of that one progression.

## Non-goals
No deck data changes, no copy changes (only the visible text the app card already draws), no change to how the app behaves in `index.html`, no new test harness, no external script, no analytics on the pages. JS-off flip-B stays the no-script base. The hub page stays script-free.

## Findings (anchors, not line numbers)
**App (`index.html`):**
- `render()` builds two faces through `faceHTML(d, ch, n, kind)`:
  - mode A uses `question` (header + name + hint) and `answer` (header + `pan()` diagram + `linesHTML`);
  - mode S (progression) uses `answer` on the front and `backS` on the back, with `renderSeqRail` drawing a chord rail in `#count`.
- The flip is `.card.flip{transform:rotateY(180deg)}` with `transition:transform .45s cubic-bezier(.2,.7,.25,1)` and `perspective:1400px` on `.scene`. Reduced motion sets `transition:none`. `render()` moves `aria-hidden` and `aria-describedby` to the face that is showing.
- `flip()` and `step(dir)`: stepping wraps (modulo), suppresses the reverse transition, and always lands unflipped. Click and Enter/Space on `#card` flip; ArrowLeft/ArrowRight step, except while a form control has focus.
- The swipe block ("swipe (Tinder-style card drag)") has these constants:
  - `SWIPE_COMMIT_PX 18`, `FLING_PX_MS 0.15`, `FLING_WINDOW_MS 100`, `SLOP_PX 10`
  - `TILT_DEG_PER_PX 0.05`, `TILT_MAX_DEG 8`
  - `OUT_MS 220`, `BACK_MS 260`, `IN_MS 180`, `IN_PX 24`
  - `SWIPE_EASE`, `SWIPE_OUT_EASE`
  - `MOMENTUM_MIN/MAX_MS 140/320`, `MOMENTUM_FLOOR_PX_MS 1.5`
- The swipe functions are `swipeDecision` (axis dominance), `swipeOutTiming` (mouse momentum bezier), `swipeTilt`/`swipeXf`, `land`, `springBack`, `flyOut`, `releaseDecision`, `release`, `swipeMove`, and `setEatClick` (suppresses the trailing click). They need `touch-action:none` on `.scene`.
- `#count` is `aria-live=polite` and reads "n / N". Card flips send `track("card_flip")` and progression views send `track("progression_view")`; both events stay app-only.

**Page (`tools/gen_scale_page.py`):**
- `card_html` emits a shadow-DOM card (`CARD_CSS`):
  - the front is a page-only `.front` with a big name and the hint "Tap to reveal the notes";
  - the back is the answer card, using the SVG from the app's own `pan()` through `NODE_SRC`, booted in `tools/sandbox.js`.
- The flip is a checkbox with a `.5s` transition, `perspective:1200px` and a 14px radius. The app uses `.45s`, 1400px and 12px.
- Stepping is radio flip-B (`CSS_EXTRA`, PREV/NEXT labels, "Chord i of n"). It has no wrap, no slide animation and no tilt.
- `SWIPE_JS` is about 1.5KB. It only decides; it does not animate. It pins its constants to the app (`SWIPE_CONSTANTS`, `test_swipe_constants_match_the_app`).
- These tests pin the current behaviour:
  - in `tests/test_scale_pages.py`: `test_every_existing_page_regenerates_byte_identical_from_its_copy`, `test_js_off_markup_is_unchanged` (fixture `scale_pages_pre_swipe`), `test_swipe_script_fits_its_budget` (1536 bytes), `test_each_generated_page_is_under_sixty_kilobytes` and `test_scripts_are_the_json_ld_block_and_the_one_swipe_script`;
  - in `tests/e2e.test.js`: the "FT:" tests (Tab/arrows/Space, drag steps, vertical no-op, swipe-then-tap, edges, scripts off).

**The diff (app against page):**
1. The app's front face shows the diagram in mode S and the question in mode A. The page shows its own front.
2. The header, frame radius and shadow differ (`.face` box-shadow and the `::before` frame on the app; a 3px border on the page).
3. The flip timing, easing and perspective differ.
4. The page has no drag-follow, tilt, fly-out, spring-back or land animation.
5. The counter reads "n / N" in the app and "Chord i of n" on the page.
6. The app's wrap at the ends against the page's dead ends.
7. The app's arrow keys act on the card; the page's arrow keys act on the radiogroup.
8. Mouse momentum is app-only.

## Options (owner decision D1)
| | A: the page reimplements the card UX in `SWIPE_JS`/`CARD_CSS` | B: a shared module `src/ui/cardux.js`, inlined into `index.html` and copied into the pages by a sync tool like `inline_engine.py` |
|---|---|---|
| Drift | Medium. The constants are pinned by an extended `test_swipe_constants_match_the_app`, but the curves and logic are copies that can drift silently. | Low. There is one source and a `--check` drift gate, the same pattern as validate check 4. |
| Size per page | About +3KB JS and +1KB CSS. That still fits under 60KB, but the 1536-byte budget has to be raised. | About +5–7KB, because the module must carry the app's general paths (mouse lpc, panel or sheet blocking). That needs a budget re-set and probably trimming. |
| Test reuse | The FT e2e tests are extended. The app's swipe unit tests do not apply. | The app's `swipeDecision`/`releaseDecision`/`swipeOutTiming` unit tests cover the pages for free. FT keeps the integration. |
| Effort | Smaller: about 1 lane, page-only. It does not touch `index.html`. | Larger: an app refactor (the swipe block moves behind a module boundary with injected `blocked`, `step` and `scene`), plus `card_face_v1` and the full app swipe e2e as no-regression proof, plus a new sync tool and validate check. The app is touched even with no behaviour change, which is a risk to 40 prod users. |

**Recommendation: B-lite.** Extract only the pure gesture core into `src/engine/swipe.js` and inline it into `index.html` with the existing `inline_engine.py` engine regions, so there is no new tool. The core is the constants plus `swipeDecision`, `swipeOutTiming`, `swipeTilt`/`swipeXf` and `releaseDecision`: pure functions that already have unit tests. The generator copies the same file into the page script, and the page owns a small DOM driver (pointer handling, animate, land) and its CSS. This kills drift on every number and curve, reuses the unit tests, keeps app DOM code untouched (the app's `release` calls `HPE.swipe.*`), and adds about 2KB to each page.

This is a real trade-off against both pure A (the app stays untouched) and full B. **Owner gate: pick A, B-lite (recommended) or B.**

## Decisions
- D1: the option above. Owner gate.
- D2: the page's front face. **Owner gate.** The recommendation is the app's mode-A question face (header + name + "Tap to reveal the notes"; the copy is the same string), with the answer on the back. The alternative is mode S, where the diagram is on the front.
- D3: the ends of the progression. The recommendation is no wrap: a 3-card progression has no deck to loop, and flip-B has no wrap without JS. This differs from the app on purpose. Owner gate, low stakes.
- D4: the counter reads "n / 3" in the app style, but only with JS on; JS-off keeps "Chord i of n". This changes markup text only under JS, which is not a copy change. AFK-routine. Sub-decision D4a (recommended): the JS-on counter keeps `aria-label="Chord n of 3"`, so screen readers hear the same string as JS-off; the visible text alone changes.
- D7: arrow-key ownership. When the card (the shadow host) has focus, the driver handles Left/Right, steps one chord and sets the matching radio `checked`. When a radio has focus, the browser's native radiogroup behaviour stands and the driver does nothing (its keydown listener sits on the card, not on the document). AFK-routine.
- D8: state. The flip-B radio is the single source of truth for the current chord, and the flip checkbox for the face, before and after any animation. The driver reads the checked radio at gesture start; its `land` sets `checked` on exactly one radio and dispatches no event, so no `change` listener can step a second time. AFK-routine.
- D5: no analytics on the pages. Verified, by the non-goals.
- D6: card CSS values (radius, shadow, frame, flip timing and perspective) are copied from the app's `.card`, `.face` and `.face::before`, and a test pins them equal. AFK-routine.

## Assumptions
- `pan()` output is already identical; this is verified by `NODE_SRC`.
- The shadow-DOM card can host `Element.animate` on its host element.
- Raising the JS budget is acceptable. The 60KB page cap (`SIZE_CAP = 60 * 1024` = 61440, tests/test_scale_pages.py) stays. Measured 2026-10-29: the largest page, `scales/e-amara-20/index.html`, is 56845 bytes with today's 1536-byte `SWIPE_JS`, so the swipe script may grow by at most 4595 bytes. The pure core (the `SWIPE_*` constants, `swipeDecision`, `swipeOutTiming`, `swipeTilt`, `swipeXf`, `releaseDecision` and the momentum helpers) is 4673 bytes with its comments and about 2052 bytes without. So `src/engine/swipe.js` is written comment-light (the app keeps its explanatory comments beside the aliases), and the new budget is explicit: `SWIPE_JS` <= 5632 bytes in total (module plus driver), which leaves 499 bytes of margin on e-amara-20 (61440 - 56845 - (5632 - 1536)). P2 re-measures the module and the largest page before fixing the number in the test.

## Why this is the smallest change
No app DOM change, no new sync tool, and no new harness. The page markup stays the flip-B base; JS adds motion over it.

## File ownership
Lanes may edit only the files listed for their phase. A change outside the list is a boundary violation the reviewer flags.

**P1 (shared core):**
- `src/engine/swipe.js` (new): `HPE.swipe` with `decision`, `releaseDecision`, `outTiming`, `tilt`, `xf` and the `SWIPE_*` constants.
- `tools/inline_engine.py`: append `"swipe"` to `MODULES` (line 35, after `"sequence"`). Its order check (lines 89-96) refuses an unknown or out-of-order region, so P1 also inserts the `<!-- engine:swipe begin/end -->` region at the end of the engine block in `index.html` (the block that starts near index.html:1864) and fills it by running the tool. "No new tool" stays true; the tool's list changes.
- `index.html`, the app swipe block (anchor: `const SWIPE_COMMIT_PX`, `function swipeDecision` ... `function releaseDecision`): the five functions and the constants are replaced by global aliases, e.g. `const swipeDecision = HPE.swipe.decision`, `const SWIPE_COMMIT_PX = HPE.swipe.COMMIT_PX`, so every caller and `tests/app.test.js` see the same names. `land`, `springBack`, `flyOut` and `release` stay app-side.
- `tests/swipe.test.js` (new): unit tests against `HPE.swipe`. `tests/app.test.js` is edited in one test only, "index.html carries the whole engine inline, with no external script" (tests/app.test.js:636-637 and :646-648), which appends `"swipe"` to both of its module lists; every other line stays byte-unchanged as the no-regression proof (its swipe tests evaluate the bare globals through `app.get`, tests/app.test.js:4349-4355, and the aliases keep them valid).
- `tests/test_scale_pages.py` `test_swipe_constants_match_the_app` (line 670): rewritten to read the constants from `src/engine/swipe.js`, not the `index.html` literal line, which P1 removes. P1 owns only this one test in that file; the containment and budget tests are P2's.
- `README.md`: names `src/engine/swipe.js` and changes "twelve modules under `src/engine/`" to "thirteen", and changes "28 node suites" (README.md:81) to "29" (`test_the_suite_counts_match_the_files_on_disk`, tests/test_readme_currency.py:96; `tests/test_readme_currency.py` `test_every_engine_module_is_mentioned`, `test_the_module_count_word_matches_the_module_list`).
- `tests/mutants/`: the 19 patches whose removed lines sit in the moved core (found by grepping each patch's `-` lines against index.html:14975-15031 and 15092-15098): `ap1_release_drops_reduced_motion`, `e_swipe_deadzone_dropped`, `e_swipe_direction_inverted`, `sw_axis_dominance_dropped`, `sw_commit_moved`, `sw_commit_off_by_one`, `sw_eatclick_armed_on_cancel`, `sw_fling_direction_unchecked`, `sw_fling_ignored`, `sw_jitter_hop_guard_dropped`, `sw_momentum_easing_unseeded`, `sw_momentum_floor_dropped`, `sw_momentum_max_clamp_dropped`, `sw_momentum_min_clamp_dropped`, `sw_momentum_overshoot_unguarded`, `sw_momentum_reversed_velocity`, `sw_reduced_motion_ignored`, `sw_tilt_unclamped`, `us_release_commits_any_slop` (all `.patch`). P1 re-anchors each to `src/engine/swipe.js` only, with a `# suite:` header naming `tests/swipe.test.js`, and `tests/swipe.test.js` carries one case that kills each mutant (the harness never runs `inline_engine.py`, so the engine-module patch is what the unit suite sees). P1 strips `index` lines, runs `git apply --check` on all 19, and runs `tests/mutation_check.sh` on them. Patches that touch only app-side code (`sw_mouse_decay_*`, `sw_momentum_on_touch`, `sw_momentum_not_applied`, `sw_velocity_not_aged`, `sw_panel_guard_dropped`, `sw_sheet_guard_dropped`, `sw_cancel_from_event_x`, `us_capture_ignores_open_panel` and the other `sw_*` wheel and land patches) are re-checked with `git apply --check` and left as they are.
- `tests/suite_health.py`: one `"tests/swipe.test.js": <n>` row in `FLOORS`, where n is the case count P1 ships, and nothing else. Acceptance: `python3 -m unittest tests.test_suite_health` is green and CI's suite-health check passes. P2 raises its own `tests/test_scale_pages.py` and e2e rows if it adds tests there.
- Coverage note: after the re-anchor, app e2e tests no longer kill these 19 mutants (for example `sw_eatclick_armed_on_cancel`). This is intended: `tools/validate.py` check 4 keeps the inlined copy byte-equal to `src/engine/swipe.js`, so the unit kill in `tests/swipe.test.js` covers the shipped code.

**P2 (page driver and card):** `tools/gen_scale_page.py`, `tests/test_scale_pages.py` (all tests but the one P1 owns), the FT block of `tests/e2e.test.js`, `scales/**` and the JS-off fixture. P2 does not edit `index.html`, `src/engine/*` or `tests/mutants/`.

## Phases (TDD: red tests first in each)
1. **P0 Decide.** Prereq: none. Owner: the owner. Deliverable: D1, D2 and D3 answered in this file. DONE 2026-10-29 (owner): D1 = B-lite; D2 = diagram on the front face (mode S); D3 = wrap around (last chord steps to the first and back). P2's tests follow: the face test asserts the diagram on the front, and the step test adds a wrap case (step past 3 lands on 1, before 1 lands on 3) in place of any end stop.
2. **P1 Shared core.** Prereq: P0.
   - Write tests first: a new `tests/swipe.test.js` copies the existing `swipeDecision`/`releaseDecision`/`swipeOutTiming` cases and runs them against `HPE.swipe`, plus one killing case per re-anchored mutant; `test_swipe_constants_match_the_app` is rewritten to read `src/engine/swipe.js`.
   - Then add `src/engine/swipe.js`, append `"swipe"` to `MODULES`, insert the region, run `inline_engine.py`, replace the app's core with aliases, edit README, and re-anchor the 19 mutants (File ownership).
   - Accept: `tests/app.test.js` is byte-unchanged except the two module lists of the engine-inline test, and green; the app swipe e2e tests are green; `card_face_v1` is unchanged; `git apply --check` passes on every `tests/mutants/{sw_,e_swipe_,ap1_,us_}*` patch; `tests/mutation_check.sh` kills all 19 re-anchored mutants.
   - Verify: `node --test tests/swipe.test.js tests/app.test.js && python3 tools/inline_engine.py --check && python3 tools/validate.py && python3 -m pytest tests/test_readme_currency.py && python3 -m pytest tests/test_scale_pages.py -k "swipe or module" && python3 -m unittest tests.test_suite_health`
3. **P2 Page driver and card.**
   - Write tests first: a py test checks that the page script contains `src/engine/swipe.js` byte for byte; `test_swipe_script_fits_its_budget` asserts the new explicit budget (Assumptions). New FT e2e tests:
     - a drag tilts by 0.05deg/px, capped at 8;
     - a commit flies out and lands: read each `Animation`'s `effect.getComputedTiming().duration` through `getAnimations()` on the card and assert 220ms out and 180ms in, +/-1ms; wait with `waitElapsed`, never a bare sleep;
     - a commit advances exactly one step: one checked radio before, the next one after, and no second step after the animations finish (D8);
     - a short drag springs back;
     - reduced motion steps without animation;
     - arrow keys step while the card has focus, and the checked radio follows (D7);
     - arrow keys on a focused radio move the radiogroup natively and the driver steps nothing extra (D7);
     - the computed flip transition equals the app's;
     - the faces match the D2 anatomy;
     - the counter reads "n / 3" and carries `aria-label="Chord n of 3"` (D4a);
     - JS-off is unchanged;
     - at 380x780 the page has no horizontal scroll (`scrollWidth <= clientWidth`) before, during and after a swipe;
     - the focused card host shows a visible focus ring (computed `outline-style` not `none`, or a non-none `box-shadow`, under `:focus-visible`).
   - Owner additions (2026-10-29): A1 the progression rail ("Dm → F → Am → C", current chord marked) sits directly beneath the card, as in the app's mode S; FT test at 380x780: the rail's top is within the gap the app uses below the card (`--sp-3`, 14px) and no other element sits between them. A2 mouse swipe works in desktop Chrome: a drag steps, with no text selection, no native image or link drag, and the trailing click suppressed; FT tests with a mouse pointer at 1280x800: drag left steps forward, drag right steps back, a short drag springs back, a plain click still flips. App mouse momentum stays out of scope.
   - D2 JS-off exception (named here for R1-8): the D2/D6 anatomy lives in the card's shadow `<style>`, so `test_js_off_markup_is_unchanged` compares the pages with each shadow `<style>` block and the script removed; the pre-swipe fixtures stay byte-unchanged.
   - Then update `card_html`, `CARD_CSS`, `CSS_EXTRA` and the driver, and regenerate the 16 pages and the fixture.
   - Accept: every new and existing FT test passes, `test_js_off_markup_is_unchanged` passes with its fixture byte-unchanged (any D2/D6 anatomy change is made under JS or in CSS; a JS-off change needs an owner exception named in D2), and every page is under 60KB.
   - Verify (smoke): `python3 -m pytest tests/test_scale_pages.py && CHROME_BIN="$CHROME_BIN" node --test --test-name-pattern=FT tests/e2e.test.js`. `CHROME_BIN` is required for e2e; a lane shell without it skips e2e. The evidence is CI's `validate` run at the pushed head SHA, not this local run.
4. **P3 Gate.**
   - Push and let CI `validate` run at the head SHA.
   - An independent reviewer runs `/review` at that verified SHA.
   - Open the dev PR, check on DEV, then the owner checks on iPhone.

## Verification
- **Automated:** the unit, py and FT e2e tests above, plus CI at the head SHA.
- **Self:** run the probe at 320x568, 380x780 and 844x390 and compare frame by frame with the app.
- **Independent:** a fresh reviewer subagent.
- **Human:** the owner on iPhone, on DEV, for `/scales/d-kurd-9/` and `/scales/d-kurd-10/`: the swipe feel, the flip, and the absence of page scroll jumps.

## Risks
- Animating the shadow host may fight the flip-B radio scroll fix (`2026-10-29-flip-b-radio-anchor.md`). The FT fold-tap tests guard this.
- `touch-action:none` would block vertical page scroll. The page keeps `pan-y`, and the app's axis check covers the rest.
- B-lite moves app code. Any app test going red means stop and revert P1.

## Edge cases
- **JS off:** flip-B unchanged; the JS-off fixture is byte-identical.
- **Reduced motion:** steps without animation and flips without a transition.
- **320px:** the card is `min(322px,100%)`.
- **Landscape 844x390:** the card fits beside the fold; FT fold-tap tests.
- **Keyboard:** Tab, arrows and Space/Enter; arrow ownership per D7.
- **Screen reader:** `aria-hidden` on the face turned away; the counter is live but polite and keeps "Chord n of 3" as its `aria-label` (D4a).
- **d-kurd-10 (unfrozen):** it carries the same driver, and its labels are kept.
- **Pinch-zoom:** the edge guard is 20px, as the page uses today.

## Recovery
Each phase is its own commit. Reverting P2 restores the current swipe. Reverting P1 restores the app's inline swipe block.

## Delivery
**Recommended: a new lane `claude/scale-page-app-ux` stacked on 77540e21**, with its own dev PR, and its main PR held behind 709. Why not amend 709/710: those PRs are reviewed and DEV-checked as they are. A new lane keeps that evidence valid and isolates the app-touching P1 so it can be reverted on its own.

## Continuation point
P0: the owner answers D1, D2 and D3.

## Stop
Stop when D1–D3 are recorded, CI is green at the verified SHA, the reviewer returns PASS or PASS_WITH_NITS, the dev PR is merged, and the owner passes the iPhone check. The main PR stays held.

## Review log

### Review 1 (independent, 2026-10-29) - NOT READY

The B-lite split itself is real. `swipeDecision`, `swipeOutTiming`, `swipeTilt`, `swipeXf` and `releaseDecision` (index.html:14986-15030, 15092-15098) read only the `SWIPE_*` constants and their arguments. `land`, `springBack`, `flyOut` and `release` need `scene`, `card`, `flight` and `step`, and stay app-side. Some P1 mechanics are wrong or missing, though, and they would turn CI red or leave P1 without an owner.

- **R1-1 (blocker): P1 has no file-ownership list, and it moves lines that mutants anchor on.** Evidence: `tests/mutants/sw_axis_dominance_dropped.patch`, `sw_commit_off_by_one.patch`, `sw_commit_moved.patch`, `sw_fling_ignored.patch`, `e_swipe_deadzone_dropped.patch`, `e_swipe_direction_inverted.patch` and `ap1_release_drops_reduced_motion.patch` patch the `swipeDecision`/`releaseDecision` bodies in index.html. 119 patches mention swipe. Fix: add an Ownership section. P1 owns `src/engine/swipe.js`, `tools/inline_engine.py`, the swipe block of `index.html`, `tests/app.test.js` (swipe describe), `tests/swipe.test.js`, `README.md` and `tests/mutants/{sw_,e_swipe_,ap1_}*`. Re-anchor those mutants to `src/engine/swipe.js` (or the inlined region) and run `tests/mutation_check.sh` on them. P2 owns `tools/gen_scale_page.py`, `tests/test_scale_pages.py`, the FT block of `tests/e2e.test.js`, `scales/**` and the fixture.
- **R1-2 (high): `inline_engine.py` does not pick up a new module on its own.** Evidence: `tools/inline_engine.py:35` has a hard-coded `MODULES` list, and lines 89-96 refuse an unknown region and an out-of-order region. The engine block sits at index.html:1864 onwards, far above the swipe block (14975). Fix: state that P1 appends `"swipe"` to `MODULES` and inserts the region into the engine block. Then the app's `const SWIPE_* ...` line and the five functions become aliases or uses of `HPE.swipe.*`. "No new tool" stays true; "no tool change" does not.
- **R1-3 (high): P1's acceptance contradicts itself on the app tests.** Evidence: tests/app.test.js:4349-4355 evaluates the bare globals `swipeDecision(18,0,0)` and similar through `app.get`. The plan says these tests "move to HPE.swipe" and also says "app tests stay green unchanged". Fix: pick one. Recommended: keep app-side `const swipeDecision = HPE.swipe.decision` (etc.) aliases so app.test.js is byte-unchanged as the no-regression proof, and add `tests/swipe.test.js` as new tests against the module.
- **R1-4 (high): `test_swipe_constants_match_the_app` would go red.** Evidence: tests/test_scale_pages.py:670-681 regexes the literal `const SWIPE_COMMIT_PX = 18, SWIPE_FLING_PX_MS = ...` line in index.html. That line moves into the module or disappears. Fix: P1 rewrites this test to read `src/engine/swipe.js`, or retires it in favour of the new byte-for-byte containment test. List it in ownership.
- **R1-5 (medium): a new engine module needs README edits.** Evidence: tests/test_readme_currency.py:68-93 (`test_every_engine_module_is_mentioned`, `test_the_module_count_word_matches_the_module_list`) fail unless README names `src/engine/swipe.js` and the module-count word goes from twelve to thirteen. Fix: add both to P1.
- **R1-6 (medium): the "about 2KB per page" estimate ignores the comments.** Evidence: the pure core with its comments is about 3.0KB (index.html:14986-15031 is 2962 bytes, not counting the constants or `releaseDecision`), and it is copied byte for byte. Fix: give the new budget as a number (for example 1536 plus the module size plus a driver budget) in `test_swipe_script_fits_its_budget` (tests/test_scale_pages.py:683), and measure the size of the largest page against the 60KB cap before choosing.
- **R1-7 (medium): the arrow-key handling is not specified.** Evidence: today the page's arrows move the flip-B radiogroup natively. The plan wants arrows to step "while the card has focus". With focus on a radio, both behaviours could fire, or neither. Fix: name who owns the arrow keys. When the card has focus the driver steps and keeps the checked radio in sync. When a radio has focus, the browser's native behaviour stands and the driver does nothing. Add an FT test for each case.
- **R1-8 (medium): the JS-off fixture criterion is too loose.** Evidence: P2's acceptance allows `test_js_off_markup_is_unchanged` to pass "or its fixture is regenerated with the reason stated". That lets a JS-off regression pass. D4 says only JS-on markup changes. Fix: require the JS-off fixture to stay byte-unchanged. Any anatomy change for D2 or D6 should be done under JS or in CSS, or should be an owner-gated exception named in D2.
- **R1-9 (medium): the hand-off from radio state to the driver is unspecified.** The plan does not say how the JS driver reads and writes the checked radio and the checkbox flip state, or which one is the source of truth after `land()`. Without that, a fly-out plus a radio change could step twice. Fix: say that the radio is the single source of truth, and that the driver's `land` sets `checked` and dispatches nothing. Add an FT test that a commit advances exactly one step.
- **R1-10 (low): some acceptance timings are not observable as written.** For example, "lands in about 220+180ms". Fix: state a tolerance and the probe, for example `waitElapsed` with each `Animation`'s effect timing read through `getAnimations()`, rather than wall-clock timing (see memory "sleep-to-waitFor loses the timing bound").
- **R1-11 (low): the a11y counter needs a decision.** With JS on, the counter text "n / 3" replaces "Chord i of n". "1 / 3" is a weaker screen-reader string. Fix: keep the visible "n / 3" and add `aria-label` "Chord n of 3", or record it as a D4 sub-decision.
- **R1-12 (low): the P2 verify command needs the browser path.** `CHROME_BIN` is required for e2e (see memory). Fix: write `CHROME_BIN=... node --test ...` and treat CI at the head SHA as the evidence.

Verdict: NOT READY. R1-1 to R1-4 are mechanical plan edits. Once they are fixed and R1-6 to R1-9 are specified, the plan should be READY with no change of design.

### Fixes for Review 1
- R1-1: added "File ownership" for P1/P2, listing the 19 core-anchored mutants by name, with re-anchor, `git apply --check` and `mutation_check.sh` in P1.
- R1-2: P1 appends `"swipe"` to `MODULES` and inserts the engine region; app keeps aliases.
- R1-3: `tests/app.test.js` stays byte-unchanged via global aliases; new `tests/swipe.test.js`.
- R1-4: `test_swipe_constants_match_the_app` rewritten to read `src/engine/swipe.js`, owned by P1.
- R1-5: README names `src/engine/swipe.js` and the count goes twelve to thirteen.
- R1-6: measured (core 4673 B commented / ~2052 B bare; e-amara-20 56845 B vs 61440 cap); budget `SWIPE_JS` <= 5632 B, module comment-light.
- R1-7: D7 arrow-key ownership plus two FT tests.
- R1-8: JS-off fixture must stay byte-identical unless an owner exception is named in D2.
- R1-9: D8 radio as single source of truth, `land` sets `checked` and dispatches nothing; FT one-commit-one-step test.
- R1-10: timing read via `getAnimations()` effect timing, +/-1ms, `waitElapsed`.
- R1-11: D4a keeps `aria-label="Chord n of 3"`.
- R1-12: P2 verify uses `CHROME_BIN`; CI at the head SHA is the evidence.

### Review 2 (independent, 2026-10-29) - NOT READY

Verified at 77540e21: e-amara-20 is 56845 B against the 61440 cap; `MODULES` (tools/inline_engine.py:35) ends at `"sequence"`; README:50 says "twelve modules"; the named mutant patches exist. R1-1 to R1-12 all landed. D4a, D7 and D8 are coherent and testable. D1, D2 and D3 are posed with recommendations and gated in P0.

- **R2-1 (high): P1 and P2 overlap on ownership.** P1's tests-first step adds a py test that the page script contains `src/engine/swipe.js` byte for byte, and it rewrites `test_swipe_script_fits_its_budget`. Both tests live in `tests/test_scale_pages.py`, where P1 owns only `test_swipe_constants_match_the_app`. Making the containment test green also needs `tools/gen_scale_page.py` and a `scales/**` regeneration, which P2 owns. Fix: move the containment test and the budget test into P2, the first phase that can make them green, and keep P1's acceptance to the app and engine.
- **R2-2 (high): the mutant re-anchor mechanism is wrong.** `tests/mutation_check.sh` never runs `inline_engine.py`, and existing engine mutants (for example `eg_lazy_core_eager.patch`) patch `src/engine/*.js` only. A src-only mutant leaves the inlined copy in index.html untouched, so `app.test.js` and e2e cannot kill it. Fix: state that each re-anchored patch targets `src/engine/swipe.js` with a `# suite:` header naming `tests/swipe.test.js`, which must carry a killing case per mutant. Drop "re-synced inside the mutant".
- **R2-3 (low): the margin arithmetic is off by one.** 5632 - 1536 = 4096 bytes of growth, which leaves 499 B of margin on e-amara-20, not ">= 500". Fix: correct the wording or the number.
- **R2-4 (low): no FT test checks the 380px layout or focus visibility on the card host.** Fix: add a 380x780 no-horizontal-scroll test and a check that the card host shows a visible focus ring.

Criteria:
1. FAIL: R2-1 and R2-2 are open.
2. PASS: the byte budget was measured; the other assumptions are gated.
3. PASS: B-lite is justified against A and B.
4. PASS: every phase has prereqs, an owner, a deliverable and acceptance.
5. PASS: the base SHA and MODULES were verified.
6. PARTIAL: the mutant kill path (R2-2) is not covered.
7. PASS: each phase reverts on its own.
8. PASS: the continuation point is P0.
9. PASS once R2-1 is fixed.

### Fixes (round 2)
- R2-1: containment and budget tests moved to P2; P1 owns only the constants test.
- R2-2: the 19 mutants re-anchor to `src/engine/swipe.js` only, `# suite:` naming `tests/swipe.test.js`, one killing case each; the inline-region clause is dropped.
- R2-3: margin stated as 499 bytes.
- R2-4: FT tests added for 380x780 no horizontal scroll and the card host focus ring.

### Review 3 (independent, 2026-10-29) - NOT READY

Round-2 fixes verified: R2-1 (containment and budget tests now sit in P2's tests-first list; P1 owns only the constants test), R2-2 (19 patches re-anchor to `src/engine/swipe.js` with a `# suite:` on `tests/swipe.test.js`), R2-3 (499 B), R2-4 (two FT tests added). Re-checked at 77540e21: MODULES at tools/inline_engine.py:35 ends at `"sequence"`; index.html:14975 (`const SWIPE_COMMIT_PX`), 14986 (`swipeDecision`), 15092 (`releaseDecision`); README:50 "twelve modules"; the named mutants' removed lines (`if (reducedMotion) return ...`, `const eatClick = moved && !cancelled`, the commit expression, the jitter guard) are all in `releaseDecision`/`swipeDecision`.

- **R3-1 (high): the new test file is not registered with the suite-health gate.** Evidence: tests/suite_health.py:36 `FLOORS` has one row per test file and line 514 (`if path not in FLOORS`) fails an unregistered JS file (`tests/test_suite_health.py:866 test_an_unregistered_js_file_fails`). P1 adds `tests/swipe.test.js` but its ownership list omits `tests/suite_health.py`, so CI goes red. Fix: add `tests/suite_health.py` (a `"tests/swipe.test.js": <n>` row only) to P1 ownership and acceptance; P2 raises its own `tests/test_scale_pages.py`/e2e rows if it adds tests there.
- **R3-2 (low): re-anchored mutants no longer exercise the app-side e2e suites** (e.g. `sw_eatclick_armed_on_cancel` was killed by an e2e test). Acceptable because validate check 4 pins the inlined copy to the module; state this in P1 so a reviewer does not flag lost coverage.

Criteria: 1 FAIL (R3-1); 2 PASS; 3 PASS; 4 PASS; 5 FAIL (suite_health dependency unlisted); 6 PASS; 7 PASS; 8 PASS; 9 PASS.


### Regroup (after round 3, 2026-10-29)
Round 3 was the third failed round, so this is a regroup per /reviewed-plan. Lesson: the ownership lists named the files a phase edits but not the registries that gate a new file (suite_health FLOORS). The approach is unchanged; the subplan is the same plan with R3-1 (suite_health row added to P1 ownership and acceptance) and R3-2 (coverage note in P1) fixed. Up to 2 fresh rounds remain; regroup round 1 must also check every new file against every registry that lists test or source files.
### Review (regroup round 1, independent, 2026-10-29) - NOT READY
R3-1 applied correctly (File ownership: `tests/suite_health.py` one FLOORS row, acceptance `python3 -m unittest tests.test_suite_health`). R3-2 applied correctly (coverage note, validate check 4 rationale). Registry sweep at 77540e21: `tools/inline_engine.py` MODULES (covered), `tools/validate.py` check 4 (reads MODULES, covered), README engine list and count word (covered), suite_health FLOORS (covered), `.github/workflows/validate.yml` / `coverage.yml` (glob `tests/*.test.js`, no edit), `tests/mutation_check.sh` (suite headers per patch, covered), `tools/sandbox.js` and `tests/helpers/engine.js` (no module list), `tools/freeze_order_follow_base.js` (frozen to aabcc0c, never run, no edit), `tools/ci_scope.py` (no list). Two gates are missed:

- **RG1-1 (blocker): `tests/app.test.js` pins the exact engine module list and region order, so adding `swipe` reddens it, and the plan requires that file byte-unchanged.** Evidence: tests/app.test.js:636-637 loops over the 12 module names and :646-648 `assert.deepStrictEqual(order, [... "share", "sequence"])` over every `<!-- engine:(\w+) begin` in index.html; plan File ownership line 85 and P1 Accept line 99 ("`tests/app.test.js` is byte-unchanged and green"). Fix: give P1 ownership of that one test ("index.html carries the whole engine inline, with no external script") to append `"swipe"` to both lists, and change the P1 acceptance to "byte-unchanged except that test's two module lists"; the swipe tests at :4349-4355 stay unchanged as the no-regression proof.
- **RG1-2 (high): README's node suite count goes stale.** Evidence: README.md:81 "There are 28 node suites"; tests/test_readme_currency.py:96 `test_the_suite_counts_match_the_files_on_disk` asserts equality with `glob tests/*.test.js`, which becomes 29 with `tests/swipe.test.js`. P1's README edit (line 87) names only the module and the twelve-to-thirteen word, and P1's verify `-k "swipe or module"` does not select this test. Fix: add "28 node suites" -> "29" to P1's README edit and run `tests/test_readme_currency.py` unfiltered in P1's verify.
- **RG1-3 (low): P1 verify does not run the gate it adds.** `python3 -m unittest tests.test_suite_health` is in the acceptance but not the verify command. Fix: append it to the verify line.

Criteria: 1 FAIL (RG1-1); 2 PASS; 3 PASS; 4 FAIL (P1 acceptance unachievable as written); 5 FAIL (app.test.js module-order and README suite-count gates unlisted); 6 PASS with RG1-3; 7 PASS; 8 PASS; 9 PASS.

### Regroup round 2 review (independent, 2026-10-29) - READY
Fixes verified: RG1-1 landed (File ownership P1 bullet names tests/app.test.js:636-637 and :646-648; P1 Accept "byte-unchanged except the two module lists"). RG1-2 landed (README bullet "28 node suites" -> "29", README.md:81; verify runs `pytest tests/test_readme_currency.py` unfiltered). RG1-3 landed (`python3 -m unittest tests.test_suite_health` ends the P1 verify line).

Fresh sweep at 77540e21 for anything pinning the module list, module count, suite count or file inventory:
- tools/inline_engine.py:35 MODULES - covered (P1).
- tools/validate.py:142 check 4 - reads MODULES, covered.
- tests/app.test.js:636-637, :646-648 - covered (RG1-1).
- README.md:50 "twelve modules", :81 "28 node suites" - covered; "1686 mutant patches" unchanged (P1 re-anchors, adds none).
- tests/suite_health.py FLOORS (:56ff), JS_FILES derived at :100 - covered (one row).
- tests/test_font_subset.py:83, tests/test_failure_diagnosability.py:377 - membership/mock only, no edit.
- tools/freeze_order_follow_base.js:16 - frozen historical list, not run by CI, no edit.
- tests/shard_mutants.js:24 E2E_SUITE_MARKERS - re-anchored patches name tests/swipe.test.js (non-e2e), so they move to the non-e2e deck; balance is computed, no edit.
- tests/run.sh:12, .github/workflows/validate.yml:110, coverage.yml:30 - glob tests/*.test.js, no edit.
- tools/coverage_merge.js:88 - derives regions from index.html markers, no edit.
- CLAUDE.md - no module-count or suite-count claim.
No new gate found.

Findings:
- RG2-1 (low): P1 verify runs `pytest` on test_readme_currency.py and test_scale_pages.py; confirm pytest is installed in the lane shell or use `python3 -m unittest` as CI does. Fix: optional; CI is the evidence.

Criteria: 1 PASS; 2 PASS (D1-D3 posed with recommendations, gated at P0); 3 PASS; 4 PASS; 5 PASS; 6 PASS; 7 PASS; 8 PASS; 9 PASS.

Verdict: READY (subject to the owner answering D1-D3 at P0).

## Owner answers (2026-10-29)
- D1: B-lite.
- D2: mode S, the diagram is on the front (not the recommendation). R1-8 applies: any JS-off anatomy change needs this named exception.
- D3: wrap around, as the app does. With scripts off the page still stops at the ends.
- A1: the chord rail sits directly beneath the card (mode S).
- A2: mouse swipe works in desktop Chrome; app mouse momentum stays out of scope.
