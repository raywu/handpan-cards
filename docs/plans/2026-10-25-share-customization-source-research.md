# SHARE-CUSTOMIZATION-HOTFIX source investigation

Source-only receipt, 2026-10-25. Author lane: source research. Reviewed source
HEAD `ff81ffe38f83bf9eb4ed7173dd0fddc85234211f`; frozen prompt SHA256
`1489e53d1a23a4dd56d8c1f724bd8c4a6ae1d3c9094e2e27fd4967ab8aa2fb77`.
Read AGENTS.md, CLAUDE.md, tests/CONTRACT.md, docs/testing/browser.md,
the frozen prompt, application/engine source and relevant tests/mutants.
Evidence below comes from read-only `rg`, `sed`, `cat`, `git rev-parse` and
`git status`; no application, test, diagnostic script, browser or remote ran in
this lane. Test names describe inspected assertions, never an executed pass.
Only this note is authored here. No private names, screenshots or owner URLs are
included. Line references refer to this source HEAD.

## Finding and limits

**Verified source:** the normal SAVE chain explicitly carries bottom angles into
both rendered fields and saved options, then derives the canonical route from
the selected committed deck. No unconditional angle loss was found on that path.
**Unverified:** the reported successful SAVE followed by a fresh default-layout
LINK has not been reproduced by this lane, and its cause is not established.
Root's reported awaited production-VM positive control is compatible with this
trace; the earlier synchronous clipboard check is invalid failure evidence.
Neither control proves native gesture/history/storage behavior.

Same-inventory imports replacing one saved entry are existing deliberate
behavior. That fact does not explain or disprove a mismatch among one tab's
committed layout, address bar and outbound URL. No identity migration or
keep-both variant is proposed.

## State and ownership chain

| Stage | Verified source and consequence |
| --- | --- |
| Identity | `src/engine/core.js:945` identitySeed and `:1013` deckId hash canonical note spelling/octave/zones/order. Geometry, name, palette, parent and replacement options are excluded. Layout corrections therefore keep the same id. |
| Editor open | `index.html:12659` resetSheetState takes custom options, deep-copies seats/angles, and snapshots stored corrections. It drops angles when there are no bottom fields. `formatTyped` uses top seats to prefill note order; angles are independent of that text. |
| Preview | `index.html:12198` solvePreviewLayout combines draft mirrors/anchor with fitSeats/fitAngles. `:11733` fitAngles only returns an angle list matching bottom count. This filtering does not itself overwrite the draft list. A visually retained invalid-input preview is explicitly marked held/stale (`:12303`). |
| Draft edits | `sheetOptions` (`:12149`) deep-copies seats and angles alongside palette, mirror pair, anchor, normalized name and replacement provenance. `layoutOptions` removes name/replaces for preview. `deriveTyped` (`:12364`) only changes rim/inner seats, not bottom angles. |
| Generation | `generateDeck` (`:9869`) parses, applies the collision guard, builds defaults, then carries raw seats/angles past core's option whitelist into a second layout solve. It copies solved field slots 4/5 and deep-copies correction options before registerDeck. Rejected correction solves do not register. |
| Commit | `runGenerate` (`:12833`) generates once, closes the sheet, remembers/replaces its record, then selectDeck. `scaleRecord` (`:10024`) stores canonical string plus options, not generated geometry. `selectDeck` (`:10145`) updates selected id/settings, renders and calls syncRoute. |
| History | `closeScaleSheet` (`:12778`) hides immediately and requests history.back with pendingPop. Selection synchronously calls syncRoute after hiding; the later pendingPop handler calls syncRoute again. `hashchange` (`:14511`) can import a differing share payload once. Actual browser event ordering remains untested here. |
| Canonical route | `routeInfo`/`syncRoute` (`:14437`, `:14448`) encode the selected registry deck's fields/options, preserve pathname and query, replaceState only, hide a revealed URL when rewriting and disable LINK on encoding refusal. Open modal routes defer syncing. |
| Copy | `copyLink` (`:14462`) captures location.href and deck kind at invocation. The same captured href goes through clipboard, native share and selected-text fallback. Clipboard/native calls run in Promises; success notice runs in a deferred timer. |
| Receiver | `openShare` (`:9980`) decodes, regenerates once, remembers the built seed and selects it. A fresh receiver needs no sender storage: carried options reconstruct geometry, and syncRoute regenerates the received canonical URL. This is a source trace, not a completed receiver journey. |

