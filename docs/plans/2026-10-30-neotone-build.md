# Paired-area ("Neotone") layout: execution plan

2026-10-30. Refs TRI-17. Supersedes the execution sections of
`docs/plans/2026-10-26-mutant-neotone-layout.md` (origin/dev) and closes
`docs/plans/2026-10-27-neotone-open-questions.md`. Plan only: no code, commits or
Linear writes were made producing it. Base: origin/main `ee5438d0` (saved variants
shipped). Start: after the current queue; DEV only, main PR held (Q7).

## Owner answers applied (2026-10-27, settled)

| Q | Answer | Consequence for this plan |
|---|---|---|
| Q1 | B: generic "paired areas" profile, no hardware-accuracy claim | One fixed generic profile, `paired` rev 1. No model/revision, no screenshot, no slot inventory research. Visible copy never names Mutant/Neotone/a vendor; the word is "Paired areas". |
| Q2 | A: placement only; engine roles unchanged | Voicing, tiers, badges, number lines, highlighting read the SOURCE zone (rim/inner/bottom) exactly as today. A secondary slot never makes a note "bottom"; a source bottom note keeps its badge, dashed ring and orange accents wherever it is placed. No `voicing.js`/`select.js` edits. |
| Q3 | A: centre = existing Ding | Ding is not in the map; it is drawn at centre, unmapped, still excluded from voicings. |
| Q4 | A: browser + PDF parity before launch | App SVG, `HPE.pdfcards` and `tools/hifi.py` all draw the profile; no export refusal path is built. |
| Q5 | A: wire v7 only for profile-bearing links; acoustic links byte-identical v6; mixed-version isolation is a launch gate | Payload-dependent version selection in `HPE.share.encode`; record version 5 only for profile records (isolation below). |
| Q6 | Base is current origin/main | Rebase on the shipped saved-instances store (`hpfc.saved-scales.v1` IDB). |
| Q7 | After the queue, DEV only | PR M to main stays open; PR D to dev merges under the standing dev rules. |

**Cut because of Q1/Q2/Q3** (versus the 10-26 plan): hardware fixture research,
occurrence ordinals (see "occurrence key"), diagram hit-target selection, secondary-
as-bottom semantics and copy, centre reassignment, export-refusal UI, profile badge
copy, practice-mode changes (A/B/S already render whatever `pan` draws).

## Re-verified seams on origin/main ee5438d0 (symbol anchors)

Engine (`src/engine/*.js`, inlined by `tools/inline_engine.py`):
- `HPE.core.parseSeed` / `formatSeed` / `fieldsOf` / `deckId` / `identitySeed`:
  the one validator of seeds and options. `scaleRepeated` (`NOTE_REPEATED`) refuses a
  repeated pitch within the top zones and within bottom; an exact top/bottom pair is
  legal. So `(zone, midi)` is unique per deck - confirmed by reading; lane E pins it
  with a test before relying on it.
- `HPE.layout.solve` -> `merge` / `geometryAt` / `placeZones`; `readSeats`,
  `readAngles`, `resolveMirrors`, `resolveAnchor`. Field position = `g[zone]` orbit x
  field angle; radius = `g.r_note` or `g.r_bnote` by zone. No per-field orbit exists.
- `HPE.share`: `var VERSION = 6` is global; `encode(seed)` writes `String(VERSION)`
  into both `segs` and `meaning` (checksum), options appended in fixed order
  (`palette-`, `parent-`, mirror family, `between`, `seats-`, `at-`), cap
  `CAPS.payload` 4096. `decodeSeed` clamps to `NEWEST`; every version <= `NEWEST` decodes, >= 5 via
  `decodeReadable`, whose option gates key on `charAt(0) === "5"/"6"` (E6). v7 =
  raise `NEWEST`, add the gate as an explicit set, fix the `NEWEST = VERSION` alias. `RECORD_VERSION = 4`.
  `NEEDS_NEWER_APP` already exists in `HPE.core` REASONS.
- `HPE.pdfcards` pan drawing (`fieldOrder` loop): orbit `R * g[zone]`, radius by
  zone, numbers by zone (`n_out` bottom / `rim_num_out` / `n_in`).
- `tools/hifi.py` `draw_pan`: same anatomy, independently; `tests/test_pdf_parity.py`
  drives GENERATED decks through `decks.from_generated` -> hifi, so hifi must learn
  the profile too.

App (`index.html`, outside engine regions):
- Renderer `pan` / `panField`; sheet `layoutOptions`, `sheetOptions`,
  `solvePreviewLayout`, `resetLayout`, `resetSheetState`; `buildGenerated`.
- Storage: `SHARE_VERSION = HPE.share.RECORD_VERSION`; `scaleRecord(seed)` writes
  `{v: SHARE_VERSION, s, o}`; `checkShareVersion(v)` returns `NEEDS_NEWER_APP` for
  `v > SHARE_VERSION`; `readSavedRecord` turns that into `opaque-record`;
  `stageSavedEnvelope` `continue`s past an unreadable row, keeping it in
  `envelope.entries` (not in `views`); `savedMeaning` is the dedup/content identity
  (scale + name + parent + palette + mirrors + anchor + seats + bottom angles);
  `savedCandidate` refuses `candidate.record.v !== SHARE_VERSION`; `reset` command
  removes only `replaces` rows present in `views`; slot check
  (`slot-authority`) requires every `e.slots` owner to have a view, else the WHOLE
  collection is `protected`.
