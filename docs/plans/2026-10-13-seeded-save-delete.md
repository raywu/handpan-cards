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
`seedOf` then stores it). Eng-review R1: that carry-back is APP-SIDE and
explicit. `HPE.select.build` writes `deck.options` from a fixed five-key
literal and `core.parseSeed` whitelists options, so `replaces` reaches neither
`seed.value.options` nor `built.value.options` on its own; `generateDeck`
reads it off its raw `options` argument exactly as it reads `seats`
(`if (options && typeof options.replaces === "string" && isBuiltIn(options.replaces))
built.value.options.replaces = options.replaces;`), which is also what makes
`restoreScales` (`generateDeck(canonical, recordOptions(rec))`) and
`replaceScale` keep it across a reload and a field edit. A `replaces` naming
no seed is dropped there, so a record from a build with other seeds degrades to
a plain custom deck. Eng-review R2: a replacement renders in its seed's slot
whether or not that seed id is also in `hidden` (`visibleDecks()` is computed
over DECKS first, then each entry is swapped; a swapped-in replacement is never
filtered by `hidden`). No code path writes both - SD-4 removes the record
before hiding the seed - so this only decides a hand-edited or cross-build
store, and it decides it the way `restoreScales` already does: never lose a
record. `allDecks()` becomes: custom decks newest first,
EXCLUDING replacements; then DECKS with each seed whose id some
`CUSTOM[*].options.replaces` names swapped for that replacement FIRST, and
the `hidden` filter applied AFTER the swap (`DECKS.map(swap).filter(d =>
!hidden.includes(d.id))`, so a replacement never carries a hidden id). `hidden`
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
all equal the prefill (and anchor and bottom mirror too, which the sheet
also edits - outside voice); the guard lives at the top of `runGenerate` (after the
`genBtn.disabled` return, before any label or readonly write) for
`isBuiltIn(editingId)` only, so custom decks keep today's path and the SAVE
button stays enabled and tappable on an unchanged seed (eng-review: a guard in
`syncParseState` runs per keystroke and could only disable the button, which
is not "close"). The prefill snapshot it compares against is taken in
`resetSheetState` (`seedPrefill = { s, name, palette, mirror, mirrorBottom,
anchor, parent, seats }`)
and cleared in `hideSheet`.

`editedDeck()` resolves a seed too (`CUSTOM[editingId] || (isBuiltIn(editingId)
? DECKS.find(...) : null)`), and the `kept` term in `sheetOptions()` becomes
`!!(d && ((d.options && d.options.name) || isBuiltIn(editingId)))`: the
prefilled seed name IS the deck's name, which is what today's `|| builtinId`
term did.

