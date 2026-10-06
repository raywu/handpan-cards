# TODOS

## Write DESIGN.md via /design-consultation

- **What:** Run `/design-consultation` and commit a `DESIGN.md` that records the app's tokens (Marcellus / Bitter / Nunito Sans roles, the three palettes plus swaps, `.chip` / `.mode` / `.dot` / `button.nav` anatomy, the `#e3b25c` focus ring, `--card-w`, the dark ground `#26221c` -> `#1a1815`).
- **Why:** The scale-engine design review (2026-09-08) scored consistency 8/10 only because the tokens live in `index.html` CSS and nowhere else; every new surface (the scale sheet, the Edit sheet) has to be reverse-engineered from the stylesheet.
- **Pros:** One reference for Phase 3/4 UI work and future roadmap items; reviewers can check a spec instead of a stylesheet.
- **Cons:** A second place to keep in sync with `index.html`; only worth it if it is short.
- **Context:** `docs/SCALE_ENGINE_PLAN.md` "What already exists" lists the tokens; the approved wireframe at `~/.gstack/projects/raywu-handpan-cards/designs/scale-input-20260908/approved-sheet.html` already uses them.
- **Depends on:** nothing; best done before Phase 3 starts.

## The iOS keyboard covers GENERATE CARDS while typing a seed

**Shipped, device check outstanding.** Both halves of the fix below are in
`index.html`: `kbOffset()` translates the sheet surface by
`innerHeight - visualViewport.height - visualViewport.offsetTop`, and `kbCap()`
caps the surface to the shrunken visual viewport so the translate cannot lift
`#scale-box` off the top of the screen. Both are pure functions and unit-tested
in `tests/app.test.js`, and since lane S6 the listener that feeds them is
covered too: `b.fakeKeyboard()` shadows `visualViewport.height` and fires a
real resize, so e2e drives the whole path against the shipped file.

- **What was wrong:** on an iPhone 14 (iOS 26.6, Safari) the soft keyboard sat
  over the bottom of the scale sheet, so `GENERATE CARDS` - and `SAVE CHANGES`
  on the Edit path - was behind the keyboard for as long as the caret was in
  `#scale-box`. Owner's screenshot 2, 2026-09.
- **Why spacing could never fix it:** iOS Safari resizes the VISUAL viewport,
  not the layout viewport, so `dvh`, `85dvh` and every layout unit the sheet is
  built from are unchanged while the keyboard is up.
- **What is still open:** the owner check on hardware. CI drives the wiring but
  cannot produce a real keyboard - no CDP soft-keyboard emulation exists - so
  the PREMISE that iOS shrinks the visual viewport is the part nothing in CI
  can close. Tracked as queue row 67 in
  `docs/plans/2026-09-16-remaining-work-coordination.md`: iPhone 14 / iOS 26.6,
  BOTH the ADD and the EDIT page, keyboard up.
- **Context:** `kbOffset` / `kbCap` and the `visualViewport` listener in
  `index.html`; the fold tests and their "what this CANNOT see" note in
  `tests/e2e.test.js`.

## Scale engine

### Python oracle lacks a tie-break when a pitch appears in two zones

**What:** `tests/test_deck_data.py:338` picks a tone's highest lower instance with `max(instances(f, True), key=midi)`. When one MIDI exists as both a top-shell and a bottom-shell field, `max` returns whichever the enumeration happened to reach first. Fix: `key=lambda g: (midi(g), zone(g) != "bottom")`, which matches the engine's top-first tie-break.

**Why:** Reachable, not latent. Dedup keys are namespaced `"top "`/`"bottom "` at `src/engine/core.js:395,413`, so a seed can legitimately carry the same MIDI in two zones. On the seed `(C3) G3 B3 D4 E4 G4 B4 | Bb2 B3 D4`, D4 parses as both rim id 3 and bottom id 103 at MIDI 62; on Em7 rooted E4 the engine emits correct all-top-shell output, and the oracle enumerated bottom-first computes `forced=False` and rejects it with three assertion failures. Confirmed both orderings: top-first `(True, [])`, bottom-first `(False, [3 failures])`.

**Context:** Surfaced by the independent reviewer on PR 67 as Nit 2, not a blocker there because no shipped deck hits it. It becomes a live false failure as soon as generated decks from user seeds are exercised, which is Part B territory.

**Effort:** S
**Priority:** P2
**Depends on:** None

### layout.test.js infers every zone's label shape from one ding label

**What:** `labelShape()` in `tests/layout.test.js` reads only the first emitted label, the ding of the first deck, and generalises its baseline, octave-tspan ratio and dy to every zone. Add a guard that asserts the same shape holds on a bottom-zone label.

**Why:** Correct today because `pan()` uses one set of numbers everywhere, but a future change giving bottom labels a different baseline would be silently modelled with the ding's, and the overflow assertion would stop testing what it claims. Pre-existing in shape: the old hardcoded literals made the same assumption.

**Context:** Reviewer nit on PR 68, non-blocking. While there, rewrap the four over-long comment lines added to `tools/hifi.py` in the same PR; one runs to 82 columns against the file's roughly 76-column norm.

**Effort:** S
**Priority:** P3
**Depends on:** None
