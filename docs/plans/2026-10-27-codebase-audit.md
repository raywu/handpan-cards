# Codebase audit (read-only), 2026-10-27

Lane AU of workstream afk-2026-10-27. Base: `origin/dev` 8e8ca047. Nothing was
deleted, edited or refactored; this file is the only change. Every finding below
carries the command or file:line that produced it, run on that base. Counts and
line numbers drift: re-run the command before acting.

Generated sources are excluded from "duplication": the `engine:*` regions of
`index.html` (`python3 tools/inline_engine.py --check` prints "match src/engine/: OK")
and the `const DECKS` line (`python3 tools/sync_decks.py --check` prints "OK").

## 1. Dead or unreferenced files

Method: a node scan listing every file in `tools/`, `tools/probe/`,
`tests/fixtures/`, `tests/helpers/` and `tools/research/` whose basename appears
in no other file outside `docs/plans`, `docs/prompts` and `docs/handoff`.

- No orphan found. Every tool, probe, fixture and helper is named by at least one
  other file. The weakest links (exactly one referrer):
  - `tools/preview.sh` is named only by `README.md`; no test or workflow runs it.
  - `tools/freeze_order_follow_base.js` is named only by `tests/fixtures/order_follow_base_aabcc0c.json`
    (a 1.4 MB frozen base, the largest fixture: `ls -la tests/fixtures`). It is a one-shot freezer.
  - `tools/pdf_adapt.js` (only `tests/test_pdf_deck_adapter.py`), `tools/pdf_smoke.js`
    (only `tests/test_pdf_emitter.py`), `tools/regen_import_gold.js` (only `tests/import_gold.test.js`).
  - Fixtures with one referrer: `golden_decks_v7.json` (`tests/test_deck_data.py:615`),
    `i18n_contract_v1.json`, `i18n_english_dom_v1.json`, `seq_ui_base_e728912.json` (`tests/app.test.js`),
    `import_cases_v1.json`, `sequence_tier_golden.json`.
- `golden_decks_v3`, `v7` and `v8` coexist. v3 is read by 6 suites (`core`, `naming`, `select`, `voicing` and `share` `.test.js`, and `test_fixture_integrity.py`), v7 by `test_deck_data.py`
  only, v8 by `test_fixture_integrity.py` and a mutant. Whether v7 is superseded by v8 needs a
  human read of `tests/test_deck_data.py:615`.
- `tools/research/engine_measure/` (11 scripts, 48 KB) is named by no code, test or workflow, but `docs/SCALE_ENGINE_PLAN.md:14`, `:672` and `:777` cite it as provenance for binding engine decisions. Keep it unless the owner retires those citations.
- `tools/probe/panel_fit.js` is live (CI jobs "panel fit (fallback)" and "panel fit (real)").
- `docs/plans/import-v2-gold.json` (36 KB), `docs/plans/2026-10-22-refactor-pass-7-probes/`
  and `docs/ui/` (732 KB) are data or artefacts under `docs/`, referenced only by plans.

## 2. Stale plan docs

- `docs/plans/` holds 151 entries, 7.5 MB of 8.7 MB in `docs/` (`du -sh docs docs/plans`);
  `wc -l docs/plans/*.md` totals 70,197 lines.
- 58 of 147 plan `.md` files are named by nothing outside `docs/plans/`. Oldest to newest
  examples: `2026-09-16-root-instance-enumeration.md`, `2026-09-18-queue-drawdown.md`,
  `2026-09-22-ios-print-*.md` (3), `2026-09-30-quality-refactor*.md`, `2026-10-05-refactor-pass-3*.md` (3),
  `2026-10-14-refactor-pass-5*.md`, `2026-10-17-refactor-pass-6*.md`, `2026-10-22-print-header.md`,
  `2026-10-24-naturalness*.md` (3), `2026-10-24-main-release-queue.md`. All of the above belong to
  work that CLAUDE.md or memory records as COMPLETE or MERGED (refactor passes 3 to 7, difficulty, tier rebalance); completion for the naturalness and main-release-queue plans is recorded in `docs/WORKSTREAMS.md`.
- `docs/plans/drawer-polish-plan.md` and `scale-engine-coordination.md` are the only undated
  plan names; they break the `YYYY-MM-DD-` convention and sort apart.
- Top-level `docs/` carries overlapping handoff-style files: `CLAUDE_RETURN_HANDOFF.md` (158 lines),
  `CLAUDE_TAKEOVER_PLAN.md` (201), `DEVELOPMENT_CONTINUITY.md` (35), `WORKSTREAMS.md` (1,120, a
  single ledger whose top entry is the 2026-10-26 RC release), `2026-09-16-mobile-audit-pass-1.md`.
  `docs/SCALE_ENGINE_PLAN.md` (828 lines, last touched 2026-10-23) is binding per CLAUDE.md, so it is not stale.
