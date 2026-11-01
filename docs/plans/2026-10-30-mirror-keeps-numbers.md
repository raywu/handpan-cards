# MIRROR keeps pitch-number positions

Status: DRAFT (planning only; no code). Owner requirement 2026-10-30. Linear: file under the TRI tracker by the integrator.

## Owner requirement

"Even in mirrored layout, the pitch numbers do not change location." On D Kurd 10 with MIRROR on, the app moves the numbers too: "please fix ... not allow pitch numbers to mirror."

## What the code does today (verified)

- `src/engine/layout.js` `mirrored` reflects each zone's angle list (`180 - a`). `placeZones` applies it per ring. `merge` writes the angles into slot 4. Slot 5, the index label, is copied from `source`, so note k keeps label k and its number moves with it to the mirrored angle.
- Rule N (`merge`, the seats branch): the note in seat s takes `source[ids[s]][5]`. `cyclicLabels` does the same under `options.angles`, against `home`, which is the MIRRORED home (`readCorrections`).
- Every renderer reads slot 5. The app diagram and number line read it (`index.html` number-line span, `meta[f][5]` in the inlined pdfcards), and so does print (`src/engine/pdfcards.js`). `tools/hifi.py` / `tools/decks.py` render only the five built-ins, unmirrored, so they are untouched.
- The test `tests/layout.test.js` "rule N: mirrors and orientation change no label" pins the current behaviour. The mutant `tests/mutants/dr3_mirror_renumbers.patch` kills against it.
- Bottom precedent: under `options.angles`, MIRROR BOTTOM already "re-flows the numbers into the mirrored order and moves no note" (`tests/layout.test.js` SO tests, `tests/app.test.js` "SO: MIRROR BOTTOM after the fold re-flows the seat numbers...").
- The unmirrored solver sets are symmetric about the vertical axis for every count and both anchors. `rimAngles`, `innerAngles` and `bottomAngles` all have exact mirror partners, with pairs (1,2)(3,4)... for anchor one and (0,1)(2,3)... for anchor between, inner and bottom; an odd middle maps to itself. So "the unmirrored position at this angle" always exists.

## Meaning (decision D1)

Reading (a), RECOMMENDED: numbers belong to positions. Position X always shows the number it shows unmirrored. MIRROR changes which note sits there, and the note takes that position's number everywhere: on the diagram, the number line and the drawer. This is rule N extended to the mirror ("a seat's number belongs to the position, not to the note").

Reading (b), REJECTED: the diagram numbers stay put while the number line keeps each note's pitch rank. The number line would then disagree with the diagram, which breaks App/print agreement and the purpose of the number line (finding the field).

Reading (c), REJECTED: mirror becomes a no-op. That contradicts the owner's "notes move".

D Kurd 10 mock (angle: note "number"):

```
unmirrored      270:A3"1" 230:Bb3"2" 310:C4"3" 190:D4"4" 350:E4"5" 150:F4"6" 30:G4"7" 110:A4"8" 70:C5"9"
MIRROR today    270:A3"1" 310:Bb3"2" 230:C4"3" 350:D4"4" 190:E4"5"  30:F4"6" 150:G4"7" 70:A4"8" 110:C5"9"
MIRROR, (a)     270:A3"1" 310:Bb3"3" 230:C4"2" 350:D4"5" 190:E4"4"  30:F4"7" 150:G4"6" 70:A4"9" 110:C5"8"

             top                         top (a)
        8(A4)   9(C5)               8(C5)   9(A4)
   6(F4)            7(G4)      6(G4)            7(F4)
 4(D4)    ding       5(E4)   4(E4)    ding       5(D4)
   2(Bb3)           3(C4)      2(C4)            3(Bb3)
          1(A3)                       1(A3)
```

Card number line, Dm (D4 F4 A4): unmirrored `4-6-8`, today mirrored `4-6-8`, (a) mirrored `5-7-9`.

Consequence: on a top-mirrored deck the numbers no longer run in pitch order. Note 1 stays the lowest, but 2 and 3, 4 and 5, and so on trade places.

## Goal

With `mirror` and/or `mirrorBottom` on, every index label stays at the angle it has unmirrored. Labels are derived per position in the engine, so app, print and drawer agree with no renderer change.

## Non-goals

- No change to angles, geometry, `f_*`, deck data, built-ins, the wire format, record version, deck ids or share strings.
- No change to built-ins (they are unmirrored and bypass the solver). No Neotone paired-profile behaviour.
- No new UI controls.

