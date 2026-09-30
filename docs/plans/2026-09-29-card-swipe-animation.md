# Card swipe animation (Tinder-style) - plan

**Goal (testable).** A horizontal drag on `#card` (touch, pen or mouse) moves
`.scene` with the pointer and tilts it. On release, a drag of more than 55px or
a fling of more than 0.5 px/ms flies the card off-screen in the drag direction,
then steps. Left is next and right is previous. Anything less springs the card
back. There is no library, no new file, and no edit to `step()`, `render()`,
`flip()` or any `step` call site.

- **Date:** 2026-09-29
- **Base:** `origin/main` @ `e428946` (PR #162 "CHORD PROGRESSION" merged). The
  brief cites `e728912`; every line number below was re-read at `e428946`.
- **Since drafted:** PR #163 (`41b54d1`) **merged**; `origin/main` is now
  `4c6f700`. It added `.reroll` to `#shuffle` in mode S, rewrote the
  `#panel-seq-note` copy, renamed PRINT-ONLY PDF to CHORD-ONLY PDF, and took
  the mutant corpus from 441 to 442. FLOORS are unchanged (205 / 155). **SW
  branches from `4c6f700`** (ER2). Line numbers in this plan are at
  `e428946`; the ones SW edits or guards, re-read at `4c6f700`:

  | Anchor | `e428946` | `4c6f700` |
  |---|---|---|
  | `main{...}` (insert the CSS after it) | `:406` | `:406` |
  | `.scene` rule | `:427` | `:427` |
  | `render()` / `setOrder()` | `:6903` / `:6966` | `:6907` / `:6970` |
  | `const card` / `step()` | `:8074` / - | `:8078` / `:8083` |
  | `#prev`/`#next` `step` call sites | `:8096-8097` | `:8100-8101` |
  | document keydown handler | `:8224-8254` | `:8218-8260` |
  | the `let tx` touch block SW replaces | `:8255-8261` | `:8261-8267` |
- **Shape:** one `/swarm` lane, **SW** (`claude/card-swipe`). §3 explains why
  it does not split.
- **Brief:** `docs/prompts/2026-09-29-card-swipe-animation.md`
- **Related:**
  - `docs/plans/2026-09-24-quality-eval.md`, for the §6 merge gates and N1-N10;
  - `docs/plans/2026-09-28-android-bg-and-menu.md`, the structural template
    and N15-N19;
  - `docs/plans/2026-09-29-chord-sequence-mode.md`: S1 and S2 are merged, and
    that plan owned `render()`, `setOrder()` and the footer;
  - `docs/plans/2026-09-29-backlog-and-refactor.md`, which a parallel agent is
    writing (see "Dependency on backlog refactor");
  - `docs/plans/2026-09-18-swipe-coverage.md`, which introduced the four swipe
    tests.

---

## §1 Goal and non-goals

The goal is stated above. **Non-goals** N1-N10 (quality-eval), N13 (no edits to
`tests/mutation_check.sh`), N15-N19 (android/menu) and N20-N28 (chord
sequence) carry over unchanged. Two of them bite hardest here:

- N9: never run the full `tests/mutation_check.sh` or the full
  `tests/e2e.test.js` locally;
- N16/N28: no CHROME_BUDGET or LANDSCAPE_BUDGET row moves.

New non-goals, which together are the v1 cut:

| # | Non-goal | Why deferring is cheap |
|---|---|---|
| N29 | No vertical swipe action. A vertical drag stays the browser's scroll | `touch-action:pan-y` is the only line that would change |
| N30 | No swipe-to-flip gesture. Flip stays tap, Enter or Space | - |
| N31 | No physics or spring library, and no spring overshoot. Every curve is a `cubic-bezier` | Keyframes are data, so a later overshoot is one easing string |
| N32 | No haptics (`navigator.vibrate`) | - |
| N33 | No visible two-card stack (S2 in §2.2). One `#card`, one `#front`/`#back` pair | - |
| N34 | No swipe on the print preview. No print change beyond one "print carries no transform" rule | - |
| N35 | No change to the panel or sheet gestures, markup or CSS | - |
| N36 | `#prev`/`#next`, ArrowLeft/ArrowRight and Shuffle do NOT animate in v1 (D2) | The fly-out is one function, and a button can call it later |
| N37 | No velocity-matched fly-out duration. Every duration is fixed (D6) | - |
| N38 | No edit to `step()`, `render()`, `flip()`, `setOrder()`, the footer markup, or any `step` call site (`:8096`, `:8097`, `:8252`, `:8253`) | - |
| N39 | No new DOM element and no new id. The drag element is the existing `.scene` | - |
| N40 | No change to the `#prev`/`#next`/arrow flip reset. On a flipped card it still reverse-flips over 450ms with the next card's content (pre-existing; the swipe path fixes it in `land()` only, OV2) | A follow-up can reuse `land()`'s suppression in `step()` itself, with the owner's say-so, since that edits `step()` |

## §2 Findings

### 2.1 Research, with sources

Each URL was fetched on 2026-09-29. The CodePen returns a Cloudflare 403 to
curl, so it is cited by URL only.

| # | Finding | Source |
|---|---|---|
| R1 | Pointer Events give one code path for touch, mouse and pen. `setPointerCapture` keeps the move stream on the card when the finger leaves it, and capture is released automatically on `pointerup` or `pointercancel` | MDN [`Element.setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture); [javascript.info/pointer-events](https://javascript.info/pointer-events) |
| R2 | `touch-action: pan-y` keeps vertical panning with the browser and gives horizontal pans to the page. Changing it mid-gesture has no effect. It is supported on iOS Safari 13+ and Chrome, but not on desktop Safari, where a mouse drag does not need it | MDN [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action); [caniuse css-touch-action](https://caniuse.com/css-touch-action) |
| R3 | Once the browser claims a gesture (a vertical scroll), it fires `pointercancel`, and the handler must restore state | MDN [`pointercancel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event) |
| R4 | `el.animate()` returns an `Animation`. `finished` resolves on completion and rejects with `AbortError` on `cancel()`. `getAnimations()` exposes the animation to a test, which can `finish()` it synchronously | MDN [`Element.animate`](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [`Animation.finished`](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished) |
| R5 | The Tinder pattern: the drag sets `translate(dx) rotate(dx*k)` with no transition, and release either commits on distance or velocity, or springs back | C. Heilmann, ["Tinderesque"](https://christianheilmann.com/2015/09/06/tinderesque-building-a-tinder-like-interface-with-css-animations-and-vanilla-js-justcode/) (2015); R. Vermeer, ["Tinder swipe cards"](https://codepen.io/RobVermeer/pen/japZpY) |
| R6 | `prefers-reduced-motion: reduce` is readable from JS through `matchMedia`, and live changes are seen by reading `.matches` at event time | MDN [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) |

**Spike: measured in a scratch copy with Chrome over CDP, then deleted.** The
spike put the reference design in §3.2 into a scratch copy of `index.html` and
drove it with the repo's `tests/helpers/cdp.js`.

| # | Measured |
|---|---|
| M1 | `Input.dispatchTouchEvent` produces pointer events with `pointerType "touch"`, in the order `pointerdown`, `touchstart`, `pointermove`, `pointerup`, `touchend`. The CDP `timestamp` param is honoured: the `event.timeStamp` deltas matched the 50ms steps exactly. **Timed drags need no wall-clock sleeps.** |
| M2 | A horizontal touch drag under `pan-y` fires NO `click`, and a touch tap does. A **mouse drag DOES fire `click` after `pointerup`**, so the click-after-drag pitfall is real for mouse only. A mouse click with no movement fires `click` |
| M3 | A vertical touch drag fires `pointercancel` with `clientX 0`, and the page scrolls. The handler must use the last `pointermove` dx, not the cancel event's |
| M4 | Today's untimed `b.swipe(-50)` commits under the new code: dt 0 reads as an infinite fling. The deadzone test and the 60px bracket therefore need a timed helper |
| M5 | `body{overflow-x:clip}` and `html{overflow-x:clip}` do NOT stop page scroll. At 380px with a +100px drag, `scrollWidth` was 477 and `scrollTo(500,0)` reached `scrollX 97`, because the value propagates to the viewport as `hidden`, which script can still scroll. **`main{overflow-x:clip}` holds**: `scrollWidth 380`, `scrollX 0`, at 380x800 and 844x390. A left fly-out (card at `left -342`) never widened the page with any of the three rules |
| M6 | With the guards in `release()` and `pointerdown`, a drag with the panel opened before or during the gesture leaves `#count` unchanged. With the guards removed, it steps. The CDP touch reached the card even with `main` inert, so **inert alone does not hold the guard**, and `sw_panel_guard_dropped` is killable |
| M7 | Rapid input: after a committed swipe, two `#next` clicks during the fly-out gave exactly three steps. With reduced motion emulated, a drag steps, the mid-drag transform is `none`, and `getAnimations().length === 0` |
| M8 | Bytes: the CSS plus JS block adds 3,875 bytes (0.85%) to the 456,996-byte `index.html`, comments included. The two CSS rules added after the spike (`main{overflow-x:clip}` and the print rule) bring it to about 3,950 bytes |
| M9 | Mutant staleness: all 441 patches were run with `git apply --check` against the modified copy. The new CSS goes **before `:407`** (right after `main{...}` at `:406`), and the JS replaces `:8255-8261`. Only `e_swipe_deadzone_dropped` and `e_swipe_direction_inverted` go stale. Inserting before `:439` staled `e_flip_transform` and `e_card_press_ring_is_square`; inserting before `:858` staled `c_armed_delete_has_no_press_state` |
| M10 | `b.settle()` waits 500ms, which is more than 220ms + 180ms, so existing settle-based tests are not perturbed |

**`overscroll-behavior-x` (brief R2).** Keep it. `pan-y` covers only drags
that start on `.scene`. A horizontal drag on the table, the header or the
footer still reaches the browser, and the root rule stops Android's history
gesture there. `f_overscroll_x_dropped` stays applicable and killed, and the
row-95 test is unchanged apart from moving to the timed helper.

### 2.2 Approaches

| | Bytes (vs 456,996) | Complexity | Test cost | Verdict |
|---|---|---|---|---|
| **A2 + S1** (WAAPI, single card) | **~3.95 KB, measured (M8)** | 3 `let`s (`drag`, `flight`, `eatClick`). No new DOM. One new failure mode: a pending flight when other input arrives, handled by `land()` | `getAnimations()` + `finish()` in one `b.eval`, which is deterministic | **Recommended** |
| A1 + S1 (CSS transition) | ~4.4 KB, estimated | Adds a class per state, and chains on `transitionend` or `transitioncancel`. `transitionend` never fires when the value does not change (a zero-distance spring-back), so it needs a timeout fallback | A test must wait for `transitionend` or force `transition:none`. `getAnimations()` lists CSS transitions too, so `finish()` works, but the chain logic is what fails | Reject: more bytes and an untestable edge case, and nothing the owner would see |
| A2 + S2 (two-card stack) | ~8-10 KB, estimated | A second face pair means duplicate ids (`#front` and `#back` are referenced by `aria-describedby` and many tests), a second SVG diagram per render, `aria-hidden` on the under-card, and **edits to `render()`**. On a right drag the under-card must show `prev`, so both neighbours are rendered | Every CHROME_BUDGET/LANDSCAPE_BUDGET row measures `.card`, so each needs proof that the under-card is excluded | Reject: it breaks N38/N39 and N16, and the owner sees a card underneath, which the brief lists as a v1 non-goal |
| A1 + S2 | worst of both | - | - | Reject |

A1 would be awaited the same way, because `getAnimations()` returns
`CSSTransition` objects. It is rejected on chaining complexity, not
testability.

### 2.3 Constants

All of these are top-level `const`s in the swipe block. The app tests read
them with `app.get("SWIPE_COMMIT_PX")` and similar calls.

| Const | Value | Reason | Pinned by (inside / outside) |
|---|---|---|---|
| `SWIPE_COMMIT_PX` | `55`, absolute | Today's value. The card is 255-330px wide on phones, so 55px is 17-22%, and a fraction of card width would change the feel per device for no gain (D4) | e2e: timed slow 50px holds and timed slow 60px commits (the existing bracket, now timed). app: `swipeDecision(55,0)===0` and `swipeDecision(55.5,0)===-1` pin `>` against `>=` |
| `SWIPE_FLING_PX_MS` | `0.5` | A short flick of about 30px in about 50ms is 0.6 px/ms, and a deliberate slow drag is under 0.2. 0.5 sits between them | e2e: 30px in 50ms (0.6) commits, and 30px in 75ms (0.4) springs back. app: `swipeDecision(-20,-0.49)===0` and `swipeDecision(-20,-0.51)===1` |
| `SWIPE_FLING_WINDOW_MS` | `100` | Velocity comes from the last 100ms of `pointermove`, not the whole gesture, so a slow drag that ends in a flick commits and a fast drag that stops dead does not | e2e: 200px over 1s, the last 20px in 30ms, commits. app: none (it is in `release()`) |
| `SWIPE_SLOP_PX` | `10` | Below this a gesture is a tap. It gates the drag visual, click suppression and flings | e2e: an 8px flick in 10ms never steps and the tap still flips. app: `swipeDecision(-10,-5)===0` and `swipeDecision(-11,-5)===1` |
| `SWIPE_TILT_DEG_PER_PX` | `0.05` | 5° at a 100px drag | e2e: +100px hold reads 5° ±0.2° |
| `SWIPE_TILT_MAX_DEG` | `8` | Bounded so a wide landscape drag does not spin the card | e2e: +400px hold reads 8° ±0.2° |
| `SWIPE_OUT_MS` / `SWIPE_OUT_EASE` | `220` / `cubic-bezier(.4,0,1,1)` | The card accelerates away (ease-in). This is shorter than the .45s flip, so navigation feels quicker than turning | e2e: the fly-out animation's `effect.getTiming()` duration and easing |
| `SWIPE_BACK_MS` / `SWIPE_EASE` | `260` / `cubic-bezier(.2,.7,.25,1)` | The spring-back reuses the flip's curve, so the app has one motion language (N31: no overshoot) | e2e: spring-back timing read the same way |
| `SWIPE_IN_MS` / `SWIPE_IN_PX` | `180` / `24` | The entering card slides 24px in from the side opposite the exit, fading from 0 to 1. The move is small, so the diagram is readable almost at once | e2e: the enter keyframe 0 transform sign is `dir*24`, and opacity 0 |

The timing rows are asserted on the `Animation` objects, never by waiting.

### 2.4 Motion direction (`/frontend-design:frontend-design`, run with the brief's quoted prompt)

The skill's output, direction only:

- **Metaphor:** a paper card slid across a felt table (`#1a1815`/`#26221c`),
  not a dating-app judgement. The card never leaves the plane: it translates
  and yaws a little (`rotate`, Z axis only). There is no lift, scale, shadow
  or tint.
- **Follow:** 1:1 with the finger past the 10px slop, with no easing and no
  lag. `will-change: transform` is set only while a gesture is live.
- **Commit:** the card accelerates away (ease-in, 220ms). The tilt at release
  is kept and grows to the clamp as the card leaves, so the exit continues the
  hand's motion.
- **Spring-back:** the flip's own decelerating curve (260ms), with no
  overshoot. It reads as "the card settles back onto the table".
- **Entering:** the next card is dealt in from the side opposite the exit
  (24px, 180ms, fading from 0 to 1). This matches the order: a left swipe
  brings the next card in from the right.
- **One boldness:** the tilt. Everything else stays quiet.

**Overrides of the skill's defaults**, each recorded:

| O | Skill default | Override | Why |
|---|---|---|---|
| O1 | Distinct palette, type and token system | None produced | CLAUDE.md "Preserve the visual system", and the brief: no new colour, typeface or shadow language |
| O2 | A lift shadow while dragging | Dropped | New shadow language. `.card:active` already draws the press ring |
| O3 | Pivot the tilt about the grab point or the bottom edge | The centre (the default `transform-origin`) | A new `transform-origin` on `.scene` is one more line in the region that the `e_landscape_card_*` mutants anchor on. The difference cannot be seen at 8° |
| O4 | A velocity-matched exit duration | Fixed 220ms (N37) | Deterministic timing asserts, and fewer branches |
| O5 | A slight overshoot on spring-back | None (N31) | One easing family with the flip |

ASCII sketch, 380px portrait (the card is about 300px wide, with a 16px
gutter on each side):

```
 rest                 drag -80 (tilt -4deg)    commit (fly-out, 220ms)   enter (180ms)
|  +------------+  |  |+------------+     |    |      +------------+|  |    +------------+|
|  |    G5      |  |  |/    G5      /     |  ...  <-- card leaves  |  |  ->|    Am7     ||
|  |  (diagram) |  |  |  (diagram) /      |    |  main clips at 0px |  |   | (diagram)  ||
|  +------------+  |  |+------------+     |    |                    |  |    +------------+|
|  <-   1/25   ->  |  |  <-  1/25   ->    |    |   <-  1/25  ->     |  |  <-   2/25   ->  |
spring-back (260ms): drag state -> rest, with the flip's curve and no overshoot.
```

Landscape 844x390, one-row header: the card is about 190x262, centred.

```
+-- header (one row) -------------------------------------------------+
|                    +--------+            drag +80: card follows,    |
|                    |  G5    |   ---->    tilt +4deg; main clips the |
|                    |diagram |            exit at the viewport edge  |
|                    +--------+                                      |
|  <-                     1 / 25                                  ->  |
+----------------------------------------------------------------------+
```

### 2.5 Interaction matrix

| State \ event | pointerdown on card | pointermove | pointerup | pointercancel | tap (click) | `#prev`/`#next`/arrows | open panel or sheet |
|---|---|---|---|---|---|---|---|
| Rest | Starts `drag`, captures the pointer, cancels any `.scene` animation | Past slop: sets the transform and `will-change` | commit, spring-back or tap | spring-back from the last dx | `flip()` as today | step, as today | as today |
| Dragging | a second pointer, of any type, is ignored: `drag` is bound to one `pointerId`, and move/up/cancel from any other id are dropped (OV5) | follows | decides | springs back | a mouse click after a drag past slop is **eaten** (M2) | Document capture `land()` is a no-op. The key steps, then the release decides against the new card | release is forced to dir 0 and springs back (M6) |
| Fly-out (`flight`) | Document capture: `land()` (step plus enter), and the click is eaten, then a fresh drag starts | - | - | - | eaten, so the wrong card is never flipped | Document capture `land()` runs first, then the button's own step. No drop, no double (M7) | `land()` on the opener's pointerdown or keydown. The card rests on the new index |
| Spring-back or enter | Cancels it (`getAnimations().cancel()`) and starts from rest | - | - | - | `flip()` (the card is already on its index) | step (the enter animation continues harmlessly) | as today |
| Flipped card | as rest | as rest. **The back face shows during the fly-out** | commit: `step()` clears `flipped`, and the next card arrives front-up | spring-back, still flipped | un-flips | as today | as today |
| `panelOpen` or `sheetOpen` | **ignored** | - | - | - | as today | the existing keyboard guard | - |
| Reduced motion | as rest | no transform | commit: an instant `step()`, with no animation | nothing to undo | as today | as today | as today |

**Flip versus drag.** It is decided on `pointerup` by `drag.moved`, which is
`|dx| > SWIPE_SLOP_PX` at any point in the gesture. `moved` sets `eatClick`,
which the document capture-phase `click` listener consumes once, and a
`setTimeout(0)` clears it so a later genuine tap is never eaten. A touch
drag already produces no click (M2), so this matters for mouse only. The
listener is on `document`, not `#card`, because `tests/helpers/sandbox.js`
`flip()` calls `els.card.listeners.click[0]`. The `.card:active` ring and
Enter/Space flip are untouched.

**iOS back-swipe and edges.** At 380px the card sits about 23px from each
viewport edge. A touch that starts in iOS Safari's system edge zone belongs to
the system: the page gets `pointercancel` and the card springs back (M3
path). A touch that starts on the card is inside the page, and `pan-y` gives
it to the handlers. Android Chrome's gesture navigation is a system edge
gesture as well. `overscroll-behavior-x:none` stays for drags off the card
(§2.1). None of this is observable under CDP (the harness disables
`OverscrollHistoryNavigation`), so it is a device check (§5).

**Reduced motion.** `reducedMotion.matches` is read at event time. Under
reduce: no follow, no tilt, no fly-out, no spring-back and no enter. A commit
is an instant `step()`. A drag past slop still eats the mouse click. The
existing `.card{transition:none}` rule is untouched.

**A11y.** `#count` is written only by `render()`, and `step()` is called
exactly once per commit (in `land()` or the reduced branch), so there is one
polite announcement per step and none per frame. There is no new live region
and no focus move. The card never leaves the DOM, and during the fly-out it
is still the focused, exposed element. It is off-screen for at most 220ms and
then comes back with the new content.

**Layout.** Only `transform` and `opacity` on `.scene` change. The
`main{overflow-x:clip}` rule stops horizontal page scroll (M5), and it clips
only the x axis, so the `.card:active` ring and any vertical overflow are
unaffected. `.scene` bounds do not clip the tilt corners, because `.scene`
itself is the transformed box. CHROME_BUDGET and LANDSCAPE_BUDGET stay
unchanged (N16).

**Print.** `@media print{.scene{transform:none!important}}`. An `!important`
author rule beats both the inline drag transform and a WAAPI animation.

## §3 Lanes

### 3.1 Why one lane

The brief allows a split into SWa (the `tests/helpers/cdp.js` timed drag plus
the re-targeted tests) and SWb (the app change). That is not a real ownership
boundary. Both halves edit `tests/e2e.test.js`. SWa's re-targeted deadzone
test passes at base, so it proves nothing until SWb lands. And the two
`e_swipe_*` re-targets need SWb's `swipeDecision` line. Splitting would add a
review and a CI cycle for no isolation gain. **One lane** (eng-review ER1).

| Lane | Owns | Never touches | Acceptance | Verify |
|---|---|---|---|---|
| **SW** `claude/card-swipe` | `index.html`: (a) a new CSS block **inserted before `:407`** (right after `main{...}` `:406`): `.scene{touch-action:pan-y pinch-zoom}`, `main{overflow-x:clip}`, `@media print{.scene{transform:none!important}}`; (b) the JS **replacing `:8255-8261`** (the `let tx` touch block) with §3.2. `tests/helpers/cdp.js`: new `drag()` and `finishAnimations()` methods after `swipe()` (`:234-243`, left as is). `tests/e2e.test.js`: the swipe group `:480-597` (re-targets), and a new `describe("card swipe")` appended at the end. `tests/app.test.js`: a new `swipeDecision` block appended. `tests/suite_health.py` FLOORS rows `tests/app.test.js` and `tests/e2e.test.js`. `tests/mutants/sw_*` (new), and re-targets of `e_swipe_direction_inverted.patch` and `e_swipe_deadzone_dropped.patch` | `step()`/`flip()` `:8074-8097`, `render()` `:6903-6962`, `setOrder()` `:6966-6982`, footer markup `:961-968`, the document keydown handler `:8224-8254`, `openPanel`/`showSheet`, `.scene`/`.card` rules `:427-438`, `.card:active` `:832-842`, `@media print` `:892+`, `html{overscroll-behavior-x}` `:61-71`, the engine regions, the `const DECKS` line, `data/`, CHROME_BUDGET/LANDSCAPE_BUDGET, `tests/helpers/sandbox.js`, `tests/mutation_check.sh`, all other mutants | (1) The failing tests in §3.3 are written first, and fail at base, except those marked "passes at base (lock)". (2) All pass at the lane head. (3) `git diff origin/main -- index.html` shows exactly two hunks, at `:407` and the touch block (`:8261` at `4c6f700`). (4) `index.html` grows by ≤ 5,000 bytes (OV: the outside-voice fixes add about 400 bytes to the measured 3.95 KB). (5) The 442 existing mutants (at `4c6f700`) apply, except the two re-targeted ones. The 25 `sw_*` mutants and the 2 re-targets are killed in CI. (6) `tools/validate.py`, `inline_engine.py --check` and `sync_decks.py --check` are clean. (7) FLOORS rows equal the new counts. (8) CI 5/5 at the head SHA | `node --test tests/app.test.js && python3 tools/validate.py && python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 -m pytest -q tests/test_suite_health.py`, then `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node --test --test-name-pattern="swipe\|row 95\|^card swipe" tests/e2e.test.js` (about 25 tests, never the full file), then `for p in tests/mutants/sw_*.patch tests/mutants/e_swipe_*.patch; do git apply --check "$p" \|\| echo STALE $p; done`, then CI 5/5 at head |

**The chord-sequence overlap, resolved: disjoint regions.** S1 and S2 are
already merged, so there is nothing left to serialise behind. SW still takes
the "own disjoint regions" option because it needs no hook in `step()` or
`render()`. `land()` calls `step(dir)`, and the document capture listeners
make every existing `step` caller land a pending flight first, so no call
site is wrapped. Mode S wraps through `order`, which `setOrder()` sets to the
sequence, so the same `step()` covers it.

### 3.2 Reference design (the lane may tighten it, but not widen it)

The CSS goes before `:407`:

```css
/* swipe: the drag moves .scene, never .card - .card's transform is the flip. */
.scene{touch-action:pan-y pinch-zoom}
main{overflow-x:clip}
@media print{.scene{transform:none!important}}
```

The JS replaces `:8255-8261`. It was spiked and measured (M1-M10):

```js
const SWIPE_COMMIT_PX = 55, SWIPE_FLING_PX_MS = 0.5, SWIPE_FLING_WINDOW_MS = 100, SWIPE_SLOP_PX = 10;
const SWIPE_TILT_DEG_PER_PX = 0.05, SWIPE_TILT_MAX_DEG = 8;
const SWIPE_OUT_MS = 220, SWIPE_BACK_MS = 260, SWIPE_IN_MS = 180, SWIPE_IN_PX = 24;
const SWIPE_EASE = "cubic-bezier(.2,.7,.25,1)", SWIPE_OUT_EASE = "cubic-bezier(.4,0,1,1)";
const scene = card.parentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function swipeDecision(dx, vx) {
  const fling = Math.abs(dx) > SWIPE_SLOP_PX && Math.abs(vx) > SWIPE_FLING_PX_MS && vx * dx > 0;
  return Math.abs(dx) > SWIPE_COMMIT_PX || fling ? (dx < 0 ? 1 : -1) : 0;
}
// swipeXf(dx): translate3d(dx) rotate(clamp(dx*TILT, +-MAX))
// let drag = null, flight = null, eatClick = false;
// land(): if flight: flight = null; step(dir); cancel the fly-out; play the enter animation (from dir*IN_PX, opacity 0)
// pointermove: push {x, t} onto drag.pts and drop points older than FLING_WINDOW ms (ER9: bounded);
// release(e, cancelled): push the release point {x, t: e.timeStamp}, then drop points older than
//   t - FLING_WINDOW (OV3: a flick then a hold ages out). vx = (x_last - x_first) / (t_last - t_first)
//   over what is left; fewer than two points, or a zero span, gives vx = 0 (no infinite fling, M4);
//   dir = cancelled || panelOpen || sheetOpen ? 0 : swipeDecision(dx, vx);
//   moved -> eatClick (cleared by setTimeout 0); clear the inline transform and willChange;
//   reduced -> instant step(dir); !dir -> spring back from (cancelled ? drag.last : dx);
//   land() suppresses .card's transition across step() (inline transition:none, one reflow, then
//   cleared) so a flipped card's reset is instant while the card is off-screen (OV2);
//   else fly out to -dir*(innerWidth/2 + scene.offsetWidth), fill:"forwards",
//   flight = {dir, anim}; anim.finished.then(() => flight?.anim === anim && land(), () => {})
// #card pointerdown: return unless !drag && isPrimary && button === 0 && !panelOpen && !sheetOpen && order.length;
//   cancel scene animations; drag = {id: e.pointerId, ...}; setPointerCapture (OV5)
// move/up/cancel/lostpointercapture: return unless drag && e.pointerId === drag.id; lostpointercapture -> release(e, true)
// #card pointermove / pointerup / pointercancel (cancel -> release(e, true))
// document capture: pointerdown -> eatClick = !!flight && card.contains(target); land()
//                   keydown -> land;  click -> land(); eat once if eatClick on the card
```

This touches no function outside the block. The only outside names it reads
are `step`, `card` (`:8074`), `order`, `panelOpen` and `sheetOpen`.

**Sandbox safety.** `tests/helpers/sandbox.js` needs no edit. `card.parentElement`
is `undefined` in the stub and is dereferenced only inside handlers the sandbox
never fires. `matchMedia` is stubbed. The capture `keydown` listener runs with
`flight === null`, so it is a no-op. No listener is added to `#card`'s `click`.

### 3.3 Failing tests first

**`tests/helpers/cdp.js` (helper, not a test).** Two new methods:

- `drag(selector, pts, { pointer: "touch" | "mouse", release: true, y0 })`,
  where `pts` is `[[dx, ms], ...]`. It sends `touchStart` (or `mousePressed`)
  at the centre, then one `touchMove` (or `mouseMoved` with `buttons: 1`) per
  point, with a CDP `timestamp` of `t0 + ms/1000`, then `touchEnd` (or
  `mouseReleased`) unless `release: false`. There is no wall-clock wait (M1).
  A point may carry a `dy` for vertical drags.
- `finishAnimations(selector = ".scene")`. In one `b.eval`, it loops at most
  4 times: `getAnimations().forEach(a => a.finish())`, awaiting one microtask
  turn, until the list is empty. This is needed because `finish()` on the
  fly-out chains `land()`, which starts the enter animation.

**`tests/app.test.js`**. Three tests, appended in a
`describe("swipe decision")` block. All fail at base (`swipeDecision` is
undefined).

| Test | Assertion |
|---|---|
| `swipeDecision commits strictly past SWIPE_COMMIT_PX, left = next` | `SWIPE_COMMIT_PX === 55`; `swipeDecision(55,0) === 0`; `(55.5,0) === -1`; `(-55.5,0) === 1`; `(-50,0) === 0` |
| `swipeDecision flings past SWIPE_FLING_PX_MS only in the drag direction and past the slop` | `(-20,-0.49) === 0`; `(-20,-0.51) === 1`; `(20,0.51) === -1`; `(-20,+0.9) === 0` (reversed); `(-10,-5) === 0`; `(-11,-5) === 1` |
| `swipe constants are the plan's values` | `SWIPE_FLING_PX_MS 0.5`, `SWIPE_FLING_WINDOW_MS 100`, `SWIPE_SLOP_PX 10`, `SWIPE_TILT_DEG_PER_PX 0.05`, `SWIPE_TILT_MAX_DEG 8`, OUT/BACK/IN ms `220/260/180`, `SWIPE_IN_PX 24` |

**`tests/e2e.test.js`: the re-targeted existing group (`:480-597`).**

- `a swipe past the threshold steps the deck in the swiped direction`: the
  ±120 swipes stay `b.swipe`. The final -60 becomes a timed slow
  `b.drag("#card", [[-20,100],[-40,200],[-60,300]])` followed by
  `finishAnimations()`. Otherwise a fling masks the distance (M4).
- `a swipe shorter than the threshold does not navigate`: the ±50 swipes
  become slow timed drags (`[[-10,100],...,[-50,500]]`, 0.1 px/ms). After
  each ack, `finishAnimations()` runs before the exact read. The final -120
  gets `finishAnimations()` before its exact read. The `touchend` ack still
  fires (M1). The comment citing `index.html:5084-5090` is replaced by
  "the swipe block (search `swipeDecision`)", with no line number.
- `swipe wraps at both ends of the deck like the buttons do` and `row 95`:
  unchanged. They poll through `expectCount`, and they pass at base (lock).

**`tests/e2e.test.js`: the new `describe("card swipe")` block.** It is
appended at the end, and every name starts `card swipe:`. It runs at 380x800
unless noted. Each test starts with `freshLoad()`. None sleeps, and none
compares screenshots.

| # | Test | Assertion (all fail at base unless marked) |
|---|---|---|
| E1 | `card swipe: the card follows a held drag with a tilt, then springs back below the threshold` | `drag +80`, held (no release): the `.scene` computed matrix has m41 ≈ 80 (±1), positive rotation (`b > 0`), and `style.willChange === "transform"`. `.card` computed transform is not rotated in Z. Then move back to +40 over 400ms and release: one running animation, `#count` unchanged. After `finishAnimations()`: transform `none`, `willChange ""`, `getComputedStyle(.scene).touchAction === "pan-y pinch-zoom"` |
| E2 | `card swipe: the tilt is SWIPE_TILT_DEG_PER_PX per px and clamps at SWIPE_TILT_MAX_DEG` | hold +100: `atan2(b,a)` is 5° ±0.2. Hold +400: 8° ±0.2. Hold -400: -8° |
| E3 | `card swipe: a commit flies the card out, then steps and deals the next card in from the opposite side` | slow -120: before finishing, `#count` is still `1 / n`, one animation with duration 220 and easing `SWIPE_OUT_EASE`, and the final keyframe translateX < -380. Finish once: `#count` `2 / n`, `#front` holds chord 2's name, and the enter animation's keyframe 0 has translateX +24 and opacity 0. After `finishAnimations()`: no animations, transform `none` |
| E4 | `card swipe: a short fast fling commits and a slow drag of the same length does not` | -30 over 50ms (15ms steps) → `2 / n`. Fresh load, then -30 over 75ms → `1 / n`. Window legs, all BELOW the 55px distance so only velocity decides (OV1): (a) -10 over 1s in 100ms steps, then -40 more in 40ms (total -50) → commits (the last 100ms is a fling; the whole gesture averages 0.05 px/ms); (b) -30 in 30ms, then held still for 200ms with no moves, then released → `1 / n` (the flick ages out at release, OV3) |
| E5 | `card swipe: a tap-sized flick never steps and the tap still flips` | -8 over 10ms (touch): `1 / n`. Then a mouse `b.click("#card")`: `.flip` is set |
| E6 | `card swipe: a mouse drag commits without flipping, a mouse click still flips, a short mouse drag springs back without flipping` | mouse -120 → `2 / n` and no `.flip`. `b.click` → `.flip`. `b.click` again. Mouse -30 slow → `2 / n` and no `.flip` |
| E7 | `card swipe: a flipped card keeps its back face during the fly-out and the next card arrives front-up` | flip, then slow -120: mid-flight `.card.flip` is still set. After finishing the fly-out only: `#count` `2 / n`, no `.flip`, `#front` not `aria-hidden`, `.card` computed transform is the identity **at once** and `card.getAnimations()` holds no `CSSTransition` (the reset did not animate while the new card deals in, OV2) |
| E8 | `card swipe: a tap during the fly-out lands it once and never flips the wrong card` | slow -120, then `b.click("#card")` before finishing: `#count` `2 / n` **immediately**, no `.flip`, no animation with duration 220 |
| E9 | `card swipe: buttons and arrows during the fly-out land it first, never dropping or doubling a step` | slow -120, then `b.click("#next")`: `#count` `3 / n` **immediately**. Repeat with ArrowRight → `5 / n` after the second swipe. Third leg (OV1): slow -120, then `b.eval('document.getElementById("next").click()')`, a click with no preceding pointer or key event (the path an assistive-tech activation takes) → `7 / n` immediately. After `finishAnimations()`, still `7 / n` |
| E10 | `card swipe: a drag with the settings panel open, or opened mid-drag, does nothing` | `openPanel()` then drag -120 → `1 / n` and transform `none`. Close. Drag -120 with `release:false`, `openPanel()` in `b.eval`, then release → `1 / n`, and after finishing transform `none` (M6) |
| E11 | `card swipe: a drag with the scale sheet open does nothing` | Open the sheet through its opener (`sheetOpen === true`). Drag -120 → `1 / n` |
| E12 | `card swipe: under reduced motion the swipe steps instantly with no animation` | `Emulation.setEmulatedMedia` reduce. Hold -80: transform `none`. Release: `#count` `2 / n` synchronously, and `document.getAnimations().length === 0`. The media emulation is reset in `finally` |
| E13 | `card swipe: a vertical drag scrolls the page and does not step, at 320x568 and 844x390` | Per viewport: a drag with `dy` -100 over 100ms and `dx` +15: `#count` unchanged, and after finishing transform `none`. The scroll half asserts ONE observable per viewport, chosen when the test is written and recorded in its comment: `scrollY > 0` where the page scrolls, otherwise a `pointercancel` seen by a one-shot listener. No disjunction in the assertion (ER10) |
| E14 | `card swipe: a card in flight never widens the page, at 380x800 and 844x390` | Hold +100, then `scrollTo(500,0)`: `scrollX === 0` and `scrollWidth <= innerWidth`. Release -120 and pause the fly-out at `currentTime 150`: same checks |
| E15 | `card swipe: #count is written once per step, never per frame` | A `MutationObserver` on `#count` (childList, characterData, subtree) records batches. Drag -120 in 12 moves, then release and finish: exactly 1 record batch, and 0 during the moves |
| E16 | `card swipe: a 2-card order and a 2-chord sequence (prev == next) animate and land` | Mode A: `order=[0,1]; idx=0; render()`. -120 → `2 / 2`, +120 → `1 / 2`, -120 → `2 / 2`. Mode S: `seq={chords:[0,10],style:seq.style}; order=seq.chords.slice(); idx=0; flipped=false; render()` (the §S2 e2e seeding pattern). -120 → the rail marks chord 2, and -120 again wraps to chord 1 |
| E17 | `card swipe: a printed card carries no transform` | Hold +80, then `setEmulatedMedia({media:"print"})`: `.scene` computed transform `none`. Reset in `finally` |
| E18 | `card swipe: a pointercancel mid-drag springs back from the last move and does not step` | Hold +80 (`release:false`), then in one `b.eval` dispatch `new PointerEvent("pointercancel", {pointerId: <the drag's id, read from a one-shot pointerdown listener>, isPrimary: true, clientX: 0, bubbles: true})` on `#card`. Assert: `#count` unchanged; exactly one `.scene` animation, duration `SWIPE_BACK_MS`, whose keyframe 0 translateX is 80 ±1 (not about `-innerWidth/2`, which is what reading the cancel's `clientX 0` gives, M3). After `finishAnimations()`: transform `none`, `willChange ""`. Deterministic, unlike a real browser-claimed cancel, which can arrive before any horizontal move has set a transform (ER8) |
| E19 | `card swipe: a second pointer cannot end or hijack a drag in progress` | Hold a touch -80 (`release:false`). In one `b.eval`, dispatch on `#card` a `pointerdown` then a `pointerup` with `pointerId` 999, `pointerType "mouse"`, `isPrimary: true` (a mouse is primary alongside touch, OV5). Assert: `.scene` m41 is still -80 ±1 and `#count` unchanged. Then continue the touch to -120 and release: exactly `2 / n` after `finishAnimations()` |

E3, E8 and E9 read `#count` right after `b.click`. That is safe because
`b.click` returns after `mouseReleased`, the capture listener and `step()`
run synchronously in that dispatch, and `render()` is synchronous. The
existing nav test relies on the same fact.

**FLOORS** (`tests/suite_health.py`): `tests/app.test.js` 205 → **208**, and
`tests/e2e.test.js` 155 → **174** (19 new). These numbers are unchanged at
`4c6f700`. If any other PR merges first and moves a row, SW rebases and adds
its +3 and +19 to whatever main has (the shared-row rule).

E16 is a **behaviour lock with no `sw_*` killer**: it pins wrap on 2-element
orders under the new path.
Every other new test kills at least one mutant in §7.2 (ER7).

## §4 Order and dependencies

- **Chord sequence S1 and S2:** merged (#162). No ordering constraint remains.
  E16 covers the mode S prev == next case the brief requires.
- **PR #163:** merged (`4c6f700`). SW branches from `4c6f700` (ER2). It
  shifted the touch block by +6 lines (header line map) and took the corpus to
  442. SW re-runs the M9 `git apply --check` sweep on its first commit.
- **The backlog refactor:** see below.

### Dependency on backlog refactor

`docs/plans/2026-09-29-backlog-and-refactor.md` is being written now, and its
brief names this work as a dependency to sequence. SW's contract with the rest
of the app is narrow, and these are the only places a refactor can break it:

| If the refactor... | Then |
|---|---|
| renames or moves `step()`, `flip()`, `card` (`:8074`), `order`, `panelOpen` or `sheetOpen` (the "state spread across module-level lets" candidate) | SW's block follows the rename. `land()` and `release()` read exactly these names. **Serialise: the refactor first, then SW rebases** |
| moves the document keydown handler (`:8224-8254`) or the `step` call sites | Nothing changes, provided the capture-phase listeners stay on `document`. SW never touches those sites |
| edits `:8255-8261`, the `.scene` rule or the `main{}` rule at `:406` | SW rebases and re-runs the `git apply --check` staleness sweep (M9) |
| re-anchors mutants on stable markers, or changes `# kills:` / `# suite:` conventions | The 25 new `sw_*` patches and the 2 re-targets follow the new convention. Landing the refactor first saves writing 27 patches twice |
| replaces the `tests/helpers/sandbox.js` element-id list | No effect. SW adds no id and needs no sandbox edit |
| lands after SW | It must keep the `swipeDecision` name (the app tests and 3 mutants use it), the three document capture listeners, and the click-listener order on `#card` (`flip` is `listeners.click[0]`) |

**Recommended default (D9):** if the backlog plan has any REFACTOR lane that
touches the module-level state `let`s, `:8074-8261`, or the mutant anchoring
convention, SW waits for it. Otherwise SW runs next, in parallel with any
refactor lane that stays out of those regions.

**Resolved against the backlog plan as written (eng review, ER13).** That plan
now exists and was eng-reviewed. It has three REFACTOR lanes: **R1** (retire
the legacy `window.print()` path, gated on its owner decision O1; touches the
`headerHTML` signature `:6813` and deletes about 25-29 `index.html` mutants),
**R2** (a fast `git apply --check` staleness test,
`tests/mutation_harness.test.js`; no product file) and **D1** (ledger banners,
docs only). None renames the state `let`s, touches `:8074-8267`, or changes
the mutant anchoring convention, so D9's "wait" branch does not fire. Its §4
sequences this lane as: **start after R2 merges; serialised with R1, never
concurrent; D1 is independent.** SW adopts that order:

1. R2 merges first. SW's 25 `sw_*` patches and 2 re-targets must then pass
   R2's staleness test, which moves the M9 sweep from the 13-minute gate into
   the ordinary test run.
2. R1 before SW only if its owner gate O1 has passed by the time SW starts
   (SW then applies fewer mutants); otherwise SW first and R1 rebases.
3. One correction to the backlog plan's §4: it says the swipe lane touches
   `render()`, `flip`/`step` and the `.card`/`.flip` CSS. This plan touches
   none of them (N38, G1). The R1/SW serialisation still stands, but its
   reason is the shared mutant corpus, not a shared line.

## §5 Merge gates (deltas only)

Quality-eval §6 and the /swarm gates stand: a worktree per lane, CI 5/5 at
the verified head SHA, an independent swarm-reviewer at that SHA, and
`gh pr merge --merge --match-head-commit`. These are added:

- G1: `git diff origin/main -- index.html` has exactly two hunks, and neither
  is inside `step`, `flip`, `render`, `setOrder`, an engine region or the
  DECKS line. The reviewer checks this.
- G2: the fresh CI mutation gate kills every `sw_*` mutant and both
  `e_swipe_*` re-targets. `stale` counts as a failure. A lone unrelated
  survivor gets one rerun at the same SHA first (memory: the gate can flake).
- G3: no CHROME_BUDGET or LANDSCAPE_BUDGET value changes (a diff of those
  tables is empty).
- G4: the `index.html` byte delta is ≤ 5,000 (raised from 4,500 for the outside-voice fixes, OV1-OV5).
- G5: the device checks below are listed in the PR body with
  `covered_by: neither`. They are not merge-blocking, and the owner runs them
  on a phone after merge.

**Device checks, `covered_by: neither`** (CDP cannot observe these):

| # | Check | Device |
|---|---|---|
| DC1 | Starting a drag within about 20px of the left edge triggers Safari's back-swipe and the card springs back without stepping. A drag starting on the card never navigates history | iPhone, iOS Safari |
| DC2 | Android gesture-navigation back from the edge behaves as today. A drag on the card never goes back | Android Chrome |
| DC3 | The fling threshold and tilt feel right, with no accidental steps on a flip tap | both |
| DC4 | `main{overflow-x:clip}` holds on iOS 16+, with no horizontal wobble while a card is in flight | iOS Safari |
| DC5 | A vertical scroll that starts on the card in landscape scrolls smoothly and never tilts the card by more than a hair | both |
| DC6 | Reduced motion (Settings → Accessibility) navigates instantly | iOS |
| DC7 | A two-finger pinch that starts on the card zooms the page (`pan-y pinch-zoom`, OV4) and never steps or leaves the card tilted | both |

## §6 Owner decisions (recommended defaults)

**Owner answer (2026-09-29 interview): N40 is IN SCOPE for SW.** SW widens to own the flip-reset in `step()` so `#prev`/`#next`/arrow keys suppress the reverse-flip reveal the same way `land()` does, with one test and one mutant. D1-D10 not asked; defaults stand.

| # | Decision | Recommended default | Alternative |
|---|---|---|---|
| D1 | Approach | **A2 + S1**: WAAPI on `.scene`, one card, no new DOM (§2.2) | A1 (more bytes, and transitionend edge cases); S2 (a visible stack, `render()` edits, budget risk) |
| D2 | Do buttons and keys animate? | **No in v1.** They step instantly, landing any pending fly-out first. No backlog by construction, and every rect-measuring test is untouched | A shorter fly-out (120ms) for buttons, in a follow-up |
| D3 | Reduced motion | **No follow, no fly-out, no enter. A commit is an instant step.** `getAnimations()` stays empty | Follow the finger without the fly-out |
| D4 | Threshold and fling | **55px absolute, 0.5 px/ms over the last 100ms, 10px slop** | 18% of card width |
| D5 | Rotation | **0.05°/px, clamped at 8°, about the centre** | None (translate only); a bottom pivot (O3) |
| D6 | Entering card | **Dealt in from the opposite side: 24px, 180ms, opacity 0 to 1.** Fixed durations | Appear in place (a fade only) |
| D7 | Mouse drag on desktop | **Enabled**, with the same thresholds and the click after a drag eaten | Touch and pen only (`pointerType` filter) |
| D8 | The v1 cut | N29-N40 | - |
| D9 | Order against the backlog refactor | **Wait for any refactor lane that touches state `let`s, `:8074-8261` or mutant anchoring. Otherwise go next** | Land SW first and let the refactor carry it |
| D10 | Horizontal-scroll guard | **`main{overflow-x:clip}`** (M5: the body and html forms fail) | `overflow-x:hidden` on `main` (it creates a scroll container) |

### Eng-review auto-decisions (/plan-eng-review, run 2026-09-29, recommended options taken)

| # | Question | Auto-decision | Rationale |
|---|---|---|---|
| ER1 | Split into SWa (helper) and SWb (app)? | **One lane** | Both halves edit `tests/e2e.test.js`, and SWa's tests prove nothing before SWb (§3.1) |
| ER2 | Branch before or after #163? | **Resolved by events: #163 merged, so SW branches from `4c6f700`** | Line map in the header. Corpus 442, FLOORS unchanged |
| ER3 | Put the click-eater on `#card` or on `document` (capture)? | **`document` capture** | `sandbox.js` `flip()` calls `listeners.click[0]`, and capture runs before `flip` without reordering |
| ER4 | Is `overscroll-behavior-x` redundant now? | **Keep it** | `pan-y` covers only `.scene`. Drags elsewhere still reach the browser (§2.1) |
| ER5 | `will-change` permanent or per gesture? | **Per gesture, cleared in `swipeRest()`**, asserted by E1 and killed by `sw_will_change_left_on` | A permanent layer costs memory for an idle card |
| ER6 | What does `pointercancel` release from? | **`drag.last`**, because the cancel event's `clientX` is 0 (M3). Pinned by E18, killed by `sw_pointercancel_unhandled` and `sw_cancel_from_event_x` | E13 alone could not pin it (ER8) |
| ER7 | How many new tests? | **19 e2e, 3 app.** Every `sw_*` mutant has a named killer. E16 is a declared behaviour lock with no mutant; every other new test kills one | The draft's "no test without a mutant" was false for E7, E8 and E16 (E7 gains `sw_flip_reset_animates`, OV2) |
| ER8 | E13's real vertical drag cannot reliably kill `sw_pointercancel_unhandled`: under `pan-y` the browser can claim the pan and cancel before any horizontal move sets a transform, so the mutant leaves nothing to observe. Add a deterministic test? | **A) Add E18**: a synthetic `pointercancel` after a held +80 drag, asserting the spring-back's keyframe 0 is +80. Re-map the mutant, add `sw_cancel_from_event_x`. Completeness A=10, B (keep E13 only)=6 | Closes a path where a broken cancel handler (a card stuck mid-tilt after a scroll) ships green |
| ER9 | `drag.pts` grows for the whole gesture | **Prune to the last `SWIPE_FLING_WINDOW_MS`** in `pointermove` (§3.2) | Bounded memory on a long held drag; no behaviour change, no test |
| ER10 | E13's "scrollY > 0 OR pointercancel" disjunction | **One observable per viewport, fixed when written** | A disjunctive assertion passes when either half silently breaks |
| ER11 | E8 guards the wrong-card-flip bug but had no mutant | **Add `sw_tap_in_flight_flips`** | The capture-`pointerdown` `eatClick` line is the only thing between a tap mid-flight and a flip of the landed card |
| ER12 | Outside voice (Codex, completed): 5 findings | All 5 accepted, option A each, as OV1-OV5 below | - |
| ER13 | D9 against the backlog plan as written | **After R2; serialised with R1 by its O1 rule; D1 independent** ("Dependency on backlog refactor") | The backlog plan's lanes touch none of SW's regions or the anchoring convention |
| OV1 | Two declared mutants were unkillable: E4's 200px leg commits on distance, and every `b.click` sends a mouse press that the capture `pointerdown` already lands on | **A) Re-design both killers**: E4 window legs stay under 55px; E9 gains an `el.click()` leg | Otherwise G2 fails on survivors, or worse, the tests look like coverage and are not |
| OV2 | On a flipped card, `step()` clears `.flip` and `.card`'s 450ms transition reverse-flips while the new card deals in, showing the NEW card's back (its answer) first | **A) `land()` suppresses `.card`'s transition across `step()`** (inline, in SW's block; `step()` untouched). E7 asserts no `CSSTransition`; `sw_flip_reset_animates` | The same reveal already happens on `#prev`/`#next` today; that path is left as is (N40) |
| OV3 | Velocity was not aged at release: flick, hold, release still read as a fling. Sparse or zero-span samples undefined | **A) Prune at release against `e.timeStamp`; fewer than 2 points or a zero span is vx 0.** E4 leg (b); `sw_velocity_not_aged` | Zero-span-is-0 also retires M4's "untimed swipe is an infinite fling" |
| OV4 | `touch-action:pan-y` disables pinch-zoom that starts on the card, the place a user would zoom the diagram | **A) `pan-y pinch-zoom`**, asserted by E1; `sw_pinch_zoom_blocked`; DC7 | The app already has real pinch-zoom tests and handling, so zoom is a supported gesture |
| OV5 | `isPrimary` is not exclusive: a mouse and a touch can both be primary | **A) Bind `drag` to one `pointerId`**; reject a start while a drag is live; drop other ids; `lostpointercapture` cancels. E19; `sw_drag_not_bound_to_pointer` | - |

