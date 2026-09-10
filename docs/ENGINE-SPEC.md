# ENGINE-SPEC: the user-configurable scale engine

Normative specification for `src/engine/*.js`. It is the single source every
engine lane asserts against. `docs/SCALE_ENGINE_PLAN.md` is the plan (why, who,
in what order); this file is the contract (what, exactly).

Read `CLAUDE.md` and `tests/CONTRACT.md` first. Nothing here may change deck
data, diagram geometry, or the OWNER DECISIONS D1-D14 of the plan.

## How to read this file

Every normative rule is a top-level markdown bullet beginning with `- ` and
carries exactly one tag, on the bullet's own first line, immediately after the
`- `:

1. `DECIDED(D<n>)`, `DECIDED(CLAUDE.md rule <n>)` or `DECIDED(plan ...)` -
   ratified by the owner. A lane may not deviate. Changing one is a plan
   amendment.
2. `DECIDED(swarm-2026-09-08)` - decided by the integrator under the standing
   afk authority during the P0a review, binding on lanes exactly like an owner
   decision, and listed for the owner as a review-round decision rather than a
   pending default.
3. `DEFAULT[owner-review]` - an integrator default the owner has not ratified.
   Lanes proceed on it. Changing it later is a spec change handled by
   `tests/CONTRACT.md` rule 4, not a reason to stall. Owner review of the
   DEFAULTs is a gate after Phase 1, not before.

The tag must sit on the same physical line as the `- `, because the acceptance
grep (`grep -nE '^- '`) sees only a bullet's first line. Non-rule text (context,
tables, examples) is prose, numbered lists, or tables, never a `- ` bullet.

Companion fixtures owned by this lane, and the SPEC for the values they carry:

| Fixture | Contents |
|---|---|
| `tests/fixtures/qualities.json` | quality suffix -> intervals, display words, name split, tier, rank |
| `tests/fixtures/parents.json` | the 11 D10 parent-scale candidates, in fixed list order |
| `tests/fixtures/synthetic_scales.json` | scale strings with their expected `parseSeed` outcome |

Per plan [eng-review 6A] the quality and parent tables live in these fixtures,
not in an engine export; `naming.js` carries its own literal and a lane-C test
asserts deep equality against the fixture. `tests/CONTRACT.md` rule 2 gains the
carve-out that comparing a module's exported table to the spec fixture is
allowed.

## 1. The result contract

Two entry points take untrusted input and return the result type; the rest are
plain functions over already-validated data.

```
ok      = {ok: true,  value: <payload>, warnings?: [{code, reason}]}
err     = {ok: false, code: <CODE>, reason: <English sentence>}
```

- DECIDED(swarm-2026-09-08) Six entry points return the result type, and what
  they have in common is that each CAN FAIL, not where their argument came
  from: `core.parseSeed`, `select.build` and `share.decode` (which delegates to
  `core.parseSeed`), plus `share.encode` below and `layout.solve` and
  `voicing.choose` under the amendment below that. They never throw on user
  input. Untrusted input reaches `core.parseSeed` and `share.decode`, and also
  `layout.solve`, whose `options.order` arrives from a decoded share payload or
  a restored localStorage record and is validated by `readOrder`
  (`src/engine/layout.js:189-205`, section 14); `select.build` by contrast is
  handed an already-parsed seed.
- DECIDED(swarm-2026-09-08) `core.parseSeed(string, options?)` returns, on
  success, `value` = the SEED: `{fields, options}` where `fields` is the map
  `{id: [name, octave, midi, zone, angle, label]}` of section 4 (`angle` is
  `null` from `parseSeed`; `layout.solve` fills it) (ids are the decimal
  strings of section 4) and `options` is `{palette, parent, name, mirror}`
  (palette index 0-5, parent index 0-10 or `null` for "infer", name string,
  mirror boolean), validated per section 14 and defaulting to
  `{palette: 0, parent: null, name: '', mirror: false}` when the second
  argument is omitted. `formatSeed(seed)` reads `seed.fields` only.
- DECIDED(swarm-2026-09-08) `core.formatSeed(seed)` returns a plain string and
  `core.deckId(fields)` returns a plain string; neither validates, because both
  take an already-parsed seed, so neither is wrapped in the result type.
- DECIDED(owner-review 2026-09-08, amending swarm-2026-09-08) `layout.solve`
  and `voicing.choose` (shipped name; this document previously called the
  latter `voicing.pick`) DO return the result type: `layout.solve(fields,
  options)` returns `{ok, value: {geom, fields}}` and `voicing.choose(fields,
  rootPc, intervals, opts?)` returns `{ok, value: {fields, roots}}`. A caller
  propagates a not-ok layout result unchanged and treats a not-ok voicing
  result as "drop this candidate". They never throw on user input. The result
  type is therefore uniform across every engine entry point that can fail.
- DECIDED(swarm-2026-09-08) `naming.name` and `naming.subtitle` are plain
  functions over validated data and return their value directly. They throw
  `RangeError` on a cap breach, which is unreachable from `parseSeed`-valid
  input.
- DECIDED(swarm-2026-09-08) `share.encode(seed)` returns the result type too,
  with the URL-fragment string as its `value`: it takes an already-parsed seed
  and does not re-validate, but it returns `BAD_NOTE` when handed something
  that is not one, and when the encoded payload exceeds the cap.
  `share.decode(fragment)` takes untrusted input and therefore returns the
  result type, delegating to `core.parseSeed`.
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

`<X>` is the offending value as the user typed it; `<fifth of X>` is the note
name a perfect fifth above the ding pitch class, spelled in the ding's own
accidental convention. P0d embeds these strings in `core.js` VERBATIM, so they
are final: a change here is a change to shipped copy.

