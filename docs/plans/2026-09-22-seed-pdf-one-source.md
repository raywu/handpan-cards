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
emitter reproduces the committed chord data exactly on **95 of 96 cards**
(Hijaz 19 of 19, Amara 25 of 25, Pygmy 51 of 52). Almost everything that does
not survive is the hand-authored print overlay, and an overlay is data, so it
can be moved rather than reimplemented.

**[AMENDED after independent review - this paragraph previously read "96 of 96
cards for two of the three decks", which was both wrong and internally
contradictory (96 of 96 qualified to two decks is 44 cards). One card really
does differ: see D-6.]** The single exception, Pygmy card 6 (`Fm9`), is NOT
overlay data - it is a voicing the engine derives differently from the
committed deck. That makes a third code blocker (section 2c), and it is
answered the same way as D-2/D-3/D-5: the built-in path must READ
`chords[].fields` from `data/decks.json`, never re-derive it. The direction of
the recommendation is unchanged - it is one more "read canonical data instead
of deriving it" item, not a new kind of problem - but it is a hard
precondition, not a minute difference.

---

## 2. Measured evidence (2026-09-22, this repo, at `224af5d`)

Built with `node tools/gen_deck.js "<seed>" > /tmp/d.json` then
`node tools/pdf_build.js --out /tmp/out.pdf --variant {full,shop} --paper letter < /tmp/d.json`,
on the canonical seeds (the `--out` form above is the working one; a pipe
form without `--out` exits 2 with `usage: pdf_build.js --out FILE [--variant
f] < deck.json`) **[NOTE TRIMMED after independent review: the command line
above was already corrected to carry `--out`, so the note no longer describes
a defect in the text it annotates - it is kept only as the reason `--out` is
written there.]**:

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
| **per-card content, deck name removed** | **19 of 19 identical** | **51 of 52 identical, 1 DIFFERENT VOICING (card 6, see D-6)** | **13 of 25 identical** |

Chord names, superscripts, subtitles, note lines, number lines, bottom-note
badges and index numbers all reproduce. The engine is not the problem.

### 2b. What differs, and whether it clears "minute"

