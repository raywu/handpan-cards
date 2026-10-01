"""The README's factual claims, checked against the files that know them.

Tree SHAPE, not behaviour: this check's subject IS the README's description of
the repo, so reading `src/engine/*.js` names, globbing `tests/*.test.js` and
`tests/test_*.py`, and counting `tests/mutants/*.patch` are a declared
carve-out from CONTRACT rules 1-2, not a violation of them. All four globs,
not the two this docstring used to list - the plan doc and this file state the
same carve-out and had drifted apart on its scope. See
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
# Anchored to the engine path, and the alternation only admits number words:
# the README's prose also says "readable modules\nunder `src/engine/`", which a
# bare `([a-z]+) modules under` would match the moment a rewrap joined those
# two lines - reddening CI on a pure prose edit with "unreadable count
# 'readable'". The count word is the only capture either way.
MODULE_COUNT_RE = re.compile(
    r"\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|"
    r"thirteen|fourteen|fifteen)\s+modules\s+under\s+`src/engine/`")
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
        # not arise here. At n=12 the mutant rule's 90% floor is int(12*0.9)=10,
        # so a band would license a two-suite lie while reading as a check - and
        # it buys nothing, because nobody adds a suite without noticing.
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


# --- Finding 7 (2026-09-30 quality-refactor plan): stale cross-file line
# refs in source comments ----------------------------------------------------
#
# A line ref like `index.html:3392` or `decks.py:66` reads true the day it is
# written and silently lies after the next edit shifts a line number - unlike
# a symbol name, nothing re-checks it. This is a RATCHET, not a one-time
# cleanup: LINE_REF_ALLOWLIST lists every offender that existed when the lint
# landed, by (file, line number) of the COMMENT that contains the ref, not
# the ref's target. The test below requires the allowlist and what is
# actually on disk to match EXACTLY, in both directions:
#   - a ref not on the list (new, or moved to a different line) FAILS;
#   - a list entry whose line no longer contains a matching ref FAILS too -
#     so a lane that fixes a ref MUST delete its own entry in the same PR,
#     and cannot accidentally leave the allowlist wider than reality.
# The list is grouped by owning lane (one block per file-ownership group) so
# each lane can delete only its own lines. T owns this file and the tools/*
# + CLAUDE.md refs (already fixed, so no T block remains); B deletes the
# src/engine/*.js block as it fixes those refs; A deletes the index.html /
# tests/app.test.js block as it fixes those. The lane that empties the list
# last leaves LINE_REF_ALLOWLIST as an empty string.
LINE_REF_ALLOWLIST = """
# lane B (src/engine/*.js) - delete entries in this block as they are fixed
src/engine/pdfdeck.js:6
src/engine/pdfdeck.js:19
src/engine/pdfcards.js:28
src/engine/pdfcards.js:106
src/engine/pdfcards.js:141
src/engine/pdfcards.js:178
src/engine/pdfcards.js:286
src/engine/pdfcards.js:386
src/engine/pdfcards.js:426
src/engine/pdfcards.js:531

# lane A (index.html, tests/app.test.js) - delete entries in this block as
# they are fixed
index.html:765
index.html:2162
index.html:2175
index.html:2481
index.html:2559
index.html:2594
index.html:2631
index.html:2739
index.html:2839
index.html:2879
index.html:2984
index.html:6556
index.html:7749
tests/app.test.js:1729
tests/app.test.js:3810
tests/app.test.js:3912
"""

# The files the ratchet watches. Deliberately NOT the whole repo: it tracks
# exactly the files the three owning lanes (T, B, A) are responsible for, per
# the plan's finding-7 lane row. Other files (other *.test.js, docs/, TODOS.md)
# are out of this ratchet's scope.
LINE_REF_FILES = (
    ["index.html", "tests/app.test.js", "CLAUDE.md"]
    + sorted(os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "tools", "*.py")))
    + sorted(os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "tools", "*.js")))
    + sorted(os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "src", "engine", "*.js")))
)

# `<file>:<digits>`, optionally a `-digits` range and/or `,digits` list, e.g.
# `decks.py:66,157` or `src/engine/layout.js:289-302`. A symbol anchor (a
# function or key name) never matches this, which is the whole point.
LINE_REF_RE = re.compile(r"[A-Za-z_./]+\.(?:py|js|html):\d+(?:-\d+)?(?:,\d+)*")


def _parse_line_ref_allowlist(text):
    entries = set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        path, _, lineno = line.rpartition(":")
        entries.add((path, int(lineno)))
    return entries


class LineRefRatchetTest(unittest.TestCase):
    def test_stale_line_refs_in_comments_match_the_allowlist_exactly(self):
        allowed = _parse_line_ref_allowlist(LINE_REF_ALLOWLIST)
        found = set()
        for relpath in LINE_REF_FILES:
            full = os.path.join(ROOT, relpath)
            with open(full, encoding="utf-8") as fh:
                for i, line in enumerate(fh, start=1):
                    if LINE_REF_RE.search(line):
                        found.add((relpath, i))

        new = sorted(found - allowed)
        self.assertEqual(
            new, [],
            "new <file>:<digits> line ref(s) found in a source comment - these "
            "go stale the moment a line shifts; use a symbol anchor (function "
            "or key name) instead, or add to LINE_REF_ALLOWLIST only if this "
            "is a pre-existing offender another lane owns: %r" % (new,))

        stale = sorted(allowed - found)
        self.assertEqual(
            stale, [],
            "LINE_REF_ALLOWLIST entry no longer matches a real offender - the "
            "ratchet may only shrink, so delete the line instead of leaving "
            "it: %r" % (stale,))


if __name__ == "__main__":
    unittest.main()