| code | kind | reason |
|---|---|---|
| `NO_DING` | error | `No ding. Start with the ding note, e.g. (D) or D/.` |
| `NO_FIFTH` | error | `No perfect fifth above the ding <X>. Add a <fifth of X>, or check the ding.` |
| `TOO_MANY_RIM` | error | `Too many notes for one pan: at most 11 rim, 2 inner and 6 bottom.` |
| `BAD_NOTE` | error | `<X> is not a note. Use names like C, F#, Bb, with an optional octave.` |
| `NEEDS_NEWER_APP` | error | `This link needs a newer version of the app. Reload.` |
| `NO_THIRDS` | warning | `No 3rds on this pan: only power chords and sus chords.` |

The whole-tone fixture entry `(C3) D3 E3 F#3 G#3 A#3 C4 D4 E4` therefore
produces, literally: `No perfect fifth above the ding C3. Add a G, or check the
ding.`

- DECIDED(plan [eng-review 7A]) The enum is exactly `NO_DING`, `NO_FIFTH`,
  `TOO_MANY_RIM`, `BAD_NOTE`, `NEEDS_NEWER_APP` (errors) and `NO_THIRDS`
  (warning); a lane that needs a new code amends this table rather than
  inventing one at the call site.
- DECIDED(swarm-2026-09-08) The `NO_FIFTH` reason substitutes twice: `<X>` is
  the ding as `formatSeed` prints it (name plus octave, e.g. `C3`), and
  `<fifth of X>` is the pitch-class name 7 semitones above the ding, without an
  octave, spelled as the letter four steps above the ding's letter carrying
  whatever accidental makes it a perfect fifth (`G` for C, `Ab` for Db, `F#`
  for B, `Cb` for Fb, `E#` for A#).
- DEFAULT[owner-review] The `BAD_NOTE` reason's `<X>` is the offending token
  verbatim, truncated to 12 characters. For every `BAD_NOTE` cause (a token
  that does not lex, a MIDI out of range, a duplicate field, an order
  violation, zero notes after `|`) `<X>` is the note token at which the rule
  tripped, as typed (for zero notes after `|`, `<X>` is `|`).
- DECIDED(plan [eng-review 2, 2A]) Error and warning reason strings live in
  this table and nowhere else; the UI never composes a sentence, and P0d copies
  them into `core.js` character for character.
- DECIDED(plan "Degenerate cases", eng-review owners) `NO_FIFTH` is decided in
  `core.parseSeed`, before any voicing work: there is no top-shell note whose
  pitch class is a perfect fifth (7 semitones) above the ding pitch class.
  Bottom-shell notes do not satisfy it.
- DECIDED(plan [eng-review 2, 2A]) `NO_THIRDS` is raised by `select.build` when
  no root has a third (3 or 4 semitones) above it on the top shell, so the deck
  contains only power chords and sus chords - which is what the shipped reason
  string says, sus qualities needing no third.
- DECIDED(swarm-2026-09-08) `NEEDS_NEWER_APP` is a share-layer code raised only
  by `share.decode` on the version byte, never by `core.parseSeed`; it
  therefore has no row in `synthetic_scales.json` and is tested by
  `tests/share.test.js` in Phase 4.
- DECIDED(D13) A pasted URL, a vendor link, or any other unparseable token is a
  `BAD_NOTE` rejection like any other token; nothing is fetched, stored or
  shown.

## 3. The scale string grammar (D13)

```
seed_string := ding  rim_note+  ( "/"  inner_note+ )?  ( "|"  bottom_note+ )?
ding        := "(" note ")" | note "/"
note        := [A-G] ("#" | "b")? ([0-9])?
```

- DECIDED(D13) Input is one freeform scale string in maker notation, not a
  per-note form.
- DECIDED(D13) The ding is MANDATORY, written `(C#3)` / `(C#)` (parentheses) or
  `D3/` / `D/` (trailing slash). Zero dings, or more than one, is `NO_DING`.
  Ding tokens are counted over the whole string before any other rule runs, so
  `(D3) (A3) C4` is `NO_DING`, not `BAD_NOTE`; a single ding token that is not
  the first token (`A3 (D3) C4`) is also `NO_DING`.
- DECIDED(D13) After the ding come the top notes in ascending zig-zag order,
  then optionally a `|` followed by the bottom notes.
- DECIDED(D13) Separators are whitespace; `(`, `)`, `/` and `|` are the only
  punctuation. Any other token, or a note name outside `[A-G](#|b)?(\d)?`, is
  `BAD_NOTE`.
- DECIDED(owner 2026-09-09, the D13 inner-shell amendment) The top run may be
  split by a single `/`: the notes before it are `rim`, the notes after it are
  `inner`. The separator is OPTIONAL. A seed without one keeps the POSITIONAL
  zone rule of section 4 byte for byte, so no seed that parsed before the
  amendment changes its fields, its canonical string or its deck id.
- DECIDED(owner 2026-09-09) DISAMBIGUATION from the trailing-slash ding: the
  ding's slash is ATTACHED to a note (`F3/`), and the inner separator STANDS
  ALONE, exactly as `|` does. That one rule settles every spelling. `F3/ A3 B3`
  is a trailing-slash ding; `(F3) A3 / B3` is a rim note, the separator and an
  inner note; `F3/ A3 / B3` is both at once. `F3/A3` and `F3//A3` carry no
  ding token at all and are `NO_DING`; `(F3) A3/B3` is one token that does not
  lex and is `BAD_NOTE`; `(F3) A3/ B3` is a SECOND ding-shaped token and is
  `NO_DING` by the count-first rule.
- DECIDED(owner 2026-09-09) A malformed separator is `BAD_NOTE` naming `/` -
  the section 2 enum is closed and the amendment mints no code. Malformed
  means: more than one separator in the top run, a separator with no note
  before it or none after it, and a separator after the `|` (it is then an
  ordinary bottom token that does not lex). A separator written BEFORE the
  ding leaves the ding token in a position other than the first, so the
  count-first rule of this section reaches it earlier and it is `NO_DING`.
- DECIDED(owner 2026-09-09) Exceeding the section 4 caps with an explicit split
  stays `TOO_MANY_RIM`: more than 11 notes before the separator, or more than 2
  after it, whatever the top run totals.
- DECIDED(D13) Note tokens match `[A-G](#|b)?(\d)?`: a letter, an optional
  single accidental, an optional single-digit octave in scientific pitch
  notation (middle C = C4, so the built-in Amara ding is `D3`).
- DEFAULT[owner-review] Letters are UPPERCASE only: `c4` is `BAD_NOTE`, not a
  silent uppercasing, because repairing input contradicts "rejects, never
  repairs".
- DEFAULT[owner-review] The octave is a SINGLE digit 0-9; `C10` is one
  whitespace-delimited token that fails the note pattern and is `BAD_NOTE`
  with `<X>` = `C10`. Tokenisation is whitespace-splitting only: `(D3)A3` and
  `C5|C3` are each `BAD_NOTE` (the ding token must be exactly `(NAME)` or
  `NAME/`, and `|` must stand alone), while `( D3 )` splits into three tokens
  of which two - the bare `(` and the bare `)` - are ding-shaped, so the
  count-first rule reaches it earlier and it is `NO_DING`, as the precedence
  bullet below also records.
- DEFAULT[owner-review] Enharmonic names are accepted as typed and never
  normalised: `E#` and `F` are different labels for the same pitch class, and
  both are legal note names.
- DECIDED(swarm-2026-09-08) MIDI is letter-anchored scientific pitch notation:
  `midi = 12 * (octave + 1) + letter + accidental` with C=0, D=2, E=4, F=5,
  G=7, A=9, B=11 and `#`=+1, `b`=-1, so `Cb4` = 59 and `B#3` = 60. Octave
  inference picks the next instance by MIDI and then prints the octave that
  formula implies for the typed letter (`Cb4`, never `Cb3`).
- DEFAULT[owner-review] Zero notes after a trailing `|` is `BAD_NOTE`; a seed
  with no bottom shell omits the `|` entirely.
- DECIDED(owner-review 2026-09-08, replacing the earlier DEFAULT) Error
  precedence when a string trips more than one rule: the ding count is checked
  FIRST, so `NO_DING` precedes `BAD_NOTE`; then `BAD_NOTE` (a token that does
  not lex, a MIDI out of range, a duplicate field, an order violation), then
  `TOO_MANY_RIM` (caps), then `NO_FIFTH` (musical). `( D3 )` returns `NO_DING`,
  not `BAD_NOTE`. This aligns the precedence list with the D13 count-first
  bullet in this section and with `core.parseSeed` as shipped.
- DECIDED(swarm-2026-09-08) A ding written without an octave defaults to octave
  3: `(D)` is `D3`, matching all three built-ins. Every top note is then
  inferred strictly above it, so the ding remains the lowest note of the top
  shell.
- DECIDED(D13) Octave inference on the top shell: each next top note is the
  next instance of its pitch class strictly above the previous top note (the
  ding for the first one).
- DECIDED(D13) Inference restarts after `|`: the first bottom note is the
  instance of its pitch class nearest the ding, and each subsequent bottom note
  is the next instance strictly above the previous one. Bottom notes may sit
  below the ding, e.g. Pygmy `C3 Db3 Eb3` under an F3 ding.
- DECIDED(swarm-2026-09-08) When the first bottom note is a tritone from the
  ding, so the instance above and the instance below are equidistant, choose the
  instance BELOW the ding. When the first bottom note has the ding's own pitch
  class, "nearest" excludes the ding's MIDI itself and the tie goes below:
  `(F3) ... | F` is `F2`.
- DECIDED(D13) An explicit octave anywhere overrides inference for that note
  and reseeds the inference for the notes after it.
- DECIDED(swarm-2026-09-08) After inference, the top notes must be strictly
  ascending in MIDI and the bottom notes must be strictly ascending in MIDI. An
  explicit octave that breaks either order is `BAD_NOTE`; the ding counts as
  the element before the first top note, so an explicit top note at or below
  the ding (`(D3) A2 ...`, `(F3) F3 ...`) is `BAD_NOTE`. This is what makes
  `parseSeed(formatSeed(x))` equal `x` for every accepted seed: `formatSeed`
  prints explicit octaves, and only a strictly ascending printing can be
  re-parsed to the same fields.
- DEFAULT[owner-review] Accidental spelling is the user's typed spelling,
  verbatim, on the field label and on the card; the engine never re-spells
  enharmonics.
- DECIDED(plan "Sharing is untrusted input") Every resulting MIDI number must
  be 0-127; outside that range is `BAD_NOTE`.
- DECIDED(plan P0d "no duplicate fields") Two fields may not be identical (same
  name, octave and zone); a duplicate is `BAD_NOTE`. Duplicate PITCH CLASSES
  across octaves are legal and expected, and one pitch class may appear on both
  shells, even at the same MIDI (a top field and a bottom field with the same
  note and octave are distinct fields because their zones differ). When a
  voicing rule (D2, D11) selects "the highest lower instance" or "the nearest
  instance above" and two fields share that MIDI, the TOP-shell field wins.

### The three built-in maker strings

```
(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4
(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5
(D3) A3 C4 D4 E4 F4 G4 A4 C5
```

- DECIDED(swarm-2026-09-08) `core.parseSeed` reproduces all three built-in pans
  from these strings on `name`, `octave`, `midi` and `label` for every field.
  `angle` is lane B's output and is excluded.
- DECIDED(swarm-2026-09-08) `zone` is reproduced for Hijaz and Amara only. The
  Pygmy string AS WRITTEN ABOVE yields ELEVEN rim fields from the grammar (11
  top notes, all within the D7 rim cap), whereas the built-in literal ships 9
  rim + 2 inner (F5 and G5 on the inner ring). This is not a defect: that
  string names no inner shell, and per D12 the built-in `geom` and `zone`
  literals bypass the solver entirely, so the divergence never reaches a
  rendered built-in card. `synthetic_scales.json` records the parse-side
  expectation (`zones.rim` = 11) on the `builtin pygmy` row, tagged
  `zones-diverge-from-builtin`. That row is about the unmarked string and stays
  correct after the amendment.
- DECIDED(owner 2026-09-09, superseding the "not reproducible" reading) The
  divergence is a property of the STRING, not a limit of the engine. With the
  inner shell named,

  ```
  (F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5
  ```

  parses to 9 rim + 2 inner + 6 bottom + the ding and, solved through
  `layout.solve` with `mirror: false`, reproduces the measured F3 Low Pygmy 18
  instrument with ZERO angle differences across all 18 fields, zones included.
  `tests/core.test.js` holds that receipt against the golden fixture. The
  residue is four `geom` fractions (`r_note`, `f_note`, `f_num` and
  `inner_ring`) plus `ext`, which the built-in literal does not carry; none of
  them moves a note.
- DECIDED(owner 2026-09-09) The two strings are two DIFFERENT decks and hash to
  different ids: the id is a pure function of `formatSeed` (section 12), and
  `formatSeed` prints the separator. Adding a separator to a shared seed
  therefore mints a new deck rather than editing one.
- DECIDED(swarm-2026-09-08) The grammar's zone assignment governs GENERATED
  decks only.

## 4. Zone assignment, field ids and caps

The field id and label scheme, read off all three built-ins in `index.html`:

| zone | ids | labels |
|---|---|---|
| ding | `"0"` | `Ding` |
| rim, then inner | `"1"` .. `"N"`, one sequence ascending | `"1"` .. `"N"` |
| bottom | `"101"` .. `"106"` | `U1` .. `U6` |

- DECIDED(CLAUDE.md "App data model") Zones are `ding | rim | inner | bottom`,
  exactly the built-in enum.
- DECIDED(swarm-2026-09-08) Field ids are decimal strings: the ding is `"0"`;
  the top notes are `"1"` through `"N"` in ascending order, rim first then
  inner, in ONE sequence that does not restart at the inner ring; the bottom
  notes are `"101"` through `"106"`. Verified against all three built-ins,
  including Pygmy's inner pair at ids `"10"` and `"11"`.
- DECIDED(swarm-2026-09-08) Labels are the strings the diagram prints: `Ding`
  for the ding, the id itself (`"1"` .. `"N"`) for every top note, and `U1` ..
  `U6` for the bottom notes.
- DECIDED(D13) The ding is its own zone and is assigned from the `( )` / `/`
  token only.
- DECIDED(D7, D12) Top notes are assigned in ascending order. With no `/` in
  the seed the rule is POSITIONAL: the first up to 11 are `rim` (the D7
  stroke-aware ceiling), the next up to 2 are `inner` (D12).
- DECIDED(owner 2026-09-09, the D13 inner-shell amendment) With a `/` in the
  seed the split is EXPLICIT and the positional rule does not run: every note
  before the separator is `rim` and every note after it is `inner`, so a pan
  whose rim is not full can still carry an inner ring. Ids and labels are
  unchanged - one ascending sequence, rim first then inner (`(F3) A3 B3 / C5`
  is rim `"1"`, `"2"` and inner `"3"`).
- DECIDED(owner 2026-09-09) Section 12's canonical string prints the separator
  only when it CARRIES information - when the split is not the one the
  positional rule would produce. A seed whose inner ring starts exactly at the
  positional boundary prints without one (`... G4 / A4 B4` with 13 top notes
  round-trips as `... G4 A4 B4`), which is what keeps every pre-amendment
  canonical string, and therefore every pre-amendment deck id, exactly where it
  was.
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
- DECIDED(swarm-2026-09-08) The per-deck uniqueness rule is exactly this: no two
  chords in a deck share an identical `fields` list. It is NOT "one card per
  pitch set" - the built-ins legitimately ship HIGH / LOW VOICING pairs that
  are two registers of one pitch set (Hijaz `Bm` x2; Pygmy `Ab` x2, `Cm` x3,
  `Eb` x2), 4 groups and 9 cards, and `tests/CONTRACT.md` records that 18/25/16
  `fields` lists are all distinct.
- DECIDED(swarm-2026-09-08) Pitch-set collapsing (sus2 into sus4, `X6` into an
  m7, `Xm6` into an m7b5) is a CANDIDATE-QUALITY rule applied in `select.build`
  before any voicing is chosen, not a per-deck uniqueness rule. Two candidate
  qualities whose pitch sets coincide yield one candidate; that candidate may
  still produce more than one card if multi-voicing data asks for it.
- DECIDED(CLAUDE.md rule 3, plan Premise 4) No sus2 candidates exist: every
  sus2 has the same pitch set as a sus4, so the section 16 quality table
  carries no sus2 entry at all and none is ever generated. `select.js` still
  lists `sus2` among its collapse losers, defensively; under the shipped
  vocabulary that clause never fires.
- DECIDED(swarm-2026-09-08) `X6` has the same pitch set as the m7 built on its
  sixth, a major sixth (9 semitones) above the root - `C6` = {C,E,G,A} =
  `Am7` - and `Xm6` has the same pitch set as the m7b5 built on its sixth -
  `Cm6` = {C,Eb,G,A} = `Am7b5`. The m7 / m7b5 spelling wins, so no 6-chord
  candidate survives.
- DECIDED(plan "Rendering budgets", D3) A voicing never exceeds 6 notes - the
  print floor, measured at Pygmy `Fm11`.
- DECIDED(swarm-2026-09-08) When a chord symbol implies more than 6 notes, drop
  the LOWEST optional extension first: the 9 before the 11, the 11 before the
  13 (plan line 376, "drops its lowest optional extension first"). A chord tone
  (root, 3rd, 5th, 7th, sus 4th, 6-chord 6th) is never dropped.
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
  per candidate.

## 8. Chord selection (D1), ranking, cap, dedup, order

The candidate count on the `twelve note pan` fixture entry
(`(C3) D3 E3 G3 A3 B3 C4 D4 E4 G4 A4 B4`, pitch classes {C,D,E,G,A,B}) is the
worked example that fixes the cap's behaviour: 29 raw candidates, 27 after the
pitch-set collapse of `C6` into `Am7` and `G6` into `Em7`, trimmed to 25 by the
cap. That entry has 12 fields, so the size-scaled cap decided below evaluates to
exactly 25 there and this worked example is unaffected by it. The cap therefore
bites on that entry, and a Phase 2 mutant that widens or removes it changes the
deck.

- DECIDED(D1) Default quality vocabulary: major, minor, diminished, augmented,
  power, sus4, maj7, m7, dominant 7, m7b5, dim7 - the 11 D1 qualities.
- DECIDED(swarm-2026-09-08) Generation candidates are every key of
  `qualities.json` whose `tier` is one of the CANDIDATE TIERS `triad`, `power`,
  `sus`, `seventh` and `extended`. That is the whole table, so the tier field
  alone selects candidates and no second list exists. That table has 28 keys,
  so it widens D1 by seventeen: the two sus 7ths (`7sus4`, `maj7sus4`, both of
  which Hijaz ships), `6` / `m6`, which always collapse away under the rule in
  section 5, and the thirteen `extended`-tier qualities (`add9`, `madd9`,
  `6/9`, `m6/9`, `9`, `m9`, `maj9`, `7b9`, `11`, `m11`, `13`, `7#11`,
  `maj7#11`), which are candidates only where the top-shell test below admits
  them.
- DECIDED(swarm-2026-09-08) A quality is a candidate for a root only when every
  one of its interval pitch classes (the root's included) is present on a
  NON-DING field, because the ding never appears in a voicing (section 5); a
  pitch class that exists only on the ding cannot be a root or a chord tone. An `extended`-tier
  quality is additionally a candidate only when every one of its tones lies on
  the TOP shell - that is D1's "extended chords only where the scale makes them
  obvious", operationalised.
- DECIDED(owner-review 2026-09-08, replacing the earlier DEFAULT of a flat 25)
  Card cap per generated deck SCALES WITH PAN SIZE: `cap = 25` for a pan of at
  most 12 fields, then `+1` for every field beyond the twelfth, i.e.
  `cap = 25 + max(0, fieldCount - 12)` where `fieldCount` counts EVERY field in
  the deck - ding, rim, inner and bottom alike. A 12-field pan therefore still
  caps at 25, which keeps the section 8 worked example above unchanged; the
  18-field Pygmy pan caps at 31; the structural maximum (1 ding + 11 rim +
  2 inner + 6 bottom = 20 fields, section 3) caps at 33. Rationale: the flat 25
  was calibrated on a 12-note pan and evicted real, playable chords from larger
  pans purely because they carried fewer top-shell tones - the built-in Pygmy
  deck's `Gm7b5`, `Bbm7` and `Cm7` rank 27/28/29 under section 8's ranking and
  are all on the instrument. The ranking rule below is unchanged; only the
  trim point moves.
- DEFAULT[owner-review] Ranking, applied to trim to the cap: triads > power >
  sus4 > 7ths > extended; within a tier, more top-shell tones ranks higher;
  remaining ties break by root scale degree ascending from the tonic, then by
  the quality's `rank` field in `qualities.json` (an explicit integer, 1 =
  first; never `Object.keys` order, which JS reorders for integer-like keys such
  as `7` and `13`).
- DECIDED(plan "The engine must also decide these") Root disambiguation for a
  pitch set with several valid roots: prefer sus4 over sus2, m7 over 6, m7b5
  over m6 (already in the data).
- DEFAULT[owner-review] Symmetric-set root tie-break (diminished, whole-tone,
  augmented, where every root is equally valid): prefer the tonic, else the
  lowest scale degree.
- DEFAULT[owner-review] Canonical card order for GENERATED decks: roots by
  scale degree ascending from the tonic; within a root, triad, power, sus4,
  7th, extended; within a tier, by the quality's `rank` field ascending.
  Built-in order is editorial and untouched.
- DECIDED(plan Premise 4, D4) Per-deck override lists default to empty. The
  built-ins' out-of-vocabulary cards are recorded as overrides in
  `tests/fixtures/divergence_v1.json` under an `overrides` key (Phase 2 owns
  that file).
- DECIDED(D4) Equivalence annotations are a per-card override field. An `Xm7`
  is annotatable as `( = (X+3)6 )` and an `Xm7b5` as `( = (X+3)m6 )`, the
  6-chord a minor third above the root - Hijaz `G#m7b5` ships `( = Bm6 )`,
  Pygmy `Bbm7` ships `( = Db6 )`. The built-ins keep exactly those two; custom
  scales derive them mechanically. The five unannotated eligible cards (Pygmy
  `Gm7b5`, `Fm7`, `Cm7`; Amara `Dm7`, `Am7`) are provenance, not bugs, and must
  NOT be annotated.

## 9. Naming and the quality table

- DECIDED(plan [eng-review 6A]) Quality intervals, display words, the
  `main`/`sup` split and the tier come from `tests/fixtures/qualities.json`,
  keyed by the full quality suffix. The fixture is the SPEC; `naming.js`
  carries its own literal and a test asserts deep equality.
- DECIDED(index.html DECKS, verified over all 59 cards) A card's `main` is the
  root spelling plus the entry's `main_suffix`, and its `sup` is the entry's
  `sup` - the superscript the card renders (e.g. suffix `m7b5` ->
  `main: "G#m7"`, `sup: "b5"`).
- DEFAULT[owner-review] Chord name (`main` + `sup`) is at most 16 characters.
- DECIDED(swarm-2026-09-08) Subtitle is at most 26 characters. 26, not 25:
  every `m7b5` equivalence must fit, and the longest one a two-character root
  can produce is `HALF-DIMINISHED ( = Bbm6 )` at 26. It is a hard engine
  constraint with a test; the print pipeline (plan line 254) shrinks the
  subtitle to a 3.6pt floor and then clips silently, and 26 characters sit
  inside that floor, so the print side needs no change.
- DECIDED(index.html DECKS, CLAUDE.md "Card copy is English-only") Generated
  subtitles are `<ROOT> <DISPLAY>` for rooted qualities (`F MINOR 7`) and the
  bare `<DISPLAY>` for the rootless ones (`POWER CHORD`, `SUSPENDED CHORD`,
  `SUSPENDED DOMINANT 7`, `SUSPENDED MAJOR 7`, `DIMINISHED`, `DIMINISHED 7`,
  `AUGMENTED`, `HALF-DIMINISHED`), plus a ` ( = X6 )` equivalence suffix when
  D4 applies. Card copy is English-only. The `rooted` flag in `qualities.json`
  carries this per quality.
- DECIDED(plan Phase 1 lane C exit) The editorial built-in subtitles
  `HIJAZ SIGNATURE CHORD` and `- HIGH VOICING` / `- LOW VOICING` are recorded
  exceptions, not strings the engine generates. All of them are listed as
  `SUBTITLE_EXCEPTIONS` in `tests/naming.test.js`; the voicing variants
  additionally carry card overrides in `tests/fixtures/divergence_v1.json`,
  while `HIJAZ SIGNATURE CHORD` has no entry in that fixture, its card being
  one the engine otherwise reproduces.
- DECIDED(swarm-2026-09-08) Hijaz `Dmaj7` (`D MAJOR 7 (NO 5)`) and `Dmaj7#11`
  (`D MAJOR 7 SHARP 11 (NO 5)`) are incomplete voicings the owner authored by
  hand; the engine's table produces neither the `(NO 5)` qualifier nor the
  fifth-less pitch set. They are recorded in
  `tests/fixtures/divergence_v1.json` as Phase 2 overrides, NOT as matches of
  the `qualities.json` table, and lane C's naming exit excludes them.

## 10. Degrees: numerals (D8) and case (D10)

Verified against all three built-ins under the fixed list order of
`parents.json`. Distance is counted in pan pitch classes outside the parent:

| deck | tonic | pan pitch classes from the tonic | inferred parent | distance |
|---|---|---|---|---|
| Hijaz | C# | 0,1,4,5,7,10 | Phrygian dominant | 0, unique |
| Pygmy | F | 0,2,3,5,7,8,10 | Aeolian | 0, unique |
| Amara | D | 0,2,3,5,7,10 | Aeolian | 0, tied with Dorian, won on list order |

- DECIDED(D8, D10, D13) The tonic is the ding pitch class. The ding is
  mandatory, so there is no fallback.
- DECIDED(D8) Degree NUMERALS are mode-aware: minor-relative (`III`, `VII`) for
  scales with a minor third, major-relative with flats (`bIII`, `bVII`)
  otherwise.
- DECIDED(D10) Degree CASE comes from stacked thirds over a 7-note PARENT
  scale, not from the pan alone: a minor third above the degree root gives
  lowercase, a major third uppercase, a diminished fifth adds the `°` suffix.
- DECIDED(D8, D10) Frozen degree exceptions, two-sided: D Amara ships `bIII` /
  `bVII` (D8) and `IV` where stacked thirds derive `iv` (D10). D Amara is
  declared Aeolian.
- DECIDED(swarm-2026-09-08) Parent inference candidates are the 11 entries of
  `tests/fixtures/parents.json` in this FIXED list order: Ionian, Aeolian,
  Dorian, Phrygian, Lydian, Mixolydian, Locrian, harmonic minor, melodic minor,
  Phrygian dominant, harmonic major. Aeolian precedes Dorian deliberately: they
  tie at distance 0 on D Amara, and D10 declares Amara Aeolian.
- DECIDED(swarm-2026-09-08) Distance from a pan to a candidate parent = the
  number of PAN PITCH CLASSES (ding included, counted once each) that are not
  members of the parent built on the tonic. Lowest distance wins; ties break by
  position in the list order above, earlier wins. There is no second tie-break,
  because list order is total.
- DECIDED(D10, D14 as amended) The parent override is encoded as an INDEX into
  that list (0-10) and travels in the seed options; it changes degree labels
  only, never the fields list, so the deck id is unchanged.
- DECIDED(swarm-2026-09-08) A parent is always inferred - every candidate has a
  finite distance, so there is no "no usable parent" branch. When the
  select-level `NO_THIRDS` warning fires (no root on the pan has a third), every
  degree numeral is UPPERCASE and the D10 stacked-thirds case rule is NOT
  applied, even though a parent was inferred; `NO_THIRDS` overrides D10.
- DECIDED(owner-review 2026-09-08, amending swarm-2026-09-08) Numerals are
  read against the D8 REFERENCE scale (major, or natural minor for a
  minor-relative scale), not against the parent, in two cases that this
  document previously stated differently:
  (a) IN-PARENT degree: the numeral is the parent's degree INDEX and the
  accidental is the offset against the reference degree of the SAME index.
  So a Phrygian second reads `bII` (not `#I`), a Locrian second `bII` and its
  fifth `bV`, a Lydian fourth `#IV`. Over the fixed `parents.json` table that
  offset is always -1, 0 or +1, so a single accidental always suffices.
  (b) OUTSIDE-PARENT pitch class: it is named from the REFERENCE-scale degree
  it is one semitone away from, by the same rule (`bN` below, `#N` above; when
  both apply, `b` for a major-relative scale, `#` otherwise). This differs from
  a reading based on the nearest PARENT degree, and the difference is visible
  only under a manual parent override.
  Both readings reproduce 14 of the 17 built-in degree labels and leave
  D Amara's three frozen exceptions exactly as recorded (`bVII`, `bIII` and
  `IV`, where the engine derives `VII`, `III` and `iv`).
  Its case follows the stacked-thirds rule applied over the PAN pitch classes
  (uppercase when no third is available), unless `NO_THIRDS` applies. In that
  pan-level case rule the `°` suffix is suppressed when a perfect fifth above
  the degree is also on the pan: `°` marks a degree whose ONLY available fifth
  is diminished. [recorded owner-review 2026-09-08; shipped behaviour]
