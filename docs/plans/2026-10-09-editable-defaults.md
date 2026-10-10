# Editable default scales: sizing report and plan

Investigated at `main` `3bae527e74aced74e566c201ad44f3efc4c6b8f3` (2026-10-09), read-only, in the worktree `.claude/worktrees/editable-defaults-plan`. Prompt: `docs/plans/2026-10-09-editable-defaults-prompt.md`. Facts cite function and marker names in `index.html` unless a file is named.

## 1. Answers to the owner's five questions

**Can a built-in be edited in place? No - fork it.** Nothing in the app edits a built-in: `isBuiltIn` is `DECKS.some(d => d.id === id)`, `buildChips` sets `editable = d.id === deckId && !!CUSTOM[d.id]`, `editedDeck` reads `CUSTOM[editingId]` only, `deleteDeck` returns on `!CUSTOM[id]`, and `resetSheetState(edit)` reads `edit.options.*`, which built-ins do not carry. A fork is a prefilled create: `HPE.core.formatSeed(d.fields)` reproduces every built-in's maker string (probe over all five; Pygmy gives `[C3] [Db3] [Eb3] (F3) G3 ... Eb5 | F5 G5 [Ab5]`), and `generateDeck` on that string yields chords, fields and ids (`custom:cb5fe66a`, `b174242c`, `977311b5`, `626198f8`, `6f9ffc33`, matching `tests/fixtures/deck_ids_v1.json`) identical to `data/decks.json`, with one exception: engine degrees for Amara 9 add `"4":"ii°"` (the owner kept E out of Amara 9's `degrees`, 2026-10-06). A fork gets the auto-name (`D AEOLIAN 10`, `D AEOLIAN 9`, `C# HIJAZ 9`, `F AEOLIAN 12`) and palette 0 (Hijaz pink/orange) until renamed in the Edit sheet; Kurd blue/brick and Amara 10 green/crimson are not among `HPE.select.PALETTES`' six entries.

**Where does the "hidden" state live? One `hidden` array in `hpfc`.** `save()` already read-modify-writes `hpfc` and preserves sibling keys, and reads are type-guarded, so a `hidden: ["amara", ...]` field (built-in ids only, written only when non-empty, deleted when empty) costs one guard in `save()` and one filter in `allDecks()` and `deck()`. Nothing else is stored today (`hpfc`, `hpfc.scales.v3`, the read-only legacy `hpfc.scales`; no cookies), and `tests/app.test.js` "a store holding hijaz from before the default changed still opens Hijaz" pins the `hpfc` key set to `deck, mode, printPaper, tier` - the write-only-when-non-empty rule keeps that test and the `deepStrictEqual` in the custom-deck persistence test green untouched.

**What does deleting a built-in do? It hides, never removes.** `DECKS` is the generated `const DECKS` line; the five decks, their fixtures and `tools/decks.py` are literals the app cannot alter. "Delete" on a selected built-in appends its id to `hidden`, then selects as `deleteDeck` does: `selectDeck(DEFAULT_DECK)` if Kurd is visible, else the first visible deck of `allDecks()`. If all five are hidden and no custom deck exists, the hide is refused with a `say(..., "warn")` - a visitor must keep one deck. A hidden built-in never appears in chips, is never the fallback of `deck()`, and is never reached by a share link (`SHARE_PREFIX` links carry seeds, never built-in ids), so `openShare` needs no change.

**How does a player get a hidden deck back? A restore button rendered only while something is hidden.** A `#deck-restore` button ("SHOW HIDDEN DECKS") in `#panel-scales-group` after `#deck-add`, present in the markup but `hidden` unless the array is non-empty; tapping it clears the array and rebuilds chips. `tools/probe/panel_fit.js` measures `#settings-panel` only and walks rendered controls; on a fresh store the button is unrendered, so gate 4 (`panel-fit` verdicts unchanged) holds by construction. `panelStops()` must list it when rendered (rule 6 of the judge).

