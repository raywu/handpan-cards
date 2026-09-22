# Stop declaring the page box: the iOS print page-fit fix, attempt 3

**Goal.** A custom deck's two print options produce a sheet whose every card
border is complete on all four sides, on iPhone 14 / iOS 26.6, at the card's
spec size (177.6 x 247.2 pt), with no further device round trip needed to
discover a geometry constant.

**Non-goals.** Changing deck data or diagram geometry. Changing the built-in
decks' reportlab PDFs. Fixing the suspected 2-3% card oversize (TODOS.md).
Making the A4/Letter control work on iOS (TODOS.md).

## What the device run at 11:05 PM proved

The rotation SHIPPED and WORKED. Screenshot 3 shows 2 columns x 3 rows of
cards whose content is sideways - that is `rotate(-90deg)` on a 3x2 grid,
exactly as designed. The sheet is not too wide any more.

It still clipped at the BOTTOM. The cause is one line:

    index.html:4224   `#printroot .printpage{height:${p.h}pt}`

`p.h` is `PRINT_PAPER.letter.h` = 792, the PAPER height. On a platform that
honours `@page{margin:0}` the paper height and the printable height are the
same number, which is why this was invisible on desktop Chrome. On iOS they
are not, and this is the SAME class of error as the `@page` assumption killed
in attempt 2: asserting a platform-owned quantity as a CSS literal.

Arithmetic, using the printable box measured from the 9/21 screenshot
(531.6 x 711.6 pt) and the footer band iOS draws inside it (~50pt, visible in
screenshot 3 as the URL / date / "Page 1 of 10" line):

| quantity | value |
|---|---|
| `.printpage` height as emitted | 792.0 pt |
| sheet centre, flex-centred in it | 396.0 pt from the top |
| rotated sheet height (3 x CW) | 532.8 pt |
| sheet spans | 129.6 .. 662.4 pt |
| iOS usable height above its footer | ~661.6 pt |
| **overflow** | **~0.8 pt at the bottom** |

## What the PR #106 reviewer measured, which supersedes the arithmetic above

The reviewer rendered the shipped stylesheet in Chrome under
`Emulation.setEmulatedMedia{media:"print"}` with `@page{margin:0}` stripped and
`Page.printToPDF` margins set to the measured 40.2pt/side - a faithful stand-in
for a platform that ignores the at-rule. Three results reframe this plan:

1. **The rotation works.** Ink bbox on every content page `x 59..553,
   y 169..701` of 612 x 792: 58.8pt of clearance against a 40.2pt enforced
   margin. Card pitch measured 177.5 / 177.0 / 177.5pt across the rotated rows,
   columns split at 247.2 - the spec size is preserved exactly.
2. **The parent commit reproduces the owner's clip.** At `39db0e3`, ink lands at
   `x 39..571` - 39.6pt from each edge, INSIDE the 40.2pt margin. Rotation is
   demonstrably what fixed the horizontal axis.
3. **The 1.2pt layout-box overflow is harmless.** `.printsheet`'s untransformed
   box is 710 x 659 CSS px; after the transform its bounding rect is
   659.19 x 710.39 px and its centre is exact on both axes in a 709 x 1056 page.
   The overflow does not shift the centre and does not clip. No out-of-flow
   positioning is needed, and adding it would be complexity buying nothing.

**And it found the real mechanism, as nit R5.** Both renders produced EIGHT PDF
pages for FOUR sheets, every odd page blank - deterministic, and present at
`39db0e3` too, so pre-existing rather than a regression. That doubling is the
"Page 1 of 10" in the owner's screenshot: 25 cards at 6 per sheet is 5 sheets,
printed as 10 pages.

So the bottom clip is not a margin clip. `.printpage` is a 792pt block in a
~660pt printable box, so every sheet PAGINATES ACROSS A BREAK. Chrome, with the
sheet centred and nothing below it, emits a blank continuation page. iOS emits
the sliced-off remainder, which is exactly what screenshot 2's page-2 thumbnail
shows - card bottoms sitting at the top of the page.

