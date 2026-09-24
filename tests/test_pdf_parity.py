"""The browser's print sheet against the one tools/hifi.py writes.

`src/engine/pdfcards.js` is a hand port of `tools/hifi.py`, and a hand port
drifts. The unit tests in tests/pdfcards.test.js prove the port's arithmetic
matches in isolation; this file proves the whole drawing matches, by rendering
the same generated deck through both pipelines and comparing what a PDF reader
actually finds on each page - every glyph, where it sits, and how big it is.

Why glyph positions and not bytes: reportlab and the emitter write different
object graphs, different stream compression and a creation date, so the files
never match and never should. What has to match is the drawing.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

from tests import paths

sys.path.insert(0, paths.TOOLS)

import decks  # noqa: E402
import hifi  # noqa: E402

try:
    import fitz  # noqa: E402
except ImportError:  # pragma: no cover - the suite requires pymupdf
    fitz = None

GEN_DECK = os.path.join(paths.TOOLS, "gen_deck.js")
BUILD = os.path.join(paths.TOOLS, "pdf_build.js")
NODE = shutil.which("node") or "node"

# One built-in-shaped pan and one with a bottom shell, because the bottom
# shell is the only zone with its own radius, its own label ratio and its own
# number placement - a port can be right everywhere else and wrong there.
SEEDS = [
    "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5",
]

# The three shipped decks, built through HPE.pdfdeck.fromBuiltin on the JS
# side and decks.HIJAZ/PYGMY/AMARA (tools/decks.py:_from_canonical) on the
# Python side - a SECOND kind of case alongside the generated SEEDS above.
# `_pair`/`_pair_drawings` dispatch on membership in this list.
BUILTINS = ["hijaz", "pygmy", "amara"]

# Every case the glyph/vector sweeps below iterate: generated seeds first
# (unchanged), then the three built-ins.
CASES = SEEDS + BUILTINS

VARIANTS = ("full", "shop")


def _generate(seed):
    proc = subprocess.run([NODE, GEN_DECK, seed], capture_output=True,
                          text=True, cwd=paths.ROOT, timeout=180)
    if proc.returncode != 0:
        raise AssertionError("gen_deck failed for %s: %s" % (seed, proc.stderr))
    return json.loads(proc.stdout)


def _js_pdf(payload, out, variant="full", paper="letter"):
    proc = subprocess.run(
        [NODE, BUILD, "--out", out, "--variant", variant, "--paper", paper],
        input=json.dumps(payload), text=True, capture_output=True,
        cwd=paths.ROOT, timeout=180)
    if proc.returncode != 0:
        raise AssertionError("pdf_build failed: %s" % proc.stderr)


def _js_pdf_builtin(deck_id, out, variant="full", paper="letter"):
    proc = subprocess.run(
        [NODE, BUILD, "--out", out, "--builtin", deck_id,
         "--variant", variant, "--paper", paper],
        input="", text=True, capture_output=True,
        cwd=paths.ROOT, timeout=180)
    if proc.returncode != 0:
        raise AssertionError("pdf_build --builtin %s failed: %s"
                             % (deck_id, proc.stderr))


def _glyphs(path, nd=1):
    """Every character a reader finds, page by page: (x, y, size, char).

    `nd` is the place the positions are rounded to before they are compared.
    The parity comparison wants them rounded (two renderers agree to well
    inside a tenth of a point, and exact float equality would fail on the
    last bit); the paper-shift comparison wants them raw, because rounding
    two shifted copies of the same number can land them on opposite sides of
    a tenth."""
    out = []
    with fitz.open(path) as doc:
        for page in doc:
            rows = []
            for block in page.get_text("rawdict")["blocks"]:
                for line in block.get("lines", ()):
                    for span in line["spans"]:
                        for ch in span["chars"]:
                            rows.append((round(ch["origin"][0], nd),
                                         round(ch["origin"][1], nd),
                                         round(span["size"], 1),
                                         ch["c"]))
            out.append(sorted(rows))
    return out


def _round(obj, nd):
    """A drawing item's geometry, rounded. Points, rects and quads only."""
    if isinstance(obj, fitz.Point):
        return (round(obj.x, nd), round(obj.y, nd))
    if isinstance(obj, fitz.Rect):
        return (round(obj.x0, nd), round(obj.y0, nd),
                round(obj.x1, nd), round(obj.y1, nd))
    if isinstance(obj, fitz.Quad):
        return tuple(_round(getattr(obj, k), nd)
                     for k in ("ul", "ur", "ll", "lr"))
    return obj