**Where do added custom scales go? Position 1, by reversing CUSTOM.** `allDecks()` is `[...DECKS, ...Object.values(CUSTOM)]`, and `rememberScale` appends to `hpfc.scales.v3`, so storage order is oldest-first. `allDecks()` becomes `[...Object.values(CUSTOM).reverse(), ...visibleDecks()]`: the newest custom deck is chip 1, built-ins follow in `data/decks.json` order. `replaceScale` rewrites at the old index and `replaceRegistered` rebuilds `CUSTOM` in place, so a field edit and a rename keep their chip. The picker-order test "the deck picker lists Kurd 10, Amara 10, Amara 9, Hijaz, Pygmy in that order" reads `app.get("DECKS")` and does not see chips; it and `b_picker_order_swapped` are unaffected.

## A. Two designs

**Design 1 - fork-and-hide (recommended).** Built-ins stay immutable. Tapping the selected built-in chip opens `openEditSheet` in a new third mode (`setSheetMode("builtin")`): the scale box is prefilled from `formatSeed(d.fields)` with `anchor` set (`between` for Pygmy), the title reads the deck name, `#scale-generate` reads "FORK THIS DECK", and `#scale-delete` reads "HIDE THIS DECK" with the existing arm/disarm (`DEL_IDLE`/`DEL_ARMED`, `disarmDelete`). GENERATE runs the create path (`editingId` null), so `runGenerate` and its `taken` guard ("Another deck already uses this scale.") apply unchanged: forking a deck twice is refused, forking after a field change goes through. Touches: `allDecks`, `deck`, `save`, `buildChips`, `openEditSheet`/`resetSheetState`/`setSheetMode`/`sheetOptions`, `deleteDeck`, `panelStops`, the boot tail, one button and one CSS rule. No engine, data, tools or fixture change.

**Design 2 - overlay in CUSTOM.** Register every built-in into `CUSTOM` at boot so edit, delete and position logic is uniform. Cost: `isBuiltIn` and `downloadDeckPDF`'s `fromBuiltin(d, d.print)` branch lie or need an `overlay` key; `tools/boot_sim.js` and the `app.get("DECKS")` tests see a shrunk literal; the `custom:` fallback message in the boot tail misfires on built-ins; `restoreScales` must skip five seedless records; `app_surface_v1.json` moves if any helper is renamed. More invasive for the same visible result. Rejected.

## B. Pipelines

