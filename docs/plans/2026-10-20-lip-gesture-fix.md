# Lip gesture fix: every surface arms, momentum counts (2026-10-20)

Status: DRAFT for /plan-eng-review. Base: lane P head `5caaf6b` (`claude/phone-fixes`, PR #418, HELD, built on `dev`).
Lane branch: `claude/lip-gesture` from `5caaf6b`, so it stacks on #418. Lane P's 5px lip item is NOT part of this plan.
Code is cited by function and marker, never by line number.

## 1. Goal and non-goals

**Goal.** A vertical drag of 24px or more collapses or restores the footer as P3 requires, wherever the finger starts:
a 24px drag up collapses, a 24px drag down restores, the anchor follows the finger, and a touch never restores because the body reached the bottom.
A flick whose momentum carries the body after `touchend` counts too.
Nothing a user does to focus a field, type in it, select text in it, or tap a field, the pan or the lip gets worse.

**Non-goals.**
- No change to `LIP_PX` 24, `LIP_SWIPE` 16, `LIP_WINDOW` 150, `LIP_END_MS` 220, or the 180ms slide.
- No change to the lip height. The 5px lip is a separate lane P item.
- No change to keyboard detection (`kb`, `kbBase`, `kbCap`, `kbOffset`, thresholds), to A9, or to the `#scale-guidance` rules.
- No change to engine, data, share/route/record, About, settings, card or `#import-row`.
- No rAF, no ResizeObserver, no non-passive touch listener, and no `touch-action` change on fields. The CSS comment above `main{` records that a permanent non-passive touchstart regressed a held-drag test, so every listener added here is `{ passive: true }`.
- Wheel and keyboard scrolling keep the lane L scroll rule exactly as it is: `M - t > E` to collapse, and the bottom restore.

## 2. Context and evidence

### 2.1 Source

The evidence is the owner's iPhone (iOS 26.6, UA CriOS) on Lip Lab build `lipdebug-8693a46`, from the raw batches in `SCRATCH/lipdb/lip/*.json`.
I re-tallied them independently (`SCRATCH/tally.py`), deduping by (session, t, type):
- session `6rlxwmzm`: 390x629 portrait and 750x294 landscape;
- session `7nvja2di`: 390x797 portrait, with one 390x727 batch;
- one 1280 session with a single event, which I ignored.

### 2.2 Reproduced tally (agrees with the brief)

Drags whose vertical travel was 24px or more:

| intent | acted | missed | misses on armed targets | misses on excluded targets |
|---|---|---|---|---|
| collapse (finger up) | 23 | 9 | 0 | 9 |
| restore (finger down) | 19 | 12 | 0 | 12 |
| **total** | 42 | **21** | **0** | **21** |

Gestures where the sheet was already in the target state were not counted as misses (8 collapse, 9 restore).
No act ever happened after `touchend`.

Misses by start target:

| start target | misses (session, viewport, t) |
|---|---|
| `input#scale-bottom` | 6rlxwmzm 390x629 t6790, t9985, t21695; 750x294 t101635, t103766, **t109947** |
| `input#scale-top` | t36688, **t116083** |
| `input#scale-inner` | t38567 |
| `input#scale-ding` | t102672 |
| plate (`svg`, `circle`) | t16379, t40853; 7nvja2di t19995, t21740 |
| `div#scale-preview.stale.example` | t41147 |
| `textarea#scale-box.passive` | t57597; 7nvja2di 390x797 t8501, t10064, t13446, t14610, t26806 |

Breakdown by surface: 10 on inputs, 5 on the plate or `#scale-preview`, and 6 on the textarea.

**Reported disagreement 1: t116083.** The brief says "list scrolled to 306". In the log, the body was at 0 at `touchstart` and at 93 at `touchend`. The 306 figure is only plausible as the end of the momentum that followed, and the log does not record that, because every `lipScroll` in that tail was suppressed. The defect is the same either way. The e2e replay uses the logged finger travel (+132) and asserts on the state change, not on 306.

**Reported disagreement 2: the textarea misses on 7nvja2di (390x797).** In these five, the body did not scroll at all: `scrollTop` stayed 0→0 and no scroll events fired. The Scale tab's range there is under the footer (`M < E`), so the drag moved only the finger. P3 says a 24px finger drag acts "even when the content cannot scroll", so these are real misses under P3. They also show that the fix cannot be "act only when bandPort scrolled" (see 4.2).

### 2.3 Defect 2: the scroll fallback is dead on iOS

- Every one of the 1535 `lipScroll` calls returned at `now > userWindowUntil` ("no-user-window").
- `scrollSuppressed` reasons: `dragEnd` 1166, `drag` 243, `touching` 126.
- The cause: `lipScrollEvent` re-arms `lipDragEnd = now + LIP_END_MS` on every scroll that lands inside the post-touch window, and it zeroes `userWindowUntil` and `lipAcc`.
- iOS momentum frames arrive about 33ms apart, with a maximum gap of about 140ms. Each one extends the 220ms window, so suppression chains through the whole flick (up to 1.3s and 482px observed) and never counts any of it.

That chaining was deliberate in P3: "a touch can never outlive its finger", and momentum must never trigger the scroll rule's bottom restore (E12). The repair keeps that intent, so there is still no bottom restore from touch. It makes the momentum count toward the finger's own direction instead of counting for nothing.

### 2.4 Why there are exactly two defects

- **Defect 1.** `lipExcluded` disarms every start on `#scale-preview`, `input`, `textarea` and `select`. Those are most of the sheet's area on a phone: four inputs, the seed box and the plate.
- **Defect 2.** Momentum is discarded (2.3).

There were zero misses on armed targets, so the finger rule itself (threshold, direction, anchor) is sound and is not changed.

## 3. Exclusion audit

Sources:
- `git log -S'#scale-preview, input, textarea' -- index.html` points to `6d37d16` (lane P, P3).
- `docs/plans/2026-10-20-phone-fixes.md` P3 ("Excluded starts: #scale-lip (its own swipe), #scale-preview (note drags), input/textarea/select, and any multi-touch").
- The P3 review-fix test "PH: P3 every touch suspends the scroll path, an excluded start or a second finger included…".

| selector | original reason and source | proposed rule | risk |
|---|---|---|---|
| `#scale-lip` | Its own recogniser: a 16px swipe up and a tap or click both restore. If the body gesture also armed there, one gesture would act twice. Source: P3 text "its own swipe"; mutant `ph_lip_drag_*` set. | **Keep excluded.** | None; unchanged. |
| `#scale-preview` (svg, circle, `.panhit`, hint) | Note drags. After `HOLD_MS` (250) inside `HOLD_SLOP` (8), the plate lifts a note and `plateTouchMove` (non-passive, Layout tab only) calls `preventDefault`. A lip act during a note drag would slide the footer under the dragged note. Source: P3 "(note drags)"; mutant `ph_lip_drag_preview_not_excluded`. | **Arm, with a note-drag veto.** The gesture never acts while `press` is in a lifted or dragging state (`press.state` `"held"` or `"drag"`). A gesture that travelled more than 8px before 250ms is `press.state === "scroll"` (or `press` is null after `pointercancel`), and it acts. | A lift starting after the lip has already acted in this gesture: impossible, because a lift needs travel under 8px and an act needs 24px. A veto that reads `press` from another block: `press` is a top-level `let` in the same script, read only inside handlers after boot (no TDZ), but the reviewer must confirm the scope. |
| `input` | No reason stated in P3. Inferred: the tap-focus path (`tapSnap`, `scrollPin`, `revealField`) and caret placement must not be disturbed. The 8px tap tolerance in the scroll-pin block already separates a tap from a drag. | **Arm unless the input is the focused element** (`document.activeElement === target's field`). An unfocused input receives no focus from a drag in either browser (F2). Add a hold guard: if the finger stays within 8px for `HOLD_MS` before travelling, disarm for the rest of the gesture (loupe or selection intent). | iOS rubber-banding during a drag from an input: the finger rule does not depend on the body scrolling, so this is harmless. Tap-snap: unaffected, because `dropTap` already fires at 8px, before any act at 24px. |
| `textarea` (`#scale-box`) | As `input`, plus internal scroll. Owner D3 (a): the box is three lines tall at most and scrolls inside itself. | **Arm unless focused**, plus a **scroll-owner veto**: if `#scale-box.scrollTop` changes during the gesture, the gesture belongs to the textarea, and it stays disarmed for the rest of the gesture (latch). At the textarea's scroll edge the box does not move, so the finger rule applies. | Chrome's scroll chaining at the edge moves the body. That is a normal body drag and should act. iOS may rubber-band the textarea at its edge without changing `scrollTop`, so the gesture acts; the owner's device retest covers this. |
| `select` | No reason stated in P3. Inferred: a tap opens the native picker. The sheet contains no `<select>`; the only one is `#print-paper-select` in settings, outside `sheet`. | **Keep excluded.** It costs nothing and is future-proof. | None. |
| multi-touch | Pinch zoom and two-finger gestures are not a footer gesture. Source: P3. | **Keep excluded.** | None; unchanged. |

**Owner-gate item.** Arming inputs, the textarea and the plate reverses P3's "Excluded starts" sentence. This plan treats that as an **amendment of an owner decision** that needs explicit owner sign-off (question Q1). Until then, the lane does not start.

## 4. Design

The changes are all in the `/* ---- the footer lip ----` block of `index.html`. The `HOLD_MS` constant and the `press` variable are read, never written, from the plate drag block. Nothing outside the lip block is edited.

### 4.1 Arming rule (replaces `lipExcluded` and the `lipDrag` record)

```
// was: closest("#scale-lip, #scale-preview, input, textarea, select")
const lipNeverArms = (t) => !!(t && t.closest && t.closest("#scale-lip, select"));
const lipFocusedField = (t) => {
  const a = document.activeElement;
  return !!(a && a.matches && a.matches("input, textarea") && t && t.closest && a.contains(t));
};

// lip touchstart (capture, passive), unchanged except for the lipDrag record:
lipDrag = ts.length === 1 && !lipNeverArms(tg) && !lipFocusedField(tg)
  ? { id, x, y, dir: 0,
      t0: Date.now(), moved: false,              // hold guard
      box: tg.closest("#scale-box"),             // scroll-owner veto
      boxTop: box ? box.scrollTop : 0,
      plate: !!tg.closest("#scale-preview"),     // note-drag veto
      bodyTop0: bandPort.scrollTop,              // fling seed (4.3)
      acted: { up: false, down: false } }        // one act per direction
  : null;
```

Changes to the lip `touchmove` (capture, passive):

```
if (!L || p.identifier !== L.id) return;                    // unchanged
if (!L.moved) {
  if (hypot(p.x - L.x, p.y - L.y) <= 8) {                   // still a tap or hold
    if (Date.now() - L.t0 >= HOLD_MS) { lipDrag = null; return; }   // hold guard: loupe or select intent
    return;
  }
  L.moved = true;
}
if (L.box && L.box.scrollTop !== L.boxTop) { lipDrag = null; return; }   // F4 latch
if (L.plate && press && (press.state === "held" || press.state === "drag")) { lipDrag = null; return; }  // F7
// ...existing anchor-follow, |dy| >= LIP_PX, |dy| > |dx|, suspension (sheetOpen, kbup, lipQuiet) unchanged...
// on an act:
const way = dy > 0 ? "up" : "down";
if (L.acted[way]) { move the anchor; return; }    // one act per direction per gesture (already implied by anchor+state; made explicit)
act; L.acted[way] = true; L.lastWay = way;
```

The 8px figure is the existing tap tolerance in the scroll-pin block (`dropTap` fires above 8px). The plan reuses the same literal and does not add a constant. The reviewer checks that both agree.

`lipDragStop` (touchend/touchcancel) hands the record to the fling (4.3) instead of dropping it. Its behaviour is otherwise unchanged: the `lipTouching` recount, the target-attached `once` listeners, and `lipTouchClear` on wheel and keydown.

### 4.2 Scroll-owner rule

The two surfaces need different tests of whether the gesture counts.

- **Finger phase** (between touchstart and touchend). The finger rule acts on finger travel, as P3 requires, so it acts "even when the content cannot scroll". The 7nvja2di textarea misses (body 0→0) are fixed by this. The one surface that owns its own scroll, `#scale-box`, is vetoed by the change in its `scrollTop` (4.1). Requiring a bandPort scroll would leave those misses unfixed.
- **Fling phase** (after touchend). Only `bandPort` scroll events count, so the body really is the scroll owner by construction. Momentum inside `#scale-box` fires scroll on the textarea, not on bandPort. A gesture vetoed by the textarea latch hands no fling.

### 4.3 Scroll-path change: the fling record

Old (P3):

```
function lipScrollEvent() {
  if (lipDrag || lipTouching || now < lipDragEnd) { if (!lipDrag) lipDragEnd = now + LIP_END_MS; userWindowUntil = 0; lipAcc = 0; }
  lipScroll();
}
```

New:

```
let lipFling = null;   // { way, acted, acc, prevT, prevM, until }

// lipDragStop, when the ending touch is lipDrag's touch:
if (L && L.moved && !(L.box && L.box.scrollTop !== L.boxTop)) {
  const way = L.lastMoveWay;                   // sign of the last finger movement >= 1px, "up" | "down"
  const t = clamp(bandPort.scrollTop), M = range();
  const seed = way === "up" ? max(0, t - L.bodyTop0) : max(0, L.bodyTop0 - t);
  lipFling = { way, acted: L.acted, acc: seed, prevT: t, prevM: M, until: now + LIP_END_MS };
}

function lipFlingStep(now) {            // called from lipScrollEvent while lipFling is live
  const F = lipFling, t = clamp(bandPort.scrollTop), M = range();
  F.until = now + LIP_END_MS;           // momentum keeps the window alive (same chain as P3)
  if (M !== F.prevM) { F.prevM = M; F.prevT = t; return; }        // a range change re-baselines
  const d = t - F.prevT; F.prevT = t;
  const s = F.way === "up" ? d : -d;
  if (s <= 0) return;                   // the opposite sign never counts (a collapse clamp lands here)
  F.acc += s;
  if (!sheetOpen || kbup || now < lipQuietUntil) return;
  if (F.acc >= LIP_PX && !F.acted[F.way]) {
    if (F.way === "up" && !isLipShut()) collapseLip();
    else if (F.way === "down" && isLipShut()) restoreLip();
    F.acted[F.way] = true;              // acted or already in state: either way this direction is spent
  }
}

function lipScrollEvent() {
  const now = Date.now();
  if (lipFling && now >= lipFling.until) lipFling = null;
  if (lipDrag || lipTouching) { userWindowUntil = 0; lipAcc = 0; lipScroll(); return; }   // finger down: unchanged
  if (lipFling) { userWindowUntil = 0; lipAcc = 0; lipFlingStep(now); lipScroll(); return; }
  if (now < lipDragEnd) { lipDragEnd = now + LIP_END_MS; userWindowUntil = 0; lipAcc = 0; }  // untracked touch: unchanged P3 suspension
  lipScroll();
}
```

How this connects to the existing code:
- `lipScroll` is unchanged, and so is its `lipPrev` bookkeeping, which keeps the wheel path's baseline current. Each suspended call still returns at "no-user-window" because `userWindowUntil` is 0.
- `lipDragStop` still sets `lipDragEnd` for every touchend, so untracked touches (excluded starts, multi-touch, vetoed gestures) keep P3's full suspension.
- `lipTouchClear` (wheel, keydown) also sets `lipFling = null`, so a wheel or key takes over cleanly.
- `L.lastMoveWay` is updated in touchmove from each move of 1px or more. A flick reverses only if the finger reversed last.

**Seed.** The fling's `acc` starts at the body's own displacement during the finger phase, in the fling direction. A 20px finger drag that moved the body 20px, followed by momentum, reaches 24px after 4px of momentum. Without the seed, a short flick would need 24px of momentum on top of the finger. This is question Q3.

### 4.4 Proofs

**One act per direction per gesture (no double count).**
- `L.acted` is shared by reference between the finger phase and the fling.
- A touchmove act sets `acted[way]`. Its own scroll, and that scroll's momentum, then reach `lipFlingStep`, which tests `!F.acted[F.way]`, so the act cannot repeat.
- A gesture can still reverse: up then down, once each, as P3 allows, and only if the finger reversed last.

**No oscillation.** The lane L proof for the wheel path is unchanged, because `lipScroll` is unchanged, and it still holds for wheel and keys:
1. a scroll collapse never clamps, because `M - t > E`;
2. a restore never clamps;
3. `acc` resets after an act;
4. an end restore cannot be followed by a collapse, because Δ < E.

For the fling path:
1. **The fling acts only in the finger's direction, at most once.** `F.way` is fixed at touchend, and `F.acted[F.way]` makes the act single. One act cannot flip-flop.
2. **A collapse may clamp.** The fling, like P3's finger rule, collapses without `M - t > E`, because P3 overrides that for touch. When the footer collapses, `clientHeight` grows and `M` shrinks; if `t > M'`, the browser clamps `scrollTop` down. That event has `M !== prevM`, so it re-baselines, and even if the range were equal the clamp's `d` is negative against `way = "up"` and is ignored. Nothing in the fling path can restore off a clamp: a restore needs `way = "down"`, which is fixed at touchend.
3. **A restore never clamps.** Restoring shrinks `clientHeight` and grows `M`; `t` stays valid.
4. **No bottom restore from touch.** `lipFlingStep` has no `t >= M - 1` branch, so E12 holds. `lipScroll` still has that branch, but `userWindowUntil` is 0 while the fling is live.
5. **After the window ends, nothing counts.** `lipFling` drops once `until` passes. Programmatic scrolls go through `lipQuiet()`: `holdPin`, `revealField`, `applyKbOffset` and `setTab`'s scrollTop reset are all quieted, and `lipScroll` needs a user window. So A5 ("a programmatic scroll never acts") still holds.
6. **Momentum chains with no gap.** Frames arrive at most about 140ms apart (observed) against the 220ms `LIP_END_MS`, so the window never ends mid-flick. If it does end on a stalled flick, the result is a missed fling act, never a wrong one.

### 4.5 F1-F9: mechanism and proof

| item | mechanism | proving test(s) (section 5) |
|---|---|---|
| F1 tap on a field | A tap travels under 8px, so `L.moved` stays false and no act can happen (an act needs 24px). The tap-snap/scroll-pin block is not edited; its `pointerdown` and `touchstart` captures run first and the lip listener does not change `tapSnap`, `scrollPin` or focus. `lipFling` is created only when `L.moved` is true. | T1, T2, e2e R5 |
| F2 drag from an unfocused field | **Chrome:** a touch that becomes a scroll sends `pointercancel`, and no click or focus follows. **iOS Safari/WebKit (CriOS uses WebKit):** focus comes from the synthesized click at touchend, which iOS cancels when the touch scrolled or panned; the field is not focused. In the 7nvja2di textarea case (body did not scroll), iOS treats travel beyond its tap slop (about 10px) as a non-tap and sends no click either. The lip code itself never calls `focus()` on a field. | T3 (sandbox, act only); e2e R1-R4 assert `document.activeElement` is unchanged and no `click` and no `focusin` reached the field; **iOS**: the Lip Lab rebuild logs `focusin`/`click` per gesture (section 8), and the device script step D3 checks it. |
| F3 drag inside the focused field | `lipFocusedField` disarms any start whose target is inside `document.activeElement`. When the keyboard is up (`kbup`), the touchmove and fling paths are suspended anyway. The exclusion also covers a hardware keyboard or iPad, where `kbup` is false but the field is focused and caret drags are common. The lip code never calls `blur()`. | T4, T5, e2e R6 |
| F4 textarea scrolls itself | Scroll-owner latch: any change of `#scale-box.scrollTop` during the gesture disarms it and hands no fling. At the edge, the box does not move; Chrome chains the scroll to the body and the finger rule acts. | T6, T7, e2e R7 |
| F5 keyboard | `kbup` suspends both paths, as before (`lipFlingStep` checks it). `lipKbEdge`, `applyKbOffset` and A9 are not touched. Moving focus between fields fires `focusin` with no touch travel, so nothing arms. | Existing A9 and kb-down tests stay green; T8, T9 |
| F6 lip focus | `#scale-lip`'s own handlers and `lipFocusing` are not touched. `#scale-lip` stays in `lipNeverArms`. | Existing A11 and the lipFocusing test stay green; T10 |
| F7 pan preview | The plate's tap path (`previewBox` click to `activateNote` when `drawerOpen`, guarded by `suppressClick`) is not edited. A drag over 8px before 250ms sets `press.state = "scroll"`, so there is no lift and no `activateNote`; the lip acts at 24px. A held press (lifted note) is vetoed by `press.state`. **The repo has no "tap opens ADJUST LAYOUT" at this base:** tabs superseded the drawer (sheet-tabs plan 3.7), and `#scale-preview` exists only in `#scale-panel-layout`. The "drawer" is the Layout tab itself, so there is one pan and one set of lip listeners. F7 is therefore read as: a tap selects or opens the note as today, and a drag opens nothing. | T11, T12, T13, e2e R3/R4, the existing note-drag e2e tests |
| F8 select | Stays in `lipNeverArms`. The sheet has no `<select>`. | T14 (static: no `select` in `#scale-sheet`, and `lipNeverArms` matches `select`) |
| F9 no click after a drag | A drag of 24px or more is a scroll or pan gesture in both browsers, so neither synthesizes a click. The lip never calls `click()` or `focus()`. The footer's 180ms slide moves the footer only; fields under the finger do not move during the finger phase (the body's layout box changes height, and the field the finger is on stays under it). | e2e R1-R4: zero `click` events on any field after a drag; e2e R8 drags across a field boundary while the footer slides |

