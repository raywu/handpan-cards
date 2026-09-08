# ENGINE-SPEC: the user-configurable scale engine

Normative specification for `src/engine/*.js`. It is the single source every
engine lane asserts against. `docs/SCALE_ENGINE_PLAN.md` is the plan (why, who,
in what order); this file is the contract (what, exactly).

Read `CLAUDE.md` and `tests/CONTRACT.md` first. Nothing here may change deck
data, diagram geometry, or the OWNER DECISIONS D1-D14 of the plan.

## How to read this file

Every normative rule is a top-level markdown bullet beginning with `- ` and
carries exactly one tag:

1. `DECIDED(D<n>)` or `DECIDED(CLAUDE.md rule <n>)` - ratified by the owner.
   A lane may not deviate. Changing one is a plan amendment.
2. `DEFAULT[owner-review]` - an integrator default the owner has not ratified.
   Lanes proceed on it. Changing it later is a spec change handled by
   `tests/CONTRACT.md` rule 4, not a reason to stall. Owner review of the
   DEFAULTs is a gate after Phase 1, not before.

Non-rule text (context, tables, examples) is prose, numbered lists, or tables,
never a `- ` bullet. Sub-bullets are indented and inherit their parent's tag.

Companion fixtures owned by this lane, and the SPEC for the values they carry:

| Fixture | Contents |
|---|---|
| `tests/fixtures/qualities.json` | quality suffix -> intervals, display words, name split, tier |
| `tests/fixtures/parents.json` | the 11 D10 parent-scale candidates, in fixed list order |
| `tests/fixtures/synthetic_scales.json` | scale strings with their expected `parseSeed` outcome |

Per plan [eng-review 6A] the quality and parent tables live in these fixtures,
not in an engine export; `naming.js` carries its own literal and a lane-C test
asserts deep equality against the fixture. `tests/CONTRACT.md` rule 2 gains the
carve-out that comparing a module's exported table to the spec fixture is
allowed.

## 1. The result contract

Every public entry point returns a value of the result type and NEVER throws on
user input. Internal programming errors may still throw.

```
ok      = {ok: true,  value: <payload>, warnings?: [{code, reason}]}
err     = {ok: false, code: <CODE>, reason: <English sentence>}
```

- DECIDED(D5 / plan "One result contract" [eng-review 7A]) Every public entry
  point returns the result type and never throws on user input:
  `core.parseSeed`, `core.formatSeed`, `core.deckId`, `voicing.pick`,
  `layout.solve`, `naming.name`, `select.build`, `share.encode`,
  `share.decode`.
- DECIDED(plan [design-review 2A]) An `ok` result MAY carry `warnings: [{code,
  reason}]`; a warning never blocks and the UI shows it in the warning tier. An
  `err` result never carries `warnings` and never carries `value`.
- DECIDED(plan [eng-review 2, 2A]) `warnings` has exactly ONE producer,
  `select.build`. The registry copies them onto `deck.warnings` at generation
  time and every reader (success message, Edit sheet) reads `deck.warnings`;
  nothing regenerates to re-derive them.
- DECIDED(plan [eng-review 7A]) `code` is a member of the enum in section 2 and
  is stable forever; `reason` is the English sentence the UI shows, exactly as
  tabulated in section 2, with the named substitutions applied.
- DECIDED(plan [eng-review 7A]) The UI has exactly one adapter from this shape
  to the message area; no caller inspects `reason` to branch.
- DECIDED(plan [eng-review 3A]) Input validation lives only in
  `core.parseSeed`; the Phase 3 text box and the Phase 4 URL decoder both call
  it, and neither carries a whitelist of its own. `parseSeed` rejects, never
  repairs.

## 2. Code enum and reason strings

`<X>` is substituted with the offending value as the user typed it.

| code | kind | reason |
|---|---|---|
| `NO_DING` | error | `No ding. Start with the ding note, e.g. (D) or D/.` |
| `NO_FIFTH` | error | `No perfect fifth above the ding <X>. Add an A, or check the ding.` |
| `TOO_MANY_RIM` | error | `Too many notes for one pan: at most 11 rim, 2 inner and 6 bottom.` |
| `BAD_NOTE` | error | `<X> is not a note. Use names like C, F#, Bb, with an optional octave.` |
| `NEEDS_NEWER_APP` | error | `This link needs a newer version of the app. Reload.` |
| `NO_THIRDS` | warning | `Only power chords: no 3rds on this pan.` |

