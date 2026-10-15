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

### layout.test.js infers every zone's label shape from one ding label

**What:** `labelShape()` in `tests/layout.test.js` reads only the first emitted label, the ding of the first deck, and generalises its baseline, octave-tspan ratio and dy to every zone. Add a guard that asserts the same shape holds on a bottom-zone label.

**Why:** Correct today because `pan()` uses one set of numbers everywhere, but a future change giving bottom labels a different baseline would be silently modelled with the ding's, and the overflow assertion would stop testing what it claims. Pre-existing in shape: the old hardcoded literals made the same assumption.

**Context:** Reviewer nit on PR 68, non-blocking. While there, rewrap the four over-long comment lines added to `tools/hifi.py` in the same PR; one runs to 82 columns against the file's roughly 76-column norm.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Bottom-shell octave digit prints at 3.2 pt on dense generated pans

- **What:** decide a floor or a drop rule for the bottom octave digit.
- **Why:** the owner excluded it from the small-labels warning (2026-10-06), so nothing reports it.
- **Depends on:** the scale-syntax plan landing.

## SMALL_LABELS has no next action

- **What:** "Crowded pan: the smallest labels print at N pt, under the 3.6 pt this app treats as readable. Nothing is left out." tells the player what happened and nothing they can do. Once it sits directly above GENERATE CARDS / SAVE CHANGES (sheet guidance plan, 2026-10-13) it reads as a reason not to press the button.
- **Why:** design review 2026-10-13 (D7): the slot's longest tenant and its only message without a next step.
- **Cons:** the string is engine output (`src/engine/core.js` REASONS, synced into `index.html` by `tools/inline_engine.py`); its source of truth is `docs/ENGINE-SPEC.md` section 2 ("Code enum and reason strings"), pinned by the test "REASONS is the ENGINE-SPEC section 2 table, verbatim" in `tests/core.test.js`, so changing the copy means editing the spec table first; the tests that read it match a prefix (`tests/select.test.js`, `tests/app.test.js`) or read REASONS live (`tests/pdfcards.test.js`, `tests/test_gen_deck.py`); no fixture or mutant carries it.
- **Depends on:** the sheet guidance plan landing; owner opening N-7.

## Sheet guidance follow-ups

- **What:** three app-side nits from reviewer 3 on #303, recorded only (X2/X3 build):
  - No test pins that the pan warning returns when the notice clears; assert display is not none after tapping `#scale-anchor-one` in the N-A7 crowded test.
  - The `.pan` class add at `openEditSheet` and the collision branch are unpinned by mutants.
  - The markup comment above `#scale-guidance` in `index.html` still says "a warning first" and omits the yield.

## Sheet literal colours into CSS variables

- **What:** the Add/Edit sheet's colours are literals in `index.html` CSS rather than tokens; move them into CSS variables, appearance-preserving, as a separate change.
- **Why:** design review 2026-10-14 of the remove-degrees plan, pass 5 (no DESIGN.md; the plan names only existing tokens); Codex P3, decision D11.
- **Depends on:** nothing; pairs with the "Write DESIGN.md via /design-consultation" row.

## Drop the dead select:focus term of the band rule

- **What:** the `.sheetbody:has(... select:focus ...)` band rule in `index.html` still names `select:focus`, and the sheet has no `<select>` since 2026-10-14 (`#print-paper-select` is outside `.sheetbody`); one-token removal.
- **Why:** left in place by owner-style decision R-4 (the removal list was rules that NAME `#scale-degrees`); design review 2026-10-14, decision D11.
- **Depends on:** nothing.

## Share links re-store an explicit parent index

- **What:** `openShare()` persists the decoded `options.parent`, so a link minted under an override re-stores that index over an inferred record (test "RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included" pins it).
- **Why:** the 2026-10-14 removal infers on every SHEET save only; links were left honoured (R-3). Owner question from eng review 2026-10-14 (E4/E5, option B), no lane. Pros of changing: "infer always" would then be literally true.
- **Cons:** a link would no longer restore the exact deck the sender sees, a standing decision (test "a share link restores the exact deck, and options never move the id"), and the share format would carry a dead field.
- **Depends on:** nothing.
