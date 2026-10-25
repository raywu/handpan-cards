# HTC compact Resources restoration — execution plan

Owner authorized autonomous implementation, tests, lane commits/pushes, PRs and dev integration on 2026-10-24 after reviewed near-10 plans, proper TDD, independent addressed PR review and exact-head CI. Main merges remain owner-only. Ignore gog. This authorization supersedes the earlier diagnostic-only restriction; do not re-request ordinary scoped lane actions.

**Current baseline correction:** preserve accepted main/dev budget literals and exact equations. Earlier historical-HTC ceiling interpretations below are superseded; no increased budget or relaxed minimum-growth oracle remains in current source.

## Goal and acceptance

Restore HTC beside HANDPANER and DING & TONES on the sites row while preserving current panel fit limits, visual system, readable complete labels, minimum44px targets, Resources activation/Tab behavior and all other existing controls. The actual deployed DEV must satisfy the reviewed requirements before the main PR is handed to the owner. No main merge.

Fixed starting HTC head: `282f0652e2a076563a136be9614f1824e549886c`; main `3caf5e28fa4f965d81d90a4f80d53b15f82f39fc`; dev `e8dc127efb9004c8fc202160b6e2c8c1fd22a84c` (SSH heads verified). Original HTC worktree remains locked/untouched. Create a fresh lane branch/worktree from this head after plan clearance, retain the earlier unchanged validation tree/logs.

## Non-goals and constraints

- No canonical deck, diagram, engine/generated-region, print/PDF, share/storage, dependency, font, palette or analytics changes.
- Do not increase panel budgets/allowances, hide controls, shrink targets or discard failing meaningful tests/mutants.
- No broad CDP refactor or timeout inflation. Diagnose TR-1's repeatable Runtime.evaluate timeout and fix only an evidenced test-expression/harness fault needed by this lane; if the cause requires unrelated production changes, isolate and re-review scope.
- Language/i18n tables unchanged: HTC is an external site's proper-name label already specified by original restoration. Validate all languages present in the later dev integration tree; main-target HTC branch contains English only.
- Never unlock/change the old lane, push a shared branch, force-push, amend, skip hooks, discard dirty work or merge main. New commits and PRs only under lane branch scope.

## Swarm ownership and sequencing

Root is integrator/sole execution-state writer. Native limit four total agents includes root; reserve reviewer capacity. Parallel read-only source/design investigation is safe, but browser jobs and mutation generation are serialized. Separate writers never share a source checkout.

| Lane | Owns / never touches | Dependency / NEXT | Observable acceptance |
|---|---|---|---|
| ENG / DESIGN | Fresh plan reviews, read/report only; no source writes | Before implementation, inspect this plan and relevant source/test contracts; propose concrete amendments; iterate to min9/10 with no critical gaps | Final engineering/design clearance recorded, source/skip limits stated; no author self-review represented as independent |
| A — compact behavior/TDD (root) | App Resources CSS/markup outside generated regions, tests/app.test.js, tests/e2e.test.js and own test-count rows in tests/suite_health.py; never data/engine/global config/other features. Shared tests/helpers/cdp.js + tests/harness.test.js only if bounded tracing proves a harness defect; that specific change gets a focused reviewed amendment first | Diagnose TR-1, establish source-backed no-timeout measurement; update/add owner-behavior tests first (single row and full fit/accessibility); demonstrate red against unmodified app; then minimal CSS repair and show green | Known sidebar/landscape assertions green, sites single row/equal widths/labels contained/44px targets; semantic/Tab tests pass; no skip/cancel/timeout counted as success |
| M — mutation integrity (root, isolated mutation scratch) | Relevant trio/Resources/structural mutants plus any necessary added behavioral mutant; never original/live dirty checkout | After A behavior settles and source commit exists: regenerate patch bodies via actual git diff, strip blob index lines, preserve meaningful kill oracles. Correct hidden-Resources semantic target. Mechanism-dependent old mutants may be replaced with actual behavior-breaking counterparts, never dropped merely to pass | Clean assigned baseline green, intended faults fail relevant test; full CI corpus and shard union account for every patch; no stale/broken/skipped/timeout reported as killed |
| D — docs/currency (fresh worker or root if serial) | CLAUDE.md Resources sentence, README mutant count, this plan/review receipts; no code/test re-authoring | After A/M settled, update only changed facts, counts observed from actual corpus. Source-check every behavior claim | Test-cited compact-row description correct; count current; no unrelated handoff/config artifacts swept into feature commit |
| R — fresh PR review | Read/report at verified final SHA in a separate review tree, never author/fix/merge | After relevant CI success, inspect spec/ownership, diff, regression evidence and mutation accounting; failures return concrete scenarios and require fresh reviewer after fix | All material findings addressed, near-10 readiness, exact-head CI receipt, criteria coverage and limitations. No dev merge before this gate |
| I — integration/DEV (root) | Dedicated dev-integration branch/worktree + PR; not direct dev/main pushes | Merge appropriate dev tip into lane integration branch if needed, resolve/regenerate without hand-merging generated lines, run combined-tree CI in HELD main-target PR, fresh review for material conflicts; dev PR merge only after green/review | Deployed DEV content corresponds to approved integration SHA/tree; existing and new user journeys pass in actual served artifact; main PR remains HELD for owner |