- An inventory already exists: `docs/plans/2026-10-25-plan-inventory.json` and
  `2026-10-25-plan-relevance-audit.md`. This audit's 58 is a reference-graph count, not a relevance
  verdict; defer to that audit's dispositions before archiving anything.

## 3. Duplicated logic, src/engine versus app code in index.html

Method: node scan extracting every function/arrow name from `src/engine/*.js` (except fontdata)
and testing the 6,859 non-engine, non-DECKS lines of `index.html` for a same-named top-level definition.

- Only three same-name hits, none a true duplicate:
  - `escapeText` at `index.html:9634` escapes HTML (`& < >`); `src/engine/pdf.js:47` escapes PDF
    string text. Same name, different job. Renaming one would remove the false lead.
  - `bottomAngles` at `index.html:11914` is a thin reader over `lastSolved.fields`; `src/engine/layout.js:156`
    computes the ring. Not duplicate.
  - `rank` at `index.html:11963` is a local sort key; `select.js` `rank` is the chord ranker.
- Small numeric duplication (two hits are generated engine copies, the rest app-side):
  - `index.html:6122` and `6127` fall inside the generated `engine:layout` region (6040-6792) and are copies of `src/engine/layout.js:81` and `:86`; they are not duplication.
  - App-side sites only: degree to radian `* Math.PI / 180` at `index.html:10300` and `13265`; angle wrap `((a % 360) + 360) % 360` at `11910` (`turnTo`). `11796` (`placeOf`) is a 22.5 degree bucket into 8 places, not a plain wrap. Engine twins exist in `layout.js`, `pdf.js`, `pdfcards.js`. A shared helper would remove about three copies. Low value, low risk.
  - `PC_NAMES` is defined in `src/engine/voicing.js:26` only (index copy at 5745 is its inlined region); app code
    has no second copy. Good.
- Label-rule constants (`0.8232`, `0.70875`, `0.80325`) occur zero times in app code: the single-source rule
  documented in CLAUDE.md holds. `OCTAVE_RATIO = 0.66` at `index.html:4668` is inside the core region.
- Cross-language duplication is by design and test-pinned: `tools/hifi.py` versus `src/engine/pdfcards.js`
  (`tests/test_render_agreement.py`), and `PC` helpers in Python. Not an audit finding.
- Verdict: duplication between engine and app is small. The larger structural cost is size: `index.html`
  is 14,625 lines, 7,765 of them generated engine and 6,859 hand-written app JS/CSS/markup in one file,
  an owner-mandated constraint (single-file app), so the lever is tests and tooling, not splitting.

## 4. Test-suite cost hot spots

Source: CI run 40450023044 (validate.yml on `codex/release-reconcile-20261026`, green), job and step
timestamps from `gh run view 40450023044 --json jobs`, test counts from the `js-results` artifact
(`gh run download 40450023044`). The log carries no per-file durations (the JS step prints none), so per-suite
time cannot be read from CI; counts and file sizes stand in.

| Job | Wall time |
| --- | --- |
| js suites (unit + e2e), step "App units and browser e2e" | 20m 45s (04:30:05 to 04:50:50) |
| mutation gate shard 3/4 (slowest) | 16m 47s |
| mutation gate shards 4, 1, 2 | 14m 54s, 12m 57s, 12m 32s |
| python suites | about 1m 03s |
| data integrity, panel fit x2, suite health | under 30s each |

- The JS job is the critical path (about 21 min) and is serial: `tests/suite_health.py:659-662` loops
  `tests/*.test.js` one file after another inside `collect_js`.
- Concentration: of 2,275 JS tests counted in `js-results.json`, `tests/app.test.js` has 882 (15,493 lines) and
  `tests/e2e.test.js` has 483 (18,039 lines). Together 60 percent of tests (1,365 of 2,275) and 33.5k of 52.3k test lines.
- The mutation gate is 1,515 patches over 4 shards (379/379/379/378 per `mutant-shard-*.txt`).
  Per `tests/mutation_check.sh:216-225`, a targeted mutant costs about 3.6 s and a whole-file one about 33 s.
  1,387 patches target `node`, 128 `python3`. Every patch has a `# suite:` header (`grep -L` returns none),
  but headers naming a whole file rather than a test pattern cost roughly 9x. 131 of 1,515 headers carry no `--test-name-pattern`, but 128 of those are python3 headers that each already name a single test. Only 2 whole-file node headers can be narrowed (`tests/coverage_merge.test.js`), and `tools/boot_sim.js` is a script; measured with
  `grep -h '^# suite:' tests/mutants/*.patch | grep -vc test-name-pattern`.
