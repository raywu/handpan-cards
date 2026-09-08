"""App <-> print render agreement.

`tools/hifi.py` and the inline script in `index.html` are two independent
implementations of the same card conventions. `tools/validate.py` compares the
DATA they consume; nothing compares the OUTPUT they draw. They do not even share
an axis convention - hifi works in PDF space (y-up, `cy + orb*sin`) while the app
emits SVG (y-down, `-orb*sin`) - so a sign error in either renderer is invisible
to every other test in this suite.

Both sides here are captured from rendered output: the app's from its emitted
SVG, the print side's from a recording canvas driven by the real `chord_card`.
"""
import json
import math
import os
import subprocess
import sys
import unittest

from tests import paths

sys.path.insert(0, paths.TOOLS)
import hifi          # noqa: E402
import decks         # noqa: E402

DECK_BY_ID = {"hijaz": decks.HIJAZ, "pygmy": decks.PYGMY, "amara": decks.AMARA}
TOL = 0.02          # normalised units (R = 100), i.e. 0.02% of the pan radius


def _hex(color):
    return "#%02X%02X%02X" % tuple(round(c * 255) for c in
                                   (color.red, color.green, color.blue))


class RecordingCanvas:
    """Captures the circle calls `chord_card` makes, with their stroke state."""

    def __init__(self):
        self.circles = []
        self.texts = []
        self._stroke = None
        self._dashed = False
        self._font = None

    # --- state the renderer sets -----------------------------------------
    def setStrokeColor(self, c):
        self._stroke = _hex(c) if hasattr(c, "red") else str(c)

    def setDash(self, *a):
        self._dashed = bool(a)

    def circle(self, x, y, r, stroke=1, fill=0):
        self.circles.append({"x": x, "y": y, "r": r,
                             "stroke": self._stroke, "dashed": self._dashed})

    def setFont(self, name, size, *a, **k):
        self._font = name

    def drawString(self, x, y, text, *a, **k):
        self.texts.append({"x": x, "y": y, "text": text, "font": self._font})

    def drawCentredString(self, x, y, text, *a, **k):
        self.texts.append({"x": x, "y": y, "text": text, "font": self._font})

    # --- everything else is ignored --------------------------------------
    def __getattr__(self, _name):
        return lambda *a, **k: _Null()


class _Null:
    """Swallows any call or attribute, so paths/graphics-state calls no-op."""

    def __getattr__(self, _name):
        return lambda *a, **k: _Null()


def render_print(deck):
    """Field states as the PRINT pipeline actually draws them, normalised to
    the app's coordinate space (origin at the pan centre, R = 100, y-down)."""
    saved = (hifi.BLUE, hifi.GREEN)
    hifi.BLUE, hifi.GREEN = deck["col_root"], deck["col_tone"]   # build() does this
    try:
        root_hex, tone_hex = _hex(deck["col_root"]), _hex(deck["col_tone"])
        out = []
        for n, chord in enumerate(deck["chords"], 1):
            rec = RecordingCanvas()
            hifi.chord_card(rec, 0.0, 0.0, deck, n, chord)
            cx, cy, R = hifi.CW / 2, deck["cy"], deck["R"]

            # draw_pan emits its chrome rings first: the rim, then the inner
            # ring and the dashed bottom ring where the deck has them. Skip
            # exactly those - a positional filter would also drop the ding on
            # decks whose ding_dy is 0 (Hijaz, Amara).
            g = deck["spec"]["_geom"]
            chrome = 1 + bool(g.get("inner_ring")) + bool(g.get("bottom"))

            groups = {}
            for c in rec.circles[chrome:]:
                key = (round((c["x"] - cx) / R * 100, 3),
                       round(-(c["y"] - cy) / R * 100, 3))   # y-up -> y-down
                groups.setdefault(key, []).append(c)

            fields = []
            for (x, y), group in groups.items():
                strokes = {g["stroke"] for g in group}
                if root_hex in strokes:
                    state = "root"
                elif tone_hex in strokes:
                    state = "tone"
                elif any(g["dashed"] for g in group):
                    state = "off-bottom"
                else:
                    state = "off"
                fields.append({"x": x, "y": y,
                               "r": round(max(g["r"] for g in group) / R * 100, 3),
                               "state": state})
            fields.sort(key=lambda f: (f["x"], f["y"]))

            # The note line, number line and badge as the PDF actually draws
            # them. tracked()/note_text() emit one drawString per glyph, so
            # rebuild each line by x-order within its y band. Keying on the font
            # keeps the diagram's tonefield labels out of these lines.
            def line_at(y_target, font, tol=3.5):
                glyphs = [t for t in rec.texts
                          if t["font"] == font and abs(t["y"] - y_target) <= tol]
                glyphs.sort(key=lambda t: t["x"])
                return "".join(g["text"] for g in glyphs)

            note_line = line_at(deck["y_note"], "Notes")
            num_line = line_at(deck["y_num"], "Notes")
            badge = line_at(deck["y_note"] + 13, "LabelSB")

            out.append({"name": chord[0] + chord[1], "fields": fields,
                        "noteLine": [t.strip() for t in note_line.split("-") if t.strip()],
                        "numLine": [t.strip() for t in num_line.split("-") if t.strip()],
                        "badgeText": badge.strip()})
        return out
    finally:
        hifi.BLUE, hifi.GREEN = saved


