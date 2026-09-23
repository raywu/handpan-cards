# Row 311: assert the emitter's vector and colour surface

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make every colour, stroke width, dash pattern and vector path the two
PDF emitters draw a compared value rather than an unasserted one, by extending
the existing cross-emitter parity oracle in `tests/test_pdf_parity.py` with a
normalised `page.get_drawings()` trace.

**Architecture:** `_glyphs()` already proves the TEXT surface matches between
`tools/hifi.py` (reportlab) and `src/engine/pdf.js` (the JS emitter). Add a
sibling `_drawings()` that reads the same two PDFs through pymupdf and compares
a normalised vector trace. No new build, no new fixture: the existing `_pair`
helper already renders both sides into a tmpdir.

**Tech Stack:** python3, pymupdf (`fitz`), reportlab, node.

**Spec:** `docs/plans/scale-engine-coordination.md` row 311 (`:1507`).

## Measured, before any code (2026-09-23)

Built the Amara seed `(D3) A3 C4 D4 E4 F4 G4 A4 C5` through BOTH emitters and
compared `page.get_drawings()`:

- **3 pages, 254 / 245 / 229 drawings per page, EXACT MATCH on both traces.**
- Trace A - `(type, color, fill, width, dashes, item count, item op sequence)`
  rounded to 3 dp on colour and 2 dp on width: match on all three pages.
- Trace B - trace A plus every item's POINT coordinates rounded to 1 dp:
  still an exact match on all three pages.

So the strong form (coordinates included) is achievable today and needs no
tolerance beyond 1 dp rounding, the same place `_glyphs()` already rounds to.
Probe kept at `scratchpad/probe311.py` in the authoring session.

**Extended to the full matrix during `/plan-eng-review` (2026-09-23).** Both
SEEDS x both variants, strong trace (coordinates included), `key=repr` sort:

| seed | variant | pages | drawings per page | mismatched pages |
|---|---|---|---|---|
| `(D3)` Amara | full | 3 | 254 / 245 / 229 | 0 |
| `(D3)` Amara | shop | 3 | 256 / 233 / 187 | 0 |
| `(F3)` Pygmy | full | 6 | 396 / 377 / 393 / 377 / 387 / 367 | 0 |
| `(F3)` Pygmy | shop | 6 | 400 / 389 / 381 / 381 / 375 / 293 | 0 |

The Pygmy risk the non-goals reserve a FINDING for does not materialise: over
4,600 drawings compared, zero mismatches. Probe at `/tmp/probe311b.py`.

**Cost is not a concern.** The existing `tests/test_pdf_parity.py` runs 4 tests
in **1.49s**, so the added mutants cost seconds against a 10.5-minute gate.

## Non-goals

- Row 313 (`/Length` unassertable), row 317 (draw ORDER, not set), row 318
  (`/Info`), row 319 (download behaviour). Separate rows, separate work.
- Touching `recorder()` in `tests/pdfcards.test.js`. Row 311 names it, but the
  parity oracle subsumes what un-noop-ing those four stubs would buy, at one
  test instead of a rewrite of every unit assertion.
- Any change to either emitter. This lane only adds assertions. If the trace
  does NOT match on the Pygmy seed, that is a FINDING to file as a new row,
  not a licence to edit `pdf.js` or `hifi.py`.

## Task 1: the drawings oracle

**Files:** Modify `tests/test_pdf_parity.py`.

**Interfaces:** Produces `_drawings(path, nd=1)` -> list of pages, each a
sorted list of normalised drawing tuples.

- [ ] **Step 1 — write the failing test.** Add `test_every_vector_matches_print`
      over both `SEEDS`, using a new `_pair_drawings` that mirrors `_pair` but
      returns `_drawings(...)` for each side. Assert page count, assert a floor
      (`sum of len >= 500`, the same shape as the glyph floor - an empty trace
      is a passing test that proves nothing), then per-page equality.
- [ ] **Step 2 — run it and watch it fail** with `_drawings` undefined:
      `python3 -m unittest tests.test_pdf_parity -v`
- [ ] **Step 3 — implement `_drawings`.** Normalise each drawing to
      `(type, color, fill, width, dashes, items)` where `color`/`fill` round to
      3 dp (None -> `()`), `width` rounds to 2 dp (None stays None), `dashes` is
      the raw string tuple, and each item is `(op, *points)` with `Point`
      rounded to `nd` and `Rect` to `nd` on all four sides.
      **Sort with `key=repr`, not bare `sorted()`.** A plain sort raises
      `TypeError: '<' not supported between instances of 'NoneType' and
      'float'` the moment two drawings differ only in a `None` width, and the
      nested point tuples are not mutually orderable either. `repr` is a total
      order over these tuples and is stable across both emitters because the
      values are already rounded.
