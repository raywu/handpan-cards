"""Shared loader for the review scripts. Run from the repo root."""
import re
import sys
import types
import statistics

sys.path.insert(0, "tools")
sys.modules.setdefault("hifi", types.ModuleType("hifi"))
import decks  # noqa: E402

DECKS = [("hijaz", decks.HIJAZ), ("pygmy", decks.PYGMY), ("amara", decks.AMARA)]

# D1 vocabulary (docs/SCALE_ENGINE_PLAN.md, OWNER DECISIONS D1).
D1_QUALITIES = {
    "major": (0, 4, 7), "minor": (0, 3, 7), "dim": (0, 3, 6), "aug": (0, 4, 8),
    "power": (0, 7), "sus4": (0, 5, 7),
    "maj7": (0, 4, 7, 11), "m7": (0, 3, 7, 10), "dom7": (0, 4, 7, 10),
    "m7b5": (0, 3, 6, 10), "dim7": (0, 3, 6, 9),
}

NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]


def fields(deck):
    """int field id -> (name, octave, midi, zone, angle, label), no _geom."""
    return {k: v for k, v in deck["spec"].items() if k != "_geom"}


def playable(deck):
    return {k: v for k, v in fields(deck).items() if v[3] != "ding"}


def midi(deck, f):
    return deck["spec"][f][2]


def pc(deck, f):
    return midi(deck, f) % 12


def label(deck, f):
    v = deck["spec"][f]
    return f"{v[0]}{v[1]}"


def cards():
    """Yield (deck_id, deck, idx, main, sup, subtitle, fields, root)."""
    for did, d in DECKS:
        for i, (main, sup, sub, fl, roots) in enumerate(d["chords"]):
            assert len(roots) == 1, (did, main, roots)
            yield did, d, i, main, sup, sub, list(fl), next(iter(roots))


def symbol(main, sup):
    return main + sup


def extension_intervals(sym):
    """Transcribed from tests/test_deck_data.py::extension_intervals."""
    table = {"b9": {1}, "#11": {6}, "9": {2}, "11": {5}, "13": {9}}
    adds = re.findall(r"add(b9|#11|9|11|13)", sym)
    if adds:
        return set().union(*(table[a] for a in adds))
    ext = set()
    if "b9" in sym:
        ext.add(1)
    if re.search(r"(?<![b#])9", sym):
        ext.add(2)
    if "#11" in sym:
        ext.add(6)
    elif "11" in sym:
        ext |= {2, 5}
    if "13" in sym:
        ext |= {2, 5, 9}
    return ext


def quality_of(deck, fl, root):
    """Interval set (from the root pc) of a curated card."""
    rp = pc(deck, root)
    return tuple(sorted((pc(deck, f) - rp) % 12 for f in fl))


def is_alternate(sub):
    return "HIGH VOICING" in sub or "LOW VOICING" in sub


def fmt(deck, fl):
    return "[" + ",".join(str(f) for f in fl) + "]=" + " ".join(label(deck, f) for f in fl)


def median(xs):
    return statistics.median(xs)
