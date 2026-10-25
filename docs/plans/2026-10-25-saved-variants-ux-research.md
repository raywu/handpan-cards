# Saved variants: UX, migration and recovery research

2026-10-25. Independent UX lane; source inspected at
`89ababec40a33ba103f42f6c91fc8bd7a27a8d7e`. Frozen prompt SHA-256:
`cd9dbb774a9ceb507bb0ec1a51e9440ada029bc1993167ed172749a3220fb9a7`.
This note alone is owned by this lane. No application/test/configuration/CLAUDE
edits, script/test/browser execution, storage migration or remote operations.
Recommendations below are provisional; the initial coexistence interview is
pending. This is research for the integrator's plan, not an execution plan.

## Evidence and scope

**Verified source:** `core.identitySeed/deckId` excludes names and layout options;
`registerDeck` keys `CUSTOM` by generated inventory ID; `sameDeck`,
`rememberScale`, `replaceScale`, `forgetScale` and `restoreScales` identify saved
entries by that inventory. Name/layout-only Add or import therefore replaces a
same-inventory entry. This is deliberate historical policy, not a random hash
collision. See `docs/ENGINE-SPEC.md` sections 12/14 and the retained
[investigation](2026-10-25-saved-scale-variants-investigation.md).

**Reported human evidence:** the owner wants two named/layout instruments visible
together and confirms separate tabs and SAVE before LINK. The earlier omitted-
angle cause remains unresolved. The separate SHC async completion repair and its
CI/DEV status are integrator-owned evidence, not established by this lane.

**Verified source:** this head includes SHC ownership symbols `retireLinkUI`,
`observeLinkRoute`, `linkUIGeneration` and `announcementRevision`. A variants
adapter must preserve their selected committed content, modal/history and latest-
intent protections. `selectDeck` already retires LINK UI explicitly; preserve that
call for instance selection. A same-URL instance switch would be invisible to
route-based ownership alone if an adapter bypassed it.

**Unverified:** any proposed new identity/migration/concurrency behavior at runtime.
No browser, mobile, assistive-technology, storage-fault or recovery check ran here.
Browser API/atomicity claims belong to the independent primary-documentation lane;
this note states required outcomes rather than assuming a storage mechanism.

## Proposed user contract and equality

Recommend keeping engine inventory identity unchanged and giving each saved
instrument a stable local instance handle. Its registry/selection/edit/delete
target must identify that instance. Portable `#s=` remains a content snapshot;
no local handle is required by a fresh receiver or sent to analytics. A normalized
content fingerprint may find an import match but must not become edit identity.

| Action | Proposed outcome, pending owner acceptance |
|---|---|
| Import same inventory with a different name/layout | Retain and select the new variant; existing variant remains independently usable |
| Import different palette, mirrors, anchor or explicit parent | Retain a variant when normalized portable meaning differs |
| Repeat unchanged import/reload/Back | Reuse an exact match without allocating or changing sibling records |
| Add fully identical content | Select the existing exact match; brief accessible feedback if needed, no confirmation |
| Edit rename, layout or notes | Update only the selected instance; keep its place and stable handle |
| Edit converges to a sibling's content | Keep both instances; no silent merge/deletion or forced rename |
| Multiple exact matches already exist | Prefer currently selected exact match, otherwise deterministic stored order |
| Import an older link after editing its instance | Retain/reuse the older content as its own variant; never silently roll back the edited instance |

Content equality must preserve inventory spelling/zone/octave distinctions and
intentional option differences. Compare explicit versus automatic names as intent,
even when their current display happens to match. An explicit parent and inferred
parent can currently label the same scale yet have distinct future meaning.
Normalize absent/default palette, mirrors/anchor, identity seats and absent/all-
null correction lists according to a reviewed normalization contract. Legacy wire
spellings and generated auto-label text must not allocate new variants by accident.
Do not reduce equality to pitch classes or rendered geometry alone: two different
representations can display alike while retaining different intent.

Current `sheetOptions` intentionally removes explicit parent on Edit SAVE; preserve
that behavior unless separately changed. That deliberate content change should
update the selected instance rather than clone it. Current bottom-count/reset/
mirror validation rules also remain unchanged. Import equality must not normalize
invalid input into an accepted scale or change codec refusal behavior.

## Discoverability, selection and focus

`buildChips` displays `chipLabel` capped at 16 characters; selected chips alone
open Edit, while other chips select. It uses generated `d.id` for both selection
and click handling. Two same-inventory instances must produce two distinct
controls with one `aria-current`, independent handlers and correct selected Edit
target. Name-based DOM lookup cannot serve as the acceptance oracle.

