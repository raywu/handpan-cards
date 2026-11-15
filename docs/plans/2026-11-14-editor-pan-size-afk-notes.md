# Editor pan size (TRI-59): AFK decision notes

## AFK decisions

- **Hint is an info button.** The counts and hint block sits behind a 44px info button (`#editor-hint-toggle`, `aria-expanded`, `aria-controls="editor-areas"`) in the active panel's hint row (`.editor-hintrow`, beside `#editor-name` on Scale, and `editorRender` moves it to the Layout row), and opens as an overlay placed by `editorPlaceAreas`, so the pan never moves. Rationale: an always-visible block costs pan height at 375x667; the overlay keeps the 200-212px pan. The tab strip reserves nothing for it (no `padding-right` on `#editor-tabs`); the test "P0 tabs: a tap near the Layout tab's right edge lands on the tab (the info button sits in the name row, not the strip)" guards that the button never covers a tab. "P0 hint resize" and `editor_hint_not_replaced_on_resize` guard re-placement on rotation.
- **Status row height.** `#editor-status` has `min-height:40px` by default and `min-height:48px` under `@media (max-width:420px)`. The row is therefore 48px at phone widths (420px wide and below), up from 40px, matching the 48px `--ed-row`. This is what the code does at the int head. The plan's message-placement D7 reserved 56px at 360px wide or less; the code had `min-height:56px` under `@media (max-width:420px)`, and commit d70fe483 changed that `min-height` from 56px to 48px, both under `max-width:420px`. The mutant `sc_status_row_reserve_56` (killed by the "SC" first-row test at 390x664) pins the 48px value. The change is therefore 56px to 48px.

## Tab test move

The Tab-order test moved from 375x360 to 375x548 and 375x440. At 375x360 a clean tree already has real tab stops outside the `#editor-region` scrollport; the owner accepted region-landing (focus scrolls the stop into the region) on 2026-11-14. 375x548 and 375x440 still overflow the region, so they exercise the same landing without relying on stops that sit outside it.
