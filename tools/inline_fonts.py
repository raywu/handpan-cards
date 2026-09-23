#!/usr/bin/env python3
"""Subset the five print TTFs into src/engine/fontdata.js.

THIS IS A SYNC STEP, NOT A BUILD STEP, the same as inline_engine.py and
sync_decks.py: the generated module is committed, index.html carries an inlined
copy of it, and tools/validate.py fails when either side drifts.

    python3 tools/inline_fonts.py            # regenerate the module
    python3 tools/inline_fonts.py --check    # write nothing; exit 1 on drift

Why this exists.  The browser PDF emitter has to embed the same faces
tools/hifi.py prints with, and lay text out on the same advances reportlab uses.
Shipping the full TTFs would add ~400 KB of base64 to a single-file app, so each
face is subset to CHARSET below and its advances are normalised to 1000 units
per em - the unit pdfmetrics.stringWidth(ch, name, 1000.0) already speaks, so
tests/test_font_subset.py can pin every number against reportlab directly.

CHARSET is FROZEN.  It is printable ASCII plus the degree sign, which is the
exact union of every character the three seed decks and hifi's own literals can
draw (card copy is English-only by CLAUDE.md, and `deg` reaches the cards
through the diminished-chord suffix at src/engine/naming.js:22).  None of the
five faces has a cmap entry for U+266F / U+266D, so sharps and flats are the
ASCII `#` and `b` there as they are everywhere else in this repo.  The tool
FAILS rather than silently dropping a glyph if a face cannot cover the set.
"""
import base64
import io
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "tools", "fonts")
OUT = os.path.join(ROOT, "src", "engine", "fontdata.js")

# hifi's own registration names (tools/hifi.py:16-20), so a port of a hifi call
# site reads the same identifier on both sides.
FACES = [
    ("Display", "Marcellus-Regular.ttf"),
    ("Notes", "Bitter-Regular.ttf"),
    ("NotesB", "Bitter-Bold.ttf"),
    ("Label", "NunitoSans-Regular.ttf"),
    ("LabelSB", "NunitoSans-SemiBold.ttf"),
]

CHARSET = "".join(chr(c) for c in range(0x20, 0x7F)) + "°"

# A charset creep that doubled index.html would otherwise land as a surprise in
# a mobile page load, so it is a build error instead.
MAX_BASE64_BYTES = 200 * 1024

UPEM = 1000.0


def subset_face(path):
    """(subset TTF bytes, {char: advance at 1000 upem}) for one face."""
    font = TTFont(path, recalcTimestamp=False)
    cmap = {}
    for table in font["cmap"].tables:
        cmap.update(table.cmap)
    missing = [ch for ch in CHARSET if ord(ch) not in cmap]
    if missing:
        raise SystemExit("%s has no glyph for %r - CHARSET and the fonts "
                         "disagree" % (os.path.basename(path), missing))

    opts = subset.Options()
    opts.recalc_timestamp = False
    opts.layout_features = []
    opts.hinting = False
    opts.desubroutinize = True
    opts.notdef_outline = True
    opts.recalc_bounds = True
    sub = subset.Subsetter(options=opts)
    sub.populate(text=CHARSET)
    sub.subset(font)

    # head.modified is a wall-clock stamp, so without pinning it the tool emits
    # different bytes on every run and --check can never pass.
    font["head"].modified = font["head"].created
    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()

    out = TTFont(io.BytesIO(data))
    scale = UPEM / out["head"].unitsPerEm
    out_cmap = {}
    for table in out["cmap"].tables:
        out_cmap.update(table.cmap)
    hmtx = out["hmtx"]
    widths = {ch: round(hmtx[out_cmap[ord(ch)]][0] * scale, 3) for ch in CHARSET}
    return data, widths, out


def face_entry(path):
    data, widths, font = subset_face(path)
    head, hhea, post = font["head"], font["hhea"], font["post"]
    os2 = font["OS/2"]
    scale = UPEM / head.unitsPerEm
    return {
        # The PostScript name the /BaseFont entry has to carry: a reader that
        # finds a /BaseFont disagreeing with the embedded name table may fall
        # back to a substitute face, which is exactly the print drift the
        # emitter exists to remove.
        "psname": font["name"].getDebugName(6),
        "ttf": base64.b64encode(data).decode("ascii"),
        "widths": widths,
        "upem": int(UPEM),
        "ascent": round(hhea.ascent * scale, 3),
        "descent": round(hhea.descent * scale, 3),
        "capHeight": round((getattr(os2, "sCapHeight", None) or hhea.ascent)
                           * scale, 3),
        "italicAngle": float(post.italicAngle),
        # /Flags in the font descriptor: bit 3 (value 4) symbolic is wrong for
        # WinAnsi text, bit 6 (32) nonsymbolic is what a Latin text face wants.
        "flags": 32,
        "bbox": [round(head.xMin * scale), round(head.yMin * scale),
                 round(head.xMax * scale), round(head.yMax * scale)],
    }


def generate():
    faces = {name: face_entry(os.path.join(FONTS, f)) for name, f in FACES}
    total = sum(len(f["ttf"]) for f in faces.values())
    if total > MAX_BASE64_BYTES:
        raise SystemExit("subset fonts are %d base64 bytes, over the %d ceiling "
                         "- shrink CHARSET or raise the ceiling deliberately"
                         % (total, MAX_BASE64_BYTES))
    body = [
        "// GENERATED by tools/inline_fonts.py - do not edit.",
        "// Five print faces from tools/fonts/, subset to CHARSET, with every",
        "// advance normalised to 1000 units per em so the JS emitter and",
        "// reportlab read one set of numbers.",
        'var HPE = (typeof HPE !== "undefined") ? HPE : {};',
        "HPE.fontdata = (function () {",
        '  "use strict";',
        "  var CHARSET = %s;" % json.dumps(CHARSET),
        "  var FACES = %s;" % json.dumps(faces, sort_keys=True, indent=1),
        "  return { CHARSET: CHARSET, FACES: FACES };",
        "}());",
        "",
    ]
    return "\n".join(body), total


def main(argv):
    text, total = generate()
    if argv[1:] == ["--check"]:
        current = ""
        if os.path.exists(OUT):
            with open(OUT, encoding="utf-8") as fh:
                current = fh.read()
        if current != text:
            print("DESYNC: src/engine/fontdata.js is not what "
                  "tools/inline_fonts.py writes")
            print("run: python3 tools/inline_fonts.py")
            return 1
        print("src/engine/fontdata.js matches tools/fonts/: OK")
        return 0
    if argv[1:]:
        print("usage: %s [--check]" % argv[0], file=sys.stderr)
        return 2
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    print("wrote %s (%d base64 bytes over %d faces, ceiling %d)"
          % (os.path.relpath(OUT, ROOT), total, len(FACES), MAX_BASE64_BYTES))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
