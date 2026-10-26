# Saved variants — concrete schema and integration contract

2026-10-25. Root-selected implementation details within owner-approved plan9a96ed6d
and exact packet5d0700f7; no new product policy or successful migration claim.
Source proposal came from independent read-only S audit at1454b181. Independent
engineering review is required before contract freeze/T assertions/S app code.
Parent plan/approved packet remain authoritative. No additional CLAUDE change.

## Exact minimal schema1 contract

```json
{
  "schema": 1,
  "collectionId": "00000000-0000-4000-8000-000000000001",
  "revision": 1,
  "slotStateRevision": 0,
  "entries": [],
  "usedInstanceIds": [],
  "nextDisplayOrdinal": 1,
  "preferredSelection": {"kind": "builtin", "id": "kurd"},
  "slots": {},
  "hidden": [],
  "migration": {
    "sourceKey": null,
    "raw": {"hpfc": null, "hpfc.scales": null, "hpfc.scales.v3": null},
    "instanceIds": []
  }
}
```

- Namespace hpfc.saved-scales.v1; exclusive lock handpan-cards:saved-scales:v1.
- Ordered entries are oldest first. Required wrapper fields around each record:
  `{instanceId,revision:1,displayOrdinal:1,record:<any preserved JSON value>}`.
  A readable new record is existing `{v:4,s:<canonical>,o:<seed options>}`. Opaque
  future/malformed JSON values may remain in record, but have no generated view,
  equality match, mutation target, slot authority or RESET membership.
- Tagged selection uses the SAME id key for both kinds: `{kind:'builtin',id:seedId}`
  versus `{kind:'saved',id:instanceId}`. No inventory identity inferred from it.
  `null` is allowed only as an unselected command/result, not committed preference.
- Slots is a partial map from known built-in ID to one readable instanceId whose
  validated record has the same recognized replaces provenance. Hidden is an
  ordered unique list of known seed IDs; an explicit valid slot outranks hidden.
- Initial collection revision1 includes initial migration/metadata. Increment it
  ONCE for each actual acknowledged changed envelope; exact no-op reuse without
  selection change need not write. Entry revision increments only when its record
  changes. Preference-only writes never increment entry/slot revisions. Slot-state
  revision increments on any slots/hidden change, not ordinary unrelated Add/Edit.
- Initial entry revisions1, displayOrdinal1..N in preserved source order, and
  nextDisplayOrdinal=N+1. usedInstanceIds is the immutable-order lifetime allocation
  history, including deleted/RESET handles: usedInstanceIds[displayOrdinal-1] must
  equal each current entry.instanceId, and nextDisplayOrdinal equals history length
  plus1. Append a handle only in its successful atomic allocation commit. Never
  prune/reuse a handle or ordinal, including after reload; this prevents a stale
  revision1 command from hitting a newly allocated instance (ABA). Preserve entry
  array order and ordinal during Edit, including changed engine inventory.
- UUIDs are lower-case UUIDv4 from real guarded crypto; eight attempts per allocated
  handle, checking collectionId/ALL usedInstanceIds (including deleted handles)
  and any known previous collection identity in this tab. No Math.random, timestamp IDs, counters as durable handles
  or silent collision overwrite. Empty collection still needs an epoch UUID.
- migration.raw contains EXACT getItem strings or null for absent keys; never
  mutate these strings after first commit. sourceKey is scales.v3 when present and
  usable, otherwise legacy scales when v3 absent, otherwise null. instanceIds maps
  source row index to initially assigned handle, including opaque rows, and remains
  immutable even after entry deletion; these historic mapped IDs need not remain
  in current entries and cannot invalidate an otherwise valid post-delete store.
  No second backup key or commit marker.
- Preserve unknown schema1 envelope/wrapper fields by copy-on-command rather than
  reconstructing the whole object. Strictly reject unsupported schema, invalid
  structural types/duplicate handles/revisions/ordinal reuse/dangling slot claims
  as a protected collection; never normalize it to empty. Readable-record failure
  alone makes that row opaque; it does not make the envelope disposable.
- Validate positive safe integers (revision/entry revisions/ordinals/nextOrdinal),
  nonnegative safe slotStateRevision, unique handles/ordinals and nextOrdinal greater
  than every entry ordinal. Overflow fails preserving prior data. No product cap.

