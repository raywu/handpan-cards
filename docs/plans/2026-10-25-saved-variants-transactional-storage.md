# Saved variants — transactional storage amendment

2026-10-25; review completed2026-10-26. **Implementation amendment independently
ENG/design-cleared; root authorizes scoped execution under standing authority.** This fixes a reproduced loss of an acknowledged variant
inside the already authorized saved-variants workstream. No main merge, install,
global configuration or CLAUDE.md edit is authorized or required by this draft.

## Decision and evidence

Replace the unshipped new-format localStorage persistence adapter with one
authoritative serialized-envelope record in IndexedDB. Retain the existing
exclusive Web Lock requirement as the capability/cooperation policy; correctness
of persisted read/compare/apply/write comes from one IndexedDB readwrite
transaction, not from cache coherence between renderers. Do not add a second live
store, time-based settling delay or automatic mirrored localStorage write.

Independent audit of root `sv-native-lock-storage-trace-a0` shows nonoverlapping
exclusive callbacks: A read empty revision1 and set revision2/A; B acquired after
A completed but still read empty revision1 and set revision2/B. Both API-ACKed,
only B remained. Original assertion failed, no skip/timeout, cleanup true.
[Investigation and primary-source evidence](2026-10-25-saved-variants-storage-consistency-investigation.md)
contains raw locators, trace audit and qualified Chromium/spec research.

IndexedDB's [transaction scheduling rules](https://www.w3.org/TR/IndexedDB/#transaction-scheduling)
provide overlapping readwrite exclusion and later transactions observing earlier
committed changes. This is an API-level transaction guarantee, not a promise of
physical disk flush or proof that a custom VM model matches every browser.

Preserve the parent plan/schema/recovery contract except the persistence-specific
changes below. Distinct variants coexist; exact imports deduplicate by full
portable meaning; Edit changes one stable instance; all source/opaque/sibling
bytes, slot proofs, lifetime IDs, generated data, UI ownership and conflict rules
remain. Wire6/record4 and English input grammar stay unchanged. No new copy is
planned: existing session/recovery/failure text covers unsupported/unreadable data.

## Exact storage and result contract

| Item | Proposed value / rule |
|---|---|
| Database | `hpfc.saved-scales.v1`, version1. This is a separate API namespace from the old localStorage key. |
| Object store | `collections`, out-of-line keys, no autoIncrement/indexes. |
| Authoritative record | Key `current`, value the JSON string of the same schema1 envelope. No generated deck/DOM object in storage. |
| Missing versus corrupt | Prove existence with `getKey(current)` alongside `get(current)` in the SAME transaction. Only an absent key means absent. A present key whose value is undefined/null/nonstring/malformed/future-schema is protected data, never migration permission. |
| Coordination | Existing `handpan-cards:saved-scales:v1` exclusive Web Lock retained, held until transaction settlement. No unlocked durable fallback. |
| Success | Same command/result fields, persistence:'durable'; API ACK occurs only on transaction `complete`. Request success or put success alone is insufficient. |
| Refusal/abort | Same app failure kinds; old committed record and draft remain. No published instance/ordinal or saved-success notice before complete. |
| Session | Same cloned in-document command path, no IDB/localStorage writes, no automatic promotion. Default no-capability shipping consumers remain synchronous session boots. |

Unknown envelope/wrapper/record fields stay preserved. Do not rewrite immutable
`migration.raw` or its source-row instance mapping. Serialization remains one
JSON envelope; the standard legacy public fixtures retain their exact reviewed
serialized-byte recipes and no product count cap is introduced.

## Adapter algorithm and lifecycle

### Open/read

Use a small app-local adapter in index.html app JS, not a package or test seam.
Open the database once per live connection; on initial upgrade0->1 create only
the required store. Existing unsupported database version, absent expected store,
or malformed record is protected/unavailable state: never delete a database,
clear a store, downgrade or repair unknown data by overwriting it.

