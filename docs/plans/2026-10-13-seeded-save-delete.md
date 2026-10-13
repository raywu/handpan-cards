# Seeded decks: SAVE / DELETE, not FORK / HIDE

Written 2026-10-13 against main `5a9c7d7`, from
`2026-10-13-seeded-save-delete-prompt.md` plus eight reviewer corrections.
Anchors are function and marker names, never line numbers.

**VERDICT: SMALL.**

**Recommended design.** Every deck opens the ONE Edit sheet (SAVE CHANGES /
DELETE THIS DECK); a changed SAVE on a seeded deck writes an ordinary
`hpfc.scales.v3` record carrying one new record option, `replaces: "<seeded
id>"`, and that custom deck takes the seed's chip slot while the seed stays in
`DECKS` untouched. DELETE on a seeded deck pushes its id into the existing
`hidden` field; RESET SEEDED DECKS (the `#deck-restore` button, re-labelled,
arm-and-confirm) clears `hidden` and drops every `replaces` record, leaving the
player's own scales alone.

## Goal

Owner, verbatim: "Let's remove the fork this deck and hide this deck paradigm
for seeded scale. Give seeded deck the same treatment as custom decks: save this
deck or delete. This is a simpler model for both the user and our system design.
We should give users a way to reset to restore all seeded models - with a
warning that all their edits will be gone." And: "I do want a visible edit cue
like custom decks do on all the chips."

The create path keeps the owner's position-1 rule verbatim: "if a user adds a
custom scales, it should be position 1 in the scale list."

## Non-goals

- No in-place edit of `DECKS`; the seeded objects and `data/decks.json` are
  never written, and `const DECKS` is not re-synced.
- No `print` overlay editing; a replacement prints through
  `HPE.pdfdeck.fromGenerated` like every custom deck.
- No palette additions to the engine: a seventh pair touches
  `core.readOptions`'s `palette <= 5` bound and the palette-count tests in
  `tests/app.test.js` and `tests/preview.test.js`, so it is not one line.
- No sync between browsers, no export/import; `replaces` never enters a share
  link (`share.optionsLine` writes a fixed field list).
- No change to the create path's position-1 rule.
- No new `hpfc` blob key; the one new thing is a RECORD option.

## Retired

`openBuiltinSheet`, `builtinId`, `setSheetMode`'s `"builtin"` branch,
`resetSheetState`'s `fork` argument, `HIDE_IDLE`, `HIDE_ARMED`, the hide
wording in `delNote`, `layoutNoticeText`'s "FORK THIS DECK keeps it.", and the
`editingId || builtinId` reads in `sheetOptions()`, `sheetRoute()` and the
three Tab stops. `runGenerate`'s create guard and `deleteDeck`'s hidden branch
are re-keyed on `isBuiltIn(editingId)`.

## A. Where the edited seed lives

**S1 - replacement record (recommended).** A changed SAVE on seeded `X` runs
the normal `runGenerate` create path with `options.replaces = X.id` carried onto
`built.value.options` the way `generateDeck` already carries `name` and
`seats` back (core's `readOptions` ignores unknown keys, so no engine change;
`seedOf` then stores it). `allDecks()` becomes: custom decks newest first,
EXCLUDING replacements; then `visibleDecks()` with each seed whose id some
`CUSTOM[*].options.replaces` names swapped for that replacement. `hidden`
keeps its meaning (seeds the player deleted). Nothing in storage changes for
anyone who never touches a seed. Size: ~90 app lines (+ ~40 removed), human
1.5 d / CC 3 h for lane app.

**S2 - materialise all five as records at first boot.** Five records in every
store, `DECKS` a seed source only, `fromBuiltin` printing lost for everyone on
day one, a seeded tier in `restoreScales`, `hidden` migrated into record
deletions. ~250 lines, fixture churn, human 4 d / CC 1.5 d. Rejected.

