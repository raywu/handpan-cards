# SAVED-SCALE-VARIANTS — investigation checkpoint, not an execution plan

2026-10-25. Owner reports two same-inventory instruments with different names and
bottom layouts cannot appear together, even after Add/new LINK. Owner confirms
separate tabs. This is an independently explained saved-identity limitation,
distinct from SHARE-CUSTOMIZATION-HOTFIX's confirmed stale async fallback and the
still-unresolved earlier omitted-angle report. No variants code or migration has
been implemented. The narrow async plan explicitly excludes this scope.

## Evidence and desired behavior under interview

**Verified:** both prior payloads and a newly supplied valid custom-angle payload
decode to18 fields and canonical inventory id custom:e6bd34c7. Names, geometry and
other options do not participate in core identity. The new payload carries its
changed positions correctly. Raw owner URLs/names/screenshots remain private.
Source: core.identitySeed/deckId, share.decode, root read-only decode diagnostic.
Native same-profile/two-target investigation also observed separate tab registries
but one replaced shared saved record. See hotfix source/UX research and evidence.

**Verified source:** registerDeck replaces CUSTOM[id]; sameDeck/recordDeckId and
rememberScale collapse matching inventories. Repeated Add/import therefore cannot
retain a sibling merely by changing its name or generating a different checksum.
ENGINE-SPEC §12 deliberately defines inventory identity independently of options.
This is not a random hash collision and should not be repaired by weakening the
collision guard or adding random bytes to a portable link.

Owner interview pending: preserve distinct named/layout variants, SAVE CHANGES
updates only its selected variant, and an unchanged repeat link reuses the existing
entry. Recommendation is yes. This records a proposed design, not an answer or
implementation grant. Investigation/planning can continue while awaiting inputs.

## Independent source and UX recommendations — proposals

Prefer a durable local saved-instance identity distinct from core inventory ID.
Keep #s= a portable content snapshot; local instance handles must not leak into
analytics or become necessary to open a shared link on a fresh device. Preserve
core deckId semantics, wire compatibility and seeded #deck= routes.

A normalized semantic fingerprint can match an already-imported variant, but is
not the durable edit identity. Hashing full wire text into d.id would churn on
every rename/nudge/palette change, depend on codec versions/auto labels and omit
local replacement provenance. It does not by itself define edit, import, delete,
ordering, rollback or concurrent-write behavior.

Suggested variant comparison considers name intent (explicit versus automatic),
angles/seats, palette, parent intent, mirrors and anchor. Normalize equivalent
absent/default/all-null representations; preserve genuinely different semantics.
Whether a palette-only or explicit-parent-only difference warrants another saved
instrument needs an explicit contract, not an accidental hash consequence.

## Coupled code and compatibility surface

| Area | Source symbols / required investigation |
|---|---|
| Allocation/import | registerDeck, generateDeck, openShare: choose/reuse instance before overwriting a same-inventory registry object. |
| Stored list | scaleRecord, recordDeckId, sameDeck, rememberScale, replaceScale, forgetScale, restoreScales: all currently use inventory identity; adding one field alone leaves sibling collapse/deletion bugs. |
| Selection/edit | deck, selectDeck, buildChips, editedDeck, editingId, sheetRoute, runGenerate, deleteDeck and store.deck/storedDeck must identify the selected saved instance consistently. |
| Edit collision | Current Edit veto forbids matching another custom inventory. Define convergence/dedup policy before changing it; preserve true unrelated hash-collision protections. |
| Seed replacement | replacements/allDecks, RESET and seeded routes must retain built-in slot behavior independently of saved-instance allocation. Ordinary imported links currently carry no local replaces intent. |
| Links/routes | #s= stays portable; repeated boot/import must reuse a matching variant instead of allocating forever. #edit- is modal/session routing and not an exported local identifier. |
| Tabs | Per-tab registries plus whole-array shared-storage updates can lose concurrent writes. IDs alone do not solve stale saves, two Adds or simultaneous edits. Preserve dirty drafts; decide conflicts and notifications. |
| Migration | Map old selection/order deterministically; keep opaque/newer records byte-preserved. Older clients collapse equal inventories, so assess a new storage namespace/copy-only migration and retained old backup. Never let downgrade silently destroy siblings. |
| Other plans | DUPLICATE-NOTES plan proposes future record/wire capability changes and is EXECUTIONHELD. Reconcile schema/version ownership before either migration; do not silently reuse its reserved assumptions or implement duplicate-note functionality here. SPS/async repair touch app/tests and require scoped integration, not bundling. |

## Decisions requiring explicit plan contracts

1. Import differing name/layout should retain both; exact repeat import should
   select/reuse its existing variant. Initial owner interview pending.
2. Define palette/parent-only variants, equivalent default spelling and auto names.
3. Explicit Add with exactly identical content: create a second physical instrument,
   select existing, or offer a deliberate Save as new action? Avoid confirmation
   on every ordinary import.
4. Edit convergence onto another variant: retain both physical instruments or
   consolidate only with explicit consent? Never silently delete a sibling.
5. Same-instance concurrent saves: preserve dirty draft and expose a conflict,
   rather than silently overwriting. Define cross-tab updates without focus theft.
6. Editing a built-in versus importing a similar variant: preserve replacement
   slot intentionally; do not let an arbitrary import seize it.
7. Backup/export and downgrade behavior must be observable and recoverable before
   record migration. Do not invent lost historical records from overwritten data.

## Continuation and approval boundaries

Root/source/UX performed independent read-only investigations, not operational
validation of a new design. Next: record owner answer, draft and independently
critique a swarm-shaped planning prompt; run it with source/migration/concurrency
and UX lanes; generate a separate plan; independently ENG/design-review exact
plan; then establish implementation authority before code. Include spec-first
migration fixtures, old/new writer tests, opaque-record preservation, selection/
delete/replace/reset, exact repeat import, clean receiver and two-tab acceptance,
generated meaningful mutants/full CI/actual DEV checks and rollback rehearsals.

Do not expand the reviewed async hotfix into a schema migration. No main release,
CLAUDE/global/auth changes or DUPLICATE-NOTES execution permitted by this record.
Current locator: codex/share-customization-hotfix-20261025,
host-local /private/tmp/handpan-share-hotfix.urAbvO/integration. Research siblings
source/ and ux/ are read-only here; recovery comes from this retained checkpoint
and live refs, not private agent conversation history.

References: [ledger](../WORKSTREAMS.md),
[async hotfix plan](2026-10-25-share-customization-hotfix.md),
[source research](2026-10-25-share-customization-source-research.md),
[UX research](2026-10-25-share-customization-ux-research.md),
[DUP plan](2026-10-25-duplicate-notes.md).