- Pre-IDB keys (`hpfc`, `hpfc.scales`, `hpfc.scales.v3`) are migration sources only;
  new records never touch them.

### Mixed-version isolation (the Q5 launch gate) - derived from the above

A shipped (v6/record-4) client meeting a record `v: 5`: `checkShareVersion` fails ->
opaque row, kept byte-for-byte in `entries`, absent from views, so it survives that
client's Add, Edit, Delete (by instanceId of a view), RESET SEEDED (views only) and
any whole-envelope commit (entries cloned from the staged envelope). Its
`savedMeaning` never sees it, so no dedup collision. A `preferredSelection`
pointing at a v5 row falls back to a visible scale and may be rewritten by an old
commit (E5): no data loss; the suite asserts row bytes, not envelope bytes. ONE hole: if a profile record
owned a seeded slot (`o.replaces`), the old client fails `slot-authority` and
protects the whole library. **Rule I1: a profile record never carries `replaces` and
never owns a slot** (SAVE on a seeded scale with the profile active saves a new
custom entry). Therefore no namespace or second store is needed; isolation = record
v5 + I1, proven by tests against a pinned copy of the shipped client (below).

## Frozen profile fixture: `tests/fixtures/paired_profile_v1.json` (new)

Generic, owner-free, written once by lane T, never derived from implementation:

```json
{ "id": "paired", "rev": 1,
  "areas": 9,
  "angles": [270, 230, 310, 190, 350, 150, 30, 110, 70],
  "primary":   { "orbit": 0.58, "r": 0.16 },
  "secondary": { "orbit": 0.86, "r": 0.11 },
  "ding":      { "r": 0.21, "dy": 0 },
  "n_in": 0.052, "n_out": 0.068, "extent_margin": 0.06,
  "slots": ["p1","p2","p3","p4","p5","p6","p7","p8","p9",
            "s1","s2","s3","s4","s5","s6","s7","s8","s9"] }
```
Area k sits at `angles[k-1]` (the existing nine-rim, anchor-one zig-zag, odd right);
`sk` is outward of `pk` on the same angle. Fractions of R. Non-overlap holds with
margin (adjacent primaries: chord 0.397 > 0.32; p-s radial gap 0.28 > 0.27;
secondary outer edge 0.97 < 1; ding edge 0.21 < primary inner edge 0.42) (D1:
r 0.085 could not reach the 3.6 pt octave-digit floor at R <= 74 pt). Lane T asserts
non-overlap AND, at the R the print extent rule yields, every glyph of every slot
>= 3.6 pt and name > number. Index numbers: primary inward (`n_in`), secondary
outward (`n_out`); number size = slot r x 0.64 (D2); name = slot r x RATIO[source
zone] (`LABEL_RULE`). **Print extent (D3):** the pan's printed extent for a profile
deck = max over slots of (orbit + r + n_out + number height) and ding edge; P derives
R from it in `HPE.pdfcards`, hifi and `tools/decks.py` identically and tests it.
**Empty slots (D4):** cards (app and print) draw nothing; only the sheet preview
shows a faint dashed outline with its area number. Capacity 18 non-ding notes
(Pygmy, the largest built-in, has 17).

## Frozen data and codec schema

**Seed option.** `options.profile = {id:"paired", rev:1, map:[18 entries]}`, entry
k is the occurrence placed in `slots[k]` or `null`. Occurrence key = `zone letter +
midi`: `r57`, `i77`, `b48` (unique by `NOTE_REPEATED`; no ordinals). Valid iff:
own keys exactly `id,rev,map`; `id==="paired"`, `rev===1`; `map` length 18; every
non-null entry matches `/^[rib]\d{1,3}$/` and names a non-ding field of the seed;
injective; every non-ding field appears exactly once. Refusals (new REASONS rows,
English, sentence + code, added to `docs/ENGINE-SPEC.md` table and the
`tests/scale.test.js` "every refused row carries its code and its sentence" table):
`PROFILE_UNKNOWN`, `PROFILE_MAP_INVALID`, `PROFILE_NOTE_MISSING`,
`PROFILE_NOTE_TWICE`, `PROFILE_FULL` (more than 18 non-ding notes). With a profile,
`mirror*`, `anchor`, `seats`, `angles` must be absent (`PROFILE_CONFLICT`); the
sheet keeps the acoustic draft separately and drops it from the committed record.
Validation lives only in `HPE.core.parseSeed` (spec 1).

**Proposal** (`HPE.layout.proposeProfile(fields)`): top notes (rim then inner, in
field-number order) fill p1..p9 then s1..s9; bottom notes fill the remaining
secondaries from s1, then remaining primaries. Deterministic, pinned by fixture.

**Layout.** `HPE.layout.solve` with a valid profile returns the ordinary geom plus
`geom.place = {fieldId: [angle, orbitFrac, rFrac]}` for every non-ding field, ding
at centre with `ding.r`. Fields keep zone, label and angle semantics; `ext`/`f_*`
unchanged for acoustic decks. Renderers branch only on `geom.place`.

