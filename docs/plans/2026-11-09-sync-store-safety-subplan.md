# Login sync store-safety subplan (A2 review failure, regroup)

Refs TRI-28. Lane A2: main PR #1001 (head 6c960269717acb63f5d6e18621eacdf2151f5fc1), dev PR #1003
(head 7e3b356fb8052b09f127caae44b38c7b086f6791), branch `claude/login-sync-a2`.
Parent plan: `docs/plans/2026-11-05-login-sync-v2.md` (s8-s12). Prior regroup:
`docs/plans/2026-11-08-login-sync-a1-regroup.md` (A1, three review failures on lost concurrent edits).
Status: plan only, NOT yet reviewed by `/plan-eng-review` (required before dispatch). The self-score in
section 11 is not independent review.


Current pickup (2026-11-09): section21 supersedes older client pickup/status text. Source1356ac84
FAILED independent review despite passing earlier local proofs. The operation-authority continuation
is independently READY_WITH_NITS, both nits addressed; execution proofs remain pending. Owner approved
one held CI-only main-target PR at the exact rebuilt DEV head; neither main-target PR may merge.

Hard rule (CLAUDE.md): a release must never lose a user's saved scales.

## 0. Goal and non-goals

Goal: login-sync can never push a tombstone, or apply a remote delete, on the strength of a local store
that is not the durable store the sidecar was built against; and the dev PR merges with a green dev suite.

Non-goals (all deferred or out of lane): schema or server change (prod schema is applied; none allowed);
new UI or new i18n keys; About privacy copy; token-refresh semantics; lock `ifAvailable`/bfcache work;
sync of preferences; prod enablement (`SYNC_ORIGINS` stays dev-only); any change to saved-store
migration, `applySavedCommand`, deck data or share links; any change to A1's sync-apply semantics.

## 1. Investigation: cause

### 1.1 What happened (primary sources)

- A1 failed three reviews (`git log` of `claude/login-sync-a1`; regroup doc s1). All three: a sidecar
  claim ("local entry at revision R holds server body B") was stamped from a local read taken AFTER a
  concurrent local edit. The regroup named the invariant "witnessed writes": a sidecar claim must carry
  the witness of the state it was derived from.
- A2 fails review 1 with the same shape one level up. The sidecar claim is "base id X is a scale this
  device holds". `planPush` (`src/engine/sync.js`, loop over `Object.keys(sc.base)` with `if (live.has(rid))
  continue`) turns "base id with no local entry" into a tombstone. That inference is only valid if the
  local list is the store the base was built against. Nothing in the sidecar or the client ties the two:
  the sidecar lives in localStorage (`hpfc.sync.v1`), the store lives in IndexedDB or in memory, and the
  gate `syncActive = () => !!SYNC_CFG && !!savedState && savedMode !== "protected"` checks only that the
  mode is not one string.

### 1.2 Missing invariant (the cause)

**Sidecar claims are valid only against the store epoch that made them, and are re-validated against the
live store at the moment of every destructive action.** A1 broke the "state under the plan" half (store
changed while planning: revision witness). A2 breaks the "store identity" half (store replaced or never
the durable one: identity witness). The bug class is one: sidecar and store are two independently
mutable things with no pairing check.

### 1.3 Why it slips past author tests

1. The authored tests vary the axes the author modelled: devices, network, ops, races of edits
   (`tests/sync.test.js`, `tests/sync_model.js` bounded two-device model; `describe("sync client")` in
   `tests/app.test.js`, all booted via `boot({href: DEV, locks: true, storage: {"hpfc.sync.v1": ...}})`,
   i.e. durable only). No test boots session, protected, temporary or migration-temporary with a sidecar.
   `grep` for `protected|session|temporar` inside the sync client describe finds none (verified at
   6c960269).
2. The parent plan has no store-mode section. s9 line "session mode ... reused" treats modes as plumbing;
   nothing says what sync does per mode. A requirement that was never written cannot be a test.
3. The same pattern as A1: each fix covers the path the reviewer traced (mechanism-by-mechanism), and the
   next reviewer finds the next axis. The cure is an enumerated matrix plus a pin that fails when a new
   mode or entry point appears (as the A1 regroup did with the site-tag guard).
4. CI does not run on dev PRs, and the dev-only test `editor_model.test.js` (U2a-F3) is not in main, so
   the second blocking finding is invisible to every gate the lane runs. Lane brief had no dev gate.

### 1.4 Enumeration (callers enumerated by reading the whole sync region, not by one grep pattern)

Region: `// Optional email-code sign-in` through `syncBoot` in `index.html` at 6c960269.

Network-affecting entry points. Only `syncPush` calls `push_scales`; only `syncApply` (two call sites in
`syncPull`) mutates the store; `syncPull` is called from `syncCycle` and from `syncPush` (conflict loop).
Triggers that reach `syncCycle` (via `syncKick`):

| # | Trigger | Site | Reaches |
|---|---|---|---|
| T1 | lock granted | `syncStartLock` callback | pull then push |
| T2 | sign-in verified | `syncSubmit` end | pull then push |
| T3 | storage event for the sidecar key, holder, `sc.first` | window `storage` listener | pull then push |
| T4 | visibilitychange after 60 s | document listener | pull then push |
| T5 | debounced save | `syncChanged` timer (2 s) from `commitSaved` session branch, `commitSaved` durable branch, `reconcileSavedCollection` | push (pull if queued) |
| T6 | "Yes, add" | `syncAskAnswer(true)` | push (holder only) |
| T7 | queued re-run | `syncKick` tail (`syncQueued`) | pull then push |
| T8 | conflict loop | `syncPush` -> `syncPull` | pull-apply inside a push cycle |

Every trigger funnels into `syncCycle`, and the only mode check there is `syncActive()` at the top. The
cycle awaits network between pull-apply, `syncLocal()` and `planPush`, so the check is a time-of-check
problem as well: mode can change mid-cycle (temporary-use click, sign-out, account switch).

Store states from which a push or pull-apply can fire (this is the matrix row set; section 3):

| # | State | How it arises (site) | Gate today | Pushed local list |
|---|---|---|---|---|
| M1 | durable, normal | `savedMode="durable"` after adoption | allowed | real |
| M2 | durable, collection replaced or evicted | IndexedDB cleared or evicted while localStorage keeps the sidecar; `initializeSavedCollection` creates a fresh empty collection with a new `collectionId` | allowed (NOT SAFE) | empty or unrelated |
| M3 | durable, reconcile failed | `savedReconciliationFailure` keeps old `savedState`, sets `savedIssue`/`savedRecovery` | allowed | stale but non-empty |
| M4 | session with real content | `initializeSavedSession(issue, staged)` when the lock or IndexedDB is unavailable but a snapshot was read | allowed (NOT SAFE: pull-apply goes to memory only, lost on reload while sidecar advances; next boot pushes tombstones for them) | memory only |
| M5 | session, migration-temporary empty envelope | `initializeSavedSession` and its empty `makeSavedMigration({rows:[]})` branches (`migration.temporary=true`) | allowed (BLOCKING finding 1, second path) | empty |
| M6 | protected | `savedProtect` | blocked (`syncActive` false) but `syncStartLock` still makes the tab `syncHolder` | none |
| M7 | protected then "USE THIS TAB TEMPORARILY" | `#saved-temporary-use` onclick: `retireSavedAuthority()`, `savedMode="session"`, empty envelope | allowed (BLOCKING finding 1, first path) | empty |
| M8 | mode flips mid-cycle | any of M7/M2 transition during an await in `syncCycle`/`syncPull`/`syncPush` | checked once at cycle start | changes under the cycle |
| M9 | starting | `savedMode="starting"` with a temporary or partial `savedState` before init completes | allowed if `savedState` exists | partial |
| M10 | no `navigator.locks` | `syncStartLock` returns; `commitSavedDurable` returns `lock` failure; boot goes session | `syncHolder` never true, so no push (safe) but UI shows signed in | none |

Cross-cutting conditions (apply to M1 and others): non-holder tab (never pushes; `syncAskAnswer` patches
the shared sidecar and the holder pushes on its next trigger); holder hand-off when the holder tab closes
and a tab in M5/M7 inherits the lock (this is how a second tab reaches finding 1); bfcache restore
(`pageshow` runs `reconcileSavedCollection`, which calls `syncChanged`; timers frozen, mode unchanged,
holder lock held means Chrome treats the page as not bfcache-eligible, so low risk); sign-out in another
tab mid-cycle (`syncApply` does not re-read the sidecar before `commitSaved`); account switch mid-cycle
(old-user batches with old token: server RLS confines them to the old user, so no cross-account loss, but
the rows are wrong for the signed-in user); sign-out and delete-account (touch only the sidecar and the
server, never the local store).

Two paths beyond the reviewer's findings (details in section 9): the pull side has the same inference
(`planPull`: remote live, no local, base present => "local deleted it", which then pushes a tombstone), so
the planner guard must cover pull as well as push; and session-mode PULL-APPLY (M4) strands scales in
memory while the sidecar advances.

### 1.5 Coverage today

| State | Push covered by a test | Pull-apply covered by a test |
|---|---|---|
| M1 | yes (`a save is pushed after the debounce`, `deleting a synced scale pushes a tombstone`) | yes (`a first sync pulls remote scales`, `a pull merges every page`), remote-delete-applied-locally: no (reviewer gap) |
| M2 | no | no |
| M3 | no | no |
| M4 | no | no |
| M5 | no | no |
| M6 | no (the `protected` hide is untested for sync) | no |
| M7 | no | no |
| M8 | no | no |
| M9 | no | no |
| M10 | no (e2e boots with locks) | no |
| engine: tombstone for unheld id | `sync: a tombstone for an id the device never knew is never sent` covers only an id with no base; an unheld base id is untested | no |

## 2. Invariants (each is a testable property; section 5 gives the failing-first test)

- **S1 (durable only).** Sync performs no network write and no store write unless the store is the durable
  authority: `savedMode === "durable"`, `savedState` present, `savedState.migration.temporary` falsy, and
  the authority generation unchanged since the cycle began.
- **S2 (guard at every boundary, not once).** The S1 predicate plus `userId` and sidecar presence is
  evaluated at: cycle start, after every await that precedes `planPush`, immediately before each
  `push_scales` batch, and immediately before each `commitSaved({type:"sync-apply"})`. A failure aborts the
  cycle with no store write and no push, and leaves the sidecar unchanged except `pending`.
- **S3 (a tombstone needs proof the store held the scale).** `planPush` emits a tombstone for base id R only
  if the local instance id behind R is in the store's `usedInstanceIds` (append-only, validated by
  `savedEnvelopeShape`). A store that never held the id (fresh collection, empty temporary envelope,
  evicted-and-recreated) therefore produces zero tombstones.
- **S4 (same proof on pull).** `planPull` and `planDeferred` treat a base entry whose local id the store
  never held as VOID: the base entry (and its alias and deferredDelete) is dropped from the planning view,
  so "remote live, no local copy" is a new remote scale to insert, never "local deleted it".
- **S5 (fail closed).** If `ctx.usedIds` is absent from the planner input, S3 and S4 treat every base entry
  as unheld: zero tombstones, zero base-dependent removes.
- **S6 (no silent sync in a dead mode).** In every state outside S1, the sign-in menu row stays hidden as
  today and no sync network call is made, including after a lock hand-off to that tab.
- **S7 (sign-out and account switch mid-cycle stop store writes).** After the sidecar is dropped or its
  `userId` changes, the running cycle makes no `sync-apply` commit and no push.
- **S8 (pin).** A test fails if a new `savedMode` literal, a new `syncKick(`/`syncCycle(`/`syncApply(`
  call site, or a new `push_scales` fetch site appears without a matrix row (section 4.3).

