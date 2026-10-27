# App: latest Layout feedback per ring

## Execution authorization — 2026-10-25

Owner explicitly authorized **feedback first, then Scale↔Layout swipe through DEV**
after both independently reviewed proposals. This supersedes planning-only status
below for these bounded scopes; the reviewed behavioral contract is retained at
commit217609075a14e6ca4799497210af27d9df842c5e, SHA256
bdf530e39cae3bc0904c701f6afdf46f4bcdf6f2dd134666e14b4904d2df6b9f.
Separate T/app lanes must demonstrate meaningful assertion-red before app edits,
then green/mutants, independent addressed final review, full CI and actual DEV
validation. No main merge or CLAUDE.md edit is included. Swipe waits for feedback's
verified DEV delivery; new swipe-specific native QA remains required.

Root on ray-Mac owns `/private/tmp/handpan-feedback.ha43y5cy/integration`, branch
`codex/layout-feedback-20261025`, base21760907. Independent test/app lanes start at
that same reviewed source, with private ownership receipts under sibling evidence/.
Mac PR573/574 remain frozen at217 and proceed through their separate CI/DEV gates.
Last step: owned lanes created, tests being authored; app author waits for root's
TDD-red gate. On unknown ownership/conflict, stop dependent writes and preserve
uncommitted work. This authorization does not activate the future whole-codebase audit.

### Later execution checkpoint

Primary2 independent tests failed by assertion against unchanged indexbd9be272;
A then changed only the app block (commitad991aad). Current integrated source4e4bff4c
retains generated engine/deck bytes, CSS, translations and instructions. Corrected
unit oracles pass20/20, full app873/873; native journeys3/3 and12 font/locale/viewport
cells pass with0 required skips/cancels. Two lifecycle fixture failures were traced
to sandbox app.click dispatching listeners but not inline onclick; test-only driver
correction retained all expected behavior. Actual native control paths corroborate.

Pending put-down queuing is not reachable through current public Layout→Scale
flow because it clears the pick. Preserve existing defensive/immediate behavior;
do not fabricate internal state solely for a new mutant. Actual mixed bottom
angle-reset/restoration auxiliary payloads are covered through public fixtures.
The consumer also checks active field validity: an invalid composition may retain
the last valid line/boxOk. This implements the reviewed invalid-active-input rule,
without disabling Layout or palette access.

