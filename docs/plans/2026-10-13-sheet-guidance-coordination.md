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
| app | `claude/sheet-guidance-app` | PR #303 attempt 2 at 00f9e3b, CI green, X2 implemented as `#scale-sheet.noticed #scale-msg.warn{display:none}` (sandbox ELEMENT_IDS forbids a wrapper lookup); second reviewer running | - | 2026-10-14 |
| docs | `claude/sheet-guidance-docs` | PR #304 at 1bd1d8e (integrator-owned after two FAILs), CI green, review 3 running | FAIL+2 | 2026-10-14 |

## Handoff queue (append-only)
| # | From | Ask | Status |
|---|---|---|---|

## Review log
| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #303 | app | FAIL (6d09230) | blocker: growth (a) reachable on crowded user pans, seed box clipped at kb395 where main passes; nits: drawer_drag inventory entry, N-A7 tables incomplete, FLOORS/README unmoved, N-A5 hardcoded viewports, N-A6 missing 2-line-notice state, N-A10 direct paintLayout calls | bounced, attempt 1 |
| #303 | app | PASS_WITH_NITS (00f9e3b), escalation flagged | major: X2 CSS also hides the warn-tier delete refusal (deleteDeck) while a notice stands; nits: PR body stale (N-A6 bullet, 929->937, 844x390 prose), growth (d) not driven to three lines, N-A6 yielding states set `noticed` by hand, N-A5 skips keyboards at 844x390 | X3: bounced, attempt 2 (last) |
| #303 | app | PASS_WITH_NITS (78b5e67) | no blockers; nits: no test pins the warning's return when the notice clears, `.pan` at openEditSheet and the collision branch unpinned by mutants, `r4f_f4_name_refusal_disables_drawer` omitted from the PR reconciliation, `#scale-guidance` markup comment stale after X2 | MERGED e17a52f; nits -> TODOS via lane docs |
| #304 | docs | FAIL (7c5e924) | CLAUDE.md bullet names `#scale-refusal` the delete refusal (it holds the seed refusal; the delete refusal is in `#scale-msg`, N-A6 delete test); nits: spec ~462 over-attributes to N-A7, growth (d) uncited, two untestable sentences unmarked, undated X2 non-goal sentence, 39px note unasserted | bounced with exact sentences, attempt 1 |
| #304 | docs | FAIL (1675ea8) | F1: spec ~462, CLAUDE.md and plan:34 said a test pins the pan warning's return (none does; sgPut toggles `noticed` by hand); F2: "growth exactly (b)(d)(e)" false since X3, a short delete refusal beside a two-line notice makes a 54px slot (the N-A6 delete test asserts it); nits: CLAUDE.md letters without a lettered list, (e) does not occur under fallback fonts at 380/390, wireframe rows overrun, TODOS "unpinned by mutants" wording | attempt cap reached; integrator took the lane over, fixes pushed as 36c0f95 |
| #304 | docs | PASS_WITH_NITS (1bd1d8e) | no blockers; F1/F2 fixes verified; nits: CLAUDE.md (d) cites the N-A6 delete test but (d) alone (long name, no notice) has no test; plan ~130 "the warning returns" followed by test cites that do not assert it; CLAUDE.md "no test" on refusal-never-yields understates (the N-A6 delete test asserts it; only errors are untested); ELEMENT_IDS "no test" understates (app test "SG: N-A3 no served id is removed and the wrapper is markup-only" asserts it); spec rows 45/53 put the mark in the lanes column; spec 73 attributes the #scale-guidance placement to N-A7 not N-A2; growth list unmeasured under 380px (a 360px phone may wrap SMALL_LABELS to three lines) | MERGED b6d8bee; nits -> queue rows Q1-Q7 |

## Cycle state
Cycle: 1   Wave: 1   Merged this batch: -
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| app | ac8a34e4d706a13ee | sheet-guidance-app | claude/sheet-guidance-app | #303 | 78b5e67 | 2026-10-14 (CI run 38597722993 11/11 pass, headRefOid == tip) | PASS_WITH_NITS at 78b5e67 | 2 | yes, e17a52f; worktree and branch removed | - | - |
| docs | integrator (was a7b0be57d52984201) | sheet-guidance-docs | claude/sheet-guidance-docs | #304 | 1675ea8 | 2026-10-14 (CI run 38602644641 success, headRefOid == tip, four owned files only, fixed sentence confirmed in diff) | FAIL at 7c5e924, bounced; FAIL at 1675ea8 (attempt 2, cap); integrator-owned, head 1bd1d8e (36c0f95 fixes + ET1/ET2 ticks), PASS_WITH_NITS at 1bd1d8e | 2 | yes b6d8bee | - | worktree and branch removed |

