# Refactor pass 6: code base and tests, no regressions

**SHA read:** `37e7f7f` (main, "Merge pull request #348 from raywu/claude/nits-share-about").

**Where it was drafted.** On branch `claude/refactor-pass-6-plan`, in the worktree `/Users/ray/Projects/handpan-cards/.claude/worktrees/agent-a5647bf3a73b442ea`, from the prompt `docs/plans/2026-10-17-refactor-pass-6-prompt.md`.

**Scratch.** "Scratch" means `/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/3347d7d0-1ec9-4967-bd81-dd4cf98e29d7/scratchpad`, shortened to `$S`. Nothing there is in the repo. The scratch worktree `$S/weak` was used for the WEAK evidence and removed before commit.

**Summary.** The measurements again found little that clears the bar:

- **Churn.** One `index.html` function-level hotspot: the `hashchange` listener, touched by 6 of the last 60 commits. Every one of those 6 was a feature change, so no refactor shape would reduce that churn.
- **Weak tests on that hotspot.** Two tests whose subject is the hotspot were shown WEAK. Two one-hunk breaks in `routeToDeck`, which the listener calls, leave all 618 tests in `tests/app.test.js` green. This is the one DO candidate, P6-1.
- **Bars not met.**
  - No mutant was re-anchored on 3 of the last 20 merged PRs. The highest is 2.
  - No fixed wait of 30 s lies on the critical path.
  - There is one main-branch flake in 60 runs.
- **Nit triage.** It folds 13 still-true nits: 3 into the tests lane and 10 into a docs lane. It closes the rest, and it gates two share-format nits to the owner.

The plan has three lanes:

| lane | wave | covers |
|---|---|---|
| `tests` | 1 | P6-1 plus three folded test nits |
| `docs` | 1 | folded nits only |
| `reconcile` | 2 | README count and FLOORS rows |

## 0. The request

Owner request (standing since pass 5, 2026-10-14), verbatim:

> "Evaluate our code base and tests - identify where we should refactor and improve. Must not introduce any regression. Output a plan from the investigation. Iterate to produce a 10/10 quality plan."

Deliverables:

1. **Where to refactor.** These are the section 5 rows of class REFACTOR or HARNESS. None reaches DO. See P6-2, P6-6, P6-8 and P6-9.
2. **Where to improve the tests.** These are the section 5 rows of class TEST-STRENGTHEN, TEST-DEDUP, TEST-SPEED and TEST-FLAKE, plus the strength sample in 4.6.
   - One row reaches DO: P6-1, lane `tests`.
   - The folded nits are in the triage table, 4.9.
3. **No regression.** Section 3 binds every lane. Each lane's pinning tests are in section 6, and its risks are in section 12.

### 0.1 Facts in the prompt or the nit list that the code contradicts

I re-measured each fact at `37e7f7f`.

**1. #348 N3** (`queued-share-readable.md`) asks that `decodeReadable`'s `var meaning = ["5", scale];` become `String(VERSION)`. That would be a defect, not a fix.

- **What the literal is.** `decodeReadable` reads the v5 format. The `"5"` is the version of the link being read, not the version this build writes.
- **What would break.** The check is computed over `meaning`. Tying it to `VERSION` would change every existing v5 link's check the day `VERSION` becomes 6, and every v5 link would then be refused.
- **Why the encoder differs.** `encode` correctly uses `String(VERSION)` (`grep -n 'String(VERSION)\|var meaning = \["5"' src/engine/share.js` prints 332, 333 and 440). The encoder writes the current version; the v5 reader must keep reading 5.
- **Outcome.** CLOSED (4.9).

**2. #344 "stale v1-4 doc comment in share.js" and "unused `before`".** Both are already fixed by #348.

- `sed -n 1,30p src/engine/share.js | grep -n -i 'v[1-5]'` shows only "WIRE FORMAT, v5 (what this build WRITES)".
- The SV v4-link e2e test has no `before` binding (`sed -n 13200,13235p tests/e2e.test.js | grep -n before` prints nothing).

**3. Prompt facts confirmed:**

- The corpus holds 1086 patches (`ls tests/mutants/*.patch | wc -l`).
- README says 1086 (`grep -n 'mutant patches' README.md`, line 163).
- The scope `7ef7fda..37e7f7f` holds 132 non-merge commits and 40 merge commits (`git rev-list --count --no-merges 7ef7fda..37e7f7f`; `git rev-list --count --merges 7ef7fda..37e7f7f`).
- Main's `validate` run at `37e7f7f`, 39053087557, concluded success.
- Coverage run 39053255194 was still `in_progress` when this plan was written (`gh run view 39053255194 --json status,conclusion`). See section 13.

**4. Stale repo docs that the triage folds.** These are CLAUDE.md and README claims that the code or the tests contradict. Each is a row in 4.9 and a step of lane `docs`:

1. #348 N1. CLAUDE.md "Changing the measurement id" says the GA mutant "goes stale without a test failing". In fact it still applies and survives.
2. Sheet guidance Q1. CLAUDE.md says "(d) alone with a long deck name" is asserted by the N-A6 delete test. That test covers only (d) beside a notice.
3. Sheet guidance Q3. "The delete refusal and every error never yield (no test ...)". The N-A6 delete test does assert "X3: a refusal yielded to the notice".
4. Sheet guidance Q4. "(no test; see `ELEMENT_IDS`)". App test "SG: N-A3 no served id is removed and the wrapper is markup-only" asserts it.
5. Cleanup nit. "The N-A7 test" is ambiguous: two e2e tests are titled "SG: N-A7 ...".
6. Cleanup nit. "Every CSS `#id` rule" overstates the exclusion. Only lines that begin with `#` are excluded.
7. Cleanup nit. README's "App vs print agreement" bullet cites `test_highlighting_agrees` alone, for four compared properties that four tests check.

## 1. Goal

Close two gaps in the `hashchange` deck-route path, so that a regression in either is caught:

- the `deck_route` event that `routeToDeck` sends;
- `routeToDeck`'s "replacement outranks a hidden seed" clause.

**Done means:**

- Two new tests in `tests/app.test.js` are green at `37e7f7f`. Each is RED under its own committed mutant.
- The folded nits land in their lanes.
- After the last merge, README's mutant count and every FLOORS row equal main's CI artifacts.
- Every lane keeps the six regression-evidence steps of section 3 green.

## 2. Non-goals

**Scope and architecture:**

- No feature work.
- Nothing from CLAUDE.md's "Ideas, NOT committed roadmap" list is planned. This plan does not name those ideas.
- No change to deck data (`data/decks.json`, the `const DECKS` line), diagram geometry, palettes, fonts or card anatomy.
- No change to the single-file architecture: no `<script src>`, no build step, no new sync step. Nothing is edited by hand inside an engine region or the `DECKS` line.
- The full-deck PDF path in `hifi.build` is not removed. It is kept by decision.
- No deploy, and no change to CI's required checks.

**Excluded work streams:**