One line, two symptoms: the owner's bottom clip, and double the paper.

## The fix

**Never emit a page-box dimension. Emit the LAYOUT's own footprint.**

`.printpage` stops carrying a paper height and carries a `min-height` derived
from the sheet it contains. The platform's page box then supplies whatever
height it actually has, the sheet sits at the top of it, and no clipping is
possible on either axis because the sheet is strictly smaller than the
smallest printable box we have measured.

    narrow, rotated:  494.4 pt wide x 532.8 pt tall
    iOS printable:    531.6 pt wide x ~661.6 pt usable
    slack:            37.2 pt wide, ~128.8 pt tall

The horizontal slack is the rotation's doing (attempt 2). The vertical slack
is this fix's doing. Both axes now clear by more than a rounding error, which
is the property attempts 1 and 2 never had.

### Changes

1. `printGridCSS()` drops `#printroot .printpage{height:${p.h}pt}` and emits
   `#printroot .printpage{min-height:${footprint}pt}`, where `footprint` is
   the sheet's own height AFTER rotation:

       const w = L.cols * g.CW + (L.cols - 1) * L.gx;
       const h = L.rows * g.CH + (L.rows - 1) * L.gy;
       const footprint = L.rotate ? w : h;

   For `narrow` that is 532.8. For `wide` it is 3 * 247.2 + 2 * 9.4 = 760.4.

2. `PRINT_PAPER`'s `h` key becomes unused by the stylesheet. It stays on the
   object only if `@page{size:...}` still needs it; it does not - `css` is the
   size keyword. **Delete the `h` key** so no page-box literal survives
   anywhere in the print CSS path. That is the invariant the test pins.

3. The rotated sheet overflows its own layout box, because `transform` does
   not reflow. The grid's layout box is 532.8 wide x 494.4 tall; rotated about
   its centre it presents 494.4 x 532.8 about that same centre, sticking out
   19.2pt above and below its box. `min-height` on the flex-centred
   `.printpage` is what absorbs that: at 532.8pt the page box is exactly the
   rotated footprint and the overflow lands inside it, not outside the page.
   This is why the footprint must be the ROTATED height and not the grid's.

   **Auto-decision D1 (AFK, 2026-09-22): the sheet stays IN FLOW.** The
   alternative considered was taking it out of flow -
   `position:absolute; left:50%; top:50%;
   transform:translate(-50%,-50%) rotate(-90deg)` - so its layout footprint
   became zero and the 1.2pt horizontal overflow of the untransformed box
   disappeared. Rejected on the reviewer's measurement: the transformed
   bounding rect centres at exactly `(354.51, 528)` in a 709 x 1056 px page,
   so the overflow shifts nothing and clips nothing. Out-of-flow would trade a
   measured zero for two new risks - the `position:absolute` clipping at page
   breaks that `index.html:751-756` already documents for `.printscale`, and a
   containing-block change under a flex parent. Keep the simpler form; the
   rejected option is recorded here in case a future platform disagrees.

## Why not the alternatives

**2x2 portrait at spec size** (the attempt-2 fallback). 355.2 x 494.4 - fits
with enormous slack, needs no rotation, and is the most robust option on the
board. Rejected as the primary because it reverses the owner's ratified
"3 cols x 2 rows" and takes the full deck from 10 pages to ~15. It remains the
fallback if this attempt fails on device, and at that point the page count is
the cheaper thing to give up.

**Fluid card size (percentage or `vh`-driven grid).** Blocked by
`.printscale`. That element scales a fixed-pixel design down to the card's
physical size with `transform:scale(k)`, and `k` is a JS-computed unitless
constant. CSS `calc()` cannot divide a length by a length to produce a
unitless ratio, so a card whose size is decided by the layout engine cannot
have its face scaled to match. Making the card fluid means rewriting the face
to size itself from container queries - a large change to shared code for a
defect that is one literal.

