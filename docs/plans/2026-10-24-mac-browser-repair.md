# Mac browser repair: activation-sensitive frame waits with preserved test oracles

## 2026-10-25 execution amendment — narrow, explicit interactive frame policy

This section supersedes earlier planning-only/activation-choice status for the
scope below; historical evidence and other gates remain intact. Owner explicitly
authorized contract review, separate TDD/helper lanes, independent review, full
Linux CI and DEV validation. No app, CLAUDE.md, global configuration or main edits
or release are included. A larger full-Mac collection budget remains a separate
decision. Do not use this authorization to broaden the remaining M2/M3/C1 tracks.

P1 completed at main96c4c589 / tree7705d17c. The unchanged print-Enter test failed;
passive trace failed at its first real rAF; one after-launch activation still
failed; one activation immediately before first settle passed original assertions;
passive reversal failed again. Each run executed1, skipped/cancelled0, with original
CDP limits. Independent evidence review cleared this narrow conclusion. Published
receipt: https://github.com/raywu/handpan-cards/pull/571#issuecomment-6398951284 .
Late activation is a mitigation hypothesis, not a Chromium cause. Sparse samples
do not isolate the visibility-changing operation; extra-RPC timing is a confound.

### Concrete contract for review before source edits

1. Default launch/Browser behavior remains neutral. Add one explicit instance
   policy, `launch({ foregroundSettle: true })`, for suites that intend foreground
   interactive rendering. The main e2e suite opts in at its launch after caller
   audit; the original print-Enter assertions and real input remain unchanged.
   Do not opt in other suites/tools mechanically. No per-call API is required.
2. For an opted-in instance, every `settle()` first prepares its current attached
   session with one `Page.bringToFront` RPC, then performs the existing real first
   rAF and unchanged animation poll. No one-time readiness cache, retry, sleep,
   rAF bypass, animation finishing or reduced assertion is permitted. The session
   must be attached; missing session is an explicit error, not browser-wide fallback.
3. `eval`, `send`, navigation/readiness polls, viewport, screenshot, release,
   `deferPendingSettle` and neutral instances do not acquire activation side effects.
   Arbitrary rAF expressions and drawer-specific frame waits remain out of scope.
   Existing release listener/event/two-frame ordering stays unchanged. This patch
   does not claim to repair every Mac frame path or the full suite.
4. Activation rejection propagates its original cause before any settle frame or
   animation-success work. One activation uses the existing20s RPC deadline; no
   new timeout setting. It precedes the existing up-to20s first-frame evaluation
   and animation poll with500ms ceiling plus its existing per-RPC response latency.
   A conservative composed path is approximately60.52s (preparation20s, first
   frame20s, existing animation polling/last in-flight RPC up to about20.52s).
   Neither500ms nor20s is an end-to-end settle guarantee. The180s small-job envelope
   remains separate from collection budgets and cleanup qualifications.
5. Close marks the Browser closed before cleanup. A settle requested after close
   rejects without readiness/frame work. If close wins during readiness, a later
   successful activation response cannot initiate a frame/animation evaluation;
   the attached session must still be the one prepared, otherwise reject rather
   than synchronizing a different target. An already dispatched RPC may remain
   pending under its original20s deadline: the guard prevents subsequent work,
   not instantaneous transport cancellation.
   activation rejection still retains its original cause. Do not globally guard
   transport/coverage teardown or invent a new arbitrary input cancellation API.
   Existing teardown ownership and synchronous reaping remain authoritative.

### Spec-first oracles, lanes and bounded validation

- T owns tests/harness.test.js and minimal e2e launch/fixture changes in its own
  worktree. Derive expectations from this contract; do not import helper constants
  as the oracle. Establish new controlled-transport assertion-red against unchanged
  helper before H edits. Existing animation/ceiling tests retain their assertions.
- Controlled target transport proves neutral default, correct-session readiness
  before first real frame, preparation on repeated settles after target becomes
  hidden again, original rejection/no retry, missing session, and close winning
  pending readiness without subsequent frame/animation work or unhandled rejection.
  It must model a frame that fails observably when target readiness is absent,
  rather than only spy on a CDP command name.
