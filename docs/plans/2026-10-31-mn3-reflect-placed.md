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

`solve` and the stored/wire option meaning are unchanged: `angles` entries are drawn angles in their own frame. A saved scale with `mirrorBottom: true` plus explicit angles solves to the identical drawn angles; no record or wire version bump and no conversion on read are needed. Only the toggle changes.

Evidence (`tests/fixtures/mirror_placed_v1.json`, test "MN3 release safety ..."): records (v4) and v6 links with mirrorBottom + angles. Per case the fixture stores `mainExpected` / `mainLinkExpected`, recorded at origin/main a9aaeb70 (review F1), and `expected` / `linkExpected`, recorded on the MN2 head 0880d8d7 before this change. The test asserts the DRAWN ANGLES equal main's for every case and the numbers equal the MN2 head's.

Intended number differences vs main (NOT asserted identical): in every mirrored case with a bottom shell (`pygmy-slid-mirrored`, `pygmy-swap-mirrored`, `pygmy-ruleS-record-mirrored`, `three-bottom-mirrored`, `pygmy-both-mirrored-anchor-one`) main numbers a mirrored bottom by the note's own seat, while the shipped-to-dev MN change (owner 2026-10-30, "mirror keeps number positions") numbers by position. Example: Pygmy `[285,...]` mirrored, main reads `C3@255=U1 Db3@300=U2`, now `C3@255=U2 Db3@300=U1`. `pygmy-slid-unmirrored` is identical to main. This is the MN/MN2 change already on dev and held in #774, not an MN3 effect.

Dev-only records (review F2): an MN2 rule-S record such as `[285,240]` with mirrorBottom on (made by the MN2 toggle, never on main) is stored as drawn angles, so it draws unchanged; its first toggle off/on now reflects it to `[255,300]`. Fixture `pygmy-ruleS-record-mirrored` and the test "MN3: a dev-only MN2 rule-S record [285,240] ... reflects to [255,300]" cover it.

## Refusal copy

A toggle is refused only when the reflected layout truly overlaps a note or a top-shell circle (`bottomClash`). The odd-ring refusal of MN2 disappears. The notice `sheet.mirror_keeps_numbers` ("The notes you placed stay put...") is wrong now and is replaced in all eight tables; `sheet.toggle_refused` ("too close") stays for real overlaps only.

## Tests (first, see them fail)

`tests/layout.test.js`
- changed (MN2 rewritten): replaces "MN2: holdForMirror ..." tests with `MN3: reflectAngles` (null entries stay, explicit reflect, involution, multiple of 5), worked examples 1 and 2 through `solve`, and the swap example.
- new sweep: bottom rings of n=2..8, both anchors, a single slide in steps of 5, both frames: the reflected toggle is accepted unless a true `bottomClash` exists in the reflected layout (checked by an independent oracle `mn3Overlap` that covers bottom gaps AND the rim, inner and ding circles with the top unmirrored, review F3), and toggling twice gives the identical solve output.
- new fixtures test: old-format records and share links with mirrorBottom + angles decode to the recorded angles and numbers.

`tests/app.test.js`
- changed: "MN2: MIRROR BOTTOM after sliding C3 holds ..." becomes "MN3: MIRROR BOTTOM reflects the slid note and its partner"; "MN2: ... refused ... 5-note bottom" becomes "MN3: a 5-note bottom ring toggles"; the double-toggle, no-angles and reset tests are kept (renamed MN3 where the body changed); notice text assertion.
- i18n: all eight tables carry the new `sheet.mirror_keeps_numbers` wording.

Mutants: replace the four `mn2_*` mutants with ones that kill the new tests (reflect skipped, null entries reflected, explicit not normalised mod 360); repoint `fpn_toggle_refusal_not_warn` and `w1_bottom_switch_inert` at the new `mirrorBot.onclick`.

Docs: `docs/CARD-SPEC.md` MIRROR bullet and `docs/ENGINE-SPEC.md` section 13. Not CLAUDE.md, not deck data.

## Caller enumeration (review F4)

Enumerated with `grep -rn 'holdForMirror\|holdBeforeMirror\|releaseRedundantPins'` over the whole tree, not only the mn2_* mutants: callers were `src/engine/layout.js` (definition and export), `index.html` (inlined region, `mirrorBot.onclick`, `holdBeforeMirror`, `releaseRedundantPins`), `fpn_toggle_refusal_not_warn.patch` and `w1_bottom_switch_inert.patch` (context lines, refreshed), the four `mn2_*` mutants (removed), and the two spec docs. After the lane the grep returns only the "superseded" sentence in `docs/ENGINE-SPEC.md` and this plan. ENGINE-SPEC section 13 says rule S is superseded.

New mutants: `mn3_reflect_not_mod`, `mn3_reflect_null_entries`, `mn3_reflect_identity`, `mn3_toggle_skips_reflect`, `mn3_refusal_keeps_reflection`. Patches that embed the generated I18N line (`b_*`, `i18n_*`) were re-anchored to the new line.
