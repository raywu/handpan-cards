# SAVED-SCALE-VARIANTS source/schema research

Planning only, 2026-10-25. Source HEAD
`89ababec40a33ba103f42f6c91fc8bd7a27a8d7e`; frozen planning prompt SHA256
`cd9dbb774a9ceb507bb0ec1a51e9440ada029bc1993167ed172749a3220fb9a7`.
This lane owns this note only. No app/test/CLAUDE/global edit, migration, script,
test, browser, installation or remote write occurred. Read-only source commands
and primary-specification browsing informed the note. No private owner URLs,
names, screenshots or storage were used in external research. Baseline findings
are retained in the [investigation checkpoint](2026-10-25-saved-scale-variants-investigation.md)
and [sharing source receipt](2026-10-25-share-customization-source-research.md);
this note concentrates on remaining architecture/compatibility decisions.

## Requirements, evidence and decision status

**Verified source:** same-inventory replacement is deliberate current behavior;
it is not a random hash collision. core.identitySeed/deckId, CUSTOM registration,
record matching and boot dedup all use inventory identity. Distinct local saved
instances require coordinated app changes, not a modified name/checksum alone.

**Owner need:** retain two differently named/laid-out instruments together.
**Pending owner decision:** the initial coexistence/Edit/repeat-import behavior
question remains unanswered in the supplied prompt. Recommendations below are
proposals, not approved requirements or implementation permission.

**Verified source:** current source includes SHC UI ownership functions
retireLinkUI/observeLinkRoute and announcementRevision. That narrow repair is
independent of variants and must survive integration. The original omitted-angle
report remains distinct and unresolved; variants are not its demonstrated fix.

## Minimum architecture comparison

| Candidate | Advantages | Material cost/risk | Recommendation |
| --- | --- | --- | --- |
| Change core.deckId to hash options/wire | Superficially fits existing registry indexing | Violates ENGINE-SPEC section 12, changes IDs on rename/nudge, couples identity to codec/label versions, still needs migration/conflict/selection handling | Reject |
| Normalized content key as registry identity | Exact imports can converge deterministically | Every Edit rekeys; converging edits collide; physical saved-instance continuity disappears; content equality must still be specified | Use only as dedup lookup, not edit identity |
| Stable local saved-instance wrapper around unchanged generated deck | Separates persistence/edit identity from musical inventory; keeps engine/share untouched | Requires app selection/chip/storage adapters and real commit acknowledgment | Smallest coherent app candidate |

Proposed responsibilities:

- `deck.id`: unchanged canonical engine inventory ID. Never assign a UUID into it.
- `entry.instanceId`: durable local saved handle; opaque, collision-checked on
  creation within the commit boundary. Never shared or sent in analytics.
- `entry.revision`: optimistic concurrency version of this saved instance.
- `entry.record`: existing capability-tagged `{v,s,o}` seed; v describes reader
  capability, not the saved-instance envelope format.
- `entry.deck`: generated runtime object, not persisted. Registry indexes entries
  by instanceId; render/print/share explicitly unwrap the deck.
- `variantMeaning`: canonical semantic content used only to find repeat imports.
  Compare full meaning after any hash lookup; neither the current 32-bit hash nor
  six-character share check is a unique saved-instance/content guarantee.
- `selection`: tagged built-in ID or saved-instance ID, separate from inventory.
- `slots`: explicit built-in-slot to instance mapping, updated in the same saved
  collection commit as affected entries; replacement provenance remains distinct.
- `#s=`: portable seed snapshot without local handles; `#deck=`: built-in slot;
  `#edit-`: transient local modal context, discarded at reload as currently.

Avoid a pervasive Proxy pretending wrappers are decks. Explicit `selectedDeck()`
and `selectedEntry()` helpers make field/render versus instance operations
reviewable. `allDecks()` can become view models `{selection,deck}`; chip action
compares tagged selections and opens the selected instance. This is a larger
textual change than reassigning d.id but a smaller semantic change to the engine.

## Concrete API decomposition and affected call sites

Proposed names/contracts below are planning candidates, not new implemented APIs.

