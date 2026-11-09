# Login sync store-safety subplan (A2 review failure, regroup)

Refs TRI-28. Lane A2: main PR #1001 (head 6c960269717acb63f5d6e18621eacdf2151f5fc1), dev PR #1003
(head 7e3b356fb8052b09f127caae44b38c7b086f6791), branch `claude/login-sync-a2`.
Parent plan: `docs/plans/2026-11-05-login-sync-v2.md` (s8-s12). Prior regroup:
`docs/plans/2026-11-08-login-sync-a1-regroup.md` (A1, three review failures on lost concurrent edits).
Status: plan only, NOT yet reviewed by `/plan-eng-review` (required before dispatch). The self-score in
section 11 is not independent review.

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
  `syncLocal()`/`planPush`, with `syncStill` between that await and planning; (c) immediately before each
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
| C client | `index.html` sync region (app JS only, from `// Optional email-code sign-in` to `syncBoot`); `tests/app.test.js` (new describe plus section18 fixture/setup-only corrections; all existing assertions unchanged); `tools/sandbox.js` (additive `throwOnKeys` option only, N3); `tests/mutants/a2_sync_*.patch`; `tests/suite_health.py` row for `tests/app.test.js` (set from measured count) | engine region; e2e files; i18n; About copy | AC-C1 new S1/S2/S6/S7/S8 tests fail at their pre-fix source and pass after (section19 adds three regressions against 8833; happy-path controls may already pass E); AC-C2 whole `sync client` and `sync-apply` describes still pass; AC-C3 app mutants killed: gate, primary pre-apply/pre-plan/pre-batch guards, post-apply/post-pull/post-push identity checks, token userId/collectionId and ungated syncStartLock; AC-C4 reviewer repro (T-APP-M7-zero-tombstones) passes | `node --test --test-name-pattern "sync store safety|sync client|sync-apply" tests/app.test.js`; `python3 tools/validate.py` |

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

## 8. Dev PR #1003 re-merge procedure

Facts verified: `tests/editor_model.test.js` exists on `origin/dev`, not on `origin/main`; its
`DIRECT_READERS` array (test U2a-F3) lacks `tests/e2e_sync.test.js`; `tests/e2e_sync.test.js` contains the
string `index.html`; CI does not run on a PR into `dev`.

1. After lane C is green on M (PR #1001) at head H, create a detached worktree
   (`git worktree add --detach`, never `cp -r`) at the EXISTING #1003 head `7e3b356f` (NOT `origin/dev`:
   `7e3b356f` is not an ancestor of dev 8d08667a, so a push from a dev-based tree is non-fast-forward and
   invites a force-push, R1). Merge H into it (merge commit); resolve engine, `DECKS` and I18N regions by
   taking either side and re-running the generator tools. Then add the step-2 commit on top. Never
   force-push.
2. Add `"tests/e2e_sync.test.js"` to `DIRECT_READERS` in `tests/editor_model.test.js` (dev-only commit; the
   array is sorted by `deepStrictEqual` after `.sort()`, so position is free).
3. Set `tests/suite_health.py` rows from MEASURED counts in this merge worktree (dev base 1152 plus the net
   new `app.test.js` tests from A2 and this subplan), not main's 1221. Record the measured numbers in the PR
   body.
4. Dev gate, run in that worktree, all must pass before D is pushed:
   - `node --test tests/editor_model.test.js` (U2a-F3 green)
   - `python3 -m unittest tests.test_suite_health`
   - `python3 tests/suite_health.py --emit-js <scratch>/js.json` (one run; the FULL suite may starve the
     browser, so e2e skips are acceptable only where `E2E_FILES` allows; do not claim an e2e result)
   - `python3 tools/validate.py`
   - `git apply --check` of EVERY `tests/mutants/a2_*.patch` and every new or refreshed
     `tests/mutants/sync_*.patch` in this worktree (CI runs no mutation on dev, R7)
5. Push as new commits to `claude/login-sync-a2-dev` (no force); verify `gh pr view 1003 --json headRefOid`
   equals the local tip (re-query once if it lags). D merges only when: `validate` green on M at H; an
   independent reviewer PASS or PASS_WITH_NITS at H and at the D head; not CONFLICTING; then the served DEV
   check per `docs/testing/browser.md`. M stays open until the owner says merge.
6. If #1003 would conflict, close nothing; push the merge commit with dev (stale-CONFLICTING note in memory).

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
Reviewer is a fresh swarm-reviewer on Opus, `/review` read-and-report only. FAIL needs a concrete scenario.

Exact-head CI evidence required: `gh run list --commit <H> --workflow validate.yml` conclusion `success`
for M; for D, the section 8 step 4 outputs pasted in the PR body plus the served-DEV check.

Continuation point: when `/plan-eng-review` of this file passes, dispatch lane E on
`claude/login-sync-a2` from head 6c960269717acb63f5d6e18621eacdf2151f5fc1; write the T-ENG tests first.
Stop: after lane C returns green and both reviews pass, stop and hand the owner the M PR (#1001) with
the About-copy lane queued; do not merge M, do not enable prod, do not touch schema.

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
