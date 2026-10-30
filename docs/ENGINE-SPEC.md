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
  `layout.solve`, whose `options.seats` and `options.angles` arrive from a decoded share payload or
  a restored localStorage record and are validated by `readSeats` and `readAngles` (section 14);
  `select.build` by contrast is handed an already-parsed seed.
- DECIDED(swarm-2026-09-08) `core.parseSeed(string, options?)` returns, on
  success, `value` = the SEED: `{fields, options}` where `fields` is the map
  `{id: [name, octave, midi, zone, angle, label]}` of section 4 (`angle` is
  `null` from `parseSeed`; `layout.solve` fills it) (ids are the decimal
  strings of section 4) and `options` is `{palette, parent, name, mirror}`
  (palette index 0-9, parent index 0-10 or `null` for "infer", name string,
  mirror boolean) plus the optional layout options `mirrorBottom` (boolean),
  `anchor` (`"one"` or `"between"`), `seats` and `angles` (section 13), validated per
  section 14 and defaulting to
  `{palette: 0, parent: null, name: '', mirror: false}` when the second
  argument is omitted. `core.parseLegacySeed(string, options?)` returns the same
  shape from a pre-2026-10 string (section 3.9). `formatSeed(seed)` reads `seed.fields` only.
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
accidental convention. `<A>` and `<B>` are notes as the PARSER PLACED them (see
the substitution bullet below). P0d embeds these strings in `core.js` VERBATIM,
so they are final: a change here is a change to shipped copy.

| code | kind | reason |
|---|---|---|
| `NO_DING` | error | `No ding. Put the ding in round brackets, e.g. (D) A C D E.` |
| `NO_FIFTH` | error | `No perfect fifth above the ding <X>. Add a <fifth of X>, or check the ding.` |
| `BAD_NOTE` | error | `<X> is not a note. Use names like C, F#, Bb, with an optional octave, e.g. (D) A Bb C.` |
| `NOTE_OUT_OF_RANGE` | error | `<A> is off the keyboard: a note must be between C-1 and G9.` |
| `NOTE_OUT_OF_ORDER` | error | `<A> is not above <B>, and the line runs low to high. Give <A> a higher octave or move it earlier, e.g. (D3) A3 C4 D4.` |
| `NOTE_REPEATED` | error | `<B> and <A> are the same note, and a note may appear only once per shell. A bottom copy takes square brackets and its octave, e.g. (D3) A3 [C4] C4.` |
| `NEEDS_NEWER_APP` | error | `This link needs a newer version of the app. Reload.` |
| `NO_THIRDS` | warning | `No 3rds on this pan: only power chords and sus chords.` |
| `SMALL_LABELS` | warning | `Crowded pan: the smallest labels print at <N> pt, under the 3.6 pt this app treats as readable. Nothing is left out.` |

The whole-tone fixture entry `(C3) D3 E3 F#3 G#3 A#3 C4 D4 E4` therefore
produces, literally: `No perfect fifth above the ding C3. Add a G, or check the
ding.`

ALTERNATE SENTENCES. One code may tabulate more than one sentence when the same
fault reads as nonsense in one of its cases. Each alternate names the condition
that selects it and is tabulated here in full, exactly as the enum sentences
are. This adds SENTENCES, never codes: the enum above stays closed, and the
`code` a caller receives is unchanged by the choice of sentence.

| code | when | reason |
|---|---|---|
| `NO_DING` | `which` - no ding mark and no bar form | `Which note is the ding? Put it in round brackets, e.g. (D) A C D E, or put a | straight after it: D | A C D E.` |
| `NO_DING` | `two` - more than one ding | `Two dings. Only the ding takes round brackets; a bottom note takes square ones, e.g. [C] (D) A C.` |
| `NO_DING` | `below` - a non-bottom note before the ding | `<X> comes before the ding, so it must be a bottom note. Write it in square brackets, e.g. [C] (D) A C.` |
| `BAD_NOTE` | `slash` - a lone `/` | `A lone / is the old way to mark inner notes. Use | now, e.g. (D) A C D | E F.` |
| `BAD_NOTE` | `bracket` - a malformed square-bracket token | `<X> is not a bottom note. Give each bottom note its own square brackets, no spaces inside, e.g. [C] [D] (E) B.` |
| `BAD_NOTE` | `bar` - too many bars | `Too many | marks. One | starts the inner notes, e.g. (D) A C D | E F. A bottom note takes square brackets instead: [C].` |
| `BAD_NOTE` | `barEmpty` - a bar with no top notes before it or no inner notes after it | `A | needs top notes before it and inner notes after it, e.g. (D) A C D | E F.` |
| `BAD_NOTE` | `barFirst` - a bar before the ding | `The | comes after the ding and the top notes, e.g. (D) A C D | E F.` |
| `NOTE_OUT_OF_ORDER` | `ding` - the element before the offending note is the ding | `<A> is at or below the ding <B>. Top notes are above the ding; a lower note is a bottom note and goes before it in square brackets, e.g. [C3] (D3) A3.` |

`src/engine/core.js` `REASONS` is the shipped copy of every sentence in this
section; `tests/core.test.js` holds the two together.

