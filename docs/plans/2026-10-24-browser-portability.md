# Shared browser validation and Mac diagnosis

Status: scoped diagnosis and runbook execution cleared; any harness repair requires amendment/review.
Owner: integrator. User authorized parallel work on 2026-10-24, alongside Naturalness.

## Goal and scope

Make the existing repository browser tests discoverable and reproducible by Claude,
Codex and other command-capable harnesses; diagnose the full local Mac failure
without weakening the test oracle. Naturalness continues as a separate workstream.
No application, parser, deck, geometry, layout-budget, dependency, global skill,
authentication or production changes are included. No main merge is authorized.

## Evidence and baseline

- Read-only GitHub API checks this turn: main `3caf5e28fa4f965d81d90a4f80d53b15f82f39fc`,
  dev `1510ea369573078e6296fe873edb6f538c3212a3`. Recheck before integration.
- `tests/helpers/cdp.js` is a Node/Chrome DevTools Protocol driver; no agent SDK
  or npm dependency. Mac requires explicit `CHROME_BIN`. CI uses Node22/Python3.12;
  this host has Node25/Python3.9, a reproducibility limitation rather than parity.
- `tests/run.sh`, `tests/suite_health.py`, `tests/CONTRACT.md` define execution,
  floors, no-skip checks and mutation requirements. Read their pinned candidate
  versions before executing. Browser tests create processes and temporary files.
- `logs/js-results.json` and `logs/js-suite.log` under
  `/private/tmp/handpan-htc-implement.uF12Os` contain a historical full-suite
  failure at `21931cf`, not the final HTC candidate. The suite-health log is
  excerpted. A 900s per-file timeout is distinct from a 20s CDP request timeout.
- Historical `logs/tr1-trace.jsonl` records an animation-frame wait stalling at
  an emulated640x360 viewport and a later viewport reset responding. This supports
  a scheduling hypothesis; it does not prove the full-suite root cause.
- Final HTC Linux full CI and actual DEV acceptance passed; full Mac completion
  remains unverified. Do not rerun completed HTC investigation or infer a browser
  fix from an agent change.
- `CLAUDE.md` development/DEV sections and README Development are existing
  discovery paths. No root `AGENTS.md` exists. The old CLAUDE dev clause saying
  "with no reviewer" conflicts with the owner's later independent review gate.

## Swarm lanes and ownership

| Lane | Owner/files | Output and dependency |
|---|---|---|
| N — Naturalness | Separate plan and source ownership; no shared helper edits | Corrected language plan; German Du, natural local tone, seven ordering messages, UI-only translation. Existing English scale-input grammar remains unchanged. Blocking language decisions stay explicit. |
| B — Browser diagnosis | Dedicated disposable checkout pinned to dev1510; initially no tracked edits | Full raw evidence, exact commands/runtime/head, hypothesis table and bounded repro. Any repair requires a reviewed amendment with exact file ownership and TDD. |
| R — Runbook/discovery | Separate checkout; `docs/testing/browser.md`, root `AGENTS.md`, focused pointers in `CLAUDE.md`, `README.md`, `tests/CONTRACT.md` | One authoritative operational runbook, thin pointers, correction of stale dev-review clause, fresh-context discovery evaluation. No global instruction installation. |
| I — Integrator | Plans, continuity and integration only | Reconcile reviews and source, schedule host resources, exact-head CI/dev gates. |

The runtime allows root plus three active agents. Stage authors, reviewers and
fresh-context evaluations into freed slots. Reviewers never certify their own
authored outputs. Parallel editors use separate worktrees; original root and
locked HTC checkout remain untouched. Worktrees do not isolate CPU, Chrome,
ports or profiles. Integrator grants one host-browser lease at a time across N/B/R;
record owner/PID/checkout/start/end. An unfinished process retains its lease.
After a disconnected owner, the integrator verifies the recorded job, Node group
and separately detached owned Chrome groups have terminated and owned profiles
are cleaned before releasing the lease. Elapsed time alone never releases it;
unknown processes remain untouched. If ownership cannot be proved, defer browser
jobs and investigate metadata without killing any unknown process.

## Execution stages

### 0. Review and preservation

Independent engineering review checks scope, evidence, diagnosis/TDD, concurrency,
failure handling and integration; independent workflow/design review checks
discovery, usability, accessibility/test routing and misleading readiness claims.
Resolve every material finding and re-review revisions before execution. Scores
alone are insufficient: no unresolved material finding, objective acceptance
covered, explicit limitations. Review targets this plan, not the current branch.
Record reviewer identities and precise reviewed revision/hash.

Record existing dirty/untracked files, root/head and remote refs. Preserve root
untracked onboarding/handoff/HTC documents. Do not pull, switch, reset or unlock
the root or another actor's tree. Isolated checkouts live under `/private/tmp`.
No installation, global config change or raw credential access.

### 1. Readiness inventory and bounded reproduction (B)

Capture exact head, OS/architecture, Node/Python/Chrome versions, selected
nonsecret environment overrides, browser discovery and required PDF-library
availability. Do not dump the environment or unrelated process arguments.
Reinspect tests and scripts on dev1510 before invoking them. Confirm no owned
browser/profile/port leftovers; report other actors' processes without stopping
them. Select an unused port where supported; do not invent unsupported flags.

