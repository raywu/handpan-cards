# Owner decision update — 2026-10-25

Owner answered the three original interview questions: allow exact duplicates in
all physical positions including matching Ding; choose one position per chord tone;
nonblocking warning naming note/positions, no confirmation. This supersedes older
pending labels for those three items, including the replacement voicing question.
Existing all-position diagram highlighting and unrelated validation remain.
Warning coverage (newly admitted cases versus all repeats), detail presentation,
protocol/recovery and performance contracts remain unresolved. No implementation
approval was given. The previously reviewed body585fa248 is retained at43486f5d;
this update records owner confirmations of its recommended choices.

Planning delivery complete: DEV580 merge667bbf8b; fullCI40227969263 and8servedbytes/
noindex independently verified. Final receipt:
https://github.com/raywu/handpan-cards/pull/579#issuecomment-6402685930
Further decision-ledger updates are feature checkpoints until next gated DEV batch.

# DUPLICATE-NOTES coordination

## Cycle state — current before historical snapshots

Research and independent plan review are complete. Final plan SHA256
585fa248cb1271d271b4c0a47ba89df0345c9fc42f73b51460e7ca2352f5db7c cleared fresh
non-author ENG and design rechecks. No feature implementation or regression success
is claimed. Next root publishes final docs/ledger through independent delivery
review/fullCI/DEV verification, then this planning stream awaits separate feature
implementation approval and unresolved behavioral/protocol/performance choices.

| Independent review | Initial finding / revision | Exact final recheck |
|---|---|---|
| duplicate_plan_eng_audit | Zero-card parse-valid controls must retain musical refusal before registry/storage/selection mutation; split lower-ID tone tie from highest-ID bottom-only HOME tie; freeze numeric performance thresholds/protocol before implementation. | All3 addressed, no remaining material ENG omission at585fa248. Read-only source review; no tests executed. |
| duplicate_plan_design_audit | Count-only summary must expose complete duplicate relationships, not rely on position labels; select bounded accessible grouped detail before UI implementation. | Addressed; no remaining material design finding at585fa248. No browser/AT execution. |

Three independent research contexts completed in separate owned worktrees. Root
retained core744feb3b and UX7dfd2127; engine note SHA256
4db7cfb6980f0b6497ef0086e288e402f565480f460dacf9b596e9d95e8e7b85 is byte-exact
from its author. Initial plan SHA256
81655b49dcc84dc2cf28128faab737cd4b1c3a8c4c7513841546d69184bcd1e7 received the
findings above; final plan retains source-backed fixes. Prompt V2 remains frozen.
Pending interview defaults are recommendations, not owner answers.

| Lane | Actual host-local tree / branch | Completed artifact / boundary |
|---|---|---|
| Core/identity | /private/tmp/handpan-duplicate-notes-qgvz59ns/core; codex/duplicate-notes-core-research-20261025 | core research original2837b001, retained744feb3b |
| Engine/layout | /private/tmp/handpan-duplicate-notes-qgvz59ns/engine; codex/duplicate-notes-engine-research-20261025 | engine note exact SHA above; root retains/publishes it |
| UX/warnings | /private/tmp/handpan-duplicate-notes-qgvz59ns/ux; codex/duplicate-notes-ux-research-20261025 | UX originalee76d89a, retained7dfd2127 |
| Independent review | duplicate_plan_eng_audit / duplicate_plan_design_audit; report-only contexts | Exact first-plan review; no code/browser/remote writes |

Ownership must be rechecked before takeover. Temporary diagnostics are not portable
proof; source notes and named retained refs are the recovery evidence. All streams
are indexed in [shared ledger](../WORKSTREAMS.md); remote DEV is canonical only
once the normal publication gate completes. Original snapshots below are history.

## Goal

Produce an independently reviewed, source-backed plan to permit repeated physical
instances of the same resolved note with non-blocking warnings. Assess technical/
UX feasibility and interview material choices. NON-goals: implementation, validator/
engine/wire/record changes, app/tests, raw screenshot publication, CLAUDE/global
changes, installs/provider changes and main release.

## Hard rules

1. Root alone integrates/publishes authorized docs and nonsecret recovery reports.
2. Root alone owns coordination, synthesis, plan and shared ledger.
3. Research writers use separate worktrees and disjoint notes; no shared editor tree.
4. No browsers, deployment, installs or owner-profile access during this research.
5. Claims retain source/classification; no untested compatibility/no-regression promises.
6. Plans get independent ENG/design review and material revision rechecks.
7. On errors retain goal/scope/evidence, report the blocker and continue independent
   safe research; never weaken checks, discard work or silently deduplicate notes.

## Source and authority

