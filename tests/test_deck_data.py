"""Deck data locked against the spec in CLAUDE.md.

Everything asserted here is transcribed by hand from CLAUDE.md - the
"Instrument layouts (verified)" tables, the voicing rules, the scale
degrees - and checked against the DECKS JSON embedded in index.html.

Per tests/CONTRACT.md rule 2 this file never imports tools/decks.py or
tools/hifi.py: comparing the app data to the generator that produced it
would be a mirror, and `tools/validate.py` already does that cross-check
(shelled out to in test_validate_py_passes - never imported, it stubs
`hifi` into sys.modules).

Highlighting derivation, root/tone non-overlap and "every voicing field is
lit" belong to validate.py and are deliberately not repeated here.
"""
import os
import subprocess
import sys
import tempfile
import unittest

try:  # discovered as tests.test_deck_data from the repo root
    from tests import paths
except ImportError:  # pragma: no cover - discovery rooted inside tests/
    import paths


# Standard chromatic pitch classes. Spelling is per-instrument (CLAUDE.md
# notes that Hijaz F4 is functionally E#), so only the pitch class is fixed.
NAME_PC = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
    "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10,
    "B": 11,
}

# CLAUDE.md > "Instrument layouts (verified - do not 'correct')".
# (label, note name, octave, MIDI, zone, angle) - angles are math-convention
# degrees, 0 = right, 90 = up, y-up. MIDI from scientific pitch notation
# (C4 = 60), which is what the octave numbers in the spec mean.
LAYOUTS = {
    # Ding C#3 centre, standard left-first zig-zag.
    "hijaz": [
        ("Ding", "C#", 3, 49, "ding", None),
        ("1", "G#", 3, 56, "rim", 270),
        ("2", "B", 3, 59, "rim", 225),
        ("3", "C#", 4, 61, "rim", 315),
        ("4", "D", 4, 62, "rim", 180),
        ("5", "F", 4, 65, "rim", 0),
        ("6", "F#", 4, 66, "rim", 135),
        ("7", "G#", 4, 68, "rim", 45),
        ("8", "B", 4, 71, "rim", 90),
    ],
    # Ding F3; top rim is MIRRORED (right-first); the inner pair ascends
    # opposite to the rim; bottom notes as an outer ring in x-ray view.
    "pygmy": [
        ("Ding", "F", 3, 53, "ding", None),
        ("1", "G", 3, 55, "rim", 290),
        ("2", "Ab", 3, 56, "rim", 250),
        ("3", "C", 4, 60, "rim", 330),
        ("4", "Eb", 4, 63, "rim", 210),
        ("5", "F", 4, 65, "rim", 10),
        ("6", "G", 4, 67, "rim", 170),
        ("7", "Ab", 4, 68, "rim", 50),
        ("8", "C", 5, 72, "rim", 130),
        ("9", "Eb", 5, 75, "rim", 90),
        ("10", "F", 5, 77, "inner", 128),
        ("11", "G", 5, 79, "inner", 52),
        ("U1", "C", 3, 48, "bottom", 300),
        ("U2", "Db", 3, 49, "bottom", 240),
        ("U3", "Eb", 3, 51, "bottom", 0),
        ("U4", "Bb", 3, 58, "bottom", 180),
        ("U5", "Db", 4, 61, "bottom", 60),
        ("U6", "Ab", 5, 80, "bottom", 120),
    ],
    # Ding D3, standard zig-zag.
    "amara": [
        ("Ding", "D", 3, 50, "ding", None),
        ("1", "A", 3, 57, "rim", 270),
        ("2", "C", 4, 60, "rim", 225),
        ("3", "D", 4, 62, "rim", 315),
        ("4", "E", 4, 64, "rim", 180),
        ("5", "F", 4, 65, "rim", 0),
        ("6", "G", 4, 67, "rim", 135),
        ("7", "A", 4, 69, "rim", 45),
        ("8", "C", 5, 72, "rim", 90),
    ],
}

# CLAUDE.md > "Decks:" - chord counts per deck, 59 cards in total.
CHORD_COUNTS = {"hijaz": 18, "pygmy": 25, "amara": 16}

