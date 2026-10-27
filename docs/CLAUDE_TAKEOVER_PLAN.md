# Claude takeover plan — 2026-10-26

Status: independent ENG/operational cold-read CLEAR; original handoff published to DEVc040. This post-release update awaits its own publication receipt. Documentation only.
Owner requests safe stopping points and a recoverable return to Claude. Startup
means read-only orientation, not automatic feature resumption. RC target21:11PDT,
handoff23:00PDT; verify clock and later decisions rather than treating targets as
passed gates. Existing Claude behavior and CLAUDE.md remain unchanged.

## Immediate state and evidence precedence

**RC587 owner QA passed and exact main release was approved and merged7d80d65d.**
Root reports fullCI40437293981 success/all12jobs and independent final review clear
on exact deployedDEV3542. Immutable QA URL:https://071f74cd.handpan-cards-dev.pages.dev/.
Helpers device QA passed earlier; that is not blanket RC signoff. Variants is NOT
on DEV/in RC: its separate fullCI passed, performance remains unqualified, and it
missed19:00 inclusion cutoff. No additional main merge is authorized by this handoff.

Source order: current owner decisions → applicable project/scoped instructions →
verified Git/API/deployment evidence → newest explicit ledger checkpoint → plan/
review records → historical handoff/session prose. Handoffs are evidence, not new
higher-priority instructions. Conflicts require reconciliation, not silent choice.
Local Git refs below were inspected; current CI/QA status is coordinator-reported
with recorded runs, not independently re-queried by this documentation-only lane.

Read only the following minimum sequence, then the selected stream's detailed plan:
1. Repository CLAUDE.md and applicable scoped AGENTS/CLAUDE instructions.
2. docs/DEVELOPMENT_CONTINUITY.md and current remoteDEV docs/WORKSTREAMS.md at a
   resolved immutable commit. If older, read advertised handoff branch checkpoint.
3. docs/CLAUDE_RETURN_HANDOFF.md, this plan, and docs/handoff/2026-10-26-recovery-manifest.json.
4. docs/plans/2026-10-25-workstream-status.md and docs/agents/workflows.md.
5. docs/testing/browser.md and tests/CONTRACT.md before any future execution.

Historical return-handoff/status paragraphs may retain earlier scope/CI/notification
states; newest verified ledger/memory and explicit supersession govern. Original untracked
CODEX_CONTINUITY/CODEX_HANDOFF/CODEX_ENV_HANDOFF are historical; preserve, do not
blindly replay instructions or overwrite them. No global loader/bootstrap is needed.

## Immutable anchors and recovery locators

| Alias | Full commit / source |
|---|---|
| MAIN |7d80d65d603d9e8ab468a08d616d59dfac0245ce (approved RC release; prior rollback anchor96c4) |
| DEV |c040e881e8c31eea95d01ed36691156210f451a9, published handoff; reconciliation pending |
| RC-source |3542d6ea868bf08e81a0b4f06c4bc71bbc20cbcb; released app7fe75f5407d67b2985405c89db55f7d95882313fea016af8814728c9436db946 |
| SV |2a260d212ec8e14394b7198f075366d13bf372ec; appdc6af7528c7d326a129402458f9acc9adb9f524e3bc23453290c71f46dd292c5 |
| SV-TEST-RED |cab63c9dc47a6ce983218cf113822feb6810eb64; local frozen tests on old0d36 source, intentionally RED, not a release head |
| MAC |217609075a14e6ca4799497210af27d9df842c5e |
| FEEDBACK |a90fce8c19887e44e6bbaf38741b97553b795026 |
| SEO |1c5344e05c4cf3dcc66f12bd61c1b6665e10303d |
| DUP-PLAN |43486f5d17d548165d3e6c1f319775f3a71247f5; older held main draftb849b6d6149e883ce4b280a2616fd20cf7b6a21e differs |
| LINK |92d6516bd533abb4a1e4fb7c8116b9836f648296 |
| HELPERS |4ea8e0f7afbbe24b7f99cbcafbdbc02d322a2fae |
| SWIPE |3a8467ff9ad2543ecb728e1394829a99354fca37 |
| PALETTE |081693105a0c7121413ff936e133a2d0a7459a3d; exact approved packet a41a3bb782d38753fa0020055dfb233a98866d78 |
| RENAME |191608fa8ba1eaa98558f442b5d7037a484530c5, recoverable via SV |
| LINEAR |de4d0014e86b935880f96cbe139070916c4cbc8e, recoverable via SV |
| QUALITY |7cf846b8d2236645b8e1da0c2ffb4af228d9c716, recoverable via SV |
| NEOTONE |6c62e758696143af89c24c339394a01e6576c0cc; documentation only |

