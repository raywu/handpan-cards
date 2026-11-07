# Scoped mutation gate for lane PRs; full gate for release PRs

Mode: plan (spawned, AFK armed; recommended options auto-picked, logged below). Stop: plan ready / not ready. No code, commits, PRs or Linear writes in this run.

## Goal (owner-decided 2026-11-07, revised twice the same day)
- Lane PRs into `main` run only the mutants for the parts they edit, plus mutants tied to any test the PR changes or deletes.
- FULL mutation stays required, before the dev merge, for any PR touching scale data, the scale engine or saved scales (sets FD/FE/FS below), and for every release PR into `main`.
- A release PR into `main` needs: full `validate` at the exact head (full mutation + full e2e in CI), an independent RC review, and an e2e pass on served DEV (`docs/testing/browser.md`) of the RC head, before the main merge. Never merges red; a full-run failure is fixed on a follow-up PR, then re-run.
- Scoping applies to mutation only. Lane PRs keep running the full e2e suite (js-tests) in CI as today.
- Push to `main` always runs full.

## Full-run trigger sets (precise)
- FD scale data: `data/decks.json`; `tools/sync_decks.py`; `tools/regen_data_mutants.py`; `tools/decks.py`; mutants `tests/mutants/b_*.patch`, `c_*.patch`; `tests/test_deck_data.py`. (No in-file DECKS-line check: a real edit carries `data/decks.json`, a hand edit fails validate check 1.)
- FE scale engine: `src/engine/*.js`; `tools/inline_engine.py`; (no region parsing: a real engine edit carries `src/engine/*.js`, a hand edit fails validate check 4); any mutant whose `+++ b/` target is under `src/engine/`; `tests/fixtures/engine_corpus_v1.json`, `tools/regen_engine_corpus.js`.
- FS saved scales (saved-scale app code lives in `index.html` app JS, so FS is partly content-based): paths `tests/storage_corpus.test.js`, `tests/link_corpus.test.js`, `tests/share.test.js`, `tests/fixtures/shipped_client_*.html.txt`, `tools/probe/saved_variants_storage.js`, `qa-seed.html`, plus any path from `git grep -lE 'localStorage|indexedDB'` at lane start (lane records the list); mutants with prefixes `idba_ idbh_ saved_ sv_ svh_ mv_ us_ uid_ url_`; any added/removed line in `index.html` or in any `tests/*.test.js` / `tests/*.py` matching, case-insensitive, `localStorage|sessionStorage|indexedDB|\bIDB|saved|variant|custom:|handle|#s=|move|migrat|sync|storage`. Over-matching is accepted (fails toward full). The lane prints the matched pattern in the `changes` log. Lane must re-verify the prefix list against `# kills:` headers (grep `IDB|SV|SVH|saved|move|storage`) and extend it, never shrink it, in the plan's decision log.
- FR release: head ref `claude/release-*`.
Any hit => `mode=full`.

## Non-goals
- No change to mutant contents, `# kills:`/`# suite:` headers, sharding algorithm (`tests/shard_mutants.js`), FLOORS rows, or the other CI jobs (data, python-tests, js-tests, suite-health, panel-fit).
- No region-level (hunk-level) mapping inside `index.html` (hunk headers are stale: memory `mutant-hunk-headers-are-not-line-refs`).
- No new harness, no new workflow file, no label-driven mode.
- No change to dev-PR CI (CI still never runs on PRs into `dev`).