## 5. Test plan (TDD: every new test is written red against `5caaf6b` first)

Prefix: **"LG:"**. Sandbox tests go in `tests/app.test.js` with the existing helpers (`lipApp`, `shortApp`, `finger`, `drag`, `scrollTo`, `isShut`, `hit`). Real-Chrome tests go in `tests/e2e.test.js`, using CDP `Input.dispatchTouchEvent` through the existing `finger2`/`pull` helpers. The LG describe sits beside the existing PH: P3 tests.

### 5.1 Sandbox (`tests/app.test.js`)

| id | title | asserts |
|---|---|---|
| T1 | `LG: a tap on each field (travel 6px) arms nothing, acts on nothing and leaves tapSnap and scrollPin as P3 left them` | For each of `#scale-ding`, `#scale-top`, `#scale-inner`, `#scale-bottom` and `#scale-box`: after touchstart, a 6px move and touchend, the lip state is unchanged, there is no fling, and the tap-snap state equals the same tap's state at `5caaf6b` (recorded fixture values). |
| T2 | `LG: a stationary press on an unfocused field for HOLD_MS then a 60px drag does not act` | Hold guard. |
| T3 | `LG: a 24px finger-up drag from each unfocused field collapses and a 24px finger-down drag restores; 23px does neither` | Defect 1, for each input and `#scale-box`, on `shortApp` (range under the footer) and `lipApp`. |
| T4 | `LG: a drag inside the focused field never acts, kb down included` | Set `activeElement` to the field; drag ±60px; state unchanged; `blur` never called. |
| T5 | `LG: a drag that starts on another, unfocused field while one is focused acts` | Only the focused one is excluded. |
| T6 | `LG: a drag that scrolls #scale-box's own content never acts, in the finger phase or its fling` | The stubbed `scrollTop` of `#scale-box` changes at the first move. |
| T7 | `LG: a drag from #scale-box at its scroll edge, where its scrollTop does not change, acts` | Edge rule. |
| T8 | `LG: while kbup a drag from any surface and its fling do nothing` | F5. |
| T9 | `LG: focus moving field to field with kbup does not change the lip` | F5. |
| T10 | `LG: a touch on #scale-lip arms no body drag: its 16px swipe restores once and nothing else acts` | F6 and double count. |
| T11 | `LG: a 60px drag from the plate on the Layout tab collapses and activates no note` | F7; `activateNote` spy count is 0. |
| T12 | `LG: a plate press held HOLD_MS (press.state held) then dragged 60px never acts` | F7 note-drag veto. |
| T13 | `LG: a tap on a plate .panhit with the Layout tab open still activates the note and acts on nothing` | F7 tap. |
| T14 | `LG: lipNeverArms matches #scale-lip and select, and #scale-sheet holds no select` | F8. |
| T15 | `LG: momentum after touchend in the finger's direction collapses once it reaches 24px with the seed` | Defect 2. Finger moves the body 10px, then `scrollTo` steps of 5px at 33ms after touchend. The collapse happens at the step where 10 + momentum ≥ 24, and exactly once. |
| T16 | `LG: momentum after a finger-down drag restores a shut footer` | Defect 2, the restore half. |
| T17 | `LG: a touchmove act and its own momentum act once: one collapse across the gesture and a 482px tail` | No double count. |
| T18 | `LG: a fling's opposite-sign scroll (the collapse clamp) never restores` | After a collapse, a `scrollTo` back by the clamp (`t > M'`) gives no restore. |
| T19 | `LG: a fling never restores on reaching the bottom` | E12, kept for the fling path. |
| T20 | `LG: the fling ends LIP_END_MS after the last scroll and a later programmatic scroll does nothing` | A5 holds; gap of 230ms. |
| T21 | `LG: a 140ms gap between momentum frames keeps the fling alive` | The observed maximum gap. |
| T22 | `LG: wheel and keyboard scrolling are unchanged: the scroll rule M - t > E and the bottom restore` | Rerun of the lane L scroll-rule cases against the new `lipScrollEvent`, with `lipFling` null. |
| T23 | `LG: an untracked touch (second finger, #scale-lip start, vetoed gesture) keeps the full P3 suspension through its momentum` | P3 review fix, kept for what stays excluded. |
| T24 | `LG: a wheel or key during a fling ends the fling` | `lipTouchClear` path. |