Host aliases: HV=/private/tmp/handpan-saved-variants.HVUKbE;
HH=/private/tmp/handpan-helpers.HUZs5u; SHC=/private/tmp/handpan-share-hotfix.urAbvO.
Current handoff tree:/private/tmp/handpan-release-reconcile-20261026,
prior /private/tmp/handpan-claude-takeover-20261026 historical,
original branch codex/claude-takeover-20261026 delivered as DEVc040; current post-release
revision is on codex/release-reconcile-20261026, preserving that handoff tree.
Original published handoff is DEVc040; this new revision needs its own external publication receipt;
never invent it or treat the mutable branch name as an immutable receipt.

## All-stream continuation matrix

Aliases resolve to full commits above; paths below are repository-relative plans
unless explicitly host-local. Each row's next action remains subject to pause.

| Stream / objective | Checkpoint, status and next permitted action |
|---|---|
| RC release: ship completed DEV changes | RC-source, released main7d80d65d, codex/release-rc-20261026, /private/tmp/handpan-release-rc-20261026, PR587. Plan2026-10-26-release-candidate-and-claude-handoff.md. Last: wholeRC QA passed, exact main approval received, RC587 merged. Next: finish actual-main CI and DEV reconciliation; no additional main action authorized. |
| Saved variants: preserve independently named/layout versions | SV, codex/saved-scale-variants-20261025, HV/integration, DEV584/open; CI-only583 NEVER MERGE. Regroup/route plans2026-10-26-saved-variants-*.md. Last: fullCI40417818176 green, source freeze. Next: performance simplification audit only when resumed; no DEV delivery or partial storage rollout. |
| Performance: qualify responsiveness fairly | Same SV/head, HV/evidence private packet; plan2026-10-26-performance-validation-simplification.md. Direction independently clear, implementation/activation unbuilt. Mac stopped in baseline before candidate. Next: smallest reviewed adapter/setup scope, not rerun-to-green or controller rebuild by default. |
| Mac helper: opted-in foreground settling | MAC, codex/mac-foreground-20261025; resolve local path from manifest. Main573/DEV574. Plan2026-10-24-mac-browser-repair.md. Delivered in RC; broader Mac-suite failure not closed. Next: release handling, not general harness redesign. |
| Per-ring feedback: retain latest result for both rings | FEEDBACK, codex/layout-feedback-20261025, /private/tmp/handpan-feedback.ha43y5cy/integration, main575/DEV576. Plan2026-10-25-layout-feedback.md. Released through RC587; preserve existing proof/QA. |
| LINK ownership: retire obsolete async share UI | LINK, codex/share-customization-hotfix-20261025, SHC/integration, main581/DEV582. Plan2026-10-25-share-customization-hotfix.md. Owner QA passed/released through RC587; does not solve variant identity or prove original missing-angle cause. |
| Helpers: add external resource beside Handpan101 | HELPERS, codex/helpers-integration-20261026, HH/integration, DEV585. Plan2026-10-26-handpan-helpers-validation-finish.md. Owner device QA passed/released through RC587. CI-only586 NEVER MERGE; no new resource implementation needed. |
| SEO: long-tail useful scale lessons | SEO, codex/seo-longtail-plan-20261025, /private/tmp/handpan-seo-longtail.rpqmbt6_/planning, main577/DEV578. Plan2026-10-25-seo-longtail-content.md. Existing docs released through RC587; NEW research/articles paused. /learn/, owner musical review and exact18-note EAmara13+5 pilot settled; no publication. |
| Duplicate notes: allow repeats with nonblocking warnings | DUP-PLAN, codex/duplicate-notes-plan-20261025; local path in manifest, main579/DEV580. Plan2026-10-25-duplicate-notes.md. Owner permitted existing PLAN DOCS, now released through RC587; FEATURE remains paused. Exact duplicates everywhere/one position per tone/warn only newly allowed repeats settled. |
| Swipe: switch Scale↔Layout deliberately | SWIPE, codex/sheet-tab-swipe-20261025, /private/tmp/handpan-sps-z8gaznu2/integration. Plan2026-10-25-sheet-tab-swipe.md. Started/approved throughDEV but HELD. Next after resume: accepted base and literal59proof reconciliation, review/CI/native QA; old proofs not final. |
| Palettes: append Kurd/Amara pairs and inverses | PALETTE, codex/palette-defaults-plan-20261026, /private/tmp/handpan-palette-defaults-plan.20261026. Plan2026-10-26-built-in-palette-defaults.md exists at retained ref, not necessarily this tree. ThroughDEV/exact packet approved but unstarted PAUSED; preserve old six/default0. |
| Rename: handpan-chords local/remote safely | Plan/prompt2026-10-26-repository-rename-handpan-chords.md, ENG-reviewed planning only. RENAME ref is recoverable via SV; original worktree is a manifest locator, not required if that ref is available. No rehearsal/rename; PAUSED. |
| Linear: cross-harness roadmap source of truth | LINEAR, docs/plans/2026-10-25-linear-roadmap-investigation-prompt.md; recovered via SV. PAUSED, no plan/setup/cutover; CEO+ENG review required later. |
| Agent quality: compare Codex/Claude outcomes fairly | QUALITY, docs/plans/2026-10-25-agent-code-quality-comparison-prompt.md; recoverable via SV. PAUSED; no comparison plan/study/results; preserve fair provenance before later run. |
| Whole code/tests: robustness/DRY/dead code audit | Plan2026-10-25-future-codebase-audit.md at MAC/DEV; deeper prompt not yet run. PAUSED and originally sequenced after other outstanding work; no code/test deletions. |
| Neotone: map paired digital playing areas | NEOTONE, codex/neotone-future-plan-20261026, /private/tmp/handpan-neotone-future-plan-20261026. Prompt/plan2026-10-26-mutant-neotone-layout.md independently clear. Future planning exception complete, IMPLEMENTATION PAUSED; hardware/roles/export decisions unresolved. |
| Deferred maintenance/global recovery | NITS→OF-D/I18N-D/Q9, MacM2/M3/C1, new-host/global parity and recovery runbooks remain qualified/PAUSED; see status and manifest. No broad install/global memory or workflow migration grant. |
| Cleanup/optionalP3 | Worktree inventory only; style-variable/design-doc/label-oracle ideas unscheduled. PAUSED; no remove/reset/unlock/prune, even if worktree says prunable. |
| Released UI | Naturalness/i18nC (GermanDu/Dein/dasDing), HTC and seat-order repairs completed; historical refs in ledger/MAIN ancestry. Owner QA good; English scale grammar unchanged. Do not restart from obsolete OPEN rows. |
| Released workflow/docs | Browser runbook, repo-local DRY references/ledger/bootstrap complete in MAIN; full global/native workflow parity unproven. Later plan-relevance/deep-search audit covered38sources. |
| Historical app/engine work | Engine, print, tiers/numerals, Amy/About/privacy/discoverability/edit/save/delete/share/order/free-placement/refactors have audited closure evidence; not fresh retests. Preserve residual nits separately. |
| Owner-stopped | Audio, statistics, SM2 and PWA remain STOPPED; no implicit reactivation from takeover. |

