# Editable defaults coordination

Plan: `docs/plans/2026-10-09-editable-defaults.md` (merged #290, main 24cfc3b). Cycle state lives on branch `claude/editable-defaults-coord` (never merges to main).

## Goal (read this first, every session, every cycle)
Players can fork any built-in deck into a custom deck, hide any built-in, restore all hidden built-ins, and every added custom deck takes chip position 1. State lives in `hpfc.hidden` and the existing `hpfc.scales.v3`. NON-goals: plan section 2 and 8.5 verbatim (no in-place edit of a built-in; no `data/decks.json`, `src/engine/`, `tools/` changes except `ELEMENT_IDS` R5; no new panel control on a fresh store; no palette additions; no feature redesign of B1..B5).

## Hard rules
1. Only the main agent merges; lanes never deploy or merge.
2. The main agent is the sole writer of this doc; lanes return reports.
3. File ownership per the plan section 4 and 8.3. Crossing a boundary is a report row, never an edit.
4. Delivery is PR-based; CI green at the verified head SHA is the evidence, never a local run.
5. Every PR passes an independent `swarm-reviewer` (read-and-report, `OPENCLAW_SESSION=1`) before merge; verdicts recorded below.
6. ERROR PROTOCOL: re-read the goal, smallest adjustment, record the blocker, keep working what is unblocked; the goal never changes.
7. AFK armed (owner 2026-10-12): standing merge grant for `claude/*` lane PRs under rule 4 + 5; nothing destructive.

## Ownership
| Lane | Branch | Worktree | Owns | Never touches |
|---|---|---|---|---|
| app | `claude/editable-defaults-app` | `.claude/worktrees/editable-defaults-app` | plan section 4 lane app Owns + 8.3 (existing tests/mutants its changes redden or invalidate); S1: in-file e2e helpers `selectDeck`/`selectChipAt`/`chipStates` when a floor re-point needs them | new e2e tests, `tests/helpers/`, README, CLAUDE.md, plan |
| e2e | `claude/editable-defaults-e2e` | `.claude/worktrees/editable-defaults-e2e` | NEW e2e tests + their mutants, `tests/helpers/`, FLOORS e2e row | everything else |
| docs | `claude/editable-defaults-docs` | `.claude/worktrees/editable-defaults-docs` | README, CLAUDE.md, plan close-out section | code, tests |

## Sequencing
1. app (wave 1, alone). 2. e2e after app merges. 3. docs after e2e merges. Plan section 6.

## Integrator decisions (AFK auto, recorded)
- S1 2026-10-12: reviewer nit 7 on #290: in-file e2e helpers are lane app's if a floor re-point needs them (lane e2e is unspawned; no deadlock). Conservative: lane app re-points at call sites first.
- S2: reviewer nits 1-9 on #290 recorded as queue rows; nits 3/5/6 (stale plan text) go to lane docs close-out; nit 1 (three `deck()` mutants) and nit 2 (app.test.js :252) passed to lane app as facts, not rules.

## Status
| Lane | Current branch | State | Last verdict | Last update (UTC) |
|---|---|---|---|---|
| app | claude/editable-defaults-app | spawned | - | 2026-10-12 |
| e2e | - | waiting on app | - | - |
| docs | - | waiting on e2e | - | - |

## Review log
| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #290 | plan | PASS_WITH_NITS @2f6d9d6 | 9 nits | merged 24cfc3b |

## Handoff queue (append-only)
| # | From | Ask | Status |
|---|---|---|---|
| 1 | reviewer #290 | nit 1: `d_deck_copies_registry`, `d_registry_ignored`, `d_no_deck_fallback` remove the `const deck = ()` line; R7 cases for lane app | OPEN |
| 2 | reviewer #290 | nit 2: app.test.js :252 "every rendered face is well-formed markup" clicks the already-on Kurd chip (R9 class) | OPEN |
| 3 | reviewer #290 | nits 3/5/6: lane app Verify says "ten"; section 6 item 1 omits "purpose they defeat"; ED-A16 lists `e_edit_forks_chip` | OPEN (lane docs) |
| 4 | reviewer #290 | nit 8: no post-merge owner for a missed wrong-path test; guard is the inventory-vs-diff check | OPEN (integrator) |

## Cycle state
Cycle: 1   Wave: 1   Merged this batch: -
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| app | a2510001262579403 | .claude/worktrees/editable-defaults-app | claude/editable-defaults-app | - | - | - | - | 0 | no | - | - |
