# Repository rename plan — handpan-chords

Status: **Conditional Proceed for design; NOT READY for execution.** Rename execution,
rehearsal, host configuration and main release are held. This document changes no
repository identity. A feasible staged design exists; provider bindings, recoverable
backups, a quiet maintenance window and fresh-session permissions are unresolved gates.

## Run record and authority

Planning run: 2026-10-26, independent repository-investigation agent, integrating
its read-only host/source findings with root's separately collected GitHub evidence.
Initial input: [planning prompt](../prompts/2026-10-26-repository-rename-handpan-chords.md), v2
SHA256 `9fef5389d36b3c00ae16dd6d2c4b67e0188c20bb38a18d6b1128d87105a97336`.
The prompt's independent engineering critique identified destination/cross-volume
and manifest-only recovery gaps; v2 incorporated both before this run. This plan
is the requested output, not evidence of executing its commands. Revision run v3
uses that same prompt path at SHA256
`1bb8ea534a6e5cad3efc9097f74a44ca622014a7c6c3863af4e638e0a892d656`.
Independent ENG reviewed initial plan SHA256
`3c91a93ca073085d1740cab522d8771327faafafcbc9bf45d71f3d21d390c3fd`
and found two P1 design gaps: content-scanning Git can execute configured filters,
and real renamed-repository Git-triggered DEV proof must precede the local move.
This revision adds audit-first intake, inert restored configuration, stage4a delivery
and stage4b re-quiescence/fresh backup. It preserves the v2 investigation record;
it does not retroactively claim these controls were present in that revision.
Root owns final
independent ENG review, the authoritative ledger and publication. Plan-author
adversarial checking below is not independent plan review; the separate review is
completed with clearance in the closure record below.

Read project AGENTS, CLAUDE requirements, tests/CONTRACT, browser runbook, workflow
index and local WORKSTREAMS snapshot. Local ledger is ahead of canonical DEV
publication, as its opening states. Root reports current recovery-thread status;
this agent did not independently reread the live thread. Fresh remote DEV and
reporting-thread reconciliation is mandatory at implementation intake.

Only GitHub `raywu/handpan-cards` → `raywu/handpan-chords` and canonical local
`/Users/ray/Projects/handpan-cards` → `/Users/ray/Projects/handpan-chords` are in scope.
Preserve product copy, Claude behavior, public URLs, browser data/protocols and
all existing work. No CLAUDE edit is proposed. Any later exact CLAUDE patch needs
owner approval; main consent is separate from rename consent. No rename execution,
rehearsal, global edit, auth change, installation or hosting mutation is authorized
by this planning request. Do not reuse the old GitHub slug, force-push, recreate the
repository, prune/unlock trees, stash another lane, or install a compatibility symlink.

## Dated evidence and limits

| Class | Observation on 2026-10-26 | Evidence / limit |
|---|---|---|
| Verified local | Git `2.50.1 (Apple Git-155)`; integration HEAD `2ca0a3bfbfa36ae551badfdf39fab8172cefbd06`, branch `codex/saved-scale-variants-20261025` | `git --version`, `git rev-parse HEAD`, `git worktree list --porcelain` |
| Verified local | 153 registered worktrees; 7 physically nested under canonical `.claude/worktrees`; 2 locked; 1 already prunable | Initial and subsequent read-only enumeration agreed; re-enumerate, never assume fixed counts |
| Verified local | Canonical `main` HEAD `3caf5e28fa4f965d81d90a4f80d53b15f82f39fc`; existing untracked docs/context | `git status --short`, worktree enumeration; no `.git/index.lock` observed, not proof of no active process |
| Verified local | Origin SSH old slug, shared `.git` rooted in canonical directory | Canonical `.git/config:9`; integration `.git:1` points absolutely to old `.git/worktrees/integration4`; `commondir` is `../..` |
| Verified local | Nested admin backlink names old absolute nested path | `.git/worktrees/agent-a82891d1f6da3e869/gitdir`; do not modify its lock |
| Verified source | Runtime Web Lock uses old spelling intentionally | `git show 2ca0a3bf:index.html`, line10001; `tests/app.test.js:9752,9770,15443`, `tests/e2e.test.js:17944`, probe line47 |
| Verified by root's separate GET | Repository numeric ID `1344572975`, default `main`, admin permission true | Private host receipt `evidence/rename-readonly-github-baseline.json`, checked `2026-10-26T11:54:47.214497+00:00`; this file is outside Git, no secret values copied |
| Verified by same root GET | Pages legacy build, `main:/`, CNAME `handpan.raywu.org`, status built; API `html_url` HTTP and `https_enforced:false` | Preserve this existing settings baseline; do not silently harden HTTPS or infer HTTPS failure from this field |
| Partially verified | Target GET returned404 | Not proof of available/reserved name or write success; rename UI/server is final authority |
| Unverified live | Cloudflare project/repository ID binding, app installation access, build settings and branch | Existing docs describe `dev` and stable DEV hostname; provider dashboard/API must confirm before cutover |
| Partially verified | Installed project config and historical memory paths use old path/slug | Codex config line27; Claude project config/mapping lines2376,2576–2577; bounded matched-line reads only |
| Verified bounded dotfiles discovery | Known `/Users/ray/Projects/dotfiles` at `4b5fadc3ec688bdc1fdaae97bfcc5b9ca736706a` has tracked `codex/config.toml:27` keyed to old canonical path; that file is already dirty | `git grep -l/-n -F` restricted to tracked old-slug/path matches; preserve existing owned changes; no deployment or symlink relationship established |
| Unverified | Other clones, scheduled jobs, editor tasks, OIDC consumers, webhook consumers, private plugin associations, LFS/alternates, provider integration continuity | Bounded source scan is not exhaustive external discovery |
| Verified absence within narrow read | No tracked `.gitmodules`/`.lfsconfig`; no returned `extensions.worktreeConfig`, `core.worktree`, `core.hooksPath` value | Does not prove no Git config includes, per-worktree settings, object alternates, LFS filters or external hooks |