## Decisions

- D1 (owner Q1): reading (a). Recommended.
- D2 (owner Q2), mirrorBottom: the same rule applies to the U-labels, so a U-number stays at its unmirrored angle. Recommended, for one rule on every ring. Under `options.angles`, `cyclicLabels` matches against the UNMIRRORED home. Explicit (non-null) entries: MIRROR BOTTOM moves none of those notes, and every number stays at its angle. Null entries take the solved angle after mirrorBottom (`readCorrections` `effective`), so MIRROR BOTTOM still moves THOSE notes to their mirrored solved angles. Each moved note then takes the number of the unmirrored position it lands on, through the cyclic match. With every entry explicit (the fold), the toggle changes nothing. Recommended handling: keep the toggle, and replace the notice "...their seat numbers now run the other way round" with a new i18n key, all eight tables. English: "Bottom mirror on. The notes you placed stay put; the others swap sides. Numbers stay where they are." Alternative: MIRROR BOTTOM reflects the explicit angles. That rewrites stored `angles` semantics, so it is not recommended.
- D3 (owner decided 2026-10-30: DROP), title-card legend: `src/engine/pdfdeck.js` writes "TONEFIELD NUMBERS RUN 1 - n FROM THE LOWEST ..." for generated decks, which is false once the top is mirrored. When the resolved top mirror is on, the line is omitted. It is kept when unmirrored or when only the bottom is mirrored.
- D4: implement by index pairing, not by angle matching (no float tolerance). `mirrorPartner(ring, count, anchor)` returns the permutation M. The label of the note in seat s becomes `source[ids[M(s)]][5]`, where M is the identity when that ring is unmirrored. Seats compose: the seat permutation is applied first, then M on the seat index.

## Interactions

- Seats (rule N): a swap still trades only the two labels, and the label is a function of position alone. Test: swap + mirror gives the same label at each angle as swap without mirror, because the seats name positions.
- Angle overrides: see D2. The bottom-ring labels come from the cyclic match against the unmirrored home. The SO tests that pin mirrored-home labels (e.g. "SO: under MIRROR BOTTOM the swap labels against the mirrored home: Db3 at 120 reads U5 and Db4 at 300 reads U2", "SO: MIRROR BOTTOM over six explicit angles re-flows the numbers...", the mirrored half of the cost-tie test) are rewritten to the new expected labels.
- anchor between: the pairs are (0,1)(2,3)..., and for an odd count the top-centre note maps to itself. Covered by the matrix test.
- Inner ring: mirrored by `mirror` (top), pairs (0,1)..., so for a mirrored generated Pygmy-shaped pan F5 moves to 52 and reads "11", and G5 moves to 128 and reads "10".
- Neotone profile path (`claude/pa-u`, `claude/neotone-e`): `solve` returns early through `placeProfile` when `options.profile` is set. Labels there are not mirror-derived. The profile path is a non-goal; flag it to the Neotone integrator.

## Back-compat (Release safety)

- No wire change. `HPE.share.VERSION` and `RECORD_VERSION` stay the same. Mirror is still the same option bit, and old v1 to v6 links decode unchanged and render under the new labels. The rendered labels changing is the requested fix, not a decode change.
- Saved records keep the same options and the same id. GATED assumption A1: records re-solve their fields on load rather than replaying stored slot-5 labels. The lane's first step verifies this (`tests/app.test.js` saved-variants fixtures `tests/fixtures/saved_variants_v1.json`, 14 mirror rows). If stored labels are replayed, the lane adds a load-time re-solve for mirrored records. That is a records change, so it stops for the owner.
- Engine corpus `tests/fixtures/engine_corpus_v1.json` has 0 mirrored entries, so it needs no regen. A1 covers `saved_variants_v1.json` and `free_placement_case_v1.json` (2 mirror rows); regen them in the same commit if their labels change.
- Built-ins are byte-identical: `python3 tools/validate.py` plus `tests/test_render_agreement.py` `test_highlighting_agrees` stay unchanged.

## Lane MN (single serial lane; does not split cleanly, because all changes meet in layout.js)

Branch `claude/mirror-numbers` from main, in its own worktree. PR M to main (HELD) and PR D to dev.

