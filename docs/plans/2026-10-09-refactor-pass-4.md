# Refactor pass 4: dead code, dead tests, coverage, no regressions

Date: 2026-10-09. Base: `main` at `7b4f383` (after #277). Status: ENG-REVIEWED 2026-10-09 (`/plan-eng-review`, amendments R1-R9 below; owner has not yet seen it - no lane starts before they do).
Lane branches: `claude/refactor-4-<lane>`; worktrees `.claude/worktrees/refactor-4-<lane>`.

## 0. The request, and how this plan reads it

Owner (verbatim, binding): "design a prompt to review our code base and identify refactor opportunities and revise and improve test coverage. Make sure we don't introduce regression. Remove dead code (except full pdf generation) and dead tests."

Four deliverables:

1. **Refactor opportunities** - behaviour-preserving, in `index.html` app JS, `src/engine/*.js`, `tools/*.py`, `tools/*.js`. Identified from measurement, not from taste; only the ones this plan names or lane 0 surfaces are executed.
2. **Test coverage revised and improved** - find what is unexercised and what is badly exercised (tautologies, stub-only paths, duplicates on the same inputs) and fix it: add the missing test, or strengthen the weak one, or consolidate the duplicate.
3. **No regressions** - proven by evidence, in the order of section 2.3, never asserted.
4. **Dead code and dead tests removed** - with the carve-out: the full-deck PDF generator path stays (`tools/decks.py`'s full "Cards" path, every `tools/hifi.py` def only that path uses, `src/engine/pdfcards.js`'s full-deck variant, and the "unused" comment lane PM #275 left on it). Its tests stay where they alone prove the path runs.

Passes 1-3 (`docs/plans/2026-09-30-quality-refactor.md`, `2026-10-03-complexity-refactor.md`, `2026-10-05-refactor-pass-3.md` and its follow-up/cleanup docs) already removed the dead code a grep can find. What is left is what only **execution evidence** can find, and that is why this pass starts with a measurement lane rather than a grep.

### 0.1 Facts in the prompt that the code contradicts (planned from the code, not the prompt)

- `src/engine/sequence.js` is NOT missing a core-first note: its header says it reads `HPE.core` lazily "so core must be loaded before any function here runs", and `tests/sequence.test.js` always loads `["core", "sequence"]` (one deliberate late-load `["sequence", "core"]`). Nothing to fix.
- `startDrag`'s `setPointerCapture` catch in `index.html` is already narrowed (`if (err.name !== "NotFoundError") throw err;`), pinned by mutants `co_swipe_capture_catch_all` and `co_swipe_capture_unguarded`.
- `if (end === "rest") swipeRest();` in `wheelGestureEnd` IS tested (e2e "card swipe (wheel): under reduced motion a sub-threshold wheel gesture rests the card after the gap", mutant `co_swipe_wheel_rest_dropped`; app "AP1-3 wheelEndDecision table").
- There is no 900 ms timer in `index.html` (900 appears only as a CSS px value); the rail-scroll e2e waits use `rb.waitFor` with `tests/helpers/cdp.js`'s default 5000 ms.
- `document.dispatchEvent` does not appear in `index.html` (only in the `tools/sandbox.js` stub).
- The mkdtemp leak is in `tests/core.test.js` "ET-1 engine corpus matches" (`fs.mkdtempSync(..., "et1-")` is never removed), not in `tools/regen_engine_corpus.js`.

## 1. Goal

Measure, once, which functions, branches, CSS rules and tests of the shipped code base are never executed by the full suite (python + node unit + e2e in a real browser), and from that one measurement: remove what is dead by the evidence standard in 2.1, remove or re-point tests that are dead by 2.2, close the coverage gaps that measurement exposes on live code, and land the small set of behaviour-preserving refactors named below - with `index.html`'s engine regions, the committed CHORD_ONLY PDFs' text, `data/decks.json`, every fixture digest and the mutation gate proving at every merge that nothing a user or a printer can see has changed.

## 2. Evidence standards (binding on every lane)

### 2.1 Dead code

A function, export, constant, CSS rule, markup element or python def is dead only when BOTH hold:

1. The **full-suite coverage report of lane 0** (python + node + e2e, CI artifact `coverage-report`, or a documented local run of the same tooling) shows **zero executions**.
2. It has **no reader outside tests**: nothing in `tools/`, `index.html`, `src/engine/`, `.github/workflows/`, or `tools/probe/` references it (enumerated with pass 3's procedure: `git grep -n -a -w <name> <sha> -- . ':!tests/mutants' ':!docs'`, then `grep -l -a -F '<removed line>' tests/mutants/*.patch` for every removed line).

A grep with zero hits is not evidence on its own. **Unexecuted branches inside a live function are coverage gaps, not dead code**, unless the lane proves them unreachable by construction (the input is validated upstream, in named code) - then they are `UNREACHABLE` and may go. A guard on a public `HPE.*` entry point is reachable by definition (a test can call it): it gets a test, never a removal.

Classes carried over from pass 3, used in lane 0's report and every PR table: `PROVEN DEAD`, `UNREACHABLE`, `TEST-ONLY` (executed only by tests, no production reader - removable together with its tests unless KEPT), `KEPT-BY-DECISION` (3.2 of the pass-3 plan, plus the full-deck carve-out and `hifi.back_card`), `LIVE`, `LIVE-BROWSER-ONLY` (zero in node, non-zero in e2e), `BEHAVIOUR-BEARING`.

### 2.2 Dead tests

A test is dead when any ONE holds:

- it **cannot fail** (asserts a constant, or asserts against a fixture it builds itself from the code under test);
- it **duplicates** another test's assertions on the same inputs (same fixture or same deck/card, same asserted values; shown as an assertion-text table in the PR);
- **every line it covers is being removed** in this pass (then it goes in the same PR as the code, or - when the code lives in another lane's file - in the order section 6 fixes).

A test named in any mutant's `# kills:` is NOT dead until that mutant is re-pointed to a surviving test that fails on the same break (shown red in the PR). No test is renamed (pass 3 rule: it orphans mutant headers). No test is deleted without a named replacement row in the PR table.

### 2.3 Preservation evidence, in this order

1. **Byte-identical outputs**: `index.html` after `python3 tools/inline_engine.py` and `python3 tools/sync_decks.py` (both `--check` green); the three committed `*_CHORD_ONLY_Letter.pdf` by extracted text (the staleness test in `tests/test_print.py`); `data/decks.json` untouched; every committed fixture digest unchanged (`tests/fixtures/card_face_v1.json`, `pan_render_v1.json`, `gen_face_v1.json`, `app_surface_v1.json`, `engine_corpus_v1.json`, `golden_decks_v*.json`, `print_decks_v2.json`). **A digest change is a stop**, not a regen.
2. `tests/test_render_agreement.py` green (app vs print, per field, all 177 cards).
3. Mutation gate green at the head SHA: no survivor; corpus count not falling except by removed-target mutants replaced one-for-one or re-pointed; `python3 tools/refresh_mutants.py --check` green.
4. FLOORS rows (`tests/suite_health.py`) move only as section 5 allows.
5. `panel-fit` (both fonts) unchanged in verdict.

### 2.4 What no lane does

No deck data, geometry, visual-system or copy change. No dependency added to the app or to `requirements-ci.txt`; no `<script src>`; no build step. Generated regions of `index.html` and the `const DECKS` line change only through the source module/file plus the sync tool. The mutant corpus is part of the code base: a mutant whose target is removed is replaced `old -> new` one-for-one, never deleted; a mutant whose `# kills:` test is removed is re-pointed. An unowned file is not touched; a needed change in another lane's file becomes a row in that lane's queue (section 4, "Hand-offs").

### 2.5 Ownership extension

The five boundaries given (index.html app JS; `src/engine/`; `tools/` python; node test files; python test files) leave `tools/*.js`, `tests/helpers/`, `tests/fixtures/`, `tests/mutants/` and the harness unassigned. This plan assigns them by consumer:

| Files | Lane |
|---|---|
| `tools/sandbox.js`, `tools/boot_sim.js`, `tools/regen_card_fixture.js`, `tools/regen_pan_fixture.js`; fixtures `card_face_*`, `pan_render_*`, `gen_face_*`, `app_surface_*` | A |
| `tools/engine_loader.js`, `tools/regen_engine_corpus.js`, `tools/gen_deck.js`, `tools/pdf_build.js`, `tools/pdf_adapt.js`, `tools/pdf_smoke.js`; fixtures `engine_corpus_*`, `golden_decks_*`, `synthetic_scales.json` | E |
| fixtures `print_decks_*` | P |
| `tests/helpers/*` (after lane 0 merges), `tests/e2e.test.js`, `tests/drawer_*.test.js`, `tests/seat_sweeps_*.test.js` | T |
| `tests/suite_health.py`, `tests/test_suite_health.py`, `tests/mutation_check.sh`, `tools/refresh_mutants.py`, `tools/regen_data_mutants.py`, `tests/mutation_harness.test.js`, `tests/harness.test.js`, `tests/shard_mutants.js`, `tools/probe/panel_fit.js`, `tests/test_failure_diagnosability.py`, `tests/test_readme_currency.py` | H |
| `tests/CONTRACT.md`, `docs/ENGINE-SPEC.md`, `CLAUDE.md`, `README.md` prose | D |
| `tests/mutants/*.patch` | the lane owning the patch's `+++ b/<target>`; a mutant against `index.html` whose hunk lies inside an engine region is lane E's and is a defect (it would redden `tools/validate.py` check 4), to be re-targeted at the module |
| FLOORS rows and README counts | the lane whose test file changed, in-lane, to CI's count only; lane C reconciles at the end |

A lane may ADD a mutant against another lane's target (prefix `r4<lane>_`, generated diff on main's bytes); the owning lane's rebase step re-anchors it.

## 3. Non-goals

- No change to `data/decks.json`, any `geom`, any angle, palette, font, ratio, copy, or the card anatomy.
- No change to the chord engine's outputs (`engine_corpus_v1.json` is the oracle), the share format, or the scale grammar.
- No removal of `gb`/`--tone`/`--gb` plumbing (APP-D10), `shareLink` (APP-D8), `#panel-scales-group` (D11), the `delBtn.onclick` guard (D12), `res-*` (D13), `print`/`printCalls` (D14), `hifi.back_card`, `numbers=False` (PY-D4), `bw`/`rad` (PY-D7), or anything else in pass 3 §3.2. Those are owner decisions; this pass does not reopen closed design calls (close-out C3).
- No bulk mutant retirement (pass 1 O3); no weakening a test to let a refactor pass; no `window.__app` (A1); no e2e `describe` restructure (A5); no growth of the US-3 sandbox stub (R3); no second Chrome launch in e2e (E2E-4); no 88-`finally` rewrite (E2E-6).
- No FLOORS move to `tests/floors.json` (G2) and no trimming of plan-history narratives (G3): both owner-gated and unanswered.
- No rename of any test. No new runtime or CI dependency in `requirements-ci.txt` (lane 0's measurement-only install is in a manual job, D5).
- No feature. Spaced repetition, stats, PWA, audio stay untracked (owner 2026-09-30).
- No new behaviour tests for behaviour nobody pinned (the 320 px "HARD TO TAP?" no-wrap check), unless lane 0 shows the markup is otherwise unexecuted.
- No per-lane re-measurement: lane 0's artifact is THE number set (D1).

## 4. Lanes

### Lane 0 - `cov` (measurement)

**Goal.** One full-suite execution-coverage report, produced in CI, that every later lane cites: per function (and per CSS rule) zero-execution lists for `index.html` (app block and, by region offset, each `src/engine/*.js`), `src/engine/*.js` loaded directly, `tools/*.js`, `tools/*.py`; plus a per-SUITE-FILE "lines only this file covers" map (R3: `node --test` runs each file in its own process, so `NODE_V8_COVERAGE` yields one JSON per file; python gets the same via one `coverage run` per `tests/test_*.py` module). There is NO per-test map: a lane that needs "lines only this test covers" for a named dead-test candidate re-runs that one test (`--test-name-pattern` / `-k`) under the same env and cites that run; browser coverage is per navigation, never per test.

**Owns.** `tests/helpers/cdp.js` (the hook only), new `tools/coverage_merge.js`, new `tests/coverage_merge.test.js`, new `.github/workflows/coverage.yml`, new `docs/plans/2026-10-09-refactor-pass-4-coverage.md` (the report), its FLOORS row, README's node-suite count (22 -> 23; `tests/test_readme_currency.py::test_the_suite_counts_match_the_files_on_disk` is exact), new mutants `r4cov_*`.
**Reads only.** Everything else.

**Design.**

1. **Node and engine coverage** come from `NODE_V8_COVERAGE=<dir> node --test <unit suites>`: raw V8 JSON per process, in which `tools/engine_loader.js`'s `vm.runInContext(..., { filename })` scripts appear under `src/engine/<name>.js` and `tools/sandbox.js`'s combined script under `index.html` with **offsets equal to the file's own** (the comment on `combinedSrc` in `boot()` says that is why it is built that way). No reporter table parsing. (R7) Scripts run through `vm.runInContext` WITHOUT a filename (`tests/share.test.js` loads core, layout and a modified share source that way) appear as anonymous `evalmachine.<anonymous>` entries: the merge tool lists them under an `unattributed` key and never folds them into a shipped file's counts; a shipped function that is zero everywhere else and non-zero only in `unattributed` is `LIVE` (not dead) and the lane says so.
2. **Browser coverage** comes from an env-gated hook in `tests/helpers/cdp.js`: when `HPC_COVERAGE_DIR` is set, `launchOnce` enables `Debugger` and `Profiler`, calls `Profiler.startPreciseCoverage({ callCount: true, detailed: true })`, records every `Debugger.scriptParsed` (`scriptId`, `url`, `startLine`, `startColumn` - inline scripts of `index.html` are mapped to file offsets with these), and the driver's `send` intercepts `Page.navigate` (e2e's own `navigate()` in `tests/e2e.test.js` sends `Page.navigate` through `send`, not through `goto`; no suite sends `Page.reload`) to `Profiler.takePreciseCoverage` into a numbered JSON file before the page is discarded; `close()` takes one last time. (R4) Precise coverage is isolate-scoped: the hook takes coverage BEFORE every navigation and the unit test proves two navigations yield two files whose counts are not lost; a navigation whose take fails is recorded as `incomplete` and the merge tool refuses to emit a report that contains one (never "merged at close"). CSS: `DOM.enable` then `CSS.enable` (CSS requires DOM), `CSS.startRuleUsageTracking` once per document after each navigation commits (`Page.frameNavigated`), `CSS.takeCoverageDelta` before each navigate and `CSS.stopRuleUsageTracking` at `close()` only, recorded alongside. With the env var unset the hook adds no CDP calls (asserted by a test).
3. **Python coverage** runs in the manual job via `python -m coverage run -m unittest tests.test_<module>` once per module (R3) and `coverage json`, with `NODE_V8_COVERAGE` ALSO exported to that step so the node subprocesses python tests spawn (`tests/helpers/dump_app_render.js` from `test_render_agreement.py`, `tools/gen_deck.js`, `tools/pdf_build.js`) are counted rather than read as zero (R1). `coverage` is installed by that job's step only; it is not added to `requirements-ci.txt` (D5). Fallback if eng review refuses even that: stdlib `python -m trace --count` on the same command, slower but dependency-free.
4. **`tools/coverage_merge.js`** unions all of the above per file; maps `index.html` ranges that fall between `<!-- engine:<name> begin -->` and `<!-- engine:<name> end -->` onto `src/engine/<name>.js` by region offset (the regions are verbatim copies, so the offset is a constant per region). (R8) The two sources use DIFFERENT bases: sandbox ranges are file offsets, browser ranges are offsets into each inline `<script>` body (`Debugger.scriptParsed` gives the body's start line/column; `tools/inline_engine.py` writes the begin comment and `<script>` line before the module bytes), so the tool normalises browser ranges to file offsets FIRST and only then applies the region offset; `tests/coverage_merge.test.js` proves one real module function (`pdfcards.js` `labelSize`) lands on the same module range from both sources. Emits `artifacts/coverage-report.json` with, per file, every function with `count == 0` (name, start/end offsets, enclosing function), every CSS rule never used, and per e2e viewport (enumerated from the suite's `setViewport` calls - today 900x900, 380x800, 1024x700 and the landscape cases - not a fixed list) which `@media` blocks were exercised at all - a rule inside a media block no viewport satisfied is `LIVE` by default, not dead.
5. **`.github/workflows/coverage.yml`**: `workflow_dispatch` only (never on PR/push: the full suite with precise coverage is slower than the gate and must not become one), same node 22 / Python 3.12 / browser setup as `validate.yml`'s `js-tests`, uploads `coverage-report`. The e2e suite is run exactly as `validate.yml` runs it, with `HPC_COVERAGE_DIR` set.
6. **The report doc** records the run URL and SHA, each zero-execution item with its 2.1 class and the lane that takes it, the dead-test candidates with the 2.2 rule each meets, and the "two-lane items" (code in lane X, only test in lane Y) section 6 orders.

**Rules.**

1. Nothing in production files changes. The hook is zero-cost with the env var unset.
2. The report classifies; it does not remove. Every item names its reader enumeration (2.1 step 2) or says "reader enumeration pending in lane X".
3. The unit-only probe already run locally (946 tests, `index.html` 88.61 % lines / 77.20 % functions; engine modules 96-100 %) is recorded in the report as "pre-measurement", labelled as such, and never cited by a lane as evidence.

**Mutants.** `r4cov_merge_region_offset_dropped` (merge tool stops mapping region ranges to modules) kills "coverage_merge attributes an index.html range inside an engine region to the module"; `r4cov_hook_not_env_gated` (hook enables Profiler with the env unset) kills "cdp coverage hook sends no Profiler command unless HPC_COVERAGE_DIR is set". Both `# suite: node --test tests/coverage_merge.test.js` (the cdp test lives there too so no e2e marker is needed).

**FLOORS.** New row `coverage_merge` set from CI's `js-results` `files[].total` for the branch.

**Verify (clean worktree).**
```
python3 tools/validate.py
python3 tools/refresh_mutants.py --check
node --test tests/coverage_merge.test.js tests/harness.test.js tests/mutation_harness.test.js
gh workflow run coverage.yml --ref claude/refactor-4-cov && gh run watch   # then download coverage-report
```

**Stop and report.** The browser coverage JSON is empty for `index.html` (scriptParsed mapping failed); e2e under the hook fails a test that passes without it (the hook changed timing; R4: there is no "take at close only" fallback - the lane reports, it does not degrade the measurement); CI's `js-tests` time rises by more than the hook's own cost with the env unset.

**Acceptance.**

| # | Criterion | Proof |
|---|---|---|
| R4-A1 | `coverage-report` artifact exists for a `workflow_dispatch` run at the lane's head SHA and lists zero-execution functions for `index.html`, every `src/engine/*.js`, `tools/*.js`, `tools/*.py` | run URL in the report doc |
| R4-A2 | `index.html` region ranges are attributed to modules from BOTH sources (a function executed only via the inlined copy, e.g. `pdfcards.js`'s bottom-ring drawing, shows non-zero under `src/engine/pdfcards.js`; browser and sandbox ranges for `labelSize` agree after normalisation, R8) | unit test + the artifact |
| R4-A2b | Two navigations under the hook produce two coverage files and a report; a failed take marks the run `incomplete` and the merge tool exits non-zero (R4) | unit test |
| R4-A3 | With `HPC_COVERAGE_DIR` unset, `tests/helpers/cdp.js` sends no `Profiler.*`/`CSS.*`/`DOM.*` command | unit test; `validate.yml` `js-tests` green |
| R4-A4 | README node-suite count and the new FLOORS row match CI | `suite-health --verify` green, `test_readme_currency` green |
| R4-A5 | Report doc committed with every item classified and assigned | review |

**Depends on.** Nothing. Merges first.

### Lane E - `engine`

**Goal.** Close the engine's coverage gaps in the module's own suite, export the two helpers lane A will consume (D2), remove what lane 0 proves dead in `src/engine/*.js` and `tools/*.js` it owns, and fix the engine-test nits.

**Owns.** `src/engine/*.js`; the regenerated engine regions of `index.html` (via `python3 tools/inline_engine.py` only - never a hand edit; a region conflict on rebase is resolved by taking either side and re-running the tool); `tests/core.test.js`, `voicing`, `layout`, `naming`, `select`, `share`, `sequence`, `pdf`, `pdfcards`, `pdf_builtin`, `scale` `.test.js`; tools and fixtures per 2.5; mutants targeting those files; their FLOORS rows.

**Candidates (each a PR-table row with class and evidence).**

1. **Coverage gaps = defensive paths, test them or prove them unreachable.** From the pre-measurement, to be confirmed by lane 0: `layout.js` `err()` wrapper; `naming.js` `degrees` throw "no parent at index"; `pdf.js` charset guards/throws; `select.js` loader throw, degree tie-break, "deck has no ding field" throw, unknown voicing-class throws, the `return null`, `NAME_MAX` ellipsis, `build`'s NO_DING guard; `sequence.js` `tierOf` throw and `drawFromLengths` fallback; `share.js` UTF-8 3- and 4-byte decode branches; `voicing.js` `core()` throw, `err` with `<X>`, sort tie-breaks. Rule 2.1: public-entry guards get a test (and a mutant that deletes the guard); an internal guard whose input is validated upstream in named code is `UNREACHABLE` and goes, with the validating code cited in the PR.
2. **pdfcards paths covered only through `index.html`**: `Canvas.prototype.setDash`, the sup-size shrink loop, the `off-bottom` dashed state, the bottom ring, the bottom-zone number, the `nb BOTTOM NOTE` badge. Add direct `tests/pdfcards.test.js` cases on a Pygmy card so `src/engine/pdfcards.js` carries its own evidence; each new case gets a mutant.
3. **Exports for D2 (scope cut by R2: label rule only).** `HPE.pdfcards.labelSize(r, zone)` / `labelRatio(zone)` become PUBLIC exports (today `labelSize` sits only under `_internal`, which the module comments as "not for the app"; `labelRatio` is not exported at all) - the `_internal` entry stays so `tests/pdfcards.test.js` does not move. NO `chordRoles`: `card()` derives roles over the ADAPTED deck (`deck.spec`, `fieldOrder(spec)`), the app's `chordSets(d, ch)` over the raw `DECKS` entry, so the two are not twins on the same inputs and sharing them would need an adapter call per card in the app (R2). `card_face_v1.json`, `print_decks_v2.json` and `tests/pdf_builtin.test.js` must not move.
4. **Test nits.** "ET-1 engine corpus matches": remove the mkdtemp dir in a `finally`. Mutants for the two tests with none: `r4e_parse_stage_order_swapped` -> "EG-4 parseSeed reports the first failing stage" (`core.test.js`), `r4e_warning_shape_drifts` -> "EG-3 warning shape equals core.err shape" (`select.test.js`). `eg_lazy_core_eager`: confirm the TypeError the kill relies on is thrown from the mutated line; if not, re-anchor so the named test fails on its own assertion.
5. **Tools.** `tools/pdf_build.js` CLI `main` (58.75 % pre-measurement): a smoke test through `tests/pdf_builtin.test.js` or an `UNREACHABLE`/`TEST-ONLY` ruling per 2.1. `tools/regen_card_fixture.js` `--fixture` with no value throwing `TypeError` from `path.resolve(args[flag + 1])`: give it the same "flag needs a value" exit the other flags have - but that tool is lane A's (2.5); hand-off row.
6. **Dead exports.** Any `HPE.*` function or module-level constant with zero executions in lane 0's merged report AND no reader (2.1). None is expected (engine modules measured 96-100 % by unit suites alone); if one appears it is removed with its mutant re-pointed `old -> new`.

**Rules.** `engine_corpus_v1.json` and every `golden_decks_v*.json` are byte-identical oracles: a change is a stop. After every engine edit: `python3 tools/inline_engine.py` and commit what it writes; `--check` green at every commit. `tests/test_render_agreement.py` and `tests/app.test.js` run before push (the app consumes the inlined copies). No module gains a reader of another module's private.

**Mutants.** Add per new test (named above and in the PR table, `r4e_` prefix, `# suite: node --test tests/<file>.test.js`, `# kills:` equal to the title). Re-point every mutant whose `# kills:` names a consolidated test.

**FLOORS.** Rows for owned suites may RISE to CI's `ran N`; never fall.

**Verify.**
```
python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check
python3 tools/validate.py && node tools/boot_sim.js
python3 tools/refresh_mutants.py --check
node --test tests/core.test.js tests/voicing.test.js tests/layout.test.js tests/naming.test.js tests/select.test.js tests/share.test.js tests/sequence.test.js tests/pdf.test.js tests/pdfcards.test.js tests/pdf_builtin.test.js tests/scale.test.js tests/app.test.js
python3 -m unittest tests.test_render_agreement tests.test_fixture_integrity
```

**Stop and report.** Any fixture digest changes; `inline_engine.py --check` red after a rebase that was resolved by hand; a mutant kill that only a TypeError produces after re-anchoring; a candidate whose removal would strand more than one mutant (ENG-4's reason for deferral still holds).

**Acceptance.**

| # | Criterion | Proof |
|---|---|---|
| R4-A6 | Every lane-0 zero-execution item in `src/engine/*.js` is tested, removed with evidence, or listed in the PR under KEPT/UNREACHABLE with its reason | PR table |
| R4-A7 | `src/engine/pdfcards.js` bottom-shell paths executed by `tests/pdfcards.test.js` alone (coverage of that file by that suite) | `NODE_V8_COVERAGE` on that one suite, numbers in PR |
| R4-A8 | `HPE.pdfcards.labelSize` and `labelRatio` are public exports (`_internal.labelSize` kept); `card_face_v1.json`, `print_decks_v2.json` unchanged | diff + `tests/app.test.js` AP3-0 green |
| R4-A9 | Engine regions of `index.html` byte-equal to the modules at every commit | `inline_engine.py --check` |
| R4-A10 | Mutation gate green, no survivor, corpus count >= main's, every `r4e_*` kills its named test and no other reason | CI `mutation-gate` + `refresh_mutants --check` |

**Depends on.** Lane 0 (the report).

### Lane P - `py`

**Goal.** Remove what lane 0 proves dead in `tools/*.py` outside the carve-out, close python coverage gaps on live code, consolidate same-side duplicate python tests, and retire the one unreferenced print fixture.

**Owns.** `tools/hifi.py`, `tools/decks.py`, `tools/inline_engine.py`, `tools/inline_fonts.py`, `tools/make_icons.py`, `tools/sync_decks.py`, `tools/validate.py`; `tests/paths.py`, `tests/test_deck_data.py`, `test_print.py`, `test_render_agreement.py`, `test_pdf_parity.py`, `test_pdf_build.py`, `test_pdf_deck_adapter.py`, `test_pdf_emitter.py`, `test_gen_deck.py`, `test_icons.py`, `test_font_subset.py`, `test_fixture_integrity.py`; `tests/fixtures/print_decks_*`; mutants targeting those; their FLOORS rows.

**Candidates.**

1. **The carve-out, made visible.** Every `hifi.py`/`decks.py` def with zero executions outside the full-deck path (`hifi.build(path, deck, chords_only=False)`) is listed KEPT-BY-DECISION (carve-out) and carries lane PM #275's "unused" comment convention if it lacks it. `hifi.back_card` stays (pass 3). (R5) `decks.main` writes THREE chord-only files, not six: `tests/test_pdf_build.py::test_decks_main_writes_only_the_three_chord_only_pdfs` pins that and the full-deck sheet is built by nothing in `decks.py` (its comment above `main` says so). The carve-out proof is therefore explicit: before any python removal the lane builds all five full decks with `hifi.build(..., chords_only=False)` into a temp dir, records their extracted text as a baseline in the PR, and rebuilds after; the text must be identical. `python3 tools/decks.py` still exits 0 and writes the three files with unchanged text.
2. **Dead defs outside the carve-out** per 2.1 from lane 0's python report; expected few (pass 3's PY audit found one). Each removal: reader enumeration + mutant grep in the PR.
3. **Duplicate python tests on the same fact and the same inputs** (D4): e.g. where `test_print.py` and `test_pdf_parity.py` both assert a label size for the same deck/zone from the same PDF. Keep the one in the file nearest the code under test; the other goes with its mutant re-pointed. Cross-language twins (`test_render_agreement.py` vs `tests/app.test.js`, parity vs adapter) are NOT duplicates - they pin two implementations of one fact.
4. **`tests/fixtures/print_decks_v1.json`**: no reader but `tests/CONTRACT.md` ("kept as history"). TEST-ONLY asset with zero readers -> remove; the CONTRACT line is lane D's hand-off row.
5. `tools/validate.py` check 2's string-id blind spot (`pc = lambda f: d["fields"][str(f)][2] % 12` accepts `"7"`): the cleanup lane dropped restoring an int-type check because four suites already redden on it. Left as is; recorded.
6. The `coverage` tool is NOT added to `requirements-ci.txt` (D5).

**Rules.** The staleness test (extracted text) is the PDF oracle; a rebuilt PDF with changed bytes but equal text is NOT a change and is not committed unless the lane's PR already touches a PDF. `tests/test_render_agreement.py` is never weakened. `tools/regen_data_mutants.py` is not run (no data change).

**Mutants.** Per new test, `r4p_` prefix, `# suite: python3 -m unittest tests.test_<x>`; re-point for consolidated tests.

**FLOORS.** Owned rows may rise to CI's `by_module` count, or fall ONLY for a file that lost dead tests, only to that count, with the removal table in the PR.

**Verify.**
```
python3 tools/validate.py && python3 tools/refresh_mutants.py --check
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tools/decks.py && git status --short '*.pdf'   # text-equal, see staleness test
```

**Stop and report.** Extracted PDF text changes; any python test's assertion is loosened to keep green; a def the full-deck path calls is on the removal list (that is a classification error, not a removal).

**Acceptance.**

| # | Criterion | Proof |
|---|---|---|
| R4-A11 | Every zero-execution python def is removed with evidence, tested, or listed KEPT (carve-out / decision) | PR table |
| R4-A12 | The three committed `*_CHORD_ONLY_Letter.pdf` extract to identical text (staleness test); the five full decks built with `chords_only=False` before and after the lane extract to identical text (R5); `decks.py` still writes exactly the three files | staleness test + the before/after text baseline in the PR |
| R4-A13 | `print_decks_v1.json` removed, nothing reads it (grep over repo incl. mutants) | diff |
| R4-A14 | Python FLOORS rows equal CI `by_module` for the branch; mutation gate green | artifacts |

**Depends on.** Lane 0.

### Lane H - `harness`

**Goal.** Fix the harness defects found in pass 3's close-out that touch harness-owned files, close coverage gaps in the probe and the shard tool, and keep the gate honest for the other lanes' FLOORS and mutant moves.

**Owns.** Per 2.5: `tests/suite_health.py`, `tests/test_suite_health.py`, `tests/mutation_check.sh`, `tools/refresh_mutants.py`, `tools/regen_data_mutants.py`, `tests/mutation_harness.test.js`, `tests/harness.test.js`, `tests/shard_mutants.js`, `tools/probe/panel_fit.js`, `tests/test_failure_diagnosability.py`, `tests/test_readme_currency.py`; mutants targeting those; their FLOORS rows.

**Candidates.**

1. **FU-6 message ambiguity**: "FU-6 no two mutant patches share a diff body and a selected test" in `tests/mutation_harness.test.js` keeps only the first name in `seen`, so three identical patches read "keep one of each pair". Collect all names per key and list them. Strengthen the existing test (no rename); a `r4h_fu6_reports_first_only` mutant kills it.
2. **`tools/probe/panel_fit.js`** (60.73 % pre-measurement): the CLI `main` and the six `judgeCell` rules - add unit cases through `tests/harness.test.js` for each rule with a synthetic cell, so every rule has a red; a rule that no synthetic cell can reach is reported, not removed (the probe is the owner's record; `REMOVED_BY_DESIGN` stays).
3. **`tests/shard_mutants.js` `partition()`**: lane 0's report decides; expected LIVE (the union check in `validate.yml` `mutation-gate` depends on it).
4. **`validate_floors()`'s aggregate legacy floors** (`LEGACY_PYTHON=40`, `LEGACY_NODE_UNIT=12`, `LEGACY_NODE_FULL=17`): LIVE, closed at review (R9) - `tests/test_suite_health.py` reads `LEGACY_NODE_UNIT`/`LEGACY_NODE_FULL` (its lines 387 and 678-679 at `7b4f383`) and drives the browser-absent aggregate switch through them. No change; the lane records the reader.
5. **Confirmed-accurate, no change**: the "a zero grace can never be enough" comment above `FAKE_NODE_DETACHED` in `tests/test_suite_health.py` (the fake traps `sleep 0.3`); the `uid_rail_new_deal_inherits_scroll` pattern lacking `$` is a lane-A header nit (hand-off row).
6. **Deferred and staying deferred**: GATE-1, GATE-4, GATE-8, GATE-9, GATE-10 (pass 3 §2.3 reasons unchanged).

**Rules.** The gate's semantics do not change: exit codes, `suite_for()`'s first-`# suite:`-line word-split, the e2e-marker skip, "any skip fails". `refresh_mutants.py --check` must stay green at every commit of every lane; H adds no new requirement on patch format.

**Mutants.** `r4h_` prefix, `# suite:` for `tests/mutation_harness.test.js` / `tests/harness.test.js` / `python3 -m unittest tests.test_suite_health`.

**FLOORS.** Owned rows may rise to CI's count.

**Verify.**
```
python3 tools/refresh_mutants.py --check
node --test tests/mutation_harness.test.js tests/harness.test.js tests/shard_mutants.js
python3 -m unittest tests.test_suite_health tests.test_failure_diagnosability tests.test_readme_currency
node tools/probe/panel_fit.js --base origin/main --font real   # verdict unchanged
```

**Stop and report.** Any change to `tests/mutation_check.sh` that the five `h_*` self-patching mutants cannot re-anchor on (memory: refresh then `git apply --check` all five); a `panel-fit` verdict change.

**Acceptance.**

| # | Criterion | Proof |
|---|---|---|
| R4-A15 | FU-6 names every patch in a body-sharing group | test red on `r4h_fu6_reports_first_only` |
| R4-A16 | Every `judgeCell` rule has a unit case that fails when the rule is deleted | mutants per rule |
| R4-A17 | Harness semantics unchanged: `tests/test_suite_health.py` and `mutation_harness.test.js` existing tests untouched except FU-6's message assertion | diff |
| R4-A18 | Mutation gate green; `refresh_mutants --check` green | CI |

**Depends on.** Lane 0.

### Lane T - `e2e`

**Goal.** Consolidate duplicated e2e assertions (D3), strengthen the vacuous and over-claiming browser tests, cover the two browser-only paths the stub cannot reach, remove the one dead helper, and delete the e2e tests whose only subject is code lane A removes (first half of each two-lane item).

**Owns.** `tests/e2e.test.js`, `tests/drawer_drag.test.js`, `drawer_grid`, `drawer_seats`, `seat_sweeps_keys`, `seat_sweeps_tap_add`, `seat_sweeps_tap_edit`, `tests/helpers/*` (lane 0's hook included, once lane 0 is merged); mutants targeting those and mutants whose `# suite:` selects e2e tests, for their `# kills:` lines; the `e2e`, `drawer_*`, `seat_sweeps_*` FLOORS rows.

**Candidates.**

1. **Consolidation table (D3).** From lane 0's per-test map: pairs of e2e tests whose asserted values are identical on the same page state. Each PR row: removed title, surviving title, the shared assertion, and a red run showing the survivor fails on a deliberate break (the mutant it inherits). `# kills:` re-pointed. No `describe` moves (A5).
2. **Vacuous mode-S branch** of "the desktop sidebar at 1024x700 gains no new VERTICAL scroll ... modes A, B and S": `want = 0` makes `assert.ok(m.scrollH - m.clientH >= want - 1)` always true. Assert the measured overflow equals `want` within 1 for every mode (the companion `Math.abs(amy.overWithout - want) <= 1` already bites; make the first assertion the same shape).
3. **"DR3 browser ... every stop lands inside the scrollport at 380x667"** asserts two focus names and one `inside` check on the first finer button. Make the body iterate every stop `panelStops()` returns (title unchanged, now true).
4. **`drawer_seats.test.js` `reach()`** returns `fineToggle` nobody reads and "DR2a browser (84, report)" logs `edit.noteRow`/`edit.seatRow` which `reach()` never returns: return what the log reads, drop the unread field.
5. **AP2-2's stub gap** (`tools/sandbox.js` has no `header`/`footer`, and must not grow - R3): a browser test that with the sheet open `header` is NOT inert and `footer` IS (real code: `querySelectorAll("header, main, footer, #settings-panel")` with `panelBackground = [main, footer, #decks]`). New mutant `r4t_inert_includes_header` against `index.html` (lane A re-anchors on rebase).
6. ~~`tests/helpers/dump_app_render.js`: zero readers, remove.~~ **WITHDRAWN at review (R1).** `tests/test_render_agreement.py` `RenderAgreement.setUpClass` runs it by `subprocess` (line 359 at `7b4f383`) and parses its stdout for all 177 cards; it is LIVE and is the app side of preservation evidence 2.3 item 2. The claim came from a grep that excluded python; it is the example of why 2.1 step 2 enumerates `tests/` readers too before calling a HELPER dead (helpers have no production reader by construction, so for `tests/helpers/*` the reader set is the test suites).
7. **Two-lane items**: for each `index.html` function lane 0 classes PROVEN DEAD whose only coverage is an e2e test, that e2e test is dead by rule 3 of 2.2 (every line it covers is being removed) and is removed HERE with the lane-0 row cited, before lane A removes the code. (R6) The mutant whose `# kills:` names that test moves WITH the test, in this lane's PR: "every mutant patch's `# kills:` line is actually selected by its `# suite:` command" in `tests/mutation_harness.test.js` reddens main the moment a `# kills:` names a deleted test, so lane T re-points it to a surviving test that fails on the same break, or - when the only such test is the one being removed because the code is going - replaces it one-for-one with an `r4t_` mutant against the surviving behaviour, in the same commit. Lane A then removes the code with no mutant work left on that item (its "replace one-for-one" in candidate 6 applies only to mutants T did not touch).
8. **AP3-0** (`tests/app.test.js`) `rmSync` outside `finally` is lane A's; hand-off row.

**Rules.** No sleep that is a timing bound is shortened (use `waitElapsed`, pass 2). E2E-2 keeps 180 ms. Browser-skips are the only allowed skips, and none is added. The e2e FLOORS row falls ONLY to CI's `js-results` count for this branch and only with the consolidation table.

**Mutants.** `r4t_` prefix with the e2e marker in `# suite:`; re-point rows listed.

**FLOORS.** `e2e` may fall to CI's count with the table; `drawer_*`/`seat_sweeps_*` may rise.

**Verify (locally: single tests only; CI runs the suite).**
```
python3 tools/refresh_mutants.py --check
node --test --test-name-pattern 'sidebar at 1024x700' tests/e2e.test.js
node --test tests/drawer_seats.test.js
```

**Stop and report.** A consolidation whose survivor stays green on the inherited mutant's break; an e2e removal that lowers the row below CI's count; any test whose only fix would be a rename.

**Acceptance.**

| # | Criterion | Proof |
|---|---|---|
| R4-A19 | Every removed e2e test has a PR-table row (removed, survivor, shared assertion, red proof) | PR |
| R4-A20 | Mode-S branch of the 1024x700 sidebar test fails when `want` is wrong (differential probe in the PR) | PR |
| R4-A21 | DR3 "every stop" test iterates every stop; a stop outside the scrollport fails it | mutant `r4t_dr3_stop_outside_scrollport` |
| R4-A22 | `header` not inert / `footer` inert with the sheet open, asserted in the browser | `r4t_inert_includes_header` killed |
| R4-A23 | `tests/helpers/dump_app_render.js` UNCHANGED and `tests/test_render_agreement.py` green (R1); e2e FLOORS row equals CI's count; gate green, including the header-lint test with every two-lane mutant re-pointed in this lane (R6) | CI artifacts |

**Depends on.** Lane 0 (map), lanes E/P/H merged (so the rebase is one).

### Lane A - `app`

**Goal.** Remove what lane 0 proves dead in `index.html` outside the engine regions (JS, CSS, markup), adopt the two engine exports (D2), fix the app-side nits and stale comments, and close the app-block coverage gaps the sandbox can reach.

**Owns.** `index.html` outside the `<!-- engine:* -->` regions and outside the `const DECKS` line; `tests/app.test.js`, `tests/preview.test.js`; tools and fixtures per 2.5; mutants targeting `index.html` (app block), `tools/sandbox.js`, `tools/regen_card_fixture.js`, `tests/app.test.js`; the `app`, `preview` FLOORS rows.

**Candidates.**

1. **Dead app functions.** Lane 0's merged list of `index.html` functions with zero executions in node AND e2e, each with reader enumeration (including `addEventListener` and bare references - memory: enumerate callers, never grep one pattern; `on<event> = fn` and `fn` passed bare both count). Pre-measurement names the LEAST-covered live functions (`runGenerate`, `disarmDelete`, `dropNote`, `wheelGestureEnd`, `applyKbOffset`, `setMode`, `resetSheetState`, `pickAnchor`, `hideSheet`, `liftNote`, `closePanel`, `syncParseState`, `release`, `activateNote`) - these are expected `LIVE-BROWSER-ONLY`, not dead; their unexecuted branches in e2e become lane-T or lane-A tests only when the branch is reachable from the UI.
2. **Dead CSS rules** from the rule-usage report: removable only when zero use across every e2e viewport AND the selector matches nothing in the REAL browser DOM (R8b: `tools/sandbox.js`'s selector support covers simple id/class/tag over a partial DOM and cannot prove a compound, descendant or attribute selector matches nothing; the check is a `querySelectorAll(sel).length === 0` through `tests/helpers/cdp.js` at every e2e viewport, with the sheet, drawer and settings panel each opened once, recorded in the PR) AND it is not inside a `@media` no viewport satisfied. `panel-fit` (both fonts) is the layout oracle.
3. **D2 adoption (label rule only, R2).** `labelRatio`/`labelSize`/`const LABEL_RATIO_*` in the app block become reads of `HPE.pdfcards.labelRatio`/`labelSize` (closes the app/pdfcards half of pass-1 G1; the `tools/hifi.py` copy stays, cross-language, and `tests/test_render_agreement.py` keeps the three sides equal). `chordSets(d, ch)` is UNCHANGED (not a same-input twin of `card()`'s role derivation; see lane E candidate 3). Byte-safety: `pan_render_v1.json`, `card_face_v1.json`, `gen_face_v1.json` digests unchanged; `tests/test_render_agreement.py` green; the pass-2 source-text pins in `tests/app.test.js` (A10) that read the constants from the app block are re-pointed to the export in the same PR, never deleted.
4. **Nits.** Resources comment "five outbound links in three rows" -> six links (`res-handpaner`, `res-dingandtones`, `res-trainingcards`, `res-amy-progressions`, `res-amy-bottom`, `res-handpan-101`); `scaleReader` comment "Every version maps to the legacy reader today" -> describes `v >= 4 ? parseSeed : parseLegacySeed`; the `chordSets` "one if/else" comment -> "if / else if"; `faceHTML`'s `default` gains an explicit `case "answerB":` label above it (no throw, no behaviour change); `runGenerate`'s returned `refusal` is read by no caller (`genBtn.onclick = runGenerate;`, the scaleBox keydown) - keep it if a test reads it (then it is TEST-ONLY and stays, recorded), drop it otherwise; `uid_rail_new_deal_inherits_scroll` `# suite:` pattern gains its `$`; AP3-0's `rmSync` moves into `finally`; the `tests/app.test.js` comment "names the six shipped files" -> three (`decks.py` `main`); `tools/regen_card_fixture.js` `--fixture` without a value exits with a message instead of a `TypeError`; the rail digest hashing only `idx = 0` in `buildGen` is recorded as a known narrowing (widening it changes `card_face_v1.json`, a stop - leave).
5. **Mutant for the test with none**: `r4a_throwing_generate_leaves_button_disabled` -> "AP2-3 a throwing generate still restores ...".
6. **Second half of two-lane items** (lane T removed the test first): the code goes, its mutant replaced `old -> new`.

**Rules.** No edit inside a generated region or the DECKS line; `inline_engine.py --check` and `sync_decks.py --check` green at every commit. The US-3 stub does not grow. `shareLink` and every §3.2 item untouched. Every digest unchanged; a change is a stop.

**Mutants.** `r4a_` prefix; replacements and re-points in the PR table.

**FLOORS.** `app`/`preview` rise to CI's count, or fall only for dead tests with the table.

**Verify.**
```
python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check
python3 tools/validate.py && node tools/boot_sim.js && python3 tools/refresh_mutants.py --check
node --test tests/app.test.js tests/preview.test.js
node tools/regen_card_fixture.js --check
python3 -m unittest tests.test_render_agreement
node tools/probe/panel_fit.js --base origin/main --font real && node tools/probe/panel_fit.js --base origin/main --font fallback
```

**Stop and report.** Any fixture digest change; `panel-fit` verdict change; a CSS rule removal that any viewport measured differently; a dead-function candidate with a bare reference the enumeration finds.

**Acceptance.**

| # | Criterion | Proof |
|---|---|---|
| R4-A24 | Every lane-0 zero-execution app function/CSS rule/markup node is removed with evidence or listed with class and reason | PR table |
| R4-A25 | App label sizes read from `HPE.pdfcards`; `pan_render_v1`, `card_face_v1`, `gen_face_v1` digests unchanged; render agreement green | CI |
| R4-A26 | `chordSets` unchanged (R2); "chordSets: Amara C major has two root-coloured fields" and `test_highlighting_agrees` green | CI |
| R4-A27 | Stale comments fixed as listed; `faceHTML` has an explicit `answerB` case | diff |
| R4-A28 | `panel-fit` real and fallback verdicts unchanged | CI |
| R4-A29 | `regen_card_fixture.js --fixture` without a value exits non-zero with a message | unit test + mutant |
| R4-A30 | Mutation gate green, no survivor, every removed `index.html` mutant replaced one-for-one | CI + table |

**Depends on.** Lane E (exports), lane T (two-lane items, `r4t_inert_includes_header` re-anchor).

### Lane D - `docs`

**Goal.** Make the docs describe what shipped, nothing more.

**Owns.** `docs/ENGINE-SPEC.md`, `CLAUDE.md`, `tests/CONTRACT.md`, `README.md` prose (counts are lane C's).

**Candidates.** ENGINE-SPEC §17: `SMALL_LABELS` is emitted by `src/engine/select.js` `function smallLabels(geom)`, not `layout.solve`; §15: `scale-anchor-label` does not exist (`tools/sandbox.js` `ELEMENT_IDS` has `scale-anchor-one`/`scale-anchor-between`); §16: Pygmy's "11 rim" row is `reader: 'legacy'` in `synthetic_scales.json` and should say so. `CLAUDE.md`: name `tools/regen_engine_corpus.js` beside the other regen tools, add the coverage workflow and `coverage_merge.js` under "Print pipeline"/tools, point at this plan and its coverage report. (R5, corrected at review read-back: `CLAUDE.md` at `7b4f383` already says three CHORD_ONLY PDFs and names the kept full-deck path - DOC #277 fixed it; the "six" wording lived only in this plan.) `tests/CONTRACT.md`: drop the `print_decks_v1.json` "kept as history" line (lane P removed the file). `tests/core.test.js`'s "ENGINE-SPEC.md is frozen history" comment is lane E's file; if §17/§15/§16 corrections contradict "frozen", lane D says in ENGINE-SPEC that the spec is corrected to the code and lane E's comment is a hand-off row.

**Rules.** Plan documents are history and are not rewritten (G3 stays open). `README.md` suite counts and the mutant count are not touched here.

**Verify.** `python3 -m unittest tests.test_readme_currency`; `node --test tests/core.test.js` (the `SECTION9` pins against ENGINE-SPEC).

**Acceptance.** R4-A31 ENGINE-SPEC §15/§16/§17 match the code (cited anchors); R4-A32 `CLAUDE.md` names the corpus tool, the coverage job and this plan; R4-A33 CONTRACT has no reference to a removed fixture.

**Depends on.** Lanes E, P, H, T, A merged.

### Lane C - `close`

**Goal.** Reconcile FLOORS rows and README counts to main's CI artifacts after every lane merged; nothing else.

**Owns.** FLOORS rows in `tests/suite_health.py` (values only), README's suite and mutant counts, the `b_*` data mutants only if `regen_data_mutants.py` reports them stale (it should not: no data change).

**Rules.** Every row set from main's `python-results` `by_module` / `js-results` `files[].total` at the merge commit; mutant count exact (`ls tests/mutants/*.patch | wc -l`); `suite-health --verify` green.

**Acceptance.** R4-A34 every FLOORS row equals main's CI count; R4-A35 README counts exact (suites) and exact (mutants); R4-A36 `refresh_mutants.py --check`, `validate.py`, `boot_sim.js` green on main.

**Depends on.** All.

## 5. Standing merge gates (every lane)

1. CI green at a head SHA verified against the local tip (`gh pr view <n> --json state,headRefOid`).
2. Independent reviewer PASS or PASS_WITH_NITS at that SHA, briefed with this plan's lane text verbatim (no added rules).
3. `python3 tools/refresh_mutants.py --check` green; mutant count reconciled in the PR (added, replaced `old -> new`, re-pointed - each named).
4. `panel-fit` verdicts unchanged (real and fallback).
5. `inline_engine.py --check`, `sync_decks.py --check`, `validate.py`, `boot_sim.js` green; no fixture digest moved; `data/decks.json` untouched.
6. FLOORS rows moved only as section 4 allows, only to CI's count for the branch; README counts within `test_readme_currency`'s band.
7. Rebase procedure of the house format (§20.24 of the drawer plan): fetch + rebase; both `--check`s; `refresh_mutants.py` committed on its own; own FLOORS rows + README counts from main's artifacts; push and wait for CI.

## 6. Order of merges and why

1. **0 cov** - the number set every later PR table cites; its hook must be on main before T can own `cdp.js`.
2. **E engine, P py, H harness** in parallel - disjoint files; E's region regeneration touches `index.html` but only inside markers, which A does not edit, and the tool resolves any overlap.
3. **T e2e** - after E/P/H so its one rebase sees them; before A because two-lane items need the test gone before the code (a code-first order would redden main between PRs).
4. **A app** - needs E's exports and T's removals.
5. **D docs** - describes what shipped.
6. **C close** - counts from main's artifacts, once.

## 7. Decisions

**D1 - Lane 0 measures once, in CI.** Per-lane measurement would give each lane a different number set from a different SHA, and e2e cannot run fully locally (the browser starves). One `workflow_dispatch` run at lane 0's head is THE report; a lane that needs a re-measure after a merge (e.g. A after T's removals) re-runs the same workflow on its branch and cites that run URL - same tool, same format, never a local approximation.

**D2 - Extraction from `index.html` into `src/engine/`, and its byte-safety proof.** AMENDED at eng review (R2): ONE function, the label-size rule (`labelRatio`/`labelSize`/`LABEL_RATIO_*` in the app block; `var LABEL_RATIO_*` + `labelRatio` + `labelSize` in pdfcards), which is a same-input twin. The role derivation is NOT extracted: pdfcards' `card()` works on the adapted deck (`deck.spec`) and the app's `chordSets` on the raw `DECKS` entry, so a shared `chordRoles` would need an adapter call per app card and is a new seam, not a de-duplication. Nothing else: `parseLineText` was ruled not a duplicate in pass 2, and the swipe/drawer code has no engine twin. Proof that nothing drew differently: `pan_render_v1.json` and `card_face_v1.json` digests unchanged (`tools/regen_card_fixture.js --check`, `tests/app.test.js` AP3-0), `tests/test_render_agreement.py` per-field agreement over all 177 cards, and `inline_engine.py --check` after each sync. This closes the app/pdfcards copy pass-1 **G1** named; G1 was owner-gated and never answered, so the owner may still overturn the remaining half - if overturned, lane E still exports (harmless) and lane A skips candidate 3. The `tools/hifi.py` copy stays in either case (D4).

**D3 - Consolidating duplicated e2e assertions without lowering the e2e FLOORS row unjustifiably.** The row may fall only to CI's `js-results` count for lane T's branch, and only when every removed test has a table row: removed title, surviving title, the shared assertion (quoted), and a red run proving the survivor fails on the break the removed test's mutant made (the mutant re-pointed to it). A duplicate that shares assertions but on a different page state (viewport, mode, deck) is not a duplicate and stays. No `describe` restructuring (A5); no renames. Lane C then sets the row from main.

**D4 - Python/node overlap on the same fact: which side keeps it.** Cross-language pairs are NOT overlap - `test_render_agreement.py`, `test_pdf_parity.py`, `test_pdf_deck_adapter.py` exist precisely to pin two implementations of one fact to each other, and removing one side removes the pin. Only same-side duplicates on the same inputs are consolidated, and the survivor is the test in the file nearest the code under test (a pdfcards fact lives in `tests/pdfcards.test.js`, not `tests/app.test.js`; a hifi fact in `tests/test_print.py`, not `tests/test_pdf_parity.py`).

**D5 - Measurement tooling is not a project dependency.** `coverage` is installed by the `workflow_dispatch` job step only; `requirements-ci.txt` is unchanged; the stdlib `trace` fallback is named in lane 0. Node needs nothing (`NODE_V8_COVERAGE` is built in). The CDP hook is dormant without its env var.

**D6 - Dead means executed by nothing and read by nothing.** Section 2.1 is the test; coverage alone is not (a function reached only from a browser event no e2e test fires is LIVE-BROWSER-ONLY and gets a test, not a removal), and a grep alone is not.

**D7 - Order T before A.** Two-lane items would otherwise leave main red between two PRs; the cost is that A rebases over T once. (R6) The mutant of a two-lane item moves with the test, in lane T, because the mutant header lint reddens main on a `# kills:` that names no selectable test - a test-first order with a mutant-later order is the same red one PR later.

**D8 - Regression contract (eng review, R-regress).** The regression evidence is the ordered list in 2.3 with two additions from this review: (a) the full-deck text baseline of R5 (built with `chords_only=False`, before and after, in lane P's PR), because the committed PDFs never exercise the carve-out; (b) `tests/test_render_agreement.py` is named as the reader that keeps `dump_app_render.js` alive (R1), so a helper's reader set is the suite, never "no production reader". A digest change, a text change in any of the eight PDFs (three committed, five baseline), or a render-agreement failure is a stop in every lane; nothing in this pass may regenerate a fixture.

## 8. What this plan deliberately leaves

- **G1's `tools/hifi.py` copy** of the label constants: cross-language; pinned by render agreement. Stays.
- **G2** FLOORS to `tests/floors.json` and **G3** history trimming: owner-gated, unanswered.
- **ENG-4/ENG-D15, PY-5, E2E-4, E2E-6/E2E-D1, E2E-8, GATE-1/4/8/9/10, UNIT-7/8/9, GATE-D10 rest, Hotspot 7 (`generateDeck` angle patching)**: pass-2/3 deferrals whose stated reasons still hold; nothing in this pass changes the inputs to those reasons.
- **Body-sharing mutant pairs** `sw_wheel_flight_guard_dropped`/`us_wheel_ignores_flight` and `ap3_raildiff_always_same_deal`/`uid_rail_new_deal_inherits_scroll`: judged by different tests on purpose (follow-up doc). The `$` on the `uid` pattern is lane A's nit; the pair stays.
- **`validate.py` check 2 string-id blind spot**: four suites already redden on it (cleanup doc); not reopened.
- **Rail digest hashing only `idx = 0`**: widening changes `card_face_v1.json`, which is a stop by 2.3; recorded, not done.
- **`faceHTML` `default` behaviour, `runGenerate`'s discarded return (if a test reads it), `genBtn.disabled` after refusal (R2), `select.warning` `{code, reason}` shape (EG-3)**: design calls already made.
- **320 px "HARD TO TAP?" no-wrap test**: no pinned behaviour, no owner ask.
- **`eg_lazy_core_eager` beyond verification** (lane E candidate 4): if the TypeError comes from the mutated line it is a legitimate kill.
- **`tools/research/`**: KEPT (pass 3 Q11). **`tools/regen_data_mutants.py`**: documented maintenance tool, LIVE by reader.
- **A second coverage run per lane** (D1): only on request, same workflow.
- **Browser coverage of CSS in viewports e2e does not visit**: those rules are LIVE by default; a viewport sweep is a new test, not this pass.

## 9. Lane table

| Lane | Branch | Worktree | Gate |
|---|---|---|---|
| 0 cov | `claude/refactor-4-cov` | `.claude/worktrees/refactor-4-cov` | R4-A1..A5 |
| E engine | `claude/refactor-4-engine` | `.claude/worktrees/refactor-4-engine` | R4-A6..A10 |
| P py | `claude/refactor-4-py` | `.claude/worktrees/refactor-4-py` | R4-A11..A14 |
| H harness | `claude/refactor-4-harness` | `.claude/worktrees/refactor-4-harness` | R4-A15..A18 |
| T e2e | `claude/refactor-4-e2e` | `.claude/worktrees/refactor-4-e2e` | R4-A19..A23 |
| A app | `claude/refactor-4-app` | `.claude/worktrees/refactor-4-app` | R4-A24..A30 |
| D docs | `claude/refactor-4-docs` | `.claude/worktrees/refactor-4-docs` | R4-A31..A33 |
| C close | `claude/refactor-4-close` | `.claude/worktrees/refactor-4-close` | R4-A34..A36 |

Every lane: worktree isolation, tests first, independent reviewer at the verified head SHA, CI is the evidence. Review worktrees take no `node_modules` (this repo needs none).

---

## Prompt feedback

Six "facts" in the prompt were false at `7b4f383` and are corrected in §0.1 (sequence.js header, `loadEngine(["sequence"])`, catch-all `setPointerCapture`, untested `swipeRest`, a 900 ms timer, `document.dispatchEvent`; the mkdtemp leak is in `tests/core.test.js`, not the tool). The plan was drawn from the code. Two things the prompt did not settle and this plan decided (flag for eng review): the `coverage` install in a manual-only job (D5) and the two-function scope of D2 under owner-gated G1.
---

## Decision ledger

`/plan-eng-review`, 2026-10-09, reviewer session `59385-1791533050-c83e20e0`, plan at `3957b75` on `claude/refactor-4-plan`. AFK mode armed (owner, 2026-10-08): every question below was auto-answered with the recommended option and is listed as an AFK auto-decision for the owner's return. The owner may overturn any of them before `/swarm`.

### D1 - Prerequisite offer (inline /office-hours)
State: auto-B (skip). The plan already carries the problem statement, the carve-out and the owner's words; an office-hours pass adds nothing a refactor plan needs.

### D2 - Complexity gate, feature cut: the role-derivation half of plan decision D2 (`chordRoles`)
Finding: `src/engine/pdfcards.js` `card()` derives root/tone roles over the ADAPTED deck (`deck.spec`), the app's `chordSets(d, ch)` over the raw `DECKS` entry; the two are not twins on the same input, and `labelSize` is exported only under `_internal`.
Options: A) cut the `chordRoles` half, keep `labelSize`/`labelRatio` as public exports (recommended, 9/10); B) keep both halves and add an adapter call per app card (6/10).
State: auto-A. Recorded as R2.

### D3 - Complexity gate, feature cut: CSS rule-usage tracking in lane 0
Finding (codex, HIGH 10/10): `CSS.enable` without `DOM.enable` fails, and stopping tracking before the first navigation while on `about:blank` disables it with no restart.
Options: A) keep CSS tracking with `DOM.enable` first, `takeCoverageDelta` before each navigate, stop at close only (recommended, 9/10); B) cut CSS tracking and lane A candidate 2 (5/10).
State: auto-A. Recorded as R4/R8b.

### D4 - Complexity gate, feature cut: `coverage` install in the manual job (plan D5)
Options: A) keep the install in the manual-only job's step, no change to `requirements-ci.txt` (recommended, 9/10); B) stdlib `trace` (6/10, slower, no JSON).
State: auto-A. Plan D5 stands.

### D5 - Complexity gate, structure
`Pending remedies not decided here: R1, R3, R5, R6, R7, R8, R9`.
Options: A) Original arrangement, eight lanes split by file ownership (recommended); B) Smaller arrangement, fold E/P/H into one lane.
Note: options differ in kind, not coverage. Reason for A: every lane is a file-ownership boundary and the merge order already serialises the three that touch `index.html`; folding E/P/H crosses js/py/tests ownership for no fewer PRs.
State: auto-A.

### D6 - Section 1 (Architecture): R1, lane T candidate 6 removes `tests/helpers/dump_app_render.js`
Finding (CRITICAL 10/10): `tests/test_render_agreement.py:359` runs it by `subprocess` for all 177 cards. The plan's "zero readers" came from a grep that excluded python.
Options: A) withdraw the candidate, keep the file, make it the worked example for "a helper's readers are the suites" (recommended, 10/10); B) keep the removal and port the dump into python (3/10, new code to delete old).
State: auto-A. Applied at lane T candidate 6, R4-A23, D8.