**What a replacement loses versus its seed** (correction 4). Kurd and Amara 10
keep R/cy (69.8/124 both ways); Amara 9 and Hijaz go 73/126 -> 69.8/124, Pygmy
60/121 -> 50.6/124. The credit line differs on all five (`fromGenerated`
upper-cases the deck name: "D KURD 10" for "D KURD 10 / D MINOR"). Title and
blurb are full-variant only and never reach the UI. Degrees: only Amara 9's
generated map adds `"4":"ii°"`, and no Amara 9 card roots on E, so no card
changes. Colours: Hijaz, Pygmy and Amara 9 are `PALETTES` 0, 1, 2 and prefill
exactly; Kurd (`#2563B0/#C0452C`) and Amara 10 (`#3B7A2A/#B3263A`) have no
pair, prefill 0, and the preview shows the pair before SAVE (SD-6).

**SD-2 chip position of a replacement:** (a) the seeded slot (recommended -
the player edited "the Kurd deck", not added one; position 1 stays reserved for
the create path); (b) position 1 like a new deck. AFK pick: (a).

## B. SAVE on a seeded deck

The sheet opens via `openEditSheet(d, chip)` for every selected chip;
`resetSheetState(edit)` loses its `fork` argument. Prefill: `nameBox` =
`d.name`; `scaleBox` = `HPE.core.formatSeed(d.fields)`; palette = the index
whose pair equals `d.colors` (0/1/2 for Hijaz/Pygmy/Amara 9) else 0; mirror
false; degree row SHOWN with `HPE.naming.inferParent` of the fields (today's
`"builtin"` mode hid it); anchor `fields["1"][4] !== 270 ? "between" : "one"`
as today's fork options; the layout drawer opens on the generated seats, which
the solver proves equal to the stored diagram for every built-in (CLAUDE.md,
"Generated layouts").

**SD-3 unchanged SAVE:** (a) no-op close (recommended: no record is written
so `fromBuiltin` printing and the stored palette are kept, and nothing is
"updated"); (b) today's custom behaviour (regenerate, say "Updated X"). AFK
pick: (a). "Unchanged" = seed string, name, palette, mirror, parent and seats
all equal the prefill; `syncParseState` gains that one guard for
`isBuiltIn(editingId)` only, so custom decks keep today's path.

A changed SAVE: `runGenerate` with `wasId = null` semantics for the record
(create path, `rememberScale`), `options.replaces = editingId`, the create
collision guard re-keyed from `builtinId` to `isBuiltIn(editingId)`, then
`selectDeck(newId)`; `say` reads "Updated <name>" (the `known.has` branch).
A second SAVE on the replacement is an ordinary custom edit: `replaces` rides
along on `d.options`, so `replaceScale` keeps it and the slot.

## C. DELETE

`deleteDeck(id)` keeps its shape. Custom: unchanged (`delete CUSTOM[id]`,
`forgetScale`). Seeded: `hidden.push(id)` as today, wording "Removed X.
Showing Y." (the `builtin ? "Hidden "` fork goes). `wouldEmpty` and
`fallbackDeck` stay. **SD-4 deleting a replacement:** (a) stays gone - the
record goes AND the seed it replaced is added to `hidden` (recommended; "delete"
must not resurrect a deck the player already changed away from); (b) the seed
returns. AFK pick: (a). `delNote` reads "Tap again to remove X. RESET SEEDED
DECKS in the menu brings the seeded decks back." for seeds and replacements,
"This cannot be undone." for pure custom decks.

## D. RESET

