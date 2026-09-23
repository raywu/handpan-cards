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
NODE_SUITE_RE = re.compile(r"\b(\d{1,3}) node suites\b")
PY_SUITE_RE = re.compile(r"\b(\d{1,3}) python suites\b")
MODULE_COUNT_RE = re.compile(r"\b([a-z]+) modules under\b")
WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
         "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
         "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15}



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

    def test_the_module_count_word_matches_the_module_list(self):
        # The prose spells the count ("ten modules under"), and the list that
        # follows it is checked module-by-module above - so the two can drift
        # apart while both halves look right. Exactly what happened: the README
        # said "six" while naming ten.
        mods = glob.glob(os.path.join(ROOT, "src", "engine", "*.js"))
        said = MODULE_COUNT_RE.findall(LOWER)
        self.assertTrue(said, "README no longer states an engine module count")
        for word in said:
            self.assertIn(word, WORDS, f"unreadable module count {word!r}")
            self.assertEqual(
                WORDS[word], len(mods),
                f"README says {word} engine modules; src/engine/ has {len(mods)}")

    def test_the_suite_counts_match_the_files_on_disk(self):
        # Equality, not the mutant rule's band: a suite file is added rarely and
        # deliberately, so the cross-lane conflict the band exists to avoid does
        # not arise here, and a band wide enough to matter at n=12 would have
        # passed the "8 python suites" that shipped against 13.
        for pattern, regex, label in (
            (os.path.join(ROOT, "tests", "*.test.js"), NODE_SUITE_RE, "node"),
            (os.path.join(ROOT, "tests", "test_*.py"), PY_SUITE_RE, "python"),
        ):
            n = len(glob.glob(pattern))
            found = {int(x) for x in regex.findall(README)}
            self.assertTrue(found, f"README no longer states a {label} suite count")
            self.assertEqual(
                found, {n},
                f"README says {sorted(found)} {label} suites; there are {n}")

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