| Existing source | Proposed separation and invariant |
| --- | --- |
| generateDeck, registerDeck, CUSTOM (`index.html:9839`, `:9869`) | Extract buildGenerated(text,options) returning a deck without registry mutation. Preserve exactly-one parse/build behavior and correction solve. build must not inherit replaces from an inventory sibling. registerSaved(entry) publishes only a committed result. |
| scaleRecord, recordDeckId, sameDeck (`:10024–10053`) | Keep capability-aware record reading separate from instance lookup and semantic comparison. Never match an opaque/newer record by parsing its s under an older reader or by raw-string fallback. |
| rememberScale, replaceScale, forgetScale (`:10055–10092`) | Replace inventory-based commands with importVariant, saveInstance(id,expectedRevision,record), deleteInstance(id,expectedRevision). Read latest committed collection inside serialization boundary. Edit keeps the instance and order even when inventory changes. |
| restoreScales (`:10117`) | Load entries by instance handle, preserve opaque entries, rebuild readable decks without registration collisions. Never dedup by inventory; repeated instance IDs are corruption/conflict, not permission to overwrite. |
| deck/selectDeck/storedDeck/save (`:9789`, `:9794`, `:10145`) | Resolve tagged selection; persist saved selection coherently with collection commit. Preserve legacy hpfc siblings. Rehome selected chip focus after rebuilding; retain retireLinkUI even for same-instance SAVE. |
| editedDeck/resetSheetState/runGenerate (`:11737`, `:12676`, `:12853`) | Capture instance ID/revision at open. Pure build first, commit second, publish selection/close/success last. Refusal keeps draft, focus and retry capability. Do not serialize drafts into LINK. |
| openShare/hashchange/boot | Decode/build without side effects, then semantic reuse-or-create command. Exact repeats do not allocate on every boot. Receiving a portable link has no replaces authority. |
| replacements/allDecks/deleteDeck/reset | Resolve one slot owner explicitly; update slot, hidden flags and entries together. Instance deletion cannot delete all siblings with the same fields. Preserve/reset historical replacement groups according to an approved contract. |
| seedOf/shareCode/routeInfo/copyLink | Take unwrapped committed deck; leave codec, location.href query capture and SHC operation ownership intact. Local handles stay out of URL/analytics. |

Remove the current inventory-based Edit veto only after the replacement command
exists. Different instances may share inventories, but same-instance revision
conflicts and genuine distinct-inventory hash collisions must not be silently
ignored. Compare core.identitySeed strings when a common inventory hash appears;
the wrapper can retain both, but any engine consumer assuming hash uniqueness
needs an explicit check. Tests for replaceRegistered's single caller/guard must
be intentionally replaced by instance-commit invariants, not weakened to green.

No engine/data/geometry/codec source change is inherently needed. Application
adapters stay in index.html outside generated regions; tests and sandbox support
will need corresponding future work. Single-file functionality rules out solving
this by an unembedded external storage script. Do not edit generated engine
copies to introduce app-local identity.

## Content equality, Add/Edit and built-in slots

Propose comparison of canonical inventory spelling plus name intent, palette,
mirror pair, anchor, normalized seats/angles and parent intent. Explicit parent
versus inferred remains distinct even when labels currently coincide. Explicit
name versus auto remains distinct even when text coincides. Do not compare MIDI
pitch classes alone: spelling/zones/octaves matter under engine identity.
Normalize missing/default/all-null corrections through existing validators;
do not erase explicit absolute angles merely because they equal today's solved
position. Wire text/version/auto-label output is not a durable fingerprint.

Proposal: import finds selected exact match first, otherwise earliest committed
matching instance in stable order, otherwise creates one; no silent merge of
existing duplicates. Editing changes only its instance; convergence retains both.
Exact Add reuse versus deliberately creating another identical instrument is an
owner gate. No mandatory confirmation for ordinary imports is proposed.

Current replacements() chooses the newest record carrying replaces; allDecks
displays older replacement records as custom; RESET removes all such records,
and deleting the newest can expose an older replacement despite hidden=true.
Minimal compatibility proposal: migrate the existing newest owner explicitly,
retain replacement provenance on older entries, preserve RESET's historical
group behavior, and deliberately choose the newest surviving replacement on
owner deletion inside the same commit. Ordinary imports neither inherit nor
steal that provenance. If owner prefers no promotion or retention of historical
replacements after RESET, that is a separate visible policy/spec change.

## Namespace, staged migration and held DUP capability

Use a new app-owned collection namespace, candidate `hpfc.saved-scales.v1`, with
an independent envelope `schema:1`. Do not reuse hpfc.scales.v3 with an added
instance field: old restoreScales/rememberScale would still collapse variants.
Do not increment HPE.share.VERSION or RECORD_VERSION for local instance metadata.
The held DUPLICATE-NOTES plan proposes capability-specific wire7/record5 only
for newly admitted notes; it explicitly leaves final numbers/schema undecided.
Reserve capability ownership there. Here preserve `{v,s,o}` intact and dispatch
reader capability through a single adapter that can later accept the held plan.
No duplicate-note parsing/occurrence behavior is implemented or enabled here.

