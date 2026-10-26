# Shared workstream ledger

[All-workstream status and future queue](plans/2026-10-25-workstream-status.md)
reconciles current live refs, delivered/held releases, historical completions and
queued prompts/plans. Local checkpoint is ahead of canonical DEV publication.

## Queued next-release app change — PALETTE-DEFAULTS-10

Owner request2026-10-26: expose the existing D KURD10 and D AMARA10 colour pairs,
and each role-swapped inverse, in the built-in palette selector. Add options;
retain existing six palette identities and the current new-scale default. Source
colours are canonical data, not newly designed substitutes. Inversion means
root/tone role swap as in the current palette pairs; it does not mirror the pan
or change musical voicings. No seeded geometry/note/chord/data edits are implied.

**Priority:** fast-track after the already-active authorized workstreams, aiming
for the next main release. Saved variants keeps priority; Helpers and existing
swipe obligations keep their established sequence. This does not resume paused
notes, elevate this task over existing work, or authorize a main merge. Plan now
in a separate documentation lane; application implementation has not begun.

Deliverables: [iterated planning prompt](prompts/2026-10-26-built-in-palette-defaults.md)
and [engineering/design-reviewed swarm plan](plans/2026-10-26-built-in-palette-defaults.md).
Review actual share-link/storage/version boundaries and 10-swatch mobile fit before
calling this a quick change. A speed target cannot waive compatibility, TDD,
mutants, independent review, exact-head CI or servedDEV/owner QA. Any necessary
CLAUDE.md patch must be presented exactly for explicit owner approval; no actual
CLAUDE edit is included in this planning task.

Recovery lane: branchcodex/palette-defaults-plan-20261026,
worktree/private/tmp/handpan-palette-defaults-plan.20261026, investigationbase0d36b1f4.
Current step COMPLETED: V1→V2 prompt refinements, independent ENG/design prompt
critique, accepted prompt execution, independent output-plan ENG/design reviews,
Cancel/draft plus compatibility revisions, and both re-review CLEAR at5c5a1f3d.
Owner approved queued throughDEV implementation and the exact paletteparagraph
CLAUDE packet at a41a3bb7. Activation remains AFTER preceding activework; verify
packet continuity and do not ask for the same approval again. Actual10-choice fit/behavior is untested.
Next publish immutable plan/ledger refs in existing coordination thread. Do not merge this investigationbase
(which contains unshipped saved variants) into DEV merely to deliver documents;
use a documentation-only publication path or the appropriate approved delivery.

## Check-in reporting requirement

Owner clarified that every check-in must cover active development, interrupted
work, DEV deliveries awaiting main, completed/released work, and upcoming prompts
and plans. Give each workstream a plain-language one-sentence description plus
current status and next step; PR numbers alone are not a status report. Preserve
settled decisions and interview only genuine unresolved decisions/blockers.
Do not change CLAUDE.md to install this clarification without exact approval.

## Owner decision — duplicate notes paused

PR579 / DUPLICATE-NOTES is **PAUSED UNTIL FURTHER NOTICE**. Preserve its finalized
plan, prompt, research, settled choices and review evidence. Do not resume plan
work, feature implementation or main release until the owner explicitly resumes
it. This is not cancellation; do not discard its worktree or artifacts. Other
workstreams retain their own authorization; no main release is implied.

## Current priority — SAVED-SCALE-VARIANTS, authorized through DEV

Latest check-in: owner explicitly selected **keep573→575→577→579→581main releases
held; finish saved variants first**. Read-only live PR states verified OPEN/DRAFT.
S backend b425/indexf90 independently reviewed, edge6GREEN and C10model10PASS.
V2 backend profiling completed: 120/120 acknowledged samples (30 each at 2/20/200
records and an exact final 1MiB envelope), independently audited CLEAR; callback
p95/max milliseconds: .6/.6, .7/.7, 1.6/1.7, 4.1/4.1. These are pre-UI API-ACK
measurements, not disk-flush or UI-paint claims.
Current old-adapter source SHA `d449ea31ca2a5ebcf54d75471d1a61fe54ae8c4fdcc33bc2cc5e517d02923dc0`.
Its latest complete unit run passed926/926; harness51/51 passed. Those results
predate the transactional adapter and are historical, not a release gate for it.

**P0 release blocker:** native distinct concurrent imports both acknowledged
revision2, but only the later entry survived. Source-pinned tracing confirmed
nonoverlapping Web Lock callbacks and a stale second-renderer localStorage read.
The independently ENG/design-cleared [transactional storage amendment](plans/2026-10-25-saved-variants-transactional-storage.md)
replaces that unshipped adapter with one authoritative IndexedDB transaction,
retaining the approved product/schema/session/data-preservation contract. Root
executes this already-planned internal alternative under through-DEV and
reaffirmed AFK authority; no CLAUDE change/install/main merge.

## Latest recovery checkpoint — 2026-10-26, after held-mouse repair

This checkpoint supersedes pending/blocking labels in the chronological notes
below. Saved variants remains first; DEV delivery and all main releases remain
held. Branch `codex/saved-scale-variants-20261025`, integration worktree
`/private/tmp/handpan-saved-variants.HVUKbE/integration`; plan and raw-proof links:
[held-mouse repair](plans/2026-10-26-held-mouse-capture-helper-repair.md) and
[gesture gates](plans/2026-10-26-saved-variants-gesture-gates.md).

- Runtime index SHA3b07a272 is unchanged. A minimal native fixture independently
  proves the separate CDP held-mouse capture defect; the one-field helper3369
  repair has intended capture RED→GREEN→fault→restored, full harness67/67 and
  affected native18/18 passing. Existing Q15 clean/fault/restored is also proven.
  All1617 fault patches apply; original intermittent post-drag cause remains
  unproven. Passing targeted tests does not establish that cause or full CI.
- Latest completed full CI40358865648 at3239eafd failed:487/488 native pass and
  one Q15 mutation survivor; all other jobs/shards passed. The reviewed local
  helper/test changes above are not yet validated by exact-head full CI. Next
  publish that immutable candidate and run the full required validate workflow.