- DECIDED(D10, D13, plan [design-review 7A]) Parent inference runs on create;
  the override lives only in the Phase 4 Edit sheet, never on the create path.

## 11. The generated deck object

`select.build` produces, and Phase 3 consumes, exactly this shape:

```
{
  id:       "custom:<8 lowercase hex>",
  name:     "<auto or user name>",
  options:  {palette: <0-5>, mirror: <bool>, parent: <0-10>},
  colors:   {root, tone, ga, gb},
  degrees:  {"<pitch class 0-11 as string>": "<label>"},
  geom:     {...},
  fields:   {"<id>": [name, octave, midi, zone, angle, label]},
  chords:   [{main, sup, subtitle, fields: [...], roots: [...]}],
  warnings: [{code, reason}]
}
```

- DECIDED(plan P0a scope, index.html DECKS) A GENERATED deck object has exactly
  the keys `id, name, options, colors, degrees, geom, fields, chords, warnings`:
  the built-in shape plus `options` and `warnings`, minus `sub` (which nothing
  in the app reads). `chords[]` entries have exactly `main, sup, subtitle,
  fields, roots`, as the built-ins, because `render()` reads `subtitle` and
  `roots[0]`. `chords[].fields` and `chords[].roots` hold field ids as NUMBERS
  (`[3, 5, 7]`), exactly as the built-ins; only the `fields` map keys are
  strings, because JSON object keys are strings. Equality gates compare
  accordingly.
