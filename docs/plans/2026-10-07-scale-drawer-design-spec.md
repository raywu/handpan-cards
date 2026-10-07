SIGNED OFF by the owner 2026-10-07 (plan section 19, R4), mock version 3. W1, DR1 and DR2 may not start until this is merged.

History: this text is one current-truth fold of the earlier draft and its three review layers. The superseded text is in git at 702fc12 and is not repeated here. Nothing below overrides anything else in this file.

# DS: drawer and field interaction spec

Plan: `docs/plans/2026-10-06-scale-syntax-and-layout-drawer.md`, section 10 (the DS brief), section 19 and section 20. This file is the DS step's output. It was produced with `/frontend-design:frontend-design`, constrained to the app's existing visual system. It changes no code, test or data.

Reading rules. Every behaviour below is a decision. Decision ids (`[OD n]`, `[RD n]`, `[F n]`, `[MC n]`, `[AD-MC n]`) point at the index in section 18, which says where each rule now lives. The table in section 16 and the prose agree. There is no precedence rule between them. If you find them disagreeing, that is a defect to fix in both places. Code is cited by function and element id, never by line. Every pixel figure is one of three kinds, and its line says which: a computed dimension (it follows from a stated CSS expression at a named viewport and is a hard assertion), a required outcome (an owner-signed usability requirement, such as a 44 px target), or a prediction (a hand estimate with no expression behind it; the consuming lane measures and reports, with no pass or fail). Figures marked ESTIMATE are predictions.

## 1. Design position

The pan is the control. The drawer is not a second screen, a modal or a bottom sheet. It is an inline disclosure in the sheet's scrolling body, directly under the pan it changes, and the pan stays visible and interactive while it is open. One thing is allowed to be memorable: the picked-up note (an orange ring on a light plate, with a dashed orange ring on every seat it may take). Everything else is the existing `.mode`, `.sheetlabel`, Bitter and Nunito system and adds no colour, font, shadow or radius.

Two facts shape everything:

1. The drag surface is a 300 px plate on a 380 px phone and the targets on it are often under 44 px (plan 5.8). A drag cannot be the only path.
2. Touch drag fights page scroll. The plate is large, so the plate cannot be a scroll trap.

## 2. Vocabulary and element ids

Closed name list. Lanes use these ids. The `app_surface_v1.json` fixture and `tools/sandbox.js` follow them. The lane column says who builds the element. Section 17 says what each element does between DR1 and DR2.

| Id | Element | Lane |
|---|---|---|
| `scale-box` | `<textarea rows="1">` inside `#scale-box-wrap.grow` (replaces the `<input>`) | W1 |
| `scale-box-wrap` | grid wrapper that sizes the field (section 3) | W1 |
| `scale-label-2` | the second label line. W1 adds it empty and hidden. G2b gives it the plan section 9 text and shows it | W1 (element), G2b (text) |
| `scale-parse` | the count line (unchanged id) | W1 |
| `scale-refusal` | the refusal line (unchanged id) | unchanged |
| `scale-mirror` | MIRROR TOP, button, `.mode`, `aria-pressed` (kept id) | W1 (in place), DR1 (moves it in) |
| `scale-mirror-bottom` | MIRROR BOTTOM, button, `.mode`, `aria-pressed` (new) | W1 (in place), DR1 (moves it in) |
| `scale-layout-zone` | NEW wrapper around `#scale-plate-band`, `#scale-layout-row`, `#scale-layout-state` and `#scale-drawer`, in that order. It is the parent of the notice | DR1 |
| `scale-plate-band` | full-width wrapper holding `#scale-preview`, `#scale-drawer-status` and the ghost overlay. It is the sticky element while the drawer is open | DR1 |
| `scale-preview` | the plate (unchanged id) | DR1 (moves it into the band), DR2 (interactive while the drawer is open) |
| `scale-layout-row` | the row holding the toggle and the hint (kept id). DR1 gives the id a new meaning: today it holds the ROTATE and MOVE group, which moves into `#scale-legacy-group` | DR1 |
| `scale-layout-toggle` | the ADJUST LAYOUT button | DR1 |
| the close mark | a `span` with `aria-hidden="true"` inside the toggle, text U+00D7. It has no id. Find it as `#scale-layout-toggle > span[aria-hidden]` | DR1 |
| `scale-layout-hint` | the closed-state hint | DR1 |
| `scale-layout-state` | the unsaved or changed notice (section 4). A child of `#scale-layout-zone`, directly after `#scale-layout-row` and before `#scale-drawer`. In the landscape two-column layout it sits in the controls column under the toggle row | DR1 (anchor and mirrors), DR2 (seats) |
| `scale-drawer` | the disclosure region, `role="group"` | DR1 |
| `scale-drawer-hint` | the open-state instruction. Last in the drawer | DR1 (element), DR2 (text) |
| `scale-legacy-group` | wrapper, inside `#scale-drawer`, of today's ROTATE, MOVE and RESET group with its `#scale-layout-label`. Present between DR1 and DR2 only; `hidden` on Add (section 17) | DR1 (wraps), DR2 (removes) |
| `scale-legacy-hint` | the group's own short hint (today's ROTATE and MOVE sentence). The group's `aria-describedby` names it. It is not `#scale-layout-hint`, which is the toggle row's | DR1 (renames), DR2 (removes) |
| `scale-note-prev`, `scale-note-next` | PREVIOUS NOTE, NEXT NOTE | DR2 |
| `scale-seat-prev`, `scale-seat-next` | PREVIOUS SEAT, NEXT SEAT | DR2 |
| `scale-layout-reset` | RESET SEATS (kept id) | DR2 (relabels, moves in, wires) |
| `scale-anchor-label` | the `NOTE 1` group label | DR1 |
| `scale-anchor-one`, `scale-anchor-between` | the two anchor buttons | DR1 |
| `scale-drawer-status` | the one live line for every drawer announcement, inside the band | DR1 (renders, writes rows 13, 14, 18, 18b, 19, 21), DR2 (writes the rest) |

Gone: `scale-mirror-l` and `scale-mirror-r` (W1 removes them). `scale-rot-l`, `scale-rot-r`, `scale-move-l`, `scale-move-r` and today's LAYOUT group with its `#scale-layout-label` and `#scale-legacy-hint` (DR2 removes them, in place, in the same change that adds the SEAT, NOTE and RESET SEATS controls; DR1 leaves them live inside the drawer, section 17).

Colours the new rules use (`#E27005`, `rgba(226,112,5,.22)`, `#e3b25c`, `#272219`, `#f1ece1`) are declared once as custom properties on `#scale-sheet`. Every new rule, the interactive SVG layer included, reads them from there. Values are unchanged and no existing rule is touched [F 9].

## 3. The field (W1)

**Control.** `#scale-box` becomes a `<textarea rows="1">` (same attributes as today: `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="go"`, plus `wrap="soft"`, `maxlength` unset). It sits in `#scale-box-wrap`, a one-cell grid. The field's `aria-describedby` names `#scale-label-2`.

**Sizing.** The wrapper uses the replicated-text technique and needs no measuring script. The wrapper carries `data-grow`. One routine, `syncGrow()`, sets it to `value || placeholder`. It runs on every `input` and after every programmatic assignment to the field (opening Edit, restoring a scale, resetting the sheet), because those fire no `input` event [F 7]. A `::after` with `content: attr(data-grow) " "`, `white-space: pre-wrap`, `visibility: hidden`, `overflow-wrap: anywhere`, and the field's exact font, padding, border and `box-sizing`, occupies the same grid cell as the textarea. The textarea is `resize: none; overflow: hidden` in that cell. The cell therefore grows with the longer of the typed text or, when empty, the whole placeholder. Rows: one to three. The wrapper has `max-height: calc(3 * 1.3em + 24px)` (`+ 18px` under `max-height:520px`, where padding is 9 px) and the textarea becomes `overflow-y: auto` only at that cap. Past three rows the field scrolls vertically inside itself and keeps the caret in view. It never scrolls sideways.

**Empty field.** The placeholder is the 60-character string of plan section 9, unchanged and unshortened. Because an empty field sizes itself from the placeholder, the whole string shows. At 380 px the content box is about 306 px wide (336 surface minus 2 border and 28 padding), Bitter 16 px holds about 37 characters per row, so the placeholder takes two rows (prediction, ESTIMATE). Three rows is the ceiling and still shows it.

**Enter.** Enter and Shift+Enter in the field both call `runGenerate()` and never insert a line break. Enter while `e.isComposing` is ignored (an IME confirm is not a submit). Paste: the `input` handler replaces every `\r\n`, `\r` and `\n` in the value with one space, preserving the caret.

**Label.** The two label lines of plan section 9 do not have to fit one line each. Line 1 (`SCALE: (DING) TOP NOTES | OPTIONAL INNER NOTES`, about 326 px at 9.5 px with `.13em` tracking, ESTIMATE) is the `<label for="scale-box">`. Line 2 (`[NOTE] = A BOTTOM NOTE, WRITTEN WHERE ITS PITCH FALLS`, about 376 px, ESTIMATE) is `#scale-label-2`, a `.sheetlabel` span that wraps to a second line. Neither is truncated. W1 adds `#scale-label-2` empty and hidden, because today's sheet has no second line. G2b writes both label lines and shows the second.

**Count line and refusal.** They share one region, as today. The structural exclusivity stays: `showParse()` and `showRefusal()` each blank the other, and the `:empty` rule takes the empty one out of the flow. The region's height follows its content. The count line wraps to as many lines as the text needs (about three at 380 px for the D3 example, ESTIMATE) and a refusal wraps to its own. No fixed three-line floor is added. Reason: a floor would cost every sheet two blank lines to prevent a step that only happens while the player is typing, and nothing is being dragged then. The count line has the shape of plan section 9: counts first, then the notes grouped by shell, all three counts always printed. The D3 example is the placeholder scale of plan section 9: ding E3, 9 top, 3 inner, 7 bottom notes. Its count line is `Ding E3 · 9 top · 3 inner · 7 bottom. Top B3 D4 E4 F#4 G4 A4 B4 D5 E5. Inner F#5 G5 A5. Bottom C3 D3 F#3 G3 A3 C4 C5.` The warning (`SMALL_LABELS`, `NO_THIRDS`) stays in `#scale-msg`, never in this region.

**Mirror switches.** Section 9 describes them. W1 builds them in the place where the old LEFT-FIRST and RIGHT-FIRST pair sat (the `.ctlrow` before the swatches). DR1 moves them into the drawer.

## 4. Opening and closing the drawer

**Name.** The toggle's text is `ADJUST LAYOUT`, the name `LAYOUT_HINT` uses, and it carries `aria-label="Adjust layout"`. The text is the same whether the drawer is open or closed. The open state is shown by `aria-expanded="true"` and `.mode.on`, not by a different label [OD 6]. While the drawer is open, the label is followed inside the same button by the close mark, a `span` with `aria-hidden="true"` holding U+00D7, 8 px to the right of the text. The mark is not displayed while the drawer is closed. It is not a second control: there is one button, one Tab stop, one 44 px target, and a tap anywhere on it closes the drawer [MC 1].

**Form.** An inline disclosure, `#scale-drawer`, in `#scale-layout-zone` under the toggle row. No overlay, no focus trap of its own, no scrim. The sheet's existing Tab trap and aria-modal dialog stay the only trap [OD 5]. In the DR1 build the drawer also holds today's ROTATE, MOVE and RESET group, on Edit only (section 17).

**Where the toggle is.** In `#scale-layout-row`, under the plate: the toggle (auto width, `.mode`, left aligned), then `#scale-layout-hint`. The row is present on Add and on Edit. It is never `hidden`, so the sheet height does not jump when the scale becomes valid.

**Offered before the box parses?** The toggle is shown always. It is `disabled` (opacity .5, as `#scale-generate:disabled`) while the box is empty or does not parse and the drawer is closed. It is enabled whenever the box parses, and whenever the drawer is open (so an open drawer can always be closed). Reason: an arrangement of a placeholder example nobody typed would be thrown away on the first keystroke. While the toggle is disabled, `#scale-layout-hint` reads `Type a scale to adjust its layout.` and is dimmed with the button. When the scale parses it reads the `LAYOUT_HINT` text of plan section 9 in the DR2 build. In the DR1 build it reads `Layout is a guess. Open ADJUST LAYOUT to flip the pan left and right or choose where note 1 sits.`, because `LAYOUT_HINT` says a note can be moved from the drawer and the drawer moves no note until DR2 (section 17). DR2 replaces that sentence with `LAYOUT_HINT`. `LAYOUT_HINT` is used only there. The message after GENERATE keeps its own text: `{n} cards generated` or `Updated {name}`, then the warnings. It does not append `LAYOUT_HINT`. Owner decision, 2026-10-07 [OD 10]: G2b removes that append before DR1 adds the hint beside the toggle, so between G2b and DR1 `LAYOUT_HINT` is shown nowhere. The gap is accepted.

**The notice.** `#scale-layout-state` sits directly under the toggle row, drawer open or closed. It compares the current layout with the layout the sheet last kept: the stored deck on Edit, the default on Add. The layout is the three seat arrangements, the anchor, MIRROR TOP and MIRROR BOTTOM. MIRROR BOTTOM is left out of the comparison while the pan has no bottom notes. The comparison is by value, so swapping two notes and swapping them back returns the notice to what it was before the first swap: hidden when the layout the sheet last kept is the default, and `Layout changed from the default.` on Edit of a stored deck whose layout is not. A stored deck with no `mirrorBottom` key reads as `mirror` [AD-MC 3]. [RD 4]

- The layout differs from what was last kept: `Layout not saved yet. {BUTTON} keeps it.` {BUTTON} is the text of the sheet's primary button: `GENERATE CARDS` on Add, `SAVE CHANGES` on Edit.
- On Edit, the layout equals the stored deck and that deck's layout is not the default: `Layout changed from the default.`
- Otherwise hidden.

BACK and closing the sheet still discard without asking. Showing MIRROR BOTTOM unpressed on a pan with no bottom notes is not a layout change.

