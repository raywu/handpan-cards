# Scale-engine coordination

Workstream: `scale-engine`. Plan of record: `docs/SCALE_ENGINE_PLAN.md` (merged
at 29056fd, PR #8). This doc is the bus; the plan is the spec. When they
disagree, the plan wins on WHAT and this doc wins on WHO and WHEN.

## Goal (read this first, every session, every cycle)

Ship the user-configurable scale engine described in `docs/SCALE_ENGINE_PLAN.md`
through Phase 4: a player types a D13 scale string into the scale sheet in
`index.html`, gets a generated chord deck rendered by the existing card
renderer, and can share it by URL, with the three built-in decks reproduced by
the engine fixture-for-fixture and every existing invariant, floor and mutant
still green. Phases 5 and 6 (persistence polish, print) follow once the Phase 4
exit holds.

NON-goals: changing any built-in deck datum or diagram geometry; changing the
visual system; adding a build step or external JS; spaced repetition, PWA,
audio (roadmap items, separate work); rewriting existing tests; altering the
plan's OWNER DECISIONS D1-D14.

## Hard rules

1. Only the main agent merges. Lanes NEVER deploy, merge, or touch shared infra.
2. The main agent is the sole writer of this doc; lanes return reports and never
   edit it. Every PR passes `/review` by a non-author reviewer before merge, and
   the verdict is recorded in the Review log.
3. File ownership per the Ownership table. Crossing a boundary is a queue row
   asking the owner, never a direct edit.
4. No deploys mid-batch. (Nothing here deploys; GitHub Pages serves main.)
5. Delivery is PR-based, CI green at the verified head SHA, branch
   `scale-engine/w<N>-<slug>`.
6. Lanes run local suites as smoke tests only; CI at the head SHA is the evidence.
7. **ERROR PROTOCOL:** on any error or blocker, re-read the Goal, make the
   smallest adjustment that still serves it, record the blocker in the return
   report, and keep working whatever is unblocked. The goal never changes
   without the operator.
8. Project rules: never alter deck data or diagram geometry; `index.html` stays
   a single self-contained file; test at 380 px; `tests/CONTRACT.md` applies to
   every test added. Never `--amend`, never force-push, never `--no-verify`.
9. Lanes run on Opus (operator directive 2026-09-08); the reviewer runs on the
   session model, which is never weaker.

## Ownership

| Lane | Branch namespace | Owns | Never touches | Worktree |
|---|---|---|---|---|
| P0a spec | `scale-engine/w1-spec` | `docs/ENGINE-SPEC.md`, `tests/fixtures/qualities.json`, `tests/fixtures/parents.json`, `tests/fixtures/synthetic_scales.json` | everything else | agent-managed |
| P0b corpus | `scale-engine/w2-corpus` | `tests/fixtures/golden_decks_v1.json`, `tests/test_fixture_integrity.py` | everything else; its `f_*` mutant is P0b2 | agent-managed |
| P0c harness | `scale-engine/w3-harness` | `tests/helpers/sandbox.js`, `tests/helpers/engine.js`, `tests/mutation_check.sh`, `tests/suite_health.py`, `tests/CONTRACT.md`, `.github/workflows/validate.yml`, `tools/regen_data_mutants.py` (the `--check` flag only) | `index.html`, `tools/decks.py`, `tools/hifi.py`, fixtures, `src/` | agent-managed |
| P0b2 corpus mutant | `scale-engine/w4-corpus-mutant` | `tests/mutants/f_*` | everything else | agent-managed |
| P0d core | `scale-engine/w5-core` | `src/engine/core.js`, `tests/core.test.js`, `tests/mutants/u_*`, its own row in `suite_health.py` FLOORS | everything else | agent-managed |
| 1A voicing | `scale-engine/w6-voicing` | `src/engine/voicing.js`, `tests/voicing.test.js`, `tests/mutants/v_*`, own floor row | everything else | agent-managed |
| 1B layout | `scale-engine/w7-layout` | `src/engine/layout.js`, `tests/layout.test.js`, `tests/mutants/g_*`, own floor row | everything else | agent-managed |
| 1C naming | `scale-engine/w8-naming` | `src/engine/naming.js`, `tests/naming.test.js`, `tests/mutants/n_*`, own floor row | everything else | agent-managed |
| 2 select | `scale-engine/w9-select` | `src/engine/select.js`, `tests/select.test.js`, `tests/mutants/s_*`, `tests/fixtures/divergence_v1.json`, own floor row | everything else | agent-managed |
| 3a app plumbing | `scale-engine/w10-app-plumbing` | `tools/inline_engine.py`, `tools/validate.py`, `tests/paths.py`, `tests/helpers/sandbox.js` (round 2), engine regions + registry in `index.html`, regenerated `tests/mutants/b_*`, `tests/mutants/b_engine_desync.patch`, `tests/app.test.js` | `src/engine/*`, `tools/decks.py`, `tools/hifi.py` | agent-managed |
| 3b scale sheet | `scale-engine/w11-scale-sheet` | sheet UI in `index.html`, `tests/app.test.js`, `tests/e2e.test.js`, `tests/mutants/d_*`, `tests/mutants/e_*`, `CLAUDE.md`, `README.md` | `src/engine/*`, tools | agent-managed |
| 4 share | `scale-engine/w12-share` | `src/engine/share.js`, `tests/share.test.js`, `tests/mutants/h_*`, share + Edit sheet in `index.html`, `tests/app.test.js`, `tests/e2e.test.js`, own floor row | everything else | agent-managed |
| 5, 6 | assigned when Phase 4 exit holds | per plan | | |

## Sequencing

1. **Wave 1 (parallel): P0a, P0b, P0c.** Disjoint files. P0b ships no mutant
   (an `f_*` prefix is "unknown suite" to the current `mutation_check.sh` and
   would fail P0b's own CI); the mutant is P0b2.
2. **Wave 2 (parallel, after P0a + P0b + P0c merged): P0d, P0b2.**
3. **Wave 3 (parallel, after P0d): 1A, 1B, 1C.** Owner review of ENGINE-SPEC
   DEFAULTs is a plan gate after Phase 1; the operator is afk and has delegated
   it to the main agent's recommendation (recorded when reached).
4. **Wave 4: 2 select** (after 1A + 1C).
5. **Wave 5: 3a** (after 2 + 1B), then **3b** (after 3a). Serial on `index.html`.
6. **Wave 6: 4 share** (after 3b).
7. **Wave 7: 5, 6** (after Phase 4 exit; briefs written then).

Merge gate every PR: `gh pr view` verifies head SHA; fresh `swarm-reviewer` at
that SHA reads CI; PASS or PASS_WITH_NITS merges (squash via `gh pr merge
--merge` to keep the trailers); FAIL bounces to the authoring lane, two-attempt
cap per lane. Milestone receipts (contract §8) by the main agent: after wave 2,
`node -e` parse of the three maker strings against the golden fixture; after
wave 5, a 380 px render of a generated deck through the sandbox; after wave 6,
a share URL round-trip in the sandbox.

Acceptance commands are copied verbatim from the plan's "Acceptance commands
per lane" table. `ALL` there is the CI baseline. Local smoke test prerequisites
on this machine: `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
for the e2e suite; reportlab + pymupdf are installed for the system python3.

## Briefings (main-agent-maintained; source text for spawn prompts)

### P0a spec
Why: every later lane asserts against the spec and its fixtures; without them
the engine lanes would each invent a different rule set.
NEXT:
1. Write `docs/ENGINE-SPEC.md` from the plan's P0a row (plan line 367) and the
   OWNER DECISIONS table: every rule a `- ` bullet tagged `DECIDED(D<n>)` or
   `DEFAULT[owner-review]`; result contract `{ok, value | code, reason}`;
   warnings `[{code, reason}]`; codes NO_DING, NO_FIFTH, TOO_MANY_RIM,
   BAD_NOTE, NEEDS_NEWER_APP, NO_THIRDS with reason strings; deck object shape
   with `chords[] = {main, sup, subtitle, fields[], roots[]}`; the D13 grammar
   with octave inference (restart after `|`), zone assignment (rim <= 11, then
   inner <= 2, bottom <= 6 after `|`); D10 parent list and distance; cap 25;
   the D14 hash function (FNV-1a 32-bit over UTF-8 of `formatSeed`, hex,
   `custom:` prefix); the element ids listed in the plan's open-decisions row.
2. `tests/fixtures/qualities.json`: quality name -> intervals + display strings
   for every quality the 59 cards use plus the D1 vocabulary.
3. `tests/fixtures/parents.json`: the 11 candidate parents in fixed order with
   intervals and a short display name (<= 8 chars, e.g. HIJAZ for Phrygian
   dominant).
4. `tests/fixtures/synthetic_scales.json`, schema
   `{name, string, expect: {ok: true, warnings?: [code]} | {code}, tags: []}`,
   entries per the plan's P0a row (12-note pan, 19-field max, whole-tone ->
   NO_FIFTH, octatonic diminished, augmented hexatonic, {C,G,D} -> ok +
   NO_THIRDS, no ding -> NO_DING, ding pitch class absent from top shell -> ok,
   at least one entry with bottom notes after `|`, one 14-top-note -> TOO_MANY_RIM,
   one bad token -> BAD_NOTE).
Acceptance: `ALL && python3 -c "import json;json.load(open('tests/fixtures/qualities.json'));json.load(open('tests/fixtures/synthetic_scales.json'));json.load(open('tests/fixtures/parents.json'))" && ! grep -nE '^- ' docs/ENGINE-SPEC.md | grep -vE 'DECIDED\(|DEFAULT\[owner-review\]' && for c in NO_DING NO_FIFTH TOO_MANY_RIM BAD_NOTE NEEDS_NEWER_APP NO_THIRDS; do grep -q "$c" docs/ENGINE-SPEC.md || exit 1; done`

### P0b corpus
Why: freezes the 59 cards so no engine test reads the live `DECKS` literal.
NEXT:
1. `tests/fixtures/golden_decks_v1.json`: for each built-in deck `id, name,
   colors, degrees, geom, fields, chords, maker_string` (the D13 string that
   parses to the fields; explicit octaves on bottom notes, e.g. Pygmy `| C3 Db3 Eb3 Bb3 Db4 Ab5`)
   plus a top-level `sha256` over the canonical serialisation of the rest
   (`json.dumps(obj, sort_keys=True, separators=(",", ":"))`).
2. `tests/test_fixture_integrity.py`: asserts the sha matches, 59 chords, and a
   one-way check that fixture chords/fields equal `paths.app_decks()` per deck.
Acceptance: `ALL && python3 -m unittest tests.test_fixture_integrity`

### P0c harness
Why: later lanes add `src/engine` mutants, new test files and new prefixes;
the current gate cannot revert or select them.
NEXT: the plan's P0c row (line 369) verbatim, plus `tools/regen_data_mutants.py
--check` (exit non-zero when any `b_*` patch no longer applies; no other flag).
Floors: convert to `FLOORS = {path: min}` with the three legacy floors unchanged
in aggregate and rows at 0 for core/voicing/layout/naming/select/share test
files. `mutation_check.sh`: `# suite:` header wins over prefix table; revert
with `git apply -R` + scoped `git checkout --`/`git clean -fd` on the paths the
patch names; assert clean tree after each mutant; keep every existing mutant
killed. `sandbox.js`: stubs listed in the row; `boot_sim.js` and
`dump_app_render.js` stay green. `CONTRACT.md` edits per the row. Add the
rule-2 carve-out. Do NOT raise floors.
Acceptance: `ALL && python3 -c "import tests.suite_health as h;assert isinstance(h.FLOORS,dict) and 'tests/app.test.js' in h.FLOORS" && grep -q 'suite:' tests/mutation_check.sh && python3 tools/regen_data_mutants.py --check`

### P0d core
Why: every Phase 1 lane imports `HPE.core`; this is the serial dependency of wave 3.
Read first: `docs/ENGINE-SPEC.md` sections 1-4 (result contract, code enum and
reason strings, D13 grammar, zones/ids/caps), 12 (deck identity, `formatSeed`,
`deckId`), 16 (fixture schemas), 17 (degenerate cases); `tests/CONTRACT.md`;
`tests/helpers/engine.js`; queue rows 5, 6, 7, 10, 12, 14 below.
NEXT:
1. `src/engine/core.js`, plain script per row 12 (`var HPE = (typeof HPE !== 'undefined') ? HPE : {}`,
   no require/import/export), exporting `HPE.core = {parseSeed, formatSeed, deckId,
   REASONS, ...helpers}`. `parseSeed(string, options?)` returns the section 1
   result shape: `{ok:true, value:{fields, options}}` or `{ok:false, code, reason}`;
   fields map `{id: [name, octave, midi, zone, angle, label]}` with `angle` null,
   ids `"0"` (ding), `"1".."N"`, `"101".."106"`, labels `Ding`, `1..N`, `U1..U6`;
   options default `{palette:0, parent:null, name:'', mirror:false}`. Grammar per
   section 3: whitespace tokenisation, ding `(D3)` first (ding tokens counted first,
   NO_DING if none or not first; omitted ding octave 3), letter-anchored MIDI
   `12*(octave+1)+letter+accidental`, octave inference strictly ascending after
   inference else BAD_NOTE, bottom inference after `|` restarts nearest the ding
   with tritone/same-pc ties below. Zones per section 4 and row 7: first 11 top
   notes rim, next 2 inner, 14th TOO_MANY_RIM, bottom max 6. Caps per row 5 (19
   fields excluding the ding). `formatSeed(seed)` returns the canonical string with
   explicit octaves; `deckId(fields)` = `custom:` + FNV-1a 32-bit hex over UTF-8 of
   `formatSeed` of the fields only (options never hashed). `HPE.core.REASONS`
   embeds the section 2 table verbatim (row 6).
2. `tests/core.test.js` via `loadEngine(['src/engine/core.js'])`: parses the three
   maker strings from `tests/fixtures/golden_decks_v1.json` to the fixture fields on
   `name, octave, midi, label` for all three and `zone` for Hijaz and Amara only;
   asserts explicitly that the Pygmy string yields 11 rim from the grammar (row 7);
   `parseSeed(formatSeed(x.value)).value` deep-equals `x.value` for every ok
   synthetic entry; every synthetic entry parses or rejects with its `expect`;
   `deckId` unchanged across every option change and different for any field
   change; `REASONS` deep-equals the section 2 table (rule-2 carve-out).
3. `tests/mutants/u_*.patch`, one per group, each with a `# suite: node --test tests/core.test.js`
   header: drop the ding octave, drop the `|`, hash the palette into `deckId`, wrong
   zone boundary, wrong accidental MIDI, non-ascending accepted.
4. Raise ONLY the `tests/core.test.js` row in `tests/suite_health.py` FLOORS to the
   count you land. Never touch another row or the LEGACY_* lines.
Acceptance: `ALL && node --test tests/core.test.js && ./tests/mutation_check.sh 2>&1 | grep -E '^u_' | grep -vq survived`
Owns: `src/engine/core.js`, `tests/core.test.js`, `tests/mutants/u_*`, the one FLOORS row. Never: `index.html`, fixtures, `docs/ENGINE-SPEC.md` (spec ambiguities go in the report as blockers, the integrator decides), other test files.

### P0b2 corpus mutant
Why: P0b shipped no mutant because the pre-P0c gate could not select an `f_` suite.
NEXT:
1. `tests/mutants/f_fixture_sha.patch` with header `# suite: python3 -m unittest tests.test_fixture_integrity`,
   flipping one chord field in `tests/fixtures/golden_decks_v1.json` so the sha
   check fails. Output line must read `f_fixture_sha.patch killed`.
2. Row 9 nits in `tests/test_fixture_integrity.py`: partition the maker-string token
   test on `|`; add `name`/`sub` to the deep-equality tuple; pin the
   `EXPECTED_SHA256` constant (row 3); dedupe `CHORD_COUNTS` via `tests/paths`.
3. Raise ONLY the `tests/test_fixture_integrity.py` FLOORS row to the count landed.
Acceptance: `ALL && python3 -m unittest tests.test_fixture_integrity && ./tests/mutation_check.sh 2>&1 | grep -q 'f_.*killed'`
Owns: `tests/mutants/f_*`, `tests/test_fixture_integrity.py`, that FLOORS row. Never: the fixture bytes (sha stays 0475970330455878d252ae6695ddf92138f384cae5cb08f68f91a575a58ad16a), `src/`, other tests.

### Shared preamble for every Phase 1 lane (1A, 1B, 1C)
Read first: `docs/ENGINE-SPEC.md` sections 1 (result contract), 16 (fixture
schemas), 17 (degenerate cases) plus the lane's own sections below;
`tests/CONTRACT.md`; `tests/helpers/engine.js` (header comment = module
convention); `src/engine/core.js` and `tests/core.test.js` as the worked
example of a shipped lane. Rules that bit P0d (queue rows 12, 16, 17):
- Plain script, `var HPE = (typeof HPE !== 'undefined') ? HPE : {}`, wrapped
  in an IIFE that attaches `HPE.<module> = {...}`. No require/import/export,
  no TextEncoder, no ES features the vm rejects (ES2015 is fine).
- Load in tests via `loadEngine(['core', '<module>'])` (module NAMES; engine.js
  joins `src/engine/<name>.js`; core loads first so `HPE.core` is visible).
- Engine values live in a node:vm realm: normalise through
  `JSON.parse(JSON.stringify(v))` before `assert.deepStrictEqual`.
- Every mutant patch: `tests/mutants/<prefix>_<slug>.patch`, first line
  `# suite: node --test tests/<module>.test.js`, generated with `git diff`
  against the committed file, one behaviour change each. Run
  `./tests/mutation_check.sh` on a CLEAN tree (it refuses otherwise) and read
  the `<name> killed` lines; `survived`, `stale` and `broken` all fail you.
- Raise ONLY your own row in `tests/suite_health.py` FLOORS (seeded at 0) to
  the exact count you land. Never another row, never LEGACY_*.
- Fixture bytes are read-only (golden sha 0475970330455878d252ae6695ddf92138f384cae5cb08f68f91a575a58ad16a).
  Spec ambiguities: pick the reading closest to a DECIDED rule, record it in
  the report's blockers/notes, never edit `docs/ENGINE-SPEC.md`.
- `ALL` (CI baseline) = `python3 tools/validate.py && node tools/boot_sim.js && python3 -m unittest discover -s tests -t . && node --test tests/*.test.js && python3 tests/suite_health.py && ./tests/mutation_check.sh`.
  Local e2e/`e_` mutants may skip or flake on this machine (rows 13, 15); CI at
  your final SHA is the evidence.

### 1A voicing
Why: `select.build` (wave 4) calls `HPE.voicing` for every candidate; the
59-card containment gate is the plan's Premise 2 proof.
Read: ENGINE-SPEC sections 5 (legality), 6 (D2 cluster rule, D11 tie-break,
Fm9 exception, containment gate), 7 (D9 root octave, recorded exceptions,
HIGH/LOW alternates are data); plan Premises 2, 3, 5 (lines 29-118).
NEXT:
1. `src/engine/voicing.js` exporting `HPE.voicing = {candidates, choose, rootField, isLegal, ...}`:
   `candidates(fields, rootPc, intervals)` enumerates every legal voicing
   (arrays of field ids as NUMBERS in chord-spelling order root,3,5,7,9,11,13
   per section 5 DEFAULT) for a pitch-class interval set over a `fields` map
   (section 11 shape, ids as strings): ding never included, no two fields of
   one pitch class, power chord = exactly root+5th, at most 6 notes with the
   lowest optional extension dropped first (9 before 11 before 13; chord tones
   never dropped). `rootField(fields, rootPc)` per D9: lowest top-shell
   instance, else lowest overall. `choose(fields, rootPc, intervals, opts?)`
   applies D2/D11: forced test = ANY non-root tone (chord tone or extension)
   has no instance above the root field; forced -> chord tones to highest
   instance below the root (bottom shell counts), stay put if none; extensions
   keep nearest above unless themselves forced; not forced -> every tone
   nearest instance above the root. Returns `{ok:true, value:{fields:[ids],
   roots:[rootId]}}` or `{ok:false, code, reason}` using ONLY
   `HPE.core.REASONS` codes (no new codes; if no legal voicing exists return
   an empty candidate list and let `choose` report that in a way the spec
   allows, and record the reading).
2. `tests/voicing.test.js`: for all 59 chords in `tests/fixtures/golden_decks_v1.json`,
   derive (root pc, interval set) from the fixture's `roots[0]` and `fields`
   midis and assert the fixture `fields` tuple is a member of `candidates`
   (59/59). Assert `choose` equals the fixture for 58/59 with Pygmy `Fm9` the
   declared TWO-SIDED exception (assert it differs, G4 vs fixture G5). Exclude
   nothing else; the D9 root-octave exceptions (Pygmy `Db`, `Dbmaj7`, `Eb7`)
   and the five HIGH/LOW alternates are NOT excluded from containment, only
   handle them the way section 7 says: if `choose` cannot reproduce them,
   assert containment and record each as a two-sided exception in the test
   with the section 7 citation. Legality invariants over every ok entry of
   `tests/fixtures/synthetic_scales.json` for every (root pc, quality) pair in
   `tests/fixtures/qualities.json`: no ding, no doubled pc, power = 2, <= 6
   notes. Determinism: same input, same output.
3. `tests/mutants/v_*.patch`, one per group, `# suite: node --test tests/voicing.test.js`:
   ding allowed in a voicing; doubled pitch class allowed; forced test ignores
   extensions; clustered tone takes lowest (not highest) lower instance;
   nearest-above becomes any-above; 7-note voicing allowed; root octave takes
   highest top-shell instance.
4. Raise the `tests/voicing.test.js` FLOORS row.
Acceptance: `ALL && node --test tests/voicing.test.js && ./tests/mutation_check.sh 2>&1 | grep -E '^v_' | grep -vq survived`
Owns: `src/engine/voicing.js`, `tests/voicing.test.js`, `tests/mutants/v_*`, that FLOORS row. Never: `core.js`, `index.html`, fixtures, spec, other tests.

### 1B layout
Why: 3a inlines `HPE.layout.solve` for every generated deck; `pan()` NaNs on
any missing geom key (plan lines 259-267).
Read: ENGINE-SPEC sections 4 (zones are core's, `layout.solve` never changes a
zone), 11 (deck object; FULL geom shape, `ext` derived for generated decks
only), 16 (lane B builds its own N=5..19 sweep); plan D7 and D12 (lines
129, 134), "pan() does not generalise" (259-267); `pan()` in `index.html`
lines 155-218 for the exact geom keys consumed (`rim, inner, bottom, r_ding,
ding_dy, r_note, r_bnote, inner_ring, f_ding, f_note, f_bnote, f_num, n_in,
n_out, rim_num_out`) and the built-in literals (Hijaz/Amara/Pygmy `geom`).
NEXT:
1. `src/engine/layout.js` exporting `HPE.layout = {solve, ...}`.
   `solve(seedOrFields, options?)` takes the section 1 parse value (fields
   with `angle` null) and returns `{ok:true, value:{geom, fields}}` where
   `fields` is the same map with every `angle` filled (ding stays null) and
   NO zone changed, or `{ok:false, code:'TOO_MANY_RIM', reason}` (from
   `HPE.core.REASONS`) beyond 11 rim / 2 inner / 6 bottom. D12 default
   geometry: ding `r_ding=0.19`, `ding_dy=0.1425` (toward the player); rim
   zig-zag right-first ascending from ~290 deg toward top centre (mirror of
   the Pygmy pattern; `options.mirror` true flips to left-first, i.e. the
   Hijaz/Amara pattern); inner ring at most 2 at ~128/~52 deg ascending
   OPPOSITE to the rim direction; bottom ring dashed, at most 6, as an outer
   ring in x-ray view. `r_note`, `f_note`, `f_num`, `n_in`, `n_out`, `r_bnote`,
   `f_bnote` are functions of N (fit the built-in values at N=8 and N=11 as
   anchors; never shrink below the stroke-aware D7 ceiling reasoning). ALWAYS
   emit every key above, zeroes/false where a zone is empty (never a missing
   key, never `null` except where a built-in uses null for `inner_ring`
   deliberately; prefer 0). Emit `ext` = furthest drawn element (outermost
   circle edge + its number label offset) as an extra geom key for generated
   decks; built-ins never call `solve`.
2. `tests/layout.test.js`: generate the N=5..19 sweep yourself from the
   12-note and 19-field synthetic entries (parse via `HPE.core.parseSeed`,
   truncate/extend top and bottom lists); for every N assert: no two field
   circles closer than r1+r2 (angles in degrees, radii in R units, ding
   included with its dy offset); every field circle and its number label
   inside `ext`; inner pair ascends opposite the rim; all geom keys present
   and finite; zones untouched (deep-equal the zone column before/after);
   `mirror` reflects every angle about the vertical axis; a 20th non-ding
   field is rejected `TOO_MANY_RIM`; determinism.
3. `tests/mutants/g_*.patch`, `# suite: node --test tests/layout.test.js`:
   inner pair ascends WITH the rim; overlap check disabled by shrinking radii
   to 0; `ext` fixed at 1.06; a geom key dropped; mirror ignored; zone
   rewritten by solve; bottom cap 7.
4. Raise the `tests/layout.test.js` FLOORS row.
Acceptance: `ALL && node --test tests/layout.test.js && ./tests/mutation_check.sh 2>&1 | grep -E '^g_' | grep -vq survived`
Owns: `src/engine/layout.js`, `tests/layout.test.js`, `tests/mutants/g_*`, that FLOORS row. Never: `core.js`, `index.html` (do not touch `pan()`; 3a adapts it), fixtures, spec, other tests.

### 1C naming
Why: `select.build` (wave 4) calls `HPE.naming` for every card's `main`,
`sup`, `subtitle` and the deck's `degrees` map.
Read: ENGINE-SPEC sections 9 (quality table is the spec; main/sup split;
subtitle <= 26 and chord name <= 16; rooted flag; recorded editorial
exceptions; Hijaz `Dmaj7`/`Dmaj7#11` excluded), 10 (D8 numerals, D10 case,
parents list order, distance rule, index override, NO_THIRDS uppercase,
outside-parent `bN`/`#N` naming), section 3 DEFAULT at line 219 (accidental
spelling is the user's typed spelling, never re-spelled), section 8 lines
408-410 (symmetric-set root tie-break DEFAULT: tonic, else lowest scale
degree); queue row 4 (qualities.json keyed on the FULL suffix, e.g. `m7b5`,
with `main_suffix`/`sup` split).
NEXT:
1. `src/engine/naming.js` exporting `HPE.naming = {QUALITIES, PARENTS, name, subtitle, inferParent, degrees, ...}`:
   `QUALITIES` and `PARENTS` are literals equal to `tests/fixtures/qualities.json`
   and `tests/fixtures/parents.json` (tests deep-equal them; rule-2 carve-out
   as core did for REASONS). `name(rootName, suffix)` -> `{main, sup}` =
   root spelling + `main_suffix`, `sup`. `subtitle(rootName, suffix, equiv?)`
   -> `<ROOT> <DISPLAY>` when `rooted`, bare `<DISPLAY>` otherwise, plus
   ` ( = X6 )` / ` ( = Xm6 )` equivalence for m7 / m7b5 when the 6-chord
   collapse applies (section 5); hard-assert <= 26 chars and name <= 16.
   `inferParent(pitchClasses, tonicPc)` -> index 0-10 by section 10 distance
   with list-order tie-break. `degrees(fields, tonicPc, parentIndex, opts?)`
   -> `{"<pc>": label}` for every pan pitch class: D8 numerals (minor-relative
   when the pan has a minor third above the tonic, else major-relative with
   flats), D10 case from stacked thirds over the parent, `°` for a diminished
   fifth, outside-parent pcs as `bN`/`#N` per the section 10 rule, all
   uppercase and no D10 when `opts.noThirds`. Symmetric-set root tie-break
   helper per section 8 DEFAULT.
2. `tests/naming.test.js`: for all 59 fixture chords reproduce `main`, `sup`
   and `subtitle` modulo the recorded two-sided exception list (assert the
   exceptions DIFFER): `HIJAZ SIGNATURE CHORD`, ` - HIGH VOICING` /
   ` - LOW VOICING` subtitles, the two `( = X6 )` equivalences if your
   generated form differs, Hijaz `Dmaj7` and `Dmaj7#11` `(NO 5)` cards
   excluded entirely per section 9. Reproduce every `degrees` label of all
   three decks with Amara `bIII`/`bVII` (D8) and `IV` (D10) as two-sided
   frozen exceptions; assert the inferred parents are Phrygian dominant /
   Aeolian / Aeolian with the Amara Aeolian-Dorian tie won on list order.
   Over every ok synthetic entry: deterministic naming on the octatonic and
   augmented-hexatonic seeds, D10 inference on each seed, the parent override
   index flipping case, uppercase throughout under `noThirds`. Deep-equal
   `QUALITIES`/`PARENTS` to the fixtures. Every subtitle in the table for a
   two-character root fits 26.
3. `tests/mutants/n_*.patch`, `# suite: node --test tests/naming.test.js`:
   parents list order swapped (Dorian before Aeolian); distance counts parent
   notes not on the pan instead; major-relative numerals always; case from
   the pan instead of the parent; subtitle cap 25; rooted flag ignored;
   `sup` folded into `main`.
4. Raise the `tests/naming.test.js` FLOORS row.
Acceptance: `ALL && node --test tests/naming.test.js && ./tests/mutation_check.sh 2>&1 | grep -E '^n_' | grep -vq survived`
Owns: `src/engine/naming.js`, `tests/naming.test.js`, `tests/mutants/n_*`, that FLOORS row. Never: `core.js`, `index.html`, fixtures, spec, other tests.

### 2 select
Why: the first module that produces a whole deck; Phase 3 renders exactly its
output. Depends on merged `HPE.core`, `HPE.voicing` (PR #15), `HPE.naming`
(PR #16), and consumes `HPE.layout` (PR #17) for `geom` and angles.
Read: ENGINE-SPEC sections 1, 5 (collapse rules, 6-note trim), 7 (D9 root
octave: `voicing.rootField`), 8 (candidates by `tier`, non-ding rule,
extended-only-on-top-shell, cap 25, ranking, symmetric tie-break, canonical
order, overrides, equivalence annotations), 9-10 (call `HPE.naming`; never
re-implement), 11 (deck object, EXACT key set), 12 (`core.deckId`), 13
(palette table, mirror, name `""` = auto), 16 (`select_warnings`,
divergence schema below), 17; plan Phase 2 (lines 389-406), Premise 4
(89-118), acceptance row `2 select`. Queue rows 10, 14, 16, 17, 23, 24.
NEXT:
1. `src/engine/select.js` exporting `HPE.select = {build, candidates, rank, collapse, ...}`.
   `build(seed)` takes the `core.parseSeed(...).value` shape (`{fields, options}`)
   and returns `{ok:true, value:<deck>, warnings:[...]}` or `{ok:false, code, reason}`
   using only `HPE.core.REASONS` codes. The deck has EXACTLY the section 11
   keys `id, name, options, colors, degrees, geom, fields, chords, warnings`:
   `id = HPE.core.deckId(seed)`; `name` = user name if `options.name` is
   non-empty, else the auto name `<DING PC NAME> <PARENT display> <N>` where N
   counts TOP-SHELL fields including the ding (section 13 D5A; uppercase; at
   most 16 chars, ellipsised with `…` beyond that; the ding pitch class is
   spelled as the seed spells it); `options` = `{palette, mirror, parent}` with
   `parent` the inferred index when the seed's parent is null; `colors` from
   the section 13 palette table with `ga == root`, `gb == tone`; `degrees` from
   `HPE.naming.degrees` over every pan pitch class with the tonic = ding pc;
   `geom` and per-field angles from `HPE.layout.solve(fields, options)`, which
   returns the RESULT type `{ok, value:{geom, fields}}` (row 25; propagate a
   not-ok result unchanged; copy angles into `fields[id][4]`, ding angle stays null); `chords[]` entries
   EXACTLY `{main, sup, subtitle, fields, roots}` with ids as NUMBERS.
   Pipeline: for every root pc present on a non-ding field and every quality
   whose tier is a candidate tier, keep it iff every interval pc is on a
   non-ding field (extended tier: on the TOP shell); collapse coinciding pitch
   sets (sus2 -> sus4, 6 -> m7, m6 -> m7b5; symmetric sets by section 8
   tie-break via `HPE.naming.symmetricRoot`); voice with
   `HPE.voicing.choose(fields, rootPc, intervals)` (pc only, NOT the root
   field; row 23), which returns the RESULT type: use `.value.fields` /
   `.value.roots` and treat a not-ok result as "drop this candidate" (row 31;
   `isLegal` checks note count only, not pitch classes, so do not use it as a
   pitch-class guard); drop any candidate whose `choose` is not ok; dedup on
   identical `fields` list; rank per section 8 and trim to 25; order per the
   canonical order; name each with `HPE.naming.name` / `HPE.naming.subtitle`
   (equivalence annotation for m7 / m7b5 derived mechanically per D4).
   Warnings: `NO_THIRDS` when no root has a third above it on the top shell
   (`{C,G,D}` fixture yields it; a diatonic pan yields none). Determinism:
   same seed, same deck, byte-for-byte after JSON round-trip.
2. `tests/fixtures/divergence_v1.json`, schema
   `{"version":1, "decks": {"<builtin id>": {"missing": [<card main+sup the engine does not produce>], "extra": [<generated main+sup not in the built-in>], "overrides": [{"main","sup","subtitle","fields","roots","note"}]}}}`.
   Populate it by RUNNING `build` on the three built-in seeds from
   `tests/fixtures/golden_decks_v1.json` (`maker_string` via `core.parseSeed`)
   and diffing against the fixture chords by (main, sup, fields). `overrides`
   holds the built-ins' out-of-vocabulary / hand-authored cards: at least
   Hijaz `Dmaj7` and `Dmaj7#11` `(NO 5)`, the five HIGH/LOW alternates, and
   whatever else the diff surfaces; each with a one-line `note` citing the
   spec section. NO numeric expectation anywhere.
3. `tests/select.test.js`: (a) diff test: for each built-in, the generated
   deck's (main, sup, fields) set vs the fixture equals exactly the committed
   `missing`/`extra` (the table can only shrink: a two-sided test asserts each
   `missing` entry is really absent and each `extra` really present);
   (b) deck object key set and `chords[]` key set exact, ids numeric, ding
   angle null, `colors.ga === colors.root`; (c) `id` equals
   `core.deckId(seed)` and is unchanged when every option changes;
   (d) `twelve note pan` fixture entry: 29 raw candidates, 27 after collapse,
   25 after cap (section 8 worked example), and the cap bites; (e) ranking
   order and sus2/6/m6 collapse asserted on a synthetic pan; (f) `{C,G,D}`
   yields ok + `NO_THIRDS`; every `synthetic_scales.json` ok row's
   `select_warnings` matches; (g) every emitted voicing passes
   `HPE.voicing.isLegal`; (h) auto name for the three built-in seeds
   (`C# HIJAZ 9`, `F PYGMY 18`? -> assert whatever section 13 yields and
   record it; `D AEOLIAN 9` is fixed by the spec) and the 16-char ellipsis on
   the 12-note pan; (i) determinism. Normalise vm values through JSON (row 16).
4. `tests/mutants/s_*.patch` (`# suite: node --test tests/select.test.js`):
   cap removed or widened; ranking tier order swapped; sus2 survives collapse;
   6-chord survives; `NO_THIRDS` never emitted; extended allowed off the top
   shell; ding-only pitch class allowed as a root; dedup dropped.
5. Raise only the `tests/select.test.js` FLOORS row.
Acceptance: `ALL && node --test tests/select.test.js && ./tests/mutation_check.sh 2>&1 | grep -E '^s_' | grep -vq survived`
Owns: `src/engine/select.js`, `tests/select.test.js`, `tests/mutants/s_*`, `tests/fixtures/divergence_v1.json`, that FLOORS row. Never: other `src/engine/*`, `index.html`, other fixtures, spec, other tests. Readings that the spec leaves open go in the return report, not the spec.

### 3a, 3b, 4
Written when their wave opens, from the plan rows and the acceptance table.

### 2b select cap (follow-up to lane 2)
Why: the owner amended section 8's card cap on 2026-09-09 from a flat 25 to a
size-scaled formula. `src/engine/select.js` still implements the flat 25.
Read: `docs/ENGINE-SPEC.md` section 8, specifically the bullet
`DECIDED(owner-review 2026-09-08, replacing the earlier DEFAULT of a flat 25)`
and the worked-example paragraph directly above it; `src/engine/select.js` as
merged; `tests/select.test.js` case (d) (the 29/27/25 worked example) and the
divergence test; `tests/fixtures/divergence_v1.json`. Queue rows 33 and 36.
NEXT:
1. In `src/engine/select.js`, replace the flat cap with
   `cap = 25 + Math.max(0, fieldCount - 12)` where `fieldCount` is the number of
   entries in the deck's `fields` map - EVERY field, ding, rim, inner and bottom
   alike. Nothing else about ranking, collapse, dedup or canonical order changes;
   only the trim point moves. Do not introduce a new export unless a test needs
   it; if you do export the cap function, name it `cap` and keep `build` the
   entry point.
2. Update `tests/select.test.js`:
   - Case (d) must still assert 29 raw / 27 collapsed / 25 after cap on the
     `twelve note pan` synthetic entry, and must ALSO assert that entry has
     exactly 12 fields and that the cap evaluates to 25 there. That is the
     regression guard that the amendment did not move the worked example.
   - Add a case asserting the cap on a larger pan: the built-in Pygmy seed has
     18 fields, so its cap is 31, and the generated Pygmy deck must now contain
     `Gm7b5`, `Bbm7` and `Cm7` (they ranked 27/28/29 under the flat cap).
   - Add a case pinning the formula at the structural maximum: the 19-field /
     20-field synthetic maximum entry in `tests/fixtures/synthetic_scales.json`
     (use whichever entry is actually there; do not invent one) and assert
     `cap === 25 + fieldCount - 12`.
3. REGENERATE `tests/fixtures/divergence_v1.json` by RUNNING `build` on the
   three built-in seeds and re-diffing, exactly the way lane 2 populated it.
   Pygmy's `missing` list shrinks by at least those three cards. Keep the
   existing `overrides` notes and their spec citations; do not hand-edit
   entries the regeneration does not produce. The divergence test is two-sided,
   so it will fail loudly if you leave a stale row. NO NUMERIC EXPECTATION
   anywhere in the fixture; the test derives everything.
4. Update or add `tests/mutants/s_*.patch` for the new behaviour: at minimum a
   mutant that pins the cap back to a flat 25 must now be KILLED, and one that
   makes the slope 2 per field instead of 1 must be killed. Delete any existing
   `s_*` mutant the amendment makes equivalent (a mutant that "widens the cap"
   may now be indistinguishable) and say in your report which you deleted and
   why. Every patch keeps its `# suite:` header and is regenerated with
   `git diff` against the committed file.
5. Raise the `tests/select.test.js` FLOORS row to the exact count you land.
Acceptance: `ALL && node --test tests/select.test.js && ./tests/mutation_check.sh 2>&1 | grep -E '^s_' | grep -vq survived`
Owns: `src/engine/select.js`, `tests/select.test.js`, `tests/mutants/s_*`,
`tests/fixtures/divergence_v1.json`, that FLOORS row.
Never: other `src/engine/*`, `index.html`, `tools/`, other fixtures,
`docs/` (including the spec - the amendment is already landed, do not touch it),
other tests, other FLOORS rows.

### 3a app plumbing (Phase 3, first half; SERIAL owner of index.html)
Why: this is the first phase that ships to a user. It puts the engine inside the
single-file app and gives 3b a registry to render into. 3a builds NO UI: the
scale sheet, the chip row and the 380px e2e cases are 3b's, and 3b runs serially
after you merge. Keep the diff to plumbing so 3b's diff is legible.
Read: plan `docs/SCALE_ENGINE_PLAN.md` Phase 3 (lines 408-433) and the worktree
table row `3a app plumbing` (line 763); the acceptance row `3a, 3b app`
(line 355); `docs/ENGINE-SPEC.md` sections 11 (deck object) and 12 (`deckId`);
`CLAUDE.md` "Single-file app" and "Known pitfalls" (the data re-injection trap is
the same shape as the inline step); `tools/validate.py`; `tests/paths.py`;
`tests/helpers/sandbox.js`; `index.html` around `pan()` (line 160) and `deck()`.
Queue rows 13, 15, 26.
NEXT:
1. `tools/inline_engine.py`: copies each `src/engine/<name>.js` verbatim into a
   marked region inside `index.html`. Regions are delimited by HTML comments
   carrying the module name so the tool is idempotent and the boundaries are
   greppable. Module order must be `core, voicing, layout, naming, select` so
   `HPE.core` exists before the modules that read it. The engine files are plain
   scripts attaching to a shared `var HPE`, so they inline with no wrapper
   changes. THIS IS A SYNC STEP, NOT A BUILD STEP: `index.html` stays
   independently functional and committed with the engine already inlined; the
   tool only re-syncs it. Say exactly that in the CLAUDE.md/README wording you
   add (that wording is 3b's file though - see Never - so put the sentence in the
   tool's own docstring and record it in your report for 3b to place).
2. Desync check in `tools/validate.py`: fail when a region's content differs from
   the file it was copied from. Ship its killing mutant
   `tests/mutants/b_engine_desync.patch` (ONE character changed inside a region;
   copy the shape of the existing `b_validate_desync.patch`), `# suite:` header
   pointing at the suite that actually catches it.
3. Second deck registry in `index.html` so `deck()` resolves a custom id without
   the `DECKS` literal growing. `validate.py` KeyErrors on any fourth deck in the
   literal and `tests/paths.py` needs the literal to stay ONE LINE, so the
   registry is a separate structure. It maps deck id -> a FULLY GENERATED deck
   object. Generation runs ONCE at submit; never inside `deck()` or `render()`.
   Add the `NEEDS_NEWER_APP` guard now so Phase 4's decoder has it.
4. `save()` persists only BUILT-IN deck ids in this phase: selecting a custom
   deck leaves `store.deck` untouched, so a reload restores the last built-in
   deck rather than silently falling back to Hijaz. Unit test plus a `d_*`
   mutant. Phase 4 lifts the guard.
5. `pan()` at `index.html:160` currently ignores `g.ext` and derives its own
   extent. Make it read `ext` per spec section 11 (queue row 26). Harmless for
   every reachable built-in config today, which is exactly why it needs a test:
   pin it with a generated deck whose solver `ext` differs from the derived one.
6. `tests/helpers/sandbox.js` round 2: whatever the sandbox needs so a unit test
   can drive submit-and-generate without a browser. Keep it a helper, not a
   second app.
7. Generation-time budget tests in Node: the 12-note synthetic deck under 200 ms
   and the 19-field synthetic maximum under 500 ms. Measure `select.build` plus
   registry insertion, not process startup.
8. Regenerate the `d_*` and `e_*` mutants that anchor on `index.html`
   (`python3 tools/regen_data_mutants.py` on a CLEAN tree) and confirm
   `python3 tools/regen_data_mutants.py --check` passes.
9. Raise only the FLOORS rows for the test files you actually add tests to
   (`tests/app.test.js`, and `tests/e2e.test.js` only if you add an e2e case -
   the 380px cases are 3b's).
Local note (queue row 15): `tests/helpers/cdp.js findBrowser()` ignores
`CHROME_BIN`, so `e_*` mutants always skip on macOS locally. That is a known
local-only gap; CI runs them. Do not "fix" cdp.js unless a test you add needs it,
and if you do, say so explicitly in your report - it is shared infrastructure.
Acceptance: `ALL && ! grep -q '<script src' index.html && node --test tests/app.test.js tests/e2e.test.js && python3 tools/regen_data_mutants.py --check`
Owns: `index.html`, `tools/inline_engine.py`, `tools/validate.py`,
`tests/paths.py`, `tests/helpers/sandbox.js`, `tests/app.test.js`,
`tests/e2e.test.js`, `tests/mutants/d_*`, `tests/mutants/e_*`,
`tests/mutants/b_engine_desync.patch`, and only the FLOORS rows for the test
files you touch.
Never: `src/engine/*` (the engine is CONSUMED, never edited - a bug there is a
queue row, not a fix), `tools/decks.py`, `tools/hifi.py`, the deck data literal
`DECKS` (project CLAUDE.md: do not alter deck data or diagram geometry),
`docs/`, `CLAUDE.md`, `README.md` (3b owns the wording), other fixtures, other
tests, other FLOORS rows.
Hard constraints from the project CLAUDE.md, non-negotiable: single-file app, no
bundlers, no frameworks, no external JS, no `<script src>`; preserve the visual
system; test at a 380px viewport; do NOT alter deck data or diagram geometry.

## Status

| Lane | Current branch | State | Last verdict | Last update (UTC) |
|---|---|---|---|---|
| P0a | scale-engine/w1-spec | merged 386a856 | PASS_WITH_NITS (3rd) | 2026-09-08 |
| P0b | scale-engine/w2-corpus | merged 66453e8 | PASS_WITH_NITS | 2026-09-08 |
| P0c | scale-engine/w3-harness | merged d6935d1 | PASS_WITH_NITS (2nd) | 2026-09-08 |
| P0d | scale-engine/w5-core | merged 40ff645 | PASS_WITH_NITS | 2026-09-08 |
| 1B | scale-engine/w7-layout | merged 6467a33 | PASS_WITH_NITS | 2026-09-08 |
| 1C | scale-engine/w8-naming | merged 5c26ae0; follow-up 1C-2 merged ceaac1f | PASS_WITH_NITS (#18) | 2026-09-08 |
| 1A | scale-engine/w6-voicing | merged 4f5137c | PASS_WITH_NITS | 2026-09-09 |
| 2 | scale-engine/w9-select | merged c94b43c | PASS (rebase re-review, #19) | 2026-09-09 |
| 2b | scale-engine/w10-select-cap | returned done, PR #21 verified, review running | - | 2026-09-09 |
| 3a | scale-engine/w11-app-plumbing | returned done, PR #22 verified, review running | - | 2026-09-09 |
| spec | claude/spec-owner-decisions | merged dad182c (owner-gate amendments, docs only) | n/a (integrator, CI green) | 2026-09-09 |
| P0b2 | scale-engine/w4-corpus-mutant | merged 5f03262 | PASS_WITH_NITS | 2026-09-08 |

## Handoff queue (append-only)

| # | From | Ask | Status |
|---|---|---|---|
| 1 | main | P0b's `f_fixture_sha.patch` moves to lane P0b2 after P0c merges (prefix unknown to the pre-P0c gate) | P0b2 spawned |
| 2 | P0b | suite_health.py cannot parse local node output (spec reporter); P0c asked to pin `--test-reporter=tap` | sent to P0c |
| 4 | P0a | qualities.json keyed on the full quality suffix (m7b5), with main_suffix/sup split; the plan's "sup strings" wording was wrong | recorded, lane C brief must say so |
| 5 | P0a | 19-field maximum = 11 rim + 2 inner + 6 bottom EXCLUDING the ding (20 with it); P0d caps must count that way | recorded, P0d brief |
| 6 | P0a | reason-string table lives in ENGINE-SPEC section 2; no runtime reasons fixture is owned by any lane. Decision: P0d embeds the table in core.js as `HPE.core.REASONS` and tests/core.test.js deep-equals it to the spec table (rule-2 carve-out) | decided, P0d brief |
| 7 | reviewer #9 | Pygmy has 11 top notes (9 rim + 2 inner) but the D13 grammar has no inner marker and P0d's zone rule makes all 11 rim, so P0d's built-in exit on `zone` is unsatisfiable for Pygmy. DECISION (integrator, afk authority): D13 grammar stays as decided; grammar zones apply to GENERATED decks only (D12: built-in geom literals bypass the solver). P0d's built-in exit compares `name, octave, midi, label` for all three pans and `zone` only for Hijaz and Amara; tests/core.test.js asserts explicitly that the Pygmy string yields 11 rim from the grammar and documents why. | decided, P0d brief |
| 8 | reviewer #9 | `mutation_check.sh` TRACKED revert list covers only index.html/tools/decks.py/tools/hifi.py; an f_ mutant editing the fixture would not be reverted unless P0c's `git apply -R` rewrite lands first | closed: P0c per-path restore + git clean merged d6935d1 |
| 9 | reviewer #9 | nits: partition maker-string token test on `\|`; add name/sub to deep-equality tuple; pin EXPECTED_SHA256 constant; dedupe CHORD_COUNTS via tests/paths | in P0b2 brief |
| 10 | reviewer #10 | Spec decisions taken by the integrator on bounce: grammar zones generated-only (row 7); trim drops 9 then 11 then 13; parent tie-break by parents.json order with Aeolian before Dorian; omitted ding octave = 3; ids "0","1".."N","101".."106", labels Ding/1..N/U1..U6; built-in sups subset of union; NO_FIFTH names the fifth; formatSeed/deckId plain strings; subtitle cap 26; per-deck rule = unique fields list only; N counts the ding; tritone bottom tie = below ding; strictly ascending after inference else BAD_NOTE; name charset printable ASCII 1-40 | applied by P0a, downstream briefs (P0d, 1A, 1C, 2) must cite the spec |
| 14 | reviewer #10c | spec nits left open: round-trip equality is on `.value`; ding-count-first (DECIDED) outranks the BAD_NOTE-first precedence DEFAULT; ranking prose tier names are `sus`/`seventh`; "more top-shell tones" counts voicing fields; B# ding fifth spelling double-sharp edge; name "" means auto | P0d/2/4 briefs cite these readings |
| 11 | reviewer #10b | docs/SCALE_ENGINE_PLAN.md line 378 still says subtitle <= 25; spec decided 26. Amend on main after PR #10 merges | integrator |
| 12 | P0c | Engine module convention for P0d and Phase 1: plain scripts, no require/import/export, shared global `HPE` created with `var HPE = (typeof HPE !== 'undefined') ? HPE : {}`; tests load via tests/helpers/engine.js loadEngine([...]) | recorded, P0d/1A/1B/1C briefs |
| 13 | P0c | mutation_check.sh now has MUTANT_TIMEOUT (180s default), one retry, TIMEOUT counted as survivor; e2e mutants can flake on headless Chrome launch | recorded |
| 3 | P0b | fixture sha256 0475970330455878d252ae6695ddf92138f384cae5cb08f68f91a575a58ad16a; data changes bump to v2 | recorded |
| 15 | P0b2 | mutation_check.sh's browser probe (tests/helpers/cdp.js findBrowser) ignores CHROME_BIN, so e_* mutants always skip locally on macOS; CI unaffected | backlog, fold into 3a brief |
| 16 | P0d | Engine values are built in a node:vm realm; assert.deepStrictEqual against host literals fails on prototype identity. Tests normalise through JSON (a `host()` helper) first. Every Phase 1 lane must do the same | recorded, 1A/1B/1C/2 briefs |
| 17 | P0d | loadEngine takes module NAMES (`loadEngine(['core'])`), engine.js joins src/engine/<name>.js | recorded, 1A/1B/1C/2 briefs |
| 18 | P0d | Spec gaps read by the lane: rejected OPTIONS (palette/parent/name/mirror) return BAD_NOTE naming the value (section 2 has no options code); `(D3)` with no top notes returns NO_FIFTH; REASONS is `{CODE: {kind, reason}}`. Reviewer #14: all three consistent with the spec (no invented codes; `(D3)` fails NO_FIFTH as the first real rule; REASONS kind column is in section 2). Phase 4 may still want an options code amendment | closed, Phase 4 brief cites |

| 19 | reviewer #14 | core.js:178-184 readOptions: an empty/whitespace `name` after trim, or a non-string option, yields BAD_NOTE whose `<X>` is the raw value (` is not a note.` / `6 is not a note.`). Cosmetic; spec has no options code | backlog, Phase 4 brief |
| 20 | reviewer #14 | core.js:232-239 precedence is NO_DING before BAD_NOTE per the DECIDED D13 count-first bullet; section 3 DEFAULT precedence list says otherwise. `( D3 )` returns NO_DING not BAD_NOTE. Align the DEFAULT text at the Phase 1 owner-review gate | integrator, Phase 1 gate |
| 21 | reviewer #14 | core.js:172 readOptions rejects `palette: null` / `mirror: null` as BAD_NOTE while `parent: null` is accepted; spec defines null only for parent. Phase 4 decoder must not emit null for palette/mirror | recorded, Phase 4 brief |
| 22 | main | Milestone receipt after wave 2 (contract §8): integrator script parsed the three `maker_string`s from `tests/fixtures/golden_decks_v1.json` through `loadEngine(['core'])`; name/octave/midi/label/zone equal for all 27+18 fields except Pygmy ids 10 and 11 (grammar `rim`, literal `inner`; the DECIDED section 3 divergence), `formatSeed(parse(x).value)` equals the fixture string for all three, deckIds custom:626198f8 / custom:b936039c / custom:977311b5 | receipt recorded |

| 23 | 1A | The acceptance row's "voicing 58/59" is Premise 2's figure (root FIELD given); with only (root pc, intervals) the spec-predicted figure is 50/59 (Premise 3). Lane asked to expose `opts.rootField` on `choose` and assert both; the 50/59 exception table (Fm9, Db, Dbmaj7, Eb7, 5 alternates) stays two-sided. Phase 2 brief: `select.build` calls `choose` with the pc only | sent to 1A, attempt 1 |
| 24 | 1C readings for the Phase 1 owner-review gate: numerals read off a mode REFERENCE scale (major/natural minor) not parent-degree index; minor-relative b2 reads `#I` under the section 10 tie-break; octatonic both-thirds -> lowercase; caps enforced by RangeError throw; `degrees` labels every pan pc. Amara 3 degree exceptions match spec section 10 frozen list. | 1C | integrator | open (Phase 1 owner-review gate) |
| 25 | reviewer #17 | `layout.solve` returns `{ok, value:{geom, fields}}` while spec §1 says plain function; `mirror` false = right-first (generated default), true = left-first, inverting §13's label. Spec §1 and §13 need a one-line amendment each. | integrator | open (Phase 1 owner-review gate); lane 2 brief cites the result type |
| 26 | reviewer #17 | 3a: `pan()` (index.html:160) ignores `g.ext` and derives its own extent; must read `ext` for generated decks per §11. Harmless for reachable configs today. | 3a brief | open |
| 27 | reviewer #17 | Nits for a later sweep: `"mirror" in options` treats `{mirror: undefined}` as explicit false; `tests/layout.test.js:475` identical ternary branches; inner-pair sign(cos) float-fragile at 270°; decorative `inner_ring` 0.355 clears the offset ding by 0.0225R (taste call). | 1B follow-up | open |
| 28 | reviewer #16 | D8 numeral reading: 1C reads numerals off a mode reference scale, so an in-parent chromatic degree (Phrygian b2, Locrian b2/b5, Lydian #4) labels `#I` / `#IV` / `bv°`. Alternative: numeral = parent-degree INDEX, accidental = offset vs the D8 reference scale; reproduces all 17 built-ins and yields `bII` / `#iv°`. Integrator recommendation: adopt the alternative (a Phrygian pan showing `#I` is a defect a player sees). Also `caseFromPan` drops `°` when a P5 is present (unrecorded reading). | integrator | decided: alternative reading; 1C follow-up PR after #16 merges; spec §10 amendment at owner gate |
| 29 | reviewer #16 | Auto deck name `<DING> <PARENT-DISPLAY> <N>` is unowned (not in 1C's brief, not in HPE.naming). Assigned to Phase 2 `select.build` (already in the lane 2 brief). Longest reachable is 14 chars, so the ellipsis clause is unreachable for auto names. | integrator | assigned to lane 2 |
| 30 | reviewer #16 | Nits: pin the two non-root built-in labels (Hijaz F `iii°`, Amara E `ii°`) in tests/naming.test.js; the "override never changes the numeral" test is a lane invariant that changes under row 28. | 1C follow-up | open |
| 31 | reviewer #15 | Spec §1 names `voicing.pick` as plain-return; shipped `voicing.choose` returns the result type (lane 2 must use `.value`). `isLegal` checks length only, not pitch classes (lane 2 must not rely on it as a pc guard). `candidates(fields, pc, [])` returns `[[]]`. `BAD_NOTE` reason copy misleading if ever reachable. PR body says 12 tests, head has 14. | integrator / lane 2 brief | open; §1 amendment at the owner gate |
| 32 | lane 1C-2 | Numeral fix (row 28) implemented as parent-degree-index reading; 7 disagreements vs the old reading, none under an inferred parent, all built-ins unchanged. Readings for the owner gate: (a) C Locrian Gb yields `bV` not `bv°` (case from D10: Bb and Db on the pan); (b) `caseFromPan` suppresses `°` when a natural fifth is on the pan (not stated in §10); (c) §10 outside-parent bullet says "one semitone from the parent degree" but code names from the D8 reference degree (pre-existing). §10 D8 bullet needs amending at the owner gate. | integrator (owner gate, with rows 20/24/25/28) | open |
| 33 | lane 2 | Select readings: eligibility on raw quality intervals, collapse on reduced pitch set (29/27/25 reproduced); user name stored verbatim (16-char cap is display only, auto name max 14 so ellipsis unreachable, confirms row 29); sus2 collapse vacuous (no sus2 key in qualities.json); dedup unreachable after collapse; ding-only-root guard unobservable at select level (voicing rejects), `s_ding_only_root` deleted as equivalent; OWNER-FACING: under the 28-quality vocabulary the 25 cap evicts three Pygmy built-in cards the engine otherwise reproduces (Gm7b5, Bbm7, Cm7). Divergence: Amara 0 missing/9 extra, Hijaz 3/4, Pygmy 13/13, 16 overrides. | integrator (owner gate: cap 25 vs Pygmy evictions) | open |
| 34 | reviewer #18 | Nits: `naming.numeral` third arg unvalidated when called directly; add a test pinning an outside-parent case where the reference-scale and parent-adjacent readings differ (follows the §10 amendment). | integrator / owner gate | open |
| 35 | owner gate (2026-09-09) | All four owner decisions landed in `docs/ENGINE-SPEC.md` as commit e9ba5dc (merged dad182c): §1 result contract (`layout.solve`/`voicing.choose` DO return the result type; `naming.name`/`subtitle` stay plain), §3 precedence (NO_DING checked first), §13 mirror polarity (false = right-first / Pygmy, true = left-first / Hijaz+Amara), §10 numerals (parent-degree-index reading + reference-degree naming outside the parent + `°` suppressed when a P5 is on the pan), §8 cap. This CLOSES rows 20, 24, 25, 28, 31, 32 and the §10 half of 34. | integrator | done |
| 36 | owner gate (2026-09-09) | [spawned as lane 2b] Card cap is no longer a flat 25: `cap = 25 + max(0, fieldCount - 12)` over EVERY field (ding, rim, inner, bottom). 12-field pan still 25 (the §8 worked example is unaffected); 18-field Pygmy caps at 31, recovering Gm7b5/Bbm7/Cm7 (ranks 27/28/29 per row 33); structural max 20 fields caps at 33. `src/engine/select.js` still implements the flat 25. | lane 2b (follow-up) | open |
| 37 | integrator measurement (2026-09-09) | A hand-typed seed does NOT reproduce the three built-in layouts, which is consistent with plan line 139 (built-ins bypass the solver) but worth recording. Angles: Hijaz and Amara reproduce EXACTLY (0/9 diffs) at `mirror=true` (left-first); Pygmy never does (11/18 diffs at its own right-first setting, 17/18 mirrored). Two Pygmy causes: (a) `parseSeed` gives it 0 inner fields where the fixture has 2, because it has exactly 11 top notes after the ding and RIM_MAX is 11, so its inner pair F5/G5 is classified `rim`; (b) `layout.solve` spaces the rim evenly (286.4/253.6/319.1) where the instrument measures 290/250/330. Geom differs for all three: Hijaz/Amara in 4 keys (f_ding 0.135→0.114, f_note 0.128→0.1454, f_num 0.105→0.1216, r_ding 0.2→0.19), Pygmy in 8 (incl. inner 0.38→0, inner_ring null→0.355, r_note 0.1425→0.1783, rim 0.722→0.745, rim_num_out true→false). | integrator (owner gate: is this acceptable, or should D13 gain an explicit inner-pair rule?) | open |

| 38 | 2b | open | Generated `Cm7` and `Gm7b5` for Pygmy now carry mechanically derived equivalence annotations `( = Eb6 )` / `( = Bbm6 )`, while the built-ins ship them unannotated - section 8 says built-in provenance must NOT be annotated. The divergence key is (main+sup, fields) and blind to subtitle, so `divergence_v1.json` and its tests are unaffected and `tests/naming.test.js` passes as-is. But the count of built-in cards the engine reproduces INCLUDING subtitle changed with PR #21. Route to whoever owns the subtitle-reproduction story. Related to the #19 nit that subtitle-only divergence is invisible to the table. |
| 39 | main | open | Pygmy layout reproduction, measured (supersedes the partial finding in row 37). `HPE.layout.rimAngles(9)` returns exactly the instrument's measured rim angles [290,250,330,210,10,170,50,130,90]. Hand-reassigning Pygmy's 11 top notes as 9 rim + 2 inner and forcing `mirror:false` gives **0 angle diffs of 18** against the golden fixture. The sole blocker is the positional zone rule at `src/engine/core.js:322` (`n < RIM_MAX ? "rim" : "inner"` with RIM_MAX=11): Pygmy's 11 top notes exactly fill the rim cap, so its inner pair F5/G5 is classified `rim`, and the D13 grammar has no marker for the inner zone. Residual geometry after the zone fix is 4 small fractions (f_note 0.109 vs 0.1114, f_num 0.0912 vs 0.0932, r_note 0.1425 vs 0.1456, inner_ring null vs 0) plus `ext` which the fixture does not carry - none move a note. Recommended fix (owner's call, NOT started): a second separator `/` opening the inner zone the way `|` opens the bottom, optional so seeds without it keep today's positional rule and no deck id moves. Touches parseSeed, formatSeed and core.deckId. Reported to the owner 2026-09-09; awaiting their decision. |

| 40 | 3a | open | Boundary touch, self-flagged by the lane: `tests/mutants/r_yaxis_sign.patch` is outside 3a's owned set but went stale because the `pan()` `ext` change is its diff CONTEXT. The lane re-derived it claiming a byte-identical mutation (the `P()` y-sign flip) with only new context lines. Reviewer of #22 is verifying that byte-for-byte. Same check applies to the other re-derived mutants (`e_deck_order`, `e_persist_save`, `d_no_deck_fallback`, `d_pc_no_mod`, `d_save_drops_mode`, `d_save_no_guard`). |
| 41 | 3a | open | Retro note, no action: mid-lane the 3a agent ran `git checkout -- index.html` to revert a scratch mutation and lost its entire first round of index.html edits. It redid them and reports no net effect on the delivered diff. Recorded because it means index.html on that branch is freshly rewritten code rather than iterated code - the #22 reviewer was told to read it as such rather than assuming coverage carried over. |
| 42 | main | open | Merge-order note for wave 5: PR #21 (2b) and PR #22 (3a) both edit `tests/suite_health.py` FLOORS, on DIFFERENT rows (`tests/select.test.js` 32->35 and `tests/app.test.js` 12->23). Same shape as the #16/#19 FLOORS collisions, which GitHub merged cleanly in one case and required a rebase in the other. Merge the first on PASS, then re-check the second for a real content conflict before merging - behind is not stale. 3a also claims no dependency on a generated card count, so 2b's cap change should not reach it; the #22 reviewer is verifying that claim by grep. |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #10 | P0a | PASS_WITH_NITS (3rd, integrator fix) | 6 nits (formatSeed(fields) spelling in section 12; round-trip stated on wrapper not .value; ding-count vs precedence wording; tier names sus/seventh in ranking prose; B# ding fifth spelling; name default vs whitelist) | merged 386a856; nit 1 and plan line 378 fixed by integrator docs commit; rest row 14 |
| #10 | P0a | FAIL (2nd) | 1 blocker (range row in range), 4 majors (ding-only candidacy, parseSeed payload undefined, Object.keys order, degree rules contradict D10), 9 nits | cap reached; integrator fixed all in b81ad84; plan line 378 needs the 25->26 subtitle amendment (row 11, done) |
| #10 | P0a | FAIL | 1 blocker (zone rule vs built-in reproduction), 9 majors (trim order, Amara infers Dorian, omitted ding octave, id/label scheme, sup union, NO_FIFTH literal, formatSeed/deckId wrapping, subtitle cap vs m7b5, pitch-set rule), 9 nits | bounced with 19 integrator decisions (row 10); fresh re-review after fix push |
| #9 | P0b | PASS_WITH_NITS | 2 major (both cross-lane: Pygmy inner-zone gap in the D13 grammar; f_ mutant deferred), 4 nits (token test tolerant of misplaced `\|`; sha self-consistent only; deep-equality skips name/sub; duplicated CHORD_COUNTS) | merged 66453e8; queue rows 7-9 |
| #11 | P0c | FAIL (CI success at 81830c4) | 1 blocker: suite_health `==` floor asserts crash when a pre-seeded row is raised; 1 high: mutation_check EXIT trap installed before REFUSING check deletes untracked lane files; 3 medium (restore() all-or-nothing, check_node skips unlisted files, header suites count any non-zero as kill); 8 nits incl. output format vs plan greps | Bounced to lane, attempt 1 |
| #11 | P0c | PASS_WITH_NITS (2nd, CI success at 4eafe8e) | all 13 prior findings reproduced fixed; nits: TERM trap does not exit, e_ skip precedes apply --check, `$*` word-splits header | Merged d6935d1 |
| #12 | preview (non-swarm) | PASS_WITH_NITS (CI success at c64feab) | fork PR fetch, exit status on bind failure, trap window, README | nits fixed 672e003, merged |
| #14 | P0d | PASS_WITH_NITS (CI success at 6a24d38) | 25 tests, 7 u_ mutants killed, golden strings + round-trip + FNV hash hand-verified; decisions (a)-(h) all consistent with spec; 3 nits (options BAD_NOTE wording, NO_DING-first precedence vs DEFAULT text, null palette/mirror) | Merged 40ff645; rows 18-21 |
| #17 | 1B layout | PASS_WITH_NITS | boundary clean; CI success at 1e4d795; 7 g_ killed; 502-config overlap sweep clean (min clearance 0.0518R reachable); mirror false=right-first pinned; solve returns result type (spec §1 says plain function) | merged 6467a33; nits rows 25-27 |
| #16 | 1C naming | PASS_WITH_NITS | boundary clean; CI success at ff2c485; 7 n_ killed; exceptions two-sided; tie-break confirmed; b2-in-minor labels `#I` (reference-scale reading) flagged for owner gate; auto deck name unowned | merge blocked by FLOORS conflict; rebase requested; nits rows 28-30 |
| #16 (rebase) | 1C naming | PASS | lane files byte-identical to ff2c485; only FLOORS line added; CI success at 2078bf3; 65/65 mutants killed | merged 5c26ae0 |
| #15 | 1A voicing | PASS_WITH_NITS | boundary clean; CI success at 75e1981; 7 v_ killed; 162 Fm11 candidates, 50/59 pc-only and 58/59 rootId confirmed by reviewer script; zero throws over 4704 parseSeed-valid calls | merged 4f5137c (GitHub merged the FLOORS lines cleanly); nits row 31 |
| #13 | P0b2 | PASS_WITH_NITS (CI success at 619619d) | mutant hand-verified; nits: BUMP message omits EXPECTED_SHA256, count test partly redundant, unused `sep` | Merged 5f03262 |
| #19 (rebase) | 2 select | PASS | delta review at d6e1740: lane files byte-identical across the rebase; FLOORS keeps both naming 26 and select 32; the nit commit is comment/data-note text only and the D11 citation checks out; boundary clean over 13 files; no select assertion depends on a numeral string PR #18 changed; CI success at that exact SHA; 9/9 `s_*` killed; merge-forward overlay with the post-dad182c spec passes 32/32. Nits: the `DEFAULT[owner-review]: 25 cards` comment is stale; the flat 25 is encoded in FIVE places (both cap mutants' context lines included); Pygmy's `( = X6 )` annotation is not pinned two-sided. | merged c94b43c; nits folded into the 2b brief |
| #19 | 2 select | PASS_WITH_NITS | CI success at aa92320; reviewer independently reproduced §8's worked example (29 raw / 27 collapsed / 27 voiced / 25 capped), regenerated all three divergence tables exactly, confirmed two-sidedness, applied all 9 `s_*` mutants by hand (9/9 killed), and empirically verified the three "no mutant needed" claims. The Pygmy cap evictions are a ranking consequence, not a bug: Gm7b5/Bbm7/Cm7 land at 27/28/29 because each carries only 2 of 4 tones on the top shell. Nits: Fm9 override note cited the wrong premise; divergence key is (main+sup, fields) so subtitle-only divergence is invisible. | nits fixed and rebased onto 1e36069 as d6e1740; re-review running |
| #20 | integrator (spec) | n/a - docs-only owner-decision transcription, CI success at e9ba5dc | - | merged dad182c |
| #18 | 1C-2 | PASS_WITH_NITS | numeral parent-degree-index reading verified exhaustively (946 labels, exactly 7 change, none under an inferred parent); mutant kills 2/26 tests specifically; relaxed override test still fires 317 times. Nits: `numeral(offset, rel, idx)` accepts any idx>=0 when called directly (unreachable from `degrees`); §10 outside-parent wording vs MAJOR_REF/MINOR_REF code is pre-existing (row 32c); no test pins an outside-parent case where the two readings differ; `caseFromPan` P5-suppresses-° reading now recorded in the test header. | merged ceaac1f |

## Cycle state

Cycle: 1   Wave: 5   Merged this batch: 66453e8, 386a856, d6935d1, 5f03262, 40ff645, 6467a33, 5c26ae0, 4f5137c, ceaac1f, dad182c, c94b43c
PHASES 0, 1 AND 2 ARE COMPLETE. All five engine modules (core, voicing, layout, naming, select) are on main. Wave 5 = lanes 2b (cap) and 3a (app plumbing), running in parallel; 3b is serial after 3a merges.
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0a | released | released | scale-engine/w1-spec | #10 | b81ad84 | 2026-09-08 run 34288832378 success | PASS_WITH_NITS | 2 (cap) | yes 386a856 | - | no |
| P0b | released | released | scale-engine/w2-corpus | #9 | da34ba2 | 2026-09-08 gh pr view + run 34284011482 success | PASS_WITH_NITS | 0 | yes 66453e8 | - | no |
| P0c | released | released | scale-engine/w3-harness | #11 | 4eafe8e | 2026-09-08 gh pr view + run 34308168091 success | PASS_WITH_NITS | 1 | yes d6935d1 | - | no |
| P0d | released | released | scale-engine/w5-core | #14 | 6a24d38 | 2026-09-08 gh pr view + run 34309621849 success | PASS_WITH_NITS | 0 | yes 40ff645 | - | no |
| 1A | merged, released | agent-managed | scale-engine/w6-voicing | #15 | 75e1981 | 2026-09-08 gh pr view + run 34312798919 success | PASS_WITH_NITS | 1 | yes 4f5137c | - | no |
| 2 | merged, released | agent-managed | scale-engine/w9-select | #19 | d6e1740 | 2026-09-09 (gh pr view CLEAN + run 34317045654 success at that exact SHA) | PASS (rebase re-review) | 1 | yes c94b43c | - | no |
| 2b | returned | agent-managed | scale-engine/w10-select-cap | #21 | c4d240f | 2026-09-09 (gh pr view OPEN + run 34318930997 success at that exact SHA) | review running | 0 | no | - | yes (until verdict) |
| 3a | returned | agent-managed | scale-engine/w11-app-plumbing | #22 | 86fe974 | 2026-09-09 (gh pr view OPEN + run 34319025044 success at that exact SHA) | review running | 0 | no | - | yes (until verdict) |
| 1B | merged, released | agent-managed | scale-engine/w7-layout | #17 | 1e4d795 | 2026-09-08 gh pr view + run 34311187834 success | PASS_WITH_NITS | 0 | yes 6467a33 | - | no |
| 1C | merged, released | agent-managed | scale-engine/w8-naming | #16 | 2078bf3 | 2026-09-08 gh pr view + run 34312599567 success | PASS (rebase re-review) | 1 | yes 5c26ae0 | - | no |
| 1C-2 | merged ceaac1f; released | agent-managed | scale-engine/w8b-naming-numerals | #18 | 5eee2da | 2026-09-08 (gh pr view + origin tip + run 34314377350 success) | PASS_WITH_NITS | 0 | yes | - | no |
| P0b2 | released | released | scale-engine/w4-corpus-mutant | #13 | 619619d | 2026-09-08 gh pr view + run 34309255857 success | PASS_WITH_NITS | 0 | yes 5f03262 | - | no |
