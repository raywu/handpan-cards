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

Cycle: 1   Wave: 2   Merged this batch: #178 265c964, #179 f0693c2, #177 a432c1f

| Lane | Branch | PR | Head SHA | Verdict | Attempts | Merged | Blocked on |
|---|---|---|---|---|---|---|---|
| D0 plan fixes | `claude/quality-coord` | #177 | a432c1f | PASS_WITH_NITS | 1 | yes | — |
| M | `claude/q-m-mutant-tooling` | #179 | f0693c2 | PASS_WITH_NITS | 2 (taken over) | yes | — |
| P | `claude/q-p-parity` | #178 | 265c964 | PASS_WITH_NITS | 1 | yes | — |
| C | `claude/q-c-ci-gate` | — | — | — | 0 | — | running |
| B | — | — | — | — | 0 | — | T |
| T | `claude/q-t-tooling` | — | — | — | 0 | — | running |
| A | — | — | — | — | 0 | — | B, D0, T |
| E | — | — | — | — | 0 | — | C, A |

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

## Queue rows to file

- P/N1: `test_pdf_parity.py:64-65` says the smallest count is Amara shop 676; Hijaz shop is 524.
- P/N2: "2-field instrument" is wrong; it has 4 fields.
- P/N3: `test_the_sweep_actually_ran` does not assert a no-thirds seed.
- M: `f_fixture_sha` non-unique anchor deferred to C (`KNOWN_NON_UNIQUE_ANCHORS`).
- M/review nit: `refresh_mutants` anchors on removed lines only, so a mutant can silently move to an identical line in another function.
- M/review nits: refusal message lists every target file; `git diff` runs without `--no-color --no-ext-diff`; `--check` not yet in CI (C, briefed).
- M/#179 final nits: `parse_chunks` loops on an unknown hunk-line prefix (raise instead); `-U8` comment at `mutation_harness.test.js` ~386 is wrong; `sync_decks.main()` still duplicates `inject()` (T); dirty-target check misses staged-only changes; regen-in-worktree test lacks a git guard; missing target file gives a traceback; two `diff --git` sections for one file lose the first splice; no fixtures for the lint's bare-blank line or the pure-insertion re-anchor path (32 patches).
