# Neotone solid tint for main notes and ding

Plan: docs/plans/2026-11-03-neotone-solid-tint.md
Key: handpan-cards#neotone-solid-tint (follow-up to TRI-50 lens legibility)

Mode: plan. Stop: plan ready, no implementation. AFK armed.

## Goal
On Neotone cards (`plan.hasMut`), every lit note is a solid 50% tint of its state colour. That covers three things:
- the main tone field;
- the lens (already tinted on dev, option D);
- the ding.

The crescent band and the ding ring are not drawn on Neotone cards. Standard cards are unchanged, byte for byte.

## Decisions
- D1: Standard layout keeps its border rings. Source: owner, 2026-11-03, "keep standard layout as is".
- D2: The Neotone main note and lens are both a solid tint. Source: owner, same message, after the comparison artifact W4XsYt3PAup8iTskDFwzjd.
- D3: A lit ding on a Neotone card is also tinted. Source: owner answer, 2026-11-03.
- D4: The main note reuses `LENS_TINT` 0.5 and `lensTint` / `lens_tint` / `tintHex`. It gets no new factor.
  - The NL contrast test already proves 4.5:1 for #242424 on every palette colour at 0.5.
  - The function names stay the same (smallest change); the CARD-SPEC wording says they now apply to main notes as well.

## Non-goals
- No change to geometry, lens depth, name sizes, palettes, deck data or the standard renderer.
- No main merge.
- No fix to the reviewer nits on #837, except where this lane edits the same CARD-SPEC paragraph anyway. That paragraph's 0.346R sentence gets corrected only if the lane touches it.

## Change (three renderers, same shape)
In the `hasMut` branch of each renderer:
1. Fill the main circle with `tint(colour(main.st))` when the main is lit, and with white otherwise. Then fill the lens over it, as today. The tint is the fill colour of the existing combined fill-and-stroke op for the main outline circle; no new op is added (R5).
2. Remove the `crescentBand` stroke.
3. Draw the ding:
   - Neotone and lit: fill the ding with the tint and draw no ring.
   - Otherwise: keep today's code.

Where the code lives:
- `src/engine/pdfcards.js`, the tone loop and the ding block. Then run `python3 tools/inline_engine.py`, which updates the engine region in index.html.
- `tools/hifi.py`, the tone loop and the ding block.
- `index.html` `neoSvg`, the tone loop and the ding line. This is app JS outside the engine region.

`crescentOps`/`crescentBand` stays computed and exported: tests and the fit check may still read it. Removing it is out of scope.

## Phases (single serial lane)
The lane is `claude/neotone-solid-tint`, in its own worktree, stacked on the #837 head 090ebe6d (lane branches stack on the previous lane head).

**P1. Tests first.**
- In `tests/pdfcards.test.js` (beside the NL tests):
  - A lit Neotone main fills its circle with `lensTint(colour)` and draws no stroke in that colour.
  - A lit Neotone ding fills with the tint and has no ring.
  - A standard card's draw-op stream is identical to the one at the base SHA. Snapshot it at base and compare.
- In `tests/app.test.js`: the same three assertions for `neoSvg`/preview SVG output, which has no `stroke="<state colour>"` on Neotone.
- In the Python suite: a hifi Neotone render check (no band stroke, tinted fill), next to the existing hifi lens test.
- Add mutants:
  - `nl_main_band_restored`: re-adds the crescent stroke.
  - `nl_ding_ring_on_neo`: keeps the ring on Neotone.
  - `nl_std_tinted`: tints a standard card.
  Strip any `index` lines from the patches. Each mutant must be killed by its test.
- R1: rewrite the state detectors so they read the tint fill, not strokes:
  - `neo_fields` in `tests/test_render_agreement.py`;
  - the placed-layout branch of `tests/helpers/dump_app_render.js`.
  For each main circle and each ding, the fill is `tint(root)` for root, `tint(tone)` for tone, and white for off. Add an assertion that a lit Neotone card yields at least one field that is not "off", so the agreement test cannot pass with nothing in it.
- R2: rewrite the test "PA: a lit lens and a lit crescent draw their own band…" so it asserts a tinted main fill and no crescent stroke.
- R3: re-anchor `nl_lens_band_stroke_restored.patch` and `nl_hifi_lens_band_restored.patch` against stable lines. Grep for the removed line instead of reading the `@@` headers. Both patches are owned by this lane, and `git apply --check` must pass on both.
- R4: the byte-identity test covers two cards: a placed card with no mutants (`hasMut` false, ding ring kept) and a non-placed standard card. The ding change is gated on `plan.hasMut` alone.

Lane ownership: the three renderers, the inlined engine region, `tests/pdfcards.test.js`, `tests/app.test.js`, `tests/test_render_agreement.py`, `tests/helpers/dump_app_render.js`, the hifi test file, `tests/mutants/nl_*`, `tests/suite_health.py` (FLOORS), the README mutant count, and the `docs/CARD-SPEC.md` Neotone paragraph.

**P2. Implement** the three renderers, then inline the engine.

**P3. Docs and fixtures.**
- CARD-SPEC Neotone paragraph: the main-note highlight is a solid tint, the crescent is gone, and the ding is tinted on Neotone.
- Update FLOORS and the README mutant count from CI artifacts.
- CARD-SPEC: replace the sentence "The main-note highlight stays the closed crescent." with the solid-tint rule (R6). The name-fit text about the crescent stays.
- No engine corpus regen: the corpus doesn't cover pdfcards (verified by the reviewer).

