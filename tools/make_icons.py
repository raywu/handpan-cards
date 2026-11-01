#!/usr/bin/env python3
"""Sync the brand artwork into the app: favicon, header lockup, touch icon, og.png.

A SYNC step, not a build step, like inline_engine.py. `brand/*.svg` is the only
copy of the logo and three things come from it:

- the SVG favicon data URI in index.html, from brand/mark-small.svg on a round
  tile (text, compared exactly);
- the `brand:lockup` region inside the app's h1, from brand/horizontal-full.svg
  with role, aria-label and <title> stripped, aria-hidden added and every id
  prefixed `hpt-` (text, compared exactly);
- apple-touch-icon.png from brand/app-icon-full.svg and og.png from
  brand/stacked-full.svg, checked in as committed bytes. `--check` re-renders
  each in memory and compares it with the file under a pixel tolerance
  (PyMuPDF is unpinned in CI, so anti-aliasing may differ by a version); a
  changed colour or a moved shape alters whole regions and fails by an order
  of magnitude.

Plan: docs/plans/2026-10-31-logo-in-app.md (D3, D5, D7).
"""
import os
import re
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
OG_SIZE = (1200, 630)

GROUND = (0x1A / 255, 0x18 / 255, 0x14 / 255)
PAPER = (0xF4 / 255, 0xF0 / 255, 0xE8 / 255)

# og.png layout: the stacked lockup (626.19 x 557.31) centred inside the
# square-crop safe zone x 285..915, two lines of copy under it.
OG_ICON_RECT = fitz.Rect(390, 36, 810, 36 + 420 * 557.31 / 626.19)
OG_LINES = (
    ("Learn chords. Play progressions.", NUNITO, 36, 500),
    ("For your handpan scale.", NUNITO, 36, 548),
)

SOURCES = {TOUCH_PNG: "app-icon-full.svg", OG_PNG: "stacked-full.svg"}
FAVICON_TILE = "#0f0e0b"
FAVICON_TRANSFORM = "translate(6 19.35) scale(0.09391)"
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
    body = _body(mark if mark is not None else brand_svg("mark-small.svg"))
    body = body.replace('id="smm"', 'id="fav-smm"').replace("url(#smm)", "url(#fav-smm)")
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
           "<circle cx='32' cy='32' r='32' fill='%s'/><g transform='%s'>%s</g></svg>"
           % (FAVICON_TILE, FAVICON_TRANSFORM, body.replace('"', "'")))
    for ch, enc in (("%", "%25"), ("#", "%23"), ("<", "%3C"), (">", "%3E"), ('"', "%22")):
        svg = svg.replace(ch, enc)
    return "data:image/svg+xml," + svg


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
        return "the favicon data URI is not the encoded brand/mark-small.svg tile"
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


def render(sources=None):
    sources = sources or {}
    return {TOUCH_PNG: render_touch(sources.get(TOUCH_PNG) or brand_svg(SOURCES[TOUCH_PNG])),
            OG_PNG: render_og(sources.get(OG_PNG) or brand_svg(SOURCES[OG_PNG]))}


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


def check(sources=None, root=ROOT):
    verdicts = {}
    for name, fresh in render(sources).items():
        path = os.path.join(root, name)
        if not os.path.exists(path):
            verdicts[name] = (False, 1.0)
            continue
        on_disk = fitz.Pixmap(path)
        if on_disk.alpha:
            on_disk = fitz.Pixmap(on_disk, 0)
        frac = max(differing_fraction(fresh, on_disk, clip) for clip in REGIONS[name])
        verdicts[name] = (frac <= MAX_DIFFERING_FRACTION, frac)
    return verdicts


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
        if stale:
            return 1
        print("make_icons: favicon, lockup, apple-touch-icon.png and og.png are current")
        return 0
    sync_index()
    for name, pix in render().items():
        pix.save(os.path.join(ROOT, name))
        print(f"make_icons: wrote {name} ({pix.width}x{pix.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