Same element, `#deck-restore` (`tools/sandbox.js` `ELEMENT_IDS` already
carries it; `panelStops()` unchanged). Label `RESET SEEDED DECKS`, armed
`TAP AGAIN TO RESET`, `data-armed` like `delBtn`; first tap arms and `say`s
"Tap again to restore all seeded decks. Your edits to them will be gone."
(warn); the second tap (disarm on pointerdown outside the button, blur, panel
close) clears `hidden`, drops every record with `o.replaces`, rebuilds
`CUSTOM`, `save()`, `buildChips()`, selects `fallbackDeck()` if the current
deck is gone, says "Seeded decks restored." (or "... Showing Y."), focus to
`#deck-add` as today. Unhidden only while `hiddenDecks().length ||
replacements().length`, so a fresh store's panel is byte-identical and the
`panel-fit` verdicts hold. **SD-5 scope:** (a) seeded edits and deletions only
(recommended - "all their edits" is edits TO seeded decks; destroying a
player's own scales is irreversible and not asked for); (b) everything custom
too. AFK pick: (a). README keeps the sentence that clearing site data brings
every seeded deck back.

## E. Migration

None runs. A live `hidden` array keeps its meaning. A shipped-feature fork
(`custom:cb5fe66a` etc.) is an ordinary custom deck: no `replaces`, position
unchanged, RESET leaves it. `restoreScales` already passes unknown record
options through `recordOptions`, so an old build reading a `replaces` record
treats it as a plain custom deck - forward-compatible both ways.

## F. Risk register

| # | Risk | Proof |
|---|---|---|
| R1 | A player holding a shipped-feature fork of seeded Kurd already owns `custom:cb5fe66a`, the exact id a palette-only or options-only SAVE on seeded Kurd mints. SAVE REFUSES with today's "Another deck already uses this scale." through the re-keyed create guard, writes nothing, so neither `rememberScale`'s collapse nor `restoreScales`'s `seen` dedupe ever meets two records. | `editable defaults: saving seeded Kurd with only a palette change while its fork holds the id is refused` (rewrite of today's "forking twice" test); mutant `d_fork_overwrites` re-pointed. |
| R2 | A replacement whose fields are later edited keeps `replaces`; if that edit lands on a seed's own id (e.g. editing the Kurd replacement back to Kurd's string) the id equals the fork id, not `kurd`, so no clash with `DECKS`. | SD-A4. |
| R3 | `allDecks()` feeds every chip-index test; swapping seeds in place moves no custom index, but the pencil test reaches Kurd by `nth-child`. | suites at the lane head; 8.3 audit. |
| R4 | The RESET label wraps at 380px or landscape and moves the `panel-fit` verdict; labels stay at 18 characters. | gate 4, both profiles. |
| R5 | `fromBuiltin` printing is lost on a changed SAVE only. | `test_render_agreement` untouched; SD-A3. |
| R6 | Mutants naming retired code go `stale` in `refresh_mutants.py --check`. | gate 3. |
| R7 | `sheetRoute()` and the Tab stops simplify to `editingId`; `#edit-kurd` must still route. | retitled DELETE-arms test; `d_page_edit_route_generic` unchanged. |
| R8 | No new `hpfc` blob key. | the hijaz-store key pin test, unchanged. |

## Test and mutant inventory (what the old model pins)

**`tests/app.test.js`, the fifteen `editable defaults:` tests.** Keep as is:
fresh store; generated deck is chip 1 (`d_custom_not_first`); five hidden ->
last custom cannot be deleted (`d_delete_last_visible`); deleting custom with
Kurd hidden selects amara10; stored hidden deck falls back with the gone
warning; every built-in hidden still opens a deck; `hpfc.hidden` keeps only
built-in ids; `#deck-restore` follows `#deck-add`. Retitle and re-point (same
purpose, new copy): "hiding a built-in removes its chip, stores hidden and
selects Kurd" -> "deleting a seeded deck removes its chip, stores hidden and
selects Kurd" (`d_hidden_not_filtered`, `d_restore_not_rendered`); "hiding the
selected Kurd..." -> "deleting the selected Kurd selects the first visible
deck"; "the fifth hide with no custom deck is refused" -> "the fifth seeded
delete..." (`d_hide_fifth_allowed`); "forking each built-in keeps its id from
the fixture and its name" -> "saving each seeded deck with a palette change
mints the fixture id as its replacement in the seeded slot" (asserts SAVE
CHANGES / DELETE THIS DECK, title "Edit this scale", prefilled palette 0/1/2/0/0,
degree row shown; `d_fork_not_prefilled`); "restoring clears hidden" -> "RESET
arms, then clears hidden and replacements and keeps custom decks"; "forking a
built-in twice is refused" -> R1's title (`d_fork_overwrites`); "builtin mode
HIDE arms..." -> "a seeded deck's DELETE arms with TAP AGAIN TO DELETE, is a
Tab stop, and Back clears it" (`d_builtin_hide_unwired`). Also "the layout
markup exists and a built-in deck is never editable" -> "the layout markup
exists and only the selected chip of any deck opens the sheet" (SD-1).

