# Quality refactor coordination

Execution record for `docs/plans/2026-09-30-quality-refactor.md`. The plan is
the task list and owns goal, non-goals, ownership, acceptance and merge gates;
this doc records what happened. **If it isn't in the doc, it did not happen.**

## Hard rules

1. The main agent is the sole writer of this doc and the only merger. Lanes
   return reports and never edit it.
2. Every lane PR passes `/review` by a fresh `swarm-reviewer` at the verified
   head SHA before merge; the verdict goes in the Review log.
3. CI's run at the lane's final pushed commit is the evidence, never a local run.
4. Bounce cap 2 per lane, one counter for every retry path.
5. Owner-gated items (G1, G2, G3, G5) are not worked until answered.

## Cycle state

Cycle: 1   Wave: 3 (closed)   Merged this batch (lane PRs only, head SHAs): #183 1264f35, #184 08e255a, #185 26a8565, #182 b6dd13e, #188 44467b6, #190 8e8bbb5

**Workstream done (2026-10-01).** Every lane is merged. "Done when" check: the card-face fixture (A) and PDF parity (P) pass in CI at main; no FLOORS row was lowered except E's documented move (e2e 196 -> 190 with `harness.test.js` 9 added, sum 199 >= 196, as plan item 17 allows); C raised `test_suite_health.py` 12 -> 18 and `mutation_harness.test.js` 18 -> 43; the longest mutation-gate shard at #190's head ran 5m33s (shard 2/4, attempt 2; 5m24s and 5m26s on attempts 1 and 3), under 6 min.

| Lane | Branch | PR | Head SHA | Verdict | Attempts | Merged | Blocked on |
|---|---|---|---|---|---|---|---|
| D0 plan fixes | `claude/quality-coord` | #177 | a432c1f | PASS_WITH_NITS | 1 | yes | — |
| M | `claude/q-m-mutant-tooling` | #179 | f0693c2 | PASS_WITH_NITS | 2 (taken over) | yes | — |
| P | `claude/q-p-parity` | #178 | 265c964 | PASS_WITH_NITS | 1 | yes | — |
| T | `claude/q-t-tooling` | #183 | 1264f35 | PASS_WITH_NITS | 2; third review passed | yes | — |
| F fly-out | `claude/deflake-flyout` | #184 | 08e255a | PASS_WITH_NITS | 1 | yes | — |
| B | `claude/q-b-engine` | #185 | 26a8565 | PASS_WITH_NITS | 1 | yes | — |
| C | `claude/q-c-ci-gate` | #182 | b6dd13e | PASS_WITH_NITS | 2 (cap); FAILs 3-4 reviewed the coordinator's takeover and raised F3, F1, which the coordinator then fixed | yes | — |
| A | `claude/q-a-app-shell` | #188 | 44467b6 | PASS_WITH_NITS | 1 | yes | — |
| E | `claude/q-e-harness` | #190 | 8e8bbb5 | PASS_WITH_NITS | 2 (cap: CI red at d763e2b, review FAIL at abe8b07); coordinator fixed B1, B2 | yes (3febec9) | — |