## §7 Mutants

### 7.1 Existing mutants whose targets SW moves

These were found by `grep -l` on SW's removed lines, then confirmed by running
`git apply --check` of all 441 patches against the spiked copy (M9). Hunk
headers were not used.

| Mutant | Target | Action |
|---|---|---|
| `e_swipe_direction_inverted` | `if (Math.abs(dx) > 55) step(dx < 0 ? 1 : -1);` (removed) | **RE-TARGET** onto `swipeDecision`'s return, `(dx < 0 ? 1 : -1)` → `(dx < 0 ? -1 : 1)`. Same `# kills:` / `# suite:` (`^a.swipe.past.the.threshold.steps.the.deck.in.the.swiped.direction$`) |
| `e_swipe_deadzone_dropped` | the same removed line | **RE-TARGET**: `Math.abs(dx) > SWIPE_COMMIT_PX` → `Math.abs(dx) > 0`. Same `# kills:` (the timed deadzone test) |
| `f_overscroll_x_dropped` | `html{overscroll-behavior-x:none}` `:61-71` | none: untouched, still applies |
| `e_flip_transform`, `e_card_press_ring_is_square` | `.card` / `.card.flip` `:427-438` | none: SW inserts at `:407`, not `:439` (M9) |
| `e_landscape_card_collapses`, `e_landscape_card_overflows_main`, `e_landscape_card_undersized` | the `.scene` rule | none: the new `.scene{touch-action}` is a separate rule at `:407` |
| `d_step_keeps_flip`, `e_nav_wrap` | inside `step()` | none: untouched |
| `m3b_panel_guard_too_broad`, `d_arrows_step_behind_sheet` | the keydown handler | none: untouched |
| `f2_card_key_flip_dead` | the card keydown | none: untouched |
| `m2b_panel_card_not_inert` | the `openPanel` inert loop | none: untouched |

