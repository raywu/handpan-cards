# Refactor pass 3 cleanup: one race-free mutant, stale text

Date: 2026-10-05. Parents: `docs/plans/2026-10-05-refactor-pass-3.md` and
`docs/plans/2026-10-05-refactor-pass-3-followup.md` (both fully merged, main `afb1d07`).
One serial lane. Sections 2.1, 4.3, 5 and 6 of the first parent apply unchanged, with two exceptions. The regroup rule
in the owner's AFK instructions replaces gate 5 (two FAILs park the lane): a third failed review triggers it. CU-1 is
exempt from 4.3's "first commit is the test", as the Order paragraph says.

## 1. Goal

Close the leftovers the pass 3 reviewers raised and the owner picked on 2026-10-05:

1. `r3f_grace_zero` must die by design, not by winning a race.
2. Text that is false on main is corrected.
3. `TODOS.md` sections that describe shipped work are removed, when the shipping is proven.

Done when: every step is done or took its named STOP branch, CI `validate` is green at the PR head, and
`ls tests/mutants/*.patch | wc -l` still equals the README figure (672; this lane adds and removes no patch).

## 2. Non-goals

- Restoring an int-type check to `tools/validate.py` check 2. Owner left the choice to the orchestrator, who dropped
  it: `tests.test_deck_data`, `tests.test_print`, `tests.test_render_agreement` and `tests/app.test.js` already
  redden on a string field id.
- Any app behaviour change. `index.html` is not touched at all, comments included.
- Deck data, diagram geometry, engine regions, the `const DECKS` line, the visual system.
- Adding, deleting or renaming any test or mutant patch. FLOORS rows. The README mutant count.
- The other reviewer nits (lint key keeps context lines, `diffAll` truthiness, deck-level `diffAll` mutant,
  `DRAIN_TIMEOUT` coverage, PF and HX nits). The numeral-label task. Parent section 10 Q2, Q5-Q8, Q9b, Q11, Q13.
- Any part of `CLAUDE.md` other than the one bullet CU-3 names.

## 3. Lane CU: `claude/rp3-cleanup`

**Owns.**
- `tests/test_suite_health.py`: the `FAKE_NODE_DETACHED` fixture string, the comment directly above it, and the
  "Shape 2 kills its grandchild before the drain is entered" sentence of the module docstring.
- `README.md`: the `src/engine/sequence.js` sentence and the `**+ ADD A SCALE**` sentence.
- `tools/validate.py`: the comment block above `check_2` only. No code.
- `tests/test_deck_data.py`: the first sentence of the `test_validate_py_passes` docstring only.
- `tests/mutation_harness.test.js`: the assertion message string of the `FU-6` test only.
- `CLAUDE.md`: the `**Verification style:**` bullet under "Known pitfalls" only (owner approved 2026-10-05).
- `TODOS.md`: the two sections CU-4 names.
- `tests/mutants/*.patch`: only patches stranded by the edits above, refreshed with `tools/refresh_mutants.py`.

**Order.** CU-1 is exempt from parent 4.3's "first commit is the test": the change is itself a test fixture, the
differential probe in the PR body stands in for the red commit, and CU-1 is one commit. CU-2 to CU-4 are text with no
test; each is its own commit.

### CU-1: `r3f_grace_zero` dies by design

- Fact: `tests/mutants/r3f_grace_zero.patch` sets shipped `GROUP_TERM_GRACE = 0`. It is killed by
  `test_a_grandchild_in_its_own_session_is_reaped_by_its_parent` only because SIGKILL beats the fixture's SIGTERM
  trap in `FAKE_NODE_DETACHED` (`trap 'kill -KILL -$gc 2>/dev/null; exit 143' TERM`). If the trap runs first the
  grandchild is reaped and the mutant survives.
- Prove first (no commit): `git apply tests/mutants/r3f_grace_zero.patch`. In `tests/suite_health.py` add
  `import time` to the imports, and in `run_node_file`'s `except subprocess.TimeoutExpired:` branch insert
  `time.sleep(0.3)` on the line directly after `_kill_group(proc, signal.SIGTERM)` (that branch only; not the
  `BaseException` branch, not `probe_browser`). Run the Verify command 5 times. Expected: `Ran 1 test` ... `OK` each
  time, about 2.3 s (the mutant survives). `git checkout -- tests/suite_health.py` and confirm `git status --short`
  is empty. Paste the output in the PR body. An ERROR (for example `NameError`) is a broken probe: fix the probe, it
  is not a STOP. Only `FAILED (failures=1)` with "survived the timeout" on a correctly applied probe means the race
  reading is wrong: take the STOP.
- Change: the trap becomes `trap 'sleep 0.3; kill -KILL -$gc 2>/dev/null; exit 143' TERM`, and the comment above
  the fixture gains one sentence: the reaper needs real time, so a zero grace can never be enough. In the module docstring, "Shape 2 kills its
  grandchild before the drain is entered, so nothing holds the pipes during it" becomes "Shape 2 kills its
  grandchild 0.3 s into the drain, well inside the grace, so nothing holds the pipes past it".
- Accept: on the clean tree `python3 -m unittest tests.test_suite_health` is `Ran 30 tests`, OK. With the mutant
  applied, run `for i in $(seq 20); do python3 -m unittest -k
  test_a_grandchild_in_its_own_session_is_reaped_by_its_parent tests.test_suite_health 2>&1 | grep -E '^OK|^FAILED';
  done | sort | uniq -c` (one line; about 6 minutes, so set a 10-minute timeout or run it in the background).
  Expected: `20 FAILED (failures=1)`, the message being "detached grandchild pid N survived the timeout". Then
  `git apply -R tests/mutants/r3f_grace_zero.patch`. Also on the clean tree
  `python3 -m unittest -k test_sigint_reaches_the_node_group tests.test_suite_health` is OK (it shares the fixture).