Outside the workstream, also merged this cycle: #180 desktop swipe (7e69814,
integrator fixed F4 after the cap), #186 Resources menu (c85c460). Lane A was
held until #180 and #186 merged because all three touch `index.html` and e2e.

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #176 | plan | PASS_WITH_NITS | 8 nits | merged; nits 1-8 fixed by D0 |
| #178 | P | PASS_WITH_NITS | 3 nits (N1-N3) | merged |
| #179 | M | FAIL | refresh_mutants anchored on context; index lines kept | bounced to lane M (attempt 1) |
| #179 | M | FAIL | parse_chunks loops on a bare blank context line (20 patches) | cap reached; coordinator took the lane over (f0693c2) |
| #177 | D0 | FAIL | M's acceptance `grep -c '^@@'` = 1 unreachable (decks.json + index.html hunks); 5 nits | coordinator fixed all (attempt 1) |
| #179 | M | PASS_WITH_NITS | 8 nits (unknown-prefix loop, mutant relocation, -U8 comment, sync_decks main() dup, staged-only dirty check, git guard, missing-target traceback, 2 fixture gaps) | merged f0693c2 |
| #177 | D0 | PASS_WITH_NITS | 5 nits (waves list, R3 162, -U8 wording, stale M row, P floor wording) | merged a432c1f; nits fixed in the follow-up docs PR |
| #183 | T | FAIL, FAIL, PASS_WITH_NITS | allowlist keyed on host line numbers; see nits below | merged 1264f35 |
| #184 | F | PASS_WITH_NITS | see nits below | merged 08e255a |
| #185 | B | PASS_WITH_NITS | see nits below | merged 26a8565 |
| #182 | C | FAIL x4 | F3; F1 (check_node dropped the per-file floor) | cap reached; coordinator fixed F3 and F1 (02e368d, mutant b6dd13e) |
| #182 | C | PASS_WITH_NITS | see nits below | merged b6dd13e (shard 2 baseline flake rerun at same SHA) |
| #187 | docs | PASS_WITH_NITS | Attempts column, cap wording, queue-row order, F label | merged 4791bfa; nits fixed here |
| #188 | A | PASS_WITH_NITS | 5 nits (below); fixture verified byte-identical from e8f9be8; 5 hand-rewritten mutants not weakened | merged 44467b6 |
| #189 | docs | PASS_WITH_NITS | N1 C Attempts wording, N2 #188 nit count, N3 "Merged this batch" scope | merged 4525ec4; nits fixed here |
| #190 | E | FAIL | B1 harness.test.js mutants scored SURVIVED without a browser (mutation_check.sh skip + shard marker); B2 Q1 share-link test ran at 900px after freshLoad()'s viewport reset | cap reached; coordinator fixed B1, B2, N1, N2 (8e8bbb5) |
| #190 | E | PASS_WITH_NITS | see nits below; 380px assertion and both new qe_ mutants verified killing | merged 3febec9 (CI green on 3 attempts at 8e8bbb5) |

## Queue

| # | Status | From | Row |
|---|---|---|---|

## Auto-decisions (AFK)

- D0 bundles all eight PR #176 review nits, not only the ownership gap, because
  nit 4 is lane M's acceptance command and nits 2/3/5/6/8 are factual errors
  lanes would be briefed with. Docs-only.
