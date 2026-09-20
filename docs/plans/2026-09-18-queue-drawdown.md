# Queue drawdown after PR #89

**Goal:** close the open queue rows that are worth closing, in four
file-ownership lanes, and record for each row I am NOT doing why not.

**Spec:** the open rows of `docs/plans/2026-09-16-remaining-work-coordination.md`.

## Assessment (evidence, not first impressions)

Every row below was checked against the file it cites, at main `9b5e120`.

### Already closed by later work - verify and mark resolved, no code

| Row | Evidence |
|---|---|
| 92 README out of date | PR #88 rewrote it. `README.md:7-13` documents the engine sync step, `:17-18` ships 19/52/25 and 96 total, `:24-30` lists all six engine modules, `:41-51` describes the scale page, `:89-93` the engine suites. `tests/test_readme_currency.py` now guards it. Nothing left to write. |

### Worth doing now

| Row | Verified defect | Size |
|---|---|---|
| 47 boot_sim guard | `tools/boot_sim.js:36` is still `if (cards !== 96)` against a total accumulated at `:25`. One deck three short and another three long passes. | S |
| 48 v3 fixture unpinned | `tests/test_fixture_integrity.py:14` pins **v4**. `golden_decks_v3.json` carries a `sha256` key that **no test reads**, while `tests/voicing.test.js:18`, `select.test.js:34`, `core.test.js:19` and `naming.test.js:32` all read it as the frozen baseline. | S |
| 49 stale `61` prose | Mostly already swept. One live instance: `tools/hifi.py:118`. (`TODOS.md:46`'s "60/61" is historical prose about enumeration coverage and is correct as written - leave it.) | XS |
| 50 ownership row | Doc-only correction, adjudicated already. | XS |
| 91 armed DELETE cancel | `disarmDelete()` (`index.html:4922-4932`) clears the label, the `data-armed` attribute and the announcer, but nothing clears `#scale-box.bad` or re-enables GENERATE. Owner-facing dead end on a feature the owner asked for. | S |
| 81 opacity-blind oracle | Same oracle family as 78, whose other two vectors PR #84 already closed. `opacity:0` still survives. | S |
| 69 leaked Chrome | `tests/suite_health.py:199-202` uses `subprocess.run(timeout=)`, which kills the direct `node` child only - Chrome is a grandchild and survives. This cost a run **this session**. | M |
| 94 stale plan arithmetic | 7 live occurrences of `vv.height * vv.scale` below the supersession banner. | S |
| 96 / 97 PR #89 nits | `tests/helpers/cdp.js:278-285` - comment cites no follow-up row, and the flag is global to all 88 tests. | XS / S |

### Deferred, with the reason

| Row | Why not now |
|---|---|
| 95 root `overscroll-behavior-x` | **Owner call.** A behaviour change to the shipped app on Android Chrome. Asked below. |
| 90 footer breathing room | **Owner call.** A spacing/taste change to a visual system CLAUDE.md says to preserve. Asked below. |
| 78 (`color:transparent`) | Owner already deferred it - needs contrast maths. |
| 67, 93 | Need the owner's physical iPhone 14 / iOS 26.6. Nothing I can run. |
| 46 | Four mutants need real semantic invariants written behind them. That is its own workstream, not a drawdown row. |
| 60 | Named as an accepted risk at `docs/plans/2026-09-16-scale-page-ux.md:368` and plan-sanctioned. |
| 68 | Root cause unknown and investigation-shaped. Row 69's fix removes the leaked-Chrome starvation that is the leading suspect - re-measure 68 after lane D lands, then decide. |
| 86 | Nits N3/N4/N7/N10; N3 overlaps row 91's lane. Re-read after lane B. |

## What already exists (do not rebuild)

- `tools/boot_sim.js:15-27` already loops per deck with `d` in scope. Row 47 is
  a counter change inside that loop, not a new harness.
- `tests/mutation_check.sh` + `tools/regen_data_mutants.py` already own
  DECKS-line rewriting, including the `deg` U+00B0 re-injection trap. No lane
  writes that line by hand.
- `tests/test_fixture_integrity.py:55-64` already carries the two-test pin
  pattern for v4. Row 48 mirrors it for v3; it does not invent one.
- `tests/helpers/cdp.js:42` already has profile-dir cleanup machinery.
  `tests/suite_health.py` has none and never learns a profile path.
- `tests/test_readme_currency.py` already guards the README. Row 92 is a
  doc-status edit only.

## NOT in scope

- Deck data, deck geometry, engine modules, the `const DECKS` line.
- `overscroll-behavior-x` on the root (row 95) - owner call, below.
- Footer spacing (row 90) - owner call, below.
- Device-dependent rows 67 and 93; `color:transparent` (78); mutation-corpus
  semantics (46).
- Per-test browser launches. The shared CDP session stays shared.
- Orphan `hpfc-prof-*` cleanup. See the lane D note; it becomes a queue row
  against `tests/helpers/cdp.js`, not a sweep in `suite_health.py`.

## Lanes

**Ownership is NOT naturally disjoint** - `tests/suite_health.py` is touched by
the floor raise, by any new test that changes a count, and by the timeout fix.
It is made disjoint by assignment: **lane D is its sole owner**, and the floor
raise moves to a sequenced step after D merges.

```
main
 |
 +-- A  tools/boot_sim.js, tests/test_fixture_integrity.py, tests/mutants/   [parallel]
 |
 +-- C  docs/plans/*.md, tools/hifi.py, tests/helpers/cdp.js                 [parallel]
 |
 +-- D  tests/suite_health.py                                                [parallel]
 |        |
 +-- B  index.html (app regions), tests/e2e.test.js                          [parallel]
          |
          +-- B5 floor raise in tests/suite_health.py   <-- waits for D merge
```

### Lane A - corpus integrity (rows 47, 48)

**Owns:** `tools/boot_sim.js`, `tests/test_fixture_integrity.py`,
`tests/mutants/`.
**Never touches:** `index.html`, `data/decks.json`, `src/engine/`,
`tests/suite_health.py`.

- [ ] **A1. Cut the killing mutant first.** `m_boot_sim_total_only_guard.patch`
      reverts `tools/boot_sim.js` to the total-only `if (cards !== 96)` guard.
      Cut with `diff -u` against a `sed`ed copy, never `git diff` -
      `tests/mutation_check.sh` applies with a bare `git apply`, so a hand-typed
      postimage applies cleanly and reports green falsely. Header `# kills:` +
      `# suite:` per `tests/CONTRACT.md`.
      Expect: the mutant SURVIVES. That survival is the failing test.
      Verify: `./tests/mutation_check.sh`
      (Superseded review finding: an earlier draft added a bespoke
      `tests/test_tools.py` case that rewrote the generated `const DECKS` line
      in a temp copy. Dropped - it duplicates this mutant and re-hits the
      `deg` U+00B0 re-injection trap that `tools/sync_decks.py` owns.)
- [ ] **A2. Fix `tools/boot_sim.js`.** Inside the existing per-deck loop
      (`:15-27`), accumulate into a per-`d.id` counter and compare each against
      `d.chords.length`; keep the 96 total as a second assertion so corpus size
      stays pinned. The mutant now dies.
      Verify: `node tools/boot_sim.js && ./tests/mutation_check.sh`
- [ ] **A3. Probe v3 self-consistency BEFORE pinning anything.** Recompute
      `json.dumps({"version":..., "decks":...}, sort_keys=True,
      separators=(",",":")).encode()` over `golden_decks_v3.json` and compare to
      its stored `sha256`. If they disagree, STOP: file a queue row and do not
      write a pin - a constant taken from a drifted file records the drift as
      the baseline.
- [ ] **A4. Pin v3 with BOTH tests, mirroring v4.** In
      `tests/test_fixture_integrity.py` add `V3_FIXTURE` + `EXPECTED_SHA256_V3`,
      then `test_v3_sha256_matches_its_canonical_serialisation` (self-consistency,
      the same shape as `:55`) AND `test_v3_sha256_is_the_pinned_digest`
      (constant equality, the same shape as `:62`). Self-consistency first.
      One test alone is not the pattern: the constant test alone blesses drift,
      the self-consistency test alone lets a coordinated rewrite pass.
- [ ] **A5. Rename the mis-named v4 test.** `:62`
      `test_sha256_is_the_pinned_v3_digest` guards v4; rename to
      `test_sha256_is_the_pinned_v4_digest`.
- [ ] **A6. Second mutant** `m_golden_v3_byte_flip.patch` - flip a byte inside
      `golden_decks_v3.json`, killed by A4's self-consistency test.
- [ ] **A7. Commit, push, PR, wait for CI.**

**AC:** `node tools/boot_sim.js` green; `python3 -m pytest
tests/test_fixture_integrity.py` green; `./tests/mutation_check.sh` green with
the corpus at 316.

### Lane B - app UX and the e2e oracle (rows 91, 81)

**Owns:** `index.html` (app regions only), `tests/e2e.test.js`,
`tests/mutants/`.
**Never touches:** engine regions, the `const DECKS` line, `data/decks.json`,
deck geometry, `tests/suite_health.py` until B5's gate opens.

- [ ] **B1. Failing e2e test for row 91.** Type a rejected seed, arm DELETE, tap
      elsewhere to disarm, assert `#scale-box` no longer carries `.bad` **and**
      `#scale-generate` is not disabled - or, if the seed is still genuinely
      bad, that `#scale-msg` says so rather than being blank. Expect FAIL.
- [ ] **B2. Fix `disarmDelete()`** (`index.html:4922`) by **re-running the
      existing parse path**, not by restoring a cached render and not by
      writing a second copy of the validation logic. One shape, chosen:
      re-parsing recomputes `.bad`, the message and the GENERATE disabled state
      from the field's current text, so the three cannot disagree. A cached
      restore reintroduces exactly the stale-state class of bug row 91 is.
      Verify: `CHROME_BIN=... node --test --test-name-pattern '<the new test>' tests/e2e.test.js`
- [ ] **B3. Failing test for row 81.** Extend the visible-box oracle at
      `tests/e2e.test.js:2748` to read computed `opacity` up the ancestor chain
      (opacity is not inherited, so each ancestor must be read separately).
      Existing tests stay green; the new assertion must have a killing mutant.
- [ ] **B4. Mutant** `e_layout_hint_ancestor_opacity_zero.patch`:
      `#scale-layout-row{opacity:0}`.
- [ ] **B5. Floor raise - GATED ON LANE D MERGING FIRST.** Only after lane D's
      PR is merged to main and this branch is rebased on it, raise
      `tests/suite_health.py:47` to the count the e2e run actually reports at
      this lane. head commit - read the `tests/e2e.test.js: ran N` line, do not
      compute `88 + k`. If D has not merged when B is otherwise ready, merge B
      without B5 and file the floor raise as a one-line follow-up row.
- [ ] **B6. Commit, push, PR, wait for CI.**

**AC:** the two new e2e tests green in CI; both mutants killed; suite health
green at the new floor.

### Lane C - docs and harness hygiene (rows 49, 50, 92, 94, 96, 97)

**Owns:** `docs/plans/*.md`, `tools/hifi.py` (comment only),
`tests/helpers/cdp.js`.
**Never touches:** `tests/e2e.test.js`, `tests/suite_health.py`, any test body.

- [ ] **C1.** `tools/hifi.py:118` - `61` to `96`. (`TODOS.md:46`'s "60/61" is
      historical prose about enumeration coverage and is correct - leave it.)
- [ ] **C2.** Correct W5's ownership row per row 50's adjudication; mark 50
      resolved.
- [ ] **C3.** Mark row 92 resolved, citing
      `README.md:7-13,17-18,24-30,41-51,89-93` and
      `tests/test_readme_currency.py` as the evidence.
- [ ] **C4.** `docs/plans/2026-09-18-keyboard-wiring-coverage.md` - the 7 live
      `vv.height * vv.scale` lines. Do NOT rewrite the arithmetic inline (the
      banner already carries the correction; a rewrite erases the record of what
      was overturned). Mark each block superseded, the treatment
      `2026-09-18-readme-refresh.md` Step 1 got.
- [ ] **C5.** `tests/helpers/cdp.js:278-285` - add the cross-reference to row 95,
      **and in the same comment record why row 97 is closed without a guard**
      (see C6).
- [ ] **C6. Close row 97 as won't-fix-documented.** The proposed guard was a
      suite-level assertion counting `swipe()` callers. Rejected on evidence:
      `grep -c "b.swipe(" tests/e2e.test.js` is already **7**, not the 3 the row
      assumed, so the number is churn; an assertion on a source-text count fires
      on every legitimate new swipe test and still does not detect a test that
      drags horizontally by some path other than `swipe()`. Scoping the flag
      per-test is the alternative and costs a browser launch per test, which is
      the cost the shared session exists to avoid. Record both rejections in the
      queue row and in C5's comment.
- [ ] **C7.** Give rows 95, 96, 97 the status column the table's other rows have
      (they were filed with three columns). While there, normalise the status
      casing: rows 46-69 use lowercase `open`, rows 86-94 uppercase `OPEN`.
- [ ] **C8. Commit, push, PR, wait for CI.**

**AC:** `python3 tools/validate.py` green; `python3 tests/suite_health.py` green;
no queue row left claiming a state the repo contradicts.

### Lane D - e2e harness robustness (row 69)

**Owns:** `tests/suite_health.py` - **sole owner for this workstream.**
**Never touches:** any test file, `tests/helpers/cdp.js`.

- [ ] **D1. Failing test.** In `tests/test_suite_health.py`, spawn a child that
      itself spawns a grandchild sleeper, drive it through `run_node_file`'s
      timeout path, and assert the grandchild is dead afterwards. Expect FAIL:
      `subprocess.run(timeout=)` kills the direct child only.
- [ ] **D2. Fix, process-group kill.** `tests/suite_health.py:199-202`:
      `subprocess.Popen(..., start_new_session=True)`, then on `TimeoutExpired`
      SIGTERM the group first, drain it for a bounded grace period, and
      SIGKILL only if it has not exited by then - deliberately, so
      `cdp.js`'s SIGTERM/SIGINT/SIGHUP reaper (`tests/helpers/cdp.js:79-99`)
      gets a chance to run before the group dies uncatchably.
      **No profile-dir sweep.** `hpfc-prof-*` dirs are created at
      `tests/helpers/cdp.js:273` and `suite_health.py` never learns their paths,
      so any sweep here is age-based - and an age-based sweep can delete the
      live profile of a concurrently running suite (CI runs the js suites and
      suite-health as separate jobs). Killing the process group is the fix for
      the leak that actually starves a run; orphan dirs are inert bytes in
      tmpdir. File the dir cleanup as a queue row against `cdp.js`, which
      already has cleanup machinery at `:42`.
      Verify: `python3 -m pytest tests/test_suite_health.py`
- [ ] **D3. Commit, push, PR, wait for CI.** Merge D before lane B's B5.

**AC:** the new test green in CI; after a deliberately timed-out e2e run, no
`Google Chrome` process survives.

## Coverage map

```
ROW 47  boot_sim per-deck guard
  tools/boot_sim.js  per-deck loop :15-27 -> per-id counter
    [*** TESTED] m_boot_sim_total_only_guard.patch (mutation_check.sh)
    [*** TESTED] node tools/boot_sim.js  (96 total still pinned)

ROW 48  v3 fixture pin
  golden_decks_v3.json -> voicing/select/core/naming .test.js
    [GAP -> CLOSED] self-consistency test (A4)
    [GAP -> CLOSED] constant-pin test (A4)
    [*** TESTED] m_golden_v3_byte_flip.patch
  golden_decks_v4.json -> python engine tests
    [*** TESTED] already pinned, test renamed only (A5)

ROW 91  armed DELETE cancel          USER FLOW
  type bad seed -> #scale-box.bad, GENERATE disabled, msg set
    -> tap DELETE (arm) -> tap elsewhere (disarm)
       [GAP -> CLOSED] -> B1 asserts .bad / disabled / msg agree
       [-> E2E] only reachable in a real browser; no unit oracle exists

ROW 81  opacity-blind visible-box oracle
  tests/e2e.test.js:2748 visible() -> reads display/visibility/box
    [GAP -> CLOSED] ancestor opacity chain (B3)
    [*** TESTED] e_layout_hint_ancestor_opacity_zero.patch
    [GAP - ACCEPTED] color:transparent (row 78, owner-deferred)

ROW 69  leaked Chrome on e2e timeout
  suite_health.run_node_file -> node -> chrome (grandchild)
    [GAP -> CLOSED] D1 grandchild-survives test
    [GAP - ACCEPTED] orphan hpfc-prof-* dirs -> new queue row vs cdp.js

ROWS 49,50,92,94,96,97  docs + harness hygiene
    [NO TEST - BY DESIGN] doc-status edits; validate.py is the only oracle
    [GAP - REJECTED] row 97 swipe-caller assertion (C6, with reasons)
```

COVERAGE: every behaviour change in this plan has a killing mutant or an e2e
assertion. The three remaining gaps are named, reasoned and owner-visible
(78 deferred, orphan dirs re-filed, 97 closed won't-fix).
QUALITY: oracles are external - `mutation_check.sh` and CI, not a lane's own
judgement. No lane grades its own homework.

## Failure modes

| Mode | Detection | Response |
|---|---|---|
| A3's v3 probe finds drift | A3 prints a mismatch | STOP lane A's pin half; file a row. Do not pin. |
| A mutant applies but is not killed | `mutation_check.sh` reports SURVIVED | The test is the defect, not the mutant. Fix the test. |
| B rebased on D loses the floor edit | `suite_health.py` floor below reported count | B5 re-reads the `ran N` line after rebase; never `88 + k`. |
| D merges after B is ready | B5 has no base | Merge B without B5; file the raise as a one-line row. |
| C's status-casing normalisation conflicts with a live lane's row edit | merge conflict in the coordination doc | C is the sole doc writer this workstream; other lanes report, never edit. |
| e2e suite hangs again mid-workstream | `TIMED OUT after 180s` in suite health | That is row 69's own symptom; D's fix is the remedy, not a timeout raise. |

## Worktree parallelization

Four worktrees, one per lane, all off main:

```
.claude/worktrees/qd-a   queue-drawdown/a-corpus      A1-A7
.claude/worktrees/qd-b   queue-drawdown/b-app-oracle  B1-B4, B6  (B5 gated)
.claude/worktrees/qd-c   queue-drawdown/c-docs        C1-C8
.claude/worktrees/qd-d   queue-drawdown/d-harness     D1-D3
```

A, C and D are fully parallel from t=0. B is parallel for B1-B4/B6 and has one
ordered dependency: B5 after D merges. Merge order: D, then A/C/B in any order.
Each lane pushes and waits for CI at its own head SHA; a fresh reviewer per lane
checks out that exact SHA. Two attempts per lane, then the lane becomes a queue
row.

## Non-goals

- No deck data, deck geometry or engine changes anywhere in this plan.
- No app-side `overscroll-behavior-x` (row 95) - owner call, below.
- No footer spacing change (row 90) - owner call, below.
- No device-dependent rows (67, 93) and no `color:transparent` (78).
- No new mutation-corpus semantics (row 46).

## Merge gates

Standing: CI green at the pushed head SHA, then a fresh independent reviewer
per lane at that exact SHA, read-and-report only, then merge with
`gh pr merge <n> --merge`. FAIL bounces to the author; cap two attempts.

## Owner decisions needed

- **D-95:** should a card swipe on Android Chrome be safe from back-navigation?
  Yes means `overscroll-behavior-x:contain` on the root - a real behaviour
  change to the shipped app, affecting any horizontal gesture anywhere on the
  page, not only the card.
- **D-90:** restore the portrait footer's `2 x --sp-4` body-to-primary
  separation, or keep today's `1 x --sp-4`? CLAUDE.md says preserve the visual
  system, so I will not move spacing on my own judgement.

## Implementation Tasks

Machine-readable copy:
`~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-tasks-20260918-191051.jsonl`
(24 tasks, each with `lane`, `files`, `verify`, `depends_on`).

| Task | Lane | Depends on |
|---|---|---|
| A1 cut the total-only mutant, expect SURVIVED | A | - |
| A2 per-deck counter in the existing loop | A | A1 |
| A3 probe v3 self-consistency, STOP on drift | A | - |
| A4 pin v3 with BOTH tests | A | A3 |
| A5 rename the mis-named v4 test | A | - |
| A6 `m_golden_v3_byte_flip.patch` | A | A4 |
| A7 commit/push/PR/CI | A | A2,A4,A5,A6 |
| B1 failing e2e for the armed-DELETE cancel | B | - |
| B2 `disarmDelete()` re-runs the parse path | B | B1 |
| B3 ancestor-opacity oracle | B | - |
| B4 `e_layout_hint_ancestor_opacity_zero.patch` | B | B3 |
| B5 floor raise | B | **D3** |
| B6 commit/push/PR/CI | B | B2,B4 |
| C1 `tools/hifi.py:118` 61 to 96 | C | - |
| C2 W5 ownership row, row 50 resolved | C | - |
| C3 row 92 resolved | C | - |
| C4 mark the 7 stale blocks superseded | C | - |
| C5 cdp.js comment: row 95 cross-ref + why 97 is closed | C | C6 |
| C6 close row 97 won't-fix-documented | C | - |
| C7 status column on 95-97, normalise casing | C | - |
| C8 commit/push/PR/CI | C | C1-C7 |
| D1 grandchild-sleeper failing test | D | - |
| D2 `start_new_session` + `os.killpg`, no sweep | D | D1 |
| D3 commit/push/PR/CI, merge before B5 | D | D2 |

New queue rows this review creates (filed by lane C in C7's edit):
- orphan `hpfc-prof-*` dirs accumulate in tmpdir - owner `tests/helpers/cdp.js`,
  which already has cleanup machinery at `:42`. Split out of row 69 because an
  age-based sweep from `suite_health.py` can delete a concurrently running
  suite's live profile.

## GSTACK REVIEW REPORT

| Run | Status | Findings |
|---|---|---|
| Step 0 scope challenge | done | Complexity check triggers: 4 lanes, 8+ files. Held at 4 lanes - the split is by file ownership, not by convenience, and collapsing them would put `index.html` and `tests/suite_health.py` in one branch. |
| Section 1 Architecture | done | P1 ownership collision on `tests/suite_health.py` across B/C/D. P1 C6's swipe-caller assertion wrong in kind, premise already false (7 callers, not 3). |
| Section 2 Code quality | done | P2 A1 duplicated A4 and re-hit the `deg` U+00B0 trap. P3 `test_sha256_is_the_pinned_v3_digest` guards v4. |
| Section 3 Tests | done | P2 A3's single-test pin could bless existing drift; must mirror both v4 tests, self-consistency first. |
| Section 4 Performance | done | P2 lane D's profile-dir sweep is unbuildable from `suite_health.py` and unsafe as an age sweep. |
| Coverage diagram | done | Written above. 3 named gaps, all reasoned. |
| Test plan artifact | done | `~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-test-plan-20260918-191032.md` |
| Implementation tasks | done | 24 tasks, JSONL above. |
| Outside Voice (Codex) | skipped | `CODEX_MODE: model_unusable` - the local Codex install cannot decode its model catalog (`unknown variant 'max'`). Not a review gap; recorded. |

All six findings were applied to the plan. Decisions were auto-made under the
standing AFK authorization and each is recorded inline in the plan text next to
the step it changed.

VERDICT: PASS - the plan is executable as amended.

NO UNRESOLVED DECISIONS
