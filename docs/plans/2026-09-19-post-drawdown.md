# Post-drawdown queue: what is worth doing after the queue-drawdown workstream

Status: DRAFT, awaiting `/plan-eng-review`.
Queue source: `docs/plans/2026-09-16-remaining-work-coordination.md` (121 rows, 81 OPEN at main `a7c4e8b`).

## The assessment

81 open rows is not 81 pieces of work. Sorted by who feels the difference:

- **5 rows a user can see** (91, 114, 115, 116, 117) - one defect family in the Edit sheet.
- **1 row a user can see on the owner's own phone** (95) - a horizontal drag can navigate browser history instead of stepping the deck.
- **3 rows only the owner can close** (51, 67, 93) - device checks on iPhone 14 / iOS 26.6. No agent can do these.
- **6 rows that cost us time every run** (107, 108, 109, 110, 69, 98) - harness leaks. Row 68 (a flaky test with no known cause) is pulled out as its own queue row rather than sitting unbounded inside a lane.
- **~15 rows of docs drift** - real, cheap, invisible to users.
- **2 rows recommended WONTFIX** (100, 46) - both describe a gate that a coordinated rewrite of test-plus-fixture would clear. The rewriter is us. Cost high, value near zero.
- The rest are already-superseded or record-keeping rows that close in the docs sweep.

## Goal

Close the user-visible defects, stop the harness bleeding, and clear the docs drift - in that order, in four lanes across three waves.

## Non-goals

- The gstack upgrade (1.81.0.0 -> 1.87.4.0). Explicitly deferred by the owner; not revived here.
- Deck data and diagram geometry. Untouched (project CLAUDE.md hard constraint).
- Roadmap features (spaced repetition, stats, PWA, audio). Not in scope.
- Rows 51/67/93. Device checks; handed to the owner, not assigned to a lane.

## Global constraints

- Single-file app: no `<script src>` in `index.html`.
- Engine regions in `index.html` are GENERATED. Edit `src/engine/<name>.js`, then `python3 tools/inline_engine.py`.
- The `const DECKS` line is GENERATED from `data/decks.json` via `tools/sync_decks.py`.
- TDD: the failing test or mutant lands first, in the same PR.
- A lane's local run is a smoke test. **CI's run at the final pushed commit is the evidence.**
- Every PR is reviewed by a fresh independent reviewer at the verified head SHA before merge. Two attempts per lane, then the lane escalates.
- Test at 380px viewport.

## Ownership

