#!/usr/bin/env python3
"""Sync the brand artwork into the app: favicon, header lockup, touch icon, og.png.

A SYNC step, not a build step, like inline_engine.py. `brand/*.svg` is the only
copy of the logo and three things come from it:

- the SVG favicon data URI in index.html, from brand/mark.svg (the Two contours
  master) fitted on a square #0F0E0B tile with 12% clear space (text, compared
  exactly);
- the `brand:lockup` region inside the app's h1, from brand/horizontal-full.svg
  with role, aria-label and <title> stripped, aria-hidden added and every id
  prefixed `hpt-` (text, compared exactly);
- the reading-header rasters brand/horizontal-{full,mono-light}@{2,3}x.png at
  223x64 times the scale, from the two horizontal SVGs;
- apple-touch-icon.png from brand/app-icon-full.svg and og.png from
  brand/stacked-full.svg, checked in as committed bytes. `--check` re-renders
  each in memory and compares it with the file under a pixel tolerance
  (PyMuPDF is unpinned in CI, so anti-aliasing may differ by a version); a
  changed colour or a moved shape alters whole regions and fails by an order
  of magnitude.

The brand SVGs are traced from the approved master by brand/build_master.py (a
local tool; potrace is not a CI dependency). `master_differing_fraction` is the
objective fidelity gate (plan A15/A24).

Plan: docs/plans/2026-10-31-logo-in-app.md (D3, D5, D7);
docs/plans/2026-11-02-field-guide-brand-implementation.md (Phase 1, A7, A12, A15, A24).
"""
import os
import re
import struct
import sys
import urllib.parse

import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_HTML = os.path.join(ROOT, "index.html")
BRAND = os.path.join(ROOT, "brand")
FONTS = os.path.join(ROOT, "tools", "fonts")
NUNITO = os.path.join(FONTS, "NunitoSans-Regular.ttf")

TOUCH_PNG = "apple-touch-icon.png"
OG_PNG = "og.png"
TOUCH_SIZE = 180
ICO_NAME = "favicon.ico"
ICO_SIZES = (16, 32, 48)
OG_SIZE = (1200, 630)

GROUND = (0x0F / 255, 0x0E / 255, 0x0B / 255)
PAPER = (0xF6 / 255, 0xF4 / 255, 0xED / 255)
MASTER_PNG = os.path.join(ROOT, "docs", "plans", "assets", "2026-11-02-field-guide", "approved-logo-master.png")
MASTER_SIZE = (1154, 979)
MAX_MASTER_DIFFERING_FRACTION = 0.02

# og.png layout: the stacked lockup (626.19 x 557.31) centred inside the
# square-crop safe zone x 285..915, two lines of copy under it.
OG_ICON_RECT = fitz.Rect(390, 36, 810, 36 + 420 * 557.31 / 626.19)
OG_LINES = (
    ("Learn chords. Play progressions.", NUNITO, 36, 500),
    ("For your handpan scale.", NUNITO, 36, 548),
)

SOURCES = {TOUCH_PNG: "app-icon-full.svg", OG_PNG: "stacked-full.svg"}
FAVICON_TILE = "#0F0E0B"
FAVICON_CLEAR = 0.12
READING_RASTERS = ("horizontal-full", "horizontal-mono-light")
READING_SLOT = (223, 64)
LOCKUP_BEGIN = "<!-- brand:lockup begin -->"
LOCKUP_END = "<!-- brand:lockup end -->"
LOCKUP_RE = re.compile(re.escape(LOCKUP_BEGIN) + r"\n(.*)\n" + re.escape(LOCKUP_END), re.S)

MAX_DIFFERING_FRACTION = 0.005
CHANNEL_TOLERANCE = 24

ICON_RE = re.compile(r'<link rel="icon" type="image/svg\+xml" href="(data:image/svg\+xml,[^"]*)">')


def brand_svg(name):
    with open(os.path.join(BRAND, name), encoding="utf-8") as f:
        return f.read().strip()


def _body(svg):
    inner = re.sub(r"^<svg\b[^>]*>", "", svg.strip())
    inner = re.sub(r"</svg>$", "", inner)
    return re.sub(r"<title>.*?</title>", "", inner)


def favicon_href(mark=None):
    mark = mark if mark is not None else brand_svg("mark.svg")
    w, h = (float(v) for v in re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', mark).groups())
    scale = 64 * (1 - 2 * FAVICON_CLEAR) / w
    body = _body(mark).replace('"', "'")
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
           "<rect width='64' height='64' fill='%s'/><g transform='translate(%s %s) scale(%s)'>%s</g></svg>"
           % (FAVICON_TILE, _num(64 * FAVICON_CLEAR), _num((64 - h * scale) / 2), _num(scale, 6), body))
    for ch, enc in (("%", "%25"), ("#", "%23"), ("<", "%3C"), (">", "%3E"), ('"', "%22")):
        svg = svg.replace(ch, enc)
    return "data:image/svg+xml," + svg


def favicon_svg(mark=None):
    return urllib.parse.unquote(favicon_href(mark)[len("data:image/svg+xml,"):])


