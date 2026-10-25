# SPS execution amendment: faithful bounded test fixtures

2026-10-25. Scope: the already owner-approved [Scale↔Layout swipe](2026-10-25-sheet-tab-swipe.md),
not a new feature. Reviewed original body remains at21760907 SHA2564f133ae01efc9f99add6fd62e6a7089c382a43521b77ab0dae7a447553e3c57c.
Feedback prerequisite is independently complete on DEVbccff5a2b9ffd88f772517740cbab3ea66a50fbb,
sourcea90fce8c/tree141a2807. FullCI40216007898, actual28byte paths/noindex,
clean A1 deployed3journeys/12fontcells and independent raw audit are recorded on
[feedback575](https://github.com/raywu/handpan-cards/pull/575#issuecomment-6401041842).
A0 temporary diagnostic was invalidated for registration error despite positive
counts; preserve that failure and inspect raw errors in every subsequent receipt.

## Why a bounded fixture change is needed

Read-only preflight found tools/sandbox.js lacks the anonymous .sheetbody,
uses nearest-ID markup ancestry, ignores listener capture options and does not
emit focusin for ordinary focus(). CDP touch timestamps do not advance Date.now.
These are fixture limits, not reasons to change production behavior or widen
recognition. Original passive/end-only/threshold/lifecycle/lip/control-click
contract remains intact. No app/helper edit starts until fresh ENG/design review
of this amendment and frozen primary test/oracle briefing.

## Smallest sufficient approach

T may add opt-in `sheetBody: true` support in tools/sandbox.js, composing existing
layout/clock options. Create the real anonymous body membership before VM boot,
recognize .sheetbody and supply consistent contains/closest/ancestry for the actual
body descendants needed by SPS. Header/BACK/footer stay outside. Keep default
fixture behavior unchanged. Do not create app-side test branches, fallback listeners
solely for the sandbox, a duplicate parser or a generic DOM/event framework.

Keep capture/once/focus fidelity limits explicit. Unit traces may call registered
real sheet-capture→body handlers in the specified public-event order, with original
target/changedTouches, but must not read/write new recognizer state or claim they
establish DOM propagation. Focus/selection/scroll transient tests explicitly emit
actual lifecycle events and observe UI state. Use existing virtual clock advance
for599/600/601 and249/250 boundaries; do not fake page time with CDP timestamps.
If this minimal fixture cannot observe a requirement, use targeted browser coverage
or stop for a reviewed amendment; do not quietly build general event machinery.

At least one real CDP journey must prove real sheet/body attachment and capture
lip stop→body completion, correct descendant exclusion and residual fling cleanup.
CDP also checks focus/scroll and real button taps versus horizontal gestures;
physical Safari selection/keyboard/edge/smoothness remain owner-device gates.
No preventDefault/newtimers/rAF/ResizeObserver/animation or blanket click suppression.
Passive policy inability to preserve both selection/scroll and accidental-control
protection is a concrete design stop, not permission to weaken the contract.

## File ownership and gates

| Lane | Separate worktree / owned paths | Gate |
|---|---|---|
| Root I | /private/tmp/handpan-sps-z8gaznu2/integration; plans/ledger and applicable floor rows | sole integration/browser operator, no main/CLAUDE/global changes |
| T oracle/fixture | tests worktree; tools/sandbox.js, tests/app.test.js, tests/e2e.test.js, tests/sandbox_events.test.js | no index/helperCDP/engine edits; freeze spec-first assertions and counts; root executes |
| A app | app worktree; index.html existing sheet/tab/lip app block only | waits root primary assertion-red and fixture-oracle gate; no CSS/copy/engine changes |
| M faults | later committed scratch; generated tests/mutants/sps_*.patch | clean header green, meaningful assertion-red; no hand-written bodies/blob index |
| R reviewers | read-and-report only | fresh exact amendment review, then independent final source/interaction review |

Root creates T/A worktrees only at the reviewed base; no parallel editors share
a checkout. Proposed helper-oracle file independently asserts literal shipped-body
membership/nearest ancestry and existing clock use where newly needed, with a
malformed-membership negative control. It must not derive expectations from the
helper's own output. Each new group gets a generated killing mutant; new applicable
floor row and existing app/e2e rows reflect actually executed counts, never lower
existing floors. No meaningless tests for prose. Default sandbox compatibility
gets whole-app regression; all executable changes get final full exact-headCI.

Primary feature-red pair: Add eligible left touchend switches to Layout and consumes
both latest outcomes once; Edit eligible right touchend switches to Scale preserving
input/options/history. Freeze actual names/commands and positive selected counts
before root baseline. Old app must fail by expected assertion, not missing fixture,
startup error, no selection, timeout or skip. Preserved negatives may already pass.
Two-stage TDD is mandatory: freeze independent helper membership/ancestry oracles
first; root demonstrates expected assertion-red against the unchanged sandbox
before T edits helper code. Then T makes the smallest opt-in fixture change;
root verifies the same helper oracles green and the default whole-app regression
before accepting feature-red evidence. Only then run the primary feature pair
against unchanged application code. A fixture helper's own tests must be valid
before its feature assertions count. No simultaneous oracle/helper delivery that
skips the helper's red gate, and no production edits before feature assertion-red.

Then original SPS1–8 matrix: boundary/time/axis, excluded origin and descendants,
sticky late-finger/focus/keyboard/selection/scroll cancellation, original identifier/
changedTouches semantics, quiet220ms scroll+fresh-touch handoff, same-tab/no-op,
shared valid-only feedback consumption with invalid Layout palette still usable,
control accidental-click negatives plus genuine taps, session/focus/history and
preserved LG/PH/FPD/SO/PD2/fit behavior. Every claim names tested source/oracle;
raw suite/registration errors invalidate a run even when leaf counts/exit look green.

Final independent addressed review→full exact-head LinuxCI→same-head DEV merge→
actual served bytes and journeys→new native ownerQA. No main without explicit
consent; exact CLAUDE documentation proposal remains separately approval-gated.
Unknown resource/file ownership or incompatible fixture/event semantics stops
dependent edits; preserve failures/source and continue unblocked investigation.

## Coordination and current state

Root owns branch codex/sheet-tab-swipe-20261025 in the integration path above,
basebccff5a2. T/A/M not yet editing. Next: fresh amendment reviews, then isolated
lane creation, oracle freeze and root red proof. No swipe/test/helper code written.
Preflight evidence is host-local /private/tmp/handpan-feedback.ha43y5cy/evidence/sps-preflight.md;
portable findings required for continuation are restated here, not a hidden prerequisite.