- **Scale import (excluded by the coordinator).** On hold since 2026-10-17. No lane touches:
  - `src/engine/importer.js`, `tests/import.test.js`, `tests/fixtures/import_cases_v1.json`;
  - any `IM:` test;
  - any mutant whose `# kills:` names an import test;
  - the `#import-row` markup or its handlers.

  The import nits (#338, #339, #342, #343, #346) are not triaged. Its churn (P6-7) is reported, not planned.
- **DEV environment (excluded by the coordinator).** PR #349 and `docs/plans/2026-10-17-dev-env.md`. No lane touches `.github/workflows/validate.yml`, `tools/ci_scope.py` or `tests/test_ci_scope.py`.

**What the lanes may touch:**

- No production-code edit. No lane commits a change to `index.html`, `src/engine/*.js`, `tools/*.py` or `tools/*.js`. Mutant creation edits the working tree temporarily and restores it before the commit.
- No rendered-layout change at 380 px. No CSS or markup diff.
- No rename of any test. No deletion of any test. No FLOORS row is lowered.

**Left for later:**

- Nothing classed DEFER, DROP or owner-gated in sections 5, 10 and 11 is done in this pass.
- No nit marked CLOSE in 4.9 is done in this pass.

## 3. Regression evidence (binding on every lane, in this order)

Copied from pass 5; binding:

1. **Byte-identical generated outputs.**
   - `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` are green.
   - `data/decks.json` is untouched.
   - The three committed `*_CHORD_ONLY_Letter.pdf` are unchanged by extracted text (`tests/test_pdf_build.py`, `test_committed_pdfs_match_a_fresh_build`).
   - Every committed fixture under `tests/fixtures/` is unchanged, unless the lane's goal is that fixture's generator. In that case the fixture is regenerated in the same commit, with the diff shown empty or explained.
2. `tests/test_render_agreement.py` is green over all 177 cards.
3. **Pinning tests.** The pinning tests named in the lane are green on `main` before the change and on the head after. Every new test is shown RED against a deliberate break committed as a mutant patch in `tests/mutants/` whose `# kills:` names it. This is `tests/CONTRACT.md` rule 3: every test group needs a killing mutant. So the corpus rises by at least one per new test group.
4. **Mutation gate.**
   - The gate is green at the head SHA.
   - The corpus count does not fall.
   - A mutant whose target code is removed is re-pointed or replaced one-for-one in the same commit.
   - `python3 tools/refresh_mutants.py --check` is green.
5. **Suite health.** `tests/suite_health.py` is green at the lane's head. A lane lowers only its own test files' FLOORS rows, by exactly the count it removed as DUPLICATE or TAUTOLOGY, with each removal listed. Only the reconcile lane raises rows.
6. **CI.** CI's `validate` run at the PR's head SHA concluded success. A local green is a smoke test only.

**Rules on tests:**

- No lane deletes a test, unless its candidate row classes it DUPLICATE (citing the surviving twin) or TAUTOLOGY (citing the STRONG test that replaces it). Every mutant whose `# kills:` names a deleted test is re-pointed in the same commit (`grep -l '<title>' tests/mutants/*`).
- No lane renames a test.
- No REFACTOR, HARNESS or DOCS lane edits the body of an existing test; it may only add tests.
- A TEST-STRENGTHEN, TEST-DEDUP, TEST-SPEED or TEST-FLAKE lane changes an existing assertion only to make it stricter or equivalent.
  - Stricter is shown by a committed mutant that the old assertion survives and the new one kills.
  - Equivalent is shown by every mutant that names that test still being killed at the head SHA.
- No lane edits inside an engine region or the `DECKS` line by hand.
- No lane changes rendered layout at 380 px.

## 4. Measurement appendix

All commands were run from `/Users/ray/Projects/handpan-cards/.claude/worktrees/agent-a5647bf3a73b442ea` against `37e7f7f`. A script under `$S` is named with its arguments.

### 4.1 Churn (step 1)

**The window.**
- Base: `be4b3c8`, the 60th non-merge commit at `37e7f7f` that touches `index.html`, `src`, `tools` or `tests` (`git log -60 --no-merges --format=%h -- index.html src tools tests | tail -1`).
- The window's hashes are saved to `$S/p6win.txt` (`git log -60 --no-merges --format=%h -- index.html src tools tests > $S/p6win.txt`).

**File churn.** Command: `git log -60 --no-merges --format= --name-only -- index.html src tools tests | grep -v '^tests/mutants/' | grep -v '^$' | sort | uniq -c | sort -rn | head -14`.

| count | file | hotspot? |
|---|---|---|
| 23 | `index.html` | function counts only, below |
| 18 | `tests/e2e.test.js` | never by own churn |
| 17 | `tests/app.test.js` | never by own churn |
| 13 | `tests/suite_health.py` | FLOORS-row commits do not count (pass-5 rule) |
| 7 | `src/engine/importer.js` | yes, but excluded (P6-7) |
| 7 | `tests/import.test.js` | excluded |
| 7 | `tests/fixtures/import_cases_v1.json` | excluded |
| 6 | `tools/sandbox.js` | yes (P6-2) |
| 5 | `tests/harness.test.js` | yes; subject is `tools/sandbox.js` |
| 4 | `tests/share.test.js` | no |
| 3 | `tests/helpers/cdp.js` | no |
| 3 | `src/engine/share.js` | no |
| 2 | `tools/probe/panel_fit.js` | no |
| 1 | `tools/inline_engine.py` | no |

**`index.html` app-block function churn.** Command: `$S/p6churn.sh index.html '' $S/p6win.txt be4b3c8 $S/appnames.txt > $S/p6appchurn.tsv`. The script runs the pass-5 `git log -L` count for each name in the list and keeps only window commits.

- Highest: `syncRoute` 3, `panelStops` 3, `selectDeck` 2, `openShare` 2, `copyLink` 2.
- `routeToDeck` is 1.
- No named function reaches 5.

**Top-level listeners.** These are anonymous arrow functions, which the name list cannot reach. Command: `python3 $S/p6listen.py $S/p6win.txt be4b3c8 > $S/p6listen.tsv`. It runs `git log -L <line>,/^}/:index.html` from each `X.addEventListener("<type>"` line in the app block.

| count | listener |
|---|---|
| **6** | `window.addEventListener("hashchange"` |
| 2 | `sheet.addEventListener("keydown"` |
| 2 | `window.addEventListener("popstate"` |
| 1 | `shareUrl.addEventListener("keydown"` |

**The `hashchange` listener is the only `index.html` hotspot.** Its six window commits (`git log --no-merges --format='%h %s' -L '/^window.addEventListener("hashchange"/,/^});/:index.html' be4b3c8^..37e7f7f`, saved to `$S/p6hc.txt`):

- `7ca96e3`, which creates it;
- `54c7f01`;
- `faafcc0`;
- `bb193b3`;
- `a3a074a`;
- `4279088`.

Each is a feature change: deck route, About guard, share URL, share v5 same-deck short circuit.

### 4.2 Size (step 2)

`wc -l index.html tests/e2e.test.js tests/app.test.js src/engine/share.js tools/sandbox.js`:

| file | lines |
|---|---|
| `index.html` | 12439 |
| `tests/e2e.test.js` | 13258 |
| `tests/app.test.js` | 10845 |
| `src/engine/share.js` | 602 |
| `tools/sandbox.js` | 715 |

No function in scope was found long enough to matter by itself. No size-only candidate is DO under the rule, so the pass-5 longest-function table is not repeated.

### 4.3 Duplication (step 3)

1. **The `hashchange` listener and boot hold the same "gone" predicate.**
   - The predicate is `routed !== shown && !(replacements()[routed] && replacements()[routed].id === shown) && hidden.includes(routed)`.
   - It sits in `routeToDeck` and inline in the boot (`grep -n 'hidden.includes(routed)' index.html`).
   - Commit `54c7f01` ("Keep the boot's gone-warning inline so other lanes' mutants stay anchored") reverted an extracted `warnIfDeckGone` on purpose. See P6-8.
2. **FNV-1a is written twice.** `fnv1a` in `src/engine/share.js` feeds both `checksum` and `checkHex`, and `fnv1a32` sits in `src/engine/core.js` (`grep -n 'function fnv1a' src/engine/*.js`). The within-module split that the #344 nit named is already one function. The cross-module copy is P6-6.
3. **`tools/sandbox.js` `ELEMENT_IDS` is a hand list of served ids.**
   - It changed in 4 window commits: `093a476`, `2149be5` (import), `a3a074a` and `faafcc0` (`git log --no-merges --format=%h -L '/^const ELEMENT_IDS/,/\];/:tools/sandbox.js' be4b3c8^..37e7f7f | grep -cFf $S/p6win.txt` style count).
   - See P6-2.

### 4.4 Coverage (step 4)

Not measured. Run 39053255194 was `in_progress` when this plan was written. See section 13. No candidate depends on it.

### 4.5 Test cost and stability (step 5)

**Wall time, main.**
- Run 39053087557 at `37e7f7f` took 658 s, from 17:17:18 to 17:28:16 (`gh run view 39053087557 --json jobs -q '.jobs[]|[.name,.startedAt,.completedAt]|@tsv'`).
- Its slowest jobs:

  | job | time |
  |---|---|
  | shard 3 | 648 s |
  | shard 4 | 581 s |
  | shard 1 | 513 s |
  | `js suites` | 439 s |
  | shard 2 | 436 s |
- Shard 3 finished 67 s after shard 4.
- The median of the last 8 successful main runs is 658 s, with a range of 584 to 712 s. Command: `gh run list --workflow validate.yml --branch main --status success --limit 8 --json databaseId -q '.[].databaseId'`, then `$S/p6ci.sh <ids>`, which prints each run's wall time and its shard and js job times.
- The slowest job alternates between shard 3 and `js suites` across those runs.

**Fixed waits.**
- `grep -rn -E 'sleep|setTimeout|waitElapsed' tests --include='*.js' --include='*.py' --include='*.sh' | grep -v mutants | wc -l` gives 98 hits.
- JS literal waits: 45 of them, summing to 67729 ms.
  - 60000 ms of that is the `tests/harness.test.js` hang fixture, which the test's timeout cuts short.
  - The rest sum to 7.7 s.
- Python sleeps sum to 200.65 s.
  - The two `sleep 100` in `tests/test_suite_health.py` are background processes that the test kills.
  - About 0.65 s is real.
- No wait reaches 30 s on the critical path.
- The SV v4-link e2e test, "SV: a v4 link opens, the bar ends on v5, and Back leaves the page", holds a 500 ms and a 300 ms wait (`sed -n 13200,13235p tests/e2e.test.js | grep -n setTimeout`). See P6-5.

**Flakes.**
- Command: `bash $S/p6flake.sh > $S/p6flake.txt`, which runs `gh run list --workflow validate.yml -L 60 --json databaseId,attempt,conclusion,headBranch,headSha`.
- The 60 runs:
  - None has `attempt` greater than 1.
  - 10 failed. All but one were on lane branches.
- The one main failure is run 39019567720, at `ffedc62`.
  - It was a mutation shard 2 "BASELINE NOT GREEN" on `co_swipe_wheel_rest_dropped.patch`.
  - The baseline e2e test "card swipe (wheel): under reduced motion a sub-threshold wheel gesture rests the card after the gap" failed on clean code.
  - The push run at the same SHA, 39019567606, succeeded.
- So there is one flake in 60 runs. See P6-4.

### 4.6 Test strength (step 6)

**The sample.** 62 tests (`python3 $S/p6strength.py > $S/p6strength.txt`):

- app tests matching `hashchange|^SU:|^SV:|^AO: (...)|deck link|routed boot|route beats|slug`;
- harness tests matching `sandbox|boot `.

Each row prints the number of corpus mutants whose `# kills:` names it.

**Classification:**

- **Named by a mutant: 36.** These are STRONG, because the gate kills those mutants at `37e7f7f`. The exception is the W1 test below, which is named by a mutant and still WEAK against W1.
- **Named by none: 26.** 25 of them are STRONG by stated reasoning: each asserts the routed deck id, the bar's hash or the history calls by value.
  - One of the 25 was shown STRONG by a break. In `tools/sandbox.js`, dropping `&& !opts.force` from the hashchange-dispatch guard fails both "the sandbox hashchange fires only on a real change and carries oldURL and newURL" and "AO: a fragment navigation while About is open closes About and leaves the destination hash for hashchange".
  - The 26th is W2.
- **Totals:** 60 STRONG, 2 WEAK, 0 TAUTOLOGY, 0 DUPLICATE.

**WEAK W1.**
- Test: "hashchange to a deck link selects that deck and clears the hash". Subject: the `hashchange` listener, through `routeToDeck`.
- Break (scratch worktree `git worktree add --detach $S/weak 37e7f7f`, edited with `sed -i ''`):

```
 function routeToDeck(routed) {
   ...
-  track("deck_route", { deck_id: routed });
+
   return shown;
```

- Result: `node --test tests/app.test.js` in `$S/weak` gave 618 pass, 0 fail.
- So the event that the listener (and `aboutLink`) sends is unpinned. The boot path's own `track("deck_route", ...)` keeps "a routed boot queues config before deck_route" green.

**WEAK W2.**
- Test: "hashchange resolves an edited seed to its replacement and a deleted seed to a warning". Same subject.
- Break:

```
-  if (routed !== shown && !(replacements()[routed] && replacements()[routed].id === shown) && hidden.includes(routed))
+  if (routed !== shown && hidden.includes(routed))
```

- Result: `node --test tests/app.test.js` in `$S/weak` gave 618 pass, 0 fail.
- The state this clause guards is a seed that is both hidden and replaced. It is real: it is pinned at boot by "SD: a replacement outranks a hidden seed in storage". On `hashchange` it is unpinned.

`$S/weak` was restored with `cp` from this worktree after each break, and removed (`git worktree remove --force $S/weak`).

**O4 kill check (pass-5 nit O4).**
- The break, in `$S/weak`: in `src/engine/voicing.js` `byMidiDescending`, `if (a.top !== b.top) return a.top ? -1 : 1;` becomes `return a.top ? 1 : -1;`.
- `node --test tests/sequence.test.js` then fails "INTERMEDIATE deals a register-labelled anchor". That test passes on clean code.
- No corpus mutant flips this tie-break (`grep -l 'a.top ?' tests/mutants/*` lists none that changes this line).

### 4.7 Mutation-corpus drag (step 7)

- **Re-anchor commits.** `bash $S/p6drag2.sh > $S/p6prcommits.tsv`, which runs the pass-5 per-PR commit listing over the last 20 merged PRs, #329 to #348. Then `grep -icE 'refresh|context-stale|re-anchor' $S/p6prcommits.tsv` gives 0 such commits.
- **Modified mutants per merge.** `bash $S/p6drag.sh > $S/p6drag.txt` runs `git diff --diff-filter=M --name-only <merge>^1 <merge> -- tests/mutants` over the last 20 first-parent merges. Then `awk '{print $2}' $S/p6drag.txt | sort | uniq -c | sort -rn | head -3` gives a maximum of 2 per mutant:
  - `uid_panelstops_misses_tier`
  - `su_hashchange_no_guard`
  - `su_hashchange_ignores_sheet_open`
- No mutant reaches 3 of 20.

### 4.8 CI artifacts at `37e7f7f`

FLOORS at `37e7f7f` (`python3 -c "import sys; sys.path.insert(0,'tests'); import suite_health as s; print(sum(v for k,v in s.FLOORS.items() if k.endswith('.js')), sum(v for k,v in s.FLOORS.items() if k.endswith('.py')), len(s.FLOORS))"`):

| | value |
|---|---|
| js sum | 1663 |
| py sum | 255 |
| rows | 39 |
| `tests/app.test.js` row | 618, set from CI run 39050876932 by `bfe2144` |

The reconcile lane reads its own base's run, not this one.

### 4.9 Nit triage

Memory files are under `/Users/ray/.claude/projects/-Users-ray-Projects-handpan-cards/memory/`. "Done by #348" is checked against that PR's 9 `sn_*` mutants (`ls tests/mutants | grep '^sn_'`) and its added tests (`git diff 37e7f7f^1 37e7f7f -- tests/app.test.js tests/e2e.test.js | grep '^+.*test('`).

**`queued-share-readable.md`**

| label | state at `37e7f7f` (command) | outcome |
|---|---|---|
| #344 `charAt(1) !== "/"` guard untested | Pinned (`ls tests/mutants/sn_share_v5_slash_guard_dropped.patch`) | CLOSE, done by #348 |
| #344 encode hard-codes "5" | `encode` uses `String(VERSION)` (`grep -n 'String(VERSION)' src/engine/share.js`: 332, 333) | CLOSE, done by #348 |
| #344 checksum split fnv1a + checksum | Already one `fnv1a` feeding `checksum` and `checkHex` (`grep -n 'function fnv1a\|function checksum\|function checkHex' src/engine/share.js`) | CLOSE; the cross-module copy is P6-6, DEFER |
| #344 percentDecode rejects lowercase hex | Still true: changing it changes which links open | OWNER-GATED, G-1 |
| #344 stale v1-4 doc comment | Fixed (0.1 item 2) | CLOSE, done by #348 |
| #344 empty scale is BAD_NOTE, not NO_DING | Still true: a refusal code a user sees | OWNER-GATED, G-2 |
| #344 e2e fixed 500 ms wait | Still there, plus a 300 ms wait (4.5) | CLOSE as a nit; P6-5, DEFER |
| #344 unused `before` | Gone (0.1 item 2) | CLOSE, done by #348 |
| #344 verify pattern misses the retitled record-version test | A lane-brief artifact of a merged PR | CLOSE, history |
| #345 nits 1 to 6 | Pinned by #348's `sn_share_icon_order_dropped_e2e`, `sn_copy_announce_sync`, `sn_create_sheet_keeps_share_url` and `sn_edit_sheet_keeps_share_url`, and by the tests "SI: when #share-copy becomes disabled while focused ...", "SI: while About is open #share-copy has an inert ancestor ..." and "SI: at 844x390 #share-copy sits right of the deck strip ..." | CLOSE, done by #348 |
| #345 nit 7, the revealed field covers the top of the card | Accepted at review; any change is a pixel change | CLOSE; reopening needs the owner |
| #347 nits | #348's body names #347 among the nits it closes (`gh pr view 348 --json body`) | CLOSE, done by #348 |
| #348 N1, CLAUDE.md "goes stale" | Still true (`grep -n 'goes stale without' CLAUDE.md`). The mutant still applies, and its added line refuses only the old id, so it survives (`cat tests/mutants/dg_loader_refuses_shipped_id.patch`) | **FOLD, lane `docs` step 1** |
| #348 N2, the AO resize test TypeErrors under its mutant | Still true: `app.get("window.__w.resize.length")` is undefined `.length` when no listener exists (`grep -n 'window.__w.resize' tests/app.test.js`; `head -12 tests/mutants/sn_about_resize_listener_dropped.patch`) | **FOLD, lane `tests` step 4** |
| #348 N3, `["5", scale]` to `String(VERSION)` | Contradicted (0.1 item 1) | CLOSE |
| #348 N4, the #348 PR body | PR history | CLOSE |

**`queued-about-off-main.md`**

| label | state | outcome |
|---|---|---|
| #340 N1 to N4 | #348 tests "AO: a #deck= link to a replaced seed whose replacement is the shown deck ...", "AO: a dispatched resize ..." and "AO: a click on a deck link inside About is default-prevented ...", with `sn_about_*` mutants | CLOSE, done by #348 |
| #341 plain-text versus backticked e2e path, long lines | Prose taste | CLOSE, aesthetic |
| G7, no email in the JSON-LD | `ls tests/mutants/sn_ldjson_carries_email.patch` | CLOSE, done by #348 |

**`queued-discoverability.md`**

| label | state | outcome |
|---|---|---|
| Coord rows 6 to 48 | Resolved by #326 | CLOSE |
| Rows 49 to 51 | Merged in #333 | CLOSE |
| #333 nits | Resolved by #348 | CLOSE |
| Row 37, GA DebugView check | An owner action in GA Admin, with no code | CLOSE; the owner's own action |

**`queued-sheet-guidance.md`** (the owner said "Leave unscheduled" on 2026-10-14)

| label | state | outcome |
|---|---|---|
| Q1, CLAUDE.md says (d) "alone with a long deck name" is asserted by the N-A6 delete test | False. That test (`grep -n 'SG: N-A6 the delete refusal' tests/e2e.test.js`) arms DELETE beside a notice. `grep -n 'long deck name' tests/e2e.test.js` finds nothing in the SG tests | **FOLD, lane `docs` step 2** (decision D3) |
| Q2, Q5, Q6 | Plan and brief history files | CLOSE, history |
| Q3, "the delete refusal ... never yield (no test ...)" | False. The N-A6 delete test asserts "X3: a refusal yielded to the notice" (`grep -n 'X3: a refusal yielded' tests/e2e.test.js`) | **FOLD, lane `docs` step 3** (D3) |
| Q4, "`noticed` ... (no test; see `ELEMENT_IDS`)" | False. "SG: N-A3 no served id is removed and the wrapper is markup-only" asserts `!ELEMENT_IDS.includes("scale-guidance")` (`grep -n 'N-A3 no served id' tests/app.test.js`) | **FOLD, lane `docs` step 4** (D3) |
| Q7, wrapping at 360 px | Owner decision: leave | CLOSE; listed in section 13 |
| Q8, TODOS section, mutants and markup comment | Done by Cleanup lane `edd2f20`: `ls tests/mutants/cl_edit_warning_not_marked_pan.patch tests/mutants/cl_name_refusal_warning_not_marked_pan.patch` | CLOSE, done |

**`queued-remove-degrees-dropdown.md`** (the owner said "Leave unscheduled" on 2026-10-14)

| label | state | outcome |
|---|---|---|
| Q1 to Q5 | Plan and brief history | CLOSE, history |
| Q6, RD-T4 mints the link at runtime | Owner: leave | CLOSE (section 11) |
| Q7, RD-T2 `== null` | Owner: leave | CLOSE (section 11) |
| Q8, the screenshot | Review artifact | CLOSE |
| Q9 | Cosmetic | CLOSE, aesthetic |

**`queued-refactor-pass-5.md`**

| label | state | outcome |
|---|---|---|
| O1, docstring | Prose | CLOSE, aesthetic |
| O2 | The mutation gate already covers it | CLOSE |
| O3 | The oracle ignores subtitles by design | CLOSE |
| O4, the `byMidiDescending` top-shell tie-break has no mutant | Still true, with a killing test found (4.6) | **FOLD, lane `tests` step 5** |
| O5, the README count | Fixed (README says 1086) | CLOSE |
| G-1 N1, `.66` and `0.640` pass | CLAUDE.md already says so (`grep -n '0.640' CLAUDE.md`) | CLOSE, done |
| G-1 N2, line length | Prose | CLOSE, aesthetic |
| G-1 N3, the "third copy" docstring in `tests/test_render_agreement.py` | Prose | CLOSE, aesthetic |
| G-1 N4, README "share no code" | README says "share no code" (`grep -n 'share no code' README.md`) | CLOSE, done |
| Cleanup: the "every CSS `#id` rule" overstatement | Still true (`grep -n 'every CSS `#id` rule' CLAUDE.md`) | **FOLD, lane `docs` step 6** |
| Cleanup: README's agreement bullet cites one test for four properties | Still true (`grep -n 'test_highlighting_agrees' README.md`; `grep -n 'def test_tonefield_positions_agree\|def test_drawn_note_line_agrees\|def test_drawn_bottom_note_badge_agrees' tests/test_render_agreement.py`) | **FOLD, lane `docs` step 7** |
| Cleanup: "the N-A7 test" is ambiguous | Still true: two titles start "SG: N-A7" (`grep -n 'test("SG: N-A7' tests/e2e.test.js`). The anchor tap is in "SG: N-A7 the crowded 24-note pan ..." (`grep -n 'scale-anchor-one' tests/e2e.test.js`) | **FOLD, lane `docs` step 5** |
| Cleanup: the N-A7 title itself | A rename orphans `# kills:` | CLOSE, no renames |
| Cleanup: `e_sheet_ctlrow_pinned_again.patch` "Re-anchored 2026-10-14" comment | A history comment | CLOSE, history |
| Cleanup: drawer spec line 117 | A history file | CLOSE, history |

**Totals:**
- FOLD: 13. That is 3 in `tests` (#348 N2, O4, and P6-1's two tests carrying W1 and W2) and 10 doc edits in `docs`. `docs` holds seven steps; step 1 closes N1, and steps 2 to 7 close Q1, Q3, Q4 and the three cleanup nits.
- OWNER-GATED: 2.
- All other rows: CLOSE.

## 5. Candidate table

Fields per row: class / target / measured cost (command) / change / risk / pinning test / verdict (reason).

### DO

**P6-1**
- **Class:** TEST-STRENGTHEN.
- **Target:** `routeToDeck` in the `index.html` app block, as called from the `window.addEventListener("hashchange"` listener.
- **Measured cost:** two WEAK tests on the only `index.html` hotspot, the `hashchange` listener at 6 of 60 (4.1). Breaks W1 and W2 each leave all 618 app tests green (4.6).
- **Change:** add two tests written first, each green on `main`, with one committed mutant each:
  - "hashchange to a deck link tracks deck_route with the routed id"
  - "hashchange to a hidden seed that has a replacement shows the replacement with no gone warning"
- **Risk:** low. It is test-only and adds tests. The sandbox's GA queue is reached through the existing `withGaId` helper.
- **Pinning test:**
  - Existing, green on main: "hashchange to a deck link selects that deck and clears the hash", "hashchange resolves an edited seed to its replacement and a deleted seed to a warning", "a routed boot queues config before deck_route", "SD: a replacement outranks a hidden seed in storage".
  - New: the two titles above.
- **Verdict:** DO. The cost is a WEAK test on a churn hotspot, shown by a one-hunk patch. It has a pin and no owner gate.

### DEFER

**P6-2**
- **Class:** HARNESS.
- **Target:** `ELEMENT_IDS` in `tools/sandbox.js`.
- **Measured cost:** the file is at 6 of 60 (4.1), but `ELEMENT_IDS` itself changed in 4 of 60 (4.3), and one of those, `2149be5`, is excluded import work.
- **Change:** derive the list from the served `id="..."` attributes.
- **Risk:** medium. "SG: N-A3 no served id is removed and the wrapper is markup-only" asserts that the list deliberately lacks `scale-guidance`, so a derived list changes a pinned harness fact.
- **Pinning test:** that N-A3 test, and the SB-2 lookup test in `tests/harness.test.js`.
- **Verdict:** DEFER. The changing subject is below the bar, and it conflicts with a pinned fact.

**P6-3**
- **Class:** TEST-SPEED.
- **Target:** the `tests/shard_mutants.js` split.
- **Measured cost:** shard 3 ended 67 s after shard 4 in run 39053087557. The slowest job alternates between shard 3 and `js suites` (4.5).
- **Change:** split the shards by time.
- **Risk:** medium.
- **Pinning test:** "N=4 shard partition" in `tests/mutation_harness.test.js`.
- **Verdict:** DEFER. It is not a fixed wait, which is the pass-5 TEST-SPEED rule.

**P6-4**
- **Class:** TEST-FLAKE.
- **Target:** e2e "card swipe (wheel): under reduced motion a sub-threshold wheel gesture rests the card after the gap".
- **Measured cost:** 1 baseline failure in 60 runs (run 39019567720, 4.5).
- **Change:** investigate the timing bound.
- **Risk:** medium. A `waitElapsed` bound is a timing assertion and needs a differential probe.
- **Pinning test:** the test itself, with `co_swipe_wheel_rest_dropped.patch`.
- **Verdict:** DEFER. There is one occurrence, with no rerun evidence at the same attempt.

**P6-5**
- **Class:** TEST-SPEED.
- **Target:** e2e "SV: a v4 link opens, the bar ends on v5, and Back leaves the page".
- **Measured cost:** fixed waits of 500 ms and 300 ms, 0.8 s in all (4.5).
- **Change:** replace them with event waits.
- **Risk:** low.
- **Pinning test:** the test itself.
- **Verdict:** DEFER. It is below the 30 s bar.

**P6-6**
- **Class:** REFACTOR.
- **Target:** `fnv1a` in `src/engine/share.js` and `fnv1a32` in `src/engine/core.js`.
- **Measured cost:** two copies of about 8 lines (4.3). `share.js` is at 3 of 60 and `core.js` below that.
- **Change:** export one copy from `core.js`.
- **Risk:** medium. It would change a share-check input path and the inlined engine regions.
- **Pinning test:** the "SV: the five built-in decks' v5 links are pinned" test in `tests/share.test.js`.
- **Verdict:** DEFER. It is below every bar.

**P6-7**
- **Class:** REFACTOR or TEST-STRENGTHEN.
- **Target:** `src/engine/importer.js` and `tests/import.test.js`.
- **Measured cost:** 7 of 60 each (4.1).
- **Change:** none planned.
- **Risk:** not assessed.
- **Pinning test:** the import suite.
- **Verdict:** DEFER. It is excluded by the coordinator (section 2): the workstream is on hold.

**P6-10**
- **Class:** HARNESS.
- **Target:** `su_hashchange_no_guard`, `su_hashchange_ignores_sheet_open` and `uid_panelstops_misses_tier`.
- **Measured cost:** each was modified by 2 of the last 20 merges (4.7).
- **Change:** use stabler anchors.
- **Risk:** low.
- **Pinning test:** the tests each one names.
- **Verdict:** DEFER. 2 is under the 3-of-20 bar.

### DROP

**P6-8**
- **Class:** REFACTOR.
- **Target:** the "gone" predicate, duplicated in `routeToDeck` and the boot (4.3).
- **Measured cost:** one duplicated line.
- **Change:** extract a helper.
- **Risk:** it re-breaks the mutant anchors that `54c7f01` protected.
- **Pinning test:** "a deleted seed falls back to the default deck and says the deck is gone".
- **Verdict:** DROP. `54c7f01` reverted exactly this extraction by decision, and no input to that decision has changed.

**P6-9**
- **Class:** REFACTOR.
- **Target:** the body of the `hashchange` listener.
- **Measured cost:** churn 6 of 60 (4.1). All six commits added behaviour: the route, the About guard, share v5.
- **Change:** none found. No restructuring would have absorbed any of the six, because each added a branch the feature needed.
- **Risk:** high. Eight `su_hashchange_*` and `sv_*` mutants anchor here.
- **Pinning test:** the deck-route, SU and SV hashchange tests.
- **Verdict:** DROP. There is no shape that reduces the measured cost. The test gap on this hotspot is taken by P6-1 instead.

### Owner-gated

These are G-1 and G-2 in section 10, from the #344 nits.

## 6. Lanes

There are three lanes: `tests` and `docs` in wave 1, and `reconcile` in wave 2. Every lane works in its own worktree off `main` (`git worktree add -b claude/refactor-6-<lane> .claude/worktrees/refactor-6-<lane> origin/main`), writes tests first, and runs suites with absolute paths. In every verify below, `S` is a fresh `mktemp -d` set once per shell.

**Pitfalls every lane carries:**

- Never rename or delete a test.
- Mutant patches carry no `index` line.
- `# suite:` headers are word-split, so use `.` wildcards, not quotes.
- Never edit the tree while `tests/mutation_check.sh` runs. Push and let CI's mutation gate decide.
- Never `pgrep -f`.
- Prefix every local browser run with `CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`, and grep its output for `skipped: no Chromium binary found`. A skipped run is never a green.
- Gate on `gh run list --commit <sha>` conclusions, and re-query `headRefOid` once after a push.
- Poll CI with `gh run watch` and return in the same turn.
- A lone shard survivor on an unrelated diff is rerun at the same SHA first.
- Cite test titles and function names, never line numbers.
- Acceptance criteria are facts about the lane's own diff.
- No lane touches the paths in section 2's exclusions.

### Lane `tests` (wave 1). Candidate P6-1, plus folded nits #348 N2 and pass-5 O4

- **Branch:** `claude/refactor-6-tests`.
- **Worktree:** `.claude/worktrees/refactor-6-tests`.
- **Goal:** the `hashchange` deck route's `deck_route` event and its replacement-outranks-hidden clause are each pinned by a new test, with a killing mutant. The AO resize test fails by assertion, not by TypeError, under its mutant. The `byMidiDescending` top-shell tie-break has a killing mutant.
- **Non-goals:**
  - No edit to any existing test body, except the one equivalent assertion in step 4.
  - No commit that changes `index.html`, `src/engine/*.js` or `tools/*`. Steps 3 and 5 edit those files only temporarily and restore them.
  - No FLOORS edit (decision D1).
  - No README edit (decision D2).
  - No import or DEV-env path.
- **Owned files:**
  - `tests/app.test.js`, which takes only the two new tests and the step-4 assertion;
  - `tests/mutants/p6_hashchange_deck_route_untracked.patch` (new);
  - `tests/mutants/p6_hashchange_gone_ignores_replacement.patch` (new);
  - `tests/mutants/p6_voicing_top_tie_break_flipped.patch` (new).

  No existing mutant is edited. `sn_about_resize_listener_dropped.patch` is not edited; it must still be killed.

**Steps:**

**Step 1. Test first, W1.**
- In `describe("discoverability: deck route"`, right after "a routed boot queues config before deck_route", add "hashchange to a deck link tracks deck_route with the routed id".
- Setup: `at("", { html: withGaId(REAL_ID), webdriver: false, storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A" }) } })`.
- Action: call `.hashchange("#deck=f-low-pygmy-18")`.
- Assertions:
  - the entries of `window.dataLayer` named `deck_route` that were added after the boot are exactly one;
  - that entry's params deep-equal `{ deck_id: "pygmy" }`.

This commit holds the test only.

- Acceptance: the new test is green against the unchanged `index.html`, and the file has 619 passing tests and none failing.
- Verify:

  ```
  node --test --test-name-pattern '^hashchange to a deck link tracks deck_route with the routed id$' tests/app.test.js > $S/t1.log 2>&1; grep -q '^# pass 1$' $S/t1.log && grep -q '^# fail 0$' $S/t1.log && node --test tests/app.test.js > $S/a1.log 2>&1; grep -q '^# pass 619$' $S/a1.log && grep -q '^# fail 0$' $S/a1.log
  ```

**Step 2. Test first, W2.**
- Add "hashchange to a hidden seed that has a replacement shows the replacement with no gone warning" next to step 1's test.
- Storage: `{ ...editedSeed("amara", "MY AMARA"), hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: ["amara"] }) }`. This is the state that "SD: a replacement outranks a hidden seed in storage" pins at boot.
- Action: `hashchange("#deck=d-amara-9")`.
- Assertions:
  - `deckId()` matches `/^custom:/`;
  - `location.hash` matches `/^#s=/`;
  - `announcer().textContent` does not match `/gone/`.

This commit holds the test only.

- Acceptance: green against the unchanged `index.html`, with 620 passing and none failing.
- Verify:

  ```
  node --test --test-name-pattern '^hashchange to a hidden seed that has a replacement' tests/app.test.js > $S/t2.log 2>&1; grep -q '^# pass 1$' $S/t2.log && grep -q '^# fail 0$' $S/t2.log && node --test tests/app.test.js > $S/a2.log 2>&1; grep -q '^# pass 620$' $S/a2.log && grep -q '^# fail 0$' $S/a2.log
  ```

**Step 3. The two killing mutants.**

The body of each mutant is the W1 or W2 hunk from 4.6. Make it like this:

1. Apply the break to `index.html` in the working tree. Find the line with `grep -n 'track("deck_route", { deck_id: routed });' index.html` or `grep -n 'hidden.includes(routed))' index.html` and choose the `routeToDeck` occurrence, never the boot's.
2. Run `git diff -- index.html > <patch>`.
3. Strip the `index` line.
4. Restore with `git checkout -- index.html`.

Headers:

| patch | `# kills:` | `# suite:` |
|---|---|---|
| `p6_hashchange_deck_route_untracked.patch` | `hashchange to a deck link tracks deck_route with the routed id` | `node --test --test-name-pattern ^hashchange.to.a.deck.link.tracks.deck_route tests/app.test.js` |
| `p6_hashchange_gone_ignores_replacement.patch` | `hashchange to a hidden seed that has a replacement shows the replacement with no gone warning` | `node --test --test-name-pattern ^hashchange.to.a.hidden.seed.that.has.a.replacement tests/app.test.js` |

A third `#` line in each says what the mutant breaks.

- Acceptance:
  - each patch applies cleanly;
  - its named test fails under it and passes after reverse-apply;
  - `index.html` equals `main` afterwards;
  - the harness lint passes.
- Verify (run once per patch, setting `P` and `T` to the patch path and its `# suite:` pattern):

  ```
  git apply --check $P && git apply $P && { node --test --test-name-pattern "$T" tests/app.test.js; rc=$?; git apply -R $P; test $rc -ne 0; } && git diff --quiet origin/main -- index.html && ! grep -q '^index ' $P && node --test --test-name-pattern 'no.mutant.patch|every.mutant.patch|FU-6|N=4.shard.partition' tests/mutation_harness.test.js
  ```

**Step 4. #348 N2, an equivalent assertion.**
- In "AO: a dispatched resize while About is open updates --about-head-h", change `app.get("window.__w.resize.length")` to `app.get("(window.__w.resize || []).length")`. Nothing else in that test changes.
- Acceptance:
  - the test is green;
  - under `sn_about_resize_listener_dropped.patch` it fails with the assertion message "no resize listener registered" and no `TypeError`;
  - the mutant is still killed. That is the "equivalent" proof of section 3.
- Verify:

  ```
  P=tests/mutants/sn_about_resize_listener_dropped.patch; node --test --test-name-pattern '^AO:.a.dispatched.resize.while' tests/app.test.js > $S/n2a.log 2>&1; grep -q '^# fail 0$' $S/n2a.log && git apply $P && { node --test --test-name-pattern '^AO:.a.dispatched.resize.while' tests/app.test.js > $S/n2b.log 2>&1; git apply -R $P; } && grep -q 'no resize listener registered' $S/n2b.log && ! grep -q TypeError $S/n2b.log && git diff --quiet origin/main -- index.html
  ```

**Step 5. Pass-5 O4, a mutant for the `byMidiDescending` top-shell tie-break.**
- Make `tests/mutants/p6_voicing_top_tie_break_flipped.patch` from the working-tree edit `return a.top ? -1 : 1;` to `return a.top ? 1 : -1;` inside `byMidiDescending` in `src/engine/voicing.js`. Find it with `grep -n 'return a.top ? -1 : 1;' src/engine/voicing.js`.
- Then run `git diff -- src/engine/voicing.js > <patch>`, strip the `index` line, and run `git checkout -- src/engine/voicing.js`.
- Headers:
  - `# kills: INTERMEDIATE deals a register-labelled anchor`
  - `# suite: node --test --test-name-pattern ^INTERMEDIATE.deals.a.register-labelled.anchor$ tests/sequence.test.js`
- The patch does not touch `index.html`. Engine-only mutants have precedent: 11 voicing mutants have no `index.html` hunk (`grep -l '+++ b/src/engine/voicing.js' tests/mutants/*`).
- Acceptance:
  - the named test fails under the patch and passes after reverse-apply;
  - `src/engine/voicing.js` equals `main`;
  - the lint passes.
- Verify:

  ```
  P=tests/mutants/p6_voicing_top_tie_break_flipped.patch; git apply --check $P && git apply $P && { node --test --test-name-pattern '^INTERMEDIATE.deals.a.register-labelled.anchor$' tests/sequence.test.js; rc=$?; git apply -R $P; test $rc -ne 0; } && git diff --quiet origin/main -- src/engine/voicing.js && node --test --test-name-pattern '^INTERMEDIATE.deals.a.register-labelled.anchor$' tests/sequence.test.js && ! grep -q '^index ' $P && node --test --test-name-pattern 'no.mutant.patch|every.mutant.patch|FU-6|N=4.shard.partition' tests/mutation_harness.test.js
  ```

**Step 6. Regression evidence, section 3 steps 1 to 4, as far as a local run shows them.**
- Acceptance: all green, and the diff lists only owned files. The kill of all three new mutants, and suite health, are read from CI in step 7.
- Verify:

  ```
  python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && git diff --quiet origin/main -- data index.html src tools tests/fixtures && python3 -m unittest tests.test_render_agreement tests.test_pdf_build && python3 tools/refresh_mutants.py --check && test "$(git diff --name-only origin/main...HEAD | sort | tr '\n' ' ')" = "tests/app.test.js tests/mutants/p6_hashchange_deck_route_untracked.patch tests/mutants/p6_hashchange_gone_ignores_replacement.patch tests/mutants/p6_voicing_top_tie_break_flipped.patch "
  ```

**Step 7. Push, open a PR, and treat CI as the oracle.**
- Acceptance: `validate` at the head SHA concluded success, and that SHA equals `headRefOid`.
- Verify: `sha=$(git rev-parse HEAD); gh run list --workflow validate.yml --commit $sha --json conclusion -q '.[0].conclusion'` prints `success`, and `gh pr view --json headRefOid -q .headRefOid` equals `$sha`.

**Deltas:**
- Mutants: +3, so the corpus goes from 1086 to 1089.
- FLOORS: no edit. The `tests/app.test.js` row stays at 618 while CI counts 620. Suite health accepts that because rows are minimums.
- README: no edit (D2).

### Lane `docs` (wave 1). Folded nits only (decision D3)

- **Branch:** `claude/refactor-6-docs`.
- **Worktree:** `.claude/worktrees/refactor-6-docs`.
- **Goal:** seven false or ambiguous claims in `CLAUDE.md` and `README.md` (0.1 item 4) are corrected. Each new sentence cites a test that exists at `37e7f7f`, or says "no test".
- **Non-goals:**
  - No other sentence changes.
  - No test, mutant, source or FLOORS edit.
  - No README mutant count edit; that belongs to reconcile.
  - No history file (`docs/plans/*`) edit.
- **Owned files:**
  - `CLAUDE.md`: only the "Changing the measurement id" bullet, the sheet-guidance pitfall bullet under "Known pitfalls", and the label-rule paragraph's comment-lines parenthesis;
  - `README.md`: only the "App vs print agreement" bullet.

**Steps.** Each step replaces one exact string with another. Old and new text are quoted exactly. Verify each step with `grep -qF '<new>' <file> && ! grep -qF '<old>' <file>`, using a distinctive fragment of each, as given.

**Step 1. #348 N1.**
- File: `CLAUDE.md`, "Changing the measurement id".
- Replace: `the mutant goes stale without a test failing and is caught only by the mutation gate (\`tests/mutation_check.sh\`).`
- With: `the mutant still applies, but its added line refuses only the old id, so the named test stays green under it and \`tests/mutation_check.sh\` reports it as survived ("did NOT fail").`
- Evidence:
  - `cat tests/mutants/dg_loader_refuses_shipped_id.patch` shows the added line spelling `G-QTYWB2HSSV`;
  - `grep -n 'did NOT fail' tests/mutation_check.sh` shows the survivor line.
- Acceptance: the old clause is gone and the new one is present.
- Verify: `grep -qF 'reports it as survived ("did NOT fail")' CLAUDE.md && ! grep -qF 'goes stale without a test failing' CLAUDE.md`

**Step 2. Sheet guidance Q1.**
- Replace: `and (d) by the test "SG: N-A6 the delete refusal then a re-armed DELETE: the slot keeps its height, the refusal stays up and the arming note shows beside DELETE".`
- With: `and (d) beside a notice by the test "SG: N-A6 the delete refusal then a re-armed DELETE: the slot keeps its height, the refusal stays up and the arming note shows beside DELETE"; (d) alone with a long deck name has no test.`
- Acceptance: the new text is present, once.
- Verify: `grep -qF '(d) alone with a long deck name has no test' CLAUDE.md && test "$(grep -cF 'and (d) by the test' CLAUDE.md)" -eq 0`

**Step 3. Sheet guidance Q3.**
- Replace: `the delete refusal and every error never yield (no test; true by the \`.warn.pan\` selector)`
- With: `the delete refusal never yields (the test "SG: N-A6 the delete refusal then a re-armed DELETE: the slot keeps its height, the refusal stays up and the arming note shows beside DELETE" asserts "X3: a refusal yielded to the notice" never fires), and no other error yields (no test; true by the \`.warn.pan\` selector)`
- Evidence: `grep -n 'X3: a refusal yielded' tests/e2e.test.js` lies inside that test.
- Acceptance: the new text is present and the old text is gone.
- Verify: `grep -qF 'the delete refusal never yields (the test' CLAUDE.md && ! grep -qF 'the delete refusal and every error never yield' CLAUDE.md`

**Step 4. Sheet guidance Q4.**
- Replace: `ELEMENT_IDS lacks the wrapper (no test; see \`ELEMENT_IDS\` in \`tools/sandbox.js\`).`
- With: `ELEMENT_IDS lacks the wrapper (test "SG: N-A3 no served id is removed and the wrapper is markup-only").`
- Acceptance: the new text is present and the old text is gone.
- Verify: `grep -qF 'lacks the wrapper (test "SG: N-A3 no served id is removed' CLAUDE.md && ! grep -qF 'lacks the wrapper (no test' CLAUDE.md`

**Step 5. The N-A7 ambiguity.**
- Replace: `pinned by the N-A7 test, which taps`
- With: `pinned by the test "SG: N-A7 the crowded 24-note pan: the real SMALL_LABELS warning (two lines) opens Edit, a tapped anchor raises the notice, the warning yields and the three-row seed box stays readable at every keyboard", which taps`
- Acceptance: the new text is present and the old text is gone.
- Verify: `grep -qF 'pinned by the test "SG: N-A7 the crowded 24-note pan' CLAUDE.md && ! grep -qF 'pinned by the N-A7 test' CLAUDE.md`

**Step 6. The CSS `#id` overstatement.**
- In the label-rule paragraph, replace `(comment lines, but also` together with the next line's `every CSS \`#id\` rule in \`index.html\`)`.
- With: `(comment lines, but also every line of \`index.html\` that begins with a CSS \`#id\` selector)`.
- The paragraph's other wrapping stays as it is. The claim is the test's own rule: `test_each_label_rule_number_is_written_once_per_language` skips lines whose first non-blank character is `#`.
- Acceptance: the new text is present and the old text is gone.
- Verify: `grep -qF 'begins with a CSS' CLAUDE.md && ! grep -qF 'every CSS `#id` rule' CLAUDE.md`

**Step 7. The README agreement bullet.**
- Replace: `(\`test_highlighting_agrees\`;`
- With: `(\`test_tonefield_positions_agree\`, \`test_highlighting_agrees\`, \`test_drawn_note_line_agrees\` and \`test_drawn_bottom_note_badge_agrees\`;`
- Line wrapping inside the bullet may change.
- Acceptance: all four names are in `README.md`, and the README currency suite is green.
- Verify: `for t in test_tonefield_positions_agree test_highlighting_agrees test_drawn_note_line_agrees test_drawn_bottom_note_badge_agrees; do grep -q "$t" README.md || exit 1; grep -q "def $t" tests/test_render_agreement.py || exit 1; done; python3 -m unittest tests.test_readme_currency`

**Step 8. Ownership and the claim check.**
- Acceptance:
  - the diff touches only `CLAUDE.md` and `README.md`;
  - every test title quoted in a new sentence exists verbatim in its test file.
- Verify:

  ```
  test "$(git diff --name-only origin/main...HEAD | sort | tr '\n' ' ')" = "CLAUDE.md README.md " && grep -qF 'test("SG: N-A3 no served id is removed and the wrapper is markup-only"' tests/app.test.js && grep -qF 'test("SG: N-A6 the delete refusal then a re-armed DELETE: the slot keeps its height, the refusal stays up and the arming note shows beside DELETE"' tests/e2e.test.js && grep -qF 'test("SG: N-A7 the crowded 24-note pan: the real SMALL_LABELS warning (two lines) opens Edit, a tapped anchor raises the notice, the warning yields and the three-row seed box stays readable at every keyboard"' tests/e2e.test.js
  ```

**Step 9. Push, open a PR, CI success at the verified head.** The verify is the same as `tests` step 7.

**Deltas:**
- Mutants: 0.
- FLOORS: 0.
- README: prose only. The count sentence is untouched.

### Lane `reconcile` (wave 2, after `tests` and `docs` merge)

- **Branch:** `claude/refactor-6-reconcile`.
- **Worktree:** `.claude/worktrees/refactor-6-reconcile`, cut from `main` after both wave-1 merges.
- **Goal:** README.md's mutant count and every `tests/suite_health.py` FLOORS row equal main's CI artifacts at the lane's base commit.
- **Non-goals:**
  - No test, mutant, source or workflow edit.
  - No row lowered.
  - No `tests/CONTRACT.md` edit.
- **Owned files:**
  - `README.md`: the "N mutant patches" sentence only;
  - `tests/suite_health.py`: FLOORS values only.

**Steps.** Run every step's commands in one shell, in order, after `SCRATCH=$(mktemp -d)`. Step 1 sets `M` and `id`.

**Step 1. Read main's CI at the lane's base.**
- Set `M=$(git merge-base HEAD origin/main)`. It must contain both wave-1 merges:

  ```
  for b in claude/refactor-6-tests claude/refactor-6-docs; do git merge-base --is-ancestor $(gh pr list --head $b --state merged --json mergeCommit -q '.[0].mergeCommit.oid') $M || exit 1; done
  ```
- Find its run: `id=$(gh run list --workflow validate.yml --commit $M --json databaseId,conclusion -q '.[]|select(.conclusion=="success")|.databaseId' | head -1)`.
- Download `js-results`, `python-results` and the four `mutant-shard-report-N` artifacts to `$SCRATCH`.
- Acceptance: `M` contains both merges, its run concluded success, and the six artifacts are present.
- Verify:

  ```
  test -n "$id" && (for a in js-results python-results mutant-shard-report-1 mutant-shard-report-2 mutant-shard-report-3 mutant-shard-report-4; do gh run download $id -n $a -D $SCRATCH/$a || false; done)
  ```

**Step 2. Set FLOORS from the artifacts.**
- For every row, set the value to the CI total: `js-results.json` `.files[path].total`, or `python-results.json` `.by_module`.
- Projected: `tests/app.test.js` goes from 618 to 620. Every other row is unchanged.
- Acceptance: each row equals CI, no row is below its value at `M`, and suite health is green.
- Verify (the pass-5 reconcile step 2 command, unchanged):

  ```
  git show "${M}:tests/suite_health.py" > $SCRATCH/base_suite_health.py && python3 -c "import sys,importlib.util as u; sys.path.insert(0,'tests'); import suite_health as h; sp=u.spec_from_file_location('b','$SCRATCH/base_suite_health.py'); b=u.module_from_spec(sp); sp.loader.exec_module(b); low=[k for k,v in b.FLOORS.items() if h.FLOORS.get(k,-1) < v]; print(low); sys.exit(1 if low else 0)" && python3 -c "import json,sys; sys.path.insert(0,'tests'); import suite_health as s; js=json.load(open('$SCRATCH/js-results/js-results.json'))['files']; py=json.load(open('$SCRATCH/python-results/python-results.json'))['by_module']; bad=[k for k,v in s.FLOORS.items() if v != (js[k]['total'] if k.endswith('.js') else py['tests.'+k[6:-3]])]; print(bad); sys.exit(1 if bad else 0)" && python3 -m unittest tests.test_suite_health
  ```

**Step 3. Set the README mutant count.**
- Set the "N mutant patches" sentence to the shard-report total. Projected: 1089.
- Acceptance: the README number equals the shard-report total and `ls tests/mutants/*.patch | wc -l`.
- Verify:

  ```
  n=$(cat $SCRATCH/mutant-shard-report-*/mutant-shard-*.txt | grep -c '\.patch$'); grep -q "$n mutant patches" README.md && test "$n" -eq "$(ls tests/mutants/*.patch | wc -l | tr -d ' ')" && python3 -m unittest tests.test_readme_currency
  ```

**Step 4. Push, open a PR, CI success at the verified head.** The verify is the same as `tests` step 7.

**Deltas:**
- Mutants: 0.
- FLOORS: +2, the `tests/app.test.js` row.

**Projected after the last merge:**

| | count |
|---|---|
| Corpus (1086 + 3 from `tests`) | 1089 |
| README | 1089 |
| FLOORS js (1663 + 2) | 1665 |
| FLOORS py | 255 |
| FLOORS rows (no new suite file) | 39 |

Reconcile reads CI, so any interleaved merge is absorbed and is not a plan error.

## 7. Waves and merge order

| wave | lane | depends on | why |
|---|---|---|---|
| 1 | `tests` | none | Owns `tests/app.test.js` and three new mutants. Edits no file `docs` owns. |
| 1 | `docs` | none | Owns `CLAUDE.md` and one `README.md` bullet. Edits no file `tests` owns. |
| 2 | `reconcile` | both wave-1 lanes merged, and main's `validate` green at the later merge | Must read the corpus count with `tests`' three mutants, and the app total of 620 (D1). Edits `README.md` after `docs` has released it. |

**Ownership and caps:**
- No file is in two lanes of one wave.
- No lane commits a change to `index.html`, so there is nothing to serialize there.
- `tests/suite_health.py` has one editor (reconcile).
- `README.md` has one editor per wave: `docs` in wave 1 and `reconcile` in wave 2.
- No lane adds a suite file or edits `tests/e2e.test.js`.
- At most 2 lanes run at once and there are 3 in all, under the caps of 4 and 8.

## 8. Standing merge gates (every lane)

1. **CI at a verified head.**
   - CI `validate` concluded success at a head SHA verified against the local tip.
   - Verify the SHA with `gh pr view <n> --json headRefOid`, re-queried once after the push. It must equal `git rev-parse HEAD`.
   - Read the `gh run list --commit <sha>` conclusion, not `gh pr checks` buckets.
2. **Independent review.**
   - A fresh `swarm-reviewer` returned PASS or PASS_WITH_NITS at that same SHA.
   - Its brief quotes the lane's section 6 acceptance block verbatim and adds no criterion.
   - For `docs`, the reviewer re-verifies every sentence the lane changed against the test it cites.
3. **Gates in that run.** The mutation gate and `suite health` are green.
4. **Ownership.** `git diff --name-only origin/main...<sha>` lists only the lane's owned files.

A reviewer FAIL is never merge-able: fix it and re-review with a fresh reviewer.

**Merging:**
- Merge with `gh pr merge <n> --merge`, with no `--delete-branch`, under the AFK grant.
- Fast-forward local `main` afterwards.

## 9. Decisions

AFK auto-picks the recommendation. Each recommendation is the conservative option.

| # | decision | options | recommendation |
|---|---|---|---|
| D1 | FLOORS amendment to `tests/CONTRACT.md` "Floors are a per-file table" ("Adding tests means editing YOUR row's number"), for this pass only | (a) Rows are minimums: a lane that adds tests leaves its row unchanged, and the reconcile lane sets every row from main's CI artifacts after the last merge. (b) Follow CONTRACT: each lane raises its own row. | (a). Carried from pass 5 D1. It keeps `tests` off `tests/suite_health.py`, so one lane edits it, and every number comes from CI. CONTRACT is not edited. |
| D2 | Whether `tests`, which adds 3 mutants, edits README's count | (a) No. `test_the_mutant_count_is_stated_within_a_lane_of_the_truth` tolerates the band, and reconcile sets the count. (b) Yes, in the same lane. | (a). It avoids a second README editor in wave 1. |
| D3 | The sheet-guidance nits Q1, Q3 and Q4, which the owner marked "Leave unscheduled" on 2026-10-14 | (a) Fold into `docs`, because each shows a CLAUDE.md claim to be false (4.9), and CLAUDE.md is treated as ground truth by every future lane. (b) Keep unscheduled. | (a). The edit is a sentence each, cites existing tests, and changes no code. A false "no test" claim misleads the next lane. |
| D4 | Whether lane `docs` should exist, since it carries no DO candidate | (a) Yes: nit triage is a deliverable of this pass, and its 10 doc edits share two files. (b) Close the doc nits. | (a). Folding into `tests` would put `CLAUDE.md` and `README.md` in a TEST-STRENGTHEN lane, against the class rules. |
| D5 | Where O4's mutant lives | (a) In `tests`, as a mutant only; its killing test already exists in `tests/sequence.test.js`. (b) A separate lane. | (a). It adds no test, edits no owned test file, and keeps the lane count down. |
| D6 | #348 N2 as an equivalent rewrite, not a stricter one | (a) Equivalent: `sn_about_resize_listener_dropped` stays killed, now by assertion. (b) Leave it. | (a). A TypeError kill is a wrong-reason kill, which the gate cannot tell from a right one. |
| D7 | #348 N3 | (a) Close as contradicted (0.1). (b) Apply it. | (a). Applying it would break every v5 link's check at the next version bump. |
| D8 | The two WEAK tests | (a) Add new tests and leave the WEAK tests' bodies untouched. (b) Extend the existing tests' assertions. | (a). It needs no stricter-than proof, and the new titles carry the new mutants. |
| D9 | Expected review bounces | `tests` 1, `docs` 1, `reconcile` 0 | Docs lanes bounced on claim wording in #299, #301 and #347. Test lanes bounce about once. Reconcile is mechanical. |

## 10. Owner-gated proposals (kept out of the lanes)

**G-1. percentDecode accepts lowercase hex** (#344 nit).
- **Benefit:** a link whose `%28` was lowercased by some intermediary (`%2a`, `%5f`) would open instead of being refused.
- **Measured cost of leaving it:** no report of such a link. The canonical writer emits uppercase, and "SV: a link with percent-encoded parens or underscores opens; an escaped * or + is refused" pins the current reading.
- **Cost of the change:** it widens which links a user can open, and it gives one deck two spellings. That breaks the stated rule that "each deck has one spelling" ("SV: every option has one spelling and a default writes nothing").
- **Recommendation:** keep it as is.

**G-2. An empty scale segment refuses with NO_DING, not BAD_NOTE** (#344 nit).
- **Benefit:** a more specific refusal message for a hand-edited link with an empty scale.
- **Cost:** it changes a refusal code a user can see. It also contradicts "SV: every v5 structural refusal is badNote of the whole link; a parseSeed refusal keeps its own code and reason", which classes an empty segment as structural.
- **Recommendation:** keep it as is.

## 11. What the plan deliberately leaves

**DEFER, recorded for a later pass:**

| id | reason |
|---|---|
| P6-2 (`ELEMENT_IDS` derivation) | Its subject is at 4 of 60, and it conflicts with N-A3. |
| P6-3 (time-balanced shards) | Not a fixed wait. |
| P6-4 (wheel-swipe flake) | One occurrence. |
| P6-5 (SV e2e 0.8 s waits) | Below 30 s. |
| P6-6 (FNV copies) | Below every bar. |
| P6-7 (importer churn) | Excluded; on hold. |
| P6-10 (re-anchor drag) | 2 of 20. |

**DROP:**

| id | reason |
|---|---|
| P6-8 (gone-predicate extraction) | `54c7f01`'s decision stands. |
| P6-9 (hashchange restructure) | No shape reduces the cost. |

**Owner-gated:** G-1 and G-2 (section 10).

**Nits CLOSED in 4.9.** Every one is cited there with its reason. Among them:

- the remove-degrees Q6 and Q7 owner "leave" rows;
- sheet-guidance Q7 (see section 13);
- #345 nit 7, which is accepted at review and would be a pixel change.

**Excluded by the coordinator:** scale import, DEV env, the CLAUDE.md ideas list, and deck data and geometry (section 2).

**Earlier passes, not re-opened.** No input to their stated reasons was shown to change:

- Pass 5 sections 10 and 11: G-1 to G-4, P5-2 to P5-20.
- Pass 4's sections 8 and 10.
- Pass 3's section 2.2 and its KEPT-BY-DECISION and LIVE rows.

## 12. Risk register

| lane | what could regress | existing test that catches it | new test that must | expected bounces |
|---|---|---|---|---|
| `tests` | (1) A new test passes for the wrong reason: GA not injected, so the `dataLayer` is empty and an "absent" assertion holds vacuously. (2) The step-4 rewrite masks a real failure. (3) A mutant body carries an `index` line or hits the boot's copy of the line. | (1) The step-1 test asserts exactly one `deck_route` entry, so an empty queue fails it. "a routed boot queues config before deck_route" proves that `withGaId` with `webdriver: false` injects. (2) `sn_about_resize_listener_dropped` must still be killed (step 4 verify). (3) "no mutant patch carries a blob header it cannot keep true" and "every mutant patch applies to the tree it will run against". | The two new tests, killed by `p6_hashchange_*`. "INTERMEDIATE deals a register-labelled anchor" kills `p6_voicing_top_tie_break_flipped`. | 1 |
| `docs` | A new sentence claims a test asserts something it does not. | `tests.test_readme_currency`, for README. | none. The step-8 title check, and the reviewer's per-sentence re-verification (gate 2). | 1 |
| `reconcile` | (1) A row is set by hand. (2) A row is lowered. (3) The README count is stale. | (1) The step-2 CI-equality command and suite health. (2) The step-2 base comparison. (3) `tests.test_readme_currency` and the step-3 cross-check. | none | 0 |

## 13. Not measured, and why

- **Coverage.** Run 39053255194 was still `in_progress` when this plan was written, and no second run was dispatched, per the prompt. No candidate depends on coverage. The DO evidence is two shown breaks.
- **E2E per-test timings.** The full e2e suite starves a local browser, and CI records no per-test time. No TEST-SPEED row depends on an e2e figure, because both are DEFER by the fixed-wait rule.
- **Sheet guidance Q7, wrapping at 360 px.** Not measured, by the owner's decision to leave it.
- **The exact saving of a time-balanced shard split.** Only the 67 s spread in one run was measured. The row is DEFER whatever the figure.

## Self-score (plan rubric)

The rubric, restated:

1. 0 quotes and 0.1.
2. Commands on every section-4 number.
3. All eight fields per row.
4. DO rule met.
5. No file in two lanes of one wave.
6. Acceptance and verify per step.
7. Pins green on main.
8. Deltas sum.
9. Sections 2, 10 and 11 cover everything, nits included.
10. VERDICT counts and formula.

| # | item | score | note |
|---|---|---|---|
| 1 | Section 0 quotes the request; 0.1 lists every contradicted fact | 1 | #348 N3 is contradicted, two #344 nits are already fixed, and the seven stale doc claims are listed. |
| 2 | Every number in section 4 carries its command | 1 | Scratch scripts are named with their arguments. |
| 3 | Every section 5 row has all eight fields | 1 | P6-1 to P6-10. |
| 4 | Every DO row meets the DO rule | 1 | P6-1: a WEAK test on the 6-of-60 `hashchange` hotspot, shown by two one-hunk patches; a pin; no gate. |
| 5 | No file in two lanes of one wave | 1 | Wave 1: `tests` and `docs` are disjoint. Wave 2: `reconcile` alone. |
| 6 | Every lane step has acceptance and a runnable verify | 1 | Steps 1 to 7, 1 to 9 and 1 to 4. |
| 7 | Every lane names a pinning test green on main | 1 | `tests`: the four existing route tests. The new tests are green on main by construction (steps 1 and 2) and RED under their committed mutants (step 3). `docs`: `tests.test_readme_currency`. `reconcile`: suite health and README currency. |
| 8 | Mutant and FLOORS deltas sum to the projection | 1 | 1086 + 3 = 1089. FLOORS js 1663 + 2 = 1665; py 255. |
| 9 | Sections 2, 10 and 11 cover every DEFER, DROP, owner-gated item and triaged nit | 1 | P6-2 to P6-10, G-1 and G-2, the 4.9 CLOSE rows, and the exclusions. |
| 10 | VERDICT counts match; X and Y follow the formula | 1 | N = 3, M = 1, K = 2. Bounces 1 + 1 + 0 = 2. X = 2 x 3 + 2 x 2 = 10. Y = 3 + 2 + 2 x 0 = 5. |

VERDICT: 3 lanes, 1 DO candidates, 2 owner-gated proposals, projected 10 subagent runs and 5 CI runs
