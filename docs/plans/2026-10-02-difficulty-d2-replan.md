# D2 re-plan: the Difficulty selector, after five review FAILs

- **Goal:** PR #203 (lane D2 of `docs/plans/2026-10-02-sequence-difficulty.md`) merges with an always-visible Difficulty control that is live in CHORD PROGRESSION and inert elsewhere, and the settings panel is **no worse than main at any viewport, in either font mode, by a definition both the lane and the reviewer run from the repo**. The parent plan's goal is unchanged; this document replaces only *how D2 gets the selector into the panel*.
- **Date:** 2026-10-02 (measurements ran into 2026-10-03 local time).
- **Base:** `main` @ `655a45c`. PR #203 head `0ea790dac32e68756191d6cdc02c12c996c2d170` (`0ea790d`), merge-base `154d516`. Every `index.html:N` below is at `655a45c` unless it says "PR", which means `0ea790d`.
- **Shape:** one serial lane, continuing on PR #203's branch. No parallel split: every step edits `index.html` or `tests/e2e.test.js`.
- **Why a re-plan:** owner, 2026-10-02: "If D2 fails again, take a step back, regroup and design a prompt to draft a plan to address all foreseeable problems and run /plan-eng-review and/or /plan-design-review to retackle D2." D2 failed its fifth review at `0ea790d`.
- **Status:** drafted. `/plan-design-review` ran 2026-10-03 (Review log; amendments are marked "DR-n" where they land). `/plan-eng-review` ran 2026-10-03 (Review log; amendments are marked "ER-n" where they land, and §4.3.1 supersedes §4.3 wherever the two differ). Four ledger decisions would be reversed by the recommendation; see "Owner decisions needed" (§6) before spawning the lane past step 3.

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
| *(DR-1, design review)* Three-segment control BASIC / INT. / ADV. in the same `.tier-row` slot, same multicol and sidebar rule | 0 | 0 | same as the row above | same | same |

(Format A/B then S where they differ.) Three 110px buttons cannot share a 292px row; nothing with three always-visible 44px targets **carrying their full labels** fits main's slack without trims. *(DR-1: the sentence as first written, without the qualifier, was too strong. Three 44px-tall segments with abbreviated labels occupy the select's box exactly and measured the same needed height as the select in all 14 probed cells in both font modes. Their cost is width at 320, not height: see RP-1 option (b4) and OD-9.)* **D-8/D-9 as written and "fits wherever main fits" are jointly unsatisfiable without viewport-conditional trimming.** That, not scope mismatch, is why five rounds of trimming did not converge.

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
| *(DR-1)* (b4) Three joined segments BASIC / INT. / ADV. in the select's slot | 4 | Design review, 14 cells x 2 fonts: needed height identical to the select everywhere. At 320 wide each segment is 43.7px (under the app's 44px), or 44.3px at the price of CHORD PROGRESSION wrapping to two lines under **real** fonts (129.9px label in a 129px box). Full labels do not fit (INTERMEDIATE needs 64px of a 42px segment at 320, 76 of 66 in the sidebar). Three Tab stops, not one. Keeps D-11 whole (one tap, re-pick re-deals, close on press) and has no native popup | Not recommended by the design review; put to the owner as OD-9 because it is the only always-visible form inside the budget |
| *(DR-1)* (b5) Stepper `<` INT. `>` | 4 | Not prototyped. Arithmetic at 320: two 44px arrows leave 41px for the label; hides two options like the select, costs two Tab stops and needs a live region for the value | Rejected: every cost of the select and none of its platform support |
| *(DR-1)* (b6) Render the control only in CHORD PROGRESSION | 4 | Saves the wrapped row in landscape and sidebar A/B; changes nothing at the three tight cells in mode S (the select already costs 0 at 320x568 S and the sidebar rule is still needed at 1024x700 S). Consistent with R-1 (rendered set is a function of mode) | **Reverses D-0, an owner decision.** Not recommended; nothing in the budget needs it |
| *(DR-1)* (b7) Select enabled in every mode (choosing a tier in A/B stores it, or switches to CHORD PROGRESSION) | 4 | Zero height. Removes the "disabled with no visible reason" problem and the two-visit journey (DR-4) | **Reverses D-0's "greyed out".** Listed under OD-10 for the owner; not recommended by default |

  **Structure.** Inside the Practice group, `.modebar` keeps NAME -> NOTES and NOTES -> NAME on its first row; its second row becomes `<div class="tier-row">` holding `#modeS` and `<select id="tier-select">` (BASIC / INTERMEDIATE / ADVANCED, easiest first). `.tier-row{display:flex; flex-wrap:wrap; gap:var(--sp-2); flex:1 0 100%}`; `#modeS{flex:1 1 150px; min-width:0}`; `#tier-select{flex:1 1 124px; min-width:0}`. **Whether the select shares the row is decided by two CSS constants (150 + 8 + 124 = 282px), not by font metrics**: it shares at every content width >= 282px (every portrait viewport >= 320) and takes its own full-width row below that (landscape columns, sidebar). A wider fallback font can make a label tight; it cannot move the wrap point. The select is styled as a `.mode` (same border, radius, background, font, 44px), `appearance:none` with an inline-SVG chevron in the existing `#c4bcab`; no new colour or face (RN-6).

  **Select states (DR-6, design review).** The panel is palette-neutral: no panel control takes a per-deck colour today (`.mode` `index.html:224-231`, `.prints` `:519-526`), and the select must not be the first. Specified so the lane does not improvise:

  | State | Spec | Source |
  |---|---|---|
  | Rest (mode S) | `font:600 10.5px/1 "Nunito Sans"`, `letter-spacing:.08em`, `color:#c4bcab`, `background-color:#211d16`, `border:1px solid #433b2c`, `border-radius:8px`, `min-height:44px`, text left-aligned at the `.mode` 11px inline padding, chevron `#c4bcab` right-aligned | `.mode` `:224`; the font shorthand must be set on the select itself (form controls do not inherit it) |
  | Hover / active | Whatever `.mode` does today, by sharing the selector list, not by a copied rule. If `.mode` has no hover rule, the select has none | one source of truth |
  | Keyboard focus | The global `:focus-visible{outline:2px solid #e3b25c; outline-offset:2px}` (`:638`). No select-specific outline, and `outline:none` never appears on it | existing |
  | Disabled (A/B) | `opacity:.5` on the whole control including the chevron, `cursor:default`, remembered tier still legible. On WebKit also `-webkit-text-fill-color:currentColor` so the engine's own disabled grey does not stack on the opacity (**unverified, FC-13's device look covers it**) | D-10 |
  | Selected value | The select never takes `.on` (cream). In mode S the cream CHORD PROGRESSION button beside or above it is the "on" signal; the select reads as its parameter | DR-6 |
  | Open list | OS-drawn. `option{background-color:#211d16; color:#c4bcab}` so Chrome on Windows/Linux does not open a white list from a dark panel; not testable here | FC-12 |
  | Not both a `.mode.on` and a select | The chevron is the only affordance that distinguishes the select from a `.mode` button; it is never dropped, in any class | DR-6 |

**Landscape.** The four groups are wrapped in `<div id="panel-cols">`, `display:contents` everywhere except under the existing `(max-height:520px)` condition, where `#settings-panel{display:block}` and `#panel-cols{display:block; columns:200px 4; column-gap:var(--sp-3)}`, groups `break-inside:avoid`, `.panel-group + .panel-group{margin-top:var(--sp-3)}`. The wrapper is required: `#settings-panel` has a definite height (`inset:0`), and a multicol box with a definite height overflows sideways into extra columns instead of scrolling down. Multicol replaces the `auto-fit` grid; it adds no media condition. Why it absorbs the select's row by construction: Practice is now three rows + Scales one row = Print two rows + Resources two rows, so column-major packing puts the wrapped select into what was dead space under Scales. Column order is DOM order, which removes nit 3.

  **Sidebar.** One rule, the only new media condition in the plan: `@media (min-width:1024px) and (min-height:700px) and (max-height:759px){ #settings-panel{gap:var(--sp-2); padding-block:var(--sp-2)} }`. It applies in every mode (no `:has()`), so the sidebar looks the same in A, B and S at a given height. 759 is chosen so that the first uncompacted height, 760, has 14.2px of slack under real fonts; the tight edge would be 745, which leaves 0.2px.

  **Cost, stated plainly.** (1) Two of three tiers are hidden behind a tap; the selected one is always visible. (2) A native select is the platform's control: its open list is styled by the OS and is not testable here. (3) The landscape arrangement of the pre-existing groups changes (row-major grid -> column-major columns; Scales moves under Practice). (4) The sidebar is tighter at 700-759 tall. (5) At 845-1164 wide landscape the panel is 50px taller than main; it still fits at every height >= 302. (6) In landscape cells where main already scrolls (427-586 wide, up to 366 tall), a different control ends up below the fold than on main (F-6, OD-8). (7) `columns` and `break-inside` on WebKit/iOS Safari are **unverified**; CI is Chrome-only. *Added by the design review:* (8) **DR-2:** at 320 wide `#modeS` shrinks from the full row to 155px; "CHORD PROGRESSION" measures 129.9px real against a 131px content box (1.1px spare) and 132.4px under macOS fallback, where it **wraps to two lines** inside the same 44px (height and budget unchanged; measured). Together with the select's label the pair needs 284.7px real / 294.1px fallback of 292px at the prototype's paddings; with the chevron padding at 18px it is 288.1px fallback. Step 5 pins both labels, not only the select's. (9) **DR-3:** in the landscape modal the position of Scales depends on the mode (568x320: under Practice in A/B, top of column 2 in S), because column-major packing follows content height. Order is always DOM order; the place is not constant. The modal closes on a mode change, so the move is never seen live. (10) **DR-4:** the control is paired with CHORD PROGRESSION by adjacency only in portrait. In landscape and in the sidebar it is a full-width row of its own under that button, with no label; in A/B that row is a dimmed, unlabelled "INTERMEDIATE". (11) **DR-5:** with OD-4(b) accepted, a tier change in the phone modal gives no feedback beyond the select's own text: the panel covers the card and the rail, so the re-deal is seen only after the player closes the panel. And because pressing CHORD PROGRESSION closes the modal (K-5), a player in A/B needs two panel visits to reach a tier for the first time.

