# Browser validation runbook

Shared operating instructions for Claude, Codex, humans and command-capable
harnesses. Run commands from the root of the **isolated worktree being tested**.
Project behavior remains specified in [CLAUDE.md](../../CLAUDE.md); test and
mutation design remains specified in [tests/CONTRACT.md](../../tests/CONTRACT.md).
This document routes execution and evidence; it does not install or activate
global workflows.

## Current limits

As of 2026-10-24, targeted Mac browser checks and the completed Resources
restoration's separate deployed DEV checks have passed. A historical full Mac run
timed out at the 900-second per-file bound with CDP errors. The cause is unresolved;
the suite timeout and individual CDP request deadlines are distinct. Changing agents does not repair
the host. Full Linux `validate` passed for that workstream's final reviewed
commits, which does not establish green CI for another head or a successful full
Mac run.
The active diagnosis plan is
[Shared browser validation and Mac diagnosis](../plans/2026-10-24-browser-portability.md).
Its evidence must qualify any later claim that this limitation has been resolved.

Headless Chromium checks do not establish Safari/WebKit behavior, physical-device
or native-picker behavior, real iOS keyboard behavior, Google Fonts delivery,
or availability of an external link's destination. The existing harness uses
isolated profiles, not the owner's signed-in browser.

## 1. Choose checks during planning

Read the task's approved requirements and the candidate's existing test titles
before selecting commands. Record exact selectors and expected selected counts
before execution. Do not invent a generic test count: suites change by branch.

| Change or stage | Required selection |
|---|---|
| UI copy/localization, settings, Resources or layout | Relevant app tests and browser journeys; panel-fit probe when settings-panel fit can change, with real and fallback fonts and affected supported languages. Preserve existing budgets, tolerances, targets and equations. |
| Input, focus, keyboard, navigation or storage | Relevant observable browser journeys, including error/restoration paths and the affected viewports. Parser/unit tests supplement browser evidence. |
| Browser/CDP or test infrastructure | Existing lifecycle/error/cleanup tests plus a spec-first regression test for the demonstrated defect. Any repair needs reviewed scope and red-before/green-after evidence. |
| Browser printing/PDF changes | Relevant browser PDF tests and existing Python print/parity tests; provisioned PDF-library prerequisites must be available. |
| Final delivery | Full exact-head Linux `validate`, independent addressed review, then actual deployed DEV revision and affected journeys. Targeted smoke tests do not replace these gates. |

For the Naturalness workstream, only UI text is translated. Scale input keeps
the existing English A–G note conventions, accidentals, octave numbers and
bracket/zone grammar; parser, engine, scale data and user-entered names are
unchanged. A localization branch must actually contain the requested tables.
Do not claim multilingual coverage from an English-only page or a silently
ignored language selection.

Workflow routing:

- **Planning / swarm:** assign file ownership, separate editor worktrees, required
  checks, a sole integrator and one host-browser lease. Put prerequisites and
  acceptance commands in lane briefs; do not let workers invent their oracle.
- **Engineering plan review:** check source/data synchronization, failure paths,
  resource ownership, meaningful regression tests/mutants and recovery.
- **Design plan review:** check responsive states, clipping, readable copy, focus,
  keyboard/touch targets, accessibility and font/language coverage. Existing
  approved budgets and grammar are constraints, not redesign invitations.
- **Implementation:** follow the testing contract, demonstrate the intended red
  before a repair and green after it. Documentation alone needs no invented tests.
- **Independent `/review` or equivalent:** review the exact SHA read-and-report
  only; inspect actual evidence, changed scope, missing checks and limitations.
  An author critiquing their own output is self-review.
- **Check in:** verify each lane's current status and evidence; interview the
  owner about unresolved decisions/blockers, recommendation first, one item per
  question. Do not repeat settled questions or treat silence as an answer.

These are shared behavioral requirements. Their presence does not establish
that every Claude global skill has been migrated or validated in another agent.

