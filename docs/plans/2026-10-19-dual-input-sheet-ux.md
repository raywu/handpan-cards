# Dual input, sub-workstream "sheet UX": execution subplan (2026-10-19)

Status: DRAFT for /plan-design-review then /plan-eng-review. Every owner-taste call is in section 5 as an OPEN DECISION with a recommendation.
Base: `claude/dual-input-ux-base` = `origin/claude/dual-input-kb2b` (head at wave 0; 68060ed at plan time, PR #404) merged with `origin/claude/inner-below-rim-a` (0131672, PR #403). Nothing here builds on `origin/dev` or `main`.

The owner's request, verbatim (binding):
> "UI/UX improvements ... 1. There are currently three different handpan visual sizes; let's reduce to two. 2. When opening the Add/Edit Scale sheet, we should default to small handpan visual with 4 input text fields on the right 3. When clicking on the handpan visual, it should bring up the Adjust Layout full screen drawer and hide all scale edit input fields. Adjust layout should focus on moving notes and changing layout. Back button goes back to Add/Edit Scale Sheet. 4. Save / Generate drawer should be minimized as the user is scrolling down, with the lip tappable to reopen. Scrolling back up should bring unminimize the drawer. Google Maps and AirBnB have this behavior to maximize the viewport. Opening the keyboard should also minimize the drawer until keyboard is dismissed."
> "This above should be part of dual-input workstream since the current UX needs to be improved"

## 1. Goal and non-goals

**Goal.** On the Add and the Edit sheet, at 380x780, 320x568, 393x852 with a 336px keyboard, 844x390 and 1280x800:
- the sheet opens with a SMALL pan left of the four note fields;
- a tap on that pan, or on ADJUST LAYOUT, opens a full-screen Adjust layout layer that holds a LARGE pan and the layout controls and no scale input, and that BACK, Escape and the phone back gesture close, returning to the sheet;
- the GENERATE CARDS / SAVE CHANGES footer collapses to a tappable lip on a user scroll down and while the keyboard is up, and expands again on a scroll up, at the end of the content, on keyboard dismiss and on a lip tap.

Each of these is proven by the tests named in section 6.

**Non-goals.**
- No change to the engine (`src/engine/*`), `data/decks.json`, the DECKS line, diagram geometry, the label rule, print or the PDF.
- No change to dual-input semantics: compose and parse, the active and passive paths, field messages and the DI app tests, apart from the Tab-order test that D10 names.
- No change to inner-below-rim (lane A) behaviour or copy.
- No change to the layout-control logic: seats, mirrors, orientation, RESET LAYOUT, the pick/drag state machine (DR2a and DR2b rules) and status rows. Only where they render changes.
- No change to keyboard detection (applyKbOffset models A to D, kbBase, short/side/tiny, kbCap, kbOffset) beyond one call into the lip. KB2/KB2b focus reveal and the pin keep their behaviour.
- The settings panel, About and the share/route code are untouched. The address bar keeps ending on the deck's route.
- No new analytics event (D13 lists one as an option only).
- `drawerPaused` (a scale that stops parsing under the open drawer) becomes unreachable from the UI, because Adjust layout has no input. Its code and app tests stay; removing it is out of scope.

## 2. Current state (merged base tree)

**Markup.**
- `#scale-sheet > .sheetsurf` is a size container, `container: surf / size`.
- `.sheethead`: `#scale-back` "← BACK", `h2#scale-title`.
- `.sheetbody` is the scroller (`overflow-y:auto; overscroll-behavior:contain`, hairline bottom border). It holds:
  - `#scale-name-row` (Edit only);
  - `.scalestage`:
    - `#scale-plate-band`: `#scale-preview` (role img) and `#scale-drawer-status`;
    - `.scalecol`: `#scale-fields` (heading "YOUR SCALE, NOTE BY NOTE", four `.fieldrow`) and the `#scale-box` row;
  - `#scale-layout-zone`:
    - `#scale-layout-row`: `#scale-layout-toggle` "ADJUST LAYOUT" with aria-expanded, aria-controls, an aria-hidden ×, and `#scale-layout-hint`;
    - `#scale-drawer`: hint, orientation, mirrors, fine controls, RESET LAYOUT;
  - `.ctlrow > #scale-swatches`.
- After `.sheetbody`, outside the scroll: `#scale-guidance` (`#scale-field-msg`, `#scale-msg`, `#scale-layout-state`, min-height 36px), `#scale-generate`, `#scale-delete-row`.

**Pan size rules (seven, not three).** Every one sets `#scale-preview` width:
1. Stacked default: `.scalestage #scale-preview{width:clamp(110px, calc(100cqh - 260px), 300px)}`.
2. `@container surf (min-width:600px)` grid: `clamp(200px, calc(100cqh - 306px), 300px)`.
3. The desktop media `(min-width:640px) and (min-height:700px)`: 340px max.
4. `#scale-sheet.side`: `min(calc(100cqh - 172px), 46cqw)`; `kbup.side`: `min(calc(100cqh - 120px), 50cqw)`.
5. Drawer open, portrait (`.sheetbody:has(#scale-layout-zone.open)`): `width:100%; max-width:min(300px, 31dvh)`, 340px on desktop. This is the KB F4 shrink.
6. Landscape drawer open (`@media (max-height:520px) and (min-width:560px)` and its `@container surf (min-width:600px)` twin): `clamp(150px, calc(100dvh - 170px), 232px)`, band in grid column 1.
7. `@media (max-height:520px)`: `#scale-preview{max-width:120px}`. `.tiny` is a 520px centred column.

**Behaviours this work touches.**
- **syncBand.** A sticky band with `nostick` when the room is under `BAND_MIN_ROOM` (44), `--plate-band-h` written as `.sheetbody` scroll-padding-top, and a ResizeObserver on `plateBand` and `bandPort` (the "DR1 rule G" tests in `tests/drawer_grid.test.js`).
- **openDrawer.**
  - `keepToggle(at)` (F4) holds the toggle in place.
  - It calls `layoutZone.scrollIntoView` and `drawerBtn.scrollIntoView`, plus a static-band correction.
  - `focusFirstNext` sets focus on the first pickable note with preventScroll (DR2a 18; KB F4).
  - It adds the `touchmove` listener on `previewBox`.
- **closeDrawer(viaToggle).** Focus goes to `drawerBtn`. `dropDrawer()` runs on sheet close.
- **Plate gestures.** The `previewBox` click, keydown, focusin and pointerdown drag (press, HOLD_MS, liftNote, ghost, panarm) are all gated on `drawerOpen && lastSolved`.
- **Focus scroll (KB2/KB2b).**
  - `focusin` → `tapSnap`/`scrollPin` (PIN_MS 600) → `revealField` (least-distance scroll of `.sheetbody` and `.sheetsurf`).
  - `holdPin` runs on `bandPort` and `sheetSurf` scroll.
  - `releasePin` runs on non-field pointerdown, touchstart and wheel; `dropTap` runs on a touchmove over 8px and on pointercancel.
- **applyKbOffset(e).**
  - Bound to visualViewport resize and scroll; it writes `sheetSurf` transform and maxHeight and the classes `kbup`, `short`, `side`, `tiny`.
  - It returns before `revealField` on a scroll event.
  - The head is hidden under `kbup.side` (Q1).
- **History.**
  - `showSheet` pushes `{scalePage:true}` at `sheetRoute()` (`#add` or `#edit-<id>`) and sets `sheetRouted`.
  - `closeScaleSheet` sets `pendingPop` and calls `history.back()`.
  - The popstate listener runs, in order: `pendingPop` → `syncRoute`, then the `aboutOpen` branch, then `ABOUT_ROUTE`, then `if (!sheetOpen) return`, then `hideSheet()`.
  - `syncRoute` and the hashchange listener return early while `sheetOpen || aboutOpen`.
  - About pushes `{about:true}` "#about", focuses its exit, and `closeAbout` uses `pendingPop` + `history.back()`. This is the precedent.
- **The sheet's Tab list** (the sheet keydown handler): `backBtn, nameBox(Edit), ding, top, inner, bottom, scaleBox, plate-note (drawerOpen), drawerBtn, anchorOne, anchorBetween, mirrorTop, mirrorBot, fineBtn, notePrev, noteNext, seatPrev, seatNext, resetBtn, ...swatches, genBtn, delBtn(Edit)`, filtered by `isStop`.
- **The Escape ladder** (document keydown, sheetOpen): `drawerOpen && pickRef` → `putDownPick()`; `drawerOpen` → `closeDrawer()`; else `closeScaleSheet()`.

**Measurements behind sections 3 and 5.** Method: fontTools advance widths of the shipped `tools/fonts` TTFs, plus letter-spacing; CSS from the merged tree.
- `.sheetlabel` is `600 9.5px/1.5 "Nunito Sans"` with `letter-spacing:.13em`. The design check's "11px, ~300px" is wrong; the code says 9.5px.
- `.sheetsurf` padding is `--sp-4`: 22px a side on a portrait phone, 14px at `max-height:520px`. The gap is `--sp-3`: 14px, or 9px landscape.
- With the recommended SMALL rule `clamp(88px, 30cqw, 160px)`:

| viewport | surface content width | small pan | field column |
|---|---|---|---|
| 320 | 276 | 88 | 174 |
| 380 | 336 | 101 | 221 |
| 393 | 349 | 105 | 230 |
| 844x390 | 492 (520 max-width) | 148 | 335 |
| 1280x800 | ~610 | 160 (cap) | ~422 |

## 3. Target design

### 3.1 Item 1: two sizes

There are two expressions and no others. Every one of the seven current rules in section 2 is deleted.
- **SMALL** (`#scale-sheet:not(.adjusting) #scale-preview`): `width:clamp(88px, 30cqw, 160px)`.
- **LARGE** (`#scale-sheet.adjusting #scale-preview`): `width:clamp(160px, min(100cqw, calc(100cqh - var(--adj-reserve))), 480px)`.
  - `--adj-reserve` is 232px in one column, so at least 160px of controls show under the pan (the F4 floor).
  - It is 72px in the two-column container query `@container surf (min-width:600px) and (min-aspect-ratio:1/1)`, where the controls sit to the right.

| viewport | LARGE | controls under or beside it |
|---|---|---|
| 380x780 | 336 | ~330 under |
| 320x568 | 276 | ~166 under |
| 390x669 | 346 | ~197 under |
| 844x390 | ~290-318 | column right, ≥480 wide |
| 1280x800 | 480 | under |

- `.side`, `short`, `kbup` and `tiny` keep every non-pan rule (head hidden under `kbup.side`, `.tiny` column, label size under `.side`). Only their pan widths go.
- The plate SVG is the same `pan()` output at both sizes. DR1 line 40 (byte-identical with interactive off) is unchanged.

### 3.2 Item 2: small pan left, four fields right

**Markup.** `.scalestage` holds two children in this order:
- a new `<div class="pancol" id="scale-pancol">` containing `#scale-plate-band` and then the moved `#scale-layout-row` (toggle and hint);
- `.scalecol` with `#scale-fields` only.

The `#scale-box` row moves out of `.scalecol`, to full width directly after `.scalestage`. `#scale-layout-zone` keeps `#scale-drawer`. All ids keep their names, so `tools/sandbox.js` ELEMENT_IDS only gains new ids.

**CSS.**
- `.scalestage{display:grid; grid-template-columns:auto minmax(0,1fr); gap:var(--sp-3); align-items:start}`.
- `.pancol{position:sticky; top:0}` inside `.sheetbody`, with no band background and no scroll-padding. The band no longer covers the fields, so `--plate-band-h` is 0 outside `.adjusting`.
- The labels wrap per D1 and the inputs stay single-line per D3.

**JS.**
- `syncBand` runs its sticky and padding logic only while `.adjusting`. Outside it, it writes `--plate-band-h:0px` and removes `nostick`.
- No new observer: the existing ResizeObserver already fires on the band.

**Caption.** `#scale-layout-toggle` (copy "ADJUST LAYOUT", unchanged) sits directly under the pan as its visible caption. The disabled hint "Type a scale to adjust its layout." stays in `#scale-layout-hint` under it. See D2 and D10.

**Caption fit (design review).** `.pancol` is exactly the SMALL pan's width (88 / 101 / 105 / 148 / 160px). Measured in Nunito Sans SemiBold 10.5px at .08em: "ADJUST LAYOUT" is 96px of text plus 22px of `.mode` padding, so 118px. At every phone portrait width the toggle therefore runs `width:100%; white-space:normal; text-align:center` and wraps to "ADJUST / LAYOUT" on two lines at min-height 44px; it is one line at 148px and 160px. The hint (Bitter 11.5px, 166px of text) wraps to three lines at 101px and four at 88px. The pan column stays shorter than the field column at every viewport (about 200px against about 280px at 380), so the wraps add no height to the sheet.

**Tap cue on the small pan.** The caption is the visible cue: it sits flush under the pan and names the action. While `boxOk`, the band takes `cursor:pointer` and a hover state that matches `.mode:hover` on the caption at the same time. There is no new focusable (D2): keyboard and screen-reader users reach the same action through the caption.

**Sheet states (design review).** What the user sees in each state of the small-pan sheet:

| state | small pan | ADJUST LAYOUT caption | pan tap | primary / lip |
|---|---|---|---|---|
| Add, empty box | empty plate, as today | `aria-disabled="true"`, hint "Type a scale to adjust its layout." shown | nothing | GENERATE CARDS disabled (opacity .5), lip label also at .5 |
| Add, box does not parse | last good plate, or empty | aria-disabled, hint shown, parse line carries the refusal | nothing | disabled |
| Add, valid scale | live plate | enabled, hint hidden | opens Adjust layout | GENERATE CARDS enabled |
| Edit (custom or seeded) | the deck's plate | enabled | opens Adjust layout | SAVE CHANGES, DELETE row under it |
| keyboard up (`kbup`) | unchanged size (SMALL) | unchanged | as above | lipped (item 4) |
| guidance has a warning or notice | unchanged | unchanged | unchanged | the slot stays above the primary or the lip |

Nothing in this table adds copy: every string already ships.

**Focus and Tab** per D10, recommended:
`backBtn, nameBox(Edit), drawerBtn, ding, top, inner, bottom, scaleBox, ...swatches, genBtn | lip, delBtn(Edit)`.

**Wireframe, 380x780, Add, sheet**:
```
+--------------------------------------+
| <- BACK        Add a scale           |
|--------------------------------------|
| .------.  YOUR SCALE, NOTE BY NOTE   |
| | pan  |  DING                       |
| | 101px|  [ D3                    ]  |
| '------'  TOP RIM NOTES, LOW TO HIGH |
| ADJUST    [ A Bb C D E F G A      ]  |
| LAYOUT    TOP INNER NOTES, LOW TO    |
| Type a    HIGH (OPTIONAL)            |
| scale...  [ C5 D5                 ]  |
|           BOTTOM NOTES, LOW TO HIGH  |
|           (OPTIONAL)                 |
|           [ C3 Eb3                ]  |
| SCALE: (DING) TOP NOTES | OPTIONAL...|
| [ (D3) A3 Bb3 C4 ...              ]  |
| Ding D3 . 8 top . 0 inner . 0 bottom |
| [swatches .........................] |
|======================================|  <- hairline
| (guidance slot, 36px)                |
| [        GENERATE CARDS            ] |
+--------------------------------------+
```

**Wireframe, 844x390, Edit, sheet**: the same row. Pan 148px left, fields to its right with labels on one line; the name row is above; the head is hidden only under `kbup.side`.
```
+------------------------------------------------------------+
| <- BACK   Edit this scale                                  |
| DECK NAME [ D Kurd 10                  ]                   |
| .-------.  DING [ D3 ]                                     |
| | pan   |  TOP RIM NOTES, LOW TO HIGH [ A3 Bb3 C4 ... ]    |
| | 148px |  TOP INNER NOTES, LOW TO HIGH (OPTIONAL) [   ]   |
| '-------'  BOTTOM NOTES, LOW TO HIGH (OPTIONAL) [   ]      |
| ADJUST LAYOUT                                              |
|============================================================|
| (slot)  [ SAVE CHANGES ]  DELETE THIS DECK                 |
+------------------------------------------------------------+
```
(Labels sit above inputs as today. The sketch compresses them.)

### 3.3 Item 3: Adjust layout, full screen

**States.** `adjustOpen` (new) is equivalent to `drawerOpen`. Opening Adjust layout is `openDrawer()` plus the layer; closing it is `closeDrawer()` plus the layer. Every existing `drawerOpen` gate (drag, keydown, Escape ladder, Tab list, rule C/R) therefore holds unchanged.

**Markup.**
- A new `<div class="sheethead" id="scale-adjust-head" hidden>` directly after `.sheethead`, holding:
  - `<button class="mode" id="scale-adjust-back" aria-label="Back to the scale">← BACK</button>` (aria-label per D9);
  - `<h2 id="scale-adjust-title">Adjust layout</h2>`.
- While open, `#scale-sheet` gets class `adjusting`, and the dialog's `aria-labelledby` switches from `scale-title` to `scale-adjust-title`. It switches back on close.

**CSS under `#scale-sheet.adjusting`.**
- Hidden: `.sheethead`, `#scale-name-row`, `.scalecol`, the `#scale-box` row, `#scale-layout-row`, the swatches `.ctlrow` (per D7), `#scale-generate`, `#scale-delete-row` and `#scale-lip`.
- Shown: `#scale-adjust-head`, `#scale-plate-band` (pan and `#scale-drawer-status`), `#scale-drawer`, and `#scale-guidance`. The guidance stays because `#scale-layout-state` belongs here and SG: N-A5 keeps notices in view.
- The pan is LARGE.
- Portrait (one column): band sticky with the existing syncBand rule G (D12).
- Two columns: band in column 1 static, controls in column 2. `.sheetsurf{max-width:none}` while adjusting applies only under `@media (orientation:landscape) and (max-height:500px)` (per D15(a)), so 844x390 gets the full width and 1280x800 stays 520px wide and one column, as the section 3.1 table says. If the owner picks D15(b), this bullet and the 1280x800 rows of the lane P e2e tests change (eng review E9).

**Opening.**
- Triggers: a click on `#scale-layout-toggle` (its `onclick`, today `if (drawerOpen) closeDrawer(true); else openDrawer();`, becomes `if (drawerOpen) closeAdjust(); else showAdjust();`; eng review E5), or a click on `#scale-plate-band` while `!drawerOpen && boxOk`. The latter is a new branch at the top of the existing `previewBox` click handler. There is no new focusable, and the small pan has no drag because the pointerdown and keydown gates stay on `drawerOpen`.
- Steps, in order:
  0. `showAdjust()` returns at once unless `sheetOpen && boxOk && !drawerOpen && !pendingAdjustPop` (eng review E4: `openDrawer()` returns early on `!boxOk`, and a push before that check would leave an orphan entry).
  1. Save `sheetScroll = bandPort.scrollTop`.
  2. `history.pushState({scalePage:true, adjust:true}, "", sheetRoute())`. This is state-only: the same URL, so no hashchange and the SU: route is untouched. Set `adjustRouted = true`.
  3. Add `adjusting` and unhide `#scale-adjust-head`.
  4. `openDrawer()`, with `keepToggle` and both `scrollIntoView` calls removed. Set `bandPort.scrollTop = 0`.
  5. Focus the first pickable note with preventScroll (D11). With no ring of two, the status says so (unchanged).

**Closing.** There are three routes; all of them run `hideAdjust()`:
- `#scale-adjust-back` click and Escape (when nothing is picked) call `closeAdjust()`: `hideAdjust(); if (adjustRouted) { adjustRouted = false; pendingAdjustPop = true; history.back(); }`.
- The phone back gesture arrives as a popstate with `adjustOpen` set: `adjustRouted = false; hideAdjust()`.
- `hideAdjust()` runs in this order (eng review E3): remove `adjusting`, hide the head and restore `aria-labelledby` FIRST, so `#scale-layout-row` is rendered again; then `closeDrawer(false)` (cancels any gesture; `false` because its own `drawerBtn.focus()` has no preventScroll and would scroll the sheet); then `bandPort.scrollTop = sheetScroll`; then `drawerBtn.focus({preventScroll:true})`; then (lane L) stamp `lipQuietUntil`. Focusing `drawerBtn` while `.adjusting` still hides its row fails silently and drops focus to `<body>`. Edits stay live: no revert and no confirm.

**Popstate listener.** New branches come first, verbatim order:
```js
if (pendingAdjustPop) {
  pendingAdjustPop = false;
  if (closeAfterAdjustPop) { closeAfterAdjustPop = false; closeScaleSheet(); }   // E1
  return;
}
if (pendingPop) { pendingPop = false; syncRoute(); return; }
const atSheet = location.hash === sheetRoute();                                  // E2, E6
if (adjustOpen) {
  adjustRouted = false; hideAdjust();
  if (atSheet) return;               // the back gesture onto the sheet entry
  // a fragment navigation (typed or external): fall through, so the sheet
  // closes exactly as it does today and hashchange routes the destination
}
else if (atSheet && sheetOpen && history.state && history.state.adjust) {     // Forward onto a popped Adjust entry
  if (boxOk) { adjustRouted = true; showAdjust(); } else { pendingAdjustPop = true; history.back(); }
  return;
}
// ...existing aboutOpen / ABOUT_ROUTE / !sheetOpen / hideSheet branches unchanged
```

Why `atSheet` (eng review):
- **E2, stale `adjust` state.** `syncRoute()` writes `replaceState(history.state, "", want)`, which keeps the state object. A reload on the Adjust entry boots on `#add`, and syncRoute rewrites that entry to `#deck=…` while it still carries `{adjust:true}`. Later, the user opens a sheet and presses Back onto that entry. Without the hash check, the Forward branch reopens Adjust layout instead of closing the sheet.
- **E6, fragment navigation.** A typed or external fragment fires `popstate` (before `hashchange`) with `state` null and a new hash. Today that closes the sheet; without the check, the `adjustOpen` branch would close only the layer and leave the sheet open on a URL that is not its route.

**closeScaleSheet while Adjust layout is open, or while its pop is pending (eng review E1, replaces `history.go(-2)`).** No visible control reaches this (GENERATE and DELETE are hidden in the layer), but a fast second Escape, or BACK pressed before the first `back()` has popped, does:
- `if (adjustOpen) closeAdjust();` (which sets `pendingAdjustPop` when the entry was routed);
- `if (pendingAdjustPop) { closeAfterAdjustPop = true; return; }`;
- otherwise the existing body runs unchanged (`hideSheet(); if (routed) { pendingPop = true; history.back(); }`).

The `pendingAdjustPop` popstate branch then calls `closeScaleSheet()`, so at most one traversal is ever in flight. Two queued `back()` calls are not reliably two popstates (browsers may coalesce traversals queued in one task), and `go(-2)` cannot be observed as two steps by the flags. The sandbox needs no `history.go`. `deleteDeck` and `runGenerate`, the other two callers, cannot run while the layer is open.

**Other history cases.**
- A hashchange while open: the listener already returns early on `sheetOpen`, so nothing changes. The existing SU test is extended with Adjust layout open.
- `syncRoute` stays guarded by `sheetOpen`.

**Escape ladder.** Unchanged in shape: pick → `putDownPick()`; `drawerOpen` → `closeAdjust()` (the `else if (drawerOpen) closeDrawer();` arm in the document keydown handler); else `closeScaleSheet()`. A second Escape while `pendingAdjustPop` is set reaches `closeScaleSheet()`, which defers per E1.

**Other drawer exits.** `paintLayout()`'s `drawerPaused` branch (a scale that stops parsing under an open drawer) is unreachable in the layer, which has no input; it stays for safety. `dropDrawer()` runs only from `hideSheet()` and from the Edit/Add reset; `hideSheet()` must also clear `adjusting`, `adjustRouted`, `pendingAdjustPop` and `closeAfterAdjustPop` (eng review E4).

**Tab inside the layer** (the Tab list filters to these because everything else is hidden):
`adjustBack, plate-note, anchorOne, anchorBetween, mirrorTop, mirrorBot, fineBtn, notePrev, noteNext, seatPrev, seatNext, resetBtn`.
The wrap stays inside the layer.

**Accessibility.**
- `#scale-layout-toggle` keeps `aria-expanded` (true while the layer is open) and `aria-controls="scale-drawer"`.
- The aria-hidden × is deleted: the toggle is never visible while open.
- `#scale-drawer-status` keeps polite and atomic.
- **Head styling (design review).** `#scale-adjust-head` reuses `.sheethead` exactly, and `#scale-adjust-title` reuses the `#scale-title` rule (600 13px Nunito Sans, uppercase, `#eae6df`), so the visible title reads "ADJUST LAYOUT", the same words as the caption that opened it. The source text stays "Adjust layout" for the accessible name. `#scale-adjust-back` is a plain `.mode` button with the same box as the sheet's `← BACK` (min-height 44px), so the two heads differ only in the title.
- **Entering is announced** per D16.
- **Focus-ring room.** The LARGE pan's band keeps an inset of at least `var(--ring)` plus 2px on every side, so a focused `.panhit` note on the rim shows its full 2px `#e3b25c` outline and is never clipped by `.sheetbody`'s overflow.
- **Empty and error states inside the layer.** A ring of fewer than two notes: the existing status sentence, and the step and swap controls stay disabled as today. A layout notice or warning appears in `#scale-guidance`, which stays visible in the layer. The layer has no input, so the scale cannot stop parsing while it is open.
- **Motion.** None: the layer replaces the sheet in one frame, like the drawer today, with or without prefers-reduced-motion.
- **Desktop 1280x800** per D15.

**Drag.**
- `previewBox` is the same element, so press, HOLD_MS, liftNote, the ghost (position:fixed), panarm and the `touchmove` listener are unchanged.
- KB2b `releasePin`/`dropTap` still run, because they are document listeners.
- A popstate mid-drag runs `hideAdjust` → `closeDrawer` → `cancelGesture`, which is tested.

**Wireframe, 380x780, Adjust layout**:
```
+--------------------------------------+
| <- BACK        Adjust layout         |
|--------------------------------------|
|      .------------------------.      |
|      |                        |      |
|      |     LARGE pan 336px    |      |
|      |     (drag / tap seats) |      |
|      '------------------------'      |
|  (drawer status, polite)             |
|  Tap a note, then the seat to...     |  <- #scale-drawer-hint
|  HANDPAN ORIENTATION                 |
|  [ #1 CENTRED ] [ #1 / #2 ]          |
|  [ MIRROR TOP ] [ MIRROR BOTTOM ]    |
|  HARD TO TAP? SHOW FINER CONTROLS    |
|  [ RESET LAYOUT ]          (scrolls) |
|======================================|
| (guidance: layout notice)            |
+--------------------------------------+
```

**Wireframe, 844x390, Adjust layout**:
```
+------------------------------------------------------------+
| <- BACK  Adjust layout                                     |
| .-------------.   Tap a note, then the seat to swap it.    |
| |  LARGE pan  |   HANDPAN ORIENTATION [#1 CENTRED][#1/#2]  |
| |   ~300px    |   [MIRROR TOP] [MIRROR BOTTOM]             |
| '-------------'   HARD TO TAP? ...   [RESET LAYOUT]        |
| (status)          (guidance)                               |
+------------------------------------------------------------+
```

### 3.4 Item 4: the footer collapses to a lip

**Markup.** A new `<button id="scale-lip" class="lip" hidden aria-expanded="false" aria-controls="scale-generate scale-delete-row">` sits between `#scale-guidance` and `#scale-generate`. This is outside the slot, so the SG: N-A2 order assertions still hold. Its text is `genBtn.textContent` ("GENERATE CARDS" on Add, "SAVE CHANGES" on Edit, including a seeded deck's Edit) after a handle bar drawn in CSS (D5).

**CSS.**
- `#scale-sheet.lipped #scale-generate, #scale-sheet.lipped #scale-delete-row{display:none}`.
- `.lip` (design review, concrete values from the shipped tokens):
  - box: full footer width inside the surface gutters, min-height 44px, `border:1px solid #433b2c`, `border-radius:10px` (the radius of `#scale-generate`, so the lip reads as the button folded down), `background:#211d16`;
  - label: the `.mode` type, 600 10.5px Nunito Sans, uppercase, .08em, `#c4bcab`. It drops to opacity .5 while `genBtn.disabled`, matching the disabled primary, and the lip itself stays operable because it only expands;
  - handle: `::before`, 28x3px, radius 2px, `#a79d8b` (the `.sheetlabel` colour), centred 6px above the label;
  - focus: the global `:focus-visible` ring; hover matches `.mode:hover`.
  Cream (`#f1ece1`) stays reserved for the full primary, so a collapsed footer never looks like a pressable GENERATE.
- Motion per D6: `@media (prefers-reduced-motion: reduce){.lip{transition:none; animation:none}}`.
- `#scale-guidance` never collapses.

**State.** `lipped` (bool) and `lipHold` (a lip tap or a Tab restore wins until the next keyboard rise).

**Collapse when all of these hold:**
- (a) a USER scroll on `.sheetbody`, or on `.sheetsurf` in `tiny`, accumulates ≥ 24px downward;
- (b) `remaining = maxScroll − scrollTop > Δ`, where Δ = the expanded footer's height minus 44px, measured with getBoundingClientRect at the decision;
- (c) the content scrolls at all (`maxScroll > Δ`);
- (d) not `.adjusting`.

The keyboard's rising edge also collapses: `applyKbOffset` adding `kbup` calls `setLip(true, "kb")`.

**Restore when any of these happens:**
- a user scroll accumulates ≥ 24px upward;
- a user scroll arrives at the end from below (edge-triggered: `prev < max − 1 && cur ≥ max − 1`);
- the keyboard's falling edge (`kbup` removed);
- a lip click, Enter or Space;
- `focusin` on the lip from the keyboard, which restores and moves focus to `genBtn` when enabled, else `delBtn` on Edit, else stays on the lip;
- sheet open, Edit open, `hideSheet` (`lipped=false`) and opening Adjust layout.

**Focus at a collapse (design review).** If `document.activeElement` is `genBtn` or inside `#scale-delete-row` when the lip collapses (a keyboard PageDown, or a scroll while a button holds focus), focus moves to the lip with preventScroll, so focus never drops to `<body>`.

**Announcements.** None on collapse or restore. `aria-expanded` on the lip carries the state, and a live message on every scroll would be noise. The lip's accessible name is per D18.

**Sizes.** The lip plus the 36px guidance slot take 80px of 568px at 320x568, against 88px for the expanded footer at its shortest (36 + 52).

**Which scrolls count as the user's.**
- A scroll event counts only while `userWindowUntil > now`.
- touchstart, touchmove and wheel set that window to now + 150ms, and so does a keydown of PageUp, PageDown, Space, Home, End or the arrows outside a text field. Every scroll event inside the window extends it by 150ms, which carries iOS momentum.
- A separate `lipQuietUntil` (now + 150ms) makes any scroll inside it update the baseline only. It is set by:
  - `holdPin` and the `scrollPin` restore;
  - `revealField`;
  - `applyKbOffset`;
  - `hideAdjust`'s scroll restore;
  - every `setLip` change.

  So programmatic scrolls and the clamp from the lip's own resize never count, even inside a touch.
- Direction comes from `clamp(scrollTop, 0, max)` deltas only. Negative scrollTop at the top and overshoot past the end give a zero delta, so the rubber band never flickers.
- The accumulator resets on a direction change and on every state change.
- The listener is passive and touches no layout except one getBoundingClientRect at a decision.
- No rAF and no ResizeObserver.

**No oscillation, by construction.**
- A collapse only happens with `remaining > Δ`. The scroller grows by Δ at the bottom, so `maxScroll` drops by Δ and `scrollTop < newMax`: no clamp and no scroll event.
- A restore at the end leaves `remaining = Δ` exactly, so no collapse can follow until the user scrolls up past it. Scrolling up already restores.

The test "UX: a scripted scroll to the end and back changes lipped at most twice with no clamp event" proves it.

**Wireframe, 380x780, lip collapsed**:
```
| ...fields scrolled...                |
| [ (D3) A3 Bb3 C4 ...              ]  |
|======================================|
| (guidance slot)                      |
|            ----                      |
|        GENERATE CARDS     (lip, 44px)|
+--------------------------------------+
```

**Wireframe, 380x780, keyboard up** (393x852, 336px keyboard):
```
+--------------------------------------+
| <- BACK        Add a scale           |  (head shows at 393 portrait; hidden only under kbup.side)
| .----.  DING [ D3 ]                  |
| |pan |  TOP RIM ...                  |
| '----'  [ A3 Bb3 C4 D4 E4 F4| ]  <-- focused
| ADJUST  TOP INNER ...                |
|======================================|
| (guidance slot)                      |
|        ----  GENERATE CARDS    (lip) |
+================ keyboard ============+
```

## 4. Supersessions

- **T2 (owner, 2026-10-18), verbatim:** "T2 Plate: STACKED (pan on top, line below), owner overrode the side-by-side rec. Consequence for R2: caption gets a fixed height (2-line clamp, full line available on focus/aria), so fields never move while typing; keep the e2e check that the first field does not move between empty and Pygmy prefill."
  - It is **superseded** by item 2 (owner, 2026-10-19): "When opening the Add/Edit Scale sheet, we should default to small handpan visual with 4 input text fields on the right".
  - The T2 consequence "fields never move while typing" is KEPT: the e2e check that the first field does not move between empty and the Pygmy prefill stays.
- **KB F4-a (owner, 2026-10-19, "shrink the pan more" while the drawer is open)** is superseded by item 3: the layer replaces the in-sheet drawer.
  - The F4 binding "pan must stay tappable while shrunk" is KEPT as tappability on the LARGE pan.
  - The F4 "options unfold below" floor is KEPT as ≥160px of controls under the LARGE pan.
  - The AFK pick F4-b (`keepToggle`) is retired with its mutant. Its intent, that the user keeps their place, becomes "closing Adjust layout restores the sheet's scroll".
- **DR1 line 35** (open plate ≤42% of viewport height), **DR1 lines 36/88** (220px landscape plate), **the 42dvh/31dvh caps** and **DI-E1/E2 pan floors** (130px at 320, 212px at 380 with a keyboard) are superseded by the SMALL and LARGE rules. Item 1 makes them false by design.
- **DR1 open step 5** (open scrolls the zone into view) and **DR1 line 108** (× close mark) are superseded: the layer opens at its top, and the toggle is hidden while open.
- **"The sheet widens with the viewport on desktop, and the pan with it"**: the sheet still widens; the small pan caps at 160px (item 1, "reduce to two").
- **GENERATE/SAVE always visible while the keyboard is up** (tests "with the box focused and the viewport shrunk, both the box and the primary stay on screen", "GENERATE CARDS survives a viewport shrunk the way a soft keyboard shrinks one", and the KB 844x334 and KB2 landscape-swipe GENERATE clauses) is superseded by item 4: "Opening the keyboard should also minimize the drawer until keyboard is dismissed." The lip is on screen instead, and one tap restores.

## 5. Open decisions (owner)

**D1. Field labels in the narrow column.** Measured in section 2. Field column 174 / 221 / 230px at 320 / 380 / 393.

| label | width | lines at 320 | 380 | 393 |
|---|---|---|---|---|
| DING | 29 | 1 | 1 | 1 |
| TOP RIM NOTES, LOW TO HIGH | 175 | 2 | 1 | 1 |
| TOP INNER NOTES, LOW TO HIGH (OPTIONAL) | 260 | 2 | 2 | 2 |
| BOTTOM NOTES, LOW TO HIGH (OPTIONAL) | 247 | 2 | 2 | 2 |

All four are one line at 844x390 (335px).
- (a) Two-line labels, keeping lane A's owner wording. Each wrapped line costs 14.25px; at 380 that is +28px for the column, which is already far taller than the 101px pan.
- (b) Short visible labels (DING / TOP RIM / INNER (OPTIONAL) / BOTTOM (OPTIONAL)) with the full wording as the accessible name.

**Recommend (a).** The wording is the owner's and the cost is 28-42px. (b) would also force a rewrite of IB "the INNER and BOTTOM labels say LOW TO HIGH".

**D2. ADJUST LAYOUT text button.**
- (a) Keep `#scale-layout-toggle` as the pan's visible caption and the single accessible control. The plate becomes a pointer shortcut with no extra tab stop.
- (b) Make the pan a `<button>` named "Adjust layout" with a separate caption, and remove the toggle.

**Recommend (a).** This departs from the integrator's reading, which was a pan button. The reason: the plate holds focusable `.panhit` notes in the large state, and a `<button>` cannot contain interactive content. A transparent overlay button would be a second element to keep in sync. (a) also keeps the existing id, the hint row and roughly 20 DR1/DR2 tests.

**D3. Long values.** Single-line text: the Pygmy rim is 271px and the Kurd rim 244px, against 221px at 380, so both scroll inside the input.
- (a) Accept the in-input scroll. The full line shows in `#scale-box` and the parse line.
- (b) Wrapping textareas.

**Recommend (a).** (b) breaks "DI: ... each a text input with autocapitalize off, enterkeyhint next" and the Enter-moves-next behaviour.

**D4. Small-pan label legibility.** Rendered name and number sizes:

| small pan | Kurd/Hijaz/Amara name | number | Pygmy rim name | Pygmy bottom name |
|---|---|---|---|---|
| 88px (320) | 6.3 | 5.0 | 3.5 | 2.9 |
| 101px (380) | 7.3 | 5.8 | 4.0 | 3.3 |
| 160px (desktop) | 11.5 | — | 6.3 | — |

- (a) Accept: it is a thumbnail into the large pan, and no test asserts label size on the preview.
- (b) Hide names and numbers on the small pan (dots only).
- (c) Raise the SMALL minimum, which shrinks the field column.

**Recommend (a).**

**D5. Lip contents.**
- (a) A handle bar plus the action name ("GENERATE CARDS" / "SAVE CHANGES").
- (b) That plus the guidance state.

**Recommend (a).** The guidance never collapses, so its state is already on screen.

**D6. Motion.**
- (a) The layout change is instant, with a 150ms opacity fade of the lip label. No motion under prefers-reduced-motion.
- (b) A 180ms slide of the footer.

**Recommend (a).** A height or slide animation changes the scroller height across several frames and re-opens the oscillation risk.

**D7. Swatches (`#scale-swatches`).**
- (a) Stay in the sheet.
- (b) Move into Adjust layout.

**Recommend (a).** The palette is a deck colour, not a layout ("Adjust layout should focus on moving notes and changing layout").

**D8 (new). Small-pan size rule:** `clamp(88px, 30cqw, 160px)`. Alternatives are a fixed 96px, or 34cqw, which gives a 114px pan and a 208px column at 380. **Recommend 30cqw.** It keeps TOP RIM on one line at 380.

**D9 (new). The Adjust BACK accessible name.**
- (a) "Back to the scale".
- (b) "Back to Add a scale" / "Back to Edit this scale".

**Recommend (a).** The visible text is "← BACK" (the owner's word).

**D10 (new). Tab position of ADJUST LAYOUT.**
- (a) Visual order: after BACK and the name, before DING. This rewrites "DI: the sheet's Tab order ..." and "RD: the Edit page's Tab order ...".
- (b) The DOM keeps the toggle after `#scale-box` while CSS places it under the pan, so the Tab order no longer follows the visual order.

**Recommend (a)** (WCAG 2.4.3).

**D11 (new). Focus on opening Adjust layout.**
- (a) The first pickable note, as today (DR2a 18, KB F4 preventScroll).
- (b) `← BACK`, as in About.

**Recommend (a).** It keeps the owner-checked F4 behaviour and five tests.

**D12 (new). The LARGE pan in portrait is sticky** (syncBand rule G, `nostick` under 44px of room), so it stays in view while the controls scroll.
- (a) Sticky.
- (b) Static.

**Recommend (a).** It keeps the drawer_grid rule-G tests, re-anchored.

**D13 (new). Analytics.**
- (a) No event.
- (b) An `adjust_open` event with no params.

**Recommend (a).**

**D14 (new). Hysteresis of 24px** and a user-scroll window of 150ms. **Recommend as stated.** The owner may prefer a larger threshold after the phone check.

**D15 (new, design review). Adjust layout at desktop 1280x800.** Section 3.3 sets `.sheetsurf{max-width:none}` while adjusting, which at 1280x800 makes the surface 1280px wide and puts it in the two-column query, so the 480px pan sits beside the controls; the section 3.1 table says "under".
- (a) Scope `max-width:none` to `@media (orientation:landscape) and (max-height:500px)` (landscape phones only). At 1280x800 the layer stays 520px wide like the sheet, one column, the 480px pan under the head and the controls under it, as the table says.
- (b) Full width at desktop, two columns: pan left, controls in a right column capped at 420px, the pair centred.

**Recommend (a).** It matches the table, keeps the sheet and the layer the same width so BACK does not jump, and keeps the 160px controls floor true by the same rule as portrait.

**D16 (new, design review). Announcing the layer on entry.** D11 moves focus to the first note, so a screen reader reads that note's name; it does not say that the view changed, because a relabelled dialog is not re-announced.
- (a) On open, `#scale-drawer-status` (polite, atomic) is written once as "Adjust layout. " followed by its existing sentence.
- (b) Nothing: the focused note's name is enough.

**Recommend (a).** One polite sentence orients a non-sighted user at the moment every input disappears. It changes the status text, so the drawer-status tests that read it on open gain the prefix.

**D17 (new, design review). The lip's palette.**
- (a) Secondary: `.mode` dark (`#211d16`, label `#c4bcab`), as section 3.4 now specifies.
- (b) Cream, like the expanded primary.

**Recommend (a).** Cream on the lip would read as the action itself; the lip's job is "show the action", and the expanded footer is one tap away.

**D18 (new, design review). The lip's accessible name.** With visible text only, a screen reader reads "GENERATE CARDS, collapsed, button", which sounds like generating.
- (a) `aria-label` "Show GENERATE CARDS" / "Show SAVE CHANGES", visible text unchanged (WCAG 2.5.3 holds: the visible words are inside the name).
- (b) Visible text only.

**Recommend (a).** The name then says what a press does. Lane L's lip tests assert the name.

**Owner answers (2026-10-19, round 1).** D1 (a) full labels, wrap. D2 (a) keep the text toggle. D10 (a) visual Tab order. D11 REVISED by owner: no note is focused or armed on open ("adjust layout has other adjustments, and not just note ... let user decide what to do"); focus goes to the layer's title (tabindex=-1 heading), the next Tab reaches the first control. This retires the "first pickable note" focus in DR2a (18, 96) and KB F4 and their mutants, which lane P rewrites. D12 (a) pinned. D15 (a) 520px, one column. D6 pending: owner is comparing both in a playground (https://claude.ai/artifact/B5LTHm8KuUuXzBH9cZ3Ziw). D3-D5, D7-D9, D13, D14, D16-D18 open; D16 likely moot under the revised D11, since the focused title announces the layer.

**Owner answers (2026-10-19, round 2).** Phone recheck of lanes A and KB2b on DEV a256aec: PASSED, the iOS jitter tap included (closes K-N3). D3 (a) scroll inside the field. D16 (b) no extra line. D6 REVISED by owner after the playground: (b) a 180ms slide, and the collapsed footer is fully collapsed, a 1-5px lip ("The artifact's collapse doesn't minimize all the way which still takes up valuable viewport. It needs to be a 1-5px lip. I prefer 180 ms"). This supersedes section 3.4's 44px lip and the D6 (a) recommendation and its "no motion" oscillation argument; lane L is re-planned (restore affordance for a lip under 44px, a slide that does not resize the scroller per frame, and a fresh oscillation proof) and that subplan takes its own eng review before lane L starts. D5 and D17 are moot under a lip with no text; D18 stands for the lip control's accessible name. Lane P (items 1-3) is unaffected.

## 6. Lanes

**Split decision: SERIALIZED** (stacked branches), not parallel by region. The reasons:
- Both lanes must edit the same hot spots: the Tab list in the sheet keydown handler, `hideSheet`/`showSheet`, `applyKbOffset` (L adds one call; P removes the `.side` pan rules beside it), `tools/sandbox.js` ELEMENT_IDS, and the same keyboard e2e tests.
- L's geometry tests measure P's layout.

Concurrency is therefore 1 code lane at a time; the docs lane follows.

**Common to every lane.**
- Own worktree; branch `claude/dual-input-ux-<lane>`; a PR into `main`, HELD (never merged without the owner's explicit go).
- The reviewer diffs against the lane's base SHA, not `main`.
- Edits go only outside the engine regions and the DECKS line.
- Tests first; vanilla JS; no new external script.
- New test titles start with `UX:`.
- Renamed tests get their mutants' `# kills:` and `# suite:` headers updated in the same commit, with `.` for spaces.
- A lane that nets fewer tests in a file than its FLOORS row may lower that row only; lane D sets the final counts.

**Common verify commands.**
- `node --test tests/app.test.js tests/harness.test.js`
- `CHROME_BIN=… node --test --test-name-pattern '^UX:' tests/e2e.test.js tests/drawer_*.test.js` (single tests locally; the full e2e suite runs in CI only)
- `python3 tools/validate.py`
- `python3 tools/inline_engine.py --check`
- `python3 tools/sync_decks.py --check`
- `python3 tools/refresh_mutants.py --check`
- per new or re-anchored patch: `git apply P && (eval "$(sed -n 's/^# suite: //p' P | head -1)" && echo SURVIVED || echo killed); git apply -R P`

### Wave 0: base (integrator, no lane)

- Commands:
  - `git worktree add -b claude/dual-input-ux-base ../hc-ux-base origin/claude/dual-input-kb2b`
  - `git -C ../hc-ux-base merge --no-ff origin/claude/inner-below-rim-a`
  - `git push -u origin claude/dual-input-ux-base`
- Expected conflicts: **none.** `git merge-tree --write-tree 68060ed 0131672` is clean (tree 067961e4; eng review re-ran it at #404's current head, superseding the 06ce5ba / 2410a73a figures). This includes `index.html` and `tests/e2e.test.js`.
- On that tree:
  - `inline_engine --check` OK;
  - `sync_decks --check` OK;
  - all 1212 patches pass `git apply --check`;
  - `refresh_mutants --check` reports "all mutant patches apply cleanly";
  - `validate.py` passes.
- Known drift: README "applies 1180 mutant patches" against 1212 actual. It is not test-enforced; lane D fixes it.
- Rule: if #403 or #404 take a further commit, the integrator merges it into the base and then into the live lane branch, with `merge`, never a rebase.

### Lane P: two sizes + small-pan sheet + Adjust layout (items 1-3)

- **Branch** `claude/dual-input-ux-p`, base `claude/dual-input-ux-base`.
- **Owns** (in `index.html`):
  - the `#scale-sheet` markup from `.sheethead` through `#scale-layout-zone` and `#scale-swatches`;
  - the CSS from "Dual input: the plate band" through the landscape drawer-grid rules, plus every `#scale-preview` width rule;
  - JS: `syncBand`, `keepToggle` (deleted), `openDrawer`, `closeDrawer`, new `showAdjust`, `hideAdjust` and `closeAdjust`, `drawerBtn.onclick`, the `previewBox` click handler's first branch, the sheet Tab list (order only), the Escape ladder's `drawerOpen` arm, the popstate listener's new branches, `closeScaleSheet`, `showSheet`'s scroll and adjust reset, and `hideSheet`'s adjust-flag reset;
  - `tools/sandbox.js` (ELEMENT_IDS; no `history.go` is needed after E1);
  - the tests and mutants listed below.
- **Never touches:** `src/engine/*`, `data/decks.json`, the DECKS line, `applyKbOffset` and its keyboard models, `revealField`, the pin code, the footer, the guidance slot, the drag state machine internals, About, syncRoute, the hashchange listener, README, CLAUDE.md, FLOORS (except the lowering rule).
- **rAF / ResizeObserver:** neither may be added. The existing syncBand ResizeObserver covers the band; Adjust layout opens synchronously.

**Steps.**
1. **Failing tests first** (app sandbox):
   - "UX: opening Adjust layout pushes one state-only entry at the sheet's route and adds .adjusting"
   - "UX: a tap on the small pan opens Adjust layout; on an empty or invalid scale it does nothing"
   - "UX: BACK, Escape and a popstate each close Adjust layout, keep the sheet, consume the entry and focus ADJUST LAYOUT"
   - "UX: a Forward traversal onto a popped Adjust entry reopens it when the scale parses and steps back otherwise"
   - "UX: closing the sheet while Adjust layout is open issues one back, then a second only after the first pop, and the bar ends on the deck's route"
   - "UX: Escape twice in quick succession closes Adjust layout then the sheet, the second back issued only after the first pop"
   - "UX: a Back onto an entry left with adjust state by a reload closes the sheet and does not open Adjust layout"
   - "UX: a typed #deck= fragment while Adjust layout is open closes the layer and the sheet, as a fragment closes the sheet today, and hashchange routes the deck" (the sandbox dispatches `popstate` THEN `hashchange` with the new hash, the order a real fragment navigation uses)
   - "UX: closing Adjust layout focuses ADJUST LAYOUT, never body, and moves no scroll before the restore"
   - "UX: opening Adjust layout on a scale that does not parse pushes nothing"
   - "UX: the Tab cycle inside Adjust layout is BACK, the plate, the layout controls and RESET LAYOUT, and wraps"
   - "UX: a popstate mid-drag cancels the gesture and moves nothing"
   - "UX: layout edits made in Adjust layout survive BACK and reach GENERATE"

   Accept: all red on the base. Verify: `node --test --test-name-pattern '^UX:' tests/app.test.js` fails 13.
2. **Failing e2e** at all five viewports. Each test loops 380x780, 320x568, 393x852 (+336 kb), 844x390 and 1280x800, Add and Edit (Kurd seeded), and Pygmy where it says so.
   - "UX: the sheet opens with the small pan left of the four fields, clamp(88px, 30cqw, 160px), at every viewport"
   - "UX: Adjust layout shows the large pan, the layout controls and no field, scale line or primary"
   - "UX: Adjust layout shows at least 160px of controls under the large pan in one column, and beside it at 844x390"
   - "UX: every note on the large pan is hit by a tap at its centre (Kurd, Pygmy)"
   - "UX: closing Adjust layout restores the sheet's scroll and focuses ADJUST LAYOUT"
   - "UX: the phone back gesture from Adjust layout returns to the sheet, and one more Back closes it with the bar on the deck's route"
   - "UX: the small pan stays in view beside each field typed in with the keyboard up"
   - "UX: the first field does not move between an empty sheet and the Pygmy prefill"
   - "UX: Escape twice at real speed closes Adjust layout then the sheet, and one more Back leaves the page's history as it was before the sheet" (real browser; proves E1 against real traversal queuing)

   Accept: red on the base. Verify: the e2e command with `^UX:`.
3. **Implement the markup and CSS** (3.1, 3.2, 3.3). Delete the seven pan rules and the drawer-open grid blocks.

   Accept: step 2's layout tests green. Verify: the e2e `^UX:.the.sheet.opens|^UX:.Adjust.layout.shows`.
4. **Implement the JS** (3.3): the open, close and popstate branches, the deferred second close (E1), the Tab and Escape changes, `drawerBtn.onclick`, and deleting `keepToggle`.

   Accept: steps 1 and 2 green. Verify: `node --test --test-name-pattern '^UX:' tests/app.test.js` and the e2e command with `^UX:`.
5. **Rewrite and retire existing tests** per the section 8 rows marked P. Re-anchor the mutants below.

   Accept: `node --test tests/app.test.js` green; the named e2e and drawer_* tests green locally; `refresh_mutants --check` clean. Verify: `node --test tests/app.test.js`; `CHROME_BIN=… node --test tests/drawer_seats.test.js tests/drawer_drag.test.js tests/drawer_grid.test.js` (whole files: every drawer_* test now opens the layer through the toggle, see section 8 E7 rows); `python3 tools/refresh_mutants.py --check`.
6. **New mutants** (each `# kills:` one test above):

| patch | breaks | killed by |
|---|---|---|
| `uxp_small_pan_rule_wide` | SMALL becomes `46cqw` | UX: the sheet opens with the small pan left… |
| `uxp_adjust_no_push` | drops the pushState | UX: opening Adjust layout pushes one state-only entry… |
| `uxp_adjust_pop_closes_sheet` | drops the `adjustOpen` popstate branch | UX: BACK, Escape and a popstate each close Adjust layout… |
| `uxp_forward_closes_sheet` | drops the Forward branch | UX: a Forward traversal… |
| `uxp_close_sheet_single_back` | `closeScaleSheet` issues its `back()` while `pendingAdjustPop` is set instead of deferring | UX: Escape twice in quick succession… |
| `uxp_forward_ignores_hash` | drops `atSheet` from the Forward branch | UX: a Back onto an entry left with adjust state… |
| `uxp_fragment_keeps_sheet` | the `adjustOpen` branch returns without the `atSheet` check | UX: a typed #deck= fragment while Adjust layout is open… |
| `uxp_close_focus_before_unhide` | `hideAdjust` focuses before removing `.adjusting` | UX: closing Adjust layout focuses ADJUST LAYOUT, never body… |
| `uxp_push_before_guard` | drops `showAdjust`'s `boxOk` guard | UX: opening Adjust layout on a scale that does not parse pushes nothing |
| `uxp_fields_shown_in_adjust` | drops `.adjusting .scalecol{display:none}` | UX: Adjust layout shows the large pan… |
| `uxp_reserve_dropped` | `--adj-reserve:0px` | UX: Adjust layout shows at least 160px… |
| `uxp_plate_click_ignored` | drops the plate-click branch | UX: a tap on the small pan… |
| `uxp_close_scroll_lost` | no `sheetScroll` restore | UX: closing Adjust layout restores… |
| `uxp_close_focus_lost` | `hideAdjust` skips the focus | UX: BACK, Escape and a popstate… |
| `uxp_adjust_tab_leaks` | the Tab list ignores `.adjusting` | UX: the Tab cycle inside Adjust layout… |
| `uxp_pop_keeps_drag` | `hideAdjust` skips `cancelGesture` | UX: a popstate mid-drag… |

   Accept: each prints `killed`. Verify: the per-patch loop.
7. **Push, CI and gates** (section 7). Accept: `validate` concluded success at the verified head SHA. Verify: `gh run list --commit <sha> --workflow validate.yml --json conclusion`.

- **Re-anchor** (kills or suite headers, or hunks), added by the eng review (their tests run in the layer now; confirm each is still killed): `dr2a_ink_hairline_on_the_ring`, `dr2a_hit_radii_overlap`, `r4t_fine_toggle_wraps_at_320`, `dr2b_arm_repaint_scrolls_sheet`, `dr2b_lift_scrolls_sheet`, `dr2b_touched_node_listener_removed`. From the design pass: `di_e_drawer_band_lost`, `di_e_side_stack`, `di_e_no_wide_grid`, `dr1_landscape_scroll_padding`, `dr1g_band_not_observed`, `dr1g_body_not_observed`, `dr1g_focus_not_revealed`, `dr1g_padding_kept_unstuck`, `dr1g_padding_kept_with_field_focus`, `dr1g_stuck_under_44`, `dr1g_threshold_off`, `dr1g_toggle_not_in_view`, `kb_f4_plate_not_shrunk`, `kb_f4_plate_too_small`, `kb_f4_bottom_ring_untappable`, `kb_f4_focus_scrolls`, `dr2a_focus_on_open_no_fallback`, `dr2a_focus_on_open_removed`, `di_tab_skips_fields`, `dr3_hidden_buttons_reachable_by_tab`, `dr3_tab_list_omits_disclosure`, `dr3_escape_on_disclosure_loses_focus`, `r4t_dr3_stop_outside_scrollport`, `r4t_parse_state_keeps_gesture` (to the app test "UX: a popstate mid-drag…" or the DR2b 16.3 app test, whichever fails), `e_sheet_width_fixed`, `dr1_toggle_inert`.
- **Retire** (the test is superseded and the mutated code is deleted):
  - `dr1_open_no_scroll` (the scrollIntoView calls are gone);
  - `kb_f4_no_keep_toggle` (`keepToggle` is gone);
  - `dr2a_cap_back_to_42dvh` (the cap is gone);
  - `di_e_pan_clamp_low` and `di_e_pan_unpinned` (the stacked clamp is gone; `uxp_small_pan_rule_wide` replaces them);
  - `di_e_no_scroll_padding` (no band padding in the sheet).

  A retired patch is deleted only after `git apply --check` shows its anchor is gone or its test is retired.
- **Risks.**
  - A Forward or Back race against `pendingAdjustPop`. Mitigated by E1 (one traversal in flight), E2 (`atSheet`), and testing each order in the sandbox and once in a real browser.
  - The `.adjusting` max-width change at 1280x800 must not uncover the sidebar ("the add-scale sheet covers the sidebar when open on desktop" stays green).
  - `display:contents` and `:has()` rules for the old drawer-open grid must all be gone: grep for `#scale-layout-zone.open`.
- **Non-goals:** the lip, the keyboard, copy changes beyond the new head.

### Lane L: footer lip (item 4)

- **Branch** `claude/dual-input-ux-l`, base = lane P's verified head SHA (stacked).
- **Owns:**
  - markup: `#scale-lip`;
  - CSS: the footer block (`#scale-generate`, `#scale-delete-row`, `.lip`, `.lipped`);
  - JS: new `setLip`, `lipScroll` and the user-window listeners;
  - one call each in `applyKbOffset` (the kbup edges), `holdPin`, `revealField` and `hideAdjust` (`lipQuietUntil`), `showSheet` and `hideSheet` (reset);
  - the Tab list (genBtn → lip when `lipped`);
  - `tools/sandbox.js` ELEMENT_IDS (`scale-lip`);
  - the tests and mutants below.
- **Never touches:** anything lane P owns beyond those single calls, `#scale-guidance` and its rules, keyboard detection, the engine and data, README and CLAUDE.md.
- **rAF / ResizeObserver:** neither may be added. Timestamps (`userWindowUntil`, `lipQuietUntil`) replace frame waits, and a decision measures once.

**Steps.**
1. **Failing app tests:**
   - "UX: the lip names GENERATE CARDS on Add and SAVE CHANGES on Edit, a seeded deck's Edit included"
   - "UX: a 23px user scroll down does not collapse the footer and 24px does"
   - "UX: a user scroll up of 24px, or one that reaches the end, restores the footer"
   - "UX: revealField, the tap pin and the keyboard handler's scrolls never collapse the footer"
   - "UX: negative scrollTop and overshoot past the end change no lip state"
   - "UX: a collapse needs more than one footer height of remaining scroll, so a scripted scroll to the end and back changes lipped at most twice"
   - "UX: the keyboard rising collapses the footer and its fall restores it"
   - "UX: a lip tap restores and holds until the next keyboard rise"
   - "UX: Tab onto the lip restores the footer and focuses GENERATE CARDS, or DELETE when GENERATE is disabled on Edit"
   - "UX: the guidance slot never collapses"
   - "UX: Adjust layout never shows the lip"

   - "UX: a collapse while GENERATE CARDS holds focus moves focus to the lip, never body"
   - "UX: a lip tap while lipHold holds is not undone by a user scroll down before the next keyboard rise"

   Accept: 13 red. Verify: `node --test --test-name-pattern '^UX:.(the.lip|a.2[34]px|a.user|revealField|negative|a.collapse|the.keyboard|a.lip|Tab.onto|the.guidance|Adjust.layout.never|a.collapse.while|a.lip.tap.while)' tests/app.test.js`.
2. **Failing e2e**, five viewports, Add and Edit:
   - "UX: a real touch swipe down collapses the footer to a 44px lip, a swipe up restores it, with no flicker under momentum"
   - "UX: a sheet whose content does not scroll never collapses"
   - "UX: with the keyboard up the lip and the focused field are on screen, and dismissing the keyboard restores GENERATE"
   - "UX: the lip has no transition under prefers-reduced-motion"
   - "UX: at 844x390 with the keyboard up (tiny, the surface scrolls) a real touch swipe with momentum collapses and restores at most once each" (eng review E10: the `.sheetsurf` scroller is the path most likely to oscillate)

   Accept: red. Verify: `CHROME_BIN=… node --test --test-name-pattern '^UX:' tests/e2e.test.js`.
3. **Implement** 3.4. Accept: steps 1 and 2 green. Verify: the step 1 command and the step 2 command.
4. **Rewrite existing tests** (section 8 rows marked L), and the shared e2e helpers that read `#scale-generate`'s rect: `sgGeometry` (its `gapBottom` and `genTop`) and the KB geometry helper measure `#scale-lip` when `#scale-sheet.lipped` (eng review E8: a `display:none` primary measures 0x0, so N-A5's "above the primary" clause would pass vacuously or fail on a negative gap). Accept: green. Verify: `CHROME_BIN=… node --test --test-name-pattern 'SG:.N-A|KB:|KB2:|GENERATE.CARDS|with.the.box.focused' tests/e2e.test.js`.
5. **New mutants:**

| patch | breaks | killed by |
|---|---|---|
| `uxl_threshold_zero` | 24 → 0 | UX: a 23px user scroll… |
| `uxl_programmatic_counts` | ignores `lipQuietUntil` | UX: revealField, the tap pin… |
| `uxl_no_user_window` | counts every scroll | UX: revealField, the tap pin… (keyboard handler clause) |
| `uxl_no_remaining_guard` | drops `remaining > Δ` | UX: a collapse needs more than one footer height… |
| `uxl_overscroll_unclamped` | raw deltas | UX: negative scrollTop… |
| `uxl_end_not_restoring` | drops the end edge | UX: a user scroll up of 24px, or one that reaches the end… |
| `uxl_kb_ignored` | drops the kbup edge call | UX: the keyboard rising… |
| `uxl_tab_lip_stays` | no focusin restore | UX: Tab onto the lip… |
| `uxl_lip_name_static` | hard-codes GENERATE CARDS | UX: the lip names… |
| `uxl_guidance_collapses` | `.lipped #scale-guidance{display:none}` | UX: the guidance slot never collapses |
| `uxl_motion_reduced` | drops the reduced-motion rule | UX: the lip has no transition… |
| `uxl_collapse_drops_focus` | skips the focus move at a collapse | UX: a collapse while GENERATE CARDS holds focus… |
| `uxl_hold_ignored` | scroll collapse ignores `lipHold` | UX: a lip tap while lipHold holds… |

   Accept: each prints `killed`. Verify: the per-patch loop.

6. **Re-anchor** (kills headers follow the renamed tests): `kb_no_tiny_class`, `kb2_tiny_flank_dead`, `e_kb_show_sheet_never_measures` (if its test changes), `e_sheet_primary_back_in_the_scroll` (the test kept; confirm still killed), `e_sheet_body_refuses_to_shrink`, `e_sheet_surface_is_not_a_column`, `sg_*` (unchanged titles; confirm `git apply --check`). **Retire:** none expected.
7. **Push and gates.** Accept and verify as lane P step 7.

- **Risks.**
  - iOS momentum ends without a touchmove. The 150ms chained window covers it; the phone check confirms it.
  - A keyboard-up `tiny` sheet scrolls `.sheetsurf`, not `.sheetbody`. Both are listened to and the `remaining` check uses the active scroller.
  - SG: N-A6 measures the scrollport across states without user scrolls or a keyboard, so `lipped` never flips there. An assertion that `lipped` is false is added to it. N-A5 and N-A7 DO raise keyboards, so the rising edge collapses the footer there; N-A5 is rewritten (section 8) and N-A7 only reads the seed box, which gains room.
- **Non-goals:** guidance slot behaviour, keyboard models, Adjust layout.

### Lane D: docs + counts (last)

- **Branch** `claude/dual-input-ux-d`, base = lane L's head.
- **Owns:** `CLAUDE.md` (the sheet sections: Known pitfalls sheet-guidance bullet as needed, a new "Sheet UX" subsection under DEV/dual input), `README.md` (the mutant count, with a sentence on the sheet if README describes it), `tests/suite_health.py` FLOORS rows (app, e2e, harness, drawer_grid, drawer_seats, drawer_drag, mutation_harness) set from the `validate` run artifacts of lane L's head (memory: FLOORS lag CI count).
- **Never touches:** `index.html`, tests other than `suite_health.py`, mutants.
- **rAF / ResizeObserver:** not applicable.

**Steps.**
1. Every sentence names its test title, or "(no test; true by <file>)".
2. The README count equals `ls tests/mutants/*.patch | wc -l` at the lane head.
3. FLOORS equal the CI per-file counts.

- **Verify:** `test "$(ls tests/mutants/*.patch | wc -l | tr -d ' ')" = "$(grep -o 'applies [0-9]* mutant' README.md | grep -o '[0-9]*')"`; `python3 -m unittest tests.test_suite_health tests.test_ci_scope`; `node --test tests/mutation_harness.test.js`; the reviewer re-verifies every sentence against the code (memory: docs lanes cite tests).
- **Mutants:** none new. If a doc-reading test changes, re-anchor its mutant.

## 7. Sequencing, gates, phone check, cost

**Waves.**
- W0: base (integrator).
- W1: lane P.
- W2: lane L on P's head.
- W3: lane D on L's head.

Each wave starts only after the previous lane is on DEV. The reason: L measures P's layout, and the owner's phone check of P can change P (one bounce before L starts is cheaper than two).

**Per-lane gate (binding).**
1. Push. Verify the PR: `gh pr view <n> --json state,headRefOid`; the head must equal the local tip (re-query once, since headRefOid lags).
2. `gh pr view <n> --json mergeable` must not be CONFLICTING.
3. `gh run list --commit <sha> --workflow validate.yml` must conclude **success** at that SHA. A lone mutation survivor on unrelated code gets one rerun at the same SHA.
4. A fresh independent `swarm-reviewer` at that SHA, briefed with:
   - branch, base SHA, head SHA;
   - the acceptance criteria and non-goals quoted verbatim from this plan;
   - the Owns / Never touches lists;
   - the instruction to prefix `OPENCLAW_SESSION=1`, with no node_modules symlink.

   It returns PASS or PASS_WITH_NITS. A FAIL needs a concrete failure scenario.
5. The integrator opens `claude/dev-sync-<lane>` from `origin/dev`, merges the lane branch (keeping the dev overlay), and merges it to `dev`.
6. The owner phone-checks on https://handpan-cards-dev.pages.dev.
7. The main PR stays HELD.

After lane D, the whole dual-input stack (#403, #404, P, L, D) waits for the owner's explicit go to merge to `main`.

**DEV phone check (owner, iPhone).** Portrait first, then landscape.

Lane P:
1. Settings → + ADD A SCALE. Expect a small pan top-left, with DING / TOP / INNER / BOTTOM to its right and ADJUST LAYOUT under the pan.
2. Type `D3`, then `A3 Bb3 C4 D4 E4 F4 G4 A4`. Expect the small pan to draw; the long rim scrolls inside its box.
3. Tap the small pan. Expect a full screen "Adjust layout" with BACK, a large pan and the controls, and no note fields and no GENERATE.
4. Drag a rim note onto another seat; tap MIRROR TOP. Expect the swap and the mirror to show.
5. Phone back gesture. Expect the sheet again, at the same scroll, with the swap kept on the small pan.
6. Tap ADJUST LAYOUT, then BACK. Same result.
7. Phone back again. Expect the sheet to close and the practice screen to return; the address bar shows the deck's link.
8. Repeat 3-7 from Edit on D Kurd 10 (seeded) and on a custom deck. Expect SAVE CHANGES in place of GENERATE CARDS.
9. Rotate to landscape and open Adjust layout. Expect the large pan left and the controls right.

Lane L:
1. Open + ADD, prefill Pygmy (Edit), scroll down slowly. Expect SAVE CHANGES and DELETE to fold into a thin lip reading SAVE CHANGES; the guidance line stays.
2. Scroll up a little. Expect the footer to return.
3. Flick hard to the bottom and let it bounce. Expect no flicker; at the end the footer is shown.
4. Tap the lip while collapsed. Expect the footer to show.
5. Tap a note field (keyboard up). Expect the lip, not the full footer. Dismiss the keyboard: the footer returns.
6. Landscape with the keyboard up: swipe the sheet; the lip and the fields are reachable (F5 still passes). Tap between fields: nothing jumps (F6 still passes).

**Cost estimate.**

| item | subagent runs | CI runs |
|---|---|---|
| Lane P | 1 + ~2 bounces | ~4 |
| Lane P reviewer | 2-3 | — |
| Lane L | 1 + ~2 bounces | ~4 |
| Lane L reviewer | 2-3 | — |
| Lane D | 1 + 1 bounce | ~2 |
| Lane D reviewer | 1-2 | — |
| Dev syncs | 3 PRs into `dev` | none (CI does not run on dev PRs) |
| **Total** | **~12-16** | **~10** |

Each CI run is the full `validate` workflow, about 1240+ mutants sharded. Wall time is about 2-3 days with the owner's phone checks between waves.

## 8. Test supersession table

P = lane P, L = lane L. "Rewrite" keeps the behaviour the owner validated where one exists.

| exact title (file) | action | reason | replacement |
|---|---|---|---|
| DR1 line 34: the open plate band stays in the scrollport at the end of the body, and is static while the field has focus (e2e) | rewrite P | no field in the layer | "UX: in Adjust layout the plate band stays in the scrollport at the end of the controls" |
| DR1 line 35: at 380 x 667 the open plate is no wider than 42 percent of the viewport height (e2e) | retire P | the 42% cap is superseded by LARGE | UX: Adjust layout shows at least 160px of controls under the large pan… |
| DR1 lines 36 and 88: at 844 x 390 the open drawer is two columns with a 220px plate, and at 500 x 390 one column (e2e) | rewrite P | LARGE replaces 220px | "UX: Adjust layout is two columns at 844x390 with the large pan ≥280px, one column at 500x390" |
| DR1 line 82: the status line is inside the scrollport at the end of the body at 380 x 780 and 380 x 667 (e2e) | rewrite P (title kept) | in the layer | same assertion, in Adjust layout |
| DR1 focus order: on Edit the plate is a tab stop only while the drawer is open, and comes before the toggle (e2e) | rewrite P | toggle hidden while open | "UX: in Adjust layout the plate is the stop after BACK, and is no stop in the sheet" |
| DR1 line 86: on Edit the band goes static for the name, and not for a drawer control (e2e) | retire P | the name is not in the layer; the sheet band no longer covers fields | UX: the small pan stays in view beside each field typed in… |
| DR1 line 87: a control focused by Tab under the open band is not hidden behind it (e2e) | rewrite P (title kept) | in the layer | same |
| DR1 line 87 landscape: at 844 x 390 with the drawer open every Tab stop of the sheet ends inside the scrollport, on Add and on Edit (e2e) | rewrite P | stops are the layer's | "UX: at 844x390 every Adjust layout Tab stop ends inside the scrollport, on Add and Edit" |
| DR1 line 89 (report): where the toggle sits at 380 x 667 closed, and the status at 844 x 390 (e2e) | rewrite P | report on the new geometry | same title with "(report, Adjust layout)" |
| DR1 line 108: the open toggle shows one aria-hidden U+00D7, the closed one hides it, and the name stays (e2e) | retire P | the × is deleted | UX: Adjust layout shows the large pan… (asserts the toggle is hidden) |
| DR1 line 108: the toggle holds one aria-hidden close mark, U+00D7, and keeps its name (app) | retire P | same | UX: opening Adjust layout pushes… (asserts the name) |
| DR1 open step 5: opening the drawer scrolls the zone into view with block nearest and behavior auto, and closing does not scroll (app) | retire P | the layer opens at top | UX: closing Adjust layout restores the sheet's scroll… |
| DR1 line 17: the toggle shows the drawer, sets aria-expanded and adds .on (app) | rewrite P (title kept) | also adds `.adjusting` | same |
| DR1 line 20: the toggle again hides the drawer and focus is on the toggle, also after Escape from a drawer control (app) | rewrite P | BACK, not the toggle, hides it | "UX: BACK, Escape and a popstate each close Adjust layout…" (this test is folded in) |
| DR1 line 21: Escape closes the open drawer and keeps the sheet; a second Escape closes the sheet (app) | rewrite P (title kept) | plus history `back` recorded | same |
| DR3 Tab order on Add and Edit, finer controls closed and open (app) | rewrite P | new order (D10) | same title |
| DI: the sheet's Tab order is BACK, the deck name on Edit, DING, TOP, INNER, BOTTOM, then #scale-box and the existing stops (app) | rewrite P (title changes per D10) | ADJUST LAYOUT before DING | "DI: the sheet's Tab order is BACK, the deck name on Edit, ADJUST LAYOUT, DING, TOP, INNER, BOTTOM, then #scale-box and the existing stops" |
| RD: the Edit page's Tab order is BACK, name, box, ADJUST LAYOUT, swatches, SAVE CHANGES, DELETE with the drawer closed, forward and back, and no stop is a select (e2e) | rewrite P | D10 | "RD: the Edit page's Tab order is BACK, name, ADJUST LAYOUT, the fields, box, swatches, SAVE CHANGES, DELETE…" |
| DI: at 320x568 with a 260px keyboard each field typed in stays fully in view with at least 130px of pan in view and the sheet head hidden, and BACK shows again once the keyboard closes (e2e) | rewrite P | the 130px floor is superseded | "DI: at 320x568 with a 260px keyboard each field typed in stays fully in view with the whole small pan in view and the sheet head hidden, and BACK shows again once the keyboard closes" |
| DI: at 380x780 with a 260px keyboard each field typed in stays fully in view with at least 212px of pan in view (e2e) | rewrite P | the 212px floor is superseded | "DI: at 380x780 with a 260px keyboard each field typed in stays fully in view with the whole small pan in view" |
| DI: at 844x390 the Add sheet shows the pan beside the fields at least 190px wide, with the group heading hidden (e2e) | rewrite P | SMALL is 148 there | "DI: at 844x390 the Add sheet shows the small pan beside the fields, with the group heading hidden" |
| DI: at 1280x800 the Edit sheet shows the pan beside the four fields and DING without scrolling (e2e) | keep (add 160px cap assert) P | — | — |
| DI: with the drawer open at 844x390 the plate stays beside the drawer controls at 220px, and at 380x780 above them (e2e) | rewrite P | layer | "UX: Adjust layout puts the large pan beside the controls at 844x390 and above them at 380x780" |
| DI: a drawer opened by Tab and Enter at 844x390 shows the plate from the scroller top and keeps the focused note in view (review F2) (e2e) | rewrite P (title kept, "drawer" → "Adjust layout") | layer | same |
| the sheet widens with the viewport on desktop, and the pan with it (e2e) | rewrite P | the small pan caps at 160 | "the sheet widens with the viewport on desktop, and the small pan stays at most 160px" |
| KB: F4 at <vp> a tap on ADJUST LAYOUT from a scrolled Edit Kurd keeps the toggle in place or just under the band and opens the drawer below it (e2e, per vp) | rewrite P | the layer replaces the in-place drawer; F4's intent is kept | UX: closing Adjust layout restores the sheet's scroll and focuses ADJUST LAYOUT |
| KB: F4 with the drawer open at <vp> the per-viewport floor of options shows under the pan (160px where the viewport allows) and the plate is at least 140px (e2e) | rewrite P (owner-validated) | LARGE | "KB: F4 in Adjust layout at <vp> at least 160px of options show under the large pan and the pan is at least 140px" |
| KB: F4 with the drawer open at <vp> every note on the shrunk pan is hit by a tap at its centre (<slug>) (e2e) | rewrite P (owner-validated) | LARGE | "KB: F4 in Adjust layout at <vp> every note on the large pan is hit by a tap at its centre (<slug>)" |
| KB: F4 opening the drawer focuses the first note without scrolling the sheet (e2e) | keep P ("drawer" → "Adjust layout") | — | — |
| KB: F4 opening the drawer focuses the first note with preventScroll; KB: F4 the put-down focus path passes preventScroll (app) | keep | — | — |
| DR2a browser (84): on Add at 380x667 with the band stuck the toggle of <deck> is inside the scrollport… (drawer_seats) | rewrite P | toggle hidden | "…BACK and the status of <deck> are inside the scrollport…" |
| DR2a browser (18, 84): the focus move on open leaves the toggle inside the scrollport and the step rows reachable at 380x667 (drawer_seats) | rewrite P | same | "…leaves BACK inside the scrollport…" |
| DR2a browser (121, item 7): over a scale that does not parse the closed drawer leaves the toggle focused and aria-disabled (drawer_seats) | retire P | the scale cannot stop parsing in the layer (no input) | the app test "DR2a item 7 (121)…" stays |
| DR2a browser: Tab order, the plate as one stop, and Space/arrows/Escape on a focused note (drawer_seats) | rewrite P (title kept) | layer order | same |
| DR3 browser: real Tab skips the hidden step buttons and every stop lands inside the scrollport at 380x667, and the toggle moves no scroll (drawer_seats) | rewrite P | "BACK moves no scroll" | same title with "BACK" |
| DR2b browser: editing the scale box mid-drag cancels the gesture, drops the ghost and moves nothing (drawer_drag) | retire P | the box is hidden in the layer | UX: a popstate mid-drag cancels the gesture and moves nothing |
| DR2a browser (95), both: the picked ring and seat rings at least 2px; on every field of <deck> at the 380x667 open plate the orange ring shows 2px (drawer_seats) | keep P, runs in Adjust layout (E7) | the plate is LARGE; the ring rule is unchanged | — (re-anchor `dr2a_ink_hairline_on_the_ring`) |
| DR2a browser (57): with a note picked the picked ring's targets are at least their all-points radius and pairwise disjoint (drawer_seats) | keep P (E7) | same | — (re-anchor `dr2a_hit_radii_overlap`) |
| DR2a browser (58), (84) status-row fit, (84, report) Edit vs Add plate width, (18, 96) opening by pointer/keyboard, (18) no ring of two / no note, (70) swap reaches the stored deck; Lane F browser: the drawer hint is the first child (drawer_seats) | keep P (E7); a test that fails only because a geometry figure moved is rewritten with the LARGE figure and named in the lane report | the layer opens through the same toggle | — |
| DR3 browser: at 320x568 the finer-controls toggle reads on one line, closed and open (drawer_seats) | keep P (E7) | the layer is full width | — (re-anchor `r4t_fine_toggle_wraps_at_320`) |
| DR2b browser (F1, 93): at <w>x<h> with the keyboard up (offsetTop <ot>) a <how> drag keeps the ghost on its hit point (drawer_drag, the three keyboard rows) | rewrite P (E7) | the test focuses `#scale-box`, which `.adjusting` hides, so no keyboard can be up in the layer; keep the two no-keyboard rows and replace the keyboard rows with "…with the visual viewport offset (offsetTop <ot>)…" driven by `fakeKeyboard` without a field focus | re-anchor `dr2b_arm_repaint_scrolls_sheet` |
| DR2b browser (F1 step 4), (46, rule T), and the other rule D / (43-49) / (77) / (92-95) / (7) rows (drawer_drag) | keep P (E7) | the scroller is still `.sheetbody` | — (re-anchor `dr2b_lift_scrolls_sheet`, `dr2b_touched_node_listener_removed`) |
| DR1 rule G grid / by resize / boundary walk (drawer_grid, 3 tests) | rewrite P (titles kept) | run in Adjust layout; drop the "keyboard-up fields" clause | same titles |
| with the box focused and the viewport shrunk, both the box and the primary stay on screen (e2e) | rewrite L | item 4 supersedes | "with the box focused and the viewport shrunk, both the box and the lip stay on screen, and a lip tap shows the primary" |
| GENERATE CARDS survives a viewport shrunk the way a soft keyboard shrinks one (e2e) | rewrite L | same | "GENERATE CARDS is one lip tap away in a viewport shrunk the way a soft keyboard shrinks one" |
| KB: at 844x334 with a 104px visible area, under every innerHeight model the sheet is tiny, the focused field is in view and GENERATE and the guidance slot are reachable by scrolling the surface (e2e) | rewrite L | the lip | "…the lip and the guidance slot are reachable by scrolling the surface" |
| KB2: with the keyboard up and a note field focused in landscape, a touch swipe anywhere on the sheet scrolls it until GENERATE is fully visible, and back to DING (e2e, owner F5) | rewrite L (owner-validated) | the lip | "…scrolls it until the lip is fully visible, and back to DING" |
| KB2: at 393 wide with the keyboard up, tapping each note field in turn moves no field that was already fully visible before the tap (e2e, owner F6) | keep L + assert `lipped` stays true | — | — |
| SG: N-A5 the notice and a warning are inside the viewport, the surface and above the primary at every fold viewport and keyboard, create and Edit, drawer open and closed, scrolled to the top and to the end (e2e) | rewrite L | the primary may be a lip (`sgGeometry` measures `#scale-lip` when lipped, E8); "drawer" becomes "Adjust layout" | "SG: N-A5 the notice and a warning are inside the viewport, the surface and above the primary or the lip at every fold viewport and keyboard, create and Edit, Adjust layout open and closed, scrolled to the top and to the end" |
| GENERATE CARDS is reachable without scrolling at every phone viewport; SAVE CHANGES is reachable without scrolling on a built-in-sized deck / on the largest pan the engine allows; G2b: GENERATE CARDS stays on screen when the scale field is three rows tall (e2e) | keep L (assert `lipped` false at open) | — | — |
| DI / IB app tests (fields, compose, stale, messages, inner below rim), SG: N-A2/N-A3/N-A4/N-A6/N-A7/N-A10, AO:, SU:, SI: | keep | untouched | — |

Behaviour the owner validated on DEV that keeps a test:
- dual input: all DI app tests, plus the two rewritten DI keyboard tests;
- inner below rim: every IB test, untouched;
- F4: tappable large pan, ≥160px options, focus without scroll;
- F5: KB2 landscape swipe, rewritten to the lip;
- F6: KB2 393 field taps, kept.

## Design review (2026-10-19, /plan-design-review, spawned, medium effort)

Ground truth read: `index.html` at `origin/claude/dual-input-kb2b` (68060ed) for tokens; text widths measured with fontTools against `tools/fonts/`. Initial rating 6/10: the structure and history logic are thorough, but states, the lip's look and a few a11y names were unspecified.

| pass | before | after | what moved it |
|---|---|---|---|
| 1. Information architecture | 8 | 9 | caption fit and pan-column height measured (3.2) |
| 2. Interaction states | 4 | 8 | sheet state table (3.2); empty, error and ring-under-two states in the layer (3.3); lip disabled state (3.4) |
| 3. User journey | 7 | 8 | entry announcement (D16); focus rescue at a lip collapse (3.4) |
| 4. AI slop risk | 9 | 9 | none found: utilitarian, reuses `.mode`, no new ornament |
| 5. Design system | 5 | 9 | lip colours, type, radius and handle from shipped tokens; Adjust head reuses `.sheethead` and `#scale-title` |
| 6. Responsive and accessibility | 5 | 8 | 320px caption wrap, 1280x800 layer width (D15), focus-ring inset, lip name (D18), no live chatter |
| 7. Unresolved decisions | 14 open | 18 open | D15-D18 added; D1-D14 untouched |

Overall (lowest of passes 1-6): 4 before, 8 after.

**Edits made.**
- 3.2: "Caption fit": toggle wraps to two lines at 100% of the pan column on phone portrait; hint line counts; no added sheet height.
- 3.2: "Tap cue on the small pan": caption is the cue; pointer cursor and shared hover while `boxOk`; no new focusable.
- 3.2: "Sheet states" table (empty, unparsed, valid, Edit, keyboard up, guidance).
- 3.3: head styling reuses `.sheethead` and `#scale-title` (visible "ADJUST LAYOUT"); BACK is a 44px `.mode`.
- 3.3: focus-ring inset of `--ring` + 2px around the LARGE pan.
- 3.3: empty and error states inside the layer; no motion; pointers to D15 and D16.
- 3.4: `.lip` concrete spec (box, border, radius 10px, label type and colour, disabled opacity, handle colour and size, focus, hover).
- 3.4: focus moves to the lip if a collapse hides the focused button.
- 3.4: no live announcement on collapse or restore; footer size at 320x568.
- 5: D15 desktop layer width, D16 entry announcement, D17 lip palette, D18 lip accessible name.

**Auto-choices (spawned session, recommended option each time).**
- Scope: the named plan file (scope-gate exception 2).
- Mockups: skipped; the plan's wireframes plus measured widths suffice, and the run is non-interactive.
- DEV screenshots: skipped; tokens read from the kb2b source instead.
- Outside voices (Codex / design subagent): skipped to stay at medium effort.
- Every gap was written into section 3 as spec where the shipped design system already answers it; only owner-taste calls became D15-D18.

**NOT in scope.** Resolving D1-D14; any change to sections 6-8 test lists beyond what D16 and D18 imply (lanes P and L own those rewrites); copy changes beyond the two new accessible-name strings.

**What already exists.** `.mode` and its focus ring, `.sheethead`, `#scale-title`, the disabled-primary opacity, the drawer's no-transition rule, `#scale-drawer-status` (polite, atomic), the guidance slot and its N-A5 visibility test.

**Implementation tasks (for lanes P and L).**
- P: caption wrap CSS and the state table's cues; head reuse; ring inset; D15 per the owner's pick; D16 status prefix and its test.
- L: `.lip` CSS per 3.4; disabled-label opacity; focus rescue at collapse plus an app test; D18 `aria-label` plus a name assertion.

## Engineering review (2026-10-19, /plan-eng-review, spawned, medium effort)

**Ground truth.** `origin/claude/dual-input-kb2b` at 68060ed (#404) merged locally with `origin/claude/inner-below-rim-a` at 0131672 (#403), in a scratch worktree, never pushed. On that tree: `merge-tree` is clean (tree 067961e4), `inline_engine --check` and `sync_decks --check` pass, `refresh_mutants --check` says "all mutant patches apply cleanly", there are 1212 patches, and README line 77 says 1180. Every section 8 title was grepped against `tests/*.test.js` and every named mutant against `tests/mutants/`: all exist (the F4 titles are template literals over `${w}x${h}`, written `<vp>` here). Owner decisions were read under their recommended options only; none is resolved here.

**Findings** (fixed in place unless marked open):

| id | sev | conf | where | finding | fix |
|---|---|---|---|---|---|
| E1 | P1 | 7/10 | 3.3 closeScaleSheet; `index.html` `closeScaleSheet` | Escape closes the layer (`back()` queued, `pendingAdjustPop` set), and a second Escape or BACK before that pop issues a second `back()`. Two traversals queued in one task may coalesce, and the flags then pair with the wrong popstate. The planned `go(-2)` has the same blind spot and needed a sandbox `go()`. | Defer: while `pendingAdjustPop` is set, `closeScaleSheet` sets `closeAfterAdjustPop` and returns; the pop branch then closes the sheet. One traversal in flight; no `history.go`. Two app tests, one real-browser test, mutant `uxp_close_sheet_single_back` redefined. |
| E2 | P1 | 8/10 | 3.3 popstate; `syncRoute` `replaceState(history.state, …)` | A reload on the Adjust entry leaves `{adjust:true}` on an entry that syncRoute rewrites to `#deck=…`. A later Back from a fresh sheet onto it reopens Adjust layout instead of closing the sheet. | The Forward branch requires `location.hash === sheetRoute()`. Test and mutant `uxp_forward_ignores_hash`. |
| E3 | P2 | 8/10 | 3.3 hideAdjust; `closeDrawer` | `closeDrawer(true)` focuses `drawerBtn` without preventScroll while `.adjusting` still hides `#scale-layout-row`, so focus drops to body (or scrolls before the restore). | Order fixed: unhide, `closeDrawer(false)`, restore scroll, focus with preventScroll. Test and mutant `uxp_close_focus_before_unhide`. |
| E4 | P2 | 8/10 | 3.3 opening; `openDrawer` returns on `!boxOk` | A push before `openDrawer`'s guard leaves an orphan history entry; `hideSheet` did not reset the new flags. | `showAdjust` guard (step 0) and `hideSheet` resets. Test and mutant `uxp_push_before_guard`. |
| E5 | P2 | 9/10 | lane P ownership; `drawerBtn.onclick` | The toggle's click handler calls `openDrawer`/`closeDrawer` directly and was not in lane P's list, so the toggle would bypass the push. | Named in 3.3 and lane P's ownership. |
| E6 | P2 | 7/10 | 3.3 popstate; "UX: a typed #deck= route…" | A real fragment navigation fires popstate (state null, new hash) before hashchange. The `adjustOpen` branch would close only the layer and leave the sheet open on a foreign URL; the sandbox test, dispatching hashchange alone, would pass anyway. | `atSheet` check: a fragment closes the layer and the sheet, as it closes the sheet today. Test retitled to dispatch popstate then hashchange. Mutant `uxp_fragment_keeps_sheet`. Auto-choice A3. |
| E7 | P2 | 8/10 | section 8; `drawer_seats`/`drawer_drag` | About 20 drawer_* tests open the drawer through the toggle and were not listed; the three DR2b (F1, 93) keyboard rows focus `#scale-box`, which the layer hides, so they cannot raise a keyboard. Six mutants killed by them were missing from the re-anchor list. | Rows added (keep or rewrite), six mutants added to re-anchor, lane P step 5 verifies whole drawer_* files. |
| E8 | P2 | 8/10 | lane L step 4; e2e `sgGeometry` | The SG and KB geometry helpers read `#scale-generate`'s rect; collapsed it is 0x0, so N-A5's "above the primary" clause passes vacuously or fails on a negative gap. | The helpers measure `#scale-lip` when lipped. |
| E9 | P2 | 9/10 | 3.3 two columns vs 3.1 table (the design review's D15) | `.sheetsurf{max-width:none}` was unscoped, contradicting "under" at 1280x800. | Scoped to landscape phones per D15(a), with a note on what D15(b) changes. |
| E10 | P2 | 6/10 | lane L e2e | The tiny keyboard-up case (`.sheetsurf` scrolls, 844x390) is the scroller most likely to oscillate and had no named test. | One e2e at 844x390 with a keyboard and real momentum: at most one collapse and one restore. |
| E11 | P3 | 9/10 | lane P/L steps | Several acceptance criteria had no verify command (P4, P5, P7, L2-L4, L5-L7, lane D's README count). Lane P step 1 said "fails 9". | Commands added; counts updated to 13 (P) and 13 (L). |
| E12 | P3 | 9/10 | Wave 0 | The SHA and tree were for 06ce5ba. | Updated to 68060ed / 067961e4. |
| E13 | P3 | 6/10 | lane L tests | `lipHold` and the collapse focus move had no test or mutant. | Two tests, two mutants. |

**Checked and sound (no change).**
- **State-only push.** Same URL, so there is no hashchange, and `syncRoute` and the hashchange listener stay guarded by `sheetOpen`. About cannot be open with the sheet (the sheet inerts the panel), so the new branches ahead of `aboutOpen` cannot steal its pops. A pop to an About entry is unreachable from inside the layer.
- **The lip's oscillation guard.**
  - A collapse needs `remaining > Δ`, and the footer sits below `.sheetbody` (normal mode) or inside `.sheetsurf` (tiny); in both cases `maxScroll` drops by Δ, so no clamp follows.
  - A restore leaves `remaining = Δ` or more, so no collapse can follow.
  - Clamped deltas zero out the rubber band.
  - Every programmatic scroller (`holdPin`, `revealField`, `applyKbOffset`, the scroll restore) stamps `lipQuietUntil`.
  - `applyKbOffset` runs on visualViewport `scroll` too (frame rate while zoomed), but it only stamps the quiet window and writes on change, so a zoomed pan cannot count as a user scroll.
  - The kb edge is computed there and nowhere else; the rising edge collapses unconditionally, which is the owner's item 4.
  - Two caveats are left to the phone check: momentum on iOS ending without a final event, and Android's resizes-content mode (`kb` true only while a text field is focused). E10 adds the riskiest scroller to CI.
- **No rAF or ResizeObserver added.** `syncBand`'s existing ResizeObserver (on `plateBand` and `bandPort`) is the only one outside the engine, and both lanes forbid new ones.
- **Serialized P then L.** Both lanes edit the sheet Tab list, `showSheet`/`hideSheet`, `tools/sandbox.js` ELEMENT_IDS and the same keyboard e2e helpers, and L's geometry reads P's footer and sheet. A file-ownership split does not exist inside one `index.html` without a shared-hunk merge; the stacked order costs one CI cycle and is right. Lane L's app tests (step 1) could be drafted during lane P's CI wait, against P's head, without pushing.
- **The GENERATE supersession.** Only five tests assert the primary under a keyboard (the four in section 4 plus N-A5); N-A7 and "with a real keyboard up, the seed box is not clipped" read only the seed box and gain room. G2b and the "reachable without scrolling" tests have no keyboard and keep `lipped` false.
- **Coverage.** Lane P's e2e loop covers 380x780, 320x568, 393x852 (+336 keyboard), 844x390 and 1280x800, on Add and Edit; lane L's covers the same five; E10 adds 844x390 tiny. Coverage diagram:

```
Adjust layout                      tests (app / e2e)
 open: toggle, plate tap, guard     app: push, plate tap, no-parse  | e2e: large pan, controls floor
 close: BACK, Escape, popstate      app: three routes, focus/scroll | e2e: restore scroll, back gesture
 history: Forward, stale state,     app: Forward, stale, fragment,  | e2e: Escape x2 at real speed
   fragment, double close             Escape x2, close-sheet
 drag in layer                      app: popstate mid-drag          | drawer_* files (E7)
Lip
 user scroll in/out, thresholds     app: 23/24px, up, end           | e2e: touch swipe + momentum
 programmatic scrolls ignored       app: reveal/pin/kb              | e2e: KB2 F6 keeps lipped
 kb edges, hold, Tab, focus         app: kb rise/fall, hold, Tab, focus move
 tiny scroller                      -                               | e2e: 844x390 kb (E10)
 guidance, Adjust, motion           app: guidance, Adjust           | e2e: reduced motion
```

**Owner decisions that are engineering-sensitive** (the non-recommended option changes lanes, tests or ownership):
- D2(b): removes `#scale-layout-toggle`; about 20 DR1/DR2/drawer_* tests and the E5 handler change; the plate becomes a button wrapping focusable notes (invalid), so the markup plan changes.
- D10(b): keeps the old DI/RD Tab-order tests; lane P drops two rewrites.
- D11(b): focus to BACK; rewrites the KB F4 focus tests, DR2a (18, 96) and two mutants (`kb_f4_focus_scrolls`, `dr2a_focus_on_open_*`).
- D12(b): static band; the three drawer_grid rule-G tests and nine `dr1g_*` mutants retire instead of re-anchoring.
- D15(b): two columns at 1280x800; reverses E9 and the 1280x800 rows of lane P's e2e tests.
- D16(b): drops the status prefix; the drawer-status tests that read the status on open keep their text.
- D6(b): a sliding footer animates the scroller height across frames and reopens the oscillation proof; lane L's guard would need a frame wait (rAF, which both lanes forbid).
- D14 (other values): thresholds in three lane L tests and `uxl_threshold_zero`.
- D18(b): lane L's lip-name test and `uxl_lip_name_static`.
- D7(b): swatches move into lane P's layer and both Tab lists.
- D13(b): an `adjust_open` event touches the analytics tests ("no event param is a string over 40 characters…" and the event list in CLAUDE.md), so lane D gains a sentence.
- D1(b) and D3(b): rewrite the IB label test and the DI input-attribute tests respectively.
- D4, D5, D8, D9, D17: copy or style only; no lane or ownership change.

**Auto-choices (spawned session, recommended option each time).**
- A1: review under every D's recommended option; none resolved.
- A2: E1 deferral over `history.go(-2)` (one traversal in flight beats a two-step jump the flags cannot see).
- A3: E6, a fragment closes the layer and the sheet, matching today's sheet behaviour, rather than closing only the layer.
- A4: keep the serialized P → L order.
- A5: Outside voice skipped (spawned, medium effort; every finding above was checked against the merged base instead).

**Unresolved.**
- D1-D18 (the owner's).
- Phone checks for iOS momentum and Android resizes-content on the lip (section 7).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 1 this plan (2026-10-19, spawned, medium) | issues_fixed | 13 issues (2 P1, 8 P2, 3 P3), all fixed in place; 0 open engineering gaps; 18 owner decisions open |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | score 4/10 -> 8/10, 10 spec edits, 4 new owner decisions (D15-D18) |
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | - | - |
| Codex Review | `/codex review` | Independent second opinion | 0 | - | skipped (spawned, medium effort) |

VERDICT: Design and eng reviews done; the plan is executable under the recommended options once the owner answers D1-D18; re-run the eng review only if the owner picks a non-recommended option listed as engineering-sensitive (D2, D6, D7, D10-D16, D18).

**UNRESOLVED DECISIONS:**
- D1 field labels in the narrow column (recommend a: two-line labels)
- D2 ADJUST LAYOUT as the pan's caption (recommend a)
- D3 single-line inputs (recommend a)
- D4 small-pan label legibility (recommend a: accept)
- D5 lip contents (recommend a)
- D6 motion (recommend a: instant, 150ms lip label fade)
- D7 swatches stay in the sheet (recommend a)
- D8 small-pan rule 30cqw (recommend as stated)
- D9 BACK name "Back to the scale" (recommend a)
- D10 Tab order follows visual order (recommend a)
- D11 focus the first note on open (recommend a)
- D12 sticky LARGE pan in portrait (recommend a)
- D13 no analytics event (recommend a)
- D14 24px hysteresis, 150ms window (recommend as stated)
- D15 Adjust layout at 1280x800 stays 520px, one column (recommend a)
- D16 announce "Adjust layout." on entry (recommend a)
- D17 lip palette secondary, not cream (recommend a)
- D18 lip accessible name "Show GENERATE CARDS" / "Show SAVE CHANGES" (recommend a)
