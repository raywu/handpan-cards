# Remove degrees dropdown coordination

Plan: `docs/plans/2026-10-14-remove-degrees-dropdown.md` (PR #305). Owner request 2026-10-13; AFK armed.

## Goal (read this first, every session, every cycle)
The Edit sheet has no DEGREES row: every deck saved from the sheet (create or Edit) carries the engine's inferred parent index, a stored or shared explicit index is still honoured for display and re-stored when a share link is opened, and the Edit page's Tab order, layout and seeded-save behaviour are otherwise unchanged (plan sections C and G).
NON-goals (plan section G): no notice announcing a relabel (R-7); no inferred-mode readout (R-6); no change to `openShare()` or the share format (E4); no record migration; no `select:focus` cleanup (R-4); no change to `src/engine/`, `data/decks.json`, fixtures, `#settings-panel`; no string elsewhere on the sheet.

## Hard rules
1. Only the integrator merges. Lanes never deploy.
2. The main agent is the sole writer of this doc; lanes return reports and never edit it. Every PR passes `/review` by a non-author reviewer before merge, and verdicts are recorded.
3. File ownership per the Ownership table; crossing a boundary is a queue row.
4. No deploys mid-batch.
5. Delivery is PR-based, CI green at the verified head SHA, branch `claude/remove-degrees-<lane>`.
6. Lane local runs are smoke tests; CI at the head SHA is the evidence.
7. ERROR PROTOCOL: on any error or blocker, re-read the Goal, make the smallest adjustment that still serves it, record the blocker in the return report, keep working what is unblocked. The goal never changes without the operator.
8. Standing gates 1-7 of the plan's "Standing gates" section apply to every PR.

## Ownership
| Lane | Worktree | Branch | Owns | Never touches |
|---|---|---|---|---|
| app | `.claude/worktrees/remove-degrees-app` | `claude/remove-degrees-app` | `index.html` app block (never an engine region or the DECKS line); `tools/sandbox.js` ELEMENT_IDS; `tests/app.test.js`, `tests/e2e.test.js`; `tests/mutants/*`; FLOORS rows in `tests/suite_health.py`; README mutant count | `src/engine/`, `data/decks.json`, fixtures, `#settings-panel`, docs |
| docs | `.claude/worktrees/remove-degrees-docs` | `claude/remove-degrees-docs` | `docs/SCALE_ENGINE_PLAN.md`, `docs/ENGINE-SPEC.md`, `docs/plans/2026-10-07-scale-drawer-design-spec.md`, `CLAUDE.md`, `TODOS.md`, the plan's ledger ticks | everything else; no test, mutant or code |

## Sequencing
1. Lane app (wave 1). Gate: CI green at verified head + reviewer PASS/PASS_WITH_NITS.
2. Lane docs after app merges (wave 2). Same gate; the reviewer re-verifies every sentence against main at the app merge SHA.
3. Owner, not a lane: T7 (should share links infer too, E4 B) is a TODOS row.

## Briefings
Spawn prompts quote the plan's lane sections verbatim (lane app: the ownership rule + amendment paragraph, "Lane app" section, "Standing gates", "Prompt facts corrected"); see Cycle state for agent ids.

## Status
| Lane | Branch | State | Last verdict | Last update (UTC) |
|---|---|---|---|---|
| app | `claude/remove-degrees-app` | MERGED #306 as 083f44a; worktree and branch removed | PASS_WITH_NITS | 2026-10-14 |
| docs | `claude/remove-degrees-docs` | PR #307 returned done; CI success at d24c092; reviewer spawned | pending | 2026-10-14 |

## Handoff queue (append-only)
| # | From | Ask | Status |
|---|---|---|---|

## Review log
| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #306 | app | PASS_WITH_NITS (bc80445; CI run 38641641597 success; 24 files all inside the ownership row; 5 mutants applied and killed; adversarial claude + codex passes, no findings) | no findings; nits Q6-Q8 | MERGED 083f44a |
| #305 | plan | PASS_WITH_NITS (0e37efd) | no findings; nits: plan:19 misquotes the share round-trip test's parent list (it loops [null, 0, 1, 5, 9, 10]); plan:3 "adds only the prompt file" is stale; RD-T2 `openEdit(makeCustom(app))` should be `openEdit(app, makeCustom(app))`; the four section E sentences are hard-wrapped in the docs (single-line grep misses them); lane briefs should cite `select.build`, not lines | MERGED 5cae8c1; nits carried into the lane briefs and Q1-Q5 |

## Cycle state
Cycle: 1   Wave: 2   Merged this batch: 083f44a (#306)
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| app | a69dcfb44fde5f965 | removed | deleted | #306 | bc80445f64dd53353c7a567f6943a6eff268fc36 | 2026-10-14 run 38641641597 success | PASS_WITH_NITS (reviewer a5617f1bfd7dfb7ff) | 0 | yes 083f44a | - | - |
| docs | aa361bc444832b4ea | remove-degrees-docs | claude/remove-degrees-docs (from 083f44a) | #307 | d24c092256182bb7b954c40390dac278940af154 | 2026-10-14 run 38644050752 success | pending (reviewer spawned) | 0 | no | - | - |

## AFK auto-decisions (this execution)
| id | decision |
|---|---|
| X1 | Coord doc lives on `claude/remove-degrees-dropdown-coord` (never merges), as the previous two workstreams did. |
| X2 | #306 merged under the AFK grant on PASS_WITH_NITS; the three nits are Q6-Q8, not blockers. FLOORS rows (app 501 / e2e 297) and README count 939 left as the lane left them: CI suite health green, README inside the band (gate 6 allows). |

## Queue (post-merge nits, not scheduled)
| # | From | Ask | Status |
|---|---|---|---|
| Q1 | #305 review | plan:19: the round-trip test loops `[null, 0, 1, 5, 9, 10]`, not `{parent: null/0/7/10}` (lane docs may fix in the plan) | OPEN |
| Q2 | #305 review | plan:3: "the branch adds only the prompt file" is stale (lane docs) | OPEN |
| Q3 | #305 review | plan:70 RD-T2: `openEdit(app, makeCustom(app))` (lane app brief carries the fix) | OPEN |
| Q4 | #305 review | section E sentences wrap across lines in the docs (lane docs brief carries it) | OPEN |
| Q5 | #305 review | lane briefs cite function names, not line ranges (applied in the app brief) | OPEN |
| Q6 | #306 review | RD-T4 mints the share link at runtime with the app's `link()` instead of a captured string (as "rule N" does); an encoder change dropping parent on both sides would pass; `tests/share.test.js` covers the encoder | OPEN |
| Q7 | #306 review | RD-T2 asserts collected parents `== null`, plan said `=== undefined`; a regression writing `o.parent = null` on Edit passes (engine infers either way) | OPEN |
| Q8 | #306 review | the RD-A10 screenshot is a scratchpad path in the PR body, not an attachment; the integrator inspected it and sent it to the owner | OPEN |
