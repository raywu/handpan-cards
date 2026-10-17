# Plan: rewrite the README and add an MIT license (2026-10-17)

This is a plan only. It changes no app, engine, data or test behaviour.
It is based on `origin/main` at bfde903.

Evidence marks:
- **[V]** verified against the repo at that commit.
- **[O]** observed by running something here.
- **[A]** an assumption or an inference.

Code is cited by file and line at bfde903, or by test name. Line numbers are for this plan's reader only; the lane must not copy them into any file.

Owner request (verbatim, binding): "rewrite README completely - focus on the value prop of chords, progression, and flashcard for practices, and add MIT license and instructions on how to clone and what another developer should know. keep it brief, concise, no hyperbole or grand statements. I want readme to be practical and no fluff. remove any unnecessary adverbs or adjectives, and make sure no redundant concepts are repeated. do not use any LLM speak, make sure it sounds human."

## 1. Goal and non-goals

**Goal.** At the lane's head, `README.md` is at most 120 lines, follows the outline in section 2 and the checklist in section 3, a `LICENSE` file holds the MIT text for Ray Wu 2026, and `validate` is green at that SHA.

**Non-goals**
- No change to `index.html`, `src/engine/`, `data/decks.json`, `tools/` or any test's behaviour.
- No currency test is loosened, renamed or deleted (`tests/test_readme_currency.py`). Section 4 shows none needs to change.
- No `CLAUDE.md` edit beyond the one line that describes the README (`CLAUDE.md:38`).
- No new docs file. Hosting and layout provenance move nowhere; `CLAUDE.md` already holds both (section 4, "What leaves the README").
- No change to the About copy, the site, or `docs/ENGINE-SPEC.md` (unless the owner picks Q3 (b)).
- No licence claim over the fonts (section 2, "License").

## 2. Outline of the new README

Each concept appears in one section only. "Carries" lists the facts the section must state; anything not listed stays out.

### `# Handpan Chords`
- **Job:** say what the app is in two sentences and give the live URL.
- **Carries:** chord flashcards and chord progressions for a handpan scale; runs in the browser with no account; URL `https://handpan.raywu.org/` (`index.html:23`, the canonical link) [V].

### `## Practising with it`
- **Job:** what a practice session looks like. This is the value-prop section the owner asked for.
- **Carries:**
  - Flashcards: tap to flip, swipe or arrow keys to move. Two directions: NAME → NOTES (read the name, find the notes) and NOTES → NAME (read the lit pan, name the chord). SHUFFLE.
  - What a card shows: the chord name, the pan diagram with every field of the chord's pitch classes lit (root in one colour, other tones in another), and the notes and field numbers in spelling order from the root.
  - Progressions: the Chord progression group in the menu, EASY / MEDIUM / HARD, gives a loop of 2 to 6 chords to play (`index.html:1546-1551`; README:48-49 today, from `src/engine/sequence.js`) [V].
  - Deck, mode and paper choices are remembered in the browser.
- **Must not carry:** test names, element ids, storage keys.

### `## Decks`
- **Job:** list the five built-in decks.
- **Carries:** each deck name with its card count, in picker order: D Kurd 10, 49; D Amara 10, 29; D Amara 9, 27; C# Hijaz 9, 19; F3 Low Pygmy 18, 53. Then the sentence "177 cards total". D Kurd 10 is the default deck.
- **Format constraint (currency test):** the FIRST mention of each deck name anywhere in the README must be followed by its count before the next `.` or `;` and within 40 characters (`tests/test_readme_currency.py:54-66`) [V]. So no deck name may appear earlier in the file, and "D Kurd 10 is the default" must come after the list. A Markdown list such as `- D Kurd 10: 49 cards` satisfies it.
- **Must not carry:** palette colours, which deck has a committed PDF.