This deliberately freezes field spelling now so T can own independent envelope
oracles/measurement byte recipes. It is not a new wire6/record4 encoding. Production
validation must still be independently reviewed against these literals.

## Minimal S/U runtime handoff, no Proxy

Suggested lexical app-level functions, visible to VM tests through existing run():

- `buildGenerated(text,options,guard)` -> existing engine result shape synchronously.
  Extract the current generateDeck construction exactly: one parse/build, existing
  zero-chord refusal, name/parent/layout corrections and warning semantics. It has
  NO registry/persistence mutation and NEVER inherits replaces from inventory.
  An explicitly supplied recognized replaces provenance may be retained only for
  trusted local Edit/migration; ordinary decoded imports remove it.
- `readSavedRecord(record)` -> readable build/result or opaque reason, dispatching
  existing checkShareVersion/scaleReader/recordOptions. Valid current-v4 rows retain
  complete JSON values. Normalize known older rows only in the new envelope.
- `savedState`: latest acknowledged/accepted envelope in this tab. S retains it;
  U must not mutate it directly. `savedMode`: 'starting'|'durable'|'session'|'protected'.
- `savedEntries`: Map instanceId -> `{instanceId,revision,displayOrdinal,record,deck}`
  readable runtime wrapper. Generated deck.id remains the canonical engine ID.
  Reuse unchanged wrapper/deck objects on reconcile where possible, never rebuild
  chords during render, selection, prefer or LINK. Opaque rows remain in savedState.
- `selection`: this tab's tagged view; `selectedEntry()` returns its readable saved
  wrapper or null; `selectedDeck()` returns unwrapped deck (with fallback).
  Existing `deck()` may be a simple alias for selectedDeck, not an overloaded Proxy.
- `allDeckViews()` -> ordered `{selection,deck,displayOrdinal?,slotId?}`. Custom
  tier newest first excluding explicit slot owners; then built-in slots in DECKS
  order, owned readable instance else visible built-in. Older recognized replacement
  entries remain in custom tier. `fallbackSelection()` uses visible Kurd or its
  owner, then first visible; all-hidden/corrupt protection restores default view.
- `applySavedSnapshot(envelope)` updates runtime wrappers/chips/content candidates;
  U controls focus/draft/view and route. It must not trigger import of the old URL.
  Publish a successful mutation only after API acknowledgment, never before.

Avoid keeping a second inventory-keyed CUSTOM registry as authority or assigning
UUIDs into deck.id. Retire obsolete primitives once U callsites move; no identity
veto removal before the instance-targeted command replaces it.

## Command boundary for T and U

One `commitSaved(command,{signal}={})` returns a Promise of a plain app result.
No engine enum extension: failures use an app `kind`, not forged engine `code`.

Success: `{ok:true, changed:boolean, created:boolean, instanceId?:string,
selection?:tagged, envelope:<acknowledged snapshot>, persistence:'durable'|'session'}`.
Failure: `{ok:false,kind:'conflict'|'storage'|'lock'|'protected'|'allocation'|
'inventory-collision'|'cancelled'|'invalid', detail?:nonsecret diagnostic}`.
UI localizes the reason; failure never closes draft or announces saved success.
No raw owner record/source/UUID diagnostic is emitted to analytics.

All commands carry `collectionId` from the caller's accepted epoch. The exact
staged candidate shape is `{record:<current-v4 JSON>,deck:<buildGenerated.value>}`.
For new UI/import content, record is scaleRecord(seedOf(deck)); the payload comes
from successful validated app-owned staging, never directly from untrusted wire
metadata. Do not persist the generated deck. Edit merges unknown target metadata
inside its command as specified below. Build once outside the lock; do not rebuild
in commit merely to validate the internal staging interface. Imports strip replaces
regardless of candidate metadata. Full portable meaning derives from validated
record/deck, never a supplied hash/fingerprint or encoded URL. Current-row staging
must still satisfy the exact-raw recheck below. Command discriminators:

