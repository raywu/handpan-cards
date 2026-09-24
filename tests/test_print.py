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

# --- diagram label rule, quoted from CLAUDE.md ("Design system") -----------
# Every glyph the pan draws is sized from the field's OWN radius times a
# constant for its zone. Nothing is read out of the geometry table, and no
# density term multiplies on top of the radius: the radius already IS the
# deck's answer to "more notes" - more fields on one pan means smaller
# fields, so smaller labels.
#
# Each zone ratio carries the app's historic 1.05: before the rule, the app
# drew every diagram name 5% above the stored f_* figure the print pipeline
# used, so the two renderers never agreed. Unifying them on the print figure
# would have SHRUNK the app on all three decks, which the rule is forbidden
# to do, so the 5% is baked into the constants and print grows to meet the
# app instead.  MAIN_APP_INFLATION below is that factor, kept separate so the
# no-shrink baselines can be written per renderer.
SPEC_LABEL_RATIO_DING = 0.70875   # name inside the ding        (0.675 x 1.05)
SPEC_LABEL_RATIO_NOTE = 0.80325   # name inside a rim/inner field (0.765 x 1.05)
SPEC_LABEL_RATIO_BNOTE = 0.8232   # name inside a bottom field    (0.784 x 1.05)
SPEC_NUM_RATIO = 0.64             # the index number beside a field
SPEC_OCTAVE_RATIO = 0.66          # the octave digit, relative to its name
MAIN_APP_INFLATION = 1.05         # what main's APP multiplied f_ding/f_note/
                                  # f_bnote by (index.html, pre-rule). Print
                                  # multiplied by nothing.
SPEC_LABEL_PRINT_FLOOR = 3.6      # asserted HERE only. The pipeline does not
                                  # enforce it: diagram labels go through
                                  # fit_note (floor 2.5), not fit (floor 3.6),
                                  # and fit_note never fires on these decks.


def spec_label_ratio(zone):
    """CLAUDE.md's label rule, written out from the spec."""
    if zone == "ding":
        return SPEC_LABEL_RATIO_DING
    if zone == "bottom":
        return SPEC_LABEL_RATIO_BNOTE
    return SPEC_LABEL_RATIO_NOTE


def spec_label_size(radius, zone):
    return radius * spec_label_ratio(zone)


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


class CardWarningTest(PaletteSafeTest):
    """Owner decision 2026-09-15 (queue row 113): warnings go on the CARDS.

    A warning drawn only on the title card is lost in PRINTER_ONLY, which
    ships chord cards and nothing else.  Measured off the recording canvas,
    like every other assertion in this file.
    """

    WARNED = "NO 3RDS ON THIS PAN"

    def warned_deck(self):
        deck = dict(decks.HIJAZ)
        deck["warnings"] = [{"code": "NO_THIRDS",
                             "reason": "No 3rds on this pan: only power "
                                       "chords and sus chords."}]
        return deck

    def test_a_warned_deck_prints_the_line_on_every_chord_card(self):
        deck = self.warned_deck()
        self.use_palette(deck)
        for i, chord in enumerate(deck["chords"]):
            canvas = render_chord_card(deck, i + 1, chord)
            drawn = ["".join(t["text"] for t in canvas.texts)]
            self.assertIn(self.WARNED.replace(" ", ""),
                          "".join(drawn[0].split()),
                          "card %d lost the warning" % (i + 1,))

    def test_an_unwarned_deck_prints_no_warning_line(self):
        deck = decks.HIJAZ
        self.use_palette(deck)
        canvas = render_chord_card(deck, 1, deck["chords"][0])
        self.assertNotIn("3RDS", "".join(t["text"] for t in canvas.texts))

    def test_the_warning_line_stays_inside_the_card(self):
        deck = self.warned_deck()
        self.use_palette(deck)
        canvas = render_chord_card(deck, 1, deck["chords"][0])
        marks = [t for t in canvas.texts if not t["rotated"]]
        self.assertTrue(marks)
        for t in marks:
            self.assertGreaterEqual(t["x"], MIN_TEXT_MARGIN, t["text"])
            self.assertGreaterEqual(SPEC_CARD_W - (t["x"] + t["w"]),
                                    MIN_TEXT_MARGIN, t["text"])
            self.assertGreaterEqual(t["y"], MIN_TEXT_MARGIN, t["text"])
            self.assertLessEqual(t["y"], SPEC_CARD_H - MIN_TEXT_MARGIN, t["text"])


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