- DECIDED(plan [eng-review 7A]) The enum is exactly `NO_DING`, `NO_FIFTH`,
  `TOO_MANY_RIM`, `BAD_NOTE`, `NEEDS_NEWER_APP` (errors) and `NO_THIRDS`
  (warning); a lane that needs a new code amends this table rather than
  inventing one at the call site.
- DEFAULT[owner-review] The `NO_FIFTH` reason's `<X>` is the ding as
  `formatSeed` prints it (name plus octave, e.g. `D3`); the `BAD_NOTE` reason's
  `<X>` is the offending token verbatim, truncated to 12 characters.
- DECIDED(plan [eng-review 2, 2A]) Error and warning reason strings live in the
  same enum fixture as this table, so the UI never composes a sentence.
- DECIDED(plan "Degenerate cases", eng-review owners) `NO_FIFTH` is decided in
  `core.parseSeed`, before any voicing work: there is no top-shell note whose
  pitch class is a perfect fifth (7 semitones) above the ding pitch class.
  Bottom-shell notes do not satisfy it.
- DECIDED(plan [eng-review 2, 2A]) `NO_THIRDS` is raised by `select.build` when
  no root has a third (3 or 4 semitones) above it on the top shell, so the deck
  contains only power chords.
- DECIDED(D13) A pasted URL, a vendor link, or any other unparseable token is a
  `BAD_NOTE` rejection like any other token; nothing is fetched, stored or
  shown.

## 3. The scale string grammar (D13)

```
seed_string := ding  top_note+  ( "|"  bottom_note+ )?
ding        := "(" note ")" | note "/"
note        := [A-G] ("#" | "b")? ([0-9])?
```

- DECIDED(D13) Input is one freeform scale string in maker notation, not a
  per-note form.
- DECIDED(D13) The ding is MANDATORY, written `(C#3)` / `(C#)` (parentheses) or
  `D3/` / `D/` (trailing slash). Zero dings, or more than one, is `NO_DING`.
- DECIDED(D13) After the ding come the top notes in ascending zig-zag order,
  then optionally a `|` followed by the bottom notes.
- DECIDED(D13) Separators are whitespace; `(`, `)`, `/` and `|` are the only
  punctuation. Any other token, or a note name outside `[A-G](#|b)?(\d)?`, is
  `BAD_NOTE`.
- DECIDED(D13) Note tokens match `[A-G](#|b)?(\d)?`: an uppercase letter, an
  optional single accidental, an optional single-digit octave in scientific
  pitch notation (middle C = C4, so the built-in Amara ding is `D3`).
- DECIDED(D13) Octave inference on the top shell: the ding is the lowest note
  of the top shell, and each next top note is the next instance strictly above
  the previous one.
- DECIDED(D13) Inference restarts after `|`: the first bottom note is the
  instance nearest the ding (bottom notes may sit below it, e.g. Pygmy `C3 Db3
  Eb3`), and each subsequent bottom note is the next instance strictly above
  the previous one.
- DECIDED(D13) An explicit octave anywhere overrides inference for that note
  and reseeds the inference for the notes after it.
- DEFAULT[owner-review] Accidental spelling is the user's typed spelling,
  verbatim, on the field label and on the card; the engine never re-spells
  enharmonics.
- DECIDED(plan "Sharing is untrusted input") Every resulting MIDI number must
  be 0-127; outside that range is `BAD_NOTE`.
- DECIDED(plan P0d "no duplicate fields") Two fields may not be identical (same
  name and octave and zone); a duplicate is `BAD_NOTE`. Duplicate PITCH CLASSES
  across octaves are legal and expected.

The three built-in maker strings, which `core.parseSeed` must reproduce onto the
P0b fixture fields for `name, octave, midi, zone, label`:

```
(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4
(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5
(D3) A3 C4 D4 E4 F4 G4 A4 C5
```

## 4. Zone assignment and caps

- DECIDED(CLAUDE.md "App data model") Zones are `ding | rim | inner | bottom`,
  exactly the built-in enum.
- DECIDED(D13) The ding is its own zone and is assigned from the `( )` / `/`
  token only.
- DECIDED(D7, D12) Top notes are assigned in ascending order: the first up to
  11 are `rim` (the D7 stroke-aware ceiling), the next up to 2 are `inner`
  (D12).
