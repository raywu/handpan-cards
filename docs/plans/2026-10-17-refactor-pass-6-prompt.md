# Plan-drafting prompt: refactor pass 6, code base and tests, no regressions

Owner request (standing since pass 5, 2026-10-14), verbatim:

> "Evaluate our code base and tests - identify where we should refactor and improve. Must not introduce any regression. Output a plan from the investigation. Iterate to produce a 10/10 quality plan."

The owner's 2026-10-17 check-in asked for this pass after the nits lane (#348) merged. AFK mode is armed. The coordinator runs this prompt, holds the resulting plan to the plan rubric below, and runs `/plan-eng-review` on it before any lane starts.

This prompt is the pass-5 prompt, `docs/plans/2026-10-14-refactor-pass-5-prompt.md` (rev 12), with the deltas below. Every section of that prompt that a delta does not replace binds unchanged:

- "How to investigate"
- "Evidence a candidate needs"
- "Regression evidence"
- "What the plan must contain"
- "Plan rubric"
- "Verdict rule"
- the pitfall list in "Read first"

Where that prompt says `2e25d38`, `refactor-5` or `claude/refactor-5-<lane>`, read `37e7f7f`, `refactor-6` and `claude/refactor-6-<lane>`.

---

## The prompt

You are investigating `raywu/handpan-cards` and drafting ONE `/swarm` plan from what you find. You change no code, test, mutant, fixture or workflow. You write two files and nothing else: this prompt, `docs/plans/2026-10-17-refactor-pass-6-prompt.md`, and the plan, `docs/plans/2026-10-17-refactor-pass-6.md`.

- **Where you work.** The worktree you were given: `/Users/ray/Projects/handpan-cards/.claude/worktrees/agent-a5647bf3a73b442ea`, on branch `claude/refactor-pass-6-plan`, based on `main` at `37e7f7f`.
- **Record the SHA.** Write the SHA you read at the top of the plan.
- **Commands.** Run every command from that worktree, with absolute paths.
- **Never:**
  - `cd` to the repo root;
  - touch another worktree. The one exception is the scratch worktree you create for WEAK evidence, and you remove it before you commit;
  - use bare `git stash`.

### Delta 1: scope

