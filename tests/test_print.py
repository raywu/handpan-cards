"""Layout and text-fitting units for the print pipeline (tools/hifi.py).

Everything here is measured from what the drawing code actually EMITS: a
recording stand-in for the reportlab canvas captures every glyph, circle and
line, and the assertions are made against those marks.  No geometry constant
is imported from ``hifi`` (CONTRACT rule 2); the two card dimensions and the
page size below are quoted from CLAUDE.md's print spec, which is what the
pipeline is required to hit.
"""
import math
import sys
import unittest

from tests import paths

sys.path.insert(0, paths.TOOLS)

from reportlab.pdfbase import pdfmetrics  # noqa: E402

import hifi  # noqa: E402  (registers the TTFs on import)
import decks  # noqa: E402  (deck data - the input to the pipeline)

# --- print spec, quoted from CLAUDE.md ("Print pipeline") -------------------
SPEC_CARD_W = 177.6      # poker card, 62.65 mm
SPEC_CARD_H = 247.2      # poker card, 87.21 mm
SPEC_PAGE_W = 612.0      # US Letter
SPEC_PAGE_H = 792.0
SPEC_CROP_MARGIN = 6.0   # crop marks live 6 pt from the page edge

# No drawn glyph may reach the card's cut edge; the printed frame border is
# the outermost ink on a card, so text has to stay inside it.
MIN_TEXT_MARGIN = 2.0

ALL_DECKS = (decks.HIJAZ, decks.PYGMY, decks.AMARA)


# --------------------------------------------------------------------------
# recording canvas
# --------------------------------------------------------------------------
def _mul(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a * A + b * C, a * B + b * D,
            c * A + d * C, c * B + d * D,
            e * A + f * C + E, e * B + f * D + F)


class _Path(object):
    def roundRect(self, *a, **k):
        pass

    def rect(self, *a, **k):
        pass

    def moveTo(self, *a, **k):
        pass

    def lineTo(self, *a, **k):
        pass

    def close(self, *a, **k):
        pass


class RecordingCanvas(object):
    """Stand-in for a reportlab canvas that records the marks it is asked for.

    Text is stored already resolved to page coordinates and to a left edge
    plus a width, so a test can measure what the reader will see instead of
    re-deriving it from the drawing code's own arithmetic.
    """

    def __init__(self):
        self.texts = []
        self.circles = []
        self.lines = []
        self._font = (None, None)
        self._fill = None
        self._stroke = None
        self._lw = None
        self._dash = None
        self._ctm = (1, 0, 0, 1, 0, 0)
        self._stack = []

    # -- graphics state
    def saveState(self):
        self._stack.append((self._ctm, self._font, self._fill,
                            self._stroke, self._lw, self._dash))

    def restoreState(self):
        (self._ctm, self._font, self._fill,
         self._stroke, self._lw, self._dash) = self._stack.pop()

    def translate(self, dx, dy):
        self._ctm = _mul((1, 0, 0, 1, dx, dy), self._ctm)

    def rotate(self, deg):
        a = math.radians(deg)
        self._ctm = _mul((math.cos(a), math.sin(a),
                          -math.sin(a), math.cos(a), 0, 0), self._ctm)

    def scale(self, sx, sy):
        self._ctm = _mul((sx, 0, 0, sy, 0, 0), self._ctm)

    def setFont(self, name, size, *a, **k):
        self._font = (name, size)

    def setFillColor(self, col, *a, **k):
        self._fill = col

    def setStrokeColor(self, col, *a, **k):
        self._stroke = col

    def setLineWidth(self, w):
        self._lw = w

    def setDash(self, *a, **k):
        self._dash = tuple(a) if a else None

    def setLineCap(self, *a):
        pass

    def setLineJoin(self, *a):
        pass

    def setTitle(self, *a):
        pass

    def beginPath(self):
        return _Path()

    def clipPath(self, *a, **k):
        pass

    def drawPath(self, *a, **k):
        pass

    # -- marks
    def _device(self, x, y):
        a, b, c, d, e, f = self._ctm
        return (a * x + c * y + e, b * x + d * y + f)

    def _rotated(self):
        _a, b, c, _d, _e, _f = self._ctm
        return abs(b) > 1e-9 or abs(c) > 1e-9

    def _text(self, x, y, text, anchor):
        font, size = self._font
        w = pdfmetrics.stringWidth(text, font, size)
        px, py = self._device(x, y)
        if anchor == "c":
            px -= w / 2.0
        elif anchor == "r":
            px -= w
        self.texts.append(dict(text=text, x=px, y=py, w=w, font=font,
                               size=size, fill=self._fill,
                               rotated=self._rotated()))

    def drawString(self, x, y, text, *a, **k):
        self._text(x, y, text, "l")

    def drawCentredString(self, x, y, text, *a, **k):
        self._text(x, y, text, "c")

    def drawRightString(self, x, y, text, *a, **k):
        self._text(x, y, text, "r")

    def circle(self, x, y, r, stroke=1, fill=0):
        px, py = self._device(x, y)
        self.circles.append(dict(x=px, y=py, r=r, stroke=stroke, fill=fill,
                                 stroke_color=self._stroke,
                                 fill_color=self._fill,
                                 line_width=self._lw, dash=self._dash))

    def line(self, x1, y1, x2, y2):
        self.lines.append((self._device(x1, y1), self._device(x2, y2)))

    def rect(self, x, y, w, h, stroke=1, fill=0):
        pass

    def roundRect(self, x, y, w, h, r, stroke=1, fill=0):
        pass