- DECIDED(CLAUDE.md "App data model") `fields` maps field id to `[name, octave,
  midi, zone, angle, label]`, exactly as the built-ins; the ding's `angle` is
  `null`, as all three built-ins have it.
- DECIDED(index.html DECKS) `colors` carries `root, tone, ga, gb` with
  `ga == root` and `gb == tone`, as all three built-ins do.
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

- DECIDED(D13, plan [design-review 8A]) `core.formatSeed(seed)` prints a seed
  back into the D13 grammar with EXPLICIT octaves everywhere, ding in
  parentheses, top notes ascending in id order (rim then inner), bottom notes
  after ` | ` in id order, single spaces:
  `(D3) A3 C4 D4 E4 F4 G4 A4 C5 | C3 Db3`.
- DECIDED(swarm-2026-09-08) `formatSeed` walks the fields by the id scheme of
  section 4 - `"0"` first, then `"1"` .. `"N"`, then `"101"` .. `"106"` - so the
  canonical string is a pure function of the field map and never of iteration
  order.
- DEFAULT[owner-review] `core.deckId(fields)` = `"custom:"` + the lowercase
  8-hex FNV-1a 32-bit hash of the UTF-8 bytes of `core.formatSeed(seed)`
  (offset basis `0x811c9dc5`, prime `0x01000193`, multiplication taken modulo
  2^32), giving the same result in Node and in the browser.
