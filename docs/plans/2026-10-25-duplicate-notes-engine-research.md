# Repeated physical notes: engine, layout and performance research

Planning evidence only; 2026-10-25. No feature implementation or regression claim.

## Scope and baseline

This lane ran the engine/layout/performance portion of
`docs/prompts/2026-10-25-duplicate-notes-plan.md`, SHA-256
`be2677f0f32e23a1ae4ccda2ad3c07c711eed7c24e938b41c063dcc192dec3cb`.
Repository HEAD was `2f01c3acc9e1b3c1d3c36294969e37d2d743401c` in the isolated
`codex/duplicate-notes-engine-research-20261025` worktree. This document is the
only lane write. Instructions inspected: AGENTS.md, CLAUDE.md, tests/CONTRACT.md,
and docs/testing/browser.md. No test suites, browsers, generation scripts,
installs, source patches, remote writes or configuration changes ran.

**Conclusion: technically feasible with conditions, not validated for delivery.**
The engine already separates physical field identity from pitch class and retains
multiple physical fields of the same MIDI when supplied as seed data. Current
input validation rejects the owner's same-bottom-ring example. A conservative
plan can preserve deterministic selected voicings and existing diagram behavior
while changing eligibility and adding warnings. Parser/storage/compatibility and
warning UX remain separate critical dependencies; constructing data below does
not demonstrate that the current app accepts it.

Owner decisions about physical alternatives are pending. Do not interpret this
research as authorization for new musical semantics or application edits.

## Existing behavioral contracts

| Status | Evidence | Consequence |
|---|---|---|
| Verified | CLAUDE.md verified rules 1–3; index.html:10174 `chordSets`; src/engine/pdfcards.js:454–486 | Every physical field with a chord pitch class is highlighted, across registers and shells; every root-PC field gets root color. This already includes multiple positions. |
| Verified | src/engine/voicing.js:67 `playable`, :143 `isLegal`, :255 `choose` | Ding does not voice; one selected field per pitch class; maximum six selected notes. Six is a voicing bound, not an instrument-size cap. |
| Verified | src/engine/voicing.js:81–98 | Equal-MIDI tone choices prefer upper shell, then smaller field ID. Preserve this existing tie behavior. |
| Verified | src/engine/select.js:249–277 | Root instances are ordered by MIDI; HOME prefers the first upper-shell root, otherwise the highest bottom root. Do not replace this bottom-only rule with a generic lowest-root rule. |
| Verified | src/engine/select.js:281–322 | Each root instance is voiced; root-only moves are discarded as alternates. Alternate must change non-root fields and register class. Maximum three cards per chord name is an existing presentation policy. |
| Verified | src/engine/layout.js:190 `collect`, :646 `merge`, :708 `solve` | Layout groups and preserves physical IDs, without MIDI/name deduplication. Geometry and packing use physical counts. |
| Verified | docs/ENGINE-SPEC.md:460–484 | Ring/total note-count caps are retired. Crowding can shrink labels and produce SMALL_LABELS. Legacy positional constraints and payload bounds are separate. |

The most consequential distinction is **selected voicing versus highlighted
positions**. Number/note lines describe selected fields; diagrams intentionally
show every available matching pitch class, including unselected octave copies.
The owner's interview must distinguish these surfaces. “Choose one physical
position” need not change all-position diagrams; treating it as a diagram policy
change would silently regress an explicit existing requirement.

The HTML and PDF implementations both implement this contract; tools/hifi.py
around lines470–494 mirrors it. The selected-bottom badge counts chosen bottom
fields, not all bottom copies lit in the diagram. No rendered PDF or browser
output was checked in this lane.

## Identity, layout, preview and editing

**Verified:** field records are keyed by numeric ID. `layout.collect` keeps all
IDs; `merge` clones their records and applies placement/labels by ID. Bottom
angles contain an entry for each physical bottom field. Top numbering includes
rim before inner; bottom uses U1, U2, etc. IDs are not inherently pitches.

