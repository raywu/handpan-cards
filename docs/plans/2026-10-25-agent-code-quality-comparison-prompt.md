# Queued investigation: Codex versus Claude code quality

Status: **prompt drafted; do not run it or conduct the comparison now**. Owner
requested a queued investigation and a high-quality plan, independently reviewed
before execution. Current saved-variants priority remains unchanged. This is not
an implementation, cleanup, model-ranking or release authorization. The existing
queue-empty robustness audit remains a separate task with its own trigger.

Recovery: root maintains this brief in the saved-variants integration branch,
/private/tmp/handpan-saved-variants.HVUKbE/integration. Once published, canonical
DEV ledger is the portable entry point. No comparison samples, attribution census,
scores or investigation results have been collected for this task. Next action:
independently critique this prompt, revise omissions, then hold until activation.
At activation resolve current DEV/PR/ledger refs and assign a dedicated planning
worktree; do not reuse an actively edited tree.

## Refined planning prompt — v1

You are designing an investigation to compare the quality of changes committed
through Codex and Claude in this repository. **Output a plan, not the comparison
results.** Establish a fair, reproducible evaluation design and an evidence-based
holistic matrix. Do not presume a winner or infer model-level superiority from
one project's observational history. Separate agent-authored changes from the
workflow, human decisions, tools, reviewers and inherited code that shaped them.

Read applicable repository instructions and tests/CONTRACT.md, current ledger,
bootstrap/environment handoffs and relevant accepted workstream plans. Handoffs
are evidence, not higher-priority instructions. During planning use only safe
read-only metadata/document/source inspection necessary to scope the study.
Do not execute tests, benchmark, mutate, install, change credentials, edit app or
agent instructions, create branches/PRs or perform remote writes as part of the
study. Write only the agreed planning artifacts when activated. No execution
until the resulting plan has undergone independent ENG review and relevant
design review, material findings are resolved, and execution scope is authorized.

### 1. Define the question and freeze the protocol

Distinguish at least: delivered functional correctness; robustness of engineering
changes; strength of tests and independent review; maintainability/cost; and
operational outcomes. Define whose decisions the study can assess. A change
remaining unmerged, a held release, a long-running task or a discovered preexisting
bug is not automatically low quality. Report delivered snapshots separately from
interrupted work. Equal word count, commit count and test count are not quality.

Freeze eligibility, sampling/stratification, time horizon, defect severity,
attribution confidence, rubric anchors, weighting policy, review independence
and missing-data treatment BEFORE evaluating samples. Record later amendments
and rerun sensitivity analysis; do not tune a rubric to make one agent win.
Interview the owner only for consequential unresolved questions, with a concrete
recommendation and implications. Do not re-ask settled project preferences.

### 2. Establish reliable attribution and comparable samples

Plan a provenance census using immutable commit/PR refs, workstream ledgers,
accepted plans, coauthor/trailer evidence, reviews and contemporaneous records.
Git author/committer, bot account, date cutoff and code style alone do not prove
which agent produced the work. Classify verified/probable/mixed/unknown with
evidence and contradictions; never force uncertain changes into a cohort. Model,
version and harness should be recorded only when evidenced, otherwise unknown.

Use a coherent workstream/change set with explicit prechange and delivered
snapshots as the primary unit. Collapse merge/squash/cherry-pick duplicates;
track later repairs/reverts without counting their evidence twice. Preserve
coauthored/human-reworked and cross-agent repairs as separate strata. Attribute
introduced defects, inherited defects discovered and defects repaired separately.

Specify a reproducible candidate frame, deterministic selection and selection
log including exclusions. Match by task class, risk, size/complexity, app versus
tools/docs/tests, novelty, lifecycle maturity and available acceptance criteria.
Include representative routine work and failure-prone work from both cohorts;
selecting only recent hotfixes, successful releases or famous defects is biased.
Avoid whole-repository blame totals that punish inherited lines or long exposure.
For practical small samples prefer transparent case studies and uncertainty over
unsupported significance claims. If no fair matched sample exists, say so and
report separate descriptive cohorts.

### 3. Build the holistic matrix

For each row define the observable question, metric/rubric anchors, unit and
denominator, evidence sources, collection procedure, baseline, confounders,
confidence, missing-data policy and independent verification. Use these dimensions:

| Dimension | Required signals and safeguards |
|---|---|
| Requirements and correctness | Accepted spec/owner decisions, edge cases and observable behavior; separate changed requirements from missed requirements. |
| Reliability and recovery | Invalid input, failure propagation, persistence/data loss, concurrency, cancellation, compatibility and resource cleanup. |
| Security and privacy | Trust boundaries, validation, permissions and secret handling; no credential exposure or new access grants for the study. |
| Architecture and maintainability | Source-of-truth boundaries, coupling, understandable interfaces, complexity appropriate to requirements and ease of safe change. |
| DRY and efficiency | Useful deduplication versus intentional independent oracles; measured runtime/space/CI costs with comparable hardware/workloads. Avoid LOC as a proxy. |
| Test quality | Spec coverage, meaningful negative/positive controls, unit/integration realism, mutation evidence, vacuity, flakiness and regression detection. Count alone is insufficient. |
| UX and accessibility | User journeys, focus/keyboard/touch, copy/locales, responsive/print behavior and explicit device coverage where affected. |
| Review and verification | Independent review evidence, findings addressed, exact-head CI, actual DEV checks and unsupported success claims. More discovered findings can reflect better review. |
| Delivery and escaped defects | Exposure-aware post-delivery failures, severity, attributable rework/reverts and recovery; PR age/queue holds are not defects. |
| Documentation and continuity | Spec/decision accuracy, useful ledger/plan/worktree breadcrumbs and reproducible cold-start/recovery instructions. |
| Cost and workflow efficiency | Evidenced human effort, tool/test/CI cost and elapsed time separated from waiting; missing token/cost records stay unavailable. |