| type | Fields / precondition | Result |
|---|---|---|
| import | staged candidate; selectedInstanceId or null | Full portable meaning match in latest readable rows, selected exact match first then first committed match; else allocate append. No replaces authority. Set returned tagged selection/preference in same changed commit. |
| edit | instanceId, expectedRevision, staged candidate; expected slot proof when slot authority changes | Replace only that existing readable record; retain handle/order/ordinal/provenance and sibling bytes. Missing/revision-changed target conflicts. Edit convergence does not dedup. |
| replace-builtin | seedId, expectedSlotStateRevision, expectedOwnerId/null, staged candidate | New explicit recognized replacement gets the slot. Plain existing same-inventory custom is untouched. UI catches unchanged seeded SAVE before this command, preserving historical no-op. |
| delete | instanceId, expectedRevision; captured slot proof REQUIRED whenever the latest target owns a slot | Delete only target; held slot deletion promotes newest surviving recognized readable replacement, with seed hidden as existing policy. Missing/stale proof conflicts, including a target promoted since the caller's snapshot; never recapture proof in commit. Reject last-visible removal. |
| hide-builtin | seedId, expectedSlotStateRevision, expectedOwnerId/null | Hide only the explicitly visible unowned built-in; do not hide a newer replacement by stale seed selection. Reject last-visible removal. |
| reset | captured affectedScope | Inside lock compare recognized replacement IDs/revisions + slots/hidden/slotStateRevision; remove recognized groups, clear hidden, preserve plain/opaque. Unrelated plain Add need not conflict. |
| prefer | tagged selection | Persist only a currently resolvable preference; never write a local handle to hpfc.deck or force another live tab's view. |

Scope proof can be literal `{slotStateRevision,slots,hidden,replacements:[{id,revision}]}`
with deterministic ordering. Delete/replace-builtin may use the relevant slot proof,
not a global collection revision that spuriously rejects unrelated plain Adds.
RESET's UI arm captures proof; confirming tap must not recapture a newer scope.

Durable flow: lock exclusively -> reread raw envelope -> validate epoch/command
preconditions/current meaning -> apply copied command -> serialize -> ONE setItem
-> acknowledged result. Successful return from setItem is the boundary. Optional
readback failure afterward is diagnostic only, no rollback/retry allocation.

Pure expensive record builds must happen outside the lock. If equality/recognized
metadata is staged against a raw envelope before acquisition, compare that exact
raw envelope inside lock; a mismatch releases and restages against current data,
then re-acquires. Do not decide dedup against a stale cache or await engine/network/
UI inside lock. Actual measurement gate decides whether even validation/serialization
cost requires reviewed optimization; no threshold increase or backup removal.

Session commits use a cloned document-local snapshot and SAME validation/preconditions,
never localStorage writes or later auto-promotion. Protected mode never writes the
corrupt/newer envelope; explicitly chosen temporary-use state is separately session
scoped. Do not silently call a mid-session durable failure 'session success'.

## Readiness and input lifecycle

Keep synchronous boot() return for default no-lock session consumers. S can expose
initializeSavedCollection() as immediate accepted session state when synchronously
known unsupported, otherwise a Promise for durable lock/migration initialization.
The UI completeBoot step is called only once after that result; a `savedReady`
Promise may exist in both cases, but no fake synchronous Web Lock implementation.

`booted` stays false and #count remains empty until init + routed share import are
settled/acknowledged or explicitly refused/fallback-resolved. Only then setOrder,
buildChips/applyLang/render/syncRoute and booted=true. An intermediate built-in render
with nonempty #count would fool current CDP APP_READY_EXPR; do not introduce it.
An error still ends in explicit usable session/protected view, not an eternal spinner.

`openShare(code)` and runGenerate() become Promise-returning entrypoints for durable
work. Decode/build before commit; wait acknowledgment; then if invocation/sheet
context still owns UI, publish selection/close/success. Back aborts a queued lock
request via AbortSignal; if a granted synchronous write already succeeded, retain
that commit but suppress obsolete UI completion. DOM listener dispatch itself stays
synchronous; test helpers observe actual returned completion separately.

Ordinary selection renders immediately and ALWAYS retireLinkUI(), including equal
URLs. Its prefer command is async metadata work, failure doesn't invent a saved
mutation. Remote prefer never hijacks local practice selection. Remote target edit
refreshes clean displayed content and route together; dirty sheet retains base
revision/draft/caret/pick/scroll and exposes conflict on Save. Target deletion only
re-homes focus if the focused chip itself vanished.

## Migration and equality decisions

1. Preserve ALL source rows, including same-inventory duplicates. Map initial old
   visible selection/slot owners by simulating old restore first-readable-per-
   inventory behavior, not arbitrarily newest duplicate. Store explicit chosen
   owner; non-owner recognized rows survive as custom and remain promotion eligible.
   For a custom legacy selected inventory choose the first readable old-visible
   occurrence; a selected built-in resolves its chosen slot owner. Snapshot mapping
   is immutable. Pre-existing overwritten variants cannot be reconstructed.