- A real one-process/two-target fixture establishes A hidden/B visible as a setup
  precondition, unique target sentinels and real A-owned rAF completion. Neutral
  observation on A preserves the target states. Opted-in A settle makes A visible
  and advances its frame marker without changing B's sentinel; repeat after B is
  foregrounded again. No mocked visibility or indefinite background-frame wait.
  Failed precondition is a failed validation, not a skip/pass. Native test scope
  does not certify Safari, physical devices or other suites.
- H owns tests/helpers/cdp.js in a separate worktree, only after the exact contract
  and T's red oracle are reviewed. Keep the implementation small and opt-in.
- Root integrates, owns test floor rows and docs/WORKSTREAMS.md receipts. A later
  independent mutant lane generates real Git diffs from committed source; each new
  contract group needs clean-green/fault-assertion-red proof, never timeout as kill.
  Reuse existing animation/release mutants only if their exact current intent still
  holds. Preserve existing headers and regenerate stale contexts, not bad verdicts.
- Root alone operates host browser under one lease. Freeze exact test titles and
  counts before each run; use the reviewed180s supervisor for small selections.
  Targeted gates include new harness cases, original print-Enter, existing lifecycle,
  deferred pointer/capture and C1 mouse guards, and affected font/background checks
  where bounded selectors permit. No full-Mac collection until separate budget and
  supervisor approval. No tests/config change to conceal M2/M3 or lower floors.
- Fresh independent engineering and interaction reviews precede source edits and
  review the integrated final diff/evidence later. Full exact-head Linux validate
  must execute substantive jobs and account for all tests/mutants before DEV.
  Main-target CI PR stays HELD; DEV companion follows the existing same-head gate.
  Prove app/engine/deck bytes unchanged and inspect actual served DEV content and
  affected journeys; helper-only delivery is not a new app feature. Report any
  unapproved full-Mac gate as incomplete rather than full-host readiness.

### Ownership and recovery checkpoint

Root integration worktree `/private/tmp/handpan-mac-repair.c94d3kno/integration`,
branch `codex/mac-foreground-20261025`, base96c4c589; host ray-Mac. Private artifacts
are under sibling evidence/. Original dirty/locked worktrees are untouched.
At this checkpoint only the plan is edited. Next: independent contract review,
then allocate T/H worktrees, preserve TDD red receipt and integrate bounded source.
On lost ownership, dirty conflict, unavailable dependency or failed oracle, stop
dependent writes and preserve evidence; no reset/unlock or unknown-process cleanup.

---

Status: **draft for fresh independent engineering and design review**. This Mac
author lane is planning-only: no diagnostics, browser/test runs, helper/application/
test edits, commits, pushes, merges, installation or global configuration changes.
The integrator may commit and publish this reviewed plan under the separately
approved repository-documentation batch; that publication grants no runtime or
repair-implementation authority. The author lane cannot commit until the
integrator explicitly asks. Obtain approval of the reviewed execution scope
before starting the runtime phases below. No `CLAUDE.md` change or indirect change
to Claude's existing workflow is included.

## Outcome and limits

Make the repository's existing browser harness reliable on the supported Mac
host while preserving real frame/animation synchronization, pointer semantics,
test assertions, timeout limits, cleanup and Linux behavior. A passing isolated
print case is insufficient to call the full Mac suite repaired. Keep separate
evidence for the historical Mac frame stall, its four viewport assertions, a
known Mac Japanese fit discrepancy, and the isolated Linux mouse-drag failure.
Do not make the shared DEV-ledger implementation wait for this repair plan.

Use [the shared browser runbook](../testing/browser.md),
[the test contract](../../tests/CONTRACT.md) and the existing project rules in
[CLAUDE.md](../../CLAUDE.md). These remain authoritative; this plan does not
activate copied global skills or replace their behavior.

## Verified baseline and evidence provenance

Planning worktree: `/private/tmp/handpan-continuity.pcdoqu/mac-repair-plan`, branch
`codex/mac-repair-plan-20261024`, clean starting commit
`e314f858acf3b36fd01ebfcc9e7db37fa46857ef`. This is an inspected local baseline,
not a claim that remote main/dev cannot subsequently advance. Reverify source,
ownership and current accepted branch state before approved execution.