## TDD and regression sequence

1. Diagnose TR-1 timeout with bounded temporary instrumented probes outside tracked source first: determine which viewport/expression hangs, distinguish browser/measurement failure from product assertion. Reproduce any identified harness-expression defect with a focused guard before changing the committed helper. Do not edit production CSS to make a broken test appear fixed.
2. Update compact-sites behavior expectation (historical sidebar `[2,1]` no longer owner requirement), asserting presence, one row, equal widths, min44px, no clipping/overflow with independent rendered geometry. Preserve layout budget and semantic assertions. Capture failing test output against original app; this is the TDD red.
   Replace BOTH obsolete sidebar `[2,1]` and landscape remove-trio self-comparison with the same outcome oracle at all selected cells: three visible links on one row, equal item widths, nonempty text rects, complete unellipsized labels, no horizontal or vertical clipping/overlap, >=44px width AND height, unchanged font size/weight/family, adequate multiline leading. Add explicit separate existing sidebar HORIZONTAL and VERTICAL no-new-scroll tests to targeted runs; fit alone does not prove correct labels/targets. Never lower unrelated FLOORS; add/raise only owned rows if new test counts require it.
3. Minimal implementation hypothesis: single nonwrapping trio with constrained item minimum width and sufficient label wrapping; remove obsolete sidebar40% basis and landscape-padding behavior only if measured fit/readability require it. Preserve original fonts and targets. If an unbreakable label needs wrapping, use an explicit minimal label-wrap rule, not font shrink or ellipsis.
4. Run targeted browser checks, then full both-font panel probe with nonzero measured cells and zero skipped cells. Compare actual candidate against verified main base; classify base-overflow reported-only findings separately.
5. Generate meaningful mutants from committed clean source in a separate disposable tree, never while editing the author tree. Review/update CSS-mechanism mutants and add/retain specific fail-on-regression guards. A surviving mutant against a different element is a stale oracle, not proof the intended assertion failed.
6. Run data/sync/boot, Python/JS suites and suite-health; required tests need actual counts and no silent skip. Full mutation gate goes through CI at final head; targeted local mutation runs may aid smoke triage but never replace exact-head CI.

## Exact verification entry points

Environment: explicit installed Chrome, owned TMPDIR, OS-assigned loopback ports; unset E2E_PORT/HPC_COVERAGE_DIR/NODE_V8_COVERAGE/unreviewed NODE_OPTIONS; Python bytecode disabled during mutation work. Local Node25/Python3.9 differ from CI22/3.12; record actual runtime and do not dismiss real local assertions as version skew without evidence.

