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
        self.assertEqual(len(self.app), 96)
        self.assertEqual(sum(len(v) for v in self.print_.values()), 96)

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


def read_print_geom_source():
    """The print sheet's page geometry, lifted out of `index.html` as SOURCE.

    AC-B3. The 3x3 layout is pinned by value against `hifi.slots()`, which is
    the print spec. The 3x2 layout of D17 has NO Python oracle - `slots()`
    (`tools/hifi.py:354-362`) is hardwired to `range(3)` and there is nothing
    3x2 in `hifi.py` to compare against - so it is pinned a different way:
    the JS must derive both layouts from ONE declaration of the card and
    gutter constants. A second, independently typed copy of
    177.6/247.2/12.2/9.4 would pass any value check today and drift tomorrow,
    which is exactly the failure this criterion exists to catch.
    """
    with open(os.path.join(paths.ROOT, "index.html"), encoding="utf-8") as fh:
        html = fh.read()
    decl = re.search(r"const PRINT_GEOM = \{[^}]*\};", html)
    assert decl, "index.html has no PRINT_GEOM declaration"
    return decl.group(0), html


def read_js_function(name, html=None):
    """One brace-matched function body out of `index.html`, as source text."""
    if html is None:
        _, html = read_print_geom_source()
    start = html.index("function %s(" % name)
    depth, i = 0, html.index("{", start)
    while True:
        if html[i] == "{":
            depth += 1
        elif html[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    return html[start:i + 1]


def read_js_const(name, html=None):
    """One `const <name> = ...;` declaration, brace-matched, as source text.

    A regex stopping at the first `\n};` is not enough: `PRINT_PAPER` is a
    one-liner and the search runs on to the next multi-line object, dragging a
    thousand lines of unrelated app source into the node snippet with it.
    """
    if html is None:
        _, html = read_print_geom_source()
    start = html.index("const %s = " % name)
    depth, i = 0, start
    while True:
        c = html[i]
        if c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
        elif c == ";" and depth == 0:
            return html[start:i + 1]
        i += 1


def strip_js_comments(src):
    """Comments are not code. The literal scan below reads a function BODY for
    a second copy of a constant, and `printGridCSS`'s own comment quotes the
    numbers it is explaining - 247.2, 9.4, and the 760.3999999999999 that
    motivates the rounding. Scanning the raw text reports those as drift."""
    return re.sub(r"/\*[\s\S]*?\*/|//[^\n]*", " ", src)


def grid_css(name, paper="letter"):
    """Run the app's own `printGridCSS()` in node and read the CSS back.

    This is the function that SHIPS - the browser sheet is a CSS grid, and
    nothing in the app computes slot coordinates. Pulling the declaration it
    emits and deriving positions from that is the only way a Python oracle can
    speak about the geometry the app actually renders.
    """
    _, html = read_print_geom_source()
    src = "\n".join([read_js_const(n, html) for n in
                     ("PRINT_GEOM", "PRINT_PAPER", "PRINT_LAYOUTS",
                      "PRINT_DESIGN_W")] +
                    [read_js_function("printGridCSS", html),
                     "console.log(printGridCSS(%r, %r));" % (name, paper)])
    out = subprocess.run([os.environ.get("NODE", "node"), "-e", src],
                         capture_output=True, text=True, check=True)
    return out.stdout


def read_layout(name, html=None):
    """One `PRINT_LAYOUTS` entry as Python numbers, read out of the source.

    `PRINT_GEOM.GX` resolves to `hifi.GX`, which is the point: the expected
    stylesheet below is composed from the PRINT SPEC, not from whatever the
    app happens to say today.
    """
    body = re.search(r"\b%s: \{([^}]*)\}" % name,
                     read_js_const("PRINT_LAYOUTS", html)).group(1)
    out = {}
    for key, raw in re.findall(r"(\w+): ([^,}]+)", body):
        raw = raw.strip()
        if raw.startswith("PRINT_GEOM."):
            out[key] = float(getattr(hifi, raw.split(".", 1)[1]))
        elif raw in ("true", "false"):
            out[key] = raw == "true"
        else:
            out[key] = float(raw)
    return out


def js_num(x):
    """A float the way `${x}` writes it in a template literal."""
    x = float(x)
    return str(int(x)) if x.is_integer() else repr(x)


def expected_grid_css(name, paper):
    """The stylesheet `printGridCSS(name, paper)` MUST emit, composed here.

    Not a scan and not a parser: one string, built from `hifi.CW`/`hifi.CH`,
    the layout, and the paper keyword. A scan of the output cannot see
    provenance - `${g.CW}` and a typed `177.6` are byte-identical - so the
    check that means something is agreement with the spec, character for
    character, including the parts a regex was never looking at (the `margin:0`,
    the `.printscale` transform, the rotate line's presence or absence).
    """
    L = read_layout(name)
    cols, rows = int(L["cols"]), int(L["rows"])
    cw, ch, gx, gy = float(hifi.CW), float(hifi.CH), L["gx"], L["gy"]
    sw = cols * cw + (cols - 1) * gx
    sh = rows * ch + (rows - 1) * gy
    footprint = round((sw if L.get("rotate") else sh) * 100) / 100
    size = {"letter": "letter", "a4": "A4"}[paper]
    dw = float(re.search(r"=\s*([\d.]+);", read_js_const("PRINT_DESIGN_W")).group(1))
    return (
        "@page{size:%s; margin:0}\n" % size +
        "#printroot .printpage{min-height:%spt}\n" % js_num(footprint) +
        "#printroot .printsheet{grid-template-columns:repeat(%d, %spt);"
        % (cols, js_num(cw)) +
        "grid-template-rows:repeat(%d, %spt);" % (rows, js_num(ch)) +
        "column-gap:%spt; row-gap:%spt}\n" % (js_num(gx), js_num(gy)) +
        ("#printroot .printsheet{transform:rotate(-90deg)}\n"
         if L.get("rotate") else "") +
        "#printroot .printscale{width:%spx;" % js_num(dw) +
        "height:%spx;" % js_num(dw * ch / cw) +
        "transform:scale(%s)}" % js_num(cw / 72 * 96 / dw))


def css_slots(name):
    """Card origins the SHIPPED grid puts on the page, from the emitted CSS.

    Bottom-left corners in PDF space, row-major from the TOP row - the order
    and the axis `hifi.slots()` uses.

    Derivable only for an UNROTATED layout on the Letter page box, and the
    restriction is the whole point. `.printsheet`'s layout box is
    `cols*CW + (cols-1)*gx` by `rows*CH + (rows-1)*gy`; `display:flex;
    align-items:center; justify-content:center` on `.printpage` centres that
    box, so substituting the 612x792 page box gives absolute coordinates. A
    rotated layout is selected ONLY on a platform that ignores `@page`, where
    the page box is the one number `index.html` says we are never allowed to
    assume - so there is no page box to substitute and this raises rather than
    inventing one. See `test_narrow_grid_is_rotated_and_gutterless`.
    """
    css = grid_css(name)
    if "rotate(-90deg)" in css:
        raise AssertionError(
            "css_slots(%r) is not defined: the layout is rotated, which means "
            "it is only ever selected where the page box is unknown, so its "
            "absolute position on paper is not derivable from this CSS" % name)
    cols, cw = re.search(r"grid-template-columns:repeat\((\d+), ([\d.]+)pt\)", css).groups()
    rows, ch = re.search(r"grid-template-rows:repeat\((\d+), ([\d.]+)pt\)", css).groups()
    gx = float(re.search(r"column-gap:([\d.]+)pt", css).group(1))
    gy = float(re.search(r"row-gap:([\d.]+)pt", css).group(1))
    cols, rows, cw, ch = int(cols), int(rows), float(cw), float(ch)
    geom = dict(re.findall(r"(\w+):\s*([\d.]+)", read_print_geom_source()[0]))
    pw, ph = float(geom["PW"]), float(geom["PH"])
    tw = cols * cw + (cols - 1) * gx
    th = rows * ch + (rows - 1) * gy
    x0, y0 = (pw - tw) / 2, (ph - th) / 2
    return [(x0 + col * (cw + gx), y0 + th - (row + 1) * ch - row * gy)
            for row in range(rows) for col in range(cols)]


class PrintSlotGeometryTest(unittest.TestCase):
    """AC-B3: the browser print sheet lays cards out where hifi.py does."""

    TOL_PT = 0.1

    def test_constants_match_hifi(self):
        decl, _ = read_print_geom_source()
        vals = dict(re.findall(r"(\w+):\s*([\d.]+)", decl))
        self.assertEqual(float(vals["CW"]), hifi.CW)
        self.assertEqual(float(vals["CH"]), hifi.CH)
        self.assertEqual(float(vals["GX"]), hifi.GX)
        self.assertEqual(float(vals["GY"]), hifi.GY)
        self.assertEqual(float(vals["PW"]), hifi.PAGE[0])
        self.assertEqual(float(vals["PH"]), hifi.PAGE[1])

    def test_wide_layout_matches_hifi_slots(self):
        """All 9 slots, to within 0.1pt, against the generator that ships.

        Derived from the CSS the app emits, not from a helper only tests call:
        a slot emitter with no production caller can agree with `hifi` all day
        while the shipped grid disagrees.
        """
        want, got = hifi.slots(), css_slots("wide")
        self.assertEqual(len(got), 9)
        for i, ((wx, wy), (gx, gy)) in enumerate(zip(want, got)):
            self.assertAlmostEqual(gx, wx, delta=self.TOL_PT,
                                   msg="slot %d x: %.3f vs hifi %.3f" % (i, gx, wx))
            self.assertAlmostEqual(gy, wy, delta=self.TOL_PT,
                                   msg="slot %d y: %.3f vs hifi %.3f" % (i, gy, wy))

    def test_narrow_grid_is_rotated_and_gutterless(self):
        """D17's 3x2, asserted on the emitted text - and NOT on paper.

        There is deliberately no absolute-position assertion here. `narrow`
        exists for platforms that ignore `@page` and own the page box (a
        viewport under 640px picks it anywhere, but the page box is only out
        of our hands on iOS), so no derivation can say where these cards land.
        Nor is there a rendered oracle standing in for one: the printToPDF at
        `tests/e2e.test.js:1217` runs at the suite's ambient 900x900, so it
        measures the WIDE sheet, and no test renders a print sheet below the
        640px breakpoint at all. Chrome would not settle it even if one did -
        it honours `@page`, so it cannot reproduce the page box narrow exists
        for. That is queue row 148.

        What IS checkable from the declaration is the shape, and the shape is
        where the old `printSlots()` test was wrong: it computed a 557.2pt block, charging
        two gutters the narrow layout does not have, and pinned that number.
        """
        css = grid_css("narrow")
        self.assertIn("grid-template-columns:repeat(3, %gpt)" % hifi.CW, css)
        self.assertIn("grid-template-rows:repeat(2, %gpt)" % hifi.CH, css)
        self.assertIn("column-gap:0pt", css)
        self.assertIn("row-gap:0pt", css)
        self.assertIn("transform:rotate(-90deg)", css)
        # The floor reserves the ROTATED extent: the sheet's own width becomes
        # its height on the page, so 3*CW, not 2*CH.
        self.assertIn("min-height:%gpt" % (3 * hifi.CW), css)
        self.assertNotIn("min-height:%gpt" % (2 * hifi.CH), css)
        with self.assertRaises(AssertionError):
            css_slots("narrow")

    def test_emitted_grid_css_is_exactly_what_the_spec_implies(self):
        """Every byte of both layouts, on both papers, against the print spec.

        The literal scan in `PrintStylesheetTest` guards the STATIC print
        block; it cannot reach this stylesheet, which is built at runtime and
        injected into `#printgeom`. And no scan of emitted text could judge it
        anyway - provenance is invisible in the output. One `assertEqual`
        against a string composed from `hifi` covers the whole declaration.
        """
        for name in ("wide", "narrow"):
            for paper in ("letter", "a4"):
                with self.subTest(layout=name, paper=paper):
                    self.assertEqual(grid_css(name, paper).rstrip("\n"),
                                     expected_grid_css(name, paper))


    def test_grid_emitter_carries_no_geometry_literals_of_its_own(self):
        """Single definition site, now on the function that ships.

        `printGridCSS()` may reference PRINT_GEOM, the layout and the paper,
        and nothing else: any float literal in its body is a second copy of a
        constant PRINT_GEOM already owns.
        """
        fn = strip_js_comments(read_js_function("printGridCSS"))
        self.assertIn("PRINT_GEOM", fn)
        strays = re.findall(r"\d+\.\d+", fn)
        self.assertEqual(strays, [],
                         "printGridCSS() embeds its own numeric literals %s; it "
                         "must read every card and gutter constant from "
                         "PRINT_GEOM" % strays)


class PrintStylesheetTest(unittest.TestCase):
    """B4/AC-B3: the `@media print` block's placement and its literals."""

    def setUp(self):
        with open(os.path.join(paths.ROOT, "index.html"), encoding="utf-8") as fh:
            self.html = fh.read()
        self.style = self.html.split("<style>", 1)[1].split("</style>", 1)[0]
        i = self.style.index("@media print")
        self.print_css = self.style[i:]

    def test_print_block_is_last_in_the_style_element(self):
        """`tests/test_render_agreement.py:238` reads `.face::before` with a
        whole-file regex and takes the FIRST match. The print block redefines
        that rule for printed cards, so it has to sit BELOW the screen rule -
        and the cheapest way to guarantee that forever is to keep it last."""
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

    def test_print_block_re_expresses_the_frame_as_an_inset_ring(self):
        """B0 finding: the masked `.face::before` frame flattens to a SOLID
        block in Chrome's print export."""
        self.assertIn(".face::before", self.print_css)
        self.assertIn("box-shadow:inset", self.print_css)

    # --- the hide list ------------------------------------------------
    #
    # Reviewer finding B-1: `body.printing > .mid` named a class that is a
    # child of <footer>, not of <body>, so it matched NOTHING and <footer>
    # printed on top of the card sheet - shearing every page across the page
    # break and costing an extra sheet per run. A selector that matches
    # nothing is silent, so it is not enough to list what should be hidden:
    # both directions have to be asserted.

    HIDE_ALLOWED = ("script", "#printroot", "#printgeom")

    def body_children(self):
        """The direct element children of <body>, as selector candidates."""
        # The tag on its own line: `<body>` also appears inside the stylesheet
        # (a `content:` string), and splitting on the bare token lands there.
        body = self.html.split("\n<body>\n", 1)[1].split("\n</body>", 1)[0]
        # Comments carry markup-shaped prose ("+ ADD" notes, <script src>
        # warnings); parsing them corrupts the depth count.
        body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
        void = {"meta", "link", "br", "img", "input", "hr", "source"}
        out, depth, i = [], 0, 0
        tag = re.compile(r"<(/?)([a-zA-Z][\w-]*)([^>]*?)(/?)>", re.S)
        while True:
            m = tag.search(body, i)
            if not m:
                break
            close, name, attrs, selfclose = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
            i = m.end()
            if close:
                depth -= 1
                continue
            if name in ("script", "style"):
                # Skip the element's contents wholesale: `<` inside JS is not
                # markup, and walking it would corrupt the depth count.
                end = body.find("</%s>" % name, i)
                if depth == 0:
                    out.append(self.selectors(name, attrs))
                i = len(body) if end < 0 else end + len(name) + 3
                continue
            if depth == 0:
                out.append(self.selectors(name, attrs))
            if name not in void and not selfclose:
                depth += 1
        return out

    @staticmethod
    def selectors(name, attrs):
        sels = [name]
        mid = re.search(r'id="([^"]+)"', attrs)
        if mid:
            sels.append("#" + mid.group(1))
        mcl = re.search(r'class="([^"]+)"', attrs)
        if mcl:
            sels.extend("." + c for c in mcl.group(1).split())
        return sels

    def hide_list(self):
        """The selectors the print block hides, as written."""
        m = re.search(r"((?:body\.printing\s*>\s*[^,{]+,\s*)*"
                      r"body\.printing\s*>\s*[^,{]+)\{display:none",
                      self.print_css)
        self.assertIsNotNone(m, "the print block no longer hides the app chrome")
        return [s.strip().split(">", 1)[1].strip() for s in m.group(1).split(",")]

    def test_every_direct_child_of_body_is_hidden_or_belongs_to_the_sheet(self):
        """Anything left visible prints ON TOP of the card sheet."""
        hidden = set(self.hide_list())
        for sels in self.body_children():
            if any(s in self.HIDE_ALLOWED for s in sels):
                continue
            self.assertTrue(hidden.intersection(sels),
                            "<%s> is a direct child of <body> that the print "
                            "block never hides; it will print over the cards"
                            % sels[0])

    def test_no_selector_in_the_hide_list_matches_nothing(self):
        """A dead selector reads as coverage and provides none (B-1)."""
        children = self.body_children()
        for sel in self.hide_list():
            self.assertTrue(any(sel in sels for sels in children),
                            "`body.printing > %s` matches no direct child of "
                            "<body>; it hides nothing" % sel)

    def test_print_css_carries_no_card_geometry_literals(self):
        """Same single-definition-site rule as the slot emitter: the grid's
        card and gutter sizes are written by `printGridCSS()` from
        `PRINT_GEOM`, never typed into the stylesheet.

        This guards the STATIC block only. The runtime half - the declaration
        `printGridCSS()` injects into `#printgeom` - is covered by the source
        scan in `PrintSlotGeometryTest` (provenance) and by
        `test_emitted_grid_css_is_exactly_what_the_spec_implies` (value). A
        literal scan of that half would be undecidable in the direction it
        cares about: `${g.CW}` and a typed `177.6` emit the same bytes.
        """
        for lit in ("177.6", "247.2", "12.2", "9.4", "62.65", "87.21"):
            self.assertNotIn(lit, self.print_css,
                             "%s is a card-geometry literal; it belongs to "
                             "PRINT_GEOM alone" % lit)


if __name__ == "__main__":
    unittest.main()
