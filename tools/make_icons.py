#!/usr/bin/env python3
"""Render apple-touch-icon.png and og.png from the favicon SVG in index.html.

A SYNC step, not a build step, like inline_engine.py: the SVG data URI in
index.html is the only copy of the icon, and the two PNGs are checked in so
GitHub Pages serves them as committed. `--check` re-renders both in memory and
compares them with the files on disk under a pixel tolerance (PyMuPDF is
unpinned in CI, so anti-aliasing may differ by a version); a changed colour or
a moved field alters whole discs and fails by an order of magnitude.

Plan: docs/plans/2026-10-04-name-and-favicon.md sections 3.3, 3.4.
"""
import os
import re
import sys
import urllib.parse

import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_HTML = os.path.join(ROOT, "index.html")
FONTS = os.path.join(ROOT, "tools", "fonts")
MARCELLUS = os.path.join(FONTS, "Marcellus-Regular.ttf")
NUNITO = os.path.join(FONTS, "NunitoSans-Regular.ttf")

TOUCH_PNG = "apple-touch-icon.png"
OG_PNG = "og.png"
TOUCH_SIZE = 180
OG_SIZE = (1200, 630)

GROUND = (0x1A / 255, 0x18 / 255, 0x15 / 255)
PAPER = (0xF4 / 255, 0xF0 / 255, 0xE8 / 255)

# og.png layout: one centred stack inside the square-crop safe zone x 285..915.
OG_ICON_RECT = fitz.Rect(480, 84, 720, 324)
OG_LINES = (
    ("Handpan Chords", MARCELLUS, 72, 432),
    ("Learn chords. Play progressions.", NUNITO, 36, 490),
    ("For your handpan scale.", NUNITO, 36, 538),
)

MAX_DIFFERING_FRACTION = 0.005
CHANNEL_TOLERANCE = 24

ICON_RE = re.compile(r'<link rel="icon" type="image/svg\+xml" href="(data:image/svg\+xml,[^"]*)">')


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


def render(svg=None):
    svg = svg if svg is not None else extract_svg()
    return {TOUCH_PNG: render_touch(svg), OG_PNG: render_og(svg)}


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


def check(svg=None, root=ROOT):
    verdicts = {}
    for name, fresh in render(svg).items():
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


def main(argv):
    if "--check" in argv:
        verdicts = check()
        stale = False
        for name, (ok, frac) in verdicts.items():
            if not ok:
                stale = True
                print(f"make_icons: {name} is stale ({frac:.2%} of pixels differ); "
                      f"run python3 tools/make_icons.py")
        if stale:
            return 1
        print("make_icons: apple-touch-icon.png and og.png are current")
        return 0
    for name, pix in render().items():
        pix.save(os.path.join(ROOT, name))
        print(f"make_icons: wrote {name} ({pix.width}x{pix.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