Owner requested planning/prompt/reviews and explicitly requires all streams tracked.
Screenshot privately inspected: bottom E4 occurs twice; current UI rejects it and
holds a Not updated line. Do not publish the photo/instrument name. Fresh remote
DEVac97a9d60edadc73b8766ec3f514de909eeb05cf observed before creating this checkout.
Rootworktree /private/tmp/handpan-duplicate-notes-qgvz59ns/planning, branch
codex/duplicate-notes-plan-20261025. Original dirty/locked trees remain untouched.

[Prompt](../prompts/2026-10-25-duplicate-notes-plan.md) V1 SHA256
625f0329b1dc6efa7652eb30d13fe9bae718d5e67f3838e70a8db58357a3b176 was independently critiqued before research execution and retained at8790e1b9.
V2 SHA256be2677f0f32e23a1ae4ccda2ad3c07c711eed7c24e938b41c063dcc192dec3cb
incorporates all material findings and independently cleared prompt recheck.
No final plan or research completion is claimed yet.

## Ownership and sequence

| Lane | Ownership | State / next |
|---|---|---|
| Root | prompt/plan/coordination/ledger | draft prompt, then freeze after critique |
| Prompt reviewer | report only | independent omission/feasibility critique |
| Core/identity | separate research worktree, unique note | assign after frozen prompt |
| Engine/layout | separate research worktree, unique note | assign after frozen prompt |
| UX/warnings | separate research worktree, unique note | assign after frozen prompt |
| Fresh ENG/design | reports only | exact subplan review after synthesis |

Sequence: prompt critique→revision/hash freeze→separate research contexts/worktrees
→root source reconciliation and subplan→fresh ENG/design review→fix/recheck→shared
DEV ledger delivery→owner decisions/separate implementation permission. Max3workers
plusroot. Forecast3research runs+prompt critique+2plan reviews and bounded rechecks;
zero browser jobs/test suites during planning, normal documentation delivery CI.

## Handoff queue (append-only)

| # | From | Ask | Status |
|---|---|---|---|
| 1 | Root | Owner scope: exact duplicates all surfaces/Ding versus narrower scope | OPEN |
| 2 | Root | Owner chord position/alternative-fingering policy | OPEN |
| 3 | Root | Owner warning/confirmation preference | OPEN |

Defaults are provisional; AFK is not an interview answer or implementation grant.
Current unrelated grammar/range/capacity and English note-input rules remain.

## Other workstreams / recovery

SEO-LONGTAIL reviewed subplan delivered DEV578ac97; no content implementation.
Feedback delivered DEV576bcc; main575held. Mac delivered DEV574; main573held.
SPS is authorized active implementation in its isolated branch/worktrees; resolve
codex/sheet-tab-swipe-20261025 and live571 reporting thread for current gate/source.
No SPS or SEO code is part of this new planning authority. Broader queued SEO and
queue-empty general code/test audit retain their existing gates. Resolve liveDEV
and refs before resuming; local paths are not portable takeover authorization.

## Prompt critique and freeze

| Finding | Source / resolution |
|---|---|
| Existing equal-MIDI tie priority must remain | voicing.js80–90 prefers upper shell then field ID; V2 requires pinned accepted unison outputs and deterministic new-copy policy. |
| Imported mentions are not automatically physical copies | importer.js520–543 distinguishes repetition/cross-shell/conflicting lists; V2 requires provenance and preserved ambiguity safeguards. |
| Do not invent a note cap | ENGINE-SPEC.md480 retires ring/total caps; V2 distinguishes legacy/wire/resource limits and forbids new hard cap without approval. |
| Intended semantic delta versus old invalid tests | V2 distinguishes new duplicate acceptance from unrelated malformed/legacy refusal cases and explicitly versioned meanings. |

Independent reviewer duplicate_prompt_review cleared exact V2 after recheck with
no remaining material prompt omissions. Near10/10 is an objective coverage/review
target, no numeric quality score or no-regression guarantee. Next assign isolated
research worktrees at this frozen source; owner interview remains pending.

## Pending decisions — current interview and implementation entry gate

Initial question2 mixed diagram highlighting and voicing alternatives; it was
explicitly replaced after source inspection. Preserve the settled distinction:
diagrams already highlight all matching fields, written voicings select one perPC.
The current pending questions are all-zone/equal-Ding scope, current voicing versus
alternate-fingering feature, nonblocking no-ack warning, and warning coverage only
newly admitted cases versus all repeats. Recommendations in the plan are not owner
answers. Grouped-detail presentation, exact protocol/old-writer recovery contract
and numeric performance thresholds are mandatory StageA decisions after scoped
implementation approval. Existing cross-shell unisons/grammar/inference and
English note input remain protected. Nothing in ledger publication grants code.