- DECIDED(D14 as amended) The id is a pure function of `formatSeed(seed)` -
  notes, octaves, zones and order - and nothing else; `select.build` is never
  consulted for it.
- DECIDED(D14 as amended) Palette, mirror, parent override and name are seed
  OPTIONS outside the id, so renaming, recolouring, flipping the mirror or
  overriding the parent keeps the id and every card's per-card state.
- DECIDED(D14) Any future per-card state keys on `(deck id, fields list)`,
  never on list index and never on `main + sup` (not unique on the built-ins:
  Pygmy `Cm` x3).
- DECIDED(plan P0d exit) `parseSeed(formatSeed(seed))` deep-equals `seed` for
  every entry of `synthetic_scales.json` whose expectation is ok, which the
  strict-ascending rule of section 3 guarantees.

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
  index; an index the seed does not carry defaults to 0. (An earlier draft of
  this rule assigned an index by hash of the scale name; nothing was ever
  built that way, and `select.build` reads the seed option or falls back to 0.)
- DECIDED(D6) The share URL and the seed carry a palette INDEX, never a colour
  string; colours never come from the URL. Extending the set later appends
  indices and never renumbers.
- DECIDED(owner-review 2026-09-08, correcting the polarity of D12 as amended
  by [design-review 3A]) `options.mirror` is one boolean: **false = right-first
  (the Pygmy pattern, and the generated-layout default of D12); true =
  left-first (Hijaz / Amara)**. False is the default so that an omitted option
  yields the D12 default layout. The built-ins never consult it, because their
  `geom` and angles are literals that bypass the solver.
