# Neotone lens legibility (part of Neotone nits) - plan

Key: handpan-cards#neotone-nits (addition). Mode: plan. AFK armed.
Owner 2026-11-03: "the mutant notes size is too small and when a note's secondary border is highlighted, it is hard to read the actual note's key beneath ... open to the secondary note being closer to 1/3 of the primary note, or use a solid color instead of border, but ensure the key is legible."

## Audit (evidence)
- Geometry (fractions of R): main r 0.19; lens = overlap of main circle and mutant circle, `PROFILE.mutant.depth` 0.3333 -> lens radial thickness 0.1267, area 0.219 of a main note (src/engine/layout.js `PROFILE`, fixture tests/fixtures/paired_profile_v3.json; duplicated in src/engine/pdfcards.js `PROFILE_DRAW`).
- Highlight: `lensBand` stroked at `stroke.lens_band` 0.024 in `colour(st)`, inset by decor+outline+band/2 on both inner edges (pdfcards `neoMutantFigures`, `neoDrawPan`; app `neoSvg`). After outline + decor + band on two edges only ~0.040R of depth is free; the name glyph (`lensSize` = LABEL_RATIO_BNOTE * gl.lens * rl, fit floor `LENS_FIT_FLOOR`) overlaps the coloured band. That is the reported unreadability.
- Lens depth options: 0.40 -> thickness 0.152, area 0.285; 0.45 -> 0.171, area 0.337 (about 1/3); 0.50 -> 0.19, area 0.391.
- Contrast of name ink #242424: on full state colours fails for roots (#0B7B75 3.03, #6D40A3 2.15, #E0559A 4.39); white text fails for tones (#DD8F00 2.62, #C9971E 2.65). On a tint (state colour mixed with white at t): t=0.5 >= 6.6:1 for every palette colour, t=0.6 >= 5.3:1. Tints stay distinguishable root vs tone by hue; plate edge contrast is carried by the existing black lens outline.

## Decisions (AFK, routine and reversible on DEV; owner may revisit at DEV check)
- L1. Replace the lens band with a solid tint fill: highlighted lens fill = state colour at t=0.5 over white; name stays #242424 (>=6.6:1, WCAG AA text). Unhighlighted lens fills unchanged (#fff filled / LENS_EMPTY empty). Rejected: full-saturation fill (fails 4.5:1 for ink on 3 roots and for white on tones; would need per-colour text switching).
- L2. Enlarge the lens to `mutant.depth` 0.45 (about 1/3 of the main note's area, owner's suggestion). This is the explicit owner instruction for a diagram-geometry change. Mutant circle radius and main geometry unchanged. Rationale: owner named size as a separate complaint; L1 alone fixes contrast, not size.
- L3 (owner 2026-11-02: "i prefer the closed crescent on every option"). Main-note band stays the closed crescent (`crescentBand`, traces the lens edge); geometry follows the new depth only. No open-arc test or mutant.
- L4. Name size grows with the lens via the existing `lensSize`/`neoFit` path; no new constants beyond the tint factor.

## Non-goals
No deck data change. No main-note geometry, angle or orbit change. No palette change. No CLAUDE.md edit. No change to the running nits lane's items (N1-N4, B1-B3, C1-C4).

## Why smallest
L1 is one fill change per renderer (app SVG, PDF) and deletes the band draw. L2 is one profile constant, propagated by the existing fixture/corpus tools. No new harness.

