# Resources section in the settings menu

Lane: `claude/resources-menu`, single serial lane, own worktree, base origin/main.
Run after PR #180 merges. It touches no swipe code, but both lanes edit
`index.html` and `tests/e2e.test.js`, so the lane starts from a base that already
has #180.

## Goal

The settings panel (the hamburger panel on mobile, the sidebar on desktop) gains
a "Resources" group with three outbound links:

- Handpaner - https://handpaner.com/
- Ding & Tones - https://www.dingandtones.com/
- Handpan Training Cards - https://svenkirchhofer.de/handpan-training-cards/

## Non-goals

- No new colour, typeface or label style.
- No icons and no link descriptions.
- No change to the Practice, Scales or Print groups.
- No changes to deck data, geometry, the engine regions or the print PDFs.
- No README change.

## Design

- **Markup:** a 4th `.panel-group` placed after "Print this deck". It holds
  `<h3 class="panel-heading">Resources</h3>` and three `<a>` elements.
- **Link attributes:** each `<a>` gets `target="_blank" rel="noopener"`,
  matching the existing `#seq-source-link`.
- **Link styling:** the links are styled as `.mode` (an all-caps, 44px-tall
  target). The same convention already covers the panel's other controls.
  - Labels: HANDPANER, DING & TONES, TRAINING CARDS.
  - The Kirchhofer link keeps its full name in `aria-label`
    ("Handpan Training Cards by Sven Kirchhofer").
  - Whether `.mode` renders correctly on an `<a>`, with no underline or visited
    colour, is checked in step 2.
- **Ids for tests:** `res-handpaner`, `res-dingandtones` and `res-trainingcards`.

## Main risk: the panel's "no scroll" budget

The e2e test `the full-screen settings panel fits with no scroll in every mode,
at 320x568 and every landscape size` (`tests/e2e.test.js:1341`) asserts four
things at 320x568, 844x390, 926x428, 667x375 and 1280x500, in modes A, B and S:

- no vertical or horizontal overflow
- no control off screen
- no control under the X trigger
- every `button, select, a` at least 44px tall

A fourth group adds a heading plus 3 x 44px. Two layouts are at risk:

- The landscape grid (`max-height:520px`, `minmax(200px, 1fr)`) at 667x375 runs
  3 columns, so a 4th group wraps to a second row.
- At 320x568 portrait in mode S, which also shows the credit note.

Step 1 measures the remaining height first. Fallbacks, used in this order and
only as needed:

1. The three links sit side by side in a `.modebar`-style row rather than
   stacked (the same pattern as the Practice buttons).
2. In the `max-height:520px` grid, Resources spans the full width as one row.

If neither fits, STOP and ask the owner. Do not loosen the fit test.

## Steps (TDD)

1. **Measure.** Add the group temporarily and run the fit test narrowly
   (`--test-name-pattern "settings panel fits"`). Record the slack at each size.
   This is a probe, not a commit.
2. **Tests first** (`tests/e2e.test.js` and/or `tests/app.test.js`):
   - **Markup:** the panel has exactly one Resources group with the three hrefs
     verbatim, each `target=_blank` and `rel` containing `noopener`, in the
     order above.
   - **Fit:** the existing fit test already covers the new links, because it
     selects every `a`. Add one assertion that the three ids are among the
     measured controls, so a hidden group cannot pass the test vacuously.
   - **Desktop sidebar** (1280x800): the links are visible and the sidebar does
     not scroll, or if it does, that matches current behaviour. Measure before
     asserting.
   - **Behaviour:** clicking a link neither closes the panel nor changes the
     mode or card. The e2e test asserts this with the `click` event's default
     prevented, so the run does not leave the page.
3. **Implement** the markup, plus CSS for `a.mode` only if step 2 needs it.
4. **Mutants:** 2 to 3 new `qr_*` patches, each killed by a test: a wrong href,
   a missing `noopener`, and the group hidden at landscape.
   - Each patch has a `# kills:` line with the exact test name and an anchored
     `# suite:` line, using `.` for spaces.
   - Run `git apply --check` across all of `tests/mutants/*.patch`.
5. **Smoke test:** `python3 tools/validate.py`, plus the narrow e2e patterns.
   CI at the pushed head is the evidence.

## Verify

`node --test --test-name-pattern "settings panel|Resources" tests/e2e.test.js`
locally as a smoke test; CI (including the mutation gate) at the head SHA; then
a fresh reviewer.

## Open question for owner

- **Labels:** all caps to match the panel ("HANDPANER"), or the sites' own names
  in sentence case ("Handpaner")? The plan defaults to all caps per the existing
  convention.

## Eng review amendments (2026-10-01, /plan-eng-review, AFK auto-decided)

Target: this plan, checked against origin/main 10960be.

1. **[P1] (conf 9) index.html:7924-7931 `panelStops()` is a hard-coded list**
   (`settingsTrigger, modeA, modeB, modeS, ...seqLink, deck-add, ...prints
   button/select`). Below 1024x700 the panel is modal and Tab is trapped to
   that list, so three new links would be unreachable by keyboard.
   **Decision (auto, recommended):** add the three `#res-*` links to
   `panelStops()` after the print controls; extend the existing Tab-trap test
   (`tests/e2e.test.js:1187` "Tab is trapped inside the settings panel and
   cycles every stop") so forward and backward Tab both reach all three.
   Add mutant `qr_res_link_not_a_stop.patch`.
2. **[P2] (conf 8) index.html:224 `.mode` sets no `text-decoration`.** On
   an `<a>` the UA underline would show. **Decision:** add
   `a.mode{text-decoration:none}` up front (not "only if needed"); the markup
   test asserts computed `text-decoration-line` is `none`.
3. **[P3] (conf 7) Click handling.** The mode buttons and PDF buttons call
   `closePanel()`; the links deliberately do NOT (the user returns from the
   new tab to the open menu). Recorded as intended behaviour, covered by the
   step-2 behaviour test. Arrow keys after clicking a link on desktop still
   step the card (`index.html` keydown guard only skips SELECT/INPUT/TEXTAREA).
4. **Label case:** all caps (HANDPANER / DING & TONES / TRAINING CARDS),
   per the panel's "controls keep their ALL-CAPS Nunito voice (N15)" rule at
   index.html:262-263. Auto-decided; owner can veto at review.

Scope check: index.html, tests/e2e.test.js, 3-4 new tests/mutants/qr_*.patch.
Under the 8-file gate; no new services. Performance: none (static markup).
Mutants now: wrong href, missing noopener, group hidden at landscape, link
dropped from panelStops().

### Outside voice (Codex, completed) - all three accepted (auto, recommended)

5. **[P2] Desktop fit at the boundary.** Measure and test the sidebar at
   1024x700 (its smallest size) in modes A, B and S, not only 1280x800.
   Baseline first: if the sidebar already scrolls at 1024x700 today, the
   assertion is "no new scroll beyond baseline + Resources"; record the
   numbers in the PR body.
6. **[P2] Desktop target test uses a hard-coded selector list**
   (`tests/e2e.test.js:~6783`, "every panel control ..."). Add the three
   `#res-*` ids so they get the desktop 44px / hit-test coverage.
7. **[P2] Behaviour test must prove activation, not just inertness.** Intercept
   navigation (capture-phase listener records `href`/`target` then
   `preventDefault`) and assert mouse click AND Enter on a focused link each
   produce exactly one activation to the expected href with `target=_blank`,
   while panel/mode/card state is unchanged. A production `preventDefault()`
   must fail this test (add it as mutant `qr_res_link_inert.patch`).

Review status: CLEAR with amendments 1-7 folded into the lane brief.
