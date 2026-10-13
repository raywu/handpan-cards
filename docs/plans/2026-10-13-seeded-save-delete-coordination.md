# Seeded SAVE / DELETE coordination

Execution record for `docs/plans/2026-10-13-seeded-save-delete.md` (merged in
PR #296, main `3831299`). The plan is the task list and owns goal, non-goals,
ownership, acceptance (SD-A1..SD-A20) and the standing gates; this doc records
what happened. **If it isn't in the doc, it did not happen.** This branch
(`claude/seeded-save-delete-coord`) never merges.

## Hard rules

1. The main agent is the sole writer of this doc and the only merger. Lanes
   return reports and never edit it.
2. Every lane PR passes `/review` by a fresh `swarm-reviewer` at the verified
   head SHA before merge; the verdict goes in the Review log.
3. CI's run at the lane's final pushed commit is the evidence, never a local run.
4. Bounce cap 2 per lane, one counter for every retry path. A third failure
   regroups (investigate prompt + subplan + `/plan-eng-review`), never bounces.
5. AFK mode is armed (owner, 2026-10-12): ordinary lane merges flow under the
   standing grant; migrations, deploys, force-pushes of shared branches and
   anything destructive stay gated.

## Goal and non-goals

Plan sections "Goal" and "Non-goals", verbatim in every lane brief. Lanes run
SERIAL: app, then e2e, then docs. Projected cost: 3 lanes, ~6 subagent runs,
~3 CI runs, +1 reviewer and +1 CI run per bounce.

## Ownership

| Lane | Worktree | Branch | Owns | Never touches |
|---|---|---|---|---|
| app | `.claude/worktrees/seeded-save-delete-app` | `claude/seeded-save-delete-app` | `index.html` app block; `tests/app.test.js`; `tests/e2e.test.js` EXISTING tests the inventory names; `tests/mutants/*` re-anchors and new `d_*`; `tests/suite_health.py` app row; `tests/fixtures/app_surface_v1.json` if a surface name moves | engine regions, `const DECKS`, `src/engine/*`, `tools/*`, `data/decks.json`, `README.md`, `CLAUDE.md`, new e2e tests |
| e2e | `.claude/worktrees/seeded-save-delete-e2e` | `claude/seeded-save-delete-e2e` | `tests/e2e.test.js` NEW tests; new `e_*` mutants; `tests/suite_health.py` e2e row | `index.html`; any existing test |
| docs | `.claude/worktrees/seeded-save-delete-docs` | `claude/seeded-save-delete-docs` | `README.md`, `CLAUDE.md`, the plan's status line | everything else |

## Reviewer nits carried from PR #296 (fold into briefs, not the plan)

- N1 `replacements()` is a seed-to-newest MAP (section B, SD-A20); the appendix's
  array filter is superseded. Section D's visibility gate reads
  `Object.keys(replacements()).length`. The custom tier excludes only the map's
  values.
- N2 the prefilled-palette list "0/1/2/0/0" is in Hijaz/Pygmy/Amara 9/Kurd/Amara 10
  order; in `BUILTIN_NAMES` (DECKS) order Kurd, Amara 10, Amara 9, Hijaz, Pygmy
  the expectation is 0/0/2/0/1.
- N3 the appendix's TODOS count is off by one; no overlap with this work.
- N4 a capture-phase document pointerdown listener already exists (the fly-out
  landing); the lane may extend it or add a second one.

## Cycle state

Cycle: 1   Wave: 1   Merged this batch: (none)

| Lane | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on |
|---|---|---|---|---|---|---|---|---|---|
| app | seeded-save-delete-app | claude/seeded-save-delete-app | #297 | 4e9c5db | 2026-10-13 (head == branch tip, 4 commits) | CI red: mutation gate shards 1 and 2 (survivors `d_registry_ignored`, `e_fork_drops_name`); 9 other checks pass; bounced to the lane by message, no reviewer spawned | 1 | no | lane fix + CI |
| e2e | — | claude/seeded-save-delete-e2e | — | — | — | — | 0 | no | app merge |
| docs | — | claude/seeded-save-delete-docs | — | — | — | — | 0 | no | e2e merge |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #296 | plan | FAIL | F1 openShare persists the decoded seed; F2 desktop RESET disarm | fixed in 039f545 |
| #296 | plan | PASS_WITH_NITS | N1-N4 above | merged 3831299 |

## Queue

| # | Item | Lane | Status |
|---|---|---|---|
| Q1 | Owner, 2026-10-13: lane app stalled once after pushing #297 and was resumed by message (keep waiting, no deadline). If it stalls AGAIN, the integrator takes the two surviving mutants over on the branch directly and retires the lane; the attempt counter moves to 2. | app | OPEN |

## AFK auto-decisions

- D1 skipped /office-hours during plan-eng-review (plan already reviewed).
- D2 R1 `replaces` carry-back app-side in `generateDeck` (engine whitelists).
- D3 R2 a replacement outranks a hidden seed (swap before the hidden filter).
- D4 R3 `disarmReset` is its own function beside `disarmDelete`.
- D5 after the review: run the lanes serial under /swarm.
- D6 PR #296 merged on PASS_WITH_NITS; nits N1-N4 carried into lane briefs
  rather than another plan commit (no lane is misled once the brief states them).
