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

**What the user sees.**
- Open: today's footer, unchanged to the pixel (guidance slot, then GENERATE CARDS or SAVE CHANGES,
  then DELETE on Edit).
- Collapsed: the footer slides down over 180ms and folds into the body's existing 1px `#332c22`
  hairline and a 4px grabber row under it. The visible lip is 4px plus the 1px hairline, which is
  5px, inside the owner's 1-5px. Nothing else stays below the scroll, except a guidance line that
  holds text (see "Guidance").
- The grabber is a centred 36x4px pill, radius 2px, `#a79d8b` (the `.sheetlabel` colour). On
  `#1f1b15` it measures about 6:1 contrast, above the 3:1 WCAG 1.4.11 asks of a UI component. It
  reads as the iOS sheet grabber, the one convention for "pull this up".
- Cream (`#f1ece1`) is reserved for the full primary and never appears on the lip.

**Wireframes.** 380x780, Add.

Open:
```
| [ (D3) A3 Bb3 C4 ...              ]  |
|______________________________________|  <- body hairline #332c22
|  (guidance slot, 36px)               |
| [========= GENERATE CARDS =========] |
+--------------------------------------+
```
Collapsed, empty guidance:
```
| [ (D3) A3 Bb3 C4 ...              ]  |
| ...more fields, now in view...       |
|______________________________________|  <- hairline (1px)
|               ━━━━                   |  <- 4px grabber; tap zone runs 25px up from here
+--------------------------------------+
```
Collapsed, guidance with text:
```
|______________________________________|
| Crowded pan: small labels.           |
|               ━━━━                   |
+--------------------------------------+
```
Keyboard up, 393x852 with a 336px keyboard: the head shows, then the small pan and fields, then the
focused field, then the hairline and the grabber, then the keyboard.

**Markup.** Three wrappers and one button. All four are new ids added to `tools/sandbox.js` ELEMENT_IDS
(SB-2: the app looks each one up).
```
<div id="scale-guidance">...</div>                      (unchanged, still a direct surface child)
<div id="scale-foot">
  <div id="scale-footclip">
    <div id="scale-footslide">
      <button id="scale-generate">...</button>
      <div class="editrow" id="scale-delete-row" hidden>...</div>
    </div>
  </div>
  <button id="scale-lip" type="button" hidden aria-expanded="false"
          aria-controls="scale-generate scale-delete-row" aria-label="Show GENERATE CARDS"></button>
</div>
```
- Source order is still `.sheetbody`, `#scale-guidance`, `#scale-generate`, `#scale-delete-row`, so
  the app test "SG: N-A2 the served markup order is .sheetbody, #scale-guidance (#scale-msg,
  #scale-layout-state), #scale-generate, #scale-delete-row" holds.
- The e2e test "SG: N-A2 and N-A9 in the live DOM: ..." asserts the surface's exact children, and
  those DO change. The old 3.4 said they would not, which was wrong. Lane L rewrites that one
  assertion and keeps the title (section 8).
- `#scale-guidance` is never looked up by id. The FLIP below reaches it as `msgLine.parentElement`,
  so "SG: N-A3 no served id is removed and the wrapper is markup-only" holds.

**CSS.** Values are final. The ids follow the shipped tokens.

```css
/* Open: the wrappers generate no box, so the open footer is today's layout exactly. */
#scale-foot, #scale-footclip, #scale-footslide{display:contents}
#scale-lip[hidden]{display:none}
:root{--lip-ease:cubic-bezier(.3,0,.2,1)}

/* Lipped layout: applied once, at the START of a collapse and removed at the END of a restore. */
#scale-sheet.lipped .sheetsurf{padding-bottom:env(safe-area-inset-bottom)}
#scale-sheet.lipped:not(.tiny) .sheetbody{flex-grow:1}
#scale-sheet.lipped #scale-foot{display:block; position:relative; flex:0 0 auto; height:4px;
  margin-top:calc(-1 * var(--sp-4))}
@media (max-height:520px){#scale-sheet.lipped #scale-foot{margin-top:calc(-1 * var(--sp-3))}}
#scale-sheet.short.lipped #scale-foot{margin-top:calc(-1 * var(--sp-2))}
#scale-sheet.lipped:has(#scale-guidance > :not([hidden]):not(:empty)) #scale-foot{margin-top:0}
/* L-E1: out of flow, never display:none, so #scale-msg stays a live region while lipped. */
#scale-sheet.lipped #scale-guidance:not(:has(> :not([hidden]):not(:empty))){position:absolute;
  min-height:0; height:0; margin:0; overflow:hidden}

/* The slab: the open footer's image, positioned above the lip and clipped there. */
#scale-sheet.lipped #scale-footclip{display:block; position:absolute; bottom:100%;
  left:calc(-1 * var(--ring)); right:calc(-1 * var(--ring)); padding-inline:var(--ring);
  height:var(--lip-h, 0px); overflow:hidden; overflow:clip; pointer-events:none}
#scale-sheet.lipped #scale-footslide{display:flex; flex-direction:column; row-gap:var(--lip-gd, 0px);
  box-sizing:border-box; height:100%; padding-top:calc(var(--lip-pad, 1px) - 1px);
  border-top:1px solid #332c22; background:#1f1b15; pointer-events:auto;
  transform:none; visibility:visible;
  transition:transform 180ms var(--lip-ease), visibility 0s linear 0s}
#scale-sheet.lipshut #scale-footslide{transform:translateY(var(--lip-h, 0px)); visibility:hidden;
  transition:transform 180ms var(--lip-ease), visibility 0s linear 180ms}

/* A guidance line that holds text rides the slide (FLIP), above the slab. */
#scale-sheet.lipped #scale-guidance{position:relative; z-index:1; background:#1f1b15;
  transform:translateY(var(--lip-g, 0px)); transition:transform 180ms var(--lip-ease)}
#scale-sheet.lipshut #scale-guidance{transform:none}

/* The lip control: a 25px invisible zone whose bottom 4px draws the grabber. */
#scale-lip:not([hidden]){display:block; position:absolute; left:0; right:0; bottom:0; height:25px;
  z-index:2; margin:0; padding:0; border:0; background:transparent; cursor:pointer;
  touch-action:none; -webkit-tap-highlight-color:transparent}
#scale-lip::after{content:""; position:absolute; left:50%; bottom:0; width:36px; height:4px;
  margin-left:-18px; border-radius:2px; background:#a79d8b}
#scale-lip:focus-visible{outline-offset:-2px}
#scale-sheet.lipped .sheetbody{scroll-padding-bottom:21px}

#scale-sheet.lipnow #scale-footslide, #scale-sheet.lipnow #scale-guidance{transition:none}
@media (prefers-reduced-motion: reduce){
  #scale-footslide, #scale-guidance{transition:none !important}
}
```

