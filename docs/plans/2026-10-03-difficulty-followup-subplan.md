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
  site (`:583`, `:605`, `:670` at `9f4f61c`); each reviewer invents one more shape.
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
  with a bounded criterion. (Alternative rejected: one more patch on #207, which
  is the pattern the owner's rule forbids. Whether the probe work runs at all is
  S-7.)
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
- **S-6. PR #207 is superseded, not merged.** It gets a comment linking lane R's
  PR and this plan. Closing it is the owner's click (closing a PR is not in the
  AFK grant). Its branch is kept (no deletion of unmerged work;
  lane P starts from its probe files).
- **S-7. Only lane R runs now. Lanes P and H are specified here and wait for the
  owner's go** (added after eng review, ER-1..ER-8 below). They are developer
  tooling outside the sequence-difficulty goal, main's probe already fails closed
  (exit 2) on a hole, and the review showed lane P's blast radius is far larger
  than the nit it started from: 8 `uid_fit_*` mutants on the probe, and for the
  CI-log fix about 21 mutants plus two test files on `tests/suite_health.py`.
  Recommendation to the owner: run P and H later as their own small workstream,
  or drop them.
- Owner, 2026-10-03: lane P dropped; lane H runs; D3 reviewer nits left.

## 4. Lanes

File ownership is disjoint, so the lanes can run in parallel and merge in any
order. Soft couplings, none of which conflict: `sqe_count_not_positional` (R)
selects a test in `tests/app.test.js` (P); `uid_fit_scrollbars_not_neutralised`
(P, context only) selects a test in `tests/e2e.test.js` (R).

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
2. `python3 tools/refresh_mutants.py`, then `--check`. Expected to change
   nothing (eng review built this tree in a scratch index: all 582 mutants
   apply). A rewrite of any patch outside Owns is a stop-and-report.
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
- R5. CI 11/11 at the pushed head, and `js suites (unit + e2e)` green on four
  consecutive attempts at that SHA (the first run plus three reruns of that job).
  This is the answer to H4 for this lane: the five rail tests are the only new
  e2e code, the one unexplained red was the only rerun in the last 60 runs, and
  every local repeat so far was on macOS, not the Linux runner. The CI log cannot
  name a failing test today (lane H), so a red attempt is NOT rerun to green:
  it stops the lane and goes to the owner with the choice of running lane H
  first.

**Non-goals.** Raising the `tests/e2e.test.js` FLOORS row in
`tests/suite_health.py` for the five new tests (verbatim from `9f4f61c`, which
did not raise it; lane H owns that file). Any change to rail behaviour, test wording, or the nits reviewers
listed on the rail tests (one-sided bounds, fixed sleeps, inert `!sameDeal` and
`railEl` identity clauses, the 1 px 667x375 clamp that main shares). They are
recorded in section 6, not fixed here.

### Lane P: probe (branch `claude/panel-fit-measure-contract`) - WAITS FOR OWNER GO

**Owns:** `tools/probe/panel_fit.js`; the panel-fit describes in
`tests/app.test.js`; `tests/mutants/uid_panelfit_*.patch`; context refreshes
only of the eight `tests/mutants/uid_fit_*.patch` that patch the probe.

**Design.**
- `checkMeasured(result, cells)` is the only reader of a raw `measure()` return.
  There are five `measure()` calls of three kinds: reference (candidate only),
  sweep (base and candidate), invariance (base and candidate, per row). All five
  go through it.
- Contract: `result` is an array with one row per requested cell; each row is an
  array of exactly `MODES.length` entries; each entry is a measured cell or a
  hole. A non-array, or an array containing a defined non-array row, throws
  `PanelFitError("malformed measurement: ...")`. A missing row, a short row and a
  `null`/`undefined`/partial entry are all holes: rows are returned padded to
  `MODES.length` with `null`, so a hole has exactly one representation.