## Phases (one lane, serial; starts after the nits lane's D PR merges, because both own index.html neo code and tests/mutants)
P1 Tests first (lane owner: swarm-lane)
- tests/pdfcards.test.js + tests/app.test.js: (a) a highlighted lens emits a fill equal to the 0.5 tint of its state colour and emits no lensBand stroke (app SVG and PDF op stream); (b) contrast of #242424 on every emitted lens fill >= 4.5 computed from emitted colours (CONTRACT rule 2: compare outputs); (c) lens area / main area in [0.32, 0.35] from `HPE.layout.PROFILE`; (d) name glyph box inside the lens path at PDF card size and app size for every built-in Neotone deck (existing fit assertions retargeted). Seen failing.
P2 Geometry: new fixture `tests/fixtures/paired_profile_v4.json` (depth 0.45), point `PROFILE` and `PROFILE_DRAW` at it, regenerate `tests/fixtures/engine_corpus_v1.json` via `tools/regen_engine_corpus.js` in the same commit; `python3 tools/inline_engine.py`.
P3 Render: pdfcards `neoDrawPan` and app `neoSvg` fill the lens with the tint when highlighted, drop lensBand stroke; remove `lens_band` only if no other caller (enumerate callers, not grep for calls).
P4 Docs: docs/CARD-SPEC.md Neotone section (lens fill rule, depth 0.45, tint 0.5, contrast floor) and docs/ENGINE-SPEC.md section 18 depth line.
P5 Mutants: re-anchor any NEO/nt_* patch touching lensBand or depth (`python3 tools/refresh_mutants.py --check`); add mutants: tint factor -> 1.0 (killed by b), band stroke restored (killed by a), depth reverted (killed by c). README count + FLOORS from CI artifacts.
- Verify: `node --test tests/app.test.js tests/pdfcards.test.js && python3 tools/validate.py && python3 tools/inline_engine.py --check && python3 tools/refresh_mutants.py --check`.
- Acceptance: M PR (main) and D PR (dev) from one head; validate green at verified M head; fresh swarm-reviewer PASS/PASS_WITH_NITS at that SHA; D merged; M held. Before/after PNGs (app plate + PDF card, root and tone highlight, Kurd-family and a 9-mutant deck) attached to the PR.

## Verification split
Automated: P1 tests, validate, mutation gate. Self: rendered before/after PNGs. Independent: swarm-reviewer at head SHA. Human: owner DEV check of lens size and readability (phone + printed card) before any main merge.

## Risks / edge cases
- Bigger lens may crowd the main-note name or number (main name position `nameU`): P1(d) covers main name fit too; if it fails, fall back to depth 0.40 and record.
- Empty mutant slots (dashed outline, M-label from neotoneOverlay) move with the larger lens: B3's label-position test from the nits lane must still pass; update expected values only from emitted output.
- Print: depth change alters every Neotone PDF; no committed PDFs, so no artifacts to regenerate.
- Saved scales unaffected (geometry is not stored; share links carry no geometry).

## Recovery
Revert the lane on dev via `claude/dev-revert-<lane>`. Fixture v3 stays in the repo, so reverting depth is one pointer.

## Continuation point
After nits lane D merges: dispatch this lane from main at the then-current head (stack on the nits M head if M is still unmerged, per lane-branches-stack-on-main).

## Stop
Plan ready; lane dispatch after the nits lane's D merge (AFK grants it); main merge waits for owner.

## Round 1 review (independent, 2026-11-03): NOT READY. Amendments R1-R7 override the phases above
- R1 (F1 high, fixed). `tools/hifi.py` is owned: its profile copy (depth, `lens_band`, `LENS_EMPTY`), lensBand ops and band stroke get the same depth, tint fill and band removal. P1 adds a hifi-vs-pdfcards tint-fill agreement case in `tests/test_render_agreement.py`.
- R2 (F2 high, fixed). P2 = new fixture `paired_profile_v4.json` (rev 4, depth 0.45); bump rev to 4 in layout.js `PROFILE`, pdfcards `PROFILE_DRAW`, hifi.py; retarget layout.test.js "PL: HPE.layout.PROFILE is exactly the frozen rev ..." to v4; add "v3 SUPERSEDED by v4" to `tests/test_fixture_integrity.py` the way v1/v2 are; check its depth bound and `lens_ri` math still pass. Decision: `lens_band` is REMOVED from every stroke dict and the `lensBand` figure is removed from `neoMutantFigures`; callers enumerated by reading each renderer (not by grep), and the stroke-dict assertions in tests/pdfcards.test.js and tests/test_render_agreement.py edited to match.
- R3 (F3 medium, fixed). `neoSvg` in index.html is a hand edit (fill tint when highlighted, drop the `f.lensBand` stroke). Every engine-region copy is regenerated by `python3 tools/inline_engine.py`, never hand-edited.
- R4 (F4 medium, fixed). P1(d) also asserts the main name box and main number stay inside the crescent minus the `main_band` inset, at the smallest PDF card size and the smallest app plate size, for every built-in Neotone deck. Fallback rule: if that main-name/number assertion fails at 0.45 with the existing fit floor, use depth 0.40 (rev 4 still), record it, and report to owner. Empty-slot M-labels checked through the nits lane's B3 test from emitted output.
- R5 (F5 low, fixed). Corpus regen kept as a confirmation step; expected no diff (corpus carries no geometry).
- R6 (F6 low, fixed). Contrast test (P1 b) computes from the emitted fill colour. Re-anchor `tests/mutants/nt_app_lens_name_unfit.patch` and any nt_*/NEO patch next to the band draw. Add a fourth mutant: hifi band stroke restored (killed by test_render_agreement).
- R7 (F7 low, fixed). Evidence adds a phone-width screenshot at the smallest plate and a printed-card photo is the owner's DEV-check item (owner action, not invented). P4 docs state the tint/plain-lens edge is carried by the black outline (tint vs white 1.6-2.35:1).