def rgb(color):
    return (round(color.red, 6), round(color.green, 6), round(color.blue, 6))


def runs(canvas, only_upright=True):
    """Glyphs regrouped into drawn text runs, keyed by (baseline, font, size).

    ``tracked()`` emits one drawString per glyph, so a "run" is the set of
    glyphs sharing a baseline and a face.  Returns {key: (left, right, text)}.
    """
    out = {}
    for t in canvas.texts:
        if only_upright and t["rotated"]:
            continue
        key = (round(t["y"], 3), t["font"], round(t["size"], 4))
        left, right, txt = out.get(key, (t["x"], t["x"], ""))
        out[key] = (min(left, t["x"]), max(right, t["x"] + t["w"]), txt + t["text"])
    return out


def render_chord_card(deck, index, chord, x=0.0, y=0.0):
    """Draw one chord card onto a recording canvas, exactly as build() would."""
    canvas = RecordingCanvas()
    hifi.chord_card(canvas, x, y, deck, index, chord)
    return canvas


def every_card():
    """(deck, 1-based index, chord) for all 59 cards."""
    for deck in ALL_DECKS:
        for i, chord in enumerate(deck["chords"]):
            yield deck, i + 1, chord


class PaletteSafeTest(unittest.TestCase):
    """hifi.build() rebinds the module globals BLUE/GREEN (CONTRACT trap)."""

    def setUp(self):
        self._palette = (hifi.BLUE, hifi.GREEN)

    def tearDown(self):
        hifi.BLUE, hifi.GREEN = self._palette

    def use_palette(self, deck):
        hifi.BLUE = deck["col_root"]
        hifi.GREEN = deck["col_tone"]


# --------------------------------------------------------------------------
# text units
# --------------------------------------------------------------------------
class TrackedTextTest(unittest.TestCase):

    CASES = [
        ("D MAJOR 7 SHARP 11 (NO 5)", "LabelSB", 4.2, 0.55),
        ("F3 LOW PYGMY 18", "Label", 4.6, 0.5),
        ("Gm7", "Display", 27.0, 0.54),
        ("Eb4 - F4", "Notes", 11.0, 0.0),
        ("X", "Label", 6.0, 0.9),
    ]

    def test_tracked_advances_sum_to_the_width_tw_reports(self):
        """tw() must predict the ink tracked() actually lays down.

        Driven against a recording canvas: the run's real extent is measured
        from the first and last glyph, never recomputed from tw()'s formula.
        """
        for text, font, size, track in self.CASES:
            with self.subTest(text=text):
                canvas = RecordingCanvas()
                returned = hifi.tracked(canvas, 100.0, 50.0, text, font, size,
                                        track)
                glyphs = canvas.texts
                self.assertEqual("".join(g["text"] for g in glyphs), text,
                                 "tracked() must draw the whole string")
                self.assertEqual(len(glyphs), len(text),
                                 "tracked() draws one glyph per character")
                self.assertEqual(glyphs[0]["x"], 100.0,
                                 "left-aligned text starts at the given x")
                drawn = (glyphs[-1]["x"] + glyphs[-1]["w"]) - glyphs[0]["x"]
                self.assertAlmostEqual(
                    hifi.tw(text, font, size, track), drawn, places=6,
                    msg="tw() disagrees with the drawn extent of %r" % text)
                self.assertAlmostEqual(
                    returned, drawn, places=6,
                    msg="tracked() returned a width it did not draw")
                for i in range(1, len(glyphs)):
                    self.assertGreater(glyphs[i]["x"], glyphs[i - 1]["x"],
                                       "glyphs must advance left to right")

    def test_tracked_alignment_anchors_the_drawn_run(self):
        text, font, size, track = self.CASES[0]
        anchored = {}
        for align in ("l", "c", "r"):
            canvas = RecordingCanvas()
            hifi.tracked(canvas, 300.0, 50.0, text, font, size, track, align)
            g = canvas.texts
            anchored[align] = (g[0]["x"], g[-1]["x"] + g[-1]["w"])
        self.assertAlmostEqual(anchored["l"][0], 300.0, places=6)
        self.assertAlmostEqual(anchored["r"][1], 300.0, places=6)
        self.assertAlmostEqual(sum(anchored["c"]) / 2.0, 300.0, places=6,
                               msg="centred text must straddle the anchor")


