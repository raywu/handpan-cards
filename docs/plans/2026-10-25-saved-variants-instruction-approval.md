# Proposed instruction/spec approval packet — NOT APPLIED

2026-10-25. This is a concrete proposed patch for the saved-variants plan, not a
change to either source file and not permission to execute the migration.
ANY CLAUDE.md edit requires the owner's explicit exact-diff approval.

The patch changes product/storage facts required by instance support. It preserves
Claude engineering workflows, global configuration, physical layout, engine
inventory, English note grammar and generated-source rules. It deliberately keeps
historical recognized replacement RESET deletion and owner-delete promotion;
plain imported custom variants and opaque records remain protected. The proposed
coexistence/fallback/conflict contract still requires owner acceptance.

Base CLAUDE SHA256: 0025cd135ef74beb53c11308dd62ae0593ff611d2f9cfa9ab2a786682fe9a188
Base ENGINE-SPEC SHA256: b7538b52a28a83989cfc383997a4d4cca1e0965ce8fe40cf1bb7c656c5ec3e11

Recheck exact base/diff after accepted DEV changes. Any changed wording requires
renewed review/approval; do not apply a stale patch by fuzzy matching.

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -479,18 +479,33 @@
   `replacements()` before `fallbackDeck()`), and boot says "That scale is gone."
   only when the deck shown is not that replacement. A replacement outranks a
   hidden seed.
-  Hidden ids live in the `hidden` field of the `hpfc` blob, written only when
-  non-empty; there is no separate `hpfc.hidden` key. RESET SEEDED SCALES
-  (`#deck-restore`) clears `hidden` and every record whose `replaces` names a
-  seed (older records naming the same seed included), keeps plain custom
-  decks, and moves to `fallbackDeck()` only if the selected deck is gone.
-- **Chip order is not picker order:** the strip is `allDecks()` = custom decks
-  newest first, then the seeded decks' slots in `data/decks.json` order. A slot
-  shows `replacements()[seedId]`, the newest record naming that seed in
-  `replaces`, else the seed if not hidden. Older records naming the same seed
-  render as plain custom decks. "Picker order" and "chip index" are different
-  facts; a test that picks a custom deck by index targets the older custom with
-  `+ 1`, never index 0.
+  In saved-variants builds, hidden seeded state and the preferred tagged
+  selection live with the saved collection (ENGINE-SPEC sections 12/14); unrelated
+  settings remain in `hpfc`. Legacy source keys are retained for recovery and
+  older clients; local instance handles are never written to legacy `hpfc.deck`.
+  RESET SEEDED SCALES clears hidden state and removes recognized replacement
+  records whose `replaces` names a seed, including older recognized replacements.
+  Plain custom instances and unreadable/newer records are kept. It changes the
+  selected view only if that selection disappeared, using the existing visible-
+  default/replacement then first-visible fallback. Destructive group/slot commits
+  must reject stale affected-scope proofs; two taps do not authorize deleting a
+  replacement changed in another tab after RESET was armed.
+- **Chip order is not picker order:** saved custom instances appear newest first,
+  then the seeded slots in `data/decks.json` order. Edit keeps an instance's place
+  even when its engine inventory ID changes. Each slot has one explicit saved
+  owner, else its visible built-in; older replacement instances appear as custom
+  instances. Deleting the owner promotes the newest surviving recognized
+  replacement, preserving the existing policy. Imports carry no replacement
+  authority merely because their notes match.
+- **Saved instance identity:** engine IDs still identify musical inventory.
+  Separate stable local handles identify saved instances, selection, Edit and
+  deletion; same-note named/layout variants can coexist. Exact portable-meaning
+  imports reuse a match, while Edit updates only its selected instance. Custom
+  `#s=` links serialize committed portable content, never a local handle; equal
+  URLs can describe several local instances. Preserve explicit LINK UI retirement
+  on instance selection as well as route changes. ENGINE-SPEC sections 12/14 are
+  authoritative for equality, migration, serialized acknowledgment, conflicts,
+  session-only fallback and recovery. No workflow or global configuration changes.
 - **Boot order:** the first render must happen after the card-order array
   exists; `render()` guards against an empty order. Keep it that way.
 - **Data re-injection:** the degrees contain `deg` (U+00B0) characters; a