### 5.2 Real Chrome (`tests/e2e.test.js`)

| id | title | asserts |
|---|---|---|
| R1 | `LG: replay t109947 at 750x294 and 390x629: a -156px finger-down drag that starts on #scale-bottom while shut restores, focuses nothing and clicks nothing` | Shut the footer by wheel; scroll the body to the logged 258 (clamped to the range); drag from the `#scale-bottom` centre +156px down over 6 steps in 90ms. `__lip` records exactly one restore, `activeElement` is unchanged, and zero `click`/`focusin` reached any field. |
| R2 | `LG: replay t116083 at 390x629 and 750x294: a +132px finger-up drag that starts on #scale-top while open collapses, focuses nothing and clicks nothing` | Same shape; the footer starts open with body at 0; exactly one collapse. |
| R3 | `LG: a 60px drag from the plate on the Layout tab collapses once and activates no note, at 390x797 and 380x780` | Replaces the plate half of the superseded P3 test (5.3). |
| R4 | `LG: a 60px drag from #scale-box with no overflow acts once and leaves focus where it was, at 390x797 and 380x780` | Replaces the seed-box half; covers the 7nvja2di case (body 0→0). |
| R5 | `LG: a real tap on each field focuses it, the pin holds it in view, and the lip does not change` | F1 in Chrome. |
| R6 | `LG: a drag in the focused #scale-box (selection) never acts and never blurs` | F3. |
| R7 | `LG: with #scale-box overflowing, a drag that scrolls its content does not act; a drag past its edge acts` | F4. The box is filled to 8 lines. |
| R8 | `LG: a flick whose momentum carries the body collapses once, and its settle adds no flip, at 390x797` | Defect 2 in Chrome (Chrome's synthetic momentum on `Input.dispatchTouchEvent` is weak, so the test asserts "once" and "no extra flip", not that momentum alone crossed 24). |

### 5.3 Existing tests

**Unchanged and green.** All A1-A19, E1-E12, LP and UX lip tests, and every PH: P3 test not listed below:
- "24px … 23px …";
- "repeated drags …";
- "a long press on a plate field … wheel or ArrowDown … collapses exactly once" (the long press is a lift, which is vetoed, and the wheel path is unchanged);
- "a wheel on a sheet with no room …";
- "UX: a touch flick to the end collapses once and stays collapsed" (the fling acts at most once and never bottom-restores, so this stays green).

**Assertions that must change.** Each one asserted the exclusion that Q1 asks the owner to supersede. None is weakened: each half is either kept or replaced by a stronger positive assertion of the new rule.

| test | file | change | why it is not a weakening |
|---|---|---|---|
| `PH: P3 every touch suspends the scroll path, an excluded start or a second finger included: no collapse, no restore, and momentum keeps extending the window` | app | The second-finger and `#scale-lip` cases are kept verbatim. The plate and field cases move to T3/T11 (they now act). The momentum clause is **narrowed to untracked touches** and kept for them (T23). Tracked momentum is asserted by T15-T17. | Every case gets an exact expected count: either still 0 or now exactly 1. |
| `PH: P3 starts on the lip, the plate, a field or with a second finger do not collapse; the keyboard does not either` | app | The loop over `#scale-lip`, `#scale-preview`, `input`, `textarea`, `select` keeps `#scale-lip`, `select` and the second finger. `#scale-preview`, `input` and `textarea` move to T3/T11 as exact-one-act assertions. The keyboard clause is kept. | Same. |
| `PH: P3 a drag that starts on a field, on the plate or with a second finger changes the lip zero times across the gesture and its settle, at 390x797 and 380x780` | e2e | The second-finger and sideways halves are kept. The seed-box and plate halves become R4/R3 (exactly one change, no note activation, no focus change). | The new halves assert more: an exact count plus focus and note checks. |
| `PH: P3 a drag that scrolls the body to its end neither restores nor collapses again, momentum included` | app | Unchanged. Listed only because T19 extends it to the fling. | Not changed. |

## 6. Mutants (`tests/mutants/`)

The patches are made with `git diff`, with the `index a..b` lines stripped. `# suite:` patterns use `.` wildcards (no quotes, no spaces).

| mutant | mutation | killed by (`# suite:`) |
|---|---|---|
| `lg_field_start_excluded_again` | `lipNeverArms` gains `input, textarea` | `LG:.a.24px.finger-up.drag.from.each.unfocused.field` (T3) |
| `lg_plate_start_excluded_again` | `lipNeverArms` gains `#scale-preview` | `LG:.a.60px.drag.from.the.plate` (T11) |
| `lg_focused_field_armed` | `lipFocusedField` returns false | `LG:.a.drag.inside.the.focused.field` (T4) |
| `lg_hold_counts_as_drag` | the hold-guard `return`s are removed | `LG:.a.stationary.press` (T2) |
| `lg_textarea_scroll_counts` | the `L.box` latch is removed | `LG:.a.drag.that.scrolls..scale-box` (T6) |
| `lg_plate_lift_acts` | the `press.state` veto is removed | `LG:.a.plate.press.held` (T12) |
| `lg_fling_dropped` | `lipDragStop` creates no `lipFling` (the defect) | `LG:.momentum.after.touchend` (T15) |
| `lg_fling_no_seed` | `seed = 0` | `LG:.momentum.after.touchend` (T15, the exact step) |
| `lg_fling_rearms_forever` | `lipFlingStep` never lets the fling expire (`until = Infinity`) | `LG:.the.fling.ends` (T20) |
| `lg_fling_opposite_sign_counts` | `if (s <= 0) return;` becomes `F.acc += Math.abs(d)` and both directions act | `LG:.a.fling.s.opposite-sign` (T18) |
| `lg_fling_double_act` | `F.acted[F.way]` is not checked | `LG:.a.touchmove.act.and.its.own.momentum` (T17) |
| `lg_fling_bottom_restore` | `lipFlingStep` gains `if (isLipShut() && t >= M - 1) restoreLip()` | `LG:.a.fling.never.restores.on.reaching` (T19) |
| `lg_fling_ignores_kbup` | the `kbup` check is removed | `LG:.while.kbup` (T8) |
| `lg_untracked_not_suspended` | the untracked `lipDragEnd` branch is removed | `LG:.an.untracked.touch` (T23) |

**Existing mutants that change.**
- `ph_lip_drag_preview_not_excluded`: its premise (removing `#scale-preview` from the exclusion) is now the shipped behaviour. **Retire it**; `lg_plate_start_excluded_again` and `lg_plate_lift_acts` take over its job.
- `ph_lip_excluded_touch_not_suspended`: **re-anchor** it to the untracked-touch branch, with suite T23.
- The other six `ph_lip_*` patches: re-anchor them if the hunk drifts, and `apply --check` all of them.

Memory rules: `mutation_check.sh` restores the tree, so do not edit while it runs. FLOORS rows and the README mutant count are set from CI's run artifacts (`by_module`/`files[].total`), not from a local count. The lane owns `tests/mutants/`.

## 7. Lane

One lane, **LG**. It does not split along file ownership: the code and both test files move together.

- **Branch / worktree:** `claude/lip-gesture`, from `5caaf6b`, in its own worktree.
- **Ownership:**
  - `index.html`, the lip block only, from `/* ---- the footer lip ----` through the `footSlide` transitionend listener;
  - `tests/app.test.js`, the new LG describe plus the three P3 tests named in 5.3;
  - `tests/e2e.test.js`, R1-R8 plus the one P3 test named in 5.3;
  - `tests/mutants/lg_*.patch` plus the two `ph_lip_*` changes in section 6;
  - the FLOORS/README mutant count, if CI moves it.
  - Nothing else. In particular, not the scroll-pin block, the plate drag block (`press` and `HOLD_MS` are read only), `applyKbOffset`, CSS or markup.
- **Acceptance criteria:**
  1. T1-T24 and R1-R8 are green, and each was red at `5caaf6b` where it asserts new behaviour (the lane report lists which ones were red first).
  2. Every A1-A19, E1-E12, LP, UX and PH lip test not listed in 5.3 is green **unchanged** (`git diff 5caaf6b -- tests/` touches only the LG blocks and the 5.3 tests).
  3. The new mutants are killed and the existing mutants are still killed.
  4. There is no new non-passive listener and no rAF or ResizeObserver: `git diff 5caaf6b -- index.html | grep -E 'passive: false|requestAnimationFrame|ResizeObserver'` is empty.
  5. The non-goal constants are byte-identical.
- **Verify:**
  - `python3 tools/sync_decks.py --check && python3 tools/inline_engine.py --check && node --test tests/app.test.js && python3 tools/validate.py`
  - targeted e2e with `CHROME_BIN` set: `node --test --test-name-pattern 'LG:|PH: P3|UX: a (real )?touch|lip' tests/e2e.test.js`
  - Full e2e only in CI (memory: the full suite starves the local browser).
- **Merge gates:**
  1. CI `validate` concludes success at the head SHA, verified against the local tip (`gh pr view --json headRefOid`, re-queried once after the push) and read from `gh run list --commit <sha> --workflow validate.yml`, never from check buckets.
  2. A fresh independent reviewer subagent at that SHA, briefed with this plan's goal, non-goals, ownership and acceptance criteria, quoted verbatim. It returns PASS or PASS_WITH_NITS.
  3. PR D merges to `dev` only.
  4. **Owner retest on DEV** (section 8) with a Lip Lab rebuilt from the lane head, BEFORE any main merge. PR M to `main` stays open; **main merges are owner-gated** (memory: dev first, never merge to main).
  5. Lane P's #418 must merge to `main` first or together. PR M targets `main` with `5caaf6b` beneath it, so the order is part of the owner gate.

## 8. Device verification (owner, iPhone)

**Build.** Rebuild the Lip Lab from the lane head by the same method as `$SCRATCH/liplab/lip-lab.html`:
- start from `index.html` at the lane head SHA;
- inject the same logging shim (touchstart/touchmove/touchend, collapse/restore, lipScroll, scrollSuppressed, with target, armed, shut, tab, dyTotal, ms);
- add three event types: `fling` (created/acted/expired), `focusin`, and `click`, each with its target;
- stamp the build id `lipgesture-<sha7>`;
- publish it to DEV the same way the previous build was published.

**Script** (portrait first, then rotate to landscape and repeat; Add sheet and then Edit sheet):
1. **D1 Fields.** Five drags of at least 24px starting on each of DING, TOP, INNER and BOTTOM, and on the text box: three up from open, then three down from shut. Each must change the footer once.
2. **D2 Pan.** On the Layout tab, three drags up and three down starting on the plate, between fields and on a field circle. Each acts and no note opens.
3. **D3 Focus.** After every drag in D1, check that no field gained a caret and the keyboard did not rise (the log shows no `focusin`/`click` on a field).
4. **D4 Flicks.** Short quick flicks, about 1cm, from the body, from a field and from the plate. The footer changes once, in the flick's direction, and never flips back.
5. **D5 Tap.** Tap each field: the keyboard rises, the field stays in view, and the footer does what A9 does today (it collapses with the keyboard). Close the keyboard: it restores as today.
6. **D6 Caret and selection.** With the keyboard up, drag the caret inside the text box, long-press for the loupe, and drag-select. Nothing blurs and the footer does not change. Repeat with the keyboard dismissed but the field still focused.
7. **D7 Field to field.** With the keyboard up, tap from DING to TOP to INNER to BOTTOM. The footer does not toggle.
8. **D8 Overflow.** Type eight lines into the text box. Drags inside it scroll its text and do not act. Keep dragging past its end: report what happened, since edge chaining on iOS is expected to act.
9. **D9 Lip.** Tap the lip and swipe it up 16px: each restores once.
10. **D10 Plate tap.** Tap a note on the Layout tab: it acts as today.

**Pass bar.** Zero misses on drags of 24px or more (D1, D2, D4), measured from the log with the same tally script. Zero focus regressions (D3, D5, D6, D7). D8's edge result is recorded, not gated (Q4).

## 9. Open questions for the owner (each with a recommendation)

- **Q1. Supersede P3's "Excluded starts" for the fields and the plate?** Recommend **yes**. All 21 logged misses started there, and none started on an armed target. The focused field, `#scale-lip`, `select` and multi-touch stay excluded, and the note-drag veto keeps lifted-note drags out. The lane does not start until this is answered.
- **Q2. Hold guard: disarm a field or plate start that stays within 8px for 250ms before moving?** Recommend **yes, and reuse `HOLD_MS` (250) instead of a new constant**. That is the same moment the plate lifts a note and close to iOS's loupe delay. A new value would be a new constant that this plan's non-goals do not cover.
- **Q3. Seed the fling with the body's finger-phase scroll?** Recommend **yes**. Without it, a short flick needs 24px of momentum on top of the finger, and short flicks were most of the momentum-only misses.
- **Q4. `#scale-box` at its scroll edge: should a drag that continues past the edge act?** Recommend **yes**, per P3 ("even when the content cannot scroll"). Record the iOS edge behaviour in D8 and revisit only if it feels wrong.
- **Q5. Keep `select` excluded although the sheet has none?** Recommend **yes**. It is zero cost and protects any future picker.
- **Q6. Landing order with lane P (#418).** Recommend that LG's dev PR merges after #418's dev merge, and that both main PRs wait for the owner, with #418 first.
