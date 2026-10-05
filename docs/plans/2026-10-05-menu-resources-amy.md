# Amy Naylor videos in Resources, and flush menu rows

Status: DRAFT 2026-10-05, eng-reviewed (section 7a). Execution started 2026-10-05 (AD5).
Lane: `claude/menu-resources`, single serial lane, own worktree, base
origin/main `efb682c`. One lane because every change lands in `index.html`
and `tests/e2e.test.js`; there is no file-ownership boundary to split on.

## 0. Goal

1. The Resources group in the settings panel gains a second row with two
   outbound links to Amy Naylor's videos. The two links are equal width and
   together span the full row.
2. General rule, owner 2026-10-05: every button row in the menu spans the full
   width of its group (inside the panel's own padding). No row ends short with
   a ragged right edge.
3. The "Print this deck" row (FULL DECK PDF, CHORD-ONLY PDF, paper select) is
   the one row that breaks the rule today. Fix it.

## 1. Non-goals

- No new colour, typeface or label style (N15 holds). The new links are
  `a.mode`, same as the existing three.
- No change to what any control does. Resources links still do not close the
  panel; print buttons still do.
- No change to the Flash cards row, the tier row or `#deck-add` beyond what
  the flush assertion proves they already satisfy. The tier row stays
  `flex:1 1 auto` (content-weighted, guarded by mutant
  `uid_css_tier_equal_width`); "flush" is the rule, "equal" applies to
  `.modebar` rows only.
- The "Watch on YouTube" credit link under the tier row stays where it is.
- No engine, deck data, geometry or print-PDF change. No README change other
  than the mutant count.
- Nothing from the ideas list.
- No Amy label, tag or marking on any deck or card, in the app or in print
  (owner, 2026-10-05). Amy appears only as the two Resources links.

## 2. Current state (anchors, not line numbers)

- Markup: `#settings-panel` holds four `.panel-group` blocks. Resources is the
  last: one `.modebar` with `#res-handpaner`, `#res-dingandtones`,
  `#res-trainingcards`.
- `.modebar{display:flex; flex-wrap:wrap; gap:var(--sp-2)}` plus
  `.modebar .mode{flex:1 1 0}` already gives equal, flush rows. A second
  `.modebar` with two links needs no new CSS.
- `.prints{display:flex; flex-wrap:wrap; gap:var(--sp-2)}`; its buttons and
  select have no flex rule and `white-space:nowrap`, so they sit at natural
  width and the row ends short. Estimated natural widths at the 10.5px label
  size: about 117 + 124 + 72px plus two 8px gaps, about 329px. The group is
  292px wide at 320 and 208px in the desktop sidebar, so the row already
  wraps there; it fits on one line from about 360px up.
- `#settings-panel > .panel-group{width:min(420px, 100%)}`: above a 448px
  viewport the groups are a centred 420px column, not the viewport width.
- `panelStops()` lists the three Resources ids by name.
- `#deck-add` is a flex child of a column `.panel-group`, so it already
  stretches.

## 3. Design

### 3.1 Markup

A second `.modebar` inside the Resources group, after the existing one:

    <div class="modebar">
      <a class="mode" id="res-amy-progressions" href="https://youtu.be/-BD13QhFJ-M"
         target="_blank" rel="noopener"
         aria-label="Amy Naylor: ten handpan chord progressions (YouTube)">AMY: PROGRESSIONS</a>
      <a class="mode" id="res-amy-bottom" href="https://youtu.be/0hMIUnA5-OI"
         target="_blank" rel="noopener"
         aria-label="Amy Naylor: more interesting chords with bottom notes (YouTube)">AMY: BOTTOM NOTES</a>
    </div>

No `onclick`. Labels are a proposal (O2).

### 3.2 Tab trap

`panelStops()` selects the Resources links with one selector,
`#settings-panel a.mode[id^="res-"]`, in DOM order, so a sixth link later
needs no edit there.

### 3.3 Print row

    .prints button, .prints select{flex:1 1 auto}

`flex-wrap:wrap` stays. Each visual line then grows to the group's edges:
one flush line of three where it fits, and where it does not (320px, the
sidebar) the wrapped lines are each flush. The wrap points do not move
because the flex-basis is still the natural width, so the row's height at
320px and in the sidebar is unchanged. `flex:1 1 0` (equal thirds) is
rejected: at 292px each third is about 92px and CHORD-ONLY PDF needs about
124px.

### 3.4 Height budget (the main risk)

The panel has no spare height at its tightest sizes. The 2026-10-01 plan
chose one row of three links because stacked rows overflowed 320x568 by
18px; 320x568 mode S under real fonts fits with about nothing to spare; and
667x375 mode S already scrolls with "only the Resources links may be below
the fold". A second Resources row costs 44px plus one `--sp-2` gap.

Step 1 of the lane measures every cell of both fit tests (fallback fonts and
real fonts) with the row added, before any assertion is rewritten. Expected:
320x568 overflows in all three modes; the landscape grid cells and the
1024x700 sidebar depend on which column is tallest.

Proposed handling (O1): where a cell overflows, the panel scrolls
(`#settings-panel` is already `overflow-y:auto`) and the test asserts,
two-sided and per cell, the measured scroll amount within 1px and that
nothing but `res-*` links is below the fold. This is the existing 667x375
mode S precedent applied to more cells. Cells that still fit keep the plain
fit assertion.

## 4. Tests first

All in `tests/e2e.test.js`. Red before any `index.html` change.

- T1. `RESOURCES` gains the two entries; the count test becomes "two rows,
  three then two links", asserting ids, hrefs, labels, `target`, `rel`,
  `aria-label`, class and no underline for all five.
- T2. Flush rows. For each row container in the open panel (`.modebar` x3,
  `.tierbar`, `.prints`, `#deck-add`): group the visible controls by visual
  line (same `top` within 1px); on every line the first control's left edge
  and the last control's right edge match the parent group's content box
  within 0.5px. Run at 320x568, 380x700, 768x1024 and the 1024x700 sidebar,
  in modes A and S.
- T3. Equal split. In every `.modebar` line the controls' widths agree within
  0.5px, at 380x700 and 768x1024. The Amy row is exactly two controls on one
  line at 320, 380 and 768.
- T4. Fit tests updated per section 3.4 from step 1's measurements. The
  `resIds` presence check lists all five ids. The real-font cells
  (`panelOverflow`) get the same treatment; real-font numbers are measured
  with real fonts, never inferred from the fallback run.
- T5. The Tab-trap test expects five Resources stops after the print
  controls, in DOM order. The "activate on click and Enter without closing
  the panel" test iterates all five.
- T6. No control in the panel is under 44px tall or off-screen horizontally
  (existing `short` and `scrollW` checks, now covering the new row).
- Mutants (`tests/mutants/`, no `index a..b` lines, `# suite:` patterns with
  `.` wildcards):
  - `mr_prints_natural_width`: drops the `.prints` flex rule. Killed by T2.
  - `mr_amy_row_missing`: removes the second `.modebar`. Killed by T1.
  - `mr_amy_link_closes_panel`: adds `onclick="closePanel()"` to one new
    link. Killed by T5.
  - `mr_amy_wrong_href`: swaps the two hrefs. Killed by T1.
  - `mr_stops_omit_amy`: restores the three-id selector in `panelStops()`.
    Killed by T5.
  - Refresh any existing mutant whose context covers the Resources markup or
    `panelStops()` (`qr_res_*`, `e_panel_moved_into_header`).

## 5. Steps

1. Measure: add the row in a scratch copy and record scroll/overflow for
   every fit-test cell, fallback and real fonts. Write the numbers into
   section 8 of this file.
2. Write T1 to T6 and the mutants; commit red.
3. `index.html`: markup, the `.prints` rule, `panelStops()`.
4. CLAUDE.md "Design system": one bullet recording the flush-row rule and
   that `.modebar` rows are equal-split.
5. Push, open the PR, wait for CI at the head SHA. Then set the
   `tests/e2e.test.js` FLOORS row and the README mutant count from CI's
   artifacts in a follow-up commit.

## 6. Ownership, acceptance, gates

- Owns: `index.html` app markup, CSS and app JS outside the engine regions
  and the `const DECKS` line; `tests/e2e.test.js`; `tests/mutants/`;
  `tests/suite_health.py` FLOORS; README mutant count; CLAUDE.md (step 4
  only); this file.
- Acceptance:
  1. Five Resources links in two rows; the second row is two equal links
     spanning the group.
  2. T2 passes: every menu row is flush at all four sizes.
  3. The print row is one flush line at 380x700 and flush per line where it
     wraps.
  4. Every fit cell either fits or scrolls by its measured amount with only
     `res-*` links below the fold, under fallback and real fonts.
  5. All new mutants are killed; no existing mutant goes stale.
- Verify (local smoke test; CI at the head SHA is the evidence):

      python3 tools/validate.py && python3 tools/inline_engine.py --check \
        && node --test tests/app.test.js && bash tests/mutation_check.sh

  Single e2e tests may be run locally with `CHROME_BIN`; the full e2e suite
  runs in CI only.
- Merge gates: CI green at a head SHA equal to the local tip; a fresh
  reviewer subagent returns PASS or PASS_WITH_NITS at that SHA; merge with
  `gh pr merge <n> --merge`.

## 7. Open decisions for the owner

- O1. Height. Recommended: let the panel scroll at the sizes where the new
  row no longer fits, Resources links only below the fold. The alternative
  that keeps "no scroll" at 320x568 is to give up the extra row and put the
  two links elsewhere, which contradicts the request.
- O2. Labels. Proposed `AMY: PROGRESSIONS` and `AMY: BOTTOM NOTES`, full
  titles in `aria-label`. At 320px each link is 142px wide, room for about 16
  characters on one line; longer labels wrap to two lines and raise the row.
- O3. The 420px group cap. "Whole width of the viewport" is read here as the
  whole width of the group, which is the viewport minus padding on phones up
  to 448px. Recommended: keep the cap, so a 768px tablet shows a centred
  420px column of flush rows instead of 740px-wide buttons. Removing the cap
  is a one-line change if wanted.

## 8. Execution notes

### Lane stopped after step 1 (2026-10-05): two stop conditions, owner decision needed

Step 1 measured with the section 3.1 row, the section 3.3 rule and the 3.2
selector applied in a scratch worktree (`git worktree add --detach`), through
`window.__pf.one` (`tools/probe/panel_fit.js`), macOS, fallback and real
fonts, 80 viewports x modes A/B/S x both roots (main vs candidate). Nothing in
`index.html` or `tests/` was changed on the branch.

**Stop 1 (C2/O2): the Amy labels are not one line at 320px.** At 320x568 each
Amy link is 142px wide with a 140px client box; `AMY: PROGRESSIONS` is about
127px of text plus the `.mode` padding, so both labels wrap to two lines inside
the 44px box (Range rects = 2) in fallback and real fonts. The row height does
not grow (44px) but the label is two lines. They are one line at 380x700
(172px links) and at 768x1024 (204px links), in both font modes. In the
1024x700 sidebar (stacked in the first measurement; AD7 put them on one row with
class `duo`, see the re-measured section) they wrap to two or three lines. In the 844x390
landscape cell they wrap to two lines (131.7px links). The two links are equal
width wherever they share a line (142/142 at 320, 172/172 at 380, 204/204 at
768, 131.66/131.67 at 844x390 landscape); `min-width:0` was not needed.

**Stop 2 (O1 vs the CI panel-fit gate): `.github/workflows/validate.yml` job
`panel-fit` fails by design.** That job runs `node tools/probe/panel_fit.js
--base origin/main` and its rule 1 fails any cell where the candidate needs
more than max(main needed, available) + 1px, and rule 3 fails a new control
that renders below the fold where main fits. O1 chooses to let the panel
scroll, so both rules fire. Run locally against this branch's tip (fallback
fonts): `rule 3 new control: 3890 failing`, failing width ranges in every
height band (h320, h521, h700), `panel fit: FAIL`. The oracle does not
hard-code the Resources row, so this is not a C1 `tools/probe/` case; it is a
policy conflict between O1 and a merge-blocking CI job that this lane does not
own. Options for the owner: (a) allow the oracle an explicit Amy-row
allowance (a judge parameter like `HEADING_ALLOWANCE_PX`), (b) drop O1 and fit
the row without scrolling (not achievable at 320x568 S, 1024x700 and the
landscape cells below), (c) accept the red job.

