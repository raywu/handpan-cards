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
import re
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
        self.rects = []
        self._stroke = None
        self._fill = None
        self._dashed = False
        self._font = None
        self._size = 0.0

    # --- state the renderer sets -----------------------------------------
    def setStrokeColor(self, c):
        self._stroke = _hex(c) if hasattr(c, "red") else str(c)

    def setFillColor(self, c):
        self._fill = _hex(c) if hasattr(c, "red") else str(c)

    def setDash(self, *a):
        self._dashed = bool(a)

    def circle(self, x, y, r, stroke=1, fill=0):
        self.circles.append({"x": x, "y": y, "r": r,
                             "stroke": self._stroke, "dashed": self._dashed})

    def roundRect(self, x, y, w, h, r, stroke=1, fill=0):
        self.rects.append({"x": x, "y": y, "w": w, "h": h,
                           "fill": self._fill if fill else None,
                           "stroke": self._stroke if stroke else None})

    def rect(self, x, y, w, h, stroke=1, fill=0):
        self.rects.append({"x": x, "y": y, "w": w, "h": h,
                           "fill": self._fill if fill else None,
                           "stroke": self._stroke if stroke else None})

    def setFont(self, name, size, *a, **k):
        self._font = name
        self._size = size

    def drawString(self, x, y, text, *a, **k):
        self.texts.append({"x": x, "y": y, "text": text, "font": self._font,
                           "size": self._size, "anchor": "l"})

    def drawCentredString(self, x, y, text, *a, **k):
        self.texts.append({"x": x, "y": y, "text": text, "font": self._font,
                           "size": self._size, "anchor": "c"})

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

            # Diagram note-NAME label sizes, normalised to R = 100 like the
            # positions above. note_text() draws the name with drawString and
            # its octave digit after it at 0.66x, so the alphabetic glyph of
            # each label is the one carrying the label's size; the index
            # numbers go out through drawCentredString and are excluded.
            # The card's own chrome also draws "Label" runs (the deck name in
            # the header and the footer), so the diagram is bounded: every
            # tonefield sits within 1.15R of the pan centre, nothing else on
            # the card is closer than 1.4R.
            def in_diagram(t):
                return math.hypot(t["x"] - cx, t["y"] - cy) <= R * 1.25

            # Keyed by the FIELD each label names - its note plus its octave,
            # unique within a deck - not sorted into a multiset. Two
            # renderers can draw the same set of sizes and still hand them to
            # different fields, and a comparison of sorted lists cannot see
            # it. note_text() emits the name and then its octave digit, so
            # the glyphs arrive in pairs and the first of each carries the
            # label's size.
            glyphs = [t for t in rec.texts if t["font"] == "Label"
                      and t["anchor"] == "l" and in_diagram(t)]
            label_sizes = {}
            for name_g, oct_g in zip(glyphs[0::2], glyphs[1::2]):
                label_sizes[name_g["text"] + oct_g["text"]] = \
                    round(name_g["size"] / R * 100, 3)

            # The index numbers are the centred runs whose text is one of
            # the deck's own field labels, keyed by that text. The bottom
            # shell's numbers sit past 1.36R, outside the names' bound, so
            # they are identified by what they SAY rather than by where.
            numbering = set(v[5] for k, v in deck["spec"].items()
                            if k != "_geom" and v[3] != "ding")
            number_sizes = {
                t["text"]: round(t["size"] / R * 100, 3) for t in rec.texts
                if t["font"] in ("Label", "LabelSB") and t["anchor"] == "c"
                and t["text"] in numbering}

            out.append({"name": chord[0] + chord[1], "fields": fields,
                        "labelSizes": label_sizes,
                        "numberSizes": number_sizes,
                        "noteLine": [t.strip() for t in note_line.split("-") if t.strip()],
                        "numLine": [t.strip() for t in num_line.split("-") if t.strip()],
                        "badgeText": badge.strip()})
        return out
    finally:
        hifi.BLUE, hifi.GREEN = saved


def render_border(deck):
    """The card's own frame as the PRINT pipeline actually fills it: every
    distinct fill colour drawn across the frame's full width, in draw order.
    """
    saved = (hifi.BLUE, hifi.GREEN)
    hifi.BLUE, hifi.GREEN = deck["col_root"], deck["col_tone"]
    try:
        rec = RecordingCanvas()
        hifi.chord_card(rec, 0.0, 0.0, deck, 1, deck["chords"][0])
        bands = [r for r in rec.rects
                 if r["fill"] and abs(r["w"] - hifi.CW) < 0.01]
        return [b["fill"] for b in bands]
    finally:
        hifi.BLUE, hifi.GREEN = saved