The current grammar emits only the `ding` alternate of `NOTE_OUT_OF_ORDER`: a
top note, rim or inner, at or below the ding (rim: grammar rows 26 and 27,
  through tests/scale.test.js "every refused row carries its code and its
  sentence"; inner: "IB: an inner note at or below the ding gets the ding
  sentence"). The default `reason` in the code table
above is the legacy reader's sentence only (`outOfOrder`, called by
`core.parseLegacySeed`), kept because that reader is frozen ("the legacy reader
keeps the default NOTE_OUT_OF_ORDER sentence"). The `below` alternate of
`NOTE_OUT_OF_ORDER` is gone, with the one place that emitted it, and the
`afterBar` alternate went when an inner note could sit below the rim (092f0d7);
`REASONS` holds neither (no test; true by `src/engine/core.js` `REASONS`).

- DECIDED(plan [eng-review 7A], amended swarm-2026-09-10 and 2026-10, the caps
  code retired) The enum is exactly
  `NO_DING`, `NO_FIFTH`, `BAD_NOTE`, `NOTE_OUT_OF_RANGE`,
  `NOTE_OUT_OF_ORDER`, `NOTE_REPEATED`, `NEEDS_NEWER_APP` (errors) and
  `NO_THIRDS` and `SMALL_LABELS` (warnings). The code for "too many notes"
  was retired in 2026-10 with the caps (section 4); no pan is refused for its
  size; a lane that needs a new code amends this table rather
  than inventing one at the call site.
- DECIDED(swarm-2026-09-10) `BAD_NOTE` means one thing only: the offending text
  is not a note (or not the punctuation the grammar wanted there). A token that
  DOES lex as a note and is rejected for WHERE it landed carries its own code -
  `NOTE_OUT_OF_RANGE`, `NOTE_OUT_OF_ORDER` or, when it repeats the note
  immediately before it on the same shell, `NOTE_REPEATED`. The ding is on no
  shell, so a first top note repeating it is `NOTE_OUT_OF_ORDER`. This is a
  message change, not a grammar change: the set of accepted seeds is unchanged
  by the amendment, and `BAD_NOTE` keeps the wording, the `<X>` rule and the
  12-character truncation it always had. Rationale: `(D) A B C D E F G | C D2`
  was rejected as "D2 is not a note", which is false - D2 is a note, it just
  sits below the C3 the parser inferred from the bare `C` before it.
- DECIDED(swarm-2026-09-10, amended swarm-2026-09-10 w39) The three positional
  codes substitute notes as the PARSER PLACED them, never the raw token,
  because the placed octave is the part the user cannot see: `<A>` is the
  offending note as name plus octave (`D2`, `D10`), and `<B>` is the element
  immediately before it, likewise as name plus octave, suffixed
  ` (inferred from <token>)` when the user typed no octave for it. That
  annotation is not decoration: it is the only thing on screen that tells the
  user where a bare `C` landed. `<B>` does NOT itself say "the ding" - the ding
  alternate sentence above says it, so the two never collide into `the ding the
  ding D3`. The 12-character truncation of `<X>` does not apply: these values
  are engine-spelled note names, not user text. So the seed above now reads:
  `D2 is not above C3 (inferred from C), and the line runs low to high. Give D2
  a higher octave or move it earlier, e.g. (D3) A3 C4 D4.` (the 2026-10
  sentence). Since the order-free reader it is the LEGACY reader's sentence only
  ("a bottom note below the octave inferred for the note before it says so",
  which reads the seed through `parseLegacySeed`); `parseSeed` answers the same
  seed with the `ding` alternate (an explicit inner note under the ding: "IB: an
  inner note at or below the ding gets the ding sentence"; the seed itself: no
  test; true by `src/engine/core.js` `scaleInfer`)
- DECIDED(swarm-2026-09-10 w39) BOTH positions are named whenever the fault is
  a relation between two notes, and either may carry the inference annotation.
  `NOTE_REPEATED` substitutes `<B>` for the earlier of the two and `<A>` for
  the offender, in that order, because `(D3) A3 C C4 E4` puts no literal `C4`
  twice on the user's screen: the sentence has to say that the bare `C` is the
  C4 that is already there. Rationale: the w37 lane applied the placed-octave
  rule to `NOTE_OUT_OF_ORDER` and not to `NOTE_REPEATED`, which left exactly
  the invisibility the rule exists to remove.
- DECIDED(swarm-2026-09-10 w39) A top note at or below the DING takes the
  `ding` alternate sentence rather than the enum sentence. The code stays
  `NOTE_OUT_OF_ORDER` - ordering is what failed, and `NOTE_REPEATED`'s "on this
  shell" would be false because the ding is on no shell - but the enum sentence
  is wrong twice over here: `(F3) F3 C4` would read "F3 is not above the ding
  F3", a riddle, and its advice, "or the note before it a lower one", tells the
  user to retune their instrument. The alternate says "at or below" so the
  equal case reads plainly, and offers only the fix the user can actually make.
  It covers every ding case, not just the equal one, because the advice half is
  wrong for `(F3) E3 C4` too.
- DECIDED(swarm-2026-09-10, amended order-free 2026-10) In `parseSeed`,
  `NOTE_OUT_OF_ORDER` and `NOTE_REPEATED` need a note with an explicit octave
  somewhere in the line, but the note named as `<A>` may be one placed by
  inference. An unoctaved note after the ding sits just above the note typed
  before it, so it lands at or below the ding only when that note is itself
  below the ding: a bottom typed after the ding (`(D3) [A2] C E A` is
  `NOTE_OUT_OF_ORDER` `ding` naming C3), or a top note below the ding, which is
  refused first (`(D3) B2 C` names B2). It lands on a pitch already placed only when an earlier-typed note
  is higher than the one just before it (`(D3) C4 A3 C` is `NOTE_REPEATED`
  naming C4) ("an unoctaved note after the ding lands at or below it only after
  a note below the ding"). In the legacy
  reader both codes fire only from an explicit-octave token, where `<A>` echoes
  the token typed, and also for a break in the typed order (`outOfOrder`).
- DECIDED(swarm-2026-09-08) The `NO_FIFTH` reason substitutes twice: `<X>` is
  the ding as `formatSeed` prints it (name plus octave, e.g. `C3`), and
  `<fifth of X>` is the pitch-class name 7 semitones above the ding, without an
  octave, spelled as the letter four steps above the ding's letter carrying
  whatever accidental makes it a perfect fifth (`G` for C, `Ab` for Db, `F#`
  for B, `Cb` for Fb, `E#` for A#).
- DEFAULT[owner-review, narrowed swarm-2026-09-10] The `BAD_NOTE` reason's
  `<X>` is the offending token verbatim, truncated to 12 characters. For every
  remaining `BAD_NOTE` cause (a token that does not lex, a malformed separator,
  zero notes after `|`) `<X>` is the token at which the rule tripped, as typed
  (for zero notes after `|`, `<X>` is `|`). A MIDI out of range, a duplicate
  field and an order violation left `BAD_NOTE` under the amendment above and
  substitute `<A>`/`<B>` instead.
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
- DECIDED(owner 2026-10, the PF lane) `SMALL_LABELS` is the only reply to a
  crowded pan. It fires when the smallest drawn glyph (the bottom octave digit
  excluded) would print under 3.6 pt, and the title card carries its short
  line (`hifi.py` `CARD_WARNINGS` comment; no chord-card badge, decision A16).
- DECIDED(D13) A pasted URL, a vendor link, or any other unparseable token is a
  `BAD_NOTE` rejection like any other token; nothing is fetched, stored or
  shown.

## 3. The scale string grammar (D13, rewritten 2026-10)

The shipped reader is `core.parseSeed`, the shipped printer `core.formatSeed`.
They read a line in ANY order (section 3, order-free rule below) and print ONE
sorted line, low to high, the way the pan is played ("formatSeed prints the
canonical D13 string with explicit octaves").

```
line      := ( bottom | ding | note | "|" )+
ding      := "(" note ")" | note "/"          (or the note straight before a first "|")
bottom    := "[" note "]"
note      := [A-G] ("#" | "b")? ("-1" | [0-9])?
```

- DECIDED(D13, 2026-10) The ding is MANDATORY and written `(D3)` / `(D)`
  (round brackets), `D3/` / `D/` (trailing slash), or as the note straight
  before the first `|` (`D | A C`, the "bar form"). Zero dings is `NO_DING`
  (alternate `which`), more than one is `NO_DING` (alternate `two`). The ding count
  is taken after every token has lexed (see the error precedence below), and
  before bars and note placement are checked.
- DECIDED(D13, 2026-10) Square brackets mark a BOTTOM note at its pitch
  position: `[C] [D] (E) B` puts C and D below the ding E. A bottom note may be
  typed on either side of the ding (`(D) A [C] C`), and a non-bottom note
  before the ding is `NO_DING` (alternate `below`; no test; true by
  `src/engine/core.js` `scaleStructure`). Bottom notes need no octave of their
  own to be placed but print one.
- DECIDED(D13, 2026-10) A `|` after the ding and the top notes starts the INNER
  notes: everything between the ding and the bar is rim, everything after it is
  inner. With the ding marked by brackets or a slash, a second `|` is `BAD_NOTE`
  (alternate `bar`); in bar form (the ding marked by the `|` straight after it)
  two bars are legal, as in the Pygmy maker string, and only a third is `bar`.
  A `|` before a marked ding is `BAD_NOTE` (`barFirst`), and a `|` with nothing
  on one side is `BAD_NOTE` (`barEmpty`). A lone `/` is the
  retired inner mark and is `BAD_NOTE` (alternate `slash`).
- DECIDED(D13, 2026-10) There are NO note-count caps: no limit on rim, inner or
  bottom notes, and no refusal for size. A crowded pan draws smaller and
  carries the `SMALL_LABELS` warning (section 2).
- DECIDED(D13, 2026-10) Separators are whitespace. A `|` is its own token even
  when glued to a note (`F|G`). Any token that is not a ding, a bracketed
  bottom note or a note is `BAD_NOTE`. Letters are UPPERCASE only; `c4` is
  `BAD_NOTE`, not a silent uppercasing (rejects, never repairs).
- DECIDED(D13, 2026-10) The octave is optional, `-1` through `9`, in scientific
  pitch notation (middle C = C4). MIDI is letter-anchored:
  `midi = 12 * (octave + 1) + letter + accidental`, so `Cb4` = 59 and `B#3` = 60.
  A note whose MIDI is outside 0-127 is `NOTE_OUT_OF_RANGE`; one that spells an
  octave the lexer cannot read back (below -1) is `BAD_NOTE`.
- DECIDED(swarm-2026-09-08) A ding with no octave is octave 3 ("an omitted ding
  octave is octave 3 and reseeds the inference"). Octave inference runs in four
  passes with no backtracking (tokenise, lex, structure, infer).
- DECIDED(owner, order-free 2026-10) A line reads in any order. Inference is
  unchanged: an unoctaved note after the ding takes the nearest instance above
  the note typed before it ("IB: an octaveless inner note still climbs from the
  note before it"), an unoctaved bottom before the ding the nearest instance
  below the note after it (no test; true by `src/engine/core.js` `scaleInfer`),
  and an explicit octave reseeds inference for the notes after. A bottom note
  may be typed on either side of the ding: `[E3] (D3) A3` reads as
  `(D3) [E3] A3` (tests/scale.test.js "every row of the grammar table parses to
  its fields", row 28). After
  inference each zone is sorted by MIDI, ids are
  assigned in that order, and the zone checks run on the sorted sets ("every
  permutation of a fully octaved line reads as its ascending spelling and
  keeps its id"; "IB: inner notes typed in either order read as the same inner
  pair, and an inner at or below the ding is NOTE_OUT_OF_ORDER ding"). A top
  note (rim or inner) at or below the ding is `NOTE_OUT_OF_ORDER` with the
  `ding` alternate, the only sentence the current grammar emits ("IB: an inner
  note at or below the ding gets the ding sentence"; grammar rows 26 and 27,
  through tests/scale.test.js "every refused row carries its code and its
  sentence"). The same MIDI twice on
  one shell is `NOTE_REPEATED` naming the later typed note ("IB: a rim pitch
  typed twice is NOTE_REPEATED naming the later one, in any order"; "G2b: a
  repeated bottom note after the ding is NOTE_REPEATED"; "a repeated pitch is
  NOTE_REPEATED naming the later typed note on the inner and bottom shells, told
  apart by spelling"). A bottom at the
  ding's pitch is accepted: `[D3] (D3) A3` and `(D3) [D3] A3` both read
  `[D3] (D3) A3` (no test in `tests/core.test.js`; true by
  `src/engine/core.js` `scaleInfer` and `formatSeed`, and `parseSeed` accepts
  `[C3] [D3] (D3) A3` in "O1: compose's seed and line are the same with and
  without the warning: D3 c d and D3 C3 D3 give one line and one seed, and
  parseSeed accepts [C3] [D3] (D3) A3 as on origin/main",
  `tests/import.test.js`; grammar rows 13 and 34, same test).
  `formatSeed` sorts, so `parseSeed(formatSeed(x))` equals `x` ("IB: formatSeed
  writes a dip as bottoms, ding and rim, then the bar and the inner notes, and
  it round-trips") and every accepted spelling of a field map has one canonical
  string ("every permutation of a fully octaved line reads as its ascending
  spelling and keeps its id"). `parseSeed` also reports the field ids in typed
  order (`value.typed`, not enumerable), because the importer maps source notes
  to fields by position ("parseSeed reports the field ids in typed order, tops
  then bottoms"). Every accepted reading in the frozen origin/main d8d2a2d
  corpus (tests/fixtures/engine_corpus_main_d8d2a2d_ok.json) still reads to the
  same fields and deck id ("the frozen origin/main d8d2a2d accepted readings
  still read to the same fields and deck id"). This replaces the swarm-2026-09-08
  rule that the whole line must be strictly ascending after inference.
- DECIDED(owner, order-free 2026-10) The legacy reader is untouched:
  `parseLegacySeed` and `formatLegacySeed` still require the typed order, and
  keep the default `NOTE_OUT_OF_ORDER` sentence, which is now legacy-only ("the
  legacy reader keeps the default NOTE_OUT_OF_ORDER sentence"; "an explicit
  octave that breaks the ascending order is NOTE_OUT_OF_ORDER").
- DECIDED(owner-review 2026-09-08) Error precedence in `parseSeed`: (1) lexing
  of every token, so an unreadable token, a lone `/` or a malformed bracket is
  `BAD_NOTE` before anything else; (2) the ding count (`NO_DING`, alternates
  `two` and `which`); (3) bars and the run before the ding (`BAD_NOTE` for
  `bar` and `barFirst`, `NO_DING` `below`, `BAD_NOTE` `barEmpty`); (4)
  `NOTE_OUT_OF_RANGE` per note in the order the parser places them, then the
  zone checks on the sorted sets: rim (`NOTE_OUT_OF_ORDER` `ding` or
  `NOTE_REPEATED`), inner (the same, and `NOTE_REPEATED` against a rim pitch),
  then bottom (`NOTE_REPEATED`) (no test; true by `src/engine/core.js`
  `scaleInfer`); (5)
  `NO_FIFTH`. Only `parseLegacySeed` counts dings before lexing. The ding is placed and range-checked before any other note.
- DECIDED(refactor-4 lane D, stated as the code does them) Three corners of
  that precedence, checked against `src/engine/core.js` `parseSeed` and
  `scaleStructure`. (i) `readOptions` runs before any token is
  lexed: a bad `options` object is `BAD_NOTE` even when the string is also
  unreadable. (ii) Bar form with three bars (`| A | B | C`) is `BAD_NOTE`
  `bar`, not `NO_DING` `which`: the bar count is tested before the note
  straight before the first bar is looked for. (iii) `A D | E A` (no marked
  ding, so the `D` before the bar becomes the ding) is `NO_DING` `which`, not
  `below`: the run before the ding is reported as `below` only when the string
  carried an explicit ding mark, and `A` there is not a bottom note.
- DECIDED(swarm-2026-09-08) `NO_FIFTH` is decided in `core.parseSeed` before
  any voicing work: no TOP-shell note is a perfect fifth above the ding.
  Bottom-shell notes do not satisfy it.
- DEFAULT[owner-review] Enharmonic names are accepted as typed and never
  normalised; the typed spelling is the label on the field and the card.
- DECIDED(plan P0d "no duplicate fields") Two fields may not be identical.
  Duplicate PITCH CLASSES across octaves are legal; one pitch class may appear
  on both shells. Where a voicing rule picks "the highest lower instance" or
  "the nearest instance above" and two fields share that MIDI, the TOP-shell
  field wins.
- DECIDED(2026-10) `core.formatSeed(seed)` prints the one canonical string:
  every note by pitch, the ding in round brackets, bottom notes in square
  brackets, the `|` before the first inner note, explicit octaves everywhere,
  single spaces: `[C3] [Db3] (F3) G3 Ab3 | F5 G5`. A bottom note ahead of the
  ding or of a top note of the same pitch sorts first.

### 3.9 The legacy grammar (read only)

- DECIDED(2026-10) Strings written before 2026-10 used `/` for the inner notes
  (`(F3) A3 B3 / C5`), `|` for a bottom list (`... | C3 Db3`), and an 11-rim /
  2-inner / 6-bottom positional spill with caps. They are read ONLY by
  `core.parseLegacySeed` and printed by `core.formatLegacySeed`. The reader is
  chosen by the version tag on a stored record or a share link (3 or lower is
  legacy, 4 is the shipped grammar) and NEVER by inspecting the string. The
  legacy reader keeps its caps and its old codes' behaviour so that every
  stored deck keeps its zones and its id.

### The three built-in maker strings

```
(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4
[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]
(D3) A3 C4 D4 E4 F4 G4 A4 C5
```

- DECIDED(swarm-2026-09-08) `core.parseSeed` reproduces all three built-in pans
  from these strings on `name`, `octave`, `midi` and `label` for every field.
  `angle` is lane B's output and is excluded.
- DECIDED(owner 2026-10) The Pygmy string above, with the inner shell named by
  the second `|`, parses to 9 rim + 2 inner + 6 bottom + the ding and, solved
  through `layout.solve` with `anchor: "between"`, reproduces the measured F3
  Low Pygmy 18 instrument with ZERO angle differences, zones included
  (`node tools/gen_deck.js "<string>" --anchor between`; `tests/core.test.js`
  and the layout tests hold the receipt). The earlier unmarked 11-rim reading
  of the old string is gone with the caps.
- DECIDED(owner 2026-10) Two strings that differ only in where the inner bar
  falls are two different decks and hash to different ids: the id hashes
  `identitySeed` (section 12), which prints the rim count whenever it differs
  from the legacy positional rule.
- DECIDED(swarm-2026-09-08) The grammar's zone assignment governs GENERATED
  decks only.

## 4. Zone assignment, field ids and layout rules

The field id and label scheme, read off all three built-ins in `index.html`:

| zone | ids | labels |
|---|---|---|
| ding | `"0"` | `Ding` |
| rim, then inner | `"1"` .. `"N"`, one sequence: rim by MIDI, then inner by MIDI | `"1"` .. `"N"` |
| bottom | `"101"` upward | `U1`, `U2`, ... |

- DECIDED(CLAUDE.md "App data model") Zones are `ding | rim | inner | bottom`,
  exactly the built-in enum.
- DECIDED(swarm-2026-09-08) Field ids are decimal strings: the ding is `"0"`;
  the top notes are `"1"` through `"N"`, the rim sorted by MIDI first and then
  the inner notes sorted by MIDI, in ONE sequence that does not restart at the
  inner ring; an inner note may sit below the rim ("IB: an inner note below the
  top notes parses, keeps its zone and numbers after the rim"); the bottom
  notes are `"101"` upward. Verified against all three built-ins,
  including Pygmy's inner pair at ids `"10"` and `"11"`.
- DECIDED(swarm-2026-09-08) Labels are the strings the diagram prints: `Ding`
  for the ding, the id itself (`"1"` .. `"N"`) for every top note, and `U1`,
  `U2`, ... for the bottom notes.
- DECIDED(D13) The ding is its own zone and is assigned from the `( )` / `/`
  token only.
- DECIDED(2026-10, amended order-free 2026-10) Top notes are assigned in MIDI
  order within their zone, whatever order they were typed in ("IB: a rim pitch
  typed twice is NOTE_REPEATED naming the later one, in any order", which also
  reads `(D3) C4 A3 | E5` as `(D3) A3 C4 | E5`). The notes between the ding and
  the `|` are `rim`, the notes after it `inner`; a string with no `|` has no
  inner notes. Ids and labels are one sequence, rim first then inner
  (`(F3) A3 B3 | C5` is rim `"1"`, `"2"` and inner `"3"`). Bottom ids are
  `"101"` upward, or one past the last top id when a pan has more than 100 top
  notes (`U1`, `U2`, ... in ascending pitch; no test;
  true by `src/engine/core.js` `scaleInfer` and `parseSeed`).
- DECIDED(owner 2026-10, caps retired) There is no cap on any ring, so there is
  no maximum pan. The old 11 / 2 / 6 limits and their error code are gone; only
  the legacy reader (section 3.9) keeps the positional spill, to hold stored ids.
- DECIDED(D14 as amended, plan P0d [review D3]) Zone assignment happens in
  `core.parseSeed`; `layout.solve` never changes a zone, so the deck id never
  depends on layout code.
- DECIDED(owner 2026-10) The ding: with no inner notes it is centred (`r_ding`
  0.2, `ding_dy` 0). With inner notes it is offset toward the player, starting
  at `ding_dy` 0.1425 (`r_ding` 0.19) and rising in 0.0025 steps, up to 0.30,
  until every inner index number clears the ding by 0.01. Bottom notes never
  move it.
- DECIDED(owner 2026-10) The inner notes fan across the top half of the inner
  orbit: k notes over a 180 degree span, 76 degrees apart at most, dealt from
  the two ends inward, so one note sits at 90 and two at 128 and 52.
- DECIDED(owner 2026-10, plan 7.1) One direction on every generated rim, odd or
  even: odd-numbered notes on the right, even-numbered on the left. The option
  `anchor` chooses where the line starts: `one` (default) puts note 1 at bottom
  centre; `between` puts the bottom centre between notes 1 and 2 with note 1 on
  the right (the Pygmy pattern). The retired odd-rim anchor and the "left-first"
  and "right-first" names, which described the anchor and not a direction, are
  gone. `mirror` reflects the rim and inner rings about the vertical axis and is
  the only thing that puts odd notes on the left; `mirrorBottom` reflects the
  bottom ring and, when absent, follows `mirror`.
- DECIDED(owner 2026-10, Rule N) A seat's index number belongs to the position,
  not to the note: moving a note (`options.seats`) changes the name drawn there
  and nothing else, on the plate and on the generated cards alike. The same
  holds for `options.angles`: a bottom note placed at a chosen angle keeps its
  seat's number. Under `options.angles` the bottom labels follow the
  cyclic-order rule: sort the home seats and the placed angles, pick the
  rotation of least total angular gap; on a tie, the one that turns the notes
  furthest anticlockwise in total, then the lowest; give each home label to its
  matched angle ("SO: the cyclic match wraps through 0 degrees: Eb3 at 355 keeps U3, and C3 at 20 with Eb3 at 0 reads C3 U3 and Eb3 U1"; "SO: on a cost tie the bottom labels take the rotation that turns the notes furthest anticlockwise: Pygmy at 75 285 0 180 60 120 reads C3 U5 Db3 U2 Eb3 U1 Bb3 U4 Db4 U3 Ab5 U6, and mirrored at 75 285 180 0 120 60 reads C3 U6 Db3 U1 Eb3 U3 Bb3 U2 Db4 U5 Ab5 U4"; "SO: whole-ring turns of +30, +25 and -25 on Pygmy keep the home labels, and -30 puts the same seat numbers at the same angles, with MIRROR BOTTOM off and on").

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

- DECIDED(D2, owner 2026-09-15) The forced test is: ANY non-root tone of the
  chord - chord tones AND extensions alike - has no instance above the root
  AND its highest lower instance is on the TOP shell. A tone whose highest
  lower instance is on the BOTTOM shell takes that instance and forces
  nothing (on the built-in pans that is Pygmy Bb and Db, which exist only
  there; a pan with a top-shell instance below a bottom-shell one is covered
  by the same test, not by a "bottom-only" reading). That is the operative test, exactly as
  `tests/test_deck_data.py::test_forced_tones_cluster_below_root` implements
  it. Amara and Hijaz have no bottom shell, so the clause is vacuous there and
  the Amara 9 deck's three forced cards (G5, Gsus4, Fmaj7) are
  preserved by construction, not by exception.
- DECIDED(D2, CLAUDE.md rule 3) When the chord is forced, every CHORD TONE
  (3rd, 5th, 7th; the 4th of a sus chord; the 6th of a 6-chord) moves to its
  HIGHEST instance below the root; a chord tone with no lower instance stays
  put.
- DECIDED(D2) On a forced chord, EXTENSIONS implied by the chord symbol (add9,
  9, b9; an 11 chord's 9th and 11th; a 13 chord's 9th, 11th and 13th; #11) keep
  their nearest instance ABOVE the root unless they are themselves forced.
- DECIDED(D2, owner 2026-09-15) On a FORCED chord, bottom-shell fields are
  ordinary instances: a chord tone clusters to the bottom shell when that is
  its highest lower instance (Pygmy `Gm7b5` from G5 -> Bb3/U4, Db4/U5). On an
  UNFORCED chord a bottom-shell-only tone simply takes its bottom field while
  every other tone reads nearest-above (Pygmy `Cm7` -> C4 Eb4 G4 Bb3/U4).
- DECIDED(D11) When the chord is NOT forced, every non-root tone sits above the
  root and takes its NEAREST instance above the root, except a tone with no
  instance above, whose highest lower instance is then on the bottom shell and
  is the one it takes.
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

## 8. Chord selection (D1), ranking, dedup, order

The candidate count on the `twelve note pan` fixture entry
(`(C3) D3 E3 G3 A3 B3 C4 D4 E4 G4 A4 B4`, pitch classes {C,D,E,G,A,B}) is the
worked example: 29 raw candidates, 27 after the pitch-set collapse of `C6` into
`Am7` and `G6` into `Em7`. Nothing trims them: the deck holds 35 cards (27
names, root-instance alternates included).

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
- DECIDED(owner 2026-10-06: "let's remove that cap", "Everywhere") A deck
  holds every card the ranking produces. There is no size cap. This supersedes
  the earlier size-scaled cap (`25 + max(0, fieldCount - 12)`). Ranking still
  orders the deck: by root degree, then tier, then quality rank, with
  alternates beside their primary. `ALTERNATE_CAP` still limits voicings per
  name.
- DEFAULT[owner-review] Ranking: triads > power >
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

## 10. Degrees: numerals (step of the parent, 2026-10-05) and case (D10)

Verified against all three built-ins under the fixed list order of
`parents.json`. Distance is counted in pan pitch classes outside the parent:

| deck | tonic | pan pitch classes from the tonic | inferred parent | distance |
|---|---|---|---|---|
| Hijaz | C# | 0,1,4,5,7,10 | Phrygian dominant | 0, unique |
| Pygmy | F | 0,2,3,5,7,8,10 | Aeolian | 0, unique |
| Amara | D | 0,2,3,5,7,10 | Aeolian | 0, tied with Dorian, won on list order |

- DECIDED(D8, D10, D13) The tonic is the ding pitch class. The ding is
  mandatory, so there is no fallback.
- DECIDED(owner 2026-10-05, superseding D8) Degree NUMERALS count the steps of
  the PARENT scale, 1 to 7: a root that is step N of the parent reads as roman
  N and never carries an accidental. The owner's words: "Drop the flats",
  "Yes, no flats anywhere", "No accidentals at all". The numeral says which
  step, the case and `°` say which quality (D10); nothing else is in a label.
  Before this decision numerals were read against the major or natural minor
  scale and carried its accidentals (old D8).
- DECIDED(D10) Degree CASE comes from stacked thirds over a 7-note PARENT
  scale, not from the pan alone: a minor third above the degree root gives
  lowercase, a major third uppercase, a diminished fifth adds the `°` suffix.
- DECIDED(owner 2026-10-05) There are no frozen degree exceptions: every
  built-in label is the engine's output for that deck's seed, and
  `tests/naming.test.js` asserts all 18. D Amara is declared Aeolian (D10).
  The built-in labels, keyed by note name:

  | deck | labels |
  |---|---|
  | Hijaz | C# `I`, D `II`, F `iii°`, F# `iv`, G# `v°`, B `vii` |
  | Pygmy | F `i`, G `ii°`, Ab `III`, Bb `iv`, C `v`, Db `VI`, Eb `VII` |
  | Amara | D `i`, F `III`, G `iv`, A `v`, C `VII` |

  History: until 2026-10-05 Hijaz shipped `bII` and `bvii` (old D8), and Amara
  shipped `bIII`, `bVII` and `IV` as recorded exceptions to the engine's output.
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
  only, never the fields list, so the deck id is unchanged. Since 2026-10-14 the sheet writes no index (every deck saved from the sheet, or opened from a link or record with no parent, stores no index, and the engine infers one at build); the encoding stays, and an explicit index from an older record or a share link is honoured and re-stored when that link is opened (`tests/share.test.js` "parent survives the round trip on its own, null included"; app test "RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included").
- DECIDED(swarm-2026-09-08) A parent is always inferred - every candidate has a
  finite distance, so there is no "no usable parent" branch. When the
  select-level `NO_THIRDS` warning fires (no root on the pan has a third), every
  degree numeral is UPPERCASE and the D10 stacked-thirds case rule is NOT
  applied, even though a parent was inferred; `NO_THIRDS` overrides D10.
- DECIDED(owner 2026-10-05, superseding owner-review 2026-09-08) Two cases:
  (a) IN-PARENT degree: the numeral is the parent's degree INDEX and there is
  no accidental. A Phrygian second reads `II`, a Locrian fifth `V`, a Lydian
  fourth `iv°`.
  (b) OUTSIDE-PARENT pitch class (generated decks only; no built-in has one):
  it is named from the PARENT step one semitone away, `#N` from the step
  below or `bN` from the step above. When a step lies on both sides, `#` if
  the pan carries a minor third above the tonic, `b` otherwise. Every parent
  in `parents.json` has at most three semitones between adjacent steps, so
  one of the two always exists. An outside pitch class therefore always
  carries an accidental and an in-parent one never does, and no two pitch
  classes of one pan share a label (asserted over 2048 pans x 11 parents in
  `tests/naming.test.js`). DEFAULT[owner-review]: the owner has not decided
  this case; the whole rule is `outsideNumeral` in `src/engine/naming.js`.
  An outside pitch class's case follows the stacked-thirds rule applied over
  the PAN pitch classes (uppercase when no third is available), unless
  `NO_THIRDS` applies. In that
  pan-level case rule the `°` suffix is suppressed when a perfect fifth above
  the degree is also on the pan: `°` marks a degree whose ONLY available fifth
  is diminished. [recorded owner-review 2026-09-08; shipped behaviour]
- DECIDED(D10, D13, plan [design-review 7A]) Parent inference runs on create;
  the override lives only in the Phase 4 Edit sheet, never on the create path. SUPERSEDED 2026-10-14 (this plan): inference runs on create and on SAVE; there is no override control.

## 11. The generated deck object

`select.build` produces, and Phase 3 consumes, exactly this shape:

```
{
  id:       "custom:<8 lowercase hex>",
  name:     "<auto or user name>",
  options:  {palette: <0-9>, mirror: <bool>, parent: <0-10>,
             mirrorBottom?: <bool>, anchor?: "one"|"between", seats?: {rim, inner, bottom},
             angles?: {bottom: [<multiple of 5 in 0-355 | null> per bottom note]}},
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

- DECIDED(D13, plan [design-review 8A], 2026-10) `core.formatSeed(seed)` prints a
  seed back into the section 3 grammar with EXPLICIT octaves everywhere: the
  whole scale as one line sorted by MIDI, the ding in round brackets, bottom
  notes in square brackets at their pitch position, the `|` before the first
  inner note, single spaces: `[C3] (D3) A3 C4 D4 E4 F4 G4 A4 C5`. At one pitch a
  bottom note comes before the ding and the ding before a top note, so a
  bottom at the ding's pitch prints `[D3] (D3) A3`. A pan with an inner note
  below its highest rim note prints the bottoms, ding and rim sorted, then the
  `|`, then the inner notes sorted ("IB: formatSeed writes a dip as bottoms,
  ding and rim, then the bar and the inner notes, and it round-trips"; "formatSeed
  prints the canonical D13 string with explicit octaves").
- DECIDED(swarm-2026-09-08) `formatSeed` walks the fields by the id scheme of
  section 4 - `"0"` first, then the top ids ascending, then the bottom ids - and
  orders by MIDI, so the canonical string is a pure function of the field map
  and never of iteration order.
- DECIDED(2026-10) The deck id hashes `core.identitySeed(seed)`, NOT the
  canonical string. `identitySeed` is the legacy printing (ding in round
  brackets, top notes ascending, the `|` bar printed whenever the rim count
  differs from the legacy positional rule, bottom notes after ` | `), kept as its
  own function so ids never move when the canonical spelling does. No id moved
  when the grammar changed.
- DEFAULT[owner-review] `core.deckId(fields)` = `"custom:"` + the lowercase
  8-hex FNV-1a 32-bit hash of the UTF-8 bytes of `core.identitySeed(seed)`
  (offset basis `0x811c9dc5`, prime `0x01000193`, multiplication taken modulo
  2^32), giving the same result in Node and in the browser.
- DECIDED(saved-variants contract) The 32-bit id identifies musical inventory,
  not a unique saved instance. Saved instances have separate stable local
  handles. Import equality compares full validated portable meaning, including
  identitySeed spelling and option intent; hash equality alone never discards or
  overwrites a saved instance. Edit/delete target one instance. Preserve genuine
  different-inventory collision defenses and recovery data rather than silently
  treating a hash collision as an exact duplicate.
- DECIDED(D14 as amended) The id is a pure function of `identitySeed(seed)` -
  notes, octaves, zones and order - and nothing else; `select.build` is never
  consulted for it.
- DECIDED(D14 as amended) Palette, mirrors, anchor, seats, parent override and
  name are seed OPTIONS outside the id, so renaming, recolouring, flipping a
  mirror, moving a note or overriding the parent keeps the id and every card's
  per-card state.
- DECIDED(D14) Any future per-card state keys on `(deck id, fields list)`,
  never on list index and never on `main + sup` (not unique on the built-ins:
  Pygmy `Cm` x3).
- DECIDED(plan P0d exit) `parseSeed(formatSeed(seed))` deep-equals `seed` for
  every entry of `synthetic_scales.json` whose expectation is ok, which the
  sorting of section 3 guarantees ("IB: formatSeed writes a dip as bottoms,
  ding and rim, then the bar and the inner notes, and it round-trips"). A legacy string round-trips
  through `parseLegacySeed` / `formatLegacySeed` in the same way.

## 13. Options: palette, mirror, name

The D6 palette set, index 0-9 (indices 6 to 9 appended by lane PD, 2026-10-27; the table is append-only), from `CLAUDE.md` "Design system":

| index | root | tone | provenance |
|---|---|---|---|
| 0 | `#E0559A` | `#E2761B` | Hijaz |
| 1 | `#6D40A3` | `#C9971E` | Pygmy |
| 2 | `#0B7B75` | `#DD8F00` | Amara |
| 3 | `#E2761B` | `#E0559A` | Hijaz swapped |
| 4 | `#C9971E` | `#6D40A3` | Pygmy swapped |
| 5 | `#DD8F00` | `#0B7B75` | Amara swapped |
| 6 | `#2563B0` | `#C0452C` | Kurd |
| 7 | `#3B7A2A` | `#B3263A` | Amara 10 |
| 8 | `#C0452C` | `#2563B0` | Kurd swapped |
| 9 | `#B3263A` | `#3B7A2A` | Amara 10 swapped |

Wire note: a v6 link spells index n as `palette-(n+1)`, read for `palette-2` to `palette-10`; a v5 link keeps its ceiling of `palette-6` (index 5) and refuses `palette-7` and above with the whole link as the BAD_NOTE payload; a packed v1 to v4 link never carried an index above 5 and still refuses one with the numeric value as the payload.

- DECIDED(D6) Custom deck colours come only from this fixed set: the three
  built-in pairs then their root/tone swaps, in that order. The user picks an
  index; an index the seed does not carry defaults to 0. (An earlier draft of
  this rule assigned an index by hash of the scale name; nothing was ever
  built that way, and `select.build` reads the seed option or falls back to 0.)
- DECIDED(D6) The share URL and the seed carry a palette INDEX, never a colour
  string; colours never come from the URL. Extending the set later appends
  indices and never renumbers.
- DECIDED(owner 2026-10, replacing the right-first / left-first polarity bullet)
  The layout options are `mirror`, `mirrorBottom`, `anchor`, `seats` and `angles`.
  `mirror` (boolean, default false) reflects the rim and the inner ring about
  the vertical axis; false puts odd-numbered notes on the right, even on the
  left, on every deck. `mirrorBottom` (boolean) reflects the bottom ring and,
  when absent, follows `mirror`; with no bottom notes it is false.
  `layout.resolveMirrors` is the one place the two are resolved.
- DECIDED(owner 2026-10) `anchor` is `"one"` (default: note 1 at bottom centre)
  or `"between"` (bottom centre between notes 1 and 2, note 1 on the right).
  `layout.resolveAnchor` reads it; anything else is refused, not repaired.
- DECIDED(owner 2026-10, D5) `seats` is `{rim, inner, bottom}`: per ring, a
  permutation giving the seat each of that ring's notes takes (in ascending
  pitch order), validated by `layout.readSeats` against the ring sizes. A ring
  left out, or an identity permutation, is unmoved. `layout.seatsFromOrder`
  converts the legacy flat `order` of share versions 1 and 2; `layout.reseat`
  applies a correction last, to the note-to-seat assignment. Rule N applies:
  seat numbers belong to positions.
- DECIDED(plan 2026-10-23, free note placement) `angles` is `{bottom: [...]}`:
  one entry per bottom note (ascending id), each an integer multiple of 5 in
  [0, 360) or `null` for the solved angle, validated by `layout.readAngles`
  (any other shape is `BAD_NOTE`; an absent or all-null list reads as absent).
  The override is written last, after `mirrorBottom` and `seats`, into slot 4 of
  the bottom fields, then relabels slot 5 of the bottom fields by the cyclic-order rule (Rule N; "SO: the five built-ins solve to byte-identical fields with no angles, all-null angles and their home angles written explicitly"); geometry is computed from the default placement, so
  `geom` is byte-identical with and without it. A floor applies to the
  effective list (`layout.bottomClash`): two bottom notes closer than the
  smallest multiple of 5 strictly above their touching angle (capped by the
  default gap), or a bottom note meeting a rim, inner or ding circle, is
  `BAD_NOTE`. `seats.bottom` beside `angles` is `BAD_NOTE`; rim and inner seats
  are accepted.
- DECIDED(owner-review 2026-09-08) The built-ins never consult the layout
  options, because their `geom` and angles are literals that bypass the solver.
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
  VERSION BYTE. The payload is three lines: line 0 the canonical scale string
  (`formatSeed` from version 4, `formatLegacySeed` before); line 1 the options,
  tab-separated `palette, parent, mirror, anchor, name` from version 3 (`mirror`
  is `0` or `1` for both rings, `t` for top only, `b` for bottom only; `anchor`
  is `0` for `one` or `1` for `between`; version 1 and 2 had four fields without
  `anchor`); line 2 the layout delta: empty in version 1, the flat `order`
  permutation in version 2, and from version 3 the per-ring `seats`
  `rim;inner;bottom`, each a comma list, an unmoved ring left empty. The
  shipped `share.VERSION` is 6 (`RECORD_VERSION` stays 4); version 6 adds the
  last option `at-<list>`, the bottom notes' absolute angles on a 5-degree step
  with an empty entry for a solved angle, valid on version 6 only and refused
  beside a bottom seats list; versions 1 to 5 stay readable, and the version
  tag, not the string, selects the legacy or the shipped reader. The payload cap
  is 4096 characters. When the engine improves, an old link renders NEW cards:
  the seed is the contract, not the output.
- DECIDED(plan Phase 4) A version byte greater than the running app's is
  rejected with `NEEDS_NEWER_APP` so a PWA-cached old `index.html` fails
  politely; the app stays usable.
- DECIDED(swarm-2026-09-08) `share.decode` calls the SAME `core.parseSeed` as
  the text box and rejects rather than repairs. `parseSeed` validates the note
  names, the MIDI range 0-127, and the line ordering of section 3, plus the seed
  OPTIONS: palette index 0-9 (packed v1 to v4: 0-5), parent index 0-10, and the name whitelist of
  section 13. It does NOT validate `zone`, `angle` or `seats`: zones are derived
  by `parseSeed` itself and never carried in the seed, and angles are
  `layout.solve`'s output, so neither is decoder input. `seats` IS carried in a
  share payload, but it is validated in TWO other places instead -
  `layout.solve` checks it against the fields it was handed and refuses rather
  than repairs, and `share.decode` re-attaches it only after `layout.readSeats`
  has held it against the ring sizes of the seed `parseSeed` has just approved
  (a v2 flat `order` goes through `layout.seatsFromOrder` first). Two validators
  rather than one is deliberate and safe here: no path reaches a solve with an
  unvalidated layout correction.
- DECIDED(plan Phase 4) A flipped byte or an over-cap payload is rejected.
- DECIDED(saved-variants contract) Saved collections use `hpfc.saved-scales.v1`,
  envelope schema1, with instance wrappers outside capability-tagged `{v,s,o}`
  records. Wire6 and current record4 writers do not change for local metadata.
  The envelope stores ordered instances, tagged preferred selection, explicit
  slots/hidden state, collection identity/revisions and immutable raw migration
  source strings. The authoritative envelope is a JSON string at key `current`
  in IndexedDB database `hpfc.saved-scales.v1`, version1, object store
  `collections` (out-of-line keys, no autoIncrement). Durable writers retain the
  same exclusive Web Lock and perform fresh existence/value comparison and any
  replacement in one readwrite transaction; `getKey` distinguishes an absent key
  from a present invalid value. Acknowledgment requires transaction completion,
  never request/put success alone. No unlocked durable fallback or live
  localStorage mirror. Completion acknowledges the API transaction, not disk
  flush; later publication/readback failure does not roll it back or authorize
  duplicate allocation. See the reviewed
  [transactional storage amendment](plans/2026-10-25-saved-variants-transactional-storage.md)
  for staging, retries, capability boundaries and recovery proofs.
- DECIDED(saved-variants contract) Legacy `hpfc.scales.v3`, `hpfc.scales` and
  relevant old selection/hidden source remain untouched by the new collection.
  Legacy R7 builds copied `hpfc.scales` into `hpfc.scales.v3` and normalized known
  records through their version readers. New migration preserves exact raw source
  for recovery, converts known legacy records in the new envelope only and keeps
  opaque/newer values unmodified. A valid committed IndexedDB envelope is
  authoritative. An experimental localStorage `hpfc.saved-scales.v1` envelope is
  imported only when the authoritative key is proven absent, with its exact raw
  source retained in optional immutable `migration.backendSource`; any existing
  own property of that name on initial import is protected as a collision rather
  than overwritten. Existing authoritative provenance accepts only that exact
  source key and a string raw value. The experimental source stays untouched;
  later old-client writes are a separate recovery branch, never automatic
  re-migration. Quota/denied/corrupt/newer states must not be treated as an empty
  durable store. Explicit session-only fallback is local to this tab and cannot
  silently promote itself into persistent data when capabilities recover.
- DECIDED(plan "Encoding") The encoder is pure JS: `node:vm` has no
  `CompressionStream`, so the engine may not depend on it. The test realm
  (`tools/engine_loader.js`) does inject `btoa`, `atob`, `TextEncoder` and
  `TextDecoder`, so the test realm is not a guard for those.

## 15. UI element ids

The sandbox `ELEMENT_IDS` in `tools/sandbox.js` (re-exported by `tests/helpers/sandbox.js`) is the registry of
record; e2e targets them. Phase 3 registered the nine below, and later phases
have appended more (`scale-*` ids for the Phase 4 Edit sheet and the Phase 5/6
sheets); the rule is that phases APPEND, never renumber or rename.

- DECIDED(plan "Open decisions", UI element ids row) The Phase 3 scale-input UI
  uses these element ids: `scale-sheet`, `scale-box`, `scale-parse`,
  `scale-msg`, `scale-mirror-l`, `scale-mirror-r`, `scale-swatches`,
  `scale-generate`, `deck-add`.
- DECIDED(owner 2026-10, W1 to DR3) `scale-mirror-l` and `scale-mirror-r` are
  gone. The layout drawer's ids are `scale-layout-toggle`, `scale-drawer`,
  `scale-anchor-one`, `scale-anchor-between`,
  `scale-mirror` (MIRROR TOP), `scale-mirror-bottom`, `scale-fine-toggle`,
  `scale-fine`, `scale-note-prev`, `scale-note-next`, `scale-seat-prev`,
  `scale-seat-next`, `scale-layout-reset` (RESET LAYOUT), `scale-drawer-status`
  and `scale-drawer-hint`; the registry in `tools/sandbox.js` is the record.

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
  `builtin pygmy` row (`"reader": "legacy"`, so it is read by
  `parseLegacySeed`, not `parseSeed`) it records the legacy reader's 11 rim,
  which deliberately differs from the built-in literal's 9 rim + 2 inner
  (section 3).
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
| a very large pan | ok + `SMALL_LABELS` warning; never refused | `select.build`, via `smallLabels(geom)` in `src/engine/select.js` |
| a note placed outside MIDI 0-127 | `NOTE_OUT_OF_RANGE` | `core.parseSeed` (P0d) |
| a top note, rim or inner, at or below the ding | `NOTE_OUT_OF_ORDER` (`ding`) | `core.parseSeed` (P0d) |
| the same MIDI twice on one shell, in any typed order | `NOTE_REPEATED` | `core.parseSeed` (P0d) |
| a newer share link | `NEEDS_NEWER_APP` | `share.decode` (Phase 4) |

- DECIDED(plan "Degenerate cases", eng-review owners) Each parse-layer
  degenerate case has a row in `tests/fixtures/synthetic_scales.json`, and the
  whole-tone case exists there only as a `NO_FIFTH` rejection - it never
  reaches `select.build`.
- DECIDED(plan "Degenerate cases") Symmetric-scale naming is asserted on the
  octatonic diminished and augmented hexatonic fixture seeds, which do contain
  fifths.

## 18. Paired-area profile (planned: engine lane E, renderers P, app U)

Plan: `docs/plans/2026-10-30-neotone-build.md` (Refs TRI-17). Everything here is
the contract lane E builds to; nothing in it is shipped until lane U flips
`PROFILE_ENABLED`. The word in visible copy is "Paired areas"; no vendor or
model is named. Roles do not change: voicing, tiers, badges, number lines and
highlighting read the SOURCE zone (`rim`, `inner`, `bottom`) exactly as today,
and the ding is unmapped, drawn at centre, and never in a voicing.

### 18.1 The frozen profile

`tests/fixtures/paired_profile_v1.json` is the one profile (`id` `paired`, `rev`
1), written once by hand and pinned by sha256 in
`tests/test_fixture_integrity.py`. Area k sits at `angles[k-1]`; slot `pk` is the
primary on that angle, `sk` the secondary outward of it (orbits and radii are
fractions of R). `slots` lists `p1..p9` then `s1..s9`: capacity is 18 non-ding
notes. Empty slots draw nothing on a card (app and print); only the sheet
preview shows a faint dashed outline with the area number. The print extent is
the furthest of slot orbit + r + `n_out` + number height (number size = slot r x
0.64) and the ding edge, plus `extent_margin`; R = round(74 / extent, 1) in
`HPE.pdfcards`, `tools/hifi.py` and `tools/decks.py` identically. At that R every
glyph of every slot is at least 3.6 pt and a name exceeds its number
(`tests/test_fixture_integrity.py`).

### 18.2 Seed option and occurrence key

`options.profile = {id:"paired", rev:1, map:[18 entries]}`; entry k is the
occurrence placed in `slots[k]`, or `null`. The occurrence key is the zone letter
plus the MIDI number: `r57`, `i77`, `b48`, matching `/^[rib]\d{1,3}$/`. It is
unique because `NOTE_REPEATED` forbids a repeated pitch within the top zones and
within the bottom zone (an exact top/bottom pair is legal, and the letters tell
them apart). The option is valid iff: its own keys are exactly `id,rev,map`;
`id` is `"paired"` and `rev` is `1`; `map` has length 18; every non-null entry
matches the key pattern and names a non-ding field of the seed; the entries are
injective; and every non-ding field appears exactly once. With a profile,
`mirror`, `mirrorBottom`, `anchor`, `seats` and `angles` must be absent. The
sheet keeps the acoustic draft separately and drops it from the committed
record. Validation lives only in `HPE.core.parseSeed`; `profile` joins its
option whitelist (other unknown options still drop). Until
`HPE.core.PROFILE_ENABLED` is true, `parseSeed` refuses `profile` with
`PROFILE_UNKNOWN` and `HPE.share.decode` of a version 7 link returns
`NEEDS_NEWER_APP`.

### 18.3 Refusals

Added to `HPE.core.REASONS` by lane E, verbatim, and to the
`tests/scale.test.js` "every refused row carries its code and its sentence"
table. They are kept out of the section 2 table until E lands, because
`tests/core.test.js` holds that table equal to `REASONS`.

| code | kind | reason |
|---|---|---|
| `PROFILE_UNKNOWN` | error | `This paired-area layout is not one this app knows.` |
| `PROFILE_MAP_INVALID` | error | `The paired-area layout is malformed: it must list 18 areas, each empty or one of your notes.` |
| `PROFILE_NOTE_MISSING` | error | `The paired-area layout leaves out one of your notes. Every note needs an area.` |
| `PROFILE_NOTE_TWICE` | error | `The paired-area layout places the same note in two areas.` |
| `PROFILE_FULL` | error | `Paired areas hold at most 18 notes besides the ding. Remove some notes.` |
| `PROFILE_CONFLICT` | error | `Paired areas set their own placement, so mirror, anchor, seats and angles cannot be combined with them.` |

### 18.4 Proposal and layout

`HPE.layout.proposeProfile(fields)`: top notes (rim then inner, in field-number
order) fill `p1..p9`, then `s1..s9`; bottom notes fill the remaining secondaries
from `s1`, then the remaining primaries. Deterministic, pinned by a fixture.
`HPE.layout.solve` with a valid profile returns the ordinary geom plus
`geom.place = {fieldId: [angle, orbitFrac, rFrac]}` for every non-ding field,
with the ding at centre at `ding.r`. Fields keep their zone, label and angle
semantics; `ext` and the `f_*` keys are unchanged for acoustic decks, and
renderers branch only on `geom.place`.

### 18.5 Wire version 7

`HPE.share.VERSION` stays 6; `PROFILE_VERSION = 7` and `NEWEST = 7`.
`HPE.share.encode` picks 7 if and only if the seed has a profile, otherwise it
writes the exact current version 6 bytes. Version 7 is the version 6 segment
grammar with profile options forbidden from mixing with `mirror`, `between`,
`seats-` and `at-`, plus one option segment `pair-` followed by 18 tokens joined
by `.`, `-` standing for an empty area (for example `pair-r57.r62.r64.-.`),
placed after `parent-` and `palette-` and inside the checksum meaning.
`decodeSeed` accepts 6 as today and 7; a version 7 link without exactly one
`pair-` segment, or carrying `mirror*`, `between`, `seats-` or `at-`, is
`BAD_NOTE`; a version 6 link carrying `pair-` is `BAD_NOTE`. Option gates that
key on the version character are written as explicit sets, so a version 6
`palette-10` still parses under version 7. A client that only knows version 6
answers a version 7 link with `NEEDS_NEWER_APP`.

### 18.6 Record version 5 and rule I1

`RECORD_VERSION` stays 4. `PROFILE_RECORD_VERSION = 5` is used for a record
whose `o.profile` is set, and `HPE.share.recordVersion(seed)` returns 4 or 5:
the app never chooses it. `savedCandidate` accepts 4 for an acoustic record and
5 for a profile record, and refuses 5 without a profile or 4 with one;
`savedMeaning` appends the canonical profile map (null for acoustic, so the
meaning of every existing acoustic record is unchanged).

Rule I1: a profile record never carries `replaces` and never owns a seeded
slot. SAVE on a seeded scale with the profile active saves a new custom entry,
Edit of a slot owner into a profile saves separately, and `replace-builtin` with
a profile candidate is refused; a version 5 record with `replaces` is read as
opaque. Reason: a shipped client treats a record it cannot read as an opaque row
kept byte-for-byte, but fails its slot-authority check, and so protects the
whole library, when an opaque row owns a slot.

### 18.7 Fixtures that pin the contract

`tests/fixtures/paired_profile_v1.json` (the profile) and
`tests/fixtures/shipped_client_ee5438d0.html.txt` (a verbatim
`git show ee5438d0:index.html`, the shipped client for the mixed-version
isolation suite). Both are sha256-pinned in `tests/test_fixture_integrity.py`; a
change is a new revision, never an in-place edit.
