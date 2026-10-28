# Agent-quality comparison: Claude Code lanes vs Codex sessions (2026-10-27)

Research only. Lane AQ of workstream afk-2026-10-27. No code, no tooling committed.

## Headline

1. Throughput and merge rate are close: on main-base PRs Claude merged 220 of 249 (88%) and Codex 12 of 16 (75%); Codex's sample is too small to call that a difference.
2. CI red at first push is similar within noise: Claude 62 of 248 PRs that ran CI (25%), Codex 5 of 16 (31%); Codex also had 2 first runs cancelled.
3. The two families are not comparable on reviewer verdicts: the PASS/PASS_WITH_NITS/FAIL table rows exist only in Claude-era coordination docs (about 172 PASS_WITH_NITS, 10 PASS, 45 FAIL table-row mentions). Codex work does record independent reviews (14 of 16 Codex main-base PR bodies record a review: #581, #579, #573, #591, #589, #583, #577, #575, #570, #567, #564, #562, #560, #559; #587 only says a review is required, and #586 refers to a reviewed plan; and the four Codex coordination docs: 2026-10-24-repo-continuity-coordination.md:21-22,37; 2026-10-25-duplicate-notes-coordination.md:12-14,30; 2026-10-25-seo-longtail-coordination.md:71,77; 2026-10-25-share-customization-hotfix-coordination.md:3,33), but not in that verdict vocabulary, so the grep cannot count them and the verdict signal is not comparable. Nothing here supports ranking one agent above the other.

## Method

Data pulled 2026-10-27 from `raywu/handpan-cards` with `gh` (raw JSON kept in the scratchpad, not committed).

- PR list (family = head branch prefix `claude/` or `codex/`):
  `gh pr list --state all --limit 400 --json number,headRefName,state,title,createdAt,mergedAt,headRefOid,baseRefName`
  The pull ended at #594 (the newest PR at pull time was later, #596); the counts apply the filter 195 <= number <= 594, so the 400 cap truncates 194 PRs (#1..#194). The window starts 2026-10-02.
- CI per PR, one call per PR:
  `gh run list --workflow validate.yml --branch <headRefName> --event pull_request --limit 100 --json conclusion,headSha,createdAt`
  Runs created before the PR's `createdAt` are dropped (branch-name reuse); runs with an empty conclusion (in progress) are dropped. "First CI conclusion" is the earliest remaining run. "Pushes tested" is the count of distinct `headSha` values with a completed run. A PR with more than one is a "bounce" proxy: a fix-up push after CI or review, not necessarily a red run.
- Reviewer verdicts, table rows only (exclude prose and definitions):
  `grep -E '^\|' docs/plans/*coord*.md | grep -ow 'PASS_WITH_NITS'` and the same for `FAIL`, `PASS`, per file.
- Codex context read, not measured: `docs/CODEX_CONTINUITY.md`, `CODEX_HANDOFF.md`, `CODEX_ENV_HANDOFF.md`, `CODEX_ONBOARDING_PLAN.md` in `/Users/ray/Projects/handpan-cards/docs/` (untracked).

## Data

Counts by head-branch prefix (`python` over prs.json; Counter of prefix and `state`):

| Family | PRs | Merged | Closed unmerged | Open | Window (createdAt) |
|---|---|---|---|---|---|
| claude/* | 353 | 314 | 36 | 3 | 2026-10-02 to 2026-10-27 |
| codex/* | 30 | 25 | 3 | 2 | 2026-10-24 to 2026-10-27 |

Other prefixes (main 9, discoverability 6, share-url 2) are excluded.

Base branch: claude 249 main, 102 dev, 2 stacked; codex 16 main, 14 dev. Per CLAUDE.md, CI runs only on PRs into `main`, so dev PRs have no validate run. The fair comparison is therefore main-base only:

| Main-base PRs | Claude | Codex |
|---|---|---|
| PRs | 249 | 16 |
| Merged / closed / open | 220 / 28 / 1 | 12 / 3 / 1 |
| Merge rate (merged / PRs) | 88% | 75% |
| PRs with a completed validate run | 248 | 16 |
| First run success | 185 | 9 |
| First run failure | 62 | 5 |
| First run cancelled | 1 | 2 |
| First-run red rate | 25% | 31% |
| Merged AND first run green | 172 | 6 |
| Merged with more than one tested push | 133 of 220 (60%) | 10 of 12 (83%) |

All-bases view (PRs with a run; includes the doc-only skips that conclude success). Paired dev PRs sharing a head branch with a main PR inherit the main PR's runs (13 of 29 Codex rows, 23 of 24 Claude dev rows), so the per-push rows double-count:

| | Claude | Codex |
|---|---|---|
| PRs with a run | 274 | 29 |
| Pushes tested per PR, mean / median | 2.57 / 2 | 2.52 / 2 |
| Pushes tested per merged PR, mean | 2.71 | 2.04 |
| Per-push first conclusion success / failure / other | 529 / 170 / 6 (3 cancelled, 3 startup_failure) | 49 / 16 / 8 |
| Per-push red rate | 24% | 22% |
| Median / mean hours open to merge (merged PRs with a run, all bases) | 0.6 / 9.5 | 1.8 / 8.0 |
| Same, main-base only | 0.7 / 10.4 | 9.2 / 15.1 |

Commands: all rows above come from the two throwaway analysis scripts in the scratchpad over prs.json and runs.json, both produced by the `gh` commands in Method (`python3 an.py`, `python3 an2.py`).

Reviewer verdict table rows (`grep` above), Claude-era coordination docs:

| File | PASS_WITH_NITS | PASS | FAIL |
|---|---|---|---|
| 2026-09-16-remaining-work-coordination.md | 26 | 0 | 4 |
| 2026-09-24-one-pdf-path-coordination.md | 23 | 1 | 3 |
| 2026-09-30-quality-refactor-coordination.md | 21 | 0 | 8 |
| scale-engine-coordination.md | 102 | 9 | 30 |
| Total | 172 | 10 | 45 |

The four Codex-era coordination docs (2026-10-24-repo-continuity, 2026-10-25-duplicate-notes, 2026-10-25-seo-longtail, 2026-10-25-share-customization-hotfix) have zero PASS/PASS_WITH_NITS/FAIL table rows, but they do record independent reviews in other wording (repo-continuity-coordination.md:21-22,37; duplicate-notes-coordination.md:12-14,30; seo-longtail-coordination.md:71,77; share-customization-hotfix-coordination.md:3,33), as do 14 of 16 Codex main-base PR bodies. The same totals by a raw word count over all lines (`grep -ohE "\b(PASS_WITH_NITS|PASS|FAIL)\b" docs/plans/*coord*.md | sort | uniq -c`) are 193 / 18 / 52, inflated by prose and definitions; use the table-row figures.

## Caveats

- Sample size: Codex has 16 main-base PRs over three days. A 6-point gap in red rate is about one PR. No difference here is statistically meaningful.
- Selection bias: Codex was brought in late (from 2026-10-24) for continuity, Mac browser repair, release reconciliation and docs/plan recovery. Claude did the bulk of feature lanes. Task mix and difficulty differ and are not controlled.
- Different gates: Claude lanes were meant to run under /swarm with an independent reviewer and an explicit TDD brief (not checked for every PR; some Claude PRs, such as docs lanes and syncs, may have had no reviewer); Codex sessions ran under their own handoff docs. Verdict-vocabulary counts are Claude-only; Codex reviews exist but are worded differently.
- Bounce proxy is crude: multiple pushes include planned stacking, merge-from-base, rebases and release reconciliation, not only defects. Codex's high multi-push share partly reflects release and reconcile PRs.
- First-run red includes infrastructure noise (cancelled, `startup_failure`, a known flaky mutation gate in memory); I counted a cancelled first run as neither pass nor fail and did not rerun anything. CI did not run on dev-base PRs at all.
- Closed-unmerged is not failure: many Claude closures are superseded or held PRs (the repo holds main PRs until the owner merges).
- Truncation: the oldest 194 PRs (#1..#194, before 2026-10-02) are outside the window, so Claude figures reflect one month, not the whole project.
- Branch prefix is the only attribution; a Codex-authored fix pushed to a `claude/` branch (or the reverse) would be misattributed. This is concrete here: #559 carries 24 of 44 commits with Claude trailers, and #587, #589 and #591 have 0 Claude-trailer commits but concern a Claude handoff or a release that bundles lanes, so all four are flagged as mixed attribution. Verdict-table rows can count one PR several times (re-review) and some rows mention FAIL while describing a prior verdict.
- Verdict rows come from September coordination docs, predating the 2026-10-02..27 PR window, so they do not describe the same period as the CI data.
- The 400-limit pull and `gh run list --limit 100` per branch could miss runs on very long-lived branches.

## Conclusion

With current history the evidence supports only these claims: both families land most of their main-bound PRs; first-push CI is red about a quarter of the time for each; and about 60% of Claude and 83% of Codex merged PRs had more than one tested push. It does not support a claim that either agent is better, and the reviewer-verdict signal is not comparable because only Claude records verdicts in the PASS/PASS_WITH_NITS/FAIL vocabulary. The one structural finding is that Codex reviews exist but are recorded in free wording, so the verdict signal cannot be counted, not that Codex is shown to be lower.

## Proposed lightweight ongoing metric (no new infrastructure)

Record two fields per lane in the existing coordination doc status row, filled at merge by the integrator from commands already run in the merge gate:

1. `first_ci`: the conclusion of the first `validate` run on the lane's PR (`gh run list --workflow validate.yml --branch <b> --event pull_request --json conclusion,createdAt -q 'sort_by(.createdAt)|.[0].conclusion'`).
2. `verdict`: the independent reviewer's first verdict (PASS / PASS_WITH_NITS / FAIL), for every lane regardless of agent, including Codex ones, plus `agent: claude|codex`.

Review quarterly with the same `gh pr list` plus `grep -E '^\|'` commands above, and report first-CI red rate and first-verdict FAIL rate per agent only once each has at least 30 main-base PRs; below that, report counts, no rates. Standardise the verdict vocabulary (PASS / PASS_WITH_NITS / FAIL) across Codex PR bodies and coordination docs so the verdict column becomes comparable; no new gate is needed.