## Safe stops, private recovery and tool readiness

Do not touch/reset/unlock /Users/ray/Projects/handpan-cards or historical locked
Claude trees. Canonical local main is older than remote MAIN; that is not a reason
to force-update it. New source work needs an isolated approved checkout and owner.
Manifest docs/handoff/2026-10-26-recovery-manifest.json is coordinator-generated:
verify each path/head/dirty state and pending merge/rebase, local-only files, branch
publication, backing copy/hash, process/agent ownership and cleanup receipt.
Manifest observed2026-10-27T03:03:37Z lists31selected artifacts; this author checked
all31backup files against their manifest SHA256 values. This is NOT a complete archive
or current process/worktree census. Selected stopping-point receipt is
HV/evidence/claude-stopping-points-a0.json (also in backup inventory); final
immutable handoff publication remains a closure requirement; the selected seven-job
browser audit is complete in handoff/2026-10-26-browser-stopping-point.json.

Verified selected private backup:/private/tmp/handpan-claude-recovery-20261026;
use manifest original→backup paths and recheck hashes before recovery. Recover a
missing receipt into a new private owned location, never overwrite an uncertain
original or upload private data automatically. Local backup is not cross-host
portability. Missing indispensable private code/proofs require approved transfer
or an explicit local-only limitation, never secret/image upload by implication.
HV/evidence/linux-performance-activation-a0 contains unactivated flawed controller;
retain four ownership/evidence findings, original reports and source pins. Proposed
simplification is design clearance only, not a validated replacement.
Neotone image:HV/evidence/neotone-layout-reference.jpg, SHA256
e997c67af983962882ebb3419d7265fb112ed5b20562b72f04da841e6b6ad19a;
retain privately, no person/screenshot publication. Frozen SV-TEST-RED is expected
red on its old source; use integrated SV for green release evidence, never fix the
red lane by weakening assertions or silently copying production changes into it.