**The 1024x700 sidebar (re-measured under AD7, replacing the earlier 106px
figure).** With class `duo` the two Amy links share one row in the 208px
sidebar group, so Resources grows by 60.375px (one row, gap and the
two-to-three-line label height), against 47-48px in the phone and landscape
cells. Each Amy link is 93.5px wide there, equal width, with 2- and 3-line
labels that stay inside their boxes. The 106px figure belonged to the
stacked layout that AD7 removed; the tables below carry the AD7 numbers.
Modes A and B now scroll only at 1024x700 (+3 fallback, +8 real) and mode S
scrolls at the sidebar heights up to 800 (12-69 fallback, 17-74 real).

**C2 check.** Newly scrolling cells (main over <= 1, candidate over > 1): 95
(cell x mode x font) across the 80 viewports. In none of them is a control
other than a `res-*` link below the fold. Cells that already scrolled on main keep their scroll where the
tallest grid column does not contain the Resources group (568x312 A, 568x320,
427x320, 427x375) and gain the group's growth where it does (667x375 S,
740x340 S real, 812x330 S real).

**Print row natural widths** (button, button, select), measured on main at
380x700: fallback 118.36 + 130.37 + 72.00, real 113.89 + 128.63 + 68.00 (plus
two 8px gaps = about 320px, so one line at 380 and wrapping at 320 and in the
sidebar, as the plan estimated). With `flex:1 1 auto` the row is flush: at
380x700 one line spanning 14 to 366; at 320x568 two lines (two buttons, then
the select) each spanning 14 to 306; in the sidebar three lines each spanning
805 to 1004; at 768x1024 one line 174 to 594; at 844x390 two lines. The group
content box edges equal the first/last control edges to 0.01px in all of them.