--- a/docs/ENGINE-SPEC.md
+++ b/docs/ENGINE-SPEC.md
@@ -856,9 +856,13 @@
   8-hex FNV-1a 32-bit hash of the UTF-8 bytes of `core.identitySeed(seed)`
   (offset basis `0x811c9dc5`, prime `0x01000193`, multiplication taken modulo
   2^32), giving the same result in Node and in the browser.
-- DECIDED(2026-10) The id is 32 bits, so two different scales can collide. The
-  records store holds one record per id: saving a second scale with a colliding id overwrites the earlier record in place (the later save wins), while the boot dedupe in `restoreScales` keeps the first; a collision is
-  accepted as vanishingly rare and is documented in the README.
+- DECIDED(saved-variants contract) The 32-bit id identifies musical inventory,
+  not a unique saved instance. Saved instances have separate stable local
+  handles. Import equality compares full validated portable meaning, including
+  identitySeed spelling and option intent; hash equality alone never discards or
+  overwrites a saved instance. Edit/delete target one instance. Preserve genuine
+  different-inventory collision defenses and recovery data rather than silently
+  treating a hash collision as an exact duplicate.
 - DECIDED(D14 as amended) The id is a pure function of `identitySeed(seed)` -
   notes, octaves, zones and order - and nothing else; `select.build` is never
   consulted for it.
@@ -976,12 +980,26 @@
   rather than one is deliberate and safe here: no path reaches a solve with an
   unvalidated layout correction.
 - DECIDED(plan Phase 4) A flipped byte or an over-cap payload is rejected.
-- DECIDED(owner 2026-10, R7) Saved scales live in localStorage under
-  `hpfc.scales.v3`. On first boot the old `hpfc.scales` list is copied there
-  verbatim as a whole list (`copyLegacyScales`), and each record is read through
-  its own version reader and rewritten as v4 later, in `restoreScales`; the old key
-  is never written again. A scale saved in a tab still running the old app
-  lands under the old key and does not appear in the new app.
+- DECIDED(saved-variants contract) Saved collections use `hpfc.saved-scales.v1`,
+  envelope schema1, with instance wrappers outside capability-tagged `{v,s,o}`
+  records. Wire6 and current record4 writers do not change for local metadata.
+  The envelope stores ordered instances, tagged preferred selection, explicit
+  slots/hidden state, collection identity/revisions and immutable raw migration
+  source strings. A single acknowledged envelope replacement is the commit;
+  all durable writers serialize through the same exclusive Web Lock and reread
+  inside it. No unlocked durable fallback. Successful setItem acknowledges the
+  API write, not disk flush; a later diagnostic readback error does not roll it
+  back or authorize duplicate allocation.
+- DECIDED(saved-variants contract) Legacy `hpfc.scales.v3`, `hpfc.scales` and
+  relevant old selection/hidden source remain untouched by the new collection.
+  Legacy R7 builds copied `hpfc.scales` into `hpfc.scales.v3` and normalized known
+  records through their version readers. New migration preserves exact raw source
+  for recovery, converts known legacy records in the new envelope only and keeps
+  opaque/newer values unmodified. A valid committed new envelope is authoritative;
+  later old-client writes are a separate recovery branch, never automatic
+  re-migration. Quota/denied/corrupt/newer states must not be treated as an empty
+  durable store. Explicit session-only fallback is local to this tab and cannot
+  silently promote itself into persistent data when capabilities recover.
 - DECIDED(plan "Encoding") The encoder is pure JS: `node:vm` has no
   `CompressionStream`, so the engine may not depend on it. The test realm
   (`tools/engine_loader.js`) does inject `btoa`, `atob`, `TextEncoder` and
```

The final implementation must validate these contracts before presenting the
product as delivered. This packet contains no successful migration/runtime claim.