## Decisions
| id | decision | source |
|---|---|---|
| D1 | Release marker = PR head ref matches `claude/release-*` (covers existing `claude/release-rc-*`, `release-move-*`, `release-nits`). Broader than `release-rc-*` so every release-shaped branch fails toward full. | AFK recommendation (reversible); evidence: `git branch -r` lists both shapes |
| D2 | Mutant -> covered files = every `+++ b/<path>` target in the patch ∪ the test file(s) named in its `# suite:` header (last path-like token ending `.py`/`.js` under `tests/`) ∪ the patch file itself. | requirement + recommendation |
| D3 | (superseded by FD/FE: generated regions now force full) Generated regions need no extra mapping: `src/engine/*.js`, `data/decks.json`, `data/i18n/*.json`, `brand/*.svg` edits must regenerate `index.html` in the same PR (validate checks 1/4/6, make_icons `--check`), so `index.html` is in the diff. Belt-and-braces: an explicit SOURCE_OF map adds `index.html` (and `scales/*/index.html` for decks/i18n) to the changed set when any of those sources change. | CLAUDE.md "GENERATED" rules |
| D4 | Selection = mutants whose covered set intersects the changed paths (deleted paths included: `git diff --name-only` lists deletions). | requirement |
| D5 | Fail-safe => FULL when any of: event is push; head ref is a release ref; diff empty/unreadable; any changed path is in HARNESS (`tests/mutation_check.sh`, `tests/shard_mutants.js`, `tools/ci_scope.py`, `tools/refresh_mutants.py`, `tools/regen_data_mutants.py`, `.github/workflows/*`, `tests/helpers/*`, `tools/sandbox.js`, `requirements-ci.txt`, `package*.json`); any changed non-doc path is unmappable (not covered by any mutant, not a SOURCE_OF key, not in DOC_LIKE = `README.md`, `CLAUDE.md`, `docs/*.md` (top level), `docs/testing/*.md`, `tests/CONTRACT.md`: these go to scoped-with-their-mutants and, if no mutant covers them and nothing else changed, to full by the zero rule); or selection is empty while `code=true`. | requirement |
| D6 | Scope output is a file list `artifacts/mutant-selection.txt` + `mode=full|scoped`; `mutation_check.sh` gains `MUTANT_LIST=<file>` intersecting each shard after partition (see step 4) (same mechanism shape as `MUTANT_SHARD`). Empty list => exit 1 (mirrors existing "selects zero" refusal). | smallest change |
| D7 | Aggregate `mutation-gate` job: union-of-shards check compares against the selection list in scoped mode, full corpus in full mode. Shards with zero assigned mutants from a small selection exit 0 with an empty report (exception scoped only to `MUTANT_LIST` mode; zero-total stays exit 1). | recommendation |
| D8 | FLOORS (`tests/suite_health.py`) are per-file test counts read from python/js result artifacts, not mutant results: unaffected by partial runs. README mutant count (`tests/test_readme_currency.py`) counts corpus files: unaffected. Only the union check (D7) depends on the run. | verified by read |
| D9 | No design review: CI tooling only, no UI or interaction. CEO review not requested. | skill rule |
| D10 | RC review = existing independent reviewer subagent run at the release head SHA (same gate as lanes), named "RC review" in the release checklist. No new tooling. | recommendation |

## Assumptions
- A1 PR runs check out the merge ref so `HEAD^1..HEAD` is base..merge (verified: existing `changes` job relies on it).
- A2 `github.head_ref` is available in `pull_request` events (GitHub contract; verified by lane in first CI run, which shows `mode=` in logs).
- A3 Every mutant has exactly one `# suite:` line (enforced already: header-less patch refused).

## Why smallest
Note (F3): ~1062/1808 mutants target `index.html` and FS keywords are broad, so most app-JS lanes will still run full; savings land mainly on tools/python/CSS-only lanes. Accepted: fails safe. Reuses the existing `changes` job, `ci_scope.py`, and the `MUTANT_SHARD` path in `mutation_check.sh`; adds one function, one env var, one workflow output and a branch in the union check. No region parsing.

## Phase 1 (single lane `claude/scoped-mutation`, worktree from `main`)
Ownership: `tools/ci_scope.py`, `tests/test_ci_scope.py`, `tests/mutation_check.sh`, `.github/workflows/validate.yml`, CLAUDE.md (one sentence), one new mutant `tests/mutants/sm_*.patch`, plus `docs/` release checklist line if one exists. Touching `mutation_check.sh` means grant refreshes to the five `h_*` mutants (memory `mutation-check-edits-stale-h-patches`): refresh every patch found by `grep -l '^+++ b/tests/mutation_check.sh' tests/mutants/*.patch` (today six: five `h_*` + `qe_harness_mutant_scored_survived`) and check `e_launch_retry_swallows_real_failure`; `git apply --check` each.

TDD order (tests first, red, then implement):
1. `tests/test_ci_scope.py` new cases:
   - app-only change (`index.html` CSS hunk, no FS keyword) asserts `mode == "scoped"` AND a non-empty list containing index.html mutants and no `tools/hifi.py` mutants (F8: the selects-nothing mutant must be killed by this assertion, not masked by the zero=>full fallback).
   - push event with code=true -> full regardless of diff (F9).
   - `tools/hifi.py` change selects mutants targeting it and none targeting `src/engine/share.js`.
   - edit/delete of `tests/test_print.py` selects every mutant whose suite names it.
   - changed `tests/mutants/x.patch` selects x.
   - each FD/FE/FS trigger -> full: `data/decks.json`; `src/engine/share.js`; an index.html hunk adding a `localStorage` line; a `tests/e2e.test.js` hunk adding an `indexedDB` line; `tools/probe/saved_variants_storage.js`; a changed `sv_*.patch`; `tests/storage_corpus.test.js`. And a negative: an index.html CSS-only hunk with no FS keyword -> scoped.
   - workflow test: js-tests job has no `mode` condition (e2e never scoped).
   - each HARNESS path -> full; push -> full; head ref `claude/release-rc-2026-11-10` and `claude/release-nits` -> full; unmappable path (`foo/bar.txt`) -> full; empty diff -> full; selection empty with code=true -> full; doc-only -> code=false, no mutation job.
   - a corpus-wide property: every mutant in `tests/mutants/` maps to >=1 target file (fails if a patch has no `+++ b/`).
   - workflow test: `mutation-gate-shard` passes `MUTANT_LIST` only when `mode == scoped`; union check reads selection in scoped mode; push branch forces full.
