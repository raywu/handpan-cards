# Future task: evidence-led codebase and test robustness investigation

Owner requested2026-10-25. **Queued future planning task; do not start now.**
Run only once the other outstanding work is resolved. This is a durable task
brief, not the investigation prompt, a finished audit or a code-removal grant.

## Trigger and authority

Before activating, freshly resolve canonical remote DEV's ledger, the complete
plan-relevance inventory and later receipts, open PRs and active/interrupted
worktree ownership. Account for all other active, approved/queued, blocked and
owner-deferred plans, including SEO's defined research/planning deliverable and
SPS's explicit decision. They must be completed, contradicted/obsolete with
evidence, or explicitly disposed/deferred out of the active queue by the owner.
Waiting, missing evidence or an unmerged PR is not “nothing outstanding.”
Exclude this future task itself from its trigger and respect owner-stopped ideas.
Do not invent endlessly expanding prerequisites from unapproved historical nits;
triage those candidates and record their actual disposition first. Never silently
mark a live task complete or use this audit to sidestep a pending owner decision.

Once triggered, the authorized next action is **prompt design and investigation
planning**, followed by independent review. Any resulting code/test deletion or
refactor needs a concrete scoped implementation decision under current guardrails.
Never merge main or modify CLAUDE.md without the owner's required explicit consent.

## Required sequence when the trigger is met

1. Re-establish the current project/source/tool/test baseline, approved requirements,
   generated-source boundaries and relevant historical decisions. Preserve dirty/
   locked worktrees; do not assume today's line numbers, counts or runtime remain.
2. Design a focused prompt that directs a thorough repository and unit/integration
   test investigation. Give it explicit evidence standards, non-goals, lanes,
   dependencies, observable outputs and anti-regression acceptance criteria.
3. Critique and iterate the prompt before running it. Use independent adversarial
   feedback and frozen criteria below; preserve material findings and revisions.
   “Close to10/10” means no material unaddressed omissions against these criteria,
   not a self-awarded numerical score or a promise of flawless outcomes.
4. Run the refined prompt to produce an evidence-grounded, swarm-shaped plan with
   separate file ownership, independent investigation/test/review roles, small
   dependency-ordered batches and exact acceptance/stop/rollback conditions.
5. Run independent engineering plan review, plus design/interaction review wherever
   UI, input, accessibility, layout or observable behavior could change. Resolve
   findings and iterate the plan before any implementation. An author critiquing
   their own proposal does not satisfy independent review.
6. Present the final reviewed plan, evidence and residual limitations. Maintain
   staged authorization and actual regression-proof gates before executing it.

## Investigation coverage required in the future prompt

- Architecture, ownership and source-of-truth boundaries: app, readable engine,
  canonical data, generated embeddings, print paths, tooling and integrations.
- Robustness: failure/invalid-input paths, resource lifecycle, cancellation,
  concurrency/races, storage/share compatibility, error propagation and recovery.
- Efficiency: measured hot paths, repeated work, rendering/state churn, test and CI
  bottlenecks. Profile first; do not optimize a guessed bottleneck or add complexity
  without a baseline and a discriminating measurement.
- DRY/maintainability: duplicate rules/logic/fixtures versus intentional independent
  test oracles, stable interfaces, coupling and safe decomposition. Do not merge
  production logic and its expected test values into a shared tautology.
- Dead code: enumerate all actual callers and dynamic registrations, including
  event listeners, inline handlers, generated regions, reflection/eval, conditional
  paths and external/CLI entry points. A grep miss or coverage gap is not proof of
  deadness. Classify uncertainty instead of deleting unproven paths.
- Unit and integration tests: spec coverage, vacuous/mirrored assertions, mutation
  intent, flaky/timing-sensitive checks, hidden shared-state/order dependence,
  realistic lifecycle/error journeys, duplicate coverage versus valuable independent
  controls and useful failure reporting. Do not call a test dead merely because
  another test covers the same line or it did not execute in one selection.
- Security/accessibility/operational behavior where relevant, with least privilege
  and secret isolation. No new services, installs or broad permissions by default.
- Instruction/workflow and documentation drift as part of maintainability, without
  changing Claude behavior or conflating native-agent execution with all skill parity.

## Frozen prompt/plan acceptance rubric

Every proposed change must include current source/symbol/test evidence, the
observable requirement or measured problem, classification/confidence, exact
scope/non-goals, dependencies/owner, expected benefit, meaningful verification,
potential regressions and rollback. Separate demonstrated defects, coverage gaps,
measured performance issues, recommendations and uncertain candidates.

Every removal candidate needs a caller/entry-point inventory plus a safe negative
control establishing that removal preserves required behavior and useful test
coverage. Preserve intentional safety checks, compatibility readers, independent
oracles and accepted product constraints. Do not weaken tests, lower floors,
relax timeouts/fit budgets or treat skip/cancel/timeout as proof of correctness.

The plan must provide representative baseline and red/green controls, meaningful
generated mutants for new regression groups, exact-head full CI, independent final
review, actual DEV validation and explicit device/runtime limitations. Performance
claims require before/after measurements under comparable conditions. Passing
tests alone cannot establish that all behavior is unchanged.

Prefer small reversible changes with independent acceptance over a broad cleanup
rewrite. Preserve raw failures, original source hashes, review findings and
unverified assumptions. Stop for unexpected app/data changes, missing dependencies,
conflicting requirements or unknown ownership; no destructive cleanup or resets.

## Deliverables and recovery breadcrumb

At future activation choose current-date paths for:

- Iterated investigation prompt and its independent critique/revision log.
- Baseline/evidence map and candidate register, with deadness/duplication/efficiency
  claims classified by supporting proof and remaining uncertainty.
- Reviewed execution plan, lane/worktree assignments, regression strategy, stage
  gates, rollback/fallback and owner decisions.

Record activation/source/plan/worktree/owner, last completed step and exact next
action in the shared ledger. This task's current last step is **queued only**;
the investigation prompt has intentionally not yet been designed or run.
