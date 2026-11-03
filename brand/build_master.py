#!/usr/bin/env python3
"""Local tool (not a CI dependency): trace the approved Two contours master into brand/*.svg.

Provenance: docs/plans/assets/2026-11-02-field-guide/approved-logo-master.png
(ivory #F6F4ED on transparent alpha, 1154 x 979, owner-approved 2026-11-02).
Method (plan amendment A15): the alpha channel is upsampled 4x, thresholded and
traced with potrace into ONE filled path; no shape is redrawn. The wordmark is
Nunito Sans Regular outlined with fontTools (no kerning table, no hinting).
Output is committed; tools/make_icons.py renders and checks everything else.

Requires: potrace, Pillow, fontTools. Run: python3 brand/build_master.py
"""
import os
import re
import subprocess
import tempfile

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MASTER = os.path.join(ROOT, "docs", "plans", "assets", "2026-11-02-field-guide", "approved-logo-master.png")
FONT = os.path.join(ROOT, "tools", "fonts", "NunitoSans-Regular.ttf")
IVORY, INK = "#F6F4ED", "#242424"
W, H = 1154, 979
UP = 4
BLUR = 12.0  # px at 4x: reconstructs the edge from the master's hard 1px stair-steps
OPT = "3.0"
NAME = "Handpan Theory"
LOCKUP_W, LOCKUP_H = 683.93, 196
LOCKUP_GAP = 48


def trace():
    alpha = Image.open(MASTER).convert("RGBA").getchannel("A")
    big = alpha.resize((W * UP, H * UP), Image.BILINEAR).filter(ImageFilter.GaussianBlur(BLUR)).point(lambda v: 255 if v >= 128 else 0)
    inv = big.point(lambda v: 0 if v else 255).convert("1")
    with tempfile.TemporaryDirectory() as d:
        pbm, out = os.path.join(d, "m.pbm"), os.path.join(d, "m.svg")
        inv.save(pbm)
        subprocess.run(["potrace", "-s", "-t", "4", "-a", "1.0", "-O", OPT, "-u", "10", "-o", out, pbm], check=True)
        svg = open(out, encoding="utf-8").read()
    ds = re.findall(r'<path d="([^"]+)"', svg)
    assert ds, "potrace returned no path"
    return " ".join(ds)


def bake(d):
    """potrace's translate(0,h) scale(.1,-.1) and the 1/UP downscale, baked into absolute 2-decimal coords."""
    h, k = H * UP * 10, 1 / (10 * UP)
    fmt = lambda v: ("%.2f" % v).rstrip("0").rstrip(".")
    pt = lambda x, y: fmt(x * k) + " " + fmt((h - y) * k)
    toks = re.findall(r"[MmCcLlZz]|-?\d+(?:\.\d+)?", d)
    out, i, cmd, cx, cy, sx, sy = [], 0, None, 0.0, 0.0, 0.0, 0.0
    while i < len(toks):
        if toks[i] in "MmCcLlZz":
            cmd = toks[i]
            i += 1
            if cmd in "Zz":
                out.append("Z")
                cx, cy = sx, sy
                continue
        n = {"M": 2, "m": 2, "c": 6, "l": 2}[cmd]
        v = [float(t) for t in toks[i:i + n]]
        i += n
        if cmd in "Mm":
            cx, cy = v if cmd == "M" else (cx + v[0], cy + v[1])
            sx, sy = cx, cy
            out.append("M" + pt(cx, cy))
            cmd = "l"
        elif cmd == "l":
            cx, cy = cx + v[0], cy + v[1]
            out.append("L" + pt(cx, cy))
        else:
            c1 = (cx + v[0], cy + v[1])
            c2 = (cx + v[2], cy + v[3])
            e = (cx + v[4], cy + v[5])
            out.append("C" + " ".join(pt(*q) for q in (c1, c2, e)))
            cx, cy = e
    return "".join(out)


def wordmark(size):
    font = TTFont(FONT)
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    upm = font["head"].unitsPerEm
    sc = size / upm
    x = 0.0
    parts = []
    for ch in NAME:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x, 0)))
        parts.append(pen.getCommands())
        x += hmtx[g][0] * sc
    cap = font["OS/2"].sCapHeight * sc
    return "".join(parts), x, cap


def svg(vb_w, vb_h, body, label=True):
    open_ = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" width="%d" height="%d"' % (
        ("%g" % vb_w), ("%g" % vb_h), round(vb_w), round(vb_h))
    if label:
        open_ += ' role="img" aria-label="Handpan Theory"><title>Handpan Theory</title>'
    else:
        open_ += ">"
    return open_ + body + "</svg>\n"


def main():
    mark = bake(trace())
    mark_g = lambda fill, extra="": '<path d="%s" fill="%s"%s/>' % (mark, fill, extra)
    # one em-size solves wordmark width to fill the lockup box
    _, adv, _ = wordmark(100)
    mark_h = LOCKUP_H
    mark_w = mark_h * W / H
    word_w = LOCKUP_W - mark_w - LOCKUP_GAP
    size = 100 * word_w / adv
    wd, adv, cap = wordmark(size)
    base = LOCKUP_H / 2 + cap / 2
    sk = mark_h / H

    def horizontal(fill):
        return svg(LOCKUP_W, LOCKUP_H,
                   '<g transform="scale(%.6f)">%s</g><g transform="translate(%.2f %.2f)"><path d="%s" fill="%s"/></g>'
                   % (sk, mark_g(fill), mark_w + LOCKUP_GAP, base, wd, fill))

    open(os.path.join(HERE, "mark.svg"), "w", encoding="utf-8").write(svg(W, H, mark_g(IVORY)))
    open(os.path.join(HERE, "horizontal-full.svg"), "w", encoding="utf-8").write(horizontal(IVORY))
    open(os.path.join(HERE, "horizontal-mono-light.svg"), "w", encoding="utf-8").write(horizontal(INK))
    # touch icon source: transparent 512 square, mark 68% wide (16% clear each side), centred
    s = 512 * 0.68 / W
    ty = (512 - H * s) / 2
    open(os.path.join(HERE, "app-icon-full.svg"), "w", encoding="utf-8").write(
        svg(512, 512, '<g transform="translate(%.2f %.2f) scale(%.6f)">%s</g>' % (512 * 0.16, ty, s, mark_g(IVORY))))
    # og source: stacked mark over wordmark, 626.19 x 557.31 as before
    SW, SH = 626.19, 557.31
    ms = 0.62 * SH / H
    mw = W * ms
    wd2, adv2, cap2 = wordmark(100)
    wsize = 100 * (SW * 0.92) / adv2
    wd2, adv2, cap2 = wordmark(wsize)
    mark_top = 0.02 * SH
    base2 = SH - 0.07 * SH
    open(os.path.join(HERE, "stacked-full.svg"), "w", encoding="utf-8").write(
        svg(SW, SH, '<g transform="translate(%.2f %.2f) scale(%.6f)">%s</g><g transform="translate(%.2f %.2f)"><path d="%s" fill="%s"/></g>'
            % ((SW - mw) / 2, mark_top, ms, mark_g(IVORY), (SW - adv2) / 2, base2, wd2, IVORY)))
    print("wrote brand/mark.svg horizontal-full.svg horizontal-mono-light.svg app-icon-full.svg stacked-full.svg;"
          " wordmark cap height %.1f of %g (%.0f%% of the mark)" % (cap, LOCKUP_H, 100 * cap / LOCKUP_H))


if __name__ == "__main__":
    main()
