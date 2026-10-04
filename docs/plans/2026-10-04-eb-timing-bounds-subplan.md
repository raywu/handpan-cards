# EB sub-plan: restore the timing bounds the sleep conversion dropped

Parent: `docs/plans/2026-10-03-complexity-refactor.md`, lane EB (section 4), step 2.
Branch: `claude/cx-eb`, PR #220, head 50c9f96. Written after the second
reviewer FAIL on that lane (contingency rule: stop patching, plan, review, resume).
Eng-reviewed 2026-10-03 (`/plan-eng-review`, spawned session, decisions D1-D6
below; the ledger and report are at the end of this file).

## 1. What went wrong

Step 2 says "replace the 16 fixed sleeps with `waitFor` on the condition each one
waits for". Most of the sixteen sleeps were not condition waits. They were
upper bounds on a timer in `index.html` (the eatClick decay, the 160 ms wheel
gesture gap, the fly-out duration): the test slept for slightly longer than the
timer and then asserted the state the timer must have produced. A `waitFor` on
that state with any timeout longer than the sleep lets a lengthened timer pass,
which violates the parent plan's section 2 non-goal ("no assertion loosened or
moved to a weaker oracle"). Two reviewers caught this on three sites in turn
(9991 and 10267 at ec612c3, fixed at 50c9f96 with `waitElapsed`; 9261 at 50c9f96,
still open).

The fix pattern that passed review is already on the branch: `waitElapsed(ms,
label)` (`tests/e2e.test.js:249` at 50c9f96). **Be honest about what it is: a
sleep.** It is main's `setTimeout(r, ms)` moved onto the page's clock - the
same clock the timer under test runs on - and then the original assertion runs
unchanged. It is not a condition wait and the parent plan's step 2 wording
("waitFor on the condition each one waits for") does not describe it; the PR
body must say "timing-bound sleeps stay sleeps, measured on the page clock"
rather than claiming all 16 became condition waits (D3).

At 50c9f96 the helper is implemented as `b.waitFor(performance.now() - mark >=
ms)`, which `tests/helpers/cdp.js:204` polls every 40 ms: the wait returns
between `ms` and `ms + 40` plus a CDP round trip. On row 15 that pushes a 180 ms
wait toward the 220 ms end of the fly-out it must still observe. Step 1 therefore
re-implements the helper body as a single page-side awaited timer (D3) so the
wait is exactly `ms` on the page clock with no poll overshoot; name, signature
and every call site stay as they are.

## 2. Goal and non-goals

- **Goal:** every one of the 16 converted sleeps is either a condition wait
  with a stated bound or a `waitElapsed(main's ms)` followed by main's
  assertions unchanged. No timing mutant that main kills survives at head.
  js suites job stays at or under 262 s.
- **Non-goals:** `index.html` (probes in step 2 edit it transiently and revert;
  nothing is committed); renaming any test; reviewer nits from #220
  (rail-scroll default bound, re-press settle timeout, one-sided wheel wait,
  railText merge); any describe move; new e2e tests.
- **Owns / never touches:** unchanged from the EB block. Everything this
  sub-plan commits is in `tests/e2e.test.js` or `tests/mutants/`.

## 3. Classification (line numbers are origin/main at 7bf898f)

| # | main line | main sleep | kind | at 50c9f96 | action |
|---|---|---|---|---|---|
| 1 | 8537 | 900 (rail scroll) | condition | scroll-stability poll, default 5000 ms bound | keep |
| 2 | 9261 | 50 (touch eatClick decay) | timing | unbounded `waitFor(eatClick === false)` | `waitElapsed(50)`; rest of the test unchanged |
| 3 | 9802 | `150 * represses` (re-press backoff) | condition | `waitForPendingSettle()` | keep |
| 4 | 9991 | 450 (mouse eatClick decay) | timing | `waitElapsed(450)` | done |
| 5 | 10024 | `DECAY_MS / 2` | timing | `waitElapsed` | done |
| 6 | 10032 | `DECAY_MS / 2 + 100` | timing | `waitElapsed` | done |
| 7 | 10070 | 100 (tap mid fly-out) | timing (lower bound on the fly-out) | `waitFor(currentTime >= 60)` | `waitElapsed(100)`; assertion `flight !== null` unchanged |
| 8 | 10129 | 150 (sample ages out) | timing | `waitElapsed(150)` | done |
| 9 | 10181 | 250 (gap fires, no step, transform cleared) | timing | `waitFor(wheel===null && flight===null, 1000)` | `waitElapsed(250)` |
| 10 | 10196 | 250 (gesture ends, cleanup) | cleanup, no assertion follows | same | keep (D2) |
| 11 | 10211 | 250 (springBack keyframes) | timing | `waitFor(wheel===null && animations>0, 1000)` | `waitElapsed(250)` |
| 12 | 10254 | 250 (ctrl+wheel no step) | not a bound | same as 9 | keep (D2) |
| 13 | 10267 | 220 (gesture gap) | timing | `waitElapsed(220)` | done |
| 14 | 10309 | 250 (panel open, no step) | not a bound | same as 9 | keep (D2) |
| 15 | 10335 | 180 (gap fired, still mid-flight) | timing | `waitFor(flight!==null && wheel===null, 1000)` | `waitElapsed(180)`; assertion unchanged |
| 16 | 10350 | 250 (momentum mid-flight, no second step) | not a bound | same as 9 | keep (D2) |