**Wire v7.** `HPE.share.VERSION` stays the acoustic version 6; new
`PROFILE_VERSION = 7`; `NEWEST = 7`. `encode` picks 7 iff `opts.profile`, else the
exact current v6 bytes. v7 = v6 segment grammar with profile options forbidden from
being mixed with mirror/seats/at, plus one option segment `pair-` + 18 tokens joined
by `.`, `-` for empty (e.g. `pair-r57.r62.r64.-.…`), placed after `parent-`/
`palette-`, inside the checksum meaning. `decodeSeed` accepts 6 (as today) and 7;
v7 without exactly one `pair-` segment, or with `mirror*`/`between`/`seats-`/`at-`,
is `BAD_NOTE`; v6 with `pair-` is `BAD_NOTE`. Pinned old client (v6) given v7 ->
`NEEDS_NEWER_APP` (already its behaviour; asserted against the pinned copy).

**Record version is engine-owned (E2):** `HPE.share.recordVersion(seed)` returns 4
or 5; the app never picks it. Until lane U lands, profile acceptance is gated:
unless `HPE.core.PROFILE_ENABLED` is true, `HPE.share.decode` of v7 returns
`NEEDS_NEWER_APP` and `parseSeed` refuses `profile` (`PROFILE_UNKNOWN`). Lane U flips
the flag in the same PR that writes v5 records, so no v4 row with `profile` can ever
be written. `parseSeed` whitelists `profile` (other unknown options still drop).

**Record v5.** `RECORD_VERSION` stays 4 (acoustic records byte-identical); new
`PROFILE_RECORD_VERSION = 5` used by `scaleRecord` iff `o.profile`. App
`checkShareVersion` accepts up to 5; `scaleReader(5)` = `parseSeed`;
`savedCandidate` accepts 4 for acoustic and 5 for profile (and refuses 5 without
profile / 4 with profile); `savedMeaning` appends the canonical profile map (array,
null for acoustic - existing meanings of acoustic records unchanged, asserted on
the storage corpus). Rule I1 enforced in the save path and in `readSavedRecord`
(a v5 record with `replaces` is opaque).

## Lanes, ownership and waves

Branches `claude/pa-<lane>`, each in its own worktree from the previous lane head
(memory: lane branches stack on main, not dev). Every lane: tests first (RED), then
code (GREEN), mutants generated by `tools/refresh_mutants.py`/hand patch per repo
convention with no `index` lines, local smoke, push, CI `validate` at the verified
head is the evidence, fresh reviewer at that SHA, PR M (held) + PR D.

| Wave | Lane | Owns (exclusive) | Depends |
|---|---|---|---|
| 1 | **T** fixture + spec | `tests/fixtures/paired_profile_v1.json`, `tests/fixtures/shipped_client_ee5438d0.html.txt` (verbatim `git show ee5438d0:index.html`), `docs/ENGINE-SPEC.md` (profile section + refusal rows) | - |
| 2 | **E** engine + codec | `src/engine/core.js`, `layout.js`, `share.js`; `tests/core.test.js`, `layout.test.js`, `share.test.js`, `scale.test.js`, `link_corpus.test.js`; engine regions of `index.html` via `python3 tools/inline_engine.py` only; `tests/fixtures/engine_corpus_v1.json` only if `--check` of `tools/regen_engine_corpus.js` shows acoustic drift (it must not: drift = bug) | T |
| 3 | **P** renderers | `pan`/`panField` in `index.html` (renderer branch on `geom.place` only; E3), `src/engine/pdfcards.js` (+ inline), `tools/hifi.py`, `tools/decks.py` (only `from_generated` passthrough of `place`), `tests/pdfcards.test.js`, `tests/test_pdf_parity.py`, `tests/test_render_agreement.py` | E |
| 3 | **U** app | `index.html` outside engine regions except `pan`/`panField`, the single `PROFILE_ENABLED` line in `src/engine/core.js` (+ `python3 tools/inline_engine.py`; E10), `data/i18n/*.json` (+ `python3 tools/sync_i18n.py`), `tests/app.test.js`, `tests/e2e.test.js`, `tests/storage_corpus.test.js`, `tests/drawer_*.test.js` (regressions only) | E |
| 4 | **M** mutants + floors | `tests/mutants/pa_*.patch`, FLOORS rows in `tests/suite_health.py`, README mutant count | P, U merged to the stack |

P and U run in parallel (disjoint symbols; U's preview calls `pan`, which renders acoustic until P lands; P's engine edit is inlined by P, U never
touches engine regions; if both need a re-inline, the later lane re-runs
`tools/inline_engine.py` after rebasing - never hand-merge a region).

### Lane T acceptance
- Fixture exactly as frozen above; `tests/test_fixture_integrity.py` registers it.
- Shipped-client fixture stored as `shipped_client_ee5438d0.html.txt` (no HTML
  scanner picks it up), SHA256 in the fixture-integrity test. T spikes the harness
  that boots it with fake IDB/locks and records the command here before E starts
  (E4); concurrency = deterministic interleave: old, new, old commit on one envelope.
- ENGINE-SPEC gains: profile option grammar, occurrence key, v7 grammar, record v5,
  rule I1, refusal rows. Verify: `python3 -m unittest tests.test_fixture_integrity tests.test_readme_currency -v`.

### Lane E acceptance (tests written first)
- `(zone, midi)` uniqueness across all five built-ins and the import gold corpus.
- parseSeed accepts the proposal for every built-in; each refusal code fires on a
  minimal case; prototype keys (`__proto__`, inherited) and oversized maps refused.