- A **measured cell** is the full shape the readers dereference, derived from
  `judgeCell`, `vectorOf`, `vectorsEqual`, `countGutter`, `thresholdCell` and
  `overflowViewports`, and matching what the page-side measurer returns:
  `controls` (object; each entry has boolean `rendered` and, when rendered, a
  finite `bottom`), finite `needed` and `avail`, `overflowX` with finite `panel`
  and `doc`, `stops` (array), finite `gutter`, boolean `modal`. This field list
  was read from the code by the eng review and has not been run: the lane's
  first step is to confirm it against a real complete run (P1 fails if the
  validator rejects anything the shipped measurer returns) and to correct the
  list here, in the plan, if it is wrong.
- The reference cell requires zero holes and throws the existing "reference cell
  ... was not measured" error. Sweep and invariance count each hole as skipped.
- `assertRunComplete` stays before the invariance pass and at the end.
- No catch-all: `runFont` does not wrap arbitrary errors into `PanelFitError`.
- Start from `9f4f61c`'s `panel_fit.js` and `tests/app.test.js` (the `RootClass`
  seam and the `runFont` test are kept), then replace the per-site guards.
  `uid_panelfit_skip_not_counted` anchors on a guard this removes: rewrite it
  against `checkMeasured`.
- `python3 tools/refresh_mutants.py`, then `--check`, after the code change.

**Acceptance.**
- P1. A complete run is unchanged: on `--base 486813c --font fallback --widths 320-330`
  stdout is identical to main's probe after dropping the `wall time:` line, same
  exit code; both `panel fit` CI jobs green with 0 skipped and the same measured
  count as the last green run on main.
- P2. `checkMeasured` unit test, table-driven: non-array; array of non-arrays;
  missing row; `[]` row; row of 1; row of 2; `null`, `undefined` and `{}`
  entries; and one row per field of the measured-cell definition, missing and
  wrong-typed. Each yields the malformed error or padded rows with the hole at
  the right index; no returned row has a length other than `MODES.length`.
- P3. Fuzz through the real `runFont` with a fake `RootClass`: a seeded generator
  (fixed seeds, at least 500 cases) corrupts one `measure()` return per case,
  choosing among the five calls and P2's shapes. The fake records that the
  targeted call was reached and corrupted, and the test asserts it. Each case
  rejects with a `PanelFitError` whose message matches its call kind (reference:
  "was not measured"; sweep: "cells skipped" naming the cell; invariance: the
  "(invariance)" suffix). The clean control run has `invariance > 0`. A control
  case where the fake throws a plain `Error` propagates as a non-`PanelFitError`.
- P4. Dropped as a separate criterion: `main()` has no injection seam, and P3
  covers the same paths at `runFont`. The lane re-runs the review-3 repro
  (short reference row) once by hand and reports the output.
- P5. Mutants, each selecting exactly one test: skip not counted (rewritten);
  `checkMeasured` bypassed at the reference site; bypassed at the invariance site
  (today an invariance-only hole with the skip line dropped exits 0); padding
  removed; catch-all wrapping added.
- P6. Moved to lane H.
- P7. CI 11/11 at the pushed head.

**Non-goals.** Changing what the probe measures, its grid, its rules or its
printout. Touching `index.html`, `tests/e2e.test.js`, `tests/suite_health.py` or
any rail mutant. Making the page-side measurer return holes.

### Lane H: failing test names survive the CI log - WAITS FOR OWNER GO

**Owns:** `tests/suite_health.py`; `tests/test_suite_health.py`;
`tests/test_failure_diagnosability.py`; the `h_*`/`e_*`/`hc_*` mutants that patch
`suite_health.py`.

- Change site is `collect_js` / `emit_js` (CI's js job runs `--emit-js`, which
  stores `excerpt(out)`), where the raw TAP still exists: record each `not ok`
  test name and its first assertion line in a separate bounded list, printed
  outside the elided region.
- H1. Unit test: TAP with one failure in the middle of more than 60k characters
  yields that test's name in the emitted output.
- H2. `test_failure_excerpt_is_bounded` still holds; the new list has its own
  stated cap (number of entries and characters per entry).
- H3. One mutant for the new list; every mutant on `suite_health.py` still
  applies after `refresh_mutants.py`. Mind the five `h_*` patches that edit
  `tests/mutation_check.sh` itself (memory note: they need a context refresh and
  `git apply --check` for all five).