### D7 - Section 1: R3, per-test coverage map
Finding (codex, HIGH 10/10): process and page coverage aggregate across tests; nothing in lane 0 attributes lines to a single test.
Options: A) per-suite-file maps plus targeted single-test re-runs for named candidates (recommended, 9/10); B) build a test-boundary hook into the harness (7/10, new instrumentation in every runner).
State: auto-A. Applied in §lane 0 goal and item 3.

### D8 - Section 1: R4, browser coverage across navigations
Finding (codex, HIGH 10/10 and MEDIUM 8/10): precise coverage is isolate-scoped; a "take at close only" fallback silently drops every earlier page.
Options: A) take before every navigate, prove with a two-navigation unit test, `incomplete` is a refusal (recommended, 10/10); B) keep the fallback and document the loss (4/10).
State: auto-A. Applied at lane 0 item 2, stop clause, R4-A2b.

### D9 - Section 1: R5, the full-deck carve-out proof
Finding (codex, MEDIUM 10/10; mine F7): `decks.main` writes three chord-only files; nothing in `decks.py` runs `chords_only=False`, so "six files unchanged" proves nothing about the carve-out.
Options: A) explicit before/after text baseline of the five full decks built with `hifi.build(..., chords_only=False)` in lane P's PR (recommended, 10/10); B) rely on the existing `test_pdf_build.py` full-path tests alone (6/10, they assert structure, not text).
State: auto-A. Applied at lane P candidate 1, R4-A12, lane D candidates, D8.

