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

### P0b2, P0d, 1A, 1B, 1C, 2, 3a, 3b, 4
Written when their wave opens, from the plan rows and the acceptance table.

## Status

| Lane | Current branch | State | Last verdict | Last update (UTC) |
|---|---|---|---|---|
| P0a | scale-engine/w1-spec | spawning | - | 2026-09-08 |
| P0b | scale-engine/w2-corpus | spawning | - | 2026-09-08 |
| P0c | scale-engine/w3-harness | spawning | - | 2026-09-08 |

## Handoff queue (append-only)

| # | From | Ask | Status |
|---|---|---|---|
| 1 | main | P0b's `f_fixture_sha.patch` moves to lane P0b2 after P0c merges (prefix unknown to the pre-P0c gate) | open |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|

## Cycle state

Cycle: 1   Wave: 1   Merged this batch: -
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0a | - | - | scale-engine/w1-spec | - | - | - | - | 0 | no | - | - |
| P0b | - | - | scale-engine/w2-corpus | - | - | - | - | 0 | no | - | - |
| P0c | - | - | scale-engine/w3-harness | - | - | - | - | 0 | no | - | - |