- The slowest shard (3) finishes 4 minutes after the fastest (2), so the shard split is by count, not by cost.
- The 2026-10-26 run on `codex/helpers-integration-20261026` shows a cancelled run 13 minutes in, then a
  rerun; with these durations every superseded push burns about 20 CPU-minutes.

## 5. Mutant count drift

- On disk: `ls tests/mutants/*.patch | wc -l` = 1515; the four shard reports in the CI artifact sum to 1515
  (379+379+379+378).
- `README.md:81` says "applies 1468 mutant patches": 47 behind. The count is pinned by a band, not equality: `tests/test_readme_currency.py:113-130` (`test_the_mutant_count_is_stated_within_a_lane_of_the_truth`) requires 90% of n <= said <= n, and its comment says equality was rejected. 1468 passes, so the drift is within tolerance.
- Prefix groups from `ls tests/mutants`: `d` 126, `e` 85, `r4e` 69, `sw` 65, `i` 57, `uid` 32, `uxl` 31, `di` 30,
  `c` 28, `h` 24. Memory notes quote earlier totals (690, 929, 1002), consistent with steady growth rather than loss.
- Health: `python3 tools/refresh_mutants.py --check` prints "all mutant patches apply cleanly; nothing to refresh".
  No stale patch today. `tests/suite_health.py` FLOORS rows are a separate, known-drifting count.

## 6. Top 10 recommendations

| # | Recommendation | Evidence | Size |
| --- | --- | --- | --- |
| 1 | Parallelise the JS job: split `collect_js` across a matrix or `--test-concurrency`, shard `app.test.js` and `e2e.test.js` separately. Cuts the 21 min critical path. | Section 4: `tests/suite_health.py:659-662` serial loop; step 04:30:05 to 04:50:50 | M |
| 2 | Refine mutation shard balancing: `tests/shard_mutants.js` already balances e2e and non-e2e mutants separately, but the slowest shard is still 4 min behind the fastest; balance by measured cost. | Section 4 table; `tests/shard_mutants.js` | S |
| 3 | Emit per-file and per-test durations into `js-results.json` so hot spots are visible next time; today CI cannot answer "slowest suite". | Section 4: artifact has `total/failed/skipped` only | S |
| 4 | Restate `README.md:81` to the current count (1515). It is already pinned: `tests/test_readme_currency.py:113-130` allows a deliberate band of 90% of n <= said <= n (equality was rejected), and 1468 passes it, so this is cosmetic. | `README.md:81`; `ls tests/mutants/*.patch \| wc -l` = 1515 | S |
| 5 | Narrow the 2 whole-file node `# suite:` headers (`coverage_merge.test.js`) to named tests; about 30 s each, shards are disjoint. Small win. | `tests/mutation_check.sh:216-225` cost note | S |
| 6 | Archive the 58 unreferenced, completed plans (refactor passes 3 to 7, difficulty, tier, nit queues) to a `docs/plans/archive/` folder after cross-checking `2026-10-25-plan-relevance-audit.md`; keep inventory JSON in sync. Needs owner OK; some tests read `docs/plans` by path. | Section 2 list; `grep` of tests for `docs/plans` before moving | M |
| 7 | Consolidate top-level handoff docs (`CLAUDE_RETURN_HANDOFF.md`, `CLAUDE_TAKEOVER_PLAN.md`, `DEVELOPMENT_CONTINUITY.md`) into `WORKSTREAMS.md` or archive them; 1,120-line ledger is already the stated source of truth. | `wc -l docs/*.md` | S |
| 8 | Split `tests/e2e.test.js` (18k lines) and `tests/app.test.js` (15k lines) into topic files so the runner, mutant headers and failures localise; no assertion changes. | Section 4 counts | L |
| 9 | Decide the fate of `golden_decks_v7.json` (single referrer) versus v8, and whether `tools/research/engine_measure/` (cited by `docs/SCALE_ENGINE_PLAN.md:14,:672,:777`) should stay. | Section 1 | S |
| 10 | Extract one angle helper (`toRad`, `turnTo`) into `HPE.layout` and use it at the app sites `index.html:10300,11910,13265` (11796 is a bucket, leave it; 6122 and 6127 are generated engine copies); rename app `escapeText` (`index.html:9634`) to `escapeHtml` to end the false duplicate with `pdf.js:47`. | Section 3 | S |

## 7. What was not measured

- Per-file test durations (not logged); the numbers above are job and step wall time.
- Local suite runs: not executed, per the project note that the full suite starves the browser; CI is the evidence.
- Coverage-based dead code inside `index.html`: `.github/workflows/coverage.yml` exists and
  `docs/plans/2026-10-09-refactor-pass-4-coverage.md` holds the last report; a fresh run is the next step for
  dead-code claims in the app block.
