"""The generated font module (src/engine/fontdata.js) against reportlab.

The browser emitter and tools/hifi.py have to lay text out on ONE set of glyph
advances.  hifi calls pdfmetrics.stringWidth for centring (:42), for the
per-character tracking loop (:56), for the note/octave pair (:67-68) and for the
label fitter (:171); if the table the JS side reads disagrees with reportlab by
a fraction, every centred string on every card drifts a little and no downstream
geometry test can say why.  So the tool that generates the module is pinned here
against reportlab itself, not against a recorded snapshot of its own output.
"""
import json
import os
import re
import subprocess
import sys
import unittest

from tests import paths

sys.path.insert(0, paths.TOOLS)

from reportlab.pdfbase import pdfmetrics  # noqa: E402

import decks as D  # noqa: E402
import hifi  # noqa: E402  (registers the TTFs on import)

FONTDATA = os.path.join(paths.ROOT, "src", "engine", "fontdata.js")
TOOL = os.path.join(paths.TOOLS, "inline_fonts.py")


def module_source():
    with open(FONTDATA, encoding="utf-8") as fh:
        return fh.read()


def faces():
    m = re.search(r"var FACES = (\{.*?\});\n", module_source(), re.S)
    return json.loads(m.group(1))


def charset():
    m = re.search(r"var CHARSET = (\".*?\");\n", module_source())
    return json.loads(m.group(1))


class FontSubsetTest(unittest.TestCase):
    def test_every_advance_matches_reportlab_at_1000_upem(self):
        for name, face in faces().items():
            for ch, adv in face["widths"].items():
                expect = pdfmetrics.stringWidth(ch, name, 1000.0)
                self.assertAlmostEqual(adv, expect, places=3,
                                       msg="%s %r" % (name, ch))

    def test_the_five_faces_are_hifis_registration_names(self):
        self.assertEqual(sorted(faces()),
                         ["Display", "Label", "LabelSB", "Notes", "NotesB"])

    def test_every_face_carries_a_width_for_every_charset_glyph(self):
        cs = charset()
        for name, face in faces().items():
            self.assertEqual(sorted(face["widths"]), sorted(cs), name)

    def test_the_charset_covers_every_glyph_the_decks_draw(self):
        used = set()
        for deck in (D.HIJAZ, D.PYGMY, D.AMARA):
            used |= set(json.dumps(deck, ensure_ascii=False, default=str))
        self.assertEqual(used - set(charset()), set())

    def test_the_charset_is_encodable_in_winansi(self):
        """The emitter writes simple TrueType fonts with /WinAnsiEncoding."""
        for ch in charset():
            ch.encode("cp1252")

    def test_the_committed_module_is_what_the_tool_writes(self):
        r = subprocess.run([sys.executable, TOOL, "--check"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_the_module_is_registered_as_an_inlined_engine_region(self):
        import inline_engine
        self.assertIn("fontdata", inline_engine.MODULES)


if __name__ == "__main__":
    unittest.main()