- **RP-2 Reachability: rendered state is the only truth, enforced from both sides.**
  - *Rule R-1 (CSS side):* no stylesheet rule may unrender a panel control. The only things that take a control out of the panel are the `hidden` attribute written by `setMode()` and the panel being closed. Consequence: **the set of rendered controls is a function of mode alone, identical at every viewport.**
  - *Rule R-2 (JS side):* one helper, `isStop(el)` = `el && !el.disabled && el.getClientRects().length > 0`. (`getClientRects`, not `offsetParent`: the panel is `position:fixed`, and an element with `visibility:hidden` or zero size is a separate matter R-1 covers.) `panelStops()` becomes its fixed id-order list filtered by `isStop`, and the `seqNote.hidden` special case is **deleted** - a link inside a `hidden` paragraph has no client rects, so the general rule already covers it. The sheet listener at PR `:8752` replaces its inline `el && !el.disabled` with `isStop`. `cycleTabStops` gains only an empty-list guard before `preventDefault()`. *(ER-5)* The guard has its own test, `Tab with no stops neither throws nor swallows the key` (unit level, `tests/app.test.js`: `cycleTabStops([], e)` returns without calling `e.preventDefault()`); K-12 does not exercise it. The filter lives in the two list builders, not also inside `cycleTabStops`, so each can be mutated and killed separately.
  - *The test that fails when a control is unrendered but still a stop:* `a panel control unrendered by CSS is never a Tab stop, and Tab still cycles` - it injects `#seq-source-link{display:none}` (then, separately, `#deck-add{display:none}`) at runtime in mode S, asserts `panelStops()` omits it, and drives real Tab key events round the full cycle both ways. Its sheet twin does the same to one sheet control. R-1 has its own test (§4.4, T-R1) and is also checked at every cell of the oracle.
  - `tools/sandbox.js` needs a `getClientRects` stub that honours `hidden` on the element and its ancestors; test first in `tests/app.test.js`. *(ER-6)* The sandbox has no element tree: stubs are flat and id-keyed, `appendChild` records children without a parent pointer (`tools/sandbox.js:68-105`), and `.hidden` (set from the markup at `:198`) is separate state from the attribute map (`hasAttribute("hidden")`, `:431`). So the stub is specified, not improvised: (1) `appendChild` sets `parentNode`; (2) the markup pass at `:194-198` also records, for each id'd element, the id of its nearest id'd ancestor (a tag-stack walk of the shipped markup, not a hand-kept table); (3) `hidden` is one state read by both `.hidden` and `has/get/set/removeAttribute("hidden")`; (4) `getClientRects()` returns `[]` when the element or any recorded ancestor is hidden, else one rect, on every stub including dynamically created ones. Sandbox tests, written first: property assignment, attribute change, a hidden ancestor (`seq-source-link` inside `panel-seq-note`), and a created-then-appended child. The stub and `isStop` land in the **same commit**: the existing sheet Tab test (PR `tests/app.test.js:2195`) drives `keydown` through the sandbox and throws on `getClientRects` otherwise.

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
| K-15 *(DR-5)* | `change` on `#tier-select`, then close the panel | modal, S, only if OD-4(b) is accepted | after the change: panel still open, focus still on the select, select shows the new tier. After Escape or the close button: the rail and card are the new tier's deal. *(Eng review)* A second `change` straight after the first (the arrow-key path on Windows/Linux Chrome) also persists and also leaves the panel open | `after a tier change the closed panel reveals the new deal` |
| K-16 *(DR-6)* | Tab to `#tier-select` | modal and sidebar, S | computed outline is the global focus ring (2px, `#e3b25c`); in A/B the select's computed opacity is .5 and its chevron is still painted | `the tier select shows the shared focus ring and a dimmed chevron when disabled` |

Not testable here and marked unmeasured: the open native list (Escape closing the list before the panel; arrow keys committing a value per keypress on Windows/Linux Chrome but not on macOS), iOS's picker wheel, real screen readers. OD-4 exists because of the second of those.

### §4.3 The acceptance oracle

- **Where:** `tools/probe/panel_fit.js` (CLI and library). Session probe scripts live nowhere else from now on. `tests/e2e.test.js` requires the library for the edge-cell tests in §4.4, so the mutation gate and the oracle share one measuring function.
- **Run:** `node tools/probe/panel_fit.js --base origin/main` at the PR head. It extracts the base's `index.html` with `git show <base>:index.html`, serves both, and runs every cell on both roots in both font modes. **If the base cannot be read, or a font mode is not the one requested, it exits non-zero. It never skips silently.**
- **Edges, derived mechanically:** in the browser, walk the CSSOM of **both** roots; keep each `CSSMediaRule` that contains a rule whose selector matches `#settings-panel`, any element inside it, or `:root`; parse every `min-/max-width|height` length out of `conditionText`. The union is the edge list (*ER-2: the walk, the grammar and the band arithmetic are specified in §4.3.1, which is binding*). Nothing in the script names a breakpoint. On the recommended design the list is widths {640, 1024} and heights {520, 700, 759}; on `0ea790d` it also contains 356, 521, 575, 600, 761, 765.
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

#### §4.3.1 Eng-review amendments to the oracle (binding on step 1; supersede §4.3 where they differ)

Prototyped by the eng reviewer on main (`655a45c`) and on `0ea790d` in both font modes; the walk works and returns 3 dimensional conditions on main and 8 on the PR, so §4.3's design stands. What it left open:

- **ER-2 The walk.**
  - `document.styleSheets` contains the Google Fonts sheet, and reading its `.cssRules` throws `SecurityError` **in both font modes** (measured). Catch that error only for a sheet whose `href` is cross-origin; a throw from the inline sheet exits non-zero.
  - Recurse into every grouping rule. `@container` anywhere, or a `CSSSupportsRule` containing a kept rule, exits non-zero (neither exists today; the oracle has no model for them).
  - "Matches the panel" means: the selector matches `#settings-panel`, a descendant of it, or an **ancestor** of it (`html`, `body`, `:root`), tested with `el.matches()` per comma-separated selector. Several lane rules are state-dependent (`#settings-panel:has(#panel-seq-note:not([hidden]))`, PR `index.html:343`) and match only in mode S, so the walk runs in modes A, B and S with the panel open and the kept set is the **union**.
  - **Grammar is a whitelist and fails closed.** Chrome serialises `conditionText` as `(max-height: 520px)` (space after the colon). A kept rule's condition must be, per comma-separated query, an optional `screen and` followed by `(min|max)-(width|height): <integer>px` terms joined by `and`. Anything else that mentions width, height, `aspect-ratio`, `orientation` or `resolution` (range syntax `(width >= 640px)`, `em`/`rem`, `calc()`) exits non-zero with the condition text. `print` is kept out of the edge list and reported.
  - **Edges are typed.** `min-X: N` changes truth between N-1 and N; `max-X: N` between N and N+1. Bands are the integer intervals between truth transitions (`max-height:520` gives ...520 | 521...; `min-height:700` gives ...699 | 700...). An untyped list of numbers cuts one of the two wrong by a pixel.
  - `matchMedia` in script (`desktopMQ`, PR `index.html:8815`) is invisible to the CSSOM. It is already pinned to the stylesheet by the existing mutant `ms_js_breakpoint_drift`; the oracle does not re-derive it.
