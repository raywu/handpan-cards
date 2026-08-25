#!/usr/bin/env python3
"""
Handpan Training Cards - high-fidelity build
  Page   : US Letter (612 x 792 pt), 3 x 3
  Card   : 177.6 x 247.2 pt  (62.7 x 87.2 mm - poker size, measured from the
           D-Amara reference set)
  Type   : Oranienbaum (chord names), BioRhyme Expanded (note/number lines),
           Montserrat (labels)  - all OFL
"""
import math, os
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
pdfmetrics.registerFont(TTFont("Oran", os.path.join(FONTS, "Oranienbaum-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Bio", os.path.join(FONTS, "BioRhymeExpanded-Regular.ttf")))
pdfmetrics.registerFont(TTFont("BioB", os.path.join(FONTS, "BioRhymeExpanded-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Mont", os.path.join(FONTS, "Montserrat-Regular.ttf")))
pdfmetrics.registerFont(TTFont("MontSB", os.path.join(FONTS, "Montserrat-SemiBold.ttf")))

# ---- palette sampled from the reference PDF -------------------------------
BLUE = Color(0.000, 0.592, 0.698)   # #0097B2  root / numbers (default)
GREEN = Color(0.000, 0.749, 0.388)  # #00BF63  chord notes (default)
_BLUE0, _GREEN0 = BLUE, GREEN
GRAD_A = Color(0.004, 0.596, 0.694)  # #0198B1  frame gradient, left
GRAD_B = Color(0.490, 0.851, 0.345)  # #7DD958  frame gradient, right
NAME = Color(0.329, 0.329, 0.329)   # #545454  chord name
INK = Color(0.141, 0.141, 0.141)    # #242424  small caps / labels
SEP = Color(0.451, 0.451, 0.451)    # #737373  separators
ORANGE = Color(0.850, 0.400, 0.020)
FAINT = Color(0.78, 0.78, 0.78)

PAGE = (612.0, 792.0)               # US Letter
CW, CH = 177.6, 247.2               # poker card
GX, GY = 12.2, 9.4                  # gutters (4.3 / 3.3 mm)


# ---- text helpers ---------------------------------------------------------
def tw(text, font, size, track=0.0):
    return pdfmetrics.stringWidth(text, font, size) + track * max(0, len(text) - 1)


def tracked(c, x, y, text, font, size, track=0.0, align="l", color=None):
    if color is not None:
        c.setFillColor(color)
    c.setFont(font, size)
    w = tw(text, font, size, track)
    if align == "c":
        x -= w / 2
    elif align == "r":
        x -= w
    for ch in text:
        c.drawString(x, y, ch)
        x += pdfmetrics.stringWidth(ch, font, size) + track
    return w


def fit(text, font, size, maxw, track=0.0, floor=3.6):
    while size > floor and tw(text, font, size, track * size / 10.0) > maxw:
        size -= 0.25
    return size


def note_w(name, octv, font, size):
    return (pdfmetrics.stringWidth(name, font, size)
            + pdfmetrics.stringWidth(str(octv), font, size * 0.66))


def fit_note(name, octv, font, size, maxw):
    while size > 2.5 and note_w(name, octv, font, size) > maxw:
        size -= 0.1
    return size


def note_text(c, x, y, name, octv, font, size, color=black, centre=True):
    """Note name with a subscript octave."""
    w = note_w(name, octv, font, size)
    if centre:
        x -= w / 2
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, name)
    c.setFont(font, size * 0.66)
    c.drawString(x + pdfmetrics.stringWidth(name, font, size), y - size * 0.20, str(octv))
    return w


# ---- card chrome ----------------------------------------------------------
def gradient_frame(c, x, y, w, h, bw=2.2, rad=7.0, ga=None, gb=None):
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, w, h, rad)
    c.clipPath(p, stroke=0, fill=0)
    c.linearGradient(x, y, x + w, y, [ga or GRAD_A, gb or GRAD_B])
    c.restoreState()
    c.setFillColor(white)
    c.roundRect(x + bw, y + bw, w - 2 * bw, h - 2 * bw, max(1.0, rad - bw),
                stroke=0, fill=1)