**Fit cells the tests assert that change** (main over -> candidate over, px;
cells not listed keep the same scroll as on main, which is 0 except where the
section 3.4 precedent already scrolled). Needed/group deltas for every cell
are in the scratch measurements; every row below leaves only `res-*` links
below the fold, except the rows that already scrolled on main.

fallback fonts (macOS), cells the fit tests assert; over = scrollHeight - clientHeight:

| cell | mode | main over | now over | needed delta | below the fold now |
|---|---|---|---|---|---|
| 320x568 | S | 0 | 39 | +48 | res-amy-progressions, res-amy-bottom |
| 667x375 | A | 0 | 3 | +47 | - |
| 667x375 | B | 0 | 3 | +47 | - |
| 667x375 | S | 19 | 66 | +47 | res-trainingcards, res-amy-progressions, res-amy-bottom |
| 1024x700 | A | 0 | 3 | +60.375 | - |
| 1024x700 | B | 0 | 3 | +60.375 | - |
| 1024x700 | S | 9 | 69 | +60.375 | res-amy-progressions, res-amy-bottom |
| 1024x746 | A | 0 | 0 | +60.375 | - |
| 1024x746 | S | 0 | 23 | +60.375 | - |
| 1024x750 | S | 0 | 19 | +60.375 | - |
| 1024x757 | S | 0 | 12 | +60.375 | - |
| 1280x746 | S | 0 | 23 | +60.375 | - |
| 740x360 | S | 0 | 18 | +47 | res-amy-progressions, res-amy-bottom |
| 740x340 | S | 0 | 38 | +47 | res-amy-progressions, res-amy-bottom |
| 812x330 | S | 0 | 45 | +47 | res-amy-progressions, res-amy-bottom |