- **ER-1 Font-mode assertion.** `document.fonts.check(spec)` returns `true` for all five specs **in fallback mode** (measured: `document.fonts.size` 0, every `load()` resolving to an empty list), because no `@font-face` is registered and there is nothing left to load. The check at PR `tests/e2e.test.js:6950-6962` therefore cannot fail, and FC-4 rests on it. The oracle and that test assert instead: **real** = `document.fonts.size === 5`, every face `status === "loaded"`, families and weights equal to the five files in `tools/fonts/`; **fallback** = `document.fonts.size === 0`. Step 1 fixes the e2e assertion in the same commit (it is in Owns) and adds a unit test that the judge rejects a real-mode run reporting 0 faces and a fallback-mode run reporting 5.
- **ER-7 Measurement contract.**
  - *Control* = each id in §4.2's DOM-order list **except `#settings-trigger`**, which is outside the panel and is `display:none` in the sidebar; with it included rule 5 fails in every sidebar cell. Rule 6 compares `panelStops()` to "rendered enabled controls, plus the trigger in the modal".
  - *Rendered* = `getClientRects().length > 0` and computed `visibility` is `visible`.
  - *Bottom edge* = `getBoundingClientRect().bottom - panel.getBoundingClientRect().top + panel.scrollTop`, with `panel.scrollTop` set to 0 first. *Horizontal overflow* is measured on `#settings-panel` and on `document.documentElement`.
  - Rule 6 is **expected to fire in every sidebar cell on `0ea790d` and on main** (their `panelStops()` lists the unrendered trigger). Rule 6 is judged on the candidate only; step 1's validation run reports this count and does not treat it as a defect of the oracle.
  - Rule 3's failing half (new control below the fold where the base fits) is a failure; step 10 requires 0 on it.
  - `--candidate <ref>` (default: the working tree) is part of the CLI; step 1's Verify uses it.
