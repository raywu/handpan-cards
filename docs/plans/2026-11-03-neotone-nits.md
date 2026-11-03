# Neotone nits lane (2026-11-03)

Key: handpan-cards#neotone-nits. Owner 2026-11-03: "start the nits lane now". Small task, one lane, AFK armed.

## Goal
Close the open, non-blocking nits from the Neotone reviews (#814 rounds 1 and 2, #821) on a branch from main 8a6e04f8. Dev first: D PR merged after review; M PR held for the owner.

## Nits in scope (reviewer wording summarized; verify each is still open on main before fixing)
From #814 review at 44442412:
- N1. NEO4c ("a user scale with inner notes gets M1 ...") uses `TOP_PYGMY`, which has no `|`, so it tests M2, not M1. Fix: use the Pygmy string with `| F5 G5`, assert the M1 text; add a replaced-seed case.
- N2. Demo slots disagree with the picture. `neoTap`/`neoPlace` read `profileMap`, not `shownMap()`. (a) Tapping M7 with nothing picked does nothing while its aria-label names F5. (b) Picking C3 at M1 and tapping M7 says "Moved C3 to tonefield 7." but the plate then shows F5 jumping to M1.
- N4. Four NEO mutants survived (coverage gaps; shipped code correct): (a) `neoUnusedText` reading `profileMap` instead of `shownMap()`; (b) dropping the `editedDeck().id !== NEO_DEMO_DECK` check; (c) reverting `noteNameOf` to key matching; (d) dropping the `demo.length === loose.length` guard. Add tests that kill (a), (c), (d) and add those mutants to `tests/mutants/` so the gate proves them. (b) is near-equivalent today (no other built-in has inner notes): kill it if a test can, otherwise record it as equivalent in the plan.
From #814 review, delta 44442412..691ac7b1:
- B1. The comment above `neotoneOverlay` says "a dashed outline and number on each empty tonefield"; now true only of main slots. Reword.
- B2. `HPE.pdfcards.neoPlan(...)` is recomputed per empty mutant slot (up to 9 per paint). Compute once before the loop.
- B3. The orange M-label emitter exists in both `neoSvg` and `neotoneOverlay`; NEO7b pins only font-size and weight. Add an assertion pinning label position equality so the two cannot drift.
From #821 review at 0d00e300:
- C1. `docs/CARD-SPEC.md` says "Neotone lens labels" (SMALL_LABELS bullet, Diagram label rule); use "lens names" to match ENGINE-SPEC, since `M<n>` lens numbers keep the 3.6 pt floor.
- C2. `docs/ENGINE-SPEC.md` section 18 line with `LENS_FIT_FLOOR` runs ~96 chars; rewrap to the paragraph width.
- C3. K8 test title in `tests/pdfcards.test.js` says "owner 2026-11-02"; docs and the sibling test say 2026-11-01. Make them agree with the date in the Neotone plan decision log.
- C4. ENGINE-SPEC SMALL_LABELS sentence: add a half-sentence that `layout.labelFloor` uses pre-fit sizes, so a lens name shrunk under 3.6 pt does not fire the warning (intended under the exemption).

## Decisions (AFK, routine and reversible; owner may revisit)
- D1 (N2): demo notes keep fixed slots (F5 at M7, G5 at M8). A demo note is drawn only while its slot is free in `profileMap`; it is never relocated to another slot. A demo slot's accessible name says it shows a demo note and is free for placement. Placement onto it behaves as onto an empty slot. Demo never writes `profileMap`; SAVE hold and M1 message unchanged.
- D2 (N3, demo on an edited built-in Pygmy): no change; the owner's wording allows it.
- D3 (N4b): see N4.

## Non-goals
No deck data change. No engine module change unless B2 requires it (it should not). No CLAUDE.md edit (gated; the 3.6 pt CLAUDE.md wording stays as the owner chose). No #817 lane T test nits (G5 count, PAU-I split), no SVH11 flake, no move code. No new features.

## Ownership
`index.html` app JS/CSS outside generated regions; `tests/app.test.js`; `tests/pdfcards.test.js` (K8 title only); `tests/e2e.test.js` only if an N2 check needs a browser; `tests/mutants/` (new NEO mutants and any re-anchoring); README mutant count and FLOORS (from the CI run artifacts); `docs/CARD-SPEC.md`; `docs/ENGINE-SPEC.md`; `data/i18n/*.json` plus `python3 tools/sync_i18n.py` if an aria string changes (i18n step: keys in every table, sync, audit, fit check); this plan at `docs/plans/2026-11-03-neotone-nits.md`.

## Acceptance
- Each nit above fixed, or recorded in this file with evidence why not.
- TDD: N1, N2, N4, B3 tests written first and seen failing (N4: mutant survives before, killed after).
- Local smoke: `node --test tests/app.test.js tests/pdfcards.test.js`, `python3 tools/validate.py`, `python3 tools/inline_engine.py --check`, `python3 tools/sync_i18n.py --check`, `python3 tools/refresh_mutants.py --check`.
- M PR (base main) and D PR (base dev) from the same head; `validate` success at the verified M head SHA; fresh reviewer PASS or PASS_WITH_NITS at that SHA; D merged; M held.

## Plan review (independent, 2026-11-03): READY. Binding amendments F1-F9
These override the sections above where they differ.
- F1. N4(b): add a test that opens built-in Kurd, types its notes plus `| F5 G5`, and asserts no demo placement (place count excludes 77/79) and the M1 text; add the mutant; do not record it as equivalent.
- F2. Order: implement D1 first, then write the N4 tests and mutants against the D1 code. The demo slot's accessible name includes the note via `noteNameOf(shownMap()[slot])`, so the N4(c) test asserts that name. Keep the `demo.length === loose.length` guard; replace `demo.length <= free` with a per-note "slot is null in profileMap" check.
- F3. i18n is mandatory: D1 adds key `sheet.neotone_demo` (with a `{note}` placeholder) to all 8 `data/i18n/*.json` tables with real translations, then run `python3 tools/sync_i18n.py`, the audit and the fit check.
- F4. Fix the slots by a constant keyed by MIDI (77 -> NEO_MAIN+6, 79 -> NEO_MAIN+7); each demo note is drawn independently, so one can show while the other's slot is taken; update the `shownMap` comment ("first empty mutant tonefields").
- F5. Report D1's consequence (a demo note disappears when its slot is taken) among the AFK auto-decisions for the owner.
- F6. C3: change the K8 title to "owner 2026-11-01" (evidence: commit 8f70f4a9 and the CARD-SPEC `LENS_FIT_FLOOR` line).
- F7. C4: append the half-sentence to the CARD-SPEC `SMALL_LABELS (labelFloor)` bullet, citing `labelFloor` in `src/engine/layout.js` and the PA lens-shrink test; do not reword the DECIDED paragraph in ENGINE-SPEC.
- F8. B3: in NEO7b, assert the empty M9 label's radial distance from the pan centre (with the fs*0.34 baseline offset removed) equals the filled M1 label's, and its angle equals `HPE.layout.PROFILE.angles[8]`; compare emitted outputs, never a recomputed formula (tests/CONTRACT.md rule 2).
- F9. Ownership also names `tests/suite_health.py` (app.test.js and pdfcards rows only, set from the CI run), `README.md` (mutant count, currently 1753, set from the CI run), and `tests/mutants/nt_empty_mutant_dashed.patch` (re-anchor after B2/D1). Each new mutant has `# kills:` and `# suite:` headers with `.` for spaces, no `index` lines, and is proven locally (apply, suite fails, revert) before push.
