# Row 311: assert the emitter's vector and colour surface

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

> **Line references below are pre-PR #121.** This doc is the planning and
> review record written before the fix landed; #121 then inserted a 5-line
> comment above `mode()`, shifting everything after it in
> `src/engine/pdfcards.js` down by five. Read `:50-54` / `:51-55` / `:51` as
> today's **56-60** (`mode()`) and `:181-185` as today's **186-190**
> (`duoFrame`'s `roundRect` pair). Row 324 in
> `docs/plans/scale-engine-coordination.md` is the live record; this one is
> frozen (#122 review, nit 2).

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

- `python3 -m unittest discover -s tests -t .` green. Note this is WEAKER
  than the gate: `.github/workflows/validate.yml:39` runs
  `python -W error::ResourceWarning -m unittest discover -s tests -t . -v`,
  so a ResourceWarning that CI turns into an error passes locally (row 322).
- `python3 tools/validate.py` green.
- `tests/mutation_check.sh` green, with the new mutants killed.
- CI green at the pushed head SHA (the local run is a smoke test).
- Coordination row 311 flipped to RESOLVED with the mutant names as evidence.

---

## Amendment (2026-09-23, after the PR #121 review)

The independent review of PR #121 found that the oracle shipped in #120 has a
**live blind spot, not a theoretical one**. `_drawings` omits pymupdf's
`even_odd`, and the two emitters disagree on it today:

    PY {None: 431, True: 297}     reportlab defaults to even-odd: f* / B*
    JS {None: 431, False: 297}    src/engine/pdfcards.js:50-54 hardcodes f / B

Measured on the Amara seed, full variant, on a clean tree. So "over 4,600
drawings, zero mismatches" (row 311) is partly an artifact of the omitted
field, and a mutant patching `mode()` to swap the fill rule SURVIVES the
oracle. Row 320 as filed calls this "theoretical today" and says a one-line
widening of the tuple would close it - both false: widening alone reds the
suite on a clean tree.

### Which side is wrong

Print is the ground truth - `tools/hifi.py` ships the six committed seed PDFs
and the reference the spec was measured from. The JS emitter is the one that
diverges, so **JS moves to even-odd**, not print to nonzero.

### Why that is pixel-neutral

The fill rule can only change rendering on a path that self-intersects or has
nested subpaths. Measured over every filled path in the deck:

| shape | count | items | subpaths |
|---|---|---|---|
| circle | 245 | 4 x `c` | one, convex |
| rounded rect | 52 | 4 x `c` + 4 x `l` | one, convex |

No path in either emitter has a second subpath, so even-odd and nonzero
produce identical pixels on all 297. The change is a byte-level alignment with
the print reference, not a visual change - which is why it does not need the
owner's "do not alter geometry" gate.

### Tasks

1. **`src/engine/pdfcards.js:50-54`** - `mode()` returns `"B*"` / `"f*"` /
   `"S"`. Then `python3 tools/inline_engine.py` (engine regions in
   `index.html` are GENERATED). `src/engine/pdf.js` passes `mode` through
   untouched, and `tests/pdf.test.js:138-140` passes its modes explicitly, so
   neither needs a change. Carry a one-line comment above `mode()` naming the
   parity contract and the mutants that guard it - a bare `"f*"` reads like a
   typo and invites a silent revert.
2. **`_drawings`** gains `d.get("even_odd")` in the tuple, between `dashes`
   and `items`. Do this AFTER task 1 or the suite reds.
3. **Two mutants, not one.** `tests/mutants/n_pdfcards_fill_only.patch`
   reverts only the `fill` branch (`"f*"` -> `"f"`);
   `tests/mutants/o_pdfcards_stroke_fill.patch` reverts only the
   `stroke && fill` branch (`"B*"` -> `"B"`). One compound patch proves only
   that AT LEAST ONE of the two branches is watched. Both carry
   `# suite: python3 -m unittest tests.test_pdf_parity -k test_every_vector_matches_print`.
   **Strip the `index <blob>..<blob> 100644` line from each patch** -
   `tests/mutation_harness.test.js:344` refuses it, and that is exactly what
   reddened CI at `c692a72`.
4. **File row 323 - the paint-order gap** (surfaced by the Codex outside
   voice, then measured here). `_drawings` returns `sorted(rows, key=repr)`
   per page, so the trace compares a MULTISET and is blind to layering.
   Reversing the two `roundRect` calls in `duoFrame`
   (`src/engine/pdfcards.js:181-185`) would paint the outer colour over the
   white interior - different pixels, identical multiset, oracle silent.
   The obvious fix (drop the sort, compare sequences) is NOT available:

       seed (D3) A3 ...  pages=3  seq_equal=0  multiset_equal=3
       seed (F3) G3 ...  pages=6  seq_equal=0  multiset_equal=6

   The two emitters legitimately emit in different orders on every page, so
   the sort is load-bearing and un-sorting reds the suite instantly. Closing
   this needs an emission-ORDER contract across both emitters - a change to
   the Python print ground truth, which needs the owner's gate. Row, not task.

5. **Correct the rows.** 320 rewritten to say the divergence was live and is
   now closed, with the mutant as evidence; 321 gains "documented at
   `tests/test_pdf_parity.py:37-39` but unasserted" and drops the loose "all
   bottom-ring" (mutant `l` also deletes `drawRing`'s entry reset); 322 names
   all three sites of the wrong CI-command claim
   (`2026-09-23-vector-parity-oracle.md:159`,
   `2026-09-22-seed-pdf-one-source.md:167` and `:934`) and cross-references
   row 164. Row 311 keeps RESOLVED but gains the amendment note - its evidence
   was real, its "zero mismatches" was measured over a trace one field short.

### Acceptance

`python3 -m unittest discover -s tests -t .` green (**173 tests** - these tasks widen an existing trace and add mutants, they add no test case; 175 was wrong). `python3
tools/validate.py` green - check 4 fails if `inline_engine.py` was not re-run.
`node --test tests/pdfcards.test.js tests/pdf.test.js` green. The new mutant
killed, and killed for the right reason. CI green at the pushed head SHA.

### Non-goals

Still not touching `recorder()`, the Python emitter, or
`openPrintSheet`/`PRINT_LAYOUTS`. Not widening the trace to `closePath`,
`lineCap`, `lineJoin` or the two opacities - all five measured identical on
both emitters today, and no call site varies them. That is a SCOPE decision,
not impossibility: `pdf.js:147` emits `h` explicitly and `Page.op()` is public,
so a mutant could reach them. They stay row 320's residue, now labelled
honestly.

**Paint order is out of scope and stays a known gap** (new row 323). See the
measurement below.

## Eng review of the Amendment (/plan-eng-review, 2026-09-23)

Target: the "Amendment (2026-09-23, after the PR #121 review)" section above.
Report file: this plan. Mode: FULL_REVIEW (complexity gate did not trip -
6 files touched, 0 new classes/services).

### Step 0 - Scope Challenge

1. **What already exists.** `tests/test_pdf_parity.py` already owns the
   cross-emitter oracle and already has `_pair_drawings` / `_assert_vectors_match`
   plumbing; the amendment widens one tuple rather than building a parallel
   check. `tests/mutants/` already has the i-m patch family and the
   `# suite:` convention. Nothing is rebuilt.
2. **Minimum change.** One operator string in `mode()`, one regenerate, one
   tuple field, two mutant patches, four doc rows. Nothing smaller closes the
   divergence AND proves it stays closed.
3. **Complexity.** `src/engine/pdfcards.js`, `index.html` (generated),
   `tests/test_pdf_parity.py`, 2 patches, 2 plan docs. Gate not tripped.
4. **Search check:** not applicable - no new architectural pattern,
   infrastructure component or concurrency approach. Even-odd vs nonzero is a
   PDF spec primitive, not a library choice.
5. **TODOS cross-reference:** repo has no `TODOS.md`; the coordination docs
   serve that role and rows 320-323 are the entries.
6. **Completeness:** raised from the plan's original one-mutant/one-field
   shape to two mutants plus an explicit out-of-scope row. Accepted.
7. **Distribution:** no new artifact.

Findings: 0 scope issues. Scope accepted as-is.

### 1. Architecture review

- **[PASS] (confidence: 10/10) `src/engine/pdfcards.js:51-55`** - `mode()` is
  the SOLE producer of a fill operator in the JS emitter. Verified by
  enumeration, not grep-and-hope: `Page.prototype.rect/roundRect/circle` are
  the only methods taking a `mode` argument (`src/engine/pdf.js:127,136,156`),
  `line` and `arc` hardcode `"S"` (`:124,:184`), and the only call sites that
  pass a computed mode are `pdfcards.js:84` and `:87`, both through `mode()`.
  `Page.rect` is never called at all. So the one-line change is complete.
- **[PASS] (confidence: 9/10)** Layering is right: `pdf.js` stays a generic
  PDF writer that accepts any operator string, and `pdfcards.js` keeps the
  reportlab-compatibility policy. The starred operator does not leak into the
  generic layer.
- **[P3] (confidence: 8/10) `src/engine/pdfcards.js:51`** - the even-odd
  choice is a cross-emitter contract with no marker in the code. Folded into
  task 1 as a required comment.

Production failure scenario for the new path: a future deck generator emits a
genuine annulus (two subpaths) and even-odd punches the hole where nonzero
would fill it. Today no such path exists (245 single-subpath circles, 52
single-subpath rounded rects, measured). The oracle catches it the moment the
two emitters disagree, and they will not disagree - they will both be even-odd.
Accounted for.

### 2. Code quality review

- **[P2] (confidence: 10/10) Amendment "Non-goals"** - claimed the five
  omitted channels are "unreachable through either API". False:
  `src/engine/pdf.js:147` emits `h` explicitly and `Page.op()` is public.
  Corrected in place to a scope decision. This is the SAME failure mode as row
  320 ("theoretical today") and worth naming as a pattern: do not upgrade
  "nothing varies it today" into "nothing can vary it".
- **No DRY violation.** The two new patches differ by one line each, which is
  the point of splitting them.

### 3. Test review

Framework: CLAUDE.md names the suites. Python `unittest` (`python3 -m unittest
discover -s tests -t .`), node `node --test`. Measured baseline: **173 tests,
OK**.

```
CODE PATHS                                         ORACLE COVERAGE
[~] src/engine/pdfcards.js
  └── mode(stroke, fill)
      ├── [GAP->COVERED] stroke && fill -> "B*"   o_pdfcards_stroke_fill.patch
      ├── [GAP->COVERED] fill only      -> "f*"   n_pdfcards_fill_only.patch
      └── [OK]           neither        -> "S"    unchanged, 431 stroke paths
[~] tests/test_pdf_parity.py::_drawings
      ├── [COVERED] even_odd field           both new mutants
      ├── [COVERED] color/fill/width/dashes  mutants i-m (merged, #120)
      └── [GAP]     paint ORDER              row 323 - see below, not closable here

COVERAGE: 3/3 mode() branches watched  |  1 known oracle gap, documented
QUALITY: the two parity tests are the only oracle; they run 3 seeds x 2 variants
```

- **[P1] (confidence: 10/10) Amendment Acceptance** - claimed 175 tests. The
  tasks add zero test cases; the measured count is 173 and stays 173. A wrong
  acceptance number is a gate that cannot be checked. Corrected in place.
- **[P1] (confidence: 10/10) Task 3** - a new mutant patch carrying its
  `index <blob>..<blob> 100644` line is refused by
  `tests/mutation_harness.test.js:344`. This is not hypothetical: it reddened
  two CI checks at `c692a72` in this very workstream. The strip step is now an
  explicit part of the task.
- **[P2] (confidence: 9/10, Codex)** - one compound mutant proves only that at
  least one of the two fill branches is watched. Split into two.
- **[P2] (confidence: 10/10, Codex, then measured here)** - the trace is
  order-blind. `_drawings` sorts per page, so swapping `duoFrame`'s two
  `roundRect` calls (`src/engine/pdfcards.js:181-185`) paints over the white
  interior with an identical multiset. Codex's remedy ("preserve paint order")
  is NOT available: measured `seq_equal=0` against `multiset_equal=3` (Amara,
  3 pages) and `seq_equal=0` against `multiset_equal=6` (Pygmy, 6 pages). The
  emitters legitimately differ in emission order on every page, so the sort is
  load-bearing. Filed as row 323 rather than papered over.
- **Regression rule:** the change alters bytes in every shipped-equivalent JS
  PDF. Behaviour to preserve: identical pixels. Proof: 297 filled paths, each
  one convex single subpath, where even-odd and nonzero are provably equal.
  The existing parity tests are the regression contract; no new contract needed.
- **No `/qa` artifact:** this is a byte-level print-pipeline change with no
  page, route or user interaction. A QA test plan would be empty.

### 4. Performance review

The mutation gate is the long pole (11m2s at the last green run). Each new
mutant is scoped by its `# suite:` line to two tests that run in ~2.4s, so the
gate grows by ~5s. `_drawings` gains one scalar per drawing over ~4,600
drawings - free. No N+1, no memory concern, no caching opportunity.

Findings: 0.

### NOT in scope

- **Paint order** - filed as row 323; needs an emission-order contract across
  both emitters, which changes the Python print ground truth and needs the
  owner's gate.
- **`closePath` / `lineCap` / `lineJoin` / the two opacities** - measured
  identical, no call site varies them; row 320's residue.
- **`recorder()`, the Python emitter, `openPrintSheet` / `PRINT_LAYOUTS`** -
  unchanged from the original plan's non-goals.

### What already exists

`tests/test_pdf_parity.py` (the oracle, merged in #120) and the `tests/mutants/`
i-m family. The amendment extends both; it rebuilds neither.

### Worktree parallelization strategy

Sequential implementation, no parallelization opportunity - task 2 must follow
task 1 or the suite reds, and tasks 3-5 depend on task 1's operator strings.

### Implementation Tasks

Synthesized from this review's findings.

- [ ] **T1 (P1, human: ~20min / CC: ~2min)** - src/engine - `mode()` returns
  `"B*"`/`"f*"`, add the contract comment, re-run `tools/inline_engine.py`
  - Surfaced by: Architecture review / the original Amendment task 1
  - Files: `src/engine/pdfcards.js`, `index.html`
  - Verify: `python3 tools/validate.py`
- [ ] **T2 (P1, human: ~15min / CC: ~2min)** - tests - `_drawings` gains
  `d.get("even_odd")` between `dashes` and `items`
  - Surfaced by: the PR #121 reviewer finding, reproduced here
  - Files: `tests/test_pdf_parity.py`
  - Verify: `python3 -m unittest tests.test_pdf_parity` (173 total, OK)
- [ ] **T3 (P1, human: ~20min / CC: ~3min)** - tests/mutants - two patches,
  blob header stripped
  - Surfaced by: Test review P1 (blob header) + Codex finding 3 (split)
  - Files: `tests/mutants/n_pdfcards_fill_only.patch`,
    `tests/mutants/o_pdfcards_stroke_fill.patch`
  - Verify: `node --test tests/mutation_harness.test.js`, then
    `tests/mutation_check.sh` on the two new names
- [ ] **T4 (P2, human: ~20min / CC: ~3min)** - docs - rows 320/321/322
  corrected, row 323 filed, row 311 amended
  - Surfaced by: Code quality review P2 + Test review P2 (paint order)
  - Files: `docs/plans/scale-engine-coordination.md`
  - Verify: read-back

### Decision ledger

All choices below were resolved under the standing AFK authorization
(global CLAUDE.md, "Decisions while I'm away"): the recommended option was
auto-picked and is recorded here with its rationale.

- **R1 - wrong acceptance count (175 vs 173).** Auto-decided: correct to 173.
  Rationale: measured `Ran 173 tests ... OK` on the clean tree; the tasks add
  no test case. State: approved (auto). Scope: the Acceptance line.
- **R2 - mutant patch blob header.** Auto-decided: make stripping an explicit
  task step. Rationale: this exact omission reddened two CI checks at
  `c692a72`. State: approved (auto).
- **R3 - one mutant or two.** Auto-decided: two. Rationale: a compound revert
  proves only that one of the two branches is watched, and the second patch
  costs one line. State: approved (auto).
- **R4 - paint-order gap.** Auto-decided: file row 323, do NOT widen this
  amendment. Rationale: measured - the emitters differ in order on 9/9 pages,
  so the sort cannot simply be dropped; the real fix is an ordering contract
  that changes the Python print ground truth and needs the owner's gate.
  Taking the conservative branch. State: approved (auto).
- **R5 - "unreachable through either API".** Factual correction, no question
  needed per Decision procedure step 1: `pdf.js:147` emits `h` and `op()` is
  public. Reworded to a scope decision. State: approved (correction).
- **R6 - comment on `mode()`.** Auto-decided: include. Rationale: one line,
  and a bare `"f*"` reads like a typo to the next editor. State: approved (auto).

Approval readiness: PASS (R1-R6, all under the AFK standing authorization).

### Unresolved decisions that may bite you later

None in this review. Row 323 is a filed known gap with a measurement, not an
unresolved decision.

### Completion summary

- Step 0: Scope Challenge - scope accepted as-is
- Architecture Review: 1 issue found (P3, folded into task 1)
- Code Quality Review: 1 issue found (P2, corrected in place)
- Test Review: diagram produced, 4 gaps identified (2 closed by tasks, 1
  closed by splitting the mutant, 1 filed as row 323)
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items (repo has no TODOS.md; coordination rows serve)
- Failure modes: 0 critical gaps flagged (the paint-order gap has no test but
  is documented and non-silent once row 323 is worked)
- Unresolved decisions: 0 in this review
- Outside voice: codex (gpt-6-astra), completed, 3 findings - 2 accepted as
  written, 1 accepted with a measured correction to its remedy
- Parallelization: 1 lane, 0 parallel / 4 sequential
- Lake Score: N/A (no coverage-scored choices; all six were corrections or
  kind-differing)

## GSTACK REVIEW REPORT

| Field | Value |
|---|---|
| Skill | plan-eng-review |
| Target | Amendment (2026-09-23) in docs/plans/2026-09-23-vector-parity-oracle.md |
| Branch | claude/row311-nits |
| Mode | FULL_REVIEW |
| Scope Challenge | scope accepted as-is (0 issues) |
| Architecture | 1 issue (P3) |
| Code Quality | 1 issue (P2) |
| Tests | 4 gaps (3 closed by tasks, 1 filed as row 323) |
| Performance | 0 issues |
| Outside voice | codex (gpt-6-astra, high) - completed, 3 findings |
| Decisions | D-R1..R6, all approved under the AFK standing authorization |
| Approval readiness | PASS |
| Implementation tasks | 4 (T1-T4), 1 lane, sequential |
| Critical gaps | 0 |

NO UNRESOLVED DECISIONS
