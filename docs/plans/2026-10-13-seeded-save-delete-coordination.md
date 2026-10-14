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

Cycle: 1   Wave: 3   Merged this batch: 894d8f8 (#297), 0fc3852 (#298), ed74b51 (#299). WORKSTREAM COMPLETE 2026-10-13.

Cycle: 2 (nits lane, owner 2026-10-13 "One nits lane now")   Wave: 4   Merged this batch: de4c32d (#300 retro snapshot)
Plan `docs/plans/2026-10-13-seeded-save-delete-nits.md`, eng-reviewed (D14, D15; Codex 4/8 confirmed), committed 891ca66 on the lane branch.

| Lane | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on |
|---|---|---|---|---|---|---|---|---|---|
| nits | .claude/worktrees/seeded-save-delete-nits | claude/seeded-save-delete-nits | #301 | 3ff3f8d | 2026-10-13 (head == tip, CI 11/11 pass; fix CLAUDE.md + README only) | FAIL+2; third fresh reviewer spawned at 3ff3f8d | 2 | no | re-review |

| Lane | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on |
|---|---|---|---|---|---|---|---|---|---|
| app | (removed) | (deleted, local + remote) | #297 | f8d434c | 2026-10-13 (head == branch tip, MERGEABLE, 11/11 pass) | attempt 1 at 4e9c5db: CI red on mutation gate shards 1 and 2 (survivors `d_registry_ignored`, `e_fork_drops_name`), bounced by message, no reviewer. Lane fix f8d434c re-anchored both (details in Review log). Reviewer PASS_WITH_NITS at f8d434c (stalled once, resumed). Finding 1 (PR body lacked the SD-A8 inventory) fixed by the integrator in the PR body from the diff (D7). | 1 | YES 894d8f8 | — |
| e2e | (removed) | (deleted, local + remote) | #298 | dbb802e | 2026-10-13 (head == worktree tip, MERGEABLE, 11/11 pass) | stalled once with tests + 3 mutants written but uncommitted; resumed by message (the watchdog, not the work). Returned DONE: f7ebf14 tests + 3 mutants, dbb802e FLOORS e2e 287 -> 290 from CI's count. Reviewer PASS_WITH_NITS at dbb802e. | 0 | YES 0fc3852 | — |
| docs | (removed) | (deleted, local + remote) | #299 | 37a6232 | 2026-10-13 (head == worktree tip, MERGEABLE, 11/11 pass) | attempt 1 at 7c018f8: reviewer FAIL F1-F3; lane dead, integrator fixed on the branch (37a6232, D8). Attempt 2: fresh reviewer PASS_WITH_NITS at 37a6232. | 1 | YES ed74b51 | — |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #296 | plan | FAIL | F1 openShare persists the decoded seed; F2 desktop RESET disarm | fixed in 039f545 |
| #296 | plan | PASS_WITH_NITS | N1-N4 above | merged 3831299 |
| #297 | app | CI red at 4e9c5db (no reviewer) | mutation survivors `d_registry_ignored` (re-anchored to `deck = () => DECKS.find(...) \|\| fallbackDeck()`; first attempt was a wrong-reason ReferenceError kill) and `e_fork_drops_name` (re-anchored to `edit.name.replace(/\d/g,"")` after the retitled e2e test's swatch click was made to take) | fixed in f8d434c |
| #297 | app | PASS_WITH_NITS at f8d434c (CI run 38454097278 success, 11/11; scope CLEAN, 78 files all owned; 5 mutants exercised, all right-reason kills except hand mutant 5, a test gap) | F1 PR body lacked the SD-A8 inventory and mutant reconciliation (fixed by the integrator in the body, D7). Nits: A6 test asserts only the in-memory registry, not the stored-scales filter (a reboot-then-assert would close it) and never asserts "Seeded decks restored."; `const seeded = Object.keys(replacements());` at RESET is unused and shadows `seeded()`; stale header comments on e_chip_pencil_on_builtins, d_hidden_not_filtered, d_builtin_hide_unwired, d_fork_overwrites; `d_replaces_not_carried` mutates the `restoreScales` call, not generateDeck's carry-back line as SD-A15 says; `d_seeded_sheet_keeps_fork_copy`'s description overstates (flips every Edit sheet); Pygmy's seeded sheet now shows "Layout changed from the default." (anchor `between`); retitled "layout markup exists" e2e test dropped its pencil assertion (covered elsewhere); `d_reset_stays_armed` pins only the pointerdown hook, not blur or closePanel. /review sub-checks NOT run: testing/maintainability/simplification specialists, Codex passes, Claude adversarial subagent (dispatched, never returned). | merged 894d8f8; nits -> Q3 |
| #298 | e2e | PASS_WITH_NITS at dbb802e (run 38481827010 success, 11/11; scope CLEAN, 5 files all owned; three new tests appended at EOF, no existing line touched; 922 mutants; 6 of 10 mutants exercised, 5 killed for the stated reason, 1 ad-hoc survivor) | N1 SD-A11 asserts in-memory replacements and stored `hidden` but not the stored scale records: removing the RESET handler's `writeScales(...replaces...)` filter survives SD-A11 (and likely app.test.js); fix = assert no stored record carries `o.replaces` after the confirming tap, or reload and re-read the chips. N2 PR body still says the FLOORS commit is "a follow-up" (it is dbb802e, in the PR). N3 README.md says 905 mutant patches; 922 exist (docs lane's file). | merged 0fc3852; nits -> Q5 |
| #299 | docs | FAIL at 7c018f8 (run 38498066521 success, 11/11; scope CLEAN, 3 owned files; Codex and the Claude adversarial pass both confirmed F1-F3; 2 of 5 mutants: README 905 survives the 90% band by design, 950 killed) | F1 README said deleting a replacement brings the seed back (code: `hidden.push(heldSeat)`, SD-4a, test "SD: deleting a replacement does not bring the seed back"). F2 README said RESET lands on the default deck (code: only when the selected deck is gone). F3 CLAUDE.md said a stored id of a replaced seed shows the replacement (true for DEFAULT_DECK only via `fallbackDeck()`; other seeds fall back silently). Nits: N1 unchanged/duplicate SAVE writes nothing; N2 guard is "last deck of any kind"; N3 README/CLAUDE.md disagree on older same-seed records under RESET; N4 RESET filters `isBuiltIn(replaces)`; N5 plan section E old-build SAVE sentence absent; N6 "A stored deck id is always honoured" now contradicted in the same bullet; N7 hidden default falls back to its replacement first; N8 stale CSS comment index.html:196 (not this lane). | integrator fix 37a6232 (F1-F3, N2, N3, N4, N7); N1, N5, N6, N8 unscheduled |
| #299 | docs | PASS_WITH_NITS at 37a6232 (run 38499636053 success, 11/11; scope CLEAN, 3 owned files; every README/CLAUDE.md claim reproduced by sandbox probe; Codex and the Claude adversarial pass ran; 4 of 5 mutants: 923 and 828 killed, 829 survives as the band floor by design, restored FORK/HIDE copy survives every python suite since SD-A14 grep is a one-time command) | N1 seeded SAVE refused when a plain custom deck already holds the scale ("Another deck already uses this scale."), undocumented; N2 unchanged SAVE writes nothing; N3 a seed both replaced and hidden boots with "That deck is gone." (two-tab state); N4 stored replaced non-default seed can land on its replacement by order coincidence when Kurd is hidden; N5 "DELETE" shorthand; N6 disarmReset paths undocumented; N7 "five seeded slots" loose; N8 stale "hpfc.hidden" code comment near index.html:7752 (not this lane). App UX follow-up outside the lane: below 1024px the RESET warning and "Seeded decks restored." go to `.announce` under the opaque settings panel, so a sighted phone user sees only the label flip. | merged ed74b51; nits -> Q7 |
| #301 | nits | FAIL at 31aa7ee (run 38507255204 success, 11/11; scope CLEAN, all files in the owned set; engine regions and DECKS line byte-identical to main; D14 boot guard verified both directions; 5 of 7 new mutants killed by their `# suite:` line, CI shards killed the other two; A1/A3/A4 green locally, A2 e2e via CI only) | F1 README "SAVE on a seeded deck is refused ... when another deck already holds that scale" over-reaches: `index.html` refuses only when `CUSTOM[deckId]` holds it; scenario: Amara 9 edited to Amara 10's scale saves a replacement with no refusal. N1 "SAVE with nothing changed writes nothing" reads as general, true for seeded decks only; N2 palette-only SAVE on seeded Pygmy stores `anchor:'between'`, so the replacement's sheet says "Layout changed from the default." (outside item 3); N3 CLAUDE.md "falls back through `fallbackDeck()`" now reached via `deck()` first; N4 branch merge-base is ed74b51, two-dot diff shows the retro JSON deleted (three-dot clean). | bounced to lane (attempt 1): fix F1 + N1 + N3 docs-only; N2 -> queue row; fresh re-review |
| #301 | nits | FAIL at fcd96c3 (fresh reviewer; run 38508769885 success, 11/11; fix diff 3 docs files only; README refusal and unchanged-SAVE sentences now correct; D14 PASS both directions; 5 of 7 mutants killed by their suite line; A1/A3/A4 green) | F1 CLAUDE.md "A hidden seeded deck lands on its own replacement ... else to the first visible deck, custom decks first" is true for the default deck only: a non-default hidden seed with no replacement goes through `fallbackDeck()` to Kurd when Kurd is visible (scenario: `{deck:"hijaz", hidden:["hijaz"]}` + one plain custom boots onto D KURD 10); also "`deck()` consults `replacements()` first" misstates the order (CUSTOM, allDecks, replacements, fallbackDeck). N1 README: an unchanged SAVE on a seed whose scale a custom deck holds still closes silently, so say "A changed SAVE ... is refused"; N2 long reflowed comment line near index.html:7751 (cosmetic). | bounced to lane (attempt 2, last): exact wording supplied; N1 folded in; N2 left |

## Queue

| # | Item | Lane | Status |
|---|---|---|---|
| Q1 | Owner, 2026-10-13: lane app stalled once after pushing #297 and was resumed by message (keep waiting, no deadline). If it stalls AGAIN, the integrator takes the two surviving mutants over on the branch directly and retires the lane; the attempt counter moves to 2. UPDATE: the lane stalled a second time AFTER handing back with the fix already pushed (f8d434c). Lane RETIRED; any further fix on #297 is the integrator's, on the branch directly. Attempt counter stays at 1 because no further failure has occurred yet. | app | RESOLVED |
| Q2 | Owner, 2026-10-13: after the workstream is wrapped up (docs lane merged, final report given), run `/retro` and then `/persist-learnings`. | integrator | RESOLVED (run after the wrap-up report, 2026-10-13) |
| Q3 | #297 reviewer nits (Review log row), unscheduled: the A6 stored-scales gap (hand mutant survived), the missing "Seeded decks restored." assertion, the unused `seeded` const at RESET, four stale mutant header comments, two mutant descriptions that mislabel their site, Pygmy's "Layout changed from the default." copy on its seeded sheet, no committed mutant for RESET's blur/closePanel disarm paths. None blocks; owner to schedule or drop. | — | OPEN |
| Q4 | #297 late adversarial pass (the reviewer's Claude subagent, returned after merge; scenarios run in node against a `git archive` of f8d434c, repo untouched). Single-tab: no record lost or duplicated, no seed shown twice or never, `replaces` never dropped, boot and RESET sound. Two findings, both reachable only from a two-tab or crafted store: (1) two tabs each SAVE Kurd, so two records name `kurd`; after reload the older sits in the custom tier as SD-A20 says, but deleting the newer promotes the older into Kurd's slot, and RESET deletes BOTH (it clears every record whose `replaces` is a seed), where SD-5 promised a plain custom survives RESET; tension between SD-A6 ("clears replaces records") and SD-5/SD-A20 ("older renders as a plain custom"), owner call; (2) a store with `deck:"kurd"`, `hidden:["kurd"]` AND a `replaces:"kurd"` record boots onto the replacement but says "That deck is gone. Showing D KURD 10." (boot guard at the `wantedDeck !== deckId` line tests `hidden` without consulting replacements). Also confirmed, by design: RESET from a non-Kurd replacement lands on Kurd (`fallbackDeck()`); `openShare` stores options as built (F1). Follow-ups, unscheduled. | — | OPEN |
| Q5 | #298 reviewer nits (Review log row), unscheduled: N1 SD-A11 does not pin the stored-records half of RESET (same gap as Q3's A6 nit, now visible from e2e too); N2 stale "follow-up commit" line in the #298 body. N3 (README mutant count) is lane docs' SD-A14 work, not a nit. | — | OPEN |
| Q6 | Owner, 2026-10-13: "Pause everything after review is done so I can restart." Lane docs runs to its PR; the reviewer runs and its verdict is recorded here; then the integrator STOPS. No merge of the docs PR, no cleanup, no wrap-up report, no /retro or /persist-learnings until the owner resumes. | integrator | RESOLVED (owner: "resume and continue", 2026-10-13; the docs PR proceeds through review, merge, cleanup and wrap-up under AFK) |
| Q7 | #299 reviewer nits (two Review log rows), unscheduled: the undocumented R1 refusal of a seeded SAVE whose scale a plain custom holds; no-op SAVE writes nothing; replaced-and-hidden boot message; order-coincidence fallback; disarmReset paths; "five seeded slots" wording; plan section E old-build SAVE sentence absent from README; "A stored deck id is always honoured" now contradicted in the same CLAUDE.md bullet; two stale index.html comments (L196 pencil CSS, ~L7752 "hpfc.hidden"); phone `.announce` hidden under the settings panel during RESET (app UX, not docs). None blocks; owner to schedule or drop. | — | OPEN |

## AFK auto-decisions

- D1 skipped /office-hours during plan-eng-review (plan already reviewed).
- D2 R1 `replaces` carry-back app-side in `generateDeck` (engine whitelists).
- D3 R2 a replacement outranks a hidden seed (swap before the hidden filter).
- D4 R3 `disarmReset` is its own function beside `disarmDelete`.
- D5 after the review: run the lanes serial under /swarm.
- D6 PR #296 merged on PASS_WITH_NITS; nits N1-N4 carried into lane briefs
  rather than another plan commit (no lane is misled once the brief states them).
- D7 #297 reviewer finding 1 (PR body lacked the SD-A8 touched-test inventory and
  mutant reconciliation) fixed by the integrator editing the PR body from the diff
  (14 added, 60 modified, 0 deleted; 8 app and 4 e2e retitles listed), not by
  bouncing the lane: the reviewer had already verified the inventory against the
  diff, the lane was retired, and the fix touches no code. Merged on
  PASS_WITH_NITS; nits -> Q3.
- D8 #299 reviewer FAIL F1-F3 at 7c018f8 (three README/CLAUDE.md claims contradicted the code): the lane subagent was dead after the owner's restart, so the integrator fixed the two files on the lane branch directly (37a6232) instead of re-spawning a lane; attempt counter 1. Fresh reviewer PASS_WITH_NITS; merged under the AFK grant.
- D9 the owner's "resume and continue" was read as lifting Q6 in full: review, merge, cleanup and wrap-up proceed without a further pause.
