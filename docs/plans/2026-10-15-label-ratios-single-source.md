# G-1: one source for the diagram label ratios

Read at `main` `7ef7fda` (worktree branch `claude/g1-label-ratios-plan`, base `7ef7fda` plus the prompt commit `156810f`). Every number below was measured at that SHA unless a line says "proto". "Proto" means a scratch worktree detached at `7ef7fda` that carried the recommended change. It was never pushed and has been removed.

## 0. Owner decision and the request

Owner decision, 2026-10-15 check-in, on refactor pass 5's proposal G-1 ("one source for the diagram label ratios"): **"Plan it"**, timed **"After pass 5 merges (Recommended)"**. Pass 5's own recommendation was "leave as is" (`docs/plans/2026-10-14-refactor-pass-5.md` section 10, G-1), and the owner overrode it. Pass 5 merged at `7ef7fda`.

**The request as read.** There are six label-rule numbers:

- the three name ratios: `0.70875` (ding), `0.80325` (rim and inner), `0.8232` (bottom);
- the number ratio `0.64`;
- the octave-digit ratio `0.66`;
- the label width ratio `1.47`.

After the plan executes, each one is written as a literal in exactly one hand-edited place in JavaScript. That means `src/engine/*.js` plus the app block of `index.html`, with engine regions excluded because they are generated. Each is written in at most one place in `tools/*.py`. Every other non-test use reads from there. Test files do not count, and section 11 lists every test literal as a deliberate oracle. The Python copy is pinned to the JS copy by a test that fails when the two differ. Rendered output does not change by a single glyph size: this is a pure refactor.

### 0.1 Facts in the prompt that the code contradicts

**None.** I re-ran every fact in the prompt at `7ef7fda`; the commands and outputs are in section 4. All reproduce, including:

- the 21 and 7 load-list lines and their grouping;
- the 11 mutants and the 942 corpus;
- `refresh_mutants.py --check` green;
- the octave hits;
- the pin-grep examples.

I found two refinements. Neither contradicts the prompt:

1. `tests/core.test.js` still reaches `labelFloor`, though not through its own `loadEngine` call. Its line 772 is correctly in group 2. But test ET-1 ("engine corpus matches") shells out to `tools/regen_engine_corpus.js`, which is a group-1 caller. Under option (a1), core.test.js went RED (1 failure) through that tool. Fixing the tool's load list fixes the test, so core.test.js's own load list does not change.
2. The app's card note line does not use `0.66`. The app's bottom note line draws its octave with the CSS rule `.notesline sub{font-size:.62em}` (index.html, the `.notesline sub` rule). Only the diagram's `panLabel()` uses `fs*0.66`. The prompt says the 0.66 is "shared by the note line and the diagram labels" in print (hifi `note_text`, pdfcards `noteText`). That is true, and the app is simply different. Section 11 leaves `.62em` alone because changing it would move a visible pixel.

## 1. Goal

After the plan, the counting command below prints exactly 12 lines:

- 6 in `src/engine/core.js`: `LABEL_RATIO_DING`, `LABEL_RATIO_NOTE`, `LABEL_RATIO_BNOTE`, `NUM_RATIO`, `OCTAVE_RATIO`, `LABEL_WIDTH_RATIO`;
- 6 in `tools/hifi.py`: the same six names.

So each figure is a literal once per language. The same rule is enforced in CI by the new test `test_each_label_rule_number_is_written_once_per_language`.

```
cd /Users/ray/Projects/handpan-cards/.claude/worktrees/g1-<lane>
{ grep -nE '[^0-9.](0\.70875|0\.80325|0\.8232|1\.47|0\.64|0\.66)([^0-9]|$)' src/engine/*.js tools/*.py | grep -v F_NUM_RATIO
  awk '/<!-- engine:[a-z]+ begin/{e=1} !e && /[^0-9.](0\.70875|0\.80325|0\.8232|1\.47|0\.64|0\.66)([^0-9]|$)/{print FILENAME":"FNR":"$0} /<!-- engine:[a-z]+ end -->/{e=0}' index.html
} | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(#|\*|//|/\*)'
```

The `grep -v F_NUM_RATIO` drops the solver's `F_NUM_RATIO = 0.64`, which is out of scope. The awk skips every `index.html` line from an `<!-- engine:<name> begin` marker to its `<!-- engine:<name> end -->` marker. The last filter drops comment lines.

**Expected output after the plan** (proto, line numbers indicative):

```
src/engine/core.js:940:  var LABEL_RATIO_DING = 0.70875;
src/engine/core.js:941:  var LABEL_RATIO_NOTE = 0.80325;
src/engine/core.js:942:  var LABEL_RATIO_BNOTE = 0.8232;
src/engine/core.js:943:  var NUM_RATIO = 0.64;
src/engine/core.js:944:  var OCTAVE_RATIO = 0.66;
src/engine/core.js:945:  var LABEL_WIDTH_RATIO = 1.47;
tools/hifi.py:67:OCTAVE_RATIO = 0.66
tools/hifi.py:123:LABEL_RATIO_DING = 0.70875   # name inside the ding ...
tools/hifi.py:124:LABEL_RATIO_NOTE = 0.80325   # ...
tools/hifi.py:125:LABEL_RATIO_BNOTE = 0.8232   # ...
tools/hifi.py:126:NUM_RATIO = 0.64             # ...
tools/hifi.py:139:LABEL_WIDTH_RATIO = 1.47     # 1.40 x 1.05
```

The same command at `7ef7fda` prints 20 lines:

| file | lines |
|---|---|
| layout.js | 4: `PRINT_*` at 64-67 |
| pdfcards.js | 7: 142, 149-153, 176 |
| hifi.py | 7: 68, 119-122, 135, 170 |
| index.html | 2: 8174 `const NUM_RATIO = 0.64;`, 8195 `fs*0.66` |

Counted per figure:

- **JS:** {0.70875: 1, 0.80325: 2, 0.8232: 2, 0.64: 3, 0.66: 4, 1.47: 1}, 13 literals.
- **Python:** {0.66: 2, every other figure: 1}, 7 literals.

## 2. Non-goals

- No glyph-size change on any card in either renderer, including names, index numbers, octave digits and the note line.
- No change to the solver `F_*_RATIO` constants in `src/engine/layout.js`. They are a different concept: the solver's budget, derived from Pygmy.
- No new sync step, generated region, generated file or generated line without owner approval. That includes extending `tools/inline_engine.py` or `tools/sync_decks.py`. No new non-test cross-language read, so Python never reads JS source in shipped code.
- No change to the single-file architecture: no `<script src>`, no build step, no new engine module (and therefore no `MODULES` change).
- No deck data, geometry, palette or font change. `data/decks.json` and the `const DECKS` line stay untouched.
- No CI required-check change and no workflow edit.
- Nothing from CLAUDE.md's "Ideas, NOT committed roadmap" list.
- No deploy.
- No change to the app's CSS note-line subscript (`.62em`); see section 11.
- No test renamed or deleted. No existing assertion weakened.

## 3. Regression evidence (binding on every lane, in this order)