class FitTest(unittest.TestCase):

    LONG = "HALF-DIMINISHED ( = Bm6 ) - HIGH VOICING - FULL SCALE"

    def test_fit_keeps_the_requested_size_when_the_text_already_fits(self):
        self.assertEqual(hifi.fit("Dm", "Display", 27.0, 10000.0, track=0.5),
                         27.0)
        self.assertEqual(hifi.fit(self.LONG, "LabelSB", 4.2, 10000.0,
                                  track=0.55), 4.2)

    def test_fit_note_keeps_the_requested_size_when_the_text_already_fits(self):
        self.assertEqual(hifi.fit_note("Ab", 3, "Label", 8.0, 10000.0), 8.0)

    def test_fit_shrinks_overlong_text_but_stops_at_the_floor(self):
        floor = 5.0
        size = 12.0
        got = hifi.fit(self.LONG, "LabelSB", size, 40.0, track=0.55,
                       floor=floor)
        self.assertLess(got, size, "overlong text must be shrunk")
        self.assertGreaterEqual(
            got, floor - 0.25,
            "fit() undershot its floor by more than one step - text this "
            "small is unreadable on a 62 mm card")
        self.assertGreater(
            hifi.tw(self.LONG, "LabelSB", got, 0.55 * got / 10.0), 0.0)

    def test_fit_note_shrinks_overlong_text_but_stays_legible(self):
        got = hifi.fit_note("Ab", 5, "Label", 8.0, 1.0)
        self.assertLess(got, 8.0, "overlong note text must be shrunk")
        self.assertGreater(got, 2.0,
                           "fit_note() shrank the note name out of existence")


