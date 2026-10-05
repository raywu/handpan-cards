# Amy Naylor videos in Resources, and flush menu rows

Status: DRAFT 2026-10-05. Not started. Execution waits for the owner's go.
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

(empty until the lane runs)
