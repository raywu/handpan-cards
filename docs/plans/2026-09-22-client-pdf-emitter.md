# Client-side PDF emitter Implementation Plan

> **For agentic workers:** execute task-by-task, TDD, one PR per task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A custom deck downloads a PDF built in the browser whose card geometry,
type and colour match what `tools/hifi.py` emits for the three seed decks, so the
platform's print engine never gets a vote on the page box.

**Architecture:** A hand-rolled PDF writer in JS (no library) emits a 612x792 pt
MediaBox with absolute card origins from a JS port of `hifi.slots()`. Fonts are
subsetted offline by a new sync step into a JS module of base64 TTFs plus glyph
advance tables, so the JS text metrics and reportlab's `stringWidth` read the same
numbers by construction. Delivery is a Blob the user saves; on iOS the blob URL is
opened and the system viewer's Share sheet does the saving.

**Tech Stack:** vanilla JS in `src/engine/*.js` inlined by `tools/inline_engine.py`;
`fonttools` (offline only, dev dependency) for subsetting; `pymupdf` for the test
oracle, already a test dependency.

**Spec:** `tools/hifi.py` IS the spec. Every geometry, colour and type decision in
this plan is a port of a named line there, never a fresh derivation.

## Global Constraints

- Single-file app. No `<script src>` in `index.html`. New JS lives in
  `src/engine/<name>.js` and is inlined by `tools/inline_engine.py`; new generated
  data lives in a module the same tool inlines. (CLAUDE.md "Hard constraints")
- Do not alter deck data or diagram geometry.
- Card copy is English-only. This is what makes WinAnsi encoding sufficient.
- Print spec: card 177.6 x 247.2 pt, US Letter 612 x 792, gutters 12.2 / 9.4 pt,
  crop marks at all card edges, 2.00-inch calibration bar on page 1.
- Test at 380px viewport. Mobile (iPhone 14 / iOS 26.6) is the target device.
- Every new sync step gets a `--check` mode and a `tools/validate.py` check, the
  same shape as `inline_engine.py` (check 4) and `sync_decks.py` (check 1).
- Added mutants carry `# kills:` and `# suite:` headers. Each new suite gets a
  `tests/suite_health.py` FLOORS row AFTER it lands - the rows are minimums, the
  only failure is `ran < floor` (`tests/suite_health.py:143`), so adding tests
  merges green without touching the file. This is bookkeeping, not a merge gate.

## Non-goals

1. **Byte-identical output to reportlab.** The oracle is measured geometry and
   extracted text, never a byte diff. reportlab stamps a creation date, and we are
   not reimplementing its object layout.
2. **Replacing `tools/hifi.py`.** The seed decks keep shipping pre-built PDFs from
   the Python pipeline. This emitter serves custom decks only.
3. **Compression.** Content streams are emitted uncompressed. A 5-page deck is
   ~200 KB of stream text; no `FlateDecode`, no `zlib` in the browser.
4. **CMYK, ICC profiles, PDF/X.** `hifi.py` uses DeviceRGB `Color(r,g,b)` and
   nothing else (`tools/hifi.py:23-33`); so does this.
5. **Removing the browser-print path in this plan.** See D2.
6. **Non-Latin card copy.** Out of scope by CLAUDE.md, and the subset depends on it.

## Open decisions for review

**D1 - where the emitter lives.** Recommendation: `src/engine/pdf.js` +
`src/engine/pdfcards.js`, added to `MODULES` in `tools/inline_engine.py:35`.
Alternative: hand-write it into the app JS of `index.html` directly. The engine-region
route buys Node-importable unit tests (every `tests/*.test.js` already imports from
`src/engine/`) at the cost of two more inlined regions. Take the engine route.

**D2 - what happens to the browser-print path.** Recommendation: leave
`openPrintSheet()` and the `narrow`/`wide` layouts exactly where they are, and add
the emitter behind the SAME two CTAs, switching them over only after the emitter
passes the B7 device check on the iPhone. Alternative: cut over at merge. The
browser path is the only thing that works today; cutting over before a device
check trades a known-imperfect output for an unverified one.

**D3 - subset charset.** Recommendation: the union of every character any card can
draw - ASCII 0x20-0x7E plus the sharp/flat glyphs actually used in note names and
the degree ring (`deg` U+00B0 appears in degree labels like `iii deg`). Derive it by
running the generator over the three seed decks AND a sweep of generated decks,
then take the union and freeze it in the tool; the tool FAILS if a build ever needs
a glyph outside the frozen set, rather than silently dropping it.

**D4 - the emitter body (LOCKED by the owner, 2026-09-22).** Vector, hand-rolled:
the writer emits PDF operators and embeds subsetted TrueType faces. Considered and
rejected: (B) raster pages - render each sheet to a canvas and embed JPEG XObjects.
Rejected because it kills the pymupdf text oracle every parity test in this plan
depends on, weighs 10-15 MB per deck, and inherits the Chrome mask-composite frame
bug (learning `chrome-print-drops-mask-composite`, 10/10) since the raster comes
from the same DOM. (C) inline jsPDF - ~350 KB minified, and it still needs the same
subsetted fonts on top, against a 91 KB gzipped baseline for the whole app;
pdf-lib is ~1 MB. Hand-rolled costs +63.5 KB gzipped of fonts and no library. The
single-file constraint is what makes the library rung unaffordable.