- Layout property: for the fixture, all slot circles pairwise disjoint and inside the
  pan; `geom.place` covers every non-ding field once; acoustic solve output identical
  (engine corpus `--check` clean).
- Share: every builtin and every link in `tests/link_corpus.test.js` re-encodes to
  the identical pre-change bytes (v6 and checksum); v1-v6 corpus still decodes;
  profile seed -> v7 -> decode -> same seed (roundtrip over all built-ins with
  proposal, and 200 seeded random injective maps); v7 single-char flips refused;
  v7 under the cap for an 18-note map; v6 with `pair-` refused; v7 without `pair-`
  refused.
- Verify: `python3 tools/inline_engine.py --check && node --test tests/core.test.js tests/layout.test.js tests/share.test.js tests/scale.test.js tests/link_corpus.test.js && python3 tools/validate.py`.

### Lane P acceptance
- Builtin PDFs and all existing parity/agreement tests unchanged (no snapshot regen).
- New generated profile case (Pygmy + proposal, and a 9-note Kurd with two empty
  slots) through app SVG, `HPE.pdfcards` and hifi: tonefield positions, radii, label
  and number sizes, highlighting, badge, note/number lines agree (same tolerances as
  `test_tonefield_positions_agree` etc.); 3.6 pt print floor holds; source-bottom
  notes keep dashed ring + orange in a secondary or primary slot; secondary slots
  holding top notes draw as ordinary top fields.
- Verify: `node --test tests/pdfcards.test.js && python3 -m unittest tests.test_pdf_parity tests.test_render_agreement -v`.

### Lane U acceptance
UI (inside the existing Layout tab of the sheet):
- A two-option control "Layout: Standard | Paired areas" (44px targets). Choosing
  Paired areas fills the map with the proposal (draft only), hides mirror/anchor/
  seats/angle controls, shows the read-only diagram preview, an "Assigned n of n"
  count and an 18-row list (`Area 1 · main`, `Area 1 · small`, ...), each row a
  native `<select>` of the scale's notes + "Empty"; an option already used elsewhere
  is `disabled` with its location in the label. Choosing Standard restores the
  in-sheet acoustic draft untouched. "Reset areas" re-applies the proposal (draft;
  sheet Cancel still discards).
- Incomplete map blocks only SAVE/GENERATE with the inline message and focuses the
  first unassigned row; > 18 non-ding notes disables Paired areas with
  `PROFILE_FULL`'s sentence; no note is ever dropped.
- Editing the scale keeps assignments whose `(zone, midi)` survive; others become
  unassigned rows (never nearest-pitch).
- Profile SAVE on a seeded scale creates a custom entry (I1). Edit path (E1):
  `profile` joins `SAVED_PORTABLE_OPTIONS`; `savedEditedRecord` takes `v` from
  `HPE.share.recordVersion(seed)` not `SHARE_VERSION`; editing a slot owner (row
  with `replaces`) into Paired areas saves a separate custom entry and leaves the
  slot owner untouched; `savedCandidate` refuses `replace-builtin` with a profile.
  Tests: slot owner edit-to-profile leaves `slots` unchanged and the shipped client
  is not `protected`; profile -> Standard edit writes v4 without `profile`.
- Accessibility/copy (D5-D11): Standard/Paired areas as `aria-pressed` buttons like
  MIRROR; `<label for>` on every select; "Assigned" count `aria-live`; errors in
  `#scale-guidance`; focusing a row highlights its slot in the preview; one-line hint
  "Set a note's area to Empty to move it"; landscape uses the existing sheet split;
  RESET AREAS replaces RESET LAYOUT while active; `PROFILE_FULL` sentence visible;
  strings pass the visible-text audit (no "deck", no vendor name). saved/shared/reloaded
  profile decks reproduce the same diagram; LINK copies a v7 link; address bar
  (`syncRoute`) carries v7 for profile decks.
- Release safety (`tests/storage_corpus.test.js`, `tests/app.test.js`): every stored
  record in the corpus reads identically and its `savedMeaning` is unchanged;
  acoustic saves still write `v: 4` byte-identical records; profile saves write
  `v: 5`. Pinned shipped client (`tests/fixtures/shipped_client_ee5438d0.html.txt`) run in
  the boot-sim/DOM harness against an envelope holding a v5 row: Add, Edit,
  Delete another entry, RESET SEEDED SCALES, and reload each leave the v5 row
  byte-identical; the old client is not `protected`; then the new client reads it
  back. Reverse: new client leaves old v4 rows byte-identical. Concurrent: old and
  new tabs commit alternately through `BroadcastChannel` reconcile; no row lost.
- i18n step: keys for every new string in all eight tables (`data/i18n/{en,de,es,
  fr,it,ja,zh-Hans,zh-Hant}.json`), `python3 tools/sync_i18n.py`, the app i18n audit
  tests (every key in every table, English DOM fixture `tests/fixtures/i18n_english_dom_v1.json`
  updated), and the fit check at 380px portrait and landscape for the longest
  locale (panel fit rules in `tests/app.test.js`). Card copy stays English.
- Verify: `python3 tools/sync_i18n.py --check && python3 tools/validate.py && node tools/boot_sim.js && node --test tests/app.test.js tests/storage_corpus.test.js tests/drawer_grid.test.js tests/drawer_drag.test.js tests/drawer_seats.test.js` (e2e single tests locally with CHROME_BIN; full e2e = CI).

