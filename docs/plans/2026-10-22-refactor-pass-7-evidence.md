# Refactor pass 7: evidence

Read-only exploration over the detached worktree
`/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/3347d7d0-1ec9-4967-bd81-dd4cf98e29d7/scratchpad/wt-refactor-7`
at 7b43df7 (= origin/dev, 2026-10-22). Line numbers are for that tree; `main`
differs from it by `_headers` and one line of `index.html` (the GA id), so app
block lines are identical on both. Every claim names where it came from; every
"dead" claim carries the reader enumeration the pass-4 standard asks for
(`git grep -n -a -w <name> -- . ':!tests/mutants' ':!docs'`, then
`grep -l -a -F '<removed line>' tests/mutants/*.patch`). Sentences marked
UNRESOLVED are ones the budget did not close and the lane must re-check.

Supporting files in `SCRATCH/explore-refactor-7/`:
`css_probe.js` + `css_probe.json` (DOM probe, 45 states), `cov/local-report.json`
(local coverage), `ci/cov-38691626201/` and `ci/cov-39053255194/` (the two CI
coverage reports, at 2e25d380 and 37e7f7f0), `ci/val/*` + `ci/mut-shard-{1..4}.log`
+ `ci/js-tests.log` (validate run 39803360191 at 816fe7ca = origin/main),
`mutants.json` (per-mutant shard, timestamp, status, killer title, duration proxy),
`kill_sample_plan.txt` + `kill_sample.log` (the 30-mutant kill-reason sample).

Exclusions honoured: importer paths (`src/engine/importer.js`, its region,
`tests/import*.test.js`) are reported but no lane touches them; DEV-env paths
(`validate.yml`, `tools/ci_scope.py`, `tests/test_ci_scope.py`) likewise.

---

## 1. Coverage: zero-hit code

Method. Three `tools/coverage_merge.js` reports were intersected: the two CI
`coverage.yml` artifacts (manual runs at 2e25d380 and 37e7f7f0) and a local run
(`cov/local-report.json`: unit + python + CDP legs, the e2e leg single-test only,
so the local report alone under-counts browser-only paths and is never the sole
evidence). A function is a candidate only when it is zero in ALL THREE. CSS was
probed separately (1.3).

### 1.1 JS functions zero in all three reports

| id | where | class | evidence |
|---|---|---|---|
| FN-1 | `gestureCancel` closure, app block ~index.html:12468 (`gestureCancel = () => endPress(false);`, flag declared 11119) | LIVE-UNREACHED (KEPT, = P5-9) | zero in all three; readers: 5 writers in the app block, invoked from `pointercancel`/`blur` paths no test drives. Pass 4/5 kept it as the real-browser cancel path. No lane removes it. |
| FN-2 | `springBack` rejection handler, app block 13161 (`.finished.then(swipeRest, () => {})`) | LIVE-UNREACHED (KEPT, = P5-9) | zero in all three; the handler exists for `Animation.finished` rejecting on cancel. Harmless; keep. |
| FN-3 | `clearPanPreview`, app block 11417 | LIVE | called at 11495; it is zero in the two CI reports but hit locally in the drawer e2e. Not dead. Pass 5 recorded the same. |
| FN-4 | `tools/sandbox.js` location stub `set search` (212) and `set pathname` (218) | TEST-ONLY stub, KEPT | app block reads `location.search` (2 sites) and `location.pathname` (4 sites) but never assigns; no test assigns either (grep over `tests/*.test.js`, `tests/helpers/*.js`: no hit). Removing the setters breaks nothing today; they are the stub's completeness, pass-4 class TEST-ONLY. Candidate for L3 only if the owner wants the stub trimmed (Q4). |
| FN-5 | `tools/sandbox.js` `location.toString()` (221), `preview.hasPointerCapture` (296), `localStorage.removeItem` (483), `history.get length` (434), `window.print` | TEST-ONLY stub, KEPT | no reader in the app block for any of the five names (`git grep -w` over index.html outside engine regions: 0 hits for `hasPointerCapture`, `removeItem`, `window.print`; `String(location)`/`location.toString` 0; `history.length` 0). No test reads them either. Same class as FN-4; same disposition. |
| FN-6 | `tools/sandbox.js`: 14 functions zero in all three (the FN-4/FN-5 set plus `makeElement` helpers `matches`/`closest` branches for selectors the app never passes) | TEST-ONLY | listed in `cov/local-report.json` `files["tools/sandbox.js"].zeroFunctions`; none has an app reader. Not deleting: `boot` (476 lines) is the file's real problem (see 2.2). |
| FN-7 | `tools/gen_deck.js` `parseArgs` anon L100; `tools/coverage_merge.js` anon L128/L228/L491; `tools/regen_card_fixture.js` main anon L280; `tests/helpers/cdp.js` `sleepSync` 56-58 and anons 200/295/319-321 | LIVE-UNREACHED (CLI/error paths) | each is an error branch or a CLI flag path (`--check` failure print, unknown-flag usage) that no test drives. Pass 5 class P5-13 ("never-loaded tools"). No action; a lane that wants them covered adds a test, never removes them. |
| FN-8 | never loaded locally: `tools/boot_sim.js`, `tools/pdf_adapt.js`, `tools/pdf_smoke.js`, `tools/regen_import_gold.js`, `tools/regen_pan_fixture.js`, `tests/helpers/dump_app_render.js`, `tests/helpers/engine.js` (local report `neverLoaded`) | LIVE (CLI tools, one mutant each or run by CI) | `boot_sim.js` is run by one mutant suite header (`node tools/boot_sim.js`); the regen tools are owner-run. Not dead. |
| FN-9 | `tools/probe/panel_fit.js` | UNRESOLVED | the pre-compaction note of "16 functions zero in all three" could NOT be reproduced: the three-report intersection of its `zeroFunctions` is EMPTY. Treat as live; a lane re-runs the intersection before touching anything here. |
| FN-10 | importer REASONS entries `UNDECLARED_PARENS` etc. (index.html engine region 4646/5100/5162) | EXCLUDED (importer path) | zero-hit reason strings in the importer region; the importer is out of scope for this pass. Recorded only. |

Dead-code total from coverage: **0 deletable JS functions** (every zero-hit
function is a kept browser-only path, a CLI error branch, or a sandbox stub
with no app reader; the stubs are the only removable items and are TEST-ONLY,
decision-gated by Q4).

### 1.2 Branches

The merged reports carry `uncovered` ranges, not branch ids. The only app-block
ranges zero in all three that are not inside FN-1/FN-2 are:

| id | range | class | evidence |
|---|---|---|---|
| BR-1 | app block 9374-9377 `say(res.reason, "err")` and its `.announce.err`/`#scale-msg.err` styling | LIVE-UNREACHED | reached only when the engine refuses a seed the sheet already accepted (a stale-record edge). CSS atoms for it are in 1.3 as LIVE. Keep. |
| BR-2 | app block 11722 `#scale-sheet.tiny` writer (short-keyboard landscape) | LIVE-UNREACHED in unit, LIVE in e2e "UX: at 844x390 with the keyboard up (tiny, the surface scrolls)" | the e2e leg was single-test locally; the CI coverage reports predate that test's merge. Not dead. |

### 1.3 CSS rules (DOM probe)