2. hpfc.scales.v3 present is authoritative even empty; only absence permits old
   hpfc.scales fallback. A malformed/denied active source is not empty. Capture
   unused old-source raw text without treating malformed unused content as active
   data. A present malformed/non-object hpfc preference blob or malformed relevant
   hidden metadata protects migration: preserve raw input, no automatic durable
   write/invented selection. Unknown/stale valid selection IDs retain existing
   fallback/gone behavior. Unrelated unknown preference properties are preserved.
3. Portable equality compares full validated canonical inventory spelling + explicit
   name intent + inferred/explicit parent intent + palette/mirror pair/anchor +
   normalized seats/angles. Absent/all-null angles equivalent; explicit absolute
   angles retained even equal solved defaults. Ignores local replaces authority,
   wrapper metadata, codec version/text/checksum and generated labels.
4. Distinct identitySeed strings with same 32-bit inventory hash are genuine hash
   collisions: preserve migration rows/recovery bytes; do not treat as duplicates.
   Keep the first compatible generated view while refusing a new conflicting
   import/Edit with kind inventory-collision. Preserve all affected migrated rows
   and raw source; never collapse/drop them. Ordinary same-inventory variants must
   never take this branch. No engine identity redesign is authorized.
5. Valid v4 unknown fields must survive migration byte-for-value; raw source handles
   lexical preservation. Edit of a readable target retains unknown record/option
   properties; replace supported portable properties only, preserving recognized
   local replaces provenance. Supported properties are name,palette,parent,mirror,
   mirrorBottom,anchor,seats,angles (plus record v/s/o). Clear old supported fields
   before applying staged normalized values, so removed angles/parent/name cannot
   survive accidentally. Unknown fields never acquire slot authority. Sibling/
   opaque/raw preservation is unconditional; unrelated commands never reserialize
   records. JSON values are data, never executable getters/prototype authority.

## Immediate gates and rollback

Before S/U production edits, root must capture same-host PRE-CHANGE public built-in
selection input->paint baseline plus measured display frame. Old app cannot retain
2/20/200 same-inventory variants; disclose that fixture asymmetry. S later owns
backend parse/normalize/serialize/exclusive-lock30samples for T frozen2/20/200 +
1MiB serialized-envelope stress and independent byte accounting; do not substitute
1MiB legacy input for required final-envelope stress.

Next root freeze/review JSON/interface details above, T independent fixture/oracle
registration, H faithful helper handoff, meaningful baseline assertion RED. Only
then S builds store/extraction; U follows committed S handoff in exclusive index
window. No parallel S/U index edits. Full final-source/CI/actualDEV gates remain.
Unmerged owned code may be reverted by integrator; preserve both namespaces/raw
recovery forever absent separate retention approval. No main/global/install change.

## Root execution clarifications

- Confirmed HTTPS API evidence:12 required checks passed in two actual targets;
  optional file observation failed afterward, so the overall diagnostic is FAILED.
  File/Safari/app interleaving and migration/performance remain unvalidated.
- H opt-in model is supplementary. Cooperative readiness promises plus synchronous
  VM evaluation can be timed; arbitrary runaway asynchronous CPU continuations
  cannot be isolated in-process. All helper/test execution requires an outer
  bounded process supervisor (CI suite-health already supplies one). Do not widen
  H into a worker framework or claim arbitrary async execution is safely bounded.
- First ready publication remains after initialization/import; no CDP readiness
  weakening. UI changes/conflict copy receive independent design review at final
  exact source; parent plan's independent design review already passed.

## Adversarial refinement before freeze

Independent schema ENG review found two P1 gaps in the initial concrete contract:
deleted UUID reuse could make stale revision1 commands target another instance;
and optional delete slot proof could miss intervening promotion. Root added the
lifetime usedInstanceIds ordinal mapping and mandatory latest-owner proof above.
T must cover delete→forced UUID reuse→stale Edit/delete across reload, plus two-tab
promotion→stale proofless delete refusal and unrelated plain-Add positive control.
These refine the approved identity/concurrency guarantees, not new product policy.
Independent recheck is required before T/S implementation.