`index.html:11781–11835` maintains selection as `{ring,i}`, resolves it to the
field ID and binds hit targets using `data-field`. Accessible target names already
include pitch, ring, seat label and place. Consequently two E4 targets can remain
separate keyboard/drag targets when IDs and occurrence order survive parsing.
`decomposeFields` at :13491 preserves records by zone and typed ordering rather
than collecting note names into a Set. Core `typedSeats` and `identitySeed`
likewise work with physical occurrences/serialized records. Full parser,
canonicalization, wire-version and persisted-identity audit belongs to the core
lane; this is not a claim that every round trip currently supports duplicates.

**Partially verified UX risk:** several clash/movement notices use `fieldName`
around index.html:11896, which supplies pitch/octave alone. Two same-ring E4
fields could make the affected occurrence unclear. Existing renumbering prose
can include seat labels. The UX plan should inspect each ambiguous message and
add ring/seat context where needed, retaining existing concise copy elsewhere.

Equal-pitch occurrence swaps need a specified observable result: preserve physical
IDs, typed order, seat mapping and free-placement angles through edit, sharing and
reload. Do not consider equal-MIDI fields interchangeable simply because their
printed pitch strings match. Free placement establishes position, not playability.

`select.build` solves the fields with mirror/anchor options; it does not itself
demonstrate the app's carried seat/angle correction path. The app re-applies such
corrections elsewhere. Raw-build probes below establish field retention, not
equivalence to a complete edited-layout lifecycle.

## Bounded, non-mutating diagnostic evidence

After inspecting tools/engine_loader.js and the loaded modules for side effects,
Node VM loaded `core, voicing, layout, naming, select, sequence`. The loader only
reads the named local source files and evaluates their existing definitions.
No source was modified, including in memory. Constructed seed **data** below
deliberately bypasses current input eligibility and is feasibility-only evidence.
Times are single local observations, not a benchmark or resource guarantee.

### Owner-note fixture

Input (necessary note transcription only):

```text
(D3) F#3 A3 C#4 D4 F#4 G#4 A4 C#5 D5 | F#5 [G#3] [E3] [E4] [B3] [B4] [E4] [E5] [B2]
```

Current `core.parseSeed` rejects it with NOTE_REPEATED. Removing the second E4
produces an accepted 18-field seed and 62 cards. To investigate the engine only,
clone that accepted seed, insert another E4 as bottom ID106, move following
bottom records to107/108 and set the eight bottom labels to U1…U8. Existing
`select.build` then succeeds with 19 physical fields, 18 distinct MIDI values,
62 cards and all selected voicings passing existing `voicing.isLegal`; no build
warnings were emitted. The two E4 records survive as IDs105/106, labels U5/U6,
angles22.5°/157.5°. These coordinates are the default solver result, not an
assertion about the photographed instrument's real layout.

The lack of a duplicate warning is expected in this unsupported-data probe;
warning creation is work still to plan. Existing isLegal is an implementation
consistency check, not an independent musical oracle.

### Existing accepted cross-shell unison

```text
(D3) A3 C4 D4 E4 F4 [E4]
```

This input already parses. Build produces 11 cards. A cloned second bottom E4
with a unique ID102/labelU2 leaves the card JSON byte-for-byte equal to the
accepted seed, retains both bottom records and produces legal selected voicings.
Am chooses fields1,2,4, preserving upper E4 selection. Sequence picks with seed42
were JSON-equal for basic, intermediate and advanced tiers. This is one fixture
and seed, not proof that every scale or random stream remains unchanged.

An existing accepted bottom copy of Ding's pitch also parses:
`(D3) A3 C4 D4 E4 F4 [D3]`. A separate physical field is distinct from a second
Ding marker; Ding itself must continue to be excluded from voicings.

### Multiplicity and bounded load

Unsupported constructed inventories contain Ding D3 plus N upper physical copies
of each A3, C4 and E4, with unique sequential IDs. All builds retained their fields,
returned two cards and produced legal selected voicings:

