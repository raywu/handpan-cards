# Shared workstream ledger

## 2026-10-25 Mac repair execution checkpoint

This newer checkpoint supplements the historical bootstrap snapshot below.
PR570 is released at main96c4c589cec0950723b3b5323dc1df5bbc359329;
sync572 delivered DEVc79af08c90750d350e70344c0835303c3f6bb822. There are no pending
merges for that batch. Resolve current remote refs and this branch's live PRs
before proceeding; a local feature snapshot is not canonical DEV.

- **MAC-M1 owner/authority:** root on ray-Mac. Owner explicitly authorized narrow
  contract reviews, separate TDD/helper lanes, independent review, full Linux CI
  and DEV validation. No app, CLAUDE.md, global setting or main change; larger
  full-Mac collection budget still requires a separate decision.
- **Current plan:** [Mac repair](plans/2026-10-24-mac-browser-repair.md), dated
  execution amendment; preimplementation reviewed amendment SHA256
  b7383d1e6c4f3010659a4ff9e4df17f9c59d7dbfe67467d28c647300477fe9b6.
  The current live plan file may later add factual execution receipts; retain the
  reviewed source as a commit before implementation rather than imply stable hash.
- **Worktree:** /private/tmp/handpan-mac-repair.c94d3kno/integration, branch
  codex/mac-foreground-20261025, base96c4c589. Evidence is sibling evidence/;
  original dirty/locked trees untouched. Host-local paths are not takeover grants.