| Finding | Classification and source | Implication |
|---|---|---|
| Historical full Mac run exceeded 900s | Verified retained `full-e2e.json`, `full-e2e.stdout.tap`, `full-e2e-summary.json` under the evidence root below | Complete suite totals unavailable; 197 completed top-level tests, 46 top-level failures plus one nested failure are partial observations, not a completed test count |
| 43 CDP timeouts and 4 assertion failures | Verified summary/raw TAP: 35 Runtime.evaluate, 7 touch dispatch, 1 mouse dispatch; separate keyboard/viewport assertions | Do not assign every failure to one cause |
| First failing print-Enter test stalls in the first rAF in `Browser.settle()` at 900×900 | Verified isolated/trace/reverse receipts; Browser exit was null at that observation | Activation-sensitive frame scheduling is a supported hypothesis, not a proven Chromium root cause |
| A(fail)→B(activate then settle/pass)→A(fail) | Verified `print-enter-{trace,activate,reverse-trace}.*`; B called `Page.bringToFront` before the existing settle | B is a single-case diagnostic mitigation. It is modified execution, not unmodified-suite acceptance or a shipped fix |
| Earlier targeted 20/20 passes | Verified `diagnosis-summary.json`: boot 1, width 1, TR-1 fallback 1/real 1, background 14, lifecycle 2; 0 skipped/cancelled | Narrow success does not contradict the full Mac failure |
| Historical helpers/tests still apply to this source | Independently verified Git bytes: e314 `tests/helpers/cdp.js`, `tests/harness.test.js`, `tests/e2e.test.js` equal diagnosis 1510; app outside generated I18N also equal | Do not repeat completed source reconstruction. Fresh runtime reproduction remains necessary because runtime/host state may differ |
| SO-D Linux mouse-drag assertion failed once | Verified run 40153143613 attempt 1 at c5ed0851: 853 app pass; 473/474 browser pass; expected 2/49, observed 1/49 after committed mouse drag | This was an assertion, not a CDP/rAF timeout. It is a separate track; its source change was documentation only |
| Controlled SO-D rerun passed without source change | Verified `queue554-controlled-rerun-decision.json`, `queue554-attempt2-verified-summary.json`: local exact test 1 passed, then fresh 853/474 plus health pass; ten other successes retained | Cause remains unproven. The one authorized rerun budget was used; no automatic repeat or claim that activation fixed this incident |
| Final actual-main Linux gate passed | Verified `final-main-ci-40157160794-verified-summary.json`, e314, push/main attempt 1: all 12 jobs, 853 app / 475 browser / 274 Python, 2,228 JS tests, 1,468 killed mutants; 0 skipped/cancelled | Current Linux full-suite evidence is good. It does not establish full Mac readiness or eliminate intermittent-test debt |
| Owner device/UI QA accepted | Owner reported “Verified. All good.” to the integrator | Preserve accepted application behavior; this is not evidence about headless Mac frame scheduling |

Evidence root: `/private/tmp/handpan-browser-parallel.HskZRy/evidence/`.
Historical source was `1510ea369573078e6296fe873edb6f538c3212a3`; its runtime receipt
was macOS 27.0.1 arm64, Node 25.8.1, Python 3.9.6, Chrome 156.0.8078.35. Current runtime
versions were not re-probed in this planning-only lane. CI uses Node 22 / Python 3.12.
Do not install/downgrade tools or assume version differences prove causation.

Current helper SHA256:
`714785d57f54a90292f0c224c14971599fc80a2ed3090017f7b121f329f8bdd7`.
Harness tests SHA256:
`31e4d182e8d0ae0753738121778b095a60258f7093daad5667368329701687ce`.
E2E SHA256:
`9d29e4aa14453d2b5a2239051e60e6bed9f30dc5b0fec61c0d775ebd13be3c18`.

The prior diagnosis document and browser-portability plan contain historical
main/dev and release-held statements. Preserve them as dated evidence; the e314
baseline and final-main receipt above supersede those statements for this plan.
Local temporary evidence is not recoverable from another host by assertion.
The integrator must retain/publish approved nonsecret receipts before cleanup.

