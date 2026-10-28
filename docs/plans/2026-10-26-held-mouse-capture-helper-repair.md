# Held mouse capture helper repair — swarm-shaped plan, execution held

## Decision and evidence limits

1. Obtain independent engineering and design review before authoring tests or changing the helper.
2. Investigate the lower-level held-pointer contract independently of saved-scale app state.
3. The A–B–A experiment stopped at A1 because original helper178 unexpectedly passed all5 cases; B/A2 never ran. Restoration and cleanup passed. Do not retry or reinterpret this as causal proof.
4. Original post-drag failure remains unexplained even if future tests/CI pass.
5. A separate Q15 experiment observed a live trusted24px mouse drag but lost pending capture with omitted `button`; explicit `button:"left"` retained capture and passed the isolated cancellation/recovery phase. This supports a candidate transport defect, to be demonstrated in a minimal native fixture before repair.
6. Primary protocol schema distinguishes optional `button` (default none) from `buttons` (left bit1); schema validity does not itself prove installed runtime behavior.

## Frozen baseline and authorized boundary

7. Base runtime index3b07a2728772c263b2082c75000f8bec47773628aaaadcc5fa2d9019d061316e; original e2e8fbfe58b6131fed89d4d33d4ce1325fcb76adc755160f9b5fb3794f9099beb00; helper178e034c3d9395bd92a7250b50b8ec5858bb177bb6678e500870699701b50826.
8. Candidate helper3369d0b0df433335d5191ed6d3ce4b4fdbdd699df2afbf1e3701afe7db3d02e3 adds only `button:"left"` to Browser.drag's held mouseMoved dispatch.
9. No app, CLAUDE.md, global configuration, dependency, physical-input threshold, timing or default activation change. No full Mac suite or main merge.
10. Preserve the existing native Q15 arm and controlled phase; controlled genuine held move keeps explicit `button:"left"`. Its synthetic signal remains honestly scoped, not physical OS coverage.

## Lanes and ownership

11. Coordinator/root: freeze inputs, own integration/worktrees, serialize every browser invocation, retain raw artifacts and update workstream ledger/plan references.
12. Test lane T in a separate worktree: own only tests/harness.test.js and its one registration floor in tests/suite_health.py. No helper edits.
13. Source lane S: root or separate author owns only tests/helpers/cdp.js, one field after native RED is independently accepted. No test edits.
14. Proof lane P: independent reviewer owns GENERATED committed tests/mutants/cdp_mouse_held_button_omitted.patch and source-bound result assessment; no browser parallelism or own-change approval. This exact new-group #kills/#suite artifact must satisfy tests/CONTRACT.md, with no blob index line.
15. Review lane R: independent ENG review of fixture/causal contract, design review of scope/qualification and regression protections, final diff review by a nonauthor.
16. Lanes may prepare source independently, but root alone executes browser tests. Test and source authors cannot supply independent final approval of their own work.

## One native fixture registration