def render_ico_frames(svg):
    return [raster(svg, px) for px in ICO_SIZES]


def encode_ico(frames):
    blobs = [f.tobytes("png") for f in frames]
    out = struct.pack("<HHH", 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    for f, blob in zip(frames, blobs):
        out += struct.pack("<BBBBHHII", f.width, f.height, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    return out + b"".join(blobs)


def decode_ico(data):
    count = struct.unpack_from("<H", data, 4)[0]
    frames = []
    for i in range(count):
        size, offset = struct.unpack_from("<II", data, 6 + 16 * i + 8)
        frames.append(fitz.Pixmap(data[offset:offset + size]))
    return frames


def _num(v, places=3):
    return ("%.*f" % (places, v)).rstrip("0").rstrip(".")


def lockup_svg(horizontal=None):
    svg = horizontal if horizontal is not None else brand_svg("horizontal-full.svg")
    svg = re.sub(r"<title>.*?</title>", "", svg.strip())
    svg = svg.replace(' role="img"', "").replace(' aria-label="Handpan Theory"', "")
    svg = svg.replace("<svg ", '<svg aria-hidden="true" focusable="false" ', 1)
    svg = re.sub(r'\bid="([^"]+)"', r'id="hpt-\1"', svg)
    svg = re.sub(r"url\(#([^)]+)\)", r"url(#hpt-\1)", svg)
    return re.sub(r'\bhref="#([^"]+)"', r'href="#hpt-\1"', svg)


def _index(root):
    with open(os.path.join(root, "index.html"), encoding="utf-8") as f:
        return f.read()


def favicon_drift(root=ROOT, mark=None):
    m = ICON_RE.search(_index(root))
    if not m:
        return "no SVG rel=icon data URI in index.html"
    if m.group(1) != favicon_href(mark):
        return "the favicon data URI is not the encoded brand/mark.svg tile"
    return None


def lockup_drift(root=ROOT, horizontal=None):
    m = LOCKUP_RE.search(_index(root))
    if not m:
        return "index.html has no brand:lockup region"
    if m.group(1) != lockup_svg(horizontal):
        return "the brand:lockup region is not brand/horizontal-full.svg, stripped and prefixed"
    return None


def extract_svg(path=INDEX_HTML):
    html = open(path, encoding="utf-8").read()
    m = ICON_RE.search(html)
    if not m:
        raise SystemExit("make_icons: no SVG rel=icon data URI in index.html")
    return urllib.parse.unquote(m.group(1)[len("data:image/svg+xml,"):])


def raster(svg, px):
    doc = fitz.open(stream=svg.encode("utf-8"), filetype="svg")
    page = doc[0]
    s = px / page.rect.width
    return page.get_pixmap(matrix=fitz.Matrix(s, s), alpha=True)


def render_touch(svg):
    doc = fitz.open()
    page = doc.new_page(width=TOUCH_SIZE, height=TOUCH_SIZE)
    page.draw_rect(page.rect, color=None, fill=GROUND)
    page.insert_image(page.rect, pixmap=raster(svg, TOUCH_SIZE * 2))
    return page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)


def render_og(svg):
    doc = fitz.open()
    page = doc.new_page(width=OG_SIZE[0], height=OG_SIZE[1])
    page.draw_rect(page.rect, color=None, fill=GROUND)
    page.insert_image(OG_ICON_RECT, pixmap=raster(svg, int(OG_ICON_RECT.width) * 2))
    for text, fontfile, size, baseline in OG_LINES:
        width = fitz.Font(fontfile=fontfile).text_length(text, fontsize=size)
        page.insert_text((OG_SIZE[0] / 2 - width / 2, baseline), text,
                         fontname=os.path.basename(fontfile), fontfile=fontfile,
                         fontsize=size, color=PAPER)
    return page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)


def reading_name(name, scale):
    return "brand/%s@%dx.png" % (name, scale)


def render_reading(svg, scale):
    doc = fitz.open(stream=svg.encode("utf-8"), filetype="svg")
    page = doc[0]
    w, h = READING_SLOT[0] * scale, READING_SLOT[1] * scale
    return page.get_pixmap(matrix=fitz.Matrix(w / page.rect.width, h / page.rect.height), alpha=True)


def render(sources=None):
    sources = sources or {}
    out = {TOUCH_PNG: render_touch(sources.get(TOUCH_PNG) or brand_svg(SOURCES[TOUCH_PNG])),
           OG_PNG: render_og(sources.get(OG_PNG) or brand_svg(SOURCES[OG_PNG]))}
    for name in READING_RASTERS:
        for scale in (2, 3):
            key = reading_name(name, scale)
            out[key] = render_reading(sources.get(key) or brand_svg(name + ".svg"), scale)
    return out


