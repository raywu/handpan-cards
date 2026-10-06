# Resources: the three-link row splits equally

Date: 2026-10-06. Base: main `659b8223ec476fe5660f7b1a78821cb16c18d4b7`. One serial lane.
Sections 2.1, 4.3 and 6 of `docs/plans/2026-10-05-refactor-pass-3.md` apply, except: 2.1's FLOORS/README bullet
(lane TR owns its FLOORS row and the count), and gate 5, which the regroup rule in the owner's AFK instructions
replaces (a third failed review triggers it). That plan's section 5 does not apply; TR-3 here replaces it.

## 1. Goal

Owner, 2026-10-05, asked whether the older three-link Resources row should split equally: "Yes, after numerals".

The first Resources row (`#res-handpaner`, `#res-dingandtones`, `#res-trainingcards`) draws its links at equal
width at every `MENU_VIEWPORTS` cell and on the sidebar's first line. Where a third of the row cannot hold
HANDPANER (landscape rows under about 258px, for example 640x360) the row may stay unequal, and every label stays
inside its box.

Done when: the new e2e test passes at every `MENU_VIEWPORTS` cell, CI `validate` is green at the PR head (including
both `panel-fit` jobs), and no panel cell scrolls more than it does on main.

## 2. Facts (measured on main with real fonts, panel open, 2026-10-06)

Widths in px of handpaner / dingandtones / trainingcards:

| viewport | main | cause |
|---|---|---|
| 320x568 | 97.8 / 89.1 / 89.1 | HANDPANER cannot shrink under its content: `.modebar .mode{flex:1 1 0}` leaves `min-width:auto` |
| 360x640, 380x800 | equal | a third of the row is wider than HANDPANER |
| 844x390 | 97.8 / 79.7 / 79.8 | same as 320 |
| 1024x700, 1024x768, 1440x900 (sidebar, row 199px) | 97.8 / 89.2 on line one, 199 on line two | the row wraps (`.modebar{flex-wrap:wrap}`) and line one is unequal for the same reason |

The Amy row is equal everywhere because `.modebar.duo .mode` has `min-width:0; padding-inline:6px`.

In landscape under 520px high the panel is a grid (`repeat(auto-fit, minmax(200px, 1fr))`), so the row is 200 to
314px wide and not monotonic in viewport width. Main there: 640x360, 667x375, 896x414 draw two links plus `HTC` on
a second line; 932x430, 700x500, 736x414 draw one unequal line.

Eng review probe (real fonts) of the TR-2 rules: 320x568 92 x 3; 380x700 112 x 3; 768x1024 132 x 3; 844x390
85.77 / 85.78 / 85.78; 1024x700 93.5 / 93.5 with `HTC` 199 below; no label spill at 14 cells; panel scroll identical
to main at every `MENU_VIEWPORTS` cell; `tools/probe/panel_fit.js` PASS with real and fallback fonts.

A third of the 199px sidebar row is 58.3px. HANDPANER's text alone is about 74px, so three equal links on one line
cannot hold their labels there.

## 3. Decisions

- D1 (orchestrator, owner away; the owner may overturn it). Sidebar: line one is two equal links, `HTC` keeps the
  full-width second line it has today. Reason: it costs no height. The alternative, three stacked full-width links,
  is equal in the strict sense but adds 56px and takes the panel's scroll at 1024x700 from 8px to 64px (measured).
- D2. A new row class `trio`, not `duo`: `.modebar.duo` is `flex-wrap:nowrap` and its comment says no other row
  takes it.
- D4 (eng review, blocker). No `min-width:0` on this row. With it, HANDPANER spills its box by 3 to 6px at
  640x360, 667x375, 896x414, 932x430 and 700x500, and no existing oracle sees it. The rule is padding only: the
  link keeps its content minimum, so a label can never spill. Cost, accepted: rows under about 258px stay unequal as
  on main, and 640x360, 667x375 and 896x414 change from main's two-plus-one to one unequal line (83.8 / 52.7 /
  52.7). A container query would be exact but is a new mechanism in this file; not taken.
- D3. This plan ships as the lane branch's first commit, committed by the orchestrator. The lane does not edit it.

## 4. Non-goals

- Any change to the Amy row, to link text, hrefs, order, or to any other panel row or control.
- Stacking the sidebar links (D1). Font size, letter-spacing, or the 44px target.
- `tools/probe/panel_fit.js` and its `RES_ALLOWANCE_PX`: this lane adds no `res-*` control and gets no allowance.
- Deck data, geometry, engine regions, the `const DECKS` line, PDFs, `CLAUDE.md`.
- The other unscheduled nits in the Menu Resources review.

## 5. Lane TR: `claude/resources-trio`

**Owns.**
- `index.html`: the `class` attribute of the `<div class="modebar">` that holds `#res-handpaner`; the HTML comment
  directly above it; one new CSS rule placed directly after the `.modebar.duo .mode{...}` rule; one
  rule inside the desktop sidebar media block `@media (min-width:1024px) and (min-height:700px)`.
- `tests/e2e.test.js`: one new test, placed directly after the test named `the two Amy links share one row at equal
  width, spanning it, and every label stays inside its box`.
- `tests/mutants/`: two new patches (step TR-3), and any existing patch stranded by the edits above, refreshed with
  `python3 tools/refresh_mutants.py`.
- `tests/suite_health.py`: the `"tests/e2e.test.js"` FLOORS row only. `README.md`: the mutant count only.

### TR-1: the red test (first lane commit)

