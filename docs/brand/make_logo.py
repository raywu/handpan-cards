"""Generate the Handpan Theory logo set as SVG (traced from the owner's brand board).

Usage: python3 docs/brand/make_logo.py docs/brand/logo
Needs fonttools. One geometry for the mark; variants differ only in colour and effects.
Wordmark and tagline are outlined from tools/fonts (Marcellus, Nunito Sans SemiBold).
"""
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools", "fonts")
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TEAL, GOLD, WARM = "#44E0D8", "#F5C78E", "#F8EDD9"
BG, SURFACE, INK, PAPER = "#0F0E0B", "#1A1814", "#0F0E0B", "#F6F4ED"
SINGLE = "#E6C99B"
TAGLINE = "CHORDS & PROGRESSIONS"

# ---- mark geometry, in a 520 x 340 box ------------------------------------
CX, CY = 250, 178             # centre of the sound rings
ORB = dict(cx=252, cy=196, rx=232, ry=72, rot=-15)


def orbit_point(t):
    a = math.radians(ORB["rot"])
    x, y = ORB["rx"] * math.cos(t), ORB["ry"] * math.sin(t)
    return (ORB["cx"] + x * math.cos(a) - y * math.sin(a),
            ORB["cy"] + x * math.sin(a) + y * math.cos(a))

T_A = math.pi - 0.28
DOT_A = orbit_point(T_A)  # teal, lower left
DOT_B = orbit_point(-0.42)       # gold, upper right

DOME = "M62 208 C105 160 180 128 250 128 C320 128 395 160 438 210"
SILHOUETTE = (DOME + " A190 24 0 0 1 425 222 A175 24 0 0 1 75 222"
              " A190 24 0 0 1 62 208 Z")
FIELDS = [(142, 181, 10.5, 8, -24), (193, 191, 12, 9.5, -12), (250, 195, 13, 10, 0),
          (307, 191, 12, 9.5, 12), (358, 181, 10.5, 8, 24)]


def mark(v, uid, small=False):
    """v: 'full' | 'single' | 'mono-dark' | 'mono-light'. Returns inner SVG markup."""
    line = {"full": WARM, "single": SINGLE, "mono-dark": PAPER, "mono-light": INK}[v]
    sw = 5.5 if small else 3.8
    fw = 4.5 if small else 3.0
    o = ORB
    defs = [f'<mask id="m{uid}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="600" height="420">'
            f'<rect x="-40" y="-40" width="600" height="420" fill="#fff"/>'
            f'<path d="{SILHOUETTE}" fill="#000" stroke="#000" stroke-width="{sw + 8}"/></mask>']
    if v == "full":
        defs.append(f'<linearGradient id="o{uid}" gradientUnits="userSpaceOnUse" x1="{DOT_A[0]:.1f}" y1="{DOT_A[1]:.1f}" x2="{DOT_B[0]:.1f}" y2="{DOT_B[1]:.1f}">'
                    f'<stop offset="0" stop-color="{TEAL}"/><stop offset=".3" stop-color="{WARM}"/>'
                    f'<stop offset=".72" stop-color="{WARM}"/><stop offset="1" stop-color="{GOLD}"/></linearGradient>')
        defs.append(f'<linearGradient id="r{uid}" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="440" y2="380">'
                    f'<stop offset="0" stop-color="{TEAL}"/><stop offset=".55" stop-color="{TEAL}" stop-opacity=".35"/>'
                    f'<stop offset="1" stop-color="{GOLD}"/></linearGradient>')
        defs.append(f'<filter id="g{uid}" x="-20%" y="-30%" width="140%" height="160%">'
                    f'<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/>'
                    f'<feMergeNode in="SourceGraphic"/></feMerge></filter>')
        orbit_stroke, ring_stroke, dot_a, dot_b = f"url(#o{uid})", f"url(#r{uid})", TEAL, GOLD
    else:
        orbit_stroke = ring_stroke = dot_a = dot_b = line
    glow = f' filter="url(#g{uid})"' if v == "full" else ""
    tr = f'transform="translate({o["cx"]} {o["cy"]}) rotate({o["rot"]})"'
    def arc(t0, t1, n=90):
        pts = [orbit_point(t0 + (t1 - t0) * i / n) for i in range(n + 1)]
        return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    front = arc(T_A, 0)          # teal dot, under the pan, up the right side
    back = arc(0, -1.5)          # past the gold dot, behind the dome's right shoulder
    parts = ["<defs>" + "".join(defs) + "</defs>"]
    if not small:
        ring_op = [.85, .6, .38] if v == "full" else [.55, .38, .24]
        rings = "".join(f'<circle cx="{CX}" cy="{CY}" r="{r}" fill="none" stroke="{ring_stroke}" '
                        f'stroke-width="2.2" opacity="{op}"/>' for r, op in zip((146, 171, 196), ring_op))
        parts.append(f'<g mask="url(#m{uid})">{rings}</g>')
    parts.append(f'<g{glow}>')
    parts.append(f'<g mask="url(#m{uid}b)"><path d="{back}" fill="none" stroke="{orbit_stroke}" '
                 f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/></g>')
    pan = (f'<g fill="none" stroke="{line}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">'
           f'<path d="{DOME}"/>'
           f'<ellipse cx="250" cy="212" rx="190" ry="24"/>'
           f'<path d="M75 222 A175 24 0 0 0 425 222"/>'
           f'<ellipse cx="250" cy="136" rx="34" ry="8.5"/>')
    if not small:
        pan += "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" transform="rotate({r} {x} {y})" '
                       f'stroke-width="{fw}"/>' for x, y, rx, ry, r in FIELDS)
    else:
        pan += "".join(f'<circle cx="{x}" cy="{y}" r="7" fill="{line}" stroke="none"/>'
                       for x, y, *_ in FIELDS[1:4])
    pan += "</g>"
    parts.append(pan)
    parts.append(f'<path d="{front}" fill="none" stroke="{orbit_stroke}" stroke-width="{sw}" stroke-linecap="round"/>')
    dr = 17 if small else 14
    parts.append(f'<circle cx="{DOT_A[0]:.1f}" cy="{DOT_A[1]:.1f}" r="{dr + 2}" fill="{dot_a}"/>')
    parts.append(f'<circle cx="{DOT_B[0]:.1f}" cy="{DOT_B[1]:.1f}" r="{dr}" fill="{dot_b}"/>')
    parts.append("</g>")
    # the back half of the orbit hides behind the dome only (not behind the front rim)
    parts[0] = parts[0].replace("</defs>",
        f'<mask id="m{uid}b" maskUnits="userSpaceOnUse" x="-40" y="-40" width="600" height="420">'
        f'<rect x="-40" y="-40" width="600" height="420" fill="#fff"/>'
        f'<path d="{DOME} A190 24 0 0 1 62 208 Z" fill="#000" stroke="#000" stroke-width="{sw + 7}"/></mask></defs>')
    return "".join(parts)