- DECIDED(plan [design-review 5A]) The auto deck name is
  `<DING> <PARENT-DISPLAY> <N>` - the ding pitch class, the parent's short
  display name from `parents.json`, and `N`, the number of TOP-SHELL fields
  INCLUDING the ding (D Amara = 1 ding + 8 rim = `D AEOLIAN 9`; the 12-note
  synthetic pan = `C IONIAN 12`). Uppercase, at most 16 characters, ellipsised
  beyond that.
- DECIDED(swarm-2026-09-08) A user-supplied name (Phase 4 Edit sheet) is
  validated as printable ASCII only (0x20-0x7E), trimmed of leading and
  trailing whitespace, and 1 to 40 characters after trimming; anything else is
  rejected, never repaired. The 16-character cap is a DISPLAY cap: the chip
  ellipsises beyond 16, the stored name keeps up to 40.

## 14. Sharing

- DECIDED(D14, plan "Sharing is untrusted input") The share URL encodes the
  SEED (fields plus options), never the generated deck output, behind a leading
  VERSION BYTE, on a third payload line that v1 reserved for layout deltas and
  that v2 (the shipped `share.VERSION`) spends on the `order` permutation.
  When the engine improves, an old link renders NEW cards: the seed is the
  contract, not the output.
- DECIDED(plan Phase 4) A version byte greater than the running app's is
  rejected with `NEEDS_NEWER_APP` so a PWA-cached old `index.html` fails
  politely; the app stays usable.