No retirements. If the rebase onto #163 or the refactor shifts any of these,
the lane re-runs the `git apply --check` sweep and refreshes only the
context.

### 7.2 New `sw_*` mutants

Each `# suite:` line uses `.` for spaces (memory: headers are word-split).

| Mutant | Change | Killed by |
|---|---|---|
| `sw_commit_off_by_one` | `Math.abs(dx) > SWIPE_COMMIT_PX` → `>=` | app `swipeDecision commits strictly past SWIPE_COMMIT_PX...` |
| `sw_commit_moved` | `SWIPE_COMMIT_PX = 55` → `61` | e2e threshold test (timed 60 commits) |
| `sw_fling_ignored` | drop `\|\| fling` | E4 |
| `sw_fling_direction_unchecked` | drop `&& vx * dx > 0` | app `swipeDecision flings...` |
| `sw_fling_window_whole_gesture` | velocity from the gesture's first point instead of the window | E4 leg (a) (-50 total, below the distance threshold) |
| `sw_velocity_not_aged` | skip the release-time prune (age points only on `pointermove`) | E4 leg (b) (flick, hold, release) |
| `sw_click_after_drag_not_suppressed` | drop the `eatClick` branch in the capture click | E6 |
| `sw_drag_on_card` | `scene.style.transform` → `card.style.transform` in pointermove | E1 (the `.scene` m41 is 0, and the `.card` flip is overwritten) |
| `sw_reduced_motion_ignored` | drop `if (reducedMotion.matches) ...` in `release()` | E12 |
| `sw_panel_guard_dropped` | drop `panelOpen \|\|` in both guards | E10 |
| `sw_sheet_guard_dropped` | drop `sheetOpen \|\|` in both guards | E11 |
| `sw_pointercancel_unhandled` | delete the `pointercancel` listener | E18 (no spring-back animation; the transform stays at +80) |
| `sw_cancel_from_event_x` | on cancel, spring back from `e.clientX - drag.x0` instead of `drag.last` | E18 (keyframe 0 is about `-innerWidth/2`, not 80) |
| `sw_tap_in_flight_flips` | drop `eatClick = !!flight && card.contains(e.target)` from the capture `pointerdown` | E8 (`.flip` is set on the landed card) |
| `sw_touch_action_dropped` | delete `.scene{touch-action:pan-y pinch-zoom}` | E1 (`touchAction === "pan-y pinch-zoom"`) |
| `sw_pinch_zoom_blocked` | `pan-y pinch-zoom` → `pan-y` | E1 (the exact computed value) |
| `sw_count_per_frame` | call `render()` at the end of the pointermove handler | E15 |
| `sw_overflow_clip_dropped` | delete `main{overflow-x:clip}` | E14 |
| `sw_flight_not_landed_on_button` | delete the capture `click` `land()` call | E9 third leg only (`el.click()` fires no pointerdown, so the capture `pointerdown` cannot mask the mutant; `b.click` legs cannot kill it, OV1) |
| `sw_tilt_unclamped` | drop the `Math.max/min` clamp | E2 (+400 reads 20°) |
| `sw_will_change_left_on` | drop `scene.style.willChange = ""` from `swipeRest()` | E1 |
| `sw_enter_side_inverted` | `f.dir * SWIPE_IN_PX` → `-f.dir * SWIPE_IN_PX` | E3 |
| `sw_flip_reset_animates` | drop the inline `transition:none` around `step()` in `land()` | E7 (a `CSSTransition` on `.card`) |
| `sw_drag_not_bound_to_pointer` | drop `e.pointerId === drag.id` from the pointerup guard | E19 |
| `sw_print_transform_kept` | delete the `@media print{.scene{...}}` rule | E17 |

