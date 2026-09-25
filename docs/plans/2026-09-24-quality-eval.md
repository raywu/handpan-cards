# Quality evaluation: code quality and test quality

- **Goal:** find the highest-value improvements to code quality and to test
  QUALITY. The question is whether the tests catch real regressions, not how
  much of the code they execute.
- **Date:** 2026-09-24
- **Base:** `origin/main` @ `31c1203`. CI `validate` run 36064868549 is green
  5/5 at that SHA, and the mutation gate killed 390/390.
- **Shape:** /swarm. Phase E is a read-only evaluation. Phase F is the fixes,
  and is provisional until Phase E closes. The plan goes to /plan-eng-review
  before execution.
- **Related docs:** `docs/plans/2026-09-24-one-pdf-path-coordination.md` (the
  "one-pdf" doc) and `docs/plans/scale-engine-coordination.md` (the
  "scale-engine" doc). Their open rows are **referenced by number and not
  re-listed** as findings here.

## §1 Goal and non-goals

**Goal.** Produce one ranked findings table (§3) covering six dimensions.
Weight the work in this order:

1. `src/engine/*.js` and the app JS in `index.html`. This is the shipped
   artifact.
2. The sync tools and drift checks: `tools/inline_engine.py`,
   `tools/sync_decks.py`, `tools/inline_fonts.py` and `tools/validate.py`.
3. The Python reference oracle (`tools/hifi.py` as a parity oracle).
4. The print pipeline (`tools/decks.py`, `tools/hifi.py` as a PDF producer).

Phase F then fixes the S1 and S2 rows and the cheap S3 rows.

**Ranking.**

| Scale | Meaning |
|---|---|
| S1 | A user-visible regression could ship with CI green |
| S2 | A wrong internal result or generated artifact could ship with CI green |
| S3 | A gap in test or diagnostic quality, with no known escape path |
| S4 | Hygiene |
| C1 / C2 / C3 | Cost: under 1 hour / half a day / more than 1 day |

Rank by severity, then by cost.

**Non-goals (binding on every lane in both phases).**

| # | Non-goal |
|---|---|
| N1 | No change to deck data, diagram geometry, committed PDFs or the visual system |
| N2 | No build step, bundler or framework, and no `<script src>` in `index.html` |
| N3 | No new dependencies: no c8, nyc, istanbul, coverage.py or pytest-cov, and no `package.json` or requirements entries. Use only built-in tooling: `node --experimental-test-coverage`, `NODE_V8_COVERAGE`, CDP `Profiler.*` and `python3 -m trace` |
| N4 | No hosted services: no Codecov, Coveralls or SonarCloud, no uploads, no badges |
| N5 | No style-only test rewrites |
| N6 | Coverage % is never a goal or a gate. It only locates code that no test executes |
| N7 | No retirement of Python from CI. This is an open decision (§7 D1) |
| N8 | Phase E edits no tracked file |
| N9 | Never run `tests/mutation_check.sh` in full locally. Never run the full `tests/e2e.test.js` locally, because it starves the browser. Run single e2e tests with `--test-name-pattern`. CI at the head SHA is the evidence |
| N10 | Never `cp -r` a worktree. Never poll with `pgrep -f` |

## §2 Phase E method per dimension

**Artifacts** go under `$QE`. In a lane worktree, set
`QE=.quality-eval/<lane>`. `.quality-eval/` is not yet in `.gitignore`, so a
Phase E lane must not `git add` it. F3 adds the ignore line (§7 D4). Until
then a lane may point `QE` at its scratchpad instead.