17. Proposed title: `CDP-MOUSE-HELD: Browser.drag retains actual pointer capture until genuine release`.
18. Add inside existing browser-available run() in tests/harness.test.js; reuse FG-10's owned launch/data-document/finally-close pattern. A static data:text/html fixture needs no app, storage, local service, auth or network.
19. launch({foregroundSettle:true}); navigate to a uniquely named minimal fixture; wait literal readiness, call existing settle once before gesture, assert visible usable hit-tested fixed-position target. No foreground work during held gesture.
20. Fixture contains one #card surface with touch-action:none and no transforms, overlays, animations, timers, app logic or mutation. Its real pointerdown handler calls setPointerCapture(e.pointerId).
21. Fixture records trusted pointerdown/move/up/cancel/gotpointercapture/lostpointercapture at document capture phase plus actual same-target handlers; record id/type/button/buttons/isPrimary/coordinates/target/capture and bounded sequence order.
22. No event synthesis, patched app/helper functions, transport parameter assertions, external observers or custom CDP dispatch replacing Browser.drag's held move.
23. Invoke real `b.drag('#card',[[24,20]],{pointer:'mouse',release:false})`. This must itself supply the genuine press and held move with no extra RPC inserted between them.
24. Immediately read one snapshot: real pointerdown/move trust and same pointer ID/type, move buttons1, expected24px coordinate delta, target identity/connectivity, pointer capture, got/lost capture and release/cancel events.
25. Log the full bounded snapshot and first assert trusted native primary mouse down/move, same target/id/type, buttons1 and24px delta. Only then assert actual #card.hasPointerCapture(actualPointerId) is literally true: the intended RED is this literal capture assertion, not missing input, absent readiness or timeout.
26. Also require a trusted primary mouse down on target, trusted same-id buttons1 move on target, exact24px delta within1px, and gotpointercapture for that actual pointer before/at move.
27. Require no up/cancel/lost capture before genuine release. Observed event order and trust are behavioral evidence, not outgoing-parameter mirrors.
28. Release genuinely through existing b.releasing + Input.dispatchMouseEvent mouseReleased at the last coordinate with button:left, then drain pending settle.
29. Require trusted same-id mouse pointerup and lostpointercapture, __cdpLpcSeen===true, no retained capture and released fixture state. Require exactly one genuine same-target release click (the fixture sends clickCount1 and keeps down/up on its plain user-select:none card); do not conditionally waive this or invent app flip semantics.
30. Always send real release in finally if press may have occurred, drain own pending release and close own Browser. Preserve original assertion if cleanup fails and attach cleanup error. Root supervisor verifies no owned processes/profile remain.
31. Missing Chromium may follow existing harness skip convention, but skips do not satisfy proof. No literal0 skipped / expected registration means no accepted result.

## Meaningful RED → GREEN → fault → restored

32. Freeze test source and floor before RED. Baseline helper178 must fail the intended literal retained-capture assertion with actual trusted press/move and bounded snapshot; generic timeout, absent input, navigation failure or cleanup failure is not RED.
33. If native fixture instead passes on helper178 or fails another precondition, stop without helper implementation, preserve evidence and reconsider hypothesis. No retries to obtain desired RED.
34. Root runs exact one new native registration under supervised90s; normal execution expected seconds. Preserve source/helper/test hashes, command, environment-key names only, raw TAP/stderr and owned cleanup receipt.
35. After independent RED acceptance, source lane changes ONLY held mouseMoved parameter by adding button:left; keep buttons1, timestamps, coordinates, touch path, release path, pending capture handling and APIs identical.
36. Run same frozen native fixture once on candidate helper3369; require1pass/0fail,0skip/cancel and all behavioral observations.
37. Independently authored committed fault removes only the new button:left field, generated by editing a committed candidate then git diff and stripping index lines, with literal new-group headers. Same fixture must fail at the original capture assertion; do not remap the fault for a kill.
38. Restore exact candidate helper, rerun same fixture once and require same GREEN. Verify all pins and cleanup after every arm.
39. One reviewed registration increases tests/harness.test.js floor66→67 in tests/suite_health.py. Keep native e2e floor488 unchanged. No count reduction or unrelated floor changes.
40. No broad mutation corpus rebaselining; retain Q15 existing fault unchanged. New committed remove-left fault has explicit filename/hash, selects exactly one new harness registration and maps only to the observable held-capture contract.

## Regression and integration gates