### `## Your own scale`
- **Job:** how to make a deck for any pan, and how to share it. Brief.
- **Carries:**
  - Menu → + ADD A SCALE. Type the notes low to high on one line: ding in round brackets, bottom notes in square brackets, `|` before inner notes. One example, `[C] (D) A C D E F G A C`. GENERATE CARDS.
  - ADJUST LAYOUT under the preview mirrors or reorders fields to match your pan.
  - Tap a selected deck's chip (the pencil) to edit or delete it; built-in decks can be edited the same way, and RESET SEEDED DECKS brings them back.
  - Scales stay in this browser. The link icon at the top left copies a link that opens the deck anywhere; the address bar always holds the shown deck's link.
  - One sentence on id collisions, only if the owner keeps it (Q3).
- **Must not carry:** storage keys, `replaceState`, wire format details, migration notes for older versions, test names.

### `## Printing`
- **Job:** how to get paper cards.
- **Carries:** DOWNLOAD PDF in the menu builds the chord cards for the shown deck in the browser, Letter or A4, poker-size cards, 3x3 per sheet; print at 100% and check the calibration bar with a ruler. The three `*_CHORD_ONLY_Letter.pdf` files at the root are the print-shop copies built by `python3 tools/decks.py`.
- **Must not carry:** the iOS tab behaviour, module internals.

### `## Development`
- **Job:** what another developer needs to clone, run, change and test the repo. Facts once each.
- **Carries:**
  - Clone and run: `git clone https://github.com/raywu/handpan-cards.git`, then open `index.html` from disk, or `tools/preview.sh` for `http://localhost:8000` and a LAN URL for a phone (`tools/preview.sh:7,14`) [V].
  - Layout of the repo: `index.html` is the whole app and is what GitHub Pages serves from `main`; no build step, no `package.json`. `data/decks.json` is the one copy of the deck data.
  - Generated regions (the two rules a newcomer breaks): the `<!-- engine:... -->` regions of `index.html` are copies of `src/engine/*.js`, rewritten by `python3 tools/inline_engine.py`; the `const DECKS` line is rewritten from `data/decks.json` by `python3 tools/sync_decks.py`. Never edit either by hand; both tools take `--check`. `python3 tools/validate.py` fails if either drifts.
  - The engine: one sentence with the exact phrase "twelve modules under `src/engine/`", then each of the twelve paths with a few words on its job (currency test). Pointers: `docs/ENGINE-SPEC.md` is the spec, `docs/SCALE_ENGINE_PLAN.md` the decisions.
  - Requirements: Node 22 and Python 3.12 (what CI uses, `.github/workflows/validate.yml:41,44`), `pip install -r requirements-ci.txt` (reportlab, pymupdf, fonttools), and a Chrome or Chromium for the browser tests (`CHROME_BIN` overrides the search, `tests/helpers/cdp.js:11`) [V].
  - Tests: the commands in the block below, the suite counts "24 node suites" and "16 python suites", and the mutant count "N mutant patches" with one sentence on what the gate is. The gate edits the tree in place and refuses to start on uncommitted changes to a file a patch touches (README.md is one): commit first.
  - CI: runs on PRs into `main` and pushes to `main`; a PR that changes only `docs/plans/` or `docs/prompts/` skips every job.
  - Where to read more: `CLAUDE.md` (rules, verified layouts, design system, hosting), `tests/CONTRACT.md` (how to add a test), `docs/plans/` (one plan per piece of work).

  Test command block (CI runs the same suites through `tests/suite_health.py --emit-python` and `--emit-js`, `.github/workflows/validate.yml:80,119`, and the mutants in four shards, `:185`) [V]:

  ```
  ./tests/run.sh                  # validate, boot sim, python and node suites
  python3 tests/suite_health.py   # per-file test-count floors
  ./tests/run.sh mutants          # mutation gate (slow)
  ```

### `## License`
- **Job:** state the licence in two lines.
- **Carries:** "MIT, see `LICENSE`." Then one line: "The fonts in `tools/fonts/` and the subsets built from them in `src/engine/fontdata.js` are under the SIL Open Font License 1.1; see the `OFL-*.txt` files beside them." The second clause matters: `src/engine/fontdata.js` is generated from those fonts by `tools/inline_fonts.py` (README:34-37 today) [V], so MIT must not claim it.