| Dim | Lane | Method | Command (exact) | Artifact | Est. |
|---|---|---|---|---|---|
| 1 Coverage map, engine | E1 | Node built-in coverage over the unit files. The engine loads via `vm.runInContext(src,{filename})` (`tools/engine_loader.js`), so coverage attributes to `src/engine/` | `bash -c 'node --test --experimental-test-coverage --test-coverage-include="src/engine/**" $(ls tests/*.test.js \| grep -v e2e)' > $QE/engine-cov.txt` | `engine-cov.txt` | 10m |
| 1 Coverage map, app JS | E1 | Raw V8 coverage. `tests/helpers/sandbox.js:317` runs the index.html blocks with **no filename**, so they appear as `evalmachine.<anonymous>` and escape `--test-coverage-include`. Map each script back to its `<script>` block by source length | `NODE_V8_COVERAGE=$QE/v8 node --test tests/app.test.js tests/preview.test.js tests/pdf_builtin.test.js && node $QE/appcov.js $QE/v8 index.html > $QE/app-cov.txt` (the mapper is a scratch script kept under `$QE`) | `app-cov.txt` | 1h |
| 1 Coverage map, e2e | - | **Dropped (review R1).** `tests/e2e.test.js:20` hard-requires `./helpers/cdp.js`, so a scratch copy is never loaded and `E2E_COV` has no consumer; a hook in the tracked file breaks N8. The 111 serial runs (~3h) also press on N9. E4's journey map answers "which paths does e2e reach" without it | - | - | 0 |
| 1 Coverage map, Python | E1 | `trace`. The subprocess tools are invisible to it, so trace them directly | `python3 -m trace --count --missing --summary -C $QE/pytrace --ignore-dir=$(python3 -c 'import sys;print(":".join(sys.path[1:]))') --module unittest discover -s tests -t .` plus `python3 -m trace --count --missing -C $QE/pytrace tools/validate.py` (and the same for `sync_decks.py --check` and `inline_engine.py --check`) | `pytrace/`, `py-cov.txt` | 1.5h |
| 2 Mutation adequacy | E2 | (a) Mutants per region and per function, using V8 function ranges and not a last-function-start heuristic. (b) Tests selected per `# suite:` header, flagging headers that select 0 or more than 2 tests. (c) Functions with 0 mutants, crossed with their coverage from dim 1. (d) The survivor set from CI, never from a local full run | `python3 $QE/mutmap.py tests/mutants > $QE/mutmap.tsv`. Per header: `node --test --test-reporter=tap <header args> \| grep -c '^ok'`. CI: `gh run view <id> --log --job <mutation-gate-job>` | `mutmap.tsv`, `header-selection.tsv` | 3h |
| 3 Test smells | E3 | AST and regex scan for: assert-in-loop without `subTest`; skips; empty `catch`; fixed sleeps; asserts on source text; asserts without a message on generated data; tautologies | `python3 $QE/smells.py tests > $QE/smells.tsv` | `smells.tsv` | 2h |
| 4 e2e quality | E4 | Map user journeys to e2e tests to see which journeys have no test. Classify every wait as a condition (`waitFor`) or a timer (`settle()`, `setTimeout`). Pull CI flake history | `grep -n "^test(\|^  test(" tests/e2e.test.js > $QE/e2e-names.txt`; `gh api repos/raywu/handpan-cards/actions/workflows/validate.yml/runs?per_page=100 --jq '.workflow_runs[]\|select(.run_attempt>1)'` | `journeys.tsv`, `flake.tsv` | 3h |
| 5 Code quality | E5 | Enumerate the callers of every app function, including bare references (`addEventListener('x', fn)`, `onclick=fn`, object literals). Grep alone is forbidden: see the memory file on enumerating callers. Also look for duplicated constants across renderers, error paths without tests, and boundary inputs (share-URL decode, custom scale parse) | `node $QE/callers.js index.html > $QE/callers.tsv`. Duplicates: `python3 $QE/dupconst.py index.html src/engine tools/hifi.py` | `callers.tsv`, `dups.tsv` | 3h |
| 6 Invariant map | E3 | For each "verified" convention in CLAUDE.md, list the test that asserts it and the mutant that kills that test. A row is a finding only when the test's GROUP has no killing mutant (`tests/CONTRACT.md` rule 3) or a concrete escape is shown; a per-test gap alone is D2's question, not a finding (review R6) | Hand table. Each mutant is confirmed by `grep -l "<test name>" tests/mutants/*.patch` | `invariants.tsv` | 2h |

**Seed coverage, measured at 31c1203 (local node v25.8.1, python 3.9.6).**

- **Engine, unit tests** (all files: 96.73% line, 86.58% branch):
  - `pdf.js` 92.99 / 82.43;
  - `pdfcards.js` 93.88 / 79.19;
  - `pdfdeck.js` 94.20 / **62.26**;
  - `share.js` 93.25 / **74.58**;
  - every other engine file is at or above 97.5% line.
