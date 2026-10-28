# Four-hour RC and 11pm Claude handoff — proposed release subplan

2026-10-26, America/Los_Angeles. Independent ENG/design review CLEAR after one revision round.
Owner asks for an RC in the next four hours and pausing all unstarted streams for
handoff to Claude at23:00. Clock observed17:11PDT: RC target21:11; handoff23:00.
This plan prepares a reviewable RC; it authorizes no main merge or new CLAUDE edit.

## Scope freeze and release decision

Pause all unstarted work immediately: palette implementation, SEO content/research,
rename execution, Linear investigation, agent-quality study, whole-code/test audit,
deferred nits/recovery/cleanup/global adapters and optional improvements. Preserve
each prompt/plan, authorization, refs and resumption point. Existing explicit
owner-stopped features and duplicate-note pause remain unchanged. Swipe is already
started but interrupted: recommend checkpointing/holding it for Claude rather than
resuming it in this RC window; preserve existing through-DEV authorization.

Only release-critical saved-variants performance work, RC review/QA and handoff
preparation continue. Primary RC includes saved variants only if every existing
gate passes; fallback excludes the entire feature, with no half-storage migration,
no weakened thresholds and no passing-CI-as-performance substitution.

Already-delivered Mac helper, per-ring Layout feedback, LINK ownership fix and
Helpers are fallback candidates, not automatically release-ready. SEO planning
docs can follow their existing order if independently verified without delaying
app delivery. Duplicate-note plan/functionality remain excluded while paused.
Do not merge DEV wholesale: its paused/unreleased docs and feature contents must
be reconciled against an explicit release manifest. Preserve relative order of
eligible outstanding deliveries; mark the paused item held, never silently release
it to clear the queue. CI-only draft PRs are never release-merge targets.

## Swarm roles (no new feature lanes)

- Coordinator: freeze refs, scope/clock ledger, assemble explicit primary/fallback
  manifests, sole browser lease and integrator; preserve dirty original checkout.
- Existing performance author: bounded revision of private activation packet,
  four material code-review findings and meaningful fixture/fault evidence.
- Independent ENG: review packet ownership/cancellation/evidence and release
  composition/CI; no author credit as independent review.
- Independent design/operations: QA journeys, status honesty, handoff usability,
  owner availability and branch/recovery clarity.
- Claude: future recipient only; do not send external messages or change its
  configuration/CLAUDE instructions. Write a repository-local return handoff.

## Timeboxes and gates

| Pacific deadline | Outcome / stop rule |
|---|---|
| Now–18:15 | Freeze unrelated work; close concrete performance-packet P1/P2 findings, fixture preflight/fault proofs and exact scope/authority review. Do not arm an unreviewed diagnostic. In parallel assemble the release-only fallback in an isolated branch from verified current main96c4c589, preserve eligible change order, exclude variants/paused duplicate-note artifacts, and obtain independent composition review. This is release preparation, not starting a paused feature. |
| 18:15 checkpoint | Freeze fallback full starting/target refs, ordered changes, exclusions, rollback manifest and review disposition; start its required exact-head CI as soon as reviewed. Verify an already-configured exact-commit preview route and its deployment metadata by this point. If no authorized exact-candidate deployment is available, declare that fallback verification blocked; do not roll DEV back or claim full deployment from app-byte equality. Report primary packet readiness/risk and any precise setup permission needed. |
| 19:00 hard variants go/no-go | Include variants only if qualified performance is ALREADY complete/passing, required CI on its frozen head is ALREADY green, and no material review blocker remains. Otherwise freeze its current green feature head and retain for Claude; fallback RC proceeds. No new perf attempts, hosts or relaxed budget to save deadline. |
| 19:00–20:15 | Select the primary or already-prepared fallback; finish independent final review, exact-head CI and deployment/affected journeys. Fallback uses an existing configured exact-commit preview route, only after observing its availability and authorization; no new hosting setup. Existing DEV source-equivalence can supplement but cannot replace exact fallback deployment metadata. By20:15, missing final CI or qualifying deployment means blocked RC, no late improvisation/waiver. |
| 20:15–21:11 | Owner QA opportunity and automated affected journeys; produce RC manifest with included/excluded features, immutable commits, full CI, DEV URLs, QA evidence, remaining risks and explicit main-consent request when ready. Missing owner QA stays unverified; do not manufacture signoff. |
| 21:11–22:30 | RC freeze; no new features. Address release-blocking findings only if safely retestable, otherwise hold release. Prepare portable Claude handoff and have one independent reviewer other than its author cold-read it. |
| 22:30–23:00 | Wind down owned processes/agents, record final exact refs and unfinished jobs, publish authorized recovery checkpoint and verify remote availability. Handoff by23:00. Do not abandon a half-applied fault or unsafe cleanup to hit the clock. |