That is 25 `sw_*` mutants and 2 re-targets. After SW the corpus is 442 + 25 =
467 (on `4c6f700`). `README.md`'s mutant count is not SW's to fix (it
is a queued doc row).

---

## Eng review (/plan-eng-review, 2026-09-29, spawned: recommended options auto-taken)

**Step 0, Scope Challenge.** One lane, 5 files touched (`index.html`,
`tests/helpers/cdp.js`, `tests/e2e.test.js`, `tests/app.test.js`,
`tests/suite_health.py`) plus new mutant patches. That is under the complexity
gate. There is no simpler cut that still meets the brief: S1 already reuses the
one card, and A2 is the smallest mechanism measured. Scope accepted as-is.

**What already exists.** `step()`, `flip()` and `render()` are reused
unchanged. The `.card` flip curve is reused as the spring-back easing. The
`prefers-reduced-motion` rule and `html{overscroll-behavior-x}` stay. The four
swipe e2e tests and the `b.swipe` helper stay (re-timed where M4 needs it).
The only rebuild is the 7-line touch block, which becomes pointer events.

**NOT in scope.** N29-N40 in §1, each with its one-line reason. Button and key
animation (N36) and the button-path flip reveal (N40) are the two most likely
follow-ups.

**1. Architecture (2 findings).** A1: #163 merged after drafting, so the base
and line anchors moved (ER2, header line map). A2: D9 was conditional on a plan
that now exists; resolved in ER13.