A changed SAVE: `runGenerate` with `wasId = null` semantics for the record
(create path, `rememberScale`), `options.replaces = editingId`, the create
collision guard re-keyed from `builtinId` to `isBuiltIn(editingId)`, then
`selectDeck(newId)`; `say` reads "Updated <name>" through a third term on
that line, `(replaced || known.has(d.id) || seeded)`, because a first seeded
SAVE has `wasId = null` and an id the create guard just proved absent from
`CUSTOM`, so neither existing term is true (outside voice).
A second SAVE on the replacement is an ordinary custom edit, but `replaces`
does NOT ride along by itself: `sheetOptions()` builds fresh options and
`generateDeck` reads `replaces` off its raw argument (R1). So `sheetOptions()`
adds `replaces: d.options.replaces` whenever `editedDeck()` carries one, and
`generateDeck` ALSO inherits it from the registry entry it is about to replace
in place (`options.replaces || (CUSTOM[id] && CUSTOM[id].options.replaces)`).
The second line is what keeps the association when ADD lands on the
replacement's own scale (`generateDeck`'s benign dedupe-by-id would otherwise
rewrite the entry and, through `rememberScale`'s rewrite-at-index, the
record, without `replaces`; Kurd would then reappear beside an ordinary
custom deck and RESET would leave it). A share link needs one more change:
`openShare` today persists the DECODED seed (`rememberScale(res.value)`),
whose options come through `core.parseSeed`'s whitelist and
`share.optionsLine`'s fixed field list and so can never carry `replaces`;
the inherit term would keep the in-memory entry right for one session while
the record at that index lost `replaces` on the next reload (PR #296
reviewer F1). So `openShare` persists the BUILT deck, `rememberScale(seedOf(
built.value))`, exactly as `runGenerate` does; `seedOf` reads
`built.value.options`, which already carries the inherited `replaces` -
outside voice and reviewer F1, SD-A18 and SD-A19.
Validity and uniqueness: a `replaces` naming no seed is dropped at
`generateDeck` and the deck is a plain custom (section A); when two records
name one seed the NEWEST takes the slot and the others render in the custom
tier as plain customs, so no record is ever unreachable - `replacements()`
is a seed-to-newest map and the custom tier excludes only its values (SD-A20).

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
close - the panel has NO pointerdown listener today and `closePanel()` disarms
nothing, so lane app adds a DOCUMENT-level pointerdown hook that disarms when
`e.target` is not `restoreBtn` (not a `settingsPanel` hook: on desktop the
panel is an always-visible sidebar, `closePanel()` returns early on
`!panelOpen`, and Safari and Firefox on macOS do not focus a button on click,
so neither a panel-close nor a `blur` path would ever run there - PR #296
reviewer F2; a document hook covers a card tap in every layout), a `blur`
handler on the button, and one
`disarmReset()` call in `closePanel()`; `disarmReset` is its own small function
beside `disarmDelete`, never a second branch inside it, because `disarmDelete`
re-derives SHEET state through `syncParseState`) clears `hidden`, drops every record with `o.replaces`, rebuilds
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
treats it as a plain custom deck - forward-compatible both ways for READING.
A SAVE in that old build rebuilds the record's options without `replaces`, so
a round trip through an older tab turns the replacement into a plain custom
deck and brings the seed back beside it. Nothing is lost but the association;
the README notes it in one sentence (outside voice, lane docs).

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
whichever of the ~39 patches mentioning `builtinId` / `openBuiltinSheet` /
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
- SD-A15 (eng-review R1) `replaces` survives `restoreScales`: a store holding
  one `replaces: "kurd"` record boots with that deck in Kurd's slot and no Kurd
  chip; mutant `d_replaces_not_carried` (drops the carry-back line in
  `generateDeck`) kills "SD: a replacement takes the seeded slot across a
  reload and a field edit" (the SD-A4 test, which asserts the slot AFTER a
  simulated reboot, not only after SAVE).
- SD-A16 (eng-review R2) a store with `hidden: ["kurd"]` AND a `replaces:
  "kurd"` record shows the replacement in Kurd's slot; test "SD: a replacement
  outranks a hidden seed in storage"; mutant `d_hidden_drops_replacement`.
- SD-A17 (eng-review R3, reviewer F2) RESET disarms on a pointerdown anywhere
  in the document outside the button (a card tap with the desktop sidebar
  open included), on blur, and on `closePanel()`, and a RESET tap after any
  of those arms again rather than firing; test "SD: an armed RESET disarms on
  a tap elsewhere, blur and panel close, and re-arms after" (the tap is
  dispatched on `main`, not inside the panel, with `panelOpen` false);
  mutant `d_reset_stays_armed`.
- SD-A18 (outside voice 1) a second SAVE on a replacement, options-only AND
  with a field edit, keeps `replaces` and the seeded slot across a simulated
  reboot; test "SD: re-saving a replacement keeps its seeded slot"; mutant
  `d_resave_drops_replaces` (drops the `replaces` term in `sheetOptions`).
- SD-A19 (outside voice 2) ADD of the replacement's own scale string, and
  `openShare` of a link for it, leave the record's `replaces` in place and
  Kurd's chip absent; test "SD: ADD and a share link onto a replacement keep
  it seeded", asserted AFTER a simulated reboot so the stored record is what
  is checked; two mutants: `d_dedupe_drops_replaces` (drops the
  registry-inherit term in `generateDeck`) and `d_share_persists_decoded`
  (reverts `openShare` to `rememberScale(res.value)`; reviewer F1).
- SD-A20 (outside voice 6) a store with two records naming `kurd` boots with
  the newer in Kurd's slot and the older in the custom tier, every record
  reachable; a record naming no seed is a plain custom; test "SD: duplicate
  and unknown replaces targets are never unreachable"; mutant
  `d_replacement_map_not_newest`.

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

---

# Engineering review (2026-10-13, /plan-eng-review, AFK)

Reviewed against main `5a9c7d7` in worktree
`.claude/worktrees/seeded-save-delete-plan`. Every anchor the plan names was
grepped and exists. The three amendments below are written INTO the plan body
above (section A, section B, section D, acceptance SD-A15..A17) so the lane
briefs quote corrected text; this appendix is the record of why.

## Scope challenge

1. **Smallest change that meets the goal?** Yes. S1 adds one record option
   and removes a whole sheet mode; S2 was rejected for a reason the review
   agrees with (`fromBuiltin` printing lost for everyone, five records in every
   store).