**Open.** Tap or press the toggle (the box parses):
1. `#scale-drawer` is revealed, `aria-expanded="true"`, the toggle gains `.on` and the close mark.
2. The plate becomes interactive. The hit layer is built. `#scale-preview` is `role="group"` with `aria-label` `Pan layout: {a} rim, {b} inner, {c} bottom notes.` and no `tabindex`. Its `.panhit` elements are the focus targets (section 11).
3. Focus moves to the roving note: the first pickable note (the first note of a ring with two or more notes, in the order rim, inner, bottom). If no ring has two notes, the first note of the pan. If the pan has no note, focus stays on the toggle. No soft keyboard opens.
4. `#scale-layout-hint` is hidden and `#scale-drawer-hint` is shown.
5. The band becomes sticky (section 5). The sheet body scrolls the zone into view with `block: "nearest"` and `behavior: "auto"`.
6. The status line shows row 19 if no ring has two notes, and is empty otherwise. Nothing else is announced beyond the plate's own label.

**Close.** Any of: the toggle again; Escape with nothing picked; BACK; closing or saving the sheet. On close:
- The hit layer is removed, any pick is cancelled without change, the status line is cleared and the band is no longer sticky.
- Focus. If focus was inside `#scale-layout-zone`, it goes to `#scale-layout-toggle` when the box parses, and to `#scale-box` when the box is empty or does not parse (the toggle is about to disable, and a focused control that disables drops focus to the page body, outside the Tab trap). If focus was elsewhere (the field, the deck name, the degrees select), it stays where it is. This includes the legacy group's buttons in the DR1 build. When the sheet itself is closing, `hideSheet()` returns focus to the opener.

**General focus rule.** No control that the drawer lanes build or move becomes `disabled`, hidden or removed while it holds focus unless the focus it needs has first been moved to the fallback the state table (section 16) names for that control. The sheet's primary button is not one of those controls: after a refused save it stays disabled as shipped, and no lane changes that (the "refused seed" row of 16.1).

**Escape ladder.** One level per press: a picked note is put down; else the drawer closes; else the sheet closes. It is handled once, on `#scale-sheet`, wherever focus is inside the sheet, the field and the palette included. The plate and every drawer control stop propagation of Escape when they consume it [F 2]. The legacy group's buttons of the DR1 build consume nothing, so Escape from one of them closes the drawer. Nothing can be picked in the DR1 build (today's selection of a note on the plate is not a pick), so the ladder's first rung does not exist until DR2.

**Opening state.** The drawer is closed every time the sheet opens, Add or Edit (`resetSheetState`). An Edit deck whose stored layout is not the default opens with the drawer closed and the notice reading `Layout changed from the default.` (Bitter 12 px, `#c4bcab`). The ring memory of section 14 starts from the arrangements the sheet opened with.

