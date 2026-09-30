# Backlog triage and refactor review

- **Goal:** after the lanes below merge:
  - (a) a mutant patch that no longer applies fails `node --test tests/mutation_harness.test.js` in under 30 s, locally and in CI's js-suites job, instead of surfacing only in the ~13-minute mutation gate;
  - (b) once the owner's iPhone device gate passes, `index.html` has no `openPrintSheet`, `#printroot` or `window.print()` path, and every PDF CTA test runs unchanged and green;
  - (c) every OPEN row in the four coordination ledgers has a verdict in §7, and each ledger points here.
- **Date:** 2026-09-29.
- **Base:** `main` @ `e428946` (merge of PR #162). Every file:line below was read at that SHA. PR #163 (`claude/seq-credit-copy`) has since merged as **`4c6f700`**, the new `origin/main` head. The corpus there holds 442 patches (`git ls-tree 4c6f700 tests/mutants/`). Lanes base on `4c6f700` or later. Line refs stay at `e428946` unless marked `@4c6f700`.
- **Shape:** /swarm, three lanes.
  - R2 (`tests/mutation_harness.test.js`, `tests/mutants/`) and D1 (docs only) run in parallel.
  - R1 (legacy print retirement) waits on an owner device gate.
  - No FIX lane: nothing in the queues meets the FIX bar at this SHA.
- **Related docs:**
  - `docs/plans/2026-09-24-quality-eval.md` ("quality-eval"): the S/C scales in §1, N1-N10 and the gates in §6.
  - `docs/plans/2026-09-27-followup-triage.md` ("followup-triage"): the template; N11-N14.
  - The four ledgers this plan closes:
    - `docs/plans/2026-09-16-remaining-work-coordination.md` ("remaining-work", 92 OPEN rows);
    - `docs/plans/2026-09-24-one-pdf-path-coordination.md` ("one-pdf", 9);
    - `docs/plans/2026-09-28-android-bg-and-menu.md` ("android", 15);
    - `docs/plans/scale-engine-coordination.md` ("scale-engine", 2).
  - `docs/plans/2026-09-29-chord-sequence-mode.md` § roadmap relation (N21-N23).
  - `docs/plans/2026-09-29-card-swipe-animation.md`: drafted in parallel; not planned here.
  - `docs/plans/2026-09-22-client-pdf-emitter.md` Task 5 and `docs/plans/2026-09-24-one-pdf-path.md:19`: the device gate R1 waits on.

## §1 Goal and non-goals

**Goal.** Cut the maintenance that recurs, and close the ledgers.

The app is live, lightly used and not expected to grow. The dominant cost is now the owner's upkeep of tests, mutants and comments. So:
- A refactor must name a cost that has recurred at least twice.
- A backlog item earns FIX only if it names a failure a musician can hit, or an S1/S2 path by which such a failure ships with CI green.
- Closing a row is a first-class outcome.

**Non-goals.** N1-N10 (quality-eval §1) and N11-N14 (followup-triage §1) carry over unchanged. N11 is re-scoped to this workstream: no product change except R1's removal of unreachable code. N13 means no edits to `tests/mutation_check.sh`. New non-goals:

| # | Non-goal |
|---|---|
| N15 | No new features. No roadmap item (SM-2, stats, PWA, audio) |
| N16 | No swipe animation. It has its own plan; §4 says where it slots in |
| N17 | No deck-data or geometry change. `data/decks.json`, the DECKS line, the engine regions and the PDFs are byte-identical after every lane |
| N18 | No refactor that is not behaviour-preserving. R1 removes code that no user action reaches; every surviving path runs the same bytes. §3 says how each lane proves it |
| N19 | No new harness and no `mutation_check.sh` refactor. R2 is one test in the existing `tests/mutation_harness.test.js` (see A15 for why marker anchoring is LEAVE) |
| N20 | No bulk mutant retirement beyond what R1's deletions orphan and row 5's duplicate. A wider corpus policy is owner decision O3 |

## §2 Findings

### Measurements at `e428946` (re-verified)

| Measure | Prompt said | Measured |
|---|---|---|
| `index.html` | 8299 lines | 8299 lines, of which about 2370 are hand-written app JS:<br>- CSS `:25-929`<br>- markup `:930-1188`<br>- 11 generated engine regions `:1189-5919` (~4730 lines)<br>- DECKS `:5923`<br>- app JS `:5922-8291`, 92 top-level functions |
| `tests/e2e.test.js` | 7616 | 7616 lines. 153 `test(` literals; 161 ran in CI |
| `tests/app.test.js` | 4773 | 4773 lines. 197 literals; 208 ran |
| Mutants | 441 | 441 (442 after #163). All 441 pass `git apply --check` at `e428946`. Per-file check over the corpus takes 7.1 s locally |
| Mutant targets | - | 284 of 441 patch `index.html` |
| Mutation gate | ~10 min | 13m08s in run 36647735843 at `e428946`; 601-788 s in recent green runs. Other jobs: js suites 1m45s, suite health ~2m40s, python ~1m08s |
| Gate time by mutant | - | 733 s over 439 timed mutants:<br>- `e_*`: 396 s (54%);<br>- the 5 slowest process-hygiene mutants: ~206 s (28%). They are `e_suite_health_unbounded` 65 s, `e_escalation_gated_on_the_direct_child` 39 s, `e_timeout_skips_the_sigterm_grace` 34 s, `e_killed_suite_output_is_dropped` 34 s and `h_probe_orphans_its_process_tree` 34 s |
| Red CI, 2026-09-29 | - | 9 red validate runs. **6 of them failed on a stale patch** ("does not apply"), not a survivor:<br>- 36639126451 `e_panel_moved_into_header`<br>- 36628596678 `d_deck_id_untyped`<br>- 36546643228 `m2b_panel_card_not_inert`<br>- 36528964818 `d_arrows_step_behind_sheet`, `d_sheet_no_escape`<br>- 36526788772 (2 stale)<br>- 36524313601 `p_print_fill_parent_dropped`<br>Each cost a ~13-minute round trip |
| Refresh commits | - | 25 mutant refresh/re-anchor commits since 2026-09-15, against ~98 merges, e.g. `c6c46d6`, `76ded62`, `e232b6a`, `2b8f1c2`, `7c84256`, `bb9bca7`, `a067ca2`, `ce63ed7` |

### Part A: implementation review

| # | Candidate | Evidence | Recurring cost | Verdict | Proof of no behaviour change |
|---|---|---|---|---|---|
| A1 | **Legacy `window.print()` path**: unreachable, still carried | See "A1 in detail" below | See below | **REFACTOR (R1)**, gated on owner decision O1 | See below |
| A2 | **Stale patches are found only by the 13-minute gate** | See "A2 in detail" below | See below | **REFACTOR (R2)** | Adds a test only. No product file changes; FLOORS rises |
| A3 | **Four coordination ledgers, 118 OPEN rows** | See "A3 in detail" below | See below | **REFACTOR (D1)**, docs only | Docs only; no test, code or mutant file is touched |
| A4 | App state in ~21 module-level `let`s | Card: `deckId..seq` `:5940-5950`, `printPaper` `:6668`. Sheet: `:7095-7115`, `panState` `:7437`, `refusal` `:7501`, `sheetRouted` `:7686`, `delArmed` `:7928`. Also `panelOpen` `:8118`, `tx` `:8255` | None shown. The bug class that came from state (refusal) is already closed (A6) | LEAVE | - |
| A5 | Duplicated render tails: `renderSeqEmpty` `:6855-6872` repeats `render()`'s aria face swap `:6966-6972`; `#count` is handled at 3 sites (`:6862-6864`, `renderSeqRail` `:6876-6902`, the A/B branch `:6939-6940`) | One PR (#162) touched it. The PR #162 reviewer suspected `.seq` staying on `#count`; the code is correct (`:6940`, `:6864`) | One occurrence, not two | LEAVE. The swipe lane may dedupe it if its animation hook needs one exit point (§4) | - |
| A6 | Extract the scale-sheet `refusal` handling into `src/engine/` | Already consolidated:<br>- `resyncSheet` `:7550` is the one guard for every non-seed caller (`:7299-7302`, `:7693`, `:8011-8012`, `:8050-8051`);<br>- only `updateParse` `:7538` clears it; `runGenerate` `:7862`/`:7868` sets it;<br>- `openScaleSheet` `:7713`, `openEditSheet` `:7731` and `hideSheet` `:7751-7762` reset it.<br>Rows 91 and 114-117 are fixed and each has a mutant | The class stopped reopening: the remaining 122, 123, 135 and 136 are one-test gaps on edge paths | LEAVE | - |
| A7 | Raw line-number comments and `void noPrints` | CSS `:62`, `:270`, `:321` ("line 456"; the `[hidden]` rule is at `:549`), `:862`; JS `:6520`, `:6816` (":6218"); `void noPrints` `:6821`, whose only caller passing it is `printCardHTML` `:6606` | Comment drift only; no test reads them | DEFER. **Trigger:** the next lane that owns those lines. R1 removes `noPrints` and the `:6520`/`:6816` cites, because it deletes their subject | - |
| A8 | Sidebar CSS undoing the full-screen mobile base (#162) | Base `#settings-panel` `:242`. The desktop block `:274-325` sets 17 properties: ~7 genuinely undo the base (top, right, bottom, left, z-index, padding, align-items). ~6 are dead leftovers of the pre-#162 popover base (`e728912:223`): `max-width:240px`, `height:auto`, `max-height:none`, `border-radius:0`, `border:none`, `box-shadow:none`. Reviewer findings F1, F3, Q18 and Q19 were all sidebar-vs-base interactions | 4 findings in one PR, all fixed inside it | DEFER. **Trigger:** the next edit to `#settings-panel` CSS; drop the ~6 dead declarations then. Not worth a lane on its own: every `index.html` edit restales `e_*` mutants | - |
| A9 | Four `@media (max-height:520px)` blocks (`:58`, `:247`, `:383`, `:707`) | Each sits next to the component it adjusts | None shown | LEAVE. Grouping them would scatter each component's rules | - |
| A10 | `CHROME_BUDGET` (e2e `:2738`) and `LANDSCAPE_BUDGET` (`:2813`) | Both one-sided and green at `e428946`. Two comments are stale: e2e `:2740-2746` misattributes the "+67.3%" figure (android Q6), and CSS `:329-342` still describes the mode bar at 241px | Comment drift only | LEAVE. The comments ride along (Q6) | - |
| A11 | e2e shape (161 tests; the full file starves Chrome locally) | CI js suites 1m45s; memory note chrome-bin-available-locally. Row 68's flake is absent from the last 40 runs | None shown in CI | LEAVE | - |
| A12 | Duplicate coverage between `app.test.js` and e2e | The split follows what each harness can see (sandbox DOM vs real layout) | None shown | LEAVE | - |
| A13 | `tests/helpers/sandbox.js` `ELEMENT_IDS` (`:25-46`) that every lane edits | 13 commits since 2026-09-15, ~6 of them adding ids. An unknown id throws "missing #id", which is loud and a one-line fix | Recurs, but costs one line and never ships silently | LEAVE. R1 removes 2 ids | - |
| A14 | FLOORS slack (row 144: 112 vs 158) | `tests/suite_health.py:50`: `app.test.js` floor 205 vs 208 ran. e2e 155 vs 161 | - | LEAVE (row 144 STALE) | - |
| A15 | Anchor mutants on stable markers instead of line context | Needs a `mutation_check.sh` change (N13). It stales all 5 `h_*` patches that patch the script: `h_baseline_hang_scored_red`, `h_e2e_mutant_skipped_by_filename`, `h_mutation_gate_tolerates_skips`, `h_no_suite_header_guessed`, `h_baseline_output_discarded`. It also needs every patch rewritten | The staleness is real (A2) | LEAVE. R2 finds a stale patch in seconds with no harness change. What remains is the refresh itself: one `git diff` regeneration per stale patch, and R2 names which | - |
| A16 | Corpus shrink beyond A1: the slow hygiene mutants, 37 unanchored patterns, ~77 prose `# kills:` | 206 s (28% of the gate) comes from the 5 slowest. Each unanchored pattern selects exactly one test today (row 139). The `# suite:` pattern, not `# kills:`, decides the verdict (row 153) | Wall time only; no stale-patch or false-kill incidents | LEAVE; owner decision O3 | - |

**Part A counts:** REFACTOR 3 (A1-A3), DEFER 2 (A7, A8), LEAVE 11.

#### A1 in detail

**Evidence.**
- No UI action reaches `openPrintSheet` (`index.html:6715`). The panel buttons (`:1170-1171`) call `downloadDeckPDF` (`:6764`).
- `:6651` says the path is kept "only until the owner's device gate retires it", and `one-pdf-path.md:17-19` keeps it "until row 223's device gate says the emitter prints correctly on the phone".
- **The gate is contested (outside voice, confirmed).** client-pdf-emitter Task 5's own disposition (`:717-721`) counts Task 5 as PASSED for D2: the filename item is WONTFIX, and the ruler measurement is classed as an owner action against the print spec that "gates nothing D2 changes". The two docs disagree, so O1 asks the owner to settle it rather than presenting the gate as settled.
- The dead chain in `index.html`:
  - JS: `PRINT_GEOM` `:6453`, `PRINT_LAYOUTS` `:6472`, `PRINT_SAFE` `:6488`, `printLayoutName` `:6520-6526`, `printGridCSS` `:6533`, `PRINT_LEGEND_LINES` `:6585`, `printCardHTML` `~:6598`, `printCardList` `:6636`, `printSheetHTML` `:6685`, `teardownPrintSheet` `:6706`, `openPrintSheet` `:6715-6738`, the `afterprint` listener `~:7790`;
  - markup: `#printroot` and `#printgeom` `:8296-8297`;
  - CSS: the `#printroot` rules `:866-891` and the `body.printing` rules inside `@media print` `:892-929`.
- Outside `index.html`:
  - 2 `sandbox.js` ids;
  - ~27 tests in `app.test.js` (`:3581-3805`, `:3828-4102`, `:4200-4303`, `:4531`);
  - e2e `:1857`, `:1893`, `:7586`;
  - render-agreement grid and print-block tests (`test_render_agreement.py:763`, `:795`, `:811`, `:837`, `:874`, `:963`);
  - 25-29 mutants (R1 table).

**Recurring cost.** At least five PRs paid upkeep on code no user runs:
- `7c84256` and `bb9bca7` (print mutant refreshes);
- run 36524313601 (`p_print_fill_parent_dropped` stale);
- `deb18db` (print hide-list);
- #162's `body.printing` hide-list edit for the new body children (`:915-922`).

Every new `<body>` child must also be added to that hide-list. Rows 147-157 all belong to this path.

**Proof of no behaviour change.**
- The behaviour-lock (R1 step 1) runs the full CTA suite unchanged and green before and after. That covers:
  - `app.test.js` `:4132`, `:4357`, `:4370`, `:4403`, `:4434`, `:4522`;
  - e2e `:780`, `:817`, `:900`, `:933`, `:1010`, `:1839`, `:6698`.
- `tests/fixtures/seq_ui_base_e728912.json` contains no print ids, and its DOM test stays byte-identical.
- The unconditional `@media print` rules stay verbatim, so Cmd+P output is unchanged:
  - `*{print-color-adjust:exact}`;
  - `html,body{... background:#fff}`;
  - `body{margin:0; ...}`.
- `validate.py` 6/6: no engine region, DECKS line or PDF is touched.

#### A2 in detail

**Evidence.**
- 6 of the 9 red runs on 2026-09-29 were stale patches.
- 25 refresh commits since 2026-09-15.
- `tests/mutation_harness.test.js` has 17 tests, none of which applies a patch. Its nearest relative is `:344`, "no mutant patch carries a blob header".

**Recurring cost.** A stale patch costs:
- a full gate round trip (~13 min) per occurrence;
- about 1 in 4 PRs a refresh commit.

The cost is detection latency. The refresh itself stays.

#### A3 in detail

**Evidence.** The OPEN rows are spread over four ledgers:
- remaining-work 92;
- one-pdf 9;
- android 15;
- scale-engine 2.

Most of them are STALE or DROP at `e428946` (§7).

**Recurring cost.** Every triage session re-verifies the same rows. The 2026-09-27 triage and this one both re-read them, and 39 turned out STALE.

### Part B: triage

Sorted FIX, OWNER, DEFER, DROP, STALE. "Verified at" means `e428946`. Rows closed by a REFACTOR lane are listed last.

| # | Item/group | Verified at | Sev | Cost | Verdict | Why / failure prevented |
|---|---|---|---|---|---|---|
| - | (no FIX) | - | - | - | - | No row names a failure a musician can hit in normal use at this SHA. The nearest (122, 123, 135) are edge paths recoverable by RESET or by reopening, and they are DEFER |
| B1 | rw 5: the twin mutants `d_edit_appends_deck` / `e_edit_chip_appended` | Bodies are identical with headers stripped (hash `681b6e08`) | S4 | C1 | **OWNER** (O4), default: retire `e_edit_chip_appended` in R2 | The owner chose "de-duplicate" on 2026-09-15. It inflates the killed count by 1 and names no escape, so without that decision it would be DROP |
| B2 | rw 6: guard `formatSeed` against lossy shapes | `src/engine/core.js:482-507`. `parseSeed` cannot emit those shapes | S4 | C1 | **OWNER** (O4), default: DROP | The owner said "add the guard" on 2026-09-15. It is latent, with no reachable input; overturning is recommended |
| B3 | Owner-device checks: rw 12 (calibration half), 23, 29, 34, 133; android Q3; the iOS print gate that replaces rw 147-150 | See the checklist below | - | - | **OWNER** (device) | `covered_by: neither`. A Chromium result is not an iOS fact. The iOS print item is R1's gate |
| B4 | Card swipe animation | `index.html:8255-8261` (touch, 55 px, passive), `flip`/`step` `:8078-8082`, `render()` `:6903-6973`, `.card`/`.flip` CSS and `prefers-reduced-motion` `:438` | - | - | **OWNER** (O5), default: next, after R2 and D1, before or after R1 per §4 | An owner request, not a defect. It is planned in its own doc |
| B5 | rw 2: the subtitle fit under-measures (0.231 vs 0.554 pt/char) | `tools/hifi.py:210-211`, `src/engine/pdfcards.js:212-214`. The widest subtitle draws 104.24 against a 106.56 pt budget; fit never fires | S3 | C1 | DEFER | **Trigger:** any subtitle over 34 chars, or a subtitle-copy change. Both renderers share the bug, so parity holds |
| B6 | rw 7: ring clearance checked only at 380x800 | `tests/e2e.test.js:5451-5457` | S3 | C1 | DEFER | **Trigger:** the next edit to `#scale-box` or `.sheetbody` padding or overflow. Cosmetic |
| B7 | rw 122, 123: refusal edge paths | 122: deleting both `refusal = null` resets (`:7713`, `:7731`) passes all 208 `app.test.js` tests. 123: the layout controls `:7309-7360` do not repaint while a refusal stands (`resyncSheet` `:7550` returns early) | S3 | C1 | DEFER | **Trigger:** the next edit to `openScaleSheet`/`openEditSheet` (122), or to the layout controls or `resyncSheet` (123). Both paths need collision-then-Escape or Edit-under-refusal; RESET and reopening recover |
| B8 | Roadmap: SM-2, stats, PWA, audio | CLAUDE.md "Owner-approved roadmap"; chord-sequence plan N21-N23 | - | - | DEFER (each) | **Trigger:** owner pick after the swipe lane (O5). §4 names the prerequisites |
| B9 | Test-precision nits, remaining-work: 3, 8, 9, 15, 26, 27, 32, 81, 86, 131, 132, 139, 145, 152, 153, 154 | Per-row evidence is in §7 | S4 | C1 | DROP | Each is imprecise, but none names a regression it would miss. 139 and 153 recounted: 37 unanchored and ~77 prose kills. Every unanchored pattern selects one test |
| B10 | Tooling hygiene: rw 16, 17, 18, 68, 98, 124-130, 146 | `suite_health.py`, `regen_data_mutants.py`, `validate.yml` | S4 | C1 | DROP | Dev tooling: a failure is red and loud, never a silent green |
| B11 | Comment and doc drift: rw 11, 22, 25, 28, 35, 43, 138; android Q4-Q8, Q15-Q17, Q23, Q25, Q26 | Per-row evidence is in §7 | S4 | C1 | DROP | Comment-only. Editing `index.html` for a comment restales mutants. Q6, Q7, Q17 and rw 131/132 ride along with any lane that owns their lines (N11) |
| B12 | rw 136: `hideSheet`'s `showRefusal("")` has no mutant | Caught by `app.test.js:783` | S4 | C1 | DROP | A test bites; only the corpus entry is missing |
| B12a | rw 135: arm-then-cancel DELETE wipes a standing NO_THIRDS warning | `disarmDelete` `:7929-7971` ends in `syncParseState({paint:false})`, which reaches `say("", "")`. Editing a NO_THIRDS deck, tapping DELETE and then tapping elsewhere clears `#scale-msg` **while the sheet stays open** (outside voice, confirmed; the earlier "closed sheet" framing was wrong) | S3 | C1 | DEFER | Musician-visible, but the warning is advisory: every chord card still carries the `NO 3RDS` badge, and reopening restores the line. **Trigger:** the next edit to `disarmDelete` or `syncParseState`, which owes the test first (the row's own text) |
| B13 | Menu focus: android Q9, Q21, Q22 | `openPanel` `:8135-8144`, desktopMQ `:8163-8182` | S4 | C1 | DROP | Only a keyboard user resizing across 1024 px reaches it |
| B14 | rw 60: the layout-order guard checks length only | `index.html:7250-7254` | S3 | C1 | DROP | Plan-accepted (`scale-page-ux.md:368`). Visible in the pan mock; RESET recovers |
| B15 | rw 90: Edit-sheet footer spacing | Visual only | S4 | C1 | DROP | Cosmetic. It sits as an optional glance on the owner checklist |
| B16 | one-pdf 4, 5, 30-35 | All hold (4 is S3 C2; the rest S4 C1) | S3-S4 | C1-C2 | DROP | None reaches a printed artifact. They are PDF-path nits that `test_pdf_parity` guards (two fresh builds compared) |
| B16a | one-pdf 6: the committed PDFs are gated on page count + text only | `tests/test_pdf_build.py:131` compares page count and extracted text; `test_pdf_parity.py:175` compares two FRESH builds, so it never sees the committed bytes (outside voice, confirmed). A colour, geometry or ratio change in `tools/hifi.py` committed without a rebuild ships stale print-shop PDFs with CI green | S3 | C2 | DEFER | The app no longer links committed PDFs (client-side build since 2026-09-24), so only the print shop is exposed. **Trigger:** the next change to `tools/hifi.py` colours, geom or `LABEL_RATIO_*`; that lane rebuilds and adds an ink check |
| B22 | #163 nit: CHORD-ONLY PDF downloads as `*_PRINTER_ONLY_Chords_*.pdf` | `index.html:6765` @4c6f700 (`pdfFileName`); the button at `:1175` reads CHORD-ONLY PDF | S4 | C2 | FIXED | **FIXED by PR #164 (merge 17240b0), owner-requested directly.** Originally DROP: the name matched the committed print-shop files and `decks.py` output, so a rename would ripple into PDF names and their tests. iOS saves `Unknown.pdf` regardless (client-pdf-emitter Task 5, WONTFIX) |
| B23 | #163 nit: `.shuffle.reroll` has no `:active` background | `index.html:532` @4c6f700; `button.nav:active{background:#2e281e}` `:511`; `:818` records why tap feedback was added | S4 | C1 | FIXED | **FIXED by PR #164 (merge 17240b0), owner-requested directly.** Originally DEFER: one CSS line, but any `index.html` edit restales `e_*` mutants |
| B17 | PR #162 nits: the X glyph's `::after` rotation is unasserted; `.seq` stays on `#count` | `index.html:253-254`; `:6940`, `:6864` | S4 | C1 | DROP | The glyph is cosmetic. The `.seq` removal is correct in code |
| B18 | STALE, already fixed or moved: rw 4, 10, 13, 14, 20, 21, 24, 30, 31, 33, 36-41, 45, 52, 69, 91, 95, 99, 107-110, 114-117, 119, 144; scale-engine 82, 83; the #162 README-count nit | See §7 | - | - | STALE | The fix shipped, or the premise moved (print controls to the panel; fake-keyboard e2e; the #163 README count to 442) |
| B19 | iOS print rows rw 147-150 | Teardown is on `afterprint` (`:6727-6740`, `:7792`). The CTA no longer calls `openPrintSheet` | - | - | STALE | They describe the legacy path only. Superseded by B3's device gate and R1 |
| B20 | rw 19 | Mutant re-anchor churn | S4 | - | **R2** | Closed by R2's early warning |
| B21 | rw 151, 155, 156, 157 | Legacy print CSS and render-agreement scan nits | S4 | C1 | **R1** | Deleted with their subject |

### Owner-device checklist (one pass, iPhone 14 / iOS 26.6 and one Android Chrome)

1. **iOS print gate (retires rw 147-150; unblocks R1).**
   - On the iPhone, open the live site. Tap the menu, then FULL DECK PDF.
   - In the share sheet, Print. Letter, 100% / Actual Size.
   - Measure the 2.00-inch calibration bar on page 1 with a ruler.
   - Repeat with CHORD-ONLY PDF (the name after #163) and with A4 selected.
   - Pass: the bar measures 2.00 in and no card is clipped.
2. **Calibration on desktop (rw 12).** Download FULL DECK PDF on desktop, print at Actual Size on Letter, and measure the bar. Repeat on A4.
3. **Safe areas (rw 23).** On the iPhone, in portrait and landscape, the header and the sheet footer clear the notch and the home indicator.
4. **Frame (rw 29).** On a printed sheet, the root-colour frame is even on all four sides, for all three decks.
5. **Keyboard (rw 34).** On Pygmy, open EDIT and focus the seed box with the iOS keyboard up. The sheet top stays on screen and SAVE CHANGES is reachable.
6. **Swipe vs back (rw 133).** On the iPhone and on Android Chrome, drag horizontally from the card centre. The deck steps and the browser does not go back. A left-EDGE swipe on iOS may still go back; accept that.
7. **Android bars (Q3).**
   - In portrait, the status bar, URL bar and gesture strip are all dark.
   - Scroll until the URL bar collapses: no light band appears.
   - Repeat in landscape, with "+ ADD" open, and with the settings panel open.
   - If a light bar persists, note the browser and whether it sits in the system bar or in the page.
8. **Optional (rw 90).** Glance at the Edit sheet's footer spacing.

## §3 Lanes

| Lane | Owns | Never touches | Rows | Acceptance | Verify |
|---|---|---|---|---|---|
| R2 stale-patch early warning | One new test in `tests/mutation_harness.test.js` (after `:344`). One new mutant `tests/mutants/mh_*.patch`. Deleting `tests/mutants/e_edit_chip_appended.patch` (B1, if O4 holds). The `"tests/mutation_harness.test.js"` FLOORS row (`tests/suite_health.py:62`, 17 -> 18) | `index.html`, `src/engine/*`, `tests/mutation_check.sh` (N13), every other mutant body | A2, rw 19, rw 5 | See "R2 acceptance" below | `node --test --test-name-pattern '^every.mutant.patch.applies.to.the.tree.it.will.run.against$' tests/mutation_harness.test.js` |
| D1 ledger close-out | A 3-line banner at the top of each of the four ledgers: "OPEN rows closed by `docs/plans/2026-09-29-backlog-and-refactor.md` §7 at `e428946`; new work goes to its §7 'carried' list". Nothing below the banner changes | Every non-doc file; the swipe plan; row bodies (no row is rewritten, so history stays greppable) | A3 | Each ledger's first screen names this plan. `grep -c '| OPEN |'` is unchanged (the banner, not a row edit, closes them) | `git diff --stat` touches exactly 4 `.md` files |
| R1 retire legacy print | Inside `index.html`, only these regions (none is an engine region or the DECKS line):<br>- the `#printroot` CSS (`:858-891`) and the `body.printing` lines of `@media print` (`:902`, `:914-927`);<br>- the JS chain from `PRINT_GEOM` `:6453` to `openPrintSheet` `:6738`, minus the shared symbols;<br>- the `afterprint` listener `~:7786-7800`;<br>- `#printroot`/`#printgeom` `:8296-8297`;<br>- `headerHTML`'s `noPrints` parameter `:6813-6821`.<br>Outside `index.html`: the listed tests in `app.test.js`, e2e and `test_render_agreement.py`; the 2 ids in `sandbox.js` `:42`; the mutants in the R1 table; the mutant count at `README.md:127`; the FLOORS rows for `app.test.js`, `e2e.test.js` and `test_render_agreement.py` | The shared symbols: `isIOS` `:6504`, `PRINT_PAPER` `:6497`, `isPaper`/`printPaper`/`setPrintPaper` `:6657-6672`, `pdfFileName`, `downloadDeckPDF` `:6764`. The unconditional `@media print` rules (`:894-900`, `:906`). `src/engine/*`, `data/`, PDFs, `tests/mutation_check.sh`, #163's hunks (`~:529`, `~:1149-1172`, `~:8206-8213`) | A1, rw 151, 155-157 | See "R1 acceptance" below | See "R1 verify" below |

**Disjointness.** R2 and D1 touch no file in common with each other or with R1. R2 owns `tests/mutation_harness.test.js` and adds and deletes whole patch files. R1 deletes different patch files and refreshes context-only ones; the two sets do not intersect (checked below). R1 is the only lane that touches `index.html`, so no `index.html` serialisation is needed inside this plan. Serialisation against the swipe lane is covered in §4.

**R2 acceptance.**
1. **Test first.** Add a new test, `every mutant patch applies to the tree it will run against`:
   - For each `tests/mutants/*.patch`, run `git apply --check <patch>` (`execFileSync`, cwd `ROOT`) one patch at a time, never batched.
   - **Skip a patch that is currently applied** (forward check fails AND `git apply --check -R` succeeds). Without this, the gate applying `mh_patch_context_drifted` makes that patch fail its own forward check, so the mutant is killed vacuously even if the test detects nothing else (eng review E2). With it, the kill must come from the patch the mutant really stales.
   - Collect the failures, then `assert.deepStrictEqual(stale, [])`. The message names each stale patch and says: "regenerate: apply by hand, edit, `git diff > patch`, keep the header".
   - It must fail on a tree where one patch is stale. Show this by editing a context line of `ab_print_bg_dropped`'s target locally, then reverting.
   - Budget: 7.1 s locally for 442 patches.
2. **Mutant** `tests/mutants/mh_patch_context_drifted.patch`:
   - It changes one context line that some other patch anchors on. Pick a comment line in `tests/helpers/cdp.js` that `e_reap_ignores_signals` anchors near, so the patch is product-neutral.
   - Header `# kills:` the new test name; `# suite:` with `.` wildcards (memory: mutant-suite-headers-are-word-split).
   - It must be killed locally with `mutation_check.sh`'s single-mutant form, or by applying it by hand and running the verify command. The failure message must name `e_reap_ignores_signals` (or whichever patch it stales), **not** `mh_patch_context_drifted` itself.
   - The line it edits must sit inside `e_reap_ignores_signals`'s hunk context (`tests/helpers/cdp.js:82-88`, e.g. the `// 'exit' cannot await anything` comment), so the two patches cannot both apply.
3. **B1 (if O4 holds):** `git rm tests/mutants/e_edit_chip_appended.patch`. `d_edit_appends_deck` stays and must still be killed.
4. **FLOORS:** `tests/mutation_harness.test.js` goes 17 -> 18.
5. **Git in CI:** the js-suites job already checks out the repo, so `git apply --check` runs there. The test skips with a named reason only if `git` is absent. It must not skip in CI: assert `process.env.CI` implies git present.

**R1 acceptance.** (Run only after checklist item 1 passes; O1.)
1. **Behaviour-lock first.** Run the CTA suite and record it green before any deletion:
   - `app.test.js` `:4132`, `:4357`, `:4370`, `:4403`, `:4434`, `:4522`;
   - e2e `:780`, `:817`, `:900`, `:933`, `:1010`, `:1839`, `:6572`, `:6698`;
   - `test_render_agreement.py` face/frame tests other than the grid ones.

   Then add the failing test `the legacy print sheet is gone: no #printroot, no openPrintSheet, no window.print caller` in `app.test.js`. It reads the source outside the engine regions and asserts all of these are absent:
   - `openPrintSheet`, `printGridCSS`, `PRINT_LAYOUTS`, `id="printroot"`, `body.printing`, `window.print(`, `afterprint`.

   It replaces `:4531` ("openPrintSheet survives the cutover"), and it fails before the deletion.
2. **Delete** the regions listed in Owns. `headerHTML(d, ch, n)` loses `noPrints` and its `void`; every remaining caller already passes three arguments.
3. **Tests:** delete the tests whose only subject is the legacy path. The lane enumerates the list with `grep -nE 'openPrintSheet|printroot|printGridCSS|printCardList|printCardHTML|printSheetHTML|PRINT_LAYOUTS|teardownPrintSheet|afterprint|printLayoutName'` and records it in the PR body. Starting set:
   - `app.test.js` `:3581-3805`, `:3828`, `:3887`, `:3942`, `:4003`, `:4093`, `:4102`, `:4200-4303`, `:4531`;
   - e2e `:1857`, `:1893`, `:7586`;
   - `test_render_agreement.py` `:763`, `:795`, `:811`, `:874`, `:963`, plus the grid helpers `:611-800`.

   Three tests are **narrowed, not deleted**, because their subject survives:
   - `:3915` "iPadOS in desktop mode is still treated as iOS" keeps its `isIOS` assertions and drops the four `printLayoutName` lines. `isIOS` still routes iOS PDF delivery, and `p_print_ios_ipad_desktop_ua_dropped` must stay killed by it (outside voice, confirmed);
   - `:3942` "never declares a page-box height" is narrowed to the surviving block;
   - `test_print_block_forces_colour` `:868` stays.
4. **Unchanged:** the byte-identical DOM fixture test over `seq_ui_base_e728912.json` passes unchanged. `validate.py` passes 6/6.
5. **FLOORS** go down by exactly the number of deleted tests: new floor = old floor minus the deleted count, per file. Floors already trail the ran-count (205 vs 208, 155 vs 161), and that slack is kept, not absorbed (eng review E5). The PR body lists the delta per file. This is the one lane allowed to lower a floor, because it deletes tests with their subject (O1).
6. **Sandbox:** remove `"printroot", "printgeom"` from `sandbox.js:42`.
6a. **README mutant count:** restate `README.md:127` to the new corpus size. `tests/test_readme_currency.py:112-129` asserts the stated count is at most the number on disk, so 442 against ~413-417 fails CI (eng review E3). `README.md` joins R1's Owns.
7. **Pre-push:** run `git apply --check` over every patch. R2's test does this if R2 has merged.
8. **Blank padding:** confirm the PDF path's blank padding is killed by a pdfcards/pdfdeck mutant before retiring `p_full_deck_loses_its_blank_templates`. If none exists, re-target that mutant onto `src/engine/pdfdeck.js` instead of retiring it.

**R1 verify.**
```
node --test tests/app.test.js
python3 -m unittest tests.test_render_agreement
python3 tools/validate.py
export CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; node --test --test-name-pattern 'print.buttons.are.re-enabled|every.deck.s.print.row|under.print.media|FULL.DECK' tests/e2e.test.js
```
The evidence is CI 5/5 at the head SHA, with a mutation gate of 442 minus the retired count, all killed.

**R1 mutants.** Found with `grep -l` on the removed lines (`printroot|printGridCSS|openPrintSheet|teardownPrintSheet|printSheetHTML|printLayoutName|printcell|printpage|afterprint|body\.printing|PRINT_LAYOUTS|PRINT_SAFE|PRINT_GEOM|printCardHTML|printCardList`, plus the shared-symbol names). The table comes first, then notes on the rows that need them.

| Mutant | Disposition |
|---|---|
| `p_print_align_items_dropped`<br>`p_print_floor_on_wrong_selector`<br>`p_print_grid_wide_row_gap`<br>`p_print_ios_selects_wide`<br>`p_print_narrow_not_rotated`<br>`p_print_teardown_captures_stale_root`<br>`p_footer_prints_over_the_card_sheet`<br>`p_print_container_left_populated`<br>`p_print_constrained_flag_dropped`<br>`p_print_fill_parent_dropped`<br>`p_print_cta_drops_the_platform`<br>`p_print_justify_dropped`<br>`p_print_footprint_unrotated`<br>`p_print_min_height_dropped`<br>`p_print_narrow_gutters_restored`<br>`p_print_page_height_restored`<br>`p_print_rotation_never_emitted`<br>`p_print_safe_margin_understated`<br>`p_print_afterprint_never_registered`<br>`p_print_teardown_synchronous_again`<br>`p_print_wide_gutters_zeroed`<br>`p_print_grid_narrow_gutters`<br>`p_print_narrow_gy_restored`<br>`p_printscale_clipped_by_pagination` | **Retire** (24): their target and test are deleted |
| `p_full_deck_loses_its_blank_templates` | **Retire, or re-target** onto `pdfdeck.js` (R1 step 8) |
| `p_print_page_fill_dropped`, `p_print_selector_case`, `p_print_media_anchor_vacuous`, `p_print_parent_height_literal` | **Re-target, or retire** |
| `ab_print_bg_dropped` | **Context refresh**: the `html,body{... background:#fff}` rule and e2e `:6572` stay |
| `p_print_paper_height_restored` | **Context refresh**: `PRINT_PAPER` and test `:4084` stay |
| `p_print_ios_ipad_desktop_ua_dropped` (`isIOS`), `p_paper_picker_forgets_its_state`, `qd_j_paper_not_string`, `qd_j_paper_inherited_key` (`isPaper`/`printPaper`) | **Context refresh**, only if `git apply --check` fails |

- **The four re-target-or-retire mutants** all use `:4003`'s "page box something to fill". Narrow that test to the surviving unconditional block and re-target them if it still asserts something. Otherwise retire all four and say so.
- **Mutant prefix:** `r1_` for any re-targeted patch.
- **Collision check:** none of the R1 mutants is R2's `e_edit_chip_appended` or `mh_*`, so the sets are disjoint.

## §4 Order and dependencies

1. **Now, in parallel:** R2 and D1. They share no file with each other or with #163. Base: `main` after #163 merges. R2's new test must see #163's `sqe_reroll_not_marked`, so it must not branch before the merge.
2. **Swipe animation (B4; its own plan):**
   - It touches `render()` `:6903-6973`, `flip`/`step` `:8078-8082`, the card listeners `:8083-8095`, touch `:8255-8261`, and the `.card`/`.flip` CSS.
   - **R2 and D1 touch none of it.** R2 is the swipe lane's safety net: a swipe edit that stales `e_swipe_*` or `d_*` patches is caught in seconds.
   - The swipe lane should start **after R2 merges**.
   - **R1 touches render code in one place only:** the `headerHTML` signature `:6813`, called from `render()`. Everything else in R1 sits in regions the swipe does not own.
   - **Rule:**
     - if checklist item 1 has passed before the swipe lane starts, run R1 first. It deletes ~25-29 `index.html` mutants that the swipe lane would otherwise have to keep applying;
     - otherwise the swipe lane goes first, and R1 rebases onto it later. The only shared line is the `headerHTML` signature.
   - The two are **serialised, never concurrent**: both edit `index.html` and both stale `e_*` patches.
3. **Roadmap, after the swipe, in the owner's order (O5):**
   - **Audio arpeggio.** No refactor needed. It reads each card's `fields` midi at render, and S mode's chord list per N21. Cheapest next: it touches no state model.
   - **SM-2.** Needs per-card state in localStorage, keyed by deck and card. It lands on A4's module-level `let`s. That is acceptable for one more field set, and not a reason to refactor first. S mode stores no per-card state (N22). It should precede stats.
   - **Stats.** Read-only over SM-2's store. After SM-2.
   - **PWA.** A sibling manifest and service worker. No `index.html` refactor needed. It is cheapest last, because the cache list then covers the final asset set. N2 still holds: no `<script src>`.
   - None of the four needs A5-A8 first. Each should do A7/A8's ride-along cleanup if it owns those lines.

## §5 Merge gates

Deltas from quality-eval §6 only:
- **Gate 1 (CI 5/5 at the verified head SHA).**
  - R2 adds one precondition: R2's own test must be green in the js-suites job at that SHA.
  - D1 changes only docs. CI still runs, and gates 1-2 apply unchanged.
- **Gate 2 (fresh reviewer PASS or PASS_WITH_NITS).** The R1 reviewer is additionally briefed to check three things:
  - that no deleted test's subject survives in the product;
  - that every FLOORS decrease equals a deleted-test count in the PR body;
  - that the shared symbols are untouched.
- **R1 extra gate:** it merges only with checklist item 1 recorded as passed in its PR body (owner's date and result). The gate is the owner's answer, not the lane's.
- Gates 3-4 are unchanged.

## §6 Owner decisions

**Owner answers (2026-09-29 interview):** O1 = **gate already met** (per Task 5's disposition), so R1 may start now. O3 = recommended default (grow slowly). O5 = recommended order (R2 + D1, then swipe). O2 and O4 not asked; defaults stand. Also: N40 of the swipe plan is folded into the swipe lane.

| # | Question | Recommended default |
|---|---|---|
| O1 | **Refactor scope.** Retire the legacy `window.print()` path (R1)? R1 is the one lane that lowers FLOORS. The gate is contested (A1): Task 5's disposition says the ruler check gates nothing, while `one-pdf-path.md:17-19` and `index.html:6651` still wait on a phone print | **Yes, gated on checklist item 1** (the conservative reading). The owner may instead rule the gate already met per Task 5's disposition; R1 can then start at once. Until one of the two, R1 does not start |
| O2 | **Queue-doc consolidation.** Close the four ledgers with a banner pointing at §7 (D1), and carry the survivors in one list here? | **Yes.** The survivors: DEFER B5-B8, OWNER B1-B4 and the checklist. No row body is rewritten, so history stays greppable. New findings go to the next triage doc, not back into the old ledgers |
| O3 | **Mutant-corpus policy** | **Three parts:**<br>1. No bulk retirement.<br>2. New mutants only for S1/S2 escape paths, plus one per new test group (quality-eval D2).<br>3. Keep the 5 slow hygiene mutants (206 s): a regression there hangs CI.<br>The alternative is to retire them and save ~3.5 min per PR. Choose it if gate time starts to hurt more than a CI hang would |
| O4 | **The 2026-09-15 interview items.** rw 5: de-duplicate the twin mutant. rw 6: guard `formatSeed` | **rw 5:** retire `e_edit_chip_appended` in R2 (keeps the decision; one file deletion). **rw 6:** overturn to DROP (no reachable input) |
| O5 | **What comes next** among the swipe animation and the roadmap | **Order:**<br>1. R2 + D1.<br>2. The swipe animation (after R2; before or after R1 by the §4 rule).<br>3. The roadmap: audio, SM-2, stats, PWA |
| O6 | Device checklist (§2) | One owner pass. Item 1 unblocks R1; the rest close rows 12, 23, 29, 34, 133 and Q3 whatever the result. A failure becomes a new row in the next triage |

**Eng-review auto-decisions** (spawned session: the recommended option was taken at each point, and nothing destructive was chosen). Each is folded into the sections above. Detail is in "Eng review" below.

| # | Decision point | Auto-choice |
|---|---|---|
| E1 | Prerequisite offer: run /office-hours first? | Skip it. The plan is a triage, not a product design |
| E2 | R2's test vacuously kills its own mutant (an applied patch fails its own forward check) | Apply the fix: skip any patch whose reverse applies. The kill must name the patch it stales (R2 acceptance 1-2) |
| E3 | R1 retiring ~25-29 mutants breaks `test_readme_currency.py`'s upper bound | Apply: R1 restates `README.md:127` and owns it (R1 step 6a) |
| E4 | Outside voice: `app.test.js:3915` mixes surviving `isIOS` with deleted `printLayoutName` | Apply: narrow it, do not delete it (R1 step 3) |
| E5 | Outside voice: R1 step 5's two floor formulas conflict | Apply: old floor minus deleted count; keep the existing slack |
| E6 | Outside voice: rw 135 is visible with the sheet open | Apply: DROP to DEFER, with a trigger (B12a) |
| E7 | Outside voice: one-pdf 6's committed PDFs are not parity-gated | Apply: DROP to DEFER, with a trigger (B16a) |
| E8 | Outside voice: the R1 device gate is contested by Task 5's own disposition | Apply: keep the conservative gate as O1's default, and let the owner rule it met |
| E9 | Coordinator: the two #163 reviewer nits | B22 (download filename) DROP; B23 (`.shuffle.reroll :active`) DEFER |
| E10 | Scope Challenge: the plan touches 8+ files | Accept as-is. Each lane is already minimal, and R1's breadth is deletion of one dead chain |
| E11 | TODOS.md updates | None proposed. §7's carried list is the backlog, and this pass may write only the plan file |
| E12 | Next step | "Ready to implement". A design review is not needed: R1 deletes unreachable UI, and B23 is deferred |

## §7 Queue disposition

Every OPEN row at `e428946`. "R1"/"R2" means closed by that lane. OWNER includes owner-device rows.

**remaining-work (92 rows)**

| Verdict | Rows |
|---|---|
| R2 | 19 |
| R1 | 151, 155, 156, 157 |
| OWNER | 5, 6, 12, 23, 29, 34, 133 |
| DEFER | 2, 7, 122, 123, 135 |
| DROP | 3, 8, 9, 11, 15, 16, 17, 18, 22, 25, 26, 27, 28, 32, 35, 43, 60, 68, 81, 86, 90, 98, 124, 125, 126, 127, 128, 129, 130, 131, 132, 136, 138, 139, 145, 146, 152, 153, 154 |
| STALE | 4, 10, 13, 14, 20, 21, 24, 30, 31, 33, 36, 37, 38, 39, 40, 41, 45, 52, 69, 91, 95, 99, 107, 108, 109, 110, 114, 115, 116, 117, 119, 144, 147, 148, 149, 150 |

Counts: 1 + 4 + 7 + 5 + 39 + 36 = 92.

**The other ledgers and sources**

| Source | Verdict | Rows |
|---|---|---|
| one-pdf (9) | DROP | 4, 5, 30, 31, 32, 33, 34, 35 |
| one-pdf | DEFER | 6 |
| android (15) | OWNER | Q3 |
| android | DROP | Q4, Q5, Q6, Q7, Q8, Q9, Q15, Q16, Q17, Q21, Q22, Q23, Q25, Q26 |
| scale-engine (2) | STALE | 82, 83 |
| PR #162 nits (3) | DROP | X-glyph rotation; `.seq` on `#count` |
| PR #162 nits | STALE | `README.md:127` count (fixed by #163, merged `4c6f700`; the corpus is 442) |
| PR #163 nits (2) | FIXED (was DROP; PR #164 fixed it, owner-requested) | Download filename now `*_CHORD_ONLY_*` (B22) |
| PR #163 nits | FIXED (was DEFER; PR #164 fixed it, owner-requested) | `.shuffle.reroll` now has `:active` (B23) |
| Owner requests (5) | OWNER | Swipe animation |
| Owner requests | DEFER | SM-2, stats, PWA, audio |

**Carried after D1.** These are the only live items:
- DEFER: rw 2, 7, 122, 123, 135; one-pdf 6; the #163 `:active` nit (B23); and the four roadmap items;
- OWNER: rw 5, 6, the checklist, and the swipe animation;
- Part A DEFER: A7, A8.

### Where verification contradicted a queue row

- **Already fixed:**
  - scale-engine 82: `test_gen_deck.py:501-509` now uses a sha256 snapshot.
  - scale-engine 83: `:206-233` is a quote-agnostic ban list, and `tools/gen_deck.js` needs only `node:fs` plus `./engine_loader.js`.
  - rw 4, 10, 31, 33 and 39. rw 69: the SIGKILL-by-construction mechanism is gone.
- **Recounts:**
  - rw 144: floor 205 vs 208 ran, not 112 vs 158.
  - rw 139: 37 unanchored, not 12, and the over-match is fixed.
  - rw 153: ~77/441 prose kills, not 65/372, and whole-file suites are fixed.
  - rw 14/30: 29 `c_*` patches exist.
- **Premise moved:**
  - rw 12: the preset row is gone.
  - rw 21, 37, 38 and 40: the print controls moved to the panel.
  - rw 28: the literal lives in `decks.json` print.blurb, stale in all three decks.
  - rw 34: 85dvh is replaced by `kbCap()`.
  - rw 86 N3: the arming copy is in `#scale-del-note`.
  - rw 147-150: the CTA no longer uses browser print.
- **Weighting:**
  - rw 126: the CI js job runs e2e directly, so no escape.
  - rw 27: `test_pdf_parity` sees a divergence, so no escape.
  - android Q4: the comment already names both 10.4 and 12.08.
  - rw 17: the drift is overstated.
  - rw 135 (against this plan's first draft, found by the outside voice): the warning clears while the sheet is OPEN, so it is musician-visible; moved DROP to DEFER.
  - one-pdf 6 (same): `test_pdf_parity` compares two fresh builds, not the committed PDFs; moved DROP to DEFER.
  - client-pdf-emitter Task 5 is recorded as PASSED for D2 (`:717-721`), which contradicts the "device gate still open" reading in `one-pdf-path.md:17-19`; routed to O1.
- **Line references only:** rw 2, 3, 15, 25 and 35 cite stale line numbers.
- **The prompt's own framing:**
  - "`index.html` 8299 lines": only ~2370 are hand-written app JS.
  - "~10 min gate": 13m08s at `e428946`.

## Eng review (2026-09-29, /plan-eng-review)

Spawned session, mode FULL_REVIEW. Reviewed at `e428946`, with the #163 facts checked at `4c6f700`. Outside voice: Codex, completed.

**Step 0, Scope Challenge.** 3 lanes, about 12 files. Most of R1's files are deletions of one dead chain, R2 is one test plus one mutant, and D1 is banners. No simpler cut keeps goal (a) or (b). Accepted as-is (E10).

**Section 1, Architecture (1 issue).**
- E8: R1's gate rests on two docs that disagree. Routed to O1.
- Otherwise sound: R2 lives in the existing harness (N19), and R1 keeps the shared symbols and the unconditional `@media print` rules.

**Section 2, Code quality (1 issue).**
- E5: R1's floor rule was self-contradictory. Fixed.

**Section 3, Tests (3 gaps, all folded in).**

```
R2 test: every patch applies
  clean tree ................................ [TESTED] verify cmd
  one patch stale ........................... [TESTED] mh_patch_context_drifted
  patch currently applied (gate run) ........ [GAP -> fixed E2] skip when -R applies
  git absent in CI .......................... [TESTED] assert CI => git
R1 deletion
  CTA download path (app + e2e) ............. [TESTED] behaviour-lock list
  legacy symbols gone ....................... [TESTED] new failing-first test
  isIOS / iPad routing ...................... [GAP -> fixed E4] narrow :3915
  README mutant count ....................... [GAP -> fixed E3] step 6a
  Cmd+P output (unconditional print CSS) .... [TESTED] e2e :6572
D1 banners .................................. [CHECK] diff --stat = 4 files
```

The test-plan artifact is at `~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-test-plan-20260929-174750.md`.

**Section 4, Performance (0 issues).**
- R2 adds ~7 s (442 `git apply --check` spawns) to js-suites (1m45s) and one short mutant to the gate.
- R1 removes ~25-29 mutants from the 13-minute gate.

**Outside voice (Codex), 5 findings, all accepted:** E4, E5, E6 (rw 135), E7 (one-pdf 6) and E8. Its verdict was "revise before execution", and the revisions are made above. No cross-model disagreement remains.

### NOT in scope
- Marker-anchored mutants (A15): needs a `mutation_check.sh` change (N13).
- Retiring the slow hygiene mutants: an owner call (O3).
- Renaming the `PRINTER_ONLY` download (B22): it ripples into the committed PDF names.
- An ink-level check on the committed PDFs (B16a): deferred to the next `hifi.py` change.
- The swipe animation: it has its own plan.

### What already exists
- `mutation_check.sh:228` already runs `git apply --check` per patch, but only late in the gate. R2 reuses that mechanism earlier; it does not rebuild it.
- `downloadDeckPDF` already serves every CTA, so R1 builds no replacement.
- `test_readme_currency.py` already bands the README count; R1 just restates it.

### Failure modes
| New path | Realistic failure | Test | Handling | Visible? |
|---|---|---|---|---|
| R2 test in CI | A shallow or detached checkout makes `git apply` misbehave | The CI-implies-git assert | Red with the patch named | Loud |
| R2 test during the gate | A vacuous self-kill hides a broken detector | E2 fix, plus the kill message naming the other patch | - | Now loud |
| R1 deletion | A surviving caller of a deleted symbol | The new absence test plus the full `app.test.js` run | Throws at boot | Loud |
| R1 README | The count goes over the corpus | `test_readme_currency` | Red | Loud |

Critical gaps: 0.

### Worktree parallelization
| Step | Modules touched | Depends on |
|---|---|---|
| R2 | tests/ (harness, mutants, suite_health) | #163 merged |
| D1 | docs/plans/ | - |
| R1 | index.html, tests/, README.md | O1; serialised with the swipe lane |

Lane A: R2 (independent). Lane B: D1 (independent). Launch A and B in parallel worktrees and merge both. R1 goes later, per §4. Conflict flag: R1 and R2 both touch `tests/mutants/` and `tests/suite_health.py` FLOORS, on disjoint files and rows. Run R1 after R2 merges so R2's test guards R1's refreshes.

### Implementation Tasks
- [ ] **T1 (P1, human: ~2h / CC: ~15min)**: mutation harness. Add the "every mutant patch applies" test, with the applied-patch skip.
  - Surfaced by: A2, E2.
  - Files: `tests/mutation_harness.test.js`.
  - Verify: the R2 verify command.
- [ ] **T2 (P1, human: ~1h / CC: ~10min)**: mutants. Add `mh_patch_context_drifted` inside `e_reap_ignores_signals`'s context; delete `e_edit_chip_appended` (O4); FLOORS 17 -> 18.
  - Surfaced by: A2, E2, B1.
  - Files: `tests/mutants/`, `tests/suite_health.py`.
  - Verify: the single-mutant run; the kill message names `e_reap_ignores_signals`.
- [ ] **T3 (P2, human: ~30min / CC: ~5min)**: ledgers. D1 banners on the four ledgers.
  - Surfaced by: A3.
  - Files: 4 ledger `.md` files.
  - Verify: `git diff --stat`.
- [ ] **T4 (P1, human: ~1 day / CC: ~1h)**: R1. Retire the legacy print path per steps 1-8, including narrowing `:3915`, the floor formula and the README count.
  - Surfaced by: A1, E3, E4, E5.
  - Files: `index.html`, `tests/`, `README.md`.
  - Verify: the R1 verify commands, then CI 5/5.

The effort ratio assumed is tests ~50x, deletion or refactor ~5x.

### Decision ledger
| ID | Question | Answer | Source |
|---|---|---|---|
| E1-E12 | See §6 | Recommended option | Auto-decision (spawned) |
| O1-O6 | Owner decisions | Pending owner | Not auto-decided: owner scope |

Approval readiness: PASS (E1-E12 each cite their spawned auto-decision; O1-O6 are owner questions recorded as open inputs to execution, not review choices).

Completion summary:
- Step 0: scope accepted as-is.
- Architecture: 1.
- Code quality: 1.
- Tests: diagram produced, 3 gaps (all fixed).
- Performance: 0.
- NOT in scope: written. What already exists: written.
- TODOS.md: 0 proposed.
- Failure modes: 0 critical gaps.
- Unresolved decisions: 0 in this review.
- Outside voice: Codex, completed.
- Parallelization: 3 lanes, 2 parallel / 1 sequential.
- Lake Score: N/A.

---

**Counts.** Part A: REFACTOR 3 / DEFER 2 / LEAVE 11. Part B (128 items: 118 queue rows, 5 PR nits (#162 3, #163 2), 5 owner requests):
- closed by a lane: 5 (R1 4, R2 1);
- FIX 0;
- OWNER 9;
- DEFER 11;
- DROP 64;
- STALE 39.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Outside Review | codex (via `/plan-eng-review`) | Independent 2nd opinion | 7 | issues_found (completed) | 5 findings, all accepted (E4-E8) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 20 | ISSUES OPEN (PLAN) | 7 issues, 0 critical gaps (all resolved into the plan) |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 (not this plan) | - | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | - | - |

**OUTSIDE COVERAGE:** codex, plan-review phase, completed; 5 findings, all accepted.

**VERDICT:** no review is CLEAR for this plan. The 7 issues are resolved in the text, but the logged status is issues_open by rule. Eng review required: the findings are mapped work, not open decisions. Owner decisions O1-O6 remain owner inputs to execution.

NO UNRESOLVED DECISIONS