class LabelSizeRuleTest(unittest.TestCase):
    """ONE label rule, applied to every deck, every shell and every glyph.

    Sizes are measured from the glyphs ``draw_pan`` actually lays down, never
    read back out of the geometry table it was handed.
    """

    def drawn_glyphs(self, deck, R, numbers=True):
        canvas = RecordingCanvas()
        hifi.draw_pan(canvas, 0.0, 0.0, R, deck["spec"], numbers=numbers)
        return canvas.texts

    def drawn_name_sizes(self, deck, R):
        """Sizes of every glyph a note label draws: the name AND its octave.

        The octave digit is drawn at 0.66x the name and is the smallest text
        the pipeline emits anywhere, so a floor check that skips it checks
        nothing.
        """
        return sorted(round(t["size"], 6)
                      for t in self.drawn_glyphs(deck, R, numbers=False))

    def expected_name_sizes(self, deck, R):
        """The same multiset, derived from the deck data and the spec rule."""
        spec = deck["spec"]
        geom = spec["_geom"]
        out = []
        for f in [k for k in spec if k != "_geom"]:
            zone = spec[f][3]
            frac = (geom["r_ding"] if zone == "ding" else
                    geom["r_bnote"] if zone == "bottom" else geom["r_note"])
            size = spec_label_size(R * frac, zone)
            out.append(round(size, 6))
            out.append(round(size * SPEC_OCTAVE_RATIO, 6))
        return sorted(out)

    def name_sizes_by_zone(self, deck, R):
        """zone -> the name size the rule asks for, per the spec."""
        spec = deck["spec"]
        geom = spec["_geom"]
        out = {}
        for f in [k for k in spec if k != "_geom"]:
            zone = spec[f][3]
            frac = (geom["r_ding"] if zone == "ding" else
                    geom["r_bnote"] if zone == "bottom" else geom["r_note"])
            out[zone] = spec_label_size(R * frac, zone)
        return out

    def test_every_note_label_is_sized_by_the_rule(self):
        for deck in ALL_DECKS:
            with self.subTest(deck=deck["name"]):
                R = deck["R"]
                drawn = self.drawn_name_sizes(deck, R)
                want = self.expected_name_sizes(deck, R)
                self.assertEqual(len(drawn), len(want),
                                 "every field must carry a name and an octave")
                for got, expect in zip(drawn, want):
                    self.assertAlmostEqual(
                        got, expect, places=4,
                        msg="%s: label %.4f pt, rule says %.4f pt"
                            % (deck["name"], got, expect))

    def test_a_denser_pan_gets_smaller_labels_through_its_radius(self):
        """Row 221, via the only term that carries it: the field radius.

        The rule multiplies no density factor on top. A pan that fits more
        notes has smaller fields, and smaller fields are the whole of the
        response - which is why the rule can never shrink a label past what
        the deck's own geometry already asked for.
        """
        for zone in ("ding", "rim", "bottom"):
            sizes = [hifi.label_size(r, zone) for r in (12.0, 10.0, 8.0, 6.0)]
            for a, b in zip(sizes, sizes[1:]):
                self.assertGreater(a, b, "a smaller field must draw a smaller "
                                         "label in zone %r: %r" % (zone, sizes))
        pygmy = decks.PYGMY["spec"]["_geom"]
        hijaz = decks.HIJAZ["spec"]["_geom"]
        self.assertGreater(
            hifi.label_size(decks.HIJAZ["R"] * hijaz["r_note"], "rim"),
            hifi.label_size(decks.PYGMY["R"] * pygmy["r_note"], "rim"),
            "the 18-field pan must draw smaller rim labels than the 9-field pan")
        for zone in ("ding", "rim", "inner", "bottom"):
            self.assertAlmostEqual(
                hifi.label_size(10.0, zone), 10.0 * spec_label_ratio(zone),
                places=6, msg="zone %r must use the spec ratio" % (zone,))

    def test_no_label_is_smaller_than_what_either_renderer_drew_before(self):
        """The rule may never draw a label smaller than the size the glyph
        ACTUALLY CAME OUT AT before the rule existed - in EITHER renderer.

        The two renderers did not draw the same size, which is the whole
        reason the baseline has to be written per renderer:

            print (tools/hifi.py) drew  R * f_*
            app   (index.html)   drew  R * f_* * 1.05

        Comparing only against ``R * f_*`` compares the unified rule to the
        SMALLER of the two and passes while the app silently loses 5% on
        every name on every card - which is exactly what happened. The app's
        number is the binding one; ``fit_note`` is what absorbs the growth on
        the print side. Pygmy is the deck row 221 calls too small to read
        already, and the rule is not allowed to make it worse anywhere.

        The app is pinned to these same numbers by
        tests/test_render_agreement.py, which measures its emitted SVG.
        """
        for deck in ALL_DECKS:
            spec = deck["spec"]
            geom = spec["_geom"]
            R = deck["R"]
            for f in [k for k in spec if k != "_geom"]:
                zone = spec[f][3]
                key = ("f_ding" if zone == "ding" else
                       "f_bnote" if zone == "bottom" else "f_note")
                frac = (geom["r_ding"] if zone == "ding" else
                        geom["r_bnote"] if zone == "bottom" else geom["r_note"])
                drawn = hifi.label_size(R * frac, zone)
                for side, was in (("print", R * geom[key]),
                                  ("app", R * geom[key] * MAIN_APP_INFLATION)):
                    with self.subTest(deck=deck["name"], zone=zone, side=side):
                        self.assertGreaterEqual(
                            drawn + 1e-9, was,
                            "%s %s name draws at %.4f pt, under the %.4f pt "
                            "the %s renderer drew before the rule"
                            % (deck["name"], zone, drawn, was, side))
                        self.assertGreaterEqual(
                            drawn * SPEC_OCTAVE_RATIO + 1e-9,
                            was * SPEC_OCTAVE_RATIO,
                            "%s %s octave shrank on the %s side"
                            % (deck["name"], zone, side))
            if any(spec[k][3] != "ding" for k in spec if k != "_geom"):
                # Both renderers drew the index number at exactly R * f_num;
                # neither inflated it, so there is one baseline here.
                self.assertGreaterEqual(
                    hifi.num_size(R * geom["r_note"]) + 1e-9, R * geom["f_num"],
                    "%s index number shrank below f_num" % deck["name"])

    def test_every_name_is_larger_than_the_number_beside_it(self):
        """The hierarchy the rule has to keep: the note NAME is the primary
        label and the index number is secondary, on every deck and shell."""
        for deck in ALL_DECKS:
            spec = deck["spec"]
            geom = spec["_geom"]
            R = deck["R"]
            num = hifi.num_size(R * geom["r_note"])
            with self.subTest(deck=deck["name"]):
                for zone, size in self.name_sizes_by_zone(deck, R).items():
                    self.assertGreater(
                        size, num,
                        "%s: the %s name draws at %.3f pt under a %.3f pt "
                        "index number" % (deck["name"], zone, size, num))

    def test_numbers_are_drawn_by_the_rule_too(self):
        for deck in ALL_DECKS:
            spec = deck["spec"]
            geom = spec["_geom"]
            R = deck["R"]
            want = round(R * geom["r_note"] * SPEC_NUM_RATIO, 4)
            with_nums = [round(t["size"], 4)
                         for t in self.drawn_glyphs(deck, R)]
            without = [round(t["size"], 4)
                       for t in self.drawn_glyphs(deck, R, numbers=False)]
            for size in without:
                with_nums.remove(size)
            drawn = set(with_nums)
            with self.subTest(deck=deck["name"]):
                self.assertEqual(drawn, {want},
                                 "%s index numbers: drawn %r, rule says %r"
                                 % (deck["name"], sorted(drawn), want))

    def test_bottom_labels_are_an_output_of_the_rule(self):
        """Row 112: the bottom shell no longer carries its own stored figure."""
        deck = decks.PYGMY
        R = deck["R"]
        geom = deck["spec"]["_geom"]
        want = spec_label_size(R * geom["r_bnote"], "bottom")
        names = sorted(round(t["size"], 6)
                       for t in self.drawn_glyphs(deck, R, numbers=False)
                       if t["text"][:1].isalpha())
        self.assertAlmostEqual(min(names), want, places=4,
                               msg="the smallest name is a bottom-shell name "
                                   "and must come from the rule")
        self.assertNotAlmostEqual(
            min(names), R * geom["r_bnote"] * 0.675, places=2,
            msg="a flat ratio is not what the bottom shell draws")

    def test_no_label_falls_below_the_print_floor(self):
        """EVERY glyph the pan draws: names, octave digits and the index
        numbers beside the fields. The octave is the smallest text in the
        PDF, but the sample is not narrowed to it - the numbers are drawn by
        the same rule and have to clear the same floor, so this renders with
        `numbers=True` rather than measuring names alone."""
        for deck in ALL_DECKS:
            with self.subTest(deck=deck["name"]):
                smallest = min(round(t["size"], 6) for t in
                               self.drawn_glyphs(deck, deck["R"]))
                self.assertGreaterEqual(
                    smallest, SPEC_LABEL_PRINT_FLOOR,
                    "%s draws a %.2f pt glyph, under the %.1f pt floor"
                    % (deck["name"], smallest, SPEC_LABEL_PRINT_FLOOR))


