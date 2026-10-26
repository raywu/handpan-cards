# Saved variants — matched selection/frame validation

## Existing gate and supported target

Implements the approved parent plan's input-to-paint diagnostic gate, separate
from transaction timing. Historical60 selections measured pre-change DEV5628
with helper66f7; those are not candidate evidence. Current backend120, geometry
and concurrency results likewise do not satisfy frame latency.

Supported measurement target: this host's installed headless Chrome, fallback
fonts, explicit foreground, 900x900 desktop and380x780 simulated-phone viewport,
trusted mouse input. Neither RAF nor double RAF proves compositor presentation;
report first paint opportunity and after-intervening-opportunity, not physical
paint/Safari/iOS or disk flush. Existing backend pure component benches and cold
initialization totals remain separately labeled; moving work outside a lock must
not conceal selection stalls.

## Frozen protocol

- Load immutable pre-change index from local Git92d6516bd533abb4a1e4fb7c8116b9836f648296,
  expected sourceSHA5628f31deed911e7e406ce852fe0daee5d6fcf1caa26d2fb0f182a823c0894b3.
  Candidate is the final compatibility-repaired file, bound by explicit source
  SHA at execution. Both arms use the independently cleared helper178e034c….
- Serve both exact bodies on the same owned loopback origin. Bind each actual
  Document request/frame/loader/body hash; disable cache and require no service
  worker/disk-cache receipt. Before every arm, visit blank and await clearing ONLY
  that disposable origin's localStorage and IDB, then seed the exact same legacy
  source bytes before app execution. Do not patch production functions/storage.
- Four scenarios: empty sources, and immutable2/20/200-record backend case files.
  Freeze their hashes and all source strings before running. Expected visible
  counts: baseline5/7/8/8, candidate5/7/25/205. The difference is intentional
  legacy identity collapse versus preserved variants; report it, never pretend
  equal visual workloads. Five unchanged builtin target names/IDs are the same
  in both arms; find unique literal target chips rather than positional indices.
- For each scenario and viewport run baseline-before A, candidate B,
  baseline-after A. Each fresh arm gets30 selections cycling the five builtins,
  every click changes selection. Preflight the visible, unselected
  actual hit target and scroll before arming measurement, without forced focus
  or DOM activation. Record trusted click event.timeStamp, capture performance
  clock, first and second actual RAF callbacks, expected deck/chip/count/sheet
  state and visible foreground. No samples dropped, retried or reset for outcome.
- Pool the60 pre/post baseline rows for each scenario/viewport. Freeze pass
  criteria before execution: candidate first-opportunity p95 AND after-opportunity
  p95 each <= corresponding pooled-baseline p95 + pooled-baseline median positive
  observed RAF interval. Use measured median frame duration, not an inflated
  outlier/p95 frame allowance. Report all raw rows, maxima, cold readiness totals,
  each baseline arm and pooled comparison. Missing rows or wrong target fail.
- Exactly720 trusted selection rows and24 bound Documents across four jobs;
  each job180 rows/6 Documents. Use existing sole browser lease and bounded
  supervisor, maximum180seconds per scenario; no timeout increases to pass.

## Swarm lanes and deliverables

- P authors focused reusable tools/probe/saved_variants_selection.js plus scoped
  browser-runbook instructions in an isolated checkout; strict immutable refs,
  source/case/helper pins, canonical outside fresh output and atomic no-overwrite
  publication. Reuse reviewed observation/lifecycle code rather than a new driver.
- T/reviewer independently validates empty-case literal and the frozen2/20/200
  input/count oracle, actual changed-target assertions and fixed comparison math.
- Independent engineering/design plan review precedes tool execution. Independent
  source review precedes browser launch. Root integrates, owns all browser jobs,
  independently audits raw results and retains failed attempts without threshold
  changes. Portable empty fixture may be added under tests/fixtures if needed.

## Stop, approval and recovery