```sh
node --test --test-reporter=tap --test-name-pattern='TR-1|the desktop sidebar has no vertical scroll|gains no new HORIZONTAL|gains no new VERTICAL|the panel meets its budget|the full-screen settings panel fits|the settings panel has exactly one Resources group|Resources links activate|Tab is trapped inside the settings panel' tests/e2e.test.js
node tools/probe/panel_fit.js --base <verified-main-sha> --font both --workers 1
python3 tools/validate.py
node tools/boot_sim.js
python3 tools/inline_engine.py --check
python3 tools/sync_decks.py --check
python3 tools/sync_i18n.py --check
python3 tools/refresh_mutants.py --check
./tests/run.sh python
./tests/run.sh node
python3 tests/suite_health.py
```

Do not run placeholder baseline literally. Timeout900s e2e/600s probe initially,10s TERM→KILL grace; preserve raw exits/logs, no masking pipe. Increase an operational limit only for measured legitimate work with recorded rationale, never to hide a hang. No simultaneous browser suites/full probe. If full local suite hits established starvation, isolate and qualify; CI result at pushed head remains required. CI full mutation is four shards plus union gate; inspect every required workflow job, completed validate run and head identity.

## DEV acceptance and release handoff

Use existing CDP driver against actual DEV URL through a bounded probe stored outside shipped code. Verify fetched content marker/tree SHA from the latest deployment/API or byte digest (not HTTP200 alone), then exercise Resources presence/href/new-tab safety, compact layout labels/targets, click/Enter, focus/keyboard, About and Language, A/B/S mode/card-state preservation. Cover narrow phone320/380, landscape incl1280x320 and other established edge cells, sidebar1024x700/746 and1280x746, real/fallback fonts where supported and all actually present language tables. Pair deployed checks with exact-tree full probe; explicitly state any environment/device-only gaps. Loading local modified HTML is not deployed DEV verification.

No deployment success claim until expected served bytes/marker and observable journeys agree. Do not overwrite dev translations with the English-only main candidate. If integration conflicts with held i18n or generated content, create a combined-tree CI branch and re-review material resolution before dev merge. Owner alone merges main; provide its HELD PR URL, final SHA, reviewer verdict, CI run, TDD red/green and DEV receipts.

## Failure/recovery and bounded loop

Before each mutation/integration, read status/head and preserve dirty/untracked/unpushed work. Unexpected writer or source divergence stops only that action. Fresh reviewer on every changed final head; no stale review or CI accepted. Use two correction cycles before regrouping into a new reviewed subplan for repeated substantive failures; don't loop indefinitely or weaken oracle. Retain failed tree/logs. Roll back rejected dev changes only through a reviewed dev-revert PR under standing scope, not reset; main untouched. No unrelated process cleanup. Record workstream status, exact last completed/NEXT, findings and auto-decisions after transitions.

## Review status

Cleared by independent engineering and design reviews (see audit below); implementation in progress. Scores must be accompanied by concrete findings and scope/test coverage; target near10 means min9 per relevant dimension, no unresolved critical finding and explicit accepted limitations, not a manufactured perfect score.

## Required review amendments — folded before execution

### Independent engineering amendments