- **App JS, unit tests:** 373 of 5192 lines uncovered (92.8%). Every uncovered
  line is either reached only by e2e or dead code:
  - `index.html:6281` (built-in PDF branch);
  - `6865-6874` (`clearPanPreview`);
  - `7047-7081` (`applyKbOffset` and the visualViewport listeners);
  - `7305-7309` (the submit refusal);
  - `7439-7462` (pan click and keydown delegation);
  - `7507-7508` and `7537-7544` (keyboard and swipe input).
- **Python:**
  - `tools/decks.py` 89% (misses 182 and 339-340; the rest is `__main__`);
  - `tools/hifi.py` 94% (misses 237 and 255);
  - the subprocess tools were not measured.

## §3 Findings

**Template.** Each finding is one row with these columns:

| ID | Gap | Evidence (file:line, number) | Failure it permits | Sev | Cost | Proposed fix | Verify command |
|---|---|---|---|---|---|---|---|

Rules for rows:

- IDs are `Q<n>`.
- A row that restates an open coordination-doc row is not new. Cite the
  existing row instead: "one-pdf row N" or "scale-engine row N".
- An S1 or S2 row must name a concrete regression: a diff, or a mutant that
  CI would not kill.

**Seed findings, measured and not speculative.** Each row states its gap,
the evidence, the failure it permits, and how to verify the fix. Rows are
ranked by severity, then cost.

**Q1 - S1, C2. The share-URL inbound flow has no e2e test.**
- Evidence: boot at `index.html:7574` calls `openShare(location.hash)`
  (`:5618`), which calls `checkShareVersion` (`:5596`). No e2e test uses
  `#s=` or `openShare`. `tests/e2e.test.js:1219` only checks that the hash
  is non-empty. `openShare` itself IS unit-tested
  (`tests/app.test.js:968-1189`: round-trips, newer-version `:1022`, corrupt
  `:1042`), so the gap is the real-browser boot and navigation path only
  (review R3).
- Failure it permits: a boot-order regression, or one that only a real
  `location.hash` / `hashchange` shows, breaks every shared link, and CI
  stays green. The unit tests use the sandbox and never navigate.
- Fix: one e2e test that navigates to a known `#s=` URL and asserts the deck
  name, the chord count and a lit field. Add a mutant that drops the boot
  call.
- Verify: `node --test --test-name-pattern='share link opens' tests/e2e.test.js`,
  then that mutant via `git apply` plus its header.

**Q2 - S3 (S2 if a mutant survives), C2. `pdf.js` has 0 mutants and
`pdf.test.js` has 0 mutant-named tests.**
- Evidence: the mutant count by region is `pdf.js` 0 of 390. 0 of the 11
  tests in `tests/pdf.test.js` are named by any header. Coverage is 92.99%
  line and 82.43% branch, and `:170-184` and `:314-316` are uncovered.
- Failure it permits: unproven. `tests/pdf.test.js:33` (xref byte offsets),
  `:96` (font embedding) and `:102` (escapes) assert these directly, so 0
  mutants shows the tests are unproven live, not that a bug escapes
  (review R4). Ranked S3 until a mutant survives.
- Fix: 3-5 mutants on the xref, string escaping and font embedding, each
  killed by a named `pdf.test.js` test. A mutant that survives becomes an S2
  row with its own killing test. Extends scale-engine rows 312, 313
  and 317/323 without restating them.
- Verify: `node --test tests/pdf.test.js`, plus each new mutant's header.

**Q3 - S2, C2. `pdfdeck.js` has 62% branch coverage and 2 mutants.**
- Evidence: `src/engine/pdfdeck.js:48`, `52-57`, `121-125`, `139-140`,
  `161-162` and `178` are uncovered. Only 2 of 12 functions carry a mutant.
- Failure it permits: the built-in adapter (`fromBuiltin`, reached from
  `index.html:6281`) mis-maps a print overlay key, and no unit test sees it.
- Fix: branch tests for the uncovered adapter paths, plus 1 mutant per
  untested branch.
- Verify: `node --test tests/pdf_builtin.test.js tests/pdfcards.test.js`