- Test name: `TR-1: the three site links are equal in width on every line they share, and every label stays inside
  its box`.
- For every `MENU_VIEWPORTS` cell, with the panel open as the Amy test opens it: group the three links into visual
  lines by `top` (within 2px). Assert: the line shape is exactly [3], except at 1024x700 where it is exactly [2,1];
  links sharing a line differ in width by at most 1px; every link is at least 44px tall; every label's client rects lie
  inside its link box (reuse the `inside` helper shape of the Amy test, tolerance 0.5px); the first row has exactly
  three children.
- A second loop, containment only, over `[[640,360,true],[667,375,true],[932,430,true]]`: for each of the three
  links `scrollWidth - clientWidth === 0` and the `inside` check holds. Equality is not asserted there.
- Accept (red): the test fails on main at 320x568 with the unequal-widths message. Paste the failing line in the PR
  body. Run it alone: `node --test --test-name-pattern '^TR-1' tests/e2e.test.js` (needs `CHROME_BIN`; if the lane
  shell has none, push and read CI, and say so).
- STOP: `MENU_VIEWPORTS` holds no cell where main is unequal: report, change nothing.

### TR-2: the CSS

- Change: the row's markup becomes `<div class="modebar trio">`. Add after the `.modebar.duo .mode` rule:
  `.modebar.trio .mode{padding-inline:4px}`, with a one-line comment in the style of the neighbouring ones (what
  the rule is for, no plan-step ids beyond what neighbours carry). Inside the sidebar media block add
  `.modebar.trio .mode{flex-basis:40%}` (measured: 93.5 / 93.5 / 199; without it the three sit on one unequal
  line). Update the HTML comment above the row so it stays true.
- Accept: TR-1 passes; the tests named `every row of the settings panel is flush`, `the two Amy links share one
  row`, `exactly one Resources group with its five outbound links in two rows` and `every button and link in the
  settings panel centres its label` pass (run each by `--test-name-pattern`); `python3 tools/validate.py` exits 0;
  `node tools/probe/panel_fit.js` behaves as on main if the lane can run it, otherwise CI's two `panel-fit` jobs
  decide. Measure and paste in the PR body the three widths and the panel `scrollHeight - clientHeight` at 320x568,
  844x390, 1024x700 and 1024x768, before and after.
- STOP A: TR-1 is unequal at a `MENU_VIEWPORTS` cell in CI (CI blocks web fonts, so the e2e run measures fallback
  metrics; 844x390 has about 2px of margin in real fonts) while equal in real fonts locally: do not widen the
  tolerance and do not change the rule. Report the cell and the three widths from the CI log and stop.
- STOP B: any panel cell scrolls more than on main, or a `panel-fit` job reddens: revert TR-2 and report.

### TR-3: mutants

Each patch has `# kills:` and `# suite:` headers in the style of `tests/mutants/mr_panel_mode_text_not_centred.patch`;
one `.` per character in the suite pattern, no quoting; no `index a..b` lines.

- `tr_trio_padding_default.patch`: removes the `padding-inline` rule. Killed by TR-1 (97.8 / 89.1 at 320x568).
- `tr_trio_class_dropped.patch`: the row's class goes back to `modebar`. Killed by TR-1.
- `tr_trio_sidebar_basis.patch`: removes the sidebar `flex-basis` rule. Killed by TR-1's [2,1] shape at 1024x700.
- Prove each kill locally with `git apply <patch>`, the suite line, `git apply -R <patch>`; paste the three results.
- Refresh stranded patches: commit TR-2 first (`tools/refresh_mutants.py` refuses a dirty tree), then
  `python3 tools/refresh_mutants.py --check`, then without `--check` if it reports any. Keep only the patches this
  diff stranded. Three were measured to strand, all refreshable (`e_panel_moved_into_header`, `qr_res_link_inert`,
  `qr_res_wrong_href`); the comment edit may add more. A refreshed patch must still die on its original test.
- FLOORS `"tests/e2e.test.js"` rises by one (263 to 264) and the README mutant count by the number of patches
  added (678 to 681). If CI's artifacts disagree with these figures, CI wins.
- Never edit the worktree while `tests/mutation_check.sh` runs; do not run it in full locally.

**Reviewer must check.**
1. TR-1 was committed before TR-2 and fails on the parent of the TR-2 commit for the stated reason.
2. No file outside Owns. The Amy row, link text, hrefs and order are byte-identical. No other panel row changed.
3. At the head SHA, by its own measurement with real fonts: the three links are equal at 320x568 and 844x390; the
   sidebar shows two equal links and `HTC` full width; no cell scrolls more than main; no label spills at 640x360,
   667x375 or 932x430.
4. Each new mutant dies on the named test for the stated reason; refreshed patches still die on their own tests.
5. CI `validate` is green at the head SHA, both `panel-fit` jobs included.

**PR body must also say:** the `CLAUDE.md` "Menu Resources" bullet describes only class `duo` and needs a `trio`
clause; `CLAUDE.md` is a non-goal here and the edit is owner-gated.

**Split size and cut.** About 5 lines of app code, one test, three patches. Nothing may be cut.

## 6. Eng review

Fresh agent, 2026-10-06: NOT_READY on the first draft (one blocker: `min-width:0` spilled HANDPANER in landscape),
ten findings, all folded in (D4, the mandatory sidebar rule, the mutant set, the TR-1 line shape and containment
loop, STOP A, the header exceptions, the refresh order, the strand list).
