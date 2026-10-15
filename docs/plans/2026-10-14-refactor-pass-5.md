# Refactor pass 5: code base and tests, no regressions

SHA read: `2e25d38` (main, "Merge pull request #307 from raywu/claude/remove-degrees-docs"). The plan was drafted on branch `claude/refactor-pass-5-plan`, whose base is that commit plus the prompt file `docs/plans/2026-10-14-refactor-pass-5-prompt.md`. Every measurement below was taken against `2e25d38`. "Scratch" means `/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/3347d7d0-1ec9-4967-bd81-dd4cf98e29d7/scratchpad` (shortened to `$S`). Nothing there is in the repo.

The short version is that the measurements found very little that clears the bar:

- No file or function in `index.html`, `src/engine/` or `tools/` meets the 5-of-60 churn bar. The highest function count is 3.
- No single mutant was re-anchored on 3 of the last 20 merged PRs. The highest is 2.
- No fixed wait of 30 s or more lies on CI's critical path.
- In the last 60 `validate` runs, no run was rerun at the same SHA, so there is no flake evidence.
- One hidden defect is shown by a test that is RED at `2e25d38`: the python forced-cluster oracle gives a different verdict on the same deck when its field map is reordered.

So this plan has one DO lane and the reconcile lane.

## 0. The request

Owner request, 2026-10-14, verbatim:

> "Design a prompt to evaluate our code base and tests - identify where we should refactor and improve. Must not introduce any regression. Output a plan from the investigation. Iterate the prompt to produce 10/10 quality plan."

