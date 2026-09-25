# Quality evaluation: code quality and test quality

- **Goal:** find the highest-value improvements to code quality and to test
  QUALITY. The question is whether the tests catch real regressions, not how
  much of the code they execute.
- **Date:** 2026-09-24
- **Base:** `origin/main` @ `31c1203`. CI `validate` run 36064868549 is green
  5/5 at that SHA, and the mutation gate killed 390/390.
- **Shape:** /swarm. Phase E is a read-only evaluation. Phase F is the fixes.
  The plan goes to /plan-eng-review before execution.
- **Status (2026-09-25):** Phase E CLOSED at `23c4962`; all five lanes
  reported. §3 holds the merged, re-ranked findings (Q1-Q37), §4 the final
  Phase F lanes. The owner answered "Default and go": D1-D5 take their
  defaults (§7).
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
| 1 Coverage map, engine, spawned node (added at close-out, Q31) | E1 | The dim-1 engine command misses the node processes that the Python suites spawn (`pdf_adapt`, `pdf_build`, `gen_deck`), which is why the seed Q3 over-counted. Union their V8 output with the unit run | `NODE_V8_COVERAGE=$QE/v8py python3 -m unittest discover -s tests -t .` then `node $QE/engunion.js $QE/v8 $QE/v8py` (scratch script) | `eng-union.txt` | 20m |
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
  `location.hash` shows, breaks every shared link, and CI stays green. The
  unit tests use the sandbox and never navigate. (Close-out, E5: the app has
  no `hashchange` path at all, so only a FRESH navigation is testable; an
  in-tab paste is the behaviour gap Q30, not a test gap.)
- Fix: one e2e test that freshly navigates to a known `#s=` URL and asserts the deck
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

**Q3 - S3, C1 (was S2, C2; re-ranked at close-out). `pdfdeck.js` has 62%
branch coverage in the node unit run and 2 mutants.**
- Close-out correction (E1, E2): the seed measured node unit files only.
  `tests/test_pdf_deck_adapter.py` spawns node over `fromGenerated` and covers
  48, 52-57, 121-125 and 178 in CI. What remains uncovered anywhere is
  `legendDemo` with no chords (139-140, reachable from `(C3) G3`) and the
  missing-`ext` throw (161). V8 counts 31 functions in the file, not 12; 2
  carry mutants. The rows below are kept as the seed measured them.
- Evidence: `src/engine/pdfdeck.js:48`, `52-57`, `121-125`, `139-140`,
  `161-162` and `178` are uncovered by node unit files.
- All of these lines are in the GENERATED-deck adapter, `fromGenerated`
  (`:143`), and its helpers. `fromBuiltin` (`:219-286`) is fully covered by
  `tests/pdf_builtin.test.js` (PR 139 review B1). The uncovered branches:
  - `bankers` rounding: the round-up branches (48, 52) and the exact tie
    (53-57);
  - `legendLines` on a pan with a bottom shell (121-125);
  - `legendDemo` with no chords (139-140);
  - the missing-`geom.ext` throw (161-162);
  - the bottom-shell `sub` (178).
- Failure it permits: a generated deck with a bottom shell prints a wrong
  legend or subtitle. Or a rounding tie shifts a printed value by one unit.
  Or a missing `ext` fails silently instead of throwing. In each case no unit
  test sees it.
- Fix (narrowed at close-out): tests in `tests/pdfcards.test.js`, beside the
  existing `fromGenerated` harness (`:139`), for the two branches nothing runs:
  `legendDemo` on a chordless pan and the missing-`ext` throw.
- Verify: `node --test tests/pdf_builtin.test.js tests/pdfcards.test.js`

**Q4 - S3, C1 (was S2; re-ranked at close-out). `share.js` multi-byte UTF-8
paths are untested.**
- Close-out correction (E1): `NAME_RE` (`src/engine/core.js:265`) admits
  printable ASCII only, so the app never encodes a multi-byte name; the paths
  are reachable only from a hand-made link. The decode-side refusals still
  matter, so the fix stays, at S3.
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
- Fix: pass `{filename: <absolute path of index.html>, lineOffset}` (as `tools/engine_loader.js:61` does) per block. Test-only
  change.