**`tests/e2e.test.js`.** "a selected custom chip carries a pencil; no
built-in chip ever does" -> "the selected chip carries a pencil on every deck;
no unselected chip does" (`e_chip_pencil_on_builtins`,
`e_chip_aria_uses_full_name` re-pointed, patch re-anchored to drop the
`d.id === deckId` term of `editable`); "a hidden built-in stays hidden across a
reload at 380px" -> "a deleted seeded deck stays gone across a reload at 380px"
(`e_hidden_not_restored_on_boot`; helper `hideSelectedBuiltin` ->
`deleteSelectedSeeded`, same clicks); "forking Pygmy at 380px makes chip 1
with the Pygmy name" -> "saving Pygmy with a palette change at 380px replaces
its chip in place with the Pygmy name" (`e_fork_drops_name`); "SHOW HIDDEN
DECKS is absent until a deck is hidden and restores all five" -> "RESET SEEDED
DECKS is absent until a seeded deck is edited or deleted, arms, and restores
all five" (`e_restore_not_panel_stop`). Unaffected: the four re-pointed
selected-Kurd-tap tests, "tapping the pencil opens the Edit sheet", the field
edit and collision tests (`e_edit_forks_chip` anchors `runGenerate` context
only). `d_page_close_reruns_hide` kills a generic `closeScaleSheet` test and
is not a fork-model mutant.

**Mutants expected `stale` at the lane head:** the eleven named above, plus
whichever of the 43 patches mentioning `builtinId` / `openBuiltinSheet` /
`HIDE_*` / `restoreBtn` / `hiddenDecks` / `wouldEmpty` / `fallbackDeck`
`refresh_mutants.py --check` reports (it is the oracle, not the list). Each is
re-anchored, never re-targeted; filenames stay.

**SD-1 visible edit cue:** (a) the selected chip of ANY deck carries the
pencil and `aria-label "Edit <name>"` (recommended: the pencil marks "tapping
this opens the sheet", which is now true of every selected chip and of no
unselected chip, so the glyph keeps one meaning; (b) would put a pencil on a
chip whose tap SELECTS, breaking the glyph-tap test); (b) every chip. AFK pick:
(a). `editable = d.id === deckId`.

## Decision ledger

| id | question | recommended / AFK pick |
|---|---|---|
| SD-1 | pencil scope | (a) selected chip of any deck |
| SD-2 | replacement chip position | (a) seeded slot |
| SD-3 | unchanged SAVE on a seed | (a) no-op close |
| SD-4 | deleting a replacement | (a) stays gone; seed joins `hidden` |
| SD-5 | RESET scope | (a) seeded edits and deletions only |
| SD-6 | Kurd / Amara 10 colours on SAVE | (a) prefill palette 0, preview shows it; no engine change |
| SD-7 | `#deck-restore` visibility | (a) only while something is resettable |

Estimates, whole workstream: human 3 days; CC 6 hours wall plus CI waits.

---

## Lanes (/swarm)

Worktrees `.claude/worktrees/seeded-save-delete-<lane>`, branches
`claude/seeded-save-delete-<lane>`, base main `5a9c7d7`. Merge order: app,
e2e, docs; each later lane rebases on the merged earlier one (gate 7).

### Ownership rule (editable-defaults 8.3, verbatim)

