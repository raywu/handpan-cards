# Sync store safety coordination — Refs TRI-28

## Goal

Stop non-durable or replaced local stores from propagating inferred deletions of other devices' scales.
Execute the independently reviewed sync-store-safety subplan (section17 focused correction READY),
engine E then client C. Non-goals: schema/auth/prod/email changes, feature expansion, benchmark or profiler
infrastructure, new UI/copy, main merges, deploys and migrations. Saved scales and links stay compatible.

## Hard rules

1. Only root integrator merges, and only DEV under the verified AFK gates. No main merge/deploy/migration.
2. Root alone writes this coordination doc and Linear. Workers return pending-linear-writes.
3. Follow file ownership; request a boundary change rather than edit another lane's scope.
4. No deploys or external service mutations during the batch; no production credentials.
5. Delivery uses claude/login-sync-a2, new commits and ordinary push; main PR1001 stays held.
6. Local tests are smoke evidence; exact pushed head validate and fresh independent review gate progression.
7. On error, reread the goal, make the smallest adjustment, report blockers and continue unblocked scope.
   Never widen the goal. Third failed lane review triggers the global AFK regroup rule.
8. No force-push, amend, no-verify, reset, branch/worktree deletion or changes to unrelated work.

## Ownership

| Role | Branch/worktree | Owns | Never touches |
|---|---|---|---|
| Root integrator | main session; isolated lane tree | plan/coordination, PR bodies, Linear, CI/review gates, dev rebuild | original dirty checkout, production, unrelated work |
| Engine E | claude/login-sync-a2; wt-login-sync-a2 | subplan section6 E row verbatim: sync.js, generated sync region only, sync tests/model, sync mutants, ENGINE-SPEC20, sync test floor | other app JS, schema/auth, client tests |
| Client C (not started) | same branch/tree, after E gates | subplan section6 C row: sync app region, additive app tests, throwOnKeys sandbox option, a2_sync mutants, app floor | engine and its generated region, e2e, i18n/About |
| Fresh reviewer | isolated verified-SHA worktree | read-and-report review, exact-head validate conclusion | fixes, commits, pushes, Linear |

## Sequencing

1. E writes tests and records RED at base6c960269; implements trustedBase, syncs generated region, proves
   five named mutants, updates only owned docs/floor; commits and ordinary-pushes1001.
2. Root verifies actualPRhead=localtip, waits validate success at that SHA, obtains fresh independent
   code review in separate worktree at exactSHA; only PASS/PASS_WITH_NITS unlocks C.
3. C tests-first then implementation/mutants/CI/freshreview at its final head.
4. Root rebuilds1003 from existing7e3b356f, merge updatedH, measure dev-specific floors, DIRECT_READERS,
   check every a2/sync patch and subplan section8 gates; no force-push. Independently reviewDhead.
5. DEV merge only with all gates, then actual served DEV and owner loginRCQA. Main remains held.
   About privacy localization in all8tables is a separate prerequisite before any later main release.

## Briefings

E: execute subplan section6 E acceptance and verify commands without substitutions. Tests first; no browser
jobs or external DBs. Local Node unit tests and inline/validate are permitted. No source change outside E.
C: waiting; do not start until E CI and fresh review pass. Use section5's corrected planner counter/control.

## Status

| Role | Branch | State | Last update UTC |
|---|---|---|---|
| Root | claude/login-sync-a2 | plan correction READY; original clean lane fast-forwarded215ad5a7→6c960269 | 2026-11-09T12:38Z |
| E | claude/login-sync-a2 | PASS at fb0b2974; validate42619061715 success/all12, five new mutants killed | 2026-11-09T13:16Z |
| C | claude/login-sync-a2 | unlocked after verified E CI/fresh review; tests first | 2026-11-09T13:16Z |

## Handoff queue (append-only)

| # | From | Ask | Status |
|---|---|---|---|
| 1 | Root | Before production release, finish About privacy localization and owner loginQA; prod email after DEV QA | OPEN |

## Environment qualification

This harness supplies independent Codex subagents, not Claude's named Sonnet/Opus agent types.
Installed workflow contracts are applied as read-only instructions; no claim of native Claude slash-command
execution or model-tier parity. No new installs/global setup. Root owns shared browser runtime; E runs none.


## Engine completion and client handoff

Engine E at `fb0b29748ad0d5f483b6ed721c05ff3498b90891`: fresh independent reviewer PASS, no findings.
Root verified actual PR1001 head equals clean author local tip. Validate42619061715 completed success
with all12jobs; CI logs and local proofs show the five new mutants killed. Independent review reproduced
six failing new cases with original6c960269 source and178/178 green at E. All39existing sync/a2 patches
apply. This is ENGINE-only PASS: the unsafe client is still present until C is complete.

Owner reiterated minimum scope and /reviewed-plan plus interviews for material doubt. No new infrastructure.
The optional local-overlap scheduling question received no answer and became moot when E passed; the
original serial order was retained. Client C now executes the committed section6 row. The existing local
app/CI/runtime and reviewer model qualifications remain; C must get its own exact-head CI and fresh review.
No DEV/main merge, deploy, migration or production action occurred. #1003 stays at7e3b356f for the later
reviewed fast-forward rebuild. Root may add this handoff documentation as a LOCAL commit before C, but
does not push it separately: C's final ordinary push carries it with the code to avoid a redundant CI run.


## Client review correction checkpoint

