"""The favicon, the touch icon, the link-preview image and the header lockup.

`brand/*.svg` is the ONLY copy of the logo (Field guide / Two contours: one
vector master traced from the approved master, docs/plans/assets/2026-11-02-
field-guide/approved-logo-master.png). `tools/make_icons.py`, a sync step like
`inline_engine.py`, writes from it: the SVG favicon data URI in `index.html`
(from `mark.svg` on a square tile), the `brand:lockup` region in the app header
(from `horizontal-full.svg`), `apple-touch-icon.png` / `og.png` (rendered from
`app-icon-full.svg` / `stacked-full.svg`) and the reading-header @2x/@3x PNGs. Byte equality is not
the PNG oracle - PyMuPDF is unpinned in CI, so anti-aliasing may differ by a
version - a pixel tolerance is, and the negative test below proves the
tolerance still fails on a recoloured source. The favicon URI and the lockup
region are text, compared exactly.
Plan: docs/plans/2026-10-31-logo-in-app.md (D3, D5, D7).
"""
import os
import re
import sys
import struct
import unittest

import fitz

from tests import paths

sys.path.insert(0, paths.TOOLS)

import make_icons  # noqa: E402

MASTER_PNG = os.path.join(paths.ROOT, "docs", "plans", "assets", "2026-11-02-field-guide",
                          "approved-logo-master.png")
TOUCH = os.path.join(paths.ROOT, "apple-touch-icon.png")
OG = os.path.join(paths.ROOT, "og.png")
ICO = os.path.join(paths.ROOT, "favicon.ico")


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

    def test_the_favicon_uri_is_the_encoded_mark_tile(self):
        html = open(paths.INDEX_HTML, encoding="utf-8").read()
        href = make_icons.ICON_RE.search(html).group(1)
        self.assertEqual(href, make_icons.favicon_href(brand("mark.svg")))
        self.assertIsNone(make_icons.favicon_drift())

    def test_the_extracted_svg_is_the_one_the_app_test_decodes(self):
        svg = make_icons.extract_svg(paths.INDEX_HTML)
        self.assertTrue(svg.startswith("<svg"), svg[:40])
        self.assertIn("viewBox='0 0 64 64'", svg)
        self.assertIn("<rect width='64' height='64' fill='#0F0E0B'/>", svg)
        self.assertNotIn("<circle", svg, "the tile is square, not round")
        self.assertGreaterEqual(svg.count("#F6F4ED"), 1)
        for banned in ("#E6C99B", "#44E0D8", "#0B7B75", "#DD8F00", "<title", "role=", "aria-label"):
            self.assertNotIn(banned, svg)

    def test_the_favicon_mark_keeps_12_percent_clear_space_on_the_tile(self):
        # A7: the master is fitted centred with 12% clear space on every side
        pix = make_icons.raster(make_icons.extract_svg(paths.INDEX_HTML), 640)
        x0, y0, x1, y1 = pix.width, pix.height, 0, 0
        for y in range(pix.height):
            for x in range(pix.width):
                r, g, b = pix.pixel(x, y)[:3]
                if r > 128:
                    x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
        self.assertAlmostEqual(x0 / 640, 0.12, delta=0.01)
        self.assertAlmostEqual((640 - 1 - x1) / 640, 0.12, delta=0.01)
        self.assertAlmostEqual((y0 + (640 - 1 - y1)) / 2 / 640, (640 - (x1 - x0) * 979 / 1154) / 2 / 640, delta=0.01)

    def test_the_vector_mark_matches_the_approved_master_within_two_percent(self):
        # A15 / A24: both flattened onto #0F0E0B RGB at 1154 px
        master = fitz.Pixmap(MASTER_PNG)
        self.assertEqual((master.width, master.height), (1154, 979))
        frac = make_icons.master_differing_fraction(brand("mark.svg"))
        self.assertLessEqual(frac, 0.02, f"vector mark differs from the master in {frac:.2%} of pixels")

    def test_every_mark_consumer_embeds_the_same_master_path(self):
        d = re.search(r'<path d="([^"]+)"', brand("mark.svg")).group(1)
        self.assertGreater(len(d), 2000)
        for name in ("horizontal-full.svg", "horizontal-mono-light.svg", "stacked-full.svg", "app-icon-full.svg"):
            self.assertIn(d, brand(name), name)
        self.assertIn(d.replace('"', "'"), make_icons.extract_svg(paths.INDEX_HTML))

    def test_the_wordmark_is_the_full_name_with_no_abbreviation(self):
        for name in ("horizontal-full.svg", "horizontal-mono-light.svg", "stacked-full.svg"):
            svg = brand(name)
            self.assertIn('aria-label="Handpan Theory"', svg)
            self.assertIn("<title>Handpan Theory</title>", svg)
            self.assertNotIn("HPT", svg)

    def test_the_mono_light_lockup_is_the_ink_recolour_of_the_ivory_one(self):
        full, mono = brand("horizontal-full.svg"), brand("horizontal-mono-light.svg")
        self.assertEqual(full.replace("#F6F4ED", "#242424"), mono)

    def test_the_reading_header_rasters_are_current_and_slot_sized(self):
        for name in make_icons.READING_RASTERS:
            for scale in (2, 3):
                path = os.path.join(paths.ROOT, "brand", "%s@%dx.png" % (name, scale))
                on_disk = fitz.Pixmap(path)
                self.assertEqual((on_disk.width, on_disk.height), (223 * scale, 64 * scale))
        verdicts = make_icons.check()
        self.assertEqual([k for k in verdicts if k.startswith("brand/")].__len__(), 4)
        self.assertEqual({k: v for k, v in verdicts.items() if not v[0]}, {})

    def test_a_stale_reading_raster_fails_the_check(self):
        sources = {"brand/horizontal-full@2x.png": brand("horizontal-full.svg").replace("#F6F4ED", "#44E0D8")}
        ok, frac = make_icons.check(sources=sources)["brand/horizontal-full@2x.png"]
        self.assertFalse(ok)
        self.assertGreater(frac, make_icons.MAX_DIFFERING_FRACTION)

    def test_prefixing_keeps_ids_unique_and_resolving_if_a_source_ever_has_them(self):
        src = ('<svg xmlns="x" viewBox="0 0 1 1" role="img" aria-label="Handpan Theory"><title>T</title>'
               '<defs><mask id="m"/></defs><g mask="url(#m)"/><use href="#m"/></svg>')
        out = make_icons.lockup_svg(src)
        self.assertIn('id="hpt-m"', out)
        self.assertIn("url(#hpt-m)", out)
        self.assertIn('href="#hpt-m"', out)
        self.assertNotIn("role=", out)
        self.assertNotIn("<title", out)

    def test_the_lockup_region_is_the_stripped_prefixed_horizontal_full(self):
        html = open(paths.INDEX_HTML, encoding="utf-8").read()
        m = re.search(r"<!-- brand:lockup begin -->\n(.*)\n<!-- brand:lockup end -->", html, re.S)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), make_icons.lockup_svg(brand("horizontal-full.svg")))
        self.assertIsNone(make_icons.lockup_drift())
        svg = m.group(1)
        for banned in ("role=", "aria-label", "<title"):
            self.assertNotIn(banned, svg)
        self.assertEqual(re.findall(r'\bid="([^"]+)"', svg), [], "the flat Two contours lockup needs no ids")
        self.assertIn('viewBox="0 0 683.93 196"', svg)

    def test_a_changed_source_fails_its_own_check(self):
        for name, png in (("app-icon-full.svg", make_icons.TOUCH_PNG),
                          ("stacked-full.svg", make_icons.OG_PNG)):
            svg = brand(name)
            mutated = svg.replace("#F6F4ED", "#44E0D8")
            self.assertNotEqual(mutated, svg, name)
            ok, frac = make_icons.check(sources={png: mutated})[png]
            self.assertFalse(ok, f"{png}: a recoloured source passed the check")
            self.assertGreater(frac, make_icons.MAX_DIFFERING_FRACTION)
        mark = brand("mark.svg")
        mutated = mark.replace("#F6F4ED", "#44E0D8")
        self.assertNotEqual(mutated, mark)
        self.assertIsNotNone(make_icons.favicon_drift(mark=mutated),
                             "a recoloured mark passed the favicon check")
        horiz = brand("horizontal-full.svg")
        self.assertIsNotNone(make_icons.lockup_drift(horizontal=horiz.replace("#F6F4ED", "#44E0D8")),
                             "a recoloured horizontal-full passed the lockup check")

    def test_a_moved_mark_fails_the_fidelity_gate(self):
        mark = brand("mark.svg")
        moved = mark.replace("<path ", '<path transform="translate(60 0)" ', 1)
        self.assertNotEqual(moved, mark)
        self.assertGreater(make_icons.master_differing_fraction(moved), 0.02)