Lane app owns, in EVERY test file, EVERY EXISTING test that its behaviour changes (B1..B5) redden or whose purpose they defeat, found by two steps rather than by a list: (1) running the suites at the lane head, and (2) because a green test on the wrong path never fails (the five collision tests), auditing every existing test whose setup selects a chip by index or `chips.length` arithmetic, taps a chip that is already on, scrolls the strip before reading `.chip.on`, or reads `sheetState().primaries` (R9). Bounds: no test is renamed or deleted (so every `# kills:` and `# suite:` header stays true verbatim); every mutant whose `# kills:` names a touched test must still die (the mutant may be re-anchored, never re-targeted to another test); a touched test keeps its purpose (its assertions move to the new behaviour, as the pencil test already does; the five collision tests keep testing the EDIT path by selecting the older custom); the lane report carries a base-to-head inventory of every touched test (title, file:line, what moved, the mutants that name it), which the reviewer verifies against the diff. Lane app ALSO owns every existing MUTANT, whatever its target, that its source changes invalidate (`refresh_mutants.py --check` red at the lane head because the removed-lines run no longer exists verbatim): the run is rewritten against the lane head so the mutant demonstrates the same defect and still dies (R7; `e_panel_moved_into_header` is the known one). Lane e2e owns only the NEW tests it adds plus the new mutants that name them. R3 and R4 stay as the known list, now a FLOOR of what lane app touches, not a boundary; section 8.2 is the current floor (seventeen tests, two files) and ED-A17 the mutant floor.