Use explicit `CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
Run existing named checks first (boot, historical failing titles, and relevant
CDP lifecycle tests), recording matched/executed/passed/failed/skipped/cancelled
counts. A regex selecting zero tests or any missing-browser skip is not success.
Capture unabridged TAP/stdout/stderr to temporary evidence files and preserve exit
status. Run raw e2e once under a reviewed bounded process-group supervisor using
the existing 900s budget; no raised limits or blanket browser flags. If the
supervisor is custom, inspect and syntax-check it before execution, save its
source/hash and kill/reap only its own process group. Poll at <=60s and report
progress; do not hold a single blocking call for the entire suite.
For baseline subprocesses remove inherited NODE_OPTIONS, E2E_PORT,
HPC_COVERAGE_DIR, NODE_V8_COVERAGE, NODE_SUITE_TIMEOUT and
HPFC_CDP_PORT_TIMEOUT_MS overrides; preserve normal system environment and set only
the explicit Chrome path. Record names removed without exposing sensitive values.
Supervisor policy: 900s deadline, SIGTERM to owned Node group,10s grace, then
SIGKILL and bounded output drain. Track detached Chrome PID/profile ownership
separately and verify/reap those owned groups if normal teardown is bypassed.
Freeze selectors and expected selected counts by reading the pinned file first;
do not infer intended counts from a passing filtered run.

Compare isolated named tests versus the full-file ordering on the same SHA.
Record the first failing title and the preceding sequence, request method/time,
viewport/emulation, stderr and cleanup. Use a bounded reduction of that sequence
only if failure reproduces; do not claim a reduced case is the full cause without
a discriminating experiment. Hypotheses include animation-frame scheduling,
test state leakage, resource pressure and runtime/browser version differences.
Do not call any confirmed before evidence separates them. After three unsuccessful
diagnostic attempts at the same hypothesis, regroup rather than repeat unchanged.

Exit: reproducible failure with evidence, or honestly qualified non-reproduction.
Document current operational limits even if no fix is established. Diagnosis
failure does not block independent runbook improvements or Linux-gated Naturalness.

### 2. Shared runbook and discovery (R)

Write `docs/testing/browser.md` as the agent-neutral source for:

- Triggers: UI/copy/localization, layout, input/focus/navigation, browser/CDP/test
  harness, printing, and release verification. Map each to relevant existing
  tests/probes; print checks require the existing Python PDF dependencies.
- Prerequisites and version differences; Mac Chrome path, Linux CI discovery;
  no installs implied. Separate installed/configured/operational/validated states.
- Working-directory requirements and exact targeted/full/suite-health commands
  verified against source. Explain targeted smoke versus full regression versus
  mutation gates. Never conflate `run.sh node` with all Python/mutation checks.
- Real/fallback font coverage and offline interception limits, language candidate
  semantics, panel-fit budget preservation, and no physical-device/Safari claim.
- Isolation, one-browser lease, per-run artifacts, time bounds, owned-process/profile
  cleanup, interruptions, safe retry and CI fallback. Never kill all Chrome or
  delete profiles belonging to other sessions.
- Evidence template: commit/tree, command, runtime/browser, start/end, raw logs,
  exit status, matched tests/counts/floors, skip/cancel totals, font/language modes,
  failures, cleanup and limitations. No secrets in reports.
- Planning selects required checks; implementation uses spec-first red/green;
  review assesses actual coverage and missing evidence; check-in reports each
  lane's status and interviews only unresolved owner decisions/blockers.
- Exact-head full Linux CI plus addressed independent review gate before dev;
  actual served DEV identity and affected journeys checked after integration;
  main requires explicit owner consent. Local Mac failure stays visible.

Add short discovery links in root `AGENTS.md`, `CLAUDE.md`, README Development,
and `tests/CONTRACT.md`. AGENTS points to existing shared project/test rules rather
than copying their contents. Correct only the obsolete no-review dev clause;
do not broadly rewrite historical project documentation. Do not edit global
skills/hooks. Include a workflow mapping in the runbook for planning, swarm,
engineering/design review, implementation, `/review`, and check-in; do not claim
these global Claude workflows have been migrated or validated.

Fresh-context discovery: two independent, non-author agents, one starting from
AGENTS and one from CLAUDE, receive the same concrete UI-copy task without a
browser hint and no conversation history. Read-only only. Each must find the
shared runbook, select targeted + language/fit checks and full CI as applicable,
state Mac limitation, preserve budgets/input grammar, describe evidence and
dev/main gates, and report missing prerequisites. A third command-only harness
recipe must work from README with no agent-specific dependency; this is static
portability evidence until another actual harness executes it. Negative scenario:
browser unavailable or local timeout must yield incomplete/blocked coverage,
never PASS. Record the prompts/responses and observed omissions; revise pointers
and repeat only failures. This tests discovery, not full execution parity.
Also exercise stale-CI SHA (reject as delivery evidence), zero matched tests
(incomplete), an occupied browser lease (defer, no parallel launch), and inherited
timeout/coverage overrides (identify and establish a controlled baseline rather
than claim equivalent evidence). Runbook order: choose checks, prerequisites,
execution, evidence, recovery; show current limitations near the top.

### 3. Optional evidence-driven repair (B)

Stop at a diagnosis report before any harness code change. If a fix is supported,
amend this plan with exact files, causal evidence, a regression test derived from
observable lifecycle behavior, and expected red/green. Obtain independent eng
review of the amendment. No separate blanket implementation permission is needed
inside standing scope, but dependency installation/global config remains excluded.
Each new test group needs a meaningful mutant under `tests/CONTRACT.md`; timeout,
skip, cancellation or syntax failure is not a kill. Generate patches from actual
clean committed source diff; `# kills` selects exactly one named test and clean
baseline passes. Raise only owned floors to observed counts, never lower them.
Preserve all assertions, font/fit budgets, deadlines and true browser behavior.
If evidence does not support a safe fix, keep the runbook honest and queue the
specific unresolved issue; no speculative cleanup refactor.