| Copies per chord tone N | Physical fields | Observed build ms |
|---:|---:|---:|
| 1 | 4 | 0.11 |
| 2 | 7 | 0.17 |
| 4 | 13 | 0.21 |
| 8 | 25 | 0.41 |
| 16 | 49 | 0.95 |
| 32 | 97 | 2.67 |
| 64 | 193 | 9.57 |

One pass, no warming or isolation from concurrent research. This neither defines
an acceptable UI limit nor supports a general timing claim. No new note cap is
proposed. Large instrument usability, crowded labels, serialization bounds and
memory/browser performance require later measured validation.

## Harmonic, sequence and performance risks

`select.candidates` reasons about available pitch classes. Adding another physical
copy of an already available non-Ding pitch therefore need not add new harmonic
qualities. It still changes physical note counts and can change automatic naming,
chosen positions or home/alternate voicings. Adding the first non-Ding copy of a
Ding-only pitch can legitimately enable new chords because Ding never voices.
Do not assert all duplicate additions leave the deck unchanged.

The public **`voicing.candidates` API** materializes the Cartesian product of
physical tone choices. With m occurrences of each of k chord pitch classes, it
can create m^k combinations. Four copies of A/C/E produced64 candidates in the
bounded probe. Production `select.build` instead calls `voicing.choose` via
`select.voice`; inspected search found no production call to that Cartesian API.
Do not use it to expose every fingering as a convenient implementation shortcut.

Production still computes choices for **all root instances before** alternate
filtering/capping. Each choice rebuilds/scans/sorts physical lists. Source suggests
roughly quadratic-with-sorting growth for repeated root inventories per fixed
harmonic candidate, plus geometry work; this is an analysis risk, not a measured
worst-case complexity theorem. Three displayed cards does not bound upstream work.
Optimization should be measured and separately justified; do not silently drop
physical occurrences or alter HOME tie behavior to improve timing.

`sequence.uniquePcs`, `anchors` and `connects` operate on selected-card pitch classes
and existing root/bottom priorities. Identical physical occurrences do not directly
create new tonal edges. New duplicate cards, changed deck ordering or new root
alternatives could nevertheless inflate pools and progression sampling weights.
Existing sequence search budgets (medium enumeration60000, walk20000, DFS15000)
do not establish browser-wide performance. Preserve card identity/order where the
musical result is intended unchanged, and test seeded progression fixtures.

## Minimal design alternatives and pending decisions

1. **Recommended provisional:** preserve distinct fields and existing deterministic
   chosen voicings, existing register alternates and pitch-class-complete diagrams.
   Add a non-blocking duplicate warning at the input lifecycle boundary. This
   minimizes changes to ranking, sequences and print contracts.
2. Explicit physical-fingering alternatives: a separate future feature, requiring
   selection UX, identity, sampling-weight and performance design. Exhaustive
   Cartesian enumeration is inappropriate as a default.
3. Selecting several unison fields simultaneously in one chord: contradicts current
   one-PC-per-voicing rules. It requires an explicit owner decision and a revised
   musical/print contract; duplicate input support alone does not authorize it.

Owner confirmation remains needed on exact duplicates across upper/bottom/Ding
positions, equal-to-Ding upper fields and physical alternative expectations.
Warnings should not imply that every represented layout is physically playable.
Reach, simultaneous strikes, hand assignment and real instrument geometry were
not validated; neither angular separation nor a legal MIDI voicing proves these.

Expected implementation ownership after approval: core lane for eligibility,
occurrence IDs, wire/storage compatibility; UX lane for warnings and ambiguous
occurrence copy; engine lane for any demonstrated selection/geometry fixes and
regression protection. No engine rewrite is established as necessary by this audit.
Generated inline engine/PDF regions must remain synchronized by approved tooling.
Any changed CLAUDE.md contract needs the owner's exact-diff approval.

## Spec-first validation plan and independent oracles

Before edits, independent ENG and design reviews should resolve the above policy
forks and review the exact integrated plan hash. Later implementation must first
produce meaningful failing tests, then preserve existing test contracts/floors.