A readonly transaction gets `current` and its `getKey` existence result, returning
both only after completion. A present `undefined` value is distinct from an absent
key. Validate the existing object store is out-of-line (`keyPath === null`) and
`autoIncrement === false`; unknown schema is protected rather than repaired.
A cached connection closes on versionchange and is marked unusable; subsequent
commands reopen or fail safely. A blocked open must finish initialization with an
explicit usable recovery/temporary state instead of spinning indefinitely. Keep
handlers on a retired request so a late success closes its connection without
starting migration or publishing stale initialization. Handle open/request/error/
abort/closed-connection failures without losing the first useful error.

### Mutations

1. Validate/build the incoming candidate once outside coordination, as today.
2. Read the current JSON string in a completed readonly transaction and stage
   validated views/meaning outside the write transaction.
3. Request the same exclusive Web Lock with the existing AbortSignal. Inside it,
   create one readwrite transaction on `collections`, get `current` and getKey
   afresh, and settle those existence/value observations within that transaction.
4. In that get's active success handler, compare the returned string with the
   staged raw. On mismatch, intentionally abort with a private retry reason,
   release the lock, restage current data outside, and retry. Do not label this
   deliberate retry as a storage failure or accept an old in-memory snapshot.
5. On equality, enforce existing epoch/target revision/slot/RESET/equality rules,
   apply the copied command and serialize. Issue one put only when changed. Do
   not await engine/network/UI work inside request handlers; transaction
   auto-commit must not split the read from the write.
6. Cache the app result locally but return ACK only on transaction complete. Any
   request error or abort before complete returns failure and does not publish.
   No-op commands also await successful transaction completion.
7. After complete, publish through the existing publication guard; preserve
   successful ACK with published:false if a newer epoch/revision or a local
   publication error superseded it. Never retry allocation after ACK.

Abort before grant cancels the queued Web Lock. Abort after transaction creation
may abort a still-active transaction; if it has already committed, retain that ACK
and suppress obsolete UI using existing generation ownership. Do not convert an
InvalidStateError from a late abort into a rollback claim. Settle once across all
request/error/abort/complete paths and remove owned signal listeners.

## First migration and old writers

Existing valid IDB `current` always wins. An unreadable/future/denied current
record never falls through to stale localStorage sources. If the record is
**actually absent**, prepare the first migration outside the write transaction:

1. If the experimental localStorage `hpfc.saved-scales.v1` exists, validate and
   copy its envelope without reallocating IDs, changing source-row mappings,
   dropping unknown data or losing current entry/collection/slot revisions. Add
   only optional immutable `migration.backendSource={key:'hpfc.saved-scales.v1',
   raw:<exact source string>}` as recovery provenance. It is not a second
   authority and never drives commands. Keep the original localStorage key.
   On INITIAL experimental-LS import, ANY pre-existing own `migration.backendSource`
   property is a collision, including null or a superficially matching object: do
   not overwrite it. Leave the exact raw source and IDB record unchanged, enter
   protected recovery and permit only the explicit temporary path. For an existing
   authoritative IDB envelope, an optional backendSource must be an object with
   exact key `hpfc.saved-scales.v1` and string raw; malformed provenance protects
   the collection. Branch inspection reads only that whitelisted key and compares
   exact strings; it never executes/parses provenance into command authority.
   This conservative collision rule preserves all unknown bytes instead of silently
   appropriating an older unknown field. Add explicit collision/invalid-provenance
   tests; do not silently erase the property or call the source empty.
2. Otherwise use the existing three-source legacy migration, preserving every
   source row/raw string and old-visible selection/slot mapping exactly. No
   backendSource field is needed on this normal path, so all four frozen byte
   fixtures remain unchanged. Absence of backendSource implies the experimental
   key was absent at first migration.
3. Under the Web Lock, one readwrite transaction rechecks that `current` is still
   absent by a same-transaction getKey/value check before putting the staged first
   envelope. A present undefined/nonstring value is protected. If another initializer won,
   abort/retry and adopt its authoritative record; no second allocation commit.
4. Old clients can still change legacy localStorage while migration runs. Those
   sources are preserved and their later divergence is a separate recovery
   branch; do not pretend IDB can make old-client localStorage writes atomic.
   Extend legacy-branch inspection to the retained experimental key as well as
   the three existing raw sources. Never automatically replay a branch.

