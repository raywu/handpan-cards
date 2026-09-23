# Seed-deck PDFs: one source of truth?

**Status:** decision plan, not yet executed. Drafted 2026-09-22.
**Question:** should the six committed seed-deck PDFs be produced by the JS
emitter (`src/engine/pdf.js` + `pdfcards.js` + `pdfdeck.js`) instead of by
`tools/decks.py` + `tools/hifi.py`, so one implementation serves both built-in
and custom decks?

**Owner's acceptance bar, verbatim and binding:**

> "The most important is that emitter versions have display the same data, and
> minute differences are acceptable."

---

## 1. Recommendation

**Option 2, staged: move the print overlay into canonical data and teach the JS
emitter to consume it, then retire the Python emitter behind an equivalence
harness.** Do NOT adopt generated geometry (option 1): it shrinks Pygmy's
diagram by 15.7%, which is not a minute difference.

The measurement below is the reason. Once the deck NAME is set aside, the
emitter already reproduces the committed chord data exactly on 96 of 96 cards
for two of the three decks. What does not survive is not the chord engine - it
is the hand-authored print overlay, and an overlay is data, so it can be moved
rather than reimplemented.

---

## 2. Measured evidence (2026-09-22, this repo, at `224af5d`)

Built with `node tools/gen_deck.js "<seed>" | node tools/pdf_build.js --variant
{full,shop} --paper letter`, on the canonical seeds:

| deck | seed |
|---|---|
| Hijaz | `(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4` |
| Pygmy | `(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 \| C3 Db3 Eb3 Bb3 Db4 Ab5` |
| Amara | `(D3) A3 C4 D4 E4 F4 G4 A4 C5` |

Compared against the committed PDFs with PyMuPDF: page box, page count, card
rectangles at 177.6 x 247.2 pt, extracted word tokens per card, and drawn
circle radii.

### 2a. What already matches

| check | Hijaz | Pygmy | Amara |
|---|---|---|---|
| page box (Letter) | 612 x 792, identical | identical | identical |
| chord-card count (PRINTER_ONLY) | 19 = 19 | 52 = 52 | 25 = 25 |
| card rect size | identical | identical | identical |
| **per-card content, deck name removed** | **19 of 19 identical** | **51 of 52 identical, 1 identical as a set with a different extraction order** | **13 of 25 identical** |

Chord names, superscripts, subtitles, note lines, number lines, bottom-note
badges and index numbers all reproduce. The engine is not the problem.

### 2b. What differs, and whether it clears "minute"