1. **Byte-identical generated outputs.**
   - `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` are green.
   - `data/decks.json` is untouched.
   - The three committed `*_CHORD_ONLY_Letter.pdf` are unchanged by extracted text (`tests/test_pdf_build.py` `test_committed_pdfs_match_a_fresh_build`).
   - `tests/fixtures/` is unchanged (`git diff --stat main -- tests/fixtures` is empty).
2. **Every drawn label size unchanged.**
   - `tests/test_render_agreement.py` is green over all 177 cards, and `tests/test_print.py` `LabelSizeRuleTest` is green.
   - `test_render_agreement` does not compare the octave digit; it keys on the name glyph.
   - Print octave sizes are pinned by `tests/test_print.py` (`SPEC_OCTAVE_RATIO`, used in `LabelSizeRuleTest`).
   - App octave sizes are pinned by `tests/fixtures/` staying unchanged (step 1) together with the tests that compare against `pan_render_v1.json` (tests/app.test.js, the two `require("./fixtures/pan_render_v1.json")` sites).
3. **Pinning tests and new tests.** Every pinning test named in the lane is green on `main` before the change and at the head after. Every new test is shown RED against a deliberate break, committed as a mutant in `tests/mutants/` whose `# kills:` names it (CONTRACT rule 3).
4. **Mutation gate.** It is green at the head SHA, the corpus count does not fall, and `python3 tools/refresh_mutants.py --check` is green.
5. **Suite health.** `tests/suite_health.py` is green at the head, and no FLOORS row is lowered.
6. **CI.** CI's `validate` run at the PR's verified head SHA concluded success (`gh run list --commit <sha> --workflow validate --json conclusion`).

No lane renames or deletes a test. No lane edits an existing test's assertion except to make it stricter or equivalent, with equivalence shown by the same mutants still killing it.

## 4. Measurement appendix

Every command below runs from `/Users/ray/Projects/handpan-cards/.claude/worktrees/g1-plan` at `7ef7fda` unless it says proto.

### 4.1 Literal copies

`grep -rnE '0\.70875|0\.80325|0\.8232\b|\b1\.47\b|_RATIO = 0\.64|NUM_RATIO = 0\.64' src tools index.html` returns 24 lines:

- **layout.js:** 64, 65, 66, and 77 (the `F_NUM_RATIO` solver line, out of scope).
- **pdfcards.js:** 149-153.
- **hifi.py:** 119-122 and 135.
- **index.html:** 2806-2810 (pdfcards region) and 4668-4670 plus 4681 (layout region), all generated; and 8174 `const NUM_RATIO = 0.64;` (app block).

The two octave greps:

- `grep -n '0\.66' tools/hifi.py src/engine/*.js` gives hifi.py:68 (`note_w`), hifi.py:170 (`note_text` setFont), layout.js:67 (`PRINT_OCTAVE_RATIO`), pdfcards.js:142 (`noteW`) and pdfcards.js:176 (`noteText` setFont).
- `grep -n 'fs\*0\.66' index.html` gives 8195 (`panLabel`).

Other figures confirmed at `7ef7fda`:

- **Note line.** `note_text(... "Notes" ...)` is at hifi.py:244, and `noteText(... "Notes" ...)` is at pdfcards.js:255 (`sed -n 253,257p src/engine/pdfcards.js`).
- **hifi.py readers.** `label_ratio`, `label_size` and `num_size` are at hifi.py:138-153. `fit_note(... LABEL_WIDTH_RATIO)` is at hifi.py:330-331 and 339-340.
- **pdfcards.js.** `labelRatio` is at 155, `labelSize` at 161 and `numSize` at 163. `LABEL_WIDTH_RATIO` is used at 359 and 369. The exports at 644-657 make `labelRatio` and `labelSize` public, and `numSize` appears only under `_internal`.
- **App block.** `index.html` 8173-8175 reads `const labelSize = HPE.pdfcards.labelSize; const NUM_RATIO = 0.64; function numSize(rNote) { return rNote * NUM_RATIO; }`.
- **Engine region markers in index.html.** pdfcards is 2656-3318, core 3319-4280 and layout 4603-5169.

The section 1 counting command returns 20 lines at `7ef7fda` and 12 on the proto.

### 4.2 Load order and loaders

- **`tools/inline_engine.py` `MODULES`:** fontdata, pdf, pdfdeck, pdfcards, core, voicing, layout, naming, select, share, sequence. pdfcards loads before core, so pdfcards must read `HPE.core` at call time. It already has `function core() { return HPE.core; }` (`grep -c 'core()' src/engine/pdfcards.js` gives 6 uses before the change).
- **`grep -n 'HPE.core' src/engine/layout.js`:** `fieldsOf` and `badNote` already read `HPE.core` at call time.
- **Layout without pdfcards.** `grep -rnE 'loadEngine\(|FULL_ENGINE_MODULES = ' tests tools | grep layout | grep -vE 'pdfcards.(,|\])' | wc -l` gives **21**. They fall into the two groups exactly as the prompt lists them:
  - **Group 1 (reach `labelFloor`), 16 lines:** layout.test.js:21, test_pdf_parity.py:365, select.test.js:27, sequence.test.js:422, 1224 and 1280 (`FULL_ENGINE_MODULES`, passed at 1293, 2163, 2207 and 2264), the eight pdfcards.test.js lines, gen_deck.js:132 and regen_engine_corpus.js:41.
  - **Group 2, 5 lines:** share.test.js:24, core.test.js:772, app.test.js:808, test_gen_deck.py:262 and select.test.js:876 (`noCore`).
- **Pdfcards without layout.** `grep -rnE 'loadEngine\(' tests tools | grep -E 'pdfcards.(,|\])' | grep -v layout | wc -l` gives **7**: pdf_build.js twice, test_render_agreement.py, pdf_builtin.test.js, and pdfcards.test.js 8, 335 and 348 (`late`). Every one of them loads `core`.
- **Hand-run sources.** `grep -rn 'readFileSync(path.join(ROOT, "src", "engine"' tests/*.js` gives share.test.js:721 and 723 (`engineAtVersion`: core then layout, no pdfcards) and coverage_merge.test.js:140 (text only).
- **`engine_reason` in test_gen_deck.py** (`sed -n 255,272p tests/test_gen_deck.py`) loads `core,voicing,layout,naming,select` and calls only `core.parseSeed`.

### 4.3 Pins

The pin grep `grep -n 'LABEL_RATIO\|NUM_RATIO\|OCTAVE_RATIO\|LABEL_WIDTH\|labelRatio\|label_ratio\|labelSize\|label_size\|numSize\|num_size\|labelFloor\|PRINT_NOTE' tests/*.py tests/*.js | wc -l` gives **102**. Every hit is classified below.