**P4. Gates.**
- Verify: `tests/run.sh` locally as a smoke test, then `python3 tools/validate.py` and `python3 tools/make_icons.py --check`.
- Open PR M into main (Refs TRI-50 or a new TRI issue) and PR D into dev from the same head.
- validate must be green at the verified head.
- A fresh swarm-reviewer at that SHA, with this plan quoted verbatim.
- D merges under AFK rules. Then check that served DEV renders a Neotone card with tinted main notes and a standard card with rings.

**P5. Owner.**
- DEV QA, using the F3 Low Pygmy 18 Neotone link from earlier plus any standard deck.
- M stays held with #834, #837 and #836 until the owner says merge.

## Verification split
- Automated: P1 tests, the new mutants, and full validate CI at the head.
- Self: a phone-size screenshot of DEV for both layouts.
- Independent: the swarm-reviewer verdict.
- Human: owner DEV QA.

## Risks / edge cases
- An empty slot (lens with no note) keeps `LENS_EMPTY`. A main absent with a lens present stays white.
- "Both lit" (tone main plus root lens): the two tints sit next to each other with only the black lens outline between them. Similar palettes (pink/orange) may blur. The comparison artifact showed this, the owner chose it anyway, and it gets checked in DEV QA.
- PDF size: fills replace strokes, so the op count stays flat.
- Name contrast on a tinted ding: same factor, same proof.

## Recovery
Revert the lane on dev with `claude/dev-revert-neotone-solid-tint`. Main is untouched until the owner merges.

## Continuation point
Create the worktree from 090ebe6d, then write the P1 tests.

## Review (independent, 2026-11-03, base 090ebe6d) — NOT READY
- R1 HIGH: render-agreement state detection reads Neotone main state from crescent stroke paths (w 4.6) and ding state from ring circles: `neo_fields` (tests/test_render_agreement.py) and its mirror in tests/helpers/dump_app_render.js. Removing strokes makes every lit field read "off" on both sides, so agreement goes vacuous or fails. Fix: P1 updates both detectors to read state from the tint fill (main circle fill / ding fill == tint(root|tone)), and adds a check that a Neotone card with a lit note yields >=1 non-off field.
- R2 HIGH: existing test "PA: a lit lens and a lit crescent draw their own band..." (tests/pdfcards.test.js) asserts crescent band strokes; plan does not list it. Fix: name it as rewritten in P1.
- R3 MEDIUM: mutants nl_lens_band_stroke_restored and nl_hifi_lens_band_restored use the crescent-band lines as context; they stop applying. Fix: re-anchor both (grep the line, not @@ headers) and list them in ownership.
- R4 MEDIUM: the ding block in neoDrawPan / draw_neo_pan / neoSvg is shared by every placed layout, incl. placed decks with no mutants (hasMut false). Gating on plan.hasMut is right, but the byte-identity test must cover a placed non-mutant card and a non-placed standard card, not just one "standard" card.
- R5 LOW: "fill main circle with tint" — the first outline circle is drawn fill+stroke (B*); say the fill colour changes on that op (or a fill-only op before), so op count stays flat as claimed.
- R6 LOW: CARD-SPEC sentence "The main-note highlight stays the closed crescent." must be replaced; ENGINE-SPEC mentions crescent only for name fit (still valid, crescentOps kept). NL name test "main names inside the crescent" stays valid (geometry).
- Verified: engine corpus does not cover pdfcards (no regen); no i18n text mentions the crescent; only neoDrawPan / draw_neo_pan / neoSvg draw Neotone.

## Review round 2 (independent, 2026-11-03, base 090ebe6d) — READY
- R1-R6: resolved in the plan body with checkable acceptance (detectors + non-vacuous assertion; PA test rewrite; both patches re-anchored with `git apply --check`; two-card byte identity gated on `plan.hasMut`; tint on the existing fill+stroke op; CARD-SPEC sentence replaced).
- N1 LOW: "the hifi test file" is `tests/test_render_agreement.py` (ProfileRenderAgreement, beside `test_a_lit_lens_is_a_half_tint_fill_with_no_band_stroke`); name it in P1 and ownership.
- N2 LOW: name the killing test for each new mutant (`nl_std_tinted` -> the byte-identity test); `# suite:` patterns use `.` wildcards, no quotes.
- N3 LOW: ding tint also goes on the existing ding fill+stroke op (pdf `circle(..., 1, 1)` with WHITE; svg `fill="#fff"`), so the ding op count stays flat too; say so like R5.
- Checked: no other renderer, no built-in Neotone deck (app.test `pan()` band-count test unaffected), no e2e dependency on crescent strokes.

## Round-2 dispositions (fixed)
- N1: the hifi test lives in `tests/test_render_agreement.py`, beside `test_a_lit_lens_is_a_half_tint_fill_with_no_band_stroke`. That file is already in lane ownership.
- N2: each new mutant's `# kills:` line names its test:
  - `nl_main_band_restored`: the new main-fill test;
  - `nl_ding_ring_on_neo`: the new ding test;
  - `nl_std_tinted`: the byte-identity test.
  `# suite:` patterns use `.` wildcards and no quotes.
- N3: the ding tint changes the fill colour of the existing combined fill-and-stroke ding op, so the ding adds no new op.

Verdict: READY (round 2, no open blocker or high).