## 2. Establish prerequisites and reserve resources

CI uses Node 22, Python 3.12 and the packages in
[requirements-ci.txt](../../requirements-ci.txt) (`reportlab`, `pymupdf`,
`fonttools`). Browser automation uses the repository's
[CDP helper](../../tests/helpers/cdp.js) and installed Chrome/Chromium; there is
no npm install or package.json. Different local versions are a limitation to
record, not proof of CI parity. Installation or global configuration changes
are separate actions; this runbook does not authorize them.

On Mac, set the explicit path for this shell/job:

```sh
export CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

On Linux, use the installed browser discovered by `findBrowser()` or an explicit
valid `CHROME_BIN`. The helper's default candidates do not include the Mac app
path. A file existing, discovery finding it, launching it, running a journey and
completing a full suite are separate readiness states.

Safe prerequisite diagnostics, after reading the candidate's helper:

```sh
git rev-parse HEAD
git status --short
node --version
python3 --version
node -e 'console.log(require("./tests/helpers/cdp.js").findBrowser())'
```

Do not dump the environment or credentials. Record selected nonsecret runtime
settings. For an ordinary diagnostic baseline remove inherited overrides by
name; retain normal system environment and the explicit Chrome path:

```sh
unset NODE_OPTIONS E2E_PORT HPC_COVERAGE_DIR NODE_V8_COVERAGE
unset NODE_SUITE_TIMEOUT HPFC_CDP_PORT_TIMEOUT_MS
```

Use a dedicated shell/job so this does not disturb another task. Deliberate
coverage or failure-injection runs may need these variables; record them as
different experiments. `E2E_PORT` otherwise pins a shared port; unset it to use
an OS-selected loopback port. Coverage variables write artifacts. Timeout
overrides change evidence; never lengthen bounds to label the existing run green.

The integrator reserves **one host-browser job at a time**, across all agents and
worktrees. Record lease owner, worktree, job/PID, start and completion/cleanup.
The panel-fit job's own base/candidate browser pair is one scheduled job. An
occupied lease means defer, not launch a competing browser. Parallel source
investigation and isolated editing can continue. Unknown processes are not ours
to terminate. Worktrees isolate files, not CPU, ports, profiles or services.

## 3. Execute the selected commands

Use a unique temporary artifact directory outside tracked source. Capture raw
stdout/stderr and the command's real exit status; avoid a pipeline that hides it.
Monitor long jobs at intervals no longer than 60 seconds. Browser diagnostics
need a reviewed bounded supervisor with owned process-group cleanup; raw Node
commands below do not add a whole-file wall clock by themselves. The existing
suite-health runner bounds each JS file at 900 seconds by default. Follow the
active diagnosis plan for a supervised raw full-file reproduction; do not
invent a `timeout` binary or assume it exists on Mac.

An existing single browser smoke test on the runbook's initial main baseline:

```sh
node --test --test-name-pattern='boots with the default deck loaded' tests/e2e.test.js
```

Verify that title and the task-specific selectors in the actual candidate first;
Node can match a hierarchical full name, so do not add anchors without verifying it.
For this example exactly one selected test must execute and pass. Node can
report filtered-out tests as skipped: distinguish those from a missing-browser
skip or a skipped required test. Zero selected tests is incomplete coverage,
even if exit status is zero. A smoke test establishes only that selected journey.

Existing broader entry points:

```sh
./tests/run.sh node
python3 tests/suite_health.py
./tests/run.sh python
./tests/run.sh mutants
```

`run.sh node` expands JS test files; it does not include Python or mutations, and
has no added whole-run supervisor. Do not use `node --test tests/`: this project's
Node invocation requires files/globs, not that directory. Suite health runs the
Python and JS checks with floors and browser availability checks; inspect all
reported failures, skips and cancellations, not just a trailing summary.

CI's bounded JS execution/reporting entry point is also available:

```sh
python3 tests/suite_health.py --emit-js /absolute/path/to/unique-artifacts/js-results.json
```

Replace the output path with your run's unique directory. This runs JS suites
and emits their results; it is not the complete Python/mutation/CI gate. The
suite-health console excerpts long output, so a diagnosis requiring the entire
e2e TAP stream must use the reviewed raw-run supervisor and retain its raw log.

Mutation runs alter files in place. Use clean committed source in a disposable
checkout, never a live editor's tree; obey the contract's baseline, generated
diff, exact named-test, timeout and Python-bytecode precautions. A timeout, skip,
cancellation or syntax failure is not a valid killing assertion. Never lower
existing test floors or weaken assertions to obtain green.

Panel-fit examples (replace placeholders with verified immutable commit SHAs):

```sh
node tools/probe/panel_fit.js --base BASE_SHA --candidate CANDIDATE_SHA --font both --workers 1
node tools/probe/panel_fit.js --base BASE_SHA --font both --workers 1
```

The second command measures the current working-tree `index.html`; `--candidate`
reads committed content and cannot measure uncommitted translations. Where the
candidate supports the locale, append `--lang de` (or another inspected supported
code). The probe applies that option to **candidate only**; base remains its
default English. This is not a same-locale before/after comparison. If base and
candidate HTML bytes are identical, the CLI returns early with zero measured
cells; that can establish byte identity, not a newly executed geometry or
language matrix. A narrowed `--widths` diagnostic does not replace the full
approved domain. Preserve accepted baseline budgets and both font modes.

Ordinary e2e blocks external font loading and measures fallback metrics.
Panel-fit real mode uses checked-in font files through the helper and verifies
loaded faces; it does not verify Google's live font delivery. Report requested
and observed modes, measured cells, skips, invariance and failures separately.

## 4. Record evidence and apply delivery gates

Keep this receipt with the workstream's durable results and point to raw logs:

```text
Task/lane and requirement:
Checkout; exact HEAD/tree; dirty paths; base/candidate SHAs:
Command and frozen selectors / expected selected count:
OS/architecture; Node/Python/Chrome version and binary:
Relevant nonsecret environment choices and prerequisites:
Browser lease owner / job and owned Chrome/profile metadata:
Started / finished UTC; exit status:
Selected/executed/pass/fail/required-skip/cancel counts; filtered-out count:
Suite floors; font/language/viewport modes; probe cells/skips/invariance:
Raw stdout/stderr and artifact locations:
Failure classification; cleanup result; limitations; next action:
CI workflow/run URL and exact head; independent reviewer and reviewed SHA:
DEV served identity / affected journeys, if integrated:
```

Absence of a required tool, a missing-browser skip, local timeout/cancellation,
an empty selector, or stale evidence leaves the corresponding coverage incomplete
or blocked. Targeted Mac success does not turn the unresolved full suite green.

For delivery, the integrator verifies a completed successful **full `validate` at
the final head**, with addressed independent review at that same revision and
final diff inspection. CI runs for main-target PRs and main pushes, **not**
dev-target PRs. Use the established main-target HELD CI PR and same-head dev PR
model, with a CI-only combined-dev companion if the reviewed workstream requires
one. Never mistake a plan-only skipped workflow for full validation, or expose
held dev history through an unrelated release branch.

After dev integration, verify actual served content against the merged source
and exercise affected journeys; HTTP 200 or an old screenshot is insufficient.
For documentation-only changes, preserving the pre-merge dev app/deck/engine
bytes is the relevant deployed check, not invented visual testing. A main merge
always requires explicit owner consent, including a documentation release.

## 5. Recover without disturbing other work

On failure retain logs, the exact head and the first useful failing title/state.
Distinguish browser discovery, launch, CDP request, assertion, per-test and
whole-file timeouts. Do not call a historical scheduling/starvation hypothesis
the root cause without a discriminating experiment. After three unsuccessful
attempts at the same hypothesis, regroup and revise the investigation.

The helper registers owned browser process groups and temporary `hpfc-prof-*`
profiles for normal close and process teardown. A forced kill can bypass normal
teardown: verify the job-owned Node group, separately detached Chrome groups,
profiles and loopback server are gone before releasing the browser lease. A
disconnected operator or elapsed deadline does not release it automatically.
If ownership is uncertain, defer and inspect metadata; never broadly kill Chrome,
delete profiles by wildcard, stop unknown listeners, or reset another worktree.

Do not repair application behavior or change browser flags speculatively as part
of diagnosis. A supported harness repair needs a reviewed plan amendment, exact
file ownership, meaningful TDD/mutant proof, full Mac completion if claiming a
Mac fix, and full exact-head Linux CI. Until then use the verified Linux gate and
record the Mac limitation. Missing installations or required global changes are
separate scope/approval decisions.

Abandon only your own unmerged edits/branch under the workstream's preservation
rules. For integrated work propose a scoped dev-revert PR with the current review
and CI gates; never reset shared history. Production rollback is an owner decision,
not permission conveyed by this document.

## Discovery validation

A fresh agent starting with `AGENTS.md` or `CLAUDE.md` should find this runbook from
a concrete UI-copy task without being told to look for browser testing. A generic
command harness starts with README Development and follows its testing links;
a harness that does not read repository instructions must receive those paths
in its task brief. These links do not enforce behavior in an arbitrary harness.

Use two independent non-author fresh contexts (AGENTS and CLAUDE entry points).
Read-only discovery should select relevant targeted/language/fit checks and full
CI, preserve budgets/input grammar, state prerequisites and the Mac limitation,
and describe evidence/dev/main gates. Supply negative cases: missing browser,
local timeout, stale CI SHA, zero matched tests, occupied browser lease and
inherited timeout/coverage settings. Each must reject unsupported success and
identify the next safe action. Save prompts/responses and omissions, repair the
specific gap and repeat failed cases. Record a README-based static command walk
separately: it is portability evidence, not another harness's successful execution.

Source references: `tests/run.sh`; `tests/suite_health.py`; `tests/e2e.test.js`;
`tests/helpers/cdp.js`; `tools/probe/panel_fit.js`; `tests/CONTRACT.md`;
`.github/workflows/validate.yml`; `requirements-ci.txt`. Read the versions in the
tested worktree, not stale excerpts or another branch's counts.

## Saved-variants storage probe (scoped diagnostic)

`tools/probe/saved_variants_cases.py` creates the four frozen public migration
cases from `tests/fixtures/saved_variants_v1.json` in a fresh output directory.
`tools/probe/saved_variants_storage.js` measures one case per invocation. Neither
tool grants browser access or replaces the sole-host lease, approved supervisor,
source review, process/profile census and actual execution-evidence checks above.
No owner storage/profile data is used. Refuse to run if those prerequisites or
a reviewed bounded supervisor are unavailable; do not install tools implicitly.

Example preparation (choose a fresh owned absolute directory):

```sh
python3 tools/probe/saved_variants_cases.py \
  --fixture "$PWD/tests/fixtures/saved_variants_v1.json" \
  --out-dir /private/tmp/owned-sv-cases-UNIQUE