**D5 - paper size (AUTO-DECIDED under AFK, 2026-09-22; owner may reverse).**
`index.html:4193` ships `PRINT_PAPER = { letter, a4 }` with a live `<select>` at
`index.html:4433`, and `hifi.PAGE` is Letter-only. Switching the CTAs to a
Letter-only emitter would silently ignore an A4 user's choice - exactly the failure
the learning `browser-print-cannot-read-paper-size` (10/10, 2026-09-21) says a paper
control exists to prevent. Decision: **parameterize the page box**, do not drop A4.
`hifi.slots()` is already `x0 = (PAGE[0] - tw_) / 2` (`tools/hifi.py:356-363`), so
A4 (595.28 x 841.89) costs one parameter: the 557.2 x 760.4 block still centres with
19.0 / 40.7 pt to spare. Rationale for auto-picking over "drop A4": dropping a
shipped control is a user-visible regression, and the geometry is free.

---

### Task 1: The font subset pipeline

**Files:**
- Create: `tools/inline_fonts.py`
- Create: `src/engine/fontdata.js` (GENERATED by the tool above)
- Modify: `tools/inline_engine.py:35` (add `"fontdata"` to `MODULES`, first)
- Modify: `tools/validate.py` (new check: fontdata drift)
- Test: `tests/test_font_subset.py`

**Interfaces:**
- Produces: `HPE.fontdata.FACES` - `{ Display, Notes, NotesB, Label, LabelSB }`,
  each `{ ttf: "<base64>", widths: {"<char>": <advance at 1000 upem>}, upem: 1000,
  ascent, descent, capHeight, flags, italicAngle, bbox: [x0,y0,x1,y1] }`.
  The five face names are hifi's own registration names (`tools/hifi.py:16-20`),
  so a port of a hifi call site reads the same identifier.
- Produces: `HPE.fontdata.CHARSET` - the frozen character set string.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_font_subset.py
import base64, json, os, re, unittest
from tests import paths
from reportlab.pdfbase import pdfmetrics
import hifi  # registers the TTFs

FONTDATA = os.path.join(paths.ROOT, "src", "engine", "fontdata.js")

def faces():
    src = open(FONTDATA, encoding="utf-8").read()
    m = re.search(r"const FACES = (\{.*?\});", src, re.S)
    return json.loads(m.group(1))