A failed migration may leave an empty database schema, but no partial envelope
record or deleted source. Its next attempt remains idempotent. Denied access is
UNKNOWN, never proof of an empty IDB collection. Known unsupported capabilities
retain the explicit session path; once persistent access is attempted and
unreadable, use the existing protected/recovery UI and explicit temporary-use
choice without claiming stale legacy data is current. Mid-session failure never
silently becomes a successful session save.

## Capability and session initialization authority

| Observed capabilities/data | Initialization and write authority |
|---|---|
| Web Lock + readable supported IDB/current | Durable path uses acknowledged IDB state. No stale localStorage fallback. |
| No Web Lock, but supported IDB/current is readable | Complete a readonly existing-database transaction, hydrate the THIS-TAB clone from that authoritative snapshot, then close the connection. Never write schema, record, preference or notification as part of session initialization; subsequent edits stay memory-only. |
| No Web Lock; IDB key/database genuinely absent | Use a validated legacy/experimental recovery copy in memory only. Do not initialize a durable record or commit a database schema. |
| IDB API genuinely unavailable before an attempt | Keep the synchronous explicit temporary path needed by default shipping consumers; any readable legacy copy is a recovery source, never proof that no IDB data exists or that legacy data is latest. Mark authority unavailable and use truthful existing session/recovery guidance. No durable write/promotion. |
| IDB open/read denied, blocked, unsupported/newer, present malformed or otherwise UNKNOWN | Protected/recovery state, no automatic stale-LS fallback presented as current and no overwrite. Explicit temporary-use choice remains available without claiming durable emptiness. |

An existing-database readonly probe must not create a committed schema: opening
without a version may discover a new database via oldVersion0; deliberately abort
that upgrade WITHOUT createObjectStore, tag only that intentional abort as known
absence, retain handlers to close late connections, and validate no committed
database remains. Existing supported connections can be opened without upgrading;
newer versions are inspected only enough to close/refuse. Other abort/errors are
UNKNOWN, not absence. Never add a fake synchronous IDB return to retain old tests.
Default no-IDB model boots can remain synchronous; a readable asynchronous backend
requires savedReady before first publication even in session mode. Once the
session clone is chosen, notifications/focus cannot silently refresh or promote
it over its local edits.

Required model/native controls: seed authoritative IDB with A and stale LS with B,
disable locks and confirm session shows A with zero durable/schema writes; absent
database/no locks leaves no committed database; denied/newer/present-undefined IDB
plus stale LS refuses overwrite/false migration. Verify existing recovery/session
copy remains truthful and fits in affected locales; no new wording without the
normal localization/review gate.

## Cross-tab reconciliation without a second ledger

Use a bounded single BroadcastChannel named `handpan-cards:saved-scales:v1` when
available. After complete, send only a schema/epoch/revision hint; recipients
re-read IDB. A message payload is untrusted notification data, never a storage
snapshot or command authority. Notification failure cannot undo ACK. Coalesce
reconciliation work and keep newer-revision publication guards. A new hint/focus
request arriving after an in-flight read took its snapshot must mark a trailing
read pending; do not merely return/reuse the old Promise and drop the hint. After
the current read settles, read again until pending hints are serviced, yielding
through the actual async transaction lifecycle. Session/protected mode changes
retire queued durable reconciliation. Test readN held -> peer commits N+1/hint ->
release readN -> clean view reaches N+1 without another focus/command, while dirty
draft/caret/scroll/focus stays unchanged. Include delayed duplicate/out-of-order
hints; do not create a synchronous retry spin or publish older revisions.

Also re-read on focus/pageshow and when a hidden document becomes visible. If
BroadcastChannel is unavailable/denied or a notification is missed, these reads
and the next command's transactional checks preserve safety. Do not advertise
instant remote updates in the absent-notification case. Old localStorage events
only inspect/report legacy divergence. No commit marker, polling daemon or
localStorage envelope mirror. Keep one connection/channel per tab with explicit
closed/versionchange handling; native page teardown also releases them.