- Fresh unoccupied branch `codex/htc-compact-20261024` from fixed HTC SHA in a new worktree; preserve original Claude branch/worktree and #558. New HELD main PR explicitly supersedes #558; do not edit/close old PR as an incidental setup action.
- Hypothesis-neutral trace before repair: bounded diagnostic wrapper records viewport, exact expression identity and begin/end for load/resize/settle/open/measure/Escape/class toggles/cleanup, preserving first failure and browser liveness. Current logs do not establish that MEASURE caused timeout. No broad timeout inflation/retry; conditional shared-helper ownership requires a focused reviewed amendment with regression evidence.
- TDD receipts: D0 unchanged app diagnosis; R1 completed compact-row ASSERTION failure on unchanged app bytes (identify cell/assertion; timeout/skip/cancel/syntax/Chrome failure is not red); G1 same oracle passes after minimal CSS; C1 settled source/test commit; M1 mutation generation against that clean commit in separate scratch; M2 meaningful baseline-green/fault-red receipts and committed patches/current docs. Do not publish expected-red intermediate CI as final readiness.
- Same independent outcome oracle for every selected cell: exact three visible links/common row parent/DOM order; single visual row, equal positive widths within1px, row contained/spanned, no overlap, >=44px width AND height; nonempty expected text and nonempty text rectangles fully contained, no clipping/ellipsis/overflow and legible multiline leading. Both real/fallback, modesA/B/S, explicit320/380 phone,1280x320 landscape,1024x700/746 and1280x746 sidebar plus established edges. No class-removal self-comparison or required CSS declaration.
- Test-count ownership: raise only own applicable FLOORS rows when new tests added; no lowered floors. Build requirement→named test→font/mode/cells→mutant→red/green receipt table during implementation, not mere test-count evidence.
- Mutation dispositions: `tr_trio_sidebar_basis` must be replaced/re-targeted if its removed rule is intentionally retired; `tr_trio_landscape_unguarded` must express a behavior regression rather than remove-class equivalence; correct `qr_res_hidden_landscape` to semantic Resources group, not last-child Language. Keep old→new intent ledger and equivalent observable coverage. Generate diffs from clean source, no manual patch-body invention, no blob index lines.
- Integration topology: keep English-only HTC main PR HELD. From verified current dev create separate `codex/htc-dev-20261024` integration tree, merge reviewed lane without overwriting translations; main-target integration PR is HELD for combined-tree CI, paired with dev-target integration PR. Record language-set and each data/i18n file digest before/after; no unrelated translation changes. Run full both-font probe per actual language (`--lang <code>`) and verify language resolved, then fresh combined-tree review even if merge textually clean. After dev merge identify merge/deployment vs PR-head separately and compare actual served bytes/tree plus user paths. Never merge either main-target PR.

### Independent design amendments

```text
Resources
[ HANDPANER | DING & TONES | HTC ]
[ AMY: PROGRESSIONS | AMY: BOTTOM NOTES ]
[ HANDPAN 101 ]
[ ABOUT ]
Language
```

CSS changes apply only to sites row/breakpoint overrides. Shared mode/modebar, Amy, print, About, Language, fonts/palette/tracking retain existing contracts. Update stale comments about two-line sidebar. A44px target is a minimum, not fixed height: wrapped labels may grow only within existing total panel-fit limits. Keyboard focus must stay visible/unobscured. Complete labels need nonempty visible rects, no ancestor clipping/ellipsis or inter-label overlap; existing controls supply the typography reference, no unapproved font shrink.

State contract: Ready=complete labels and usable targets in original group order; hover/focus=existing styling and visible focus; activation=native outbound link in separate destination, practice state preserved; destination loading/error=browser behavior, no new in-panel error/loading UI; missing/hidden expected link=failed verification, not empty state. Journey: familiar Settings/sidebar → HTC visible beside sites → click/Enter destination → return with same panel/mode/card. No new mockup/design system or motion needed for this scoped restoration. Existing tiny typography/visited-color debt is outside no-font/no-palette scope.

### Review audit

First engineering/design reviews found actionable gaps; revised plan includes them. Final independent engineering re-review CLEARED all dimensions9.3–9.6/10 with no unresolved decisions; final design re-review CLEARED9.5/10 across its six scored passes, no unresolved design decision. Reviewers are independent non-authors using audited contract sources, not authors self-scoring, and have not executed/seen visual output. Runtime and DEV acceptance remain required; implementation may now begin under standing owner authorization. Shared-helper changes still require the focused amended-plan gate above if diagnosis proves necessary.

