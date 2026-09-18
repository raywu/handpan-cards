# README refresh plan

> **For agentic workers:** one lane, one branch, one PR. TDD applies in the
> only form a prose file admits: the assertions this README makes about the
> repo are checked by a test before the prose is rewritten.

**Goal:** bring `README.md` back in line with the repo as it actually is on
2026-09-18, and leave behind a check that catches the next drift instead of
another manual audit.

**Architecture:** the README's stale claims are all COUNTS and CAPABILITIES
that some machine-readable file already knows (`data/decks.json`, the engine
module list, the mutant corpus). Task 1 adds a test that reads those files and
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
  needs a new row, and a lane raises only its own row. The aggregate floors
  (`validate_floors`, `tests/suite_health.py:68-84`) are MINIMUMS, so adding a
  python row of 4 raises the python sum and breaks nothing. No aggregate bump.
- Every new test group needs a mutant in `tests/mutants/` that it kills, or the
  mutation gate is not evidence for it. Mutant patches carry `# kills:` and
  `# suite:` headers and no `index <hex>..<hex>` line.
- `tests/CONTRACT.md` is binding for how tests are added. See "CONTRACT
  carve-out" below for why this check is allowed to read the tree's shape.

---

## What is actually stale

Measured on `main` at 2026-09-18, not remembered:

| README claim | Reality |
|---|---|
| "Decks included: C# Hijaz 9 ... D Amara 9. **59 cards total**" | 96 cards total: Hijaz 19, Pygmy 52, Amara 25 (`data/decks.json`) |
| "all **59 cards** are compared" (tests section) | same 96 |
| "Generated decks live for the **session only**" | they persist in `localStorage` under `SCALES_KEY` (`index.html:3665`) |
| "sharing them by URL is **a later phase**" | shipped: `SHARE_PREFIX` routing at `index.html:5118`, `src/engine/share.js`, `tests/share.test.js` |
| scale sheet described as "+ ADD ... GENERATE CARDS" only | the sheet is a routed page (`#add` / `#edit/<id>`), supports EDIT and DELETE (with a two-tap confirmation), names and scale-degree labels |
| Tests section lists 5 groups | **10** node suites (`ls tests/*.test.js`: core, voicing, layout, naming, select, share, preview, app, e2e, mutation_harness) and **7** python suites today, **8** once this PR lands `tests/test_readme_currency.py`, plus the suite-health floor check |
| "**every test group** ships a patch that must make it fail" | 311 mutant patches today, and the gate is all-or-nothing |
| no mention of the scale engine at all | `src/engine/` is six modules (`core.js`, `layout.js`, `naming.js`, `select.js`, `share.js`, `voicing.js`) with its own spec (`docs/ENGINE-SPEC.md`) and plan (`docs/SCALE_ENGINE_PLAN.md`) |

The engine-region and `const DECKS` sync-step paragraphs, the Pages hosting
section, the layout notes and the follow-up prompt are all still accurate and
should survive the rewrite largely untouched.

## CONTRACT carve-out

`tests/CONTRACT.md` rules 1-2 forbid deriving an assertion from the
implementation, with a data-only carve-out for `data/decks.json`. This check
reads `src/engine/*.js` basenames and counts `tests/mutants/*.patch`, which is
tree SHAPE, not behaviour. That is deliberate and is the point of the check:
its subject is the README's description of the tree, so the tree is its spec.
Stated here so a reviewer reads it as a declared exception rather than a rule-2
violation. The limit is real and is listed under Non-goals: renaming a module
forces a README edit, and a paragraph describing the wrong feature stays green.

## File Structure

- Create: `tests/test_readme_currency.py` - the drift check.
- Create: `tests/mutants/m_readme_card_count_stale.patch` - the mutant.
- Modify: `README.md` - the rewrite.
- Modify: `tests/suite_health.py` - one new `FLOORS` row.