class FontSubsetTest(unittest.TestCase):
    def test_every_advance_matches_reportlab_at_1000_upem(self):
        """The JS emitter and reportlab must read ONE set of numbers.

        hifi calls pdfmetrics.stringWidth at :42, :56, :67, :68 and :171 -
        centring, the octave offset and the fitter. If these tables disagree
        with reportlab by even a fraction, every centred string on every card
        drifts and no geometry test downstream can tell you why.
        """
        for name, face in faces().items():
            for ch, adv in face["widths"].items():
                expect = pdfmetrics.stringWidth(ch, name, 1000.0)
                self.assertAlmostEqual(adv, expect, places=3,
                                       msg="%s %r" % (name, ch))

    def test_the_charset_covers_every_glyph_the_decks_draw(self):
        import decks
        used = set()
        for deck in (decks.HIJAZ, decks.PYGMY, decks.AMARA):
            used |= set(json.dumps(deck, default=str))
        charset = set(re.search(r'const CHARSET = "(.*?)";', open(FONTDATA).read()).group(1))
        self.assertEqual(used - charset - set('\\"'), set())

    def test_the_committed_module_is_what_the_tool_writes(self):
        import subprocess, sys
        r = subprocess.run([sys.executable, os.path.join(paths.ROOT, "tools", "inline_fonts.py"), "--check"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python3 -m unittest tests.test_font_subset -v`
Expected: FAIL, `src/engine/fontdata.js` does not exist.

- [ ] **Step 3: Write `tools/inline_fonts.py`**

Shape (not pseudocode - write this):
- `CHARSET` frozen at module scope, built once from D3's union and pasted in.
- For each of the five faces in `hifi.FONTS`: `fontTools.subset.Subsetter` with
  `--text=CHARSET`, `--layout-features=''`, `--no-hinting`, keeping the original
  `cmap` so the face stays a simple TrueType usable with WinAnsi.
- Read `hmtx` + `head.unitsPerEm`, normalise every advance to 1000 upem, key the
  table by CHARACTER (not glyph id) so the JS writer never touches glyph ids.
- Emit `src/engine/fontdata.js` as `const FACES = {...}; const CHARSET = "...";`
  inside the `HPE.fontdata` namespace, matching the shape of the other modules.
- `--check` re-generates in memory and diffs against the committed file, exit 1 on
  drift. No writing in `--check`.
- Print the base64 size per face; FAIL the tool if the total exceeds 200 KB, so a
  charset creep that would double `index.html` is a build error, not a surprise.

- [ ] **Step 4: Run the tool, add the validate.py check, run the tests**

Run: `python3 tools/inline_fonts.py && python3 tools/inline_engine.py && python3 tools/validate.py && python3 -m unittest tests.test_font_subset -v`
Expected: PASS, and `python3 tools/inline_fonts.py --check` exits 0.

- [ ] **Step 4b: Pin the embedded font BYTES, not just the widths**

Asserting every advance equals `pdfmetrics.stringWidth` catches a width-table drift
but NOT a corrupt or mis-subset TTF: a PDF whose `/FontFile2` is garbage still
extracts text in pymupdf off the `/Widths` array, so the whole Task 3 oracle passes
on an unreadable font. Add, to `tests/test_pdf_emitter.py` once Task 2 lands:
`pymupdf`'s `doc.extract_font(xref)` returns a parseable TTF for each of the five
faces, and `fontTools.ttLib.TTFont(BytesIO(buf)).getGlyphOrder()` covers every
character in `CHARSET`.

- [ ] **Step 5: Add the suite_health row and commit**

Run: `python3 tests/suite_health.py` (update the floor for the new suite), then commit.

**Acceptance criteria:**
1. `python3 tools/inline_fonts.py --check` exits 0 on a clean tree, and exits 1
   after `sed -i '' 's/1000/1001/' src/engine/fontdata.js`.
2. Every advance in `FACES` equals `pdfmetrics.stringWidth(ch, name, 1000.0)`.
3. Total base64 across the five faces is under 200 KB.
4. `tools/validate.py` fails when `src/engine/fontdata.js` and the TTFs disagree.

**Verify:** `python3 tools/validate.py && python3 -m unittest tests.test_font_subset -v`

---

### Task 2: The PDF writer core

**Files:**
- Create: `src/engine/pdf.js`
- Modify: `tools/inline_engine.py:35` (`MODULES` gains `"pdf"` after `"fontdata"`)
- Test: `tests/pdf.test.js`

**Interfaces:**
- Consumes: `HPE.fontdata.FACES` (Task 1).
- Produces: `HPE.pdf.doc(w, h)` -> a document with:
  - `page()` starts a page, returns the page's content builder
  - `line(x1,y1,x2,y2)`, `rect(x,y,w,h,mode)`, `roundRect(x,y,w,h,r,mode)`,
    `circle(cx,cy,r,mode)`, `arc(...)` - `mode` is `"S" | "f" | "B"`
  - `setStroke(r,g,b)`, `setFill(r,g,b)`, `setLineWidth(w)`, `setDash(on,off)`
  - `text(x, y, s, face, size)` - draws at the baseline, no tracking
  - `save()`, `restore()`, `translate(x,y)`, `rotate(deg)`
  - `stringWidth(s, face, size)` - reads `FACES[face].widths`, the ONE metric source
  - `bytes()` -> `Uint8Array`
- The coordinate system is PDF-native, y-up, origin bottom-left, so a port of a
  `hifi.py` call site keeps its arithmetic verbatim.

- [ ] **Step 1: Write the failing test**

```js
// tests/pdf.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const HPE = require("../tests/helpers/engine.js");   // same loader the other suites use

test("the xref offsets are byte offsets, not character offsets", () => {
  const d = HPE.pdf.doc(612, 792);
  const p = d.page();
  // A non-ASCII byte in a string literal is the trap: a JS string is UTF-16,
  // so `str.length` undercounts the bytes the file actually carries and every
  // xref entry after it points into the middle of an object.
  p.text(72, 720, "A°B", "Label", 12);
  const out = d.bytes();
  assert.ok(out instanceof Uint8Array);
  const s = Buffer.from(out).toString("latin1");
  const startxref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.strictEqual(s.slice(startxref, startxref + 4), "xref");
  for (const m of s.matchAll(/^(\d{10}) 00000 n $/gm)) {
    const off = Number(m[1]);
    if (off === 0) continue;
    assert.match(s.slice(off, off + 20), /^\d+ 0 obj/);
  }
});

test("stringWidth is the only metric source and it scales linearly", () => {
  const d = HPE.pdf.doc(612, 792);
  assert.ok(Math.abs(d.stringWidth("Cm7", "Notes", 24) - 2 * d.stringWidth("Cm7", "Notes", 12)) < 1e-9);
});
```

- [x] **Step 2: Run it, watch it fail**

Run: `node --test tests/pdf.test.js`
Expected: FAIL, `HPE.pdf` is undefined.

- [ ] **Step 3: Write `src/engine/pdf.js`**

Rules the implementation must hold:
- Build the file in a `Uint8Array` accumulator (`push(latin1String)` converts with
  `charCodeAt & 0xff` after asserting every code point is < 256; binary font data
  goes in as raw bytes from the base64 decode, never through a string).
- Object layout: Catalog, Pages, one Page + one Contents stream per page, one
  FontDescriptor + FontFile2 + Font per face ACTUALLY USED.
- Fonts: `/Subtype /TrueType`, `/Encoding /WinAnsiEncoding`, `/FirstChar 32`,
  `/LastChar 255`, `/Widths [...]` from `FACES[face].widths`, `/FontFile2` carrying
  the subset with `/Length1` set to the uncompressed byte length.
- `text()` emits `BT /F<n> <size> Tf 1 0 0 1 <x> <y> Tm (<escaped>) Tj ET`. Escape
  `\\`, `(`, `)` and emit any byte >= 0x80 as `\ooo` octal.
- xref built from recorded byte offsets; `%%EOF` last.

- [ ] **Step 4: Run the test**

Run: `node --test tests/pdf.test.js`
Expected: PASS.

- [ ] **Step 5: Add a round-trip test through pymupdf and commit**

```python
# tests/test_pdf_emitter.py - the cross-language oracle for Task 2
import subprocess, tempfile, unittest, pymupdf
from tests import paths

class WriterOracleTest(unittest.TestCase):
    def test_node_writes_a_pdf_pymupdf_can_open_and_measure(self):
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            subprocess.run(["node", paths.tool("pdf_smoke.js"), f.name], check=True)
            doc = pymupdf.open(f.name)
            self.assertEqual(doc[0].rect.width, 612)
            self.assertEqual(doc[0].rect.height, 792)
            self.assertIn("Cm7", doc[0].get_text())
```

**Acceptance criteria:**
1. `pymupdf` opens the emitted file without a repair pass
   (`pymupdf.open(path).is_repaired is False`).
2. Every xref offset points at `<n> 0 obj`.
3. `stringWidth` reads only `HPE.fontdata.FACES`; `grep -n 'charCodeAt\|0.5\s*\*' src/engine/pdf.js`
   shows no width heuristic.
4. Extracted text round-trips a string containing every character in `CHARSET`.

**Verify:** `node --test tests/pdf.test.js && python3 -m unittest tests.test_pdf_emitter -v`

---

### Task 3a: The deck adapter (`from_generated`)

`hifi`'s card builders read 20 deck keys. A browser custom deck is the ENGINE's
output and carries almost none of them - `tools/decks.py:354 def from_generated(payload)`
is what synthesises `title, name, sub, credit, blurb, legend_lines, legend_demo,
spec, chords, degrees, has_bottom, warnings, R, cy, y_note, y_num, col_root,
col_tone, grad` from a `gen_deck.js` payload. Without a JS port of it Task 3 has
nothing to draw. This task exists because the first draft of this plan omitted it.

**Files:**
- Create: `src/engine/pdfdeck.js`
- Modify: `tools/inline_engine.py:35` (`MODULES` gains `"pdfdeck"`, before `pdfcards`)
- Test: `tests/test_pdf_deck_adapter.py`

**Interfaces:**
- Produces: `HPE.pdfdeck.fromGenerated(payload)` -> the hifi-shaped deck dict,
  key for key with `decks.from_generated`. `blank_cards` stays deliberately absent
  (`tools/decks.py` `GENERATED_OMITTED` documents why).
- Consumed by: `HPE.pdfcards.build` (Task 3), which takes the ADAPTED deck.

- [ ] **Step 1: Write the failing cross-language test**

```python
# tests/test_pdf_deck_adapter.py
import json, os, subprocess, unittest
from tests import paths
import decks

def js_adapt(payload):
    out = subprocess.run(["node", os.path.join(paths.TOOLS, "pdf_adapt.js")],
                         input=json.dumps(payload), text=True,
                         capture_output=True, check=True)
    return json.loads(out.stdout)

class AdapterParityTest(unittest.TestCase):
    def test_every_key_matches_the_python_adapter(self):
        for payload in _payloads():          # 3 seed specs + the synthetic sweep
            want = decks.from_generated(payload)
            got = js_adapt(payload)
            self.assertEqual(sorted(got), sorted(k for k in want if k != "chords"),
                             "key set drift")
            for k in got:
                if isinstance(want[k], float):
                    self.assertAlmostEqual(got[k], want[k], places=4, msg=k)
                else:
                    self.assertEqual(got[k], want[k], msg=k)
```

- [x] **Step 2: Run it, watch it fail** - `python3 -m unittest tests.test_pdf_deck_adapter -v`

- [ ] **Step 3: Port `from_generated` into `src/engine/pdfdeck.js`**

Port it statement for statement. `R = round(_BAND_HALF / ext, 1)` uses Python
`round` (banker's), so it goes through the same banker's helper Task 3 defines.

- [ ] **Step 4: Run the test** - expected PASS over all payloads.

- [ ] **Step 5: Add a mutant and commit** - one that uses `Math.round` for `R`.

**Acceptance criteria:**
1. Key sets match `decks.from_generated` exactly, for the three seed specs and the
   synthetic sweep in `tests/fixtures/synthetic_scales.json`.
2. Every scalar matches to 4 places; every string matches exactly.
3. `R` is computed with banker's rounding and a mutant proves it.

**Verify:** `python3 -m unittest tests.test_pdf_deck_adapter -v`

---

### Task 3: Porting the card drawings

**Files:**
- Create: `src/engine/pdfcards.js`
- Modify: `tools/inline_engine.py:35` (`MODULES` gains `"pdfcards"`)
- Test: `tests/test_pdf_parity.py`, `tests/pdfcards.test.js`

**Interfaces:**
- Consumes: `HPE.pdf` (Task 2), `HPE.fontdata` (Task 1), `HPE.pdfdeck` (Task 3a).
- Produces: `HPE.pdfcards.build(deck, {variant, paper})` -> `Uint8Array`, where
  `variant` is `"full" | "shop"` mirroring `hifi.build(path, deck, chords_only)`
  (`tools/hifi.py:379`), and `paper` is `"letter" | "a4"` (D5), defaulting to the
  app's current `printPaper`.
- Produces: `HPE.pdfcards.slots(paper)` -> the nine `[x, y]` origins, a port of
  `hifi.slots()` (`tools/hifi.py:356-363`) with `PAGE` as a parameter instead of a
  module constant, derived from `PRINT_GEOM` (`index.html:4149`) and `PRINT_PAPER`
  (`index.html:4193`), NOT from a second copy of the six numbers.

Port, function for function, in this order. Each one is a step; each keeps the
Python arithmetic verbatim and only changes syntax:

`tw` (:41), `tracked` (:45), `fit` (:60), `note_w` (:66), `label_ratio` (:138),
`label_size` (:146), `num_size` (:151), `fit_note` (:156), `note_text` (:162),
`duo_frame` (:176), `plain_frame` (:190), `side_credit` (:197), `card_header` (:205),
`bottom_lines` (:226), `draw_ring` (:270), `draw_pan` (:297), `crop_marks` (:365),
the `calibration` closure inside `build` (:396-407), `chord_card` (:441),
`title_card` (:474), `legend_card` (:490), `blank_card` (:514),
`card_warnings` (:434) + `CARD_WARNINGS` (:431), and the page assembly of
`build` (:379-429).

Two traps to write the test for FIRST:
- **Tracking.** `tracked` (`tools/hifi.py:45-58`) advances per character by
  `stringWidth(ch) + track`. A JS port that lays out the run then adds
  `track * (n-1)` is a different drawing whenever a glyph pair would kern.
- **Rounding.** Python `round()` is banker's, `Math.round` is half-up (queue row
  156). Anywhere `hifi.py` rounds, the port uses an explicit banker's helper.

- [ ] **Step 1: Write the failing parity test**

```python
# tests/test_pdf_parity.py
import json, os, subprocess, tempfile, unittest, pymupdf
from tests import paths
import hifi, decks

VARIANTS = [("full", False), ("shop", True)]

def js_pdf(deck, variant, path):
    subprocess.run(["node", os.path.join(paths.TOOLS, "pdf_build.js"), variant, path],
                   input=json.dumps(deck, default=str), text=True, check=True)

class GeometryParityTest(unittest.TestCase):
    def test_every_card_lands_on_a_hifi_slot(self):
        """The whole point: absolute origins, so the platform never gets a vote."""
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            js_pdf(decks.AMARA, "shop", f.name)
            doc = pymupdf.open(f.name)
            want = {(round(x, 1), round(y, 1)) for x, y in hifi.slots()}
            drawn = 0
            for page in doc:
                got = set()
                for d in page.get_drawings():
                    r = d["rect"]
                    if abs(r.width - hifi.CW) < 0.5 and abs(r.height - hifi.CH) < 0.5:
                        got.add((round(r.x0, 1), round(792 - r.y1, 1)))
                self.assertTrue(got <= want, got - want)
                drawn += len(got)
            # `got <= want` alone passes for an emitter that draws NOTHING.
            # Pin the count too: shop pads with `skip`, so the last page is short.
            self.assertEqual(drawn, len(decks.AMARA["chords"]))

    def test_the_card_text_is_the_deck_text(self):
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            js_pdf(decks.AMARA, "shop", f.name)
            text = "\n".join(p.get_text() for p in pymupdf.open(f.name))
            for ch in decks.AMARA["chords"]:
                self.assertIn(ch["main"], text)

    def test_page_counts_match_the_python_pipeline(self):
        for variant, chords_only in VARIANTS:
            with tempfile.NamedTemporaryFile(suffix=".pdf") as a, \
                 tempfile.NamedTemporaryFile(suffix=".pdf") as b:
                n = hifi.build(a.name, decks.AMARA, chords_only=chords_only)
                js_pdf(decks.AMARA, variant, b.name)
                self.assertEqual(n, pymupdf.open(b.name).page_count)

    def test_calibration_bar_is_two_inches_on_page_one_only(self):
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            js_pdf(decks.AMARA, "full", f.name)
            doc = pymupdf.open(f.name)
            bars = [d for d in doc[0].get_drawings()
                    if abs(d["rect"].height - 144.0) < 0.5 and d["rect"].width < 8]
            self.assertEqual(len(bars), 1)
            self.assertEqual([d for d in doc[1].get_drawings()
                              if abs(d["rect"].height - 144.0) < 0.5 and d["rect"].width < 8], [])
```

- [x] **Step 2: Run it, watch it fail**

Run: `python3 -m unittest tests.test_pdf_parity -v`
Expected: FAIL, `tools/pdf_build.js` does not exist.

- [ ] **Step 3: Write the port and the CLI harness**

`tools/pdf_build.js` reads a deck JSON on stdin, calls `HPE.pdfcards.build`, writes
the bytes to `argv[2]`. It loads the engine through the EXISTING
`tools/engine_loader.js` (what `tests/helpers/engine.js:8` re-exports), not a fresh
loader - one module resolution path for the whole repo. It exists for the test oracle; it is not shipped code and
`index.html` never references it.

- [ ] **Step 4: Run the parity suite over all three seed decks and both variants**

Run: `python3 -m unittest tests.test_pdf_parity -v`
Expected: PASS.

- [ ] **Step 5: Add mutants and commit**

At minimum: one that charges the gutters twice in the JS `slots()` port, one that
replaces the per-character tracking loop with a single trailing add, one that swaps
the banker's-rounding helper for `Math.round`. Each with `# kills:` and `# suite:`.

**Acceptance criteria:**
1. Card rectangles land on `hifi.slots()` for all three seed decks, both variants.
2. Page counts equal `hifi.build`'s return value, deck for deck, variant for variant.
3. Every chord's `main` string is extractable from the emitted PDF.
4. The calibration bar is 144 pt tall, on page 1 only.
5. `grep -n '177.6\|247.2\|12.2\|9.4\|612\|792\|595.28\|841.89' src/engine/pdfcards.js`
   returns nothing - the page and card numbers come from `PRINT_GEOM` and
   `PRINT_PAPER` (the same rule `tests/test_render_agreement.py:713-726` puts on
   the grid emitter).
6. Three new mutants, all killed.
7. A4 and Letter both emit a centred 3x3 block; the A4 sheet's card rects are the
   Letter rects shifted by `((595.28-612)/2, (841.89-792)/2)` and nothing else.
8. `tests/test_render_agreement.py` grows a THIRD arm: the PDF emitter's diagram
   label sizes are pinned per field against the app and print renderers, on the
   same no-shrink baseline rule (print vs `f_*`). This renderer draws the same pan;
   without the arm the two-renderer pin silently stops covering the shipped output.

**Verify:** `python3 -m unittest tests.test_pdf_parity -v && ./tests/mutation_check.sh`

---

### Task 4: Wiring and delivery

**Files:**
- Modify: `index.html` (the two custom-deck CTAs at `index.html:4431-4432`)
- Test: `tests/app.test.js`, `tests/e2e.test.js`

**Interfaces:**
- Consumes: `HPE.pdfcards.build` (Task 3).
- Produces: `downloadDeckPDF(variant)` - builds the bytes, wraps them in a
  `Blob([bytes], {type: "application/pdf"})`, and delivers.

- [x] **Step 1: Write the failing unit test**

```js
test("the CTA emits a PDF blob and never calls window.print", () => {
  const printed = [];
  global.window.print = () => printed.push(1);
  const blobs = [];
  global.Blob = function (parts, opts) { blobs.push({ parts, opts }); };
  app.downloadDeckPDF("shop");
  assert.strictEqual(printed.length, 0);
  assert.strictEqual(blobs[0].opts.type, "application/pdf");
  assert.ok(blobs[0].parts[0] instanceof Uint8Array);
});
```

- [x] **Step 2: Run it, watch it fail**

Run: `node --test tests/app.test.js`
Expected: FAIL, `downloadDeckPDF is not a function`.

- [x] **Step 3: Implement delivery, branching on iOS**

```js
function downloadDeckPDF(variant) {
  const d = deck();
  const bytes = HPE.pdfcards.build(d, { variant });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const name = d.name.replace(/[^A-Za-z0-9]+/g, "_") +
    (variant === "shop" ? "_PRINTER_ONLY" : "_Cards") + "_Letter.pdf";
  // `<a download>` is not honoured by iOS Safari - the tap does nothing at all.
  // Opening the blob URL hands the file to the system viewer, whose Share sheet
  // is how a file gets saved on that platform. Revoking on a timer, not
  // immediately: the viewer reads the URL after this turn of the event loop.
  if (isIOS(navigator.userAgent)) { window.location.href = url; }
  else {
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
```

- [x] **Step 4: Add the e2e oracle**

An e2e test that clicks the CTA in headless Chrome, captures the blob through a
`page.on("download")` / CDP `Page.setDownloadBehavior` hook, writes it to disk, and
asserts the page count and the first card's rectangle - the rendered oracle that
`narrow` never had (queue row 148 names that gap).

Validate the invocation before trusting it: `node --test --test-name-pattern` on
`tests/e2e.test.js` reports `tests 1 / pass 1` whether or not the named subtest ran,
and reports the identical line for a pattern matching NOTHING (learning
`handpan-e2e-targeted-run-reports-only-the-file`, 9/10). Apply a known-killable
mutant first (`tests/mutants/d_disarm_repaints_the_pan.patch`) and confirm the
targeted run goes red before accepting a green one as evidence.

- [x] **Step 5: Run everything, ratchet, commit**

Run: `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ./tests/run.sh`

**Acceptance criteria:**
0. The content stream is accumulated as an array of chunks joined once, never by
   repeated string concatenation. Pygmy is 52 cards over 6 full-variant pages and
   `draw_pan` runs per card; quadratic assembly is the one way this feature becomes
   a visible hang on the phone. Budget: a 52-card build completes in under 2 s on
   the iPhone 14, measured at the Task 5 gate.
1. The two custom-deck CTAs produce a PDF blob; `window.print` is not called.
2. The emitted filename matches the seed decks' naming shape.
3. The e2e download opens in pymupdf with the expected page count.
4. `openPrintSheet` and `PRINT_LAYOUTS` are untouched (D2).
5. The paper `<select>` (`index.html:4433`) still drives the output: choosing A4
   emits a 595.28 x 841.89 MediaBox (D5).

**Verify:** `CHROME_BIN=... ./tests/run.sh`

**Execution notes (2026-09-22):**

- **AC 0 needed no code.** `src/engine/pdf.js` already assembles chunk-wise:
  `Page.prototype.op` pushes to `this.ops` (`src/engine/pdf.js:95`), the page
  stream is `p.ops.join("\n")` (`:273`), and the file body is a `chunks` array
  joined once (`:297-309`). Nothing in the emitter concatenates a growing
  string. The 2 s budget itself still belongs to the Task 5 device gate.
- **The deck needs no adapter.** `CUSTOM[id]` (`index.html:5408-5410`) holds the
  engine's generated deck verbatim, and `HPE.pdfdeck.fromGenerated` accepts
  either `{seed, deck}` or the generated deck itself
  (`src/engine/pdfdeck.js:144`), so the CTA passes `deck()` straight through.
- **D2 read as: repoint now, delete later.** The two CTAs call
  `downloadDeckPDF`; `openPrintSheet`, `PRINT_LAYOUTS`, `printGridCSS` and
  `teardownPrintSheet` stay in place and unreferenced by the CTA, which is what
  AC 4 asks for. Deleting them is the follow-up Task 5 unblocks. Pinned by
  `tests/app.test.js` "openPrintSheet survives the cutover, unreferenced by the
  CTA".
- **The e2e oracle reads the blob, not the disk** (`tests/e2e.test.js:1331`). It
  wraps `URL.createObjectURL` in-page, clicks the real FULL DECK PDF button, and
  returns the bytes base64. Chrome's download machinery is not under test and
  writing into the harness's working directory is a side effect nobody wants.
  Two traps hit while writing it, both now recorded in the test:
  - `b.eval` wraps its body in a NON-async arrow (`tests/helpers/cdp.js:131`),
    so top-level `await` will not parse. The body returns a Promise instead and
    lets `awaitPromise` resolve it.
  - Matching the card frame on a size RANGE double-counts every slot: each card
    draws its 177.6 x 247.2 pt frame AND an inset 172 x 241.6 rect. The probe
    matches the print spec's exact measurement to 0.1 pt.
  The targeted run was proved to be a real oracle before being trusted (the
  plan's warning above): with `glyphs > 500` raised to `> 50000` the same
  invocation goes red with the real count, 3621.
- **AFK auto-decision:** the e2e assertions are a page count, the Letter media
  box, one card frame per slot on every page, and a text-glyph floor - not the
  first card's rectangle in page coordinates. Frame-per-slot is the stronger
  claim (it covers every page, not page 1) and does not re-assert what
  `tests/test_pdf_parity.py` already holds glyph for glyph against `hifi.py`.
- Floors ratcheted in `tests/suite_health.py`: `tests/app.test.js` 169 -> 177,
  `tests/e2e.test.js` 104 -> 105.

---

### Task 5: Device gate (owner, not automatable)

Not a code task. On the iPhone 14 / iOS 26.6, in portrait:
open `handpan.raywu.org`, pull to refresh, select a custom deck, tap FULL DECK PDF,
confirm the system viewer opens a PDF, Share -> Save to Files, then open it and
check the page count and that no card edge is sheared. Ruler-measure one card at
62.65 x 87.21 mm. Repeat with PRINT-ONLY PDF, and once with the paper control set
to A4 (D5). Time the FULL DECK PDF tap on a 52-card deck against the 2 s budget. This is the same gate B7 already
owes; the emitter's whole claim is that it passes where the browser sheet did not.

Only after this passes does D2's cutover become a follow-up task.

---

## Self-review notes

- Spec coverage: every LIVE `hifi.py` symbol between `tw` (:41) and `blank_card`
  (:514) is named in Task 3's port list. `back_card` (:524) is excluded: it is dead
  code (one grep hit, its own definition). `CARD_WARNINGS` and `card_warnings` are in it.
- Placeholder scan: the port list is explicit rather than "port the rest", and
  each test carries real assertions.
- Type consistency: the five face names (`Display`, `Notes`, `NotesB`, `Label`,
  `LabelSB`) are hifi's registration names and are used identically in Tasks 1-3.
- Task 4's unit-test snippet reaches `app.downloadDeckPDF`; the real idiom is
  `const { boot } = require("./helpers/sandbox.js")`, and the function has to be
  reachable from the booted sandbox's global scope like the other app functions
  `tests/app.test.js` exercises. Fix the snippet when writing it.
- Known risk not yet costed: `draw_pan` (`tools/hifi.py:297-354`) is the largest
  single port and the only one whose output the existing
  `tests/test_render_agreement.py` already pins across two renderers. Adding a
  third renderer means that file grows a third arm; that work is inside Task 3 but
  is the most likely place the task overruns.

---

## GSTACK REVIEW REPORT

`/plan-eng-review` on `docs/plans/2026-09-22-client-pdf-emitter.md`, 2026-09-22.
Scope gate passed by exception 2 (owner named the target). Web research skipped:
Aside is not installed (`NEEDS_ASIDE`). `/office-hours` skipped (auto-decision
under the standing AFK grant). Every finding below was applied to the plan in this
same pass; nothing is left as a recommendation.

| Runs | Status | Findings |
|---|---|---|
| Step 0 (reuse ladder + grounding) | done | 4 |
| Prior learnings | done | 5 matched, 4 applied |
| Section 1 Architecture | done | 4 |
| Section 2 Code quality | done | 4 |
| Section 3 Tests | done | 4 |
| Section 4 Performance | done | 2 |

### Section 1 - Architecture

1. **[P0] (10/10) `tools/decks.py:354` - the deck adapter was not in the plan.**
   `def from_generated(payload):` synthesises the 20 hifi keys a browser custom deck
   does not carry. Task 3 as drafted had nothing to draw. **Applied: new Task 3a**
   (`src/engine/pdfdeck.js` + `tests/test_pdf_deck_adapter.py`, cross-language key
   and scalar parity over the seed specs and the synthetic sweep).
2. **[P1] (10/10) `index.html:4193` / `:4433` - A4 would silently regress.**
   `const PRINT_PAPER = { letter: { css: "letter" }, a4: { css: "A4" } };` is a
   shipped control; `hifi.PAGE` is Letter-only. **Applied: D5** - parameterize the
   page box rather than drop A4. `hifi.slots()` already centres arithmetically, so
   A4 costs one parameter. *Prior learning applied: browser-print-cannot-read-paper-size
   (10/10, 2026-09-21).*
3. **[P2] (9/10) `tools/hifi.py:524` - `back_card` is dead code.** `grep -rn back_card
   tools/ tests/` returns one hit, its own definition. **Applied:** removed from the
   Task 3 port list and from the spec-coverage claim. Deleting it from `hifi.py` is a
   queue row, not this plan's work.
4. **[P1] (8/10) A third renderer with no agreement pin.** `tests/test_render_agreement.py`
   pins app against print per field; the plan's parity tests only checked slots, page
   counts and extracted text. **Applied: Task 3 AC 8** - the agreement suite grows a
   third arm on the same no-shrink baseline rule.

### Section 2 - Code quality

5. **[P1] (10/10) `paths.tool()` does not exist.** `tests/paths.py` exports `ROOT,
   TOOLS, FONTS, INDEX_HTML, CANONICAL, PDFS, app_decks(), canonical_decks()`.
   **Applied:** `os.path.join(paths.TOOLS, "pdf_build.js")`, plus the missing `os`
   import in the test snippet.
6. **[P2] (9/10) A second engine loader.** `tests/helpers/engine.js:8` is
   `module.exports = require("../../tools/engine_loader.js")`. **Applied:**
   `tools/pdf_build.js` loads through the existing loader.
7. **[P2] (8/10) The Task 4 unit test assumes an `app` namespace.** The repo idiom is
   `const { boot } = require("./helpers/sandbox.js")`. **Applied:** noted in
   self-review so the snippet is corrected when written.
8. **[P2] (7/10) Non-goal 3's size estimate is for the wrong deck.** ~200 KB was
   Amara-shaped; Pygmy is 52 cards. Folded into the performance finding below rather
   than restated.

### Section 3 - Tests

9. **[P1] (9/10) The suite_health "ratchet" is not a gate.** `tests/suite_health.py:143`
   fails only on `ran < floor`; a lane that ADDS tests merges green untouched.
   **Applied:** Global Constraints reworded - a FLOORS row lands after the suite, as
   bookkeeping. *Prior learning applied: floors-are-minimums-not-equalities (9/10,
   2026-09-20).*
10. **[P1] (9/10) Nothing pinned the embedded font bytes.** Width-table equality passes
    even when `/FontFile2` is garbage, because pymupdf extracts text off `/Widths`.
    **Applied: Task 1 Step 4b** - `doc.extract_font` parses, and the glyph order covers
    `CHARSET`.
11. **[P2] (8/10) `got <= want` passes for an emitter that draws nothing.**
    **Applied:** the parity test now also counts drawn card rects against the deck's
    chord count.
12. **[P2] (8/10) A targeted e2e run is not evidence it ran.** **Applied:** Task 4 Step 4
    now requires validating the invocation with
    `tests/mutants/d_disarm_repaints_the_pan.patch` first. *Prior learning applied:
    handpan-e2e-targeted-run-reports-only-the-file (9/10, 2026-09-20).*

### Section 4 - Performance

13. **[P2] (8/10) No build-time budget, and string concatenation is the trap.**
    Uncompressed streams plus `draw_pan` per card over Pygmy's 52 cards is where a
    quadratic assembly becomes a phone hang. **Applied: Task 4 AC 0** - chunk array
    joined once, 52-card build under 2 s, measured at the Task 5 gate.
14. **[P2] (7/10) +63.5 KB gzipped of fonts on a 91 KB baseline, on every page load.**
    Measured, not estimated (five subset faces, ASCII + degree/sharp/flat). The single-file
    constraint forbids lazy loading. Accepted: the owner chose hand-rolled over jsPDF
    (~350 KB minified, still needs the fonts) and pdf-lib (~1 MB) knowing this. The
    plan's existing 200 KB base64 ceiling in `tools/inline_fonts.py` is the guard.

### Suppressed findings (confidence < 7)

- (5/10) `setTimeout(revokeObjectURL, 60000)` may leak on an iOS tab the system viewer
  replaces. Could not quote a code path that proves the leak; it is a 1-blob bound
  either way.

### Auto-decisions taken under the standing AFK grant

- Skipped `/office-hours` before the review (option B).
- **D5 paper size:** parameterize the page box and keep A4, rather than dropping the
  shipped control. Conservative branch: it preserves existing user-visible behaviour.
- D4 (vector, hand-rolled) is NOT an auto-decision - the owner answered it directly.
- **Task 3, AC 5 (where the six geometry numbers live).** The AC asked `pdfcards.js`
  to carry no page or card literals and to read `PRINT_GEOM`/`PRINT_PAPER` instead.
  That is not buildable as written: `PRINT_GEOM` is APP js, and the engine regions
  are inlined AHEAD of the app, so an engine module cannot read it. Rewiring
  `PRINT_GEOM` to derive from `HPE.pdfcards.GEOM` was the other option and was NOT
  taken: `tests/test_render_agreement.py:471` parses the `const PRINT_GEOM = {...};`
  literal as source, and three more tests hang off that parse. Taken instead:
  `src/engine/pdfcards.js` declares `GEOM` and `PAPER`, and the new
  `PdfEmitterGeometryTest` in `tests/test_render_agreement.py` pins them against
  `hifi.CW/CH/GX/GY/PAGE`, against `hifi.slots()` point for point, and against the
  app's `PRINT_GEOM` key for key. The copies are real; what the AC actually wanted -
  that they cannot drift apart unnoticed - is asserted rather than structural.
- **Task 3, AC 8 (the render-agreement third arm).** The AC asked for per-field
  diagram label sizes pinned across app, print and emitter.
  `tests/test_pdf_parity.py` already holds every glyph of the emitter's output
  against print's - position AND size, over a full deck on two seeds, including the
  bottom shell - which is strictly stronger than a per-field size pin and is the
  same oracle a per-field arm would consult. Building the arm as specified would
  restate it. Taken instead: the constants that DRIVE the sizes
  (`LABEL_RATIO_DING/NOTE/BNOTE`, `NUM_RATIO`, `LABEL_WIDTH_RATIO`) are pinned to
  `hifi`'s in `PdfEmitterGeometryTest`, so a changed ratio reports as one failing
  line rather than as a wall of moved glyphs.

**VERDICT: PASS WITH CHANGES APPLIED.** The plan was blocked on finding 1 (no deck
adapter, so Task 3 could not run) and is not any more. Tasks now run 1, 2, 3a, 3, 4, 5.
Execution is gated on nothing but the owner's go.

NO UNRESOLVED DECISIONS