def plain_frame(c, x, y, w, h, col=NAME, bw=1.0, rad=7.0):
    c.setStrokeColor(col)
    c.setLineWidth(bw)
    c.setFillColor(white)
    c.roundRect(x, y, w, h, rad, stroke=1, fill=1)


def side_credit(c, x, y, w, h, text):
    c.saveState()
    c.translate(x + w - 6.0, y + 12)
    c.rotate(90)
    tracked(c, 0, 0, text, "Mont", 3.5, 0.55, "l", FAINT)
    c.restoreState()


def card_header(c, x, y, w, h, deck, num, subtitle, main, sup):
    tracked(c, x + 9, y + h - 13.5, deck, "Mont", 4.6, 0.5, "l", INK)
    if num:
        tracked(c, x + 9, y + h - 21.5, num, "Mont", 4.6, 0.4, "l", SEP)
    if subtitle:
        s = fit(subtitle, "MontSB", 4.2, w * 0.60, track=0.55)
        tracked(c, x + w - 9, y + h - 12.5, subtitle, "MontSB", s, s * 0.055 * 2.4,
                "r", INK)
    size = 27.0
    while size > 8 and (tw(main, "Oran", size, size * 0.02)
                        + tw(sup, "Oran", size * 0.52, 0)) > w * 0.62:
        size -= 0.5
    supw = tw(sup, "Oran", size * 0.52, 0) if sup else 0.0
    base = y + h - 24 - size * 0.70
    tracked(c, x + w - 9 - supw, base, main, "Oran", size, size * 0.02, "r", NAME)
    if sup:
        c.setFillColor(NAME)
        c.setFont("Oran", size * 0.52)
        c.drawString(x + w - 9 - supw, base + size * 0.46, sup)


def bottom_lines(c, x, y, w, fields, roots, meta, y_names, y_nums):
    """Note-name line (BioRhyme, green with blue roots) + tonefield line."""
    size = 11.0
    while size > 4.4:
        total = 0.0
        for f in fields:
            nm, ov = meta[f][0], meta[f][1]
            total += note_w(nm, ov, "Bio", size)
        total += (len(fields) - 1) * tw(" - ", "Bio", size)
        if total <= w - 16:
            break
        size -= 0.25
    px = x + (w - total) / 2
    for i, f in enumerate(fields):
        nm, ov = meta[f][0], meta[f][1]
        col = BLUE if f in roots else GREEN
        px += note_text(c, px, y_names, nm, ov, "Bio", size, col, centre=False)
        if i < len(fields) - 1:
            c.setFillColor(SEP)
            c.setFont("Bio", size)
            c.drawString(px, y_names, " - ")
            px += tw(" - ", "Bio", size)

    s2 = 11.0
    while s2 > 4.2:
        total2 = sum(tw(meta[f][5], "Bio", s2) for f in fields)
        total2 += (len(fields) - 1) * tw(" - ", "Bio", s2)
        if total2 <= w - 16:
            break
        s2 -= 0.25
    px = x + (w - total2) / 2
    for i, f in enumerate(fields):
        lab = meta[f][5]
        c.setFillColor(BLUE if f in roots else GREEN)
        c.setFont("Bio", s2)
        c.drawString(px, y_nums, lab)
        px += tw(lab, "Bio", s2)
        if i < len(fields) - 1:
            c.setFillColor(SEP)
            c.drawString(px, y_nums, " - ")
            px += tw(" - ", "Bio", s2)


# ---- diagram --------------------------------------------------------------
def draw_ring(c, x, y, r, state):
    """Sven's tonefield: always a thin black circle; a highlight is a thick
    coloured band inside it, bounded by a second hairline. Root = blue,
    chord note = green. Never both."""
    c.setDash()
    c.setFillColor(white)
    c.setStrokeColor(black)
    c.setLineWidth(0.65)
    if state == "off-bottom":
        c.setStrokeColor(Color(0.62, 0.62, 0.62))
        c.setDash(1.6, 1.6)
        c.circle(x, y, r, stroke=1, fill=1)
        c.setDash()
        return
    c.circle(x, y, r, stroke=1, fill=1)
    if state in ("off",):
        return
    col = BLUE if state in ("root", "ding-root") else GREEN
    c.setStrokeColor(col)
    c.setLineWidth(r * 0.24)
    c.circle(x, y, r * 0.87, stroke=1, fill=0)
    c.setStrokeColor(black)
    c.setLineWidth(0.55)
    c.circle(x, y, r * 0.74, stroke=1, fill=0)