Notes on the CSS:
- **The foot's negative margin** cancels the surface `gap` between the body and the lip. It has three
  values, one per gap breakpoint (`--sp-4`; `--sp-3` at max-height 520; `--sp-2` in `.short`). A
  guidance line with text sets the margin to 0, so the lip sits `--sp-2` under the guidance band, the
  same spacing N-A6 pins between the slot and the primary. The e2e test "UX: lipped, an empty
  guidance slot ..." measures both cases at all five viewports, so a drifted gap value fails CI.
- **The body grows** (`flex-grow:1`), so the lip sits at the surface bottom even when the body's
  content stops overflowing while lipped. In `.tiny` the body keeps `flex:0 0 auto` and the surface
  scrolls, so the rule excludes `.tiny`.
- **Safe area.** `padding-bottom` drops to `env(safe-area-inset-bottom)`. The viewport meta already
  has `viewport-fit=cover`. The grabber and the whole tap zone sit above the inset, so the home
  indicator's swipe (standalone mode) and the lip never share pixels. In a Safari tab with its bottom
  toolbar the inset is 0 and the lip sits on the toolbar edge.
- **Focus rings** are not clipped. The clip box is widened by `--ring` with matching padding, which
  is the trick `.sheetbody` uses. The lip draws its ring inside itself (`outline-offset:-2px`).
- **pointer-events.** The clip box is a transparent overlay above the body's bottom, so it takes no
  hits. Only the slab does, and only while it is visible.
- **No rAF and no ResizeObserver** are added anywhere. The motion is CSS transitions on `transform`
  only.

**Guidance rule (integrator auto-decision; Q2).**
- While lipped, the slot is taken out of flow (`position:absolute`, zero height and margins; never
  `display:none` or `visibility:hidden`, so `#scale-msg` stays in the accessibility tree and its
  `aria-live` announcements are not lost; L-E1) when no child holds text: `#scale-field-msg`, `#scale-msg`
  and an unhidden `#scale-layout-state` are all empty. This is what makes the footer "completely
  collapsed". Today an empty slot reserves 36px plus margins.
- A slot that holds text stays on screen above the lip. This keeps N-A5 (a notice or warning is
  inside the viewport and above the primary or the lip at every keyboard) and the X2/X3 yield rules,
  which are untouched.
- Text that arrives while lipped shows the slot. That grows the footer region, so the body shrinks,
  `maxScroll` grows, and no clamp follows. Text that clears while lipped can clamp, and the
  range-change rule below makes that event inert.

**State machine.** Two booleans and two CSS classes.

| state | classes | layout | slab | lip control |
|---|---|---|---|---|
| OPEN | none | open | not boxed (`display:contents`) | hidden |
| SHUTTING | `lipped lipshut`, transition running | lipped | sliding down to `translateY(--lip-h)` | shown |
| SHUT | `lipped lipshut` | lipped | `visibility:hidden` (CSS, 180ms delay) | shown |
| OPENING | `lipped` | lipped | sliding up to `translateY(0)` | shown |

Each change of state:
- **OPEN → SHUTTING.** This is the only point where the layout goes from open to lipped. `collapseLip()`
  runs these steps in one task:
  1. Read the open geometry: the body bottom, GENERATE's top, the top of the delete row and
     GENERATE's bottom, and the guidance top and whether it shows.
  2. Add `lipnow lipped`, unhide the lip and set its `aria-label` to `"Show " + genBtn.textContent`.
  3. Read the lipped geometry: the lip top and the guidance top. This forces layout.
  4. Set four variables on `#scale-sheet`:
     - `--lip-h = lipTop − (bodyBottom − 1)`;
     - `--lip-pad = genTop − (bodyBottom − 1)`;
     - `--lip-gd = delRowTop − genBottom` (0 on Add);
     - `--lip-g = guidanceTopOpen − guidanceTopLipped`, set only when the slot shows in both.
  5. Commit the start state with `void footSlide.getBoundingClientRect()`.
  6. Remove `lipnow` and add `lipshut`.

  If focus is in `#scale-footslide`, it moves to the lip with `preventScroll`.
- **SHUTTING → SHUT.** Pure CSS: the visibility transition fires at 180ms. No JS runs.
- **SHUT → OPENING.** `restoreLip()` runs these steps:
  1. Probe the open geometry in the same task: add `lipnow`, remove `lipped lipshut`, read the same
     rects as step 1 above, then add `lipped lipshut` back. There is no paint in between, and the
     open layout has a larger `maxScroll`, so no clamp and no scroll event can result.
  2. Re-set the four variables, flush, remove `lipnow`, then remove `lipshut`. The slab becomes
     visible at once and slides up. A guidance line slides to `--lip-g`.
  3. Arm the end.
- **OPENING → OPEN.** This is the only point where the layout goes from lipped to open. `finishOpen()`
  adds `lipnow`, removes `lipped`, hides the lip, clears the variables, flushes and removes `lipnow`.
  - The open layout puts every pixel where the slab already shows it, so the body shrinks once,
    under an identical image.
  - If the lip held focus, focus goes to `genBtn` when it is enabled, else `delBtn` on Edit, else the
    last swatch. Each move uses `preventScroll`.
- **Reversals mid-slide.** These retarget a transform only and never touch the layout.
  - SHUTTING → OPENING removes `lipshut`.
  - OPENING → SHUTTING adds `lipshut` and voids the pending end.
  - CSS transitions retarget from the current value, so there is no jump.
- **The end of OPENING.**
  - The first of two things ends it: `transitionend` on `#scale-footslide` with
    `propertyName === "transform"` and `target === footSlide`, or `setTimeout(220)` (180 + 40).
  - A generation counter (`lipGen`) makes a stale timer or a stale event a no-op.
  - Under `reducedMotion.matches` (the existing `matchMedia` const), `finishOpen()` runs
    synchronously, so the collapse and the restore each take one task with no motion.
  - No requestAnimationFrame is used.
- **Instant resets.** `setLip(false, {instant:true})` goes straight to OPEN with `lipnow` and voids any
  end. It runs from `showSheet`, `hideSheet` and `showAdjust`. `hideSheet` also clears `lipped`,
  `lipshut` and `lipnow` beside its existing `kbup short side tiny` loop.

**Triggers.**

Collapse (OPEN or OPENING → SHUTTING):
- **The keyboard rises.** `applyKbOffset` reads `kbup` before its `setSheetClass("kbup", kb)` and calls
  `lipKbEdge(was, kb)` after the `short`, `side` and `tiny` writes and before `syncBand()` (L-E4:
  `collapseLip` measures the footer, so it must read geometry under the final classes). The call comes before the `revealField` at the end of
  `applyKbOffset`, so the field is revealed against the lipped geometry.