def render_border_weight(deck):
    """The frame's stroke weight, read back from where PRINT cuts the white
    interior out of the coloured frame - the inner roundRect's offset from
    the card's own (0, 0) origin equals `bw`."""
    saved = (hifi.BLUE, hifi.GREEN)
    hifi.BLUE, hifi.GREEN = deck["col_root"], deck["col_tone"]
    try:
        rec = RecordingCanvas()
        hifi.chord_card(rec, 0.0, 0.0, deck, 1, deck["chords"][0])
        white = [r for r in rec.rects if r["fill"] == "#FFFFFF"]
        return white[0]["x"]
    finally:
        hifi.BLUE, hifi.GREEN = saved


def render_app_border():
    """The `.face::before` frame rule, read straight out of index.html - the
    app draws its border in CSS, not SVG, so there is nothing to boot a page
    for; the rule itself IS the rendering instruction."""
    with open(os.path.join(paths.ROOT, "index.html"), encoding="utf-8") as fh:
        html = fh.read()
    m = re.search(r"\.face::before\{([^}]*)\}", html)
    rule = m.group(1)
    bg = re.search(r"background:([^;]+);", rule).group(1).strip()
    pad = float(re.search(r"padding:([\d.]+)px", rule).group(1))
    return {"background": bg, "padding": pad}


