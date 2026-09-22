"""The browser deck adapter against the print one, key for key.

`hifi`'s card builders read about twenty deck keys the scale engine knows
nothing about, and `decks.from_generated` is what synthesises them. The browser
emitter needs the same twenty, so `src/engine/pdfdeck.js` is a port - and a port
is only worth having if something proves it is still a port. That is this file:
every payload goes through both adapters and every key is compared.

The comparison runs over the three built-in scale strings plus every buildable
string in tests/fixtures/synthetic_scales.json, because the keys most likely to
drift are the ones that count zones (`sub`, `legend_lines`) or divide by the
solver's reach (`R`), and those only move on pans unlike the built-ins.
"""
import json
import os
import shutil
import subprocess
import sys
import unittest

from tests import paths

sys.path.insert(0, paths.TOOLS)

import decks  # noqa: E402

GEN_DECK = os.path.join(paths.TOOLS, "gen_deck.js")
ADAPT = os.path.join(paths.TOOLS, "pdf_adapt.js")
NODE = shutil.which("node") or "node"

BUILTIN_SEEDS = [
    "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
    "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5",
    "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
]


def _seeds():
    with open(os.path.join(paths.ROOT, "tests", "fixtures",
                           "synthetic_scales.json"), encoding="utf-8") as fh:
        rows = json.load(fh)
    out = list(BUILTIN_SEEDS)
    for row in rows:
        if row.get("expect", {}).get("ok") and row["string"] not in out:
            out.append(row["string"])
    return out


def _generate(seed):
    proc = subprocess.run([NODE, GEN_DECK, seed], capture_output=True,
                          text=True, cwd=paths.ROOT, timeout=120)
    if proc.returncode != 0:
        return None
    return json.loads(proc.stdout)


def _js_adapt(payload):
    proc = subprocess.run([NODE, ADAPT], input=json.dumps(payload), text=True,
                          capture_output=True, cwd=paths.ROOT, timeout=120)
    if proc.returncode != 0:
        raise AssertionError("pdf_adapt.js failed: %s" % proc.stderr.strip())
    return json.loads(proc.stdout)


def _plain(value):
    """A Python deck value in the shape JSON can carry, so the two compare.

    Only representation is normalised here - tuples become lists, a reportlab
    Color becomes its three components, a set of root ids becomes a sorted
    list, int keys become the strings a JSON object has. Nothing is rounded and
    nothing is dropped, so a real disagreement still fails.
    """
    if isinstance(value, decks.Color):
        return [value.red, value.green, value.blue]
    if isinstance(value, (set, frozenset)):
        return sorted(value)
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    return value


def _same(case, got, want, where):
    if isinstance(want, float) and isinstance(got, (int, float)):
        case.assertAlmostEqual(got, want, places=6, msg=where)
    elif isinstance(want, list):
        case.assertEqual(len(got), len(want), where + " length")
        for i, (g, w) in enumerate(zip(got, want)):
            _same(case, g, w, "%s[%d]" % (where, i))
    elif isinstance(want, dict):
        case.assertEqual(sorted(got), sorted(want), where + " keys")
        for k in want:
            _same(case, got[k], want[k], "%s.%s" % (where, k))
    else:
        case.assertEqual(got, want, where)


class AdapterParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payloads = []
        for seed in _seeds():
            payload = _generate(seed)
            if payload is not None:
                cls.payloads.append((seed, payload))

    def test_the_sweep_actually_ran(self):
        # `for payload in []: ...` is a passing parity test that proves
        # nothing, and a gen_deck.js that started rejecting every seed would
        # produce exactly that.
        self.assertGreaterEqual(len(self.payloads), len(BUILTIN_SEEDS))
        self.assertGreaterEqual(len(self.payloads), 10)

    def test_every_key_matches_the_python_adapter(self):
        for seed, payload in self.payloads:
            want = _plain(decks.from_generated(payload))
            got = _js_adapt(payload)
            with self.subTest(seed=seed):
                self.assertEqual(sorted(got), sorted(want), "key set drift")
                for key in sorted(want):
                    _same(self, got[key], want[key], key)

    def test_blank_cards_is_absent_on_both_sides(self):
        # decks.GENERATED_OMITTED's whole content: a generated deck asks for no
        # write-your-own padding, and a port that helpfully added some would
        # change the page count of every shop sheet.
        self.assertIn("blank_cards", decks.GENERATED_OMITTED)
        for _seed, payload in self.payloads[:1]:
            self.assertNotIn("blank_cards", _js_adapt(payload))

    def test_R_uses_bankers_rounding_like_python(self):
        # Python round() breaks a tie to the even digit; Math.round is half-up.
        # 1.05 -> 1.0 and 1.15 -> 1.2 under banker's, and a port using
        # Math.round gets 1.1 and 1.2. Asserted through the module itself so
        # the mutant in tests/mutants can flip it.
        script = ('const {loadEngine} = require("./tools/engine_loader.js");'
                  'const H = loadEngine(["pdfdeck"]);'
                  'console.log(JSON.stringify([H.pdfdeck.bankers(1.05,1),'
                  'H.pdfdeck.bankers(1.15,1),H.pdfdeck.bankers(2.5,0),'
                  'H.pdfdeck.bankers(3.5,0)]));')
        out = subprocess.run([NODE, "-e", script], capture_output=True,
                             text=True, cwd=paths.ROOT, check=True)
        self.assertEqual(json.loads(out.stdout),
                         [round(1.05, 1), round(1.15, 1), round(2.5), round(3.5)])


if __name__ == "__main__":
    unittest.main()