## Execution amendment — compact budgets and visibility

Independent engineering review approved retaining historical fit/scroll/Resources **upper** budgets in affected landscape/sidebar cells while allowing shrinkage required by the owner. Portrait and unrelated-group exact equalities remain unchanged; finite/nonnegative measurements, explicit content/target/visibility checks and full main-comparison oracle remain mandatory. Do not inflate any pinned budget. Obsolete minimum-growth failures:667x375 S16px vs65.75;1024x700 S88px vs144.125;landscape505.375px vs555.375;sidebar710.375px vs766.375. A bigger-than-cap Resources mutant must fail, alongside hidden-group, clipping and two-row mutants.

Timeout receipt: traced `settle()` first rAF after desktop→mobile starved; original measurement finished. External target-activation diagnostic passed unchanged original TR1; reload-only did not. Local `Page.bringToFront` in TR1 preserves same-document resize and avoids shared-helper/timeout changes. New oracle verifies registered font mode, ancestor visibility/clipping and hit-tested exposure; cleanup preserves the primary failure.

TDD R1: unchanged app at282f065, both fonts reject1024x700 A because HTC is on row2 (2failed,0skip/cancel); G1 compact oracle passes after CSS. First full main-comparison probe:8019cells/font,0skips,0regressions/reported-only,0invariance failures. These are intermediate receipts, not finalCI/PR/DEV readiness.

## Mutation intent ledger and local regression receipts

Generated from clean committed source6113804 in separate detached scratch. Bodies are actual `git diff`, blob headers stripped. Eight selected commands passed on clean source and failed with ERR_ASSERTION under each fault; all fault runs had0skip/cancel and source restored. This is targeted evidence, not the full corpus gate.

