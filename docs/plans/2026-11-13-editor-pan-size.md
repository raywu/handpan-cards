# Editor pan size (TRI-59): lane notes

The pan lane's plan doc was not on `claude/editor-rc-int`; this file holds only the decisions the nits lane was asked to record.

## AFK decisions

- **Hint is an info button.** The counts and hint block sits behind a 44px info button (`#editor-hint-toggle`, `aria-expanded`, `aria-controls="editor-areas"`) in the tab strip, and opens as an overlay placed by `editorPlaceAreas`, so the pan never moves. Rationale: the always-visible block cost about 60px of pan height at 375x667, and an overlay keeps the 200-212px pan. The strip reserves 44px (`padding-right` on `#editor-tabs`) so the Layout tab never runs under the button; the test "P0 tabs" and mutant `editor_tabs_no_hint_reserve` guard it.
- **Status row 56 to 48px at 420px wide and below.** The row sheds 8px at phone widths to fund pan height at 360x640 (176px, owner-accepted) while staying above the 44px target floor. Rationale: no deck, geometry or copy change, only padding.

## Tab test move

The Tab-order test moved from 375x360 to 375x548 and 375x440. At 375x360 a clean tree already has real tab stops outside the `#editor-region` scrollport; the owner accepted region-landing (focus scrolls the stop into the region) on 2026-11-14. 375x548 and 375x440 still overflow the region, so they exercise the same landing without relying on stops that sit outside it.
