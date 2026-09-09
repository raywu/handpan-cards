"""A scale seed becomes a printable deck.

Two halves:

1. ``tools/gen_deck.js`` - the CLI that turns a D13 scale string into the
   generated-deck JSON of ENGINE-SPEC section 11.  It must be pure (no
   network, nothing written outside a path it was told), and a rejected seed
   must exit non-zero carrying the engine's OWN code and reason from
   ``HPE.core.REASONS``; the code enum is closed (spec section 2).
2. ``decks.from_generated`` - the adapter from that JSON to the deck dict
   ``hifi.build`` consumes.  The print pipeline needs roughly a dozen per-deck
   keys the engine knows nothing about, and the gate below is that EVERY key a
   built-in deck dict carries is either synthesised by the adapter or named in
   ``decks.GENERATED_OMITTED`` with a reason.  The key set is read off the
   built-ins at runtime, so a key added to ``decks.py`` later makes this file
   fail rather than pass silently.

No layout constant is imported from ``hifi`` (CONTRACT rule 2); the PDF
assertions are made against the built artifact, in a temp directory - never the
repo root, whose six committed PDFs this file must not touch.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import pymupdf

from tests import paths

sys.path.insert(0, paths.TOOLS)

import hifi  # noqa: E402
import decks  # noqa: E402

GEN_DECK = os.path.join(paths.TOOLS, "gen_deck.js")

# A nine-note top shell with no bottom notes, and the same pan with a bottom
# shell, so the badge / legend / dashed-ring paths are exercised too.
SEED_TOP_ONLY = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4"
SEED_WITH_BOTTOM = ("(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5"
                    " | C3 Db3 Eb3 Bb3 Db4 Ab5")

# Pinned from a real build, NOT recomputed from the chord count: a count
# derived from the deck under test would move with it and could not detect a
# deck whose card list silently changed size.
PAGES_TOP_ONLY_FULL = 3
PAGES_TOP_ONLY_PRINT = 3

# The closed code enum of ENGINE-SPEC section 2.
CODES = {"NO_DING", "NO_FIFTH", "TOO_MANY_RIM", "BAD_NOTE", "NEEDS_NEWER_APP",
         "NO_THIRDS"}


def run_gen(*args, **kw):
    """-> CompletedProcess for `node tools/gen_deck.js <args>`."""
    return subprocess.run([shutil.which("node") or "node", GEN_DECK, *args],
                          capture_output=True, text=True, cwd=paths.ROOT,
                          timeout=120, **kw)


def generate(seed, *args):
    proc = run_gen(seed, *args)
    if proc.returncode != 0:
        raise AssertionError("gen_deck.js rejected %r: %s"
                             % (seed, proc.stderr.strip()))
    return json.loads(proc.stdout)


def repo_pdf_hashes():
    """{filename: sha256} for the six committed PDFs in the repo root."""
    out = {}
    for name in sorted(paths.PDFS.values()):
        with open(os.path.join(paths.ROOT, name), "rb") as fh:
            out[name] = hashlib.sha256(fh.read()).hexdigest()
    return out


def builtin_deck_keys():
    """Every per-deck key the print pipeline reads, off the built-ins."""
    keys = set()
    for deck in (decks.HIJAZ, decks.PYGMY, decks.AMARA):
        keys |= set(deck)
    return keys


class GenDeckCliTest(unittest.TestCase):
    """The CLI contract: JSON out, the engine's own reason on rejection."""

    def test_a_seed_emits_parseable_generated_deck_json(self):
        payload = generate(SEED_TOP_ONLY)
        self.assertIn("seed", payload)
        self.assertIn("deck", payload)
        deck = payload["deck"]
        self.assertEqual(
            set(deck),
            {"id", "name", "options", "colors", "degrees", "geom", "fields",
             "chords", "warnings"},
            "the generated deck object is fixed by ENGINE-SPEC section 11")
        self.assertTrue(deck["id"].startswith("custom:"))
        self.assertTrue(deck["chords"], "a nine-note pan yields chords")
        for chord in deck["chords"]:
            self.assertEqual(set(chord),
                             {"main", "sup", "subtitle", "fields", "roots"})

    def test_the_canonical_seed_round_trips_through_the_cli(self):
        payload = generate(SEED_TOP_ONLY)
        again = generate(payload["seed"])
        self.assertEqual(again["seed"], payload["seed"])
        self.assertEqual(again["deck"]["id"], payload["deck"]["id"])

    def test_a_rejected_seed_exits_non_zero_with_the_engines_own_reason(self):
        cases = [
            ("D3 A3 C4", "NO_DING"),
            ("(C3) D3 E3 F#3 G#3 A#3 C4 D4 E4", "NO_FIFTH"),
            ("(D3) A3 Zz3 C4", "BAD_NOTE"),
        ]
        for seed, code in cases:
            with self.subTest(seed=seed):
                proc = run_gen(seed)
                self.assertNotEqual(
                    proc.returncode, 0,
                    "a rejected seed must exit non-zero, not print nothing "
                    "and succeed")
                self.assertEqual(proc.stdout.strip(), "",
                                 "a rejection writes nothing to stdout")
                self.assertIn(code, proc.stderr,
                              "the closed enum code belongs on stderr")
                self.assertIn(code, CODES)
                # The reason is the engine's, never one the tool composed.
                reason = engine_reason(code, seed)
                self.assertIn(reason, proc.stderr,
                              "gen_deck.js must print HPE.core.REASONS "
                              "verbatim, not a sentence of its own")

    def test_presets_are_inlined_seed_strings_that_all_generate(self):
        proc = run_gen("--list-presets")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        presets = json.loads(proc.stdout)
        self.assertGreaterEqual(len(presets), 4)
        self.assertLessEqual(len(presets), 8)
        for entry in presets:
            with self.subTest(preset=entry["id"]):
                self.assertIsInstance(entry["seed"], str)
                self.assertTrue(entry["seed"].strip())
                payload = generate("--preset", entry["id"])
                self.assertTrue(payload["deck"]["chords"])

    def test_the_tool_never_reaches_the_network(self):
        """No network, by ALLOWLIST - a banned-substring list is evadable.

        The old scan was a list of double-quoted literals, so every
        single-quoted `require` walked straight through it: `require('https')`,
        `require('net').connect()` and `await import('https')` all passed.
        Both quote styles are matched now, and the positive allowlist below is
        the real guard: the tool may require exactly the two modules it
        requires today, and adding a third has to be a deliberate edit here.
        """
        with open(GEN_DECK, encoding="utf-8") as fh:
            source = fh.read()

        # Every require()/import() target, in either quote style.
        loaded = set(re.findall(
            r"""(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)""", source))
        self.assertEqual(
            loaded, {"node:fs", "./engine_loader.js"},
            "gen_deck.js may load only node:fs and the sibling engine "
            "loader; anything else needs a deliberate change here")

        # Belt and braces for the forms that need no require at all.
        for banned in (r"\bfetch\s*\(", r"\bXMLHttpRequest\b",
                       r"\bnode:https?\b", r"\bnode:net\b",
                       r"\bchild_process\b", r"\bworker_threads\b",
                       r"globalThis\s*\[\s*['\"]fetch"):
            self.assertIsNone(
                re.search(banned, source),
                "presets are INLINED; the tool stays offline (matched %r)"
                % banned)