Line 131 (server-boot poll, 40 ms) was never converted and stays.

Why rows 9, 11 and 15 are timing and not condition: each sleep is just over the
160 ms gap timer, and the assertion after it (`xf.none`, keyframes readable,
`flight !== null && wheel === null`) is true only if the gap timer already
fired. With a 600 ms gap, main fails those assertions and the
`waitFor(..., 1000)` form passes. Row 7 is the mirror case: main asserts the
fly-out is still live at 100 ms; the `currentTime >= 60` wait passes at head
for a fly-out shortened to 80 ms.

Why rows 10, 12, 14 and 16 are NOT bounds (D2, verified against
`index.html` 8949-8965 at 50c9f96): row 10's sleep is trailing cleanup with no
assertion after it. Row 12's wheel handler hits `if (e.ctrlKey) return;` before
any gesture object exists, so there is no gap timer to bound. Row 14's
panel-open gesture is created with `skip = true` and row 16's second wheel
burst lands mid-flight; in both the asserted count holds whether or not the
gap timer has fired. A `waitFor` with a bound there is not weaker than main's
sleep because main's sleep bounded nothing. These four keep the form at
50c9f96.

Added cost: rows 2, 7, 9, 11, 15 sum to 830 ms with no poll overshoot (D3),
against a 166 s run at 50c9f96 and a 262 s budget.

## 4. Steps

1. Re-implement the body of `waitElapsed(ms, label)` (`tests/e2e.test.js:249`)
   as one page-side awaited timer: `await b.eval(\`return new Promise((r) =>
   setTimeout(r, ${ms}));\`)` (`b.eval` wraps in a plain arrow and evaluates
   with `awaitPromise: true`, `tests/helpers/cdp.js:178-180`; no `await`
   keyword inside the expression). Keep the name, signature and `label`.
   Then convert rows 2, 7, 9, 11, 15 to `waitElapsed(<main's ms>, <label>)`
   with the assertions that follow left byte-identical to main's.
   - V per row: `TAP --test-name-pattern='<exact name>' tests/e2e.test.js | grep '^# pass 1$'`
   - V helper: rows 4, 5, 6, 8, 13 still `# pass 1` after the body change.
2. Probe each converted row with the timing mutant named below. The e2e
   server reads `index.html` from the worktree on every request
   (`tests/e2e.test.js:63-75`, `Cache-Control: no-store`), so the probe is an
   in-place edit of the worktree's `index.html` followed by `git checkout --
   index.html`; there is no scratch copy. Record for each row BOTH lines in
   the PR body: `# fail 1` with the probe applied and the `not ok` line naming
   that test, then `# pass 1` after the revert (D6). Probes are evidence, not
   committed mutants (parent section 5 cap and rule 1).
   - row 2: `setEatClick(true, pointerType === "mouse" ? 400 : 0)`
     (`index.html:8855`) -> `? 400 : 150`
   - row 7: `SWIPE_MOMENTUM_MAX_MS = 320` (`index.html:8713`) -> `80`. NOT
     `SWIPE_OUT_MS`: row 7's drag is a mouse release, and `release()` passes
     `vx` into `flyOut()` for mouse (`index.html:8867`), which then takes
     `swipeOutTiming()` (`:8746`) instead of the fixed `SWIPE_OUT_MS` curve
     (`:8804-8806`). `duration = min(MAX, max(MIN, d / v))`, so `MAX = 80`
     forces every mouse fly-out to 80 ms regardless of velocity (D4).
   - rows 9, 11, 15: `WHEEL_GESTURE_GAP_MS = 160` (`index.html:8929`) -> `600`
   - rows 10, 12, 14, 16 (kept): run each row's test at head with the 600 gap
     applied and record `# pass 1`. That is the evidence that the assertion
     does not depend on the timer, so main's sleep was never a bound and
     there is nothing to restore (D2, D6).