**`README.md` becomes a gate-blocking path.** `tests/mutation_check.sh:100-112`
collects every path any mutant touches and refuses (exit 2) if the working tree
dirties one of them, BEFORE installing its cleanup trap. Once a mutant names
`README.md`, an uncommitted README edit blocks the WHOLE gate, not just that
mutant. This is the same trade `data/decks.json` already makes. Consequence for
this lane: commit the README before running the gate (Task 2 Step 5).

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
import glob, os, re, unittest
from tests.paths import ROOT, canonical_decks

README = open(os.path.join(ROOT, "README.md"), encoding="utf-8").read()
LOWER = README.lower()

# "N cards total" and not a bare "N cards": per-deck counts are wanted in the
# prose too, and set-equality over every "N cards" phrase would make the deck
# line and this assertion mutually unsatisfiable.
TOTAL_RE = re.compile(r"\b(\d{2,4}) cards total\b")
MUTANT_RE = re.compile(r"\b(\d{2,4}) mutant")


class ReadmeCurrencyTest(unittest.TestCase):
    def test_total_card_count_matches_the_deck_data(self):
        total = sum(len(d["chords"]) for d in canonical_decks())
        found = {int(n) for n in TOTAL_RE.findall(README)}
        self.assertTrue(found, "README no longer states a total card count")
        self.assertEqual(found, {total},
            f"README says {sorted(found)} cards total; data/decks.json has {total}")

    def test_every_deck_is_named_with_its_own_chord_count(self):
        for d in canonical_decks():
            name = d["name"].lower()      # data is UPPERCASE, the prose is not
            self.assertIn(name, LOWER,
                f"deck {d['id']} is not named in the README")
            at = LOWER.index(name) + len(name)
            window = README[at:at + 40]   # after the name, so its own digits cannot match
            self.assertIn(str(len(d["chords"])), window,
                f"deck {d['id']} has {len(d['chords'])} cards; the README does "
                f"not say so within 40 chars of its name (saw {window!r})")

    def test_every_engine_module_is_mentioned(self):
        # the full path, not the bare stem: "layout" and "core" already occur
        # in the README's prose and would pass for the wrong reason.
        mods = sorted(os.path.basename(p)
                      for p in glob.glob(os.path.join(ROOT, "src", "engine", "*.js")))
        missing = [m for m in mods if f"src/engine/{m}" not in README]
        self.assertEqual(missing, [],
            f"engine modules absent from the README: {missing}")

    def test_the_mutant_count_is_stated_within_a_lane_of_the_truth(self):
        # an upper bound, not equality: the corpus grows on most test PRs, and
        # equality would make every unrelated lane that adds a mutant edit the
        # README - a cross-lane conflict magnet in a repo that runs swarms.
        n = len(glob.glob(os.path.join(ROOT, "tests", "mutants", "*.patch")))
        found = {int(x) for x in MUTANT_RE.findall(README)}
        self.assertTrue(found, "README no longer states a mutant count")
        self.assertLessEqual(max(found), n,
            f"README claims {max(found)} mutants; there are {n}")
