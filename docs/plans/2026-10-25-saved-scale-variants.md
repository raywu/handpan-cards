# SAVED-SCALE-VARIANTS — coexistence without inventory overwrite

2026-10-25. Proposed plan; implementation, migration and CLAUDE.md edits are held.
Decision: **Conditional Proceed for design; not operationally validated.** The
owner's desired coexistence is clear; the pending behavior interview and exact
instruction approval remain pre-code gates. No new schema has been activated.

## Problem, evidence and scope

The app currently uses canonical note inventory as both musical identity and
saved-record identity. Importing/Add of a differently named or positioned scale
with the same notes overwrites its sibling. Owner confirms separate tabs and
reports a fresh custom-layout link still cannot coexist with the other instrument.
Root decoded the new link: valid, correct updated positions, unchanged inventory
identity. This explains replacement, not the earlier omitted-angle report. Owner
also reports the diagram remained custom when copying the earlier fresh link;
retain that as unresolved human evidence, never dismiss it as an unsaved draft.

The separate SHC async repair prevents obsolete LINK completion UI; it does not
add variants or establish the omitted-angle cause. Its held main581/DEV582 and
CI40239404703 have immutable head9e47e06a. That run FAILED mutation verification:
app881/browser480 passed, but ten quoted mutation selectors and two redundant
legacy hide faults failed the repository runner contract. Corrections are re-proved
with faithful splitting and actual runner partitions; renewed reviewed head92d6516b
awaits full CI on that branch, no DEV delivery yet. Re-resolve state before execution.
SPS remains deferred/preserved; DUPLICATE-NOTES implementation remains held.

Verified source: core.identitySeed/deckId; registerDeck/CUSTOM; sameDeck/
rememberScale/replaceScale/forgetScale/restoreScales; ENGINE-SPEC12/14.
Independent research at89ababec is source/schema a3e6a8cf, UX d32e5ef1 and platform
094b8aa0 (retained in linked notes). Browser documentation is verified evidence;
new API access, migration, concurrency, performance and native behavior are NOT
tested. No owner storage, profile, clipboard or private link was accessed/uploaded.

Scope: app-local saved identity, persistence boundary, import/Edit/select/delete/
replacement adapters and necessary small status/conflict/disambiguation UI. Keep
engine inventory/card identity, wire6/record4 writers, grammar, geometry, print,
layout-reset/parent rules and SHC ownership intact. No cloud service, dependency,
build step, global tool/config, broader cleanup or duplicate-note implementation.

## Proposed observable contract — owner acceptance pending

| Action | Proposed outcome |
|---|---|
| Import/Add same notes but different name/layout or meaningful option | Retain and select another saved instance; sibling remains independent |
| Exact repeat import/Add/reload | Reuse selected exact match, else first committed match in stable order; no accumulating clones |
| Edit notes/name/options | Update only the selected instance; stable local handle/order, even if engine inventory ID changes |
| Edit converges onto a sibling | Keep both; never silently merge/delete or rename either |
| Same/truncated visible names | Collision-only visible ordinal and matching accessible label; stored/shared names unchanged |
| Two tabs modify different instances | Both acknowledged mutations survive |
| Stale same-instance Edit/delete | Keep persisted winner and dirty draft; refuse overwrite; offer review/cancel or explicit save-as-separate |
| Import retained older content URL | Reuse/create that content as a separate instance; never roll back an edited sibling |
| Ordinary seeded behavior | Preserve existing replacement-slot ordering, delete promotion and two-tap RESET semantics for recognized records |

Default is preservation of existing seeded RESET/delete policy, not the UX lane's
optional redesign: RESET clears hidden flags and recognized replacement groups;
plain custom siblings imported/created without replaces remain. This avoids an
unrequested behavioral change. Unknown/opaque records stay preserved. Retaining
former replacements instead can be proposed separately; do not silently select
that alternative. Existing warning accuracy must be checked against the approved
contract before implementation.

Semantic equality is a full validated meaning comparison, not the 32-bit id, wire
text, checksum or displayed label. Include canonical inventory spelling/octaves/
zones, explicit-versus-auto name intent, parent intent, palette, mirror pair,
anchor and normalized seats/angles. Normalize only equivalent defaults accepted
by existing validators/codec; absent/all-null angles are equivalent, but explicit
absolute positions must not be erased merely because they match today's default.
Keep inferred versus explicit parent distinct. Existing Edit intentionally clears
explicit parent and count/reset rules remain; those changes update the instance.
Never parse invalid/unknown input merely to manufacture an equality match.