## Distinct failure tracks and immediate continuation

**M1 — activation-sensitive Mac frame wait:** the immediate repair investigation.
Reproduce the existing print-Enter failure on the approved current baseline,
observe target/frame state and compare the narrow activation boundaries below.
Do not start with another blind full 900s run.

**M2 — Mac viewport/keyboard assertions:** independent, unresolved failure class.
Retained raw TAP identified: Edit scale box outside 380×508; model D at 390×745
missing kbup/short/side; model D at 844×334 not tiny; rotation not side. Reduce each
on the same source, preserving actual input, tab and viewport state. A later
failure after a timeout may reflect state contamination, but that is unproven.
No app CSS/focus/keyboard change or assertion relaxation belongs to M1.

**M3 — Mac font/fit discrepancy:** an additional full-suite completion risk.
`naturalness-fit-baseline-1510.stdout.tap` and
`naturalness-fit-compact-spaced-es.stdout.tap` independently reported only
`ja 844x390: res-handpaner takes 2 lines against English 1` after compact-copy
repairs. These are assertion-red receipts, not local green tests. The fixed
HANDPANER HTML label and relevant helper/test source were unchanged; no typography
root cause or current e314 reproduction is claimed. Reconfirm and classify this
separately. Do not change Japanese copy, fonts, line budgets or tests to conceal it.

**C1 — isolated Linux mouse drag:** retain as a regression sentinel and separate
triage record. The existing title at `tests/e2e.test.js:11459` uses real mouse
dispatch, pending capture drain, animation completion and counter assertions.
Run it after any helper change that can affect activation/release behavior.
No mouse implementation repair is proposed without a fresh reproduction and
independently reviewed extension. Existing passing CI is not a reason to erase
the original failure; the original failure is not proof of persistent breakage.

No track receives an invented cause/fix claim. If M2/M3 remains red after a valid
M1 repair, report partial progress and withhold “full Mac repaired”. A partial
mitigation needs a separately reviewed scope/accepted-limitation decision before
delivery; it does not silently satisfy this plan's full-Mac exit criterion.

## Source contracts the repair must preserve

| Surface | Inspected behavior | Required protection |
|---|---|---|
| `Browser.rawSend`, helper:312 | Session-tagged CDP request; 20s request timeout; clears pending timers on response | Activation must address the intended attached target; forward original errors; no global retry, ignored rejection or inflated deadline |
| `Browser.settle`, helper:372 | First a real rAF, then getAnimations polling with 500ms animation ceiling; strict failure by default | Preserve actual frame and animation completion. The 500ms starts after rAF; it is not an existing end-to-end bound. Any new activation RPC adds latency and must be budgeted explicitly, not called a 500ms total operation |
| `deferPendingSettle`, helper:568 | Waits for trusted lostpointercapture up to 1s, then two real frames; deliberately deferred until a later press | Do not synchronously drain during release and destroy immediate post-release observations. Avoid introducing a new activation/close race or unhandled promise |
| `drag`, `releasing`, helper:493/553 | Arms capture listener before actual release; preserves supplied timestamps, pointer type and next-press fence | No synthetic click substitution, timestamp scaling, sleeps, threshold/counter changes or automatic gesture retry |
| `launchOnce`, helper:684 | New isolated profile/process group and target/session; real/fallback font and analytics fences; no existing explicit activation policy | Choose target policy from evidence and review; do not assume the fresh target is visible or background merely from its creation |
| `launch`, helper:781 | One retry only for the exact slow-debug-port rejection, with notice; other failures propagate | Do not broaden this retry to rAF/gesture/assertion failures; preserve opaque-retry cleanup qualifications |
| `close`, reaper, coverage | Owned group/profile teardown; coverage taken before navigation/final close; signal handling remains bounded | Activation/pending waits cannot outlive close, hide exceptions, lose coverage or signal another owner's browser |
| `on/off`, eval/send, screenshots | Session-scoped operations; one handler per method; exceptions drained per test | Passive observation must not unexpectedly steal target focus; retain event ownership and exception reporting |