Ownership: `src/engine/layout.js`, `src/engine/pdfdeck.js` (D3), the engine regions of `index.html` via `tools/inline_engine.py`, the notice key in `data/i18n/*.json` plus sync (D2), and `tests/layout.test.js`, `tests/app.test.js` (the mirror/SO rows only), `tests/pdfdeck`-area tests, `tests/mutants/` (mirror and SO rows), `docs/ENGINE-SPEC.md` sections 4 and 13, `docs/CARD-SPEC.md` (if TRI-37 lane A has landed) or `CLAUDE.md` (the owner-gated patch below).

Prereqs: owner answers to Q1 and Q2, or the AFK recommended picks. TRI-37 lands on dev (#757, #759); the lane bases on it (see conflicts).

TDD order:
1. Tests first, all failing on main:
   - `tests/layout.test.js`: rewrite "rule N: mirrors and orientation change no label" as "rule N: a mirror keeps every number at its unmirrored angle". For each RULE_N scale, anchor, mirror pair and seats, label-at-angle equals the unmirrored label-at-angle.
   - A Kurd exact row: "MN: D Kurd 10 mirrored reads 270 A3 1, 310 Bb3 3, 230 C4 2, ... 110 C5 8".
   - A Pygmy inner/bottom exact row.
   - Unmirrored byte-identity over every corpus seed.
   - `tests/app.test.js`: Kurd mirrored Dm number line `5-7-9`, plus app/print agreement for one mirrored deck (diagram slot 5 equals the pdfcards number line).
   - The rewritten SO rows (D2).
   - MN-1, mixed null/explicit: "MN: under angles, MIRROR BOTTOM moves only the null-entry notes, explicit notes stay, every number stays at its unmirrored angle". Pygmy with explicit U1 and U3 and the rest null, checked with MIRROR BOTTOM off and on.
   - D3 legend: "MN: the title card omits the TONEFIELD NUMBERS line when the top is mirrored", plus "... keeps it unmirrored and with only the bottom mirrored".
2. Implement `mirrorPartner` and the label step in `merge`. The `cyclicLabels` home becomes unmirrored.
3. `python3 tools/inline_engine.py`, the i18n sync, and the doc edits.
4. Mutants: retarget `dr3_mirror_renumbers.patch` (reverse-instead-of-pair still differs from (a), so it stays killable) and retire or invert `so_home_unmirrored.patch`, which is now the correct behaviour. Its replacement is "home uses the mirrored bottom". Add the mutant `mn_legend_kept_when_mirrored.patch` (it keeps the line under a top mirror; killed by the D3 test). Refresh FLOORS from CI artifacts.

Acceptance: all new tests green, built-ins byte-identical, `validate` green at the verified head SHA, independent reviewer PASS.

Verify (the commands `.github/workflows/validate.yml` runs): `python tools/validate.py && node tools/boot_sim.js && python3 tools/refresh_mutants.py --check && python -W error::ResourceWarning tests/suite_health.py --emit-python artifacts/python-results.json && python3 tests/suite_health.py --emit-js artifacts/js-results.json && python3 tests/suite_health.py --verify artifacts/python-results.json artifacts/js-results.json`. The mutation gate runs as `MUTANT_SHARD=<k>/4 MUTANT_REPORT=artifacts/mutant-shard-<k>.txt ./tests/mutation_check.sh` for k=1..4; leave it to CI, because it restores the tree. Evidence: `gh run list --commit <sha> --workflow validate.yml`.

## Proposed CLAUDE.md / CARD-SPEC.md patch (owner-gated)

Replace the bullet
"- MIRROR reflects rim and inner rings and is the only thing that puts odd notes on the left; `mirrorBottom` reflects the bottom ring and defaults to `mirror`."
with:

```
- MIRROR reflects the NOTES of the rim and inner rings; `mirrorBottom` does the
  same for the bottom ring and defaults to `mirror`. Index numbers never move:
  each position keeps its unmirrored number and the note mirrored into it takes
  that number on the diagram, the number line and the drawer (owner 2026-10-30;
  rule N extended). Under `options.angles` MIRROR BOTTOM moves only the notes
  whose entry is null (to their mirrored solved angle); explicitly placed notes
  stay, and every number stays at its angle.
```

The matching ENGINE-SPEC section 4 sentence "`mirror` reflects ... and is the only thing that puts odd notes on the left" gets the same meaning.

## Verification

- Automated: the tests above, CI `validate` at the head SHA, and the mutation gate.
- Independent: a fresh reviewer subagent at the verified SHA.
- Human: an owner DEV check at handpan-cards-dev.pages.dev. On D Kurd 10 with MIRROR TOP on, numbers 1 to 9 sit where they are unmirrored, Bb3 reads 3, and the Dm card reads `5-7-9`. Check Pygmy with MIRROR BOTTOM too.

## Conflicts with in-flight lanes

- TRI-37 (#756 to #759): moves the MIRROR bullet from CLAUDE.md to `docs/CARD-SPEC.md` and touches `tests/layout.test.js` (6 lines). Dispatch MN after TRI-37 lands on dev, and apply the patch to CARD-SPEC.md.
- Neotone (#744, #749 to #755): adds the profile branch to `layout.js` `solve` and around 150 lines to `tests/layout.test.js`. There is no semantic overlap, but textual conflicts are likely. Serialize: whichever lands second rebases, and engine-region conflicts are resolved by re-running `tools/inline_engine.py`.

## Risks and edge cases

- Users who learned the old mirrored numbers see different numbers. This is intended, and the DEV check covers it.
- An odd middle note maps to itself. Counts 1 and 2, and an empty inner ring, are in the matrix.
- Seats combined with mirror composition order: pinned by the swap+mirror test.
- Recovery: revert on dev via `claude/dev-revert-mirror-numbers`. No data migration, so reverting is lossless.

## Owner questions

- Q1: Is reading (a) right, including the number line (Kurd mirrored Dm reads 5-7-9)? Rec: yes.
- Q2: Do U-labels follow the same rule? Under angles, MIRROR BOTTOM would then move only the null-entry notes. Rec: yes, with the new notice.
- Q3: ANSWERED (owner): drop the TONEFIELD NUMBERS line when the top is mirrored.

## Continuation point / stop

Eng review READY (findings MN-1 to MN-4 folded in). Next: the owner answers Q1 and Q2 (AFK: take the recs and record them), then dispatch lane MN once TRI-37 lands on dev. This plan stops here: no code, no git writes.

## Owner answers (2026-10-30)
- Q1: reading (a) confirmed; numbers belong to positions; Kurd mirrored Dm reads 5-7-9.
- Q2: bottom U-numbers follow the same rule; MIRROR BOTTOM notice gets new wording (new i18n key, all eight tables).
- Q3: DROP the "TONEFIELD NUMBERS RUN 1 - n FROM THE LOWEST" line on mirrored scales (top mirrored); unmirrored scales unchanged. Supersedes the plan's recommended replacement line.

## Eng review log (2026-10-30, independent, report-only)

Verdict: READY (no blocker/high). Verified: merge copies slot 5 from `source` (layout.js `merge`); `cyclicLabels` labels against `seats.home` = mirrored `placeZones` home (`readCorrections`); A1 HOLDS - records store `{v, s: formatSeed, o}` (`scaleRecord`), load reparses via `scaleReader` and re-solves, so no stored slot-5 replay; built-ins bypass the solver.
- MN-1 (medium): partial `angles.bottom` with nulls - nulls take the MIRRORED solved angle (`readCorrections` `effective`), so MIRROR BOTTOM is not fully inert there; the patch text "moves no note and no number" is false for null entries. Fix: add a test with a mixed null/explicit list and state the null behaviour in the notice + CLAUDE.md patch (or restrict the sentence to fully folded rings).
- MN-2 (medium): D3/Q3 body and TDD step "the D3 legend row" still describe the replacement line; owner chose DROP. Fix: rewrite D3 to "omit the TONEFIELD NUMBERS line when top mirrored", test asserts absence (mirrored) and presence (unmirrored, mirrorBottom-only), add a mutant that keeps the line.
- MN-3 (low): Continuation point still says owner answers pending; update to "dispatch MN after TRI-37 lands".
- MN-4 (low): verify command - confirm `node --test` is the repo runner (no package.json at root); otherwise cite the CI command.

## Owner decision 2026-10-31 (supersedes the CLAUDE.md patch above)
- Lane MN does NOT edit CLAUDE.md. The full MIRROR rule text above goes into `docs/CARD-SPEC.md` (generated-layout rules), and the engine meaning into `docs/ENGINE-SPEC.md`.
- CLAUDE.md gets only the guardrail "MIRROR moves notes, never index numbers (owner 2026-10-30); see `docs/CARD-SPEC.md`.", plus the hard rule "Design rules live in design docs". Both are added by TRI-37 lane A.