Clean displayed content/route refresh together. Dirty drafts retain original
revision, text/caret/pick/scroll/focus; no notification automatically retries a
mutation. Existing visible conflict copy may update from changed to deleted
without revealing/scolling the working view. Do not auto-import an old URL on
remote deletion. A remote preferred selection never hijacks local practice.

## Swarm lanes, ownership and order

Root is sole integrator/browser operator. Freeze a root-selected baseline after
the current UI/keyboard/announcement fixes; all active writers use isolated
worktrees and immutable handoffs. Respect four active agent slots.

| Lane | Owned paths | Contract / handoff |
|---|---|---|
| H — minimal model | tools/sandbox.js; tests/harness.test.js | Explicit opt-in IDB and notification model tied to existing origin partition; no app edits/default capability injection. Synthetic model RED/GREEN first, independent review. |
| T — behavior | tests/app.test.js; tests/e2e.test.js; narrowly necessary fixture additions | Preserve all926 current registrations and original behavior; port actual durable fixture/readback adapters to IDB, then prove intended transaction-protocol RED on old app with real supported model APIs. No app/helper edits. |
| S — persistence | index.html app JS only, exclusive index ownership window | Implement open/read/transaction/init/reconcile/notification adapter. Reuse build/command/publication/UI logic. No engine, DECKS, new user policy or inline i18n changes. |
| M — fault proof | tests/mutants, disposable committed scratch | Preserve old intent via explicit protocol map, add real transaction failure/early-ACK/fresh-read faults; actual clean/fault proof. No editor-tree mutation. |
| Root — contracts/tooling | docs/ENGINE-SPEC.md; schema/support/probe/runbook/README references; tools/probe/saved_variants_storage.js; observed suite floors and ledger | Minimal reviewed internal persistence facts, source/byte measurements and ownership. Case producer unchanged if exact hashes hold. No CLAUDE change. |
| Independent ENG/design | Read/report exact plan and final source/evidence | Not authors; test model is not native proof; record unresolved platform gaps. |

Graph: amended contract + plan ENG/design clearance -> H synthetic model/red/
green/review -> T intended protocol assertions RED -> S adapter -> same assertions
GREEN -> native cross-tab/failure/UI checks -> M proof and final review -> complete
CI -> actual DEV revision/behavior -> owner QA. S may investigate/prepare before
T freezes, but must not bypass the useful RED gate. Root sequences any same-file
H/T or S/UI overlap; do not keep speculative old API tests as a fake compatibility
registry or make the app recognize a test-only backend.

## H model and T validation contracts

Implement only the IDB subset the adapter actually calls: asynchronous open/
upgradeneeded/success/error/blocked, connection close/versionchange, readonly/
readwrite transaction, objectStore get/getKey/put, request result/error and transaction
complete/abort. Add deleteDatabase only if the owned test fixture reset actually
needs it; production must never delete the database. Share committed records and
transaction scheduling across opted-in same-origin realms; independent origins
and default realms remain isolated. A transaction owns a working copy and exposes
changes only on complete; overlapping readwrite transactions get a fresh committed
view when started, not when queued. Request success must precede complete, and
abort after put success rolls back. No fake synchronous durable transaction.

Keep capability controls explicit: missing/throwing IDB, open/version/blocked/
request/put/commit-abort failure and late-success controls. A narrow notification
model supplies actual other-realm dispatch, omitted/delayed notification and
source isolation; it is not shared state authority. Preserve default no-lock/no-
IDB synchronous boot and real Node crypto/AbortController opt-ins. No dependency
installation or full browser emulation. H synthetic tests need independent literal
positive/negative outcomes and generated mutants before acceptance.

T must replace direct localStorage new-envelope reads/writes with real model/native
IDB request/transaction fixtures, not aliases of savedState. Reload uses shared
origin/DB, not a copy of localStorage. Session tests inspect the real session path
and absence of durable writes. Native setup seeds the fixed record through an
actual completed IDB transaction before reloading the app and opening its peer;
cleanup closes owned connections/targets without touching other profiles. Keep
all existing card/English DOM/locale/engine data goldens unchanged.