**Line budget.** 120 lines. The current file is 238 [O: `wc -l README.md`]. The engine module list alone takes about 13 lines, so the budget leaves about 100 for everything else.

## 3. Tone checklist (the reviewer applies it line by line)

1. **Banned words.** None of these appear: seamless, seamlessly, powerful, simply, simple, easily, easy (except the EASY button label), just, robust, comprehensive, effortless, intuitive, beautiful, beautifully, delve, leverage, very, really, actually, basically, truly, quickly, vanishingly, cutting-edge, elevate, unlock, journey, crucial, essential, ensure, enhance, streamline, utilize, "whole new", "out of the box". The grep in AC4 enforces most of the list; the reviewer reads for the rest.
2. **No em dash or en dash.** Use a full stop, a comma, a colon or brackets. A plain hyphen `-` is allowed in commands and compound words only.
3. **No marketing claims.** No "the best", "the only", "fast", "free forever", "for everyone", no exclamation marks, no rhetorical questions.
4. **No repeated concept.** Each fact in section 2 appears in one section only. The reviewer lists any concept stated twice, for example "no build step" in two sections, or the share link in both "Your own scale" and "Development".
5. **Short sentences.** No sentence over 25 words. Commands and the engine module list are exempt.
6. **Second person for users** ("tap the card", "you can"); plain imperative for developers ("run", "edit"). No "we", no "this project aims to".
7. **No filler.** No "note that", "it's worth noting", "in order to", "allows you to", "feel free to", "out there". No sentence that restates its heading.
8. **No adverb or adjective that a reader would not miss.** The reviewer quotes each one they would cut.
9. **No test names, element ids or storage keys** outside `## Development`.
10. **It reads as a person wrote it.** The reviewer flags any paragraph that opens with a summary of what follows, ends with a recap, or lists exactly three adjectives.

## 4. Lane `readme` (one lane, wave 1)

- **Branch:** `claude/readme-rewrite`.
- **Worktree:** `git worktree add -b claude/readme-rewrite .claude/worktrees/readme-rewrite origin/main`, cut after `validate` on main's tip has concluded success.
- **Goal:** section 1's goal.
- **Owned files:**
  - `README.md` (whole file);
  - `LICENSE` (new);
  - `tests/mutants/m_readme_card_count_stale.patch` (context lines and hunk header only);
  - `tests/suite_health.py` (FLOORS values only);
  - `CLAUDE.md` (line 38 only, the `README.md` bullet in "Repo layout").
- **Not owned:** every other file, including `tests/test_readme_currency.py` and `docs/ENGINE-SPEC.md` (but see Q3).

### What the currency test reads (all must stay true)

From `tests/test_readme_currency.py` [V]:

| Test | Regex or check | Text that satisfies it at bfde903 |
|---|---|---|
| `test_total_card_count_matches_the_deck_data` | `\b(\d{2,4}) cards total\b`; every match must equal the deck total | `177 cards total`, once |
| `test_every_deck_is_named_with_its_own_chord_count` | lowercased deck name found; its count appears in the 40 characters after the FIRST occurrence, cut at the first `.` or `;` | `D Kurd 10: 49 cards`, `D Amara 10: 29 cards`, `D Amara 9: 27 cards`, `C# Hijaz 9: 19 cards`, `F3 Low Pygmy 18: 53 cards` |
| `test_every_engine_module_is_mentioned` | the literal `src/engine/<m>.js` for each of the 12 files, and no `src/engine/([A-Za-z0-9_]+\.js)` naming a file that does not exist | `src/engine/core.js`, `fontdata.js`, `importer.js`, `layout.js`, `naming.js`, `pdf.js`, `pdfcards.js`, `pdfdeck.js`, `select.js`, `sequence.js`, `share.js`, `voicing.js`, each with the `src/engine/` prefix |
| `test_the_module_count_word_matches_the_module_list` | `\b(one\|...\|fifteen)\s+modules\s+under\s+\`src/engine/\`` on the lowercased text; the word must equal the file count | `twelve modules under \`src/engine/\`` |
| `test_the_suite_counts_match_the_files_on_disk` | `\b(\d{1,3}) node suites\b` and `\b(\d{1,3}) python suites\b`, each equal to the glob count | `24 node suites`, `16 python suites` [O: `ls tests/*.test.js \| wc -l` = 24, `ls tests/test_*.py \| wc -l` = 16] |
| `test_the_mutant_count_is_stated_within_a_lane_of_the_truth` | `\b(\d{2,4}) mutant`; the largest match is at most the patch count and at least 90% of it | `N mutant patches`, N from step 3 below. Any other number followed by "mutant" counts too, so write the count once |

