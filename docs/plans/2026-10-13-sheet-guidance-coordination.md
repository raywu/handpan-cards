# Sheet guidance coordination

Plan: `docs/plans/2026-10-13-sheet-guidance.md` (main 57ee181). Owner request 2026-10-13; AFK armed.

## Goal (read this first, every session, every cycle)
The notice and every page-state or error message the sheet writes stay on screen with the primary at every viewport and keyboard, in one reserved two-line slot `#scale-guidance` between `.sheetbody` and `#scale-generate`.
NON-goals: no change to any `layoutNoticeText()`, `say()` or refusal string; no toasts, timers or animation; no change to the primary's label logic; no script change beyond the one-line notice guard (R8); no sticky footer; no move of `#scale-del-note`, `#scale-refusal`, `#scale-parse` or `#scale-drawer-status`; no change to `#settings-panel`, `panelStops()` or `panel-fit`; no engine, data or fixture change; `assertSeedBoxReadable` not lowered.

## Hard rules
1. Only the integrator merges. Lanes never deploy.
2. The main agent is the sole writer of this doc; lanes return reports and never edit it. Every PR passes `/review` by a non-author reviewer before merge, and verdicts are recorded.
3. File ownership per the Ownership table; crossing a boundary is a queue row.
4. No deploys mid-batch.
5. Delivery is PR-based, CI green at the verified head SHA, branch `claude/sheet-guidance-<lane>`.
6. Lane local runs are smoke tests; CI at the head SHA is the evidence.
7. ERROR PROTOCOL: on any error or blocker, re-read the Goal, make the smallest adjustment that still serves it, record the blocker in the return report, keep working what is unblocked. The goal never changes without the operator.
8. Standing gates 1-7 of the plan's "Standing gates" section apply to every PR.

## Ownership
| Lane | Worktree | Branch | Owns | Never touches |
|---|---|---|---|---|
| app | `.claude/worktrees/sheet-guidance-app` | `claude/sheet-guidance-app` | `index.html` outside engine regions and the DECKS line; `tests/app.test.js`, `tests/e2e.test.js`, `tests/drawer_seats.test.js`; `tests/mutants/*`; FLOORS rows in `tests/suite_health.py`; README mutant count | `src/engine/`, `data/decks.json`, `tools/sandbox.js`, fixtures, `#settings-panel`, docs |
| docs | `.claude/worktrees/sheet-guidance-docs` | `claude/sheet-guidance-docs` | `docs/plans/2026-10-07-scale-drawer-design-spec.md`, `CLAUDE.md` | everything else; no test |

## Sequencing
1. Lane app (wave 1). Gate: CI green at verified head + reviewer PASS/PASS_WITH_NITS.
2. Lane docs after app merges (wave 2). Same gate.
3. Owner-gated, not lanes: T3 (N-4/D8 refusal placement), T4 (N-7 copy, SMALL_LABELS). CLOSED by owner 2026-10-14 check-in: T3 refusal stays under the field; T4 leave as is. Also 2026-10-14: #302 reviewer #3 nits (TODOS Cons + T4 name `docs/ENGINE-SPEC.md` section 2 as SOT pinned by `tests/core.test.js:118`) go to lane docs; degrees-dropdown removal runs after this workstream; AFK stays armed.

## Briefings
Spawn prompts quote the plan's lane sections verbatim; see Cycle state for agent ids.

## Status
| Lane | Branch | State | Last verdict | Last update (UTC) |
|---|---|---|---|---|
| app | `claude/sheet-guidance-app` | PR #303 FAIL+1 at 6d09230 (N-A7 stop: crowded 25-note seed + SMALL_LABELS warning + notice clips the seed box at kb395); bounced 2026-10-14 to implement X2 and four nits | - | 2026-10-14 |
| docs | `claude/sheet-guidance-docs` | blocked on app | - | 2026-10-13 |

## Handoff queue (append-only)
| # | From | Ask | Status |
|---|---|---|---|

## Review log
| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #303 | app | FAIL (6d09230) | blocker: growth (a) reachable on crowded user pans, seed box clipped at kb395 where main passes; nits: drawer_drag inventory entry, N-A7 tables incomplete, FLOORS/README unmoved, N-A5 hardcoded viewports, N-A6 missing 2-line-notice state, N-A10 direct paintLayout calls | bounced, attempt 1 |

## Cycle state
Cycle: 1   Wave: 1   Merged this batch: -
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| app | ac8a34e4d706a13ee | sheet-guidance-app | claude/sheet-guidance-app | #303 | 569865d (FLOORS/README push, superseded by bounce) | 2026-10-14 | FAIL+1 at 6d09230; bounced with owner decision X2 | 1 | no | - | - |
| docs | - | - | claude/sheet-guidance-docs | - | - | - | - | 0 | no | app | - |

## AFK auto-decisions (this execution)
| id | decision |
|---|---|
| X1 | Coord doc lives on `claude/sheet-guidance-coord` (never merges), as the seeded-save-delete workstream did. |

**X2 (owner decision, 2026-10-14, check-in):** plan N-6 flips to the alternative, "one message wins": while `#scale-layout-state` holds text, the warn-tier `#scale-msg` is hidden (`#scale-guidance.noticed #scale-msg.warn{display:none}`, class toggled in `paintLayout()` beside the R8 guard); error-tier messages still stack. Growth states (a) and (c) cease to exist. The "no script change beyond R8" non-goal is extended by the owner to the class toggle. New mutant `sg_warning_not_yielding_to_notice` (937 -> 938). Lane docs amends the plan's N-6 row, growth paragraph and non-goals accordingly.
