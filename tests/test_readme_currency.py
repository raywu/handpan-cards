"""The README's factual claims, checked against the files that know them.

Tree SHAPE, not behaviour: this check's subject IS the README's description of
the repo, so reading `src/engine/*.js` names and counting `tests/mutants/*.patch`
is a declared carve-out from CONTRACT rules 1-2, not a violation of them. See
docs/plans/2026-09-18-readme-refresh.md, "CONTRACT carve-out".
"""
import glob
import os
import re
import unittest

from tests.paths import ROOT, canonical_decks

with open(os.path.join(ROOT, "README.md"), encoding="utf-8") as fh:
    README = fh.read()
LOWER = README.lower()

# "N cards total" and not a bare "N cards": the deck line states per-deck counts
# too, and set-equality over every "N cards" phrase would make that line and
# this assertion mutually unsatisfiable.
TOTAL_RE = re.compile(r"\b(\d{2,4}) cards total\b")
MUTANT_RE = re.compile(r"\b(\d{2,4}) mutant")
ENGINE_RE = re.compile(r"src/engine/([A-Za-z0-9_]+\.js)")


class ReadmeCurrencyTest(unittest.TestCase):
    def test_total_card_count_matches_the_deck_data(self):
        total = sum(len(d["chords"]) for d in canonical_decks())
        found = {int(n) for n in TOTAL_RE.findall(README)}
        self.assertTrue(found, "README no longer states a total card count")
        self.assertEqual(
            found, {total},
            f"README says {sorted(found)} cards total; data/decks.json has {total}")

    def test_every_deck_is_named_with_its_own_chord_count(self):
        for d in canonical_decks():
            name = d["name"].lower()      # the data is UPPERCASE, the prose is not
            self.assertIn(name, LOWER, f"deck {d['id']} is not named in the README")
            at = LOWER.index(name) + len(name)
            # after the name, so the name's own digits cannot satisfy it, and
            # stopped at the next clause so a neighbouring deck's count cannot
            # either - the decks are 40 chars apart today, which is not a margin.
            window = re.split(r"[;.]", README[at:at + 40])[0]
            self.assertIn(
                str(len(d["chords"])), window,
                f"deck {d['id']} has {len(d['chords'])} cards; the README does not "
                f"say so within 40 chars of its name (saw {window!r})")

    def test_every_engine_module_is_mentioned(self):
        # the full path, not the bare stem: "layout" and "core" already occur in
        # the README's prose and would pass for the wrong reason.
        mods = sorted(os.path.basename(p)
                      for p in glob.glob(os.path.join(ROOT, "src", "engine", "*.js")))
        self.assertTrue(mods, "no engine modules found to check")
        missing = [m for m in mods if f"src/engine/{m}" not in README]
        self.assertEqual(missing, [],
                         f"engine modules absent from the README: {missing}")
        # and the other direction, or deleting a module leaves a stale mention green
        phantom = sorted({m for m in ENGINE_RE.findall(README)} - set(mods))
        self.assertEqual(phantom, [],
                         f"README names engine modules that do not exist: {phantom}")

    def test_the_mutant_count_is_stated_within_a_lane_of_the_truth(self):
        # A BAND, not equality and not a bare upper bound. Equality would make
        # every unrelated lane that adds a mutant edit the README, which is a
        # cross-lane conflict magnet in a repo that runs swarms. A bare upper
        # bound is the hole that let "311" ship on a 312-patch tree: it catches
        # only overstatement, so any understatement at all passes. The floor is
        # 90% of the corpus, which absorbs ordinary growth between README edits
        # and still catches the kind of drift this file exists to prevent (the
        # stale README said 59 cards against 96, a 39% error).
        n = len(glob.glob(os.path.join(ROOT, "tests", "mutants", "*.patch")))
        found = {int(x) for x in MUTANT_RE.findall(README)}
        self.assertTrue(found, "README no longer states a mutant count")
        said = max(found)
        self.assertLessEqual(said, n, f"README claims {said} mutants; there are {n}")
        self.assertGreaterEqual(
            said, int(n * 0.9),
            f"README says {said} mutants against {n} on disk - more than a lane's "
            f"worth of drift; restate it")


if __name__ == "__main__":
    unittest.main()