real fonts (macOS), cells the fit tests assert; over = scrollHeight - clientHeight:

| cell | mode | main over | now over | needed delta | below the fold now |
|---|---|---|---|---|---|
| 320x568 | S | 0 | 44 | +48 | res-amy-progressions, res-amy-bottom |
| 667x375 | A | 0 | 6 | +47 | - |
| 667x375 | B | 0 | 6 | +47 | - |
| 667x375 | S | 22 | 69 | +47 | res-trainingcards, res-amy-progressions, res-amy-bottom |
| 1024x700 | A | 0 | 8 | +60.375 | - |
| 1024x700 | B | 0 | 8 | +60.375 | - |
| 1024x700 | S | 14 | 74 | +60.375 | res-amy-progressions, res-amy-bottom |
| 1024x746 | A | 0 | 0 | +60.375 | - |
| 1024x746 | S | 0 | 28 | +60.375 | - |
| 1024x750 | S | 0 | 24 | +60.375 | - |
| 1024x757 | S | 0 | 17 | +60.375 | - |
| 1280x746 | S | 0 | 28 | +60.375 | - |
| 740x360 | S | 0 | 36 | +47 | res-amy-progressions, res-amy-bottom |
| 740x340 | S | 9 | 56 | +47 | res-amy-progressions, res-amy-bottom |
| 812x330 | S | 1 | 48 | +47 | res-amy-progressions, res-amy-bottom |

