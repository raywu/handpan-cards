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
CHORD_COUNTS = {"hijaz": 18, "pygmy": 25, "amara": 16}
TOP_ZONES = ("ding", "rim", "inner")

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

    def test_shape_and_card_counts(self):
        doc = load()
        self.assertEqual(doc["version"], 1)
        self.assertEqual(len(doc["decks"]), 3)
        counts = {d["id"]: len(d["chords"]) for d in doc["decks"]}
        self.assertEqual(counts, CHORD_COUNTS)
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
                for key in ("chords", "fields", "degrees", "colors", "geom"):
                    self.assertEqual(fx[key], app[key],
                                     "%s.%s diverges from index.html. %s"
                                     % (fx["id"], key, BUMP))


class TestMakerStrings(unittest.TestCase):
    def test_maker_string_tokens_match_fields(self):
        for fx in load()["decks"]:
            with self.subTest(deck=fx["id"]):
                tokens = fx["maker_string"].replace("(", " ").replace(")", " ") \
                                           .replace("|", " ").split()
                fields = list(fx["fields"].values())
                top = sorted((f for f in fields if f[3] in TOP_ZONES),
                             key=lambda f: f[2])
                bottom = sorted((f for f in fields if f[3] == "bottom"),
                                key=lambda f: f[2])
                expect = ["%s%d" % (f[0], f[1]) for f in top + bottom]
                self.assertEqual(tokens, expect,
                                 "maker_string must spell the fields, ascending "
                                 "midi within top then bottom")

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