- [ ] **Step 4 — run it green**, both seeds, full variant.
- [ ] **Step 5 — extend to the shop variant** in `test_the_shop_variant_matches_too`
      (or a sibling), because PRINTER_ONLY drops the title and legend cards and
      therefore a different set of vectors.
- [ ] **Step 6 — commit.**

## Task 2: prove it kills something

**Files:** Create new `tests/mutants/*.patch` files. No change to `tests/mutation_check.sh` — it globs `tests/mutants/*.patch` (`:31`) and selects the suite from each patch’s own `# suite:` header (`:6-11`), so a new mutant registers by existing.

- [ ] **Step 1** — add mutants the new test must kill, one per surface row 311
      names: a colour swap, a stroke-width change, a dash-pattern change, and a
      dropped `setDash` reset. Follow the existing `# kills:` header convention.
      **Mutate the JS side, `src/engine/pdfcards.js`** - `:283-330` carries all
      four surfaces (`setDash()`, `setDash(1.6, 1.6)`, `setStrokeColor(BLACK)`,
      `setLineWidth(1.15)`, `setDash(2.2, 2.2)`). That is the genuinely
      unasserted surface: `recorder()` in `tests/pdfcards.test.js:22-23` noops
      `setFill`, `setStroke`, `setLineWidth` and `setDash`, so the JS unit suite
      cannot see any of them. The Python twin (`tools/hifi.py:275-311`) is
      already partly covered by `tests/test_print.py`, so a Python-side mutant
      would prove less.
- [ ] **Step 2** — run `tests/mutation_check.sh` and confirm each new mutant is
      killed by `test_every_vector_matches_print`.
- [ ] **Step 3 — prove the gap was real, which step 2 CANNOT do.**
      `mutation_check.sh` runs only the command in each patch's own `# suite:`
      header, so a kill there says nothing about what else would have caught the
      mutant. For each new mutant, apply it by hand, run the pre-existing suites
      with the new test deselected, and confirm they stay GREEN:

      ```bash
      git apply tests/mutants/<name>.patch
      python3 -m unittest discover -s tests -t . 2>&1 | tail -3   # expect OK
      node --test tests/pdfcards.test.js 2>&1 | tail -3           # expect pass
      git apply -R tests/mutants/<name>.patch
      ```

      A mutant that dies here was already covered and is not evidence for
      row 311 - replace it with one that survives.
- [ ] **Step 4 — commit.**

### Measured (2026-09-23, during execution)

Five mutants, not four: the trace has five independently mutable channels
(stroke colour, fill colour, stroke width, dash pattern, dash reset) and one
mutant each is cheaper than arguing about which to drop.

| mutant | channel | new test | JS unit suites | other python |
|---|---|---|---|---|
| `i_pdfcards_bottom_ring_colour` | stroke colour 0.90 -> 0.88 | KILLED | green | only the sync check |
| `j_pdfcards_hairline_width` | stroke width 0.55 -> 0.5 | KILLED | green | only the sync check |
| `k_pdfcards_bottom_dash_pattern` | dash 2.2/2.2 -> 2.4/2.4 | KILLED | green | only the sync check |
| `l_pdfcards_dash_resets_dropped` | both dash resets removed | KILLED | green | only the sync check |
| `m_pdfcards_ring_fill_white` | fill white -> 0.98 grey | KILLED | green | only the sync check |

"JS unit suites green" is the gap made concrete: `node --test
tests/pdfcards.test.js` reports 10/10 pass and `tests/pdf.test.js` 11/11 under
EVERY one of the five, because `recorder()` noops exactly these four setters.

**About "only the sync check".** Each mutant also errors
`tests.test_deck_data.ValidateScriptTest.test_validate_py_passes`. That is NOT
pre-existing coverage of the mutated behaviour - it is `tools/validate.py`
check 4, which fails whenever `src/engine/*.js` and the generated region of
`index.html` diverge. Proved by execution: appending a **whitespace-only**
comment line to `src/engine/pdfcards.js` fails that same test. It fires for any
edit to an engine module and says nothing about what the edit did.
`mutation_check.sh` never sees it, because it runs only each patch's own
`# suite:` command.


## Acceptance

- `python3 -m unittest discover -s tests -t .` green (the exact command
  `.github/workflows/validate.yml:39` runs - `-t tests` also passes locally but
  is not the gate).
- `python3 tools/validate.py` green.
- `tests/mutation_check.sh` green, with the new mutants killed.
- CI green at the pushed head SHA (the local run is a smoke test).
- Coordination row 311 flipped to RESOLVED with the mutant names as evidence.