- Verify: `python3 -m unittest -k test_a_grandchild_in_its_own_session_is_reaped_by_its_parent tests.test_suite_health`.
- Forces: none expected (no patch targets `tests/test_suite_health.py`); confirm with
  `python3 tools/refresh_mutants.py --check`.
- STOP: the Prove step does not show a survivor, or another test in the module slows past its own timeout: make no
  change to the fixture and report what was seen.

### CU-2: text that is false on main

Each replacement is checked against the code before it is written; if the code disagrees with the replacement given
here, write what the code does and say so in the PR body.

- `README.md`, `src/engine/sequence.js` sentence: drop `home-rooted`. BASIC and MEDIUM loops can start off the home
  chord and HARD can start anywhere (`src/engine/sequence.js`, the tier table and the start rule). New text:
  `the connect rule that picks a loop of 2 to 6 chords, by tier`.
- `README.md`, `**+ ADD A SCALE**` sentence: `(in the menu, under Scales)` becomes
  `(in the settings panel, under Scales)`.
- `tools/validate.py`, comment above `check_2`: remove the claim that the two invariants "hold by construction". Say
  instead: "every voicing field is lit" is asserted for every card by the `tests/app.test.js` test
  `pan() draws one circle per field, two more per lit field, plus the chrome`; root/tone non-overlap is structural
  in the app (`chordSets` assigns each pitch class to root or tone in one if/else) and is asserted for one card by
  `chordSets: Amara C major has two root-coloured fields (C4 + C5)`; the root/tone role of every field on all 96
  cards is pinned app-against-print by `tests.test_render_agreement` `test_highlighting_agrees`, and print's
  never-both by `tests.test_print` `test_state_selects_root_or_tone_colour_but_never_both`. No `file:line`
  references (`tools/*.py` is in the `tests/test_readme_currency.py` line-ref ratchet).
- `tests/test_deck_data.py`, `test_validate_py_passes` docstring: `and the highlighting invariants` becomes
  `and the per-card root and doubled-pitch-class checks`.
- `tests/mutation_harness.test.js`, `FU-6` message: `delete the later one` becomes `keep one of each pair`.
- Accept: `python3 tools/validate.py` exits 0; `python3 -m unittest tests.test_deck_data tests.test_readme_currency`
  OK; `node --test --test-name-pattern '^FU-6' tests/mutation_harness.test.js` passes;
  `python3 tools/refresh_mutants.py --check` clean or the stranded patches refreshed.
- STOP: a patch stranded by a comment edit cannot be refreshed to die on its original test: revert that one text
  edit and report it.

### CU-3: the repo `CLAUDE.md` bullet

- Fact: the `**Verification style:**` bullet says invariant checks over all 96 cards (every voicing field lit; every
  root field root-coloured; no root/tone overlap) caught real bugs and must be kept. Since FU-7 those checks are no
  longer in `tools/validate.py`.
- Change: keep the bullet's meaning and add where the checks live now, naming the same four tests as the CU-2
  `tools/validate.py` comment, plus `tools/validate.py` check 2 covering root pitch class and doubled pitch classes.
  No other line of `CLAUDE.md` changes.
- Accept: `git diff -U0 main -- CLAUDE.md` shows exactly one hunk, inside the `**Verification style:**` bullet; the
  new text has no `file:line` reference (`CLAUDE.md` is in the line-ref ratchet);
  `python3 -m unittest tests.test_readme_currency` OK.

### CU-4: `TODOS.md` sections for shipped work

Two candidates: `### Part B: root-instance enumeration in select.build` and
`### Pygmy title-card blurb says 25 CHORDS`.

- Prove, per section, from the code and tests on main (not from docs), and paste the file:line evidence in the PR
  body. For Part B: `src/engine/select.js` enumerates one voicing per root-field instance (`rootInstances`,
  `rootId`), caps the alternates (`ALTERNATE_CAP`), and tests in the root-instance section of `tests/select.test.js`
  pin it. For the blurb: the printed title-card count is rewritten from `len(chords)` at load in both
  `tools/decks.py` and `src/engine/pdfdeck.js`, and a test pins it per deck. The stale literals left in
  `data/decks.json` are not a reason to keep the section (deck data is a non-goal).
- Change: delete each section whose proof holds, heading through the line before the next heading. Nothing else in
  `TODOS.md` changes.
- Accept: `git grep -n "TODOS.md" -- index.html tests src tools` shows no citation of a deleted section.
- STOP, per section: the proof does not hold, or holds only in part: leave that section byte-identical and report
  what is still missing.

**Reviewer must check.**
1. The CU-1 Prove output shows a survivor before the change, and the 20 of 20 tally after it.
2. No file outside Owns; `index.html` untouched; no test or patch added, deleted or renamed; FLOORS and the README
   count unchanged; 672 patches.
3. Each CU-2 and CU-3 sentence is true against the code at the head SHA.
4. Each deleted `TODOS.md` section has file:line proof in the PR body; each kept one has its reason.

**Split size and cut.** About 30 lines changed. Nothing may be cut; a STOP is the only way to drop a step.

## 4. Decisions

1. This plan ships as the lane branch's first commit; the reviewer reads it at that SHA and flags later changes.
2. Eng review (fresh agent, 2026-10-05): READY_WITH_CHANGES, nine findings, all folded in. The
   `tests/test_deck_data.py` module-docstring edit was dropped: that paragraph is already true.
