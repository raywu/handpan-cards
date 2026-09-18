# README refresh plan

> **For agentic workers:** one lane, one branch, one PR. TDD applies in the
> only form a prose file admits: the assertions this README makes about the
> repo are checked by a test before the prose is rewritten.

**Goal:** bring `README.md` back in line with the repo as it actually is on
2026-09-18, and leave behind a check that catches the next drift instead of
another manual audit.

**Architecture:** the README's stale claims are all COUNTS and CAPABILITIES
that some machine-readable file already knows (`data/decks.json`, the engine
module list, the test file list). Task 1 adds a test that reads those files and
asserts the README agrees; Task 2 rewrites the prose until that test is green.
The order is deliberate - the test is written against the TRUE values, so it is
red against today's README and its failure message is the edit list.

**Tech Stack:** Python `unittest` (the README check joins the existing python
suites, which already run on every CI job and need no browser).

**Spec:** this file. The owner's instruction was "the current readme is out of
date"; queue row 92 of `docs/plans/2026-09-16-remaining-work-coordination.md`
records it.

## Global Constraints

- `index.html` stays a single self-contained file; nothing here touches it.
- Do not alter deck data or diagram geometry.
- No new dependencies; there is still no `package.json`.
- `tests/suite_health.py` `FLOORS` has one row per test file - a new test file
  needs a new row, and a lane raises only its own row.
- Every new test group needs a mutant in `tests/mutants/` that it kills, or the
  mutation gate is not evidence for it. Mutant patches carry `# kills:` and
  `# suite:` headers and no `index <hex>..<hex>` line.
- `tests/CONTRACT.md` is binding for how tests are added.

---

## What is actually stale

Measured on `main` at 2026-09-18, not remembered:

| README claim | Reality |
|---|---|
| "Decks included: C# Hijaz 9 ... D Amara 9. **59 cards total**" | 96 cards: Hijaz 19, Pygmy 52, Amara 25 (`data/decks.json`) |
| "all **59 cards** are compared" (tests section) | same 96 |
| "Generated decks live for the **session only**" | they persist in `localStorage` under `SCALES_KEY` (`index.html:3665`) |
| "sharing them by URL is **a later phase**" | shipped: `SHARE_PREFIX` routing at `index.html:5118`, `src/engine/share.js`, `tests/share.test.js` |
| scale sheet described as "+ ADD ... GENERATE CARDS" only | the sheet is a routed page (`#add` / `#edit/<id>`), supports EDIT and DELETE (with a two-tap confirmation), names and scale-degree labels |
| Tests section lists 5 groups | there are 11 node suites (`core`, `voicing`, `layout`, `naming`, `select`, `share`, `preview`, `app`, `e2e`, `mutation_harness`) and 7 python suites, plus a suite-health floor check |
| "**every test group** ships a patch that must make it fail" | 311 mutant patches, and the gate is all-or-nothing |
| no mention of the scale engine at all | `src/engine/` is six modules with its own spec (`docs/ENGINE-SPEC.md`) and plan (`docs/SCALE_ENGINE_PLAN.md`) |

The engine-region and `const DECKS` sync-step paragraphs, the Pages hosting
section, the layout notes and the follow-up prompt are all still accurate and
should survive the rewrite largely untouched.

## File Structure

- Create: `tests/test_readme_currency.py` - the drift check.
- Create: `tests/mutants/m_readme_count_unchecked.patch` - the mutant.
- Modify: `README.md` - the rewrite.
- Modify: `tests/suite_health.py` - one new `FLOORS` row.

---

### Task 1: the drift check

**Files:**
- Create: `tests/test_readme_currency.py`
- Modify: `tests/suite_health.py` (add `"tests/test_readme_currency.py": 4`)

**Interfaces:**
- Consumes: `tests/paths.py` - `ROOT` (a str, not a Path) and `canonical_decks()`, which the existing python suites already use.
- Produces: nothing other suites read.

- [ ] **Step 1: write the failing test.** Four cases, each asserting against a
      value READ from the repo, never a literal repeated in the test:

```python
import glob, json, os, re, unittest
from tests.paths import ROOT, canonical_decks

README = open(os.path.join(ROOT, "README.md"), encoding="utf-8").read()

class ReadmeCurrencyTest(unittest.TestCase):
    def test_total_card_count_matches_the_deck_data(self):
        decks = canonical_decks()
        total = sum(len(d["chords"]) for d in decks)
        found = {int(n) for n in re.findall(r"\b(\d{2,4}) cards\b", README)}
        self.assertTrue(found, "README no longer states a card count")
        self.assertEqual(found, {total},
            f"README says {sorted(found)} cards; data/decks.json has {total}")

    def test_every_deck_is_named_with_its_own_chord_count(self):
        decks = canonical_decks()
        for d in decks:
            self.assertIn(d["name"], README,
                f"deck {d['id']} is not named in the README")

    def test_every_engine_module_is_mentioned(self):
        mods = sorted(os.path.basename(p)[:-3]
                      for p in glob.glob(os.path.join(ROOT, "src", "engine", "*.js")))
        missing = [m for m in mods if m not in README]
        self.assertEqual(missing, [],
            f"engine modules absent from the README: {missing}")

    def test_the_mutant_count_is_not_overstated(self):
        n = len(glob.glob(os.path.join(ROOT, "tests", "mutants", "*.patch")))
        found = {int(x) for x in re.findall(r"\b(\d{2,4}) mutant", README)}
        self.assertTrue(found, "README no longer states a mutant count")
        self.assertEqual(found, {n},
            f"README says {sorted(found)} mutants; there are {n}")
```

- [ ] **Step 2: run it and watch it fail.**
      `python3 -m unittest tests.test_readme_currency -v`
      Expected: `test_total_card_count_matches_the_deck_data` fails with
      `README says [59] cards; data/decks.json has 96`, and the engine and
      mutant cases fail because the README mentions neither.

- [ ] **Step 3: raise the suite-health floor.** Add
      `"tests/test_readme_currency.py": 4,` to `FLOORS` in
      `tests/suite_health.py`, in the python block.

- [ ] **Step 4: commit.** The check lands red-against-the-prose but the suite
      is not green yet, so commit Task 1 and Task 2 together at the end of
      Task 2 rather than pushing a red tree.

### Task 2: the rewrite

**Files:**
- Modify: `README.md`
- Create: `tests/mutants/m_readme_count_unchecked.patch`

- [ ] **Step 1: rewrite the stale sections.** Working from the staleness table
      above, in place, keeping the file's existing voice and section order:
      the deck line and both card counts; the scale-sheet paragraph (routed
      page, edit, delete-with-confirmation, persistence, share URLs); a short
      new paragraph on `src/engine/` naming all six modules and pointing at
      `docs/ENGINE-SPEC.md`; the tests section's coverage list and mutant
      count. Leave the sync-step, hosting, layout-notes and follow-up-prompt
      sections alone except where a count appears in them.

- [ ] **Step 2: run the check.**
      `python3 -m unittest tests.test_readme_currency -v` - expected: 4 pass.

- [ ] **Step 3: write the mutant.** Gut the card-count assertion so a stale
      README scores green, cut with `git diff` and no `index` line. The
      filename prefix is a reading convention only (`tests/CONTRACT.md:30` -
      the `# suite:` header is the sole mechanism); `r_` is already taken by
      the render-agreement mutants, and `m_` is unused today:

      `# kills: total card count matches the deck data`
      `# suite: python3 -m unittest tests.test_readme_currency -v`

      The body replaces the `assertEqual(found, {total})` with `pass`.

- [ ] **Step 4: verify the mutant is killed.**
      `git apply <patch> && python3 -m unittest tests.test_readme_currency`
      must fail; `git apply -R <patch>` to revert. Then the full gate:
      `./tests/run.sh mutants` - expected `312/312 mutants killed` and
      `MUTATION GATE PASSED`, run with no other suite concurrent (the gate
      mutates the working tree in place).

- [ ] **Step 5: full suite, then commit.**
      `./tests/run.sh` - python, node and the gate.
      Commit `README.md`, the test, the mutant and the `FLOORS` row together.

- [ ] **Step 6: push, open a PR, and let CI be the evidence.** The local run is
      a smoke test; the required checks at the final pushed commit are what
      counts. Then a fresh reviewer at the verified head SHA before merge.

## Non-goals

- No change to `index.html`, `data/decks.json`, `tools/`, or any PDF.
- No new README sections beyond the engine paragraph - this is a correction,
  not an expansion, and the roadmap prompt at the foot stays as it is.
- Not a docs reorganisation: `CLAUDE.md`, `docs/ENGINE-SPEC.md` and the plans
  under `docs/plans/` are already current and are out of scope.
- The check asserts COUNTS AND NAMES, not prose quality. It cannot tell that a
  paragraph describes the wrong feature, only that a number or a module name
  went stale; that limit is deliberate, and the alternative (asserting on
  sentences) would fail on every wording change.

## Self-review

- Spec coverage: every row of the staleness table maps to Task 2 step 1;
  the four automated cases cover the two count rows, the deck-name row and the
  engine row. The scale-sheet and tests-section rows are prose-only and are
  NOT machine-checked - stated as a non-goal above rather than left implied.
- Placeholders: none; the test body is the actual code to paste.
- Type consistency: `tests/paths.py` exports `ROOT` as a plain string and a
  `canonical_decks()` helper; the test body above uses `os.path.join` and that
  helper rather than `pathlib`, matching the existing python suites.