# --------------------------------------------------------------------------
# call-site width budgets, across all 59 cards
# --------------------------------------------------------------------------
class CardWidthBudgetTest(unittest.TestCase):
    """The budgets the card layout promises, checked against drawn ink.

    card_header() measures the subtitle with one tracking value and then draws
    it with a 2.4x larger one, so the fitted width is not the drawn width.
    These tests measure the DRAWN run.
    """

    SUBTITLE_BUDGET = 0.60      # of the card width - the header's own budget

    def test_drawn_subtitle_fits_the_header_budget_on_every_card(self):
        worst = None
        for deck, index, chord in every_card():
            main, sup, subtitle, _fields, _roots = chord
            canvas = RecordingCanvas()
            hifi.card_header(canvas, 0.0, 0.0, SPEC_CARD_W, SPEC_CARD_H,
                             deck["name"], "#%d" % index, subtitle, main, sup)
            sub = [v for k, v in runs(canvas).items() if k[1] == "LabelSB"]
            self.assertEqual(len(sub), 1,
                             "expected exactly one subtitle run on %s %s"
                             % (deck["name"], main))
            drawn = sub[0][1] - sub[0][0]
            slack = SPEC_CARD_W * self.SUBTITLE_BUDGET - drawn
            if worst is None or slack < worst[0]:
                worst = (slack, deck["name"], subtitle, drawn)
        self.assertGreaterEqual(
            worst[0], 0.0,
            "a drawn subtitle overran the %.0f%% header budget (%.2f pt). "
            "Worst case of all 59 cards: %s / %r drawn %.2f pt, slack "
            "%.2f pt" % (self.SUBTITLE_BUDGET * 100,
                         SPEC_CARD_W * self.SUBTITLE_BUDGET,
                         worst[1], worst[2], worst[3], worst[0]))

    def test_drawn_subtitle_never_collides_with_the_deck_name(self):
        worst = None
        for deck, index, chord in every_card():
            main, sup, subtitle, _fields, _roots = chord
            canvas = RecordingCanvas()
            hifi.card_header(canvas, 0.0, 0.0, SPEC_CARD_W, SPEC_CARD_H,
                             deck["name"], "#%d" % index, subtitle, main, sup)
            grouped = runs(canvas)
            sub = [v for k, v in grouped.items() if k[1] == "LabelSB"][0]
            name = [v for k, v in grouped.items()
                    if k[1] == "Label" and v[2] == deck["name"]]
            self.assertEqual(len(name), 1,
                             "expected one deck-name run on %s %s"
                             % (deck["name"], main))
            gap = sub[0] - name[0][1]
            if worst is None or gap < worst[0]:
                worst = (gap, deck["name"], subtitle)
        self.assertGreater(
            worst[0], 0.0,
            "the header subtitle overlapped the deck name. Worst case of all "
            "59 cards: %s / %r, gap %.2f pt" % (worst[1], worst[2], worst[0]))

    def test_all_drawn_card_text_stays_inside_the_card(self):
        worst = None
        for deck, index, chord in every_card():
            palette = (hifi.BLUE, hifi.GREEN)
            hifi.BLUE, hifi.GREEN = deck["col_root"], deck["col_tone"]
            try:
                canvas = render_chord_card(deck, index, chord)
            finally:
                hifi.BLUE, hifi.GREEN = palette
            for t in canvas.texts:
                if t["rotated"]:
                    continue          # the side credit runs up the card edge
                margin = min(t["x"], SPEC_CARD_W - (t["x"] + t["w"]))
                if worst is None or margin < worst[0]:
                    worst = (margin, deck["name"], chord[0], t["text"])
        self.assertGreaterEqual(
            worst[0], MIN_TEXT_MARGIN,
            "drawn text came within %.2f pt of the card edge (minimum %.2f). "
            "Worst case of all 59 cards: %s / %s / %r"
            % (worst[0], MIN_TEXT_MARGIN, worst[1], worst[2], worst[3]))


# --------------------------------------------------------------------------
# sheet layout
# --------------------------------------------------------------------------
class SlotsTest(unittest.TestCase):

    def setUp(self):
        self.slots = hifi.slots()

    def test_nine_slots_in_a_three_by_three_grid(self):
        self.assertEqual(len(self.slots), 9)
        xs = sorted({round(x, 6) for x, _y in self.slots})
        ys = sorted({round(y, 6) for _x, y in self.slots})
        self.assertEqual(len(xs), 3, "expected 3 columns")
        self.assertEqual(len(ys), 3, "expected 3 rows")

    def test_slots_are_in_reading_order(self):
        """Card #1 prints top-left and the deck reads left-to-right."""
        rows = [self.slots[i:i + 3] for i in (0, 3, 6)]
        for row in rows:
            xs = [x for x, _y in row]
            self.assertEqual(xs, sorted(xs),
                             "a row must run left to right")
        top = [row[0][1] for row in rows]
        self.assertEqual(top, sorted(top, reverse=True),
                         "rows must run down the page: slot 0 is the top-left "
                         "card, slot 8 the bottom-right one")

    def test_no_two_cards_overlap(self):
        for i in range(9):
            for j in range(i + 1, 9):
                ax, ay = self.slots[i]
                bx, by = self.slots[j]
                overlap = (ax < bx + SPEC_CARD_W and bx < ax + SPEC_CARD_W
                           and ay < by + SPEC_CARD_H and by < ay + SPEC_CARD_H)
                self.assertFalse(overlap,
                                 "slots %d and %d overlap" % (i, j))

    def test_grid_is_centred_inside_the_page_clear_of_the_crop_marks(self):
        left = min(x for x, _y in self.slots)
        right = max(x for x, _y in self.slots) + SPEC_CARD_W
        bottom = min(y for _x, y in self.slots)
        top = max(y for _x, y in self.slots) + SPEC_CARD_H
        self.assertGreaterEqual(left, SPEC_CROP_MARGIN)
        self.assertGreaterEqual(bottom, SPEC_CROP_MARGIN)
        self.assertLessEqual(right, SPEC_PAGE_W - SPEC_CROP_MARGIN)
        self.assertLessEqual(top, SPEC_PAGE_H - SPEC_CROP_MARGIN)
        self.assertAlmostEqual(left, SPEC_PAGE_W - right, places=6,
                               msg="grid is not horizontally centred")
        self.assertAlmostEqual(bottom, SPEC_PAGE_H - top, places=6,
                               msg="grid is not vertically centred")


