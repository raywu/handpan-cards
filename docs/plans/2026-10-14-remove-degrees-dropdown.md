# Plan: remove the DEGREES dropdown, infer the parent always

Planned against `main` b6d8bee (branch base; the branch adds only the prompt file `docs/plans/2026-10-14-remove-degrees-dropdown-prompt.md`) [stale: the plan, reviews and ledger followed in the same PR #305]. Owner request, 2026-10-13, verbatim:

> "Why can we not infer the mode from every scale? I don't think the user will want to override the mode for different labels. Let's remove degrees dropdown unless there's a strong use case someone would want different modes for labels."

Then "Afk". AFK auto-pick D1 (memory `queued-remove-degrees-dropdown`): no strong use case found. The clearest case where the override changes a label is a tie between two parents on a pan missing the separating step (eng review E1 corrects the earlier "only case": the index is unrestricted, so any explicit index re-cases the labels, and a stored index can be non-inferred without anyone touching DEGREES, see R-7); verified at this SHA through `tools/engine_loader.js`: `(D3) A3 C4 D4 E4 F4 G4 A4 C5` infers Aeolian (index 1, labels `i ii° III iv v VII`, auto name `D AEOLIAN 9`) and an explicit Dorian (index 2) gives `i ii III IV v VII` and `D DORIAN 9`. The owner confirmed on 2026-10-14 ("Start it").

**VERDICT: SMALL.** Recommended design: delete the row, the select, its builder, its listener, its Tab stop, its `sheetKey()` member, its three CSS rules and `seedParent()` from the app block of `index.html`; `sheetOptions()` stops writing `o.parent`, so `select.build` infers on SAVE exactly as it does on create; `ELEMENT_IDS` drops the two ids; tests and mutants re-pointed or replaced, count up by one; docs marked. No engine, share-format, data, fixture or `#settings-panel` change.

## A. What exists at b6d8bee (every item verified by grep)

**Markup.** `#scale-degrees-row` (`.editrow`, `hidden`) holding `<label for="scale-degrees">DEGREES</label>` and `<select id="scale-degrees">`, under the comment "D10: the parent-scale override. Edit path only - the create path infers.", after the `#scale-layout-zone` block and before the swatches comment. The Edit-only rows are three: `#scale-name-row`, `#scale-degrees-row`, `#scale-delete-row`, shown and hidden by `setSheetMode(edit)`'s loop `for (const el of [nameRow, degRow, delRow])`.

**CSS naming `#scale-degrees` - exactly three rules.** (1) inside `@media (max-height:520px)`: `#scale-box, #scale-name, #scale-degrees{min-height:44px; padding:9px var(--sp-3)}`; (2) `#scale-name, #scale-degrees{width:100%; min-height:48px; ...}`; (3) `#scale-degrees{font:400 16px/1.2 "Nunito Sans"}`. **Correction to the prompt:** there is no `:focus-within` rule and no rule that goes static "for the name and the degrees" by id. The band rule is `.sheetbody:has(input:focus, textarea:focus, select:focus, #scale-swatches button:focus) #scale-layout-zone.open #scale-plate-band{position:static}`; it names `select:focus` generically, not `#scale-degrees`, and no test reads the selector text. See R-4.

**App JS.** `const degRow = document.getElementById("scale-degrees-row")`, `const degSel = document.getElementById("scale-degrees")`; `buildDegrees(selected)` (fills from `HPE.naming.PARENTS`); `seedParent(fields)` (one caller: `openEditSheet()`'s `if (edit) buildDegrees(seeded() ? seedParent(edit.fields) : edit.options.parent)`); `sheetKey()` = `JSON.stringify([scaleBox.value, nameBox.value, palette, mirror, bottomMirror(), anchor, degSel.value, seatsKey(layoutSeats)])`, read at Edit open (`seedPrefill = sheetKey()`) and at SAVE (`if (seeded() && sheetKey() === seedPrefill) { closeScaleSheet(); return; }`); `sheetOptions()` sets `o.parent = Number(degSel.value)` inside `if (editingId)`; `degSel.addEventListener("change", () => resyncSheet(true))`; the sheet Tab trap's stop list carries `editingId ? degSel : null` between `resetBtn` and `...swatches.children`, filtered by `isStop` (`!!el && !el.disabled && el.getClientRects().length > 0`).

**Engine (untouched).** `select.build(seed)`: `parentIndex = (seedOptions.parent === undefined || seedOptions.parent === null) ? naming().inferParent(panPcs, tonicPc) : seedOptions.parent`, and `options.parent` on the built deck is that resolved index (so every record the app has ever stored, and every link it has ever minted, carries an explicit index - the inferred one unless the dropdown changed it). `core.parseSeed` rejects a parent that is not an integer 0-10 with `BAD_NOTE` (`tests/core.test.js` "R4-E options that are not a plain value of the right kind are BAD_NOTE, in both parsers"). `src/engine/share.js` encodes `parent` as `""` when null and decodes `""` to `null` (`tests/share.test.js` "parent survives the round trip on its own, null included", which runs `{ parent: null }, { parent: 0 }, { parent: 7 }, { parent: 10 }`) [correction: the test loops [null, 0, 1, 5, 9, 10]]. `tests/select.test.js` "options report palette, mirror and the RESOLVED parent index" asserts both the inferred and the explicit path.

**Storage and links.** `scaleRecord(seed)` writes `{v: SHARE_VERSION, s: formatSeed(fields), o: seed.options}`; `rememberScale` / `replaceScale` write it; `shareLink` encodes `seed.options`. The deck id hashes the fields only (D14; "a share link restores the exact deck, and options never move the id").

**Sandbox.** `tools/sandbox.js` `ELEMENT_IDS` lists `"scale-degrees-row", "scale-degrees"` on the "Phase 4 Edit state" line. `tests/app.test.js` "SB-2 every served id is in the markup and is looked up by the app" fails for an id that is served but absent from the markup OR never looked up by `getElementById`; mutant `r3s_served_id_not_in_markup` kills it.

**Fixtures.** `app_surface_v1.json`, `pan_render_v1.json`, `card_face_v1.json`, `deck_ids_v1.json`, `engine_corpus_v1.json`: zero matches for `scale-degrees`, `buildDegrees`, `seedParent`. No digest moves.

**Not involved.** `b_degree_missing` is a DATA mutant (`diff --git a/data/decks.json`, kills `test_degrees_cover_chord_roots`). `r4e_naming_degrees_parent_unnamed` is an ENGINE mutant (`src/engine/naming.js`, kills `tests/naming.test.js` "R4-E degrees names the parent index it was given when there is no such parent"). Neither is touched. `#settings-panel`, `panelStops()`, `panel-fit`, `data/decks.json`, `const DECKS`, `tools/` print, `docs/ENGINE-SPEC.md`'s encoding rules.

## B. Decision ledger (AFK auto-picks marked)

| id | question | options | recommended / AFK pick |
|---|---|---|---|
| R-1 | a custom record stored with a non-inferred `options.parent` is opened in Edit and saved again | (a) SAVE always re-infers: `sheetOptions()` writes no parent, the stored index is dropped at that save and the degree labels (and the auto name, when the box is untouched and the record has no explicit `options.name`) may change at that save. (b) SAVE preserves the stored index unless the fields changed: `sheetOptions()` copies `editedDeck().options.parent` through when `formatSeed` of the parsed box equals the stored `s`; no label ever changes without a field edit, at the cost of an invisible option the UI can neither see nor clear, and of a second `sheetOptions()` branch to test | **(a)** (AFK pick): it is the owner's words, "infer parent always", and (b) keeps alive the one thing the owner said nobody wants. Displayed records and links are unaffected either way (requirement 3) |
| R-2 | `seedParent()` | remove with the dropdown / keep | **remove** (AFK pick): its one caller is the `buildDegrees` call in `openEditSheet()`; no test, fixture or mutant names it (`app_surface_v1` has no entry) |
| R-3 | share links and stored records carrying an explicit index | keep decoding and displaying with that index / strip on load | **keep** (AFK pick; scope corrected by eng review E4): the format and the engine are untouched. The sheet's producers of a non-inferred index are gone, but a share link is one too: `openShare()` generates with the decoded options and `rememberScale`s the result, replacing the record of the same id. Opening an old Dorian link after an inferred SAVE stores Dorian again (RD-T4 pins it). So the field decays only on records nobody re-opens from a link; the claim is scoped to SHEET saves everywhere it appears, and whether links should infer too is a TODOS row for the owner (E4). Already asserted: `tests/share.test.js` "parent survives the round trip on its own, null included" and "encode's checksum is pinned against a captured payload with every option set (Q18)" (parent 3); `tests/app.test.js` "rule N: a moved deck's stored record and share link are the strings main wrote" (stored `o.parent: 1`, fixed link string) and "DR1 rule S ..." (boots Edit from a stored record with `parent: 1`) |
| R-4 | the `select:focus` term of the band's `:has()` rule, dead once the sheet has no `<select>` (`#print-paper-select` is outside `.sheetbody`) | leave / drop the term | **leave** (AFK pick): it names no id, nothing reads it, and the prompt's removal list is rules that NAME `#scale-degrees`. Dropping it is a one-token nit for a later pass (TODOS row, design review D11) |
| R-5 | titles of the two tests whose subject is the dropdown itself | retitle in place / replace with new tests | **replace** (AFK pick): "the Degrees select lists the parent candidates with the inferred one preselected" and "LF F-5: changing the degree select re-parses the seed with the new parent" have no purpose left; each is replaced by a named test below and its mutant by a named mutant, same commit. Every other touched test keeps its title (seeded-save-delete amendment: retitles allowed, deletions never without a replacement) |
| R-6 | the inferred parent is no longer visible anywhere on the sheet: the select was the only surface that named the mode ("AEOLIAN"); the parse line reports field counts only | surface it in the parse line or the name placeholder / leave it to the card header and the auto name | **leave** (design review D5, AFK pick): the card header's degree labels and the auto deck name are the only places the parent appears; adding a line is a copy change (non-goal) for a value the owner said nobody wants to steer. Written down so it is not rediscovered as a bug |
| R-7 | a record stored under an override is relabelled at its next SAVE (R-1a) with no in-app announcement | (a) silent by design: the first SAVE is the migration; the only signal that exists, the post-save toast `Updated <name>`, is pinned by RD-T1 (it reveals the change only on an auto-named record). (b) a one-shot notice in `#scale-guidance` before SAVE ("Saving will relabel the degrees from Dorian to Aeolian") with its own clearing and stacking rules, test and mutant | **(a)** (design review D5, AFK pick; population corrected by eng review E1): the affected population is every record whose stored index differs from the one its fields infer. Two producers exist at b6d8bee, both gone with the row: a deliberate pick in DEGREES (on any pan, not only a tie: `caseFromParent` takes the case from whatever parent is chosen, so a C-major pan saved under Aeolian reads `i`), and an ordinary field edit, because `openEditSheet` preselects the STORED index and `sheetOptions()` re-sends it, so a record whose notes were edited after creation carries the index inferred for its OLD pitch set. RD-T1's fixture (`parent: 2` on an Aeolian pan) stands for both origins, since storage does not record which; (b) is a copy change (non-goal), a new guidance state beside the sheet-guidance rules just merged, and a notice about a control that no longer exists. The card header `.deg` labels show the result at once |

## C. Behaviour after the change

- **Create path:** unchanged. `sheetOptions()` never set `o.parent` outside `if (editingId)`.
- **Edit of a custom deck:** the sheet shows name and delete rows only; SAVE (always regenerates, "saving from the Edit sheet regenerates exactly once (13A)") writes `options.parent` = the inferred index. A record saved under an override takes the inferred labels at that save (R-1a); its explicit `options.name`, if any, is kept (`sheetOptions()`'s `kept` rule; "a user-typed name equal to the auto label survives a later field edit"); an auto-named record is renamed by `select.autoName(fields, inferred)` ("a field edit keeps the edited deck selected and renames its chip from the new fields" is the existing proof that an untouched box yields the auto name).
- **Edit of a seeded deck:** `seedParent(edit.fields)` preselected the inferred index, so SAVE wrote the index the engine infers anyway; the replacement records of "editable defaults: saving each seeded deck with a palette change mints the fixture id as its replacement in the seeded slot" are byte-identical before and after. `sheetKey()` loses `degSel.value`; nothing else on the sheet can set the parent, so a changed sheet cannot read as unchanged; "SD: saving a seeded deck unchanged closes the sheet and writes nothing" stays green (mutant `d_unchanged_save_writes_record`).
- **Display of stored records and links with an explicit index:** unchanged (R-3). The deck id never depends on options (D14).
- **Keyboard:** the Edit Tab order with the drawer CLOSED is BACK, name, box, ADJUST LAYOUT (`#scale-layout-toggle`, always a stop), swatches, SAVE CHANGES, DELETE; with the drawer OPEN the plate and the drawer controls sit between the box and the swatches in the order "DR3 Tab order on Add and Edit, finer controls closed and open" (`tests/app.test.js`) asserts, unchanged. The stop list loses exactly one entry (`editingId ? degSel : null`, between `resetBtn` and the swatches); forward and Shift+Tab traversal are both asserted with both wrap-around endpoints (design review D6; the first draft's "box, swatches" omitted the toggle; eng review E2 fixed the setup helper and the swatch identity). `degRow`, `degSel`, the listener and the stop go in the same change: a dangling `const degSel = document.getElementById(...)` would be `null` and `degSel.addEventListener` would throw at boot (the sandbox stubs only `ELEMENT_IDS`, and SB-2 fails an id that is served but never looked up).
- **Layout:** the whole labelled group leaves `.sheetbody`'s scroll on Edit: the `.editrow` (its DEGREES label, its `--sp-1` internal gap and the 48px select, 44px in the landscape block) and one `--sp-3` inter-group gap (`--sp-2` in the landscape block), both supplied by `.sheetbody`'s flex `gap`, so no spacer or margin rule is left behind. After the change the swatches `.ctlrow` is the next element sibling of `#scale-layout-zone` inside `.sheetbody` at the standard group gap; preview sizing, input sizes and the footer hierarchy are untouched (design review D8). No pinned row changes, so the footer, the `#scale-guidance` reserve and the keyboard budget measured in `docs/plans/2026-10-13-sheet-guidance.md` D are unchanged; the Edit page scrolls less. Not re-measured (risk register).

## D. Test and mutant inventory (verified at b6d8bee; titles, ids and functions only)

| existing test | file | what it does today | after |
|---|---|---|---|
| "the Degrees select lists the parent candidates with the inferred one preselected" | app.test.js | reads `#scale-degrees` options, sets another index, asserts `options.parent` and relabelled degrees | REPLACED by RD-T1 (R-5) |
| "LF F-5: changing the degree select re-parses the seed with the new parent" | app.test.js | dispatches `change` on `#scale-degrees`, spies `parseSeed` opts | REPLACED by RD-T2 (R-5) |
| "changing only an option keeps the deck id and moves the share URL" | app.test.js | sets palette, mirror, `#scale-degrees`, name; asserts id kept, URL moved | keeps title; the `#scale-degrees` line goes; palette, mirror and name still move the URL (no mutant names it) |
| `editRowsShown` helper; "tapping the already-selected custom chip opens the sheet in Edit state, prefilled"; "+ ADD after an Edit opens a clean create sheet, never the edited deck's seed" | app.test.js | three rows `[true,true,true]` / `[false,false,false]` | helper lists `scale-name-row`, `scale-delete-row`; expectations become two-element; titles kept (`d_edit_not_prefilled`, `d_add_keeps_edit_seed` still die) |
| "editable defaults: saving each seeded deck with a palette change mints the fixture id as its replacement in the seeded slot" | app.test.js | asserts `scale-degrees-row` un-hidden per deck | that assertion goes; title kept (`d_fork_not_prefilled`, `d_seeded_sheet_keeps_fork_copy` still die) |
| "the sheet's text inputs stay at 16px in every rule that sets their size, media blocks included" | app.test.js | iterates `#scale-box`, `#scale-name`, `#scale-degrees`; `assert.ok(hits.length)` would FAIL once no rule names `#scale-degrees` | the list drops `#scale-degrees`; title kept; its comment paragraph about the select corrected (`f6_scale_box_font_override`, `f6_scale_box_media_override` target `#scale-box` and still die) |
| "a field edit keeps the edited deck selected and renames its chip from the new fields"; "a user-typed name equal to the auto label survives a later field edit" | app.test.js | read `options.parent` only to call `HPE.select.autoName` | UNAFFECTED: `options.parent` is still the resolved index on every built deck |
| "SB-2 every served id is in the markup and is looked up by the app" | app.test.js | every `ELEMENT_IDS` entry in markup and looked up | green once markup, lookups and `ELEMENT_IDS` drop the two ids together; red if any one lags |
| "SG: N-A3 no served id is removed and the wrapper is markup-only" | app.test.js | names eight ids that must stay served | UNAFFECTED (names neither degrees id); it is the model for RD-T2's assertion style |
| "DR1 line 86: on Edit the band goes static for the name and the degrees, and not for a drawer control" | e2e.test.js | focuses `scale-name` and `scale-degrees` | RETITLED "DR1 line 86: on Edit the band goes static for the name, and not for a drawer control"; the loop keeps `scale-name` only (no mutant names it) |
| "the selected custom chip reopens the sheet in Edit state, prefilled, at 380px" | e2e.test.js | `rows` over three ids, `degrees: ...options.length` asserted 11 | `rows` over two ids, `[true, true]`; the `degrees` read and its assertion go; title kept (`e_edit_delete_full_width` still dies) |
| "Tab is trapped inside the Edit sheet and reaches every Edit control" | e2e.test.js | expects `scale-degrees` among the stops | expected set drops `scale-degrees`; title kept; `e_edit_tab_skips_delete` (edits the stop-list lines that include `editingId ? degSel : null`) is RE-ANCHORED and still dies |
| "DR3 Tab order on Add and Edit, finer controls closed and open" | app.test.js (sandbox; the first draft said e2e.test.js) | does not name `scale-degrees`; asserts the drawer-OPEN order name, box, plate, toggle, anchors, mirrors, fine, steps, reset, forward and Shift+Tab | UNAFFECTED by assertion; its mutants are context-stale (below) |

**New tests (lane app).**
- **RD-T1** (app.test.js) "RD: a record stored with a non-inferred parent is displayed with it and re-saved from Edit with the inferred one" - boot with storage `[{ v: 4, s: "(D3) A3 C4 D4 E4 F4 G4 A4 C5", o: { palette: 0, parent: 2 } }]`; before any edit `registry()[id].options.parent === 2` and `degrees["7"] === "IV"` (requirement 3, R-3); `openEdit`, click `#scale-generate`; after: `options.parent === 1`, `degrees["7"] === "iv"`, `records(app)[0].o.parent === 1`, id unchanged, and the post-save message reads `Updated D AEOLIAN 9` (the auto name followed the inferred parent; the one signal R-7 relies on). A second case in the same test: the same record with `o.name: "RAY'S PAN"`, opened in Edit and saved with nothing touched (the options-only edit: id unchanged, replaced in place): `options.parent === 1`, `degrees["7"] === "iv"`, `options.name === "RAY'S PAN"`, message `Updated RAY'S PAN`. Under R-1(b) this test's second half would instead assert `=== 2`; the lane implements (a).
- **RD-T2** (app.test.js) "RD: no DEGREES row - the served markup, ELEMENT_IDS and the app script carry neither scale-degrees id, and sheetOptions writes no parent on Edit" - over the served `index.html` string: no `id="scale-degrees-row"`, no `id="scale-degrees"`, no `for="scale-degrees"`, no `getElementById("scale-degrees` in the app script after `const DECKS` (a prefix match by design: a future `scale-degrees-*` id would also trip it, say so in the test comment), no `#scale-degrees` in any CSS selector; in `.sheetbody`'s markup the element after `#scale-layout-zone` (comments and whitespace skipped) is the `.ctlrow` holding `#scale-swatches`, and no `.editrow` other than `#scale-name-row` remains; `require("../tools/sandbox.js").ELEMENT_IDS` includes neither id; `boot()` then `openEdit(makeCustom(app))`: `editRowsShown(app)` is `[true, true]`, and a `parseSeed` spy that COLLECTS every options-bearing call (`if (opts !== undefined) globalThis.__parents.push(opts.parent)`; eng review E3: the LF F-5 last-call pattern is overwritten by `rememberScale` -> `sameDeck` -> `recordDeckId`, which calls `parseSeed(r.s)` with no options after generation, so a last-call assertion passes vacuously) is reset before each step and asserts, after `resyncSheet(true)` and again after the `#scale-generate` click, that at least one call was collected and every collected `parent` is `undefined`.
- **RD-T4** (app.test.js, eng review E4) "RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included" - boot with the RD-T1 record (`parent: 2`), `openEdit`, click `#scale-generate` (record now `parent: 1`, `degrees["7"] === "iv"`); then `openShare(<link>)` where `<link>` is `shareLink` of the same fields with `options.parent: 2` (the exact string is captured in the test the way "rule N: a moved deck's stored record and share link are the strings main wrote" captures its link); after: `records(app)` still has one record for that id, `o.parent === 2`, `registry()[id].degrees["7"] === "IV"`. The test documents R-3 as a decision; its mutant is `rd_share_strips_parent` (`openShare` deletes `res.value.options.parent` before generating; `# kills:` RD-T4).
- **RD-T3** (e2e.test.js, single test, runs locally with `--test-name-pattern`) "RD: the Edit page's Tab order is BACK, name, box, ADJUST LAYOUT, swatches, SAVE CHANGES, DELETE with the drawer closed, forward and back, and no stop is a select" - from `editFreshDeck()` (drawer CLOSED; it sets 380x840) followed by an explicit `b.setViewport(380, 800, true)` (eng review E2: `editFreshDeckOpen()` opens the drawer, so it cannot be the setup): each stop is identified by its id, or by its `aria-label` for the swatches, which have no ids (`Palette 1` .. `Palette N`, N = `HPE.select.PALETTES.length`). One forward cycle of N+6 Tabs from `#scale-back` visits `scale-name, scale-box, scale-layout-toggle, Palette 1 .. Palette N, scale-generate, scale-delete, scale-back`; one Shift+Tab cycle of N+6 from `#scale-delete` visits `scale-generate, Palette N .. Palette 1, scale-layout-toggle, scale-box, scale-name, scale-back, scale-delete` (both endpoints written out: `cycleTabStops` wraps at either end); and `document.querySelector("#scale-sheet select") === null`. The drawer-open order is DR3's (sandbox) and is not repeated here.

**Mutants.** Count 939 at b6d8bee (README states 939). Two are defeated, four are added (eng review E4 added `rd_share_strips_parent`): count 941, never lower.

| mutant | today | after |
|---|---|---|
| `d_degrees_ignored` (removes `o.parent = Number(degSel.value)`; kills the Degrees-select test) | defeated: the removed line is gone and its test is replaced | REPLACED by `rd_save_keeps_stored_parent`: `sheetOptions()` gains `if (editingId) { const d = editedDeck(); if (d && d.options && d.options.parent != null) o.parent = d.options.parent; }` (R-1b in code); `# kills: RD: a record stored with a non-inferred parent is displayed with it and re-saved from Edit with the inferred one` |
| `r4f_degsel_change_unwired` (removes the `degSel` change listener; kills LF F-5) | defeated: the line and the test are gone | REPLACED by `rd_element_ids_serve_degrees`: `tools/sandbox.js` re-adds `"scale-degrees-row", "scale-degrees"` to `ELEMENT_IDS`; `# kills: RD: no DEGREES row - ...` (SB-2 would also kill it; the header names RD-T2) |
| - | - | ADDED `rd_share_strips_parent`: `openShare()` gains `delete res.value.options.parent;` before `generateDeck`; `# kills: RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included` |
| - | - | ADDED `rd_degrees_row_restored`: the `#scale-degrees-row` markup (label and select) put back without script or CSS; `# kills: RD: no DEGREES row - ...` |
| `e_edit_tab_skips_delete` | edits the stop list around `editingId ? degSel : null` | RE-ANCHORED on the new stop list; same defect, same `# kills:` |
| context-stale candidates (grep for `scale-degrees`, `degSel`, `buildDegrees`, `seedParent` in patch CONTEXT lines, none in their +/- lines): `dr3_tab_list_omits_disclosure`, `dr3_hidden_buttons_reachable_by_tab`, `d_mirror_ignored`, `sg_msg_left_in_the_scroll`, `e_sheet_ctlrow_pinned_again`, `dr1_anchor_not_reaching_deck`, `w1_enter_while_composing_generates`, `s3_mirror_bottom_not_carried`, `f6_scale_box_font_override`, `f6_scale_box_media_override`, `r3s_served_id_not_in_markup` | apply | each that `python3 tools/refresh_mutants.py --check` reports red at the lane head is re-anchored (ownership-by-outcome, R7 of editable-defaults); a patch `refresh_mutants.py` cannot re-anchor is rewritten against a stabler anchor (memory: hand-regenerated mutants drift). `tests/mutation_check.sh` prints a non-applying patch as `<name> stale (does not apply)` and appends it to `SURVIVORS`, so a stale patch fails the gate exactly as a survivor does - the prompt's "failure, not a survivor" is the same outcome under the harness's survivor label |
| `b_degree_missing`, `r4e_naming_degrees_parent_unnamed` | data / engine | NOT involved |

FLOORS (`tests/suite_health.py`: `app.test.js` 501, `e2e.test.js` 297) and the README count move only to CI's figures for the branch (memory: FLOORS rows lag the CI count); `test_readme_currency` accepts 939 against 941 (90% band), so the README edit is optional and, if made, comes from CI's artifact.

## E. Docs: the SUPERSEDED marks (lane docs; exact sentences)

House style: the mark goes in the description text, in place, "SUPERSEDED <date> (this plan)"; nothing is rewritten or deleted (sheet-guidance close-out nit Q5).

| file | sentence at b6d8bee | mark to append, verbatim |
|---|---|---|
| `docs/SCALE_ENGINE_PLAN.md` row D10, verification column | "Custom scales: the engine infers the nearest 7-note mode and the scale form exposes a parent-scale picker to override it; the share URL carries the chosen parent; scales with no usable parent use uppercase." | " SUPERSEDED 2026-10-14 (this plan): the picker is removed and the app writes no parent; `options.parent` on every deck saved from the sheet is the inferred index (test \"RD: a record stored with a non-inferred parent is displayed with it and re-saved from Edit with the inferred one\"); the share URL still carries the index it was minted with." |
| `docs/SCALE_ENGINE_PLAN.md` row D13, verification column | "the parent-scale override (D10) lives in the Edit sheet, never on the create path." | " SUPERSEDED 2026-10-14 (this plan): the Edit sheet has no override either (test \"RD: no DEGREES row - the served markup, ELEMENT_IDS and the app script carry neither scale-degrees id, and sheetOptions writes no parent on Edit\")." |
| `docs/SCALE_ENGINE_PLAN.md`, design-review 7A "One Edit sheet" paragraph | "a native `<select>` labelled \"DEGREES\" listing the P0a parent candidates with the inferred one preselected (the D10 override, encoded as the parent index in the seed)," | insert after the closing parenthesis: " [SUPERSEDED 2026-10-14 (this plan): no DEGREES select; the parent is inferred on SAVE as on create]" |
| same paragraph, eng-review 3A test list | "changing the Degrees select relabels the degrees and the share URL carries the new parent index while the id is unchanged;" | append " [SUPERSEDED 2026-10-14 (this plan): test replaced by RD-T1 and RD-T2, mutants `d_degrees_ignored` -> `rd_save_keeps_stored_parent`, `r4f_degsel_change_unwired` -> `rd_element_ids_serve_degrees`]" |
| `docs/SCALE_ENGINE_PLAN.md` ledger row 3A (Tests, "11 delta gaps added with mutants: ... Degrees override, delete") | the description cell | append " SUPERSEDED 2026-10-14 (this plan) for \"Degrees override\" only: replaced by RD-T1/RD-T2." |
| `docs/SCALE_ENGINE_PLAN.md` ledger row 7A ("One Edit sheet on the selected custom chip: name, degrees select, delete link (Phase 4)") | the description cell | append " SUPERSEDED 2026-10-14 (this plan): name and delete link only." |
| `docs/SCALE_ENGINE_PLAN.md` owner row "D10 ... Infer only on create; override lives in the Edit sheet" | the description cell | append " SUPERSEDED 2026-10-14 (this plan): infer always; no override anywhere." |
| `docs/SCALE_ENGINE_PLAN.md` non-goal "A parent-scale picker on the create path (D10 override is Edit-only)." | that line | append " SUPERSEDED 2026-10-14 (this plan): no picker on any path." |
| `docs/ENGINE-SPEC.md` section 10, "DECIDED(D10, D14 as amended) The parent override is encoded as an INDEX into that list (0-10) and travels in the seed options; it changes degree labels only, never the fields list, so the deck id is unchanged." | the bullet | append one clause: " Since 2026-10-14 the sheet writes no index (every deck saved from the sheet carries the inferred one); the encoding stays, and an explicit index from an older record or a share link is honoured and re-stored when that link is opened (`tests/share.test.js` \"parent survives the round trip on its own, null included\"; app test \"RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included\")." |
| `docs/ENGINE-SPEC.md` section 10, "DECIDED(D10, D13, plan [design-review 7A]) Parent inference runs on create; the override lives only in the Phase 4 Edit sheet, never on the create path." | the bullet | append " SUPERSEDED 2026-10-14 (this plan): inference runs on create and on SAVE; there is no override control." |
| `docs/plans/2026-10-07-scale-drawer-design-spec.md`, the band paragraph "The band un-sticks (`position: static`) while any form control in the sheet that is not inside `#scale-layout-zone` has focus: the scale field, the deck name on Edit, the degrees select." | that sentence | append " [SUPERSEDED 2026-10-14 (this plan): no degrees select; the rule's `select:focus` term stays, R-4]" |
| same spec, acceptance line 86 "On the Edit sheet with the drawer open, focusing the deck name or the degrees select makes `#scale-plate-band` `position: static`, and focusing a drawer control does not." | that line | append " SUPERSEDED 2026-10-14 (this plan): the deck name only; test retitled \"DR1 line 86: on Edit the band goes static for the name, and not for a drawer control\"." |
| `CLAUDE.md`, "App data model" | new bullet after the `Zones:` sentence | "`options.parent` on every deck saved from the sheet (create or Edit) is the engine's INFERRED index since 2026-10-14 (`sheetOptions()` writes no parent; `select.build` resolves it). An explicit index is honoured when it arrives in an older stored record or a share link; opening such a link stores that index again (`openShare` persists what it decodes, test \"RD: opening a share link that carries an explicit parent stores that parent again, after an inferred SAVE included\"), and the next SAVE from Edit replaces it with the inferred one (test \"RD: a record stored with a non-inferred parent is displayed with it and re-saved from Edit with the inferred one\"). The Edit page has no DEGREES control (test \"RD: no DEGREES row - the served markup, ELEMENT_IDS and the app script carry neither scale-degrees id, and sheetOptions writes no parent on Edit\")." |
| `docs/2026-09-16-mobile-audit-pass-1.md` row 9 | history | NOT touched |

## F. Risk register

| what breaks | caught today by | new test must catch |
|---|---|---|
| a seeded SAVE wrongly reported unchanged because `sheetKey()` shrank | "SD: saving a seeded deck unchanged closes the sheet and writes nothing" (`d_unchanged_save_writes_record`) pins the unchanged path; the changed path by "editable defaults: saving each seeded deck with a palette change ..." | nothing new: no sheet control other than the select could set the parent, so the tuple loses nothing another control reports |
| stale `ELEMENT_IDS` entry (served, not in markup) or a lookup left behind | SB-2 (`r3s_served_id_not_in_markup`) | RD-T2 asserts both sides from the served string and the module, and that no lookup string remains in the app script |
| Tab trap reaching a removed element / a dangling `degSel` const | `isStop` filters `null`, so a leftover stop is silent; a leftover `degSel.addEventListener` throws at boot, which every sandbox `boot()` test catches | RD-T3 (browser order), RD-T2 (no lookup) |
| R-1 regresses to preserving the stored index | nothing | RD-T1, mutant `rd_save_keeps_stored_parent` |
| a lane "completes" the migration by stripping the parent in `openShare()` (R-3 regresses) | nothing | RD-T4, mutant `rd_share_strips_parent` (eng review E4) |
| a displayed record or link with an explicit index loses it (requirement 3) | `tests/share.test.js` "parent survives the round trip on its own, null included"; `tests/select.test.js` "options report palette, mirror and the RESOLVED parent index"; "rule N: a moved deck's stored record and share link are the strings main wrote" | RD-T1's first half (display before any edit) |
| `app_surface_v1` | carries none of `scale-degrees`, `buildDegrees`, `seedParent` (0 matches); no new bare name is read by any RD test (RD-T2 reads the file and the sandbox module, RD-T1 goes through `app.registry()` / `records`) | digest stays; a lane that moves it stops |
| `d_*` / `r4f_*` and the eleven context-stale mutants no longer apply | `tests/mutation_check.sh` reports `stale (does not apply)` into `SURVIVORS`: gate red; `tools/refresh_mutants.py --check` red at the lane head | gate 3; every re-anchor listed in the PR body |
| the 16px test's `assert.ok(hits.length, "no CSS rule for #scale-degrees")` | that test (would go red at the lane head) | the list drops the id; `f6_*` mutants still die on `#scale-box` |
| Edit page geometry (footer, keyboard budget) | sheet-guidance N-A5/N-A6/N-A7 tests, "with a real keyboard up, the seed box is not clipped by the sheet's own scroller" | nothing new: removing an in-scroll row shortens the scroll and moves no pinned row; the sheet-guidance measurements hold as upper bounds. Stated, not re-measured |
| FLOORS rows (`app.test.js`, `e2e.test.js`) and the README count | `suite_health.py`, `test_readme_currency` (90% band) | set from CI artifacts only |
| `panel-fit` | n/a: `#settings-panel` untouched | verdicts unchanged |

## G. Goal and non-goals

**Goal.** The Edit page has no DEGREES control; every deck the app saves carries the engine's inferred parent; nothing stored or shared changes meaning when displayed.

**Non-goals.** No engine change (`src/engine/` untouched; `engine_corpus_v1` not regenerated). No share-format change (`share.js` v3 options line unchanged). No change to how a displayed record or link with an explicit index is labelled. No change to the create path. No data or geometry change (`data/decks.json`, `const DECKS`, `tools/`). No change to `#settings-panel`, `panelStops()` or `panel-fit`. No copy change elsewhere on the sheet. No new id, component or CSS rule. No change to the band's `:has()` rule (R-4). No migration or rewrite of stored records on boot (R-3).

## Lanes (/swarm)

Worktrees `.claude/worktrees/remove-degrees-<lane>`, branches `claude/remove-degrees-<lane>`, base `main` b6d8bee (or main at lane start, rebased per gate 7). Merge order: **app, then docs**. Two lanes.

### Ownership rule (editable-defaults section 8.3, verbatim)

Lane app owns, in EVERY test file, EVERY EXISTING test that its behaviour changes (B1..B5) redden or whose purpose they defeat, found by two steps rather than by a list: (1) running the suites at the lane head, and (2) because a green test on the wrong path never fails (the five collision tests), auditing every existing test whose setup selects a chip by index or `chips.length` arithmetic, taps a chip that is already on, scrolls the strip before reading `.chip.on`, or reads `sheetState().primaries` (R9). Bounds: no test is renamed or deleted (so every `# kills:` and `# suite:` header stays true verbatim); every mutant whose `# kills:` names a touched test must still die (the mutant may be re-anchored, never re-targeted to another test); a touched test keeps its purpose (its assertions move to the new behaviour, as the pencil test already does; the five collision tests keep testing the EDIT path by selecting the older custom); the lane report carries a base-to-head inventory of every touched test (title, file:line, what moved, the mutants that name it), which the reviewer verifies against the diff. Lane app ALSO owns every existing MUTANT, whatever its target, that its source changes invalidate (`refresh_mutants.py --check` red at the lane head because the removed-lines run no longer exists verbatim): the run is rewritten against the lane head so the mutant demonstrates the same defect and still dies (R7; `e_panel_moved_into_header` is the known one). Lane e2e owns only the NEW tests it adds plus the new mutants that name them. R3 and R4 stay as the known list, now a FLOOR of what lane app touches, not a boundary; section 8.2 is the current floor (seventeen tests, two files) and ED-A17 the mutant floor.

Amendment for this workstream (as in seeded-save-delete): "B1..B5", "R9", "the five collision tests", "section 8.2" and "ED-A17" refer to the editable-defaults plan; here the audit in step (2) is of every existing test whose setup reads `#scale-degrees`, `#scale-degrees-row`, `editRowsShown`, the sheet's Tab-stop ids or `options.parent`, and section D is the floor. Two tests are REPLACED (R-5) and one RETITLED (DR1 line 86); every other touched test keeps its title; every `# kills:` header follows its test in the same commit; no mutant is deleted without its named replacement. There is no lane e2e: the one new e2e test is lane app's.

### Lane app (`claude/remove-degrees-app`, worktree `.claude/worktrees/remove-degrees-app`)

**Owns.** `index.html` app block only (never an engine region or the `const DECKS` line): the `#scale-degrees-row` markup and its D10 comment; the three CSS rules naming `#scale-degrees` (the id leaves the two shared selector lists, the `font` rule is deleted); `degRow`, `degSel`, `buildDegrees()`, `seedParent()`, the `degSel` change listener, the `editingId ? degSel : null` stop, the `degSel.value` member of `sheetKey()`, the `o.parent = Number(degSel.value)` line of `sheetOptions()`, the `buildDegrees(...)` call in `openEditSheet()`, `setSheetMode()`'s row loop (two rows) and its "three extra rows" comments. `tools/sandbox.js` `ELEMENT_IDS` (the two ids). `tests/app.test.js`, `tests/e2e.test.js` (section D plus anything found by running). `tests/mutants/*`: the four new `rd_*` (two of them replacements), the two replaced, `e_edit_tab_skips_delete` and every context-stale re-anchor. `tests/suite_health.py` rows `app.test.js`, `e2e.test.js`; README mutant count (both from CI artifacts only). **Reads only.** `src/engine/`, `data/decks.json`, fixtures, `docs/`, `#settings-panel`.

**Tests first** (RD-T1, RD-T2, RD-T3, RD-T4 red at base; the section D re-points), then the removal. Source comments: `setSheetMode()`'s "Show or hide the three Edit-only rows" and the `nameRow` block's "three extra rows" become "two"; the D10 markup comment goes with the row.

**Acceptance (proofs).**
- RD-A1 the row and the select are absent from the served markup, from `ELEMENT_IDS` and from every `getElementById` call and CSS selector in the app block; SB-2 green. Proof: RD-T2; mutants `rd_degrees_row_restored`, `rd_element_ids_serve_degrees`.
- RD-A2 the Edit page's Tab order with the drawer closed is BACK, name, box, ADJUST LAYOUT, swatches, SAVE CHANGES, DELETE, forward and back, with no gap and no select; with the drawer open the DR3 order holds unchanged. Proof: RD-T3; "Tab is trapped inside the Edit sheet and reaches every Edit control" re-pointed, `e_edit_tab_skips_delete` re-anchored and killing; "DR3 Tab order on Add and Edit, finer controls closed and open" green unchanged.
- RD-A3 SAVE on a custom deck writes the inferred parent and relabels (R-1a); a record with an explicit index displays with it until then, and a share link carrying an explicit index stores it again when opened (R-3). Proof: RD-T1, RD-T4; mutants `rd_save_keeps_stored_parent`, `rd_share_strips_parent`.
- RD-A4 a seeded SAVE with nothing changed is still reported unchanged. Proof: "SD: saving a seeded deck unchanged closes the sheet and writes nothing" green, `d_unchanged_save_writes_record` killing.
- RD-A5 the 380px Edit page shows the name and delete rows, SAVE CHANGES and DELETE THIS DECK unchanged; the swatches follow the layout zone at the standard group gap with no leftover spacer (section C "Layout"). Proof: "the selected custom chip reopens the sheet in Edit state, prefilled, at 380px" re-pointed (`rows` of two), `e_edit_delete_full_width` killing; RD-T2's sibling assertion; RD-A10's probe (drawer closed and open).
- RD-A6 the create path is unchanged: "+ ADD after an Edit opens a clean create sheet, never the edited deck's seed" (two rows hidden), "a share link restores the exact deck, and options never move the id", "consuming a share link runs select.build exactly once" green unchanged.
- RD-A7 seeded replacements unchanged: "editable defaults: saving each seeded deck with a palette change mints the fixture id as its replacement in the seeded slot" green with the degrees assertion removed; `deck_ids_v1` untouched.
- RD-A8 every retitled or replaced test's `# kills:` header true verbatim; `python3 tools/refresh_mutants.py --check` green; count 941 (939 + 4 - 2), reconciled in the PR body (added, replaced `old -> new`, re-anchored, each named).
- RD-A9 no fixture digest moved (`app_surface_v1`, `pan_render_v1`, `card_face_v1`, `deck_ids_v1`, `engine_corpus_v1`); `inline_engine.py --check`, `sync_decks.py --check`, `validate.py`, `boot_sim.js` green; `panel-fit` verdicts unchanged.
- RD-A10 the lane report carries the base-to-head inventory of every touched test and mutant (section D is the floor) and the Edit-page `.sheetbody` `scrollHeight` at 380x800 before and after, drawer closed and drawer open, read from one probe, as a note (not asserted), together with one 380x800 screenshot of the Edit page after the change with the drawer closed, attached to the PR for the reviewer's eye (design review D8).

**Verify.** `node --test --test-name-pattern 'RD:|SD:|SB-2|editable defaults|Edit state|16px|share link|changing only an option' tests/app.test.js`; `node --test --test-name-pattern 'RD:|Tab is trapped|DR1 line 86|DR3 Tab order|reopens the sheet in Edit state' tests/e2e.test.js` (single patterns, never the full e2e suite; `CHROME_BIN` set); `python3 tools/refresh_mutants.py --check`; `./tests/mutation_check.sh` restricted to the `rd_*`, `d_edit_*`, `d_add_keeps_edit_seed`, `d_fork_not_prefilled`, `d_seeded_sheet_keeps_fork_copy`, `e_edit_*`, `f6_*`, `r3s_*` and every re-anchored patch; CI at the head SHA is the evidence.

**Reviewer brief.** Quotes the amendment paragraph above verbatim (the two REPLACED tests and the one RETITLED test are permitted by it); without that sentence the ownership rule's "no test is renamed or deleted" reads as a violation (memory: reviewer brief quotes the plan verbatim).

**Stop.** Any need to touch `src/engine/`, `share.js`'s format, `data/decks.json`, a fixture digest, `#settings-panel` or a string elsewhere on the sheet; a touched test that must lose its purpose; any mutant that would be deleted without a named replacement; RD-T1 needing R-1(b) to pass (escalate, do not switch).

### Lane docs (after app merges; `claude/remove-degrees-docs`, worktree `.claude/worktrees/remove-degrees-docs`)

**Owns.** `docs/SCALE_ENGINE_PLAN.md`, `docs/ENGINE-SPEC.md`, `docs/plans/2026-10-07-scale-drawer-design-spec.md`, `CLAUDE.md`: exactly the marks in section E, each appended verbatim, nothing rewritten or deleted; this plan's own ledger ticked; `TODOS.md`: the two rows of "Design review 2026-10-14" below (sheet colours into CSS variables; the dead `select:focus` term) and the one row of "Engineering review 2026-10-14" (share links re-store an explicit parent, E4), appended as new sections in the file's house style. **Reads only.** Everything else; no test, mutant or code. Brief: section E verbatim plus the test titles behind every claim (standing rule after #299/#301/#304: a docs claim the code contradicts is a FAIL; the reviewer re-verifies every sentence against main at the app lane's merge SHA).

### Standing gates (refactor-pass-4 section 5, verbatim)

1. CI green at a head SHA verified against the local tip (`gh pr view <n> --json state,headRefOid`).
2. Independent reviewer PASS or PASS_WITH_NITS at that SHA, briefed with this plan's lane text verbatim (no added rules).
3. `python3 tools/refresh_mutants.py --check` green; mutant count reconciled in the PR (added, replaced `old -> new`, re-pointed - each named).
4. `panel-fit` verdicts unchanged (real and fallback).
5. `inline_engine.py --check`, `sync_decks.py --check`, `validate.py`, `boot_sim.js` green; no fixture digest moved; `data/decks.json` untouched.
6. FLOORS rows moved only as section 4 allows, only to CI's count for the branch; README counts within `test_readme_currency`'s band.
7. Rebase procedure of the house format (§20.24 of the drawer plan): fetch + rebase; both `--check`s; `refresh_mutants.py` committed on its own; own FLOORS rows + README counts from main's artifacts; push and wait for CI.

**Estimates.** app ~half a day human / ~40 min CC plus CI; docs ~1 h human / ~10 min CC.

**Prompt facts corrected at this SHA.** (a) No `:focus-within` rule and no CSS rule names `#scale-degrees` for the band; the band rule is `.sheetbody:has(... select:focus ...)` and is left alone (R-4). (b) Twelve existing mutants beyond the two named carry the removed or neighbouring lines (`e_edit_tab_skips_delete` in its +/- lines, eleven in context); they are lane app's by the ownership rule. (c) The harness files a non-applying patch under `SURVIVORS` with the label `stale`; the gate outcome is the failure the prompt describes. (d) `editRowsShown` has a second caller, "+ ADD after an Edit opens a clean create sheet, never the edited deck's seed". (e) The e2e 380px Edit test also asserts the select's option count (11), not only the row. (f) "DR3 Tab order on Add and Edit, finer controls closed and open" is a sandbox test in `tests/app.test.js`, and with the drawer closed the sheet's Tab order still stops on ADJUST LAYOUT (`#scale-layout-toggle`); the first draft placed the test in e2e and omitted the stop (design review D6).

## Design review 2026-10-14 (`/plan-design-review`, AFK auto-picks)

D1 all seven passes; D2 outside voices run (Codex and a Claude design subagent, both read-only against b6d8bee); D3 no-OpenAI-key mockup fallback (no mockups; the surface is a row removal on an existing dark sheet); D4 Pass 1: the Edit page hierarchy recorded below, no finding; D5 Pass 2: the SAVE-time relabel stays silent (R-7) and the unseen parent stays unseen (R-6), the toast is pinned in RD-T1 and an explicit-name case added; D6 Pass 3: keyboard contract corrected (ADJUST LAYOUT is a stop with the drawer closed; DR3 is a sandbox test), RD-T3, RD-A2 and section C rewritten, forward and reverse traversal asserted; D7 Pass 4: OPERATE classification, no hard rejection, litmus below; D8 Pass 5: no `DESIGN.md` (gap carried from the 2026-10-13 review, TODOS row "Write DESIGN.md via /design-consultation" stands), the visual contract written into section C "Layout", RD-T2's sibling assertion and RD-A10's probe and screenshot; D9 Pass 6: RD-T2 also rejects an orphan `for="scale-degrees"` label and names its prefix match; the reviewer brief quotes the retitle amendment; D10 Pass 7: no unresolved decision; D11 TODOS: two rows proposed and accepted for lane docs (sheet literal colours into CSS variables, Codex P3, appearance-preserving, separate change; drop the dead `select:focus` term of the band rule, R-4).

**Pass 1 - Edit page at 380px, before and after.**

```
BEFORE (b6d8bee)                      AFTER
.sheethead  < BACK   Edit this scale  .sheethead  < BACK   Edit this scale
.sheetbody (scrolls)                  .sheetbody (scrolls)
  DECK NAME   [ D AEOLIAN 9       ]     DECK NAME   [ D AEOLIAN 9       ]
  SCALE       [ (D3) A3 C4 ...    ]     SCALE       [ (D3) A3 C4 ...    ]
              parse line                            parse line
  #scale-layout-zone  [ADJUST LAYOUT]   #scale-layout-zone  [ADJUST LAYOUT]
  DEGREES     [ AEOLIAN         v ]     (gone, with its label and gap)
  .ctlrow     o o o o o  swatches       .ctlrow     o o o o o  swatches
#scale-guidance (reserved, 2 lines)   #scale-guidance (reserved, 2 lines)
[ SAVE CHANGES ]        (pinned)      [ SAVE CHANGES ]        (pinned)
DELETE THIS DECK        (pinned)      DELETE THIS DECK        (pinned)
```

Identity, content, correction, decoration, actions: the order is right and nothing moves. The only loss is the mode name (R-6).

**Pass 2 - states.**

| feature | loading | empty | error | success | partial |
|---|---|---|---|---|---|
| Edit open (custom, stored inferred parent) | n/a (sync) | n/a | unchanged | name, box, drawer, swatches; no DEGREES row | n/a |
| Edit open (custom, stored override) | n/a | n/a | unchanged | same page; labels on the card still the override's (R-3); the parent is not shown (R-6) | n/a |
| SAVE (fields changed) | button disabled during generate, unchanged | n/a | seed refusal unchanged | `Updated <name>`; parent inferred | n/a |
| SAVE (options-only, stored override) | same | n/a | n/a | `Updated <name>`; labels relabelled silently (R-7), explicit name kept | n/a |
| SAVE (seeded, nothing changed) | same | n/a | n/a | sheet closes, nothing written (RD-A4) | n/a |
| BACK / Escape | n/a | n/a | n/a | stored record untouched (existing) | n/a |

**Pass 3 - journey, a former dropdown user.**

| step | user does | user feels | plan specifies? |
|---|---|---|---|
| 1 | opens Edit on a deck saved under Dorian | row gone; nothing explains it | yes: R-6, R-7 (no announcement) |
| 2 | changes the palette, taps SAVE CHANGES | toast `Updated <name>`; the card header's `IV` is now `iv` | yes: RD-T1 both cases |
| 3 | looks for a way back to Dorian | none; the override is gone by owner decision | yes: goal, R-1a |
| 4 | opens an old share link minted under Dorian | labels still Dorian | yes: R-3 |
| 5 | keyboard user tabs through Edit, drawer closed | BACK, name, box, ADJUST LAYOUT, swatches, SAVE, DELETE | yes: RD-T3 (after D6) |

**Pass 4 - AI slop.** Classification OPERATE (a form inside a utility sheet). Hard rejections: none apply. Litmus: brand unmistakable YES (handpan preview, scale notation); one anchor YES (the preview; SAVE as the action); scannable YES; one job per section YES; cards necessary NO (none used); motion improves hierarchy NO (none added); premium without shadows YES. Nothing is added, so nothing to reject.

**Pass 5 - design system.** No `DESIGN.md`. The plan names only existing tokens: `.editrow`, `.sheetlabel`, `.ctlrow`, `--sp-1`/`--sp-2`/`--sp-3`, the 44/48px rows, 16px inputs, Nunito Sans. Codex P3 (the sheet's literal colours) is real and pre-dates this change: TODOS row, not this lane.

**Pass 6 - responsive and accessibility.** 380px is the test width (RD-A5, RD-T3 at 380x800); the landscape `max-height:520px` block loses the id from its shared list; Tab order and focus are asserted both ways; no orphan label; the dialog's `aria-labelledby` and the pinned footer are untouched.

**Pass 7 - unresolved decisions.** None.

**NOT in scope** (owner-visible, so nobody expects it): a notice announcing the relabel (R-7); a readout of the inferred mode on the sheet (R-6); a migration of stored records (R-3); the sheet's colour tokens (TODOS); the dead `select:focus` term (TODOS); any change to `#settings-panel`.

**What already exists** (reused, not rebuilt): the `select.build` inference on the create path; the `Updated <name>` toast; the seeded unchanged-save check; `isStop`'s filtering of the Tab list; `.sheetbody`'s flex gap; SB-2 and the `ELEMENT_IDS` contract; the DR3 drawer-open Tab test; the sheet-guidance geometry tests as upper bounds.

**Implementation tasks added by this review** (all lane app unless marked): (1) RD-T3 asserts the toggle stop and both directions; (2) RD-T1 asserts the toast text and gains the explicit-name case; (3) RD-T2 rejects `for="scale-degrees"`, asserts the layout-zone/swatches sibling and names its prefix match; (4) RD-A10 gains the drawer-open probe and one 380x800 screenshot; (5) section C "Layout" is the visual contract the reviewer checks; (6) lane docs: two TODOS rows; (7) integrator: the reviewer brief quotes the retitle amendment.

```
DESIGN REVIEW COMPLETE
Overall: 9/10 (lowest of passes 1-6; initial 8/10 before D5, D6, D8)
Pass 1 IA 9 | Pass 2 states 9 | Pass 3 journey 9 | Pass 4 slop 10 | Pass 5 system 9 | Pass 6 responsive/a11y 9
Decisions made: 11 (all AFK auto-picks)   Unresolved: 0
Outside voices: codex (REVISE: P1 relabel notice -> R-7 silent by design; P2 keyboard -> D6 adopted; P2 visual contract -> D8 adopted; P3 colours -> TODOS), claude subagent (no critical findings; R-6, R-7, toast assertion, options-only case, reviewer-brief amendment -> all adopted)
```

VERDICT: SMALL

## Decision ledger (eng review 2026-10-14, `/plan-eng-review`, AFK auto-picks)

gstack question numbers in brackets. Plan-level ids `E<n>` so they never collide with the plan's `R-n` or the design review's `D1..D11`.

| id | question | options | AFK pick and rationale |
|---|---|---|---|
| E0 [D1] | review depth | skip the complexity gate / run it | **skip, standard review**: 7 touched files, no new class, no new pattern |
| E-REG [D2] | regression rule: does every behaviour this plan changes get a test that is red at base? | yes, named per change / rely on the existing suite | **yes**: RD-T1 (R-1a), RD-T2 (removal), RD-T3 (keyboard), RD-T4 (R-3), each red at b6d8bee, each with a mutant |
| E1 [D3] | Codex 1: the "only a tie pan" population behind R-7 is false, and a field edit already stores a non-inferred index | A amend R-7 and the intro, keep R-1a / B add the notice (R-7b) / C investigate further | **A**: verified at b6d8bee (`openEditSheet` preselects the stored index, `sheetOptions()` re-sends it; `caseFromParent` cases from any chosen parent). The decision R-1a/R-7a stands; its stated population was wrong. RD-T1's fixture already covers both origins. Applied to the intro paragraph and R-7 |
| E2 [D4] | Codex 2: RD-T3 names a setup that opens the drawer and a viewport the helper does not set; swatches have no ids; the reverse cycle's endpoints were implied | A rewrite RD-T3's setup and identities / B keep and let the lane discover it | **A**: `editFreshDeck()` + explicit `setViewport(380, 800, true)`, swatches by `aria-label`, both cycles written out with their wrap endpoints. Applied to RD-T3 and section C |
| E3 [D5] | Codex 3: RD-T2's last-call `parseSeed` spy is overwritten by `recordDeckId`'s option-less call inside `rememberScale`, so its SAVE assertion cannot fail | A collect every options-bearing call and assert on the set / B drop the SAVE half (RD-T1 covers it through records) | **A**: the spy stays and becomes real; RD-T1 remains the record-level proof and the mutant's named killer. Applied to RD-T2 |
| E4 [D6] | Codex 4: `openShare()` re-persists a decoded explicit index, so an old link re-stores Dorian over an inferred Aeolian record; the docs' "every app-saved deck" and "until its next Edit save" were false | A keep R-3 (links honoured and re-stored), scope the docs to sheet saves, add RD-T4 + mutant, TODOS row for the owner on whether links should infer / B strip the index in `openShare()` (links infer too) / C defer | **A** (conservative; B changes share semantics the owner has not been asked about, and "a share link restores the exact deck" is a standing decision). Applied to R-3, RD-T4, section D (count 941), section E (three sentences), F, lane app RD-A3/RD-A8, lane docs. B is listed for the owner in the TODOS row |
| E5 [D7] | TODOS from this review | A add one row / B skip / C build now | **A**: one row, lane docs (below) |

Approval readiness: PASS. Checked: E0, E-REG, E1, E2, E3, E4, E5; R-1..R-7; D1..D11.

## Engineering review 2026-10-14 (`/plan-eng-review`, medium effort, AFK auto-picks)

**Step 0 / Scope Challenge.** Seven files touched (`index.html` app block, `tools/sandbox.js`, `tests/app.test.js`, `tests/e2e.test.js`, `tests/mutants/*`, `tests/suite_health.py`, `README.md` optional) plus four docs files for lane docs; zero new classes, zero new patterns, nothing in `src/engine/`, no data. Complexity gate not tripped (E0). Can the scope shrink? No: every item is a leftover of the removed control, and the plan already refuses the two things that would grow it (R-6 readout, R-7b notice). Is anything speculative? `rd_share_strips_parent` (E4) guards a behaviour nobody has asked to change; it exists because a lane reading "infer always" could "finish the job" in `openShare()` and no test would notice. TODOS cross-reference: no open TODOS row overlaps (sheet guidance follow-ups, DESIGN.md, label ratios, octave digit, SMALL_LABELS, iOS keyboard, scale engine); the plan adds three rows (D11 two, E5 one). No issues found beyond the four outside-voice findings resolved in E1..E4.

**Section 1 - Architecture.** One data path changes: `sheetOptions()` stops writing `o.parent` on Edit, so `select.build`'s `parent === undefined || === null` branch infers on SAVE as on create (`src/engine/select.js` 538-541, unchanged). Nothing else reads the dropdown. Storage format, share format, deck id (fields only, D14) and the engine are untouched. The one architectural fact the first draft got wrong, surfaced by Codex (E4): the app has THREE writers of `options.parent` into storage, not one. The sheet (create and Edit), and `openShare()`, which persists what it decodes. Removing the control removes the sheet's explicit index; links keep theirs. The plan now says so wherever it claimed otherwise.

```
                 create sheet ─ sheetOptions() (no parent) ─┐
                 Edit sheet   ─ sheetOptions() (no parent, was degSel.value) ─┤
                                                                              ├─> generateDeck -> parseSeed(text, opts) -> select.build (infers when parent is null/undefined)
                 openShare()  ─ share.decode -> options.parent (explicit, kept) ─┘            │
                                                                                               v
                                                        rememberScale / replaceScale -> record {v, s, o: {.., parent}}
```

**Section 2 - Code quality.** The removal is a deletion list (section A, lane app "Owns"); the only new app code is none. The risk is a dangling reference: `degSel` is read in five places (builder, listener, Tab stop, `sheetKey()`, `sheetOptions()`) and the sandbox throws at boot on a null `addEventListener`, so a partial removal is loud. SB-2 makes a stale `ELEMENT_IDS` entry loud. The three CSS rules are two shared selector lists plus one dedicated `font` rule; the shared lists keep their other ids. Comments naming "three" rows become "two". Nothing is renamed.

**Section 3 - Tests.** Rubric (★ = behaviour pinned by a test that is red at base and has a named mutant):

```
behaviour                                   unit (sandbox)          e2e (browser)              mutant
SAVE from Edit infers (R-1a)                [★★ TESTED] RD-T1       -                          rd_save_keeps_stored_parent
display of a stored explicit index (R-3)    [★★ TESTED] RD-T1 half  -                          (existing share/select tests)
share link re-stores explicit index (R-3)   [★★ TESTED] RD-T4       -                          rd_share_strips_parent
no row / id / lookup / CSS / label          [★★ TESTED] RD-T2       [→E2E] 380px Edit test     rd_degrees_row_restored, rd_element_ids_serve_degrees, r3s_*
sheetOptions writes no parent on Edit       [★★ TESTED] RD-T2 spy   -                          rd_save_keeps_stored_parent
Tab order, drawer closed, both directions   [GAP in sandbox, by design]  [★★ TESTED] RD-T3     e_edit_tab_skips_delete (re-anchored)
Tab order, drawer open                      [★★ TESTED] DR3 (exists)  -                        dr3_* (context re-anchor)
seeded unchanged SAVE still unchanged       [★★ TESTED] SD: (exists) -                         d_unchanged_save_writes_record
create path unchanged                       [★★ TESTED] exists       -                         d_add_keeps_edit_seed
Edit page geometry (footer, keyboard)       [GAP: stated, not re-measured; RD-A10 note + screenshot]  sheet-guidance N-A5..A7 as upper bounds
```

COVERAGE: 9 of 10 behaviours pinned; the one gap (geometry) is a measurement the plan declares and the lane reports, not asserts, by owner-style decision (design D8, risk register). QUALITY: every new test names its mutant and every mutant names its test; the two defeated mutants have named replacements; the count moves 939 to 941. Regression rule (E-REG): yes. Test Plan Artifact: `~/.gstack/projects/raywu-handpan-cards/ray-claude-remove-degrees-dropdown-plan-eng-review-test-plan-20261014-140603.md`.

**Section 4 - Performance.** None. One fewer DOM node, one fewer listener, one fewer `sheetKey()` member; no loop, no network, no storage growth. Not measured, nothing to measure.

**Outside voice.** `OUTSIDE_STATUS: completed provider=codex host=claude`. Codex ran read-only against b6d8bee on the plan at f2799b4 (prompt and output in the session scratchpad; four P2 findings, recommendation "revise before implementation"). Each was verified against the code before deciding:

1. P2 population and "ties only" premise: true at `index.html` `openEditSheet` (`buildDegrees(... edit.options.parent)`), `sheetOptions()` (`o.parent = Number(degSel.value)`), `src/engine/naming.js` `caseFromParent`. Resolved E1 (apply).
2. P2 RD-T3 setup: true, `editFreshDeck()` sets 380x840 and `editFreshDeckOpen()` opens the drawer; swatches carry `aria-label="Palette N"` and no id; `cycleTabStops` wraps both ends. Resolved E2 (apply).
3. P2 RD-T2 spy: true, `rememberScale` -> `sameDeck` -> `recordDeckId` -> `parseSeed(r.s)` with no options after the SAVE generation. Resolved E3 (apply).
4. P2 share round trip: true, `openShare()` calls `generateDeck(formatSeed(fields), res.value.options)` then `rememberScale`, which replaces the record of the same id. Resolved E4 (apply A, conservative).

Persisted as `codex-plan-review` (`status: issues_found`, phase `plan-review`).

**TODOS (E5).** One row for lane docs, title "Share links re-store an explicit parent index": What: `openShare()` persists the decoded `options.parent`, so a link minted under an override re-stores that index over an inferred record (RD-T4 pins it). Why: the 2026-10-14 removal infers on every SHEET save only; links were left honoured (R-3). Pros of changing: "infer always" would then be literally true. Cons: a link would no longer restore the exact deck the sender sees, a standing decision ("a share link restores the exact deck, and options never move the id"), and the share format would carry a dead field. Context: owner question, no lane; E4 option B. Depends: nothing.

**NOT in scope.** A notice announcing the relabel (R-7); a readout of the inferred mode (R-6); stripping the index in `openShare()` (E4 B, TODOS); a migration of stored records; the `select:focus` term (R-4, TODOS); sheet colour tokens (TODOS); `#settings-panel`; the engine, the share format, data, fixtures.

**What already exists.** `select.build`'s inference on null/undefined; `isStop` null-filtering; SB-2 and `ELEMENT_IDS`; the DR3 drawer-open Tab test; the seeded unchanged-save test; the `Updated <name>` toast; the share round-trip tests in `tests/share.test.js`; `refresh_mutants.py --check` and the `stale` label in `mutation_check.sh`.

**Failure modes.** (1) Partial removal leaves a null `degSel`: boot throws in every sandbox test, loud. (2) `ELEMENT_IDS` lags the markup: SB-2 red, loud. (3) A lane keeps the stored index on options-only saves (R-1b creeping back): RD-T1 second case red, `rd_save_keeps_stored_parent` killed. (4) A lane strips the index in `openShare()`: RD-T4 red, `rd_share_strips_parent` killed. (5) RD-T3 written against the wrong helper: red at the lane head with the drawer stops present, loud. (6) Context-stale mutants: `stale (does not apply)` into SURVIVORS, gate red. (7) FLOORS or README moved from a local count: `suite_health.py` red; set from CI artifacts only. No critical gap: every mode is caught by a named test or gate.

**Worktree parallelization.** Two lanes already defined, strictly ordered: lane app, then lane docs (docs cite the merged test titles; the reviewer verifies each sentence against main at the app merge SHA). No conflict possible: disjoint files. Sequential implementation by design; no further split.

## Implementation Tasks

| id | task | owner | surfaced by | files | verify |
|---|---|---|---|---|---|
| T1 (P1, CC) | RD-T1, RD-T2, RD-T3, RD-T4 red at base, then the removal list of section A DONE #306 (083f44a) | lane app | plan + E2, E3, E4 | `index.html` app block, `tools/sandbox.js`, `tests/app.test.js`, `tests/e2e.test.js` | lane app "Verify" line |
| T2 (P1, CC) | mutants: four `rd_*` added, `d_degrees_ignored` and `r4f_degsel_change_unwired` replaced, `e_edit_tab_skips_delete` re-anchored, context-stale set re-anchored; count 941 DONE #306 (083f44a) | lane app | section D + E4 | `tests/mutants/*` | `python3 tools/refresh_mutants.py --check`; `./tests/mutation_check.sh` on the named set |
| T3 (P2, CC) | existing tests re-pointed per section D; DR1 line 86 retitled DONE #306 (083f44a) | lane app | section D | `tests/app.test.js`, `tests/e2e.test.js` | the two `--test-name-pattern` commands |
| T4 (P2, CC) | FLOORS rows and README count from CI artifacts only DONE #306 (083f44a) | lane app | gate 6 | `tests/suite_health.py`, `README.md` | `test_readme_currency`, `suite_health.py` on CI |
| T5 (P2, CC) | RD-A10 probe note and 380x800 screenshot on the PR DONE #306 (083f44a) | lane app | design D8 | PR body | reviewer checks section C "Layout" |
| T6 (P2, CC) | section E marks, three TODOS rows, ledger ticks DONE (this PR) | lane docs | section E, D11, E5 | `docs/SCALE_ENGINE_PLAN.md`, `docs/ENGINE-SPEC.md`, `docs/plans/2026-10-07-scale-drawer-design-spec.md`, `CLAUDE.md`, `TODOS.md`, this plan | reviewer re-verifies every sentence against main at the app merge SHA |
| T7 (P2, human) | owner: should share links infer too (E4 B)? | owner | E4 | TODOS row | owner answer on return |

**Unresolved decisions.** None. T7 is a TODOS row, not a blocker.

```
ENG REVIEW COMPLETE
Step 0: 7 files, 0 new classes, gate not tripped | Architecture: 1 finding (three writers of options.parent, E4) | Code quality: 0 findings
Tests: 4 new, 1 retitled, 2 replaced, 4 mutants added, count 939 -> 941, 1 declared measurement gap | Performance: nothing to measure
NOT in scope: 8 items | What already exists: 8 items | TODOS: 1 added (E5) | Failure modes: 7, 0 critical gaps
Unresolved: 0 | Outside voice: codex, 4 P2, all applied (E1..E4) | Parallelization: sequential, two lanes by design
Lake Score: 9/10 (the one point is the un-measured Edit geometry, declared and reported rather than asserted)
```

**Suppressed findings.** None.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO | SMALL verdict, owner request verbatim | not needed for a row removal | 0 | not run | - |
| Outside Review | design and eng reviews | codex (read-only) + in-host claude design subagent | 3 | completed | design: 4 (1 declined by design, 3 applied); eng: 4 P2, all applied (E1..E4) |
| Eng Review | plan ready for /swarm | lock in tests, mutants, data paths | 1 | complete 2026-10-14 | E1..E5 resolved, 0 unresolved, Approval readiness PASS |
| Design Review | Edit sheet surface change | row removal on a dark sheet | 1 | complete 2026-10-14, 9/10 | D1..D11 resolved |
| DX Review | - | no developer-facing surface | 0 | not run | - |

OUTSIDE COVERAGE: design voices completed (codex + in-host subagent); eng voice completed (codex, `OUTSIDE_STATUS: completed provider=codex host=claude`).

VERDICT: plan approved for `/swarm` execution, lane app then lane docs; every design and eng finding is in the plan (R-3 scoped, R-7 population, RD-T1..T4, four `rd_*` mutants, count 941, section E scoped to sheet saves, three TODOS rows).

NO UNRESOLVED DECISIONS
