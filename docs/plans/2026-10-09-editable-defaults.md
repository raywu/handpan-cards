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

Custom decks: unchanged (`deleteDeck` -> `forgetScale` -> `selectDeck(DEFAULT_DECK)`). Built-ins: hide as in section 1. The fallback chain in `deck()` gains a visibility filter so a stored `hpfc.deck` naming a hidden built-in resolves to the first visible deck, with the existing "That deck is gone" `say` extended to built-in ids. Tests to re-point, not delete: `tests/e2e.test.js` "the replacement takes the old chip's position and keeps it across a reload" and "an options-only edit keeps its chip position across a reload at 380px" both compute `at = indexOf(selected) - 1` on the assumption that custom decks come last; under position 1 the custom chip is index 0 and `at` is -1. Both keep their titles (mutant headers name them) and are re-pointed (this draft said index 0; R3 in section 3 supersedes that: the OLDER custom, index 1, and nine sites in all); `e_optedit_reappends` (kills the options-only test) keeps killing under the new assertion because re-appending still moves the chip. `tests/app.test.js` "a field edit replaces the deck and the new one takes the old chip position" is position-relative and holds. "a selected custom chip carries a pencil; no built-in chip ever does" and "the layout markup exists and a built-in deck is never editable" change meaning: a selected built-in chip now opens the sheet. Both are retitled only if the owner accepts a rename (the house rule forbids renames that orphan mutant headers), so the plan re-points `e_chip_pencil_on_builtins` and keeps the titles while changing the assertion to "a built-in chip carries no pencil glyph; tapping it opens the sheet in builtin mode" - the pencil glyph stays custom-only, which keeps the title truthful.

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

No in-place edit of a built-in. No change to `data/decks.json`, `src/engine/`, `tools/` (one exception, R5: the `ELEMENT_IDS` list in `tools/sandbox.js` gains `"deck-restore"`), committed PDFs or fixture digests. No new panel control rendered on a fresh store. No palette additions. No per-deck reset beyond hide/restore and delete.

## 3. Decision ledger (AFK: auto-pick the first option, record here)

| # | Decision | Options | AFK pick |
|---|---|---|---|
| ED-1 | Fork PDF overlay | accept engine `R`/`cy`/credit; copy `d.print` (engine lane, out of scope) | accept engine output |
| ED-2 | Fork name | prefill the built-in's name on the create path; auto-name until renamed | prefill |
| ED-3 | Amara 9 fork degrees | accept engine `ii°` on E; strip (engine change) | accept |
| ED-4 | All five hidden, no custom | refuse the fifth hide with a warn; allow and show the add sheet | refuse |
| ED-5 | Restore scope | clear all hidden; per-deck unhide list | clear all |
| ED-6 | Fallback when the stored deck is hidden | first visible of `allDecks()` with the existing "gone" warn; silent | first visible, warn |