```

Read the emitted manifest, verify the fixture/case hashes against the reviewed
contract, and freeze the candidate's actual `index.html` SHA before any browser
launch. Under the reviewed external supervisor, serialize one command per case:

```sh
node tools/probe/saved_variants_storage.js \
  --repo "$PWD" \
  --case /private/tmp/owned-sv-cases-UNIQUE/records-2.json \
  --case-sha REVIEWED_64_CHARACTER_CASE_SHA \
  --source-sha REVIEWED_64_CHARACTER_INDEX_SHA \
  --out /private/tmp/owned-sv-receipts-UNIQUE/records-2.json
```

These are templates, not runnable placeholder hashes. This probe now targets the
transactional-IDB amendment. Execution requires independent source review and a
strict reviewed helper hash. The stderr-drain repair helper was independently
cleared at SHA256 `178e034c3d9395bd92a7250b50b8ec5858bb177bb6678e500870699701b50826`;
that exact hash is pinned. A later helper change requires fresh independent
review. A mismatch is a stop, never permission to skip checks.

Use2/20/200-record and exact-final1MiB cases with unchanged producer hashes and
UTF8/UTF16 accounting. Each invocation requires30 actual Document-bound samples,
30 acknowledged native-IDB resets and exactly one migration lock callback per
sample. After navigating to about:blank, await CDP Storage.clearDataForOrigin with
storageTypes indexeddb on only the probe's exact owned http://127.0.0.1 ephemeral
server origin. The prelude then seeds the legacy keys; the new-format localStorage
key stays absent. Never clear an owner origin or use a signed-in/shared profile.

The observer preserves callback receiver/arguments, request receiver/options and
signal, exact callback result Promise and exact request Promise. Native-Promise
observers measure entry through settlement conservatively including observation
overhead; async callbacks are expected. Non-native-Promise object/thenable results
invalidate timing. Callback return time cannot stand in for async lock lifetime.
Rejection observers mark those original Promises handled and suppress their
unhandledrejection telemetry despite preserving identity. An empty unhandled
array is not evidence that the app handled those rejections itself.
Grant wait and request settlement are also recorded; callback lifetime excludes
final native release scheduling. Entry synchronous span and post-return residual
do not claim a total CPU versus I/O decomposition.

Every observed native IDB open, transaction and get/getKey/put attempt is retained
with phase, metadata, timestamps and success/error/abort/complete. Nothing is
filtered out to meet an expected count. Application transactions are distinguished
from the probe's separate readonly verification. Actual current presence and value
are accepted only at that transaction's complete, never from app state or a
localStorage mirror. Report creation-to-settlement, first-read, put and completion
spans. Upgrade creation is first observed at upgradeneeded and labeled accordingly.
Unexpected schema or unexplained transactions fail measurement. When eval
returns, failed-sample metadata and source-Document binding remain in the failed
receipt; an eval timeout may leave only earlier Document/reset evidence.
The fresh-DB adapter sequence to confirm independently has three opens and five
transactions:
application absence-probe upgrade abort without schema, actual schema upgrade,
empty readonly metadata validation, readwrite get/getKey/put, then the probe's
separate readonly get/getKey verification. Thus there are four reads and one put;
the successful case includes one intentional aborted transaction. No initial
snapshot read is expected when absence was already proved. Review any extra or
changed sequence rather than ignoring it.

Keep50ms p95/100ms max across all30 async lock lifetimes for2/20/200. A miss needs
investigation and review, not outlier deletion or budget inflation. This reviewed
metric is not numerically comparable to old synchronous callback CPU timings.
Stress must commit the exactly1MiB envelope or prove actual native
QuotaExceededError in the migration readwrite transaction, no partial current,
protected mode until an explicit owner temporary action, and exact retained
legacy source bytes. Quota during schema creation/open intentionally fails the
exact sequence and does not qualify as accepted stress refusal. Other errors, incorrect bytes, extra/unsettled transactions,
timeouts or cleanup failure fail the run. Output parent must exist outside the
candidate even after symlink resolution; output and .part must be fresh. Atomic
publication refuses concurrent writers; retain failed .part files and logs.

The probe measures API transaction completion, async lock lifetime and independent
parse/normalize-build/serialization benches. It does not prove physical disk
flush, input-to-paint, two-tab correctness, real-font behavior, Safari or owner
devices. Same-host input-to-paint within one observed-frame budget and relevant
font/locale/device checks remain separate. Historical120 old-adapter samples stay
tied to their original source/runner and cannot establish IDB parity. The native
multi-target lost-ACK regression and full independent validation still block
release even if this single-page measurement passes. Review actual candidate
source, helper and persistence contract before final-candidate execution.