| Patch | Old intent / disposition | Current fault and required detection |
|---|---|---|
| tr_trio_sidebar_basis | Removed40% basis was historically bad; retired minimum mechanism | Restore old wrap+40% two-row sidebar; direct one-row oracle fails |
| tr_trio_landscape_unguarded | Historical remove-trio parity retired | Disable landscape label wrapping; complete-text containment fails |
| tr_trio_padding_default | Default11px padding can now be behaviorally valid | Excess40px site padding overflows narrow row; geometry/containment fails |
| tr_trio_class_dropped | Retained, patch still applies | Drop trio class; direct layout/leading oracle fails |
| qr_res_hidden_landscape | Previously hid Language accidentally | Semantic :has(#res-handpaner) Resources selector; rendered-link inventory fails |
| e_panel_moved_into_header | Retained ancestry fault, moved markup regenerated | Move current panel+scrim under header; independent ancestry assertion fails |
| tr_trio_clipped_ancestor (new) | Adds missing visibility negative case | clip-path at row ancestor leaves rects intact; hit-tested exposure fails (both fonts) |
| tr_trio_budget_growth (new) | Proves upper budget still constrains growth | Add200px landscape row margin; unchanged historical budget assertion fails |

Corpus count1461 (1459+2). No existing mutant removed; no budget constant or test floor lowered. Targeted reviewed browser run13pass0fail0skip/cancel; Python gate274ran0skip/fail/error; data/boot/engine/deck/i18n checks pass. Full exact-head CI, final independent PR review, combined-tree dev checks and actual deployed DEV still pending.

## Fresh adversarial PR review — addressed refinements

Atd18791b, independent engineering found no actionable product regression and conditionally cleared source (CI/DEV still required). Independent test review found threeP2 issues, addressed before dev: peer-control typography reference replaces font literals per CONTRACT7; hit-testing samples central44px target edges/interior with rounded-corner allowance, alongside full label checks; landscape-only faults are scoped to the landscape block, not every matching panel-width rule. A clipped-HTC-padding counterexample passed the old oracle on bothfonts (no skip), proving the gap before repair. Its generated mutant now requires assertion-red under the stronger oracle. Fresh final-head review/CI remain required.

Final refinement receipts:13targeted tests pass0skip/cancel. Five final-source mutation checks have clean-green/assertion-red receipts: landscape wrap now fails specifically640x360 A in bothfont suites; semantic hiding fails inventory; budget growth fails667x375 S216px against unchanged65.75px budget; clipped-target and clipped-ancestor fail exposed visibility at1024x700 A. New `tr_trio_clipped_target` raises current corpus to1462 (1459+3); the earlier1461 count is intermediate history. Production app bytes unchanged by review refinements. Real-font visual review viewed actual sidebarA/S,phoneS,landscapeS captures and clears scoped trio at9.2/10; arbitrary word breaks are accepted cosmeticP3 under no-font/no-palette constraints. Captures do not themselves prove lower-control reachability or focus; tests/probe and deployed checks remain required.

## CI closure amendment — review required before fixes

Evidence: fullCI atd18791b (run40116162528) completedJS with only two failingfiles:474e2e tests, one old exact-growth equality at740x360 S realfonts (34px actual vs36.25px required); mutation-header lint rejects genericTR-1 selector because it selects bothfallbackandreal tests. Current21931cf source retains the same legacy equality; isolated current headerlint confirms five violations. All1462mutationfaults/4shards/union pass at21931cf; this does not waive header contracts or fullJS failure. Production bytes are unchanged by proposed closure.

| Owner | Scoped action / dependencies | Acceptance |
|---|---|---|
| Root author | Preserve failing CI/local receipts; stop or finish owned old fullJS before altering its source; no unrelatedprocess cleanup | Old results never mislabeled final-head passes |
| ENG reviewer | Review this amendment, affected real-font test and retained unchanged budget math, before edits | Finite/nonnegative and <=unchanged historical upper limit; reachability/inventory/target checks stay; no budget inflation |
| Mutation reviewer | Review exact-one header selection plus new separate real-font clipping mutant | Every #kills selects exactly one named test; no lint weakening; real-font test keeps its own genuine killing mutant |
| Root author | Red current headerlint; realfont legacy assertion evidence fromCI (optionally localtargeted reproduction after serialization); replace only obsolete minimum-growth equality with finite nonnegative upper bound clamped with Math.max(0,want); correct five #suite headers, add real-font companion diff generated from committed cleanapp in separate scratch | Expanded targetedbrowserincludes bounce-5 realfont edges plus prior13, headerlint green; targetclipfault separately killsfallback andrealnamedtest, clean baselinegreen |
| Fresh reviewer | Inspect finalsource/headerdiff and receipts at exactnewhead; no author selfreview | Address allmaterialfindings and near10clearance; rerun fullCI allgates atnewhead, not reuse oldgreen shards |
| Integration | Still waits final-headfullCI and review | Preserve8devlangs, combinedCI/review, actualDEV acceptance, mainheld |

No application CSS or fit-probe budgets change. Keep historical literals as ceilings and unrelated constraints. New real-font companion changes corpus1462→1463; README count and ledger follow observed corpus. A copied production-fault body is regenerated by actualgitdiff from committed source, not invented. If another substantiveCI regression appears after this closure, regroup into a freshly reviewed investigation subplan before further implementation; no weakening or endless retries.

CI closure amendment cleared independently by engineering9.3–9.5/10 and test review9.4/10 before source/header edits. Exact ceiling isMath.max(0,want), preserved. Latest21931cf fullCI confirms same twofailingfiles; allfourmutation shardsandunion1462pass, not sufficient for merge. Full localJS completednonzero:24otherfiles ran, headerlint failedsamefiveheaders; MacChrome e2e hit900s withCDPtimeouts in unrelated later tests. No localfullpass claimed or timeout raised. Hostfull-e2e diagnosis is a separate environment limitation; immutable-head LinuxCI, targetedscope and actualDEV acceptance remain necessary and must pass. Old fullJS job ended before edits; no unrelatedprocess terminated.

Closure targeted receipt:14pass0fail/skip/cancel, including real-font bounce-5; current exact-one headerlint green. CIobserved474e2e tests; raise owned e2eFLOOR to474 to account for both original-restorationTR1 and addedreal-font companion relative to main (neverlowera row). Companionpatch generation follows this settledsource commit before finalCI push.

Final closuremutation receipt: sixcorrected/exact selectors each ran exactlyone named test, baseline1pass0skip/cancel, fault1assertionfailure0skip/cancel. Separate real-font clipped-target companion generatedfromcleancommitted110f036source in detachedscratch. Observedcurrentcorpus1463; original1462union remains historical, not final proof. New final-headfullCI and freshindependentreview pending; application bytes unchanged.

## Correct-baseline regression-guard amendment — review before execution

Combined independent review P2 found a contradiction: inherited HTC ceilings are looser than existing dev/main, despite this plan's no-increase rule. Prior historical-HTC justification is superseded. No rendered regression was observed (full probes independently pass), but preserving existing regression protection requires currentdev/main oracles, not interrupted-branch values. Relevant differences:667fallback369/371→418.75/420.75; sidebar−56 removed; realbounce372.75→375.25 (and associated cases); SITE_DROP deductions removed. Restore all corresponding accepted-dev budget code/literals/comments, including original exact equations where the compact row satisfies them; do not derive replacement numbers from candidate output. Preserve new Resources inventory/activation/compact-row oracles and strict mutant header contracts. No app CSS, font, data, i18n or probe-budget change.

| Lane | Action and dependency | Acceptance |
|---|---|---|
| ENG independent | Audit baseline budget sections vs existingdev and this correction before source edits | Correct baseline identified completely, no increased ceiling/allowance, all unrelated constraints retained; near10 plan clearance |
| Root sole source author | Restore budget-only sections from immutable existingdev source; keep new trio geometry/visibility and6-link semantics; expand targeted14 checks | Originaldev budget equations/literals match accepted source,14tests pass0skip/cancel; if any tighter bound fails, stop for a reviewed product-layout investigation, never inflate bound |
| Mutation reviewer | Check unchanged/direct fault guards still fail, no weakened lint or missing group | Existing1463 corpus preserved; budget-growth and clipped-font cases baselinegreen/faultassertionred |
| Root candidate assembler | Commit reviewed test-tightening in feature; update already-isolated combined candidate with test-only correction, preserving all21canonical/all8table hashes | No actualdev/main write; floor474feature/475combined; candidates reviewed at exactheads |
| Fresh review and CI | Final source reviews plus fullCI on BOTH candidates, all8language candidateprobes | Every final-head CI job/shard/union green; no prior green run reused |
| Actualdev integration | Wait BOTH final-headCI and combinedreview/probes, then authorizeddevPRmerge and actualserved528-cell acceptance | Mainheld; owner-only release remains |

Sequencing refinement: already-created isolated combined candidate may absorb reviewed **test-tightening only** while feature and combined fullCI run in parallel. This is candidate assembly, not a dev-branch merge; actual dev remains gated on BOTH CI conclusions, fresh review and language probes. It avoids serial duplicate waiting without weakening any release gate. If any production change becomes necessary, regroup into a separate reviewed plan before edits.

Correct-baseline amendment independently cleared9.5/9.6 before implementation. Allfour budget sections and completeSITE_DROP table now match immutable accepteddev code ignoring comments; originalexact guards and positive-scroll assertion retained. Newdirect bothfont geometry/visibility/six-link tests remain. Targeted14pass0fail/skip/cancel under stricter baseline, without anyapp change. ApplicationSHA256 unchanged frome227e3a. Previous combined5ea language probes all8x2fonts8019cells0skip/regression, but both correctedcandidateheads still need freshCI/review. Budget-growth/real-clipping negative checks follow in isolated committed-source scratch.