A forked deck is a generated deck everywhere. Sheet, chips, cards, share link and storage already handle it. PDF: `downloadDeckPDF` routes `custom:` ids to `HPE.pdfdeck.fromGenerated(d)`, which the probe built for all five forks (the UI's `shop` variant only). Differences from the committed built-in PDFs: `cardHeader` draws the deck name and `sideCredit` the credit on every chord card, so a fork prints its auto-name until renamed; palette is the fork's palette; `R`/`cy` are `bankers(BAND_HALF/ext)`/124 - identical to the built-in overlay for Kurd and Amara 10 (69.8/124), smaller for Amara 9 and Hijaz (69.8/124 vs 73/126) and Pygmy (50.6/124 vs 60/121). Title card, blurb, legend and blank cards are full-variant only and the UI offers none. The fork's `geom` carries `ext`, so `fromGenerated` never throws. These are the engine's own figures for the same scale; the plan records "accept engine output" as the AFK pick, with "keep the five print overlays by copying `d.print` onto a fork" as the alternative (it needs an engine lane and is out of SMALL).

## C. Delete semantics

Custom decks: unchanged (`deleteDeck` -> `forgetScale` -> `selectDeck(DEFAULT_DECK)`). Built-ins: hide as in section 1. The fallback chain in `deck()` gains a visibility filter so a stored `hpfc.deck` naming a hidden built-in resolves to the first visible deck, with the existing "That deck is gone" `say` extended to built-in ids. Tests to re-point, not delete: `tests/e2e.test.js` "the replacement takes the old chip's position and keeps it across a reload" and "an options-only edit keeps its chip position across a reload at 380px" both compute `at = indexOf(selected) - 1` on the assumption that custom decks come last; under position 1 the custom chip is index 0 and `at` is -1. Both keep their titles (mutant headers name them) and assert index 0 instead; `e_optedit_reappends` (kills the options-only test) keeps killing under the new assertion because re-appending still moves the chip. `tests/app.test.js` "a field edit replaces the deck and the new one takes the old chip position" is position-relative and holds. "a selected custom chip carries a pencil; no built-in chip ever does" and "the layout markup exists and a built-in deck is never editable" change meaning: a selected built-in chip now opens the sheet. Both are retitled only if the owner accepts a rename (the house rule forbids renames that orphan mutant headers), so the plan re-points `e_chip_pencil_on_builtins` and keeps the titles while changing the assertion to "a built-in chip carries no pencil glyph; tapping it opens the sheet in builtin mode" - the pencil glyph stays custom-only, which keeps the title truthful.

## D. Reset

Restore = clear `hidden`. `#deck-restore` as above; after restore `selectDeck` keeps the current deck. No reset for forks beyond deleting them (existing path). A "reset everything" is not in scope.

## E. Risk register

1. **panel-fit gate.** Any new rendered `#settings-panel` control that is not `res-*` is judged exactly (rule 3 fails only if its bottom exceeds `avail`; rule 1 if `needed` grows past both base and `avail`). Mitigated by rendering `#deck-restore` only when `hidden` is non-empty; the probe's fresh store never sees it. Residual: a visitor with hidden decks at 380px landscape may push the panel into scroll - allowed, the panel scrolls.
2. **Mutant context.** `d_chip_no_cap` is the only patch whose hunk context contains `allDecks`; `d_save_no_guard`, `d_save_wholesale`, `d_save_drops_mode`, `e_persist_save`, `uid_tier_not_persisted` anchor on `save()`; the `d_delete_*` family on `deleteDeck`. `refresh_mutants.py` handles context; rewrite against a stabler anchor where it cannot (memory: hand-regenerated mutants drift).
3. **`app_surface_v1.json`.** Moves only if a test reads a new bare name; the plan names new helpers (`hiddenDecks`, `visibleDecks`) and has the app lane assert through existing surfaces (`app.run`, DOM) so the digest stays.
4. **Amara 9 fork shows `ii°` on E.** Engine output; recorded as a ledger item, AFK pick "accept".
5. **Fork name and palette.** A fork prints `D AEOLIAN 10` until renamed; the sheet's rename path exists (`sheetOptions` sets `o.name` only when `editingId`), so the fork's first Edit sets it. Ledger item: prefill the fork's name from the built-in - needs the create path to carry a name, a small `sheetOptions` change inside the app lane; AFK pick "prefill".
6. **FLOORS/README.** New tests raise `app.test.js` and `e2e.test.js` counts; set from CI's artifacts only (memory: FLOORS rows lag the CI count).
7. **Hidden `DEFAULT_DECK`.** `DEFAULT_DECK` stays `kurd`; "a first visit with empty storage opens D Kurd 10" is unchanged because an empty store hides nothing.

**Prompt facts false at this SHA.** (a) The picker-order test and `b_picker_order_swapped` do not pin custom-chip position; they read the `DECKS` literal. (b) Fork auto-names differ from the built-in names. (c) Amara 9's engine degrees include E `ii°` while the stored deck's do not. (d) `tests/app.test.js` has no test named for `allDecks`. (e) `tools/pdf_build.js` exists; the probe used the engine directly.

**Estimate.** App lane 1.5 h CC / 1 day human; e2e lane 1 h CC / half a day; docs lane 20 min CC / 1 h. One `hpfc` field, app block + tests + mutants only, three lanes, no digest, `decks.json`, tools or engine change.

VERDICT: SMALL

---

# /swarm plan: editable defaults (lanes app, e2e, docs)

Shape follows `docs/plans/2026-10-09-refactor-pass-4.md` sections 2-6 and 9. Evidence standards 2.3-2.5 of that plan apply verbatim: byte-identical generated regions, no digest moved, `data/decks.json` untouched, mutants replaced or re-pointed never deleted, unowned files untouched.

## 1. Goal

Players can fork any built-in deck into a custom deck, hide any built-in, restore all hidden built-ins, and every added custom deck takes chip position 1. State lives in `hpfc.hidden` and the existing `hpfc.scales.v3`.

## 2. Non-goals

No in-place edit of a built-in. No change to `data/decks.json`, `src/engine/`, `tools/`, committed PDFs or fixture digests. No new panel control rendered on a fresh store. No palette additions. No per-deck reset beyond hide/restore and delete.

## 3. Decision ledger (AFK: auto-pick the first option, record here)

| # | Decision | Options | AFK pick |
|---|---|---|---|
| ED-1 | Fork PDF overlay | accept engine `R`/`cy`/credit; copy `d.print` (engine lane, out of scope) | accept engine output |
| ED-2 | Fork name | prefill the built-in's name on the create path; auto-name until renamed | prefill |
| ED-3 | Amara 9 fork degrees | accept engine `ii°` on E; strip (engine change) | accept |
| ED-4 | All five hidden, no custom | refuse the fifth hide with a warn; allow and show the add sheet | refuse |
| ED-5 | Restore scope | clear all hidden; per-deck unhide list | clear all |
| ED-6 | Fallback when the stored deck is hidden | first visible of `allDecks()` with the existing "gone" warn; silent | first visible, warn |

## 4. Lanes

### Lane app (`claude/editable-defaults-app`, `.claude/worktrees/editable-defaults-app`)

**Goal.** Design 1 in the app block of `index.html` plus its unit tests and mutants.

**Owns.** `index.html` outside the engine regions and the `const DECKS` line; `tests/app.test.js`; `tests/mutants/*` whose target is the app block; `tests/suite_health.py` FLOORS row for `app.test.js` (CI count only).

**Candidates.** `save()` gains `hidden` (array of strings filtered to `isBuiltIn`, written only when non-empty). New `hiddenDecks()`, `visibleDecks()`. `allDecks()` = `[...Object.values(CUSTOM).reverse(), ...visibleDecks()]`. `deck()` filters hidden ids. `buildChips`: a selected built-in chip opens `openEditSheet(d, b)` in `builtin` mode; pencil glyph stays custom-only. `setSheetMode("builtin")`, `resetSheetState` prefill from `formatSeed(d.fields)` + anchor + name (ED-2). `deleteDeck` on a built-in: hide (ED-4, ED-6). `#deck-restore` after `#deck-add`, `hidden` unless `hiddenDecks().length`; in `panelStops()`. Boot tail warn covers hidden built-ins.

**Rules.** Tests first. No rename of any existing test. The two tests "the layout markup exists and a built-in deck is never editable" and "a selected custom chip carries a pencil; no built-in chip ever does" keep their titles; their assertions move to "no pencil glyph on built-ins; tapping a selected built-in opens the sheet in builtin mode". New tests assert through `app.run`/DOM, never a new bare name (keeps `app_surface_v1.json`). New mutants: `d_hidden_not_filtered`, `d_custom_not_first`, `d_restore_not_rendered`, `d_fork_not_prefilled`, `d_hide_fifth_allowed`, each with a `# kills:` title verbatim.

**Verify.** `node --test tests/app.test.js`; `python3 tools/inline_engine.py --check`; `python3 tools/sync_decks.py --check`; `python3 tools/validate.py`; `node tools/boot_sim.js`; `python3 tools/refresh_mutants.py --check`.

**Acceptance.** ED-A1 fresh store: chips in `DECKS` order, no restore button, `hpfc` keys unchanged. ED-A2 a generated deck is chip 1; a second is chip 1 and the first chip 2. ED-A3 hiding Amara 9 removes its chip, writes `hpfc.hidden = ["amara"]`, selects Kurd. ED-A4 hiding Kurd selects the first visible deck. ED-A5 the fifth hide with no custom deck is refused. ED-A6 a fork of each built-in has the id in `deck_ids_v1.json` and the built-in's name. ED-A7 restore clears `hidden`, deletes the key, re-renders five chips. ED-A8 all five new mutants killed; none survive.

**Depends on.** Nothing.

### Lane e2e (`claude/editable-defaults-e2e`, `.claude/worktrees/editable-defaults-e2e`)

**Goal.** Browser proof at 380px and the two re-pointed order tests.

**Owns.** `tests/e2e.test.js`; `tests/helpers/` e2e helpers; mutants whose `# kills:` names an e2e test; FLOORS row for `e2e.test.js`.

**Candidates.** Re-point "the replacement takes the old chip's position and keeps it across a reload" and "an options-only edit keeps its chip position across a reload at 380px" from `at = indexOf - 1` to index 0 (titles unchanged; `e_optedit_reappends` must still die). New: "a hidden built-in stays hidden across a reload at 380px"; "forking Pygmy at 380px makes chip 1 with the Pygmy name"; "SHOW HIDDEN DECKS is absent until a deck is hidden and restores all five".

**Rules.** Run single e2e tests locally only (`CHROME_BIN`; the full suite starves the browser). CI at the head SHA is the oracle. `panel-fit` must be unchanged: no e2e fixture hides a deck before the probe runs.

**Verify.** `node --test --test-name-pattern "<title>" tests/e2e.test.js` per new test; CI `e2e` and `panel fit` jobs.

**Acceptance.** ED-A9 the three new tests green in CI. ED-A10 the two re-pointed tests green and `e_optedit_reappends`, `e_edit_forks_chip` still killed. ED-A11 panel-fit verdicts identical (real and fallback).

**Depends on.** Lane app merged (the tests fail red before it; merge order below).

### Lane docs (`claude/editable-defaults-docs`, `.claude/worktrees/editable-defaults-docs`)

**Goal.** Describe what shipped.

**Owns.** `README.md`, `CLAUDE.md`, `docs/plans/2026-10-09-editable-defaults.md` (close-out section only).

**Candidates.** README storage paragraph: `hpfc.hidden`. CLAUDE.md "Known pitfalls": default deck fallback when hidden; chips order (custom first, newest first) vs picker array order. README mutant count within `test_readme_currency`'s band from main's artifacts.

**Verify.** `python3 -m pytest tests/test_readme_currency.py tests/suite_health.py`.

**Acceptance.** ED-A12 both green at CI; counts from main's artifacts.

**Depends on.** Lanes app and e2e merged.

## 5. Standing merge gates (every lane)

1. CI green at a head SHA verified against the local tip (`gh pr view <n> --json state,headRefOid`).
2. Independent reviewer PASS or PASS_WITH_NITS at that SHA, briefed with this plan's lane text verbatim (no added rules).
3. `python3 tools/refresh_mutants.py --check` green; mutant count reconciled in the PR (added, replaced `old -> new`, re-pointed - each named).
4. `panel-fit` verdicts unchanged (real and fallback).
5. `inline_engine.py --check`, `sync_decks.py --check`, `validate.py`, `boot_sim.js` green; no fixture digest moved; `data/decks.json` untouched.
6. FLOORS rows moved only as section 4 allows, only to CI's count for the branch; README counts within `test_readme_currency`'s band.
7. Rebase procedure of the house format (§20.24 of the drawer plan): fetch + rebase; both `--check`s; `refresh_mutants.py` committed on its own; own FLOORS rows + README counts from main's artifacts; push and wait for CI.

## 6. Order of merges and why

1. **app** - the behaviour; its unit tests and mutants land with it so main never reddens.
2. **e2e** - after app, because its re-pointed order tests are red against the old `allDecks()` (test-first inside the lane; merge after the code).
3. **docs** - describes what shipped; counts from main's artifacts once.

## 9. Lane table

| Lane | Branch | Worktree | Gate |
|---|---|---|---|
| app | `claude/editable-defaults-app` | `.claude/worktrees/editable-defaults-app` | ED-A1..A8 |
| e2e | `claude/editable-defaults-e2e` | `.claude/worktrees/editable-defaults-e2e` | ED-A9..A11 |
| docs | `claude/editable-defaults-docs` | `.claude/worktrees/editable-defaults-docs` | ED-A12 |

Every lane: worktree isolation, tests first, independent reviewer at the verified head SHA, CI is the evidence. Review worktrees take no `node_modules` (this repo needs none).