- **Last completed:** bounded P1 current-source baseline/passive red, after-launch
  activation insufficient, before-settle activation pass, passive reversal red.
  Exactly1 executed each,0 required skips/cancels. Independent evidence review
  cleared narrow mitigation inference, with cleanup/sampling qualifications.
  [Published P1 receipt](https://github.com/raywu/handpan-cards/pull/571#issuecomment-6398951284).
- **Next:** finalize engineering/design clearance of the exact opt-in contract,
  record separate T/H worktrees, demonstrate meaningful controlled-oracle red
  against unchanged helper, then implement minimal foregroundSettle policy.
  No repair/runtime/full-Mac readiness has been established at this checkpoint.
- **Scope/risks:** explicit interactive instance policy prepares only settle's
  first real frame, every call. Neutral helpers/deferred capture remain unchanged;
  M2/M3/C1 and arbitrary/drawer rAF paths remain separate. Final review, generated
  mutants, exact-head Linux CI and actual DEV validation remain required. Main is
  held until repair-specific owner consent. Unknown ownership/conflict or bad
  diagnostic oracle stops dependent writes, never triggers reset/unlock.
- **Parallel NITS investigation:** source audit completed read-only at96c4c589.
  Single pendingDerive string can overwrite an earlier ring's feedback, but
  current-state-summary versus event-history UX is not settled. NEXT/keyboard
  routing is wired; some lifecycle tests use weak or synthetic oracles. Plain
  slide flashing without renumbering conflicts with accepted existing behavior.
  No app fix is authorized by the Mac scope; next is a separate reviewed plan
  and discriminating reproduction. Keep NITS→OF-D order; other backlog remains.

**Authority:** this file is the canonical locator only when read at a freshly
resolved remote `dev` commit in `raywu/handpan-cards`. Main, feature branches and
local copies are snapshots. The publication revision is that external DEV commit;
no row claims to embed this file's own final commit hash.

Snapshot observed: 2026-10-25T04:00:05.560880+00:00. Integrator: Codex root on host `ray-Mac`.
This initial bootstrap is being published through [DEV PR571](https://github.com/raywu/handpan-cards/pull/571).
Resolve its live state before treating the snapshot below as present execution.
Existing [repository instructions](../AGENTS.md), [CLAUDE.md](../CLAUDE.md),
[test contract](../tests/CONTRACT.md) and [browser runbook](testing/browser.md)
remain unchanged. [Workflow references and explicit session bootstrap](agents/workflows.md)
are an index, not activated skills or changed Claude lifecycle requirements.

## Read and resume safely

1. Resolve current remote DEV SHA by authorized read/fetch; read this blob at
   that exact SHA. Record source commit/time. Missing access means stale/unavailable.
2. Select the stream below. Read its retained plan and coordination checkpoint;
   resolve the advertised branch/PR's current head and inspect any changes since
   the recorded checkpoint. Live head alone is not implementation approval.
3. Bind review/CI/deployment evidence to the actual relevant SHA. An open/merged PR
   is not proof of complete tests. Unknown scope, missing ref or competing ownership
   blocks dependent continuation. No automatic takeover, reset or unlock.
4. A named worktree path is host-local. On another host use the retained refs in a
   new clean authorized checkout. Uncommitted work/raw temporary evidence cannot
   be recovered from Git and must not be silently reconstructed as completed work.
5. Read the next action and its acceptance/authority. Settled owner choices carry
   forward. Interview only unresolved choices. AFK and this ledger do not grant a
   new main merge, Claude edit, global setup or Mac harness fix.

One integrator publishes Codex's checkpoints via normal independent-review/CI/DEV
PR gates. Workers report progress; the ledger is not a distributed lock. Record
assignments/worktree creation, meaningful progress, decisions/blockers/interruption,
PR/head changes and integration/verification. Other harnesses may read the shared
state under their own existing instructions; this batch does not impose new
mandatory behavior on Claude. Preserve DEV-only ledger updates in future syncs.

## Stream index

| ID | State at snapshot | Continuation |
|---|---|---|
| REL-20261024 | Completed | Naturalness, i18n C, HTC and SO-D are released; see immutable evidence below |
| BROWSER-RUNBOOK | Completed | Shared runbook is released; use its current limitations and check routing |
| DRY-LOCAL-20261024 | Bootstrap publication in progress | Resolve PR571; follow the detailed record below |
| MAC-PLAN-20261024 | Plan independently reviewed; execution not authorized | Read the retained plan and await separately scoped runtime authority |
| I18N-D | Queued | Draft exact recurring-feature rule; CLAUDE edit requires explicit approval |
| NITS | Queued, scope needs revalidation | Consolidate/recheck historical findings before a scoped plan |
| OF-D | Queued after NITS | Documentation only; order-follow engine/app are already shipped |
| SEO | Deferred after earlier work | Research/evidence/plan only; no implementation |
| CLEANUP | Deferred | Inventory per-ref inclusion/unpushed/dirty/ownership before proposing cleanup |
| OWNER-QA | Owner reported verified/all good | No new issues reported; exact device/browser coverage unspecified |

Queued scopes and recovered investigation targets are in the
[portable backlog](plans/2026-10-24-continuity-backlog.md). Original external kits
and private memory are not promised on a new host. Their absence is a context
recovery task, not permission to invent requirements or restart shipped features.

## DRY-LOCAL-20261024 — repo-local references and DEV ledger

- **Objective/non-goals:** make current work and canonical workflow sources
  discoverable without duplicate instruction bodies. Ordinary new documents only;
  no existing instruction, app/test/helper, active skill, dependency, config, auth,
  installation, main release or cleanup change.
- **Authority:** owner explicitly approved “repo-local implementation—workflow
  references and the shared DEV ledger—while drafting and independently reviewing
  the Mac repair plan in parallel,” with no CLAUDE edits/installs/global configuration.
  This is the bounded transition from research to implementation, not the broader
  global-adapter or Mac-fix scope.
- **Retained plan:** [plan at checkpoint P](https://github.com/raywu/handpan-cards/blob/be42e06a9406df250ef3a3af1686bfa785dbb52d/docs/plans/2026-10-24-repo-continuity.md),
  Git blob `57ee887038ae1c070785c5b28bfa43995f6cb22b`.
- **Retained coordination:** [bus at P](https://github.com/raywu/handpan-cards/blob/be42e06a9406df250ef3a3af1686bfa785dbb52d/docs/plans/2026-10-24-repo-continuity-coordination.md),
  Git blob `e5b226f11dbcad222673fd7bb90a37c1dca3de34`.
  P is a historical checkpoint, not a claim to name the final candidate commit.
- **Owner/host:** Codex root, `ray-Mac`. Worktree
  `/private/tmp/handpan-continuity.pcdoqu/repo-continuity`; branch
  `codex/repo-continuity-20261024`. Do not take over this path on uncertain ownership.
- **Base/checkpoint:** main base `e314f858acf3b36fd01ebfcc9e7db37fa46857ef`;
  DEV base `e3473d601dd5916afeef834afea12730efbf3795`;
  last retained plan/bus checkpoint P `be42e06a9406df250ef3a3af1686bfa785dbb52d`.
- **Last confirmed:** scope plan independently cleared by engineering and
  continuity/design reviewers; P pushed, reference/ledger/backlog authored, and
  independently reviewed Mac plan checkpoint Q published and integrated. The
  prepublication fresh-context control correctly rejected the feature snapshot and
  plans-only CI skip as completion evidence. Actual final
  source/review/CI/publication state is resolved through the linked PRs, not guessed
  from this prepublication snapshot.
- **Live refs:** [MAIN companion570](https://github.com/raywu/handpan-cards/pull/570)
  is HELD without new main consent; [DEV delivery571](https://github.com/raywu/handpan-cards/pull/571)
  uses the same candidate head. Keep the branch/checkpoints fetchable.
- **Next if571 is open:** inspect its exact source head/diff, independent reviews,
  actual full validate on570 at that head, and current combined DEV tree. Do not
  credit plans-only skips or stale CI. Only the integrator performs gated DEV merge.
- **Next if571 is merged:** read its actual DEV merge, verify tree/source and new
  served documents/noindex, and inspect its independent recovery/completion receipt.
  If those are clear, report this bounded publication complete; do not redo it or
  continue global migration/Mac implementation without separate scope authority.
- **Acceptance/evidence:** all existing tracked files byte-identical; no private
  instruction bodies/credentials published; immutable refs readable; full exact-head
  CI actually executes; final independent review addressed; actual combined tree
  verified; DEV documents/source/noindex verified; independent fresh-reader results
  distinguish success, failed controls and untested capabilities. Resolve immutable
  SHA-bound final evidence from PR570/571; this row does not claim it already ran.
- **Recovery:** unavailable current DEV/ref/owner means stop dependent writes and
  preserve local state. Retain failed diagnostics. Rollback is a scoped normal DEV
  revert proposal, not force/reset/ref deletion or an automatic production rollback.

## MAC-PLAN-20261024 — browser reliability planning

- **Objective/scope:** plan an evidence-led Mac harness repair, separate from the
  isolated CI mouse-drag assertion. No app/harness/test edit or new browser run is
  included in this planning authorization.
- **Plan:** [current Mac repair plan](plans/2026-10-24-mac-browser-repair.md);
  [immutable Q snapshot](https://github.com/raywu/handpan-cards/blob/98dafd8e5f69c0698da83cea2aac8a5324052c82/docs/plans/2026-10-24-mac-browser-repair.md),
  Git blob `28042b3620aa91dc625d9798eabd5e8916e9c6a4`, SHA256
  `dedd4ad1984ead3673b27e8f80f0541b0c13886dedfdfd839b20c1c50b4e9c1e`.
  Both independent engineering and design reviewers cleared this exact revision;
  the initial draft-status prose is historical, not missing review or runtime approval.
- **Coordination/owner:** root integrates; independent Mac author owns the plan.
  Root bus is the retained P reference above. Host `ray-Mac`; worktree
  `/private/tmp/handpan-continuity.pcdoqu/mac-repair-plan`; branch
  `codex/mac-repair-plan-20261024`, base main e314 (full SHA above).
- **Last confirmed:** current helper/harness/e2e source matches the earlier
  diagnosis source; this preserves evidence relevance, not fresh runtime success.
  Prior full Mac run exceeded900s; targeted20 passed. A-B-A supports activation
  mitigation for one isolated rAF stall only. Four viewport/keyboard assertions
  and the separate CI drag failure have no common cause established.
- **Next:** verify delivery and review receipts against exact Q source. Report
  pending activation-boundary/fixture/deadline decisions and obtain separately
  scoped runtime authority before experiments. Do not implement a fix from this batch;
  any later repair needs scoped authority, meaningful red/green test and mutant,
  preserved background/lifecycle semantics, full Mac and exact-head Linux proof.
- **Evidence/recovery:** published planning sources/receipts are portable; old raw
  diagnostics under `/private/tmp/handpan-browser-parallel.HskZRy/evidence` are
  original-host-only. Missing raw evidence requires recovery/reproduction under
  appropriate scope, never a claimed green result. Preserve original dirty/locked
  worktrees and owned-resource cleanup boundaries.

## REL-20261024 — completed release and settled owner decisions

Main `e314f858acf3b36fd01ebfcc9e7db37fa46857ef`, DEV synchronization
`e3473d601dd5916afeef834afea12730efbf3795`, tree
`259e1f13126ad4e8e4b2727598333d18d30a05e1`. Explicitly operated order:
548→554→559→567, then DEV569. Redundant558/560/564 were marked merged by included
ancestry; they were not separate integrator merge commands.

[Final immutable release receipt](https://github.com/raywu/handpan-cards/pull/569#issuecomment-6392985988):
actual-main CI40157160794 all12 jobs passed,853app/475browser/274Python,
2228JS tests,1468mutants killed, zero skip/cancel/bad verdicts. Production48/48
and15resources passed with independent evidence review. DEV15resources/newdocs/
noindex passed; prior actual DEV48b76 was reused under exact unchanged runtime
identity for the docs-only sync. No new DEV48 was invented.

Settled: German capital Du/Dir/Dich/Dein, “das Ding”; other languages use natural
friendly respectful local conventions; community handpan terms where appropriate;
seven ordering/renumbering messages included; Freestyle means high chord tone/upper
voice. UI translation only; English A–G/accidentals/octaves/bracket grammar,
engine/parser, user data and names remain unchanged. Owner current QA reply:
“Verified. All good.” Do not re-interview those decisions.

Only the two explicitly approved seat-order/Resources factual CLAUDE patches were
released. No further CLAUDE edit or main consent is inherited. The
[pinned Cloudflare delivery amendment](https://github.com/raywu/handpan-cards/pull/548#issuecomment-6392753976)
accounts for exact application bytes plus one frozen insertion; original raw-source
failures remain failed evidence. Headless evidence and owner QA do not establish
unspecified device coverage or a repaired full Mac suite.