The primary scope is everything merged since pass 5: `7ef7fda..37e7f7f` (PRs #311 to #348).

Code older than `7ef7fda` is in scope only where new code duplicated it or contradicts it. Cite the new commit that did so.

The 60-commit churn window is defined exactly as in pass 5, but measured at `37e7f7f`:

```
git log -60 --no-merges --format=%h -- index.html src tools tests | tail -1
```

### Delta 2: nit triage

Triage every open nit recorded in these memory files under `/Users/ray/.claude/projects/-Users-ray-Projects-handpan-cards/memory/`:

- `queued-share-readable.md` (the #344, #345, #347 and #348 nits)
- `queued-about-off-main.md`
- `queued-discoverability.md`
- `queued-sheet-guidance.md` (with its coord doc on `origin/claude/sheet-guidance-coord`)
- `queued-remove-degrees-dropdown.md`
- `queued-refactor-pass-5.md` (the G-1 N1-N4, O1-O5 and cleanup-after-G-1 nits)

Each nit gets exactly one outcome: FOLD into a named lane, CLOSE with a reason, or OWNER-GATED with a recommended default. Cite each by its memory file and label.

Rules:

1. **Verify before folding.** A nit is folded only if a command run at `37e7f7f` shows it is still true. Put the command in section 4.
2. **Already fixed means CLOSE.** A nit that a later merge already fixed is closed, citing that merge.
3. **Aesthetic means CLOSE.** Line length, docstring wording or prose taste: close it, as pass 5 drops aesthetic candidates.
4. **"Leave unscheduled" stays closed.** A nit the owner marked "leave unscheduled" stays closed. The one exception is a nit that shows a claim in `CLAUDE.md` or `README.md` to be false. That one may be folded into a DOCS lane through a section 9 decision row whose alternative is "keep unscheduled".
5. **Folding does not make a DO.** A folded nit is not a DO candidate and does not count toward M. A lane that exists only to carry folded nits says so in section 9.
6. **Changing the pinned behaviour.** A nit whose fix would change a pinned behaviour is OWNER-GATED. A nit that asks for a source change contradicting a pinned behaviour or a format rule is CLOSED, and the contradiction is listed in section 0.1.

Put the triage in one table in the plan: memory file, label, verified state with its command, outcome, and lane or reason.

### Delta 3: exclusions (non-goals of every lane; list them in section 2)

- **Scale import.** `src/engine/importer.js`, `tests/import.test.js`, `tests/fixtures/import_cases_v1.json`, every `IM:` test, every mutant whose `# kills:` names an import test, the `#import-row` markup and its handlers, and every import nit (#338, #339, #342, #343, #346). The owner put this workstream on hold on 2026-10-17. Its churn is reported in section 4 but earns no lane.
- **DEV environment.** PR #349 and `docs/plans/2026-10-17-dev-env.md`. No lane touches `.github/workflows/validate.yml`, `tools/ci_scope.py` or `tests/test_ci_scope.py`.
- **The CLAUDE.md ideas list.** Nothing from CLAUDE.md's "Ideas, NOT committed roadmap" list is planned, and the plan does not name those ideas.
- **Deck data and diagram geometry.** No change to `data/decks.json`, the `const DECKS` line, palettes, fonts or card anatomy.

### Delta 4: the no-regression bar is pass 5's

- Tests come first.
- Generated regions change only through `tools/inline_engine.py` and `tools/sync_decks.py`.
- Each lane states its mutant delta, its FLOORS delta and whether it edits README.
- FLOORS rows and the README mutant count come from main's CI artifacts and are set by the reconcile lane. Record this as a decision row, carrying pass 5's D1 forward: its alternative is "follow CONTRACT: each lane raises its own row".
- The README count test, `tests/test_readme_currency.py` `test_the_mutant_count_is_stated_within_a_lane_of_the_truth`, tolerates a band. Say whether a lane that adds mutants must touch README.

### Delta 5: swarm shape

- Lanes are split by file ownership. Branches are `claude/refactor-6-<lane>` and worktrees are `.claude/worktrees/refactor-6-<lane>`.
- The reconcile lane is `claude/refactor-6-reconcile`.
- Lanes that edit `index.html` are serialized into ordered waves.
- Lanes cite anchors (function names, test titles, markers), never line numbers.

### Delta 6: owner gates

Anything that changes user-visible behaviour, copy or layout is owner-gated, with a recommended default. That covers a share-link refusal code, a pixel, and a sentence a user reads. It goes in section 10, never into a lane.

### Delta 7: coverage

Coverage run 39053255194 (`.github/workflows/coverage.yml`) was dispatched on `main` at `37e7f7f`.

- If it has concluded, use its `coverage-report` artifact.
- If it is still running when you need it, say so in section 13, plan from the other measurements, and do not dispatch another.

### Delivery

1. Commit only the two files, with `git -c commit.gpgsign=false commit -q`. Every commit message ends with these two lines:

   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc
   ```

   Only new commits: no `--amend`, no `--no-verify`, no force-push.
2. Push `claude/refactor-pass-6-plan` and open a PR to `main`. The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, a blank line, and `https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc`.
3. Poll `gh pr checks <n> --watch` in the same turn until CI finishes.
4. Hand back:
   - the PR URL, the head SHA and the CI conclusion;
   - the lanes, one line each (name, owned files, goal);
   - the nit triage table;
   - the owner gates with their defaults;
   - the final rubric scores.

No em dashes, no emojis.

### Plan rubric (restated from pass 5; you self-score against it; the coordinator re-scores with an independent scorer)

Each item is worth one point. 10/10 is required.

1. Section 0 quotes the request, and 0.1 lists every contradicted prompt fact.
2. Every number in section 4 carries the command that produced it.
3. Every section 5 row has all eight fields.
4. Every DO row meets the DO rule.
5. No file is in two lanes of one wave.
6. Every lane step has an acceptance criterion and a runnable verify command.
7. Every lane names a pinning test that is green on `main` before the change. That is either an existing test, or a new test written first and shown green on `main` and RED against a deliberate break, before any production edit.
8. Per-lane mutant and FLOORS deltas sum to the projected corpus count and FLOORS after the last merge.
9. Sections 2, 10 and 11 cover every DEFER, DROP and owner-gated item, and every triaged nit.
10. The VERDICT line's counts match sections 5, 6 and 10, and X and Y follow the verdict rule's formula: X = 2 x lanes + 2 x expected bounces, Y = lanes + expected bounces + 2 x TEST-SPEED lanes.

Append the self-score table and end with the VERDICT line.