**2. Code quality (1 finding).** Q1: `drag.pts` grew unbounded (ER9), since
folded into OV3's release-time prune.

**3. Tests (4 findings, in-context).** T1 (ER8): E13 could not reliably kill
the cancel mutant; E18 added. T2 (ER7): the "every test has a mutant" claim
was false. T3 (ER10): E13's disjunction. T4 (ER11): E8 had no mutant.

Test coverage diagram (after the fixes):

```
pointerdown(#card) --guards: !drag, primary, button 0, !panel, !sheet, order--> drag{id}
  |                                                       [E10 E11 E19 | sw_panel/sheet_guard, sw_drag_not_bound]
  v
pointermove(id) --|dx|>slop--> scene transform + tilt + willChange   [E1 E2 | sw_drag_on_card, sw_tilt_unclamped]
  |               (prune pts to window)                               [E15 | sw_count_per_frame]
  +--> pointercancel / lostpointercapture --> spring back from drag.last [E18 | sw_pointercancel_unhandled, sw_cancel_from_event_x]
  v
pointerup(id) --> release: prune at e.timeStamp, vx over window     [E4 | sw_fling_*, sw_velocity_not_aged]
  | swipeDecision(dx,vx)                                             [app x3 | sw_commit_*, sw_fling_direction_unchecked]
  +-- reduced motion --> step() now                                  [E12 | sw_reduced_motion_ignored]
  +-- dir 0 --> spring back 260ms                                    [E1]
  +-- dir --> fly out 220ms --finished--> land(): step() with .card transition off, enter 180ms
                 |                                   [E3 E7 | sw_enter_side_inverted, sw_flip_reset_animates]
                 +-- document capture pointerdown/keydown/click --> land() first
                                  [E8 E9 | sw_tap_in_flight_flips, sw_flight_not_landed_on_button]
page:  main{overflow-x:clip} [E14 | sw_overflow_clip_dropped]; touch-action pan-y pinch-zoom [E1 | sw_touch_action_dropped, sw_pinch_zoom_blocked]
print: .scene transform none [E17 | sw_print_transform_kept]; click-after-drag [E5 E6 | sw_click_after_drag_not_suppressed]
locks: E13 (vertical scroll), E16 (2-card and 2-chord wrap); device-only: DC1-DC7
```

