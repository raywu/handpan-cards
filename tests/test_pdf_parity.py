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


@unittest.skipIf(fitz is None, "pymupdf is required")
class PrintParityTest(unittest.TestCase):
    def _pair(self, seed, variant):
        payload = _generate(seed)
        deck = decks.from_generated(payload)
        tmp = tempfile.mkdtemp()
        py_path = os.path.join(tmp, "py.pdf")
        js_path = os.path.join(tmp, "js.pdf")
        hifi.build(py_path, deck, chords_only=(variant == "shop"))
        _js_pdf(payload, js_path, variant=variant)
        return _glyphs(py_path), _glyphs(js_path)

    def test_the_sweep_actually_ran(self):
        # An empty seed list is a passing parity test that proves nothing.
        self.assertGreaterEqual(len(SEEDS), 2)

    def test_every_glyph_lands_where_print_puts_it(self):
        for seed in SEEDS:
            with self.subTest(seed=seed):
                py, js = self._pair(seed, "full")
                self.assertEqual(len(py), len(js), "page count")
                self.assertGreater(sum(len(p) for p in py), 500,
                                   "a deck with no text is not a parity check")
                for i, (a, b) in enumerate(zip(py, js)):
                    self.assertEqual(a, b, "page %d of %s" % (i + 1, seed))

    def test_the_shop_variant_matches_too(self):
        py, js = self._pair(SEEDS[0], "shop")
        self.assertEqual(len(py), len(js))
        for i, (a, b) in enumerate(zip(py, js)):
            self.assertEqual(a, b, "shop page %d" % (i + 1))

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