C8833 smoke1240/1240 and61/61 passed, but fresh review FAIL found empty-pull account-switch audit mutation.
Existing-fixture probes confirmed two other completion tails of the same S7 contract. Section19 of the
subplan is independently READY for three explicit completion checks (one dominated check removed), three
RED regressions and named mutants. This is the current C continuation point; no DEV rebuild before the
corrected final-head CI and fresh review pass. Owner explicitly approved a held CI-only PR for the eventual
D head; root will amend D section8/10 before its final push. No main merge authorization exists.


## First-barrier regroup: current pickup

Third #1001 review FAIL at58cd reproduced old-base tombstone before GET after same-user first:true
replacement during token refresh. Code changes stopped. The new regroup prompt passed independent
critique; a fresh writer produced subplan20 and a separate fresh engineering reviewer returned READY.
The minimal reviewed direction is reloading sc after the await and honoring its first flag; no nonce,
new field or framework. Next fix lane is serial C scope, RED at58cd first, then same-fixture recovery,
two independent named mutants, preserved prior proofs and full final-head CI/fresh review. Current58cd
remains blocked regardless of CI. Owner-held D-head CI approval remains; editor implementation stays
behind login/editor manual QA. No DEV/main merge or production operation occurred.


## Operation-authority regroup: current pickup

Source1356ac84bf7fc489c4ff9a64ee342536772341fa FAILED fresh independent review: same-user
reset during incremental GET consumed first-sync barrier and omitted live R from ordinary later pulls.
Read-only whole-client audit found the common asynchronous authority gap. Prompt
docs/prompts/2026-11-09-sync-operation-authority.md passed fresh independent critique; separate writer
generated section21; separate engineering reviewer READY_WITH_NITS, both nits now fixed.
Use existing-state raw witness plus durable-store token, own conditional-write advancement, no new
persisted field/engine/schema/harness. Preserve synchronous current-action patch compatibility.
AFK recommended conservative choice recorded; no new owner product fork. Next: tests-first T lane
(app.test only, isolated worktree) then serial client C (index sync region only), root floor/mutants/docs
after exclusive handoff. No concurrent shared-file editors. No runtime proof of section21 yet.
Prior58cd full validate42629450423 succeeded, so old generic900stimeout is not a demonstrated ongoing
blocker. Current1356 validate42634146666 pending at checkpoint, cannot override failed review.
No DEV/main integration occurred. Owner-approved exact-D-head held CI-only PR and all fresh review/CI/
served DEV/owner QA gates remain. Editor remains behind login/editor owner manual QA;994 stays OPEN.
This checkpoint is deliberately uncommitted until implementation can carry it in one final candidate,
avoiding a redundant full-CI run for documentation alone.


Client operation-scope handoff: local source391db225, T handoff6b21126e integrated as e986ccee.
App1280/1280, scoped101/101, engine178/178 locally pass. Root owns exclusive tests/pin/floor/mutants
now; test/source lanes finished. Mutant generation may run in its own disposable WT with only
tests/mutants ownership and return its proof map to root; no shared source edits or duplicatefullCI.
Current1001remote1356 has fullCI success but independentFAIL. Neither1003 norDEV/main changed.


Mutant handoff ddafa976 integrated:9subsumed guard mutants replaced by3central witness proofs;
4survivors reanchored,33enginepatches unchanged.45/45remainingapply;11/11unit headerclean+assertion
kills. Every retired old assertion actually fails under a mapped replacement (map in subplan21),
no negative test removed. Browserresend/fullmutation left to authoritative exact-headCI.
Local source stays391db225, app1280/1280/scoped101/101/engine178/178, validatorPASS.
Next: ordinary finalcandidatepush, exact-headfullCI andfreshreview; both main-targetPRsheld.


DEV local preparation scheduling independently READY: frozenM a064 has freshcodePASS while
validate42641567851 runs. Detachedprep starts7e3, ordinarily mergesH. Only floor conflict; preserve
pgenv3 andmeasure Dapp/sync fromown1152/48 baselines. DIRECT_READERS add e2e_sync. All remote
publication waitsMfullCI+reviewer'sfinalconclusion; exactDfullCI/freshreview/served/ownerQA unchanged.
No force/main/deploy/migration/production credentials. Any changed H holds publication and refreshes
local/CI/review evidence. Plan8/10 now carry owner-approved exact-DheadCI-only procedure.


D preparation measured evidence:app1280/1280,sync178/178,combinedsync+editor234/234,
zero skips/cancels. Owned app/sync floor rows raised from D1152/48 to measured1280/178;
pgenv3 andeveryunrelatedrowretained. Full client region andpure syncengine byte-identical
to independentlyreviewedM a064; existingDeditor/data preserved. Remaininglocalvalidator/
unithealth/patchchecks runbeforemergecommit. StillnoDpublicationbeforeMfinalCI/reviewerread.


M a064 fullCI failure was ONLY3central-mutant #kills/#suite metadata, notapp/browser behavior:
app1280,e2e643,syncbrowser10 and4mutationshardspassed. Header-onlyfix8f0340cc preservesallbodies,
3canonicalclean1/kill1 proofs, fullmutation_harness54/54,45apply. Existingfull54harnessnowmandatory
localprepublication; rootmissedheaderlintfirsttime. NewexactMheadCI/freshreview required.
Dprep3be45204 clean/local, publicationheld; ordinarymergecorrectedverifiedM beforelaterDgates.


Current D preparation incorporates independently code-PASS M555bac65 (validate42648100530 pending)
by ordinary merge into preserved3be prep. Only simultaneous coordination-note appends conflicted;
both retained. No application/engine/app-test delta versus3be. Full54 mutation-harness check now
required locally before publication; no headerbody/threshold/test weakening. RemoteD remains7e3.