| hits | class |
|---|---|
| test_pdf_parity.py:358 (docstring), 366 (`HPE.layout.labelFloor` call), 378, 379 and 381 (`hifi.label_size`/`num_size` and its own `0.66`) | **pin**: LabelFloorTest `test_label_floor_uses_the_print_pipelines_ratios` |
| test_print.py:48-52 (`SPEC_*`), 62-72 (`spec_label_ratio`/`spec_label_size` helpers), 633, 635, 647, 762, 780 (SPEC uses) | **oracle**: deliberate spec copy, kept |
| test_print.py:673, 680, 681, 685, 718, 730, 731, 738, 749 (by-name `hifi.label_size`/`num_size` reads and SPEC_OCTAVE products) | **pin**: LabelSizeRuleTest |
| test_render_agreement.py:193, 195, 224, 411, 420-422, 425, 426, 453, 487 | **incidental**: substring hits on the per-field `label_sizes`/`labelSizes` drawn-size map; 411 is `test_diagram_label_sizes_agree`, regression step 2 |
| test_render_agreement.py:689-693 | **pin**: `test_the_diagram_label_rule_carries_the_same_constants` |
| coverage_merge.test.js:141 (`LABEL_SIZE` source-line fixture) | **pin** on pdfcards.js source text |
| coverage_merge.test.js:155, 164, 169, 172, 175, 178, 179, 185, 189, 196, 200, 204, 209, 213, 217, 218, 224, 225, 229, 230, 238, 242, 252, 255, 260 (25 lines) | **incidental**: `"labelSize"` used as a function name in synthetic coverage records |
| pdfcards.test.js:71-75 | **oracle**: product test "the label rule is r x ratio per zone, and the number takes no 1.05" |
| pdfcards.test.js:581, 592, 594, 595 | **incidental**: local `numSize` variable for the note line |
| pdfcards.test.js:601-610 | **pin and oracle**: "the label rule is public: HPE.pdfcards.labelRatio and labelSize match the internal figures" |
| select.test.js:505 | **pin**: by-name `layout.labelFloor` |
| layout.test.js:636, 640 | **incidental**: comment |
| layout.test.js:716, 717, 725, 740, 742 | **pin**: "every name the app draws fits inside the field it labels" reads the app's top-level `labelSize`/`numSize` |
| layout.test.js:1344 (comment), 1354 and 1375 (test titles) | **incidental** |
| layout.test.js:1346, 1376 | **pin**: by-name `HPE.layout.labelFloor` |

Further greps:

- **Test octave literals.** `grep -nE '[^0-9.]0\.66([^0-9]|$)' tests/*.py tests/*.js` gives:
  - **oracles:** test_pdf_parity.py:378, test_print.py:52, pdfcards.test.js:584 (note line), layout.test.js:1366;
  - **comment or unrelated:** test_print.py:617 (docstring), test_render_agreement.py:174 (comment), app.test.js:4065 (a random-number table).
- **Product literals.** `grep -nE '7\.0875|8\.0325|8\.232|- 6\.4\)' tests/*.js tests/*.py` hits pdfcards.test.js:71-75 only.
- **Constant pin.** `sed -n 679,696p tests/test_render_agreement.py` shows the pin regexes `var NAME = n;` over `src/engine/pdfcards.js` for five names (no octave).

### 4.4 Mutants

- `ls tests/mutants | wc -l` gives **942**.
- `python3 tools/refresh_mutants.py --check` at `7ef7fda` exits 0.
- `grep -lE 'PRINT_NOTE_RATIO|LABEL_RATIO|NUM_RATIO|labelRatio|label_ratio|size \* 0\.66|fs\*0\.66' tests/mutants/*` gives **11**, the eleven the prompt names. `c_bottom_label_stored_figure`'s removed line is hifi.py's `fs = fit_note(nm, ov, "Label", label_size(rr, zone),` call.
- **Recommended change.** The removed and context lines it changes, grepped against every patch's `-` and ` ` lines, hit five patches: `c_octave_digit_shrunk_under_the_floor` (hifi `size * 0.66`), `h_pdfcards_label_ratio_flat`, `r4a_label_size_drops_the_inflation`, `r4a_label_size_name_ratio_doubled` and `r_num_size_app_fudge`.
- **Proto, before re-anchoring.** `python3 tools/refresh_mutants.py --check` lists:
  - 3 UNFIXABLE: `c_octave_digit_shrunk_under_the_floor`, `h_pdfcards_label_ratio_flat`, `r_num_size_app_fudge`;
  - 6 mechanically refreshable: `l0_id_hashed_from_canonical_string` and `u_palette_hashed_into_deckid` (core.js context near `HPE.core = {`), `r4a_label_size_drops_the_inflation`, `r4a_label_size_name_ratio_doubled`, `r4e_pdfcards_label_ratio_not_exported` and `r4e_pdfcards_label_size_not_exported`.
- **Proto, after the re-anchors in section 6.** `refresh_mutants.py --check` exits 0. Each of these 16 was applied and its `# suite:` run, and all were killed: the 11, `c_bottom_label_stored_figure`, `l0`, `u`, and the 2 new mutants.
- **Unaffected.** `ap3_panfield_ignores_sets` matches only through its hunk header. It, `c_label_density_reintroduced`, `c_num_outgrows_the_name`, `g_bottom_octave_counted` and `c_bottom_label_stored_figure` are not flagged by `--check`. `c_num_outgrows_the_name` carries hifi.py literal context lines, which a2 does not change; they shift by 4 lines, which is offset only.

### 4.5 FLOORS, README, docs