**Shrinking the card below spec** (e.g. 3x2 at 88%). Fits, keeps the page
count, and permanently breaks the print-shop output's poker-size guarantee -
the one property that cannot be fixed after the paper is cut.

## Tasks

**Task 1 - the oracle, written to fail first.** In `tests/app.test.js`:

- `"the print stylesheet never states a page-box dimension"` - assert
  `printGridCSS(name, paper)` output contains no `792`, no `841.89`, and no
  `.printpage{height:` for every (name, paper) pair. This is the invariant;
  it is what would have caught attempt 2 before the device run.
- `"each layout reserves its own rotated footprint"` - assert the emitted
  `min-height` equals 532.8 for `narrow` and 760.4 for `wide`, computed from
  `PRINT_GEOM` in the test rather than hardcoded, so a geometry change moves
  both sides together.
- `"the reserved footprint fits the measured iOS printable box"` - for every
  `constrained` layout, assert footprint <= `PRINT_SAFE.usableH` and rotated
  width <= `g.PW - 2 * PRINT_SAFE.margin`.
- `PRINT_SAFE` gains `usableH: 660`, carrying the footer-band measurement with
  its derivation in the comment, the same way `margin: 45` carries the side
  measurement.

**Task 2 - implement.** The three changes above.

**Task 2b - close the two reviewer nits the fix touches.**

- **R1:** `constrained: true` on `PRINT_LAYOUTS.narrow` has no pin. Removing it
  passes 163/163, because `if (!L.constrained) continue;` then skips every
  layout and the fit loop asserts nothing while reporting green. This is the
  N1/N2 class one level up - the flag that selects WHICH layouts get checked is
  itself unguarded. Pin it by value beside the gutter pins AND assert the loop
  body ran at least once.
- **R2:** the iPadOS-desktop-UA branch of `isIOS()` is untested, and it is the
  branch a real iPad hits - "Request Desktop Website" is the iPadOS default, so
  a Macintosh UA with `maxTouchPoints > 1` is the live path. Collapsing the
  return to `/iPad|iPhone|iPod/.test(s)` passes 163/163. If it regressed, an
  iPad falls through to `w >= 640` and gets the 557.2 x 760.4pt sheet that
  misses on both axes. Add one `boot({ userAgent: <Macintosh>, maxTouchPoints: 5 })`
  test. The `typeof navigator !== "undefined"` guard means there is no
  ReferenceError risk; this is purely a coverage gap.

**Task 3 - mutants.** Four patches, each killed by a named test:
`p_print_page_height_restored.patch` (re-emit `height:792pt`),
`p_print_footprint_unrotated.patch` (use `h` not `w` for a rotated layout),
`p_print_usable_height_overstated.patch` (`usableH` 660 -> 711.6),
`p_print_min_height_dropped.patch` (emit no reservation at all).
Plus two from Task 2b: `p_print_constrained_flag_dropped.patch` and
`p_print_ios_ipad_desktop_ua_dropped.patch`. Both are confirmed survivors today
- the reviewer ran them - so both are known-good mutants before they are
written.

**Task 4 - ship.** Commit, push, CI green at the head SHA, raise the app floor
from CI's own reported count in a second commit, fresh reviewer at that SHA.

**Task 5 - device run (B7).** Runs A (Full deck PDF), B (Print shop version),
C (Share -> Print with no CTA pressed shows the app page). Acceptance: every
card border complete on all four sides, no clipped glyph. Plus the ruler
check, expecting 62.65 x 87.21 mm.

## Failure modes

| if | then |
|---|---|
| still clips at the bottom | the footer band is bigger than 50pt; switch to 2x2 portrait rather than re-measuring - that is the two-round-trip budget spent |
| clips at the sides | the rotation is not presenting the rotated footprint to the paginator; 2x2 portrait, same reason |
| the page count does not halve | the doubling has a second cause beyond the 792pt block; file it, do not chase it - the clip is the acceptance criterion |
| cards measure over 62.65mm | separate defect, already filed in TODOS.md, not a reason to re-open this |
| desktop Chrome output changes | expected: the sheet top-aligns in the page box instead of centring. Cosmetic, and only on the custom-deck browser path - the built-in reportlab PDFs are untouched |