Candidate single-envelope shape: schema, collectionRevision, ordered entry
wrappers, selected tagged reference, slots/hidden state, migration metadata and
the exact raw legacy snapshot. This avoids a separate commit marker becoming
the sole evidence of an incomplete multi-key migration. Do not retain generated
decks or duplicate a second large canonical fingerprint string unnecessarily.

Proposed migration protocol under the chosen exclusive commit boundary:

1. If a valid supported new envelope exists, use it. Never replay old-key changes
   automatically; an old app may legitimately keep writing its old namespace.
2. If absent, read raw hpfc.scales.v3 and legacy selection/order/hidden values.
   Missing versus invalid versus denied reads are different results. Invalid or
   denied reads do not mean an empty collection ready to overwrite.
3. Stage complete wrappers in memory, assign handles, preserve every surviving
   legacy record/index, and retain exact raw source text for recovery. Unknown,
   malformed or newer entries remain opaque; no dedup/rewrite/reset of them.
   Map old inventory selection deterministically to the surviving migrated entry.
4. Commit one complete self-contained envelope; read/validate committed identity
   before publishing migration success. If writing/readback fails, retain legacy
   source, draft and previous registry; report unacknowledged persistence.
5. Only then publish wrappers/selection. A crash after commit but before display
   resumes from that envelope; a crash before commit retries without duplicate
   entries. IDs assigned only in an uncommitted stage have not escaped into links.

The original key is not an immutable backup: old tabs can still alter it. Keeping
raw source in the new envelope provides a stable recovery snapshot while retaining
the live old key for downgrade. This duplicates source plus transformed entries
in addition to the old key and can exceed quota. Quota refusal must stop migration
without deletion/compaction of the only recovery source. Alternative snapshot
export requires an explicit usable UX and acknowledgment contract, not a claim
that a download API call guarantees recovery. A schema-only commit marker and
data in another key would need a more complicated recoverable protocol.

Downgrade displays only the old namespace and cannot display later variants.
It must not be advertised as restoring new data. Re-upgrade uses the new envelope,
not automatic reconciliation of two divergent stores. A future explicit old-store
import/recovery action can preview changed entries and append without overwriting;
it is additional scope. Do not blindly restore the snapshot over newer old-key
writes. Previously overwritten variants cannot be reconstructed by migration.

## Atomicity, failure and maintenance choice

