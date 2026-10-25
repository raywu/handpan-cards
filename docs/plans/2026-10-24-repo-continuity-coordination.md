# Repository continuity coordination

## Goal and non-goals

Publish a DEV-authoritative Markdown workstream locator and a source-based workflow
reference index, preserving the existing Claude behavior. Integrate an independently
reviewed Mac repair plan, without implementing a fix. The owner approved this batch
and reported current UI/device QA “Verified. All good.” Device coverage is unspecified.

No changes to existing AGENTS/CLAUDE/runbook/application/tests, active skills,
hooks, configuration, credentials or dependencies. No main merge or cleanup.
Repository requirements remain in [CLAUDE.md](../../CLAUDE.md); execution scope and
verification remain in the [bounded plan](2026-10-24-repo-continuity.md).

## Ownership and sequencing

| Actor | Scope | Worktree / branch |
|---|---|---|
| Root integrator | New continuity/index/coordination/backlog documents; Git/CI/DEV integration | Host ray-Mac; `/private/tmp/handpan-continuity.pcdoqu/repo-continuity`; `codex/repo-continuity-20261024` |
| Mac planning agent | Only the new Mac repair plan; no tests/browser/fix | Same host; `/private/tmp/handpan-continuity.pcdoqu/mac-repair-plan`; `codex/mac-repair-plan-20261024` |
| Engineering reviewer | Independent read/report | Separate native context, no author edits |
| Continuity/design reviewer | Independent read/report | Separate native context, no author edits |

At most root+3 simultaneous agents. Root owns publication; new implementation
workers wait until canonical ledger publication. Initial root-only creation is the
bounded bootstrap exception. Mac planning was independently authorized in parallel
and is not an implementation worker. Local directories do not establish remote
availability, ownership transfer or permission to unlock/reset another tree.

## Last confirmed actions

1. Fresh main `e314f858acf3b36fd01ebfcc9e7db37fa46857ef` and DEV
   `e3473d601dd5916afeef834afea12730efbf3795` verified; both trees
   `259e1f13126ad4e8e4b2727598333d18d30a05e1`.
2. Isolated lane worktrees created from main; existing root/locked/dirty worktrees
   and dirty dotfiles preserved. No global configuration value was published.
3. Both independent reviewers cleared bounded plan body SHA256
   `bff126771036804f2a9572dcdfd3a44401fd89d30edfcb7e77bd5b8047fee224`.
   Engineering's initial CI sequencing concern was withdrawn after refreshing
   actual PR checkout semantics; actual full-job execution remains mandatory.
4. Mac author is inspecting current source and retained diagnosis. Findings remain
   planning evidence, not new browser execution or proof of repair.

## Exact next action at this checkpoint

Retain this reviewed plan/bus checkpoint on the lane branch. Add the workflow
reference index, canonical DEV ledger and concise recovered backlog. Read every
new file and verify immutable refs; integrate the Mac plan only after independent
engineering/design review. Create/update paired PRs from the same final head;
MAIN stays held, DEV requires addressed independent source review, full actual
`validate` execution and exact combined-tree proof. Do not use a plans-only skip
run as the full gate.

Once a delivery PR exists, resolve its live state rather than trusting this
historical checkpoint. If open: check exact head/review/CI. If merged: verify actual
DEV tree and all new served documents/noindex, then run the independent fresh-reader
probe. Do not repeat completed writes merely because this snapshot predates them.

## Handoff and failure handling

Canonical locator publication revision is obtained externally from remote DEV;
no file pretends to contain its own final commit hash. Retain immutable plan/bus
commits and source branches. A new host must resolve remote refs and create only a
clean authorized checkout; it must not take over the named host-local directory.
Missing refs, cached-only state, competing ownership or uncertain dirty work block
dependent continuation. Preserve evidence and investigate, never steal on timeout.

Current limitations: ledger/index not yet published at this checkpoint; actual
workflow loading/parity, automatic startup discovery, Mac repair and cross-clone
continuation are not demonstrated. No additional main or Claude-change consent is
inferred from the completed production release or AFK mode.

## Prepublication recovery control

A separate fresh native context used an independent HTTPS shallow clone and
unauthenticated public repository reads, without conversation or private-global
context. At2026-10-25T03:54:55Z it resolved remoteDEV e3473d60 and correctly
observed canonical docs/WORKSTREAMS.md HTTP404. It rejected the locally present
feature snapshot as unpublished authority, retrieved both immutable P documents
HTTP200 with their advertised Git blobs, and recovered the correct bounded root
continuation/owner decisions. It also rejected initial validate40159553762's
plans-only success as the full gate because substantive jobs were skipped.

This is a passed prepublication/cached-state control, not successful published
recovery or automatic discovery. The independent clone is on the same host, not
a second machine. Initial sandbox DNS failure was followed by permitted public
network reads; authentication/global settings were not changed. Postpublication
positive recovery and other failure controls must be reported separately.

## Candidate preparation receipt

Both preliminary continuity-source reviews found no material issue in the new
ledger/index/backlog. Final commit-bound source review remains required. Mac
planning revision Q98dafd8e5f69c0698da83cea2aac8a5324052c82 is retained on
`codex/mac-repair-plan-20261024` and integrated, with exact file SHA256
`dedd4ad1984ead3673b27e8f80f0541b0c13886dedfdfd839b20c1c50b4e9c1e`.
Independent engineering and design reviewers cleared Q's body. Its two addressed
findings distinguish plan-publication authority and require a reviewed numeric
whole-collection deadline/cleanup envelope in addition to unchanged per-file900s.
No Mac runtime experiment or implementation ran.

The candidate's publication status will be resolved through live PR570/571 and
SHA-bound review/CI/DEV receipts. Do not edit a tested source head solely to embed
its own CI run or publication SHA; external metadata binds those results. The
first ledger remains a snapshot with explicit last-confirmed state and live-state
resolution, not an automatically updated database.