Where the bound lives (explicit): no server-side bound is possible without a schema change (checked
`tools/sync/schema.sql` at `claude/login-s`: `push_scales` refuses on cap, size, unknown, rate (history),
invalid; nothing bounds tombstones per call). The bound is client-side and engine-side: S3 in the pure
planner, S1/S2 in the app. Recovery stays the documented SQL (schema.sql "Mass tombstone, within 30 days").

## 3. State/mode matrix (rows = state, columns = action; cell = allowed or blocked + test)

"Allowed" means the action runs and is correct; "blocked" means zero fetches to `push_scales` and zero
`sync-apply` commits. Test ids are defined in section 5. Sign-out and delete-account only touch the
sidecar and server; the sign-in row (and so both buttons) is hidden outside M1, so they are unreachable
there except a sidecar drop arriving by `storage` event from another tab, which is always allowed
(it can only remove the sidecar).

| State | Push | Pull-apply | Sign-out | Delete-account |
|---|---|---|---|---|
| M1 durable, normal | allowed (T-APP-M1-push, existing tests) | allowed (T-APP-M1-pull, T-APP-M1-remote-delete) | allowed (existing: sign-out keeps every saved scale) | allowed (T-APP-M1-delete-keeps-local) |
| M2 durable, replaced or evicted | blocked for tombstones: pushes new rows only (T-ENG-S3-fresh-store, T-APP-M2-push) | applies as inserts, base voided (T-ENG-S4-void-base, T-APP-M2-pull) | allowed | allowed |
| M3 durable, reconcile failed | allowed on stale non-empty list; no tombstones for unheld; none for held absent because the list is stale not empty (T-APP-M3-no-mass) | allowed | allowed | allowed |
| M4 session, real content | blocked (T-APP-M4-push) | blocked (T-APP-M4-pull) | hidden row; storage-event drop allowed (T-APP-M4-dropped) | hidden |
| M5 session, migration-temporary | blocked (T-APP-M5-push) | blocked (T-APP-M5-pull) | as M4 | hidden |
| M6 protected | blocked even as lock holder (T-APP-M6-holder) | blocked | as M4 | hidden |
| M7 temporary-use after protected | blocked (T-APP-M7-zero-tombstones, the reviewer's repro) | blocked (T-APP-M7-pull) | as M4 | hidden |
| M8 mode flips mid-cycle | cycle aborts before `planPush` and before each batch (T-APP-M8-flip-before-push, T-APP-M8-flip-between-batches) | cycle aborts before commit (T-APP-M8-flip-before-apply) | n/a | n/a |
| M9 starting | blocked (T-APP-M9) | blocked | hidden | hidden |
| M10 no navigator.locks | blocked: never holder (T-APP-M10-no-locks) | blocked | hidden (mode is session, so the row is hidden: fixes the "UI shows signed in" nit as a side effect) | hidden |
| sign-out mid-cycle (any) | blocked after the drop (T-APP-S7-signout-mid-pull) | blocked after the drop | n/a | n/a |
| account switch mid-cycle | old-user cycle aborts (T-APP-S7-switch-mid-push) | aborts | n/a | n/a |
| non-holder tab | never pushes (existing e2e `two tabs: only the lock holder ...`) | never | allowed | allowed |

## 4. Design (minimal)

### 4.1 Engine: one choke point, `trustedBase` (S3-S5)

In `src/engine/sync.js`, add one internal function applied at the START of `planPush`, `planPull` and
`planDeferred` (the same input normalisation point, so no per-output guards are added, which is the lesson
of A1): it returns the sidecar view with every `base[rid]`, `alias[...]`, and `deferredDeletes` entry
removed whose local instance id is not in `new Set(ctx.usedIds)`. A base entry is HELD (kept) by a FAIL-CLOSED rule (N1): if any `alias` key maps to the rid, it is held only
when at least one of those alias keys is in `usedIds` (the rid alone does not hold an aliased base; a revive
leaves two keys for one rid and either holds); with no alias key for the rid, it is held when the rid itself
is in `usedIds`, and is also kept whenever a live local entry already proves it (a local entry whose `alias`-resolved
id equals rid). Only an entry with no such proof is voided. `ctx.usedIds` already exists in `syncCtx()`. Missing
`ctx.usedIds` yields an empty set (S5). Voiding is a planning view only; the stored sidecar is untouched
by the planners, so nothing is written by this function. `settlePull`/`settlePush` are not changed.
Consequences (state them in ENGINE-SPEC s20 as two rows): a base id the store never held is treated as
no base: push sends a live row only for entries that exist locally; pull inserts it as new.
Scope note (R3): `syncRemotePages` fetches only `rev > cursor`, and a replaced store keeps its cursor, so
rows at or below the cursor never return: after eviction the device stays EMPTY and safe. RESTORING an
evicted store is out of scope. (Option, not taken: reset cursor and base when a stored `collectionId`
changes, an additive sidecar field; deferred as a separate decision.)
Edge to test and record (not to change): a legitimate user "reset" keeps `collectionId` and `usedInstanceIds`
append-only, so a reset still tombstones (D3 deletes propagate). Verify in a test, do not assume.

### 4.2 Client: one predicate and a cycle token (S1, S2, S7)

In the `index.html` sync region (app JS, outside engine regions):

- `syncStoreToken()` returns `null` unless `SYNC_CFG && savedState && savedMode === "durable" &&
  !savedState.migration?.temporary`; otherwise a string of `savedAuthorityGeneration + ":" +
  savedState.collectionId + ":" + (sidecar userId || "")`. Signed out the token is still non-null in a durable
  store, so `syncPaint` keeps showing the sign-in form (N5).
- `syncActive` becomes `() => syncStoreToken() !== null` (so UI hiding and the guard share one source).
- `syncCycle` captures the token once; a helper `syncStill(token)` re-reads it and returns false on any
  difference or on a dropped sidecar. Placement (N2, so each check has its own killer):
  (a) in `syncPull`, before the primary `syncApply` when its plan has ops, then UNCONDITIONALLY after
  that awaited apply succeeds, before reloading the sidecar or planning deferred cleanup (including
  zero-op applies). This completion check dominates the former pre-deferred-ops check with no intervening
  await, so remove that redundant check; (b) in `syncPush`, the token-refresh await moves BEFORE
  `syncLocal()`/`planPush`, with `syncStill` between that await and planning; then reload `sc` via
  `syncLoad()` and return false without planning if absent or `sc.first` (section20); (c) immediately before each
  batch fetch; (d) in `syncCycle`, unconditionally after optional awaited `syncPull` and before sidecar
  reload/first-sync audit, and after awaited `syncPush` before the final sidecar reload/status settlement.
  Invalid identity aborts the old cycle without changing the replacement account's sidecar. These checks
  supplement, not waive, the accepted one already-dispatched pull-commit residual below.
- `syncKick`/`syncChanged` early-out on `!syncActive()` (cheap; the cycle check remains authoritative).
- `syncApply` passes the `collectionId` CAPTURED in the cycle token (not `savedState.collectionId` read at
  call time) in the `sync-apply` command, so the existing epoch check inside the transaction runs against
  the cycle's store (R4). Residual, stated: a sign-out or mode flip can still race ONE already-dispatched
  `sync-apply` commit (the `syncStill` check precedes the awaits in `commitSavedDurable`); that commit is a
  pull-apply of server rows into the same durable store, never a push or a delete of local data.
- `syncStartLock` is called only when `syncActive()` (at boot, on the `storage` listener and after
  sign-in), so a dead-mode tab never takes the `hpfc.sync` lock and starves durable tabs (R5).
  T-APP-M6-holder becomes: protected tab does not become `syncHolder`.

### 4.3 Pin (S8)

A test reads the app source and asserts: the set of `savedMode =` literals is exactly
`starting|durable|session|protected`; `push_scales` appears in exactly one `fetch` site; `syncApply(`
occurs exactly three times (the definition and its two calls in `syncPull`) (N5); every one of those call paths contains a `syncStill(` or the cycle-start
token. Adding any breaks the test until the matrix gains a row.

## 5. Tests first (failing-first, each names the invariant it pins)

All in new titled blocks. No existing assertion is changed (N6); the ONLY edits to existing tests are setup
lines that add ids to `used`/`usedIds` (R2/N4, see lane E). Record failing names against 6c960269 in the PR.

Engine, `tests/sync.test.js` (describe "store safety"):
- T-ENG-S3-fresh-store: base {r1,r2}, local [], `ctx.usedIds` []: `planPush` rows are empty.
  (Reviewer probe equivalent: `planPush({local: [], base:{r1,r2}})` today returns two `deleted:true` rows.)
- T-ENG-S3-held-delete: same base, `usedIds` [r1,r2], local []: two tombstones (legit delete unchanged).
- T-ENG-S3-alias: base rid R with `alias[L]=R`, `usedIds` contains L not R: tombstone sent; contains R
  not L: none (fail-closed, N1: an aliased rid needs an alias key in `usedIds`).
- T-ENG-S4-void-base: remote live R, no local, base R present, `usedIds` []: `planPull` emits an insert
  for R and no "kept deleted" outcome.
- T-ENG-S4-deferred: `planDeferred` ignores a deferredDelete whose id is unheld.
- T-ENG-S5-no-usedIds: omitting `ctx.usedIds` yields zero tombstones and zero base-dependent removes.
- Fixture update (R2/N4, prerequisite, lane E deliverable): setup lines only, adding ids to `used`/`usedIds`
  in the shared ctx helper (`tests/sync.test.js` / `tests/sync_model.js`), the describe-local
  `ctx = () => ({ usedIds: [] })` blocks, and the inline `dev.sidecar.base` tests (`a remote tombstone with
  no local copy ... drops a stale base`, `a local delete not yet pushed`, `settlePush records refusals`).
  Re-measured with the live-proof clause: 10 of 170 tests fail otherwise (the earlier 20 was without it).
  No assertion is edited.
- T-ENG-S8-two-alias: base rid R with `alias` L1->R and L2->R, `usedIds` contains only L2: base held,
  tombstone sent when no local entry; a live local entry proves its base even with `usedIds` [] (R8).
- T-ENG-model: extend `tests/sync_model.js` with a "store replaced" step (device keeps sidecar, store
  reset to empty with fresh collectionId) in the bounded model; invariant: other devices never lose a
  scale. Fixture ctx helper supplies `usedIds` everywhere else.
Mutants (new, `tests/mutants/sync_*.patch`; every patch has `# kills:` naming the whole test and `# suite:`
word-split patterns with spaces written as `.`, no `index a..b` lines, each killed by its named test): drop the `usedIds` filter in `planPush`; drop it in
`planPull`; ignore the alias lookup; leave `planDeferred` unfiltered; default a missing `usedIds` to "everything held".

App, `tests/app.test.js` (describe "sync store safety"; positive durable fixtures use `boot({href: DEV, locks: true, indexedDB: true, storage})`,
sidecar with base of N=3 synced ids, fetch stub from the existing `install()`):
- T-APP-M7-zero-tombstones: boot protected (corrupt envelope fixture used by existing protected tests),
  sidecar base r1..r3, click `#saved-temporary-use`, make a save, advance 2100 ms, await
  `syncRunning`: assert no tombstone row AND zero calls to `/rest/v1/rpc/push_scales` (R9: at lane E's head the empty temporary
  `usedInstanceIds` already yields no tombstone, so the call assertion is what fails first for S1). Also advance visibility 61 s: zero.
- T-APP-M5-push / -pull: uses a NEW additive `tools/sandbox.js` option (`throwOnKeys: [...]`, default absent; existing
  `throwOnStorage` throws for every key including `hpfc.sync.v1` and is unchanged) making `localStorage.getItem`
  throw for the saved keys ONLY (`hpfc`, `hpfc.scales`, `hpfc.scales.v3`, `SAVED_KEY`) while `hpfc.sync.v1`
  still reads; the test first asserts the branch taken (`savedMode === "session"` and
  `savedState.migration.temporary === true`), so the migration-temporary branch runs (N3): zero push, zero `sync-apply`. (IndexedDB-unavailable lands in M4, R6.)
- T-APP-M4-push / -pull: session with real staged content: zero push, zero store write from pull (assert
  remote rows are NOT inserted and sidecar cursor unchanged).
- T-APP-M6-holder: protected boot, lock granted: `syncHolder` stays false, zero calls (R5).
- T-APP-M9, T-APP-M10-no-locks (boot with `locks:false`): zero calls; sign-in row hidden.
- T-APP-M2-push / -pull: durable boot, then replace the store (new collection, empty) while the sidecar
  keeps base r1..r3: push sends no tombstones; pull: the remote rows sit ABOVE the sidecar cursor and are inserted as new; a row at or below the cursor stays absent (documented, out of scope, R3).
- T-APP-M3-no-mass: durable, reconcile failure injected: push sends no tombstone for held-and-present
  ids and none for unheld ids.
- T-APP-M8-flip-before-push: in a push-only cycle, the fetch stub flips mode during the token-refresh
  response. Install a test-local counting wrapper around `HPE.sync.planPush` before the cycle (the
  existing `app.run` wrapper pattern used for `settlePull` suffices; no new helper or exported API).
  After the injected flip, assert ZERO planner invocations, ZERO `push_scales` requests and ZERO
  store commits, then restore the wrapper in `finally`. Prove the wrapper is observing the real call
  boundary with the durable/no-flip control, which invokes the planner. The counter is essential:
  removing only the before-`planPush` guard must fail this test even though the later batch guard
  still prevents a request or commit. Do not count the token-refresh fetch as a push request.
- T-APP-M8-flip-between-batches / -before-apply: the fetch stub flips the mode during the first-batch
  or ops-bearing pull response respectively: later batch requests and apply commits are absent.
  Each mutant changes only its own guard; an unrelated guard must remain intact in the kill proof.
- T-APP-S7-signout-mid-pull, T-APP-S7-switch-mid-push: sidecar dropped, or replaced by another userId,
  while a pull or push is in flight: no `sync-apply` commit, no later `push_scales`.
- T-APP-S7-switch-empty-pull: switch to a new first:true sidecar during the old user's empty GET.
  After the old cycle returns, the complete new sidecar (including first/localOnly/pending) is unchanged,
  only the old GET occurred, no push/commit, and the local scale is retained. Keep those assertions.
  The SAME named test adds a second timing variant to distinguish the post-pull guard: an empty pull
  passes its primary zero-op apply and post-apply guard, then awaits a REAL deferred removal commit.
  Switch accounts immediately after that commit ACK. The new sidecar remains untouched with the guard;
  removing ONLY the post-pull guard must corrupt its first-sync audit and fail the named assertion.
  Permit exactly that already-acknowledged old deferred removal in this variant, assert it actually
  committed, and restore the test-local wrapper in finally. No new production helper or floor increase.
- T-APP-S7-switch-last-push: switch during the only/final batch response. The old request may finish,
  but the new sidecar stays byte-equivalent in meaning, without an old-cycle syncedAt/pending stamp.
- T-APP-S7-switch-after-apply: switch immediately after an already-dispatched pull commit completes.
  A new sidecar with a held base/deferred-delete id must remain unchanged; the old cycle must not reload
  it and settle deferred baseDrops. The one legitimate old commit is allowed; no later new-user apply,
  sidecar cleanup, audit or push is allowed. Use existing fixture/temporary wrapper facilities, restored
  in finally. Each of these three boundary checks gets its own generated removal mutant and named
  assertion kill; retain all other guards during each kill proof.
- T-APP-S2-refresh-first-barrier: section20 specifies same-user replacement safety, same-fixture
  GET/audit/Add N recovery and two independent removal mutants.
- T-APP-M1-remote-delete: remote tombstone for an unedited synced scale is applied locally (closes the
  reviewer's gap and guards the happy path against over-blocking).
- T-APP-M1-delete-keeps-local: delete-account leaves every local scale.
- T-APP-M4-dropped: a `storage` event removing the sidecar while in a blocked mode drops sync state
  without error.
- T-PIN-matrix: section 4.3.
Mutants: token without `userId`; token without `collectionId`; `syncStartLock` called ungated; `syncActive` back to `savedMode !== "protected"`; remove the `syncStill` call between the token await and `planPush`;
remove it before `syncApply`; remove it before a batch fetch. Killers (N2): before-`planPush` by
T-APP-M8-flip-before-push (push-only cycle; flip inside the token-refresh response); before-`syncApply` by
T-APP-M8-flip-before-apply (pull returns rows with ops; flip during the pull fetch); before-batch by
T-APP-M8-flip-between-batches; token-without-`collectionId` by the new T-APP-M8-collection-swap (during the
pull fetch `applySavedSnapshot` installs an envelope with a new `collectionId`, as `reconcileSavedCollection`
does; mode and generation unchanged; the cycle must abort with no commit and no push); token-without-`userId`
by T-APP-S7-switch-mid-push (each test must exist and be named in the PR).

Dev, `tests/editor_model.test.js`: U2a-F3 (existing) is the failing-first test for finding 2.

## 6. Lane breakdown (serial; shared file `index.html`, so no parallel lanes)

Single branch `claude/login-sync-a2` in its existing worktree, NEW commits only (no amend, no force).
Lane E then lane C. Mirror to dev per procedure s8.

| Lane | Owns (exclusive) | Not owned | Acceptance | Verify (prefix every call `OPENCLAW_SESSION=1`) |
|---|---|---|---|---|
| E engine | `src/engine/sync.js`; engine region of `index.html` via `python3 tools/inline_engine.py` only; `tests/sync.test.js`; `tests/sync_model.js`; `tests/mutants/sync_*.patch`; `docs/ENGINE-SPEC.md` s20 (two rows, one stating that a voided base is a planning view only and is NOT dropped from the stored sidecar by `planPull`: the stale base lingers harmlessly, N4); the `tests/suite_health.py` row for `tests/sync.test.js` | all other `index.html`; `tools/sync/*`; schema | AC-E1 new S3-S5 tests fail at 6c960269 and pass after; AC-E2 no assertion in `tests/sync.test.js` changed and all pass; the only edits to existing tests are setup lines adding ids to `used`/`usedIds` (10 tests measured, N4); AC-E3 the five new engine mutants (usedIds filter in push, in pull, missing-usedIds default, alias lookup, planDeferred) killed by the named tests | `node --test tests/sync.test.js`; `python3 tools/inline_engine.py && python3 tools/validate.py` |
| C client | `index.html` sync region (app JS only, from `// Optional email-code sign-in` to `syncBoot`); `tests/app.test.js` (new describe plus section18 fixture/setup-only corrections; all existing assertions unchanged); `tools/sandbox.js` (additive `throwOnKeys` option only, N3); `tests/mutants/a2_sync_*.patch`; `tests/suite_health.py` row for `tests/app.test.js` (set from measured count) | engine region; e2e files; i18n; About copy | AC-C1 new S1/S2/S6/S7/S8 tests fail at their pre-fix source and pass after (section19 adds three regressions against 8833; happy-path controls may already pass E); AC-C2 whole `sync client` and `sync-apply` describes still pass; AC-C3 app mutants killed: gate, primary pre-apply/pre-plan/pre-batch guards, post-apply/post-pull/post-push identity checks, token userId/collectionId and ungated syncStartLock; AC-C4 reviewer repro (T-APP-M7-zero-tombstones) passes; AC-C5 section20 safety/recovery and both distinct named mutants pass | `node --test --test-name-pattern "sync store safety|sync client|sync-apply" tests/app.test.js`; `python3 tools/validate.py` |

Standing gates for both: tests written first and shown failing; CI `validate` at the exact pushed head is
the evidence (local runs are smoke); `tests/mutation_check.sh` not run in a background that anyone edits
beneath it; the PR is touched by the integrator only after the lane returns `pending-linear-writes`.

## 7. Nits triage

| Nit | Decision | Reason |
|---|---|---|
| PR base is main not the A1 branch | defer, no action | A1 is merged to dev (#999) and open on main (#1000); the A2 main branch already contains A1's commits; re-basing adds risk |
| lock held forever, no `ifAvailable` (bfcache) | defer | not data loss; changing lock semantics widens scope; check at DEV QA |
| no `navigator.locks` shows signed in | FIXED BY GATE | M10: no locks => session mode => S1 hides the row (T-APP-M10-no-locks) |
| About privacy copy English-only | defer, BLOCKS main merge of #1001 | needs the eight data/i18n tables; owner (CLAUDE.md i18n rule); separate small lane after this one passes, before the owner merges |
| delete-account with expired token says offline | defer | UX; no data risk |
| "Yes, add" in non-holder tab delays push | defer | no loss; holder pushes on next trigger |
| `syncApply` does not re-check sidecar before commit | IN SCOPE | S2 and S7 (same guard) |
| account switch mid-push sends old-user batches | IN SCOPE | S7 (same token includes userId) |
| holder token refresh may overwrite a newer same-user session | defer | auth, not store safety; own test and fix later |
| `reconcileSavedCollection` calls `syncChanged` unconditionally | no change | the cycle guard makes it harmless; covered by T-APP-M3-no-mass and the pin |
| test gaps: remote delete applied locally | IN SCOPE | T-APP-M1-remote-delete |
| test gaps: Add-N prompt shown/Yes/keeps after later pulls | defer | `localOnly` has engine tests (R1-8); add at DEV QA |
| test gap: 429 from verify endpoint | defer | existing test covers the auth endpoint 429; low risk |
| "two tabs: sign-out" e2e is one document | defer | e2e owner file untouched here; record for the Q lane |
| FLOOR for `app.test.js` on dev 1152 vs A2's 1221 | IN SCOPE (dev PR) | set the dev row from the measured dev count, not copied from main; section 8 |

## 8. DEV rebuild and exact-head CI procedure (owner-approved vehicle)

Current M candidate H is 555bac651869df7ecfbd280b958132b241e10ab4. Owner explicitly approved
ONE held main-target CI-only PR for exact D head; this grants no main merge. Current DEV8d08667a
is an ancestor of existing D7e3b356f, verified read-only. Never start D from origin/dev or reset
an existing worktree/branch: preserve ordinary fast-forward history from existing D.

1. Scheduling amendment independently READY: after fresh M code PASS at frozen H, isolated LOCAL
   D preparation may run while M CI is pending. Detached WT starts at7e3b356f and ordinarily merges H.
   Hold D publication until FULL M validate success and reviewer reads its final exact-H conclusion.
   If H changes/fails preserve prep, incorporate only corrected verified H by ordinary merge, refresh
   affected local evidence; no force/reset/amend. This changes scheduling, never a release gate.
2. Preserve generated-source rules; no app/engine conflict occurred in this preparation. Resolve only
   the floor table from D's own baseline: app1152, sync48 and its pgenv3 row. Measure final per-file counts,
   raise owned app/sync rows from actual output, retain every unrelated D floor. Do not copy M1280.
3. Add tests/e2e_sync.test.js to DIRECT_READERS in tests/editor_model.test.js, retain U2a-F3's assertion.
   In D WT run node --test tests/app.test.js; node --test tests/sync.test.js;
   node --test tests/editor_model.test.js; node --test tests/mutation_harness.test.js (full54);
   python3 -m unittest tests.test_suite_health;
   python3 tools/validate.py; git apply --check on EVERY remaining a2_/sync_ patch.
   Record actual executed/pass/fail/skip/cancel counts. No duplicate local ALLFILES/emit-js/full-Mac job.
4. Once M gates pass, commit/push ordinarily to existing claude/login-sync-a2-dev; verify local tip,
   actual1003 head and ONE held main-target CI ONLY / DO NOT MERGE vehicle all equal D_H. PRs say
   Refs TRI-28. Require FULL validate success at EXACT D_H on that vehicle: full JS/browser suites,
   suite-health and full mutation; inspect executed jobs, required counts/skips and artifacts.
   A doc-only or incomplete run is insufficient. No thresholds, required suites or timeout budgets waived.
5. Fresh independent D reviewer at verified D_H reads that exact CI conclusion and checks integration
   against actual DEV base, client identity, generated source, tests, floors and retained editor behavior.
   Any change requires new exact-head CI/review. Both M and CI-only vehicle stay unmerged into main.
6. Re-read actual DEV/head and ancestry immediately before integration. If it moved, ordinary-merge it,
   refresh checks, CI and review. Require not CONFLICTING, then gh pr merge 1003 --merge, no branch deletion.
   Verify merge tree equals reviewed D tree, actual served DEV revision/content and affected journeys
   under serialized browser lease/runbook. Only then notify owner LOGIN RC QA ready, editor QA later;
   never include a main-merge request in that ready ping. Owner device QA is not automated evidence.
7. CI-only vehicle may close UNMERGED after all gates and DEV integration; retain its branch, which
   remains unmerged into main. No close of994; no production credential, deploy command or migration.

## 9. Findings beyond the reviewer's two (summary)

1. Same inference on pull: `planPull` "remote live, no local, base present => local deleted" (S4).
2. Session-mode PULL-APPLY (M4/M5): scales go to memory, sidecar cursor advances, reload empties memory,
   next push tombstones them. Reachable without protected mode at all (IndexedDB blocked, private window).
3. Store replaced under a live sidecar (M2): IndexedDB evicted while localStorage keeps `hpfc.sync.v1`.
4. Time-of-check: `syncActive` is read once at cycle start but the cycle awaits network before `planPush`
   (M8); a temporary-use click mid-cycle defeats a start-only gate.
5. Lock hand-off: a tab in M5/M7 inherits the lock when the durable holder closes.
6. `syncApply` and the push loop do not re-read the sidecar `userId` (S7 nits).
7. M9 `starting` with a partial `savedState` passes today's gate.

## 10. Risks, recovery, review, continuation, stop

Risks.
- R1 over-blocking: durable-only means private-window and no-locks users cannot sync. Accepted: their
  memory-only store is lost on close, so a synced copy would be stale on reload (see owner question O1).
- R2 `usedIds` voiding a base entry wrongly (a pulled insert not yet in `usedInstanceIds`): `sync-apply`
  insert pushes the id into `usedInstanceIds` in the same command (`next.usedInstanceIds.push(id)` /
  `usedInstanceIds.includes(op.id)` check); T-ENG-model and T-APP-M1-pull pin the round trip.
- R3 a guard added without a failing test: forbidden by the ordering in section 6.
- R4 third review fail of this lane or of the dev merge: stop bouncing; per CLAUDE.md AFK rule design an
  investigating prompt and a subplan to a 10/10 bar before resuming.

Recovery.
- Code: revert by new commits on `claude/login-sync-a2` (`claude/dev-revert-login-sync-a2` on dev); no
  force-push, no reset. Sync stays dev-host-only (`SYNC_ORIGINS`), so no prod user is exposed.
- Data if a tombstone ever escapes: server rows keep bodies 30 days and `scale_history`; run the
  "Mass tombstone, within 30 days" SQL in `tools/sync/schema.sql` (owner-run, gated).

Reviewer brief (per memory `reviewer-brief-quotes-plan-verbatim`): paste section 6's acceptance rows and
section 2's invariants unchanged; no added rules, no conditional criteria, no nit-fixing before the final
review; brief states branch, base, verified head SHA, ownership, and that CI at that SHA is the evidence.
Reviewer is a fresh independent context applying the installed review contract read-and-report only;
no unavailable model tier or native slash invocation is claimed. FAIL needs a concrete scenario.

Exact-head CI evidence required: successful FULL validate on M at H AND on the owner-approved
CI-only vehicle at D_H, plus fresh independent review at each verified head reading its exact CI
conclusion. Local selected checks supplement these gates. Served DEV evidence follows integration.
Installed review contracts are applied by fresh Codex contexts read/report only; no native Claude
invocation or unavailable named-model tier is claimed. Section21 is the operative acceptance contract.

Continuation: local D preparation from7e3 merging frozen H, then measured checks; publication waits
for M gates. Stop after gated DEV integration/served checks and owner login QA notification; await actual
owner QA before editor baseline QA. M stays held; About privacy localization in all8tables and production
email setup remain later prerequisites (email after DEV QA). Never enable prod or touch schema.

## 11. Open questions for the owner (genuine trade-offs)

- O1 (AFK auto-decision, recommended option, reversible: loosening S1 later is a one-line gate change) Durable-only sync vs also syncing in a session-mode tab whose content was read from a
  real snapshot. Durable-only is safer and the plan assumes it; the cost is no sync in private windows.
- O2 (note only, no decision) Deleting every scale through "reset" then a push propagates the deletes (D3, unchanged). If you want
  reset to require its own confirmation before it can tombstone an account, that is a new UI decision, not
  in this lane.

Accepted consequence (R10): a signed-in tab that is session or protected hides the sign-in row, so it loses
the sign-out and delete-account controls until it is durable; a sidecar drop from another tab still works.

## 12. Rubric and self-score (my score, NOT independent review; `/plan-eng-review` runs next)

| # | Criterion | 10/10 means |
|---|---|---|
| Q1 | Every push and apply path enumerated | triggers, store states and cross-cutting conditions listed from reading the code, with coverage today |
| Q2 | Each invariant has a failing-first test | S1-S8 each map to a named test and a mutant |
| Q3 | No schema change | bound lives in client and engine; server limits checked and stated |
| Q4 | Dev suite gate | finding 2 reproduced, fix, the exact commands, floors measured |
| Q5 | Scope bounded | every nit decided with a reason; non-goals explicit; no new UI or i18n |
| Q6 | Recovery stated | code revert, data SQL, third-failure rule |
| Q7 | Continuation point exact | head SHA, branch, first action, stop condition |
| Q8 | Cause explains both lanes | one invariant, why tests missed it, why the fix is not another per-path guard |

Draft 1 scores: Q1 6 (listed only the reviewer's two paths and pull side missing), Q2 6 (guard tests
stated once at cycle start), Q3 9, Q4 7 (no floor procedure), Q5 8, Q6 7 (no third-failure rule),
Q7 8, Q8 7 (did not tie to A1).
Revisions made: added the pull-side inference and S4; added the mid-cycle time-of-check (M8, S2) after
noticing the gate is read once but the cycle awaits; added M2/M4 (store replaced, session pull-apply)
found by tracing where `savedState` is replaced; added the S8 pin and the A1 tie-in; added floors measured
on the merge worktree; added R4 and recovery; made the matrix cells name tests.
Final scores: Q1 9, Q2 9, Q3 10, Q4 9, Q5 9, Q6 9, Q7 10, Q8 9.
Known soft spots to attack in review: `trustedBase` semantics for aliased revive ids; whether `reset`
keeps `usedInstanceIds` (stated as a test to write, not assumed); whether the harness can inject a
mid-cycle mode flip without a new helper (lane C may need an additive test helper in `app.test.js`).

## 13. Independent /plan-eng-review log (2026-11-09, report-only reviewer, verified at 6c960269 / 7e3b356f)

Verdict: NOT READY. The cause analysis, the state matrix and the `trustedBase` design hold up; six plan
defects must be fixed before dispatch. No owner decision is needed to fix them.

Verified correct: the four `savedMode` literals (`starting`, `durable`, `session`, `protected`; assigned only
at the let, `savedProtect`, `initializeSavedSession`, the boot adoption, and `#saved-temporary-use`); only
`syncApply` commits `sync-apply`; only `syncPush` calls `push_scales`; `syncActive` has three readers;
`usedInstanceIds` is append-only by `savedEnvelopeShape` (ordinal and index checks) and `reset` leaves it
untouched (it filters `entries`, `slots`, `hidden` only), so a reset still tombstones; the M7 envelope has no
`migration.temporary` flag (only the two boot branches set it), so S1 rests on `savedMode === "durable"`,
the flag test is redundant but harmless; `app.get(...)` can drive a mid-cycle flip, no new helper is needed.

Findings.
- R1 HIGH. Section 8 step 1 builds the dev merge from `origin/dev`, then step 5 pushes to
  `claude/login-sync-a2-dev`. `7e3b356f` is not an ancestor of `origin/dev` (dev is 8d08667a), so that push is
  non-fast-forward and invites a force-push. Fix: worktree at the existing #1003 head (`7e3b356f`), merge the
  new M head H into it, then add the DIRECT_READERS commit.
- R2 HIGH. Section 5 says "no existing test edited" and AC-E2 says existing sync tests pass, but S5 makes a
  missing or empty `usedIds` void every base. Measured with a prototype of the section 4.1 filter at
  6c960269: 20 of 170 tests in `tests/sync.test.js` fail (race matrix x8, settle x9, "local delete not yet
  pushed", "remote tombstone with no local copy", settlePush refusals), because fixtures such as the helper
  with `usedIds: []` do not list the ids they use. App `sync` tests (52) stay green. Fix: state that the
  shared ctx helper and fixtures are edited to derive `usedIds` from local and base ids, make that an
  explicit lane E deliverable, and make AC-E2 "all pre-existing assertions unchanged, only fixture ctx
  changed".
- R3 MEDIUM. S4 and T-APP-M2-pull overstate recovery. `syncRemotePages` fetches only `rev > cursor`; after a
  store is replaced the cursor is intact, so rows at or below it never return and the device stays empty
  (safe, but not "inserts the three remote scales"). Fix: the M2 pull test must put the rows above the
  cursor, and the plan must say plainly that restoring an evicted store is out of scope (or reset the cursor
  and base on a collectionId change, an additive sidecar field, as a separate decision).
- R4 MEDIUM. The syncStill-then-`commitSaved` gap is not closed: `commitSavedDurable` awaits the database and
  the lock after the check. `syncApply` passes `savedState.collectionId` read at call time, so the existing
  epoch check at `applySavedCommand` is vacuous against the cycle. Fix: pass the collectionId captured in the
  cycle token in the command so the check runs inside the transaction; state the sign-out residual (one
  in-flight commit) instead of "no commit".
- R5 MEDIUM. `syncStartLock` stays unchanged, so a protected, temporary or session tab can take the
  `hpfc.sync` lock and starve the durable tabs of sync until it closes (the plan names the hand-off path but
  only gates the cycle). Fix: call `syncStartLock` only when `syncActive()`; add a test that a dead-mode tab
  does not become holder.
- R6 MEDIUM. T-APP-M5 setup ("IndexedDB unavailable") does not reach the temporary-envelope branches: those
  run when `localStorage.getItem(SAVED_KEY)` throws or the legacy stage fails with access unknown, and with a
  throwing `localStorage` the sidecar cannot be read either. IDB-unavailable lands in the M4 path. Fix: make
  the fixture throw for the saved keys only and let `hpfc.sync.v1` read, or fold M5 into M4 and say so.
- R7 MEDIUM. Mutant plan gaps. Tests without a killing mutant: T-ENG-S3-alias, T-ENG-S4-deferred, the
  userId part of the token (S7), M10, M3. Add: alias lookup ignored, `planDeferred` unfiltered, token
  without userId, token without collectionId. The plan states no per-lane cap; every patch needs
  `# kills:` and `# suite:` headers (node patterns word-split, spaces written as `.`), no `index` lines, and
  a kill by the named test. Add `git apply --check` of every a2 and new sync patch in the dev merge worktree
  (CI never runs mutation on dev). The README count is a 90% band, so lane E need not own README.md.
- R8 LOW. `trustedBase` should hold a base if any alias key for the rid, or the rid itself, is in `usedIds`
  (a revive leaves two keys, L1 and L2, for one rid); add a two-alias test. It should also leave a base alone
  when a live local entry already proves it. With `usedIds` absent a pull voids aliases and can insert a
  duplicate copy (not a loss; production `syncCtx` always supplies it).
- R9 LOW. At lane E's head T-APP-M7 would already see zero tombstones (empty temporary `usedInstanceIds`);
  assert both no tombstone and no `push_scales` call so it still fails first for the S1 gate at E's head.
- R10 LOW. Signed-in session or protected tabs lose sign-out and delete-account controls (row hidden);
  record it as accepted.

Owner questions. O1 is a product default, not a blocker: record the recommended durable-only choice as an
AFK auto-decision. O2 is not a trade-off in this lane (reset-propagates-deletes is the parent plan's D3);
drop it to a note. Nothing here needs the owner before dispatch.

## 14. Revision log after the independent review (2026-11-09)

Applied: R1 section 8 step 1 starts at `7e3b356f`, merges H, then the DIRECT_READERS commit, no force-push.
R2 lane E owns the ctx/fixture update (section 5, AC-E2 reworded). R3 M2 pull test rows above the cursor;
eviction restore stated out of scope (4.1 scope note). R4 cycle-token `collectionId` passed into
`sync-apply`; in-flight commit residual stated (4.2). R5 `syncStartLock` gated by `syncActive()` plus test.
R6 M5 fixture throws on saved keys only. R7 added mutants (alias, planDeferred, token userId, token
collectionId, ungated lock), header rules, `git apply --check` in the dev gate, README dropped from lane E.
R8 `trustedBase` holds on any alias key or live proof; two-alias test. R9 M7 asserts no push call too.
R10 recorded as accepted. O1 recorded as AFK auto-decision; O2 a note.
Note: the section 4.2 S1 rationale that `migration.temporary` may be redundant for M7 is accepted (harmless).
Re-score (mine, not independent): Q1 9, Q2 10, Q3 10, Q4 10, Q5 9, Q6 9, Q7 10, Q8 9. Needs a fresh
independent re-review before dispatch.

## 15. Independent re-review log (2026-11-09, second reviewer, verified at 6c960269 / 7e3b356f)

Verdict: NOT READY, on text defects only. The design (trustedBase, cycle token, captured collectionId, gated
`syncStartLock`) holds and cannot lose data; R1-R10 are all present in the plan body. Six spec fixes, one pass,
no owner decision.

R1-R10 in the body: R1 yes (7e3b356f is not an ancestor of origin/dev 8d08667a; step 1 starts at it). R2 yes
but see N4. R3 yes (`syncRemotePages` fetches `rev > cursor`). R4 yes (`applySavedCommand` checks
`command.collectionId`; `syncApply` passes `savedState.collectionId` read at call time today). R5 yes
(`syncBoot` runs after `savedReady`, so gating on `syncActive()` at boot is safe). R6 see N3. R7 partly, see N2
and N5. R8 yes in 4.1, contradicted in section 5, see N1. R9, R10 yes. U2a-F3 reproduced at 7e3b356f: fails on
exactly `tests/e2e_sync.test.js` and nothing else.

New findings.
- N1 MEDIUM. 4.1 holds a base if the rid itself OR any alias key is in `usedIds`; T-ENG-S3-alias says
  "contains R not L: none" (no tombstone), T-ENG-S8-two-alias agrees with 4.1. Contradiction. Decide: fail
  closed (for an aliased rid require an alias key in `usedIds`; the rid alone does not hold) and fix 4.1, or
  fix the test.
- N2 MEDIUM. The "remove syncStill before planPush" mutant is likely unkillable. In a pull cycle the earlier
  check before `syncApply` aborts first; a push-only cycle has no await before `planPush`; the conflict loop
  (`syncPush` -> `syncPull` -> `continue`) is also aborted by the pull check. Specify placement so each check
  is distinguishable (the pull check only before a commit with ops, and a test flipping during a zero-row pull
  fetch), or drop that mutant. Same for the `collectionId` token mutant: M8 flips via the retire path, which
  bumps the generation, so the collectionId component has no named killer; add a mid-cycle collection swap
  test (reconcile replacing `savedState` with a new collectionId).
- N3 MEDIUM. T-APP-M5 needs a localStorage that throws for the saved keys only; `tools/sandbox.js`
  `throwOnStorage` throws for every key (including `hpfc.sync.v1`) and no per-key option exists. Add an
  additive sandbox option and name `tools/sandbox.js` in lane C ownership, or assert M5 through a different
  route. Also assert in the test which branch ran (`savedMode`, `migration.temporary`).
- N4 LOW. AC-E2 / section 5 say the only existing-test edit is the shared ctx helper. Measured with a
  prototype that includes the live-proof clause: 10 of 170 fail, not 20, and several set `dev.sidecar.base`
  inline in the test body (`a remote tombstone with no local copy ... drops a stale base`, `a local delete not
  yet pushed`, `settlePush records refusals`) plus describe-local `ctx = () => ({ usedIds: [] })` blocks. Reword:
  setup lines that add ids to `used`/`usedIds` only, no assertion changed. Note the voided base is not dropped by
  `planPull` (stale base lingers harmlessly; document it in ENGINE-SPEC s20).
- N5 LOW. `syncStoreToken()` must be non-null when signed out (sidecar absent), or `syncPaint` hides the
  sign-in form for everyone; write `userId || ""`. 4.3 says `syncApply(` "has exactly the call sites listed" but
  none are listed: state the count (definition plus two calls in `syncPull`).
- N6 LOW. Section 5 line 2 wording "no existing test edited" still contradicts the fixture edit; align with N4.

Not affected by owner decision: O1 (durable-only) stays an AFK auto-decision; O2 stays a note.

## 16. Revision log after the second review (2026-11-09)

N1 alias rule fail-closed in 4.1 and T-ENG-S3-alias agrees. N2 check placement fixed (pull check only before an
ops-bearing apply; token awaited before `planPush`), each syncStill mutant has a named killer, plus new
T-APP-M8-collection-swap for the collectionId token mutant. N3 additive `throwOnKeys` in `tools/sandbox.js`
named in lane C ownership; M5 test asserts the branch taken. N4 AC-E2 reworded (10 tests, setup lines only,
inline `dev.sidecar.base` and describe-local blocks listed; ENGINE-SPEC voided-base note). N5 token uses
`userId || ""`; `syncApply(` count stated (three). N6 section 5 wording aligned. Self-score unchanged (not
independent review); a fresh `/plan-eng-review` is still required before dispatch.


## 17. Third-failure regroup: distinguish the before-planning boundary (2026-11-09)

Owner authorized one quick fresh re-check. Its verdict was NOT_READY on one remaining N2 test-contract
issue; N1 and N3-N6, the collection-swap test and the fast-forward dev rebuild were confirmed. This is a
plan-text gap, not a newly reproduced runtime defect. No application code was changed or lane dispatched.
Exact-head evidence: #1001 is 6c960269717acb63f5d6e18621eacdf2151f5fc1; validate 42578699994 completed
success there. #1003 remains 7e3b356fb8052b09f127caae44b38c7b086f6791; no dev CI conclusion is claimed.

### Investigating prompt (bounded, revised and executed)

Investigate why the N2 named mutant can survive the stated assertions. Compare the correct path with a
single-guard mutant while keeping all other guards intact. Use section 4.2 S2, section 5's test/mutant
contract, AC-C3, the fresh reviewer scenario, and the existing test-local `settlePull` wrapper as the five
reference artifacts. Draft the smallest proof-contract correction. Preserve the existing safety design,
E-then-C order, all quality gates and scope; no new API, helper framework, runtime feature or benchmark.
Challenge the correction for false green (a later guard masks the removed one), false red (the counter
never observed the real boundary), test leakage and an impossible harness hook. Require independent
engineering review before execution. Do not restart the earlier full investigation.

Prompt quality rubric: distinguishes the intended boundary; has a positive control; uses an existing
hook; preserves later guards; restores instrumentation; adds no infrastructure; preserves all existing
acceptance and merge gates. All must hold; no numerical score substitutes for evidence.

### Resulting focused subplan

Cause: the original no-request/no-commit assertion observes an outcome protected by BOTH the planning
and batch guards. It therefore cannot prove the earlier boundary required by S2.

1. Root owns this plan-text correction only: section 5 now requires a test-local planner counter, a
   durable/no-flip positive control and restoration in `finally`. The existing app test already wraps
   `HPE.sync.settlePull` through `app.run`; `HPE.sync.planPush` is exposed on the same object.
2. A fresh independent reviewer checks only this correction and its consistency with S2/AC-C3. One
   bounded pass. If NOT_READY again, hold implementation and report the exact gap; do not bounce on.
3. On READY, lane E executes its existing tests-first engine ownership on the verified main-PR head;
   lane C follows at E's green/reviewed head. C implements the section 5 counter/control as part of its
   already-owned tests, not as a separate infrastructure lane. Its guard-removal mutant must fail the
   planner assertion specifically, with the later batch guard left intact.
4. Retain the existing exact-head CI, full mutation and fresh code-review gates. Rebuild #1003 from its
   existing head by new merge/ordinary commits; never force-push. Owner main consent remains absent.

Acceptance: clean/no-flip control sees planner activity; the injected mode flip sees none; removing only
its guard causes the named assertion to fail; zero pushes/commits still hold; instrumentation is restored;
no production helper or public API is added. Rollback is a new commit restoring owned test/code changes;
never weaken S2 or AC-C3, reset shared branches or discard the original untracked plan.

Status: focused correction independently READY (2026-11-09, fresh report-only engineering reviewer; no findings). The original canonical
untracked document is preserved unchanged; this worktree copy is the proposed next plan revision.


Focused independent review receipt: verified dynamic planner lookup and the existing writable `HPE.sync`
wrapper hook; the positive control and single-guard kill assertion distinguish the required boundary.
Reviewer independently read validate42578699994 success at 6c960269. This was a report-only application
of installed plan-eng-review instructions; no actual Claude slash-command or Opus invocation is claimed.
No implementation or mutant result is claimed by this plan review. Execution is now E then C under the
existing AFK grant; all final code/CI/review/dev gates remain required.


## 18. Client fixture amendment — small-task reviewed-plan (2026-11-09)

Finding: the pre-existing sync-client success fixtures call `boot({locks:true})` without IndexedDB,
so they run session mode. S1 now correctly blocks them, making their existing holder waits and success
assertions impossible. This is a fixture mismatch, not permission to weaken S1 or change assertions.

Bounded plan: C may add `indexedDB:true` ONLY to pre-existing sync-client success setups intended to
exercise active sync. Use synchronous `boot({...existingOptions,indexedDB:true})`, install the fetch stub
IMMEDIATELY, then await existing readiness/holder/cycle. Do not call `await durableBoot()` then install:
that helper waits for booted and can permit initial sync before the stub exists. No live Supabase calls,
new helper framework, global boot defaults or negative fixture changes. The existing synced-delete
setup calls `commitSavedSession`, which rejects durable mode: use awaited `commitSaved` there, preserving
the same command and every following assertion. Keep all intentional session/protected/no-lock tests
unchanged; new M4/M5/M7 tests still prove those states refuse sync.

C owns these setup-only hunks in its already-owned app test file. Existing assertion lines must remain
unchanged and will be checked independently. AC-C2, targeted sync/sync-apply tests, full app measurement,
generated mutant proofs, exact-head full CI, fresh code review and later DEV rebuild gates all remain.

Independent small-task engineering review: READY with the stub-before-startup ordering constraint above.
Source inspection confirmed crypto remains provided, IndexedDB plus locks enables durable initialization,
and commitSavedSession rejects durable stores. No product decision, UI change or new infrastructure.
Root accepted the recommended reversible setup correction under AFK; no extra owner approval is needed.
If a setup cannot be corrected without changing an assertion or its intentional negative mode, stop and
return that specific case to root instead of broadening this permission. Recovery uses a new scoped
commit; original fixture/assertion evidence remains in the E head.


## 19. Completed-phase identity correction — small-task reviewed-plan (2026-11-09)

Fresh client review at8833ff0cf7adb156c0468987624a8f69bb1242c3 returned FAIL on a concrete S2/S7
metadata violation: an old-user empty pull changed a replacement account's first-sync audit without
fetching that account. Its new first flag became false and localOnly was populated. No scale loss was
reproduced. The author wrote the new named regression first and observed the expected RED.

Bounded existing-fixture probes found two analogous completion boundaries: the last push response could
stamp syncedAt on the replacement account, and a user switch after an already-dispatched pull commit
could let deferred cleanup remove the replacement sidecar's base/deferred entries. These are the same
old-cycle authority contract, not new auth features. No broader account redesign is included.

Reviewed minimal plan: add the three unconditional completion checks specified in4.2; remove the dominated
pre-deferred check; add the three named failing-first cases in5 and three generated named-kill mutants.
Only C's existing source/test/floor/mutant ownership is used. Existing pre-apply/pre-plan/pre-batch guards
remain. Existing assertion lines remain unchanged; update only C's new caller pin to account for the
changed guarded boundaries and measure the app floor rather than guessing it. Source rollback remains
ordinary new commits, never reset or amend.

Independent small-task plan review: READY for these three checks with distinct regression/mutant proofs.
No design review or owner decision is needed: no UI, product trade-off or infrastructure changes. All
scope, exact-final-head full CI and fresh code-review gates remain. Do not claim8833 is ready merely if
its older CI later passes; its code review failed. Push the corrected candidate ordinarily, then obtain
new CI/review evidence for that new SHA before the DEV rebuild. No main merge, deploy or migration.


Section19 proof refinement, independently READY: the original empty-GET switch is preserved, but is
caught by the earlier post-apply guard once all fixes are present, so it cannot alone kill a removed
post-pull check. The added real-deferred-ACK timing variant above reaches the later boundary without
weakening any guard or assertion. This is an existing-fixture test correction only; production bytes
and plan scope are unchanged. Clean baseline and the exact named removal-mutant kill remain required.


## 20. Third client-review regroup — first-pull barrier (2026-11-09)

Mode: plan; AFK armed; implementation held pending fresh independent engineering review.
Verified source HEAD `58cd45f0173c7c7b1ffcb0303508e619e59faf19`: root reports validate still in
progress and third code-review FAIL; this head is NOT ready even if its CI later passes. Nothing
has landed on DEV. This section supersedes old pickup/status text without discarding history.

Cause/evidence: `syncPush` checks first BEFORE awaiting `syncToken`, then uses pre-await sc.
`syncSubmit` creates first:true/empty-base even for the same user; `syncToken` calls
`syncPatch(userId, cur => syncSession(cur,...))`, preserving the replacement first flag. User/store
token equality therefore cannot establish current sc. Root's fresh runtime review reproduced old-base
R tombstone before GET and verified a reload/first-check control; source inspection here confirms
that mechanism, not a new runtime run. Existing app first-sync test requires GET before push;
engine `firstSyncAudit` holds unmatched locals until `releaseLocal`; `T-ENG-S3-held-delete` preserves
intentional post-sync deletion. Prior tests missed the same-user first-state axis across refresh.

Smallest fix: C reloads sc AFTER token await/existing `syncStill`, then repeats `!sc || sc.first`
early return false BEFORE `syncLocal`/`planPush`; keep initial cheap first check and all other guards.
Forced GET on every push adds unnecessary network/behavior; a nonce adds persisted lifecycle work.
Neither is needed. Do not address the separately deferred refresh-credential overwrite.

Frozen rubric (evidence-qualified pass/fail, no numerical score): correct cause; no old-base tombstone;
no unmatched push before replacement pull/choice; SAME fixture completes GET -> audit -> Add N -> Q
push while R survives; ordinary sync/delete preserved; minimal C-only runtime change; RED/GREEN and
discriminating mutants; no infrastructure; exact-head CI/fresh review; practical D continuation; honest
residuals. Source feasibility passes self-check; runtime proof and independent review PENDING.

1. **C prerequisites/ownership:** independent plan review READY, verified starting head, existing isolated
   lane tree. Existing C row only: app sync region, additive app test, measured app floor and a2_sync
   mutants; no sandbox change needed. No engine/schema/server/UI/copy/browser/script/global-config changes.
   Design review unnecessary: no interaction change. Preserve all old assertions/negative fixtures.
2. **TDD:** add one `T-APP-S2-refresh-first-barrier` in existing durable IDB fixture, stub installed before
   startup. Normally sync R (stub retains live server row); create DISTINCT unmatched local Q without
   firing debounce, delete local R with awaited `commitSaved` (R remains used), expire access token and
   reset observations. Invoke push-only `syncKick(false)`; refresh hook replaces sidecar with SAME user,
   first:true, cursor:0, empty base/alias/localOnly; store authority unchanged. Assert zero GET and zero
   push requests, replacement first/base unaudited, remote R live and durable Q retained. Continue THIS
   app with `syncKick(true)`: GET restores R, first audit holds Q in localOnly, no Q push. Exercise existing
   `syncAskAnswer(true)`/Add N and await running cycle: permitted Q push follows GET/choice, R remains
   locally and remotely live. Model stub acknowledgments/remote rows using existing fixture conventions;
   no real Supabase/new harness. Restore hooks/wrappers in finally. Aborted push may await next ordinary
   pull trigger; no new automatic retry contract. Existing first-sync/save/synced-delete and engine
   held-delete tests remain unchanged controls.
3. **Exact commands** (prefix C calls `OPENCLAW_SESSION=1`, record actual selections/failures):
   `node --test --test-name-pattern='T-APP-S2-refresh-first-barrier' tests/app.test.js` executes ONE new
   regression RED at58cd before source change, GREEN after. Then
   `node --test --test-name-pattern='sync store safety|sync client|sync-apply' tests/app.test.js` and
   `node --test --test-name-pattern='T-ENG-S3-held-delete' tests/sync.test.js` pass with nonzero selection.
   Measure `node --test --test-reporter=tap tests/app.test.js`; raise ONLY its floor from actual output
   (current1243; one addition predicts1244, prediction is not evidence). Generate
   `a2_sync_after_refresh_reload.patch` omitting ONLY new reload, first guard intact: named regression
   fails on old-base R tombstone. Generate `a2_sync_after_refresh_first.patch` removing ONLY new first
   guard, reload intact: same regression fails on premature live Q push. Generated git diff/no index
   lines, exact `# kills:` title and existing header word-split pattern rules apply. Run
   `MUTANT_LIST=<scratch>/first-barrier-mutants.txt ./tests/mutation_check.sh` with these two basenames;
   clean baseline passes and each named assertion kills with every other guard intact. Preserve all13
   prior C safety mutant kills and all49 existing a2_/sync_ patch applications. Check each with
   `git apply --check <patch>`; C reanchors only owned context drift via generated diff without weakening
   kills; engine-owned drift returns to root. Full final-head mutation/CI remains required. Never run
   mutation beneath concurrent edits.
4. **Delivery:** root verifies actual1001 head equals clean local H; full Linux validate success and fresh
   report-only exact-H review address this scenario/all acceptance rows. D rebuild follows section8,
   ordinary commits from existing1003 head. Owner approved ONE held main-target CI-only PR from EXACT
   rebuilt D branch/head: full validate at D SHA plus fresh D-head review before DEV integration; neither
   main-target PR merges. Latest independently reviewed D verification placement under AFK: local `node --test tests/app.test.js`,
   `node --test tests/sync.test.js` measured counts; retain `node --test tests/editor_model.test.js`
   (U2a-F3), `python3 -m unittest tests.test_suite_health`, `python3 tools/validate.py` and ALL applicable
   a2/sync patch apply checks before final D push. Replace local ALLFILES/emit-js with authoritative FULL
   D-head CI (full JS/e2e/suite-health/mutation), inspect required counts/skips/artifacts without waivers.
   Root amends8/10 in D copy before push. No duplicate full Mac browser run/new harness. After integration,
   root verifies actual served DEV revision/affected behavior using runbook-selected titles/counts and
   serialized host lease; owner login QA remains human evidence.

Recovery/pickup: ordinary scoped revert commit; no reset/amend/force/main merge/deploy/migration/prod.
Retain already-dispatched transaction residual and below-cursor recovery exclusion (4.1/4.2), neither
newly proved here. Fixture is not native/served-browser evidence. Next: fresh independent engineering
review of20 and operative4.2/5/6; only READY unlocks C's RED at58cd. Material new product fork returns to
owner interview; first-sync/Add N contract is settled. Writer stops at plan, no source/tests/commits/push
or Linear writes. pending-linear-writes: [].


Section20 independent engineering review: READY (2026-11-09), no blocking findings. Reviewer verified
source cause, existing helpers/commands, minimal ownership, independent reload/first-barrier mutants,
same-fixture recovery and M/D exact-head gates. Q must be genuinely unmatched by meaning, not merely
another local id. The fresh first state aborts the current push (return false), rather than claiming
sync completion; the existing ordinary pull/choice flow resumes it. Runtime proof remains the fix lane's
work. Prompt critique and plan review were separate fresh non-author contexts using installed contracts;
no native Claude invocation, numerical perfection score or unexecuted runtime success is claimed.


## 21. Operation authority regroup — raw sidecar witness (2026-11-09)

Mode: plan; stop at proposed plan pending independent engineering review; AFK authorization does not
start implementation. This section replaces section20's isolated push fix and conflicting operative
client instructions in4.2/5/6/8/10; prior findings, history and dirty plans remain intact.
Recommended readiness: READY for independent review, not yet independently READY for execution.

### 21.1 Goal, evidence, scope

Requirement: one operation may use or settle only the sidecar state and durable-store authority it
witnessed, advanced solely by its own successful conditional sidecar writes. The operation must stop
before further planning, request dispatch, settlement, audit or status publication when that witness
fails. Preserve saved scales, first-pull/Add N choices and intentional synced deletion.

Verified source: immutable `/private/tmp/handpan-sync-regroup-review-20261109`, HEAD
`1356ac84bf7fc489c4ff9a64ee342536772341fa`. Read the whole sync region, ENGINE-SPEC20,
tests/CONTRACT.md and docs/testing/browser.md before execution. Root's fresh runtime FAIL is evidence
supplied to this planner, not a runtime run by this writer: same-UID first:true/cursor0/base{} reset
DURING GET gt10 is overwritten by old cursor10 settlement and first:false; live server R rev10 stays
absent. Reset BEFORE GET is the positive control and restores R. Section20 already reloads push state;
that does not protect zero-op pull settlement. UID equality identifies the account, not its state.

Source audit: refresh success/transient/terminal paths, every GET page, ops and zero-op pull settlement,
deferred/base-only cleanup, push final response/refusal/conflict, first audit/final status, and delayed
account-delete completion can publish obsolete work. Local saved-entry revisions are a different axis:
retain engine witnesses and committed/skipped arguments; do not invalidate on every ordinary local edit.

Non-goals: persisted fields, migrations, engine/planner changes, auth UX/copy/layout, production enablement,
new browser/sandbox/framework, frame timing/profiling/retry infrastructure, generic CI e2e diagnosis,
CLAUDE.md changes, credentials, main merges, deploys. Existing generation/collection guards remain.
Refresh changes guard completion authority only: endpoint, credential format, expiry, retry policy and
error classification stay unchanged. A need to change refresh policy is an owner fork, not this fix.

### 21.2 Smallest design and honest guarantee

Use a short-lived operation object, not a persisted sign-in generation: captured existing saved-store
 token, captured collectionId, exact raw SYNC_KEY string, and invalid flag. Capture raw and parse the
same bytes once; invalid/missing/unreadable sidecar or ineligible durable store cannot start sync.
Use one central current-operation predicate: not invalid, existing store token unchanged, and
`localStorage.getItem(SYNC_KEY) === expectedRaw`; read failure/mismatch permanently invalidates it.
Do not recapture a new expected raw on mismatch, even for the same UID or when later bytes match again.
The durable signed-out UI still uses syncActive/store eligibility; absence blocks operations, not sign-in.

All operation writes use ONE conditional helper, replacing UID-only asynchronous syncPatch uses:
check current; compute change from the witnessed parsed sidecar; serialize; recheck immediately before
setItem; on success advance expectedRaw centrally to exactly those written bytes and retain next parsed
state. Failed reads/writes/computation abort; never advance expectedRaw optimistically. A current check
before request/planning uses witnessed data, not a stale pre-await sidecar and not a newly adopted one.
Keep synchronous syncPatch(userId, change) compatible as a current-action wrapper that captures a
fresh scope immediately; asynchronous paths must use the captured-scope writer, never that wrapper.
Conditional removal uses the same scope rule; after success scope is invalid and only that authorized
completion may paint signed-out state. No async fallback may call unconditional syncDrop.

Compare alternative: a per-sign-in persisted ID distinguishes re-sign-ins but misses ordinary sidecar
replacement/cursor/base writes unless all writers maintain another revision. That expands schema and
writer lifecycle. In-memory sign-in IDs miss other tabs. Exact raw comparison covers existing fields
without changing engine/persistence and is the smaller choice for the observed histories. If implementer
finds extra coordination necessary, stop NOT READY with the concrete history/tradeoff; do not add it.

Guarantee is observational, not atomic cross-tab CAS: another tab can write between final getItem and
setItem; an unobserved byte-identical A→B→A is indistinguishable. Do not claim detection of all histories,
rollback, or absolute exclusion. An already-dispatched server request or store transaction can finish;
reject its obsolete ACK's sidecar/status effects and dispatch nothing further. Existing transaction
collectionId/revision checks still apply. Persistent generation/transaction protocols would be a separate
scope decision if stronger guarantees become required. This finite proof must not be advertised as them.

### 21.3 Propagation and action inventory

Pass the SAME scope through cycle→token/pages/pull/apply/push, including conflict pulls and attempts.
Direct test callers may capture a scope at entry; nested helpers never silently replace an invalid one.
Keep request bearer token separate from operation authority. Central successful writes advance the
same scope so refresh→pull→settle→audit→multi-batch push→final status remains live.

| Boundary | Required behavior |
|---|---|
| token | check before refresh dispatch and after response JSON; success conditional credentials, transient conditional pending/status, terminal conditional drop; stale branches do nothing |
| pages | check before every GET and after every awaited response; abandon accumulated rows on mismatch, including empty/final page; no later GET |
| pull | check before local/context reads and planPull, before each apply, after apply ACK and before planDeferred; an invalid apply result cannot be retried as a normal commit refusal |
| apply | check even for zero ops or baseDrops-only; captured collectionId in dispatched command; after commit ACK check before settlePull; preserve committed/skipped and do not rewrite current sidecar |
| push | current state and first barrier after token await; check before planPush, no-row pending clear, every batch dispatch and each ACK including final/failing ACK; check before settlePush/refusal messages/conflict pull |
| cycle | check before syncing publication, first audit/first:false, final pending/syncedAt and all cycle-owned status/paint; invalidation returns without final publication |
| delete-account | capture authority before dispatched deletion; success AND failure completion guarded; stale success cannot drop newer sign-in, stale failure cannot show its error; server deletion may already have completed |

Current synchronous sign-out remains intentional and immediately drops current session. Current Add N
still changes current sidecar and invokes existing syncKick(false); it invalidates older scopes, and the
queued new operation captures the updated state. Do not forbid explicit user choices because old work
is running. New sign-in intentionally replaces sidecar; old operations then fail their next check.

Liveness: no periodic retry exists. Storage events kick only when current first:true; ordinary sidecar
writes may abort without immediate replacement. Existing next triggers are visible-after60s pull,
sign-in/lock grant, queued kick, Add N or saved-change debounce. Preserve these, do not broaden them.
Prove ordinary-write abort then resume by dispatching the ACTUAL visibilitychange listener after advancing
the fixture clock beyond60s with holder/visible true; no direct syncKick substitute. Until that trigger,
pending work may wait. Continuous competing writes can starve an operation; do not promise otherwise.

### 21.4 File ownership, prerequisites and TDD handoff

Prerequisites for every lane: independent plan READY; integrator confirms exact starting head and dirty
paths, preserves unrelated work, creates separate git worktrees; no edits in immutable review checkout.
No parallel shared-file editors. Design review: not applicable, no UX/interaction change. Engineering
review uses installed plan-eng-review dimensions in a fresh read/report context; disclose contract-based
Codex fallback and never claim a native Claude skill invocation. Reviewer did not author prompt/plan/code.

1. Test lane owns ONLY tests/app.test.js in isolated WT based on1356. Extend existing durable-IDB
   `sync store safety` fixture using its hooks/real commitSaved and existing origin adapter; no helper
   file changes. Deliver additive named regressions, red output, test count and scenario→assertion map.
   Source interface-dependent structural pin may be adapted after agreed handoff: keep enumerated modes,
   destructive paths and all observable negative cases; replace literal storeToken-pattern assertions
   with the new scope boundary inventory, not a weaker count-only substitute. Preserve prior assertions.
2. Serial client lane owns ONLY index.html app sync region in its own WT after test handoff. Integrate
   test delta by ordinary commits when authorized, then implement central scope/write/drop and propagation.
   Deliver GREEN selected tests, finite-race residuals, and call-site inventory. Do not edit generated regions.
3. Root, after exclusive handoff, owns app floor, tests/mutants patches and operative plan documentation;
   may coordinate test-author pin adaptation, never edit app.test.js concurrently. Raise only measured app
   floor; generate mutant diffs from committed code (no blob index lines), retain old regression assertions.
   Root owns independent review/final gates and all integration. Commits/pushes use existing authorization.

Bounded scenario set (subcases in named tests, not a Cartesian product/new model):

| Named group | Failing-first/positive observations |
|---|---|
| T-APP-OS-refresh | sameUID reset, UID switch, removal injected at success/408-or429/terminal401 refresh completion; replacement raw bytes unchanged, no stale credentials/pending/drop/status; current controls refresh/pend/drop normally |
| T-APP-OS-get-reset | exact gt10 empty response reset-during repro; first/base/cursor unchanged, R server alive; same-app real next trigger GETgt0 restores R, audit holds distinct unmatched Q, Add N permits Q push; reset-before control restores R |
| T-APP-OS-pages | nonempty final response and 200-row intermediate page invalidations; no plan/commit/next page, replacement bytes/status untouched; ordinary unchanged paged pull settles every row |
| T-APP-OS-apply | invalidate during real primary and deferred commit ACK, plus zero-op and baseDrops-only settlement; store ACK may finish, no stale sidecar update/audit; collection/mode generation flip blocks subsequent work |
| T-APP-OS-push | invalidate at intermediate and final batch ACK, plus failed/refused response; no subsequent request/settlement/refusal/status; unchanged multi-batch control settles all ACKs |
| T-APP-OS-own-writes | refresh, pull settlement, first audit, push and status complete sequentially despite own changed bytes; ordinary local scale edit uses existing revision-skip reconciliation safely |
| T-APP-OS-liveness | ordinary other-tab sidecar write aborts; real delayed visibility event resumes; in-flight Add N still releases and existing queued/debounce flow pushes; no manufactured retry |
| T-APP-OS-delete | delayed success/failure after reset/switch/removal leaves newer sidecar/status; current delete success drops only session and keeps scales; synchronous signout remains effective |

Use reset/switch/removal across refresh branches; elsewhere select reset for sameUID vulnerability,
switch/removal for entry/exit coverage, avoiding redundant matrix growth. State precise required selected
counts after writing tests. Hooks must observe response/json/ACK boundaries and restore in finally.
Model server retains R and real ACKs; assert persisted origin state where store outcome matters, not
only savedState. Include intentional synced local deletion→server tombstone control (existing held-delete
engine test and app deletion test); temporary-mode controls remain intact.

### 21.5 Verification, mutants and stop/recovery

At test handoff and client completion run (record selected/executed/pass/fail/skip/cancel counts/logs):
`node --test --test-name-pattern='T-APP-OS-' tests/app.test.js` (RED1356 then GREEN).
`node --test --test-name-pattern='sync store safety|sync client|sync-apply' tests/app.test.js`.
`node --test tests/sync.test.js` (existing engine contract unchanged).
`node --test --test-reporter=tap tests/app.test.js` (measure actual floor, never predicted count).

Root names one mutant per independent protection: raw witness→UID-only; own-write expectedRaw not
advanced; refresh success/transient/terminal guards; per-page guard; pre-plan guard on empty GET;
post-commit settlement guard; zero-op/base-only settlement guard; intermediate/final push ACK guards;
first-audit/final-status guard; async-delete success/failure guards. For EACH, freeze named killing test
and exact assertion, inject change after earlier checks, show CLEAN header command green and mutant
assertion failure while OTHER guards remain. A later central guard masking an omission is not proof of
that omitted check: redesign the discriminating observation or consolidate genuinely redundant checks;
report the actual protected boundary. No syntax errors/timeouts/skips counted as kills.
Generate patches by git diff in disposable committed WT; `# kills:` and `# suite:` with dot-for-space
patterns. Preserve all applicable51 existing a2_/sync_ patches and15 prior C safety kills (recount actual
inventory; history counts are not current evidence); reanchor only with same named behavioral kills.
`git apply --check <patch>` for each; `MUTANT_LIST=<absolute-list> ./tests/mutation_check.sh` for targeted
proof. Full mutation coverage is authoritative in exact-head Linux CI; inspect all shard results
and executed inventories. Do not duplicate the full local browser/mutation workload. Reserve a
browser lease for any targeted mutant command that actually needs a browser.
Run `node --test tests/mutation_harness.test.js` in full whenever mutant metadata changes,
then `python3 -m unittest tests.test_suite_health` and `python3 tools/validate.py`.

M: verify local H equals PR1001 head; require successful FULL Linux validate at exact H
(`gh run list --commit H --workflow validate.yml`) plus fresh independent exact-H PASS, addressed
findings and final diff. Inspect required jobs/tests actually ran; skipped doc-only workflow is insufficient.
D: rebuild by ordinary merge of H FROM existing1003 head7e3b356f, never from origin/dev; retain dev-only
DIRECT_READERS correction, measure D floors, pass app/sync/editor_model tests, suite-health unit,
validate.py and every applicable mutant apply check. Root reconciles obsolete8/10 instructions in D copy.
Push ordinarily only after authorized checks. Owner approved ONE held main-target CI-only PR from
EXACT SAME D branch/head: require full exact-D validate and fresh D-head PASS before DEV PR merge,
not conflicting; no main-target PR merges. Any follow-up change resets exact-head CI/review gates.
Earlier generic e2e900s timeout cause remains UNKNOWN;58cd full validate42629450423 subsequently
passed all jobs.1356 CI pending cannot overrule its fresh review FAIL. No harness prerequisite, budget
waiver, new infrastructure or inferred PASS; any new exact-head failure must be classified honestly.
After DEV merge, serialize host browser access; run runbook-selected affected journeys with real selected
counts and verify actual served revision/content against merged source. Owner login QA remains required
human evidence; never fabricate it. Do not run duplicate full Mac browser jobs to replace Linux CI.

Frozen review rubric, each PASS/FAIL: correct cause; all async sinks; real-trigger liveness; smallest
change; durable-fixture RED/GREEN with discriminating mutants; honest finite residuals; precise file
handoffs; exact-head delivery gates/recovery. Recommended PASS for plan structure, runtime proof pending.
Open high/blocker from independent review means NOT READY and bounded amendment, not implementation.
Recovery: retain logs/failed scenario/head; adjust only owned code, rerun affected proof, fresh review.
Third same-approach review failure triggers regroup. Scoped ordinary revert commits only; no reset,
force/amend/no-verify/history deletion, no automatic data repair. Already accepted server/store work cannot
be rolled back by this client; any data repair is owner-gated. Preserve below-cursor eviction exclusion.
Continuation: independent reviewer checks this section against1356/source and supplied fresh FAIL;
only READY plus existing execution authorization unlocks test lane. Writer stops at scratch plan.
pending-linear-writes: [].


Independent engineering review: READY_WITH_NITS, contract-based read/report at exact1356ac84.
No blockers/high findings. N1 fixed: current baseline51applicable patches/15prior client kills,
recount and prove actual inventory. N2 fixed: targeted local kills plus mandatory full exact-head
CI mutation coverage, without a duplicate full local sweep. Explicit synchronous patch compatibility
retains current-action semantics; async paths retain their original scope. No native Claude invocation,
runtime proof, CI success or design review is claimed by this plan review.
AFK routine decision: use the recommended bounded contract review and existing-state witness baseline;
no persisted field, stronger atomicity promise or new owner product decision is introduced.


Section21 mutation consolidation clarification — independent engineering READY:
The51applicable patches/15prior client kills describe the starting1356 inventory, not an immutable
number after an architectural consolidation. Preserve EVERY prior behavioral regression and negative
assertion. Replace/retire an owned guard-omission mutant only with recorded evidence that the shared
witness subsumes that protection, a generated replacement mutant tied to the same behavior/assertion,
a clean passing baseline and actual assertion kill with all other protections intact. Several obsolete
guards protecting the same behavior may map to one central-witness mutant. No redundant guards or
artificial timing hooks just to retain a numerical count. All remaining applicable patches must apply
and kill; unrelated mutants stay unchanged. Syntax errors/timeouts/skips do not count. Full exact-head
CI and fresh independent review remain required. Root owns the explicit old→replacement evidence map.


Section21 execution checkpoint (source391db225, 2026-11-09):36new tests first produced25 assertion
RED/11controls GREEN, all1244prior app tests passed. Source uses syncScope/syncStill(scope),
syncWrite/syncRemove, synchronous current-action syncPatch wrapper. Store token now covers generation
and collection; the captured raw sidecar supplies account/state identity without a duplicate UID check.
After explicit visible-document initialization in two new clock fixtures and structural scope-pin
adaptation (every behavioral assertion retained), local fullapp1280/1280, scoped101/101, engine178/178,
zero skips/cancellations. App floor measured and raised1244→1280. Client173-line diff stays in app sync
region, no generated block/engine/schema/UI/key changes. Local Node25.8.1/Python3.9.6 is not CI parity.
No browser/native/served DEV proof claimed. Baseline1356 validate42634146666 completed success but
reviewFAIL still blocks it. Next: generated mutant consolidation/proof map, final candidate commit/push,
full exact-head Linux validate and fresh independent review; only then rebuilt DEV gates.


### Section21 generated mutant proof and current pickup

# TRI-28 operation-scope mutant proof

Source baseline: 4982bdb72a6a2cd537d296802254f362fb07d499 (source391db225 plus root pins/floor/docs). Dedicated WT /private/tmp/handpan-sync-scope-mutants-20261109; branch claude/sync-scope-mutants-20261109. No application/test/floor/harness/engine changes. No browser run, remote write or Linear write. Node local v25.8.1; Linux exact-head full validate/review remain integrator gates.

Inventory: starting51 =18a2 +33sync engine. Retire9 obsolete a2 guard/token-user mutants; add3 shared-protection mutants; retain9 other a2 (4 reanchored,5 byte unchanged). Result45 =12a2 +33sync; all45 `git apply --check` pass. The33 unrelated sync engine patches stay byte unchanged. Browser resend patch stays byte unchanged and applies, but is intentionally not executed locally; its kill requires full Linux CI.

Generated all new/reanchored bodies by transient exact string mutation of committed index.html and git diff, removing only blob index line; finally restored baseline source bytes. Generation script: /private/tmp/tri28-generate-mutants.py. No handwritten hunks. Every behavioral test and negative assertion is preserved byte-for-byte in tests/app.test.js.

Shared protection mutations: raw exact comparison -> true with store equality/invalid/boundary checks intact; store equality -> true with raw/invalid/boundary checks intact; remove only successful own-write expectedRaw advancement. No redundant source guards or timing hooks.

## Retired old -> replacement -> actual old named assertion failure

All old named tests below ACTUALLY FAIL in retained TAP under the corresponding replacement. These are not inferred from failure of a different new test. Several-to-one mapping follows independent READY clarification.

| Retired | Replacement | Actual failing old named test | Actual failed assertion |
|---|---|---|---|
| `a2_sync_after_apply_guard.patch` | `a2_sync_scope_raw_witness.patch` | `T-APP-S7-switch-after-apply` | old apply must not clean up the new account base or deferred deletes |
| `a2_sync_after_pull_guard.patch` | `a2_sync_scope_raw_witness.patch` | `T-APP-S7-switch-empty-pull` | old zero-row pull must not complete the new account's first sync |
| `a2_sync_after_push_guard.patch` | `a2_sync_scope_raw_witness.patch` | `T-APP-S7-switch-last-push` | old final push must not stamp the replacement account status |
| `a2_sync_after_refresh_first.patch` | `a2_sync_scope_raw_witness.patch` | `T-APP-S2-refresh-first-barrier` | refresh must not push an old-base R tombstone |
| `a2_sync_after_refresh_reload.patch` | `a2_sync_scope_raw_witness.patch` | `T-APP-S2-refresh-first-barrier` | refresh must not push an old-base R tombstone |
| `a2_sync_before_apply_guard.patch` | `a2_sync_scope_store_witness.patch` | `T-APP-M8-flip-before-apply` | no sync-apply after authority flip |
| `a2_sync_before_batch_guard.patch` | `a2_sync_scope_store_witness.patch` | `T-APP-M8-flip-between-batches` | only the first batch was dispatched |
| `a2_sync_before_plan_guard.patch` | `a2_sync_scope_store_witness.patch` | `T-APP-M8-flip-before-push` | no planner invocations after authority flip |
| `a2_sync_token_user.patch` | `a2_sync_scope_raw_witness.patch` | `T-APP-S7-switch-mid-push` | old user must not dispatch a later batch |

## Owned unit headers, clean then mutation

Counts are executed tests/pass/fail, excluding suite containers. Every run has required-skipped=0, cancelled=0. Every mutation has an ERR_ASSERTION; no syntax error/timeouts credited. Clean nonzero count verified before each mutation. Harness independently reports11/11 killed, rc0.

| Patch | Clean tests/pass/fail | Mutation tests/pass/fail |
|---|---|---|
| `a2_sync_429_not_mapped.patch` | 1/1/0 | 1/0/1 |
| `a2_sync_apply_failure_still_settles.patch` | 1/1/0 | 1/0/1 |
| `a2_sync_change_never_pushes.patch` | 1/1/0 | 1/0/1 |
| `a2_sync_scope_own_write_advance.patch` | 2/2/0 | 2/0/2 |
| `a2_sync_scope_raw_witness.patch` | 41/41/0 | 41/8/33 |
| `a2_sync_scope_store_witness.patch` | 39/39/0 | 39/36/3 |
| `a2_sync_settle_drops_skipped.patch` | 1/1/0 | 1/0/1 |
| `a2_sync_signout_keeps_sidecar.patch` | 1/1/0 | 1/0/1 |
| `a2_sync_store_gate.patch` | 1/1/0 | 1/0/1 |
| `a2_sync_token_collection.patch` | 1/1/0 | 1/0/1 |
| `a2_sync_ungated_lock.patch` | 1/1/0 | 1/0/1 |

Original broad manual proof selects5 old named tests plus36 new OS tests:41 clean pass;33 actual assertion failures including all5 old named tests,8 positive controls pass. Original broad store proof selects3 old named tests plus36 OS tests:39 clean pass;3 old named tests fail,36 OS tests pass. These passing OS tests do not prove the store equality protection; the three old named assertions do. Original broad own-write proof selects2 OS controls:2 clean pass, both fail when advancement is removed.

New OS coverage under raw mutant includes refresh200/408/429/401 reset/switch/removal, during gt10 reset, final and intermediate pages, primary/deferred ACK, final/intermediate/failed/refused push ACK, real visibility liveness, async delete success/failure reset/switch/removal, zero-op/baseDrops-only settlement and Add N queued operation. Current refresh branches, reset-before GET, unchanged pages, own-writes/current-delete controls remain green.

Reanchored apply-failure preserves scope check while converting only result.ok failure into empty-success settlement. Reanchored skipped removes only fourth settlePull argument. Storegate changes only temporary eligibility as before. Token-collection removes only collection identity from generation+collection token; account identity remains raw witness. All4 retain old header selectors and old named assertion kills.

Raw evidence:
- /private/tmp/tri28-mutant-harness.log (MUTANT_LIST absolute11-name list;11/11 kills; clean baselines)
- /private/tmp/tri28-owned-unit-list.txt
- /private/tmp/tri28-proof-mutants.py (full TAP capture, strict source restore in finally)
- /private/tmp/tri28-proof-progress.log
- /private/tmp/tri28-mutant-tap/report.json (each command, exit/counts/failing titles/log)
- /private/tmp/tri28-mutant-tap/<patch>.clean.tap and <patch>.mutant.tap

Old behaviors unmapped: none. Pending full CI: browser resend kill plus authoritative full corpus at final exact head; independent final review and DEV checks owned by integrator. pending-linear-writes: [].

Local mutant-only commit: ddafa976 (no push). Exact final head apply45/45, working tree clean; index.html exact baseline byte equality verified. Blob-header format test selected1/executed1/pass1, zero skips/cancel.

Next: final local validator/apply checks, ordinary final candidate push; full exact-head validate and fresh independent code review. No DEV rebuild until both pass.


### Section21 metadata repair receipt (after a064 full-CI failure)

Validate42641567851 failed ONLY header-selection lint in mutation_harness53/54. App1280/1280,
full genericbrowser643/643, syncbrowser10/10 andall4mutation shards passed. The three new central
mutant headers selected multiple tests/prose while the existing contract requires ONE exact test name.
Root had checked kills and patch format but missed full header lint locally.

Header-only fix8f0340cc (integrated ordinarily): unchanged SHA256 diff bodies; each canonical header
now selects ONE actual named test, clean1/1 and mutant1/1 assertion failure, zero skips/cancels.
Raw representative is the during-GET first-barrier test; store representative is old before-push
authority test; own-write representative is the full refresh/pull/audit/release/deletion control.
Broad manual41/39/2-test TAP and every old-assertion mapping remain valid unchanged-body evidence,
not the canonical CI-header selection. Complete local mutation_harness54/54 now PASS;45/45patches
apply. Add that existing full54-test check before publication, no test/harness/threshold changes.
Application, engine andapp-test bytes unchanged from independently reviewed a064. New exact-head
fullCI and fresh review still required; Dprep3be remains unpublished until correctedM gates pass.