# --- bottom-shell accent colour, quoted from CLAUDE.md ("Design system") ----
SPEC_BOTTOM_ACCENT = "#E27005"   # Pygmy U-labels and the bottom-note badge


class BottomAccentColourTest(PaletteSafeTest):
    """CLAUDE.md names ONE orange for every bottom-shell accent. Nothing else
    in this suite reads that constant, so a drift in it - the pipeline shipped
    #D96605 for a while - is invisible until someone holds a printed card up
    against the palette."""

    def hex_of(self, color):
        """The 8-bit colour a PDF reader shows, which is what the palette
        names. The constant is written to 4 decimal places, so comparing the
        floats would fail on a rounding difference nothing can see."""
        return "#%02X%02X%02X" % tuple(
            round(c * 255) for c in (color.red, color.green, color.blue))

    def test_the_accent_constant_is_the_palette_orange(self):
        self.assertEqual(self.hex_of(hifi.ORANGE), SPEC_BOTTOM_ACCENT,
                         "hifi.ORANGE is not %s" % SPEC_BOTTOM_ACCENT)

    def test_the_bottom_note_badge_prints_in_it(self):
        """Measured from the emitted glyphs rather than from the constant:
        the badge is the accent's most visible use on a chord card."""
        deck = decks.PYGMY
        self.use_palette(deck)
        chord = next(ch for ch in deck["chords"]
                     if any(deck["spec"][f][3] == "bottom" for f in ch[3]))
        canvas = RecordingCanvas()
        hifi.chord_card(canvas, 0.0, 0.0, deck, 1, chord)
        painted = {self.hex_of(t["fill"]) for t in canvas.texts
                   if t["font"] == "LabelSB"
                   and abs(t["y"] - (deck["y_note"] + 13)) < 1.0}
        self.assertTrue(painted, "no badge glyphs were drawn at all")
        self.assertEqual(painted, {SPEC_BOTTOM_ACCENT},
                         "the BOTTOM NOTES badge is not drawn in %s (drew %r)"
                         % (SPEC_BOTTOM_ACCENT, sorted(painted)))