def engine_reason(code, seed):
    """The reason string the engine itself produces for this seed."""
    script = (
        'const {loadEngine} = require("./tests/helpers/engine.js");'
        'const H = loadEngine(["core","voicing","layout","naming","select"]);'
        'const r = H.core.parseSeed(process.argv[1]);'
        'process.stdout.write(r.ok ? "" : r.reason);')
    proc = subprocess.run([shutil.which("node") or "node", "-e", script, seed],
                          capture_output=True, text=True, cwd=paths.ROOT,
                          timeout=120)
    return proc.stdout


class GeneratedDeckKeyTest(unittest.TestCase):
    """Every print-only per-deck key: synthesised, or omitted BY NAME."""

    @classmethod
    def setUpClass(cls):
        cls.payload = generate(SEED_TOP_ONLY)
        cls.deck = decks.from_generated(cls.payload)
        cls.bottom = decks.from_generated(generate(SEED_WITH_BOTTOM))

    def test_every_builtin_deck_key_is_synthesised_or_named_as_omitted(self):
        missing = []
        for key in sorted(builtin_deck_keys()):
            if key in self.deck or key in decks.GENERATED_OMITTED:
                continue
            missing.append(key)
        self.assertEqual(
            missing, [],
            "tools/decks.py grew per-deck key(s) %r that a generated deck "
            "neither synthesises nor lists in decks.GENERATED_OMITTED with a "
            "reason" % missing)

    def test_an_omitted_key_is_actually_absent_and_carries_a_reason(self):
        self.assertTrue(decks.GENERATED_OMITTED,
                        "an empty omission table would make the coverage "
                        "test above unfalsifiable in the other direction")
        for key, reason in decks.GENERATED_OMITTED.items():
            with self.subTest(key=key):
                self.assertNotIn(
                    key, self.deck,
                    "%r is declared omitted but the adapter emits it - the "
                    "omission table would then excuse any missing key" % key)
                self.assertNotIn(key, self.bottom)
                self.assertIn(key, builtin_deck_keys(),
                              "%r is not a key any built-in deck has" % key)
                self.assertIsInstance(reason, str)
                self.assertGreater(len(reason.strip()), 20,
                                   "an omission needs a stated reason")

    def test_the_synthesised_keys_have_the_shapes_hifi_reads(self):
        d = self.deck
        self.assertIsInstance(d["name"], str)
        self.assertIsInstance(d["title"], str)
        self.assertIsInstance(d["sub"], str)
        self.assertIsInstance(d["credit"], str)
        self.assertIsInstance(d["blurb"], list)
        self.assertIsInstance(d["legend_lines"], list)
        self.assertTrue(d["blurb"] and d["legend_lines"])
        self.assertEqual(len(d["legend_demo"]), 2)
        for field in d["legend_demo"]:
            self.assertIn(field, d["spec"])
        self.assertGreater(d["R"], 0)
        for key in ("cy", "y_note", "y_num"):
            self.assertIsInstance(d[key], float)
        self.assertFalse(d["has_bottom"])
        self.assertTrue(self.bottom["has_bottom"])
        self.assertEqual(d["grad"], (d["col_root"], d["col_tone"]))
        # spec: the _geom block plus one integer-keyed field tuple each.
        self.assertIn("_geom", d["spec"])
        for key, value in d["spec"].items():
            if key == "_geom":
                continue
            self.assertIsInstance(key, int)
            self.assertEqual(len(value), 6)
        # `ext` and `rim_num_out` are the two keys that are NOT radii feeding
        # pan(): `ext` sets R in the adapter (a missing one used to default to
        # 1.0 and blow the diagram off the card) and `rim_num_out` is a branch
        # in draw_pan.  They belong in this list for exactly that reason.
        for key in ("rim", "inner", "bottom", "r_ding", "ding_dy", "r_note",
                    "r_bnote", "inner_ring", "f_ding", "f_note", "f_bnote",
                    "f_num", "n_in", "n_out", "ext", "rim_num_out"):
            self.assertIn(key, d["spec"]["_geom"],
                          "pan() yields NaN for a missing geom key")
            self.assertIn(key, self.bottom["spec"]["_geom"])
        self.assertIsInstance(d["degrees"], dict)
        for pc in d["degrees"]:
            self.assertIsInstance(pc, int)
            self.assertIn(pc, range(12))
        for chord in d["chords"]:
            main, sup, subtitle, fields, roots = chord
            self.assertIsInstance(main, str)
            self.assertIsInstance(sup, str)
            self.assertIsInstance(subtitle, str)
            self.assertTrue(fields)
            self.assertTrue(roots)
            self.assertTrue(set(roots) <= set(fields))
            for f in fields:
                self.assertIn(f, d["spec"])

    def test_a_missing_ext_raises_instead_of_defaulting_the_radius(self):
        """`geom.ext` is load-bearing OUTSIDE the engine: no silent default.

        It used to be read as ``.get("ext") or 1.0``.  Drop or rename the key
        and every generated deck quietly got R = 74.0; on a bottom-shell pan
        (real ext ~1.4767) the drawn reach becomes 109.3pt on a 247.2pt card
        half 88.8 wide - the diagram runs over the header, over the note lines
        and off both sides, and nothing goes red.  A KeyError is the failure.
        """
        payload = generate(SEED_WITH_BOTTOM)
        self.assertGreater(decks.from_generated(payload)["R"], 0)
        del payload["deck"]["geom"]["ext"]
        with self.assertRaises(KeyError):
            decks.from_generated(payload)

    def test_the_adapter_leaves_the_builtin_decks_untouched(self):
        """ADDITIVE only: validate.py check 1 pins decks.py to the app JSON."""
        for deck in (decks.HIJAZ, decks.PYGMY, decks.AMARA):
            self.assertNotIn("options", deck)
            self.assertNotIn("warnings", deck)
        self.assertEqual(decks.HIJAZ["name"], "C# HIJAZ 9")
        self.assertEqual(len(decks.HIJAZ["chords"]), 18)
        self.assertEqual(len(decks.PYGMY["chords"]), 25)
        self.assertEqual(len(decks.AMARA["chords"]), 16)


