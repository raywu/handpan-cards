# Prompt: animated card swipe (Tinder-style), as a /swarm plan

You are planning, not building. Repo: `/Users/ray/Projects/handpan-cards`, base
`origin/main` @ `e728912`. Read `CLAUDE.md`, then §6 (merge gates) and the
non-goals of `docs/plans/2026-09-24-quality-eval.md`; they carry over
unchanged. Use `docs/plans/2026-09-28-android-bg-and-menu.md` as the structural
template. Read `docs/plans/2026-09-29-chord-sequence-mode.md` (in flight) before
§3: it owns code this work sits next to.

## Owner feedback (verbatim)

> card swipe left & right should be animated, as pioneered by Tinder. Deep
> research on the implementation and optimize for a lightweight implementation
> that doesn't introduce more dependencies than what is necessary.

"Lightweight" is binding: no library, no `<script src>`, no new sibling file.
The whole feature is CSS plus a small block of app JS inside `index.html`.

## What exists today (read at `e728912`, verify before citing)

- **Swipe** (`index.html:7844-7849`): touch-only, both listeners passive.
  `touchstart` records `clientX`; `touchend` calls `step(dx < 0 ? 1 : -1)` when
  `|dx| > 55`. Nothing moves during the gesture, there is no mouse drag, and
  there is no velocity term.
- **Flip** (`:7685-7699`): `flip()` toggles `flipped` and calls `render()`;
  `step(dir)` wraps `idx`, clears `flipped` and calls `render()`. The card
  flips on `click`, and on Enter/Space from its own keydown handler.
- **Card CSS** (`:398-419`): `.scene` holds `perspective:1400px` and the
  aspect/size rules the budget tables measure. `.card` has
  `transform-style:preserve-3d` and a `.45s` transform transition, and
  `.card.flip` is `rotateY(180deg)`. Reduced motion sets `.card{transition:none}`.
  `.card:active` (`:798-812`) uses a box-shadow ring, deliberately not a
  transform or filter, because either would fight the flip. A print rule
  (`:851`) sets `backface-visibility:visible`.
- **Back-swipe guard** (`:61-71`): `html{overscroll-behavior-x:none}` stops the
  Android/iOS edge back gesture, because the passive listeners cannot
  `preventDefault()`.
- **Keyboard** (`:7800-7843`): ArrowLeft/Right call `step`, except while
  `sheetOpen` or `panelOpen` (both globals), where every non-Escape key returns.
- **Announcement**: `#count` (`:935`) is `aria-live="polite"` and `render()`
  (`:6540`) writes it. Tests pin it at `tests/e2e.test.js:5890`.
- **Tests**: `tests/e2e.test.js:480-575` (threshold, deadzone with the
  `window.__swipeAck` touchend ack, wrap at both ends, overscroll).
  `b.swipe()` (`tests/helpers/cdp.js:234`) sends ONE `touchStart`, ONE
  `touchMove` and a `touchEnd` with no delay between them.
  `tests/app.test.js:275` covers `step()`.

## Research findings the plan must start from (cite, then build on)

1. **Pointer Events + `setPointerCapture`** (MDN, Baseline since 2020) give one
   code path for touch, mouse and pen. Capture keeps the drag on the card when
   the finger leaves it, and is released automatically on `pointerup` or
   `pointercancel` (javascript.info/pointer-events).
2. **`touch-action: pan-y`** on the drag target hands horizontal gestures to
   the page and keeps vertical panning with the browser. It is fully supported
   on iOS Safari 13+ and Chrome, and not supported on desktop Safari, where
   mouse drags do not need it. Once the browser claims a gesture it fires
   `pointercancel`, and the handler must spring back on it. Changing
   `touch-action` mid-gesture has no effect. Say whether `overscroll-behavior-x`
   on `html` is still needed once the card no longer lets horizontal pans
   through: keep it unless a test shows it is redundant, and never drop it
   silently (`f_overscroll_x_dropped`).
