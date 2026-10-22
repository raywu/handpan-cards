# Sheet polish after lane LG: execution plan

Base: `origin/dev` at 81ad610 (lane LG on DEV). `main` is behind and is not the base.
Inputs: owner feedback items 1-5 (2026-10-21), owner item 6 relayed by the coordinator (2026-10-21, "The shut lip can be 7px-10px to be more visible"), lane P reviewer nits (1)-(5) and (7), lane LG nits N1-N6.
Binding sources: CLAUDE.md on dev, docs/plans/2026-10-19-sheet-tabs.md (commit b766735; 3.3, 3.6-3.9), docs/plans/2026-10-20-phone-fixes.md (P1-P4), docs/plans/2026-10-20-lip-gesture-fix.md (Q1-Q6, A1, A2, T1-T27, R1-R8, D1-D10), memory queued-scale-import.md (P4a, P4b, A9, TB-A2, N9, LG result).
Design lens: frontend-design principles (one bold element, structure that carries information, motion only in answer to an action, plain names) applied inside the repo's fixed design system. Where the lens and the design system disagree, the design system wins. Example: `.sheetlabel` stays uppercase and tracked because CLAUDE.md "Preserve the visual system" binds it.

## 1. Goal and non-goals

### 1.1 Goal
The owner's six items and the placed nits land on DEV in three serial `index.html` lanes (a fourth, SPS, only if the owner asks for the swipe) and one tests-only lane. Each lane has its own PR into `dev`. Each lane's main PR stays HELD.
- Item 1: the last control clears the lip.
- Item 2: the palette moves to the Layout tab with a title.
- Item 3: in landscape the plate is pinned and the footer is capped to the controls column.
- Item 4: the swipe is not built now (D-4, Q3); lane SPS is fully specified and fenced if the owner asks for it.
- Item 5: a message is never inside the lip.
- Item 6: the shut lip is 9px.
- LG's "very smooth" result does not regress.