# --------------------------------------------------------------------------
# tonefield rendering
# --------------------------------------------------------------------------
class DrawRingTest(PaletteSafeTest):

    R = 10.0

    def setUp(self):
        PaletteSafeTest.setUp(self)
        # Colours come from the deck data, never from a hardcoded hex.
        self.use_palette(decks.AMARA)
        self.root = rgb(decks.AMARA["col_root"])
        self.tone = rgb(decks.AMARA["col_tone"])
        self.assertNotEqual(self.root, self.tone)

    def ring(self, state):
        canvas = RecordingCanvas()
        hifi.draw_ring(canvas, 50.0, 50.0, self.R, state)
        return canvas

    def coloured(self, canvas):
        out = {"root": [], "tone": []}
        for c in canvas.circles:
            if not c["stroke"] or c["stroke_color"] is None:
                continue
            here = rgb(c["stroke_color"])
            if here == self.root:
                out["root"].append(c)
            elif here == self.tone:
                out["tone"].append(c)
        return out

    def test_state_selects_root_or_tone_colour_but_never_both(self):
        expected = {"root": "root", "ding-root": "root", "on": "tone",
                    "off": None, "off-bottom": None}
        for state, want in expected.items():
            with self.subTest(state=state):
                got = self.coloured(self.ring(state))
                for kind in ("root", "tone"):
                    if kind == want:
                        self.assertTrue(
                            got[kind],
                            "state %r must stroke the %s colour" % (state, kind))
                    else:
                        self.assertEqual(
                            got[kind], [],
                            "state %r must not stroke the %s colour"
                            % (state, kind))

    def test_off_bottom_is_the_only_dashed_state(self):
        for state in ("root", "ding-root", "on", "off", "off-bottom"):
            with self.subTest(state=state):
                dashed = [c for c in self.ring(state).circles
                          if c["stroke"] and c["dash"]]
                if state == "off-bottom":
                    self.assertTrue(dashed,
                                    "receded bottom fields are drawn dashed")
                else:
                    self.assertEqual(dashed, [],
                                     "state %r must draw solid" % state)

    def test_every_state_draws_the_tonefield_outline(self):
        for state in ("root", "ding-root", "on", "off", "off-bottom"):
            with self.subTest(state=state):
                circles = self.ring(state).circles
                self.assertTrue([c for c in circles
                                 if c["stroke"] and abs(c["r"] - self.R) < 1e-9],
                                "state %r lost the tonefield circle" % state)

    def test_highlight_band_sits_between_the_outline_and_the_hairline(self):
        eps = 1e-9
        for state in ("root", "on"):
            with self.subTest(state=state):
                canvas = self.ring(state)
                circles = canvas.circles
                band = self.coloured(canvas)["root" if state == "root"
                                             else "tone"][0]
                outline = max(c["r"] for c in circles)
                inner = [c for c in circles
                         if c is not band and c["r"] < band["r"]]
                self.assertTrue(inner, "the band lost its inner hairline")
                hairline = max(c["r"] for c in inner)
                self.assertGreater(hairline, 0.0)
                self.assertLess(hairline, band["r"])
                self.assertLess(band["r"], outline)
                self.assertLessEqual(
                    band["r"] + band["line_width"] / 2.0, outline + eps,
                    "the coloured band spills outside the tonefield outline")
                self.assertGreaterEqual(
                    band["r"] - band["line_width"] / 2.0, hairline - eps,
                    "the coloured band swallows the inner hairline")


if __name__ == "__main__":
    unittest.main()