Saved variants remains separately active and DEV-unmerged in this snapshot. Its
native test/fault refresh owns dirty tests/docs and temporary fault applications;
sourceab90 is frozen, and transient proof-campaign bytes are not new feature work.
Use immutable source2ca0 for this investigation, not an uncoordinated live-index
read. The rename must not pause that campaign now. At future cutover, all streams
must acknowledge a separately scheduled quiet window and provide fresh manifests.

## Supported behavior researched

Fetched 2026-10-26: GitHub redirects Git/web access after rename, recommends updating
remotes and a custom Pages domain; project-site URLs and hosted action calls have
exceptions. Reusing the old slug defeats redirects. Preserve the existing custom
domain and audit consumers rather than treating redirects as provider rebinding.
[GitHub rename documentation](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).

Git cannot move its main checkout with `worktree move`. Its supported recovery is
manual main-directory movement followed by `worktree repair`; when linked trees
also moved, supply their new paths to repair connections in both directions.
Installed `MANPAGER=cat git help worktree` independently confirms this behavior
for Git2.50.1; `git worktree repair -h` confirms the command exists. No repair ran.
[Git worktree documentation](https://git-scm.com/docs/git-worktree).

Git attributes can select external clean/process filters. Gitv2.50.1's index-refresh
comparison calls `index_fd`, so treating status as universally inert is unsafe.
Hooks/fsmonitor/optional-lock suppression alone does not cover filters, recursive
submodule status or helper transports. Raw config/attribute/include audit must come
first; unavailable safe status is preferable to invoking unknown commands.
[Git attributes](https://git-scm.com/docs/gitattributes),
[Gitv2.50.1 index refresh](https://github.com/git/git/blob/v2.50.1/read-cache.c),
[Gitv2.50.1 object handling](https://github.com/git/git/blob/v2.50.1/object-file.c).

Cloudflare uses a GitHub App with repository access controls; existing deployments
can keep serving even after app access is removed. Consequently serving old bytes
does not prove new builds work. Its integration page supplies no explicit repository
rename guarantee in the fetched sections. Inspect the actual binding and verify a
new normal Git-triggered DEV deployment.
[GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/),
[Git integration overview](https://developers.cloudflare.com/pages/configuration/git-integration/).
Provider troubleshooting identifies disconnected/inaccessible repositories and
installation problems. Those are diagnostic leads, not authorization to uninstall
the shared app or delete a Pages project.
[Cloudflare troubleshooting](https://developers.cloudflare.com/pages/configuration/git-integration/troubleshooting/).

Current Claude docs describe repository-derived, machine-local auto memory shared
across worktrees and document optional explicit memory-directory settings. They do
not prove which namespace this installed host will use after the move. Record the
installed version and compare `/memory` before/after in owner-controlled sessions;
do not rewrite project JSON or private memory based only on a slug guess.
[Claude memory storage](https://code.claude.com/docs/en/memory#storage-location).

The installed macOS `rename(2)` manual documents `renameatx_np` with `RENAME_EXCL`
as a no-replacement operation and EXDEV/unsupported errors as failures. A reviewed
small native helper using that API is proposed below; ordinary `mv` may copy across
volumes, and ordinary `rename` can replace a destination. Neither is an acceptable
fallback. Rehearsal must demonstrate the installed filesystem's actual semantics.

## Impact and ownership matrix

| Disposition / location | Owner and approval | Verification / recovery |
|---|---|---|
| Must change: GitHub repository name, preserving numeric identity | Sole cutover coordinator; separate execution grant | Same numeric ID, refs and issue/PR identity; remote reversal separately gated |
| Must change: shared origin URL, plus independently discovered clones/overrides | Coordinator; scoped Git config approval | Effective fetch/push URLs per worktree; restore exact old config bytes only while quiescent |
| Must change: canonical directory and necessary Git backlinks | Coordinator; local move/repair grant | Every healthy worktree matches manifest; inverse move/repair or isolated recovery |
| Must change after cutover: README.md:39 clone URL; docs/agents/workflows.md:26 current bootstrap; current locator/mapping in docs/WORKSTREAMS.md | Docs lane owns first two only; root owns ledger | Reviewed scoped diff; normal reviewed revert |
| Must preserve: index.html, src, data, runtime tests/probes and generated artifacts | Existing feature lanes retain ownership | Runtime hashes identical to authorized cutover baseline; rename adds no runtime patch |
| Must preserve: `handpan-cards:saved-scales:v1`, IndexedDB/localStorage names, UUIDs, schemas, wire versions, user data | Existing storage lane | Old/new tabs share lock; no migration/reset logic; byte comparison first |
| Must preserve: CNAME, metadata/JSON-LD/SEO URLs, robots.txt, sitemap.xml, GA identity, `.pages.dev` analytics exclusion and `_headers` noindex | Hosting owner | Same production/DEV URLs, headers, analytics behavior and resources |
| Must preserve: CLAUDE.md and existing harness startup behavior | Owner | File hash unchanged; cold-start context comparison; no new loader requirement |
| Historical: immutable GitHub links, old-host paths, TODOS.md:9 and SCALE_ENGINE_PLAN.md:663–664,809–815 gstack receipts | No blanket replacement | Retain provenance; current mapping explains old→new identities |
| Host-specific candidate changes: `~/.codex/config.toml:27`, `~/.claude.json` old project/mapping, session workspace permissions | Owner-controlled host lane; exact config packet separately approved | Backup private config; native reopen and trust/context checks; inverse patch only if no intervening edits |
| External dotfiles candidate: `/Users/ray/Projects/dotfiles/codex/config.toml:27`, currently dirty | Dotfiles owner; exact external-repository patch separately approved | Prefer owner’s established dotfiles workflow if appropriate; establish installed-file relationship first, preserve dirty changes, no install or global sync |
| Historical private Claude memory/transcripts and gstack cache namespaces | Owner, no move currently proposed | Preserve originals; supported explicit mapping only after installed-version assessment and exact approval |
| Unavailable: CF binding, app/OIDC/webhook consumers, scheduled jobs, external badges/actions | Provider/tool owners | Read inventory and exact approved repair packet; unknown material consumer blocks cutover |

No repository `package.json` or tracked Cloudflare deployment config was found in
the bounded scan. Current validate workflow triggers on `main` push/PR, not a
hardcoded repo slug. No name-only workflow edit is justified. A README identity
change does not authorize applying its fork-domain instructions at line48.

## Proposed lanes and dependency graph

Research may run in parallel; mutation is serialized. File ownership is explicit:

| Lane | Owned work | Collision boundary |
|---|---|---|
| C — coordinator/root | Freeze, private manifests, GitHub rename, canonical move/repair, origin, ledger, cutover receipt | Single writer for all shared Git/remote state; does not claim other lanes' dirty files |
| D — documentation | README.md and docs/agents/workflows.md only, isolated authorized worktree | No historical bulk edits, no ledger or CLAUDE edit |
| H — host continuity | Read-only session/plugin/job/config inventory; exact private patch proposal | Owner applies/reviews host settings; no copied memory in public Git |
| P — provider | Read-only Pages/Cloudflare/app/deployment inventory; proposed bounded repairs | No app uninstall, project recreation, DNS change or secret export |
| V — independent verifier | Read-only exact-head review, manifest comparison, serialized browser checks | Cannot repair evidence while scoring it; one browser lease held by C |

Dependency graph: audit-first live intake → complete dependency inventory → approved
recovery packet/rehearsal → split minimal docs candidates → explicit maintenance
consent → first quiescence/remote-cutover backup → remote-only cutover/verify →
README-only checkpoint/fullCI/new Git-triggered DEV delivery with OLD intact →
second quiescence/re-export/fresh verified local-move backup → local move/repair →
cold start → remaining locator integration/fullCI/final DEV checks → final independent
receipt. Actual new Git-triggered delivery precedes movement of the common directory.
Record assignment, interruption, backup/rehearsal outcome, each external mutation,
each head/PR change, cold-start status and final delivery in root's ledger/reporting
thread. Private manifests stay private; publish only hashes, counts, timestamps,
nonsecret results and approved locator mappings.

## Command conventions and stage contracts

Everything below is **proposed**, never a current command to execute. Bind every
placeholder in an owner-reviewed execution packet; no unbound `<...>` commands.
`OLD=/Users/ray/Projects/handpan-cards`, `NEW=/Users/ray/Projects/handpan-chords`.
`SAFE` means an approved existing directory outside both trees; `BACKUP` means a
new private destination outside them, on storage with demonstrated spare capacity.
All evidence directories use restrictive access, contain no public upload path and
are outside Git. Do not repurpose HOME or other system variables. Use argv arrays
and NUL-delimited path records for arbitrary filenames, never newline shell loops.

### 0. Intake and live preflight — read-only, C with H/P

**Audit first, before invoking repository-content-scanning Git.** A raw filesystem
collector must read source `.git` files, common/per-worktree config and all applicable
system/user/XDG configs, environment overrides, conditional/unconditional includes,
attributes (`.gitattributes` at every applicable level, info/global/system attributes)
and `.gitmodules` without executing Git or sourced shell code. Follow approved
include paths as data; inaccessible/cyclic/unknown sources remain a blocker. Record
filters/clean/process/smudge, textconv/external diff/merge drivers, fsmonitor, hooks,
submodule recursion, credentials/SSH/proxy/helper transports and include conditions.
Do not display secret values. Inherited environment and Git wrappers must be audited
too. Do not infer no filters from the absence of tracked `.lfsconfig` alone.

Only after the audit establishes that every external-command path reachable by a
proposed operation is absent or safely inert may C use that operation. Preserve raw
config/attributes unchanged in originals: no safety-motivated live config rewrite.
An unproven status path means raw file/index/ref manifest only, with status explicitly
unavailable; do not execute status to discover whether it is safe. A content-scanning
operation includes status, worktree diff, hashing through Git conversion, grep with
textconv, checkout/add and recursive submodule checks. The same command gate applies
to the dotfiles checkout and every separate clone/submodule. Metadata commands below
are proposals gated on applicable config/transport audit, not an exemption.

From the existing authorized integration checkout, resolve live remote DEV:

```sh
gh api repos/raywu/handpan-cards/commits/dev --jq .sha
gh api 'repos/raywu/handpan-cards/contents/docs/WORKSTREAMS.md?ref=<DEV_SHA>'
gh pr view 571 --repo raywu/handpan-cards --json headRefOid,state,comments
git --version
git -C /Users/ray/Projects/handpan-cards worktree list --porcelain -z
git -C /Users/ray/Projects/handpan-cards for-each-ref --format='%(refname) %(objectname)'
```

Decode the ledger at the exact returned SHA locally without executing its contents;
record freshness, thread checkpoint and all active owners. Enumerate worktree paths
from porcelain NUL records. At each existing path run `git -c core.fsmonitor=false
-c core.hooksPath=/dev/null -C <PATH> rev-parse HEAD --git-dir --git-common-dir`,
`git ... symbolic-ref -q HEAD`, then **only if the audit permits status** use
`git --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null
-c submodule.recurse=false -c diff.ignoreSubmodules=all -C <PATH> status
--porcelain=v2 -z --untracked-files=all --ignore-submodules=all`.
These flags supplement the prior filter/config audit, not replace it. If a filter
cannot be proven absent/inert, skip status and retain raw-byte evidence. Nonzero
symbolic-ref for detached trees is expected. Keep
raw index file, lock reasons, gitfile, `commondir`, config and back-pointer bytes.
Record unavailable
paths separately; no pruning or assumption they are empty. Inventory ignored data,
symlinks, ACLs/xattrs, submodules, config includes, alternates, filters/LFS, hooks and
all effective remotes (including per-worktree overrides); do not execute hooks,
filters, helpers or print credential-bearing URLs. `git ls-remote` below requires
the audited approved SSH/transport/credential path, rather than unknown custom
remote helper execution. A reviewed collector must sanitize only
public summaries and keep full private state private.

Search approved host locations for other clones, editor tasks, scheduled/background
jobs, old absolute paths, skill/hooks/MCP/plugin associations and name-bound cloud
consumers. For the owner's existing dotfiles workflow, begin only at the known
`/Users/ray/Projects/dotfiles` checkout (or an explicitly supplied alternative),
record its HEAD and dirty ownership, and use `git -C <DOTFILES> grep -l -F
-e handpan-cards -e /Users/ray/Projects/handpan-cards` over tracked config references.
Inspect only relevant nonsecret matched lines. An unavailable known checkout is
unavailable evidence, not a reason to scan all HOME. Establish whether installed
settings are linked/copied/generated before proposing one source-of-truth patch;
external repo changes need separate exact approval, no installer or blanket sync.
Do not scan arbitrary private directories without scope. Read provider
settings via existing authenticated tools or owner dashboard; do not install/auth.

```sh
gh api repos/raywu/handpan-cards --jq '{id,full_name,default_branch,permissions}'
gh api repos/raywu/handpan-cards/pages --jq '{cname,source,build_type,https_enforced,status}'
gh api repos/raywu/handpan-chords --jq '{id,full_name}'
gh api --paginate repos/raywu/handpan-cards/branches
gh api --paginate repos/raywu/handpan-cards/tags
gh pr list --repo raywu/handpan-cards --state all --limit <AUDITED_LIMIT> --json number,state,headRefOid,baseRefName,url
gh api repos/raywu/handpan-cards/actions/permissions
gh api repos/raywu/handpan-cards/rulesets
gh api repos/raywu/handpan-cards/branches/main/protection
git ls-remote --heads --tags git@github.com:raywu/handpan-cards.git
```

Use paginated API export for exhaustive PR/issues/reviews/deployments/settings;
`--limit` output alone is not full coverage. Inventory webhook metadata, app access,
environments, hosted/reusable workflow consumers, badges and OIDC subject/repo-name
rules with their owners; never export secret values. Record access-denied results
and stop unresolved material dependencies. CF dashboard: existing Pages project →
Settings/Builds/Git repository; record project ID, repository identity, `dev` branch,
build/root/output/watch settings and GitHub installation selection. No changes.
Baseline production/DEV response headers, redirects, resource hashes and actually
served revisions against expected source, including any existing approved delivery
transformation. Existing TLS/HTTPS-enforcement settings are baseline, not a repair
opportunity. Pass: complete owned inventory with every unknown risk assigned and
material unknown closed. Stop: ownership conflict, inaccessible material binding,
target collision, unaccounted active writer. Recovery: none; read-only.

### 1. Destination and recovery design — read-only then separately approved private backup/rehearsal

C/H must inspect with `os.lstat`, `os.path.realpath`, `os.stat`, `os.path.lexists`
and directory enumeration using argv-safe Python, not an interpolated shell path.
Require source to be the expected real directory/inode with `.git` directory;
reject source/parent symlinks or filesystem aliases. Require destination absent
under lstat including dangling symlinks; check canonical parents, Unicode/case-fold
collisions, volume device IDs, source/destination containment and every linked-tree
mapping. Both parents must be the same approved real Projects directory. Destination
inside source/any linked tree, existing entry of any kind, unexpected mount/device,
changed source identity or inability to establish alias safety is STOP. Repeat these
checks immediately before the actual move; discovery-time absence is insufficient.

A manifest is not a backup. Propose a private complete byte copy of the canonical
tree including `.git`, its nested trees, every existing external linked tree and
necessary external object/config dependencies. Capture raw indexes, tracked dirty
bytes, untracked/ignored/private files, modes/symlinks/ACLs/xattrs and lock metadata.
Snapshot symlink entries without following them; inventory needed external targets
separately. No default ignored-file exclusion. List any proposed exclusion and its
owner-approved recovery consequence; incomplete required coverage blocks cutover.
Missing/prunable trees retain admin records and missing-state receipt; their missing
bytes cannot be backed up or claimed recoverable. Preserve independent clones too
if their config will change. Stash, patch, bundle and refs alone are insufficient.

Before creating backups: approve location/access/encryption policy and retention;
calculate allocated and logical sizes, file counts and metadata needs for every
unique physical source without double-counting nested copies. `df -k <BACKUP_PARENT>`
and `du -sk <SOURCE>` inform capacity; sparse/clone/compressed/logical sizes require
an actual full-size estimate and conservative headroom. Budget backup plus separate
restore plus verification overhead; insufficient capacity stops, never excludes
private work silently. A proposed macOS copy command for each manifest mapping is
`/usr/bin/ditto --rsrc --extattr --acl <SOURCE> <NEW_PRIVATE_BACKUP_ENTRY>` after
`umask 077` and exclusive private directory creation. Confirm installed options
and behavior in rehearsal; destination must not exist and be outside both repo
paths. Directory mode0700 and restrictive storage ACLs are required. Compare every
file hash, symlink target, metadata record and index hash; keep a signed-off coverage
report. Failure leaves originals intact and cutover held.

**Rehearsal needs separate approval and does not run during planning.** Restore to
an isolated private namespace with no hooks, jobs, watchers, editors, credential
helpers, filter processes or network. Original gitfiles contain absolute paths;
never invoke Git there before every restored pointer/alternate/config dependency is
audited and mapped entirely inside the disposable namespace. A reviewed mapping
tool must reject any write target outside it. First preserve an untouched raw restore
for byte verification; perform Git checks only in a second disposable copy after
sanitizing config/includes, attributes, filters, hooks, fsmonitor, submodule recursion,
credential/SSH/transport helpers, environment and external object dependencies.
Audit every applicable config/attribute scope before content-scanning Git. Do not
assume disabled hooks/fsmonitor suffices. Git is withheld if any reachable external
command remains unproven; raw hashes/index records remain usable evidence and Git
status is unavailable. A sanitized copy tests recovery under isolated settings;
it does not prove original filters or services execute safely. Demonstrate full
hash/metadata/index recovery, all available
trees' identity/dirty/locks, the nested+main move/repair sequence, destination file,
directory and dangling-symlink collision failures, EXDEV/unsupported refusal and
interruption recovery. Do not deliberately fault live trees. All repaired paths
must remain disposable. Independent verifier checks original directories unchanged.
No restored services run. Missing safe isolation/tool semantics blocks rehearsal
and execution. Recovery: preserve failed receipts; remove disposable artifacts only
under separately scoped owned cleanup; never copy restored state over originals.

### 2. Prepare minimal reference changes — D, separate reviewed worktree

After bounded implementation approval, prepare separate checkpoints: first README
clone URL only for stage4a, then the current bootstrap identifier/local locator for
postmove integration; root adds current locator mapping without rewriting history.
Choose a clean isolated worktree under normal project gates, never reuse canonical
dirty paths. No automatic Claude loader/config edit. Inspect scoped diff and verify
app/data/engine/test/runtime hashes unchanged relative to the chosen candidate base.
Keep the README-only checkpoint unintegrated until remote identity is verified;
keep NEW local-path claims unintegrated until the local move verifies. Pass: reviewed
minimal candidates with exact SHAs and
no collateral edits. Stop: overlapping ownership or unrelated diff. Recovery: leave
candidate held or propose normal scoped revert, not reset someone else's branch.

### 3. First quiescence and remote-cutover backup — C, explicit maintenance/execution grant

Require owner acknowledgment of timing, recovery packet, provider gate and local
host reopen procedure. Every stream owner acknowledges freeze and provides its
checkpoint; do not infer consent from AFK. Finish/stop browser jobs and proof
campaigns gracefully; save editor buffers; stop only identified owned watchers and
Git writers. Preserve lock files/reasons; stale PID alone never authorizes unlock.
No active commands or sessions may retain cwd under canonical/nested paths during
the eventual move. Coordinator uses owner-controlled terminal at SAFE; current
sandbox allows only old path, so owner must establish permission for the future NEW
path and for every linked gitfile that repair will write. Permission is established
before movement, but **actual metadata repair happens only after movement**. Do not
create NEW merely as a permission probe. Approved probes must be disposable and must
not violate destination absence; no implicit escalation. Revalidate scope at stage4b.

Repeat stage0 inventory, ref exports, provider baselines and stage1 destination
checks. Create a **fresh remote-cutover** byte backup under verified quiescence, then hash
compare originals twice to establish stability; earlier rehearsal snapshot is not
the cutover backup. Changed files/refs/processes restart the snapshot gate. Record
backup hash, capacity, full coverage and restore-rehearsal receipt. This is NOT the
local-move final backup: stage4a deliberately changes shared Git state. Pass: all
owners quiet, exact remote-cutover baseline, sufficient verified backup and explicit
execution grant.
Stop: writer returns or owner unavailable. Recovery: resume original sessions without
any rename, log cancellation, retain backup under policy.

### 4. Rename GitHub only, then verify — C, remote mutation approval

From SAFE, reread source numeric ID and target. In GitHub's existing repository
Settings → General → Repository name, set `handpan-chords` and choose Rename only
under the approved remote scope. A404 is not a reservation: server/UI conflict is
STOP, never rename a different repository or delete an occupant. Capture before/
after timestamp and nonsecret numeric ID. Proposed verification:

```sh
gh api repos/raywu/handpan-chords --jq '{id,full_name,default_branch,permissions}'
gh api repos/raywu/handpan-chords/pages --jq '{cname,source,build_type,https_enforced,status}'
git ls-remote --heads --tags git@github.com:raywu/handpan-chords.git
```

Compare ID1344572975 and complete refs/settings/PR/issues/reviews/deployments against
final baseline; check old approved evidence links resolve correctly. Inspect CF
and app access now, plus known name-bound consumers. No local move until identity,
settings and provider binding checks pass. Existing site service is necessary but
not new-build proof. If a provider mutation is needed, stop for exact bounded repair
approval; do not reinstall shared apps or recreate projects. No main merge. Pass:
remote identity preserved and bindings inspect correctly. Recovery: preferably leave
verified remote rename and repair its specific issue; reversing name is a separately
approved mutation after collision/name-availability checks, never automatic.

This order isolates remote/name failures while local recovery paths still work.
Provider inspection alone does not authorize moving the common directory: stage4a
must prove real renamed-repository Git delivery, and stage4b must refresh recovery.

### 4a. Prove renamed-repository Git-triggered DEV delivery with OLD intact — C/D/P/V

This stage needs separately approved README-only delivery and existing DEV integration
authority; remote rename consent alone does not authorize commits/pushes/merges.
Keep canonical OLD and all local pointers intact. Allow only the coordinated docs
lane/integrator to write after temporarily releasing that lane from the freeze;
other writers remain paused. Use the audited normal Git transport and explicit
renamed repository targets; do not rely on redirect discovery. Shared origin may
remain old until stage5; any earlier exact remote update must be approved, recorded
and included in stage4b's refreshed config backup.

The reviewed checkpoint changes only README.md's remote clone URL, with no assertion
that the local path already moved. Record its commit and unchanged runtime hashes.
Open/update a held main-target CI PR and same-head DEV companion in the renamed repo
under normal project gates. Require independent review, **full actual exact-head
validate** and verified combined DEV tree before DEV merge. Check `gh run list
--repo raywu/handpan-chords --commit <README_SHA> --workflow validate.yml` and inspect
the actual jobs/counts. If docs-scope skipping prevents a full run, stop until an
approved real full-CI route exists; no gratuitous runtime edit, false no-op pass,
waiver or main merge.

After the authorized normal DEV merge/push, P captures Cloudflare's new deployment:
same existing project ID/hostname, renamed repository identity, branchdev and exact
actual DEV merge SHA, with normal Git-event trigger. Verify served docs/resources
against that revision and unchanged production against its existing main baseline.
A manual upload, retry of an old build, dashboard-only success, old200, or GitHub
redirect is insufficient. Failures stop local movement while OLD remains usable;
request exact bounded provider repair separately. No app uninstall/project recreation.
Record PRs/commit/run/deployment IDs, trigger provenance, exact resource/transform
comparison and independent evidence review. Pass: real new Git-triggered DEV delivery
from renamed repository verified. Recovery: retain remote rename and OLD, repair
forward if scoped; README rollback is a normal reviewed DEV revert if appropriate,
not main merge or shared metadata reset.

### 4b. Re-quiesce and refresh final local-move recovery — C/H/V

Stage4a changes refs, objects, indexes/config and delivery records; stage3's backup
cannot be reused as the final local-move backup. Stop the docs/integration lane,
reconfirm every stream owner and writer quiet, and repeat audit-first stage0 across
all worktrees and effective config. Re-enumerate the live topology and capture new
remote refs/HEADs/PR/deployment state and raw private manifests. Re-run destination,
source inode/device and permissions checks. No unapproved process, unknown status
path, topology change or new worktree is silently ignored.

Create a **new private byte-complete final local-move backup**, following stage1's
capacity/access/metadata/coverage/hash checks; verify stable originals twice during
the new freeze. Retain prior checkpoint backup separately. Validate the approved
restore procedure remains applicable to this refreshed topology/config; if not,
stop for a fresh approved isolated rehearsal. V verifies the final manifest and
backup coverage independently. Record stage4a's new delivered DEV SHA and current
runtime baseline, not obsolete2ca0. Pass: refreshed complete recoverable local state,
unchanged quiet window, absent destination, sufficient permissions and explicit
local move/repair grant. Recovery: cancel local movement, keep remote/README delivery
and OLD, resume acknowledged owners; no need to undo a successful remote checkpoint.

### 5. Move canonical directory and repair links — C only, local mutation approval

Require stage4a's actual delivery receipt and stage4b's fresh verified backup first.
Repeat lstat/realpath/device/inode/collision checks under quiescence from SAFE.
Use a separately reviewed compiled native helper, not `mv` or `shutil.move`:
open verified Projects parent with `O_DIRECTORY|O_NOFOLLOW`, verify parent fd and
source identity against final manifest, and call
`renameatx_np(parent_fd, "handpan-cards", parent_fd, "handpan-chords", RENAME_EXCL)`.
Resolve macros from installed headers; compile and test the exact helper during
approved rehearsal. Its only accepted effect is one same-device rename; any errno,
EXDEV, unsupported primitive, changed identity or occupied destination stops, with
no copy/delete, overwrite, nesting or symlink fallback. This is a specification for
a reviewed private helper, not a claim that such a helper has been built/tested.
Unimplemented helper/rehearsal is an explicit execution blocker.

After success, verify NEW has the exact former source inode/device and OLD absent;
if interrupted, inspect both via lstat and manifest before any next mutation.
Do not keep working from a shell whose pwd is the old path. From a new SAFE shell,
run the installed supported repair with argv-bound **new nested paths**, enumerated
from the frozen manifest (all seven at this snapshot, not guessed names):

```sh
git -C /Users/ray/Projects/handpan-chords worktree repair <NEW_NESTED_PATH_1> <...ALL_MOVED_LINKED_PATHS>
git -C /Users/ray/Projects/handpan-chords worktree list --porcelain -z
git -C /Users/ray/Projects/handpan-chords remote set-url origin git@github.com:raywu/handpan-chords.git
```

Shared origin normally changes once; enumerate effective fetch/push URLs and any
per-worktree/independent-clone overrides before changing each approved exact entry.
Do not overwrite a separate pushurl or custom remote without its recorded mapping.
Run repair without prune/unlock/force; preserve locked state. Preexisting missing
tree warnings may persist only if manifest-equivalent; new warnings/failures stop.
Verify every previously healthy worktree's common-dir resolution, branch/HEAD,
raw index hash, dirty/untracked/ignored bytes, symlink metadata and lock state, plus
all admin backlinks. Expected diffs are only path pointers and approved origin.
No snapshot record count is a target if live intake found more trees. Recovery:
stage-specific procedure below; do not hand-edit partial Git metadata ad hoc.

### 6. Cold restart and host continuity — H and owner, config separately approved

Owner opens a fresh Codex and Claude session at NEW with supported workspace trust
and permissions. Verify `pwd -P`, Git common-dir, current instructions/CLAUDE hash,
effective settings/hooks/skills/MCP associations, tool read/write scope, remote DEV
ledger bootstrap and saved-variants exact continuation. Compare preflight's installed
Claude version and `/memory` resolved location/index visibility; retain historical
private memory and transcripts. Verify old source links remain recoverable via
mapping. Do not print memory content in public evidence or silently regenerate it.

If native project trust/history discovery fails, H proposes exact smallest private
config change, names affected settings and supported installed-version behavior,
and obtains owner approval before applying it. Back up original config and preserve
other project entries; no wholesale JSON rewrite or symlink. Current docs are not
proof this host supports every documented setting. Any missing permission, memory,
instructions or plugin association leaves dependent work paused; merely launching
the app is not a passing continuity check. Recovery: inverse exact private patch
only after checking no intervening config edits; otherwise merge-reviewed repair.

### 7. Integrate remaining locator docs and verify final delivery — C/D/V, normal DEV authority

After permissions/context pass, final review verifies remaining approved bootstrap,
local-locator and ledger edits. README clone URL already delivered at stage4a is not
redelivered as if new work. Use normal project PR gates: same candidate head on held main-target
CI PR and DEV companion, full actual `validate.yml` run at exact head, independent
addressed review, actual combined DEV tree check, then DEV integration under its
own authorization. A docs-only changes-scope skip is insufficient. If workflow
cannot run full validate for this diff, stop and approve a bounded real execution
route; do not waive jobs, modify source merely to trick scope, or merge main.

```sh
gh run list --repo raywu/handpan-chords --commit <FINAL_SHA> --workflow validate.yml
gh run view <RUN_ID> --repo raywu/handpan-chords --json headSha,conclusion,jobs
```

Audit actual job execution, count floors, zero unexpected skips/cancels and mutation
coverage; reuse an old green only with project-accepted exact-source reasoning,
never manufacture a new run. DEV must show a **new normal Git-triggered** Cloudflare
deployment tied to the renamed repo and expected DEV SHA, then served resources and
affected journeys. A dashboard retry/manual upload or stale200 does not prove the
Git push subscription. Stage4a already established this before local movement; the
normal remaining-locator `dev` delivery provides postmove confirmation rather than
deferring the first binding proof until now. No gratuitous main write. Compare production to unchanged main baseline
and its approved delivery transform; compare DEV to combined current runtime,
including independently authorized saved-variants work if delivered in the meantime.
Never compare DEV to obsolete2ca0 blindly. Serialize browser evidence under one lease.
Failure holds completion and provider-dependent continuation, preserving failed receipts.

### 8. Final handoff — C with independent V

Publish nonsecret old→new locator, exact source/review/CI/deployment receipts,
complete healthy-worktree comparison, known preexisting prunable state, unresolved
limitations and private backup/restore owner locator. Update the authoritative DEV
ledger and reporting thread through existing gates. A fresh independent reader
must recover each active stream at the right ref and permission boundary from NEW.
Keep held main PRs held, DUP paused and other queued work unchanged. Resume workers
only after they acknowledge the new cwd/context. Retain backup for the owner-approved
period; cleanup is a separate scoped action. Complete only when all acceptance
items below pass or owner explicitly accepts a nonmaterial stated limitation.

## Acceptance and regression matrix

| Area | Observable pass evidence | Failure / limitation treatment |
|---|---|---|
| Runtime isolation | Runtime/data/engine/test bytes untouched by rename delta, against final authorized baseline | Any unexpected delta stops; another stream's approved delivery is compared separately |
| Browser protocols | Lock/storage namespaces, schema/wire versions, UUID/share payload logic unchanged | No cosmetic key rename; mixed old/new tab concurrency regression check if bytes/context changed |
| Basic user journeys | Existing exact-title checks for save/import/reload, two-tab writes, old/new share links, English A–G scale input; select titles/counts from final candidate runbook | No invented selector/count or mocked browser success; preexisting failures triaged |
| Worktrees | Every healthy tree's HEAD/branch/index/dirty/untracked/ignored/lock preserved; both pointer directions resolve NEW common-dir | Missing initial state remains recorded; new loss or wrong common-dir fails |
| Remote | Numeric ID1344572975, refs/tags, PR/issue/review identities, protections/settings and known consumers retained | Admin GET is not mutation proof; name conflict and unavailable binding block |
| Agent continuity | Fresh native sessions load unchanged instructions, correct trusted workspace and approved memory/tool associations; remote DEV bootstrap works | Missing installed-version capability/config approval leaves execution incomplete |
| CI | Full real exact-final-head validate, reviewed failures addressed, counts/floors/mutants accounted | Scope skip or successful process exit alone fails acceptance |
| Hosting | Same CNAME/production+DEV URLs, SEO/GA/noindex baselines; expected actual revisions/resources; new Git-triggered DEV deployment at stage4a before local move and final confirmation at stage7 | Serving old build, provider retry or GitHub redirect alone insufficient |
| Recovery | Private complete byte backup plus successful inert isolated restore/move/repair/collision/interruption rehearsal | Inventory/bundle alone fails; no rehearsal currently performed |

No new implementation-mirroring tests are proposed for documentation. Reuse meaningful
existing checks under the runbook. Any discovered runtime defect is separately scoped,
spec-first and subject to project mutant/CI rules. Headless Chromium does not prove
Safari/device/native-picker behavior; preserve those limits rather than claiming
new device coverage from repository plumbing.

## Checkpoint-specific recovery

| Last completed checkpoint | Safe next recovery, with owner/permission conditions |
|---|---|
| Before remote rename | Cancel window, preserve candidates/backups and resume old sessions; no refs/state need undo |
| Remote renamed, local unchanged | Keep local safe; use verified new remote explicitly. Repair a specific provider/name consumer with approved patch, or separately approve reverse GitHub rename after checking old name isn't occupied. Never create an old-name repo |
| README delivered from renamed repo, local unchanged | Preserve successful remote/DEV checkpoint and OLD; local cutover may be canceled independently. If README revert is needed use reviewed DEV gates. Stage3 backup is historical: stage4b must capture new refs/bytes before any move |
| Final local-move backup refreshed after README delivery | Use stage4b backup/manifest for local recovery, retain earlier remote-cutover evidence separately. Any resumed writer invalidates this final snapshot and requires another freeze/backup |
| Local move uncertain/interrupted, repair not started | lstat both paths, compare inode/device and manifest; neither/both unexpected stops for recovery. No repeat move until actual state known. If NEW alone is correct, forward repair may be safest |
| Local moved, metadata not/partially repaired | Under quiescence, either finish reviewed supported repair at NEW or inverse no-replacement move to absent OLD, then `git -C OLD worktree repair <ORIGINAL_MOVED_NESTED_PATHS>`; compare all trees. Reverse movement requires proper host permissions, no competing writes |
| Metadata repaired, origin changed | Same inverse move/repair plus restore approved effective remote/config values. Do not overwrite common .git wholesale over new legitimate refs or work; any divergent state requires reconciliation |
| Private state damaged | Preserve damaged evidence first. Restore verified backup only into isolated namespace, verify refs/index/dirty/private content, then owner approves exact reconciliation. No blind overlay of153 trees |
| Remaining locator docs integrated | Normal reviewed DEV revert if appropriate; no force/reset. Distinguish earlier README-only delivery from later local locator edits. Update locator to actual final identity, not assumed rollback destination |
| Hosting changed unexpectedly | Preserve deployment/settings receipts; prefer bounded forward repair. Provider rollback/deployment changes require separate exact approval; existing hostnames remain required |
| Host config changed | Inverse reviewed private patch only if no intervening edits; otherwise reconcile without erasing other projects. Cold-start verify again |

Remote and local rollbacks are independent; reverting one does not revert the other.
No automatic main revert, DNS edit, app uninstall, branch deletion or backup deletion.

## Blockers, decisions and adversarial disposition

P0 execution blockers: explicit rename/maintenance approval absent; all active
writers not quiescent; final inventory and byte-complete backup absent; isolated
restore/collision/EXDEV/interruption rehearsal absent; move helper not implemented
or reviewed; fresh NEW workspace permissions/trust unvalidated; live Cloudflare
Git/app binding and external name consumers unvalidated; safe filter/config/transport
audit incomplete; actual pre-local-move Git-triggered DEV checkpoint not delivered;
stage4b's postcheckpoint fresh final backup absent. These are not requests to
interrupt the current saved-variants campaign.

P1 acceptance gates: actual target acceptance by GitHub; complete fresh remote
identity/settings comparison; cold-start memory/tool equivalence; full actual CI
and new normal Git-triggered DEV delivery before local move plus final confirmation.
Initial target404 and installed repair
help close none of these gates. New destination/private backup storage must be
chosen and inspected at implementation intake.

Settled: both local and GitHub names are the intended scope; keep production/DEV
hosts and browser protocol identities; preserve Claude behavior; main still held;
do not resume paused work. No further preference interview is needed for these.
Narrow later owner decisions are maintenance timing/execution packet, private backup
location/retention and any exact host/provider config patch that investigation proves
necessary. Unavailable technical evidence is assigned research, not guessed consent.

Author adversarial checks produced concrete protections: preserve the misleading
old-spelling Web Lock; enumerate all nested/external/locked trees; use no-replacement
native rename with EXDEV refusal; retain baseline-prunable distinction; require real
backup and inert restore rather than manifests; re-snapshot after quiescence; forbid
stale-cwd continuation; treat successful serving separately from new Git deployment;
preserve historical URLs/private memory; avoid automatic app reinstall and HTTPS
hardening. None has been experimentally validated by this planning run.

v3 revisions address independent ENG's two P1 findings with concrete ordering and
execution controls: raw audit precedes every potentially executing Git scan, inert
sanitized restore is distinct from original byte recovery, stage4a proves Git-triggered
DEV while OLD is intact, and stage4b refreshes all state/backup after that delivery.
No new diagnostic/status/rehearsal/migration command was run for this revision;
only this owned plan changed. Independent ENG disposition: **pending re-review of
this exact revised plan hash**. Root records
review findings, revisions and final reviewed hash in coordination/ledger. No numeric
quality score, perfect-output claim or no-regression guarantee is asserted. Stop
after independently reviewed planning; execution requires its own explicit grant.


## Independent engineering review closure

A separate engineering reviewer examined initial plan3c91a93c and required two
P1 revisions: audit executable Git filter/config paths before content scans, and
prove actual renamed-repository Git-triggered DEV delivery before moving locally.
Prompt v3 was revised and rerun against the existing plan. The author corrected
both, including a fresh second quiescent manifest and byte backup after the
deliberate DEV checkpoint changes shared Git state.

Independent engineering re-review cleared substantive plan
d100bcee553cfed9ba422fcfd0a01f9a376ea637f13d6f530719f3d5f2123b1e on
2026-10-26 for planning only. This appendix records that disposition; it grants no
rename, rehearsal, global/configuration change or main merge. No material review
finding remains open in the proposed design. Untested execution gates remain
open exactly as listed above; no numerical perfection or regression guarantee is
claimed. The final document hash is recorded externally by the integrator.
