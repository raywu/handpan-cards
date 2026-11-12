"""Self-hosted web fonts (fonts/*.woff, fonts/fonts.css) from tools/make_web_fonts.py."""
import hashlib
import io
import os
import re
import subprocess
import sys
import unittest

from fontTools.ttLib import TTFont

from tests import paths

sys.path.insert(0, paths.TOOLS)

import make_web_fonts as M  # noqa: E402

FONTS = os.path.join(paths.ROOT, "fonts")
TOOL = os.path.join(paths.TOOLS, "make_web_fonts.py")
EXPECTED = {
    ("Marcellus", 400), ("Bitter", 400), ("Bitter", 600),
    ("Nunito Sans", 400), ("Nunito Sans", 600), ("Nunito Sans", 700),
}


class WebFontsTest(unittest.TestCase):
    def test_check_reports_no_drift(self):
        r = subprocess.run([sys.executable, TOOL, "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_face_set_is_the_page_weights(self):
        self.assertEqual({(f["family"], f["weight"]) for f in M.FACES}, EXPECTED)

    def test_each_woff_parses_and_covers_the_subset(self):
        for f in M.FACES:
            path = os.path.join(FONTS, f["file"])
            font = TTFont(path)
            self.assertEqual(font.flavor, "woff", f["file"])
            cmap = font.getBestCmap()
            missing = [hex(c) for c in M.SUBSET if c in M.source_cmap(f) and c not in cmap]
            self.assertEqual(missing, [], f["file"])

    def test_subset_has_the_characters_pages_use(self):
        for ch in "›’–—°é":
            self.assertIn(ord(ch), M.SUBSET)
        for f in M.FACES:
            cmap = TTFont(os.path.join(FONTS, f["file"])).getBestCmap()
            for ch in "AZaz09#b°’—":
                self.assertIn(ord(ch), cmap, (f["file"], ch))

    def test_woff_is_not_woff2(self):
        for f in M.FACES:
            with open(os.path.join(FONTS, f["file"]), "rb") as fh:
                self.assertEqual(fh.read(4), b"wOFF")

    def test_css_names_only_same_origin_fonts_urls(self):
        css = open(os.path.join(FONTS, "fonts.css"), encoding="utf-8").read()
        urls = re.findall(r"url\(([^)]*)\)", css)
        self.assertEqual(len(urls), len(M.FACES))
        for u in urls:
            self.assertRegex(u.strip("'\""), r"^/fonts/[A-Za-z0-9-]+\.woff$")
        self.assertNotIn("http", css)
        self.assertEqual(css.count("font-display:swap"), len(M.FACES))
        self.assertEqual(css.count("@font-face"), len(M.FACES))
        for f in M.FACES:
            self.assertIn("/fonts/" + f["file"], css)

    def test_ofl_text_beside_each_family(self):
        for name in ("OFL-Marcellus.txt", "OFL-Bitter.txt", "OFL-NunitoSans.txt"):
            text = open(os.path.join(FONTS, name), encoding="utf-8").read()
            self.assertIn("SIL OPEN FONT LICENSE", text.upper())

    def test_added_ttfs_are_pinned_by_sha256(self):
        self.assertEqual(len(M.ADDED_TTFS), 2)
        for rel, digest in M.ADDED_TTFS.items():
            data = open(os.path.join(paths.ROOT, rel), "rb").read()
            self.assertEqual(hashlib.sha256(data).hexdigest(), digest, rel)
        self.assertRegex(M.UPSTREAM_COMMIT, r"^[0-9a-f]{40}$")

    def test_frozen_print_sources_untouched(self):
        r = subprocess.run([sys.executable, os.path.join(paths.TOOLS, "inline_fonts.py"), "--check"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_added_ttfs_live_outside_print_dir(self):
        for rel in M.ADDED_TTFS:
            self.assertTrue(rel.startswith("tools/fonts/web/"))


if __name__ == "__main__":
    unittest.main()