**Background is not one concept.** The existing 14-test
`page background covers every viewport` group at `tests/e2e.test.js:8769` checks painted pixels,
not background tabs, visibility or focus. Preserve it, but do not cite it as proof
that forced foregrounding is harmless. Add a separate controlled two-target
visibility/focus contract if activation policy changes. Existing owner-device
and keyboard claims remain qualified; headless Chrome is not Safari/iOS.

Current accepted sheet-tabs plan S1 says the Scale tab draws no pan; Layout owns
the preview. Some legacy DI descriptions still mention the old small pan. Audit
an affected assertion against `docs/plans/2026-10-19-sheet-tabs.md:41` and actual
current behavior; never enforce obsolete layout or count zero-area hidden content
as positive coverage. Report a stale/vacuous oracle separately and obtain a
reviewed spec-first correction with its own mutant before changing it. This does
not authorize `CLAUDE.md` edits or lowering existing visibility requirements.

## Recommended bounded design selection

Prefer the earliest sufficient **target-specific foreground preparation for
operations that promise interactive rendering**. Do not blanket-activate every
eval/send or copy the temporary preload into the shipped helper.

| Candidate | Discriminating experiment after approval | Selection rule |
|---|---|---|
| A: once after target/session setup, or at an explicit navigation-to-interaction boundary | Same exact print case; capture visibility/focus/target identity and compare no activation vs this one boundary | Prefer if it reliably removes the evidenced stall and preserves all passive/background/pointer contracts; fewer focus transitions |
| B: explicit foreground preparation at the frame-dependent operation boundary | The retained A-B-A before-settle experiment is the seed; compare at current source and inspect both rAF sites/pending-release behavior | Use only if A is insufficient and the caller's foreground intent is explicit. Review an opt-out/neutral path for intentional background use; do not invent platform-only behavior without evidence |
| Global Chromium flags or platform-wide timer changes | Not an initial candidate | Require separate specific evidence/approval; global throttling flags alter the model and may mask regressions |
| Timeout→success, rAF→sleep, catch-and-ignore, finish animations during ordinary settle | Rejected | These change the oracle or hide failures rather than make real frame synchronization reliable |

The choice between A/B is an engineering review decision after evidence, not a
new product-tone interview. Before implementation, record the chosen operation,
target policy, passive behavior, activation-error handling, deadline envelope and
pending-release/close interaction in this plan. No unsupported new public API or
platform branch is treated as decided now. If neither fits existing contracts,
stop and present a concrete amendment rather than widen the patch.

## Swarm-shaped execution and exact ownership

Root plus at most three concurrent workers; stage later roles into freed slots.
Every editor gets a separate worktree. Only the integrator schedules a browser
job; worktrees do not isolate CPU, ports, profiles or OS focus.

| Lane | Owned files/role after execution approval | Output and independence |
|---|---|---|
| D — diagnosis analyst | Read-only source/history; uniquely owned temporary observational artifacts | Freeze reduction/target-state probes and A/B oracle; root executes them serially. Distinguish M1/M2/M3/C1 |
| T — regression author | `tests/harness.test.js`; minimal justified `tests/e2e.test.js` fixtures only | Spec-first tests from the reviewed contract, written independently of helper implementation; no app or helper edits |
| H — helper author | `tests/helpers/cdp.js` only | Small chosen target-readiness patch; cannot rewrite T's oracle to make it pass |
| I — root integrator | This plan/continuity, authorized harness/e2e floor rows, integration and factual results | Own browser lease, immutable source checks, conflict resolution and final gates; no automatic CLAUDE/global changes |
| M — mutant prover, later wave | New/context-stale `tests/mutants/*.patch` only in a clean committed scratch | Real generated diffs, header preservation and clean/fault proof; all temporary source restored |
| R — fresh engineering and design/interaction reviewers | Read/report only, not authors of the reviewed changes | Exact-head source, actual evidence, background/input risks and unresolved findings; meaningful independence, not self-critique |

T and H may investigate in parallel after the contract/oracle is frozen; root
serializes shared-file integration. M starts only from committed integrated source.
Reviewers replace finished author slots. No two agents edit the same helper/test/
floor file concurrently. Do not weaken protected branches or force-clean a lane.
Use the approved shared DEV ledger once the integrator publishes it; until then,
disclose local-only records. Keep a plan pointer, worktree/host, branch/head, owner,
last verified step, exact next action, evidence and pending approval at handoff.

