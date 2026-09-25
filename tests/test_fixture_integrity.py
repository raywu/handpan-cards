"""The frozen 96-card corpus (v4). Engine tests read this fixture, never the live DECKS.

A deliberate deck-data change must bump the fixture version and regenerate the
sha256 - it is never regenerated from the engine.
"""
import hashlib
import json
import os
import unittest

from tests import paths

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "fixtures", "golden_decks_v4.json")
V3_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "fixtures", "golden_decks_v3.json")

DECK_KEYS = ("id", "name", "sub", "colors", "degrees", "geom", "fields",
             "chords", "maker_string")
TOP_ZONES = ("ding", "rim", "inner")

# The canonical serialisation's sha256, pinned here so a fixture edit fails
# against a constant a reviewer can see in the diff, not only against a number
# the fixture carries about itself.
#
# 2026-09-16 (engine adoption, owner-approved deck-data change): bumped v3
# -> v4. All three decks now ship the scale engine's generated output
# (18/27/16 -> 19/52/25 chords); this fixture is frozen so exactly this kind
# of change fails loudly rather than being regenerated silently - bumping the
# version and the digest here, in the same PR that changes data/decks.json,
# is the loud failure this fixture exists to force.
EXPECTED_SHA256 = ("d9fe93bd3c8cbbe366498cdd4c2101af6c9d262964f72624319af346"
                   "b929861e")

# The v3 corpus's canonical-serialisation digest, pinned the same way as v4's
# above (queue row 48: v3 was unpinned - its "sha256" key existed in the
# fixture but nothing outside the fixture read it, so a coordinated rewrite of
# both the content and its self-reported digest would have passed silently).
EXPECTED_SHA256_V3 = ("6377b1e0230926a5aa85be066517647ec0f7606b569429804a4420"
                      "b540ac1787")


def chord_counts():
    """Card counts per deck, read from the live decks via tests.paths.

    The 19/52/25 literals are asserted against CLAUDE.md once, in
    tests/test_deck_data.py. Repeating them here would be a second copy free to
    drift; what this suite must prove is that the FROZEN corpus still holds the
    same cards the app does, so it derives the counts instead of restating them.
    The total is still pinned to the spec's 96 below.
    """
    return {d["id"]: len(d["chords"]) for d in paths.app_decks()}

BUMP = ("Deck data changed. This fixture is frozen on purpose: bump it to "
        "golden_decks_v4.json and regenerate sha256, do not edit in place.")


def load():
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


def load_v3():
    with open(V3_FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


class TestFixtureSelfAssertion(unittest.TestCase):
    def test_sha256_matches_canonical_serialisation(self):
        doc = load()
        canon = json.dumps({"version": doc["version"], "decks": doc["decks"]},
                           sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(hashlib.sha256(canon).hexdigest(), doc["sha256"],
                         "fixture content and its stored sha256 disagree. " + BUMP)

    def test_sha256_is_the_pinned_v4_digest(self):
        self.assertEqual(load()["sha256"], EXPECTED_SHA256,
                         "the v4 corpus digest changed. " + BUMP)

    def test_v3_sha256_matches_its_canonical_serialisation(self):
        doc = load_v3()
        canon = json.dumps({"version": doc["version"], "decks": doc["decks"]},
                           sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(hashlib.sha256(canon).hexdigest(), doc["sha256"],
                         "v3 fixture content and its stored sha256 disagree. " + BUMP)

    def test_v3_sha256_is_the_pinned_digest(self):
        self.assertEqual(load_v3()["sha256"], EXPECTED_SHA256_V3,
                         "the v3 corpus digest changed. " + BUMP)

    def test_shape_and_card_counts(self):
        doc = load()
        self.assertEqual(doc["version"], 4)
        self.assertEqual(len(doc["decks"]), 3)
        counts = {d["id"]: len(d["chords"]) for d in doc["decks"]}
        self.assertEqual(counts, chord_counts())
        self.assertEqual(sum(counts.values()), 96)
        for d in doc["decks"]:
            with self.subTest(deck=d["id"]):
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
