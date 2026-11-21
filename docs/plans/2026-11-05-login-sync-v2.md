> Historical parent-plan archive, not a current authorization or pickup point. Resume from
> Linear TRI-28's latest lifecycle comment and `2026-11-09-sync-store-safety-subplan.md` section21.
> Current session gates override historical READY/Next/setup entries; no main merge, deploy,
> migration or production-credential action is authorized here. Original local plan remains
> untouched (SHA256: 789e286e82272bdd9d804f7c083a8e172d18ea935b62151741c34960ea75a1a6).
> Original lines454/456 are redacted in this copy: key values and private test-inbox/account details.

# Plan: login + cloud sync of saved scales, v2 (2026-11-05)

Status: READY (reviews 1-4; R4 conditions applied, see "Round 5 changes"). Planning only: nothing is built until the owner says go.
**Supersedes `docs/plans/2026-10-28-login-sync.md`** (PARKED P3; its Regroup design and open findings F15-F23 are disposed of in section 17; that file is not edited).
Inputs: `docs/plans/2026-11-05-login-investigation.md` (evidence, re-checked against code below), `docs/plans/2026-10-30-safari-storage.md`, `docs/plans/2026-11-04-move-stage2-301.md`, `docs/plans/2026-11-04-move-reaudit.md`, CLAUDE.md.
Linear: integrator to file/attach under key `handpan-cards#login-sync` (search `Key:` first; the parked issue should be reused, not duplicated).

## 1. Goal

Optional, very lightweight sign-in (typed 6-digit email code) plus cloud sync of saved scales, so that iPhone Safari's 7-day script-storage deletion and device changes never lose a signed-in user's saved scales. Free at today's size, with a documented exit path, minimal infrastructure, and nothing changed for users who never sign in.

## 2. Non-goals

- No magic links, no OAuth, no passwords, no passkeys (owner 2026-11-05).
- No settings sync: language, mode, palette, order, hidden-seed list and preferred selection stay per device (owner 2026-11-05; hidden seeds see A4).
- No backup/export feature, no "download my scales" button (owner 2026-11-05). This **drops lanes B and N of `2026-10-30-safari-storage.md`**; lane P (`navigator.storage.persist()`) is unaffected and stays optional.
- No change to the domain move plan, the move banner, the frozen move region (`const MOVE_FROM =` to the end of `moveReport`), `MOVE_DEADLINE`, or any move date.
- No sync on the old host, on `file:`, or on localhost unless a test sets the origin explicitly.
- No new analytics events or params in v1. No email, session, user id or token ever reaches GA.
- No change to share links (`#s=`), `RECORD_VERSION`, or `savedEnvelopeShape`.
- No SDK, no `<script src>`, no CAPTCHA widget (Turnstile/hCaptcha need a script tag).
- No account UI beyond: sign in, signed-in-as line, sign out, delete account.

## 3. Decisions