class RenderAgreement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dump = subprocess.run(
            ["node", os.path.join(paths.ROOT, "tests", "helpers", "dump_app_render.js")],
            capture_output=True, text=True, check=True, cwd=paths.ROOT)
        cls.app = json.loads(dump.stdout)
        cls.print_ = {k: render_print(v) for k, v in DECK_BY_ID.items()}

    def each_card(self):
        for card in self.app:
            yield card, self.print_[card["deck"]][card["index"]]

    def test_every_card_is_compared(self):
        self.assertEqual(len(self.app), 59)
        self.assertEqual(sum(len(v) for v in self.print_.values()), 59)

    def test_chord_names_line_up(self):
        for app_c, print_c in self.each_card():
            self.assertEqual(app_c["name"], print_c["name"],
                             "card %d of %s" % (app_c["index"], app_c["deck"]))

    def test_tonefield_positions_agree(self):
        """Catches an axis-sign or radius divergence between the renderers."""
        for app_c, print_c in self.each_card():
            self.assertEqual(len(app_c["fields"]), len(print_c["fields"]),
                             "%s %s: field count" % (app_c["deck"], app_c["name"]))
            for a, p in zip(app_c["fields"], print_c["fields"]):
                for axis in ("x", "y", "r"):
                    self.assertAlmostEqual(
                        a[axis], p[axis], delta=TOL,
                        msg="%s %s: %s %.3f (app) vs %.3f (print)"
                            % (app_c["deck"], app_c["name"], axis, a[axis], p[axis]))

    def test_highlighting_agrees(self):
        """Same fields lit, same root/tone roles, in both outputs."""
        for app_c, print_c in self.each_card():
            self.assertEqual([f["state"] for f in app_c["fields"]],
                             [f["state"] for f in print_c["fields"]],
                             "%s %s: highlight states" % (app_c["deck"], app_c["name"]))

    def test_drawn_note_line_agrees(self):
        """The notes actually printed and actually rendered, in drawn order.

        Compares emitted text on both sides, so reordering either renderer's
        line is caught - comparing ch.fields to itself would not be.
        """
        for app_c, print_c in self.each_card():
            self.assertEqual(app_c["noteLine"], print_c["noteLine"],
                             "%s %s: drawn note line" % (app_c["deck"], app_c["name"]))

    def test_drawn_number_line_agrees(self):
        for app_c, print_c in self.each_card():
            self.assertEqual(app_c["numLine"], print_c["numLine"],
                             "%s %s: drawn number line" % (app_c["deck"], app_c["name"]))

    def test_drawn_bottom_note_badge_agrees(self):
        """The printed badge text itself - nothing else asserts what it says."""
        for app_c, print_c in self.each_card():
            self.assertEqual(app_c["badgeText"], print_c["badgeText"],
                             "%s %s: badge text" % (app_c["deck"], app_c["name"]))


if __name__ == "__main__":
    unittest.main()
