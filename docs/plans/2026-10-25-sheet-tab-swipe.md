# Scale↔Layout swipe: refreshed SPS proposal

Status: planning/reconsideration only, 2026-10-25. No app implementation grant.
Original source: [sheet polish](2026-10-21-sheet-polish.md), §3.4, §5.4, §7.5,
and the owner answer in §10.1. The owner explicitly deferred SPS on2026-10-21;
today's request recovered it and requested a relevance audit. Do not rewrite that
history, confuse it with shipped card swipes, or infer native-device QA from an
unspecified “all good.” This successor requires independent ENG/design review.

## Objective and current evidence

Offer an optional touch shortcut between Scale and Layout in Add and Edit while
preserving every visible tab/NEXT/keyboard route and native scrolling/selection.
Current accepted app: main96c4c589cec0950723b3b5323dc1df5bbc359329,
DEVc79af08c90750d350e70344c0835303c3f6bb822, identical tree7705d17c.
No sheet-tab swipe recognizer or SPS group was found in the inspected app/tests.
The current input routes around `setTab`, `tabStrip` and `showPendingDerive`
do not implement it. This is source evidence, not a new behavioral test result.

Old design review preferred deferral: two44px tab targets and NEXT already work;
plate/field exclusions limit gesture area and an instant switch may feel abrupt.
Those costs remain review questions. No new motion or discoverability copy is
silently introduced to counter them. Existing copy, note-input grammar, saved
records, engine, diagram geometry and Naturalness choices remain unchanged.

## What changed since the old plan

1. Current typed-order feedback is consumed in tab click/NEXT/keyboard listeners,
   not `setTab` itself. An old SPS-only `setTab` call would skip it. The owner now
   selected **latest outcome per ring, once, rim→inner** for the related feedback
   proposal. Freeze one entry-completion contract shared by both plans.
2. Free bottom-note placement, cyclic seat order, pointer capture and real drag
   cancellation paths were added/evolved. The preview-origin exclusion must
   protect the entire gesture lifecycle, including a finger that leaves the pan.
3. Localization/Naturalness and compact Resources shipped. No new text is needed
   for recognition; any later affordance/copy change is a separate localized/fit
   decision. Current locales are LTR; do not invent RTL behavior or localize scale
   note syntax. Direction remains physical left→Layout/right→Scale in this proposal.
4. Current landscape band/status/footer behavior and supported viewport checks
   supersede old line numbers, coverage percentages and baseline screenshots.
   Re-inventory actual listener ordering, source anchors and current test names.
5. Browser infrastructure has a separate active Mac M1 repair. Bind evidence to
   the actual helper revision, serialize host access and preserve its limitations.
   Do not modify the helper or count CDP as native Safari/keyboard proof.
6. Existing CLAUDE.md changes require the owner's exact-diff approval. The old
   proposed SPS sentence is not that approval. Prepare a concrete diff only once
   the behavior/test citations are frozen; resolve that delivery gate explicitly.

## Proposed recognition contract (preserve original fences)

Attach passive touchstart/move/end/cancel listeners to `.sheetbody`; decide only
at touchend. No preventDefault, pointer capture, rAF, ResizeObserver, shared
recognizer/lipDrag state or new timers. Existing measured-time event handling may
read elapsed time; it must not delay a native selection/scroll to recognize swipe.

Track the original touch identifier, target, viewport-relative point, start time,
body scroll origin and maximum excursion. A new eligible one-finger touchstart
starts a record; any cancellation is sticky until the next such start. Never
reinterpret an excluded start because the finger later moves into a safe region.

An uncancelled gesture qualifies when horizontal travel is at least48px,
absolute dx is at least2×absolute dy, and elapsed time is at most600ms. Finger
left selects Layout, right selects Scale. Add and Edit both follow the same rule.
Switch at most once. Touchcancel never switches. A swipe toward the already
selected tab is a no-op: no focus/history/status consumption or quiet-window reset.
This idempotent no-op rule is a proposed clarification for independent review.

Excluded starts: preview/pan and descendants; lip; select; focused input/textarea;
keyboard-up state; multi-touch; either24px viewport edge. Preserve field selection
and screen-edge browser navigation. An unfocused field is eligible only while
the existing native/hold/scroll guards remain satisfied; do not assert native
selection support merely from dispatched synthetic events.

Cancel if a second finger appears at any time (even if it lifts), the original
identifier is absent/replaced during a move or has no matching changedTouch at
touchend, keyboard rises, the start field gains
focus or selection, the unfocused-field hold reaches existing HOLD_MS250 before
leaving existing8px slop, a textarea scrolls internally, body scroll excursion
exceeds8px at any point (including out-and-back), or the sheet closes/session
changes. Track touchcancel and clear lifecycle state on close/new Add/Edit.
Normal touchend removes the identifier from touches: use its matching
changedTouches record for final coordinates, not an absence-in-touches cancel.
The disappearing-identifier/session guards are proposed lifecycle clarifications;
they avoid carrying a gesture into another session and need assertion controls.