class BorderAgreementTest(unittest.TestCase):
    """D8: the card border is a single-colour, four-sided frame in BOTH
    renderers. Nothing pinned this before - `tools/validate.py` and the rest
    of this suite compare DATA and label sizes, never the frame - so the
    two-tone split could (and did) ship unnoticed by every other test here.
    """

    def test_print_frame_is_a_single_root_coloured_band(self):
        for deck_id, deck in DECK_BY_ID.items():
            bands = render_border(deck)
            self.assertEqual(
                len(set(bands)), 1,
                "%s: print frame draws more than one fill colour across its "
                "full width: %r" % (deck_id, bands))
            root_hex = _hex(deck["col_root"])
            self.assertEqual(
                bands[0], root_hex,
                "%s: print frame is drawn in %s, not the root colour %s"
                % (deck_id, bands[0], root_hex))

    def test_app_frame_is_sourced_from_the_root_colour_token(self):
        app = render_app_border()
        self.assertNotIn(
            "gradient", app["background"].lower(),
            "app frame background is still a gradient: %r" % app["background"])
        self.assertIn(
            "--ga", app["background"],
            "app frame background is not sourced from --ga (root): %r"
            % app["background"])
        self.assertNotIn(
            "--gb", app["background"],
            "app frame background still references --gb (tone): %r"
            % app["background"])

    def test_border_weight_grows_by_the_same_relative_amount_in_both_renderers(self):
        """Print and the app draw the frame in unrelated unit systems (pt
        vs css px), so absolute weights can never be compared across them -
        only how much each renderer's OWN weight moved."""
        OLD_BW, NEW_BW = 2.2, 2.8
        OLD_PAD, NEW_PAD = 2.5, 3.2
        print_bw = render_border_weight(decks.HIJAZ)
        app_pad = render_app_border()["padding"]
        self.assertAlmostEqual(
            print_bw, NEW_BW, places=2,
            msg="print frame weight is %.3f, not the restyled %.3f"
                % (print_bw, NEW_BW))
        self.assertAlmostEqual(
            app_pad, NEW_PAD, places=2,
            msg="app frame padding is %.3f, not the restyled %.3f"
                % (app_pad, NEW_PAD))
        print_ratio = NEW_BW / OLD_BW
        app_ratio = NEW_PAD / OLD_PAD
        self.assertAlmostEqual(
            print_ratio, app_ratio, delta=0.02,
            msg="border weight grew by a different relative amount in each "
                "renderer: print x%.3f vs app x%.3f" % (print_ratio, app_ratio))


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
        self.assertEqual(len(self.app), 61)
        self.assertEqual(sum(len(v) for v in self.print_.values()), 61)

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

    def test_diagram_label_sizes_agree(self):
        """One label rule, two renderers: the drawn sizes must match.

        Both sides are measured from emitted output and normalised to R = 100,
        so a renderer that keeps its own fudge factor - or reads a stored
        f_note / f_bnote figure instead of the rule - separates here.
        """
        for app_c, print_c in self.each_card():
            where = "%s %s: label sizes" % (app_c["deck"], app_c["name"])
            self.assertTrue(app_c["labelSizes"], where + " (none drawn)")
            self.assertEqual(sorted(app_c["labelSizes"]),
                             sorted(print_c["labelSizes"]),
                             where + " (the two renderers label different "
                                     "fields)")
            for field, a in app_c["labelSizes"].items():
                p = print_c["labelSizes"][field]
                self.assertAlmostEqual(
                    a, p, delta=TOL,
                    msg="%s, field %s: %.3f (app) vs %.3f (print)"
                        % (where, field, a, p))

    def test_diagram_number_sizes_agree(self):
        """The index numbers come out of the same rule, so they match too."""
        for app_c, print_c in self.each_card():
            where = "%s %s: number sizes" % (app_c["deck"], app_c["name"])
            self.assertTrue(app_c["numberSizes"], where + " (none drawn)")
            self.assertEqual(sorted(app_c["numberSizes"]),
                             sorted(print_c["numberSizes"]),
                             where + " (different numbers drawn)")
            for field, a in app_c["numberSizes"].items():
                p = print_c["numberSizes"][field]
                self.assertAlmostEqual(
                    a, p, delta=TOL,
                    msg="%s, number %s: %.3f (app) vs %.3f (print)"
                        % (where, field, a, p))

    def test_the_name_is_always_larger_than_the_number_beside_it(self):
        """The hierarchy row 221 is about: the note NAME is the primary
        label. A rule that sizes names and numbers separately can invert it,
        so this is asserted on what both renderers actually emit."""
        for app_c, print_c in self.each_card():
            for side, card in (("app", app_c), ("print", print_c)):
                small = min(card["labelSizes"].values())
                big = max(card["numberSizes"].values())
                self.assertGreater(
                    small, big,
                    "%s %s (%s): smallest name %.3f is not above the largest "
                    "index number %.3f"
                    % (app_c["deck"], app_c["name"], side, small, big))

    def test_neither_renderer_draws_smaller_than_it_did_before_the_rule(self):
        """The no-shrink invariant, measured on EMITTED OUTPUT, per renderer.

        Before the one rule, the two renderers disagreed by a constant: the
        app multiplied every diagram name by 1.05, print by nothing, so their
        baselines are different numbers and have to be written out separately.
        A single baseline of ``f_* `` - the print figure - is satisfied by a
        rule that quietly takes 5% off every name in the APP, which is what
        shipped and what this catches. The numbers were drawn at f_num by
        both sides, so they share one baseline.

        Sizes here are normalised to R = 100, the same units the geom
        fractions are already in, so the geom fraction times 100 IS the
        baseline.
        """
        APP_INFLATION = 1.05
        for app_c, print_c in self.each_card():
            deck = DECK_BY_ID[app_c["deck"]]
            geom = deck["spec"]["_geom"]
            spec = deck["spec"]
            zone_of = {v[0] + str(v[1]): v[3]
                       for k, v in spec.items() if k != "_geom"}
            for side, card, inflation in (("app", app_c, APP_INFLATION),
                                          ("print", print_c, 1.0)):
                for field, drawn in card["labelSizes"].items():
                    zone = zone_of[field]
                    key = ("f_ding" if zone == "ding" else
                           "f_bnote" if zone == "bottom" else "f_note")
                    was = geom[key] * 100 * inflation
                    self.assertGreaterEqual(
                        drawn + 1e-3, was,
                        "%s %s (%s): %s draws at %.3f, under the %.3f this "
                        "renderer drew before the label rule"
                        % (app_c["deck"], app_c["name"], side, field,
                           drawn, was))
                for label, drawn in card["numberSizes"].items():
                    self.assertGreaterEqual(
                        drawn + 1e-3, geom["f_num"] * 100,
                        "%s %s (%s): number %s draws at %.3f, under f_num"
                        % (app_c["deck"], app_c["name"], side, label, drawn))

    def test_drawn_bottom_note_badge_agrees(self):
        """The printed badge text itself - nothing else asserts what it says."""
        for app_c, print_c in self.each_card():
            self.assertEqual(app_c["badgeText"], print_c["badgeText"],
                             "%s %s: badge text" % (app_c["deck"], app_c["name"]))


if __name__ == "__main__":
    unittest.main()