## Smallest coherent architecture

Choose stable instance wrappers around unchanged generated decks. Reject changing
core.deckId to include options (identity churn/version coupling) and content-keyed
edit identity (Edit convergence/rekeying). Use full semantic comparison as import
lookup only; no persisted second copy of a large fingerprint is necessary.

Proposed explicit responsibilities:

| Element | Responsibility |
|---|---|
| generated deck.id | Unchanged engine inventory identity |
| entry.instanceId/revision | Stable local saved identity and optimistic version |
| entry.record | Capability-tagged {v,s,o}; local metadata stays outside it |
| runtime registry | instanceId→entry/deck wrapper; rendering/share/print unwrap the generated deck |
| tagged selection | built-in id or saved-instance id; never infer local identity from a #s= route |
| slots/hidden | Explicit built-in owner mapping/visibility in the collection; record replaces retains local provenance |
| collectionId/revision | Detect whole-store replacement and serialize commands; not portable/public identity |

Use explicit selectedEntry/selectedDeck and chip view models, not a Proxy or UUID
substituted into deck.id. Audit every id consumer, including caches/progression,
render/print, seeded routes, Edit target and analytics. Preserve selectDeck's
explicit retireLinkUI even if two instances share an identical URL.

Extract pure buildGenerated(text,options,guard) from generateDeck's construction
without registry mutation; preserve one parse/build and correction validation.
Never inherit replaces by finding an inventory sibling. Build/validate first,
serialized instance command second, publish registry/selection/success last.
Keep genuine different-inventory hash conflicts distinct from valid siblings:
compare identitySeed meaning and preserve any refused record/recovery source;
do not silently remove true-collision defenses or overwrite through a hash match.

## Persistence choice and protocol

Proposed minimum: new key **hpfc.saved-scales.v1**, envelope schema1, exclusive
Web Lock **handpan-cards:saved-scales:v1** for ALL durable new-format writers.
Reserve these names in the ledger before implementation. No wire/record version
bump; held DUP's candidate7/5 capabilities remain its decision. Do not dual-write
variants into hpfc.scales.v3 or place local handles into old hpfc.deck.

Envelope contains collectionId/revision, ordered entries, nextDisplayOrdinal,
selected preference, explicit slots/hidden, and immutable migration source raw
strings/metadata. Each entry has instanceId, revision, displayOrdinal and record;
runtime decks are not persisted. Allocate collision-checked local UUIDs with
guarded randomUUID/getRandomValues, bounded eight attempts, inside serialization;
failure retains existing data/draft. This is no note/saved-count cap. Ordinals
increase and are not reused on delete/RESET. A new collection gets a new epoch;
every command carries its expected collectionId, so stale tabs cannot mutate a
newly recreated store. No timestamp lock leases or forced lock stealing.

Every durable command: acquire exclusive lock → reread/validate current envelope
→ compare collectionId/command-specific preconditions → apply command to a copy
→ one setItem → acknowledge and publish. Save/delete require target revision.
Slot/hidden commands also compare captured slotStateRevision/expected owner;
RESET captures its affected recognized instance IDs/revisions plus slot/hidden
state when armed, then rejects/re-arms if that scope changed before the second tap.
A replacement created/edited after arming cannot be silently deleted; an unrelated
plain Add need not conflict. Recompute/check this proof INSIDE the lock.
No UI/network/engine await inside the commit section; stage expensive pure work
outside and validate its source revision/raw bytes again after acquisition.

Successful setItem return is the API acknowledgment boundary, not readback or
disk flush. Optional readback is diagnostic only: if it throws AFTER a successful
write, publish the acknowledged command once and do not claim rollback, mark the
old winner current, retry allocation or silently create another instance. Crash
after write/before UI resumes from the committed envelope. Test migration/Add/
Edit at that boundary explicitly. Later incompatible observations go through
reconciliation/recovery, never an automatic replay of the same mutation.
Rejected/absent lock must
NEVER lead to unlocked persistent writes. storage events are notification only;
missed events cannot bypass the locked revision check. An old unmodified writer
cannot be fenced; namespace isolation prevents it collapsing new variants.