Not run: the Linux fallback-font numbers (CI runner), so the `fallback-linux`
rows of the T-EDGE tables would be derived from CI messages, not measured here.

## 7a. Eng review amendments (2026-10-05, /plan-eng-review)

Binding on the lane. Where an amendment and sections 3-6 disagree, the
amendment wins.

- E1 (tests, P1). T1/T4/T5 undercount the hard-coded three-id sites in
  `tests/e2e.test.js`. Every one of these must move to five ids, in DOM
  order, in the red commit: the Tab-reach loop under "Eng review amendment
  1"; the fit test's `resIds` deepStrictEqual and its `res-` offscreen
  filter; the `RESOURCES` const and its count test; the three further
  `resIds` blocks in the landscape, sidebar and "746" fit cells; the
  `a[id^='res-']` click capture; the selector list ending
  `#res-trainingcards`; `panelOverflow`'s `resIds`; and the expected
  Tab-order array ending `"res-trainingcards"`. Step 2 starts with
  `grep -n "res-" tests/e2e.test.js` and the commit message states the count
  of sites changed. Prefer deriving the lists from `RESOURCES` over five more
  literals.
- E2 (mutants, P1). The refresh list is wider than `qr_res_*` and
  `e_panel_moved_into_header`. Thirteen patches touch these anchors:
  `e_a11y_both_faces_exposed`, `e_panel_moved_into_header`,
  `e_menu_keys_leak_to_card`, `ms_js_breakpoint_drift`, `qr_res_link_inert`,
  `qr_res_wrong_href`, `qr_res_link_not_a_stop`, `qr_res_no_noopener`,
  `sqe_link_stop_when_hidden`, `u_ding_octave_dropped`,
  `u_inner_mark_unprinted`, `u_bar_dropped`, `uid_panelstops_misses_tier`.
  Run `git apply --check` on all thirteen after step 3. `qr_res_link_not_a_stop`
  removes ids from `panelStops()` by name; with the 3.2 selector it must be
  rewritten against the selector and still die for the right reason
  (memory: hand-regenerated mutants drift).
- E3 (design, P2). The `panelStops()` selector in 3.2 must not pick up
  `#seq-source-link` (it is `a` but not `.mode` and has no `res-` id; it is
  already listed by id earlier in the stop order). T5 asserts it appears
  exactly once.
- E4 (docs, P2). The HTML comments above the Resources group say "three
  outbound links" and "Plan risk 'no scroll budget', fallback 1". Step 3
  rewrites both to describe two rows and the O1 outcome. No new comment
  elsewhere.
- E5 (design, P2, closed by reading). Could the print row re-divide while a
  PDF builds? No: `downloadDeckPDF` only toggles `disabled` on the row's
  buttons (opacity .5) and never changes a label, so widths under
  `flex:1 1 auto` do not move. T2 additionally asserts the row is still
  flush with both buttons `disabled`.