## Dependency-ordered phases and stop conditions

### P0 — plan review and authorization (current phase)

Root obtains fresh engineering review and design/interaction review of this exact
draft, resolves material findings and records reviewed hash. No model score alone
passes the gate. Owner then approves a concrete runtime/implementation scope.
The current batch stops at drafting/review, without running tests or a browser.

### P1 — reconfirm one bounded red and select the readiness contract

After approval, root verifies current accepted head/tree, clean ownership,
runtime/browser versions and source hashes; sets explicit supported Mac Chrome
path in a dedicated job; removes inherited timeout/coverage overrides by name.
No installation or global setting change. Refresh live refs through an already
authorized read mechanism; stale/offline state must be labeled.

Run the existing exact print-Enter test alone with unabridged TAP under the
reviewed 180s small-repro envelope. Require exactly 1 executed test, no required
skip/cancel, original assertions and original CDP limits. Capture frame-wait phase,
viewport/emulation, session/target, visibilityState/hasFocus, browser exit and
owned cleanup. Do not emit private environment or unrelated process arguments.
Reuse retained traces as evidence; inspect/hash any temporary wrapper before use.

Concrete existing selector (to run only through the approved supervisor):

```sh
node --test --test-name-pattern='Enter on a print button runs its real click handler and does not flip the card' tests/e2e.test.js
```

Record selected, executed and filtered-out counts separately; Node may label
nonselected tests as skipped. A required test skipped for a missing browser is
never success. The raw command above supplies no whole-file wall-clock bound.

If the stall reproduces, perform only the A/B discriminator needed to choose A
or B, one variable per run. A reversal confirms that the measured behavior tracks
the intervention when practical. Modified diagnostic runs never count as the
unmodified or final suite. If no current red reproduces, record non-reproduction
and stop speculative code edits. After three unsuccessful attempts at one
hypothesis, regroup with a new reviewed experiment; no blind full-suite retries.

Separately select the four retained M2 assertions and the M3 I18N fit test for
small reductions if they block full-Mac acceptance. Preserve their red receipts;
do not silently classify them as M1. C1 remains a guard, not an assumed root cause.

### P2 — meaningful TDD and minimal implementation

Freeze concrete new test titles/selectors before running them. Proposed acceptance
groups below are requirements, not existing tests or claimed results. Use controlled
transport fixtures for deterministic unit red/green plus the real Mac reduction;
command-name spies alone cannot establish a repaired native frame boundary.

| Proposed requirement | Observable oracle/control | Meaningful fault for generated mutant |
|---|---|---|
| FG-1 foreground-intended frame completion | A controlled target refuses frame progress until the reviewed readiness contract is met; real Mac print case corroborates | Remove readiness: deterministic assertion-red, not a hanging test counted as a kill |
| FG-2 failure propagation | Activation failure is surfaced with the real cause; no later input/frame success is fabricated | Swallow activation failure and continue; the exact negative test becomes assertion-red |
| FG-3 passive/background neutrality | Two distinct targets retain intended visibility/focus under neutral eval/observation; explicit background policy is respected | Unconditional activation of the neutral/background path changes externally observed target state |
| FG-4 correct session/target | Readiness benefits the requested target, not an unrelated page; no hidden target fallback | Wrong/absent session or wrong target cannot satisfy the frame/visibility oracle |
| FG-5 real frame/animation contract | Preserve actual first-frame registration, running-animation completion, strict 500ms ceiling and explicit nonstrict warning | Bypass frame or animation check: existing/new observable animation assertion fails |
| FG-6 release/close safety | Preserve immediate post-release inspection and next-press capture drain; close/failure cleans owned resources without pending unhandled work | Eagerly await the deferred drain, bypass the fence or let preparation continue after close; selected assertions expose the breach |

Use existing specific mutants/tests where they already prove a group; every new
group needs a generated killing patch. Do not derive expected layout/timing values
from the helper being tested. Keep activation/readiness limits distinct from the
existing 20s CDP request, 500ms animation poll, 1s capture-event wait and 900s per-file
bound. A new RPC can add latency even if no constant changes: review the maximum
path explicitly and do not claim an end-to-end 500ms guarantee.