### D10 - Section 1: R6, two-lane mutant ordering
Finding (codex, HIGH 10/10): `tests/mutation_harness.test.js` header lint fails when a `# kills:` names a deleted test; T before A leaves that window open for a whole PR.
Options: A) the mutant moves with the test in lane T (recommended, 10/10); B) merge T and A into one lane (7/10, one PR touching e2e and app).
State: auto-A. Applied at lane T candidate 7, R4-A23, D7.

### D11 - Section 2 (Code quality): R7 and R8, attribution edge cases
Finding (codex, MEDIUM 9/10 x2): anonymous `vm.runInContext` scripts in `tests/share.test.js`; browser and sandbox ranges have different offset bases for `index.html`.
Options: A) `unattributed` bucket that can only make a function LIVE, plus browser-range normalisation proven on one real module function (recommended, 10/10); B) ignore both (5/10).
State: auto-A. Applied at lane 0 items 1 and 4, R4-A2.

### D12 - Section 2: R8b, CSS removal evidence
Finding (codex, HIGH 10/10): `tools/sandbox.js` selector support is simple id/class/tag over a partial DOM.
Options: A) real-browser `querySelectorAll` check at every viewport with sheet, drawer and panel opened (recommended, 10/10); B) sandbox query (3/10).
State: auto-A. Applied at lane A candidate 2.