class FaviconIcoTest(unittest.TestCase):
    def entries(self):
        with open(ICO, "rb") as f:
            data = f.read()
        reserved, kind, count = struct.unpack_from("<HHH", data, 0)
        self.assertEqual((reserved, kind), (0, 1))
        out = []
        for i in range(count):
            w, h, _, _, _, bpp, size, offset = struct.unpack_from("<BBBBHHII", data, 6 + 16 * i)
            out.append((w or 256, h or 256, data[offset:offset + size]))
        return out

    def test_the_ico_holds_16_32_and_48_png_frames(self):
        entries = self.entries()
        self.assertEqual([(w, h) for w, h, _ in entries], [(16, 16), (32, 32), (48, 48)])
        for w, h, blob in entries:
            self.assertTrue(blob.startswith(b"\x89PNG\r\n\x1a\n"))
            pix = fitz.Pixmap(blob)
            self.assertEqual((pix.width, pix.height), (w, h))

    def test_the_ico_is_checked_by_make_icons(self):
        self.assertIn("favicon.ico", make_icons.check())
        self.assertTrue(make_icons.check()["favicon.ico"][0])

    def test_the_ico_is_stale_when_the_favicon_source_changes(self):
        recoloured = make_icons.favicon_svg().replace(make_icons.FAVICON_TILE, "#FF0000")
        ok, frac = make_icons.check(sources={"favicon.ico": recoloured})["favicon.ico"]
        self.assertFalse(ok)
        self.assertGreater(frac, make_icons.MAX_DIFFERING_FRACTION)

    def test_index_links_the_ico_beside_the_svg_favicon(self):
        html = open(paths.INDEX_HTML, encoding="utf-8").read()
        link = '<link rel="icon" href="favicon.ico" sizes="32x32">'
        self.assertEqual(html.count(link), 1)
        self.assertLess(html.index('<link rel="icon" type="image/svg+xml"'), html.index(link))



if __name__ == "__main__":
    unittest.main()