### 4. Integration and acceptance

Use a scoped branch per implementation lane and keep source contributions out of
dev until the integrated candidate is independently reviewed. R is documentation
and instructions, not a browser fix. R starts at freshly verified main and changes only its listed files;
compare app/deck/engine bytes to that exact main parent. Its dev integration must
preserve app/deck/engine bytes relative to the recorded pre-merge dev parent.
B's dev1510 checkout is diagnostic only; a repair amendment must explicitly
choose its main-based release branch and any CI-only HELD combined-dev companion.
Never release dev's held i18n/SOD history through a runbook or harness PR. Any
combined-dev companion is CI-only and must not merge into production. Because
README/CLAUDE/CONTRACT changes trigger
full CI, do not use a plan-only skipped run as validation. For B code changes,
require red-before/green-after, lifecycle cleanup proof, full Mac e2e plus normal
suite-health checks without skips/cancellations, relevant mutants and full Linux CI.
If full Mac remains broken, label B unresolved rather than release a claimed fix.

For either delivered lane, use main-target HELD CI PR and same-head dev PR; green
full `validate` at exact head, final diff inspection and fresh independent review
with all material findings addressed precede dev merge. Re-review/retest changed
heads. Serialize integration with Naturalness and rebase/revalidate any shared
source changes. Actual DEV verification confirms served commit content and
affected behavior; for a pure documentation lane, app bytes unchanged is the
appropriate deployed check, not invented visual evidence. Never merge main,
release held i18n work, close old PRs or delete original worktrees incidentally.

## Acceptance and failure handling

| Requirement | Observable pass | Failure/response |
|---|---|---|
| Discoverability | Both fresh agents locate one shared runbook and select correct gates; README recipe is agent-neutral | Repair pointers/content; no global migration claim |
| Reproducibility | Exact commands/prerequisites/head and complete raw evidence, owned cleanup | Missing tool/version/access becomes limitation; no installs or inferred success |
| Mac diagnosis | Failure reproduced/reduced with discriminating evidence, or explicitly not reproduced | No root-cause/fix claim; preserve CI fallback and next hypothesis |
| Mac repair if proposed | Test red before fix, green after, meaningful mutant, full Mac zero-skip pass, full Linux CI | Stop claimed repair; revert only own isolated edits, retain evidence |
| Project safety | No app/input/deck/geometry/budget changes, protected trees unchanged | Stop scope breach and inspect; do not reset others' work |
| Release safety | Independent final review, exact-head CI, dev check, main held | No merge until evidence holds |

Rollback: keep documentation and any harness fix separately reviewable; abandon
unmerged branches safely, or propose a scoped dev-revert PR under the existing
branch model with current review/CI gates. Never reset shared history. Retain raw
diagnosis evidence and original instructions for comparison. Main rollback needs
explicit owner approval. No production incident procedure is invented here.

## Decisions and reporting

Settled: parallel Mac lane now authorized; shared runbook/discovery required;
Naturalness UI-only, English scale input unchanged; no main merge. No new owner
choice is needed to begin reviewed bounded diagnosis and runbook work. Ask only
if an actual decision exceeds scope (installation/global settings, broader fix,
hardware-specific validation, or production release). Report root cause confidence,
what actually ran, ongoing blockers and next action independently for B/R/N.

## Review ledger

Draft v1 received engineering8.8/design9.1 with material findings on branch
composition, negative discovery cases and stale-lease recovery. All addressed.
Reviewers `browser_plan_eng_review` and `browser_plan_design_review` independently
re-reviewed substantive revision SHA256
`7212235fd3c10aefb2fb0cf3aed9b7cddf72cad2db2074a539c8d3f01bd4214d`
and cleared9.6/9.5 respectively, no material findings. This ledger/status update
does not change reviewed execution scope. B/R execution started in isolated
`/private/tmp/handpan-browser-parallel.HskZRy/{diagnosis,runbook}`. Diagnosis owns
the exclusive host-browser lease; no other host browser job scheduled.
No repair or main merge authorized by plan clearance. Existing user authorization
remains in force; this is a quality gate, not a repeated permission request.