| # | difference | scope | minute? |
|---|---|---|---|
| D-1 | **Diagram radius.** Committed `R` 73.0 (Hijaz, Amara) and 60.0 (Pygmy); emitter draws 69.8 and **50.6**. Measured off the PDFs, matching the derivation already recorded at `tools/decks.py:56-58`. | every card | **NO.** -4.4% and **-15.7%**. A sixth off Pygmy's diagram is visible at arm's length. |
| D-2 | **Deck name.** Committed card-header `name`s are `C# HIJAZ 9`, `F3 LOW PYGMY 18`, `D AMARA 9` (the `/ ORION` half is not the name - it is the separate vertical `credit` string `C# HIJAZ / ORION`); emitter auto-names `C# HIJAZ 9`, **`F AEOLIAN 12`**, **`D AEOLIAN 9`**. The `/ ORION` half is lost from the vertical credit strip (`decks.py:264` `"C# HIJAZ / ORION"`); the card header `name` is identical on both sides for hijaz. Pygmy and Amara lose the instrument name in both places. | all 96 cards | **NO.** The instrument's name is data. Pygmy stops saying Pygmy. |
| D-3 | **Scale-degree labels, Amara only.** Committed `bIII` (5 cards), `bVII` (4), `IV` (3); emitter `III`, `VII`, `iv`. | 12 of 25 Amara cards | **NO.** Wrong degree spelling is wrong data. `data/decks.json` `degrees` is authoritative and the generated path does not read it. |
| D-4 | **Pygmy blank-card padding.** Committed full deck is 7 pages / 63 card slots (52 chords + title + `blank_cards: 7` + fill); emitter is 6 pages / 54. | Pygmy full only | **NO**, but it is a preference, not a defect - `tools/decks.py` calls it "Pygmy's blank-card padding preference". |
| D-5 | **Title-card copy.** Committed carries the hand-written `title`, `credit`, `blurb` and `legend_lines` (Pygmy: "Bb AND Db EXIST ..."); the emitter substitutes different title-card copy **[CORRECTED: the two strings quoted here previously - "ONE CARD PER CHORD" and "OCTAVE NUMBERS INSIDE EACH TONEFIELD NAME" - were wrong. The second exists nowhere in the repo; the first is BLURB text (`src/engine/pdfdeck.js:109`), not a legend line, and Amara's committed blurb already carries it (`tools/decks.py:300`; `:319` is the GENERATED-blurb helper, not the committed literal). `legendLines()` (`pdfdeck.js:116-130`) emits "NOTE NAME + OCTAVE INSIDE EACH TONEFIELD", byte-identical to the committed Hijaz (`tools/decks.py:271-272`) and Amara (`:301-302`) literals, so only PYGMY actually loses a legend line.]** and synthesizes `title` as `name + " - Chord Cards"` at `src/engine/pdfdeck.js`. | title card, full variant only | **NO.** Hand-written copy is content. |
| D-6 | **[CORRECTED after independent review. This row previously read "Token extraction order on one Pygmy card (card #6): same token multiset, different order - YES, coordinate-level, no content change." That was wrong: the multiset is NOT the same.] Different voicing on one Pygmy card** (card 6, `Fm9`). Committed is `F4 Ab4 C5 Eb5 G5` (`fields [5,7,8,9,11]`, field 11 = `G` 5 midi 79 inner); the engine derives `fields [5,7,8,9,6]`, field 6 = `G` 4 midi 67 rim. Different note line (`G5` vs `G4`), different number line (`11` vs `6`). The DIAGRAM matches only because pitch-class-complete highlighting lights the same fields for G4 and G5, which is how this was first misread as cosmetic. Reproduce: run `tools/gen_deck.js` on the Pygmy seed and diff `chords[5]` against `data/decks.json`. | 1 card | **NO.** A voicing is content. `CLAUDE.md` names this exact card as ground truth: "a spread 9th above the 7th, like Fm9's G5, is fine." |
| D-7 | Colour literals: committed three-decimal values vs re-derived floats (`tools/decks.py:227-230`). Not separately measured here; the docstring states re-deriving moves every printed colour by a fraction. | all cards | **YES** if the literals are carried; a fraction of a colour step. |

**Verdict against the bar:** the chord data passes on **95 of 96 cards**.
**[AMENDED: this read "the chord DATA passes" unqualified, and grouped D-6
with the acceptable differences. D-6 is a content difference and is now a
NO.]** D-1 through D-6 are not minute. D-1 through D-5 are the print overlay
or a data field the generated path cannot see; D-6 is a derived voicing that
disagrees with canonical data. None of the six is a rendering disagreement.

### 2c. The three code blockers

- `src/engine/pdfdeck.js:161` throws `"generated deck has no geom.ext"`. None
  of the three shipped geoms in `data/decks.json` carries `ext` (verified).
  So `fromGenerated` cannot consume a built-in deck at all today.
- The same function synthesizes the title rather than accepting one, so
  `"C# Hijaz / Orion 9 - Chord Cards"` is unreachable through it.
- **[ADDED after independent review.]** The built-in path must take
  `chords[].fields` from `data/decks.json` rather than letting the engine
  re-derive them. The engine's register tie-break puts Pygmy `Fm9`'s 9th at
  `G4` where the committed deck has `G5` (D-6). Deriving voicings for a
  BUILT-IN deck is the defect; the tie-break itself is an owner decision
  (`docs/SCALE_ENGINE_PLAN.md` D11) governing GENERATED decks and is not in
  scope to change here.

---

## 3. Options, scored

| option | one source of truth? | clears the bar? | cost |
|---|---|---|---|
| **1. Adopt generated geometry** - built-ins become ordinary generated decks | yes | **no** (D-1 .. D-5) | free in code, expensive in output; also needs an explicit owner instruction under CLAUDE.md's geometry rule |
| **2. Overlay becomes data; JS emitter consumes it** (recommended) | yes, after stage C | yes | a `fromBuiltin` path in `pdfdeck`, an overlay file, an equivalence harness |
| **3. Keep both emitters, widen `test_pdf_parity.py`** | no | n/a | cheapest; pays the duplication forever |
| **4. Delete `tools/decks.py` + `tools/hifi.py`** (reachable only from 1 or 2) | yes | depends on 1 vs 2 | loses the 3.6 pt print-floor ASSERTIONS, `tests/test_render_agreement.py`'s per-field pinning, and `validate.py` check 1b - these must be ported, not dropped. **[CORRECTED after independent review: `hifi.fit_note` was in this list and should not have been. E-4 (section 8) already ruled it a NO-OP port - `fitNote` exists in JS at `src/engine/pdfcards.js:156-157` and the 3.6 pt floor at `:124`. Only the assertions need a new home. Section 3 was not updated when E-4 landed.]** |

Option 2 is the only one that both removes the second implementation and keeps
the printed artifact the owner already approved.

---

## 4. Execution plan (TDD, three stages, each independently revertible)

> **AMENDED 2026-09-22 by sections 8 and 9.** The stage bodies below are the
> original draft with the review's corrections applied INLINE and marked
> **[AMENDED]**. Where a step is superseded, the amendment is binding and the
> original wording is kept only so the change is legible. Section 9.1
> (T1-T15) is authoritative **where it conflicts with** the bullets here.
> **[CORRECTED after independent review: this read "The authoritative task
> list is section 9.1, not the bullets here", which read in full drops the
> plan's core work - 9.1 is SYNTHESIZED FROM THE FINDINGS (see 8.10) and so
> carries no task for A2 (create the overlay file), B2 (implement
> `fromBuiltin`), B3 (`--builtin` mode) or C2 (route `decks.py` through
> node). The stage bullets are the work; 9.1 is the review's amendments to
> it.]**

### Stage A - the overlay becomes canonical data (no output change)

Goal: `tools/decks.py`'s per-deck literals stop being Python and become a data
file both emitters can read. Nothing about the PDFs changes.

- **A1. Fix the committed-bytes oracle first. [AMENDED by O-1 and O-2, then
  AMENDED AGAIN after independent review - the original text is struck below.]**
  ~~New `tests/test_seed_pdf_equivalence.py`, comparing page box, page count,
  card-rect count and size, per-card extracted token list and the largest
  drawn circle radius per card.~~ That harness is strictly weaker than
  `tests/test_pdf_parity.py:104-118`, which already compares **every glyph -
  x, y, size and character, page by page**. **Do instead (T10):** point the
  repo's committed-PDF staleness gate at `git show HEAD:<pdf>` instead of the
  working tree. That gate is
  `tests/test_pdf_build.py:254` (`test_committed_pdfs_match_a_fresh_build`),
  which today opens `os.path.join(paths.ROOT, paths.PDFS[key])` - a WORKING-TREE
  path that `tools/decks.py:409` overwrites - so an acceptance command prefixed
  with `python3 tools/decks.py &&` compares a build against itself and passes
  vacuously. No new test file is created.
  Verify: `python3 -m unittest tests.test_pdf_build -v`.
  **[BLOCKER FIX, independent review: T9 - parameterizing
  `tests/test_pdf_parity.py` over the three BUILT-IN decks - has MOVED OUT OF
  STAGE A into Stage B (B0, below). It cannot run here. `_pair`'s built-in
  branch calls `HPE.pdfdeck.fromBuiltin`, which B2 creates; executing A1 as
  previously written lands a Stage A commit whose own acceptance command errors,
  and `.github/workflows` runs `unittest discover -s tests` as the REQUIRED
  `python suites` check, so that commit would merge red and block Lane B - which
  8.9 schedules to start only after Lane A merges.]**
  **[SECOND BLOCKER FIX, same review: `tests/test_pdf_parity.py` has no
  committed-bytes oracle to re-point and never had one.** `_pair`
  (`tests/test_pdf_parity.py:90-98`) builds BOTH sides fresh into a
  `tempfile.mkdtemp()` - `hifi.build(py_path, ...)` and `_js_pdf(payload,
  js_path, ...)` - and opens no committed PDF anywhere. It is a CROSS-EMITTER
  check (fresh Python vs fresh JS) and is sound as such; `git show HEAD:<pdf>`
  is meaningless to it. The two oracles are distinct and this plan previously
  conflated them:
  **(i) cross-emitter parity** = `test_pdf_parity.py`, fresh vs fresh, no
  committed bytes involved; **(ii) committed-bytes staleness** =
  `test_pdf_build.py`, the only file that uses the six checked-in PDFs as a
  COMPARISON REFERENCE, and therefore the only file `git show HEAD:<pdf>`
  belongs in. (`tests/test_gen_deck.py:85` also opens them, as a before/after
  sha256 guard that needs no change.)**
- **A2.** Create `data/print_overlay.json`: per deck id, the exact literals now
  in `tools/decks.py` - `R`, `cy`, `y_note`, `y_num`, `title`, `credit`,
  `blurb`, `legend_lines`, `legend_demo`, `blank_cards`, and the committed
  three-decimal colour values. Copied verbatim, not re-derived.
- **A3.** `tools/decks.py` reads `data/print_overlay.json` instead of carrying
  the literals inline. The clash guard against `data/decks.json` stays.
- **A4. [AMENDED after independent review - SPLIT IN TWO.]** ~~Extend
  `tools/validate.py` check 1b to assert the overlay file and the built PDFs
  agree.~~ Check 1b cannot read a PDF and is built so that it cannot:
  `tools/validate.py:25` is
  `sys.modules.setdefault("hifi", types.ModuleType("hifi"))`, stubbing the
  build module out before `decks.py` is imported, and its docstring
  (`tools/validate.py:13-15`) says the tool deliberately needs neither the
  `tools/fonts` TTFs nor a build. Check 1b (`tools/validate.py:48-71`) is a
  pure dict-vs-JSON comparison and the file imports no PDF reader at all.
  `tests/CONTRACT.md:128-130` makes the stub a standing contract
  ("**Never `import validate`** from a test"). Extending it as written forces
  either un-stubbing `hifi` or adding `pymupdf` to the `data integrity` CI job,
  which today runs in 13 s with neither - a dependency change this plan does
  not schedule and CLAUDE.md scopes pymupdf to the test suite. So:
  - **A4a (stays in check 1b):** assert the overlay file and `data/decks.json`
    do not clash - an overlay key must never shadow a canonical one. Pure data,
    no PDF, no new dependency.
  - **A4b (moves to `tests/test_pdf_build.py`):** assert the overlay and the
    BUILT PDFs agree. That file already opens PDFs with pymupdf and already
    owns the staleness gate at `:254`.
- **Acceptance [AMENDED by O-2, then CORRECTED after independent review]:**
  `python3 -m unittest tests.test_pdf_parity` green **unchanged** - the two
  generated seeds only, no built-in decks, because `fromBuiltin` does not exist
  until Stage B - AND `python3 -m unittest tests.test_pdf_build` green with its
  references now read from `git show HEAD:<pdf>` (A1/T10), AND
  `python3 tools/validate.py` green with A4a's clash guard.
  **The previous wording was self-contradicting:** it asked for
  `git diff --stat` on the six PDFs to show "only reportlab's creation-date
  churn" while REMOVING the `python3 tools/decks.py &&` prefix that produces
  that churn. With no rebuild the diff is empty and that half of the acceptance
  passes vacuously, including for a Stage A change that mis-transcribed an
  overlay literal. The prefix removal is still correct for the
  committed-bytes check, and it is now unnecessary there as well: once T10 reads
  the reference from `git show HEAD:<pdf>`, a rebuild into the working tree can
  no longer launder a real difference. The rebuild-and-diff step is therefore a
  SEPARATE, explicitly manual acceptance item: run `python3 tools/decks.py`,
  confirm `git diff --stat` shows all six PDFs touched and
  `python3 -m unittest tests.test_pdf_build` still green, then
  `git checkout -- '*.pdf'`.
- **Rollback:** revert the commit; the literals come back.

### Stage B - the JS emitter can build a built-in deck

- **B0. [NEW - moved out of Stage A by independent review.]** Parameterize
  `tests/test_pdf_parity.py` over the three BUILT-IN decks (T9): `SEEDS`
  becomes seeds + built-ins, `_pair` gains a built-in branch calling
  `fromBuiltin`, the glyph-exact assertions apply unchanged. This lands AFTER
  B2 in execution order even though it is numbered before it, exactly as B1
  does - it is the failing test for B2, and it is red until B2 exists. Ordering
  it inside Stage B is the whole point: Stage A must not ship a commit that
  references a function Stage B creates.
- **B1. [AMENDED by E-2 and O-1.]** `tests/pdf_builtin.test.js`: feed a
  built-in deck plus its overlay to a new
  `HPE.pdfdeck.fromBuiltin(deck, overlay)` and assert the returned object
  carries the overlay's `R`, `cy`, `title`, `credit`, `blurb`, `legend_lines`
  and `blank_cards` unchanged - explicitly NOT the synthesized title, and NOT a
  value derived from `geom.ext`. **It must also assert the `fields`+`geom` ->
  `spec`+`_geom` conversion** (E-2): `pdfcards.js:318` reads `spec._geom` and a
  built-in deck has no `spec` at all, so the conversion is the real work and
  nothing else pins it. Also assert `sub` comes from `data/decks.json` (D-8 -
  `ORION` is otherwise lost), **and T15's 96-of-96 `fields`/`roots` loop, which
  lands in this same file. This bullet's list is NOT exhaustive** - section 9.1
  is the authoritative task list. Run it; it fails. **This file SURVIVES the O-1
  amendment** - what O-1 retired was A1/T7's proposed
  `tests/test_seed_pdf_equivalence.py`, a cross-emitter equivalence harness.
  `tests/pdf_builtin.test.js` is a different thing: a JS unit test of
  `fromBuiltin`'s RETURN SHAPE. `test_pdf_parity.py` compares rendered
  glyphs and structurally cannot assert that `spec._geom` exists, so the E-2
  conversion has no other home.
- **B2.** Implement `fromBuiltin` beside `fromGenerated` in
  `src/engine/pdfdeck.js`. It does not touch `fromGenerated`, so the
  `geom.ext` throw at `:161` stays exactly as it is - that throw is a
  deliberate guard and this plan does not weaken it.
- **B3.** `tools/pdf_build.js` gains a `--builtin <deck-id>` mode that reads
  `data/decks.json` + `data/print_overlay.json` and routes through
  `fromBuiltin`.
- **B4. [AMENDED by O-1 and O-2.]** The gate is the PARAMETERIZED
  `tests/test_pdf_parity.py` from **B0** (moved there from A1), run for all
  three decks and both variants. **[CORRECTED after independent review: this
  said "JS emitter output vs the `git show HEAD:<pdf>` reference". That is the
  wrong oracle for this file - `_pair` builds both sides fresh into a tmpdir
  and reads no committed PDF. The gate here is FRESH PYTHON vs FRESH JS, glyph
  for glyph. The committed-bytes comparison lives in `tests/test_pdf_build.py`
  (A1/T10) and is a separate gate.]**
  **This is the gate.**
  Expect D-6-class ordering differences and sub-0.1 pt coordinate drift; expect
  D-1 .. D-5 to be GONE. Any survivor is a bug in `fromBuiltin`, not an
  acceptable delta.
- **B5.** Re-run `python3 tools/inline_engine.py` and commit what it writes.
- **Acceptance [AMENDED]:** `node --test tests/pdf_builtin.test.js`,
  `python3 -m unittest tests.test_pdf_parity`, `python3 tools/validate.py`
  all green.
- **Rollback:** revert; `tools/decks.py` is still the producer.

### Stage C - retire the Python emitter (OWNER GATE)

Only after B4 is green and the owner has eyeballed the side-by-side from
section 5.

- **C0. [ADDED by E-1 and the corrected O-5.]** Inventory everything that
  references `tools/hifi.py` before deleting anything, and classify each
  PORT / RE-POINT / DELETE. The inventory is NOT just `grep -r 'hifi\.'`:
  Measured at `224af5d`: **7 Python modules import `hifi`** (`tools/decks.py`
  10, `tests/test_print.py` 35, `tests/test_render_agreement.py` 46,
  `tests/test_gen_deck.py` 7, `tests/test_pdf_parity.py` 3,
  `tests/test_pdf_build.py` 2, `tests/test_font_subset.py` 1 - **104 `hifi.`
  lines**, 81 of them in the two biggest). **`tests/test_pdf_parity.py` is
  pre-classified PARTIAL-DELETE** (not whole-file DELETE, and not RE-POINT)
  **[CORRECTED AGAIN after independent review - the previous text said
  DELETE, whole file, justified as "it is the cross-emitter harness, so it
  has no meaning with one emitter". That justification is FALSE for part of
  the file.]**. Three of its four tests are cross-emitter and die with the
  second emitter; **exactly one method, `_pair` (`:90-98`), touches `hifi` at
  all** (`:96`). `test_a4_is_letter_shifted_on_the_page` (`:120-148`) is
  JS-ONLY - it calls `_js_pdf(payload, a, paper="letter")` and
  `_js_pdf(payload, b, paper="a4")` and never calls `hifi.build`. It asserts
  a property of the SURVIVING emitter (A4 output is Letter re-centred, not
  rescaled, so the 62.65 x 87.21 mm card is preserved), and it lives in this
  file only because the `_js_pdf`/`_glyphs`/`_generate` helpers (`:46-87`) do.
  `test_the_sweep_actually_ran` (`:100-102`) is likewise a bare assertion on
  `SEEDS`. **C3 must therefore relocate the JS-only tests and those three
  helpers into a surviving Python file that does not import `hifi`** - a new
  `tests/test_pdf_js.py` - and delete only the cross-emitter remainder.
  Its incidental exercise of `decks.py:245`'s clash
  guard survives in `tests/test_pdf_deck_adapter.py`, which also calls
  `from_generated` and does not import `hifi`. several JS and doc files
  (`src/engine/pdfcards.js`, `pdf.js`, `pdfdeck.js`) cite `tools/hifi.py`
  only in comments that go stale - but `tests/CONTRACT.md:131` and `:133` are
  NOT comments-that-go-stale: they state behavioural contracts (`hifi.build()`
  rebinds `BLUE`/`GREEN`; `hifi.tracked()` draws one `drawString` per glyph)
  that DIE with `hifi.py` rather than merely going out of date, so C3 must
  retire them, not reword them **[ADDED after independent review; C0's
  inventory task covers this]**; three more
  (`tools/inline_fonts.py`, `tools/validate.py`, `tests/test_deck_data.py`)
  reference it by path, which is E-1's ten-file / 108-reference count; AND
  **16 patch files under `tests/mutants/` actually patch `tools/hifi.py`**.
  **[CORRECTED after independent review: this said 19, the raw count from
  `grep -l 'tools/hifi.py' tests/mutants/*.patch`. That grep OVER-matches by
  three, because it also hits patches whose diff CONTEXT lines carry a
  `tools/hifi.py:NNN-NNN` provenance comment inside the file they really
  patch. The three context-only matches are
  `g_pdfcards_a4_rescales.patch` (patches `src/engine/pdfcards.js`),
  `d_esc_attr_leaves_quote.patch` and `p_print_wide_gutters_zeroed.patch`
  (both patch `index.html`). All three target files that SURVIVE Stage C -
  and section 8.7 leaves `index.html` alone entirely - so retiring them
  because they matched the path grep destroys live coverage. The reliable
  test is `grep -q '^diff --git a/tools/hifi.py'`, not a bare path grep.]**
  **None of those 16 contains a single `hifi.`
  attribute access** - only `tools/hifi.py` in the diff headers - so an
  attribute grep misses every one of them and a path grep alone, uncorrected,
  is not the inventory either. (Three OTHER patches do mention `hifi.build` /
  `hifi.slots` in patched comment text - `c_gen_omitted_vacuous`,
  `p_full_deck_loses_its_blank_templates`, `p_print_grid_wide_row_gap` - and
  none of those three is among the 19.) **A third inventory is required, and neither grep above
  produces it: which mutants name a test file Stage C DELETES in their
  `# suite:` header.** Run `grep -l '^# suite:.*test_pdf_parity'
  tests/mutants/*.patch` - exactly one today,
  `g_pdfcards_a4_rescales.patch`, whose `# kills:` header names
  `test_a4_is_letter_shifted_on_the_page`. That patch is the reason
  `tests/test_pdf_parity.py` is PARTIAL-DELETE above, and its `# suite:`
  header must be re-pointed at the relocated test's new home in the same
  commit. Left alone it HARD-ABORTS the gate rather than merely failing it:
  `git apply --check` PASSES (the patch targets `src/engine/pdfcards.js`,
  which Stage C does not touch, so it is never reported `stale`), and then
  `baseline_ok "python3 -m unittest tests.test_pdf_parity"` raises
  `ModuleNotFoundError` on the CLEAN tree, which
  `tests/mutation_check.sh:224-238` turns into `ABORTING - BASELINE NOT
  GREEN ... exit 4` - so every mutant after it is never evaluated and the
  check reports nothing at all. The mutation gate is a required CI
  check; dead or orphaned patches turn it red. See T1 and T14.
- **C1. [AMENDED by the corrected O-5 - see C-1a below.]** Port the assertions
  that die with `hifi.py` - the 3.6 pt print floor
  over every drawn glyph (`test_no_label_falls_below_the_print_floor`), and
  `hifi.fit_note`'s overflow shrink - into the JS suite. **Port before delete.**
- **C2.** Replace `tools/decks.py`'s build path with a call into
  `tools/pdf_build.js --builtin`. Keep the entry point
  (`python3 tools/decks.py` still builds all six) so no documentation or
  muscle memory breaks.
- **C3. [AMENDED by E-6 and the corrected O-5.]** Delete `tools/hifi.py`.
  **`tests/test_render_agreement.py` is RE-POINTED at `pdfcards.js`, never
  deleted** - its premise is app-SVG vs print-PDF with opposite y axes, which
  survives `hifi.py`'s removal (E-6). Keep every assertion that pins a
  renderer to the SPEC, and note that includes the **non-text** ones
  (`test_print.py:574`, `:611-632`; `test_render_agreement.py:245-302`;
  `test_pdf_build.py:83-98`, `:151-190`): they exist, they are written against
  `hifi.py`, and re-pointing them (**C-1a / T11a**) is a hard precondition on
  this step.
- **C4.** Update `CLAUDE.md`'s "Print pipeline" section and `README.md`.
  Drop the `reportlab` requirement if nothing else uses it. **Something else
  does** - see the acceptance note below - so as scheduled, C4 updates the docs
  and the requirement STAYS.
- **Acceptance [CORRECTED after independent review - the previous text was
  unachievable]:** ~~a clean clone with no `reportlab` builds all six PDFs and
  the equivalence harness passes against the committed bytes.~~ Deleting
  `tools/hifi.py` does not drop the `reportlab` dependency, because
  `hifi.py` is not its only importer. Four survive C3:
  `tools/decks.py:7` (`from reportlab.lib.colors import Color`) -
  and C2 explicitly KEEPS `tools/decks.py` as the entry point -
  `tests/test_print.py:18` and `tests/test_font_subset.py:22`
  (`from reportlab.pdfbase import pdfmetrics`), and transitively
  `tools/validate.py`, whose `import decks as D` pulls `decks.py` in and whose
  own docstring at `:13` says "Needs reportlab (for the Color class in
  decks.py)". So the REQUIRED `data integrity` CI check still needs reportlab
  after Stage C. An engineer who completes C0-C4 and then runs the old
  acceptance on a clean clone gets `ModuleNotFoundError: No module named
  'reportlab'` from `tools/decks.py:7` before a single PDF is built.
  **The acceptance is therefore:** a clean clone builds all six PDFs with
  `tools/hifi.py` deleted, and `tests/test_pdf_build.py`'s committed-bytes
  gate (T10, reading its reference with `git show HEAD:<pdf>`) passes.
  **[CORRECTED AGAIN after independent review - the previous wording, "and
  the cross-emitter harness passes", was itself unachievable.]** The
  cross-emitter harness is `tests/test_pdf_parity.py` (section 6's oracle
  (i)), and it CANNOT survive C3: `:26` is a module-level `import hifi` and
  `:96` calls `hifi.build`, so with `tools/hifi.py` deleted the required
  `python suites` check fails at COLLECTION, not on an assertion. Glyph
  parity is an oracle Stage C **spends**, not one it keeps - it is the gate
  for Stage B (B4), and Stage C's whole premise is that there is no longer a
  second emitter to be parity with. C0 therefore pre-classifies
  `tests/test_pdf_parity.py` as **DELETE**, not RE-POINT, and C-1a's port of
  the Python-side spec assertions (T11a) is what carries the value forward.
  T11b, which extends `test_pdf_parity.py`, is explicitly NOT a precondition
  and dies with it if it has not landed by C3.
  Dropping reportlab entirely is a SEPARATE, UNSCHEDULED piece of work
  (re-point `decks.py`'s `Color`, `test_print.py`'s and
  `test_font_subset.py`'s `pdfmetrics`, and `validate.py`'s `hexc()` path);
  it is not in C0-C4 or T1-T15 and must not be claimed as a Stage C benefit.
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
| Q2 | Deck name on every card: keep `F3 LOW PYGMY 18` / `D AMARA 9` / `C# HIJAZ 9` plus hijaz's `C# HIJAZ / ORION` credit, or accept `F AEOLIAN 12` / `D AEOLIAN 9`? | **Keep the hand-written names.** The auto-name describes the scale, not the instrument. |
| Q3 | Amara scale degrees: keep `bIII` / `bVII` / `IV` from `data/decks.json`, or accept the engine's `III` / `VII` / `iv`? | **Keep `data/decks.json`.** CLAUDE.md fixes Amara's degrees as `{D:i, A:v, G:IV, C:bVII, F:bIII}`; the engine's derivation disagrees with the documented ground truth and that disagreement is worth a separate queue row. |
| Q4 | Pygmy's 7 blank cards (the 7th page): keep or drop? | **Keep.** It is a stated owner preference and costs one sheet. |
| Q5 | Does the Python emitter get deleted (Stage C) or kept as a second opinion (stop after B)? | **[AMENDED by O-7 - the original recommendation is struck.]** ~~Delete, after C1's port. Stopping after B leaves two emitters plus a third artifact (the overlay), which is worse than today.~~ Stopping after B is NOT worse than today: it converts today's duplication into a differential oracle, which is exactly what `tests/test_pdf_parity.py` already exploits. **Score both sides.** DELETE costs T11a (re-point the Python-side non-text assertions) + T14 (16 mutant patches + 1 orphaned suite header) + O-3's ~1900-line port, and buys one PDF EMITTER. **[CORRECTED after independent review: this said DELETE "buys one implementation and no `reportlab` dependency". The reportlab half is false - `tools/decks.py:7`, `tests/test_print.py:18`, `tests/test_font_subset.py:22` and (transitively) `tools/validate.py` all import reportlab and all survive C3, and C2 keeps `decks.py` as the entry point. reportlab REMAINS a dependency unless separate, currently unscheduled work re-points those four. Q5 is the plan's one-way door, so it must not be scored on a benefit it does not buy.]** KEEP costs carrying ~1900 lines of Python nobody edits, and buys a second implementation that catches what no single-emitter assertion can. Owner call, one-way door. |

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
draft are throwaway. **[AMENDED by O-1: the original sentence, ~~"Stage A1
replaces them with `tests/test_seed_pdf_equivalence.py`, which is the durable
form"~~, is superseded. That file is never created.]** The durable form is the
PARAMETERIZED `tests/test_pdf_parity.py` (T9), which already compares every
glyph across both emitters. **[CORRECTED after independent review: this said
it "only needs the three built-in decks added to its `SEEDS` list". Three more
edits are required, all specified elsewhere in this plan or verified against
the file: `_pair` gains a built-in branch calling `fromBuiltin` (B0); the
shop-variant test at `tests/test_pdf_parity.py:114-118` gains a `subTest`,
having none today (T9's verify); and `_pair`'s PYTHON side must stop calling
`decks.from_generated(payload)` (`tests/test_pdf_parity.py:92`) for a built-in
and take `decks.HIJAZ`/`PYGMY`/`AMARA` instead, or it carries no overlay.]**

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

`tests/test_pdf_build.py:111` is `cls.returned[key] = hifi.build(path, deck,
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
`pdfdeck.js:177-179` computes `sub` from zone counts instead, giving
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
| D-8 | **Deck subtitle on the title card.** Committed hijaz `ORION  -  8 + 1` (`data/decks.json`); emitter computes `8 + 1` (`pdfdeck.js:177-179`), drawn at `pdfcards.js:477`. | title card, full variant | **NO.** Same loss as D-2. Fixed by reading `sub` from canonical data. |

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
that test should gain a mirror assertion for `fromBuiltin`. **[CORRECTED
after independent review: this previously read "or it goes red on B2", which
it cannot - `_js_adapt` (`tests/test_pdf_deck_adapter.py:57`) shells out to
`tools/pdf_adapt.js`, whose `:12` calls `fromGenerated` ONLY, and B2 does not
touch `fromGenerated`. The sub-step below is still worth doing; the forcing
reason was wrong.]**
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
path; the only measurable cost is suite runtime. **[AMENDED: this rationale
originally rested on E-7's shared build helper, which O-1 superseded - with
no new test file there is nothing to share a helper with. The cost is bounded
instead by measurement, not by sharing: `_pair`
(`tests/test_pdf_parity.py:90-98`) is a plain helper, not a fixture - it
`mkdtemp()`s and builds two PDFs on EVERY call, and the file has no
`setUpClass` - so T9's six subTests add 12 PDF builds, not zero. Measured, the
whole file still runs in 1.7 s. **[CORRECTED after independent review: this
previously claimed `_pair` was a reused fixture. The conclusion holds; the
stated reason was wrong.]**]** Nothing here touches an N+1, a cache or a hot loop.

### 8.5 Test coverage of the planned work

```
CODE PATHS                                             USER FLOWS
[+] src/engine/pdfdeck.js                              [+] Owner rebuilds the six PDFs
  +- fromBuiltin(deck, overlay)          <- NEW          +- [GAP] `python3 tools/decks.py`
  |   +- [GAP] overlay passthrough (B1)                  |    still emits all six (C2)
  |   +- [GAP] spec/_geom conversion (E-2)               +- [GAP] clean clone, no hifi.py (C3)
  |   +- [GAP] sub from decks.json (E-3)               [+] Print shop receives PRINTER_ONLY
  |   +- [GAP] blank_cards carried (E-5)                 +- [*** ] crop marks + calib bar
  |   +- [GAP] missing overlay -> throw                  |     - tests/test_pdf_build.py
  +- fromGenerated                       <- UNCHANGED    +- [GAP] 3.6pt floor in JS (C1)
      +- [GAP ] geom.ext throw (pdfdeck.js:161) - UNCOVERED; the only ext
      |          test is test_gen_deck.py:341, a PYTHON KeyError [+] Custom-deck user (regression)
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
      +- [GAP] overlay-vs-decks.json clash (A4a)
[+] tests/test_pdf_build.py              <- EXTENDED
      +- [GAP] overlay drift vs built PDFs (A4b)
      +- [GAP] reference read from git show HEAD (T10)

COVERAGE: 3/21 paths tested (14%)   |   GAPS: 18, all inside this plan's own stages
QUALITY: ***:1  **:2  *:0
```

Every gap above is work this plan already schedules, except four that it does
not and that are added here as **CRITICAL - error paths with no handling and
no test**: overlay file absent, overlay id unknown to `data/decks.json`,
`--builtin` given an unknown deck id, and `fromBuiltin` called without an
overlay. All four are silent-wrong-output risks rather than crashes (a
missing `ext` used to fall back to 1.0, giving every deck R = 74.0 - and,
**on a bottom-shell pan**, drawing the diagram over the header and off both
card edges (the R = 74.0 half is universal, the overdraw half is not; see the
comment at `pdfdeck.js:156-159`) - the failure
`pdfdeck.js:160-162` exists to prevent **[CORRECTED: previously "a missing
`R` draws a 1.0-radius pan", which inverts both the missing key and the
direction of the error; see the comment at `pdfdeck.js:156-159`]**), so each gets an explicit throw plus a test in its own stage.
**Decision (auto): adopt** - the four throws land in A3, A3, B3 and B2
respectively.

**[AMENDED after independent review: the tree above now splits A4 into A4a
(`tools/validate.py` check 1b, overlay vs `data/decks.json` - pure data) and
A4b (`tests/test_pdf_build.py`, overlay vs the built PDFs). Check 1b stubs
`hifi` out at `tools/validate.py:25` and imports no PDF reader, so the
PDF-reading half was never implementable where it was scheduled.]**

### 8.6 Failure modes

| new codepath | realistic production failure | test? | handled? | silent? |
|---|---|---|---|---|
| `fromBuiltin` spec conversion | a field's angle lands at the wrong tuple index; the pan draws rotated | after E-2 | no throw possible - values are all valid | **yes, until B4** |
| overlay file missing | `tools/decks.py` KeyErrors, or worse defaults `R` to a falsy 0 | after 8.5 | after 8.5 | was yes |
| built PDFs drift from the overlay | a hand-edited PDF ships | A4b | A4b | was yes |
| overlay drifts from `data/decks.json` | colours or degrees disagree between app and print | A4a | A4a | was yes |
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
| `tests/test_pdf_build.py:254` committed-vs-fresh staleness gate | Not as drafted. **[AMENDED: this cell credited E-7's shared build helper, superseded by O-1 - there is no new file to share one with. T9 reuses `test_pdf_parity.py`'s `_pair` helper instead (**not a fixture** - see 8.4).]** |
| `tests/test_pdf_deck_adapter.py:99` JS-vs-Python adapter parity sweep | Not named in the plan. E-5 folds it in. |
| `src/engine/pdfcards.js:156` `fitNote`, `:124` 3.6 pt floor | C1 asked to port them; they exist. E-4 corrects. |
| `src/engine/pdfcards.js:516,552` blank-card rendering and `deck.blank_cards` | Yes, implicitly - the renderer already honours the key, so D-4 dissolves with the overlay and needs no renderer change. |
| `src/engine/fontdata.js` - all five faces (Marcellus, Bitter R/B, NunitoSans R/SB) | Yes. Verified: the JS side embeds the same five fonts `tools/hifi.py:16-20` registers. No font work in this plan. |
| `tools/pdf_build.js`, `tools/gen_deck.js`, `tools/pdf_adapt.js` | Yes - B3 extends `pdf_build.js` rather than adding a tool. |

### 8.9 Parallelization

| step | modules touched | depends on |
|---|---|---|
| A1 | `tests/` | - |
| A2, A3, A4a | `data/`, `tools/` | A1 |
| A4b | `tests/` | A2 |
| B0, B1, B4 | `tests/` | A2 |
| B2, B3 | `src/engine/`, `tools/` | A2 |
| B5 | `index.html` (generated region) | B2 |
| C0 | `docs/` (inventory only) | B4 |
| C1..C4 | `tests/`, `tools/`, `src/engine/`, docs | C0 |

Lane A: A1 -> A2 -> A3 -> A4 (sequential, shared `tools/`).
Lane B1: B2 -> B3 -> B5 (sequential, shared `tools/` + `src/engine/`; B5
re-runs `python3 tools/inline_engine.py`, without which `tools/validate.py`
check 4 reds on the inlined `<!-- engine:pdfdeck -->` region).
Lane B2: B0 -> B1 -> B4 (`tests/` only, written against the not-yet-existing
flag; B0 and B1 are both RED until B2 lands).
Lanes B1 and B2 run in parallel after A merges; both land before C.
**Conflict flag:** Lane A and Lane B1 both touch `tools/` - A must merge first,
which the ordering already enforces. Stage C is single-lane by construction
(it deletes across every boundary at once).

### 8.10 Implementation tasks

Synthesized from the findings above. Each derives from a specific finding.

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** - Stage C - add step C0, the `hifi.py` dependent inventory
  - Surfaced by: E-1 - ten files reference `hifi.`, C3 names one; corrected O-5 - an attribute-only grep also misses the mutant patches
  - Scope: BOTH `grep -rn 'hifi\.'` (104 lines across the 7 Python importers, plus stale `tools/hifi.py` citations in JS comments and `tests/CONTRACT.md`) AND `grep -l 'tools/hifi.py' tests/mutants/*.patch` (19 files, zero attribute references)
  - Files: `docs/plans/2026-09-22-seed-pdf-one-source.md`
  - Verify: the C0 table lists all ten source files plus all 19 patches, each classified PORT/RE-POINT/DELETE, plus `tests/CONTRACT.md:131` and `:133` (behavioural contracts that DIE with `hifi.py`, not comments that go stale) and the stale `tools/hifi.py` citations in the JS comments - C0 requires all three and this verify line previously omitted them
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
given the plan and the repo and told to challenge it. Eight findings. One
of them is labelled NEW - a thing the in-context review missed **[CORRECTED
from "Two of them are labelled NEW": only O-6 carries `[P2, NEW]`]** - and two
are hard blockers. One of the eight (O-5) turned out to be FALSE and was
corrected after an independent review; it is kept below with the correction
in place rather than deleted, because the correction is the finding.

**O-1 [BLOCKER, verified] - the plan proposes a weaker duplicate of an oracle
the repo already has.** `tests/test_pdf_parity.py:104-118` already renders one
deck through BOTH `hifi.build` and `tools/pdf_build.js` and asserts **every
glyph - x, y, size and character, page by page**
(`test_every_glyph_lands_where_print_puts_it`, `:104-112`). Scope, precisely:
the `full` variant runs over both entries of `SEEDS` (`:40-43`), one of them
a bottom-shell pan; the `shop` variant
(`test_the_shop_variant_matches_too`, `:114-118`) runs `SEEDS[0]` only - the
Amara string, no bottom shell. Section 2 re-derived at token
granularity something already pinned glyph-exactly, and A1 then proposes
token lists plus "largest drawn circle radius per card" and B4 calls that
"the gate". Confirmed by reading the file.
**Decision (auto): adopt.** A1 is rewritten: **parameterize
`tests/test_pdf_parity.py` over the three BUILT-IN decks** rather than
creating `tests/test_seed_pdf_equivalence.py`. Its `SEEDS` list becomes
seeds + built-ins, `_pair` gains a built-in branch calling `fromBuiltin`, and
the glyph-exact assertions apply unchanged. This supersedes E-7 above (which
proposed a shared build helper for a new file that now does not exist) and
retires the new-file half of **T7** **[CORRECTED from "T2": T2's
`tests/pdf_builtin.test.js` stands; see section 9.1]**. The token-list harness is dropped entirely -
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
acceptance commands drop the `python3 tools/decks.py &&` prefix. **[CORRECTED after independent review - this block previously said
`tests/test_pdf_build.py:254 test_committed_pdfs_match_a_fresh_build` "is not
affected". It is the ONLY file affected.]** That test builds into a tmpdir but
takes its REFERENCE from `os.path.join(paths.ROOT, paths.PDFS[key])`
(`tests/test_pdf_build.py:262`) - a working-tree path that
`tools/decks.py:409` overwrites - so it is exactly the gate T10 re-points at
`git show HEAD:<pdf>`. Reading the old exemption and skipping T10 leaves Stage
A's own manual acceptance vacuous: `python3 tools/decks.py` overwrites the six
reference files, the test compares a fresh build against itself, and a
mis-transcribed overlay literal in `data/print_overlay.json` passes green.

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

**O-5 [P1, CORRECTED after independent review] - the non-text drawing
assertions exist, they all live on the Python side, and Stage C kills them.**

The outside voice claimed nothing anywhere compares non-text drawing, and this
review adopted that claim. **It is false, and an independent reviewer caught
it.** The assertions exist:

- `tests/test_print.py:611-632`
  `test_highlight_band_sits_between_the_outline_and_the_hairline` pins the
  band radius between the outline and the hairline AND checks
  `band["r"] +/- band["line_width"]/2` against both - the band, the hairline
  and the band's stroke width, all three.
- `tests/test_print.py:574`
  `test_state_selects_root_or_tone_colour_but_never_both` pins the ring
  colours.
- `tests/test_render_agreement.py:245-302` `BorderAgreementTest`. At `:252`
  `test_print_frame_is_a_single_root_coloured_band` asserts the print frame
  draws exactly one fill colour across its full width and that it is the root
  colour; at `:283` print's border weight is pinned at 2.8 pt. Note what
  `:279-300` actually compares: print pt against app css px is meaningless
  (its own docstring says so), so it pins only the RELATIVE growth of each
  renderer's own weight - the 2.8 pt literal is print-side.
  Its docstring says it was
  written for exactly this gap: "Nothing pinned this before ... so the
  two-tone split could (and did) ship unnoticed".
- `tests/test_pdf_build.py:83-98` and `:151-190` measure the crop-mark tick
  length (`SPEC_CROP_MARK` 8.0), the inset, the count and spacing, and the
  calibration bar's ACTUAL drawn length off the path segments against
  `SPEC_CALIBRATION` 144.0.
- The **mutation gate**, a required CI check, kills
  `tests/mutants/c_draw_ring_band.patch` (0.87 -> 0.80) and
  `c_draw_ring_swap_colours.patch` today.

Section 8.5's own coverage tree already credited `[***] crop marks + calib bar
- tests/test_pdf_build.py`, so this document contradicted itself six pages
apart. Recorded as a defect of this review, not of the plan.

**The true and narrower claim.** Every one of those assertions is written
against `tools/hifi.py`, and `test_print.py` alone carries 35 `hifi.`
references. They do not die because nothing pins the drawing - they die
because C3 deletes the implementation they are written against. And
separately, nothing compares non-text drawing **across the two emitters**:
`test_pdf_parity.py` compares glyphs only, so a colour or stroke-width
divergence between `hifi.py` and `pdfcards.js` is invisible to it today.

**Decision (auto, revised): two separate items, and only the first gates C.**

- **C-1a (hard precondition on C, and it is the E-6 treatment, not new
  work):** re-point the existing non-text assertions above at
  `src/engine/pdfcards.js`. They are spec assertions with concrete numbers -
  0.87r, 0.74r, 2.8 pt, 8.0 pt, 144.0 pt - so re-pointing is mechanical and
  costs far less than writing a drawing-operator differ. This is the same
  move C3 already needs for `test_render_agreement.py`.
- **C-1b (NOT a precondition; worth doing, schedule separately):** extend
  `test_pdf_parity.py` from glyphs to drawing operators, which closes the
  cross-emitter gap that is genuinely open today. Valuable while both
  emitters exist; strictly optional once only one does.

The original framing - "C-1 or stop after B" - overstated the risk and
mispriced the fix. Stage C's real non-text cost is re-pointing a known list
of assertions, not building a new differ.

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
C buys the deletion of **541 lines of Python** (`tools/hifi.py`), **[CORRECTED TWICE: from "~950 lines", which was `hifi.py` 541 + `decks.py` 418, since C2 explicitly KEEPS `tools/decks.py` as the entry point; and again after independent review, which struck "and the `reportlab` dependency" - four other importers survive C3, so the dependency stays. See Stage C's amended acceptance.]**,
paid for with O-3's port, which includes re-pointing the non-text
assertions of O-5.
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
`tests/test_pdf_parity.py:104-118`. **Resolution: O-1 wins; E-7 is
superseded.** The lesson is the one this workstream keeps re-learning - grep
the test suite for the oracle before writing one.

**T-b - whether Stage C should happen at all.** The plan recommends Option 2
staged, with C behind an owner gate. The outside voice recommends rescoping
to A+B and re-deciding C on its own merits. These are closer than they look:
both put C behind a decision. The genuine disagreement is about what that
decision costs, and the outside voice priced it better - O-3's 1900 lines and
O-5's re-pointing work are both absent from section 3's cost column. **Resolution: the recommendation in section 1 stands (staged, C
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
| 2b. A+B+C (retire Python) | 2a **plus ~1900 lines ported across ten files (108 `hifi.` references), including 16 mutant patches + 1 orphaned suite header** | **permanent: every Python-side spec assertion must be re-pointed first (C-1a) or it is lost** | **the re-pointed spec assertions + the committed-bytes gate. NOT glyph parity** - `tests/test_pdf_parity.py` imports `hifi` and dies with it (see Stage C acceptance) |
| 3. keep both, document | zero | none | unchanged |
| 4. generated-only, drop seeds | low | **loses the print overlay entirely** | n/a |

### 9.1 Implementation tasks, amended after the outside voice

T1..T8 in section 8.10 stand except where noted; T9..T15 are new (T11 was
later split into T11a and T11b; T14 came out of the O-5 correction, and T15
out of the corrected D-6).

- **T2 stands as written. [CORRECTED - this bullet previously said the
  spec/_geom assertions move into `tests/test_pdf_parity.py` and that
  `tests/pdf_builtin.test.js` is not created. That was wrong, and it
  contradicted Stage B1, Stage B acceptance, T2 and T3.]** O-1 retired
  A1/T7's proposed `tests/test_seed_pdf_equivalence.py`, not T2's file. The
  two differ in kind: the parity test compares rendered glyphs across
  emitters and cannot assert that `spec._geom` exists on the object
  `fromBuiltin` returns, which is exactly what E-2 calls the real work.
  `tests/pdf_builtin.test.js` is created, and T3's `sub` assertion lands in
  it too. **Decision (auto, AFK):** keep the JS unit test - dropping it
  would leave E-2's conversion, the step Stage B rests on, pinned by
  nothing.
- **T7 superseded by T9.** No new equivalence file is created.
- [ ] **T9 (P1, human: ~3h / CC: ~25min)** - parameterize `tests/test_pdf_parity.py` over the three built-in decks
  - Surfaced by: O-1 - `:104-118` already asserts every glyph, page by page
  - Files: `tests/test_pdf_parity.py`
  - Verify: `python3 -m unittest tests.test_pdf_parity -v` shows six new subTests. Note this also requires adding a `subTest` to the shop-variant test (`tests/test_pdf_parity.py:114-118`), which uses none today - as written the count would come up short
  - **Lands in Stage B0, not Stage A** (independent review): it calls `fromBuiltin`, which B2 creates
- [ ] **T10 (P1, human: ~1h / CC: ~10min)** - every COMMITTED-BYTES reference comes from `git show HEAD:<pdf>`, never the working tree
  - Surfaced by: O-2 - `tools/decks.py:409` writes into the repo root
  - Files: **`tests/test_pdf_build.py`** (`test_committed_pdfs_match_a_fresh_build`, `:254`, which opens `os.path.join(paths.ROOT, paths.PDFS[key])`), and the Stage A/B/C acceptance commands in this plan
  - **[CORRECTED after independent review: this named `tests/test_pdf_parity.py`. That file has no committed-bytes reference to re-point - `_pair` (`:90-98`) builds both sides fresh into a tmpdir. `tests/test_pdf_build.py` is the only file in the repo that uses the six checked-in PDFs as a comparison reference; `tests/test_gen_deck.py:85` opens them too, but as a before/after sha256 guard needing no change.]**
  - Verify: `python3 tools/decks.py && python3 -m unittest tests.test_pdf_build` goes RED on a deck-data change that was not re-committed. **The old verify step - "RED after `touch`-editing a committed PDF and rebuilding" - was unachievable by its own remedy:** a reference read from `git show HEAD:<pdf>` is by construction immune to a working-tree edit, so that check can never go red and an engineer following it would see green whether or not the task was done
- [ ] **T11a (P1, human: ~3h / CC: ~30min)** - C-1a: re-point the Python-side non-text assertions at `pdfcards.js`
  - Surfaced by: O-5 (corrected) - those assertions EXIST (`test_print.py:574`, `:611-632`; `test_render_agreement.py:245-302`; `test_pdf_build.py:83-98`, `:151-190`) but are written against `hifi.py`
  - Files: `tests/test_print.py`, `tests/test_render_agreement.py`, `tests/test_pdf_build.py`
  - Verify: the four named tests pass with `hifi.py` absent
  - Hard precondition on C3
- [ ] **T11b (P2, human: ~1d / CC: ~1h)** - C-1b: extend `test_pdf_parity.py` from glyphs to drawing operators
  - Surfaced by: O-5 (corrected) - nothing compares non-text drawing ACROSS the two emitters; not a precondition on C
  - Files: `tests/test_pdf_parity.py`
  - Verify: flipping one colour literal in `tools/hifi.py` turns it red
- [ ] **T12 (P2, human: ~2h / CC: ~20min)** - D-9: compare embedded font programs across the two emitters
  - Surfaced by: O-6 - subsetting is untested across the boundary and the artifact goes to a print shop
  - Files: a one-off measurement, recorded in section 2b as D-9
  - Verify: face names, glyph counts and subset structure recorded for one deck, both emitters
- [ ] **T13 (P3, human: ~30min / CC: ~5min)** - A3 re-runs the data mutants; C4 documents the node dependency
  - Surfaced by: O-8
  - Files: `tools/regen_data_mutants.py` output, `CLAUDE.md`, `README.md`
  - Verify: `python3 tools/validate.py` clean on a clean tree
- [ ] **T14 (P1, human: ~2h / CC: ~30min)** - retire or re-target the **16** `tests/mutants/*.patch` files that patch `tools/hifi.py`, and re-point the **1** that names a deleted suite
  - Surfaced by: corrected O-5, then **corrected twice more by independent review**. `grep -l 'tools/hifi.py' tests/mutants/*.patch` returns 19, but only **16** carry `^diff --git a/tools/hifi.py`; the other three (`g_pdfcards_a4_rescales`, `d_esc_attr_leaves_quote`, `p_print_wide_gutters_zeroed`) match only on a `tools/hifi.py:NNN-NNN` provenance comment in their diff CONTEXT and actually patch `src/engine/pdfcards.js` and `index.html`, all of which SURVIVE Stage C. Retiring those three destroys live coverage, two files of it in `index.html`, which section 8.7 leaves alone
  - **Separate and not covered by either grep:** `grep -l '^# suite:.*test_pdf_parity' tests/mutants/*.patch` returns `g_pdfcards_a4_rescales.patch`, whose `# kills:` header names `test_a4_is_letter_shifted_on_the_page`. C0's PARTIAL-DELETE relocates that test into `tests/test_pdf_js.py`; this patch's `# suite:` header must be re-pointed there IN THE SAME COMMIT. Left alone it does not merely fail the gate, it HARD-ABORTS it: `git apply --check` passes (it targets a surviving file, so it is never `stale`), then `baseline_ok` raises `ModuleNotFoundError` on the clean tree and `tests/mutation_check.sh:224-238` exits 4 with every later mutant unevaluated
  - Files: the 16 `tools/hifi.py` patches (incl. `c_draw_ring_band`, `c_draw_ring_swap_colours`, `c_fit_floor`, `c_card_width`, `c_note_line_order`, `c_tracked_advance`, ...), plus `g_pdfcards_a4_rescales.patch`'s header only, `tests/mutation_check.sh`
  - Verify: `bash tests/mutation_check.sh` green (**not exit 4**) with `tools/hifi.py` absent; `d_esc_attr_leaves_quote` and `p_print_wide_gutters_zeroed` still present and still killed; and every patch that encoded a live spec rule has an equivalent patch against `src/engine/pdfcards.js`
  - Hard precondition on C3, same as T11a
- [ ] **T15 (P1, human: ~3h / CC: ~30min)** - the built-in path must READ `chords[].fields` from `data/decks.json`, never re-derive the voicing
  - Surfaced by: the corrected D-6 - the engine's register tie-break derives Pygmy `Fm9` as `fields [5,7,8,9,6]` (`G4`) where the committed deck has `[5,7,8,9,11]` (`G5`). One card of 96, but it changes the printed note line and number line, and `CLAUDE.md` names that card as ground truth.
  - Files: `src/engine/pdfdeck.js` (`fromBuiltin`), `tests/pdf_builtin.test.js`
  - Verify: for all three built-in decks, every card's `fields` and `roots` from the built-in path equal `data/decks.json` byte for byte - 96 of 96, not 95. Assert it as a loop over all three decks, not a spot check on `Fm9`, so the next tie-break change is caught too.
  - **Hard precondition on Stage B.** Stage A's goal is "nothing about the PDFs changes"; without T15, Stage B ships a Pygmy card that prints `G4 / 6` where the committed PDF prints `G5 / 11`.
  - Explicitly NOT in scope: changing the engine's register tie-break itself. That is owner decision D11 in `docs/SCALE_ENGINE_PLAN.md` and governs GENERATED decks, which have no committed data to disagree with.


---

## GSTACK REVIEW REPORT

| field | value |
|---|---|
| Review | `/plan-eng-review` on `docs/plans/2026-09-22-seed-pdf-one-source.md` |
| Trigger | owner: "run the plan with that prompt" (AFK armed) |
| Why | the plan proposes deleting one of two independent PDF implementations; the cost of that deletion is the whole question |
| Runs | 4 sections (architecture, code quality, tests, performance) + outside voice (fresh Claude subagent; codex `model_unusable`) |
| Status | **REVISE BEFORE EXECUTING** - Stage A cannot run as written |
| Findings | 15 (E-1..E-7 in-context, O-1..O-8 outside voice). 2 blockers, 5 P1, 7 P2, 1 P3. |
| Correction | O-5 was WRONG as first written and was rewritten after an independent review of this document. See the O-5 block and the paragraph below. |

**VERDICT: REVISE.** The recommendation in section 1 survives - Option 2,
staged, Stage C behind an owner gate - but Stage A cannot execute as written.
Two blockers: A1 proposes a token-granularity harness that is strictly weaker
than `tests/test_pdf_parity.py:104-118`, which already asserts every glyph
position, size and character page by page across both emitters (O-1); and
every acceptance command prefixed with `python3 tools/decks.py &&` compares
the fresh build against the committed file it just overwrote, because
`tools/decks.py:409` writes into the repo root (O-2). Both are fixed above:
A1 becomes "parameterize the existing parity test over the three built-in
decks", and every reference comes from `git show HEAD:<pdf>`.

**O-5, corrected.** As first written this review claimed the non-text drawing
- colours, stroke widths, the 0.87r band, the 0.74r hairline, the four-sided
frame, the crop marks and the calibration bar - was pinned by nothing. **That
was false**, and an independent review of this document caught it. Those
assertions exist: `tests/test_print.py:611-632` pins the band between the
outline and the hairline including its stroke width, `:574` pins the ring
colours, `tests/test_render_agreement.py:252` pins the frame as a single
root-coloured band and `:283` pins print's 2.8 pt weight, `tests/test_pdf_build.py:83-98` and `:151-190`
measure the crop-mark ticks and the calibration bar's drawn length against
`SPEC_CROP_MARK` and `SPEC_CALIBRATION`, and the mutation gate kills
`c_draw_ring_band` and `c_draw_ring_swap_colours`. Section 8.5's coverage tree
said so six pages earlier; the review contradicted itself.

The true claim is narrower and still gates Stage C: every one of those
assertions is written against `tools/hifi.py`, so C3 must **re-point** them at
`pdfcards.js` (**C-1a / T11a**) before deleting it - the same move E-6 already
requires for `test_render_agreement.py` - and the 16 `tests/mutants/*.patch`
files that actually patch `tools/hifi.py` must be retired or re-targeted, and
the one patch whose `# suite:` header names a deleted test file re-pointed
(**T14**), or the required mutation-gate check turns red - and in the
`# suite:` case hard-aborts at exit 4 rather than reporting one failure. Separately, nothing
compares non-text drawing ACROSS the two emitters; closing that
(**C-1b / T11b**) is worth doing while both exist but is not a precondition.
Q5 remains an owner call, now priced against re-pointing a known list rather
than against building a new differ.

Also corrected: Stage C is ~1900 lines and **104 `hifi.` lines across the 7
Python modules that import it** (81 of them in `test_print.py` and
`test_render_agreement.py` alone), plus stale `tools/hifi.py` citations in the
JS comments and 19 mutant patches - not the one file C3 names (E-1, O-3); Stage B is ~40 lines, much
cheaper than the plan implies (O-4); `test_render_agreement.py` must be
re-pointed, never deleted - its premise "two independent renderers with
opposite y axes" survives `hifi.py`'s removal (E-6); D-8 (`ORION` lost from
the hijaz title card) and D-9 (embedded font programs, unmeasured) join the
difference table (E-3, O-6).

Artifacts: `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-20260922-214140.jsonl`
(12 tasks as recorded at review time; T11 has since split into T11a/T11b and
T14 was added by the O-5 correction, so section 9.1 is authoritative), and the
test plan at
`~/.gstack/projects/raywu-handpan-cards/raywu-claude-seed-pdf-plan-eng-review-test-plan-20260922-214158.md`.

**UNRESOLVED DECISIONS:**

- **Q5 - does Stage C happen at all?** One-way door. Outside the AFK
  auto-decide grant, so it was not auto-picked. Decide it with O-3's port
  cost and the corrected O-5's re-pointing cost (T11a + T14) in view, and only
  after C-1a has landed or been priced. Q1-Q4 in section 5 also remain owner questions; they touch deck
  data and diagram geometry, which CLAUDE.md puts behind explicit owner
  instruction.