class TitleBlurbChordCountTest(unittest.TestCase):
    """The title-card blurb's chord count must come FROM the deck's own
    chord list, not a hand-typed literal that can go stale the moment a
    chord is added or removed (Pygmy shipped "25 CHORDS" after it grew to
    27). Hijaz and Amara already had the right literal, so deriving it must
    leave their blurbs byte-identical - the only visible change is Pygmy's."""

    def test_hijaz_blurb_is_unchanged(self):
        # 2026-09-16 (engine adoption): Hijaz grew 18 -> 19 chords (the
        # F DIMINISHED card).
        self.assertEqual(
            decks.HIJAZ["blurb"],
            ["C#3  |  G#3  B3  C#4  D4  F4  F#4  G#4  B4",
             "PHRYGIAN DOMINANT, NO b6   -   19 CHORDS"])

    def test_amara_blurb_is_unchanged(self):
        # 2026-09-16 (engine adoption, D11): Amara grew 16 -> 25 chords,
        # fully re-ranked by the scale engine.
        self.assertIn("25 CHORDS", decks.AMARA["blurb"][-1])

    def test_pygmy_blurb_reads_the_true_chord_count(self):
        # 2026-09-16 (engine adoption, D10 amendment): Pygmy grew 27 -> 52
        # cards (31 distinct chord names) via the engine's root-instance
        # register enumeration.
        self.assertEqual(len(decks.PYGMY["chords"]), 52,
                         "fixture drift: Pygmy no longer has 52 chords")
        self.assertIn("52 CHORDS", decks.PYGMY["blurb"][-1],
                      "Pygmy's blurb still reads a stale chord count: %r"
                      % (decks.PYGMY["blurb"][-1],))
        self.assertNotIn("27 CHORDS", decks.PYGMY["blurb"][-1])

    def test_every_deck_blurb_count_matches_its_own_chord_list(self):
        for deck in ALL_DECKS:
            n = len(deck["chords"])
            last_line = deck["blurb"][-1]
            self.assertIn("%d CHORDS" % n, last_line,
                         "%s: blurb does not say %d CHORDS (%r)"
                         % (deck["name"], n, last_line))