# CLAUDE.md > "Scale degrees per deck", keyed by note name.
DEGREES = {
    "hijaz": {"C#": "I", "D": "bII", "F#": "iv", "G#": "v°", "B": "bvii"},
    "pygmy": {"F": "i", "Ab": "III", "Bb": "iv", "C": "v", "Db": "VI",
              "Eb": "VII", "G": "ii°"},
    "amara": {"D": "i", "A": "v", "G": "IV", "C": "bVII", "F": "bIII"},
}

# Bottom notes used by each Pygmy voicing, in card order - the number the
# orange "N BOTTOM NOTES" badge announces. Zero means the card carries no
# badge at all.
PYGMY_BADGE = [
    0,  # Fm
    0,  # F5
    1,  # Fsus4
    0,  # Fm7
    0,  # Fm9
    1,  # Fm11
    0,  # Ab
    0,  # Ab high voicing
    0,  # Abmaj7
    1,  # Abmaj9
    2,  # Bbm
    2,  # Bbm7
    2,  # Cm low voicing
    0,  # Cm
    0,  # Cm high voicing
    0,  # C5
    0,  # Csus4
    2,  # Cm7 (clustered: Eb3 + Bb3 are both bottom-shell)
    1,  # Db
    1,  # Dbmaj7
    2,  # Eb low voicing
    1,  # Eb
    3,  # Eb7
    2,  # G dim
    2,  # Gm7b5
]

# F natural minor, complete (CLAUDE.md, Pygmy).
F_NATURAL_MINOR = {"F", "G", "Ab", "Bb", "C", "Db", "Eb"}


def decks():
    return paths.app_decks()


def field_of(deck, fid):
    return deck["fields"][str(fid)]


def pc(deck, fid):
    return field_of(deck, fid)[2] % 12


class LayoutTest(unittest.TestCase):
    """The instrument layouts, against the verified tables in CLAUDE.md."""

    def test_layouts_match_spec(self):
        seen = set()
        for deck in decks():
            seen.add(deck["id"])
            expect = LAYOUTS[deck["id"]]
            got = {}
            for val in deck["fields"].values():
                name, octave, midi, zone, angle, label = val
                self.assertNotIn(label, got, (deck["id"], "duplicate label"))
                got[label] = (label, name, octave, midi, zone, angle)
            self.assertEqual(sorted(got), sorted(row[0] for row in expect),
                             deck["id"] + ": field labels")
            for row in expect:
                self.assertEqual(got[row[0]], row, (deck["id"], row[0]))
        self.assertEqual(seen, set(LAYOUTS), "deck ids")

    def test_deck_inventory(self):
        got = {d["id"]: len(d["chords"]) for d in decks()}
        self.assertEqual(got, CHORD_COUNTS)
        self.assertEqual(sum(got.values()), 59, "59 cards total")

    def test_midi_matches_note_name(self):
        for deck in decks():
            for fid, (name, octave, midi, zone, angle, label) in \
                    deck["fields"].items():
                where = (deck["id"], fid, name, octave, midi)
                self.assertIn(name, NAME_PC, where)
                self.assertEqual(midi % 12, NAME_PC[name],
                                 str(where) + ": pitch class")
                self.assertEqual(midi // 12 - 1, octave,
                                 str(where) + ": octave")