| # | Decision | Source |
|---|---|---|
| D1 | Sign-in is a typed 6-digit code sent by email. The email template contains only `{{ .Token }}` (no link). | owner 2026-11-05; Supabase template behaviour: investigation s2 (fetched docs `auth-email-passwordless`) |
| D2 | Sync scope = saved scale entries (`envelope.entries[].record`, including `o.replaces`). Nothing else. | owner 2026-11-05 |
| D3 | Deletes propagate across devices via server tombstones; not union-only. | owner 2026-11-05 (overrides the investigation's union-only recommendation) |
| D4 | Email sender = Resend free tier, sending domain on `handpantheory.com` (SPF/DKIM DNS records), wired as Supabase custom SMTP. Owner creates the account; DNS is owner-gated. | owner 2026-11-05 |
| D5 | No separate backup/export feature. | owner 2026-11-05 |
| D6 | Launch host = `https://handpantheory.com`, enabled only after the stage 2 301 (S3b, ~2026-11-29). Lanes may build and run on DEV earlier. | owner 2026-11-05; dates: `2026-11-04-move-reaudit.md` Timeline (T0 = arm served; #892 merged 2026-11-05; 302 ~Ts+14 ~2026-11-22; 301 +7 days) |
| D7 | **Bridge verdict: do not bridge the domain move with login.** Section 6. | recommendation for owner confirmation (Q1) |
| D8 | **Backend = Supabase free tier**, Auth (email OTP) + Postgres via PostgREST, called with plain `fetch`, no SDK. Section 5. | recommendation for owner confirmation (Q2) |
| D9 | Data model = one row per scale, keyed by the scale's `instanceId`, with a server revision and a `deleted` flag. Section 8. | recommendation |
| D10 | Conflict rule: per-scale; delete-vs-edit and edit-vs-edit never lose bytes (the losing edit is kept as a separate saved scale). Section 9. | recommendation; release safety (CLAUDE.md) |
| D11 | Sync code is gated by one constant table `SYNC_ORIGINS` keyed by hostname: `handpantheory.com` -> prod project, `handpan-cards-dev.pages.dev` -> dev project, everything else -> null (sign-in UI hidden). | recommendation; `analyticsAllowed()` is a separate gate and stays untouched |
| D12 | Only the Supabase **anon (publishable) key** and project URL appear in `index.html`. The service-role key and the Resend API key never enter the repo (Resend key lives only in Supabase dashboard SMTP settings). | CLAUDE.md credentials rule |
| D13 | Supabase exposes "1 week inactivity pause" on free; accepted with a keep-alive ping only if its terms allow it (GATED V3); otherwise accept pauses at 40 users, or $25/mo Pro. | investigation s2; owner Q3 |
| D14 | First sign-in with unsynced local scales asks "Add the N scales on this device to your account?" Yes / Not now; Not now keeps them local-only, unsynced, never deleted. | owner AFK decision 2026-11-05 (conservative; R1-8) |
| D15 | `push_scales` appends every overwritten body to `scale_history` (kept 30 days) so any overwrite is recoverable, not only a delete (R3-2 replaces the single `prev_record` column). | owner AFK decision 2026-11-05 (conservative; R2-3) |

## 4. Assumptions (each GATED until checked)

| # | Assumption | How to verify |
|---|---|---|
| A1 | Supabase email OTP length is 6 digits by default and configurable; expiry configurable (target 10 min). | GATED V1: Supabase dashboard Auth > Providers > Email ("Email OTP length", "Email OTP expiration") on the dev project. |
| A2 | Supabase invalidates a code after some number of failed verifies, or only rate-limits by IP (investigation: 30 verifies / 5 min / IP). | GATED V2: dev project, request a code, send 10 wrong codes then the right one from one IP; record result. Docs: `supabase.com/docs/guides/auth/rate-limits`. |
| A3 | Supabase pause triggers on no API activity for 7 days; a scheduled read keeps it active and is allowed by the terms. | GATED V3: read `supabase.com/docs/guides/platform/free-plan` / terms text on pausing; owner decides. |
| A4 | Hidden built-in seeds are a setting (per device). A deleted seed replacement re-hides the seed only locally. | Owner Q4 (recommended: yes, per device). |
| A5 | Resend free = 100 emails/day, 3000/month, one domain. | GATED V4: `resend.com/pricing` at account creation (not fetched 2026-11-05). |
| A6 | Supabase anon key REST calls are CORS-open from any origin; no CSP exists in the app (verified: no `Content-Security` meta in `index.html`; `_headers` only sets `X-Robots-Tag` on `*.pages.dev`). | CORS: GATED V5, one `curl -H 'Origin: https://handpantheory.com' -I <project>/auth/v1/settings` on the dev project. CSP: verified. |
| A7 | Supabase supports Postgres functions callable as `POST /rest/v1/rpc/<fn>` under the caller's JWT (security invoker), so compare-and-set push runs server-side. | GATED V6: create the function on dev and call it with a user JWT. Standard PostgREST behaviour. Also call `delete_my_account` on dev with a test user and confirm the `auth.users` row and its `saved_scales`/`sync_users` rows are gone (definer privilege on `auth` schema, R2-4). |
| A8 | Both hosts are one Pages project (stage 2 A1), so any app code ships to the old host too. Sync stays off there because of D11, not because of deployment. | verified strongly in stage 2 E1/E2; GATED there as Q1. |
| A9 | pg_cron is available on the Supabase free plan for the 30-day body purge. | GATED V7: dev project, Database > Extensions, enable `pg_cron`, schedule a no-op job, confirm it runs (`cron.job_run_details`). Fallback: O8 Actions runner. |


## 5. Backend comparison

Scored for: ease of use, least complexity for this repo (single file, no `<script src>`), free.

| Criterion | Supabase (recommended) | CF Pages Functions + D1, own auth | CF Functions + D1 + hosted auth (Clerk/Stack) | Firebase Auth + Firestore | PocketBase (self-host) |
|---|---|---|---|---|---|
| Email 6-digit code | Built in: `POST /auth/v1/otp`, `POST /auth/v1/verify {type:"email"}`; code-only via template (investigation s2, fetched docs) | Build it: code gen, hash, expiry, attempts, per-email caps (old plan F15-F18 all ours) | Clerk supports codes, but its frontend is an SDK script (breaks no-`<script src>`); a raw Clerk Frontend API flow is undocumented for this use: GATED | Email **link** only; no email code documented (investigation s2) — fails D1 | Built in OTP + REST |
| Client | Plain `fetch` to REST; no SDK needed | Same-origin `fetch`, no CORS | SDK expected | REST possible; link flow fails iOS Mail (investigation s2) | Plain `fetch` |
| Inactivity pause | **Yes, after 1 week** on free (investigation s2, `supabase.com/pricing`); A3 | None | None | None | Your host |
| Email limits | Built-in sender 2/hour project-wide (unusable); custom SMTP = Resend budget (A5) | Resend budget | Clerk's own sender | Spark 5 link emails/day (fails) | Your SMTP |
| Code-guess protection | Vendor rate limits (A2 GATED), per-user send 1/60 s | Ours to build and test (F15) | Vendor | Vendor | Partial, ours to tune |
| Data access control | Postgres RLS `user_id = auth.uid()` | Function code checks | Function verifies JWT | Security rules | Collection rules |
| Infra to run | None (hosted) | Functions + D1 binding per env (prod, DEV, previews); same account as hosting | Functions + D1 + vendor | None | A VPS/Fly app (~$5/mo) to patch and monitor |
| Cost at 40 users | $0 (+ Resend $0) | $0 | $0 | $0 but email cap fails | ~$5/mo |
| Cost at 5000 users | $0 within 50k MAU / 500 MB (est. 5000 x 10 scales x ~2 KB = ~100 MB); Pro $25/mo only if pause/backups matter; Resend may need paid tier (~$20/mo, GATED V4) | $0 on D1 (5M reads / 100k writes per day); Resend same | $0 Clerk Hobby 50k MRU (fetched `clerk.com/pricing`) | billing on | ~$5/mo |
| Exit path | `pg_dump`; one plain table, portable to D1 by a later lane | SQLite export | Users locked in Clerk | Proprietary export | SQLite file |
| Repo code size | Smallest: client only + one SQL file | Largest: auth server + tests + client | SDK conflict | n/a | Client + server ops |

Pick: **Supabase**. It is the only option that gives email codes, abuse limits and per-user data isolation with zero server code and plain `fetch`. Its two weaknesses are known and bounded: the built-in email cap is replaced by Resend (owner already chose it, D4), and the 1-week pause is irrelevant once sync pulls on boot for any active user, with a keep-alive or Pro as fallbacks (D13). CF + own auth is the documented exit if Supabase pricing or pausing ever bites; the row schema below is chosen to port 1:1 to D1.

## 6. Bridge verdict (sign in on the old host, scales appear on the new host)

Recommendation: **do not bridge.** Reasons:

1. **Timeline.** The 302 starts ~2026-11-22 (Ts+14), the old host stops serving the app then. Bridging needs, before that date: Supabase + Resend accounts, DNS on `handpantheory.com`, schema, two app lanes through PR M/PR D, CI, an independent review each, and a DEV iPhone check. That is about two weeks of gated steps with no slack, against a move calendar that the owner fixed as "exactly +14".
2. **It solves nothing the banner does not.** The click-to-move banner already carries every saved scale to the new origin in one tap (`moveUrl` -> `#move=` -> `moveImport`, idempotent by `instanceId:digest`). A user who visits the old host inside the window can tap the banner; a user who does not visit will not sign in either. Bridge coverage is a strict subset of banner coverage.
3. **Two origins, two copies.** A signed-in old-host user who also taps the banner gets the same scales via two paths. `move-import` gives them fresh local `instanceId`s on the new host, so the sync rows (keyed by old-host `instanceId`) and the moved rows would be duplicates unless a dedupe rule spans both paths: new code touching the frozen move contract's semantics.
4. **Banner and frozen region.** A sign-in prompt on the old host competes with the move banner for the same menu/top space and copy, and any hook into `moveUrl`/`moveImport` breaks the freeze test. Not changing the move plan is a constraint.
5. **Stranded sessions.** Old-host sessions stop being useful at the 302; the user must sign in again on the new host anyway.

Contingency (not a bridge, no move-plan change): if stage 2 F0/F1 fires (Safe Browsing flag, move unarmed), stage 2 D4 already says "the migration path becomes backend accounts". Then the owner may decide to add the old host to `SYNC_ORIGINS` (one constant row; Supabase is origin-agnostic), so a user signs in on the old host and again on the new host and sync carries the scales. That decision is the owner's at that time (Q5), and it is the only case where login spans two origins.

## 7. Why this is the smallest approach

- No server code: Supabase Auth + RLS + one RPC function in one checked-in SQL file.
- Client reuses existing paths: every write already goes through `commitSaved` -> `applySavedCommand`; pull applies through one new command type there, so locks, IndexedDB transactions, BroadcastChannel notify and session mode are all reused.
- Identity is the existing `instanceId` (a UUID from `savedCryptoId`); no content hashing (removes F20).
- Sync metadata lives in a separate localStorage key, so `savedEnvelopeShape` and the saved-store migration are untouched.
- Rejected: per-user envelope row (cannot express per-scale tombstones or merge two devices' edits without whole-document conflicts; one device's stale envelope overwrites another's deletes); union-only sync (fails D3); content-addressed sha rows (old plan; F19/F20/F21 machinery); home-built auth (F15-F18 ours).

## 8. Data model

Server, table `saved_scales` (file `tools/sync/schema.sql`, applied by the owner in the SQL editor of each project):

```
user_id    uuid  not null references auth.users on delete cascade
scale_id   uuid  not null            -- the scale's instanceId
rev        bigint not null           -- per-user counter (sync_users.last_rev), assigned only inside push_scales
record     jsonb                     -- engine profile record (RECORD_VERSION 5 shape); null after body purge
deleted    boolean not null default false
deleted_at timestamptz
updated_at timestamptz not null default now()
primary key (user_id, scale_id)
```

Table `scale_history(id bigserial pk, user_id uuid not null references auth.users on delete cascade, scale_id uuid not null, record jsonb not null, replaced_at timestamptz not null default now())`, RLS on, no client grants. `push_scales` inserts the old body on **every** overwrite of a non-null body (edit, revive, delete-with-new-body), so repeated junk pushes never push the original out (R3-2). Retention: the 30-day purge deletes history rows older than 30 days. Cap (R4-2): at most 2000 history rows per user; when a push would exceed it, `push_scales` refuses the overwrite (`refused:"rate"`, client status `sync.err.rate`) and never drops old history. Chosen over a per-user push rate limit because it is one `count(*)` inside the already-locked RPC with no extra table or time window, it bounds storage directly, and refusing (instead of evicting) keeps the original body recoverable; 2000 overwrites in 30 days is far above normal use.

Table `sync_users(user_id uuid pk references auth.users on delete cascade, last_rev bigint not null default 0)` holds each user's rev counter. `push_scales` does `insert ... on conflict do nothing` then `select last_rev ... for update` on the caller's row, so all writes for one user are serialized and revs commit in order; a pull with `rev=gt.<cursor>` can never skip a row (R1-2). Rows are never deleted by clients (no DELETE policy, no INSERT/UPDATE grant: R1-3). Tombstone = `deleted=true`; body kept 30 days for recovery, then a scheduled purge sets `record=null` but **keeps the row forever** (F19). Size caps in a CHECK: `octet_length(record::text) <= 8192`, max 500 **live** (`deleted=false`) rows per user, max 5000 rows in total per user (live + tombstones), max 200 rows per `push_scales` call, and a tombstone for an unknown `scale_id` is refused (`refused:"unknown"`), never inserted (R3-5); all enforced in the RPC; tombstones do not count toward the 500 live cap (R2-2; they do count toward the 5000 total, R4-3). A refused push returns `{scale_id, refused:"cap"}`; the client keeps the scale local and shows status `sync.err.cap`.

Why per-scale and why `instanceId`:
- Deletes need per-scale tombstones (D3). A per-user envelope would need its own tombstone list and whole-document merges.
- `instanceId` is already a random UUID that never travels in `#s=` links (CLAUDE.md release safety; `moveUrl` carries it only in `#move=`). Sync uploads it to the user's own row, never into a link, so the rule holds. On pull, a new command `sync-apply` inserts a remote row **with its remote `instanceId`** (pushed into `usedInstanceIds`, appended at `nextDisplayOrdinal`, keeping `savedEnvelopeShape`'s `usedInstanceIds[displayOrdinal-1] === instanceId` invariant). So every device shares one id per scale. A local id collision (UUID, ~0) is refused and logged as a conflict copy.
- `record` is stored as the client holds it after `readSavedRecord` (current `RECORD_VERSION` 5). A device on an older build that receives a record it cannot read keeps it opaque, like `move-import`'s `opaque` branch, and never pushes a rewrite of it. A future record version bump does not change identity (id-keyed, not content-keyed), so F20 cannot recur; a test pins this.

Client sidecar `hpfc.sync.v1` (localStorage, separate from the saved envelope):
`{ v:1, project, userId, email, refresh, access, accessExp, cursor, base: { <remoteId>: { rev, localRevision } }, alias: { <localId>: <remoteId> }, deferredDeletes: [<remoteId>], localOnly: [<localId>], pending: bool }`.

**Identity remap (R1-1, R1-6).** Remote id = the server `scale_id`. Local id = the entry's `instanceId`. They are equal by default (`sync-apply` inserts with the remote id). They differ only when `alias` says so: (a) revival on a device that already used the id (`usedInstanceIds` keeps deleted ids forever and must stay unique, `savedEnvelopeShape`), the body is inserted under a fresh `allocate` id and `alias[newLocal]=remoteId`; (b) first-sign-in meaning match (section 9). Chosen over "new row + tombstone old" because the alias keeps one remote id per scale, so other devices see an edit, not a delete-and-add, and no further conflicts are generated. All `base`, push and tombstone logic works on remote ids via `remoteOf(localId) = alias[localId] || localId`. `base[id].localRevision` is always the entry's `revision` **after** the commit that applied or pushed it (R1-5).
Lost with the 7-day wipe together with local scales; the server copy survives and a sign-in restores everything.

## 9. Sync algorithm

Signed out (default): no network call, no sidecar, behaviour byte-identical to today (test).

Sign in: email -> `POST /auth/v1/otp {email, create_user:true}` -> user types the 6-digit code -> `POST /auth/v1/verify {email, token, type:"email"}` -> store tokens -> **first sync** (below).

Pull (at `finishSavedBoot` end, on sign-in, on `visibilitychange` to visible at most once per 60 s):
1. Refresh access token if expired (`POST /auth/v1/token?grant_type=refresh_token`). **Only the `hpfc.sync` lock holder ever refreshes** (refresh tokens rotate and are single use, R3-3). 401 -> signed-out-with-notice (local scales untouched).
2. `GET /rest/v1/saved_scales?select=scale_id,rev,record,deleted&rev=gt.<cursor>&order=rev` (paged, 200/page).
3. Build `sync-apply` items and `commitSaved({type:"sync-apply", collectionId, items})`. Per remote row R against local entry L = the entry whose id is `localOf(R.id)` (reverse of `alias`, else `R.id` itself; R2-1) and base B = `base[R.id]`:
   - R live, no L, no B: insert R with its id.
   - R live, no L, B present: local deleted it since B. If `R.rev > B.rev` (remote edited after) -> revive R under a fresh local id with `alias[newLocal]=R.id` (R1-1; edit beats delete, no loss). Else keep deleted; the pending push sends the tombstone.
   - R live, L present: if L unchanged since B (`L.revision === B.localRevision`) -> overwrite with R. If L changed and R.rev > B.rev (both edited) -> keep L in place, insert R's body as a **separate** scale (new local id via `allocate`, name suffixed by the existing duplicate-name rule) that is pushed as a **new** remote row, set `base[X].rev = R.rev` (R1-4), then push L against R.rev. Result after one cycle on both devices: X holds L's body, the new row holds R's body. If R equals L by `savedEqual`, just advance base.
   - R deleted, L present: if L unchanged since B -> remove L locally (via the same slot logic as `delete`). If L changed -> keep L and push it (edit beats delete; the row is revived).
   - R deleted, no L: advance base.
   - `o.replaces` handling copies `move-import`: drop `replaces` if that slot is held or the seed is hidden locally.
   - Never remove the last visible scale: if a deletion would, skip it and add the remote id to `deferredDeletes` (R1-7). After every successful commit, retry each deferred delete; it is applied once another scale is visible, and dropped if L was edited meanwhile (then L is pushed and the row revived: edit beats delete). A deferred id is never pushed as live while deferred.
4. Advance `cursor` to the max `rev` seen and set `base` from the committed post-apply entries (`revision` after the `sync-apply` commit), so the next push diff sends 0 rows (R1-5).

Push (debounced 2 s after any successful `commitSaved` whose result `changed`, and after pull):
1. Diff local entries against `base`: new or changed (`localRevision` moved) -> upsert; ids in `base` missing locally -> tombstone. A tombstone row carries `deleted:true` and no body; the RPC keeps the stored `record`, sets `deleted_at`, and never nulls the body; only the 30-day purge clears it (R3-4).
2. `POST /rest/v1/rpc/push_scales {rows:[{scale_id, base_rev, record|null, deleted}]}`. The function, per row, compare-and-sets on `base_rev` (`base_rev:null`: no row -> insert; existing tombstone -> revive allowed, new rev, same `scale_id`; existing live row -> conflict; R2-5), assigns a new `rev`, and returns `{scale_id, rev}` or `{scale_id, conflict:true}`.
3. Conflicts -> run a pull, then push again (max 3 loops per trigger).

First sync on a device: pull first with empty `base`.
- Remote rows are inserted, except when an unmatched local scale has the same meaning (`ctx.describe` meaning, the rule `move-import` uses): then no insert; the local entry adopts the remote id, `alias[localId]=remoteId`, and `base[remoteId]` is set (R1-6). A match on deck identity alone does not match: it inserts. If both bodies are equal, done; if not (same meaning, different name/options), the local entry is treated as edited and pushed (local wins once, no duplicate). An identity collision without meaning match (`inventory-collision`) inserts the remote row as a renamed copy under a fresh id (`ctx.copyName`); the copy's body differs from the server, so its base is `edited`, never `committed`.
- Same remote id as a local entry, no base (sidecar lost, re-sign-in) and different bodies: treated like edit-vs-edit. The local entry is kept, the remote body is inserted as a conflict copy (a new row), and the local base is set to the remote rev as `edited`. Union, no loss, no CAS loop.
- Local scales with no remote match: **owner AFK decision (R1-8, conservative)**: if the device holds scales never synced to this account (never signed in, or `localOnly`/a previous `userId` differs), ask "Add the N scales on this device to your account?", where N is counted **after** the pull and first-sync meaning/identity matching, over local scales still unmatched (R3-6); if N is 0, no prompt; with **Yes** / **Not now**. Yes pushes them as new rows. Not now records them in `localOnly`: they stay on the device, are never pushed, never deleted by sync, and the prompt reappears only from the account panel ("Add N scales from this device"). A device whose only local scales came from this account's pulls is not asked.
- Deletes only propagate for remote ids this device has in `base`, so a fresh device never deletes remote rows it never knew.

Offline / vendor down / paused project: every call is best-effort with a 10 s timeout. Failure sets `pending:true` and a quiet status line "Not synced yet" in the account panel; retry on next boot, visibility change or commit. Local saves never wait on the network and never fail because of sync.

Sign out: `POST /auth/v1/logout`, delete the sidecar; **local scales stay**. Signing in again later is a first sync (union).

Delete account: `POST /rest/v1/rpc/delete_my_account` (security definer, deletes the caller's `auth.users` row; cascade removes rows); local scales stay; sidecar removed.

Session across tabs (R3-3): the session lives in the sidecar. Sign-in and sign-out may happen in any tab; they write the sidecar, and the lock holder re-reads it on every `storage` event for `hpfc.sync.v1` and before each pull/push. A sidecar without a session (sign-out in any tab) stops the lock holder's pushes at once; a new session (sign-in elsewhere) starts its first sync. Non-holder tabs never call the token endpoint.

Multi-tab: sync runs inside the tab holding a `navigator.locks` lock `hpfc.sync` (`ifAvailable`). A commit in any other tab reaches the lock holder through the existing `savedChannel` -> `reconcileSavedCollection`; the lock holder schedules a push after every reconcile that changed the envelope (R1-11). Other tabs see pulled results through the same reconcile.

## 10. Security

- Function privileges (R3-1): for `push_scales`, `delete_my_account` and `purge_tombstones`: `revoke execute on function ... from public, anon;` then `grant execute ... to authenticated` (purge: to the dedicated role only, not authenticated). `push_scales` and `delete_my_account` begin `if auth.uid() is null then raise exception 'not authenticated'; end if;` (R4-1: not `purge_tombstones`, which runs as role `sync_purger` with no user). `sync_purger` is a dedicated Postgres role created in `schema.sql` with EXECUTE on `purge_tombstones` only; the runner is pg_cron in the project if V7 passes, else the O8 GitHub Actions workflow using a `sync_purger` credential kept as a GitHub secret. Lane S lint asserts both statements per function; smoke asserts an anon-key call to each RPC is refused.
- RLS on `saved_scales` and `sync_users`: enable RLS; `authenticated` gets **SELECT only**, policy `user_id = auth.uid()`; no INSERT/UPDATE/DELETE grant or policy (R1-3). All writes go through `push_scales` and `delete_my_account`, both `security definer`, `set search_path = public, pg_temp`, owned by `postgres`, using only `auth.uid()` (never a client-supplied user id), with the privilege rules above. `push_scales` enforces CAS, the 500-row cap, the 8 KB record cap and per-user rev. Smoke tests: user B cannot read A's rows; a direct `PATCH`/`POST /rest/v1/saved_scales` with a valid user JWT is refused (401/403); `anon` cannot call either RPC.
- Keys: only the anon/publishable key in `index.html` (D12). It grants nothing without RLS passing. Service-role key: never in repo, never in CI.
- Code guessing: 6 digits = 10^6. Expiry 10 min (A1), per-user send 1/60 s, verify 30 / 5 min / IP (investigation s2). Residual: per-email lockout after N failures is GATED (A2). If A2 shows no per-code invalidation, add a dev-project Auth hook or accept with numbers in risks (R2). Damage cap: an attacker who gets in can tombstone rows, but bodies stay 30 days and the owner can restore with one SQL update (section 16), so no permanent loss.
- Email abuse: `create_user:true` means anyone can make the app send a code to any third-party inbox (R1-12); bounded by the caps below and listed under R3/F16. Supabase per-user send limit + project "emails per hour" setting set below Resend's daily quota (e.g. 30/h, total cap < 100/day) so a script cannot exhaust Resend (F16). No CAPTCHA (needs `<script src>`); revisit only with an owner CLAUDE.md decision.
- Phishing copy (F18): email subject "Your Handpan Theory sign-in code", body: "Your code is 123456. Only enter it on handpantheory.com. We never ask for it anywhere else. If you did not ask for it, ignore this email." Sign-in panel repeats "Check the address bar: handpantheory.com."
- Token storage: localStorage (no httpOnly cookie possible cross-origin without server code). The app loads no third-party script except gtag; accepted, listed as R5.
- Payload validation server-side: record size CHECK, 500 rows/user; client re-validates every pulled record with `readSavedRecord` before applying.

## 10b. Sign-in sheet UI (R1-9)

- Placement: one menu row "Sync saved scales" (signed out) / "Synced as <email>" (signed in), in the menu section that holds the saved-scale controls; opens a sheet using the existing sheet component (`openScaleSheet` pattern), not a new overlay. Hidden when `SYNC_ORIGINS[location.hostname]` is null.
- Step 1: `<input type="email" autocomplete="email" inputmode="email" required>` + "Send code". Step 2: `<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6">` + "Sign in", "Use a different email", "Send a new code" (disabled with a visible 60 s countdown matching Supabase's per-user limit).
- Focus: step 1 opens with focus on email; after send, focus moves to the code input; after sign-in, focus moves to the "Synced as" heading; on error focus stays on the field with `aria-invalid="true"` and `aria-describedby` the message.
- One `role="status" aria-live="polite"` line in the sheet for: sending, code sent ("Check your inbox and spam folder"), syncing, synced, not synced yet.
- Signed-in sheet: email, last synced time, "Add N scales from this device" (only when `localOnly` non-empty), "Sign out", "Delete account" (confirm step).
- i18n keys (all 8 `data/i18n/*.json` tables, `python3 tools/sync_i18n.py`, audit, 380px fit): `sync.menu`, `sync.menuSignedIn`, `sync.title`, `sync.email`, `sync.send`, `sync.code`, `sync.signIn`, `sync.otherEmail`, `sync.resend`, `sync.resendIn`, `sync.sent`, `sync.domainWarn`, `sync.status.syncing`, `sync.status.synced`, `sync.status.pending`, `sync.addLocal`, `sync.addLocalYes`, `sync.addLocalNo`, `sync.signOut`, `sync.delete`, `sync.deleteConfirm`, `sync.err.badEmail`, `sync.err.badCode`, `sync.err.expired`, `sync.err.rateLimited` ("Too many requests, try again in a few minutes"; shown on any HTTP 429 from `/auth/v1/otp` or `/auth/v1/verify`, incl. `over_email_send_rate_limit` and the 60 s per-user resend; no retry loop), `sync.err.sendFailed`, `sync.err.offline`, `sync.err.signedOut`, `sync.err.rate` ("Too many changes, try again later"), `sync.err.cap` ("This scale is saved here but your account is full"). Visible text says "scale", never "deck".

## 11. Privacy copy (About, `#about` in `index.html`, all i18n tables)

"Signing in is optional. If you sign in, we store your email address and your saved scales with Supabase (our database provider) so they can return on your other devices or after your browser clears its storage. The sign-in code is sent by Resend. We never send your email or your scales to Google Analytics. Signing out keeps your scales on this device. 'Delete account' removes your email and all your synced scales from our servers."
Final wording owner-approved (O7); English source in `data/i18n/en.json`, translated into every table.

## 12. Phases and lanes (file ownership)

Repo rules apply to every lane: worktree, TDD, PR M to `main` + PR D to `dev` from the same head, full `validate` green at the verified head SHA on M, independent reviewer at that SHA, D merges first, served DEV check (`docs/testing/browser.md`), M stays open until the owner says merge. `Refs TRI-n`, never `Fixes`. Lanes report `pending-linear-writes`.

| Lane | Owns | Prereqs | Owner of action | Deliverable | Observable acceptance | Verify |
|---|---|---|---|---|---|---|
| P0 plan review | this file | none | agent | `/plan-eng-review` verdict; owner answers Q1-Q7 | READY verdict recorded here | read verdict |
| O setup | Supabase dashboard (dev + prod projects), Resend, DNS | P0, O1-O6 | owner | two projects, SMTP wired, template code-only, URL + anon key handed to agent | a code email arrives at owner inbox from `handpantheory.com` on the dev project | owner screenshot; V1-V6 results recorded in section 4 |
| S schema | `tools/sync/schema.sql`, `tools/sync/smoke.mjs` (node fetch, env vars for URL/anon key, test users' tokens read from env, nothing committed) | O (dev project) | agent writes, owner applies SQL | tables `saved_scales` + `sync_users`, SELECT-only RLS, definer `push_scales`, `delete_my_account`, purge function | smoke: A writes, B cannot read/write A; direct PATCH/POST to `saved_scales` with A's JWT refused (R1-3); anon cannot call the RPCs; CAS conflict returned on stale `base_rev`; two concurrent `push_scales` for one user (Promise.all, 20 rounds) yield gap-free revs and a pull from the pre-push cursor returns every row (R1-2); tombstone keeps row **and its body** (read back after a delete push, R3-4); two overwrites then restore the original from `scale_history` (R3-2); anon call to each RPC refused and lint finds `revoke ... from public, anon` per function (R3-1); 201-row call refused, tombstone for unknown id refused, 5001st total row refused (R3-5); `purge_tombstones` run as `sync_purger` nulls bodies of tombstones older than 30 days and deletes history older than 30 days, leaving newer ones (R4-1); the 2001st history row is refused with `refused:"rate"` and history is unchanged (R4-2); smoke output pasted in the PR body (R3-7); 501st live row refused with `refused:"cap"`, and 500 tombstones + 1 live push accepted (R2-2);  `base_rev:null` on a tombstone revives with a new rev and same id, on a live row conflicts (R2-5); `delete_my_account` removes the auth user and rows (R2-4) | `node tools/sync/smoke.mjs` against dev (owner-run with env); CI runs only a static SQL lint test that the file has `enable row level security` and no `delete` policy |
| E merge core | `src/engine/sync.js` (pure: diff local vs base, plan pull merge, plan push, alias map), engine region via `python3 tools/inline_engine.py`, `tests/sync.test.js`, `docs/ENGINE-SPEC.md` sync section | P0 | agent | pure functions, no I/O | every rule in section 9 has a test incl. edge cases in section 15; RECORD_VERSION bump keeps identity; named tests: revival on a device that used the id gets a fresh local id + alias and pushes to the remote id (R1-1); edit-vs-edit converges to exactly two scales on both devices within one pull+push cycle with no conflict loop (R1-4); pull then push sends 0 rows (R1-5); first sign-in meaning match adopts the remote id, no duplicate, and identity collision without meaning match makes a renamed copy (R1-6); last-visible delete goes to `deferredDeletes`, applies after another scale exists, is dropped if edited (R1-7); `localOnly` entries are never in a push plan or a delete (R1-8); N for "Add N scales?" counts only scales unmatched after first-sync matching, and re-sign-in to the same account after sign-out gives N=0 and no prompt (R3-6); revive on A, edit on B, A pulls twice -> exactly one scale on A, updated in place (R2-1) | `node --test tests/sync.test.js`; `python3 tools/validate.py`; CI |
| A1 store command | `index.html` app JS: `sync-apply` in `applySavedCommand` and candidate staging; `tests/app.test.js` (new titled block "sync-apply") | E merged to dev | agent | command applying E's plan under the existing lock/transaction | applying a plan inserts with remote ids keeping `savedEnvelopeShape` true; last-visible guard; `replaces` drop; session mode works; signed-out path makes zero `fetch` calls; overwrite ops carry replaces without stripReplaces; reconcile slot ownership on overwrites (nit 3) | `node --test tests/`; CI |
| A2 client + UI | `index.html` app JS (sync client, `SYNC_ORIGINS`, hooks after `commitSaved` result, after `reconcileSavedCollection` in the lock holder, and at end of `finishSavedBoot`), menu markup/CSS, `#about` copy, `data/i18n/*.json` + `python3 tools/sync_i18n.py`, `tests/e2e*.js` sync block with a stubbed `fetch` | A1 | agent | sign-in sheet per section 10b, status line, add-local prompt | e2e with fetch stub: sign-in, pull inserts, push after save, delete propagates, offline pending, sign-out keeps scales; two tabs: sign-out in the non-lock tab stops the lock tab's pushes (0 requests after), sign-in in the non-lock tab starts the lock tab's sync, and only the lock tab calls the token endpoint (R3-3); two tabs: a save in the non-lock tab is pushed by the lock tab (R1-11); "Add N scales?" shown for unsynced local scales, Not now pushes 0 rows and keeps them after later pulls (R1-8); sheet input attributes, focus moves, aria-live updates and 60 s resend cooldown asserted (R1-9); no request to GA carries email/token (assert gtag calls); visible text says "scale"; i18n audit and 380px fit pass; plan over the merged remote pages, never per page (review nit 4) | `python3 tools/validate.py`; `node --test tests/`; CI; DEV check |
| Q DEV QA | none (testing) | A2 on DEV | owner + agent | two-device DEV run incl. iPhone Safari | section 14 human checks pass | owner's words |
| R release | `SYNC_ORIGINS` prod row (one line) | Q passed; stage 2 S3b (301) live; owner go | owner merges M | sync on `handpantheory.com` | prod sign-in works; old host shows no sign-in UI | `/browse` on both hosts |

A1 and A2 share `index.html` and `tests/app.test.js`: serial, not parallel. E and S are parallel (disjoint files). Lane E is an engine module so its logic is unit-tested without the app.

Proposed CLAUDE.md patch (owner-gated, NOT applied), under "Analytics privacy":
`- Sync: the sign-in email, tokens and synced records never reach GA; sync runs only on hosts in SYNC_ORIGINS; only the Supabase anon key is in the repo.`
And under "Release safety": `- Signing out or a sync failure never removes local saved scales.`

## 13. Owner actions (each gated, per-action OK)

| # | Action | When |
|---|---|---|
| O1 | Create Supabase account and two free projects: `handpan-theory-dev`, `handpan-theory` (prod). | after P0 |
| O2 | Create Resend account; add domain `handpantheory.com` (subdomain e.g. `mail.handpantheory.com` recommended to keep root reputation separate). | after P0 |
| O3 | Add Resend's SPF/DKIM (and optional DMARC) DNS records on Cloudflare for `handpantheory.com`. Does not touch the move redirect rule or zone `raywu.org`. | after O2 |
| O4 | In each Supabase project: Auth > SMTP = Resend; email template = code only (D1, F18 copy); OTP length 6, expiry 10 min; emails/hour cap (section 10); Site URL `https://handpantheory.com`. | after O3 |
| O5 | Run `tools/sync/schema.sql` in the prod project's SQL editor (dev first, for the smoke). | after lane S review and only once the lane S PR body has the dev smoke output attached (case names + pass counts, no tokens or emails; R3-7) |
| O6 | Hand the agent each project URL + anon key (public values) for `SYNC_ORIGINS`; keep service-role keys private. | after O1 |
| O7 | Approve About privacy copy and the email copy. | A2 review |
| O8 | Decide keep-alive (V3) or Pro. Keep-alive runner, if chosen: a scheduled GitHub Actions workflow in this repo (`cron: daily`) doing one anon `GET /auth/v1/settings` per project; it holds only public URLs/anon keys and never gates CI. Body purge runner: pg_cron in the project if V7 passes, otherwise the same Actions workflow calling a definer `purge_tombstones()` RPC restricted to a dedicated role key stored as a GitHub secret (owner-created). | before R |
| O9 | Merge M PRs; release R only after the 301. | per repo rules |

## 14. Verification

- Automated (CI at head SHA): `tests/sync.test.js` (merge rules, edge cases, version-bump identity), app tests for `sync-apply`, e2e with stubbed fetch, "signed out makes zero fetch calls", "no gtag call carries email/token/scale_id", static SQL lint, i18n audit + fit, `tools/validate.py`.
- Self (agent, dev project): `node tools/sync/smoke.mjs` (RLS isolation, direct-write refusal, concurrent-push revs, CAS conflict, tombstone, size caps); `/browse` on DEV: sign in with a test inbox the owner provides, save, reload, delete.
- Independent: a fresh reviewer per lane at the verified SHA (`/review`, read-only), briefed with this plan's acceptance rows verbatim; a reviewer also checks RLS SQL against section 10.
- Human (owner, DEV): (1) iPhone Safari: sign in, save 3 scales; on a desktop browser sign in, see 3; delete one on desktop, reopen iPhone, it is gone; edit on both offline then online, both versions exist. (2) iPhone Safari: Settings > Safari > Clear History and Website Data (simulates the 7-day wipe), reopen DEV, sign in, all scales return. (3) Sign out on iPhone: scales still on device. (4) Email arrives, code works, copy shows the domain warning. (5) iPhone VoiceOver: the sheet's fields are labelled, the status line is announced, focus lands on the code field after send. (6) Desktop keyboard only: open sheet, send, type code, sign in, sign out without a pointer. (7) Sign in on a device that already has scales: the "Add N scales?" prompt appears; Not now keeps them unsynced.

## 15. Edge cases

| Case | Outcome |
|---|---|
| Two devices offline, both add scales | Both pushed on reconnect; union. |
| Same scale edited on both | Second pusher gets conflict -> pull -> remote body becomes a new separate row, `base[X].rev` set to R.rev, local edit pushed to X; both devices converge to two scales in one cycle (R1-4). |
| Edit on A, delete on B | Edit wins; B revives it under a fresh local id aliased to the same remote id (R1-1). No loss. |
| Delete on both | Second tombstone is a no-op. |
| Seed replacement synced to a device where that seed slot is held or hidden | `replaces` dropped; arrives as a custom scale (same as `move-import`). |
| Deletion would remove the last visible scale | Held in `deferredDeletes`, applied after another scale is visible; dropped (and revived) if edited first (R1-7). |
| Shared device, second account signs in | Prior account's local scales are not merged without the "Add N scales?" Yes (R1-8). |
| Project paused / vendor down / 5xx | Pending, retried; local unaffected; status "Not synced yet". |
| Resend quota exhausted | Code email not sent; panel shows "Could not send a code, try later" (`t()` key); existing sessions unaffected. |
| Refresh token expired / revoked | Signed out with a notice; local kept; re-sign-in = union. |
| 7-day wipe | Local and sidecar gone; sign in -> full pull restores all live rows. |
| Sidecar lost but scales kept (partial clear) | First-sync union. With no `base`, a device never tombstones remote rows; a remote tombstone for a local id is applied only if the bodies are equal (`savedEqual`), otherwise the local copy is pushed and the row revived (F22, accepted no-loss direction). A live remote row of the same id with a different body is the edit-vs-edit case (s9 first sync). |
| Older build gets a record it cannot read | Kept opaque, not pushed back; shown per existing opaque rules. |
| User deletes account | Server rows gone (cascade); local scales kept; sidecar removed. |
| Account email changed / lost inbox | Out of scope v1; scales stay on device. |
| `MOVE_ON_OLD` host | No `SYNC_ORIGINS` row: no UI, no calls (test). |

## 16. Risks, recovery and exit

Risks:
- R1 Supabase pause at low traffic (A3): pull fails until restored; mitigated by keep-alive or Pro (O8); no local loss.
- R2 Code guessing without per-email lockout (A2): bounded by expiry + IP limits; attacker damage reversible within 30 days.
- R3 Resend free quota or deliverability (A5): spam folder -> copy says "check spam"; paid tier if needed. Includes code sends to third-party inboxes via `create_user:true` (R1-12), bounded by the project hourly cap and per-user 60 s limit (F16).
- R4 Conflict copies confuse users: rare (needs offline edits on two devices); accepted for no-loss.
- R5 Token in localStorage readable by an XSS: app has no user-HTML sinks known; accepted, reviewer checks new code adds none.
- R6 Vendor change of free terms: exit path below.
- R7 Lane scope creep into the move region: freeze tests stay green (A2 lane brief names them).

Recovery:
- Bad client release: revert lane on `dev` (`claude/dev-revert-<lane>`); on prod remove the `SYNC_ORIGINS` row (one-line PR) -> UI hidden, local scales untouched, server rows kept.
- Mass tombstone (attacker or bug): owner runs one transaction: `update sync_users set last_rev = last_rev + n where user_id = $u returning last_rev` (lock the counter row, as `push_scales` does), then set `deleted=false, record` kept, `rev` = consecutive values above the old `last_rev` for each row `where user_id=$u and deleted and deleted_at > now() - interval '30 days'` (R1-2) within 30 days; devices pull the revival.
- Junk overwrite (attacker or bug, R2-3/R3-2): same transaction shape: pick any version from `scale_history where user_id=$u and scale_id=$s` (e.g. the last one with `replaced_at < $t`), set it as `record` with a fresh rev from the locked `sync_users.last_rev`; devices pull the restored bodies.
- Exit: `pg_dump` the one table + `auth.users` emails; port to CF D1 with the same columns; implement OTP in Functions (old plan's lane A, with F15-F18 fixes); switch `SYNC_ORIGINS` to the new endpoint. Clients re-sign-in once.

## 17. Old-plan findings disposition

| Finding | Disposition |
|---|---|
| F15 brute force over time | Vendor-handled limits; residual GATED (A2, V2); damage reversible (tombstone bodies kept 30 days, section 16). Open until V2 is recorded. |
| F16 email quota DoS | Applies: project emails/hour cap below Resend daily quota; per-user 1/60 s (section 10). |
| F17 code HMAC vs display | Obsolete: no verify page, vendor generates and checks the code. |
| F18 phishing relay | Applies: domain-naming email and panel copy (section 10); residual listed. |
| F19 tombstone retention vs `since=rev` | Fixed: rows never purged, only bodies after 30 days; cursor pull always sees tombstones. |
| F20 normalisation duplicates | Obsolete: identity is `instanceId`, not content; version-bump test in lane E. |
| F21 `pos` has no client home | Obsolete: order is local `displayOrdinal`; order is a per-device setting (not synced). |
| F22 resurrection on sidecar loss | Accepted (no-loss direction); rule in section 15; lane E test asserts it. |
| F23 stale surroundings | Fixed: this file replaces the old plan's sections 8 and 13 entirely. |

## 18. Owner questions (recommended option first)

- Q1 Bridge: (a, rec) no bridge, banner carries scales; sync launches after the 301 / (b) bridge before ~2026-11-22.
- Q2 Backend: (a, rec) Supabase free / (b) CF D1 + own auth / (c) other.
- Q3 Pause: (a, rec) keep-alive ping if terms allow (V3), else accept pauses / (b) Pro $25/mo from launch.
- Q4 Hidden seeds per device (A4): (a, rec) yes / (b) sync them.
- Q5 Flag contingency (section 6): (a, rec) decide at that time / (b) pre-authorize adding the old host to `SYNC_ORIGINS` if unarmed.
- Q6 Conflict copies (D10): (a, rec) keep both as separate scales / (b) last writer wins (can lose an edit; conflicts with release safety).
- Q7 Sender subdomain: (a, rec) `mail.handpantheory.com` / (b) root.

## 19. Continuation point

Next: run `/plan-eng-review` on this file; record verdict and owner answers Q1-Q7 here. Then owner O1-O4 on the dev project while lanes E and S build in parallel; then A1 -> A2 -> Q on DEV; R only after stage 2 S3b (301) and owner go.

## Round 2 changes (2026-11-05)

| Finding | Fix | Where | Test |
|---|---|---|---|
| R1-1 | Revival under a fresh local id with sidecar `alias[localId]=remoteId` (chosen over new row + tombstone: keeps one remote id, no extra conflicts) | s8 identity remap, s9 rule, s15 | E: revival alias test |
| R1-2 | Per-user counter row `sync_users.last_rev` locked `for update` in `push_scales`; revival SQL uses it | s8, s16 | S: concurrent-push smoke |
| R1-3 | SELECT-only RLS; writes only via definer RPCs with `auth.uid()` and pinned `search_path`; anon revoked | s10 | S: direct PATCH/POST refused, anon RPC refused |
| R1-4 | Conflict copy pushed as new row; `base[X].rev=R.rev` before pushing L | s9, s15 | E: converge to two scales in one cycle |
| R1-5 | `base` set from post-apply revisions | s8, s9 step 4 | E: pull then push sends 0 rows |
| R1-6 | First sign-in meaning/identity match adopts remote id via alias; identity collision makes a renamed copy | s9 first sync | E: meaning match + collision tests |
| R1-7 | `deferredDeletes` retried after each commit; dropped if edited | s8, s9, s15 | E: deferred delete test |
| R1-8 | AFK decision D14: "Add N scales?" Yes / Not now; `localOnly` never pushed or deleted | s3, s9, s10b, s15 | E: localOnly test; A2 e2e; Q human (7) |
| R1-9 | Sign-in sheet spec: placement, input types/autocomplete, numeric 6 maxlength, focus, aria-live, 60 s cooldown, error keys for 8 tables | s10b, s12 A2 | A2 e2e; Q human (5)(6) |
| R1-10 | V7 pg_cron gated (A9); keep-alive and purge runner named (GitHub Actions) | s4, O8 | V7 |
| R1-11 | Lock holder pushes after every changing reconcile | s9 multi-tab, A2 | A2 two-tab e2e |
| R1-12 | Third-party inbox codes via `create_user:true` listed under R3/F16 | s10, s16 R3 | none (bounded by caps) |

AFK decision log: D14 (R1-8) chosen as the conservative option per coordinator instruction; owner may override.

## Round 3 changes (2026-11-05)

| Finding | Fix | Where | Test |
|---|---|---|---|
| R2-1 | Pull matches L by `localOf(remoteId)` (reverse alias) | s9 step 3 | E: revive on A, edit on B, A pulls twice -> one scale |
| R2-2 | Cap counts live rows only; `refused:"cap"` -> status `sync.err.cap` (all 8 i18n tables) | s8, s10b | S: 500 tombstones + 1 live accepted; 501st live refused |
| R2-3 | AFK decision D15: `prev_record`/`prev_at` kept 30 days; restore SQL in s16 | s3, s8, s16 | S: overwrite then restore |
| R2-4 | `delete_my_account` auth.users check added to V6 | s4 A7 | S: delete removes auth user and rows |
| R2-5 | `base_rev:null` on tombstone = revive (new rev, same id); on live = conflict | s9 push | S: both cases |
| R2-6 | Decisions in order D13, D14, D15; A9 folded into assumptions table | s3, s4 | none |

AFK decision log: D14 (R1-8), D15 (R2-3), both conservative; owner may override.

## Round 4 changes (2026-11-05)

| Finding | Fix | Where | Test |
|---|---|---|---|
| R3-1 | Revoke EXECUTE from public, anon; grant authenticated only (purge: dedicated role); raise when `auth.uid()` is null | s10 | S: lint + anon RPC call refused |
| R3-2 | `prev_record` replaced by `scale_history` (every overwrite, 30 days); restore picks any version | s3 D15, s8, s16 | S: two overwrites then restore original |
| R3-3 | Only the lock tab refreshes; it re-reads the sidecar on `storage` events; sign-out anywhere stops pushes | s9 | A2: two-tab e2e |
| R3-4 | Delete push keeps the body; only the purge clears it | s9 push | S: body readable after tombstone |
| R3-5 | 200 rows/call, 5000 rows/user total, unknown-id tombstone refused | s8 | S: three refusal cases |
| R3-6 | N computed after first-sync matching; 0 -> no prompt | s9 first sync | E: re-sign-in gives N=0 |
| R3-7 | Lane S PR body carries dev smoke output before O5 | s12, s13 O5 | review checks PR body |

## Round 5 changes (2026-11-05)

| Finding | Fix | Where | Test |
|---|---|---|---|
| R4-1 | `auth.uid()` null raise only in `push_scales`/`delete_my_account`; purge role `sync_purger`; runner pg_cron (V7) else O8 Actions | s10 | S: purge clears >30-day bodies and history only |
| R4-2 | History cap 2000 rows/user, overwrite refused with `sync.err.rate` (8 i18n tables); chosen over a rate limit (one count in the locked RPC, no window state, no eviction) | s8, s10b | S: 2001st refused, history unchanged |
| R4-3 | s8 says tombstones "do not count toward the 500 live cap" | s8 | none |

## 20. Stop

This file is the whole deliverable of this planning step. No code, no accounts, no DNS, no remote writes have been made.

## Review 1 (independent, 2026-11-05)

Code claims checked by symbol in `index.html`: `commitSaved`, `applySavedCommand` (staged candidates, `allocate`, `move-import`, `last-visible`), `savedEnvelopeShape`, `savedCryptoId`, `finishSavedBoot`, `moveImport`, `savedChannel`. Per-entry counter is `row.revision` (the plan's `localRevision` is the sidecar copy of it).

| id | sev | issue | evidence | fix |
|---|---|---|---|---|
| R1-1 | high | Revival with the same `instanceId` is impossible on a device that deleted it. `usedInstanceIds` keeps deleted ids forever and must be unique, with `usedInstanceIds[displayOrdinal-1]===instanceId`. "Reinsert R" (s9 rule 3b) and the "row revived" outcomes in s15 cannot keep the remote id, so the edit-beats-delete path breaks the shape or forks identity. | `savedEnvelopeShape` (used Set size check, ordinal index check); `allocate` always pushes a new id | Spec a remap: revive under a new local id and record `alias[localId]=remoteId` in the sidecar, or push the revived body as a new row and tombstone the old one. Add an E test. |
| R1-2 | high | Cursor `rev=gt.<cursor>` taken from a global sequence skips rows. Two concurrent `push_scales` transactions take rev 10 and 11, 11 commits first, a pull sets cursor=11, and rev 10 is never pulled. Edits or tombstones are lost silently. | s8 `rev` "from a global sequence"; s9 pull step 2 | Serialize per user inside `push_scales` (`pg_advisory_xact_lock(hashtext(auth.uid()::text))`, or lock a per-user counter row and take rev from it). Add a smoke test with two concurrent pushes. |
| R1-3 | high | INSERT and UPDATE RLS policies let any signed-in client write `saved_scales` straight through PostgREST. That bypasses CAS, the 500-row cap and rev assignment: a stale or buggy client can set any `rev` and break cursors for its own account. | s10 "SELECT/INSERT/UPDATE policies", cap "enforced in the RPC" | Grant authenticated SELECT only. Make writes go through `push_scales` as `security definer` with `auth.uid()` (and `search_path` pinned), or put rev/cap in triggers. Smoke: a direct PATCH is refused. |
| R1-4 | medium | Edit-vs-edit loop. s9 keeps L at id X and pushes L with `base_rev=B.rev`, but the server is at R.rev, so the push always conflicts and hits the 3-loop cap. | s9 rule 3c, push step 2 | When the conflict copy is made, set `base[X].rev=R.rev` before pushing L. Add a test that both devices converge to 2 scales within one cycle. |
| R1-5 | medium | Echo push. `sync-apply` overwrites bump `row.revision` (as the existing edit path does), so a base that stores the pre-apply revision makes the next push re-upload every pulled row. | `edit` branch `row.revision++` | Set `base[id]` from the committed post-apply revision. Add a test: pull then push sends 0 rows. |
| R1-6 | medium | The first-sign-in merge ignores meaning dedup. Two devices that saved the same scale under different ids end up with duplicates, or a deck-id/identity collision (`inventory-collision`). `move-import` skips by meaning, but if sync-apply skipped by meaning the remote row would never get a base and would be re-evaluated forever. | `move-import` `have.has(read.meaning)` / `identities` | Define the rule: on equal meaning, adopt the remote id as an alias (or keep both and accept duplicates). Spec the identity-collision case. Add tests. |
| R1-7 | medium | "Last-visible skip stays pending" is false. The cursor advances past the tombstone and the push diff sees L unchanged, so the delete is never applied and the next local edit revives it. | s9 rule last bullet; s15 row | Keep a `deferredDeletes` set in the sidecar and retry it after each commit, or state the actual outcome (kept locally, revived on edit) and accept it. |
| R1-8 | medium | Account switch on a shared device. Sign out keeps local scales, then signing in as another email unions user A's scales into user B's account. | s9 sign-out / first sync | Accept and document it, or on a different email ask "add this device's N scales to this account?". Owner question. |
| R1-9 | medium | The sign-in sheet has no UI/a11y/i18n spec: missing `type=email autocomplete=email`, `inputmode=numeric autocomplete=one-time-code maxlength=6`, focus moves, an `aria-live` status, a resend cooldown matching 60 s, error keys (bad code, expired, rate-limited, send failed), and where the panel lives in the menu. | s12 lane A2 | Add a UI subsection and acceptance rows for these, including keyboard-only and VoiceOver checks in Q. |
| R1-10 | low | The 30-day body purge needs pg_cron (or similar). It is not listed as a gated assumption, and the keep-alive scheduler (who runs it, where) is unspecified. | s8, D13 | Add V7 (pg_cron on free) and name the keep-alive runner (for example a GitHub Actions cron) under O8. |
| R1-11 | low | A tab without the lock that commits relies on `savedChannel` reconcile to trigger a push in the lock tab. Not stated. | s9 multi-tab | Push on reconcile in the lock holder. Add an e2e with two tabs. |
| R1-12 | low | `create_user:true` lets anyone trigger codes to third-party inboxes. This is bounded by the hourly cap but not named. | s10 | List it under R3/F16. |

Bridge verdict (s6): honest and correct. `move-import` gives every moved scale a fresh id (`allocate`), so a bridge would create cross-origin duplicates. Banner coverage is a superset, and the timeline has no slack. Supabase with plain fetch is feasible (the GoTrue/PostgREST endpoints are REST). The pause risk is bounded and has no local loss. Smallest approach: justified.

Readiness:
1. No open blocker/high: **FAIL** (R1-1, R1-2, R1-3).
2. Assumptions verified/gated/accepted: PASS (V1-V6), with V7 to add.
3. Smallest approach justified: PASS.
4. Phases complete: PARTIAL (sign-in UI spec, R1-9).
5. Dependencies: PASS.
6. Verification covers failure cases: PARTIAL (concurrent push, direct-write refusal, revival remap and echo tests missing).
7. Recovery: PASS (revert, SYNC_ORIGINS row, 30-day revival SQL; the SQL must use the per-user rev from R1-2).
8. Continuation point: PASS.
9. Scope/stop: PASS.

**Overall: NOT READY.** Fix R1-1 to R1-3, address R1-4 to R1-9, then run a fresh review.

## Review 2 (independent, 2026-11-05)

Round 1 check: R1-1..R1-12 each appear in the plan body as the Round 2 table says (s8 identity remap + `sync_users` counter, s9 rules, s10 RLS/definer, s10b sheet, s4 A9/V7, O8, s12 acceptance rows, s16 R3). SQL logic: `insert ... on conflict do nothing` + `select last_rev ... for update` serializes one user's pushes, so revs commit in order and `rev=gt.<cursor>` cannot skip (R1-2 sound). SELECT-only RLS + definer RPCs with `auth.uid()` and pinned `search_path` closes R1-3. R1-4 converges: the other device overwrites X with L's body (unchanged since base) and inserts the new row with R's body.

| id | sev | issue | evidence | fix |
|---|---|---|---|---|
| R2-1 | medium | Pull matching contradicts the alias rule. s9 step 3 matches L "by `instanceId`", but s8 says all logic goes through remote ids. Scenario: device A revives R under `newLocal` (alias). B edits R again. On A's next pull, no live entry has `instanceId===R.id`, so the "no L, B present, R.rev > B.rev" rule fires and revives a second copy. Each later remote edit adds another duplicate. | s9 step 3 header; s8 identity remap | Match L by `localOf(remoteId)` (reverse of `alias`, else id). Add an E test: revive, then a remote edit, then pull gives one scale updated in place. |
| R2-2 | medium | The 500-row cap counts rows that are never deleted. Tombstones are kept forever (F19), and each edit-vs-edit conflict adds a row. A user who creates and deletes scales over time is refused permanently, so new scales stay unsynced with no message. | s8 "max 500 rows per user"; "keeps the row forever" | Count only `deleted=false` rows. Add a smoke case: 500 tombstones + 1 live push is accepted. Map the cap refusal to a status/i18n key. |
| R2-3 | medium | "No permanent loss" covers deletes only. An attacker or buggy client can push live rows with junk `record` bodies. That overwrites the bodies with no history, and the s16 recovery SQL only revives tombstones. | s10 damage cap; s16 mass tombstone | Keep the previous body in a `prev_record`/history column for 30 days in `push_scales`, or restate the claim as delete-only and list overwrite under R2. |
| R2-4 | low | `delete_my_account` deletes from `auth.users` as a definer owned by `postgres`. That privilege on the `auth` schema is not verified. | s9 delete account; s10 | Add it to V6 (call it on dev with a test user). |
| R2-5 | low | `base_rev:null` "must not exist or be deleted-and-revived" is ambiguous. A null-base push onto an existing tombstone could revive it or conflict. | s9 push step 2 | State that null + existing tombstone = revive allowed. null + live row = conflict. Add a smoke case. |
| R2-6 | low | Cosmetic: D14 is listed before D13, and A9 sits in a separate table after a blank line. | s3, s4 | Reorder. |

Readiness: (1) PASS, no open blocker/high. (2) PASS: V1-V7 gated, A4 owner Q. (3) PASS. (4) PASS. (5) PASS. (6) PARTIAL: R2-1/R2-2 tests to add. (7) PARTIAL: overwrite recovery (R2-3). (8) PASS. (9) PASS.

**Overall: READY**, on condition that R2-1..R2-3 are folded into lanes E/S acceptance before dispatch. No re-review is needed for those edits if they are applied as written above.

## Review 3 (/plan-eng-review)

Independent, 2026-11-05, non-interactive (auto-chose recommended non-destructive options; no decision points needed owner input). Round 1-2 fixes checked in the body: R2-1 (`localOf` in s9 step 3), R2-2 (live-only cap + `sync.err.cap`), R2-3 (`prev_record`/`prev_at` + s16 SQL), R2-4 (V6), R2-5 (s9 push), R2-6 (ordering) all present. i18n table count 8 confirmed (`data/i18n/` has 8 files).

| id | sev | issue | evidence | fix |
|---|---|---|---|---|
| R3-1 | high | `revoke execute ... from anon` is not enough. Postgres grants EXECUTE on new functions to PUBLIC, and Supabase default privileges also grant to `anon`/`authenticated`; anon keeps access via PUBLIC. With `auth.uid()` null, `delete_my_account`/`push_scales` behaviour then depends on null handling. | s10 "with `revoke execute ... from anon`" | `revoke execute on function ... from public, anon;` `grant execute ... to authenticated;` and inside each definer fn `if auth.uid() is null then raise exception`. Keep the S smoke "anon cannot call either RPC" and add a static SQL lint for `from public`. |
| R3-2 | medium | `prev_record` holds one generation, so R2-3's recovery is defeated by two pushes: junk overwrite #2 moves junk #1 into `prev_record`. Same via delete -> revive(junk) -> edit(junk). The "no permanent loss" claim in s10 is still false for overwrites. | s8 `prev_record` "before its last overwrite"; s16 junk-overwrite SQL | Only set `prev_record` when `prev_at is null or prev_at < now() - interval '30 days'` is wrong too (loses legit history); instead keep a `saved_scales_history(user_id, scale_id, rev, record, at)` append table purged at 30 days, capped per user, and restore from it; or restate the claim as one-generation and list under R2. Add an S smoke: two junk overwrites then restore returns the original. |
| R3-3 | medium | Cross-tab sidecar staleness. Sign-in/sign-out happens in whichever tab shows the sheet, but sync runs only in the `hpfc.sync` lock holder with its in-memory sidecar. Sign-out in tab B leaves tab A pushing with the old token (or user); sign-in in B leaves A idle. Supabase refresh tokens rotate (single use), so two tabs refreshing also signs the user out. | s9 multi-tab, sign out; s8 sidecar in localStorage | Lock holder re-reads `hpfc.sync.v1` on `storage` events and before each call; only the lock holder refreshes tokens; the sheet tab hands sign-in tokens over via the sidecar. A2 two-tab e2e: sign out in B stops A's pushes; sign in in B starts A's pull. |
| R3-4 | medium | Tombstone push body semantics unstated. Push sends `record|null` with `deleted`; if `push_scales` writes `record=null` on delete, the 30-day body retention (and s16 revival) is gone. | s9 push step 2; s8 "body kept 30 days" | State: on `deleted=true` the RPC keeps `record` and sets `deleted_at`; only the purge nulls it. S smoke: tombstone then read row has the body. |
| R3-5 | low | Unbounded server growth: tombstone inserts (`base_rev:null`, `deleted:true`, no row) and rows-per-call are uncapped; only live rows are capped. | s8 cap; s9 push | Cap rows per `push_scales` call (e.g. 200) and total rows per user (e.g. 5000); refuse inserting a tombstone for an unknown id. |
| R3-6 | low | Re-sign-in to the same account after sign-out prompts "Add N scales?" for scales that are already in the account, because sign-out deletes the sidecar (`userId` unknown). Meaning-match adoption runs first, so N may be 0; spec that N counts only unmatched scales after the pull. | s9 first sync; s9 sign out | Compute N after first-sync matching; E test. |
| R3-7 | low | Lane S CI only lints SQL; CAS/cap/revive logic is evidenced only by an owner-run smoke the reviewer cannot see at the head SHA. | s12 lane S verify | Record the smoke output (counts, no tokens) in the PR body and have O5 apply only after it is attached. |

No issue found with: single-file constraint (plain `fetch`, no `<script src>`, constants only), analytics (no new events, `page_location` unchanged), share links/`RECORD_VERSION` untouched, frozen move region, lane file ownership (A1/A2 serial, E/S disjoint), per-lane tests.

**Overall: NOT READY** until R3-1 (high) is fixed in s10 and lane S acceptance. R3-2..R3-4 should be folded into s8/s9/s12 before dispatch; R3-5..R3-7 can be lane nits. No full re-review needed if fixes are applied as written.

## Review 4 (/plan-eng-review)

Reviewer did not write the plan or earlier reviews. Non-interactive; recommended options auto-chosen.

R3 verification: R3-1 FIXED (s10: revoke from public, anon; grant authenticated; `auth.uid()` null raise; S lint + anon smoke). R3-2 FIXED (s3 D15, s8 `scale_history` on every overwrite, s16 restore any version, S smoke). R3-3 FIXED (s9 lock-holder-only refresh, `storage` re-read, A2 two-tab e2e). R3-4 FIXED (s9 push step 1, S smoke). R3-5 FIXED (s8 caps + unknown-id refusal, S cases). R3-6 FIXED (s9 first sync, E test). R3-7 FIXED (s12 S, s13 O5).

| id | severity | evidence | fix |
|---|---|---|---|
| R4-1 | medium | s10 says *each* of the three functions begins with the `auth.uid() is null` raise, including `purge_tombstones`, which runs from a scheduled job (no JWT, `auth.uid()` null). As written the purge always raises: tombstone bodies and `scale_history` are never purged, so the 30-day retention claims (s8, D15) are false. Fails safe (data kept longer), not a loss. The "dedicated role" is also unnamed. | Apply the null-uid raise to `push_scales` and `delete_my_account` only; name the purge role (e.g. owner `postgres` via pg_cron, execute revoked from public, anon, authenticated); S smoke: purge run as that role clears a >30-day body and history row, and an authenticated call is refused. |
| R4-2 | medium | `scale_history` has no per-user cap (s8). One signed-in account can loop 200-row x 8 KB edit pushes; each inserts a history row, so storage grows without bound for 30 days (free-tier DB size, R1/R6). R3-5 capped `saved_scales` only. | Cap history per user (e.g. keep newest 20 per `scale_id` and 10000 per user, trimmed inside `push_scales`), or refuse pushes above a per-user rows/hour rate; S smoke case for the cap. |
| R4-3 | low | s8 "tombstones do not count (R2-2)" sits right after the 5000-total cap that does count tombstones; reads as a contradiction. | Say "tombstones do not count toward the 500 live cap". |

Criteria: 1 no open blocker/high PASS; 2 R3 findings fixed PASS; 3 security (grants/definer/RLS) PASS with R4-1; 4 data safety / no loss PASS; 5 multi-tab and token rotation PASS; 6 caps and abuse bounds PASS with R4-2; 7 tests per lane acceptance PASS; 8 owner gates PASS; 9 scope/stop PASS.

**Overall: READY.** Fold R4-1 and R4-2 into lane S's brief as acceptance items before dispatch; R4-3 is a wording nit. No re-review needed if applied as written.

## Owner answers (2026-11-05)
Q1-Q7: all (a), the recommended options. Next: owner O1-O4.

## Round 6 changes (2026-11-05, owner request)
| id | change | sections | acceptance |
|---|---|---|---|
| O-429 | Any HTTP 429 from the auth endpoints shows `sync.err.rateLimited` ("Too many requests, try again in a few minutes") in all 8 locales; no automatic retry | s10 i18n keys | Lane A test: stubbed 429 on send and on verify each shows the message, makes no second request, keeps saved scales unchanged |

## Owner setup log (2026-11-06)

- O1 done: `handpan-theory-dev` (ref cknlvnxyjwcjzzrmlhum, us-east-1) by owner; `handpan-theory` (ref maidverpsglouqqfleby, us-east-1) created via Supabase MCP at owner's request. Org Bamboo Grove, free plan.
- Public project-key values omitted from this recovery copy; retrieve current configuration only through an authorized setup step.
- O2-O4: owner reports Resend + SMTP set up in both projects; pending: dev code-email test screenshot. MCP cannot read auth settings.
- Private test-inbox and account-confirmation details omitted; the owner supplies a test inbox for manual QA.
- 2026-11-07: prod (handpan-theory) verified by owner: code email (6-digit, Resend sender), rate limit 30/h, Site URL https://handpantheory.com; Confirm email off on dev and prod.
- 2026-11-07: owner confirmed code emails for all four cases: dev returning, dev first sign-in, prod first sign-in, prod returning. Email setup complete.
- 2026-11-07 check-in (owner): O8 = daily keep-alive ping (GitHub Actions, anon GET /auth/v1/settings per project); RC 2026-11-06 held for a combined release; host-swap release runs next, alongside lane S review.

- 2026-11-07 (owner): dev smoke pass=17 fail=0 skip=3. The 3 skips are accepted for O5. The purge-as-sync_purger check must run before O8 wires any scheduled purge. Lane S review PASS_WITH_NITS at 48eb66e4 (already on dev via #965); main #924 held.