Freeze exact new titles/counts/selectors/fault intents before implementation.
Required discriminating cases, using public fixtures:

- Both queued distinct Adds survive; identical concurrent imports allocate once;
  same-epoch and different-epoch late ACK never republish an older view.
- A transaction that got/put successfully but aborts before complete returns no
  save ACK, changes no committed collection, retains draft and ordinal history.
- Commit completes but local publication/readback/notification fails: retain ACK,
  do not allocate twice or claim rollback; recover the winner after a fresh read.
- Stale Edit/delete/slot/RESET proofs refuse; unrelated Add remains positive;
  save-as-separate allocates freshly even with an equal sibling; unknown records
  and genuine inventory collisions retain existing protections.
- Present undefined/null/object values are not missing: getKey proves presence;
  model/native no-write controls preserve each malformed value and raw LS source.
- Provenance-field collision preserves the unknown property/raw source in protected
  recovery, and malformed recognized provenance cannot guide arbitrary source reads.
- Initializers race on missing current; one migration wins; all raw sources
  retained; malformed/newer/denied/blocked/closed-version cases never become an
  empty durable store or an unlocked fallback. Existing experimental LS envelope
  migration preserves IDs, revisions, unknown fields and exact backendSource raw.
- Abort before lock, during active transaction, and after complete; late open or
  old callback cannot publish into a newer sheet/epoch. No uncaught rejection or
  abandoned connection after safe refusal.
- Missed/duplicate/out-of-order notification and visibility/focus reads; message
  cannot overwrite authoritative data; dirty view/caret/pick/scroll/focus preserved.

Old-format raw data tests remain unchanged in meaning. The old different-writer
localStorage model cannot serve as the durable IDB authority. Baseline RED must
be a meaningful expected storage/ACK/behavior assertion after normal old-app
readiness, not a missing helper/timeout or a new loader waiting forever for IDB.
Native tests verify the same outcomes with actual transactions and target IDs.

## Probe and performance amendment

Keep the four literal cases and independent producer hashes/UTF8/UTF16 accounting:
2/20/200 valid distinct records plus exactly1MiB serialized envelope. Three-source
legacy fixtures retain the same JSON bytes; experimental-envelope migration gets
a separate preservation/accounting case. Existing120 old-adapter samples remain
historical and cannot be relabeled as new-adapter proof.

Revise the versioned probe to observe the real IDB transaction's complete/abort
and preserve native Web Lock receiver/options/callback result/lifetime. Async
callbacks are now expected: measure callback entry to its returned Promise's
settlement without replacing that Promise, and identify that this excludes final
lock-release scheduling. Report native IDB transaction creation-to-complete,
first-read/put/complete times and waiting/serialization/staging component benches
separately. Do not filter extra unexplained transactions to meet an expected count.
ACK means transaction complete, not physical disk flush. Capture actual source
Document bytes and expected record/source/envelope sizes as before.

Retain30samples per case. Keep the existing50ms p95/100ms max lock-lifetime budget
for2/20/200 as a conservative wall-clock gate while also reporting async wait and
synchronous work; a miss triggers measured optimization/review, not threshold
inflation. Preserve the same-host input-to-paint within one observed-frame budget,
raw sources/stress refusal without loss, real/fallback fonts and locale/device
qualification. This is a reviewed new metric interpretation, not a numerical
comparison of new async transaction span against old synchronous CPU time.

No new installs, shared owner profiles or worker browser jobs. Root uses existing
lease/supervisor/census. Validate portable producer/probe paths, immutable inputs
and no-overwrite output controls independently.

## Minimal normative spec amendment and authority

Root may propose replacing only the concrete commit-facts paragraph at
`docs/ENGINE-SPEC.md:983–990` with the following reviewed wording; keep the former
approval packet as immutable historical evidence and link this successor:

