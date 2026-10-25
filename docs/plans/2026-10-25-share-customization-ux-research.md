# Share customization: UX and lifecycle research

2026-10-25. Independent UX/lifecycle lane, source inspection only. Read at
`ff81ffe38f83bf9eb4ed7173dd0fddc85234211f`, after preliminary inspection at
`b0d607ffc41587debeb594573a2f11ac6ca9ef28`. Frozen investigation prompt SHA-256:
`1489e53d1a23a4dd56d8c1f724bd8c4a6ae1d3c9094e2e27fd4967ab8aa2fb77`.
The lane owns this note alone. No app, test, configuration, browser, remote or
owner-storage operation was performed. No tests were executed. Source references
below establish code paths and existing assertion intent, not measured coverage.

## Finding and evidence boundary

The owner confirms SAVE CHANGES before LINK and reports that a fresh outbound
link lost a saved customization. That report remains credible, unresolved human
evidence. The private Edit screenshot cannot independently establish commit
timing, and it does not negate the owner's confirmation. No private names,
screenshots or full owner links are reproduced here.

The frozen prompt reports a corrected, awaited VM positive control for injected
angle state. This lane did not execute that control. Its earlier synchronous
clipboard inspection is invalid negative evidence because copy is asynchronous.
Neither control establishes real gesture, native history or receiver behavior.

Source inspection finds a coherent normal SAVE-to-route path and several useful
diagnostic boundaries. It does not establish the owner's root cause. A URL-only
repair is premature until the first disagreeing state is observed.

## Four states and operation semantics

The observable acceptance contract should distinguish these states:

| State | Required observable meaning | Source boundary |
|---|---|---|
| Editor draft/preview | Current valid fields and intended pitch-to-position mapping; explicitly held preview through invalid input | `sheetOptions`, `solvePreviewLayout`, `paintPan`, `holdPanPreview` |
| Committed selection | Selected registry object and saved record describe the accepted customization; durable storage and session fallback are inspected separately | `runGenerate`, `generateDeck`, `rememberScale`/`replaceScale`, `writeScales`, `selectDeck` |
| Canonical address | With no modal open, origin/path/query plus canonical selected committed scale route | `routeInfo`, `syncRoute` |
| Outbound operation | One URL captured for the committed selection at the explicit LINK invocation and retained through every branch | `copyLink` |

The draft becomes committed only after successful SAVE. A held pan during invalid
input is insufficient proof of a current valid draft. Invalid SAVE and cancel must
leave committed state unchanged. LINK must never silently serialize the draft.

Recommended operation contract for plan review: payload belongs to the LINK click
that initiated it. A later selection does not make the original snapshot wrong.
Do not replace its payload halfway through clipboard rejection/native share/manual
fallback. Separately define completion ownership: after a newer LINK intent,
selection, SAVE or modal transition, an older operation must not steal focus,
reveal a misleading old fallback, erase current feedback or announce success as
though it referred to the new context. This is a proposed acceptance contract,
not a claim that a new cancellation implementation is already approved.

```mermaid
sequenceDiagram
  participant U as User
  participant E as Editor
  participant C as Registry / records
  participant H as History / route
  participant L as LINK operation
  U->>E: pointer release / swap / nudge
  E->>E: update draft options and repaint
  U->>E: SAVE CHANGES
  E->>C: parse, build and register
  E->>H: close sheet; queue history.back
  E->>C: remember or replace saved record; select
  C->>H: syncRoute with committed selection
  H->>H: pending popstate; syncRoute again
  U->>L: LINK invocation
  H->>L: capture current href once
  L->>L: clipboard; native share; selected-text fallback
```

Native traversal and invocation can interleave differently from this illustrative
settled order. Diagnostics must retain actual event order, without a sleep that
conceals the interval under investigation.

## Source findings and boundaries

**Verified from source, runtime effect unverified here:** `index.html`
`runGenerate` builds with `sheetOptions()` before `closeScaleSheet()`, persists
with `rememberScale`/`replaceScale`, then calls `selectDeck`, which renders and
calls `syncRoute`. Closing hides the sheet and queues `history.back()` with
`pendingPop`; its eventual popstate calls `syncRoute` again. Ordinary popstate
must leave the navigation destination alone until hashchange routes it. Changing
this order indiscriminately could re-import an older same-ID layout or consume
the wrong history entry.

