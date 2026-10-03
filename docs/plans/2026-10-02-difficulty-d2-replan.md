# D2 re-plan: the Difficulty selector, after five review FAILs

- **Goal:** PR #203 (lane D2 of `docs/plans/2026-10-02-sequence-difficulty.md`) merges with an always-visible Difficulty control that is live in CHORD PROGRESSION and inert elsewhere, and the settings panel is **no worse than main at any viewport, in either font mode, by a definition both the lane and the reviewer run from the repo**. The parent plan's goal is unchanged; this document replaces only *how D2 gets the selector into the panel*.
- **Date:** 2026-10-02 (measurements ran into 2026-10-03 local time).
- **Base:** `main` @ `655a45c`. PR #203 head `0ea790dac32e68756191d6cdc02c12c996c2d170` (`0ea790d`), merge-base `154d516`. Every `index.html:N` below is at `655a45c` unless it says "PR", which means `0ea790d`.
- **Shape:** one serial lane, continuing on PR #203's branch. No parallel split: every step edits `index.html` or `tests/e2e.test.js`.
- **Why a re-plan:** owner, 2026-10-02: "If D2 fails again, take a step back, regroup and design a prompt to draft a plan to address all foreseeable problems and run /plan-eng-review and/or /plan-design-review to retackle D2." D2 failed its fifth review at `0ea790d`.
- **Status:** drafted, NOT yet reviewed. `/plan-eng-review` and `/plan-design-review` have not run; their sections at the end are empty on purpose. Four ledger decisions would be reversed by the recommendation; see "Owner decisions needed" (§6) before spawning the lane past step 3.

## §1 Goal and non-goals

**Non-goals.** N29-N36 of the parent plan carry over unchanged. In addition:

| # | Non-goal |
|---|---|
| RN-1 | No engine change (`src/engine/*`, engine regions), no change to D1's behaviour or API |
| RN-2 | No deck-data, `const DECKS`, diagram-geometry or card-anatomy change |
| RN-3 | Nothing from D3's scope (parent plan §9). D3 still spawns only after D2 merges |
| RN-4 | None of the CLAUDE.md "ideas" (spaced repetition, stats, PWA, audio) |
| RN-5 | No change to the rail (D-12 as amended by the owner: one line, scrolls), the sandbox stub, tier persistence, the `pick` call, or the empty-tier message. They passed review 5 and are kept as they are |
| RN-6 | No new colour, typeface or label style (parent D-10's constraint stands) |
| RN-7 | No fix for viewports where **main** already overflows. The bar is "no worse than main", not "fits everywhere" |
| RN-8 | No change to `tests/mutation_check.sh` |

## §2 Findings

Measured locally with headless Chrome through `tests/helpers/cdp.js`, real fonts via `launch({realFonts:true})` and fallback fonts via `launch()`, each run asserting the font mode it asked for is the one it got. "Fallback" here is macOS's fallback; **CI's Linux fallback metrics are unmeasured**. Probe scripts were session-local; step 1 commits their successor to the repo. "needed" = the height the panel's content requires (bottom of the lowest group + panel bottom padding, measured from the panel's top edge); "avail" = the panel's height (viewport height in the modal, viewport height - 12 in the sidebar at the big ramp).

### F-1 The fifth review, verbatim (at `0ea790d`; CI run 37101445077 green, all 9 jobs)

**Blocker 1: keyboard Tab trap in the modal settings panel, mode S, viewport height <= 356px (regression vs main, both font modes).**
- Cause: PR `index.html:527-529` adds `@media (max-height:356px){ #panel-seq-note{display:none} }`. `panelStops()` (PR `index.html:8816-8829`) still decides whether `#seq-source-link` is a Tab stop from `seqNote.hidden` only, which stays false in mode S. `cycleTabStops` calls `preventDefault()` then `.focus()` on an unrendered link; focus does not move, and every further Tab repeats the no-op.
- Repro A (desktop, non-touch, e.g. a 1366x768 laptop at 200% zoom): viewport 683x330, stored `hpfc` = `{mode:"S"}`, focus `#settings-trigger`, Enter, then Tab repeatedly. PR, both fonts: modeA, modeB, modeS, modeS, modeS, ... Main: modeA, modeB, modeS, seq-source-link, deck-add, ..., wrapping to the trigger. Same on PR at 683x356 and 640x300. At 683x357 the PR cycles correctly; the edge is exactly 356/357.
- Repro B (mobile emulation, real fonts): 844x340 and 667x331, mode S. Forward Tab sticks on modeS. Shift+Tab from the trigger runs res-trainingcards ... deck-add, tier-advanced, tier-intermediate, tier-basic, tier-basic, ... and sticks on tier-basic.
- Not affected: modes A/B, mode S at 844x390 and 380x740, the desktop sidebar.
- Why the harness missed it: the bounce-5 band-edge test filters controls by `offsetParent`, the Tab-cycle test runs at a taller viewport, and `sqe_link_stop_when_hidden` covers only the `hidden` attribute.

**Blocker 2: landscape-grid overflow regression at 601-~660px wide.** The lane's "0 regressions" claim reproduces on its own grid widths but not between them. The trims at PR `index.html:442-484` are scoped `max-width:600px`, while the 2-column grid continues past it.
- Mode S, 601-634 wide, 357-374 tall, both fonts: `#deck-add` below the fold; main fits. 616x364: PR over +11 (real) / +8 (fallback). 601x360: +15 / +12. 634x370: +5 / +2.
- Modes A/B, 601-634 wide, 300-306 tall: `#deck-add` newly offscreen (main overflows there too but keeps it visible).
- Modes A/B, 601-658 wide, 310-314 tall: +2 to +4 where main is 0-1.
- Real fonts only, 640 wide, modes A/B, 362-375 tall: +15 to +2 where main is 0-1.
- 600 wide is clean; 601 breaks.

Reviewer sweep: 10,467 cells per font per root. Real fonts: 27 formal regressions, all at widths 601 and 640. Fallback: 12, all at 601. On the lane's own grid widths (9,234 cells per font): 0. Fine grid 604-720 x 300-400: 72 regressions per font, all 604-658 wide.

**Nits (all eight):**
1. Surviving mutant: no committed test pins the Difficulty/Scales `order` rules.
2. No visible or programmatic label for the group: no heading, no `role="group"`/`aria-label`; the note's "this" has no referent. A CSS comment near PR `index.html:550` lists a "Difficulty" heading that does not exist.
3. Landscape grid visual order (Practice, Print, Resources, Difficulty, Scales) differs from DOM and Tab order; the unlabeled tier buttons sit detached from Practice.
4. At <= 356px tall in mode S the "Watch on YouTube" link is not shown at all (main shows it).
5. D-9: shipped behaviour is a 2+1 wrap at 640-932 landscape and in parts of the sidebar. The test titled "switches from a row to a column layout" asserts `row:false` on a 2+1 wrap. Plan step 2 says "never a 2+1 row" and "single column in the 240px sidebar"; the ledger records the D-8/D-9 deviation but not that those two acceptance lines are unmet. D-10's "heading stays full colour" is moot with no heading.
6. `tier-advanced` is below the fold at 640-658 wide, 300-322 tall, all modes, both fonts (main also overflows there).
7. The committed real-font sidebar test covers modes A/B only.
8. Plan D-12 body still describes wrapping; only an appended owner line records the scroll decision.

