# Mac browser diagnosis — 2026-10-24

Execution plan: [shared browser validation](2026-10-24-browser-portability.md).
Raw artifacts below are in `/private/tmp/handpan-browser-parallel.HskZRy/evidence/`;
these local retained receipts are not available in a fresh clone on another host.
The shared runbook is delivered by PR562/main-held and PR563/dev, separately from
this diagnosis. No repair has been implemented. Browser lease released20:33:16Z.

No tracked files changed. Detached dev baseline `1510ea369573078e6296fe873edb6f538c3212a3`.
Host: macOS27.0.1 arm64, Node25.8.1, Python3.9.6, Chrome156.0.8078.35.
Existing reportlab5.0.1, pymupdf1.26.5 and fonttools4.60.2 were discoverable.
Explicit Chrome path used; NODE_OPTIONS, E2E_PORT, HPC_COVERAGE_DIR,
NODE_V8_COVERAGE, NODE_SUITE_TIMEOUT and HPFC_CDP_PORT_TIMEOUT_MS removed.
No installs, global settings, source edits, commits or remote writes.

## Results

- Six unchanged targeted runs: boot1, historical desktop-sheet-width1,
  TR-1 fallback1, TR-1 real1, background14, lifecycle2: **20/20 pass**,
  zero skips/cancellations, exit0.
- One unabridged full e2e run: **900s deadline exceeded**, supervisor exit124,
  child exit1 during graceful termination, runtime900.559s. Complete suite total
  is unavailable. Partial TAP has197 completed top-level tests,46 top-level
  failures plus one nested background failure. It contains43 CDP timeouts
  (35 Runtime.evaluate,7 Input.dispatchTouchEvent,1 Input.dispatchMouseEvent)
  and4 ERR_ASSERTION keyboard/viewport failures. These are separate failure
  classes, not one proven cause. Raw stdout69,236bytes retained.
- Earliest failure: `Enter on a print button runs its real click handler and
  does not flip the card`, `tests/e2e.test.js:1150`. Unchanged isolated run:
  one test,0pass/1fail, no skips/cancellations, exit1, natural completion47.37s.
- Trace-only A: same one test fails at its first requestAnimationFrame wait
  inside Browser.settle at900x900/mobilefalse,20s CDP timeout, browserExit:null.
  Natural completion45.30s, exit1,0skip/cancel.
- Controlled diagnostic B: same traced test with Page.bringToFront immediately
  before existing settle passes,534ms test/1.116s supervisor,1pass/0fail,
  no skips/cancellations, exit0.
- Reverse trace-only A: same requestAnimationFrame wait fails again at900x900,
 20.553s, natural completion48.52s,1fail/0pass, no skips/cancellations, exit1.

The A-B-A comparison supports target activation as a mitigation for this exact
isolated rAF stall. It does not identify the underlying Chromium scheduling
cause, resolve the full-suite assertion failures, or validate a production fix.
The modified diagnostic B is not unmodified-suite acceptance evidence.
The observed post-failure delay is not established to be a permanent teardown hang.

## Concurrency and cleanup qualifications

Browser lease was exclusive. Full run was not CPU-exclusive: root reported a
31.8s nonbrowser app853-test run plus brief Node proofs. Earliest failure preceded
that app full run. Durations are not normalized performance comparisons.
Root/other owned CPUheavy jobs were paused for isolated reductions and A-B-A.

Supervisor uses one-second process metadata sampling. Very short-lived browser
roots may be missed; normal repository helper cleanup remains primary.
All recorded Node/Chrome groups and owned profiles are absent at final check;
see final-owned-cleanup.json. The seven unowned existing hpfc-prof directories
were not touched. Only normal user Chrome root680 remained in final metadata.

## Evidence and next step

`prerequisites.json` freezes selectors/counts/source hashes. Each run has complete
`.stdout.tap`, `.stderr.log`, and supervisor `.json`; Node may prefix worker
stderr diagnostic records into TAP, so an empty stderr file is not missing trace.
`diagnosis-summary.json`, `full-e2e-summary.json`, `concurrency-limits.json` and
`final-owned-cleanup.json` summarize qualified findings. Temporary supervisor and
trace sources/hashes are retained. Original checkout remains clean with source
hashes preserved.

Full Mac remains failed/unresolved; Linux exact-head full CI remains the verified
full-suite gate. Before any repair, independently review a scoped amendment,
add a meaningful spec-first regression and mutant, preserve deadlines/assertions/
fit budgets, inspect focus/activation risks, and require full Mac + Linux proof.
Do not ship the temporary preload as a fix or claim every failure is explained.
