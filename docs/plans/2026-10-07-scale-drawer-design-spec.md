DRAFT, awaiting owner sign-off (plan section 19, R4). W1, DR1 and DR2 may not start until this is signed off and merged.

# DS: drawer and field interaction spec

Plan: `docs/plans/2026-10-06-scale-syntax-and-layout-drawer.md`, section 10 (the DS brief) and section 19. This file is the DS step's output. It was produced with `/frontend-design:frontend-design`, constrained to the app's existing visual system. It changes no code, test or data.

Reading rules. Every behaviour below is a decision. The six forks it raised were decided by the owner on 2026-10-07; they are listed in section 16 (Owner decisions) and marked `[OD n]` where they apply. Code is cited by function and element id, never by line. Figures marked ESTIMATE or UNVERIFIED were computed by hand and no browser was run; the consuming lane measures them and reports.

## 1. Design position

The pan is the control. The drawer is not a second screen, a modal or a bottom sheet: it is an inline disclosure in the sheet's scrolling body, directly under the pan it changes, and the pan stays visible and interactive while it is open. One thing is allowed to be memorable: the picked-up note (an orange ring on a light plate, with a dashed orange ring on every seat it may take). Everything else is the existing `.mode` / `.sheetlabel` / Bitter-and-Nunito system and adds no colour, font, shadow or radius.

Two facts shape everything:

1. The drag surface is a 300 px plate on a 380 px phone and the targets on it are often under 44 px (plan 5.8). A drag cannot be the only path.
2. Touch drag fights page scroll. The plate is large, so the plate cannot be a scroll trap.

## 2. Vocabulary and element ids

Closed name list. Lanes use these ids; the `app_surface_v1.json` fixture and `tools/sandbox.js` follow them.

| Id | Element | Owner lane |
|---|---|---|
| `scale-box` | `<textarea rows="1">` inside `#scale-box-wrap.grow` (replaces the `<input>`) | W1 |
| `scale-box-wrap` | grid wrapper that sizes the field (section 3) | W1 |
| `scale-label-2` | the second label line (section 9 of the plan) | W1 |
| `scale-parse` | the count line (unchanged id) | W1 |
| `scale-refusal` | the refusal line (unchanged id) | unchanged |
| `scale-mirror` | the one MIRROR switch; button, `.mode`, `aria-pressed` | W1 (in place), DR1 (moves it in) |
| `scale-layout-zone` | NEW wrapper around `#scale-preview`, `#scale-layout-row`, `#scale-drawer` | DR1 |
| `scale-preview` | the plate (unchanged id) | DR1 (interactive only while the drawer is open) |
| `scale-layout-row` | the closed-state row (kept id) | DR1 |
| `scale-layout-toggle` | the ADJUST LAYOUT button | DR1 |
| `scale-layout-hint` | the closed-state hint (`LAYOUT_HINT`) | DR1 |
| `scale-layout-state` | "Layout changed from the default." line | DR1 |
| `scale-drawer` | the disclosure region, `role="group"` | DR1 |
| `scale-drawer-hint` | the open-state instruction | DR1 |
| `scale-anchor-one`, `scale-anchor-between` | the two anchor buttons | DR1 |
| `scale-mirror` | (as above) | DR1 |
| `scale-layout-reset` | RESET SEATS (kept id) | DR1 (renders), DR2 (enables) |
| `scale-seat-prev`, `scale-seat-next` | PREVIOUS SEAT, NEXT SEAT | DR1 (renders, disabled), DR2 (wires) |
| `scale-drawer-status` | the one live line for every drawer announcement | DR1 (renders), DR2 (writes) |

Gone after DR1: `scale-rot-l`, `scale-rot-r`, `scale-move-l`, `scale-move-r`, `scale-mirror-l`, `scale-mirror-r` (W1 removes the last two).

One structural note for the integrator: `#scale-preview` moves into the new `#scale-layout-zone` wrapper. The plan lists `#scale-layout-row` and "the new drawer element" under DR1's ownership but not the plate's markup position; DR1 owns this one move and nothing else about the plate's markup.

## 3. The field (W1)

**Control.** `#scale-box` becomes a `<textarea rows="1">` (same attributes as today: `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="go"`, plus `wrap="soft"` and `maxlength` unset). It sits in `#scale-box-wrap`, a one-cell grid.

**Sizing.** The wrapper uses the replicated-text technique and needs no measuring script: the wrapper carries `data-grow`, set on every `input` to `value || placeholder`; a `::after` with `content: attr(data-grow) " "`, `white-space: pre-wrap`, `visibility: hidden`, the field's exact font, padding and border, occupies the same grid cell as the textarea; the textarea is `resize: none; overflow: hidden` in the same cell. The cell therefore grows with the longer of the typed text or, when empty, the whole placeholder. Rows: one to three. The wrapper has `max-height: calc(3 * 1.3em + 24px)` (`+ 18px` under `max-height:520px`, where padding is 9 px) and the textarea becomes `overflow-y: auto` only at that cap. Past three rows the field scrolls vertically inside itself and keeps the caret in view; it never scrolls sideways (`overflow-wrap: anywhere`).

**Empty field.** The placeholder is the 60-character string of plan section 9, unchanged and unshortened. Because an empty field sizes itself from the placeholder, the whole string shows. At 380 px the content box is about 306 px wide (336 surface minus 2 border and 28 padding), Bitter 16 px holds about 37 characters per row, so the placeholder takes two rows (ESTIMATE, UNVERIFIED). Three rows is the hard ceiling and still shows it.

**Enter.** Enter and Shift+Enter in the field both call `runGenerate()` and never insert a line break. Enter while `e.isComposing` is ignored (an IME confirm is not a submit). Paste: the `input` handler replaces every `\r\n`, `\r` and `\n` in the value with one space, preserving the caret.