**Focus order** (the sheet's Tab list). BACK; Edit: deck name; the scale field; the plate, as one stop, only while the drawer is open and the box parses; the toggle; while open (DR1 build, Edit only: ROTATE back, ROTATE on, MOVE back, MOVE on, RESET, in the place the four step buttons take in DR2); while open: PREVIOUS NOTE, NEXT NOTE, PREVIOUS SEAT, NEXT SEAT, MIRROR TOP, MIRROR BOTTOM, RESET SEATS, ON CENTRE, BESIDE CENTRE; Edit: degrees; palette swatches; GENERATE CARDS or SAVE CHANGES; Edit: DELETE. Disabled controls are not stops (existing `isStop`). The plate comes before the toggle because it is above it.

## 5. Layout while the drawer is open

**The band.** `#scale-plate-band` is full width with the sheet's own background and sits above the scrolling controls (`z-index`), so nothing shows beside or through the plate. While the drawer is open the band is `position: sticky; top: 0`, so the controls scroll under it and the pan and the status line are always visible while a control is used. The status line is hidden while the drawer is closed [RD 1].

The band un-sticks (`position: static`) while any form control in the sheet that is not inside `#scale-layout-zone` has focus: the scale field, the deck name on Edit, the degrees select. The rule is `.sheetbody:has(input:focus, textarea:focus, select:focus)` for those, plus the same for the swatches. The reason: with a soft keyboard up the scrollport is about 159 px and a 318 px sticky band would swallow it. Focusing the field does not close the drawer. A player may type and watch the pan.

While the drawer is open `.sheetbody` carries `scroll-padding-top` equal to the band's height, so a control focused by Tab is never left under the band [F 4].

**Plate size.** Portrait phone: unchanged, `max-width: 300px` (the plan 5.8 baseline of about 284 px for the pan). Open, the plate is `max-width: min(300px, 42dvh)`, so the controls keep a usable window. At 380 x 667 that is 280 px (computed from the expression).

**Drawer height.** The drawer under the band is about 430 px with the helpers counted, against a controls window of about 245 px at 380 x 780 and about 195 px at 380 x 667 once the pinned status is counted (predictions, ESTIMATE). So the drawer scrolls on every phone. The control order exists so that what is on screen is the toggle and both step rows [RD 7]. The lane that adds the step rows (DR2) measures that both step rows fit at 380 x 667 with the band stuck. If they do not fit, it lowers the `42dvh` factor in steps, never under a 240 px plate, and reports. That is the one DR1-owned rule DR2 may change.

**Closed fold.** At 380 x 667 the content above the toggle may put ADJUST LAYOUT at or under the fold on the closed sheet. DR1 measures it for the D3 example and reports. It does not resize the closed plate, which would be a visual change for the owner [F 10].

### 5.1 Wireframe: 380 px portrait, closed

```
+--------------------------------------+ 380
| < BACK               Add a scale     |
|--------------------------------------|
| SCALE: (DING) TOP NOTES | OPTIONAL   |
| INNER NOTES                          |
| [C] [D] (E) [F#] [G] [A] B [C] D E   |   field: 1 to 3 rows
| F# G A B [C] D E | F# G A            |   (empty: whole placeholder)
| Ding E3 . 9 top . 3 inner . 7 bottom.|   #scale-parse OR #scale-refusal
| Top B3 D4 E4 ... Inner F#5 ...       |   (one shared region)
|  +--------------------------------+  |
|  |         the pan, 300 px        |  |   plain image, no targets
|  +--------------------------------+  |
| [ ADJUST LAYOUT ]                    |
| Layout is a guess. Open ADJUST       |   #scale-layout-hint
| LAYOUT to move a note, ...           |
| Layout not saved yet. GENERATE ...   |   #scale-layout-state, only if due
| Crowded pan: the smallest labels ... |   #scale-msg (warn), only if due
| palette dots              (Edit: ...)|
|--------------------------------------|
| [          GENERATE CARDS           ]|   pinned
+--------------------------------------+
```

### 5.2 Wireframe: 380 px portrait, open (the body scrolled)

```
+--------------------------------------+
| < BACK               Add a scale     |
|--------------------------------------|
|  +--------------------------------+  |   the band is pinned: the plate
|  |   pan, notes are targets       |  |   and then the status line
|  |   picked note: orange ring     |  |
|  +--------------------------------+  |
|  Picked up A4. Tap or drop it on ... |   #scale-drawer-status
| [ ADJUST LAYOUT  x ]                 |   the controls scroll under the band
| Layout not saved yet. GENERATE ...   |
| [PREVIOUS NOTE] [  NEXT NOTE  ]      |
| [PREVIOUS SEAT] [  NEXT SEAT  ]      |
| [ MIRROR TOP  ] [ MIRROR BOTTOM ]    |
| Each flips left and right. Top ...   |
| [ RESET SEATS ]                      |
| NOTE 1                               |
| [  ON CENTRE  ] [ BESIDE CENTRE ]    |
| On centre puts note 1 at the bottom  |
| centre. Beside centre puts ...       |
| Tap a note, then tap another note in |   #scale-drawer-hint, last
| the same ring to swap them. ...      |
|--------------------------------------|
| [          GENERATE CARDS           ]|
+--------------------------------------+
```

The wireframe is the DR2 build. In the DR1 build the two step rows and RESET SEATS are today's ROTATE, MOVE and RESET group (Edit only, absent on Add), in the same place.

### 5.3 Wireframe: desktop (sheet 520 to 680 px wide, plate 340 px)

```
+--------------------------------------------------+
| < BACK                         Add a scale       |
|--------------------------------------------------|
| SCALE: (DING) TOP NOTES | OPTIONAL INNER NOTES   |
| [C] [D] (E) [F#] [G] [A] B [C] D E F# G A B ...  |  1 to 2 rows
| Ding E3 . 9 top . 3 inner . 7 bottom. Top B3 ... |
|            +------------------------+            |
|            |     pan, 340 px        |            |
|            +------------------------+            |
|            status line                           |
| [ ADJUST LAYOUT  x ]                             |
| [PREV NOTE][NEXT NOTE][PREV SEAT][NEXT SEAT]     |
| [MIRROR TOP][MIRROR BOTTOM] [ RESET SEATS ]      |
| NOTE 1   [ ON CENTRE ][ BESIDE CENTRE ]          |
+--------------------------------------------------+
```
The band is not sticky in practice at this size (the body rarely scrolls at 700 px or more of height) but the rule is the same. Controls sit in `.ctlrow` rows with the existing `--sp-*` ramp (the ramp steps up at 640 x 700).

### 5.4 Wireframe: landscape phone

The two-column layout applies only under `(max-height: 520px) and (min-width: 560px)`, for example 844 x 390. Under 560 px wide the zone is one column.

Closed: as today, the plate is 120 px, the toggle row under it.

Open: `#scale-layout-zone` becomes a two-column grid. The band is the left column, and the plate is square at `width: clamp(150px, calc(100dvh - 170px), 232px)`, which is 220 px at 390 px tall (computed). The status line sits under the plate inside the band. Controls are the right column and scroll. `#scale-layout-state` is in that column, directly under the toggle row.

```
+----------------------------------------------------------------+
| < BACK                                  Edit a scale           |
|----------------------------------------------------------------|
| +----------------+ [ ADJUST LAYOUT  x ]                        |
| |                | [PREV NOTE][NEXT NOTE]                      |
| |    pan 220     | [PREV SEAT][NEXT SEAT]                      |
| |    (sticky)    | [MIRROR TOP][MIRROR BOTTOM] [RESET SEATS]   |
| +----------------+ NOTE 1  [ON CENTRE][BESIDE CENTRE]          |
| status line                                                    |
|----------------------------------------------------------------|
| [                     GENERATE CARDS                         ] |
+----------------------------------------------------------------+
```
Landscape spacing uses the existing `max-height:520px` ramp (`--sp-1:3px ... --sp-4:14px`). The `170px` in the clamp was written before the status line joined the band. With about 56 px of header and about 100 px of footer (ESTIMATE), a 390 px viewport leaves about 234 px for the body, and a 220 px plate plus a two-line status line (about 45 px) is about 265 px. So in landscape the whole band may be taller than the body. DR1 measures at 844 x 390 whether the status line is fully visible and reports. It does not change the clamp. If the status line does not fit, the owner decides at the phone check (a prediction, not an assertion). In this layout the plate is large enough to drag on. The 120 px preview is the closed state only.

## 6. The seat model

**Primitive: SWAP.** Dropping note A on note B's seat exchanges the two. This keeps plan A18. It is the same on every path: pointer, tap-then-tap, keyboard, step buttons. Insert-and-shift was considered and rejected because a drag, a tap pair and a keyboard "carry" would otherwise give different results for the same intent, and a swap is trivially cancelled. In data terms (plan section 8): the dragged note's ring index and the occupant's ring index exchange their entries in that ring's permutation.

**Ring.** A note moves only within its own ring (rim, inner, bottom). The ding has no seat and is not a target and not a source. A ring of one note cannot be picked.

**Seat order.** A ring's seats are numbered in the ring's own permutation order (rim seat 1 is where default note 1 sits; with the anchor and mirror applied that is wherever the solver put it). Wherever this spec orders the notes of one ring (the arrow keys and Home and End with nothing picked, NEXT NOTE and PREVIOUS NOTE, "the first note of a ring"), the order is seat number, so it follows the swaps already made. Keyboard seat-by-seat movement walks seat numbers 1 to k and wraps from k to 1 and back, because a ring is a circle. Seat numbers follow the zig-zag, not geometry, and every announcement adds a plain place word so that a listener is not asked to picture the zig-zag.

**Place words.** From the seat's actual angle (0 right, 90 up, 270 bottom), 45 degree sectors: right (337.5 to 22.5), upper right, top (67.5 to 112.5), upper left, left (157.5 to 202.5), lower left, bottom (247.5 to 292.5), lower right. The word reflects the drawn position, so it is correct under either mirror switch and under either anchor.

**Selection, focus and tab-entry are three different things.**
- Selection is the picked note, shown by `aria-pressed="true"` on its `.panhit`. Exactly one note can be picked.
- Focus is the note the arrow keys last moved to. It holds the one `tabindex="0"` while focus is inside the plate [RD 8]. With A picked and the arrows moved to B, B has focus and `tabindex="0"`, and A stays pressed.
- The tab-entry target applies when focus is outside the plate. It is the picked note if there is one, else the note that last had focus (if that note is gone, the first pickable note, or the first note of the pan when no ring has two notes, as at open). When focus leaves the plate, `tabindex="0"` moves to the tab-entry target.

**Picked.** Picked means: the orange selection ring (`.pansel`), same-ring seats get dashed rings, other rings are veiled, and the step buttons act on it. Picking never moves focus away from the plate.

**A pick ends** only on: a committed tap, drop or key swap; putting the note down on its own seat (a tap on the picked note, Space or Enter on its own seat); Escape; closing the drawer or the sheet; the scale ceasing to parse; a reset of its ring (a count change or RESET SEATS). A swap made by a SEAT step button is committed at once and does not end the pick. Escape does not undo it. Tab and Shift+Tab move focus and nothing else [RD 2].

**Gestures, in one table.**

| Gesture | Nothing picked | A note picked |
|---|---|---|
| Tap a note | picks it | same note: puts it down. Same-ring other note: swap, pick ends. Other-ring note: refused (section 8). |
| Hold a note (touch) then release without moving | picks it | the held note becomes the picked note; nothing swaps |
| Hold a note (touch), drag, release | lifts it, drop swaps or is refused | same, from the picked note or a new one |
| Press and drag (mouse, pen) | drags it after 4 px of movement | same |
| Space or Enter on a focused note | picks it | on another seat of the picked ring: swap, pick ends. On the picked note: puts it down |
| Arrow keys on a note | move focus to the next note | move focus to the next seat of the picked ring |
| PREVIOUS NOTE, NEXT NOTE | pick a note (section 9) | move the pick to another note |
| NEXT SEAT, PREVIOUS SEAT | disabled | swap with the occupant of the adjacent seat; the note stays picked |
| Escape | closes the drawer | ends the pick |

A ring of one note cannot be picked by any gesture above. With nothing picked the attempt writes row 2. A tap on its note while another note is picked is the refused tap of section 8 and writes row 10.

## 7. Pointer drag on touch, without scrolling the page

**Constraint.** The plate must never be a scroll trap. A swipe that starts on the plate scrolls the sheet body like any other swipe. `touch-action: none` on the plate is therefore not used [OD 2].

**Mechanism.**
1. `pointerdown` on a `.panhit` starts a lift timer. For `pointerType: "touch"` the lift happens after 250 ms of the finger staying within 8 px. For `mouse` and `pen` there is no timer: the drag begins after 4 px of movement.
2. If the finger moves more than 8 px before 250 ms, the gesture is a scroll: nothing is done, no `preventDefault`, the browser scrolls (and fires `pointercancel`, which ends the gesture cleanly).
3. The non-passive `touchmove` listener is registered on the plate when the drawer opens and removed when it closes. It calls `preventDefault()` only while a note is lifted. It is not added at lift, because a listener attached after `touchstart` is not reliably honoured for the gesture in flight [F 5].
4. At lift: the note is picked, a ghost appears with its centre 36 px above the finger so the finger does not hide it, and `#scale-preview` takes `setPointerCapture`. The ghost is `position: fixed`, an element of an overlay inside `#scale-plate-band`, outside the SVG, with `pointer-events: none`, so it is not clipped at the plate's top edge [RD 6].
5. After the lift, a touch gesture becomes a drag only after 8 px of travel from the lift point. Below that threshold it is a hold, and releasing it leaves the held note picked and `seats` unchanged. A mouse or pen gesture becomes a drag after 4 px.
6. The plate carries `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none`, and a `contextmenu` handler that calls `preventDefault` while the drawer is open, so the long press does not raise the iOS callout, the magnifier or the Android context menu.
7. `pointercancel` cancels the gesture, restores the pre-gesture pick state and moves nothing. A second touch during a hold or a drag cancels the gesture the same way.
8. A drop never also fires a tap: the delegated `click` handler ignores the click that follows a drag.
9. A press-hold released without having moved is a tap on that note when it was shorter than 250 ms, and a hold (picked, nothing swapped) when it was longer. With A picked, a hold on B released without moving leaves B picked and `seats` unchanged. It never swaps [F 5].
10. Only a real drag released back on its own seat ends with no change to `seats` and the note still picked. It writes row 8. It is not a put-down.

**Hit point.** The hit point of a drag is the centre of the ghost: 36 px above a touch point, and the pointer itself for mouse and pen, where the ghost is centred on it. The valid seat under that point is ARMED (`.panarm`) while the drag is over it. Nothing is armed over another ring, the ding or empty plate [RD 6].

**Hit-testing at release.** The target is the nearest valid target whose ring-mode radius (section 10) contains the hit point. Else the release is a refused drop (section 8).

**Mouse.** `cursor: grab` on `.panhit` while the drawer is open, `grabbing` during a drag.

**Proof.** The touch lines in the acceptance list are synthetic checks. The proof is on real devices: the DR2 owner phone check must show, on iOS Safari and on Android Chrome, that a hold-drag swaps and that a swipe starting on the plate scrolls the sheet.

## 8. Drops that are refused, and how they are shown

A drop is refused when it lands on: a note of another ring; the ding; empty plate; or outside the plate. Nothing changes in the arrangement. A refusal is shown three ways at once, none of which depends on colour alone:

1. The ghost returns to the picked note's seat (120 ms) and disappears. Under reduced motion it disappears at once.
2. `#scale-drawer-status` takes the amber `.warn` colour (`#e3b25c`) and one of the exact sentences of rows 10 and 11.
3. While a note is picked, notes of the other rings are already veiled (section 12), so the refusal is predicted before it happens.

A refused drop leaves the pick state as it was before the gesture began (a drag that started from idle returns to idle; a drag that started with a picked note keeps it picked). A refused tap on another ring's note shows the same status, keeps the pick, and moves nothing.

Refusals are warnings, not errors: amber, never the orange `#E27005` of `.err`.

## 9. The controls in the drawer

All are `.mode` buttons at 44 px (existing rule), in `.ctlrow` and `.mirror` flex rows with `gap: var(--sp-2)`. No new component. The drawer's order, in the DOM and on screen, under the band [RD 7]:

1. the toggle row, then `#scale-layout-state`;
2. PREVIOUS NOTE, NEXT NOTE;
3. PREVIOUS SEAT, NEXT SEAT;
4. MIRROR TOP, MIRROR BOTTOM, with the helper below;
5. RESET SEATS, on its own row [AD-MC 2];
6. the `NOTE 1` label, the anchor pair and its helper;
7. `#scale-drawer-hint`, last.

In the DR1 build items 2 and 3 are today's ROTATE, MOVE and RESET group (Edit only), and DR2 replaces it in place with items 2, 3 and 5.

**Step controls: NOTE chooses, SEAT moves.** With them every swap is reachable through 44 px buttons alone [OD 1] [RD 5].

- `#scale-note-prev` (`PREVIOUS NOTE`) and `#scale-note-next` (`NEXT NOTE`) are equal `.mode` buttons. They move the pick, not a note. NEXT NOTE picks the next pickable note in the order rim, inner, bottom by seat number, wrapping from the last to the first. With nothing picked it picks the first pickable note, and PREVIOUS NOTE picks the last. Rings of one note and the ding are skipped. They never change the arrangement and never move focus. They write row 20.
- `#scale-seat-prev` (`PREVIOUS SEAT`) and `#scale-seat-next` (`NEXT SEAT`) are equal `.mode` buttons, the 44 px, no-pointer-accuracy path for every pan the plate cannot serve (section 10). Each swaps the picked note with the occupant of the adjacent seat in its ring (wrapping), keeps it picked, redraws, and writes row 7. They are not ROTATE and not MOVE: there is no cyclic shift and they do not exist outside the drawer.
- After PREVIOUS NOTE, NEXT NOTE, PREVIOUS SEAT or NEXT SEAT, focus stays on the button pressed. The roving `tabindex` moves to the moved or newly picked note.

**Mirror: two switches [MC 3].** Two independent `.mode` buttons with `aria-pressed`, off by default, equal widths in one `.mirror` pair.

| Id | Text | Flips | Status row |
|---|---|---|---|
| `scale-mirror` | `MIRROR TOP` | the rim and the inner notes | 14: `Top mirror on.` or `Top mirror off.` |
| `scale-mirror-bottom` | `MIRROR BOTTOM` | the bottom ring only | 21: `Bottom mirror on.` or `Bottom mirror off.` |

One helper under the pair: `Each flips left and right. Top covers the rim and the inner notes.` Toggling re-solves and redraws, keeps every arrangement, and writes its row.

- A deck saved with the old single `mirror: true` opens with both switches pressed. A reader that finds no `mirrorBottom` takes the value of `mirror` for it.
- On a pan with no bottom notes, MIRROR BOTTOM is disabled and shown unpressed, whatever is stored. It stores false. Nothing is rewritten on open. When the sheet's primary button next saves that pan, `mirrorBottom` is written as off [AD-MC 1].
- When a bottom note is added to a pan that has none, MIRROR BOTTOM becomes enabled and stays off, whatever MIRROR TOP says. It does not take MIRROR TOP's value. This matches plan AM-4 (it stored false, so both are off by default if bottom notes are added later) [OD 7]. The same holds when the last bottom note is deleted and one is typed again in the same sheet session: the count reaching 0 stored false, so the switch is enabled and off. A player who wants the bottom reflected presses it.
- A deck saved with the old single `mirror: true` and bottom notes still opens with both switches pressed (the first bullet of this list). That is a stored value, not an added note.
- While the box is empty or does not parse, both switches keep their values and are disabled (section 16).
- In W1 they sit where the old pair sat. DR1 moves them into the drawer, same ids, same handlers.

**RESET SEATS.** `#scale-layout-reset`, a quiet text button as today (no border, `#a79d8b`, 9.5 px caps, 44 px), labelled `RESET SEATS`, on its own row under the mirror pair. It returns the three seat arrangements to the generated default. It leaves the anchor and both mirror switches alone, each being one tap to undo [OD 3]. It is enabled only while some ring is not at its default. It writes row 12. It ends any pick.

**Anchor (plan 7.1, D7).** Group label `NOTE 1` (`.sheetlabel`, `id="scale-anchor-label"`), then a `.mirror` pair of two equal `.mode` buttons with `aria-pressed`, exactly one pressed:
- `ON CENTRE` (`#scale-anchor-one`, default): note 1 at bottom centre.
- `BESIDE CENTRE` (`#scale-anchor-between`): the bottom centre falls between notes 1 and 2.

Helper (`.sheethint`): `On centre puts note 1 at the bottom centre. Beside centre puts the bottom centre between notes 1 and 2.` Labels are anchor words, not left or right, because under a mirror the note moves side. Each button is about 158 px wide at 380 and its label is at most 13 characters (ESTIMATE: fits).

Changing the anchor re-solves and redraws the plate at once, keeps every arrangement (plan section 8: the anchor changes where seats are, not who sits in them), and writes row 13.

The default for a typed scale is ON CENTRE, always. A deck of Pygmy's scale kept with the anchor `between` opens with BESIDE CENTRE pressed and every field at the angle the built-in deck data has (note 1 G3 at 290, note 2 Ab3 at 250). Typing Pygmy's string on the Add sheet opens ON CENTRE, and one tap on BESIDE CENTRE gives the original pan [MC 2].

**Status line.** `#scale-drawer-status`, in the band under the plate. It is `aria-live="polite"` and `aria-atomic="true"`, Bitter 12 px, `#c4bcab`. It is the only live region the drawer writes: what a sighted player reads is exactly what a screen reader hears, with no hidden twin. It lives inside the dialog because `#scale-sheet` is aria-modal and the page-level `.announce` is outside it. It is hidden while the drawer is closed [RD 1].
- Reserve: two lines. Every row must fit two lines at 380. DR2 measures. If a row needs three, the reserve grows to three lines. A sentence is never cut [F 1].
- One edit that changes several rings writes one message (section 14).
- A message identical to the one showing is re-announced by clearing the text and writing it on the next frame.
- The amber colour is removed by the next write that is not a refusal.
- It shows only what a write put there. It is cleared on close.

**Drawer hint.** `#scale-drawer-hint`, `.sheethint`, last in the drawer. Text: `Tap a note, then tap another note in the same ring to swap them. Or hold a note and drag it.`

## 10. The hit-target problem

Facts (plan 5.8): at a 284 px pan, the tightest target is 36 px (D3 example), 33 px (Pygmy), 39 px (Xenith) and 22 px (20 rim, 2 inner, 8 bottom). At 340 px they are 43, 40, 47 and 27. A 300 px portrait plate cannot reach 44 px on those shapes whatever the layout. The existing rule (`panHitRadii`: half the nearest-neighbour distance, 44 px floor where there is room, non-overlap wins) stays the default and stays the proof that targets never overlap.

The drawer adds three layers, in this order:

1. **Ring mode.** The moment a note is picked, only the picked note's ring matters as a target set. `sizePanHits` is run on that ring's points only, so the cap is half the distance to the nearest note in the same ring, which is the larger distance (plan 5.8: D3 rim to rim 0.510 R against rim to inner 0.372 R). The same-ring targets are drawn last in the hit layer (on top). Other-ring targets keep their all-points radii underneath, so the refusal path still works where a same-ring target does not cover. Where the two overlap, the same-ring target wins, which is the intended answer. Prediction (ESTIMATE, from the plan 5.8 table): the figure for 9 rim is 68 px and for 12 rim 52 px at 284 px. Those are measured and reported, not asserted.
2. **Name before commit.** A picked note is named in the status line and in its ghost, so a mis-pick on a small target is visible before anything changes, and a release on empty plate costs nothing.
3. **A path that needs no accuracy.** Tap a note (or use the keyboard, or NEXT NOTE) to pick, then PREVIOUS SEAT and NEXT SEAT, 44 px buttons, move it. For a 20-rim crowd with 22 px targets this is the supported path. The plate is still the display. The keyboard map (section 11) is the same path for assistive technology.

Landscape phones: the open plate is 220 px at 390 px tall (section 5.4, computed). Ring mode and the step buttons apply unchanged. The closed 120 px plate has no targets.

If DR2 measures a ring that reaches neither 44 px in ring mode nor is disjoint, it reports the measured values on the PR and does not widen the plate.

The 44 px assertion of acceptance line 58 (a required outcome) is hard only while the open plate keeps its `42dvh` cap at 380 x 667. If the cap is lowered under section 5, the lane that lowers it names on its PR every pan of line 58 whose same-ring target then measures under 44 px. For those pans line 58 becomes a report, and the shortfall goes to the owner at the DR2 phone check. The Kurd 10 figure is 68 px at 284 px. A pan with a bottom shell is tighter. Pygmy is close to 44 px at a 280 px plate, by arithmetic and not measured.

## 11. Keyboard map and announcements

**Roving focus [RD 8].** The plate is not itself focusable. `#scale-preview` (open) is `role="group"` with `aria-label` `Pan layout: {a} rim, {b} inner, {c} bottom notes.` Its `.panhit` elements are the focus targets, with a roving `tabindex`: exactly one has `tabindex="0"` and the rest `-1`, so the plate is one Tab stop. Each is `role="button"`, with `aria-pressed="true"` on the picked note and `"false"` on the others, no `aria-selected`, and the accessible name `{n}, {ring} seat {s} of {k}, {place}`. There is no separate cursor: the cursor is the focused note. After every repaint the roving `tabindex` and, when focus was on a note, real focus are restored to the `.panhit` with the same `data-field`. The exception is a committed swap by tap, drop, Space or Enter: focus goes to the note that was picked, at its new seat (section 16.3).

| Key (focus on a note) | Nothing picked | A note picked |
|---|---|---|
| Right, Down | focus the next note (rim, then inner, then bottom; no wrap) | focus the next seat of the picked ring (wraps) |
| Left, Up | previous note | previous seat of the picked ring (wraps) |
| Home, End | first, last note of the pan | first, last seat of the picked ring |
| Space, Enter | pick up the focused note | swap with the focused seat's note. On its own seat, put it down |
| Escape | close the drawer | end the pick |
| Tab, Shift+Tab | leave the plate | leave the plate. The pick is kept |

A focus move never changes the arrangement. Only a commit does, and a commit is one swap. The screen reader reads the focused note's own name, so the live line reports results only. No arrow key writes the status line.

**Announcements.** One element, `#scale-drawer-status`. `{n}` is the note with octave (`F#4`; a bottom note is its pitch, for example `C3`). `{m}` is the other note. `{ring}` is `rim`, `inner` or `bottom`. `{s}` is the seat number, `{k}` the ring size, `{t}` the target seat number, `{place}` a place word (section 6). Exact strings:

| # | When | Text |
|---|---|---|
| 1 | (retired; the focused note's own name is read instead) | |
| 2 | with nothing picked, a pick is attempted on a ring of one note (tap, hold, Space, Enter, drag start). An arrow key that focuses such a note never writes it. A tap on it while another note is picked writes row 10 | `{n} is the only note in the {ring}, so it has no other seat.` |
| 3 | pick up by keyboard | `Picked up {n}. Arrows choose a seat in the {ring}. Space swaps. Escape cancels.` |
| 4 | pick up by tap, hold or drag | `Picked up {n}. Tap or drop it on another {ring} note to swap, or use PREVIOUS SEAT and NEXT SEAT.` |
| 5 | (retired) | |
| 6 | (retired) | |
| 7 | swap done (any path) | `Swapped {n} and {m}. {n} is now in {ring} seat {t} of {k}, {place}.` |
| 8 | dropped on its own seat, a drag released on its own seat, or a tap on the picked note | `{n} stays in {ring} seat {s} of {k}.` |
| 9 | Escape, no SEAT step swap since the pick | `Cancelled. Nothing moved.` |
| 9b | Escape after one or more SEAT step swaps | `{n} put down. The swaps you made are kept.` |
| 10 | refused, other ring | `Not moved. {n} moves only within the {ring}.` |
| 11 | refused, elsewhere | `Not moved. Drop {n} on another {ring} note to swap.` |
| 12 | RESET SEATS | `Seats reset to the default.` |
| 13 | anchor | `Note 1 is on centre.` or `Note 1 is beside centre.` |
| 14 | MIRROR TOP | `Top mirror on.` or `Top mirror off.` |
| 15 | count of a ring changed to one it has not had (section 14) | `The {ring} now has {k} notes, so its seats were reset.` (`1 note` when k is 1) |
| 16 | count returned to a remembered one | `The {ring} is back to {k} notes, so its earlier seats were restored.` |
| 17 | the picked note's ring was reset | row 15 or 16 followed by ` The picked note was put down.` |
| 18 | drawer open and the scale stopped parsing | `Layout is paused until the scale parses.` |
| 18b | the scale parses again after row 18 | `Layout is ready again.` |
| 19 | drawer opened and no ring has two notes | `This pan has no ring with two notes, so there is nothing to rearrange.` |
| 20 | PREVIOUS NOTE, NEXT NOTE | `Picked up {n}, {ring} seat {s} of {k}, {place}. PREVIOUS SEAT and NEXT SEAT move it.` |
| 21 | MIRROR BOTTOM | `Bottom mirror on.` or `Bottom mirror off.` |

Row 18 is written after the refusal sentence so the refusal is spoken first. Row 3 is the keyboard form and row 4 the touch and mouse form of the same event. Each `.panhit` has the accessible name of the roving-focus paragraph above (it replaces today's "position N of M").

## 12. Marks and visual states

The visual system is unchanged: `.mode` (`#211d16` fill, `#433b2c` border, `#c4bcab` text, Nunito Sans 10.5 px / 600, 8 px radius, 44 px min height), `.mode.on` (`#f1ece1` fill, `#272219` text), the plate (`#f1ece1`, ink `#242424` / `#272219`), orange `#E27005`, amber `#e3b25c`, and the existing global focus ring `:focus-visible{outline:2px solid #e3b25c; outline-offset:2px}` (the `--ring` allowance of 4 px is already reserved in `.sheetbody`). Every drawer control uses that global ring. The `#f1ece1` ring existed only on `#scale-preview[tabindex]`, which no longer carries a `tabindex`.

**Three marks, three sizes [RD 3].**

| Mark | Class | Radius | Stroke |
|---|---|---|---|
| valid seat | `.panseat` | 1.12 r | dashed orange `#E27005`, at least 2 CSS px |
| armed seat (drag over it) | `.panarm` | 1.12 r | solid orange, at least 2 CSS px, plus the `rgba(226,112,5,.22)` fill |
| picked note | `.pansel` | 1.2 r | solid orange, at least 2 CSS px, plus a 1 px ink `#272219` hairline just outside it, plus the fill |
| keyboard focus | focus mark | 1.32 r | solid ink `#272219`, 2 CSS px, only under `:focus-visible` |

The ink hairline is what carries the pick past 3:1 on the plate (orange alone is about 2.7:1). The veil and the dash are the non-colour cues for seats. A pointer user never sees the focus mark. Neighbouring rings may touch on a crowded pan. DR2 checks the 20 rim example and reports.

**A swap is shown on the pan [RD 9].** After any committed swap both seats carry `.panflash`: the `rgba(226,112,5,.22)` fill, fading to nothing over 600 ms. Under reduced motion it shows for 600 ms and is removed with no fade. Nothing moves.

| Control or mark | Default | Focus | Active (pressed) | Disabled | Other |
|---|---|---|---|---|---|
| ADJUST LAYOUT | `.mode` | focus ring | `.mode:active` `#2e281e` | opacity .5, not a stop | open: `.on`, `aria-expanded`, close mark |
| NOTE, SEAT, MIRROR and anchor buttons | `.mode` | focus ring | as `.mode` | opacity .5, not a stop | pressed: `.on` and `aria-pressed` |
| RESET SEATS | quiet text button | focus ring | `#eae6df` text | opacity .5, not a stop | none |
| The plate | `#f1ece1`, 1 px `#433b2c` border | none (it is not focusable) | n/a | `.stale` (opacity .62) while the scale does not parse | in the band, sticky while open |
| A note, focused | no mark | focus mark, 1.32 r | n/a | n/a | n/a |
| A note, picked | n/a | n/a | n/a | n/a | `.pansel`, 1.2 r, with the fill (the `.panhit:active` fill) |
| A seat, valid target | n/a | n/a | n/a | n/a | `.panseat` (hit layer only) |
| A seat, invalid target (other ring) | n/a | n/a | n/a | n/a | veiled: a `#f1ece1` disc at .55 opacity over the note (`.panveil`, hit layer only) |
| The ghost | n/a | n/a | n/a | n/a | disc of the picked note's radius, 1.5 px orange stroke, `rgba(226,112,5,.22)` fill, the note label in ink; centred 36 px above a touch point, centred on a mouse point |
| `#scale-drawer-status` | `#c4bcab` | n/a | n/a | n/a | refusal: `#e3b25c` |

Everything new (`.panseat`, `.panarm`, `.panveil`, `.panflash`, the ghost, the focus mark) is drawn in the interactive layer only. `pan()` with `interactive` off is byte-identical to today, so no card face changes and there is no second pan renderer.

Disabled never removes a control from the layout, so the drawer does not change height as state changes. There is no loading state anywhere in the drawer: the solve is synchronous.

## 13. The legibility warning and the refusal line, with the drawer

**Legibility warning (`SMALL_LABELS`).** It stays in `#scale-msg` (amber `.warn`), below the layout zone, exactly as every other warning, live before GENERATE and after. It is never written into the drawer, the status line, `#scale-parse` or `#scale-refusal`, and the drawer's own announcements never touch `#scale-msg`. A drag, an anchor change or a mirror switch does not change legibility (sizes depend on counts, not seats), so the warning never needs to react to the drawer. With the drawer open it is below the controls and reached by scrolling. That is accepted because it does not change while the drawer is in use.

**Refusal.** `#scale-refusal` is above the plate. If the scale stops parsing while the drawer is open (typing in the field with the drawer open, or the degrees select), the state is HELD (section 16):
- the drawer stays open and the toggle stays enabled so it can be closed;
- the plate is `.stale` and its hit layer is removed. Any pick is put down;
- the NOTE, SEAT and RESET SEATS buttons, both mirror switches and both anchor buttons are disabled and keep their values;
- `#scale-drawer-status` shows row 18, written after the refusal sentence;
- every arrangement is held, not discarded (section 14), and the controls come back when the scale parses again, with row 18b;
- the refusal sentence is announced by `#scale-refusal`'s own `aria-live`, and if it is off-screen it is brought into view with `scrollIntoView({block: "nearest"})`.

A collision refusal raised by `runGenerate()` (duplicate scale) follows the same scroll rule and leaves the drawer open and every arrangement intact.

## 14. When typed notes change the count of a ring

Arrangements are keyed by the ring's note index, so editing a pitch without changing the count keeps every note in its seat.

- The sheet remembers, per ring, the arrangement it had at each count it has seen in this sheet session, starting with the arrangement the sheet opened with [OD 4]. The memory is sheet state only, is not saved, shared or hashed, and is cleared when the sheet opens.
- When a valid parse gives a ring a count it has not had in this sheet session, only that ring's arrangement resets to the default. The other rings keep theirs. Status row 15. If the picked note was in that ring it is put down (row 17).
- When a ring returns to a count it has an arrangement for, that arrangement is restored (row 16), including after passing through 0 or 1.
- A ring that empties to 0 or 1 note has nothing to arrange. Its memory is kept. A ring that appears (inner goes from 0 to 3) at a count it has not had starts at the default.
- Counts are compared per ring, so adding a bottom note leaves rim and inner untouched.
- An invalid parse changes nothing (section 13). A valid parse after it compares with the last valid parse.
- With the drawer closed the same rules apply to the arrangements the sheet holds and nothing is announced. Rows 15, 16 and 17 are written only while the drawer is open.
- One edit that changes several rings writes one message: the row 15 or 16 sentences joined by a space in the order rim, inner, bottom, then the row 17 sentence once if the pick ended [F 1]. When the same parse ends a pause, the message begins with row 18b.

## 15. Reduced motion

The only motion the drawer adds is the ghost returning to its seat (120 ms) and the swap flash fading over 600 ms. With `prefers-reduced-motion: reduce` (the app already reads this through `reducedMotion`) the ghost disappears at once, the flash shows for 600 ms with no fade, and nothing animates. The drawer itself never animates (no height transition), the scroll-into-view uses `behavior: "auto"`, and the veil, the dashed rings and the focus mark appear instantly under both settings. Pick and drop feedback is carried by rings, veils and the status text, never by motion.

## 16. Control states

This section is the one table of when each control is enabled, visible and pressed, and where focus goes if the control disables or goes away while it holds focus. The prose elsewhere states the same rules. The two agree.

**State variables.**
- Sheet: Add or Edit.
- Box: empty (nothing but spaces), valid (parses), invalid.
- Drawer: open or closed. It is closed every time the sheet opens.
- Pick: none, or a note.
- RINGS2: how many rings hold two or more notes. BOT: the number of bottom notes. DIFF: some ring's seats differ from the default.
- LIVE is box valid and drawer open. HELD is box empty or invalid and drawer open.

**Rules for the whole table.** A disabled control is dimmed to opacity .5 and is not a Tab stop. A control the table calls hidden is not rendered, so it is not a stop. A fallback in the last column receives focus before the control disables or leaves. Where the last column says "cannot", the case has no user path: focus is then in the scale field or on the control that was pressed, so the control cannot hold focus when its state changes. Such lines are synthetic, and the lane may cover them with a test that sets the state directly.

### 16.1 Per control

| Control | Sheet | Box | Drawer | Pick | Visible | Enabled | Pressed | Text | If it disables or goes away while focused, focus goes to |
|---|---|---|---|---|---|---|---|---|---|
| `#scale-layout-toggle` | both | valid | closed | none | yes | yes | no | ADJUST LAYOUT | cannot |
| `#scale-layout-toggle` | both | empty or invalid | closed | none | yes | no | no | ADJUST LAYOUT | `#scale-box`, moved there by the close that caused this state |
| `#scale-layout-toggle` | both | valid | open | any | yes | yes | yes (`aria-expanded`, `.on`) | ADJUST LAYOUT and the close mark | cannot |
| `#scale-layout-toggle` | both | empty or invalid | open (HELD) | none | yes | yes | yes | ADJUST LAYOUT and the close mark | cannot. It stays enabled so it can be closed |
| the close mark | both | any | open | any | displayed | not a control | no | U+00D7 | not a control |
| the close mark | both | any | closed | any | not displayed | not a control | no | none | not a control |
| `#scale-layout-state` | Add | any | any | any | if the layout differs from the default | not a control | no | `Layout not saved yet. GENERATE CARDS keeps it.` | not a control |
| `#scale-layout-state` | Edit | any | any | any | if the layout differs from the stored deck | not a control | no | `Layout not saved yet. SAVE CHANGES keeps it.` | not a control |
| `#scale-layout-state` | Edit | any | any | any | if the layout equals the stored deck and the stored layout is not the default | not a control | no | `Layout changed from the default.` | not a control |
| `#scale-layout-hint` | both | valid | closed | any | yes | not a control | no | the `LAYOUT_HINT` text | not a control |
| `#scale-layout-hint` | both | empty or invalid | closed | any | yes, dimmed | not a control | no | `Type a scale to adjust its layout.` | not a control |
| `#scale-layout-hint` | both | any | open | any | no | not a control | no | none | not a control |
| `#scale-drawer`, `#scale-drawer-hint` | both | any | open | any | yes | not a control | no | section 9 | not a control |
| `#scale-drawer`, `#scale-drawer-hint` | both | any | closed | any | no | not a control | no | none | not a control |
| `#scale-plate-band` | both | any | open, no form control or swatch outside the zone focused | any | yes | not a control | no | sticky | not a control |
| `#scale-plate-band` | both | any | open, a form control or palette swatch outside the zone focused | any | yes | not a control | no | static | not a control |
| `#scale-plate-band` | both | any | closed | any | yes | not a control | no | static | not a control |
| `#scale-drawer-status` | both | any | open | any | yes | not a control | no | the last row written. Row 19 on open if due. Amber after a refusal | not a control |
| `#scale-drawer-status` | both | any | closed | any | no | not a control | no | cleared | not a control |
| `#scale-preview` (the plate) | both | valid | any | any | yes, current | not a stop | no | the pan | not a stop |
| `#scale-preview` | both | empty or invalid | any | none | yes, `.stale` | not a stop | no | the last pan drawn, or the example | not a stop |
| the `.panhit` notes | both | valid | open | any | yes (the ding has none) | yes. A note of a ring of one note takes focus but cannot be picked | the picked note: yes. Others: no | `{n}, {ring} seat {s} of {k}, {place}` | the drawer closes: the toggle (the box is valid), or `#scale-box` (it is not). The scale stops parsing: `#scale-layout-toggle`. A ring count changes: the first pickable note. This last case cannot arise by a user path |
| the `.panhit` notes | both | valid | closed | none | no hit layer | not applicable | no | none | see above |
| the `.panhit` notes | both | empty or invalid | open (HELD) | none | no hit layer | not applicable | no | none | `#scale-layout-toggle` |
| PREVIOUS NOTE, NEXT NOTE | both | valid | open | any | yes | yes if RINGS2 is at least 1, else no | no | PREVIOUS NOTE, NEXT NOTE | `#scale-layout-toggle`. Cannot: RINGS2 changes only from the field |
| PREVIOUS NOTE, NEXT NOTE | both | empty or invalid | open | none | yes | no | no | same | `#scale-layout-toggle` |
| PREVIOUS NOTE, NEXT NOTE | both | any | closed | any | no | not applicable | no | none | the toggle, or `#scale-box` as for the toggle |
| PREVIOUS SEAT, NEXT SEAT | both | valid | open | a note | yes | yes | no | PREVIOUS SEAT, NEXT SEAT | cannot disable while pressed (the pick stays) |
| PREVIOUS SEAT, NEXT SEAT | both | valid | open | none | yes | no | no | same | the note that was picked, when the pick ended with Escape, a tap, a drop or a key swap while focus was on a SEAT button. If the pick ended by a reset of its ring or by the scale ceasing to parse, `#scale-layout-toggle` |
| PREVIOUS SEAT, NEXT SEAT | both | empty or invalid | open | none | yes | no | no | same | `#scale-layout-toggle` |
| PREVIOUS SEAT, NEXT SEAT | both | any | closed | none | no | not applicable | no | none | the toggle, or `#scale-box` as for the toggle |
| MIRROR TOP | both | valid | open | any | yes | yes | its value | MIRROR TOP | does not disable while open. If the drawer closes: the toggle, or `#scale-box` as for the toggle |
| MIRROR TOP | both | empty or invalid | open | none | yes | no | keeps its value | MIRROR TOP | `#scale-layout-toggle`. Cannot: the box is not being edited while this control is focused |
| MIRROR TOP | both | any | closed | any | no | not applicable | keeps its value | none | the toggle, or `#scale-box` as for the toggle |
| MIRROR BOTTOM | both | valid, BOT at least 1 | open | any | yes | yes | its value, or off when a bottom note has just been added to a pan that had none | MIRROR BOTTOM | does not disable while open. If the drawer closes: the toggle, or `#scale-box` as for the toggle |
| MIRROR BOTTOM | both | valid, BOT is 0 | open | any | yes | no | no. It stores false | MIRROR BOTTOM | MIRROR TOP. Cannot: BOT changes only from the field |
| MIRROR BOTTOM | both | empty or invalid | open | none | yes | no | keeps its value | MIRROR BOTTOM | `#scale-layout-toggle` |
| MIRROR BOTTOM | both | any | closed | any | no | not applicable | keeps its value | none | the toggle, or `#scale-box` as for the toggle |
| RESET SEATS | both | valid | open | any | yes | yes if DIFF, else no | no | RESET SEATS | `#scale-layout-toggle`. Pressing it disables it, so focus goes there first. It also ends any pick |
| RESET SEATS | both | empty or invalid | open | none | yes | no | no | RESET SEATS | `#scale-layout-toggle` |
| RESET SEATS | both | any | closed | any | no | not applicable | no | none | the toggle, or `#scale-box` as for the toggle |
| ON CENTRE, BESIDE CENTRE | both | valid | open | any | yes | yes | exactly one pressed | ON CENTRE, BESIDE CENTRE | does not disable while open. If the drawer closes: the toggle, or `#scale-box` as for the toggle |
| ON CENTRE, BESIDE CENTRE | both | empty or invalid | open | none | yes | no | the same one stays pressed | same | `#scale-layout-toggle` |
| ON CENTRE, BESIDE CENTRE | both | any | closed | any | no | not applicable | keeps its value | none | the toggle, or `#scale-box` as for the toggle |
| `#scale-legacy-group`, `#scale-legacy-hint`, `#scale-layout-label` (DR1 build only) | Edit | any | open | none | yes | not a control | no | today's text | not a control |
| `#scale-legacy-group`, `#scale-legacy-hint`, `#scale-layout-label` (DR1 build only) | Edit | any | closed | none | no | not a control | no | none | not a control |
| `#scale-legacy-group`, `#scale-legacy-hint`, `#scale-layout-label` (DR1 build only) | Add | any | any | none | no (`hidden`) | not a control | no | none | not a control |
| ROTATE back, ROTATE on, MOVE back, MOVE on, RESET (`#scale-rot-l`, `#scale-rot-r`, `#scale-move-l`, `#scale-move-r`, `#scale-layout-reset`; DR1 build only) | Edit | valid | open | none | yes | yes | no | today's labels | does not disable. If the drawer closes: the toggle, or `#scale-box` as for the toggle |
| the same five | Edit | empty or invalid | open (HELD) | none | yes | yes, as today: they are never disabled, and a press does nothing while the box does not parse | no | today's labels | does not disable. If the drawer closes: the toggle, or `#scale-box` as for the toggle |
| the same five | Add | any | any | none | no (inside the `hidden` group) | not applicable | no | none | not applicable |
| the same five | Edit | any | closed | none | no | not applicable | no | none | the toggle, or `#scale-box` as for the toggle |
| `#scale-anchor-label`, helpers | both | any | open | any | yes | not a control | no | section 9 | not a control |
| `#scale-parse` or `#scale-refusal` | both | valid | any | any | the count line | not a control | no | the count line (section 3) | not a control |
| `#scale-parse` or `#scale-refusal` | both | invalid | any | any | the refusal | not a control | no | the refusal sentence | not a control |
| `#scale-msg` | both | valid | any | any | if a warning is due | not a control | no | `SMALL_LABELS` or `NO_THIRDS`, `warn` | not a control |
| GENERATE CARDS (Add), SAVE CHANGES (Edit) | both | valid | any | any | yes | yes | no | by sheet | cannot: the box is not being edited while it is focused |
| GENERATE CARDS, SAVE CHANGES | both | empty or invalid | any | any | yes | no | no | by sheet | `#scale-box`. Cannot, as above |
| GENERATE CARDS, SAVE CHANGES | both | valid, after `runGenerate()` refused the seed (a duplicate scale on Edit, or an engine reason) | any | any | yes | no. It stays disabled until the next input that parses | no | by sheet | shipped behaviour (`tests/app.test.js` "a refused seed stays disabled"). No lane changes it, so this row specifies no focus fallback: it is outside the general focus rule of section 4. The reason is in `#scale-refusal` |
| `#scale-box` | both | any | any | any | yes | yes | no | the field | not applicable |

### 16.2 Special states

| State | What each control does |
|---|---|
| A ring of one note | Its note has a `.panhit` and takes focus by arrow keys, which write nothing. With nothing picked, a tap, hold, Space, Enter or a drag start on it writes row 2 and picks nothing. NEXT NOTE and PREVIOUS NOTE skip it. The SEAT buttons are disabled unless a pick exists in another ring. RESET SEATS ignores it. If every ring has at most one note: RINGS2 is 0, all four step buttons are disabled, row 19 is written on open, and the anchor and MIRROR TOP still work (MIRROR BOTTOM works when BOT is at least 1 and is disabled when BOT is 0, next row). With nothing picked, a tap, hold, Space, Enter or drag start on a ring of one note writes row 2. With a note of another ring picked, a tap on it writes row 10. |
| No bottom notes (BOT is 0) | MIRROR BOTTOM disabled, unpressed, stores false. The comparison for the notice leaves it out. When a bottom note appears, it is enabled and off, and does not take MIRROR TOP's value [OD 7]. When the last one goes, it is unpressed again, so a bottom note typed later in the same sheet session finds it enabled and off. |
| Stored non-default layout (Edit) | The drawer opens closed. The notice reads `Layout changed from the default.` RESET SEATS is enabled when the drawer is opened if some ring differs from the default (DR2; in the DR1 build RESET is today's button). Anchor and both mirrors show the stored values. |
| Old single `mirror: true` | With bottom notes: both switches pressed. Without: MIRROR TOP pressed, MIRROR BOTTOM disabled and unpressed. In both cases the stored layout is not the default and is unchanged. A bottom note typed later onto the pan without them leaves MIRROR BOTTOM enabled and off. On Edit the notice reads `Layout changed from the default.` and never the unsaved text. |
| Ring count changed, drawer open | Section 14: row 15 or 16, row 17 if the pick ended, one message. The memory rule decides reset or restore. |
| Ring count changed, drawer closed | The same reset and restore rules apply to the arrangements the sheet holds. Nothing is announced. The notice follows the comparison. Rows 15 to 17 are not written. |
| The scale stops parsing, drawer open (HELD) | The first rows of 16.1 marked empty or invalid. The pick is put down. The plate is `.stale` and has no hit layer. Row 18 is written. Arrangements, anchor and both mirror values are held. |
| The scale parses again | Each control is enabled or disabled by its own row. Row 18b is written. Held values are unchanged, unless the parse changes whether the pan has bottom notes (section 9): then MIRROR BOTTOM is enabled and off if the pan now has bottom notes, and disabled and unpressed if it now has none. |

### 16.3 What an event does to pick, focus and status

| Event | Pick | Focus | Status |
|---|---|---|---|
| committed swap by tap, drop, Space or Enter | ends | restored to the note that was picked, at its new seat, when focus was on a note when the swap was committed | row 7 |
| committed swap by a SEAT step | stays | stays on the button pressed. The roving `tabindex` moves to the moved note | row 7 |
| PREVIOUS NOTE, NEXT NOTE | moves | stays on the button pressed. The roving `tabindex` moves to the picked note | row 20 |
| Escape | ends | if it was on a SEAT button: the note that was picked. Otherwise unchanged | row 9, or row 9b after a SEAT step swap |
| anchor or a mirror switch changed | kept (same ring index). Place words refresh | stays on the control | row 13, 14 or 21 |
| a pitch edited, counts unchanged | kept. Names refresh | unchanged | none |
| the picked note's ring count changed (to a new count, row 15, or back to a remembered one, row 16) | ends | if on a note: the first pickable note | row 17 |
| RESET SEATS | ends | `#scale-layout-toggle` (the button has just disabled itself) | row 12 |
| the scale stops parsing | ends | if inside the plate: `#scale-layout-toggle` | row 18 |
| the drawer closes | ends | section 4 | cleared |
| a tap-entry pick by NEXT NOTE with a drag in flight | the gesture is cancelled first | unchanged | none |

## 17. Ownership: DR1 against DR2

DR1 keeps today's ROTATE, MOVE and RESET controls and today's `previewBox` keydown handler live. It does not render the SEAT, NOTE or RESET SEATS controls. DR2 adds those and removes the old ones in the same change. An Edit deck with stored seats can therefore be rearranged and reset between DR1 and DR2 as today, with one owner-decided change of place [OD 9]: the group now lives inside the drawer, so it is reachable only while the drawer is open.

**The old group between DR1 and DR2** (owner decision, 2026-10-07 [OD 9]). DR1 moves today's ROTATE, MOVE and RESET group out of `#scale-layout-row` and into `#scale-legacy-group`, inside `#scale-drawer`, which is inside `#scale-layout-zone`. It is therefore part of the zone for every rule that names the zone: focus returns to the toggle when the drawer closes with focus on one of its buttons, and Escape closes the drawer from them like from any drawer control (section 4). The group has its own short hint, `#scale-legacy-hint` (today's ROTATE and MOVE sentence under the id the toggle row now takes), and the group's `aria-describedby` names `#scale-legacy-hint`. The group is Edit only. `#scale-layout-row` is never `hidden` (it holds the toggle), so the gate is on the wrapper: the code that un-hides the Edit-only rows when the sheet opens (the loop over the name row, the degrees row, the layout row and the delete row in the sheet-mode code) un-hides `#scale-legacy-group` in place of `#scale-layout-row`, and it stays `hidden` on Add. On Add the build therefore has no ROTATE, MOVE or RESET anywhere, as today. The group sits in the drawer where the NOTE, SEAT rows and RESET SEATS will be (section 9), and DR2 replaces it in place with the new controls. The group's buttons and state are listed in 16.1. The group does not raise the notice (the row below). DR1 writes only the status rows that need no pick: 13, 14, 18, 18b, 19 and 21.

| Control or status row | Renders | Works | Between DR1 and DR2 |
|---|---|---|---|
| `#scale-layout-toggle`, close mark, `#scale-layout-row`, `#scale-layout-hint` | DR1 | DR1 | complete. The hint carries the DR1-era sentence of section 4, not `LAYOUT_HINT`; DR2 swaps in `LAYOUT_HINT` |
| `#scale-layout-zone`, `#scale-plate-band` | DR1 | DR1 | complete. The plate moves into the band. The plate keeps today's behaviour: interactive on Edit only, with today's tab stop and arrow keys |
| `#scale-drawer` | DR1 | DR1 | complete |
| `#scale-drawer-hint` | DR1 (element, empty and hidden) | DR2 (text and shown) | hidden |
| `#scale-layout-state` | DR1 | DR1 for anchor and both mirrors. DR2 adds seats | compares anchor and mirrors only. Today's ROTATE and MOVE do not raise it |
| MIRROR TOP, MIRROR BOTTOM | W1 in place, DR1 moves in | W1 | complete |
| ON CENTRE, BESIDE CENTRE, `#scale-anchor-label` | DR1 | DR1 | complete |
| `#scale-drawer-status`, rows 13, 14, 18, 18b, 19, 21 | DR1 | DR1 | complete |
| `#scale-drawer-status`, rows 2 to 4, 7 to 12, 15 to 17, 20 | DR2 | DR2 | nothing is written |
| PREVIOUS NOTE, NEXT NOTE | DR2 | DR2 | absent |
| PREVIOUS SEAT, NEXT SEAT | DR2 | DR2 | absent |
| `#scale-layout-reset` | today's button, inside `#scale-legacy-group` | DR2 relabels it RESET SEATS, moves it onto its own row and wires the enabled rule | today's behaviour and label |
| `#scale-legacy-group`, `#scale-legacy-hint`, ROTATE, MOVE, today's LAYOUT label | DR1 (moves into the drawer, renames the hint id, gates the wrapper to Edit) | today's | live inside the drawer, Edit only, visible only while the drawer is open; `hidden` on Add |
| The hit layer, the roving notes, the ghost, the marks, ring mode | DR2 | DR2 | absent. `paintPan` keeps today's re-key until DR2 changes it to "drawer open" |
| Opening the drawer moves focus | DR2 | DR2 | focus stays on the toggle. DR1 asserts nothing about it |

A DR1 acceptance line that needs a new note-moving control is tagged DR2. A DR1 line may name the old group only to say where it sits and that it is Edit only (lines 129 to 131); its own behaviour is today's and is covered by today's tests, which DR1 keeps green.

## 18. Decisions and the decision index

### 18.1 Owner decisions (2026-10-07)

The six forks the first draft raised were put to the owner on 2026-10-07. All six were decided as recommended.

1. `[OD 1]` PREVIOUS SEAT and NEXT SEAT buttons: "Include them". They are the 44 px no-accuracy path for crowded pans and touch screen-reader users (plan 5.8). Rejected: leaving them out and relying on tap-then-tap and drag alone.
2. `[OD 2]` Touch drag: "Hold 250 ms". A swipe that starts on the plate scrolls the page. Rejected: lift at once with `touch-action: none`, which makes the 300 px plate a scroll trap on a 380 px phone.
3. `[OD 3]` RESET SEATS: "Seats only". Anchor and mirrors are left alone. Rejected: reset all three.
4. `[OD 4]` Arrangements: "Remember per count", within one sheet session (section 14). Rejected: reset a ring on every count change.
5. `[OD 5]` Form: "Inline disclosure". Rejected: a docked panel over the lower half of the sheet.
6. `[OD 6]` Name: "ADJUST LAYOUT", open or closed.

Interview 8, the same day, decided four more:

7. `[OD 7]` MIRROR BOTTOM when a bottom note is added to a pan that has none: it stays off. It becomes enabled and unpressed and does not take MIRROR TOP's value (plan AM-4). The same holds when the last bottom note is deleted and one is typed again in the same sheet session. A stored `mirror: true` deck with bottom notes still opens with both on. Rejected: taking MIRROR TOP's value.
8. `[OD 8]` Opening focus is the first pickable note. Confirmed as merged.
9. `[OD 9]` Between DR1 and DR2 today's ROTATE, MOVE and RESET group lives inside the drawer, Edit only, with its own hint element. Escape closes it with the drawer. DR2 replaces it in place. Rejected: leaving it in the toggle row.
10. `[OD 10]` The layout hint gap is accepted: between G2b and DR1 `LAYOUT_HINT` is shown nowhere. The DR1 build must not claim that the drawer moves a note.

### 18.2 The index

The ids stay citeable. The table states no rule of its own. The rule lives in the section named.

| Id | What it decided | Where the rule lives |
|---|---|---|
| OD 1 | SEAT buttons included | 9, 10 |
| OD 2 | hold 250 ms on touch, no `touch-action: none` | 7 |
| OD 3 | RESET SEATS resets seats only | 9 |
| OD 4 | remember arrangements per count in a sheet session | 14 |
| OD 5 | inline disclosure | 4 |
| OD 6 | the name is ADJUST LAYOUT open or closed | 4 |
| OD 7 | MIRROR BOTTOM stays off when a bottom note is added | 9, 16.2 |
| OD 8 | opening focus is the first pickable note | 4, 6 |
| OD 9 | the old ROTATE, MOVE and RESET group lives in the drawer, Edit only, between DR1 and DR2 | 17, 16.1 |
| OD 10 | the layout hint gap between G2b and DR1 is accepted. The DR1 hint claims no note move | 4, 17 |
| RD 1 | status line pinned under the pan, in a sticky band | 2, 5, 9 |
| RD 2 | Tab never changes the arrangement. What ends a pick | 6, 11 |
| RD 3 | three marks, three sizes | 12 |
| RD 4 | the unsaved notice names the primary button | 4, 16 |
| RD 5 | NOTE step buttons | 9 |
| RD 6 | the drop lands where the ghost is. Armed seat. Ghost outside the SVG | 7 |
| RD 7 | control order, steps first | 4, 9 |
| RD 8 | roving focus on the notes | 11 |
| RD 9 | a swap is flashed on the pan | 12 |
| F 1 | the live line: atomic, one message per edit, re-announce, two-line reserve | 9, 14 |
| F 2 | Escape is routed at the sheet | 4 |
| F 3 | layout numbers: 220 px landscape, two-column rule, drawer height | 5 |
| F 4 | the band is full width, scroll padding, un-sticks for form controls | 5 |
| F 5 | touch: listener at open, second touch cancels, a hold never swaps | 7 |
| F 6 | redraws while a note is picked or focused | 16.3 |
| F 7 | `syncGrow()` | 3 |
| F 8 | empty and partial states: the disabled hint, no ring of two notes | 4, 16.2 |
| F 9 | colours as tokens | 2 |
| F 10 | closed-state fold is measured and reported | 5 |
| MC 1 | the open toggle carries a close mark | 4 |
| MC 2 | Pygmy draws as the original pan with BESIDE CENTRE | 9 |
| MC 3 | two mirror switches | 9 |
| AD-MC 1 | MIRROR BOTTOM on a pan with no bottom notes (and OD 7: off when one is added) | 9, 16.2 |
| AD-MC 2 | RESET SEATS on its own row | 9 |
| AD-MC 3 | `mirror` is the top shell, `mirrorBottom` the bottom, the reader defaults it to `mirror` | 9, 19 |
| AD-MC 4 | CLI: `--mirror` keeps both shells, `--mirror-top` and `--mirror-bottom` set one | 19 |
| 22.1 | W1 does not ship G2b's text | 3, acceptance lines 118, 9 |
| 22.2 | old mirrored deck with no bottom notes | 9, 16.2, acceptance lines 112, 117 |
| 22.3 | the notice names the sheet's own primary button | 4 |
| 22.4 | focus ring is the global one | 12 |
| 22.5 | focus after a swap | 16.3 |
| 22.6 | row 2 only on a pick attempt | 11 |
| 22.7 | line 58 holds at 380 x 667 only | 10, acceptance |
| 22.8 | reports are not tests | acceptance preamble |
| 22.9 | landscape plate is 220 px | 5 |
| 22.10 | ring memory including after 0 or 1 | 14 |
| 22.11 | old text kept as history | removed by the fold. History is in git at 702fc12 |
| 22.12 | not this document's to settle, recorded on the plan | 19 |
| 22.13 | line 58 and the plate cap | 10 |

## 19. What this spec does not do, and notes for the lanes

**Does not do.** No change to the card face, to `pan()` with `interactive` off, or to deck data. No second pan renderer. No cross-ring move (the plate, the step buttons and the keyboard can only address one ring, and the data model cannot hold one). No shortened example (the field grows). No dependency and no `<script src>`: everything is CSS (`:has`, `position: sticky`, grid) and a few pointer and key handlers in the existing script.

Considered in the review and deferred:
- A confirm step on BACK when the layout is unsaved. The owner chose the one-line notice (RD 4).
- A native note dropdown. The NOTE step buttons cover the need (RD 5).
- Sliding the two notes to their seats. It needs an in-place pan update, a renderer change (RD 9).
- Resizing the closed plate so the toggle clears the fold at 380 x 667. Measured and reported first (F 10).
- Theming the textarea's inner scrollbar, caret and selection at the three-row cap. Browser defaults stay.
- `forced-colors` styling of the rings. The dash, the veil and the ink hairline are shape cues that survive it. A dedicated pass is not planned.
- Validation with NVDA, JAWS, VoiceOver and TalkBack beyond the owner's phone check. The roving-focus pattern is the standard one. No lane owns a screen-reader lab.

**What already exists and is reused.** `.mode`, `.mode.on`, `.ctlrow`, `.mirror`, `.sheetlabel`, `.sheethint`, `.warn`, the `--sp-*` ramp and the `--ring` focus allowance; `.panhit` (already `role="button"` with `tabindex="-1"`), `.pansel`, the `.panhit:active` fill, `panHitRadii` and `sizePanHits`; `isStop` and the sheet's Tab trap; `reducedMotion`; `showParse()` and `showRefusal()`. The repo has no DESIGN.md: the visual system is the "Design system" section of CLAUDE.md, and nothing here changes it.

**Notes for the consuming lanes.**
- W1: a `<textarea>` changes how `scaleBox.value` is read nowhere, but `updateParse`, the Enter handler, the `restoreScales` prefill and the sandbox stub in `tools/sandbox.js` need to treat it as a textarea. The `input` event is the same. W1 waits for S2 (the two reflections), S3 (the record and link carry `mirrorBottom`) and this spec.
- DR1: `#scale-preview` moves into `#scale-plate-band` inside the new `#scale-layout-zone`. The plan lists `#scale-layout-row` and "the new drawer element" under DR1's ownership but not the plate's markup position. DR1 owns this one move and nothing else about the plate's markup. DR1 leaves the interactive branch of `paintPan`, `layoutOrder`, `layoutSel` and the `previewBox` keydown handler as they are.
- DR2: the interactive branch of `paintPan` is keyed to `editingId` today. DR2 re-keys the hit layer to "drawer open" (Add and Edit) and owns the pointer logic inside it. `layoutOrder` and `layoutSel` become the seats and the picked field. `sizePanHits` gains a ring-mode call (the picked ring's points only, same-ring targets last in the hit layer). `panHitRadii` itself is unchanged. The `previewBox` keydown handler, which today walks the whole pan with wrap, is replaced by the map of section 11.
- Where two lanes need the same function (`paintPan`'s re-key, `pan()`'s interactive branch, the `previewBox` keydown handler), the earlier lane makes its change and the later lane extends it. Both lane briefs name the function.

**Engine and data consequences, recorded on the plan** (plan section 20.5 holds the engine side; this spec holds the screen side):
- The plan's D13 ("one switch labelled MIRROR") is replaced by the two switches of section 9. A22 stands for the id `scale-mirror`.
- Plan section 7.4: "on all three rings" becomes two reflections. The top one maps a to 180 minus a on the rim and inner rings. The bottom one does the same on the bottom ring.
- Data [AD-MC 3]: the option `mirror` stays a boolean and means the top shell. A new boolean option `mirrorBottom` means the bottom shell. A reader that finds no `mirrorBottom` key takes the value of `mirror` for it. That one rule gives "both switches on" for every old stored record and every old share link (A20), and leaves them drawing as they do today. A writer always writes both keys.
- CLI [AD-MC 4]: `--mirror` keeps today's meaning (both shells), so existing recipes do not change. `--mirror-top` and `--mirror-bottom` set one shell.
- Lanes: S2 owns the two reflections in the solver and the option reader. The lane that owns the stored record and the share options line carries `mirrorBottom`. W1 builds two switches in place. DR1 moves both into the drawer. Each lane's mutant forecast grows by one (bottom mirror ignored).
- The README and ENGINE-SPEC rows on mirror are rewritten by the docs lane.
- Two print answers from the same interview belong to the plan, not to this spec: a crowded pan's title-card note line wraps to two lines (Lane P1), and `CROWDED PAN: SMALL LABELS` stays on the title card only (A16 stands).
- Not this document's to settle, recorded on the plan by the coordinator [22.12]: the plan's section 10 names another output file for this spec; the sticky `#scale-plate-band` against the plan's "only it and the delete row are pinned"; and lane ownership of `pan()`'s interactive branch, the `paintPan` re-key and the `previewBox` keydown replacement. The old statement that an Edit deck with stored seats cannot be rearranged or reset between DR1 and DR2 no longer holds: section 17 keeps today's controls live.

## Acceptance list

Each line is one testable statement and is turned into exactly one test by the lane named in brackets. The numbers are kept from earlier drafts on purpose, so that references to them stay true. `at 380` means a 380 px wide viewport. A line that depends on another lane carries a "Needs" note. The lane order is PF, S2, S3, W1, G2b, P1, DR1, DR2, and no line needs anything from a later lane. Each pixel figure is marked: (computed) follows from a stated CSS expression at a named viewport and is asserted with its tolerance; (required) is an owner-signed outcome and is asserted; (report) is a measurement recorded on the lane's PR and is not a test. Reports are not tests, so the "one testable statement" rule excludes them: line 58 (the inner and bottom part), line 84 (the plate-width part), line 89 and the closed-fold and landscape measurements of section 5.

### Field and mirror switches

1. [W1] `#scale-box` is a `<textarea>` and `#scale-box-wrap` holds it. The old `<input id="scale-box">` is gone.
2. [W1] At 380, text that fits one line gives a field of one row, and text that wraps to three lines gives three rows, with `scrollWidth` equal to `clientWidth` in both (required). The test types the text. It need not parse.
3. [W1] At 380, with the field empty, the whole placeholder is visible. The test injects a 60-character placeholder so that it does not depend on G2b's wording. It asserts that `data-grow` equals the placeholder and that the textarea's height is at least the height of a probe element in the same font, width, padding and `white-space: pre-wrap` holding that string, and at most three rows (required). `scrollHeight` is not used, because it cannot see a clipped placeholder.
4. [G2b] The placeholder equals the 60-character string of plan section 9, exactly, and the check of line 3 passes with that real string at 380. Needs: W1.
5. [W1] Enter in the field calls generate once and leaves the value free of line breaks. Shift+Enter does the same.
6. [W1] Enter while an IME composition is active does not generate.
7. [W1] Pasting text with line breaks leaves the value with those breaks replaced by single spaces.
8. [W1] A value longer than three rows keeps the field at three rows, scrolls inside it and keeps the caret in view after typing at the end.
9. [G2b] The first label line is the `<label for="scale-box">` with the plan section 9 text, `#scale-label-2` is shown and carries the second line, and neither is clipped (`scrollWidth` at most `clientWidth`) at 380 (required). Needs: W1, line 118.
10. [W1] `#scale-parse` and `#scale-refusal` are never both non-empty: a valid scale fills the first and blanks the second, an invalid one the reverse.
11. [G2b] The count line for the D3 example (section 3) wraps inside the field group at 380 with no sideways scroll (required). Needs: W1, line 119.
12. [W1] `#scale-mirror` is one `.mode` button with text `MIRROR TOP`, `aria-pressed="false"` by default. Toggling it changes the preview and the generated deck's `mirror` option (the top shell). `#scale-mirror-l` and `#scale-mirror-r` are absent. `#scale-mirror-bottom` is line 109. Needs: S2.
13. [W1] A deck stored with `mirror: true` opens with `#scale-mirror` pressed. Its bottom switch is line 112. Needs: S3.
14. [G2b] The `SMALL_LABELS` text appears in `#scale-msg` with the `warn` class while the box holds a crowded scale, before GENERATE is pressed. The test types a real crowded scale, which no parser accepts before G2b lifts the caps. Needs: S1, PF.

### Drawer shell, anchor, mirror switches, notice

15. [DR1] `#scale-layout-toggle` exists on the Add sheet and on the Edit sheet, reads `ADJUST LAYOUT`, has `aria-label="Adjust layout"`, `aria-expanded="false"` and an `aria-controls` that names `#scale-drawer`, and `#scale-drawer` is hidden.
16. [DR1] With the box empty or invalid and the drawer closed, the toggle is `disabled`. With a valid scale it is enabled.
17. [DR1] Activating the toggle shows `#scale-drawer`, sets `aria-expanded="true"` and adds `.on`. The line asserts nothing about focus (line 18 is DR2's).
18. [DR2] Opening moves focus to the `.panhit` with `tabindex="0"`, which is the first pickable note (if no ring has two notes, the first note of the pan; if the pan has no note, focus stays on the toggle), and does not raise the soft keyboard. Needs: DR1.
19. [DR2] Open, with a valid scale: `#scale-preview` has no `tabindex`, contains `.panhit` elements and exactly one of them has `tabindex="0"`. Closed, or with a scale that does not parse: it contains no `.panhit`. Needs: DR1.
20. [DR1] Activating the toggle again hides the drawer. With a valid scale, focus is then on `#scale-layout-toggle`, also when the drawer was closed with Escape while focus was on a drawer control.
21. [DR1] Escape with the drawer open and nothing picked closes the drawer and leaves the sheet open. A second Escape closes the sheet.
22. [DR1] Closing and reopening the sheet, on Add and on Edit, opens it with the drawer closed.
23. [DR1] The Tab order walks BACK, (Edit: the deck name,) the field, the toggle, MIRROR TOP, MIRROR BOTTOM, ON CENTRE, BESIDE CENTRE, in that order, skipping disabled controls. On Edit with the drawer open, the old ROTATE, MOVE and RESET group (section 17) sits between the toggle and MIRROR TOP; its buttons are outside this line. Line 120 is the full order.
24. [DR2] `#scale-rot-l`, `#scale-rot-r`, `#scale-move-l`, `#scale-move-r`, `#scale-layout-label`, `#scale-legacy-group` and `#scale-legacy-hint` are absent from the markup, and the `previewBox` keydown handler of today is gone. Needs: DR1.
25. [DR1] The drawer holds two anchor buttons with `aria-pressed`, exactly one true, `ON CENTRE` pressed by default and `BESIDE CENTRE` not.
26. [DR1] Pressing `BESIDE CENTRE` re-solves the plate (the rim angles change) and writes `anchor: "between"` into the generated deck options, the stored record and the share link. Needs: S2, S3.
27. [DR1] On an Edit sheet for a deck saved with anchor `between`, `BESIDE CENTRE` is pressed on open. Needs: S3.
28. [DR1] `#scale-mirror` and `#scale-mirror-bottom` are inside `#scale-drawer`, keep their ids, and toggling either redraws the plate and reaches the generated deck.
29. [DR2] `#scale-layout-reset` is inside the drawer on its own row, reads `RESET SEATS` and is disabled while every ring is at its default. Needs: DR1.
30. [DR1] `#scale-layout-state` reads `Layout not saved yet. GENERATE CARDS keeps it.` on Add and `Layout not saved yet. SAVE CHANGES keeps it.` on Edit when either mirror switch or the anchor differs from what was last kept. It reads `Layout changed from the default.` on an Edit sheet whose stored anchor or mirrors are not the default and are unchanged. It is hidden otherwise. Seats join the comparison from DR2 (line 91).
31. [DR1] While the drawer is open and the scale stops parsing, the drawer stays open, the toggle is enabled, both anchor buttons and both mirror switches are disabled and keep their values, the plate has `.stale`, and `#scale-drawer-status` reads `Layout is paused until the scale parses.` after the refusal sentence. The NOTE, SEAT and RESET SEATS buttons are line 122.
32. [DR1] After the scale parses again each control is enabled or disabled by its own rule, the anchor and mirror values from before are unchanged unless the parse changes whether the pan has bottom notes (section 9: then MIRROR BOTTOM is enabled and off, or disabled and unpressed), and the status reads `Layout is ready again.`
33. [DR1] A `SMALL_LABELS` warning appears once, inside `#scale-msg`, and nothing inside `#scale-drawer` contains its text, with the drawer open and closed. Needs: G2b.
34. [DR1] With the drawer open at 380 x 780 `#scale-plate-band` stays inside the scrollport when the body is scrolled to its end, and while `#scale-box` has focus it is `position: static`.
35. [DR1] With the drawer open at 380 x 667 the open plate is no wider than 42 percent of the viewport height, that is 280 px (computed from `min(300px, 42dvh)`).
36. [DR1] At 844 x 390 the open drawer lays the plate and the controls in two columns and the plate is at least 150 px wide (computed from the `clamp` lower bound).
37. [DR1] Every control in the drawer that DR1 renders is at least 44 px tall (required, the `.mode` min-height) and the drawer has no horizontal overflow at 380.
38. [DR1] Each drawer control that DR1 renders shows the existing global focus ring (`outline` 2 px `#e3b25c`) when focused by keyboard.
39. [DR1] The drawer and the toggle have no CSS transition or animation.
40. [DR1] The pan drawn with `interactive` off is byte-identical to the shipped output for all five built-in decks.

### Pointer, tap, keyboard, counts

41. [DR2] Dragging a rim note onto another rim note swaps the two entries in the rim permutation and changes nothing else in `seats`.
42. [DR2] The same drag works for the inner ring and for the bottom ring.
43. [DR2] Releasing on the picked note's own seat changes nothing and leaves `seats` equal to its value before the gesture.
44. [DR2] Releasing where no same-ring target contains the hit point and a note of another ring does changes nothing and writes row 10 in the `warn` colour. Where a same-ring target also contains the point, the same-ring target wins and the swap happens.
45. [DR2] Releasing on empty plate, on the ding, or outside the plate changes nothing and writes row 11.
46. [DR2] A touch press that moves more than 8 px before 250 ms does not call `preventDefault` on `touchmove` and lifts nothing. This is a synthetic check; the proof is the phone check.
47. [DR2] A touch press held 250 ms within 8 px lifts the note, shows the ghost centred 36 px above the finger and calls `preventDefault` on subsequent `touchmove`. The ghost is `position: fixed`. The `touchmove` listener was registered when the drawer opened. This is a synthetic check; the proof is the phone check.
48. [DR2] `pointercancel` during a drag restores the pre-gesture state and moves nothing.
49. [DR2] The click that follows a completed drag does not pick or swap anything.
50. [DR2] A mouse press moved less than 4 px is a tap, and 4 px or more starts a drag.
51. [DR2] Tapping a note picks it: exactly one `.pansel` ring exists, same-ring seats carry `.panseat` rings (ring size minus one of them) and notes of the other rings carry `.panveil`.
52. [DR2] Tapping a second note of the same ring swaps the two, ends the pick, and writes row 7.
53. [DR2] Tapping the picked note puts it down and writes row 8.
54. [DR2] With a note picked, tapping a note of another ring, including the only note of a ring of one note, leaves the pick and the arrangement unchanged and writes row 10.
55. [DR2] With nothing picked, a note in a ring of one note cannot be picked by a tap, a hold, Space, Enter or a drag start, and the status reads row 2. An arrow key that focuses it writes nothing.
56. [DR2] The ding has no `.panhit`.
57. [DR2] With a note picked, `sizePanHits` radii for that ring's targets are each at least the all-points radius of the same target and are pairwise disjoint.
58. [DR2] On the D3 example, Kurd 10 and Pygmy rims, at 380 x 667 with the drawer open, the open plate at its `42dvh` cap, and a note picked, every same-ring target is at least 44 px across (required, a hard assertion). Where the cap was lowered (section 10), the lane names every pan whose target then measures under 44 px, and for those pans this line is a report. The inner and bottom rings of the same three pans are measured and reported. At any other viewport, including the 220 px landscape plate of line 88, target sizes are measured and reported, not asserted.
59. [DR2] PREVIOUS SEAT and NEXT SEAT are disabled until a note is picked, and enabled after.
60. [DR2] NEXT SEAT swaps the picked note with the occupant of the next seat in its ring, wraps from the last seat to the first, keeps the note picked and writes row 7.
61. [DR2] PREVIOUS SEAT does the mirror of the previous line.
62. [DR2] With focus on a note and nothing picked, Arrow Right and Arrow Down move focus to the next note, Arrow Left and Arrow Up to the previous, Home and End to the first and last, and no arrow key writes the status line.
63. [DR2] Space on a focused note picks it up, sets its `aria-pressed` to `true` and writes row 3.
64. [DR2] With a note picked, Arrow Right moves focus to the next seat of the same ring only, wraps from the last seat to the first and never changes `seats`.
65. [DR2] Space with a note picked and focus on another seat of its ring swaps the two and writes row 7. With focus on the picked note it writes row 8.
66. [DR2] Escape with a note picked and no SEAT step swap since the pick leaves `seats` unchanged, ends the pick, writes row 9 and keeps the drawer open.
67. [DR2] Tab and Shift+Tab from a note with a note picked leave `seats` unchanged and the note still picked, and PREVIOUS SEAT and NEXT SEAT are then enabled Tab stops.
68. [DR2] Closing the drawer with a note picked leaves `seats` unchanged and clears the pick.
69. [DR2] The preview is repainted on each commit and on each step-button press, and the plate shows the new positions.
70. [DR2] The arrangement reaches the generated deck options, the stored record and the share link. Needs: S3.
71. [DR2] Toggling either mirror switch, then the anchor, leaves every ring's permutation equal to its value before.
72. [DR2] With the drawer open, adding a note to the rim by typing, to a rim count the sheet has not had before, resets only the rim permutation, the inner and bottom permutations are unchanged, and `#scale-drawer-status` reads row 15.
73. [DR2] Returning the rim to its earlier count restores the earlier rim permutation and writes row 16.
74. [DR2] When the picked note's ring is reset by a count change, the pick is cleared and the status ends with `The picked note was put down.`
75. [DR2] An invalid parse leaves every permutation unchanged and a later valid parse with the same counts shows them again.
76. [DR2] `RESET SEATS` returns all three permutations to the default, leaves the anchor and both mirror values unchanged, is then disabled, and writes row 12.
77. [DR2] With `prefers-reduced-motion: reduce`, a refused drop removes the ghost with no transition. Without it the ghost returns over 120 ms.
78. [DR2] No drag, key or step-button path can produce a `seats` value that `readSeats` refuses, over a sweep of every ring size from 2 to 20 and every seat pair. Needs: S3.

### Field, status, layout and states (added in review)

79. [W1] Opening the Edit sheet on a saved scale that wraps to three lines shows a field of three rows without any `input` event having fired.
80. [W1] A 60-character token with no space leaves `scrollWidth` equal to `clientWidth` in the field and in the wrapper.
81. [DR1] `#scale-drawer-status` is inside `#scale-plate-band`, after `#scale-preview`, is hidden while the drawer is closed, and has `aria-live="polite"` and `aria-atomic="true"`.
82. [DR1] With the drawer open at 380 x 780 and at 380 x 667 and the body scrolled to its end, `#scale-drawer-status` is inside the scrollport.
83. [DR2] `#scale-note-prev` and `#scale-note-next` exist and read `PREVIOUS NOTE` and `NEXT NOTE`, and the drawer's controls are in the DOM order of section 9. Needs: DR1.
84. [DR2] With the drawer open at 380 x 667 and the band stuck, the toggle and both step rows are inside the scrollport without further scrolling (required). The measured open plate width is reported (report). Needs: DR1.
85. [DR1] While the toggle is disabled `#scale-layout-hint` reads `Type a scale to adjust its layout.`. With a valid scale it reads the DR1-era sentence of section 4, which does not say that a note can be moved. The `LAYOUT_HINT` text is line 132.
86. [DR1] On the Edit sheet with the drawer open, focusing the deck name or the degrees select makes `#scale-plate-band` `position: static`, and focusing a drawer control does not.
87. [DR1] At 380 x 780 and 380 x 667, with the drawer open and the body scrolled, a control of the drawer or the toggle row focused by Tab has its top edge at or below the band's bottom edge. The plate's own tab stop is inside the band and is outside this line, and so is the landscape two-column layout, where the controls sit beside the band.
88. [DR1] At 844 x 390 the open plate is 220 px wide within 1 px (computed from `clamp(150px, calc(100dvh - 170px), 232px)`), and at 500 x 390 the zone is one column (computed from the `min-width: 560px` rule).
89. [DR1] At 380 x 667, closed, for the D3 example, the position of `#scale-layout-toggle` against the scrollport at `scrollTop` 0 is measured and reported (report). The status line's visibility at 844 x 390 is measured and reported the same way (report).
90. [DR2] NEXT NOTE with nothing picked picks the first pickable note. Pressed again it picks the next pickable note, passes from the last rim note to the first inner note, skips a ring of one note, wraps from the last note to the first, never changes `seats`, never moves focus and writes row 20. PREVIOUS NOTE is the mirror.
91. [DR2] After a swap on an Add sheet `#scale-layout-state` reads `Layout not saved yet. GENERATE CARDS keeps it.` (on Edit, `Layout not saved yet. SAVE CHANGES keeps it.`). After RESET SEATS on an Add sheet with default anchor and both mirrors it is hidden. After a swap and the same swap undone on an Add sheet it is hidden, because the comparison is by value (on Edit of a stored deck whose layout is not the default it reads `Layout changed from the default.`).
92. [DR2] During a drag the same-ring seat that contains the ghost's centre carries `.panarm` and no other seat does. Nothing carries it over another ring, the ding or empty plate. The release swaps with the armed seat.
93. [DR2] Dragging the top-centre note upward shows the whole ghost: its box may extend above the plate's top edge and is not clipped, because the ghost is `position: fixed`.
94. [DR2] After a committed swap with no other swap in the 600 ms before it, exactly two seats carry `.panflash`, and none does 700 ms later. Under `prefers-reduced-motion: reduce` the mark has no transition.
95. [DR2] `.panseat` and `.panarm` are drawn at 1.12 r, `.pansel` at 1.2 r with an ink hairline outside it, the focus mark at 1.32 r, and each orange stroke is at least 2 CSS px wide at a 284 px pan (required).
96. [DR2] Opening the drawer with a pointer shows no focus mark on any note. Reaching a note with Tab or an arrow key shows it.
97. [DR2] After a keyboard swap, focus is on the `.panhit` of the moved note at its new seat, and exactly one `.panhit` has `tabindex="0"`. After a swap by PREVIOUS SEAT, NEXT SEAT, PREVIOUS NOTE or NEXT NOTE, focus stays on the button pressed and the roving `tabindex` is on the moved note.
98. [DR2] Every `.panhit` has `role="button"`, an `aria-pressed` value, no `aria-selected`, and the accessible name `{n}, {ring} seat {s} of {k}, {place}`. The place word is correct under either mirror switch and under either anchor.
99. [DR2] When the scale stops parsing while a note has focus, focus moves to `#scale-layout-toggle`. After RESET SEATS focus is on `#scale-layout-toggle`.
100. [DR2] With note A picked, a touch hold on note B released without moving leaves B picked and `seats` unchanged.
101. [DR2] A second touch during a hold or a drag cancels the gesture and moves nothing.
102. [DR2] Escape after one NEXT SEAT press writes row 9b and leaves `seats` holding that swap.
103. [DR2] Two identical refusals in a row each change the status line's text node (cleared, then written), and the `warn` colour is gone after the next write that is not a refusal.
104. [DR2] One edit that changes the rim count and the inner count writes one status message holding both sentences.
105. [DR2] Changing the anchor or either mirror switch with a note picked keeps that note picked.
106. [DR2] A scale with no ring of two notes opens the drawer with all four step buttons disabled and row 19 in the status line.
107. [DR2] With the drawer open and focus in `#scale-box`, Escape with a note picked ends the pick, a second closes the drawer (focus stays in the field), and a third closes the sheet.

### Mirror switches, close mark, anchor from the mock

108. [DR1] With the drawer open `#scale-layout-toggle` contains one `aria-hidden` element whose text is U+00D7 and which is displayed. With the drawer closed that element is not displayed. The toggle's accessible name is `Adjust layout` in both states.
109. [W1] `#scale-mirror` has the text `MIRROR TOP` and `#scale-mirror-bottom` the text `MIRROR BOTTOM`. Both have `aria-pressed="false"` by default.
110. [W1] On a pan with rim, inner and bottom notes, toggling MIRROR TOP changes the angle of every rim and inner field with an angle other than 90 or 270 and of no bottom field. Toggling MIRROR BOTTOM changes bottom fields only. Needs: S2.
111. [W1] `#scale-mirror-bottom` is disabled and unpressed on a pan with no bottom notes, and the generated deck has `mirrorBottom` off. On an Add sheet with MIRROR TOP pressed and `(D3) A3 C4 D4` typed, adding ` / C3` leaves it enabled and unpressed, and the generated deck has `mirror` on and `mirrorBottom` off.
112. [W1] A deck WITH bottom notes stored with the old single `mirror: true` opens with both switches pressed, and draws every field where the same build draws it for `mirror: true` alone (the baseline is the same solver, not an older release: the plan accepts that S2 redraws some old mirrored decks). The same deck WITHOUT bottom notes opens with MIRROR TOP pressed and MIRROR BOTTOM disabled and unpressed. W1 asserts nothing about `#scale-layout-state`, which is DR1's element (line 117). Needs: S2, S3.
113. [W1] A deck generated with MIRROR TOP on and MIRROR BOTTOM off reopens on Edit, and from its share link, with exactly that pair of values. Needs: S3.
114. [DR1] Both switches are inside `#scale-drawer`. Toggling MIRROR TOP writes row 14 and MIRROR BOTTOM writes row 21.
115. [DR1] Pygmy's scale string typed on Add opens with `#scale-anchor-one` pressed. After one tap on BESIDE CENTRE every rim, inner and bottom field sits at the angle `data/decks.json` has for the built-in Pygmy deck (field 1 at 290), and the generated deck reopens on Edit with `#scale-anchor-between` pressed. Needs: G2b, P1, S2, S3.
116. [DR2] RESET SEATS leaves both mirror values unchanged.
117. [DR1] On Edit, a deck WITHOUT bottom notes stored with the old single `mirror: true` opens with `#scale-layout-state` reading `Layout changed from the default.`, never the `Layout not saved yet.` text. Needs: W1.

### Lines added in the repair pass

118. [W1] `#scale-label-2` exists, is empty and hidden, and is named by the field's `aria-describedby`. G2b's line 9 gives it text and shows it.
119. [W1] For a valid scale, the count line begins `Ding {X} · {a} top · {b} inner · {c} bottom.` and then lists the notes grouped by shell. All three counts are always printed, including `0 inner` and `0 bottom`. The test uses a scale today's grammar accepts.
120. [DR2] The Tab order walks BACK, (Edit: the deck name,) the field, the plate as one stop (open only), the toggle, PREVIOUS NOTE, NEXT NOTE, PREVIOUS SEAT, NEXT SEAT, MIRROR TOP, MIRROR BOTTOM, RESET SEATS, ON CENTRE, BESIDE CENTRE, in that order, skipping disabled controls. Needs: DR1.
121. [DR1] Closing the drawer while the box is empty or does not parse, from a control inside the zone, leaves focus on `#scale-box` and then disables the toggle. Closing over a valid scale leaves focus on the toggle. Closing with Escape while focus is in the field leaves focus in the field.
122. [DR2] While the drawer is open and the scale does not parse, PREVIOUS NOTE, NEXT NOTE, PREVIOUS SEAT, NEXT SEAT and RESET SEATS are disabled, `#scale-preview` contains no `.panhit`, and any pick has been put down. Needs: DR1.
123. [DR2] When a pick ends with Escape while focus is on PREVIOUS SEAT or NEXT SEAT, focus goes to the `.panhit` of the note that was picked.
124. [DR2] With A picked and the arrows moved to B, B has focus and `tabindex="0"` and A keeps `aria-pressed="true"`. After Tab out of the plate and Shift+Tab back, focus is on A.
125. [DR2] A touch hold on a note released within 8 px of the lift point is not a drag: `seats` is unchanged. After a drag of more than 8 px released on the note's own seat, `seats` is unchanged, row 8 is written and the note is still picked.
126. [DR2] With the drawer closed, a ring whose count changes follows the reset and restore rules of section 14 for the arrangements the sheet holds, no row 15, 16 or 17 is written, and reopening the drawer shows an empty status line when some ring has two or more notes (row 19 when none does).
127. [G2b] The message after GENERATE does not contain the `LAYOUT_HINT` text. It reads `{n} cards generated` or `Updated {name}`, then any warnings. Needs: W1.

### Lines added by the interview 8 pass

128. [W1] While the box is empty or does not parse, `#scale-mirror` and `#scale-mirror-bottom` are disabled and keep their pressed values, and become enabled or disabled by their own rules when it parses again.
129. [DR1] `#scale-legacy-group` is inside `#scale-drawer` and its `aria-describedby` names `#scale-legacy-hint`. `#scale-layout-hint` is the toggle row's and is not inside the group.
130. [DR1] On the Add sheet `#scale-legacy-group` is `hidden` and none of `#scale-rot-l`, `#scale-rot-r`, `#scale-move-l`, `#scale-move-r`, `#scale-layout-reset` is displayed, with the drawer open and closed. On the Edit sheet they are displayed with the drawer open and not displayed with it closed.
131. [DR1] On the Edit sheet with the drawer open and focus on `#scale-rot-l`, Escape closes the drawer, leaves the sheet open and puts focus on `#scale-layout-toggle`.
132. [DR2] With a valid scale and the drawer closed, `#scale-layout-hint` reads the `LAYOUT_HINT` text of plan section 9. Needs: DR1, G2b.
133. [W1] On an Add sheet with MIRROR TOP pressed, typing `(D3) A3 C4 D4 / C3`, deleting the bottom note and typing it again leaves `#scale-mirror-bottom` enabled and unpressed.

### Counts by lane

Counted from the tags above: W1 21, G2b 5, DR1 37, DR2 70, which is 133 lines in all. Retired lines: none.

## Coordinator readings

These are the readings the repair pass took where an earlier text was silent or two texts met. They are a record for the owner. They add no rule: the body already says the same.

- Lane order (L4). DR1 keeps today's ROTATE, MOVE and reset controls and today's `previewBox` keydown handler. New note-moving controls (NOTE, SEAT, RESET SEATS) and the removal of the old ones arrive together in DR2. Lines 18, 19, 24, 29, 83, 84 and 106 moved to DR2. Line 31 was split (new line 122).
- Lane order (L1, L2, L3, M2). Line 14 moved to G2b. W1 adds `#scale-label-2` empty and hidden (line 118) and G2b shows it (line 9). W1 tests the field with an injected placeholder (line 3) and G2b re-runs the check with the real one (line 4). The count-line shape is a W1 line (119).
- Focus (S1, S2, S3, S4, S9). Closing over an invalid box sends focus to the field first. A pick that ends while focus is on a SEAT button sends focus to the picked note. "First pickable note" replaces "rim seat 1"; the owner confirmed it on 2026-10-07 [OD 8]. Selection, focus and tab-entry are three separate things. A focused note deleted by a box edit cannot arise by a user path.
- Close focus. When a drawer closes, focus goes to the toggle only if it was inside the zone. If it was in the field, the name or the degrees select, it stays. This keeps Escape from stealing focus while typing (line 107).
- Touch (S5). The 8 px threshold after a lift is for touch. A mouse or pen keeps 4 px (line 50). A drag released on its own seat leaves the note picked. A tap on the picked note, or Space on its own seat, puts it down.
- Mirror (S6). MIRROR BOTTOM with no bottom notes is disabled, unpressed and stores false. When a bottom note is added it is enabled and off, and does not take MIRROR TOP's value; the owner decided this on 2026-10-07 [OD 7], matching plan AM-4. The instruction that both switches "stay enabled only if the drawer is open" is read with line 31: while the box is empty or invalid both switches keep their values and are disabled, and they are not displayed while the drawer is closed.
- Ring memory (S7). The memory is seeded with the arrangement the sheet opened with. With the drawer closed the same rules apply and nothing is announced. Rows 15 to 17 are written only while the drawer is open. When one parse ends a pause and changes counts, row 18b leads the one message.
- The notice (S8). It compares by value, so a swap and its undo return it to what it was before the swap. MIRROR BOTTOM is left out of the comparison while the pan has no bottom notes.
- The ghost (S10). It is `position: fixed`.
- The band (S13). It un-sticks while any form control outside the zone has focus: the scale field, the deck name, the degrees select, the swatches.
- The toggle (S14). It carries `aria-label="Adjust layout"` and the close mark is not displayed when closed.
- The hint (S15). `LAYOUT_HINT` is used only beside the toggle. The message after GENERATE no longer appends it. Today it does, and the plan puts the hint's wording with G2b (line 127). The owner accepted on 2026-10-07 that between G2b and DR1 it is shown nowhere [OD 10], and the DR1 build shows the DR1-era sentence of section 4.
- The old group (N1). The owner decided on 2026-10-07 that between DR1 and DR2 today's ROTATE, MOVE and RESET group lives inside the drawer, Edit only [OD 9]. Section 17 and 16.1 carry it.
- Blank on open (S11). The clause is gone. The status line shows row 19 on open when no ring has two notes and is empty otherwise.
- Pixels (step 6, M1). Section 10's 68 px and 52 px are predictions. The landscape arithmetic of section 5.4 is a prediction and is measured and reported. The 220 px landscape plate, the 280 px portrait plate and the 150 px lower bound are computed. The 44 px targets are required.
- Step rows. DR2, which adds the step rows, repeats the 380 x 667 fit measurement and may lower the `42dvh` factor. That is the one DR1-owned rule it may touch.
- Drawer hint. DR1 adds the element empty and hidden. DR2 gives it the text, because the text describes the tap and drag interaction DR2 builds.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | - | - |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | - | covered by the parent plan's eng reviews |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 6/10 to 9/10, 9 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | - | - |

- **OUTSIDE VOICES:** Codex and a Claude reviewer both ran on the first draft; 10 and 12 findings, all folded into the text above or listed in section 19.
- **VERDICT:** DESIGN CLEARED and signed off by the owner 2026-10-07. Acceptance list after the interview 8 pass: 133 lines (W1 21, G2b 5, DR1 37, DR2 70).

Design review scores, kept as a record:

| Pass | Before | After | Note |
|---|---|---|---|
| 1 Information architecture | 6 | 9 | status pinned, steps first; phone fit is still an estimate until DR1 measures |
| 2 Interaction states | 6 | 9 | armed, flash, unsaved, no-pickable-ring and redraw table added |
| 3 User journey | 7 | 9 | success now visible; unsaved work is named, not guarded |
| 4 AI slop risk | 9 | 9 | APP UI; no card grid, no decoration added |
| 5 Design system alignment | 7 | 9 | three ring sizes, tokens; no new colour or font |
| 6 Responsive and accessibility | 5 | 9 | roving focus, Tab safe, 44 px path complete; real-device touch proof moved to the DR2 gate |
| 7 Unresolved decisions | 9 forks | 0 | all decided by the owner |

Outside voices said "revise before sign-off", no hard rejection from either. Litmus: both YES on product, anchor, no cards, premium without shadows. Codex YES and Claude NO on "understandable from labels alone" (seat is never defined on screen; the drawer hint and the helpers carry it) and on "one job per section" (the status line; kept as one line by section 9's no-hidden-twin rule). Both NO on motion, answered by RD 9.

NO UNRESOLVED DECISIONS