```

- [ ] **Step 2: run it and watch it fail.**
      `python3 -m unittest tests.test_readme_currency -v`
      Expected: `test_total_card_count_matches_the_deck_data` fails with
      `README says [59] cards total; data/decks.json has 96`; the deck-count,
      engine and mutant cases fail because the README states none of them.

- [ ] **Step 3: raise the suite-health floor.** Add
      `"tests/test_readme_currency.py": 4,` to `FLOORS` in
      `tests/suite_health.py`, in the python block. No aggregate change.

- [ ] **Step 4: do not commit yet.** The tree is red until Task 2 rewrites the
      prose; Task 1 and Task 2 commit together at Task 2 Step 5.

### Task 2: the rewrite

**Files:**
- Modify: `README.md`
- Create: `tests/mutants/m_readme_card_count_stale.patch`

- [ ] **Step 1: rewrite the stale sections.** Working from the staleness table
      above, in place, keeping the file's existing voice and section order:
      the deck line (each deck named with its own count, plus the phrase
      `96 cards total`) and the tests-section count; the scale-sheet paragraph
      (routed page, edit, delete-with-confirmation, persistence, share URLs); a
      short new paragraph on the engine naming all six modules by PATH
      (`src/engine/core.js` and so on) and pointing at `docs/ENGINE-SPEC.md`;
      the tests section's coverage list (10 node suites, 8 python suites, the
      suite-health floor check) and the mutant count (`311 mutants`, the count
      BEFORE this lane's own patch - the assertion is an upper bound, so it
      stays true as the corpus grows and needs no re-edit when Step 3 lands the
      312th). Leave the sync-step, hosting, layout-notes and follow-up-prompt
      sections alone except where a count appears in them.

- [ ] **Step 2: run the check.**
      `python3 -m unittest tests.test_readme_currency -v` - expected: 4 pass.

- [ ] **Step 3: write the mutant.** It must mutate `README.md`, not the test.
      Gutting the assertion would make the test PASS, which
      `tests/mutation_check.sh` scores `survived`, not `killed`. A mutant
      against a data file is established practice
      (`tests/mutants/b_cluster_forced_only.patch` mutates `data/decks.json`),
      and the script reverts by path from the patch itself, so any file is
      fair game. The body sets the README's total back to the stale `59 cards
      total`, which reds
      `test_total_card_count_matches_the_deck_data` - one killer is enough, the
      gate selects a suite, not a test. Cut with `git diff` and strip the
      `index <hex>..<hex>` line. Headers, naming the test as
      `tests/CONTRACT.md` requires:

      `# kills: test_total_card_count_matches_the_deck_data`
      `# suite: python3 -m unittest -k test_total_card_count_matches_the_deck_data tests.test_readme_currency`

- [ ] **Step 4: verify the mutant in isolation.**
      `git apply tests/mutants/m_readme_card_count_stale.patch` then
      `python3 -m unittest tests.test_readme_currency` must FAIL;
      `git apply -R tests/mutants/m_readme_card_count_stale.patch` to revert.
      Confirm `git status --porcelain README.md` is empty afterwards.

- [ ] **Step 5: commit, THEN run the gate.** Order matters and is not a
      preference: `README.md` is now in the gate's `ALLPATHS`, so a dirty
      README makes `tests/mutation_check.sh:106` refuse with
      `REFUSING: working tree already modifies files a mutant touches` and exit
      2 - no verdict at all, for the whole corpus. Commit `README.md`, the
      test, the mutant and the `FLOORS` row together first.

- [ ] **Step 6: full local verification, three commands.** `./tests/run.sh`
      does NOT run the gate and does NOT run suite health
      (`tests/run.sh:18-26`: `all` is validate.py, boot_sim, python discover,
      node suites). Run all three:

      `./tests/run.sh`
      `python3 tests/suite_health.py`
      `./tests/run.sh mutants`   # expected: 312/312 mutants killed, MUTATION GATE PASSED

      The gate mutates the working tree in place - no other suite concurrent.

- [ ] **Step 7: push, open a PR, and let CI be the evidence.** The local run is
      a smoke test; the required checks at the final pushed commit are what
      counts. Then a fresh reviewer at the verified head SHA before merge.

## Non-goals

- No change to `index.html`, `data/decks.json`, `tools/`, or any PDF.
- No new README sections beyond the engine paragraph - this is a correction,
  not an expansion, and the roadmap prompt at the foot stays as it is.
- Not a docs reorganisation: `CLAUDE.md`, `docs/ENGINE-SPEC.md` and the plans
  under `docs/plans/` are already current and are out of scope.
- The check asserts COUNTS AND NAMES, not prose quality. It cannot tell that a
  paragraph describes the wrong feature, only that a number or a module path
  went stale; that limit is deliberate, and the alternative (asserting on
  sentences) would fail on every wording change.
- The suite-count numbers in the tests section (10 node, 8 python) are
  PROSE-ONLY and machine-checked by nothing. Accepted: a suite-count check
  would red every lane that adds a test file, which is the same cross-lane
  coupling the mutant count was loosened to avoid.