41. Root runs existing full harness suite within its established supervised budget; no deadline increases. Check actual67 native-capable registrations and no unexplained skips.
42. Run scoped original app post-drag and Q15 registrations with exact existing app assertions, same bounds and body. Their passing result is regression evidence only; original post-drag cause remains unproven.
43. Reprove existing Q15 clean / unchanged sw_mouse_buttons_check_dropped fault / restored with actual moved/captured guard and explicit held button; mutant must reach intended null-state assertion, not setup failure.
44. Preserve and execute existing touch, pen, capture-release, short/long mouse drag, click-after-drag and off-window/cancel coverage; use current registered cases, no invented physical OS claims.
45. Compare Browser.drag's touch branch byte-for-byte unchanged and inspect all callers for mouse assumptions; do not expand supported pointer types or claim its non-touch branch is a pen API.
46. Independent final review verifies one-field helper diff, native fixture independence, floor67 only, original native Q15 arm retained and honest synthetic qualification.
47. Run full exact-head Linux CI: all JS/native, mutation shards, data/Python and panel checks. No retry-green waiver, skip, timeout increase or survivor acceptance.
48. A passing full suite does not resolve original intermittent post-drag causality or establish all harnesses/physical devices; record that limitation explicitly in recovery checkpoint.
49. DEV integration remains under saved-variants scope and current release queue; main requires separate owner consent. Do not fold unrelated helper/resource workstreams into this change.

## Recovery and stop conditions

50. Stop on unexpected source/test/helper pins, concurrent worktree changes, untrusted/missing inputs, fixture baseline not RED, wrong failing assertion, timeout, nonempty unexpected stderr, failed cleanup or differing restored result.
51. Save nonsecret checkpoints with plan, branch/worktree, immutable source/test/helper refs, exact stopping point, next action, raw artifact locations and unresolved original post-drag limitation.
52. Browser failure never licenses killing unrelated Chrome processes or deleting preexisting owner profiles; only root-owned launch/profile evidence authorizes cleanup.
53. Private fault restoration must preserve unexpected concurrent bytes rather than overwrite them; halt for coordinator resolution. Finally verify candidate or original approved bytes as appropriate.
54. Rollback is isolated one-field helper reversal plus corresponding new test/floor change only after review; preserve failing proof and independent rationale. No application rollback needed because app source is untouched.
55. If lower-level fixture cannot independently demonstrate defect, retain current helper, hold repair, and continue bounded original-failure investigation under a separately reviewed plan.

## Approval and current status

56. Planning authored only. Tests, helper repair and browser execution have not begun under this plan.
57. Required next action: independent ENG and design review, then coordinator authorizes lanes and root-only literal native RED. This author cannot count as independent review of this plan's later implementation.

## Review corrections incorporated — 2026-10-26

Root incorporated independent engineering/design findings: #card matches the
existing release observer; real capture-loss and __cdpLpcSeen are mandatory;
exactly one genuine release click is fixed before proof; native input prerequisites
are validated before the capture oracle; the new group receives a committed,
properly generated exact-header fault. A0 private draft is preserved. No test or
helper implementation begins before reviewers clear this corrected artifact.

## Executed native contract proof — 2026-10-26

Corrected planA1 SHA2e6efafd cleared independently by ENG/design before T wrote
fixturee50708252b98a4912350abd25103599555b4e06c502f842a75dd6c5fd5e0f3d2.
One native registration selects exactly1test. Baselinehelper178 delivers trusted
primarysame-id down200→buttons1move224 on the connected target, but actual capture
isfalse: intended literal capture AssertionErrorRED. Root's conditional one-field
helper3369 (isolatedsourcecommit429d83f7) gives gotcapture→heldmove with capturetrue,
then genuineup/lostcapture, observed__cdpLpcSeen, no retainedcapture and exactly1
click. Removingthefield withthe generated committed-source newgroupfault restores
that exactcaptureASSERTIONRED; exactcandidate restoration returnsGREEN. All4runs
have0skip/cancel/timeout/unexpectedstderr, correctcount1 andsuccessfulownedcleanup.
Root accepted RED before the source edit; independent non-author ENG audited all
fourrawreceipts andtheone-fielddiff CLEAR. Fullharness67/67 also passes in13.7s,
zero skipped/cancelled, sourcehelper3369. Its ownfloor67 is integrated. Existing
runtimeindex3b07 remains unchanged; old A–B–A inconclusive result remains preserved.

