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
import json
import os
import re
import shutil
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

# CLAUDE.md > "Decks:" - chord counts per deck, 96 cards in total.
# 2026-09-16 (D7/D10/D11, engine adoption): all three decks now ship the
# scale engine's generated output. Hijaz 18 -> 19, Pygmy 27 -> 52 (31 distinct
# chord names, D10 amended), Amara 16 -> 25 (D11, fully re-ranked).
CHORD_COUNTS = {"hijaz": 19, "pygmy": 52, "amara": 25}

# CLAUDE.md > "Scale degrees per deck", keyed by note name.
DEGREES = {
    "hijaz": {"C#": "I", "D": "bII", "F": "iii°", "F#": "iv", "G#": "v°",
              "B": "bvii"},
    "pygmy": {"F": "i", "Ab": "III", "Bb": "iv", "C": "v", "Db": "VI",
              "Eb": "VII", "G": "ii°"},
    "amara": {"D": "i", "A": "v", "G": "IV", "C": "bVII", "F": "bIII"},
}

# Bottom notes used by each Pygmy voicing, in card order - the number the
# orange "N BOTTOM NOTES" badge announces. Zero means the card carries no
# badge at all.
# 2026-09-16 (engine adoption, D10 amendment): Pygmy grew from 27 cards / 25
# names to 52 cards / 31 names - the engine's root-instance enumeration ships
# every register of a chord name rather than the hand-curated subset. Order
# and counts below are the engine's generated output for the maker string
# `(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5`.
PYGMY_BADGE = [
    0,  # Fm
    0,  # F5
    1,  # Fsus4
    1,  # F7sus4
    0,  # Fm7
    0,  # Fm9
    2,  # G dim
    2,  # Gm7b5
    0,  # Ab
    0,  # Ab - high voicing (top shell)
    1,  # Ab - high voicing (bottom shell, Ab5)
    0,  # Ab5 power chord
    0,  # Ab5 power chord - high voicing (top shell)
    1,  # Ab5 power chord - high voicing (bottom shell, Ab5)
    1,  # Absus4
    1,  # Abmaj7sus4
    0,  # Abmaj7
    0,  # Abmaj7 - high voicing (top shell)
    1,  # Abmaj7 - high voicing (bottom shell, Ab5)
    2,  # Bbm
    1,  # Bb5 power chord
    1,  # Bbsus4
    1,  # Bb7sus4
    2,  # Bbm7
    0,  # Cm
    2,  # Cm - low voicing
    0,  # Cm - high voicing
    0,  # C5 power chord
    1,  # C5 power chord - low voicing
    0,  # C5 power chord - high voicing
    0,  # Csus4
    1,  # Csus4 - low voicing
    0,  # Csus4 - high voicing
    1,  # C7sus4
    2,  # C7sus4 - low voicing
    1,  # Cm7
    3,  # Cm7 - low voicing (C3 + Eb3 + Bb3)
    1,  # Db
    1,  # Db - low voicing
    1,  # Db5 power chord
    1,  # Db5 power chord - low voicing
    1,  # Dbmaj7
    1,  # Dbmaj7 - low voicing
    1,  # Eb
    2,  # Eb - low voicing
    1,  # Eb5 power chord
    1,  # Ebsus4
    2,  # Ebsus4 - low voicing
    2,  # Eb7sus4
    3,  # Eb7sus4 - low voicing
    2,  # Eb7 (Bb3 + Db4, both bottom-shell-only)
    3,  # Eb7 - low voicing
]