**Test Plan Artifact:** not persisted. This review ran under a "only the plan
file may be created" rule, so the `~/.gstack/projects/` test-plan file and the
tasks JSONL were not written. §3.3 and the diagram above are the test plan.

**4. Performance (0 findings).** One inline transform write per
`pointermove`, and browsers already coalesce pointer events to the frame
rate, so no rAF throttle is needed. `will-change` is per gesture (ER5). The
bytes are about 4.35 KB, under G4's 5,000.

**Failure modes.**

| New path | Realistic failure | Test | Handling | Visible? |
|---|---|---|---|---|
| Browser-claimed scroll mid-drag | The card is stuck tilted | E18, E13 | cancel/lostcapture spring back | visible, then fixed |
| Flick then hold | An accidental step | E4(b) | release-time prune | - |
| Tap during fly-out | The landed card flips, revealing the answer | E8 | capture `eatClick` | - |
| Flipped card swiped | The next card's answer shows during the deal | E7 | `land()` transition off | - |
| AT activation (`click` only) mid-flight | A step is dropped or doubled | E9 leg 3 | capture `click` `land()` | - |
| Two pointers | The drag is hijacked or ended by the other one | E19 | `pointerId` binding | - |
| Pinch on the card | No zoom | E1 (computed value), DC7 | `pinch-zoom` | - |
| `popstate` / `desktopMQ` change mid-flight | Neither calls `render()` or `step()` (checked at `4c6f700` `:7796`, `:8163`), so the flight lands normally | - | n/a | - |