Same names after convergence, auto labels and names sharing the same truncated
prefix need a visible discriminator without changing stored names. Recommend a
small stable secondary instance marker only when visible labels collide, also
included in the accessible label. Do not expose an opaque UUID as product copy.
The integrator must specify the marker and its lifetime; visible ordinal changes
after deleting a sibling must not redirect a previously selected control. Labels
must still contain the exact visible text, including the displayed truncation,
and selected labels must retain the existing Edit affordance. A tooltip alone
does not resolve touch or keyboard ambiguity.

After Add/import/Edit, focus should reach the selected visible chip through the
existing `selectDeck` rehome rule; a registry rebuild must not strand focus on a
detached sibling. Background import/reconciliation must not move focus. A dirty
editor retains its caret, picked note, scroll and draft when another tab changes
saved data. Keyboard activation, Escape, Back and pending SAVE popstate still act
on the correct instance. A same-content instance switch must retire prior manual
LINK UI without mutating the legitimate in-flight invocation payload.

Any added conflict/status/discriminator copy needs all eight existing locales,
visible “scale” terminology, live-region behavior and English note input grammar.
Do not translate user names. Preserve target sizes, chip wrap/scroll behavior,
landscape controls, panel/plate budgets and physical geometry. A new confirmation
on ordinary Add/import is unnecessary under the proposed nondestructive defaults.

## Built-in replacement is a separate ownership decision

Source `replacements` chooses the newest record carrying `options.replaces` for a
seed; `allDecks` places that owner in the seed slot and earlier claimants in the
custom tier. `generateDeck` inherits replacement provenance from the old inventory
registry entry. A new instance allocator must not inherit a sibling's slot merely
because the inventory matches. Importing portable content carries no replacement
intent and must not seize the slot.

Recommend preserving the existing migrated slot owner, allowing one explicit owner
per built-in, and keeping other siblings as ordinary custom instruments. Editing
that owner retains its slot through note changes. Seeded routes resolve to that
owner; custom links retain portable content semantics. An unchanged seeded SAVE
still mints nothing. Deleting one sibling must not delete every same-inventory
record; deleting the owner must not unexpectedly promote another claimant.

**Material unresolved policy:** `restoreBtn.onclick` currently removes replacement
records while clearing hidden seeded state. Under a saved-physical-instrument
model that can delete an instrument the user expects to retain. Recommend RESET
restore built-in originals and retain former replacements as ordinary saved
variants. That changes pinned behavior and needs explicit approval; alternatively
retain historical deletion with accurate warning/recovery. Do not hide this choice
inside migration. Preserve the current two-tap destructive-control conventions.

## Cross-tab and recovery requirements

Local handles alone do not establish no-lost-update behavior. Distinguish different
instances added concurrently, two edits of one instance, delete versus stale SAVE,
a clean stale tab, a dirty tab, duplicated tabs, and old/new app writers. Source
`savedScales` reads the shared list while `CUSTOM` remains per-document; a stale
tab's boot `#s=` import currently writes its old content again. Proposed repeat
import must not overwrite an edited instance or silently resurrect a tombstoned
instance under its former handle. Whether an explicit content URL may create a
new instance after deletion must be specified separately from background refresh.

Recommend clean-tab reconciliation update saved controls without focus theft;
retain a dirty draft unchanged and notify about its conflicting persisted base.
On stale SAVE/delete conflict, preserve both persisted winner and local draft;
offer an explicit save-as-separate-variant or review/cancel path. Do not silently
apply last-writer-wins or auto-merge name/layout/note edits. Concurrent distinct
Adds must both survive; a locking/storage failure must not acknowledge a durable
save. The mechanism and unsupported-client fallback require engineering evidence.

Migration should preserve old saved order, selection and replacement ownership,
while keeping engine/wire identity and per-card-state conventions distinct from
local handles. Preserve opaque/newer/corrupt records without using their parsed
inventory as permission to rewrite or delete them. Already overwritten historical
variants cannot be reconstructed; recovery can only use retained data or links.

Recommend an isolated new namespace/envelope and untouched legacy recovery source,
subject to the source/documentation lanes' compatibility findings. Do not mirror
new siblings into a legacy collapsing list or describe an old client as safe to
write the new store. An old tab can continue writing its legacy namespace; define
whether later adoption is manual or a reviewed import, never repeatedly migrate
on every boot and overwrite new edits. DUPLICATE-NOTES remains held: its candidate
wire/record 7/5 ownership must not be consumed accidentally by local metadata.