2. **What already exists?** `hidden`, `#deck-restore`, `deleteDeck`'s hidden
   branch, `replaceRegistered`, `replaceScale`, `recordOptions` pass-through,
   the arm-and-confirm pattern on `delBtn`, the Edit sheet. The plan reuses all
   of them and adds no blob key.
3. **Could it be a config/data change?** No; the behaviour lives in app JS.
4. **Reversible?** Yes. A `replaces` record read by an older build is a plain
   custom deck; `hidden` keeps its meaning both ways.
5. **TODOS.md overlap?** None of the three open items (DESIGN.md, iOS keyboard
   device check, scale-engine oracle tie-break, layout label shape) touches
   this work.
6. **Complexity gate.** Files: `index.html`, `tests/app.test.js`,
   `tests/e2e.test.js`, `tests/mutants/*` (eleven re-anchors plus ~eleven new
   patches), `tests/suite_health.py`, `README.md`, `CLAUDE.md`, possibly
   `tests/fixtures/app_surface_v1.json`. Seven to eight files, zero new
   classes, net code REMOVED in `index.html`. The gate is on the file count's
   edge but trips nothing: the breadth is the mutant harness, not design.
7. **Search check.** Skipped: the model is specific to this app's storage and
   there is no external prior art worth the call.

## 1. Architecture

**R1 (should-fix, amended in A).** The plan says `replaces` reaches
`built.value.options` "the way `generateDeck` already carries `name` and
`seats` back", then adds "no engine change; `seedOf` then stores it", which
reads as if the carry is free. It is not: `HPE.select.build` writes
`deck.options` from a fixed five-key literal (`src/engine/select.js`, the
`options:` block) and `core.parseSeed` whitelists options, so without one
explicit app-side line in `generateDeck` the option is dropped at SAVE, at
every boot (`restoreScales`) and at every field edit (`replaceScale`). Failure
scenario: SAVE on Kurd writes a record with `o.replaces`; reload; `generateDeck`
rebuilds the deck without it; `allDecks()` finds no replacement, so the deck
appears at position 1 AND Kurd's chip returns. SD-A4 as written ("survives a
reload") would catch it only if the test reboots the sandbox; SD-A15 pins the
line and the reboot.

**R2 (should-fix, amended in A).** `hidden` and `replaces` are independent
stores with no stated precedence. A store carrying both for one seed (hand
edit, or a future build that writes them in the other order) would show
NEITHER the seed nor the replacement, because the replacement is excluded from
the custom list and the seed is filtered before the swap. Amendment: the swap
runs over DECKS before the `hidden` filter, so the replacement always renders.
SD-A16.

**R3 (should-fix, amended in D).** The RESET disarm paths the plan lists do
not exist for the panel: `disarmDelete` hangs off a `pointerdown` listener on
`#scale-sheet` only, and `closePanel()` disarms nothing. Without new hooks an
armed RESET survives closing the panel and fires on the next single tap. The
amendment names the three hooks and keeps `disarmReset` separate from
`disarmDelete`, which re-derives sheet state through `syncParseState` and must
not run from the panel. SD-A17.

**R4 (nit, amended in B).** `editedDeck()` returns null for a seed, and the
plan retires the `|| builtinId` term in `sheetOptions()` without replacing
it, so a SAVE on a seed with an untouched name box would store no name and the
replacement would carry the engine's auto name instead of "D KURD 10". The
amendment keeps the seed's name through `isBuiltIn(editingId)`.

**R5 (nit, amended in B).** SD-3's guard was placed in `syncParseState`,
which runs per keystroke and can only enable or disable the button; "no-op
close" is a SAVE-time decision and belongs at the top of `runGenerate`.

Data flow after the amendments:

```
chip tap (selected, any deck)
  -> openEditSheet(d)  [editedDeck resolves CUSTOM or DECKS]
  -> SAVE: runGenerate
       unchanged seed? -> closeScaleSheet(), nothing written        (SD-3)
       changed:  generateDeck(text, {...sheetOptions, replaces})
                   -> built.value.options.replaces (app-side)       (R1)
                   -> collision guard isBuiltIn(editingId)          (R1 risk)
                   -> rememberScale(seedOf(d)) -> hpfc.scales.v3
  -> DELETE: deleteDeck(id)
       seed        -> hidden.push(id)
       replacement -> delete CUSTOM, forgetScale, hidden.push(replaces)  (SD-4)
       custom      -> unchanged
boot: restoreScales -> generateDeck(canonical, recordOptions) keeps replaces
chips: allDecks = custom\replacements (newest first) ++ DECKS.map(swap).filter(!hidden)  (R2)
RESET: arm -> confirm -> hidden=[]; drop o.replaces records; rebuild CUSTOM; save; buildChips
```