class VoicingTest(unittest.TestCase):
    """CLAUDE.md > "Voicing rules (audited from the originals)"."""

    def test_ding_never_in_voicing(self):
        for deck in decks():
            self.assertEqual(field_of(deck, 0)[3], "ding", deck["id"])
            for ch in deck["chords"]:
                self.assertNotIn(0, ch["fields"],
                                 (deck["id"], ch["main"], ch["subtitle"]))

    def test_no_doubled_pitch_classes(self):
        for deck in decks():
            for ch in deck["chords"]:
                pcs = [pc(deck, f) for f in ch["fields"]]
                self.assertEqual(len(set(pcs)), len(pcs),
                                 (deck["id"], ch["main"], ch["fields"]))

    def test_power_chords_are_root_and_fifth(self):
        """Two notes, root plus a fifth - Amara G5 is a -5 inverted fifth."""
        found = 0
        for deck in decks():
            for ch in deck["chords"]:
                two = len(ch["fields"]) == 2
                named = ch["main"].endswith("5") and not ch["sup"]
                self.assertEqual(two, named,
                                 (deck["id"], ch["main"], ch["fields"],
                                  "2-note voicings and *5 names must coincide"))
                if not named:
                    continue
                found += 1
                root = ch["roots"][0]
                self.assertEqual(root, ch["fields"][0],
                                 (deck["id"], ch["main"], "root first"))
                other = [f for f in ch["fields"] if f != root]
                self.assertEqual(len(other), 1, (deck["id"], ch["main"]))
                interval = (field_of(deck, other[0])[2]
                            - field_of(deck, root)[2]) % 12
                self.assertEqual(interval, 7,
                                 (deck["id"], ch["main"], "fifth above root"))
        self.assertEqual(found, 9, "power chords across the three decks")

    def test_voicings_unique_within_deck(self):
        """One card per voicing. Duplicate pitch-class SETS are deliberate
        (4 groups / 9 cards) - only identical field lists are a bug."""
        for deck in decks():
            seen = {}
            for ch in deck["chords"]:
                key = tuple(ch["fields"])
                self.assertNotIn(key, seen,
                                 (deck["id"], ch["main"], ch["subtitle"],
                                  "duplicates " + str(seen.get(key))))
                seen[key] = ch["main"] + " " + ch["subtitle"]
            self.assertEqual(len(seen), len(deck["chords"]), deck["id"])

    def test_roots_appear_in_voicing(self):
        for deck in decks():
            for ch in deck["chords"]:
                self.assertTrue(ch["roots"], (deck["id"], ch["main"]))
                for r in ch["roots"]:
                    self.assertIn(r, ch["fields"],
                                  (deck["id"], ch["main"], "root", r))


    def test_forced_tones_cluster_below_root(self):
        """CLAUDE.md rule 3, the cluster clause made precise (2026-09).

        When ANY non-root tone is only available below the root, every CHORD
        TONE sits at its highest instance below the root (one with no lower
        instance stays put), while EXTENSIONS implied by the chord symbol (add9,
        9, b9; an 11 chord's 9th and 11th; a 13 chord's 9th, 11th and 13th; #11)
        keep their nearest instance above the root unless they are themselves
        forced. When nothing is forced, every non-root tone simply sits above
        the root. Transcribed from the spec, not from decks.py.
        """
        for deck in decks():
            playable = [int(f) for f in deck["fields"] if field_of(deck, int(f))[3] != "ding"]
            midi = lambda f: field_of(deck, f)[2]
            for ch in deck["chords"]:
                root = ch["roots"][0]
                rm = midi(root)
                others = [f for f in ch["fields"] if f != root]
                card = (deck["id"], ch["main"] + ch["sup"], ch["fields"])

                def instances(f, below):
                    return [g for g in playable
                            if midi(g) % 12 == midi(f) % 12
                            and (midi(g) < rm if below else midi(g) > rm)]

                sup = ch["sup"]
                # subTest so a failure names EVERY non-compliant card, not just
                # the first one the loop reaches.
                with self.subTest(deck=deck["id"], card=ch["main"] + ch["sup"]):
                    self._check_cluster(deck, ch, root, rm, others, card, midi, instances)

    def _check_cluster(self, deck, ch, root, rm, others, card, midi, instances):
        sup = ch["sup"]
        ext = set()
        if "b9" in sup:
            ext.add(1)
        if "9" in sup:
            ext.add(2)
        if "#11" in sup:
            ext.add(6)
        elif "11" in sup:          # an 11 chord implies its 9th
            ext |= {2, 5}
        if "13" in sup:            # a 13 chord implies 9th and 11th
            ext |= {2, 5, 9}

        forced = any(not instances(f, below=False) for f in others)
        for f in others:
            lower, upper = instances(f, True), instances(f, False)
            if not forced:
                self.assertGreater(midi(f), rm,
                                   ("unforced card: tone below the root", card, f))
            elif (midi(f) - rm) % 12 in ext:
                if upper:
                    self.assertEqual(midi(f), min(midi(g) for g in upper),
                                     ("extension not at its nearest instance "
                                      "above the root", card, f))
                else:
                    self.assertEqual(midi(f), max(midi(g) for g in lower),
                                     ("forced extension not at its highest "
                                      "lower instance", card, f))
            elif lower:
                self.assertEqual(midi(f), max(midi(g) for g in lower),
                                 ("forced card: chord tone not at its highest "
                                  "instance below the root", card, f))

