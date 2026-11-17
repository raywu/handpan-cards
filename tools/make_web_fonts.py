#!/usr/bin/env python3
"""Build the same-origin web fonts in fonts/ (WOFF subsets + fonts.css).

SYNC STEP, NOT A BUILD STEP: the output is committed.

    python3 tools/make_web_fonts.py            # write fonts/
    python3 tools/make_web_fonts.py --check    # write nothing; exit 1 on drift

Latin subsets only; CJK text falls back to system fonts. WOFF (zlib), not WOFF2:
brotli is not in requirements-ci.txt. Bitter SemiBold and Nunito Sans Bold are
static instances cut from the google/fonts variable fonts at UPSTREAM_COMMIT
(wght 600 / wght 700 with wdth 100, opsz 12, YTLC 500); the committed TTFs under
tools/fonts/web/ are pinned by sha256 below. The five print TTFs in tools/fonts/
and tools/inline_fonts.py are not touched.
"""
import hashlib
import io
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "fonts")
OUT = os.path.join(ROOT, "fonts")

UPSTREAM_COMMIT = "c30b221beb0c1da59d563feb91ec8656a1fa972a"
ADDED_TTFS = {
    "tools/fonts/web/Bitter-SemiBold.ttf": "31e3e695f1188b8be7b8ff3c8a02eb47a1da8c82e97270fa58ab205779ff93cb",
    "tools/fonts/web/NunitoSans-Bold.ttf": "7546d65ff4719c03192e74752c19b6db04c8f18eaf641684c69423fb2a4cf10d",
}

SUBSET = (
    set(range(0x20, 0x7F))
    | set(range(0xA0, 0x100))
    | set(range(0x2010, 0x2016))
    | set(range(0x2018, 0x2020))
    | {0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2032, 0x2033, 0x2039, 0x203A}
)

FACES = [
    {"family": "Marcellus", "weight": 400, "src": "Marcellus-Regular.ttf", "file": "Marcellus-400.woff"},
    {"family": "Bitter", "weight": 400, "src": "Bitter-Regular.ttf", "file": "Bitter-400.woff"},
    {"family": "Bitter", "weight": 600, "src": "web/Bitter-SemiBold.ttf", "file": "Bitter-600.woff"},
    {"family": "Nunito Sans", "weight": 400, "src": "NunitoSans-Regular.ttf", "file": "NunitoSans-400.woff"},
    {"family": "Nunito Sans", "weight": 600, "src": "NunitoSans-SemiBold.ttf", "file": "NunitoSans-600.woff"},
    {"family": "Nunito Sans", "weight": 700, "src": "web/NunitoSans-Bold.ttf", "file": "NunitoSans-700.woff"},
]

OFL = ["OFL-Marcellus.txt", "OFL-Bitter.txt", "OFL-NunitoSans.txt"]


def source_cmap(face):
    return TTFont(os.path.join(SRC, face["src"])).getBestCmap()


def build_woff(face):
    path = os.path.join(SRC, face["src"])
    cmap = source_cmap(face)
    opts = subset.Options()
    opts.flavor = "woff"
    opts.layout_features = ["kern", "liga", "ccmp", "locl", "mark", "mkmk"]
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opts.notdef_outline = True
    opts.recalc_timestamp = False
    font = TTFont(path, recalcTimestamp=False)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(c for c in SUBSET if c in cmap))
    sub.subset(font)
    font.flavor = "woff"
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def build_css():
    blocks = []
    for f in FACES:
        blocks.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:swap;"
            "src:url('/fonts/%s') format('woff')}" % (f["family"], f["weight"], f["file"])
        )
    return "\n".join(blocks) + "\n"


def outputs():
    out = {f["file"]: build_woff(f) for f in FACES}
    out["fonts.css"] = build_css().encode("utf-8")
    for name in OFL:
        with open(os.path.join(SRC, name), "rb") as fh:
            out[name] = fh.read()
    return out


def verify_pins():
    for rel, digest in ADDED_TTFS.items():
        with open(os.path.join(ROOT, rel), "rb") as fh:
            if hashlib.sha256(fh.read()).hexdigest() != digest:
                sys.exit("sha256 mismatch: " + rel)


def main(argv):
    verify_pins()
    out = outputs()
    drift = []
    for name, data in sorted(out.items()):
        path = os.path.join(OUT, name)
        try:
            with open(path, "rb") as fh:
                same = fh.read() == data
        except FileNotFoundError:
            same = False
        if not same:
            drift.append(name)
            if "--check" not in argv:
                os.makedirs(OUT, exist_ok=True)
                with open(path, "wb") as fh:
                    fh.write(data)
    if "--check" in argv and drift:
        print("drift: " + ", ".join(drift))
        return 1
    print("fonts/ " + ("in sync" if not drift else "wrote " + ", ".join(drift)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