`css_probe.js` served the worktree over `node:http`, collected every
`CSSStyleRule` (recursing `@media`), split top-level commas into 265 atoms from
330 rules, stripped state pseudos (`:hover :active :focus* ::before ::after
::placeholder ::selection ::-webkit-* ::-moz-*`), and ran `querySelectorAll`
over 45 states: boot-380, flipped, mode-notes, seq-basic, after-seq-toggle,
panel-open-380, panel-paper-focus, about-open, add-scale-tab, add-bad-line,
add-good-line, add-field-error, add-fields-ok, add-crowded-warning,
add-layout-tab-crowded, add-layout-noticed, add-drawer-open, add-drawer-fine,
add-drawer-note-next, add-layout-lipshut, add-layout-restored,
add-scale-tab-after-layout, add-scale-lipshut, add-keyboard-up,
edit-scale-tab, edit-delete-armed, edit-layout-tab, edit-swatch,
custom-deck-shown, share-url-revealed-forced, edit-custom,
edit-custom-delete-armed, landscape-boot, landscape-panel, landscape-add-scale,
landscape-add-layout, landscape-drawer, landscape-lipshut, desktop-boot,
desktop-panel, desktop-about, desktop-add, desktop-add-layout, narrow-320,
narrow-add. Result: live 242, never matched 23, selector errors 0, pseudo-only
(matched only after stripping) 5. States NOT probed: print media (`@media
print` rules were collected and matched like the rest; print-only visibility is
not a selector question), the fly-out mid-animation classes, the real keyboard
(fakeKeyboard only), `prefers-reduced-motion`.

Of the 23 never-matched atoms, 20 have a JS writer for the class/attribute and
are LIVE or LIVE-UNREACHED (not listed as dead):
`#share-copy:disabled` (writer 13468), `.prints button:disabled` (9948),
`.bigname sup` (9989), `.badge` (10005), `.shuffle.on` (13004),
`#scale-sheet.noticed #scale-msg.warn.pan` (paintLayout toggle),
`#scale-sheet.lipnow …` x2 (10755-10817), `.sheetbody:has(#scale-layout-zone.nostick) …`
x2 (10585/10597), `#scale-drawer-status.warn` (10508), `#scale-field-msg.info`
(12599), `#scale-field-msg.stale` (12601), `#scale-sheet.tiny …` x2 (11722),
`#scale-preview.dragging` x2 (12432/12438), `.panghost` (12337),
`#scale-msg.err` / `.announce.err` (9374/9377).

**Likely-dead CSS (3 atoms, no writer anywhere):**

| id | rule (index.html) | states probed | reader enumeration | mutants |
|---|---|---|---|---|
| CSS-D1 | `#scale-box-wrap.passive ~ #scale-line-note.stale` (atom of the rule at 1152, which also carries the LIVE atom `#scale-fields.stale #scale-fields-note`) | all 45, incl. add-bad-line (line stale while fields active) and add-field-error (fields stale while box active) | CSS 1147/1148/1152; markup 1501; app block `lineNote` const 10359 gets only `textContent` and never a class; `app.test.js` reads its textContent at 10668/10682/10732/11032/11065 and never a class; `tools/sandbox.js:68` lists the id. No `classList` write of `stale` on `#scale-line-note` exists (`git grep -n 'lineNote.classList\|scale-line-note.*stale'`: 0). | `grep -l -F` over tests/mutants: matches only `di_e_passive_low_contrast.patch`, whose +/- lines do not contain the atom. No mutant anchors on it. |
| CSS-D2 | `#scale-drawer[hidden]{display:none}` at 1072 | all 45 incl. add-drawer-open/landscape-drawer and every closed-drawer state | sole reference in the repo; `drawerBox.hidden`/`setAttribute("hidden"` on the drawer: 0 hits; the drawer is shown/hidden by the `open` class (`#scale-drawer.open`, writers 10585ff). Markup 1501ff serves no `hidden` attribute on it. | `dr1_disabled_not_dimmed.patch` matches by file grep but edits `#scale-drawer .mode:disabled, #scale-fine-toggle:disabled{…}`, not this line. No mutant anchors on it. |
| CSS-D3 | `#scale-next:disabled` atoms in the rules at 1045 (`#scale-generate:disabled, #scale-next:disabled{opacity:.5; cursor:default}`) and 1244 (`#scale-generate:disabled:active, #scale-next:disabled:active{…}`) | all 45 | `nextBtn` is only ever given/removed `.hidden` (10579, 10705, 10985); no `disabled =`/`setAttribute("disabled"` on it (0 hits). The `#scale-generate:disabled` halves of both rules are LIVE (writer 12005ff). | `sqe_reroll_no_press_state.patch` matches by grep on another line of 1244's neighbourhood; its +/- lines do not contain `#scale-next`. No mutant anchors. |