T demonstrates unmodified-source assertion red for the new contract, H implements
only the selected helper change, then the same assertions must turn green. If
existing harness stubs need transport setup, preserve their independent animation
oracles and explain the adaptation; do not delete assertions merely because a
new prep call invalidates a call-count assumption. No application/engine/deck/
translation/CSS/font/gesture-threshold edits are included.

### P3 — mutation, regression and full-host verification

Commit clean integrated source only after root authorizes execution/commits.
In a disposable committed lane generate patches through real Git diffs, strip
blob-header lines, preserve original headers/intents and inspect all stale contexts.
Run each affected exact header command once clean-green and with its actual fault
assertion-red, selected counts verified. A timeout, skip, cancellation, missing
tool or syntax/startup failure is not a kill. No new source assertion/floor is
weakened. Raise only owned harness/e2e floor rows when their executed counts grow;
current floors are harness 28 / e2e 475, while observed final-main app count is 853
(its current floor 847 is a minimum, not proof that 853 ran).

Focused execution includes the existing print test 1, new FG groups, current
harness/lifecycle/error tests, the exact C1 mouse test 1, real/fallback TR-1 tests,
page-background 14 and affected keyboard/viewport cases. Recount selectors on the
candidate before use. No missing-browser skip or zero selection is success.

Then run the existing full Mac JS/suite-health route at the final source with
per-file 900s bounds, real browser availability and per-file counts/no required
skips/cancellations. Shared-helper changes affect all 25 JS files, not only e2e.
Before execution, review and approve a numeric outer collection deadline covering
the entire invocation, including collection/probes and teardown. Proposed budget:
2,700s from launch to collection completion, followed by at most 30s owned-resource
cleanup (TERM, up to 10s grace, KILL if needed, then up to 20s drain/verification).
This is a proposal requiring explicit review before use, not an activated budget.
Use a suitable inspected supervisor around the whole collection; the existing
900s-only single-file wrapper is insufficient unless separately adapted/reviewed
for this distinct outer contract. Poll at intervals no longer than 60s. Do not
increase the 900s per-file bound or automatically extend either deadline. An
outer-deadline hit is an incomplete collection, never green; retain completed
per-file failures separately from unfinished/unexecuted files. If owned cleanup
cannot be verified within its bound, stop and report unresolved ownership rather
than start another job or broaden cleanup.

Current baseline is 2,228 JS tests including 475 e2e / 28 harness; approved new tests
increase the expected counts. Retain structured results, complete available raw
streams and failure details. Avoid duplicate full runs: use the full runner as
the acceptance gate, and a bounded unabridged raw-e2e reduction only when its
excerpted failure output is insufficient for diagnosis. A diagnostic full-file
run still uses the existing 900s envelope. Never extend it to label Mac green.

Use the existing per-file-bounded reporting entry point inside that separately
reviewed outer supervisor, after inspecting both and choosing a unique approved
artifact path:

```sh
python3 tests/suite_health.py --emit-js /absolute/path/to/unique-artifacts/js-results.json
```

This is a proposed execution command, not a run performed by this planning lane.
The integrator must inspect every emitted per-file result and its real exit code;
suite-health success is independent from clean/fault mutant verification.

If full Mac still fails M2/M3 or another unchanged assertion, preserve the failure
class and stop the full-repair claim. Audit current accepted specs and source
before proposing a separate correction; no test exclusion, arbitrary sleep,
timeout raise, rAF bypass or relaxed fit budget. Missing installations/new runtime
requirements require a separate concrete setup decision, not automatic activation.

Fresh full Linux `validate` at the exact final helper/test head remains mandatory:
all substantive jobs executed, actual app/e2e/Python counts, no required skip/
cancel, full updated mutant corpus accounted for and no bad mutation verdicts.
Do not reuse e314's green result for a changed helper or count a doc-only skipped
run as implementation validation. Bind review/CI evidence to the actual revision.

### P4 — independent review, DEV and completion