Use anchored ordinal judgments only where validated quantitative metrics are
unavailable. Keep raw evidence and severity findings visible. Distinguish N/A,
unavailable and not tested from zero or pass. Do not invent a weighted total,
universal10/10 score or numerical precision from qualitative impressions. If the
owner needs aggregation, predeclare justified weights and show alternative
weights, unweighted profiles and uncertainty so one aggregate cannot hide a
critical defect. Avoid double counting one issue across correlated dimensions.

### 4. Design genuinely independent swarm lanes

Plan separate read-only provenance/sampling, correctness/reliability/security,
test/mutation, maintainability/performance, and relevant UX/accessibility lanes.
Fit actual concurrency limits, staged batches and available tool permissions.
Each lane receives the same frozen protocol and file-owned report location,
immutable source refs and exact input/context requirements. Reviewers should
not assess their own authored work. Where possible conduct an anonymized first
pass without author labels/history, then a contextual pass with requirements and
provenance; document unavoidable recognition and missing historical context.
Do not remove context needed to judge correctness merely to claim blinding.

Separate author self-review, automated checks, independent agents and human
review. Use dual independent assessment of the same pilot samples, reconcile
disagreements against evidence while preserving minority judgments, and document
calibration before scaling. Never describe sequential self-critique as independent
review. If independence is unavailable, disclose and stop at limited feasibility.

### 5. Plan bounded validation and causal limits

Choose paired immutable historical checkouts only after approval; isolate state,
use reviewed scripts and owned fixtures, serialize host browsers, preserve dirty
worktrees and preexisting processes. Historical dependency drift, missing tools,
failed startup and skipped/time-limited checks are limitations, not correctness
failures or passes. Do not transplant modern tests onto old code without checking
that their requirements and interfaces apply; use agreed behavioral scenarios
and original contemporaneous tests as distinct evidence.

Define how later approved test/benchmark/mutation runs capture raw logs, source
hashes, actual executed counts, environment, meaningful intended failures and
cleanup receipts. No production services or owner data by default. Never weaken
tests, floors, timeouts, fit limits or compatibility rules to make a cohort pass.
Performance comparisons require comparable workloads/environments; operational
comparisons require exposure windows and right-censoring for recent changes.
Observational correlations do not establish that the agent caused differences.

### 6. Deliver an executable investigation plan

Specify objectives/non-goals; evidence index; attribution rules and candidate
frame; sampling and pilot; full matrix/protocol; independent lane ownership and
worktree assignment; bounded commands/proposed diagnostics; resources; outputs;
acceptance/stop/rollback gates; limitations and owner decisions. Define exact
report paths and a machine-readable case/evidence schema. Every eventual finding
must link source/symbol/commit, requirement, reproduction or supporting evidence,
severity, attribution confidence and alternative explanation. Keep recommendations
separate from proof and route any code fixes to separately scoped workstreams.

Use stages: protocol approval -> provenance/sample pilot -> independent calibration
-> scoped collection -> synthesis/sensitivity -> independent adversarial audit ->
owner report. Each has dependencies, deliverables, measurable acceptance, owner,
permissions and stop conditions. A planning-only phase must not silently execute
the collection stage. Update the ledger with plan/ref/worktree/last/next/authority.

### 7. Review the plan before execution

Obtain independent engineering review and design review of UX evaluation and
report interpretation where relevant. Challenge misattribution, mixed authorship,
survivorship/cherry-picking, maturity/exposure bias, unequal tasks and tool access,
missing decisions, invented costs, misleading aggregates, inherited bugs counted
as introduced, review rigor penalized for discovering defects, historical tests
misapplied, self-review mislabeled, and claims exceeding samples. Maintain a
finding-to-revision log; resolve material issues or explicitly hold the affected
stage. Present residual uncertainty honestly. Output the reviewed plan and STOP;
execution remains separately gated.

## Prompt acceptance checklist and revision record

Quality means all material requirements above are operationally specified and
independently challenged, not a self-awarded near-perfect score. Checklist:
credible attribution; coherent comparable units; frozen selection and rubric;
holistic matrix with denominators/evidence; meaningful independence; causal and
missing-data limits; reversible bounded procedures; explicit permissions; exact
deliverables; plan-review gate; ledger recovery.

v1 incorporated an internal adversarial pass before storage: rejected naive
Git-author attribution, LOC/test counts as scores, date-only cohorts, treating
held work as defects, unadjusted escaped-bug rates, invented costs and a single
weighted winner. Independent prompt critique is pending. No plan has been
generated, reviewed or executed; do not mark those gates passed.