- E6 (tests, P2). T2's 0.5px tolerance is applied to
  `getBoundingClientRect()` against the parent's content box (client box
  minus computed padding), not `offsetWidth`, so fractional flex widths do
  not flake. T2 skips `hidden` controls and rows with zero rendered controls.
- E7 (tests, P2, superseded in part by C4). Real fonts. CI blocks web fonts, so a green T2/T3/T4 says
  nothing about Marcellus/Nunito Sans metrics. The existing real-font cells
  (`panelOverflow`) are the only real-font evidence; the lane adds the Amy
  row's "two controls on one line at 320" assertion there as well, because a
  wider real-font `AMY: BOTTOM NOTES` wrapping to two lines is the realistic
  failure.
- E8 (scope, P3). Section 2's widths (117/124/72, 329px) are estimates.
  Step 1 replaces them with measured values in section 8; no assertion is
  written from an estimate.
- E9 (scope, P3). `.modebar` keeps `justify-content:center`; it is inert
  under `flex:1 1 0` and is not touched.

Outside voice (Codex, read-only, 2026-10-05). Four findings, the two P1s
checked against the code and confirmed. All four are accepted:

- C1 (tests, P1, confirmed). The T-EDGE tests (`edgeTest` with the
  `MAIN_NEEDED_*` and `MAIN_GROUPS_*` tables, portrait, landscape and
  sidebar) assert that panel groups 1-3 keep main's heights within 0.5px.
  The Resources group grows by one row, so every cell fails regardless of
  T4. Step 1 measures the new group heights and needed heights for every
  cell and font mode through the same measuring function (`window.__pf`,
  `tools/probe/panel_fit.js`); step 2 updates the tables in the red commit.
  If the oracle itself hard-codes the Resources row, `tools/probe/` joins
  the lane's ownership.
- C2 (design, P1, confirmed). O1's contract "nothing but `res-*` below the
  fold" is false for cells that already scroll: the real-font bounce-5 cases
  (740x340 S, 568x312 A) scroll today with other controls below the fold and
  assert "every control reachable by scrolling". O1 is restated: a cell that
  scrolled on main keeps its existing reachability assertion with the new
  measured amount; a cell that newly scrolls asserts the measured amount
  within 1px and that only `res-*` links are below the fold. Step 1 lists
  which cells are which. If a newly scrolling cell pushes a non-Resources
  control below the fold, the lane stops for the owner.
- C3 (tests, P2). `flex:1 1 0` still honours each link's automatic minimum
  width, so `AMY: PROGRESSIONS` can hold its link wider than its sibling in
  the 208px sidebar. T3's equal-width check also runs at 320x568, the
  1024x700 sidebar and one landscape cell, fallback and real fonts. If it
  fails, the fix is `min-width:0` on `.modebar .mode`, which is in scope.
- C4 (tests, P2). E7's "two controls on one line" does not detect a label
  that wraps inside its 44px box. E7 is replaced: each Amy link's text is a
  single line (one client rect from a Range over its text node), asserted in
  the real-font cells at 320 and in the sidebar. If the sidebar cannot hold
  either label on one line, that is an O2 input for the owner, not a lane
  decision.

Auto-decisions taken under AFK (owner may reverse any of them):

- AD1. gstack upgrade prompt (1.87.6.0 to 1.91.25.0): "Not now", snoozed 24h.
- AD2. `/office-hours` design-doc prerequisite: skipped, the request is a
  bounded UI change with stated acceptance.
- AD3. Outside voice (Codex): run automatically as the review's standard step; findings C1-C4 accepted because each is a factual gap, none changes scope.
- AD4. Scope: accepted as drafted, one serial lane. No reduction offered;
  the three goals share two files.
- AD5. Owner said "Continue" on 2026-10-05 after reading the plan summary
  and its three open decisions. Read as the go to execute. O1, O2 and O3
  take their recommended options under AFK: O1 the panel may scroll per C2;
  O2 labels `AMY: PROGRESSIONS` and `AMY: BOTTOM NOTES`; O3 the 420px cap
  stays. All three are reversible in a follow-up PR.