Source/tool drafting and these diagnostic runs stay within authorized saved-
variants validation; no app redesign, installs, auth/global/CLAUDE/main changes.
A failed latency gate stops rollout for reviewed diagnosis/optimization, not a
higher threshold or dropped recovery data. Record device/fixture limitations.
Keep owned cleanup/census and original errors; scoped commit revert is fallback.
A passing diagnostic does not replace final exact-head CI or actual DEV behavior.

## Independent review refinements — frozen before tool execution

Engineering/design review confirmed source/count arithmetic. Use identical
unmeasured instant-nearest scrolling, foreground settlement and hit testing before
arming each click; no forced DOM focus. Coordinate a quiet local diagnostic
window across each whole A–B–A set, with no competing agent tests/benchmarks.
Preserve unknown owner processes and record host-load/visibility limitations.

After recording each sample's two timed RAF observations, independently drain its
actual persisted preference before the next click: baseline reads hpfc.deck;
candidate reads the authoritative current JSON plus getKey in a completed
readonly IDB transaction. Require the literal chosen builtin id/tag, never the app
cache or a new queued-lock guess. Report observation/drain delay separately from
timed frame rows; it is not an exact physical/native commit timestamp. Retain all
rows and report cold ready totals and existing independent engine/build benches
separately. A timed row cannot be dropped because its subsequent drain fails.

Freeze formulas: p95 is nearest rank sorted[ceil(.95*n)-1]; median is the middle
value or average of the middle two. Require every clock and RAF interval finite,
positive where an interval is required, and monotonic within its actual Document;
never filter zero/negative intervals or clamp bad clocks. Report pre/post baseline
p95 separately as well as the pooled60 rows. If either pre/post metric drifts by
more than one pooled-median observed frame, classify the comparison unstable/not
validated; do not select a favorable arm or inflate the frame allowance. Stop for
reviewed diagnosis, retaining the full attempt, rather than retrying for a pass.

Read-only VM fixture-count preflight independently confirmed baseline/candidate
counts5/5,7/7,8/25,8/205 on the frozen sources/cases; this is not browser or timing
validation. Root still requires independent tool-source review before launch.

## Precision amendment after the retained first campaign

The a0 empty and2-record jobs passed. The20-record attempt stopped at phone
baseline-before sample17 (107 retained rows/four Documents): RAF timestamp1006.1
versus separately read callback clock1006.0999999046326, a lead of
9.536745437799254e-8ms (0.095367454ns). Its16.668ms RAF interval, state and
foreground checks were valid; the completed desktop comparison passed. The200
case was not run. Keep every a0 artifact and its FAILED status; do not combine
selected a0 rows with the next campaign.

Independent engineering review approves exactly1ns (0.000001ms) representation
allowance ONLY in the two RAF-timestamp <= corresponding performance.now callback
sanity comparisons. Compare the finite raw difference against the fixed allowance;
record raw differences and the allowance. Do not round, clamp or alter timestamps,
filter samples, relax strict RAF increase/same-clock order/positive intervals, or
change p95, frame allowance, baseline drift, counts, viewport or latency budgets.
Literal regression controls must accept the retained0.095ns case and <=1ns
boundary, reject >1ns and nonfinite values, and retain rejection of zero/backwards
intervals. Independent source review precedes a fresh run of ALL four cases under
the same quiet protocol; no favorable old-arm reuse or blind retry.

[High Resolution Time](https://www.w3.org/TR/hr-time-3/) describes double-valued
millisecond durations and coarsened exposure; [HTML](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#run-the-animation-frame-callbacks)
passes a supplied timestamp into RAF callbacks. The observed difference is
consistent with representation/conversion precision; its exact Chromium cause is
not proven. Those sources do not prescribe this1ns engineering cap or guarantee
bit-identical values across these two readings. This changes a diagnostic sanity
check, not the application or its accepted latency budget.
