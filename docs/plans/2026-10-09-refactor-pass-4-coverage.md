# Refactor pass 4: lane 0 coverage report

Produced by `.github/workflows/coverage.yml` (node V8 coverage per test file, browser precise coverage and CSS rule usage over CDP, python line coverage per module), merged by `tools/coverage_merge.js`.

- **Run:** https://github.com/raywu/handpan-cards/actions/runs/37974945711, at SHA `bc307b308a8720110c7f296330431423df365cc3`. Artifacts: `coverage-report` (the merged JSON), `coverage-raw` (every input, plus `node-failed.txt`).
- **Trigger:** the run was started by a temporary `push` trigger on the lane branch, not by `workflow_dispatch`: GitHub refuses to dispatch a workflow that is not on the default branch yet (HTTP 404). The temporary trigger is removed in the final commit; the workflow file is the only difference between the measured SHA and the head SHA besides this document.
- **Measured:** 23 node test files in separate processes, 14 python modules, 584 browser takes over five browser suites (`e2e`, `harness`, `drawer_drag`, `drawer_grid`, `drawer_seats`), 781 recorded viewports (39 distinct widths, 320 to 1920).
- **Run health:** `tests/sequence.test.js` failed two 50 ms timing assertions under V8 instrumentation (`node-failed.txt`); every other node file and every python module passed. The first run of this workflow (run 37969691405, SHA `9e83e16`) also failed one timing-bound e2e test ("card swipe (mouse momentum): a fast release flies on ...", a 30 ms sample); the same test passed in the run above. Both are instrumentation cost, not logic; neither runs with the hook off (CI at the head SHA is green with `HPC_COVERAGE_DIR` unset).

## Reading the report, and what it cannot see

- **Python run through subprocess is not measured.** `coverage run -m unittest` sees only the interpreter it starts. `tools/validate.py`, `tools/sync_decks.py`, `tools/inline_engine.py`, `tools/inline_fonts.py`, `tools/make_icons.py`, `tools/refresh_mutants.py` and `tools/regen_data_mutants.py` are driven by tests and CI as child processes, so their zero rows below mean "not measured", not "not executed". They are LIVE; none is evidence of dead code.
- **Node CLIs run as child processes are not measured either** (`tools/boot_sim.js`, `gen_deck.js`, `pdf_adapt.js`, `pdf_smoke.js`, `regen_pan_fixture.js`, `tests/helpers/dump_app_render.js`; the report's `neverLoaded` list). Each has a reader (table 4).
- **A patched copy of `index.html`** loaded by some `app.test.js` cases reports offsets one character off the shipped file; the merge tool sets those scripts aside under `unattributed` rather than counting zeros against the real file. The 13 `unattributed` entries are `evalmachine` scripts (the unit-test sandbox) and that patched copy.
- **Function-level zero is the evidence standard.** A function with count 0 in every node process and every browser take is a "zero-execution item". Unexecuted branches inside live functions are in the JSON (`uncovered`) and are gaps, not dead code (plan 2.1).

## 1. Zero-execution functions, classified (plan 2.1)

Every item has a reader enumerated with `git grep -n -a -w <name> -- . ':!tests/mutants' ':!docs'` at the run's SHA, plus the `# kills:`/patch check where a removal is proposed (none is proposed here; removal evidence is the owning lane's job).

### 1.1 `index.html` (lane A; 4 of 312 functions)

| Item (line) | Class | Reader | Lane |
|---|---|---|---|
| `clearPanPreview` (9475) | LIVE, unexecuted branch | called at 9548 when the placeholder seed fails to parse or paint | A (test the branch or rule it `UNREACHABLE` with the validating code) |
| `gestureCancel` arrow (10365) | LIVE, unexecuted branch | assigned at 10322 and 10365, invoked at 9279 | A (the 10365 assignment is the touch-drag press) |
| `degSel` change handler (10431) | LIVE, handler never fired | `addEventListener` at 10431 | A (or T if only a browser can fire it) |
| `.finished.then(swipeRest, () => {})` rejection handler (10778) | LIVE, defensive | `springBack` | A |

No `index.html` function is PROVEN DEAD. The pre-measurement list of least-covered functions (`runGenerate`, `disarmDelete`, ...) is all executed once the browser data is merged (they are `LIVE-BROWSER-ONLY` or executed in both). Of 312 functions, 20 execute only in the browser.

### 1.2 `src/engine/*.js` (lane E)

| Item | Class | Reader | Lane |
|---|---|---|---|
| `layout.js` `err` (106) | LIVE, defensive wrapper | `return HPE.core.err(code)`; the only caller site is a guard no test reaches | E (test it or rule it `UNREACHABLE` by the validating code, per E candidate 1) |

Every other engine function, across all eleven modules, is executed by the node suites alone (`browserOnly` is empty for the modules). E's candidate-1 list of defensive paths (select/pdf/naming/share/voicing/sequence guards) is a list of unexecuted BRANCHES, in the report's `uncovered` ranges, not of zero-execution functions.

### 1.3 `tools/*.js` and `tests/helpers/*.js`