The inlined engine regions are generated copies of src/engine modules. Any future
engine repair must edit the module and use the existing sync tool, not hand-edit
the inline copy. This note makes no such repair.

## Angles, seats and intentional transformations

`src/engine/layout.js:499` readAngles accepts a bottom list in ascending field-id
order, with null meaning solved position; missing/null/all-null is absent. Values
are 5-degree integer steps in [0,360). readCorrections (`:611`) rejects simultaneous
bottom seats and active angles and checks the geometric floor. A rendered field's
numeric angle alone cannot prove that options still carry its correction.

`slideNote` (`index.html:11954`) builds a new angle list on movement. A first slide
on a seated bottom ring folds those seats into explicit angles and clears bottom
seats. `exchangeAngles` (`:11916`) exchanges two snapped positions after checking
both floors. Rim/inner swaps remain seats. Mirrors/anchor toggles retain absolute
angle entries; a toggle that fails the floor is reverted (`:13079`). Bottom
labels can change with cyclic ordering, so diagnostics must compare pitch-keyed
angles as well as options rather than U-labels alone.

RESET LAYOUT (`:12122`) clears seats, angles, mirror pair and anchor. A successful
parse changing bottom count (`syncRingCounts`, `:11843`) clears angles; seats have
per-count memoization, angles do not. Returning to the earlier count does not
restore old angle entries. Invalid parses do not enter noteCounts, while a valid
intermediate smaller bottom count can reset angles before the final valid text
returns to its original count. These are diagnostic discriminators, not proof
that the owner followed that sequence. Bottom count reset is intentional in
docs/plans/2026-10-23-free-placement.md and pinned by the FPD reset assertion
(`tests/app.test.js:13675`) and fpd_reset_keeps_angles.patch. Same-count pitch edits
leave angles attached by canonical bottom index; no pitch-identity remapping is
implemented by deriveTyped.

Name/palette-only edits preserve corrections through sheetOptions; nameDirty
distinguishes an untouched auto label from deliberate explicit naming. Existing
explicit parent options deliberately disappear on Edit SAVE: sheetOptions does
not write parent and generateDeck resets inferred parent to null (`:9925`). This
is pinned by RD assertions (`tests/app.test.js:9269`, `:9296`, `:9332`) and
rd_save_keeps_stored_parent.patch. A share import retains its explicit parent.
Do not count that intentional rewrite as a new hotfix regression. `replaces` is
carried from editing provenance or inherited from the same-id registry entry;
it affects seeded chip placement, not identity or bottom angles.

## Registry and persistence are separate observations

`registerDeck` (`index.html:9839`) overwrites CUSTOM[id]. rememberScale (`:10055`)
replaces the first matching record in place and collapses duplicates; replaceScale
preserves the old chip index after field edits. ADD/import same-id replacement is
intentional; Edit onto another existing custom id is vetoed before building.

`savedScales` (`:9997`) prefers any stored array over scalesMemory. writeScales
updates scalesMemory first and catches JSON/localStorage write errors (`:10001`).
Thus a refused write with an existing readable old array can leave three states:
new registry, new session fallback, old durable array. Subsequent savedScales calls
still prefer that old array. If reads are unavailable/invalid, the memory fallback
is used instead. A displayed success message does not prove durability; the
current API returns no persistence acknowledgment. **Verified source behavior;
unverified relevance to this report.** Do not turn this into a global storage
rewrite without a reachable, reviewed scope. Tests/app.test.js:430 intentionally
keeps generate/share/delete usable when storage writes throw.

There is no window storage-event handler in index.html. Different tabs hold
independent CUSTOM registries and selected ids while writes read the shared
saved-record list. One tab can replace a same-id durable record without updating
the other tab's in-memory deck/route. Reload also consumes its #s= URL after
restoreScales, so the tab's route can reimport its own variant and overwrite the
stored variant again. This is a source-derived causal alternative needing actual
two-target, one-profile evidence. Independent browser launch profiles would not
exercise shared storage.