- **FLOORS.** `grep -n 'test_render_agreement\|test_print.py\|test_pdf_parity' tests/suite_health.py` gives `tests/test_print.py: 44`, `tests/test_render_agreement.py: 26` and `tests/test_pdf_parity.py: 13`.
- **README.** `grep -n 'mutant patches' README.md` gives line 154, "942 mutant patches".
- **CLAUDE.md.** `grep -n 'The constants live twice' CLAUDE.md` gives 329. The sentence says the constants live in hifi.py and `pan()` in index.html. It was already inexact at `7ef7fda`, because the JS copy sat in pdfcards.js and layout.js, not `pan()`.
- **TODOS.md.** `grep -n 'Diagram label ratios are held three times' TODOS.md` gives 54 (row 54-59). Rows are retired by deletion; see the `b06eb3d` "TODOS: retire the cluster-oracle tie-break row" precedent.
- **Stale comment.** `grep -n 'index.html' tools/hifi.py` gives hifi.py:73 (proto 77), "the same constants and the same arithmetic live in `pan()` in index.html". It goes stale and Lane A rewrites it.
- **No CLAUDE.md test.** `grep -rn 'CLAUDE.md' tests/*.py tests/*.js` hits only comments. No test parses CLAUDE.md's label sentence, so Lane R's sentence is proved by the code tests it cites.
- **Origins.** `grep -n 'G-1' docs/plans/2026-10-14-refactor-pass-5.md` gives 211, 791, 963 (the proposal), 1005 and 1038 (pass 5's self-score row). `grep -n -i 'label ratio' docs/plans/2026-10-06-scale-syntax-and-layout-drawer.md` gives 572 (a reads-only list), 2458, "Unifying the label ratios into one source (TODOS; risk 8 stands)", and 2558 (the AD-ER-9 row that filed the TODOS entry).

### 4.6 Per-option measurements

**Option (a2): literals in core.js. Proto, all green.**

- **Load order.** No caller in either group changes its load list. Every caller loads `core`, except `select.test.js:876` (`noCore`), which throws "requires HPE.core" before reaching the code. `engineAtVersion` loads core.
- **Node:**
  - `node --test tests/layout.test.js tests/select.test.js tests/pdfcards.test.js tests/sequence.test.js tests/share.test.js tests/core.test.js tests/pdf_builtin.test.js tests/coverage_merge.test.js` gives **408 pass, 0 fail**.
  - `node --test tests/app.test.js` gives **502 pass, 0 fail**.
- **Python:**
  - `python3 -m unittest tests.test_render_agreement tests.test_print tests.test_pdf_parity tests.test_gen_deck` gives **Ran 115, OK** (114 at `7ef7fda` plus the guard test).
  - `python3 -m unittest discover -s tests -p 'test_*.py'` gives **Ran 250, OK**.
  - `python3 -m unittest tests.test_pdf_build` gives OK.
- **Tools and generated outputs:**
  - `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` are green.
  - `node tools/regen_engine_corpus.js --check` and `node tools/regen_card_fixture.js --check` match.
  - `node tools/regen_pan_fixture.js && git diff --stat -- tests/fixtures` is empty.
  - `node tools/gen_deck.js "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]" --anchor between` exits 0.
  - `python3 tools/validate.py` is all green.
- **New guard test.** `test_each_label_rule_number_is_written_once_per_language` is RED at `7ef7fda` (shown in a scratch worktree there: the JS and Python counts differ from 1) and green on the proto.
- **Not run:** browser e2e. CI's `validate` is the oracle; see the memory note on CHROME_BIN starvation.

**Option (a1): layout and the app read `HPE.pdfcards`; pdfcards keeps the literals.** I measured it in a scratch worktree at `7ef7fda`, with `labelFloor` reading `HPE.pdfcards` at call time and `numSize` exported.

| suite | result |
|---|---|
| layout.test.js | 4 fail |
| select.test.js | 46 fail |
| sequence.test.js | 18 fail |
| pdfcards.test.js | 16 fail |
| core.test.js | 1 fail (ET-1, through regen_engine_corpus.js) |
| test_pdf_parity LabelFloorTest | fail |
| test_gen_deck | 16 failures and 6 errors |
| `node tools/gen_deck.js ...` | exit 1 |
| `node tools/regen_engine_corpus.js --check` | exit 1 |
| share.test.js, app.test.js | 0 fail |

So (a1) must change 7 files' load lists, covering all 16 group-1 lines: layout.test.js, select.test.js, sequence.test.js, pdfcards.test.js, test_pdf_parity.py, tools/gen_deck.js and tools/regen_engine_corpus.js. Two of those are shipped tools.

**Option (b): hifi.py reads the JS source at import.** Not prototyped, because it is owner-gated.

- **Literals after:** JS 6 (with a2's move), Python 0.
- **Files:** hifi.py plus a regex reader, and every hifi-literal mutant. By the removed/context grep, beyond a2's set, that is `c_num_outgrows_the_name` (and `c_label_density_reintroduced` if `label_ratio`'s return lines change).
- **Constant pin.** `test_the_diagram_label_rule_carries_the_same_constants` becomes a tautology, because hifi would then hold whatever it parsed.
- **New dependency.** The print pipeline gains a runtime read of a JS source file.

**Option (c): JSON plus a sync step.** Not prototyped; owner-gated. Literals after: 1 (JSON), plus generated copies. It adds a new sync tool or mode and a new generated region in core.js or hifi.py. Mutants by name: see the section 5 row, measured by the removed/context grep.

**Option (d): a new engine module `labels.js`.** Not prototyped; owner-gated. Literal counts are the same as a2. It is a new `MODULES` entry, a new generated region in index.html, and every `loadEngine` list (48 lines, `grep -rnE 'loadEngine\(' tests tools | wc -l`) must name it, or it must be loaded implicitly. Mutants by name: see the section 5 row, measured by the removed/context grep.

## 5. Options

| | (a1) JS reads pdfcards | **(a2) JS reads core** (recommended) | (b) Python reads JS | (c) JSON + sync | (d) new module |
|---|---|---|---|---|---|
| JS literals before → after | 13 → 6 (pdfcards) | 13 → 6 (core.js) | 13 → 6 | 13 → 0 hand-written | 13 → 6 |
| Python literals before → after | 7 → 6 | 7 → 6 | 7 → 0 | 7 → 0 hand-written | 7 → 6 |
| Files touched | pdfcards, layout, index.html, hifi, test_render_agreement, plus 7 load-list files | core, pdfcards, layout, index.html, hifi, test_render_agreement | a2's set plus a hifi reader | new JSON, new or extended sync tool, generated regions | new module, inline_engine `MODULES`, index.html, loaders |
| Mutants re-anchored or replaced | 2 rewritten (`c_octave_digit_shrunk_under_the_floor`, `r_num_size_app_fudge`), 5 refreshed (`h_pdfcards_label_ratio_flat`, `r4a_label_size_drops_the_inflation`, `r4a_label_size_name_ratio_doubled`, `r4e_pdfcards_label_ratio_not_exported`, `r4e_pdfcards_label_size_not_exported`) by `refresh_mutants.py --check` on a scratch build; 0 on load-list lines (`grep -lE '^[- ].*(loadEngine\(|FULL_ENGINE_MODULES =)' tests/mutants/*.patch` is empty) | 3 rewritten (`c_octave_digit_shrunk_under_the_floor`, `h_pdfcards_label_ratio_flat`, `r_num_size_app_fudge`), 6 refreshed (`l0_id_hashed_from_canonical_string`, `u_palette_hashed_into_deckid`, `r4a_label_size_drops_the_inflation`, `r4a_label_size_name_ratio_doubled`, `r4e_pdfcards_label_ratio_not_exported`, `r4e_pdfcards_label_size_not_exported`), 2 new; 942 → 944 | a2's plus `c_num_outgrows_the_name` | a2's set plus `c_num_outgrows_the_name` (its hifi literal context lines become generated), by the removed/context grep against the a2 diff, plus new mutants for the sync tool | a2's set minus `l0_id_hashed_from_canonical_string` and `u_palette_hashed_into_deckid` (core.js untouched), by the same grep; 0 on `MODULES` or `loadEngine` lines (`grep -lE '^[- ].*(MODULES|loadEngine\()' tests/mutants/*.patch` is empty) |
| Test bodies that must change | 7 load lists, plus the a2 set | `test_the_diagram_label_rule_carries_the_same_constants` re-pointed to core.js and made STRICTER (adds `OCTAVE_RATIO`); one new test | the constant pin becomes a tautology | sync `--check` tests | every loader list |
| Load-order risk | **breaks 16 group-1 callers** (measured, 4.6) | none: every caller loads core; pdfcards reads at call time | as a2: none (JS side is a2's) | as a2 for consumers, plus the generated-region order | new module position |
| `test_print.py` SPEC copy | keep | **keep**: a spec oracle, not duplication. No stronger oracle replaces it, because test_render_agreement compares the renderers to each other and not to the spec. | keep | keep | keep |
| Sync step or cross-language read | no | **no** | new cross-language read | **new sync step** | **new generated region** |
| Meets the request | yes | **yes** | owner-gated | owner-gated | owner-gated |

**Recommendation: (a2).** It is the most conservative option that meets the request:

- it adds no sync step, no region and no cross-language read;
- it changes no caller's load list, while (a1) breaks 16;
- the Python copy stays pinned by an existing test, which a2 makes stricter.

`core.js` is the home because every consumer already loads it before calling. pdfcards reads it through its existing `core()` helper at call time, `layout.labelFloor` reads `HPE.core` at call time the way `fieldsOf` already does, and the app reads it at top level after every engine region has loaded.

## 6. Lanes

Two lanes: one code lane, then the reconcile lane. Splitting Python from JS would put `tests/test_render_agreement.py`, which pins both, in two lanes of one wave. Splitting by JS module would put `index.html` in every lane. So one code lane is the split by file ownership.

### Lane A: `claude/g1-one-source`, wave 1

- **Worktree:** `.claude/worktrees/g1-one-source` (`git worktree add --detach` from `origin/main`, then `git checkout -b claude/g1-one-source`).
- **Goal:** the section 1 count goes from 20 lines to 12, with every glyph unchanged.
- **Non-goals:** section 2. No README, FLOORS, TODOS or CLAUDE.md edits (Lane R owns those). No app CSS. No solver ratio.
- **Owned files:**
  - code and tests: `src/engine/core.js`, `src/engine/pdfcards.js`, `src/engine/layout.js`, `index.html` (engine regions via `inline_engine.py`, plus the app block by the `const labelSize = HPE.pdfcards.labelSize` line and `function panLabel`), `tools/hifi.py`, `tests/test_render_agreement.py`;
  - mutants re-anchored: `tests/mutants/c_octave_digit_shrunk_under_the_floor.patch`, `h_pdfcards_label_ratio_flat.patch`, `r_num_size_app_fudge.patch`, `l0_id_hashed_from_canonical_string.patch`, `u_palette_hashed_into_deckid.patch`, `r4a_label_size_drops_the_inflation.patch`, `r4a_label_size_name_ratio_doubled.patch`, `r4e_pdfcards_label_ratio_not_exported.patch`, `r4e_pdfcards_label_size_not_exported.patch`;
  - new mutants: `tests/mutants/lr_core_octave_ratio_drifts.patch`, `tests/mutants/lr_layout_floor_rewrites_a_literal.patch`. The `lr_` prefix is unused (`ls tests/mutants | grep -c '^lr_'` gives 0). The existing `g1_*` prefix belongs to an older grammar lane and is avoided.
- **Pinning tests** (all green at `7ef7fda`):
  - `tests/test_render_agreement.py` `test_diagram_label_sizes_agree`, `test_diagram_number_sizes_agree` and `test_the_diagram_label_rule_carries_the_same_constants`;
  - `tests/test_print.py` `LabelSizeRuleTest` (all methods, including `test_no_label_falls_below_the_print_floor` and `test_numbers_are_drawn_by_the_rule_too`);
  - `tests/test_pdf_parity.py` `LabelFloorTest.test_label_floor_uses_the_print_pipelines_ratios`;
  - `tests/pdfcards.test.js` "the label rule is r x ratio per zone, and the number takes no 1.05" and "the label rule is public: HPE.pdfcards.labelRatio and labelSize match the internal figures";
  - `tests/layout.test.js` "every name the app draws fits inside the field it labels" and "bottom octave digits do not trigger the warning";
  - `tests/coverage_merge.test.js` "sanity: the fixture offsets point at labelSize in both files";
  - `tests/app.test.js` "the card render still matches the committed digest of every built-in card" and "DR1 line 40: the pan drawn with interactive off is byte-identical to the shipped output for all five built-in decks";
  - `tests/test_pdf_build.py` `test_committed_pdfs_match_a_fresh_build`.
- **New test:** `test_each_label_rule_number_is_written_once_per_language` (in `PdfEmitterGeometryTest`). It is RED at `7ef7fda` and killed by `lr_layout_floor_rewrites_a_literal`.
- **Mutant delta:** +2 (942 → 944).
- **FLOORS delta:** `tests/test_render_agreement.py` +1 test (26 → 27), set by Lane R from CI. No new test file, so no new FLOORS row and no README suite-count change.

Steps (TDD order). The verify commands run from `/Users/ray/Projects/handpan-cards/.claude/worktrees/g1-one-source`.

1. **Baseline.** Run the pinning tests on the fresh branch before any edit.
   - Accept: all green.
   - Verify: `python3 -m unittest tests.test_render_agreement tests.test_print tests.test_pdf_parity tests.test_pdf_build && node --test tests/pdfcards.test.js tests/layout.test.js tests/coverage_merge.test.js tests/app.test.js`
2. **Guard test first (RED).** Add `test_each_label_rule_number_is_written_once_per_language` to `PdfEmitterGeometryTest`. It counts the six figures with `(?<![0-9.])(fig)(?![0-9])`, skips comment lines (`\s*(#|\*|//|/\*)`) and lines containing `F_NUM_RATIO`, and covers `src/engine/*.js` plus `index.html` with every `<!-- engine:(\w+) begin.*?<!-- engine:\1 end -->` region removed (`re.S`). It also covers `tools/*.py`. It asserts each figure is counted exactly once per language. Commit it.
   - Accept: it FAILS at this commit.
   - Verify: `python3 -m unittest -k test_each_label_rule_number_is_written_once_per_language tests.test_render_agreement; test $? -ne 0`
3. **Re-point and tighten the constant pin.** Re-point `test_the_diagram_label_rule_carries_the_same_constants` to `src/engine/core.js` and add `("OCTAVE_RATIO", hifi.OCTAVE_RATIO)` to its tuple, which makes it stricter. Change the message to "is gone from core.js" and the docstring's "These five" to "These six". Then add the six `var`s and a frozen `LABEL_RULE` to `core.js`, just before `HPE.core = {`, and export `LABEL_RULE: LABEL_RULE` from `HPE.core`. Add `OCTAVE_RATIO = 0.66` to `tools/hifi.py` above `note_w`, and use it in `note_w` and in `note_text`'s octave `setFont`.
   - Accept: the constant pin is green with six names.
   - Verify: `python3 -m unittest -k test_the_diagram_label_rule_carries_the_same_constants tests.test_render_agreement`
4. **pdfcards reads core.**
   - Delete the five `var`s.
   - Add `function rule() { return core().LABEL_RULE; }`.
   - `labelRatio` returns `rule().LABEL_RATIO_*`, and `numSize` returns `rNote * rule().NUM_RATIO`.
   - Both `* 0.66` (`noteW`, `noteText`) become `* rule().OCTAVE_RATIO`.
   - Both `* LABEL_WIDTH_RATIO` (the two `fitNote` calls in the pan drawer) become `* rule().LABEL_WIDTH_RATIO`.
   - Add `numSize: numSize,` to the public export after `labelSize`, and keep it under `_internal`.
   - Leave the line `function labelSize(r, zone) { return r * labelRatio(zone); }` byte-identical, so the `coverage_merge.test.js` fixture needs no edit.
   - Accept: the pdfcards tests are green.
   - Verify: `python3 tools/inline_engine.py && node --test tests/pdfcards.test.js tests/pdf_builtin.test.js tests/coverage_merge.test.js`
5. **layout reads core.**
   - Delete `PRINT_NOTE_RATIO`, `PRINT_BNOTE_RATIO`, `PRINT_NUM_RATIO` and `PRINT_OCTAVE_RATIO` from module scope.
   - At the top of `labelFloor(geom)`, bind `var rule = HPE.core.LABEL_RULE;` and the four same-named locals from it. That keeps every `sizes.push` line byte-identical, so `g_bottom_octave_counted` and `c_label_density_reintroduced` keep their anchors.
   - Rewrite the comment above `PRINT_HALF` to name `HPE.core.LABEL_RULE` (read at call time) and `tests/test_pdf_parity.py` as the pin to hifi. Add no file:digit refs (`test_readme_currency` line-ref ratchet).
   - Accept: green.
   - Verify: `node --test tests/layout.test.js tests/select.test.js tests/sequence.test.js tests/share.test.js tests/core.test.js && python3 -m unittest tests.test_pdf_parity tests.test_gen_deck`
6. **App reads the engine, and the inline sync.**
   - In the app block, replace `const NUM_RATIO = 0.64;` and `function numSize(...)` with `const numSize = HPE.pdfcards.numSize;` and `const OCTAVE_RATIO = HPE.core.LABEL_RULE.OCTAVE_RATIO;`.
   - In `panLabel`, `fs*0.66` becomes `fs*OCTAVE_RATIO`.
   - `labelSize` and `numSize` stay bound at the app's top level to the functions `pan()` calls, so the layout.test.js app-fit test needs no edit.
   - Run `python3 tools/inline_engine.py`.
   - Accept: `--check` green, the app tests green, fixtures unchanged.
   - Verify: `python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && node --test tests/app.test.js tests/layout.test.js && node tools/regen_pan_fixture.js && git diff --stat -- tests/fixtures data | wc -l | grep -qx 0`
7. **Stale comment in hifi.** Rewrite the hifi comment under `# ---- diagram label sizing` so it says the JS copy is `HPE.core.LABEL_RULE` in `src/engine/core.js`, pinned by `tests/test_render_agreement.py`. No file:digit refs.
   - Accept: the guard test from step 2 is now GREEN, and the counting command prints 12 lines.
   - Verify: save section 1's command block (without its `cd` line) as `/tmp/g1count.sh`, then `python3 -m unittest tests.test_render_agreement tests.test_readme_currency && bash /tmp/g1count.sh | wc -l | grep -qx 12`
8. **Mutants.**
   - Run `python3 tools/refresh_mutants.py` (it refreshes the 6 mechanical ones) on a committed tree.
   - Rewrite the 3 UNFIXABLE ones one-for-one, keeping each one's `# kills:` and `# suite:` headers and stripping `index` lines:
     - `c_octave_digit_shrunk_under_the_floor`: hifi `note_text`'s `c.setFont(font, size * OCTAVE_RATIO)` → `size * 0.40`.
     - `h_pdfcards_label_ratio_flat`: remove the `if (zone === "ding") return rule().LABEL_RATIO_DING;` and `if (zone === "bottom") return rule().LABEL_RATIO_BNOTE;` lines, so every zone gets the rim ratio.
     - `r_num_size_app_fudge`: the app's `const numSize = HPE.pdfcards.numSize;` → `const numSize = (rNote) => HPE.pdfcards.numSize(rNote) * 1.1;`.
   - Add the two new mutants:
     - `lr_core_octave_ratio_drifts`: core.js `var OCTAVE_RATIO = 0.66;` → `0.6`; `# kills: test_the_diagram_label_rule_carries_the_same_constants`.
     - `lr_layout_floor_rewrites_a_literal`: in `labelFloor`, `var PRINT_NUM_RATIO = rule.NUM_RATIO;` → `var PRINT_NUM_RATIO = 0.64;`; `# kills: test_each_label_rule_number_is_written_once_per_language`. This break draws the same, so only the guard sees it.
   - The `# suite:` lines take the CONTRACT form, with no quotes:
     - `python3 -m unittest -k <test> tests.test_render_agreement`
     - `node --test --test-name-pattern ^...$ tests/<file>.test.js`, with `.` for spaces.
   - Accept: `--check` green, 944 files, and every mutant in the loop below killed: the 3 rewritten, the 2 new, the 4 `r4a_`/`r4e_` refreshed, `l0_id_hashed_from_canonical_string`, `u_palette_hashed_into_deckid`, and the five with unchanged anchors `c_bottom_label_stored_figure`, `ap3_panfield_ignores_sets`, `c_label_density_reintroduced`, `c_num_outgrows_the_name`, `g_bottom_octave_counted`. On the proto all 16 were killed by hand (4.4).
   - Verify: `python3 tools/refresh_mutants.py --check && ls tests/mutants | wc -l | grep -qx 944`, then the loop below on a clean, committed tree. `tests/mutation_check.sh` takes no name filter (only `MUTANT_SHARD`), so each patch is applied by hand. A patch that edits `src/engine/*.js` is checked by the module-loading suites named in its `# suite:` line, the way the harness checks it.
     ```
     for m in c_octave_digit_shrunk_under_the_floor h_pdfcards_label_ratio_flat r_num_size_app_fudge lr_core_octave_ratio_drifts lr_layout_floor_rewrites_a_literal r4a_label_size_drops_the_inflation r4a_label_size_name_ratio_doubled r4e_pdfcards_label_ratio_not_exported r4e_pdfcards_label_size_not_exported l0_id_hashed_from_canonical_string u_palette_hashed_into_deckid c_bottom_label_stored_figure ap3_panfield_ignores_sets c_label_density_reintroduced c_num_outgrows_the_name g_bottom_octave_counted; do
       p=tests/mutants/$m.patch; git apply "$p" || exit 1
       PYTHONDONTWRITEBYTECODE=1 sh -c "$(grep -m1 '^# suite:' "$p" | sed 's/^# suite:[[:space:]]*//')" >/dev/null 2>&1; rc=$?
       git apply -R "$p"; [ $rc -ne 0 ] || { echo "SURVIVED $m"; exit 1; }
     done; git diff --quiet
     ```
     CI's full gate then covers every unchanged mutant.
9. **Full local smoke, then CI.**
   - Accept: CI `validate` at the verified head SHA concluded success, including the mutation gate and suite health.
   - Verify: `python3 tools/validate.py && python3 -m unittest discover -s tests -p 'test_*.py' && node --test tests/*.test.js`, then push. `gh pr view <pr> --json state,headRefOid,mergeable` (re-query once if the head lags), and `gh run watch` then `gh run list --commit <sha> --workflow validate --json conclusion`. Return in the same turn; never end the turn waiting.

### Lane R: `claude/g1-reconcile`, wave 2

- **Worktree:** `.claude/worktrees/g1-reconcile`, from `origin/main` after Lane A merges.
- **Goal:** the docs and counts state the new truth, each with the test that proves it.
- **Non-goals:** any code, test, mutant or fixture edit.
- **Owned files:** `README.md`, `tests/suite_health.py` (the FLOORS row only), `TODOS.md`, `CLAUDE.md`.
- **Pinning tests** (green on main before): `tests/test_readme_currency.py` `test_the_mutant_count_is_stated_within_a_lane_of_the_truth` and `test_stale_line_refs_in_comments_match_the_allowlist_exactly`; `tests/suite_health.py`; `test_the_diagram_label_rule_carries_the_same_constants`; `test_each_label_rule_number_is_written_once_per_language`.
- **Mutant delta:** 0.
- **FLOORS delta:** `tests/test_render_agreement.py` 26 → 27 (from CI).

Steps (run from `/Users/ray/Projects/handpan-cards/.claude/worktrees/g1-reconcile`):

1. **Read the numbers from main's CI**, taking them from main's `validate` run at Lane A's merge commit:
   - the mutant total from the mutation-gate artifacts (`files[].total` / `by_module`);
   - the `test_render_agreement.py` test count from the python-results artifact.

   Accept: two integers recorded in the PR body with the run id. Expected values are 944 and 27.

   Verify: `gh run list --branch main --workflow validate --limit 1 --json databaseId,headSha,conclusion` and `gh run download <id> -n python-results -D /tmp/g1r` and `gh run download <id> -p 'mutant-shard-report-*' -D /tmp/g1r` (scratch dir).
2. **README.** "942 mutant patches" becomes the CI figure.
   - Accept: test green.
   - Verify: `python3 -m unittest -k test_the_mutant_count_is_stated_within_a_lane_of_the_truth tests.test_readme_currency`
3. **FLOORS.** The `"tests/test_render_agreement.py": 26` row becomes the CI count (27). No row is lowered.
   - Accept: suite health green.
   - Verify: `python3 tests/suite_health.py`
4. **TODOS.** Delete the "Diagram label ratios are held three times" row; it is resolved by Lane A's guard test.
   - Accept: the row is gone.
   - Verify: `grep -c 'Diagram label ratios are held three times' TODOS.md | grep -qx 0 && python3 -m unittest -k test_each_label_rule_number_is_written_once_per_language tests.test_render_agreement`
5. **CLAUDE.md.** Replace "The constants live twice - `tools/hifi.py` (`LABEL_RATIO_*`, `NUM_RATIO`) and `pan()` in `index.html` -" with: "The constants are written once per language - `HPE.core.LABEL_RULE` in `src/engine/core.js` (read by `pdfcards.js`, by `layout.js`'s `labelFloor` and by `pan()` in `index.html`) and `tools/hifi.py` (`LABEL_RATIO_*`, `NUM_RATIO`, `OCTAVE_RATIO`, `LABEL_WIDTH_RATIO`) - `tests/test_render_agreement.py` `test_the_diagram_label_rule_carries_the_same_constants` pins the two copies equal and `test_each_label_rule_number_is_written_once_per_language` fails on any second copy; and `tests/test_render_agreement.py` pins the two renderers ...". The rest of the sentence is kept unchanged. Add no file:digit refs.
   - Accept: both cited tests green; the line-ref ratchet green.
   - Verify: `python3 -m unittest -k test_the_diagram_label_rule_carries_the_same_constants -k test_each_label_rule_number_is_written_once_per_language tests.test_render_agreement && python3 -m unittest tests.test_readme_currency`
6. **CI.**
   - Accept: CI `validate` success at the verified head SHA.
   - Verify: as in Lane A step 9.

## 7. Merge order and waves

- **Wave 1: Lane A.** It is the only code lane, and it owns every source, test and mutant file in the change.
- **Wave 2: Lane R**, after Lane A merges. Its README mutant count and FLOORS row must come from main's CI artifacts at Lane A's merge commit, never from a hand count. Its CLAUDE.md and TODOS text describes code that exists only after Lane A, and the tests it cites (`test_each_label_rule_number_is_written_once_per_language`) exist only on main after Lane A.

No file is in two lanes, and no wave has two lanes.

## 8. Standing merge gates

Every lane must satisfy all of the following before merge:

- **CI.** CI `validate` concluded success at a head SHA verified against the local tip. Gate on `gh run list --commit <sha> --workflow validate --json conclusion`, not on `gh pr checks` buckets, because a check-run can sit `in_progress` with conclusion success.
- **Review.** An independent `swarm-reviewer` returned PASS or PASS_WITH_NITS at that same SHA. A FAIL is fixed and re-reviewed by a fresh reviewer.
- **Gates.** The mutation gate and suite health are green at that SHA. A lone survivor on an unrelated diff is rerun at the same SHA first.
- **Ownership.** No ownership violation: the diff touches only the lane's owned files.

Pitfalls that bind every lane and reviewer:

- A CONFLICTING PR queues no CI run. Check `gh pr view <pr> --json mergeable` before suspecting Actions.
- `headRefOid` can lag a push by seconds. Re-query once before calling a head mismatch.
- Reviewer worktrees take no `node_modules` symlink, because it breaks `CanonicalSourceTest`. This repo needs none.
- Never `cp -r` a linked worktree. Use `git worktree add --detach`.
- Never edit a worktree while `tests/mutation_check.sh` runs on it.
- Never rename a test. Mutant patches carry no `index` lines, and `# suite:` headers take `.` wildcards, never quotes.
- Lane briefs cite functions and markers, never `index.html` line numbers.
- A lane polls with `gh run watch` and returns in the same turn.

## 9. Decisions

1. **Home of the JS literal set.** Options: core.js (a2), pdfcards.js (a1), a new module (d). Recommended: **core.js**. Every consumer already loads it, and it breaks 0 callers where a1 breaks 16. (d) is a new generated region, so it goes to section 10.
2. **Shape in core.js.** Options: six `var`s plus a frozen `HPE.core.LABEL_RULE` object; or six separate `HPE.core` exports. Recommended: **six `var`s plus `LABEL_RULE`**. The `var NAME = n;` form keeps the existing constant pin's regex working unchanged, and one object keeps the `HPE.core` surface to one name.
3. **Add the one-source guard test.** Options: add it; or rely on the existing constant pin. Recommended: **add it**. Without it, nothing stops a second JS literal from coming back, which is exactly what `lr_layout_floor_rewrites_a_literal` shows.
4. **Make `pdfcards.numSize` public.** Options: public export; or the app reads `HPE.core.LABEL_RULE.NUM_RATIO` and keeps its own `numSize`. Recommended: **public export**. The app then calls the same function the PDF calls, which is what the "public" pdfcards test already expects of `labelSize`. `_internal.numSize` stays, so the product test is untouched.
5. **Name the Python octave constant `OCTAVE_RATIO`.** Options: `OCTAVE_RATIO`; or keep `0.66` inline twice in hifi.py. Recommended: **`OCTAVE_RATIO`**. Inline twice is two literals and fails the request. The name matches JS, so the pin can compare it.
6. **Treat 0.66 as a label-rule constant even though the note line also uses it.** Recommended: **yes, explicitly**. It is the same arithmetic in both places in each print renderer. `tests/pdfcards.test.js`'s note-line oracle (`sz * 0.66`), `test_pdf_build`'s committed-PDF text check and the parity glyph sweeps show the note line unchanged. The proto was green on all three.
7. **One code lane or a Python/JS split.** Recommended: **one lane**. `test_render_agreement.py` pins both languages, and any split puts it, or `index.html`, in two lanes of a wave.
8. **Keep `tests/test_print.py`'s SPEC copy.** Recommended: **keep** (section 11).
9. **Keep `_internal.numSize` alongside the public one.** Recommended: **keep**. Removing it would edit the product test's read path.

## 10. Owner-gated proposals (never auto-picked)

1. **(b) hifi.py reads the JS literals at import time.**
   - *Benefit:* Python goes from 6 literals to 0, so the repo holds one set.
   - *Cost:*
     - The print pipeline gains a runtime dependency on the text of `src/engine/core.js`, a new non-test cross-language read.
     - `test_the_diagram_label_rule_carries_the_same_constants` becomes a tautology, so the cross-language pin is lost rather than gained.
     - A regex parse error in a JS file breaks `python3 tools/decks.py`.
     - `c_num_outgrows_the_name` must be re-anchored on top of a2's set.
   - It does not reduce the JS count further than a2.
2. **(c) A JSON source plus a sync step** that writes both languages' constants.
   - *Benefit:* one hand-written literal set in total.
   - *Cost:* a new sync tool or mode, a fourth "never hand-edit" generated region (in core.js and in hifi.py, or a generated Python module), a new `--check` in validate, and new mutants for the tool. This is the architecture change pass 5 declined to make.
3. **(d) A new engine module (`labels.js`).**
   - *Benefit:* the constants sit apart from the scale parser in core.js.
   - *Cost:* a new `MODULES` entry and a new generated region in `index.html`. It also needs either an edit to every one of the 48 `loadEngine` lines in tests and tools, or implicit loading in `engine_loader.js`, which is a loader behaviour change. Literal counts are the same as a2.

No proposal changes a visible pixel. The app's `.62em` note-line subscript is not proposed for change (section 11).

## 11. Deliberately left

- **`tests/test_print.py` `SPEC_LABEL_RATIO_*`, `SPEC_NUM_RATIO`, `SPEC_OCTAVE_RATIO`, and the helpers `spec_label_ratio` and `spec_label_size`.** These are a deliberate spec oracle, not duplication: a wrong value at the single source fails `LabelSizeRuleTest`. `test_render_agreement` is not a stronger oracle, because it compares the renderers to each other and both read the same source.
- **`tests/pdfcards.test.js` products** 7.0875, 8.0325, 8.232 and 6.4 in "the label rule is r x ratio per zone, and the number takes no 1.05". This is an oracle. It keeps reading `P._internal.labelSize` and `numSize`, the same functions the PDF calls, and after Lane A the same functions the app calls (`HPE.pdfcards.labelSize === _internal.labelSize`; `numSize` likewise).
- **`tests/pdfcards.test.js` `labelRatio` literals** 0.70875, 0.80325 and 0.8232 in "the label rule is public: ..." (oracle).
- **`tests/pdfcards.test.js` note-line `sz * 0.66`** (oracle for the note line).
- **`tests/test_pdf_parity.py` `hifi.label_size(r, "rim") * 0.66`** in `LabelFloorTest` (oracle for the floor's octave term).
- **`tests/layout.test.js` `0.66 * 0.8232`** in "bottom octave digits do not trigger the warning" (oracle).
- **The solver `F_*_RATIO` constants**, including `F_NUM_RATIO = 0.64`. They are the solver's budget, a different concept that happens to share 0.64. They are out of scope and excluded from the count by name.
- **The app's note-line subscript `.notesline sub{font-size:.62em}`.** It is a different figure from print's 0.66. Unifying it would move app pixels, which is a visual change for the owner and not part of a pure refactor.
- **The generated engine-region copies in `index.html`.** They are generated; `inline_engine.py --check` and validate check 4 guard them.
- **`tests/coverage_merge.test.js`'s `LABEL_SIZE` source-line fixture.** It is unchanged because Lane A keeps that line byte-identical.

## 12. Risk register

| lane | what could regress | existing test that catches it | new test that must | expected review bounces |
|---|---|---|---|---|
| A | a ratio or octave size moves in print | `LabelSizeRuleTest`, `test_pdf_build` committed PDFs, test_pdf_parity glyph sweeps | - | |
| A | an app label or number or octave size moves | `test_diagram_label_sizes_agree`, `test_diagram_number_sizes_agree`, app.test.js `pan_render_v1.json` tests, layout.test.js app-fit test | - | |
| A | load order: pdfcards reads core at load time and throws in index.html (pdfcards precedes core) | app.test.js boot, pdfcards.test.js 348 `late` | - | |
| A | `labelFloor` reads core in a caller without core | select.test.js:876 `noCore` throws first (expected); every other caller loads core (4.2) | - | |
| A | a second JS or Python literal creeps back | none today | `test_each_label_rule_number_is_written_once_per_language` (killed by `lr_layout_floor_rewrites_a_literal`) | |
| A | JS and Python copies drift | `test_the_diagram_label_rule_carries_the_same_constants`, made stricter with `OCTAVE_RATIO` | `lr_core_octave_ratio_drifts` proves the octave arm | |
| A | a mutant re-anchored to the wrong reason, or a stale anchor | `refresh_mutants.py --check`, mutation gate | - | |
| A | the guard test's regex counts an unrelated future `0.64` or `0.66` in the app block or an engine module, and goes red | the guard test itself, with an explicit message per figure | - (accepted: a new use names the constant instead) | |
| A | a new comment adds a file:digit line ref | `test_stale_line_refs_in_comments_match_the_allowlist_exactly` | - | |
| A | total | | | **1**: the mutant re-anchors and the guard-test scope are the likeliest reviewer findings |
| R | a doc sentence claims something the code contradicts (#299 and #301 precedent) | the cited tests; the reviewer re-verifies every sentence | - | |
| R | README count or FLOORS row hand-counted | `test_the_mutant_count_is_stated_within_a_lane_of_the_truth`, `suite_health.py` | - | |
| R | total | | | **1** |

Expected review bounces in total: **2** (A: 1, R: 1).

Projection: N = 2 lanes. X = 2 × 2 + 2 × 2 = 8 subagent runs. Y = 2 + 2 = 4 CI runs.

## Self-score

| # | criterion | score | evidence |
|---|---|---|---|
| 1 | Section 0 quotes the owner decision; 0.1 lists every contradicted fact | 1 | 0 verbatim; 0.1: none contradicted, two refinements stated |
| 2 | Every number in section 4 carries its command | 1 | 4.1-4.6 |
| 3 | Every option has the Design-space measurements | 1 | 4.6 and the section 5 table: literals, files, mutants, test bodies, load order, SPEC copy |
| 4 | The recommendation meets the request with no sync step and no new cross-language read | 1 | a2: JS 6 literals, Python 6, pinned; proto green |
| 5 | No file in two lanes of one wave; every src/engine lane owns index.html | 1 | Lane A owns index.html; Lane R is in wave 2 and owns no code |
| 6 | Every step has an acceptance criterion and a verify command | 1 | A1-A9, R1-R6 |
| 7 | Every moved-target mutant named with its re-anchor; deltas sum | 1 | 3 rewritten, 6 refreshed, 2 new; +2 + 0 = 944 |
| 8 | Every lane names a pinning test green on main, or a new one RED against a committed mutant | 1 | Lane A pin list and the guard test (RED at `7ef7fda`, `lr_layout_floor_rewrites_a_literal`); Lane R cites test_readme_currency and suite_health |
| 9 | Sections 2, 10 and 11 cover every non-goal, owner-gated item and left copy | 1 | 2 (all prompt non-goals), 10 (b, c, d), 11 (every test literal from 4.3, the solver ratios, `.62em`) |
| 10 | VERDICT counts match sections 5, 6 and 10; X and Y follow the rule | 1 | N=2, a2, K=3, bounces 2, so X=8 and Y=4 |

VERDICT: 2 lanes, option a2, 3 owner-gated proposals, projected 8 subagent runs and 4 CI runs
