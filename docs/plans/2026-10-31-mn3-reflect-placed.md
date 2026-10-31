# MN3: reflect explicit angles (owner 2026-10-31)

Lane `claude/mn3`, stacked on `claude/mn2` (0880d8d7; main PR #774 held).
Refs: `docs/plans/2026-10-30-mirror-keeps-numbers.md`, `docs/plans/2026-10-31-mn2-hand-placed-numbers.md`.

## Owner decision, verbatim

"even with custom positioned notes, mirroring should mirrow the note on the opposite side of the axis with the mirrored degree". Chosen: "Numbers stay with places". After the reflection, numbers are re-ranked around the ring as for any placement (the cyclic rule N match against the UNMIRRORED home, unchanged).

This SUPERSEDES MN2 rule S ("hold the orphans"): hand-placed notes no longer stay put.

## Rule

MIRROR BOTTOM reflects every bottom note across the pan's vertical axis, hand-placed ones included: an explicit entry `a` of `options.angles.bottom` becomes `norm(180 - a)`; a null entry stays null (the solver already reflects it). Multiples of 5 reflect to multiples of 5. The toggle is its own inverse. Numbers belong to positions (`cyclicLabels` against the unmirrored home, untouched).

MIRROR TOP: `options.angles` has only a `bottom` key; rim and inner rings have no explicit angles, so MIRROR TOP already reflects every note and needs no change.

Where: `solve` is NOT changed. `options.angles` still means "the drawn angle, in the frame it was drawn in", so a stored record or share link renders exactly as before. The reflection is done by the toggle: new pure helper `HPE.layout.reflectAngles(list)`, used by `mirrorBot.onclick`. `holdForMirror`, `holdBeforeMirror` and `releaseRedundantPins` are removed (the reflection is its own inverse, so nothing needs normalising).

## Worked examples (Pygmy, anchor between; home U1 C3@300, U2 Db3@240, U3 Eb3@0, U4 Bb3@180, U5 Db4@60, U6 Ab5@120)

1. C3 slid 300 -> 285: `[285,null,...]`, shows C3@285=U1 (Db3@240=U2). MIRROR BOTTOM on: list `[255,null,...]`; C3@255, Db3 at its mirrored home 300. Db3@300=U1, C3@255=U2.
2. Toggle off again: `[285,null,...]` exactly, identical drawing.
3. Kurd 10 mirrored (top, no bottom, no angles): unchanged by this lane. Bb3@310=3, Dm = D4@350=5, F4@30=7, A4@70=9.
4. 5-note bottom ring, one note at 0: reflects to 180, accepted (MN2 refused it: review finding N1).

## Release safety

`solve` and the stored/wire option meaning are unchanged: `angles` entries are drawn angles. A saved scale with `mirrorBottom: true` plus explicit angles solves to the identical angles and numbers; no record or wire version bump and no conversion on read are needed. Evidence: fixtures in the old formats (record v4 / v3 saved records and share links v4, v5, v6) with mirrorBottom + angles, whose expected angles and numbers were recorded on the MN2 head `0880d8d7` before the change and are asserted after.

## Refusal copy

A toggle is refused only when the reflected layout truly overlaps a note or a top-shell circle (`bottomClash`). The odd-ring refusal of MN2 disappears. The notice `sheet.mirror_keeps_numbers` ("The notes you placed stay put...") is wrong now and is replaced in all eight tables; `sheet.toggle_refused` ("too close") stays for real overlaps only.

## Tests (first, see them fail)

`tests/layout.test.js`
- changed (MN2 rewritten): replaces "MN2: holdForMirror ..." tests with `MN3: reflectAngles` (null entries stay, explicit reflect, involution, multiple of 5), worked examples 1 and 2 through `solve`, and the swap example.
- new sweep: bottom rings of n=2..8, both anchors, a single slide in steps of 5, both frames: the reflected toggle is accepted unless a true `bottomClash` exists in the reflected layout (checked independently), and toggling twice gives the identical solve output.
- new fixtures test: old-format records and share links with mirrorBottom + angles decode to the recorded angles and numbers.

`tests/app.test.js`
- changed: "MN2: MIRROR BOTTOM after sliding C3 holds ..." becomes "MN3: MIRROR BOTTOM reflects the slid note and its partner"; "MN2: ... refused ... 5-note bottom" becomes "MN3: a 5-note bottom ring toggles"; the double-toggle, no-angles and reset tests are kept (renamed MN3 where the body changed); notice text assertion.
- i18n: all eight tables carry the new `sheet.mirror_keeps_numbers` wording.

Mutants: replace the four `mn2_*` mutants with ones that kill the new tests (reflect skipped, null entries reflected, explicit not normalised mod 360); repoint `fpn_toggle_refusal_not_warn` and `w1_bottom_switch_inert` at the new `mirrorBot.onclick`.

Docs: `docs/CARD-SPEC.md` MIRROR bullet and `docs/ENGINE-SPEC.md` section 13. Not CLAUDE.md, not deck data.