3. **The Tinder pattern** (Heilmann's "Tinderesque", Rob Vermeer's CodePen,
   simonepm's vanilla carousel): during the drag, remove the transition and
   set `translate3d(dx, 0, 0) rotate(dx * k)`. On release, commit if `|dx|`
   exceeds a distance threshold OR the release velocity exceeds a fling
   threshold. Otherwise spring back. A commit flies the card off-screen in the
   drag direction, then the next card appears.
4. **WAAPI** (`el.animate()`, Baseline 2020) returns an `Animation` whose
   `finished` promise resolves on completion and rejects with `AbortError` on
   `cancel()`. `document.getAnimations()` exposes it to a test, which can
   `finish()` it deterministically. CSS transitions report through
   `transitionend`, which never fires when an interrupted transition fires
   `transitioncancel` instead, or when the value does not change. That makes
   them the harder of the two to test and to chain.
5. **Pitfalls specific to this app:**
   - The flip is a `rotateY` on `.card`. A drag transform on the same element
     overwrites it. The drag belongs on a different element: `.scene`, or a
     new wrapper between `.scene` and `.card`.
   - Pointer events fire a `click` after `pointerup`. A drag that ends on the
     card would therefore also flip it. The plan must suppress that one click
     after a drag past a small slop, and never suppress a genuine tap.
   - `b.swipe()` has no time between its move and its end, so any velocity
     rule reads an infinite fling. Today's "a 50px drag does not navigate"
     test would then fail for the wrong reason. The helper needs timed moves,
     and the plan must say how velocity is sampled: the last N ms of
     `pointermove`, not the first-to-last average.
   - CDP `Input.dispatchTouchEvent` also produces pointer events in Chrome.
     Confirm that with one single e2e run before relying on it, and add
     `Input.dispatchMouseEvent` drags for the mouse path.

## Part A: approaches and cost

Evaluate these, each with an estimated byte cost (CSS plus JS, minified-ish,
against today's `index.html` size), its complexity (new state, new DOM, new
failure modes), and its test cost:

- **A1: CSS transition + pointer events.** Pointer handlers set an inline
  transform on the drag element with no transition during the drag. Release
  sets a class or transform, and the CSS transition does the fly-out and the
  spring-back, chained on `transitionend` or `transitioncancel`.
- **A2: WAAPI + pointer events.** Same handlers; release runs `el.animate()`
  and awaits `finished`. Both the spring-back and the fly-out are keyframes,
  and an interrupted animation is `cancel()`ed.
- **Card model (orthogonal to A1/A2; choose one):**
  - **S1: single card, re-rendered.** The card flies out, `step()` renders
    the next chord into the same `#card`, and the card enters from the
    opposite edge or fades in.
  - **S2: two-card stack.** The next card is pre-rendered underneath and is
    revealed as the top card leaves. Cost it honestly: a second
    `#front`/`#back` pair means duplicate ids, a second SVG diagram per
    render, `aria-hidden` on the under-card, and a second copy of what the
    budget tables measure. Say what `prev` shows under the card when the drag
    is to the right.

Recommend one combination. The expected default is **A2 + S1**. It needs no
second DOM card, `finished` is testable, and it needs the least new state. It
does not need to win, but any other choice must say why its extra cost buys
something the owner would see.

**Constants.** Name every tunable as a top-level `const` near the swipe code,
and have tests read or assert it: the commit distance (today 55px; say whether
it stays absolute or becomes a fraction of card width), the fling velocity
(px/ms), the tap slop below which a gesture is a tap, the rotation factor and
its max angle, and the fly-out and spring-back durations and easings. For each,
give the value, the reason, and the test that pins it at its boundary. Follow
the existing test's 50/60 bracket style, one inside and one outside.

## Part B: the motion and the UI

**Required step:** before drafting Part B, run
`/frontend-design:frontend-design` (motion direction only, no code) with the
brief below, and carry its output into §2 of the plan. Keep it inside
"preserve the visual system": no new colour, typeface, shadow language or
card anatomy. Record any place where you override the skill's defaults.

Brief to pass it: "Motion direction only, for a horizontal swipe on a single
flashcard in Handpan Chord Cards (index.html, vanilla JS, no libraries). The
dark table is #1a1815/#26221c. The cards are paper-white with a 3D Y-flip
(.45s cubic-bezier(.2,.7,.25,1)). Tinder-style: the card follows the finger
with slight rotation, flies off on commit and springs back on cancel. Both
directions mean navigation (next/previous), not accept/reject: no like/nope
stamps and no colour tint. Must honour prefers-reduced-motion, 44px targets, a
380px viewport and a landscape one-row header."

Answer:

- **Direction semantics.** Left means next and right means previous, as today
  (`e_swipe_direction_inverted`). Say what the entering card does: it enters
  from the opposite side, or appears in place.
- **Buttons and keyboard.** Decide whether `#prev`/`#next` and ArrowLeft/Right
  play the same fly-out, a shorter version, or none. Recommend one. Rapid
  repeated presses must never queue a backlog or drop a step. Either finish
  the running animation before stepping, or step immediately and cancel it.
  Say which, and prove it with a test.
- **Flip interaction.**
  - Swiping a flipped card: say whether the fly-out shows the back face.
    `step()` clears `flipped`, so the next card arrives front-up.
  - A tap during a fly-out or spring-back must not flip the wrong card.
  - A drag must never flip the card (the click-after-drag pitfall).
  - The `.card:active` ring and the keyboard Enter/Space flip stay as they are.
- **Settings panel and scale sheet.** While `panelOpen` or `sheetOpen`,
  pointer drags on the card do nothing, matching the keyboard guard.
  Opening either one mid-gesture or mid-animation leaves the card at rest, on
  a defined index.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, the swipe still
  navigates. Say whether the card still follows the finger (the recommended
  default is no: no rotation, no fly-out, an instant step). Test that it
  navigates and that no animation runs (`getAnimations().length === 0`).
- **A11y.** The `#count` polite announcement is unchanged: one announcement
  per step, written by `render()`, never per animation frame. There is no new
  live region and no focus move. A card that has left the screen is never
  focusable or exposed.
- **Layout.** No layout shift. The drag uses only `transform` (and `opacity`
  if the design needs it), never width, left or margin. `will-change:
  transform` is applied only during a gesture, or the plan justifies making it
  permanent. CHROME_BUDGET (`tests/e2e.test.js:2713`) and LANDSCAPE_BUDGET
  (`:2788`) only tighten; this work should leave both unchanged. A card flying
  off-screen must not create horizontal page scroll: check `overflow` on
  `main`, and whether `.scene`'s bounds clip the rotation corners at 380px.
  44px targets hold, and the landscape one-row header is untouched.
- **Print.** Out of scope. A printed card carries no transform: add one
  assertion under print media.

## Part C: testing

Everything must be deterministic in CDP e2e. No sleeps and no screenshot
diffs.

- **Mid-gesture.** Dispatch pointer or touch down plus a move of +80px and
  hold (no up). Read `getComputedStyle(dragEl).transform`, parse the matrix,
  and assert that translateX is about 80 and that the rotation sign matches the
  direction. Then release below the threshold and assert a return to identity.
- **Commit and finish.** After release past the threshold, await the
  animation: either `Promise.all(document.getAnimations().map(a =>
  a.finished))` via `Runtime.evaluate` with `awaitPromise`, or `finish()` it.
  Then assert `#count` and the card content. Say how A1 would be awaited, if
  A1 wins.
- **Velocity.** Extend `b.swipe` (or add `b.drag`) with timed intermediate
  moves, sent by CDP with explicit `timestamp`s rather than wall-clock sleeps
  if possible. Cover a short fast fling that commits and a long slow drag
  under the distance threshold that springs back. Keep the existing threshold,
  deadzone and wrap tests passing, and re-target them to the new helper where
  the instant move would now read as a fling.
- **Mouse.** A mouse drag commits. A mouse click without movement still
  flips. A drag past the slop does not flip.
- **Guards.** A drag while the panel or sheet is open does nothing. A drag
  under reduced motion (`Emulation.setEmulatedMedia` with
  `prefers-reduced-motion`) steps with no animation. A 2-card deck, or
  2-chord sequence, where prev and next are the same card still animates and
  lands correctly.
- **Scroll.** Where the page can scroll vertically (landscape, or 320x568), a
  vertical drag on the card scrolls and does not step. Under CDP this is
  `pointercancel`.
- **Unit (`tests/app.test.js`).** If the commit decision is a pure function,
  e.g. `swipeDecision(dx, vx)`, unit-test its boundaries there as well.

**Mutants.** List every existing mutant under `tests/mutants/` whose target a
lane moves or deletes. Find them by grepping the removed lines, not the hunk
headers. At least these are expected: `e_swipe_direction_inverted`,
`e_swipe_deadzone_dropped`, `f_overscroll_x_dropped`, `e_flip_transform`,
`e_card_press_ring_is_square`, `d_step_keeps_flip`,
`m3b_panel_guard_too_broad`, `e_nav_wrap`, and the three `e_landscape_card_*`.
For each, say whether it needs a context refresh, a re-target, or retirement.
Then propose the new ones, prefixed `sw_`, one per constant and guard:

- threshold off by one;
- fling ignored;
- click after drag not suppressed;
- drag on `.card` instead of the wrapper (it kills the flip);
- reduced motion ignored;
- panel guard dropped;
- `pointercancel` not handled;
- `touch-action` dropped;
- the announcement written per frame.

## Ownership overlap with the chord-sequence plan (must resolve)

`docs/plans/2026-09-29-chord-sequence-mode.md` lane **S2** owns `render()`
(`:6540-6582`), `setOrder()` (`:6585`), the footer count and Shuffle
(`:7703-7707`), `panelStops()`, `setMode` and the `.modebar` CSS. In sequence
mode it also changes how `step` wraps. This plan must either:

- **own disjoint regions**: the swipe handler (`:7844-7849`), the
  `.scene`/`.card` CSS (`:398-419`), a new wrapper element in `<main>`
  (`:917-927`), and new consts; and call `step()` and `render()` without
  editing either. Buttons and arrows that animate would then wrap `step` at
  their call sites (`:7702-7703`, `:7841-7842`; these four plus the swipe at `:7849` are every `step` caller, enumerated by `grep -n "\bstep\b"`), which S2 does not own. Or:
- **serialise** after S2 merges, if the design needs to change `step()` or
  `render()` (e.g. an entering-card hook).

Say which, and why. Both plans add FLOORS rows in `tests/suite_health.py`,
which is a shared single-number row: the second to merge rebases and adds.
Both append e2e describe blocks. A sequence of length 2 makes prev == next,
and that case must be tested here.

## Constraints the plan must survive

- Single-file `index.html`, no build step, no dependencies, and no hand edits
  to the engine regions or the `const DECKS` line. This work touches neither.
- Do not alter deck data, diagram geometry, card anatomy, fonts or palettes.
- NAME->NOTES / NOTES->NAME, print, the panel, the scale sheet, and the
  keyboard flows behave as today, apart from whatever animation the plan
  explicitly decides to add.
- iOS Safari and Android Chrome are the primary targets (the owner plays on a
  phone). Test at 380px, 320x568 and 844x390.

**Minimum first version.** Define v1 explicitly. Default non-goals unless the
plan argues otherwise:

- vertical swipe actions;
- a swipe-to-flip gesture;
- physics or spring libraries;
- haptics (`navigator.vibrate`);
- a visible two-card stack;
- swipe on the print preview;
- any change to the panel or sheet gestures.

## Method and budget

Read-only evaluation. You may run single tests
(`node --test --test-name-pattern=...`) and single e2e tests with
`CHROME_BIN`. Never run the full `tests/mutation_check.sh` or the full e2e file
locally; CI at the head SHA is the evidence. A throwaway spike in a scratch
copy is allowed if you want to measure bytes or confirm that CDP touch events
produce pointer events. Report what it measured, and delete it.

## Output

Write `docs/plans/2026-09-29-card-swipe-animation.md`. **Shape it for
`/swarm` and write it TDD-first.** Lanes split by file-ownership boundary,
each with acceptance criteria and an exact verify command, explicit
non-goals, standing merge gates, worktree isolation, and an independent
reviewer per PR. Every lane lists its failing tests (by name, with the
assertion) before its implementation steps, and its verify command runs those
tests. The expected shape is one lane, which may split in two only on a real
ownership boundary: the test helper (`tests/helpers/cdp.js` timed drags) plus
the re-targeted swipe tests, then the app change.

1. Header: goal (one testable sentence), date, base SHA, shape, related docs
   (including the chord-sequence plan).
2. §1 Goal and non-goals. Carry quality-eval's and the android/menu plan's;
   add the v1 non-goals.
3. §2 Findings:
   - the research above with sources;
   - the A1/A2 x S1/S2 table with bytes, complexity and test cost, and a
     recommendation;
   - the constants table;
   - the motion direction from the `/frontend-design:frontend-design` run,
     with an ASCII sketch of the drag, commit and spring-back states at 380px
     and landscape;
   - the flip, panel, sheet and reduced-motion interaction matrix.
4. §3 Lanes: `| Lane | Owns | Never touches | Acceptance | Verify |`, with
   line regions, FLOORS rows and mutant prefixes per lane, and the resolution
   of the chord-sequence overlap.
5. §4 Order and dependencies, relative to the chord-sequence lanes S1 and S2.
   §5 Merge gates (deltas only).
6. §6 Owner decisions, each with a recommended default. At least:
   - the approach;
   - whether buttons and keys animate;
   - reduced-motion behaviour;
   - the threshold and fling values;
   - the rotation angle;
   - the entering-card motion;
   - mouse drag on desktop;
   - the v1 cut.
7. §7 Mutant list: existing mutants with refresh/re-target/retire, and new
   `sw_*` mutants with the test that kills each.

Sources to cite (verify each):

- MDN: `Element.setPointerCapture`, `touch-action`, `pointercancel`,
  `Element.animate`, `Animation.finished`, `prefers-reduced-motion`;
- caniuse `css-touch-action`;
- javascript.info/pointer-events;
- Christian Heilmann, "Tinderesque" (2015);
- the RobVermeer CodePen "Tinder swipe cards".

Do not commit. Then run /plan-eng-review on the plan.