- Nit 5: "under 6 min" means the longest shard in CI (C's acceptance), and the
  goal now says so.
- Nit 7: the sandbox loader's new home is named `tools/sandbox.js`.
- #177's first CI run hung (could not be cancelled or rerun); retriggered with
  an empty commit. Its next run had a lone `sw_eatclick_any_button` survivor on
  a docs-only diff; rerun at the same SHA per the flake rule, then green.
- #179 hit the 2-attempt cap; the coordinator took lane M over and fixed the
  blank-context hang itself (a fresh reviewer still gates the merge). M also
  touched `sync_decks.inject()` under a coordinator directive.
- #177 FAIL fixed by the coordinator (D0's author). B and A now also wait on T,
  so T's ratchet allowlist exists before they delete their entries.
- The fly-out deflake was split out of E as lane F (#184) so it could land early.
- Lane A held until #180 (desktop swipe) and #186 (Resources) merged; all three touch `index.html` and e2e, so they were serialised.
- #182 hit the cap after four FAILs; the coordinator fixed F3 and F1 and a fresh reviewer gated the merge. Shard 2's baseline abort was rerun at the same SHA per the flake rule.
- Lane A's fixture is generated from e8f9be8 per finding 0; if the base fails `--check`, A reports the commit rather than regenerating.
- Lane A hand-rewrote 5 existing mutants that `refresh_mutants.py` refused; the reviewer confirmed none was weakened, so accepted as a scope deviation rather than a FAIL.
- Lane A left the reduced-motion `release()` -> `swipeRest()` extraction without a mutant: the reviewer found it is equivalent in practice (no transform is set under reduced motion), so accepted.
- Lane E writes the harness.test.js and e2e FLOORS rows itself, since C is merged.
- Q29's "3 consecutive green CI runs" was met with full-workflow reruns at the same head SHA (`gh run rerun`), not empty commits: same code, three independent executions, no history noise. Done at abe8b07 and again at 8e8bbb5 after the takeover fix.
- The coordinator took over lane E's CI wait, and after the review FAIL hit the cap, its fixes; the fix edited lane C's merged `mutation_check.sh` and `shard_mutants.js` (B1 lives there) and refreshed `h_e2e_mutant_skipped_by_filename`.
- E's README node-suite count (14 -> 15) and `harness.test.js` in `suite_health.py` E2E_FILES were accepted as direct consequences of the new file, outside E's ownership row.

## Queue rows to file

Triaged 2026-10-01 in `2026-10-01-post-refactor-triage.md` (#192): each row below has a disposition there, and FIX rows were worked in #194-#198. New reviewer nits from that wave are queued as Q36+ in `2026-09-30-nit-queue.md`.

- P/N1: `test_pdf_parity.py:64-65` says the smallest count is Amara shop 676; Hijaz shop is 524.
- P/N2: "2-field instrument" is wrong; it has 4 fields.
- P/N3: `test_the_sweep_actually_ran` does not assert a no-thirds seed.
- M: `f_fixture_sha` non-unique anchor deferred to C (`KNOWN_NON_UNIQUE_ANCHORS`).
- M/review nit: `refresh_mutants` anchors on removed lines only, so a mutant can silently move to an identical line in another function.
- M/review nits: refusal message lists every target file; `git diff` runs without `--no-color --no-ext-diff`; `--check` not yet in CI (C, briefed).
- M/#179 final nits: `parse_chunks` loops on an unknown hunk-line prefix (raise instead); `-U8` comment at `mutation_harness.test.js` ~386 is wrong; `sync_decks.main()` still duplicates `inject()` (T); dirty-target check misses staged-only changes; regen-in-worktree test lacks a git guard; missing target file gives a traceback; two `diff --git` sections for one file lose the first splice; no fixtures for the lint's bare-blank line or the pure-insertion re-anchor path (32 patches).
- T/#183: `_diff_refs` stale half is untested; `import validate` side effect; `run_check` catches only AssertionError; `sync_decks.main()` still duplicates `inject()`.
- F/#184: fixed ports race (e2e :8099/:8079/:8128); fly-out animation matched by duration 220.
- B/#185: dedupe gaps at `voicing.js` (badNote) and `select.js` (three sites); `qb_core_pc_no_wrap` header; `core.test.js` FLOORS row is 42 but the file has 49 tests (raise, never lower); voicing BAD_NOTE `<X>` substitution untested.
- C/#182: `.get(...,0)` defaults fail open; shard headroom (5m16s at 128 mutants); unexpected success not named in the log; python excerpt shorter than old `-v`; MUTANT_SHARD dirty check is shard-only; unbounded `collect_js` error string; redundant aggregate floors (4 reviewer mutants survived).
- #180 (outside workstream, E's area): triplicated settle logic and e2e writes private `b._pendingSettle`; mouse settle always takes the 1 s timeout; retry's release click flips the card; re-press log not visible in CI; wheel/drag springBack overlap; plan doc vs committed mutants mismatch; document click `land()` cuts the fly-out; main-side mouse-drag test baseline flake.
- #186 (outside workstream): 1024x700 test asserts horizontal overflow only; planned wrong-href/noopener/landscape mutants not committed; Tab-trap loop has a 1-press margin; backward Tab covered only via wrap; 320px label-wrap inequality.
- A/#188: `render()` duplicates the A/B counter tail; dropping B's `classList.remove("seq")` survives app.test.js (S->B leaves `.count.seq`; pre-existing gap); card keydown comment points at "CLAUDE.md G5" but G5 is in the quality-refactor plan; opBudget counts `HPE.voicing.choose` only, not `layout().solve`; the 22 edited mutant patches are not listed in the PR body (commit says 20).
- E/#190: new harness-skip fixture test's `doesNotMatch survived` is vacuous (fixture has no harness.test.js; mutant dies at baseline) - same as E2E_SKIPPED; `shard_mutants.js` header still says e2e-only and "161 of 477"; two finally comments say "rest of this test" (they guard the next test); `withViewport` has no callers; two touch literals in `cdp.js` (swipe/drag builders) not collapsed; print spy param named `variant` receives the options object; settle() self-tests stub Browser yet skip without one; settle() waits the full 500 ms under a persistent animation.