Sticky means an observed lifecycle event cannot be undone by the end snapshot:
use existing keyboard-edge/focus/selectionchange/scroll hooks as needed to mark
the active record cancelled, without polling/new timers or interfering with the
native event. Include keyboard-up→down, selection-then-clear and textarea/body
scroll-out→back before the next touchmove in negative controls. The four touch
listeners alone are not evidence that transient non-touch state was tracked.

Do not change lip gesture constants, thresholds, geometry or native scrollability.
On a successful switch, preserve the established lip reset/re-baseline, end parked
lipDrag and residual lipFling, and extend (never shorten) lipQuietUntil through
touchend+existing LIP_END_MS220. Both scroll- and fresh-touch-derived lip changes
remain suppressed through the interval; native scrolling still works. Preserve
the accepted old-plan behavior that a vertical-first hooked gesture may collapse
the lip before horizontal qualification, then the switch restores it.

Accepted horizontal swipes, and cancelled non-tap horizontal gestures starting on
sheet buttons, must not also activate RESET, palette or anchor actions. Genuine
taps still activate their controls. Add observable state/action-count checks in
app and real-touch cases; do not prescribe blanket click suppression without
native evidence. If the passive policy cannot satisfy both, stop for a concrete
recognition-surface amendment rather than silently disable controls or selection.
Install lifecycle observers once; closing/reopening clears the gesture record,
not accumulates listeners. Include repeated-open and cancelled-gesture controls.

No added panel animation/history entry. No forced focus transfer for swipe;
retain the existing blur of a control hidden by a tab change. Keyboard routing
retains its own focus rules. No click/eatClick/pointer changes to practice cards.

## Shared tab-entry and feedback contract

Entry completion occurs after a real accepted transition into Layout, regardless
of tab click, NEXT, tab-keyboard or swipe. Layout remains available for empty,
invalid and valid input, as current setTab and the enabled palette require.
Keep current example/held preview and individual disabled drawer-control states;
do not add a boxOk navigation guard. Separately, pending typed feedback is consumed
only when boxOk is valid, once, in owner-selected per-ring order. Empty/invalid
input may enter Layout and use its palette without replaying stale feedback.
Cancelled or same-tab gestures consume nothing.

Prefer one small existing-code entry completion path, leaving route-specific
focus behavior at callers. Do not add an event bus, dispatch fake DOM clicks to
reuse handlers, or consume twice via both a shared function and old listeners.
The [per-ring feedback plan](2026-10-25-layout-feedback.md) supplies its separate
state/edge rules. Sequence that change first, or freeze this shared interface and
integrate both patches serially. No concurrent index.html editors.

## File-owned lanes after separate app authorization

| Lane | Ownership | Output / independence |
|---|---|---|
| T | Own clean test worktree; tests/app.test.js, minimal browser tests | Contract-first assertions/gesture fixtures, no app/helper edits; root executes red |
| A | Separate app worktree; index.html recognizer/entry/lip hand-off only | Minimal reviewed implementation after primary assertion-red; no parser/geometry/CSS/copy changes |
| M | Later committed scratch; generated mutant patches | Real Git diffs, preserved headers, clean-green/fault-assertion-red proof |
| I | Root integration; plan/ledger, owned floor rows and final merge | One browser lease, SHA-bound review/CI/DEV, no main without consent |
| R | Fresh independent ENG and design/interaction reviewers | Exact plan review before edits, exact final source/evidence review afterward |

Root assigns actual host/worktree/branch/base/head before creating implementation
lanes. This proposal is currently a document in the Mac investigation's integration
worktree, not an app implementation checkout. Mac owns helper/harness; app suites,
floor/ledger edits and browser jobs require serialized integration/scheduling.

## Validation matrix — freeze exact test names before execution

| Group | Observable acceptance | Discriminating faults |
|---|---|---|
| SPS1 direction/threshold | Add/Edit both directions;47/48/49px, dx just below/on/above2dy,599/600/601ms; wrong direction on already active tab no-op | Axis/threshold/direction/time guard removal; duplicate transition |
| SPS2 excluded origins | Plate/lip/selected field/select/keyboard/multitouch/edge remain on tab; plate-origin exit stays excluded | Origin re-evaluated at end; edge/plate/focus guard dropped |
| SPS3 sticky lifecycle | Late second finger, focus/selection, keyboard rising, hold/slop, textarea scroll, body out-and-back, identifier loss and touchcancel never switch | Endpoint-only scroll check; start-only multitouch; hold/cancel guard removed |
| SPS4 lip hand-off | Residual fling and a fresh vertical drag cannot change lip before220ms; real native scrolling works; after-deadline gesture works | Fling not cleared; quiet deadline shortened; scroll or touch path ignores deadline |
| SPS5 route/status | Click/NEXT/keyboard/swipe enter equivalent Layout for empty/invalid/valid input; palette stays available; only valid input consumes latest per-ring status once; cancelled/no-op or invalid-input entry preserves pending state | SPS bypasses consumer; duplicate consumption; new invalid-input tab block or stale feedback |
| SPS6 native input | Real touch swipe changes tab; vertical/diagonal scroll does not; plate drag/selection/keyboard/browser edge remain intact; horizontal gesture does not also trigger RESET/palette/anchor actions, while genuine taps still work | Recognition steals plate/scroll route, triggers an unintended control click or calls preventDefault |
| SPS7 session/focus | No history entry; no forced swipe focus; close/reopen and superseded sheet gesture cannot switch fresh session | History push/focus transfer; stale gesture survives close |
| SPS8 preserved product | Existing LG smoothness, FPD/SO gestures, layout/status/footers, current text fit and keyboard routes unchanged | Existing relevant mutants/guards, independently verified intent |