## Carried, not fixed

- **R3:** `PRINT_SAFE` is a production constant with no production reader - a
  test oracle living in the shipped single-file artifact, the same shape as
  `printSlots()`. `usableH` adds to it. Queue row, not this plan.
- **R4:** the fit test never involves `PRINT_PAPER`. Rendered, A4 geometry on
  Letter paper drops bottom clearance from 91pt to 65pt - still clear, so no
  defect, but nothing records that the bottom axis is paper-size dependent.
- **N4 / queue row 140:** `printSlots()` and `tests/test_render_agreement.py:531`
  still model `narrow` as 557.2pt wide and unrotated. This plan does NOT close
  that and must not be read as covering it.
- **Zero rendered coverage of the narrow layout.** `tests/e2e.test.js:1219` is
  the only rendered print test; it runs wide, with a desktop UA and
  `preferCSSPageSize: true`, so it honours `@page{margin:0}` and cannot
  reproduce an enforced margin. Its probe also filters
  `170 <= rect.width <= 185`, which a rotated card frame at 247.2pt would never
  match. CI has no WebKit at all.

## Self-review

Three weaknesses worth naming.

1. **`usableH: 660` is one measurement from one device, read off a
   screenshot.** It is a test oracle, not a runtime constant, so a wrong value
   makes the test wrong rather than the output wrong - the shipped layout only
   needs the footprint to be small, and 532.8 clears even a pessimistic 600.
2. **No rendered coverage of the narrow layout.** The e2e suite exercises
   `wide`. Every claim here about what iOS draws rests on arithmetic and one
   screenshot. The device run is the only real check, which is why the
   failure-mode table commits to the fallback instead of another iteration.
3. **Attempt 2 also looked airtight.** The difference is that its failure
   surface was a guessed constant, and this one removes a constant rather than
   replacing it. That is a real improvement in kind, but it is not proof.

## GSTACK REVIEW REPORT

### Runs

| # | Reviewer | Target | Result |
|---|---|---|---|
| 1 | fresh subagent, PR #106 @ `fa0156b` | shipped attempt-2 stylesheet, rendered | PASS_WITH_NITS |
| 2 | /plan-eng-review, this plan | attempt-3 plan | see Findings |

### Status

CI at `fa0156b`: all five required checks `completed/success` at that exact
head SHA (`data integrity`, `python suites`, `js suites (unit + e2e)`,
`suite health`, `mutation gate`).

### Findings

| id | Finding | Disposition |
|---|---|---|
| I1 | Rotated sheet's untransformed box overflows by 1.2pt | CLOSED - measured benign; centre exact on both axes. Auto-decision D1 keeps it in flow |
| R1 | `constrained: true` unpinned; dropping it passes 163/163 because the fit loop then skips every layout | IN SCOPE - Task 2b, plus mutant `p_print_constrained_flag_dropped.patch` |
| R2 | `isIOS()` iPadOS-desktop-UA branch untested; it is the branch a real iPad hits | IN SCOPE - Task 2b, plus mutant `p_print_ios_ipad_desktop_ua_dropped.patch` |
| R5 | 8 PDF pages for 4 sheets, every odd page blank, present at the parent commit too | IN SCOPE - this is the defect, not a side note. It is the same 792pt block, and the fix targets it directly |
| R3 | `PRINT_SAFE` is a production constant with no production reader | CARRIED - queue row |
| R4 | A4 on a margin-enforcing platform unmodelled; clearance 91pt to 65pt, still clear | CARRIED - queue row |
| N4 | `printSlots()` and `test_render_agreement.py:531` still model narrow as unrotated | CARRIED - queue row 140, explicitly not covered here |
| C1 | Narrow layout has zero rendered coverage in CI; the one rendered print test runs wide, desktop UA, `preferCSSPageSize: true` | CARRIED - no WebKit in CI; device run B7 is the only oracle |

