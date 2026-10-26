# Saved variants — cross-tab storage consistency investigation

2026-10-25. **Read-only investigation and repair recommendation; no implementation
or wider contract change authorized by this document.** Release remains blocked.
Root alone owns browser execution and the ledger. No browser, app/test/helper,
configuration or instruction change was performed by this research lane.

## Finding and evidence boundary

The current native acceptance run demonstrates an acknowledged entry disappearing
from the shared collection. This is stronger than one target briefly displaying a
stale snapshot. It does not yet establish the precise browser-internal cause.

| Claim | Classification / evidence |
|---|---|
| Both import operations reported success but one entry remained | Verified in root raw `sv-native-concurrent-import-diagnostic-a3.stdout.tap`, `SV6_DIAG`: A returned revision2 with only PUBLIC PAN A; B returned revision2 with only PUBLIC PAN B; distinct random instance IDs, same fixed test epoch. Both results report published:true. |
| B-only result persisted through further observation | Verified: both target raw collections and caches contain one entry at revision2 immediately, after another task, and after foreground/two-frame observations. These scheduling stimuli are diagnostic, not a replacement passing gate. |
| Acknowledged writes physically flushed to disk | Unverified and not claimed. The implementation's ACK is successful setItem return; the defect is loss from the later observable collection, not a crash-durability experiment. |
| Actual distinct same-origin targets and exclusive barrier | Root native test verifies distinct target/session IDs, common storage and one held/two pending requests on the same lock name. A callback-level entry/exit trace is still required to demonstrate the precise failing critical-section order. |
| Failure depends on scheduling | Supported by root diagnostics a0/a1/a2 passing and a3 failing, plus the earlier uninstrumented failure. This is not a statistical reliability estimate; instrumentation can alter scheduling. |
| VM model proves native storage coherence | Contradicted by the native result. Existing unit and model passes establish only their own modeled semantics. |

Source baseline: integration `a8c6dee3`, index SHA256
`0d0845fccb44a4e775763daad5e9fed5acbc1710bee74e129e20e072f1d715ad`.
Diagnostic preload: `t-sv6-native-diagnostic-preload.cjs`, SHA256
`10456aae0937142f3c6c136d203cdea19fd4aa302eecce2ff568a146338440ed`.
It binds the actual test bytes and retains the original storage read and original
assertion before extra observation; its instrumented pass is not a new gate pass.
Private raw evidence root: `/private/tmp/handpan-share-hotfix.urAbvO/evidence/`.
Only public synthetic records were used.

## Existing source does re-read under the lock

`commitSavedDurable()` at index.html:10534 stages the current raw collection and
validated views before requesting the exclusive Web Lock. Its synchronous lock
callback reads the key again, retries if the raw string differs, applies the
command to the staged envelope, and calls setItem once. There is no explicit
unlocked durable fallback in this path. `stageSavedRaw()` parses the supplied raw
string afresh; no raw-stage memoization was found. `applySavedCommand()` clones
the staged envelope before changing it.

The CDP session adapter's temporary session-ID assignment also reaches synchronous
`Browser.rawSend()` payload construction (`tests/helpers/cdp.js:315–319`); the
source does not show an await that would obviously misroute simultaneous target
evaluations. This inspection reduces one hypothesis but does not replace the
required runtime trace. No side-effecting late unrelated writer has been ruled
out by a complete get/set trace yet.

Moving the current re-read expression into a different position within the same
callback is not, by itself, a cache-coherence or transaction primitive. Repeating
the test until it passes cannot establish that the current design is safe.

## Primary-source research