**Q4 - S2, C1. `share.js` multi-byte UTF-8 paths are untested.**
- Evidence: the uncovered `src/engine/share.js:113-129` and `142-157` are the
  multi-byte branches of `utf8Bytes` (`:108`) and `utf8String` (`:134`),
  including its invalid-byte `return null`s. `tests/share.test.js` has no
  non-ASCII input. Truncated, corrupt and hostile payloads are ALREADY
  tested (`tests/share.test.js:201`, `215`, `224`, `255`; review R5).
- Failure it permits: a scale or deck name with a non-ASCII character (a
  degree sign, an accent, an emoji surrogate pair) encodes or checksums
  wrong, and the link fails to open or opens a different name.
- Fix: round-trip tests over 2-, 3- and 4-byte characters, plus invalid
  continuation and overlong-truncated byte sequences that must decode to a
  refusal.
- Verify: `node --test tests/share.test.js`

**Q5 - S3, C1. Six mutant headers select a whole file, so they are
exit-code-only kills.**
- Evidence: `p_print_selector_case`, `p_print_fill_parent_dropped`,
  `p_print_media_anchor_vacuous` and `p_print_parent_height_literal` select
  all 185 tests in `app.test.js`. `f_pdfcards_track_once` and
  `h_pdfcards_label_ratio_flat` select all 10 in `pdfcards.test.js`.
- Failure it permits: any unrelated failure in the file "kills" the mutant,
  so the named invariant can lose its test unnoticed. This is the same class
  as scale-engine rows 263 and 283, extended with 6 new instances.
- Fix: narrow each header to `--test-name-pattern=<the killing test>`.
- Verify: per header, `node --test --test-reporter=tap <args> | grep -c '^ok'`
  equals 1, and CI's mutation gate is green.

**Q6 - S3, C1. App JS is invisible to node coverage.**
- Evidence: `tests/helpers/sandbox.js:317` calls `vm.runInContext(src,
  sandbox)` with no `filename`.
- Failure it permits: no escape path, but every app-coverage measurement
  needs the scratch V8 mapper.
- Fix: pass `{filename: 'index.html', lineOffset}` per block. Test-only
  change.
- Verify: `node --test --experimental-test-coverage --test-coverage-include=index.html tests/app.test.js`
  reports index.html.

**Q7 - S3, C1-C2. 60 Python test methods assert inside a loop without
`subTest`.**
- Evidence: e.g. `tests/test_deck_data.py:212`, `233`, `248`, `286`, `405`
  and `627`; `tests/test_fixture_integrity.py:91`;
  `tests/test_font_subset.py:47`.
- Failure it permits: the first failing card hides the rest, which slows
  diagnosis. No escape.
- Fix: wrap the loop body in `with self.subTest(...)`. Diagnosability only,
  not a style rewrite (N5).
- Verify: `python3 -m unittest tests.test_deck_data tests.test_fixture_integrity tests.test_font_subset`
  and CI's `suite health` job (not local, review R2)

**Q8 - S3, C1. 8 fixed sleeps in e2e, plus `settle()` used 29 times.**
- Evidence: fixed sleeps at `tests/e2e.test.js:126`, `161`, `760`, `5699`,
  `5800`, `5849`, `5913` and `6002`. `settle()` (`tests/helpers/cdp.js:161`)
  is a fixed 500ms timer, against 56 uses of `waitFor`.
- Failure it permits: a timing flake class (scale-engine rows 250, 255 and
  271), and wall-clock pressure toward the hang rows (162, 166, 167, 175 and
  196).
- Fix: replace each sleep whose post-condition is observable with `waitFor`.
  Keep the harness self-test sleeps at `:5699-6002` if they test timing
  itself.
- Verify: each touched test by `--test-name-pattern`, then CI.

**Q9 - S3, C1. An unexplained CI failure in data integrity.**
- Evidence: run 35917368118 at `6bfe966`, attempt 1 failed in "data
  integrity" and passed on re-run. It is 1 of 2 re-attempts in the last 100
  runs; the other is the flaky mutant `e_swipe_deadzone_dropped`
  (scale-engine row 325).
- Failure it permits: an unknown nondeterminism in `tools/validate.py`
  (fonttools subset? dict order?).