**Verified platform specification:** localStorage provides shared state but no
cross-agent locking guarantee; its specification warns about concurrent
read/modify/write. Unique IDs, storage events, re-reading immediately before
setItem, revision fields or post-write readback alone do not serialize two writers.
[WHATWG Web storage](https://html.spec.whatwg.org/multipage/webstorage.html#introduction).

Provisional smallest backend: one new localStorage envelope plus an exclusive
Web Lock for every new-format migration/Add/import/Edit/delete/reset operation.
Within the lock re-read latest envelope, check expected instance revision/slot
ownership, apply a bounded command, then write once. All cooperating new tabs
must use the same lock. Web Locks provides origin-coordinated asynchronous locks
and is exposed in secure contexts; unsupported/denied acquisition needs an
explicit fail-closed persistent-write path, not an unlocked fallback.
[Web Locks API](https://w3c.github.io/web-locks/#api-lock-manager).
Runtime availability, file-open behavior and supported browser coverage remain
unverified in this lane and are dependencies on the primary-documentation lane.

Alternative: IndexedDB transaction for collection/instance/revision/slot updates.
Its transaction model supports conditional atomic operations, but introduces
asynchronous opening/upgrades/abort handling and a larger backend migration.
Do not adopt it just to allocate UUIDs; use it if the required browser/file/failure
contract makes lock-protected localStorage unsuitable.
[IndexedDB transactions](https://w3c.github.io/IndexedDB/#transaction-concept).
Neither API grants permission to delete recovery data or promises survival of
every storage-clearing/physical-disk failure.

| Failure/interleaving | Proposed observable outcome; acceptance still required |
| --- | --- |
| Two different Adds/imports | Serialize commands against latest envelope; retain both. Exact imports can reuse one entry by approved equality. |
| Two edits of same instance | Expected revision mismatch keeps second draft/focus; no last-writer silent overwrite. Explicit retry/save-as-new policy belongs to UX decision. |
| Delete versus pending Edit | Missing/tombstoned instance conflicts; SAVE cannot resurrect it silently. Distinguish explicit later portable-link import. |
| Old/new clients | Separate namespaces; old writer cannot collapse new instances. No promise of automatic new-to-old synchronization. |
| Stale clean tab | Consume committed changes without reimporting its old route as a write; synchronize selected display/route together. If selected instance disappeared, deterministic visible fallback. |
| Dirty tab | Preserve draft/base revision and active focus; defer remote selected-entry replacement. Commit detects conflict even if notification was missed. |
| Reload/stale shared URL | Apply explicit import/reuse policy. Old snapshot may create an additional variant; it must not edit an existing instance by inventory. Tombstone versus intentional reimport policy remains a gate. |
| Storage denied/quota/lock failure | No durable-success notice, selection publish or sheet close; keep recoverable draft. Session-only creation is optional separately approved behavior, not silent fallback. |
| Newer/corrupt envelope | Preserve bytes; no automatic empty initialization/migration overwrite. Offer bounded recovery/legacy read mode. |
| Opaque entries/reset | Do not mutate/delete opaque records because their raw o.replaces happens to name a built-in; include an explicit future-data policy. |

Selection and slots must not be committed in hpfc independently of collection
updates while claiming a transaction. Keep authoritative variant selection and
slots in the envelope; hpfc remains a backward compatibility projection for
built-in/legacy settings, never the rollback switch that makes new entries vanish.
Shared selected preference is distinct from each live tab's current selection;
remote changes must not hijack its practice view or dirty editor.

## Exact instruction/spec conflicts for root's approval packet

No CLAUDE.md change is made here. Initial owner choice and ANY exact CLAUDE edit
need separate explicit consent. Candidate wording below is NOT an approved diff.

1. ENGINE-SPEC section 12 currently says records hold one record per id, later
   saves overwrite and boot dedup keeps first (`:859–861`). Proposed replacement:
   “core.deckId identifies canonical musical inventory. Saved instruments use
   separate stable local instance handles; several instances may share an
   inventory ID. Edit and deletion target one instance; repeated imports reuse
   an approved semantic match. Inventory hash equality alone never discards a
   saved instance.” Keep the remaining D14 inventory/options/per-card statements;
   specify separately whether future per-card progress is instance-scoped.
2. ENGINE-SPEC sharing/storage section (`:978` onward) names hpfc.scales.v3 and
   its copy migration. Append the approved new namespace/protocol and old-writer
   limitation; do not rewrite historical version readers or claim record4 moved.
3. CLAUDE “Default deck”/“Chip order” (`:469–491`) currently derive replacement
   ownership/newest ordering from records. Proposed clarification: “Saved custom
   instruments are selected/edited/deleted by stable local instance handle;
   engine IDs continue to identify note inventory. Instances keep chip order
   during Edit. The saved collection records one built-in slot owner and retains
   replacement provenance. Imports carry no replacement authority.” Add the
   explicitly approved reset/delete-promotion policy rather than hiding it in an
   adapter. Keep cold-start deck, built-in picker order and physical geometry.
4. CLAUDE route rules (`:513` onward) and tests name SAVE identity in inventory
   terms. Add: “A custom #s= route serializes the selected instance's committed
   seed, without its local handle. Equal routes do not identify a unique local
   instance. Edits preserve local instance identity even when notes change.”
   Preserve location.href/query and SHC ownership language/behavior.
5. Parent-null-on-Edit, bottom-count angle resets, wire/record versions and
   single-file/generated-source constraints are not variant bugs and stay as-is.
   Any desire to change them is a separate policy request.

Existing assertions “same-id generate replaces,” Add dedupe-by-id, Edit collision
veto, replaceRegistered caller scan, record inventory dedup/delete and legacy
boot rewrites encode the old contract. Root must enumerate replacements and
generated killing mutants under the approved new observable spec, preserving
unrelated grammar/geometry/share/SHC assertions and raising floors. No tests ran
or were edited here. Exact wording above needs reconciliation with the final
backend/equality/slot decisions before asking for approval.

## Remaining gates handed to root

Owner: initial coexistence/default Add/Edit-convergence/import and conflict policy.
Primary-documentation lane: availability/security/file-open/failure requirements
for lock-protected storage versus IndexedDB, ID allocation and durability wording.
UX lane: recovery/session-only/conflict copy and focus; identical chip names.
Integrator: current actual accepted DEV/async head and held DUP version ownership.
Independent reviewers: chosen namespace/transaction/recovery protocol and exact
instruction wording. Implementation remains held; this note is not a full plan,
test pass, browser receipt, migration rehearsal or authorization to change storage.
