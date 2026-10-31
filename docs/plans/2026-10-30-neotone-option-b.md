# Neotone, Option B: revised execution plan

2026-10-30. Refs TRI-17. Revises `docs/plans/2026-10-30-neotone-build.md` (the
"base plan"). Every base-plan requirement stands unless a row in "Supersedes" below
replaces it. Plan only: no code, commits, PRs or Linear writes were made producing
it. Execution: `/swarm` (lanes, reviewer gate and merge rules are not restated here).

## Goal

Ship to DEV (main PRs held) a Neotone layout that follows the owner's Option B mocks:
the Scale tab form as it is today, a Standard/Neotone switch on the Layout tab,
mutant tonefields drawn as lenses inside the main tonefields, moved with the existing
tap-to-swap and hold-and-drag drawer, with release safety and link compatibility kept
as the base plan specifies.

## Non-goals

All base-plan non-goals, plus: every Option A element (18-row pickers, "EDIT
TONEFIELDS", "Placed n of n" counter, per-slot selects, disabled-option labels);
moving a note between main and mutant rings in the drawer; voicing, cluster, tier
or select changes for Neotone; a Neotone footer tag on cards; new test harnesses;
changes to `data/decks.json`; any built-in scale page URL change.

## Owner decisions (owner 2026-10-30) and where each lands

| # | Decision | Lands in |
|---|---|---|
| 1 | Option B, close to the current Add/Edit sheet; nothing from Option A | U2 acceptance; Non-goals |
| 2 | Words: "Tonefield", "Mutant notes"/"mutant tonefield"; no "area", "zigzag", invented terms; pitch order | U2 i18n keys; T2 spec wording; Supersedes S1-S3 |
| 3 | Scale tab keeps its form, no pan; bottom label "Bottom Notes / Neotone Mutant Notes (optional)" (title case); pan only on Layout tab | U2 acceptance (a) |
| 4 | Layout tab Standard/Neotone switch; top notes fill main tonefields, bottom notes fill mutant tonefields, tonefield N gets note N in pitch order | E2 `proposeProfile`; U2 (b) |
| 5 | Move notes by tap-to-swap and hold-and-drag, within one ring only; main ring and mutant ring never cross | E2 ring-strict validator; U2 (c) |
| 6 | Mutant tonefield is a lens inside its main tonefield, ding side, depth about 1/3 of the main diameter; replaces the outer ring | T2 fixture v2; P2; gate G1 |
| 7 | Pitch number outside the note; mutant number "4s" outside, next to the main number; number line "4s" | E2 labels; P2 |
| 8 | Too many notes: Neotone stays on, extras named, SAVE held until removed; empty mutant tonefields drawn neutral | E2 `unplaced`; U2 (d); P2 empty-slot rule |
| 9 | Converting a built-in: bottom notes become mutant notes, top rim notes never assumed mutant; Pygmy F5/G5 must be removed; saving makes a new custom scale the user names (prefilled), duplicates allowed; a line before SAVE says so and the built-in stays unchanged | U2 (e); rule I1 kept |
| 10 | Links/back-compat: wire v7, record v5; v1-v6 decode as Standard; records without Neotone data stay Standard; no saved scale lost; old app on v7 = NEEDS_NEWER_APP; built-in page URLs unchanged | Base-plan codec and isolation suite kept; E2/U2 acceptance |
| 11 | Keep "Neotone" in visible copy; the vendor-name UI ban allows exactly that word | U2 (f); Supersedes S4 |
| 12 | Dev first; every main PR held; owner trackpad/phone QA is human-only | Gates; Verification |
| 13 | Chord cards carry no "Neotone" footer tag (mock Q6; owner lean, may be overturned at QA) | P2 acceptance; Non-goals |

## Supersedes (base-plan sections replaced)

| id | Base-plan section | Replaced by |
|---|---|---|
| S1 | "Owner answers applied", Q1 ("Paired areas", never name the vendor) | Decisions 2, 11. Profile id stays the internal string `"paired"` (identifier, never shown); visible word is Neotone. |
| S2 | Lane U acceptance, UI paragraph (two-option "Standard \| Paired areas", "Assigned n of n", 18-row list, `<select>`s, "Reset areas", disabled options) and D5, D6, D7, D9 dispositions | U2 (b)-(d). RESET LAYOUT stays the single reset button; in Neotone it re-applies the pitch-order proposal. |
| S3 | Lane U i18n keys (`sheet.mode_paired`, `sheet.paired_*`, `sheet.reset_areas`, `sheet.areas_reset`, `reason.PROFILE_*` sentences naming "area") and `sheet.drawer_hint` copy | U2 (f) key list. `sheet.drawer_hint` text is unchanged (it already says "in the same ring"); in Neotone a new `sheet.drawer_hint_neotone` replaces it and `sheet.drawer_hint_slide` is not shown. |
| S4 | D11 "no vendor name" visible-text audit | U2 (f): the audit allows exactly the word "Neotone" and only in the listed keys. Evidence: no such ban test exists yet on origin/dev or in #751 (`git grep -i neotone origin/dev -- tests` hits only comments in `tests/test_fixture_integrity.py`), so U2 writes the allowing form directly. |
| S5 | "Frozen profile fixture" (`paired_profile_v1.json`, outer secondary ring, D1, D3, D12 numbers) | T2 fixture v2 (lens), gate G1. |
| S6 | "Proposal" (top notes overflow into secondaries, bottoms overflow into primaries) | E2 `proposeProfile`: rings never mix; extras returned as `unplaced`. |
| S7 | Seed-option validity "every non-null entry names a non-ding field" (any slot) and `PROFILE_FULL` = more than 18 notes | E2: p-slots hold only `r` keys, s-slots only `b` keys, `i` keys never; `PROFILE_FULL` = a note without a tonefield (more than 9 rim, more than 9 bottom, or any inner note). |
| S8 | Lane U "Editing the scale keeps assignments ... others become unassigned rows" | U2 (g). |
| S9 | Q2 visual clause "keeps its badge, dashed ring and orange accents wherever placed" | Gate G2 (recommendation below). Engine half of Q2 kept. |
| S10 | D4 empty slots: "sheet preview draws a faint dashed outline plus its area number" | Empty tonefields draw neutral (decision 8) on cards, print and preview; preview adds its tonefield number. |

## Questions answered with evidence

**Q-A. Does E's map/codec represent Option B as is?** The representation does; the
validator and proposal do not.
- Evidence (origin/dev, merged #745): `HPE.core.readProfile` takes an 18-entry
  `map`, index 0-8 = p1-p9, 9-17 = s1-s9 (`HPE.layout.placeProfile`: `k <
  PROFILE.areas ? primary : secondary`). So "main tonefield N" = `map[N-1]`, "mutant
  tonefield N" = `map[8+N]`; a within-ring swap is a swap of two entries in one half.
  Wire `pair-` (18 tokens, `PAIR_RE`) carries this unchanged.
- Gaps: `readProfile` accepts any key in any slot and requires every non-ding note
  mapped with a cap of 18 total; `proposeProfile` puts top notes into s-slots and
  bottoms into p-slots. Option B forbids both.
- Change (E2): ring-strict validation, new proposal, `PROFILE_FULL` meaning, rev 2.
  The wire grammar, version numbers, option order and record shape do not change.
- Safe to change without a reader for the old meaning: `git log -p origin/dev -S
  PROFILE_ENABLED -- src/engine/core.js index.html` shows exactly one commit
  (8fd2e65e, lane E) adding `PROFILE_ENABLED: false` (engine and inlined copy) and
  no commit setting it true; #749/#751 (the only branch that flips it, U) are not on
  dev; main has no lane E code (#744 held). With the flag false, `decode` of v7
  returns `NEEDS_NEWER_APP` and `parseSeed` refuses `profile`, so no served build
  (DEV or prod) has ever produced or accepted a v7 link or v5 record. Rev 1 data
  exists only inside tests. Verify at E2 start (re-run the `git log -S` command; if
  any commit sets the flag true on dev, stop: E2 must then keep a rev-1 reader).

**Q-B. Lens geometry: what changes.** All three layers, via a new fixture:
- T2: new `tests/fixtures/paired_profile_v2.json` (rev 2). The v1 file stays,
  pinned and marked superseded in `tests/test_fixture_integrity.py` (its own rule:
  "A change is a new rev"). Shape:
  `{id:"paired", rev:2, tonefields:9, angles:[...same 9...], main:{orbit, r},
  mutant:{depth, r}, ding:{r, dy:0}, n_out, number_gap, extent_margin, slots:[p1..p9,
  s1..s9]}`. A mutant lens = main circle ∩ a circle of radius `mutant.r` centred on
  the same angle, placed so the lens spans `depth x 2 x main.r` radially from the
  main circle's ding-side edge.
- E2: `HPE.layout.PROFILE` = v2 literal; `geom.place[fieldId] = [angle, orbit, r,
  kind]` with `kind` "main" or "mutant" and, for mutant, the lens circle
  (orbit, r); one `HPE.layout.profileLabelRadius(kind)` that renderers use.
- P2: app `pan`/`panField`, `HPE.pdfcards`, `tools/hifi.py` draw the lens (two arcs)
  and the main crescent; numbers outside (decision 7).
- Label rule (CLAUDE.md "Diagram label rule"), unchanged: name = r x RATIO[source
  zone], number = r x 0.64, octave = 0.66 x name, print floor 3.6 pt on every glyph.
  For a non-circular field, "its own drawn radius" is read as the radius of the
  largest circle inscribed in the drawn shape: lens r = depth x main.r; main crescent
  r = (1 - depth) x main.r. That reading is part of gate G1.
- Arithmetic, sourced geometry (`tests/fixtures/paired_profile_v1.json` on
  origin/dev: main = v1 `primary` {orbit 0.58, r 0.16}, `n_out` 0.068,
  `extent_margin` 0.06; the outer `secondary` ring is gone, so the extent is
  0.58 + 0.16 + 0.068 + 0.06 = 0.868). One R throughout: band half 74 pt / 0.868 =
  **R = 85.3 pt**, main r = 13.64 pt. `d` = lens depth as a fraction of the main
  diameter. Weakest glyph is the octave digit (0.66 x name):
  - Inscribed-circle reading: lens octave = 0.66 x 0.8232 x d x 13.64 = 7.41d pt;
    crescent octave = 0.66 x 0.80325 x (1-d) x 13.64 = 7.23(1-d) pt; mutant number
    "Ns" = 0.64 x d x 13.64 = 8.73d pt. Floor 3.6 pt holds for d in [0.486, 0.502].
    d = 1/3: lens octave 2.47 pt, "Ns" 2.91 pt, **fail**. d = 1/2: lens octave 3.71,
    crescent octave 3.62, "Ns" 4.37 pt, **pass** (thin margin).
  - Lens-circle-radius reading (r = `mutant.r`, symmetric lens `mutant.r` = main r):
    d = 1/3: rule size lens octave = 0.66 x 0.8232 x 13.64 = 7.41 pt, "Ns" 8.73 pt,
    crescent (main r) 7.23 pt: **pass before fit**. The lens is 9.1 pt thick and
    20.3 pt wide, so `fit_note`/`fitNote` shrinks the name; if its box is the
    inscribed circle (r 4.55 pt) the fitted octave is 2.47 pt, **fail after fit**.
    Passes only if T2 shows the fitted name (box = the lens shape) stays ≥ 3.6 pt.
  The label rule and the 3.6 pt floor never change. Gate G1.

**Q-C. Open PRs.** Rework on the same branches; close nothing.
- #749/#750 (P) and #751/#752 (U) are not on dev (both OPEN), so no dev revert is
  needed. Each lane merges the E2 head into its branch (merge commit, no
  force-push, no history loss), then reworks. U2 deletes the Option A UI code in a
  new commit; the earlier commits stay in history. PR titles/bodies are updated to
  "Neotone" and Option B. #744 (E, main, held) gains the E2 commits; E2 opens a new
  dev PR from the same head (#745 is merged). T2 is a new branch
  `claude/neotone-t2` stacked on the E head 701c06fc, with its own held main PR and a
  dev PR; E2 merges T2 into `claude/neotone-e`.
- Nothing on dev conflicts with Option B in a way that needs reverting: dev has T
  (fixture v1, spec 18) and E (permissive validator, flag off). Both are corrected
  forward by T2/E2; with the flag off neither is user-reachable.

**Q-D. Q2 once mutant notes are lenses (gate G2).**
- Engine half kept (base plan Q2): voicing, tiers, cluster rule and highlighting
  read the source zone. A bottom-field note keeps zone `bottom`, so the cluster
  rule's bottom-shell clause ("takes that field and forces nothing") still applies;
  no `voicing.js`/`select.js` edit. Verified card convention 3 is untouched.
- Visual half, recommendation: on a Neotone card a mutant note draws as a lens with
  the ordinary highlight band (root/tone colours, convention 1 and 4's highlighted
  style), its "Ns" number in the bottom-shell orange `#E27005`, an unhighlighted
  lens in the neutral grey of an unhighlighted top field (not dashed), and **no**
  "N BOTTOM NOTES" badge (the mutant tonefield is on the top shell; the approved
  chord-card mock shows no badge). This changes verified convention 4 (dashed bottom
  fields) and the badge rule for Neotone cards only, so it is **owner-gated (G2)**.
  Default if G2 is not answered before P2 starts: this recommendation (matches the
  approved mock card), recorded as an AFK auto-decision; the owner may overturn it
  at QA (then P2 switches to base-plan Q2: dashed lens, badge kept).

**Q-E. Mirror/anchor/angle/seat controls with Neotone on.** Recommendation (kept
from base plan, now explicit): hidden while Neotone is on (`PROFILE_CONFLICT` stays);
the in-sheet Standard draft (mirror, anchor, seats, angles) is kept and restored
untouched when the user switches back to Standard; the committed Neotone record
carries none of them.

## Owner gates

| id | Question | Recommendation | Blocks |
|---|---|---|---|
| G1 | Lens depth and label sizing (Q-B, R = 85.3 pt). (a) depth ≈ 1/2 (d = 0.49-0.50), labels from the inscribed circle: lens octave 3.71 pt, crescent octave 3.62 pt, "Ns" 4.37 pt, passes the 3.6 pt floor. (b) depth ≈ 1/3, labels from the lens circle radius: 7.41 pt before fit, passes only if T2 shows `fit_note` keeps the name ≥ 3.6 pt inside a 9.1 x 20.3 pt lens (estimate 2.47 pt, likely fails); if it fails, (b) is withdrawn. (c) depth 1/3 with glyphs under 3.6 pt: not allowed (label rule and floor never change). | (a): passes by arithmetic, keeps the in-lens name. | T2 merge (fixture freeze) and so everything after. |
| G2 | Neotone card styling of mutant notes (Q-D); changes verified card convention 4. | No badge, solid (not dashed) lens, orange "Ns" (mock card). | Nothing: P2 builds the recommendation as default; owner may overturn at QA. |
| G3 | Inner notes (after `\|`) never get a tonefield, even when a main tonefield is free (8 rim + 1 inner flags the inner note). | Yes (prompt rule); the fix is moving the note into the top field on the Scale tab. | None (built as recommended; owner may overturn at QA). |

AFK: G1 is not auto-picked (it overrides an explicit owner number); the run stops at
T2 with the computed table until the owner answers. G2 takes the recommendation
(auto-decision, owner-gated at QA); G3 the recommendation. AFK auto-decision AD1
(ER5): Neotone -> Standard -> Neotone in one sheet session without saving re-applies
the proposal (unsaved swaps are discarded); rationale: one rule, matches RESET
LAYOUT; listed for owner QA.

## Assumptions (each verified or gated)

| Assumption | Status |
|---|---|
| No v7 link or v5 record was ever producible on a served build | Verified (Q-A); re-verified at E2 start |
| Map halves = main / mutant rings | Verified (`placeProfile` on origin/dev) |
| P and U branches are not on dev | Verified (`gh pr view 750/752`: OPEN) |
| No vendor-name ban test exists to edit | Verified (S4 grep) |
| Existing drawer swap/drag is per ring and can take a second "ring" made of discrete slots | Read in `tests/drawer_grid.test.js`/`drawer_drag.test.js` by U2 before coding; if the drawer code cannot address slot rings without changing Standard behaviour, U2 stops and reports (no widening) |
| Lens labels meet the floor | Gated (G1) |
| Pitch order = MIDI order within a ring | Verified: zones are MIDI-sorted by `scaleInfer`; typed-order seating (owner 2026-10-23) applies to Standard only and is out of the Neotone map |

## Why this is the smallest approach

The 18-entry map, wire v7 grammar, record v5, the engine-owned record version, the
`PROFILE_ENABLED` gate, rule I1 and the shipped-client isolation suite all carry
over unchanged. Option B needs only: a stricter validator and a new proposal (E2),
a new fixture revision (T2, required by the fixture's own rule), lens drawing (P2),
and replacing the picker UI with a switch on the existing drawer (U2). No new
harness, store, version number or option segment.

## Lanes, ownership, waves

Base-plan lane rules apply (tests first, mutants refreshed per repo convention, CI
`validate` at the verified head is the evidence, fresh reviewer at that SHA, PR M
held + PR D). Ownership is exclusive per wave.

| Wave | Lane | Branch | Owns | Prereqs |
|---|---|---|---|---|
| 1 | **T2** fixture v2 + spec | `claude/neotone-t2` from 701c06fc | `tests/fixtures/paired_profile_v2.json`, `tests/test_fixture_integrity.py`, `docs/ENGINE-SPEC.md` section 18, the "Frozen v2 fixture" section of this plan | G1 answered |
| 2 | **E2** engine | `claude/neotone-e` (merge T2) | `src/engine/core.js` (not the flag line), `layout.js`, `share.js` only if a test needs it, engine regions via `tools/inline_engine.py`, `tests/core.test.js`, `layout.test.js`, `share.test.js`, `scale.test.js`, `link_corpus.test.js`; refusal sentences in ENGINE-SPEC section 18 table (verbatim with REASONS) | T2 on dev |
| 3 | **P2** renderers | `claude/pa-p` (merge E2) | `pan`/`panField` in `index.html`, `src/engine/pdfcards.js` (+ inline), `tools/hifi.py`, `tools/decks.py` passthrough, `tests/pdfcards.test.js`, `test_pdf_parity.py`, `test_render_agreement.py`, `tests/fixtures/profile_case_*_v1.json` (regenerated as `_v2`), `tests/helpers/dump_app_render.js` | E2 on dev (G2 default = recommendation) |
| 3 | **U2** app | `claude/pa-u` (merge E2) | `index.html` outside engine regions except `pan`/`panField`; the `PROFILE_ENABLED` line in `core.js` (+ inline); `data/i18n/*.json` (+ `tools/sync_i18n.py`); `tests/app.test.js` (incl. the Neotone word audit), `e2e.test.js`, `storage_corpus.test.js`, `tests/fixtures/i18n_english_dom_v1.json`, `drawer_*.test.js` (regressions + Neotone rings), `tools/sandbox.js` (the file #751 edits; `tests/helpers/sandbox.js` is not owned) | E2 on dev |
| 4 | **M** mutants + floors | `claude/neotone-m` from the stack head | `tests/mutants/pa_*.patch`, FLOORS in `tests/suite_health.py`, README mutant count | P2, U2 on dev |
| 4 | **Q** QA guide refresh (integrator, not a lane) | none | the scratchpad file `/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/86550be0-8308-46ce-9e79-1d7585ec807b/scratchpad/neotone-qa.html` (not in the repo) | U2 on DEV |

Lanes refreshing context-shifted existing mutant patches in their own diffs (as #749
did) is allowed; new `pa_*` mutants belong to M. Second lander of P2/U2 resolves
`index.html` conflicts by hand within its own symbols; engine regions are re-inlined,
never hand-merged (base R4). #751 also edits T2/E2-owned files (`docs/ENGINE-SPEC.md`,
`tests/test_fixture_integrity.py`, `src/engine/*.js`, `tests/core|layout|share|scale|
link_corpus.test.js`, `tests/fixtures/engine_corpus_v1.json`): in U2's merge of E2,
every conflict in those files takes the T2/E2 side.

### T2 acceptance
- `paired_profile_v2.json` holds the G1 values; its SHA256 pinned; v1 kept, pinned,
  labelled superseded and referenced by no engine code.
- Fixture properties (in `test_fixture_integrity.py`, no implementation import):
  main circles pairwise disjoint, inside the pan, clear of the ding; each lens lies
  inside its main circle on the ding side with the frozen depth; at the R the extent
  rule yields, every glyph of every main crescent and lens (name, octave digit,
  number) ≥ 3.6 pt by the inscribed-radius reading; numbers outside each note do
  not overlap a neighbouring field.
- `PLAN_PATH` points at this plan; this plan's "Frozen v2 fixture" section gains the
  exact JSON in the same PR.
- ENGINE-SPEC section 18 rewritten in decision-2 words: tonefields, mutant
  tonefields, lens, ring-strict map, pitch-order proposal, `unplaced`, `PROFILE_FULL`
  meaning, rev 2, rule I1, labels "N"/"Ns".
- Verify: `python3 -m unittest tests.test_fixture_integrity tests.test_readme_currency -v`.

### E2 acceptance (tests first)
- `readProfile`: rev 2 only; p-slots accept only `r` keys, s-slots only `b` keys, an
  `i` key or a cross-ring key is `PROFILE_MAP_INVALID`; every note still mapped once
  (`PROFILE_NOTE_MISSING`/`TWICE` unchanged); `PROFILE_FULL` when rim > 9, bottom > 9
  or any inner note; sentences rewritten in decision-2 words (no "area").
- `proposeProfile(fields)` returns `{map, unplaced}`: rim notes in MIDI order into
  p1.., bottom notes in MIDI order into s1..; rim past 9, bottom past 9 and all
  inner notes in `unplaced` (pitch order). Pygmy: 9 rim placed, `unplaced` = F5, G5;
  6 mutant filled, s7-s9 empty. Kurd 10 (no bottoms): all s empty, `unplaced` empty.
  A scale with no rim beyond the ding is valid with an empty map half.
- `solve` with a profile: `geom.place` per v2; field labels "N" (main) and "Ns"
  (mutant); ding at centre, never in the map; acoustic solve unchanged (no `place`,
  engine corpus `--check` clean).
- Wire: v7 grammar, `pair-` token order and every v1-v6 corpus byte unchanged;
  round-trips over every built-in's proposal (for built-ins with `unplaced` notes,
  the test first removes those notes from the scale, then proposes, so every
  remaining note is mapped and `PROFILE_NOTE_MISSING` does not fire) and 200 seeded ring-strict maps; a cross-ring v7 link
  is refused with the profile code; flag off still `NEEDS_NEWER_APP`.
- Re-verify Q-A's `git log -S` at start; record the output in the PR body.
- Verify: `python3 tools/inline_engine.py --check && node --test tests/core.test.js tests/layout.test.js tests/share.test.js tests/scale.test.js tests/link_corpus.test.js && node tools/regen_engine_corpus.js --check && python3 tools/validate.py`.

### P2 acceptance
- Built-in PDFs and all existing parity/agreement tests unchanged.
- Profile cases (Pygmy minus F5/G5 with 6 mutant notes; Kurd 9 with empty mutant
  tonefields; Hijaz 8 rim, one empty main tonefield) through app SVG, `HPE.pdfcards` and hifi agree on lens and crescent
  geometry, label and number sizes, highlighting, number lines ("4s") within the
  existing tolerances; every glyph drawn after `fit_note`/`fitNote` ≥ 3.6 pt.
- Empty mutant or main tonefield: neutral outline only (decision 8), never error colour.
- Mutant styling per G2 (default: the recommendation); no Neotone footer tag (decision 13).
- Verify: `node --test tests/pdfcards.test.js && python3 -m unittest tests.test_pdf_parity tests.test_render_agreement -v`.

### U2 acceptance
(a) Scale tab: form unchanged; no pan on the Scale tab. `sheet.bottom_opt` (today
uppercase in the data of every locale, e.g. en "BOTTOM NOTES (OPTIONAL)") becomes,
in en, exactly "Bottom Notes / Neotone Mutant Notes (optional)" (decision 3, title
case), in both modes; other locales translate it with "Neotone" untranslated, in
their own title-case convention (none for ja/zh). U2 confirms no CSS
`text-transform` applies to that label (if one does, the label is exempted from it);
an app test pins the en string as rendered. Fit check: longest locale at 380 px.
(b) Layout tab: "STANDARD | NEOTONE" `aria-pressed` pair in a labelled group (like
MIRROR), 44 px targets. Map source: Edit of a saved Neotone scale opens its stored
map unchanged; `proposeProfile` runs only on the first switch to Neotone in a draft
that has no map and on RESET LAYOUT. Switching hides mirror/anchor/seat/angle
controls (Q-E) and moves focus to the switch; shows the preview pan; Standard
restores the Standard draft untouched. Saving a Neotone custom while Standard is
selected rewrites that custom in place (same local handle) as an acoustic record
v4 with no profile data, as for any Standard save; the user chose Standard, so this
is not a loss. Release-safety test (`storage_corpus.test.js`): v5 Neotone custom ->
Standard SAVE -> one record, same handle, v4, `savedMeaning` = Standard of the same
notes, every other record byte-identical; reload keeps it. No pickers, no "Placed n
of n", no list.
(c) Drawer: main tonefields form one ring, mutant tonefields another. Tap a note,
then another in the same ring, swaps their map entries; tap a note, then an empty
tonefield of the same ring, moves it; a tap on an empty tonefield with nothing
selected is a no-op; hold and drag onto a tonefield of the same ring swaps or moves
(into an empty tonefield). A drop or tap across rings is ignored (no-op, no error).
Each lens and crescent is an aria-labelled button ("Tonefield 4 mutant, Bb3";
`sheet.tonefield_label`) with a ≥ 44 px hit area (an invisible hit circle beyond the
drawn shape is fine); the existing drawer keyboard/focus behaviour applies to both
rings. Hint `sheet.drawer_hint_neotone`; the slide hint is not shown in Neotone.
Drawer tests cover tap-to-empty move and empty-tap no-op.
(d) Unplaced message next to the switch (`aria-live`, also in `#scale-guidance`
when SAVE is tapped): one sentence per cause present, shown together in this order,
then `sheet.neotone_remove` "Remove them to save.":
`sheet.neotone_over_main` "{notes} have no main tonefield." (rim past 9),
`sheet.neotone_over_mutant` "{notes} have no mutant tonefield." (bottom past 9),
`sheet.neotone_inner` "Inner notes {notes} have no tonefield." (any inner note).
Pygmy reads "Inner notes F5 and G5 have no tonefield. Remove them to save." SAVE
and GENERATE hold while `unplaced` is non-empty; empty tonefields give no message.
(e) Built-in: Edit of a built-in in Neotone shows the line "Saving makes a new
custom scale. {name} stays unchanged." plus, when n > 0, "Its {n} bottom notes
become mutant notes in tonefields 1-{n}." (`sheet.neotone_builtin_mutants`, omitted
at n = 0) before SAVE; the name field is prefilled "{name} {suffix}" with
`sheet.neotone_name_suffix` en "Neotone Mutant", translated per locale ("Neotone"
untranslated); editable; duplicate names save; the record is a separate custom entry
with no `replaces` (I1, unchanged tests PAU6/PAU9 kept). Fit check: "F3 Low Pygmy 18
Neotone Mutant" in the longest locale at 380 px in the name field and its chip
(existing ellipsis behaviour, no overflow).
(f) i18n: all new/changed keys in all eight tables (`sheet.mode_neotone`,
`sheet.drawer_hint_neotone`, `sheet.neotone_over_main`, `sheet.neotone_over_mutant`,
`sheet.neotone_inner`, `sheet.neotone_remove`, `sheet.neotone_builtin_copy`,
`sheet.neotone_builtin_mutants`, `sheet.neotone_name_suffix`,
`sheet.tonefield_label`, `sheet.bottom_opt` new text, `reason.PROFILE_*`
re-worded); Option A keys from #751 (`sheet.paired_*`, `sheet.mode_paired`,
`sheet.reset_areas`, `sheet.areas_reset`) removed; `tools/sync_i18n.py`; English DOM
fixture updated; audit: no visible "deck", "area", "zigzag" or "Paired" in new
strings, and "Neotone" appears only in the listed keys; fit check at 380 px portrait
and landscape for the longest locale.
(g) Scale edits after swaps: an assignment whose `(zone, midi)` survives keeps its
tonefield; a removed note frees its tonefield; a new note takes the first empty
tonefield of its ring in pitch order, else joins `unplaced`. Never nearest-pitch.
(h) Release safety and links: base-plan Lane U release-safety items and PAU-I
isolation tests kept verbatim (v5 opaque in the pinned shipped client, Add/Edit/
Delete/RESET SEEDED/reload leave it byte-identical, old client not `protected`, v7
in old client = NEEDS_NEWER_APP and saves nothing, acoustic records v4
byte-identical, corpus `savedMeaning` unchanged); saved/shared/reloaded Neotone
scale reproduces the same diagram; LINK copies v7; `syncRoute` carries v7.
- Verify: `python3 tools/sync_i18n.py --check && python3 tools/validate.py && node tools/boot_sim.js && node --test tests/app.test.js tests/storage_corpus.test.js tests/drawer_grid.test.js tests/drawer_drag.test.js tests/drawer_seats.test.js` (single e2e locally with CHROME_BIN; full e2e = CI).

### M acceptance
Base-plan M list, with "secondary treated as bottom zone in badge count" replaced
by G2's rule, plus: cross-ring key accepted; inner key accepted; proposal mixes
rings; `unplaced` dropped (SAVE allowed with extras); cross-ring drawer swap
applied; lens drawn at main radius (pdfcards, hifi); "Ns" label written as "N".
Verify: `python3 tools/refresh_mutants.py --check && ./tests/mutation_check.sh` (CI shards are the oracle).

### Q (QA guide refresh)
Rewrite `neotone-qa.html` (scratchpad) for Option B: replace the three "Paired
areas" rows with Neotone switch, swap/drag within ring, cross-ring no-op, Pygmy
F5/G5 hold, one message per cause (main, mutant, inner overflow), empty mutant and
empty main tonefields (8-rim scale) neutral, tap-to-empty move, built-in conversion
lines and prefilled name, saved Neotone reopens its map, Neotone custom saved as
Standard, AD1 toggle-back, G2 card style, v7 link in an older app, print lens labels. Done when no "Paired"/"area"
wording remains and every decision 3-10 has a row.

## Interfaces

- `HPE.layout.proposeProfile(fields) -> {ok, value:{map[18], unplaced[fieldId]}}`.
- `HPE.core.readProfile(raw, options, fields)`: ring-strict, rev 2.
- `geom.place[fieldId] = [angle, orbit, r, kind, lensOrbit?, lensR?]`; renderers
  branch only on `geom.place`; `HPE.layout.profileLabelRadius(kind)`.
- Labels: `fields[id][5]` = "N" or "Ns" for profile decks.
- Unchanged: `HPE.share.encode/decode`, `recordVersion`, `PROFILE_ENABLED`,
  `scaleRecord`, `savedCandidate`, `readSavedRecord`, I1.

## Verification split

- Automated (CI `validate` at each verified head): every lane's verify command and
  the full suite; isolation tests; link corpus bytes; mutants.
- Self (lane author): local smoke of the lane's verify command; one e2e locally.
- Independent reviewer (fresh, at the verified SHA): acceptance above, ownership
  boundaries, "no Option A element" (grep the diff for `paired_area`, `select`
  rows, "Placed", "EDIT TONEFIELDS"), decision table rows 1-13.
- Human (owner, DEV, trackpad and phone, human-only): create Pygmy Neotone,
  hold-and-drag and tap-swap in both rings, cross-ring no-op, F5/G5 hold then
  remove and save, name prefilled and duplicate allowed, built-in unchanged, share
  and reopen, print PDF lens labels legible, an existing saved library untouched,
  380 px and landscape, one non-English locale.

## Edge cases

- Ding never a tonefield; never in the map; drawn at centre.
- Empty bottom field: Neotone allowed, every mutant tonefield empty and neutral.
- More than 9 rim or any inner note: `unplaced`, SAVE held (decisions 8, G3).
- More than 9 bottom notes: the extras by pitch in `unplaced`; SAVE held.
- Fewer than 9 rim notes: empty main tonefields drawn neutral; legal.
- Scale edits after swaps: U2 (g).
- Switching Neotone -> Standard -> Neotone in one sheet session re-applies the
  proposal (AD1, auto-decision for owner QA); a saved Neotone scale reopens with its
  stored map (U2 (b)); Cancel discards everything as today.
- Mirror/anchor/angles/seats hidden in Neotone, restored in Standard (Q-E).
- Landscape and 380 px: existing sheet split; fit tests in U2 (f).
- Eight locales: U2 (f) fit check, longest locale.
- Old app + v7 link: NEEDS_NEWER_APP (unchanged; PAU-I test).

## Risks

Base R1, R2, R4, R5 stand. R3 is replaced by G1 (floor arithmetic fails at 1/3).
- R6 Drawer code assumes rings are angle orbits; slot rings may not fit without
  touching Standard. Mitigation: U2 reads `drawer_*` tests first; Standard drawer
  tests must pass unchanged; stop and report if they cannot.
- R7 Main crescent labels shrink with lens depth (G1 table covers both).
- R8 A rev-1 record appears from an unforeseen path: E2 start check (Q-A); if found,
  keep a rev-1 reader rather than refusing.

## Recovery

Base-plan rollback stands: revert U2 on dev (`claude/dev-revert-pa-u`); flag false;
v7 = NEEDS_NEWER_APP; v5 rows opaque and kept. Once U2 is on DEV, never redefine
rev 2; a further geometry change is rev 3 with a rev-2 reader. T2/E2 can be fixed
forward freely while the flag is false on every served build.

## Continuation point

Owner answers G1 (G2 optional). Then create `claude/neotone-t2` from 701c06fc,
re-run `git log -p origin/dev -S PROFILE_ENABLED -- src/engine/core.js index.html`,
compute the G1 table, freeze v2. Then E2, then P2 ∥ U2, then M, then Q and owner
DEV QA.

## Stop

This workstream stops when P2 and U2 are on dev, M merged to dev, the QA guide is
refreshed and the owner has done DEV QA; every main PR (#744, T2's, #749, #751, M's)
stays held until the owner says merge.

## Frozen v2 fixture

Frozen by lane T2 (branch `claude/neotone-t2`, from 701c06fc). File:
`tests/fixtures/paired_profile_v2.json`, sha256
`611b59a2cce11d0c72c0bdf0e0549f9d73e10329917838559bc7dc57b2947e33`, pinned in
`tests/test_fixture_integrity.py`; v1 is kept, pinned and superseded. Exact content:

```json
{ "id": "paired", "rev": 2,
  "tonefields": 9,
  "angles": [270, 230, 310, 190, 350, 150, 30, 110, 70],
  "main":   { "orbit": 0.74, "r": 0.245 },
  "mutant": { "depth": 0.44, "r": 0.245 },
  "ding":   { "r": 0.2, "dy": 0 },
  "n_in": 0.145, "number_out": 1.0758, "extent_margin": 0.06,
  "slots": ["p1","p2","p3","p4","p5","p6","p7","p8","p9",
            "s1","s2","s3","s4","s5","s6","s7","s8","s9"] }
```

Owner answer on G1 (2026-10-30): "bigger tonefields". Use the earlier larger rim
geometry (main r about 0.245R, orbit about 0.74R, neighbours nearly touching), keep the
label rule and the 3.6 pt floor, prefer depth 1/3 and otherwise the smallest depth up
to 0.50 that passes, main number outside the rim, M<n> on the same radial line inboard,
ding r may shrink if M<n> would touch it. This supersedes every number in the "Frozen
card design (card mock v17, 2026-10-31)" section (r 0.19, orbit 0.745, ding, M-number and main-number spots,
lens depth): P2 and U2 take all geometry from ENGINE-SPEC section 18 and
`tests/fixtures/paired_profile_v2.json`, not from that section.

Lens centre from the pan centre: `lensC = main.orbit - (2 x main.r - depth)` with
`depth = 2 x main.r x mutant.depth` = 0.2156, so lensC = 0.4656 and the lens name sits at
`lensC + mutant.r - depth/2` = 0.6028. Main name at orbit + depth/2 = 0.8478 on every
tonefield of a mutant card (card mock v19), at 0.74 otherwise. M-number at
0.74 - 0.245 - 0.145 = 0.35, main number at 1.0758 (owner v17 spot). Neighbouring main
circles: chord 2 x 0.74 x sin 20 = 0.5062 against 2r = 0.49 (gap 0.016); outer edge
0.985, inner edge 0.495. Print extent = 1.0758 + 0.0784 + 0.06 = 1.2142, so
R = round(74 / 1.2142, 1) = 60.9 pt, main r = 14.92 pt. The ding stays 0.2.

`n_in` is 0.145, not 0.085: it is the smallest 0.005 step at which every `M<n>` label
(real NunitoSans width, cap height 0.705 em, half the 0.012R outline stroke) is at least
0.5 pt clear of its own main circle and clears the ding (0.14 fails on M6/M7, 0.145
passes). The main numbers at 1.0758 clear every circle and sit outside the pan.

Recorded harness command (T2 verify):
`python3 -m unittest tests.test_fixture_integrity tests.test_readme_currency -v`.

#### G1 measurement (T2, R = 60.9 pt, r = 14.92 pt, fit = `fit_note` rule, width <= 1.47 x inscribed radius)

Worst case over every spelling A-G x natural/#/b, octaves 2-6 (D#2 / D#3 / D#4 and
A#2 are the tightest). Name / octave digit in pt. Lens rule size 12.28 pt, number size
9.55 pt at every depth.

| depth (of main diameter) | lens name / octave | crescent name / octave | verdict |
|---|---|---|---|
| 1/3 | 4.18 / 2.76 | 8.38 / 5.53 | FAIL (lens octave) |
| 0.40 | 4.98 / 3.29 | 7.48 / 4.94 | FAIL (lens octave) |
| 0.42 | 5.28 / 3.49 | 7.28 / 4.81 | FAIL (lens octave) |
| 0.43 | 5.38 / 3.55 | 7.18 / 4.74 | FAIL (lens octave) |
| **0.44 (frozen)** | 5.48 / 3.62 | 6.98 / 4.61 | pass (smallest 0.01 step; 0.02 pt margin) |
| 0.45 | 5.58 / 3.68 | 6.88 / 4.54 | pass |
| 0.50 | 6.28 / 4.15 | 6.28 / 4.15 | pass |

Depth 1/3 fails, so the fixture takes the smallest 0.01 step that passes the 3.6 pt
floor for every spelling: 0.44. An earlier draft of this table called 0.44
"borderline" at R 59.8 (number_out 1.1); at the owner's number_out 1.0758 (R 60.9) it
passes.

### Design review (Option B) round 1

Verdict: NOT READY (no Option A leakage; decisions 1-13 traceable; gaps below are in U2/P2 states).

| id | sev | evidence | fix |
|---|---|---|---|
| DR1 | high | U2 (d) has one template "{n} top notes, 9 tonefields"; mock s4 has separate sentences for mutant overflow ("Eb6 has no mutant tonefield") and inner notes (s5: "Inner notes F5 and G5 have no tonefield"). Pygmy F5/G5 are inner, not rim. | Three keys: main overflow, mutant overflow, inner notes; combined in one message, ending "Remove them to save." Add to (f) key list and QA rows. |
| DR2 | high | U2 (b) "Switching to Neotone applies proposeProfile"; nothing says Edit of a saved Neotone scale opens its stored map, nor what saving a Neotone custom as Standard does to its record. | (b): open with the stored map; proposal only on first switch in a draft and on RESET LAYOUT. State Neotone->Standard save on a custom writes an acoustic v4 record in place (or forbid), with a release-safety test. |
| DR3 | medium | 44 px is required only for the switch. At 380 px the preview R is about 170 px, so a lens about 1/2 deep is about 32 px across (smaller at 1/3). | Require a 44 px hit area per lens and crescent (invisible hit circle beyond the drawn shape is fine), with each tonefield an aria-labelled button ("Tonefield 4 mutant, Bb3"). Keep the existing drawer keyboard/focus behaviour for both rings, and move focus to the switch when hidden controls go away. |
| DR4 | medium | G2 fallback = dashed lens + "N BOTTOM NOTES" badge, but the approved mock chord card shows no badge and says "lighting and colours are unchanged". | Make the fallback the recommendation (no badge, not dashed, orange "Ns"), still recorded as an auto-decision, so the default matches the approved mock. |
| DR5 | medium | Decision 3 says title case "Bottom Notes / Neotone Mutant Notes (optional)". Current `sheet.bottom_opt` is "BOTTOM NOTES (OPTIONAL)", uppercase like its sibling labels. | State the exact string per locale and whether the label CSS uppercases it. If it does, title case is lost, so take an owner call or exempt this label; then run a fit check of the longest locale at 380 px. |
| DR6 | medium | (c) covers drag into an empty tonefield but not tap: a note, then an empty tonefield of the same ring. | Tap note then empty same-ring tonefield moves it; a tap on an empty tonefield with nothing selected is a no-op. Add a drawer test. |
| DR7 | low | Mock s5 line includes "Its 6 bottom notes become mutant notes in tonefields 1-6"; U2 (e) copy omits it. | Add it to `sheet.neotone_builtin_copy` (count and range parameterised; omit the clause at 0). |
| DR8 | low | (e) prefill "{name} Neotone Mutant": the suffix is locale-dependent (`sheet.neotone_name_suffix`), and long names may exceed the name field or chip width. | Say whether the suffix is translated (mock: English "Neotone Mutant"). Add a truncation/fit check for the longest built-in plus suffix at 380 px. |
| DR9 | low | Empty main tonefields (fewer than 9 rim) are covered by S10 but have no QA/P2 case. | Add a profile case with fewer than 9 rim notes to P2 and to the QA guide. |

### Eng review (Option B) round 1

Verdict: READY (no blocker/high). Verified: flag history (one commit 8fd2e65e, flag false), PR states (#744/#749/#750/#751/#752 OPEN, #745 MERGED, heads 701c06fc/e769ae47/f2d8d2a1), map split (`placeProfile` `k < PROFILE.areas`), v1 fixture values, U not stacked on P.

- ER1 medium: G1 arithmetic uses main {0.62, 0.19}, not v1 {0.58, 0.16}, without provenance; extent 0.62+0.19+0.068+0.06 = 0.938 gives R ≈ 79 pt from a 74 pt half band, not 74. Conclusion holds (octave ≈ 2.7 pt at depth 1/3). Fix: state the source of 0.62/0.19 and use one R.
- ER2 medium: G1 offers only the inscribed-circle reading of "own drawn radius"; a lens-circle-radius reading (r = mutant.r) is an alternative the owner should see. Fix: add it as a G1 option with its floor result.
- ER3 medium: E2 round-trip of "proposal minus unplaced" for built-ins with inner notes contradicts `PROFILE_NOTE_MISSING` (every note mapped) unless the extras are also removed from the fields. Fix: say the test drops the unplaced notes from the scale first.
- ER4 medium: U2 (d) message says "{n} top notes, 9 tonefields" but `unplaced` also covers bottom > 9 and inner notes. Fix: one message per cause or neutral wording ("{notes} have no tonefield").
- ER5 low: Neotone -> Standard -> Neotone silently discards swaps; not an owner decision. Fix: record as auto-decision for QA.
- ER6 low: #751 edits `docs/ENGINE-SPEC.md` and `tests/test_fixture_integrity.py` (T2-owned); U2's E2 merge must take T2/E2's side. State it.
- ER7 low: U2 owns `tools/sandbox.js`; `tests/helpers/sandbox.js` also exists. Name which.

### Review dispositions round 1

| id | sev | disposition | where |
|---|---|---|---|
| ER1 | medium | fixed: sourced v1 `primary` {0.58, 0.16}, one R = 85.3 pt | Q-B arithmetic; G1 |
| ER2 | medium | fixed: lens-circle-radius reading added with floor result | Q-B; G1 (b) |
| ER3 | medium | fixed: test removes `unplaced` notes before proposing | E2 acceptance, Wire |
| ER4 | medium | fixed: one sentence per cause, shown together | U2 (d), (f) |
| ER5 | low | fixed: AFK auto-decision AD1 (re-apply proposal), listed for QA | Owner gates AFK line; Edge cases; Q |
| ER6 | low | fixed: U2 takes T2/E2's side in those files | Lanes, conflict paragraph |
| ER7 | low | fixed: `tools/sandbox.js` (the one #751 edits) | Lanes table, U2 row |
| DR1 | high | fixed: three cause keys + `sheet.neotone_remove` | U2 (d), (f); Q |
| DR2 | high | fixed: stored map on Edit; proposal only first switch / RESET LAYOUT; Neotone->Standard save = v4 in place, same handle, release-safety test | U2 (b); Edge cases; Q |
| DR3 | medium | fixed: 44 px hit area, aria-labelled tonefield buttons, keyboard/focus, focus to switch | U2 (b), (c), (f) |
| DR4 | medium | fixed: default = recommendation (no badge, solid lens, orange "Ns"); still owner-gated (convention 4) | Q-D; G2; P2 |
| DR5 | medium | fixed: exact en string, locales title-case convention, no `text-transform`, fit check (decision 3 settled, no owner call) | U2 (a) |
| DR6 | medium | fixed: tap-to-empty move, empty-tap no-op, drawer test | U2 (c) |
| DR7 | low | fixed: `sheet.neotone_builtin_mutants`, omitted at 0 | U2 (e), (f) |
| DR8 | low | fixed: suffix translated ("Neotone" kept), fit check longest name + suffix at 380 px | U2 (e) |
| DR9 | low | fixed: Hijaz 8-rim case in P2, QA row | P2; Q |

### Review round 2

Verdict: READY (no blocker/high). All 16 round-1 dispositions checked against the body and fixed as stated. Arithmetic re-checked: 74/0.868 = 85.25 pt, main r 13.64 pt, d in [0.486, 0.502], d = 1/2 gives 3.71/3.62/4.37 pt.

| id | sev | evidence | fix |
|---|---|---|---|
| R2-1 | medium | U2 (d) templates "{notes} have no ..." break grammar for one note (mock s4: "Eb6 has no mutant tonefield"). "F5 and G5" needs a locale list joiner, and origin/dev `index.html` has none (`git grep Intl.ListFormat\|listJoin` finds nothing). | Add singular and plural key variants (or a count param), and say how `{notes}` is joined per locale (`Intl.ListFormat`, or a `sheet.list_and` key). Add an app test for 1 and 2 notes. |
| R2-2 | medium | Q-B says the lens circle is "centred on the same angle" but gives no orbit. The (a) depth and the inscribed-radius reading depend on it, and T2 must freeze it. | T2 states the lens centre orbit formula (`main.orbit - main.r + depth*2*main.r - mutant.r`, or whatever is chosen) in the fixture and spec. |
| R2-3 | low | P2 owns `pan`/`panField`. U2 needs lens/crescent hit buttons in the preview pan, which is probably drawn by the same functions, so ownership may overlap. | Say that U2 adds hit targets outside `pan`/`panField` (overlay layer), or hand that hook to P2. |
| R2-4 | low | The (e) copy line "{name} stays unchanged" is shown "in Neotone". Unclear whether it also shows for a Standard Edit of a built-in. Today that is SAVE with `replaces`, so this line would be wrong there. | Limit the line to Neotone mode explicitly (it already reads that way; add a test that Standard Edit does not show it). |

### Owner answers 2026-10-30 (G1, G2)
- G1: option (b), "1/3, measure first". Lens depth about 1/3, labels sized from the lens circle radius. T2 measures the fitted lens name, octave digit and "Ns" at print size; any glyph under 3.6 pt means (b) is withdrawn and T2 switches to (a) (depth 0.49-0.50), recorded in this file, with no re-ask. The label rule and floor never change.
- G2: mock style, approved. Solid lens, normal root/tone highlight, orange "Ns", no BOTTOM NOTES badge, unlit lens neutral grey. Neotone cards only; card convention 4 holds for Standard. A CLAUDE.md patch recording this is owner-gated and is drafted at lane M.

### Review round 2 dispositions
| id | sev | disposition | where |
|---|---|---|---|
| R2-1 | medium | fixed: separate one-note and many-note keys per cause; notes are joined with `Intl.ListFormat(lang,{type:"conjunction"})`; app tests cover 1 and 2 notes | U2 (d) |
| R2-2 | medium | fixed: T2 writes the formula for the lens-centre distance from the pan centre (main orbit minus main r plus lens r minus depth) into the v2 fixture and ENGINE-SPEC section 18 | T2 |
| R2-3 | low | fixed: U2 places hit targets in a separate overlay group; P2 exposes field centres and radii | P2, U2 (c) |
| R2-4 | low | fixed: the built-in "new custom scale" line shows only in Neotone; a test checks that a Standard Edit does not show it | U2 (e) |

Readiness: READY (eng r1 READY, design r1 fixed, combined r2 READY, G1/G2 answered). Continuation point: dispatch T2 from 701c06fc.

### Owner change 2026-10-31 (card mock comment): mutant number placement
This supersedes decision 7's "next to the main number". The orange "Ns" sits on the ding side of its tonefield, just inboard of the lens; the main number stays outside. The space between the ding and the lens tips is tight, so T2 sizes the ding (the mock uses 0.12R) and checks that "Ns" clears the ding at or above the 3.6 pt floor. If it cannot, the issue goes back to the owner.

### Owner change 2026-10-31 (card mock comment): main highlight follows the lens border
A lit main tonefield's highlight band traces the whole crescent: the outer rim plus an inner arc along the lens border. Where the lens is lit too, a thin white gap separates the two bands. This applies to P2 renderers (app and print).

### Owner change 2026-10-31 (card mock comment): bigger tonefields at the rim
Main tonefields sit as close to the rim as possible, evenly spaced (40 degrees for nine), and as large as possible until neighbours nearly touch (mock: r = 0.245R, orbit = 0.74R). The lens stays at about 1/3 depth. Main numbers move just outside the rim. This replaces the v1 fixture's primary {orbit 0.58, r 0.16} in T2's v2 fixture. Because the tonefields are larger, the 3.6 pt floor check in G1 gets more headroom.

### Owner change 2026-10-31 (card mock comment): ding matches rim size
The Neotone ding is drawn at the same radius as the main tonefields (mock 0.245R), centred. The "Ns" labels (about 0.44R from centre) still clear it. If T2 finds crowding at print size, the rim tonefields and the ding shrink together so they stay matched.

### Owner change 2026-10-31: borders, bands, M# labels
- Solid black outline on every main tonefield, lens and the ding; inner black hairline at 0.74r kept (owner 2026-10-30, convention 4).
- Band (variant D): main tonefields 0.046R (the app's 0.24r), mutant lenses 0.024R, banded all the way around the lens.
- Mutant labels read M + host tonefield number (M1-M6); number line `3-4-6-M4`. Supersedes the "4s" style in decision 7.
- Tonefields 10% smaller than touching, for breathing room.
- A Neotone scale with no mutant notes draws no lens cutouts: plain full tonefields like a Standard card (Neotone sizing and positions kept).
- A Neotone scale with no mutant notes draws with the Standard engine output (owner 2026-10-31, card mock v13): same angles, field and ding radii, and number placement as `tools/gen_deck.js`.
- Neotone uses the Standard geometry (owner 2026-10-31, mock v14): orbit 0.745R, field 0.19R, ding 0.2R; lens depth 1/3. Main numbers go inboard at orbit - r - n_in (about 0.47R), and the M number sits on the same radial line at about 0.36R. Re-run the 3.6pt lens-label check in T2 at the smaller field size; if it fails, G1 applies.
- Number placement revised (owner 2026-10-31, mock v15): main numbers outside the rim at R+5 on both cards; M number just inside the tonefield inner edge (orbit - r - 0.045R, about 0.51R), next to its lens. Supersedes the inboard placement above.
- M number moved to the Standard number spot, orbit - r - n_in (0.085R, about 0.47R) (owner 2026-10-31, mock v16).
- A Neotone card with no mutant notes puts its main numbers in the Standard spot (orbit - r - n_in) (owner 2026-10-31, mock v17).

## Frozen card design (card mock v17, 2026-10-31)

Source: https://claude.ai/artifact/TgFMSuaPN4ZZbkp6y71cte v17 (scratchpad `neotone-card.html`). This section is the single spec for P2 renderers (app, `HPE.pdfcards`, `tools/hifi.py`) and T2's v2 fixture. It supersedes every "Owner change 2026-10-31" subsection above, decision 7's "4s" style, G2's orange "Ns" and P2's "4s" number-line acceptance (now `M<n>`), and the geometry in "bigger tonefields at the rim" and "ding matches rim size". Values are fractions of the pan radius R.

**Superseded by T2 (owner G1 answer, 2026-10-30, "bigger tonefields").** Every number below is superseded for P2 and U2 by ENGINE-SPEC section 18 and `tests/fixtures/paired_profile_v2.json` (main r 0.245, orbit 0.74, lens depth 0.44, `n_in` 0.145, main number 1.0758, ding 0.2). Take geometry from those, not from this section; its structure (which element goes where) still stands.

**Shared geometry (both kinds of Neotone card).** Use the Standard engine geom for the scale's own top notes (`node tools/gen_deck.js "<scale>"`; the mock's values for an 8- or 9-note rim: orbit 0.745, field r 0.19, ding r 0.2 centred, decor ring 0.355 drawn on both kinds). Angles, count and anchor are the engine's output for that scale (Kurd 9 = 8 rim fields at 45 degrees, anchor one; Pygmy = 9 fields, anchor between). A Neotone card draws only the main tonefields that hold a top note; it does not pad to nine. Nothing is hard-coded beyond what the engine emits.

**Mutant card (one or more mutant notes).**
- Lens: a circle of radius r, centre on the field's radial line at `orbit - (2r - depth)`, depth = 2r/3; only the overlap with the main field is drawn. Lens centre formula goes into the v2 fixture and ENGINE-SPEC section 18 (R2-2).
- An empty mutant tonefield is drawn neutral grey (#f3f1f5 fill); a filled one is white.
- Outlines: solid black, 0.012R wide (0.8 at mock R = 66), on the main field, the lens border and the ding; inner hairline at 0.74r kept on highlighted main fields (owner 2026-10-30, convention 4).
- Lit main field: band 0.046R (the app's 0.24r) in root/tone colour, tracing the crescent (outer rim plus the arc along the lens border), inset 0.0076R (0.5 at mock R) from both the outer rim and the lens border, which leaves a white gap. Lit lens: band 0.024R drawn as two arcs (lens circle and main circle) clipped to the overlap, inset 0.0076R, so the band runs all the way round the lens.
- Labels: main note name centred in the open crescent (orbit + depth/2) on every tonefield of a mutant card, empty lenses included; at the field centre (orbit) on non-mutant cards (owner, card mock v19); lens note name centred in the lens (`lensC + r - depth/2`); both sized by the label rule (rim 0.80325, bottom 0.8232 on the lens), never below 3.6 pt print. If T2's G1 check fails at r = 0.19R, depth switches to 0.49-0.50 per the owner's G1 answer, with no re-ask; the fixture's lens-centre formula stays parametric in depth.
- Numbers: main number outside the rim at 1.0758R (R + 5 at mock R); orange (#E27005) mutant number "M<n>" at the Standard number spot, `orbit - r - n_in` (n_in 0.085, about 0.47R), on the same radial line. M-number size = label rule number size (0.64 x r); the mock's smaller 0.5 factor is mock-only. Number line uses `M<n>` (e.g. `3-4-6-M4`).

**Non-mutant card (Neotone layout, no mutant notes).** Positions, radii and numbers come from the Standard engine output: no lens cutouts, note names centred on the field, numbers at the Standard spot `orbit - r - n_in`. Styling follows the mock, not Standard: solid black 0.012R outline, band 0.046R (= 0.24r), inner hairline kept (convention 4). Standard cards keep convention 4 unchanged.

**Unchanged.** Card frame stays the single root-colour four-sided frame (CLAUDE.md design system); header, chord name, note/number lines (as Standard except `M<n>` entries), footer and palettes as Standard. Mock-only scaling factors (the `.62`/`.42` font multipliers) are not part of the spec; renderers apply the label rule.

**Acceptance (P2).** Tests first: P2 adds a fixture of the v17 field centres, radii and number positions for both mock cards, plus a test that a non-mutant Neotone geom equals the Standard engine geom. The comparison covers positions only, not glyph size (renderers apply the label rule, the mock does not). App and print match that fixture within 0.5 pt at print R; tests/test_render_agreement passes; every diagram glyph ≥ 3.6 pt in print; the non-mutant card's field centres, radii and number positions equal a Standard render of the same scale. Owner DEV QA compares against the mock.

### AFK decision 2026-10-31
- Inner hairline: owner 2026-10-30 chose to keep it (convention 4 holds for Neotone); no CLAUDE.md patch. The mock's missing hairline is mock-only.
- Card frame colour (thread 2f095580, unanswered): kept the root-colour frame, as the mock does. Reason: reversible, matches CLAUDE.md, needs no CLAUDE.md patch. Owner may overturn at QA.

### Review (frozen card spec) round 1
| id | sev | disposition |
|---|---|---|
| F1 | blocker | rejected: the reviewer misread the mock. PYG carries `std:{rim:.745,r_note:.19,r_ding:.2,...}`, so both cards draw the Standard geometry |
| F2 | high | fixed: angles, count and anchor per scale from the engine; no padding to nine |
| F3 | medium | rejected: both configs have `std`, so both draw the ring; the spec now says so |
| F4 | high | fixed: supersede line extended; "Unchanged" reworded |
| F5 | high | superseded: owner kept the hairline 2026-10-30, no patch |
| F6 | medium | fixed: values given as fractions of R; M size = 0.64r |
| F7 | medium | fixed: P2 adds a v17 fixture and a Standard-geom equality test; positions only |
| F8 | medium | fixed: G1 fallback depth stated |
| F9 | low | fixed: both insets and the two-arc lens band described |
| F10 | low | no change |

### Review (frozen card spec) round 2
| id | sev | disposition |
|---|---|---|
| R2-1 | high | fixed, then superseded by owner v18: name at crescent centre (orbit + depth/2) when a mutant note is present, orbit otherwise |
| R2-2 | low | no change; 1.0758R scales with print R |
| R2-3 | low | no change |
Verdict after fix: READY.

## Owner answers 2026-10-30 (check-in)
- T2 go: dispatch now.
- Hairline: keep (convention 4); no CLAUDE.md patch.
- M-number size: label rule, 0.64r.
- Frame: root colour.
- Input limit (owner 2026-10-30): with Neotone, the top rim takes at most 9 notes and no cyclops (inner, after `|`) notes. A "Neotone" checkbox on the Scale form, beside the bottom-notes field, turns this on: while it is ticked the form refuses a 10th top note and the `|` marker inline, like other input errors. The Layout tab's Standard/Neotone switch follows the checkbox. This supersedes decision 3's "pan only on Layout" for this control, and decision 8's "flag extras, hold SAVE" for typed input. Converting a built-in with extras (Pygmy F5/G5) still shows the flags until the notes are removed. Owner: U2 (UI, i18n key); E2's PROFILE_FULL refusal stays the engine guard.