### D13 - Section 3 (Tests): R9 and the python coverage env
Finding (mine F3, F5): python-spawned node subprocesses read as zero without `NODE_V8_COVERAGE`; the LEGACY aggregates have a reader.
Options: A) export the env in the python step too; close lane H candidate 4 as LIVE (recommended, 10/10); B) leave both for the lanes to rediscover (6/10).
State: auto-A. Applied at lane 0 item 3, lane H candidate 4.

### D14 - TODOS.md
State: auto-A, no TODOS entries for this plan; the plan is the queue and the memory file points at it.

### D15 - Next steps
Options: A) design review; B) CEO review; C) ready to build (recommended).
State: auto-C. The gate that remains is the owner's: no lane starts before they have seen this review.

## Engineering review

**NOT in scope:** full-deck PDF generation removal (owner carve-out), deck data, geometry, the hifi.py label copy (D4), any dependency added to `requirements-ci.txt`, any fixture regeneration.

**What already exists:** `NODE_V8_COVERAGE` support in node; `tools/sandbox.js` building `combinedSrc` at file offsets for exactly this purpose; `tests/helpers/cdp.js` `send()` as the single CDP choke point; `tests/test_pdf_build.py` already calling `hifi.build(..., chords_only=False)`; the mutant header lint; `tests/test_render_agreement.py` as the three-way renderer oracle.