- Fresh helper3369 selection profiling: empty/2/20-record cases pass; the
  200-record case stops at retained row121 (first phone/candidate sample), where
  firstRAF equals secondRAF244.932. Both callbacks progressed; strict increasing
  RAF guard correctly fails. No timing waiver, row exclusion or inferred rounding
  error. Historical720 old-helper rows do not supersede this current failed run.
  Cause is unresolved; low free memory is not causal proof. The independently
  reviewed one-shot pure-data clock control also failed at retained row25 because
  captureAt equaled firstCallbackAt, yielding a zero dispatch-to-frame interval.
  It stopped with owned cleanup true; no200-record rerun is allowed by that
  protocol. This is a separate timing-sanity failure, not a repeat of equalRAF
  nor an explanation of the app result. Performance gate remains held for
  independent assessment; no retries/waiver. Backend refresh has not run.
- Independently ENG/design-cleared [timing-oracle correction](plans/2026-10-26-saved-variants-timing-oracle.md)
  completed isolated timing-tests/timing-source TDD: intended validzero pureVM
  RED/GREEN/generatedfault/restored, fullapp939, metadata54 and all1618apply pass.
  Probe bd6 accepts raw0 only for the unbudgeted diagnostic; every actual response/
  frame/sample budget remains strict. Independently accepted v2control90/90 pass.
  The ONE current200 campaign FAILED after17rows during baseline sample18, before
  candidate loaded, at the unchanged5s observer wait. Cleanup true; no comparisons.
  **Performance remains INCOMPLETE/HELD, no more automatic measurement retries.**
  Cause unknown; new reviewed failure-only diagnostics and explicit environment/
  budget decision are needed before furthermeasurement. See linked plan/receipts.
  Current exacthead fullCI is separate:2ff71cf5 has all4mutation shards/aggregate,
  data/Python/bothfit PASS while JS still runs; this tool/test amendment still
  needs its own finalhead validate. No DEV delivery is claimed.
- Helpers remains a separate approved branch/worktree
  `codex/helpers-integration-20261026` /
  `/private/tmp/handpan-helpers.HUZs5u/integration`. Old2f4db8af CI failed two
  native checks despite all1513 mutants and other jobs passing. Reviewed two-line
  labels/current-font setup amendment is in local TDD. Its first combined run
  passes five checks but exposes extra CJK line counts; investigate before
  further source changes. Not delivered to DEV; never fold a failing Helpers
  candidate into priority saved variants.
- Owner recommendations are accepted: Helpers through DEV including only the
  exact Resources CLAUDE packet; SEO design at `/learn/`; owner musical review
  of pilot articles. SEO remains planning-only. No main merge is authorized.

### Earlier continuation checkpoints — historical, preserve evidence

2026-10-26 continuation checkpoint:
- **Current local interaction repair:** native causal RED confirmed that a
  preference acknowledgment could detach a pressed scale chip before release.
  Reviewed source c55aab4e preserves chip nodes for unchanged visible collection
  and selection; native causal GREEN and all938 app tests pass. Targeted tier,
  Pygmy, deck-switch and new held-chip cases pass. The post-drag browser case
  remains unresolved: instrumented isolated passes do not override the original
  combined-run failure. Source-pinned refreshed selection/backend campaigns report
  PASS; independent receipt audit and full exact-head CI/served DEV remain gates.
- **Owner decisions settled 2026-10-26:** Helpers implementation through DEV
  and its exact Resources-only CLAUDE patch are approved; separate test/markup
  lanes start from verifiedDEV6165c873 under /private/tmp/handpan-helpers.HUZs5u.
  Plan: docs/plans/2026-10-25-handpan-helpers.md. Root sole browser/integration;
  saved variants retains priority. Next release remains conditional on fit/tests/
  independent review/CI/servedDEV; no main grant. SEO publishing design uses
  handpan.raywu.org/learn/ and owner reviews pilot musical accuracy. SEO articles,
  publishing/provider/app implementation remain unauthorized.
- **Fresh check-in:** full validate40320711507 at6a691c68 completed FAILURE.
  Every unit file, Python, data and real/fallback panel fit passed. Browser487 ran:
  485pass/2fail, zero skipped. Remaining native failures are generated-scale tier
  Settings reopening and Pygmy bottom-swap fixture lookup. Mutation shard2 passes;
  shard1 has surviving d_resave_drops_replaces, shard3 clean deck-switch baseline
  fails, shard4 clean post-drag-click baseline fails. Preserve failed logs under
  evidence/ci-40320711507-*. No DEV delivery/main release. Next: causal diagnosis
  and reviewed repairs, not weaker assertions or successful-retry-only claims.
- **Current CI blocker:** final-head run40320711507 at6a691c68 rejected the
  clean "deck chips switch the deck" baseline (Hijaz19 expected, priorAmara27
  remained). Independent source review identifies a plausible real lost-click
  path: preference ACK/no-op reconciliation rebuilds chip nodes between press and
  release. Do not hide it by draining preferences in the ordinary switching test.
  Native causal diagnostic authoring was interrupted by model capacity before
  producing a runnable draft; next lane/root should author and independently review
  the bounded real-ACK/held-pointer reproduction before any runtime change. Earlier
  fixture repairs remain valid; fullCI and actual DEV still block delivery.
- **Latest final local checkpoint:** full app937, preview14/PDF43, all10 seat
  sweep groups and17 affected native cases pass after reviewed fixture repairs.
  Metadata54/54, suite/CI Python36/36 and all1614 apply checks pass. Independent
  intended-assertion proofs cover3 VM groups, all10 seat groups, SU boot-message
  and native live-mouse guards. Runtime remainsab90; app tests63e7/native6fba.
  Floor487 reflects the observed original full count; final LinuxCI/DEV remain
  gates. The older failed CI checkpoints below are historical, not current claims.
- **Current delivery blocker:** exact-head Linux validate40312402295 at65e29107
  found obsolete native collision-veto and unselected aria-label expectations.
  Four mutation shards reject clean baselines; data, Python and both panel-fit
  jobs pass. Full JS job still running. DEV584 remains unmerged; CI-only draft583
  must never merge main. Independent ENG/design-cleared
  [test-only native contract refresh](plans/2026-10-26-saved-variants-native-contract-refresh.md)
  preserves six real build-refusal protections and accessibility checks. Separate
  test/fault repair is locally complete; sourceab90 stays frozen. Seven native
  cases and seven independently audited exact-header proof pairs pass; metadata54
  and all1603 apply checks pass. Next: full final CI, then actual DEV verification.
  Earlier local successes do not pass CI.
- Final metadata caught canonical data-patch context constraints missed by the
  postimage audit. Restore13 original generated data-patch representations after
  exact postimage equivalence; independently cleared. Refreshed metadata54/54
  and suite/CI Python36/36 pass, with no source/test waiver.