def _drawings(path, nd=1):
    """Every vector a reader finds, page by page - the non-text half.

    `_glyphs` above compares the TEXT surface. Everything else the card is
    made of - the frame, the pan circles, the dashed bottom ring, the crop
    marks, the calibration bar - is a path, and until this helper nothing
    compared those across the two emitters. A stroke colour, a fill, a line
    width or a dash pattern could differ between reportlab and the JS
    emitter on every card and every test in this repo still passed, because
    `recorder()` in tests/pdfcards.test.js:22-23 noops setFill, setStroke,
    setLineWidth and setDash.

    The trace is `(type, color, fill, width, dashes, even_odd, items)` per
    drawing: colours to 3 dp, width to 2 dp (None stays None - pymupdf omits
    it on a fill-only path), dashes as the raw string, the fill rule, and
    every item's points rounded to `nd`, the same tenth of a point `_glyphs`
    rounds to.

    `even_odd` is in the trace because the two emitters once disagreed on it:
    reportlab's Canvas defaults to FILL_EVEN_ODD and so `hifi` emitted `f*`
    and `B*`, while `mode()` in src/engine/pdfcards.js hardcoded the nonzero
    `f` and `B`. Every other channel matched, so 297 filled paths per Amara
    sheet differed in their paint operator and nothing here noticed.

    Sorted with `key=repr`, not bare `sorted()`: these tuples hold None
    against float and nested point tuples, neither of which is orderable.
    `repr` is a total order and is stable across the two emitters because
    every value in the tuple has already been rounded."""
    out = []
    with fitz.open(path) as doc:
        for page in doc:
            rows = []
            for d in page.get_drawings():
                rows.append((
                    d["type"],
                    tuple(round(c, 3) for c in (d["color"] or ())),
                    tuple(round(c, 3) for c in (d["fill"] or ())),
                    None if d.get("width") is None else round(d["width"], 2),
                    tuple(d.get("dashes") or ()),
                    d.get("even_odd"),
                    tuple((i[0],) + tuple(_round(x, nd) for x in i[1:])
                          for i in d["items"]),
                ))
            out.append(sorted(rows, key=repr))
    return out


