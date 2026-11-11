# Sync first-pull barrier regroup prompt — Refs TRI-28

Mode: plan. Stop after the subplan; root may resume the authorized fix only after its independent review.
AFK is armed. Do not invoke /reviewed-plan recursively; produce the subplan directly.

Investigate and produce the smallest reviewed subplan for the third review failure of
held sync PR #1001. Do not implement code or tests during this planning task.

Read CLAUDE.md, ~/.claude/CLAUDE.md, tests/CONTRACT.md, docs/testing/browser.md,
docs/plans/2026-11-09-sync-store-safety-subplan.md and
docs/plans/2026-11-09-sync-store-safety-coordination.md first. Existing scope is E then C, original assertions preserved, worktree
isolation, no main merges/deploys/migrations/force-push/amend/no-verify/production
credentials. Nothing has landed on DEV. Linear is integrator-only; report pending writes.

Verified source: #1001 head58cd45f0173c7c7b1ffcb0303508e619e59faf19. Fresh review FAIL
reproduced: save/push a scale, delete it locally without firing the debounce, expire
the token; during refresh replace the sidecar with SAME user, first:true and empty
base. syncPush retained its pre-await sc and emitted deleted:true before any GET.
A bounded control reloading sc/checking first after refresh prevented the push.
This is first-sync data safety, not the separately deferred credential-overwrite nit.

Use these five reference behaviors as the evidence baseline:
1. The failed trace above: refresh -> tombstone push, with no replacement-session pull.
2. The existing app first-sync test requires GET before push.
3. The engine held-delete control preserves intentional deletion after a valid sync.
4. firstSyncAudit holds unmatched local scales until the existing Add N choice.
5. Current syncToken/syncPatch source can refresh a same-user replacement while
   preserving first:true; user/store token equality does not prove old sc is current.
Verify these against symbols at the exact source; qualify any inaccessible evidence.

Challenge stale sidecar use across this await and any proposed correction. Compare
refreshing current state plus honoring first with a forced pull on every push and
with a new session nonce. Prefer the smallest sufficient existing-state correction;
no new auth/session framework, schema, persisted field, backend change or benchmark.
Do not broaden into unrelated authentication or UI nits.

Output a bounded cause analysis and subplan with file ownership, TDD, exact verify
commands, named mutant proofs, full final-head CI/fresh review, rollback and pickup.
The expected minimal direction is reload the current sidecar AFTER syncToken's
await and recheck its first state BEFORE planning. Validate, do not blindly copy it.

Proof must distinguish both stale-snapshot and first-barrier failures: retain the
previously synced/deleted remote scale AND an unmatched live local scale, so merely
reloading an empty base cannot mask a missing first guard. Use existing fixture
hooks and a real durable store; no real Supabase requests. Include a normal fresh
pull/first-audit control and retain legitimate post-sync deletion behavior. Preserve
all existing assertions and negative-mode cases. Complete the SAME replacement-session fixture
through GET, the existing first-audit/Add N choice, and the permitted unmatched-local push;
verify the previously synced remote scale is retained. Separate ordinary-sync tests alone do
not establish that the replacement session can recover. This is fixture behavior, not a claim
of native/served browser validation. Generate independent named removal
mutants for each meaningful new condition, with all other guards intact.

Freeze readiness criteria before generation: correct cause; no old-base tombstone;
no unmatched push before the replacement pull/choice; replacement fixture completes GET -> existing first-audit choice -> permitted push; ordinary sync/delete preserved;
minimal ownership and runtime change; observable RED/GREEN and discriminating mutants;
no new infrastructure; current exact-head CI and independent review; practical DEV
continuation with the approved same-D-head CI vehicle; honest residual limitations.
Use evidence-qualified pass/fail, not a perfect numerical score.

A fresh engineering reviewer must review the generated subplan before any fix lane
resumes. A fresh critic reviews this prompt first. On material product ambiguity,
interview the owner with a recommendation; routine reversible implementation choices
remain covered by AFK. No new product choice is currently identified. Preserve the
existing acknowledged in-flight transaction and below-cursor recovery qualifications.


Explicit continuation prerequisite: retain the owner-approved ONE held main-target CI-only PR
from the exact rebuilt DEV branch/head, full validate at that D SHA and fresh D-head review;
never merge either main-target PR. Preserve the acknowledged already-dispatched transaction
qualification and below-cursor recovery exclusion without claiming those are newly tested.

Prompt critique disposition: both bounded findings fixed (same-fixture recovery proof and
explicit plan/runbook/prerequisite paths). The rest of the prompt scope is unchanged.