- DECIDED(D12, plan P0d [review D3]) A 14th top note is `TOO_MANY_RIM`.
- DECIDED(D12) Notes after `|` are `bottom`, at most 6; a 7th bottom note is
  `TOO_MANY_RIM`.
- DECIDED(D12) The maximum accepted pan is therefore 19 non-ding fields (11 rim
  + 2 inner + 6 bottom), 20 fields counting the mandatory ding.
- DECIDED(D14 as amended, plan P0d [review D3]) Zone assignment happens in
  `core.parseSeed`; `layout.solve` never changes a zone, so the deck id never
  depends on layout code.

## 5. Legality invariants for a voicing

These hold for EVERY voicing the engine emits, built-in fixture or generated.

- DECIDED(CLAUDE.md rule 3) The ding never appears in a voicing.
- DECIDED(CLAUDE.md rule 3) No voicing contains two fields of the same pitch
  class.
- DECIDED(CLAUDE.md rule 3) A power chord is exactly two notes, root and fifth.
- DECIDED(CLAUDE.md rule 3, tests/CONTRACT.md "Verified data facts") One card
  per pitch set within a deck: no two chords share an identical `fields` list.
- DECIDED(CLAUDE.md rule 3, plan Premise 4) No sus2 cards: every sus2
  duplicates a sus4, and sus4 wins.
- DECIDED(CLAUDE.md rule 3, plan Premise 4) No 6-chord that duplicates an m7
  set: `X6` collapses into `Xm7` and `Xm6` into `Xm7b5`; m7 / m7b5 win.
- DECIDED(plan "Rendering budgets", D3) A voicing never exceeds 6 notes - the
  print floor, measured at Pygmy `Fm11`. When a chord symbol implies more, drop
  the LOWEST optional extension first (13, then 11, then 9), never a chord tone
  (root, 3rd, 5th, 7th, sus 4th).
- DEFAULT[owner-review] Chord-spelling order for the `fields` list is root, 3,
  5, 7, 9, 11, 13, as observed on `Fm9` and `Fm11`.
- DECIDED(CLAUDE.md "App data model") `fields` is the canonical voicing in
  spelling order; highlighting is DERIVED at render time from pitch classes
  (`midi % 12`) and is never stored.

## 6. Register: the cluster rule (D2) and the tie-break (D11)

- DECIDED(D2) The forced test is: ANY non-root tone of the chord - chord tones
  AND extensions alike - has no instance above the root. That is the operative
  test, exactly as
  `tests/test_deck_data.py::test_forced_tones_cluster_below_root` implements
  it, and it is why Pygmy `Fm11` counts as forced (its 11th forces it).
- DECIDED(D2, CLAUDE.md rule 3) When the chord is forced, every CHORD TONE
  (3rd, 5th, 7th; the 4th of a sus chord; the 6th of a 6-chord) moves to its
  HIGHEST instance below the root; a chord tone with no lower instance stays
  put.