3. Re-cut `tests/mutants/eb_waitfor_condition_inverted.patch`: it inverts row
   2's `waitFor`, which step 1 removes, and after step 1 nothing it anchors
   on exists. New patch `eb_waitelapsed_zero.patch`: in `waitElapsed`'s body,
   `setTimeout(r, ${ms})` -> `setTimeout(r, 0)`. `# kills:` / `# suite:` =
   row 4's test, `card swipe: a click more than 400ms after a committing
   mouse drag is not eaten and flips` (`.` for spaces, no quotes): with a
   zero wait the 400 ms decay has not run, `eatClick` is still `true`, and
   main's `assert.strictEqual(..., false)` fails for the right reason. Verify
   the `not ok` line names it; strip any `index` line (D5). Do NOT invert an
   assertion: an inverted assertion is killed by any wait length and proves
   nothing about the wait. One patch removed, one added: the count stated at
   root `README.md:127` does not change, so it is not restated.
4. `node --test tests/mutation_harness.test.js`, `python3 tools/validate.py`,
   `python3 tools/refresh_mutants.py --check`.
5. Merge `origin/main` (now 6f15af3, after #221) into the branch. Push. CI at
   the new head; js suites at or under 262 s.
6. Correct the "Gotchas learned in wave 2" entry in the lane-common brief: the
   remedy for a timing-bound sleep is `waitElapsed(main's ms)` - a sleep on the
   page clock - not `timeout: 1000`, and a sleep whose following assertion does
   not depend on the timer is not a bound at all. (Scratchpad file, not in the
   repo.)

## 5. Acceptance

- Every row in section 3 matches its "action" column at head.
- All five probes in step 2 show `# fail 1` with the probe applied and
  `# pass 1` after the revert; the four kept rows show `# pass 1` under the
  600 ms gap.
- `eb_waitelapsed_zero.patch` is killed by its own `# suite:` and the `not ok`
  line names row 4's test.
- CI green at the pushed head; js suites job at or under 262 s.
- Fresh swarm-reviewer PASS or PASS_WITH_NITS at that SHA.

## Decision ledger (plan-eng-review, 2026-10-03)

| D | Decision | Chosen | Why |
|---|---|---|---|
| D1 | Run /office-hours first? | No (recommended) | Problem statement and goal are already fixed by the parent plan and two reviewer FAILs. |
| D2 | Rows 10/12/14/16: timing bounds or not? | Not bounds; keep the 50c9f96 form (recommended) | Row 10 has no assertion after it; 12 returns on ctrlKey before any gesture; 14 is `skip=true`; 16's count holds regardless of the gap timer. Converting them would add 1 s for no oracle. |
| D3 | What is `waitElapsed` and how should it sleep? | A page-side awaited `setTimeout` of exactly `ms`; the plan states plainly it is a sleep (recommended) | The 40 ms `b.waitFor` poll overshoots 180 toward the 220 ms flight end on row 15. Same clock as the timer under test, zero overshoot, 830 ms total cost. |
| D4 | Row 7 probe | `SWIPE_MOMENTUM_MAX_MS 320 -> 80` (recommended) over `SWIPE_OUT_MS 220 -> 80` | Codex finding, verified: a mouse release goes through `swipeOutTiming()`, so `SWIPE_OUT_MS` never reaches row 7's fly-out and that probe could not fail at any head. |
| D5 | Step 3 mutant re-cut | Zero the helper's timer, `# kills:` row 4 (recommended) over inverting row 4's assertion | An inverted assertion dies under any wait; zeroing the wait dies only because the wait mattered. Deviates from rule 3's "same `# kills:`" only because row 2 (decay 0 ms) cannot kill a shortened wait; the EB block's "one representative converted sleep" licenses the move. |
| D6 | Probe evidence protocol | In-place edit + revert, record fail-with-probe and pass-after-revert; kept rows record pass under the 600 gap (recommended) | Codex: a single `# fail 1` is not differential. Both lines per row make the probe's sensitivity visible to the reviewer; the e2e server reads the worktree file per request so there is no scratch-copy variant. |

## GSTACK REVIEW REPORT

| Section | Issues found | Resolved | Deferred | Notes |
|---|---|---|---|---|
| Scope challenge | 1 | 1 | 0 | Rows 10/12/14/16 reclassified (D2); converted set is 5 rows, not 9. |
| Correctness | 3 | 3 | 0 | `waitElapsed` is a sleep with poll overshoot (D3); row 7 probe targeted the wrong constant (D4); step 3 mutant proved nothing about the wait (D5). |
| Line references | 8 | 8 | 0 | helper 249 not 31; 8855 not ~8850; main lines 9261/9802/9991/10129/10267/10335; boot poll 131 not 126. |
| Cost | 1 | 1 | 0 | 830 ms, not 1.78 s. |
| Ownership / non-goals | 0 | 0 | 0 | Only `tests/e2e.test.js` and `tests/mutants/` are committed; probes revert `index.html`. |
| Test plan | 1 | 1 | 0 | Probe protocol made differential (D6). |

OUTSIDE COVERAGE: Codex (completed). Two high findings adopted (D4, D3), one medium adopted (D6).

VERDICT: APPROVED WITH CHANGES - the changes above are applied in this file.

NO UNRESOLVED DECISIONS