def draw_pan(c, cx, cy, R, spec, active=frozenset(), roots=frozenset(),
             numbers=True):
    """spec: dict field -> (name, octave, midi, zone, angle, label)"""
    g = spec["_geom"]
    c.setStrokeColor(black); c.setLineWidth(1.15); c.setDash()
    c.circle(cx, cy, R, stroke=1, fill=0)
    if g.get("inner_ring"):
        c.setLineWidth(0.6)
        c.circle(cx, cy, R * g["inner_ring"], stroke=1, fill=0)
    if g.get("bottom"):
        c.setStrokeColor(Color(0.90, 0.90, 0.90)); c.setLineWidth(0.7)
        c.setDash(2.2, 2.2)
        c.circle(cx, cy, R * g["bottom"], stroke=1, fill=0)
        c.setDash()

    def state(i, bottom=False):
        if i in roots:
            return "ding-root" if spec[i][3] == "ding" else "root"
        if i in active:
            return "on"
        return "off-bottom" if bottom else "off"

    for i, val in spec.items():
        if i == "_geom":
            continue
        nm, ov, _mid, zone, ang, lab = val
        if zone == "ding":
            rr = R * g["r_ding"]
            dy = R * g.get("ding_dy", 0.0)
            draw_ring(c, cx, cy - dy, rr, state(i))
            fs0 = fit_note(nm, ov, "Mont", R * g["f_ding"], rr * 1.40)
            note_text(c, cx, cy - dy - rr * 0.30, nm, ov, "Mont", fs0, INK)
            continue
        orb = R * g[zone]
        rr = R * (g["r_bnote"] if zone == "bottom" else g["r_note"])
        a = math.radians(ang)
        px, py = cx + orb * math.cos(a), cy + orb * math.sin(a)
        draw_ring(c, px, py, rr, state(i, zone == "bottom"))
        fs = R * (g["f_bnote"] if zone == "bottom" else g["f_note"])
        fs = fit_note(nm, ov, "Mont", fs, rr * 1.40)
        note_text(c, px, py - rr * 0.30, nm, ov, "Mont", fs, INK)
        if numbers:
            if zone == "bottom":
                nr = orb + rr + R * g["n_out"]
                col, nfs, fnt = ORANGE, R * g["f_num"], "MontSB"
            elif zone == "rim" and g.get("rim_num_out"):
                nr = orb + rr + R * g["n_in"]
                col, nfs, fnt = INK, R * g["f_num"], "Mont"
            else:
                nr = orb - rr - R * g["n_in"]
                col, nfs, fnt = INK, R * g["f_num"], "Mont"
            c.setFillColor(col); c.setFont(fnt, nfs)
            c.drawCentredString(cx + nr * math.cos(a),
                                cy + nr * math.sin(a) - nfs * 0.36, lab)


# ---- page assembly --------------------------------------------------------
def slots():
    tw_ = 3 * CW + 2 * GX
    th_ = 3 * CH + 2 * GY
    x0 = (PAGE[0] - tw_) / 2
    y0 = (PAGE[1] - th_) / 2
    return [(x0 + col * (CW + GX), y0 + th_ - (row + 1) * CH - row * GY)
            for row in range(3) for col in range(3)]


def crop_marks(c):
    xs, ys = set(), set()
    for (x, y) in slots():
        xs.update([x, x + CW]); ys.update([y, y + CH])
    c.setStrokeColor(Color(0.6, 0.6, 0.6)); c.setLineWidth(0.3)
    m = 8.0
    for x in xs:
        c.line(x, 6, x, 6 + m)
        c.line(x, PAGE[1] - 6, x, PAGE[1] - 6 - m)
    for y in ys:
        c.line(6, y, 6 + m, y)
        c.line(PAGE[0] - 6, y, PAGE[0] - 6 - m, y)