### Verdict

The diagnosis is now measured rather than inferred, and the same one-line
change explains both symptoms the owner can see: the clipped bottom row and
the doubled page count. The fix removes an assertion rather than adding a
compensation, which is the property attempts 1 and 2 lacked - both added a
constant tuned against a platform number nobody had measured. Two reviewer
nits are folded into the task list as test work with named mutants; four items
are carried as queue rows with reasons. The acceptance criterion is a device
run, and the failure-modes table commits to the 2x2 portrait fallback rather
than a fourth iteration.

VERDICT: APPROVED FOR EXECUTION

NO UNRESOLVED DECISIONS

## Post-review: the regression the fix introduced, and its fix

A fresh reviewer FAILed `43b2851`. Blocking finding, confirmed by rendering:
`min-height` alone collapses `.printpage` to exactly its content height, so
`display:flex; align-items:center` has no free space to distribute and the
sheet TOP-ALIGNS. Desktop wide `card_y0` went 15.7/272.2/528.8 (base) to
0.0/256.5/513.0 (head) - the top row's border flush with the paper edge,
inside every consumer printer's 3-5mm non-printable band. A second symptom:
`printSlots()` (index.html:4248) computes `y0 = (g.PH - th)/2` = 15.8pt, so
the app's two shipped models of the same layout disagreed by 15.8pt.

Fix at `6b010675`: `html,body{height:100%}` plus
`body.printing #printroot, body.printing #printroot .printpage{height:100%}`
inside `@media print`. A percentage is the only construct that references the
page box without naming it - the platform resolves it against the page area it
chose. The JS-emitted `min-height` remains the floor against pagination.
Floor and fill together; neither alone is correct.

Verified by rendering both paths with the reviewer's scratchpad harness:
- desktop wide: `card_y0=[15.7, 272.2, 528.8]`, exactly the base values
- iOS-emulated narrow: 4 pages (not 8), sheet at y 129.0-662.1, ~89pt slack at
  each end, which also clears the iOS header band the reviewer flagged

Why no suite caught it: `tests/app.test.js` pinned the `min-height` VALUE (the
thing that causes the flush), and the only rendered print test measured frame
heights, never positions. `tests/e2e.test.js` now emits per-page top/bottom
clearance and asserts `top >= 8` and `|top - bottom| <= 2`; reverting just the
fill makes it fail with "printed its top card frame 0pt from the paper edge".
New mutant `p_print_page_fill_dropped.patch` covers the declaration.

Nits N1 and N2 are closed in the same commit: the emitted footprint is rounded
to 2dp (no more `760.3999999999999pt`), and the printable-box bound now runs
over every layout marked `constrained` rather than naming `narrow`.

### Auto-decisions (AFK)

- **D3** - close N1 and N2 in the regression-fix commit rather than filing them
  as queue rows. Both are one-line changes inside code the fix already touches,
  and N2 is a real hole: with the guard naming `narrow`, a second constrained
  layout would reintroduce the pagination silently.
- **D4** - add the position assertions to the EXISTING rendered print test
  rather than a new test. The probe already renders the PDF; a second render
  would double the slowest test in the suite for the same oracle.

## Fresh reviewer at dd5faa2: PASS_WITH_NITS, and what was closed

The reviewer measured rather than reasoned: `height:100%` cannot by itself
exceed the page box (in paged media the ICB IS the page area, and every visible
child of body is `display:none` under `body.printing`), so `.printpage`'s used
height is exactly `max(page area, min-height)`. Pagination returns only if the
floor exceeds the page area, which is the pre-existing condition. Rendered at
emulated iOS margins: 4 pages for 4 sheets, ink y 129.0-662.1, 88.8pt above and
89.7pt below - against a ~50pt band at each end, ~39pt of margin. Desktop wide
back to card_y0 15.7.

