# Repeated physical notes: core, identity and compatibility research

Planning evidence only; no application, validator, protocol or test change is
authorized by this note. Owner scope/voicing/warning interviews remain pending.
Recommendations below are provisional. Integrator owns synthesis and ledger.

## Baseline and method

Inspected isolated branch `codex/duplicate-notes-core-research-20261025`, baseline
`2f01c3acc9e1b3c1d3c36294969e37d2d743401c`, against frozen prompt
`docs/prompts/2026-10-25-duplicate-notes-plan.md` SHA-256
`be2677f0f32e23a1ae4ccda2ad3c07c711eed7c24e938b41c063dcc192dec3cb`.
Read AGENTS.md → CLAUDE.md and tests/CONTRACT.md; inspected original modules,
specification, test source and application persistence/entry paths. Test source
is evidence of intended assertions, not a report that tests passed.

After inspecting `tools/engine_loader.js` and loaded modules for I/O, ran bounded
Node diagnostics through the existing private-VM loader. These read local source
and print results only. No browser, test suite, application storage, network,
source modification, dependency install or proposed validator was used. One
diagnostic constructed an unsupported seed in memory, explicitly identified
below. No inference about physical instrument correctness is made from a photo.

## Findings and refusal paths

| Finding | Evidence / classification | Planning implication |
|---|---|---|
| Screenshot notes contain 19 physical entries, 18 distinct resolved pitches; E4/MIDI64 occurs twice in bottom | **Verified diagnostic:** D3; rim F#3 A3 C#4 D4 F#4 G#4 A4 C#5 D5; inner F#5; bottom G#3 E3 E4 B3 B4 E4 E5 B2 | Preserve both occurrences; do not silently deduplicate or assume typo |
| Dedicated-field compose refuses that fixture | **Verified diagnostic:** `ok:false`, `codes.bottom.code:IN_BOTTOM`, `errors.bottom:"E4 is already in the bottom notes."` | The screenshot refusal is reproducible without browser/UI execution |
| Canonical parser independently refuses same-shell repetitions | **Verified source:** `core.scaleInfer`, core.js:685–777 | Fixing dedicated bottom compose alone cannot enable share/load/line paths |
| Upper note equal to Ding is rejected by ordering, not just duplicate checks | **Verified diagnostic/source:** `(D3) D3 A3` and `(D3) A3 | D3` → NOTE_OUT_OF_ORDER; `scaleInfer` uses `<= ding.midi` | If owner means duplicates anywhere including Ding, permit equality deliberately while retaining below-Ding policy; do not remove ordering wholesale |
| Some exact duplicates are already accepted | **Verified diagnostic:** `(D3) A3 [A3]`, `[D3] (D3) A3` succeed | Preserve current valid cross-shell unisons and their existing IDs/options/links |
| Enharmonic exact pitches are duplicates | **Verified diagnostic:** `(D3) A3 [E4] [Fb4]` → NOTE_REPEATED | Detect warnings by resolved MIDI, retain typed spelling; different octaves remain distinct |

`core.parseSeed` (780–837) tokenizes, assigns zones/inferred octaves, runs
`scaleInfer`, then checks the existing top-shell fifth requirement. The latter
is independent: bottom fifths do not satisfy `NO_FIFTH`; this request does not
authorize removing it. Range, syntax, multiple-Ding ambiguity and later geometry
or no-playable-card handling likewise need their own unchanged negative controls.

`scaleInfer` sorts each zone by MIDI, using typed `at` as an equal-pitch tie. It
rejects repeated rim notes, inner notes sharing a rim pitch, repeated inner
notes, and repeated bottom notes. Ding/rim and Ding/inner equality instead hit
the stricter Ding ordering check. Cross-shell copies already survive.