restoreScales (`:10117`) rebuilds readable records before resolving selection,
keeps unreadable records and only rewrites older readable records when needed.
Wire VERSION is 6, record version remains 4. Diagnostics must retain raw stored
bytes and distinguish existing newer/unreadable records from an absent record.

## Encoding and copy contracts

`src/engine/share.js:324` encode serializes seed options, not field slot 4. It
emits `at-` last only if anglesField (`:235`) finds an explicit entry; active
angles omit bottom seats. The checksum meaning includes emitted angle text and
wire version; a payload cap refusal propagates. decode (`:520`) reattaches seats
and angles after core.parseSeed, validates angles and floor, and refuses bottom
seats alongside them. Legacy parsing is version-directed. Engine tests cover
checksum, option order/canonical spelling, cap, legacy versions and malformed
corrections; this lane inspected assertions without running them.

LINK's present contract is location.href, including origin/path/query. The SU
assertion (`tests/app.test.js:10157`) includes a query, and
tests/mutants/su_copy_reencodes.patch deliberately rejects replacing it with
shareLink(deck()).value because that helper omits the query. URL-only hardening
must not silently change that contract or serialize unsaved draft state.

The proposed operation contract in the frozen prompt is the committed snapshot
at click. Under it, later selection alone does not make the earlier operation's
captured payload wrong. Separate source-only UI hazards are that delayed
rejection can reveal/select/focus its older link after a new selection/modal,
and delayed success can clear/announce in a newer context; repeated operations
have no explicit ownership token. These require reviewed async-UI semantics and
reachable evidence. Do not change the payload halfway through fallback to follow
a new selection. Actual clipboard permission and native share behavior remain
unavailable to this lane.

## Regression evidence and recommended discriminators

Inspected controls include FPD SAVE-to-options/reopen/received-record assertions
(`tests/app.test.js:13705`, `:13725`), SU SAVE/pop sync (`:9883`, `:9902`),
clipboard/native/fallback/AbortError (`:10157` through `:10212`), route refusal and
privacy assertions, share FPS angle roundtrips and generated mutants including
fpd_drawer_writes_no_option.patch, fps_option_dropped_on_encode.patch and
su_pop_not_synced.patch. None ran here.

tools/sandbox.js:450 and :715 explicitly record history.back without simulating a
history stack; tests set the prior URL and dispatch popstate themselves. Native
FPD drag e2e cases (`tests/e2e.test.js:17442`, `:17481`, `:17500`) inspect editor
geometry at phone/landscape/desktop sizes; those specific cases do not complete
SAVE/history/LINK/clean-receiver comparison. Existing tests are useful controls,
not proof of the reported end-to-end journey.

Root diagnostics should distinguish these states at invocation, synchronous SAVE
return, actual popstate/hashchange and settled outbound completion:

1. Draft angles/seats, parse validity and pitch-keyed preview geometry.
2. Selected id, registry options/geometry, scalesMemory and actual stored bytes.
3. Address-bar URL decoded semantically, preserving path/query/origin.
4. Awaited page-owned clipboard/native/fallback payload sink, tied to its click.
5. Actual captured URL opened in a clean receiver without sender storage; compare
   pitch positions, relevant options, record and canonical receiver URL before
   another same-id import can mask a loss.

Run custom/default controls in both import orders; no-op/rename/palette saves;
real drag/swap/nudge; reset/count/valid-invalid-valid input; immediate and settled
history; shared-profile tabs; persistence refusal with and without an old array;
deferred clipboard/native rejection and superseding clicks. Mark each result
executed/source-only/untested in the root ledger. This source lane establishes
only source-only coverage for that matrix. Safari/native/physical behavior,
fresh-receiver rendering and the owner's storage remain untested here.

Before any repair, classify whether loss occurs before encode, route diverges
after commit, or a copy operation captures the wrong committed context. A stale
URL injected by a test alone is insufficient reachability evidence. If root's
reviewed native controls also pass, keep the hotfix conditional and retain the
reported mismatch as unresolved; do not invent a red test or widen identity scope.