### 1.2 Non-goals (binding, restated)
- NG1. No deck data or diagram geometry change. No engine change: `src/engine/*` and the engine regions stay untouched.
- NG2. The visual system is preserved: fonts (Marcellus, Bitter, Nunito Sans), palettes, existing colour values, and `.mode` buttons. No new font and no new colour value. Every target stays at least 44px.
- NG3. Single-file app. No new external asset and no `<script src>`.
- NG4. No rAF and no ResizeObserver are added to the lip or the swipe.
- NG5. The LG gesture constants are unchanged: LIP_PX 24, LIP_SWIPE 16, LIP_WINDOW 150, LIP_END_MS 220, HOLD_MS 250 and the 8px hold slop. The 25px tap zone and `scroll-padding-bottom` 21px are also unchanged. The only lip geometry that changes is the shut foot height (item 6, D-6), proven by device step 7.4.
- NG6. No `#import-row` unhide. On dev the import UI is removed, and nothing here re-adds it.
- NG7. Nothing in About, settings, cards or the share routes. `panelStops()` (the settings panel) is untouched. The sheet's Tab trap is the `keydown` handler beside the comment "Tab is trapped inside", not `panelStops()`.
- NG8. Lane T2 nits R2-1 to R2-4 and the A9 amendment to sheet-tabs 3.7/3.8 belong to the post-main nits lane. They are not planned here.
  - A9 ruling, confirmed by the owner and recorded by nits lane ND (the sheet-tabs plan is on main at docs/plans/2026-10-19-sheet-tabs.md, merged by #410; its 3.7/3.8 are not amended here): the keyboard rising collapses the footer to the lip until the keyboard is dismissed. Owner: "Opening the keyboard should also minimize the drawer until keyboard is dismissed". Test: "UX: the keyboard rising collapses the footer and its fall restores it".
- NG9. No README mutant count or `tests/FLOORS` rows are set by any lane (see section 8).

## 2. Measurements

### 2.1 Method
- Script: `SCRATCH/measure.js`, output in `SCRATCH/measure.json`, run against the dev worktree `SCRATCH/wt-polish-plan` (81ad610) with real Chrome (`CHROME_BIN=/Applications/Google Chrome.app/...`) through `tests/helpers/cdp.js`.
- The page is served over 127.0.0.1 by an in-process `node:http` server, as `tests/e2e.test.js` does. `file://` was not used because it throws on `localStorage` (the e2e harness's own reason).
- Viewports: 380x780, 390x844 with `Emulation.setTouchEmulationEnabled`, 320x568, 844x390, and 1280x800 (not mobile). Each run used a fresh `localStorage` and the Add sheet.
- (d) was taken first, on the empty sheet (the example plate). The rest used the typed seed `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5`.
- "Shut" means `collapseLip()` followed by scrolling `.sheetbody` to its end. "Keyboard" is the tests' path: focus `#scale-box`, then `b.fakeKeyboard(h - 336)` (KEYBOARDS[0]), which runs `applyKbOffset` and so A9's collapse.
- The test message is `say("No ding: put the ding in round brackets.", "err")`.
- The hit test is `elementFromPoint` at the message's centre.
- One Chrome job ran at a time. The only e2e test run was the single SG: N-A5 test (it passed, 7.2s).

### 2.2 Table M (all px, viewport coordinates)

| ID | Quantity | 380x780 | 390x844 touch | 320x568 | 844x390 | 1280x800 |
|---|---|---|---|---|---|---|
| Ma1 | Layout, lip shut: RESET LAYOUT bottom to pill top | 2.8 | 2.8 | 3.3 | 171 (column 2 is short) | 3.0 |
| Ma2 | Layout, lip shut: RESET bottom to body edge (hairline) | 0.8 | 0.8 | 1.3 | 169 | 1.0 |
| Ma3 | Layout, lip shut: the 25px tap zone's overlap of RESET (zone top 755 at 380) | 19.3 | 19.3 | 18.8 | 0 | 19.0 |
| Ma4 | Layout, lip open: RESET bottom to hairline | 0.8 | 0.8 | 1.3 | 169 | 1.0 |
| Ma5 | Scale tab, shut, scroll end: swatches bottom to pill top | 70.3 (no scroll) | 134.3 (no scroll) | 3.1 | 2.7 | 59.2 (no scroll) |
| Ma6 | Scale tab scroll range M, open | 24 | 0 | 250 | 213 | 47 |
| Mb1 | Lip open: `#scale-msg` [top, bottom], hit at centre | 680-698, msg | 715.7-733.7, msg | 468-486, msg | 316-334, msg | 690-708, msg |
| Mb2 | Lip shut, no keyboard: msg [top, bottom], lip zone top, hit | 749-767, 755, **#scale-lip** | 813-831, 819, **#scale-lip** | 537-555, 543, **#scale-lip** | 355-373, 359, **#scale-lip** | 765-783, 775, msg |
| Mb3 | Keyboard up (A9 lip shut): msg, zone top, keyboard line, hit | 405-423, 411, 444, **#scale-lip** | 469-487, 475, 508, **#scale-lip** | 193-211, 199, 232, **#scale-lip** | n/a (h-336 < 300) | 417-435, 427, 464, msg |
| Mb4 | Keyboard up: msg top minus `#scale-box` bottom | 30 | 30 | 30 | n/a | 34 |
| Mc1 | Layout, scroll top: plate band [top, bottom] vs body [56, 334] | - | - | - | 56-404 (70 below the scrollport) | - |
| Mc2 | Layout, scroll end: band [top, bottom] | - | - | - | -176 to 172 (scrolled off) | - |
| Mc3 | Layout: preview width x height | 336 | 346 | 276 | 306 x 306 | 480 |
| Mc4 | Layout: controls column [left, width] (tabs and drawer) | 22, 336 | 22, 346 | 22, 276 | 321, 514 | 335, 610 |
| Mc5 | Layout: `#scale-generate` [left, width] | 22, 336 | 22, 346 | 22, 276 | 9, 826 | 335, 610 |
| Mc6 | Scale tab: fields and NEXT [left, width] | 22, 336 | 22, 346 | 22, 276 | 171, 502 | 335, 610 |
| Mc7 | `.sheetsurf` [left, width], Layout / Scale | 0, 380 | 0, 390 | 0, 320 | 0, 844 / 162, 520 | 307, 666 (container query off: aspect < 1) |
| Mc8 | Lip zone when shut at 844x390 | - | - | - | 359-384, full width 9-835: over column 1 | - |
| Md1 | Example plate: CTA box [l, t, w, h] | 106,292,167,29 | 111,297,167,29 | 77,253,165,46 (2 lines) | 78,194,167,29 | 556,382,167,29 |
| Md2 | Example plate: SVG text the CTA covers | D3, D4, E4, 9, 10 | D3, D4, E4, 9, 10 | D3, D4, 4, E4, 5, C5, 9, D5, 10 | D3, D4, E4, 9, 10 | D3, 9, 10 |

### 2.3 What the numbers say
- MS1, from Ma1-Ma3 and Ma5. On every phone viewport the last control of whichever tab scrolls ends within 3.3px of the pill and within 1.3px of the hairline, with the lip open or shut. The tap zone overlaps about 19px of the 44px RESET LAYOUT button, so a tap on RESET's lower half lands on `#scale-lip`. Item 1 is a layout defect, not only a look.
- MS2, from Mb2 and Mb3. The premise of item 5 holds in a precise form. A message never leaves the screen: SG: N-A5 passes at 81ad610, and every Mb row is inside the viewport and the keyboard line. But with the lip shut, which A9 guarantees whenever the keyboard is up, the message's lower 12px lie inside the lip's 25px tap zone, and the hit test at its centre returns `#scale-lip` at 320, 380, 390 and 844. The message reads as part of the lip and moves with it (`--lip-g`). The lane's first red test pins this, and it also reconciles why N-A5's `hits` clause does not see it (see R7).
- MS3, from Mc1-Mc2 and Mc5. At 844x390 the plate is relatively positioned, starts 70px taller than the scrollport, and scrolls off entirely. GENERATE spans 826px against a 514px controls column, and the shut lip's zone lies over column 1 (Mc8).
- MS4, from Md2. The CTA covers the ding label and the index numbers 9 and 10 at every viewport. At 320x568 it wraps to two lines and covers nine labels.
- MS5, from Mc7. 1280x800 is outside the two-column container query, so every item 3 rule scoped to that query leaves it byte-identical in layout.

## 3. Item decisions

### 3.1 Item 1: margin above the lip
- Ask: "Reset layout needs a little margin above the lip - whichever last element needs to have some margin so it doesn't sit flush on top of the lip".
- State: MS1. The flushness is generic: it is whatever element is last in the scroll (RESET on Layout, the swatches on the Scale tab at 320x568 and 844x390). The tap zone's overhang above the foot is 20px today (25 - 5).
- Options:
  - O1-a, margin on `#scale-layout-reset`'s row. It fixes only RESET, misses the Scale tab, and must move again when item 2 puts the palette last. Rejected.
  - O1-b, `padding-bottom` on `.sheetbody`, the flex scroller. Trailing padding inside a flex scroll container's scrollable overflow is engine-sensitive (WebKit historically dropped it). That is the iPhone engine, so the fix cannot be proven in CI's Chromium. Rejected.
  - O1-c (recommended), `padding-bottom` on each panel, `#scale-panel-scale` and `#scale-panel-layout`. A panel is an ordinary flex item, so its padding is part of its own box and always reaches the scroll end in every engine. It belongs to no particular last element, so it holds for whatever item 2 or a later change puts last.
- Decision D-1. Both panels get `padding-bottom: calc(var(--lip-over) + var(--sp-2))`, where `--lip-over` is the tap zone's overhang above the shut foot (25px minus the foot height, 16px after D-6). The value is carried by one new custom property beside the lip rules, so the zone and the foot height are written once.
  - At the 4px/8px/14px/22px ramp this is 24px. Under `max-height:520px` and `.short` it is 22px. On the tall ramp it is 28px.
  - Predicted at 380x780 with the lip shut: the last control's bottom sits sp-2 above the zone top and about 24px above the hairline, against 0.8 today, and no part of it is under the zone. RESET's lower half becomes tappable again.
  - In the 844x390 two-column Layout grid, `#scale-panel-layout` is `display:contents`, so its padding is ignored. Column 2 ends 169px above the body edge there (Ma2), so nothing is needed.
  - The padding is always present, not gated on `lipshut`. Gating would change the scroll range M at each collapse in a new way, which is the N1 re-baseline path LG left unpinned. An always-on padding changes M by a constant, and the finger-drag rule (owner decision "Finger drag") does not read M.
  - Side effect, accepted and recorded: the Scale tab at 390x844 (M 0 today, Ma6) gains about 24px of scroll range. The wheel rule `M - t > E` with E about 138 still never collapses there, so "PH: P3 at 390x797 a wheel on a sheet with no room never collapses; with room it collapses" stays green. That test runs at 390x797, so lane SPA confirms the predicted clearance at 390x797 as well as 390x844 (eng review P3). Device step 7.1.3 checks it by hand.
  - The LG thresholds are untouched: scroll-padding-bottom stays 21px (it still exceeds the 16px overhang) and the LG constants stay as listed.

### 3.2 Item 2: palette on Layout with a title
- Ask: "Color selection may need a title and should be moved to Layout as the first or last step".
- State, from the markup at 81ad610:
  - `.ctlrow > #scale-swatches[role=group][aria-label="Card palette"]` is the last child of `#scale-panel-scale` and has no visible label.
  - The Scale-tab Tab stops (the "Tab is trapped inside" handler) list `...swatches.children` before the primary. The Layout stops do not.
  - `lipHandOff()` falls back to `swatches.lastElementChild`.
  - A long markup comment about the 2026-09-17 owner decision keeps the palette in the scroll rather than pinned. That decision is about scroll versus footer, not about tabs, and it stays true after the move.
- Options:
  - O2-a, first on Layout, above the plate. This puts a secondary choice above the Layout tab's primary content (the plate, sheet-tabs 3.9's hierarchy) and pushes the plate down by about 70px on every phone. Rejected.
  - O2-b (recommended), last on Layout, after `#scale-layout-zone`, as a sibling of the zone and not inside `#scale-drawer`. The palette is the last decision before GENERATE CARDS, it styles the cards rather than the pan, and putting it after RESET LAYOUT keeps the layout controls together.
  - O2-c, stay on the Scale tab with only a title. This does not answer "moved". Rejected.
- Decision D-2.
  - Markup and stops:
    - An `.editrow` holds a `span.sheetlabel#scale-palette-label` reading "CARD PALETTE" (written uppercase in the markup like every sibling label, e.g. HANDPAN ORIENTATION) and the existing `.ctlrow > #scale-swatches`. The group takes `aria-labelledby="scale-palette-label"` in place of `aria-label`. No new row class (design review F2).
    - The Scale stops lose `...swatches.children`. The Layout stops gain them between `resetBtn` and the primary.
    - `lipHandOff()`'s fallback becomes the shown tab's last stop: `swatches.lastElementChild` on Layout and `scaleBox` on Scale.
  - Reachability: the swatches never read `boxOk` and stay enabled on Layout with an empty or invalid scale. The palette needs no pan, and an Edit of a palette-only change must not need a valid parse first. The Layout tab is reachable before a scale parses, by tab tap and by NEXT.
  - In the 844x390 grid the palette row goes in column 2 after the zone.
  - The swatches comment block is rewritten to say where the palette lives and why. Its two mutant and test references (`e_sheet_ctlrow_pinned_again`, `e_sheet_primary_back_in_the_scroll`) stay valid because they are about the footer, not the tab.
  - Tests that pin the place, each re-pointed in lane SPB:
    - app "UX: Tab onto the lip restores the footer and focuses GENERATE CARDS, DELETE when GENERATE is disabled on Edit, else the last swatch": its last clause becomes "else the shown tab's last stop".
    - e2e "RD: the Edit page's Tab order is BACK, the Scale tab, name, the fields, box, swatches, SAVE CHANGES, DELETE on the Scale tab, forward and back, and no stop is a select": the swatches leave its title and its expected arrays, and a Layout-tab sequence is asserted in the new SPB stops test.
    - e2e "an edit onto another deck's scale is refused at 380px and both chips stay" and "a refused SAVE onto another deck's scale does not move the pan": both measure `#scale-swatches`' bottom against the scrollport. They are re-pointed to the Scale tab's new last row, `#scale-box-wrap`, keeping the 785.69 history comment's intent.
    - e2e "every chip and sheet control has a 44px hit area" and "every palette swatch owns its full 44px hit area on BOTH axes": these hit-test rects, so they switch to the Layout tab first.
    - e2e "an options-only edit keeps its chip position across a reload at 380px": `b.click` on a swatch needs a rect, so it switches to the Layout tab first.
    - e2e "a pan warning on the Edit open does not move the pan": its `layoutRowReachable()` check measures `#scale-swatches`' bottom; it follows the Scale tab's new last row, the same re-point as the two refused-edit tests (eng review P2-2).
    - e2e "the page is a modal dialog with the spec'd anatomy" counts swatches by `querySelectorAll` and is kept unchanged. The app tests and e2e SD tests that `.click()` a swatch from JS do not need a rect and are kept unchanged.

### 3.3 Item 3: landscape Layout, plate pinned, footer capped
- Ask: "Landscape Layout: we should pin the handpan visual so it doesn't scroll off viewport. Let the input fields scroll. Consider capping the width of the "generate" & lip to the width of the input fields; either centered on viewport or on the fields."
- State: MS3. The two-column layout is the `@container surf (min-width:600px) and (min-aspect-ratio:1/1)` block on `[data-tab="layout"]`, entered through `@media (orientation:landscape) and (max-height:500px)` (surface `max-width:none`). The band is `position:relative` there, and `--adj-reserve` is 72px, which gives a 306px pan in a 278px scrollport (TB-A2, owner-accepted: "keep the 306px pan, lower 70px reached by scrolling").
- Options for the pin:
  - O3-a (recommended), sticky band sized to the scrollport. In the container block:
    - The band goes back to `position:sticky; top:0` (column 1, `align-self:start`).
    - `#scale-drawer-status` moves to the head of column 2 by a markup move (codex 7). It is a child of `#scale-plate-band`, not a grid item of `.sheetbody`, so `grid-column` alone cannot place it, and making the band `display:contents` would remove the sticky box. The move is specified in D-3 below.
    - `--adj-reserve` becomes the chrome around the scrollport. Measured 390 - 278 = 112px, plus the band's `--sp-1` padding, which gives 116px.
    - With no message the pan becomes 274px at 844x390 (306 x 0.895) and fits the scrollport with the lip open, so it is pinned at every scroll offset. 274px is the no-message baseline, not a universal minimum: with guidance showing the pan is smaller (D-3 sizing). With the lip shut the scrollport grows to 323px and the pan does not change size (no jump on collapse).
    - Cost: plate tap targets shrink by about 10.5%. This supersedes TB-A2: OWNER GATE, Q1.
  - O3-b, sticky at 306px. The bottom 28-70px stays clipped below the scrollport, so "doesn't scroll off" is only half true. Rejected.
  - O3-c, leave as is (TB-A2). This does not answer the ask.
- Options for the cap:
  - O3-d (recommended), cap guidance, the primary, the delete row and the lip to the controls column. The inset is the plate width plus the column gap, through one custom property `--plate-w` that holds the preview's existing clamp expression and is declared once on `.sheetsurf`, with the same scope and computed value the preview's clamp has today.
    - The inset is applied exactly once per rendered box hierarchy (codex 6). Open, `#scale-foot`, `#scale-footclip` and `#scale-footslide` are `display:contents`, so the inset goes on `#scale-guidance`, `#scale-generate` and `#scale-delete-row`. Lipped, `collapseLip()` makes the foot a positioned block and the slide a flex container, so the inset goes on `#scale-guidance` and `#scale-foot`, and the primary and delete-row insets are reset to zero under `#scale-sheet.lipped`. The clip keeps its ring allowance. `lipRead()`/`lipWrite()` carry no horizontal geometry, so nothing else corrects a double inset.
    - It matches "centred on the fields": on Layout the fields are column 2, and the primary sits under the controls it commits.
    - Measured reason: a full-width shut lip lays its 25px zone over column 1 (Mc8). Once the plate is pinned to the scrollport's bottom, that zone would cover the plate's bottom ring of notes. Capping the lip to column 2 removes the overlap.
  - O3-e, centre on the viewport at the Scale tab's 502px (171-673). This keeps the primary's x across a tab switch, but it straddles the plate column and leaves the zone over the plate's lower right. Rejected for the overlap.
- Decision D-3: O3-a plus O3-d, both scoped to the existing container block on `[data-tab="layout"]`.
  - Breakpoints are unchanged: the existing media query and container query.
  - What scrolls: `.sheetbody` remains the single scroller. Column 1 is pinned by sticky and column 2 scrolls.
  - Scale tab: unchanged (no plate, surface 520px centred, fields and NEXT already 502px, Mc6).
  - 1280x800: unchanged, because the container query does not match there (MS5). A rect-equality test pins it.
  - Keyboard in landscape: the Layout tab has no text field. On the Scale tab, `kbup.side` hides the head and tabs as today.
  - N9 (the tab strip scrolls off at 844x390, owner-accepted) still holds: the tabs live in column 2.
  - Lane P nit (7) is closed by this decision.
  - Sizing (codex 8, replacing the open mechanism choice of design review F1). The landscape plate is sized from the scrollport height available with the footer fully open, with the current guidance and the Edit delete content. The same size holds through collapse and restore; it is never derived from the larger shut scrollport, so the pan does not grow on collapse or shrink on restore (C5). The budget includes the band padding. The status no longer sits in the band (below), so no status height is in it. 274px is the no-message baseline. Every guidance growth state CLAUDE.md lists is tested: a one-line notice, a two-line warning, the Edit delete refusal, the refusal beside a notice, a re-armed DELETE, and the notice with three ring-reset suffixes (C1, C5). The pan shrinks rather than clips. If fitting conflicts with the 44px-target tests, the lane reports the conflict to the integrator before changing either requirement.
  - Drawer status placement (codex 7). `#scale-drawer-status` moves in the markup from the last child of `#scale-plate-band` to the next sibling after the band inside `#scale-panel-layout`, before `#scale-layout-zone`. Its id and attributes are unchanged.
    - At 844x390 the panel is `display:contents`, so the status is a `.sheetbody` grid item. `grid-column:2` and DOM order put it straight after `#scale-tabs`, at the head of the controls column. The container-block rule `#scale-plate-band #scale-drawer-status{width:0; min-width:100%}` moves to the new selector, so a long status wraps inside column 2. The band keeps its box and stays the sticky element.
    - In portrait and at 1280x800 the status keeps its 81ad610 place under the plate and stays pinned with it. It becomes `position:sticky` with `top` set to the band's height and the band's background. `syncBand()` writes that height as a new `--plate-pin-h`, and `--plate-band-h` (the body's `scroll-padding-top`) becomes band plus status, so "DR1 line 87: a control focused by Tab under the open band is not hidden behind it" holds unchanged. The `nostick` decision counts band plus status, and `.nostick` also makes the status `position:relative`. A negative top margin takes the panel's `--sp-3` gap back to the band's `--sp-1`, so the status's rect relative to the plate is unchanged (C6).
    - DR1 assertions this supersedes: app "DR1 line 81: the status line is in the band after the plate, hidden while closed, polite and atomic" asserts `_markupParent` is `scale-plate-band`. It is retitled "DR1 line 81: the status line is the panel's next element after the band, hidden while closed, polite and atomic" and asserts the panel as parent and the band as previous sibling. Its markup-order, `aria-live` and `aria-atomic` asserts are kept. drawer_seats "DR2a browser (84): the longest single status row of the spec table fits the reserved band without the plate scrolling away" measures only the band's height, which the move makes vacuous. It is re-pointed to measure the band plus the status. Kept unchanged and required green: "DR1 line 82: the status line is inside the scrollport at the end of the body at 380 x 780 and 380 x 667", "DR1 line 87: ...", and "PH: the CTA is a sibling right after the plate inside the band, not in the flow above it" (its hint-before-status order still holds).

### 3.4 Item 4: swipe left and right between tabs
- Ask: "Consider borrowing left and right swipe gestures to allow users to swipe between tabs".
- State: gestures already owned on the sheet:
  - The plate's note drags and taps (a non-passive `touchmove` on `#scale-preview`, Layout only).
  - The lip's vertical drag, armed from every surface except `#scale-lip`, `select`, the focused field and multi-touch (Q1). It acts only on `|dy| > |dx|` with dy of at least 24, which is pinned by "PH: P3 a drag with a second finger or mostly sideways changes the lip zero times across the gesture and its settle".
  - The focused text field's caret and selection.
  - iOS Safari's edge back-swipe, which pops the sheet's own history entry and so closes the sheet today.
  - LIP_SWIPE 16.
  - Measured coverage: at 380x780 the Scale tab's inputs fill about 62% of the scrollport (fields 139-463, box 556-604 of 80-684), and the Layout plate fills 56%.
- Options:
  - O4-a, a fenced build in its own last lane and PR, so it can be reverted alone.
    - Listener: passive `touchstart`, `touchmove`, `touchend` and `touchcancel` on `.sheetbody`, deciding only at `touchend`. It never writes `lipDrag` and never calls `preventDefault`. It tracks the gesture's whole lifecycle with sticky cancellation: once cancelled, nothing until the next one-finger `touchstart` can switch a tab (codex 5).
    - Fires when: the gesture was never cancelled, |dx| at least 48px, |dx| at least 2|dy|, and no more than 600ms. The original touch identifier and start target are kept, and dx and dy are read from that identifier only.
    - Cancels when: any second finger appears, even if it lifts before `touchend`; the keyboard rises (`kbup`); the start field gains focus or a selection; a touch on an unfocused field is held for HOLD_MS before leaving the existing 8px slop (the lip's own fresh-field rule); a textarea's own `scrollTop` changes; or the maximum excursion of `.sheetbody`'s `scrollTop` from its start value during the gesture exceeds 8px, so an out-and-back scroll cancels even when it ends where it began.
    - Direction: finger moving left selects Layout, finger moving right selects Scale. This works on both create and Edit, through `setTab()` exactly as a tab tap does (instant, no history entry; `setTab` restores the lip through `setLip(false, {instant:true})`, which is `lipReset`).
    - Excluded starts: `#scale-preview` and its descendants, `#scale-lip`, the focused field, any `select`, a start within 24px of either viewport edge (iOS back and forward swipes), any touch while `kbup` is set, and any multi-touch. The plate and edge exclusions are decided from the original start target and point, so a finger that later enters an eligible region stays excluded and `liftNote()`/`dropNote()` keep their gestures.
    - An unfocused input is a valid start: a horizontal move there does nothing natively.
    - Motion: none added. The tab switch is already instant and the 2px underline moves with it, so reduced motion needs no branch.
    - Focus is not moved, and `setTab()` already blurs a control that left the screen.
    - Interaction with LG (codex 4, replacing the earlier claim that a re-baseline prevents collapse). `setTab()` calls `setLip(false, {instant:true})`, which is `lipReset()`; `lipReset()` clears the lip classes and variables and calls `lipRebase()`, but it does not clear `lipFling`, does not open a quiet window and does not stop a fresh touch drag. So after a switch a residual fling can re-baseline and then collapse, and a fresh vertical drag can call `collapseLip()` directly. The fix: a successful swipe switch sets an explicit suppression deadline of touchend + LIP_END_MS. The swipe-to-tab hand-off sets `lipFling` to null, ends any parked `lipDrag`, and re-baselines the new panel's scroll position. Until the deadline both scroll-derived and touchmove-derived lip changes are suppressed, including a fresh vertical gesture, through the existing `lipQuietUntil` checks in `lipScroll()`, `lipFlingStep()` and the sheet-capture `touchmove` (the deadline is `max(lipQuietUntil, deadline)`, so it never shortens a quiet window). Native scrolling stays available. No gesture constant changes (NG5). A hooked gesture (vertical first, then horizontal) may collapse the lip mid-path, and `setTab` reopens it on the switch. Accepted (eng review P2-1).
  - O4-b (recommended), do not build now. Cheaper alternative: nothing. The tab strip is already a full-width 44px target and NEXT moves Scale to Layout in one tap.
  - O4-c, swipe on the tab strip only. The strip is 45px tall and is already a tap target, so a swipe there adds nothing over a tap. Rejected.
- Decision D-4: recommend NOT building the swipe in this plan (O4-b, the subtraction default; design review F4). Two tabs, a full-width tab strip and NEXT already cover the move. Without motion a swipe switch reads as a glitch, and the plate exclusion makes the gesture work on only part of the surface. The owner wrote "Consider", and the cost would land on the lip the owner rated "very smooth".
  - If the owner answers Q3 "build", lane SPS runs as specified in 5.4, last and fenced, and only after device steps 7.1-7.4 and 7.6 pass. The risk to LG is then containable: the swipe is decided at `touchend` from a passive listener, the lip's own sideways guard already has a test, S4a and S4c pin the post-switch suppression window for residual momentum and for a fresh vertical drag, and device step 7.5 repeats LG's D1-D10 smoothness pass.
  - If Q3 is "do not build now", lane SPS is dropped and nothing else moves.

### 3.5 Item 5: messages off the lip
- Ask: "Error message should not be on the lip as it can minimize while keyboard is up. It should be on the main sheet."
- State: MS2. Binding constraints:
  - P4a (owner): `#scale-guidance` is 0px and out of flow when empty.
  - SG: N-A2 pins the order `.sheetbody`, `#scale-guidance`, `#scale-generate`, `#scale-delete-row`.
  - SG: N-A5 pins on-screen, above the primary and the hit test.
  - SG: N-A6 pins growth by 18px a line and the `--sp-2` neighbour gaps.
  - A9: the keyboard rising collapses the footer to the lip.
  - Measured with the keyboard up, the message sits 30px under `#scale-box` (Mb4), which is already the right proximity. The defect is the overlap with the tap zone and the ride with the lip.
- Options:
  - O5-a (recommended), keep the slot where SG pins it and clear the lip.
    - While the sheet is `lipped` and guidance shows text, the foot's top margin becomes `var(--lip-over)` in place of 0 (the existing `:has(...)` foot rule). The message then ends at least `--sp-1` above the tap zone, and its centre hit-tests to itself in every state.
    - While `kbup`, `--lip-g` follows `lipWrite` as it does today; no hold is added. The `--lip-over` foot margin alone keeps the message clear of the tap zone. No `kbup` guard is added to `restoreLip`, because that would change LG and A9 behaviour (NG5) (eng review P1-1).
    - The message moves. `collapseLip()` writes the guidance's open offset to `--lip-g` through `lipWrite()`, and `lipshut` transitions it to zero over the lip's transition, so the message slides from its open place to its shut place. The 16px margin changes where it lands, not that it slides. Zeroing `--lip-g` to hold it still would bring back the overlap with the restoring primary (eng review P1-1). So O5-a promises clearance, not a stationary message (codex 1).
    - Mid-transition guidance changes (codex 2). Today `restoreLip()` remeasures only when `lipSettled` is true, and neither `say()` nor `paintLayout()` calls `lipWrite()`. A message that appears, clears or changes height while SHUTTING or OPENING therefore leaves `--lip-g` stale, and a reversal can bring the primary back through the new message. SPA owns the smallest change that makes a reversal use current geometry before `lipSettled`: when guidance content, height or visibility, or the footer geometry, changes while the sheet is `lipped`, the lip remeasures (`lipRead()` then `lipWrite()`) from the call sites that change guidance, with no rAF and no ResizeObserver (NG4).
    - Geometry-made scroll events (codex 3). In `lipScroll()` the shut-at-end `restoreLip()` runs before the `M !== prev.M` range guard. When guidance clears near the end, the scrollport grows, the browser clamps `scrollTop`, and inside a wheel window (`userWindowUntil`) that scroll event can restore the footer. SPA moves the range re-baseline ahead of the end-of-scroll restore, so a changed range is re-baselined before the restore branch is read. P4a's zero-height empty slot is kept, and an obsolete `scrollTop` beyond the new range is not preserved. `lipScroll()` and `lipFlingStep()` already return while `kbup`, so the keyboard-up case is a guard to prove, not a path to change.
    - With the lip open and no keyboard, the existing slide with the footer stays (T2 behaviour, NG8).
    - Cost: 16px of scrollport while a message shows with the lip shut. P4a's 0px-when-empty is untouched.
    - e2e "UX: lipped, an empty guidance slot takes no height and the lip sits on the body's hairline; a slot with text stays --sp-2 above the lip": retitled "... a slot with text stays --sp-2 plus --lip-over above the lip", asserting `gap` within 2px of `sp2 + lipOver`, where lipOver is read from `--lip-over`. `tests/mutants/uxl_guidance_always_hides.patch` gets its `# kills:`/`# suite:` headers set to the new title (dots for spaces) (eng review P1-2).
    - SG tests: N-A2 kept, N-A3 kept, N-A4 kept, N-A5 kept and strengthened by the new SPA test, N-A6 kept (its gaps are measured with the footer open; the lane confirms this and re-points only if a lipped case is asserted), N-A7 kept, N-A10 kept. "PH: P4 a message appearing while the footer is lipshut grows the slot without flipping the lip, and clearing it returns the slot to 0" is kept, with its growth figure re-pointed by 16px if it asserts one.
  - O5-b, move `#scale-guidance` between `.sheethead` and `.sheetbody`, at the top of the sheet. It never meets the lip, but it is far from the field in portrait (box at 556-604, message at about 80) and from the primary. It supersedes SG: N-A2's order and the sheet-guidance placement decision X3 (#303). OWNER GATE.
  - O5-c, move the messages into `.sheetbody` under the fields. They scroll away, which breaks N-A5's "scrolled to the top and to the end" clause and reverts the sheet-guidance plan. Rejected.
- Decision D-5: O5-a, subject to owner question Q2. Visual contract (design review F5, amended by codex 1): O5-a guarantees clearance, not a stationary message. Guidance may move during collapse and restore, using the existing synchronised transform. Throughout either transition its visible text stays clear of the primary, DELETE and the lip's tap zone. In the settled shut state it keeps the sheet surface colour behind it (not the lip's) and its last line box ends at least 4px above the tap zone (A10, A11). Q2 states this motion plainly. If the owner needs a stationary message, O5-a is not accepted and a separately specified placement replaces it (O5-b is the one on offer). Lane SPA's first commit produces two screenshots at 390x844, keyboard up and lip shut: A, O5-a as built; B, an O5-b mock-up (guidance moved under the header in a throwaway local edit, not committed). The integrator attaches them to Q2. The message stays "on the main sheet" in the sense that it is no longer inside or attached to the lip. If the owner picks O5-b, lane SPA swaps the D-5 rows for an O5-b row set and the N-A2 supersession.

### 3.6 Item 6: shut lip 7-10px
- Ask (coordinator relay, 2026-10-21): "The shut lip can be 7px-10px to be more visible."
- State: the foot is 5px (LG A1). The 32x3 pill sits at the foot's bottom, flush with the surface's bottom edge above the safe-area inset (pill top at viewport bottom minus 3 on every viewport: 777 of 780, 841 of 844). The zone overhang is 20px.
- Options:
  - 7px: the pill can be centred with 2px above and below.
  - 9px (recommended): centred with 3px above and below. The pill lifts off the screen edge and the home-indicator band, the foot is 1.8x today's height, and the overhang drops to 16px.
  - 10px: no integral centring (3.5px) and the most scrollport lost.
- Decision D-6.
  - The foot is 9px. The pill keeps 32x3 (P4b, owner) and rises to `bottom:3px`. Size is unchanged and only the air around it grows.
  - The 25px tap zone keeps `bottom:0` and its height, so its lower edge still meets the surface bottom above the inset, and the overhang becomes 16px.
  - `scroll-padding-bottom` stays 21px (it still covers 16px plus 5px of air). LIP_PX and the other constants are unchanged.
  - The shut scrollport loses 4px. The negative foot margins (sp-4, sp-3, sp-2) are unchanged.
  - Tests and mutants that pin 5px, and how they move (lane SPA):
    - e2e "UX: a real touch swipe down collapses the footer to a 5px lip, a swipe up restores it, with no flicker under momentum": retitled with "9px lip", and its `foot - 5` check becomes `foot - 9`.
    - Mutant `tests/mutants/ph_foot_4px.patch` (kills the title above): rewritten as `ph_foot_5px_again.patch` (shut foot back to 5px), with its `# kills:` and `# suite:` headers set to the new title (dots for spaces, per the word-split rule).
    - e2e "UX: the lip draws a 32x3 pill at the surface's bottom above the safe-area inset, its tap zone is 25px tall, and a tap anywhere in the zone restores": title kept; its `hit.foot - 5` check becomes `hit.foot - 9` with the message "not 9". Its zone and bottom asserts are unchanged (eng review P1-3).
    - Mutants carrying the lip lines (foot height, zone, scroll padding) as context are refreshed: `ph_pill_36x4`, `uxl_no_scroll_padding`, `uxl_zone_44`, `uxl_guidance_always_hides`, `uxl_height_transition` and `uxl_motion_reduced`.
    - The lane runs `git apply --check` on every mutant in `tests/mutants/` whose context includes the `#scale-sheet.lipped #scale-foot`, `#scale-lip` or `.sheetbody` scroll-padding lines.
    - CLAUDE.md on dev carries no 5px, 21px or 25px lip figure, so no doc figure changes for D-6.

## 4. Deferred items placement

| Item | Placed in | How |
|---|---|---|
| P nit (5) CTA covers ding label and numbers 9/10 | Lane SPA, D-P5 | The owner asked for the CTA "directly on the visual" (phone-fixes P1), so it stays on the example plate, which nobody typed and which is greyed (.35). It is hidden over a HELD plate, where the covered labels are the user's own: `layoutHint.hidden = boxOk \|\| !exampleShown`. Showing it over a held plate was a lane P auto-decision ("CTA keeps today's visibility rule"), not an owner decision, so this is decided here. The re-pointed tests are listed in section 6. |
| P nit (7) plate below the scrollport at 844x390 | Lane SPC | Closed by D-3. |
| P nit (1) no test pins the example to the placeholder attributes | Lane SPN | New test. |
| P nit (2) weakened app test | Lane SPN | Restore "none of E3/B3/F#5" in "PH: the empty sheet draws the pan the four field placeholders compose, not the old example". |
| P nit (3) selected-tab press colour barely visible | Lane SPA | `#scale-tabs [role=tab].on:active` takes `#c4bcab`, an existing token (rest is `#f1ece1`). The existing `:active{color:#eae6df}` stays for unselected tabs. |
| P nit (4) misleading `.62` comment above `#scale-preview.stale` | Lane SPA | The comment is rewritten so it no longer reads as if .62 applied to the example. No test, because it is a comment. |
| LG N1 range-change re-baseline unpinned | Lane SPN | New app test: a down fling while the range shrinks must not restore. |
| LG N2 T13 lacks a plate-tap-activates assert | Lane SPN | Amend the test the LG plan names T13. |
| LG N3 focused-box and tap e2e only at 390x797, R5 taps only top/bottom/box | Lane SPN | Add 380x780 and 320x568 to those loops, and make R5 tap every field and the plate. |
| LG N4 A2 title says "ends" but the code parks | Lane SPN | Retitle "... parks the gesture", and update the title in any mutant `# kills:`/`# suite:` header that names it. |
| LG N5 T26 filler assert, T1 compares snapshots | Lane SPN | Replace the filler with a real assertion, and compare T1 against the fixture values. |
| LG N6 F4 latch on a very fast flick | Device step 7.5.4 only | No code unless the step fails. A failure opens a follow-up lane under the third-review regroup rule. |
| T2 R2-1 to R2-4, A9 amendment to 3.7/3.8 | Not in this plan (NG8) | Owned by the post-main nits lane. |

## 5. Lanes

Order: SPN runs in parallel from the start. SPA, then SPB, then SPC run serially, then SPS only if Q3 is "build" and device steps 7.1-7.4 and 7.6 have passed. Each serial lane branches from `dev` after the previous lane's dev PR merges, because all four own `index.html` regions that touch the sheet CSS, the markup or the stops handler. SPN owns test files only, and only the tests it names, so it runs in parallel. Its new tests live in their own describe blocks (see 5.5), so its hunks are disjoint from SPA's. Whichever lane merges second rebases onto dev and re-runs its verify prefix. SPS is conditional (Q3, D-4).

Verify, every lane:
`python3 tools/sync_decks.py --check && python3 tools/inline_engine.py --check && node --test tests/app.test.js && python3 tools/validate.py`
plus the lane's `node --test --test-name-pattern '<prefix>' tests/e2e.test.js`, with one Chrome job at a time and never the full e2e suite locally. CI `validate` at the verified head SHA is the evidence.

### 5.1 Lane SPA: lip clearance, 9px lip, messages off the lip, CTA and tab nits
- Branch: `claude/sheet-polish-a` from dev.
- Goal: D-1, D-6, D-5 (O5-a, or O5-b per Q2), D-P5, P nits (3) and (4).
- Owns, in `index.html`:
  - the lip CSS rules (`#scale-sheet.lipped #scale-foot`, its `max-height:520px` and `.short` siblings, the `:has(#scale-guidance ...)` foot rule, `#scale-lip::after`);
  - a new `--lip-over` declaration beside `:root{--lip-ease...}`;
  - the `#scale-panel-scale, #scale-panel-layout` rule;
  - `lipWrite()` (the `--lip-g` write while `kbup`);
  - the lip remeasure on a guidance or footer-geometry change while `lipped` (codex 2): the condition in `restoreLip()` that gates the remeasure on `lipSettled`, and one call from each site that changes guidance (`say()` and the notice path of `paintLayout()`);
  - the order of the range re-baseline and the end-of-scroll restore in `lipScroll()` (codex 3);
  - `paintLayout()` (the `layoutHint.hidden` line only);
  - the `#scale-tabs [role=tab]` rules;
  - the comment above `#scale-preview.stale`.
- Owns in tests: the named tests below; the retitled lipped-guidance test "UX: lipped, an empty guidance slot ... stays --sp-2 plus --lip-over above the lip" and the `hit.foot` line of the 32x3 pill test; the mutants `ph_foot_4px.patch` (replaced), `uxl_guidance_always_hides.patch` (headers), the six context-refreshed mutants listed in D-6; and new `spa_*` mutants. SPA's new tests go in `describe("SPA: ...")` blocks placed after SPN's blocks (see 5.5).
- Acceptance, written first:
  - A1 "SPA: at 320x568, 380x780, 390x844, 844x390 and 1280x800, on the tab that scrolls, the last control ends at least --sp-2 above the lip's tap zone with the footer shut and no point of it hit-tests to #scale-lip" (e2e).
  - A2 "SPA: with the footer open the last control ends at least --sp-2 plus 16px above the hairline on both tabs" (e2e).
  - A3 "SPA: the shut footer is 9px, the 32x3 pill sits 3px above the footer's bottom and is centred, and the tap zone is 25px with its bottom on the surface's bottom above the inset" (e2e).
  - A4: retitle "UX: a real touch swipe down collapses the footer to a 9px lip, a swipe up restores it, with no flicker under momentum" (e2e, value 9).
  - A5 "SPA: a message shown while the footer is shut ends at least --sp-1 above the lip's tap zone and hit-tests to itself, keyboard up and down, at 320x568, 380x780, 390x844 and 844x390" (e2e). This test is red at 81ad610 (MS2).
  - A6 "SPA: a tap on a message above the shut lip does not restore the footer" (e2e).
  - A7 "SPA: with the keyboard up and a warning showing, a lip tap restores the footer and the message's bottom ends at or above GENERATE's top" (e2e, 380x780 and 393x852) (eng review P1-1). Kept as the settled case; A11 covers the transitions.
  - A10 "SPA: with the keyboard up and the lip shut at 390x844, the message's last line ends at least 4px above the lip's tap zone and its background is the sheet surface colour; sampled frames during the collapse and the restore keep its text off the primary, DELETE and the tap zone" (e2e) (design review F5, codex 1). It does not assert that the message is stationary.
  - A11 "SPA: guidance that appears, clears or grows from one to three lines at 40ms, 90ms and 150ms into a collapse or a restore, including an immediate reversal with the keyboard up, never puts its visible text over the primary, DELETE or the lip's tap zone in any sampled frame, at 320x568, 380x780, 390x844 and 844x390, with and without reduced motion" (e2e, create and Edit) (codex 2).
  - A12 "SPA: guidance appearing or clearing at the scroll end during a wheel window, a touch drag and its fling, keyboard up and down, changes the lip state zero times and starts no collapse and restore cycle" (e2e) (codex 3). It strengthens the kept "PH: P4 a message appearing while the footer is lipshut grows the slot without flipping the lip, and clearing it returns the slot to 0".
  - A8 "SPA: the CTA shows over the example plate and is hidden over a held plate" (app).
  - Re-point DR2's "DR2 lines 85, 132: the hint reads the empty sentence while the scale is empty or invalid and is hidden once the scale parses" to "... while the scale is empty, is hidden on an invalid scale that holds a plate and once the scale parses". Re-point "TB: the Layout tab with an empty or invalid scale shows the hint, the empty plate and every drawer control disabled and out of the Tab order" to "... an empty scale shows the hint ...; an invalid scale with a held plate hides it ...".
  - A9 "SPA: the selected tab's pressed colour differs from its rest colour" (e2e, via `CSS.forcePseudoState`).
- Mutants, each with `# kills:` set to its test:
  - `spa_panel_pad_dropped` (panel padding removed), killed by A1.
  - `spa_lip_over_zero` (`--lip-over:0px`), killed by A1 and A5.
  - `ph_foot_5px_again`, killed by A4 and A3.
  - `spa_pill_on_floor` (pill `bottom:0`), killed by A3.
  - `spa_msg_clearance_dropped` (the `:has()` foot margin back to 0), killed by A5.
  - `spa_restore_ignores_lipg` (`lipWrite` sets `--lip-g` to 0px), killed by A7 and A10.
  - `spa_msg_on_lip_bg` (the lipped guidance background removed), killed by A10.
  - `spa_no_midflight_remeasure` (the guidance-change remeasure removed, so only a settled lip remeasures), killed by A11.
  - `spa_restore_before_range_guard` (the end-of-scroll restore moved back above the range re-baseline in `lipScroll()`), killed by A12.
  - `spa_cta_on_held` (hint visibility back to `boxOk`), killed by A8.
  - `spa_tab_press_flat` (the `.on:active` rule dropped), killed by A9.
- Verify prefix: `'SPA:|UX: a real touch swipe down|UX: the lip draws|UX: lipped, an empty guidance|SG: N-A|PH: P4|PH: P3 at 390x797'`, plus `git apply --check` of every refreshed mutant.
- Non-goals: NG1-NG9. No change to LG constants, the zone height or scroll-padding. No move of `#scale-guidance` in the markup under O5-a.
- CLAUDE.md delta, in "Known pitfalls":
  - The `#scale-guidance` bullet gains one sentence on the lip clearance, citing A5 and A6, and one sentence that the message slides with the footer during collapse and restore but stays clear of the primary, DELETE and the tap zone, citing A10 and A11.
  - A new bullet "The footer lip" states the 9px shut foot, the 32x3 pill 3px up, the 25px zone, and the panel end padding, each citing A1, A3 and A4.
  - The lipped-guidance gap sentence, if one is added, cites the retitled "UX: lipped, an empty guidance slot ..." test.
  - The bullet keeps the A9 sentence as "the keyboard rising collapses the footer to the lip" with no test claim it cannot cite. A9's e2e title is cited if one exists; otherwise "(no test; true by `lipKbEdge`)".
- Device retest: 7.1, 7.2, 7.4.

### 5.2 Lane SPB: palette on the Layout tab
- Branch: `claude/sheet-polish-b` from dev after SPA's dev merge.
- Goal: D-2.
- Owns: the `#scale-panel-scale`/`#scale-panel-layout` markup (the palette row and its comment), the Tab-trap `keydown` handler's two stops arrays, `lipHandOff()`, the container-block rule placing the palette row in column 2, and the re-pointed tests listed in 3.2.
- Acceptance, written first:
  - B1 "SPB: #scale-swatches is the last child of #scale-panel-layout after #scale-layout-zone, in an .editrow whose span.sheetlabel#scale-palette-label (text CARD PALETTE) names the group through aria-labelledby" (app).
  - B2 "SPB: the Scale tab's Tab stops end box, primary, DELETE with no swatch; the Layout tab's run RESET LAYOUT, the six swatches, primary, DELETE, forward and back" (e2e, real Tab keys, create and Edit).
  - B3 "SPB: the swatches stay enabled on the Layout tab with an empty or invalid scale while every drawer control is disabled" (app).
  - B4 "SPB: at 380x780 a swatch picked on the Layout tab survives a switch to Scale and back and is the palette GENERATE CARDS saves" (e2e).
  - B5: re-pointed app test "UX: Tab onto the lip restores the footer and focuses GENERATE CARDS, DELETE when GENERATE is disabled on Edit, else the shown tab's last stop".
  - Plus the re-pointed e2e tests in 3.2 (RD Edit Tab order, the two refused-edit fold tests, the pan-warning Edit-open test, the two 44px hit-area tests, the options-only chip test).
- Mutants:
  - `spb_swatches_on_scale` (row back in the Scale panel), killed by B1.
  - `spb_stops_keep_swatches` (`...swatches.children` back in the Scale stops), killed by B2.
  - `spb_handoff_hidden_swatch` (fallback back to `swatches.lastElementChild` on both tabs), killed by B5.
  - `spb_swatches_need_box` (swatches disabled on `!boxOk`), killed by B3.
- Verify prefix: `'SPB:|RD: the Edit page|hit area|refused SAVE|edit onto another|options-only edit|a pan warning on the Edit open'`. Before the first commit, grep the tests for `aria-label="Card palette"` and `[aria-label=` on swatches and re-point each to the label id (design review F2).
- Non-goals: NG1-NG9. No colour or swatch size change. No new copy beyond the label "CARD PALETTE". No new row class. No rename of the Layout tab (see K13). `panelStops()` untouched.
- CLAUDE.md delta, in "Known pitfalls": a new sentence "The card palette is the last group of the Layout tab, labelled, enabled without a scale", citing B1-B3.
- Device retest: 7.3.

### 5.3 Lane SPC: landscape Layout, plate pinned, footer capped
- Branch: `claude/sheet-polish-c` from dev after SPB's dev merge.
- Goal: D-3 (O3-a, or TB-A2 kept per Q1, in which case only O3-d ships).
- Owns: the `@container surf (min-width:600px) and (min-aspect-ratio:1/1)` block, a new `--plate-w` on `.sheetsurf`, the `#scale-preview` width rule (it reads `--plate-w`), the `#scale-sheet.lipped` reset of the primary and delete-row insets, the `#scale-drawer-status` markup line and its sticky rules, `syncBand()` (the `--plate-pin-h` write and the band-plus-status sum), and the tests named below: the TB tests, the UX two-column test, "DR1 line 81" in `tests/app.test.js` and "DR2a browser (84)" in `tests/drawer_seats.test.js`.
- Acceptance, written first:
  - C1 "SPC: at 844x390 the Layout plate band lies inside the scrollport at the top and at the end of the scroll, footer open and shut, with no message, a one-line notice, a two-line warning, the Edit delete refusal, the refusal beside a notice, a re-armed DELETE, the notice with three ring-reset suffixes, and a multi-line drawer status from layoutStatus()" (e2e) (design review F1, codex 7, codex 8).
  - C2 "SPC: at 844x390 #scale-generate, #scale-guidance, the delete row and the lip share the controls column's left and right edges in the OPEN, SHUTTING, SHUT and OPENING states, on create and on Edit with DELETE visible, and no plate field hit-tests to #scale-lip with the footer shut" (e2e) (codex 6).
  - C3 "SPC: at 844x390 the drawer status line, one line and multi-line from layoutStatus(), heads the controls column under the tab strip and adds no height to the plate band" (e2e) (codex 7).
  - C4 "SPC: at 844x390 the Scale tab, and at 1280x800 both tabs, keep the 81ad610 rects of the footer, the controls, the drawer status and the preview's width and height" (e2e, with the baseline from Table M, rows Mc4-Mc7) (codex note on 1280).
  - C5 "SPC: at 844x390 the pan size does not change when the footer collapses or restores, with no message and in every guidance state of C1" (e2e) (codex 8).
  - C6 "SPC: at 380x780 and 380x667 the drawer status keeps its 81ad610 rect relative to the plate at the top of the scroll and stays pinned under the band at the end" (e2e) (codex 7).
  - Supersede, OWNER GATE Q1: "TB: at 844x390 the Layout tab's .sheetsurf is wider than 600px, the tab strip sits right of the plate and the pan is at least 304px" becomes "... the pan fills the open-footer scrollport less the band padding and guidance and, with no message, is at least 270px". "UX: Adjust layout is two columns at 844x390 with the large pan >=280px, one column at 500x390" asserts `plate >= 280`, which the 274px baseline breaks; it becomes "... with the pan >=270px with no message ...". In "TB: at 320x568, 380x780, 393x852, 844x390 and 1280x800 the Layout pan is wider than the old small pan clamp(88px, 30cqw, 160px) and at least the section 3.6 width minus 2px", the 844x390 row is re-pointed to 274. The other rows are unchanged.
  - Re-point, codex 7: "DR1 line 81" (app) and "DR2a browser (84)" (drawer_seats), as worded in D-3.
- Mutants:
  - `spc_band_relative` (sticky dropped), killed by C1.
  - `spc_reserve_72` (reserve back to 72px), killed by C1.
  - `spc_footer_full_width` (cap dropped), killed by C2.
  - `spc_status_under_plate` (the status markup back inside the band), killed by C3 and the retitled DR1 line 81.
  - `spc_status_not_pinned` (the portrait `position:sticky` on the status dropped), killed by C6 and "DR1 line 82".
  - `spc_double_inset` (the lipped reset of the primary and delete-row insets dropped), killed by C2.
  - `spc_size_from_live_port` (the pan sized from the current scrollport, so it grows when the footer shuts), killed by C5.
  - `spc_cap_outside_container` (rules moved to the bare media query), killed by C4.
  - `spc_band_ignores_guidance` (band height not reduced while guidance shows), killed by C1.
- Verify prefix: `'SPC:|TB: at|UX: Adjust layout|DR1 line 8'`, plus `node --test --test-name-pattern 'DR2a browser' tests/drawer_seats.test.js`.
- Non-goals: NG1-NG9. No portrait change, no Scale-tab change, no 1280x800 change, no tab-strip pinning (N9 stands).
- CLAUDE.md delta: the DI bullet's "In a real browser" sentence keeps its DI tests, and gains a landscape sentence citing C1, C2 and C4, and a sentence that the drawer status heads the controls column in landscape and stays pinned under the plate elsewhere, citing C3 and C6.
- Device retest: 7.6.

### 5.4 Lane SPS: tab swipe (only if Q3 is "build"; not recommended, see D-4)
- Gate: starts only if the owner answers Q3 "build", and only after device steps 7.1-7.4 and 7.6 pass on DEV.
- Branch: `claude/sheet-polish-s` from dev after SPC's dev merge.
- Goal: D-4 (O4-a).
- Owns: new passive `touchstart`, `touchmove`, `touchend` and `touchcancel` listeners on `.sheetbody` (named `tabSwipe*`), beside `setTab()`. They share no state with `lipDrag`. Also, per codex 4, the shared swipe-to-tab hand-off (clearing `lipFling`, ending a parked `lipDrag`, re-baselining) and the suppression deadline written into `lipQuietUntil`. SPS may change those shared hand-off and lip guard lines and nothing else in the lip code, and changes no gesture constant.
- Acceptance, written first:
  - S1 "SPS: a one-finger 48px leftward swipe with |dx| at least twice |dy| selects Layout and a rightward one selects Scale; 47px or |dx| under 2|dy| selects nothing" (app).
  - S2 "SPS: a swipe starting on the plate, the lip, the focused field or a select, within 24px of either edge, with the keyboard up, or with a second finger selects nothing, and a start on the plate stays excluded when the finger moves off it" (app).
  - S3 "SPS: a swipe whose touch scrolled the body more than 8px at any point, out and back included, or lasted more than 600ms, selects nothing" (app) (codex 5).
  - S7 "SPS: a hold on an unfocused field for HOLD_MS before a horizontal drag, a keyboard rising mid-gesture, a second finger that lifts before touchend, and a textarea's internal scroll each cancel the swipe" (app) (codex 5).
  - S4a "SPS: after a horizontal swipe switches tabs, residual momentum from the gesture changes the lip state zero times until touchend + LIP_END_MS" (e2e, 380x780) (eng review P2-1, codex 4).
  - S4c "SPS: a fresh vertical drag that starts within LIP_END_MS of a swipe switch scrolls the new panel natively and changes the lip state zero times until the deadline" (e2e, 380x780) (codex 4).
  - S4b "SPS: a swipe leaves LIP_PX, LIP_SWIPE, LIP_WINDOW, LIP_END_MS and HOLD_MS unchanged" (app).
  - S5 "SPS: at 390x844 with touch emulation a real 80px horizontal swipe on the fields switches tabs and a real 80px vertical drag does not" (e2e).
  - S6 "SPS: the swipe listeners are passive" (app).
  - The existing "PH: P3 a drag with a second finger or mostly sideways changes the lip zero times across the gesture and its settle, at 390x797 and 380x780" stays green unchanged.
- Mutants:
  - `sps_no_axis_lock`, killed by S1.
  - `sps_switch_before_fling_end` (the swipe's `setTab` skips `lipReset`), killed by S4a.
  - `sps_fling_survives_switch` (the hand-off leaves `lipFling` set), killed by S4a.
  - `sps_scroll_ignores_deadline` (the deadline not written, so `lipScroll()` and `lipFlingStep()` see only the 150ms quiet window), killed by S4a.
  - `sps_touch_ignores_deadline` (the sheet-capture `touchmove` path drops its `lipQuietUntil` check), killed by S4c.
  - `sps_endpoint_scroll_only` (the excursion check replaced by start-to-end displacement), killed by S3.
  - `sps_multitouch_start_only` (a second finger checked only at touchstart), killed by S7.
  - `sps_no_hold_cancel` (the HOLD_MS fresh-field cancel dropped), killed by S7.
  - `sps_plate_allowed`, killed by S2.
  - `sps_kbup_allowed`, killed by S2.
  - `sps_edge_allowed`, killed by S2.
  - `sps_scroll_guard_dropped`, killed by S3.
  - `sps_not_passive`, killed by S6.
- Verify prefix: `'SPS:|PH: P3|LG:'`.
- Non-goals: NG1-NG9. No panel slide animation, no history entry, no change to the plate's listeners, and no change to the lip's listeners beyond the hand-off and deadline lines named in Owns.
- CLAUDE.md delta: a sentence in "Known pitfalls" that a horizontal swipe switches tabs, with its exclusions and cancellations, citing S1-S3 and S7, and that a switch suppresses lip changes until touchend + LIP_END_MS, citing S4a and S4c.
- Device retest: 7.5.

### 5.5 Lane SPN: tests-only nits
- Branch: `claude/sheet-polish-n` from dev, in parallel with SPA.
- Goal: LG N1-N5, P nits (1) and (2).
- Owns: `tests/app.test.js` and `tests/e2e.test.js`, only for the tests named in section 4 plus new `SPN:` tests, and any mutant whose header names a retitled test. No `index.html` change.
- Placement (eng review P2-3): SPN puts its new tests in its own `describe("SPN: ...")` blocks after the last LG block in each file. SPA puts its tests in `describe("SPA: ...")` blocks after SPN's anchor. Whichever lane merges to dev second rebases onto dev and re-runs its verify prefix before its dev PR, because a CONFLICTING PR queues no CI.
- Acceptance:
  - N-1 "SPN: a down fling while the scroll range shrinks re-baselines and does not restore" (app).
  - N-2: T13 asserts the plate tap selects the note.
  - N-3: the focused-box and tap e2e tests run at 380x780 and 320x568 as well, and R5 taps every field and the plate.
  - N-4: the A2 test is retitled to say the scroll key parks the gesture.
  - N-5: T26's filler is replaced and T1 compares fixture values.
  - N-6 "SPN: the example plate's fields equal HPE.importer.compose of the four placeholder attributes" (app).
  - N-7: the PH example test asserts none of E3, B3 or F#5.
- Mutants:
  - `spn_fling_rebase_dropped` (the range-change re-baseline in `lipFlingStep` removed), killed by N-1.
  - `spn_example_from_box_placeholder` (example seed from `scaleBox.placeholder`), killed by N-6 (if an existing `ph_*` mutant already does this, its header gains N-6 instead).
- Verify prefix: `'SPN:|LG:'`.
- Non-goals: any product code. The memory rule "N2-N6 go serial after the LG retest" is met: the owner's "very smooth" is the retest result.
- CLAUDE.md delta: none (no behaviour change).
- Device retest: none.

## 6. Tests and mutants table

| Lane | New or changed test | Kind | Mutant that must die |
|---|---|---|---|
| SPA | A1 last control clears the zone, shut | new e2e | spa_panel_pad_dropped, spa_lip_over_zero |
| SPA | A2 last control clears the hairline, open | new e2e | spa_panel_pad_dropped |
| SPA | A3 9px foot, pill 3px up, 25px zone | new e2e | spa_pill_on_floor, ph_foot_5px_again |
| SPA | A4 UX swipe-down test retitled 9px | changed e2e | ph_foot_5px_again |
| SPA | A5 message clears the zone, hit-tests to itself | new e2e | spa_msg_clearance_dropped, spa_lip_over_zero |
| SPA | A6 tap on the message does not restore | new e2e | spa_msg_clearance_dropped |
| SPA | A7 lip tap under the keyboard: message stays above GENERATE | new e2e | spa_restore_ignores_lipg |
| SPA | A10 message 4px above the tap zone on the surface colour, clear in sampled frames | new e2e | spa_msg_on_lip_bg, spa_restore_ignores_lipg |
| SPA | A11 guidance changing mid-collapse or mid-restore stays clear | new e2e | spa_no_midflight_remeasure |
| SPA | A12 guidance at the scroll end never flips the lip; PH: P4 kept | new e2e | spa_restore_before_range_guard |
| SPA | "UX: lipped, an empty guidance slot ..." retitled to sp-2 plus --lip-over | changed e2e | uxl_guidance_always_hides (headers retitled) |
| SPA | "UX: the lip draws a 32x3 pill ...": `hit.foot - 9` | changed e2e | ph_foot_5px_again |
| SPA | A8 CTA example-only | new app | spa_cta_on_held |
| SPA | DR2 lines 85, 132; TB empty-or-invalid | changed app | spa_cta_on_held |
| SPA | A9 selected tab press colour | new e2e | spa_tab_press_flat |
| SPA | ph_pill_36x4, uxl_no_scroll_padding, uxl_zone_44, uxl_guidance_always_hides, uxl_height_transition, uxl_motion_reduced | refreshed context (`git apply --check`) | unchanged kills |
| SPB | B1-B4, B5 | new app/e2e, changed app | spb_swatches_on_scale, spb_stops_keep_swatches, spb_swatches_need_box, spb_handoff_hidden_swatch |
| SPB | RD Edit Tab order; two refused-edit fold tests; pan-warning Edit-open test; two 44px tests; options-only chip test | changed e2e | existing kills unchanged |
| SPC | C1-C6 | new e2e | spc_band_relative, spc_reserve_72, spc_footer_full_width, spc_status_under_plate, spc_status_not_pinned, spc_cap_outside_container, spc_band_ignores_guidance, spc_double_inset, spc_size_from_live_port |
| SPC | TB 844x390 304px test; UX two-column >=280px test; TB 3.6 widths row | superseded (OWNER GATE Q1) | spc_reserve_72 |
| SPC | DR1 line 81 (app) retitled; DR2a browser (84) (drawer_seats) re-pointed; DR1 lines 82 and 87 kept | changed and kept | spc_status_under_plate, spc_status_not_pinned |
| SPS (only if Q3 is build) | S1-S3, S4a, S4b, S4c, S5-S7 | new app/e2e | sps_no_axis_lock, sps_switch_before_fling_end, sps_fling_survives_switch, sps_scroll_ignores_deadline, sps_touch_ignores_deadline, sps_plate_allowed, sps_kbup_allowed, sps_edge_allowed, sps_scroll_guard_dropped, sps_endpoint_scroll_only, sps_multitouch_start_only, sps_no_hold_cancel, sps_not_passive |
| SPN | N-1 to N-7 | new or changed app/e2e | spn_fling_rebase_dropped, spn_example_from_box_placeholder |

Every mutant header follows the repo rules: `# suite:` patterns use `.` for spaces (word-split), no `index` lines, and the patch is anchored on the removed line rather than on hunk numbers.

## 7. Device retest script (owner, on DEV, iPhone)
Pass bar for every step: the stated result on every repetition, zero misses on drags of 24px or more (LG's bar), and zero focus regressions.

7.1 SPA, lip clearance (portrait).
1. Add sheet, type a scale, go to Layout and scroll to the end. RESET LAYOUT has visible space above the pill and the hairline with the footer open and shut.
2. Tap the lower half of RESET LAYOUT five times. It resets every time, and the footer never opens.
3. On the Scale tab (empty and typed), scroll to the end. The last row has the same space, and a small scroll there does not open or close the footer by itself.

7.2 SPA, messages (portrait).
1. Type `D3 A3` (no ding) so an error shows, then tap into the box so the keyboard rises. The error may slide down with the footer as it collapses (O5-a), but at no moment does it touch GENERATE, DELETE or the pill, and once settled it sits above the pill.
1a. With the keyboard up, type quickly so the error appears and clears while the footer is still collapsing, then tap the lip. The error never paints over GENERATE or DELETE.
2. Tap the error text five times. The footer does not open.
3. Dismiss the keyboard. The error stays readable, and opening the footer moves it up above GENERATE.

7.3 SPB, palette (portrait).
1. The Scale tab shows no swatches. Layout ends with the "CARD PALETTE" label and six swatches under RESET LAYOUT.
2. With the box empty, the swatches still respond on Layout.
3. Pick swatch 4, switch tabs twice, and press GENERATE CARDS. The new deck uses palette 4.
4. Edit an existing deck. Starting on the Scale tab, without being told where, change only its palette and SAVE. Note whether the Layout tab was the first place tried. The chip keeps its place (design review F3).

7.4 SPA, 9px lip (portrait and landscape).
1. Collapse the footer by a finger drag. The pill is visibly lifted off the bottom edge and the home indicator.
2. Run LG's D1-D10 once each. All pass at LG's bar.
3. Tap anywhere along the bottom 25px. The footer opens every time.

7.5 SPS, swipe (portrait; only if Q3 is "build", run after 7.1-7.4 and 7.6 pass). Without SPS, step 4's D8 fast-flick check (nit N6) still runs once, after 7.4.
1. On the Scale tab, swipe left across the fields. Layout shows. Swipe right on Layout's controls. Scale shows.
2. Swipe on the plate. It moves no tab, and a note drag still works.
3. With the keyboard up, swipe on the box. The caret moves or nothing happens, and the tab does not change.
3a. Hold a finger still on an unfocused field until selection starts, then drag sideways. Text selection wins and the tab does not change. Scroll the fields down and back up in one touch, ending sideways. The tab does not change.
3b. Swipe to switch tabs, then immediately drag up or down on the new panel. It scrolls, and for that first moment the footer neither opens nor shuts. A drag a second later works as usual.
4. Start a swipe at the left screen edge. Safari's back gesture (closing the sheet) behaves as before, and no tab switch happens first. Then run LG's D8 very-fast flick ten times (nit N6). The lip latches correctly every time.
5. Scroll with a diagonal thumb ten times. The tab never changes.
6. Run LG's D1-D10 again. All pass, and the owner still rates the lip "very smooth".

7.6 SPC, landscape.
1. Turn the phone to landscape on Layout with a typed scale. The whole pan is visible, and scrolling the controls to the end leaves the pan in place, footer open and shut.
1a. Tap an anchor button so the layout notice shows, then scroll the controls to the end. The whole pan is still visible, no notes are cut off at the bottom, and the notice is readable under the controls column (design review F1).
1b. Select a note on the pan so the status line shows. It sits at the top of the controls column, under the tabs, and the pan does not shrink or move.
2. GENERATE CARDS and the pill sit under the controls column, not under the pan, and they keep the same left and right edges while the footer collapses and restores. On Edit with DELETE showing, the same holds.
3. Tap the pan's lowest notes. They select, and the footer does not open.
4. Switch to the Scale tab. The layout is as before.
5. On a desktop at 1280x800, nothing changed.
6. Back in portrait on Layout, select a note and scroll the controls to the end. The status line stays under the pan, where it was before.

## 8. Gates (copied from the binding sources)
- Branch from `dev`. Each lane opens PR D with base `dev` and a separate PR M with base `main`. PR M stays HELD: "merging to main should be explicit from me".
- PR D merges with `gh pr merge <D> --merge` after both of these, at the same SHA:
  - CI `validate` is green at the verified head SHA (`gh pr view <pr> --json state,headRefOid` equals the local tip, and the run conclusion is read from `gh run list --commit <sha> --workflow validate.yml`);
  - an independent fresh reviewer subagent returns PASS or PASS_WITH_NITS. The reviewer checks out that SHA in its own worktree, runs /review read-and-report only, and is briefed with branch, base, SHA, acceptance criteria, goals, non-goals and ownership.
- After every dev merge, the main-to-dev sync rule of the DEV environment applies as written in CLAUDE.md.
- A third failed review of the same lane triggers the AFK regroup (investigation prompt plus subplan at a 10/10 bar, /plan-eng-review, then resume).
- The README mutant count and `tests/FLOORS` rows are set by the integrator from CI artifacts, never by a lane.
- Owner questions Q1-Q3 gate the rows marked OWNER GATE. Lanes run their non-gated rows meanwhile.

## 9. Risks

| ID | Risk | Caught by |
|---|---|---|
| K1 | Panel end padding changes the scroll range on short sheets and a wheel or drag behaves differently | "PH: P3 at 390x797 a wheel on a sheet with no room never collapses; with room it collapses" (kept), step 7.1.3 |
| K2 | The 9px foot shifts the lip's settle or slide (LG regression) | A3, A4, the LG e2e set in SPA's Verify, step 7.4.2 |
| K3 | Guidance insertion or removal resizes the scrollport and clamps `scrollTop`, and that geometry-made scroll is read as user travel or an end-of-scroll restore (codex 3). The range is re-baselined before the restore branch is read | A12, "PH: P4 a message appearing while the footer is lipshut grows the slot without flipping the lip ...", A5, mutant spa_restore_before_range_guard |
| K4 | WebKit drops panel padding at the scroll end | A1 in CI (Chromium) does not prove WebKit, so step 7.1.1 on the iPhone is the oracle |
| K5 | Palette move leaves a hidden swatch as a Tab stop or a lip hand-off target | B2, B5 |
| K6 | The landscape pan shrink makes plate targets too small; also the band clipping under a message | C1 and the 44px-targets tests in Verify; steps 7.6.1a and 7.6.3 |
| K7 | The `--plate-w` cq units resolve against a different container for the footer than for the preview | C2 (edge equality) |
| K8 | A swipe fires during a diagonal scroll | S3, step 7.5.5 |
| K9 | A swipe interferes with iOS edge back-swipe | S2 (edge exclusion), step 7.5.4 |
| K10 | Swipe degrades LG smoothness | S4a, S4c, "PH: P3 ... mostly sideways ...", step 7.5.6 |
| K11 | Stale mutant patches after the lip line edits | `git apply --check` of every refreshed patch in SPA, CI's mutation gate |
| K13 | A palette-only edit has weak scent under a tab named Layout | step 7.3.4. If the owner misses it, a follow-up renames the tab (for example LAYOUT & COLOUR) under a separate owner question; this plan does not rename (design review F3) |
| K14 | With the keyboard up, a lip tap opens the footer and a held message paints over GENERATE | A7, mutant spa_restore_ignores_lipg (eng review P1-1) |
| K15 | A residual fling or a fresh vertical drag after a swipe switch changes the lip on the new tab, because `lipReset()` neither clears `lipFling` nor opens a quiet window (SPS only, codex 4) | S4a, S4c, the four deadline mutants, steps 7.5.3b and 7.5.6 |
| K16 | SPA and SPN conflict in the e2e file and the CONFLICTING PR queues no CI | separate describe blocks, rebase-second rule (5.5) |
| K17 | A message that appears, clears or grows during a collapse or restore leaves `--lip-g` stale, and a reversal brings the primary back over it (codex 2) | A11, mutant spa_no_midflight_remeasure, step 7.2.1a |
| K18 | The controls-column inset is applied to the foot and again to its children when lipped (codex 6) | C2 in all four lip states, mutant spc_double_inset, step 7.6.2 |
| K19 | Moving the drawer status out of the band loses its portrait pin or the focus scroll-padding (codex 7) | C6, "DR1 line 82", "DR1 line 87", mutant spc_status_not_pinned, step 7.6.6 |
| K20 | A swipe accepted after a hold, an out-and-back scroll or a lifted second finger steals a selection or a scroll (SPS only, codex 5) | S3, S7, steps 7.5.3a and 7.5.5 |
| K12 | N-A5 passes while the probe shows the lip covering the message (MS2): the test's state may differ from the user's | A5 asserts the lip-shut, keyboard-up case directly. SPA's first commit records why N-A5 missed it |

## 10. Owner questions (recommended option first)
- Q1 (D-3, supersedes TB-A2). In landscape on the Layout tab, should the pan be pinned and sized to fit the screen with the footer open (about 274px with no message, about 10% smaller note targets, and a little smaller again while a message shows; it keeps one size while the footer opens and shuts) (recommended), or should it keep today's 306px with its lower part reached by scrolling, capping only the footer to the controls column?
- Q2 (D-5). Two screenshots at 390x844, keyboard up and lip shut, are attached (lane SPA produces them; the integrator attaches them). A (recommended, O5-a): the message stays in its slot above the buttons and clear of the lip. It is not stationary: when the keyboard rises it slides down with the footer as the footer collapses, and back up when the footer restores. At no moment does it overlap GENERATE, DELETE or the lip. B (O5-b): the message sits under the sheet header and never moves, but it is far from the field and the buttons, and it supersedes the SG: N-A2 order and decision X3. If you need the message to stay still while the footer moves, A is not acceptable: choose B.
- Q3 (D-4). Do not build the tab swipe now (recommended; re-ask after the device retest of items 1, 2, 3, 5 and 6 passes), or build it as a fenced last lane (passive, decided at touchend, plate, edges and keyboard excluded, no motion, separately revertable)?

### 10.1 Owner answers (2026-10-21)
- Q1: pin and fit (O3-a). TB-A2 is superseded; the OWNER GATE Q1 rows ship.
- Q2: A (O5-a). The message stays in its slot, clear of the lip, and may move with the footer. Lane SPA still posts the two 390x844 screenshots for the owner's visual check before its dev PR merges; the O5-b rows are dropped.
- Q3: do not build now. Lane SPS is dropped; re-ask after device steps 7.1-7.4 and 7.6 pass.

## 11. Review log

Sources: `scratchpad/polish-plan-design-review.md` (plan-design-review, F1-F5) and `scratchpad/polish-plan-eng-review.md` (plan-eng-review, P1-1 to P1-3, P2-1 to P2-3, P3).

| Finding | Disposition | Sections changed |
|---|---|---|
| Design F1, landscape plate with a message showing | Adopted as written | 3.3 (D-3 last bullet), 5.3 (C1, `spc_band_ignores_guidance`), 6, 7.6.1a, 9 (K6) |
| Design F2, palette label copy and row pattern | Adopted as written | 3.2 (D-2 markup bullet), 5.2 (B1, Verify, non-goals), 7.3.1 |
| Design F3, palette scent on Edit | Adopted. The risk is K13, not K8, because K8 was already taken | 7.3.4, 9 (K13), 5.2 non-goals |
| Design F4, do not build the swipe now | Adopted. O4-b is now recommended, and SPS stays fully specified behind Q3 and device steps 7.1-7.4 and 7.6 | 1.1, 3.4 (options, D-4), 5 (order), 5.4 (gate), 6, 7.5, 10 (Q3) |
| Design F5, Q2 asked with screenshots; visual contract | Adopted. Added test A10 and mutant `spa_msg_on_lip_bg` so the 4px and surface-colour contract has a test written first. SPA produces the screenshots and the integrator attaches them | 3.5 (D-5), 5.1 (A10), 6, 10 (Q2) |
| Eng P1-1, the `--lip-g` hold paints the message over the primary | Adopted. The hold is dropped, no `kbup` guard is added to `restoreLip`, A7 is reworded as the review words it, and `spa_lipg_under_kb` is replaced by `spa_restore_ignores_lipg` | 3.5 (D-5), 5.1 (A7, mutants), 6, 9 (K14) |
| Eng P1-2, unlisted lipped-guidance gap test | Adopted as written | 3.5 (D-5 test list), 5.1 (Owns, Verify, CLAUDE.md delta), 6 |
| Eng P1-3, the pill test also asserts 5px; full 5px blast radius | Adopted as written | 3.6 (D-6), 5.1 (Owns, Verify), 6 |
| Eng P2-1, residual fling after a swipe | Adopted, with one adaptation: the review labels S4 "SPB:", which is read as a typo for "SPS:" because the swipe is lane SPS. The old S4 constant check is kept as S4b, and `sps_switch_before_fling_end` is added | 3.4 (D-4), 5.4 (S4, S4b, mutant), 6, 9 (K15) |
| Eng P2-2, pan-warning Edit-open test missing from the re-point list | Adopted as written | 3.2 (D-2 list), 5.2 (acceptance, Verify), 6 |
| Eng P2-3, SPA and SPN conflict at the LG describe ends | Adopted as written | 5 (order), 5.5 (placement), 9 (K16) |
| Eng P3, D-1 cites a 390x797 test against a 390x844 figure | Adopted: SPA confirms the clearance at 390x797 too. The other P3 notes confirm existing text, so nothing changed for them | 3.1 (D-1), 5.1 (Verify) |

The two reviews conflict once. Design F4 recommends not building the swipe; eng P2-1 tightens the swipe's spec. Both are kept: F4 sets the recommendation and P2-1 sets the spec SPS runs under if the owner says "build". No finding was rejected.

### 11.1 Codex adversarial review

Source: `scratchpad/codex-polish-review.md` (/codex, verdict PLAN_SOUND_WITH_FIXES; 2 P1, 6 P2). Each finding was checked against `index.html` at 81ad610 in `wt-polish-plan` before it was adopted.

| Finding | Code evidence at 81ad610 | Disposition | Sections changed |
|---|---|---|---|
| Codex 1 (P1), D-5's stationary-message contract contradicts its implementation | `collapseLip()` calls `lipWrite()`, which sets `--lip-g` to the guidance's open offset when `lipText()` holds text; `#scale-sheet.lipshut` then transitions `#scale-guidance` to zero, so the message slides | Adopted with codex's text. "Does not move" is removed from D-5 and 7.2.1; A10 now samples frames during both transitions and asserts no stationarity; Q2 states the motion | 3.5 (O5-a, D-5), 5.1 (A10, mutants, CLAUDE.md delta), 6, 7.2.1, 10 (Q2) |
| Codex 2 (P2), a message appearing mid-collapse bypasses the remeasure | `restoreLip()` remeasures only inside `if (lipSettled)`; `say()` and `paintLayout()` never call `lipWrite()` | Adopted with codex's text, plus NG4's limit: the remeasure is called from the guidance call sites, with no rAF and no ResizeObserver | 3.5 (O5-a), 5.1 (Owns, A11, `spa_no_midflight_remeasure`), 6, 7.2.1a, 9 (K17) |
| Codex 3 (P2), clearing guidance can restore the lip through a layout-made scroll | `lipScroll()` runs `if (isLipShut() && t >= M - 1) { restoreLip(); return; }` before `if (M !== prev.M) { lipAcc = 0; return; }`, inside the `userWindowUntil` wheel window | Adopted with codex's text. One precision: `lipScroll()` and `lipFlingStep()` both return while `kbup`, so the keyboard-up rows of A12 prove that guard rather than a second path | 3.5 (O5-a), 5.1 (Owns, A12, `spa_restore_before_range_guard`), 6, 9 (K3) |
| Codex 4 (P1), S4 cannot be satisfied by `setTab()` then `lipReset()` | `lipReset()` clears the lip classes and variables and calls `lipRebase()`, but sets neither `lipFling = null` nor `lipQuietUntil`; the sheet-capture `touchmove` calls `collapseLip()` on a fresh drag | Adopted with codex's text, made concrete: the deadline is written into the existing `lipQuietUntil`, which `lipScroll()`, `lipFlingStep()` and the sheet-capture `touchmove` already check. S4 is split into S4a (residual momentum) and S4c (fresh vertical drag); three mutants added beside `sps_switch_before_fling_end`. The false D-4 sentence is replaced | 3.4 (O4-a, D-4), 5.4 (Owns, S4a, S4c, mutants, non-goals, CLAUDE.md delta), 6, 7.5.3b, 9 (K10, K15) |
| Codex 5 (P2), a start/end pair cannot enforce whole-gesture exclusions | The lip's own `touchmove` abandons a fresh-field gesture held past HOLD_MS and a gesture whose `box.scrollTop` changed; the planned swipe pair had neither and compared scroll only at the endpoints | Adopted with codex's text: lifecycle listeners with sticky cancellation, maximum-excursion scroll check, original identifier and start target | 3.4 (O4-a), 5.4 (Owns, S2, S3, S7, mutants), 6, 7.5.3a, 9 (K20) |
| Codex 6 (P2), O3-d insets twice when lipped | CSS: `#scale-foot, #scale-footclip, #scale-footslide{display:contents}` open; `#scale-sheet.lipped #scale-foot{display:block; position:relative ...}` and `#scale-sheet.lipped #scale-footslide{display:flex ...}` lipped; `lipRead()`/`lipWrite()` carry no horizontal geometry | Adopted with codex's text | 3.3 (O3-d), 5.3 (Owns, C2, `spc_double_inset`), 6, 7.6.2, 9 (K18) |
| Codex 7 (P2), the status cannot reach column 2 by grid placement | Markup: `#scale-drawer-status` is the last child of `#scale-plate-band`; the container block makes `.sheetbody` the grid and `#scale-panel-layout` `display:contents`, so the band, not the status, is the grid item | Adopted, taking codex's first route: a markup move to the panel's next element after the band, which becomes a column 2 grid item in landscape. Stricter than codex's text: portrait and 1280x800 keep the status pinned under the plate through a sticky rule and `syncBand()`, pinned by new C6 and the kept DR1 lines 82 and 87. Supersedes the `_markupParent` assert of "DR1 line 81" and re-points "DR2a browser (84)" | 3.3 (O3-a, D-3), 5.3 (Owns, C1, C3, C4, C6, mutants, Verify, CLAUDE.md delta), 6, 7.6.1b, 7.6.6, 9 (K19) |
| Codex 8 (P2), the sizing mechanism is unresolved and one option contradicts C5 | `syncBand()` only measures and toggles `nostick` and `--plate-band-h`; nothing sizes the pan from a scrollport, and a live-scrollport size grows on collapse | Adopted with codex's text: size from the open-footer scrollport with current guidance, held through transitions, 274px as the no-message baseline, every growth state tested, conflicts reported before any requirement changes. Found while checking: "UX: Adjust layout is two columns at 844x390 with the large pan >=280px, one column at 500x390" also pins the old size and is added to the Q1 supersessions. C4 now compares the preview's dimensions (codex's 1280 note) | 3.3 (O3-a, D-3), 5.3 (C1, C4, C5, supersessions, `spc_size_from_live_port`), 6, 10 (Q1) |
| Codex note, 21px scroll padding | No defect: a 9px foot leaves a 16px overhang and 21px keeps 5px of clearance | No change; D-6 already says so | none |

No codex finding was rejected. The codex review and the eng review meet once: eng P1-1 rejected a `--lip-g` hold, and codex 1 shows the message therefore moves. Both stand: the hold stays dropped, and the contract is restated as clearance, with the motion put to the owner in Q2.
