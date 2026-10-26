# RAF timing gate: reviewed oracle correction and held measurement

Current status: the narrow correction was independently reviewed and activated as
recorded below. Implementation/proof completed; performance validation remains
HELD after the single permitted current campaign failed during baseline. Original
private research A1 and both earlier FAILED artifacts remain unchanged.

## Verified evidence and limits

- The records200 current campaign FAILED at retained rows[120] (phone/candidate/sample1): firstRAF=secondRAF=244.932; firstCallbackAt247.80000019073486, secondCallbackAt249, captureAt215.5, event215.10000014305115. All reported selection/trust/visibility values were correct. This is a zero RAF interval; strict secondRAF>firstRAF must remain. No memory, HRT or scheduling explanation is established.
- The pure-data control FAILED at retained rows[24] (desktop-before/sample25): captureAt=firstCallbackAt=1144, event1143.7999999523163, RAF1141.9→1158.6. Thus event→first≈0.2ms and frame interval≈16.7ms are positive; only capturedDispatchToFirstOpportunityMs is zero. This is distinct from equal RAF timestamps.
- Both failed artifacts remain FAILED: `sv-held-mouse-profile-selection-records-200-a1.json` and `native-raf-clock-control-a0.json` in this private evidence directory. No retries/new200 run followed the control failure.
- Current source3b07/helper3369; tracked profiler73ead0b048c6df5d39d21996a54369eb7843adb803e136b1097999c25ae60ef5; private control ec2259400f4d9e043f9274444c98db72884b53cbedf989043f9b52182a569e53.
- Browser receipt: Chrome156.0.8078.47, revision1d17a2e2ee147bb7d6ae2ab6abdb3a2510c17775. Attempts to access that exact public revision/tag through Chromium Gitiles and its GitHub mirror failed; implementation claims below use available upstream main, not a verified exact156 source tree.

## Primary sources and justified conclusions