- Verify: `node --test --experimental-test-coverage --test-coverage-include=index.html tests/app.test.js`
  reports index.html.

**Q7 - S3, C1-C2. 62 Python test methods assert inside a loop without
`subTest` (E3 recount; the seed said 60).**
- Evidence: e.g. `tests/test_deck_data.py:212`, `233`, `248`, `286` and
  `405`; `tests/test_fixture_integrity.py:91`; the helper loop in
  `tests/test_pdf_parity.py:212`;
  `tests/test_font_subset.py:47`.
- Failure it permits: the first failing card hides the rest, which slows
  diagnosis. No escape.
- Fix: wrap the loop body in `with self.subTest(...)`. Diagnosability only,
  not a style rewrite (N5).
- Verify: `python3 -m unittest tests.test_deck_data tests.test_fixture_integrity tests.test_font_subset`
  and CI's `suite health` job (not local, review R2)

**Q8 - S3, C1. `settle()` is a fixed timer used 27 times in e2e (E4
recount; the seed's 29 counted two comments at `:346` and `:808`).**
- **Caution (E4):** a `settle()` that precedes a NEGATIVE assertion (e2e
  `351`, `835`, `864`, `884`, `3958`, `5327`, `5363`) has no observable
  post-condition. Converting it to `waitFor` makes the assertion pass on its
  first poll. Leave those timed, or add a positive sentinel first (Q27's
  pattern).
- Evidence: `settle()` (`tests/helpers/cdp.js:161`) is a fixed 500ms timer,
  against 56 uses of `waitFor`. The "8 fixed sleeps" once listed here are
  not bare sleeps (PR 139 review nit):
  - `tests/e2e.test.js:126` and `5800` are condition-polling loops;
  - `161` and `5849` are timeout guards;
  - `5913` and `6002` are SIGKILL watchdogs;
  - `760` is a comment;
  - `5699` is a string inside a child script.

  Leave them alone.
- Failure it permits: a timing flake class (scale-engine rows 250, 255 and
  271), and wall-clock pressure toward the hang rows (162, 166, 167, 175 and
  196).
- Fix: replace each `settle()` call whose post-condition is observable
  with `waitFor`.
- Verify: each touched test by `--test-name-pattern`, then CI.

**Q9 - CLOSED (E4): infrastructure, not the repo.** The attempt-1 log shows a
runner TLS failure inside `actions/checkout`, before any repo code ran. Over
610 runs there were 8 re-attempts, none recurring after PR #54. The seed text
is kept below as filed.

**Q9 (as seeded) - S3, C1. An unexplained CI failure in data integrity.**
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
- Verify: for each header, `python3 -m unittest <args> 2>&1 | grep -E '^Ran [1-9][0-9]* tests?'`
  matches, and CI's mutation gate is green. (Close-out, E2: the seed's
  `-v | grep -c ' ok$'` undercounts, because `tests/test_deck_data.py` leaks
  a ResourceWarning that splits the `-v` line; 11 headers read 0 while each
  ran 1 test.) E2 also found that a header selecting ZERO tests already
  fails CI on its own (python 3.12+ exits 5; node reports a survivor); what
  CI cannot see is a WIDE header, so Q5 and Q32 carry the real risk.

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

### Phase E findings (close-out, 2026-09-25)

Each row was measured at `23c4962` by the lane named in its ID column. Every
S1/S2 row carries a mutant or a demo diff that CI does not catch today; the
diffs and demo scripts are kept in the lane artifacts (session scratchpad,
`qe/<lane>/`). "Survives" means it passes every node unit file, every Python
suite and `tools/validate.py`. Where a row says so, a grep also showed that
e2e never reads the mutated property. The full e2e suite and the full
mutation gate were not run locally (N9).

