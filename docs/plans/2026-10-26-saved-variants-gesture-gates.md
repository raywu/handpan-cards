# Saved variants — remaining gesture verification gates

Draft amendment for independent engineering/design review before test changes.
Runtime remains3b07/indexc55; helper178 and native8fbf. Owner's through-DEV
variants authority applies; no app/helper/CLAUDE/global/main changes proposed.

## Evidence and scope

CI40358865648 at3239eafd: all488native run,487pass/one mouse commit1/49
failure. Three mutation shards pass; shard3 has only surviving Q15
sw_mouse_buttons_check_dropped.patch. Current native Q15 zero-buttons transport
can also deliver a competing release, so its null-drag observation does not isolate
absence of pointerup/lostcapture required by the existing off-window guarantee.
Two ordinary local five-target runs reproduce the commit failure. Four private
preload variations pass; preserve every result and do not call the failure fixed.

## File-owned lanes

Root owns plan/ledger, source-bound pins, sole browser lease, integration and CI.
Gesture-test lane edits only tests/e2e.test.js in an isolated current-head tree
following review. Independent ENG/design are read-only non-authors. Existing
source/helper/mutant remain frozen. Helpers work continues in separate DEV-based
worktrees and may not change this native file or run host browsers.

## Proposed test-only changes and bounded investigation

1. Retain all Q15 native trusted-press/zero-buttons/real-release transport evidence
   and existing assertions. Add a separately labelled controlled missing-OS-release
   phase: fresh trusted mouse press must create a live actual captured drag;
   within one page task dispatch only a DOM PointerEvent(pointermove) with the
   observed live pointer id, pointerType mouse and buttons0 to the actual card.
   Before DOM dispatch, a genuine buttons1 move must establish an actually moved
   captured drag; record the same live pointer id/card identity, native
   isTrusted=true and DOM isTrusted=false. Record live state before and null after;
   no pointerup/lostcapture may intervene in that task. This isolates the existing
   guard without replacing app functions or claiming DOM delivery is native OS
   delivery. The original unchanged guard-deletion fault must fail at the new
   literal release assertion. Preserve the native arm unchanged. After the controlled cancellation, the
   count must remain unchanged, the spring settle, and the next genuine release/
   click must flip relative to its pre-phase state, without stuck eatClick.
   Always real-release cleanup; do not synthesize
   trusted events, force drag state or replace release handlers.
2. Capture the post-drag failure in existing expectCount failure handling, only
   for its mouse-commit label, preserving the target test body, all success-path
   CDP calls and5s deadline. Capture count/index/boot/selection/mode, drag/flight,
   animation state/clock/geometry/focus/visibility and helper pending-release info;
   then retain the original failure. Diagnostic failure must not replace it.
   No success-path observation, delay or threshold change is a repair.
3. Predeclare bounded source-pinned plain combined and isolated experiments;
   preserve both pass and fail results. If diagnostics perturb failure occurrence,
   document that and move observations to already-occurring transport callbacks
   rather than running until green. Native event ordering/capture or boot/layout
   readiness claims require direct evidence. No source/helper change without a
   causal RED and a separately reviewed minimal repair proposal.

## Acceptance and stop conditions

Root independently reviews source diff and freezes hashes. Q15 clean/fault/
restored must select exactly its one original registration, green/ERR_ASSERTION/
green, no skipped/cancelled/startup/timeout kill. Check actual trusted live drag,
single-task same-pointer dispatch and real cleanup. No fault remap or retirement.
Existing mouse commit, click flip, short-drag springback, touch/pen/reduced-motion
and capture error cases remain unchanged or receive only demonstrated necessary
fixture corrections. New assertions are within an existing registration; no floor
lowering. A diagnostic pass alone never closes the preserved ordinary failures.
Independent final diff/evidence review, full exact-head Linux validate/allmutation
shards and actual servedDEV behavior remain required. Main stays held.

Rollback only owned unmerged test edits; preserve all failed evidence and other
worktrees. Recovery pointers go to shared ledger and the authorized existing
coordination thread, with exact last/next/source refs.

## Independent review receipt

Engineering review CLEAR, with captured identity/synthetic distinction and original
failure preservation requirements incorporated. Design review requested an actually
moved trusted drag plus observable count/spring/next-click recovery; incorporated
above. Await final design disposition before source changes. No runtime/helper
repair is authorized by these reviews.

## Frozen first experiment

Both plan reviews cleared the incorporated refinements; independent engineering
source review CLEAR on testSHA09f09f53450b83c7b8b8f59f1a3c031eaec014390a15b2a06302e329b8e4b980.
Root runs exactly one ordinary six-target command, no preload,90s outer bound,
source3b07/helper178. Selection: deck switching, generated-scale tier, post-drag
mouse commit, Q15 off-window, Pygmy bottom-swap, SV11E1 held chip. Expect6selected,
zero skips/cancellations; preserve failures and state, no retry until a diagnosed
change/new evidence warrants another experiment. This is scoped evidence only.