def master_differing_fraction(mark_svg=None):
    """A15/A24: the vector mark vs the approved master, both flattened onto the
    canvas ground at the master's own size."""
    ground = tuple(round(c * 255) for c in GROUND)

    def flat(pix):
        s, n, out = pix.samples, pix.n, bytearray()
        for i in range(0, len(s), n):
            a = s[i + 3] / 255 if n == 4 else 1
            out += bytes(round(s[i + c] * a + ground[c] * (1 - a)) for c in range(3))
        return fitz.Pixmap(fitz.csRGB, pix.width, pix.height, bytes(out), False)

    vec = raster(mark_svg if mark_svg is not None else brand_svg("mark.svg"), MASTER_SIZE[0])
    return differing_fraction(flat(fitz.Pixmap(MASTER_PNG)), flat(vec))


def differing_fraction(a, b, clip=None):
    """Fraction of pixels (inside `clip`, or everywhere) that differ by more
    than CHANNEL_TOLERANCE in any channel. Size mismatch is a full miss."""
    if (a.width, a.height) != (b.width, b.height) or a.n != b.n:
        return 1.0
    x0, y0, x1, y1 = (0, 0, a.width, a.height) if clip is None else clip
    sa, sb, n, stride = a.samples, b.samples, a.n, a.width * a.n
    bad = 0
    for y in range(y0, y1):
        row = y * stride
        for x in range(x0, x1):
            i = row + x * n
            for c in range(n):
                if abs(sa[i + c] - sb[i + c]) > CHANNEL_TOLERANCE:
                    bad += 1
                    break
    return bad / ((x1 - x0) * (y1 - y0))


# og.png is mostly empty ground, so a changed field on its 240 px icon is only
# ~0.2% of the canvas: the icon rect is measured on its own as well, so that a
# changed SVG fails there by the same order as it does on the touch icon.
REGIONS = {
    TOUCH_PNG: (None,),
    OG_PNG: (None, tuple(int(v) for v in OG_ICON_RECT)),
}
for _n in READING_RASTERS:
    for _s in (2, 3):
        REGIONS[reading_name(_n, _s)] = (None,)


def check(sources=None, root=ROOT):
    verdicts = {}
    for name, fresh in render(sources).items():
        path = os.path.join(root, name)
        if not os.path.exists(path):
            verdicts[name] = (False, 1.0)
            continue
        on_disk = fitz.Pixmap(path)
        if on_disk.alpha != fresh.alpha:
            on_disk = fitz.Pixmap(on_disk, 0)
        frac = max(differing_fraction(fresh, on_disk, clip) for clip in REGIONS[name])
        verdicts[name] = (frac <= MAX_DIFFERING_FRACTION, frac)
    verdicts[ICO_NAME] = check_ico(sources, root)
    return verdicts


def check_ico(sources=None, root=ROOT):
    path = os.path.join(root, ICO_NAME)
    if not os.path.exists(path):
        return (False, 1.0)
    fresh = render_ico_frames((sources or {}).get(ICO_NAME) or favicon_svg())
    with open(path, "rb") as f:
        on_disk = decode_ico(f.read())
    if len(on_disk) != len(fresh):
        return (False, 1.0)
    frac = 0.0
    for a, b in zip(fresh, on_disk):
        if b.alpha != a.alpha:
            b = fitz.Pixmap(b, a.alpha)
        frac = max(frac, differing_fraction(a, b))
    return (frac <= MAX_DIFFERING_FRACTION, frac)


def sync_index():
    path = INDEX_HTML
    html = _index(ROOT)
    html, n = ICON_RE.subn(lambda m: m.group(0).replace(m.group(1), favicon_href()), html)
    if n != 1:
        raise SystemExit("make_icons: no SVG rel=icon data URI in index.html")
    html, n = LOCKUP_RE.subn(lambda m: LOCKUP_BEGIN + "\n" + lockup_svg() + "\n" + LOCKUP_END, html)
    if n != 1:
        raise SystemExit("make_icons: no brand:lockup region in index.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print("make_icons: wrote the favicon URI and the brand:lockup region")


def main(argv):
    if "--check" in argv:
        stale = False
        for problem in (favicon_drift(), lockup_drift()):
            if problem:
                stale = True
                print(f"make_icons: {problem}; run python3 tools/make_icons.py")
        for name, (ok, frac) in check().items():
            if not ok:
                stale = True
                print(f"make_icons: {name} is stale ({frac:.2%} of pixels differ); "
                      f"run python3 tools/make_icons.py")
        frac = master_differing_fraction()
        if frac > MAX_MASTER_DIFFERING_FRACTION:
            stale = True
            print(f"make_icons: brand/mark.svg differs from the approved master in {frac:.2%} of pixels")
        if stale:
            return 1
        print("make_icons: favicon, lockup, reading rasters, apple-touch-icon.png, og.png and favicon.ico are current")
        return 0
    sync_index()
    for name, pix in render().items():
        pix.save(os.path.join(ROOT, name))
        print(f"make_icons: wrote {name} ({pix.width}x{pix.height})")
    with open(os.path.join(ROOT, ICO_NAME), "wb") as f:
        f.write(encode_ico(render_ico_frames(favicon_svg())))
    print(f"make_icons: wrote {ICO_NAME} ({', '.join(str(n) for n in ICO_SIZES)})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
