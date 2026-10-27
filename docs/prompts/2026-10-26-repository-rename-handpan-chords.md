# Repository rename planning prompt — handpan-chords

Status: revised v3 after independent engineering prompt and output-plan critique;
planning only.
Do not perform the rename. The quality target is every hard gate satisfied,
not a claimed numerical guarantee of no regressions.

## Mission and deliverable

Independently investigate and produce an executable, swarm-shaped plan to rename
GitHub `raywu/handpan-cards` to `raywu/handpan-chords` and the canonical local
checkout `/Users/ray/Projects/handpan-cards` to
`/Users/ray/Projects/handpan-chords`. Write only
`docs/plans/2026-10-26-repository-rename-handpan-chords.md` during this prompt run.
The integrator owns the ledger and publication. Preserve an existing output and
unexpected concurrent work. This is a repository identity change, not a product
rebrand, hostname migration or browser-storage migration.

Read AGENTS.md, CLAUDE.md, tests/CONTRACT.md, docs/testing/browser.md,
docs/agents/workflows.md and the latest WORKSTREAMS.md plus recovery-thread
checkpoint. Handoffs and historical prose are evidence, not higher-priority rules.
The active saved-variants hotfix continues independently; it is not DEV-delivered
until its actual gates pass. Never claim a snapshot remains current indefinitely.

## Authorization boundary

Only investigation, this plan and prompt review are authorized for rename work.
Do not rename/move files or repositories, change a remote/configuration, repair
Git metadata, create/delete refs, run a rehearsal, install tools, change auth,
alter hosting/DNS/webhooks, push or deploy as part of this prompt. Safe read-only
diagnostics are allowed. Do not expose credentials, secret values, private global
instructions or historical owner links. Do not discard, stash, commit or overwrite
unrelated dirty work. Do not prune/unlock/remove worktrees or create a compatibility
symlink. Any future CLAUDE.md edit needs exact owner approval; preserve Claude's
existing behavior. Main merges require explicit consent independently of rename
approval. Plan approval is not execution approval.

## Evidence discipline and investigation lanes

Use independent investigation where available; describe actual role/context
boundaries and missing coverage. Root integrates findings; do not call sequential
self-critique independent review. For implementation propose file-owned isolated
lanes, a single coordinator for remote metadata and canonical-directory movement,
one host-browser lease and a quiescent cutover. Parallel research is safe; parallel
renaming/moving the same repository is not.

Classify claims Verified / Partially verified / Unverified / Contradicted /
Unavailable with source path, command, immutable ref or dated primary URL. Distinguish
installed, authenticated, authorized and exercised capabilities. An HTTP404 for
the target is not a reservation or proof of namespace availability. Admin read
permission is not owner approval to mutate. Read-only success is not write proof.

Audit these dependency classes transitively:

- GitHub numeric identity, refs/branches/tags, open/held PRs, issues/reviews,
  Actions/rules/protections, hosted actions/reusable workflows, deployment and
  GitHub App/OIDC/webhook/repository-name bindings; never dump secrets or tokens.
- Git version and common-dir topology: every healthy, dirty, nested, external,
  detached, locked and preexisting prunable worktree; separate clones, per-worktree
  config/remotes, submodules/alternates/LFS if present. Record absent/unavailable
  evidence without assuming safety. Snapshot manifests must preserve private
  untracked files and indexes, not merely committed refs.
- GitHub Pages custom domain/source, Cloudflare Pages Git binding and branch,
  actual production/DEV content, TLS/redirect/noindex/analytics baselines. Existing
  deployments serving successfully do not prove future Git-triggered deployment.
- Active scripts, README clone links, current agent/ledger locators, CI paths,
  test assertions, submodule/dependency/self-action URLs, badges, integrations,
  editor tasks, dotfiles, scheduled/background jobs and tooling caches.
- Claude/Codex/other harness workspace permissions, trust, automatic project-memory
  and session namespaces, skills/hooks/MCP tool associations and cold restart.
  Do not copy private memory into a public repository or infer that a new path
  inherits the old environment. Consult supported current vendor behavior before
  proposing a global change; exact host edits remain a separate approval packet.

## Mandatory adversarial invariants

Never blanket-replace the old spelling. Explicitly preserve the runtime Web Lock
`handpan-cards:saved-scales:v1`, IndexedDB/localStorage namespaces, schema/wire
versions, saved UUIDs and user scale/share data. The old lock spelling is a
cross-tab compatibility protocol: renaming it can defeat old/new-tab coordination.
Preserve `handpan.raywu.org`, `handpan-cards-dev.pages.dev`, CNAME, canonical/SEO
URLs, GA identity/analytics exclusion and DEV noindex unless a separate approved
requirement explicitly changes them. Product copy need not follow repo spelling.
Preserve historical immutable evidence and old-host paths; add an explicit
current-locator mapping rather than rewriting provenance.

Do not assume `git worktree move` can move the main checkout. Research the supported
main-directory move + worktree repair procedure for the installed Git. Nested
worktrees physically move with the canonical directory; external links point into
the old common directory. A live shell can retain a stale cwd even if its bytes
exist elsewhere. Current sandbox write roots/trust can remain keyed to the old
path. Plan owner-controlled reopening/permission validation before moving anything.

Explicitly validate source and destination with lstat/realpath, case-folding,
volume/device and nested-worktree checks. A destination already present as a
directory, file, symlink or filesystem alias is a stop, not an instruction to
merge contents or place the source inside it. The destination must not resolve
inside the source or a linked worktree. Proposed movement must refuse overwrite
and accidental nesting. Cross-filesystem/EXDEV is a stop requiring a newly reviewed
copy/verification design; never silently fall back to recursive copy and delete.