Amendment for this workstream (prompt requirement 2 overrides the "no test is
renamed" bound): the tests named in the inventory above ARE retitled, never
deleted; every `# kills:` header follows its new title in the same commit, and
no mutant is deleted. "B1..B5", "R9", "section 8.2" and "ED-A17" refer to the
editable-defaults plan; here the floor is the inventory above.

### Lane app

Owns: `index.html` (app block only; never an engine region or the `DECKS`
line); `tests/app.test.js` (touched tests + new app tests); `tests/e2e.test.js`
EXISTING tests the inventory names; `tests/mutants/*` existing re-anchors and
new `d_*` mutants; `tests/suite_health.py` the `app.test.js` row;
`tests/fixtures/app_surface_v1.json` if a surface name moves. Reads only:
`src/engine/*`, `tools/*`, `data/decks.json`, `README.md`, `CLAUDE.md`.

Acceptance:
- SD-A1 no `builtinId`, `openBuiltinSheet`, `HIDE_IDLE`, `HIDE_ARMED`,
  `"builtin"` branch of `setSheetMode`, "FORK THIS DECK" or "SHOW HIDDEN DECKS"
  in the app block (`grep -c` each = 0); mutant `d_seeded_sheet_keeps_fork_copy`
  kills "editable defaults: saving each seeded deck with a palette change mints
  the fixture id as its replacement in the seeded slot".
- SD-A2 `layoutNoticeText` on a seeded deck reads "Layout not saved yet. SAVE
  CHANGES keeps it."; mutant `d_layout_notice_fork_copy` kills "SD: the layout
  notice on a seeded deck names SAVE CHANGES".
- SD-A3 unchanged SAVE on a seed writes no record and closes; mutant
  `d_unchanged_save_writes_record` kills "SD: saving a seeded deck unchanged
  closes the sheet and writes nothing".
- SD-A4 a replacement sits in the seeded slot, survives a reload, and a field
  edit on it keeps the slot; mutant `d_replacement_appended` kills "SD: a
  replacement takes the seeded slot across a reload and a field edit".
- SD-A5 deleting a replacement hides its seed; mutant
  `d_replacement_delete_revives_seed` kills "SD: deleting a replacement does
  not bring the seed back".
- SD-A6 RESET first tap arms only, second clears `hidden` and `replaces`
  records, keeps pure custom decks, says the message, focuses `#deck-add`;
  mutants `d_reset_skips_arm` and `d_reset_drops_custom` kill "editable
  defaults: RESET arms, then clears hidden and replacements and keeps custom
  decks".
- SD-A7 R1 refusal test green, `d_fork_overwrites` re-anchored and killing.
- SD-A8 `python3 tools/refresh_mutants.py --check` green; every retitled test's
  `# kills:` updated; count reconciled in the PR body (added, re-pointed, each
  named; nothing replaced or deleted).
- SD-A9 `panel-fit` verdicts unchanged, real and fallback.

Verify: `./tests/run.sh`; `python3 tools/refresh_mutants.py --check`;
`./tests/mutation_check.sh` for the named mutants; `node tools/boot_sim.js`;
`python3 tools/validate.py`; `python3 tools/inline_engine.py --check`;
`python3 tools/sync_decks.py --check`; `node tools/probe/panel_fit.js`.

Stop conditions: any change needed in `src/engine/`, `tools/`,
`data/decks.json`, a fixture digest, or a second `hpfc` key or record option;
`test_render_agreement` red; a touched test losing its purpose.

### Lane e2e (after app merges)

Owns: `tests/e2e.test.js` NEW tests only; new `e_*` mutants;
`tests/suite_health.py` the `e2e.test.js` row. Reads only: everything else.

Acceptance:
- SD-A10 "SD: the selected seeded chip's pencil opens the sheet with SAVE
  CHANGES at 380px"; mutant `e_seeded_pencil_opens_nothing`.
- SD-A11 "SD: RESET arms, then restores all five at 380px and focuses
  #deck-add"; mutant `e_reset_without_confirm`.
- SD-A12 "SD: a replacement chip sits where its seed sat at 380px, selected
  and with a pencil"; mutant `e_replacement_chip_first`.
- SD-A13 `refresh_mutants.py --check` green; FLOORS e2e row set from CI's
  count for the branch.

Verify: `node --test tests/e2e.test.js` (single tests locally; CI is the
oracle); `./tests/mutation_check.sh` for the three mutants.

Stop conditions: any edit to an existing test or to `index.html`.

### Lane docs (after e2e merges)

Owns: `README.md`, `CLAUDE.md`, this file's status line. Reads only: all else.
Rewrites README "Use it": the sentences "Tapping a built-in deck's chip when
that deck is already selected opens the same sheet with FORK THIS DECK ... and
HIDE THIS DECK.", the `hidden` sentence, and "... and so does SHOW HIDDEN DECKS
in the settings panel, without clearing anything." to the SAVE / DELETE /
RESET model; rewrites the two 2026-10-12 CLAUDE.md pitfall bullets (hidden
default deck; chip order) for `replaces` and the seeded slot; removes nothing
from plan history. README mutant count from main's CI artifacts only
(`test_readme_currency` band). SD-A14: `python3 -m unittest
tests.test_readme_currency`; `grep -c "FORK THIS DECK\|SHOW HIDDEN DECKS"
README.md CLAUDE.md` = 0 outside `docs/plans/`.

### Standing gates (refactor-pass-4 section 5, verbatim)

1. CI green at a head SHA verified against the local tip (`gh pr view <n> --json state,headRefOid`).
2. Independent reviewer PASS or PASS_WITH_NITS at that SHA, briefed with this plan's lane text verbatim (no added rules).
3. `python3 tools/refresh_mutants.py --check` green; mutant count reconciled in the PR (added, replaced `old -> new`, re-pointed - each named).
4. `panel-fit` verdicts unchanged (real and fallback).
5. `inline_engine.py --check`, `sync_decks.py --check`, `validate.py`, `boot_sim.js` green; no fixture digest moved; `data/decks.json` untouched.
6. FLOORS rows moved only as section 4 allows, only to CI's count for the branch; README counts within `test_readme_currency`'s band.
7. Rebase procedure of the house format (§20.24 of the drawer plan): fetch + rebase; both `--check`s; `refresh_mutants.py` committed on its own; own FLOORS rows + README counts from main's artifacts; push and wait for CI.