## 2. Code quality

- `replacements()` is one `Object.values(CUSTOM).filter(d => d.options &&
  d.options.replaces)`; compute it once per `buildChips`, not per chip.
- `isBuiltIn(editingId)` appears in four places after the rewrite (create
  guard, SD-3 guard, `kept`, `delNote` wording). One `const seeded = () =>
  isBuiltIn(editingId)` beside `editedDeck` keeps the reads uniform.
- The retired `HIDE_*` constants and the `"builtin"` string must leave the
  app block entirely (SD-A1 greps), including comments that quote them, or
  the grep gate reads a comment as a survivor.
- `delNote` copy for a replacement names RESET, for a pure custom deck "cannot
  be undone"; the branch key is `d.options && d.options.replaces`, not
  `isBuiltIn`, since a replacement is a custom deck.

## 3. Tests

Framework: `node --test` (unit sandbox + CDP e2e at 380px), python
`unittest`, mutation gate (`refresh_mutants.py --check` is the oracle, CI at the
head SHA is the evidence). Test plan artifact:
`~/.gstack/projects/raywu-handpan-cards/ray-claude-seeded-save-delete-plan-eng-review-test-plan-20261013T1640.md`.

```
sheet open on seed ........ ★★★ unit (retitled fork test)  ★★ e2e SD-A10
unchanged SAVE ............ ★★★ unit SD-A3                 [→E2E not needed]
changed SAVE + reload ..... ★★★ unit SD-A4 + SD-A15        ★★ e2e SD-A12
legacy-fork collision ..... ★★★ unit SD-A7 (R1)            ★★ existing e2e
DELETE seed ............... ★★★ unit (retitled)            ★★ e2e (retitled)
DELETE replacement ........ ★★★ unit SD-A5                 [→E2E deferred]
hidden+replaces store ..... ★★  unit SD-A16                [GAP e2e, accepted]
RESET arm/confirm/scope ... ★★★ unit SD-A6                 ★★★ e2e SD-A11
RESET disarm paths ........ ★★★ unit SD-A17                [GAP e2e, accepted]
pencil on any selected .... ★★  unit (retitled)            ★★★ e2e (retitled)
panel-fit ................. ★★★ CI oracle, both profiles
print of a replacement .... ★★  python render agreement    [GAP: no card changes]
```

REGRESSION RULE: every retitled test keeps its purpose; every `# kills:`
follows in the same commit; `refresh_mutants.py --check` must be green at the
lane head and the count reconciled in the PR body (gate 3).

## Outside voice (Codex, codex-cli 0.156.1, reviewing the amended plan)

Verdict FAIL on seven findings; every one is now in the plan body, so the
verdict is resolved rather than disputed:

| # | Codex finding | disposition |
|---|---|---|
| 1 | blocker: `replaces` does not ride along on a second SAVE (`sheetOptions` rebuilds options) | ACCEPTED - section B, SD-A18 |
| 2 | blocker: ADD or a share link onto the replacement's scale detaches it through dedupe-by-id | ACCEPTED - section B, SD-A19; the PR #296 reviewer (F1) then found the share path ALSO needs `openShare` to persist the built deck, now in section B with a second mutant |
| 3 | should-fix: unchanged-SAVE guard in the wrong lifecycle; equality list omits anchor and bottom mirror | ALREADY MOVED by R5; list extended |
| 4 | should-fix: RESET cancellation has no wiring | ALREADY R3; re-arm case added to SD-A17; the PR #296 reviewer (F2) moved the pointerdown hook from the panel to the document for the desktop sidebar |
| 5 | should-fix: "forward-compatible both ways" overstates an old-build SAVE | ACCEPTED - section E, one README sentence |
| 6 | should-fix: unknown or duplicate `replaces` targets undefined | ACCEPTED - section B, SD-A20 |
| 7 | should-fix: "Updated" message cannot come from `known.has` on a first seeded SAVE | ACCEPTED - section B, third term |

Findings 1 and 2 were real blockers the first pass missed: R1 fixed the carry
into `built.value.options` but not the two paths that rebuild the options
from scratch. Cross-model agreement after amendment: Codex's seven, my five,
no finding on either side left open.

## 4. Performance

`allDecks()` runs on every `buildChips`, `wouldEmpty` and `fallbackDeck`
call. The swap adds one pass over CUSTOM (a handful of entries) and one over
the five seeds. No measurable cost; no per-keystroke path touches it.

## Decision ledger (review)