| Requirement | Independent expected result / verification |
|---|---|
| Physical multiplicity | Hand-enumerated occurrence inventory: screenshot has19 positions/18MIDIs; assert exact zone counts, two E4 IDs, and separately editable seats after parse→build→edit→share→reload. Do not derive expected counts from the implementation under test. |
| Pitch equivalence | Exact/enharmonic same-MIDI copies warn; same pitch class in different octaves retains current behavior. Same rim, same inner, same bottom and cross-zone fixtures cover actual validator boundaries. |
| Ding semantics | One Ding marker stays required; a separate non-Ding equal-pitch position remains independently identified and eligible only under approved placement policy. Ding ID never appears in selected chord fields. |
| Existing selection | Hand-specified equal-MIDI top-before-bottom and lower-ID tie fixtures; explicit bottom-only HOME fixture; accepted legacy cross-shell unison outputs pinned to the immutable baseline. |
| No harmonic inflation | Small hand-enumerated A/C/E inventories assert chord qualities, selected uniquePCs and existing alternate criteria; root-only duplicate must not manufacture a new card. Cover a genuinely changed register alternative too. |
| Diagram versus lines | Browser and print all-PC highlighting independently checked for each physical ID; selected number/note lines list only chosen fields in existing spelling order; root colors include every root-PC copy. |
| Identity and free placement | Change just one of two E4 positions and assert the other does not move; mirror/anchor/typed reorder/renumber/angles survive share and reload. Check duplicate occurrence announcements for an unambiguous seat. |
| Progressions/rank | Freeze representative accepted-deck card JSON and seeded outputs for all tiers. Where a new non-Ding pitch enables a chord, specify the expected musical change instead of insisting on equality. |
| Performance | Measure increasing physical multiplicity, chord-root multiplicity and crowded geometry independently, with runtime/revision/repeats recorded. Establish an evidence-based budget and failure behavior without reinstating retired note caps. |

Required discriminating mutants: collapse equal MIDI into one physical ID; allow
duplicate selected pitch classes; reverse upper/lower-ID ties; include Ding in
voicings; retain root-only alternates; highlight only selected IDs; overwrite one
copy's angles by note name; and skip duplicate-warning generation. Each must be
caught by a corresponding behavioral assertion, not only existing isLegal.
Do not mutate source during this planning phase.

Later full validation includes affected unit/integration contracts, generated-source
parity, print parity, browser edit/layout/save/share/focus/status behavior, full CI
at exact final HEAD and served DEV verification. Host browser work is serialized
with other streams under the shared runbook. Native owner/device QA and main
release remain explicit gates. None of those checks ran here.

## Evidence integrity and unresolved blockers

Source SHA-256 at inspected HEAD:

```text
voicing.js  0f603f8cf33f1ede7528206eaa2cda391cfd45782da6d1bea04ab84916a9a1b5
select.js   e94514912ea010049075df881036646c5b1a1820df6de64a1639226d120cf497
layout.js   b9819007fd785d0381b0a9ced64ae582a944943261625b5d4f34e968bc52bf08
sequence.js 62ca3b681d0499ea7e08ef7438ee3ed0aa6f36e0aa0e9a70fb7c0a7fcf043eec
pdfcards.js 893d72d52774e95b07070555cfc93e6fb276c6de59b725485ee51f5f22c81981
```

**Verified:** source behavior and bounded observations above. **Partially
verified:** feasibility of repeated physical records through raw build/layout;
full input/persistence/edit lifecycle and large-scale efficiency remain untested.
**Unverified:** physical instrument playability, browser/print rendering, broad
regression freedom and approved future voicing semantics. These are evidence gaps,
not demonstrated product failures. Source already contradicts any blanket claim
that all repeated pitches are rejected or that diagrams show just one instance.

Material blockers to implementation: owner semantics/interview resolution;
integrated core compatibility and warning lifecycle plan; independent ENG/design
review; separate implementation authorization. No blocker requires an invented
note cap, blind Cartesian enumeration or changing existing diagram contracts.
