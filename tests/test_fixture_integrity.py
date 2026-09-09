"""The frozen 59-card corpus. Engine tests read this fixture, never the live DECKS.

A deliberate deck-data change must bump the fixture version and regenerate the
sha256 - it is never regenerated from the engine.
"""
import hashlib
import json
import os
import unittest

from tests import paths

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "fixtures", "golden_decks_v1.json")

DECK_KEYS = ("id", "name", "sub", "colors", "degrees", "geom", "fields",
             "chords", "maker_string")
TOP_ZONES = ("ding", "rim", "inner")

# The canonical serialisation's sha256, pinned here so a fixture edit fails
# against a constant a reviewer can see in the diff, not only against a number
# the fixture carries about itself.
EXPECTED_SHA256 = ("0475970330455878d252ae6695ddf92138"
                   "f384cae5cb08f68f91a575a58ad16a")


def chord_counts():
    """Card counts per deck, read from the live decks via tests.paths.

    The 18/25/16 literals are asserted against CLAUDE.md once, in
    tests/test_deck_data.py. Repeating them here would be a second copy free to
    drift; what this suite must prove is that the FROZEN corpus still holds the
    same cards the app does, so it derives the counts instead of restating them.
    The total is still pinned to the spec's 59 below.
    """
    return {d["id"]: len(d["chords"]) for d in paths.app_decks()}

BUMP = ("Deck data changed. This fixture is frozen on purpose: bump it to "
        "golden_decks_v2.json and regenerate sha256, do not edit in place.")


def load():
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


class TestFixtureSelfAssertion(unittest.TestCase):
    def test_sha256_matches_canonical_serialisation(self):
        doc = load()
        canon = json.dumps({"version": doc["version"], "decks": doc["decks"]},
                           sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(hashlib.sha256(canon).hexdigest(), doc["sha256"],
                         "fixture content and its stored sha256 disagree. " + BUMP)

    def test_sha256_is_the_pinned_v1_digest(self):
        self.assertEqual(load()["sha256"], EXPECTED_SHA256,
                         "the v1 corpus digest changed. " + BUMP)

    def test_shape_and_card_counts(self):
        doc = load()
        self.assertEqual(doc["version"], 1)
        self.assertEqual(len(doc["decks"]), 3)
        counts = {d["id"]: len(d["chords"]) for d in doc["decks"]}
        self.assertEqual(counts, chord_counts())
        self.assertEqual(sum(counts.values()), 59)
        for d in doc["decks"]:
            self.assertEqual(tuple(sorted(d)), tuple(sorted(DECK_KEYS)), d["id"])


class TestFixtureMatchesApp(unittest.TestCase):
    def test_fixture_deep_equals_live_decks(self):
        live = {d["id"]: d for d in paths.app_decks()}
        for fx in load()["decks"]:
            with self.subTest(deck=fx["id"]):
                self.assertIn(fx["id"], live, BUMP)
                app = live[fx["id"]]
                for key in ("name", "sub", "chords", "fields", "degrees",
                            "colors", "geom"):
                    self.assertEqual(fx[key], app[key],
                                     "%s.%s diverges from index.html. %s"
                                     % (fx["id"], key, BUMP))


class TestMakerStrings(unittest.TestCase):
    def test_maker_string_tokens_match_fields(self):
        for fx in load()["decks"]:
            with self.subTest(deck=fx["id"]):
                # Partition on "|" rather than flattening it: the separator is
                # what says which shell a note is on, so a string that listed a
                # bottom note among the top ones would otherwise still pass.
                head, sep, tail = fx["maker_string"].partition("|")

                def spell(part):
                    return part.replace("(", " ").replace(")", " ").split()

                fields = list(fx["fields"].values())
                by_midi = lambda zs: sorted(  # noqa: E731
                    (f for f in fields if f[3] in zs), key=lambda f: f[2])
                names = lambda fs: ["%s%d" % (f[0], f[1]) for f in fs]  # noqa: E731

                self.assertEqual(spell(head), names(by_midi(TOP_ZONES)),
                                 "the part before | must spell the top-shell "
                                 "fields, ascending midi")
                self.assertEqual(spell(tail), names(by_midi(("bottom",))),
                                 "the part after | must spell the bottom-shell "
                                 "fields, ascending midi")

    def test_maker_string_marks_ding_and_bottom_shell(self):
        for fx in load()["decks"]:
            with self.subTest(deck=fx["id"]):
                s = fx["maker_string"]
                ding = [f for f in fx["fields"].values() if f[3] == "ding"]
                self.assertEqual(len(ding), 1)
                self.assertTrue(s.startswith("(%s%d)" % (ding[0][0], ding[0][1])))
                has_bottom = any(f[3] == "bottom" for f in fx["fields"].values())
                self.assertEqual("|" in s, has_bottom)


if __name__ == "__main__":
    unittest.main()