### Lane M acceptance
Each mutant killed for the right reason (`./tests/mutation_check.sh` filtered to
`pa_`; `# suite:` headers use `.` wildcards): v7 emitted for acoustic seed; v6
emitted for profile seed; `pair-` outside checksum; injectivity check removed;
coverage check removed; `geom.place` ignored by pdfcards; ignored by hifi; secondary
treated as bottom zone in badge count; savedMeaning omits map; profile record
written v4; I1 removed; shipped-client opaque row dropped on reset (on the fixture
harness). FLOORS from main's CI artifacts. Verify: `python3 tools/refresh_mutants.py --check && ./tests/mutation_check.sh` (CI shards are the oracle).

## Launch gates (all on DEV)
1. Full `validate` green at each lane's verified head SHA; independent reviewer
   PASS/PASS_WITH_NITS at that SHA.
2. Mixed-version isolation suite (lane U) green, including the pinned shipped client.
3. Served DEV check per `docs/testing/browser.md`: create, save, share, reopen a
   Paired-areas scale at 380px; print PDF visually matches the app diagram; an
   existing saved library on the device is untouched.
4. Main PR held until the owner says merge (Q7).

## Non-goals
Hardware accuracy, model names, MIDI/audio, a second storage namespace, centre
reassignment, percussion areas, secondary-as-bottom voicing, duplicate notes,
multiple profiles or revisions, diagram tap-to-assign, profile in seeded built-ins,
changes to `data/decks.json`, voicing/select/tier code, practice modes.

## Risks
- R1 Hidden acoustic byte drift from refactoring `encode`: guarded by the link
  corpus identical-bytes test and a mutant.
- R2 Old client protects the library: closed by I1 + pinned-client test; any new
  slot-like field in a v5 record must be re-audited.
- R3 Label fit in small secondary slots (r 0.085R) at print floor: lane P asserts
  3.6 pt; if it fails, enlarge `secondary.r` within the non-overlap property, a
  fixture rev change BEFORE merge only.
- R4 Region conflicts between P and U: re-inline, never hand-merge. Non-region `index.html` conflicts (E11): the second lane to land rebases and resolves by hand within its own symbols only.
- R5 hifi/pdfcards divergence: parity test on two generated profile cases.

## Recovery and rollback
Rollback = revert the U lane on dev (`claude/dev-revert-pa-u`): the flag returns to
false, v7 links show `NEEDS_NEWER_APP`, existing v5 records become opaque rows kept
byte-identical (the shipped-client isolation path) until U returns. Never revert E
once any v5 record or v7 link may exist on DEV; if E must change, add a rev, keep the
rev-1 reader. No storage clearing, no downgrade of v5 to v4.

### Recorded harness command (lane T spike, closes E4)

`boot({html})` in `tools/sandbox.js` boots any HTML string, so the pinned client
needs no second harness. With IDB, locks and BroadcastChannel injected it opens
`hpfc.saved-scales.v1` and reaches `booted === true`. Command (run from the repo
root; this exact boot is the test
`tests/test_fixture_integrity.py::TestShippedClientFixture::test_boots_with_idb_locks_and_broadcast_channel`):

```
node -e "const {boot,createOrigin}=require('./tools/sandbox.js');const html=require('fs').readFileSync('tests/fixtures/shipped_client_ee5438d0.html.txt','utf8');(async()=>{const app=boot({html,origin:createOrigin({storage:{}}),indexedDB:true,broadcastChannel:true,locks:true,isSecureContext:true,crypto:require('node:crypto').webcrypto,abortController:true});await app.waitFor(\"typeof booted !== 'undefined' && booted === true\",{timeout:4000});console.log(!!app.idb.inspect('hpfc.saved-scales.v1'));process.exit(0)})()"
```

Lane E builds the interleave suite on the same call: share one `createOrigin()`
between a `boot({html: shipped, ...})` and a `boot({...})` of the live
`index.html`, and drive old commit, new commit, old commit on one envelope,
asserting the v5 row byte-identical (the row, not the envelope: E5). Fixture
scanners: the `.html.txt` name is picked up by none (`tools/validate.py`, readme
currency, i18n audit and the provenance guard read `index.html` or `*.html`).

## Continuation point
Next action when the queue clears: create lane T from origin/main head (re-verify
the anchors above if main moved past `ee5438d0`; repin the shipped-client fixture to
the then-current main), then E, then P ∥ U, then M.

## Review findings
(appended by independent reviewers)

### Design review round 1
(independent design reviewer; arithmetic uses `tools/decks.py` `_BAND_HALF` = 74 pt, so print R <= 74 pt and in practice ~66-68 pt once secondary numbers sit outward)