App fixtures freeze their independent expected state/touch lifecycle from this
contract, not recognizer constants. Boundary tests retain elapsed-time semantics;
do not replace a wait guarding a page timer with an unbounded poll. Root verifies
selected/executed counts, required0 skips/cancels and complete raw results. Primary
new assertions must fail against accepted unmodified app before implementation.
Preserved behavior may already pass; do not force artificial red.

All new groups need meaningful generated mutants. A timeout, syntax/launch error,
missing browser or wrong test selection is not an assertion kill. Update only
owned app/e2e floors from actually executed counts. Retain old SPS mutant intent
where still relevant but generate current diffs rather than copy stale patches.

Browser matrix: short phone320x568,380x780/390x844 portrait,844x390 landscape and
1280x800 desktop; Add/Edit; empty/valid/refused input; relevant long-localized status
with real/fallback fonts. Behavior adds no new keys. Reuse current fit budgets and
native field/tab hit targets; no arbitrary padding/typography concessions.

## Native-device prerequisites and release gates

Deep recovery found a direct2026-10-22 owner pass for the **first five** adapted
phone QA scripts: lip clearance, messages, palette,9px lip/fast flicks and landscape
Layout. They map to old §7.1/7.2/7.3/7.4/7.6. Credit that original prerequisite as
**historically passed**, rather than ask the owner to redo the entire baseline.
A landscape font-size nit raised alongside that pass was handled in the subsequent
follow-up; a later “All pass - merge!” reply covers that follow-up's separate
Scale/name/warning/wording/font checks. Do not confuse the two replies or bind a
reply to an unrelated script. Direct source mapping is retained in the plan audit's
host-local deep-search evidence, with portable findings summarized there.

Historical baseline success is not SPS feature validation. Before implementation,
compare later changes with the tested baseline and review any newly affected
plate/keyboard/footer/status behavior; use focused regression checks where needed.
Do not invent a blanket new preimplementation owner-device gate without a specific
risk. The actual remaining owner decision is SPS implementation scope. The existing
exact-CLAUDE-diff boundary still applies. Once SPS reaches DEV, its new native edge,
selection, keyboard, control-click and smoothness checks below remain mandatory
and cannot be certified by CDP or old QA.

After SPS implementation and CI/DEV: run old §7.5 specifically—both directions,
plate drag unaffected, keyboard text/caret, long-press selection, out-and-back
scroll, fresh vertical scroll before/after quiet deadline, browser edge navigation,
ten diagonal thumb scrolls and LG smoothness. Repetitions use the original zero-
miss bar on24px+ lip drags and zero focus regressions. CDP cannot certify native
Safari selection, keyboard, edge navigation or subjective smoothness.

Required delivery sequence: scoped app grant + exact reviewed plan → independent
TDD red → minimal app change → same tests green + meaningful mutants + relevant
regressions → independent addressed source/interaction review → full exact-head
Linux validate → same-head DEV companion merge → actual served DEV revision and
affected journeys/device gates. Main-target PR remains HELD. No implicit production
merge, CLAUDE edit, install or global setting change.

## Stop conditions and rollback

Stop dependent edits for unresolved gesture arbitration/device scope, failed
native prerequisite, conflicting shared entry contract, absent historical source,
missing dependency or competing file/browser ownership. Retain all failures;
do not broaden listeners, lower thresholds, relax tests or lengthen timeouts to
claim completion. No speculative browser flags or helper preload acceptance.

Keep SPS in a separately revertible app commit/PR. A regression on DEV requires a
normal scoped revert proposal under the existing DEV workflow, not reset/force,
unknown-process cleanup or automatic main rollback. Latest per-ring feedback must
continue through existing click/NEXT/keyboard routes if SPS is reverted. Preserve
original dirty/locked worktrees and Claude behavior throughout.

## Open decisions and current next step

Settled: latest relevant feedback per ring, once rim→inner; English note input;
previous translation/terminology choices. Do not interview those again.

Unresolved: explicit SPS app implementation scope; scheduling the new SPS-specific
native-device verification after DEV; exact CLAUDE sentence approval if proposed. Motion,
thresholds and exclusions above preserve the old conditional specification as the
recommended proposal; they are not claimed newly user-approved implementation.

Next: independent ENG/design reviews of this exact successor and the linked
per-ring proposal, address material findings, then present concrete owner decisions.
No app code or browser execution has occurred for SPS in this planning task.