1. W3C HRT defines the monotonic clock as never decreasing, and coarsens exposed time at100µs or a higher implementation-defined resolution (5µs or higher in cross-origin-isolated contexts). Separate chronological observations can therefore expose equal values. This supports zero *observed* elapsed as a valid possibility, not proof of instantaneous work or a guaranteed<100µs bound. [HRT clocks](https://www.w3.org/TR/hr-time-3/#sec-time-concepts), [coarsen time](https://www.w3.org/TR/hr-time-3/#dfn-coarsen-time).
2. Chromium's original M120 announcement states RAF and document.timeline timestamps are coarsened under HRT. It does not identify the cause of either current receipt. [Official blink-dev announcement](https://groups.google.com/a/chromium.org/g/blink-dev/c/vu_BQq4Ay7s).
3. Upstream Chromium Performance::now converts NowTicks through ClampTimeResolution, with the origin clamped separately. This supports treating raw exposed observations as coarsened readings. Upstream main is not exact installed156 proof. [performance.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/timing/performance.cc), methods now, MonotonicTimeToDOMHighResTimeStamp, ClampTimeResolution.
4. HTML snapshots callback handles before invocation. A nested RAF registers after that snapshot; its callback is not part of that same handle list. This supports preserving the distinct-frame-opportunity requirement, without proving that the supplied timestamp will be strictly different in this installed browser. [HTML animation callbacks](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#run-the-animation-frame-callbacks).
5. Upstream ScriptedAnimationController forwards stored current_frame_time_ms to callbacks; AnimationClock holds time within a rendering lifecycle and refuses backwards updates. These are possible scheduling investigation leads, not evidence that equal nested RAFs here are harmless or a Chromium defect. [controller](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/dom/scripted_animation_controller.cc), [animation clock](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/animation/animation_clock.cc).

## Probe and application inspection

- `validateSelectionTiming` already permits firstCallbackAt>=captureAt in monotonic observation ordering, then independently rejects equality through the derived capturedDispatch interval's strict positivity. That extra strict inequality is stronger than nondecreasing exposed clock semantics.
- Actual click-to-first and click-to-second callback latency metrics remain strictly positive and unchanged. These are the compared p95/max budgets; capturedDispatchToFirstOpportunityMs is not used to enlarge those budgets or derive the frame allowance.
- Observer capture records event/current time before the app's selection handler. Its first callback records callback-clock time before reading deck/chip/count state; it registers the second RAF after those reads. Thus second callback latency includes the observer's first-callback work and application rendering/scheduling. Both arms use the same observer, but205-versus8 chips can change query work; this is not isolated application CPU attribution.
- Current `selectDeck` updates selection/order/chips/render/route synchronously and initiates preference persistence. The snapshot listener avoids rebuilding preference-only/no-op snapshots. Neither inspected path patches native performance.now or RAF; no app-state failure was observed in either retained timing failure.
- Host free-memory decline is contextual only; it does not establish memory pressure, swap, compositor behavior or causality. Pure-control failure did not reproduce the equal-RAF symptom.

## Recommended narrow oracle correction

Change only the validation of **capturedDispatchToFirstOpportunityMs** from strictly positive to finite **nonnegative**, while retaining the exact raw measured zero and reporting it as resolution-limited observed elapsed. Do not replace zero with epsilon,100µs, inferred duration, a later callback, or a filtered row.

This is an explicit semantic correction proposal, not a100µs latency tolerance. Keep unchanged:

- strict secondRAF>firstRAF and finite positive observed frame interval;
- finite positive event→first and event→second latency;
- all monotonic observation and cross-row conditions, existing1ns cross-API representation-only rule, raw timestamps and summaries;
- all click-latency p95/max limits, pooled frame-based allowance, A–B–A stability rules, fixed180 rows/6documents for a full case;
- all functional/trusted-input/visibility/storage-drain checks, source/helper/case pins, quiet-window and external budgets;
- no warmup, sample exclusion, favorable-arm reuse or retry.

A zero event→first latency, nonpositive frame interval, backwards capture clock or equal nested RAF still fails and stops. No additional guard is widened automatically if another boundary fails.

## Swarm-shaped implementation proposal, held for review

- Coordinator/root: owns amendment approval, isolated worktree, browser lease, source hashes, ledger checkpoint, raw evidence and stop decisions. Original failures remain immutable.
- Test lane T: owns ONE spec-first pure nonbrowser registration in existing `tests/app.test.js`, beside its established panel-fit probe-judge unit tests (currently around4460), and only its tests/suite_health.py row938→939 after accepted registration count. This existing file already houses pure tools/probe oracle tests; no new test file or harness/native registration is needed. Native e2e floor488 and harness67 stay unchanged.
- Tool lane S: owns `tools/probe/saved_variants_selection.js`; separates capturedDispatch nonnegative validation from the other three positive intervals and updates exact preflight/report policy metadata. NO new CLI flag, export, runtime entry point, module abstraction or sampler/latency/budget change.
- Proof lane P: independently generates `tests/mutants/selection_capture_elapsed_strict_positive.patch` by editing the committed corrected oracle back to>0, git diff, removing index lines and adding exact new-group #kills/#suite metadata per CONTRACT. It must fail the new pure boundary registration, with no browser.
- Reviewer lane R: independent ENG verifies measurement mathematics/boundaries/pins; design verifies preserved user-visible responsiveness limits, honest claims and held-gate behavior. Authors do not review themselves.
- Private control adapter is generated from the newly frozen exact validator/preflight block; only approved block/provenance pins change from controlA0. Fresh script/output names; fixed90samples retained.

## Spec-first boundary acceptance

The pure test reads the source under test, requires unique exact BEGIN/END literal-timing markers and extracts the ACTUAL validator/preflight block. It runs that unmodified block and independent literal boundary fixtures in a restricted pure Node VM with an explicit1000ms timeout, only the existing Node assert capability and fixture data—no require/process/fs/network/browser in the VM. No full probe evaluation or CLI launch. Source reading is how the real implementation is exercised, not how expected values are derived.

The independent table contains literal expected accept/reject outcomes and untouched raw inputs, not values/formulas scraped or reconstructed from the validator. Record/assert raw equality before/after. The source's existing preflight must also execute and retain all current outcomes. The one registration is proposed as `SV-TIME-1: the actual selection timing oracle accepts observed zero capture elapsed while preserving strict latency and RAF boundaries`.

Freeze this test against ORIGINAL probe73ead0 BEFORE any source edit. Its valid-zero fixture must produce the intended named valid-zero acceptance assertion RED, not marker/VM/preflight/setup failure. Only after independent acceptance may S change the one comparator/policy. For the independent strict-positive mutant, a named valid-zero preflight/assertion rejection is the intended RED; any other failure is not a kill.

1. Literal retained pure-control row25: accepted, raw capturedDispatch elapsed exactly0, event→first positive, frame interval positive.
2. Representable smallest positive captured elapsed: accepted; same raw value retained.
3. Representable negative captured elapsed: rejected, no tolerance (monotonic-order guard remains).
4. captureAt==firstCallbackAt plus eventTimestamp==firstCallbackAt: rejected (event latency0).
5. Original retained records200 equal-RAF row: rejected despite all functional checks.
6. Existing zero/backwards RAF, nonfinite clocks, cross-row reversal, exact1ns and just-over1ns preflight cases all retain their prior outcomes.

TDD: freeze the new tests, show old strict oracle fails the intended named valid-zero expectation, implement only the capturedDispatch finite>=0 condition plus literal preflight/report policy, require GREEN, apply the independently generated strict-positive fault and require that same valid-zero expectation fails, restore and require GREEN. No native run is necessary for this mathematical gate. CLI behavior and invocation stay unchanged; broader plumbing stops for review.

## Bounded future execution sequence

After independent reviews and root's explicit clearance only:

A. Preserve all old receipts and complete pure boundary/fault/restored proof; freeze corrected source/control/helper/case hashes. Run ordinary nonbrowser checks and inspect diff. No device claim.
B. One freshly named pure-data control: same90samples/3fresh documents desktop→phone→desktop30each, identical nested sampler and every remaining strict guard, external90s supervisor. No extra eligibility runs. Root retains vm_stat/memory_pressure snapshots observationally; no owner process changes.
C. If control fails any remaining input/clock/visibility/count/cleanup condition, stop and hold the performance gate. Do not restart, skip first rows or invoke200.
D. If control passes and an independent reviewer accepts its complete receipt, at most ONE freshly named complete records200 campaign180rows/6docs under existing180s per-case supervisor. No prior arm reused. All prior failures remain FAILED and linked.
E. Any equalRAF, invalid clock, unstable A–B–A arm, measured budget regression, skipped/missing row or cleanup failure stops with gate held. No further automatic run. A full pass is qualified evidence for the revised explicit contract; it does not resolve the original equal-RAF cause.
F. Any claim of new exact-current performance for other case sizes must reference their original contract/pins; if contract labels materially change, separately review the necessity/budget of a fixed whole campaign, not opportunistically repeat favorable subsets. No such additional run is authorized here.

## Approval, fallback and rollback

- This author turn grants private planning only. Parent has recorded independent ENG/design assessment that the narrow unbudgeted-subinterval correction fits saved-variants-through-DEV scope. Root must still record final review CLEAR and explicitly activate T/S/proof lanes and the bounded execution sequence; this plan does not itself authorize tracked edits or browser runs.
- The narrow correction changes the accepted diagnostic contract and must be disclosed explicitly; it preserves every owner-facing measured responsiveness budget and strict RAF requirement. Root may activate this independently cleared scope under standing through-DEV authorization. Any proposed widening of actual latency/RAF/sample/quiet-window criteria, privacy flag/global setup change or additional run beyond the reviewed sequence needs separate review and applicable explicit owner approval; no automatic scope expansion.
- No CLAUDE.md, global setup, app behavior, main merge or full Mac run is included. Those existing separate approval boundaries persist.
- If reviewers find the nonnegative correction unjustified or the owner declines a contract change, hold the gate. Alternative: preselect one existing separately available host/browser environment, freeze version/flags/helper and repeat the original protocol under a separately approved fixed campaign; do not install tools or modify privacy/security flags merely to make timestamps pass. Results are environment-specific and must include matched baselines.
- Rollback isolated oracle/test/receipt-policy/fault changes together; retain old/new failed and passing artifacts. Restore the old held gate, rather than relabel old results. Unexpected concurrent changes must be preserved.

## Receipt revision and immutable failure policy

- Newly produced corrected-protocol receipts receive an explicit revision, for example `saved-variants-selection-aba-v2`, with diagnostic policy fields identifying `capturedDispatchToFirstOpportunityMs: finite-nonnegative`, `zeroMeaning: resolution-limited observed elapsed; no inference of actual zero work`, `RAFAdvance: strict-positive`, and unchanged responsiveness budgets/sample rules. Root/ENG freeze exact field text before S edits.
- Preserve actual raw zero and derived zero; no replacement with ns, epsilon,100µs or inferred value. No old receipt is modified, relabeled or retroactively promoted. Original selectionA1 and nativecontrolA0 remain FAILED under their original contracts and stay linked in new checkpoints.
- The private fresh fixed control must report the same corrected validator revision/policy plus its own control contract identifier; it must copy the new exact marked block and freeze its source digest. Both old and new raw receipts remain recoverable independently.
- PlanA0 remains unchanged. This A1 revision eliminates the proposed CLI addition, selects the existing pure probe-judge test location, makes original-source named RED explicit and records the reviewed through-DEV authorization boundary.


## Coordinator activation — 2026-10-26

Private A1 artifact3151fe40 independently ENG/design CLEAR; both reviewers inspected
actual failure rows, mathematical budget inputs, old/new policy, meaningful original
source RED seam and no-retry execution limits. Root activates ONLY this correction
under standing through-DEV/AFK authorization. Capture elapsed is an unbudgeted
clock diagnostic; finite nonnegative semantics fix an overstrict oracle, with no
changed responsiveness budget, frame/sample gate or app behavior. Prior failures
remain FAILED. The title's private-planning notice describes the original author
phase; this explicit coordinator activation is the current status.

T: /private/tmp/handpan-saved-variants.HVUKbE/timing-tests,
branchcodex/variants-timing-tests-20261026, only app.test.js and its floor939.
S: /private/tmp/handpan-saved-variants.HVUKbE/timing-source,
branchcodex/variants-timing-source-20261026, only selection probe comparator/policy.
Both base2ff71cf5. Root alone integrates and owns all browser runs. Source edit is
held until frozen test's intended original73ead valid-zero assertion RED is
accepted. Independent reviewer audits source/test/fault and native receipts.
No main, CLAUDE, app, infrastructure, privacy-flag or broader runtime change.

Freeze corrected report contract `saved-variants-selection-aba-v2` and fields:
`capturedDispatchToFirstOpportunityMs: finite-nonnegative`;
`zeroMeaning: resolution-limited observed elapsed; no inference of actual zero work`;
`RAFAdvance: strict-positive`. Existing actual responsiveness thresholds/sample
rules stay unchanged. Fresh private control carries corresponding v2 policy and
new exact-validator provenance; old control/report bytes are immutable.


## Executed results and mandatory stop — 2026-10-26

FrozenT c695b1d2 exercises actualoriginal73ead block; intended valid-zero literal
acceptance ERR_ASSERTION RED (1test/1fail/0skip/cancel, no setup failure) accepted
before S edit. Correctedprobe bd6e89f985d17fc010fb7b8a1d2387a500495de26bd2546792ec0b90a473e154
is source-lane commit5e1b274f: only separate finite>=0 capture diagnostic plus v2
policy/report text. Actual event latency, RAF interval, sampling, frame/statistical
budget and source3b07 are unchanged. FrozenunitGREEN1/1; independently generated
faulta719c82f restores >0 solelycapturepredicate and reaches the same named validzero
assertion; exactrestorationGREEN1/1. Independent ENG audited actualT/S/fault.
Fullapp939/939,0skip/cancel passes; mutationmetadata54/54 passes; all1618patches
apply. Floors app939/harness67/native488; only ownapp row raised.

Private v2control adapterb48350b7 uses byte-identical actualbd6 validator block,
explicitv2policy, same90samples/3documents/3arms/no retries and unchangedremaining
guards. IndependentENG cleared before run and independently recomputed ALL90 raw
rows and stdout afterward: PASS, ownedcleanuptrue5.530s, no zero capture samples
occurred. The control establishes only eligibility, not candidate performance or
causal resolution. Its read-only pre/postmemory outputs are observational only.

Root executed the ONE permitted complete records200 attempt under180s bound.
Result FAILED after17/180retainedrows,1/6documents,0completearms/0comparisons.
The only loaded source was originalbaseline5628 (actualHTTP200 body verified,
noSW/diskcache); candidate3b07 NEVER loaded. Sample17Amara passed all functional/
trusted/visible/timing checks. Attempt18Hijaz timed out at the unchanged5000ms
wait for observer rows18; supervisor7.660s, no outertimeout, ownedcleanuptrue.
There is no retained partial sample18observer state, so missing click versus
stalled callback versus another cause cannot be distinguished. This is INCOMPLETE
performance validation, not a measured candidate budget regression. No more
measurement runs are authorized by this plan; do not retry or increase a deadline.

Performance/DEV gate remains HELD. IndependentENG agrees with this stop and causal
limits. Next: read-only baseline/observer investigation; separately reviewed
failure-only partial-observer diagnostics and explicit available-environment/
budget decision before further measurement. Any acceptance of a performance
limitation requires owner input. Newhost installs/global/browserprivacy changes
remain outside this scope. Continue independent functionalCI/Helpers work while
held; never promote targetedunit/control successes into fullperformance/DEV.

Raw receipts under /private/tmp/handpan-saved-variants.HVUKbE/evidence:
- timing-oracle-unit-{red,green,fault,restored}-a0.stdout.tap and fault-proof-a0.json;
- timing-oracle-all-apply-a0.json;
- native-raf-clock-control-v2-a0.{cjs,json} and memory snapshots;
- sv-timing-v2-selection-records-200-a0.json.
Supervisors under /private/tmp/handpan-share-hotfix.urAbvO/evidence:
sv-native-raf-clock-control-v2-a0, sv-timing-v2-selection-records-200-a0,
sv-timing-full-app-a0 and sv-timing-metadata-a0 (json/stdout.tap/stderr.log).
Earlier failed original-contract reports stay immutable and FAILED.