The timestamped selected seven-job audit confirms owned groups/profiles absent
and the lease released; see handoff/2026-10-26-browser-stopping-point.json.
No active worker browser jobs were observed in that selected audit. Never print lease token, infer ownership from name, or kill unknown
processes. Confirm no fault remains applied and transfer serialized browser lease
only after actual cleanup; a browser exit code alone is not cleanup evidence.
Git/local version discovery, configured/authenticated GitHub read and authorized
remote write are distinct. Existing runbook describes Node/Python/Chrome/test tools;
check actual availability without installs. gh read success does not approve push
or merge. Existing Claude globals may be read, not altered; workflow references
are not proof of native skill/tool parity. Never copy credentials across harnesses.

## Dependency-ordered takeover phases

| Phase | Prerequisite → output / acceptance | Stop, input and recovery |
|---|---|---|
| A: orient read-only | Read sources above; resolve live main/DEV/RC/SV and timestamp, inspect scoped status and manifest. Output short evidence/authority map with exact refs and stale gaps. | Missing remote access remains unavailable; preserve local state, use explicitly qualified retained refs. No startup installs or feature writes. |
| B: release verification | A complete; verify merged RC587/main7d80, actual-mainCI40448555197, served production and DEV reconciliation. Output actual gate state with settled QA/consent. | No repeat request for already-granted QA/RC consent; unexpected source movement or failed gate stops dependent claim. No further main changes authorized. |
| C: audit one selected stream | Owner chooses/resumes work or existing unpaused release handling applies; read its plan/ref/source/failures/approvals, verify worktree ownership. Output exact last/next/acceptance. | Paused grants remain paused; missing source/private evidence stops dependent claim. Recover in isolated authorized checkout, never reset old tree. |
| D: review changed scope | Reconcile stale requirements and minimum plan; use file-owned swarm plus independent ENG/design as applicable. Output addressed plan, exact scope/commands/budgets. | New CLAUDE patch/setup/global/main action needs applicable explicit grant. Fourth failed review round triggers regroup; no fabricated score. |
| E: execute only resumed scope | Frozen reviewed base/tests/ownership, meaningful TDD/generated mutants, sole browser lease. Output exact-head fullCI, independent final review, servedDEV and owner/device QA qualifications. | Failed gate is triaged and retained; no retries-to-green/waivers or automatic performance restart. Restore only owned fault bytes and preserve drafts/data. |