**Findings (all applied as R1-R9 above):**
- [CRITICAL] (10/10) plan lane T candidate 6 - "zero readers anywhere" for `dump_app_render.js`; `tests/test_render_agreement.py:359` runs it.
- [HIGH] (10/10) plan lane 0 item 2 - CSS tracking without `DOM.enable`, stopped before first navigate.
- [HIGH] (10/10) plan lane 0 goal - per-test map has no collection mechanism.
- [HIGH] (10/10) plan lane T candidate 7 / D7 - mutant `# kills:` left dangling between T and A.
- [HIGH] (10/10) plan lane A candidate 2 - sandbox DOM cannot prove selector absence.
- [HIGH] (9/10) plan D2 / lane E candidate 3 - `chordRoles` is not a same-input twin; `labelSize` is `_internal`-only.
- [MEDIUM] (10/10) plan lane P candidate 1, R4-A12, §2.3 - "six files" is three; carve-out never exercised.
- [MEDIUM] (9/10) plan lane 0 item 1 - anonymous vm scripts in `tests/share.test.js:720-724`.
- [MEDIUM] (9/10) plan lane 0 item 4 - browser vs sandbox offset bases differ.
- [MEDIUM] (8/10) plan lane 0 stop clause - close-only fallback loses navigations.
- [MEDIUM] (9/10) plan lane 0 item 3 - python step lacks `NODE_V8_COVERAGE`.
- [LOW] (10/10) plan lane 0 item 4 - viewport list did not match the suite (900x900, 380x800, 1024x700).
- [LOW] (10/10) plan lane H candidate 4 - LEGACY aggregates are LIVE.
- [LOW] (10/10) plan lane 0 item 2 - `Page.reload` is sent by no suite; dropped.