`copyLink` captures `location.href` once. Clipboard, native-share and manual
fallback closures all retain that URL, including delayed rejection paths. Its
deferred success handler clears the live region before scheduling success.
There is no visible operation-generation/context guard in those callbacks.
`syncRoute` hides a currently revealed fallback only when it rewrites the route;
opening Add/Edit and closing the settings panel also hide it. Those actions do
not cancel a previously pending callback. A delayed rejection could therefore
reveal an earlier snapshot after it was hidden, and `reveal` calls focus/select.
This is a source-only hypothesis for stale completion UI, not proof of the
reported missing-angle defect. Original-snapshot delivery alone is not a bug.

The source's current-href contract is mandatory: `CLAUDE.md` explicitly says
COPY LINK copies `location.href`, never a fresh encode; query preservation is
protected by `tests/mutants/su_copy_reencodes.patch`. `shareLink(deck())` omits
the query and is not a drop-in replacement. An actual necessary contract change
needs a reviewed exact CLAUDE diff and separate owner consent. Prefer proving
the committed-data/route chain before proposing any such change.

Gesture movement is committed to the draft at pointer release via
`dropNote`→`slideNote` or angle/seat exchange. Pointer movement of the ghost alone
is insufficient. `pointercancel` restores the pre-pick state; sheet teardown
cancels in-flight gestures. A bottom angle nudge writes `layoutAngles` and
repaints. `sheetOptions` deep-copies seats/angles; `generateDeck` carries them
past core parsing, solves and deep-copies them onto built options. Correct drawn
field positions still require checking those options: share encoding writes
`at-` from options, not from the generated field angles.

Intentional transformations must remain controls: bottom count changes clear
angles through `syncRingCounts` with existing notices; RESET clears layout;
typed order derives rim/inner seats, not bottom angles; mirror/anchor toggles
that violate the placement floor are refused; Edit SAVE drops an explicit
legacy parent so inference resumes. These are not missing-angle defects merely
because output changes. Same-count bottom pitch edits require a pitch-keyed
oracle, because retaining list length does not establish retained physical-note
meaning. Null/default lists may normalize to no `at-` without losing geometry.

`savedScales()` prefers a readable persisted array; `writeScales()` first updates
`scalesMemory`, then silently catches serialization/write failure. If an older
array remains readable after a failed write, later reads can prefer it over
the new fallback. Snapshot actual persisted bytes, fallback and registry
independently; session success is not evidence of durable saving. Reachability
and scope of a repair remain unverified here.

For two tabs, `CUSTOM` is per-document, while writes read the shared saved list.
No storage/focus/pageshow/visibility reconciliation listener was found in the
app. A tab can retain an older selection/layout while another writes the same
identity. A reload with the old tab's `#s=` imports that URL again and replaces
the same-ID record through `rememberScale`. This is a source-derived policy
consequence, not an executed cross-tab loss. Distinguish explicit import/save/
reload replacement from a route/display mismatch. Auto-reconciling dirty
editors, identity redesign and keep-both behavior are separate unapproved work.

## Discriminating diagnostic matrix

Every row below is **Unverified runtime coverage in this lane**. Existing test
source is supporting intent only. Root owns browser evidence and its ledger.