## Round 2 review (independent, 2026-11-03): NOT READY. Amendments R8-R12
- R8 (F1 high, fixed). `tests/fixtures/neotone_card_reference.json` (K1 source of truth, "do not edit by hand") stays untouched. The owner instruction of 2026-11-03 supersedes K1 parity for lens depth only: in tests/pdfcards.test.js the K1 `lens_orbit` assertion is retargeted to the v4 lens centre with a named exception comment ("K1 delta: lens depth 0.45, owner 2026-11-03"), and any K1 assertion reading lens-name positions gets the same treatment; every other K1 assertion is unchanged. docs/CARD-SPEC.md records the K1 delta. Owned file: tests/pdfcards.test.js K1 block.
- R9 (F2 medium, fixed). P2 regenerates tests/fixtures/profile_case_{pygmy,kurd9,hijaz}_v2.json with their embedded `_generated_by` evaluator in the same commit; owned. Acceptance: `test_PA_the_profile_cases_are_swept_and_carry_geom_place` and test_render_agreement pass, and each fixture's mutant `place` entries equal `HPE.layout` output at v4.
- R10 (F3 medium, fixed). P4 updates every v3 / rev 3 / "1/3" / lens_band reference in docs/ENGINE-SPEC.md (section 18 opening, depth formula, fixture/rev paragraph) and docs/CARD-SPEC.md, plus source comments in layout.js `PROFILE`, pdfcards `PROFILE_DRAW` (module, then inline_engine.py) and tools/hifi.py. Verify: `grep -rn "paired_profile_v3\|rev 3\|lens_band" docs src tools index.html` returns only the SUPERSEDED/history lines.
- R11 (F4 low). R4's assertion measures the emitted main glyph box against the crescent inner edge (lens outline + outline + decor), never against the width cap.
- R12 (F5 low). Bump only layout `PROFILE.rev`; never the core.js/share.js seed profile rev (share links stay backward compatible).

## Round 3 review (independent, 2026-11-03): READY. Amendment R13 (two medium, one low, applied)
- R13. Owned and retargeted to v4: tests/pdfcards.test.js `PA.frozen` (and its "rev 3 profile fixture" test name -> rev 4) and the `lensC` 0.4917 literal in "PA: lens and crescent are analytic closed paths"; tests/layout.test.js `PAIRED` plus its 0.3333 and 0.4917 literals (v4 lens centre 0.536, computed from the fixture). Docs note the inner lens edge (0.346R) clears the decor ring (0.355R) by only 0.009R. R10's grep extends to tests/; expected hits are v1-v3 history plus the owned stroke dicts. The profile_case `_generated_by` script is saved to a temp .js and run with the worktree path; only mutant `place` entries may change.

## Readiness
1 no open blocker/high: pass. 2 assumptions verified or AFK-recorded (L1-L4): pass. 3 smallest approach: pass. 4 phases with owner/deliverable/acceptance: pass. 5 dependency (nits lane D merge) listed: pass. 6 verification covers behaviour + failures: pass. 7 recovery (dev revert, v3 kept): pass. 8 continuation point: pass. 9 scope and stop: pass.

## Owner decision 2026-11-02
"go with D, start the lane after nits": option D (0.5 tint fill, depth 0.45, closed crescent main band). Dispatch this lane once the nits lane's D PR merges to dev. Comparison page: https://claude.ai/artifact/9w1bvWC2GoaGj4jkjFMf9p