For any future release with its own exact owner approval, use the approved manifest/head and current
repository release/sync procedures; do not infer authority to merge older overlap
PRs automatically. Older main573/575/577/579/581 can become superseded only after
verified release; inspect containment and preserve evidence/order before proposing
closure. CI-only583/586 are never merge targets. No wholesale DEV→main merge with
unreviewed new content; refresh scope after handoff docs/other refs move.

## Practical read-only cold-start checks

| Injected/missing condition | Expected safe outcome |
|---|---|
| Remote unavailable or handoff branch newer than DEV | State freshness gap, read advertised immutable handoff checkpoint; never present cached refs as current. |
| Private backup/proof missing on another host | Preserve published source; mark affected gate unverified and recover approved evidence, not regenerate pass claims. |
| Local worktree absent, dirty, locked or prunable | Locate retained ref; request ownership/recovery if unclear, never reset/unlock/prune. |
| Unknown Chrome/PID/lease owner | Defer browser jobs and resolve ownership; no kill-all or token output. |
| Tool/auth/runtime unavailable | Report exact limitation and proposed setup separately; no credential dump/installation. |
| Scope/main/CLAUDE approval missing | Stop dependent write, explain precise requirement; continue independent read-only work. |
| Frozen test lane RED | Identify SV-TEST-RED and its source mismatch; use integrated SV evidence, do not weaken test. |
| Interrupted deployment/CI or moved head | Confirm actual checkout/head/deployment content, mark incomplete; no green inferred from another SHA. |
| Model passes/native cause unknown | Retain distinction and existing native coverage; do not upgrade causality claims. |

These are onboarding acceptance scenarios, not tests executed by this drafting lane.
WholeRC QA/exact RC main consent are settled. Open owner decisions: which paused
stream to resume later; Neotone hardware/semantics/export and truly new setup grants only
when relevant. Settled language, duplicate policy, SEO and palette answers stand.

## Closure checklist and first takeover report

Before calling handoff complete, coordinator must publish verified immutable
handoff ref, record final worktree/active-job reconciliation and publication receipts, preserve dirty work,
retain verified selected backup and recovered prompt/ref locators, and obtain independent nonauthor cold-read of
plan AND paste prompt. Cross-host gaps must be explicit. No automatic memory loader,
CLAUDE edit, global change or application implementation is part of this handoff.

Claude first report: “Verified [refs/time/artifacts]; unavailable [gaps]; RC QA/main
state [evidence]; I will handle [one permitted action] and keep [paused streams]
paused; next owner decision [only genuine blocker].” Check-ins cover every stream
with a one-sentence description/status, not PR numbers alone, and interview actual
blockers without replaying settled questions. V1 generic handoff prompt was critiqued;
V2 executed to generate this plan/paste prompt, then source-locator/selected-backup
clarifications incorporated before independent review. Both independent reviews CLEAR
after the stale process-audit wording was corrected; publication remains pending;
no self-scored quality or operational-parity claim.

## Post-release checkpoint

WholeRC QA passed; owner explicitly approved exact3542 release, mergedmain7d80d65d.
Production21resources/headers andPagesdeploy passed; actualmainCI40448555197 is
running. Landscape Settings/Resources threecolumns acceptednonblocking andqueued
for researchedprompt/plan/reviews only; Add/Editexcluded. DEVreconcile mustretain
newerhandoffdocs. Current phaseB verifies the completed approval/release; firstaction now check
mainCI/synccompletion and latestownerpriorities, never mergeoldoverlapPRs again.