| id | severity | finding | proposed disposition |
|---|---|---|---|
| D1 | blocker | Secondary slot `r` 0.085R cannot meet the 3.6 pt print floor. Octave digit = 0.66 x 0.80325 x r; at r = 0.085R it is >= 3.6 pt only if R >= 79.9 pt, above the 74 pt band maximum (at R ~67 it is ~3.0 pt). R3 treats this as a possible failure to fix later; the arithmetic says it fails for sure, and the fallback ("enlarge secondary.r") collides with the frozen non-overlap margins (p-s gap 0.28 = 0.17 + 0.11 at r 0.11). | Re-freeze the fixture in lane T before anything else: e.g. primary {orbit 0.58, r 0.16}, secondary {orbit 0.86, r 0.11} (secondary edge 0.97, p-s gap 0.28 >= 0.27, adjacent primaries 0.397 > 0.32, ding 0.21 < 0.42). Then add a lane T property: at the R that `decks.py` derives for the profile's `ext`, every glyph (name, octave digit, number) of every slot is >= 3.6 pt. Recheck the numbers after `ext` is computed. |
| D2 | high | Index-number size for a secondary slot is not defined. "number = r_note x 0.64" is written per deck, and the plan says `r` = the slot's drawn radius for names only. With 0.085R or 0.11R the result changes, and so does "note name larger than its index number". | State it: number = slot r x 0.64 (each slot sizes its own number), and assert both the >= 3.6 pt floor and name > number per slot in lane P. |
| D3 | high | Printed `ext` with outward secondary numbers is not specified. The `decks.py` `ext` formula reads `rim`/`r_note`/`n_in`/bottom keys, not `geom.place`, so R could be computed wrongly (clipping past the band or a needlessly small pan). | Lane E/P: `ext` for a profile deck = max over slots of (orbit + r, plus n_out + number size for secondaries) + the existing 0.06 margin; test that the diagram stays inside the band and R is reproduced across app/pdfcards/hifi. |
| D4 | high | Drawing of an EMPTY slot (the 9-note Kurd case with empty areas, and partial drafts in the preview) is unspecified for cards, print and preview. | Cards and print draw nothing for an empty slot (the pan reads as it is played); the sheet preview alone draws a faint dashed outline plus its area number so the list rows map onto the picture. Add this to lane P/U acceptance. |
| D5 | medium | Row labels say "Area 3 · small", but the diagram's numbers are the note's field numbers (1..n), not area numbers, so "Area 3" and the digit 3 on the diagram point to different places. | Preview: when a row's select has focus or changes, highlight that slot in the preview (outline ring in the tone colour). Use main/small consistently in copy; do not reuse the word "note" or a bare number for areas. |
| D6 | medium | A note already in use is `disabled`, so moving a note means emptying its old area first (two steps, the second in a different row). On iOS the disabled option is greyed and the reason in its label is easy to miss. | Keep disabled options (settled UI), but add the visible "Empty" option first in every list and say in the sheet hint, in one sentence, that a note must be set to Empty where it is before it can go elsewhere. Alternatively (owner call, not required) choosing a used note moves it and empties the old row. |
| D7 | medium | The 18-row list at 380px landscape (~340 px usable height) pushes the preview off screen, so editing happens blind. | Portrait: preview above the list, compact rows (one line, label left, select right, 44 px height). Landscape: use the existing landscape plate split (preview left, list scrolls right). Add an e2e fit check at 380x(portrait) and landscape for the longest locale, as already required by the i18n step. |
| D8 | medium | Accessibility of the new controls is unspecified: the Standard / Paired areas control, the count, and the error. | Two `button.mode` with `aria-pressed` inside a labelled group (matches the MIRROR buttons); every select has a `<label for>`; "Assigned n of 18" (or of the note count, state which) in an `aria-live="polite"` node; the incomplete-map message in the existing guidance slot (`#scale-guidance`) so it is announced, focus moves to the first unassigned select. |
| D9 | low | Copy style: the existing Layout tab uses upper-case button text (RESET LAYOUT, MIRROR BOTTOM). "Reset areas" and the two-option control should match; RESET LAYOUT and RESET AREAS should not show together. | RESET AREAS replaces RESET LAYOUT while Paired areas is on; button text upper-case like its siblings; i18n keys for both labels and the count/row/option templates (`Area {n} · main`, `{note} (Area {n} · small)`) so locales can reorder. |
| D10 | low | The `PROFILE_FULL` reason shown when Paired areas is disabled is an English engine sentence. | Show it visibly next to the control (not only as a title tooltip) through the same translated path the sheet uses for other refusal codes; add the key in all eight tables. |
| D11 | low | Visible copy check: "Paired areas", "main", "small", "Area" are generic and use "scale" where the word appears; no vendor name. Confirm no visible "deck" in the new strings and no `Neotone` in any i18n table. | Add both words to the existing visible-text audit (no "deck", no vendor name). |

### Eng review round 1

Independent reviewer, 2026-10-30, against origin/main `ee5438d0` (read via `git show`). Owner answers Q1-Q7 not reopened.

