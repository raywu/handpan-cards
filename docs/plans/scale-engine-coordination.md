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

### 1A, 1B, 1C, 2, 3a, 3b, 4
Written when their wave opens, from the plan rows and the acceptance table.

## Status

| Lane | Current branch | State | Last verdict | Last update (UTC) |
|---|---|---|---|---|
| P0a | scale-engine/w1-spec | merged 386a856 | PASS_WITH_NITS (3rd) | 2026-09-08 |
| P0b | scale-engine/w2-corpus | merged 66453e8 | PASS_WITH_NITS | 2026-09-08 |
| P0c | scale-engine/w3-harness | merged d6935d1 | PASS_WITH_NITS (2nd) | 2026-09-08 |
| P0d | scale-engine/w5-core | spawned | - | 2026-09-08 |
| P0b2 | scale-engine/w4-corpus-mutant | spawned | - | 2026-09-08 |

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

## Cycle state

Cycle: 1   Wave: 2   Merged this batch: 66453e8, 386a856, d6935d1
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0a | released | released | scale-engine/w1-spec | #10 | b81ad84 | 2026-09-08 run 34288832378 success | PASS_WITH_NITS | 2 (cap) | yes 386a856 | - | no |
| P0b | released | released | scale-engine/w2-corpus | #9 | da34ba2 | 2026-09-08 gh pr view + run 34284011482 success | PASS_WITH_NITS | 0 | yes 66453e8 | - | no |
| P0c | released | released | scale-engine/w3-harness | #11 | 4eafe8e | 2026-09-08 gh pr view + run 34308168091 success | PASS_WITH_NITS | 1 | yes d6935d1 | - | no |
| P0d | live | agent-managed | scale-engine/w5-core | - | - | - | - | 0 | no | - | - |
| P0b2 | live | agent-managed | scale-engine/w4-corpus-mutant | - | - | - | - | 0 | no | - | - |
