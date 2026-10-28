# Saved variants: browser platform research

Planning evidence, 2026-10-25; proposals, not implementation authority. This lane
owns only this note. Checkout: `codex/saved-variants-platform-20261025`, source
baseline `89ababec`. Frozen prompt SHA-256:
`cd9dbb774a9ceb507bb0ec1a51e9440ada029bc1993167ed172749a3220fb9a7`.
Read AGENTS, CLAUDE, tests/CONTRACT, browser runbook, the frozen prompt and retained
[investigation](2026-10-25-saved-scale-variants-investigation.md). No browser,
storage migration, installation, app/test edit, authentication or remote write
was performed. Public documentation queries contained no owner data.

## Evidence and operational limits

**Verified source:** this is a self-contained static app; current persistence
uses `hpfc.scales.v3`, legacy `hpfc.scales`, and shared settings `hpfc`.
`writeScales` catches write exceptions without returning acknowledged success;
`rememberScale`, `replaceScale` and deletion rewrite a whole saved array.
Distinct local IDs alone cannot repair this read/modify/write race.

**Verified documentation, operationally unverified:** the API properties below
were checked against primary specifications, MDN and browser-engine sources on
2026-10-25. Availability tables describe browser versions, not this user's
context. No API was exercised. Browser discovery, API property presence, actual
access, acknowledged write, reload recovery and crash durability are separate
claims. Existing full-Mac-suite limits in the runbook remain unchanged.

