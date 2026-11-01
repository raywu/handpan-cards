"""The favicon, the touch icon, the link-preview image and the header lockup.

`brand/*.svg` is the ONLY copy of the logo. `tools/make_icons.py`, a sync step
like `inline_engine.py`, writes three things from it: the SVG favicon data URI
in `index.html` (from `mark-small.svg`), the `brand:lockup` region in the app
header (from `horizontal-full.svg`), and `apple-touch-icon.png` / `og.png`
(rendered from `app-icon-full.svg` / `stacked-full.svg`). Byte equality is not
the PNG oracle - PyMuPDF is unpinned in CI, so anti-aliasing may differ by a
version - a pixel tolerance is, and the negative test below proves the
tolerance still fails on a recoloured source. The favicon URI and the lockup
region are text, compared exactly.
Plan: docs/plans/2026-10-31-logo-in-app.md (D3, D5, D7).
"""
import os
import re
import sys
import unittest

import fitz

from tests import paths

sys.path.insert(0, paths.TOOLS)

import make_icons  # noqa: E402

TOUCH = os.path.join(paths.ROOT, "apple-touch-icon.png")
OG = os.path.join(paths.ROOT, "og.png")


def brand(name):
    with open(os.path.join(paths.ROOT, "brand", name), encoding="utf-8") as f:
        return f.read()


class IconFilesTest(unittest.TestCase):
    def test_the_pngs_have_their_declared_sizes(self):
        touch = fitz.Pixmap(TOUCH)
        self.assertEqual((touch.width, touch.height), (180, 180))
        og = fitz.Pixmap(OG)
        self.assertEqual((og.width, og.height), (1200, 630))

    def test_the_pngs_are_current_against_their_brand_sources(self):
        verdicts = make_icons.check()
        stale = {name: frac for name, (ok, frac) in verdicts.items() if not ok}
        self.assertEqual(stale, {}, f"stale PNGs (differing fraction): {stale}")

    def test_the_favicon_uri_is_the_encoded_mark_small_tile(self):
        html = open(paths.INDEX_HTML, encoding="utf-8").read()
        href = make_icons.ICON_RE.search(html).group(1)
        self.assertEqual(href, make_icons.favicon_href(brand("mark-small.svg")))
        self.assertIsNone(make_icons.favicon_drift())

    def test_the_extracted_svg_is_the_one_the_app_test_decodes(self):
        svg = make_icons.extract_svg(paths.INDEX_HTML)
        self.assertTrue(svg.startswith("<svg"), svg[:40])
        self.assertIn("viewBox='0 0 64 64'", svg)
        self.assertIn("<circle cx='32' cy='32' r='32' fill='#0f0e0b'/>", svg)
        self.assertIn("<g transform='translate(6 19.35) scale(0.09391)'>", svg)
        self.assertGreaterEqual(svg.count("#E6C99B"), 8)
        self.assertIn("id='fav-smm'", svg)
        self.assertIn("url(#fav-smm)", svg)
        self.assertNotIn("id='smm'", svg)
        for banned in ("#0B7B75", "#DD8F00", "<title", "role=", "aria-label"):
            self.assertNotIn(banned, svg)

    def test_the_lockup_region_is_the_stripped_prefixed_horizontal_full(self):
        html = open(paths.INDEX_HTML, encoding="utf-8").read()
        m = re.search(r"<!-- brand:lockup begin -->\n(.*)\n<!-- brand:lockup end -->", html, re.S)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), make_icons.lockup_svg(brand("horizontal-full.svg")))
        self.assertIsNone(make_icons.lockup_drift())
        svg = m.group(1)
        for banned in ("role=", "aria-label", "<title"):
            self.assertNotIn(banned, svg)
        want = ["hpt-" + i for i in ["hfb", "hfg", "hfs", "hfm", "hfo"] + ["hfL%d" % n for n in range(6)]]
        self.assertEqual(sorted(re.findall(r'\bid="([^"]+)"', svg)), sorted(want))

    def test_a_changed_source_fails_its_own_check(self):
        for name, png in (("app-icon-full.svg", make_icons.TOUCH_PNG),
                          ("stacked-full.svg", make_icons.OG_PNG)):
            svg = brand(name)
            mutated = svg.replace("#44E0D8", "#f4f0e8")
            self.assertNotEqual(mutated, svg, name)
            ok, frac = make_icons.check(sources={png: mutated})[png]
            self.assertFalse(ok, f"{png}: a recoloured source passed the check")
            self.assertGreater(frac, make_icons.MAX_DIFFERING_FRACTION)
        mark = brand("mark-small.svg")
        mutated = mark.replace("#E6C99B", "#f4f0e8")
        self.assertNotEqual(mutated, mark)
        self.assertIsNotNone(make_icons.favicon_drift(mark=mutated),
                             "a recoloured mark-small passed the favicon check")
        horiz = brand("horizontal-full.svg")
        self.assertIsNotNone(make_icons.lockup_drift(horizontal=horiz.replace("#44E0D8", "#f4f0e8")),
                             "a recoloured horizontal-full passed the lockup check")


if __name__ == "__main__":
    unittest.main()