**Label.** The two label lines of plan section 9 do not have to fit one line each. Line 1 (`SCALE: (DING) TOP NOTES | OPTIONAL INNER NOTES`, about 326 px at 9.5 px with `.13em` tracking, ESTIMATE) is the `<label for="scale-box">`. Line 2 (`[NOTE] = A BOTTOM NOTE, WRITTEN WHERE ITS PITCH FALLS`, about 376 px, ESTIMATE) is `#scale-label-2`, a `.sheetlabel` span that wraps to a second line; the field's `aria-describedby` names it. Neither is truncated.

**Count line and refusal.** They SHARE one region, as today. Decision: keep the structural exclusivity (`showParse()` and `showRefusal()` each blank the other; the `:empty` rule takes the empty one out of the flow). The region's height follows its content: the count line wraps to as many lines as the text needs (about three at 380 px for the D3 example, ESTIMATE) and a refusal wraps to its own. No fixed three-line floor is added. Reason: a floor would cost every sheet two blank lines to prevent a step that only happens while the player is typing, and nothing is being dragged then. The sheet already accepts that the primary stays pinned and the body scrolls (W1 stop condition). The warning (`SMALL_LABELS`, `NO_THIRDS`) stays in `#scale-msg`, never in this region.

## 4. How the drawer opens and closes

**Name.** `ADJUST LAYOUT`, the name `LAYOUT_HINT` already uses. It is the button's text whether the drawer is open or closed; open state is shown by `aria-expanded="true"` and `.mode.on`, not by a different label [OD 6].

**Form.** An inline disclosure, `#scale-drawer`, in `#scale-layout-zone` under the plate and the toggle. No overlay, no focus trap of its own, no scrim. The sheet's existing Tab trap and aria-modal dialog stay the only trap.

**Where the toggle is.** In `#scale-layout-row`, under the plate: the toggle (auto width, `.mode`, left aligned), then `#scale-layout-hint` (the `LAYOUT_HINT` text of plan section 9, Bitter 11.5 px, the existing `.sheethint` style). The row is present on Add and on Edit. It is never `hidden`, so the sheet height does not jump when the scale becomes valid.

**Offered before the box parses?** The toggle is shown always and is `disabled` (same dimming as `#scale-generate:disabled`, opacity .5) while the box is empty or does not parse and the drawer is closed. Reason: an arrangement of a placeholder example nobody typed would be thrown away on the first keystroke, and `disabled` matches GENERATE CARDS, which gates the same way. The hint is shown, dimmed with the button.

**Open.** Tap or press the toggle:
1. `#scale-drawer` is revealed, `aria-expanded="true"`, the toggle gains `.on`.
2. The plate becomes interactive (hit layer built, `tabindex="0"`, `role="group"`, `aria-label` "Pan layout: N rim, N inner, N bottom notes. Arrow keys choose a note.").
3. Focus moves to `#scale-preview`. No soft keyboard opens (a plate is not an editable).
4. `#scale-layout-hint` is hidden; `#scale-drawer-hint` takes its place.
5. The sheet body scrolls the zone into view with `block: "nearest"` and `behavior: "auto"`.
6. Nothing is announced beyond the plate's own label (no double speech).

**Close.** Any of: the toggle again; Escape with no note picked; BACK; closing or saving the sheet. On close: the hit layer is removed, the plate loses `tabindex`, any pick is cancelled without change, focus returns to `#scale-layout-toggle` (except when the sheet itself is closing, where `hideSheet()` already returns focus to the opener).

**Escape ladder.** One level per press: a picked note is cancelled; else the drawer closes; else (existing behaviour) the sheet closes. The plate and every drawer control stop propagation of Escape when they consume it.

**Opening state.** The drawer is closed every time the sheet opens, Add or Edit (`resetSheetState`). An Edit deck with a non-default layout opens with the drawer closed and `#scale-layout-state` visible ("Layout changed from the default.", Bitter 12 px, `#c4bcab`, under the hint). The state line appears for any of: a non-default arrangement, anchor `between`, MIRROR on.