| Mechanism | Authoritative finding | Consequence for this plan |
| --- | --- | --- |
| `localStorage` | WHATWG explicitly warns authors to assume no locking across agent clusters. `setItem` checks inability to store before replacing its map entry; this is not a transaction across reads or keys. Getter can throw `SecurityError`, writes can throw `QuotaExceededError`. [HTML Web storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute), [setItem algorithm](https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-setitem-dev). | A single JSON replacement avoids separate metadata/data partial states at the API level; it does not provide CAS, serialized RMW, or proof of physical disk flush. Catch failures explicitly. |
| `storage` event | Other same-origin contexts receive localStorage changes; the initiating window does not. Event is not cancelable. [MDN event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event). | Notification and reconciliation trigger only. A reread/revision check followed by an unlocked write still races. Update the writer directly after acknowledgment; reread on foreground before decisions. |
| Web Locks | Same-name exclusive locks coordinate cooperating origin contexts; lock scope tracks storage partitioning. Private sessions are separate. `steal` can leave previous code still executing. [W3C Web Locks](https://www.w3.org/TR/web-locks/#api-lock-manager). | Every writer to the new variants envelope must take the same lock, reread inside it, validate expected record revision, then commit. Never steal, emulate a lease with timestamps, or trust old clients to participate. |
| IndexedDB | Overlapping read/write transaction scopes serialize. Abort rolls back their changes. Upgrade is exclusive and waits for other connections to close. `strict` is a durability hint; transactions become inactive outside their active lifecycle. [IndexedDB 3.0 §§2.7–2.7.3](https://www.w3.org/TR/IndexedDB/#transaction-concept). | Record read/revision check/write and migration marker can share one transaction. No arbitrary awaits for UI/network/engine work inside it; prepare first. Handle aborted/blocked/closed paths. |
| Commit acknowledgment | A request success is distinct from transaction completion. [MDN complete event](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event). Normal shutdown can interrupt transactions; older connections must cooperate with upgrades. [MDN IndexedDB usage](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB#version_changes_while_a_web_app_is_open_in_another_tab). | IDB success UI waits for `complete`, not `put.onsuccess`; don't save for the first time during unload. On `versionchange`, close connection, retain dirty drafts, require reopen/reload before further commits; explain `blocked`. |

### Compatibility and context checks

Web Locks is secure-context restricted, with MDN Baseline since March 2022.
[Navigator.locks](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/locks).
MDN's [LockManager compatibility data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/LockManager.json)
records Chrome 69, Firefox 96, Safari 15.4, with iOS mirroring Safari. These
mutable tables were read on the date above; no specific installed version was
verified. Secure HTTPS deployment is a candidate environment, not a write test.
Use `isSecureContext`, guarded capability access and real lock-acquisition/error
handling; a lock callback cannot make disabled storage writable.

`crypto.randomUUID()` creates a v4 UUID, is secure-context restricted and has
Baseline March 2022. [MDN randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).
[MDN Crypto compatibility data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Crypto.json)
records Chrome 92, Firefox 95, Safari/iOS 15.4. `getRandomValues` has Baseline
July 2015 and is usable in insecure contexts. [MDN getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues).
Proposal: local handle generation prefers guarded `randomUUID`, otherwise
guarded random bytes with an explicitly specified encoding; collision-check in
the serialized commit and retry. No timestamp/`Math.random` uniqueness claim.
If neither works, retain draft/session behavior and report unavailable durable
creation; do not overwrite an existing handle. A transactionally allocated
counter is an alternative only with a documented recovery/high-water contract.
Local handles never enter share URLs or analytics.

IndexedDB's broad availability does not establish support for all optional
durability controls. [MDN transaction options](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction)
documents `default`, `relaxed`, and `strict`; treat strict as requested risk
reduction, not guaranteed power-loss recovery. Avoid nonstandard `readwriteflush`:
[MDN IDBDatabase compatibility data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/IDBDatabase.json)
lists Firefox preference gating and no Chrome/Safari support. If IDB is chosen,
verify opening, transaction completion, restart and error behavior in supported
targets; report durability-option acceptance separately.

Direct `file:` loading has undefined localStorage behavior; access may throw.
HTTP and HTTPS use separate storage. [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
The single-file requirement therefore supports a functional session-only
fallback; it cannot establish identical persistence guarantees on disk-open and
HTTPS contexts. No added server, package, build tool, worker or external script
is intrinsically required by either Web Locks or IDB.

## Compact option comparison

| Candidate | Correctness/cost | Project fit / recommendation |
| --- | --- | --- |
| Existing localStorage array plus IDs/events/retry | IDs retain siblings, but concurrent writes can still erase each other; postwrite verification cannot undo acknowledged lost writes. | Reject for the required no-lost-update contract. |
| New localStorage envelope + exclusive Web Lock + per-record revisions | One storage adapter and asynchronous commit boundary; existing JSON records remain reusable. All data, order, tombstones, replacement-slot ownership and commit metadata must be one authoritative envelope. Whole-envelope serialization cost remains. | **Proposed minimum**, conditional on accepting explicit session-only/read-only durable fallback where locks/storage fail. The UI must wait for acknowledgment and preserve dirty drafts on conflict. |
| New IndexedDB database + read/write transactions | Real scoped transactions without a separate Web Lock; async opening, transactions, lifecycle, blocked upgrades, notifications, migration and test-double changes add code. | Prefer only if required supported contexts need persisted writes without Web Locks, or measured envelope cost justifies it. No database merely to obtain UUIDs. |
| Per-record localStorage keys / append-only operation journal | Separate Adds reduce one collision class, but order, slot ownership, same-record conflicts, deletion, compaction and enumeration consistency remain a protocol. | Higher maintenance than the narrow adapter; no generic sync framework for unrelated settings. |

This platform lane does not choose registry representation or semantic equality.
Stable saved-instance identity plus an unchanged inventory ID is compatible with
either recommended adapter; a normalized fingerprint can deduplicate imports
inside the serialized commit. A content-hash registry alone still needs stable
edit targets and concurrency control.

## Proposed minimum commit and recovery contract

All following points are **recommendations pending plan review/owner policy**.

1. Put saved variants in a newly reserved namespace, separate from the legacy
   array and old settings selector. Do not dual-write variants back into the old
   array. Keep canonical record/wire versions distinct from the envelope schema;
   coordinate that namespace with held DUPLICATE-NOTES work before coding.
2. Under one named exclusive lock, reread and validate the supported envelope,
   merge a command against current data, compare the target revision, allocate
   only when needed, then replace one envelope key. Include selected-instance
   state needed for consistent saved selection there; do not store a local
   handle in old `hpfc.deck`. Unrelated shared settings need no new sync layer.
   A stale same-record edit or delete refuses with draft retained; unrelated
   Adds survive. Deleted handles need a tombstone or equivalent revision fact
   so stale Save cannot recreate them implicitly. Route reimport policy is an
   explicit semantic decision beyond the storage primitive.
3. Acknowledge persisted success only after `setItem` succeeds; optionally read
   back while still locked as a consistency check, without claiming disk flush.
   Do not publish a durable registry mutation before acknowledgment. Label a
   session-only result and keep recovery/share material available on failure.
   If lock access/acquisition fails or is unavailable, do not fall back to an
   unlocked persistent write. A hung acquisition needs cancel/retry UI retaining
   the draft, not forced lock theft.
4. Migration reads the raw legacy string without parse/restringify substitution.
   Capture that exact baseline in a new immutable recovery key before committing
   the new envelope; preserve opaque/newer/corrupt bytes. Include baseline
   identity/raw comparison, migration protocol version, deterministic legacy
   index-to-handle mapping and a committed marker in the envelope. An orphan
   backup is harmless; absent envelope means migration is uncommitted. A valid
   committed envelope is authoritative and never silently rebuilt from legacy.
   No multi-key atomicity is assumed. Repeat migration reuses its mapping.
5. Check legacy raw bytes again immediately before envelope commit and refuse
   observed drift. This cannot fence an unmodified old tab: it may write right
   after the check. Namespace isolation protects new variants, not automatic
   incorporation of late legacy edits. Treat later legacy drift as a recovery
   branch for explicit comparison/import, never a background replacement or
   automatic re-migration. Never overwrite the captured baseline with latest
   legacy bytes. Owner must understand the remaining old/new divergence policy.
6. Legacy key alone is not an untouched backup because old writers can mutate it.
   If immutable backup plus new envelope cannot both fit, stop migration without
   deleting either source or pretending success. Offer a reviewed export/retry
   path. An in-origin backup is not independent disaster recovery: clearing or
   evicting origin data may remove both. Code rollback does not roll data back;
   old code sees its legacy branch while new variants remain retained for a
   compatible client/export. Never project siblings destructively into old data.

Quota is shared per origin, so backup duplication matters. MDN describes a
5 MiB localStorage limit and explains estimates are estimates, not reservations.
[MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
Measure actual serialized bytes, migration peak, parse/serialize time and lock
hold time on large public fixtures; avoid promising an instrument count from a
quota number. [WebKit storage policy, 2023-08-10](https://www.webkit.org/blog/14403/updates-to-storage-policy/)
documents quota failures and eviction under pressure/inactivity.
[WebKit tracking prevention](https://webkit.org/tracking-prevention/)
documents ephemeral private sessions and the user-interaction-gated seven-day
script-storage cap. Do not claim private-mode successful writes survive session
closure, or that `navigator.storage.persist()` is automatic/permanent backup.

## Required later proof and stop conditions

These are future acceptance requirements, **not completed tests**. Integrator
owns browser scheduling and exact-head evidence under the existing runbook.

- Two independently paused contexts: different Adds both survive; duplicate
  identical imports allocate at most one; simultaneous same-instance edits
  produce one commit and a preserved conflict draft; delete versus stale Save
  cannot silently resurrect. Repeat with missed/delayed storage events and a
  duplicated tab. Verify rereads occur inside serialization, not just on events.
- Inject missing/throwing lock access, rejected acquisition, unavailable random
  APIs, unavailable/throwing storage getter, quota on backup and commit, corrupt
  envelope, newer envelope and serialization failure. No silent durable success,
  unlocked persistence, opaque-byte rewrite or false clearing of dirty state.
- Stop execution after each migration boundary: before backup, after backup,
  before commit, after commit/before UI acknowledgment; reload twice. Same
  mapping/order/selection, no extra allocation, exact baseline retained. Introduce
  old-client writes before/during/after migration and rehearse code downgrade and
  upgrade. Observed drift must surface, not auto-merge destructively.
- Test session-only disk-open behavior separately from HTTPS persistence; verify
  fresh receiver links contain no local handles. Browser support claims need
  actual target runs, including Safari/iOS for any claimed native coverage;
  Chromium cannot certify them. Do not inspect owner profiles.
- If IDB is chosen: additionally abort after successful put, exhaust quota,
  block upgrade with an old connection, trigger versionchange/close, reject lower
  version open, and interrupt pending transaction. Transaction completion alone
  must not be described as universal crash-proof durability.

**Stop conditions before implementation:** unresolved owner coexistence/conflict/
old-client recovery policy; namespace/version collision with the held plan;
unapproved project-policy change; inability to preserve recovery under failure;
or a design requiring unlocked persistent fallback. Missing native targets leave
coverage explicitly unverified, with browser access owned by the integrator.
Documentation research itself grants no installations or configuration changes.