class PinnedPrintValuesTest(unittest.TestCase):
    """Values a later 'just use the solver' refactor must not move (Q1, Q2,
    Q4). Read off the CONSTRUCTED deck objects, never the module source - W1a
    runs concurrently and is moving these literals out of tools/decks.py into
    data/decks.json's overlay, and an object-shaped assertion holds under
    either merge order."""

    def test_hijaz_geometry_is_pinned(self):
        self.assertEqual(
            (decks.HIJAZ["R"], decks.HIJAZ["cy"],
             decks.HIJAZ["y_note"], decks.HIJAZ["y_num"]),
            (73.0, 126.0, 30.0, 14.0))

    def test_amara_geometry_is_pinned(self):
        self.assertEqual(
            (decks.AMARA["R"], decks.AMARA["cy"],
             decks.AMARA["y_note"], decks.AMARA["y_num"]),
            (73.0, 126.0, 30.0, 14.0))

    def test_pygmy_geometry_is_pinned(self):
        # Pygmy's R is 60.0, not 73.0 like the other two decks - a "just use
        # the solver" refactor would quietly move this by -15.7%.
        self.assertEqual(
            (decks.PYGMY["R"], decks.PYGMY["cy"],
             decks.PYGMY["y_note"], decks.PYGMY["y_num"]),
            (60.0, 121.0, 30.0, 14.0))

    def test_credit_strings_are_pinned(self):
        self.assertEqual(decks.HIJAZ["credit"], "C# HIJAZ / ORION")
        self.assertEqual(decks.PYGMY["credit"], "F3 LOW PYGMY / F AEOLIAN")
        self.assertEqual(decks.AMARA["credit"], "D AMARA / D MINOR")

    def test_pygmy_blank_cards_is_pinned(self):
        self.assertEqual(decks.PYGMY["blank_cards"], 7)