No regex forces wording the tone rules forbid. "177 cards total", "twelve modules under", "24 node suites" and "N mutant patches" all read as plain English. So no currency test changes, and no owner question is needed for one.

Other readers of `README.md` [V: `grep -rn README tests tools .github`, `git grep -n "README.md#"`]:
- `tests/test_ci_scope.py:29` treats `README.md` as CI-running, so this lane's PR runs full CI.
- No file links into a README anchor (`git grep "README.md#"` finds nothing), so headings can change freely.
- `docs/ENGINE-SPEC.md:771` says the 32-bit id collision "is documented in the README" (README:104-106 today). See Q3.

### What leaves the README, and where it lives

| Today's README content | After |
|---|---|
| Host on GitHub Pages, private-repo caveat (README:198-209) | `CLAUDE.md` "Hosting facts" already holds it. Dropped. |
| Layout notes for Pygmy and generated pans (README:225-238) | `CLAUDE.md` "Instrument layouts" holds them in more detail. Dropped. |
| Seeded SAVE/DELETE storage details, `hpfc` keys, old-version notes (README:79-103) | `CLAUDE.md` "Known pitfalls". Dropped. |
| Discoverability paragraph and cited test names (README:167-185, 73-78) | `CLAUDE.md` "Discoverability" and "Share link v5". Dropped. |
| Per-area test coverage list (README:139-165) | `tests/CONTRACT.md` and the test files. Replaced by the one-sentence gate description. |

`CLAUDE.md:38` today: "`README.md` - usage, hosting, layout provenance notes." New text: "`README.md` - what the app does, the decks, printing, how to clone and test, and the license. Hosting and layout provenance live in this file, not there."

### Steps

Run every step in one shell after `S=$(mktemp -d)`. TDD order: steps 1 to 3 fix the numbers and the guards before the prose.

**Step 1. Read main's CI at the lane's base.**
- `M=$(git merge-base HEAD origin/main)`; `id=$(gh run list --workflow validate.yml --commit $M --json databaseId,conclusion -q '.[]|select(.conclusion=="success")|.databaseId' | head -1)`.
- Download `js-results`, `python-results` and `mutant-shard-report-1` to `-4`.
- Acceptance: the run concluded success and the six artifacts are present.
- Verify:
  ```
  test -n "$id" && for a in js-results python-results mutant-shard-report-1 mutant-shard-report-2 mutant-shard-report-3 mutant-shard-report-4; do gh run download $id -n $a -D $S/$a || exit 1; done
  ```

**Step 2. Set FLOORS from the artifacts** (the refactor-pass-6 reconcile procedure, `docs/plans/2026-10-17-refactor-pass-6.md` lane `reconcile`, step 2). Three mutants landed after main e534c9f (`ap_privacy_drops_share_how`, `p6_hashchange_deck_route_shown_id`, `ap_privacy_drops_ga_clause`) and their PRs may have added tests. At bfde903 FLOORS sum to js 1665, py 260 over 40 rows [O]; the artifacts decide the new values.
- Acceptance: each row equals CI, no row is below its value at `M`, suite health is green.
- Verify (unchanged from refactor pass 6):
  ```
  git show "${M}:tests/suite_health.py" > $S/base_suite_health.py && python3 -c "import sys,importlib.util as u; sys.path.insert(0,'tests'); import suite_health as h; sp=u.spec_from_file_location('b','$S/base_suite_health.py'); b=u.module_from_spec(sp); sp.loader.exec_module(b); low=[k for k,v in b.FLOORS.items() if h.FLOORS.get(k,-1) < v]; print(low); sys.exit(1 if low else 0)" && python3 -c "import json,sys; sys.path.insert(0,'tests'); import suite_health as s; js=json.load(open('$S/js-results/js-results.json'))['files']; py=json.load(open('$S/python-results/python-results.json'))['by_module']; bad=[k for k,v in s.FLOORS.items() if v != (js[k]['total'] if k.endswith('.js') else py['tests.'+k[6:-3]])]; print(bad); sys.exit(1 if bad else 0)" && python3 -m unittest tests.test_suite_health
  ```