Three of the reviewer's own mutants survived all 271 tests. Closed here:
- **N2** `justify-content:center` -> `flex-start` survived. Desktop wide is a
  557.2pt sheet in a 612pt page, so left-aligning puts the left column's border
  at x~0 - the horizontal twin of the vertical defect. The e2e probe now emits
  `left`/`right` and asserts `left >= 8` and `|left - right| <= 2`; new mutant
  `p_print_justify_dropped`.
- **N3** the `min-height` floor moved from `.printpage` to `.printsheet` and
  survived, because the assertion was a bare substring with no selector. It is
  precisely the half of "floor and fill" that Chrome can never exercise -
  Chrome shrink-to-fits where iOS paginates. The assertion now constrains the
  selector; new mutant `p_print_floor_on_wrong_selector`.
- **R4** the fit loop measured Letter only, so A4 fit by luck. It now iterates a
  papers table (the papers live in the TEST, since the app deliberately carries
  no paper dimensions) and asserts the table covers every paper the app offers.
  A4 is the tight axis: 510.9pt of safe width against Letter's 531.6.
- **R3** PRINT_SAFE is confirmed test-only. Kept as an executable spec anchor
  for the device measurement, with a comment that now says so.

### Carried, not closed

- **N1** the e2e oracle structurally cannot see a footprint-exceeds-page-box
  regression: the reviewer probed page boxes 1.2pt and 21.2pt short of the
  532.8pt floor and Chrome produced 4 pages every time. Chrome shrink-to-fits
  where iOS paginates. The only guard for that half is the unit arithmetic.
- **N5** `break-after:page` is now redundant (every `.printpage` is exactly one
  page area) and its mutant survives. Load-bearing again if the fill weakens.
- **N6** "every print layout fits inside the platform-enforced printable area"
  is misnamed: its fit inequalities carry ~170pt of slack and kill none of the
  five mutants naming it; the value pins in the same block do the killing.
- **N7** two assertions are near-tautological (the footprint recomputation, and
  `!("h" in p)` on a key name). The reviewer verified the second is harmless -
  restoring the defect through a renamed key is still killed behaviourally.
- **iOS LANDSCAPE is unmodelled and, by arithmetic, would paginate**: the
  532.8pt footprint against a landscape page-box height of 612 - 2*40.2 =
  531.6pt, 1.2pt short. Not a regression (main is worse in every orientation)
  and portrait is the stated target, but it needs the device. Queue row.

### Auto-decision D5

Closed N2, N3, R4 and R3 in this branch rather than filing them as queue rows.
N2 and N3 are live holes the reviewer demonstrated with surviving mutants
against the exact code path this PR exists to fix; deferring them would ship
the fix with the tests that cannot see it breaking again.

## Merge of PR #106, and the follow-up that closes N1

**Auto-decision D6 (AFK grant).** Merged PR #106 at `8111088` with the second
reviewer's N1 still open. Policy is that PASS_WITH_NITS merges and nits become
queue rows; here merging was also the precondition for the owner's only
remotely-runnable device check, since the LAN server at 192.168.68.90:8732 is
unreachable and GitHub Pages serves `main`, which still carried the clipping
code. Pages built `80e46c7` and is live.

**Auto-decision D7.** N1 is not an ordinary nit - the reviewer demonstrated a
live hole by mutation, and it survived all 167 unit tests on the exact code
path this workstream exists to fix. Rather than filing it as a queue row it was
closed immediately on a follow-up lane branch, `claude/print-test-nits`
(PR #107), together with the two cosmetic nits from the same review (N2's
underived A4 figures, N3's stale empty-guard message). No source change; the
fix is in the test and a new mutant, `p_print_fill_parent_dropped.patch`.

N4 stays open and carried: two print mutants put prose in `# kills:` rather
than a test name. 65 of 367 existing mutants already do this and the verdict
rests on `# suite:`, so it is a consistency item for the whole corpus, not for
these two patches.
