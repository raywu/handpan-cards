# Sync store safety coordination — Refs TRI-28

## Goal

Stop non-durable or replaced local stores from propagating inferred deletions of other devices' scales.
Execute the independently reviewed sync-store-safety subplan (section17 focused correction READY),
engine E then client C. Non-goals: schema/auth/prod/email changes, feature expansion, benchmark or profiler
infrastructure, new UI/copy, main merges, deploys and migrations. Saved scales and links stay compatible.

## Hard rules

1. Only root integrator merges, and only DEV under the verified AFK gates. No main merge/deploy/migration.
2. Root alone writes this coordination doc and Linear. Workers return pending-linear-writes.
3. Follow file ownership; request a boundary change rather than edit another lane's scope.
4. No deploys or external service mutations during the batch; no production credentials.
5. Delivery uses claude/login-sync-a2, new commits and ordinary push; main PR1001 stays held.
6. Local tests are smoke evidence; exact pushed head validate and fresh independent review gate progression.
7. On error, reread the goal, make the smallest adjustment, report blockers and continue unblocked scope.
   Never widen the goal. Third failed lane review triggers the global AFK regroup rule.
8. No force-push, amend, no-verify, reset, branch/worktree deletion or changes to unrelated work.

## Ownership

| Role | Branch/worktree | Owns | Never touches |
|---|---|---|---|
| Root integrator | main session; isolated lane tree | plan/coordination, PR bodies, Linear, CI/review gates, dev rebuild | original dirty checkout, production, unrelated work |
| Engine E | claude/login-sync-a2; wt-login-sync-a2 | subplan section6 E row verbatim: sync.js, generated sync region only, sync tests/model, sync mutants, ENGINE-SPEC20, sync test floor | other app JS, schema/auth, client tests |
| Client C (not started) | same branch/tree, after E gates | subplan section6 C row: sync app region, additive app tests, throwOnKeys sandbox option, a2_sync mutants, app floor | engine and its generated region, e2e, i18n/About |
| Fresh reviewer | isolated verified-SHA worktree | read-and-report review, exact-head validate conclusion | fixes, commits, pushes, Linear |

## Sequencing

1. E writes tests and records RED at base6c960269; implements trustedBase, syncs generated region, proves
   five named mutants, updates only owned docs/floor; commits and ordinary-pushes1001.
2. Root verifies actualPRhead=localtip, waits validate success at that SHA, obtains fresh independent
   code review in separate worktree at exactSHA; only PASS/PASS_WITH_NITS unlocks C.
3. C tests-first then implementation/mutants/CI/freshreview at its final head.
4. Root rebuilds1003 from existing7e3b356f, merge updatedH, measure dev-specific floors, DIRECT_READERS,
   check every a2/sync patch and subplan section8 gates; no force-push. Independently reviewDhead.
5. DEV merge only with all gates, then actual served DEV and owner loginRCQA. Main remains held.
   About privacy localization in all8tables is a separate prerequisite before any later main release.

## Briefings

E: execute subplan section6 E acceptance and verify commands without substitutions. Tests first; no browser
jobs or external DBs. Local Node unit tests and inline/validate are permitted. No source change outside E.
C: waiting; do not start until E CI and fresh review pass. Use section5's corrected planner counter/control.

## Status

| Role | Branch | State | Last update UTC |
|---|---|---|---|
| Root | claude/login-sync-a2 | plan correction READY; original clean lane fast-forwarded215ad5a7→6c960269 | 2026-11-09T12:38Z |
| E | claude/login-sync-a2 | queued; base application6c960269 | 2026-11-09T12:38Z |
| C | claude/login-sync-a2 | blocked on E gates | 2026-11-09T12:38Z |

## Handoff queue (append-only)

| # | From | Ask | Status |
|---|---|---|---|
| 1 | Root | Before production release, finish About privacy localization and owner loginQA; prod email after DEV QA | OPEN |

## Environment qualification

This harness supplies independent Codex subagents, not Claude's named Sonnet/Opus agent types.
Installed workflow contracts are applied as read-only instructions; no claim of native Claude slash-command
execution or model-tier parity. No new installs/global setup. Root owns shared browser runtime; E runs none.