## AFK auto-decisions (this execution)
| id | decision |
|---|---|
| X1 | Coord doc lives on `claude/sheet-guidance-coord` (never merges), as the seeded-save-delete workstream did. |

**X2 (owner decision, 2026-10-14, check-in):** plan N-6 flips to the alternative, "one message wins": while `#scale-layout-state` holds text, the warn-tier `#scale-msg` is hidden (`#scale-guidance.noticed #scale-msg.warn{display:none}`, class toggled in `paintLayout()` beside the R8 guard); error-tier messages still stack. Growth states (a) and (c) cease to exist. The "no script change beyond R8" non-goal is extended by the owner to the class toggle. New mutant `sg_warning_not_yielding_to_notice` (937 -> 938). Lane docs amends the plan's N-6 row, growth paragraph and non-goals accordingly.

**X3 (integrator AFK auto-decision, 2026-10-14, after review 2 of #303):** the reviewer asked the owner to see one finding before merge: `#scale-sheet.noticed #scale-msg.warn{display:none}` hides every warn-tier message, and `deleteDeck()` sends the delete refusal ("Keep at least one deck...") at warn tier, so under a standing notice a player taps DELETE and sees nothing. Options: (A) bounce once more so ONLY pan warnings yield (a `pan` class added at each pan-warning `say()` call site, selector narrowed to `.warn.pan`, refusals and errors always show, e2e assertion + mutant `sg_refusal_yields_to_notice`, count 939); (B) merge and queue. Picked (A): the owner's X2 words were "it replaces the pan warning in the slot", not refusals, and the original request is that guidance is never hidden; (B) would ship hidden guidance. Attempt 2 is the cap; a third FAIL regroups per the AFK rule. Implementation note: the class lives on `#scale-sheet`, not `#scale-guidance`, because `tools/sandbox.js` ELEMENT_IDS lacks the wrapper (the X2 text above predates that).

**Lane docs ownership extended (integrator, 2026-10-14, per owner check-in):** besides the drawer spec and `CLAUDE.md`, lane docs owns `docs/plans/2026-10-13-sheet-guidance.md` (X2/X3 amendments, 39px landscape note, T1/T2 ticks) and `TODOS.md` (#302 reviewer nit: name ENGINE-SPEC section 2 as SOT pinned by `tests/core.test.js` "REASONS is the ENGINE-SPEC section 2 table, verbatim"; the three app-side nits from review 3 of #303 recorded as follow-ups). Still no test, no code.

## Queue (post-merge nits, not scheduled)
| # | From | Ask | Status |
|---|---|---|---|
| Q1 | #304 review 3 | CLAUDE.md pitfall bullet: say "(d) beside a notice by the N-A6 delete test; (d) alone has no test" | OPEN |
| Q2 | #304 review 3 | plan ~130: mark "The warning returns when the notice clears" with "(no test; see TODOS.md Sheet guidance follow-ups)" | OPEN |
| Q3 | #304 review 3 | CLAUDE.md: "the delete refusal ... never yield (no test)" should read: refusal asserted by the N-A6 delete test, errors untested | OPEN |
| Q4 | #304 review 3 | CLAUDE.md and plan 34: ELEMENT_IDS sentence can cite app test "SG: N-A3 no served id is removed and the wrapper is markup-only" instead of "(no test)" | OPEN |
| Q5 | #304 review 3 | drawer spec rows 45/53: move the SUPERSEDED mark to the description column (lane F precedent, row 44) | OPEN |
| Q6 | #304 review 3 | drawer spec 73: the "in #scale-guidance, before the notice" clause is pinned by N-A2, not N-A7 | OPEN |
| Q7 | #304 review 3 | growth list is measured only at 380/390/844; a 360px phone may wrap the SMALL_LABELS warning to three lines (plan's original enumeration) | OPEN |
| Q8 | #303 review 3 | three app-side nits already recorded in TODOS.md "Sheet guidance follow-ups" (warning return untested; `.pan` at openEditSheet and the collision branch unpinned by mutants; stale markup comment above #scale-guidance) | OPEN |

## Workstream COMPLETE 2026-10-14
#303 (app) merged e17a52f, #304 (docs) merged b6d8bee, main b6d8bee, 939 mutants. Lane docs exhausted its two attempts; the integrator applied review 2's exact sentences (36c0f95, 1bd1d8e) and review 3 passed. This branch never merges; it is the archive.