class DegreeTest(unittest.TestCase):

    def test_degrees_cover_chord_roots(self):
        for deck in decks():
            expect = {NAME_PC[n]: lab
                      for n, lab in DEGREES[deck["id"]].items()}
            got = {int(k): v for k, v in deck["degrees"].items()}
            self.assertEqual(got, expect, deck["id"] + ": scale degrees")
            roots = {pc(deck, r) for ch in deck["chords"] for r in ch["roots"]}
            self.assertEqual(roots, set(expect),
                             deck["id"] + ": every chord root has a degree "
                                          "and every degree is used")


class PygmyBottomShellTest(unittest.TestCase):
    """CLAUDE.md > F3 Low Pygmy 18: the bottom shell and its badge."""

    def setUp(self):
        self.deck = next(d for d in decks() if d["id"] == "pygmy")

    def test_bb_and_db_only_on_the_bottom_shell(self):
        for fid, val in self.deck["fields"].items():
            if val[0] in ("Bb", "Db"):
                self.assertEqual(val[3], "bottom", (fid, val))
        for other in (d for d in decks() if d["id"] != "pygmy"):
            zones = {v[3] for v in other["fields"].values()}
            self.assertNotIn("bottom", zones,
                             other["id"] + ": single-shell instrument")

    def test_badge_counts_bottom_notes_in_the_voicing(self):
        deck = self.deck
        self.assertEqual(len(deck["chords"]), len(PYGMY_BADGE))
        for ch, expect in zip(deck["chords"], PYGMY_BADGE):
            got = [f for f in ch["fields"]
                   if field_of(deck, f)[3] == "bottom"]
            self.assertEqual(len(got), expect,
                             (ch["main"], ch["subtitle"], ch["fields"],
                              "bottom notes"))
            uses_bb_db = [f for f in ch["fields"]
                          if field_of(deck, f)[0] in ("Bb", "Db")]
            self.assertLessEqual(len(uses_bb_db), len(got),
                                 (ch["main"], "Bb/Db imply bottom notes"))

    def test_pitch_class_set_is_complete_f_natural_minor(self):
        names = {v[0] for v in self.deck["fields"].values()}
        self.assertEqual(names, F_NATURAL_MINOR)
        self.assertEqual({NAME_PC[n] for n in names},
                         {NAME_PC[n] for n in F_NATURAL_MINOR})


class ValidateScriptTest(unittest.TestCase):

    def test_validate_py_passes(self):
        """tools/validate.py cross-checks app JSON vs decks.py and the
        highlighting invariants. Shelled out to: importing it stubs `hifi`
        into sys.modules for the whole process (CONTRACT traps).

        Bytecode caching is redirected to a throwaway directory. A .pyc is
        invalidated on source mtime-in-seconds + size, so a mutation run that
        applies a same-length patch, compiles, and reverts inside one second
        leaves tools/__pycache__ holding the MUTATED decks.py - and the next
        validate.py run fails against data that is no longer on disk.
        """
        try:
            import reportlab  # noqa: F401
        except ImportError:
            self.skipTest("reportlab not installed; validate.py needs it")
        with tempfile.TemporaryDirectory() as pycache:
            env = dict(os.environ, PYTHONPYCACHEPREFIX=pycache)
            subprocess.run([sys.executable, "-B",
                            os.path.join("tools", "validate.py")],
                           cwd=paths.ROOT, env=env, check=True)


if __name__ == "__main__":
    unittest.main()