# ---- outlined text ----------------------------------------------------------
class Face:
    def __init__(self, fn):
        self.f = TTFont(os.path.join(FONTS, fn))
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f["head"].unitsPerEm
        self.hmtx = self.f["hmtx"]
        kern = {}
        if "kern" in self.f:
            for t in self.f["kern"].kernTables:
                kern.update(t.kernTable)
        self.kern = kern

    def width(self, s, size, track=0):
        w, prev = 0, None
        for ch in s:
            g = self.cmap[ord(ch)]
            if prev:
                w += self.kern.get((prev, g), 0)
            w += self.hmtx[g][0]
            prev = g
        return w * size / self.upm + track * size * (len(s) - 1)

    def path(self, s, x, y, size, track=0):
        k = size / self.upm
        pen = SVGPathPen(self.gs)
        cx, prev = 0, None
        for ch in s:
            g = self.cmap[ord(ch)]
            if prev:
                cx += self.kern.get((prev, g), 0)
            tp = TransformPen(pen, (k, 0, 0, -k, x + cx * k, y))
            self.gs[g].draw(tp)
            cx += self.hmtx[g][0] + track * self.upm
            prev = g
        return pen.getCommands()

MARC = Face("Marcellus-Regular.ttf")
NUNI = Face("NunitoSans-SemiBold.ttf")


def words(x, y, size, color, tag_color, align="left"):
    """Wordmark at baseline y, tagline under it fitted to the wordmark's width."""
    wm = "Handpan Theory"
    w = MARC.width(wm, size)
    ts = size * 0.3
    raw = NUNI.width(TAGLINE, ts)
    track = (w - raw) / (ts * (len(TAGLINE) - 1))
    track = max(0.12, min(track, 0.42))
    tw = NUNI.width(TAGLINE, ts, track)
    x0 = x - w / 2 if align == "center" else x
    tx = x0 + (w - tw) / 2
    return (f'<path d="{MARC.path(wm, x0, y, size)}" fill="{color}"/>'
            f'<path d="{NUNI.path(TAGLINE, tx, y + size * 0.62, ts, track)}" fill="{tag_color}"/>'), w


def svg(w, h, body, title, bg=None, rx=0):
    b = f'<rect width="{w}" height="{h}" rx="{rx}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{b}{body}</svg>\n')


def write(name, s):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(s)

# marks (transparent)
for v in ("full", "single", "mono-dark", "mono-light"):
    write(f"mark-{v}.svg", svg(520, 340, mark(v, v), "Handpan Theory"))
write("mark-small.svg", svg(520, 340, mark("single", "s", small=True), "Handpan Theory"))

# lockups: the colour pair per variant (wordmark, tagline)
TXT = {"full": (PAPER, "#A9A39A"), "single": (SINGLE, "#A9A39A"),
       "mono-dark": (PAPER, PAPER), "mono-light": (INK, INK)}
for v, (c1, c2) in TXT.items():
    # horizontal: mark 230 wide at left
    k = 0.5
    body = f'<g transform="translate(14 0) scale({k})">{mark(v, "h" + v)}</g>'
    t, w = words(290, 92, 54, c1, c2)
    write(f"lockup-horizontal-{v}.svg", svg(int(290 + w + 24), 170, body + t, "Handpan Theory"))
    # stacked
    t, w = words(0, 0, 72, c1, c2, "center")
    W = int(max(w, 520) + 60)
    body = (f'<g transform="translate({(W - 520) / 2} 10)">{mark(v, "s" + v)}</g>'
            f'<g transform="translate({W / 2} 428)">{t}</g>')
    write(f"lockup-stacked-{v}.svg", svg(W, 490, body, "Handpan Theory"))

# app icons, 1024 square, iOS-like corner
for name, v, bg in (("full", "full", SURFACE), ("single", "single", SURFACE), ("mono", "mono-light", PAPER)):
    k = 1.55
    body = f'<g transform="translate({512 - 260 * k} {512 - 180 * k}) scale({k})">{mark(v, "i" + name)}</g>'
    write(f"app-icon-{name}.svg", svg(1024, 1024, body, "Handpan Theory", bg, 230))
print("ok", sorted(os.listdir(OUT)))