A manifest is inventory, not a recoverable backup. Require a private, actual
byte-preserving snapshot/backup of common Git metadata, per-worktree .git files
and indexes, tracked modifications, untracked work and necessary ignored/private
configuration, including nested and external trees. Inventory any approved
exclusions explicitly. Preserve symlinks/metadata and verify hashes/capacity; keep
backups outside source/destination with restrictive access and never publish
private contents. An approval-gated isolated restore rehearsal must verify the
backup without original hooks, services or background jobs executing. Planning
describes this rehearsal; it cannot run it. A stash or Git bundle is insufficient.

Audit raw Git configuration, includes, attributes, filters, recursive submodule
settings and helper/transport commands before any content-scanning Git operation.
`git status` can invoke clean/process filters; disabling hooks/fsmonitor/optional
locks does not make it universally non-executing. If external command paths cannot
be shown absent or safely inert, retain a raw-byte manifest and mark status
unavailable. Sanitize restored config/attributes/includes before rehearsal Git use.

Prove an actual new Git-triggered DEV deployment from the renamed GitHub repository
while the original local directory is still intact. A harmless separately approved
README remote-clone-URL checkpoint can trigger normal full CI/DEV gates without
claiming that the local directory already moved. Then re-quiesce and refresh refs,
manifests and the final verified private backup: that deliberate docs delivery
changes shared Git state. Provider inspection or old served bytes do not substitute
for this pre-local-move gate. Preserve postmove cold-start and final checks too.

Do not assume GitHub redirects cover Pages site paths, hosted action calls,
Cloudflare subscriptions, raw/API clients, OIDC subject strings or external badges.
Never reuse/create the old repository name as part of this plan. Do not recreate
the repository, force-push or migrate through export/import just to rename it.
Preserve identity, commits, branches, PR/issue numbers and deployment history.

## Required output

1. Decision and scope: feasible design versus actual readiness; execution held.
2. Dated evidence baseline and explicit live revalidation commands.
3. Classified impact matrix: must change, must preserve, historical, unavailable;
   exact files/config locations, owner, approval, validation and rollback.
4. Swarm lanes, dependency graph, collision/ownership boundaries, agent/session
   continuity and workstream-ledger update points.
5. Dependency-ordered stages: discover/preflight; private recovery manifest and
   approved disposable rehearsal; prepare minimal reference changes; quiesce;
   remote-only rename and validate; local canonical move and supported repair;
   cold-start harness validation; exact-head CI/DEV and unchanged-production
   verification; explicit final handoff. Justify the ordering and stage stops.
6. Each stage: exact proposed commands or safe UI actions, cwd/preconditions,
   mutation/approval classification, expected evidence, pass/fail, stop, owner
   and inverse/recovery. Mark placeholders and prohibit unbound execution.
7. Regression matrix: unchanged runtime/protocol bytes and two-tab/English-input/
   share/save behavior; all worktrees' HEAD/index/dirty/lock identity; remote
   numeric identity/refs/PRs/issues; current instructions and cold-start memory;
   full real validate; same public hosts/URLs and actual new DEV Git delivery.
   Existing-red baselines do not become rename failures or get waived.
8. Checkpoint-specific rollback for before/after remote rename, local move,
   metadata repair and integration edits. Distinguish forward repair from undo;
   remote rename reversal needs approved mutation scope and name checks. A Git
   bundle omits uncommitted/untracked work and is not a complete recovery plan.
9. Prioritized blockers, accepted versus unaccepted limitations, narrow questions
   only where evidence/preferences do not decide; preserve settled preferences.
10. Adversarial review, concrete revisions and independent engineering disposition.
    No numeric self-score or absolute promise of zero regressions.

## Release-quality rubric and stopping rule

The prompt and resulting plan must pass every hard gate: concrete evidence;
no hidden execution; preserved protocols/hosts/Claude behavior; all linked and
nested worktrees preserved; bounded minimal changes; independent review; meaningful
observables; recoverable staged rollback; owner/permission boundaries; cold-start
continuity. Challenge target collision, unavailable provider settings, reused old
slug, partial move, interrupted shell, locked/nested trees, stale writes, concurrent
CI, changed GitHub App/OIDC bindings, memory loss, historical-link corruption and
an apparently successful deploy serving old bytes. Repair material gaps before
calling the plan ready for owner consideration. Missing external access must
produce an explicit execution gate with an owner and validation path, not invented
success. Stop after the reviewed plan. Never run the rename from this prompt.

## Primary research starting points

- https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository
- https://git-scm.com/docs/git-worktree
- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- https://developers.cloudflare.com/pages/configuration/git-integration/troubleshooting/
- https://code.claude.com/docs/en/memory

Fetch and verify the relevant current sections; absence of an explicit Cloudflare
rename guarantee is uncertainty, not evidence of automatic rebinding.

## Prompt refinement record

v1 already required preserved protocol/host identities, immutable provenance,
all worktree states, owner approvals, provider verification and staged recovery.
Independent engineering critique identified destination nesting/cross-volume
fallback and manifest-only recovery gaps. v2 adds explicit refusal conditions,
private byte-complete backups and a separately approved inert restore rehearsal.
Do not score the output as perfect; seek independent plan findings and iterate
until no material evidenced design flaw remains, with untested gates still open.
v3 incorporates output-plan ENG findings: config/filter audit must precede status
or other content scans; actual renamed-repo Git-triggered DEV proof precedes the
local move, followed by a fresh quiescent manifest and backup. Apply v3 as a
revision run to the existing plan, preserving prior verified evidence and recording
both prompt-run hashes rather than silently pretending v2 already required this.