2. New mutant `tests/mutants/sm_scope_selects_nothing.patch` making `select()` return `[]` unconditionally; `# kills:` the app-only selection test; `# suite: python3 -m pytest -q tests/test_ci_scope.py -k app.only` (dot wildcards; memory `mutant-suite-headers-are-word-split`; no `index` lines: `mutant-patches-reject-index-lines`). Second mutant `sm_release_ref_scoped.patch` dropping the release-ref check, killed by the release-ref test. Third `sm_saved_scales_scoped.patch` dropping the FS keyword check, killed by the localStorage-hunk test.
3. Implement `ci_scope.py`: `mutant_coverage(patch_text)`, `full_trigger(changed, diff_text, head_ref)` (FD/FE/FS/FR/HARNESS), `select(changed, diff_text, event, head_ref, corpus)` -> `("full", None) | ("scoped", [names])`; CLI prints `code=`, `mode=` and writes the list.
4. `mutation_check.sh` (F1 fix): shard the FULL corpus as today (`shard_mutants.js` unchanged), intersect the shard with `MUTANT_LIST`, THEN write `MUTANT_REPORT` from the intersection. With `MUTANT_LIST` set, an empty intersection exits 0 (both the "selects zero" and "NO MUTANT WAS KILLED" exits are skipped); without it, current behaviour. An empty `MUTANT_LIST` file itself exits 1. Without `MUTANT_SHARD`, intersect the whole corpus with the list (entries are patch basenames); a listed name not in the corpus exits 1 (F11). Add `MUTANT_LIST` to the existing `unset MUTANT_SHARD MUTANT_REPORT` line so nested h_*/mh_* fixture runs ignore it, with a test (F10). Test: a one-mutant selection across 4 shards yields reports whose union equals the selection.
5. `validate.yml`: `changes` job passes `github.event_name` and `github.head_ref` via `env:` (never interpolated into `run:`, F7), runs a second `git diff HEAD^1 HEAD` for content, emits `mode`, uploads selection artifact; shards download it; aggregate union check branches on mode. Push path unchanged (full).
6. CLAUDE.md (owner APPROVED this exact sentence 2026-11-07, "ok"; verbatim only): replace the sentence beginning "D merges only on a green full `validate` on M..." in "Release and CI gates" with exactly:
   "D merges only on a green `validate` on M at the exact head, an addressed independent review, and not CONFLICTING. Lane PRs run mutation scoped to the modules and tests they change; a PR touching deck data, the scale engine or saved scales runs the full mutation suite, as does every release PR into `main`, which also gets an independent RC review and an e2e pass on served DEV, and never merges red."

Acceptance (observable):
- `python3 -m pytest -q tests/test_ci_scope.py` green; both `sm_*` mutants killed by `./tests/mutation_check.sh` with `MUTANT_LIST` naming them.
- `python3 tools/validate.py` green; `tests/suite_health.py` FLOORS row for `tests/test_ci_scope.py` raised by the lane's own added count (from CI artifacts: memory `floors-rows-lag-ci-count`).
- CI on PR M at verified head: this PR touches HARNESS, so it must log `mode=full` and run all mutants green (self-proving fail-safe).
- Probe (expect scoped only for non-FS lanes): a throwaway follow-up PR touching only `tools/hifi.py` (or a later real lane) logs `mode=scoped` with a selection count < corpus and union check passes. Recorded in the lane report; if no such PR lands in the lane, the first real lane after merge is the probe and the integrator checks its log.
Verify: `python3 -m pytest -q tests/test_ci_scope.py && python3 tools/validate.py && gh run list --commit <sha> --workflow validate.yml`.