Staged migration must visibly distinguish prepared, durably committed, recoverable
failure and session-only state. Backup/new-store/marker refusal, quota, interrupted
write, refresh and retry must leave at least one useful recovery source and avoid
duplicate allocation. Include both backup and new data in quota estimates. Do not
show ordinary saved-success copy when only registry/fallback memory changed.
Preserve the draft and provide actionable local recovery on refusal; exact copy
depends on the supported failure policy and needs design review.

Rollback must cover data, not just application bytes. Document which old snapshot
the old app can read and which later variants remain safely retained but unavailable
to it. Any export/recovery artifact must preserve all instance content/provenance,
opaque records and order without publishing names/URLs. Do not introduce an export
UI or delete backups in this planning lane. Recovery promises need a rehearsal
using isolated fixtures; never request owner storage dumps or their browser profile.

## Observable acceptance and negative cases

All entries are proposed acceptance, **unexecuted** here. Use public minimized
fixtures, literal expected metadata and pitch-keyed angles, not private owner data
or expectations calculated from the implementation under test.

| Journey | Acceptance and negative oracle |
|---|---|
| Add/import two named/layout siblings in both orders | Both visible; selecting/editing/deleting/sharing one never changes the other |
| Palette/parent/name-intent-only difference | Count changes exactly according to approved equality; default/null/legacy equivalents do not proliferate |
| Exact Add/import/reload/Back repeatedly | Stable count/order; deterministic selected match; no fallback to inventory-only overwrite |
| Edit notes/name/nudge; converge onto sibling | Same instance handle/order, only selected content changes; both instances survive convergence |
| Identical/truncated chip labels | Two distinguishable visible/accessible controls; pointer/keyboard selects intended instance; selected chip opens that Edit |
| Copy each sibling and open actual payload in clean receiver | Sender committed content, persisted receiver content and pitch mapping agree; no local ID in URL or analytics |
| Built-in owner, sibling, seeded route, delete, RESET | Exactly one approved slot owner; no implicit slot theft/promotion or unapproved instrument deletion |
| Two targets, same origin/profile, concurrent Adds/edits/delete | Distinct writes retained; stale same-instance mutation invokes approved conflict path; dirty draft/focus preserved |
| Stale URL, deleted instance, old/new/duplicated tab | No background overwrites/resurrection; explicit URL import follows approved content policy |
| Migration/retry/interruption/quota/read/write refusal | Old source and opaque records preserved; no false durable success, orphan selection or duplicate handles |
| Rollback/downgrade/restore artifact | Later variants remain recoverable; old writer cannot collapse new namespace; no invented recovery of lost history |
| Narrow SHC regression | Latest completion owns UI across identical-URL instance switch, SAVE/pop/modal/new LINK; current-href query preserved |
| Responsive/locales/focus | Existing budgets/targets maintained at phone/desktop/landscape; eight locales, keyboard and Back/cancel covered |

The full plan must assign spec-first RED/GREEN and generated killing mutants to
new behavior groups under `tests/CONTRACT.md`. Existing assertions for same-ID
replacement, Edit collision refusal, chip lookup and RESET are historical policy
tests, not disposable failing tests. Review precise amendments and preserve true
collision and no-unintended-loss protections. Browser runbook requirements remain:
root's serialized lease, frozen selectors/counts, actual non-skipped execution,
exact-head full Linux validate and actual served DEV checks. Safari/native/physical
device limitations remain separate. Documentation research itself needs no tests.

## Minimum owner decisions and instruction conflicts

Prioritize one recommendation-first question at a time; do not re-ask settled
SAVE timing, separate tabs or desired names/layouts. Material gates are:

1. Accept the pending coexistence/Edit-selected/repeat-import contract.
2. Accept exact Add dedup and retaining both instances after Edit convergence;
   equality includes palette/explicit-parent/name intent as proposed above.
3. Accept conflict handling that preserves the dirty draft and persisted winner
   rather than silent overwrite, including deletion conflict and unavailable storage.
4. Decide built-in RESET retention versus historical replacement deletion, plus
   one explicit slot owner. This affects data preservation and visible expectations.
5. Accept old-client/rollback recovery limits after the concrete architecture is
   reviewed; no need to interview about implementation-specific ID generation.

`ENGINE-SPEC` section 12 currently says one saved record per inventory and documents
colliding save/boot behavior; section 14 pins the old storage namespace. CLAUDE
Known pitfalls and `tests/app.test.js` rows 73/131 pin inventory-derived Edit
replacement/refusal and seeded RESET behavior. These conflict with some proposed
contracts. Root must draft exact scoped instruction/spec/test amendments, including
the new local-instance versus unchanged engine-ID distinction. Any CLAUDE edit
requires separate explicit approval; no such edit is made or granted by this note.
