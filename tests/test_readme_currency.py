"""The README's factual claims, checked against the files that know them.

Tree SHAPE, not behaviour: this check's subject IS the README's description of
the repo, so reading `src/engine/*.js` names, globbing `tests/*.test.js` and
`tests/test_*.py`, and counting `tests/mutants/*.patch` are a declared
carve-out from CONTRACT rules 1-2, not a violation of them. All four globs,
not the two this docstring used to list - the plan doc and this file state the
same carve-out and had drifted apart on its scope. See
docs/plans/2026-09-18-readme-refresh.md, "CONTRACT carve-out".
"""
import collections
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
# landed.
#
# Reviewer bounce (2026-10-01, PR #183): the allowlist used to key entries by
# (host file, COMMENT's line number). That made the whole ratchet fail on any
# edit that merely shifted lines above a ref - e.g. inserting one neutral line
# after <meta charset> in index.html turned every one of lane A's 13 entries
# "stale" and every still-present ref "new" in the same run, even though not
# one ref actually changed. It also had a hole in the other direction: a
# SECOND, different ref landing on an already-allowlisted line was invisible,
# because the key was the line number, not what the line said.
#
# Fixed by keying on (host file, the ref TEXT itself) as a MULTISET, not on
# line number:
#   - a ref's host line moving (anything above it changes) leaves the ref's
#     own text untouched, so the key is unchanged and the ratchet stays green;
#   - a genuinely new ref, or a second distinct ref added to an
#     already-allowlisted line, is a new (file, text) key (or a repeated one
#     over its allowed count) - still caught as new;
#   - a list entry whose text no longer appears anywhere in the file is still
#     caught as stale, so a lane that fixes a ref must still delete its entry.
#
# Separately, `index.html`'s pdfdeck/pdfcards `<!-- engine:... -->` regions
# are GENERATED verbatim from src/engine/*.js (see CLAUDE.md, "Hard
# constraints") and are already pinned to that source by
# `tools/validate.py` check 4 - any stale ref inside them is lane B's to fix
# in the .js source, not lane A's to fix twice. Lines inside an engine region
# are therefore skipped when scanning index.html. Of the original 13
# index.html entries, 10 fell inside the inlined pdfdeck/pdfcards copies and
# duplicated lane B's own src/engine/pdfdeck.js and pdfcards.js block below
# word-for-word; those 10 are removed here. Only 765, 6556 and 7749 (outside
# any engine region) remain as lane A's.
#
# The list is grouped by owning lane (one block per file-ownership group) so
# each lane can delete only its own lines. T owns this file and the tools/*
# + CLAUDE.md refs (already fixed, so no T block remains); B deletes the
# src/engine/*.js block as it fixes those refs; A deletes the index.html /
# tests/app.test.js block as it fixes those. The lane that empties the list
# last leaves LINE_REF_ALLOWLIST as an empty string.
#
# Format: one `<host file>: <ref text>` entry per line. The ref text is
# exactly what LINE_REF_RE matches in the comment (e.g. `tools/decks.py:354`
# or `index.html:4700`), NOT the host file's own line number.
LINE_REF_ALLOWLIST = """
# lane B (src/engine/*.js) - delete entries in this block as they are fixed
src/engine/pdfdeck.js: tools/decks.py:354
src/engine/pdfdeck.js: tools/decks.py:167
src/engine/pdfcards.js: tools/hifi.py:22-32
src/engine/pdfcards.js: tools/hifi.py:41-68
src/engine/pdfcards.js: tools/hifi.py:118-160
src/engine/pdfcards.js: tools/hifi.py:176-223
src/engine/pdfcards.js: tools/hifi.py:270-354
src/engine/pdfcards.js: tools/hifi.py:356-377
src/engine/pdfcards.js: tools/hifi.py:431-521
src/engine/pdfcards.js: tools/hifi.py:379-427

# lane A (index.html, tests/app.test.js) - delete entries in this block as
# they are fixed. The entries that used to sit inside the pdfdeck/pdfcards
# engine regions (duplicating lane B's block above) are gone: engine-region
# lines are no longer scanned in index.html at all (see note above).
index.html: core.js:125
index.html: tools/decks.py:409-416
index.html: index.html:4700
tests/app.test.js: index.html:4790-4793
tests/app.test.js: tools/decks.py:409-416
tests/app.test.js: index.html:940
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

# Matches the begin/end markers of a generated engine region (see
# CLAUDE.md, "Hard constraints"). The scan checks every LINE_REF_FILES entry
# uniformly with the SAME pair of regexes - it is not special-cased to
# index.html, and in fact a few other files quote or regex-match the marker
# syntax too (CLAUDE.md's own prose, tools/inline_engine.py's docstring
# example and its BEGIN/END literals, tests/app.test.js's own marker-reading
# regex). That is harmless everywhere a quoted/matched begin is followed by a
# matching end on the same read (CLAUDE.md and the inline_engine.py docstring
# both are), and the begin pattern additionally requires a closing "-->" on
# the SAME line specifically so that tests/app.test.js's
# `/<!-- engine:(\w+) begin/g` regex LITERAL - which has no "-->" after
# "begin" - is never mistaken for a real marker and does not leave the rest
# of that file treated as "inside an engine region" forever.
_ENGINE_BEGIN_RE = re.compile(r"<!--\s*engine:\S+\s+begin\b.*-->")
_ENGINE_END_RE = re.compile(r"<!--\s*engine:\S+\s+end\s*-->")


def _parse_line_ref_allowlist(text):
    entries = collections.Counter()
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        host, sep, reftext = line.partition(": ")
        assert sep, f"malformed LINE_REF_ALLOWLIST entry (want '<file>: <ref>'): {line!r}"
        entries[(host, reftext)] += 1
    return entries


def _scan_lines(relpath, lines):
    """(relpath, ref-text) for every LINE_REF_RE match across `lines`,
    skipping lines inside a generated <!-- engine:... --> region (those are
    pinned to src/engine/*.js by tools/validate.py check 4, not by this
    ratchet). This is the SHIPPED scan primitive: the real ratchet test and
    every regression test below call this same function (never reimplement
    it inline), so a mutant here is caught wherever it is exercised."""
    found = collections.Counter()
    in_engine_region = False
    for line in lines:
        if _ENGINE_BEGIN_RE.search(line):
            in_engine_region = True
        if not in_engine_region:
            for match in LINE_REF_RE.findall(line):
                found[(relpath, match)] += 1
        if _ENGINE_END_RE.search(line):
            in_engine_region = False
    return found


def _find_line_refs(relpath):
    full = os.path.join(ROOT, relpath)
    with open(full, encoding="utf-8") as fh:
        lines = fh.readlines()
    return _scan_lines(relpath, lines)


def _diff_refs(found, allowed):
    """(new, stale) sorted lists of (file, text) keys, each a MULTISET
    difference: an entry present in `found` more times than `allowed` shows
    up in `new` (once per excess occurrence), and vice versa for `stale`.
    This is the SHIPPED comparison primitive - the real ratchet test and
    every regression test below call this same function, so a mutant that
    weakens it (e.g. a Counter diff collapsing to a set diff, which drops
    multiplicity and would hide a duplicate-occurrence bug) is caught
    wherever it is exercised, not just in the one real-tree assertion."""
    new = sorted((found - allowed).elements())
    stale = sorted((allowed - found).elements())
    return new, stale


class LineRefRatchetTest(unittest.TestCase):
    def test_stale_line_refs_in_comments_match_the_allowlist_exactly(self):
        allowed = _parse_line_ref_allowlist(LINE_REF_ALLOWLIST)
        found = collections.Counter()
        for relpath in LINE_REF_FILES:
            found.update(_find_line_refs(relpath))

        new, stale = _diff_refs(found, allowed)
        self.assertEqual(
            new, [],
            "new <file>:<digits> line ref(s) found in a source comment - these "
            "go stale the moment their TARGET moves; use a symbol anchor "
            "(function or key name) instead, or add to LINE_REF_ALLOWLIST "
            "only if this is a pre-existing offender another lane owns: "
            "%r" % (new,))

        self.assertEqual(
            stale, [],
            "LINE_REF_ALLOWLIST entry no longer matches a real offender - the "
            "ratchet may only shrink, so delete the line instead of leaving "
            "it: %r" % (stale,))


# --- Regression tests for the ratchet mechanism itself --------------------
#
# These exist to pin the BEHAVIOUR of _scan_lines/_diff_refs/
# _parse_line_ref_allowlist, not the current state of LINE_REF_ALLOWLIST or
# any real source file. Reviewer bounce (PR #183, round 2): an earlier
# version of these tests asserted against the LIVE allowlist (e.g. "the
# entry ('index.html', 'index.html:4700') exists") and built its own
# Counter-arithmetic fixtures by hand instead of calling the shipped
# functions. That meant (a) the moment lane A fixed that ref and deleted its
# allowlist line, this file's OWN tests would fail - the plan's end state of
# an EMPTY LINE_REF_ALLOWLIST could never be green - and (b) hand-rolled
# Counter arithmetic in the test body cannot catch a bug in the shipped
# _scan_lines/_diff_refs code, since the test never calls it.
# Every test below therefore uses an entirely synthetic allowlist and
# synthetic file content, and drives both through _scan_lines and
# _diff_refs exactly as the real ratchet test does. Blanking
# LINE_REF_ALLOWLIST to "" (the plan's eventual end state) does not touch
# any fixture here.
class LineRefRatchetMechanismTest(unittest.TestCase):
    def test_a_neutral_line_inserted_above_a_ref_does_not_redden_the_ratchet(self):
        # A synthetic "file", not a real one: a ref outside any engine
        # region, a second ref INSIDE one (to prove the region-skip itself
        # is also unaffected by a line shift), and a plain line with no ref.
        lines = [
            "no ref on this line at all\n",
            "a comment mentioning tools/decks.py:42 right here\n",
            "<!-- engine:core begin - synced from src/engine/core.js -->\n",
            "inside the region: tools/hifi.py:99 must stay invisible\n",
            "<!-- engine:core end -->\n",
            "a trailing comment about index.html:7\n",
        ]
        shifted = []
        for line in lines:
            if LINE_REF_RE.search(line) and not _ENGINE_BEGIN_RE.search(line):
                shifted.append("<!-- neutral -->\n")
            shifted.append(line)
        # also shift a line with no ref, to prove that is inert too
        shifted.insert(0, "<!-- neutral -->\n")

        before = _scan_lines("synthetic.html", lines)
        after = _scan_lines("synthetic.html", shifted)

        self.assertEqual(
            before, after,
            "a line ref's (file, text) identity must survive its comment "
            "moving to a different line number")
        # fixture sanity: the region-skipped ref really was excluded, and the
        # two refs outside the region really were found, in BOTH versions.
        self.assertEqual(
            before,
            collections.Counter({
                ("synthetic.html", "tools/decks.py:42"): 1,
                ("synthetic.html", "index.html:7"): 1,
            }))

    def test_a_genuinely_new_ref_still_fails(self):
        allowed = _parse_line_ref_allowlist(
            "synthetic.py: tools/decks.py:1\n")
        found = _scan_lines("synthetic.py", [
            "# synthetic.py: tools/decks.py:1\n",
            "# a brand new, never-allowlisted tools/decks.py:9999\n",
        ])
        new, stale = _diff_refs(found, allowed)
        self.assertEqual(new, [("synthetic.py", "tools/decks.py:9999")])
        self.assertEqual(stale, [])

    def test_an_extra_ref_on_an_already_allowlisted_line_still_fails(self):
        # The hole the old line-number key had: a second ref landing on a
        # line that already had one allowlisted ref used to be invisible,
        # because only the line number was ever recorded. With a
        # text-keyed multiset, a second occurrence of an ALREADY-allowlisted
        # text - even one that lands on the very same line - is still an
        # excess occurrence and still fails.
        allowed = _parse_line_ref_allowlist(
            "synthetic.py: tools/decks.py:1\n")
        found = _scan_lines("synthetic.py", [
            "# synthetic.py: tools/decks.py:1 and again tools/decks.py:1\n",
        ])
        new, stale = _diff_refs(found, allowed)
        self.assertEqual(new, [("synthetic.py", "tools/decks.py:1")])
        self.assertEqual(stale, [])


if __name__ == "__main__":
    unittest.main()