- **Latest:** compatibility P1 is closed on final sourceab90;937app,66harness,
  refreshed7native/2capability arms/120backend samples all pass. Independent
  audits cleared all720 fresh selection rows/24Documents/eight comparisons under
  the unchanged frame budget. The a0 baseline clock failure is retained; reviewed
  1ns sanity precision fix changes no measured values or latency thresholds.
- All1600 original faults plus one compatibility fault are present; exact
  postimage/projection audits cleared all1601, with no dropped filenames or
  changed fault semantics. Full exact-head Linux corpus proof remains pending.
- Continue from the [reviewed local validation receipt](plans/2026-10-26-saved-variants-validation.md):
  final metadata/diff checks, CI-only held main-target draft plus same-head DEV PR,
  full actual validate, then actual served DEV verification. No feature DEV or
  main delivery is claimed by this local checkpoint. Exact source/tool hashes,
  raw locators, limitations and recovery procedure are in that receipt.

### Historical checkpoints — superseded by the latest results above

The entries below preserve investigations and stopping points. Their pending or
blocking labels describe the earlier checkpoint, not current readiness.

- **Resolved compatibility finding (formerly P1):** final independent ENG reproduced startup
  TypeError when Object.hasOwn is unavailable; baseline preserved that browser
  capability boundary. The independently ENG/design-cleared compatibility plan
  uses an app-local hasOwnProperty.call helper and meaningful missing-API TDD.
  No raised browser requirement/global polyfill/CLAUDE change. Earlier a394
  runtime receipts remain historical until refreshed against repaired source.
- Existing planned selection/frame gate remains unexecuted, separate from backend
  lock timing and geometry. Matched A–B–A protocol at empty/2/20/200 inputs and
  two viewports is specified in the selection-performance amendment; fixed
  actual-preference drains, math, quiet window and baseline-drift handling have
  been added for independent plan re-review. No timing success claimed.
- Complete1600-fault corpus now reconciled: M124 and R91 bulk audits independently
  CLEAR,178 nonbrowser proof pairs meaningful;36 retained native faults still
  require full final CI. Every1600 patch currently applies. Metadata checks pass:
  mutation harness54/54; suite/CI Python36/36. No faults dropped, physical/device
  QA/full Mac suite/main permission inferred. Through-DEV scope stays active.
- Current strengthened app tests
  `cf3a53203a49fdd24099c7406ba1b713963a4bd0fa0c95aac7731fc6bf2d9e53`
  pass936/936, zero skip/cancel,41.58s supervised. Four legacy assertion/fixture
  gaps repaired and direct/concurrent last-visible command coverage added; app
  source unchanged. Expected browser floor481 reflects the independently counted
  preserved455 literal titles plus the one new native deletion registration;
  actual full browser count is still a Linux CI gate, not a local full-Mac claim.
- Native7/7 and all120 benchmark samples independently audited CLEAR. Ten further
  unchanged SV6 E1 repetitions passed (each distinct and duplicate two-target
  imports),10.42s total with clean cleanup; still not exhaustive scheduling proof.
  Native deletion and lost-save fault patches have exact-header clean baselines
  and intended named assertion kills, no skip/cancel/timeout; app bytes restored.
- Mutation reconciliation: M124 isolated patches independently cleared,107
  nonbrowser proof pairs plus the root-proven new concurrency fault;16 others
  remain native author-only until final CI. R91 retained patches are completing
  current-test reproofs. No faults dropped; controlled validator/production throws
  are separately qualified rather than mislabeled as assertion errors. Integration
  corpus1600 including all new generated faults. All final exact-head CI/DEV
  gates remain pending; no feature DEV delivery or main grant.
- Transactional profiling completed120/120 acknowledged samples:30 each at2,
  20,200 records and exact1MiB final envelope, all source/Document/reset/count
  assertions passed. Async lock lifetime p95/max ms:2/14.9,1.7/2.1,1.9/2.8,
  5.2/5.9. All supervised jobs clean/no timeout; independent runtime audit pending.
  These API-transaction measurements are not disk flush or UI/frame timing.
- First combined native7 run exited cleanly with4PASS/3FAIL: copied layout,
  concurrent imports/dedup, RESET and deletion passed; three immediate lock-queue
  assumptions failed before async staging enqueued a request. Three bounded
  actual-queue waits independently reviewed, keeping exact counts/no-op guards/
  trusted input/deadlines. Corrected e2e source
  `9f26e4ae9e4dc6d08c14d770ffe9e4cbbe1e1120864f59c2e68ec93395702835`
  now under root's serialized rerun; no result claimed yet.
- Nine generated application protocol faults independently cleared: each exact
  clean baseline1PASS and intended named assertion kill, no skips/cancellations;
  all original source bytes restored. These supplement the fourteen model faults
  and browser-stderr fault, not full-corpus compatibility proof.
- Final adapter source `a394217ec15626d96455c1b746dfbf001578201c34dbb4e01461b3d019bd88bf`
  independently ENG-cleared after the fifth existing-only reopen repair. Exact
  native deletion probe now passes with absent database retained, no timeout and
  clean cleanup. Nine focused IDB groups pass on this source. Full935 result
  below belongs to its preceding four-fix source; final full CI remains required.
- Integrated scoped stderr repair plus refined owned-child fixture and generated
  fault: final fixture clean1PASS/mutant1ERR_ASSERTION, zero skip/cancel; complete
  harness66/66PASS, zero skip/cancel,10.82s supervised, cleanup true. Harness floor
  raised after actual66 observed. UI matrix/concurrency reruns remain pending.
- Transactional candidate source `7eba9b27158a460543c2fa18c05bee385fd177efe3bd152b2556693fcd54b489`
  plus app tests `7cd09396b7baa1670fb6562ace4140b918622d332203609232f16fdaa75fc8bb`
  now passes935/935 (zero skip/cancel). Four independent review findings received
  meaningful assertion RED then repair: owned connection retirement, visible
  reconciliation failure, acknowledged-publication guidance and newly appearing
  legacy-branch warning. App floor raised only after observed935 passes.
- Additional native recovery RED: after actual owned-profile database deletion,
  reconciliation recreated an empty schema outside the migration lock (1!==0,
  1.10s, no timeout, cleanup true). Fifth repair is active; no release clearance.