- DECIDED(D2) On a forced chord, EXTENSIONS implied by the chord symbol (add9,
  9, b9; an 11 chord's 9th and 11th; a 13 chord's 9th, 11th and 13th; #11) keep
  their nearest instance ABOVE the root unless they are themselves forced.
- DECIDED(D2, CLAUDE.md rule 3) Bottom-shell fields are ordinary instances for
  the cluster rule: a chord tone clusters to the bottom shell when that is its
  highest lower instance (Pygmy `Cm7` -> Eb3/U3).
- DECIDED(D11) When the chord is NOT forced, every non-root tone sits above the
  root and takes its NEAREST instance above the root.
- DECIDED(CLAUDE.md rule 3, plan Premise 5) "Root position" is the SPELLING
  ORDER of the field list starting at the root; it says nothing about register,
  and the root need not be the bass note (12 of 59 built-in cards are not). The
  root and the spelling order never change.
- DECIDED(D11, plan Premise 2) Recorded voicing exception, two-sided (it must
  still diverge): Pygmy `Fm9` ships G5 where the D11 nearest-above tie-break
  gives G4. CLAUDE.md names the spread 9th as a permitted free choice.
- DECIDED(plan Premise 2 consequence 1) Containment is the Phase 1 gate: every
  one of the 59 fixture tuples must be a member of the engine's legal candidate
  set for its (root field, interval set).

## 7. Root octave (D9)

- DECIDED(D9) Root-octave policy: the LOWEST TOP-SHELL instance of the root
  pitch class, else - when the pitch class exists only on the bottom shell -
  the lowest instance overall.
- DECIDED(D9) Recorded root-octave exceptions of the built-in fixture, not
  engine bugs: Pygmy `Db` and `Dbmaj7` (ship Db4 = U5, the higher of two
  bottom-shell instances) and Pygmy `Eb7` (ships Eb3 on the bottom although rim
  Eb4 exists).
- DECIDED(plan "Multi-voicing is opt-in data") The five HIGH / LOW VOICING
  alternates (Hijaz `Bm` high, Pygmy `Ab` high, Pygmy `Cm` high and low, Pygmy
  `Eb` low) are unreachable by any function of (root pitch class, interval
  set). They are opt-in multi-voicing DATA recorded against the built-in
  fixture, never a policy the engine reproduces; generated decks emit one card
  per chord.

## 8. Chord selection (D1), ranking, cap, dedup, order

- DECIDED(D1) Default quality vocabulary: major, minor, diminished, augmented,
  power, sus4, maj7, m7, dominant 7, m7b5, dim7 - the 11 D1 qualities. Extended
  chords only where the scale makes them obvious.
- DEFAULT[owner-review] "Obvious" is operationalised as: an extended quality is
  a candidate only when EVERY one of its tones lies on the top shell.
- DEFAULT[owner-review] Card cap per generated deck: 25. It only bites beyond
  Pygmy's size.
- DEFAULT[owner-review] Ranking, applied to trim to the cap: triads > power >
  sus4 > 7ths > extended; within a tier, more top-shell tones ranks higher;
  remaining ties break by root scale degree ascending from the tonic, then by
  the quality's order in `qualities.json`.
- DECIDED(CLAUDE.md rule 3, plan Premise 4) Dedup: sus2 collapses into sus4,
  `X6` into `Xm7`, `Xm6` into `Xm7b5`, and any two candidates with an identical
  `fields` list collapse to the higher-ranked one.
- DECIDED(plan "The engine must also decide these") Root disambiguation for a
  pitch set with several valid roots: prefer sus4 over sus2, m7 over 6, m7b5
  over m6 (already in the data).
- DEFAULT[owner-review] Symmetric-set root tie-break (diminished, whole-tone,
  augmented, where every root is equally valid): prefer the tonic, else the
  lowest scale degree.
- DEFAULT[owner-review] Canonical card order for GENERATED decks: roots by
  scale degree ascending from the tonic; within a root, triad, power, sus4,
  7th, extended. Built-in order is editorial and untouched.
- DECIDED(plan Premise 4, D4) Per-deck override lists default to empty. The
  built-ins' out-of-vocabulary cards are recorded as overrides in
  `tests/fixtures/divergence_v1.json` under an `overrides` key (Phase 2 owns
  that file).
- DECIDED(D4) Equivalence annotations are a per-card override field. The
  built-ins keep exactly the two they ship (Hijaz `HALF-DIMINISHED ( = Bm6 )`,
  Pygmy `Bb MINOR 7 ( = Db6 )`); custom scales derive them mechanically under
  the m7 -> `X6` / m7b5 -> `Xm6` definition. The five unannotated eligible
  cards (Pygmy `Gm7b5`, `Fm7`, `Cm7`; Amara `Dm7`, `Am7`) are provenance, not
  bugs, and must NOT be annotated.

## 9. Naming and the quality table

- DECIDED(plan [eng-review 6A]) Quality intervals, display words, the
  `main`/`sup` split and the tier come from `tests/fixtures/qualities.json`,
  keyed by the full quality suffix. The fixture is the SPEC; `naming.js`
  carries its own literal and a test asserts deep equality.
- DECIDED(index.html DECKS, verified over all 59 cards) A card's `main` is the
  root spelling plus the entry's `main_suffix`, and its `sup` is the entry's
  `sup` - the superscript the card renders (e.g. suffix `m7b5` -> `main:
  "G#m7"`, `sup: "b5"`).
- DEFAULT[owner-review] Chord name (`main` + `sup`) is at most 16 characters.
- DECIDED(plan "Rendering budgets", D3) Subtitle is at most 25 characters, the
  measured maximum (`HALF-DIMINISHED ( = Bm6 )`, `D MAJOR 7 SHARP 11 (NO 5)`);
  the print pipeline shrinks to a 3.6pt floor and then clips silently, so this
  is a hard engine constraint with a test.
- DECIDED(CLAUDE.md "Card copy is English-only", index.html DECKS) Generated
  subtitles are `<ROOT> <DISPLAY>` for rooted qualities (`F MINOR 7`) and the
  bare `<DISPLAY>` for the rootless ones the built-ins use (`POWER CHORD`,
  `SUSPENDED CHORD`, `SUSPENDED DOMINANT 7`, `SUSPENDED MAJOR 7`, `DIMINISHED`,
  `DIMINISHED 7`, `HALF-DIMINISHED`), plus a ` ( = X6 )` equivalence suffix
  when D4 applies. Card copy is English-only.
- DECIDED(plan Phase 1 lane C exit) The editorial built-in subtitles `HIJAZ
  SIGNATURE CHORD`, `- HIGH VOICING` / `- LOW VOICING` and `(NO 5)` are
  recorded exceptions of the fixture, not strings the engine generates.

## 10. Degrees: numerals (D8) and case (D10)

- DECIDED(D8, D10, D13) The tonic is the ding pitch class. The ding is
  mandatory, so there is no fallback.
- DECIDED(D8) Degree NUMERALS are mode-aware: minor-relative (`III`, `VII`) for
  scales with a minor third, major-relative with flats (`bIII`, `bVII`)
  otherwise. Fallback for no-third and symmetric sets: major-relative with
  flats.
- DECIDED(D10) Degree CASE comes from stacked thirds over a 7-note PARENT
  scale, not from the pan alone: a minor third above the degree root gives
  lowercase, a major third uppercase, a diminished fifth adds the `°` suffix.
- DECIDED(D8, D10) Frozen degree exceptions, two-sided: D Amara ships `bIII` /
  `bVII` (D8) and `IV` where stacked thirds derive `iv` (D10). D Amara is
  declared Aeolian.
- DEFAULT[owner-review] Parent inference candidates are the 11 entries of
  `tests/fixtures/parents.json` in this FIXED list order: Ionian, Dorian,
  Phrygian, Lydian, Mixolydian, Aeolian, Locrian, harmonic minor, melodic
  minor, Phrygian dominant, harmonic major.
- DEFAULT[owner-review] Distance from a pan to a candidate parent = the number
  of PAN PITCH CLASSES (ding included, counted once each) that are not members
  of the parent built on the tonic. Lowest distance wins.
- DEFAULT[owner-review] Ties break by the fewest modal alterations (notes
  differing from Ionian on the same tonic), then by position in the list order
  above.
- DECIDED(D10, D14 as amended) The parent override is encoded as an INDEX into
  that list (0-10) and travels in the seed options; it changes degree labels
  only, never the fields list, so the deck id is unchanged.
- DEFAULT[owner-review] A scale with no usable parent (every candidate at
  maximal distance) uses uppercase numerals.
- DECIDED(D10, D13, plan [design-review 7A]) Parent inference runs on create;
  the override lives only in the Phase 4 Edit sheet, never on the create path.

## 11. The generated deck object

`select.build` produces, and Phase 3 consumes, exactly this shape:

```
{
  id:       "custom:<8 lowercase hex>",
  name:     "<auto or user name, <= 16 chars>",
  options:  {palette: <0-5>, mirror: <bool>, parent: <0-10>},
  colors:   {root, tone, ga, gb},
  degrees:  {"<pitch class 0-11 as string>": "<label>"},
  geom:     {...},
  fields:   {"<id>": [name, octave, midi, zone, angle, label]},
  chords:   [{main, sup, subtitle, fields: [...], roots: [...]}],
  warnings: [{code, reason}]
}
```

- DECIDED(plan P0a scope, index.html DECKS) The deck object has exactly the
  keys `id, name, options, colors, degrees, geom, fields, chords, warnings`,
  and `chords[]` entries have exactly `main, sup, subtitle, fields, roots` -
  the built-in shape, because `render()` reads `subtitle` and `roots[0]`.
- DECIDED(CLAUDE.md "App data model") `fields` maps field id to `[name, octave,
  midi, zone, angle, label]`, exactly as the built-ins.
- DECIDED(index.html DECKS) `colors` carries `root, tone, ga, gb` with `ga ==
  root` and `gb == tone`, as all three built-ins do.
- DECIDED(D12, plan "pan() does not generalise") The geometry solver always
  emits the FULL geom shape - `inner`, `bottom`, `n_in`, `n_out` and the rest
  present as zeroes rather than missing keys - because `pan()` yields `NaN` for
  a missing key; `ext` is derived from the furthest drawn element for GENERATED
  decks only.
- DECIDED(D12) Built-in `geom` literals bypass the solver entirely, so
  "built-ins render identically" stays trivially true.
- DECIDED(plan [eng-review 13A]) Generation runs ONCE, at submit in Phase 3 and
  at decode in Phase 4, into a registry keyed by deck id; never inside `deck()`
  or `render()`.

## 12. Deck identity and the canonical seed string

- DECIDED(D13, plan [design-review 8A]) `core.formatSeed(fields)` prints a seed
  back into the D13 grammar with EXPLICIT octaves everywhere, ding in
  parentheses, top notes ascending, bottom notes after ` | `, single spaces:
  `(D3) A3 C4 D4 E4 F4 G4 A4 C5 | C3 Db3`.
- DEFAULT[owner-review] `core.deckId(fields)` = `"custom:"` + the lowercase
  8-hex FNV-1a 32-bit hash of the UTF-8 bytes of `core.formatSeed(fields)`
  (offset basis `0x811c9dc5`, prime `0x01000193`, multiplication taken modulo
  2^32), giving the same result in Node and in the browser.
- DECIDED(D14 as amended) The id is a pure function of `formatSeed(fields)` -
  notes, octaves, zones and order - and nothing else; `select.build` is never
  consulted for it.
- DECIDED(D14 as amended) Palette, mirror, parent override and name are seed
  OPTIONS outside the id, so renaming, recolouring, flipping the mirror or
  overriding the parent keeps the id and every card's per-card state.
- DECIDED(D14) Any future per-card state keys on `(deck id, fields list)`,
  never on list index and never on `main + sup` (not unique on the built-ins:
  Pygmy `Cm` x3).
- DECIDED(plan P0d exit) `parseSeed(formatSeed(seed))` deep-equals `seed` for
  every entry of `synthetic_scales.json` whose expectation is ok.

## 13. Options: palette, mirror, name

The D6 palette set, index 0-5, from `CLAUDE.md` "Design system":

| index | root | tone | provenance |
|---|---|---|---|
| 0 | `#E0559A` | `#E2761B` | Hijaz |
| 1 | `#6D40A3` | `#C9971E` | Pygmy |
| 2 | `#0B7B75` | `#DD8F00` | Amara |
| 3 | `#E2761B` | `#E0559A` | Hijaz swapped |
| 4 | `#C9971E` | `#6D40A3` | Pygmy swapped |
| 5 | `#DD8F00` | `#0B7B75` | Amara swapped |

- DECIDED(D6) Custom deck colours come only from this fixed set: the three
  built-in pairs then their root/tone swaps, in that order. The user picks an
  index, or one is assigned by hash of the scale name.
- DECIDED(D6) The share URL and the seed carry a palette INDEX, never a colour
  string; colours never come from the URL. Extending the set later appends
  indices and never renumbers.
- DECIDED(D12 as amended by [design-review 3A]) `options.mirror` is one
  boolean: false = left-first (Hijaz / Amara), true = right-first (Pygmy). The
  generated-layout default is right-first (D12) and the built-ins never consult
  it.
- DECIDED(plan [design-review 5A]) The auto deck name is `<DING>
  <PARENT-DISPLAY> <N>` - ding pitch class, the parent's short display name
  from `parents.json`, and the top-shell note count (e.g. `D AEOLIAN 9`, `C
  HIJAZ 9`) - uppercase, at most 16 characters, ellipsised beyond that.
- DECIDED(plan "Sharing is untrusted input", [eng-review 3A]) A user-supplied
  name (Phase 4 Edit sheet) obeys the same 16-character cap and charset
  whitelist, and is validated by `parseSeed` like every other seed value.

## 14. Sharing

- DECIDED(D14, plan "Sharing is untrusted input") The share URL encodes the
  SEED (fields plus options), never the generated deck output, behind a leading
  VERSION BYTE, with space reserved for Phase-5 layout deltas. When the engine
  improves, an old link renders NEW cards: the seed is the contract, not the
  output.
- DECIDED(plan Phase 4) A version byte greater than the running app's is
  rejected with `NEEDS_NEWER_APP` so a PWA-cached old `index.html` fails
  politely; the app stays usable.
- DECIDED(plan [eng-review 3A], Phase 4) `share.decode` calls the SAME
  `core.parseSeed` as the text box and rejects rather than repairs: MIDI 0-127,
  zone in the enum, angle 0-359, palette index 0-5, parent index 0-10, name
  within the length and charset caps. A flipped byte or an over-cap payload is
  rejected.
- DECIDED(plan "Encoding") The encoder is pure JS: `node:vm` has no
  `CompressionStream`, `btoa` or `TextEncoder`, so the engine may not depend on
  them.

## 15. UI element ids

Phase 3 registers these in the sandbox `ELEMENT_IDS`; e2e targets them.

- DECIDED(plan "Open decisions", UI element ids row) The scale-input UI uses
  exactly these element ids: `scale-sheet`, `scale-box`, `scale-parse`,
  `scale-msg`, `scale-mirror-l`, `scale-mirror-r`, `scale-swatches`,
  `scale-generate`, `deck-add`.

## 16. Fixture schemas

`qualities.json` - object keyed by the full quality suffix:

```
"<suffix>": {
  "intervals":   [semitones from the root, ascending, root 0 first],
  "display":     "<subtitle words, e.g. MINOR 7>",
  "main_suffix": "<in-line part of the card name>",
  "sup":         "<superscript part of the card name>",
  "rooted":      true | false,
  "tier":        "triad" | "power" | "sus" | "seventh" | "extended"
}
```

`parents.json` - array of 11 objects in the fixed list order:

```
{"name": "Aeolian", "display": "AEOLIAN", "intervals": [0,2,3,5,7,8,10]}
```

`synthetic_scales.json` - array of:

```
{"name": "...", "string": "...", "tags": [...],
 "expect": {"ok": true, "warnings": ["NO_THIRDS"]} | {"code": "NO_FIFTH"}}
```

- DECIDED(index.html DECKS) `qualities.json` keys are full quality suffixes
  (root removed, `main_suffix` and `sup` concatenated); every quality the 59
  built-in cards use is a key, and the union of the entries' `sup` values is
  exactly the set of `sup` strings the built-ins render.
- DECIDED(index.html DECKS) `display` is the subtitle word or phrase for the
  quality; `rooted` false means the subtitle omits the root (`POWER CHORD`,
  `HALF-DIMINISHED`).
- DEFAULT[owner-review] `tier` is the ranking tier of section 8 and drives both
  the cap trim and the canonical within-root order.
- DECIDED(plan [design-review 5A]) `parents.json` `display` is at most 8
  uppercase characters so the 16-character auto name holds; Phrygian dominant
  displays as `HIJAZ` and Aeolian as `AEOLIAN`.
- DECIDED(plan [eng-review 9A]) Every `synthetic_scales.json` `expect` is
  exactly one of the two shapes - `{ok: true}` optionally with `warnings`, or
  `{code}` - and every lane asserts its own invariants over the entries whose
  expectation is ok.
- DECIDED(plan [eng-review 9A]) Lane B generates its own N=5..19 sweep from the
  12-note and 19-field entries rather than expecting one in the fixture.

## 17. Degenerate cases and who owns them

| case | outcome | owner |
|---|---|---|
| whole-tone subset (no perfect fifth above the ding) | `NO_FIFTH` | `core.parseSeed` (P0d) |
| fewer than 3 pitch classes / no thirds | ok + `NO_THIRDS` warning | `select.build` (Phase 2) |
| symmetric sets (octatonic, augmented hexatonic) | ok, deterministic tie-break | `naming` (lane C) |
| no ding | `NO_DING` | `core.parseSeed` (P0d) |
| ding pitch class absent from the top shell | ok; tonic still the ding | `core.parseSeed` (P0d) |
| beyond 11 rim / 2 inner / 6 bottom | `TOO_MANY_RIM` | `core.parseSeed` (P0d) |
| a newer share link | `NEEDS_NEWER_APP` | `share.decode` (Phase 4) |

- DECIDED(plan "Degenerate cases", eng-review owners) Each degenerate case has
  a row in `tests/fixtures/synthetic_scales.json`, and the whole-tone case
  exists there only as a `NO_FIFTH` rejection - it never reaches
  `select.build`.
- DECIDED(plan "Degenerate cases") Symmetric-scale naming is asserted on the
  octatonic diminished and augmented hexatonic fixture seeds, which do contain
  fifths.
