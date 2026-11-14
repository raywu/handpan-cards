# Editor pan size (TRI-59): AFK decision notes

## AFK decisions

- **Hint is an info button.** The counts and hint block sits behind a 44px info button (`#editor-hint-toggle`, `aria-expanded`, `aria-controls="editor-areas"`) in the tab strip, and opens as an overlay placed by `editorPlaceAreas`, so the pan never moves. Rationale: an always-visible block costs pan height at 375x667; the overlay keeps the 200-212px pan. The strip reserves 44px (`padding-right` on `#editor-tabs`) so the Layout tab never runs under the button; the test "P0 tabs" and mutant `editor_tabs_no_hint_reserve` guard it. "P0 hint resize" and `editor_hint_not_replaced_on_resize` guard re-placement on rotation.
- **Status row height.** `#editor-status` has `min-height:40px` by default and `min-height:48px` under `@media (max-width:420px)`. The row is therefore 48px at phone widths (420px wide and below), up from 40px, matching the 48px `--ed-row`. This is what the code does at the int head; no earlier 56px value exists in `index.html`, so no "56 to 48" change is claimed.

## Tab test move

The Tab-order test moved from 375x360 to 375x548 and 375x440. At 375x360 a clean tree already has real tab stops outside the `#editor-region` scrollport; the owner accepted region-landing (focus scrolls the stop into the region) on 2026-11-14. 375x548 and 375x440 still overflow the region, so they exercise the same landing without relying on stops that sit outside it.