# Pygmy's two seventh chords each exist in two registers, and the owner asked
# for the missing halves on 2026-09-15. Transcribed from the voicing rules,
# not from decks.py: a spelling-order field list per card, root first.
#
#   Cm7 rooted at C3 (U1) forces nothing - Eb3, G3 and Bb3 all lie ABOVE C3 -
#   so it is an ordinary unforced card, and the one Pygmy voicing that uses
#   three bottom-shell fields.
#   Eb7 rooted at Eb4 is NOT forced: Bb and Db exist only on the bottom shell,
#   and a bottom-shell-only tone forces nothing (owner decision 2026-09-15).
#   G takes its nearest instance above the root, G4; Bb3 and Db4 are the two
#   bottom-shell fields.
#
# Both were legal under CLAUDE.md rule 3 all along and simply absent.
# 2026-09-16: the engine's naming.js appends an enharmonic equivalence note
# to Cm7's subtitle ("( = Eb6 )") that the hand-authored data did not carry;
# the field lists and roots are unchanged.
SEVENTH_REGISTERS = [
    ("Cm", "7", "C MINOR 7 ( = Eb6 ) - LOW VOICING", [101, 103, 1, 104], 101),
    ("Cm", "7", "C MINOR 7 ( = Eb6 )", [3, 4, 6, 104], 3),
    ("Eb", "7", "Eb DOMINANT 7 - LOW VOICING", [103, 1, 104, 105], 103),
    ("Eb", "7", "Eb DOMINANT 7", [4, 6, 104, 105], 4),
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
            with self.subTest(deck=deck["id"]):
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
        self.assertEqual(sum(got.values()), 96, "96 cards total")

    def test_midi_matches_note_name(self):
        for deck in decks():
            for fid, (name, octave, midi, zone, angle, label) in \
                    deck["fields"].items():
                with self.subTest(deck=deck["id"], field=fid):
                    where = (deck["id"], fid, name, octave, midi)
                    self.assertIn(name, NAME_PC, where)
                    self.assertEqual(midi % 12, NAME_PC[name],
                                     str(where) + ": pitch class")
                    self.assertEqual(midi // 12 - 1, octave,
                                     str(where) + ": octave")


class VoicingTest(unittest.TestCase):
    """CLAUDE.md > "Voicing rules"."""

    def test_ding_never_in_voicing(self):
        for deck in decks():
            self.assertEqual(field_of(deck, 0)[3], "ding", deck["id"])
            for ch in deck["chords"]:
                with self.subTest(deck=deck["id"], chord=ch["main"] + ch["sup"]):
                    self.assertNotIn(0, ch["fields"],
                                     (deck["id"], ch["main"], ch["subtitle"]))

    def test_no_doubled_pitch_classes(self):
        for deck in decks():
            for ch in deck["chords"]:
                with self.subTest(deck=deck["id"], chord=ch["main"] + ch["sup"]):
                    pcs = [pc(deck, f) for f in ch["fields"]]
                    self.assertEqual(len(set(pcs)), len(pcs),
                                     (deck["id"], ch["main"], ch["fields"]))

    def test_power_chords_are_root_and_fifth(self):
        """Two notes, root plus a fifth - Amara G5 is a -5 inverted fifth."""
        found = 0
        for deck in decks():
            for ch in deck["chords"]:
                with self.subTest(deck=deck["id"], chord=ch["main"] + ch["sup"]):
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
        self.assertEqual(found, 19, "power chords across the three decks")

    def test_voicings_unique_within_deck(self):
        """One card per voicing. Duplicate pitch-class SETS are deliberate
        (4 groups / 9 cards) - only identical field lists are a bug."""
        for deck in decks():
            seen = {}
            for ch in deck["chords"]:
                with self.subTest(deck=deck["id"], chord=ch["main"] + ch["sup"]):
                    key = tuple(ch["fields"])
                    self.assertNotIn(key, seen,
                                     (deck["id"], ch["main"], ch["subtitle"],
                                      "duplicates " + str(seen.get(key))))
                    seen[key] = ch["main"] + " " + ch["subtitle"]
            self.assertEqual(len(seen), len(deck["chords"]), deck["id"])

    def test_roots_appear_in_voicing(self):
        for deck in decks():
            for ch in deck["chords"]:
                with self.subTest(deck=deck["id"], chord=ch["main"] + ch["sup"]):
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
            zone = lambda f: field_of(deck, f)[3]
            for ch in deck["chords"]:
                root = ch["roots"][0]
                rm = midi(root)
                # The ding is excluded here: its absence is test_ding_never_in_voicing's
                # job, and this rule is about the register of playable tones.
                others = [f for f in ch["fields"]
                          if f != root and field_of(deck, f)[3] != "ding"]
                card = (deck["id"], ch["main"] + ch["sup"], ch["fields"])

                def instances(f, below):
                    return [g for g in playable
                            if midi(g) % 12 == midi(f) % 12
                            and (midi(g) < rm if below else midi(g) > rm)]

                # subTest so a failure names EVERY non-compliant card, not just
                # the first one the loop reaches.
                with self.subTest(deck=deck["id"], card=ch["main"] + ch["sup"]):
                    self._check_cluster(ch, rm, others, card, midi, instances, zone)

    @staticmethod
    def extension_intervals(symbol):
        """Semitone intervals the chord SYMBOL implies as extensions.

        Parsed from the whole symbol (main + sup), since this deck writes its
        7ths into `main` ("G#m7", "Dmaj7") and a future "Cm9" would too. An
        `addN` names exactly that extension; otherwise a stacked symbol implies
        the ones below it (11 -> 9th + 11th; 13 -> 9th + 11th + 13th). A "9"
        immediately after b/# is an altered 9th, never a natural one.
        """
        table = {"b9": {1}, "#11": {6}, "9": {2}, "11": {5}, "13": {9}}
        adds = re.findall(r"add(b9|#11|9|11|13)", symbol)
        if adds:
            return set().union(*(table[a] for a in adds))
        ext = set()
        if "b9" in symbol:
            ext.add(1)
        if re.search(r"(?<![b#])9", symbol):
            ext.add(2)
        if "#11" in symbol:
            ext.add(6)
        elif "11" in symbol:
            ext |= {2, 5}
        if "13" in symbol:
            ext |= {2, 5, 9}
        return ext

    def _check_cluster(self, ch, rm, others, card, midi, instances, zone):
        ext = self.extension_intervals(ch["main"] + ch["sup"])

        # Owner decision 2026-09-15: a tone forces the chord only when it has no
        # instance above the root AND its highest lower instance is on the TOP
        # shell. A bottom-shell-only tone takes its bottom field, forces nothing.
        forced = any(not instances(f, below=False)
                     and zone(max(instances(f, True), key=midi)) != "bottom"
                     for f in others)
        for f in others:
            lower, upper = instances(f, True), instances(f, False)
            if not forced:
                if upper:
                    self.assertGreater(midi(f), rm,
                                       ("unforced card: tone below the root", card, f))
                else:
                    self.assertEqual(midi(f), max(midi(g) for g in lower),
                                     ("bottom-shell-only tone not at its highest "
                                      "instance", card, f))
                    self.assertEqual(zone(f), "bottom", card)
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
            with self.subTest(deck=deck["id"]):
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
                with self.subTest(field=fid):
                    self.assertEqual(val[3], "bottom", (fid, val))
        for other in (d for d in decks() if d["id"] != "pygmy"):
            with self.subTest(deck=other["id"]):
                zones = {v[3] for v in other["fields"].values()}
                self.assertNotIn("bottom", zones,
                                 other["id"] + ": single-shell instrument")

    def test_badge_counts_bottom_notes_in_the_voicing(self):
        deck = self.deck
        self.assertEqual(len(deck["chords"]), len(PYGMY_BADGE))
        for ch, expect in zip(deck["chords"], PYGMY_BADGE):
            with self.subTest(chord=ch["main"] + ch["sup"]):
                got = [f for f in ch["fields"]
                       if field_of(deck, f)[3] == "bottom"]
                self.assertEqual(len(got), expect,
                                 (ch["main"], ch["subtitle"], ch["fields"],
                                  "bottom notes"))
                uses_bb_db = [f for f in ch["fields"]
                              if field_of(deck, f)[0] in ("Bb", "Db")]
                self.assertLessEqual(len(uses_bb_db), len(got),
                                     (ch["main"], "Bb/Db imply bottom notes"))

    def test_both_sevenths_ship_in_both_registers(self):
        """The four cards of SEVENTH_REGISTERS, by name and by field list.

        The register a card teaches is the whole of what separates these
        four - pitch-class-complete highlighting lights the SAME fields for
        a low and a normal voicing of one chord, so the note line and the
        badge are the only places the difference is visible. That is why
        this test pins the field list and not the rendering.
        """
        by_sub = {ch["subtitle"]: ch for ch in self.deck["chords"]}
        for main, sup, subtitle, fields, root in SEVENTH_REGISTERS:
            with self.subTest(card=subtitle):
                self.assertIn(subtitle, by_sub, "missing card")
                ch = by_sub[subtitle]
                self.assertEqual(ch["main"], main)
                self.assertEqual(ch["sup"], sup)
                self.assertEqual(ch["fields"], fields, "spelling order")
                self.assertEqual(ch["roots"], [root])

    def test_low_voicing_subtitles_are_unambiguous(self):
        """Every repeated Pygmy subtitle must still mean a genuinely
        different voicing (a distinct field list).

        Two families of repeats are expected. The generic subtitles (POWER
        CHORD, SUSPENDED CHORD, SUSPENDED DOMINANT 7, each with a LOW/HIGH
        VOICING suffix) always repeated by design. 2026-09-16 (engine
        adoption) adds a second family: three Pygmy chords - Ab MAJOR,
        Ab5's POWER CHORD, and Ab MAJOR 7 - now exist in THREE registers
        (a top-shell voicing plus two HIGH-labelled voicings, one rooted on
        the rim at Ab4 and one rooted on the bottom shell at Ab5), because
        the engine's naming (src/engine/naming.js) only distinguishes LOW
        vs HIGH and has no third label for a second HIGH register. The two
        HIGH cards for each of those three chords therefore print the same
        subtitle text; they remain distinguishable by fields, root and the
        bottom-note badge. This is an accepted consequence of engine
        adoption (see docs/SCALE_ENGINE_PLAN.md), not a naming defect to
        fix here - src/engine/*.js is out of this lane's scope."""
        subs = [ch["subtitle"] for ch in self.deck["chords"]]
        dupes = sorted({s for s in subs if subs.count(s) > 1})
        allowed = {
            "POWER CHORD", "SUSPENDED CHORD", "SUSPENDED DOMINANT 7",
            "POWER CHORD - LOW VOICING", "SUSPENDED CHORD - LOW VOICING",
            "SUSPENDED DOMINANT 7 - LOW VOICING",
            "Ab MAJOR - HIGH VOICING", "POWER CHORD - HIGH VOICING",
            "Ab MAJOR 7 - HIGH VOICING",
        }
        self.assertEqual(set(dupes), allowed,
                         "unexpected subtitle collision(s)")
        for sub in dupes:
            with self.subTest(subtitle=sub):
                cards = [ch for ch in self.deck["chords"] if ch["subtitle"] == sub]
                field_lists = {tuple(ch["fields"]) for ch in cards}
                self.assertEqual(len(field_lists), len(cards),
                                 (sub, "duplicate subtitle must still be a "
                                        "distinct voicing"))

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


class CanonicalSourceTest(unittest.TestCase):
    """data/decks.json is the source; index.html's DECKS line is its copy."""

    def test_canonical_file_equals_the_payload_embedded_in_index_html(self):
        self.assertEqual(paths.canonical_decks(), paths.app_decks())

    def test_canonical_reserialises_to_the_embedded_bytes_exactly(self):
        # The injected form is json.dumps with DEFAULT arguments. Measured
        # 2026-09-16: default 8567 bytes == the committed payload;
        # ensure_ascii=False gives 8542 and compact separators 7398, either of
        # which rewrites the whole line and breaks the identical assertion in
        # tools/regen_data_mutants.py:158.
        html = open(paths.INDEX_HTML, encoding="utf-8").read()
        m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
        self.assertIsNotNone(m, "DECKS JSON not found in index.html")
        self.assertEqual(json.dumps(paths.canonical_decks()), m.group(1))

    def test_sync_decks_check_passes_on_the_committed_tree(self):
        out = subprocess.run(
            [sys.executable, os.path.join(paths.TOOLS, "sync_decks.py"), "--check"],
            capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)

    def test_sync_decks_check_fails_when_the_canonical_file_drifts(self):
        # The gate has to FIRE, not merely exist. Mutate a copy of the tree,
        # not the tree: a test that edits data/decks.json in place and restores
        # it leaves the repo dirty when it fails.
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(paths.ROOT, tmp, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns(".git", "*.pdf"))
            path = os.path.join(tmp, "data", "decks.json")
            decks = json.load(open(path, encoding="utf-8"))
            decks[0]["chords"][0]["subtitle"] = "DRIFTED"
            json.dump(decks, open(path, "w", encoding="utf-8"),
                      indent=2, ensure_ascii=False)
            out = subprocess.run(
                [sys.executable, os.path.join(tmp, "tools", "sync_decks.py"), "--check"],
                capture_output=True, text=True, cwd=tmp)
            self.assertEqual(out.returncode, 1, out.stdout + out.stderr)
            self.assertIn("DECKS", out.stdout + out.stderr)

    def test_sync_decks_rejects_unknown_arguments(self):
        # Substring matching on argv would let a typo alongside a real flag
        # select WRITE mode, which on this tool overwrites index.html.
        out = subprocess.run(
            [sys.executable, os.path.join(paths.TOOLS, "sync_decks.py"), "--chek"],
            capture_output=True, text=True)
        self.assertEqual(out.returncode, 2, out.stdout + out.stderr)

    def test_sync_decks_write_mode_catches_a_byte_level_reinjection_mismatch(self):
        """Write mode's re-parse verification must be a BYTE comparison.

        A semantic comparison (json.loads(again) != canonical()) is blind to
        a write that serialises DIFFERENTLY from `want` but to the same
        data - e.g. a stray `sort_keys=True` on the write line. That is
        exactly the kind of mistake the re-parse step exists to catch
        (CLAUDE.md, "Known pitfalls": "only reading the bytes back proves
        the write landed"), and a semantic check reads the bytes back but
        doesn't actually check them.

        This test patches a COPY of sync_decks.py so its write line emits
        `json.dumps(canonical(), sort_keys=True)` instead of `want`, forces
        a drift so write mode actually runs, and asserts write mode itself
        reports failure. Today's semantic comparison instead prints success
        and exits 0 - this test fails on unmodified tools/sync_decks.py.
        """
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(paths.ROOT, tmp, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns(".git", "*.pdf"))
            tool = os.path.join(tmp, "tools", "sync_decks.py")
            src = open(tool, encoding="utf-8").read()
            needle = 'line = "const DECKS = " + want + ";"'
            self.assertIn(needle, src, "sync_decks.py write line moved")
            src = src.replace(
                needle,
                'line = "const DECKS = " + '
                'json.dumps(canonical(), sort_keys=True) + ";"')
            open(tool, "w", encoding="utf-8").write(src)

            # Force drift so write mode actually takes the write path.
            data_path = os.path.join(tmp, "data", "decks.json")
            decks = json.load(open(data_path, encoding="utf-8"))
            decks[0]["chords"][0]["subtitle"] = "DRIFTED"
            json.dump(decks, open(data_path, "w", encoding="utf-8"),
                      indent=2, ensure_ascii=False)

            out = subprocess.run(
                [sys.executable, tool], capture_output=True, text=True,
                cwd=tmp)
            self.assertNotEqual(
                out.returncode, 0,
                "write mode reported success for a re-injection that "
                "matches semantically but not byte-for-byte:\n"
                + out.stdout + out.stderr)

    def test_validate_py_fails_when_index_html_drifts_from_canonical(self):
        """check 1 is the only thing that catches a hand-edited DECKS line.

        tools/decks.py no longer holds a second copy of the data - it derives
        its deck dicts from data/decks.json - so nothing else in validate.py
        compares index.html to anything. This is the check-4 analogue for data:
        index.html's DECKS line is a GENERATED copy, and an editor or a merge
        resolved inside it has to redden CI.
        """
        try:
            import reportlab  # noqa: F401
        except ImportError:
            self.skipTest("reportlab not installed; validate.py needs it")
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(paths.ROOT, tmp, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns(".git", "*.pdf"))
            index = os.path.join(tmp, "index.html")
            html = open(index, encoding="utf-8").read()
            html = html.replace("C# MAJOR", "C# MAJOUR", 1)
            open(index, "w", encoding="utf-8").write(html)
            out = subprocess.run(
                [sys.executable, "-B", os.path.join(tmp, "tools", "validate.py")],
                capture_output=True, text=True, cwd=tmp)
            self.assertNotEqual(out.returncode, 0, out.stdout + out.stderr)


def _plain(deck):
    """A print deck dict, normalised to JSON-comparable primitives.

    The same normaliser wrote tests/fixtures/print_decks_v1.json, so the
    fixture and the assertion below cannot disagree about shape.
    """
    out = {}
    for k, v in deck.items():
        if k == "spec":
            out[k] = {str(fk): (list(fv) if fk != "_geom" else dict(fv))
                      for fk, fv in v.items()}
        elif k == "chords":
            out[k] = [[m, s, sub, list(f), sorted(r)] for m, s, sub, f, r in v]
        elif k in ("col_root", "col_tone"):
            out[k] = [v.red, v.green, v.blue]
        elif k == "grad":
            out[k] = [[c.red, c.green, c.blue] for c in v]
        elif k == "degrees":
            out[k] = {str(dk): dv for dk, dv in v.items()}
        elif k == "legend_demo":
            out[k] = list(v)
        else:
            out[k] = v
    return out


class PrintDeckSnapshotTest(unittest.TestCase):
    """The print deck dicts are byte-for-byte what they were before the
    canonical file existed. This is the whole acceptance case for the
    decks.py rewrite: the refactor is a content no-op or it is a bug.

    This file otherwise never imports tools/decks.py (tests/CONTRACT.md
    rule 2). The exemption is deliberate and narrow: the assertion is
    against a FROZEN FIXTURE taken before the refactor, not against the
    app data, so it is a pin on decks.py and not a mirror of it.
    """

    def test_deck_dicts_match_the_pre_refactor_snapshot(self):
        try:
            import reportlab  # noqa: F401
        except ImportError:
            self.skipTest("reportlab not installed; decks.py needs Color")
        import types
        sys.path.insert(0, paths.TOOLS)
        sys.modules.setdefault("hifi", types.ModuleType("hifi"))
        import decks as D
        want = json.load(open(os.path.join(paths.ROOT, "tests", "fixtures",
                                           "print_decks_v1.json"),
                              encoding="utf-8"))
        got = {i: _plain(d) for i, d in
               (("hijaz", D.HIJAZ), ("pygmy", D.PYGMY), ("amara", D.AMARA))}
        self.assertEqual(got, want)

    def test_print_overlay_may_not_shadow_canonical_data(self):
        """The overlay carries what the shared data cannot, and nothing else.

        Without this guard a stray `name=` or `chords=` in an overlay would
        silently win over the canonical value and rebuild, one key at a time,
        the second copy this refactor deleted.
        """
        try:
            import reportlab  # noqa: F401
        except ImportError:
            self.skipTest("reportlab not installed; decks.py needs Color")
        import types
        sys.path.insert(0, paths.TOOLS)
        sys.modules.setdefault("hifi", types.ModuleType("hifi"))
        import decks as D
        with self.assertRaises(ValueError) as caught:
            D._from_canonical("hijaz", name="SHADOWED", R=73.0)
        self.assertIn("name", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
