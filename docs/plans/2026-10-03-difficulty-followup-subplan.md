# D2 follow-up sub-plan (2026-10-03)

Regroup after PR #207's second reviewer FAIL, per the owner's rule: on repeated
failures in a difficulty lane, stop patching, draft a sub-plan, review it, resume.

Parent: `docs/plans/2026-10-02-sequence-difficulty.md`. Supersedes the informal
brief PR #207 was run from (that lane had no written plan, which is hurdle H3).

## 1. Where things stand

| | |
|---|---|
| main | `4f02700` (D2 #203 and D3 #208 merged) |
| PR #207 | `claude/difficulty-d2-followup` at `9f4f61c`, CI 11/11, NOT mergeable under the gate: reviewer FAIL |
| Review 1, `d091f5a` | FAIL. Rail froze mid-scroll when a flip landed inside the smooth-scroll window. Real, user-visible. Fixed at `ff0ea50`. |
| Review 2, `ff0ea50` | PASS_WITH_NITS. Rail correct in every measured state. Probe guard crashed before it could report. |
| Review 3, `9f4f61c` | FAIL. Rail correct again (0.00 px deviation, both fonts, 380x740 and 320x568, gaps 0-400 ms, 6x throttle). Probe: a reference row with fewer than three mode entries passes `refCell.every(isMeasured)` at `tools/probe/panel_fit.js:583` and dies with `TypeError: refRendered is not iterable`, exit 2. Same on main. Unreachable from the shipped measurer (`cell: (modes) => modes.map(one)` always returns three entries). |

## 2. Hurdles

- **H1. Two unrelated goals share one gate.** The rail fix is app code a player
  sees. The probe guard is developer tooling. The rail has passed two independent
  measurements and is blocked by the tooling half.
- **H2. The probe criterion is unbounded.** "An unmeasured cell never produces a
  TypeError" has no finite list of shapes behind it. The lane guards each use
  site (`:583`, `:604`, `:643`, `:670`); each reviewer invents one more shape.
  Reviewer 3 found four more TypeError shapes beyond the one it failed on, and
  a subagent of theirs reported (unverified) two degenerate roots that exit 0.
- **H3. No written plan.** The follow-up was spawned from a chat brief, and my
  own reviewer brief introduced the rule that failed it ("any TypeError ... is a
  FAIL"). Acceptance must be written before the lane, not by the reviewer brief.
- **H4. One unexplained CI red.** Attempt 1 at `ff0ea50` failed one e2e test
  whose name the log elides (`tests/suite_health.py` truncates the excerpt).
  782 local executions of the rail tests across two reviewers, under throttle
  and load, never failed. Unattributable.

## 3. Decisions

- **S-1. Split.** The rail fix ships alone. The probe work becomes its own lane
  with a bounded criterion. (Alternatives rejected: one more patch on #207, which
  is the pattern the owner's rule forbids; dropping the probe work, which leaves
  main with a guard that crashes instead of reporting.)
- **S-2. Rail lane carries no new code.** Its diff is the rail subset of
  `9f4f61c`, byte for byte. Nothing in it is redesigned.
- **S-3. Probe: validate at one choke point, not at each use.** Every value
  `Root.measure()` returns passes through one function before anything reads it.
  Downstream code may then assume the shape, and the per-site guards go.
- **S-4. The probe criterion is the validator's contract plus a fuzz test over
  it**, not "no TypeError for any input a reviewer can construct".
- **S-5. H4 is fixed at the source of the blindness, not guessed at.** The
  failing test's name must survive into the CI log. No retry logic, no test
  changes on speculation.
- **S-6. PR #207 is closed unmerged** once both replacement PRs are open, with a
  comment linking them. Its branch is kept (no deletion of unmerged work).

## 4. Lanes

File ownership is disjoint, so the lanes run in parallel and merge in any order.

### Lane R: rail (branch `claude/difficulty-rail-scroll`)

**Owns:** `renderSeqRail` and its two module variables in `index.html` (app JS,
outside engine regions); the "progression rail scroll continuity" describe in
`tests/e2e.test.js`; `tests/mutants/uid_rail_*.patch` (four),
`d12_no_scroll_into_view.patch`, `sqe_count_not_positional.patch`.

**Steps.**
1. Branch from `origin/main`. Take those files from `9f4f61c`
   (`git checkout 9f4f61c -- <paths>`); for `tests/e2e.test.js` and `index.html`
   confirm the resulting diff vs main equals `git diff origin/main 9f4f61c` for
   the same paths.
2. `python3 tools/refresh_mutants.py`, then `--check`.
3. Push, open the PR, wait for CI.

**Acceptance.**
- R1. `git diff origin/main <head> -- index.html tests/e2e.test.js` is identical
  to the same diff at `9f4f61c`. Verify: `diff <(git diff origin/main 9f4f61c -- index.html tests/e2e.test.js) <(git diff origin/main HEAD -- index.html tests/e2e.test.js)`.
- R2. No file outside the Owns list changes. Verify: `git diff --stat origin/main HEAD`.
- R3. Settled flip: no sampled frame differs from the settled scrollLeft; a step
  ends with the current chord in view, instant under reduced motion; a new deal
  starts at scrollLeft 0; a flip inside the smooth-scroll window ends on the
  current chord. Verify: the five rail e2e tests, in CI.
- R4. The six mutants apply and are killed. Verify: CI mutation gate;
  `node --test tests/mutation_harness.test.js`.
- R5. CI 11/11 at the pushed head. If `js suites` is red, the failing test's
  name and message are captured before any rerun.

**Non-goals.** Any change to rail behaviour, test wording, or the nits reviewers
listed on the rail tests (one-sided bounds, fixed sleeps, inert `!sameDeal` and
`railEl` identity clauses, the 1 px 667x375 clamp that main shares). They are
recorded in section 6, not fixed here.

### Lane P: probe (branch `claude/panel-fit-measure-contract`)

**Owns:** `tools/probe/panel_fit.js`; the panel-fit describes in
`tests/app.test.js`; `tests/mutants/uid_panelfit_*.patch`;
`tests/suite_health.py` and its tests (for P6 only).

**Design.**
- `checkMeasured(result, cells)` is the only reader of a raw `measure()` return.
  Contract: `result` is an array with one row per requested cell; each row is an
  array of exactly `MODES.length` entries; each entry is either a measured cell
  (an object with `controls`, and numeric `needed` and `avail`) or a hole.
  Anything else that is not an array of rows throws
  `PanelFitError("malformed measurement: ...")`. A missing row, a short row, and
  a `null`/`undefined`/partial entry are all holes: the function returns rows
  padded to `MODES.length` with `null`, so a hole has exactly one representation.
- All four call sites (reference cell, sweep candidate, sweep base, invariance)
  call it. The reference cell requires zero holes and throws the existing
  "reference cell ... was not measured" error otherwise. Sweep and invariance
  count each hole as skipped, as today.
- `assertRunComplete` stays where `9f4f61c` put it (before the invariance pass)
  and at the end.
- Start from `9f4f61c`'s `panel_fit.js` and `tests/app.test.js` (the `RootClass`
  seam and the `runFont` test are kept), then replace the per-site guards.

**Acceptance.**
- P1. A complete run is unchanged. Verify: on `--base 486813c --font fallback --widths 320-330`,
  stdout and exit code are byte-identical to main's probe; both `panel fit` CI
  jobs green with 8019 measured, 0 skipped.
- P2. `checkMeasured` unit test, table-driven: for each of {non-array, array of
  non-arrays, missing row, `[]` row, row of 1, row of 2, `null` entry,
  `undefined` entry, `{}` entry, `{controls:{}}` without `needed`/`avail`,
  `needed: null`} the result is either the malformed error or padded rows with
  the hole at the right index. No case returns a row whose length is not
  `MODES.length`.
- P3. Fuzz test through the real `runFont` with a fake `RootClass`: a seeded
  generator (fixed seed list, at least 500 cases) corrupts one `measure()` return
  per case, choosing the call (reference, sweep candidate, sweep base,
  invariance) and a shape from P2's table. Every case rejects with a
  `PanelFitError`; none resolves; none rejects with any other error type.
- P4. End to end: the reviewer's injections exit 2 with a `panel fit: Error:`
  line and no `TypeError` text, for a hole in each of the four calls, including
  the short reference row that failed review 3.
- P5. Mutants, each selecting exactly one test: skip not counted (exists);
  `checkMeasured` not called at the reference site; not called at the invariance
  site (reviewer's M2, which today turns an invariance-only hole into exit 0);
  padding removed.
- P6. `tests/suite_health.py` (or whatever writes the CI excerpt) always prints
  the name and first assertion line of every failing test, outside the truncated
  region. Verify: a unit test feeding it TAP with one failure in the middle of
  more than 60k characters. If the truncation is not in a file this lane can own
  cleanly, stop and report instead of widening scope.
- P7. CI 11/11 at the pushed head.

**Non-goals.** Changing what the probe measures, its grid, its rules or its
printout. Touching `index.html`, `tests/e2e.test.js` or any rail mutant. Making
the page-side measurer return holes (it cannot today; this lane hardens the
reader only).

## 5. Gates

- Each PR: CI green at a head SHA equal to the lane's local tip, then a fresh
  independent reviewer at that SHA. The reviewer brief quotes this plan's
  acceptance list verbatim and adds no criteria of its own (H3).
- A reviewer FAIL on lane R for anything other than R1-R5: stop and interview
  the owner; the diff has already been measured twice.
- A reviewer FAIL on lane P: one bounce if the failing case is inside P1-P7; a
  case outside them is a plan gap, recorded and brought to the owner, not patched.
- Merge order is free. The second PR merges `origin/main` only if GitHub reports
  a conflict.

## 6. Recorded, not fixed (owner's call)

- Rail: at 667x375 the last chord can sit up to 1 px past the rail edge; main
  does the same.
- Rail tests: one-sided "untouched" bounds; a fixed 900 ms sleep; the in-window
  test does not assert the flip landed mid-flight; `frames.length > 10` depends
  on wall clock.
- Rail code: `children[0] === railEl` and `|| !sameDeal` are inert today.
- Behaviour changes versus main that ship with lane R: last -> first now
  animates instead of jumping; a flip after a manual rail scroll re-centres from
  the manual position (main re-centres via 0).