- DECIDED(swarm-2026-09-08) `share.decode` calls the SAME `core.parseSeed` as
  the text box and rejects rather than repairs. `parseSeed` validates the note
  names, the MIDI range 0-127, the field ordering and the caps of sections 3
  and 4, plus the seed OPTIONS: palette index 0-5, parent index 0-10, and the
  name whitelist of section 13. It does NOT validate `zone`, `angle` or
  `order`: zones are derived by `parseSeed` itself and never carried in the
  seed, and angles are `layout.solve`'s output, so neither is decoder input.
  `order` IS carried in a share payload, but it is validated in TWO other
  places instead - `layout.solve` checks it against the fields it was handed
  and refuses rather than repairs, and `share.decode` re-attaches it only
  after `checkOrder` has held it against the seed `parseSeed` has just
  approved. Two validators rather than one is deliberate and safe here: no
  path reaches a solve with an unvalidated `order` (verified 2026-09-09 over
  every `layout.solve` caller and the localStorage restore path).
- DECIDED(plan Phase 4) A flipped byte or an over-cap payload is rejected.
- DECIDED(plan "Encoding") The encoder is pure JS: `node:vm` has no
  `CompressionStream`, `btoa` or `TextEncoder`, so the engine may not depend on
  them.

## 15. UI element ids