**Step 3. Fix the mutant count.** `n` is the shard-report total; it must equal the patch count on disk, because this lane adds and removes no patch. At bfde903 the disk holds 1097 [O] and the README says 1094 (README:163).
- Verify:
  ```
  n=$(cat $S/mutant-shard-report-*/mutant-shard-*.txt | grep -c '\.patch$'); test "$n" -eq "$(ls tests/mutants/*.patch | wc -l | tr -d ' ')" && echo $n
  ```

**Step 4. Write `LICENSE`.** The standard MIT text, first line `MIT License`, then `Copyright (c) 2026 Ray Wu` (Q1).

**Step 5. Write `README.md`** to section 2, with `n` from step 3 in "`n` mutant patches".

**Step 6. Re-anchor `tests/mutants/m_readme_card_count_stale.patch`.** Keep its `# kills:` and `# suite:` header lines and its comment. Regenerate the hunk from the new README: change `177 cards total` to `59 cards total` on whatever line holds it, with that line's real context. Make it with `git diff` on a scratch edit, then strip any `index a..b` line (memory: mutant patches reject index lines). The `# suite:` header is word-split by `tests/mutation_check.sh`; leave it as is (it has no spaces inside its pattern).

**Step 7. Edit `CLAUDE.md:38`** to the text in "What leaves the README".

### Acceptance criteria

Each criterion has one verify, run from the worktree root.

- **AC1. Currency holds.**
  ```
  python3 -m unittest tests.test_readme_currency
  ```
- **AC2. The README mutant applies, its suite fails under it, and the tree is restored.**
  ```
  P=tests/mutants/m_readme_card_count_stale.patch
  git apply --check $P && git apply $P
  python3 -m unittest -k test_total_card_count_matches_the_deck_data tests.test_readme_currency; r=$?
  git apply -R $P && git diff --quiet README.md && test $r -ne 0
  ```
- **AC3. Every mutant still applies.** `python3 tools/refresh_mutants.py --check` prints "all mutant patches apply cleanly; nothing to refresh".
- **AC4. No banned word** (case-insensitive, whole words; "easy" is not in the list, so the EASY label may appear).
  ```
  ! grep -niwE 'seamless(ly)?|powerful|simply|simple|easily|just|robust|comprehensive|effortless(ly)?|intuitive|beautiful(ly)?|delve|leverage|very|really|actually|basically|truly|quickly|vanishingly|elevate|unlock|journey|crucial|essential|ensure|enhance|streamline|utili[sz]e' README.md
  ```
- **AC5. No em or en dash.**
  ```
  ! grep -n -e '—' -e '–' README.md LICENSE
  ```
- **AC6. Line budget.** `test $(wc -l < README.md) -le 120`
- **AC7. LICENSE.** `test "$(head -1 LICENSE)" = "MIT License" && grep -q '^Copyright (c) 2026 Ray Wu$' LICENSE`
- **AC8. Fonts are excluded from MIT.** `grep -q 'tools/fonts/' README.md && grep -q 'src/engine/fontdata.js' README.md && grep -q 'Open Font License' README.md`
- **AC9. FLOORS and the mutant count come from CI.** The step 2 and step 3 verifies, then `grep -q "$n mutant patches" README.md`.
- **AC10. Only owned files changed, and one line of CLAUDE.md.**
  ```
  git diff --name-only origin/main...HEAD
  # expect exactly: CLAUDE.md, LICENSE, README.md, tests/mutants/m_readme_card_count_stale.patch,
  # and tests/suite_health.py unless step 2 changed nothing
  test "$(git diff --numstat origin/main...HEAD -- CLAUDE.md | cut -f1,2 | tr '\t' ' ')" = "1 1"
  ```