New artifact: tests/mutants/cdp_mouse_held_button_omitted.patch; properly generated
from committedcandidatehelper and targets only the newnativeharnessgroup.
All1617patches apply after integration; nooriginalfaultidentityremoved.

Receipts: HV/evidence/held-mouse-tdd-receipt-a0.json,
held-mouse-all-apply-a0.json; SHC/evidence/sv-held-mouse-native-{red,green,fault,
restored}-a0 andsv-held-mouse-full-harness-a0. Expand HV to
/private/tmp/handpan-saved-variants.HVUKbE and SHC to
/private/tmp/handpan-share-hotfix.urAbvO. Source/test/source-lane worktreesremain
separate; root integration owns publication. These arelocalproofs, notCI/DEV or
physicalinputsuccess. Original intermittentpostdrag cause remainsunproven.

Next: focused existinggesture/app regressions, unchangedQ15 fault proof, metadata,
independentexacthead finalreview, fullLinuxCI andactualservedDEV. No main merge.

Dependency rebind: first refreshed profile attempt correctly stopped BEFORE any
browser/measurement because both existing CLItools still pinned oldhelper178.
Raw sv-held-mouse-profile-selection-empty-a0 retained (setup guard failure, not
performance failure). Rebind only the two HELPER_SHA constants to independently
reviewed3369; no command, sample, timing, threshold or oracle change. Fresha1
campaign required; never labelthea0guard failure a measurement success.


## Latest validation checkpoint — 2026-10-26

Executed regression selection:18/18 pass,0skip/cancel, owned cleanup true
(SHC/sv-held-mouse-gesture-regressions-a0). Unchanged Q15 fault now has literal
clean/fault/restored proof:1pass/intended null-state AssertionError/1pass;
HV/evidence/q15-final-proof-a0.json. The fault can fail the original native arm
before the controlled phase; do not claim the latter executed on that failing arm.
All1617 patches still apply after tool-pin rebind
(HV/evidence/held-mouse-all-apply-a1.json). Metadata54/54 passed earlier at the
same helper/test/fault inputs. No original IDs were dropped or floor lowered.

Fresh selection campaign a1 passes empty/2/20-record cases, but records200 is
FAILED at retained row121: phone/candidate sample1 has firstRAF244.932 equal to
secondRAF244.932, despite advancing callback times. Correct strict guard refuses
this interval. Do not relax it or apply the1ns representation tolerance to zero
intervals. Desktop arms and phone baseline-before do not replace incomplete
candidate/after arms; only121 rows were captured. Low free memory is observational,
not established cause. Failed receipt and all rows remain preserved under
HV/evidence/held-mouse-profile-campaign-a1.json and its referenced SHC raw reports.
Backend4-case refresh was not run after failure. Historical720 selection and120
backend samples on oldhelper178 remain qualified historical evidence only.

Independent ENG accepts publishing the immutable candidate to obtain full CI
while this performance gate remains explicitly unresolved. DEV integration still
requires final addressed review, successful exact-head full validate, accepted
performance evidence and actual served-DEV verification. One separately reviewed
pure-data clock control and, only if valid, at most one complete unchanged180-row
records200 revalidation are proposed; neither has run at this checkpoint. A later
pass must retain the original failure and unresolved cause, not erase it.


The separately reviewed private native clock control (scriptSHAec225940) ran once
under90s root supervisor and stopped at retained row25: captureAt equals
firstCallbackAt, violating the unchanged strictly positive capture-to-first
interval. Its RAF interval is a different check from the earlier equalRAF failure.
Result FAILED, owned cleanup true in2.322s;25/90rows retained, no retry and no
records200 rerun. Read-only memory_pressure -Q/vm_stat command outputs are retained
before/after; they do not establish cause. Independent failure assessment pending.
Artifacts: HV/evidence/native-raf-clock-control-a0.{cjs,json},
native-raf-control-memory-{before,after}-a0.json and SHC/evidence/
sv-native-raf-clock-control-a0.{json,stdout.tap,stderr.log}. Performance remains
held; publish code for CI without representing this gate as passed.