The sandbox `ELEMENT_IDS` in `tests/helpers/sandbox.js` is the registry of
record; e2e targets them. Phase 3 registered the nine below, and later phases
have appended more (`scale-*` ids for the Phase 4 Edit sheet and the Phase 5/6
sheets); the rule is that phases APPEND, never renumber or rename.

- DECIDED(plan "Open decisions", UI element ids row) The Phase 3 scale-input UI
  uses these element ids: `scale-sheet`, `scale-box`, `scale-parse`,
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
  "tier":        "triad" | "power" | "sus" | "seventh" | "extended",
  "rank":        <integer, the section 8 within-tier tie-break>
}
```

`parents.json` - array of 11 objects in the fixed list order:

```
{"name": "Aeolian", "display": "AEOLIAN", "intervals": [0,2,3,5,7,8,10]}
```

`synthetic_scales.json` - array of:

```
{"name": "...", "string": "...", "tags": [...],
 "expect": {"ok": true} | {"code": "NO_FIFTH"},
 "zones": {"ding": 1, "rim": 8, "inner": 0, "bottom": 0},
 "select_warnings": ["NO_THIRDS"]}
```

- DECIDED(index.html DECKS) `qualities.json` keys are full quality suffixes
  (root removed, `main_suffix` and `sup` concatenated); every quality the 59
  built-in cards use is a key.
- DECIDED(swarm-2026-09-08) The set of `sup` strings the built-ins render is a
  SUBSET of the union of the entries' `sup` values, not equal to it: the table
  also carries qualities the built-ins never ship (`aug`, `6`, `m6`, `9`, `11`,
  `13`, `7#11`, `add9`, `6/9`), whose `sup` values may or may not coincide with
  a built-in one.
- DECIDED(index.html DECKS) `display` is the subtitle word or phrase for the
  quality; `rooted` false means the subtitle omits the root (`POWER CHORD`,
  `AUGMENTED`, `HALF-DIMINISHED`, both `DIMINISHED` entries and all three
  suspended entries).
- DECIDED(swarm-2026-09-08) `tier` is both the ranking tier of section 8 and
  the candidate selector: a suffix is a generation candidate exactly when its
  tier is a candidate tier.
- DECIDED(plan [design-review 5A]) `parents.json` `display` is at most 8
  uppercase characters so the 16-character auto name holds; Phrygian dominant
  displays as `HIJAZ` and Aeolian as `AEOLIAN`.
- DECIDED(swarm-2026-09-08) `expect` is the `core.parseSeed` expectation and is
  exactly one of two shapes: `{ok: true}` or `{code}`. It never carries
  warnings, because `parseSeed` produces none.
- DECIDED(swarm-2026-09-08) `select_warnings` is a separate optional key
  listing the warning codes `select.build` must return for that seed; only
  Phase 2 reads it, and only rows whose `expect` is ok may carry it.
- DECIDED(swarm-2026-09-08) `zones` is an optional per-row map of the expected
  field count per zone after `parseSeed`, for P0d and lane B. On the
  `builtin pygmy` row it records the grammar's 11 rim, which deliberately
  differs from the built-in literal's 9 rim + 2 inner (section 3).
- DECIDED(plan [eng-review 9A]) Every lane asserts its own invariants over the
  entries whose `expect` is ok.
- DECIDED(plan [eng-review 9A]) Lane B generates its own N=5..19 sweep from the
  12-note and 19-field entries rather than expecting one in the fixture.

## 17. Degenerate cases and who owns them

| case | outcome | owner |
|---|---|---|
| whole-tone subset (no perfect fifth above the ding) | `NO_FIFTH` | `core.parseSeed` (P0d) |
| fewer than 3 pitch classes / no thirds | ok + `NO_THIRDS` warning | `select.build` (Phase 2) |
| symmetric sets (octatonic, augmented hexatonic) | ok, deterministic tie-break | `naming` (lane C) |
| no ding, or more than one | `NO_DING` | `core.parseSeed` (P0d) |
| ding pitch class absent from the top shell | ok; tonic still the ding | `core.parseSeed` (P0d) |
| beyond 11 rim / 2 inner / 6 bottom | `TOO_MANY_RIM` | `core.parseSeed` (P0d) |
| a newer share link | `NEEDS_NEWER_APP` | `share.decode` (Phase 4) |

- DECIDED(plan "Degenerate cases", eng-review owners) Each parse-layer
  degenerate case has a row in `tests/fixtures/synthetic_scales.json`, and the
  whole-tone case exists there only as a `NO_FIFTH` rejection - it never
  reaches `select.build`.
- DECIDED(plan "Degenerate cases") Symmetric-scale naming is asserted on the
  octatonic diminished and augmented hexatonic fixture seeds, which do contain
  fifths.
