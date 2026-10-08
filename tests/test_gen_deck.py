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
SEED_WITH_BOTTOM = ("[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4"
                    " C5 Eb5 F5 G5 [Ab5]")
# A pan of fourths and fifths: it BUILDS, and carries the NO_THIRDS warning.
SEED_NO_THIRDS = "(C3) G3 D4 G4 D5"

# Pinned from a real build, NOT recomputed from the chord count: a count
# derived from the deck under test would move with it and could not detect a
# deck whose card list silently changed size.
PAGES_TOP_ONLY_FULL = 6
PAGES_TOP_ONLY_PRINT = 6
# Same convention, same reason: SEED_TOP_ONLY's card count, pinned from a real
# build.  The blurb assertion below quotes this number as a LITERAL string.
# Deriving the expected line from `len(deck["chords"])` would compare the deck
# against itself - `_blurb` builds that line from the very same count - so a
# selector that started yielding 24 chords for this seed would move both sides
# together and the pin would still pass.  It did, until 2026-09-09.
CHORDS_TOP_ONLY = 49

# The closed code enum of ENGINE-SPEC section 2.
CODES = {"NO_DING", "NO_FIFTH", "BAD_NOTE",
         "NOTE_OUT_OF_RANGE", "NOTE_OUT_OF_ORDER", "NOTE_REPEATED",
         "NEEDS_NEWER_APP", "NO_THIRDS"}