- **ER-8 Invariance check.** It compares the **whole measurement vector** (needed, every control's bottom, the rendered set, horizontal overflow), not `needed` alone: a constant total height does not imply constant control positions. And it is not only every 16th width: F-4 has an 8px band (636-643), so the script also re-measures at every width where the vector at the band's lowest height differs from the vector at width-1 (the data's own discontinuities) and at that width -1. The sidebar's width-independence is asserted the same way (vector equal at all seven widths), not assumed. A failure is a hard fail naming root, band and width; the lane stops and reports rather than widening the tolerance. Height `edge-1` rows are covered by this check, not by the main grid; §4.3's "falls out of the above" is true for widths only.
- **ER-11 CI.** `timeout-minutes: 30` on the job. Base and candidate run concurrently inside one font job. When the candidate's `index.html` is byte-identical to the base's, the job prints `index.html identical to <base>: 0 cells measured` and passes; that is the only non-measuring pass and it is loud. Without it every later PR (D3 included) pays ~15 minutes twice for a file it did not touch. The job is **expected red on PR #203 from step 1 until step 7**; every other job stays green at every push (ER-3).
- **ER-12 The judge is mutation-gated too.** One mutant per rule of §4.3 plus the OD-8 constant and the font-mode check, each patching `tools/probe/panel_fit.js` and killed by its synthetic-cell unit test in `tests/app.test.js` (§7.1).
- **ER-10 Fallback fonts.** CI's Linux fallback is unmeasured and wider than macOS's is likely. Step 1's `panel fit (fallback)` job prints the rendered widths of "INTERMEDIATE", "ADVANCED", "BASIC" and "CHORD PROGRESSION" at 320 wide. Step 5 picks its constants only after reading that output, with at least 2px of slack against the widest of the three environments measured (real, macOS fallback, CI fallback). If no constant gives 2px in all three, the lane stops and returns to the owner; it does not tune to a sub-pixel (FC-11).

### §4.4 Tests that pin the stylesheet

- **T-R1** `no stylesheet rule unrenders a panel control`: CSSOM walk; fails on any rule, inside or outside `@media`, that sets `display:none`, `visibility:hidden` or `content-visibility:hidden` on a selector matching a panel control or one of its ancestors inside the panel, other than the global `[hidden]` rule.
- **T-MQ** `the panel's media conditions are exactly the listed ones`: the derived list of **dimensional** conditions (§4.3.1; `print` also matches the panel through `*` and is excluded, which is why main counts 3 and not 4) equals a literal list of condition strings in the test. *(ER-3, ER-4)* The list is a ratchet, never committed red: step 3 pins the seven conditions that remain once the 356 blocks are gone, step 6 shortens it as the lane's rules are deleted, step 7 lands it at main's three plus the sidebar compaction rule. Adding a condition means editing this list in the same PR, in view of the reviewer.
- **T-EDGE** *(ER-13: three tests, so each can go red in its own step and be named in a `# suite:` line)* `the panel meets its budget at every derived edge in portrait`, `... in landscape`, `... in the sidebar`, each in both font modes: §4.1's numbers at edge-1 / edge / edge+1 in both dimensions, modes A, B, S, using the oracle's measuring function. This is the committed, mutation-gated slice of the sweep.

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
| Step 8 >= 4 `uid_*` mutants | - | §7.1 lists 23 app mutants plus the judge's (ER-12) | Met |

## §6 Owner decisions needed

None of these is taken by this plan. Steps 1-3 of the lane need none of them and can start now. *(ER-13)* Steps 4 onward consume OD-1 to OD-6, OD-8 and OD-9 (which step consumes which is in §6.2); OD-7 and OD-10 have defaults that ship unless the owner answers otherwise (RP-6's floor at 320; no cue).

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

### §6.1 Design review: recommendation beside the planner's (2026-10-03)

Added by `/plan-design-review`. The planner's table above is unchanged. Nothing here is decided; every row is still the owner's. Evidence is in the Review log.

| # | Planner | Design reviewer | Differs? | Reviewer's reason |
|---|---|---|---|---|
| OD-1 | Accept the select | **Accept the select**, with F-5's "nothing fits" claim corrected (DR-1) and OD-9 answered alongside | No, but the basis changes | The select is not the only form inside the height budget. It is the only one with width to spare at 320: its label can give ~12px back to CHORD PROGRESSION under real fonts; three segments have 0 |
| OD-2 | Accept: no visible label | **Accept**, with the reservation in DR-4 | No | BASIC / INTERMEDIATE / ADVANCED name their own axis, and `#print-paper-select` ("LETTER", no label) is the panel's precedent. The weak spot is landscape and sidebar, where the control is not beside CHORD PROGRESSION. OD-10 holds the zero-height fixes |
| OD-3 | Accept: note is screen-reader-only | **Accept** | No | Measured: the visible note costs +19.8 in portrait, +37.5 in the sidebar, and puts 568x320 A/B 11.8px over with `#deck-add` offscreen. No form of visible sentence fits the 7px there. A sighted player sees a dimmed control with no stated reason; that is a real loss and the plan should say so (cost 10), but the fixes that fit are not sentences (OD-10) |
| OD-4(a) | Accept: no re-deal on re-pick | **Accept** | No | The re-deal button under the card already does this and is where a player looks for it |
| OD-4(b) | Accept: tier change does not close the modal | **Accept**, with K-15 and cost 11 added | No | A native select must not close its container on `change`: the keyboard case the planner cites is enough. The price is on the phone, where the player gets no sign the deal changed until they close the panel. That is one extra tap, and it is the same contract as the paper-size select two groups below |
| OD-5 | Accept multicol | **Accept** | No | Screenshots at 568x320, 667x375 and 844x390 read top-to-bottom, left-to-right in DOM order; Practice always leads column 1. Cost 9 (Scales changes column with the mode) is real and small |
| OD-6 | Accept sidebar compaction at 700-759 | **Accept** | No | At 1024x700 the compacted sidebar still reads as four separate groups under their headings (`proto-1024x700-modeS.png`); nothing crowds. The alternative is 46px of scroll in the mode the feature exists for |
| OD-7 | Accept floor at 320 tall | **Accept** | No | Not a design question; no objection |
| OD-8 | Accept: judge by total scroll where main already overflows | **Accept** | No | At 568x320 S main cuts the paper-size select behind 40px of scroll; the prototype cuts the three Resources links behind 17px. Resources are outbound links, the least-used row in the panel and the last in reading order: the right row to be below the fold. The half-cut row also shows that the panel scrolls, which main's clean cut at "Print this deck" does not |

**New, raised by the design review:**

| # | Decision | Planner | Design reviewer | If declined |
|---|---|---|---|---|
| OD-9 | Form of the control: native select (two tiers behind a tap, one Tab stop, OS-drawn list, D-11 amended twice) **or** three joined segments BASIC / INT. / ADV. (all tiers visible, one tap, D-11 kept whole, no native popup; abbreviations, three Tab stops, and at 320 wide either 43.7px-wide targets or a two-line CHORD PROGRESSION under real fonts). Both measured at the same needed height in every probed cell. Either one reverses D-9 | Not weighed (F-5 ruled three buttons out on height) | **Select.** The segments are the better interaction at 360 wide and up and the worse fit at 320, where they have no width to spare and this lane has failed five reviews on zero-slack constants. If the owner prefers the segments, the lane runs the oracle on them first (the prototype exists) and OD-4 falls away | n/a: this is a choice between two forms, the planner's stands unless the owner picks the other |
| OD-10 | A zero-height visible cue for the dimmed, unlabelled control (DR-4). Options: (a) none; (b) a small "DIFFICULTY" legend set into the select's top border (prototyped: 0px in all 14 cells; it is a new label style at 8px, which RN-6 and D-8's own rationale forbid); (c) visually join the select to CHORD PROGRESSION as one split control (prototyped in portrait: 0px, 6-12px lower where they stack; changes the `.mode` button's shape); (d) leave the select enabled in every mode (**reverses D-0**) | (a), implicitly | **(a) for this PR.** (b) is the cheapest real fix and the one to take if the owner finds the dimmed bar confusing on a device; it needs the owner because it adds a label style. (d) is the only option that also removes the two-visit journey, and it is the owner's own decision to reopen | (a) ships |

### §6.2 Eng review: recommendation and consuming step (2026-10-03)

Added by `/plan-eng-review`. Nothing here is decided. The engineering view only: what each answer does to the step table.

| # | Eng reviewer | Consumed by | If answered the other way |
|---|---|---|---|
| OD-1 | **Accept** | steps 4, 5 | §6 "If OD-1 is declined": steps 1-3 and 7-12 stand, 4-6 become class-wide trims judged by the oracle, T-MQ's final list is whatever survives, no convergence promise |
| OD-2 | Accept | step 4 (markup) | Falls with OD-1; a heading row re-opens §4.1's landscape budget and step 5 cannot start until the oracle is run on a prototype with it |
| OD-3 | Accept | step 4 | A visible note in portrait and sidebar only is a viewport-conditional rule on rendered content: T-R1 and oracle rule 5 fail by design. It cannot ship under R-1 |
| OD-4 | Accept both | step 4 | (b) declined: K-7 as written, K-15 and `uid_tier_change_not_dealt_until_reopen` dropped. One line |
| OD-5 | Accept | step 6 | Grid kept: step 6 shrinks to deleting lane rules, K-14 and the two multicol mutants go, §4.1 row L cannot be met (+50 at 568x320) and the lane stops for the owner |
| OD-6 | Accept | step 7 | Step 7 is test-only: T-MQ lands at main's three, both sidebar mutants and `the sidebar is compact at 759...` go, §4.1 "SB compact" becomes "<= main + 46 in S", which oracle rule 1 fails unless the owner's answer is recorded as an exemption for that band |
| OD-7 | Accept | step 1 (one constant; default 320) | Floor 300: no rework of steps 1-3; step 6 must find 2px at 845-1164 wide |
| OD-8 | Accept | step 1 (one constant), step 10's acceptance | Declined: rule 2 fails wherever main overflows; no measured layout passes; the lane stops after step 5 |
| OD-9 | **Select** | steps 4, 5 | Segments: run the oracle on the segment prototype **before** step 4; OD-4 falls away (K-7 as D-11 wrote it, K-15 and its mutant dropped); K-2 is 15 stops and K-4 14; step 5's label-fit tests and three `uid_css_tier_*` mutants are rewritten for three 43.7px segments at 320; ER-10's 2px rule has nothing to give at 320 and the lane is likely to stop there |
| OD-10 | (a) | none | (b) or (c): new CSS, a T-EDGE re-run and one mutant; (d) re-opens D-0 and K-1/K-3 |

**If OD-1 is declined.** The three-button structure stays, and the owner is choosing between two things the measurements say cannot both hold (F-5): either named bands where the panel scrolls although main does not, or viewport-conditional trims. The lane then keeps steps 1-3 and 7-12, replaces steps 4-6 with "class-wide trims, judged only by the oracle", and this plan makes **no convergence promise** for that path.

## §7 Lane D2 (continued): step table

- **Branch / PR:** `claude/difficulty-d2-app`, PR #203. Work in the lane's own worktree. Merge `main` in first; never rebase or force-push.
- **Owns:** `index.html` outside every `<!-- engine:... -->` region and outside the `const DECKS` line; `tests/e2e.test.js`; `tests/app.test.js`; `tools/sandbox.js`; `tests/helpers/cdp.js`; new `tools/probe/panel_fit.js`; `.github/workflows/validate.yml` (the `panel fit` job only); `tests/mutants/uid_*.patch`, `d12_*.patch` and the deletion of `d2_tier_group_margin_overlap.patch` *(ER-13)*; refreshes of ANY `tests/mutants/*.patch` the edit makes stale; `docs/plans/2026-10-02-sequence-difficulty.md` (D-8 to D-12 text and ledger rows only) and this file's Review log.
- **Never touches:** `src/engine/*`, engine regions, `data/decks.json`, the `const DECKS` line, `tests/mutation_check.sh`, `tests/sequence.test.js`, anything of D3's, the print pipeline.
- Tests come first in every step: the Acceptance column's first clause is always the red test.
- *(ER-3)* **Every push leaves every CI job green except `panel fit`**, which is expected red from step 1 until step 7. CI's `data integrity` job runs `python3 tools/refresh_mutants.py --check` and the mutation shards treat a red baseline suite as broken, so: no test is committed red; each step that edits `index.html` or renames a test refreshes the stale patches **in the same push** (commit the change first, then run the refresh tool, then commit its output: parent A-16); and a mutant whose target or killing test a step deletes is deleted or rewritten in that step, not in step 9. Step 9 adds the new mutants and proves the table; it is not where staleness is paid off.

| # | Step | Acceptance | Verify |
|---|---|---|---|
| 0 | Merge `main` into the branch; record both SHAs in the PR | `gh pr view 203 --json mergeable,headRefOid` is MERGEABLE and equals the local tip | that command |
| 1 | **Oracle first.** Unit tests for the judge (six rules of §4.3 on synthetic cells, the font-mode check and the condition-grammar whitelist of §4.3.1) red, then `tools/probe/panel_fit.js`; the e2e font assertion fixed (ER-1); then the CI job with its 30-minute timeout | judge tests green; the grammar test rejects `(width >= 640px)`, `(max-height: 30em)` and `(orientation: landscape)`; the fallback job prints the four label widths (ER-10); rule 6's sidebar count on `0ea790d` reported (§4.3.1); run against `0ea790d` it is red in all three known bands and on rules 5 and 6 at h <= 356 (§4.3 "Validation"); edge list derived, containing 356, 575, 600, 761, 765 on that SHA; cells skipped = 0; wall time recorded in the PR | `node --test --test-name-pattern panel.fit tests/app.test.js`; `node tools/probe/panel_fit.js --base origin/main --candidate 0ea790d` |
| 2 | **R-2.** Red: the CSS-injection test of RP-2 for the panel, its sheet twin, the sandbox `getClientRects` tests (RP-2, ER-6) and the empty-list test (ER-5). K-12's test is written here too but is a **characterization** test: `cycleTabStops` at PR `index.html:8732` already sends outside focus to the first stop (last with Shift), so it is green before and after. Then the sandbox stub and `isStop` in one commit, `panelStops()` without the `hidden` special case, the sheet list, the empty-list guard | the four red tests are red on the pre-step tree for the stated reason and green after; K-12 green throughout; `tests/app.test.js` fully green; the nine F-7 patches refreshed in the same push | `node --test --test-name-pattern unrendered.by.CSS tests/e2e.test.js`; `node --test tests/app.test.js` |
| 3 | **R-1.** Red: T-R1 (the eng reviewer's prototype of it is red on `0ea790d` on exactly `(max-height: 356px) | #panel-seq-note{display:none}` and green on main). Then delete all four `(max-height:356px)` blocks, and add T-MQ pinned to the seven conditions that remain (ER-3: a ratchet, green at this commit) | T-R1 and T-MQ green; mode S at 683x330 shows the YouTube link (nit 4). Expected and stated in the PR: with the 356 trims gone, oracle rules 1 and 2 get **redder** at h 320-356 until step 6; rules 5 and 6 go to 0 in the modal | `node --test --test-name-pattern no.stylesheet.rule.unrenders tests/e2e.test.js` |
| - | **Gate: OD-1 to OD-6, OD-8 and OD-9 answered** (ER-13; §6.2 names the step each one feeds; OD-7 and OD-10 ship their defaults unless answered)**.** PR #203 waits here with every job but `panel fit` green | recorded in §8 with date and source | - |
| 4 | **Markup and wiring.** Red: K-1, K-2, K-5 to K-9, K-13 rewritten against `#tier-select`; the existing tier tests (persist, pass-to-pick, `prev` cleared, corrupted `hpfc.tier`, empty-tier message) re-pointed from clicks to `change`. Then replace `#panel-tier-group` with `.tier-row` + select; `setMode()` flips `disabled` / `aria-describedby`; `change` calls `setTier` | all listed tests green at every viewport class named in §4.2; `uid_tier_reclick` test and mutant removed (OD-4a); `uid_tier_group_hidden`, `uid_tier_note_shown_in_mode_s` and `d2_tier_group_margin_overlap` deleted and the four re-anchored `uid_tier_*` patches rewritten **in this step** (ER-3: their targets are gone, a refresh cannot recover them) | `node --test --test-name-pattern tier tests/e2e.test.js` |
| 5 | **Select and row CSS.** Red: T-EDGE's portrait rows; `the tier select shares the CHORD PROGRESSION row at every portrait width from 320 and wraps to a full row below 282px of content`; `the tier select's label fits its box in both font modes` (inner width >= label + 1px at 320 wide, each of the three options); `the select's width does not change with the selected option`; 44px in every class; computed colours and font family within the existing `.mode` set; *(DR-2)* `CHORD PROGRESSION never clips beside the select, and stays on one line at 320 wide under real fonts` (scrollWidth <= clientWidth in both font modes; one line asserted under real fonts only; `#modeS` 44px tall in both); *(DR-6)* K-16 | green in both font modes; needed at 320x568 and 380x740 equals main's to 0.5px | `node --test --test-name-pattern tier.select tests/e2e.test.js` |
| 6 | **Landscape columns.** Red: T-EDGE landscape. K-14 and `no panel group is split across columns` are written first but are **not** red on the pre-step tree where the grid already satisfies them (ER-9: grid items cannot fragment, and K-14 is red only where nit 3 shows); each is proven by its mutant instead. Then `#panel-cols`, the multicol rules, removal of the grid and of every remaining lane-added conditional rule (F-3) | green in both fonts; T-MQ's list shortened to what remains; the `break-inside` test names a cell, found by measurement, where removing the rule splits a group (if no cell in the domain does, the test constrains `#panel-cols`' height to force fragmentation, and says so); every `#settings-panel > .panel-group` selector in `index.html` (`:254`, `:259`, `:329`), the tests and the mutants is found by reading and updated; main's fit test (`tests/e2e.test.js:1429`) passes unedited | named tests; `python3 tools/refresh_mutants.py --check` |
| 7 | **Sidebar.** Red: T-EDGE's sidebar rows; `the sidebar is compact at 759 tall and default at 760`; the real-font sidebar test extended to mode S (nit 7). Then the one rule | green in both fonts at 1024x700, x759, x760, 1280x800; T-MQ's list at its final four (main's three plus the compaction rule); the existing "keeps its default spacing at 1280x800" test passes unedited | named tests |
| 8 | **Existing contracts.** | chrome budget, landscape budget, contrast, 44px, rail (D-12) and sidebar-overlap tests pass with no edit beyond selector updates from step 6 | CI |
| 9 | **Mutants** per §7.1; refresh every stale patch | each new mutant applies, is killed by its named test, and its `# suite:` line selects that test and no other (ER-13: one test per mutant; one test may serve several mutants, as K-13's and T-MQ's do); every new killing test has been seen red with its mutant applied, locally, one test at a time; refresh clean; harness green | `python3 tools/refresh_mutants.py --check`; `node --test tests/mutation_harness.test.js` |
| 10 | **Full oracle run at the head**, both fonts | 0 on rules 1, 2 (as §4.3 and OD-8's recorded answer define it), 3's failing half (§4.3.1), 4, 5, 6; rule 3's reported half and rule 2's "base overflows" count reported with their bands; skipped = 0; output pasted into the PR body | `node tools/probe/panel_fit.js --base origin/main`, and the CI `panel fit` jobs |
| 11 | **Docs.** Parent plan: D-8 to D-12 bodies and ledger rewritten to what ships, each with the OD that changed it (nits 5, 8); PR body rewritten from scratch | no claim in the PR body that is not a line of oracle output or a named test | reviewer reads |
| 12 | **Pre-review checklist** (§7.2), then request review | every box ticked with evidence in the PR | - |

### §7.1 Mutants

`# suite:` headers are word-split with no shell quoting: `node --test --test-name-pattern ^name.with.dots$ tests/e2e.test.js`, `.` for every space and punctuation mark, never quotes.

| Mutant | Change | Killed by |
|---|---|---|
| `uid_panel_stop_ignores_rendering` | `panelStops()` filters on `!el.disabled` only | `a panel control unrendered by CSS is never a Tab stop, and Tab still cycles` |
| `uid_sheet_stop_ignores_rendering` | sheet list filters on `!el.disabled` only | the sheet twin |
| `uid_cycle_empty_list_throws` | empty-list guard removed | `Tab with no stops neither throws nor swallows the key` (ER-5; K-12's test cannot kill it) |
| `uid_css_seq_note_hidden_when_short` | re-adds `@media (max-height:356px){#panel-seq-note{display:none}}` | T-R1 |
| `uid_css_fifth_media_condition` | adds a panel rule under `(max-height:400px)` | T-MQ |
| `uid_css_state_dependent_condition` *(ER-2)* | adds `#settings-panel:has(#panel-seq-note:not([hidden])){...}` under `(max-height:400px)` | T-MQ (proves the walk unions modes A, B, S) |
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
| `uid_landscape_order_rule` | *(ER-9)* `order` applies only to flex and grid items and does nothing to a block child of a multicol container, so the original `order:-1` mutant is inert and would survive. Instead: `direction:rtl` on `#panel-cols` under the landscape condition, which lays columns right to left (the lane confirms the kill in step 9 or picks another mutation that visibly reorders) | K-14's test (nit 1: order is now pinned) |
| `uid_css_mode_s_basis_shrunk` *(DR-2)* | `#modeS` basis 150 -> 120 (label wraps under real fonts at 320) | `CHORD PROGRESSION never clips beside the select, and stays on one line at 320 wide under real fonts` |
| `uid_css_tier_focus_ring_removed` *(DR-6)* | `#tier-select:focus-visible{outline:none}` added | K-16's test |
| `uid_tier_change_not_dealt_until_reopen` *(DR-5, only with OD-4(b))* | `change` saves the tier but skips the re-deal | K-15's test |
| `uid_fit_rule_1` to `uid_fit_rule_6`, `uid_fit_od8_constant`, `uid_fit_font_mode_unchecked`, `uid_fit_grammar_accepts_unknown` *(ER-12)* | each disables one rule, flips the OD-8 constant, drops the font-mode check or lets an unparsed condition through, in `tools/probe/panel_fit.js` | the judge's synthetic-cell unit test for that rule (`tests/app.test.js`) |
| `uid_tier_not_persisted`, `uid_tier_not_passed_to_pick`, `uid_tier_prev_not_cleared`, `uid_tier_always_disabled` | (re-anchored to the select) | their existing tests, re-pointed in step 4 |

T-EDGE in this table means the named test of that class (§4.4). Deleted with the code they mutate, in the step that deletes it (ER-3): `d2_tier_group_margin_overlap`, `uid_tier_group_hidden`, `uid_tier_note_shown_in_mode_s`, `uid_tier_reclick_noop`. The nine patches of F-7 and every `b_*`/`e_*`/`sqe_*` patch whose anchor moves are refreshed; `e_panel_moved_into_header` is the large one (72 changed lines on the PR).

### §7.2 Pre-review checklist

1. `gh pr view 203 --json state,mergeable,headRefOid`: OPEN, MERGEABLE, head equals the local tip.
2. CI green **at that SHA**, every job: data integrity, python suites, js suites, suite health, mutation shards 1-4, mutation gate, `panel fit (real)`, `panel fit (fallback)`.
3. Oracle output for both fonts pasted in the PR body: cells, skipped = 0, rule counts, derived edge list. Edge list is exactly widths {640, 1024}, heights {520, 700, 759}.
4. T-MQ green: four panel media conditions. T-R1 green.
5. Every row K-1 to K-16 (K-15 only with OD-4(b)) has a green test, named in the PR body beside its row id.
6. Every new CSS rule and every focus rule has a mutant in §7.1; each `# suite:` line selects exactly one test (a test may be shared by several mutants). The judge's mutants (ER-12) are present. CI's fallback label widths (ER-10) are in the PR body beside the constants chosen from them.
7. `python3 tools/validate.py`, `python3 tools/inline_engine.py --check`, `python3 tools/sync_decks.py --check`, `python3 tools/refresh_mutants.py --check` clean; no `<script src>`; engine regions and the DECKS line untouched.
8. `git diff --stat main...HEAD` lists nothing outside Owns.
9. §5's table re-read against the shipped code; every "Met" still true; every OD recorded in §8 with its answer, date and source. Nothing is deviated from silently.
10. 380px, 320x568, 568x320, 844x390, 1024x700 and 1280x800 screenshots in modes A and S under real fonts attached. *(DR-2)* Plus 320x568 in both modes under fallback fonts, where the CHORD PROGRESSION label is tightest.
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
| RP-8 | Font-mode assertion (eng review, ER-1) | `document.fonts.size` and per-face `status`, not `fonts.check()` | Measured: `check()` is true for all five specs in fallback mode |
| RP-9 | Edge derivation (ER-2) | Whitelist grammar that fails closed; typed min/max edges; union over modes A, B, S; ancestors matched; cross-origin `SecurityError` caught for that sheet only | Prototype on main and `0ea790d`; PR `index.html:343` is a mode-S-only selector |
| RP-10 | No committed red test; mutants kept fresh per push (ER-3) | T-MQ is a ratchet of literal condition strings; deletions of mutants happen in the step that removes their target; only `panel fit` may be red mid-lane | `validate.yml` runs `refresh_mutants.py --check`; `mutation_check.sh` treats a red baseline as broken; the owner gate sits right after step 3 |
| RP-11 | Empty-list guard (ER-5) | Kept, with its own unit test; K-12 becomes a characterization test | `cycleTabStops` at PR `:8732` already handles outside focus and throws on `[]` |
| RP-12 | Sandbox ancestry (ER-6) | Parent pointers from `appendChild` plus a markup-derived ancestor map; one `hidden` state for property and attribute | `tools/sandbox.js:68-105`, `:198`, `:431` |
| RP-13 | Fallback-font constants (ER-10) | Chosen after CI prints Linux widths, 2px slack in all three font environments, else stop for the owner | Linux fallback unmeasured; macOS fallback already wraps CHORD PROGRESSION (DR-2) |
| RP-14 | Oracle in CI (ER-11, ER-12) | 30-minute timeout; loud pass on a byte-identical `index.html`; judge mutation-gated | Later PRs that do not touch `index.html` should not pay ~30 runner-minutes |
| OD-1 to OD-10 | see §6 (OD-9 and OD-10 added by the design review; the eng review added none) | **open** | owner |

## §9 Failure classes and the oracle for each

| # | Class | Seen in | Oracle |
|---|---|---|---|
| FC-1 | Overflow regression at a viewport nobody sampled | reviews 3, 4, 5 (Blocker 2), F-4 | `panel_fit.js` rules 1-4 at 1px width; CI job; T-EDGE |
| FC-2 | A control CSS has unrendered is still a Tab stop | review 5 (Blocker 1) | R-2 injection tests (panel and sheet); oracle rule 6 at every cell; K-1/K-2 at 683x330 |
| FC-3 | A control silently disappears at some viewport | nit 4 | T-R1; oracle rule 5 at every cell |
| FC-4 | CI green while real fonts overflow | review 3 | Both font modes in the oracle and in T-EDGE; a run whose font mode is not the one requested fails. *(ER-1)* As committed at `0ea790d` that failure cannot happen (`fonts.check()` is true with no faces registered); the assertion is replaced per §4.3.1 and is itself mutation-gated |
| FC-5 | A test filters away the thing it should catch (`offsetParent` filter, Tab test at a tall viewport, mutant covering only `hidden`) | review 5 | Tests assert a fixed expected control list per mode (K-1 to K-4), never "whatever is rendered"; §7.1's one-mutant-per-rule table |
| FC-6 | CSS rule no test pins | nit 1 | §7.1; checklist item 6 |
| FC-7 | Visual order differs from DOM/Tab order | nit 3 | K-14 |
| FC-8 | Control with no accessible name; description with no referent | nit 2 | K-13, read from the AX tree |
| FC-9 | Shipped behaviour drifts from the plan's acceptance lines; PR body claims more than was measured | nits 5, 8; two inaccurate PR-body claims | §5 table; step 11; checklist items 3 and 9 |
| FC-10 | App uses a DOM API the unit sandbox does not stub | review 2 | Step 2's sandbox test first; `tests/app.test.js` in the step's Verify |
| FC-11 | Pixel-tuned constant with sub-pixel slack (687.8 of 688) | F-3 | Budget table §4.1 states slack; sidebar edge chosen for 14px, not 0.2px; fallback-font run |
| FC-12 | New risk from this plan: native select platform behaviour | - | K-9 at event level; the open list is **not covered** - stated in the PR, OD-4(b) removes the worst case. *(Eng review: honest as written. One cheap check was missing and is added to K-15: two `change` events in a row with the modal open, each persisting its tier and neither closing the panel, which is the Windows/Linux arrow-key path at event level.)* |
| FC-13 | New risk from this plan: multicol on WebKit | - | **Not covered by CI.** Degrades to one scrolling column if `columns` is ignored (nothing clips). Needs one look on an iPhone in landscape before or after merge; the lane cannot self-certify it. *(Eng review: honest as written. "Degrades to one scrolling column" is itself inferred, not measured; the PR says so. No headless WebKit exists in this repo's CI and none is added.)* |
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
- **Unmeasured:** CI wall time for the oracle; Linux fallback-font metrics; WebKit/iOS Safari for multicol and for the styled select; the native select's open list on any platform; real screen readers; the CSSOM edge-derivation code (designed here, not prototyped); the `visible note` cost of OD-3 beyond the single 568x320 arithmetic (*design review measured it at seven viewports: +19.8 at 380x740 and 320x568, +18.8 at 568x320 which puts it 11.8 over the viewport with `#deck-add` offscreen, 0 at 667x375 and 844x390, +37.5 in the sidebar*).
- **Measured by the eng review** (single probes, headless Chrome, `655a45c` and `0ea790d`): the CSSOM walk and its derived condition lists (3 and 8 dimensional, plus `print`); the cross-origin `SecurityError` in both font modes; `document.fonts.check()` true in fallback mode; a T-R1 prototype red on the PR and green on main. Read, not run: every reference to `panelStops` and `cycleTabStops` (two callers, PR `:8752` and `:8971`, none passed as a bare value; five test call sites, as F-7 says), `tools/sandbox.js`, `tests/helpers/cdp.js`'s `enableRealFonts`, `validate.yml`, `mutation_check.sh`'s baseline rule.
- **Unmeasured, added by the eng review:** whether `direction:rtl` (or any single declaration) reorders the multicol panel so K-14 kills it; whether any cell in the domain fragments a group once `break-inside:avoid` is removed; the oracle's run time on `0ea790d`, which has about seven height bands against the recommended design's four (so roughly twice §4.3's estimate); that multicol "degrades to one scrolling column" on an engine that ignores `columns`.
- **Unmeasured, added by the design review:** iOS Safari's zoom-on-focus for a 10.5px select (the existing `#print-paper-select` has the same exposure); WebKit's rendering of a disabled `appearance:none` select; whether Chrome matches `:focus-visible` on a mouse-opened select; option (b4) beyond 14 cells per font (no 1px sweep was run on it); Linux fallback width of "CHORD PROGRESSION".

## Review log

### `/plan-design-review`, 2026-10-03 (independent reviewer; did not write this plan)

Reviewed at `9e0b312`. Spawned, non-interactive: every question the skill would have asked is answered below with the option the reviewer would recommend. No owner decision was taken.

**Method.** The planner's prototype (`fin`, runtime-injected into main at `655a45c`) was re-run under real and macOS-fallback fonts at 380x740, 320x568, 568x320, 667x375, 844x390, 1280x800 and 1024x700 in modes A and S, next to main and PR #203 at `0ea790d`. Every needed-height figure the plan gives for those cells reproduced (main, PR and prototype). Five alternatives were then injected the same way: three segments with short labels, three segments with full labels, a joined split control, a legend micro-label, a visible note in A/B. Single probes only; no e2e suite, no mutation run.

**Scores (0-10).**

| Pass | Before | After amendments | What a 10 needs |
|---|---|---|---|
| 1 Information architecture | 7 | 8 | The control's relation to CHORD PROGRESSION visible in landscape and sidebar, not only in portrait (OD-10) |
| 2 Interaction states | 5 | 8 | Hover, focus, disabled, open-list and selected states were unspecified for the one new control; now a table in RP-1. A 10 needs the open list seen on a device |
| 3 User journey | 5 | 7 | Two panel visits to reach a tier from A/B and no feedback after a change on a phone (cost 11). Stated and tested (K-15), not removed; OD-9's segments would restore the feedback, only OD-10(d) removes the second visit |
| 4 AI slop risk | 9 | 9 | A native control in the existing `.mode` skin; nothing generic to remove |
| 5 Design system alignment | 6 | 8 | The plan did not say the panel is palette-neutral, so "per-deck colours" was open; now closed. A 10 needs WebKit's disabled select checked |
| 6 Responsive and accessibility | 7 | 8 | CHORD PROGRESSION's own fit at 320 was unpinned (DR-2). 44px height holds everywhere measured |
| 7 Unresolved decisions | 8 open | 10 open | OD-9 and OD-10 added; all ten are the owner's |
| **Overall** | **6** | **8** | |

**Findings.**

| # | Sev | Finding | Evidence | Disposition |
|---|---|---|---|---|
| DR-1 | High | F-5's claim that nothing with three always-visible 44px targets fits without trims is false as written. Three segments BASIC / INT. / ADV. in the select's slot need exactly the select's height | `segshort` real / fallback: 442, 494, 313, 263, 263, 668, 612 in A; 490, 542, 337, 301.8, 286, 733.8, 677.8 in S, equal to `proto` in all 14 cells in both fonts. Segment width 53.7 at 380, **43.7 at 320**, 67 in the sidebar, 90.8 at 568 landscape. With the basis moved to give 44.3px segments, CHORD PROGRESSION wraps under real fonts (129.9 in 129). Full labels overflow (scrollWidth 64 > 42 at 320; 76 > 66 in the sidebar) | **Accepted.** F-5 reworded and a row added; RP-1 options (b4)-(b7) added; OD-9 raised. The reviewer still recommends the select |
| DR-2 | Medium | At 320 wide the recommended layout leaves CHORD PROGRESSION 1.1px of spare width under real fonts and wraps it to two lines under macOS fallback. The plan pins the select's label fit and not this one | `#modeS` 155px wide, content 131, label 129.9 real / 132.4 fallback; height stays 44 | **Accepted.** Cost 8, step 5 test, mutant `uid_css_mode_s_basis_shrunk`, checklist item 10 |
| DR-3 | Low | Landscape: Scales sits under Practice in A/B and at the top of column 2 in S | `proto-568x320-modeA.png` against `proto-568x320-modeS.png` | **Accepted as a stated cost** (9). No change: order is DOM order in both, and the modal closes on mode change |
| DR-4 | Medium | The control is unlabelled and, in landscape and the sidebar, not beside the button it depends on. In A/B it is a dimmed full-width "INTERMEDIATE" with no visible reason | `proto-568x320-modeA.png`, `proto-1280x800-modeA.png`; compare `proto-380x740-modeA.png` where adjacency carries it | **Stated** (cost 10). Fixes that fit the budget change the visual system or D-0, so they go to the owner as OD-10 |
| DR-5 | Medium | Journey: CHORD PROGRESSION closes the modal, so a first tier change takes two visits; with OD-4(b) a tier change on a phone shows nothing until the panel is closed | K-5, K-7; the modal is full-screen at every phone viewport shot | **Accepted in part.** Cost 11 and K-15 with its mutant added so the "close reveals the new deal" contract is tested. The missing feedback goes away with OD-9's segments (press closes the panel); the two-visit path goes away only with OD-10(d) |
| DR-6 | Medium | The select's hover, focus, disabled, selected and open-list states were not specified, and the plan did not say whether deck colours apply | RP-1 gave rest-state styling only; the prototype's CSS has no focus or hover rule | **Accepted.** "Select states" table in RP-1, K-16, mutant `uid_css_tier_focus_ring_removed`, three items added to §11 |
| DR-7 | Info | OD-3's visible note is worse than the plan's single arithmetic line suggested in the sidebar and no better anywhere | `note`: +19.8 at 380x740 and 320x568; 331.8 of 320 at 568x320 with `#deck-add` offscreen; +37.5 in the sidebar (two lines at 240px) | Supports the planner. §11 updated |
| DR-8 | Info | OD-8 from the user's side: the row that falls below the fold at 568x320 S is Resources, not paper size | `main-568x320-modeS.png` against `proto-568x320-modeS.png` | Supports the planner |
| DR-9 | Info | PR #203 at `0ea790d` in landscape puts the tier buttons in column 2 under Print with the note, away from Practice | `pr-568x320-modeA.png` | Confirms nit 3; the re-plan removes it |

**Questions the skill would have asked, and the answer taken.**

| Question | Choice | Reason |
|---|---|---|
| What to review? | This file | Named by the caller |
| Generate visual mockups with the design binary? | No; real-font screenshots of main, the PR and runtime prototypes instead | The caller excluded anything needing an API key, and a rendered prototype is better evidence than a mockup for a layout budget measured in single pixels |
| Run outside design voices (Codex)? | Skipped | The caller runs `/plan-eng-review` as the second independent read; a third model would add opinion, not measurement |
| DR-1: correct F-5 and record the segmented control, or leave the plan's claim? | Correct and record | The claim is the stated basis for OD-1; the owner should decide OD-1 knowing a second form fits |
| DR-1: switch the recommendation to segments? | No | Zero width slack at 320 in a lane that has failed five times on zero-slack constants; raised as OD-9 instead |
| DR-2: fix by `white-space:nowrap`, or allow the two-line fallback and pin "never clips"? | Allow and pin | `nowrap` turns a wrap into an overflow under a wider Linux fallback font, which is unmeasured; two lines inside 44px costs no height |
| DR-4: add a visible label or cue now? | No; OD-10 | Every cue that fits either adds a label style (RN-6) or reverses D-0 |
| DR-5: recommend close-on-change to give feedback? | No; keep OD-4(b), add K-15 | A select that closes its container on `change` breaks keyboard use on Windows and Linux Chrome |
| DR-6: specify states in the plan or leave to the lane? | Specify | A state the plan does not name is one the reviewer cannot hold the lane to |
| Add anything to TODOS.md? | No | The reviewer may edit this file only; the two device checks are already FC-12 and FC-13 |

**Not in scope of this review:** the oracle's design (§4.3), R-1/R-2, mutant hygiene, the rail (D-12), tier persistence and the engine. Those are `/plan-eng-review`'s.

**What already exists and is reused:** `.mode` skin and 44px minimum (`index.html:224`), the global focus ring (`:638`), `#print-paper-select` as the native-select, no-visible-label, stays-open precedent (`:519-526`), `.panel-note` (`:212`) for the screen-reader text.

**Screenshots** (real fonts; `<root>-<W>x<H>-mode<A|S>.png` for each of 380x740, 320x568, 568x320, 667x375, 844x390, 1280x800, 1024x700 in modes A and S), session-local under `/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/3347d7d0-1ec9-4967-bd81-dd4cf98e29d7/scratchpad/design-review/`: roots `main` (655a45c), `pr` (0ea790d), `proto` (the recommended select), `segshort` (BASIC / INT. / ADV.), `seg126` (same, 44.3px segments), `segfull` (full labels, overflowing), `join` (split control), `label` (legend micro-label), `note` (visible note in A/B). 126 files. The script is `shots.js` beside them.

**Not verified by this review:** WebKit and iOS Safari (multicol, the styled and the disabled select, zoom on focus); the native list when open, on any platform; screen readers; Linux fallback fonts; any alternative beyond the 14 cells per font listed (no 1px sweep); the lane's real implementation, since every non-main, non-PR root is CSS and markup injected into main at runtime.

**Implementation tasks added by this review** (all inside existing steps): step 5 gains the CHORD PROGRESSION fit test and K-16; step 4 gains K-15 if OD-4(b) is accepted; §7.1 gains three mutants.

### `/plan-eng-review`, 2026-10-03 (independent reviewer; did not write this plan)

Reviewed at `bf4e127`. Spawned, non-interactive: every question the skill would have asked is answered below with the option the reviewer would recommend. No owner decision was taken and no OD was added.

**Method.** Three single probes in headless Chrome against main (`655a45c`) and PR #203 (`0ea790d`, read with `git show`, never checked out or edited): a prototype of §4.3's CSSOM walk in both font modes; the font-mode assertion run in the wrong mode; a prototype of T-R1. Every reference to `panelStops` and `cycleTabStops` read in the PR's `index.html`; `tools/sandbox.js`, `tests/helpers/cdp.js`, `.github/workflows/validate.yml`, `tests/mutation_check.sh` and `tools/refresh_mutants.py` read. No e2e suite, no mutation run, no full sweep. Outside voice: `codex exec`, read-only, two runs (the first timed out at 300 s with no findings; the second returned eleven).

**Verdict.** The design is sound and the oracle is implementable: the walk derives 3 conditions on main and 8 on the PR with no breakpoint named, and T-R1 is red on the PR for the right reason. As drafted the plan was **not** startable: its font-mode guard could not fail, the edge parser was unspecified where it matters, and step 3 committed a red test that would have sat on PR #203 through the owner gate. With the amendments below, steps 1-3 can start today and need no owner decision.

**Findings.**

| # | Sev | Conf | Finding | Verified | Disposition |
|---|---|---|---|---|---|
| ER-1 | High | 10 | The font-mode guard cannot fail. `document.fonts.check()` is true for all five specs with no faces registered, so a fallback run passes the "real" assertion. FC-4's oracle rests on it | Probe: fallback `fonts.size` 0, `check()` true x5; real `size` 5, all `loaded` | **Accepted.** §4.3.1, step 1, FC-4, RP-8, mutant `uid_fit_font_mode_unchecked` |
| ER-2 | High | 9 | Edge derivation left open: the Google Fonts sheet throws `SecurityError` on `.cssRules` in both modes; state-dependent `:has()` selectors match only in mode S; unparsed conditions (range syntax, `em`, `orientation`) would be dropped silently; an untyped edge list cuts `min-` and `max-` bands a pixel apart; ancestors of the panel are not only `:root` | Probe on both roots; PR `index.html:343` | **Accepted.** §4.3.1, RP-9, mutant `uid_css_state_dependent_condition`, grammar unit test in step 1 |
| ER-3 | High | 9 | Step 3 commits T-MQ red until step 7, and the owner gate follows step 3, so PR #203 would wait red with any mutant on that suite "broken". Mutant deletions and refreshes are deferred to step 9 although CI checks freshness on every push and a refresh cannot recover a deleted target. The new `panel fit` job is itself red from step 1 | `validate.yml` (`refresh_mutants.py --check` in `data integrity`); `mutation_check.sh` baseline rule | **Accepted.** T-MQ is a ratchet; §7 rule "every push leaves every job but `panel fit` green"; steps 2, 3, 4, 6, 9; RP-10 |
| ER-4 | Medium | 9 | "Exactly four media conditions" miscounts: `@media print` matches the panel through `*`, so main derives 4 and the target 5 | Probe | **Accepted.** T-MQ counts dimensional conditions as literal strings |
| ER-5 | Medium | 9 | K-12 is green before the change (index -1 already goes to the first stop, or the last with Shift), so step 2's "four tests red" is false for it and it cannot kill `uid_cycle_empty_list_throws` | Read PR `:8732-8736`; the outside voice reproduced both behaviours | **Accepted.** Guard kept with its own test; K-12 relabelled; RP-11 |
| ER-6 | Medium | 9 | The sandbox has no element tree and keeps `.hidden` and the `hidden` attribute as separate state, so "a stub that honours `hidden` on ancestors" cannot be written as stated. The existing sheet Tab test throws if the stub and `isStop` land apart | Read `tools/sandbox.js:68-105`, `:198`, `:431`; PR `tests/app.test.js:2195` | **Accepted.** RP-2 bullet rewritten; step 2; RP-12 |
| ER-7 | Medium | 8 | The six rules lack a measurement contract: "control" and "rendered" undefined; the trigger makes rule 5 fail in the sidebar if counted; rule 6 fires in every sidebar cell on main and `0ea790d`; `--candidate` is used and never defined; rule 3 has a failing half that step 10 only reported | Read §4.3 against PR `:8816-8829` | **Accepted.** §4.3.1, step 10 |
| ER-8 | Medium | 7 | The invariance check compares `needed` only and samples every 16th width, while F-4 has an 8px band; constant height does not imply constant control positions | Reasoned from the plan's own F-4; not run | **Accepted.** Whole vector, plus the data's own discontinuities; hard fail |
| ER-9 | Medium | 8 | `uid_landscape_order_rule` is inert (`order` does nothing in multicol) and would survive; `no panel group is split across columns` is green on the grid before multicol exists, and whether removing `break-inside` splits anything in the domain is unknown | CSS semantics; **not probed** | **Accepted.** Mutant replaced; step 6 reworded; both listed in §11 as unmeasured |
| ER-10 | Medium | 6 | Absolute label-fit gates under fallback fonts are tuned on macOS and judged on Linux, which nobody has measured; the lane failed five times on sub-pixel constants | **Not verifiable locally** | **Accepted.** CI prints the widths in step 1; 2px rule; RP-13 |
| ER-11 | Medium | 7 | The `panel fit` job has no timeout, and every later PR pays two ~15-minute jobs even with `index.html` untouched | `validate.yml` has no `timeout-minutes`; CI time itself unmeasured | **Accepted.** §4.3.1, RP-14 |
| ER-12 | Medium | 8 | The judge has unit tests and no mutants: a rule could be disabled and nothing would notice | Read §7.1 | **Accepted.** Nine judge mutants |
| ER-13 | Low | 9 | Internal inconsistencies after the design review: three different lists of ODs gating step 4; checklist said K-1 to K-14 (there are 16); §5 said 17 mutants; "exactly one test" read as one-to-one though K-13 and T-MQ each kill several; T-EDGE one test in §4.4 and three in the tables; `d2_*` deletion outside Owns | Read | **Accepted.** Fixed in §4.4, §5, §6, §6.2, §7, §7.1, §7.2 |

**What the caller asked, answered.**

1. *Oracle.* Implementable; see ER-1, ER-2, ER-7, ER-8. "Regression" is defined once and includes the OD-8 variant as one constant. The red-on-`0ea790d` command is step 1's Verify (`--candidate 0ea790d`), now documented.
2. *CI.* Both font modes run. Real fonts need no network: `enableRealFonts()` (PR `tests/helpers/cdp.js:409-442`) fulfils the Google Fonts request from `tools/fonts/`. The wrong-mode failure did **not** work (ER-1). Budget: ER-11.
3. *Reachability.* The caller list is complete: `cycleTabStops` is called at PR `:8752` (sheet) and `:8971` (panel), `panelStops` only at `:8971`; neither is passed as a bare value. Test call sites are the five F-7 names. The sandbox assumption does not hold as written (ER-6); the ordering is now explicit.
4. *Ordering.* Steps 1-3 need no owner decision. They did not leave PR #203 coherent (ER-3); they do now. K-12, K-14 and the split test were not red for the stated reason (ER-5, ER-9).
5. *Mutants.* ER-3, ER-5, ER-9, ER-12, ER-13. `# suite:` headers follow the word-split rule. D3 is unaffected: it spawns from main after D2 merges and owns its own refresh (parent §9.2, A-16).
6. *Continue or restart.* Continue (RP-4 stands). Of the PR's non-mutant diff (`index.html` +520, `tests/e2e.test.js` +750), the rail, `store.tier`/`setTier`, the `pick(..., tier)` call, the empty-tier message, the sandbox additions and `enableRealFonts` survive; all tier CSS, the tier markup, the tier-button tests and four mutants are replaced. The next reviewer re-reviews every layout rule, both stop-list builders, the oracle and its CI job from scratch, and takes the surviving parts as already reviewed only where the diff since `0ea790d` does not touch them.
7. *Failure classes.* FC-4 was not honest (ER-1). FC-12 and FC-13 are; one event-level check added to K-9, no device testing invented.
8. *Scope.* No reach into the engine, deck data, D1, D3's files or the CLAUDE.md ideas. `tools/sandbox.js` and `tests/helpers/cdp.js` are already in the PR's diff and in Owns.

**Questions the skill would have asked, and the answer taken.**

| Question | Choice | Reason |
|---|---|---|
| What to review? | This file | Named by the caller |
| Scope challenge: reduce the plan? | No | One lane, one new tool, one CI job; the oracle is the point of the re-plan |
| ER-3: T-MQ red until step 7, or a ratchet? | Ratchet | A committed red test blocks the mutation gate and the PR waits at the owner gate |
| ER-5: drop the empty-list guard (unreachable today) or test it? | Keep and test | One line; once `isStop` filters by rendering, an empty list is one stylesheet mistake away, and the failure is a thrown handler |
| ER-8: prove invariance at every width instead? | No; whole vector at sampled widths plus discontinuities | Every width at three heights triples the run; ER-2's fail-closed parser removes the media-query route to height dependence |
| ER-9: probe `direction:rtl` now? | No | It needs the lane's real multicol CSS; step 9 already requires each mutant to be seen killed |
| ER-10: is the fallback gating policy the owner's call? | No; engineering | The goal already says "in either font mode"; this only fixes how constants are chosen |
| ER-11: skip the oracle when `index.html` is unchanged? | Yes, as a logged pass | It measures nothing new; "never skips silently" is kept by printing the reason |
| Also verify that focus moved inside `cycleTabStops`? | No | T-R1 and rule 6 cover it; the plan wants the two builders separately mutable |
| Add an OD? | No | Nothing found is a product decision |
| Add anything to TODOS.md? | No | The reviewer may edit this file only |

**Outside voice (Codex, read-only).** Eleven findings, each checked against source. Nine coincide with ER-1, ER-2, ER-3, ER-5, ER-6, ER-7, ER-8 and ER-13. Two were new and are accepted as ER-9 (the inert `order` mutant; the split test green before the change). Taken from it into existing findings: `.hidden` against the attribute map (ER-6), rule 3 against step 10 (ER-7), deleted mutant targets (ER-3). **Rejected:** (a) "edge-1 / edge / edge+1 does not fall out" is wrong for widths, which are every integer; it is right for heights and §4.3.1 says so. (b) "the sweep is still sampling": for the fit rules it is not, since every width is measured at each band's worst height; the sampled part is the invariance check, now widened (ER-8), and proving it at every cell was declined above. (c) "specify tests for reparenting in the sandbox": the app never reparents a panel control; not added.

**Failure modes with no test before this review:** fallback run passing as real (ER-1, critical: silent); a mode-S-only media rule missed by the walk (ER-2, silent); an unparsed condition dropped (ER-2, silent); a judge rule disabled (ER-12, silent). All four now have a named test and a mutant.

**Not in scope of this review:** the visual design and the select's states (`/plan-design-review`); the engine, D1 and D3; whether D-9 should be reversed (OD-1, the owner's).

**What already exists and is reused:** `enableRealFonts` and `launch({realFonts:true})` (PR `tests/helpers/cdp.js`); `ms_js_breakpoint_drift` for the script-side breakpoint; `tools/refresh_mutants.py`; `mutation_harness.test.js`'s lint that a `# suite:` pattern selects a test.

**Not verified by this review:** Linux fallback metrics; CI wall time; WebKit; the native open list; the full sweep on any root; the oracle's run time on `0ea790d`; ER-9's replacement mutant and the fragmentation cell; the planner's F-2 to F-6 numbers (the design review re-measured those, this one did not).

**Implementation tasks added by this review** (all inside existing steps): step 1 gains the font assertion, the grammar whitelist, the label-width printout, the timeout and nine judge mutants; step 2 the sandbox ancestry and the empty-list test; step 3 the T-MQ ratchet; steps 4 and 6 delete or rewrite their own mutants; step 9 proves kills one test at a time.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | - |
| Outside Review | `codex exec` (plan review) | Independent 2nd opinion | 1 | ISSUES FOUND, folded in | 11 findings: 9 overlap the eng review, 2 new and accepted, 3 points rejected |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES FOUND, all amended in the plan | 13 findings (3 high, 9 medium, 1 low); 0 critical gaps left open |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ISSUES OPEN (FULL) | score: 6/10 → 8/10, 10 decisions |

- **OUTSIDE COVERAGE:** Codex ran read-only for the eng review (second attempt; the first timed out). The design review ran no outside voice.
- **CROSS-MODEL:** Codex and the eng reviewer agree on every high finding. No unresolved disagreement.
- **VERDICT:** Eng and design reviews complete. Steps 1-3 are clear to start. Steps 4 onward are not cleared: they wait on the owner decisions below.

**UNRESOLVED DECISIONS:**
- OD-1: one native select instead of three buttons (reverses D-9). Planner, design and eng reviewers: accept.
- OD-2: no visible "Difficulty" label (reverses D-8). All three: accept.
- OD-3: the "Pick CHORD PROGRESSION" note becomes screen-reader-only (amends D-10). All three: accept.
- OD-4: no re-deal on re-pick; a tier change does not close the modal (amends D-11). All three: accept.
- OD-5: landscape multicol regrouping. All three: accept.
- OD-6: sidebar compaction at 700-759 tall. All three: accept.
- OD-7: oracle fit floor at 320 tall. All three: accept.
- OD-8: where main already overflows, judge by total scroll. All three: accept.
- OD-9: select or three segments BASIC / INT. / ADV. Design and eng reviewers: select.
- OD-10: zero-height visible cue for the dimmed control; option (d) reverses D-0. Design and eng reviewers: none for this PR.
