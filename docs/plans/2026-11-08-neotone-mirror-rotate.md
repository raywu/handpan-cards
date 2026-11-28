# Neotone: Mirror and Rotate in the editor

Status: READY (round 3 independent review, 2026-11-08), not started. Open owner item: D1a (#1 buttons hidden). Refs TRI-59. Not started.
Trigger: met for ordering (#993 merged to dev, 06a0159); the lane stacks on the held main PR #992.
Mode: AFK armed; main PRs stay held.

## Goal
On a Neotone scale in the one-panel editor, the layout row offers working Mirror and Rotate.
Owner 2026-11-08: "mirror and #1 should be enabled"; "At the very least, rotating is a personal
choice and should be supported." Scope: the one-panel editor only; the legacy sheet is out of scope.

## Why no engine change (verified by review round 1)
- `readProfile` refuses the options `mirror`, `mirrorBottom`, `anchor`, `seats`, `angles` next to a
  profile (ENGINE-SPEC 18.2 stays accurate). Placement on Neotone is the hand-built `profile.map`.
- Mirror and rotate are permutations of that map; the engine, wire v7 (`pair-`), record v5 and
  `savedMeaning` already carry any ring-strict map. The transform lives in the editor.
- Ring order by fixture angles `[270,230,310,190,350,150,30,110,70]`: p1 p3 p5 p7 p9 p8 p6 p4 p2
  (increasing angle = clockwise on screen, 40-degree steps).
  - ROTATE one step clockwise: each note moves to the next larger angle, i.e. the 9-cycle
    p1->p3->p5->p7->p9->p8->p6->p4->p2->p1. Anticlockwise is the inverse.
  - MIRROR: angle a -> 540-a. Pairs p2/p3, p4/p5, p6/p7, p8/p9; p1 fixed.
  - Mutant ring: the same permutation on s1..s9 (a lens sk is drawn at angle k of its main field),
    so each lens stays inside its main field.
  - Number labels per tonefield never move (owner 2026-10-30).
- No mutant note: main index k sits at the k-th pitch-ranked Standard seat. Rotation is the same
  9-cycle filtered to p1..pk (checked k=4,5,6,8,9). Mirror pairs as above, but for EVEN k the last
  note sits on the axis (k=8: p8 at 90, p4 at 180 pairs with p5 at 0) and stays fixed; a p8<->p9 swap
  would move it past the rim count.

## Decisions (recommendations, AFK-recorded; owner may override)
- D1 Controls on a Neotone scale: Mirror becomes a momentary action button (no `aria-pressed`);
  rotation is two new momentary buttons, rotate anticlockwise / clockwise (one 40-degree step each,
  wraps); Mirror Bottom and the two "#1" buttons are hidden on a profile (anchor "between" is a
  half-step a profile cannot express; Mirror Bottom has no meaning when one Mirror moves both rings).
  The existing PROFILE_CONFLICT note goes away on the editor for Neotone. Standard scales unchanged.
- D1a OWNER-FACING TENSION: the owner said "mirror and #1 should be enabled". D1 hides the two #1
  buttons on a profile: "#1 CENTRED" would be a no-op (the map fixes which note is at tonefield 1) and
  "#1 / #2" is a half-step a profile cannot express. Rotation is the intended substitute: it lets the
  user put any note at tonefield 1. This is an owner decision, listed at the next check-in; AFK proceeds
  with D1 only because it is UI-only and reversible (saved maps untouched). Mirror Bottom has no
  separate meaning (one Mirror moves both rings) and is shown to the owner for information.
- D2 Rotation and mirror move main and mutant rings together.
- D3 Rotation is not preserved when the mutant count changes (`compactMain` re-packs) or when a text
  edit changes notes (`editorProfileFor` re-proposes). Same as hand arrangements today; accepted,
  covered by a test that documents it.
- D4 New strings: labels, aria names, status lines (with clockwise / anticlockwise wording) as new
  keys in all 8 `data/i18n/*.json`, sync, audit, fit check (CLAUDE.md i18n step).

## Non-goals
- No change to `src/engine/*`, `data/decks.json`, the fixture, share grammar, record versions or the
  frozen shipped-reader rollback test. No change to Standard mirror/anchor. Legacy sheet untouched.

## Lane (one serial lane, file ownership)
Branch `claude/neotone-mirror-rotate`, stacked on `claude/editor-nits-4` (#992 head). Owns: editor
JS and layout-row markup in `index.html`, `data/i18n/*.json` (+ generated block), `tests/editor_model.test.js`,
`tests/editor_e2e.test.js`, `tests/editor_shell.test.js`, `tests/suite_health.py` (raise only this lane's
FLOORS rows, from main's CI artifacts, not a local run), `tests/mutants/*`, `README.md` mutant count,
`docs/CARD-SPEC.md`.
- Implement Mirror/Rotate as NEW functions (`editorNeoMirror`, `editorNeoRotate`, writing only
  `profile.map` via `editorNeoBuild`, never `options.mirror/anchor/seats/angles`). Leave `editorSetMirror`
  and `editorSetAnchor` inert on a profile so `tests/editor_shell.test.js` "U2e2-8" stays green.
- REPLACES: e2e "TRI59 neotone layout row says why it is disabled" and its mutant
  `tri59_neotone_reason_hidden.patch`; remove `editor-layout-note` and its `aria-describedby` wiring on
  Neotone together with the test covering them.
- MUST keep passing unchanged: the Standard-scale MIRROR BOTTOM, size and described-by e2e tests that
  query `editor-mirror-top`, `editor-mirror-bottom` and the anchor buttons by id; do not rename or
  re-order those ids.
- PR bases: M targets `main` (CI runs only there) with the stack #982/#985/#988/#992 beneath it, so its
  green `validate` covers the stack; the reviewer diffs against the #992 head 3de04c17. If #992's head
  moves, merge it into the lane and re-verify the base SHA. D goes to `dev` from the same head; dev
  already holds #992 via #993, so the merge is clean.

## Phases (TDD)
P1a Pure map transforms (commit here = mid-lane recovery point). Tests first in
`tests/editor_model.test.js` (verify: `node --test tests/editor_model.test.js`): assertions derived from the fixture `angles` via
  `solve(...).geom.place` and `fields[id][5]`, not a typed list: after one rotate each note's angle
  is the next larger fixture angle (+40 mod 360); after mirror each angle is 540-a mod 360; number
  labels per slot unchanged; 9 rotations = identity; mirror twice = identity; output ring-strict
  (r keys in p, b keys in s); no-mutant scales with k = 4,5,6,8,9 give a true permutation with NO
  `pastSeats` reset and no `compactMain` re-pack (even-k last note fixed under mirror); main+mutant
  stay paired (D19: a mutant only where its main field is filled). For k<9 with no mutant the expected
  angles come from the k-note layout's seat angles (k=8: 270 225 315 180 0 135 45 90), in the filtered
  9-cycle order, NOT from the fixture `angles`; also assert note count and each note's zone unchanged.
  Partial-main case with mutants (e.g. 7 main + 2 mutant; `compactMain` is a no-op once a mutant
  exists): rotation moves notes through the full 9-cycle including empty main fields, the mutant ring
  uses the same permutation, and the D19 invariant (a mutant only where its main field is filled)
  must hold after every step; if it cannot, rotation skips empty fields. P1a decides with a test.

P1b Controls, handlers, i18n. Tests first in
- `tests/editor_e2e.test.js` (prefix `TRI59c`): taps change the expected notes; status line says
  clockwise / anticlockwise; undo and Cancel restore the exact prior map; SAVE -> reload -> share-link
  round trip keeps the arrangement; D3 documented; Standard scales keep the old controls.
Then implement: `editorRenderLayout` shows rotate + momentary Mirror and hides
Mirror Bottom / #1 buttons on a profile, handlers via `editorDo` (history).
Verify: the `TRI59c` e2e tests with CHROME_BIN, `node --test tests/editor_shell.test.js`,
`python3 tools/validate.py`, `python3 tools/sync_i18n.py --check`, `tools/validate.py` check 6 (i18n) and
`node tools/probe/panel_fit.js --font both --workers 1` (fit); Mirror label fit at 320px.
Mirror/rotate do not touch the selection ring (`editorDo` clears `s.landed`; accepted).
Mutants for each transform, the even-k fixed seat and the control visibility.

P2 Docs and QA: permutation rules (ring order, mirror axis, even-k fixed seat) in `docs/CARD-SPEC.md`;
screenshot check on a 9+6 Neotone scale and a no-mutant scale, both themes at 375px. Pass: nothing
clipped, rotate wraps after 9 steps, Mirror twice returns the start.

P3 Ship: main PR M (held, `Refs TRI-59`) and dev PR D; scoped mutation plus the editor mutants;
validate green at the exact head; fresh independent reviewer; D merges under the AFK grant; owner DEV
iPhone check before any main merge.

## Verification
Automated: above. Independent: reviewer at the verified head. Human: owner DEV check (rotate feels
right; label wording; Mirror Bottom / #1 hidden is acceptable).

## Risks
- Silent reset or re-pack on a naive map (covered by the no-mutant tests).
- Layout row space on a phone (fit check, 375px).
- The editor flag `ONE_PANEL` must not reach main as a toggle (unchanged).

## Recovery
Revert the commit. Saved maps remain valid ring-strict maps; nothing to migrate.

## Continuation point
Dispatch the lane from `claude/editor-nits-4` (#992 head 3de04c17). The #1-hiding part of D1 (D1a) is
the owner-facing piece: ask at the next check-in; AFK default is D1 as written, reversible.

## Stop
Plan only; no implementation, merge or remote write is authorized by this document.

## Review log

### Round 1 (independent eng + design review, 2026-11-08)

Verdict: NOT READY. Core approach (app-side permutation of `profile.map`, no engine change) is
sound and verified; the plan misdescribes the controls and the no-mutant case, and P1-P3 have
wrong files and base.

Verified: ring order by `angles` is p1 p3 p5 p7 p9 p8 p6 p4 p2 (increasing angle = clockwise on
screen); mirror a -> 540-a pairs p2/p3 p4/p5 p6/p7 p8/p9 with p1 fixed (all four pairs sum to 540
mod 360); a mutant lens `sk` is drawn at `PROFILE.angles[k-1]` (`placeProfile`), so one
permutation applied to both rings keeps each pair together and keeps the editor's D19 invariant
(a mutant only where its main field is filled).

Findings:
- R1-1 high: "Mirror and #1 are disabled" is only half true. On dev (editor) `editorRenderLayout`
  disables the four buttons and shows `editor-layout-note` (reason.PROFILE_CONFLICT);
  `editorSetMirror`/`editorSetAnchor` no-op on a profile. The legacy sheet hides
  `#scale-standard`. "#1" is a two-button radio (`#1 CENTRED` / `#1 / #2`, aria-pressed), not a
  stepper. "#1 / #2" (anchor between) is a half-step, not expressible on a profile (`placeProfile`
  solves the plain layout with default anchor). Q2 must be redone: rotation needs its own control(s)
  (e.g. rotate left/right), new i18n keys in 8 tables (labels, aria, status lines); Mirror becomes
  a momentary action, so it must not keep `aria-pressed`; decide Mirror Bottom (hide on Neotone, or
  one Mirror that moves both rings); and decide what happens to #1 / #1-#2 on Neotone (hide).
- R1-2 high: no-mutant scales (Q3) are not "stay disabled or permute p1..pk"; they must work (owner:
  rotate at minimum). With no mutant note, `placeProfile` puts main index k at the k-th pitch-ranked
  Standard seat. Seat angles for k=4..9 (measured): k=8: 270 225 315 180 0 135 45 90; k=6: ... 6 at 90.
  Rotation = the 9-cycle filtered to p1..pk (checked for k=4,5,6,8,9). Mirror = pairs (2,3),(4,5)...
  but for EVEN k the last note sits on the axis (k=8: p8 at 90, p4 at 180 pairs with p5 at 0) and
  must stay fixed; the plan's p8<->p9 swap would move it to p9, past the rim count.
- R1-3 high: what actually happens on a naive permutation with no mutant: `editorNeoBuild` runs
  `compactMain` first, which silently re-packs notes into holes (a wrong, non-rotation result);
  a map that still reaches `pastSeats` is NOT refused, `readProfile` silently replaces it with the
  pitch-order proposal (so the tap appears to do nothing and also drops the user's arrangement).
  Test both: rotate/mirror on k=5,6,8 and 9 no-mutant, expect a true permutation and no reset.
- R1-4 medium: rotation is not durable across a mutant-count change. Removing the last mutant note
  makes `compactMain` pack the main half to p1..pk by index (visible jump); a text edit that changes
  notes re-proposes via `editorProfileFor`. Existing behaviour for hand arrangements; state it as
  accepted or cover it with a test and a note.
- R1-5 medium: wrong files and base. The editor exists on dev, not main (`ONE_PANEL` is true only
  via held main PRs #982/#985/#988/#992, stacked). M must stack on `claude/editor-nits-4` (#992
  head), not "the dev-merged base" (memory: lane branches stack on main lineage, a dev-based head
  carries the overlay and is red). Pure editor functions are tested in `tests/editor_model.test.js`,
  e2e in `tests/editor_e2e.test.js`, shell in `tests/editor_shell.test.js`; the plan's `tests/app.test.js`
  verify command is wrong. Existing e2e "TRI59 neotone layout row says why it is disabled" asserts the
  OLD behaviour and must be replaced in the same lane (name it in ownership), plus its mutant.
- R1-6 medium: acceptance is not observable. Derive test assertions from the fixture (`angles`), not a
  hand-typed permutation list (CONTRACT rule 1): after one rotate step each note's angle is the next
  larger fixture angle (+40 mod 360); after mirror each angle is 540-a mod 360; number labels per slot
  unchanged. Assert via `solve(...).geom.place` and `fields[id][5]`. Add: direction wording
  (clockwise/anticlockwise) in the status line; undo restores the exact prior map; Cancel restores;
  SAVE -> reload -> share-link round trip; frozen shipped-reader rollback test untouched.
- R1-7 low: P0 is a lane for what this review already measured; collapse P0 into P1 (keep the
  screenshot check as a QA step). Recovery should say "revert the commit; saved maps stay valid
  ring-strict maps, nothing to migrate". Legacy sheet: state out of scope.
- R1-8 low: CARD-SPEC/ENGINE-SPEC edits: ENGINE-SPEC 18.2 stays accurate (options still refused);
  put the permutation rules (ring order, mirror axis, even-k fixed seat) in CARD-SPEC.

Checked, no change needed: nothing else reads `options.mirror/anchor` on a profile (refused by
`readProfile`; `savedMeaning` appends only the map; wire v7 `pair-` and record v5 carry the map;
voicing reads source zone; share and saved stay backward compatible).

### Round 2 (independent eng + design review, 2026-11-08)
Verdict: NOT READY (1 high, owner-decision, 4 medium, 2 low); all folded into the body above.
- R2-1 high: unlisted breakage in editor_shell "U2e2-8" (editorSetMirror/Anchor inert on Neotone) and
  the Standard-scale MIRROR BOTTOM / id-based e2e checks; fixed (new functions, ids untouched, note
  removal).
- R2-2 owner decision: hiding #1 contradicts "#1 should be enabled"; recorded as D1a, rotation is the
  substitute, ask at check-in, AFK default reversible.
- R2-3: PR bases and stack mechanics; fixed (M to main with stack, D to dev, rule if #992 moves).
- R2-4: suite_health FLOORS rows, mutant registry, i18n commands; fixed in ownership and verify.
- R2-5: P1 split into P1a (transforms) and P1b (controls) with a commit between.
- R2-6: no-mutant angle assertions use k-note seat angles; note count/zone unchanged test added.
- R2-7: write only profile.map via editorNeoBuild; selection ring accepted; 320px label fit.
Re-verified: R1-1..R1-8 resolved; k=8 seats and even-k fixed seat hold; compactMain is a no-op on a
dense p1..pk map so a pure slot permutation neither re-packs nor resets.

### Round 3 (independent review, 2026-11-08)
Verdict: READY. R2-1..R2-7 verified resolved against claude/editor-nits-4 at 3de04c17; named files,
tests, mutant and commands exist. New: R3-1 medium (partial-main with mutants unspecified) folded into
P1a; R3-2 low (concrete i18n/fit commands) folded into P1b; R3-3 low (status header) fixed.