No critical gaps: every row has a test or needs no handling.

**Worktree parallelization.** Sequential implementation, no parallelization
opportunity (one lane, §3.1). Across plans: SW runs after the backlog plan's
R2, and never concurrently with R1 (ER13).

**Outside voice (Codex, completed).** Five findings: OV1 (two mutants could
not be killed), OV2 (the flip reset reveals the answer during the deal), OV3
(velocity was not aged at release), OV4 (`pan-y` blocked pinch-zoom) and OV5
(`isPrimary` is not exclusive). All five were verified against `4c6f700`
(`tests/helpers/cdp.js` `click()` sends `mousePressed`; `.card` has
`transition:transform .45s` `:429`; the page is zoomable and the suite tests
pinch-zoom) and accepted as option A (§6 rows OV1-OV5). There was no
cross-model disagreement: the in-context review missed all five, and Codex
did not dispute any in-context finding.

**TODOS.md.** One candidate: the button-path flip reveal (N40). The
auto-decision is B, not added to TODOS.md, because this review may edit only
the plan file. It is recorded as N40 instead, and it appears in the handback
for the owner.

## Implementation Tasks

Synthesized from this review's findings; the §3.3 tests come first per task.

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** — tests/e2e — E18 synthetic-cancel test, and re-map `sw_pointercancel_unhandled`, add `sw_cancel_from_event_x`
  - Surfaced by: Tests, ER8. Files: `tests/e2e.test.js`, `tests/mutants/sw_*`. Verify: `--test-name-pattern="^card swipe: a pointercancel"`
- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — tests/e2e — E4 legs under 55px, and E9's `el.click()` leg
  - Surfaced by: Outside voice, OV1. Files: `tests/e2e.test.js`, `tests/mutants/sw_fling_window_whole_gesture.patch`, `sw_flight_not_landed_on_button.patch`. Verify: both mutants are killed locally with `git apply` then the single test, then CI G2
- [ ] **T3 (P1, human: ~1h / CC: ~10min)** — index.html swipe block — release-time velocity prune (vx 0 on fewer than 2 points or a zero span)
  - Surfaced by: OV3 and ER9. Files: `index.html` (swipe block only). Verify: E4 leg (b), `sw_velocity_not_aged`
- [ ] **T4 (P1, human: ~1h / CC: ~10min)** — index.html swipe block — `land()` suppresses `.card`'s transition across `step()`
  - Surfaced by: OV2. Files: `index.html` (swipe block only). Verify: E7, `sw_flip_reset_animates`
- [ ] **T5 (P2, human: ~30min / CC: ~5min)** — index.html CSS — `touch-action:pan-y pinch-zoom`
  - Surfaced by: OV4. Verify: E1, `sw_pinch_zoom_blocked`, DC7
- [ ] **T6 (P2, human: ~1h / CC: ~10min)** — index.html swipe block — bind the drag to its `pointerId`, and cancel on `lostpointercapture`
  - Surfaced by: OV5. Verify: E19, `sw_drag_not_bound_to_pointer`
- [ ] **T7 (P2, human: ~15min / CC: ~3min)** — tests/mutants — add `sw_tap_in_flight_flips`
  - Surfaced by: Tests, ER11. Verify: E8 kills it
- [ ] **T8 (P2, human: ~15min / CC: ~3min)** — tests/e2e — E13, one observable per viewport
  - Surfaced by: Tests, ER10

Effort assumes tests ~50x and features ~30x compression.

## Decision ledger

| ID | Question | Answer | Source |
|---|---|---|---|
| D1-D10 | Owner decisions (§6) | Recommended defaults, pending owner confirmation | plan author; not eng-review choices |
| ER1-ER13 | Eng-review questions (§6) | As recorded | spawned auto-decision (recommended option) |
| OV1-OV5 | Outside-voice findings (§6) | A (apply) each | spawned auto-decision (recommended option) |
| TODO-1 | N40 to TODOS.md? | B (record as N40, not added) | spawned auto-decision; plan-file-only write rule |

Approval readiness: PASS. Checked ER1-ER13, OV1-OV5 and TODO-1: each cites
its spawned auto-decision. D1-D10 are owner decisions that carry defaults and
are not eng-review remedies.

**Completion summary**
- Step 0: Scope Challenge: scope accepted as-is
- Architecture Review: 2 issues found
- Code Quality Review: 1 issue found
- Test Review: diagram produced, 4 gaps identified
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed (auto: B, recorded as N40)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, completed (5 findings, all accepted)
- Parallelization: 1 lane, 0 parallel / 1 sequential
- Lake Score: 2/2 (ER8 and OV1 both took the complete option)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Outside Review | codex, via `/plan-eng-review` | Independent 2nd opinion | 1 | issues_found | 5 findings, 5 accepted |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN (all mapped to T1-T8) | 12 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | - | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | - | - |

- **OUTSIDE COVERAGE:** codex, plan-review phase, completed, 5 findings (OV1-OV5), all accepted.
- **VERDICT:** Eng review has run, with its findings folded into the plan as T1-T8. Its logged status is issues_open, because resolved findings still count, so it is not CLEAR. It is ready to implement once the owner confirms D1-D10. Eng review required.

NO UNRESOLVED DECISIONS