`importer.composeStage` (717–738) incrementally calls the parser and maps repeated
upper notes to `IN_TOP`; `composeBottoms` (743–770) separately rejects repeated
bottom MIDI as `IN_BOTTOM`; `compose` (819 onward) finally reparses the result.
These are distinct gates. Warning state currently has only `warn.bottom` and
`warnCodes.bottom`. `composeDuplicate`/`composeDuplicateCode` (773–804) warn only
when an **inferred** bottom octave matches Ding/rim/inner. Explicit `D3` bottom
beside Ding D3 composes successfully with no warning. A generalized warning
contract needs consistent coverage of all zones and both explicit/inferred notes.

### Inference is not multiplicity

The line `(D3) A3 [E] [E]` currently succeeds as E4/E5, because canonical line
inference advances from preceding typed notes. The dedicated BOTTOM field uses
`core.inferBottoms` (261 onward), starting below Ding; identical bare letters can
therefore infer different octaves there too. Do not turn an omitted-octave
sequence into copies or unify these entry-path conventions accidentally. Exact
copies should be established after existing inference, with explicit octave
examples in the UI/research fixtures. Typed enharmonic spellings remain labels
(`ENGINE-SPEC.md:398`), not evidence of different physical MIDI.

### Freeform importer is a separate decision surface

`importer.interpret`, role extraction (`labelledLists`/`clauseLists`, 353 onward),
and shell/MIDI grouping (520–543) distinguish roles and ambiguous lists.
`FLAG_ORDER` (25–33) makes `REPEATED_IN_SHELL` BLOCK and cross-shell
`DUPLICATE_PITCH` CONFIRM; ambiguous lists/count conflicts/Ding flags are separate.
Two labelled top lists can represent conflicting readings, not two extra sets
of physical fields. Existing `tests/import.test.js:1034,1046` pin those contracts.

Change repeated-note handling only for confidently declared physical occurrences.
Do not count prose reiteration, a heading repeating a list, or alternate readings
as additional tone fields. Investigate occurrence provenance/duplicate mentions
with positive and negative fixtures before choosing how freeform inference
behaves. Removing all confirmation/block flags would change unrelated ambiguity
and could create phantom positions. Import parsing may itself need a provisional
success representation if the final canonical parser currently blocks its result.

## Occurrence identity and physical order

Current field IDs already distinguish positions. `parseSeed` creates Ding `0`,
rim then inner IDs `1..N`, and bottoms from `max(101,tops.length+1)`. They are
occurrence IDs, not MIDI keys. Its non-enumerable `typed` array records original
typed occurrence order. Repeated tones need not introduce UUIDs or pitch-set
identities without evidence that existing positions are insufficient.

**Latent bug if only rejection is lifted:** `importer.composeTyped` (805–816)
looks up the first field matching zone and spelling/octave for every typed token;
it does not consume the match. Two identical names would both map to the first
ID. `core.typedSeats` (1036–1051) uses `typed.indexOf(id)`; a missing second ID
can invalidate ring seats. `index.html:12364 deriveTyped` consumes those results
for typed arrangement and ring feedback. Require a multiplicity-preserving
one-to-one mapping with deterministic equal-MIDI ties, not a Set or repeated
first-match lookup. `decomposeFields` (index.html:13491) must return every field
when editing; arrangement IDs/seats/angles must keep equal labels distinguishable.

`core.identitySeed` (945–975) enumerates every field in canonical zone order;
`deckId` (1013) hashes it. Multiplicity therefore naturally changes identity if
occurrences survive. Layout options remain excluded. Preserve all current valid
identity outputs and cross-shell tie policies. `voicing.js:80–90` already prefers
top shell for equal MIDI, then field ID; physical-choice changes belong to the
engine lane and owner decision. Same-pitch copies and distinct-octave voicings
must not be conflated.

Canonical text alone cannot record the act of swapping two identically labelled
positions. Document what must round-trip in `seats`/`angles`, and define stable
occurrence correspondence after insert/remove/reorder before implementation.
Acceptance needs repeated fields in every ring, equal-MIDI enharmonic names and
interleaved typed order, including save→edit→share→reopen and SVG/print/export.
This note traces serialization inputs; visual and engine-output behavior remain
unexecuted and must be checked by their lanes.

## Specification reconciliation: no invented capacity limits