Eng review decisions (2026-10-12, `/plan-eng-review`, recommended option auto-taken under the owner's 2026-10-12 instruction "take the AFK picks, straight to /swarm"; ED-1..ED-6 unchanged). Each row answers a verified outside-voice finding (section 7.6).

| # | Decision | Options | Pick |
|---|---|---|---|
| R1 | Forking a scale that already has a custom deck | refuse with the existing "Another deck already uses this scale." (the row-131 guard runs on the fork path); let the create path regenerate in place (today's ADD behaviour: a renamed, repaletted fork is silently reset) | refuse |
| R2 | Zero visible decks | one rule, `wouldEmpty(id)`: any hide OR custom delete that would leave `allDecks()` empty is refused with a warn, and one `fallbackDeck()` (Kurd if visible, else the first of `allDecks()`) serves `deleteDeck`, hide and the boot tail; keep ED-4's "fifth hide" wording and leave `deleteDeck` as is (deleting the last custom with five hidden empties the picker; a delete while Kurd is hidden stores `kurd`) | one rule (ED-4 and ED-6 are special cases of it) |
| R3 | Re-pointing the ten chip-order e2e sites | `at = indexOf(on[0]) + 1` (the OLDER custom, index 1, which in the three-custom options-only test is the MIDDLE one; `e_optedit_reappends` moves it to index 0, so the mutant still dies); the same `+ 1` on the third site, "an edit onto another deck's scale is refused at 380px and both chips stay", whose `indexOf("RAY'S PAN") - 1` (RAY'S PAN is the NEWEST custom, chip 0 under newest-first) also yields -1; and six tests select "the first custom deck" as `selectChipAt(chips.length - 2)` ("a refused SAVE onto another deck's scale does not move the pan", "disarming DELETE leaves a standing collision refusal up (queue row 91)", "an ordinary unarmed tap does not wipe a collision refusal (queue row 91 guard)", "flipping the mirror does not wipe a collision refusal (queue row 115)", "tapping a pan note does not wipe a collision refusal (queue row 115)", "editing the seed after a collision clears the refusal cleanly (queue row 116)"), which under newest-first lands on Hijaz, a built-in, and opens the sheet in builtin mode (the queue-row-116 test then asserts `primaries === 1` against a FORK THIS DECK button and fails); each becomes `selectChipAt(1)` (EDIT_SCALE, the older custom), and the `// EDIT_SCALE's chip: generated before COLLIDE_SCALE, so second-to-last.` comment is rewritten to say index 1; and the tenth site is `selectDeck(0, meta)` inside "a selected custom chip carries a pencil; no built-in chip ever does", which expects chip 0 to be Kurd (`meta` is `DECKS` order) and under newest-first clicks the selected custom chip, opening the sheet instead; that whole test body changes under this feature anyway (its built-in assertions become "no pencil glyph; tapping a selected built-in opens the sheet in builtin mode"), so lane app owns the entire test and re-points its two mutants, `e_chip_pencil_on_builtins` and `e_chip_aria_uses_full_name`, keeping the title; the built-in it selects is reached by the chip whose text is Kurd's name, never by index; index 0 (the newest custom is already last in storage, so re-appending leaves it at 0 and the mutant survives) | `+ 1` |
| R4 | Who re-points them | lane app owns those nine `at`/`selectChipAt` lines plus the whole pencil test and its two mutants in `tests/e2e.test.js` (CI runs e2e on every branch; with reversed order the old arithmetic yields -1 and the app PR cannot go green); lane e2e re-points after app merges (app PR red) | lane app |
| R5 | `#deck-restore` in the unit sandbox | lane app owns the one `ELEMENT_IDS` entry in `tools/sandbox.js` (`getElementById` throws on an unregistered id, so `app.run` cannot boot without it); keep the `tools/` non-goal (the app lane's own Verify cannot pass) | own the one line |
| R6 | Builtin-mode sheet state | a `builtinId` variable, set by `openEditSheet` in builtin mode and cleared where `editingId` is cleared; `delBtn.onclick` (`if (!editingId) return;`), the sheet tab stops (`editingId ? delBtn : null`) and `sheetRoute()` read `editingId \|\| builtinId`; reuse `editingId` for the built-in (breaks `editedDeck()`, which reads `CUSTOM[editingId]`, and `sheetOptions`' name/parent branch) | `builtinId` |

## 4. Lanes

### Lane app (`claude/editable-defaults-app`, `.claude/worktrees/editable-defaults-app`)

**Goal.** Design 1 in the app block of `index.html` plus its unit tests and mutants.

**Owns.** `index.html` outside the engine regions and the `const DECKS` line; `tests/app.test.js`; `tests/mutants/*` whose target is the app block; `tests/suite_health.py` FLOORS row for `app.test.js` (CI count only); the `ELEMENT_IDS` list in `tools/sandbox.js` (R5, one entry); in `tests/e2e.test.js` ONLY the two `at = ...indexOf(before.on[0]) - 1` lines of "the replacement takes the old chip's position and keeps it across a reload" and "an options-only edit keeps its chip position across a reload at 380px", the `selectChipAt(before.chips.indexOf("RAY'S PAN") - 1)` line of "an edit onto another deck's scale is refused at 380px and both chips stay", the six `selectChipAt(...chips.length - 2)` lines named in R3 (R3, R4), the `assert.ok(at ...)` message beside the first two, the trailing `// the FIRST custom deck` / `// the MIDDLE custom deck` comment on each, the `// EDIT_SCALE's chip: ... second-to-last.` comment line, and the ENTIRE body of "a selected custom chip carries a pencil; no built-in chip ever does" (title kept) together with the mutants `e_chip_pencil_on_builtins` and `e_chip_aria_uses_full_name` that name it; nothing else in that file and no other e2e mutant.

**Candidates.** `save()` gains `hidden` (array of strings filtered to `isBuiltIn`, written only when non-empty). New `hiddenDecks()`, `visibleDecks()`, `wouldEmpty(id)`, `fallbackDeck()` (R2). `allDecks()` = `[...Object.values(CUSTOM).reverse(), ...visibleDecks()]`. `deck()` filters hidden ids and falls back through `fallbackDeck()`. `buildChips`: a selected built-in chip opens `openEditSheet(d, b)` in `builtin` mode; pencil glyph stays custom-only. `setSheetMode("builtin")`; a `builtinId` state variable (R6) read by `delBtn.onclick`, the sheet tab stops and `sheetRoute()`; `resetSheetState` takes a builtin branch (built-ins carry no `options`, so it must not read `edit.options.*`) that prefills `scaleBox` from `formatSeed(d.fields)`, `anchor` from the deck, palette 0, mirror off, and `nameBox` from `d.name` (ED-2) with `sheetOptions` carrying `o.name` on the fork path. `runGenerate`'s taken guard runs on the fork path too, keyed on `builtinId` and written as its OWN line before the existing `if (!wasId) return null;` (never folded into it, so the removed line of `d_collision_fires_on_add.patch` still matches), and refuses when `CUSTOM[id]` exists (R1); the ADD path keeps its benign dedupe, so that mutant and "the collision refusal never fires on an options-only edit, a new scale, a re-save or ADD" stand unchanged. `deleteDeck`: on a built-in, hide; on a custom deck, unchanged except that both paths refuse through `wouldEmpty` and select through `fallbackDeck()` (ED-4, ED-6, R2). `#deck-restore` after `#deck-add`, `hidden` unless `hiddenDecks().length`; in `panelStops()`; `"deck-restore"` added to `ELEMENT_IDS` in `tools/sandbox.js`. Boot tail warn covers hidden built-ins. The two e2e `at` lines become `indexOf(before.on[0]) + 1` and the RAY'S PAN line `indexOf("RAY'S PAN") + 1`; the six `chips.length - 2` lines become `selectChipAt(1)`; the pencil test selects its built-in by Kurd's chip text and asserts the builtin-mode sheet (R3).

**Rules.** Tests first. No rename of any existing test. The two tests "the layout markup exists and a built-in deck is never editable" and "a selected custom chip carries a pencil; no built-in chip ever does" keep their titles; their assertions move to "no pencil glyph on built-ins; tapping a selected built-in opens the sheet in builtin mode". New tests assert through `app.run`/DOM, never a new bare name (keeps `app_surface_v1.json`). New mutants: `d_hidden_not_filtered`, `d_custom_not_first`, `d_restore_not_rendered`, `d_fork_not_prefilled`, `d_hide_fifth_allowed`, `d_fork_overwrites` (R1), `d_delete_last_visible` (R2), `d_builtin_hide_unwired` (R6: the `delBtn.onclick` early return ignores `builtinId`), each with a `# kills:` title verbatim. The sandbox change is the one `ELEMENT_IDS` entry and nothing else (learning sandbox-no-static-children: the sandbox never populates static markup children, so DOM-order assertions on the restore button are source-markup pins).

**Verify.** `node --test tests/app.test.js`; `python3 tools/inline_engine.py --check`; `python3 tools/sync_decks.py --check`; `python3 tools/validate.py`; `node tools/boot_sim.js`; `python3 tools/refresh_mutants.py --check`; the ten re-pointed e2e tests singly with `node --test --test-name-pattern "<title>" tests/e2e.test.js` (CI's `js suites` job is the oracle for the full file).

**Acceptance.** ED-A1 fresh store: chips in `DECKS` order, no restore button, `hpfc` keys unchanged. ED-A2 a generated deck is chip 1; a second is chip 1 and the first chip 2. ED-A3 hiding Amara 9 removes its chip, writes `hpfc.hidden = ["amara"]`, selects Kurd. ED-A4 hiding Kurd selects the first visible deck. ED-A5 the fifth hide with no custom deck is refused. ED-A6 a fork of each built-in has the id in `deck_ids_v1.json` and the built-in's name. ED-A7 restore clears `hidden`, deletes the key, re-renders five chips. ED-A8 all eight new mutants killed; none survive. ED-A13 forking a built-in twice is refused with "Another deck already uses this scale." and the first fork keeps its name and palette (R1). ED-A14 with five hidden and one custom, deleting the custom is refused and the chip stays; with Kurd hidden, deleting a custom selects and stores `fallbackDeck().id`, never `kurd` (R2). ED-A15 in builtin mode the HIDE button arms, confirms and hides through `delBtn.onclick`, and is a sheet tab stop; cancel (Back/Escape) clears `builtinId` (R6). ED-A16 the ten re-pointed e2e tests green in CI at the lane head and `e_optedit_reappends`, `e_edit_forks_chip`, `e_chip_pencil_on_builtins`, `e_chip_aria_uses_full_name` still killed (R3, R4).

**Depends on.** Nothing.

### Lane e2e (`claude/editable-defaults-e2e`, `.claude/worktrees/editable-defaults-e2e`)

**Goal.** Browser proof at 380px; the ten re-pointed order sites are lane app's.

**Owns.** `tests/e2e.test.js` except the nine order-dependent lines and the pencil test lane app re-points (R4); `tests/helpers/` e2e helpers; mutants whose `# kills:` names an e2e test, except `e_chip_pencil_on_builtins` and `e_chip_aria_uses_full_name` (lane app's); FLOORS row for `e2e.test.js`.

**Candidates.** New: "a hidden built-in stays hidden across a reload at 380px"; "forking Pygmy at 380px makes chip 1 with the Pygmy name"; "SHOW HIDDEN DECKS is absent until a deck is hidden and restores all five". (The ten chip-order re-points moved to lane app under R3/R4; this lane does not touch them.)

**Rules.** Run single e2e tests locally only (`CHROME_BIN`; the full suite starves the browser). CI at the head SHA is the oracle. `panel-fit` must be unchanged: no e2e fixture hides a deck before the probe runs.

**Verify.** `node --test --test-name-pattern "<title>" tests/e2e.test.js` per new test; CI `e2e` and `panel fit` jobs.

**Acceptance.** ED-A9 the three new tests green in CI. ED-A10 `e_optedit_reappends` and `e_edit_forks_chip` still killed at this lane's head (they are re-pointed by lane app under ED-A16; this lane only proves they stayed dead). ED-A11 panel-fit verdicts identical (real and fallback).

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

1. **app** - the behaviour; its unit tests, mutants, the sandbox id and the ten re-pointed e2e order sites land with it so neither the lane PR nor main ever reddens (R4: CI runs `tests/e2e.test.js` on every branch).
2. **e2e** - after app, because its new browser tests exercise behaviour that does not exist before app merges (test-first inside the lane; merge after the code).
3. **docs** - describes what shipped; counts from main's artifacts once.

## 9. Lane table

| Lane | Branch | Worktree | Gate |
|---|---|---|---|
| app | `claude/editable-defaults-app` | `.claude/worktrees/editable-defaults-app` | ED-A1..A8, A13..A16 |
| e2e | `claude/editable-defaults-e2e` | `.claude/worktrees/editable-defaults-e2e` | ED-A9..A11 |
| docs | `claude/editable-defaults-docs` | `.claude/worktrees/editable-defaults-docs` | ED-A12 |

Every lane: worktree isolation, tests first, independent reviewer at the verified head SHA, CI is the evidence. Review worktrees take no `node_modules` (this repo needs none).

## 7. Eng review (2026-10-12, `/plan-eng-review`, medium effort, against `f07943d` on main `3bae527`)

### 7.1 Scope challenge

1. Problem: players cannot edit, hide or reorder the five built-ins; the owner asked for fork, hide, restore and custom-first. 2. Simplest thing: fork-and-hide over the existing custom-deck machinery; Design 2 (overlay) was rejected in section A. 3. Removable: nothing; every candidate maps to one of the four owner asks or to a verified gap (R1..R6). 4. Files: `index.html` app block, `tests/app.test.js`, `tests/e2e.test.js`, `tests/mutants/*`, `tools/sandbox.js` (one line), `tests/suite_health.py`, `README.md`, `CLAUDE.md`: eight files, no new classes, no new module, so the complexity gate does not fire. 5. Existing: the sheet, `CUSTOM`, `save()`, `deleteDeck`, the arm/disarm delete, `fromGenerated` PDFs. 6. Data model: one `hidden` array of built-in ids in `hpfc`; no migration, absent on a fresh store. 7. Reversible: restore clears `hidden`; nothing destructive to committed data. No issues found.

### 7.2 Architecture

Registry stays two-sided (`DECKS` literal, `CUSTOM` object) and the only new state is `hidden` plus the transient `builtinId`. The one coupling worth naming: chip order is now `reverse(CUSTOM)` then `visibleDecks()`, while `hpfc.scales.v3` stays oldest-first and `replaceScale`/`replaceRegistered` keep positions. Nothing reads chip index from storage, so the reversal is a view concern inside `allDecks()` only (`const allDecks = () => [...DECKS, ...Object.values(CUSTOM)];` is the single site). `deck()`'s chain `CUSTOM[deckId] || DECKS.find(id) || DECKS.find(DEFAULT_DECK) || DECKS[0]` gains one filter and a `fallbackDeck()` tail; the "gone" warn in the boot tail already exists (`say("That deck is gone. Showing " + deck().name + ".", "warn")`). No issues found beyond R1..R6.

### 7.3 Code quality

Built-ins carry no `options`, so `resetSheetState`'s `edit.options.palette` reads must sit behind the builtin branch (lane candidate). `sheetOptions` sets `o.name` only inside `if (editingId)`; the fork path needs the same normalisation for the prefilled name (ED-2) without the `parent` read. `delBtn.onclick`'s comment block (queue row 86, N6) documents that a null `editingId` click is unreachable today; R6 makes it reachable in builtin mode, so that comment is rewritten by the lane, not left to contradict the code. No issues found beyond those.

### 7.4 Tests

Frameworks: `node --test` for `tests/app.test.js` (DOM sandbox `tools/sandbox.js`) and `tests/e2e.test.js` (CDP, `CHROME_BIN`, CI job `js suites`); `pytest` for `tests/suite_health.py` and `tests/test_readme_currency.py`; the mutation gate (`tests/mutants/*.patch`, 894 today, four CI shards). Codepaths traced: hide -> `save()` -> `allDecks()` -> `buildChips`; fork -> `openEditSheet(builtin)` -> `runGenerate` -> guard -> `rememberScale` -> `selectDeck`; restore -> `save()` -> `buildChips`; boot with a hidden stored deck -> `deck()` -> `fallbackDeck()` -> warn.

```
                           unit (app.test.js)   e2e (380px)        mutant
 hidden filtered/persisted     ★★★ ED-A3        ★★ reload test     d_hidden_not_filtered
 custom first, newest first    ★★★ ED-A2        ★★ fork Pygmy      d_custom_not_first
 restore button + clear        ★★★ ED-A7        ★★ SHOW HIDDEN     d_restore_not_rendered
 fork prefill (name, seed)     ★★★ ED-A6        [→E2E] fork Pygmy  d_fork_not_prefilled
 fifth hide refused            ★★★ ED-A5        -                  d_hide_fifth_allowed
 fork collision refused (R1)   ★★★ ED-A13       -                  d_fork_overwrites
 never-zero + fallback (R2)    ★★★ ED-A14       -                  d_delete_last_visible
 builtin HIDE wiring (R6)      ★★★ ED-A15       [GAP] tab stop     d_builtin_hide_unwired
 chip-order re-point (R3/R4)   -                ★★★ ED-A16         e_optedit_reappends, e_edit_forks_chip
 panel-fit unchanged           -                ★★★ CI probe       -
```

[GAP] the sheet tab-stop order with `delBtn` present in builtin mode is asserted in the unit sandbox only (the keydown handler is pure JS); no e2e test is added for it. REGRESSION RULE: the ten re-pointed order sites MUST target a custom chip by its position among customs (the older one, or the middle one in the options-only test; the pencil test reaches its built-in by chip text) (`+ 1`), because the newest custom is last in storage and `e_optedit_reappends` cannot move it; a lane that writes index 0 ships a surviving mutant. Test plan artifact: `~/.gstack/projects/raywu-handpan-cards/ray-claude-editable-defaults-plan-eng-review-test-plan-20261012-141824.md`.

### 7.5 Performance

`allDecks()` reverses a handful of entries per `buildChips`; `visibleDecks()` filters five. Nothing on a hot path; no issues found.

### 7.6 Outside voice (Codex, `gpt-6-astra`, read-only, completed)

Six findings, all verified against `index.html` at `f07943d` before acceptance:

1. Fork overwrites an existing custom deck: the guard reads `if (!wasId) return null;`, so the create path never vetoes, and `registerDeck` replaces in place. Section A's "forking a deck twice is refused" was false. Resolved: R1.
2. ED-4 leaves a reachable empty picker (hide five with one custom, delete the custom) and `deleteDeck` selects `DEFAULT_DECK` even when Kurd is hidden. Resolved: R2.
3. Re-pointing both order tests to index 0 lets `e_optedit_reappends` survive (the mutant forgets and re-appends; the newest record is already last). Resolved: R3.
4. Lane app cannot go green before lane e2e re-points the two `at` lines (`assert.ok(at >= 0)` fails at -1). Resolved: R4. Own review found a third site Codex missed: "an edit onto another deck's scale is refused at 380px and both chips stay" selects `indexOf("RAY'S PAN") - 1`, and RAY'S PAN is the newest custom, so it is -1 too; folded into R3/R4. The independent reviewer of PR #290 (FAIL at `c88b8e0`) found six more: the `chips.length - 2` sites, which select a built-in under newest-first; folded into R3/R4 as well. The second reviewer (FAIL at `fb7b782`) found the tenth, `selectDeck(0, meta)` in the pencil test; ten sites in all, and lane app owns that test outright.
5. `tools/sandbox.js` `getElementById` throws on an id missing from `ELEMENT_IDS`, so `#deck-restore` breaks `app.run` under the `tools/` non-goal. Resolved: R5.
6. Builtin mode with `editingId` null never reaches the hide branch (`if (!editingId) return;`) and the sheet tab stops drop `delBtn`. Resolved: R6.

Codex's recommendation was "revise before implementation"; the six R rows are that revision.

### 7.7 Failure modes

- Stored `hpfc.hidden` holds a custom or unknown id: `save()` filters to `isBuiltIn`, reads ignore unknown ids, the key is rewritten clean on the next save.
- `hidden` names every built-in and `hpfc.scales.v3` is empty or corrupt at boot: `restoreScales` rebuilds nothing, `allDecks()` is empty; `fallbackDeck()` returns `undefined`. Lane rule: `fallbackDeck()` ignores `hidden` when nothing is visible (it returns Kurd and the boot tail warns), so a corrupt store never blanks the page. This is the R2 rule's boot-time half and is covered by ED-A14's unit test.
- A share link opened while the matching built-in is hidden: share links carry seeds, never built-in ids; the generated deck is custom and visible.
- Storage denied (`throwOnStorage`): hide and restore change the session only, as every other `save()` already does.

### 7.8 Worktree parallelization

Lanes are sequential by dependency (app -> e2e -> docs); lane docs could start its README/CLAUDE.md prose in parallel but its counts come from main's artifacts after the two merges, so it runs last. No overlapping ownership after R4 and R5.

### 7.9 NOT in scope / what already exists

Not in scope: editing a built-in in place; palette additions (Kurd blue/brick and Amara 10 green/crimson stay out of `HPE.select.PALETTES`); copying `d.print` overlays onto forks (ED-1); per-deck unhide (ED-5); a "reset everything" control; any change to `data/decks.json`, `src/engine/`, fixtures or committed PDFs. Already exists and is reused untouched: the scale sheet, the arm/disarm delete, `rememberScale`/`replaceScale`/`forgetScale`, `fromGenerated` PDFs, the boot-tail "gone" warn, `panelStops()`, the `panel-fit` CI probe.

### 7.10 Implementation tasks

| # | Task | Lane | Depends on |
|---|---|---|---|
| T1 | Unit tests ED-A1..A8, A13..A15 (red) | app | - |
| T2 | `hidden` in `save()`; `hiddenDecks`, `visibleDecks`, `wouldEmpty`, `fallbackDeck`; `allDecks` reversal; `deck()` filter | app | T1 |
| T3 | Builtin sheet mode: `builtinId`, `setSheetMode("builtin")`, `resetSheetState` builtin branch, `sheetOptions` name on fork, `delBtn.onclick`, tab stops, `sheetRoute` | app | T2 |
| T4 | Fork collision guard on the create path (R1); `deleteDeck` hide/refuse/fallback (R2) | app | T3 |
| T5 | `#deck-restore` markup, CSS, `panelStops`, `ELEMENT_IDS` entry; boot tail warn | app | T2 |
| T6 | Re-point the ten e2e order sites (`+ 1`, `selectChipAt(1)`, the pencil test by chip text; R3/R4) | app | T2 |
| T7 | Eight mutants with verbatim `# kills:` titles; `refresh_mutants.py --check`; FLOORS row from CI | app | T1..T6 |
| T8 | Three new e2e tests at 380px | e2e | app merged |
| T9 | README storage paragraph, CLAUDE.md pitfalls, counts from main's artifacts | docs | app, e2e merged |

JSONL twin: `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-20261012-141824.jsonl`.

### 7.11 Completion summary

Six outside findings, six ledger rows, zero unresolved decisions. Lake Score 9/10: the plan now names every state variable, guard and fallback the code needs, and the one residual is the [GAP] in 7.4 (builtin tab-stop order proven in the sandbox only). Approval readiness: PASS.

## GSTACK REVIEW REPORT

| Review | Status | Notes |
|---|---|---|
| CEO | skipped | owner approved scope directly ("Go", 2026-10-12) |
| Outside voice | completed (Codex) | 6 findings, all verified, all resolved (R1..R6) |
| Eng | PASS | 2026-10-12, medium effort, sections 7.1-7.11 |
| Design | not run | no new visual family; one button reuses `.mode` |
| DX | not run | no developer-facing surface changes |

OUTSIDE COVERAGE: codex, completed, 6/6 findings resolved.

VERDICT: APPROVED FOR /swarm (lanes app -> e2e -> docs).

NO UNRESOLVED DECISIONS