def build(path, deck, chords_only=False):
    global BLUE, GREEN
    BLUE = deck.get("col_root", _BLUE0)
    GREEN = deck.get("col_tone", _GREEN0)
    c = canvas.Canvas(path, pagesize=PAGE)
    c.setTitle(deck["title"] + (" (print sheet)" if chords_only else ""))
    S = slots()
    if chords_only:
        cards = [("chord", (i + 1, ch)) for i, ch in enumerate(deck["chords"])]
        while len(cards) % 9 != 0:
            cards.append(("skip", None))
    else:
        cards = ([("title", None), ("legend", None)]
                 + [("chord", (i + 1, ch)) for i, ch in enumerate(deck["chords"])])
        cards += [("blank", None)] * deck.get("blank_cards", 0)
        while len(cards) % 9 != 0:
            cards.append(("blank", None))

    def calibration(c):
        x0, y0, ln = 12.0, 220.0, 144.0
        c.setStrokeColor(Color(0.45, 0.45, 0.45)); c.setLineWidth(0.5)
        c.line(x0, y0, x0, y0 + ln)
        for t in (0, ln):
            c.line(x0 - 3, y0 + t, x0 + 3, y0 + t)
        c.saveState(); c.translate(x0 + 6, y0 + 8); c.rotate(90)
        c.setFillColor(Color(0.45, 0.45, 0.45)); c.setFont("Mont", 4.2)
        c.drawString(0, 0, "2.00 IN / 50.8 MM  -  VERIFY AT 100% SCALE")
        c.restoreState()

    for i, (kind, data) in enumerate(cards):
        if i % 9 == 0:
            if i:
                c.showPage()
            crop_marks(c)
            if i == 0:
                calibration(c)
        x, y = S[i % 9]
        if kind == "chord":
            chord_card(c, x, y, deck, data[0], data[1])
        elif kind == "title":
            title_card(c, x, y, deck)
        elif kind == "legend":
            legend_card(c, x, y, deck)
        elif kind == "blank":
            blank_card(c, x, y, deck)

    c.save()
    return len(cards) // 9


# ---- card types -----------------------------------------------------------
def chord_card(c, x, y, deck, num, chord):
    main, sup, subtitle, fields, roots = chord
    spec = deck["spec"]
    root_pc = spec[next(iter(roots))][2] % 12
    pcs = {spec[f][2] % 12 for f in fields}
    every = [k for k in spec if k != "_geom"]
    active_all = {k for k in every if spec[k][2] % 12 in pcs}
    roots_all = {k for k in every if spec[k][2] % 12 == root_pc}
    ga, gb = deck.get("grad", (None, None))
    gradient_frame(c, x, y, CW, CH, ga=ga, gb=gb)
    card_header(c, x, y, CW, CH, deck["name"], "#%d" % num, subtitle, main, sup)
    deg = deck.get("degrees", {}).get(root_pc)
    if deg:
        tracked(c, x + 9, y + CH - 31.5, deg, "MontSB", 6.0, 0.4, "l", BLUE)
    side_credit(c, x, y, CW, CH, deck["credit"])
    draw_pan(c, x + CW / 2, y + deck["cy"], deck["R"], spec, active_all, roots_all)

    nb = len([f for f in fields if spec[f][3] == "bottom"])
    if nb:
        tracked(c, x + CW / 2, y + deck["y_note"] + 13, 
                "%d BOTTOM NOTE%s" % (nb, "S" if nb > 1 else ""),
                "MontSB", 4.6, 0.7, "c", ORANGE)
    bottom_lines(c, x, y, CW, fields, roots, spec,
                 y + deck["y_note"], y + deck["y_num"])