## Phase 2 (release procedure, no code): RC checklist
Owner of step: integrator. For a `claude/release-*` PR into `main`: (a) `gh run list --commit <head> --workflow validate.yml` conclusion success with `mode=full` in the `changes` log; (b) fresh independent RC reviewer subagent at that head returns PASS/PASS_WITH_NITS; (c) the RC head is merged to `dev` (or served on a DEV preview) and the served-DEV e2e of `docs/testing/browser.md` passes at that head; (d) owner says merge. Any red: follow-up PR, re-run (a)-(c) at the new head. Acceptance: the release PR body records the three facts with SHAs. The lane adds this checklist as one short section to `docs/testing/browser.md` only if that file already hosts release steps; otherwise it lives in this plan and the CLAUDE.md sentence (no new doc).

## Verification split
- Automated: unit tests above, two new mutants, full CI at head.
- Self: lane reads the `changes` job log for `mode=` and selection size.
- Independent: fresh reviewer subagent at verified head SHA (`/review`, read-only), checks D5 list vs diff, CLAUDE.md patch is verbatim, ownership.
- Human: none (no UI). Main merge stays owner-gated.

## Risks / edge cases
- R1 Under-selection via a shared helper not in HARNESS (e.g. a new `tests/helpers/foo.js`): `tests/helpers/*` glob is HARNESS -> full. Any other unknown path -> unmappable -> full.
- R2 A test file rename: `--no-renames` lists both delete and add; mutants naming the old path selected and fail -> correct red.
- R3 Mutation flake (memory `mutation-gate-can-flake`): rerun failed shard at same SHA; unchanged.
- R4 Scoped run misses a cross-module kill regression; caught at release full run, fixed on follow-up PR (accepted by goal).
- R5 `mutation_check.sh` restores the tree; don't edit worktree while it runs (memory).

## Recovery
Revert the lane PR restores full-always behaviour; no data or state involved.

## Continuation point
Dispatch lane `claude/scoped-mutation` from current `main` (e36333c9 or later) with this file as the brief; step 1 tests first.

## Stop
Plan written; execution requires dispatch by the integrator. Main merge owner-gated.

## Decision log (AFK)
- D1 release marker `claude/release-*` (broader than asked `release-rc-*`; fails toward full).
- D6/D7 env-var + selection artifact over a new workflow.
- D10 RC review reuses the existing reviewer gate.
- Review round 1 (NOT READY, F1 high) dispositions: F1 fixed (shard-then-intersect); F2 fixed (FS paths + test-file keyword scan); F3 fixed (documented); F4 fixed (region rules dropped); F5 fixed (grep-derived set); F6 fixed (DOC_LIKE listed); F7 fixed (env:); F8 fixed (assertion); F9 fixed (push test). Round 2 READY; F10, F11 folded into step 4; F12: scoped-mode probe log check carried as a Linear next: item.
- FS defined by index.html content keywords + mutant prefixes, since saved-scale code has no file of its own; over-matching accepted.
- CLAUDE.md sentence approved by owner 2026-11-07. Priority: P0, runs before all other new lanes (owner 2026-11-07).

## Review log
(appended below by the independent eng reviewer)