| Journey | Observable oracle and discriminating boundary |
|---|---|
| Default and moved controls, import both orders | One same-ID entry by existing policy; selected mapping, record options, canonical route and captured outbound decode agree with the last explicit import |
| Real drag, swap and fine nudge; SAVE; reopen | Capture released gesture result before SAVE, registry/options and persisted record after SAVE; reopening shows the committed mapping |
| Immediate and settled SAVE→LINK | Record task/event sequence, pendingPop, popstate/hashchange, route and invocation snapshot; distinguish pre-encode loss from route restoration and invocation capture |
| No-op custom SAVE; seeded unchanged SAVE | Custom layout survives unchanged; unchanged seeded SAVE mints no record |
| Notes/count/order/reset/mirror/anchor/name/palette/parent | Apply intentional reset/inference rules; compare pitch→angle, metadata and options; valid-invalid-valid recovery cannot serialize a stale held preview |
| Clipboard resolve/reject/missing; native success/AbortError/other reject | Await actual Promise settlement; every branch retains the invocation URL; AbortError adds no false success/fallback; other failures reveal a selected readonly URL only in a valid current context |
| Deferred completion after selection, SAVE, Add/Edit/About, newer LINK | Original payload is allowed; obsolete callback must not take focus or replace current context feedback; specify supersession behavior before red-test design |
| Fresh receiver of actual captured URL | Clean owned profile with no sender storage; compare sender committed pitch mapping, receiver geometry/options/record/canonical URL before another same-ID import can mask loss |
| Two tabs at one origin | Two owned targets in one profile, distinct per-tab mapping snapshots and shared record snapshots after import/save/reload/focus; dirty draft remains intact unless explicitly saved/cancelled |
| Back/Forward, restored tab, Add/Edit/About cancel | Correct selection/route, no extra import/history entry; LINK inaccessible under inert modal background; focus returns to a visible opener/chip |
| Legacy/current, malformed/newer/over-cap, null/seat/angle lists | Successful link semantics round-trip; refusal changes no saved records; disabled LINK cannot emit bare/refused URL |
| Phone/desktop keyboard and languages | Existing target/focus behavior and out-of-flow fallback preserved; eight-language conventions and English scale grammar remain; Safari/native picker/physical QA separately recorded |

For each measurement retain a sanitized tuple of event, selected identity,
pitch-keyed draft/committed mapping, option angles/seats, persisted record bytes
or controlled storage refusal, canonical route semantics, outbound invocation
identifier and focus target. Capture the before-state before subsequent imports.
Literal byte equality supplements semantic decode; label equality alone is weak
because U seat labels can renumber under placement changes.

Use anonymized fixtures and controlled page-owned clipboard/native-share sinks.
Never read or write the owner's OS clipboard. Label interception as intercepted
coverage; it does not validate OS permission/native-picker behavior. A receiver
must open the captured outbound URL, not a newly generated expected URL. Two
`launch()` calls create two profiles in `tests/helpers/cdp.js` and cannot prove
shared-origin tab behavior; use reviewed two-target instrumentation within one
owned profile without changing global helper policy.

## Existing evidence inventory and required limits

Inspected assertion sources include `tests/app.test.js` groups SU/FPS/FPD/SO:
COPY LINK query/success/fallback/AbortError; record and bar round-trip after a
move or angle swap; count-reset/null-list controls; sheet close/popstate/focus;
modal inertness and fallback hiding. Relevant browser source is
`tests/e2e.test.js` “share url”: edge 2 Add/Back, edge 4 SAVE with changed fields,
edge 8 hashchange/idempotence, edge 9 clipboard, plus SI focus/modal/fallback
journeys. Edge 4 waits for a route change, settles and sleeps 300ms; it does not
establish immediate angle-only SAVE→LINK. None was run by this lane.

`tools/sandbox.js` records `history.back` without traversing a history stack;
popstate is dispatched explicitly. A VM test can prove handler logic but cannot
prove native traversal or cross-tab storage events. `tests/helpers/cdp.js`
creates owned profiles, tracks browser groups and closes/reaps resources; root
must reserve the single browser lease and use its bounded reviewed supervisor.
No missing selector, skip, TypeError, startup failure or timeout counts as a
passing journey or mutation kill. Full exact-head Linux validate and actual
served DEV verification remain later integration gates, not evidence supplied
by this research note.

If diagnostics find no reachable mismatch, retain the owner report and bounded
hypotheses and produce a conditional plan. Do not manufacture a red by manually
corrupting the address bar and call that the owner's defect. Do not refresh a
URL as a substitute for fixing missing saved options. New tests must start from
observable requirements and carry generated killing mutants and raised floors
under `tests/CONTRACT.md`; this documentation-only lane needs no invented tests.