Fresh nonauthor engineering and interaction reviewers inspect the final diff,
oracle independence, actual native/fixture evidence, target focus, pointer/fence,
failure and cleanup behavior. Address material findings and re-review changed
source. Root performs final diff/immutability inspection and exact-head CI check.

Only after separate implementation authority and these gates, integrate through
the established same-head CI/main-target HELD PR and dev companion process.
Reverify actual served DEV source and affected user journeys, preserving accepted
UI/notation and existing delivery/hosting distinctions. A helper-only patch should
leave the application/deck/engine bytes identical; prove that rather than invent
a new product feature. Root records the delivered head, device/UI limitations and
whether M1/M2/M3/full-host gates actually passed. Main release requires explicit
consent for this repair; earlier release-queue consent does not transfer.

Update this plan/approved ledger with factual receipts. A shared runbook procedure
or Claude-reached dependency change must receive its own load/behavior-impact
review and explicit owner approval when it changes Claude behavior. Do not edit
`CLAUDE.md` as an incidental documentation task.

## Runtime ownership, interruption and rollback

One integrator-owned browser lease covers all agents/worktrees and Mac jobs.
Pause other owned CPU-heavy jobs for discriminating timing experiments and record
the choice; worktree isolation is not CPU isolation. One-second owned-process
sampling can miss short-lived roots, so retain helper teardown as primary and
qualify observation gaps. Follow the reviewed supervisor's owned Node group,
separately detached Chrome group/profile and loopback-server cleanup; monitor
at most 60s between updates and avoid a single long blocking tool wait.

On deadline/interruption, terminate only recorded owned resources through bounded
TERM/grace/KILL/drain handling, then verify absence before releasing the lease.
Do not kill normal Chrome, wildcard-delete profiles, reclaim an expired lease or
reset another agent's tree. Unknown/recycled ownership means stop and investigate.
The historical 47s post-failure completion is not proof of a permanent teardown
hang; capture actual pending/close state before changing lifecycle code.

Rollback of unmerged implementation uses only its dedicated owned commits after
preserving dirty/unpushed work and evidence. An integrated change requires a
reviewed normal DEV revert PR; never reset shared history or push directly to dev.
Production rollback is a separate owner decision. Keep the verified Linux path
available while Mac readiness is unresolved; do not weaken it as a fallback.

## Review questions and handoff stop point

Resolve during engineering/design review, not by reopening settled product choices:

1. Does the earliest sufficient target-activation boundary preserve intentional
   background observation, real frames and deferred capture semantics? A/B choice
   remains evidence-gated; default blanket foregrounding is not approved.
2. What concrete deterministic fixture plus native Mac reduction proves the
   selected contract without merely asserting helper command strings?
3. Does readiness introduce an extra request-length wait or close/pending race?
   Freeze its error/deadline envelope before implementation.
4. Are the four viewport failures contamination, a separate harness issue, a stale
   accepted-spec oracle or a genuine application problem? M3 Japanese fit also
   remains independently open. No classification is fabricated in advance.
5. Can full Mac completion be demonstrated without changing accepted app/layout/
   font/input behavior? If not, stop this full-repair scope and propose an explicit
   limited mitigation or a separate workstream; do not quietly pass the gate.

Last completed action in this lane: read-only source/evidence reconciliation and
this draft, followed by the two bounded review revisions below. Next action: root
obtains refreshed engineering and interaction-design reviews, resolves material
findings, then seeks the separate concrete repair execution authorization. No
browser/test/helper/application changes occurred.

## Review revisions and remaining decisions

Fresh engineering review of draft `dbbb0a9683d36be8f141554c09c47caeed3fdf333e513a570317a6f5ed7b8e3b`
requested two revisions: distinguish approved document publication from unapproved
Mac repair execution, and add an outer collection deadline beyond the existing
per-file bound. The integrator agreed; initial interaction-design review otherwise
cleared the draft. This revision addresses those requests without claiming fresh
review clearance or runtime results. Both reviewers must inspect the revised
source before publication.

Remaining execution decisions include the activation boundary and observable
fixture above, plus approval of the proposed 2,700s collection / 30s cleanup budget
and suitable whole-collection supervisor. A rejected budget requires a concrete
reviewed replacement before execution; it does not permit self-escalating bounds.