| Item | Class | Reader | Lane |
|---|---|---|---|
| `tools/pdf_build.js` `writeDeck` (53), `main` closures (64, 75, 76) | LIVE, CLI path unexecuted | `tests/pdf_builtin.test.js`, `tests/test_pdf_parity.py`, `tools/hifi.py`, README | E (smoke test or ruling, E candidate 5) |
| `tools/probe/panel_fit.js` (18 functions: `rawEdges`, `serve`, `Root`, `start`, `close`, `measure`, `walk`, `cellId`, `runFont`, `printReport`, `rangesOf`, `parseArgs`, `main`, and closures) | LIVE, CLI and server path unexecuted by tests | `validate.yml` panel-fit jobs, `tests/e2e.test.js`, `tests/app.test.js` | H (H candidate 2) |
| `tools/regen_card_fixture.js` closure (276) | LIVE, unexecuted flag path | `tests/app.test.js`, fixtures | A |
| `tools/sandbox.js` (22 stub members: `focus`, `blur`, `el.contains`, `el.closest`, `removeItem`, `removeEventListener`, `dispatchEvent`, `ClockDate`, ...) | TEST-ONLY (a stub; its members exist for the app to call) | `tests/helpers/sandbox.js`, `tools/boot_sim.js` | A |
| `tests/helpers/cdp.js` `sleepSync` (56) and 5 closures | LIVE, unexecuted branch | `sleepSync` is called at 77 on the process-kill escalation path | T |
| `tests/helpers/sequence_score.js`, all 13 functions | **PROVEN DEAD candidate** | the only importer is `tests/sequence.test.js:83`, which destructures `score` and never calls it (`grep -n "score(" tests/sequence.test.js` is empty); no tool, workflow or other test mentions the file | **two-lane**: file is T's (`tests/helpers/*`), importer is E's (`sequence.test.js`); see section 3 |
| `tools/coverage_merge.js` (6 closures) | LIVE, unexecuted error paths of this lane's own tool | `tests/coverage_merge.test.js`, `coverage.yml` | 0 (this lane) |

### 1.4 Never loaded by any measured process

`neverLoaded` in the JSON: `tools/boot_sim.js`, `tools/gen_deck.js`, `tools/pdf_adapt.js`, `tools/pdf_smoke.js`, `tools/regen_pan_fixture.js`, `tests/helpers/dump_app_render.js`, `tests/helpers/engine.js`, `tests/helpers/sandbox.js`.

| File | Class | Reader | Lane |
|---|---|---|---|
| `tools/boot_sim.js` | LIVE | `validate.yml` "App boot simulation", `tests/run.sh`, `tests/app.test.js`, `mutation_harness.test.js` | A |
| `tools/gen_deck.js` | LIVE | `tools/decks.py`, `test_gen_deck.py`, `test_pdf_parity.py`, `regen_data_mutants.py`, CLAUDE.md | E |
| `tools/pdf_adapt.js` | LIVE | `tests/test_pdf_deck_adapter.py` | E |
| `tools/pdf_smoke.js` | LIVE | `tests/test_pdf_emitter.py` | E |
| `tools/regen_pan_fixture.js` | LIVE | `tests/app.test.js`, `tools/regen_card_fixture.js`, `tests/helpers/sandbox.js` | A |
| `tests/helpers/dump_app_render.js` | LIVE | `tests/test_render_agreement.py` | T (plan candidate 6 owns its fate) |
| `tests/helpers/engine.js`, `tests/helpers/sandbox.js` | LIVE, re-export shims | required by most test files (they re-export `tools/engine_loader.js` and `tools/sandbox.js`, whose own rows are measured) | T |

### 1.5 `tools/*.py` (lane P unless noted)

Measured in-process only. Zero rows that are CLI entry points exercised through subprocess are marked "subprocess".

| Item | Class | Evidence | Lane |
|---|---|---|---|
| `hifi.back_card` (573) | KEPT-BY-DECISION | pass 3, plan 2.1 | P |
| `inline_engine.regions`, `desync`, `main` | LIVE (subprocess) | `validate.py` check 4, README, 6 test files | P |
| `inline_fonts.subset_face`, `face_entry`, `generate`, `main` | LIVE (subprocess) | `validate.py`, `test_font_subset.py`, README | P |
| `make_icons.main` | LIVE (subprocess) | `test_icons.py` | P |
| `sync_decks.canonical`, `inject`, `main` | LIVE (subprocess) | `validate.py` check 1, `test_deck_data.py`, `decks.py`, `inline_engine.py` | P |
| `validate.main` and its 6 `check_*` | LIVE (subprocess) | `validate.yml`, README | P |
| `refresh_mutants.py` (14 defs, file never loaded) | LIVE (subprocess) | `validate.yml` "Mutant corpus is in sync", `mutation_harness.test.js` | H |
| `regen_data_mutants.py` (5 defs, file never loaded) | LIVE (subprocess) | `mutation_harness.test.js`, `test_deck_data.py`, CLAUDE.md | H |

