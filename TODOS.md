# TODOS

## Write DESIGN.md via /design-consultation

- **What:** Run `/design-consultation` and commit a `DESIGN.md` that records the app's tokens (Marcellus / Bitter / Nunito Sans roles, the three palettes plus swaps, `.chip` / `.mode` / `.dot` / `button.nav` anatomy, the `#e3b25c` focus ring, `--card-w`, the dark ground `#26221c` -> `#1a1815`).
- **Why:** The scale-engine design review (2026-09-08) scored consistency 8/10 only because the tokens live in `index.html` CSS and nowhere else; every new surface (the scale sheet, the Edit sheet) has to be reverse-engineered from the stylesheet.
- **Pros:** One reference for Phase 3/4 UI work and future roadmap items; reviewers can check a spec instead of a stylesheet.
- **Cons:** A second place to keep in sync with `index.html`; only worth it if it is short.
- **Context:** `docs/SCALE_ENGINE_PLAN.md` "What already exists" lists the tokens; the approved wireframe at `~/.gstack/projects/raywu-handpan-cards/designs/scale-input-20260908/approved-sheet.html` already uses them.
- **Depends on:** nothing; best done before Phase 3 starts.

## The iOS keyboard covers GENERATE CARDS while typing a seed

- **What:** On an iPhone 14 (iOS 26.6, Safari) the soft keyboard sits over the bottom of the scale sheet, so the primary the owner is aiming for - `GENERATE CARDS`, and `SAVE CHANGES` on the Edit path - is behind the keyboard for as long as the caret is in `#scale-box`. Owner's screenshot 2, 2026-09.
- **Why it is not fixed by the spacing work (lane 38):** the drawer was decompressed and the primary is reserved outside the scrolling body, which is what keeps it above the fold - measured at 844x390 the body still has 100px+ of its own to scroll and the button opens at rest, hit-testable at its own centre, at 380x800, 390x844, 390x745 and 844x390 (`tests/e2e.test.js`, "GENERATE CARDS is reachable without scrolling at every phone viewport"). None of that helps here: iOS Safari resizes the VISUAL viewport, not the layout viewport, so `dvh`, `85dvh` and every layout unit the sheet is built from are unchanged while the keyboard is up. No amount of spacing can move a button out from under it.
- **What a real fix needs:** the `visualViewport` API - listen for `resize`/`scroll` on `window.visualViewport` and translate the sheet surface (or its reserved footer) by `innerHeight - visualViewport.height - visualViewport.offsetTop`. That is new runtime behaviour in the sheet, it needs its own tests, and headless Chromium cannot reproduce the condition at all (the e2e suite's shrunken viewports are a documented PROXY for a keyboard, not the thing), so it needs a device check.
- **Cons of doing it:** a viewport listener that runs on every keyboard show/hide and on every Safari toolbar collapse, on a surface that is already the most layout-sensitive thing in the app.
- **Context:** `.sheetsurf` / `.sheetbody` / `#scale-generate` in `index.html`; the fold tests and their "what this CANNOT see" note in `tests/e2e.test.js`.
- **Depends on:** nothing; wants a physical iOS device to verify.