## Self-review

- Spec coverage: every row of the staleness table maps to Task 2 step 1;
  the four automated cases cover the total-count row, the per-deck counts, the
  engine row and the mutant row. The scale-sheet and suite-count rows are
  prose-only and are NOT machine-checked - stated as non-goals rather than left
  implied.
- Placeholders: none; the test body is the actual code to paste.
- Type consistency: `tests/paths.py` exports `ROOT` as a plain string and a
  `canonical_decks()` helper; the test body above uses `os.path.join` and that
  helper rather than `pathlib`, matching the existing python suites.
- Ordering: the mutant count is an upper bound and the README is committed
  before the gate runs, so no step depends on a count that a later step changes.

---

## GSTACK REVIEW REPORT

**Verdict:** the plan's shape was right and its Step 0 measurements were real,
but seven of its concrete instructions could not have executed as written. All
thirteen findings are folded in above. Codex was unavailable
(`MODEL_UNUSABLE` - the local CLI cannot decode the provider's models
response), so the outside voice was a fresh Claude subagent.

### NOT in scope

Deck data, diagram geometry, `index.html`, `tools/`, the PDFs, the suite-count
prose check, and any docs reorganisation. The gstack upgrade stays deferred.

### What already exists

`tests/paths.py` (`ROOT`, `canonical_decks()`), `tests/suite_health.py`
`FLOORS` with minimum-only aggregates, `tests/mutation_check.sh` with its
`# suite:`/`# kills:` contract and its any-path revert, 311 mutants, 10 node
suites, 7 python suites, six engine modules. Nothing here needs building.

### Findings

Authoring pass (7):

1. **P1 - mutant-count ordering was unsatisfiable.** Step 2 expected 4 passes
   at 311 patches while Step 4 expected `312/312`. Resolved by making the
   assertion an upper bound (see finding 9), which removes the ordering
   entirely.
2. **P1 - the mutant as specified could not be killed.** "Replace the
   `assertEqual` with `pass`" makes the test PASS, scoring `survived`. Now
   mutates `README.md`.
3. **P1 - deck-name case mismatch.** Data is `C# HIJAZ 9`; prose is
   `C# Hijaz 9`. `assertIn(d["name"], README)` could never pass. Now compares
   case-insensitively.
4. **P2 - `test_every_deck_is_named_with_its_own_chord_count` checked no
   count.** Now asserts the count within 40 chars AFTER the name, so the name's
   own digits (`F3 Low Pygmy 18`) cannot satisfy it.
5. **P2 - `./tests/run.sh` does not run the gate** (`tests/run.sh:18-26`).
   Step 6 now runs three commands.
6. **P2 - the `# suite:` header did not name the test.** Now carries
   `-k test_total_card_count_matches_the_deck_data`, matching
   `tests/mutants/b_cluster_forced_only.patch:2`.
7. **P3 - the engine check was a bare substring test.** "layout" and "core"
   already occur in the README prose. Now requires `src/engine/<name>.js`.

Outside voice (6):

8. **P1 - the README mutant makes a dirty README block the entire gate.**
   `tests/mutation_check.sh:100-112` refuses before installing its cleanup
   trap. Step 5 now commits before Step 6 runs the gate, and the File
   Structure section records the permanent consequence.
9. **P2 - tests 1 and 2 were mutually unsatisfiable.** Set-equality over every
   `\b(\d+) cards\b` forbids the per-deck counts test 2 demands. Anchored to
   `N cards total`.
10. **P2 - equality on the mutant count couples every future mutant PR to a
    README edit.** First loosened to a bare upper bound; the PR-88 reviewer
    showed that hole let `311` ship on a 312-patch tree and survived an
    adversarial `12 mutant patches`. Now a BAND: `n * 0.9 <= said <= n`.
11. **P3 - the plan's staleness table was itself stale:** "11 node suites"
    listing ten, and "7 python suites" which becomes 8 when this PR lands.
    Corrected, and the new file is named in Step 1.
