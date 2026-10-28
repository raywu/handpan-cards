# Saved-variants performance validation: simplify before resuming

Proposal only, 2026-10-26. User requested restructuring and an explanation of
infrastructure. This does not put variants back into tonight's RC, activate a
campaign, change application code or authorize new CI configuration.

## What the equipment does

| Component | Purpose | Existing evidence / disposition |
|---|---|---|
| Browser harness, tests/helpers/cdp.js | Drives real browser input, waits for app readiness and closes owned test browsers. | Existing repository capability; reuse. Mac issues do not imply every Linux job is broken. |
| Selection profiler, tools/probe/saved_variants_selection.js | Compare displayed selection responsiveness of old/new application with the same synthetic saved collection, desktop and phone viewport. | Reuse reviewed timing/statistic/budget logic. Default180 rows/six Documents, baseline-candidate-baseline; pin exact current source/helper/case. |
| Clock control | Check whether browser timing observations are usable without attributing host failure to the app. | Existing reviewed90-sample control, qualified separately; reuse inspected implementation, do not create another timing oracle. |
| Execution envelope | Put hard limits on diagnostics, retain logs, stop on invalid control and prevent another attempt being mislabeled as the same run. | Required behavior; prefer ordinary isolated hosted CI capabilities over a general-purpose supervisor. |
| Bespoke A0 controller/workflow | Implements provenance, event permissions, paths, signals, cleanup, upload validation and report classification. | Private/unactivated423-line Python controller plus workflow/tests/fault machinery. Four material defects; preserve as failed design evidence, do not build it out by default. |

These are test/diagnostic tools, not application requirements. Full functional CI
already passes for the variants candidate; incomplete baseline performance data
has never measured the candidate and must not be called a performance regression.

## Responsibility boundary

The prior process bundled measurement validity with a new orchestration framework.
Every new ownership/reporting abstraction created another surface to verify. Keep
measurement rigor; remove unnecessary orchestration and duplicate validation.
No fabricated quality score or arbitrary line-count threshold establishes success.

## Recommended smaller design to investigate and review

Use one isolated hosted CI job with existing browser helper, existing profiler and
reviewed clock control. Prefer built-in job/step time limits, immutable checkout,
read-only permissions and standard artifact upload. Keep only the minimum new
adapter needed for bounded subprocess execution and control eligibility.
Do not edit the permanent validate workflow merely for convenience. Choose the
smallest supported one-off trigger after checking current repository permission
and event behavior; exact proposed configuration still requires its scope review.
No workflow activation is approved by this document.

1. Freeze application2a260d21 and baseline3542 (immutable for this proposal, not whatever DEV contains on resumption), with full source,
   helper and exact synthetic200-record fixture hashes before seeing results.
   Narrow baseline rebind must be explicit; do not silently use old hardcoded92d6.
2. One90s control. Record actual report completeness, clock validity and helper
   cleanup. Invalid, timed-out, retried or unclean control stops the job before
   any comparison. No rerun-to-green.
3. Only eligible control permits one180s matched200-record comparison. Preserve
   existing samples, A-B-A ordering, phone/desktop cases, p95/frame allowance,
   drift checks, source binding and all raw rows. No exclusion or budget waiver.
4. Retain exact commands, environment/version, source/case identity, exit status,
   raw stdout/stderr and control/comparison reports using standard CI artifacts.
   Pass requires successful workflow AND complete verified evidence. Failure,
   invalid measurement and incomplete evidence remain distinguishable.
5. Existing helper/probe owns normal browser teardown. Use a fresh disposable CI
   runner; on timeout/interruption/uncertain cleanup stop the entire experiment,
   never proceed to comparison or claim cleanup from an exit code. Runner teardown
   limits escaped-process lifetime; it does not retroactively prove phase cleanup.
   Do not deploy this reduced ownership model on the shared owner Mac.

The90/180-second subprocess bounds remain exact; CI job/step deadlines are extra
containment, not permission to lengthen measurements. Timeout, cancellation,
helper startup-retry notices or uncertain teardown make control ineligible; do
not suppress notices or infer cleanup from eventual VM destruction.

One verdict contract: QUALIFIED_PASS requires bound app/helper/fixture, complete
90/180 reports and raw-row bindings, unchanged guards/statistics, clean phases,
successful workflow and verified retained artifacts. MEASURED_FAILURE requires
trustworthy provenance and a completed applicable comparison that fails the
unchanged budget. HELD/INCOMPLETE includes invalid clock/source, interruption,
uncertain cleanup or missing evidence. None of the nonpass states authorizes retry.

## Explicit complexity to remove

No custom path/publication framework, no copied event check in multiple layers,
no generic process-tree manager, no activation manifest that hashes its own
future commit, no self-test/fault catalogue embedded as live campaign admission.
Retain necessary source/event/attempt binding once at the trusted boundary, actual
negative tests and generated faults under the existing test contract. Do not
remove least privilege, privacy, honest incomplete-state reporting or cleanup gates.
Use a single local preflight report for reviewer acceptance instead of duplicating
all test attestations into the runtime controller. No unrelated tool changes.

## Small proof matrix and swarm ownership

Coordinator pins scope and sole activation; author drafts smallest adapter/config
in a separate scratch location; independent ENG checks source/timing/safety;
independent operations/design checks report clarity, recovery and usability.
No author labels their own critique independent review. Preserve current app bytes.

Meaningful fixture-only tests: invalid/incomplete/timeout control never invokes
comparison; valid control invokes it once; failed/partial/wrong-source comparison
never passes; timeout/interruption stops progression; absent evidence/upload failure
keeps result held; existing unknown shared processes are never touched.
Derive expected results from protocol, not implementation. Generate only faults
needed to establish new groups under tests/CONTRACT.md; keep these preflight proofs
separate from campaign execution. A new script loading is not operational evidence.

## Stop, schedule and continuation

Before implementation, independently review this reduced design and its exact
minimum delta. If safe reuse still requires a substantial new framework, stop and
return a concrete blocker/alternative instead of expanding. The fourth failed
review round triggers regroup under the standing owner rule.
Variants remains excluded from tonight's RC. Main candidate CI/QA and23:00handoff
retain priority. Archive A0 without deleting it; pass this proposal and unresolved
safety tradeoffs to Claude. Do not claim the reduced design implemented/tested or
that existing grants cover activation. No app, CLAUDE, global/auth or main change.

Review status: independent engineering and operational/design CLEAR for simplification direction/planning. Exact adapter/configuration, preflight and campaign activation remain unbuilt/unverified; no operational clearance. Their bound/verdict/baseline implementation requirements are incorporated above.