@unittest.skipIf(fitz is None, "pymupdf is required")
class PrintParityTest(unittest.TestCase):
    def _pair(self, case, variant):
        tmp = tempfile.mkdtemp()
        py_path = os.path.join(tmp, "py.pdf")
        js_path = os.path.join(tmp, "js.pdf")
        if case in BUILTINS:
            deck = getattr(decks, case.upper())
            hifi.build(py_path, deck, chords_only=(variant == "shop"))
            _js_pdf_builtin(case, js_path, variant=variant)
        else:
            payload = _generate(case)
            deck = decks.from_generated(payload)
            hifi.build(py_path, deck, chords_only=(variant == "shop"))
            _js_pdf(payload, js_path, variant=variant)
        return _glyphs(py_path), _glyphs(js_path)

    def _pair_drawings(self, case, variant):
        tmp = tempfile.mkdtemp()
        py_path = os.path.join(tmp, "py.pdf")
        js_path = os.path.join(tmp, "js.pdf")
        if case in BUILTINS:
            deck = getattr(decks, case.upper())
            hifi.build(py_path, deck, chords_only=(variant == "shop"))
            _js_pdf_builtin(case, js_path, variant=variant)
        else:
            payload = _generate(case)
            deck = decks.from_generated(payload)
            hifi.build(py_path, deck, chords_only=(variant == "shop"))
            _js_pdf(payload, js_path, variant=variant)
        return _drawings(py_path), _drawings(js_path)

    def _assert_vectors_match(self, case, variant):
        py, js = self._pair_drawings(case, variant)
        self.assertEqual(len(py), len(js), "page count")
        # An empty trace is a passing test that proves nothing, the same
        # reason test_every_glyph_lands_where_print_puts_it holds a floor.
        # The smallest case measured is the Amara shop sheet at 676.
        self.assertGreater(sum(len(p) for p in py), 500,
                           "a deck with no vectors is not a parity check")
        for i, (a, b) in enumerate(zip(py, js)):
            self.assertEqual(a, b, "%s page %d of %s" % (variant, i + 1, case))

    def test_the_sweep_actually_ran(self):
        # An empty seed list is a passing parity test that proves nothing.
        self.assertGreaterEqual(len(SEEDS), 2)
        # Row 321: three of the pdfcards mutants (i, k, l) are all
        # bottom-ring and fire on a bottom-shell seed only, so the
        # oracle's kill power depends on one being present. A count of
        # two does not say that; a bar separator does.
        self.assertTrue(any("|" in s for s in SEEDS),
                        "one seed must carry a bottom shell")

    def test_the_sweep_covers_every_builtin_and_both_variants(self):
        # Review C1's coverage floor: a parameterization that silently
        # dropped a built-in, or dropped a variant from the loops below,
        # must fail here instead of greening a sweep that never ran it.
        # Demonstrated red in the PR body by temporarily removing one
        # built-in id from BUILTINS.
        self.assertEqual(set(BUILTINS), {"hijaz", "pygmy", "amara"})
        self.assertTrue(set(BUILTINS).issubset(set(CASES)),
                        "every built-in must be one of the swept cases")
        self.assertEqual(set(VARIANTS), {"full", "shop"})

    def test_every_glyph_lands_where_print_puts_it(self):
        for case in CASES:
            with self.subTest(case=case):
                py, js = self._pair(case, "full")
                self.assertEqual(len(py), len(js), "page count")
                self.assertGreater(sum(len(p) for p in py), 500,
                                   "a deck with no text is not a parity check")
                for i, (a, b) in enumerate(zip(py, js)):
                    self.assertEqual(a, b, "page %d of %s" % (i + 1, case))

    def test_every_vector_matches_print(self):
        for case in CASES:
            with self.subTest(case=case):
                self._assert_vectors_match(case, "full")

    def test_every_vector_matches_print_in_the_shop_variant(self):
        # PRINTER_ONLY drops the title and legend cards, so it draws a
        # different set of vectors - and on a different page break.
        for case in CASES:
            with self.subTest(case=case):
                self._assert_vectors_match(case, "shop")

    def test_the_shop_variant_matches_too(self):
        # Glyph parity (not just vector parity) in the shop variant, for
        # every case - generated seeds and all three built-ins alike.
        for case in CASES:
            with self.subTest(case=case):
                py, js = self._pair(case, "shop")
                self.assertEqual(len(py), len(js))
                for i, (a, b) in enumerate(zip(py, js)):
                    self.assertEqual(a, b, "shop page %d of %s" % (i + 1, case))

    def test_a4_is_letter_shifted_on_the_page(self):
        # Same drawing, re-centred. Every card glyph moves by exactly the same
        # offset, so a port that rescaled the grid to the page fails here even
        # though its Letter output is perfect.
        #
        # Page 1 is excluded: the calibration bar is a ruler in the margin,
        # drawn at a fixed page coordinate rather than off the card grid, so
        # it deliberately does NOT move with the cards.
        payload = _generate(SEEDS[0])
        tmp = tempfile.mkdtemp()
        a = os.path.join(tmp, "letter.pdf")
        b = os.path.join(tmp, "a4.pdf")
        _js_pdf(payload, a, paper="letter")
        _js_pdf(payload, b, paper="a4")
        dx = (595.28 - 612) / 2
        # y is measured DOWN from the top of the page by the reader, so a
        # y-up shift of dy reads as a shift of (841.89 - 792) - dy.
        dy_read = (841.89 - 792) - (841.89 - 792) / 2
        letter, a4 = _glyphs(a, nd=6)[1:], _glyphs(b, nd=6)[1:]
        self.assertGreaterEqual(len(letter), 1, "need a page without the bar")
        self.assertEqual(len(letter), len(a4))
        for i, (pa, pb) in enumerate(zip(letter, a4)):
            self.assertGreater(len(pa), 100)
            self.assertEqual(len(pa), len(pb))
            for ga, gb in zip(pa, pb):
                self.assertAlmostEqual(gb[0] - dx, ga[0], places=3,
                                       msg="page %d x" % (i + 2))
                self.assertAlmostEqual(gb[1] - dy_read, ga[1], places=3,
                                       msg="page %d y" % (i + 2))
                self.assertEqual((gb[2], gb[3]), (ga[2], ga[3]))


if __name__ == "__main__":
    unittest.main()