- **A user scroll down** of 24px or more on `.sheetbody` while not `kbup`, subject to the guard below.

Restore (SHUT or SHUTTING → OPENING):
- the keyboard falls (`lipKbEdge`);
- a user scroll up of 24px or more (not `kbup`);
- a user scroll that lands at the end, `t ≥ M − 1` (not `kbup`);
- a lip `click` (a tap, Enter or Space);
- a touch that starts on the lip and moves up 16px or more (the swipe recogniser);
- `focusin` on the lip (Tab).

Instant OPEN: sheet open, Edit open, `hideSheet` and `showAdjust`.

**While the keyboard is up, the scroll rule is suspended** (owner: "minimize ... until keyboard is
dismissed"; Q3).
- Scroll events only re-baseline. Only a lip tap, a lip swipe or Tab restores, and the next rise
  collapses again.
- This takes the `.tiny` surface scroller (eng review E10) out of the decision path entirely. The
  scroll rule only ever reads `.sheetbody`, and `.tiny` implies `kbup`.

**Which scrolls count as the user's** (D14).
- `userWindowUntil = Date.now() + 150` is set by:
  - `touchstart`, `touchmove` and `wheel` on the sheet (capture, passive);
  - a `keydown` of PageUp, PageDown, Space, Home, End or an arrow whose target is not a text field.
- Every scroll event inside the window extends it by 150ms, which carries iOS momentum.
- `lipQuietUntil = Date.now() + 150` marks programmatic scrolls. It is stamped by:
  - `holdPin` when it writes;
  - `revealField`;
  - `applyKbOffset`;
  - `hideAdjust`'s `sheetScroll` restore.

  A scroll inside it only re-baselines, even during a touch.
- `setLip` does NOT stamp quiet. The proof below shows the lip's own resizes never clamp, and a quiet
  window after a collapse would swallow the end-of-content restore of a fast flick.

**The scroll listener** (`lipScroll`, passive, on `bandPort` only). Each event runs these steps in
order, and the first step that matches ends it:
1. Compute `M = scrollHeight − clientHeight` and `t = clamp(scrollTop, 0, M)`. Save the previous
   `{t, M}` and store the new one.
2. If the sheet is closed, `.adjusting` is set, `kbup` is set, quiet is active, or the event is outside
   the user window: return.
3. If the lip target is lipped and `t ≥ M − 1`: restore and return.
4. If `M ≠ prev.M`: set `acc = 0` and return. (Content grew or shrank, or a clamp happened. This is
   the range-change rule.)
5. Set `d = t − prev.t`. If `d` and `acc` have opposite signs, set `acc = 0`. Then `acc += d`.
6. If `acc ≥ 24` and the target is open: read `E = surface.bottom − body.bottom` (two rects, the open
   footer region). If `M − t > E`, collapse. Set `acc = 0` either way.
7. If `acc ≤ −24` and the target is lipped: restore and set `acc = 0`.

`acc` also resets on every state change. Because step 1 clamps, a negative `scrollTop` (rubber band at
the top) and overshoot past `M` give `d = 0`.

**The swipe recogniser.**
- Because of `touch-action:none`, a touch on the lip never scrolls anything, so its listeners can be
  passive.
- `touchstart` on `#scale-lip` records `{id, y}`. `touchmove` with that identifier and
  `y0 − y ≥ 16` restores once.
- A move downward, or one shorter than 16px, does nothing, and the `click` that follows a short touch
  is the tap.
- Touches that start elsewhere never reach the recogniser, so ordinary body scrolling is unchanged.

**What a tap in the zone over content does** (accepted cost, Q8).
- While lipped, the 25px zone covers the bottom 21px of `.sheetbody`, hairline included. A tap there
  restores the footer and does not reach the content. A drag that starts there is a lip gesture: an
  up-drag restores and a down-drag does nothing.
- The content stays reachable by scrolling it 21px up, and the zone only exists while lipped.
- To keep the zone off anything the app or browser reveals, `.sheetbody` gets
  `scroll-padding-bottom:21px` while lipped. `revealField`'s `down` term subtracts the scroller's
  computed `scroll-padding-bottom`, and native focus scrolling (Tab) already honours it.
- So a field that is focused, revealed or tapped is never under the zone. This protects KB2 F6, where
  a tap on a field must focus it.

**Keyboard-up placement.**
- The lip is inside `.sheetsurf`. `applyKbOffset`'s translate and cap carry it, so it sits on the
  capped surface's bottom edge, above the keyboard.
- In `.tiny` it sits at the end of the surface's own scroll, after the guidance slot when that holds
  text, and it is reached by scrolling the surface (the KB 844x334 rewrite).
- `kbCap`'s 8px margin is unchanged.

**Focus and the Tab list.**
- The sheet's Tab list (the `keydown` handler that builds `stops` for `cycleTabStops`) uses
  `lipshut ? lipBtn : genBtn` and, on Edit, `lipshut ? null : delBtn` (L-E3: keyed on the target
  state, so during OPENING, while `lipped` is still set, Tab already lands on GENERATE, matching
  where `finishOpen` puts focus).
- This is needed because `isStop` tests `getClientRects()`, which a `visibility:hidden` button still
  passes. Left alone, the list would hand focus to an unfocusable button and strand Tab.
- `focusin` on the lip restores, then moves focus as `finishOpen` does: genBtn, else delBtn, else the
  last swatch. The move happens at the start of OPENING, because the slab is visible from that moment.

**Announcements.**
- There is no live message. The lip is a button named per D18, with `aria-expanded="false"` while
  shown and `hidden` otherwise. `aria-controls` names the two controls it shows.

**No analytics** (D13).

### No oscillation, re-derived for a 4px lip and a 180ms slide

Notation:
- `S` is `.sheetbody`, the only scroller the rule reads (`.tiny` implies `kbup`, which suspends the
  rule).
- `C` is its content height, `H` its client height, `M = max(0, C − H)` and `t ∈ [0, M]`.
- `E` is the open footer region, `surface.bottom − S.bottom` in the open layout.
- `L` is the lipped region: `4px + inset`, plus the slot band and `--sp-2` when the slot holds text.
- Δ is the growth of `H` when the layout goes to lipped. Because the body has `flex-grow:1` when
  lipped and `flex-shrink` when open, Δ = E − L whenever the body
  scrolls at all (M > 0 in the open layout), and less only when the open body already fits its content.
  So 0 ≤ Δ ≤ E − L < E (L-E6).

Five facts:
1. **Layout changes only at two instants:** the start of a collapse (H grows by Δ) and the end of a
   restore (H shrinks by Δ). During a slide only `transform` and `visibility` change. Transforms add
   no layout, and the clip box (`overflow:clip`) keeps the slab out of every scroller's scrollable
   overflow, so neither `scrollHeight` nor `clientHeight` moves during a slide. At the two instants `syncBand()`
   (the existing ResizeObserver) may toggle `.nostick` and rewrite `--plate-band-h`; both act inside
   `.sheetbody`'s content, after the clamp question is settled, and E3 and E5 tolerate them (L-E5). The test "UX: a
   collapse and a restore resize .sheetbody once each and never during the 180ms slide" proves it with
   a test-side ResizeObserver.
2. **A scroll-driven collapse never clamps.** It needs `M − t > E`. The new range is
   `M' = M − Δ ≥ M − E > t`, so `scrollTop` stays valid, nothing clamps and no scroll event results.
   A keyboard-rise collapse has no guard. Its clamp (if any) lands while `kbup` is set, so step 2
   re-baselines it.
3. **A restore never clamps.** The layout change at its end shrinks `H`, so `M` grows and `t` stays
   valid. The probe at its start (open, then lipped again, with no paint) only ever has a larger or
   equal `M`.
4. **No restore is followed by a collapse without a fresh user gesture down:**
   - After an up-scroll restore, `acc = 0`. A collapse needs 24px of new downward user scroll, and
     momentum from an up-flick only adds negative `d`.
   - After an end restore, `t ≥ M' − 1` when it fires. Once the end of the restore grows `M` by Δ,
     `M − t ≤ Δ + 1`. A collapse needs `M − t > E ≥ Δ`, and momentum that carries on downward only
     lowers `M − t`, so the inequality cannot hold. (The `+1` is the end tolerance. `E − Δ = L ≥ 4`,
     so `Δ + 1 < E` and the gap is strict.)
   - A lip tap, a swipe or Tab while not `kbup` sets `acc = 0`. The next collapse again needs 24px of
     downward user scroll. That is a new intent, not oscillation.
5. **No collapse is followed by a restore without the user:**
   - A collapse produces no scroll event (fact 2), and the slide produces none (fact 1).
   - The end rule fires only on a user-window scroll event at `t ≥ M − 1`. That happens only if the
     user keeps scrolling down to the end, by finger or momentum, which the owner's design restores.
     So a single flick to the end changes `lipped` at most twice (collapse, then restore) and ends
     shown.
   - A range change from content, such as the textarea growing or a guidance line clearing, is
     re-baselined by step 4 and decides nothing.

Rubber band: clamped deltas are 0, so an overscroll bounce at either end adds nothing to `acc`.
While the keyboard is up, nothing scroll-driven decides, so the E10 case cannot change `lipped` at all.

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

**Owner answers (2026-10-19, round 3).** Lip reopen (new, owner): a combination of an invisible tap zone smaller than 44px ("consider 25px"), scroll up, and swipe up on the lip edge. The tap zone departs from the 44px target rule by owner decision; keyboard users get the lip button itself. D4 (a) accept. D7 (a) swatches stay in the sheet. D8 30cqw, clamp 88-160px. D9 (a) "Back to the scale". D13 (a) no event. D14 24px and 150ms. D18 (a) "Show GENERATE CARDS" / "Show SAVE CHANGES" on the lip control. Every open decision is now answered; the lane L subplan carries D6 and the reopen rule.

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

- **Branch:** `claude/dual-input-ux-l`. The base is lane P's verified head SHA (stacked).
- **Owns:**
  - **Markup:** `#scale-foot`, `#scale-footclip`, `#scale-footslide` and `#scale-lip`, wrapping the
    existing `#scale-generate` and `#scale-delete-row` (their own markup is unchanged).
  - **CSS:** the lip block in 3.4, the `.lipped` / `.lipshut` / `.lipnow` rules, and the one guidance
    display rule plus the guidance FLIP rule, both scoped to `#scale-sheet.lipped`.
  - **JS:**
    - new `collapseLip`, `restoreLip`, `finishOpen`, `setLip`, `lipKbEdge`, `lipScroll` and the
      swipe recogniser;
    - the user-window listeners;
    - one quiet stamp each in `holdPin`, `revealField`, `applyKbOffset` and `hideAdjust`;
    - the `scroll-padding-bottom` term in `revealField`'s `down`;
    - one `lipKbEdge` call in `applyKbOffset`;
    - one reset each in `showSheet`, `hideSheet` and `showAdjust`;
    - the two `lipped ?` terms in the sheet Tab list.
  - **Tools:** `tools/sandbox.js` ELEMENT_IDS (`scale-foot`, `scale-footclip`, `scale-footslide`,
    `scale-lip`).
  - **Tests and mutants:** the tests and mutants below, and the section 8 rows marked L.
- **Never touches:**
  - anything else lane P owns;
  - `#scale-guidance`'s own rules (its margins, min-height, X2/X3 yield, N-A rules);
  - keyboard detection (`kb`, `kbBase`, `kbCap`, `kbOffset`, the short/side/tiny thresholds);
  - the engine and data, README and CLAUDE.md.
- **rAF / ResizeObserver:** neither is added (the test "UX: no lip code calls requestAnimationFrame or
  constructs a ResizeObserver" counts both in `index.html` against the base). Timestamps and
  `transitionend` plus a timer replace frame waits.

**Steps.**

1. **Failing app tests** (`tests/app.test.js`, sandbox with `opts.clock`; each test stubs the body's
   and the surface's `scrollTop`/`scrollHeight`/`clientHeight`/`getBoundingClientRect`):
   - A1 "UX: the lip control is named Show GENERATE CARDS on Add and Show SAVE CHANGES on Edit, a
     seeded deck's Edit included"
   - A2 "UX: a 23px user scroll down does not collapse the footer and 24px does"
   - A3 "UX: a user scroll up of 24px, or one that lands at the end, restores the footer"
   - A4 "UX: revealField, the tap pin and the keyboard handler's scrolls never collapse the footer".
     The sandbox has no `getComputedStyle`, so `revealField` returns early there; A4 installs a
     `window.getComputedStyle` stub for its revealField case (L-E8).
   - A5 "UX: a scroll with no touch, wheel or scroll key in the last 150ms changes no lip state"
   - A6 "UX: negative scrollTop and overshoot past the end change no lip state"
   - A7 "UX: a collapse needs more remaining scroll than the open footer's height"
   - A8 "UX: a scroll event whose scroll range changed only re-baselines"
   - A9 "UX: the keyboard rising collapses the footer and its fall restores it"
   - A10 "UX: while the keyboard is up no scroll changes the lip state, and a lip tap or swipe still
     restores"
   - A11 "UX: Tab onto the lip restores the footer and focuses GENERATE CARDS, DELETE when GENERATE is
     disabled on Edit, else the last swatch"
   - A12 "UX: while lipped the sheet's Tab list holds the lip in place of GENERATE and DELETE"; it
     also asserts that during OPENING (`lipped` set, `lipshut` cleared) Tab reaches GENERATE (L-E3)
   - A13 "UX: a collapse while GENERATE CARDS holds focus moves focus to the lip, never body"
   - A14 "UX: Adjust layout never shows the lip, and opening it restores the footer at once"
   - A15 "UX: a restore ends on the 220ms timer when no transitionend arrives, and a stale timer from a
     reversed slide does nothing"
   - A16 "UX: a reversal mid-slide retargets the slide and never changes the layout classes"
   - A17 "UX: opening, Edit-opening and closing the sheet leave the footer open with no lip classes or
     variables"
   - A18 "UX: a lip click, a 16px upward touch on the lip and a focus on the lip each restore; a 15px
     touch and a downward one do not"
   - A19 "UX: no lip code calls requestAnimationFrame or constructs a ResizeObserver"

   Accept: 19 red. Verify:
   `node --test --test-name-pattern '^UX:.(the.lip.control|a.2[34]px|a.user.scroll|revealField|a.scroll.with.no|negative|a.collapse|a.scroll.event|the.keyboard.rising|while.the.keyboard|Tab.onto|while.lipped|Adjust.layout.never|a.restore.ends|a.reversal|opening,.Edit|a.lip.click|no.lip.code)' tests/app.test.js`.

2. **Failing e2e** (`tests/e2e.test.js`). These run at the five viewports (380x780, 320x568, 393x852
   with a 336px keyboard, 844x390 and 1280x800), on Add and Edit unless named. Real touch comes from
   `b.drag(..., {pointer:"touch"})` and the existing KB2 swipe helper. Lip state is counted with a
   test-side MutationObserver on `#scale-sheet`'s class attribute.
   - E1 "UX: a real touch swipe down collapses the footer to a 4px lip, a swipe up restores it, with
     no flicker under momentum"
   - E2 "UX: a sheet whose content does not scroll never collapses"
   - E3 "UX: at the collapse instant .sheetbody has grown, GENERATE, the guidance line and the
     hairline have not moved, and scrollTop is unchanged". It reads rects in a test `scroll` listener
     registered after the app's, so in the same task as `collapseLip`, before paint.
   - E4 "UX: a collapse and a restore resize .sheetbody once each and never during the 180ms slide".
     It uses a test-side ResizeObserver, so per-frame resizing shows up as several callbacks.
   - E5 "UX: during a restore's slide .sheetbody keeps its lipped height, and GENERATE lands where the
     open layout puts it"
   - E6 "UX: lipped, an empty guidance slot takes no height and the lip sits on the body's hairline; a
     slot with text stays --sp-2 above the lip"; it also asserts the empty slot's computed `display`
     is not `none` and `visibility` is `visible`, and that a `say()` while lipped puts text in
     `#scale-msg` (L-E1)
   - E7 "UX: the lip draws a 36x4 grabber at the surface's bottom above the safe-area inset, its tap
     zone is 25px tall, and a tap anywhere in the zone restores". It uses
     `Emulation.setSafeAreaInsetsOverride` with a 34px bottom inset if the CI Chrome supports it, and
     otherwise asserts with inset 0 and leaves the inset clause to the phone check (step 8).
   - E8 "UX: a real touch swipe up of 20px that starts on the lip restores the footer, and the same
     swipe on the body above it does not"
   - E9 "UX: with the keyboard up the lip and the focused field are on screen, a field the app reveals
     sits above the tap zone, and dismissing the keyboard restores GENERATE"
   - E10 "UX: at 844x390 with the keyboard up (tiny, the surface scrolls) a real touch swipe with
     momentum changes lipped zero times" (eng review E10, retitled because `kbup` suspends the rule)
   - E11 "UX: under prefers-reduced-motion the footer collapses and restores with no transition, in
     one task"
   - E12 "UX: a flick to the end changes lipped at most twice and ends with the footer shown"

   Accept: 12 red. Verify: `CHROME_BIN=… node --test --test-name-pattern '^UX:' tests/e2e.test.js`.
   CI at the head SHA is the evidence, because the full e2e suite starves the local browser.

3. **Implement** 3.4. Accept: steps 1 and 2 green. Verify: the step 1 and step 2 commands.

4. **Rewrite existing tests** (the section 8 rows marked L) and the shared e2e helpers:
   - `sgGeometry` (its `gapBottom` and `genTop`) and the KB geometry helper measure `#scale-lip`'s
     grabber row (`#scale-foot`'s rect) when `#scale-sheet.lipped` (eng review E8).
   - The e2e "SG: N-A2 and N-A9 in the live DOM: ..." order assertion becomes lane P's surface order
     with `scale-generate, scale-delete-row` replaced by `scale-foot`. It also asserts
     `#scale-footslide`'s children are exactly `scale-generate, scale-delete-row`, and that
     `#scale-lip` is the last child of `#scale-foot`.
   - "SG: N-A6 ..." gains `assert lipped === false` at each state.

   Accept: green. Verify:
   `CHROME_BIN=… node --test --test-name-pattern 'SG:.N-A|KB:|KB2:|GENERATE.CARDS|SAVE.CHANGES|with.the.box.focused|a.hairline.divides|DI:.at' tests/e2e.test.js`.

5. **New mutants** (`tests/mutants/uxl_*.patch`, with `# suite:` headers using `.` wildcards and no
   `index` lines):

| patch | breaks | killed by |
|---|---|---|
| `uxl_threshold_zero` | 24 → 0 | A2 |
| `uxl_programmatic_counts` | ignores `lipQuietUntil` | A4 |
| `uxl_no_user_window` | counts every scroll | A5 |
| `uxl_overscroll_unclamped` | raw `scrollTop` deltas | A6 |
| `uxl_no_remaining_guard` | drops `M − t > E` | A7 |
| `uxl_range_change_counts` | drops the `M ≠ prev.M` re-baseline | A8 |
| `uxl_end_not_restoring` | drops the end rule | A3 |
| `uxl_kb_rise_ignored` | drops the rise branch of `lipKbEdge` | A9 |
| `uxl_kb_fall_ignored` | drops the fall branch | A9 |
| `uxl_kb_scroll_counts` | drops the `kbup` suspension | A10, E10 |
| `uxl_tab_lip_stays` | no `focusin` restore | A11 |
| `uxl_tablist_keeps_primary` | Tab list keeps `genBtn` when lipped | A12 |
| `uxl_lip_name_static` | hard-codes "Show GENERATE CARDS" | A1 |
| `uxl_collapse_drops_focus` | skips the focus move at a collapse | A13 |
| `uxl_adjust_shows_lip` | `showAdjust` skips the instant reset | A14 |
| `uxl_no_end_timer` | `transitionend` only | A15 |
| `uxl_stale_timer_ends` | drops the `lipGen` check | A15 |
| `uxl_reversal_relayouts` | a reversal removes or adds `lipped` | A16 |
| `uxl_close_leaves_lipped` | `hideSheet` skips the lip reset | A17 |
| `uxl_swipe_ignored` | no `touchmove` recogniser | A18, E8 |
| `uxl_layout_at_slide_end` | adds `lipped` at the end of SHUTTING | E3 |
| `uxl_no_flush` | drops the forced read before removing `lipnow` | E3 |
| `uxl_height_transition` | slides by transitioning `#scale-foot`'s height | E4 |
| `uxl_restore_layout_at_start` | removes `lipped` when OPENING starts | E5 |
| `uxl_guidance_always_hides` | `.lipped #scale-guidance{display:none}` | E6 |
| `uxl_guidance_never_hides` | drops the empty-slot rule | E6 |
| `uxl_zone_44` | tap zone 44px | E7 |
| `uxl_no_scroll_padding` | drops `scroll-padding-bottom` and the `revealField` term | E9 |
| `uxl_motion_reduced` | drops the reduced-motion rule and the synchronous end | E11 |

   - `uxl_lip_in_safe_area` (lipped padding 0, not the inset) is added only if E7's inset override
     runs in CI. Otherwise it would survive, and the safe-area clause is a phone-check item.
   - Accept: each prints `killed`. Verify: the per-patch loop from lane P step 5.

6. **Re-anchor.** The kills headers follow renamed tests, and each listed patch gets
   `git apply --check` after P's re-anchors:
   - markup: `sg_slot_below_primary`, `sg_msg_left_in_the_scroll`, `sg_notice_back_in_the_scroll`,
     `di_e_slot_in_scroller`, `r3s_served_id_not_in_markup` (the footer markup is wrapped);
   - Tab list: `dr3_tab_list_omits_disclosure`, `dr3_hidden_buttons_reachable_by_tab`,
     `e_edit_tab_skips_delete` (the Tab list gains `lipped ?` terms);
   - `revealField`: `kb2_reveal_uses_scrollintoview`, `kb_scroll_runs_scrollintoview`,
     `dr1g_focus_not_revealed`;
   - `applyKbOffset`: `e_kb_show_sheet_never_measures`, `kb_baseline_innerheight`, `us_kb_cap_dropped`,
     `e_kb_cap_outlives_the_sheet`;
   - tests that change: `kb_no_tiny_class`, `kb2_tiny_flank_dead`, `e_sheet_primary_back_in_the_scroll`
     (test kept; confirm still killed), `e_sheet_body_refuses_to_shrink`,
     `e_sheet_surface_is_not_a_column`.

   **Retire:** none expected.

7. **Push and gates.** Accept and verify as lane P step 7. The reviewer brief quotes this subplan's
   3.4 and Lane L verbatim, including the proof.

- **Risks.**
  - **iOS momentum ends without a final event.** The chained 150ms window covers the events that do
    arrive, and the proof needs no final event. Phone check step 3.
  - **Scroll anchoring.** Chrome's scroll anchoring could move `scrollTop` when the body grows. It
    should not, because content above the anchor does not change, but E3 asserts `scrollTop` is
    unchanged. If it fails, the fix is `overflow-anchor:none` on `.sheetbody` while lipped, inside
    L's block.
  - **iOS and `touch-action:none` on a button in a fixed sheet.** If the swipe does not reach
    `touchmove`, the tap and scroll-up paths still restore. Phone check step 4.
  - **A collapse at a keyboard rise can clamp `scrollTop`** when the field is near the end. This is
    harmless to state, because `kbup` re-baselines it, and `revealField` runs afterwards against the
    final geometry. E9 covers it.
  - **The probe at the start of a restore** relies on no paint between synchronous class toggles,
    which every engine guarantees. E5 would catch a flash.
  - **Edit on a deck with warnings** shows a guidance line, so the collapsed footer is the line plus
    the lip, not 5px. This is by the guidance rule (Q2).
- **Non-goals:**
  - guidance slot behaviour beyond the lipped display rule;
  - keyboard models;
  - Adjust layout;
  - new copy (the lip has no visible text);
  - analytics;
  - a lip on the practice screen.

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
1. Edit D Kurd 10 and scroll the fields down slowly. Expect SAVE CHANGES and DELETE to slide down
   (about a fifth of a second) into a thin line with a small grabber at the very bottom. Nothing else
   stays under the fields.
2. Scroll up about a finger's width. Expect the footer to slide back up.
3. Flick hard to the bottom and let it bounce. Expect no flicker; at the end the footer is shown.
4. Collapse it again.
   - Tap just above the grabber (within about a fingertip). Expect the footer to return.
   - Collapse again, then make a short upward swipe that starts on the grabber. Expect the footer to
     return.
5. Tap a note field so the keyboard comes up. Expect the footer to fold to the grabber, with the field
   in view above it.
   - Scroll the fields. Expect the grabber to stay.
   - Tap the grabber. Expect SAVE CHANGES to show.
   - Dismiss the keyboard. Expect the footer shown.
6. In landscape with the keyboard up:
   - swipe the sheet; expect the grabber and the fields to be reachable (F5);
   - tap between fields; expect nothing to jump (F6);
   - make a swipe with momentum; expect the footer to stay folded.
7. Open a deck whose Edit shows a warning (any crowded pan) and scroll down. Expect the warning line to
   stay just above the grabber.
8. Turn on Settings → Accessibility → Motion → Reduce Motion and repeat step 1. Expect the footer to
   fold with no slide. Turn it off again.
9. (Optional, Home Screen web app.) The grabber sits above the home indicator, and a swipe up from the
   very bottom edge goes home rather than to the footer. Also in a Safari tab with the toolbar
   minimised (L-E7): the grabber is not under the home indicator.

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

## Lane L subplan record (2026-10-19)

The lane L subplan replaced section 3.4, "### Lane L" and the lane L phone check above. This section keeps its change list, the integrator's AFK auto-decisions and its engineering review.

### Changes against the earlier 3.4 and Lane L

**3.4**
1. The 44px lip button with a "GENERATE CARDS" label, a 28x3 handle, a `#433b2c` border, radius 10 and
   `#211d16` is gone. In its place: a 4px grabber row (36x4 `#a79d8b` pill) under the body's 1px
   hairline, which is 5px visible (D6 revised). D5 and D17 are moot.
2. Reopen: a 25px invisible tap zone, 21px above the 4px row, below 44px by owner decision. A swipe up
   of 16px or more that starts on the lip is added, alongside the scroll-up restore (round 3).
3. Motion: was "instant, no motion" (D6 (a)). Now a 180ms `transform` slide built FLIP-style, so the
   scroller resizes exactly once per transition, at the start of a collapse and at the end of a
   restore. A reduced-motion rule plus a synchronous end make it instant.
4. The markup adds three wrappers (`display:contents` while open). The old claim that "SG: N-A2 order
   assertions still hold" is corrected: the app N-A2 holds, and the e2e N-A2 children assertion is
   rewritten.
5. "`#scale-guidance` never collapses" becomes: an empty slot hides while lipped, and a slot with text
   stays above the lip (integrator auto-decision, Q2). The mutant `uxl_guidance_collapses` splits
   into `uxl_guidance_always_hides` and `uxl_guidance_never_hides`.
6. Sizes: "80px of 568px" is gone. The collapsed footprint is now 4px plus the safe-area inset, plus
   the slot band and `--sp-2` only when the slot holds text.
7. Keyboard: the scroll rule is suspended while `kbup`, so only a tap, swipe or Tab restores until the
   keyboard falls. The old plan let scrolls decide in `kbup`, which made `.tiny` the oscillation risk
   E10 named.
8. `lipHold` is removed (Q4). Outside the keyboard, a lip tap followed by a 24px scroll down collapses
   again, the same as any other open state. Inside the keyboard, the suspension already does what the
   hold did. The test "UX: a lip tap while lipHold holds ..." and the mutant `uxl_hold_ignored` are
   retired.
9. `setLip` no longer stamps `lipQuietUntil`. The lip's own resizes are proved clamp-free, and the
   stamp would have swallowed the end restore of a fast flick.
10. The end rule changes from edge-triggered (`prev < max − 1 && cur ≥ max − 1`) to level-triggered
    (`t ≥ M − 1` while lipped). Edge detection misses the end when the arriving event is the
    range-change event.
11. A new range-change rule: any event where `M` changed only re-baselines.
12. The collapse guard changes from `remaining > Δ (footer − 44)` to `M − t > E` (the whole open
    footer region). Δ ≤ E holds by construction, so no estimate of Δ is needed.
13. The Tab list must swap `genBtn` and `delBtn` for the lip explicitly, because `isStop` passes
    `visibility:hidden`.
14. New: `scroll-padding-bottom:21px` while lipped, plus the `revealField` term, so a revealed field
    is never under the tap zone (protects F6).
15. New: `flex-grow:1` on the body while lipped (not `.tiny`), so the lip stays at the bottom when
    content stops overflowing.
16. New: the safe-area handling (the inset replaces `max(--sp-4, inset)` while lipped).
17. Token fix: `#1f1b15`, not `#1a1712`.
18. Wireframes are redrawn for the 4px lip.

**Lane L**
1. Owns: three wrappers, the `revealField` scroll-padding term, the Tab-list terms and four
   ELEMENT_IDS. `lipHold` is dropped.
2. App tests go from 13 to 19:
   - **Retired:** "a lip tap while lipHold holds ...".
   - **Renamed:**
     - "the lip names ..." → A1;
     - "a collapse needs more than one footer height ... changes lipped at most twice" → A7 (the
       twice clause moves to e2e E12);
     - "Tab onto the lip ..." → A11 (adds the last-swatch fallback);
     - "the guidance slot never collapses" → e2e E6;
     - "Adjust layout never shows the lip" → A14.
   - **New:** A5, A8, A10, A12, A15, A16, A17, A18, A19.
3. E2e tests go from 5 to 12:
   - "swipe ... 44px lip ..." → E1 ("4px lip");
   - the E10 test is retitled "changes lipped zero times";
   - "the lip has no transition ..." → E11;
   - **New:** E3 to E9 and E12, covering t0 seamlessness, resize once, the restore end, guidance,
     the zone, the swipe, scroll padding, and a flick at most twice.
4. Mutants go from 13 to 29 (30 with the conditional `uxl_lip_in_safe_area`). `uxl_hold_ignored` is
   retired and `uxl_guidance_collapses` is split. A mutant is added for each new rule.
5. Re-anchor names the specific markup, Tab-list, `revealField` and `applyKbOffset` patches that the
   wrapping and the stamps touch.
6. Step 4 adds the e2e N-A2 order rewrite and the N-A6 `lipped === false` assertion.
7. Section 7's phone check is rewritten for the grabber, the swipe, reduced motion and warnings.

**Section 8 rows that change** (all others stay as written):

| exact title (file) | action | reason | replacement |
|---|---|---|---|
| with the box focused and the viewport shrunk, both the box and the primary stay on screen (e2e) | rewrite L | item 4; the lip is now a 4px row with a 25px zone | "with the box focused and the viewport shrunk, both the box and the lip stay on screen, and a tap in the lip's zone shows the primary" |
| GENERATE CARDS survives a viewport shrunk the way a soft keyboard shrinks one (e2e) | rewrite L | same | "GENERATE CARDS is one lip tap away in a viewport shrunk the way a soft keyboard shrinks one" |
| KB: at 844x334 with a 104px visible area, ... GENERATE and the guidance slot are reachable by scrolling the surface (e2e) | rewrite L | the lip; an empty slot hides while lipped | "…the lip, and the guidance slot whenever it holds text, are reachable by scrolling the surface" |
| KB2: ... touch swipe anywhere on the sheet scrolls it until GENERATE is fully visible, and back to DING (e2e, owner F5) | rewrite L (owner-validated) | the lip | "…scrolls it until the lip's grabber row is fully visible, and back to DING" |
| KB2: at 393 wide with the keyboard up, tapping each note field in turn moves no field ... (e2e, owner F6) | keep L + assert `lipped` stays true and no tapped field's centre is inside the lip zone | the zone must never eat a field tap | — |
| SG: N-A5 ... above the primary ... drawer open and closed ... (e2e) | rewrite L | lipped under a keyboard; `sgGeometry` measures `#scale-foot` when lipped (E8) | "SG: N-A5 the notice and a warning are inside the viewport, the surface and above the primary or the lip at every fold viewport and keyboard, create and Edit, Adjust layout open and closed, scrolled to the top and to the end" |
| **new row:** SG: N-A2 and N-A9 in the live DOM: both messages are children of #scale-guidance, a child of the surface after .sheetbody; the notice is neutral and a warning amber (e2e) | rewrite L (title kept) | the surface children gain `#scale-foot` in place of the two footer controls; the old plan wrongly said they were unchanged | same title; the order assertion as in Lane L step 4 |
| **new row:** SG: N-A6 the scrollport does not resize between empty, notice and one- or two-line states, ... (e2e) | keep L + assert `lipped === false` throughout | no user scroll and no keyboard there | — |
| **new row:** a hairline divides the pinned footer from the scroll, so the footer reads as fixed (e2e) | keep L | the open layout is unchanged (`display:contents`) | — |
| **new row:** DI: at 320x568 / at 380x780 with a 260px keyboard each field typed in stays fully in view with the whole small pan in view ... (e2e, P's rewrites) | keep L | the rise collapses, the body only gains room, and scroll padding keeps fields off the zone | — |
| GENERATE CARDS is reachable without scrolling ...; G2b (e2e) | keep L (assert `lipped` false at open) | unchanged | — |

### Integrator auto-decisions Q1-Q10 (AFK; Q2 flagged to the owner)

- **Q1. Lip height inside 1-5px.** Recommend **4px for the grabber row, plus the existing 1px
  hairline, which is 5px visible.** 4px is the thinnest pill that still reads as a grabber at 1x, and
  the hairline is already there. A 1-2px lip would read as a rule and invite nobody to pull.
- **Q2. The guidance slot while lipped (integrator auto-decision, flag to owner).** Recommend **hide
  it when it holds no text; keep it, above the lip, when it does.** The alternatives are worse. Always
  keeping the slot breaks "completely collapsed" by about 52px. Always hiding it breaks N-A5 and hides
  a crowded-pan or refusal warning exactly while the keyboard is up.
- **Q3. Scroll rule while the keyboard is up.** Recommend **suspended**. Only a tap, swipe or Tab
  restores, and the keyboard's fall restores. This follows the owner's "until keyboard is dismissed"
  and removes the `.tiny` oscillation case entirely.
- **Q4. `lipHold`.** Recommend **drop it**. Under Q3 it is redundant while the keyboard is up. Outside
  the keyboard the owner chose scroll-up and scroll-down as the rhythm, and a hold would make the lip
  ignore the very scroll that collapsed it the first time.
- **Q5. End-of-content restore.** Recommend **keep**. It is in the original item 4 ("expands again
  ... at the end of the content"), and the proof shows it costs at most one extra change per flick.
- **Q6. Swipe threshold.** Recommend **16px**, below D14's 24px scroll hysteresis. A swipe that starts
  on the lip is unambiguous intent, and 16px clears the 8px tap slop `dropTap` already uses.
- **Q7. The tap zone over content.** Recommend **accept**. A tap or drag in the bottom 21px of the body
  goes to the lip while lipped. The cost is bounded by `scroll-padding-bottom`, which keeps revealed
  and focused fields out of the zone.
- **Q8. Easing.** Recommend **one curve, `cubic-bezier(.3,0,.2,1)`, both ways**. A shared curve makes a
  mid-slide reversal retarget smoothly. Owner only fixed the 180ms.
- **Q9. Focus target when GENERATE is disabled on Add.** Recommend **the last swatch**, which is the
  stop before GENERATE, so focus never drops to `<body>` when the lip hides.
- **Q10. Surface token.** Recommend **`#1f1b15`**, the shipped value. The brief's `#1a1712` is not in
  `index.html`, and an opaque slab of another shade would show as a band during the slide.

### Engineering review (lane L subplan, 2026-10-19)

Checked against `wt-ux-base` (`index.html` `applyKbOffset`, `revealField`, `syncBand`, the sheet
Tab handler, `say`; `tools/sandbox.js`; `tests/helpers/cdp.js`). Integrator Q1-Q10 and the owner
decisions were taken as given.

- **L-E1 (P1).** `display:none` on the empty guidance slot hid `#scale-msg`, the sheet's only
  in-dialog `aria-live` region (`.announce` sits outside the `aria-modal` dialog). The sheet is
  always lipped while the keyboard is up, so typing-time messages could go unannounced. Fix: the
  empty slot goes out of flow (`position:absolute`, zero height and margins) instead; the flex gap
  disappears the same way, so the foot-margin arithmetic and the two `uxl_guidance_*` mutants stand.
  E6 now asserts the slot is never `display:none`/`visibility:hidden` and that `say()` lands text.
- **L-E2 (P2).** `overflow:clip` is Safari 16+. Fix: `overflow:hidden; overflow:clip` on the clip
  box. The proof's fact 1 holds with either: a transformed child inside an `overflow:hidden` box
  adds no scrollable overflow to any ancestor scroller.
- **L-E3 (P2).** The Tab list keyed on `lipped`, which stays set through OPENING, while `finishOpen`
  and `visibility` key on the target state; Tab during the 180ms restore went to a lip that was
  sliding away. Fix: key on `lipshut`. A12 gains the OPENING case; `uxl_tablist_keeps_primary`
  is still killed by A12.
- **L-E4 (P2).** "Right after `setSheetClass('kbup')`" ran `lipKbEdge` before the `short`/`side`/
  `tiny` writes, so `collapseLip` measured the footer under stale classes (the `.tiny` and `.short`
  gaps and margins differ). Fix: call it after the `tiny` write and before `syncBand()`, still
  before the closing `revealField`.
- **L-E5 (P3).** The proof omitted `syncBand()`'s side effects (`.nostick`, `--plate-band-h`) at the
  two layout instants. Fix: stated in fact 1; they change content inside the body after the clamp
  question, never `scrollTop`, so the proof stands.
- **L-E6 (P3).** Δ was stated as `E − L` only when `C ≥ H + E − L`; the useful bound is
  Δ ≤ E − L < E. Fix: restated. Fact 3's strictness (`Δ + 1 < E`) follows directly.
- **L-E7 (P3).** The safe-area inset is non-zero in a Safari tab once the toolbar minimises, not
  only in a Home Screen app. Fix: added to phone-check step 9.
- **L-E8 (P3).** The sandbox has no `getComputedStyle`, so `revealField` returns early there and
  A4's revealField case would test nothing. Fix: A4 installs a stub; the scroll-padding term itself
  stays with E9 in headless Chrome.

Feasibility checks that passed: `opts.clock` + `advance()` exist in the sandbox for the 150ms
window and the 220ms end timer (A5, A15); the sandbox fires no `transitionend`, which is what A15
needs; `b.drag(selector, pts, {pointer:"touch"})` covers the 15/16px lip swipe (A18 is app-side, E
tests can use it); the conditional safe-area mutant stays conditional. Every other mutant maps to a
test that observes the mutated behaviour.

Nothing needs the owner: every fix stays inside Q1-Q10 and the binding decisions.

Findings: 0 P0, 1 P1, 3 P2, 4 P3, all applied.

**Verdict: READY for lane L.**


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