- **AC11. The sync and validate tools are clean.** `python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py`
- **AC12. CI at the verified head.** `gh pr view <n> --json headRefOid -q .headRefOid` equals `git rev-parse HEAD` (re-query once after a push; it lags), then `gh run list --workflow validate.yml --commit <sha> --json conclusion -q '.[0].conclusion'` prints `success`.
- **AC13. Tone.** The reviewer applies section 3 to every README line and quotes each violation.

**Deltas:** mutants 0 (one patch rewritten); FLOORS as CI says; README 238 to at most 120 lines.

## 5. Merge gates and rollback

1. **CI green at the verified head SHA** (AC12). Gate on the `validate` run conclusion, not on `gh pr checks` buckets.
2. **Fresh reviewer PASS or PASS_WITH_NITS at that SHA.** The reviewer checks out the head SHA in its own worktree, runs `/review` read-and-report only, re-runs AC1 to AC11, applies the section 3 checklist to every README line, and checks every README fact against the repo (a docs claim the code contradicts is a FAIL). The brief quotes this plan's section 2 and 3 verbatim and adds no rule.
3. **The operator merges** with `gh pr merge <n> --merge`. After the merge, the integrator opens and merges the main-to-dev sync PR.

**Rollback:** revert the merge commit with a new PR (`git revert -m 1 <merge sha>`). Nothing else depends on the new text.

## 6. Owner questions (each has a default; none blocks)

| # | Question | Options | Default |
|---|---|---|---|
| Q1 | Copyright holder and year in `LICENSE` | (a) `Copyright (c) 2026 Ray Wu`. (b) another name or a range. | (a). Integrator default. |
| Q2 | Line budget | (a) 120. (b) 100, which forces a terser engine list. (c) no cap. | (a). The engine list is a test-enforced 13 lines. |
| Q3 | The 32-bit deck-id collision sentence (README:104-106 today), which `docs/ENGINE-SPEC.md:771` says the README documents | (a) Keep one plain sentence in "Your own scale": two different scales can share an id, and then only one is kept. (b) Drop it and change ENGINE-SPEC's clause to "accepted as rare", adding `docs/ENGINE-SPEC.md` to the lane. | (a). One sentence, and no second file to own. |
| Q4 | Whether to name the live URL `https://handpan.raywu.org/` | (a) yes, in the first section. (b) no. | (a). It is the canonical URL in `index.html` and in the sitemap. |
| Q5 | Marcellus's OFL reserves the font name "Marcellus" (`tools/fonts/OFL-Marcellus.txt:1`), and `src/engine/fontdata.js` ships a subset of it. Whether a subset counts as a Modified Version under OFL 1.1 is not settled by this plan [A]. | (a) Out of scope here; the README states the fonts are OFL and claims nothing more. (b) Open a separate item to check the subset's naming. | (a), and log (b) as a follow-up idea, not a lane. |

## 7. Risks

- **The first deck-name mention trap.** A sentence such as "The default deck is D Kurd 10." placed above the list fails `test_every_deck_is_named_with_its_own_chord_count`, because the test reads only the first occurrence. AC1 catches it.
- **A second "N mutant" number.** Any other number before the word "mutant" (for example "4 mutant shards") joins the band check; the largest wins. Write "four shards" in words or leave it out.
- **The mutant gate and an uncommitted README.** `tests/mutation_check.sh` refuses to start while `README.md` has uncommitted changes. Commit before running `./tests/run.sh mutants`.
- **Interleaved merges.** If another PR adds tests or mutants before this lane merges, steps 1 to 3 read a stale base. The lane rebases, repeats steps 1 to 3, and pushes again.