**Focus order** (the sheet's Tab list, owned by DR1): BACK; Edit: deck name; scale field; plate (only while open); ADJUST LAYOUT; while open: NOTE 1 pair, MIRROR, RESET SEATS, PREVIOUS SEAT, NEXT SEAT; Edit: degrees; palette swatches; GENERATE CARDS; Edit: DELETE. Disabled controls are not stops (existing `isStop`). The plate comes before the toggle because it is above it.

## 5. Layout while the drawer is open

**Sticky plate.** While the drawer is open the plate is `position: sticky; top: 0` in `.sheetbody`, so the controls scroll under it and the pan is always visible while a control is used. It un-sticks (`position: static`) while `#scale-box` has focus, because with a soft keyboard up the scrollport is about 159 px and a 318 px sticky plate would swallow it. The rule is `.sheetbody:has(#scale-box:focus) #scale-preview { position: static }`. Focusing the field does NOT close the drawer: a player may type and watch the pan.

**Plate size.** Portrait phone: unchanged, `max-width: 300px` (the plan 5.8 baseline of about 284 px for the pan). On a short portrait viewport the open plate is `max-width: min(300px, 42dvh)` so the controls keep a usable window (at 380 x 667 the plate is 280 px, ESTIMATE).

**Field of view at 380 x 780** (ESTIMATE): header 56, footer about 100, body about 600. Open plate 318 sticky leaves about 282 px of controls window; the drawer is about 250 px. It fits within a few pixels of scroll.

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
| Layout is a guess. Open ADJUST       |
| LAYOUT to move a note, ...           |
| Layout changed from the default.     |   only when changed
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
|  +--------------------------------+  |   sticky: stays while the
|  |   pan, notes are targets       |  |   controls scroll under it
|  |   picked note: orange ring     |  |
|  |   same-ring seats: dashed      |  |
|  +--------------------------------+  |
| [ ADJUST LAYOUT ] (on)               |
| Tap a note, then tap another note in |
| the same ring to swap them. Or hold  |
| a note and drag it.                  |
| NOTE 1                               |
| [  ON CENTRE  ] [ BESIDE CENTRE ]    |
| On centre puts note 1 at the bottom  |
| centre. Beside centre puts the       |
| bottom centre between notes 1 and 2. |
| [   MIRROR    ] [  RESET SEATS  ]    |
| [ PREVIOUS SEAT ] [  NEXT SEAT   ]   |
| Picked up A4. Tap or drop it on ...  |   #scale-drawer-status
| (#scale-msg warning, if due)         |
|--------------------------------------|
| [          GENERATE CARDS           ]|
+--------------------------------------+
```

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
| [ ADJUST LAYOUT ]                                |
| NOTE 1   [ ON CENTRE ][ BESIDE CENTRE ]          |
| [ MIRROR ] [ RESET SEATS ] [ PREV SEAT ][ NEXT ] |
| status line                                      |
+--------------------------------------------------+
```
The plate is not sticky at this size in practice (the body rarely scrolls at 700 px or more of height) but the rule is the same. Controls sit in `.ctlrow` rows with the existing `--sp-*` ramp (the ramp steps up at 640 x 700).

### 5.4 Wireframe: landscape phone (`max-height: 520px`, for example 844 x 390)

Closed: as today, the plate is 120 px, the toggle row under it.

Open: `#scale-layout-zone` becomes a two-column grid. The plate is the left column, square, `width: clamp(150px, calc(100dvh - 170px), 232px)` (232 px at 390 px tall, ESTIMATE), sticky. Controls are the right column and scroll.

```
+----------------------------------------------------------------+
| < BACK                                  Edit a scale           |
|----------------------------------------------------------------|
| +----------------+ [ ADJUST LAYOUT ] (on)                      |
| |                | NOTE 1  [ON CENTRE][BESIDE CENTRE]          |
| |    pan 232     | [ MIRROR ][ RESET SEATS ]                   |
| |    (sticky)    | [PREVIOUS SEAT][ NEXT SEAT ]                |
| |                | status line                                 |
| +----------------+                                             |
|----------------------------------------------------------------|
| [                     GENERATE CARDS                         ] |
+----------------------------------------------------------------+
```
Landscape spacing uses the existing `max-height:520px` ramp (`--sp-1:3px ... --sp-4:14px`). In this layout the plate is large enough to drag on; the 120 px preview is the closed state only.

## 6. The seat model (what a gesture means)

**Primitive: SWAP.** Dropping note A on note B's seat exchanges the two. This keeps plan A18. It is the same on every path: pointer, tap-then-tap, keyboard, step buttons. Insert-and-shift was considered and rejected because a drag, a tap pair and a keyboard "carry" would otherwise give different results for the same intent, and a swap is trivially cancelled. In data terms (plan section 8): the dragged note's ring index and the occupant's ring index exchange their entries in that ring's permutation.

**Ring.** A note moves only within its own ring (rim, inner, bottom). The ding has no seat and is not a target and not a source. A ring of one note cannot be picked.

**Seat order.** A ring's seats are numbered in the ring's own permutation order (rim seat 1 is where default note 1 sits; with the anchor and mirror applied that is wherever the solver put it). Keyboard seat-by-seat movement walks seat numbers 1 to k and wraps from k to 1 and back, because a ring is a circle. Seat numbers follow the zig-zag, not geometry, and every announcement adds a plain place word so that a listener is not asked to picture the zig-zag.

**Place words.** From the seat's actual angle (0 right, 90 up, 270 bottom), 45 degree sectors: right (337.5 to 22.5), upper right, top (67.5 to 112.5), upper left, left (157.5 to 202.5), lower left, bottom (247.5 to 292.5), lower right. The word reflects the drawn position, so it is correct under MIRROR and under either anchor.

**Picked.** Exactly one note can be picked. Picked means: the orange selection ring (existing `.pansel`), same-ring seats get dashed rings, other rings are veiled, and the step buttons act on it.

**Gestures, in one table.**

| Gesture | Nothing picked | A note picked |
|---|---|---|
| Tap a note | picks it | same note: puts it down. Same-ring other note: swap, then idle. Other-ring note: refused (section 8). |
| Hold a note (touch) then drag and release | lifts it, drop swaps or is refused | same, from the picked note or a new one |
| Press and drag (mouse, pen) | drags it after 4 px of movement | same |
| Space or Enter on the plate | picks the note under the cursor | drops on the cursor seat (swap, or put down if it is its own seat) |
| Arrow keys on the plate | move the cursor to the next note | move the cursor to the next seat of the picked ring |
| NEXT SEAT, PREVIOUS SEAT | disabled | swap with the occupant of the adjacent seat; the note stays picked |
| Escape | closes the drawer | cancels the pick, nothing moved |

## 7. Pointer drag on touch, without scrolling the page

**Constraint.** The plate must never be a scroll trap. A swipe that starts on the plate scrolls the sheet body like any other swipe. `touch-action: none` on the plate is therefore NOT used [OD 2].

**Mechanism.**
1. `pointerdown` on a `.panhit` starts a lift timer. For `pointerType: "touch"` the lift happens after 250 ms of the finger staying within 8 px. For `mouse` and `pen` there is no timer: the drag begins after 4 px of movement.
2. If the finger moves more than 8 px before 250 ms, the gesture is a scroll: nothing is done, no `preventDefault`, the browser scrolls (and fires `pointercancel`, which ends the gesture cleanly).
3. At lift: the note is picked, a ghost (section 12) appears 36 px above the finger so the finger does not hide it, `#scale-preview` takes `setPointerCapture`, and a non-passive `touchmove` listener is added that calls `preventDefault()` for the rest of the gesture. Because the finger has not moved during the hold, the browser has not started a scroll, so this works on iOS Safari and Chrome. The listener is removed at `pointerup` and `pointercancel`.
4. The plate carries `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none`, and a `contextmenu` handler that calls `preventDefault` while the drawer is open, so the long press does not raise the iOS callout, the magnifier or the Android context menu.
5. `pointercancel` cancels the gesture, restores the pre-gesture pick state and moves nothing.
6. A drop never also fires a tap: the delegated `click` handler ignores the click that follows a drag.
7. A press-hold that is released without having moved is a tap on that note.

**Hit-testing at release.** The target is the nearest valid target whose ring-mode radius (section 10) contains the point; else the release is a refused drop (section 8).

**Mouse.** `cursor: grab` on `.panhit` while the drawer is open, `grabbing` during a drag.

## 8. Drops that are refused, and how they are shown

A drop is refused when it lands on: a note of another ring; the ding; empty plate; or outside the plate. Nothing changes in the arrangement. Shown three ways at once, none of which depends on colour alone:

1. The ghost returns to the picked note's seat (120 ms) and disappears. Under reduced motion it disappears at once.
2. `#scale-drawer-status` takes the amber `.warn` colour (`#e3b25c`) and one of these exact sentences:
   - other ring: `Not moved. {n} moves only within the {ring}.`
   - elsewhere: `Not moved. Drop {n} on another {ring} note to swap.`
3. While a note is picked, notes of the other rings are already veiled (section 12), so the refusal is predicted before it happens.

A refused drop leaves the pick state as it was before the gesture began (a drag that started from idle returns to idle; a drag that started with a picked note keeps it picked). A refused tap on another ring's note shows the same status, keeps the pick, and moves nothing.

Refusals are warnings, not errors: amber, never the orange `#E27005` of `.err`.

## 9. The controls in the drawer

All are `.mode` buttons at 44 px (existing rule), in `.ctlrow` / `.mirror` flex rows with `gap: var(--sp-2)`. No new component.

**Anchor (plan 7.1, D7).** Group label `NOTE 1` (`.sheetlabel`, `id="scale-anchor-label"`), then a `.mirror` pair of two equal `.mode` buttons with `aria-pressed` (the same convention as the retired mirror pair), exactly one pressed:
- `ON CENTRE` (`#scale-anchor-one`, default): note 1 at bottom centre.
- `BESIDE CENTRE` (`#scale-anchor-between`): the bottom centre falls between notes 1 and 2.

Helper (`.sheethint`): `On centre puts note 1 at the bottom centre. Beside centre puts the bottom centre between notes 1 and 2.` Labels are anchor words, not left or right, because under MIRROR the note moves side. Each button is about 158 px wide at 380 and its label is at most 13 characters (ESTIMATE: fits).

Changing the anchor re-solves and redraws the plate at once, keeps every arrangement (plan section 8: the anchor changes where seats are, not who sits in them), and writes `Note 1 is on centre.` or `Note 1 is beside centre.` to the status line.

**MIRROR (D13).** One `.mode` button, id `scale-mirror`, text `MIRROR` (not renamed), `aria-pressed`, off by default, `.on` when on. Helper: `Flips left and right.` Toggling re-solves and redraws, keeps arrangements, writes `Mirror on.` or `Mirror off.` A stored `mirror: true` opens with it on. In W1 it sits where the old pair sat (the `.ctlrow` before the swatches); DR1 moves it into the drawer, same id, same handler.

**RESET SEATS.** `#scale-layout-reset`, `.mode`-style text button as today but labelled `RESET SEATS`. It returns the three seat arrangements to the generated default. It leaves anchor and MIRROR alone, each being one tap to undo [OD 3]. Disabled while all three rings are already default. Status: `Seats reset to the default.` It cancels any pick.

**PREVIOUS SEAT and NEXT SEAT.** `#scale-seat-prev`, `#scale-seat-next`, equal `.mode` buttons. They are the 44 px, no-pointer-accuracy path for every pan the plate cannot serve (section 10) [OD 1]. Disabled until a note is picked. Each swaps the picked note with the occupant of the adjacent seat in its ring (wrapping), keeps it picked, redraws, and writes the swap sentence (section 11, row 7). They are not ROTATE and not MOVE: there is no cyclic shift and they do not exist outside the drawer.

**Status line.** `#scale-drawer-status`, `aria-live="polite"`, Bitter 12 px, `#c4bcab`, `min-height: 3.1em` (two lines) so the drawer does not jump; it grows if a sentence needs more. It is the ONLY live region the drawer writes: what a sighted player reads is exactly what a screen reader hears, with no hidden twin. It is blank on open, is cleared on close, and turns amber for refusals (section 8). It lives inside the dialog because `#scale-sheet` is aria-modal and the page-level `.announce` is outside it.

## 10. The 5.8 hit-target problem

Facts (plan 5.8): at a 284 px pan, the tightest target is 36 px (D3 example), 33 px (Pygmy), 39 px (Xenith) and 22 px (20 rim, 2 inner, 8 bottom). At 340 px they are 43, 40, 47 and 27. A 300 px portrait plate cannot reach 44 px on those shapes whatever the layout. The existing rule (`panHitRadii`: half the nearest-neighbour distance, 44 px floor where there is room, non-overlap wins) stays the default and stays the proof that targets never overlap.

The drawer adds three layers, in this order:

1. **Ring mode.** The moment a note is picked, only the picked note's ring matters as a target set. `sizePanHits` is run on that ring's points only, so the cap is half the distance to the nearest note IN THE SAME RING, which is the larger distance (plan 5.8: D3 rim to rim 0.510 R against rim to inner 0.372 R). The same-ring targets are drawn last in the hit layer (on top). Other-ring targets keep their all-points radii underneath, so the refusal path still works where a same-ring target does not cover. Where the two overlap, the same-ring target wins, which is the intended answer. Expected: every rim of 12 or fewer notes reaches 44 px at 284 px (ESTIMATE, UNVERIFIED: 0.510 R gives 68 px for 9 rim, and 0.386 R gives 52 px for 12 rim).
2. **Name before commit.** A picked note is named in the status line and in its ghost, so a mis-pick on a small target is visible before anything changes, and a release on empty plate costs nothing.
3. **A path that needs no accuracy.** Tap a note (or use the keyboard) to pick, then PREVIOUS SEAT and NEXT SEAT, 44 px buttons, move it. For a 20-rim crowd with 22 px targets this is the supported path; the plate is still the display. The keyboard map (section 11) is the same path for assistive technology.

Landscape phones: the open plate is up to 232 px (section 5.4); ring mode and the step buttons apply unchanged. The closed 120 px plate has no targets.

If DR2 measures a ring that reaches neither 44 px in ring mode nor is disjoint, it reports the measured values on the PR and does not widen the plate.

## 11. Keyboard map and announcements

The plate (`#scale-preview`, open) is ONE tab stop. A cursor ring (solid ink `#272219`, 2 px, at 1.2 times the note radius) marks the note under the cursor. The cursor starts on the first selectable note (rim seat 1).

| Key | Nothing picked | A note picked |
|---|---|---|
| Right, Down | cursor to the next note (rim, then inner, then bottom; no wrap past the last) | cursor to the next seat of the picked ring (wraps k to 1) |
| Left, Up | previous note | previous seat (wraps 1 to k) |
| Home, End | first, last note of the pan | first, last seat of the ring |
| Space, Enter | pick up the note under the cursor | drop: swap with the occupant of the cursor seat; on its own seat, put it down |
| Escape | close the drawer | cancel, nothing moved (the picked note's ring and the arrangement are unchanged) |
| Tab | leaves the plate | drops the note on the cursor seat, then leaves |

A cursor move never changes the arrangement. Only a drop does, and a drop is one swap, so cancel is exact. The preview redraws on the drop (and on each step-button press); during keyboard movement the plate shows the cursor and the dashed target rings.

**Announcements.** One element, `#scale-drawer-status`. `{n}` is the note with octave (`F#4`; a bottom note is its pitch, for example `C3`). `{m}` is the other note. `{ring}` is `rim`, `inner` or `bottom`. `{s}` is the seat number, `{k}` the ring size, `{t}` the target seat number, `{place}` a place word (section 6). Exact strings:

| # | When | Text |
|---|---|---|
| 1 | cursor moves, nothing picked | `{n}, {ring} seat {s} of {k}, {place}. Space picks it up.` |
| 2 | cursor lands on a ring of one note | `{n} is the only note in the {ring}, so it has no other seat.` |
| 3 | pick up by keyboard | `Picked up {n} from {ring} seat {s} of {k}, {place}. Arrows choose a seat in the {ring}. Space drops it. Escape cancels.` |
| 4 | pick up by tap, hold or drag | `Picked up {n}. Tap or drop it on another {ring} note to swap, or use PREVIOUS SEAT and NEXT SEAT.` |
| 5 | cursor moves, picked, onto another seat | `{ring} seat {t} of {k}, {place}, holds {m}. Space swaps {n} with {m}.` |
| 6 | cursor on the picked note's own seat | `{ring} seat {s} of {k}, {place}, where {n} started. Space leaves it here.` |
| 7 | swap done (any path) | `Swapped {n} and {m}. {n} is now in {ring} seat {t} of {k}, {place}.` |
| 8 | dropped on its own seat, or tap on the picked note | `{n} stays in {ring} seat {s} of {k}.` |
| 9 | Escape | `Cancelled. Nothing moved.` |
| 10 | refused, other ring | `Not moved. {n} moves only within the {ring}.` |
| 11 | refused, elsewhere | `Not moved. Drop {n} on another {ring} note to swap.` |
| 12 | RESET SEATS | `Seats reset to the default.` |
| 13 | anchor | `Note 1 is on centre.` or `Note 1 is beside centre.` |
| 14 | MIRROR | `Mirror on.` or `Mirror off.` |
| 15 | count of a ring changed (section 14) | `The {ring} now has {k} notes, so its seats were reset.` (`1 note` when k is 1) |
| 16 | count returned to a remembered one | `The {ring} is back to {k} notes, so its earlier seats were restored.` |
| 17 | the picked note's ring was reset | row 15 or 16 followed by ` The picked note was put down.` |
| 18 | drawer open and the scale stopped parsing | `Layout is paused until the scale parses.` |

Rows 1, 3, 5 and 6 are the keyboard forms; row 4 is the touch and mouse form of row 3. Plate label (static, not the live line): `Pan layout: {a} rim, {b} inner, {c} bottom notes. Arrow keys choose a note.`; each `.panhit` keeps an accessible name `{n}, {ring} seat {s} of {k}` (it replaces today's "position N of M").

## 12. States of every control

The visual system is unchanged: `.mode` (`#211d16` fill, `#433b2c` border, `#c4bcab` text, Nunito Sans 10.5 px / 600, 8 px radius, 44 px min height), `.mode.on` (`#f1ece1` fill, `#272219` text), the plate (`#f1ece1`, ink `#242424` / `#272219`), orange `#E27005`, amber `#e3b25c`, and the existing focus ring `outline: 2px solid #f1ece1; outline-offset: 2px` (the `--ring` allowance of 4 px is already reserved in `.sheetbody`).

| Control | Default | Focus | Active (pressed) | Disabled | Other |
|---|---|---|---|---|---|
| ADJUST LAYOUT | `.mode` | focus ring | `.mode:active` `#2e281e` | opacity .5, not a stop | open: `.on`, `aria-expanded` |
| `ON CENTRE`, `BESIDE CENTRE` | `.mode` | focus ring | as `.mode` | opacity .5 while the scale does not parse | pressed: `.on` + `aria-pressed` |
| MIRROR | `.mode`, off | focus ring | as `.mode` | opacity .5 while the scale does not parse | on: `.on` |
| RESET SEATS | quiet text button (as `#scale-layout-reset` today: no border, `#a79d8b`, 9.5 px caps, 44 px) | focus ring | `#eae6df` text | opacity .5 when all seats are default | none |
| PREVIOUS SEAT, NEXT SEAT | `.mode` | focus ring | `.mode:active` | opacity .5 until a note is picked | none |
| The plate | `#f1ece1`, 1 px `#433b2c` border | `outline: 2px solid #f1ece1; outline-offset: 2px` (existing) | n/a | `.stale` (opacity .62) while the scale does not parse | sticky while open |
| A note, cursor | no mark | solid ink ring `#272219`, 2 px, at 1.2 r | n/a | n/a | n/a |
| A note, picked up | n/a | n/a | n/a | n/a | orange ring `#E27005` (the existing `.pansel`) plus a fill of `rgba(226,112,5,.22)` (the existing `.panhit:active` fill) |
| A seat, valid target | n/a | n/a | n/a | n/a | dashed orange ring `#E27005` at 1.2 r (new `.panseat`, hit layer only) |
| A seat, invalid target (other ring) | n/a | n/a | n/a | n/a | veiled: a `#f1ece1` disc at .55 opacity over the note (new `.panveil`, hit layer only) |
| The ghost (touch and mouse drag) | n/a | n/a | n/a | n/a | disc of the picked note's radius, 1.5 px orange stroke, `rgba(226,112,5,.22)` fill, the note label in ink; 36 px above a touch point, centred on a mouse point |
| `#scale-drawer-status` | `#c4bcab` | n/a | n/a | n/a | refusal: `#e3b25c` |

Everything new (`.panseat`, `.panveil`, the ghost, the cursor) is drawn in the interactive layer only. `pan()` with `interactive` off is byte-identical to today, so no card face changes and there is no second pan renderer.

Disabled never removes a control from the layout, so the drawer does not change height as state changes.

## 13. How the legibility warning and the refusal coexist with the drawer

**Legibility warning (`SMALL_LABELS`).** It stays in `#scale-msg` (amber `.warn`), below the layout zone, exactly as every other warning, live before GENERATE and after. It is never written into the drawer, the status line, `#scale-parse` or `#scale-refusal`, and the drawer's own announcements never touch `#scale-msg`. A drag, an anchor change or MIRROR does not change legibility (sizes depend on counts, not seats), so the warning never needs to react to the drawer. With the drawer open it is below the controls and reached by scrolling; that is accepted because it does not change while the drawer is in use.

**Refusal.** `#scale-refusal` is above the plate and unchanged. If the scale stops parsing while the drawer is open (typing in the field with the drawer open, or the degrees select):
- the drawer stays open, the toggle stays enabled so it can be closed;
- the plate is `.stale` and its hit layer is removed; any pick is put down;
- anchor, MIRROR, RESET SEATS and the step buttons are disabled;
- `#scale-drawer-status` shows row 18;
- every arrangement is HELD, not discarded (section 14), and the controls come back when the scale parses again;
- the refusal sentence is announced by `#scale-refusal`'s own `aria-live`, and if it is off-screen it is brought into view with `scrollIntoView({block: "nearest"})`.

A collision refusal raised by `runGenerate()` (duplicate scale) follows the same scroll rule and leaves the drawer open and every arrangement intact.

## 14. When typed notes change the count of a ring

Arrangements are keyed by the ring's note index, so editing a pitch without changing the count keeps every note in its seat.

- When a VALID parse has a different count for a ring than the previous valid parse, ONLY that ring's arrangement resets to the default. The other rings keep theirs. Status row 15. If the picked note was in that ring it is put down (row 17).
- Typing passes through counts that were never intended (typing a note, deleting it). The sheet therefore remembers, per ring, the arrangement it had at each count it has seen in this sheet session. When a ring returns to a count it has an arrangement for, that arrangement is restored (row 16) [OD 4]. The memory is sheet state only, is not saved, shared or hashed, and is cleared when the sheet opens.
- An invalid parse changes nothing (section 13).
- Counts are compared per ring, so adding a bottom note leaves rim and inner untouched.
- Rings that appear or disappear (inner goes from 0 to 3) start at the default; when a ring goes to 0 or 1 note there is nothing to arrange and its memory is kept.

## 15. Reduced motion

The only motion the drawer adds is the ghost returning to its seat (120 ms). With `prefers-reduced-motion: reduce` (the app already reads this through `reducedMotion`) the ghost disappears at once and nothing animates. The drawer itself never animates (no height transition), the scroll-into-view uses `behavior: "auto"`, and the veil, the dashed rings and the cursor appear instantly under both settings. Pick and drop feedback is carried by rings, veils and the status text, never by motion.

## 16. Owner decisions (2026-10-07)

The six forks this spec raised were put to the owner on 2026-10-07. All six are decided as recommended and are no longer open. The `[OD n]` marks in the text point here. Sign-off of the spec as a whole is separate and follows a design review (line 1).

1. `[OD 1]` PREVIOUS SEAT and NEXT SEAT buttons: "Include them". They are the 44 px no-accuracy path for crowded pans and touch screen-reader users (plan 5.8). Rejected: leaving them out and relying on tap-then-tap and drag alone.
2. `[OD 2]` Touch drag: "Hold 250 ms". A swipe that starts on the plate scrolls the page. Rejected: lift at once with `touch-action: none`, which makes the 300 px plate a scroll trap on a 380 px phone.
3. `[OD 3]` RESET SEATS: "Seats only". Anchor and MIRROR are left alone. Rejected: reset all three.
4. `[OD 4]` Arrangements: "Remember per count", within one sheet session (section 14). Rejected: reset a ring on every count change.
5. `[OD 5]` Form: "Inline disclosure". Rejected: a docked panel over the lower half of the sheet.
6. `[OD 6]` Name: "ADJUST LAYOUT", open or closed.

## 17. What this spec does not do

No change to the card face, to `pan()` with `interactive` off, or to deck data. No second pan renderer. No cross-ring move (the plate, the step buttons and the keyboard can only address one ring, and the data model cannot hold one). No shortened example (the field grows). MIRROR is not renamed. No dependency and no `<script src>`; everything is CSS (`:has`, `position: sticky`, grid) and a few pointer and key handlers in the existing script.

## 18. Notes for the consuming lanes

- W1: a `<textarea>` changes `scaleBox.value` reads nowhere, but `updateParse`, the Enter handler, `restoreScales` prefill and the sandbox stub in `tools/sandbox.js` need to treat it as a textarea. The `input` event is the same.
- DR1: the interactive branch of `paintPan` is keyed to `editingId` today; DR1 re-keys the hit layer to "drawer open" for the plate (Add and Edit), and DR2 owns the pointer logic inside it. `layoutOrder` and `layoutSel` become the seats and the picked field in DR2; DR1 leaves them in place until then.
- DR2: `sizePanHits` gains a ring-mode call (the picked ring's points only, same-ring targets last in the hit layer). `panHitRadii` itself is unchanged.
- The `previewBox` keydown handler today walks the whole pan with wrap; the new map (section 11) replaces it.

## 19. Acceptance list

Each line is one testable statement and is turned into exactly one test by the lane named in brackets. `at 380` means a 380 px wide viewport.

### Field and MIRROR switch

1. [W1] `#scale-box` is a `<textarea>` and `#scale-box-wrap` holds it; the old `<input id="scale-box">` is gone.
2. [W1] At 380, a one-line scale gives a field of one row, and a scale that wraps to three lines gives three rows, with `scrollWidth` equal to `clientWidth` in both.
3. [W1] At 380, with the field empty, the whole placeholder is visible: the textarea's `scrollHeight` is at most its `clientHeight` and it is at most three rows tall.
4. [W1] The placeholder equals the 60-character string of plan section 9, exactly.
5. [W1] Enter in the field calls generate once and leaves the value free of line breaks; Shift+Enter does the same.
6. [W1] Enter while an IME composition is active does not generate.
7. [W1] Pasting text with line breaks leaves the value with those breaks replaced by single spaces.
8. [W1] A value longer than three rows keeps the field at three rows, scrolls inside it and keeps the caret in view after typing at the end.
9. [W1] The first label line is the `<label for="scale-box">` with the plan section 9 text, `#scale-label-2` carries the second line, `aria-describedby` names it, and neither is clipped (`scrollWidth` at most `clientWidth`) at 380.
10. [W1] `#scale-parse` and `#scale-refusal` are never both non-empty: a valid scale fills the first and blanks the second, an invalid one the reverse.
11. [W1] The count line for the D3 example wraps inside the field group at 380 with no sideways scroll.
12. [W1] `#scale-mirror` is one `.mode` button with text `MIRROR`, `aria-pressed="false"` by default, and toggling it changes the preview and the generated deck's `mirror` option.
13. [W1] A deck stored with `mirror: true` opens with `#scale-mirror` pressed.
14. [W1] `SMALL_LABELS` text appears in `#scale-msg` with the `warn` class while the box holds a crowded scale, before GENERATE is pressed.

### Drawer shell, anchor, MIRROR, reset

15. [DR1] `#scale-layout-toggle` exists on the Add sheet and on the Edit sheet, reads `ADJUST LAYOUT`, has `aria-expanded="false"` and an `aria-controls` that names `#scale-drawer`, and `#scale-drawer` is hidden.
16. [DR1] With the box empty or invalid and the drawer closed, the toggle is `disabled`; with a valid scale it is enabled.
17. [DR1] Activating the toggle shows `#scale-drawer`, sets `aria-expanded="true"` and adds `.on`.
18. [DR1] Opening moves focus to `#scale-preview` and does not raise the soft keyboard (the active element is not `#scale-box`).
19. [DR1] Open: `#scale-preview` has `tabindex="0"` and contains `.panhit` elements; closed: it has no `tabindex` and no `.panhit`.
20. [DR1] Activating the toggle again hides the drawer and returns focus to `#scale-layout-toggle`.
21. [DR1] Escape with the drawer open closes the drawer and leaves the sheet open; a second Escape closes the sheet.
22. [DR1] Closing and reopening the sheet, on Add and on Edit, opens it with the drawer closed.
23. [DR1] The Tab order walks BACK, the field, the plate (open only), the toggle, then NOTE 1, MIRROR, RESET SEATS, PREVIOUS SEAT, NEXT SEAT, in that order, skipping disabled controls.
24. [DR1] `#scale-rot-l`, `#scale-rot-r`, `#scale-move-l`, `#scale-move-r`, `#scale-mirror-l` and `#scale-mirror-r` are absent from the markup.
25. [DR1] The drawer holds two anchor buttons with `aria-pressed`, exactly one true, `ON CENTRE` pressed by default and `BESIDE CENTRE` not.
26. [DR1] Pressing `BESIDE CENTRE` re-solves the plate (the rim angles change) and writes `anchor: "between"` into the generated deck options, the stored record and the share link.
27. [DR1] On an Edit sheet for a deck saved with anchor `between`, `BESIDE CENTRE` is pressed on open.
28. [DR1] `#scale-mirror` is inside `#scale-drawer`, keeps its id, and toggling it redraws the plate and reaches the generated deck.
29. [DR1] `#scale-layout-reset` reads `RESET SEATS` and is disabled while every ring is at its default.
30. [DR1] `#scale-layout-state` is visible with the text `Layout changed from the default.` when MIRROR is on or the anchor is `between` (and, from DR2, when any seat differs), and hidden otherwise.
31. [DR1] While the drawer is open and the scale stops parsing, the drawer stays open, the toggle is enabled, anchor, MIRROR, RESET SEATS and both step buttons are disabled, the plate has `.stale`, and `#scale-drawer-status` reads `Layout is paused until the scale parses.`
32. [DR1] After the scale parses again the controls are enabled and the anchor and MIRROR values from before are unchanged.
33. [DR1] A `SMALL_LABELS` warning appears once, inside `#scale-msg`, and nothing inside `#scale-drawer` contains its text, with the drawer open and closed.
34. [DR1] With the drawer open at 380 x 780 the plate stays inside the scrollport when the body is scrolled to its end (it is sticky), and while `#scale-box` has focus the plate is `position: static`.
35. [DR1] With the drawer open at 380 x 667 the open plate is no wider than 42 percent of the viewport height.
36. [DR1] Under a landscape phone viewport (844 x 390) the open drawer lays the plate and the controls in two columns and the plate is at least 150 px wide.
37. [DR1] Every control in the drawer is at least 44 px tall and the drawer has no horizontal overflow at 380.
38. [DR1] Each drawer control shows the existing focus ring (`outline` 2 px `#f1ece1`) when focused by keyboard.
39. [DR1] The drawer and the toggle have no CSS transition or animation.
40. [DR1] The pan drawn with `interactive` off is byte-identical to the shipped output for all five built-in decks.

### Pointer, tap, keyboard, counts

41. [DR2] Dragging a rim note onto another rim note swaps the two entries in the rim permutation and changes nothing else in `seats`.
42. [DR2] The same drag works for the inner ring and for the bottom ring.
43. [DR2] Releasing on the picked note's own seat changes nothing and leaves `seats` equal to its value before the gesture.
44. [DR2] Releasing on a note of another ring changes nothing and writes row 10 to `#scale-drawer-status` in the `warn` colour.
45. [DR2] Releasing on empty plate, on the ding, or outside the plate changes nothing and writes row 11.
46. [DR2] A touch press that moves more than 8 px before 250 ms does not call `preventDefault` on `touchmove` and lifts nothing.
47. [DR2] A touch press held 250 ms within 8 px lifts the note, shows the ghost 36 px above the finger and calls `preventDefault` on subsequent `touchmove`.
48. [DR2] `pointercancel` during a drag restores the pre-gesture state and moves nothing.
49. [DR2] The click that follows a completed drag does not pick or swap anything.
50. [DR2] A mouse press moved less than 4 px is a tap, and 4 px or more starts a drag.
51. [DR2] Tapping a note picks it: exactly one `.pansel` ring exists, same-ring seats carry `.panseat` rings (ring size minus one of them) and notes of the other rings carry `.panveil`.
52. [DR2] Tapping a second note of the same ring swaps the two, releases the pick, and writes row 7.
53. [DR2] Tapping the picked note puts it down and writes row 8.
54. [DR2] Tapping a note of another ring leaves the pick and the arrangement unchanged and writes row 10.
55. [DR2] A note in a ring of one note cannot be picked and the status reads row 2.
56. [DR2] The ding has no `.panhit`.
57. [DR2] With a note picked, `sizePanHits` radii for that ring's targets are each at least the all-points radius of the same target and are pairwise disjoint.
58. [DR2] On the D3 example, Kurd 10 and Pygmy rims, with a 300 px plate and a note picked, every same-ring target is at least 44 px across; where measurement shows a shortfall the test records the value and the lane reports it.
59. [DR2] PREVIOUS SEAT and NEXT SEAT are disabled until a note is picked, and enabled after.
60. [DR2] NEXT SEAT swaps the picked note with the occupant of the next seat in its ring, wraps from the last seat to the first, keeps the note picked and writes row 7.
61. [DR2] PREVIOUS SEAT does the mirror of the previous line.
62. [DR2] On the focused plate, Arrow Right and Arrow Down move the cursor to the next note and write row 1; Arrow Left and Arrow Up go back; Home and End go to the first and last note.
63. [DR2] Space on the plate picks up the cursor note and writes row 3.
64. [DR2] With a note picked, Arrow Right moves the cursor to the next seat of the same ring only, wraps from the last seat to the first, never changes `seats`, and writes row 5 or row 6.
65. [DR2] Space with a note picked and the cursor on another seat swaps the two and writes row 7; with the cursor on the picked note's seat it writes row 8.
66. [DR2] Escape with a note picked leaves `seats` unchanged, writes row 9 and keeps the drawer open.
67. [DR2] Tab away from the plate with a note picked drops it on the cursor seat.
68. [DR2] Closing the drawer with a note picked leaves `seats` unchanged and clears the pick.
69. [DR2] The preview is repainted on each drop and on each step-button press, and the plate shows the new positions.
70. [DR2] The arrangement reaches the generated deck options, the stored record and the share link.
71. [DR2] Toggling MIRROR, then toggling the anchor, leaves every ring's permutation equal to its value before.
72. [DR2] Adding a note to the rim by typing resets only the rim permutation; the inner and bottom permutations are unchanged, and `#scale-drawer-status` reads row 15.
73. [DR2] Returning the rim to its earlier count restores the earlier rim permutation and writes row 16.
74. [DR2] When the picked note's ring is reset by a count change, the pick is cleared and the status ends with `The picked note was put down.`
75. [DR2] An invalid parse leaves every permutation unchanged and a later valid parse with the same counts shows them again.
76. [DR2] `RESET SEATS` returns all three permutations to the default, leaves the anchor and MIRROR unchanged, is then disabled, and writes row 12.
77. [DR2] With `prefers-reduced-motion: reduce`, a refused drop removes the ghost with no transition; without it the ghost returns over 120 ms.
78. [DR2] No drag or key path can produce a `seats` value that `readSeats` refuses, over a sweep of every ring size from 2 to 12 and every seat pair.

### Counts by lane

W1 14, DR1 26, DR2 38 (78 lines in all).