**Diagram (coverage sources to report):**

```
node --test (per file)  --NODE_V8_COVERAGE-->  src/engine/*.js (named vm)   \
                                               index.html (sandbox, file offsets) \
python coverage (per module) + NODE_V8_COVERAGE for spawned node ----------------> coverage_merge.js --> artifacts/coverage-report.json
e2e under HPC_COVERAGE_DIR: take before each Page.navigate + at close ----------/        |  normalise browser offsets -> file offsets
   (Debugger/Profiler; DOM.enable -> CSS.enable; CSS.takeCoverageDelta)                   |  region offsets -> src/engine/<name>.js
tests/share.test.js anonymous vm ------------------------------> unattributed bucket -----/  (LIVE-only evidence)
```

**Failure modes:** a scriptParsed mapping miss empties `index.html` (stop clause); a navigation take failure yields `incomplete` and the merge refuses; a `# kills:` naming a deleted test reddens the header lint (R6 keeps mutant and test in one PR); a text change in any of the eight PDFs is a stop (D8).

**Worktree parallelisation:** unchanged from §9; E, P and H run in parallel after 0; T, A, D, C serial.

**REGRESSION RULE:** no fixture regenerates, no PDF text changes, no `pan_render_v1`/`card_face_v1`/`gen_face_v1` digest changes, render agreement green over 177 cards, mutation gate green at every head SHA, FLOORS from CI artifacts only.

