#!/usr/bin/env python3
"""Data-integrity validation for the handpan chord cards.

Checks that the app's embedded DECKS JSON and tools/decks.py agree
field-for-field, that every card satisfies the highlighting invariants,
and that no German card copy sneaks back in. Needs reportlab (for the
Color class in decks.py) but NOT the tools/fonts TTFs: hifi is stubbed
out before decks.py is imported, since it is only needed at build time.
"""
import json
import os
import re
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
sys.modules.setdefault("hifi", types.ModuleType("hifi"))  # skip font registration
import decks as D  # noqa: E402

PY = {"hijaz": D.HIJAZ, "pygmy": D.PYGMY, "amara": D.AMARA}
GERMAN = re.compile(r"\b(MOLL|VERMINDERT|HALBVERMINDERT|LEGENDE)\b|\bDUR\b")


def hexc(color):
    return "#%02X%02X%02X" % tuple(round(c * 255) for c in
                                   (color.red, color.green, color.blue))


def main():
    html = open(os.path.join(ROOT, "index.html")).read()
    m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
    assert m, "DECKS JSON not found in index.html"
    app = json.loads(m.group(1))

    # 1. app JSON == decks.py: fields, geometry, chords, degrees, colors
    for d in app:
        py = PY[d["id"]]
        spec = py["spec"]
        for fid, val in d["fields"].items():
            assert tuple(val) == spec[int(fid)], (d["id"], "field", fid)
        geom = spec["_geom"]
        for k, v in d["geom"].items():
            assert geom.get(k) == v, (d["id"], "geom", k)
        assert len(d["chords"]) == len(py["chords"]), (d["id"], "chord count")
        for ch, (main_, sup, sub, fields, roots) in zip(d["chords"], py["chords"]):
            assert ch["main"] == main_ and ch["sup"] == sup, (d["id"], ch["main"])
            assert ch["subtitle"] == sub, (d["id"], ch["subtitle"], sub)
            assert ch["fields"] == list(fields), (d["id"], ch["main"], "fields")
            assert set(ch["roots"]) == set(roots), (d["id"], ch["main"], "roots")
        assert {int(k): v for k, v in d["degrees"].items()} == py["degrees"]
        assert d["colors"]["root"] == hexc(py["col_root"]), (d["id"], "root colour")
        assert d["colors"]["tone"] == hexc(py["col_tone"]), (d["id"], "tone colour")
        ga, gb = py["grad"]
        assert d["colors"]["ga"] == hexc(ga) and d["colors"]["gb"] == hexc(gb)
    print("1. app JSON == decks.py (fields, geom, chords, degrees, colours): OK")

    # 2. invariants over every card
    total = 0
    for d in app:
        pc = lambda f: d["fields"][str(f)][2] % 12
        for ch in d["chords"]:
            total += 1
            pcs = {pc(f) for f in ch["fields"]}
            rpc = pc(ch["roots"][0])
            assert rpc in pcs, (d["id"], ch["main"], "root pc missing")
            root_f = {int(f) for f in d["fields"] if pc(int(f)) == rpc}
            tone_f = {int(f) for f in d["fields"]
                      if pc(int(f)) in pcs and pc(int(f)) != rpc}
            assert not (root_f & tone_f), (d["id"], ch["main"], "overlap")
            for f in ch["fields"]:
                assert f in root_f or f in tone_f, (d["id"], ch["main"], f)
            assert len(pcs) == len(ch["fields"]), (d["id"], ch["main"], "doubled pc")
    assert total == 59, total
    print("2. invariants over all %d cards: OK" % total)

    # 3. English-only card copy
    for name in ("index.html", "tools/decks.py", "tools/hifi.py"):
        hits = GERMAN.findall(open(os.path.join(ROOT, name)).read())
        assert not hits, (name, hits)
    print("3. no German card copy: OK")


if __name__ == "__main__":
    main()
    print("validate.py: all checks passed")
