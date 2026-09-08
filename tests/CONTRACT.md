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

## Rules

1. **Spec-first.** Derive assertions from `CLAUDE.md` or from user-observable
   behaviour. Never read the implementation and restate it.
2. **No test file may import a constant from the module it tests.** No
   `from hifi import CW, CH, GX, GY`; no reading geometry out of the sandbox to
   compare against itself. A test that recomputes the implementation's formula
   is a mirror, not a test, and CI greps for this.
3. **Every test group needs a killing mutant.** Add a patch to `tests/mutants/`
   naming the test it must break. `tests/mutation_check.sh` applies each, runs
   the named test, asserts failure, and reverts. A test nothing can kill is not
   a test.
4. **A red against unmutated code is triaged, not "fixed".** Run
   `git diff origin/main -- index.html tools/decks.py tools/hifi.py`.
   Data unchanged -> the test transcribed the spec wrong; fix the test.
   Data changed -> the PR broke something; stop and report.
   Never silently amend either side.
5. **The test PR is additive.** It must not modify `index.html`,
   `tools/decks.py`, or `tools/hifi.py`. Verify before pushing with
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