Test Plan Artifact: `~/.gstack/projects/raywu-handpan-cards/ray-claude-refactor-4-plan-eng-review-test-plan-20261009-011616.md`.

## Implementation Tasks

- [ ] **T1 (P1, human: ~1d / CC: ~45min)** - lane 0 - coverage harness per amended items 1-4, with R4-A2b and the offset-normalisation test
- [ ] **T2 (P1, human: ~2h / CC: ~15min)** - lane E - public `labelSize`/`labelRatio`, no `chordRoles`
- [ ] **T3 (P1, human: ~3h / CC: ~20min)** - lane P - full-deck text baseline (R5) before any python removal
- [ ] **T4 (P2, human: ~2h / CC: ~15min)** - lane H - suite health candidates 1-3; candidate 4 closed LIVE
- [ ] **T5 (P1, human: ~4h / CC: ~30min)** - lane T - dead e2e tests with their mutants re-pointed in the same PR
- [ ] **T6 (P1, human: ~4h / CC: ~30min)** - lane A - app dead code; CSS removals with real-browser absence checks; D2 label rule only
- [ ] **T7 (P2, human: ~2h / CC: ~15min)** - lane D - docs (ENGINE-SPEC §15/§16/§17, CLAUDE.md tool list, CONTRACT.md)
- [ ] **T8 (P2, human: ~1h / CC: ~10min)** - lane C - FLOORS and README counts from CI artifacts

**Unresolved decisions:** none; every brief was auto-answered under AFK and is listed above for the owner.

**Completion summary:** 14 findings, 14 applied, 0 suppressed. Lake Score 8/10: the plan now says what each lane may remove and what proves it did not regress; the remaining risk is lane 0's CDP hook, which only CI can validate.

Approval readiness: READY after the owner reads this ledger (AFK gate in `queued-refactor-pass-4` memory).

## GSTACK REVIEW REPORT

| Review | Status | Verdict |
|---|---|---|
| CEO | not run | - |
| Outside voice (codex) | completed, 8 findings | needs changes (all applied) |
| Eng | completed, 14 findings | READY, no unresolved decisions |
| Design | not applicable | - |
| DX | not run | - |

OUTSIDE COVERAGE: codex reviewed lane 0 CDP design, NODE_V8_COVERAGE attribution, merge order, carve-out; all 8 verified against `7b4f383` and applied (R3-R8, R8b).
CROSS-MODEL: no tension; codex and this review agreed on every finding, and codex found four this review had not (DOM.enable, per-test map, sandbox selectors, offset bases).
VERDICT: plan approved for `/swarm` once the owner has seen it.

NO UNRESOLVED DECISIONS