> Saved collections use logical namespace hpfc.saved-scales.v1 and schema1,
> stored as one JSON envelope at database hpfc.saved-scales.v1, version1, object
> store collections, key current. All durable writers retain the same exclusive
> Web Lock and perform current-value read, precondition check and conditional put
> in one readwrite transaction. Transaction complete acknowledges the API commit;
> put-request success or a localStorage write is not that acknowledgment. Abort
> leaves the prior committed envelope unchanged. Publication failure after ACK
> never authorizes duplicate allocation or a rollback claim. Raw legacy sources
> remain unchanged; retained localStorage collections are migration/recovery
> evidence, never a mirrored live authority. This does not claim disk flush.

No CLAUDE edit is proposed: its existing paragraph already delegates these facts
to ENGINE-SPEC12/14. Root owns ENGINE-SPEC and the parent explicitly listed the IDB
alternative; through-DEV/standing AFK authority can cover this necessary unshipped
adapter replacement while all approved observable policies remain. Record that
authority interpretation after independent review. Do not invent another owner
permission gate from generic agent-authored 'review/approval' prose.

If actual review requires a changed CLAUDE diff, new product policy, destructive
retention, new dependency/install, extra permission or main merge, stop that
action and provide the exact reviewable owner decision. No such change is needed
by this proposed minimal adapter. Existing paused/held workstreams remain intact.

## Stages, acceptance, stops and rollback

| Stage | Deliverable / acceptance | Stop / fallback |
|---|---|---|
| A contract | Root reserves exact store names, reviews this plan with independent ENG/design, freezes schema/model/T/probe amendments and authority record. | Material unresolved scope or unsupported API semantics: no code. |
| B model/TDD | H synthetic API RED/GREEN + independent review; T frozen literal fixtures and useful old-app transaction assertions RED; all926 original app registrations retained. | Missing-method/startup/timeouts do not satisfy RED. |
| C implementation | S minimal adapter, unchanged format/UI policy, same controls GREEN, abort/blocked/late-callback tests and source review. | No fake durable fallback or early ACK; retain all failed trees/logs. |
| D native/proof | Actual same-origin targets reproduce original failure on old adapter and pass new transaction path; all UI/error/locale tests, fault proof and measurements satisfy frozen criteria. | Any lost ACKed entry or unexplained transaction blocks delivery. |
| E delivery | Exact-head full CI and independent final review, actual DEV bytes/transactions/journeys, qualified owner QA handoff. | Targeted tests alone are insufficient; no main merge. |

Before delivery, rollback only owned unmerged adapter/support/spec changes while
preserving evidence and other worktrees. Do not run the known-unsafe adapter
against real owner data merely because it was reverted locally. After any future
DEV delivery, rollback requires a reviewed data-preserving plan: old code ignores
IDB-only saves, so a source revert alone is not a safe data migration. Keep IDB
and legacy data intact; no automatic export-back/dual-write/downgrade conversion.

Last: root trace independently audited and this concrete proposal authored. Next:
independent ENG/design review; root resolves material findings and freezes the
amended contract before any implementation lane starts. Runtime fixes, model
changes, probes and migration have NOT been executed by this plan author.

## Independent review revisions

Initial target aa3ca76139c6320828508c277e59e72204a5a15e076c5eef91405dd3c3db3451:
Design/continuity CLEAR with runtime limits. ENG identified four material
refinements, all incorporated for re-review: same-transaction existence proof for
present-undefined IDB values; authoritative readonly session hydration without
committed schema writes; conservative metadata collision/type validation; and
trailing reconciliation reads so in-flight notifications cannot be lost.
Final substantive target `059ea9105dedd6cd20122a5cc9ddf6313446476b5b282be8d9a8591fce1e1f0e`
cleared both independent reviewers. The nonblocking phrase “absent store/no locks”
is corrected to “absent database/no locks”; an existing DB missing its required
store remains protected. Appended status/provenance text changes the document
hash after the substantive review; it does not claim a fresh runtime result.

Root authority decision: owner approved saved variants through DEV, the parent
plan already listed the atomic-store alternative, and owner explicitly reaffirmed
AFK authorization. Execute this necessary internal adapter amendment after these
reviews, preserving all approved observable policies. No CLAUDE edit, install,
extra permission or main release is included. Any actual new boundary still
requires the concrete owner decision described above. Current ledger remains
authoritative; Linear investigation stays queued/unrun.