Removal of CSS-D1..D3 is a selector-list edit (drop one comma-separated atom
each; CSS-D2 drops a whole one-line rule) with zero computed-style change in
any probed state. Owner question Q1 asks whether CSS-D3's `#scale-next:disabled`
is kept on purpose as a future affordance (the generate button's twin).

---

## 2. Duplication and structure

### 2.1 Same logic twice

| id | sites | verdict |
|---|---|---|
| DUP-1 | `fnv1a` in `src/engine/share.js` vs `fnv1a32` in `src/engine/core.js` (= P6-6, deferred by pass 6) | the one true engine duplicate; both are the 32-bit FNV-1a loop. A lane exports one from core and imports it in share; the share checksum is pinned by "SV: the five built-in decks' v5 links are pinned" and the deckId by "every frozen legacy string keeps its deck id…", so any arithmetic drift is caught. Engine corpus fixture must stay byte-identical (named in the lane). |
| DUP-2 | app block vs HPE exports | checked every app-block top-level function name against the `HPE.*` export tables: the only overlaps are `deck` (9190, the app's registry lookup, a different function) and `pc` (9565, a one-line wrapper over `HPE.core.pc`). No duplicate logic. |
| DUP-3 | `tools/hifi.py` vs `src/engine/pdfcards.js` | by-design parity (pass-4 G1); `tests/test_render_agreement.py` pins the two. Not a refactor target. |
| DUP-4 | `tests/e2e.test.js` repeated `setViewport`/`eval` preambles (= P5-11) | ~60 tests open with the same 6-line boot-and-size preamble. Out of scope for every lane except L5 and only as a helper extraction with identical pass sets; recorded, not scheduled (owner Q5). |
| DUP-5 | three local `const sleep = (ms) => new Promise(...)` definitions in e2e.test.js (14509, 15001, 15951) beside the file-level one | trivial; L5 folds them into the file-level helper. |

### 2.2 Functions over 80 lines

| id | function | file:line | lines | note |
|---|---|---|---|---|
| FN-L1 | `pan` | index.html:9643 (app block) | 108 | one SVG build; splitting it changes `pan_render_v1.json` only if output changes, which a split must not. Pass 5 dropped "long functions" (P5-14) as not worth a lane; recorded only. |
| FN-L2 | `runGenerate` | index.html:11949 | 92 | = P5-6 (deferred). Candidate for L1 if the owner wants it (Q3); the acceptance criterion is identical records stored for every SAVE path in app.test.js "DI: SAVE from Edit after a field edit stores the same record as typing the composed line" and the SU tests. |
| FN-L3 | `read` | src/engine/importer.js:293 | 297 | EXCLUDED (importer). |
| FN-L4 | `compose` | src/engine/importer.js:791 | 99 | EXCLUDED (importer). |
| FN-L5 | `geometryAt` | src/engine/layout.js:346 | 84 | solver; any split must leave every built-in's geom byte-identical ("the solver seats every field of every built-in exactly where its diagram has it"). Recorded, not scheduled. |
| FN-L6 | `mediumEnumerate` | src/engine/sequence.js:742 | 98 | sequence; recorded, not scheduled. |
| FN-L7 | `boot` | tools/sandbox.js:241 | 476 | the harness's whole DOM. Recorded; a split is pure test-infra and gated by harness.test.js. Not scheduled (no behaviour at stake). |
| FN-L8 | `makeElement` | tools/sandbox.js:73 | 84 | as FN-L7. |
| FN-L9 | `launchOnce` | tests/helpers/cdp.js:678 | 90 | as FN-L7. |

### 2.3 Module-level mutable flags with more than 3 writers (app block)

Counted by `grep -c '^\s*<name>\s*=' ` plus `<name>++/--` inside the app block.

| id | flag | declared | writers |
|---|---|---|---|
| FLAG-1 | `pickMoved` | 11107 | 12 |
| FLAG-2 | `lipAcc` | 10703 | 11 |
| FLAG-3 | `pickRef` | 11104 | 8 |
| FLAG-4 | `deckId` | 9159 | 8 |
| FLAG-5 | `lipDrag` | 10887 | 7 |
| FLAG-6 | `lipDirty` | 10702 | 6 |
| FLAG-7 | `fieldsStale` | 10419 | 6 |
| FLAG-8 | `userWindowUntil` | (sheet pin block) | 5 |
| FLAG-9 | `lineStale` | 10418 | 5 |
| FLAG-10 | `gestureCancel` | 11119 | 5 |
| FLAG-11 | `flipped` | 9168 | 5 |
| FLAG-12 | `bottomHeld` | 10411 | 5 |
| FLAG-13 | `anchor` | 10410 | 5 |
| FLAG-14 | `tapSnap`, `suppressClick`, `scrollPin`, `refusal`, `panFlash`, `lipTouching`, `lipParked`, `lipGen`, `lipFling`, `inputPath`, `boxOk` | various | 4 each |

The known set (`lipSettled`/`lipDirty`/`lipFocusing`/`openRoom`) is inside
this list or below the threshold (`lipSettled` 3, `lipFocusing` 3, `openRoom`
3). The lip-state cluster (FLAG-2, -5, -6, the four-writer lip flags) is one
state machine written from pointer, wheel, keyboard, resize and transitionend
handlers; the pick cluster (FLAG-1, -3, -10) is the drawer's drag. Neither is a
mechanical refactor: every transition is pinned by SPA/SPC/UX e2e tests that
run only in CI. Recorded as structure; L1 is allowed to gather each cluster
into one object literal with the same field names ONLY if it keeps the
mutant set green (every `uxl_*`/`spa_*`/`spc_*` mutant anchors on these lines,
~60 patches by `grep -l 'lipAcc\|lipDrag\|lipDirty' tests/mutants/*.patch`),
which is why the plan marks that sub-item optional and owner-gated (Q3).

### 2.4 App code duplicating an HPE export

None beyond DUP-2 (`pc` wrapper). Checked: `labelSize`/`numSize` are taken
from `HPE.pdfcards` (CLAUDE.md "The constants are written once per language"),
`OCTAVE_RATIO` from `HPE.core.LABEL_RULE`; `routeInfo`/`shareCode` call
`HPE.share`; no second checksum, parser or formatter exists in the app block.

---

## 3. Test truthfulness

Four independent agents each audited one group in its own worktree (all left
clean). Sampling rule: every third test by file order plus every title
containing the word no / never / only / exactly. Each finding names what the
test asserts, what it should assert, whether CLAUDE.md cites the title, and
which mutant names the title.

Coverage of the audit (tests / sampled / bodies read / probes):
app.test.js 721 / 346 / 346 / 11; preview.test.js 14 / 6 / 6 / 1;
core 84 / 38 / 38 / 3; voicing 18 / 7 / 7 / 1; select 54 / 32 / 32 / 4;
layout 91 / 45 / partial / 2; share 89 / 37 / partial / 2; sequence 52 / 29 /
partial / 1; import 125 / 64 / partial / 2 (excluded path, audited for
completeness); naming 37 / 18 / partial / 3; pdfcards 37 / 20 / partial / 1;
import_gold, pdf, pdf_builtin, scale, preview: titles only;
python 263 / 114 / 114 / 30 (27 red, 3 green);
e2e.test.js 427 / 143 / 21 / 9; harness 27 / 11 / 6 / 1; mutation_harness
54 / 25 / 4 / 1; coverage_merge 18 / 13 / 2 / 1; drawer_drag/grid/seats and
seat_sweeps_*: titles only (Chrome suites, not reached).

### 3.1 Findings

Severity key: FALSE-GREEN = a probe edit that the title forbids stayed green;
PROXY = asserts source text or a module's own constant instead of behaviour;
TAUTOLOGY = cannot fail; TITLE-DRIFT = the title promises more than the body.

| id | sev | file:line | title | asserts | should assert | CLAUDE.md cites | mutant |
|---|---|---|---|---|---|---|---|
| TT-app-01 | FALSE-GREEN / PROXY | tests/app.test.js:3860 | the CTA buttons call the emitter, built-in and custom alike | source-text pins on the click handlers | click each CTA in the sandbox and assert `downloadDeckPDF` was invoked (spy); probe: `downloadDeckPDF` made a no-op stayed GREEN | no | none by title |
| TT-app-02 | FALSE-GREEN / PROXY | tests/app.test.js:8902 | editable defaults: #deck-restore follows #deck-add, starts hidden and joins the panel stops only while rendered | a regex over `panelStops` source text | call `app.get("panelStops()")` with `#deck-restore` hidden and shown and assert membership | no | none |
| TT-app-03 | FALSE-GREEN / PROXY | tests/app.test.js:10517 | AO: ABOUT is the last panel stop, a full-width button alone in the last Resources row | source pin on `panelStops` | `panelStops()` last element is `#about-open`; markup assertion for the row stays | YES (Menu Resources, About) | `ao_open_not_a_stop.patch` (killed by the source pin, i.e. for the wrong reason) |
| TT-app-04 | FALSE-GREEN / TITLE-DRIFT | tests/app.test.js:603 | generation runs once at submit, never inside deck() or render() | identity of the deck object only | a call counter on `HPE.select.build` (or the registry) across `deck()` and `render()`; probe: `deck()` returning a copy stayed GREEN | no | `d_deck_copies_registry.patch` (killed by identity, matches the body not the title) |
| TT-app-05 | TAUTOLOGY | tests/app.test.js:2117 | the layout markup exists and only the selected chip of any deck opens the sheet | "markup exists" is true by `tools/sandbox.js:281` pre-creating every `ELEMENT_IDS` element | drop the markup clause or assert against the served HTML string; keep the chip clause | no | none |
| TT-app-06 | FALSE-GREEN / PROXY | tests/app.test.js:6055 | W1 line 118: #scale-label-2 is shown with the bottom-note line… | source pin | hidden attribute of `#scale-label-2` after typing a line with and without bottoms | no | none |
| TT-app-07 | TITLE-DRIFT | tests/app.test.js:4159 | (sequence source link) …joins the Tab cycle only while visible | `rel`/href pins; the Tab-cycle clause is not asserted | `panelStops()` membership with the link hidden and shown | no | `sqe_link_no_noopener.patch` (rel pin) |
| TT-app-08 | PROXY | tests/app.test.js:3566 | print CTA panel slice | source slice pin | behavioural: the CTA's rendered attributes | no | none |
| TT-app-09 | TAUTOLOGY (weak) | tests/app.test.js:8745 | `hiddenKey(app) \|\| four` fallback | the `\|\| four` fallback makes the assertion pass when the key is absent | assert the key is present, then its value | no | `d_hide_fifth_allowed.patch` |
| TT-app-10 | PROXY (note) | tests/app.test.js:1242 | SHARE_VERSION source regex | regex over source | `app.get("SHARE_VERSION")`; keep the regex only as the "written once" pin | no | `d_share_version_literal.patch` |
| TT-app-11 | PROXY (note) | tests/app.test.js:1097 | `typeof LAYOUT_HINT === "undefined"` | absence of a global | fine as a tombstone; note only | no | none |
| TT-app-12 | TAUTOLOGY (note) | tests/app.test.js:4614 | OD8 constant | compares a constant to itself through the app | note only | no | none |
| TT-app-13 | TITLE-DRIFT | tests/preview.test.js:104 | the ding sits at the centre of the preview | any circle with `cx="0"` | the circle whose label is the ding has `cx="0" cy="0"` (or the dy the inner-note rule gives) | no | none |
| TT-py-01 | FALSE-GREEN / PROXY | tests/test_font_subset.py:81 | test_the_module_is_registered_as_an_inlined_engine_region | `"fontdata" in inline_engine.MODULES` | the served `index.html` carries the fontdata region markers with content; probe: whole region deleted from index.html stayed GREEN (only `test_validate_py_passes` catches it) | no | none |
| TT-py-02 | TITLE-DRIFT | tests/test_gen_deck.py:712 | test_the_generated_pdf_carries_the_deck_name_and_its_chords | any one chord name present | every chord name of the deck in the extracted text, on its own card | no | none |
| TT-py-03 | TITLE-DRIFT (low) | tests/test_print.py:437 | test_an_unwarned_deck_prints_no_warning_line | card 1 only | every card of the deck | no | none |
| TT-py-04 | TAUTOLOGY clause (low) | tests/test_render_agreement.py:331 | test_border_weight_grows_by_the_same_relative_amount_in_both_renderers | the ratio clause compares two test literals | read the ratio from each renderer's emitted stroke widths | no | none |
| TT-py-05 | TAUTOLOGY (low) | tests/test_pdf_parity.py:234 | test_the_sweep_actually_ran | asserts on its own SEEDS constant | assert the number of PDFs/pages produced equals `len(SEEDS)` | no | none |
| TT-py-06 | PROXY (low) | tests/test_gen_deck.py:213 | test_the_tool_never_reaches_the_network | source scan for `http`/`require("https")` | acceptable as a pin; note only | no | `c_gen_single_quoted_require.patch` |
| TT-py-07 | PROXY (low) | tests/test_print.py:862 | test_seven_rows_sit_on_the_frame | bound computed from hifi's own constants | a literal bound | no | none |
| TT-py-08 | INFO | tests/test_render_agreement.py:609 | source-text pin | — | — | no | — |
| TT-py-09 | INFO (data) | tests/test_print.py:914 | blurb-count guard | holds only because overlay literals in `data/decks.json` are STALE: Hijaz "18 CHORDS" (:2313, deck has 19), Pygmy "25" (:3242, 53), Amara "16" (:1909, 27) | deck-data territory: the print overlay blurb counts are wrong on three decks. NOT in scope (hard constraint: no deck-data change without owner instruction); raised as owner Q6. | no | none |
| TT-eng-01 | TAUTOLOGY (FALSE-GREEN confirmed) | tests/core.test.js:997 | parseLegacySeed is parseSeed | `assert.equal(core.parseLegacySeed, core.parseLegacySeed)` | either `assert.equal(core.parseLegacySeed, core.parseSeed)` (if aliasing is intended) or delete: `src/engine/core.js:350` documents `parseLegacySeed` as a separate pre-2026-10 reader, so the title is stale. Probe: export replaced by a refuse-everything stub stayed GREEN. | no | none |
| TT-eng-02 | TITLE-DRIFT | tests/select.test.js:753 | no chord name is half-present | `1 <= count <= 3` per name (the `>= 1` is vacuous over its own map) | for each multi-card name, the cards are the same pitch-class set in distinct registers and every expected alternate is present; or retitle | no | none |
| TT-eng-03 | PROXY (FALSE-GREEN confirmed) | tests/select.test.js:148 | geom carries the full solver shape, never a missing key | geom keys == `layout.GEOM_KEYS` (the module's own table) | a literal key list (as layout.test.js:138 does); probe: `rim_num_out` dropped from both the geom and `GEOM_KEYS` stayed GREEN (layout.test.js:177 caught it) | no | none |
| TT-eng-04 | PROXY (FALSE-GREEN confirmed) | tests/select.test.js:433 | names and subtitles respect the section 9 caps | caps read from `naming.CAPS` | the spec literals 16 / 41; probe `NAME_MAX = 99` stayed GREEN (naming.test.js "the subtitle cap and the 16-character name cap are hard" caught it) | no | none |
| TT-e2e-01 | PROXY (verified) | tests/e2e.test.js:4150 | every interactive control has a press state | each interactive element matches some `:active` selector with a non-empty block; `.chip:active{color:inherit}` satisfies it (probe GREEN) | computed background/colour/box-shadow differs between rest and forced `:active` (`CSS.forcePseudoState`, as "the armed delete button still answers a press, in the pressed colour" already does for one control) | no | `e_chip_no_press_state.patch` (deletes the rule; still killed) |
| TT-e2e-02 | TITLE-DRIFT (minor) | tests/harness.test.js:739 | every ANALYTICS_PATTERNS entry is a literal glob, the only shape matchesAnalytics reads | regex over the constant; `matchesAnalytics` never called | feed `matchesAnalytics` a `?`/`[` pattern and assert refusal, or drop the clause | no | none |
| TT-e2e-03 | note | tests/harness.test.js:705 | enableRealFonts sends the same block list it reports as blockedUrls | consistency of one method with itself; the behavioural half is the next test | none needed | no | none |

Notes (not findings): core.test.js:605 "NEEDS_NEWER_APP is carried but never
raised by parseSeed" is a negative over the synthetic corpus only;
pdfcards.test.js:723's title says the default floor is 3.6 pt while the body
documents `fit` landing on 3.5 (step granularity; CLAUDE.md says "never under
3.6 pt" for the blurb and `fit` has the 3.6 floor; worth a title fix in L4);
e2e "analyticsAllowed() is false in the harness and the boot sends zero
analytics requests": the second half is implied by the first (127.0.0.1), the
host block is proven in harness.test.js, title accurate.

Counts: FALSE-GREEN 9 (app-01, -02, -03, -04, -06; py-01; eng-01, -03, -04),
PROXY-only 7 (app-08, -10, -11; py-06, -07; e2e-01; py-08 info),
TAUTOLOGY 5 (app-05, -09, -12; py-04, -05; eng-01 counted under FALSE-GREEN),
TITLE-DRIFT 7 (app-04 also, app-07, app-13, py-02, py-03, eng-02, e2e-02),
INFO/data 1 (py-09). Distinct findings: 29.

CLAUDE.md citations among findings: only TT-app-03 (the "AO: ABOUT is the
last panel stop…" sentence in Menu Resources and About). Its title must NOT
change (mutant header `ao_open_not_a_stop.patch` names it); its body changes.

### 3.2 Root mechanism for the app-block proxies

`tools/sandbox.js:281` `for (const id of ELEMENT_IDS) els[id] = bindFocus(makeElement(id));`
pre-creates every known element, and `getClientRects` is stubbed, so
"exists"/"is rendered" questions are answered by the stub, which pushed the
original authors to pin source text instead. `panelStops()` is callable via
`app.get("panelStops()")` (used elsewhere in app.test.js), so TT-app-02/03/07
can be made behavioural with no harness change.

---

## 4. Mutation blind spots

Source: validate run 39803360191 at 816fe7ca (origin/main). Shard reports are
plain name lists (336/336/335/335 = 1342 run; README says 1348 — the six
`h_*` mutants patch `mutation_check.sh` itself and are run by
`tests/mutation_harness.test.js`, not the shards). Suite headers: 1235
`node --test`, 112 `python3 -m`, 1 `node tools/boot_sim.js`.

### 4.1 Mutants per target file (lowest density first)

| id | target | mutants | lines | per 100 lines |
|---|---|---|---|---|
| MUT-L1 | `src/engine/fontdata.js` | 1 | 582 | 0.17 (data table; one is right) |
| MUT-L2 | `tools/coverage_merge.js` | 1 | 523 | 0.19 (manual-only workflow; 18 unit tests, 1 mutant) |
| MUT-L3 | `data/decks.json` | 17 | 3300 | 0.52 (data; `c_deck_data_drift` + b_* cover the sync) |
| MUT-L4 | `tools/sync_decks.py` | 1 | 102 | 0.98 (the re-parse step has no mutant: a `sync_decks` that writes without re-parsing is not killed — CLAUDE.md "Data re-injection" says the re-parse is why the tool is trusted) |
| MUT-L5 | `tools/regen_engine_corpus.js` | 1 | 131 | 0.76 |
| MUT-L6 | `tools/boot_sim.js` | 1 | 40 | — |
| MUT-L7 | `tests/helpers/cdp.js` | 14 | 800 | 1.75 |
| MUT-L8 | `tools/sandbox.js` | 12 | 720 | 1.67 |
| MUT-L9 | `tests/mutation_check.sh` | 6 | 355 | 1.69 |
| MUT-L10 | `tools/decks.py` | 11 | 428 | 2.57 |
| MUT-L11 | `tests/suite_health.py` | 23 | 900 | 2.55 |
| MUT-L12 | `tools/hifi.py` | 20 | 608 | 3.29 |
| MUT-L13 | `src/engine/select.js` | 21 | 621 | 3.38 |
| MUT-L14 | `tools/probe/panel_fit.js` | 29 | 836 | 3.47 |
| MUT-L15 | `src/engine/voicing.js` | 12 | 318 | 3.77 |

For reference the dense end: importer.js 10.83 (excluded), core.js 6.34,
index.html 5.93 (805 of 1342), pdfcards.js 5.79, layout.js 5.14, share.js 4.82,
naming.js 4.89, pdfdeck.js 4.79, sequence.js 4.73. `tests/app.test.js` and
`tests/e2e.test.js` have 2 each (test-of-test mutants), `validate.yml` 2,
`ci_scope.py` 3 (excluded).

Blind-spot candidates for L6 (one mutant each, named by the hole it closes):
MUT-B1 `sync_decks` skips the re-parse (kills: a new test in
`tests/test_sync_decks.py` or existing "sync_decks re-parses what it wrote" if
present — UNRESOLVED which; L6 checks); MUT-B2 `select.js` `geom` loses a key
(kills: layout.test.js:177 today; after L4 fixes TT-eng-03, select.test.js:148
as well); MUT-B3 `naming.js NAME_MAX` 16→99 (kills: naming.test.js "…hard";
after L4, select.test.js:433); MUT-B4 `core.js parseLegacySeed` replaced by a
refusing stub (kills: after L4, the fixed TT-eng-01 or the "a version 3 link
with a bar opens with bottom notes" share test — L6 verifies which title and
writes that one); MUT-B5 `index.html` `panelStops()` drops `#about-open`
(kills: after L4, TT-app-03's behavioural body; today `ao_open_not_a_stop`
already covers the markup side, so B5 is a second patch with a different
removed line, not a replacement); MUT-B6 `tools/coverage_merge.js` CSS
`isUsed` inverted (kills: coverage_merge.test.js "css: a used range marks
exactly its rule used…", probe C in the e2e audit went RED — currently no
mutant for it).

### 4.2 Kill-reason sample (30 mutants, seed 7: 22 node-unit, 8 python)

`kill_sample.log`. All 30 killed (rc=1). 28 fail on an assertion that matches
the header title. Two do not:

| id | mutant | killed by | class |
|---|---|---|---|
| MUT-K1 | `qa_cycle_tab_stops_no_wrap.patch` | `TypeError: Cannot read properties of undefined (reading 'focus')` | CRASH KILL: the runner counts any nonzero rc as a kill (`tests/mutation_check.sh` `run_suite` → any rc ≠ 0 = killed), so the titled assertion never ran. A wrap-around that did not crash would survive. L6 re-anchors the header to an assertion that fails on a wrap (the test's own `assert.notEqual(last.next, first)` or equivalent) and adds a guard in the test so the crash becomes an assertion. |
| MUT-K2 | `d_caller_scan_blind_to_escapes.patch` | the test's own "known hole" assertion: the message reads "a unicode-escaped call site is now COUNTED. That is a real improvement… delete this assertion" | INVERTED ORACLE by design: the test asserts a known weakness and asks to be deleted when the weakness is fixed. It kills the mutant for a reason that is the opposite of the title's intent. L6 either rewrites the mutant to break the scan the other way (a call site the scan should count and no longer does) or retitles it; L4 decides whether the "known hole" assertion stays (recommended: stays, it is honest). |

Related but acceptable: `d_deck_copies_registry.patch` is killed by the
identity-only assertion (matches TT-app-04 — once L4 fixes the body the
mutant must still die; L6 verifies); `c_gen_pdf_oracle_blind.patch` is killed
by a guard ("0 != 3 : three committed PDFs") rather than by the oracle
assertion (header title names the guard, fine);
`i_pdfcards_bottom_ring_colour.patch` header "test_every_vector_matches_print -
the bottom ring strokes hifi grey", failure is the colour op diff (related,
fine). `spc_delta_short_pad.patch` is on `main` only (not on `dev`): the one
killer ≠ header mismatch in `mutants.json` is that, not a wrong-reason kill.

### 4.3 Shard-time distribution (duration proxy = gap to the next log line in the same shard; includes patch apply, node start, Chrome launch)

node unit: n=1227 median 0.5 s, sum 2694 s; python: n=110 median 0.5 s, max
23.5 s (`ds_sitemap_fragment`); e2e-suite mutants: n=309 median 2.0 s, sum
1252 s. Shard spans 13:00 / 8:09 / 14:34 / 11:53 (= P5-2 imbalance; shard 2
finishes 6.5 min before shard 3).

Top 25 by proxy: `dr1_landscape_scroll_padding` 206.3 s,
`dr1g_body_not_observed` 206.0, `dr1g_band_not_observed` 205.9 (all three
`DR1 rule G` in `tests/drawer_grid.test.js` — P5-7 confirmed: 618 s of one
shard, ~40 % of the longest shard), `e_sheet_surface_is_not_a_column` 63.5
("SAVE CHANGES is reachable without scrolling on the largest pan…"),
`ex_settle_ceiling_silent` 49.0 (harness EX-3), `di_e_passive_low_contrast`
42.0, `sn_share_icon_order_dropped_e2e` 38.9, `h_options_dropped` 34.4 ("every
option combination round-trips whole"), `dr2a_reset_seats_leaves_focus` 33.5,
`spa_msg_on_lip_bg` 33.5, `sq_medium_pure_cells_not_exact` 32.8,
`ms_sidebar_covers_strip` 30.6, `dr1g_threshold_off` 28.0,
`sq_medium_sample_colour_step_unplaced` 27.4, `dr2a_ready_drops_count_sentence`
27.0, `spb_layout_stops_omit_swatches` 26.1, `spa_restore_before_range_guard`
24.4, `spc_band_relative` 24.3, `spc_band_ignores_guidance` 24.0,
`ds_sitemap_fragment` 23.5 (python), `spa_restore_ignores_lipg` 23.2,
`e_empty_box_drops_the_pan` 22.8, `r1_print_selector_case` 20.8,
`h_probe_exit_code_ignored` 17.1, `sg_slot_margin_untrimmed` 14.9.

MUT-T1: the three DR1 rule G mutants run the whole `drawer_grid.test.js`
sweep (`# suite:` names the file, not a `--test-name-pattern`), 206 s each. A
`--test-name-pattern 'DR1 rule G'` header (with `.` wildcards per the
word-split rule) would cut each to the sweep test alone — but that IS the
sweep; the real cost is the sweep itself. L6's obligation is only to confirm
the pattern and record the number; a faster sweep is a test-design change
(P5-7, still deferred; owner Q7).

---

## 5. E2E hygiene

### 5.1 Wall time

CI's `js-tests.log` carries no per-test timings: only `tests/e2e.test.js: wall
458.3s`, `ran 453`. Per-test time is therefore unavailable from CI for the
suite run; the shard-log proxy above is per MUTANT (a single-test
`--test-name-pattern` run each), which is the only per-test number CI
produces. Top 15 e2e tests by that proxy (minus ~1.5 s of patch/launch):

| rank | mutant → test | proxy s |
|---|---|---|
| 1-3 | `dr1_landscape_scroll_padding`, `dr1g_body_not_observed`, `dr1g_band_not_observed` → `DR1 rule G …` (drawer_grid.test.js, the whole sweep) | 206 |
| 4 | `e_sheet_surface_is_not_a_column` → "SAVE CHANGES is reachable without scrolling on the largest pan…" | 63.5 |
| 5 | `ex_settle_ceiling_silent` → harness EX-3 settle ceiling | 49.0 |
| 6 | `di_e_passive_low_contrast` → "DI: the passive path's input text is at least 7:1…" | 42.0 |
| 7 | `sn_share_icon_order_dropped_e2e` → "SI: at 844x390 #share-copy sits right of the deck strip…" | 38.9 |
| 8 | `dr2a_reset_seats_leaves_focus` | 33.5 |
| 9 | `spa_msg_on_lip_bg` → "SPA: with the keyboard up and the lip shut at 390x844…" | 33.5 |
| 10 | `ms_sidebar_covers_strip` | 30.6 |
| 11 | `dr1g_threshold_off` | 28.0 |
| 12 | `dr2a_ready_drops_count_sentence` | 27.0 |
| 13 | `spb_layout_stops_omit_swatches` → "SPB: the Scale tab's Tab stops end box, primary, DELETE…" | 26.1 |
| 14 | `spa_restore_before_range_guard` | 24.4 |
| 15 | `spc_band_relative` → "SPC: at 844x390 the Layout plate band lies inside the scrollport…" | 24.3 |

E2E-1: the suite wall of 458 s over 453 tests is ~1 s/test; the long tail is
the sweeps above, not the sleeps (5.2 total 62 s of literal sleep if every
sleep ran once; several are in loops, so the real figure is higher but
bounded by the per-test numbers).

### 5.2 Sleeps that guard page timers

Histogram of `sleep(<ms>)` literals in `tests/e2e.test.js`: 26×300, 20×400,
14×100, 11×500, 10×250, 9×600, 9×350, 7×700, 5×900, 4×3000, 4×60, 3×50, 3×260,
3×25, 3×200, 3×150, 2×450, 2×40, 2×120, 1×1200, 1×800, 1×650; literal total
62 135 ms. `waitElapsed(ms, label)` (e2e.test.js:253) is used 6 times
(`DECAY_MS/2`, `DECAY_MS/2+100`, 500, 450 "the 400ms eatClick window", 250
swipeRest). The four 3000 ms are `Promise.race` timeouts around
`Emulation.setSafeAreaInsetsOverride` (14696/14719, 16579/16605) — not waits.

Page timer constants the sleeps outwait: `PIN_MS` 600 (10658), `LIP_SLIDE_MS`
180 (10701), `HOLD_MS` 250 / `GHOST_RETURN_MS` 120 / `CLICK_GUARD_MS` 400
(12295), `SWIPE_OUT_MS` 220 / `SWIPE_BACK_MS` 260 / `SWIPE_IN_MS` 180 (13075),
momentum 140-320 ms (13081).

Sleeps ≥ 600 ms that guard a page timer (the memory rule "sleep-to-waitFor
loses the timing bound" applies; convert to `waitElapsed(<page constant>,
label)` or to a `transitionend`/`settle` wait, never to a bare `waitFor`):

| id | line : ms | test | timer guarded |
|---|---|---|---|
| E2E-S1 | 16769 : 1200 | "UX: a touch flick to the end collapses once and stays collapsed" | momentum (≤320) + LIP_SLIDE_MS 180 |
| E2E-S2 | 16664, 16666 : 900 ×2 | "UX: at 844x390 with the keyboard up (tiny, the surface scrolls)…" | keyboard settle + slide |
| E2E-S3 | 16304 : 900 | "LG: a flick whose momentum carries the body collapses once…" | momentum + slide |
| E2E-S4 | 16090, 16092 : 900 ×2 | "PH: P3 at 390x797 repeated drags change the lip only at the thresholds…" | slide ×2 |
| E2E-S5 | 16245 : 800 | "LG: a real tap on each field focuses it, the pin holds it in view…" | PIN_MS 600 |
| E2E-S6 | 16646, 16202, 16112, 16132, 15716, 15764, 15795 : 700 ×7 | UX keyboard-up lip; LG 60px drag; PH P3 second finger ×2; SPC reversed-restore ×3 | slide + settle |
| E2E-S7 | 7541 : 650 | "KB: with no text field focused, a taller visible area seen earlier…" | PIN_MS 600 |
| E2E-S8 | 16660, 16631, 16640, 16529, 16535, 16490, 16309, 16269, 16223 : 600 ×9 | UX tiny; UX keyboard-up ×2; PH P4 ×2; UX restore slide; LG flick; LG selection drag; LG no-overflow drag | slide / PIN_MS |

The full per-line list (150 matches, every sleep with its enclosing test) is
in the e2e audit report and reproduced in the L5 lane brief. Dense blocks:
SPA/SPC/UX/LG/PH at 14735-16810 use raw `sleep(300..900)` to outwait the 180 ms
footslide and Chrome's momentum/transition settles.

Memory rule check: a sleep converted to `waitFor(predicate)` loses the bound
("the lip did not flip within 180 ms" becomes "the lip eventually flipped").
L5's rule: every conversion is `waitElapsed(<the page constant> + slack, label)`
or a `transitionend` listener installed BEFORE the gesture, and a differential
probe (the page constant doubled must turn the test RED) is the acceptance
check, per the EB lesson.

### 5.3 E2E tests duplicating unit tests

Title twins between `tests/e2e.test.js` and `tests/app.test.js`:
exact — "Escape closes the sheet and focus returns to the settings trigger",
"W1 line 7: pasted line breaks become single spaces", one `\\` regex artifact
title; near — the live-region/aria-hidden pair, "exactly one of the five
practice buttons is pressed…", "LG: a 60px drag from the plate…". In each case
the e2e twin asserts a real-browser fact (focus, computed style, real touch)
that the sandbox cannot (E2E-D1). Recommendation: keep both; L7 retitles the
e2e twins with a browser-specific clause so a mutant header cannot select the
wrong file — but NO test is renamed in this pass (renaming orphans mutant
headers; pass-4 rule), so the retitle is Q8 for the owner and otherwise
nothing changes.

### 5.4 The sheetbody-resize flake

Test: e2e.test.js:16419 "UX: a collapse and a restore resize .sheetbody once
each and never during the 180ms slide". Body: installs a `ResizeObserver` on
`.sheetbody`, skips the first callback, asserts count 1 after the collapse,
2 after `restoreBySwipe` + `sleep(400)`, and `ro[1] - OPENING.t >= 150`.

Root-cause evidence (E2E-F1):
- The observer's first callback is skipped as "the install callback", but
  `ResizeObserver` fires the install callback asynchronously; if the collapse
  gesture's resize lands in the SAME frame as the install, the two merge into
  one callback and the count reads 0 after the collapse (the "once" assertion
  fails with 0, not 2).
- The `>= 150` bound uses `OPENING.t` recorded by the page's own
  `performance.now()` at the restore start and the observer timestamp from the
  test's `performance.now()` in the same realm — fine — but `sleep(400)` after
  `restoreBySwipe` is 220 ms of slack over the 180 ms slide; under a loaded
  CI runner the swipe's own momentum (up to 320 ms) delays the restore start
  so the slide may not have ended at 400 ms, giving count 1 ("the restore did
  not resize") on a slow box.
- History: 08e255a (deflake fly-out via an `animate()` hook), 59d45f1/#184,
  b6cf40a, 3b70db7, ecb8137 ("swipe-deadzone mutant flaky"), d271068/ad67493
  ("intermittent's first captured signature", "undiagnosable"), c113ab0. The
  d271068 signature is the count-1-after-restore shape, matching the second
  mechanism.
- Fix shape for L5 (no behaviour change): install the observer, await one
  `requestAnimationFrame` so the install callback has fired, THEN gesture;
  replace `sleep(400)` with a `transitionend` wait on `#scale-foot` installed
  before the swipe plus `waitElapsed(LIP_SLIDE_MS)`; keep the `>= 150` bound.
  Acceptance: 20 consecutive local single-test runs green (one Chrome at a
  time), and the `uxl_*` mutants that name this title still die.
- UNRESOLVED: the first mechanism is inferred from the code shape, not
  reproduced; the lane reproduces it (a deliberate same-frame install) before
  relying on it.

### 5.5 Hotspots (last 60 commits, files touched ≥ 5 times)

tests/e2e.test.js 14, index.html 14, tests/app.test.js 10, CLAUDE.md 8,
tests/suite_health.py 5; several `uxl_*`/`spc_*` mutants 3. The DO bar
(≥5 of 60) admits only those five; every lane touching one of them is a
serialisation point (see plan).

---

## 6. GA id and the DEV/prod split (owner request: "consider using a .ENV")

### 6.1 Every value that differs between DEV and prod

`git diff origin/main origin/dev --stat` at the time of the exploration:
`_headers` (+2 lines, dev only) and `index.html` (1 line). Nothing else.

| value | prod (`main`) | DEV (`dev`) | where |
|---|---|---|---|
| GA measurement id | `const GA_MEASUREMENT_ID = "G-QTYWB2HSSV";` | `"G-XXXXXXXXXX"` | index.html:13405 |
| robots header | absent | `_headers`: `/*` / `  X-Robots-Tag: noindex` | repo root, Cloudflare Pages only |

That is the whole list. The import-row unhide of overlay commit 619201e is
gone (H0a removed `#import-row` on dev; the paste UI no longer exists). There
is no other environment-dependent value: no API base, no feature flag, no
build number.

What reads the id: `analyticsAllowed()` (13409-13414: `file:` → false;
hostname in `["localhost","127.0.0.1","[::1]"]` → false; `navigator.webdriver`
→ false; `return GA_MEASUREMENT_ID !== "G-XXXXXXXXXX"`), `loadAnalytics()`
(13416-13423: appends the gtag script with the id, queues `config` with a
hash-free `page_location`). Tests: `tests/app.test.js:9276 SHIPPED_GA_ID`,
:9277 `GA_LITERAL`, :9280 `withGaId` (9 call sites), :9381 "the shipped
measurement id is G-QTYWB2HSSV" (asserts the literal appears exactly once),
:9412 "analyticsAllowed is false for <label>…" (one test per condition, three
host names over one predicate line), 9391/9392 src and config assertions;
`tests/e2e.test.js:13611` reads `analyticsAllowed()` and `location.hostname`.
Mutants naming the area: `dg_consent_ads_granted`, `dg_consent_regional_first`,
`dg_flip_untracked`, `dg_loader_after_route`, `dg_loader_refuses_shipped_id`,
`dg_page_location_keeps_hash`, `dg_predicate_ignores_file`,
`dg_predicate_ignores_localhost`, `dg_predicate_ignores_placeholder`,
`dg_predicate_ignores_webdriver`, `dg_track_sends_custom_id`,
`dh_cdp_unblocks_ga`, `ap_privacy_drops_ga_clause`. CLAUDE.md sentences:
Hard constraints "Single-file app" bullet and line 13 (no build step); lines
690-695 (Analytics bullet, the placeholder as a disabling value and the
condition list); 730-737 ("Changing the measurement id", the four places to
edit); 813-814 (DEV URL / overlay / "Production is unaffected"); memory
`project-main-to-dev-sync-drops-overlay.md` (restore `_headers` + placeholder
on every sync branch).

### 6.2 The hard constraints that bound the options

- Single-file app: `index.html` IS the shipped artifact; GitHub Pages serves
  the committed bytes; no build step; no `<script src>` in the committed bytes
  (test "index.html carries the whole engine inline, with no external script").
- The shipped-id test pins the real id literal exactly once in `index.html`
  on `main`.
- `analyticsAllowed()` treats the placeholder as a disabling value (test and
  mutant `dg_predicate_ignores_placeholder`).
- A `.env` file is a build-time concept. Nothing in this repo runs at build
  time on Pages (GitHub Pages: none; Cloudflare Pages: the project is
  configured with no build command — "no test; true by the Cloudflare Pages
  project settings, which no file in the repo records").

### 6.3 Options

**(a) A real `.env` read by a build step on Cloudflare Pages only.**
Mechanism: `.env`/Pages environment variable `GA_MEASUREMENT_ID`; a build
command (`node tools/apply_env.js`) rewrites the literal in `index.html`
before deploy; `main`/GitHub Pages keeps the committed real id.
- Tests: STAY all (the committed file is unchanged on both branches: the
  committed id would be the REAL one on `dev` too, since the substitution
  happens at deploy). FLIP none. GO none. But NEW: a test for the apply tool.
- CLAUDE.md: Hard constraints "no build step" becomes "no build step for the
  committed artifact; Cloudflare Pages runs one substitution"; 813-814 rewrite;
  730-737 gains the env variable as a fifth place.
- Overlay branch: the GA hunk disappears from the overlay; `_headers` stays an
  overlay file (or ALSO moves to a Pages setting: Cloudflare can send headers
  from the dashboard, which would empty the overlay entirely — but then the
  noindex lives in a dashboard nobody can audit from the repo). The sync
  restore step shrinks to `_headers` or vanishes.
- Risk to prod: LOW for GitHub Pages (untouched); MEDIUM for the model — the
  repo would now contain a tool that rewrites `index.html` outside the sync
  tools, which is exactly the "generated output that is not checked in" the
  single-file constraint forbids, and DEV would serve bytes that are not in
  any commit. A tester reading DEV's source could not match it to a SHA.
- Verdict: contradicts the constraint's spirit ("nothing between the repo and
  the browser") for DEV, and adds infrastructure for one line. Not
  recommended.

**(b) Runtime selection by `location.hostname` inside `index.html`.**
Mechanism: add the DEV host to the predicate:
`if (["localhost","127.0.0.1","[::1]","handpan-cards-dev.pages.dev"].includes(location.hostname)) return false;`
(or a `DEV_HOSTS` constant beside `GA_MEASUREMENT_ID`). `index.html` is then
byte-identical on `main` and `dev`; the real id ships on both; DEV sends no
analytics because the host is denied, and `*.pages.dev` preview URLs could be
covered by `location.hostname.endsWith(".pages.dev")` (owner Q10 picks exact
host vs suffix).
- Tests: STAY — "the shipped measurement id is G-QTYWB2HSSV" (still exactly
  once), all nine `withGaId` users, the four predicate tests, the loader
  tests, e2e 13611 (harness host 127.0.0.1 is unchanged). FLIP none. GO none.
  NEW: one predicate test "analyticsAllowed is false for the DEV host" in the
  same per-condition loop (label `handpan-cards-dev.pages.dev`), one mutant
  `dg_predicate_ignores_dev_host.patch` (removes the host from the list;
  kills: that test), and the e2e "a full boot sends zero requests…" gains
  nothing (already host-blocked). On `dev` itself the 28 GA tests that fail
  today against the placeholder (observed on the dev worktree) go GREEN,
  because the two trees no longer differ there.
- CLAUDE.md: 690-695 adds the DEV host to the false-conditions list; 730-737
  unchanged in substance (still four places); 813-814 rewrite: "the overlay is
  `_headers` alone; `index.html` is identical on `dev` and `main`"; memory
  `project-main-to-dev-sync-drops-overlay.md` shrinks to `_headers`.
- Overlay branch: shrinks to the single `_headers` file; the sync restore
  step keeps only `_headers` (it does NOT disappear — Q9 asks whether
  `_headers` should ALSO move, see (b′)).
- Risk to prod: LOW. The real id and the predicate's other conditions are
  untouched; the only new behaviour is one more host string returning false,
  pinned by its own test and mutant. The one failure mode — a DEV host
  rename silently re-enabling GA on DEV — is a leak of DEV traffic INTO the
  real property, not a prod outage; the suffix form (`.pages.dev`) closes it.
- (b′) `_headers` too: Cloudflare Pages reads `_headers` only from the deploy;
  there is no runtime equivalent for a response header in a static file, so
  `_headers` cannot be selected at runtime. It can only (i) stay the one
  overlay file, (ii) live on `main` too (then PROD on Cloudflare — there is
  none; GitHub Pages ignores `_headers`, so committing it to `main` is
  harmless and empties the overlay completely: `tests/test_site_files.py`
  would need one new assertion that `_headers` carries exactly the noindex
  line, and `robots.txt`/sitemap tests are unaffected because GitHub Pages
  serves prod), or (iii) move to the Cloudflare dashboard. Option (ii) is the
  one that makes `dev` == `main` byte-for-byte and retires the overlay branch
  and the restore step entirely; its cost is a file on `main` that prod never
  serves. Owner Q9.

**(c) A sibling config file (`config.js` / `env.json`) loaded by `index.html`.**
Mechanism: `<script src="env.js">` or a `fetch("env.json")` at boot; DEV and
prod deploy different siblings.
- Violates the hard constraint directly: "exactly one external script, GA4
  gtag.js … nothing else external" and "no `<script src>` appears in the
  committed bytes" (test "index.html carries the whole engine inline, with no
  external script" FLIPS to red). A `fetch` variant keeps the test green but
  makes the GA decision asynchronous (config must be queued before any event:
  "config is queued before any event on a boot with a share link" would need a
  rewrite) and breaks `file:` boots (fetch of a sibling from `file:` is
  blocked in Chrome), which the app must survive ("the file still opens from
  disk").
- Tests: FLIP 1 (no-external-script) in the script form; in the fetch form
  FLIP the config-ordering tests and `analyticsAllowed` becomes async (every
  predicate test changes shape). GO none.
- Not viable under the constraints; listed because the owner asked for the
  comparison. Rejected.

**(d) Status quo: the overlay branch.**
- Tests: STAY. CLAUDE.md: unchanged. Overlay and restore step: remain, with
  the known cost (memory file: the main-to-dev sync must re-apply two hunks
  every time; a forgotten restore ships the real id to DEV, which pollutes the
  real GA property with test traffic — the precise failure (b) removes).
- Risk to prod: none directly; the risk is to GA data quality and to the
  sync discipline (28 red tests on `dev` whenever anyone runs app.test.js
  there, which trains people to ignore red).

### 6.4 Recommendation

(b), with the exact-host list first and the suffix form offered as Q10, plus
(b′ ii) — commit `_headers` to `main` — as a separate owner decision (Q9). (b)
alone makes `index.html` identical on the two branches, removes one of the
two overlay hunks and all 28 dev-only red tests, costs one line of predicate,
one test and one mutant, and changes no prod behaviour. It satisfies every
sentence of the single-file constraint. It is a candidate lane L8 in the
plan, serialised after L1 because both edit the app block.

What (b) does NOT do: it does not stop a DEV deploy from being indexed
(`_headers` still needed) and it does not make the id a secret (it never was:
the id is in every served page).

---

## 7. Index of ids by lane (for plan.md)

L1 (app block + CSS): CSS-D1, CSS-D2, CSS-D3; optional FN-L2 / FLAG clusters (Q3).
L2 (engine): DUP-1; optional (none else).
L3 (python tools / sandbox): FN-4, FN-5 (Q4), MUT-L4's re-parse hole test.
L4 (unit truthfulness): TT-app-01..13, TT-eng-01..04, TT-py-01..08 (py-09 is Q6).
L5 (e2e truthfulness + speed): TT-e2e-01, -02; E2E-S1..S8; E2E-F1; DUP-5.
L6 (mutants + README/FLOORS): MUT-B1..B6, MUT-K1, MUT-K2, MUT-T1 record.
L7 (docs): P5-12 (CONTRACT rule 4 index line + "six PDFs"), the CLAUDE.md
sentences each lane changes, pdfcards.test.js:723 title note.
L8 (GA host predicate): section 6 option (b) (+ b′ on Q9).