Deliverables (from the prompt's "The request, read precisely"):

1. **Where to refactor.** These are behaviour-preserving changes that a measured cost justifies. They are the section 5 rows of class REFACTOR or HARNESS. None reaches DO; see sections 5 and 11.
2. **Where to improve the tests.** These are the section 5 rows of class TEST-STRENGTHEN, TEST-DEDUP, TEST-SPEED and TEST-FLAKE, plus the strength sample in section 4.6. One row reaches DO: P5-1, lane `oracle`.
3. **No regression.** Section 3 is binding on every lane. Each lane's pinning tests are in section 6, and its risk register entry is in section 12.

### 0.1 Facts in the prompt that the code contradicts

I re-measured every prompt fact at `2e25d38`.

- **Contradicted: none of the prompt's measured facts.**
- **Stale docs the prompt asks to be listed.** These are claims in the repo, not prompt facts:
  1. `tests/CONTRACT.md` rule 4 ("A mutant's diff body is GENERATED"). It says to produce the body by running `git diff` and "paste the result". Followed literally, that pastes the `index <pre>..<post>` line. The test "no mutant patch carries a blob header it cannot keep true" in `tests/mutation_harness.test.js` rejects that line. The rule is stale: strip the `index` line. This plan's lanes do so.
  2. `tests/CONTRACT.md`, under "Verified data facts", says "the six committed PDFs". Only three `*_CHORD_ONLY_Letter.pdf` are committed (`ls *.pdf` gives 3), and CLAUDE.md says the same: "the three committed print outputs". This was found during the investigation and is not in the prompt.
- **Facts confirmed, with the measured value where it differs in precision:**
  - Sizes (`wc -l`): `index.html` 11211, `tests/e2e.test.js` 12322, `tests/app.test.js` 9266, `tests/sequence.test.js` 2438, `src/engine/sequence.js` 1141, `src/engine/core.js` 958, `tools/sandbox.js` 680, `src/engine/pdfcards.js` 659, `tools/hifi.py` 604. All exact.
  - The corpus holds 941 patches (`ls tests/mutants | wc -l`). README.md line 154 says 939 (`grep -n 'mutant patches' README.md`). CI's four shard reports at `2e25d38` list 941 in all.
  - Run 38645736393 wall time is 620 s, which is 10 min 20 s (22:10:17 to 22:20:37). The prompt says "about 10.5 minutes", which is within rounding.
  - `js suites` ran 535 s (8 min 55 s).
  - Shard run times: shard 1 is 608 s, shard 2 is 598 s, shard 4 is 567 s and shard 3 is 329 s. `python suites` ran 62 s.
  - Shards 1, 2 and 4 end within 42 s of each other (22:19:44 to 22:20:26).
  - Job dependencies: `suite health` needs `[python-tests, js-tests]` and `mutation gate` needs `mutation-gate-shard` (`grep -n 'needs:' .github/workflows/validate.yml`).
  - The window base is `85d9114` (`git log -60 --no-merges --format=%h 2e25d38 -- index.html src tools tests | tail -1`).
  - Main's last 8 successful runs have a median of 617.5 s, which is 10 min 17.5 s. The range is 529 s to 637 s (8 min 49 s to 10 min 37 s).
  - Six mutants patch `tests/mutation_check.sh`: the five `h_*` patches plus `qe_harness_mutant_scored_survived.patch`.
  - `tests/helpers/cdp.js` `findBrowser` has no macOS path.
  - The five skip-line prefixes are as the prompt states.
  - TODOS.md has ten `##` sections.
  - Coverage run 38691626201 succeeded, and its `coverage-report` artifact was used.

## 1. Goal

Make the python forced-cluster oracle (`VoicingTest._check_cluster` in `tests/test_deck_data.py`) independent of the order of a deck's `fields` map. Done means a new test, `test_forced_cluster_oracle_ignores_field_order`, is RED at `2e25d38` and green at the lane's head. Then set the README mutant count and every FLOORS row from main's CI artifacts after the last merge. Both lanes must keep the six regression-evidence steps of section 3 green.

## 2. Non-goals

- No feature work.
- Nothing from CLAUDE.md's "Ideas, NOT committed roadmap" list is planned. This plan does not name those ideas.
- No change to deck data (`data/decks.json`, the `const DECKS` line), diagram geometry, palettes, fonts or card anatomy.
- No change to the single-file architecture. That means no `<script src>`, no build step and no new sync step. Nothing is edited by hand inside an engine region or the `DECKS` line.
- The full-deck PDF path in `hifi.build` is not removed; it is kept by decision.
- No deploy, and no change to CI's required checks.
- No rendered-layout change at 380 px. No CSS or markup diff is planned in any lane.
- No production-code edit. Neither lane touches `index.html`, `src/engine/*.js`, `tools/*.py` or `tools/*.js`.
- Nothing classed DEFER, DROP or owner-gated in sections 5, 10 and 11 is done in this pass.
- No rename of any test. No deletion of any test. No FLOORS row is lowered.

## 3. Regression evidence (binding on every lane, in this order)

Copied from the prompt; binding:

1. **Byte-identical generated outputs.**
   - `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` are green.
   - `data/decks.json` is untouched.
   - The three committed `*_CHORD_ONLY_Letter.pdf` are unchanged by extracted text (`tests/test_pdf_build.py`, `test_committed_pdfs_match_a_fresh_build`).
   - Every committed fixture under `tests/fixtures/` is unchanged, unless the lane's goal is that fixture's generator. In that case the fixture is regenerated in the same commit, with the diff shown empty or explained.
2. `tests/test_render_agreement.py` is green over all 177 cards.
3. **Pinning tests.** The pinning tests named in the lane are green on `main` before the change and on the head after. Every new test is shown RED against a deliberate break, committed as a mutant patch in `tests/mutants/` whose `# kills:` names it. This follows `tests/CONTRACT.md` rule 3: every test group needs a killing mutant. So the corpus rises by at least one per new test group.
4. **Mutation gate.**
   - The mutation gate is green at the head SHA.
   - The corpus count does not fall.
   - A mutant whose target code is removed is re-pointed or replaced one-for-one in the same commit.
   - `python3 tools/refresh_mutants.py --check` is green.
5. **Suite health.** `tests/suite_health.py` is green at the lane's head. A lane lowers only its own test files' FLOORS rows, by exactly the count it removed as DUPLICATE or TAUTOLOGY, with each removal listed. Only the reconcile lane raises rows.
6. **CI.** CI's `validate` run at the PR's head SHA concluded success. A local green is a smoke test only.

Rules on tests:

- No lane deletes a test unless its candidate row classes it DUPLICATE (citing the surviving twin) or TAUTOLOGY (citing the STRONG test that replaces it). Every mutant whose `# kills:` names a deleted test is re-pointed to the twin or replacement in the same commit (`grep -l '<title>' tests/mutants/*`).
- No lane renames a test.
- No REFACTOR, HARNESS or DOCS lane edits the body of an existing test; it may only add tests.
- A TEST-STRENGTHEN, TEST-DEDUP, TEST-SPEED or TEST-FLAKE lane changes an existing assertion only to make it stricter or equivalent.
  - Stricter is shown by a committed mutant that the old assertion survives and the new one kills.
  - Equivalent is shown by every mutant naming that test still being killed at the head SHA.
- No lane edits inside an engine region or the `DECKS` line by hand.
- No lane changes rendered layout at 380 px, unless that is its stated goal and the owner approved it. That means no CSS or markup diff that the `panel fit` jobs or the e2e geometry assertions would see move.

## 4. Measurement appendix

All commands were run from `/Users/ray/Projects/handpan-cards/.claude/worktrees/refactor-5-plan` against `2e25d38`.

### 4.1 Churn (step 1)

Command:

```
git log -60 --no-merges --format= --name-only 2e25d38 -- index.html src tools tests | grep -v '^tests/mutants/' | grep . | sort | uniq -c | sort -rn | head -16
```

| file | commits of 60 |
|---|---|
| tests/suite_health.py | 13 (every one is a FLOORS-row-only edit, so it counts 0 under the exclusion rule) |
| tests/e2e.test.js | 11 (never a hotspot by its own churn) |
| tests/app.test.js | 9 (never a hotspot by its own churn) |
| index.html | 9 (only function counts qualify) |
| tests/drawer_seats.test.js | 3 |
| tools/sandbox.js, tests/share.test.js, tests/sequence.test.js, tests/select.test.js, tests/pdfcards.test.js, tests/drawer_drag.test.js | 2 each |
| tools/regen_card_fixture.js, tools/hifi.py, tests/voicing.test.js, tests/scale.test.js, tests/helpers/sequence_score.js | 1 each |
| any `src/engine/*.js` | 0 |

Window base: `git log -60 --no-merges --format=%h 2e25d38 -- index.html src tools tests | tail -1` gives `85d9114`.

Function churn. The prompt's command was run per function name of the `index.html` app block (indent empty) and of every `src/engine/*.js` module (indent two spaces), filtered to the 60 window commits:

```
git log --no-merges --format='COMMIT %h' -L '/^<indent>function <name>(/,/^<indent>}/:<file>' 85d9114^..HEAD | awk '/^COMMIT /{print $2}' | grep -cFf <(git log -60 --no-merges --format=%h -- index.html src tools tests)
```

Raw results are in `$S/appchurn.tsv` and `$S/engchurn.tsv`.

- `index.html` maximum is 3, shared by six functions: `sheetOptions`, `setSheetMode`, `runGenerate` (commits 1274d29, addc39f, aca11b1), `resetSheetState`, `openEditSheet` and `layoutNoticeText`.
- Next is 2, including `paintLayout`. `pan` is 0.
- Every `src/engine/` function is 0.
- **Hotspots (5 of 60 or more): none.** So the WEAK/TAUTOLOGY DO bar cannot apply to any test in this pass.

### 4.2 Size and shape (step 2)

The script is `$S/fnlen.js`. It matches `function name(` and `const name = (...) =>` at the given indent, takes length to the closing brace at the same indent, and takes depth as the maximum `{` nesting with strings stripped.

Commands:

```
N=25 node $S/fnlen.js index.html "" <app-block start> <app-block end>
N=25 node $S/fnlen.js src/engine/<module>.js "  "
```

**`index.html` app block, top 25 (lines):**

| function | lines |
|---|---|
| pan | 108 |
| runGenerate | 90 |
| render | 68 |
| generateDeck | 61 |
| syncParseState | 58 |
| downloadDeckPDF | 48 |
| resetSheetState | 45 |
| buildChips | 44 |
| applyKbOffset | 41 |
| paintLayout | 39 |
| disarmDelete | 39 |
| renderSeqRail | 36 |
| sizePanHits | 33 |
| sheetOptions | 30 |
| hideSheet | 30 |
| fallbackDeck | 29 |
| liftNote | 29 |
| railBuild | 28 |
| restoreScales | 27 (deepest nesting in the app block: depth 6) |
| deleteDeck | 27 |
| paintPan | 26 |
| selectDeck | 24 |
| release | 24 |
| activateNote | 23 |
| faceHTML | 22 |

**`src/engine/`, top 25:**

| function | lines |
|---|---|
| sequence.mediumEnumerate | 98 |
| layout.geometryAt | 84 |
| sequence.sampleMedium | 76 (deepest engine nesting: depth 6) |
| pdfcards.drawPan | 66 |
| core.tokenize | 66 |
| core.scaleInfer | 66 |
| select.build | 63 |
| core.validate | 63 |
| pdfdeck.fromGenerated | 61 |
| pdfcards.build | 61 |
| pdfdeck.fromBuiltin | 56 |
| voicing.choose | 55 |
| select.rank | 55 |
| select.voice | 53 |
| pdfcards.bottomLines | 53 |
| core.scaleStructure | 53 |
| share.decodeSeed | 50 |
| core.readOptions | 48 |
| core.parseSeed | 47 |
| sequence.tierContext | 45 |
| select.collapse | 44 |
| pdfcards.chordCard | 42 |
| sequence.basicLoops | 40 |

These are 23 named functions; the script's remaining two rows were regex artifacts (`select.anyField`/`nonDing` inner arrows) and are omitted.

Of the long functions, only `runGenerate` has any churn (3). Every other one has churn 0 or below 3.

### 4.3 Duplication (step 3)

**Label-ratio constants.** These are held three times: `tools/hifi.py` `LABEL_RATIO_*` and `NUM_RATIO`, `labelSize()` used by `pan()` in `index.html`, and `labelFloor` in `src/engine/layout.js`. They are pinned across renderers by `tests/test_render_agreement.py` (per-field drawn sizes, app against print), by `tests/test_print.py` `LabelSizeRuleTest`, and by `tests/layout.test.js`. A pinned cross-language copy is not a defect. A single source would be a generated constant, which is a new sync step and so owner-gated (G-1).

**App and print renderers.** These are `pan()` in `index.html`, `tools/hifi.py` and `src/engine/pdfcards.js`. They are pinned by `tests/test_render_agreement.py` (highlighting, tonefield positions and label sizes over all 177 cards) and `tests/test_pdf_parity.py` (the emitter held against hifi glyph for glyph). This is not a defect.

**Near-identical blocks of 10 or more lines.** The script `$S/dup.py` hashes every window of 10 stripped, non-comment lines and merges overlapping hits. Command:

```
python3 $S/dup.py index.html tests/e2e.test.js tests/app.test.js tests/drawer_drag.test.js tests/sequence.test.js tests/layout.test.js
```

| file | duplicate windows | distinct blocks | notes |
|---|---|---|---|
| index.html | 1 | 1 | a numeric metrics table at lines 1627 and 1741, which is data, not logic |
| tests/e2e.test.js | 11 | 4 | starting at 1886/1924, 2827/2923, 3578/3646 and 7760/7924; setViewport/eval scaffolding, each block under 20 lines |
| tests/sequence.test.js | 1 | 1 | a literal deck `fields` table, which is data |
| tests/app.test.js, tests/drawer_drag.test.js, tests/layout.test.js | 0 | 0 | |

### 4.4 Coverage (step 4)

Source: run 38691626201 (success), artifact `coverage-report`. It was downloaded with `gh run download 38691626201 -n coverage-report -D $S/cov`. Counts come from:

```
jq -r '.files|to_entries[]|[.key,(.value.zeroFunctions|length),(.value.browserOnly|length),(.value.uncovered|length)]|@tsv' $S/cov/coverage-report.json
```

**`index.html`:** 3 zero-execution functions, 20 browser-only functions and 101 uncovered ranges. The three zero functions are:

- `clearPanPreview`, at the `function clearPanPreview` declaration, called only on a placeholder failure;
- the `gestureCancel` arrow in the touch-drag press handler;
- the `springBack` `.finished.then(..., () => {})` rejection handler.

Pass 4's `-coverage` doc already classed all three as "LIVE, unexecuted branch". No input has changed since, so they are not re-opened.

**Engine uncovered ranges:**

| module | uncovered ranges |
|---|---|
| select.js | 12 |
| voicing.js | 9 |
| sequence.js | 7 |
| pdfcards.js | 6 |
| share.js | 5 (in `utf8String`) |
| core.js | 2 (in `validate`) |
| layout.js | 1 |
| pdf.js | 1 |

No engine function is a churn hotspot (4.1).

**Tools and helpers (zero functions / uncovered ranges):**

| file | zero functions | uncovered ranges |
|---|---|---|
| tools/sandbox.js | 22 | 24 |
| tools/coverage_merge.js | 6 | 65 |
| tests/helpers/cdp.js | 6 | 27 |
| tools/probe/panel_fit.js | 18 | 4 |
| tools/gen_deck.js | 1 | 19 |
| tools/regen_card_fixture.js | 1 | 14 |

**Never loaded** (`jq -r '.neverLoaded[]'`): `tools/boot_sim.js`, `tools/regen_pan_fixture.js`, `tests/helpers/engine.js` and `tests/helpers/sandbox.js`. The python side never loaded `tools/refresh_mutants.py` or `tools/regen_data_mutants.py`, and executed 1 of 9 defs in `tools/validate.py`. These may be run only as subprocesses, which the python tracer does not follow. That is not verified, so no claim is made.

**CSS:** `jq -r '.css.unused|length'` gives 8 unused rules: scrollbar pseudo-elements, `:active` rules, and `#scale-msg.err, .announce.err`, which pass 4 classed LIVE. The `@media print` rules were not exercised.

**Stubbed-DOM-only behaviour:** none newly found. The 20 `browserOnly` functions are, by definition, exercised in the real browser.

### 4.5 Test cost and stability (step 5)

**Job times, run 38645736393.** Command:

```
gh run view 38645736393 --json jobs -q '.jobs[]|[.databaseId,.name,.startedAt,.completedAt]|@tsv'
```

| job | start | end | duration |
|---|---|---|---|
| python suites | 22:10:18 | 22:11:20 | 62 s |
| panel fit (fallback) | 22:10:17 | 22:10:23 | 6 s |
| panel fit (real) | 22:10:17 | 22:10:23 | 6 s |
| data integrity | 22:10:18 | 22:10:36 | 18 s |
| js suites (unit + e2e) | 22:10:17 | 22:19:12 | 535 s |
| shard 1/4 | 22:10:18 | 22:20:26 | 608 s |
| shard 2/4 | 22:10:18 | 22:20:16 | 598 s |
| shard 3/4 | 22:10:18 | 22:15:47 | 329 s |
| shard 4/4 | 22:10:17 | 22:19:44 | 567 s |
| suite health | 22:19:14 | 22:19:21 | 7 s |
| mutation gate | 22:20:29 | 22:20:37 | 8 s |

The wall time is 620 s. The critical path is shard 1 followed by `mutation gate`. The next-slowest finishes are shard 2 (10 s earlier) and shard 4 (42 s earlier).

**Main's last 8 successful runs.** Command (run ids in `$S/main8.tsv`):

```
gh run list --workflow validate.yml --branch main --status success --limit 8 --json databaseId -q '.[].databaseId' | while read id; do gh run view $id --json jobs -q '[([.jobs[].startedAt]|min),([.jobs[].completedAt]|max)]|map(fromdate)|.[1]-.[0]'; done | sort -n
```

Result: 529, 603, 605, 615, 620, 622, 631, 637 s. The median is 617.5 s.

**Per-mutant shard time.** Each shard's job log was written with `gh run view 38645736393 --log --job <id> > $S/shard_<id>.log`, using job ids 116131997981 (shard 1), 116131997980 (shard 2), 116131998788 (shard 3) and 116131998058 (shard 4). They were then parsed with `python3 $S/shardtime.py <worktree> $S/shard_*.log` and `python3 $S/top.py $S/shard_*.log | sort -rn`.

| shard | mutants | seconds |
|---|---|---|
| 1 | 236 | 572 |
| 2 | 236 | 572 |
| 4 | 234 | 548 |
| 3 | 235 | 301 |

All 941 mutants were killed. The split in `tests/shard_mutants.js` is by **count** (two round-robin decks, e2e and non-e2e), **not by time**. That is pinned by the test "the N=4 shard partition balances e2e-selecting mutants within 1 per shard".

The slowest mutants, in seconds (each figure includes a first-seen suite baseline):

| mutant | seconds |
|---|---|
| dr1_landscape_scroll_padding | 108 |
| dr1g_focus_not_revealed | 106 |
| dr1g_padding_kept_with_field_focus | 106 |
| e_suite_health_unbounded | 63 |
| dr1g_toggle_not_in_view | 54 |
| sq_medium_sample_home_side_dropped | 49 |
| dr1g_stuck_under_44 | 46 |
| dr1g_threshold_off | 46 |
| dr1g_padding_kept_unstuck | 46 |
| dr2a_swap_second_seat_unchanged | 42 |
| dr2a_row8_names_a_place | 42 |
| sq_medium_sample_removed | 37 |
| h_probe_orphans_its_process_tree | 35 |

The `drawer_grid` "DR1 rule G" mutants run a full grid sweep. That is work, not a fixed wait. A time-balanced split would average about 523 s per shard, about 85 s under shard 1's 608 s. The saving is capped by `js suites` ending at 535 s, so the wall saving is about 60 to 75 s. It comes from no fixed wait, so it is DEFER (P5-2).

**Per-file local times, non-`E2E_FILES` suites.** The script is `$S/time_units.sh`, with `CHROME_BIN` set and the skip line grepped (0 skips in every row). Commands: `/usr/bin/time -p node --test tests/<file>.test.js` and `/usr/bin/time -p python3 -m unittest tests.<module>`. These are LOCAL figures.

| node suite | s | node suite | s |
|---|---|---|---|
| sequence | 50.11 | scale | 0.84 |
| mutation_harness | 25.22 | pdfcards | 0.43 |
| seat_sweeps_tap_edit | 19.17 | naming | 0.33 |
| seat_sweeps_tap_add | 18.59 | coverage_merge | 0.31 |
| app | 16.35 | preview | 0.31 |
| seat_sweeps_keys | 16.26 | core | 0.28 |
| layout | 3.08 | select | 0.24 |
| voicing | 0.15 | pdf_builtin | 0.20 |
| share | 0.14 | pdf | 0.11 |

| python suite | s | python suite | s |
|---|---|---|---|
| test_suite_health | 18.63 | test_deck_data | 1.73 |
| test_pdf_parity | 8.64 | test_pdf_deck_adapter | 1.42 |
| test_gen_deck | 3.67 | test_pdf_build | 1.23 |
| test_failure_diagnosability | 1.81 | test_icons | 0.57 |
| test_font_subset | 0.33 | test_render_agreement | 0.26 |
| test_pdf_emitter | 0.16 | test_print | 0.15 |
| test_readme_currency | 0.05 | test_fixture_integrity | 0.03 |

All of these suites run in the `js suites` or `python suites` jobs. Both end before shard 1, so none is on the critical path.

**E2E per-prefix local times:** not measured as main timings; see section 13. One LOCAL run of `--test-name-pattern '^SG: N-A' tests/e2e.test.js` took 4.42 s real for 7 tests (0 skip lines), but it ran under the 4.6 break patch, so it is not a main figure.

**Fixed waits.** Command (mutant patches excluded; full list in `$S/r5/waits.txt`):

```
grep -rn -E 'sleep|setTimeout|waitElapsed' tests --include='*.js' --include='*.py' --include='*.sh' | grep -v '^tests/mutants'
```

That gives 91 lines:

| file | lines |
|---|---|
| tests/e2e.test.js | 26 |
| tests/drawer_drag.test.js | 23 |
| tests/test_suite_health.py | 17 |
| tests/helpers/cdp.js | 12 |
| tests/harness.test.js | 11 |
| tests/mutation_harness.test.js | 2 (both in comments) |

Literal browser waits, from `grep -oE '(sleep|waitElapsed)\(\s*[0-9_]+'`:

| wait | count |
|---|---|
| `sleep(450)` | 1 |
| `waitElapsed(450)` | 1 |
| `sleep(320)` | 4 |
| `sleep(300)` | 1 |
| `waitElapsed(250)` | 3 |
| `sleep(220)` | 1 |
| `waitElapsed(220)` | 1 |
| `sleep(200)` | 1 |
| `waitElapsed(180)` | 1 |
| `waitElapsed(150)` | 1 |
| `sleep(100)` | 9 |
| `sleep(60)` | 1 |
| `sleep(50)` | 1 |
| `sleep(30)` | 1 |
| `sleep(8)` | 3 |
| `sleep(0)` | 5 |
| `waitElapsed(0)` | 1 |

Together they come to about 5.3 s per full pass.

The longer values are not paid in a green run, so they are not waits:

- `tests/harness.test.js` has 60000 ms and 15000 ms bail timers and `sleep 300` / `sleep 120` inside fake child scripts. These are kill bounds.
- `tests/test_suite_health.py` has `sleep 100` inside fake suites, which the reaper kills, and `time.sleep(0.05 to 0.3)` polls. That suite takes 18.6 s locally, in the `python suites` job, which is off the critical path.

**No fixed wait of 30 s or more lies on the critical path**, so no TEST-SPEED row can be DO.

**Flakes.** The last 60 `validate` runs (`$S/runs60.json`) were fetched with:

```
gh run list --workflow validate.yml --limit 60 --json databaseId,headSha,conclusion,attempt
```

- No run has `attempt > 1`.
- 57 succeeded and 3 failed, all on lane branches with no rerun at the same SHA:
  - 38595960786: `js suites`, a kills-header lint, at 7955330.
  - 38522608931: DR2b browser tests 43/44/45, at c55a7a8.
  - 38448758350: shards 1 and 2, where `d_registry_ignored` survived, at 4e9c5db.
- Each failure was fixed by a new commit. The data shows **0 flakes** and 0 lone-survivor gate flakes.

### 4.6 Test strength (step 6)

**Sample.** 40 tests were drawn at random with `random.seed(20261014)` (`python3 $S/samp2.py`) from all 1627 test titles. Those are the `test(`/`it(` titles in `tests/*.test.js` and the `def test_` names in `tests/test_*.py`. With no churn hotspots (4.1), the prompt's weighting toward hotspots had nothing to weight, so the sample is uniform. One test from the TODOS-flagged `labelShape` area was added (row 41).

**Classification.** STRONG by mutant means a committed mutant's `# kills:` names the test; CI killed all 941 at `2e25d38`. STRONG by reasoning means an exact-value or exact-absence assertion that fails on the named break.

| # | file | test | class | evidence |
|---|---|---|---|---|
| 1 | test_pdf_build.py | test_no_german_card_copy | STRONG | exact `[]` of German words over extracted PDF text; restoring any German subtitle fails |
| 2 | pdfcards.test.js | a no-thirds pan draws the NO 3RDS warning badge, in orange, on every chord card | STRONG | f1a_pdfcards_card_warning_dropped |
| 3 | app.test.js | DR2a (68, 122, 99, 18): closing the drawer, or a scale that stops parsing, ends the pick and keeps the swaps | STRONG | dr2a_close_drawer_keeps_pick |
| 4 | test_deck_data.py | test_bb_and_db_only_on_the_bottom_shell | STRONG | exact zone per Bb/Db field; moving one to the rim fails |
| 5 | test_render_agreement.py | test_border_weight_grows_by_the_same_relative_amount_in_both_renderers | STRONG | exact 2.8 / 3.2 weights in each renderer |
| 6 | app.test.js | typing the old inner mark shows the slash sentence | STRONG | strictEqual to `REASONS.BAD_NOTE.alternates.slash`; another alternate fails |
| 7 | layout.test.js | rule N: with no seats every column of every field is what main solved | STRONG | sha256 digest per scale, anchor and mirror combination |
| 8 | select.test.js | select_warnings matches on every ok row of synthetic_scales.json | STRONG | deepEqual of warning codes per fixture row |
| 9 | mutation_harness.test.js | the N=4 shard partition balances e2e-selecting mutants within 1 per shard | STRONG | spread at most 1; a flat `index%N` breaks it (the test's own comment) |
| 10 | e2e.test.js | DR1 line 34: the open plate band stays in the scrollport at the end of the body, and is static while the field has focus | STRONG | exact `position` values plus a scrollport bound |
| 11 | share.test.js | every option combination round-trips whole | STRONG | h_options_dropped |
| 12 | e2e.test.js | SG: N-A7 the crowded 24-note pan: the real SMALL_LABELS warning (two lines) opens Edit, a tapped anchor raises the notice, the warning yields and the three-row seed box stays readable at every keyboard | **WEAK** | shown in scratch; patch below. Killed by sg_warning_not_yielding_to_notice for the yield, but blind to the warning's return |
| 13 | e2e.test.js | print controls are never on a card face for a generated deck | STRONG | exact `false` for both faces. Not a DUPLICATE of "print controls are never on a card face, and the panel is not inside header/main/footer/card": different input (a generated deck) |
| 14 | naming.test.js | symmetricRoot prefers the tonic, else the lowest scale degree | STRONG | exact return values and a throw |
| 15 | e2e.test.js | with the box focused and the viewport shrunk, both the box and the primary stay on screen | STRONG | geometric bounds at 380x508 on Edit and Add |
| 16 | app.test.js | the boot rewrite leaves an unreadable record byte-identical at its index | STRONG | g2b_boot_rewrite_reorders |
| 17 | pdfcards.test.js | build writes a Letter box for letter and an A4 box for a4 | STRONG | exact MediaBox literals |
| 18 | harness.test.js | a browser that exits at once is not retried | STRONG | e_launch_retry_swallows_real_failure |
| 19 | e2e.test.js | the desktop sidebar at 1024x700 gains no new VERTICAL scroll from the Resources group, in modes A, B and S | STRONG | scroll-height bound per mode |
| 20 | layout.test.js | solve never changes a zone | STRONG | g_zone_rewritten |
| 21 | harness.test.js | settle() returns promptly when no animation is running | STRONG | qe_settle_ignores_quiet_animations |
| 22 | coverage_merge.test.js | scripts run without a filename are listed as unattributed and never counted for a shipped file | STRONG | exact unattributed listing; the whole-file suite runs under r4cov_* mutants |
| 23 | core.test.js | a name option is trimmed of leading and trailing whitespace (Q25) | STRONG | f1b_read_options_trim_dropped |
| 24 | app.test.js | a hit target reaches 44px, never undercuts its own note, and never laps a neighbour | STRONG | d_panhit_undercuts_its_note |
| 25 | test_fixture_integrity.py | test_shape_and_card_counts | STRONG | literal version 8, 5 decks and 177 cards |
| 26 | layout.test.js | odd rim notes sit right and even left at every count from 2 to 24, both anchors | STRONG | g_bottom_anchor_side_flipped |
| 27 | test_gen_deck.py | test_legacy_flag_reads_the_seed_with_the_legacy_reader | STRONG | g2b_gen_deck_legacy_flag_ignored |
| 28 | e2e.test.js | the paper choice survives a reload | STRONG | exact `"a4"` stored and restored |
| 29 | share.test.js | decode chooses its scale-line reader from the version | STRONG | g2b_link_version_ignored, l0_decode_bypasses_reader_seam |
| 30 | mutation_harness.test.js | every mutant patch applies to the tree it will run against | STRONG | mh_patch_context_drifted |
| 31 | test_suite_health.py | test_a_skipped_test_fails_even_when_the_total_meets_the_floor | STRONG | asserts a "skipped" problem; dropping the skip check fails |
| 32 | sequence.test.js | every sampled sequence is a MEDIUM sequence | STRONG | sq_medium_sample_unclassified |
| 33 | select.test.js | the 12-note pan is section 8's worked example: 29 raw candidates | STRONG | exact 29 |
| 34 | sequence.test.js | an over-budget pan fills every pure cell its anchors allow | STRONG | sq_medium_pure_cells_not_exact |
| 35 | e2e.test.js | card swipe: a short fast fling commits and a slow drag of the same length does not | STRONG | sw_fling_ignored, sw_fling_window_whole_gesture |
| 36 | e2e.test.js | the page is a modal dialog with the spec'd anatomy | STRONG | e_page_layer_transparent, e_sheet_no_max_height |
| 37 | test_suite_health.py | test_emit_js_exits_red_on_cancelled_with_zero_failed | STRONG | hc_collect_js_cancelled_ignored |
| 38 | core.test.js | R4-E a seed that is not a string is BAD_NOTE naming it, in both parsers | STRONG | r4e_core_parse_seed_string_reason_generic |
| 39 | test_print.py | test_hijaz_blurb_is_unchanged | STRONG | exact blurb strings |
| 40 | e2e.test.js | card swipe (wheel): a second gesture after the 160ms gap advances again | STRONG | sw_wheel_gap_too_long |
| 41 | layout.test.js | every name the app draws fits inside the field it labels | **WEAK** | shown in scratch; patch below. Bottom labels are modelled with the ding's shape (TODOS "layout.test.js infers every zone's label shape from one ding label") |

**Counts:** 41 sampled: 39 STRONG (21 by mutant: rows 2, 3, 11, 16, 18, 20, 21, 22, 23, 24, 26, 27, 29, 30, 32, 34, 35, 36, 37, 38, 40; 18 by reasoning: rows 1, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 17, 19, 25, 28, 31, 33, 39; counted from this table's evidence column), 2 WEAK, 0 TAUTOLOGY, 0 DUPLICATE. Neither WEAK test's subject is a hotspot: row 12's subject `paintLayout` has churn 2, and row 41's subject `pan` has churn 0. So both rows are DEFER (P5-4, P5-5).

**WEAK evidence 1 (row 12).** Setup: `git worktree add --detach $S/weak 2e25d38`, then apply the break below. The run was:

```
CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node --test --test-name-pattern '^SG' tests/e2e.test.js tests/app.test.js
```

Result: `tests 10, pass 10, fail 0, skipped 0`, with 0 `skipped: no Chromium binary found` lines. The narrower `'^SG: N-A'` run gave 7 of 7 passing with 0 skip lines. The worktree was then removed with `git worktree remove --force $S/weak`.

```
--- a/index.html
+++ b/index.html
@@ -9075,7 +9075,7 @@ function paintLayout() {
   const note = layoutNoticeText();
   if (layoutNote.textContent !== note) layoutNote.textContent = note;
   layoutNote.hidden = !note;
-  sheet.classList.toggle("noticed", !!note);
+  if (note) sheet.classList.add("noticed");
   syncBand();
 }
```

Under this patch, once the notice has shown, the pan warning stays hidden forever. That breaks CLAUDE.md's "returns when it clears", and no SG test notices.

**WEAK evidence 2 (row 41).** Same scratch procedure. The run was:

```
node --test --test-name-pattern 'every name the app draws fits inside the field it labels' tests/layout.test.js
```

Result: `tests 1, pass 1, fail 0`, with 0 skip lines; this is a non-browser file.

```
--- a/index.html
+++ b/index.html
@@ -8257,7 +8257,7 @@ function pan(d, ch, opts) {
     const [x, y] = P(orb, ang);
     s += panField(sets, C, x, y, rr, id, isB);
     const lit = blue.has(id) || green.has(id);
-    s += panLabel(x, y, name, oct, labelSize(rr, zone),
+    s += panLabel(x, isB ? y + rr*0.6 : y, name, oct, labelSize(rr, zone),
                isB && !lit ? "#8a8a8a" : "#242424");
     // numbers
```

This drops every bottom-shell label 0.6 r below its field centre, so the label leaves its circle. Under the same patch, `node --test tests/app.test.js tests/layout.test.js` failed 6 tests, but only through committed-digest change detectors, for example "the card render still matches the committed digest of every built-in card" and "DR1 line 40: the pan drawn with interactive off is byte-identical to the shipped output for all five built-in decks". `python3 -m unittest tests.test_render_agreement` stayed green. So the fit property itself is unguarded for the bottom zone.

**Hidden-defect evidence (P5-1, the DO bar).** Same scratch worktree. The deck came from:

```
node tools/gen_deck.js --legacy "(C3) G3 B3 D4 E4 G4 B4 | Bb2 B3 D4" > $S/oracle/deck.json
```

That gives fields `2` (rim B3, 59) and `102` (bottom B3, 59), `3` (rim D4, 62) and `103` (bottom D4, 62). The engine emits Em7 = `[4, 1, 2, 3]`, all top shell.

A scratch file, `tests/test_zz_oracle_order.py`, ran `VoicingTest.test_forced_tones_cluster_below_root` with the module's `decks` replaced by that deck, once in engine order and once with the bottom fields moved first:

```
python3 -m unittest tests.test_zz_oracle_order -v
test_top_first ... ok
FAIL: test_bottom_first
AssertionError: 55 not greater than 64 : ('unforced card: tone below the root', ('custom:96a087d8', 'Em7', [4, 1, 2, 3]), 1)
FAILED (failures=1)
```

With `key=lambda g: (midi(g), zone(g) != "bottom")` in `_check_cluster`, both cases and the whole of `tests.test_deck_data` passed: `Ran 29 tests ... OK`. The scratch file was deleted and the worktree removed.

### 4.7 Mutation-corpus drag (step 7)

Command (per-PR commit lists in `$S/pr20commits.tsv`, hits in `$S/pr20.tsv`):

```
for n in $(gh pr list --state merged --limit 20 --json number -q '.[].number'); do gh pr view $n --json commits -q '.commits[]|[.oid[0:7],.messageHeadline]|@tsv' | sed "s/^/$n\t/"; done | grep -iE 'refresh|context-stale|re-anchor'
```

The mutants touched by each hit were listed with `git show --stat <oid> -- tests/mutants`; the per-mutant table is in `$S/reanchor.tsv`.

Last 20 merged PRs: #288 to #307. Re-anchor commits landed on **6 of 20 PRs**:

| PR | commit | patches |
|---|---|---|
| #306 | bc80445 | 9 |
| #303 | 4b0f525 | 2 |
| #303 | 7955330 | 2 |
| #301 | 4b842b8 | 3 |
| #297 | f8d434c | 2 |
| #291 | 3f885be | 28 |
| #289 | b611ae5 | 4 |

#291 also has ae3dea4, "re-cut 25 patches", which the grep misses. Every PR that changed app source needed a refresh commit.

That makes 44 distinct mutants (67 counting ae3dea4). **No single mutant was re-anchored on 3 or more PRs.** The maximum is 2, shared by five mutants:

- s3_mirror_bottom_not_carried
- dr3_tab_list_omits_disclosure
- dr1_anchor_not_reaching_deck
- d_mirror_ignored
- d_delete_stays_armed_across_visits

### 4.8 CI artifacts used by the reconcile lane, at `2e25d38`

Downloaded with `gh run download 38645736393 -n js-results|python-results|mutant-shard-report-N -D $S/r5/ci/...`.

**js-results totals against FLOORS:**

| suite | CI total | FLOORS row |
|---|---|---|
| app.test.js | 502 | 501 (lags by 1) |
| e2e.test.js | 298 | 297 (lags by 1) |
| every other js suite | equal to its row | equal |

Sums: CI 1445, FLOORS 1443.

**python-results:** `by_module` equals every python FLOORS row, sum 248. FLOORS sums came from `python3 -c "import sys; sys.path.insert(0,'tests'); import suite_health as s; F=s.FLOORS; print(len(F), sum(v for k,v in F.items() if k.endswith('.js')), sum(v for k,v in F.items() if k.endswith('.py')))"`, which prints `37 1443 248`, i.e. js 1443, py 248 over 37 rows.

**Mutant shard reports:** 941 patches across the four `mutant-shard-*.txt` files.

## 5. Candidate table

Fields per row: class / target / measured cost (command) / change / risk / pinning test / verdict (reason).

### DO

**P5-1**
- **Class:** TEST-STRENGTHEN.
- **Target:** `VoicingTest._check_cluster` in `tests/test_deck_data.py`, the `forced = any(... max(instances(f, True), key=midi) ...)` expression.
- **Measured cost:** a hidden defect, demonstrated by a test that is RED at `2e25d38` (4.6, hidden-defect evidence). The oracle gives the opposite verdict on the same deck when the `fields` map lists bottom fields first. It also matches TODOS "Python oracle lacks a tie-break when a pitch appears in two zones" (P2).
- **Change:** break MIDI ties top-shell-first with `key=lambda g: (midi(g), zone(g) != "bottom")`, matching the engine.
- **Risk:** low. It is test-only. On shipped decks no MIDI value sits in two zones, so the existing test is unchanged in outcome.
- **Pinning test:**
  - Existing: `test_forced_tones_cluster_below_root`, green on main, with b_cluster_forced_only still killed.
  - New: `test_forced_cluster_oracle_ignores_field_order`, written first.
- **Verdict:** DO. It meets the hidden-defect bar, has a pin, and has no owner gate.

### DEFER

**P5-2**
- **Class:** TEST-SPEED.
- **Target:** `partition` in `tests/shard_mutants.js`, balancing by time instead of count.
- **Measured cost:** shard mutant time 572 / 572 / 548 / 301 s; shard jobs 608 / 598 / 567 / 329 s; about 60 to 75 s of projected wall saving (4.5).
- **Change:** deal mutants by recorded or estimated suite time.
- **Risk:** medium. The partition test "the N=4 shard partition balances e2e-selecting mutants within 1 per shard" pins count balance, and a time table drifts.
- **Pinning test:** that test plus "the shard partition does not depend on input order".
- **Verdict:** DEFER. The saving does not come from a removed fixed wait, so it cannot be DO under the TEST-SPEED rule.

**P5-3**
- **Class:** HARNESS.
- **Target:** mutant anchors in `tests/mutants/` for app-source mutants, generally.
- **Measured cost:** 6 of 20 PRs needed refresh commits, touching 44 to 67 mutants, with a per-mutant maximum of 2 PRs (4.7).
- **Change:** re-anchor recurrent mutants on stabler context.
- **Risk:** medium. A hand re-cut drifts, and a wrong-reason kill is invisible to the gate.
- **Pinning test:** "every mutant patch applies to the tree it will run against".
- **Verdict:** DEFER. No mutant reaches 3 of 20 (decision D2).

**P5-4**
- **Class:** TEST-STRENGTHEN.
- **Target:** test "SG: N-A7 the crowded 24-note pan: ..." in `tests/e2e.test.js`; subject `paintLayout`, the `noticed` toggle.
- **Measured cost:** WEAK, shown (4.6 row 12): a one-hunk break that never clears `noticed` passes all 10 SG tests. `paintLayout` churn is 2.
- **Change:** assert the pan warning's display is not none after the notice clears. This is TODOS "Sheet guidance follow-ups" item 1.
- **Risk:** low.
- **Pinning test:** new: "SG: N-A7 the pan warning returns when the notice clears".
- **Verdict:** DEFER. The subject is not a hotspot, so the WEAK bar applies only at 5 of 60.

**P5-5**
- **Class:** TEST-STRENGTHEN.
- **Target:** `labelShape()` / "every name the app draws fits inside the field it labels" in `tests/layout.test.js`; subject `pan` / `panLabel`.
- **Measured cost:** WEAK, shown (4.6 row 41): bottom labels moved 0.6 r out of their circle pass the fit test. `pan` churn is 0.
- **Change:** read the label shape from a bottom-zone label too, as in the TODOS P3 row.
- **Risk:** low.
- **Pinning test:** new: "labelShape holds on a bottom-zone label".
- **Verdict:** DEFER. The subject is not a hotspot.

**P5-6**
- **Class:** REFACTOR.
- **Target:** `runGenerate` in `index.html`.
- **Measured cost:** 90 lines, churn 3 of 60 (4.1, 4.2).
- **Change:** split the refusal, preview and commit branches.
- **Risk:** high. It is the add/edit primary path, with about 30 mutants anchored in it.
- **Pinning test:** the existing "DR2b (rule R drag row): a drag under a standing runGenerate() refusal redraws the plate and keeps the refusal" and the SG tests.
- **Verdict:** DEFER. Churn is 3, below 5.

**P5-7**
- **Class:** TEST-SPEED.
- **Target:** the `drawer_grid` "DR1 rule G grid" sweep and its 9 mutants.
- **Measured cost:** 46 to 108 s per mutant, about 520 s of shard time (4.5).
- **Change:** fail fast at the first bad cell inside the sweep.
- **Risk:** medium. It would change an existing test body, which needs equivalence shown on 9 mutants.
- **Pinning test:** the three `drawer_grid` tests.
- **Verdict:** DEFER. This is sweep work, not a fixed wait.

**P5-8**
- **Class:** TEST-SPEED.
- **Target:** `tests/sequence.test.js`.
- **Measured cost:** 50.11 s LOCAL, the slowest non-browser file, in the `js suites` job, which ends 74 s before shard 1 (4.5).
- **Change:** shrink sampling corpora.
- **Risk:** medium, since it weakens sampling.
- **Pinning test:** "every sampled sequence is a MEDIUM sequence".
- **Verdict:** DEFER. It is off the critical path and not a fixed wait.

**P5-9**
- **Class:** TEST-STRENGTHEN.
- **Target:** `clearPanPreview`, the `gestureCancel` arrow and the `springBack` rejection handler in `index.html`.
- **Measured cost:** 3 zero-execution functions (4.4).
- **Change:** add tests that drive placeholder failure, touch cancel and animation rejection.
- **Risk:** low.
- **Pinning test:** new, one per function.
- **Verdict:** DEFER. Pass 4's `-coverage` doc classed these as LIVE, unexecuted; no input has changed and there is no DO bar.

**P5-10**
- **Class:** TEST-STRENGTHEN.
- **Target:** engine uncovered ranges: select 12, voicing 9, sequence 7, pdfcards 6, share `utf8String` 5, core `validate` 2.
- **Measured cost:** 41 uncovered ranges (4.4); engine churn is 0.
- **Change:** add branch tests.
- **Risk:** low.
- **Pinning test:** new, per branch.
- **Verdict:** DEFER. There is no hotspot and no shown defect.

**P5-11**
- **Class:** TEST-DEDUP.
- **Target:** 4 repeated setup blocks in `tests/e2e.test.js`, starting at the setViewport/eval scaffolds listed in 4.3.
- **Measured cost:** 11 duplicate 10-line windows (4.3).
- **Change:** move them into a helper in `tests/helpers/`.
- **Risk:** low.
- **Pinning test:** the enclosing tests, unchanged.
- **Verdict:** DEFER. It is below every DO bar.

**P5-12**
- **Class:** DOCS.
- **Target:** `tests/CONTRACT.md` rule 4 (the index line) and the "six committed PDFs" line.
- **Measured cost:** a contradiction with the gate test "no mutant patch carries a blob header it cannot keep true" and with `ls *.pdf` (0.1).
- **Change:** rewrite both sentences.
- **Risk:** low.
- **Pinning test:** that mutation_harness test, and `test_committed_pdfs_match_a_fresh_build`.
- **Verdict:** DEFER. There is a measured cost but no DO bar, so it is recorded for a docs lane.

**P5-13**
- **Class:** HARNESS.
- **Target:** never-loaded tools: `tools/boot_sim.js`, `tools/regen_pan_fixture.js`, `tools/refresh_mutants.py`, `tools/regen_data_mutants.py`; plus `tools/sandbox.js` with 22 zero functions.
- **Measured cost:** zero coverage under the coverage run (4.4).
- **Change:** confirm which are subprocess-only, and add direct tests where they are not.
- **Risk:** low.
- **Pinning test:** new.
- **Verdict:** DEFER. Unverified whether this is a real gap or a tracer limit.

**P5-20**
- **Class:** TEST-SPEED.
- **Target:** e2e and harness fixed sleeps (all at most 450 ms) and the harness 60 s and 15 s bail timers.
- **Measured cost:** about 5.3 s of literal waits per pass; the bail timers are never paid green (4.5).
- **Change:** none.
- **Risk:** none.
- **Pinning test:** none.
- **Verdict:** DEFER. There is nothing at or above 30 s on the critical path, so it cannot be DO, and a TEST-SPEED row with a measured cost is DEFER.

### DROP

**P5-14**
- **Class:** REFACTOR.
- **Target:** long functions with no churn: `pan` (108 lines), `sequence.mediumEnumerate` (98), `layout.geometryAt` (84), `sequence.sampleMedium` (76, depth 6), `restoreScales` (depth 6).
- **Measured cost:** churn 0 (4.1).
- **Change:** split.
- **Risk:** medium.
- **Pinning test:** the existing digest tests.
- **Verdict:** DROP. "A large one nobody touches is not" a candidate.

**P5-15**
- **Class:** DOCS.
- **Target:** the stale `#scale-guidance` markup comment, which says "a warning first" (TODOS sheet guidance item 3).
- **Measured cost:** none measured.
- **Change:** reword.
- **Risk:** none.
- **Pinning test:** none.
- **Verdict:** DROP. No measured cost.

**P5-16**
- **Class:** TEST-STRENGTHEN.
- **Target:** the `.pan` class add at `openEditSheet` and the collision branch being "unpinned by mutants" (TODOS sheet guidance item 2).
- **Measured cost:** not shown. No break was run against it.
- **Change:** add mutants.
- **Risk:** low.
- **Pinning test:** SG tests.
- **Verdict:** DROP. No measured cost this pass, and `openEditSheet` churn is 3.

**P5-17**
- **Class:** REFACTOR.
- **Target:** sheet literal colours into CSS variables (TODOS).
- **Measured cost:** none.
- **Change:** tokenise.
- **Risk:** visible-pixel risk.
- **Pinning test:** `panel fit`.
- **Verdict:** DROP. The benefit is aesthetic.

**P5-18**
- **Class:** REFACTOR.
- **Target:** the dead `select:focus` term of the `.sheetbody:has(...)` band rule (TODOS).
- **Measured cost:** none. One token, and not in coverage's 8 unused rules.
- **Change:** delete the token.
- **Risk:** low.
- **Pinning test:** DR1 band tests.
- **Verdict:** DROP. The benefit is aesthetic.

**P5-19**
- **Class:** TEST-FLAKE.
- **Target:** any test.
- **Measured cost:** 0 reruns at one SHA in 60 runs (4.5).
- **Change:** none.
- **Risk:** none.
- **Pinning test:** none.
- **Verdict:** DROP. No flake evidence.

### Owner-gated

These are not lanes; see section 10.

**G-1**
- **Class:** REFACTOR.
- **Target:** one source for the label ratios in `tools/hifi.py`, `pan()` and `labelFloor` in `src/engine/layout.js`.
- **Measured cost:** three copies (4.3), pinned by parity tests.
- **Change:** generate one constant into all three.
- **Risk:** it adds a sync step.
- **Pinning test:** `tests/test_render_agreement.py`.
- **Verdict:** owner-gated, because it is a sync-step architecture change.

**G-2**
- **Class:** REFACTOR (behaviour).
- **Target:** `openShare()` re-storing an explicit parent (TODOS).
- **Measured cost:** pinned behaviour.
- **Change:** infer on open.
- **Risk:** it breaks "a share link restores the exact deck".
- **Pinning test:** "RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included".
- **Verdict:** owner-gated, because it is a behaviour decision.

**G-3**
- **Class:** REFACTOR (visible pixel).
- **Target:** a bottom-shell octave-digit floor (TODOS).
- **Measured cost:** 3.2 pt on dense generated pans (TODOS).
- **Change:** floor or drop.
- **Risk:** visible pixel.
- **Pinning test:** `test_no_label_falls_below_the_print_floor`.
- **Verdict:** owner-gated, because it changes a visible pixel.

**G-4**
- **Class:** REFACTOR (visible copy).
- **Target:** SMALL_LABELS copy with a next action (TODOS).
- **Measured cost:** a design review finding.
- **Change:** new REASONS copy plus an ENGINE-SPEC table edit.
- **Risk:** visible copy.
- **Pinning test:** "REASONS is the ENGINE-SPEC section 2 table, verbatim".
- **Verdict:** owner-gated, because it changes visible copy.

## 6. Lanes

Two lanes. Lane `oracle` is wave 1 and the reconcile lane is wave 2. Every lane works in its own worktree off `main`, writes tests first, and runs suites with absolute paths.

Pitfalls every lane carries:

- Never rename or delete a test.
- Mutant patches carry no `index` line.
- `# suite:` headers are word-split, so use `.` wildcards.
- Never edit the tree while `tests/mutation_check.sh` runs. Push and let CI's mutation gate decide.
- Never `pgrep -f`.
- Gate on `gh run list --commit <sha>` conclusions, and re-query `headRefOid` once after a push.
- Poll CI with `gh run watch` and return in the same turn.
- A lone shard survivor on an unrelated diff is rerun at the same SHA first.

### Lane `oracle` (wave 1). Candidate P5-1

- **Branch:** `claude/refactor-5-oracle`.
- **Worktree:** `.claude/worktrees/refactor-5-oracle` (`git worktree add -b claude/refactor-5-oracle .claude/worktrees/refactor-5-oracle main`).
- **Goal:** `VoicingTest._check_cluster` in `tests/test_deck_data.py` breaks MIDI ties top-shell-first. The new test `test_forced_cluster_oracle_ignores_field_order` proves that the oracle's verdict does not depend on the order of a deck's `fields` map.
- **Non-goals:**
  - No change to any other assertion in `tests/test_deck_data.py`.
  - No change to `data/decks.json`, `index.html`, `tools/decks.py`, `tools/hifi.py` or any `src/engine/*.js` (CONTRACT rule 6).
  - No FLOORS edit: the row stays at 27 under decision D1.
  - No README edit.
  - No other TODOS row.
- **Owned files:**
  - `tests/test_deck_data.py`
  - `tests/mutants/ro_oracle_zone_tie_break_dropped.patch` (new)
  - `TODOS.md`, only the subsection "Python oracle lacks a tie-break when a pitch appears in two zones"

  No existing mutant patches `tests/test_deck_data.py` (`grep -l '+++ b/tests/test_deck_data.py' tests/mutants/*` is empty). The one mutant naming `test_forced_tones_cluster_below_root`, `b_cluster_forced_only.patch`, patches deck data, not this file, so the lane does not own it. It must still be killed.

**Steps:**

1. **Test first.** Add `test_forced_cluster_oracle_ignores_field_order` to `VoicingTest`. It holds a literal deck dict, the output of `node tools/gen_deck.js --legacy "(C3) G3 B3 D4 E4 G4 B4 | Bb2 B3 D4"` cut to the fields plus one chord: Em7 `fields [4, 1, 2, 3]`, `roots [4]`. Write it literally in the test, with no subprocess. The test runs `self.test_forced_tones_cluster_below_root()` twice under `unittest.mock.patch(__name__ + ".decks", ...)`: once with the fields in engine order and once with the bottom fields first. It edits no existing test body.
   - Acceptance: the new test is RED at the lane's first commit, which holds the test only, with the failure "unforced card: tone below the root". Every other test in the module is green.
   - Verify: `S=$(mktemp -d); python3 -m unittest tests.test_deck_data > $S/r1.log 2>&1; grep -qx 'FAILED (failures=1)' $S/r1.log && grep -q '^FAIL: test_forced_cluster_oracle_ignores_field_order' $S/r1.log && grep -q 'unforced card: tone below the root' $S/r1.log`
2. **The fix.** In `_check_cluster`, change `key=midi` inside the `forced = any(...)` expression to `key=lambda g: (midi(g), zone(g) != "bottom")`. Nothing else in that method changes.
   - Acceptance: the new test is green, and all 28 tests in `tests.test_deck_data` are green.
   - Verify: `S=$(mktemp -d); python3 -m unittest tests.test_deck_data > $S/r2.log 2>&1; tail -1 $S/r2.log | grep -qx OK && grep -q '^Ran 28 tests' $S/r2.log && python3 -m unittest tests.test_deck_data.VoicingTest.test_forced_cluster_oracle_ignores_field_order`
3. **The killing mutant.** Create `tests/mutants/ro_oracle_zone_tie_break_dropped.patch`. Generate its body by reverting step 2 on the committed tree and running `git diff -- tests/test_deck_data.py`, then strip the `index` line. Headers:
   - `# kills: test_forced_cluster_oracle_ignores_field_order`
   - `# suite: python3 -m unittest -k test_forced_cluster_oracle_ignores_field_order tests.test_deck_data`
   - Acceptance: the patch applies cleanly, the named test fails under it and passes after reverse-apply, and the harness lint passes.
   - Verify: `P=tests/mutants/ro_oracle_zone_tie_break_dropped.patch; git apply --check $P && git apply $P && { python3 -m unittest -k test_forced_cluster_oracle_ignores_field_order tests.test_deck_data; rc=$?; git apply -R $P; test $rc -ne 0; } && ! grep -q '^index ' $P && node --test --test-name-pattern 'no.mutant.patch|every.mutant.patch|FU-6|N=4.shard.partition' tests/mutation_harness.test.js`
4. **Retire the TODOS row.** Delete the subsection "Python oracle lacks a tie-break when a pitch appears in two zones" from `TODOS.md`. The `## Scale engine` heading stays, because the `labelShape` row remains under it.
   - Acceptance: that heading text is gone, the `## Scale engine` heading and the subsection "layout.test.js infers every zone's label shape from one ding label" remain, and the README currency suite stays green.
   - Verify: `! grep -q 'Python oracle lacks a tie-break' TODOS.md && grep -qx '## Scale engine' TODOS.md && grep -q "^### layout.test.js infers every zone's label shape from one ding label" TODOS.md && python3 -m unittest tests.test_readme_currency`
5. **Regression evidence, section 3 steps 1 to 5, locally.**
   - Acceptance: all green.
   - Verify: `python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && git diff --quiet main -- data/decks.json index.html tools tests/fixtures && python3 -m unittest tests.test_render_agreement tests.test_pdf_build && python3 tools/refresh_mutants.py --check`
6. **Push and open a PR.** CI is the oracle.
   - Acceptance: `validate` at the head SHA concluded success, and that SHA equals `headRefOid`.
   - Verify: `sha=$(git rev-parse HEAD); gh run list --workflow validate.yml --commit $sha --json conclusion -q '.[0].conclusion'` prints `success`, and `gh pr view --json headRefOid -q .headRefOid` equals `$sha`.

**Deltas:**
- Mutants: +1, so the corpus goes from 941 to 942.
- FLOORS: no edit. The `test_deck_data.py` row stays at 27 while CI will count 28, which suite health accepts because rows are minimums.

### Lane `reconcile` (wave 2, after `oracle` merges)

- **Branch:** `claude/refactor-5-reconcile`.
- **Worktree:** `.claude/worktrees/refactor-5-reconcile`, cut from `main` after the `oracle` merge.
- **Goal:** README.md's mutant count and every `tests/suite_health.py` FLOORS row equal main's CI artifacts at the `oracle` merge commit.
- **Non-goals:**
  - No test, mutant, source or workflow edit.
  - No row lowered.
  - No `tests/CONTRACT.md` edit: P5-12 is DEFER.
- **Owned files:** `README.md` (the "N mutant patches" sentence only) and `tests/suite_health.py` (FLOORS values only).

**Steps:** run every step's commands in one shell, in order, after `SCRATCH=$(mktemp -d)`; step 1 sets `M` and `id`.

1. **Read main's CI.** Let `M` be the merge commit of the `oracle` PR on `main`: `M=$(gh pr list --head claude/refactor-5-oracle --state merged --json mergeCommit -q '.[0].mergeCommit.oid')`. Find its run: `id=$(gh run list --workflow validate.yml --commit $M --json databaseId,conclusion -q '.[]|select(.conclusion=="success")|.databaseId' | head -1)`. Download `js-results`, `python-results` and the four `mutant-shard-report-N` artifacts to scratch.
   - Acceptance: the run concluded success, and the six artifacts are present.
   - Verify: `test -n "$id" && for a in js-results python-results mutant-shard-report-1 mutant-shard-report-2 mutant-shard-report-3 mutant-shard-report-4; do gh run download $id -n $a -D $SCRATCH/$a || exit 1; done`
2. **Set FLOORS from the artifacts.** For every FLOORS row, set the value to the CI total for that file: `js-results.json` `.files[path].total` or `python-results.json` `.by_module`. Projected changes: `tests/app.test.js` 501 to 502, `tests/e2e.test.js` 297 to 298, `tests/test_deck_data.py` 27 to 28. Every other row is unchanged.
   - Acceptance: each row equals CI, none falls, and suite health is green.
   - Verify: `python3 -c "import json,sys; sys.path.insert(0,'tests'); import suite_health as s; js=json.load(open('$SCRATCH/js-results/js-results.json'))['files']; py=json.load(open('$SCRATCH/python-results/python-results.json'))['by_module']; bad=[k for k,v in s.FLOORS.items() if v != (js[k]['total'] if k.endswith('.js') else py['tests.'+k[6:-3]])]; print(bad); sys.exit(1 if bad else 0)" && python3 -m unittest tests.test_suite_health`
3. **Set the README mutant count.** Set the "N mutant patches" sentence to the count across the four shard reports, projected at 942.
   - Acceptance: the README number equals the shard-report total and equals `ls tests/mutants/*.patch | wc -l` on the lane head.
   - Verify: `n=$(cat $SCRATCH/mutant-shard-report-*/mutant-shard-*.txt | grep -c '\.patch$'); grep -q "$n mutant patches" README.md && test "$n" -eq "$(ls tests/mutants/*.patch | wc -l | tr -d ' ')" && python3 -m unittest tests.test_readme_currency`
4. **Push, open a PR, CI success at the verified head.** Use the same verify as `oracle` step 6.

**Deltas:**
- Mutants: 0.
- FLOORS: +3 in all (app +1, e2e +1, test_deck_data +1). Sums go from js 1443 to 1445 and py 248 to 249.

Projected after the last merge:

| | count |
|---|---|
| Corpus (941 + 1 from `oracle`) | 942 |
| README | 942 |
| FLOORS js | 1445 |
| FLOORS py | 249 |
| FLOORS rows | 37 (no new suite file) |

The FLOORS figures assume no other lane merges in between. Reconcile reads CI, so any interleaved merge is absorbed and is not a plan error.

## 7. Waves and merge order

| wave | lane | depends on | why |
|---|---|---|---|
| 1 | `oracle` | none | Owns `tests/test_deck_data.py`, one new mutant and one TODOS subsection. No other lane edits these. |
| 2 | `reconcile` | `oracle` merged and main's `validate` green at that merge | Sets README and FLOORS from main's CI after the last merge (decision D1). It must read the corpus count that includes `oracle`'s mutant, and the `test_deck_data.py` total of 28. |

There is no file overlap within either wave, and 1 lane per wave, which is under the 4-concurrent cap. There are 2 lanes in all, under the 8-lane cap. `tests/suite_health.py` is edited by one lane (reconcile) and `README.md` by one lane (reconcile). No lane adds a suite file or edits `tests/e2e.test.js`.

## 8. Standing merge gates (every lane)

1. CI `validate` concluded success at a head SHA verified against the local tip: `gh pr view <n> --json headRefOid`, re-queried once after the push, equal to `git rev-parse HEAD`. The gate reads the `gh run list --commit <sha>` conclusion, not `gh pr checks` buckets.
2. An independent `swarm-reviewer` returned PASS or PASS_WITH_NITS at that same SHA. Its brief quotes the lane's section 6 acceptance block verbatim and adds no criterion.
3. The mutation gate and `suite health` are green in that run.
4. No ownership violation: `git diff --name-only main...<sha>` lists only the lane's owned files.

A reviewer FAIL is never merge-able; fix it and re-review with a fresh reviewer. Merge is `gh pr merge <n> --merge` with no `--delete-branch`, under the AFK grant. Fast-forward local `main` afterwards.

## 9. Decisions

AFK auto-picks the recommendation. Each recommendation is the conservative option.

| # | decision | options | recommendation |
|---|---|---|---|
| D1 | FLOORS amendment to `tests/CONTRACT.md` "Floors are a per-file table" ("Adding tests means editing YOUR row's number"), for this pass only | (a) Rows are minimums. A lane that adds tests leaves its row unchanged, and the reconcile lane sets every row from main's CI artifacts after the last merge. (b) Follow CONTRACT: each lane raises its own row. | (a). It keeps `oracle` off `tests/suite_health.py`, so only one lane in the pass edits it, and it sets numbers from CI, never by hand. The CONTRACT text is not edited this pass. |
| D2 | How to read the re-anchor DO bar ("a re-anchor on at least 3 of the last 20 merged PRs") | (a) Per mutant: no mutant reaches 3, so no DO. (b) Per PR across the corpus: 6 of 20 PRs, which would make a corpus-wide HARNESS lane DO. | (a). The prompt calls a re-anchored mutant "a candidate for a stabler anchor", which is per mutant. (b) would open a large, high-risk re-cut lane (P5-3) on an aggregate. |
| D3 | Whether the oracle defect counts as a "hidden defect", given that its RED input is a reordered `fields` map no current producer emits | (a) DO: JSON object order carries no meaning, so a different verdict on the same deck is a defect, shown RED. (b) DEFER until a producer emits bottom-first. | (a). It is a test-only, one-expression fix that is equivalent on every shipped deck, so it carries no production risk, and it closes a P2 TODOS row. |
| D4 | How the new test feeds a deck to the oracle | (a) `unittest.mock.patch` the module's `decks` and call the existing test method. No existing test body changes. (b) Extract the per-deck loop into a helper, which edits the existing test body. | (a). It leaves `test_forced_tones_cluster_below_root` byte-identical. |
| D5 | The two WEAK tests (P5-4, P5-5) | (a) DEFER: their subjects are not hotspots. (b) Fold them into `oracle`. | (a). Folding them would breach the DO rule and make `oracle` own `tests/e2e.test.js` and `tests/layout.test.js`. |
| D6 | Time-balanced shards (P5-2), about 60 to 75 s projected | (a) DEFER: not a fixed wait. (b) DO as TEST-SPEED with three-run acceptance. | (a), per the prompt's TEST-SPEED rule. |
| D7 | The TODOS row after the fix | (a) Delete the subsection. (b) Mark it "Shipped". | (a). Nothing in it remains open. |
| D8 | The source of the README count | (a) The four `mutant-shard-report-N` artifacts of main's run at the `oracle` merge. (b) `ls tests/mutants`. | (a), cross-checked against (b) in the verify command. |
| D9 | Expected review bounces | `oracle` 1, `reconcile` 0 | The test-lane history (#299, #301 FAILs on brief and docs claims) suggests 1. Reconcile is mechanical, as in prior passes. |

## 10. Owner-gated proposals (kept out of the lanes)

**G-1. One source for the diagram label ratios.**
- Benefit: it removes three hand-kept copies (`tools/hifi.py`, `pan()` in `index.html`, `labelFloor` in `src/engine/layout.js`; TODOS "Diagram label ratios are held three times").
- Measured cost of leaving them: zero drift today, because `tests/test_render_agreement.py`, `LabelSizeRuleTest` and the layout tests pin them.
- Cost of the change: a generated constant across Python and JS is a new sync step beside `inline_engine.py` and `sync_decks.py`. That is a sync-step architecture change, and it adds a fourth "never hand-edit" region.
- Recommendation: leave as is.

**G-2. Share links infer the parent on open.**
- Benefit: "infer always" would be literally true.
- Cost: it changes pinned behaviour, the test "RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included", and conflicts with the standing decision pinned by "a share link restores the exact deck, and options never move the id". It also leaves a dead field in the share format.
- No measured defect.

**G-3. A floor or drop rule for the bottom-shell octave digit.**
- TODOS records 3.2 pt on dense generated pans, below the 3.6 pt the pipeline treats as readable. The owner excluded it from SMALL_LABELS on 2026-10-06.
- Benefit: legibility on dense pans.
- Cost: a visible-pixel change in both renderers, plus re-pinning `test_no_label_falls_below_the_print_floor` and the render-agreement sizes.

**G-4. SMALL_LABELS copy with a next action.**
- Benefit: from design review D7 (2026-10-13), the slot's longest message would gain an action.
- Cost: visible copy. The string is engine output whose source of truth is the ENGINE-SPEC section 2 table, pinned by "REASONS is the ENGINE-SPEC section 2 table, verbatim". Prefix-matching tests in `tests/select.test.js` and `tests/app.test.js` need review too.

## 11. What the plan deliberately leaves

- **DEFER, recorded for a later pass:**
  - P5-2 (time-balanced shards): not a fixed wait.
  - P5-3 (corpus-wide re-anchor drag): no mutant reaches 3 of 20.
  - P5-4 and P5-5 (two WEAK tests, shown): subjects are not hotspots.
  - P5-6 (`runGenerate` split): churn 3.
  - P5-7 (`drawer_grid` sweep fail-fast): not a fixed wait.
  - P5-8 (`sequence.test.js` speed): off the critical path.
  - P5-9 (3 LIVE zero functions): pass 4 classification stands.
  - P5-10 (engine uncovered branches): no hotspot.
  - P5-11 (e2e setup duplication): below bars.
  - P5-12 (CONTRACT rule 4 and "six PDFs"): no DO bar. It is the first item for any future docs lane.
  - P5-13 (never-loaded tools): possibly a tracer limit.
  - P5-20 (sub-second waits, about 5.3 s): not on the critical path.
- **DROP:**
  - P5-14 (long functions nobody touches)
  - P5-15 (stale markup comment)
  - P5-16 (unshown mutant gap)
  - P5-17 (literal colours: aesthetic, pixel risk)
  - P5-18 (dead `select:focus` token)
  - P5-19 (no flakes)
- **Owner-gated:** G-1 to G-4 (section 10).
- **Other TODOS rows, not refactors or test improvements:**
  - "Write DESIGN.md via /design-consultation" is design documentation with no measured cost.
  - "The iOS keyboard covers GENERATE CARDS while typing a seed" is shipped and awaits only the owner's hardware check.
- **Earlier passes, not re-opened.** No input to their stated reasons was shown to change, and the window shows no churn bar met on their subjects:
  - Pass 4 section 8 and 10 deferrals and owner gates: G1 (the hifi copy), G2, G3, ENG-4, PY-5, E2E-4, E2E-6, E2E-8, GATE-1/4/8/9/10, UNIT-7/8/9, Hotspot 7, the body-sharing mutant pairs and the rail digest. Section 10.4's accepted items also stand.
  - Pass 3's section 2.2 owner-gated items (PRINT_PAPER.css, the stub guards, GATE-7 duplicate mutants, PY-3 check_2) and every KEPT-BY-DECISION or LIVE row in its section 3.

## 12. Risk register

| lane | what could regress | existing test that catches it | new test that must | expected bounces |
|---|---|---|---|---|
| `oracle` | (1) The tie-break flips a verdict on a shipped deck. (2) The mock leaks `decks` into other tests. (3) The mutant body carries an `index` line or a stale hunk. | (1) `test_forced_tones_cluster_below_root` and its mutant b_cluster_forced_only; the full `tests.test_deck_data` run. (2) Every other `test_deck_data` test, since `patch` is a context manager. (3) "no mutant patch carries a blob header it cannot keep true" and "every mutant patch applies to the tree it will run against". | `test_forced_cluster_oracle_ignores_field_order`, killed by `ro_oracle_zone_tie_break_dropped.patch` | 1 |
| `reconcile` | (1) A row is set by hand rather than from CI. (2) A row is lowered. (3) The README count is stale against an interleaved merge. | (1, 2) `suite health` at the head, and the verify command in step 2. (3) `tests.test_readme_currency` and the step 3 cross-check against `ls tests/mutants`. | none (no new test) | 0 |

## 13. Not measured, and why

- **E2E per-title-prefix timings on clean `main`.** The only e2e runs here were under break patches (4.6). The full e2e suite starves a local browser, and CI records no per-test time. No TEST-SPEED row depends on an e2e figure, because every TEST-SPEED row is DEFER or DROP by the fixed-wait rule.
- **Whether `tools/refresh_mutants.py`, `tools/regen_data_mutants.py` and `tools/validate.py` are exercised by subprocess.** The coverage tracer does not follow python subprocesses, and confirming it would need instrumented runs. Recorded as P5-13, DEFER.
- **The exact saving of a time-balanced shard split.** The 60 to 75 s is projected from per-mutant log deltas that include first-seen baselines, not measured. It does not matter for the verdict, because the row is DEFER whatever the figure.

## Self-score (plan rubric)

| # | item | score | note |
|---|---|---|---|
| 1 | Section 0 quotes the request; 0.1 lists every contradicted prompt fact | 1 | No prompt fact was contradicted. Both stale CONTRACT lines are listed. |
| 2 | Every number in section 4 carries its command | 1 | Scratch scripts are named with their arguments. |
| 3 | Every section 5 row has all eight fields | 1 | id, class, target, cost, change, risk, pin, verdict |
| 4 | Every DO row meets the DO rule | 1 | P5-1 has a hidden defect shown RED at `2e25d38`, a pin, and no owner gate. |
| 5 | No file in two lanes of one wave | 1 | One lane per wave. |
| 6 | Every lane step has acceptance and a runnable verify | 1 | |
| 7 | Every lane names a pinning test green on main before the change | 1 | `oracle`: `test_forced_tones_cluster_below_root` is green on main; the new test is RED on main by design (the defect) and killed by its committed mutant. `reconcile`: suite health and readme currency. |
| 8 | Mutant and FLOORS deltas sum to the projection | 1 | 941 + 1 = 942. FLOORS js 1443 + 2 (lag) = 1445, py 248 + 1 = 249. |
| 9 | Sections 2, 10 and 11 cover every DEFER, DROP and owner-gated item | 1 | P5-2 to P5-20 and G-1 to G-4. |
| 10 | The VERDICT counts match; X and Y follow the formula | 1 | X = 2 x 2 + 2 x 1 = 6; Y = 2 + 1 + 0 = 3. |

VERDICT: 2 lanes, 1 DO candidates, 4 owner-gated proposals, projected 6 subagent runs and 3 CI runs