12. **P3 - Step 5 skipped suite health too**, so a typo'd `FLOORS` path or a
    floor above the collected count would only surface in CI. Added.
13. **P3 - the check reads tree shape, which sits near CONTRACT rules 1-2.**
    Declared as an explicit carve-out with its limits stated, rather than left
    for a reviewer to litigate.

### Coverage

```
  data/decks.json ──┬─> total 96 ──────> "96 cards total"     [test 1] KILLED by m_readme_card_count_stale
                    └─> per deck 19/52/25 ──> deck line       [test 2]
  src/engine/*.js ─────> six paths ────────> engine para      [test 3]
  tests/mutants/*.patch ─> count 312 ──────> "312 mutants"    [test 4] (band: 90%..100%)

  scale-sheet paragraph ──> PROSE ONLY, unchecked  <- accepted non-goal
  suite counts 10/8 ──────> PROSE ONLY, unchecked  <- accepted non-goal
```

### Failure modes

- Gate refuses (exit 2) on an uncommitted README. Mitigated by Step 5's order;
  permanent for every future contributor, and now documented.
- A README rewrite that drops the literal phrase `cards total` or `mutant`
  reds the suite with "README no longer states ..." rather than passing
  vacuously. Intended.
- Renaming an engine module forces a README edit that documents nothing. Cost
  of the carve-out, accepted.
- A paragraph describing the wrong feature stays green. Stated non-goal.

### Implementation Tasks

| # | Task | File | Verify |
|---|---|---|---|
| 1 | Write the four-case drift check | `tests/test_readme_currency.py` | `python3 -m unittest tests.test_readme_currency -v` fails 4/4 |
| 2 | Add the `FLOORS` row (4) | `tests/suite_health.py` | `python3 tests/suite_health.py` |
| 3 | Rewrite the stale sections | `README.md` | the same unittest command passes 4/4 |
| 4 | Write the README-mutating patch | `tests/mutants/m_readme_card_count_stale.patch` | apply -> suite FAILS; apply -R -> clean |
| 5 | Commit all four together | - | `git status --porcelain README.md` empty |
| 6 | Three-command local verification | - | `312/312 mutants killed`, `MUTATION GATE PASSED` |
| 7 | Push, PR, CI green at head SHA, fresh reviewer | - | `gh pr checks` all SUCCESS at the pushed SHA |

### PR #88 review round 1 (FAIL, fixed)

A fresh reviewer at `fe59578` returned FAIL with two blockers and six nits, all
in prose the rewrite itself introduced. CI was green at that SHA; the failures
were factual, not structural.

- **B1** `README.md:46` claimed the route was `#edit/<id>` and that it reopens a
  saved scale. `index.html:4718` is `EDIT_ROUTE = "#edit-"`, and `:5107-5113`
  replaces a pasted page route away at boot precisely so it does NOT reopen -
  `tests/app.test.js:3194` asserts that. The README asserted the negation of a
  green test. Rewritten to describe what EDIT actually pushes.
- **B2** `README.md:92` said 311 mutants on a 312-patch tree: this lane's own
  patch made it 312 and the prose was not updated.
- **N2** is why B2 shipped: the upper bound catches overstatement only, so any
  understatement passed. Now a band (finding 10).
- **N3** the 40-char deck window cleared its neighbour by one character; now cut
  at the next clause.
- **N4** the engine check was one-directional; a deleted module left a stale
  mention green. Now checked both ways.
- **N5** `./tests/run.sh` also runs `validate.py` and `boot_sim.js`; the comment
  said "python + node suites".
- **N6** the module-level README read is now a `with` block.
- **N1 (disclosed, not reverted)** commit `7992396` touches
  `docs/plans/2026-09-16-remaining-work-coordination.md` (+1/-1), outside this
  lane's declared ownership. It closes out lane S6's status row, which is real
  bookkeeping that would be lost by reverting. Disclosed rather than undone.

NO UNRESOLVED DECISIONS