- H4. FLOORS rows raised for `tests/e2e.test.js` (lane R's five tests) and for
  whichever file gains H1.
- H5. CI 11/11.

## 5. Gates

- Each PR: CI green at a head SHA equal to the lane's local tip, then a fresh
  independent reviewer at that SHA. The reviewer brief quotes this plan's
  acceptance list verbatim and I add no pass/fail rules of my own to it (H3).
  The reviewer is not muzzled: it still runs the full `/review`, and a FAIL is
  valid for an unmet written criterion, a boundary violation, or a concrete
  defect a user or a CI run would hit, including a regression versus main.
  Robustness of developer tooling against inputs the shipped code cannot produce
  is a nit unless a written criterion covers it.
- Any reviewer FAIL on lane R, or a red R5 attempt: stop and interview the
  owner. No bounce. This diff has been measured by two reviewers, and a third
  failure of this work means the plan is wrong, not the patch.
- A reviewer FAIL on lane P or H: one bounce if the failing case is inside P1-P7; a
  case outside the written acceptance is a plan gap, recorded and brought to the owner, not patched.
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

## 7. Eng review (2026-10-03, `/plan-eng-review` at b536b61)

Verdict: lane R clear to execute; lane P not ready as first written. Folded in:

- ER-1 (high). "Measured cell" was `controls` + `needed` + `avail`; the readers
  also dereference `overflowX`, `stops`, `gutter`, `modal` and control `bottom`.
  Definition widened to the full shape.
- ER-2. P3 could be passed by a catch-all rewrap or by never reaching the
  corrupted call. Added per-kind messages, a reached-and-corrupted assertion,
  `invariance > 0`, a propagation control and a catch-all mutant.
- ER-3. P4 had no mechanism (`main()` has no seam). Dropped as a criterion.
- ER-4. Lane P's Owns missed eight `uid_fit_*` mutants on the probe, and the
  existing skip mutant must be rewritten, not reused.
- ER-5. P6 named the wrong surface and omitted what pins it. Moved to lane H.
- ER-6. P1's "byte-identical" cannot hold (`wall time:` line).
- ER-7. Lane R step 2 is a no-op; said so.
- ER-8. Lane R's FLOORS row and the two soft couplings made explicit.
- Corrected: guard sites are `:583`, `:605`, `:670` (`:643` is
  `assertRunComplete`); five `measure()` calls, not four.
- Not run by the review: any test, probe run or mutation check; the outside
  voice (codex) pass.

## 8. Second read (2026-10-03, at the owner's request, after the eng review)

Checked the plan against the code and the three review reports. Changes made:

- R5 was unsatisfiable: it required naming a failing test that the CI log
  cannot name. Replaced with four consecutive green `js suites` attempts on the
  runner, and a red attempt stops the lane.
- The gate said nothing about a lane R FAIL inside R1-R5. Now any FAIL stops.
- "The reviewer adds no criteria" read as if the reviewer could not report a
  real bug. Reworded: it constrains my brief, not the reviewer's findings.
- S-6 had me closing #207; that is outside the AFK grant.
- S-1 rejected "dropping the probe work" while S-7 defers it; reconciled.
- The measured-cell field list is marked as read, not run.

Confirmed sound, by measurement: lane R's tree was built from `origin/main`
plus the eight owned paths at `9f4f61c`; the `index.html` and `tests/e2e.test.js`
diffs are identical to #207's (R1); 8 files change (R2); `refresh_mutants.py`
refreshed 0 of 582; `inline_engine.py --check`, `sync_decks.py --check`,
`validate.py` pass; `tests/app.test.js` + `tests/mutation_harness.test.js` 295/295.

Residual risks the plan does not remove:
- Nothing here has been tested on WebKit or a real device; smooth-scroll
  behaviour on iOS Safari is inferred.
- If the one CI red was a rail test with a low flake rate, four attempts can
  miss it. Lane H is what makes the next red diagnosable.
- Lanes P and H are specified from reading, not from a spike.
