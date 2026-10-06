#!/usr/bin/env python3
"""Data-integrity validation for the handpan chord cards.

data/decks.json is the SOURCE of deck data. Check 1 gates index.html's
`const DECKS` line as a current generated copy of it - the check-4 analogue
for data, and the only thing that catches a hand-edit or a merge resolved
inside that line. Check 1b is a GUARD ON THE ADAPTER in tools/decks.py: the
deck dicts are derived from the same canonical file, so they cannot drift by
construction, and what 1b actually catches is a print-only overlay key
shadowing a canonical one. Checks 2-5 cover the per-card root/doubled-pitch-class
invariants, the German card copy, engine-region drift, and the fontdata subsets.

Needs reportlab (for the Color class in decks.py) but NOT the tools/fonts
TTFs: hifi is stubbed out before decks.py is imported, since it is only
needed at build time.
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
import inline_engine  # noqa: E402
import inline_fonts  # noqa: E402
import sync_decks  # noqa: E402  (tools/ is on sys.path, above)

PY = {"hijaz": D.HIJAZ, "pygmy": D.PYGMY, "amara": D.AMARA}
GERMAN = re.compile(r"\b(MOLL|VERMINDERT|HALBVERMINDERT|LEGENDE)\b|\bDUR\b")


def hexc(color):
    return "#%02X%02X%02X" % tuple(round(c * 255) for c in
                                   (color.red, color.green, color.blue))


def run_check(num, desc, fn, failures):
    """Run one numbered check and REPORT its own failure instead of letting a
    bare AssertionError abort the script.

    Finding 15 (2026-09-30 quality-refactor plan): the old `main()` was one
    long sequence of bare `assert`s, so the first failure raised, aborted the
    whole run, and left every check after it unexplained - and unrun. This
    prints the check's own message labelled with its number and description
    (so the failure is diagnosable from CI output alone), appends
    `(num, desc, message)` to `failures` on failure, and - critically - lets
    the caller go on to run the next check either way.
    """
    try:
        fn()
    except Exception as e:
        # T183-3 (2026-10-01 post-refactor triage): was `except AssertionError`,
        # so a check that raised anything else (e.g. KeyError) still aborted the
        # whole script and left every check after it unexplained and unrun -
        # the exact failure mode this function exists to prevent.
        msg = str(e) if str(e) else repr(e)
        print("%s. %s: FAILED - %s" % (num, desc, msg))
        failures.append((num, desc, msg))
    else:
        print("%s. %s: OK" % (num, desc))


def main():
    failures = []

    # 1. index.html's DECKS line is a current copy of data/decks.json.
    #    data/decks.json is the SOURCE; this is the check-4 analogue for data.
    def check_1():
        assert sync_decks.main(["sync_decks.py", "--check"]) == 0, \
            "index.html's DECKS line is stale - run `python3 tools/sync_decks.py`"
    run_check(1, "index.html DECKS == data/decks.json", check_1, failures)

    app = sync_decks.canonical()

    # 1b. tools/decks.py's deck dicts carry the canonical data unchanged.
    #     After the adapter lands this cannot drift by construction, so the
    #     check is a GUARD ON THE ADAPTER (a print overlay key must never
    #     shadow a canonical one), not a drift detector between two copies.
    def check_1b():
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
    run_check("1b", "tools/decks.py deck dicts == data/decks.json", check_1b, failures)

    # 2. every card's root pitch class is in its voicing and no pitch class
    # is doubled. Highlighting is asserted elsewhere: "every voicing field is
    # lit" for every card by the tests/app.test.js test "pan() draws one circle
    # per field, two more per lit field, plus the chrome"; root/tone non-overlap
    # is structural in the app (chordSets assigns each pitch class to root or
    # tone in one if/else) and is asserted for one card by "chordSets: Amara C
    # major has two root-coloured fields (C4 + C5)"; the root/tone role of every
    # field on all 96 cards is pinned app-against-print by
    # tests.test_render_agreement test_highlighting_agrees, and print's
    # never-both by tests.test_print
    # test_state_selects_root_or_tone_colour_but_never_both.
    counted = {}

    def check_2():
        total = 0
        for d in app:
            pc = lambda f: d["fields"][str(f)][2] % 12
            for ch in d["chords"]:
                total += 1
                pcs = {pc(f) for f in ch["fields"]}
                rpc = pc(ch["roots"][0])
                assert rpc in pcs, (d["id"], ch["main"], "root pc missing")
                assert len(pcs) == len(ch["fields"]), (d["id"], ch["main"], "doubled pc")
        counted["total"] = total
    run_check(2, "root pc in every voicing, no doubled pc", check_2, failures)
    if "total" in counted:
        print("    (%d cards)" % counted["total"])

    # 3. English-only card copy
    def check_3():
        for name in ("index.html", "tools/decks.py", "tools/hifi.py",
                     "data/decks.json"):
            hits = GERMAN.findall(open(os.path.join(ROOT, name)).read())
            assert not hits, (name, hits)
    run_check(3, "no German card copy", check_3, failures)

    # 4. the inlined engine == src/engine/*.js. index.html carries a verbatim
    # copy of each module (the app is single-file by contract), so a change to
    # a module that is not re-synced would ship an app running old engine code.
    def check_4():
        problems = inline_engine.desync()
        assert not problems, problems
    run_check(4, "inlined engine regions == src/engine/ (%s)"
              % ", ".join(inline_engine.MODULES), check_4, failures)

    # 5. the generated font module == what tools/inline_fonts.py writes from
    # tools/fonts/. src/engine/fontdata.js is GENERATED, and check 4 above only
    # proves index.html carries a copy of whatever the file says - not that the
    # file still matches the TTFs the print pipeline prints with.
    def check_5():
        assert inline_fonts.main(["inline_fonts.py", "--check"]) == 0, \
            "src/engine/fontdata.js is stale - run `python3 tools/inline_fonts.py`"
    run_check(5, "src/engine/fontdata.js == tools/fonts/ subsets", check_5, failures)

    return failures


if __name__ == "__main__":
    _failures = main()
    if _failures:
        print("validate.py: %d check(s) FAILED" % len(_failures))
        sys.exit(1)
    print("validate.py: all checks passed")
