# Repository continuity bootstrap

Status: bounded documentation implementation approved by the owner. Independent
engineering and continuity/design reviews cleared the initial plan body SHA256
`bff126771036804f2a9572dcdfd3a44401fd89d30edfcb7e77bd5b8047fee224`
with no material findings. This status receipt does not claim execution readiness
or completed publication/recovery results.

## Authority and immutable baseline

The owner approved repo-local workflow references and a shared DEV ledger, with a
Mac repair plan drafted and independently reviewed in parallel. The same reply
reported current UI/device QA: “Verified. All good.” Device/browser coverage was
not enumerated. This supersedes the earlier research-only restriction for this
bounded batch, not for global setup or Mac repair implementation.

Baseline main: `e314f858acf3b36fd01ebfcc9e7db37fa46857ef`.
Baseline DEV: `e3473d601dd5916afeef834afea12730efbf3795`.
Both trees: `259e1f13126ad4e8e4b2727598333d18d30a05e1`.
Final release evidence: [PR569](https://github.com/raywu/handpan-cards/pull/569#issuecomment-6392985988).

## Deliverables and file ownership

Root is sole integrator and publisher. There are at most four simultaneous native
agents including root. Independent reviewers do not edit author-owned files.

| Lane | Owner and worktree | Owned files / outcome |
|---|---|---|
| Continuity bootstrap | Root; `/private/tmp/handpan-continuity.pcdoqu/repo-continuity`, branch `codex/repo-continuity-20261024` | This plan; `docs/plans/2026-10-24-repo-continuity-coordination.md`; `docs/WORKSTREAMS.md`; `docs/agents/workflows.md`; optional compact `docs/plans/2026-10-24-continuity-backlog.md` for recovered nonsecret queued scope |
| Mac plan | Independent planning agent; `/private/tmp/handpan-continuity.pcdoqu/mac-repair-plan`, branch `codex/mac-repair-plan-20261024` | Only `docs/plans/2026-10-24-mac-browser-repair.md`; no test execution or harness fix |
| Engineering review | Fresh nonauthor agent | Read/report on exact plan, then exact candidate; scope, Git/CI, provenance, recovery and failure cases |
| Continuity/design review | Separate nonauthor agent | Read/report on discoverability, source authority, interruption recovery, owner decisions and honest capability labels |

Mac author and reviewers run in waves within the four-agent limit. Root serializes
Git integration and any host-browser access; this documentation batch needs no
new browser journey. No implementation worker is dispatched before first ledger
publication. Initial creation is a one-integrator bootstrap exception: the ledger
cannot record its own creation in DEV before it exists. Mac's separately authorized
read-only planning may proceed, with local/unpublished status stated explicitly.

## Preservation and discovery boundary

Add ordinary documentation only. Do not modify existing tracked files, including
AGENTS.md, CLAUDE.md, the browser runbook, tests, application, dependencies,
hooks, skill/configuration files or installer manifests. No global writes, installs,
authentication changes, real Claude session launch, main merge or ref cleanup.
Preserve root's untracked documents and all existing dirty/locked worktrees.

The existing AGENTS.md already points to unchanged CLAUDE.md and the shared browser
runbook. Do not duplicate them or treat a Markdown link as automatic import.
New workflow documentation is a reference/capability index, not an activated skill
or a new obligation imposed on Claude. Other agents can consume shared state when
explicitly directed; their existing startup behavior remains unchanged. Record the
remaining automatic-discovery gap. Provide a short explicit DEV-ledger startup
reference for the owner/new sessions until a separately assessed pointer change is
approved. No symlink or fallback discovery experiment is part of this batch.

The prior full DRY research informs the design but is not a portable runtime
dependency. The shipped plan must contain enough public scope and safeguards to
stand alone. Global/dotfiles definitions may be indexed by source location and
pinned inspected revision, without copying private instruction bodies. Missing
sources/tools or unclosed transitive dependencies mean Unverified, not operational.
No native workflow adapter is installed by this batch.

## Publication and self-reference

The canonical locator is `docs/WORKSTREAMS.md` at a freshly resolved remote DEV
commit. A main/feature/worktree copy is a snapshot. Obtain DEV SHA through an
authorized GitHub read or fetch, read the ledger blob at that exact SHA, and report
the source SHA/time. No reset/checkout of another actor's tree is needed. Offline,
unavailable or missing canonical state is explicitly stale/unavailable.

Before adding the ledger, commit this reviewed plan and the initial coordination
record as a retained checkpoint P. Push only the approved lane branch. Ledger
plan/bus references can then use immutable P/path/blob values. Keep that branch
and Git history; do not squash away needed checkpoints or delete refs.

A file cannot embed its own final commit hash. The ledger's publication revision
is therefore the external DEV SHA used to read it. Row checkpoint/head values are
explicit last-observed snapshots, not claims to name the ledger's own commit.
Resolve live PR/branch state when resuming; validate ancestry and changed scope
instead of trusting a cached head. A pending publication row can instruct: if its
PR is merged, verify actual DEV tree/resources and finish reporting; if open,
inspect its exact head/review/CI. Never turn this into authority to merge main.

Records include stream/goal/status, plan and coordination refs, owner/host,
worktree/branch/base, scope/approval provenance, last confirmed action, precise
next action with acceptance, blockers, verification bound to SHA and recovery.
Local paths describe one host, not cross-host availability. Queued work whose
original plan is unpublished is marked a recovery gap with a safe investigation
step; do not manufacture an approved implementation plan.

## Verification and negative cases

1. Independent engineering and continuity/design reviewers clear this exact
   amendment; address every material finding and retain review hashes.
2. Inspect final diff: only allowlisted new documents. Verify existing tree paths
   and Claude/global/dotfiles source fingerprints remain unchanged. Check every
   local link and immutable plan/coordination reference against Git objects.
3. Independently review Mac plan before integrating its separate commit. Publish
   planning findings as such; no repaired/green-Mac claim.
4. Use a retained branch and ordinary PRs: MAIN companion held for CI, DEV delivery
   from the same exact final head. Full `validate` must actually run all required
   jobs, not merely conclude success after plans-only skips. The new ledger/index
   paths are outside the existing plans/prompts skip allowlist; inspect that rule
   rather than changing it. No CI-scope modification or waiver.
5. Resolve and inspect the actual candidate into current DEV. If combined tree
   differs from the tested candidate, validate the actual combined candidate at
   its own head. Address independent final source review before DEV merge.
6. A fresh independent reader, with no conversation/global configuration, resolves
   the canonical ledger, immutable plan/bus, retained refs, approval boundaries,
   actual last action and next step. Use an independent clone plus remote reads;
   host-local paths must not be mistaken for accessible remote worktrees.
7. Negative controls: feature-copy ledger is not canonical; missing plan/ref or
   unpublished checkpoint stops dependent work; unavailable network cannot turn
   cached state current; dirty/locked ownership cannot be stolen on timeout;
   planning-only Mac scope cannot authorize a fix; main permission cannot be
   inherited from the completed release. Test only disposable artifacts, never
   change actual CLAUDE sources, auth or global settings to simulate these cases.
   Report which controls actually ran versus remain design-only.
8. After DEV merge verify actual full tree, all added document HTTP200/body hashes,
   unchanged app/tables/instructions and `noindex`. Reuse prior actual DEV runtime
   evidence only under byte identity; do not invent a new runtime run.

## Stages and stop conditions

A: review this amendment and preserve the baseline; commit retained plan/bus P.
B: implement reference index, canonical ledger and recovered backlog documentation;
   no active instruction edits. Independent Mac plan proceeds separately.
C: independent source/continuity reviews; resolve findings; integrate reviewed Mac
   plan and create paired exact-head PRs. MAIN stays held without new owner consent.
D: full exact-head CI and actual combined-tree proof; merge DEV only after gates.
E: actual DEV document/source verification and independent cold-start/recovery
   probe, then publish a sanitized immutable receipt and outstanding limitations.

Stop the affected step on scope drift, unexpected changes, competing ownership,
unavailable essential reference, failed/partial CI, incorrect canonical selection
or reviewer finding. Continue unrelated authorized planning. No automatic retry
loop, widened permission, relaxed assertion or deletion of failed evidence.

Rollback before merge: retain checkpoint/ref and abandon only own unmerged edits.
After merge: propose a scoped normal DEV revert if needed, preserving decisions
and pointers required for recovery. No force/reset, automatic main rollback or
deletion of other actors' work. New Claude behavior, global adapters or a Mac
harness fix require separately scoped approval/review; this batch does not provide it.
