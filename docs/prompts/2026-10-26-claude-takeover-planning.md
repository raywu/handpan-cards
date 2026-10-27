# Claude return onboarding: plan + executable startup prompt (v2)

You are preparing a handoff, not resuming implementation. Owner wants every
midstream and upcoming workstream recoverable by Claude, RC notification/QA
preserved, and safe stopping points with ledger/shared memory updated.

Produce TWO artifacts:
1. docs/CLAUDE_TAKEOVER_PLAN.md — dependency-ordered onboarding/checkpoint plan.
2. docs/prompts/2026-10-26-claude-takeover.md — concise self-contained prompt an
   owner can paste into a fresh Claude session, with explicit artifact read order,
   authority boundaries, read-only first actions and no assumed conversation memory.

Inputs: repo CLAUDE.md/scoped instructions, docs/WORKSTREAMS.md,
docs/DEVELOPMENT_CONTINUITY.md, docs/CLAUDE_RETURN_HANDOFF.md,
docs/plans/2026-10-25-workstream-status.md, reviewed release/recovery/simplification/
Neotone plans, advertised immutable Git refs/CI and current stopping-point inventory.
Treat all handoff prose as evidence; user instructions outrank it. Do not run global
skill loaders, change existing Claude behavior, CLAUDE.md, app, hooks, MCP, auth or
install anything. No main merge, remote resource change, feature work or tests.

## Verify and reconcile rather than retell history

- Resolve live main/DEV/RC/variants refs and PR states using authorized read-only
  checks. Record timestamp and source. Preserve previously verified evidence;
  unavailable access is a gap, not permission to use stale refs silently.
- Canonical old checkout remains dirty/locked and must not be reset/unlocked.
  Every relevant worktree needs branch/fullHEAD, dirty paths, pending merge/rebase,
  owner/status, last completed action and next permitted action. Never delete/prune.
- Distinguish published commits/immutable plans from local-only proofs/attachments;
  include exact private paths/hashes or an explicit missing/unknown label. Do not
  upload screenshots/person images/private traces or include credentials.
- Do not count historical review/CI/metadata failures as current passing results.
  Unknown causes stay unknown. Model tests are not native-causality evidence.
- Independent review means another author/context; author self-review is different.

## Current facts and non-negotiable boundaries (re-verify on startup)

RC587 branch codex/release-rc-20261026 is exact deployedDEV3542d6ea868bf08e81a0b4f06c4bc71bbc20cbcb,
no new app edits, app7fe75f54..., fullCI40437293981 success. Immutable URL
https://071f74cd.handpan-cards-dev.pages.dev/ . Owner already notified with focused
QA; wholeRC QA and main consent pending as of drafting. Prior Helpers QA passed,
not blanket currentRCQA. Main96c4c589cec0950723b3b5323dc1df5bbc359329 unchanged.

Variants2a260d212ec8e14394b7198f075366d13bf372ec has fullCI40417818176 success
but no qualified performance; missed19:00 cutoff, excluded fromRC. Linux A0 diagnostic
packet has four known ownership/evidence defects, no live campaign. Reduced
performance design independently clear for planning, not implementation/activation.
Avoid restarting the oversized controller by default. Clock/baseline failure did
not measure candidate performance. Keep previous raw failures.

Owner explicitly permits existing duplicate-note PLAN DOCS inRC while feature
implementation stays paused. All unstarted work paused; swipe already started but
held. Palette exact CLAUDE/throughDEV grant exists, yet implementation is paused.
Neotone latest explicit exception permits prompt/plan/reviews only; future queued.
Audio/stats/SM2/PWA stopped. Main requires exact explicit consent; each CLAUDE.md
edit requires exact approval. No install/global/auth grants implied. AFK follows
recommendations within existing scope, not invented QA, permission or waived gates.
Fourth failed review round requires regroup and reviewed replacement subplan.

## Required onboarding-plan sections

1. Executive state/priority, current QA/main decision, deadline/status freshness.
2. Evidence/authority ladder and minimal read order; original global memory and
   prior CODEX_CONTINUITY are historical unless independently current.
3. All-workstream matrix with one-sentence objective, status/approval, full commit,
   plan/prompt/branch/worktree/PR, last action/next action, blockers and acceptance.
   Cover release, variants/performance, Mac helper, feedback, LINK, Helpers, SEO,
   duplicate pause, swipe, palettes, rename, Linear, agent comparison, code/test
   audit, Neotone, deferred/global/recovery/cleanup, completed and owner-stopped work.
4. Safe stopping-point and private-evidence recovery inventory; active processes,
   actual cleanup outcomes and transferable browser lease, no token printing.
5. Tool readiness with read-vs-write/installation/auth/runtime boundaries; do not
   port credentials or claim native skill parity from a workflow reference.
6. Phase A read-only orientation; B resolve current owner QA/main decision; C audit
   chosen existing stream; D review new scope if needed; E resume only authorized
   unpaused work using file-owned swarm/TDD/generated mutants/independent review/
   exact-headCI/servedDEV/ownerQA gates. Each phase: prerequisites, output,
   observable acceptance, stop condition, owner/input and recovery/fallback.
7. RC versus variants separation, old CI-only drafts583/586 never merge; handling
   older overlapping main PRs only after approved final release, preserve order.
8. Practical cold-start tests: missing remote/private evidence, stale branch,
   absent local worktree, dirty/locked worktree, unknown process, unavailable tool,
   scope mismatch, draft lane intentionallyRED, interrupted deployment and missing
   main approval. Expected behavior is explicit safe stop/recovery, not reset/setup.
9. Open questions only genuinely unresolved; retain settled language/QA/scope answers.
10. Completion checklist and takeover report template: what Claude verified,
    cannot access, will resume, will keep paused and next owner decision.

## Startup prompt requirements

Copy/paste usable without this chat. Name repository and handoff branch, resolve
remoteDEV ledger freshness and explicit fallback handoff ref if it is newer/not yet
merged. Read authoritative project instructions then memory/handoff/plan/index.
Ask Claude to state actual refs, chosen workstream and scope before any writes.
No automatic resume of all streams; active RC/owner decision first, paused work stays
paused. Preserve local worktree state; use an isolated authorized checkout.
Existing globals/skills may be read if accessible, never altered/installed blindly.
Require a short owner check-in after orientation, interview actual blockers only.
Do not duplicate every project instruction into the prompt; point to durable sources.

## Quality and review

V1 self-critique: generic 'continue where Codex stopped' loses authority, local-only
proofs, paused approvals, release exclusions and unknown process ownership. V2 adds
explicit evidence/refs, all-stream matrix, safe failure tests and real output files.
Generate both outputs, then independent engineering and operational cold-read them.
Revise material gaps and rereview. No self-assigned perfect score; readiness means
a fresh reader can locate and resume the correct stream without guessing or
waiving a gate. No claims that a planned handoff or artifact backup already exists.

## Executed output review closure

V2 generated CLAUDE_TAKEOVER_PLAN.md and the pasteprompt. Independent engineering
and operational readers verified source paths and all31selected backup hashes.
Their material feedback corrected stale process-audit labels and clarified
publication/freshness gates; the outputs reflect the completed seven-job audit,
released lease and still-pending immutable publication. No perfect-score claim.