- Browser stderr-retirement amendment independently ENG/design reviewed; scoped
  helper `178e034c3d9395bd92a7250b50b8ec5858bb177bb6678e500870699701b50826`
  has meaningful unit RED→GREEN/generated assertion kill and independent source
  clearance. Diagnostic process now exits and cleans normally; original matrix
  rerun and final refined-fixture mutation proof remain pending.
- Integration `cd9d1e51` contains the independently reviewed explicit IDB model and
  minimal ENGINE-SPEC persistence amendment. Fourteen new model groups passed
  independent focused verification; native transaction activity is not modeled.
- T's corrected frozen regression checkpoint `e2009fd258986c9a46224c619bbbaf151e5cfef3fb096e9e85b4c2dc25e29251`
  produced two meaningful old-app assertion failures: save ACK without completed
  IDB commit, and stale localStorage B overriding authoritative IDB A. Invalid
  first setup attempts are retained and are not counted as RED evidence.
- `/idb-adapter` owns index.html; first candidate passes five new protocol groups,
  full unit checks/review still pending. `/idb-tests` owns committed-store oracle
  and native fixture ports; independent review requires boot-route completion
  barriers, final trailing-read outcome assertion and retained full legacy-store
  comparison. `/idb-model` owns fourteen generated fault proofs. All lane branches
  are `codex/saved-variants-idb-{adapter,tests,model}-20261026` under the root above.
- Root alone runs native browsers. Earlier copied-layout fresh-profile and stale
  Edit/delete passed; corrected RESET/reconciliation pair passed. UI matrix body
  completed48geometry/528control/16state checks, but the process did not exit;
  whole run remains failed. Source-pinned lifecycle observation confirms browser
  close and server close settle; open pipes remain under investigation. No
  timeout increase, weakened checks or physical iOS claim.
- Retained mutation checkpoint `45ef0edf` preserves46 UI reanchors separately:
  32 assertion kills,12 native-author-only and2 genuine survivors needing triage.
  Other44 unit proofs,46 context/data refreshes,29 policy drafts and5 native
  authored faults remain qualified pre-IDB work, not final-candidate proof.

Next: address test review, independently review adapter, prove real native
transaction/concurrency and cleanup, update bounded measurement, regenerate and
prove all relevant mutants, then exact-head full CI and actual DEV validation.
Not QA-ready; no DEV feature delivery. Main queue held; duplicate notes paused.



Owner explicitly approved the reviewed plan and its exact instruction/spec patch
through DEV on2026-10-25. This supersedes historical planning-only/interview-pending
labels below. No main merge, installs or global configuration changes authorized.

- Reviewed [plan](plans/2026-10-25-saved-scale-variants.md) SHA256
  `9a96ed6dc10f2598359efb5450e14de91239ecf39fa9664141ab2b45fc4346fb`;
  [exact approved packet](plans/2026-10-25-saved-variants-instruction-approval.md)
  `5d0700f76f734f63ae025ed2463b4d069d04f0842ca2cfa0d7e8e4916dfc9cda`,
  immutable planning ref `0e3499678a19b65181584ab21ef9b98b7bacb64d`.
- Accepted contract: distinct named/layout variants coexist; exact portable-meaning
  imports deduplicate; Edit changes only its selected stable instance; conflicts
  preserve drafts/winners; unsupported persistence is explicitly THIS-TAB session
  only. Existing recognized seeded RESET deletion/promotion remains.
- Root integration: branch `codex/saved-scale-variants-20261025`, host-local
  `/private/tmp/handpan-saved-variants.HVUKbE/integration`, based on accepted DEV
  `6165c8739f11c8d00c4b27ea6512ef1278275748`; planning history merged without
  app/test changes. Original dirty/locked checkout stays untouched.
- Root verified both exact source hashes and packet, checked the patch, then
  applied ONLY its CLAUDE.md and ENGINE-SPEC diff. Packet/plan remain immutable
  historical approval artifacts. Store implementation is now active in its isolated
  /store lane after reviewed acceptance RED; incomplete UI cannot reach DEV.
- Reserved: collection key `hpfc.saved-scales.v1`, envelope schema1, exclusive lock
  `handpan-cards:saved-scales:v1`. Wire6/record4 remain; DUP's candidate7/5 is not
  consumed or activated. DUP workstream and main PR579 are PAUSED UNTIL FURTHER NOTICE by owner; do not resume planning, implementation or release without explicit owner resumption.
- Current parallel lanes: S store implementation/T native acceptance repair;
  completed H support and M helper proof retained in /helper,/mutants. Separate
  /tests,/store trees under the stream root (branches recorded
  in coordination). H support amendment independently ENG-cleared after event-
  dispatch clarification. A1 proved12 required real HTTPS API checks; optional file
  navigation then failed, so whole run stays FAILED and file behavior unverified.
  Cleanup/census clear. Concrete schema9c56dce6 independently ENG-cleared after
  lifetime ID-history/slot-proof refinements; H50/app881/shipping177-card defaults
  PASS, prechange60selection baseline independently CLEAR (RAF opportunity only).
  T27e1085e corrected23unit groups independently cleared/qualified assertion RED;
  deeper backend branches not yet exercised. M12helperproof independently CLEAR,
  actual runner2/2kills/headerharness54PASS. Six native bodies bed1e06c unexecuted,
  ENG/design oracle repairs pending. Next S backend review/fault/measurement gates
  and native RED before exclusive U UI. Root alone runs browsers. Last full881PASS
  predates feature tests/source and is not a current-feature Green claim.
- Recovery: [coordination](plans/2026-10-25-saved-scale-variants-coordination.md)
  records last/next, ownership and evidence. Any larger contract or exact CLAUDE
  wording change requires renewed review/approval. Runtime/migration/concurrency/
  performance parity is not yet validated. No owner data/profile migration used.

### SHARE-CUSTOMIZATION-HOTFIX — delivered to DEV; main581 held