| id | severity | finding (evidence) | proposed disposition |
|---|---|---|---|
| E1 | high | **I1 hole via Edit.** The plan enforces I1 only for "SAVE on a seeded scale" and in `readSavedRecord`. But `applySavedCommand` `edit` builds the record with `savedEditedRecord`, which starts from `savedClone(target)` and keeps every non-portable option, `replaces` included, and sets `v: SHARE_VERSION`. Editing an existing seeded replacement (a slot owner) and switching it to Paired areas therefore yields either a v4 record carrying `profile` (shipped client: `parseSeed` drops the unknown option and renders acoustic, and its own Edit keeps the field) or, once the version is per-payload, a v5 row WITH `replaces` that still owns `e.slots[seed]` -> shipped client fails `slot-authority` -> the whole library `protected`. Also `SAVED_PORTABLE_OPTIONS` lacks `profile`, so Edit drops a map or keeps a stale one. | Lane U: (a) add `profile` to `SAVED_PORTABLE_OPTIONS`; (b) `savedEditedRecord` picks `v` per payload (4 without profile, 5 with) instead of `SHARE_VERSION`; (c) an Edit that would give a slot-owning row a profile is refused or routed to `save-as-separate` (owner-visible choice: rec = save-as-separate, matching I1's SAVE rule); `replace-builtin` with a profile candidate refused in `savedCandidate`. Tests: edit-to-profile of a slot owner leaves `slots` unchanged and the shipped-client fixture is not `protected`; edit profile->Standard writes v4 with no `profile` key. Add a mutant "edit keeps replaces on a profile row". |
| E2 | high | **Wave gap: engine accepts profile before the app writes the right record version.** After lane E lands on dev (wave 2) and before U, a v7 link decodes to `options.profile`; `openShare` -> `generateDeck` -> `scaleRecord` writes `{v: SHARE_VERSION (4), o: {...profile}}`. Same state after the planned rollback "revert U on dev, keep E". A v4 row with `profile` is read by the shipped client as an acoustic deck (parseSeed drops the option), so the paired layout is silently lost on Edit there, and the new client's `savedCandidate` rule "refuse 4 with profile" would then reject/hide rows already written. | Move the record-version choice into the engine (e.g. `HPE.share.recordVersion(seed)` -> 4 or 5, owned by E) and have lane E also make `HPE.share.decode` of v7 / `parseSeed` with `profile` unreachable from the app until U (or ship E+U to dev in one merge). Rollback section: revert E's app-reachability together with U, or state that a reverted-U client must refuse v7 links (`NEEDS_NEWER_APP`-style) rather than store them. |
| E3 | high | **Lane P cannot meet its acceptance without lane U.** P's acceptance asserts app SVG agreement (`test_render_agreement` "through app SVG"), but the app renderer `pan` / `panField` is in `index.html` outside engine regions, owned by U. P and U are declared parallel in wave 3. | Either give P ownership of `pan`/`panField` (renderer only; U owns sheet/storage/i18n), or make P depend on U's renderer commit. Rec: P owns the renderer branch on `geom.place`; U is explicitly barred from `pan`/`panField`. |
| E4 | medium | **Pinned shipped-client harness is unproven.** `tests/fixtures/shipped_client_ee5438d0.html.txt` must be run with IDB, `navigator.locks` and `BroadcastChannel` to exercise `initializeSavedDurable` and the reconcile path. Nothing in the plan names the harness that does this for a second HTML file (boot_sim / storage_corpus load the live `index.html`). The "concurrent old+new tabs alternately commit" criterion is the most expensive and least specified. Also a ~1 MB second copy of `index.html` in `tests/fixtures/` may be swept by tests that scan HTML/fixtures (validate checks, readme currency, i18n audit, provenance guard). | Lane T: spike which harness loads an arbitrary HTML path with fake IDB/locks; record the command in the plan before E starts. Confirm no scanner picks up the fixture (or name it `.html.txt`). Reduce "concurrent" to a deterministic interleave: old commit, new commit, old commit on the same envelope via the store API, asserting the v5 row byte-identical. |
| E5 | medium | **Isolation argument: preferredSelection is rewritten, not lost.** If the new client's `preferredSelection` points at a v5 row, the shipped client's `savedResolve` falls back and the next old-client commit persists a different `preferredSelection`. No data loss, but the I-suite's "byte-identical" should be scoped to the row, and the argument should name this. Otherwise the argument holds: opaque rows are skipped by `stageSavedEnvelope` (`continue`), kept in `entries`, excluded from `identities`/`meanings`; `delete`/`edit` require `views.has`; `reset` removes only `savedScope` replacements filtered by `views`; `makeSavedMigration` keeps unreadable rows as `opaque`; `savedEnvelopeShape` never inspects `record.v`. | Add one sentence to the isolation section and one assertion (preference falls back to a visible deck, v5 row intact). |
| E6 | low | Seam text inaccurate: `decodeSeed` does not "read exactly one version per branch". It clamps to `NEWEST` and then `version !== VERSION` only fires for out-of-range bytes; every version <= `NEWEST` decodes, `>= 5` via `decodeReadable`. Supporting v7 = raise `NEWEST` to 7 + grammar in `decodeReadable`, whose option gates key on `text.charAt(0) === "5"` / `=== "6"` (`PALETTE_RE` vs `PALETTE_RE_V6`, `at-`). Note also the shadowed `VERSION` inside `decodeSeed`; with `VERSION` staying 6 and `NEWEST` 7 the alias comment ("NEWEST = VERSION") becomes false. | Fix the seam sentence; E's tests pin that a v7 option gate is written as `>= 7`/explicit set, and that v6 `palette-10` still parses under v7. |
| E7 | low | Acoustic bytes: provable as planned (encode adds `pair-` only under `opts.profile`; link-corpus identical-bytes test + mutant "v7 for acoustic"). Add: `HPE.layout.solve` output for acoustic seeds has no `place` key (engine corpus `--check`), and `savedMeaning` of every storage-corpus record unchanged (already listed). Also `parseSeed` currently drops unknown options silently, so lane E must whitelist `profile` and test that a stray `profile` on a v6 link path cannot be injected. | Keep; add the `place`-absent assertion. |
| E8 | low | Verify commands exist on origin/main (`tools/sync_i18n.py --check`, `tools/inline_engine.py --check`, `tools/refresh_mutants.py --check`, `tools/boot_sim.js`, all listed test files, `docs/testing/browser.md`, eight i18n tables). `tools/regen_engine_corpus.js --check` exists. Fixture geometry checks out (primary chord 2*0.62*sin20 = 0.424 > 0.34; p-s 0.28 > 0.255; 0.985 < 1). | None. |
| E9 | low | Over-scope: 200 seeded random maps + single-char flips are fine; "Concurrent tabs" (E4) and full 18-row select UI are the heaviest items, both within owner answers. Missing: `tests/mutants/` data-lane memory (regen of `c_*`/`b_*` not needed - no `decks.json` change) - confirm in M brief. | Note in M brief. |

### Author dispositions, round 1
E1 fixed (U acceptance, Edit path). E2 fixed (engine-owned record version + `PROFILE_ENABLED` flag; rollback rewritten). E3 fixed (P owns `pan`/`panField`). E4 fixed (T spike, `.html.txt`, deterministic interleave). E5 fixed. E6 fixed. E7 accepted (M adds "acoustic solve emits `place`" mutant). E8 none. E9: M brief notes no `decks.json` change, no `b_*`/`c_*` regen.
D1 fixed (fixture re-frozen 0.58/0.16 and 0.86/0.11 + floor property). D2 fixed. D3 fixed (print extent rule). D4 fixed (empty slots). D5-D11 fixed in U acceptance.

### Eng review round 2

Re-read after the author's round-1 dispositions.

| id | severity | finding (evidence) | proposed disposition |
|---|---|---|---|
| E1 | closed | U's acceptance now covers the Edit path: `profile` in `SAVED_PORTABLE_OPTIONS`, `savedEditedRecord` takes `v` from `HPE.share.recordVersion`, a slot-owner edit-to-profile saves separately, and `replace-builtin` with a profile is refused. Tests are named. | - |
| E2 | closed, with E10 | The engine owns the record version, and the gate stops v7 links and `profile` from reaching `scaleRecord` before U, so no v4 row can carry `profile`. The rollback text matches. | - |
| E3 | closed, with E11 | P owns `pan`/`panField` and U is barred from them. | - |
| E10 | medium | **Ownership and testability of `PROFILE_ENABLED`.** The flag is `HPE.core.PROFILE_ENABLED`, so it sits in `src/engine/core.js` (lane E). Yet "Lane U flips the flag", and U owns no engine file and must not touch engine regions. Second, lane P runs in parallel while the flag is false, but P's parity tests need profile seeds. If the flag is a fixed `var`, P's tests and E's own profile tests can't enable it. | U's ownership row gains exactly one line, the flag value in `src/engine/core.js`, plus a re-inline through `tools/inline_engine.py`. Make the flag a property tests can set inside the vm realm (for example `HPE.core.PROFILE_ENABLED = true` in the test loader), and say so in E's and P's acceptance. Add a mutant "flag ignored by decode". |
| E11 | low | P (`pan`/`panField`) and U (the rest of the app) both edit `index.html` outside the engine regions in the same wave. That is not a generated region, so the "re-inline, never hand-merge" rule doesn't cover it. | Whichever lane lands second rebases and resolves the conflict by hand, limited to its own functions. Write that into R4. |

Verdict round 2: **READY** (no blockers or highs). Fold E10 in before lane E starts.

### Design review round 2
D1-D11 checked against the revised text: all addressed. Floor arithmetic, with the existing `n_out` 0.068 and `decks.py`'s 0.06 margin: extent = 0.86 + 0.11 + 0.068 + 0.0704 = 1.108, + 0.06 = 1.168, so R = 74 / 1.168 = 63.4 pt. Small-slot octave digit = 0.66 x 0.80325 x 0.11 x 63.4 = 3.70 pt (>= 3.6; bottom-source ratio 0.8232 gives 3.79). Number = 0.0704 x 63.4 = 4.46 pt. Name > number because 0.80325 > 0.64. Primary slots clear easily. Without the 0.06 margin R = 66.8 and the digit is 3.90 pt.

| id | severity | finding | proposed disposition |
|---|---|---|---|
| D12 | medium | The fixture has no `n_out` value, and the extent rule does not say whether the 0.06 margin applies. The floor margin is only 0.10 pt, so either choice decides pass or fail (a larger `n_out`, e.g. 0.09, gives R 62.2 and a digit of 3.63 pt). | Freeze `n_out` (0.068) and `margin` (0.06) in `paired_profile_v1.json`; the lane T property computes R from those frozen values. |
| D13 | low | `fit_note`'s width auto-fit can shrink a wide label below the ratio size (its own floor is 2.5 pt). | Lane P's 3.6 pt assertion measures the size actually drawn after fit, over every profile test case (the Pygmy proposal includes Ab/Db/Eb labels in small slots). |

E10 fixed: U owns the flag line; E exposes it as a test-settable engine value in the vm realm so E and P tests run with it on; M adds mutant "flag ignored by decode". E11 fixed (R4).
D12 fixed: `n_out` 0.068 and extent margin 0.06 frozen in the fixture; T's floor property computes R from them (expected R ~63.4 pt, small-slot octave digit ~3.70 pt). D13 fixed: P's 3.6 pt check measures the size drawn after `fit_note`/`fitNote` fitting, on every profile case, including Ab/Db/Eb in small slots.
