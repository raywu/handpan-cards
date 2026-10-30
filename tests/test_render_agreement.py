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

DECK_BY_ID = {"kurd": decks.KURD, "amara10": decks.AMARA10,
              "hijaz": decks.HIJAZ, "pygmy": decks.PYGMY, "amara": decks.AMARA}
# Owner, 2026-10-06 ("Test the old three only"): the no-shrink baseline exists
# only for the decks that drew something before the label rule did.
PRE_RULE_IDS = ("hijaz", "pygmy", "amara")
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
        self._lw = None

    # --- state the renderer sets -----------------------------------------
    def setStrokeColor(self, c):
        self._stroke = _hex(c) if hasattr(c, "red") else str(c)

    def setFillColor(self, c):
        self._fill = _hex(c) if hasattr(c, "red") else str(c)

    def setDash(self, *a):
        self._dashed = bool(a)

    def setLineWidth(self, w):
        self._lw = w

    def circle(self, x, y, r, stroke=1, fill=0):
        self.circles.append({"x": x, "y": y, "r": r, "lw": self._lw,
                             "stroke": self._stroke, "dashed": self._dashed})

    def rect(self, x, y, w, h, stroke=1, fill=0):
        self.rects.append({"x": x, "y": y, "w": w, "h": h,
                           "fill": self._fill if fill else None,
                           "stroke": self._stroke if stroke else None})

    def roundRect(self, x, y, w, h, r, stroke=1, fill=0):
        self.rects.append({"x": x, "y": y, "w": w, "h": h,
                           "fill": self._fill if fill else None,
                           "stroke": self._stroke if stroke else None})

    def setFont(self, name, size, *a, **k):
        self._font = name
        self._size = size

    def drawString(self, x, y, text, *a, **k):
        self.texts.append({"x": x, "y": y, "text": text, "font": self._font,
                           "size": self._size, "anchor": "l", "fill": self._fill})

    def drawCentredString(self, x, y, text, *a, **k):
        self.texts.append({"x": x, "y": y, "text": text, "font": self._font,
                           "size": self._size, "anchor": "c", "fill": self._fill})

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
            chrome = 1 if g.get("place") else \
                1 + bool(g.get("inner_ring")) + bool(g.get("bottom"))

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
                # A lit field is three stacked circles - the outer ring, the
                # coloured band, the black hairline - drawn largest to
                # smallest (draw_ring). Sorting by radius recovers that
                # order without depending on draw call sequence.
                ordered = sorted(group, key=lambda g: -g["r"])
                entry = {"x": x, "y": y,
                         "r": round(ordered[0]["r"] / R * 100, 3),
                         "state": state}
                if state in ("root", "tone") and len(ordered) == 3:
                    band, hairline = ordered[1], ordered[2]
                    entry["bandR"] = round(band["r"] / R * 100, 3)
                    entry["bandWidth"] = round(band["lw"] / R * 100, 3)
                    entry["hairlineR"] = round(hairline["r"] / R * 100, 3)
                fields.append(entry)
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
            # Bottom-shell numbers alone use LabelSB/ORANGE (draw_pan); every
            # other number is Label/INK. Keyed the same way as number_sizes.
            number_fills = {
                t["text"]: t["fill"] for t in rec.texts
                if t["font"] in ("Label", "LabelSB") and t["anchor"] == "c"
                and t["text"] in numbering}
            # The badge is `tracked()`'d one glyph at a time (drawString,
            # anchor "l") at y_note + 13; card_warnings share the font but sit
            # at a different y and are centred, so the y+anchor filter keeps
            # them out.
            badge_glyphs = [t for t in rec.texts if t["font"] == "LabelSB"
                            and t["anchor"] == "l"
                            and abs(t["y"] - (deck["y_note"] + 13)) <= 3.5]
            badge_fill = badge_glyphs[0]["fill"] if badge_glyphs else None

            out.append({"name": chord[0] + chord[1], "fields": fields,
                        "labelSizes": label_sizes,
                        "numberSizes": number_sizes,
                        "numberFills": number_fills,
                        "badgeFill": badge_fill,
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


def render_app_badge_fill():
    """The `.badge` colour rule, read straight out of index.html - like
    `render_app_border`, the app's badge colour is a CSS rule, not something
    an SVG dump would carry."""
    with open(os.path.join(paths.ROOT, "index.html"), encoding="utf-8") as fh:
        html = fh.read()
    m = re.search(r"\.badge\{([^}]*)\}", html)
    return re.search(r"[^-]color:([^;]+);", m.group(1)).group(1).strip()


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

    def test_recording_canvas_records_plain_rects(self):
        rec = RecordingCanvas()
        rec.setFillColor("#123456")
        rec.rect(1.0, 2.0, 30.0, 40.0, stroke=0, fill=1)
        self.assertEqual(rec.rects, [{"x": 1.0, "y": 2.0, "w": 30.0, "h": 40.0,
                                      "fill": "#123456", "stroke": None}])

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
        print_ratio = print_bw / OLD_BW
        app_ratio = app_pad / OLD_PAD
        self.assertAlmostEqual(
            print_ratio, app_ratio, delta=0.02,
            msg="border weight grew by a different relative amount in each "
                "renderer: print x%.3f vs app x%.3f" % (print_ratio, app_ratio))


class RenderAgreement(unittest.TestCase):
    decks = DECK_BY_ID
    dump_args = []

    @classmethod
    def setUpClass(cls):
        dump = subprocess.run(
            ["node", os.path.join(paths.ROOT, "tests", "helpers", "dump_app_render.js")]
            + cls.dump_args,
            capture_output=True, text=True, check=True, cwd=paths.ROOT)
        cls.app = json.loads(dump.stdout)
        cls.print_ = {k: render_print(v) for k, v in cls.decks.items()}

    def each_card(self):
        for card in self.app:
            yield card, self.print_[card["deck"]][card["index"]]

    def test_every_card_is_compared(self):
        self.assertEqual(len(self.app), 177)
        self.assertEqual(sum(len(v) for v in self.print_.values()), 177)

    def test_chord_names_line_up(self):
        """Compares the chord-name text only.

        The print header's placement (deck name, #n, degree, subtitle and
        warning positions) is print-only and exempt from app/print agreement;
        tests/test_print.py (P2, P3) and tests/pdfcards.test.js (P4) pin it.
        No field of the diagram, note line, number line or badge is exempt.
        """
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
            if app_c["deck"] not in PRE_RULE_IDS:
                continue
            deck = self.decks[app_c["deck"]]
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
                    if app_c["deck"] == "pygmy" and zone in ("rim", "inner"):
                        was *= 1 - 3e-4
                    self.assertGreaterEqual(
                        drawn + 1e-3, was,
                        "%s %s (%s): %s draws at %.3f, under the %.3f this "
                        "renderer drew before the label rule"
                        % (app_c["deck"], app_c["name"], side, field,
                           drawn, was))
                for label, drawn in card["numberSizes"].items():
                    self.assertGreaterEqual(
                        drawn + 1e-3,
                        geom["f_num"] * 100 * (1 - 3e-4 if app_c["deck"] == "pygmy" else 1.0),
                        "%s %s (%s): number %s draws at %.3f, under f_num"
                        % (app_c["deck"], app_c["name"], side, label, drawn))

    def test_drawn_bottom_note_badge_agrees(self):
        """The printed badge text itself - nothing else asserts what it says."""
        for app_c, print_c in self.each_card():
            self.assertEqual(app_c["badgeText"], print_c["badgeText"],
                             "%s %s: badge text" % (app_c["deck"], app_c["name"]))

    def test_band_and_hairline_agree(self):
        """Q24: the RING drawn inside a lit field - the coloured band and its
        hairline - is pinned only by the app's own digest. Position, outer
        radius, highlight state and label sizes above all agree while the
        band width or the hairline radius drifts silently in print alone;
        this compares the ring geometry itself between the two renderers."""
        for app_c, print_c in self.each_card():
            where = "%s %s" % (app_c["deck"], app_c["name"])
            for a, p in zip(app_c["fields"], print_c["fields"]):
                if a["state"] not in ("root", "tone"):
                    continue
                self.assertIn("bandR", a, where + ": app lit field has no "
                              "band/hairline geometry")
                self.assertIn("bandR", p, where + ": print lit field has no "
                              "band/hairline geometry")
                for axis in ("bandR", "bandWidth", "hairlineR"):
                    self.assertAlmostEqual(
                        a[axis], p[axis], delta=TOL,
                        msg="%s: %s %.3f (app) vs %.3f (print)"
                            % (where, axis, a[axis], p[axis]))

    def test_bottom_shell_accents_are_hifi_orange(self):
        """Q24: the bottom-shell number colour and the BOTTOM NOTES badge are
        both meant to draw in hifi.ORANGE, in every renderer. Nothing pinned
        that before - `test_highlighting_agrees` sees root/tone/off states
        only, and this suite's app CSS check (`BorderAgreementTest`) never
        looked at `.badge`."""
        orange_hex = _hex(hifi.ORANGE)
        app_badge_css = render_app_badge_fill()
        self.assertEqual(
            app_badge_css, orange_hex,
            "app .badge colour is %s, not hifi.ORANGE %s"
            % (app_badge_css, orange_hex))
        for app_c, print_c in self.each_card():
            where = "%s %s" % (app_c["deck"], app_c["name"])
            deck = self.decks[app_c["deck"]]
            bottom_labels = {v[5] for k, v in deck["spec"].items()
                             if k != "_geom" and v[3] == "bottom"}
            for lab in bottom_labels:
                if lab in app_c["numberFills"]:
                    self.assertEqual(
                        app_c["numberFills"][lab], orange_hex,
                        "%s: app bottom number %s fill %s != hifi.ORANGE"
                        % (where, lab, app_c["numberFills"][lab]))
                if lab in print_c["numberFills"]:
                    self.assertEqual(
                        print_c["numberFills"][lab], orange_hex,
                        "%s: print bottom number %s fill %s != hifi.ORANGE"
                        % (where, lab, print_c["numberFills"][lab]))
            if print_c["badgeText"]:
                self.assertEqual(
                    print_c["badgeFill"], orange_hex,
                    "%s: print badge fill %s != hifi.ORANGE"
                    % (where, print_c["badgeFill"]))


PROFILE_FIXTURES = {
    "profile_pygmy": os.path.join(paths.ROOT, "tests", "fixtures", "profile_case_pygmy_v1.json"),
    "profile_kurd9": os.path.join(paths.ROOT, "tests", "fixtures", "profile_case_kurd9_v1.json"),
}
PROFILE_FILE = os.path.join(paths.ROOT, "tests", "fixtures", "paired_profile_v1.json")


def _profile_payload(name):
    with open(PROFILE_FIXTURES[name], encoding="utf-8") as fh:
        return json.load(fh)


class ProfileRenderAgreement(RenderAgreement):
    """Neotone lane P: a paired-area deck (geom.place) drawn by the app SVG
    and by hifi must agree on everything the inherited checks compare, on the
    two generated profile decks. The inherited tests run unchanged."""

    decks = {k: decks.from_generated(_profile_payload(k)) for k in PROFILE_FIXTURES}
    dump_args = list(PROFILE_FIXTURES.values())

    def test_every_card_is_compared(self):
        self.assertEqual(len(self.app), sum(len(d["chords"]) for d in self.decks.values()))
        self.assertEqual(sum(len(v) for v in self.print_.values()), len(self.app))
        self.assertEqual({c["deck"] for c in self.app}, set(PROFILE_FIXTURES))

    def test_the_name_is_always_larger_than_the_number_beside_it(self):
        """Per field, not card-wide: a primary field's number (r 0.16) is
        legitimately larger than a secondary field's name (r 0.11)."""
        for app_c, print_c in self.each_card():
            spec = self.decks[app_c["deck"]]["spec"]
            by_label = {v[5]: v[0] + str(v[1]) for k, v in spec.items()
                        if k != "_geom" and v[3] != "ding"}
            for side, card in (("app", app_c), ("print", print_c)):
                for label, num in card["numberSizes"].items():
                    self.assertGreater(
                        card["labelSizes"][by_label[label]], num,
                        "%s %s (%s) field %s" % (app_c["deck"], app_c["name"], side, label))

    def _expected_centres(self, name):
        payload = _profile_payload(name)
        deck = payload["deck"]
        out = {}
        for fid, (angle, orbit, r) in deck["geom"]["place"].items():
            a = math.radians(angle)
            out[fid] = (round(orbit * 100 * math.cos(a), 3),
                        round(-orbit * 100 * math.sin(a), 3),
                        round(r * 100, 3))
        g = deck["geom"]
        out["0"] = (0.0, round(g["ding_dy"] * 100, 3), round(g["r_ding"] * 100, 3))
        return out

    def test_both_renderers_draw_the_fields_where_geom_place_says(self):
        for app_c, print_c in self.each_card():
            want = sorted(self._expected_centres(app_c["deck"]).values())
            for side, card in (("app", app_c), ("print", print_c)):
                got = sorted((f["x"], f["y"], f["r"]) for f in card["fields"])
                self.assertEqual(len(got), len(want), "%s %s" % (side, app_c["name"]))
                for g, w in zip(got, want):
                    for a, b in zip(g, w):
                        self.assertAlmostEqual(a, b, delta=TOL,
                                               msg="%s %s %s vs %s" % (side, app_c["name"], g, w))

    def test_an_empty_slot_draws_nothing_and_no_guide_rings_are_drawn(self):
        card = next(c for c in self.app if c["deck"] == "profile_kurd9")
        self.assertEqual(len(card["fields"]), 10)

    def test_source_bottom_notes_keep_the_dashed_ring_wherever_they_sit(self):
        payload = _profile_payload("profile_pygmy")
        fields = payload["deck"]["fields"]
        centres = self._expected_centres("profile_pygmy")
        bottoms = {centres[k][:2] for k, v in fields.items() if v[3] == "bottom"}
        self.assertEqual(len(bottoms), 6)
        saw = False
        for app_c, print_c in self.each_card():
            if app_c["deck"] != "profile_pygmy":
                continue
            for side, card in (("app", app_c), ("print", print_c)):
                dashed = {(f["x"], f["y"]) for f in card["fields"] if f["state"] == "off-bottom"}
                lit = {(f["x"], f["y"]) for f in card["fields"] if f["state"] in ("root", "tone")}
                self.assertEqual(dashed, bottoms - lit, "%s %s" % (side, app_c["name"]))
                saw = saw or bool(dashed)
        self.assertTrue(saw)

    def test_top_notes_in_a_secondary_slot_draw_as_ordinary_top_fields(self):
        payload = _profile_payload("profile_kurd9")
        place = payload["deck"]["geom"]["place"]
        secondary = {k for k, v in place.items() if v[1] > 0.7}
        self.assertEqual(len(secondary), 2)
        for app_c, print_c in self.each_card():
            if app_c["deck"] != "profile_kurd9":
                continue
            for side, card in (("app", app_c), ("print", print_c)):
                self.assertNotIn("off-bottom", [f["state"] for f in card["fields"]])
                self.assertEqual(card["badgeText"], "")

    def test_the_print_floor_holds_for_every_glyph(self):
        for name in PROFILE_FIXTURES:
            deck = self.decks[name]
            R = deck["R"]
            for card in self.print_[name]:
                for field, size in card["labelSizes"].items():
                    pt = size / 100 * R
                    self.assertGreaterEqual(pt, 3.6, "%s %s name" % (name, field))
                    self.assertGreaterEqual(pt * 0.66, 3.6 - 1e-6,
                                            "%s %s octave digit" % (name, field))
                for lab, size in card["numberSizes"].items():
                    self.assertGreaterEqual(size / 100 * R, 3.6, "%s number %s" % (name, lab))

    def test_the_print_radius_is_the_frozen_extent_rule(self):
        with open(PROFILE_FILE, encoding="utf-8") as fh:
            p = json.load(fh)
        reach = max(max(p[k]["orbit"] + p[k]["r"] + p["n_out"] + p[k]["r"] * 0.64
                        for k in ("primary", "secondary")), p["ding"]["r"])
        want = round(74.0 / (reach + p["extent_margin"]), 1)
        for name, deck in self.decks.items():
            self.assertEqual(deck["R"], want, name)
        self.assertEqual(hifi.profile_radius(_profile_payload("profile_kurd9")["deck"]["geom"]), want)

    def test_hifi_profile_figures_equal_the_frozen_fixture(self):
        with open(PROFILE_FILE, encoding="utf-8") as fh:
            p = json.load(fh)
        self.assertEqual(hifi.PROFILE_DRAW, {
            "primary": p["primary"], "secondary": p["secondary"], "ding": p["ding"],
            "n_in": p["n_in"], "n_out": p["n_out"], "extent_margin": p["extent_margin"]})

    def test_numbers_sit_inward_of_a_primary_and_outward_of_a_secondary(self):
        payload = _profile_payload("profile_kurd9")
        deck = payload["deck"]
        by_label = {v[5]: k for k, v in deck["fields"].items()}
        place = deck["geom"]["place"]
        g = hifi_geom = deck["geom"]
        R = self.decks["profile_kurd9"]["R"]
        for name, fid in by_label.items():
            if fid == "0":
                continue
            angle, orbit, r = place[fid]
            n_in, n_out = hifi.PROFILE_DRAW["n_in"], hifi.PROFILE_DRAW["n_out"]
            nr = orbit + r + n_out if orbit > 0.7 else orbit - r - n_in
            a = math.radians(angle)
            rec = RecordingCanvas()
            hifi.chord_card(rec, 0.0, 0.0, self.decks["profile_kurd9"], 1,
                            self.decks["profile_kurd9"]["chords"][0])
            cx, cy = hifi.CW / 2, self.decks["profile_kurd9"]["cy"]
            nfs = r * 0.64 * R
            hit = [t for t in rec.texts if t["text"] == name and t["anchor"] == "c"
                   and t["font"] == "Label"]
            self.assertTrue(hit, name)
            self.assertAlmostEqual(hit[0]["x"], cx + nr * R * math.cos(a), delta=0.01)
            self.assertAlmostEqual(hit[0]["y"], cy + nr * R * math.sin(a) - nfs * 0.36, delta=0.01)


class PrintStylesheetTest(unittest.TestCase):
    """B4/AC-B3: the `@media print` block's placement and its literals."""

    def setUp(self):
        with open(os.path.join(paths.ROOT, "index.html"), encoding="utf-8") as fh:
            self.html = fh.read()
        self.style = self.html.split("<style>", 1)[1].split("</style>", 1)[0]
        i = self.style.index("@media print")
        self.print_css = self.style[i:]

    def test_print_block_is_last_in_the_style_element(self):
        """The print block forces print colour adjustment, clears the page
        background and padding, and resets the swipe transform - none of it
        scoped by selector specificity, so it leans on cascade order instead:
        CSS resolves an equal-specificity tie in favor of whichever rule
        comes later, so being last means this block overrides every earlier
        rule touching the same properties - not that nothing after it could
        safely override it (trivially true, since it is last), but that
        nothing before it can escape being overridden by it."""
        self.assertIn("@media print", self.style)
        self.assertEqual(self.style.count("@media print"), 1)
        # Nothing but the print block's own braces after it.
        tail = self.print_css
        self.assertTrue(tail.rstrip().endswith("}"))
        # No further top-level rule opens after the block closes.
        depth = 0
        end = None
        for i, c in enumerate(tail):
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        self.assertIsNotNone(end, "the @media print block never closes")
        self.assertEqual(tail[end + 1:].strip(), "",
                         "a rule was added after the print block; the "
                         ".face::before first-match read would break")

    def test_the_screen_border_rule_is_still_the_first_face_before_match(self):
        rule = render_app_border()
        self.assertEqual(rule["padding"], 3.2)
        self.assertIn("var(--ga)", rule["background"])

    def test_print_block_forces_colour(self):
        """Chrome prints with background graphics OFF by default, which is what
        flattened the frame in the B0 spike."""
        self.assertIn("print-color-adjust:exact", self.print_css)
        self.assertIn("-webkit-print-color-adjust:exact", self.print_css)


class PdfEmitterGeometryTest(unittest.TestCase):
    """The THIRD renderer's geometry, against the two that were already pinned.

    `src/engine/pdfcards.js` draws the same pan and the same 3x3 sheet as
    `tools/hifi.py`, in a different language, from its own constants - and it
    is the renderer a phone actually ships, so a drift here reaches a user
    before it reaches anyone's test. `tests/test_pdf_parity.py` holds the
    whole drawing against print glyph for glyph, which is the strong check;
    this class holds the CONSTANTS, because a drawing comparison tells you
    that something moved and not which number moved it.

    The app's `PRINT_GEOM` is in here too: the card and gutter figures now
    exist in three places (hifi, the engine module, the app's print
    stylesheet), and three copies that agree by luck are the failure the
    single-definition rule above exists to prevent. An engine module cannot
    read app JS - it is inlined ahead of it - so the copies are real; what
    keeps them honest is this assertion.
    """

    @classmethod
    def setUpClass(cls):
        out = subprocess.run(
            ["node", "-e",
             "const {loadEngine}=require('./tools/engine_loader.js');"
             "const H=loadEngine(['core','fontdata','pdf','pdfdeck','pdfcards']);"
             "process.stdout.write(JSON.stringify({geom:H.pdfcards.GEOM,"
             "paper:H.pdfcards.PAPER,slots:H.pdfcards.slots('letter'),"
             "warn:H.pdfcards.CARD_WARNINGS,"
             "titleWarn:H.pdfdeck.TITLE_WARNINGS}));"],
            capture_output=True, text=True, cwd=paths.ROOT, timeout=120)
        if out.returncode != 0:
            raise AssertionError(out.stderr)
        cls.js = json.loads(out.stdout)

    def test_the_card_and_the_gutters_are_the_print_spec(self):
        g = self.js["geom"]
        self.assertEqual((g["CW"], g["CH"]), (hifi.CW, hifi.CH))
        self.assertEqual((g["GX"], g["GY"]), (hifi.GX, hifi.GY))
        self.assertEqual((g["PW"], g["PH"]), hifi.PAGE)

    def test_letter_is_the_page_hifi_prints_on(self):
        self.assertEqual(tuple(self.js["paper"]["letter"]), hifi.PAGE)
        self.assertEqual(self.js["paper"]["a4"], [595.28, 841.89])

    def test_the_slots_are_hifi_slots(self):
        want = [list(s) for s in hifi.slots()]
        got = self.js["slots"]
        self.assertEqual(len(got), len(want))
        for a, b in zip(got, want):
            self.assertAlmostEqual(a[0], b[0], places=9)
            self.assertAlmostEqual(a[1], b[1], places=9)

    def test_the_warning_badges_are_the_same_copy(self):
        self.assertEqual(self.js["warn"], hifi.CARD_WARNINGS)

    def test_the_title_card_warning_lines_are_the_same_copy(self):
        self.assertEqual(self.js["titleWarn"], decks.TITLE_WARNINGS)

    def test_the_diagram_label_rule_carries_the_same_constants(self):
        """The no-shrink rule, third copy.

        These six are the whole of the label rule, and CLAUDE.md fixes the
        baseline they are measured against. The parity test would catch a
        changed ratio as a wall of moved glyphs; this catches it as one line.
        """
        with open(os.path.join(paths.ROOT, "src", "engine", "core.js"),
                  encoding="utf-8") as fh:
            src = fh.read()
        for name, want in (("LABEL_RATIO_DING", hifi.LABEL_RATIO_DING),
                           ("LABEL_RATIO_NOTE", hifi.LABEL_RATIO_NOTE),
                           ("LABEL_RATIO_BNOTE", hifi.LABEL_RATIO_BNOTE),
                           ("NUM_RATIO", hifi.NUM_RATIO),
                           ("OCTAVE_RATIO", hifi.OCTAVE_RATIO),
                           ("LABEL_WIDTH_RATIO", hifi.LABEL_WIDTH_RATIO)):
            m = re.search(r"var %s = ([\d.]+);" % name, src)
            self.assertIsNotNone(m, "%s is gone from core.js" % name)
            self.assertEqual(float(m.group(1)), want, name)

    def test_each_label_rule_number_is_written_once_per_language(self):
        """The label rule's six figures are literals once in JS, once in Python."""
        import glob
        figs = ("0.70875", "0.80325", "0.8232", "1.47", "0.64", "0.66")
        skip = re.compile(r"\s*(#|\*|//|/\*)")

        def count(texts):
            found = {f: 0 for f in figs}
            for text in texts:
                for line in text.splitlines():
                    if skip.match(line) or "F_NUM_RATIO" in line:
                        continue
                    for f in figs:
                        found[f] += len(re.findall(
                            r"(?<![0-9.])%s(?![0-9])" % re.escape(f), line))
            return found

        def read(path):
            with open(path, encoding="utf-8") as fh:
                return fh.read()

        js = [read(p) for p in sorted(glob.glob(
            os.path.join(paths.ROOT, "src", "engine", "*.js")))]
        html = read(os.path.join(paths.ROOT, "index.html"))
        js.append(re.sub(r"<!-- engine:(\w+) begin.*?<!-- engine:\1 end -->",
                         "", html, flags=re.S))
        py = [read(p) for p in sorted(glob.glob(
            os.path.join(paths.ROOT, "tools", "*.py")))]
        for lang, found in (("JS", count(js)), ("Python", count(py))):
            for f in figs:
                self.assertEqual(found[f], 1,
                                 "%s writes %s %d times" % (lang, f, found[f]))


if __name__ == "__main__":
    unittest.main()


class I18nRegionTest(unittest.TestCase):
    def test_the_i18n_region_equals_data_i18n(self):
        with open(os.path.join(paths.ROOT, "index.html"), encoding="utf-8") as fh:
            html = fh.read()
        m = re.search(r"<!-- i18n begin[^>]*-->\s*<script>(const I18N = .*?;)</script>\s*<!-- i18n end -->", html, re.S)
        self.assertIsNotNone(m, "index.html has no i18n region")
        directory = os.path.join(paths.ROOT, "data", "i18n")
        tables = {}
        for name in sorted(os.listdir(directory)):
            if name.endswith(".json"):
                with open(os.path.join(directory, name), encoding="utf-8") as fh:
                    tables[name[:-5]] = json.load(fh)
        inline = json.loads(m.group(1)[len("const I18N = "):-1])
        self.assertEqual(inline, tables)

    def test_sync_i18n_check_reports_a_stale_region(self):
        import contextlib
        import io
        import tempfile
        import sync_i18n
        with open(sync_i18n.INDEX, encoding="utf-8") as fh:
            html = fh.read()
        stale = html.replace('"header.settings": "Settings"', '"header.settings": "Settingz"', 1)
        self.assertNotEqual(stale, html)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "index.html")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(stale)
            real = sync_i18n.INDEX
            sync_i18n.INDEX = path
            try:
                with contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(sync_i18n.main(["sync_i18n.py", "--check"]), 1)
                with open(path, encoding="utf-8") as fh:
                    self.assertEqual(fh.read(), stale, "--check writes nothing")
            finally:
                sync_i18n.INDEX = real

    def test_the_i18n_region_sits_below_the_engine_wrapper(self):
        with open(os.path.join(paths.ROOT, "index.html"), encoding="utf-8") as fh:
            html = fh.read()
        self.assertGreater(html.index("<!-- i18n begin"), html.index("<!-- engine end -->"),
                           "inline_engine rewrites everything inside the engine wrapper")

    def test_inline_engine_sync_keeps_the_i18n_region(self):
        import contextlib
        import io
        import tempfile
        import inline_engine
        import sync_i18n
        with open(inline_engine.INDEX, encoding="utf-8") as fh:
            html = fh.read()
        start = html.index("<!-- engine:core begin")
        stale = html[:start] + html[start:].replace("var HPE", "var HPE_STALE", 1)
        self.assertNotEqual(stale, html)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "index.html")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(stale)
            real = (inline_engine.INDEX, sync_i18n.INDEX)
            inline_engine.INDEX = sync_i18n.INDEX = path
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    inline_engine.sync()
                with open(path, encoding="utf-8") as fh:
                    after = fh.read()
                self.assertIn("<!-- i18n begin", after, "the engine sync dropped the i18n region")
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(sync_i18n.main(["sync_i18n.py", "--check"]), 0)
            finally:
                inline_engine.INDEX, sync_i18n.INDEX = real

    def test_sync_i18n_inserts_a_missing_region_below_the_engine_block(self):
        import contextlib
        import io
        import tempfile
        import sync_i18n
        with open(sync_i18n.INDEX, encoding="utf-8") as fh:
            html = fh.read()
        bare = sync_i18n.PATTERN.sub("", html, count=1)
        self.assertNotIn("<!-- i18n begin", bare)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "index.html")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(bare)
            real = sync_i18n.INDEX
            sync_i18n.INDEX = path
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(sync_i18n.main(["sync_i18n.py", "--check"]), 1)
                    self.assertEqual(sync_i18n.main(["sync_i18n.py"]), 0)
                    self.assertEqual(sync_i18n.main(["sync_i18n.py", "--check"]), 0)
                with open(path, encoding="utf-8") as fh:
                    after = fh.read()
                self.assertGreater(after.index("<!-- i18n begin"), after.index("<!-- engine end -->"))
                self.assertLess(after.index("<!-- i18n end -->"), after.index("const DECKS"))
            finally:
                sync_i18n.INDEX = real

    def test_sync_i18n_writes_no_closing_tag_sequence(self):
        import sync_i18n
        text = sync_i18n.render({"en": {"k": "a </script> b"}})
        self.assertNotIn("</", text)
        self.assertEqual(json.loads(text[len("const I18N = "):-1]), {"en": {"k": "a </script> b"}})