- Fix: E4 reads the attempt 1 log and files a row with the cause.
- Verify: `gh run view 35917368118 --attempt 1 --log-failed`

**Q10 - S4, C1. An obsolete `load_tests` bridge, with 11 headers naming the
wrong modules.**
- Evidence: the docstring at `tests/test_pdf_build.py:405-420` cites a
  `c_*` prefix fallback that no longer exists. 11 `c_gen_*` and
  `c_blurb_spurious_line` headers name `tests.test_print tests.test_pdf_build`,
  but the tests live in `tests/test_gen_deck.py` (e.g. `:356` and `:441`).
- Failure it permits: deleting the bridge "as dead" silently makes the 11
  mutants select 0 tests. suite_health would catch that only if it counts
  selection.
- Fix: point the headers at `tests.test_gen_deck`, then drop the bridge in
  the same PR. `tools/regen_data_mutants.py` does not apply, because these
  are not data mutants.
- Verify: for each header, `python3 -m unittest -v <args> 2>&1 | grep -c ' ok$'`
  is at least 1, and CI's mutation gate is green.

**Q11 - S4, C2. The label-size constants live in three places.**
- Evidence: `index.html:5772-5773`, `src/engine/pdfcards.js:145-148` and
  `tools/hifi.py:119-122`. `F_NUM_RATIO` is a fourth copy at
  `src/engine/layout.js:50`.
- Failure it permits: none today. They are pinned transitively by
  `test_render_agreement` and `test_pdf_parity`. This is drift hygiene only.
- Fix: this is an owner decision (§7 D5). If unified, the app reads the
  values from `HPE.pdfcards`.
- Verify: `python3 -m unittest tests.test_render_agreement tests.test_pdf_parity`

**Q12 - S4, C1. `shareLink(d)` has no production caller.**
- Evidence: `index.html:5608` is called only from `tests/app.test.js:964`.
  This is already noted as B1 in `docs/plans/2026-09-18-readme-refresh.md:418`.
  The legacy print chain is scale-engine row 333.
- Failure it permits: a dead API kept alive by its own test.
- Fix: §7 D3. Either wire it to the UI or delete it together with its test.
- Verify: `node --test tests/app.test.js`, and the caller enumeration in
  E5's `callers.tsv`.

**Not counted as findings**, because they already exist as rows:

- one-pdf doc rows 4-6 and 30-35;
- scale-engine doc rows:
  - 57, 83 and 115 (source scans);
  - 82 (unfalsifiable rebuild test);
  - 249, 256 and 257 (evidence discarding);
  - 279 (weak D2 cluster test);
  - 280 (hollow-header harness);
  - 301 (tests without mutants);
  - 314, 316 and 319 (`pdfFileName`);
  - 326 (stale hunk headers);
  - 338-340 (half-HEAD oracle).

Phase E links to these rows and does not re-measure them.

## §4 Lanes

### Phase E (read-only, parallel)

Every E lane:

- **Owns** only `$QE/<lane>/` (untracked) and its findings rows.
- **Never touches** any tracked file.
- **Acceptance:** the artifact exists and its numbers are reproducible by the
  listed command. Every row carries a severity, a cost and a verify command.
  S1/S2 rows name a concrete regression.
- **Non-goals:** N1-N10. No fixes.

| Lane | Dimensions | Artifacts | Verify (reproducibility) |
|---|---|---|---|
| E1 coverage | 1 | `engine-cov.txt`, `app-cov.txt`, `py-cov.txt` | Re-run the §2 dim-1 commands. Totals match within 0.1% |
| E2 mutation | 2 | `mutmap.tsv` (mutants per function, V8 ranges), `header-selection.tsv` | `python3 $QE/mutmap.py tests/mutants \| diff - $QE/mutmap.tsv` is empty |
| E3 smells and invariants | 3, 6 | `smells.tsv`, `invariants.tsv` (convention -> test -> mutant) | `python3 $QE/smells.py tests \| diff - $QE/smells.tsv` is empty. Every "verified" convention in CLAUDE.md has a row |
| E4 e2e | 4 | `journeys.tsv`, `flake.tsv`, the Q9 cause | Every journey maps to a test name or to "none". `gh run view 35917368118 --attempt 1 --log-failed` is quoted |
| E5 code quality | 5 | `callers.tsv`, `dups.tsv`, error-path list | `node $QE/callers.js index.html \| diff - $QE/callers.tsv` is empty. Bare references are included |

