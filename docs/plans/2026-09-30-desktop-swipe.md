# Desktop swipe: mouse drag + trackpad

Lane: `claude/desktop-swipe`, single serial lane, worktree. Base: origin/main.

## Goal

On desktop Chrome/Safari, a mouse press-and-drag across the card and a
two-finger horizontal trackpad swipe each change the card exactly once,
without flipping it. Click-to-flip stays a single click. Touch behaviour
is unchanged.

## Evidence (desktop swipe lab, artifact db logs, 2026-09-30)

- Chrome on macOS delivers `lostpointercapture` with `buttons === 0` as part
  of an ordinary mouse release. `index.html` treats every
  `lostpointercapture` as a cancel (`release(e, true)`), so a mouse drag
  springs back instead of committing. Lab toggle `lpc` fixed it.
- A trackpad two-finger swipe produces `wheel` events with `deltaX`, not
  pointer events; the app ignores them. Lab: sum `deltaX` over a gesture,
  commit past 80 px, gesture ends after 160 ms with no wheel event.
- The owner reports no unintended flips on production; the lab's flip
  experiments (undo, defer, double-click) are NOT ported.

## Changes (index.html, app JS outside engine regions)

1. `lostpointercapture` on a mouse pointer with no button held (`!(e.buttons & 1)`)
   is a normal release: `release(e, false)`. Every other
   `lostpointercapture` (touch, pen, mouse with button still down) stays a cancel.
2. `eatClick` after a moved, non-cancelled release decays after 400 ms
   instead of `setTimeout(0)`, so the trailing click of a mouse drag is
   eaten even when the release ran on `lostpointercapture` ahead of
   `pointerup`/`click`. Safe: the capture-phase pointerdown handler already
   resets `eatClick` on every real press, so a later deliberate click flips.
3. Trackpad swipe: a `wheel` listener (passive: false) on `<main>`:
   ignore `ctrlKey` (pinch zoom); normalise deltaMode (line 16 px, page =
   innerHeight); accumulate `sx`/`sy` per gesture, gesture ends 160 ms after
   the last event; once `|sx| > |sy|`, `preventDefault()` (stops the
   browser back/forward swipe); past `|sx| > 80` fire once per gesture
   (`sx > 0` -> next card, i.e. content follows the fingers), reusing the
   existing fly-out (`swipeXf`, `SWIPE_OUT_MS`, `flight`, `land()`); before
   the threshold the card follows `-sx` and springs back on gesture end if
   it never fired. Skip when `panelOpen || sheetOpen || !order.length` or a
   flight is in progress. Reduced motion: `step(dir)` directly.

## Tests first (tests/e2e.test.js, plus unit where pure)

- Mouse drag whose release arrives as `lostpointercapture` (buttons 0) then
  `pointerup` then `click`: card index advances by 1, card not flipped.
- Touch `lostpointercapture` mid-drag still cancels (existing tests stay green).
- Mouse `lostpointercapture` with `buttons & 1` still cancels.
- Single click on the card after a drag (>400 ms or after a new pointerdown)
  flips it.
- Wheel: deltaX sum > 80 advances once per gesture (many events, one step);
  < 80 does nothing and leaves no transform; vertical-dominant wheel does
  nothing and is not preventDefault-ed; ctrlKey wheel ignored; a second
  gesture after the 160 ms gap advances again; ignored while panel/sheet open.
- New mutants under tests/mutants/ for each new branch (lpc buttons check,
  ctrlKey guard, threshold, once-per-gesture, axis guard).

## Non-goals

Any flip-suppression logic (undo/defer/double-click/cooldown); changing
touch thresholds; arrow buttons/keys; engine regions; deck data; CSS.

## Verify

`node --test tests/e2e.test.js` filtered to the new tests locally as smoke;
CI at the pushed head is the evidence (incl. mutation gate).

## Eng review (APPROVE_WITH_CHANGES) - changes adopted, these override the sections above

Lab-observed Chrome/macOS mouse release order (db trace 2lru4aur8i92pgogjd0t):
`pointermove b=1 394,755` -> +10 ms `lostpointercapture mouse b=0 380,755 on card`
-> `pointerup mouse b=0 380,755` (pointerup arrives AFTER lpc, buttons 0, clientX
real). Firefox/Safari fire lpc after pointerup, when drag is already null, so the
change only matters in Chrome. The `buttons` guard protects only browsers that
populate `buttons` on lpc.

1. On the lpc-as-release path do NOT push `e`'s point into `drag.pts`; use
   `drag.pts`/`drag.last` as they stand. Test: short leftward mouse drag
   (11-18 px) ending in lpc with clientX 0 springs back (no fling).
   e2e replicates the observed order: lpc (buttons 0) -> pointerup -> click,
   each dispatched in a SEPARATE CDP round trip so a setTimeout(0) can fire
   between them.
2. The 400 ms decay is MOUSE-ONLY: store `pointerType` on `drag` at both
   creation sites; touch/pen keep setTimeout(0) (protects e2e "Enter on a
   focused #next after a settled touch swipe").
3. Keep the decay timer handle (or an `eatClickUntil` timestamp) and cancel it
   wherever eatClick is assigned (capture pointerdown in-flight + no-flight
   branches, click handler), so a stale timer cannot clear a fresh eatClick.
   Test the race: mouse drag commit, tap mid-flight ~200 ms later held past
   400 ms -> new card NOT flipped.
4. Factor `flyOut(dir, dx)` and `springBack(dx)` out of release(); both release
   and the wheel path call them. flight.rect is measured after clearing the
   inline transform.
5. Wheel axis is locked per gesture from the first non-zero event and held
   until the gesture ends. Skip cases (flight in progress, live `drag`,
   panel/sheet open) still extend the 160 ms gesture timer and keep the
   per-gesture fired flag, so momentum after landing cannot step again.
6. Wheel target `<main>` (index.html:986-998) holds only `.scene`; `#decks`
   (overflow-x) is in <header> and #settings-panel is outside <main>. Reduced
   motion: no follow transform, one `step(dir)` per gesture.
7. Mutation gate: lane owns tests/mutants/sw_*.patch. Refresh every patch made
   stale (at least sw_eatclick_armed_on_cancel, sw_reduced_motion_ignored,
   sw_jitter_hop_guard_dropped, sw_drag_not_bound_to_pointer,
   sw_contextmenu_release_dropped, sw_pointercancel_unhandled,
   sw_click_after_drag_not_suppressed, fling/flight mutants) and
   `git apply --check` ALL tests/mutants/*.patch. One new mutant per new test,
   `# kills: <exact test name>` + anchored `# suite:` with `.` for spaces.
   New mutants at least: decay 400->0, mouse-only guard dropped, lpc pushes
   e's point, clearTimeout dropped, lpc buttons check dropped, wheel ctrlKey
   guard, threshold, once-per-gesture, axis lock.
8. Accepted trade-off: keyboard Enter within 400 ms of a mouse drag whose
   trailing click never arrived is eaten.
