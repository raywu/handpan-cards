# Sync operation-authority continuation — Refs TRI-28

Mode: plan. AFK armed. Do not invoke /reviewed-plan; produce the plan directly.
Stop after a bounded continuation to the existing store-safety plan. No source,
test, backend, credential, configuration or remote changes by the planning lane.

Read CLAUDE.md, ~/.claude/CLAUDE.md, tests/CONTRACT.md, docs/testing/browser.md,
docs/plans/2026-11-09-sync-store-safety-subplan.md and its coordination document.
Inspect the complete client sync region and ENGINE-SPEC section20 at exact
1356ac84bf7fc489c4ff9a64ee342536772341fa. Preserve historical and dirty work.

Evidence baseline: fresh review reproduced a same-user fresh first-sync sidecar
replacement during incremental GET gt10; old cursor10 settlement consumed its
first barrier and omitted unchanged remote R from later pulls. Reset before GET
restored R. The earlier refresh-before-push fix passed its own regression but
did not cover this pull boundary. Existing first-sync/Add N, legitimate deletion,
revision witnesses and durable-store guards are independent requirements.

Investigate every asynchronous sidecar read/write/drop boundary, including token
refresh success/failure, paged and empty GETs, primary/deferred apply completion,
all push responses, audit/status and delayed account-delete completion. Find one
consistent authority rule instead of separate symptom patches. Evaluate a raw
sidecar witness coupled with the existing saved-store token; successful own
conditional writes advance the witness, external changes invalidate old work.
Compare a persisted sign-in identity only to justify the smallest sound choice.
If this baseline is unsound or materially larger, return NOT READY and explain
the owner tradeoff. Do not introduce fields, migrations, engine changes or a
coordination framework. Refresh policy and UI behavior stay unchanged.

Cover liveness using actual existing triggers, including own sequential writes,
other-tab ordinary writes and queued Add N. No periodic retry exists. State the
limits of nontransactional localStorage checks and already-dispatched requests
or store commits; promise neither atomic cancellation nor retrospective rollback.

Produce file-owned, worktree-isolated lanes with prerequisites, interfaces,
test-first handoffs, observable acceptance, existing verify commands, bounded
failure-case matrix, discriminating mutants, stop conditions and recovery.
Preserve existing assertions and measured floors; adapt structural pins only
where the scope interface changes. Use existing fixtures, no new harness.
Eng review is independent; design is unnecessary unless interaction changes.

Keep exact-head full Linux validate and fresh independent review before DEV.
Owner approved one held main-target CI-only PR from the exact rebuilt DEV head;
both main-target PRs stay unmerged. Rebuild the DEV branch from its existing
7e3b356f head using ordinary commits/merges, then verify served DEV and owner QA.
No main merge, deploy, migration, force-push, amend, no-verify or CLAUDE.md edit.
CI timeout is a separate unknown, never a reason to waive checks or add profiling.

Frozen pass/fail rubric: correct cause; complete async-sink coverage; real-trigger
liveness; smallest feasible change; meaningful fixture RED/GREEN and mutants;
honest residuals; precise lane handoffs; exact-head gates; feasible recovery.
No numerical perfection score or native-Claude execution claim. Report unknowns
as prerequisites or decisions. End with pending-linear-writes: [].

Prompt review: fresh independent critic READY, no blocking defects. A separate
fresh writer generated the continuation; another fresh reviewer assesses it.