**E close-out** (one serial step, run by the coordinator):

- merge all rows into §3 of this file on a `claude/quality-eval-findings`
  branch;
- re-rank;
- finalize the Phase F lanes below;
- run /plan-eng-review.

### Phase F (provisional, one worktree per lane)

| Lane | Owns | Never touches | Seeds | Acceptance | Verify |
|---|---|---|---|---|---|
| F1 engine mutants and tests | `tests/pdf.test.js`, `tests/share.test.js`, `tests/pdf_builtin.test.js`, new `tests/mutants/f1_*.patch`, the F1 rows of `tests/suite_health.py` FLOORS | `src/engine/*` (test-only unless a real bug is found; a bug gets its own row and an owner ask), `index.html` | Q2, Q3, Q4 | Every new mutant is killed at CI's head SHA, and its header selects exactly 1 test. `suite_health` floors are raised to the new counts. Each Q3 branch test names the mis-mapping it catches (no coverage-% gate, N6; review R7) | `node --test tests/pdf.test.js tests/share.test.js tests/pdf_builtin.test.js`; `suite_health` is read from CI (locally it runs the full e2e file when a browser is found, `tests/suite_health.py:409`; N9, review R2). For each new mutant: `git apply tests/mutants/<m>.patch && <header cmd>; git apply -R ...` |
| F2 e2e share flow and waits | `tests/e2e.test.js`, `tests/helpers/cdp.js`, 1 new `tests/mutants/f2_share_boot_*.patch`, the e2e row of `tests/suite_health.py` FLOORS | `index.html`, the other test files | Q1, Q8 | The share-URL test passes at 380px. The boot-drop mutant is killed. Each converted sleep has an observable condition | `CHROME_BIN=... node --test --test-name-pattern='<each touched name>' tests/e2e.test.js`. The full suite runs in CI only (N9) |
| F3 harness diagnosability | `tests/helpers/sandbox.js`, `.gitignore` (the `.quality-eval/` line) | the tests themselves | Q6 | `--test-coverage-include=index.html` reports app lines. All 185 app tests pass, unchanged | `node --test tests/app.test.js tests/preview.test.js tests/pdf_builtin.test.js` |
| F4 Python test hygiene | `tests/test_pdf_build.py`, `tests/test_gen_deck.py`, `tests/test_deck_data.py`, `tests/test_fixture_integrity.py`, `tests/test_font_subset.py`, the headers of the 11 `c_gen_*`/`c_blurb_*` mutants | `tools/*`, `data/*`, the committed PDFs | Q7, Q10 | The bridge is gone. The 11 headers name `tests.test_gen_deck` and each selects at least 1 test. The loop-asserts use `subTest`. Test counts are unchanged | `python3 -m unittest discover -s tests -t .`, plus the per-header count from Q10. `suite_health` from CI (review R2) |
| F5 mutant header narrowing | the headers of `p_print_*` (4), `f_pdfcards_track_once` and `h_pdfcards_label_ratio_flat` | patch bodies, the tests | Q5 | Each header selects exactly 1 test and the mutant is still killed | Per header, `node --test --test-reporter=tap <args> \| grep -c '^ok'` equals 1. CI mutation gate green |
| F6 app code quality (gated on §7) | `index.html` app block (outside every generated region), its tests in `tests/app.test.js` | engine regions, the `const DECKS` line, CSS and markup | Q11, Q12, E5 rows | Only owner-approved items. `tools/validate.py` stays clean | `python3 tools/validate.py`, `python3 tools/inline_engine.py --check`, `python3 tools/sync_decks.py --check`, `node --test tests/app.test.js` |

Every F lane has these non-goals:

- N1-N10;
- no fix outside its "Owns" column;
- no weakening of a floor or a mutant;
- no edit inside a generated region. Change the module and re-run the sync
  tool instead.

## §5 Order and dependencies

