# Test contract

Read before adding a test. These rules exist because this repo's data was
verified against physical instruments and a commercial deck; tests here LOCK
that in, they do not re-derive it.

## How to run

    ./tests/run.sh                                   # everything
    python3 -m unittest discover -s tests -t . -v    # python only
    node --test "tests/*.test.js"                    # js only (unit + e2e)

Pass a glob, not the directory: this Node build rejects a directory argument to
`--test` ("Cannot find module .../tests"). `tests/run.sh` globs for you.

`tests/` is a package (`__init__.py`); shared paths live in `tests/paths.py`.
E2E skips with a printed reason if no Chromium is found - it never fails the
run over a missing browser.

    ./tests/mutation_check.sh                        # the red-proof gate
    python3 tests/suite_health.py                    # floors + no silent skips

**Mutants pick their suite from a header.** A patch may carry a
`# suite: <command>` line next to its `# kills:` line; that command always wins
over `mutation_check.sh`'s filename-prefix table, so a new mutant prefix needs
no change to the script. A patch with neither a known prefix nor a header is
reported as a survivor. Reverting is driven by the patch itself, so a mutant may
touch any path. Each suite runs under a wall clock (`MUTANT_TIMEOUT`, default
180s) and a hang is retried once, then reported as `timeout` - never as a kill:
an unfinished CI step's log cannot be read, so a hang has to end by itself. A
header command is also run once on the CLEAN tree and must be green there: a
suite that is already red (or a typo, rc 126/127) would "kill" every mutant
aimed at it while testing nothing, and is reported `broken` instead. Result
lines are machine-readable - the first two fields are
`<patch basename> killed|survived|timeout|stale|skipped|broken`.

**Floors are a per-file table.** `suite_health.py`'s `FLOORS` has one row per
test file, and rows are pre-seeded at 0 for files that do not exist yet. Adding
tests means editing YOUR row's number - never inserting, reordering or lowering
someone else's. **Nothing enforces "never lower a row" - it is a reviewer rule.**
The only arithmetic check is that the rows still SUM to at least the legacy
aggregates (python 40, node unit 12, node total 17), so raising a row is always
safe and lowering one is caught by review, not by the script. A 0 row for a
missing file is a placeholder, not a failure; a `tests/*.test.js` file with NO
row is a failure - add a row (0 is a fine start). Node counts come from
`node --test --test-reporter=tap <file>`, per file.

## Rules

1. **Spec-first.** Derive assertions from `CLAUDE.md` or from user-observable
   behaviour. Never read the implementation and restate it.
2. **No test file may import a constant from the module it tests.** No
   `from hifi import CW, CH, GX, GY`; no reading geometry out of the sandbox to
   compare against itself. A test that recomputes the implementation's formula
   is a mirror, not a test.
   Carve-out: comparing a module's exported table (e.g. the naming interval
   table) to the spec fixture in `tests/fixtures/` is allowed; that is
   spec-first - the fixture IS the spec, and the module carries its own literal
   copy that the test holds to it.
3. **Every test group needs a killing mutant.** Add a patch to `tests/mutants/`
   naming the test it must break. `tests/mutation_check.sh` applies each, runs
   the named test, asserts failure, and reverts. A test nothing can kill is not
   a test.
   A mutant may patch a file under `tests/` when the thing that has to be proved
   live is a TEST'S OWN ORACLE rather than production code - see
   `c_gen_pdf_oracle_blind.patch` (blinds a staleness oracle),
   `f_fixture_sha.patch` (patches a fixture) and
   `d_caller_scan_strips_literals.patch` (blinds the replaceRegistered caller
   scan's comment stripper). "No mutant patches tests/" is not a rule and never
   was, and is not a reason to ship a test helper with nothing that can kill it.
4. **A red against unmutated code is triaged, not "fixed".** Run
   `git diff origin/main -- index.html tools/decks.py tools/hifi.py src/engine/**`.
   Data unchanged -> the test transcribed the spec wrong; fix the test.
   Data changed -> the PR broke something; stop and report.
   Never silently amend either side.
5. **A test-only PR is additive.** A PR whose purpose is to add or change tests
   must not modify `index.html`, `tools/decks.py`, or `tools/hifi.py`. (A
   feature PR obviously does change them - it then owns the rebuild and the
   mutant regeneration; this rule is about the test PR only.) Verify before
   pushing with
   `git diff --quiet origin/main -- index.html tools/decks.py tools/hifi.py`.
   This is a reviewer check, not a CI job: making it permanent would forbid all
   future deck-data changes, which the PDF staleness gate already handles
   correctly by requiring a rebuild in the same commit. Bugs found are reported
   with a failing-test repro, not fixed here.
6. **Assert structure, not styling.** Read colours and fonts from the deck data;
   never hardcode a hex or a font name. A future restyle must not turn tests red.

## Traps (each one already bit us)

- `tools/validate.py` installs a stub `hifi` into `sys.modules` at import time.
  **Never `import validate`** from a test - shell out with `subprocess`, or the
  font-metric and PDF tests silently get a stub in the same process.
- `hifi.build()` rebinds module globals `BLUE`/`GREEN`. Any test touching
  `draw_ring`/`duo_frame` must save/restore them or pass colours explicitly.
- `hifi.tracked()` draws one `drawString` per glyph, so extracted PDF text is
  per-character. Normalise whitespace before asserting.
- Every field label of a deck is printed inside the diagram, so "note X appears
  in the PDF" is true regardless of the chord. Assert *ordered* note-line and
  number-line substrings instead.
- `index.html` loads Google Fonts render-blocking in `<head>`; the inline script
  may not run before assertions. The CDP harness blocks the font CDN, so e2e
  measures fallback metrics and works offline.
- `render()` writes BOTH card faces every time. A content-based flip assertion
  passes with all the flip CSS deleted - assert the `flip` class and the settled
  computed transform instead, after `await b.settle()`.
- `.notesline`/`.numline` are `white-space:nowrap` inside `.face{overflow:hidden}`:
  overlong text is CLIPPED, not scrolled, so `body.scrollWidth` stays clean.
  Assert per-element `el.scrollWidth <= el.clientWidth + 1`.
- **Stale `.pyc` during mutation sweeps.** Bytecode invalidation keys on source
  mtime-in-seconds + size, so a byte-length-neutral patch applied and reverted
  within one second leaves `__pycache__` holding the mutated module - the next
  run then tests data that is no longer on disk. Any test or script that mutates
  and re-imports must set `PYTHONDONTWRITEBYTECODE=1` (or a fresh
  `PYTHONPYCACHEPREFIX`) and clear `__pycache__` between cycles.
- `localStorage` key `hpfc` will be shared with spaced-repetition progress.
  Assert subset semantics (`stored.deck === ...`), never deep equality.

## Verified data facts (do not "correct")

- Amara `G5` is `[6, 3]` = MIDI 67, 62: a **-5 semitone inverted fifth**, because
  the fifth is only available below the root. Use `(b - a) % 12 == 7`.
- Duplicate pitch-class sets are deliberate: 4 groups / 9 cards (Hijaz Bm x2;
  Pygmy Ab x2, Cm x3, Eb x2). The invariant that holds is that no two chords in
  a deck share an identical `fields` list (18/25/16 all distinct).
- Page counts: full 3/4/2, printer-only 2/3/2. 59 cards total.