Fallback release preparation must record actual duration of current full CI
(40417818176 ran about22.5 minutes from23:09:49Z to23:32:18Z; allow queue and
composition/review margin, not a guaranteed duration). Both fallback and primary
need their own exact release-head checks when their trees differ from the already
validated feature head. Release assembly is restricted to an isolated branch;
current DEV remains untouched unless its approved primary delivery gates clear.

The fallback deployment choice is an existing configured exact-commit preview;
availability is UNVERIFIED until observed, and must be established by18:15.
Do not create/configure a provider, change auth or repoint production to satisfy
this plan. If no such route exists, fallback can be a reviewed green source
candidate but is NOT a fully deployment-verified RC; report the missing gate.
Rollback manifest records pre-release main/DEV refs, exact deployment identity,
authority required for any reversion and preservation of user browser data.
No storage deletion/migration is authorized as a rollback shortcut.

RC definition: exact release scope and immutable source, independent addressed
review, full required CI, meaningful DEV verification/QA evidence and explicit
unresolved limitations. A list of green feature branches is not an integrated RC.
If no eligible composition clears by21:11, deliver an honest blocked-RC report and
Claude handoff rather than claim readiness. The deadline is a target, not a waiver.

## Current evidence and critical path

Saved variants2a260d212ec8e14394b7198f075366d13bf372ec has FULLCI40417818176
SUCCESS. Current source dc6af752; no DEV delivery. Performance remains HELD.
Concrete privatepacket A0 has four findings: cancellation ownership before spawn,
owned-phase acquisition before finalization, stage-specific required evidence,
provenance before failed-comparison budget classification. Protocol review clearance
is not code/test/campaign readiness. No repeated past Mac campaign is authorized.

## Handoff deliverables and portability

Proposed docs/CLAUDE_RETURN_HANDOFF.md: owner priorities/approvals/pauses and exact
CLAUDE edit boundaries; every stream's description/status; plan, branch, full SHA,
PR and host-local worktree; last verified action/next action; failures/known pitfalls;
CI/QA/performance limitations; lane ownership and running jobs; reproduction and
recovery instructions. Never overwrite Claude's original CODEX_HANDOFF documents.

Publish authorized nonsecret checkpoints in existing threads. Private-only packet
and indispensable evidence need a reviewed durable recovery path: publish sanitized
code/proofs to an appropriate retained ref if authorized, or provide an explicit
host-local backup manifest and label cross-host recovery unavailable. No secrets,
raw private traces or new remote setup by implication. Do not assert that a local
path alone is portable. Uncommitted docs in the current worktree are preserved.

Before23:00 require clean owned application source, no applied faults, process
cleanup, exact dirty/unpushed inventory and independent cold-read by a reviewer other than the author that can locate
and resume the chosen stream. Do not remove/reset/unlock worktrees. No CLAUDE.md
edits. Owner main consent is still required for the final exact release manifest.

## Decisions / approval boundaries

Unstarted-work pause is explicit owner direction, recorded now. Holding interrupted
swipe for handoff and using fallback if variants misses its gate are recommendations
under AFK preferences, not feature cancellation. No new product interview needed.
If owner is AFK for device QA, report automation separately and keep device QA
unverified. No main merge is approved by the deadline request. Exact Linux setup
outside existing grants remains separately gated after concrete review.

Review: /root/regroup_eng_review and /root/regroup_design_review both CLEAR after one revision round. Reviewed substantive draft SHA256 0707366ba3a694211e3a8b52a157aa381485a8d0e6f35bb931f2a55b4f7a2e9a. Clearances qualify planning only; performance, preview availability, exact release composition and QA remain unverified until executed.

## Owner QA scheduling confirmation

Owner confirmed availability for about20minutes of DEV QA when notified, ideally
20:15–20:45Pacific. Send the verified candidate URL/revision, included scope and
focused steps once ready. Availability is not a completed QA result or main consent.