### 2026-11-07 independent eng review (read-only) — verdict NOT READY (1 high, fixable in-plan)
- F1 HIGH — D6/step 4 order is unimplementable as written. `tests/shard_mutants.js` partitions the `tests/mutants` directory itself and `mutation_check.sh` writes `MUTANT_REPORT` from that output before any filter, so "restrict PATCHES before sharding" needs a shard_mutants change (a non-goal), and intersect-after-shard leaves the report listing unselected mutants, so the D7 union check (selection vs reports) fails every scoped run. Fix: pin the order — shard the full corpus, intersect with `MUTANT_LIST`, write `MUTANT_REPORT` after the intersection, skip the zero-selects exit-1 (and the "NO MUTANT WAS KILLED" exit) only when `MUTANT_LIST` is set and the intersection is empty, and add a test that a 1-mutant selection passes the union check across 4 shards.
- F2 MEDIUM — FS misses saved-scale files outside `index.html`: `tests/fixtures/shipped_client_*.html.txt` (old-client migration fixtures), `tools/probe/saved_variants_storage.js`, `qa-seed.html`, `tests/share.test.js`; storage tests inside `tests/app.test.js`/`tests/e2e.test.js` only get scoped selection (evidence: `git grep -lE 'localStorage|indexedDB'`). The fixtures and probe are probably unmappable, so they go full, but that is by accident. Fix: name them in FS explicitly, and run the FS keyword scan over added/removed lines of every changed test file, not just `index.html`.
- F3 MEDIUM — FS keywords (`move|sync|handle|variant|saved|storage`) match most app-JS diffs, and 1062 of 1808 mutants target `index.html`. So nearly every app lane runs full or close to full, and the savings fall mostly on tools/engine-free lanes. That is acceptable (it fails safe), but "Why smallest" should say so, and the probe acceptance should name the expected scoped share.
- F4 MEDIUM — "Inside an engine region" (FE) means mapping PR-diff line numbers onto region markers in HEAD `index.html`, which contradicts "No region parsing". It also adds nothing: validate check 4 fails a hand edit, and a legitimate edit carries a `src/engine/*.js` change, which is already FE. Fix: drop the region rule, or state it as a check of the HEAD line range. The same applies to the `const DECKS` line in FD (`data/decks.json` already covers it).
- F5 MEDIUM — `h_*` refresh count is wrong: 6 mutants target `tests/mutation_check.sh` (`grep -l '^+++ b/tests/mutation_check.sh' tests/mutants/*.patch`: 5 `h_*` plus `qe_harness_mutant_scored_survived`, plus `e_launch_retry...`, which references it). Fix: grant refreshes to every patch that has a `+++ b/tests/mutation_check.sh` target, found by grep, not a fixed "five".
- F6 MEDIUM — DOC_LIKE allowlist is unnamed. Fix: list the paths (or say empty: every unmapped doc goes full).
- F7 LOW — pass `github.head_ref` to `ci_scope.py` through `env:`, never interpolated into `run:` (branch-name injection). The `changes` job (fetch-depth 2, HEAD^1..HEAD) does have the diff text it needs: replace `--name-only` with a second `git diff --no-renames HEAD^1 HEAD` call for the content.
- F8 LOW — the `sm_scope_selects_nothing` kill works only if the app-only test asserts `mode==scoped` and a non-empty list; with the D5 empty→full fail-safe, an assert on the list alone could pass vacuously. State the assertion.
- F9 LOW — push-to-main: today a merge-commit push takes the doc-only diff path. State that a push forces `mode=full` whenever `code=true`.
Verified OK: D8 FLOORS/README counts are independent of partial runs; A1 holds (the `changes` job already diffs HEAD^1..HEAD); every mutant has `# suite:`; triggers are push/PR-into-main only; js-tests is not mode-gated.
Criteria: (1) FAIL (F1) (2) PASS (3) PASS with F3 note (4) PASS (5) PASS (6) PARTIAL (F1/F8 tests) (7) PASS (8) PASS (9) PASS with F6.

### Round 2
Verdict READY (no blocker/high; two mediums to fold into step 4 at lane start).
- Fix checks: F1 fixed: step 4 now shards the full corpus, intersects, then writes `MUTANT_REPORT`, which matches `tests/mutation_check.sh` (the `MUTANT_SHARD` block writes the report before `PATCHES` is rebuilt) and the `validate.yml` union step (`ls *.patch` vs `cat mutant-shard-*.txt`), with D7 branching on mode. F2 fixed: the FS paths are named and the keyword scan covers test files. F3 fixed: documented in "Why smallest". F4 fixed: the region rules are gone. F5 fixed: the set is grep-derived. F6 fixed: DOC_LIKE is listed. F7 fixed: `env:`. F8 fixed: the assertion is stated. F9 fixed: there is a push test. FS prefixes exist in the corpus (sv 78, svh 16, mv 25, uid 29, url 13, idbh 14; idba/saved/us 21).
- F10 MEDIUM: nested runs inherit `MUTANT_LIST`. `mutation_check.sh` unsets `MUTANT_SHARD MUTANT_REPORT` because the h_*/mh_* suites re-invoke the script on a fixture corpus. A `MUTANT_LIST` left set would intersect that fixture corpus with the outer selection. The intersection would be empty, the inner run would exit 0, and the harness tests' expectations would break (or pass vacuously). Fix: step 4 adds `MUTANT_LIST` to that `unset` line, plus a test that a nested run ignores it.
- F11 MEDIUM: `MUTANT_LIST` without `MUTANT_SHARD` is undefined. Step 4 only describes intersecting a shard, yet the acceptance criterion runs `./tests/mutation_check.sh` with `MUTANT_LIST` naming the sm_* mutants and no shard. Fix: with no shard, intersect the whole corpus with the list. Entries are patch basenames (the same format as the shard reports). A listed name that is not in the corpus exits 1.
- F12 LOW: the scoped probe is deferred to "first real lane after merge". Acceptable, but the integrator must record that log check as a Linear `next:` item.
Criteria: (1) PASS (2) PASS (3) PASS (4) PASS (5) PASS (6) PASS with F10/F11 tests added (7) PASS (8) PASS (9) PASS.