| Lane | Owns | Never touches |
|---|---|---|
| E | `index.html` app JS (outside engine regions), `tests/e2e.test.js`, `tests/app.test.js`, `tests/mutants/d_*.patch` | `tests/suite_health.py`, `tools/`, engine regions |
| F | `index.html` CSS root rules, `tests/e2e.test.js` swipe block, the `tests/e2e.test.js` FLOORS row | app JS state machine (lane E's), every other FLOORS row |
| G | `tests/suite_health.py`, `tests/test_suite_health.py`, `tests/helpers/cdp.js`, `tests/mutants/h_*.patch` | `index.html`, `tools/` |
| H | `docs/plans/*.md`, `CLAUDE.md`, `tools/boot_sim.js`, `tools/hifi.py` comments | every test file, `index.html` |

Lanes E and F both touch `tests/e2e.test.js`. **F is sequenced after E merges** rather than split further - the file is one test file and two lanes editing it concurrently is the conflict the ownership table exists to prevent.

`tests/suite_health.py` has exactly one writer per wave: **G in wave 1** (its own `tests/test_suite_health.py` row), **F in wave 2** (the `tests/e2e.test.js` row). E and H never open it.

---

## Lane E: the Edit-sheet refusal state machine (rows 91, 114, 115, 116, 117)

**The defect, stated once.** `updateParse()` at `index.html:4603` opens with an unconditional `refusal = null`. A standing scale-collision refusal (set at `:4892`, "Another deck already uses this scale.") is therefore dropped by all EIGHT of its callers: `:4374`, `:4745`, `:4998`, `:4999`, `:5116`, plus three bare `addEventListener` references a `grep 'updateParse()'` cannot see - `scaleBox` at `:5035`, `nameBox` at `:5038`, `degSel` at `:5039`. Only one of those eight - the seed-box keystroke at `:5035` - is a re-derive that could legitimately resolve the collision. The other seven silently clear a refusal the user has not addressed.

Rows 91 and 114 are the visible surface of the same machine: a cancelled DELETE leaves `#scale-box` red with GENERATE dead (91) and strands the last `.announce` error across a sheet close (114). Rows 116 and 117 are the missing mutants that prove `:4603`'s clear and `:4578`'s `if (paint) showPlaceholderPan();` are load-bearing.

**Acceptance criteria**

- AC-E1: `refusal` survives every caller that is not a seed re-derive. Only `:5035` (and an explicit re-parse) may clear it.
- AC-E2: cancelling an armed DELETE over a rejected seed restores the last parse message rather than clearing unconditionally; `#scale-box`'s `.bad` and GENERATE's disabled state agree with the message shown.
- AC-E3: `hideSheet()` clears the announcer, so no error is stranded on a closed sheet.
- AC-E4: `tests/mutants/d_refusal_cleared_unconditionally.patch` (mutate `:4603` to keep the refusal) is KILLED.
- AC-E5: `tests/mutants/d_disarm_skips_placeholder_repaint.patch` (mutate `:4578` to drop the `paint` guard) is KILLED. Repro from row 117: clear the seed box, arm DELETE, tap a pan note; shipped selects `C4`, mutant selects `A3`.
- AC-E6: **lane E does not touch `tests/suite_health.py` at all.** Floors are MINIMUMS (`tests/suite_health.py:1-20` states it; the only failure is `ran < floor` at `:143`), so E's new e2e tests merge green without a floor edit. Lane F raises the `tests/e2e.test.js` row once in wave 2, covering E's tests and its own. E records the CI-observed `ran N` from its own green run in the PR body so F does not have to re-derive it.

**Verify:** `python3 tests/suite_health.py` and the mutation gate, both green in CI at the head SHA.

**Deck-data guard:** none of this touches `data/decks.json` or geometry.

---

## Lane F: horizontal overscroll (row 95) - sequenced after E merges

`index.html` sets `overscroll-behavior:contain` on its scroll containers (`:108`, `:414`, `:452`) but nothing on the root for the horizontal axis, so a 120px rightward drag on the card can hand the gesture to browser history. PR #89's swipe coverage observed headless Chromium navigating back. On iOS Safari this is the back-swipe, on the owner's stated device.

- AC-F1: an e2e test drives a horizontal drag across the card and asserts the deck stepped and the document did not navigate. It FAILS before the fix.
- AC-F2: `overscroll-behavior-x: none` (or `contain`) on the root; the test passes.
- AC-F3: vertical scrolling in the sheet is unchanged - assert the existing sheet-scroll test still passes.
- AC-F4: the `tests/e2e.test.js` FLOORS row (`tests/suite_health.py:46` today) is raised **once, here**, to the count CI reports for the merged E+F tree - read from CI's `ran N` line, never computed. A floor above the real count reddens CI; one below it guards nothing. F runs after E and G have merged, so no other lane is live in that file.

**Verify:** CI green at the head SHA.

---

## Lane G: harness leaks (rows 107, 108, 109, 110, 69, 98)

Six rows, one file family, all of them costing wall-clock today - row 119 records that a full local `node --test tests/e2e.test.js` is not a usable oracle on this machine, and leaked browsers are why.

- AC-G1 (107): `tests/suite_health.py:263`'s `start_new_session=True` removes node from the foreground process group, so a local Ctrl-C never reaches it and `cdp.js`'s SIGINT reaper (`tests/helpers/cdp.js:79-100`) never runs. Wrap `communicate()` in `try/except BaseException: _kill_group(proc, SIGTERM); _drain(...); raise`. Test: send SIGINT to the health run, assert no surviving node child.
- AC-G2 (108): when both drains time out, `run_node_file` returns with the `Popen` unreaped and its pipes open (`ResourceWarning: subprocess NNNNN is still running`). Reap and close on every exit path. Test: the existing `test_a_killed_suites_own_output_reaches_the_excerpt` runs with `-W error::ResourceWarning` and stays green.
- AC-G3 (109): the excerpt is `(stdout + stderr)[-2000:]`, so a long stderr evicts the TAP output naming what ran. Give each stream its own budget, or take head-and-tail. Test: a suite emitting 10KB of stderr and a short TAP stdout still shows the TAP lines.
- AC-G4 (110): `tests/suite_health.py:289-291`'s browser probe has no timeout while every other subprocess in the file is bounded. Bound it. Test: a `findBrowser()` that sleeps is killed and reported, not hung.
- AC-G5 (69, 98): a run killed by the 180s wall clock leaks its headless Chrome and its `hpfc-prof-*` profile dir. `tests/helpers/cdp.js:42` already has cleanup machinery. Close the leak at the source; **do not** add an age-based sweep from `suite_health.py` (row 98 records why: it can delete a concurrent run's live profile).
- AC-G6: no floor anywhere is lowered by this lane.

**Row 68 is deliberately NOT in this lane.** "buttons and arrow keys step through the deck and wrap" times out on `Input.dispatchMouseEvent` only when the whole file shares one browser session, and passes in 4.4s alone. The cause is unknown, so the work is unbounded: it stays an OPEN queue row, to be scoped on its own once AC-G1..G5 have removed the leaked-browser noise that may well be causing it. Do not skip the test and do not lower the floor in the meantime.

**Verify:** CI green at the head SHA; `tests/test_suite_health.py` runs clean under `-W error::ResourceWarning`.

---

## Lane H: docs and record accuracy (rows 42, 44, 101, 102, 103, 105, 106, 111, 112, 113, 118, 120, 121; closes 47, 100, 46)

One pass, one PR, no code behaviour change except two literals.

- AC-H1 (101): `tools/boot_sim.js:39`'s `if (cards !== 96)` becomes `DECKS.reduce((n, d) => n + d.chords.length, 0)`. **Row 47 is already satisfied and closes as superseded** - `:30-31` already throws per deck on `deckCards !== d.chords.length`, which is exactly what row 47 asked for; only the aggregate literal remained.
- AC-H2 (103, 44): drop the corpus number from `tools/hifi.py:118`'s prose; fix the stale "61 cards" in `CLAUDE.md` (now at `:276` and `:329`).
- AC-H3 (120): five places cite `tests/suite_health.py:45` for the e2e FLOORS row, which is at `:46` - `docs/plans/2026-09-18-swipe-coverage.md:76`, `:93`, `:236`, `:382` and `docs/plans/2026-09-18-queue-drawdown.md:165`. Note lanes E/F/G may move it again; re-derive the line number at commit time rather than trusting this list.
- AC-H4 (111): `docs/plans/2026-09-18-queue-drawdown.md:222-223` prescribes plain `signal.SIGKILL`; what shipped is SIGTERM-then-bounded-drain-then-SIGKILL, deliberately, so `cdp.js`'s reaper can run. Correct the prose to match.
- AC-H5 (105, 106, 121): row 69 gains a forward reference to row 98; `docs/plans/2026-09-18-keyboard-wiring-coverage.md:423`'s "the two rows below" caption is reconciled with its five-row table; queue row 50 is moved from line 511 back into numeric order.
- AC-H6 (102, 112, 113, 118, 42): mark as CLOSED with the reason recorded - each is an on-the-record observation, not work.
- AC-H7 (100, 46): mark WONTFIX with the reasoning above recorded in the row, not deleted.
- AC-H8: the queue table stays 4-column and in order. Verify programmatically:
  `awk -F'|' '/^\| [0-9]+ \|/{if(NF-2!=4) print "bad cells:" NR}' docs/plans/2026-09-16-remaining-work-coordination.md`
  plus an id-monotonicity check and a terminating-blank-line check.

**Verify:** `python3 tools/validate.py` green, CI green at the head SHA.

---

## Handed to the owner, not to a lane

Rows **51**, **67**, **93** need iPhone 14 / iOS 26.6 in hand:

1. **51** - ADD sheet with the keyboard up: `#scale-box` was pushed off screen with GENERATE CARDS visible. Re-check after lane F.
2. **67** - Stage 3 AC5: the `applyKbOffset` translate+cap path on BOTH the ADD and EDIT pages with the keyboard up.
3. **93** - the hands-off-under-zoom policy, never device-checked.

## Sequencing

Three waves. The ordering constraint is not file-disjointness alone - it is that **lane H rewrites line-number citations, and lanes E, F and G all move the lines being cited.**

- **Wave 1: E and G, in parallel.** Genuinely file-disjoint (`index.html` + `tests/e2e.test.js` + `tests/app.test.js` vs `tests/suite_health.py` + `tests/test_suite_health.py` + `tests/helpers/cdp.js`). No cross-lane ask: E needs no floor edit, because floors are minimums.
- **Wave 2: F**, after E merges (shared `tests/e2e.test.js`).
- **Wave 3: H, last.** AC-H3 re-derives every `tests/suite_health.py:NN` citation from the tree at that moment. Running H earlier guarantees it lands wrong: the FLOORS row moves under E, F and G.

Owner device checks run any time after F merges. Row 68 is scoped after wave 1.

---

## NOT in scope

Named so a lane does not drift into them:

- Row 38 (`esc` in attribute context). **Its citation could not be reproduced**: `index.html:3679` holds unrelated code and `grep -n 'function esc' index.html` returns nothing. The row is left OPEN and unassigned until someone re-derives the line. Do not act on it from the row text.
- Row 93's hands-off-under-zoom policy beyond the device check itself.
- `README.md`'s mutant count. The gate is a 90% band (`tests/test_readme_currency.py:64-81`); at 314 stated against 324 on disk, lane E's two new mutants leave it inside the band. No lane edits the README.
- `data/decks.json`, `tools/decks.py` deck dicts, `src/engine/*`, and every generated region.

## What already exists (do not rebuild)

- **Per-deck boot assertion** - `tools/boot_sim.js:30-31` already throws on `deckCards !== d.chords.length`. Row 47 is satisfied; only the aggregate `96` literal at `:39` is work.
- **Title-card chord count** - `tools/decks.py:254-256` rewrites it by regex from `len(chords)`. `TODOS.md`'s "Pygmy title-card blurb says 25 CHORDS" is a stale TODO, not a bug; lane H deletes the item.
- **SIGINT reaper** - `tests/helpers/cdp.js:79-100` exists. AC-G1 is about letting the signal reach it, not writing one.
- **Profile cleanup machinery** - `tests/helpers/cdp.js:42`. AC-G5 closes a leak into existing machinery.
- **Mutation harness self-tests** - `tests/mutation_harness.test.js`. Lanes add patches, not harness.

## Test coverage

```
                         unit      e2e     mutant    CI job
Lane E  refusal clear      -        E2       E4      js suites + mutation gate
        disarm repaint     -        E5       E5      js suites + mutation gate
        announcer reset    -        E3       -       js suites
Lane F  h-overscroll       -        F1       -       js suites
        sheet v-scroll     -     (existing)  -       js suites
Lane G  SIGINT reach      G1        -        -       python suites
        Popen reaped      G2        -        -       python suites (-W error)
        excerpt budget    G3        -        -       python suites
        probe timeout     G4        -        -       python suites
        profile leak      G5        -        -       python suites
Lane H  queue shape       H8        -        -       (awk, local + data integrity)
        boot literal   boot_sim     -        -       data integrity
```

Gap, stated rather than hidden: **AC-G5's leak fix has no direct assertion.** A test that proves no `hpfc-prof-*` survives a wall-clock kill has to kill a real run, and that is the flakiest shape of test this repo has. Lane G asserts it by listing `hpfc-prof-*` before and after the existing killed-suite test in `tests/test_suite_health.py` and requiring the set to be unchanged - an indirect but deterministic proxy. If that proves unstable in CI, the lane records the gap in the queue rather than weakening the assertion.

## Failure modes

1. **A lane lowers someone else's floor to go green.** Arithmetic cannot see it (`tests/suite_health.py:14-19` says so). The reviewer checks the FLOORS diff explicitly; any lowered row is an automatic FAIL.
2. **Lane H's line numbers land stale.** Mitigated by wave 3 plus AC-H3's instruction to re-derive at commit time. If H is ever pulled forward, this is the first thing that breaks.
3. **AC-E1 over-corrects and strands a refusal the user has fixed.** The eight callers are not symmetric; only `:5035` is a re-derive. A wrong split leaves GENERATE dead after a valid edit - worse than the bug being fixed. AC-E2 is the guard: the button state must agree with the message shown.
4. **AC-G1's SIGINT test kills CI's own runner.** The test must signal the child it spawned, never the process group it lives in.
5. **Two lanes rebase onto each other's `index.html`.** E owns app JS, F owns CSS. Same file, disjoint regions, and F is sequenced after E - so a conflict here means the wave order was broken.

## Worktree parallelization

| Wave | Lanes | Worktrees | CI runs |
|---|---|---|---|
| 1 | E, G | 2, concurrent | 2 + bounces |
| 2 | F | 1 | 1 + bounces |
| 3 | H | 1 | 1 + bounces |

Each lane gets its own `git worktree`; the live checkout stays live. A fresh worktree has no `node_modules` - symlink from a sibling on the same base commit and lockfile rather than reinstalling. Each PR is reviewed by a fresh subagent at the verified head SHA, read-and-report only, reading CI's conclusion for that exact SHA. Cap two attempts per lane.

## Cost

4 lanes, ~8 subagent runs, ~4-6 CI runs plus one per bounce. Lanes E and G are the substantive ones; H is a single pass.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | - |
| Outside Review | `codex` (last run 2026-09-16) | Independent 2nd opinion | 0 this plan | skipped | - |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 4 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | - |

**Findings, all folded into the plan above:**

1. **Ordering defect in the draft.** AC-H3 rewrites five `tests/suite_health.py:45` citations to `:46`, but lanes E, F and G all move that row. Fixed by the owner-accepted 3-wave resequence: H runs LAST and re-derives at commit time.
2. **Row 68 was unbounded scope inside lane G.** A flaky test with no known cause is not an acceptance criterion. Pulled out as its own OPEN queue row, to be scoped after wave 1 removes the leaked-browser noise that may be causing it.
3. **A cross-lane ask that did not need to exist.** `tests/suite_health.py` FLOORS rows are MINIMUMS - the only failure is `ran < floor` (`:143`), as the module docstring states at `:14-19`. Lane E merges green with no floor edit. AC-E6's integrator handoff removed; lane F raises the `tests/e2e.test.js` row once in wave 2.
4. **Two rows asked for work already shipped.** `tools/boot_sim.js:30-31` already throws per deck (row 47 closes as superseded); `tools/decks.py:254-256` already derives the title-card chord count by regex, so `TODOS.md`'s "Pygmy title-card blurb says 25 CHORDS" is a stale TODO, not a bug.

**Appendix - suppressed finding (unverifiable citation).** Row 38 claims an `esc` helper at `index.html:3679` used in attribute context at `:3817-3818`. `sed -n '3679,3682p'` returns unrelated code and `grep -n 'function esc' index.html` returns nothing. Per the pre-emit verification gate, no finding is emitted on a line that cannot be quoted. Row 38 stays OPEN and unassigned; it is listed under "NOT in scope".

**OUTSIDE COVERAGE:** none for this plan. Codex last ran 2026-09-16 against a different plan; not re-run here, and no external review is claimed.

**VERDICT:** ENG CLEARED - ready to implement. CEO, design and DX reviews were not run and are not required for a queue-drawdown plan with no new user-facing surface.

NO UNRESOLVED DECISIONS