- AD6. HOLD, 2026-10-05. The lane stopped after step 1 (section 8). Two
  findings need the owner and are not auto-decided: both Amy labels wrap to
  two lines at 320px, and the merge-blocking `panel-fit` CI job fails under
  O1 (its rule 3 rejects a new control below the fold). Passing it means
  either changing that oracle, which is outside the lane's ownership and
  loosens a merge gate, or dropping the row. Section 8 also shows the
  sidebar stacks the two links, costing 106px instead of the estimated 52.
  Conservative branch taken: no code change, no PR, wait for the owner.

- AD7. RESUMED, 2026-10-05. The owner answered an interview after AD6.
  These are owner decisions, not auto-decisions, and they supersede AD6,
  the section 5 ownership list and the "no new CSS rule" limit:
  - Row vs CI: keep the new row. The `panel-fit` oracle gets a narrow
    allowance for `res-*` links only, modelled on its existing
    `HEADING_ALLOWANCE_PX`. Lane ownership extends to `tools/probe/` and
    its tests for that allowance alone. Every non-Resources control must
    still pass rules 1 and 3 unchanged.
  - Labels: `AMY: PROGRESSIONS` and `AMY: BOTTOM NOTES` stay. A two-line
    wrap is accepted wherever it happens. C4's single-line assertion is
    dropped; assert instead that the label text stays inside its link box.
  - Sidebar: the two Amy links share one row there too. This needs a
    scoped rule on the Amy row only (a `duo` class on that `.modebar`:
    `flex-wrap:nowrap`, and on its `.mode` children `min-width:0`, centred
    text, a line-height that suits wrapped labels, `padding-inline:6px`).
    No other row changes. A throwaway build with this rule measured the
    sidebar row at 54px tall with two links of 94px, and one-line labels
    at 320 and 380. The lane re-measures; section 8's sidebar numbers
    (106px) predate this rule.
  - Play-test page: the "Amy's ten on this pan" block stays.

- AD8. Owner instruction, 2026-10-05, after seeing screenshots of the PR
  build: "All buttons should center text. Letter for example is not
  centered." Every control in `#settings-panel` centres its label, on one
  line or wrapped: the `.mode` buttons and links (a wrapped label such as
  DING & TONES at 320 is left-aligned today), the `.prints` buttons, and
  the paper `select`, whose shown value must be centred too. In scope for
  this lane and this PR. No size, colour, typeface or row-height change.

NOT in scope: the 420px cap (O3) unless the owner says so; select text
alignment in the widened paper select; the tier row's content weighting;
any `TODOS.md` item (none concerns the menu).

What already exists: `.modebar .mode{flex:1 1 0}` (equal flush rows, no new
CSS for the Amy row); the 667x375 mode S "only Resources below the fold"
assertion (the O1 pattern); `qr_res_*` mutants (templates for `mr_amy_*`);
`panelOverflow` (real-font measurement).

Failure modes:

| failure | test | handled | visible |
|---|---|---|---|
| Amy label wraps to two lines under real fonts, row grows 44px+ | E7 | assertion | yes, taller row |
| panel overflows a cell and a non-Resources control drops below the fold | T4 | assertion | yes |
| new links missing from the Tab trap, focus escapes the panel | T5, `mr_stops_omit_amy` | assertion | keyboard users |
| print row re-divides while a PDF builds | T2 disabled-state assertion | cannot happen today (E5) | would be visible |
| stale mutant applies to nothing and "survives" | mutation gate in CI | E2 | CI red |

No row is both untested and silent.

Parallelization: none. One lane, two files.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 1 | ISSUES RESOLVED IN PLAN | 9 findings (2 P1, 5 P2, 2 P3), folded in as E1-E9; 0 critical gaps |
| Outside Voice | Codex | Independent second opinion | 1 | ISSUES RESOLVED IN PLAN | 4 findings (2 P1, 2 P2), folded in as C1-C4 |
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | not run | not needed for a bounded UI change |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | optional; O2 labels and O3 cap are the design calls |

UNRESOLVED: none. O1-O3 and the step-1 findings settled by the owner (AD7).
VERDICT: eng review cleared, execution resumed 2026-10-05.
