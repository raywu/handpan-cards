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
| 2b | scale-engine/w10-select-cap | merged dd9d501 | PASS_WITH_NITS (#21) | 2026-09-09 |
| 3a | scale-engine/w11-app-plumbing | merged e348de7 | PASS_WITH_NITS (#22) | 2026-09-09 |
| 3b | scale-engine/w12-scale-sheet | merged ad3ac98 | PASS_WITH_NITS (#25) | 2026-09-09 |
| 4a | scale-engine/w6-share | merged f244f52 | PASS_WITH_NITS (#23) | 2026-09-09 |
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

| 43 | 2b | closed | Lane self-report inaccuracy, corrected here so it does not propagate: the 2b report says "five new `s_cap_*` mutants". It is THREE new files (`s_cap_flat`, `s_cap_hinge`, `s_cap_slope`) plus TWO rewritten for the new constant names (`s_cap_removed`, `s_cap_widened`) - five cap mutants total, not five new. No mutant was deleted and all twelve `s_` are killed, so the substance of the claim stands. |
| 44 | 2b | open | The three rewritten override notes in `divergence_v1.json` now assert in prose that a given engine spelling "is listed extra", but the schema test only checks `note.length > 0`. The underlying divergence IS mechanically checked (every override must appear in a live-derived `missing`); only the sentence describing it can go stale silently. Low severity - candidate for a later lane that owns the fixture. |
| 45 | main | closed | Reviewer nit 3 on #21 was a MISREADING; recording the resolution so nobody "fixes" a correct constant. The reviewer reported the briefing's frozen sha `0475970330...ad16a` disagrees with the file's sha256 `d51f1d24bb...c9e9e`. Both numbers are right and they measure different things: `tests/test_fixture_integrity.py:22-24` pins `0475970330...` as the sha256 of the CANONICAL SERIALISATION of `{version, decks}` (sorted keys, no whitespace), not of the raw file bytes, and `test_sha256_matches_canonical_serialisation` proves the two agree. `d51f1d24bb...` is just the raw file digest, which nothing pins. The briefing wording ("fixture bytes are read-only (golden sha ...)") is what invited the confusion - the sha is of the payload, not the bytes. No action beyond this note. |

| 46 | 4 (share) | open | `checkShareVersion(v)` in index.html tests `v > SHARE_VERSION`, so a non-numeric `v` (`undefined`, `NaN`) returns `{ok:true}` instead of NEEDS_NEWER_APP. UNREACHABLE in Phase 3 - nothing calls it, the decoder is Phase 4 - so not a defect in #22. Phase 4's decoder lane must add a finite/type check when it wires `share.decode` to this guard. Carried into the 3b brief as a "do not wire the decoder" note. |
| 47 | 3b | open | Selecting a generated deck leaves no chip in the `on` state, because `buildChips()` iterates the DECKS literal only. This is 3a's documented no-UI non-goal, not a defect. Assigned to 3b, whose brief covers the custom chip and the active-chip-scrolled-into-view rule. |
| 48 | 3b | open | `CLAUDE.md` "Repo layout" does not mention `tools/inline_engine.py` or the inlined engine regions in index.html. 3a could not fix it (docs outside its ownership). Assigned to 3b, whose brief item 10 covers the CLAUDE.md/README "sync step, not build step" wording and adding inline_engine.py to Repo layout. |
| 49 | main | receipt recorded (row 50) | **MILESTONE GAP, integrator's to close.** The #22 reviewer reported explicitly that the app's RENDERED APPEARANCE AT 380px is `covered_by: "neither"` - no browser was available in the review worktree, and while CI runs the e2e suite it asserts DOM structure and behaviour, not visual layout. The built-ins' markup is provably unchanged, which is strong proxy evidence for them, but **a generated deck's appearance at 380px has never been looked at by anything**. The wave 5/6 milestone receipt (a 380px render of a generated deck) is therefore still owed and must be taken by the integrator against source data, not inferred from a review verdict. Chrome IS present on this machine at /Applications/Google Chrome.app; `findBrowser()` returns null only because CHROME_BIN is unset in the shell, so the receipt is takeable now. |
| 50 | main | receipt recorded | **Wave 5/6 milestone receipt (contract §8), taken by the integrator against source data, closing row 49.** Method: `scratchpad/receipt380.js` serves the repo at main `e348de7` on :8991, launches headless Chrome via `tests/helpers/cdp.js` with `CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, sets viewport 380x800 mobile, calls `generateDeck("(D) A C D E F G A C", {})` then `selectDeck(id)`, measures the DOM and captures screenshots. Result: generate `{ok:true, id:"custom:977311b5", name:"D AEOLIAN 9", cards:25, warnings:[], fields:9}`. Layout at 380px: `clientWidth 380, scrollWidth 380, horizontalOverflow false`; card rect `{w:334.4, h:461.8, l:22.8, r:357.2}`; diagram viewBox `-106 -106 212 212`; counter `1 / 25`; **zero elements whose rect exceeds the viewport** (`offenders: []`). Screenshots reviewed by eye at `scratchpad/receipt/`: `generated-380-front.png` - header "D AEOLIAN 9" / "D MINOR", degree `#1 i`, Marcellus chord name "Dm", "TAP TO REVEAL THE NOTES", footer "1 / 25  SHUFFLE: OFF", two-tone pink/orange split border (palette index 0, the default for `{}` options). `generated-380-back.png` - the revealed face renders the full card anatomy correctly: nine-field diagram with the ding D3 offset below centre, highlighted fields carrying the coloured band + inner hairline, unlit fields plain, note line `D4 - F4 - A4` and number line `3 - 5 - 7` both coloured per note with grey separators. `builtin-380.png` (C# Hijaz, the baseline) is visually identical in structure, confirming the generated deck renders through the same path with no layout regression. **Conclusion: a generated deck's appearance at 380px is now verified by looking at it, not inferred.** Caveat recorded honestly: this is one seed on one machine; it is a receipt, not a suite. |
| 51 | main | closed - fixed, reviewed and merged as fa9468d | **main WENT RED at e348de7 and nobody's CI could have caught it.** PRs #21 (2b, the size-scaled cap in src/engine/select.js) and #22 (3a, which inlined the engine into index.html) never conflicted TEXTUALLY, so both merged clean while being semantically divergent: #22's branch predated #21, so the `engine:select` region it inlined still carried the flat `CAP = 25`. `tools/validate.py` has since failed with `['engine:select in index.html differs from src/engine/select.js']`, which also reddens `tests/test_deck_data.py::test_validate_py_passes` and makes `b_engine_desync.patch` report `broken`. **The shipped app was running OLD engine code** - exactly what inline_engine.py's docstring says the gate exists to prevent. Fixed by re-running `python3 tools/inline_engine.py` on main (PR #24, branch fix/engine-resync-select), no hand edits; the diff is precisely 2b's change confined to the engine:select region. LESSON for the remaining phases: a lane that changes `src/engine/*.js` and a lane that touches the inlined regions are NOT independent even when git says they are, because the coupling runs through a GENERATED file. Whenever both kinds are in flight, the integrator must run `python3 tools/inline_engine.py --check` on main after EVERY merge, not only when git reports a conflict. |
| 52 | main | note | The 380px receipt of row 50 was taken against `e348de7`, i.e. against the app running the PRE-2b inlined engine (flat `CAP = 25`). The seed used has 9 fields, and `25 + max(0, 9 - 12) = 25` under either formula, so the receipt measured the same 25-card deck the fixed engine produces and its findings stand unchanged. Recorded so nobody has to re-derive that later. |
| 53 | 4a -> Phase 4 wiring lane | open | Lane 4a shipped `src/engine/share.js` but deliberately did NOT add it to `tools/inline_engine.py` MODULES, so the module is NOT in the app yet. The Phase 4 wiring lane owns: adding `share` to MODULES (it loads after `core`), re-running the sync, wiring `share.decode` to `checkShareVersion` WITH the queue-row-46 finite/type check, and the CRITICAL app.test.js:356 regression the plan names (unknown built-in id = silent fallback, missing `custom:` id = fallback plus a visible message). Merging 4a leaves the app's behaviour completely unchanged, which is why it can merge before that lane exists. |
| 54 | #24 reviewer | closed | The #24 reviewer flagged the PR body's local test count as overstated (body said `164 pass`; the reviewer measured 159 tests / 158 pass / 1 skipped). Both numbers are right for their own environment and neither is an error: the integrator had `CHROME_BIN` exported, so `tests/e2e.test.js` RAN (6 tests); the reviewer's worktree had no browser, so that file skipped. 164 - 6 = 158. Recorded so the discrepancy is not re-litigated, and as a reminder that any test-count claim in a PR body must say whether the browser was present. CI at the merged SHA ran e2e and is the actual evidence - and it reports `# tests 164 / # pass 164 / # skipped 0`, matching the integrator's local figure EXACTLY. The PR body was accurate; the reviewer's environment was the outlier. |
| 55 | #24 reviewer | closed - resolved against the CI log | `covered_by: "neither"` from the #24 review: nobody rendered the app in a real browser at `c23caf3`, so "no built-in deck's rendered output moves" rested on data-identity plus the `boot_sim.js` DOM STUB rather than on pixels. **Resolved by reading the CI log rather than by re-running anything:** the `js suites (unit + e2e)` job at that exact SHA reports `# tests 164 / # pass 164 / # skipped 0`, so the e2e suite did NOT skip - a real headless browser rendered the app on the runner - and it includes `ok 54 - card lines and diagram stay inside the card at 380px` and `ok 82 - rim fields stay inside the shell circle`, both asserted against a BUILT-IN deck at 380px. The reviewer's worktree had no browser (its 159/158-with-1-skipped count is the same suite minus the 6 e2e tests), which is why it read the coverage as absent. Built-in rendering at this SHA is therefore covered by CI, and the generated path at 380px is covered by the row-50 receipt. |
| 56 | #24 reviewer | open -> 3b's PR | `covered_by: "neither"`: the reviewer could not verify textual non-conflict with lane 3b because `scale-engine/w12-scale-sheet` is not pushed to origin yet. Its reasoning is favourable - `dd9d501` is an ancestor of `96b4b51`, so if 3b re-runs `inline_engine.py` itself it produces byte-identical content and identical changes merge clean - but the check itself must be re-run at 3b's PR, not inferred from here. |
| 60 | main | closed - resolved at 3b's PR | **Row 56 is resolved favourably, as its reasoning predicted.** Lane 3b's PR #25 head `f39a7a1` has `fa9468d` (the engine re-sync hotfix), `e348de7` and `f244f52` all as ancestors, and `git diff main...f39a7a1 -- index.html` contains **no `engine:` region line at all** - 276 changed lines in index.html, none of them inside the generated block. The lane added the sheet UI around the engine regions rather than through them, so there is no textual conflict and no semantic desync of the kind that reddened main at `e348de7`. `python3 tools/inline_engine.py --check` is being re-confirmed by the reviewer on the branch, and will be re-run on main after the merge per row 51's standing lesson. |
| 61 | 3b -> #25 reviewer | open, handed to the reviewer | **Lane 3b's diff touches `tests/helpers/sandbox.js` (+43), which the ownership table assigns to lane 3a, not to 3b.** 3a is merged and released so nothing can conflict, and this is a shared surface rather than a private file - every engine suite loads through the helpers - so it is a real boundary question and not a formality. The #25 reviewer has been asked for three specific answers: what the hunk changes, whether it can alter the behaviour of any suite outside 3b's two, and whether the lane needed it or worked around something it should have reported instead. Recorded here so the answer is not lost inside a review verdict. |
| 62 | 3b | note - environment, reinforces row 59 | Lane 3b independently hit and then ROOT-CAUSED the local browser problem row 59 records. Full Google Chrome 152 under `--headless=new` on this macOS host wedges its renderer after two `Input.dispatchKeyEvent` keyDowns followed by a navigation: it stops answering `Runtime.evaluate` entirely, so every later CDP request costs its full 20s timeout. The lane reduced it to a 30-line script with NO app code (pressing F9 then F10, keys the app ignores) and reproduced it against `origin/main`'s `index.html` with `origin/main`'s `e2e.test.js`, so it predates the branch and is not lane damage; `tests/helpers/cdp.js` is not owned by 3b and was not touched. Its local acceptance run used the Playwright `chrome-headless-shell` already on the machine (15/15 in 4.7s, repeatable), which is the same binary family CI uses. This also explains row 59's nondeterministic 2-of-6 / 4-of-6 e2e failures: same host, same wedge, different point of onset. STANDING RULE, now twice-confirmed: on this machine use `chrome-headless-shell`, never full Chrome headless, and never treat a local e2e red as a lane signal. |
| 63 | #25 reviewer | closed - answered, and it corrected ME | Row 61's sandbox.js question, answered by measurement rather than argument. (a) The hunk changes four things in `tests/helpers/sandbox.js`: the `innerHTML` setter now also clears children (`this.children.length = 0`) - the ONLY real behaviour change - plus per-boot focus/blur rebinding so `document.activeElement` is tracked, `createElement` routing through it, and five additive sheet-driving helpers. (b) **My dispatch premise was factually WRONG and the reviewer said so**: the engine suites do NOT load through `sandbox.js`, they load through `tests/helpers/engine.js` (`loadEngine`). `sandbox.js` has exactly three consumers - `tests/app.test.js` (lane-owned), `tools/boot_sim.js` and `tests/helpers/dump_app_render.js` -> `tests/test_render_agreement.py` (both CI gates, neither owned). The reviewer ran both non-owned consumers against a sandbox with the fix REMOVED, compiled in memory under the original filename so the tree was never touched: boot_sim output identical both ways, dump_app_render byte-identical both ways (sha256 `b0ca32d2...`, 42082 bytes). `querySelector`/`querySelectorAll` are unaffected because `all()` builds from a flat `created` array, not the children tree. (c) The change is GENUINELY NEEDED and fixes a pre-existing STUB BUG rather than working around one: `index.html` `buildChips()` does `nav.innerHTML = ""` then appends, and the old stub never cleared, so chips accumulated without bound - measured 4 after boot growing to 16 after three deck switches - and `clickChip()`'s `.find()` was silently clicking a STALE node (harmless only because the onclick closure captures `d.id`). A real browser clears children on `innerHTML` assignment, so the fix makes the stub MORE faithful. Verdict: correct and safe, but the lane should have REPORTED editing another lane's shared harness instead of doing it silently. |
| 64 | #25 reviewer -> lane 4c | open | Two small gaps the #25 review left on my desk, both for the Edit-sheet lane. (i) `tests/app.test.js`'s missing-`custom:`-id test asserts the fallback and that an SVG rendered, but NOT the visible message the plan requires - a PRE-EXISTING gap, byte-identical to main, not introduced by 3b, and now assigned to lane 4b as its task 6. (ii) The e2e swatch hit-area probe uses `cy +/- 18`, which proves >= 36px rather than the stated 44px; tightening to +/- 21 would pin the documented figure exactly. Also two doc-wording nits no tool can catch: `README.md` says validate.py "fails the build" three sentences after "not a build step" (it fails CI, not a build), and `CLAUDE.md` quotes the marker as `<!-- engine:<name> -->`, which is not a literal string in `index.html` - a contributor grepping the quoted form finds nothing. |
| 57 | #23 reviewer -> follow-up lane | open | **The browser-API guard is weaker than the brief assumed, in BOTH directions, and the correction matters more than the nit.** `tests/helpers/engine.js:42-43` INJECTS `TextEncoder, TextDecoder, btoa, atob` into every vm sandbox, so the long-standing claim that "the node:vm realm has no browser APIs" is only true for `CompressionStream` and `Buffer` (the reviewer probed the live context). For the other four, `tests/share.test.js:403`'s source scan is the ONLY guard, not a backstop. That scan is `new RegExp("\\b" + api + "\\s*\\(")`, anchored on a direct call: the reviewer built a shadow tree and injected each API for real - `btoa`, `atob`, `TextEncoder`, `TextDecoder`, `CompressionStream`, `Buffer` and `globalThis.btoa` all turn the suite red, but **`Buffer.from("x")` leaves 25/25 passing**, because member access on a namespace object slips a `(`-anchored pattern. Narrow in practice (an unguarded `Buffer.from` is undefined in the vm realm AND in a browser, so the functional tests catch it), so this is scan precision, not a hole. Fix is one character class: `"\\b" + api + "\\b"`. `src/engine/share.js` itself is clean - it hand-rolls UTF-8 (98-153), the 6-bit alphabet (155-187) and FNV-1a (191-201). Any future lane writing a "no browser API" test must use the `\\b` form and must NOT repeat the premise that the realm lacks these globals. |
| 58 | #23 reviewer -> Phase 4 wiring lane | open | `covered_by: "neither"`: **two version constants, and nothing asserts they agree.** `index.html:2027 const SHARE_VERSION = 1` and `src/engine/share.js:55 var VERSION = 1`. Both are 1 today so nothing is broken, and no test pairs them; a future bump to one alone would silently break every existing link. The Phase 4 wiring lane owns the fix: once `share` is in `inline_engine.py` MODULES the app has `HPE.share.VERSION` in scope, so `SHARE_VERSION` should be derived from it rather than restated, or pinned two-sided by a test. Related and still open from the same review: row 53 (share.js is shipped as a module but not wired, and NO gate will ever notice the omission because MODULES is an explicit list) and row 46 (`checkShareVersion(v)` returns `{ok:true}` for a non-numeric `v`; `share.decode` does NOT inherit that bug - it guards `INDEX[text.charAt(0)] === undefined` at share.js:262 before comparing - so the index.html fix is still owed). |
| 59 | #23 reviewer | note - environment, not code | `covered_by: "neither"`: **local e2e is not usable as a gate on this Mac.** With `CHROME_BIN` exported, the #23 reviewer saw `tests/e2e.test.js` fail NON-DETERMINISTICALLY on the clean reviewed tree - 2 failures on one run, 4 on the next, out of 6, both times in the counter-wrap assertions at e2e.test.js:130 and :182. CI ran the same suite `6/6, skipped 0` at that exact SHA, and lane 4a touches no file e2e reads. This is the same class as rows 13/15 (the suite_health flake) and confirms the standing rule: CI at the final pushed commit is the evidence; a local e2e red is a machine signal, not a lane signal. If the flake recurs on the runner rather than locally, it becomes a real defect and gets its own row. |
| 65 | #26 reviewer -> lane 4b-fix | open, dispatched | **BLOCKER, and I reproduced it myself before acting on it.** `index.html:2382` guards the storage CONTAINER (`typeof store !== "object" || Array.isArray(store)`) but never the VALUE of `store.deck`, and line 2891 - new in this PR - calls `wantedDeck.indexOf("custom:")` on it. With `localStorage.hpfc = {"deck":5,...}` (also `{}`, `true`) that throws `TypeError: wantedDeck.indexOf is not a function`. Line 2886 has already run so the deck renders and the app LOOKS fine, but the throw aborts before line 2895, so **a user arriving on a `#s=...` share link has it silently dropped with no message** - the lane's own headline deliverable, killed by a malformed sibling value. Arrays do not throw (they have `.indexOf`) but must still not be accepted as an id. It contradicts the lane's own criterion "malformed raw values dropped without a fatal boot": it hardened `hpfc.scales` against exactly this input class (7 shapes, tested at `app.test.js:1075`) and left the sibling `hpfc.deck` unguarded; `app.test.js:1090` exercises only STRING ids so nothing catches it. Not reachable from app-written state today (the app only ever writes strings) - it becomes reachable through the very design this lane introduced, `hpfc` as an object shared with other features, plus the roadmap's JSON import/export into that key. Fix is one line at 2383 (`typeof store.deck === "string" ? ... : "hijaz"`), guarded at the READ, not coerced at the call site (`String(wantedDeck)` would mint the deck id `"5"`). Dispatched as lane 4b-fix with a test-first requirement including the share-link half, which the current suite cannot see. |
| 66 | #26 reviewer | open | Six non-blocking nits from #26, none dispatched, all deliberately kept OUT of the 4b-fix scope so the bounce stays one line. (a) `index.html:2477` `savedScales().filter(r => !r || r.s !== rec.s)` - the `!r ||` KEEPS falsy records instead of pruning them and the list has no cap, so corrupt entries accumulate permanently; `restoreScales` skips them safely, so junk, not a crash. (b) `index.html:2413` `isBuiltIn` is now dead in the app - its only consumer is `d_save_ignores_custom.patch`, so a future reader will delete it and break the mutant; it needs a comment saying why it stays. (c) `tests/share.test.js`'s comment stripper `/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g` is string-, template- and regex-unaware and gives false negatives on e.g. `const u = "https://x"; const b = Buffer.from("y");` - latent, not live, since `share.js` has no `//` or `/*` inside any string literal today. (d) `save()` is read-modify-write but not atomic across tabs; two tabs interleaving can still lose a sibling key - acceptable for localStorage, noted because sibling-key survival IS the feature. (e) `checkShareVersion` accepts `v = 0` and negatives where `share.js:264` rejects any lower wire version as corrupt - the two guards are not symmetric; harmless, `rec.s` is re-validated downstream. (f) `d_scales_trusts_record.patch`'s header claims the mutant "throws and takes the whole boot down"; the actual kill is `assert.deepStrictEqual(registry(), {})` at `app.test.js:1084` - a wrong-version record gets BUILT rather than throwing. Comment accuracy only; the mutant is genuinely killed. |
| 67 | #26 reviewer | note - process | The #26 reviewer disclosed that it used two verification subagents to parallelise evidence-gathering, against its brief's "no sub-reviewers". It re-verified the decisive blocking finding and every deviation verdict with its own commands (I re-verified the blocker independently too). Only two conclusions rest solely on a subagent: the nine-input `checkShareVersion` probe (the reviewer separately read the impl at 2434-2440 and the test at 931-946, and the `typeof`-first ordering makes it unambiguous) and the local `mutation_check.sh` run (113/124 killed, gate PASSED; the 11 unkilled are exactly the browser-gated `e_*`, which CI covers). Also, for the second review running, `/review` did not execute as a workflow: its preamble failed under the worktree isolation guard as predicted, and a literal-argument form that DID start echoed `SESSION_KIND: spawned`, whose Step 5 is Fix-First and auto-applies edits - so the reviewer stopped there deliberately, on read-and-report grounds, and worked the checklist by hand. Greptile, Review Army, the Codex adversarial pass, the slop scan, TODOS cross-reference, doc staleness and review persistence did not run. Standing consequence: for this repo the `/review` harness contributes nothing inside a worktree, and a reviewer brief should say so up front rather than budgeting for it. |
| 68 | lane 4b-fix | open - housekeeping, no lane owns it | Two side observations from the 4b-fix lane, neither in its scope nor anyone's yet. (a) **A dead lane's worktree still holds a branch ref.** `scale-engine/w13-persist-share` was checked out in the ORIGINAL 4b agent's worktree (`.claude/worktrees/agent-a977c8a0ef9144bda`) at the old SHA, so git refused a second checkout of that name. The fix lane worked around it correctly and without touching that worktree - local branch `lane-4b-fix` at 359f19c, then `git push origin HEAD:scale-engine/w13-persist-share` (fast-forward, no force). Standing lesson: a lane whose agent has died leaves its worktree behind holding the branch, and any follow-up lane on the SAME branch must push by refspec rather than checking the branch out. Prune that worktree at cycle close, after #26 merges. (b) `node_modules` is not in `.gitignore`; in a worktree it is a symlink to the main checkout's copy and shows as untracked. It is in no mutant's path set so `mutation_check.sh`'s dirty check ignores it, and no lane has ever git-added it - but every worktree lane has to notice this. A one-line `.gitignore` addition, deliberately NOT done here because it belongs to no lane and I am not widening a bounce. |
| 69 | #26 delta reviewer | closed - answered | The `mode` guard lane 4b-fix added alongside the deck-id fix was checked rather than assumed, and the lane's claim held: a non-string `mode` never threw on the old code (`setMode` calls no string method; `mode` is only ever compared `=== "A"` at `index.html:2635-2636` and `:2861-2862`), and for the valid stored values `"A"` and `"B"` old and new behave identically, so no legitimate mode is reset. The new guard is in fact an improvement - old `mode: 5` left `mode = 5`, rendered the mode-B face with NEITHER button lit, and persisted `5` back through `save()`; new normalises to `"A"` and self-heals. ONE residual nit, non-blocking and unreachable from the app's own `save()` (which only ever writes `"A"` or `"B"`): `store.mode === ""` used to be normalised by `"" || "A"`, and `typeof store.mode === "string"` now accepts it, so a hand-edited or foreign `hpfc` with an empty mode renders the mode-B face with neither button lit. `store.mode === "A" || store.mode === "B" ? store.mode : "A"` closes it if anyone tightens it later. |
| 70 | #26 delta reviewer | note - standing test hazard | **Never run `node --test` concurrently with `./tests/mutation_check.sh`.** The delta reviewer's first `node --test tests/app.test.js` reported a spurious failure because it raced a background mutation sweep, which rewrites `index.html` on disk while `boot()` re-reads it per test; a clean re-run gave 52/52. This is a third distinct way to get a false red in this repo, alongside row 59's local e2e flake and row 62's Chrome renderer wedge. Now carried in every lane brief. |
| 71 | main agent | closed - resumed | **Lane 4c returned without delivering.** It stopped on a self-spawned background watcher for the mutation sweep, reporting "36 killed, no survivors among my new patches; 5 pre-existing `d_`/`e_` patches went stale" and then "I'll wait for the background watcher to report." At that moment three commits (`c373a75` Edit state/rename/delete, `d4fdf6d` tests, `e83295c` doc nits) existed only in the worktree, the 15 new mutant patches were still UNTRACKED, `git ls-remote origin refs/heads/scale-engine/w14-edit-sheet` was empty and no PR existed. Resumed by SendMessage rather than re-spawned - the context is intact and the work is real, so a fresh lane would redo an hour of it. The resume message carries the `# kills:`/no-`# suite:` convention again (rows 57/65's correction), the never-`git add -A` warning (its worktree has an untracked `node_modules`, row 68b), the boundary rule that a stale `b_*` means STOP not regenerate, and an explicit instruction to block on `gh run watch` in the FOREGROUND. Counts as attempt 1 of 2 on the lane's shared counter. Standing lesson for future briefs: "PUSH BEFORE YOU RETURN" is not enough - say "do not delegate the wait to a background watcher and stop on it". |
| 72 | lane 4c self-disclosure | open - reviewer item | Three items the lane disclosed against itself, all handed to the #27 reviewer as first-class checks. **(a) The revert episode.** Mid-task, with the implementation UNCOMMITTED, the lane ran `git apply tests/mutants/d_no_deck_fallback.patch && node --test tests/app.test.js; git checkout -- index.html`; the `git checkout --` restored index.html to the base commit and destroyed all 13 edits, which the lane then re-applied BY HAND. Its claim is that the re-applied file is exactly what the tests cover and the only uncovered residue is comments. Highest-risk item in the PR: the failure mode of a hand re-application is a dropped `esc()`, an inverted comparison or a lost guard on a line no test names. Standing lesson: verify a mutant only on a COMMITTED tree, never against uncommitted work. **(b) `tests/helpers/sandbox.js` edited outside the lane's ownership list** (six ids appended to `ELEMENT_IDS`), justified because `tools/boot_sim.js` shares that sandbox, cannot call `registerIds`, and `tools/` was off-limits. Additive and behaviour-neutral would be a nit; behaviour-changing for any of the three consumers would be a blocker. **(c) `generateDeck` copies the parsed name onto `built.value.options.name`** because `HPE.select.build` consumes `seedOptions.name` into `deck.name` and never echoes it back in `options` (spec 13), so `seedOf(d)` would drop the name from the share URL and the saved record. App-side workaround, zero `src/engine` bytes changed. Must be proved unable to reach `core.deckId` - D14 hashes seed FIELDS only, and a name that reached the hash would mint a new deck on every rename. The clean fix, for whichever lane owns the engine next: have `select.build` echo the name back in `options`. |
| 73 | #27 reviewer | **OPEN - owner decision** | **A field edit forks a custom deck and leaves two identically-labelled chips.** Reproduced by the reviewer: open Edit on a custom deck, append one note to the SCALE box, tap SAVE CHANGES, and the registry ends up holding BOTH `custom:977311b5` and `custom:b174242c`; both stored records survive, the original deck is silently untouched, and the chip row reads `[..., 'D AEOLIAN 9', 'D AEOLIAN 9']` - two chips the user cannot tell apart. This is *structurally* required by D14 (the id IS the fields hash, so changing the fields cannot keep the id) and the lane has a passing test asserting the new id, so it is a deliberate consequence, not a defect. But nothing in the plan says what should happen to the ORIGINAL on a field edit: replace it (edit means edit), keep both (a fork is a new scale), or ask. The duplicate auto-label compounds it, and `autoName` lives in NEVER-TOUCH `src/engine/select.js`. Reviewer marked it `covered_by: "neither"`. Not implemented unasked - this is the owner's call, and it belongs beside row 39's open Pygmy question. |
| 74 | #27 reviewer | open - nits, no lane | Four non-blocking findings from #27, none fixed. (a) The three new Edit controls' 44px hit area is asserted only by CSS: `tests/e2e.test.js:824` opens the CREATE sheet, where the Edit rows are `hidden`, and its selector was not extended, so `min-height:44px` on `#scale-name`, `#scale-degrees` and `#scale-delete` is correct today but unguarded. (b) A rejected DECK NAME red-outlines the wrong field: typing `PAN CAFE` in the name box marks `#scale-box` and shows the note-flavoured `BAD_NOTE` copy. The message is spec-mandated (`core.js:172-174`; the section 2 enum is CLOSED so a rejected option can only be `BAD_NOTE`), but marking `#scale-box` rather than `#scale-name` is in-bounds and misleading. (c) Focus is lost after a delete: `deleteDeck` calls `closeScaleSheet()`, which focuses `sheetOpener` - the chip of the deck being deleted - and only then `selectDeck` rebuilds the chip row and discards that node, landing a keyboard user on `<body>`. Reasoned from code order at `index.html:2915-2923`; the reviewer did not confirm `activeElement` in a browser. `covered_by: "neither"`. (d) The `updateParse` listeners on the name field and degrees select are covered by no test and no mutant - every test sets `.value` and clicks SAVE, which reads `sheetOptions()` directly, so removing both listeners would fail nothing. |
| 75 | #27 reviewer | closed - correction recorded | **Lane 4c's regeneration self-report was inaccurate for two of five patches.** It claimed all five were "anchor-shift only, same `-`/`+` pair". Two were not: `d_mirror_ignored` moved from mutating `generateDeck(..., { palette, mirror })` to mutating `const o = { palette, mirror };` inside the new `sheetOptions()`, and `e_focus_not_returned` from `- addChip.focus();` to `- (sheetOpener || addChip).focus();`. Both changes were FORCED - the old lines no longer exist after the refactor - and both preserve the mutation's meaning, so this is a reporting inaccuracy with no defect behind it. Recorded because the "byte-identical `-`/`+`" phrasing in my briefs is too strong for a refactor: the right test is that the mutation's MEANING is preserved and the header is unchanged, which is what the reviewer actually applied. Reword future briefs accordingly. |
| 76 | main agent | DECIDED, flagged for owner | **Phase 5's encoding, decided by the integrator under the standing afk authorization because the plan specifies only "rotate / reorder, keyboard-accessible, never drag-only".** Five decisions, all pinned in lane 5's brief so the lane does not invent an encoding. **(1) One mechanism, two affordances:** exactly one new seed option, `order`; ROTATE is not a separate option, the control rewrites `order` as a cyclic shift. **(2)** `options.order` is a permutation over the non-ding fields in the order `collect()` yields; absent/null keeps today's `layout.solve` output byte-identical, which is what protects the built-ins and the whole existing suite. An invalid permutation is rejected through the result contract as `BAD_NOTE` - the section 2 enum is CLOSED, so no new code. **(3) Wire form:** a fifth options field, comma-separated decimal indices, inserted BEFORE `name` (which must stay last because it may hold any printable character): `palette \t parent \t mirror \t order \t name`. **(4) `share.VERSION` 1 -> 2, and `decode` becomes backward-compatible in the same change.** `share.js:263-264` currently reads `if (version > VERSION) NEEDS_NEWER_APP; if (version !== VERSION) badNote`, so a naked bump would make the new app reject every v1 link ever emitted as `BAD_NOTE`. Lane 5 must accept any `version <= VERSION` and dispatch to a per-version options reader, and test both directions. This is the one decision here with a real cost if wrong. **(5)** Rotating or reordering MUST keep the deck id, its progress and its chip position, and MUST change the share URL - D14 hashes seed FIELDS only. Flagged for the owner: if the intent was a purely local, unshared layout correction, (3) and (4) are unnecessary and lane 5's diff shrinks a lot. I chose shared because D12 calls the generated layout a guess and a correction that did not travel would make the same link render differently on two devices. |
| 77 | main agent -> #28 reviewer | open, handed to review | **Lane 6 returned done; PR #28 verified on all four gates and a fresh reviewer dispatched at 71318c11b42d98541da0822797f38a8db4890ff6.** Shipped: `tools/gen_deck.js` (six INLINED preset seeds, engine loaded through `tests/helpers/engine.js` `loadEngine`, a rejected seed exits 1 with the engine's own `CODE: reason`), an ADDITIVE adapter block in `tools/decks.py` (`GENERATED_OMITTED`, `_spec_from`, `_blurb`, `_legend_lines`, `_legend_demo`, `from_generated`), `tests/test_gen_deck.py` (13 tests incl. the runtime key-disposition gate and a real PDF build into a temp path via pymupdf), a `load_tests` bridge in `tests/test_pdf_build.py`, one FLOORS row, four `c_gen_*` mutants. Diff is 9 files, all inside lane 6's ownership; `index.html` and `src/engine/*` untouched. It synthesised 18 of the 19 built-in keys and omitted only `blank_cards`, with a stated reason. Six discrepancies were handed to the reviewer as first-class checks rather than accepted: (a) the invented geometry - `R = round(74.0/geom.ext, 1)`, `cy = 124.0`, `y_note`/`y_num` carried over - which the lane's own sanity check shows does NOT reproduce the built-ins (74.0 vs Hijaz 73.0, 58.3 vs Pygmy 60.0); (b) the `load_tests` bridge, which could silently load nothing and make all four new mutants vacuous while still reporting killed; (c) the lane's local sweep claim that only `e_*` was skipped for lack of a browser, against CI's green `js suites (unit + e2e)` job at the same SHA; (d) whether the key-disposition gate reads the built-in key set at RUNTIME so a key added later fails rather than passing silently; (e) that the six committed root PDFs and their mtimes are genuinely asserted unchanged, not decoratively; (f) that `gen_deck.js` makes no network call, since `fetch` fails under `file://`. **`not_done` from the lane: the six presets are NOT wired into the app UI** - correctly out of scope, since `index.html` belongs to lane 5. That wiring is an unassigned follow-up. |
| 78 | main agent | RECEIPT TAKEN | **Wave 6/7 milestone receipt: the share URL round-trip, taken adversarially against the SHIPPED `index.html` bytes rather than `src/engine/`.** I extracted all six engine regions from `index.html` with my own regex and ran them in one `node:vm` context, so this measures what GitHub Pages serves, not what the modules say. 9 round-trips: 3 seeds (Amara-shaped, Hijaz-shaped, and a Pygmy-shaped seed WITH a bottom shell) x 3 option sets (defaults; `palette 2 + mirror`; `palette 5 + parent 10 + a 13-char name`). Every one re-encoded to a byte-identical `formatSeed`, and **the deck id was stable per seed across all three option sets while differing across seeds** (`custom:977311b5`, `custom:626198f8`, `custom:9c58c4af`) - D14 holding empirically, not just by reading. Tamper half: five corrupt payloads (`""`, `"1"`, `"zzzz"`, `"1\tnope"`, `"9999\tx"`) all returned inside the CLOSED enum as `BAD_NOTE` and NONE threw. Version half: forging a version-2 byte onto a v1 payload returns `NEEDS_NEWER_APP`, and the gate deliberately fires BEFORE the checksum (`share.js:262-268`), so a future link is refused politely rather than as a corrupt one. Two apparent failures in the first pass were MY out-of-spec test data, not defects: a `°` in the name is correctly rejected because ENGINE-SPEC 13 (line 652-656) restricts names to printable ASCII and `core.js:170` implements exactly that as `NAME_RE = /^[\x20-\x7E]*$/`. Receipt: PASS. |
| 79 | main agent -> lane 5 | CORRECTED, lane re-briefed by SendMessage | **My decision D5-3 was wrong and is withdrawn.** The receipt put me in `share.js` and the shipped payload ALREADY reserves a third line for this exact feature: `share.js:240-242` builds `formatSeed(fields) + SEP + optionsLine(options) + SEP + ""` commented "line 2: reserved for Phase-5 layout deltas", and `share.js:279-281` enforces `LINES = 3` and `lines[2] !== "" -> badNote` commented "the reserved layout-delta section: empty in v1". I pinned "a fifth options field before `name`" without that reservation in front of me. It is also worse on the merits - the options line is tab-separated and `name` is its only free-text field, so widening that line puts the indices next to the one field a user controls. **Revised D5-3: the order permutation goes on LINE 2**, comma-separated decimal indices over the non-ding fields, empty meaning no delta; a v2 payload with an empty line 2 must round-trip identically to the v1 one apart from the version byte; the `lines.length !== LINES` check is unchanged, only whether line 2 may be non-empty, which the per-version reader decides. D5-1, D5-2, D5-4 and D5-5 all stand. **D5-4's trap is now confirmed empirically as well as by reading**: the forward direction already works (`NEEDS_NEWER_APP` above), but `share.js:264` is `if (version !== VERSION) return badNote(text)`, so a naked bump to 2 would make the new app reject every v1 link ever emitted as `BAD_NOTE`. Standing lesson: **read the code a pinned decision constrains BEFORE pinning it.** The receipt caught this only because it was taken against the shipped bytes; a decision doc reviewed on its own would not have. |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #27 | 4c | PASS_WITH_NITS | Gates re-verified independently at `5d60123`: PR OPEN/MERGEABLE/CLEAN on base main, `ls-remote` tip, and run 34351685494 `success` with a matching `headSha`, all five jobs green including the mutation gate. Merge-base `9a2d7c0` as briefed. **The revert episode came back clean, and provably so rather than by assertion:** the reviewer's decisive check was that `git diff 9a2d7c0..5d60123 -- index.html` contains exactly TEN deleted lines and every one is paired with a deliberate replacement at the same site (the `writeScales` extraction, the Edit-vs-select ternary, `sheetOptions()`, `showSheet(opener)`, `(sheetOpener \|\| addChip).focus()`, the SAVING label, the two `generateDeck`/`onclick` call sites, the Edit-aware stop list) - a hand re-application that silently dropped a base line would surface as an unpaired `-`, and there are none. It then read all 168 changed lines: no dropped `esc()`, no inverted comparison, no lost guard, Tab-stop indices unchanged, every added comment cross-checked against the code it describes. It listed the lines covered by neither a test nor a mutant and judged each (row 74d). **(B) sandbox.js is additive and behaviour-neutral:** six ids APPENDED, nothing removed or renamed; served elements default to `tagName: "DIV"` with no class, so the `.announce`, `header, main, footer` and tag queries are unaffected, and the only reachable change is that `getElementById` stops throwing for ids `index.html` now really has. The justification holds - `registerIds()`/`opts.extraIds` are per-boot and cannot reach `tools/boot_sim.js`, which boots the same file and would throw on a missing `#scale-name`, and editing `tools/` was NEVER-TOUCH. Ownership nit, acked. **(C) the name carry-back cannot move the id:** `select.js:437` really does omit `name` from the echoed options; `git diff --stat 9a2d7c0..5d60123 -- src/engine tools` is EMPTY; `core.deckId` is `"custom:" + fnv1a32(formatSeed(fieldsOf(...)))` at `core.js:413-415` and `build` calls it as `deckId(fields)`, so options are never in scope - confirmed empirically by renaming a deck and keeping `custom:977311b5`. **CRITICAL regression non-vacuity proved by application:** `d_no_deck_fallback.patch` took `app.test.js` from 62/62 to 59 pass / 3 fail, killing all three fallback assertions including 4b-fix's non-string one; reverted with `git apply -R`, `git status` empty and `HEAD^{tree}` identical before and after. The delete message did NOT leak onto the built-in branch - the boot tail is unchanged and still gated on `wantedDeck.indexOf("custom:") === 0`, while `"Removed X. Showing Y."` lives only inside `deleteDeck`. All 139 patches pass `git apply --check` so nothing went stale and no `b_*` moved; all 15 new patches lead with `# kills:` naming a real test and none carries `# suite:`. Local: app 62/62, e2e 21/21 under `chrome-headless-shell` with `scrollWidth <= clientWidth + 1` at 380px and `--card-w` unmoved. Swatch probe confirmed TIGHTENED not loosened - the 44px `::after` at `index.html:140-141` is untouched by this lane and +/-21 is stricter than +/-18 on it. `inline_engine.py --check` OK, `validate.py` 4/4, only the two named FLOORS rows moved. Four nits (row 74), one owner decision (row 73), one correction to the lane's self-report (row 75). `/review` again did not run; no subagents spawned. Could not run: the local mutation sweep (relied on CI's green gate at the SHA plus `git apply --check` on all 139 and reading all 20 patch bodies) and a browser check of the post-delete `activeElement`. | merged 23f5947 |
| #26 (delta) | 4b-fix | PASS_WITH_NITS | Delta review at exactly `bd079f4`, scoped to the two fix commits; everything already cleared at 359f19c was explicitly off the table. Gates re-confirmed independently: PR OPEN, `mergeStateStatus=CLEAN`, run 34346427852 `success` with `headSha` an exact match, 5/5 jobs. Delta file set confirmed as exactly the four named. **The reviewer refused to read the lane's test and wrote its own probe** driving the real `sandbox.js` boot harness across 9 stored values - the 6 briefed plus `""`, `0`, `1.5` - each booted twice, bare and with a real `#s=...` hash: all 18 cases no throw, fallback to `hijaz`, `<svg` rendered, announcer empty when bare, and `deckId` == the SHARED deck id when the hash is present. `["custom:x"]` is correctly rejected despite having `.indexOf`. Non-vacuity proved by applying `d_deck_id_untyped.patch` and reproducing the exact original defect (`TypeError: wantedDeck.indexOf is not a function` at index.html:2895), then reverting with tree hash `b00b5f50...` and index.html md5 `b61e0aa7...` restored. It independently confirmed the lane's honesty about the pre-fix split: `5`, `{}`, `true` and `1.5` throw; `null`, `[1,2]`, `["custom:x"]`, `""`, `0` pass either way as regression guards. The share half is real, not decorative: the payload is built through the app's own `shareLink()` at `app.test.js:903` and `assert.strictEqual(shared.deckId(), made.id)` cannot pass unless `openShare` actually ran. Fix confirmed at the READ - zero `String(` anywhere in the delta, and the boot tail is byte-identical at both SHAs (md5 `ae95bb68...`). The `d_*` header convention was verified against ALL 39 patches, not the two I asked for: every one leads with `# kills:` and ZERO carry `# suite:`, so the lane followed the file convention correctly over my brief's wording. Full local sweep 125/125 killed with zero survived/stale/broken/timeout/skipped; the `const DECKS` line hashes identically at both SHAs INCLUDING its line number; `inline_engine.py --check` OK; engine regions end at 2366 and the delta touched 2380-2390. All six known nits confirmed still untouched (the `!r ||` and dead `isBuiltIn` merely shifted +4). One nit: row 69's empty-string mode. `/review` again did not run. No subagents spawned this time. | merged 9a2d7c0 |
| #26 | 4b persist + share wiring | FAIL (attempt 1) | CI run 34343964932 success at exactly 359f19c8, 5/5 jobs; head SHA and CI both clean - the FAIL is on code content. ONE blocker (row 65): a non-string `hpfc.deck` throws at `index.html:2891` and silently drops an incoming share link. **All four self-reported deviations CLEARED, each by measurement rather than by the lane's word.** (i) The two NEVER-TOUCH `e_*` patches: `# kills:` headers byte-identical on both sides (neither has a `# suite:` line), same semantic edit both sides (`e_deck_order` still removes `setOrder()` from `selectDeck`; `e_persist_save` still neuters `save()` to `() => {}`), changes confined to hunk line numbers, blob hashes and context lines the lane's own `save()`/boot rewrite moved; both apply cleanly to HEAD, kills resting on CI's mutation-gate job since this host has no browser. (ii) The `b_*` regeneration is anchor-shift only: the `DECKS` line hashes IDENTICALLY to main (`1e3de4f7...` both sides), and across all ten patches the diff is the same three mechanical changes - blob hash `d2aeb5a->b018e51`, hunk line `1968->2367`, and one trailing context line - with the mutated `+const DECKS` payload lines absent from the diff entirely. (iii) Replacing `d_save_persists_custom` with `d_save_ignores_custom` is legitimate, not a weakening: the two are exact inverses, and the OLD mutation (`if (isBuiltIn(id)) storedDeck = id;` -> `storedDeck = id;`) IS the new correct code, so against HEAD it would be a no-op patch that can never be killed; the new one runs the substitution in the opposite direction and catches reinstatement of the lifted Phase-3 guard. The only coverage lost is the assertion task 5 chartered its deletion. (iv) The comment-strip in task 7 is sound today and the deviation was NECESSARY: injecting `Buffer.from("x")` as code turns the test red while main's `(`-anchored regex misses it entirely, `new CompressionStream("gzip")` and bare `typeof Buffer` are also caught where main misses both, unmutated `share.js` passes, and without the strip the literal charter instruction goes red on share.js's own docstring `btoa`. **CRITICAL regression verified by EXECUTION**: applying `d_no_deck_fallback.patch` fails all three fallback tests (`:356`, `:497`, `:1090`), then reverted with the `index.html` hash restored. Both pre-existing assertions byte-identical to main, only moved. `d_share_version_literal`'s kill MECHANISM confirmed, not just its label: `app.test.js:923-926` regexes the declaration RHS out of the app's own script block, RHS `"HPE.share.VERSION"` -> true and RHS `"1"` -> false, so the kill is independent of value equality while 1 is still current. `NEEDS_NEWER_APP`'s announcer text is character-identical to the spec row read at test time by `specReason()`. All 124 patches apply cleanly. Ownership clean: `src/engine/`, `docs/`, `tests/e2e.test.js`, `tools/decks.py`, `tools/hifi.py` untouched, `inline_engine.py` is the MODULES line only, zero `<script src`. FLOORS `41 -> 51` the sole row. Nits: rows 66, 67. | bounced to lane 4b-fix, attempt 1 of 2 |
| #25 | 3b scale sheet UI | PASS_WITH_NITS | CI run 34340178528 success at exactly f39a7a1, 5/5 jobs, 116/116 mutants killed with zero survived/stale/broken/skipped, e2e ran 15 with a REAL browser and 0 skipped. **The CRITICAL regression was verified by EXECUTION, not by grep**: `tests/app.test.js` is +259/-0 (zero deleted lines, counted), and both fallback halves are byte-identical to main (lines 356-367 sha `d63bdb98...`, lines 491-495 sha `725e6690...`); the reviewer then APPLIED `d_no_deck_fallback.patch` and confirmed BOTH tests fail, then reverted. Row 56 resolved: it parsed -U0 hunk line numbers against the engine-region ranges on both sides and found zero added and zero removed lines inside any region - the block shifted +81 lines wholesale - and `inline_engine.py --check` passes on the branch. Deck data proved unchanged by hashing: the `DECKS` line (8359 bytes, sha `a5f6ef6f...`) and the whole 1111-line marker-anchored geometry region (52661 bytes, sha `5c6f59ce...`) are byte-identical to main. The one-generation-path spy was judged genuine rather than theatre, because `d_warnings_rebuild` adds a second `generateDeck` call producing IDENTICAL text, so only a call count can see it - and it is killed. All 18 new mutants verified killed LOCALLY as well as by CI, and `git apply --check` over all 116 shows 0 stale. **Both e2e "fixes" were checked for vacuity and STRENGTHEN instead**: the nav latch THROWS into later tests (a failure, not a skip), the `Page.loadEventFired` change kept the readyState assertion and ADDED a `window.__stale` sentinel proving a fresh document committed, and the wait selector was tightened to exclude the `+ ADD` chip that ships in the markup and could satisfy the old wait before boot. `/review`'s harness could not start under worktree isolation (its preamble computes its executable at runtime), so Greptile, Review Army and the Codex pass did NOT run and the reviewer worked the checklist categories by hand; the live one was Unsafe HTML/XSS, since user-typed scale text now reaches `innerHTML` via custom deck names - both sinks escape through `esc()` in text position. Nits: rows 63, 64. | merged ad3ac98 |
| #23 | 4a share encoding | PASS_WITH_NITS | boundary CLEAN: the diff is exactly `src/engine/share.js`, `tests/share.test.js`, 7x `tests/mutants/h_*.patch` and ONE line of `tests/suite_health.py` (`tests/share.test.js` 0 -> 25); no index.html, no other engine module, no tools/, no docs, no fixture, no other FLOORS row, `LEGACY_*` untouched. CI run 34323613506 success at exactly 73e89b3 (the reviewer confirmed it was not reading the stale pre-rebase run 34321473048); all 5 jobs green; 98/98 mutants killed incl. all 7 `h_*`, and `git apply --check` over all 98 shows 0 stale despite 37 carrying index.html context. **The reviewer refused to trust the lane's own tests and re-derived the hard criteria itself.** Integrity: 70,686 single-character mutations across 16 real seeds (every position x every one of the 63 other alphabet characters) - 0 accepted, 0 thrown, including the last body character's unused low bits and every position inside the 6-char check block. Hostile input: 200,000 random v1-prefixed strings, then the harder test - it REIMPLEMENTED the FNV independently and fed 100,000 forged strings carrying VALID checksums, so the attacker controls everything past the integrity gate: 0 throws, 0 accepted, 100,000 clean `BAD_NOTE`. Round trip: 14 deep-equal (11 ok fixture rows + 3 golden maker_strings) plus a 144-case option matrix (palette x parent x mirror x 13 names), 0 lossy, `deckId` unchanged across every option set. Losslessness is structural, not lucky: `core.NAME_RE = /^[\x20-\x7E]*$/` excludes `\t` and `\n`, so the separators are unambiguous by construction. Seed-not-deck proved by mangling every field's zone and angle and getting a byte-identical string. Cap is the FIRST gate (share.js:257, before the version byte and the checksum), bounding hostile work at O(512). No global state: `INDEX` built once, sandbox keys unchanged after hundreds of calls. `NEEDS_NEWER_APP`'s reason is character-identical to spec section 2's row. The `BAD_NOTE` reuse for a corrupt/over-cap payload and for a version byte BELOW VERSION was judged CORRECT, not a shortcut, against `DECIDED(D13)`'s unparseable-token rule. `/review` sub-checks that ran: scope drift (CLEAN), and Enum & Value Completeness is the one that mattered - tracing `REASONS`/`NEEDS_NEWER_APP` through consumers outside the diff is what surfaced rows 58 and 46. SQL/race/LLM/shell checks all N/A for a pure-function diff. Nits: rows 57-59, plus three recorded here as non-actionable - `decode(Object.create(null))` throws from `String(token)` (unreachable from a URL string, and `core.parseSeed` behaves identically), `CAPS` is exported mutable (same convention as `core.CAPS`), and share.js duplicates ~60 lines of `ok`/`err`/`badNote`/`utf8Bytes`/FNV from core.js because core exports no shared-helper surface (a later call, not this lane's). | merged f244f52 |
| #22 | 3a app plumbing | PASS_WITH_NITS | scope CLEAN over 29 files; CI success at 86fe974 (reviewer re-read it: exact headSha, only run at that commit, all 5 jobs). **The built-ins-unchanged claim was verified, not assumed**: the DECKS literal has the same SHA-1 on both sides, no built-in geom carries an `ext` key so `pan()` takes the historical branch untouched, boot_sim reports 59 cards x 2 modes, validate.py check 1 still ties app JSON to decks.py, and Amara's rendered viewBox is still `-106 -106 212 212`. `ext` truthiness proved safe at layout.js:237-248 (reach starts at 1, ext = reach + 0.06, minimum 1.06 - 0 unreachable). Desync check exercised against all FOUR failure classes by hand (differing/missing/unknown/wrong-order), each giving a specific failure; b_engine_desync kills non-vacuously. inline_engine.py proved verbatim and idempotent (second sync left the file SHA unchanged). save() verified empirically: custom deck leaves storage at pygmy, unknown stored id falls back to DECKS[0] and renders. Engine-runs-once identity holds across render/render/step. Boot-order pitfall intact (`if (!order.length) return;` at index.html:2137). **r_yaxis_sign (the out-of-owned-set patch) verified byte-identical in its mutation lines** - only hunk headers and the genuine `ext` context line moved; same check passed on all 17 re-derived patches, with 4 changing only because the mutated line itself changed and e_deck_order moving to the single selection path (equivalent or stronger). No hidden card-count dependency on #21: every generated-deck assertion is relative (`chords.length`). Reviewer additionally traced the new `custom:` id kind through every consumer, confirmed nothing reads the absent `.sub`, and probed the parser with three HTML-injection scale strings - all rejected BAD_NOTE, and CUSTOM is `Object.create(null)` so `constructor` cannot resolve to a prototype member. Nits: rows 46-48. | merged e348de7 |
| #21 | 2b select cap | PASS_WITH_NITS | boundary clean over 9 files; CI success at c4d240f (reviewer re-read it: exact headSha, all 5 jobs); all 12 `s_` mutants killed, 0 survived; 35/35 select + 100/100 sibling engine suites. Reviewer independently RE-DERIVED the divergence fixture by running `build` on all three frozen seeds - every `missing`/`extra` set matches, so the fixture was regenerated and not hand-edited. Confirmed the cap counts every zone at select.js:106-110 via an unfiltered `ids()`; hijaz/amara serialise byte-identically to main; only pygmy moved (13->10 missing, 13->16 extra, exactly the named keys). **The fixture edit judged sound and, more to the point, structurally unfakeable**: select.test.js:556-572 requires every override to also appear in a live-derived `missing`, so a laundered override fails the suite. The three removed overrides cited the 25-cap as their entire reason and are now generated identically; the three rewritten notes changed only the clause after the `;`, leaving each primary reason and spec citation byte-identical. Worked example not weakened (still asserts 25 cards, gains fieldCount/cap assertions); structural-max test uses the formula. No `select.CAP` consumer anywhere incl. index.html and tools/. Nits: rows 43-45. | merged dd9d501 |
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

Cycle: 1   Wave: 7   Merged this batch: fa9468d (hotfix), 66453e8, 386a856, d6935d1, 5f03262, 40ff645, 6467a33, 5c26ae0, 4f5137c, ceaac1f, dad182c, c94b43c, dd9d501, e348de7, f244f52, ad3ac98, 9a2d7c0, 23f5947
PHASES 0, 1, 2, 3 AND 4 ARE ALL COMPLETE. Remaining: Phase 5 (layout customisation - rotate/reorder, keyboard-accessible, never drag-only) and Phase 6 (tools/gen_deck.js + the decks.py adapter for the print-only per-deck keys, presets as INLINED seeds) (its engine half, share.js, is merged; its wiring half is lane 4b, running). All five engine modules are on main, and the engine is now INLINED INTO index.html behind a desync gate, with the custom-deck registry, generateDeck(), the share-version guard and pan() ext support - all with no UI. Wave 5 (2b cap, 3a app plumbing) is merged. Wave 6 = lane 3b (the scale sheet UI, index.html) and lane 4a (the share encoding ENGINE MODULE), running in parallel. They are disjoint by construction: 4a owns only src/engine/share.js, tests/share.test.js, tests/mutants/h_* and the share.test.js FLOORS row, and is explicitly forbidden to touch index.html or tools/inline_engine.py. That is safe because inline_engine.py's MODULES is an EXPLICIT LIST (core, voicing, layout, naming, select), not a glob over src/engine/*.js, so a new unlisted module cannot trip validate.py check 4; wiring share.js into index.html and into MODULES is deliberately deferred to the Phase 4 wiring lane, which also owes the queue row 46 type check. The wave 5/6 milestone receipt is TAKEN and recorded as queue row 50 (row 49 closed).
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0a | released | released | scale-engine/w1-spec | #10 | b81ad84 | 2026-09-08 run 34288832378 success | PASS_WITH_NITS | 2 (cap) | yes 386a856 | - | no |
| P0b | released | released | scale-engine/w2-corpus | #9 | da34ba2 | 2026-09-08 gh pr view + run 34284011482 success | PASS_WITH_NITS | 0 | yes 66453e8 | - | no |
| P0c | released | released | scale-engine/w3-harness | #11 | 4eafe8e | 2026-09-08 gh pr view + run 34308168091 success | PASS_WITH_NITS | 1 | yes d6935d1 | - | no |
| P0d | released | released | scale-engine/w5-core | #14 | 6a24d38 | 2026-09-08 gh pr view + run 34309621849 success | PASS_WITH_NITS | 0 | yes 40ff645 | - | no |
| 1A | merged, released | agent-managed | scale-engine/w6-voicing | #15 | 75e1981 | 2026-09-08 gh pr view + run 34312798919 success | PASS_WITH_NITS | 1 | yes 4f5137c | - | no |
| 2 | merged, released | agent-managed | scale-engine/w9-select | #19 | d6e1740 | 2026-09-09 (gh pr view CLEAN + run 34317045654 success at that exact SHA) | PASS (rebase re-review) | 1 | yes c94b43c | - | no |
| 2b | merged, released | agent-managed | scale-engine/w10-select-cap | #21 | c4d240f | 2026-09-09 (gh pr view OPEN + run 34318930997 success at that exact SHA) | PASS_WITH_NITS | 0 | yes dd9d501 | - | no |
| 3a | merged, released | agent-managed | scale-engine/w11-app-plumbing | #22 | 86fe974 | 2026-09-09 (gh pr view OPEN + run 34319025044 success at that exact SHA) | PASS_WITH_NITS | 0 | yes e348de7 | - | no |
| 3b | merged, released | agent-managed | scale-engine/w12-scale-sheet | #25 | f39a7a1 | 2026-09-09 (gh pr view OPEN + MERGEABLE + base main, origin tip and run 34340178528 success all at that exact SHA) | PASS_WITH_NITS | 0 | yes ad3ac98 | - | no |
| 4b | merged 9a2d7c0, released | agent gone (original 4b context lost; ListAgents shows only 3b and the reviewer) | scale-engine/w13-persist-share | #26 | 359f19c | 2026-09-09 (gh pr view OPEN + MERGEABLE + base main, origin tip and run 34343964932 success all at that exact SHA, 5/5 jobs green) | FAIL+1 (row 65) | 1 | no | - | yes |
| 4b-fix | merged, released | agent-managed | scale-engine/w13-persist-share (a66473f, bd079f4 on top of 359f19c; fast-forward push by refspec, no rebase/amend/force) | #26 | bd079f4 | 2026-09-09 (gh pr view OPEN + MERGEABLE + base main, origin tip and run 34346427852 success all at that exact SHA, 5/5 jobs; delta is exactly index.html, tests/app.test.js, tests/mutants/d_deck_id_untyped.patch, tests/suite_health.py) | PASS_WITH_NITS | 1 (shared counter with 4b) | yes 9a2d7c0 | - | no |
| 5 | spawned | agent-managed | scale-engine/w15-layout-custom | - | - | - | - | 0 | no | - | - |
| 6 | returned done; review dispatched | agent-managed | scale-engine/w16-print-presets | #28 | 71318c1 | 2026-09-09 (gh pr view OPEN + MERGEABLE + CLEAN + base main, ls-remote tip and run 34355216426 success all at that exact SHA, workflow validate, 5/5 jobs green) | pending | 0 | no | - | - |
| 4c | merged, released | agent-managed | scale-engine/w14-edit-sheet (c373a75, d4fdf6d, e83295c, 5d60123) | #27 | 5d60123 | 2026-09-09 (gh pr view OPEN + MERGEABLE + CLEAN + base main, ls-remote tip and run 34351685494 success all at that exact SHA, workflow validate) | PASS_WITH_NITS | 1 | yes 23f5947 | - | no |
| 4a | merged, released | agent-managed | scale-engine/w6-share | #23 | 73e89b3 (post-rebase) | 2026-09-09 (gh pr view OPEN + MERGEABLE, origin tip and run 34323613506 success all at that exact SHA) | PASS_WITH_NITS | 0 | yes f244f52 | - | no |
| resync | merged, released | agent-managed | fix/engine-resync-select | #24 | c23caf3 | 2026-09-09 (gh pr view OPEN + run 34322097899 success at that exact SHA) | PASS_WITH_NITS | 0 | yes fa9468d | - | no |
| 1B | merged, released | agent-managed | scale-engine/w7-layout | #17 | 1e4d795 | 2026-09-08 gh pr view + run 34311187834 success | PASS_WITH_NITS | 0 | yes 6467a33 | - | no |
| 1C | merged, released | agent-managed | scale-engine/w8-naming | #16 | 2078bf3 | 2026-09-08 gh pr view + run 34312599567 success | PASS (rebase re-review) | 1 | yes 5c26ae0 | - | no |
| 1C-2 | merged ceaac1f; released | agent-managed | scale-engine/w8b-naming-numerals | #18 | 5eee2da | 2026-09-08 (gh pr view + origin tip + run 34314377350 success) | PASS_WITH_NITS | 0 | yes | - | no |
| P0b2 | released | released | scale-engine/w4-corpus-mutant | #13 | 619619d | 2026-09-08 gh pr view + run 34309255857 success | PASS_WITH_NITS | 0 | yes 5f03262 | - | no |

### Review log addendum

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #24 | integrator hotfix (engine re-sync) | PASS_WITH_NITS | Reviewer did not take the tool's word for the re-sync: it extracted every engine region from index.html with its own regex and sha256'd each against `src/engine/*.js` - core d0fa9459, voicing be47594d, layout f22bce6d, naming c1131950, select 7aa0220c, all five identical. Idempotence proved (re-running the tool left index.html's sha256 unchanged, `git status --porcelain` empty). Confinement proved exhaustively rather than by hunk headers: the four other engine regions are byte-identical main-to-reviewed, and index.html sliced at the block anchors is byte-identical on BOTH the pre- and post-slices. Criterion 4 proved by construction: `src/engine/select.js` is byte-identical at dd9d501, at main and at the reviewed SHA (this PR touches no src/), so the inlined region IS 2b's merged change; `cap()` confirmed to count every field via the unfiltered `ids()` at select.js:72-79. Before-state independently confirmed: main's run 34320847182 failed at exactly 96b4b51 with 4 of 5 jobs red, and main's inlined select hashed f6944c28 against its own src at 7aa0220c, carrying `var CAP = 25` with no CAP_BASE. Dropped `CAP` export proved dead by repo-wide grep (only select.js itself and the already-merged s_cap_* patches). All 91 mutant patches verified to apply cleanly with `git apply --check`, checked because 37 of them encode index.html context lines and could have gone stale; b_engine_desync targets the byte-unchanged engine:core region. Behaviour delta stated honestly: the trim point only, identical below 13 fields; built-ins cannot move because the DECKS literal sits outside the engine block and `generateDeck()` is the engine's only caller. Nits: rows 54-56. | merged fa9468d |
