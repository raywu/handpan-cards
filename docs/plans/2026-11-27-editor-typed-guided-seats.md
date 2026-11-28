# Direct scale entry and Guided seats

## Reproduction

The screenshot shows occupied Standard note circles interleaved with dashed
Guided outlines after entering a scale line. A representative model replay
with nine rim notes, one Cyclops note and seven underside notes produced
stock rim angles 270, 230, 310, 190, 350, 150, 30, 110 and 70 degrees.
It had no Guided row. The displayed nine-seat Guided grid instead starts
at 90 degrees with 40-degree steps. The current guide filter compares
angles for equality, so an off-grid note can sit over a dashed circle
without removing it.

## Placement lane

- Assign newly typed Standard rim and Cyclops notes to legal Guided seats on
  direct entry. Cover the visual scale line and the Standard input form
  where it shares the same new-scale transaction. Use the existing Guided grid
  and seat encoder. Keep the normal seven rim and three Cyclops grid floors
  on sparse drafts and use the current expanded sizes at higher counts.
- Preserve the order expressed by the input, mirror settings and all
  underside angles. For an existing draft or saved scale, keep occupied
  Guided seats and explicit custom placements. Assign newly typed notes to
  free legal seats and only reflow a Guided ring when needed and legal.
  Opening a saved scale or link and confirming unchanged input retain exact
  positions. Existing record formats, Neotone and the parser keep their
  current behavior.
- Check the combined geometry before committing. If no Guided assignment
  fits a valid typed scale, keep its legal layout and remove misleading
  overlapping outlines using the guide rule below. Treat the typed edit as
  one Undo transaction. Invalid input leaves the current layout intact.

## Guide lane

Render vacant Guided circles only. Use occupied Guided seat IDs where
available and the actual solved note circles to suppress overlap on legacy,
custom and fallback layouts. Use the same visible guide list for the action
targets when placing a note. Keep occupied notes available for replacement
and keep draft-error markers visible. Preserve the locked preview, empty
guides, placement feedback, drawer, and underside and Neotone interactions.

## Verification

- Model and shell tests for sparse and dense text, original typed order,
  mirrored geometry, more notes than the current grid, partial/invalid and
  unchanged text, existing pins and custom seats, and a valid stock fallback.
- Native browser tests at 380 px for type or paste, commit, occupied-outline
  removal, a real empty seat remaining usable, Undo/Redo, and Save/reopen.
  Include populated Add, Edit input, the shared form path, and an existing
  custom or saved-link case. Verify Neotone and underside remain unchanged.
- Reproduce the original guide mismatch before the fix. Assert exact pitch
  and seat identity rather than screenshot hashes alone. Exercise the typed
  assignment and occupied-outline guards via targeted mutation tests.
- Independent final review, exact-head full validate, and all named hosted
  RC cases against matching served bytes before and after the run.

Use isolated file-owned model and guide lanes with a single browser lease
at integration. Review any common helper extraction before changing broader
placement or save paths.

Independent engineering and design reviews passed. Implementation starts
with fresh Standard entry and neutral outlines. Existing Guided edits retain
their current seat-preserving behavior. Any change to active keyboard targets
requires its own verification.

## Shared layout and drawing contract

The visual editor keeps a single pan renderer. The scale line and the
Standard input form use the same text commit. That commit and visual
placement use the existing Guided grid and seat representation. The
neutral overlay uses the solved note geometry and the same seat-center
calculation as the placement preview. An explicitly ordered, saved or
custom layout supplies its stored geometry to that renderer. There is no
new record format or alternate drawing path.

Independent engineering review verified implementation of this contract
in the direct-entry and form paths. The direct-entry replay is a required
hosted browser case.