1. The HTML Web Storage introduction explicitly leaves cross-agent-cluster
   interaction undefined and warns authors against assuming a shared locking
   mechanism. It supplies no transactional read/compare/write operation.
   [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#introduction).
2. Web Locks coordinates cooperating agents sharing a storage bucket. Its lock
   lifetime follows callback completion; this orders access to the named abstract
   resource, not a documented flush/invalidation operation for renderer storage
   caches. Its motivating storage example uses IndexedDB.
   [Web Locks introduction and concepts](https://www.w3.org/TR/web-locks/#introduction).
3. Current Chromium `CachedStorageArea` source reads from a renderer map after
   EnsureLoaded; once loaded, EnsureLoaded returns. SetItem updates that map, sends
   a remote Put, and tracks a pending mutation; later change notifications can
   update nonlocal cache state. This architecture makes the stale-cache/remote-
   propagation hypothesis plausible. It is **not** proof that the exact Chrome156
   binary exercised followed a particular ordering. Source was fetched from main
   as data, not executed; the web text reader could not fetch this file directly.
   [Chromium CachedStorageArea](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/storage/cached_storage_area.cc),
   [Chromium DOM Storage architecture](https://chromium.googlesource.com/chromium/src/+/main/content/browser/dom_storage/README.md).
4. IndexedDB supplies overlapping readwrite transaction exclusion, ordered access
   to the same object store, and subsequent transactions observing committed prior
   changes. Transaction completion, rather than individual put-request success,
   is the commit acknowledgment. Disk-flush guarantees still depend on requested/
   supported durability and must not be overstated.
   [IndexedDB transactions and scheduling](https://www.w3.org/TR/IndexedDB/#transaction-scheduling).

The observed browser failure justifies holding release independently of whether
the eventual explanation is renderer caching, ordering, an overlooked writer or
a source/test error. Do not treat the generic standards warning alone as proof
that every Web-Locks/localStorage design must fail in every browser.

## Next root diagnostic — before selecting the repair

Use only the owned disposable browser profile and public fixture, one root lease,
a bounded supervisor and exact source/test hashes. Preserve the same unmodified
barrier, result checks and final expected2-versus1 assertion. No timeout increase.

Install narrow instrumentation in BOTH targets before starting their imports:

- Wrap native navigator.locks.request only for the exact saved-collection lock.
  Preserve receiver, all options, signal, callback arguments, callback result and
  the exact original returned Promise. Record requested/entered/returned/exited
  phases, actual lock name/mode and request identity. Do not add an await, timer,
  readback, lock or scheduling yield to the callback. Observe settlement without
  replacing the returned Promise or introducing an unhandled rejection.
- Wrap Storage.prototype.getItem/setItem for the exact collection key, delegating
  once with the original receiver/arguments. Log actual returned raw value or
  actual input/return/throw, plus the currently active callback identity. Do not
  call getItem again merely to log state. Keep raw values private/public-fixture
  only; production logs must not contain user records.
- Record storage events separately and use performance.timeOrigin+performance.now
  alongside per-context sequence numbers. Timing comparisons are diagnostic,
  not a replacement for proving real lock nonoverlap and read/write order.
- Capture initial raw epoch/revision, each staged raw, in-callback raw read, each
  setItem input and result, final ACK envelopes and later raw views. Include every
  other collection-key writer, not only the two expected import writes.

Interpretation:

| Trace result | Consequence |
|---|---|
| Nonoverlapping same-name exclusive callbacks, but second reads old raw after first setItem returned | Current API-level check is insufficient on this host; storage coherence/publication is implicated. |
| Overlapping callbacks, differing names/buckets/options or misrouted sessions | Fix the specific lock/protocol/instrumentation error; do not redesign storage from an unproved diagnosis. |
| Second reads latest raw but stages/applies old state anyway | Source staging/command bug; repair that boundary with meaningful RED/GREEN. |
| Extra unrelated writer replaces the collection | Trace its owner/authority and add the appropriate real-life regression. |

Optional yielding/moving-staging variants may answer a hypothesis in a separate
disposable diagnostic, but must be labeled altered-source experiments. A few
passing yields/RAF/timeouts are not a supported production consistency guarantee.

## Repair options and recommendation

| Option | Correctness basis / scope | Recommendation |
|---|---|---|
| Repair a specific source/lock error while retaining localStorage | Appropriate only if callback-level trace identifies a concrete error with an enforceable invariant and discriminating negative control. Merely moving staging, re-reading twice, or yielding lacks a documented cache flush/CAS guarantee. | Investigate first; do not approve a timing workaround from passing repetitions. |
| One authoritative IndexedDB envelope in one overlapping readwrite transaction | The storage engine provides serialization and conditional update in the same transaction. Keep the validated schema1 envelope and instance/UI contract; replace persistence adapter, initialization/reconciliation/notification and tests. | Preferred durable fallback if trace confirms correct lock use but stale shared-storage reads. Requires a concrete reviewed amendment and an explicit authority assessment; any new CLAUDE diff still needs exact owner approval. |
| Explicit THIS-TAB-only operation while a durable fix is held | No shared writes and no claimed persistence; preserve recoverable drafts and clear session-only UI. This is a product limitation rather than a durable cross-tab solution. | Safe fallback only if owner explicitly accepts a narrower delivery; not equivalent to the current requested saved-variants outcome. |

No second verified durable alternative is being invented to make the option
table look balanced. An append-only per-command localStorage log would change
conflict/RESET/acknowledgment semantics and introduce compaction/recovery; a leader
tab still needs reliable persisted-state acquisition on failover. Neither is a
small proven replacement for a transactional store.

## Minimum IndexedDB amendment if needed — proposal, not implementation

Preserve wire6/record4, schema1 fields, full portable equality, stable handles and
ordinal history, explicit slot authority, raw legacy preservation, conflict
semantics, draft ownership and truthful session/protected recovery. Do not add a
second live authority or mirror writes back into the shared localStorage envelope.

Use one database/object store containing a single serialized envelope record.
The exact database/store/key names require the amendment's reserved-namespace
review; these are not selected here. Stage expensive engine validation outside
the write transaction. In one readwrite transaction, read authoritative current
raw, verify epoch/revision/scope and prepared-input freshness, then conditionally
write the next envelope. If expensive restaging is necessary, abort/retry outside
the transaction and recheck in a new one. Keep requests in an active transaction;
do not insert arbitrary awaits that allow auto-commit. Publish success only at
transaction complete; put-request success is insufficient. Abort retains the old
committed state and never publishes an instance or consumes a durable ordinal.

Define initialization migration from exact old source strings without deleting or
rewriting them; handle any existing experimental new-format localStorage envelope
as evidence to preserve, not an empty reset. Capture a source precedence rule and
old-writer divergence/recovery explicitly. A migration transaction must be
idempotent and preserve unknown/opaque rows. Unsupported/denied/blocked IDB must
not overwrite data, silently fall back to unlocked durable writes or claim an
empty collection. Reconciliation reads IDB; notifications are hints, not authority.
A minimal notification/visibility strategy needs its own focused review.

The current schema/ENGINE-SPEC contract requires the namespace, one setItem ACK
and exclusive Web Locks; see `docs/ENGINE-SPEC.md:983–990`, schema contract, parent
plan107–150 and the exact instruction packet98–108. CLAUDE.md's approved saved-
instance paragraph refers to ENGINE-SPEC12/14 rather than naming setItem or Web
Locks itself. IDB is named as a fallback **design alternative**, not an already
implemented second backend. Even preserving JSON fields does not make this a
one-line source fix: a concrete amendment and fresh ENG/design review are required.

### Authority assessment — avoid inventing a new approval requirement

The explicit owner hard gate applies to **every CLAUDE.md edit** and main merge;
it must not be silently generalized to every engineering document or internal
adapter choice. The parent plan assigns ENGINE-SPEC/README to root and explicitly
contemplates IDB if the required context/performance fails. The owner subsequently
approved the reviewed plan through DEV and standing autonomous recommended
decisions. Historical planning-only STOP prose is superseded by that approval.

Recommended interpretation for root to confirm against the exact approval record:
if the amendment retains the approved observable coexistence/equality/Edit/slot/
conflict/recovery contract, existing record/wire formats, no-destructive-migration
rules and honest session fallback, then replacing the **unshipped internal adapter**
with the already-listed transactional alternative can remain within through-DEV
implementation authority after independent review. The reproduced native failure
is evidence that the present required context fails. Root should record the
interpretation and amended evidence/acceptance contract; do not ask again solely
because an agent-authored checkpoint used generic 'review/approval' wording.

Do not change CLAUDE.md: its existing high-level ENGINE-SPEC references can remain
accurate. Update the concrete proposed ENGINE-SPEC contract in the amendment;
this is not permission to reapply a modified version of the previously exact-
approved CLAUDE patch. If review finds a necessary CLAUDE wording change, different
product semantics (such as a deliberately session-only release), destructive
retention policy, new dependencies/installs, extra permissions or broader scope,
prepare the exact reviewable decision and obtain the specifically required owner
approval before that action. No main merge is authorized.

This assessment is a research recommendation, not a new permission grant. It
allows useful investigation/review now while preserving the owner's explicit
guardrail and avoids a premature permission question before a concrete solution.

## Required validation and measurement changes

- Original actual two-target distinct Adds must retain both entries; exact imports
  allocate once. Exercise transaction order, stale Edit, delete/Save, RESET scope,
  prefer writes and missed notifications using real browsers, not just VM storage.
- Force request failure, transaction abort after successful put request but before
  completion, completion success with local publication failure, blocked upgrades,
  unavailable/denied access, quota and interrupted migration. Assert successful
  command only at complete and preserve drafts/source bytes in every refusal.
- Retain unknown records, legacy raw strings, protected future data, stable ID/
  ordinal and different-epoch/same-epoch delayed-completion regressions.
- Update only superseded persistence-access test adapters/oracles with a source-
  linked map; do not weaken any behavior assertion, count, budget or mutant gate.
- A custom VM IDB model, if proposed, needs an independently reviewed limited
  transaction API contract, asynchronous scheduling/abort/complete tests and
  meaningful mutants. It cannot establish native browser transaction behavior.
  No dependency installation is implicitly authorized.
- Rerun2/20/200/exact1MiB public fixtures with30samples, source/snapshot/serialized
  envelope accounting, cold initialization and same-host selection responsiveness.
  Existing synchronous-Web-Lock callback timing cannot be relabeled IDB timing.
  Define transaction queue/read/validation/serialization/commit timing, preserve
  meaningful50ms/100ms UI-blocking budgets where applicable, and independently
  review any changed metric. No threshold inflation to claim parity.
- Re-run native UI/conflict/focus/locale/fit controls, generated faults, exact-head
  CI and actual served DEV before requesting owner QA. Keep every failed raw run.

## Continuation

Last: read actual source/raw evidence and current primary specifications/Chromium
architecture; documented the decision boundary. Next: root's callback/get/set
trace, then evidence-specific repair or a concrete reviewed transactional-store
amendment. Release remains blocked; no implementation, wider scope, main merge
or additional CLAUDE approval is granted by this research artifact.

## Callback-level trace independently audited — release blocker confirmed

Successor root run `sv-native-lock-storage-trace-a0` reproduced the original
assertion on its first attempt: one selected test, zero passes, one intended
ERR_ASSERTION failure, no skip/timeout, cleanup true. This research lane read the
actual raw trace and the trace-preload source (not merely root's summary). The
preload preserves native receivers/options, one get/set delegation, synchronous
callback results and the original request Promise; it adds no operation-phase
readback or yield. The held barrier returns a Promise, so its callback-return
marker is not its release; the request-resolved marker correctly identifies
release before the two commit callbacks.

Relative milliseconds, derived from the recorded timeOrigin+now values:

| Event | Time | Observed state |
|---|---:|---|
| A barrier request resolved |7.2| Exclusive barrier released. |
| A commit entered |7.3| Exclusive lock; getItem returns revision1/zero entries. |
| A setItem returned and callback/request completed |7.5| Input revision2, only A; API ACK returned. |
| B commit entered |7.6| Exclusive lock, after A completion; getItem STILL returns revision1/zero entries. |
| B setItem returned and callback/request completed |7.9| Input revision2, only B; API ACK returned. |
| B received A storage event |10.1| Event reports old revision1 -> A revision2, after B already wrote. |
| A received B storage event |11.5| Event reports old A revision2 -> B revision2. |

No extra collection-key writer appears between these two observed writes. Both
results contain distinct IDs and published:true; both subsequent raw collections
contain B only through the later task/frame diagnostics. The callbacks did not
overlap; they requested/granted the same exact lock in exclusive mode. The
in-callback stale read is now directly observed. Source after fresh getItem still
applied the staged revision it had compared, so this trace does not point to an
extra stale-stage variable bug. Browser internal implementation details remain
unproved, but the API boundary is sufficient to reject the current durable
localStorage protocol on this host. A timing yield is not a principled repair.

A concrete successor is now drafted in
[transactional storage amendment](2026-10-25-saved-variants-transactional-storage.md).
It needs fresh independent engineering/design review before code; root owns
authority assessment and sequencing under the standing through-DEV scope.