`decks.py` (11 of 11), `hifi.py` (28 of 29) execute in-process. **No python def is PROVEN DEAD from this run**, and the run cannot prove one for the subprocess files; lane P must either measure them with `coverage run` in the child (`COVERAGE_PROCESS_START`, which this lane did not add: it would touch the test files) or accept the LIVE classification above.

## 2. CSS, media and viewports

- 237 rules parsed from `index.html`; 8 unused, none inside an unmatched `@media` block:
  - `.decks::-webkit-scrollbar` (179), `.seq-rail::-webkit-scrollbar` (653), `#scale-box::-webkit-scrollbar` (793): `::-webkit-scrollbar` pseudo-elements; the rule-usage delta never reported them used, and whether this Chrome reports them at all was not tested, so treat as **unmeasured** rather than unused (lane A: confirm before any removal; plan D12 requires evidence).
  - `#scale-msg.err, .announce.err` (871): LIVE if any code adds the `err` class; lane A enumerates readers of `.err` first.
  - `#scale-generate:disabled:active` (1085), `#scale-swatches .dot:active::after` (1086), `#scale-swatches .dot.sel:active::after` (1087), `#scale-swatches .dot:active` (1088): `:active` states no CDP-driven test holds a pointer down on; **unmeasured**, not unused.
- `@media` blocks: `(max-height:520px)`, `(max-height:520px) and (min-width:560px)`, `(min-width:1024px) and (min-height:700px)`, `(min-width:640px)`, `(min-width:640px) and (min-height:700px)`, `(prefers-reduced-motion: reduce)` were each matched at some recorded viewport or emulation. `@media print` was not matched (the print path is covered by `Page.printToPDF` tests, which do not report a CSS delta); lane A treats it as unmeasured.
- Viewports (width): 320, 352, 360, 375, 380, 390, 412, 427, 500, 559, 560, 568, 639, 640, 641, 667, 673, 683, 740, 768, 800, 812, 820, 844, 860, 900, 915, 926, 932, 1000, 1023, 1024, 1025, 1050, 1280, 1366, 1440, 1536, 1920. The 380 px phone width the project tests at is exercised.
- Delta entries that could not be mapped to the inline stylesheet: 3 (non-inline sheets).

## 3. Two-lane items (code in lane X, only test in lane Y; order per plan section 6)

| Item | Code lane | Test lane | Note |
|---|---|---|---|
| `tests/helpers/sequence_score.js` (never called) and its import at `tests/sequence.test.js:83` | T (helper) | E (importer) | Remove the unused `score` import first (E), then the helper (T); or hand the file to E wholesale. No mutant names either. |
| `clearPanPreview` / `degSel` handler / `gestureCancel` branches | A | T (only a browser may reach them) | A decides reachability; T adds the browser case only if A rules the branch reachable. |
| `layout.js` `err` | E | E | single lane, listed for completeness |

## 4. Dead-test candidates (plan 2.2: candidates only, none is a finding)

Line-exclusivity is the count of lines of shipped code (`index.html`, `src/`, `tools/`, `tests/helpers/`) that one suite executes and no other does (`exclusive` in the JSON). Zero exclusive lines means the suite adds no shipped line the others miss; it does NOT show the tests are dead (assertions, not lines, make a test) and none of rules 2.2(a)-(c) is yet shown.

| Suite | Exclusive lines | Owner lane | Candidate for |
|---|---|---|---|
| `tests/drawer_grid.test.js` | 0 | T | duplicates e2e/drawer_seats (2.2 rule 2), needs the assertion-text table |
| `tests/drawer_seats.test.js` | 0 | T | same |
| `tests/preview.test.js` | 0 | A | same |
| `tests/seat_sweeps_tap_add.test.js` | 0 | T | the sweeps are table-driven; check for duplicate fixtures |
| `tests/seat_sweeps_tap_edit.test.js` | 0 | T | same |
| `tests/select.test.js` | 1 | E | no |
| `tests/seat_sweeps_keys.test.js` | 2 | T | no |
| `tests/drawer_drag.test.js` | 4 | T | no |
| `tests/pdf_builtin.test.js` | 5 | E | no |
| `tests/harness.test.js` | 8 | H | no |

Suites at 11 or more exclusive lines (`app`, `e2e`, `sequence`, `pdfcards`, `voicing`, `share`, `naming`, `scale`, `layout`, `pdf`, `core`) each cover code nothing else reaches. Per-test (rather than per-file) maps were deferred (plan D7).

## 5. Pre-measurement (plan Lane 0, step 3)

The earlier unit-only local probe (946 tests: `index.html` 88.61 % lines / 77.20 % functions; engine modules 96-100 %) is recorded here only as history. **It is not evidence and no lane cites it.** The merged run above supersedes it: `index.html` has 308 of 312 functions executed with browser data merged.

## 6. Hand-offs

| Item | To |
|---|---|
| `tests/helpers/cdp.js` now carries the coverage hook (env-gated; `ex_exception_listener_dropped.patch` was refreshed because its hunk shifted) | T owns `tests/helpers/*` once this merges |
| `tests/suite_health.py` FLOORS row and README node-suite count (22 to 23) | H (FLOORS), D (README) rebase onto these |
| The `coverage.yml` temporary `push` trigger is removed in the final commit | none |