| id | finding | options | AFK pick | state |
|---|---|---|---|---|
| D1 | No design doc; /office-hours offered by the skill | A run it / B skip | B: the plan is a removal inside an existing design | recorded |
| D2 | R1 `replaces` carry-back | A app-side line in `generateDeck` like `seats` (recommended, completeness 10) / B engine change to `select.build` (9, touches the engine corpus fixture and the Stop conditions) | A | recorded |
| D3 | R2 hidden + replaces precedence | A replacement renders regardless of `hidden` (recommended, 10: never loses a record) / B drop the record at boot (6) | A | recorded |
| D4 | R3 RESET disarm | A three explicit hooks, own `disarmReset` (recommended, 10) / B reuse `disarmDelete` (5: re-derives sheet state from the panel) | A | recorded |
| D5 | Next step | A revise / B loop / C ready to implement (recommended) | C | recorded |

R4 and R5 are corrections with no viable alternative and were written into the
plan without a brief. The gstack upgrade prompt (1.87.6.0 to 1.91.96.0) was
skipped under AFK, as were two /office-hours offers.

## NOT in scope

Everything under "Non-goals", plus: a seventh palette pair for Kurd and
Amara 10 (engine bound), export/import, syncing `replaces` into share links,
any change to `data/decks.json` or the print overlay.

## What already exists

`hidden` / `hiddenDecks` / `visibleDecks` / `wouldEmpty` / `fallbackDeck`,
`replaceRegistered`, `rememberScale` / `replaceScale` / `forgetScale`,
`recordOptions` and `restoreScales` pass-through, the `delBtn` arm pattern,
`#deck-restore` in `ELEMENT_IDS` and `panelStops()`, `ADD_ROUTE` /
`EDIT_ROUTE`, the 15 `editable defaults:` tests and their mutants.

## Failure modes

| mode | effect | guard |
|---|---|---|
| `replaces` dropped on rebuild | duplicate chip, seed returns | SD-A15 |
| `replaces` dropped on re-save, ADD or share | seed returns beside a custom | SD-A18, SD-A19 |
| duplicate `replaces` targets | a record unreachable | SD-A20 |
| seed hidden and replaced | deck vanishes | SD-A16 |
| RESET armed across panel close | one-tap destructive reset | SD-A17 |
| legacy fork holds the minted id | silent overwrite | R1 refusal, SD-A7 |
| RESET label wraps at 380px | panel-fit verdict moves | gate 4 |
| stale mutants | gate 3 red | `refresh_mutants.py --check` |

## Worktree parallelization

Serial by design: lane e2e adds tests against lane app's merged behaviour and
lane docs describes both. No lane pair can run concurrently without one of
them building against the wrong world.

## Implementation tasks

1. Lane app (A): sheet unification, `replaces` carry-back, `allDecks` swap,
   RESET arm/confirm/disarm, SD-3 guard, retitles, re-anchors, new mutants,
   SD-A1..A9 + A15..A20.
2. Lane e2e (B, after 1): SD-A10..A13.
3. Lane docs (C, after 2): SD-A14.

JSONL: `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-20261013T1640.jsonl`.

## Unresolved decisions

None.

## Completion summary

Three should-fix findings (R1 carry-back, R2 precedence, R3 disarm hooks) and
two nits (R4 name, R5 guard location), plus seven Codex findings (two
blockers: re-save and ADD/share detachment), all written into the plan body
with acceptance rows SD-A15..A20. Verdict SMALL stands. Ready to implement.

## GSTACK REVIEW REPORT

| Section | Findings | Fixed in plan | Decisions | Tests added | Status |
|---|---|---|---|---|---|
| Scope challenge | 0 | - | - | - | SMALL stands |
| Architecture | R1, R2, R3 | yes | D2, D3, D4 | SD-A15..A17 | resolved |
| Code quality | R4, R5 | yes | - | - | resolved |
| Tests | coverage map, artifact | yes | - | - | resolved |
| Performance | 0 | - | - | - | none |
| Outside voice | 7 (2 blockers) | yes | - | SD-A18..A20 | resolved |
| PR #296 reviewer | F1 openShare persists the decoded seed, F2 desktop disarm gap, N1..N3 | yes | - | SD-A17, SD-A19 second mutant | resolved |

OUTSIDE COVERAGE: Codex reviewed the amended plan with the verified code facts; FAIL on seven findings, all folded in.
CROSS-MODEL: fourteen findings in all (five own, seven Codex, two from the PR reviewer) plus three nits, all resolved in the plan body, none disputed.
VERDICT: READY TO IMPLEMENT. Lanes app, e2e, docs, serial.

NO UNRESOLVED DECISIONS