| Step | Runs | Depends on |
|---|---|---|
| 1 | E1-E5 in parallel | base `31c1203` |
| 2 | E close-out, re-rank, /plan-eng-review | all E lanes |
| 3 | F3 first, because it makes F1's coverage check direct. It is C1 | step 2 |
| 4 | F1, F2, F4 and F5 in parallel | F3 merged (F1 only). File ownership is disjoint |
| 5 | F6 | owner answers to §7 D3 and D5 |

**Collision note.** F1, F2 and F5 all add or edit `tests/mutants/*.patch`,
but each owns a disjoint set of filenames: F1 only `f1_*`, F2 only
`f2_share_boot_*`, F5 only existing headers (review R8; the earlier
`*_share_*` / `*_share_boot_*` globs overlapped). F1 and F2 each own their
own FLOORS rows in `tests/suite_health.py`; the two edits touch different
lines, and F2 rebases after F1 merges if they conflict.

## §6 Merge gates (standing, every F lane)

1. CI `validate` is green **5/5** at the head SHA. Confirm that the head SHA
   equals the local tip with `gh pr view <n> --json state,headRefOid,mergeable`.
   A CONFLICTING PR queues no CI.
2. A **fresh** independent reviewer subagent:
   - checks out that SHA (`git checkout -B review-<lane> <sha>`) in its own
     worktree;
   - runs /review read-and-report only;
   - reads CI's conclusion for that exact SHA;
   - returns **PASS** or **PASS_WITH_NITS**.
   FAIL blocks the merge. Fix, then re-review with a new reviewer.
3. A lone mutation-gate survivor on an unrelated diff is re-run once at the
   same SHA before it is treated as real.
4. Merge with `gh pr merge <n> --merge`. Then, once
   `gh pr list --head <b> --state merged` confirms the merge, remove the
   worktree and delete the branch.
5. Phase E has no merge. Its only output is the close-out commit to this
   file, which passes the same gates.

## §7 Open decisions for the owner

| # | Decision | Default if no answer (conservative) |
|---|---|---|
| D1 | Retire Python from CI once the JS engine and PDF path fully replace `hifi.py` as the oracle? Python currently holds 77 mutant headers, `render_agreement` and `pdf_parity` | Keep it. Out of scope here (N7) |
| D2 | Must every test named in CLAUDE.md as an invariant carry its own killing mutant, beyond CONTRACT rule 3's per-group requirement? Overlaps scale-engine row 301 | Per group only. E3 lists the gaps |
| D3 | Delete the dead code (`shareLink` at `index.html:5608`, the `openPrintSheet` chain in scale-engine row 333), or wire it to the UI? | Leave it. F6 skips it |
| D4 | Gitignore `.quality-eval/` (F3), or keep artifacts in the scratchpad only? | Gitignore it. This is a one-line change |
| D5 | Unify the label constants (Q11) into one source read by the app? This touches the app/print parity surface | No change. The parity tests already pin them |

## Commands behind the seed numbers

All run in `/private/tmp/claude-501/wt-qe` at `31c1203`:

- the engine coverage command (§2, dim 1);
- `NODE_V8_COVERAGE` over the app, preview and pdf_builtin unit files, plus a
  scratch mapper;
- the `python3 -m trace` command (§2), which took 68s and ran 191 tests OK;
- a node TAP name collection per unit file;
- `gh run view 36064868549`;
- `gh api .../workflows/validate.yml/runs?per_page=100` plus
  `.../attempts/1/jobs`;
- one Python and two node single-header runs;
- Python scans over `tests/mutants/*.patch` and `tests/*.py`.

The full mutation script and the full e2e suite were never run locally.

## Engineering review (/plan-eng-review, 2026-09-24)

**Scope challenge.** The plan names 8+ files per phase, which trips the
complexity gate. Phase E was ~17h across 5 lanes, while the seed findings
already cover most S2 candidates. Reduced by dropping E1's e2e CDP coverage
(infeasible as written, ~3h, N8/N9 tension). E3 and E5 stay separate: their
artifacts and scripts share nothing. Phase E is now ~14h.

**Architecture.** Phase E is read-only and Phase F is split by file ownership;
that is sound. Two ownership defects were fixed: overlapping mutant globs
(R8) and unowned `suite_health.py` FLOORS (R8).

**Code quality.** Q11 and Q12 stay owner-gated (D3, D5). There were no other
findings.

