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

Cycle: 1   Wave: 3   Merged this batch: #183 1264f35, #184 08e255a, #185 26a8565, #182 b6dd13e

| Lane | Branch | PR | Head SHA | Verdict | Attempts | Merged | Blocked on |
|---|---|---|---|---|---|---|---|
| D0 plan fixes | `claude/quality-coord` | #177 | a432c1f | PASS_WITH_NITS | 1 | yes | — |
| M | `claude/q-m-mutant-tooling` | #179 | f0693c2 | PASS_WITH_NITS | 2 (taken over) | yes | — |
| P | `claude/q-p-parity` | #178 | 265c964 | PASS_WITH_NITS | 1 | yes | — |
| T | `claude/q-t-tooling` | #183 | 1264f35 | PASS_WITH_NITS | 2 | yes | — |
| F e2e fly-out deflake (split out) | `claude/deflake-flyout` | #184 | 08e255a | PASS_WITH_NITS | — | yes | — |
| B | `claude/q-b-engine` | #185 | 26a8565 | PASS_WITH_NITS | — | yes | — |
| C | `claude/q-c-ci-gate` | #182 | b6dd13e | PASS_WITH_NITS | cap (F3, F1 taken over) | yes | — |
| A | `claude/q-a-app-shell` | — | — | — | 0 | — | running (spawned on aa7b261) |
| E | — | — | — | — | 0 | — | A |

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

## Queue rows to file

- T/#183: `_diff_refs` stale half is untested; `import validate` side effect; `run_check` catches only AssertionError; `sync_decks.main()` still duplicates `inject()`.
- F/#184: fixed ports race (e2e :8099/:8079/:8128); fly-out animation matched by duration 220.
- B/#185: dedupe gaps at `voicing.js` (badNote) and `select.js` (three sites); `qb_core_pc_no_wrap` header; `core.test.js` FLOORS row is 42 but the file has 49 tests (raise, never lower); voicing BAD_NOTE `<X>` substitution untested.
- C/#182: `.get(...,0)` defaults fail open; shard headroom (5m16s at 128 mutants); unexpected success not named in the log; python excerpt shorter than old `-v`; MUTANT_SHARD dirty check is shard-only; unbounded `collect_js` error string; redundant aggregate floors (4 reviewer mutants survived).
- #180 (outside workstream, E's area): triplicated settle logic and e2e writes private `b._pendingSettle`; mouse settle always takes the 1 s timeout; retry's release click flips the card; re-press log not visible in CI; wheel/drag springBack overlap; plan doc vs committed mutants mismatch; document click `land()` cuts the fly-out; main-side mouse-drag test baseline flake.
- #186 (outside workstream): 1024x700 test asserts horizontal overflow only; planned wrong-href/noopener/landscape mutants not committed; Tab-trap loop has a 1-press margin; backward Tab covered only via wrap; 320px label-wrap inequality.

- P/N1: `test_pdf_parity.py:64-65` says the smallest count is Amara shop 676; Hijaz shop is 524.
- P/N2: "2-field instrument" is wrong; it has 4 fields.
- P/N3: `test_the_sweep_actually_ran` does not assert a no-thirds seed.
- M: `f_fixture_sha` non-unique anchor deferred to C (`KNOWN_NON_UNIQUE_ANCHORS`).
- M/review nit: `refresh_mutants` anchors on removed lines only, so a mutant can silently move to an identical line in another function.
- M/review nits: refusal message lists every target file; `git diff` runs without `--no-color --no-ext-diff`; `--check` not yet in CI (C, briefed).
- M/#179 final nits: `parse_chunks` loops on an unknown hunk-line prefix (raise instead); `-U8` comment at `mutation_harness.test.js` ~386 is wrong; `sync_decks.main()` still duplicates `inject()` (T); dirty-target check misses staged-only changes; regen-in-worktree test lacks a git guard; missing target file gives a traceback; two `diff --git` sections for one file lose the first splice; no fixtures for the lint's bare-blank line or the pure-insertion re-anchor path (32 patches).