| ID | Src | Sev | Cost | Gap and evidence | Failure it permits | Fix | Lane |
|---|---|---|---|---|---|---|---|
| Q13 | E1-1 | S1 | C1 | `src/engine/pdfcards.js:429-432` (`cardWarnings`) and `:470-475` (badge draw) run in no suite, node or Python-spawned. `return false;` in `cardWarnings` survives | `(C3) G3 D4 G4 D5` prints with no "NO 3RDS ON THIS PAN" badge on its chord cards. The badge is the only place the warning survives in PRINTER_ONLY | Test in `tests/pdfcards.test.js`: build a no-thirds seed via `fromGenerated` plus `build`, and assert one badge per chord page. Add mutant `f1a_pdfcards_card_warning_dropped` | F1a |
| Q14 | E4-1 | S1 | C1 | Enter/Space on `#card` (`index.html:7506-7509`) is tested nowhere. A mutant that deadens the keys survives unit tests, and e2e never sends the key | Keyboard users cannot flip a card | e2e test: focus `#card`, Enter flips, Space flips back. Mutant `f2_card_key_flip_dead` | F2 |
| Q15 | E4-2, E1-2 | S1 | C1 | Pan Home/End/ArrowUp/ArrowDown (`index.html:7448-7463`), the Shift+Tab wrap in the sheet (`7472-7490`; the only Tab test, `tests/app.test.js:1984`, sends `shiftKey:false`) and scale-box Enter (`7470`) have no test. A Home/End swap mutant survives | Keyboard navigation of the pan and the Edit sheet breaks silently | Unit tests in `tests/app.test.js` beside `:1781` and `:1984`. Mutant `f6_pan_home_end_swapped` | F6 |
| Q16 | E3-1 | S1 | C1 | `tests/app.test.js:3279` takes the FIRST rule that sets a font size (`index.html:478`). An override `#scale-box{font-size:14px}` inside `@media (max-height:520px)` (`:580` block) survives | iOS auto-zooms the Edit sheet on short or landscape screens | Assert every rule that sets a size on those inputs, media blocks included. Mutant `f6_scale_box_font_override` | F6 |
| Q17 | E3-2 | S1 | C1 | The `render()` empty-order guard (`index.html:6369`) that CLAUDE.md "Known pitfalls" says to keep has no test. Deleting it survives; `e_boot_count` mutates `:6389`, not the guard | A zero-chord deck (Q23) throws a TypeError in the Generate handler. A zero-chord deck saved by an older build is restored at boot | Test: boot with a stored zero-chord scale, assert no throw. Mutant `f6_render_empty_order_guard` | F6 |
| Q18 | E2-1 | S2 | C1 | Nothing pins the output of `checksum` (`src/engine/share.js:201-211`). Every test is a round trip (`tests/app.test.js:968,1058,1189,1958`). Changing `<< 16` to `<< 15` at `:207` survives | Any hash change keeps round trips green and refuses every link shared before it as corrupt | Pin `checksum("")` and one known text, and decode one golden `#s=` payload captured at `23c4962`. Mutant `f1b_share_checksum_shift` | F1b |
| Q19 | E5-3 | S2 | C1 | The `writeScales` try/catch (`index.html:5638`) is the only catch between `rememberScale`/`replaceScale` and a throwing `setItem`. The only `throwOnStorage` test (`tests/app.test.js:340`) never generates. Dropping the catch survives | With storage denied (private mode, quota), Generate throws after the sheet closes, the new deck is not selected, and `#scale-generate` stays disabled for the session | Test: boot with `throwOnStorage`, generate, share, delete. Assert the deck is selected and Generate is re-enabled. Mutant `f6_write_scales_catch_dropped` | F6 |
| Q20 | E2-2 | S2 | C1 | Number-line colour on client-side PDF cards (`src/engine/pdfcards.js:274`). `setFillColor(GREEN)` for every number survives, and `test_pdf_parity` does not see fill colour on this path | Verified convention 2 breaks on every browser-built PDF: no root-coloured number | Assert, for one card, the fill op before each number glyph. Mutant `f1a_pdfcards_numline_uncoloured` | F1a |
| Q21 | E2-3 | S2 | C1 | The minor-parent "between two degrees" branch of `numeral` (`src/engine/naming.js:144`) is unasserted. `#` below changed to `b` above survives | Generated minor-key decks label offsets 1/4/6/9/11 flat-of-above (C minor offset 6 reads bV, not #iv) on card headers and in the app | `numeral(6, true)` gives `{accidental:"#", roman:"iv"}`, plus the major counterpart. Mutant `f1b_numeral_minor_flat` | F1b |
| Q22 | E2-4 | S2 | C1 | The symmetric-root tie-break in `collapse` (`src/engine/select.js:226`) is untested for 2-member groups. `> 1` changed to `> 2` survives | An aug/dim7 card with 2 same-quality survivors takes its root from rank order: wrong root name and root highlighting | A `collapse` case where rank order and the tie-break disagree. Mutant `f1b_collapse_two_root_symmetric` | F1b |
| Q23 | E5-1 | S2 | C2 | `parseSeed`'s NO_FIFTH check (`src/engine/core.js:429-440`) passes on a fifth that involves the ding, and the ding never voices, so the build is `ok` with `chords: []`. Fuzz: 91 of 619 ok pans have 0 chords, e.g. `(F3) C4 Ab4 Bb4`. Reproduced at close-out | GENERATE says "0 cards generated", selects the new chip, but keeps showing the previous deck's card and counter. Next computes `idx = NaN` (`step()` `:7494`, `% 0`). The deck is saved, and after a reload the card is blank | App-side refusal in `generateDeck` (`index.html:5551`) when the build has no chords, with UI copy and no new engine code (D7). Test in `tests/app.test.js`. Mutant `f6_zero_chord_refusal_dropped` | F6 |
| Q24 | E5-2 | S2 | C2 | The app `pan()` ring and accent constants (band 0.87r and 0.24r at `index.html:5829`, hairline 0.74r `:5830`, octave 0.66 `:5837`, grey `#8a8a8a` `:5860`, orange `:5863`/`:5880`) are pinned only by the app's own digest (`tests/app.test.js:2821`). `tests/test_render_agreement.py:120-133` compares field state, position, radius and label sizes only. Changing 0.24 to 0.20 in `hifi.py` and `pdfcards.js` together passes everything | A print-side restyle ships with the screen and the printed card drawn differently, CI green. The comment at `tests/app.test.js:2792-2794` claims otherwise | Extend `render_app`/`render_print` to extract band r/R, band width/r and hairline r/R per lit field, and to compare the bottom-number and badge fill against `hifi.ORANGE`. Mutant `f7_app_band_width`. The misleading comment is F6's | F7 |
| Q25 | E2-5 | S3 | C1 | `readOptions` name trim (`src/engine/core.js:294`) is unasserted; removing it survives | " My Pan " is stored padded, so one pan gets two names | `readOptions({name:"  A  "}).value.name === "A"`. Mutant `f1b_read_options_trim_dropped` | F1b |
| Q26 | E3-3 | S3 | C1 | No test reads an app font family (`grep -a "font-family" tests/*` finds 0). `.bigname` Marcellus changed to Georgia (`index.html:358`) survives | The app's typefaces drift from print (visual-system constraint); cosmetic | Assert `.bigname`, `.notesline`, `.numline` and `body` name Marcellus, Bitter and Nunito Sans. Mutant `f6_bigname_font` | F6 |
| Q27 | E4-3 | S3 | C1 | The negative swipe test (`tests/e2e.test.js:435`; `expectCount` at `443`/`446`) passes on its first poll, because touch listeners are passive (`index.html:7540-7545`). This is the likely cause of the scale-engine row 325 flake (hypothesis) | A dead-zone regression is invisible, and the mutant `e_swipe_deadzone_dropped` flakes | Positive sentinel: press `#next`, expect `2 / n`, then run the negative check | F2 |
| Q28 | E1-4 | S3 | C1 | The fontdata DESYNC branch of `validate.py` check 5 (`tools/inline_fonts.py:155-159`, `tools/validate.py:112`) has never been shown red. No mutant touches the fontdata | A font desync check that could never fail looks the same as one that works | Mutant `f4_fontdata_psname_desync` (edits a psname), killed by `test_font_subset` committed_module | F4 |
| Q29 | E5-5 | S3 | C1 | iOS Smart Punctuation turns the apostrophe in "RAY'S PAN" into U+2019. `NAME_RE` (`src/engine/core.js:265`) then refuses the name with the note-error sentence "RAY'S PAN is not a note". Reproduced at close-out. The BAD_NOTE mapping itself is scale-engine row 18 | Typing a name with an apostrophe on an iPhone is refused with a misleading message | Normalise U+2018/2019/201C/201D to ASCII in `sheetOptions` (`index.html:6805`). Test with U+2019 | F6 |
| Q30 | E5-4 | S3 | C1 | No `hashchange` listener. The share hash is read once at boot (`index.html:7573-7574`); `popstate` (`:7234`) only closes the sheet | Pasting a `#s=` link into the open app tab does nothing | New behaviour: owner decision D6. Default: no change | deferred |
| Q31 | E1-3 | S3 | C1 | The §2 engine coverage command misses node processes spawned by Python, which inflated the seed Q3 | Coverage misread | Method row added to §2. No code change | done (§2) |
| Q32 | E2-6 | S4 | C1 | Headers that select more than one test, or run no test runner, beyond Q5: `e_pdfdeck_r_half_up` (4), `g_pdfcards_a4_rescales` (11), `p_footer_prints_over_the_card_sheet` (7), `h_run_node_file_missing_node_raises` (2), `m_boot_sim_total_only_guard` (`node tools/boot_sim.js`, 0 counted), `e_sheet_ctlrow_pinned_again` (matches e2e `:4679` and `:5105`); `i_`..`o_` pdfcards headers select 2 | A wide header hides a dead named test | Narrow each header to its killing test (E2's `header-selection.tsv` names them; anchor e2e patterns with `^`) | F5 |
| Q33 | E2-7 | S4 | C1 | `run_suite` word-splits `$*` under `shopt -s nullglob` (`tests/mutation_check.sh:30,78`), so a header word with `*`, `?` or `[` that matches no file disappears. No header uses one today | A future `a.*b` pattern silently runs the whole file | `set -f` scoped to `run_suite` | F5 |
| Q34 | E3-4 | S4 | C1 | Nine convention groups have no killing mutant (CONTRACT rule 3), though each group's tests kill a hand probe: Bb/Db bottom-only, Pygmy two registers, F natural minor, D11 Amara order, print fonts, single-colour frame, orange accent, CARD_WARNINGS (Q13 covers it), English-only copy | None shown | Promote the probes to patches. The data ones are data-lane work (sync plus b_* regen) | deferred |
| Q35 | E3-5 | S4 | C1 | Hygiene: `tests/share.test.js:37` `NOT_OK_ROWS` has no non-empty guard (the `:308`/`:431` loops would pass vacuously); `tests/test_suite_health.py:467` fixed sleep; `tests/test_gen_deck.py:335-337` messageless assert; `tests/test_font_subset.py:69` asserts by exception; `tests/e2e.test.js:146` `stored()` swallows. `tests/share.test.js` contains NUL bytes, so audits need `grep -a` | Diagnosability only | The `NOT_OK_ROWS` guard goes to F1b (it owns the file). The rest are deferred | F1b / deferred |
| Q36 | E5-6 | S4 | C1 | `pdfFileName` (`index.html:6268`) turns the legal name "!!!" into `_Cards_Letter.pdf` | Cosmetic file name | Extends scale-engine rows 314/316/319. Deferred there | deferred |
| Q37 | E1-5 | S4 | - | Dead code: `tools/hifi.py:524-541` `back_card`, `clearPanPreview` (`index.html:6865`; its caller `:6922` is unreachable), the `zoneBlock` fallback (`:6687`), `naming.js:147-148`, `pdf.js:170-184` `Page.arc`. E5 found exactly 7 unreachable app functions (Q12 plus scale-engine row 333) and no new ones | None | D3: leave it | deferred (D3) |

**Re-ranked Phase F scope** (§1: S1, S2 and cheap S3):

- S1: Q1, Q13, Q14, Q15, Q16, Q17.
- S2: Q18-Q24.
- Cheap S3: Q3, Q4, Q5, Q6, Q7, Q8, Q10, Q25-Q29.
- Cheap S4 folded into lanes that already own the files: Q32, Q33, and Q35's
  first item.
- Deferred:
  - Q2 (S3 C2; no mutant has survived yet);
  - Q30 (D6);
  - Q34, Q36 and Q37;
  - Q11 and Q12 (D5, D3).
- Closed: Q9 (infrastructure).

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

### Phase F (final at close-out, one worktree per lane)

Every lane adds its mutants under its own filename prefix (`f1a_`, `f1b_`,
`f2_`, `f4_`, `f6_`, `f7_`), and owns exactly the `tests/suite_health.py`
FLOORS rows of the test files it owns. Every new mutant's header selects
exactly one test (anchored patterns; Python counted with `^Ran N tests`, Q10)
and is killed at CI's head SHA.

| Lane | Owns | Never touches | Rows | Acceptance | Verify |
|---|---|---|---|---|---|
| F3 harness diagnosability | `tests/helpers/sandbox.js`, `.gitignore` (the `.quality-eval/` line) | the tests themselves | Q6 | `--test-coverage-include=index.html` reports app lines. All app/preview/pdf_builtin tests pass unchanged | `node --test --experimental-test-coverage --test-coverage-include=index.html tests/app.test.js`; `node --test tests/app.test.js tests/preview.test.js tests/pdf_builtin.test.js` |
| F1a PDF-card tests | `tests/pdfcards.test.js`, `tests/pdf_builtin.test.js`, new `tests/mutants/f1a_*.patch`, their FLOORS rows | `src/engine/*`, `index.html` (a real bug gets its own row and an owner ask) | Q13, Q20, Q3 | Q13's badge test and Q20's number-line colour test each fail under their mutant and pass on HEAD. Q3's two branch tests each name the mis-mapping they catch (no coverage-% gate, N6) | `node --test tests/pdfcards.test.js tests/pdf_builtin.test.js`; per mutant, `git apply tests/mutants/<m>.patch && python3 tools/inline_engine.py && <header cmd>` must fail, then `git checkout -- .` |
| F1b engine logic tests | `tests/share.test.js`, `tests/naming.test.js`, `tests/select.test.js`, `tests/core.test.js`, new `tests/mutants/f1b_*.patch`, their FLOORS rows | `src/engine/*`, `index.html` | Q18, Q21, Q22, Q25, Q4, Q35 (the `NOT_OK_ROWS` guard only) | Each test fails under its mutant. The golden `#s=` payload is a literal captured at `23c4962`, not one the test computes | `node --test tests/share.test.js tests/naming.test.js tests/select.test.js tests/core.test.js`; per mutant as F1a |
| F2 e2e | `tests/e2e.test.js`, `tests/helpers/cdp.js`, new `tests/mutants/f2_*.patch`, the e2e FLOORS row | `index.html`, the other test files | Q1, Q14, Q27, Q8 | Q1: a fresh navigation to a `#s=` URL at 380px shows the deck name, the chord count and a lit field, and its boot-drop mutant is killed. Q14: an Enter/Space flip test, with its mutant. Q27: a positive sentinel before the negative swipe check. Q8: each converted `settle()` waits on an observable condition; the seven before negative assertions (Q8 caution) stay timed or gain a sentinel | `CHROME_BIN=... node --test --test-name-pattern='<each touched name>' tests/e2e.test.js`. The full suite runs in CI only (N9) |
| F6 app fixes and app tests | the `index.html` app script (outside every generated region), `tests/app.test.js`, new `tests/mutants/f6_*.patch`, the app FLOORS row | engine regions, the `const DECKS` line, CSS, markup, `src/engine/*` | Q15, Q16, Q17, Q19, Q23, Q26, Q29, the comment at `tests/app.test.js:2792-2794` (Q24) | Q23: GENERATE on `(F3) C4 Ab4 Bb4` refuses with a message, keeps the current selection and saves nothing. Q29: a name containing U+2019 saves. Q17: a boot with a stored zero-chord scale does not throw. Every other row is a test that fails under its mutant. `tools/validate.py` stays clean | `node --test tests/app.test.js tests/preview.test.js`; `python3 tools/validate.py`; `python3 tools/inline_engine.py --check`; `python3 tools/sync_decks.py --check` |
| F4 Python test hygiene | `tests/test_pdf_build.py`, `tests/test_gen_deck.py`, `tests/test_deck_data.py`, `tests/test_fixture_integrity.py`, `tests/test_font_subset.py`, `tests/test_pdf_parity.py` (the `:212` helper only), the headers of the 11 `c_gen_*`/`c_blurb_*` mutants, new `tests/mutants/f4_*.patch` | `tools/*`, `data/*`, the committed PDFs | Q7, Q10, Q28 | The bridge is gone. The 11 headers name `tests.test_gen_deck` and each prints `Ran N tests` with N >= 1. The loop-asserts use `subTest`. Test counts are unchanged. Q28's mutant is killed | `python3 -m unittest discover -s tests -t .`; per header, `python3 -m unittest <args> 2>&1 \| grep -E '^Ran [1-9]'`. `suite_health` is read from CI (R2) |
| F7 render agreement | `tests/test_render_agreement.py`, new `tests/mutants/f7_*.patch`, its FLOORS row | `index.html`, `tools/*`, `src/engine/*` | Q24 | For every lit field, band r/R, band width/r and hairline r/R agree between the app SVG and the print recording. The bottom-number and badge fill equal `hifi.ORANGE`. E5's print-pair drift (0.24 to 0.20 in both print renderers) turns the file red | `python3 -m unittest tests.test_render_agreement`; with the drift diff applied it must fail |
| F5 mutant headers | the headers of Q5's six patches and Q32's patches; `tests/mutation_check.sh` (`run_suite` only) | patch bodies, the tests | Q5, Q32, Q33 | Each header selects exactly one test, and its mutant is still killed. Counts are re-checked AFTER F1a, F2 and F6 merge, because each adds tests to a file a Q5/Q32 header selects from (`pdfcards.test.js`, `e2e.test.js`, `app.test.js`). A glob word in a header survives `run_suite` | Per header: node `--test-reporter=tap <args> \| grep -c '^ok'` equals 1, and Python prints `Ran 1 test`. CI mutation gate green |

Every F lane has these non-goals:

- N1-N10;
- no fix outside its "Owns" column;
- no weakening of a floor or a mutant;
- no edit inside a generated region. Change the module and re-run the sync
  tool instead.

## §5 Order and dependencies

| Step | Runs | Depends on |
|---|---|---|
| 1 | E1-E5 in parallel | base `31c1203`, run at `23c4962`. DONE |
| 2 | E close-out, re-rank, /plan-eng-review | all E lanes. This commit |
| 3 | F3 alone. It is C1 and makes the F1a, F1b and F6 coverage checks direct | step 2 merged |
| 4 | F1a, F1b, F2 and F6 in parallel (cap 4). File ownership is disjoint | F3 merged |
| 5 | F4 and F7 as slots free; F5 last, after F1a, F2 and F6 merge | step 4 slots |

**Collision note.** Each lane adds mutants only under its own prefix, and F5
edits only existing headers. Every lane edits only its own FLOORS rows in
`tests/suite_health.py` (one row per file). If two edits still conflict
textually, the later lane rebases.

**Stale mutants.** `tests/mutation_check.sh:220` counts a patch that no
longer applies as a survivor. F6 edits the app script, so it may stale an
existing mutant or an `f2_*` patch anchored on the same lines. F6 owns
refreshing the CONTEXT lines of any existing patch its edit stales (same
mutation, same header). A lane that merges after F6 re-runs
`git apply --check` on its own patches after rebasing.

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

## §7 Owner decisions

D1-D5 were answered "Default and go" (owner, 2026-09-25): every default
below is now the decision. D6 and D7 arose at close-out and were auto-decided
under the AFK grant; the owner can overturn either before its lane merges.

| # | Decision | Decision taken |
|---|---|---|
| D1 | Retire Python from CI once the JS engine and PDF path fully replace `hifi.py` as the oracle? Python currently holds 77 mutant headers, `render_agreement` and `pdf_parity` | Keep it. Out of scope here (N7) |
| D2 | Must every test named in CLAUDE.md as an invariant carry its own killing mutant, beyond CONTRACT rule 3's per-group requirement? Overlaps scale-engine row 301 | Per group only. E3 lists the gaps |
| D3 | Delete the dead code (`shareLink` at `index.html:5608`, the `openPrintSheet` chain in scale-engine row 333), or wire it to the UI? | Leave it. F6 skips it |
| D4 | Gitignore `.quality-eval/` (F3), or keep artifacts in the scratchpad only? | Gitignore it. This is a one-line change |
| D5 | Unify the label constants (Q11) into one source read by the app? This touches the app/print parity surface | No change. The parity tests already pin them |
| D6 | Add a `hashchange` listener so a `#s=` link opened in an already-open tab boots the shared deck (Q30)? | No change. Q1 tests fresh navigation only; Q30 stays deferred (auto-decided, AFK) |
| D7 | Where does Q23's zero-chord refusal live? | App-side, in `generateDeck` (`index.html:5551`), with UI copy. No new engine error code (auto-decided, AFK: smallest fix, stays inside F6's ownership) |

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
| R9 | PR 139 review B1: Q3 blamed `fromBuiltin`; the uncovered lines are `fromGenerated` | Rewrite Q3; F1 owns `tests/pdfcards.test.js`. Nits: Q8 restated around `settle()`, Q7 citation, Q6 absolute path, F5 names its 4 patches, F6 owns its FLOORS row | fresh reviewer, applied |

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
then F1, F2, F4 and F5, then F6 (§5; superseded at close-out, see below).

**Implementation tasks:** the Phase E lanes in §4, as amended here.

**Completion summary:**

- 9 findings, 9 fixed in the plan (R9 from the PR 139 reviewer);
- 0 critical gaps;
- 5 owner decisions carried (D1-D5);
- outside voice: codex, 7 of 7 accepted.

## Close-out review (/plan-eng-review, 2026-09-25)

Scope: the re-rank in §3 (Q13-Q37) and the final Phase F lanes in §4/§5.

| # | Finding | Decision | By |
|---|---|---|---|
| R10 | F1 as seeded owned 5 test files plus 10 rows, and its mutants spanned the PDF-card and share engines | Split into F1a (PDF cards) and F1b (share, naming, select, core); file sets disjoint | auto-decided (AFK) |
| R11 | Q24 (app ring constants) sat in no lane; `test_render_agreement.py` was unowned | New lane F7 owns it and its FLOORS row. The misleading comment at `tests/app.test.js:2792-2794` goes to F6, which owns that file | auto-decided (AFK) |
| R12 | F6 edits the app script, and a patch that no longer applies counts as a survivor (`tests/mutation_check.sh:220`) | F6 owns refreshing the context lines of any patch it stales; later lanes re-run `git apply --check` after rebasing (§5 note) | auto-decided (AFK) |
| R13 | F5 was ordered after F1a only, but Q5/Q32 headers also select from `app.test.js` (F6) and `e2e.test.js` (F2); a new matching test would widen them again | F5 runs last, after F1a, F2 and F6 | auto-decided (AFK) |
| R14 | F6 was gated behind F1-F5 in the seed order, but its files are disjoint from theirs | F6 runs in step 4 alongside F1a, F1b and F2 (cap 4) | auto-decided (AFK) |

**Approval readiness:** ready. D1-D5 are owner-accepted; D6 and D7 are
auto-decided and recorded in §7.

**Completion summary:** 5 findings, 5 applied; 0 critical gaps; 2 new
decisions (D6, D7).

## GSTACK REVIEW REPORT

| Review | Trigger | Runs | Status | Findings |
|---|---|---|---|---|
| Eng Review | /plan-eng-review | 2 | CLEAR (run 1: 8 auto-decided under the AFK grant, R9 from the PR reviewer; run 2, close-out: R10-R14 auto-decided) | 14 found, 14 applied |
| Outside Voice | codex exec | 1 | issues_found, all accepted | 7 |

NO UNRESOLVED DECISIONS
