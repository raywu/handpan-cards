# SPS coordination

## Goal

Deliver the approved optional Scale↔Layout touch shortcut through DEV without
regressing selection, scrolling, lip, controls, existing entry routes or feedback.
NON-goals: parser/engine/data/geometry/CSS/copy changes, global/CDP changes, main
release or CLAUDE.md edits. Owner approved feedback first then SPS through DEV;
feedback independently delivered atbccff5a2, completing that prerequisite.

## Hard rules

1. Root alone integrates and operates the one host-browser lease; no worker deploys.
2. Root alone writes coordination/plan/ledger/floor integration records.
3. File ownership and separate editor worktrees; report dependencies, never cross-edit.
4. No deployment mid-batch, global changes or app scope expansion.
5. PR-based delivery, independent final review and full exact-headCI before DEV.
6. Local/browser/CI/physical evidence are distinct; inspect raw errors and counts.
7. On errors preserve goal/scope, retain evidence, adjust smallest approach and
   report blockers while continuing unblocked work. Never weaken tests/floors.
8. No main release without explicit consent; no CLAUDE exact diff without approval.

## Plans and source

[Original approved swipe contract](2026-10-25-sheet-tab-swipe.md), body at21760907
SHA2564f133ae01efc9f99add6fd62e6a7089c382a43521b77ab0dae7a447553e3c57c.
[Bounded fixture amendment](2026-10-25-sheet-tab-swipe-fixtures.md), final
SHA2566bb31bdd0c8da757eb583a644ebcd0a2a7116dbaf0ca4a090e47548308fe7189.
Fresh engineering/design reviews independently cleared that exact amendment.
ENG finding added helper-red→minimalfixture-green/defaultregression→feature-red→
app edit gates; design contract unchanged. No helper/app implementation yet.

Base DEVbccff5a2b9ffd88f772517740cbab3ea66a50fbb, appsourcea90fce8c,
validated feedbacktree141a2807. Rootintegration:
/private/tmp/handpan-sps-z8gaznu2/integration, branchcodex/sheet-tab-swipe-20261025.

## Ownership

| Lane | Worktree / branch | Owns | Never touches |
|---|---|---|---|
| I root | integration / codex/sheet-tab-swipe-20261025 | plans/coordination/ledger/applicable floors and integration | globals/CLAUDE/main |
| T | tests / codex/sheet-tab-swipe-tests-20261025 | tools/sandbox.js; tests/app.test.js, tests/e2e.test.js, tests/sandbox_events.test.js | index/CDP/engine/floors |
| A | app / codex/sheet-tab-swipe-app-20261025 | index.html existing app sheet/tab/lip block | tests/helper/CSS/copy/engine |
| M | later committed scratch | generated sps_* mutant patches | live editors/app/helper source |
| R | read-only contexts | independent reports | all file/browser/remote mutations |

T/A trees are created at the same reviewed plan commit before their authors start.
No parallel editors share a worktree. Root retains source/head ownership receipts.
Forecast: two author runs plus mutant and independent reviewers, bounced rechecks
as needed; one final full CI candidate after local gates. Max three workers+root,
browser jobs serialized. This is native independent context execution, not a claim
of full original /swarm runtime/provider/model parity.

## Sequencing and briefings

1. T authors only helper oracle tests, freezes names/counts and stops. Root proves
   intended assertion-red on unchanged sandbox; startup/selection errors fail gate.
2. T makes minimal opt-in body fixture. Root proves same green/default whole-app
   compatibility; feature application bytes remain basea90.
3. T authors original SPS1–8 contract tests and exact primary pair. Root proves
   expected feature assertion-red on unchanged app. Preserved negatives may pass.
4. A implements minimal recognizer only after root grant, no event-framework rewrite.
5. Root integrates tests/app serially, proves samegreen; M generates real faults
   and root proves cleanheadergreen/assertionred; update observed floors.
6. Independent final source/interaction review, address findings, full exact-head
   CI, combinedDEV/source gate, actualDEV bytes/journeys, new native owner QA.

Acceptance commands are assigned by root after exact tests are frozen, not chosen
or narrowed by authors after failure. Raw suite/registration errors invalidate a
run even when summary/exit looks green. Full Mac/Safari/device limitations persist.

## Status

2026-10-25: amendment reviewed; no code changes. T next helper oracles only; A waits
read-only for valid primary feature-red. Root publishes plan/ownership checkpoint.

## Handoff queue (append-only)

| # | From | Ask / resolution | Status |
|---|---|---|---|
| 1 | Preflight | Missing sandbox body/capture/focus fidelity; bounded opt-in body plus explicitly modeled unit order and realCDP proof, no app compensation. | RESOLVED |
| 2 | ENG review | Helper's own red gate missing; added two-stageTDD in exact6bb amendment and recheckedclear. | RESOLVED |
| 3 | Root | New swipe-specific native Safari/keyboard/edge/selection/controlclick/smoothness QA after DEV; original historical baseline acceptance remains credited. | OPEN |
| 4 | Root | Any exact CLAUDE documentation diff needs separate owner consent; no current edit. | OPEN |

## Recovery

Resolve current remote DEV ledger and live advertised branch/PR/head/reviews before
continuation; local paths are host-specific. Root public reporting thread is571;
feedback final delivery proof is575#issuecomment-6401041842. Preserve dirty/locked
original trees. Unknown ownership stops dependent writes, never reset/unlock/kill.