Sixteen new mutants and five equivalent legacy context refreshes were generated;
all1500 patches apply-check. All21 changed patches are assertion-killed after18
distinct clean-green exact header commands at source4e4bff4c, with identical
selected counts,0 skip/cancel/timeout/startup kills, resource census and byte
restoration. Every failing leaf is an assertion; suite wrappers are not evidence.
Final exact-head review, full Linux CI and actual feedback DEV delivery remain
required. Mac prerequisite DEV574 delivery is separately complete atf5df7942;
main573 remains HELD. Live feedback PRs are resolved from the published branch
and [shared checkpoint thread](https://github.com/raywu/handpan-cards/pull/571#issuecomment-6400489132),
not a guessed PR number or this pre-CI snapshot.

Draft for independent engineering and design review — 2026-10-25.

Related: [refreshed SPS proposal](2026-10-25-sheet-tab-swipe.md). Any shared
tab-entry/status change must preserve click/NEXT/keyboard and future swipe entry,
consume once, and be integrated serially; no competing index.html editors.

## Decision, authority and objective

Owner selected **latest outcome per ring**, not an event history: show the current
relevant outcomes once, in rim→inner order. This plan turns that choice into a
bounded implementation proposal. The app lane currently has investigation and
planning authority only. Do not edit application/tests, create its implementation
branch, run tests/browsers or publish its PR until root records the implementation
grant and the independent plan-review gate. Mac repair authorization is separate.

Fix one loss of user feedback: on the Scale tab, reordering inner notes and then
rim notes can leave only the rim sentence when Layout opens, although both rings
changed. Preserve typed-order seating, seat numbering, fields, stored records,
share formats and all English scale-input conventions. Reuse the existing locale
messages; no new product wording, translation keys, dependencies or agent behavior.

## Verified baseline and evidence

Read-only audit source: accepted main96c4c589cec0950723b3b5323dc1df5bbc359329,
tree7705d17c700ffa769cd4bcba274a808be4f51679. The app-audit lane inspected
`/private/tmp/handpan-mac-p1.4ELKbI/checkout` read-only and ran no app tests/browser.
Root separately ran the scoped Mac P1 diagnostics in that checkout; do not confuse
those results with app-feature validation.
Re-resolve actual main/DEV and compare affected source before implementation.

| Evidence | Finding and qualification |
|---|---|
| `index.html:12315`, `noteCounts`; assignment at12333 | A closed-drawer derivation assigns one `pendingDerive` string. A later update of another ring overwrites the earlier ring's sentence. Verified source behavior; no fresh UI reproduction yet. |
| `index.html:12343`, `deriveTyped` | Only a changed typed key writes a ring's seats. Identity, stored Edit prefill and latest-writer behavior must remain unchanged. |
| `index.html:13089–13112` | Click, NEXT and tab-keyboard paths already call `showPendingDerive`. The historical routing nit is a coverage gap, not a demonstrated broken route. |
| `tests/app.test.js:14213–14261` | Existing pending-feedback coverage includes separate rim/inner examples, consumption, RESET and close. It does not cover sequential different-ring updates. Close reopens empty Add, whose invalid `boxOk` suppresses even a leaked message. RESET clicks a control hidden on Scale; override invokes `layoutStatus` directly. |
| `tests/e2e.test.js:15119` | Existing real-page pending-feedback journey opens Layout by its tab. NEXT/keyboard pending-message journeys are missing. |
| `index.html:11648`, `dropDrawer`;12635, `resetSheetState`;12725, `hideSheet` | Session setup/teardown already clear drawer state. Require an observable valid-reopen test; do not invent a defect in every existing clear path. |
| `tests/app.test.js:14121`; order-follow reviewed kit §7/X6 | Edit prefill should show the hint without a live announcement. A later blur-without-edit negative test is useful; a current accessibility failure has not been demonstrated. |

Portable sources: `docs/plans/2026-10-24-continuity-backlog.md`, current AGENTS.md,
CLAUDE.md, tests/CONTRACT.md and docs/testing/browser.md. Original historical
sources were accessible read-only at `~/Projects/order-follow-kit/plan.reviewed.md`,
`~/Projects/seat-order-kit/plan.final.md` and the two queued Claude memory files.
They are provenance, not new mandatory instructions or portable prerequisites.

Do not fold these historical nits into this patch:

- Plain slides without renumbering intentionally have no flash in current
  `tests/app.test.js:14791`; accepted seat-order §6 likewise distinguishes them
  from snap/renumber flashes. No blanket moved-note flash change.
- MIRROR BOTTOM reflow copy is already conditional at `index.html:13065–13074`.
- Comma-list formatting was explicitly prescribed in the original English plan;
  locale-aware list redesign is a separate enhancement.
- Angular-wrap coverage, fixture descriptions and engine proof belong to a later
  audit. No geometry/parser/engine/seat-label fix is justified by this plan.

## Proposed behavioral contract

The owner's latest-per-ring decision is settled. Rules marked **proposed** below
fill previously unspecified edge cases; reviewers must accept or amend them
before implementation. None is claimed to be an already tested requirement.

### What is pending

Keep at most one ephemeral typed-derivation outcome for each of rim and inner.
This is session UI state only, never stored or put in a share link. An outcome
means that the most recent relevant successful edit made that ring follow its
listed notes. It is not a list of every edit or a transcript of count changes.
Rendering uses existing `sheet.rim_follows` and `sheet.inner_follows` at consumption
time, so the current selected UI language is used. Do not cache new English copy.

| Trigger while Scale is showing | Pending-state rule | Expected user observation |
|---|---|---|
| Successful typed derivation changes rim only | Replace rim's outcome; retain still-relevant inner outcome | Next Layout open includes both if both remain relevant, rim first. |
| Successful typed derivation changes inner only | Replace inner's outcome; retain still-relevant rim outcome | Same ordering independent of edit order. |
| Same ring changes repeatedly | Keep its latest outcome only | At most one sentence for that ring. No event history or duplicate announcements. |
| Typed order returns to identity | **Proposed:** replace that ring's outcome with the same truthful follows-listed result if the ring still exists | Returning to ascending order is a real derive, not an instruction to erase feedback. Existing R3 tests establish the identity return can truthfully say it follows the list. |
| Ring count changes and a successful derive writes that ring | Replace its outcome if the ring exists | Latest message describes the final listed arrangement, not earlier restored seats. |
| Ring count changes without a derive | **Proposed:** invalidate any older queued derivation for that ring; do not introduce a new deferred count-notice feature | Do not replay a stale earlier event. Existing visible count/reset notices retain their behavior. |
| Inner ring disappears | **Proposed:** remove its pending outcome, even if the transition changes its typed key | Never say nonexistent inner notes now follow the list. A later reappearance is a fresh possible outcome. |
| Bottom-only edit | Preserve still-relevant rim/inner outcomes; do not create a bottom-derived outcome | No new bottom-order promise. |
| Successful unchanged reparse/name/palette resync | Preserve pending outcomes; do not add another or consume them | Harmless resync cannot silently lose the earlier meaningful feedback. |
| Invalid/empty active input | **Proposed:** create/consume no outcome and keep prior outcomes suspended while there is no valid current parse | Refusal takes precedence. On recovery, reconcile against the successful parse/count transitions before deciding what remains relevant. No invalid-page opening is used as evidence of clearing. |

The existing per-parse `r.said` count/restore text, put-down suffixes and their
precedence are preserved in both immediate AND existing deferred combined payloads.
Today a derive-bearing parse can queue a non-derived ring's message, including
bottom count/angle reset or restoration, together with the rim/inner sentence.
Retain that truthful same-parse auxiliary payload in existing rim→inner→bottom
order and its put-down suffix; reconcile/clear any part made obsolete by a later
edit. This preserves existing bundling, not a new count-only notification queue.
They must not be accidentally discarded while
replacing the deferred *derivation* representation. If preserving those paths
requires new generalized status machinery, stop and reduce the design rather than
introduce an event bus or broaden deferred count-message behavior.

### Consumption, actions and lifecycle

- Opening valid Layout through tab click, NEXT, ArrowRight or End renders all
  current pending outcomes once in rim→inner order, separated as existing joined
  sentences. Use existing localization and status writer/ARIA attributes. Do not
  change tab focus, keyboard prevention, disabled-tab or footer behavior.
- Layout remains navigable with empty/invalid/valid input, with existing palette
  availability and individual disabled drawer controls. No new navigation guard.
  Consume only when current input is valid at Layout entry. Clear all
  displayed outcomes together. A subsequent Layout reopen with no qualifying edit
  is silent; clicking an already active tab cannot replay them.
- Existing immediate derivation feedback while Layout is showing remains
  immediate, not queued. Real typing while those fields are hidden is not a
  real-user acceptance route; use controlled unit checks only to retain existing
  internal contract coverage.
- A drawer operation's status and warnings win after entry. A note pick, swap,
  drag, mirror, anchor or RESET must never resurrect consumed derived feedback.
  Preserve status/warning classes and error precedence; do not blanket-clear
  unrelated state from passive repaints.
- RESET clears pending derivation state, uses the existing reset result and
  preserves the accepted rule that unchanged subsequent typing cannot undo RESET.
  A real visible RESET journey proves the observable result. Do not count an
  impossible hidden-control click as a real user path or demand a mutant for an
  otherwise unobservable redundant defensive clear.
- Close, Back, Escape, completed save and fresh Add/Edit setup leave no pending
  outcome from the prior session. A prefilled, valid seated Edit must not announce
  a typed derivation merely because it was opened or blurred without an edit.
  Existing visible order hint and `aria-describedby` behavior remain intact.
- No changes to field messages, parse/refusal placement, notice-slot spacing,
  one-time hint announcements or other live regions. Do not fix a suspected
  prefill issue without first demonstrating a separate observable violation.

## Smallest implementation shape and file ownership

Prefer one tiny per-ring in-memory representation and a few explicit lifecycle
updates around the existing `noteCounts`, `showPendingDerive` and clear paths.
No new public API, durable schema, utility framework or generalized notification
queue. Test expectations come from the table above, not the implementation chosen.

| Lane | Worktree / owned files after approval | Responsibilities |
|---|---|---|
| T — independent oracle author | New clean root-assigned test worktree; tests/app.test.js, minimal tests/e2e.test.js | Freeze exact new titles/fixtures; write observable cases independently of app author. Do not edit app/helper. Root executes tests. |
| A — app author | Separate clean root-assigned app worktree; index.html app block only | Implement reviewed per-ring contract after the relevant new baseline tests are assertion-red. No engine/generated-region/CSS/copy changes. |
| M — later mutant author | Separate committed disposable tree; new/affected tests/mutants patches only | Generate actual diffs, preserve header intent, prove clean-green/assertion-red. No hand-written patch bodies. |
| I — root integrator | Separate integration worktree; plan/ledger, owned app/e2e floor rows, conflict resolution | Freeze source, record assignments/heads, integrate sequentially, own host-browser lease, CI/DEV and evidence. |
| R — fresh engineering and design reviewers | Read/report only, independent of A/T | Review plan before implementation and exact final diff/evidence afterward. Findings require correction/re-review. |

The Mac lane owns tests/helpers/cdp.js and tests/harness.test.js. Both streams may
eventually touch tests/e2e.test.js and floor/ledger files: root serializes integration
of those files, never permits competing writers, and validates the resulting
combined source. Worktrees do not isolate browser focus, CPU, ports or profiles.
If all agent slots are occupied, stage roles rather than invent independence.

Before any app lane creation record its actual host, absolute worktree, branch,
base/head, owner, plan pointer, last completed step, exact next action and approvals
in the root coordination record. Replace these planned roles with actual paths;
this draft's path is not an implementation worktree or a takeover grant.

## Spec-first validation and stop conditions

### Phase1 — review and freeze

Root obtains fresh engineering and design review of this artifact's exact hash.
Reviewers challenge state invalidation, count-status preservation, true user
routes, accessibility/fit, ordering and source/test ownership. Resolve material
findings, freeze final hash and obtain the app implementation grant. User's
latest-outcome choice is not alone that grant. No self-assessed numerical score
passes this gate. No app code is edited before it.

### Phase2 — independent tests and baseline red

T proposes exact titles and fixture inputs; root inspects current selectors and
freezes expected selected/executed counts before every command. Suggested groups:

1. Sequential inner→rim and rim→inner edits show two final outcomes in rim→inner
   order; two edits to one ring produce one sentence. Add both field and full-line
   routes using valid fully octaved English note strings.
2. Return-to-identity/count-change/inner-disappearance and restoration cases obey
   the table; count/restore wording remains accurate rather than showing a stale
   seat-memory result. Bottom-only and unchanged resync preserve the other ring.
3. Invalid/empty input creates and consumes nothing; Layout and palette remain
   available, while individual controls retain their existing disabled states.
   Recovery reconciles pending results before a valid-input Layout consumption.
4. Exact visible tab click, NEXT, ArrowRight and End routes consume once and keep
   the established focused element/ARIA selection. Preserve cyclic tab keys:
   focused Scale uses Left/Right/End→Layout and Home→Scale; focused Layout uses
   Left/Right/Home→Scale and End→Layout. Consume only an actual appropriate entry,
   not a same-tab key; ArrowLeft wrapping into Layout is a real consumption route.
5. Real visible RESET/drawer action status wins, repeated switches do not replay
   derived feedback, and later changed typed order creates fresh feedback.
6. Close while a result is pending, then open a **valid** unchanged seated Edit
   before entering Layout: no stale result. Exercise Back/Escape and session open
   where their shared close path warrants it. Do not rely only on empty Add.
7. A single valid Scale parse reorders rim and changes bottom count/absolute-angle
   state: opening Layout retains the rim-follows sentence AND the applicable
   existing bottom reset/restoration and put-down payload, in existing ring/suffix
   order. A later edit invalidates obsolete auxiliary text. Freeze concrete public
   input/precondition fixtures before implementation; never substitute internal
   flags or cache a no-longer-truthful notice. Add a fault that drops the bundled
   auxiliary payload and require assertion-red. Preserve count-only behavior.
8. Edit prefill with an order hint stays silent at open and blur-without-edit;
   a genuine subsequent changed edit announces the existing hint exactly once.

Baseline assertion-red for the primary loss-of-other-ring case is mandatory.
Not every additive guard is expected red on the accepted source. Do not force
already-correct controls to fail or weaken expectations to obtain a green run.
Keep full TAP, source SHA/tree, observed states/counts, exit status and cleanup.
Any red outside this contract is triaged, not repaired incidentally.

### Phase3 — implementation, green and meaningful mutants

Integrate A's minimal app change with T's tests; rerun the *same* frozen assertions.
Suggested generated faults for meaningful new groups: reset the whole queue on
one-ring update (loses other ring); reverse final ring order; fail to invalidate a
removed ring; clear on unchanged parse; omit consumption; omit a distinct route's
consumer; preserve state through all actual session-reset paths. Choose faults
against observable requirements, not arbitrary private variable shapes. Existing
mutants may cover preserved contracts; do not fabricate a one-to-one group count.

Use tests/CONTRACT.md: commit the disposable fault source, generate `git diff`,
strip `index` headers, include exact `# kills:` and `# suite:` headers. Every new
mutant's command must be clean-green, then assertion-red for its actual fault;
timeouts, launch failures, skips/cancels and syntax errors are not kills. Preserve
existing mutant intent or document/review genuinely stale contexts. Raise only
owned app/e2e floor rows from actually executed new counts, never from memory.

### Phase4 — browser, layout and independent acceptance

Root alone schedules supervised browser jobs under the shared lease and current
approved bounds; do not silently reuse Mac repair's larger full-run budget.
Use the shared browser runbook and approved helper revision, recording that SHA.
If native Mac execution remains blocked, retain the failure and use exact-head
Linux CI; do not claim Mac green or disguise an activation preload as acceptance.

Required real journeys: sequential edits on Scale then visible Layout entry,
all entry/focus routes, valid Edit reopen, visible RESET/drawer override and
refusal recovery. Include380x780 portrait and844x390 landscape, fallback and
checked-in real fonts. Measure combined drawer-status wrapping, control-column
placement, clipping, focus visibility and footer separation using existing limits.
There is no new arbitrary line budget or tolerance. At least English plus German
(capital Du conventions retained) must exercise the combined long message; select
the actual longest supported-locale combined sentence from current strings and
include it if different. Existing all-locale checks must remain green. No Settings
panel-fit run is required solely for this drawer text unless its source changes.

Run relevant existing order-follow, drawer/status, keyboard, field-message and
Layout-state checks, then full exact-head Linux validate. Do not treat plans-only
skips, old source CI or a targeted pass as final acceptance. Inspect actual app,
browser, Python, mutant and suite-health counts/no required skip/cancel/bad
verdict. Fresh nonauthor engineering and design reviewers inspect the final SHA,
all changed paths and actual evidence; address material issues and re-review.

### Phase5 — DEV delivery and durable handoff

Under an eventual explicit app-through-DEV grant, use the repository's same-head
HELD main-target CI PR and DEV companion process; no main merge without owner
consent. Validate actual combined DEV source after merge, not merely branch HEAD.
Exercise the changed journeys against the actual served bytes. If Mac helper
changes are integrated concurrently, prove both fixes and their interaction at
that combined source; neither lane's old green result establishes it.

Publish a factual shared DEV ledger checkpoint with plan/head/worktree/owner,
last verified step, exact next action, failed receipts, independent reviews,
CI and deployed evidence. If only a PR comment is published first, link it and
state that the ledger snapshot is stale; a local temporary artifact alone is not
a portable handoff. Stop with explicit limitations rather than claiming every
device/native keyboard or live font delivery was certified.

## Approval, rollback and remaining questions

- Settled: latest outcome per ring; once, rim→inner; no event history.
- Still required: independent engineering/design acceptance of the proposed edge
  semantics and an app-specific implementation/CI/DEV grant. No need to re-ask
  settled tone, note grammar, flashes or seat-number decisions.
- Potential material design amendment only if review rejects it: clearing an
  obsolete ring outcome on count-only change versus introducing deferred count
  notices. Recommendation is the minimal clearing rule above; defer the latter.
- No CLAUDE.md, AGENTS.md, hooks, active skills, global settings, auth, installs,
  main merge, parser/engine/deck/geometry/CSS changes or new notification feature.
- Before commit preserve dirty/untracked work and inspect full diff against the
  frozen base. Never reset another lane or discard failed evidence.
- Pre-DEV rollback: retain rejected branch/evidence and revert only the app lane's
  isolated changes through normal Git work, not root resets. Post-DEV rollback:
  scoped reviewed DEV revert PR under the established model; preserve independent
  Mac work and ledger history. Any production rollback/main action is separate.
- Stop for scope drift, unknown ownership, changed instructions, missing approved
  tools, unexplained regressions or repeated failed hypothesis. Regroup after three
  unsuccessful attempts rather than add retries, sleeps or weakened assertions.

Draft complete; no implementation or runtime success is claimed.