def title_card(c, x, y, deck):
    plain_frame(c, x, y, CW, CH)
    s = fit(deck["name"], "Oran", 16, CW - 24, track=0.4)
    tracked(c, x + 12, y + CH - 24, deck["name"], "Oran", s, s * 0.03, "l", INK)
    tracked(c, x + 12, y + CH - 34, deck["sub"], "Mont", 4.6, 0.5, "l", SEP)
    tracked(c, x + CW - 12, y + CH - 34, "CHORD CARDS", "MontSB", 4.6, 0.9, "r", SEP)
    side_credit(c, x, y, CW, CH, deck["credit"])
    tops = set(k for k, v in deck["spec"].items()
               if k != "_geom" and v[3] != "bottom")
    draw_pan(c, x + CW / 2, y + deck["cy"], deck["R"], deck["spec"],
             tops, {0})
    for i, ln in enumerate(deck["blurb"]):
        tracked(c, x + CW / 2, y + 26 - i * 8, ln, "Mont", 4.2, 0.35, "c",
                ORANGE if ln.startswith("BOTTOM") else SEP)


def legend_card(c, x, y, deck):
    plain_frame(c, x, y, CW, CH)
    tracked(c, x + 9, y + CH - 13.5, deck["name"], "Mont", 4.6, 0.5, "l", INK)
    tracked(c, x + CW - 9, y + CH - 12.5, "LEGENDE / LEGEND", "MontSB", 4.2,
            0.9, "r", INK)
    s = fit("How to read", "Oran", 20, CW * 0.62)
    tracked(c, x + CW - 9, y + CH - 34, "How to read", "Oran", s, s * 0.02, "r", NAME)
    side_credit(c, x, y, CW, CH, deck["credit"])

    demo, demo_root = deck["legend_demo"]
    draw_pan(c, x + CW / 2, y + deck["cy"], deck["R"], deck["spec"],
             {demo}, {demo_root})

    sy = y + deck["y_note"] + 12
    r = 4.6
    draw_ring(c, x + 16, sy, r, "ding-root")
    tracked(c, x + 24, sy - 1.8, "ROOT NOTE", "Mont", 4.2, 0.4, "l", INK)
    draw_ring(c, x + 82, sy, r, "on")
    tracked(c, x + 90, sy - 1.8, "CHORD NOTE", "Mont", 4.2, 0.4, "l", INK)
    for i, ln in enumerate(deck["legend_lines"]):
        tracked(c, x + CW / 2, y + deck["y_num"] + 2 - i * 7, ln, "Mont", 4.0,
                0.3, "c", ORANGE if i == 0 and deck["has_bottom"] else SEP)


def blank_card(c, x, y, deck):
    plain_frame(c, x, y, CW, CH, col=FAINT)
    tracked(c, x + 9, y + CH - 13.5, deck["name"], "Mont", 4.6, 0.5, "l", FAINT)
    side_credit(c, x, y, CW, CH, deck["credit"])
    draw_pan(c, x + CW / 2, y + deck["cy"], deck["R"], deck["spec"])
    c.setStrokeColor(Color(0.88, 0.88, 0.88)); c.setLineWidth(0.5)
    c.line(x + 18, y + deck["y_note"] - 3, x + CW - 18, y + deck["y_note"] - 3)
    c.line(x + 18, y + deck["y_num"] - 3, x + CW - 18, y + deck["y_num"] - 3)


def back_card(c, x, y, deck):
    gradient_frame(c, x, y, CW, CH)
    cx, cy = x + CW / 2, y + CH * 0.52
    c.setStrokeColor(Color(0.86, 0.90, 0.88))
    for k in range(9):
        c.setLineWidth(0.5)
        c.circle(cx, cy, 12 + k * 6.4, stroke=1, fill=0)
    n = len([k for k in deck["spec"] if k != "_geom"])
    c.setStrokeColor(GRAD_A); c.setLineWidth(0.9)
    for k in range(n):
        a = math.radians(90 - k * 360.0 / n)
        c.circle(cx + 62 * math.cos(a), cy + 62 * math.sin(a), 3.4, stroke=1, fill=0)
    tracked(c, cx, y + CH - 34, "CHORD", "Oran", 12, 0.8, "c", INK)
    tracked(c, cx, y + CH - 45, "CARDS", "Oran", 12, 0.8, "c", INK)
    s = fit(deck["name"], "Oran", 12, CW * 0.8, track=0.5)
    tracked(c, cx, y + 30, deck["name"], "Oran", s, s * 0.04, "c", NAME)
    tracked(c, cx, y + 20, deck["sub"], "Mont", 4.2, 0.6, "c", SEP)