Source `92d6516bd533abb4a1e4fb7c8116b9836f648296`, branch
`codex/share-customization-hotfix-20261025`, host-local
`/private/tmp/handpan-share-hotfix.urAbvO/integration`. [Plan](plans/2026-10-25-share-customization-hotfix.md)
and [coordination](plans/2026-10-25-share-customization-hotfix-coordination.md)
retain intended8unit+2native RED→GREEN and failed first CI/protocol correction.
FullCI [40242635186](https://github.com/raywu/handpan-cards/actions/runs/40242635186)
independently audited CLEAR:2271JS/274Python/1510unique kills,8019cells each font
mode; zero required skips/failures. Synthetic CI tree equals source tree.
DEV [582](https://github.com/raywu/handpan-cards/pull/582) merged at
`6165c8739f11c8d00c4b27ea6512ef1278275748`, identical source tree.
Actual DEV:14resource hashes200 match immutable merged files; noindex;2required
native journeys PASS,8actual loaded-document request/frame/loader/body bindings
match appSHA256 `5628f31deed911e7e406ce852fe0daee5d6fcf1caa26d2fb0f182a823c0894b3`.
Supervisor exit0/no timeout/cleanup, zero skips/cancels and identical host census.
Independent delivery audit CLEAR. Raw host-local receipts under evidence/:
`shc-dev-delivery-a0.json`, `shc-dev-actual-a0.stdout.tap`, supervisor/census and
`shc-dev-actual-a0-root-verified.json`. HTTP receipts preserve hashes/statuses,
not all14raw bodies. A first postprocessor missed TAP escaping; corrected reader
inspected the SAME successful run, no browser retry.

Owner reported **all provided DEV QA steps passed** on2026-10-25 and supplied
before/after links. The after link carries explicit custom bottom angles and the
updated name; private payloads remain in the conversation. Device/browser details
were not supplied, so no specific physical-device matrix is inferred. This closes
the requested owner smoke QA for581, not saved-variants acceptance or proof of the
original missing-angle cause. Main [581](https://github.com/raywu/handpan-cards/pull/581)
remains DRAFT/HELD. Controlled API sinks/fallback fonts/Chromium only; no Safari/
native OS clipboard/share-picker claim. Prevents obsolete async LINK completion
UI; does not deliver saved variants or reproduce/explain the original omitted-
angle report. Owner confirmed SAVE and still-custom diagram; preserve that human
report. Latest valid customized link proves changed positions, unchanged inventory
identity; inventory-keyed replacement is a separate verified limitation.

### Preserved parallel/deferred streams

SPS remains deferred behind sharing/variants. Latest pushed root ref `3a8467ff`
on `codex/sheet-tab-swipe-20261025`, host-local
`/private/tmp/handpan-sps-z8gaznu2/integration`. All50 suite-header-only corrections
independently reviewed; no app/test/floor/body changes. Prior59 direct proof pairs
used shlex and do NOT establish real runner protocol parity. Next merge accepted
SHC base, faithful literal-header59 reproof, final review/fullCI/DEV/physical QA;
no SPS release/QA-ready claim. Old browser lease token is invalid; root owns lease.
DUP finalized reviewed technical plan SHA781540f4 retained at branch
`codex/duplicate-notes-plan-20261025`, latest `b849b6d6149e883ce4b280a2616fd20cf7b6a21e`.
All four answers settled (including warnings only newly allowed repeats); workstream/PR579 PAUSED UNTIL FURTHER NOTICE by owner (planning, implementation and release). Main573/575/577/579/581 remain held pending explicit main consent. Other
recovery tables below retain historical evidence; these current facts supersede
older pending approval/status labels without discarding their investigation.

## 2026-10-25 all-workstream recovery checkpoint

Newest checkpoint: remote DEV independently read at
`ac97a9d60edadc73b8766ec3f514de909eeb05cf`, main at
`96c4c589cec0950723b3b5323dc1df5bbc359329` on2026-10-25. This table supersedes
older status prose below; keep the historical evidence. This feature copy becomes
canonical only through reviewed DEV publication. Resolve live refs before resuming.
Root is integrator on ray-Mac. Each stream retains its own authority; AFK is not a
new scope, main-release or CLAUDE.md edit grant.

| Stream | Current state / evidence | Continuation / authority |
|---|---|---|
| DUPLICATE-NOTES | PAUSED UNTIL FURTHER NOTICE by owner; later pause supersedes historical continuation below. Three isolated research lanes complete; revised plan independently ENG/design-cleared at585fa248. [Plan](plans/2026-10-25-duplicate-notes.md), [coordination](plans/2026-10-25-duplicate-notes-coordination.md), detailed checkpoint below. | Publish independently cleared plan through fullCI/DEV gates. Owner scope/warning/voicing interviews pending; recommendations provisional. Planning only, no duplicate-note feature edits. |
| SPS / Scale↔Layout swipe | Active authorized implementation. Root branch `codex/sheet-tab-swipe-20261025` last pushed `0db6c02275e695537ccf8ec5461d70bc3aea2ad2`; host-local `/private/tmp/handpan-sps-z8gaznu2/integration`. [Retained plan](https://github.com/raywu/handpan-cards/blob/0db6c02275e695537ccf8ec5461d70bc3aea2ad2/docs/plans/2026-10-25-sheet-tab-swipe.md), [fixture amendment](https://github.com/raywu/handpan-cards/blob/0db6c02275e695537ccf8ec5461d70bc3aea2ad2/docs/plans/2026-10-25-sheet-tab-swipe-fixtures.md), [coordination](https://github.com/raywu/handpan-cards/blob/0db6c02275e695537ccf8ec5461d70bc3aea2ad2/docs/plans/2026-10-25-sheet-tab-swipe-coordination.md). | Primary2 TDD and bounded native route/tap/scroll/quiet/focus checks passed on prototype index97e498b9. New zoom guard has3unit+1native assertion-RED before code; A's minimal guard commit `792f15b566e345a09e9d2a38ba2b174286d5a4bd` is local, NOT yet integrated/green. Next integrate that exact guard, require same40unit/5native plus helper/default regressions, generated mutants/8preserved context refreshes, final review/fullCI/DEV. Physical Safari/keyboard/edge/selection/zoom QA remains. No SPS PR/CI/DEV success yet. |
| Latest-per-ring feedback | Complete through DEV576 `bccff5a2b9ffd88f772517740cbab3ea66a50fbb`; source `a90fce8c19887e44e6bbaf38741b97553b795026`. [Plan](plans/2026-10-25-layout-feedback.md), [final evidence/recovery](https://github.com/raywu/handpan-cards/pull/575#issuecomment-6401041842). Root tree `/private/tmp/handpan-feedback.ha43y5cy/integration`, branch `codex/layout-feedback-20261025`. | FullCI40216007898 and actual DEV verification complete. Earlier A0 registration error invalidated/retained; corrected A1 clean. Main575 HELD; do not redo delivered implementation or treat old pending prose as current. |
| MAC-M1 repair | Complete through DEV574 `f5df7942d097167013a3bf2baf05a6497ac73613`; source `217609075a14e6ca4799497210af27d9df842c5e`. [Plan](plans/2026-10-24-mac-browser-repair.md), [final receipt](https://github.com/raywu/handpan-cards/pull/573#issuecomment-6400445041). Root tree `/private/tmp/handpan-mac-repair.c94d3kno/integration`, branch `codex/mac-foreground-20261025`. | FullCI40209344599 and DEV bytes/print verified. Main573 HELD. Narrow opt-in foreground settle only; full Mac/M2/M3/C1 remain unverified/separate, not silently repaired. |
| SEO → SEO-LONGTAIL | Reviewed subplan delivered through DEV578 `ac97a9d60edadc73b8766ec3f514de909eeb05cf`; source `1c5344e05c4cf3dcc66f12bd61c1b6665e10303d`. [Subplan](plans/2026-10-25-seo-longtail-content.md), [coordination](plans/2026-10-25-seo-longtail-coordination.md), [delivery receipt](https://github.com/raywu/handpan-cards/pull/577#issuecomment-6401147051). Root tree `/private/tmp/handpan-seo-longtail.rpqmbt6_/planning`, branch `codex/seo-longtail-plan-20261025`. | FullCI40216920481 and served docs/noindex verified. Main577 HELD. Interview audience/scales, music reviewer, publishing home, budget and measurement; no content/generator/provider implementation or publishing authority. Broader SEO research remains separately queued. |
| DRY-LOCAL / BROWSER-RUNBOOK / released UI | Bounded reference/ledger batch released main570 at96c4c589 and synchronized via572; original runbook and Naturalness/HTC/i18n releases complete. [Release history](#rel-20261024--completed-release-and-settled-owner-decisions). Owner reported released UI verified/all good, exact device coverage unspecified. | Preserve Claude behavior and existing instructions. Global skill/runtime parity is not established by documentation. Do not rerun or reinstall. Further CLAUDE.md changes require explicit exact-diff approval. |
| NITS → OF-D / I18N-D / Q9 / CLEANUP | Relevance audit and recovered inventory retained; historical candidates are not current implementation grants. [Audit](plans/2026-10-25-plan-relevance-audit.md), [deep search](plans/2026-10-25-outstanding-plan-deep-search.md), [backlog](plans/2026-10-24-continuity-backlog.md). Feedback finding now delivered separately. | Revalidate remaining candidates and authorization; retain NITS→OF-D sequencing. No cleanup/discard/unlock/agent-rule edit. Owner-stopped Audio/stats/SM2/PWA scopes remain stopped. |
| Future robustness/code/test audit | [Explicit queued task](plans/2026-10-25-future-codebase-audit.md). | Start its prompt→swarm plan→independent ENG/design review only after other outstanding work is resolved; excludes itself from queue-empty check. No dead-code/test deletion or audit execution now. |
| Codex versus Claude code-quality investigation | [Queued task and refined planning prompt](plans/2026-10-25-agent-code-quality-comparison-prompt.md). Prompt-only preparation; no comparison or collection run. | Independent prompt critique incorporated in v2; HOLD. On activation produce a swarm-shaped evidence-based investigation plan with holistic matrix, independent ENG/relevant design review before separately authorized execution. Preserve saved-variants priority; distinct from queue-empty robustness audit. |
| Linear roadmap / agent-neutral source of truth | [Queued investigation prompt](plans/2026-10-25-linear-roadmap-investigation-prompt.md), seeded from the descriptive all-workstream report and current ledger. | Future task: investigate Free viability, owner visibility, agreed prioritization and Codex/Claude access, then a swarm-shaped migration plan with independent CEO/ENG reviews. Prompt preparation only; no Linear setup/import/cutover or CLAUDE edit. Current ledger remains authoritative until an approved validated cutover. |
| HANDPAN-HELPERS resource | [Refined prompt](plans/2026-10-25-handpan-helpers-prompt.md); [plan](plans/2026-10-25-handpan-helpers.md) independently ENG/design-cleared after locale-baseline correction. Preferred third row `[HANDPAN HELPERS / HANDPAN 101]`, About stays alone. | Planning complete; app unchanged. Exact CLAUDE approval needed to replace101-alone rule before implementation. No fit/usability/DEV success claimed. Saved-variants remains delivery priority. |

Recovery: plans, refs, last/next and approval limits above are portable; temporary
paths and raw evidence are host-local. A new agent must inspect live branch heads,
CI/review/reporting and ownership before writes. Missing refs/evidence are blockers,
not completed checks. Never reset the original dirty/locked checkout. Publish
meaningful checkpoints, not just creation/final PRs, through normal review/CI/DEV
gates and the authorized [shared reporting thread](https://github.com/raywu/handpan-cards/pull/571).

## 2026-10-25 feedback then swipe — owner-approved continuation

This later checkpoint supersedes older planning-only/app-unapproved labels below
for the two named scopes. Owner explicitly authorized **latest-per-ring feedback,
then Scale↔Layout swipe, through DEV** after independently reviewed plans. Main
merges and exact CLAUDE.md edits remain separate decisions; future whole-codebase
prompt/investigation stays queued until other work is resolved.

- **Plans:** [feedback](plans/2026-10-25-layout-feedback.md), reviewed body at217
  SHAbdf530e39cae3bc0904c701f6afdf46f4bcdf6f2dd134666e14b4904d2df6b9f;
  [swipe](plans/2026-10-25-sheet-tab-swipe.md), reviewed body at217 SHA4f133ae0…3c57c.
- **Root/host/branch:** ray-Mac; `/private/tmp/handpan-feedback.ha43y5cy/integration`,
  codex/layout-feedback-20261025; base217609075a14e6ca4799497210af27d9df842c5e.
  Separate test/app branches start at that base; private assignment/ownership
  receipts are under sibling evidence/. Paths are not automatic takeover grants.
- **Last:** exact plans and independent source reviews cleared. T's primary2 cases
  were assertion-red on unchanged appbd9; after A's app-block-only patch, all20 new
  unit cases, all873 app tests and all3 new native journeys passed. Native coverage
  includes12 en/de/it ×portrait/landscape ×fallback/real-font cells with English
  note input preserved. Two sandbox-driver failures were corrected by invoking
  actual inline control handlers; behavior assertions were not weakened.
- **Mac prerequisite delivered:** DEV574 is merged atf5df7942, source21760907/tree0a11a151.
  Independent full CI40209344599:12 jobs,2238JS/274Python/1484kills,0bad verdicts.
  ActualDEV28/28 served resources/noindex and print journey1/1 passed, with cleanup
  and independent delivery review. Main573 remains HELD; full Mac is unverified.
- **Mutation proof:**16 new feedback mutants and5 preserved-intent legacy context
  refreshes are assertion-killed after18 distinct clean-green exact header commands
  at source4e4bff4c. All failing test leaves are ERR_ASSERTION; nested suite wrappers
  do not count as kills. Static1500-patch applicability, per-job resource census
  and restored clean proof checkout verified. Full final-head CI/DEV still pending.
- **Next:** exact-head addressed reviews, full CI through a held main-target PR
  and same-head DEV companion, then actual served DEV/affected journeys. Resolve
  live PRs for branch codex/layout-feedback-20261025 and the latest shared thread
  [checkpoint](https://github.com/raywu/handpan-cards/pull/571#issuecomment-6400489132).
  Root alone runs host browsers. No feedback CI/DEV success is claimed here.
- **Sequencing:** integrate feedback through full CI/review/actual DEV, then start
  SPS from the accepted lane source with the shared tab-entry contract. Credit
  original adapted phone QA; new feature-native checks remain outstanding.
- **Recovery:** unknown scope/owner, dirty conflict or unexpected regression stops
  dependent writes; retain raw failures and original trees. No reset/unlock,
  instruction changes, global setup or main merge follows from this checkpoint.

## 2026-10-25 Mac repair execution checkpoint

**Additional owner-requested plan discovery:** the
[current relevance audit](plans/2026-10-25-plan-relevance-audit.md) and
[109-file inventory](plans/2026-10-25-plan-inventory.json) restore missing deferred
SPS and broader historical-nit locators. The
[SPS successor](plans/2026-10-25-sheet-tab-swipe.md) and
[per-ring feedback proposal](plans/2026-10-25-layout-feedback.md) are planning
artifacts, not app implementation grants. Owner selected latest outcome per ring,
once rim→inner. Deep recovery matched the original first-five phone scripts to
direct2026-10-22 owner acceptance: the adapted baseline was historically passed,
including lip/messages/palette/landscape, with a later font follow-up also passed.
Credit that evidence; do not require a blanket repeat or certify today's native
SPS behavior. Old SPS build deferral remains distinct from baseline QA. SEO is a
retained research prompt whose research/reviewed plan has not yet been produced;
[SEO recovery](plans/2026-10-25-seo-plan-recovery.md) and
[deep plan search](plans/2026-10-25-outstanding-plan-deep-search.md) preserve the
missing deliverable, three unapproved P3 TODOs, Q9 and historical candidate debt.

**Future queue item:** [codebase/test robustness investigation](plans/2026-10-25-future-codebase-audit.md).
Owner explicitly requests this only after other outstanding work is resolved:
iterate a high-quality investigation prompt, run it to draft a swarm-shaped plan,
independently engineering/design-review and refine that plan before execution.
Do not start that investigation now, delete code/tests or infer main/CLAUDE consent.
The future item excludes itself from the queue-empty check; unresolved work or
missing evidence is not completion. Preserve these instructions across agents.

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
- **Live delivery:** [main CI PR573](https://github.com/raywu/handpan-cards/pull/573)
  is HELD without main consent; [DEV companion574](https://github.com/raywu/handpan-cards/pull/574)
  uses the same branch. Resolve their actual current head/state; an initial
  plan-only CI skip is not repair acceptance. Canonical DEV has not received this
  feature checkpoint until574 actually merges and its delivery is verified.
- **Local implementation gate:** T asserted9 controlled cases against unchanged
  helper714785d5:1 pass/8 ERR_ASSERTION failures,0 skips/cancels. H then added21
  helper lines for opt-in settle. Same controlled cases9/9 green; original print1,
  native two-target1, full harness38, pointer/capture5 and font/background16 passed
  with required0 skips/cancels. Full harness was atd8d85080; the later FG10 default-
  launch assertion was separately green through its exact header at6ff541c9.
- **Mutation gate:**16 new generated helper mutants were assertion-killed after
  10 distinct clean-green header commands in disposable source6ff541c9. All1484
  current patches apply-check; no existing context changed. The first proof parser
  stopped after a successful clean run because Node25 default output was SPEC;
  raw receipts retained, parser independently corrected to read SPEC/TAP, no test
  or kill threshold changed. Per-run process/profile census supplements fast-run
  supervisor sampling. Local receipts remain host-local, not fresh-host capability.
- **Next:** inspect final exact-head independent source/interaction reviews and
  full Linux validate, then gate574 against the actual combined DEV tree and verify
  served bytes/affected journeys. Final CI/DEV receipts belong on the linked live
  PRs; pending evidence is not completion. Larger full-Mac collection remains
  unapproved/unrun, and other frame paths/M2/M3/C1 causes remain unrepaired.
- **Scope/risks:** explicit interactive instance policy prepares only settle's
  first real frame, every call. Neutral helpers/deferred capture remain unchanged;
  M2/M3/C1 and arbitrary/drawer rAF paths remain separate. Final review, generated
  mutants, exact-head Linux CI and actual DEV validation remain required. Main is
  held until repair-specific owner consent. Unknown ownership/conflict or bad
  diagnostic oracle stops dependent writes, never triggers reset/unlock.
- **Parallel NITS investigation:** source audit completed read-only at96c4c589.
  Single pendingDerive string can overwrite an earlier ring's feedback. Owner
  settled latest outcome per ring, once rim→inner, rather than event history. NEXT/keyboard
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

## 2026-10-25 DUPLICATE-NOTES planning checkpoint

Owner requested a research prompt and independently reviewed plan to permit repeated
physical notes with nonblocking warnings, plus explicit all-workstream ledger coverage.
This is **planning only**: no parser/engine/app/record/share edits or raw-photo
publication. Pending interviews are not answered by AFK; no feature implementation.

- **Owner/ref/worktree:** root on ray-Mac, `codex/duplicate-notes-plan-20261025`;
  `/private/tmp/handpan-duplicate-notes-qgvz59ns/planning`; baseDEVac97a9d6.
- **Artifacts:** [plan](plans/2026-10-25-duplicate-notes.md),
  [prompt](prompts/2026-10-25-duplicate-notes-plan.md),
  [coordination and owned research trees](plans/2026-10-25-duplicate-notes-coordination.md).
  Three research notes linked from the plan preserve independent sources.
- **Last confirmed:** prompt V2 independently critiqued/rechecked, frozen SHA256
  `be2677f0f32e23a1ae4ccda2ad3c07c711eed7c24e938b41c063dcc192dec3cb` at2f01c3ac.
  Core research retained744feb3b, UX7dfd2127; engine note independently produced
  SHA2564db7cfb6980f0b6497ef0086e288e402f565480f460dacf9b596e9d95e8e7b85.
  Final plan SHA256585fa248cb1271d271b4c0a47ba89df0345c9fc42f73b51460e7ca2352f5db7c
  cleared fresh independent ENG/design rechecks after4material findings were fixed;
  review receipts and initial-plan hash are retained in coordination.
- **Material findings:** deleting duplicate refusals alone is unsafe: typed-field
  occurrence mapping can reuse an ID; existing share writers can encode seeds old
  readers reject; older writers/reset/dedup require a recovery matrix. Current
  all-position diagram highlighting differs from one-field-per-pitch-class written
  voicings and must be preserved. New warning fit/priority/accessibility and legacy
  valid formats require explicit independent acceptance tests.
- **Next:** publish independently reviewed docs/ledger; reconcile pending scope,
  voicing, warning/no-confirmation and warning-coverage interviews; publish reviewed
  docs/ledger through fullCI/DEV. Stop this planning stream awaiting separately
  scoped implementation approval. No no-regression or operational parity claim.
- **Parallel/recovery:** use the current top table, not historical pending statuses.
  Each stream's live ref and own permission gate governs continuation.

## 2026-10-25 SEO-LONGTAIL planning checkpoint

The owner's newer explicit request authorizes **long-tail strategy research and a
reviewed subplan now**, in parallel with existing app work. This supersedes the
older deferred research label only for this bounded SEO-LONGTAIL substream.
Broader SEO investigation remains queued; future queue-empty code/test audit stays
queued. No article/generator/app implementation, publication, provider/analytics
write, CLAUDE.md change or main release is authorized by this planning request.

- **Umbrella/status:** SEO → SEO-LONGTAIL; research/subplan independently reviewed, implementation unapproved.
- **Plan:** [long-tail content subplan](plans/2026-10-25-seo-longtail-content.md).
  [Prompt](prompts/2026-10-25-seo-longtail-subplan.md), three linked research notes
  and [coordination](plans/2026-10-25-seo-longtail-coordination.md) retain evidence.
- **Owner/location:** Codex root on ray-Mac; branch
  codex/seo-longtail-plan-20261025; host-local worktree
  /private/tmp/handpan-seo-longtail.rpqmbt6_/planning. Base217609075a14e6ca4799497210af27d9df842c5e;
  fresh DEV observedf5df7942d097167013a3bf2baf05a6497ac73613 on2026-10-25.
  Resolve the advertised branch/PR and immutable published plan commit before
  recovery; local paths are not portable or permission to disturb another lane.
- **Last confirmed:** independent prompt critique incorporated arrival/RNG/repeat-
  measurement gaps; three genuine research contexts completed source/web audit.
  Canonical diagnostic verifies supplied18-note link, not illustrative20-note query.
  Current link loads instrument, not exact progression/tier/view. Search demand,
  musical suitability, publishing setup and full attribution remain unverified.
- **Review:** final plan SHA256 f2be3a0275642f07eb53aa0b1e627bc6d23f1085ec1efa0463f9702534e51fd8; fresh ENG/design reviews cleared after seven material/wording fixes.
- **Next:** interview unresolved audience/reviewer/home/budget/data choices; then await
  separately scoped implementation approval. No manufactured numeric quality score.
- **Recommended proposal:** useful family guide first, at most two independently
  distinct layout lessons; reviewed drafts and human music validation, not bulk
  publishing. Defaults are provisional until owner answers. Existing Domain
  verification/site-name implementation must not be repeated from stale records.
- **Recovery:** creation/checkpoints/plan/review/source refs belong in this DEV
  ledger and authorized existing reporting thread. Preserve unrelated concurrent
  ledger rows during merge. Main remains held without explicit feature consent.


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


## REPOSITORY-RENAME — reviewed planning, execution held

Objective: rename the GitHub repository and canonical local checkout to
handpan-chords while preserving runtime/browser protocols, public hosts, all
worktree state and Claude behavior. Owner authorized prompt refinement, a generated
plan and engineering review; no rename or rehearsal is authorized.
[Prompt v3](prompts/2026-10-26-repository-rename-handpan-chords.md) was revised after
independent critique and rerun to refine the [plan](plans/2026-10-26-repository-rename-handpan-chords.md).
Independent engineering review cleared the revised substantive plan, with two P1
findings addressed. These local planning artifacts are not yet a canonical DEV
publication; do not infer that other hosts already have them.

Continuation: preserve the plan, then obtain a separately approved maintenance/
execution packet after current writers are quiescent. Gates include live provider
binding, real renamed-repo DEV Git delivery before local move, verified private
backup/restore rehearsal, safe destination/move semantics and new-path harness
permissions/memory continuity. Any CLAUDE.md edit still requires exact owner
approval; main merges remain separately gated. Do not change storage keys or the
old-spelling browser Web Lock. No preference interview is needed to finish this
planning; later timing/backup/config decisions belong to execution intake.

Final local plan SHA256: dc3442c847b6f7dbfef9c87cb798ef029775e4153451d4d92c5ee868f1257c21. Prompt SHA256: 1bb8ea534a6e5cad3efc9097f74a44ca622014a7c6c3863af4e638e0a892d656.


## Settled owner interview — 2026-10-26, follow recommendations during AFK

- PALETTE-DEFAULTS-10: reviewed plan and exact CLAUDE paletteparagraph patch at
  a41a3bb7 approved for queued DEV implementation AFTER current active streams.
  No implementation/CLAUDE edit yet; no main consent; changed packet needs approval.
- Saved variants performance: use the recommended bounded existingLinuxCI design
  for the next reviewed PROPOSAL (one90scontrol then, onlyifvalid, one180smatched
  200-record case; no retries/relaxedthresholds). CurrentMacgate staysHELD. This
  direction is planning, not permission for unreviewed configuration/global changes.
- SEO: use the recommended exact18-note EAmara13+5 example for pilotplanning;
  verify maker/model/provenance before public content. /learn/ home and owner
  musicalreview role were already settled. No articles/publishing approval.

User reaffirmed AFK means follow recommendations. Make routine in-scope decisions
and record them rather than re-asking settled choices; preserve explicit main,
CLAUDE exact-diff, review/test/security and owner musical/physicalQA boundaries.
