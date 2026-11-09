# TRI-28 D sync browser fixture readiness plan

Goal: repair only the stale browser creation fixture in `tests/e2e_sync.test.js`.
Exercise the actual visible editor in D and legacy M; retain all ten test names,
all assertions, sync stubs and persistence behavior. Boundary: no application,
engine, helper, CI config, timeout, floor, flag-default or harness changes.

## Evidence and ownership
- Static inspected D: `ca29a953792627423d5993c7bd99d62a862b08ae`.
- Root/integrator owns browser lease, runs, CI, Git integration and DEV evidence.
- Fixture author owns only `tests/e2e_sync.test.js` in a fresh isolated worktree.
- Independent engineer reviews this plan/readiness policy before implementation;
  independent final reviewer reviews the exact candidate and evidence afterward.
- Design review: no product UI/copy/layout changes; reviewer confirms unchanged
  user journey and no design decision is required.
- Preserve original clean D/M worktrees. Legacy control is held main PR1001 at
  exact555bac651869df7ecfbd280b958132b241e10ab4; do not use `555` as a revision.

## Public interaction contract and smallest change
- Entry stays settings opener (when collapsed), `#deck-add`, then wait for open
  `#scale-sheet`. `index.html` anchors: `openScaleSheet`, `editorOpen`.
- Determine profile from rendered controls, never `ONE_PANEL` or hidden legacy
  `#scale-next.hidden` alone: non-null element, positive client rect and computed
  display/visibility. One-panel `#editor-line` wins only when visible; otherwise
  require visible `#scale-box`. Missing/ambiguous readiness fails, never bypasses.
- One-panel: click visible `#editor-line` to leave readonly; assign supplied text,
  dispatch bubbling `input`, commit Enter, wait for enabled visible `#editor-save`,
  click it; wait for `#scale-sheet[hidden]`. Existing reference is
  `tests/editor_e2e.test.js::typeLine` (`b.key("Enter", "Enter", 13)`).
- App anchors: `editorWire` binds click/Enter/blur; `editorSave` builds the real
  candidate and calls persistence. There is no `generateSave` symbol here.
- Legacy: assign visible `#scale-box` and dispatch bubbling `input`; click visible
  `#scale-next` if present, wait for visible `#scale-panel-layout`, then enabled
  visible `#scale-generate`; click it and wait for sheet closure. App anchors:
  `setTab`, nextBtn click listener, `genBtn.onclick = runGenerate`.
- Route both existing creation sites through this small fixture helper: case 6
  `addScale` and case 7's duplicate tabB inline legacy block. Preserve their exact
  scale strings and every subsequent assertion. Support top/frame evaluation
  explicitly; top uses existing `b.click`/`b.key`; existing hidden iframe uses
  its own document `.click()` and realm-local bubbling `KeyboardEvent("keydown",
  {key:"Enter",code:"Enter",keyCode:13,which:13,bubbles:true,cancelable:true})`.
  Use frame-local Event constructors. Wait using existing `b.waitFor` with a
  frame-wrapped DOM expression; no timers, private editor APIs or direct saves.
- Visibility here is within the selected document; the intentionally transparent
  tabB iframe remains the existing same-origin two-tab simulation.
- Spec basis: `docs/CARD-SPEC.md` Data model / Saved instances; editor suite's
  existing D12 text-commit and D15 Save contract. Do not add a new test group.

## Bounded evidence sequence (root executes; serial host lease)
1. Before edit: capture bounded static `git diff <resolved-M555-SHA> ca29a953 --
   tests/e2e.test.js tests/helpers/cdp.js tests/suite_health.py` plus relevant
   application source diff. Generic CI output is truncated: timeout versus
   aggregate duration remains unknown. Do not infer a root cause.
2. Fresh D baseline: full ten-test sync suite RED, retain raw output and counts.
3. Edit only owned fixture; same full suite GREEN on D.
4. Copy candidate fixture into owned temporary worktree at exact M555 SHA;
   application remains default legacy. Full ten-test suite GREEN there.
5. All runs use explicit Chrome and remove inherited overrides per browser.md:
   `export CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`
   `unset NODE_OPTIONS E2E_PORT HPC_COVERAGE_DIR NODE_V8_COVERAGE`
   `unset NODE_SUITE_TIMEOUT HPFC_CDP_PORT_TIMEOUT_MS`
   From each tested worktree, use existing bounded runner (900s default):
   `python3 - <<'PY' > /private/tmp/<unique-run>.log 2>&1`
   `from tests.suite_health import run_node_file`
   `r = run_node_file('tests/e2e_sync.test.js')`
   `print(r[5]); print('COUNTS', r[:5])`
   `raise SystemExit(0 if r[:5] == (10, 0, 0, 0, 0) else 1)`
   `PY`
   Root records real status, PID, lease and Chrome/profile/server cleanup; monitor
   within 60s. RED is expected failure, never skip/cancel/timeout as success.
6. Verify unchanged test names/assertions/floors; run existing full
   `node --test tests/mutation_harness.test.js` (54 tests) with raw counts.
7. Fresh independent review; one necessary full D `validate` at meaningful changed
   exact head; require every job/required suite green before DEV integration.
   CI execution includes normal full required validation, with no budget waiver.
8. After integration verify actual served DEV SHA and affected behavior under
   serialized browser lease. Main remains held; no deploy/migrations/prod creds.

## Acceptance, recovery and unknowns
- Accept only D RED→GREEN 10/10, M legacy GREEN 10/10, exact-head full CI,
  independent final approval and verified integrated DEV behavior.
- No full Mac rerun: Mac M2 remains paused. Targeted Mac evidence cannot certify
  a generic-suite fix. Generic `tests/e2e.test.js` 900s remains unresolved even if
  this changed-head CI passes; explicitly report that limitation.
- If generic 900s repeats, STOP and regroup with a reviewed logging/diagnosis
  subplan before any harness changes; no unchanged retry or timeout increase.
- Any new app failure, incompatible profile, count change or cleanup failure:
  retain artifacts and stop integration; do not force legacy, skip, or bypass.
- pending-linear-writes: []

Read-only generic evidence audit: M555 generic643passed in856.9s; Dca29 reaches900.0s.
Retained Dtail ends PASS move16; middle204289characterselided, so fullfailcount/hangpointunknown.
Nextpaired-area case unchangedM/D. Aggregate-budget exhaustion is plausible, NOT established.
Independent evidence auditor conditionally READY for one required corrected-head fullCI, unchanged
900s/allchecks; NOTREADYforintegrationnow. Ifgeneric900recurs stop/regroup beforeharnesschanges.

Independent engineering review: READY for bounded fixture implementation andserial evidence,
NOTREADYforDEVintegrationuntilnewexact-headfullCI/finalreview/servedchecks. No blocker found;
no product/design change orownerinputrequired. AFKroutinechoice: realUIprofileadaptation,
no forcinglegacy/skip/privateAPI/budgetchange. Generic900 causeunknown, ifrecursSTOPregroup.