def run_gen(*args, legacy=False, **kw):
    """-> CompletedProcess for `node tools/gen_deck.js [--legacy] <args>`."""
    flags = ["--legacy"] if legacy else []
    return subprocess.run([shutil.which("node") or "node", GEN_DECK, *flags, *args],
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
            with self.subTest(chord=chord.get("main")):
                self.assertEqual(set(chord),
                                 {"main", "sup", "subtitle", "fields", "roots"})

    def test_legacy_flag_reads_the_seed_with_the_legacy_reader(self):
        plain = json.loads(run_gen(SEED_TOP_ONLY, legacy=False).stdout)
        flagged = json.loads(run_gen(SEED_TOP_ONLY, legacy=True).stdout)
        self.assertEqual(flagged, plain)
        legacy = json.loads(run_gen(PYGMY_LEGACY_MAKER, legacy=True).stdout)
        current = json.loads(run_gen(PYGMY_MAKER, legacy=False).stdout)
        self.assertEqual(legacy["deck"]["fields"], current["deck"]["fields"])
        self.assertNotEqual(run_gen(PYGMY_LEGACY_MAKER, legacy=False).returncode, 0,
                            "the new reader accepted a legacy bar list")
        self.assertEqual(run_gen("--legacy", "--list-presets", legacy=False).returncode, 0)

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
            # A real note in the wrong place says so, and does not claim the
            # note is not a note (ENGINE-SPEC section 2, swarm-2026-09-10).
            ("(D) A B C D E F G | C D2", "NOTE_OUT_OF_ORDER"),
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

    def test_an_option_typo_is_a_usage_error_and_never_an_engine_code(self):
        """`--palette abc` is a spelling mistake, not a scale the engine read.

        Without the guard, `Number("abc")` reached the engine as NaN and came
        back as `BAD_NOTE: NaN is not a note. Use names like C, F#, Bb...` -
        a NOTE error for an OPTION typo, pointing at the wrong half of the
        command line.  The carve-out is deliberate and narrow: a usage error
        carries NO enum code, because the closed code enum of ENGINE-SPEC
        section 2 describes SEEDS, not flag spellings.
        """
        cases = [("--palette", "abc"), ("--palette", "6"), ("--palette", "-1"),
                 ("--palette", "1.5"), ("--parent", "abc"), ("--parent", "11")]
        for flag, value in cases:
            with self.subTest(flag=flag, value=value):
                proc = run_gen(SEED_TOP_ONLY, flag, value)
                self.assertNotEqual(proc.returncode, 0,
                                    "an out-of-range option must not build a "
                                    "deck from a silently coerced value")
                self.assertEqual(proc.stdout.strip(), "",
                                 "a rejection writes nothing to stdout")
                self.assertIn("usage: " + flag, proc.stderr,
                              "the message must name the flag the user "
                              "mistyped, not the seed")
                for code in CODES:
                    self.assertNotIn(
                        code, proc.stderr,
                        "a usage error must carry no enum code: the enum is "
                        "closed and describes seeds, not flag spellings")

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
        the real guard - for LITERALLY QUOTED targets, which is the whole of
        the accidental-regression case this test exists for: an added
        `require("node:https")` or `require('net')`, in either quote style,
        with extra whitespace or split across a newline, fails here, as do
        `import('node:https')`, bare `fetch(`, `globalThis['fetch']`,
        `child_process`, `worker_threads`, and `const M = 'node:https';
        require(M)`.

        What it does NOT catch, measured rather than assumed: a template
        literal ``require(`https`)``, string concatenation
        `require('ht' + 'tps')`, `process.binding('tcp_wrap')`, and aliasing
        `require` itself.  All four need deliberate obfuscation, and a source
        scan is the wrong tool against an author who wants past it - so this
        is a regression guard, not a sandbox.
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
            with self.subTest(banned=banned):
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
            with self.subTest(legend_demo_field=field):
                self.assertIn(field, d["spec"])
        self.assertGreater(d["R"], 0)
        for key in ("cy", "y_note", "y_num"):
            with self.subTest(float_key=key):
                self.assertIsInstance(d[key], float)
        self.assertFalse(d["has_bottom"])
        self.assertTrue(self.bottom["has_bottom"])
        self.assertEqual(d["grad"], (d["col_root"], d["col_tone"]))
        # spec: the _geom block plus one integer-keyed field tuple each.
        self.assertIn("_geom", d["spec"])
        for key, value in d["spec"].items():
            if key == "_geom":
                continue
            with self.subTest(spec_key=key):
                self.assertIsInstance(key, int)
                self.assertEqual(len(value), 6)
        # `ext` and `rim_num_out` are the two keys that are NOT radii feeding
        # pan(): `ext` sets R in the adapter (a missing one used to default to
        # 1.0 and blow the diagram off the card) and `rim_num_out` is a branch
        # in draw_pan.  They belong in this list for exactly that reason.
        for key in ("rim", "inner", "bottom", "r_ding", "ding_dy", "r_note",
                    "r_bnote", "inner_ring", "f_ding", "f_note", "f_bnote",
                    "f_num", "n_in", "n_out", "ext", "rim_num_out"):
            with self.subTest(geom_key=key):
                self.assertIn(key, d["spec"]["_geom"],
                              "pan() yields NaN for a missing geom key")
                self.assertIn(key, self.bottom["spec"]["_geom"])
        self.assertIsInstance(d["degrees"], dict)
        for pc in d["degrees"]:
            with self.subTest(degree_pc=pc):
                self.assertIsInstance(pc, int)
                self.assertIn(pc, range(12))
        for chord in d["chords"]:
            main, sup, subtitle, fields, roots = chord
            with self.subTest(chord=main + sup):
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

    def test_a_warning_survives_the_adapter_and_reaches_the_title_blurb(self):
        """A NO_THIRDS pan must SAY so on paper, not only in the app.

        The adapter used to drop `deck.warnings`, so a scale the engine had
        flagged printed with no indication anywhere on the sheets - the app
        showed the warning and the deck built from the same seed did not.
        Two halves, both load-bearing: the key is carried onto the deck dict,
        and `_blurb` puts the engine's own reason string on the title card.
        """
        payload = generate(SEED_NO_THIRDS)
        warnings = payload["deck"]["warnings"]
        self.assertEqual([w["code"] for w in warnings], ["NO_THIRDS"],
                         "this seed is only useful while it still warns")
        deck = decks.from_generated(payload)
        self.assertEqual(deck["warnings"], warnings,
                         "the adapter is not where a warning goes to die")
        self.assertIn(
            warnings[0]["reason"].upper(), deck["blurb"],
            "the engine's own reason string, verbatim and upper-cased, "
            "belongs on the title card - a warning nobody prints is lost")
        # Not vacuous the other way: an unwarned deck prints no warning line.
        # Assert on the LINE, not on the blurb's length - two blurbs are only
        # comparable by length while both seeds happen to be top-only.
        quiet = decks.from_generated(generate(SEED_TOP_ONLY))
        self.assertEqual(quiet["warnings"], [])
        self.assertNotIn(warnings[0]["reason"].upper(), quiet["blurb"],
                         "a deck the engine did not flag must not print a "
                         "warning line it never earned")
        # And the unwarned blurb is pinned WHOLE, against SEED_TOP_ONLY's own
        # text rather than against the other deck's line count.  `assertNotIn`
        # above catches a leak of THIS warning's string; it cannot see a line
        # the unwarned path grows for some other reason, and neither could the
        # cross-deck length delta this replaced (which was also fragile: two
        # blurbs are only comparable by length while both seeds are top-only).
        # SEED_TOP_ONLY is "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4" - ding, then the
        # eight tonefields, then the deck size.  No bottom shell, so no
        # "BOTTOM:" line; no warnings, so nothing after the count line.
        # The count is the LITERAL CHORDS_TOP_ONLY, not len(quiet["chords"]):
        # see that constant for why deriving it made the pin unkillable.
        self.assertEqual(len(quiet["chords"]), CHORDS_TOP_ONLY)
        self.assertEqual(
            quiet["blurb"],
            ["D3  |  A3  Bb3  C4  D4  E4  F4  G4  A4",
             "49 CHORDS - ONE CARD PER CHORD"],
            "an unwarned title card prints its notes and its deck size and "
            "nothing else - no extra line may appear on the quiet path")

    def small_labels_deck(self):
        """SEED_TOP_ONLY's real payload plus the warning a crowded pan earns.

        The parser refuses a crowded pan until G2b, so no seed reaches
        SMALL_LABELS through gen_deck.js; select.test.js proves the engine
        produces it, and this appends the same shape to a real payload.
        """
        reason = subprocess.run(
            ["node", "-e",
             "const {loadEngine}=require('./tools/engine_loader.js');"
             "process.stdout.write(loadEngine(['core']).core.REASONS"
             ".SMALL_LABELS.reason.split('<N>').join('3.4'))"],
            capture_output=True, text=True, cwd=paths.ROOT, timeout=120,
            check=True).stdout
        payload = generate(SEED_TOP_ONLY)
        payload["deck"]["warnings"] = list(payload["deck"].get("warnings") or []) + [
            {"code": "SMALL_LABELS", "reason": reason}]
        return decks.from_generated(payload), reason

    def test_a_small_labels_warning_prints_the_short_line_on_the_title_card(self):
        deck, reason = self.small_labels_deck()
        short = "CROWDED PAN: SMALL LABELS"
        self.assertEqual(deck["blurb"].count(short), 1)
        for line in deck["blurb"]:
            self.assertNotIn("3.6 PT", line)
            self.assertNotEqual(line, reason.upper())
        with tempfile.TemporaryDirectory(prefix="handpan-gen-") as tmp:
            out = os.path.join(tmp, "small_labels.pdf")
            hifi.build(out, deck)
            with pymupdf.open(out) as doc:
                text = "".join(page.get_text() for page in doc)
        self.assertEqual("".join(text.split()).count("".join(short.split())), 1,
                         "the short line reaches the printed title card once")

    def test_no_warning_line_on_the_title_card_is_wider_than_the_card(self):
        small, _reason = self.small_labels_deck()
        no_thirds = decks.from_generated(generate(SEED_NO_THIRDS))
        for label, deck in (("SMALL_LABELS", small), ("NO_THIRDS", no_thirds)):
            for w in deck["warnings"]:
                line = decks.TITLE_WARNINGS.get(w["code"], w["reason"].upper())
                self.assertIn(line, deck["blurb"])
                width = hifi.tw(line, "Label", 4.2, 0.35)
                with self.subTest(warning=label):
                    self.assertLessEqual(width, hifi.CW - 24,
                                         "%s line is %.1f pt" % (label, width))

    def test_the_adapter_leaves_the_builtin_decks_untouched(self):
        """ADDITIVE only: validate.py check 1 pins decks.py to the app JSON."""
        for deck in (decks.HIJAZ, decks.PYGMY, decks.AMARA):
            with self.subTest(deck=deck["name"]):
                self.assertNotIn("options", deck)
                self.assertNotIn("warnings", deck)
        self.assertEqual(decks.HIJAZ["name"], "C# HIJAZ 9")
        # 2026-09-16 (engine adoption): 18->19, 27->52, 16->25.
        # 2026-10-07 (size cap removed, Lane U2): Pygmy 52->53, Amara 25->27.
        self.assertEqual(len(decks.HIJAZ["chords"]), 19)
        self.assertEqual(len(decks.PYGMY["chords"]), 53)
        self.assertEqual(len(decks.AMARA["chords"]), 27)


# sha256 of json.dumps(chords, sort_keys=True, separators=(",", ":")) for the
# chord lists of golden_decks_v5.json, the corpus before the size cap came off
# (2026-10-07, Lane U2). Pinned here because the fixture itself moved on.
OLD_AMARA_CHORDS_SHA256 = ("6a7f861e236169672d2400280f20f7adddbc81cb71f95f168b38"
                           "3032b084ac82")
OLD_PYGMY_CHORDS_SHA256 = ("db3cd398ce1a96691d99852ebc3c61122cfabf4df7a6f24fef36"
                           "6c9f9e81a235")
AMARA_MAKER = "(D3) A3 C4 D4 E4 F4 G4 A4 C5"
PYGMY_MAKER = ("[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4"
               " C5 Eb5 F5 G5 [Ab5]")
PYGMY_LEGACY_MAKER = ("(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5"
                      " | C3 Db3 Eb3 Bb3 Db4 Ab5")


def chords_digest(chords):
    return hashlib.sha256(json.dumps(chords, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def canonical_deck(deck_id):
    return next(d for d in paths.canonical_decks() if d["id"] == deck_id)


class MirrorFlagsTest(unittest.TestCase):
    """Lane S2 (plan 20.5, AM-3, AM-9): one flag per shell, and --mirror is both."""

    def angles(self, *flags):
        fields = generate(PYGMY_MAKER, *flags)["deck"]["fields"]
        out = {"rim": [], "inner": [], "bottom": []}
        for key in sorted(fields, key=int):
            zone, angle = fields[key][3], fields[key][4]
            if zone in out:
                out[zone].append(angle)
        return out

    @staticmethod
    def reflect(angles):
        return [round((180 - a) % 360, 1) for a in angles]

    def test_mirror_top_alone_reflects_the_top_shell_and_not_the_bottom(self):
        base, got = self.angles(), self.angles("--mirror-top")
        self.assertEqual(got["rim"], self.reflect(base["rim"]))
        self.assertEqual(got["inner"], self.reflect(base["inner"]))
        self.assertEqual(got["bottom"], base["bottom"])

    def test_mirror_bottom_alone_reflects_the_bottom_and_not_the_top(self):
        base, got = self.angles(), self.angles("--mirror-bottom")
        self.assertEqual(got["rim"], base["rim"])
        self.assertEqual(got["inner"], base["inner"])
        self.assertEqual(got["bottom"], self.reflect(base["bottom"]))

    def test_mirror_equals_both_flags_in_either_order(self):
        both = self.angles("--mirror")
        self.assertEqual(both, self.angles("--mirror-top", "--mirror-bottom"))
        self.assertEqual(both, self.angles("--mirror-bottom", "--mirror-top"))
        base = self.angles()
        self.assertEqual(both["rim"], self.reflect(base["rim"]))
        self.assertEqual(both["bottom"], self.reflect(base["bottom"]))

    def test_anchor_between_reaches_the_deck_options(self):
        deck = generate(PYGMY_MAKER, "--anchor", "between")["deck"]
        self.assertEqual(deck["options"]["anchor"], "between")
        self.assertEqual(generate(PYGMY_MAKER)["deck"]["options"]["anchor"], "one")
        self.assertNotEqual(run_gen(PYGMY_MAKER, "--anchor", "centre").returncode, 0)


class UncappedBuiltinsTest(unittest.TestCase):
    """Lane U2: Amara 9 and Pygmy hold what the uncapped engine generates."""

    def test_amara_9_chords_equal_a_fresh_engine_run(self):
        run = generate(AMARA_MAKER)["deck"]
        fresh = run["chords"]
        got = canonical_deck("amara")["chords"]
        self.assertEqual(got, fresh)
        shipped = canonical_deck("amara")["fields"]
        self.assertEqual({k: v[4] for k, v in run["fields"].items() if k in shipped},
                         {k: v[4] for k, v in shipped.items()},
                         "the default seats are the shipped Amara 9 seats")
        self.assertEqual(len(got), 27)
        kept = [c for c in got if (c["main"], c["sup"]) not in
                (("F", "add9"), ("C", "add9"))]
        self.assertEqual(len(kept), 25)
        self.assertEqual(chords_digest(kept), OLD_AMARA_CHORDS_SHA256,
                         "the other 25 Amara cards moved")

    def test_pygmy_chords_equal_a_fresh_engine_run(self):
        fresh = generate(PYGMY_MAKER)["deck"]["chords"]
        got = canonical_deck("pygmy")["chords"]
        self.assertEqual(got, fresh)
        self.assertEqual(len(got), 53)
        self.assertEqual((got[5]["main"], got[5]["sup"], got[5]["fields"]),
                         ("Fm", "add9", [5, 7, 8, 6]))
        self.assertEqual((got[6]["main"], got[6]["sup"], got[6]["fields"]),
                         ("Fm", "9", [5, 7, 8, 9, 6]))
        old = [dict(c) for i, c in enumerate(got) if i != 5]
        old[5] = dict(old[5], fields=[5, 7, 8, 9, 11])
        self.assertEqual(chords_digest(old), OLD_PYGMY_CHORDS_SHA256,
                         "a Pygmy card other than Fmadd9 and Fm9 moved")


class EngineAdoptedBuiltinsTest(unittest.TestCase):
    """Lane B: kurd and amara10 are engine output, never hand-edited."""

    MAKERS = {
        "kurd": ("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "D KURD 10"),
        "amara10": ("(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5", "D AMARA 10"),
    }

    def test_engine_adopted_builtins_equal_a_fresh_engine_run(self):
        for deck_id, (maker, name) in self.MAKERS.items():
            with self.subTest(deck=deck_id):
                fresh = generate(maker, "--name", name)["deck"]
                got = canonical_deck(deck_id)
                self.assertEqual(got["fields"], fresh["fields"])
                self.assertEqual(got["chords"], fresh["chords"])
                self.assertEqual(got["degrees"], fresh["degrees"])
                self.assertEqual(got["geom"],
                                 {k: v for k, v in fresh["geom"].items()
                                  if k != "ext"})
                self.assertEqual(got["name"], name)


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

    def test_a_no_thirds_warning_reaches_the_CHORD_ONLY_chord_cards(self):
        """Owner decision 2026-09-15 (queue row 113): the warning goes on the
        CARDS, not only on the title card.

        CHORD_ONLY omits the title and legend cards, so a warning that lives
        only in `_blurb` is dropped by exactly the file the print shop gets.
        The oracle is the CHORD_ONLY text, which contains chord cards only.
        """
        tmp = os.path.join(self.tmp, "no_thirds_print.pdf")
        deck = decks.from_generated(generate(SEED_NO_THIRDS))
        self.assertTrue(deck["warnings"], "this seed is only useful while it warns")
        hifi.build(tmp, deck, chords_only=True)
        squeezed = "".join(self.text_of(tmp)[0].split())
        self.assertIn("NO3RDSONTHISPAN", squeezed,
                      "the print shop's file must carry the warning too")

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
