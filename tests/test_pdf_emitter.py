"""The browser PDF writer, judged by a real PDF parser.

tests/pdf.test.js proves src/engine/pdf.js emits the bytes it meant to emit.
That is not the same question as whether those bytes are a PDF: a file can have
every operator in the right place and still need a repair pass because an xref
offset is off by the length of one degree sign.  pymupdf is the independent
reader here - it is the same library tools/ already uses to check the print
PDFs, so a page the emitter writes is held to the parser the print pipeline is
held to.
"""
import os
import subprocess
import tempfile
import unittest

import fitz

from tests import paths

SMOKE = os.path.join(paths.TOOLS, "pdf_smoke.js")


def build(tmp, *size):
    out = os.path.join(tmp, "smoke.pdf")
    subprocess.run(["node", SMOKE, out] + [str(s) for s in size],
                   cwd=paths.ROOT, check=True, capture_output=True)
    return out


class PdfEmitterTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.path = build(cls.tmp, 612, 792)
        cls.doc = fitz.open(cls.path)

    def test_the_file_opens_without_a_repair_pass(self):
        # is_repaired is the whole point: a broken xref still opens, silently,
        # after pymupdf rebuilds the table in memory, and then every claim this
        # file makes is a claim about the repaired copy rather than the bytes a
        # phone would hand to a print shop.
        self.assertFalse(self.doc.is_repaired)
        self.assertEqual(self.doc.page_count, 2)

    def test_the_page_box_is_us_letter_in_points(self):
        rect = self.doc[0].rect
        self.assertAlmostEqual(rect.width, 612, places=2)
        self.assertAlmostEqual(rect.height, 792, places=2)

    def test_the_page_box_follows_the_size_it_was_given(self):
        with tempfile.TemporaryDirectory() as tmp:
            doc = fitz.open(build(tmp, 595.28, 841.89))
            try:
                self.assertFalse(doc.is_repaired)
                self.assertAlmostEqual(doc[0].rect.width, 595.28, places=2)
                self.assertAlmostEqual(doc[0].rect.height, 841.89, places=2)
            finally:
                doc.close()

    def test_the_text_comes_back_out_as_text(self):
        text = self.doc[0].get_text()
        for want in ["Cm7", "C4 Eb4 G4 Bb3", "1-3-5-b7", "LOW VOICING"]:
            self.assertIn(want, text)
        self.assertIn("page two", self.doc[1].get_text())

    def test_the_degree_sign_survives_the_winansi_round_trip(self):
        # \260 in the content stream plus /WinAnsiEncoding is the only path a
        # degree sign has into the file, and getting either half wrong yields a
        # plausible wrong glyph rather than an error.
        self.assertIn("DIMINISHED 7°", self.doc[0].get_text())

    def test_the_faces_are_embedded_subsets_of_the_print_ttfs(self):
        names = {f[3] for f in self.doc[0].get_fonts(full=False)}
        self.assertEqual(
            names,
            {"Marcellus-Regular", "Bitter-Regular", "Bitter-Bold",
             "NunitoSans-Regular", "NunitoSans-SemiBold"})
        for xref, ext, ftype, basename, _, _ in self.doc[0].get_fonts():
            buf = self.doc.extract_font(xref)[3]
            self.assertTrue(buf, "%s is referenced but not embedded" % basename)
            self.assertEqual(ftype, "TrueType")

    def test_a_drawn_rectangle_lands_where_it_was_asked_for(self):
        # y-up PDF coordinates against pymupdf's y-down rect: the rect drawn at
        # y=36 with height 120 has to come back as a top edge at 792-156.
        boxes = [d["rect"] for d in self.doc[0].get_drawings()]
        hit = [r for r in boxes
               if abs(r.x0 - 36) < 1 and abs(r.y1 - (792 - 36)) < 1
               and abs(r.width - 200) < 1 and abs(r.height - 120) < 1]
        self.assertTrue(hit, "no 200x120 rect at (36, 36): %r" % boxes)

    @classmethod
    def tearDownClass(cls):
        cls.doc.close()


if __name__ == "__main__":
    unittest.main()