Also from that report: two PR-body claims were inaccurate (`#deck-add` "visible everywhere main shows it"; the 356px rules "free of side effects"); files outside D2's written Owns list were touched (`tools/sandbox.js`, `tests/helpers/cdp.js`, the plan doc); new mutant prefixes `d12_*`/`d2_*` are not `uid_*`. Passed at that SHA and kept (RN-5): the rail, the sandbox stub, aria state, tier behaviour, mutant hygiene (553 patches apply, refresh clean).

### F-2 Main has almost no slack, and its needed height does not depend on viewport height

On main the panel is governed by three media conditions: `(min-width:640px) and (min-height:700px)` (spacing ramp, `index.html:49`), `(max-height:520px)` (ramp `:58`, auto-fit grid `:256-260`) and `(min-width:1024px) and (min-height:700px)` (sidebar, `:283`). Inside each class the needed height is a function of width only.

| Class | Where | needed A/B, real (fallback) | needed S, real (fallback) | Tightest slack |
|---|---|---|---|---|
| P1 portrait modal, base ramp | h 521-699 (and h >= 700 below 640 wide) | w >= 360: 442 (438); w 320-359: 494 (490) | 490 (486); 542 (538) | S at 320 wide overflows below h 542; **320x568 S has 26px** |
| P2 portrait modal, big ramp | w 640-1023, h >= 700 | 484 (480) | 534 (530) | 166px |
| L landscape modal grid | h <= 520 | 568-634 wide: 313; 667: 313; 700-740: 265.5; 812-844: 263; 860-1000: 189 | 568-634: 360; 667: 375.8; 812-844: 310; 860-1000: 251.8 | **568x320 A/B has 7px**; 568x320 S already overflows by 40 |
| SB desktop sidebar | w >= 1024, h >= 700; avail = h - 12 | 612 (608) | 677.8 (673.8) | **1024x700 S has 10.2px** (14.2 fallback) |

One more 44px control costs a whole row wherever it cannot share one: +50 on the landscape ramp, +52 on the base ramp, +56 in the sidebar. There are three places on main with less than 30px to give.

### F-3 The lane paid for the selector with trims that make needed height depend on viewport height

The PR adds nine at-rules under five new conditions that touch the panel: `(min-height:521px) and (max-height:575px)` (PR `:343`), a second `(max-height:520px)` block with `order` rules (`:347-435`), `(max-height:520px) and (max-width:600px)` (`:442-484`), four `(max-height:356px)` blocks (`:527`, `:537`, `:553`, `:567`), and two sidebar bands `max-height:765px` (`:685`) and `max-height:761px` (`:698`). Main has three panel conditions; the PR has eight.

Measured on the PR: P1 A/B is +64 over main (505.8 at >= 360 wide, 557.8 at 320-359); S is 502 or 520 at >= 360 wide depending on which side of h 575 the viewport is, 554 or 572 at 320-359. The sidebar is 679.5 / 687.8 at h <= 765 and 749.5 / 749.8 above. **Sidebar S lands at 687.8 of 688 available at 1024x700 under real fonts** - 0.2px of slack, font-tuned. Untrimmed, the same structure costs +58 to +158 (F-5).

So "no regression" became a property of ~10 pixel-tuned constants, each with its own edge, and was verified by sampling. Every edge is a place a sample grid can straddle.

### F-4 A third regression band that no sweep sampled

The 1-D method in §4.3 predicted it and a direct probe confirmed it, both fonts, main = 0 overflow in every one of these cells:

| Viewport, mode | PR overflow real / fallback | Offscreen on PR |
|---|---|---|
| 340x530 A | +28 / +24 | all three Resources links |
| 340x546 S | +8 / +4 | all three Resources links |
| 320x545 S | +9 / +5 | all three Resources links |
| 340x556 B | +2 / 0 | - |
| 380x530 S | 0 / 0 | - |

The lane's grid and the reviewer's grid both skipped it. The 1px-width sweep (7,062 cells per font per root; rows at h 320, 521, 700, 800) bounds it and finds more:

