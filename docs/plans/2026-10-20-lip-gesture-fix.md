# Lip gesture fix: every surface arms, momentum counts (2026-10-20)

Status: REVIEWED by /plan-eng-review 2026-10-20 (READY_WITH_FIXES, fixes folded in; see section 10). Q1-Q6 auto-decided under AFK (section 11). Base: lane P head `5caaf6b` (`claude/phone-fixes`, PR #418, HELD, built on `dev`).
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
| `#scale-preview` (svg, circle, `.panhit`, hint) | Note drags. After `HOLD_MS` (250) inside `HOLD_SLOP` (8), the plate lifts a note and `plateTouchMove` (non-passive, Layout tab only) calls `preventDefault`. A lip act during a note drag would slide the footer under the dragged note. Source: P3 "(note drags)"; mutant `ph_lip_drag_preview_not_excluded`. | **Arm, with a note-drag veto.** The gesture never acts while `press && press.lifted` (true in `"held"` and `"drag"`, the only lifted states). `press.state` takes five values at `5caaf6b`: `"down"` (pointerdown), `"held"` (touch lift in `liftNote`), `"drag"` (`startDragging`, or a mouse lift), `"scroll"` (travel over `HOLD_SLOP` before `HOLD_MS`), and `"ignored"` (a note too thin to drag, activated as a tap at `HOLD_MS`); `press` is null after `endPress`, which `pointercancel` reaches. A gesture that travelled more than 8px before 250ms is `"scroll"` or null, and it acts. | A lift after the lip acted in this gesture: a lift needs the pointer within 8px at `HOLD_MS`, an act needs 24px, so in one input stream it cannot happen; the pointer and touch streams are separate events, so a timer-vs-move race at the 250ms boundary is conceivable, and the per-move veto plus the hold guard (which disarms any gesture still unmoved at `HOLD_MS`) close it. Scope (verified at `5caaf6b`): `let press = null` in the plate drag block and the lip block are both at depth 0 of the same inline `<script>`, so `press` is in scope in the lip `touchmove`, and both run only from handlers after boot (no TDZ). |
| `input` | No reason stated in P3. Inferred: the tap-focus path (`tapSnap`, `scrollPin`, `revealField`) and caret placement must not be disturbed. The 8px tap tolerance in the scroll-pin block already separates a tap from a drag. | **Arm unless the input is the focused element** (`document.activeElement === target's field`). An unfocused input receives no focus from a drag in either browser (F2). Add a hold guard: if the finger stays within 8px for `HOLD_MS` before travelling, disarm for the rest of the gesture (loupe or selection intent). | iOS rubber-banding during a drag from an input: the finger rule does not depend on the body scrolling, so this is harmless. Tap-snap: unaffected, because `dropTap` already fires at 8px, before any act at 24px. |
| `textarea` (`#scale-box`) | As `input`, plus internal scroll. Owner D3 (a): the box is three lines tall at most and scrolls inside itself. | **Arm unless focused**, plus a **scroll-owner veto**: if `#scale-box.scrollTop` changes during the gesture, the gesture belongs to the textarea, and it stays disarmed for the rest of the gesture (latch). At the textarea's scroll edge the box does not move, so the finger rule applies. | Chrome's scroll chaining at the edge moves the body. That is a normal body drag and should act. iOS may rubber-band the textarea at its edge without changing `scrollTop`, so the gesture acts; the owner's device retest covers this. |
| `select` | No reason stated in P3. Inferred: a tap opens the native picker. The sheet contains no `<select>`; the only one is `#print-paper-select` in settings, outside `sheet`. | **Keep excluded.** It costs nothing and is future-proof. | None. |
| multi-touch | Pinch zoom and two-finger gestures are not a footer gesture. Source: P3. | **Keep excluded.** | None; unchanged. |

**Owner-gate item.** Arming inputs, the textarea and the plate reverses P3's "Excluded starts" sentence, an **amendment of an owner decision**. Q1 was **auto-decided yes under AFK** (section 11) on the owner's own request for this fix; it is listed for the owner's confirmation on return, and the main merge stays owner-gated in any case.

## 4. Design

The changes are all in the `/* ---- the footer lip ----` block of `index.html`. The `HOLD_MS` constant and the `press` variable are read, never written, from the plate drag block. Nothing outside the lip block is edited.

### 4.1 Arming rule (replaces `lipExcluded` and the `lipDrag` record)

```
// was: closest("#scale-lip, #scale-preview, input, textarea, select")
const lipNeverArms = (t) => !!(t && t.closest && t.closest("#scale-lip, select"));
const lipFocusedField = (t) => {
  const a = document.activeElement;
  return !!(a && a.matches && a.matches("input, textarea") && a.contains && t && a.contains(t));
};

// lip touchstart (capture, passive): the lipTouching recount and the target-attached once listeners are unchanged.
lipFling = null;                                           // any new touch ends a live fling (4.3)
const box = tg && tg.closest ? tg.closest("#scale-box") : null;
lipDrag = ts && ts.length === 1 && !lipNeverArms(tg) && !lipFocusedField(tg)
  ? { id, x, y, dir: 0,                                    // P3 fields, unchanged
      x0: x, y0: y, py: y,                                 // fixed start point and last finger y
      t0: Date.now(), moved: false,                        // hold guard
      fresh: !!(tg && tg.closest && tg.closest("input, textarea, #scale-preview")),  // newly armed surface: the hold guard applies here only
      box, boxTop: box ? box.scrollTop : 0,                // scroll-owner veto
      plate: !!(tg && tg.closest && tg.closest("#scale-preview")),   // note-drag veto
      bodyTop0: bandPort.scrollTop,                        // fling seed (4.3)
      lastMoveWay: null }                                  // fling direction (4.3)
  : null;
```

Changes to the lip `touchmove` (capture, passive). Everything after the three new guards is the P3 code **byte for byte**: the anchor follow, `|dy| >= LIP_PX`, `|dy| > |dx|`, the `sheetOpen`/`kbup`/`lipQuietUntil` suspension, the `L.dir`/anchor update and the state-gated act. There is **no per-direction cap** in the finger phase: P3's in-gesture reversal (up 30 collapses, then down 24 from the lowest point restores, and the anchor keeps following) stays exactly as tested by "PH: P3 a 24px finger-down drag restores, one gesture can reverse, and repeats never oscillate".

```
if (!L || !p) return;                                       // unchanged
if (!L.moved) {
  if (L.fresh && Date.now() - L.t0 >= HOLD_MS) { lipDrag = null; return; }  // hold guard, checked BEFORE the travel test, so a
                                                                   // still finger followed by one large move is still a hold
  if (Math.hypot(p.clientX - L.x0, p.clientY - L.y0) <= 8) return;  // still a tap: nothing else runs
  L.moved = true;
}
if (L.box && L.box.scrollTop !== L.boxTop) { lipDrag = null; return; }     // F4 latch
if (L.plate && press && press.lifted) { lipDrag = null; return; }           // F7 note-drag veto
if (p.clientY !== L.py) L.lastMoveWay = p.clientY < L.py ? "up" : "down";  // every move of 1px or more
L.py = p.clientY;
// ...P3 touchmove body, unchanged...
```

The hold guard applies only to the surfaces this plan newly arms (`fresh`). A start on the body, the tabs or any other surface P3 already armed keeps P3's behaviour, where a press held 250ms and then dragged still acts.

`x0`/`y0`/`py` are the touchstart point, kept separately because P3 moves `L.x`/`L.y` as its anchor. A vetoed or held gesture sets `lipDrag = null`, so it is an untracked touch from then on and `lipDragEnd` (set by `lipDragStop`) gives it P3's full suspension.

The 8px figure is the existing tap tolerance in the scroll-pin block (`dropTap` fires above 8px). The plan reuses the same literal and does not add a constant. The reviewer checks that both agree.

`lipDragStop` (touchend/touchcancel) hands the record to the fling (4.3) before dropping it. It still sets `lipDragEnd` and nulls `lipDrag` unconditionally, so the target-attached `once` listener (the detached-target fix) behaves as today. `lipDragStop` runs **twice** per touchend (sheet capture, then the target's `once` listener): the hand-off reads `lipDrag`, which the first call nulls, so the second call creates nothing and must not clear `lipFling`. `lipTouchClear` on wheel and keydown also clears `lipFling`.

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
let lipFling = null;   // { way, done, acc, prevT, prevM, until }

// lipDragStop, before it nulls lipDrag:
const L = lipDrag;
if (L && L.moved && L.lastMoveWay && !(L.box && L.box.scrollTop !== L.boxTop)) {
  const t = clamp(bandPort.scrollTop), M = range();
  const seed = L.lastMoveWay === "up" ? Math.max(0, t - L.bodyTop0) : Math.max(0, L.bodyTop0 - t);
  lipFling = { way: L.lastMoveWay, done: false, acc: seed, prevT: t, prevM: M, until: Date.now() + LIP_END_MS };
}

function lipFlingStep(now) {            // called from lipScrollEvent while lipFling is live
  const F = lipFling, t = clamp(bandPort.scrollTop), M = range();
  F.until = now + LIP_END_MS;           // momentum keeps the window alive (same chain as P3)
  if (M !== F.prevM) { F.prevM = M; F.prevT = t; return; }        // a range change re-baselines
  const d = t - F.prevT; F.prevT = t;
  if (!sheetOpen || kbup || now < lipQuietUntil) return;           // suspended: re-baselined above, never accumulates
  const s = F.way === "up" ? d : -d;
  if (s <= 0) return;                   // the opposite sign never counts (a collapse clamp lands here)
  F.acc += s;
  if (F.done || F.acc < LIP_PX) return;
  F.done = true;                        // the fling acts at most once, whether or not the state needed changing
  if (F.way === "up") { if (!isLipShut()) collapseLip(); }
  else if (isLipShut()) restoreLip();
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

`clamp(x)` is `Math.min(Math.max(x, 0), range())` and `range()` is `bandPort.scrollHeight - bandPort.clientHeight`, the expressions `lipScroll` already computes; a helper that `lipScroll` and `lipFlingStep` share is allowed inside the lip block. Clamping `t` to `[0, M]` neutralises iOS overscroll bounce, whose `scrollTop` leaves the range and comes back.

The suspension test sits **after** the re-baseline and **before** `acc +=`. Programmatic scrolls that land inside a live fling (`setTab`'s scrollTop reset, `holdPin`, `revealField`, `applyKbOffset`) run under `lipQuiet()`, so they move `prevT` and add nothing; the next momentum frame measures from where they left the body.

How this connects to the existing code:
- `lipScroll` is unchanged, and so is its `lipPrev` bookkeeping, which keeps the wheel path's baseline current. Each suspended call still returns at "no-user-window" because `userWindowUntil` is 0.
- `lipDragStop` still sets `lipDragEnd` for every touchend, so untracked touches (excluded starts, multi-touch, vetoed gestures) keep P3's full suspension.
- `lipTouchClear` (wheel, keydown) also sets `lipFling = null`, so a wheel or key takes over cleanly.
- `L.lastMoveWay` is updated in touchmove from each move of 1px or more. A flick reverses only if the finger reversed last.
- A new `touchstart` sets `lipFling = null`. Without it, a tap on `#scale-lip` that restores during a collapse fling's tail would be followed by more momentum, and the fling would collapse again.

**Seed.** The fling's `acc` starts at the body's own displacement during the finger phase, in the fling direction. A 20px finger drag that moved the body 20px, followed by momentum, reaches 24px after 4px of momentum. Without the seed, a short flick would need 24px of momentum on top of the finger. This is question Q3.

### 4.4 Proofs

**At most one act per direction per gesture (no double count).**
- The finger phase is P3's code unchanged. Its anchor rule already allows at most one act per finger reversal, and P3's tests pin that behaviour.
- The fling adds **at most one** act: `F.done` is set on the first frame that reaches 24px, whether or not the state needed changing.
- That one act is **state-gated**: a collapse fling acts only when the footer is open, and a restore fling only when it is shut. So if the finger's last act already moved the footer in the fling's direction (the common case: a finger-up drag collapses, then its momentum carries on), the fling finds the state already reached, sets `done`, and does nothing.
- Nothing else can change the state between touchend and the fling's frame: `lipScroll` acts only inside a user window, which is 0 throughout the fling. A wheel or key clears the fling (`lipTouchClear`). A new touch clears it (touchstart). A lip click by mouse (no touch, no key) can restore during the tail, and `done` stops the fling collapsing again (T17).
- Total, for a gesture whose last finger act was in direction w: the finger acts as P3 does, and the fling can only act in w when the state is not already w. It therefore never repeats the finger's last act and never undoes it.

**No oscillation.** The lane L proof for the wheel path is unchanged, because `lipScroll` is unchanged, and it still holds for wheel and keys:
1. a scroll collapse never clamps, because `M - t > E`;
2. a restore never clamps;
3. `acc` resets after an act;
4. an end restore cannot be followed by a collapse, because Δ < E.

For the fling path:
1. **The fling acts only in the finger's last direction, at most once.** `F.way` is fixed at touchend, and `F.done` makes the act single. One act cannot flip-flop.
2. **A collapse may clamp.** The fling, like P3's finger rule, collapses without `M - t > E`, because P3 overrides that for touch. When the footer collapses, `clientHeight` grows and `M` shrinks; if `t > M'`, the browser clamps `scrollTop` down. Collapse applies the `lipped`/`lipshut` classes synchronously, so the next scroll event (the clamp's, or the next momentum frame's) sees `M !== prevM` and re-baselines; the 180ms slide may change `M` again on later frames, and each change re-baselines once more. Even if the range were equal the clamp's `d` is negative against `way = "up"` and is ignored. Nothing in the fling path can restore off a clamp: a restore needs `way = "down"`, fixed at touchend, and the fling has already spent its one act (`done`) when it collapsed. A clamp that lands while the fling is suspended (lipQuiet) re-baselines `prevT` and adds nothing.
3. **A restore never clamps.** Restoring shrinks `clientHeight` and grows `M` (at `finishOpen`); `t` stays valid, and the larger `M` re-baselines.
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
| F7 pan preview | The plate's tap path (`previewBox` click to `activateNote` when `drawerOpen`, guarded by `suppressClick`) is not edited. A drag over 8px before 250ms sets `press.state = "scroll"`, so there is no lift and no `activateNote`; the lip acts at 24px. A held press (lifted note) is vetoed by `press.lifted`, and the hold guard disarms it first anyway. **The repo has no "tap opens ADJUST LAYOUT" at this base:** tabs superseded the drawer (sheet-tabs plan 3.7), and `#scale-preview` exists only in `#scale-panel-layout`. The "drawer" is the Layout tab itself, so there is one pan and one set of lip listeners. F7 is therefore read as: a tap selects or opens the note as today, and a drag opens nothing. | T11, T12, T13, e2e R3/R4, the existing note-drag e2e tests |
| F8 select | Stays in `lipNeverArms`. The sheet has no `<select>`. | T14 (static: no `select` in `#scale-sheet`, and `lipNeverArms` matches `select`) |
| F9 no click after a drag | A drag of 24px or more is a scroll or pan gesture in both browsers, so neither synthesizes a click. The lip never calls `click()` or `focus()`. The footer's 180ms slide moves the footer only; fields under the finger do not move during the finger phase (the body's layout box changes height, and the field the finger is on stays under it). | e2e R1-R4: zero `click` events on any field after a drag; e2e R8 drags across a field boundary while the footer slides |

## 5. Test plan (TDD: every new test is written red against `5caaf6b` first)

Prefix: **"LG:"**. Sandbox tests go in `tests/app.test.js` with the existing helpers (`lipApp`, `shortApp`, `finger`, `drag`, `scrollTo`, `isShut`, `hit`). Real-Chrome tests go in `tests/e2e.test.js`, using CDP `Input.dispatchTouchEvent` through the existing `finger2`/`pull` helpers. The LG describe sits beside the existing PH: P3 tests.

### 5.1 Sandbox (`tests/app.test.js`)

| id | title | asserts |
|---|---|---|
| T1 | `LG: a tap on each field (travel 6px) arms nothing, acts on nothing and leaves tapSnap and scrollPin as P3 left them` | For each of `#scale-ding`, `#scale-top`, `#scale-inner`, `#scale-bottom` and `#scale-box`: after touchstart, a 6px move and touchend, the lip state is unchanged, there is no fling, and the tap-snap state equals the same tap's state at `5caaf6b` (recorded fixture values). |
| T2 | `LG: a stationary press on an unfocused field for HOLD_MS then a 60px drag does not act` | Hold guard. Two shapes: (a) `advance(HOLD_MS)` then ONE 60px `touchmove` (the guard must run before the travel test); (b) 4px moves through `HOLD_MS`, then 60px. Also on the plate. (c) The same hold-then-drag from the body still collapses, because P3's armed surfaces get no hold guard. |
| T3 | `LG: a 24px finger-up drag from each unfocused field collapses and a 24px finger-down drag restores; 23px does neither` | Defect 1, for each input and `#scale-box`, on `shortApp` (range under the footer) and `lipApp`. |
| T4 | `LG: a drag inside the focused field never acts, kb down included` | Set `activeElement` to the field; drag ±60px; state unchanged; `blur` never called. |
| T5 | `LG: a drag that starts on another, unfocused field while one is focused acts` | Only the focused one is excluded. |
| T6 | `LG: a drag that scrolls #scale-box's own content never acts, in the finger phase or its fling` | The stubbed `scrollTop` of `#scale-box` changes at the first move. |
| T7 | `LG: a drag from #scale-box at its scroll edge, where its scrollTop does not change, acts` | Edge rule. |
| T8 | `LG: while kbup a drag from any surface and its fling do nothing` | F5. |
| T9 | `LG: focus moving field to field with kbup does not change the lip` | F5. |
| T10 | `LG: a touch on #scale-lip arms no body drag: its 16px swipe restores once and nothing else acts` | F6 and double count. |
| T11 | `LG: a 60px drag from the plate on the Layout tab collapses and activates no note` | F7; `activateNote` spy count is 0. |
| T12 | `LG: a plate press held (press.lifted) then dragged 60px never acts` | F7 note-drag veto. The test sets `press` lifted through `a.run` BEFORE `HOLD_MS` elapses, so the hold guard cannot be what stops it (otherwise `lg_plate_lift_acts` survives). |
| T13 | `LG: a tap on a plate .panhit with the Layout tab open still activates the note and acts on nothing` | F7 tap. |
| T14 | `LG: lipNeverArms matches #scale-lip and select, and #scale-sheet holds no select` | F8. |
| T15 | `LG: momentum after touchend in the finger's direction collapses once it reaches 24px with the seed` | Defect 2. Finger moves the body 10px, then `scrollTo` steps of 5px at 33ms after touchend. The collapse happens at the step where 10 + momentum ≥ 24, and exactly once. |
| T16 | `LG: momentum after a finger-down drag restores a shut footer` | Defect 2, the restore half. |
| T17 | `LG: a fling acts at most once: a touchmove collapse and a 482px tail is one collapse, and a lip click restore during a collapse fling's tail is not undone` | No double count. Second half: after the fling's first frame past 24px, `lipBtn` click (no touch, no key) restores; further momentum frames leave it open. |
| T18 | `LG: a fling's opposite-sign scroll (the collapse clamp) never restores` | After a collapse, a `scrollTo` back by the clamp (`t > M'`) gives no restore. |
| T19 | `LG: a fling never restores on reaching the bottom` | E12, kept for the fling path. |
| T20 | `LG: the fling ends LIP_END_MS after the last scroll and a later programmatic scroll does nothing` | A5 holds; gap of 230ms. |
| T21 | `LG: a 140ms gap between momentum frames keeps the fling alive` | The observed maximum gap. |
| T22 | `LG: wheel and keyboard scrolling are unchanged: the scroll rule M - t > E and the bottom restore` | Rerun of the lane L scroll-rule cases against the new `lipScrollEvent`, with `lipFling` null. |
| T23 | `LG: an untracked touch (second finger, #scale-lip start, vetoed gesture) keeps the full P3 suspension through its momentum` | P3 review fix, kept for what stays excluded. |
| T24 | `LG: a wheel or key during a fling ends the fling` | `lipTouchClear` path. |
| T25 | `LG: a new touch ends a live fling: a lip tap that restores during a collapse fling's tail stays restored` | touchstart clears `lipFling`. |
| T26 | `LG: scrolls under lipQuiet during a fling add nothing: a programmatic 300px scroll then 10px of momentum does not act` | Suspension re-baselines before `acc +=`. |
| T27 | `LG: lipDragStop running twice for one touchend (sheet and target) creates one fling and does not clear it` | Double invocation. |

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

**Unchanged and green.** All A1-A19, E1-E12, LP and UX lip tests, and every PH: P3 test not listed below. Named because the fix runs through them:
- "24px … 23px …";
- "PH: P3 a 24px finger-down drag restores, one gesture can reverse, and repeats never oscillate": unchanged because the finger phase has no per-direction cap (4.1);
- "PH: P3 every touch suspends the scroll path, an excluded start or a second finger included: no collapse, no restore, and momentum keeps extending the window": **unchanged, verbatim**. Its plate and field starts send no `touchmove`, so `moved` stays false, no fling is created, and `lipDragEnd` gives them P3's suspension exactly as before; its `#scale-preview` b-case likewise;
- "PH: P3 a touch whose target is detached …", "a touchcancel with no touchend …", "a wheel or a scrolling key …": unchanged; `trackedTarget()` now arms (it answers `#scale-preview`), but sends no move;
- "PH: P3 a drag that scrolls the body to its end neither restores nor collapses again, momentum included": unchanged; its post-touchend frames form a collapse fling that finds the footer already shut;
- "repeated drags …";
- "a long press on a plate field … wheel or ArrowDown … collapses exactly once" (no move, no fling; the wheel clears everything);
- "a wheel on a sheet with no room …";
- "UX: a touch flick to the end collapses once and stays collapsed" (the fling acts at most once and never bottom-restores).
- **At risk, not lip tests, must stay green unchanged:** `tests/e2e.test.js` "KB2b: a swipe that starts on a field inside the pin window scrolls like one on the flank, and a later keyboard focus does not restore the pre-drag scroll" swipes 60px from an unfocused field. It runs with the keyboard up, where `kbup` suspends the lip, so it should not act; the lane runs it locally and lists it in the report. If it acts there, that is a design defect to report, not an assertion to change.

**Assertions that must change.** Each asserted the exclusion that Q1 supersedes. None is weakened: every case keeps an exact expected count, either still 0 or now exactly 1.

| test | file | change | why it is not a weakening |
|---|---|---|---|
| `PH: P3 starts on the lip, the plate, a field or with a second finger do not collapse; the keyboard does not either` | app | Retitled `PH: P3 starts on the lip, a select or with a second finger do not collapse; the keyboard does not either`. The loop keeps `#scale-lip` and `select`, the second finger and the kbup clause byte for byte. `#scale-preview`, `input` and `textarea` move to T3/T11 as exact-one-act assertions. | Kept cases unchanged; moved cases assert a positive count. |
| `PH: P3 a drag that starts on a field, on the plate or with a second finger changes the lip zero times across the gesture and its settle, at 390x797 and 380x780` | e2e | Retitled `PH: P3 a drag with a second finger or mostly sideways changes the lip zero times across the gesture and its settle, at 390x797 and 380x780`. The second-finger and sideways halves are kept, with `before` re-read immediately before each (it no longer follows a zero-change plate drag). The seed-box and plate halves become R4/R3 (exactly one change, no note activation, no focus change). The Layout-range precondition (`M - t > E`) moves to R3 with them. | The new halves assert more: an exact count plus focus and note checks. |

## 6. Mutants (`tests/mutants/`)

The patches are made with `git diff`, with the `index a..b` lines stripped. Each header is `# kills: <full title>` then `# suite: node --test --test-name-pattern ^<title with every space and punctuation mark as .>$ tests/<file>.test.js`, anchored like the existing `ph_lip_*` headers (no quotes, no spaces; memory: headers are word-split). The table gives the stem; the lane writes the anchored full title. All LG mutants below are killed in `tests/app.test.js` unless the row says e2e.

| mutant | mutation | killed by (`# suite:`) |
|---|---|---|
| `lg_field_start_excluded_again` | `lipNeverArms` gains `input, textarea` | `LG:.a.24px.finger-up.drag.from.each.unfocused.field` (T3) |
| `lg_plate_start_excluded_again` | `lipNeverArms` gains `#scale-preview` | `LG:.a.60px.drag.from.the.plate` (T11) |
| `lg_focused_field_armed` | `lipFocusedField` returns false | `LG:.a.drag.inside.the.focused.field` (T4) |
| `lg_hold_counts_as_drag` | the hold-guard line is removed | `LG:.a.stationary.press` (T2) |
| `lg_hold_on_every_start` | the `L.fresh &&` term is removed | `LG:.a.stationary.press` (T2 shape c) |
| `lg_hold_checked_after_travel` | the hold guard moves after the 8px travel test (the draft's order) | `LG:.a.stationary.press` (T2 shape a) |
| `lg_textarea_scroll_counts` | the `L.box` latch is removed | `LG:.a.drag.that.scrolls..scale-box` (T6) |
| `lg_plate_lift_acts` | the `press.lifted` veto is removed | `LG:.a.plate.press.held` (T12) |
| `lg_fling_dropped` | `lipDragStop` creates no `lipFling` (the defect) | `LG:.momentum.after.touchend` (T15) |
| `lg_fling_no_seed` | `seed = 0` | `LG:.momentum.after.touchend` (T15, the exact step) |
| `lg_fling_rearms_forever` | `lipFlingStep` never lets the fling expire (`until = Infinity`) | `LG:.the.fling.ends` (T20) |
| `lg_fling_opposite_sign_counts` | `if (s <= 0) return;` becomes `F.acc += Math.abs(d)` and both directions act | `LG:.a.fling.s.opposite-sign` (T18) |
| `lg_fling_double_act` | `F.done` is never set | `LG:.a.fling.acts.at.most.once` (T17, the lip-click half) |
| `lg_fling_survives_new_touch` | touchstart no longer clears `lipFling` | `LG:.a.new.touch.ends.a.live.fling` (T25) |
| `lg_fling_counts_while_quiet` | the suspension line moves after `F.acc += s` | `LG:.scrolls.under.lipQuiet` (T26) |
| `lg_fling_bottom_restore` | `lipFlingStep` gains `if (isLipShut() && t >= M - 1) restoreLip()` | `LG:.a.fling.never.restores.on.reaching` (T19) |
| `lg_fling_ignores_kbup` | the `kbup` check is removed | `LG:.while.kbup` (T8) |
| `lg_untracked_not_suspended` | the untracked `lipDragEnd` branch is removed | `LG:.an.untracked.touch` (T23) |

**Existing mutants that change.**
- `ph_lip_drag_preview_not_excluded`: its premise (removing `#scale-preview` from the exclusion) is now the shipped behaviour. **Retire it**; `lg_plate_start_excluded_again` and `lg_plate_lift_acts` take over its job.
- `ph_lip_excluded_touch_not_suspended`: its killing e2e test is retitled (5.3). **Re-anchor** it to the untracked-touch branch, with `# kills:` and `# suite:` naming T23 in `tests/app.test.js`. Keep its second hunk (`lipDragStop` sets `lipDragEnd` only for a tracked drag); confirm T23 or the unchanged "every touch suspends" test kills it.
- `ph_lip_drag_anchor_not_followed` names the reversal test, which stays unchanged, so it must still be killed by it.
- `kb2b_drag_keeps_pin` names the at-risk KB2b test (5.3); it is untouched and must stay killed.
- The other six `ph_lip_*` patches: re-anchor them if the hunk drifts, and `apply --check` all of them.

Memory rules: `mutation_check.sh` restores the tree, so do not edit while it runs. FLOORS rows and the README mutant count are set from CI's run artifacts (`by_module`/`files[].total`), not from a local count. The lane owns `tests/mutants/`.

## 7. Lane

One lane, **LG**. It does not split along file ownership: the code and both test files move together.

- **Branch / worktree:** `claude/lip-gesture`, from `5caaf6b`, in its own worktree.
- **Ownership:**
  - `index.html`, the lip block only, from `/* ---- the footer lip ----` through the `footSlide` transitionend listener;
  - `tests/app.test.js`, the new LG describe plus the one P3 test named in 5.3 as changing;
  - `tests/e2e.test.js`, R1-R8 plus the one P3 test named in 5.3;
  - `tests/mutants/lg_*.patch` plus the two `ph_lip_*` changes in section 6;
  - the FLOORS/README mutant count, if CI moves it.
  - Nothing else. In particular, not the scroll-pin block, the plate drag block (`press` and `HOLD_MS` are read only), `applyKbOffset`, CSS or markup.
- **Acceptance criteria:**
  1. T1-T24 and R1-R8 are green, and each was red at `5caaf6b` where it asserts new behaviour (the lane report lists which ones were red first).
  2. Every A1-A19, E1-E12, LP, UX and PH lip test not listed in 5.3 is green **unchanged** (`git diff 5caaf6b -- tests/` touches only the LG blocks and the 5.3 tests).
  3. The new mutants are killed and the existing mutants are still killed.
  4. There is no new non-passive listener and no rAF or ResizeObserver: `git diff 5caaf6b -- index.html | grep -E 'passive: false|requestAnimationFrame|ResizeObserver'` is empty, and every `addEventListener` line the diff adds carries `passive: true`.
  6. The lip `touchmove` after the three new guards is byte-identical to `5caaf6b` (the reviewer diffs it).
  5. The non-goal constants are byte-identical.
- **Verify:**
  - `python3 tools/sync_decks.py --check && python3 tools/inline_engine.py --check && node --test tests/app.test.js && python3 tools/validate.py`
  - targeted e2e with `CHROME_BIN` set: `node --test --test-name-pattern 'LG:|PH: P3|UX: a (real )?touch|lip|KB2b' tests/e2e.test.js`
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

All six were auto-decided under AFK on 2026-10-20; see section 11 for the record.

- **Q1. Supersede P3's "Excluded starts" for the fields and the plate?** Recommend **yes**. All 21 logged misses started there, and none started on an armed target. The focused field, `#scale-lip`, `select` and multi-touch stay excluded, and the note-drag veto keeps lifted-note drags out. Auto-decided yes (section 11).
- **Q2. Hold guard: disarm a field or plate start that stays within 8px for 250ms before moving?** Recommend **yes, and reuse `HOLD_MS` (250) instead of a new constant**. That is the same moment the plate lifts a note and close to iOS's loupe delay. A new value would be a new constant that this plan's non-goals do not cover.
- **Q3. Seed the fling with the body's finger-phase scroll?** Recommend **yes**. Without it, a short flick needs 24px of momentum on top of the finger, and short flicks were most of the momentum-only misses.
- **Q4. `#scale-box` at its scroll edge: should a drag that continues past the edge act?** Recommend **yes**, per P3 ("even when the content cannot scroll"). Record the iOS edge behaviour in D8 and revisit only if it feels wrong.
- **Q5. Keep `select` excluded although the sheet has none?** Recommend **yes**. It is zero cost and protects any future picker.
- **Q6. Landing order with lane P (#418).** Recommend that LG's dev PR merges after #418's dev merge, and that both main PRs wait for the owner, with #418 first.

## 10. Engineering review (2026-10-20, /plan-eng-review, spawned)

Verified against `index.html` at `5caaf6b` and the PH: P3 tests in both test files. Every fix below is already folded into sections 3-7.

### 10.1 Findings

| # | area | finding | change made |
|---|---|---|---|
| R-1 | (c) double act | The draft capped finger acts at one per direction (`L.acted[way]`). That changes P3's finger phase: an up-down-up gesture would lose its second collapse, and the plan's own non-goal says the finger rule is sound and unchanged. | The finger phase stays byte-identical after three new guards. The fling holds its own `done` flag and acts at most once, state-gated. 4.4 restates the proof. T17 and `lg_fling_double_act` now test a lip-click restore during the tail. |
| R-2 | hold guard | The draft tested elapsed time only while travel was within 8px. A finger held still (no touchmove) and then moved more than 8px in one event skipped the guard. | The guard runs before the travel test. T2 gains shape (a). New mutant `lg_hold_checked_after_travel`. |
| R-13 | hold guard scope | The draft's hold guard covered every start, so a press held 250ms on the body or tabs and then dragged would stop acting. That is a regression on surfaces P3 already arms. | The guard is scoped to the newly armed surfaces (`fresh`: input, textarea, plate). T2 shape (c) and the mutant `lg_hold_on_every_start` were added. |
| R-3 | fling accumulation | `lipFlingStep` added to `acc` before its suspension test, so a quieted programmatic scroll (`setTab`, `holdPin`, `revealField`, `applyKbOffset`) during a fling counted toward 24px. | The suspension check moves between the re-baseline and `acc +=`. New test T26 and mutant `lg_fling_counts_while_quiet`. |
| R-4 | stale fling | A new touch did not end a live fling. A lip tap that restores during a collapse fling's tail could be collapsed again by the remaining momentum. | touchstart sets `lipFling = null`. New test T25 and mutant `lg_fling_survives_new_touch`. |
| R-5 | (a) `press` | Scope confirmed: depth 0 of the same script, no TDZ. The draft named two of five states. | The veto reads `press.lifted`, and section 3 names all five states. The "impossible" claim is softened to the pointer/touch timing race, which the hold guard and the per-move veto close. |
| R-6 | naming | `L.lastWay` (4.1) and `L.lastMoveWay` (4.3) named one field twice. The anchor (`L.x`/`L.y`) was reused as the tap-travel origin, but P3 moves it. | One name, `lastMoveWay`, is used. The touchstart point is kept as `x0`/`y0`. |
| R-7 | `lipDragStop` | It runs twice per touchend (sheet capture, then the target's `once`). The draft's "ending touch is lipDrag's" check had no source for the target listener, whose event carries no `changedTouches`. | Hand-off reads `lipDrag` and is idempotent. `lipDrag` is still nulled unconditionally. New test T27. |
| R-8 | (e) 5.3 | "every touch suspends …" needs **no** change: its starts send no touchmove, so they never become a fling. Changing it was an unforced edit to a P3 test. | It is moved to "unchanged, verbatim". Two tests change, and both are retitled because their old titles would now be false. The e2e test re-reads `before` for the kept halves. |
| R-9 | (e) collateral | `tests/e2e.test.js` "KB2b: a swipe that starts on a field inside the pin window …" swipes 60px from an unfocused field. It is not a lip test, so the draft missed it. It runs with kbup, so it should not act. | Listed as at-risk, must stay green unchanged. Added to the targeted e2e pattern. `kb2b_drag_keeps_pin` is named. |
| R-10 | (f) mutants | The draft's patterns were unanchored stems with no file. Existing headers use `^...$` with the file. The retitled e2e test would leave `ph_lip_excluded_touch_not_suspended` naming a missing title. | Header format spelled out. Re-anchoring is explicit. `ph_lip_drag_anchor_not_followed` and `kb2b_drag_keeps_pin` are named as must-stay-killed. All stems were checked against their T titles. |
| R-11 | (b) clamp | The proof survives. Collapse is synchronous, so `M` changes and the frame re-baselines. A negative `d` is ignored for `up`. A restore grows `M`. `done` already stops a second act. | Proof text extended with the slide's repeated `M` changes, the iOS bounce clamp and the quiet-clamp case. |
| R-12 | (d) tap | tapSnap/scrollPin are not edited. `dropTap` fires at more than 8px, before any 24px act. A focus tap stays under 8px, so `moved` is false and there is no act and no fling. The plan's 8px literal equals the scroll-pin's and `HOLD_SLOP`. | No change needed. Acceptance criterion 6 pins the P3 body byte for byte. |

### 10.2 What already exists (reused, not rebuilt)

- P3 finger rule, anchor and reversal, reused as is.
- `lipDragEnd` suspension, still used for every untracked touch.
- `lipScroll` and the lane L scroll rule, untouched.
- `lipQuiet()`, which quiets every programmatic scroll and is read by the fling.
- `HOLD_MS` and `press` from the plate block, read only.
- The test helpers `lipApp`, `shortApp`, `finger`, `drag`, `scrollTo`, `trackedTarget`, `pull`, `finger2` and `lipState`.

### 10.3 NOT in scope

- Lane P's 5px lip.
- Any change to `LIP_*` constants.
- Keyboard detection.
- tapSnap/scrollPin.
- The plate drag block.
- A `touch-action` change.
- Making the wheel path count momentum.
- Arming `select` or multi-touch.

### 10.4 Failure modes

| path | failure | test | handled | visible |
|---|---|---|---|---|
| fling vs lip tap | a restore undone by remaining momentum | T25 | yes | was silent |
| fling vs quiet scroll | a tab switch counts as a fling | T26 | yes | was silent |
| hold then jump | a loupe drag collapses the footer | T2a | yes | was silent |
| iOS textarea edge | rubber-band without a scrollTop change acts | D8 device step | recorded (Q4) | visible on device |
| fling stalls over 220ms | a missed fling act, never a wrong one | T20/T21 | by design | visible as a miss |

There is no critical gap: every silent failure now has a test.

### 10.5 Implementation order (lane LG, TDD)

1. Write T1-T27 and R1-R8 red at `5caaf6b`.
2. Apply the two 5.3 edits.
3. Change the arming rule and the touchmove guards (4.1).
4. Add the fling (4.3).
5. Write the mutants (section 6).
6. Run the KB2b at-risk check.
7. Rebuild the Lip Lab (section 8).

## 11. AFK auto-decisions (2026-10-20, integrator)

| Q | decision | rationale |
|---|---|---|
| Q1 | **Yes.** Drags that start on a field or the plate act. This reverses P3's "Excluded starts" for inputs, the textarea and `#scale-preview`. | All 21 logged misses started on those targets, and none started on an armed one. The owner asked for this fix with focus kept no worse. The focused field, `#scale-lip`, `select` and multi-touch stay excluded, and lifted-note drags are vetoed. This amends an owner decision, so it is listed for the owner's confirmation on return. The main merge stays owner-gated regardless. |
| Q2 | **Yes.** A 250ms hold disarms, reusing `HOLD_MS`. | It is the moment the plate lifts a note and is close to iOS's loupe delay. Reusing the constant adds none, so the non-goals stay intact. |
| Q3 | **Yes.** The fling is seeded from the body's travel while the finger is down. | Without the seed, a short flick needs 24px of momentum on top of the finger's travel. Short flicks were most of the momentum-only misses. |
| Q4 | **Yes.** Act past the textarea's scroll edge, and observe it in device step D8. | P3 says a 24px drag acts "even when the content cannot scroll". The iOS edge behaviour is recorded, not gated. |
| Q5 | **Yes.** Keep `select` excluded. | It costs nothing, and the sheet has none today. |
| Q6 | **Lane LG stacks on lane P's #418 branch `claude/phone-fixes`.** Both reach `dev` first, LG's dev PR after #418's. Main merges are owner-gated and never done by an agent, with #418 first. | LG is cut from `5caaf6b`. Owner rule: dev first, never merge to main. |

The review skill also auto-chose two things in the spawned session. There is no design doc, so the standard review ran without /office-hours. Scope was accepted as is: one lane, a minimal diff confined to the lip block.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | - | - |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open, all folded | 13 findings (R-1 to R-13), all fixed in the plan; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | - | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | - | - |

**OUTSIDE COVERAGE:** the outside voice was skipped because it is unavailable in a spawned session.

**VERDICT:** READY_WITH_FIXES. Eng review is done and every finding is folded into the plan. One item goes to the owner on return: confirming Q1, which reverses P3's excluded starts.

NO UNRESOLVED DECISIONS