| # | difference | scope | minute? |
|---|---|---|---|
| D-1 | **Diagram radius.** Committed `R` 73.0 (Hijaz, Amara) and 60.0 (Pygmy); emitter draws 69.8 and **50.6**. Measured off the PDFs, matching the derivation already recorded at `tools/decks.py:56-58`. | every card | **NO.** -4.4% and **-15.7%**. A sixth off Pygmy's diagram is visible at arm's length. |
| D-2 | **Deck name.** Committed `C# HIJAZ 9 / ORION`, `F3 LOW PYGMY 18`, `D AMARA 9`; emitter auto-names `C# HIJAZ 9`, **`F AEOLIAN 12`**, **`D AEOLIAN 9`**. Appears in the card header AND the vertical credit strip. | all 96 cards | **NO.** The instrument's name is data. Pygmy stops saying Pygmy. |
| D-3 | **Scale-degree labels, Amara only.** Committed `bIII` (5 cards), `bVII` (4), `IV` (3); emitter `III`, `VII`, `iv`. | 12 of 25 Amara cards | **NO.** Wrong degree spelling is wrong data. `data/decks.json` `degrees` is authoritative and the generated path does not read it. |
| D-4 | **Pygmy blank-card padding.** Committed full deck is 7 pages / 63 card slots (52 chords + title + `blank_cards: 7` + fill); emitter is 6 pages / 54. | Pygmy full only | **NO**, but it is a preference, not a defect - `tools/decks.py` calls it "Pygmy's blank-card padding preference". |
| D-5 | **Title-card copy.** Committed carries the hand-written `title`, `credit`, `blurb` and `legend_lines` (Pygmy: "Bb AND Db EXIST ..."); the emitter substitutes generic legend text ("ONE CARD PER CHORD", "OCTAVE NUMBERS INSIDE EACH TONEFIELD NAME") and synthesizes `title` as `name + " - Chord Cards"` at `src/engine/pdfdeck.js`. | title card, full variant only | **NO.** Hand-written copy is content. |
| D-6 | **Token extraction order on one Pygmy card** (card #6): same token multiset, different order. | 1 card | **YES.** Coordinate-level, no content change. |
| D-7 | Colour literals: committed three-decimal values vs re-derived floats (`tools/decks.py:224-229`). Not separately measured here; the docstring states re-deriving moves every printed colour by a fraction. | all cards | **YES** if the literals are carried; a fraction of a colour step. |

**Verdict against the bar:** the chord DATA passes. D-1 through D-5 are not
minute, and every one of them is the print overlay or a data field the
generated path cannot see - not a rendering disagreement.

### 2c. The two code blockers

- `src/engine/pdfdeck.js:161` throws `"generated deck has no geom.ext"`. None
  of the three shipped geoms in `data/decks.json` carries `ext` (verified).
  So `fromGenerated` cannot consume a built-in deck at all today.
- The same function synthesizes the title rather than accepting one, so
  `"C# Hijaz / Orion 9 - Chord Cards"` is unreachable through it.

---

## 3. Options, scored

| option | one source of truth? | clears the bar? | cost |
|---|---|---|---|
| **1. Adopt generated geometry** - built-ins become ordinary generated decks | yes | **no** (D-1 .. D-5) | free in code, expensive in output; also needs an explicit owner instruction under CLAUDE.md's geometry rule |
| **2. Overlay becomes data; JS emitter consumes it** (recommended) | yes, after stage C | yes | a `fromBuiltin` path in `pdfdeck`, an overlay file, an equivalence harness |
| **3. Keep both emitters, widen `test_pdf_parity.py`** | no | n/a | cheapest; pays the duplication forever |
| **4. Delete `tools/decks.py` + `tools/hifi.py`** (reachable only from 1 or 2) | yes | depends on 1 vs 2 | loses `hifi.fit_note`, the 3.6 pt print-floor assertions, `tests/test_render_agreement.py`'s per-field pinning, and `validate.py` check 1b - these must be ported, not dropped |

Option 2 is the only one that both removes the second implementation and keeps
the printed artifact the owner already approved.

---

## 4. Execution plan (TDD, three stages, each independently revertible)

### Stage A - the overlay becomes canonical data (no output change)

Goal: `tools/decks.py`'s per-deck literals stop being Python and become a data
file both emitters can read. Nothing about the PDFs changes.

- **A1. Write the equivalence harness first.**
  New `tests/test_seed_pdf_equivalence.py`. Given a deck id, it compares two
  PDFs on: page box, page count, card-rect count and size, per-card extracted
  token list, and the largest drawn circle radius per card. Tolerance: token
  lists must be equal as ordered lists after a documented normalisation for
  D-6-class extraction order; radii must match to 0.1 pt.
  Verify: `python3 -m unittest tests.test_seed_pdf_equivalence -v` passes
  comparing each committed PDF against a fresh `python3 tools/decks.py` build.
  It must PASS at this point - that is what makes it a baseline.
- **A2.** Create `data/print_overlay.json`: per deck id, the exact literals now
  in `tools/decks.py` - `R`, `cy`, `y_note`, `y_num`, `title`, `credit`,
  `blurb`, `legend_lines`, `legend_demo`, `blank_cards`, and the committed
  three-decimal colour values. Copied verbatim, not re-derived.
- **A3.** `tools/decks.py` reads `data/print_overlay.json` instead of carrying
  the literals inline. The clash guard against `data/decks.json` stays.
- **A4.** Extend `tools/validate.py` check 1b to assert the overlay file and
  the built PDFs agree.
- **Acceptance:** `python3 tools/decks.py && python3 -m unittest tests.test_seed_pdf_equivalence`
  green, and `git diff --stat` on the six PDFs shows only reportlab's creation-date churn.
- **Rollback:** revert the commit; the literals come back.

### Stage B - the JS emitter can build a built-in deck

- **B1.** `tests/pdf_builtin.test.js`: feed a built-in deck plus its overlay to
  a new `HPE.pdfdeck.fromBuiltin(deck, overlay)` and assert the returned object
  carries the overlay's `R`, `cy`, `title`, `credit`, `blurb`, `legend_lines`
  and `blank_cards` unchanged - explicitly NOT the synthesized title, and NOT a
  value derived from `geom.ext`. Run it; it fails.
- **B2.** Implement `fromBuiltin` beside `fromGenerated` in
  `src/engine/pdfdeck.js`. It does not touch `fromGenerated`, so the
  `geom.ext` throw at `:161` stays exactly as it is - that throw is a
  deliberate guard and this plan does not weaken it.
- **B3.** `tools/pdf_build.js` gains a `--builtin <deck-id>` mode that reads
  `data/decks.json` + `data/print_overlay.json` and routes through
  `fromBuiltin`.
- **B4.** Point the Stage A harness at the JS output as well: for all three
  decks, both variants, emitter output vs committed PDF. **This is the gate.**
  Expect D-6-class ordering differences and sub-0.1 pt coordinate drift; expect
  D-1 .. D-5 to be GONE. Any survivor is a bug in `fromBuiltin`, not an
  acceptable delta.
- **B5.** Re-run `python3 tools/inline_engine.py` and commit what it writes.
- **Acceptance:** `node --test tests/pdf_builtin.test.js`,
  `python3 -m unittest tests.test_seed_pdf_equivalence`,
  `python3 tools/validate.py` all green.
- **Rollback:** revert; `tools/decks.py` is still the producer.

### Stage C - retire the Python emitter (OWNER GATE)

Only after B4 is green and the owner has eyeballed the side-by-side from
section 5.

- **C1.** Port the assertions that die with `hifi.py` - the 3.6 pt print floor
  over every drawn glyph (`test_no_label_falls_below_the_print_floor`), and
  `hifi.fit_note`'s overflow shrink - into the JS suite. **Port before delete.**
- **C2.** Replace `tools/decks.py`'s build path with a call into
  `tools/pdf_build.js --builtin`. Keep the entry point
  (`python3 tools/decks.py` still builds all six) so no documentation or
  muscle memory breaks.
- **C3.** Delete `tools/hifi.py` and the now-tautological halves of
  `tests/test_render_agreement.py` (it pinned two renderers; there is one).
  Keep every assertion that pins a renderer to the SPEC.
- **C4.** Update `CLAUDE.md`'s "Print pipeline" section and `README.md`.
  Drop the `reportlab` requirement if nothing else uses it.
- **Acceptance:** a clean clone with no `reportlab` builds all six PDFs and the
  equivalence harness passes against the committed bytes.
- **Rollback:** revert C; A and B are independently useful and stay.

### Lanes

Stage A and Stage B share `tests/`, so run them serially, not as parallel
lanes. Within B, `src/engine/pdfdeck.js` and `tools/pdf_build.js` are one
ownership boundary (B2+B3 together); the harness extension (B4) is a second and
can be written concurrently against the not-yet-existing flag.

---

## 5. Owner decisions this plan needs

Each is stated with a recommendation. Under the standing AFK grant the
recommended option is taken and recorded, but D-1 and D-3 touch geometry and
deck data, which CLAUDE.md puts behind explicit owner instruction, so they are
flagged rather than auto-decided.

| # | question | recommendation |
|---|---|---|
| Q1 | Diagram radius: keep the measured literals (73.0 / 60.0) or accept the generated 69.8 / 50.6? | **Keep the literals.** -15.7% on Pygmy is not minute, and the literals were measured against the physical instrument. |
| Q2 | Deck name on every card: keep `F3 LOW PYGMY 18` / `D AMARA 9` / `C# HIJAZ 9 / ORION`, or accept `F AEOLIAN 12` / `D AEOLIAN 9`? | **Keep the hand-written names.** The auto-name describes the scale, not the instrument. |
| Q3 | Amara scale degrees: keep `bIII` / `bVII` / `IV` from `data/decks.json`, or accept the engine's `III` / `VII` / `iv`? | **Keep `data/decks.json`.** CLAUDE.md fixes Amara's degrees as `{D:i, A:v, G:IV, C:bVII, F:bIII}`; the engine's derivation disagrees with the documented ground truth and that disagreement is worth a separate queue row. |
| Q4 | Pygmy's 7 blank cards (the 7th page): keep or drop? | **Keep.** It is a stated owner preference and costs one sheet. |
| Q5 | Does the Python emitter get deleted (Stage C) or kept as a second opinion (stop after B)? | **Delete, after C1's port.** Stopping after B leaves two emitters plus a third artifact (the overlay), which is worse than today. |

An answer of "accept the generated value" to Q1, Q2 or Q3 collapses this plan
to option 1 and makes Stages A and B unnecessary.

---

## 6. Non-goals

- The D2 browser-print cutover (`openPrintSheet` / `PRINT_LAYOUTS` stay).
- Changing chord data, voicings, ranking, or card copy.
- The iOS `Unknown.pdf` filename (closed WONTFIX, coordination row 316).
- Redesigning the print layout. The spec stays 62.65 x 87.21 mm
  (177.6 x 247.2 pt), Letter 3x3, gutters 12.2/9.4 pt, crop marks, 2.00-inch
  calibration bar on page 1.
- Fixing the engine's degree derivation (Q3). Record it; do not widen this
  plan into it.

## 7. Evidence artifacts

Reproduce section 2 with:

```
node tools/gen_deck.js "<seed>" > /tmp/d.json
node tools/pdf_build.js --out /tmp/out.pdf --variant shop --paper letter < /tmp/d.json
```

then compare against the committed PDF. The comparison scripts used for this
draft are throwaway; Stage A1 replaces them with
`tests/test_seed_pdf_equivalence.py`, which is the durable form.

---

## 8. Engineering review (2026-09-22, `/plan-eng-review`)

Seven findings. The owner is AFK under the standing grant, so each was
auto-decided to its recommended option and recorded here; none of them is
destructive or irreversible, and none of them touches deck data or diagram
geometry (the two things CLAUDE.md puts behind explicit owner instruction -
those stay as Q1..Q5 in section 5, still unanswered).

### 8.1 Architecture

**E-1 [P1] (confidence 9/10) - Stage C3 names one of ten files that reference
`hifi`.** `tools/hifi.py` is imported by seven files and referenced by ten:

```
tests/test_render_agreement.py   46 refs      tests/test_print.py      35 refs
tools/decks.py                   10 refs      tests/test_gen_deck.py    7 refs
tests/test_pdf_parity.py          3 refs      tests/test_pdf_build.py   2 refs
tools/inline_fonts.py             2 refs      tests/test_deck_data.py   1 ref
tests/test_font_subset.py         1 ref       tools/validate.py         1 ref
```

`tests/test_pdf_build.py:115` is `cls.returned[key] = hifi.build(path, deck,
chords_only=chords_only)` - the base class every test in that file inherits.
C3 as written deletes `hifi.py` and reds three suites it never mentions.
**Decision (auto): adopt.** Stage C gains a **C0** step before C1: enumerate
every `hifi.` reference and assign each one PORT / RE-POINT / DELETE in
writing. C3 may not run until C0's table is in this file.

**E-2 [P1] (confidence 9/10) - `fromBuiltin`'s real work is the spec
conversion, and B1 does not test it.** `src/engine/pdfcards.js:433` is
`var spec = deck.spec;` and `:318` is `var g = spec._geom;`. A built-in deck
in `data/decks.json` carries `fields` and `geom` and has no `spec` and no
`_geom` (`pdfdeck.js:82` builds that shape for generated decks:
`var spec = { _geom: {} };`). So `fromBuiltin` must convert
`fields{id:[name,octave,midi,zone,angle,label]}` + `geom{...}` into
`spec{id:[...], _geom:{...}}`, which is the only part of it that can be
subtly wrong. B1 as written asserts overlay passthrough only, so B1 goes
green with the conversion missing or mis-keyed.
**Decision (auto): adopt.** B1 additionally asserts (a) `spec._geom` deep-equals
the deck's `data/decks.json` `geom`, (b) every field id survives with its
zone and angle at indices 3 and 4, and (c) `fieldOrder(spec)` excludes
`_geom` and matches the committed drawing order.

**E-3 [P2] (confidence 8/10) - D-8: the deck subtitle, missed by the
measurement.** `src/engine/pdfcards.js:477` draws `deck.sub` on the title
card. `data/decks.json` hijaz carries `sub: "ORION  -  8 + 1"`;
`pdfdeck.js:176-178` computes `sub` from zone counts instead, giving
`"8 + 1"` - Orion disappears, same class of loss as D-2. The measurement in
section 2 did not catch it because 2a's per-card table is the PRINTER_ONLY
chord cards: **the full variant's title and legend cards were never
token-compared**, so D-5 is asserted from reading code, not from measuring
output.
**Decision (auto): adopt.** D-8 is added to the table below; `fromBuiltin`
takes `sub` from `data/decks.json` (it is canonical data, not overlay, and
`tools/decks.py:238` already reads it as `sub=deck["sub"]`); and section 2's
coverage caveat is recorded here rather than left implied.

| # | difference | scope | minute? |
|---|---|---|---|
| D-8 | **Deck subtitle on the title card.** Committed hijaz `ORION  -  8 + 1` (`data/decks.json`); emitter computes `8 + 1` (`pdfdeck.js:176-178`), drawn at `pdfcards.js:477`. | title card, full variant | **NO.** Same loss as D-2. Fixed by reading `sub` from canonical data. |

### 8.2 Code quality

**E-4 [P2] (confidence 9/10) - C1 asks for a port that is already done.**
C1 says port "`hifi.fit_note`'s overflow shrink" into JS. It is already
there: `src/engine/pdfcards.js:156-157` is
`function fitNote(name, octv, font, size, maxw) { while (size > 2.5 && noteW(...) > maxw) size -= 0.1; }`,
byte-for-byte the behaviour of `tools/hifi.py:156-157`, and the 3.6 pt `fit`
floor is at `pdfcards.js:124`. Only the ASSERTION
(`tests/test_print.py::test_no_label_falls_below_the_print_floor`) has no JS
counterpart.
**Decision (auto): adopt.** C1 is reworded to "port the ASSERTION; the
implementation already exists at `pdfcards.js:124` and `:156` - do not
rewrite it."

**E-5 [P2] (confidence 8/10) - the plan never names the existing adapter
parity harness.** `tests/test_pdf_deck_adapter.py:99` `AdapterParityTest`
already sweeps the JS adapter against the Python one, and `:124-130`
`test_blank_cards_is_absent_on_both_sides` asserts `blank_cards` appears on
NEITHER side, quoting `decks.GENERATED_OMITTED`. Stage B introduces a second
JS adapter for which `blank_cards` is legitimately present (Pygmy's 7), so
that test needs an explicit `fromBuiltin` carve-out or it goes red on B2.
**Decision (auto): adopt.** B2 gains a sub-step: narrow
`test_blank_cards_is_absent_on_both_sides` to `fromGenerated`, and add the
mirror assertion that `fromBuiltin` DOES carry `blank_cards`, so
`GENERATED_OMITTED`'s reason stays pinned rather than quietly dropped.

### 8.3 Tests

**E-6 [P1] (confidence 9/10) - C3's premise is false; deleting `hifi.py`
leaves two renderers, not one.** `tests/test_render_agreement.py:3-8`:
"`tools/hifi.py` and the inline script in `index.html` are two independent
implementations of the same card conventions ... they do not even share an
axis convention - hifi works in PDF space (y-up, `cy + orb*sin`) while the
app emits SVG (y-down, `-orb*sin`) - so a sign error in either renderer is
invisible to every other test in this suite." After C3 the surviving pair is
the APP renderer and `src/engine/pdfcards.js`, still two, still opposite-axis.
The 970-line suite is not tautological, it is mis-pointed.
**Decision (auto): adopt.** C3 changes from "delete the now-tautological
halves" to "**re-point `test_render_agreement.py` at `src/engine/pdfcards.js`**
via the existing node bridge, keeping every cross-renderer assertion. Delete
only the assertions whose subject is reportlab-specific plumbing." A sign
error in `pdfcards.js` must stay catchable after `hifi.py` is gone.

**E-7 [P2] (confidence 8/10) - A1 rebuilds a harness the repo already has,
and adds a third full six-PDF build to the python suite.**
`tests/test_pdf_build.py:254` `test_committed_pdfs_match_a_fresh_build` is
already the committed-vs-fresh gate, on a `BuiltDecksTest` base
(`:101-114`) that builds all six in `setUpClass`. It builds through
`hifi.build`, so it cannot be the durable harness - but its scaffolding is
what A1 is about to re-type.
**Decision (auto): adopt, with a twist.** A1 still creates
`tests/test_seed_pdf_equivalence.py`, because it must outlive `hifi.py` - but
it owns a single module-level build cache (`build_all(emitter)`), and C0
re-points `test_pdf_build.py`'s `setUpClass` at that helper instead of at
`hifi.build`. One build set, two consumers, no third pass.

### 8.4 Performance

No issues found. The six-PDF build is a developer/CI step, not a user-facing
path; the only measurable cost is suite runtime, which E-7 caps at one build
set rather than three. Nothing here touches an N+1, a cache or a hot loop.

### 8.5 Test coverage of the planned work

```
CODE PATHS                                             USER FLOWS
[+] src/engine/pdfdeck.js                              [+] Owner rebuilds the six PDFs
  +- fromBuiltin(deck, overlay)          <- NEW          +- [GAP] `python3 tools/decks.py`
  |   +- [GAP] overlay passthrough (B1)                  |    still emits all six (C2)
  |   +- [GAP] spec/_geom conversion (E-2)               +- [GAP] clean clone, no reportlab (C)
  |   +- [GAP] sub from decks.json (E-3)               [+] Print shop receives PRINTER_ONLY
  |   +- [GAP] blank_cards carried (E-5)                 +- [*** ] crop marks + calib bar
  |   +- [GAP] missing overlay -> throw                  |     - tests/test_pdf_build.py
  +- fromGenerated                       <- UNCHANGED    +- [GAP] 3.6pt floor in JS (C1)
      +- [*** ] geom.ext throw - test_pdf_deck_adapter [+] Custom-deck user (regression)
[+] tools/pdf_build.js                                   +- [** ] unchanged path
  +- --builtin <deck-id>                 <- NEW          +- [GAP] built-in id typo -> clear error
  |   +- [GAP] happy path (B3)
  |   +- [GAP] unknown deck id
  |   +- [GAP] overlay file absent/malformed
[+] tools/decks.py
  +- reads data/print_overlay.json       <- NEW
  |   +- [GAP] file absent -> clear error, not KeyError
  |   +- [GAP] overlay id not in decks.json -> clash guard
  +- [** ] existing clash guard - test_pdf_parity.py
[+] tools/validate.py check 1b           <- EXTENDED
      +- [GAP] overlay drift vs built PDFs (A4)

COVERAGE: 4/17 paths tested (24%)   |   GAPS: 13, all inside this plan's own stages
QUALITY: ***:2  **:2  *:0
```

Every gap above is work this plan already schedules, except four that it does
not and that are added here as **CRITICAL - error paths with no handling and
no test**: overlay file absent, overlay id unknown to `data/decks.json`,
`--builtin` given an unknown deck id, and `fromBuiltin` called without an
overlay. All four are silent-wrong-output risks rather than crashes (a
missing `R` draws a 1.0-radius pan, the failure `pdfdeck.js:155-160` exists
to prevent), so each gets an explicit throw plus a test in its own stage.
**Decision (auto): adopt** - the four throws land in A3, A3, B3 and B2
respectively.

### 8.6 Failure modes

| new codepath | realistic production failure | test? | handled? | silent? |
|---|---|---|---|---|
| `fromBuiltin` spec conversion | a field's angle lands at the wrong tuple index; the pan draws rotated | after E-2 | no throw possible - values are all valid | **yes, until B4** |
| overlay file missing | `tools/decks.py` KeyErrors, or worse defaults `R` to a falsy 0 | after 8.5 | after 8.5 | was yes |
| overlay drifts from `data/decks.json` | colours or degrees disagree between app and print | A4 | A4 | was yes |
| `--builtin` unknown id | builds an empty PDF | after 8.5 | after 8.5 | was yes |
| `test_render_agreement` deleted (C3) | a sign error in `pdfcards.js` ships | E-6 re-point | n/a | **yes if C3 runs as written** |

Two critical gaps flagged: the spec conversion (caught only at B4, which is
why B4 is the gate) and the C3 deletion (closed by E-6).

### 8.7 NOT in scope

- **Fixing the engine's Amara degree derivation.** `III`/`VII`/`iv` vs
  CLAUDE.md's `bIII`/`bVII`/`IV`. Separate queue row; Q3 keeps the canonical
  data and does not touch the engine.
- **`geom.ext` for built-in decks.** The `:161` throw stays; `fromBuiltin`
  routes around it rather than through it. Adding `ext` to the three shipped
  geoms would change `R` - that is option 1, already rejected.
- **The D2 browser-print cutover.** Unchanged non-goal.
- **Unifying the app's SVG renderer with the PDF renderer.** Three
  implementations become two here, not one; the app stays as it is.
- **Re-measuring the print spec.** 62.65 x 87.21 mm stands.

### 8.8 What already exists

| existing | does the plan reuse it? |
|---|---|
| `tests/test_pdf_build.py:254` committed-vs-fresh staleness gate | Not as drafted. E-7 makes A1 own one build helper both consume. |
| `tests/test_pdf_deck_adapter.py:99` JS-vs-Python adapter parity sweep | Not named in the plan. E-5 folds it in. |
| `src/engine/pdfcards.js:156` `fitNote`, `:124` 3.6 pt floor | C1 asked to port them; they exist. E-4 corrects. |
| `src/engine/pdfcards.js:516,552` blank-card rendering and `deck.blank_cards` | Yes, implicitly - the renderer already honours the key, so D-4 dissolves with the overlay and needs no renderer change. |
| `src/engine/fontdata.js` - all five faces (Marcellus, Bitter R/B, NunitoSans R/SB) | Yes. Verified: the JS side embeds the same five fonts `tools/hifi.py:16-20` registers. No font work in this plan. |
| `tools/pdf_build.js`, `tools/gen_deck.js`, `tools/pdf_adapt.js` | Yes - B3 extends `pdf_build.js` rather than adding a tool. |

### 8.9 Parallelization

| step | modules touched | depends on |
|---|---|---|
| A1 | `tests/` | - |
| A2, A3, A4 | `data/`, `tools/` | A1 |
| B1, B4 | `tests/` | A2 |
| B2, B3 | `src/engine/`, `tools/` | A2 |
| C0 | `docs/` (inventory only) | B4 |
| C1..C4 | `tests/`, `tools/`, `src/engine/`, docs | C0 |

Lane A: A1 -> A2 -> A3 -> A4 (sequential, shared `tools/`).
Lane B1: B2 -> B3 (sequential, shared `tools/` + `src/engine/`).
Lane B2: B1 -> B4 (`tests/` only, written against the not-yet-existing flag).
Lanes B1 and B2 run in parallel after A merges; both land before C.
**Conflict flag:** Lane A and Lane B1 both touch `tools/` - A must merge first,
which the ordering already enforces. Stage C is single-lane by construction
(it deletes across every boundary at once).

### 8.10 Implementation tasks

Synthesized from the findings above. Each derives from a specific finding.

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** - Stage C - add step C0, the `hifi.` reference inventory
  - Surfaced by: E-1 - ten files reference `hifi.`, C3 names one
  - Files: `docs/plans/2026-09-22-seed-pdf-one-source.md`
  - Verify: the C0 table lists all ten with PORT/RE-POINT/DELETE
- [ ] **T2 (P1, human: ~2h / CC: ~20min)** - `pdfdeck.js` - B1 asserts the spec/_geom conversion
  - Surfaced by: E-2 - `pdfcards.js:318` reads `spec._geom`, built-ins have none
  - Files: `tests/pdf_builtin.test.js`
  - Verify: `node --test tests/pdf_builtin.test.js`
- [ ] **T3 (P2, human: ~30min / CC: ~5min)** - `pdfdeck.js` - `fromBuiltin` takes `sub` from `data/decks.json`
  - Surfaced by: E-3 / D-8 - `ORION  -  8 + 1` vs computed `8 + 1`
  - Files: `src/engine/pdfdeck.js`, `tests/pdf_builtin.test.js`
  - Verify: the title card of the hijaz full build contains `ORION`
- [ ] **T4 (P1, human: ~4h / CC: ~40min)** - tests - re-point `test_render_agreement.py` at `pdfcards.js`
  - Surfaced by: E-6 - deleting `hifi.py` leaves app-SVG vs JS-PDF, still two renderers
  - Files: `tests/test_render_agreement.py`
  - Verify: `python3 -m unittest tests.test_render_agreement` green with `hifi.py` absent
- [ ] **T5 (P2, human: ~30min / CC: ~5min)** - `test_pdf_deck_adapter.py` - carve `fromBuiltin` out of the blank-cards assertion
  - Surfaced by: E-5 - `:124-130` asserts `blank_cards` on neither side
  - Files: `tests/test_pdf_deck_adapter.py`
  - Verify: `python3 -m unittest tests.test_pdf_deck_adapter`
- [ ] **T6 (P2, human: ~1h / CC: ~10min)** - four explicit throws on the new error paths
  - Surfaced by: 8.5 - overlay absent, overlay id unknown, `--builtin` unknown id, `fromBuiltin` without overlay
  - Files: `tools/decks.py`, `tools/pdf_build.js`, `src/engine/pdfdeck.js`
  - Verify: one negative test each
- [ ] **T7 (P2, human: ~1h / CC: ~10min)** - one build helper, two consumers
  - Surfaced by: E-7 - `test_pdf_build.py:101-114` already builds all six
  - Files: `tests/test_seed_pdf_equivalence.py`, `tests/test_pdf_build.py`
  - Verify: python suite wall time does not grow by a third build set
- [ ] **T8 (P3, human: ~15min / CC: ~2min)** - reword C1 (the fitNote port is already done)
  - Surfaced by: E-4 - `pdfcards.js:124`, `:156`
  - Files: this plan
  - Verify: C1 says "port the assertion", not the implementation

---

## 9. Outside voice (fresh Claude subagent, no shared context)

Codex was unusable this run (`CODEX_MODE: model_unusable` - the stale CLI
rejects the effort argument with `unknown variant 'max'`; `npm install -g
@openai/codex` fixes it), so the outside voice is a fresh Claude subagent
given the plan and the repo and told to challenge it. Eight findings. Three
of them are things the in-context review missed, and two are hard blockers.

**O-1 [BLOCKER, verified] - the plan proposes a weaker duplicate of an oracle
the repo already has.** `tests/test_pdf_parity.py:104-121` already renders one
deck through BOTH `hifi.build` and `tools/pdf_build.js` and asserts **every
glyph - x, y, size and character, page by page** - for the `full` and `shop`
variants, over two seeds including a bottom-shell pan
(`test_every_glyph_lands_where_print_puts_it`). Section 2 re-derived at token
granularity something already pinned glyph-exactly, and A1 then proposes
token lists plus "largest drawn circle radius per card" and B4 calls that
"the gate". Confirmed by reading the file.
**Decision (auto): adopt.** A1 is rewritten: **parameterize
`tests/test_pdf_parity.py` over the three BUILT-IN decks** rather than
creating `tests/test_seed_pdf_equivalence.py`. Its `SEEDS` list becomes
seeds + built-ins, `_pair` gains a built-in branch calling `fromBuiltin`, and
the glyph-exact assertions apply unchanged. This supersedes E-7 above (which
proposed a shared build helper for a new file that now does not exist) and
retires the new-file half of T2. The token-list harness is dropped entirely -
it is strictly weaker than what it would have sat beside.

**O-2 [BLOCKER, verified] - Stage A's acceptance command compares a build
against itself.** `tools/decks.py:409` writes into `OUT`, which is the repo
root - the same paths as the committed PDFs. A1's acceptance is
`python3 tools/decks.py && python3 -m unittest ...`, so the build overwrites
the committed bytes and the harness then compares the fresh build to itself.
Stage C's "passes against the committed bytes" has the same hole. The plan
never says where a frozen reference comes from.
**Decision (auto): adopt.** Every equivalence check takes its reference from
`git show HEAD:<pdf>` into a tmpdir, never from the working tree, and the
acceptance commands drop the `python3 tools/decks.py &&` prefix. Note that
`tests/test_pdf_build.py:254 test_committed_pdfs_match_a_fresh_build` is not
affected - it builds into a tmpdir and compares extracted text against the
working-tree file, which is the correct direction for a staleness gate.

**O-3 [P1, verified] - C1/C3 are one bullet each and are most of the work.**
`tests/test_print.py` is 913 lines with 35 `hifi.` references and
`tests/test_render_agreement.py` is 970 lines with 46 - roughly 1900 lines and
81 call sites, plus `LabelSizeRuleTest` over `ALL_DECKS`, the 3.6 pt floor
test, and `fit_note` overflow behaviour. Stage C is scheduled last and
described as the cheap cleanup; it is the expensive half.
**Decision (auto): adopt.** Section 3's option scoring is corrected below, and
C0 (from E-1) is the gate: **Stage C does not start until C0's per-reference
table exists and the owner has answered Q5 with that cost in front of them.**

**O-4 [P2, verified] - Stage B is smaller than the plan implies, which moves
the option scores.** `pdfcards.js` already carries `blankCard`/`blank_cards`
(`:516`, `:552`), `fitNote` (`:156`), `CARD_WARNINGS` (`:422`), the
calibration bar (`:556`) and `legend_demo` (`:501`). `fromBuiltin` is: take
overlay keys instead of synthesizing them, plus the spec conversion of E-2,
and skip the `ext` throw. On the order of 40 lines.
**Decision (auto): adopt.** The real decision is not A+B, which is cheap and
reversible - it is C, which is expensive and one-way. Section 3's cost column
is corrected accordingly.

**O-5 [P1, NEW - the review missed it] - nothing compares non-text drawing,
and Stage C removes the only thing that could.** Both harnesses compare
glyphs. Colours (D-7), stroke widths, the coloured band at 0.87r with stroke
0.24r, the inner hairline at 0.74r, the four-sided root-colour frame, the
crop marks and the calibration bar's actual drawn length are compared by
nothing, anywhere. They survive today only because two independent
implementations happen to agree and a human looked at the output. Delete
`hifi.py` and no test can ever catch a regression in any of them - and the
plan's rule "keep every assertion that pins a renderer to the SPEC" does not
save them, because for most of them there IS no spec assertion, only the
second implementation.
**Decision (auto): adopt, and it becomes a hard precondition on C.** Add
**C-1 (before C0)**: extend the parity comparison from glyphs to **drawing
operators** - fill and stroke colours, line widths, and the path bounding
boxes of the band, the hairline, the frame, the crop marks and the
calibration bar - so the non-text half of the render is pinned by assertion
before the second implementation that currently pins it by agreement is
deleted. If C-1 is not affordable, the honest answer to Q5 is "stop after B",
because the deletion trades a real oracle for line count.

**O-6 [P2, NEW] - font embedding was never assessed.** reportlab embeds the
checked-in TTFs; the JS side uses `fontdata.js` plus its own subsetting
(`tests/test_font_subset.py`). Glyph-position parity says nothing about the
embedded font programs, subsetting correctness at rasterization, or the PDF
version and compression a print shop's RIP sees. This class of difference is
not in the D-1..D-7 table at all, so "minute" was never assessed for it - and
the artifact goes to a commercial printer.
**Decision (auto): adopt as a measurement task, not a code task.** Before
Stage C: extract the embedded font programs from one committed PDF and one
`pdf_build.js` PDF of the same deck and compare face names, glyph counts and
`CIDToGIDMap`/subset-tag structure. Record the result as D-9. If the JS
subset drops glyphs the committed file carries, that is not minute.

**O-7 [P2] - Q5's framing is backwards.** The plan says stopping after B
"leaves two emitters plus a third artifact, which is worse than today". A+B
actually yields one emitter that can produce ANY deck, plus a Python
implementation **retained as a differential oracle** - which is exactly what
`test_pdf_parity.py` already treats it as. That is not worse than today; it
converts today's duplication into a test asset while meeting the stated goal.
C buys the deletion of ~950 lines of Python and the `reportlab` dependency,
paid for with O-3's port and O-5's permanent loss of the drawing oracle.
**Decision (auto): adopt the reframing, do NOT pre-empt the decision.** Q5's
text is corrected to score both sides rather than assert the answer. Q5 stays
an owner question - it is the one-way door in this plan and AFK auto-decision
does not extend to one-way doors.

**O-8 [P3] - two sequencing details.** (a) C2 makes `python3 tools/decks.py`
shell out to node, so the "clean clone, no reportlab" acceptance silently
requires node for a step CLAUDE.md documents as a Python step - C4 must state
the new runtime dependency direction. (b) `tools/regen_data_mutants.py`
anchors on the DECKS line and `tools/validate.py` check 1b reads `decks.py`'s
dicts; A3 changes how those dicts are built, so the mutants must be
regenerated on a clean tree after A3.
**Decision (auto): adopt both.** A3 gains "re-run `python3
tools/regen_data_mutants.py` on a clean tree"; C4 gains the node-dependency
note.

### CROSS-MODEL TENSION

**T-a - what the gate is.** The in-context review accepted A1's new
token-list harness and only argued about where the build helper lives (E-7).
The outside voice says the harness should not exist, because a glyph-exact
one already does. The outside voice is right and I verified it:
`tests/test_pdf_parity.py:104-121`. **Resolution: O-1 wins; E-7 is
superseded.** The lesson is the one this workstream keeps re-learning - grep
the test suite for the oracle before writing one.

**T-b - whether Stage C should happen at all.** The plan recommends Option 2
staged, with C behind an owner gate. The outside voice recommends rescoping
to A+B and re-deciding C on its own merits. These are closer than they look:
both put C behind a decision. The genuine disagreement is about what that
decision costs, and the outside voice priced it better - O-3's 1900 lines and
O-5's loss of the only non-text oracle are both absent from section 3's cost
column. **Resolution: the recommendation in section 1 stands (staged, C
gated), with section 3's cost column corrected and C-1 added as a hard
precondition.** Q5 remains the owner's.

**T-c - severity of the `sub` difference.** The in-context review raised D-8
(`ORION` lost from the title card) as P2. The outside voice did not mention
it. No tension - it is a difference neither harness would have caught, since
the parity test compares the two emitters to each other and both would agree
once `fromBuiltin` synthesizes the same wrong string. **D-8 stands.**

### Corrected option scoring (supersedes section 3's cost column)

| option | build cost | one-way cost | oracle after |
|---|---|---|---|
| 1. adopt generated geometry | low | **changes `R`, moves every card** | glyph parity only |
| 2a. A+B only (overlay + `fromBuiltin`) | **~40 lines JS + overlay file + parameterizing one test** | none - fully reversible | glyph parity, **plus `hifi.py` retained as a differential oracle** |
| 2b. A+B+C (retire Python) | 2a **plus ~1900 lines / 81 call sites ported** | **permanent: the only non-text drawing oracle is gone unless C-1 lands first** | glyph parity + whatever C-1 pins |
| 3. keep both, document | zero | none | unchanged |
| 4. generated-only, drop seeds | low | **loses the print overlay entirely** | n/a |

### 9.1 Implementation tasks, amended after the outside voice

T1..T8 in section 8.10 stand except where noted; T9..T13 are new.

- **T2 amended** - the spec/_geom assertions land in the parameterized
  `tests/test_pdf_parity.py`, not in a new `tests/pdf_builtin.test.js`.
- **T7 superseded by T9.** No new equivalence file is created.
- [ ] **T9 (P1, human: ~3h / CC: ~25min)** - parameterize `tests/test_pdf_parity.py` over the three built-in decks
  - Surfaced by: O-1 - `:104-121` already asserts every glyph, page by page
  - Files: `tests/test_pdf_parity.py`
  - Verify: `python3 -m unittest tests.test_pdf_parity -v` shows six new subTests
- [ ] **T10 (P1, human: ~1h / CC: ~10min)** - every reference PDF comes from `git show HEAD:<pdf>`, never the working tree
  - Surfaced by: O-2 - `tools/decks.py:409` writes into the repo root
  - Files: `tests/test_pdf_parity.py`, the Stage A/B/C acceptance commands in this plan
  - Verify: the check goes RED after `touch`-editing a committed PDF and rebuilding
- [ ] **T11 (P1, human: ~1d / CC: ~1h)** - C-1: extend parity from glyphs to drawing operators
  - Surfaced by: O-5 - colours, stroke widths, band/hairline/frame/crop-mark/calibration geometry are pinned by nothing
  - Files: `tests/test_pdf_parity.py`
  - Verify: flipping one colour literal in `tools/hifi.py` turns it red
  - **Hard precondition on Stage C. If this does not land, the answer to Q5 is "stop after B".**
- [ ] **T12 (P2, human: ~2h / CC: ~20min)** - D-9: compare embedded font programs across the two emitters
  - Surfaced by: O-6 - subsetting is untested across the boundary and the artifact goes to a print shop
  - Files: a one-off measurement, recorded in section 2b as D-9
  - Verify: face names, glyph counts and subset structure recorded for one deck, both emitters
- [ ] **T13 (P3, human: ~30min / CC: ~5min)** - A3 re-runs the data mutants; C4 documents the node dependency
  - Surfaced by: O-8
  - Files: `tools/regen_data_mutants.py` output, `CLAUDE.md`, `README.md`
  - Verify: `python3 tools/validate.py` clean on a clean tree

---

## GSTACK REVIEW REPORT

| field | value |
|---|---|
| Review | `/plan-eng-review` on `docs/plans/2026-09-22-seed-pdf-one-source.md` |
| Trigger | owner: "run the plan with that prompt" (AFK armed) |
| Why | the plan proposes deleting one of two independent PDF implementations; the cost of that deletion is the whole question |
| Runs | 4 sections (architecture, code quality, tests, performance) + outside voice (fresh Claude subagent; codex `model_unusable`) |
| Status | **REVISE BEFORE EXECUTING** - Stage A cannot run as written |
| Findings | 15 (E-1..E-7 in-context, O-1..O-8 outside voice). 2 blockers, 5 P1, 6 P2, 2 P3. |

**VERDICT: REVISE.** The recommendation in section 1 survives - Option 2,
staged, Stage C behind an owner gate - but Stage A cannot execute as written.
Two blockers: A1 proposes a token-granularity harness that is strictly weaker
than `tests/test_pdf_parity.py:104-121`, which already asserts every glyph
position, size and character page by page across both emitters (O-1); and
every acceptance command prefixed with `python3 tools/decks.py &&` compares
the fresh build against the committed file it just overwrote, because
`tools/decks.py:409` writes into the repo root (O-2). Both are fixed above:
A1 becomes "parameterize the existing parity test over the three built-in
decks", and every reference comes from `git show HEAD:<pdf>`.

The one finding that changes the shape of the plan is O-5. Colours, stroke
widths, the 0.87r band, the 0.74r hairline, the four-sided frame, the crop
marks and the calibration bar are pinned by **nothing** - not by either
harness, not by a spec assertion. They are correct today only because two
independent implementations agree. Deleting `tools/hifi.py` ends that, and no
test replaces it. Stage C is therefore gated on **C-1**: extend the parity
comparison from glyphs to drawing operators, first. If C-1 is not affordable,
the honest answer to Q5 is "stop after B" - and A+B alone already meets the
stated goal, with `hifi.py` retained as a differential oracle rather than as
duplicate work (O-7).

Also corrected: Stage C is ~1900 lines and 81 `hifi.` call sites across ten
files, not the one file C3 names (E-1, O-3); Stage B is ~40 lines, much
cheaper than the plan implies (O-4); `test_render_agreement.py` must be
re-pointed, never deleted - its premise "two independent renderers with
opposite y axes" survives `hifi.py`'s removal (E-6); D-8 (`ORION` lost from
the hijaz title card) and D-9 (embedded font programs, unmeasured) join the
difference table (E-3, O-6).

Artifacts: `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-20260922-214140.jsonl`
(13 tasks), and the test plan at
`~/.gstack/projects/raywu-handpan-cards/raywu-claude-seed-pdf-plan-eng-review-test-plan-20260922-214158.md`.

**UNRESOLVED DECISIONS:**

- **Q5 - does Stage C happen at all?** One-way door. Outside the AFK
  auto-decide grant, so it was not auto-picked. Decide it with O-3's port
  cost and O-5's oracle loss in view, and only after C-1 has landed or been
  priced. Q1-Q4 in section 5 also remain owner questions; they touch deck
  data and diagram geometry, which CLAUDE.md puts behind explicit owner
  instruction.
