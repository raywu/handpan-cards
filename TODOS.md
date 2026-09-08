# TODOS

## Write DESIGN.md via /design-consultation

- **What:** Run `/design-consultation` and commit a `DESIGN.md` that records the app's tokens (Marcellus / Bitter / Nunito Sans roles, the three palettes plus swaps, `.chip` / `.mode` / `.dot` / `button.nav` anatomy, the `#e3b25c` focus ring, `--card-w`, the dark ground `#26221c` -> `#1a1815`).
- **Why:** The scale-engine design review (2026-09-08) scored consistency 8/10 only because the tokens live in `index.html` CSS and nowhere else; every new surface (the scale sheet, the Edit sheet) has to be reverse-engineered from the stylesheet.
- **Pros:** One reference for Phase 3/4 UI work and future roadmap items; reviewers can check a spec instead of a stylesheet.
- **Cons:** A second place to keep in sync with `index.html`; only worth it if it is short.
- **Context:** `docs/SCALE_ENGINE_PLAN.md` "What already exists" lists the tokens; the approved wireframe at `~/.gstack/projects/raywu-handpan-cards/designs/scale-input-20260908/approved-sheet.html` already uses them.
- **Depends on:** nothing; best done before Phase 3 starts.
