# SPS coordination

## Goal

Deliver the approved optional Scale↔Layout touch shortcut through DEV without
regressing selection, scrolling, lip, controls, existing entry routes or feedback.
NON-goals: parser/engine/data/geometry/CSS/copy changes, global/CDP changes, main
release or CLAUDE.md edits. Owner approved feedback first then SPS through DEV;
feedback independently delivered atbccff5a2, completing that prerequisite.

## Cycle state — current before historical snapshots

Current tested source2a6852b2e1432781238bc7e9dae20c113343508a, app index SHA256
25e740adff69d962299b6642fa99839cbe814d4e076839486120f24870c57a92. Guard954fc761
(original792f15b5) follows verified3unit+1native assertion-RED. After guard all40SPS
unit groups/full913app/5helper passed; final same-head5native gates now allPASS,
0fail/skip/cancel/timeout/raw errors,10AddEdit route cells and4actual-origin zoom
cells. Native scroll65px, quiet scroll92pxat107ms, capture order and BODY focus
verified. Supervisor/before-after census preserved Chrome680/7priorprofiles.
Receipts/raw logs in sibling evidence/: guard-unit-default-verified.json,
native-five-final-verified.json and sps-native-five-final-a0.*. No actual viewport
panning or physical Safari/native-keyboard behavior is established.

Retain earlier4pass1fail native run and diagnostic1fail. At restored1x, a point
hit-tested to body but realtouch targeted nearby tabbutton6pxaway; same rects and
offsets rule out the hypothesized geometry drift for that run. Browser touch
adjustment is consistent with evidence, exact internal mechanism unverified. T's
diagnostic33a98564 then zoom-test-only24pxclearance2a6852b2 preserves every actual-
origin/scale/transition assertion and touchradius; no app correction was made.
Same1case and final5case matrix green. A raw-audit regex initially matched the
passing title 'passive registrations'; corrected error matching after inspecting
raw output, no test changed. Both failed runs remain failed, not aggregate success.

M lane now active in /private/tmp/handpan-sps-z8gaznu2/mutants-final, branch
codex/sheet-tab-swipe-mutants-final-20261025, committed baseline2a6852b2. Agent
sps_mutation_author_final owns ONLY generated tests/mutants patches:40newunit+
5native target coverage, preserving existing5fixture patches,8old context refreshes
with every original header/semantic fault intact. No worker tests/browser/remote
writes. Root next reviews/freeze exact headers and proves cleanheadergreen then
intended assertionred on disposable trees; no untested kill credited. All old
floors retained until observed counts are raised by root. Final independent
source/design review, full exact-headCI/DEV and physical ownerQA still required.
NoSPSPR/CI/DEV/main delivery yet; root alone owns browser lease/integration.

Parallel DUPLICATE-NOTES plan585fa248 independently ENG/design-cleared after4fixes;
source43486f5d, docs PR579 mainHELD/580DEV under fullCI. Planning only. SEO578ac97,
feedback576bcc and Mac574f5 delivered; main577/575/573held. Preserve newer DEV ledger
records during integration. Resolve live refs before recovery/takeover.

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
SHA256ed8dae7bcae3951a3db7c2f2f75fd9304693b2b0fc7517a1ccff965b34a4bd8e.
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

## Fixture gate and bounded source clarification

Helper oracle commit9d693981 was executed before helper implementation:5selected,
4 expected assertion failures and1 compatibility pass,0skip/cancel/startup errors.
Minimal26line opt-in fixture commit48ab06fc then passed the unchanged5oracles and
all873default app tests,0fail/skip/cancel/raw errors. Application bytes unchanged.
Root receipts are under sibling evidence/, helper-oracle-red-verified.json and
fixture-green-default-verified.json; root owns execution and oracle acceptance.

A's read-only preflight found outer .sheetsurf scrolling and viewport events that
could shorten quietUntil. Revised amendment SHA256
4378e805bb48a237ce3a6ef924d1c1b9c47fee7dcdd50dc2bd75dfc5f244ad3b adds
same8px outer-scroll sticky cancellation, public-event never-shortened220ms proof
and inclusive24px edge boundary. Fresh ENG/design rechecks both cleared this exact
revision; original constants/recognition surface/nativeQA/main/CLAUDE gates intact.
Next T authors/freeze primary feature pair only; root executes expected assertion-
red on unchanged app, then A may implement while T expands independent SPS1–8 tests.

Parallel SEO documentation delivery is complete on DEV578 ac97a9d6; immutableplan,
research and tracking are available in the shared DEV ledger. It adds only7docs
and preserves feedback app/engine/data, source reviewed/CI/actual bytes verified.
SEO content/app/provider implementation remains unapproved. Current SPS branch
starts from earlier verified feedbackDEVbcc; preserve later SEO records on DEV
integration, and resolve current refs rather than treating this snapshot as tip.

## New parallel planning request

DUPLICATE-NOTES is planning-only on codex/duplicate-notes-plan-20261025, retained
source2f01c3ac; [prompt/ledger checkpoint](https://github.com/raywu/handpan-cards/blob/2f01c3ac/docs/WORKSTREAMS.md).
Owner asks duplicates accepted with warning; exact scope/voicing/warning interview
pending. Separate core/engine/UX worktrees and source-reviewed prompt are used;
no duplicate-note app/engine/record/share implementation is authorized. Preserve
this stream and completed SEO in later DEV ledger merges. Future audit stays queued.
