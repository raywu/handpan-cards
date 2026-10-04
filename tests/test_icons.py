"""The favicon, the touch icon and the link-preview image.

`index.html` holds the ONLY copy of the icon (an SVG data URI); `apple-touch-
icon.png` and `og.png` are rendered from it by `tools/make_icons.py`, a sync
step like `inline_engine.py`. Byte equality is not the oracle - PyMuPDF is
unpinned in CI, so anti-aliasing may differ by a version - a pixel tolerance
is, and the negative test below proves the tolerance still fails on a changed
icon. Plan: docs/plans/2026-10-04-name-and-favicon.md section 4, tests 5-8.
"""
import os
import sys
import unittest

import fitz

from tests import paths

sys.path.insert(0, paths.TOOLS)

import make_icons  # noqa: E402

TOUCH = os.path.join(paths.ROOT, "apple-touch-icon.png")
OG = os.path.join(paths.ROOT, "og.png")


class IconFilesTest(unittest.TestCase):
    def test_the_pngs_have_their_declared_sizes(self):
        touch = fitz.Pixmap(TOUCH)
        self.assertEqual((touch.width, touch.height), (180, 180))
        og = fitz.Pixmap(OG)
        self.assertEqual((og.width, og.height), (1200, 630))

    def test_the_pngs_are_current_against_the_svg_in_index_html(self):
        verdicts = make_icons.check()
        stale = {name: frac for name, (ok, frac) in verdicts.items() if not ok}
        self.assertEqual(stale, {}, f"stale PNGs (differing fraction): {stale}")

    def test_the_extracted_svg_is_the_one_the_app_test_decodes(self):
        svg = make_icons.extract_svg(paths.INDEX_HTML)
        self.assertTrue(svg.startswith("<svg"), svg[:40])
        self.assertIn("viewBox='0 0 64 64'", svg)
        self.assertEqual(svg.count("fill='#0B7B75'"), 1)
        self.assertEqual(svg.count("fill='#DD8F00'"), 2)

    def test_a_changed_icon_fails_the_tolerance_check(self):
        svg = make_icons.extract_svg(paths.INDEX_HTML)
        mutated = svg.replace("fill='#0B7B75'", "fill='#f4f0e8'")
        self.assertNotEqual(mutated, svg)
        verdicts = make_icons.check(svg=mutated)
        for name, (ok, frac) in verdicts.items():
            self.assertFalse(ok, f"{name}: a recoloured root field passed the check")
            self.assertGreater(frac, make_icons.MAX_DIFFERING_FRACTION)


if __name__ == "__main__":
    unittest.main()