class GeneratedDeckPdfTest(unittest.TestCase):
    """End to end: a seed reaches paper through the existing hifi.build."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="handpan-gen-")
        # Snapshot BEFORE anything is built: the oracle for the staleness test
        # below is the sha256 of the six committed PDFs as they were on entry.
        cls.pdfs_before = repo_pdf_hashes()
        cls.deck = decks.from_generated(generate(SEED_TOP_ONLY))
        cls.bottom = decks.from_generated(generate(SEED_WITH_BOTTOM))
        cls.full = os.path.join(cls.tmp, "generated_full.pdf")
        cls.print_only = os.path.join(cls.tmp, "generated_print.pdf")
        cls.bottom_pdf = os.path.join(cls.tmp, "generated_bottom.pdf")
        cls.pages_full = hifi.build(cls.full, cls.deck)
        cls.pages_print = hifi.build(cls.print_only, cls.deck, chords_only=True)
        cls.pages_bottom = hifi.build(cls.bottom_pdf, cls.bottom)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def text_of(self, path):
        with pymupdf.open(path) as doc:
            return "".join(page.get_text() for page in doc), doc.page_count

    def test_a_generated_deck_builds_a_pdf_with_the_expected_page_count(self):
        self.assertTrue(self.tmp.startswith(tempfile.gettempdir()),
                        "generated PDFs never land in the repo root")
        for path, reported, expected in (
                (self.full, self.pages_full, PAGES_TOP_ONLY_FULL),
                (self.print_only, self.pages_print, PAGES_TOP_ONLY_PRINT)):
            with self.subTest(pdf=os.path.basename(path)):
                self.assertTrue(os.path.isfile(path))
                self.assertGreater(os.path.getsize(path), 1000)
                _text, pages = self.text_of(path)
                self.assertEqual(pages, expected,
                                 "%s: wrote %d sheets, expected %d"
                                 % (os.path.basename(path), pages, expected))
                self.assertEqual(reported, expected,
                                 "build() reported %r sheets" % (reported,))

    def test_the_generated_pdf_carries_the_deck_name_and_its_chords(self):
        text, _pages = self.text_of(self.full)
        squeezed = "".join(text.split())
        self.assertIn("".join(self.deck["name"].split()), squeezed,
                      "the deck name must reach the printed cards")
        printed = [ch for ch in self.deck["chords"]
                   if "".join((ch[0] + ch[1]).split()) in squeezed]
        self.assertTrue(printed, "no chord name reached the sheet")
        self.assertIn("".join(self.deck["chords"][0][2].split()), squeezed,
                      "the first card's subtitle must be printed")

    def test_a_generated_bottom_shell_deck_prints_its_badge(self):
        text, pages = self.text_of(self.bottom_pdf)
        self.assertGreater(pages, 0)
        squeezed = "".join(text.split())
        self.assertIn("BOTTOMNOTE", squeezed,
                      "a voicing that uses the bottom shell needs its badge")
        self.assertEqual(self.pages_bottom, pages)

    def test_the_repo_pdfs_were_not_rebuilt(self):
        """reportlab stamps a creation date - a rebuild churns the binaries.

        The oracle is a sha256 snapshot taken in setUpClass BEFORE the three
        builds above ran, re-read here afterwards.  The previous version of
        this test read no mtime and no hash: it asserted the committed PDFs
        exist and that a `/var/folders/...` temp prefix is not a substring of a
        repo path, neither of which can be false, so pointing hifi.build at the
        repo root would have left it green.
        """
        self.assertEqual(len(self.pdfs_before), 6,
                         "six committed PDFs are the thing being guarded")
        self.assertEqual(
            repo_pdf_hashes(), self.pdfs_before,
            "building a generated deck rewrote a committed PDF in the repo "
            "root; generated PDFs belong in a temp directory")


if __name__ == "__main__":
    unittest.main()
