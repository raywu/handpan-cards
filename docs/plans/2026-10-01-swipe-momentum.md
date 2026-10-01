# Swipe momentum: a mouse fly-out keeps its release speed (2026-10-01)

Plan only. Every code fact below was read or probed at origin/main **aff9fd1**.
Line numbers are at that commit.

## Goal

When a desktop mouse click-drag commits, the card leaves at the speed it was
released and keeps moving until it is fully off-screen. Only after that does
the next card enter.

Owner, on the current click-drag: "it's pretty good, but with click drag, the
animation makes it less clear that the card has flown off the screen." The
two-finger (wheel) swipe "works great", so it is the reference for feel.

## What is wrong today (verified)

1. **The mouse fly-out never plays.** The capture-phase click listener at
   `index.html:8393-8396` calls `land()` before it checks `eatClick`. A
   committed mouse drag's trailing click therefore lands the flight at once.
   Probe at aff9fd1 (real CDP mouse drag, local Chrome): `flight === null`
   straight after release, at both 1024x700 and 380x800. This is D180-7 in the
   triage plan (PR #192).
2. **Even if it played, it would drop the momentum.** `flyOut(dir, dx)`
   (`:8187-8198`) always runs `SWIPE_OUT_MS` = 220 ms with `SWIPE_OUT_EASE` =
   `cubic-bezier(.4,0,1,1)`, whose initial slope is 0. A card released at
   3 px/ms restarts from a standstill.
3. `release()` (`:8205-8252`) computes `vx` over the trailing
   `SWIPE_FLING_WINDOW_MS` (100 ms) and uses it only in `swipeDecision`.
4. The wheel path calls `flyOut(dir, -effDx)` (`:8361`) once `|wheel.sx|`
   passes `WHEEL_COMMIT_PX` (80). It has no click, so its 220 ms fly-out
   plays in full. That is why it "works great".
5. The end keyframe is already off-screen. `dist = innerWidth / 2 +
   scene.offsetWidth` (`:8189`). Probe: at 1024x700 the card rests at
   left 351 / right 673, so after a "next" fly-out its right edge sits at
   -161. At 380x800 it rests at 22.8 / 357.2, ending at -166.8. The motion
   model only needs to keep the card moving to that end; `dist` stays as is.

Constants today (`:8131-8134`): `SWIPE_COMMIT_PX` 18, `SWIPE_FLING_PX_MS`
0.15, `SWIPE_FLING_WINDOW_MS` 100, `SWIPE_SLOP_PX` 10, `SWIPE_OUT_MS` 220,
`SWIPE_BACK_MS` 260, `SWIPE_IN_MS` 180, `SWIPE_IN_PX` 24.

## Decisions

### 1. Scope: mouse only

**Recommendation: mouse only.** The new curve applies only when
`drag.pointerType === "mouse"`. Touch and pen keep 220 ms /
`cubic-bezier(.4,0,1,1)`. A new e2e test proves that at both widths.

Why: the owner has asked before how desktop swipe fixes are kept from changing
mobile behaviour, and the owner has no complaint about touch. Touch also has no
trailing click, so its fly-out already plays in full (item 4's reasoning
applies). Pen is grouped with touch because it is a tablet input with the same
no-click release. Taking momentum to touch is a separate owner question (Q-A
below), not this plan.

### 2. Motion model

A pure helper, `swipeOutTiming(vx, dir, dx, dist)`, returns
`{ end, duration, easing }`. It lives in the swipe region beside
`swipeDecision`, outside every engine region. `dist` is `flyOut`'s existing
`innerWidth / 2 + scene.offsetWidth`; `end` is the end keyframe's
`|translateX|`.

```
v        = max(-dir * vx, SWIPE_MOMENTUM_FLOOR_PX_MS)   // speed along the flight, floored
end      = max(dist, |dx| + SWIPE_MOMENTUM_FLOOR_PX_MS * SWIPE_MOMENTUM_MIN_MS)
d        = end - |dx|                                   // px still to travel, >= 210
duration = clamp(d / v, SWIPE_MOMENTUM_MIN_MS, SWIPE_MOMENTUM_MAX_MS)
k        = v * duration / d                             // seed slope, in progress per unit time
x1       = min(1/3, 1/k)                                // keeps y1 <= 1: no overshoot
y1       = k * x1                                       // so y1 / x1 == k exactly
easing   = cubic-bezier(x1, y1, 2/3, 2/3)               // 4 decimals
```

- **Initial speed matches the release.** A cubic-bezier's slope at t=0 is
  `y1 / x1`. In px/ms that is `k * d / duration = v`. So the card leaves at
  exactly `v`.
- **Unclamped (the common case):** `k = 1`, so `x1 = y1 = 1/3`. With
  `P2 = (2/3, 2/3)` the curve is exactly linear. The card coasts at its
  release speed all the way to the end keyframe. Typical flicks land here:
  1024x700, 180 px drag at 3.75 px/ms gives 654 / 3.75 = 174 ms.
- **MIN clamp (a very fast flick):** `k > 1`. The card starts at `v` and
  decelerates toward the end. `x1 = min(1/3, 1/k)` keeps `y1 <= 1`, so the
  curve never overshoots. The curve is monotone for every `k` (the
  derivative's quadratic has a negative discriminant when `y1 <= 1` and
  `y2 = 2/3`); a unit test pins that.
- **MAX clamp and the floor (a slow drag that commits on distance):** `vx`
  is near 0. `v` becomes the floor, `duration` hits MAX, and `k < 1`. The card
  starts at the floor speed and accelerates out, so it never crawls.
- **Direction.** `-dir * vx` is the speed toward the flight. A drag that
  commits on distance but whose last motion reverses gets 0, and then the
  floor. The projection is inside the helper so a unit test can see it.
- **Overshoot (outside voice, accepted).** `dir` always follows the sign of
  `dx` (`swipeDecision`, `index.html:8147`), so the distance left is
  `dist - |dx|`. A captured mouse can drag the card past `dist` (pointer
  capture keeps delivering moves outside the window). Today that makes the
  fly-out run backward to `dist`. Clamping only the timing input would
  still animate the real negative span: at `remaining = -50` and 3 px/ms the
  curve would start about 149 px/ms backward. So the helper moves the
  endpoint instead. `end` is never less than `|dx| + FLOOR * MIN` (210 px), so
  the card always keeps going forward and `d >= 210`. At 1024 and 380 a normal
  drag never reaches it (`|dx|` <= 673 against `dist` 834 and 524), so `end`
  equals today's `dist` there. The guard is on the mouse path only. Touch
  cannot overshoot: the finger stays on screen.

**Recommended constants (ASK-OWNER Q-B: these are feel):**

| Constant | Value | Why |
|---|---|---|
| `SWIPE_MOMENTUM_MIN_MS` | 140 | Under today's 220 ms, as the brief requires. A flick above about 4.7 px/ms at 1024 decelerates instead of vanishing in under 140 ms |
| `SWIPE_MOMENTUM_MAX_MS` | 320 | A slow commit still clears the screen in about 1/3 s |
| `SWIPE_MOMENTUM_FLOOR_PX_MS` | 1.5 | 10x the fling threshold. A zero-velocity commit starts visibly moving |

**Why cubic-bezier and not `linear()`:** the `linear()` easing function is
newer (Safari 17.2), and older iOS Safari would fall back to the default
`ease`. cubic-bezier works everywhere WAAPI does, and one control point is
enough to seed the slope.

`flyOut` gains one optional parameter: `flyOut(dir, dx, vx = null)`. With
`vx === null` it uses `dist`, `SWIPE_OUT_MS` and `SWIPE_OUT_EASE`, exactly as
today. Otherwise it uses the helper's `end`, `duration` and `easing`.
`release()` passes `pointerType === "mouse" ? vx : null`. The wheel call at
`:8361` stays byte-identical, so `sw_wheel_follow_sign` keeps its context.

### 3. Wheel path: unchanged

**Recommendation: keep the fixed 220 ms.** The owner calls it the reference
("works great"). A wheel gesture also has no release velocity: the commit fires
mid-gesture at 80 px, and the deltas that follow are OS momentum events, not
the fingers. Seeding from them would mean inventing a velocity model. Not an
ASK-OWNER: the owner has already answered it. E3 below pins the wheel at
220 ms.

### 4. D180-7: fold it into this plan

**Recommendation: fold.** D180-7 moves out of the triage plan's EH step 6 and
AP step 8 and into this lane, which merges after AP.

Why fold, not depend on AP:
- AP step 8's acceptance criterion says "a committed mouse drag and a
  committed wheel swipe run the same fly-out (same duration...)". This plan
  makes the mouse duration velocity-dependent, so that criterion would be
  false the day this lane merges. One of the two would have to be rewritten
  anyway.
- EH step 6's `todo` fly-out test would be superseded by E1 here, which
  asserts strictly more (speed, off-screen, enter ordering).
- One PR then carries the handler fix, the curve and the tests that pin
  both.

**What is and is not known (outside voice, accepted).** The owner's complaint
was made against today's mouse behaviour, where no fly-out plays at all: the
card is landed at once and only the 180 ms enter shows. So D180-7 alone may
already answer it. On the wheel, the same 220 ms ease-in is the curve the owner
likes. Nothing shows the 220 ms curve is wrong for a mouse; the only argument
is physical: after a fast drag the card would stop, then accelerate from 0.
The brief asks for release-speed momentum, so the plan keeps it. But step 4
(the D180-7 fix) lands as its **own commit** before step 5 wires the curve, so
the owner can try both builds (Q-C).
- The cost is one triage step fewer in two lanes, and one `todo` test that is
  never written.

Depending on AP instead would mean two CI cycles, a `todo` dance across lanes,
and an AP acceptance criterion that this lane then contradicts.

The handler fix:

```js
document.addEventListener("click", e => {
  if (eatClick) { setEatClick(false); e.stopPropagation(); e.preventDefault(); return; }
  land();
}, true);
```

A click that `eatClick` swallows no longer lands the flight. Every other click
still lands it first. Mid-flight presses are unaffected, because the capture
`pointerdown` listener (`:8373-8391`) lands them before any click fires.

One behaviour does change: a click that arrives while `eatClick` is set no
longer lands the flight, even if it is programmatic. That is safe. Inside the
400 ms decay window every real press has already landed the flight through
the `pointerdown` capture, and every key through the `keydown` capture
(`:8392`). E5 pins both.

The sequence after the fix, for a committed mouse drag:

```
pointerup ──> release(): vx over the 100 ms window, swipeDecision -> dir
          └─> flyOut(dir, dx, vx): animate to end, at speed v, for duration
trailing click (same task, ~0 ms) ──> capture listener: eatClick set
          └─> setEatClick(false), stop + prevent, return   (flight keeps going)
anim.finished (duration ms later) ──> land(): step(dir), enter animation
```

Before the fix, the trailing click ran `land()` first, so the flight was
cancelled in the same task and only the 180 ms enter showed.

The triage doc edits this needs are listed under "Edits the triage doc needs"
below. This lane does not make them. The triage owner makes them on PR #192
before the triage wave is dispatched.

### 5. Reduced motion: unchanged

`release()` returns through `swipeRest(); if (dir) step(dir);` before `flyOut`
is reached (`:8240-8249`), so no curve is ever built. E4 adds a mouse case to
the existing touch-only coverage. The existing `sw_reduced_motion_ignored`
mutant stays valid after a context refresh.

## Lane SM (one serial lane)

Everything lives in `index.html`'s swipe region and its tests, so the work does
not split along file ownership. It runs as **one serial lane, SM**.

- **Goal:** the Goal section above, with the 5 decisions as recommended.
- **Non-goals:**
  - no change to touch, pen or wheel timing; `SWIPE_OUT_MS` and
    `SWIPE_OUT_EASE` keep their values
  - no change to `swipeDecision`, the commit or fling thresholds, the tilt,
    the spring-back, the enter animation or `dist`
  - no new colours, typefaces or label styles; 44px targets and the 380px
    layout unchanged
  - no harness refactor: `tests/helpers/` is untouched (pen events go through
    `b.send` inline)
  - no deck-data or geometry change
- **Owns:**
  - `index.html`, swipe region only: the constants block (`:8131-8134`), the
    new `swipeOutTiming`, `flyOut`, the `flyOut` call at the end of
    `release()`, and the capture click listener (`:8393-8396`)
  - `tests/app.test.js`: the six new `swipeOutTiming` tests and the "swipe
    constants are the plan's values" test
  - `tests/e2e.test.js`: E1-E5 and one recorder helper inside the swipe
    `describe`
  - `tests/mutants/sw_*.patch`: the 9 new patches; hand-edits to
    `sw_click_after_drag_not_suppressed` and `sw_flight_not_landed_on_button`
    (their removed lines move); `refresh_mutants.py` refreshes of any other
    patch that targets only `index.html`
  - `README.md`: the one "N mutant patches" count (`:127`), and nothing else
- **Never touches:** the engine regions, the `const DECKS` line, `data/`,
  `src/`, `tools/`, `tests/helpers/`, `tests/suite_health.py`,
  `tests/mutation_check.sh`, any `b_*` or `c_deck_data_drift` patch body, and
  the triage doc.

### Order relative to the triage lanes

The triage lanes merge **MT, HF, EH, AP**. SM goes **fifth, after AP**:
- AP owns `index.html` and `tests/app.test.js`, and EH owns
  `tests/e2e.test.js`, for the whole triage wave. SM edits all three.
- AP adds four `sw_` and three `qr_` mutants anchored in and near the swipe
  region. SM edits that region and would stale them if it merged first.
- SM is **dispatched after AP merges**, from that main. Developing it in
  parallel would save wall-clock time but means rebasing the hottest file in
  the repo (341 patches target `index.html`). Not worth it for one lane.

### Steps (TDD: each new test is seen red before its code)

Local e2e needs `CHROME_BIN` (here:
`CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`).
Run single tests only. Never run the full e2e suite or `tests/mutation_check.sh`
locally. CI at the head SHA is the oracle.

1. **Unit tests for the helper (red).** Add these six tests to
   `tests/app.test.js`. Every case uses `dist` 654, the 1024x700 value. `start(t)`
   parses `t.easing` and returns `(y1 / x1) * (t.end - |dx|) / t.duration`, the
   initial speed in px/ms along the flight.
   - `swipeOutTiming: an unclamped release flies linearly at its own speed`:
     `(-2, 1, -54, 654)` gives `end` 654, duration 300, `x1 == y1`, and a start
     speed of 2.
   - `swipeOutTiming: a fast flick clamps at SWIPE_MOMENTUM_MIN_MS and still starts at its release speed`:
     `(-10, 1, -54, 654)` gives duration 140, a start speed of 10 within 1%, and
     `y1 <= 1`.
   - `swipeOutTiming: a slow or zero-velocity release starts at the floor and clamps at SWIPE_MOMENTUM_MAX_MS`:
     `(0, 1, -54, 654)` and `(-0.2, -1, 54, 654)` give duration 320 and a start
     speed of 1.5 within 1%.
   - `swipeOutTiming: a velocity against the flight direction counts as zero`:
     `(3, 1, -54, 654)` and `(-3, -1, 54, 654)` give a start speed of 1.5.
   - `swipeOutTiming: a card dragged past dist still flies forward`:
     `(-3, 1, -900, 654)` gives `end` 1110 (`> 900`), `end - |dx|` 210, and a
     start speed of 3 within 1%, positive. With `end` pinned to `dist` the span
     would be -246 and the card would run backward.
   - `swipeOutTiming: the curve stays monotone, in range and forward for every input`:
     for vx in -12..12 (step 0.5), both `dir`, and `|dx|` in {0, 200, 654, 1200},
     the duration is in [140, 320], `end - |dx| >= 210`, `0 < x1 <= 1`,
     `0 <= y1 <= 1`, and the bezier's y never decreases over 101 samples.
   - Extend "swipe constants are the plan's values" with the three new
     constants.
   - **Accept:** all six fail on main (ReferenceError).
   - **Verify:** `node --test --test-name-pattern 'swipeOutTiming|swipe.constants' tests/app.test.js` (expect failures)
2. **The helper and constants (green).** Add `swipeOutTiming` and the three
   constants. Nothing is wired yet.
   - **Accept:** step 1's tests pass; no other `app.test.js` test changes.
   - **Verify:** `node --test tests/app.test.js`
3. **E2e tests (E1, E2 and E5 red; E3 and E4 green on main as guards).** Add a
   recorder helper to the swipe `describe`. It wraps `.scene.animate` and, for
   each call, records `{ kf, timing: anim.effect.getTiming(), t }` in
   `window.__anims`. `getTiming()` returns the normalized easing
   (`"cubic-bezier(0.4, 0, 1, 1)"`), the form the existing tests already read
   (`e2e.test.js:7661`); the raw `opts` string would not compare equal. Before
   returning the animation, the recorder attaches its own
   `anim.finished.then(...)`, which records `finishedAt` and
   `card.getBoundingClientRect()`. Because it is attached first, it runs
   before the app's own `.then(land)`, while `fill: "forwards"` still holds the
   end pose. It also schedules a `setTimeout(30)` that records
   `{ alive: flight && flight.anim === anim, m41, currentTime }`. That sample
   is taken in the page, 30 ms after creation, so CDP latency cannot stretch
   it. Each test runs at `setViewport(1024, 700, false)` and
   `setViewport(380, 800, false)` (`mobile` defaults to true at
   `tests/helpers/cdp.js:189`, so pass `false`), and restores the default
   viewport in `finally`. New mouse tests never key on 220: every existing
   220 assertion (`:299`, `:315`, `:7664`, `:7920`) is a touch test and stays
   valid.
   - **E1** `card swipe (mouse momentum): a fast release flies on at its release speed, leaves the viewport, then the next card enters`.
     A real `b.drag(..., { pointer: "mouse" })` with the trailing click. At
     1024 the legs are `[[-40,16],[-100,32],[-180,48]]` (v = 3.75 px/ms). At
     380 they are `[[-40,20],[-100,40],[-160,80]]` (v = 2 px/ms). At 1024 a
     third, rightward leg `[[40,16],[100,32],[180,48]]` runs from the second
     card (after one `#next` click), so the `dir = -1` path is covered. All
     three are unclamped, so the motion is linear. The test asserts:
     - the 30 ms sample has `alive === true` and `currentTime > 0` (an
       animation can still be pending at 30 ms; never divide by 0);
     - the live average speed, `(m41 - dx) / currentTime`, has the release
       sign and a magnitude in [0.85v, 1.15v];
     - replaying the recorded `kf`/`timing` on a detached div (paused,
       `currentTime` 0 and 4) gives an initial speed signed in the release
       direction with a magnitude in [0.9v, 1.1v];
     - the out animation reached `finishedAt` with `finishRect.right <= 0`
       (leftward) or `finishRect.left >= innerWidth` (rightward);
     - exactly one enter animation (the opacity keyframe) was recorded, with
       `t >= finishedAt`;
     - the card index moved by exactly 1 in the leg's direction, and the card
       is not flipped.
     Red on main: the trailing click lands the flight, so `alive` is false and
     `finishedAt` is never set (the cancelled animation's `finished` rejects).
     Both bounds matter: a lower bound alone passes a curve that leaves too
     fast, or one that runs backward at a large speed.
   - **E2** `card swipe (mouse momentum): a slow commit starts at the floor speed and is off-screen within SWIPE_MOMENTUM_MAX_MS`.
     Mouse legs `[[-8,100],[-15,200],[-25,400]]`. The 100 ms window leaves
     `vx = 0`, and `|dx|` = 25 > 18 commits. The test asserts:
     - `timing.duration <= 320`;
     - the replayed initial speed is in [0.9 x 1.5, 1.1 x 1.5], leftward;
     - `flight === null` within `320 + 1000` ms (a `waitFor`, not a sleep);
     - `finishRect.right <= 0`, and the enter animation was recorded after
       `finishedAt`.
   - **E3** `card swipe (mouse momentum): touch, pen and wheel fly-outs keep the fixed 220ms curve`.
     Three inputs, each asserting that the recorded out animation has
     `duration === 220` and easing `"cubic-bezier(0.4, 0, 1, 1)"`:
     - a fast touch fling (E1's 1024 legs, `pointer: "touch"`);
     - a pen drag through `Input.dispatchMouseEvent` with `pointerType: "pen"`,
       sent inline with `b.send` (the `cdp.js:249` wrapper takes no
       `pointerType`);
     - a wheel gesture of `[[30,0]] x 4`.
     If CDP pen does not surface `pointerType === "pen"` in the page, the pen
     leg asserts that and is dropped. Record it as an auto-decision; do not
     touch `cdp.js`. Green on main; it guards decision 1 and decision 3.
   - **E4** `card swipe (mouse momentum): under reduced motion a mouse commit steps instantly with no animation`.
     Same emulation as the existing reduced-motion test (`e2e.test.js:8132`),
     with `pointer: "mouse"`. The count steps synchronously and the recorder
     saw zero animations. Green on main; it guards decision 5.
   - **E5** `card swipe (mouse momentum): buttons, arrows and the wheel during a live mouse flight land it first, never dropping or doubling a step`.
     Each leg starts a live mouse flight with E2's slow legs (a 320 ms flight,
     the widest window) and asserts `flight !== null` before acting:
     - (a) a real CDP mouse click on `#next` lands the flight, then steps: the
       index moves by 2 in total and the card is not flipped;
     - (b) an `ArrowRight` keydown lands the flight, then steps: +2 in total;
     - (c) a wheel gesture started mid-flight is skipped (`index.html:8340`):
       the index moves by exactly 1 and the flight still finishes off-screen.
     Red on main at the `flight !== null` setup assertion (no mouse flight
     survives the trailing click); green from step 4. It guards the
     regression the reorder could cause: a real click that is not eaten must
     still land the flight before `#next` steps.
   - **Accept:** E1, E2 and E5 fail on main for the reasons stated; E3 and E4
     pass.
   - **Verify (one at a time):** `node --test --test-name-pattern 'mouse.momentum.:.a.fast.release' tests/e2e.test.js`, then the same with `a.slow.commit`, `touch,.pen.and.wheel`, `under.reduced.motion.a.mouse`, `buttons,.arrows.and.the.wheel.during.a.live`
4. **D180-7: the click listener, as its own commit.** Reorder as shown in
   decision 4. Commit it alone, so the owner can try this build before the
   curve (Q-C).
   - **Accept:** E1's `alive` and `finishedAt` assertions now pass. Its speed
     assertions still fail, because the 220 ms ease-in starts from 0. That
     staged red proves the two halves are tested separately. E5 passes.
   - **Verify:** `node --test --test-name-pattern 'mouse.momentum.:.a.fast.release' tests/e2e.test.js` (expect only the speed assertions to fail), then `node --test --test-name-pattern 'buttons,.arrows.and.the.wheel.during.a.live' tests/e2e.test.js`
5. **Wire the curve.** `flyOut(dir, dx, vx = null)`; `release()` passes
   `pointerType === "mouse" ? vx : null`.
   - **Accept:** E1-E5 pass at both widths. These existing tests pass when run
     one at a time:
     - mouse commit, flip and spring-back (`:7775`);
     - tap during the fly-out (`:7895`);
     - buttons and arrows during the fly-out (`:7924`);
     - Chrome's real mouse-release order (`:8569`);
     - a click more than 400 ms after a mouse drag (`:8670`);
     - landing a flight during a mid-flight tap (`:8717`). Its 100 ms wait
       sits inside a 320 ms clamped flight at vx 1.67, so check it explicitly;
     - the touch fly-out test (`:7645`);
     - EH's new stale-decay killer (triage EH step 5).
   - **Verify:** `node --test --test-name-pattern 'mouse.momentum' tests/e2e.test.js`, then each listed test with its own anchored `--test-name-pattern`, then `node --test tests/app.test.js`
6. **Mutants.** Each patch carries `# kills:` and an anchored `# suite:` line
   with `.` for every space and paren, never quotes. The 9 new mutants, each
   with the test that kills it:

   | Patch | Mutation | Killer |
   |---|---|---|
   | `sw_momentum_max_clamp_dropped` | drop `Math.min(SWIPE_MOMENTUM_MAX_MS, ...)` | `swipeOutTiming: a slow or zero-velocity release...` (400 ms, not 320) |
   | `sw_momentum_min_clamp_dropped` | drop `Math.max(SWIPE_MOMENTUM_MIN_MS, ...)` | `swipeOutTiming: a fast flick clamps...` (60 ms, not 140) |
   | `sw_momentum_floor_dropped` | the floor becomes `0` | `swipeOutTiming: a slow or zero-velocity release...` (start speed 0, not 1.5) |
   | `sw_momentum_easing_unseeded` | `y1` becomes `0` | `swipeOutTiming: an unclamped release...` (start speed 0, not 2) |
   | `sw_momentum_reversed_velocity` | `-dir * vx` becomes `Math.abs(vx)` | `swipeOutTiming: a velocity against the flight direction...` (3, not 1.5) |
   | `sw_momentum_overshoot_unguarded` | `end` becomes `dist` | `swipeOutTiming: a card dragged past dist still flies forward` (span -246, backward start) |
   | `sw_momentum_not_applied` | `release()` passes `null` for mouse too | E1 (replayed start speed 0, live average about 0.3v) |
   | `sw_momentum_on_touch` | the `pointerType === "mouse"` gate is dropped | E3 (touch duration 174, not 220) |
   | `sw_click_lands_before_eatclick` | restores `land();` above the `eatClick` check (D180-7) | E1 (`alive` false, `finishedAt` unset) |

   - Hand-edit `sw_click_after_drag_not_suppressed` (it drops the `eatClick`
     line, which now ends in `return;`) and `sw_flight_not_landed_on_button`
     (it drops `land();`, which is now below the check). Keep each mutation's
     meaning and update the `# Context-refreshed` note. Their killers are
     unchanged; re-prove both.
   - Run `python3 tools/refresh_mutants.py` for context-only drift (expected:
     `sw_reduced_motion_ignored`, `sw_velocity_not_aged`).
   - **Prove every kill locally, one mutant at a time** (OV-2 found a mutant
     with no killer). For each of the 11 patches (9 new, 2 hand-edited), run
     `git apply tests/mutants/<p>.patch`, then the patch's own `# suite:`
     command, expecting a nonzero exit, then `git apply -R tests/mutants/<p>.patch`.
     Record each exit code in the PR body. CI's mutation gate at the head SHA
     is the final proof.
   - **Accept:** every patch applies, every local suite command exits nonzero
     under its mutant, and the tree is clean afterwards.
   - **Verify:** `for p in tests/mutants/sw_*.patch; do git apply --check "$p" || echo "STALE $p"; done; python3 tools/refresh_mutants.py --check && git status --porcelain`
7. **README count.** After AP the corpus is 527 patches. SM adds 9, making
   536. README's "477" holds only while n <= 531
   (`test_readme_currency.py:113-130`, the 90% floor), so S4's trigger fires
   here. Restate the count as the exact number on disk.
   - **Verify:** `python3 -m unittest tests.test_readme_currency`
8. **Final local gate.**
   - **Verify:** `python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py && python3 tools/refresh_mutants.py --check && node --test tests/app.test.js`

### Standing gates

- CI is green at the **verified head SHA**: `gh pr view <n> --json
  state,headRefOid,mergeable` matches the local tip. A lone survivor on an
  unrelated mutant is rerun at the same SHA first.
- A fresh `swarm-reviewer` returns PASS or PASS_WITH_NITS at that SHA. It is
  briefed with this lane's goal, non-goals, ownership, the acceptance criteria
  of steps 1-8, and the 9-row mutant/killer table.
- **Bounce cap 2**, with one counter for every retry path.
- Merge is operator-gated. AFK allows `gh pr merge <n> --merge` once both gates
  hold.

## Risks

- **R1, e2e timing on CI.** E1's live sample is taken in the page, 30 ms after
  `animate()`. A stalled main thread could still push it past the end of a
  174 ms flight. Mitigation: the deterministic replay carries the speed claim;
  the live sample carries only `alive` and a 0.9x average. On a flake, the
  rerun policy applies before any change.
- **R2, shard time.** 3 of the 9 new mutants select e2e (about 1 more per
  shard). The triage R1 already tracks the 6-minute shard target; SM reports
  per-shard wall-clock at its head SHA.
- **R3, feel.** The constants are a judgement call (Q-B). They are three
  named constants, so retuning is a one-line change plus the unit expectations.
- **R4, triage doc not edited.** If PR #192 merges unedited, AP step 8 would
  ship the bare D180-7 fix with a "same duration as the wheel" criterion, and
  this lane would then contradict it. SM's dispatch is gated on the triage doc
  carrying the edits below, or on AP's PR not containing step 8.

## ASK-OWNER

- **Q-A (taste, not blocking).** Should touch get momentum too, in a later
  plan? Recommendation: no. Touch has no complaint, and its fly-out already
  plays in full.
- **Q-B (taste, not blocking).** The constants: MIN 140 ms, MAX 320 ms,
  floor 1.5 px/ms. Recommendation: ship these, then tune after a hands-on
  try.
- **Q-C (taste, not blocking).** Try the D180-7 fix alone first? The owner's
  complaint was made while no mouse fly-out played at all, so the bare fix
  (step 4's commit) may already be enough. Recommendation: ship both. The
  brief asks for release-speed momentum, and step 4 is its own commit, so
  reverting step 5 alone is a one-commit revert if the owner prefers the
  220 ms curve.

None of them blocks the lane. Under AFK the recommendations are taken and recorded.

## Edits the triage doc needs (PR #192, made by its owner, not by this lane)

Line numbers are in `docs/plans/2026-10-01-post-refactor-triage.md` at
origin/claude/post-refactor-triage.

1. **`:109` (D180-7 row), Label:** `FIX (owner, 2026-10-01)` becomes
   `FIX (owner, 2026-10-01), moved to docs/plans/2026-10-01-swipe-momentum.md (lane SM)`.
2. **`:145` (Owner answers, D180-7):** "Worked in EH step 6 and AP step 8."
   becomes "Moved to lane SM in `docs/plans/2026-10-01-swipe-momentum.md`,
   which merges after AP. The owner's momentum follow-up makes the mouse
   duration velocity-dependent, so 'same fly-out as the wheel' no longer
   holds."
3. **`:163-164` (FIX ranking):** "Both are in AP." becomes "R186-5 is in AP;
   D180-7 is in lane SM (swipe-momentum plan)."
4. **`:209-211` (Lanes intro):** "two of its mutants
   (`sw_eatclick_timer_not_cleared`, and the D180-7 one) need killer tests
   that EH writes. AP adds those mutants only after rebasing onto EH's merge."
   becomes "one of its mutants, `sw_eatclick_timer_not_cleared`, needs a
   killer test that EH writes. AP adds it only after rebasing onto EH's merge.
   Lane SM (swipe-momentum plan) follows AP."
5. **`:297` (AP non-goals):** "no behaviour change, except D180-7" becomes
   "no behaviour change (D180-7 moved to lane SM)".
6. **`:348-355` (AP step 8):** delete the step.
7. **`:391-396` (EH step 6):** delete the step, including its duplicated
   Verify line.
8. **`:426` (Projected cost):** "D180-7 and R186-5 add two small steps to AP:
   about one extra CI run." becomes "R186-5 adds one small step to AP. D180-7
   is costed in the swipe-momentum plan."
9. **`:446-447` and `:450-451` (Auto-decisions):** append to each: "Superseded
   2026-10-01: D180-7 moved to lane SM; EH writes no fly-out test and AP makes
   no handler change."
10. **`:452` (Auto-decisions):** "After AP, the corpus is 528 patches with
    D180-7. README's 477 holds until 531." becomes "After AP, the corpus is
    527 patches. README's 477 holds until 531; lane SM adds 9 and restates the
    count."
11. **`:136` (S4 row), Reason:** append "Expected to fire in lane SM, which
    restates the count."
12. **`:489` (Worktree parallelization, AP row):** "EH (2 mutants only)"
    becomes "EH (1 mutant only)". Add a row: `| SM | index.html swipe region,
    tests/app, tests/e2e | AP (merged) |`.
13. **`:499` (T4):** becomes "**T4** superseded: D180-7 moved to lane SM
    (swipe-momentum plan)."
14. **`:513` (OV-4), Answer:** append "(superseded 2026-10-01: moved to lane
    SM)".
15. **`:149-155` (Original question 1):** leave as the historical record,
    and add one line: "(Routing superseded; see Owner answers.)"

## Projected cost

| | Count |
|---|---|
| Lanes | 1 (SM), serial, after triage AP |
| Subagent runs | 1 lane run + 1 reviewer, plus about 1 expected bounce (lane + reviewer): about 4 |
| CI runs | About 2 on the lane PR (first push and one fix-up), plus about 1 flake rerun: about 3 |
| This plan | 1 docs PR, 1 CI run |

## Engineering review (/plan-eng-review, 2026-10-01)

Spawned session: every decision point was auto-chosen on its recommended
option. Nothing destructive was on offer.

### What already exists

- `swipeDecision` (`index.html:8137-8148`) already gives `dir` and `vx`;
  `release()` already computes `vx` over the 100 ms window. Nothing new is
  measured.
- `flyOut`'s `dist` already ends off-screen (probed). The helper keeps it as
  the end, except when the drag overshoots it.
- The capture `pointerdown` (`:8373-8391`) and `keydown` (`:8392`) listeners
  already land a live flight before any button or key acts. E5 relies on
  them; it does not add a path.
- `setEatClick` and its 400 ms mouse decay stay unchanged.
- The e2e harness (`b.drag`, `setViewport`, `b.send`) covers every input the
  tests need, so `tests/helpers/` stays untouched.

### NOT in scope

- Momentum for touch or pen (Q-A), and any wheel velocity model (decision 3).
- Retuning `SWIPE_OUT_MS`, `SWIPE_OUT_EASE`, the spring-back, the enter
  animation or the commit thresholds.
- `linear()` easing (Safari 17.2+); cubic-bezier is enough.
- Any change to `tests/helpers/`, `tests/mutation_check.sh` or the triage doc.
- Deck data and geometry.

### Failure modes

| Path | Failure | Test | Handled | Visible |
|---|---|---|---|---|
| Fast mouse flick | MIN clamp drops; flight under 140 ms | unit: fast flick | yes | no |
| Slow mouse commit | `vx` 0; card crawls or never leaves | unit: slow; E2 | yes (floor + MAX) | no |
| Reversed last motion | negative speed seeds a backward start | unit: against direction | yes (projection, floor) | no |
| Drag past `dist` | span goes negative; card runs backward | unit: dragged past dist | yes (`end` guard) | no |
| Trailing click | lands the flight at once (today's bug) | E1 | yes (step 4) | yes, today |
| Real click on `#next` mid-flight | step dropped or doubled | E5 (a) | yes (pointerdown capture) | no |
| Key mid-flight | step dropped or doubled | E5 (b) | yes (keydown capture) | no |
| Wheel mid-flight | second commit during the flight | E5 (c) | yes (`:8340`) | no |
| Touch, pen, wheel | pick up the mouse curve | E3 | yes (gate) | no |
| Reduced motion | a curve is built | E4 | yes (early return) | no |
| Animation pending at the 30 ms sample | divide by 0 in the test | E1 `currentTime > 0` | yes | no |

No row is untested and silent at once, so there are no critical gaps.

### Performance

There is one extra arithmetic call per release and no new listeners, timers
or layout reads. Nothing to flag.

### Parallelization

Sequential implementation, no parallelization opportunity. Every step touches
the swipe region of `index.html` or the tests that pin it.

### Findings and decisions (all accepted)

| # | Source | Severity | Finding | Applied |
|---|---|---|---|---|
| OV-1 | outside voice | P2 | "D180-7 is a known half-fix" was unsupported | decision 4 softened; step 4 is its own commit; Q-C added |
| OV-2 | outside voice | P1 | a drag past `dist` made the fly-out run backward | `end` guard in the helper; overshoot unit test; `sw_momentum_overshoot_unguarded` |
| OV-3 | outside voice | P2 | E3 compared the raw easing string, which would never equal the normalized one | the recorder stores `effect.getTiming()` |
| OV-4 | outside voice | P2 | the speed checks had lower bounds only | two-sided, signed bounds; a rightward leg at 1024 |
| F1 | review | P2 | E1 could divide by a pending animation's `currentTime` 0 | `currentTime > 0` asserted first |
| F2 | review | P1 | no test pinned that a non-eaten click still lands the flight after the reorder | E5 added |
| F3 | review | P3 | the reorder's one behaviour change was not written down | note under decision 4 |
| F4 | review | P3 | no diagram of the release / click / land order | ASCII sequence under decision 4 |
| F5 | review | P3 | risk of new mouse tests keying on 220 | note in step 3; the 220 tests are all touch |

### Auto-decisions

1. **Scope gate:** the user named the target (this plan). The complexity
   check trips on paper (`index.html`, 2 test files, README, 11 patches).
   Kept as one lane: the mutants are required by the brief, and no new class
   or module is added.
2. **Outside voice:** Codex was run directly (`codex exec`, read-only, high
   effort). The skill's probe helpers could not be sourced under the worktree
   guard; the result is the same review.
3. **OV-1 to OV-4 and F1 to F5:** each took its recommended fix, listed in
   the table above.
4. **Pen leg (E3):** if CDP does not surface `pointerType === "pen"`, the leg
   asserts that and is dropped rather than changing `cdp.js`. This keeps the
   non-goal on `tests/helpers/`.
5. **D180-7:** folded into this lane (decision 4), not left to AP.
6. **Q-A, Q-B, Q-C:** each recommendation is taken for the lane. None blocks
   it.

### Implementation tasks

- [ ] Steps 1-2: the helper, its constants and six unit tests (red, then green).
- [ ] Step 3: the recorder and E1-E5 (E1, E2, E5 red; E3, E4 green).
- [ ] Step 4: the D180-7 reorder, as its own commit.
- [ ] Step 5: wire the curve on the mouse path.
- [ ] Step 6: 9 new mutants and 2 hand-edits, each kill proven alone.
- [ ] Step 7: restate the README mutant count (536).
- [ ] Step 8: the final local gate; then CI at the head SHA and a fresh reviewer.

### Decision ledger

| Decision | Choice | Status |
|---|---|---|
| 1. Scope | mouse only | decided |
| 2. Motion model | `swipeOutTiming`; clamp 140-320 ms; seeded slope; floor 1.5 px/ms; `end` guard | decided (constants: Q-B) |
| 3. Wheel | unchanged 220 ms | decided |
| 4. D180-7 | folded into SM, own commit | decided (Q-C) |
| 5. Reduced motion | instant step, unchanged | decided |

Approval readiness: PASS. Every open item is a taste call with a recorded
default; none blocks dispatch.

### Completion summary

- Step 0, scope challenge: scope accepted as is (one lane).
- Architecture review: 2 issues (OV-1, F3).
- Code quality review: 1 issue (F4).
- Test review: diagram produced; 5 gaps (OV-3, OV-4, F1, F2, F5).
- Performance review: 0 issues.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0 proposed.
- Failure modes: 0 critical gaps.
- Outside voice: ran (codex); 4 findings, all accepted.
- Parallelization: 1 lane, sequential.
- Lake score: 9/9 findings took the complete option.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | not run | - |
| Codex Review | `/codex review` | Independent second opinion | 0 | not run | - |
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 1 | ISSUES RESOLVED | 9 found, 9 applied, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | - |

- **OUTSIDE COVERAGE:** codex, completed, 4 findings (OV-1 to OV-4), all
  accepted.
- **UNRESOLVED:** 0.
- **VERDICT:** ENG REVIEWED. The plan is ready for lane SM's dispatch once
  triage AP has merged and PR #192 carries the edits above.

NO UNRESOLVED DECISIONS