`ENGINE-SPEC.md:400` records historical P0d “no duplicate fields.” It explains
old intent, but current source already accepts cross-shell copies; the new owner
request changes the relevant prohibition after approval, not every neighboring
constraint. `ENGINE-SPEC.md:311,481` retire all ring/total note caps.

**Contradicted documentation:** section3.9 (415–420) says the legacy reader keeps
its caps. Actual `core.js:351–355` explicitly says it has **no caps**, preserving
only positional spill so stored zones/IDs remain stable. `validate` (428 onward)
has no note-count cap, and `assemble` (492 onward) avoids bottom ID collisions
past 100 top fields. Existing `tests/core.test.js:1042,1055` assert those cases.
Do not revive legacy caps while “preserving compatibility.” Preserve old grammar,
positional spill, errors where unaffected, accepted IDs and existing long pans.

`share.js:94` enforces a real 4096-character payload limit. Its nearby “120
notes” explanatory ceiling is stale; payload length is not a physical-note cap.
Large duplicate pans require bounded performance measurements later, not an
invented maximum. Existing wire bounds/invalid-option checks stay independent.

## Share, storage and rollback compatibility

Wire VERSION6 and storage RECORD_VERSION4 are separate (`share.js:83–94`).
`share.encode` (321–355) expects an already-valid seed; it serializes fields and
checks output length, rather than revalidating scale semantics. Diagnostic:

1. Parse supported `(D3) A3 [E4]`.
2. **Unsupported current input:** add a second bottom E4 as field102 in memory.
3. `formatSeed` returns `(D3) A3 [E4] [E4]`.
4. Existing encoder succeeds with `6/(D3)_A3_uE4_uE4/*D+IONIAN+2/89c87a`.
5. Existing decoder refuses the same code with NOTE_REPEATED.

This proves encoder success is not current acceptance or backwards compatibility.
It does not demonstrate the UI can save/display duplicates. Generated name in
this diagnostic is existing behavior, not an approved physical-note count policy.

`share.decodeSeed` (563–587) checks payload limit, then newer version, then reader;
`scaleLineReader` (554) selects legacy <=3 or current parser >=4. The readable
decoder (437–510) calls current parseSeed. Altering that parser silently changes
the accepted language of old current-format links unless explicitly gated.

Application routes: `openShare` (index.html:9977) decodes → `generateDeck`
(9869, reparses current canonical string) → remember/select. `scaleRecord`
(10024) writes `{v:4,s:formatSeed(fields),o:options}`; `scaleReader` (10032) uses
legacy below4/current at4+. `copyLegacyScales` (10007) copies old `hpfc.scales`
into `hpfc.scales.v3` without deleting the older key. `recordOptions` (10097)
migrates old flat order to per-ring seats. `restoreScales` (10117) preserves
unreadable/new-version/non-object records byte-for-byte at their list index,
migrates readable old records, and collapses duplicate resolved IDs first-wins.
These source properties were inspected; real storage writes were not executed.

Compatibility alternatives requiring ENG review and owner trade-off:

| Alternative | Benefit | Cost / stop condition |
|---|---|---|
| Keep versions unchanged, expand current reader | Smallest format change | Older same-version clients refuse newly accepted links; no honest “requires newer app” diagnosis; weak rollback distinction |
| Feature-specific newer wire/record version only for newly accepted inputs | Existing valid link bytes/record behavior can stay unchanged, including current cross-shell unisons | Define capability predicate and version-aware comparison everywhere; freeze historical readers deliberately; reject if partial paths mislabel capability |
| Bump all writer versions | Simpler uniform output policy | Changes existing valid output fixtures/migration behavior; broader rollout and old-app write risks; cannot claim byte preservation |
| Separate new storage namespace | Stronger old-writer isolation | More migration/recovery complexity; evaluate only if version-aware shared-key protection is insufficient |

Provisional preference: capability-specific versioning preserving existing valid
outputs, subject to demonstrating complexity is justified and historical-reader
semantics are explicit. Do not bump wire/storage in this planning task.