localStorage RMW has no locking guarantee; Web Locks coordinates cooperating
contexts. See [WHATWG](https://html.spec.whatwg.org/multipage/webstorage.html#introduction)
and [Web Locks](https://www.w3.org/TR/web-locks/#api-lock-manager). IndexedDB is
the fallback design alternative if supported product contexts require durable
writes without Web Locks or envelope measurements fail; it is not an automatic
second backend. IDB requires transaction-complete/abort/blocked-upgrade tests
([transaction model](https://www.w3.org/TR/IndexedDB/#transaction-concept)).
Feature detection is not operation proof. Web Locks/randomUUID require supported
contexts; direct file storage is not uniformly defined. Actual HTTPS Chromium and
claimed Safari/iOS behavior must be checked, with no install/global changes.

### Session and asynchronous UI behavior

Proposed boot fallback: unavailable lock/storage gives a visibly marked session-
only memory adapter, never an unlocked durable writer. If a supported envelope is
readable, initialize a document-local copy of that acknowledged snapshot. If only
readable legacy data exists, build the session collection from it without claiming
migration or changing old keys. Denied reads are UNKNOWN, not empty saved data:
show built-ins/session additions with an access warning and preserve all persistent
sources. Corrupt/newer envelopes stay protected; do not parse/normalize them under
an older schema or silently fall back to stale legacy content as current. Offer
read-only recovery and explicitly labeled temporary use, not an empty-store save.
Localize that session changes belong to THIS TAB and disappear on reload/closure;
they are not cross-tab durable saves. Single-file/disk-open generation/Edit/share
remains functional. Session state never silently replaces acknowledged durable
data after capability recovery.
During established durable mode, failed commit retains the sheet/draft and saved
winner; no normal saved-success or automatic session conversion. Retry is explicit.
This fallback/copy is an owner acceptance gate, not silently activated behavior.

Ordinary chip selection renders the local view immediately and retires SHC UI;
its preferred selection can persist through a serialized metadata command. A
remote preference never hijacks another tab's practice view. Reconciliation never
writes an old route back merely because storage changed. Data mutations await ack.
Use a sheet/request generation for asynchronous Save/import completion: old
completion cannot close a newer sheet, steal focus or select a different view.
While waiting, disable duplicate submit; Back/cancel aborts queued acquisition
before commit. A synchronous granted commit cannot be undone; suppress obsolete
completion UI if context changed. Do not rebuild a generic agent/task framework.

## Migration, rollback and cross-tab conflicts

Choose the source lane's self-contained atomic envelope over a separate backup-
key/marker protocol: exact raw legacy source strings are included in the FIRST
committed envelope alongside converted entries. One-key replacement avoids a
multi-key partial-commit claim. This adds quota cost; no destructive compaction or
backup deletion to make it fit. A failed first setItem leaves old keys unchanged.
An in-origin snapshot is not independent disaster recovery or an eviction guarantee.

Under the same lock:

1. Supported valid envelope exists: authoritative. Never automatically replay
   later legacy writes. Newer/corrupt envelope: preserve entire raw string and
   refuse durable writes; do not initialize an empty collection over it.
2. Absent envelope: distinguish absent versus denied/corrupt old sources. Capture
   raw hpfc.scales.v3, hpfc.scales and relevant hpfc selection/hidden source. Follow
   existing version-directed readers; absence alone allows a new empty collection.
3. Stage entries row-for-row; known legacy normalization uses the existing tested
   version conversion into current record4, valid v4 records retain values/unknown
   fields. Unreadable/newer/malformed values remain opaque, never matched/deleted
   by parsed inventory or raw replaces. Preserve JSON values plus the EXACT raw
   source string for lexical recovery; do not claim per-record whitespace identity.
4. Map legacy selected display/seeded replacement owner deterministically using
   old visible behavior; preserve list/chip order and surviving duplicate records.
   Store mapping in committed metadata. Genuine hash conflicts must not discard
   data even when a generated view is refused.
5. Recheck old raw source for observed drift, then commit complete envelope once.
   An old client may still write immediately afterward: new variants stay safe;
   flag later divergence as a recovery branch, not silent merge/re-migration.
6. Only after ack publish new instances. Crash before commit retries; after commit
   resumes the same collection/mapping without extra allocation. Never mutate the
   captured baseline later. Old code sees only its legacy branch; re-upgrade uses
   the new envelope, not a destructive downgrade projection.

Opaque entries cannot be used for selection, dedup or slot promotion until a
capable reader exists. Preserve them through Edit of siblings, delete/RESET,
read-only recovery and export. No overwritten historic instrument can be invented.

Live tabs retain local selection and draft base revision/collectionId. Clean-tab
reconcile updates caches/chips/selected committed content+route together without
focus theft. If remote delete/RESET removes the selected instance, use the existing
visible default (or its replacement), else first-visible fallback, with the corrupt-
all-hidden recovery to default preserved. Do not reimport the deleted #s= route as
a write. Preserve any surviving active control; if the focused chip itself is
removed, rehome ONLY that lost focus to the chosen visible fallback chip. Never
steal focus from another control/editor. A dirty editor keeps caret/pick/scroll/
draft and marks stale base even if its saved source was deleted.
Stale Save/delete returns conflict, preserving winner and draft. Offer explicit
save-as-separate for readable draft (fresh instance, no implicit replacement slot)
or review/cancel; no last-writer-wins or silent merging. Deleted target is conflict,
never resurrection under its old handle. Explicit later content-link import may
create a NEW instance; background reconciliation must not do so.

Rollback: scoped code revert retains both namespaces. Older code cannot display
later variants, so code rollback is not data rollback. Never overwrite later old-
client edits with the baseline or delete new envelopes. Rehearse downgrade/re-
upgrade and raw recovery/export from isolated fixtures. A recovery export action
is not permission to upload owner data or proof a download was saved. No automated
cleanup until a separately approved retention/recovery procedure exists.

## Minimal UX and instruction changes

Keep existing chip targets/order/16-character abbreviation. Only colliding visible
labels get a stable presentation suffix, also in their accessible label. Reserve
disjoint readable presentation tokens for presets and saved instances (proposed
P1..P5 versus S<creationOrdinal>, explained in localized accessible copy); no opaque
UUID or stored-name mutation. Detect collisions over FINAL rendered labels across
built-in/custom controls, not just bases. If a user's literal abbreviated name
collides with another control's suffixed result, mark that control too and repeat;
the marked set grows monotonically and terminates within visible-control count.
All suffixed tokens are unique; test malicious-looking literal suffix names and
built-in/custom collisions in every locale. Keep the full suffix readable at narrow
widths, shortening only the name base if necessary. Bind controls
to instanceId, never name/index. Rehome focus to the selected rebuilt chip; keep
Edit affordance, Escape/Back and current-href LINK behavior. New status/conflict/
session/discriminator copy uses all eight locales; note input remains English.
Measure phone/desktop/landscape clipping/targets and affected panel budgets with
real/fallback fonts. Reconciliation/background completion must not steal focus.

Authoritative behavior belongs in existing ENGINE-SPEC12/14; CLAUDE gets only
necessary instance/storage/route clarifications. An exact proposed CLAUDE diff
must be supplied in the approval packet, with cold-start/default deck, generated
source, physical conventions and engineering workflow untouched. ANY CLAUDE edit
requires explicit owner consent. Current normative one-record-per-inventory and
old-key descriptions cannot silently remain conflicting after implementation.
No root/scoped instruction, hook, skill or global configuration migration.
The concrete [instruction/spec approval packet](2026-10-25-saved-variants-instruction-approval.md)
contains the exact proposed diff and base hashes; neither source file was edited.
Approval applies only to the reviewed exact wording, not a stale/fuzzy patch.

## Swarm lanes, files and dependency order

Root integrates, owns ledger/plan/spec approval packet, floors, source sync and
browser lease. Separate worktrees; no simultaneous index.html editors. Stage
handoffs are immutable commits with plan, worktree, last/next and blockers.

| Lane | Owned files / responsibility |
|---|---|
| Root — contract/delivery | docs/ENGINE-SPEC.md, README.md and tests/suite_health.py; CLAUDE.md ONLY after explicit exact-packet approval. Shared behavior has one authoritative spec; README explains coexistence and recovery limits. |
| T — acceptance | tests/app.test.js, tests/e2e.test.js, tests/fixtures/saved_variants_v1.json; spec-first cases and baseline intended RED; no app edits |
| S — store/build | index.html app JS only, first exclusive ownership window; pure build, envelope adapter, migration/commands; hands committed source to U |
| U — instance/UI | index.html app JS/necessary markup/CSS after S hands off; tagged selection, chips/Edit/routes/conflict/session UX; data/i18n/{en,de,fr,it,es,ja,zh-Hant,zh-Hans}.json and generated inline tables through tools/sync_i18n.py |
| M — mutation | tests/mutants/sv_*.patch plus necessary preserved-intent legacy refreshes in disposable committed tree; never run mutations in editor trees |
| ENG/design | Fresh independent non-author plan and final source/evidence review, read/report only |

S/U do not edit index in parallel. T and M can work independently against frozen
contracts; root serializes all host browser work. Test sandbox support, if required
for async lock/version events, gets a distinct explicitly reviewed fixture/helper
lane/window; no test-only production fallback or unrelated helper redesign.

## Validation and staged execution plan — not run

Pre-code gates: approve proposed user contract/fallback, exact CLAUDE patch and
namespace reservation; resolve current SHC/DEV base and DUP reader ownership; run
approved bounded API diagnostics in owned profiles if needed. Missing locks must
exercise fallback, never weaken concurrency to claim compatibility. No actual
owner migration occurs during diagnostics.

T freezes literal public fixtures, exact titles/counts and mutant intents before
production edits. Existing policy tests require reviewed spec amendments, not
silent deletion. Baseline floors here are app881/e2e480; re-resolve accepted base,
raise only affected observed rows, never lower another. New behavior groups:

| Group | Required observable pass / intended negative fault |
|---|---|
| SV1 identity/import | Two same-inventory name/layout variants both orders; identical/legacy equivalent imports reuse; full equality defeats hash-only matching |
| SV2 editing | Stable local target/order after notes/name/layout Edit; convergence keeps both; sibling bytes unchanged; no inventory collision overwrite |
| SV3 selection/share | Instance-specific pointer/keyboard/Edit/delete, identical labels/URLs; actual copied payload in a clean profile; no local metadata in URLs/analytics; SHC retirement preserved |
| SV4 migration | Golden old versions/options/order/selection/slots, duplicates/opaque/corrupt/newer values; exact raw baseline and idempotent repeated boots |
| SV5 durable failure | Missing/throwing APIs, lock rejection/wait cancellation, quota/serialization/readback failure; no unlocked write or false success, draft/session behavior explicit |
| SV6 interleaving | Two actual targets paused around lock/reread: distinct Adds retained, exact imports dedup once, same-instance edits conflict, delete versus Save no resurrection |
| SV7 old clients/recovery | Writes before/during/after migration, raw divergence, downgrade/re-upgrade, missing/new collection epoch; no opaque loss or automatic destructive reimport |
| SV8 slots/reset | Explicit slot authority, legacy owner/promotion/RESET, ordinary imported siblings and opaque records preserved according to approved policy |
| SV9 async lifecycle | Delayed Save/import after cancel/newer sheet/view, missed events, dirty focus/scroll/pick; stale UI never closes/selects current context |
| SV10 responsive/copy | Collision suffix, focus/live regions, phone/landscape/keyboard, eight locales/font modes, existing budgets and English input |

SV5 additionally proves successful-write/failed-readback does not duplicate or
falsely roll back migration/Add/Edit. SV6/SV8 include two-target RESET-arm versus
replacement create/Edit, slot-owner delete/promotion races and unrelated plain Add
positive controls. SV3/SV10 include final-label literal-suffix collisions and clean
remote removal fallback/focus. SV5/SV7 cover each explicit boot fallback source.

### Backend measurement gate

S owns tools/probe/saved_variants_storage.js and the bounded private artifact
evidence/saved-variants-backend-measurement.json; T owns frozen public inputs and
independent expected byte accounting. Measure 2,20,200 distinct named/layout records plus a
1MiB serialized-envelope stress fixture (test sizes, not product caps), including
an existing public large-note-count seed. Record existing sources plus raw snapshot
plus transformed envelope peak, UTF-8 bytes/UTF-16 lengths, acknowledged-write/quota
outcome, parse/normalize/serialize and exclusive-lock hold times. Run30 samples per
fixture in one owned Chrome profile with exact host/OS/Chrome/source/foreground
settings and serialized browser lease; no installed benchmark dependency.

Proposed rollout criterion, to be accepted with this plan: adapter lock hold p95
≤50ms/max≤100ms on the2/20/200 fixtures; acknowledged migration must preserve both
source and snapshot at the stress size or explicitly refuse without deletion;
selection input→paint p95 must remain within one measured display frame of the
same-host pre-change baseline. Separate engine-build time and cold-start total so
moving work outside the lock cannot conceal a UI stall. These are diagnostic
measurement gates, not flaky CI wall-clock unit assertions or a saved-count cap.
If the candidate misses them, stop for reviewed optimization or the IDB alternative;
do not raise thresholds or drop recovery data to manufacture acceptance. Record
the chosen supported target and device limitations before approving rollout.

Every new group needs a generated real-diff killing mutant and exact clean PASS /
named assertion FAIL, no blob headers/startup errors/timeouts/skips/cancels. Fault
injections stop after each migration boundary and retry/reload twice. Model tests
supplement, not replace, actual two-target same-profile origin tests. Test locked
decision, not a read-before-lock fake race. Never inspect owner profiles/clipboard.

| Stage | Actions/deliverable | Exit / stop / rollback |
|---|---|---|
| A contracts | Owner decisions, exact spec/CLAUDE packet, API scope, namespace/schema compatibility, test map | Explicit required approvals and independent plan clearance; stop on policy conflict; no data changes |
| B RED | T public fixtures/new tests, approved old-policy oracle amendments, exact selector receipts | Intended assertion RED before app; startup/unsupported skips invalid; preserve branch/logs |
| C store | S pure build + serialized envelope/migration + fault tests and backend measurement artifact, owned temporary profiles only | Recovery/old-writer/ack/interleaving proof and reviewed measurement gate; no real-user store yet; revert unmerged owned commits on failure |
| D UI | U adapts instance view/selection/Edit/slots/copy/status, async ownership | Same tests GREEN, actual native/control negatives and responsive/locales; no speculative extra feature |
| E final | M generated faults/context refresh; independent addressed source/UX review; full exact-head Linux validate | All artifacts/steps/verdicts/floors inspected; unknown capability blocks its claim; preserve failures |
| F DEV | Same-head held main CI + DEV PR; merge only after gates, actual served bytes/affected two-tab/migration/receiver journeys | Owner QA ready with limitations; old sources/new envelope retained; main still requires consent |

Before main, rehearse code rollback/data recovery and complete claimed Safari/iOS
support; otherwise explicitly limit release and get owner acceptance. Never merge
the DEV overlay/history wholesale through a held CI PR as a release shortcut.
Production rollout/rollback and main consent are separate explicit decisions.

## Priorities, open decisions and current stopping point

P0 owner/instruction gates: coexistence/equality/Edit/fallback approval and exact
CLAUDE patch; implementation remains held. P0 engineering gates: exclusive durable
writer protocol, non-destructive raw recovery, new/old-client namespace separation,
instance-targeted commands before inventory veto removal. Owners root/S/ENG.
P1: dirty-tab conflicts, slot compatibility, same-label discoverability, actual
runtime failure proof and device coverage. Owners U/T/ENG/design/owner QA. P2: IDB
alternative only if required context/performance fails; explicit legacy recovery
import or retention redesign later. Do not let optional cleanup block coexistence.

Current deliverable: proposed plan, independent plan review next. No app/test/
storage/CLAUDE change or migration test has run in this stream. Root tree
/private/tmp/handpan-saved-variants.HVUKbE/planning, branch
codex/saved-scale-variants-plan-20261025. Freeze/review exact plan hash, address
material findings and provide a concrete approval packet; STOP before execution.

References: [prompt](../prompts/2026-10-25-saved-scale-variants-plan.md),
[source/schema](2026-10-25-saved-variants-source-research.md),
[UX/recovery](2026-10-25-saved-variants-ux-research.md),
[platform evidence](2026-10-25-saved-variants-platform-research.md),
[coordination](2026-10-25-saved-scale-variants-coordination.md),
[ledger](../WORKSTREAMS.md), [test contract](../../tests/CONTRACT.md),
[browser runbook](../testing/browser.md).