| Row on `0ea790d` | Widths regressing, real (fallback) | Max excess over max(main, viewport) | Controls pushed offscreen |
|---|---|---|---|
| Portrait h 521, A/B | 320-354 (320-364) | 36.8 (32.8) | three Resources links |
| Portrait h 521, S | 320-354 (320-364) | 12.0 (12.0) | three Resources links |
| Landscape h 320, A/B | 320-464 and 636-643 (320-479) | 37.5 (28.8) | `#deck-add` (plus `#res-trainingcards` under fallback) |
| Landscape h 320, S | every width 320-1300 | 0 | `#seq-source-link` unrendered (Blocker 1's rule), `#deck-add` |
| Portrait big ramp h 700; sidebar h 700 and 800 | none | - | - |

The PR's layout is height-dependent inside these classes, so those rows say nothing about the heights between them; that is the point of F-3.

### F-5 What an always-visible selector costs with no trims at all (real fonts, prototypes injected into main at runtime)

| Candidate | P1 380 wide | P1 320 wide | L 568 wide | L 860 wide | SB |
|---|---|---|---|---|---|
| D-8/D-9 as written (own group, heading, container-query row/column, note) | +100 / +80 | +204 / +184 | +143 / +77 | +209 / +124 | +238 / +200 |
| PR structure with every trim removed | +78 / +58 | +78 / +58 | +74 | +138 / +124 | +158 / +120 |
| Three buttons as a third row inside Practice, no heading, no note | +52 | +52 | +100 | +100 | +112 |
| Native `<select>` sharing the CHORD PROGRESSION row, existing grid | 0 | 0 | +50 where it wraps and Practice is the tallest cell | +50 | +56 |
| **Recommended (§3): select in a `.tier-row`, landscape multicol, one sidebar rule** | **0** | **0** | **0 or lower than main** | +50 (see F-6) | **0 at h <= 759, +56 above** |

(Format A/B then S where they differ.) Three 110px buttons cannot share a 292px row; nothing with three always-visible 44px targets fits main's slack without trims. **D-8/D-9 as written and "fits wherever main fits" are jointly unsatisfiable without viewport-conditional trimming.** That, not scope mismatch, is why five rounds of trimming did not converge.

### F-6 The recommended prototype, measured (real / fallback where they differ)

- **Portrait (P1, P2):** needed is byte-for-byte main's at every probed width (320, 330, 360, 380, 430, 768): the select sits beside CHORD PROGRESSION and adds no row. At 320 wide: `#modeS` 155px, select 129px; select label "INTERMEDIATE" measures 85.8px real / 92.7px fallback against a 92px inner box with the prototype's 24px right padding - **0.7px short under fallback**; step 5 fixes the padding and pins it.
- **Landscape (L), total height:** over every width 320-1300 and every height 320-520 (the layout is height-independent, so one measured row extends to the band; 197,181 width x height cells per mode) there is **no cell where needed exceeds max(main, viewport)**, in either font. A/B: equal to main up to 586 wide, 50 lower at 587-696 (263 vs 313; 313 vs 363 at 636-643), equal at 758-844. S: equal or lower at every width up to 844 (568: 337 vs 360; 667: 301.8 vs 375.8; 844: 286 vs 310). At 845-1164 wide, where main packs four columns, needed is 239 in A/B (main 189 from 856) and 301.8 or 286 in S (main 251.8 / 236): +50, under every viewport height >= 302. From 1165 the select shares the row again and needed equals main (189 / 236).
- **Landscape (L), individual controls - the prototype is NOT clean here.** Column-major packing moves some controls lower than main's row-major grid had them, in cells where **main itself already overflows**:

  | Mode | Widths, real (fallback) | Heights, real (fallback) | What moves | Main in the same cells |
  |---|---|---|---|---|
  | A/B | 427-432 (427-443) | 320-353 (320-351) | `#res-trainingcards` bottom 304 -> 354 | needs 363, also scrolls; total equal |
  | S | 427-467 | 320-366 (320-364) | `#deck-add` bottom 130 -> 366.8 | needs 425.8 / 375.8; candidate 375.8 |
  | S | 468-586 | 320-330 | three Resources links, bottom 301-319 -> 328-330.5 | needs 360-375.8; candidate 337-339.5 |

  The last row contains **568x320 in mode S** (a 320x568 phone turned sideways): main scrolls 40px and cuts the paper-size select; the prototype scrolls 17px, shows the paper-size select and cuts the Resources row by 8px. Total scroll is never worse, but by the owner's ruling as worded (a control offscreen where main shows it is a regression) these 204 + 2,961 cells per font (544 + 2,508 fallback) are regressions. No cell where main fits is affected. This is OD-8.
- **Sidebar (SB):** with one compaction rule at h <= 759 (gap 20 -> 12, block padding 28 -> 12 = -56), needed is exactly main's: 612 / 677.8 (608 / 673.8). At h >= 760 it is 668 / 733.8 against >= 748 available.

### F-7 Reachability has two sources of truth

`panelStops()` (PR `:8816`) is an id list filtered by `el && !el.disabled`, with the link keyed on the `hidden` attribute. The stylesheet can unrender any of those ids and the list will not know. Enumerated by reading the PR file end to end, cross-checked by searching for the bare identifiers:

- `cycleTabStops` is defined at PR `:8732` and called from exactly two places: the scale sheet's `keydown` listener (`:8752`, its own inline list, same `el && !el.disabled` filter) and the document `keydown` handler's `panelOpen` branch (`:8971`).
- `panelStops` is defined at PR `:8816` and called from exactly one place in the app (`:8971`). Tests reach it as `window.panelStops()` at `tests/e2e.test.js` PR `:1273`, `:1293`, `:7287`, `:8043`, `:8070`.
- Nine mutants are anchored on these two functions: `e_edit_tab_skips_delete`, `e_menu_keys_leak_to_card`, `e_panel_moved_into_header`, `m2_panel_tab_no_backward_wrap`, `ms_js_breakpoint_drift`, `qa_cycle_tab_stops_no_wrap`, `qr_res_link_not_a_stop`, `sqe_link_stop_when_hidden`, `sqe_panelstops_misses_modeS`.
- The desktop sidebar never traps (`panelOpen` is never true there); it uses the browser's own Tab order, which already skips unrendered and disabled controls.

### F-8 Diagnosis

The caller's two causes are both real: (i) trims with mismatched scopes, (ii) CSS and JS disagreeing about what exists. The code shows a cause underneath (i):

> **Main's panel has near-zero slack in three places, the as-written selector costs 80-240px, and acceptance was "no regression at any viewport" verified by sampling.** Each trim added an edge; each edge added an unsampled band; each review found the next band. Unifying the scopes would not have converged either: F-4 is a regression inside a single, correctly-scoped portrait rule, and the real column-count edge is at 635/636 wide (where `auto-fit` goes from two columns to three), not at the 639/640 the scopes were being aligned to.

So this plan (a) removes the cost instead of trimming to pay for it, and (b) replaces sampling with a sweep that is exhaustive in width and exhaustive in height by construction (§4.3).

### F-9 Oracle cost

7,062 cells (981 widths x 2 modal classes + 384 P2 widths + 8 sidebar cells, x 3 modes) took 242 s and 243 s in two runs, one font, one root, with a second sweep competing for the machine: ~29 cells/s. A 26,000-cell grid (four heights per class) did not finish in 10 minutes and is rejected as the oracle's shape. CI timing is unmeasured; D1 saw ~2.5x local.

## §3 Decisions

New ids only (`RP-n`); none reuses a parent id.

- **RP-1 Layout: restructure so the selector costs no height where height is scarce, and delete every lane-added trim.** Options weighed:

  | Option | Panel media conditions (main has 3) | Evidence | Verdict |
  |---|---|---|---|
  | (a) Keep three buttons, unify trim scopes | >= 8 | F-4, F-5: no construction argument; the lane already reverted a class-wide trim once because it regressed three-column widths | Rejected as the primary path; kept as §6's fallback only |
  | (b1) Three buttons inside Practice | needs trims | +52 / +100 / +112 (F-5) | Rejected |
  | (b2) One cycling button ("tap to advance the tier") | 4 | Same footprint as a select, but hides the options and their order, and cycling fights D-11's close-on-activate | Rejected |
  | (b3) Native `<select>` beside CHORD PROGRESSION, existing landscape grid | 4 + landscape trims | +50 in landscape wherever Practice is the tallest grid cell | Rejected alone |
  | **(b3)+(c) Select in a `.tier-row`, landscape CSS multicol, one sidebar rule** | **4** | F-6 | **Recommended** |
  | (c') Fluid `clamp()` spacing instead of the one sidebar rule | 3 | Unmeasured; a continuous function of `vh` has no edge to test at and no mutant that cleanly flips it | Rejected |

  **Structure.** Inside the Practice group, `.modebar` keeps NAME -> NOTES and NOTES -> NAME on its first row; its second row becomes `<div class="tier-row">` holding `#modeS` and `<select id="tier-select">` (BASIC / INTERMEDIATE / ADVANCED, easiest first). `.tier-row{display:flex; flex-wrap:wrap; gap:var(--sp-2); flex:1 0 100%}`; `#modeS{flex:1 1 150px; min-width:0}`; `#tier-select{flex:1 1 124px; min-width:0}`. **Whether the select shares the row is decided by two CSS constants (150 + 8 + 124 = 282px), not by font metrics**: it shares at every content width >= 282px (every portrait viewport >= 320) and takes its own full-width row below that (landscape columns, sidebar). A wider fallback font can make a label tight; it cannot move the wrap point. The select is styled as a `.mode` (same border, radius, background, font, 44px), `appearance:none` with an inline-SVG chevron in the existing `#c4bcab`; no new colour or face (RN-6).

  **Landscape.** The four groups are wrapped in `<div id="panel-cols">`, `display:contents` everywhere except under the existing `(max-height:520px)` condition, where `#settings-panel{display:block}` and `#panel-cols{display:block; columns:200px 4; column-gap:var(--sp-3)}`, groups `break-inside:avoid`, `.panel-group + .panel-group{margin-top:var(--sp-3)}`. The wrapper is required: `#settings-panel` has a definite height (`inset:0`), and a multicol box with a definite height overflows sideways into extra columns instead of scrolling down. Multicol replaces the `auto-fit` grid; it adds no media condition. Why it absorbs the select's row by construction: Practice is now three rows + Scales one row = Print two rows + Resources two rows, so column-major packing puts the wrapped select into what was dead space under Scales. Column order is DOM order, which removes nit 3.

  **Sidebar.** One rule, the only new media condition in the plan: `@media (min-width:1024px) and (min-height:700px) and (max-height:759px){ #settings-panel{gap:var(--sp-2); padding-block:var(--sp-2)} }`. It applies in every mode (no `:has()`), so the sidebar looks the same in A, B and S at a given height. 759 is chosen so that the first uncompacted height, 760, has 14.2px of slack under real fonts; the tight edge would be 745, which leaves 0.2px.

  **Cost, stated plainly.** (1) Two of three tiers are hidden behind a tap; the selected one is always visible. (2) A native select is the platform's control: its open list is styled by the OS and is not testable here. (3) The landscape arrangement of the pre-existing groups changes (row-major grid -> column-major columns; Scales moves under Practice). (4) The sidebar is tighter at 700-759 tall. (5) At 845-1164 wide landscape the panel is 50px taller than main; it still fits at every height >= 302. (6) In landscape cells where main already scrolls (427-586 wide, up to 366 tall), a different control ends up below the fold than on main (F-6, OD-8). (7) `columns` and `break-inside` on WebKit/iOS Safari are **unverified**; CI is Chrome-only.

- **RP-2 Reachability: rendered state is the only truth, enforced from both sides.**
  - *Rule R-1 (CSS side):* no stylesheet rule may unrender a panel control. The only things that take a control out of the panel are the `hidden` attribute written by `setMode()` and the panel being closed. Consequence: **the set of rendered controls is a function of mode alone, identical at every viewport.**
  - *Rule R-2 (JS side):* one helper, `isStop(el)` = `el && !el.disabled && el.getClientRects().length > 0`. (`getClientRects`, not `offsetParent`: the panel is `position:fixed`, and an element with `visibility:hidden` or zero size is a separate matter R-1 covers.) `panelStops()` becomes its fixed id-order list filtered by `isStop`, and the `seqNote.hidden` special case is **deleted** - a link inside a `hidden` paragraph has no client rects, so the general rule already covers it. The sheet listener at PR `:8752` replaces its inline `el && !el.disabled` with `isStop`. `cycleTabStops` gains only an empty-list guard before `preventDefault()`. The filter lives in the two list builders, not also inside `cycleTabStops`, so each can be mutated and killed separately.
  - *The test that fails when a control is unrendered but still a stop:* `a panel control unrendered by CSS is never a Tab stop, and Tab still cycles` - it injects `#seq-source-link{display:none}` (then, separately, `#deck-add{display:none}`) at runtime in mode S, asserts `panelStops()` omits it, and drives real Tab key events round the full cycle both ways. Its sheet twin does the same to one sheet control. R-1 has its own test (§4.4, T-R1) and is also checked at every cell of the oracle.
  - `tools/sandbox.js` needs a `getClientRects` stub that honours `hidden` on the element and its ancestors; test first in `tests/app.test.js`.

- **RP-3 Acceptance oracle: `tools/probe/panel_fit.js`, committed, run by lane and reviewer alike.** Spec in §4.3. The regression definition lives in that script and nowhere else.
- **RP-4 Keep and continue on PR #203.** The rail (D-12), sandbox stub, `store.tier`, `setTier`'s persistence / re-deal / `prev` clearing, the `pick(…, tier)` call, the empty-tier message and their tests and mutants have survived five reviews; restarting from main would put all of that back in front of a reviewer as new surface, and the lane's commits are too interleaved with bounce fixes to cherry-pick cleanly. The lane merges main in, then its first layout commit **deletes** every lane-added viewport-conditional rule (F-3's list), `#panel-tier-group`, `.tierbar` and the three tier buttons. Net effect on the reviewed diff: panel media conditions 8 -> 4, and the CSS a reviewer must reason about shrinks.
- **RP-5 Review cap resets to two attempts.** A FAIL on the second attempt stops the lane and goes to the owner; it does not bounce again.
- **RP-6 Oracle domain: widths 320-1300 at 1px (plus 1440 and 1920 in the sidebar class), heights 320-1100.** 320 is the smallest supported device dimension (320x568 portrait is 568x320 landscape) and already the floor of main's own fit test (`tests/e2e.test.js:1429`). Below 320 tall the oracle still checks R-1 and the stop list (Blocker 1 was at 330 and at 300) but does not judge fit. This is narrower than reviewer 5's 300 floor; see OD-7.
- **RP-7 Mutant prefix stays `uid_*`** for everything this lane adds (review 5 flagged `d12_*`/`d2_*`). Existing `d12_*` names are kept; `d2_tier_group_margin_overlap` is deleted with the rule it mutates.

## §4 Design detail

### §4.1 Budget the lane must hit (needed height, px)

"=" means equal to main within 0.5px. Derived from F-2 and F-6; step 5's tests assert these as absolute numbers at real fonts and as "<= avail" at fallback.

| Class | Band edges (derived by the oracle, §4.3) | A/B | S |
|---|---|---|---|
| P1 | h 521-699, all widths; h >= 700 below 640 wide | = main | = main |
| P2 | w 640-1023, h >= 700 | = main | = main |
| L | h 320-520 | <= max(main, 320) | <= max(main, 320) |
| SB compact | w >= 1024, h 700-759 | = main (612) | = main (677.8) |
| SB default | w >= 1024, h >= 760 | 668 <= 748 | 733.8 <= 748 |

Worst-case content: mode S (note and link visible) with the longest option, INTERMEDIATE, selected. The select's width never depends on the selected option (it is a flex item sized by constants), which step 5 asserts.

### §4.2 Keyboard and accessibility state table

Controls in DOM order: `#settings-trigger` (modal only), `#modeA`, `#modeB`, `#modeS`, `#tier-select`, `#seq-source-link`, `#deck-add`, FULL DECK PDF, CHORD-ONLY PDF, `#print-paper-select`, `#res-handpaner`, `#res-dingandtones`, `#res-trainingcards`. Viewport classes share one row when their behaviour is identical by R-1; each test still runs at one viewport from **every** class it names (320x568, 768x1024, 568x320, 683x330, 844x390 for the modal; 1024x700 and 1280x800 for the sidebar).

| Row | Class | Mode | Tab order (Shift+Tab is the exact reverse) | `#tier-select` state | Link | Test |
|---|---|---|---|---|---|---|
| K-1 | modal, portrait + landscape | A, B | trigger, modeA, modeB, modeS, deck-add, 2 print buttons, paper select, 3 Resources links, wraps to trigger (11 stops) | `disabled`; value = stored tier; `aria-label="Difficulty"`; `aria-describedby="panel-tier-note"`; opacity .5; not a stop | paragraph `hidden`; not a stop | `Tab cycles exactly the eleven A/B stops in the modal at every viewport class` |
| K-2 | modal, portrait + landscape | S | trigger, modeA, modeB, modeS, **tier-select, seq-source-link**, deck-add, ... (13 stops) | enabled; no `aria-describedby`; opacity 1; a stop | rendered; a stop | `Tab cycles exactly the thirteen mode-S stops in the modal at every viewport class` (includes 683x330 and 844x340, Blocker 1's repros) |
| K-3 | sidebar | A, B | native order: the 10 panel stops of K-1 without the trigger | as K-1 | as K-1 | `the sidebar's native Tab order is the panel's DOM order and skips the disabled select` |
| K-4 | sidebar | S | native order: the 12 panel stops of K-2 without the trigger | as K-2 | as K-2 | same test, mode S |

| Row | Input | Where | Expected | Test |
|---|---|---|---|---|
| K-5 | Enter or Space on `#modeA/B/S` | modal | mode set, `aria-pressed` exclusive, select's `disabled` and `aria-describedby` flip with the mode, panel closes, focus on `#settings-trigger` | existing mode tests, extended to assert the select's state after each |
| K-6 | same | sidebar | as K-5 but the panel stays and focus stays on the pressed button | `in the sidebar a mode change re-states the select and keeps focus` |
| K-7 | `change` on `#tier-select` | modal, S | tier saved to `hpfc.tier`, `prev` cleared, re-dealt at that tier; panel closes and focus returns to the trigger (D-11 as written; OD-4 may flip the last clause) | `choosing a tier persists it, re-deals at that tier, and closes the panel` |
| K-8 | `change` on `#tier-select` | sidebar, S | as K-7, panel stays, focus stays on the select | `in the sidebar a tier change keeps focus on the select` |
| K-9 | Enter, Space, ArrowUp/Down on `#tier-select` | modal and sidebar | the app does not `preventDefault` them and the card does not step or flip; the browser owns the popup | `keys on the tier select are left to the browser and never reach the card` |
| K-10 | Escape | modal, any mode, focus on any stop | panel closes, focus on the trigger | existing Escape test, extended to start from `#tier-select` |
| K-11 | Escape | sidebar | no-op | existing |
| K-12 | Tab or Shift+Tab with focus outside the stop list | modal | lands on the first / last stop; never a no-op | `Tab from outside the stop list enters the panel cycle` |
| K-13 | any | all | accessible name of the select is "Difficulty"; in A/B its accessible description is "Pick CHORD PROGRESSION to change this." (read from the AX tree, not from attributes) | `the tier select is named Difficulty and described only while disabled` |
| K-14 | - | modal landscape, all modes | reading order equals DOM order: over consecutive rendered controls, (column left edge, top) never decreases | `the landscape panel reads in DOM order` (nit 3) |

Not testable here and marked unmeasured: the open native list (Escape closing the list before the panel; arrow keys committing a value per keypress on Windows/Linux Chrome but not on macOS), iOS's picker wheel, real screen readers. OD-4 exists because of the second of those.

### §4.3 The acceptance oracle

- **Where:** `tools/probe/panel_fit.js` (CLI and library). Session probe scripts live nowhere else from now on. `tests/e2e.test.js` requires the library for the edge-cell tests in §4.4, so the mutation gate and the oracle share one measuring function.
- **Run:** `node tools/probe/panel_fit.js --base origin/main` at the PR head. It extracts the base's `index.html` with `git show <base>:index.html`, serves both, and runs every cell on both roots in both font modes. **If the base cannot be read, or a font mode is not the one requested, it exits non-zero. It never skips silently.**
- **Edges, derived mechanically:** in the browser, walk the CSSOM of **both** roots; keep each `CSSMediaRule` that contains a rule whose selector matches `#settings-panel`, any element inside it, or `:root`; parse every `min-/max-width|height` length out of `conditionText`. The union is the edge list. Nothing in the script names a breakpoint. On the recommended design the list is widths {640, 1024} and heights {520, 700, 759}; on `0ea790d` it also contains 356, 521, 575, 600, 761, 765.
- **Cells:** the height edges cut 320-1100 into bands; inside one band, at one width, the same rules apply.
  - *Width:* every integer 320-1300, in every band. Step 1px is the finest a CSS-pixel viewport can take, so **no width is unmeasured**. (The sidebar is width-independent - a fixed 240px - so that class takes 1024, 1025, 1100, 1280, 1300, 1440, 1920.)
  - *Height:* measured at each band's **lowest** height, where avail is smallest. Justification: within a band needed does not depend on height, and avail only grows with it, so the lowest height is the worst case. The script does not assume that - it **asserts** it: at every 16th width and every width edge +-1 it re-measures at the band's top and middle height and fails with "height-dependent layout inside a band" if needed moves by more than 0.5px. That is the only step wider than 1px in the sweep, and it is a check on an invariant, not a sampled band.
  - *Edges:* every derived edge at edge-1, edge, edge+1 in both dimensions falls out of the above (each band's lowest and highest row, each width +-1).
  - *Modes:* A, B, S. *Fonts:* real, fallback. *Content:* INTERMEDIATE selected.
- **"Regression", defined once, in the script** (base = b, candidate = c, same cell):
  1. *Fit:* `needed_c > max(needed_b, avail) + 1`.
  2. *Control:* a control rendered on b is unrendered on c, or its bottom edge `> max(bottom_b, avail) + 0.5` (owner, 2026-10-02: a control offscreen on the PR where main shows it is a regression). The script computes this in every cell and reports two counts: cells where b fits, and cells where b itself overflows. **Both fail the run as written.** OD-8 asks whether the second count should be reported instead of failed; the switch is one constant in the script, changed only with the owner's answer recorded in §8.
  3. *New control:* a control that exists only on c is below `avail + 0.5` in a cell where b fits. Where b itself overflows it is counted and reported, not failed (nit 6).
  4. *Horizontal:* `scrollWidth - clientWidth` greater on c than on b.
  5. *R-1:* c's rendered-control set differs from c's set for that mode at the reference cell (380x740).
  6. *R-2:* c's `panelStops()` contains an element that is disabled or has no client rects, or omits a rendered enabled control.
- **Report:** per font: cells measured, cells skipped (must be 0, with the reason for any that is not), counts per rule, the first ten offenders per rule as `w x h mode: needed_c / needed_b / avail`, and the derived edge list. The PR body's layout claims are pasted from this output, not written by hand.
- **Size and time:** ~3,200 width-rows x 3 modes ~= 9,700 cells plus ~1,200 invariance cells per font per root. At the measured 29 cells/s (F-9) that is ~6 minutes per font per root locally, ~25 minutes serial for all four, ~7 with the four run in parallel. **CI time is unmeasured**; expect ~15 minutes per font with base and candidate in parallel.
- **CI:** yes. A new `panel fit` job in `.github/workflows/validate.yml`, matrix `font: [real, fallback]`, `fetch-depth: 0`, base = `origin/main` on pull requests and `HEAD^1` on main. Real fonts need no network: `launch({realFonts:true})` serves the TTFs in `tools/fonts/`. If a job exceeds 20 minutes on CI the lane splits it by class, never by thinning widths.
- **Validation of the oracle itself (step 1's acceptance):** run against `0ea790d` it must be red on rule 1 or 2 in all three known bands (F-1 Blocker 2 at 601-634 wide; real-font 640; F-4's portrait band) and red on rule 5 and rule 6 at h <= 356 in mode S. An oracle that passes the known-bad head is not accepted.

### §4.4 Tests that pin the stylesheet

- **T-R1** `no stylesheet rule unrenders a panel control`: CSSOM walk; fails on any rule, inside or outside `@media`, that sets `display:none`, `visibility:hidden` or `content-visibility:hidden` on a selector matching a panel control or one of its ancestors inside the panel, other than the global `[hidden]` rule.
- **T-MQ** `the panel is governed by exactly four media conditions`: the derived condition list equals main's three plus the sidebar compaction rule. A fifth condition fails the test; adding one means editing this test in the same PR, in view of the reviewer.
- **T-EDGE** `the panel meets its budget at every derived edge, in both font modes`: §4.1's numbers at edge-1 / edge / edge+1 in both dimensions, modes A, B, S, using the oracle's measuring function. This is the committed, mutation-gated slice of the sweep.

## §5 Plan versus shipped: every D-decision and D2 acceptance line

Provenance matters here: of the decisions below only **D-0** and the four dated 2026-10-02 owner rulings were made by the owner. D-7 to D-12 were AFK auto-picks (parent §7). They are still ledger decisions, so a reversal is listed in §6 rather than taken.

| Item | As written | This re-plan | Status |
|---|---|---|---|
| D-0 (owner) | Selector always visible, greyed out outside CHORD PROGRESSION | Select always rendered (R-1 makes that testable at every viewport), `disabled` outside S | **Met as written** |
| Owner: "fix layout before merge" | - | §4.3 gates the merge | Met |
| Owner: a control offscreen where main shows it is a regression | - | Oracle rule 2. Met wherever main fits. **Not met by the recommended layout** in the landscape cells of F-6 where main already overflows | **Change proposed: OD-8** |
| Owner: "320x568 -> tighten spacing harder" | Tighten to fit | Nothing to tighten: zero added height at 320 wide. The trims that instruction produced are deleted | Intent met; instruction no longer needed - noted for the owner, no decision required |
| Owner: D-12 rail scrolls on one line | - | Kept (RN-5) | Met |
| D-7 persistence | `hpfc.tier`, guarded read | Unchanged | Met |
| D-8 placement | Own `.panel-group`, heading "Difficulty" | Inside Practice, no heading; named by `aria-label` | **Change proposed: OD-2** |
| D-9 layout | Three `.mode` buttons; row >= 348px else column; container query | One native select | **Change proposed: OD-1** |
| D-10 greyed state | `disabled`, opacity .5, remembered tier visible, visible `.panel-note`, `aria-describedby` on each control, heading full colour | `disabled`, opacity .5, selected option shows the remembered tier, `aria-describedby` kept; note is `sr-only`; "heading full colour" is moot | **Change proposed: OD-3** (visible note only) |
| D-11 interaction | Press = save, re-deal, close panel; pressing the current tier re-deals | `change` = save, re-deal, close panel. Re-selecting the current value fires no `change`, so there is no re-deal on re-pick | **Change proposed: OD-4** |
| D-12 | Body text still says "wrap to two lines" | Step 11 rewrites the body to the owner's scroll decision (nit 8) | Doc fix |
| Step 2 "three-across at 380 portrait, single column in the 240px sidebar; never a 2+1 row" | - | Not applicable to a select. Unmet on `0ea790d` (nit 5) | Superseded if OD-1 is accepted; stays unmet otherwise |
| Step 2 "every button >= 44px tall" | - | Select is 44px in every class | Met |
| Step 2 "no new colour, no new font family" | - | Chevron uses `#c4bcab` | Met |
| Step 2 "Difficulty group's rendered width equals Practice's" | Guards the containment collapse | No container query, no separate group | Superseded if OD-2 is accepted |
| Step 2 "visible at 380x740, 320x640, 812x375, 1280x800" | - | Visible at every cell of the sweep | Met, strengthened |
| Step 3 `panelStops()` lists the three tier buttons; `driveTabCycle` max 14 -> 15 | - | One select: the mode-S cycle is 13 stops; the bound is still derived from `panelStops().length` | Changed with OD-1 |
| Step 3 A/B: disabled, out of Tab order, opacity .5, tier still shown, note visible and referenced | - | As D-10 above | Met except "note visible" (OD-3) |
| Step 4 behaviour | - | Unchanged, driven by `change` | Met; re-click line per OD-4 |
| Step 5 empty tier, step 6 rail, step 7 existing contracts | - | Unchanged | Met |
| Step 8 >= 4 `uid_*` mutants | - | §7 lists 17 | Met |

## §6 Owner decisions needed

None of these is taken by this plan. Steps 1-3 of the lane need none of them and can start now. Steps 4 onward need OD-1 to OD-3, OD-5 and OD-8.

| # | Decision | Recommendation | If declined |
|---|---|---|---|
| OD-1 | Reverse **D-9**: one native `<select>` instead of three buttons | **Accept.** It is the only measured form with zero cost in portrait (F-5) | See "If OD-1 is declined" below |
| OD-2 | Reverse **D-8**: the control lives in the Practice row beside CHORD PROGRESSION, with no "Difficulty" heading; its name is programmatic (`aria-label`), like `#print-paper-select` | **Accept.** A visible label would need its own line (+19px or more), which 568x320 does not have. `/plan-design-review` should weigh the missing visible label | A heading costs a row; falls back with OD-1 |
| OD-3 | Amend **D-10**: the "Pick CHORD PROGRESSION to change this." note becomes screen-reader-only | **Accept.** Visible, it adds ~17-19px in A/B and overflows 568x320 (313 + 17 > 320; main fits with 7px) | Keep it visible in portrait and sidebar only - which is a viewport-conditional rule on rendered content and brings R-1's problem back; not recommended |
| OD-4 | Amend **D-11**: (a) no re-deal when the current tier is picked again - a select cannot signal it; (b) a tier change does **not** close the modal, matching `#print-paper-select` | (a) **Accept**, unavoidable with OD-1; NEXT already re-deals. (b) **Accept**: on Windows/Linux Chrome each arrow key on a focused select commits a value, so close-on-change would shut the panel on the first keypress | (b) declined: the lane ships D-11 as written (close on change); K-7 already says so and the difference is one line, one assertion, one mutant |
| OD-5 | The landscape modal rearranges groups that exist on main (row-major grid -> column-major columns; Scales under Practice) | **Accept.** Needed is lower than or equal to main up to 844 wide (F-6) and reading order becomes DOM order | Keep the grid: the select then costs +50 in landscape and needs trims |
| OD-6 | The sidebar is compacted at 700-759 tall, all modes (gap 20 -> 12, block padding 28 -> 12) | **Accept.** It is what "no worse than main" requires at 1024x700 | Accept up to 46px of scroll in mode S at 700-745 tall instead; then the plan adds no media condition at all |
| OD-7 | Oracle fit floor at 320 tall, not reviewer 5's 300 | **Accept.** At 300-301 tall and 845-1164 wide the recommended design is 1.8px over in mode S where main fits; no device in that band exists | Floor at 300: the lane must find 2px in the four-column landscape band, most cheaply by letting `columns` reach 5 |

| OD-8 | Refine the owner's 2026-10-02 ruling for cells where **main already overflows**: there, judge by total scroll (candidate needs no more height than main) and report, not fail, a control that trades places below the fold. Where main fits, the ruling stays exactly as worded | **Accept.** Measured (F-6): zero affected cells where main fits; in the affected cells the candidate scrolls the same or less (568x320 S: 17px against 40px) and a different control is cut. This is the owner's own ruling, so it is the owner's to refine | No measured layout passes: keeping main's grid at 427-586 wide costs +50 at 568x320 A/B, where main has 7px. The lane stops after step 5 and returns to the owner |

**If OD-1 is declined.** The three-button structure stays, and the owner is choosing between two things the measurements say cannot both hold (F-5): either named bands where the panel scrolls although main does not, or viewport-conditional trims. The lane then keeps steps 1-3 and 7-12, replaces steps 4-6 with "class-wide trims, judged only by the oracle", and this plan makes **no convergence promise** for that path.

## §7 Lane D2 (continued): step table

- **Branch / PR:** `claude/difficulty-d2-app`, PR #203. Work in the lane's own worktree. Merge `main` in first; never rebase or force-push.
- **Owns:** `index.html` outside every `<!-- engine:... -->` region and outside the `const DECKS` line; `tests/e2e.test.js`; `tests/app.test.js`; `tools/sandbox.js`; `tests/helpers/cdp.js`; new `tools/probe/panel_fit.js`; `.github/workflows/validate.yml` (the `panel fit` job only); `tests/mutants/uid_*.patch` and `d12_*.patch`; refreshes of ANY `tests/mutants/*.patch` the edit makes stale; `docs/plans/2026-10-02-sequence-difficulty.md` (D-8 to D-12 text and ledger rows only) and this file's Review log.
- **Never touches:** `src/engine/*`, engine regions, `data/decks.json`, the `const DECKS` line, `tests/mutation_check.sh`, `tests/sequence.test.js`, anything of D3's, the print pipeline.
- Tests come first in every step: the Acceptance column's first clause is always the red test.

| # | Step | Acceptance | Verify |
|---|---|---|---|
| 0 | Merge `main` into the branch; record both SHAs in the PR | `gh pr view 203 --json mergeable,headRefOid` is MERGEABLE and equals the local tip | that command |
| 1 | **Oracle first.** Unit tests for the judge (six rules of §4.3 on synthetic cells) red, then `tools/probe/panel_fit.js`; then the CI job | judge tests green; run against `0ea790d` it is red in all three known bands and on rules 5 and 6 at h <= 356 (§4.3 "Validation"); edge list derived, containing 356, 575, 600, 761, 765 on that SHA; cells skipped = 0; wall time recorded in the PR | `node --test --test-name-pattern panel.fit tests/app.test.js`; `node tools/probe/panel_fit.js --base origin/main --candidate 0ea790d` |
| 2 | **R-2.** Red: the CSS-injection test of RP-2 for the panel, its sheet twin, K-12, and the sandbox `getClientRects` test. Then `isStop`, `panelStops()` without the `hidden` special case, the sheet list, the empty-list guard | the four tests are red on the pre-step tree for the stated reason and green after; `tests/app.test.js` fully green | `node --test --test-name-pattern unrendered.by.CSS tests/e2e.test.js`; `node --test tests/app.test.js` |
| 3 | **R-1.** Red: T-R1 and T-MQ. Then delete all four `(max-height:356px)` blocks | T-R1 green; T-MQ still red (more than four conditions remain) and is expected to be until step 7; mode S at 683x330 shows the YouTube link (nit 4) | `node --test --test-name-pattern no.stylesheet.rule.unrenders tests/e2e.test.js` |
| - | **Gate: OD-1, OD-2, OD-3, OD-5, OD-8 answered.** | recorded in §8 with date and source | - |
| 4 | **Markup and wiring.** Red: K-1, K-2, K-5 to K-9, K-13 rewritten against `#tier-select`; the existing tier tests (persist, pass-to-pick, `prev` cleared, corrupted `hpfc.tier`, empty-tier message) re-pointed from clicks to `change`. Then replace `#panel-tier-group` with `.tier-row` + select; `setMode()` flips `disabled` / `aria-describedby`; `change` calls `setTier` | all listed tests green at every viewport class named in §4.2; `uid_tier_reclick` test and mutant removed (OD-4a) | `node --test --test-name-pattern tier tests/e2e.test.js` |
| 5 | **Select and row CSS.** Red: T-EDGE's portrait rows; `the tier select shares the CHORD PROGRESSION row at every portrait width from 320 and wraps to a full row below 282px of content`; `the tier select's label fits its box in both font modes` (inner width >= label + 1px at 320 wide, each of the three options); `the select's width does not change with the selected option`; 44px in every class; computed colours and font family within the existing `.mode` set | green in both font modes; needed at 320x568 and 380x740 equals main's to 0.5px | `node --test --test-name-pattern tier.select tests/e2e.test.js` |
| 6 | **Landscape columns.** Red: T-EDGE's landscape rows, K-14, `no panel group is split across columns`. Then `#panel-cols`, the multicol rules, removal of the grid and of every remaining lane-added conditional rule (F-3) | green in both fonts; every `#settings-panel > .panel-group` selector in `index.html` (`:254`, `:259`, `:329`), the tests and the mutants is found by reading and updated; main's fit test (`tests/e2e.test.js:1429`) passes unedited | named tests; `python3 tools/refresh_mutants.py --check` |
| 7 | **Sidebar.** Red: T-EDGE's sidebar rows; `the sidebar is compact at 759 tall and default at 760`; the real-font sidebar test extended to mode S (nit 7). Then the one rule | green in both fonts at 1024x700, x759, x760, 1280x800; T-MQ green (exactly four conditions); the existing "keeps its default spacing at 1280x800" test passes unedited | named tests |
| 8 | **Existing contracts.** | chrome budget, landscape budget, contrast, 44px, rail (D-12) and sidebar-overlap tests pass with no edit beyond selector updates from step 6 | CI |
| 9 | **Mutants** per §7.1; refresh every stale patch | each new mutant applies, is killed by its one named test, and that test is selected by its `# suite:` line (exactly one test); refresh clean; harness green | `python3 tools/refresh_mutants.py --check`; `node --test tests/mutation_harness.test.js` |
| 10 | **Full oracle run at the head**, both fonts | 0 on rules 1, 2 (as §4.3 and OD-8's recorded answer define it), 4, 5, 6; rule 3 count and rule 2's "base overflows" count reported with their bands; skipped = 0; output pasted into the PR body | `node tools/probe/panel_fit.js --base origin/main`, and the CI `panel fit` jobs |
| 11 | **Docs.** Parent plan: D-8 to D-12 bodies and ledger rewritten to what ships, each with the OD that changed it (nits 5, 8); PR body rewritten from scratch | no claim in the PR body that is not a line of oracle output or a named test | reviewer reads |
| 12 | **Pre-review checklist** (§7.2), then request review | every box ticked with evidence in the PR | - |

### §7.1 Mutants

`# suite:` headers are word-split with no shell quoting: `node --test --test-name-pattern ^name.with.dots$ tests/e2e.test.js`, `.` for every space and punctuation mark, never quotes.

| Mutant | Change | Killed by |
|---|---|---|
| `uid_panel_stop_ignores_rendering` | `panelStops()` filters on `!el.disabled` only | `a panel control unrendered by CSS is never a Tab stop, and Tab still cycles` |
| `uid_sheet_stop_ignores_rendering` | sheet list filters on `!el.disabled` only | the sheet twin |
| `uid_cycle_empty_list_throws` | empty-list guard removed | K-12's test |
| `uid_css_seq_note_hidden_when_short` | re-adds `@media (max-height:356px){#panel-seq-note{display:none}}` | T-R1 |
| `uid_css_fifth_media_condition` | adds a panel rule under `(max-height:400px)` | T-MQ |
| `uid_css_columns_dropped` | removes `columns` from `#panel-cols` | T-EDGE (landscape) |
| `uid_css_group_breaks_across_columns` | removes `break-inside:avoid` | `no panel group is split across columns` |
| `uid_css_tier_row_nowrap` | `.tier-row` loses `flex-wrap` | `...wraps to a full row below 282px of content` |
| `uid_css_tier_basis_grown` | select basis 124 -> 160 | `...shares the CHORD PROGRESSION row at every portrait width from 320` |
| `uid_css_tier_padding_grown` | select right padding grown past the fit | `the tier select's label fits its box in both font modes` |
| `uid_css_sidebar_compaction_dropped` | removes the sidebar rule | T-EDGE (sidebar) |
| `uid_css_sidebar_compaction_edge` | 759 -> 800 | `the sidebar is compact at 759 tall and default at 760` |
| `uid_tier_select_unlabelled` | `aria-label` removed | K-13's test |
| `uid_tier_enabled_outside_s` | `setMode()` never disables | K-1's test |
| `uid_tier_describedby_left_on_in_mode_s` | (re-anchored) | K-13's test |
| `uid_landscape_order_rule` | adds `order:-1` to `#panel-scales-group` in landscape | K-14's test (nit 1: order is now pinned) |
| `uid_tier_not_persisted`, `uid_tier_not_passed_to_pick`, `uid_tier_prev_not_cleared`, `uid_tier_always_disabled` | (re-anchored to the select) | their existing tests, re-pointed in step 4 |

Deleted with the code they mutate: `d2_tier_group_margin_overlap`, `uid_tier_group_hidden`, `uid_tier_note_shown_in_mode_s`, `uid_tier_reclick_noop`. The nine patches of F-7 and every `b_*`/`e_*`/`sqe_*` patch whose anchor moves are refreshed; `e_panel_moved_into_header` is the large one (72 changed lines on the PR).

### §7.2 Pre-review checklist

1. `gh pr view 203 --json state,mergeable,headRefOid`: OPEN, MERGEABLE, head equals the local tip.
2. CI green **at that SHA**, every job: data integrity, python suites, js suites, suite health, mutation shards 1-4, mutation gate, `panel fit (real)`, `panel fit (fallback)`.
3. Oracle output for both fonts pasted in the PR body: cells, skipped = 0, rule counts, derived edge list. Edge list is exactly widths {640, 1024}, heights {520, 700, 759}.
4. T-MQ green: four panel media conditions. T-R1 green.
5. Every row K-1 to K-14 has a green test, named in the PR body beside its row id.
6. Every new CSS rule and every focus rule has a mutant in §7.1; each `# suite:` line selects exactly one test.
7. `python3 tools/validate.py`, `python3 tools/inline_engine.py --check`, `python3 tools/sync_decks.py --check`, `python3 tools/refresh_mutants.py --check` clean; no `<script src>`; engine regions and the DECKS line untouched.
8. `git diff --stat main...HEAD` lists nothing outside Owns.
9. §5's table re-read against the shipped code; every "Met" still true; every OD recorded in §8 with its answer, date and source. Nothing is deviated from silently.
10. 380px, 320x568, 568x320, 844x390, 1024x700 and 1280x800 screenshots in modes A and S under real fonts attached.
11. Residual risks restated in the PR body, unsoftened: WebKit multicol unverified; native select's open list untested; CI fallback font is not macOS's.

## §8 Decision ledger

| # | Decision | Pick | Basis |
|---|---|---|---|
| RP-1 | Panel layout | Select in `.tier-row` + landscape multicol + one sidebar rule; all lane trims deleted | F-5, F-6; four media conditions against eight |
| RP-2 | Reachability | R-1 (CSS never unrenders a control) + R-2 (`isStop`) | F-7; Blocker 1 |
| RP-3 | Acceptance | `tools/probe/panel_fit.js`, 1px widths, band-lowest heights with asserted invariance, both fonts, in CI | F-4, F-9 |
| RP-4 | Keep or restart | Continue on PR #203 | Less unreviewed surface |
| RP-5 | Review cap | Two attempts, then the owner | Parent §5; five FAILs |
| RP-6 | Oracle domain | w 320-1300, h 320-1100 | Smallest supported device; pending OD-7 |
| RP-7 | Mutant prefix | `uid_*` | Review 5 boundary note |
| OD-1 to OD-8 | see §6 | **open** | owner |

## §9 Failure classes and the oracle for each

| # | Class | Seen in | Oracle |
|---|---|---|---|
| FC-1 | Overflow regression at a viewport nobody sampled | reviews 3, 4, 5 (Blocker 2), F-4 | `panel_fit.js` rules 1-4 at 1px width; CI job; T-EDGE |
| FC-2 | A control CSS has unrendered is still a Tab stop | review 5 (Blocker 1) | R-2 injection tests (panel and sheet); oracle rule 6 at every cell; K-1/K-2 at 683x330 |
| FC-3 | A control silently disappears at some viewport | nit 4 | T-R1; oracle rule 5 at every cell |
| FC-4 | CI green while real fonts overflow | review 3 | Both font modes in the oracle and in T-EDGE; a run whose font mode is not the one requested fails |
| FC-5 | A test filters away the thing it should catch (`offsetParent` filter, Tab test at a tall viewport, mutant covering only `hidden`) | review 5 | Tests assert a fixed expected control list per mode (K-1 to K-4), never "whatever is rendered"; §7.1's one-mutant-per-rule table |
| FC-6 | CSS rule no test pins | nit 1 | §7.1; checklist item 6 |
| FC-7 | Visual order differs from DOM/Tab order | nit 3 | K-14 |
| FC-8 | Control with no accessible name; description with no referent | nit 2 | K-13, read from the AX tree |
| FC-9 | Shipped behaviour drifts from the plan's acceptance lines; PR body claims more than was measured | nits 5, 8; two inaccurate PR-body claims | §5 table; step 11; checklist items 3 and 9 |
| FC-10 | App uses a DOM API the unit sandbox does not stub | review 2 | Step 2's sandbox test first; `tests/app.test.js` in the step's Verify |
| FC-11 | Pixel-tuned constant with sub-pixel slack (687.8 of 688) | F-3 | Budget table §4.1 states slack; sidebar edge chosen for 14px, not 0.2px; fallback-font run |
| FC-12 | New risk from this plan: native select platform behaviour | - | K-9 at event level; the open list is **not covered** - stated in the PR, OD-4(b) removes the worst case |
| FC-13 | New risk from this plan: multicol on WebKit | - | **Not covered by CI.** Degrades to one scrolling column if `columns` is ignored (nothing clips). Needs one look on an iPhone in landscape before or after merge; the lane cannot self-certify it |
| FC-14 | Lane edits files outside its Owns list | review 5 boundary note | Owns list widened here to what the work needs; checklist item 8 |

## §10 Standing merge gates

1. CI green at the PR head SHA, every required check including all four mutation shards, the mutation gate and both `panel fit` jobs; SHA verified against the local tip with `gh pr view 203 --json headRefOid`.
2. A fresh `swarm-reviewer` returns PASS or PASS_WITH_NITS at that same SHA. The reviewer is briefed with this document, runs `node tools/probe/panel_fit.js --base origin/main` itself, and judges layout by that script's definition; its own ad hoc sweeps are welcome and are reported separately. FAIL needs a concrete failure scenario. Cap: RP-5.
3. `gh pr merge 203 --merge`, no `--delete-branch`. Merge stays operator-gated outside AFK.
4. `python3 tools/validate.py`, `tests/test_render_agreement.py` and `tools/inline_engine.py --check` pass at the head.
5. Never the full e2e suite or `tests/mutation_check.sh` locally; single tests and the oracle only.
6. `/plan-eng-review` and `/plan-design-review` of this document are logged below **before** step 4 starts.

## §11 Measured, inferred, unmeasured

- **Measured** (at the SHAs above): every number in F-2 to F-6 and F-9; the F-4 cells directly; 1px-width sweeps of main, the PR and the prototype in both font modes (7,062 cells each); both callers and all test call sites in F-7; the prototype's wrap behaviour in both font modes.
- **Inferred:** the prototype's landscape results at heights 321-520 (computed from the h 320 row; valid because nothing in the prototype's landscape CSS depends on height, which the oracle will assert rather than assume); that the lane's real implementation matches the runtime-injected prototype (it is the same CSS, but injected into main, not built on the PR branch); the oracle's cell count and local time for the final grid (extrapolated from 7,062 cells in 242 s).
- **Unmeasured:** CI wall time for the oracle; Linux fallback-font metrics; WebKit/iOS Safari for multicol and for the styled select; the native select's open list on any platform; real screen readers; the CSSOM edge-derivation code (designed here, not prototyped); the `visible note` cost of OD-3 beyond the single 568x320 arithmetic.

## Review log

## GSTACK REVIEW REPORT