**Tests.** Where each dimension's evidence comes from after the review:

```
                 unit (node)        unit (py)       e2e (CDP)        mutation
engine  src/     E1 cov  ✓          -               -                E2 map ✓
app JS index     E1 V8 mapper ✓     -               E4 journeys ✓    E2 map ✓
                 (F3 -> direct)                     (no cov, R1)
sync tools       -                  E1 trace ✓      -                E2 map ✓
print (py)       -                  E1 trace ✓      -                E2 map ✓
share boot       app.test ✓(unit)   -               GAP -> F2 (Q1)   GAP -> F2
share utf-8      GAP -> F1 (Q4)     -               -                -
pdf.js emit      pdf.test ✓         -               -                GAP -> F1 (Q2)
```

**Performance.** No runtime change. The only cost question is local wall
clock, bounded by N9. `suite_health.py` was a hidden full-e2e run (R2).

**Outside voice** (codex exec, read-only): 7 findings. All 7 were verified
against the repo and accepted (R2, R4, R5, R6, R7, R8, plus R1, which was
already found).

### Decision ledger

| # | Finding | Decision | By |
|---|---|---|---|
| R1 | E1 e2e CDP coverage cannot load a scratch cdp.js (`tests/e2e.test.js:20`); 111 tests, not 112 | Drop the row; E4 journeys cover reach | auto-decided (AFK standing grant) |
| R2 | `suite_health.py` runs the full e2e file when a browser is found (`tests/suite_health.py:409`), breaking N9 in F1/F4 verify | `suite_health` evidence comes from CI only | auto-decided (AFK) |
| R3 | `openShare` is already unit-tested (`tests/app.test.js:968-1189`) | Narrow Q1 to boot/navigation | auto-decided (AFK) |
| R4 | Q2's escape is unproven: `tests/pdf.test.js:33/96/102` assert xref, font and escapes | Q2 goes to S3, and to S2 only if a mutant survives | auto-decided (AFK) |
| R5 | Q4's proposed hostile-input tests exist (`tests/share.test.js:201-255`); the uncovered lines are UTF-8 | Reframe Q4 as UTF-8 round-trip and invalid-byte tests, C1 | auto-decided (AFK) |
| R6 | E3 counts a per-test missing mutant as a finding, beyond CONTRACT rule 3 and D2's default | Only a missing group-level mutant or a shown escape counts as a finding | auto-decided (AFK) |
| R7 | F1's "85% branch" acceptance contradicts N6 | Replace with named-regression tests | auto-decided (AFK) |
| R8 | F1 `*_share_*` overlaps F2 `*_share_boot_*`; no lane owned FLOORS | `f1_*` / `f2_share_boot_*` prefixes; each lane owns its FLOORS rows | auto-decided (AFK) |

**Approval readiness:** ready. D1-D5 stay owner decisions; each has a
conservative default, so none blocks Phase E.

**NOT in scope:** e2e coverage measurement (R1), any coverage-% gate (N6),
and retiring Python from CI (D1).

**What already exists:**

- `openShare` unit tests;
- share hostile-input tests;
- `pdf.test.js` direct emitter assertions;
- the CONTRACT rule 3 group-mutant requirement;
- the suite_health FLOORS gate.

**Failure modes:**

- A lane runs `suite_health` locally and starves Chrome. Prevented by R2.
- F1 and F2 edit the same patch filename. Prevented by R8.
- F1 fills branches to reach a percentage. Prevented by R7.

**Parallelization:** E1-E5 run fully parallel. In Phase F, F3 goes first,
then F1, F2, F4 and F5, then F6 (§5).

**Implementation tasks:** the Phase E lanes in §4, as amended here.

**Completion summary:**

- 8 findings, 8 fixed in the plan;
- 0 critical gaps;
- 5 owner decisions carried (D1-D5);
- outside voice: codex, 7 of 7 accepted.

## GSTACK REVIEW REPORT

| Review | Trigger | Runs | Status | Findings |
|---|---|---|---|---|
| Eng Review | /plan-eng-review | 1 | CLEAR (8 auto-decided under the AFK grant) | 8 found, 8 applied |
| Outside Voice | codex exec | 1 | issues_found, all accepted | 7 |

NO UNRESOLVED DECISIONS