**Rollback caveat:** boot preservation is not complete recovery. `recordDeckId`
(10037) ignores `checkShareVersion`; old readers can still compare a future-version
record with an old-readable string and match it during remember/replace/dedup.
`sameDeck` falls back to exact string when parsing fails. RESET SEEDED SCALES
(13033–13070) deliberately removes replacement records by `o.replaces`, regardless
of version/readability. Test old/new app edit, save, delete, dedup, replacement,
reset and refused-write flows against a copied disposable store; boot alone is
insufficient. Never test recovery against owner storage or promise old apps can
display new instruments. Export/recoverable snapshot and rollback instructions
must precede production storage changes.

## Required acceptance, failures and lane handoff

Before execution: owner resolves “anywhere”/Ding equality, single/all/alternate
physical voicing choice and warning acknowledgement; ENG selects protocol/storage
strategy; design defines named per-zone warning and equal-label accessibility.
All remain pending here. Preserve English note syntax and settled localization.

Proposed independent test oracles (not executed):

1. Screenshot yields19 unique field IDs,18 unique MIDIs, two separately movable
   E4 bottoms and a non-blocking warning; compose/line/import/save/share/reload
   preserve counts, spelling, zones and declared arrangement.
2. Explicit same-zone/cross-zone/Ding/enharmonic pairs behave as approved;
   `(D3) A3 [E] [E]` retains current inferred E4/E5 without an exact-unison warning.
3. Every current accepted fixture retains canonical text, deckID, layout and
   selected cards/links unless separately approved; current long-pan/legacy
   fixtures remain uncapped. Revised duplicate-refusal assertions change only
   for the newly approved semantics, not all historical parser failures.
4. Invalid syntax/range/multiple-Ding/ambiguity/fifth/layout/wire-length cases
   remain rejected as appropriate; an unrelated blocking failure is not hidden
   by a duplicate warning. Import repeated prose creates no phantom fields.
5. Actual old reader handles new links deliberately (prefer NEEDS_NEWER_APP),
   preserves new records through documented supported actions, and retains all
   old data. Failure to prove preservation blocks storage rollout.
6. Positional swaps and equal-label edits keep a bijection between typed
   occurrences, field IDs, seats, angles, selected/highlighted/exported fields.

Stop on loss/coalescing of any occurrence; existing ID/link drift; first-ID
reuse; incompatible version mislabeled current; changed inferred octaves;
reintroduced caps; unresolved Ding/voicing choice; or storage-loss evidence.
Do not delete failing tests or normalize spelling to conceal failures. Remediate
in the appropriate file-owned implementation lane after approved plan/reviews.
Rollback must retain canonical-source/generated-copy discipline, revert only
authorized diffs, and preserve newer stored instruments even if undisplayable.

## Evidence fingerprint and remaining limits

SHA-256 at inspected baseline:

| Source | SHA-256 |
|---|---|
| src/engine/core.js | `2aa04fadaa170ea389fc2a9575ebacc38293421a88084b4bcd5b2fc10130533c` |
| src/engine/importer.js | `237f51d8b8a76fc3f1ddbf05c3c0508c18cfe3a2bea149ca7c785bba21a379ae` |
| src/engine/share.js | `758fce7d6a9c6d837284274d8aa4ed4d51c1342a5f9be50f2ccd37f6476b6e84` |
| tools/engine_loader.js | `43f05577ff2f58495ebc1903819fddd903da9c2e079b18534be1adf4021a7a2d` |

Additional references: docs/ENGINE-SPEC.md sections3.8/3.9/4/share contract;
docs/SCALE_ENGINE_PLAN.md historical decisions; tests/core.test.js:1026,1042,
1055,1200,1416; tests/import.test.js:1034,1046,1362,1482,1575;
tests/share.test.js payload/version/legacy golden-link fixtures. Tests were read,
not run. No old-app runtime, end-to-end UI, physical geometry, storage mutation,
full voicing engine, PDF or screenshot export validation is claimed. The engine
and UX research lanes must complete those dependencies in the synthesized plan.
