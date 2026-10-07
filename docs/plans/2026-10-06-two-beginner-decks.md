# Two beginner decks: D Kurd 10 and D Amara 10

Status: DRAFT, revision 4. Nothing in this plan is executed yet.
Revision 4 folds in the second eng review (F1 to F7, AD7; disposition table at
the end) and the owner's round 4 decisions (D12 to D16). It adds a lane the
reviewers have not seen (Lane U, cap removal), so **a third
`/plan-eng-review` is required before any lane starts.** Section 17 lists
what is unverified. Section 19 lists the open owner questions; OQ-U1 blocks
Lane U2.

Base: `main` at `e25f3f2` (E1). Drafted 2026-10-06, revised the same day.

Every claim about current behaviour cites an entry in the Evidence appendix
(E1, E2, ...). A claim that was not run is marked UNVERIFIED where it stands.
Anchors are function names, test names and markers. There are no line numbers.

## 1. Goal

Add two engine-generated built-in decks and list them as the first two options
in the deck picker:

1. D Kurd 10: `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5`
2. D Amara 10: `(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5`

"10" counts the ding. Both are top-shell only. A new visitor's first boot
opens D Kurd 10. Two engine changes come with them:

- The layout solver draws a centred ding, lowest rim note at bottom centre,
  whenever the seed has no inner notes (D12, D13, D14, D15).
- The deck size cap is removed for every scale (D16). Kurd ships 49 cards,
  Amara 10 ships 29, and Amara 9 grows from 25 to 27.

## 2. Owner decisions (2026-10-06, binding)

Quoted as picked. None is reopened by this plan.

Round 1:

- (a) D Amara 9 against the new ten-note Amara: "keep both". Round 4 (D16)
  later changes Amara 9's card count; nothing else about it changes.
- (b) "yes default cold start boot to D Kurd 10, but remember what the user
  last selects between sessions."

Round 2:

| # | Question | Answer as picked | Closes |
|---|---|---|---|
| D1 | Visitors who already hold a stored `hijaz` | "New visitors only" | OQ7 |
| D2 | Second deck's display name and sub-line | "D AMARA 10", sub-line "9 + 1" | OQ3 |
| D3 | Deck order | D Kurd 10, D Amara 10, then "Amara 9, Hijaz, Pygmy" | OQ1 |
| D4 | Note layout hand | "Left first" zig-zag for both pans. Superseded in its application by D12 | OQ5 |
| D5 | Colours | "As proposed": Kurd blue `#2563B0` / brick `#C0452C`; Amara 10 green `#3B7A2A` / crimson `#B3263A` | OQ2 |
| D6 | Committed print PDFs for the new decks | "No". The six existing PDFs stay | OQ4 |
| D7 | Deck strip that no longer fits | "Accept scrolling" | OQ8 |

Round 3:

| # | Question | Answer as picked | Closes |
|---|---|---|---|
| D8 | Layout of the new pans | "Engine should default to original Amara layout and only shift if there are too many upper pan notes" | F5. The threshold is settled by D15 |
| D9 | No-shrink tests on the new decks | "Test the old three only" | OQ6 |
| D10 | The E degree label | "Keep ii° on Amara 10" | OQ12 |
| D11 | Kurd sub-line | "9 + 1" | OQ3 |

Round 4:

| # | Question | Answer as picked | Closes |
|---|---|---|---|
| D12 | Which side the numbers run on | "The sequence direction for the notes should be the same as Amara 9" | corrects the reading of D4 |
| D13 | Where a nine-note rim starts | "let's go with 1 in the middle (bottom center)" | OQ-L2 |
| D14 | Saved and shared custom decks with an odd rim count | "Keep their sides" | reviewer F2, OQ-L3; AD14 is now an owner decision |
| D15 | When the ding shifts off centre | "Only with inner notes" | OQ-L1 (R1) |
| D16 | The 25-card cap | "do all custom scale cap at 25? let's remove that cap", then "Everywhere" | OQ9 |

Planner's readings of round 4 (not the owner's words):

- **D12 and D13 together.** Both new pans draw: ding centred; 1 at 270, 2 at
  230, 3 at 310, 4 at 190, 5 at 350, 6 at 150, 7 at 30, 8 at 110, 9 at 70.
  Even numbers sit on the left, as on Amara 9. Nothing sits at top centre.
  The earlier reading of D4 put note 1's neighbour on the left, which put the
  ODD numbers on the left. That reading was wrong.
- **D14.** For an odd rim count the new bottom-anchored sequence, UNMIRRORED,
  runs 270, 230, 310, 190, 350, ... (second note to the left). Mirrored is
  its reflection. So a stored custom deck keeps each note on the side it has
  today. Even counts do not change at all. Consequence: the two new decks are
  generated WITHOUT `--mirror`, while Amara 9's own angles are what `--mirror`
  gives on an even count. The mirror toggle therefore means opposite hands on
  odd and even rims. That polarity split exists on `main` today. This plan
  documents it and does not fix it.
- **D15.** The ding takes today's offset (Pygmy-style) position only when the
  seed has inner notes, whether written after a `/` or spilled positionally
  (top notes 12 and 13, `docs/ENGINE-SPEC.md` section 4). Otherwise it is
  centred. This replaces the reading of D8 in revision 3.
- **D16.** The option the owner picked read: Kurd ships 49 cards, Amara 10
  ships 29, custom scales uncapped, "Amara 9 gains Cadd9 and C6/9 (27 cards).
  Pygmy would likely grow too; I have not measured it. Hijaz is unaffected
  (19 either way). This changes shipped deck data." Measured since: Amara 9's
  two new cards are **Fadd9 and Cadd9**, not Cadd9 and C6/9 (C6/9 already
  ships). The count, 27, is as stated. Pygmy is the subject of OQ-U1, because
  "Everywhere" cannot be applied to it by regeneration (6.10).
  `ALTERNATE_CAP` was not discussed and is left alone.

D8 and D16 authorise engine changes. Neither authorises hand-written
geometry or a hand-written voicing.

What D1 removes: the `dv` marker, the migration, its three tests and its two
mutants. The release-window concern (a visitor moved off a deliberate Hijaz
choice) no longer exists, because no stored value is ever rewritten.

## 3. Non-goals

- No change to the data or geometry of Hijaz. No change to Pygmy unless the
  owner answers OQ-U1 with option B. Amara 9 gains exactly two cards (D16);
  its other 25 cards, its `geom`, `fields`, `degrees`, `colors` and `print`
  keys stay byte-identical.
- No hand-written voicing, degree label or geometry number. Deck data comes
  from `tools/gen_deck.js`.
- No engine change other than the layout default in Lane E and the cap
  removal in Lane U. `rank`, `ALTERNATE_CAP`, the chord engine, naming,
  sequence and share modules stay byte-identical.
- No fix of the mirror toggle's odd/even polarity (D14).
- No migration of stored deck ids. No `dv` key.
- No new committed PDF. The six PDF jobs stay six. Two of the six (the Amara
  9 pair) are rebuilt in Lane U because their deck grows.
- No picker, header or panel CSS change.
- No audio, stats, spaced repetition or PWA work.
- No new dependency, no build step, no `<script src>`.
- No cross-tab sync of the selected deck.
- No sequence goldens, no `print_decks_v1.json` rows and no Amy progression
  rerun for the NEW decks (coverage gaps, section 16). The existing goldens
  are regenerated for Amara 9 in Lane U.
- No replacement bound on custom deck size (OQ-U2 asks whether one is
  wanted).
- No detection of a custom deck that duplicates a built-in (OQ10).

## 4. Binding constraints, quoted from CLAUDE.md

- "**Single-file app.** No bundlers, no frameworks, no external JS."
- "**The `const DECKS` line in `index.html` is GENERATED** from
  `data/decks.json` by `python3 tools/sync_decks.py`. Never hand-edit it".
- "**The engine regions in `index.html` are GENERATED.**" Change the module,
  then run `python3 tools/inline_engine.py`.
- "**Do not alter deck data or diagram geometry** without explicit owner
  instruction."
- "**Preserve the visual system** (fonts, palettes, card anatomy below)."
- "If deck data changes: edit `data/decks.json` - the ONE canonical copy - then
  run `python3 tools/sync_decks.py` to re-inject it into `index.html`, and
  `python3 tools/decks.py` to rebuild the PDFs."
- "Then run `python3 tools/regen_data_mutants.py` on a clean tree: the data
  mutants anchor on the DECKS line and go stale on every data change."
- "Test at 380px viewport."
- "The no-shrink baseline is the PRE-RULE `f_*`, per renderer".

## 5. Arithmetic (stated once, reused everywhere)

Measured in a scratch worktree with the Lane E prototype and the cap removed
(E29, E31). "Capped" is `main` today.

| Deck (picker order) | id | Capped cards / names | Uncapped cards / names | Ships |
|---|---|---|---|---|
| D Kurd 10 | `kurd` | 25 / 25 | 49 / 49 | **49** |
| D Amara 10 | `amara10` | 26 / 25 | 29 / 27 | **29** |
| D Amara 9 | `amara` | 25 / 25 | 27 / 27 | **27** |
| C# Hijaz 9 | `hijaz` | 19 / 19 | 19 / 19 | **19** |
| F3 Low Pygmy 18 | `pygmy` | 52 / 31 | 53 / 32 | **52** (OQ-U1 option A) or 53 (option B) |

Totals. Three decks today 19 + 52 + 25 = **96**. After Lane U2: 19 + 52 + 27
= **98**. After Lane B: 49 + 29 + 27 + 19 + 52 = **176** over **5** decks.
If the owner picks OQ-U1 option B every total is one higher (99 and 177).
Committed PDFs stay at **6** (D6). The Amara 9 pair goes from 3 sheets to 4
(27 chord cards).

Power-chord cards: UNVERIFIED for the uncapped decks. Revision 3's figure
(19 to 30) was measured on capped data. Lane B sets
`test_power_chords_are_root_and_fifth`'s count from the adopted data.

Mutant corpus, by lane (E1 for the start):

| After | Count | Change |
|---|---|---|
| `main` today | 682 | |
| Lane A | 682 | re-cuts and refreshes only |
| Lane E | 685 | +3: `g_centred_default_ignored`, `g_bottom_anchor_dropped`, `g_bottom_anchor_side_flipped` |
| Lane U1 | 681 | -5: `s_cap_slope`, `s_cap_flat`, `s_cap_removed`, `s_cap_hinge`, `s_cap_widened`. +1: `s_trim_reintroduced` |
| Lane U2 | 681 | data mutants regenerated, none added |
| Lane B | 683 | +2: `b_adopted_deck_drifts`, `b_picker_order_swapped` |
| Lane C | 684 | +1: `d_default_deck_hijaz` |

The counts are plans. The README figure and `FLOORS` are set from CI
artifacts, never from this table. `FLOORS` in `tests/suite_health.py` holds
TEST counts per test file, not mutant counts. Lane U1 deletes four tests
from `tests/select.test.js` and adds one, so that row drops by three there.

## 6. Findings

### 6.1 Engine output

Capped output is in E2. Uncapped output is in E31. Chords and degrees do not
depend on the layout (E26, E29).

| | D Kurd 10 | D Amara 10 |
|---|---|---|
| Cards, uncapped | 49 | 29 |
| Distinct chord names, uncapped | 49 | 27 |
| Parent scale | Aeolian (`parent: 1`) | Aeolian (`parent: 1`) |
| Degrees | D i, E ii°, F III, G iv, A v, Bb VI, C VII | D i, E ii°, F III, G iv, A v, C VII |
| Warnings | none | none |
| Two runs byte-identical | yes, capped (E2); uncapped rerun not repeated | same |
| Name the engine gives with no `--name` | `D AEOLIAN 10` (E14) | `D AEOLIAN 10` |

- **What the cap was (F8).** `cap(fields)` in `src/engine/select.js` returns
  `25 + max(0, fieldCount - 12)`. `trimToNames(list, limit)` keeps the first
  `limit` distinct chord NAMES in rank order; a second voicing of a kept name
  rides free. `build` calls both. D16 removes both calls. `rank` stays: it
  still gives group contiguity and home-first order.
- **Kurd, uncapped: the capped 25 cards are all kept, in the same relative
  order, and 24 are added** (uncapped position in brackets): Dmadd9 (6), Dm9
  (7), Dm11 (8), Fmaj7 (15), Fadd9 (16), F6/9 (17), Fmaj9 (18), Gm7 (23),
  Gmadd9 (24), Gm6/9 (25), Gm9 (26), Gm11 (27), Am7 (32), Bbmaj7 (35),
  Bbadd9 (36), Bb6/9 (37), Bbmaj9 (38), Bbmaj7#11 (39), C7 (44), Cadd9 (45),
  C6/9 (46), C9 (47), C11 (48), C13 (49). This closes OQ9.
- **Amara 10, uncapped: three cards added.** Fadd9 `[5,7,8,6]` (12), Cadd9
  `[2,4,6,3]` (26), Cadd9 `[8,4,6,9]` HIGH VOICING (27).
- **Amara 10 carries `E: ii°` with no card rooted on E.** D10 keeps it.
  Shipped Amara 9 has no E entry (E3) and stays that way.
- **The engine names both pans `D AEOLIAN 10`.** The built-in names come from
  D2 and are passed with `--name`. One exact name per deck is used everywhere
  in this plan: `D KURD 10` and `D AMARA 10`.
- **The engine has no palette for a new built-in.** Palette index 0 to 5 is
  the three shipped pairs and their swaps. The colours come from D5.

### 6.2 D Amara 10 against shipped D Amara 9

- A fresh capped engine run of `(D3) A3 C4 D4 E4 F4 G4 A4 C5` reproduces the
  shipped 25 Amara chords exactly (E3). Uncapped it gives 27: the same 25,
  byte-identical in `fields`, `roots` and `subtitle` and in the same relative
  order, plus Fadd9 `[5,7,8,6]` at position 12 and Cadd9 `[2,4,6,3]` at
  position 26 (E31). The additions are interleaved, not appended.
- The engine's `degrees` for that string include `E: ii°`; shipped Amara 9
  has none (E3). So Amara 9 is updated by INSERTING the two cards into the
  shipped entry, not by replacing the entry with engine output.
- Field ids 1 to 8 carry the same notes on both pans. Amara 10 adds field 9,
  D5.
- **22 of Amara 9's 25 capped cards are byte-identical to an Amara 10 card**
  (E23). The three that differ, because D5 now exists: F6/9 is `[5,7,8,9,6]`
  on Amara 10 and `[5,1,2,3,6]` on Amara 9; G5 is `[6,9]` against `[6,3]`;
  Gsus4 is `[6,8,9]` against `[6,2,3]`. Uncapped, Fadd9 `[5,7,8,6]` and Cadd9
  `[2,4,6,3]` are on both pans too. This is what makes mutant anchors
  ambiguous (6.8); the count of shared cards on the uncapped data is
  UNVERIFIED and Lane B re-derives it.
- Under Lane E both pans have a centred ding and `r_ding` 0.2. Amara 9 has
  eight rim fields at 45 degree steps. Amara 10 has nine at 40 degree steps
  (6.6).

### 6.3 Sites that hard-code three decks, 96, 19/52/25, order or ids

**How enumerated.** Two ways. (1) Grep counts per file (E18). (2) Empirically:
both decks were added to a scratch worktree in the decided order and the
whole Python suite plus thirteen Node unit suites were run, three times (E22,
E27). The empirical list is the one to trust. **Not covered:** the full
`tests/e2e.test.js` and `tests/harness.test.js`. Seven e2e tests were run by
name on the earlier order (E11) and not rerun on the decided order.

Sites that break:

| Site | Anchor | What it hard-codes | Evidence |
|---|---|---|---|
| `tools/validate.py` | `PY = {...}` | three ids; check 1b fails on `'kurd'` | E22 |
| `tools/decks.py` | `HIJAZ`, `PYGMY`, `AMARA` | three constants. `__main__` builds six named jobs and does not iterate the data file, so it needs no change | E24 |
| `tests/test_deck_data.py` | `LAYOUTS`, `CHORD_COUNTS`, `DEGREES`, `test_deck_inventory`, `test_power_chords_are_root_and_fifth` | ids, 96, 19 power chords | E7, E22 |
| `tests/test_render_agreement.py` | `DECK_BY_ID`, `test_every_card_is_compared`, `test_neither_renderer_draws_smaller_than_it_did_before_the_rule` | three ids, 96, no-shrink | E22 |
| `tests/test_print.py` | `ALL_DECKS`, `test_no_label_is_smaller_than_what_either_renderer_drew_before` | three decks, no-shrink | E22 |
| `tests/test_fixture_integrity.py` | `FIXTURE`, `EXPECTED_SHA256`, `BUMP`, `test_shape_and_card_counts`, module docstring ("96-card corpus (v5)") | golden v5 holds three decks | E7, E25 |
| `tests/test_readme_currency.py` | `test_every_deck_is_named_with_its_own_chord_count`, `test_total_card_count_matches_the_deck_data` | README text | E7 |
| `tests/test_pdf_parity.py` | `BUILTINS`, the literal id set in `test_the_sweep_covers_every_builtin_and_both_variants` | three ids | E22 |
| `tests/app.test.js` | "every rendered face is well-formed markup (96 cards x 2 modes)" | 96 | E22 |
| `tests/app.test.js` | "the card render still matches the committed digest of every built-in card" | `pan_render_v1.json` covers three ids | E22 |
| `tests/app.test.js` | "every built-in card face still matches the committed digest of card_face_v1.json" | fixture rows per id | E22 |
| `tests/app.test.js` | "the built-in decks keep the derived extent they have always rendered" | built-in geom must have no `ext` key | E9 |
| `tests/app.test.js` | "a non-string stored deck id is ignored and never eats a share link" | expects `DECKS[0].id` | E22 |
| `tests/layout.test.js` | `labelShape()` | reads `DECKS[0]`, asserts no `ding_dy`; crashes the whole file | E22 |
| `tests/pdf_builtin.test.js` | "every voicing field and every root field survives, for all 96 cards", three `["hijaz","pygmy","amara"]` loops | ids, 96; passes, does not cover new decks | E22 |
| `tests/e2e.test.js` | "the landscape deck strip scrolls rather than clips, at both ends" | its last block asserts the strip FITS with one custom deck added (three built-ins + 1) | E11 |
| `tests/e2e.test.js` | "boots with the first deck loaded"; "buttons and arrow keys step through the deck and wrap"; "arrow keys and Enter/Space do not reach the card while the settings panel is open"; "only the face that is showing is exposed, and the counter is a live region"; "in landscape every control stays tappable and the card fits, at every size and state" | each reads `meta[0]` as "the deck the app booted". After Lane B `meta[0]` is Kurd and the booted deck is Hijaz (reviewer F1) | read, not run |
| `tests/e2e.test.js` | "six custom decks keep the chip row on one line with the active chip in view" | `3 + 6` chips | not run |
| `tests/e2e.test.js` | "deleting the selected deck falls back to a built-in with a visible message" | "the fallback is not the FIRST built-in" | not run |
| `tests/mutants/` | 11 `b_*` patches and `c_deck_data_drift.patch` | context is the whole DECKS line | E22 |
| `tools/regen_data_mutants.py` | `MUTANTS` | 11 entries, two with ambiguous anchors after the change (6.8) | E23 |
| `tools/pdf_build.js` | header comment "one of the three shipped decks" | prose | E18 |
| `index.html` | comment "the three built-ins on one line" near `deck()` | stale prose (F9) | read |
| `README.md` | "Decks included", "96 cards total", mutant count | prose pinned by tests | E18 |
| `CLAUDE.md` | "three specific handpans", "Decks:", "all 96 cards", degrees bullet | prose | E18 |
| `tests/CONTRACT.md` | two mentions of 96 | prose | not read |
| `docs/ENGINE-SPEC.md` | "three built-in maker strings"; the ding and rim layout decisions | prose. `tests/core.test.js` "the three built-in maker strings parse to the golden fields" reads `golden_decks_v3.json`, which this plan does not touch | E9, not read in detail |

Sites that do NOT change for the new decks because of D6: `tests/paths.py`
(`PDFS`, six keys), `tests/test_pdf_build.py` `JOBS`, `tools/decks.py`
`__main__`, README "the six committed PDFs", CLAUDE.md "builds all six PDFs".
`tests/test_font_subset.py` loops over the three shipped constants and is
not extended (section 16). Lane U does change the Amara 9 page count in
`test_all_six_pdfs_build_with_the_expected_page_counts` and the literals in
`tests/test_gen_deck.py` (6.10).

Tests that read a deck by POSITION and silently change subject (F9). They pass
with five decks but stop testing what they name:

| Test | File | Reads | Fix (Lane A) |
|---|---|---|---|
| "the hit layer is emitted after everything it sits over" | `tests/app.test.js` | `pan(DECKS[0], null, {interactive:true})` | pick Hijaz by id |
| "a note name cannot break out of the hit target's attributes" | `tests/app.test.js` | a clone of `DECKS[0]` | pick Hijaz by id |
| `labelShape()` | `tests/layout.test.js` | `DECKS[0]` | pick Hijaz by id |
| `selectDeck(i, meta)` helper and the `DECKS[${i}]` loop in "card lines and diagram stay inside the card at 380px" | `tests/e2e.test.js` | chip position | no change: they iterate every position, so they gain coverage |
| the five `meta[0]` readers named above | `tests/e2e.test.js` | array position 0 as "the booted deck" | Lane A adds a helper `bootMeta(meta)` that returns the entry whose id is the page's `DEFAULT_DECK`, and the five tests read it (reviewer F1, AD7) |

Sites that read by id and need no change for the NEW decks (Lane U changes
several of them for the cap, 6.10): `tests/sequence.test.js`,
`tests/voicing.test.js`, `tests/naming.test.js`, `tests/select.test.js`,
`PrintDeckSnapshotTest`, the `findIndex(m => m.id === "pygmy")` in "two taps
on FULL DECK PDF queued together build the PDF once".

Order and identity sites in the app:

| Site | Anchor | Fact |
|---|---|---|
| Cold-start default | `let deckId = typeof store.deck === "string" ? store.deck : "hijaz";` | a literal id |
| Unknown-id fallback | `const deck = () => CUSTOM[deckId] \|\| DECKS.find(...) \|\| DECKS[0];` | array position 0 |
| Fallback after deleting a custom deck | `deleteDeck` calls `selectDeck(DECKS[0].id)` | array position 0 |
| Picker order | `allDecks()` then `buildChips()` | array order of `DECKS` |

Order and default are two facts in code that tests treat as one. The plan
keeps them separable: order stays data, the default becomes one named
constant, and the fallbacks follow the constant.

### 6.4 What breaks on the decided order (rerun)

These runs used CAPPED decks (25 and 26 cards, 147 in total) generated with
`--mirror`. They were not repeated on the uncapped, unmirrored data of
revision 4. The list of sites is what carries over; the counts (147, the
failure tallies) do not, and Lane B re-derives them. UNVERIFIED on the
revision 4 data.

Order `kurd, amara10, amara, hijaz, pygmy`, today's solver, `--mirror`, no
other change (E22):

- `python3 tools/sync_decks.py` succeeds. `node tools/boot_sim.js` prints
  `count = 1 / 19` and "exercised 147 cards x 2 modes". The app still boots
  Hijaz.
- Python, tools and tests untouched: 223 tests, 7 failures, 17 errors.
- Python, with `KURD`, `AMARA10`, `PY`, `DECK_BY_ID`, `ALL_DECKS`, `BUILTINS`
  extended: 223 tests, 27 failures, 4 errors. `tools/validate.py` prints "all
  checks passed (147 cards)". PDF parity passes for both new decks with no
  committed PDF.
- Node: `app` 282 tests, 4 fail. `layout` crashes in `labelShape`.
  `mutation_harness` 53 tests, 2 fail, listing exactly the 12 DECKS-line
  patches. `core`, `naming`, `select`, `share`, `preview`, `pdf`, `pdfcards`,
  `pdf_builtin`, `sequence`, `voicing` all pass.
- Storage is by deck id, not index. No stored value points at a different
  deck after the reorder (E4).

The same runs on data generated by the Lane E prototype give the same Python
result and one more failure in each of `app` and `core`, both stale engine
fixtures that Lane E owns (E27).

### 6.5 What a built-in needs that the engine does not emit

| Field | Engine gives | Built-in gets | Authority |
|---|---|---|---|
| `id` | `custom:cb5fe66a`, `custom:b174242c` | `kurd`, `amara10` | auto-decision AD1 |
| `name` | `--name` | `D KURD 10`, `D AMARA 10` | D2 |
| `sub` | none in the deck; `from_generated` derives `9 + 1` | `9 + 1` on both | D2, D11 |
| `colors` | palette 0 to 5 | D5 hexes; `ga` = root, `gb` = tone | D5 |
| `options`, `warnings` | present | dropped at adoption | AD4 |
| `geom.ext` | `1.06` | dropped: a test forbids it on built-ins (E9). The app falls back to `R * 1.06`, the same value | AD4 |
| other `geom` keys | all solver keys, including `ding_dy: 0` | kept verbatim | AD4 |
| `print.title`, `credit` | `D Kurd 10 - Chord Cards`, `D KURD 10` | section 8 | AD2 |
| `print.R`, `cy`, `y_note`, `y_num`, `legend_demo`, `blurb`, `legend_lines` | E20 measured 69.8, 124.0, 30, 14, `[6,4]` / `[5,3]`, two blurb lines, two legend lines on the CAPPED, offset-ding decks. The values on the revision 4 decks are UNVERIFIED | taken verbatim from `from_generated` on the adopted deck | engine-derived |
| `print.grad`, `col_root`, `col_tone` | derived from `colors` | 3-decimal RGB of the D5 hexes | derived |
| `degrees` | present | present, `ii°` kept | D10 |
| mirror (hand) | `mirror: false` | no `--mirror` on either | D12, D14 |

**Do the new decks need a `print` overlay, given D6? Yes.** The overlay is
not about committed PDFs. The app builds every PDF in the browser through
`HPE.pdfdeck.fromBuiltin(d, d.print)` (E19), and `tools/decks.py`
`_from_canonical(id)` reads the same key for `validate.py` check 1b, render
agreement and PDF parity. A built-in with no `print` key cannot print from
the app.

**The smallest change that keeps six PDFs and adds none (D6):**

- Add `KURD = _from_canonical("kurd")` and `AMARA10 = _from_canonical("amara10")`
  to `tools/decks.py`. `PY`, `DECK_BY_ID`, `ALL_DECKS` and the parity test's
  `getattr(decks, case.upper())` need them.
- Leave `__main__`, `tests/paths.py` and `tests/test_pdf_build.py` alone.
- Extend `BUILTINS` in `tests/test_pdf_parity.py`, so the browser-built PDF of
  each new deck is still compared with a fresh reportlab build. That test
  builds in a temp directory and needs no committed file (E22).

### 6.6 Layout: the centred default (D8, D12 to D15)

**Today.** `geometry()` in `src/engine/layout.js` always offsets the ding
(`R_DING` 0.19, `DING_DY` 0.1425). `rimAngles(count)` anchors the HIGHEST rim
note at 90 degrees and zig-zags down. For nine rim notes that puts note 1 at
290, or at 250 with `--mirror`. 270 is never a slot for an odd count. So the
first eng review's F5 held: no flag of today's solver gives the Amara 9 look.

**Prototype** (scratch only, E29; it replaces the revision 3 prototype of
E26, whose odd-count polarity was the other way round). Three additions:

- `isCentred(counts)`: true when `counts.inner === 0` (D15). `counts` comes
  from `placeZones`, after positional spill, so a seed with 12 or 13 top
  notes and no `/` counts as having inner notes.
- `rimAnglesFromBottom(count)`: for an even count it returns
  `rimAngles(count)` unchanged. For an odd count it anchors the LOWEST rim
  note at 270 and zig-zags up, second note to the LEFT (D13, D14):
  `270 + sign * ceil(i / 2) * step`, sign negative for odd `i`.
- `geometry()` uses `R_DING_CENTRED` 0.2 and `ding_dy` 0 on the centred
  branch, for the ding point, the ding clearance, the reach, and the emitted
  `r_ding`, `ding_dy` and `f_ding`.

Rim-only angles, today against the prototype (E29). Even counts are
byte-unchanged in both hands.

| Rim | Hand | Today | Prototype |
|---|---|---|---|
| 5 | unmirrored | 306 234 18 162 90 | 270 198 342 126 54 |
| 5 | mirrored | 234 306 162 18 90 | 270 342 198 54 126 |
| 6 | unmirrored | 270 330 210 30 150 90 | same |
| 7 | unmirrored | 295.7 244.3 347.1 192.9 38.6 141.4 90 | 270 218.6 321.4 167.1 12.9 115.7 64.3 |
| 7 | mirrored | 244.3 295.7 192.9 347.1 141.4 38.6 90 | 270 321.4 218.6 12.9 167.1 64.3 115.7 |
| 8 | unmirrored | 270 315 225 0 180 45 135 90 | same |
| 8 | mirrored | 270 225 315 180 0 135 45 90 (Amara 9, Hijaz) | same |
| 9 | unmirrored | 290 250 330 210 10 170 50 130 90 | **270 230 310 190 350 150 30 110 70** (both new pans) |
| 9 | mirrored | 250 290 210 330 170 10 130 50 90 | 270 310 230 350 190 30 150 70 110 |
| 10 | unmirrored | 270 306 234 342 198 18 162 54 126 90 | same |
| 11 | unmirrored | 286.4 253.6 319.1 220.9 351.8 188.2 24.5 155.5 57.3 122.7 90 | 270 237.3 302.7 204.5 335.5 171.8 8.2 139.1 40.9 106.4 73.6 |
| 11 | mirrored | 253.6 286.4 220.9 319.1 188.2 351.8 155.5 24.5 122.7 57.3 90 | 270 302.7 237.3 335.5 204.5 8.2 171.8 40.9 139.1 73.6 106.4 |

- **"Keep their sides" holds (D14).** In every odd row each note stays on
  the side of the vertical axis it is on today, in both hands, except the
  note that sat ON the axis: today's highest note at 90 moves 20 degrees (at
  9) to one side, and note 1 moves onto the axis at 270.
- **Geometry, every rim-only count 5 to 11.** `r_ding` 0.19 to 0.2,
  `ding_dy` 0.1425 to 0, `f_ding` 0.114 to 0.12. `r_note` and `ext` do not
  move (0.19 for 5 to 10, 0.1783 at 11; `ext` 1.06). The offset never bought
  rim room. It only makes room for inner notes beside the ding.
- **Seeds with inner notes are byte-unchanged.** Checked: 9 rim `/` 2 inner;
  12 top notes with no `/` (11 rim + 1 inner); 13 top notes with no `/`
  (11 + 2); the Pygmy seed; `(D3) A3 B3 / C4`.
- **Bottom notes do not force the offset.** 9 rim + 2 bottom, no inner:
  centred, bottom-anchored, bottom angles unchanged.

The two new pans next to shipped Amara 9:

| | Today's solver, unmirrored | Prototype, unmirrored | Shipped Amara 9 |
|---|---|---|---|
| Note 1 | 290 | **270** | 270 |
| Notes 2 to 9 | 250, 330, 210, 10, 170, 50, 130, 90 | 230, 310, 190, 350, 150, 30, 110, 70 | 225, 315, 180, 0, 135, 45, 90 |
| Even numbers | left | left | left |
| Step | 40 | 40 | 45 |
| Top centre (90) | note 9 | **empty**; notes 8 and 9 sit at 110 and 70 | note 8 |
| `r_ding` | 0.19 | 0.2 | 0.2 |
| `ding_dy` | 0.1425 | 0 | absent (0) |
| `rim` / `r_note` | 0.745 / 0.19 | 0.745 / 0.19 | 0.745 / 0.19 |
| `f_ding` / `f_note` / `f_num` | 0.114 / 0.1454 / 0.1216 | 0.12 / 0.1454 / 0.1216 | 0.135 / 0.128 / 0.105 |
| `n_in` / `inner_ring` | 0.085 / 0.355 | 0.085 / 0.355 | 0.085 / 0.355 |

Notes by field: Kurd is A3, Bb3, C4, D4, E4, F4, G4, A4, C5. Amara 10 is A3,
C4, D4, E4, F4, G4, A4, C5, D5.

**The mirror toggle's polarity (documented, not fixed; D14).** Unmirrored,
an EVEN rim puts note 2 on the right (8: 270, 315, ...) and an ODD rim puts
note 2 on the left (9: 270, 230, ...; today 290, 250, ...). That split is on
`main` today. It is why the new decks are generated without `--mirror` while
Amara 9's angles equal `--mirror` on eight notes. Lane E records it in the
`layout.js` header and in `docs/ENGINE-SPEC.md`.

**Does the prototype reproduce the shipped decks?** Run on the Amara 9 and
Hijaz maker strings with `--mirror`, it gives the shipped angles exactly and
the shipped circle geometry (`rim` 0.745, `r_ding` 0.2, `r_note` 0.19, `n_in`
0.085, `inner_ring` 0.355). Only the label literals differ (0.12 / 0.1454 /
0.1216 against the shipped 0.135 / 0.128 / 0.105), and no renderer sizes
anything from those (E26, unchanged by the polarity fix because eight is
even).

**Does the solver reproduce shipped Pygmy?** Angles yes, geometry no, before
and after the prototype: `r_note` 0.1456 against the shipped 0.1425, `f_note`
0.1114 against 0.109, `f_num` 0.0932 against 0.0912 (E26). No test asserts
that the solver reproduces Pygmy's geom. The shipped decks are literals in
`data/decks.json` and never pass through the solver, so Lane E cannot move
them.

**Blast radius** (E29):

- **Every generated rim-only custom deck redraws.** The ding moves to the
  centre. Odd rim counts also get new note angles. `restoreScales` rebuilds
  stored custom decks from their seeds on every boot, so stored and shared
  custom decks redraw too, with no action by the user (D14 accepts this).
- **Deck ids and share URLs do not change.** `core.deckId` hashes the seed
  string and nothing else. A share link carries the seed.
- **The three shipped decks do not change.** `data/decks.json` and the
  `const DECKS` line are byte-unchanged after the lane's sync steps.
  `card_face_v1.json` and `pan_render_v1.json` regenerate byte-identical.
- **Tests that fail under the prototype and are rewritten by Lane E:**
  - `tests/layout.test.js`, 5 of 53: "mirror turns the nine-field zig-zag
    into the left-first pattern"; "nine rim fields reproduce the verified
    pygmy zig-zag"; "the default is right-first and mirror is left-first"
    (fails at "top-heavy N=5: default is right-first"); "the ding keeps the
    D12 offset geometry on every generated pan"; "the rim ends at top centre
    and is evenly spread".
  - `tests/core.test.js`: "ET-1 engine corpus matches". Regenerating
    `tests/fixtures/engine_corpus_v1.json` with
    `node tools/regen_engine_corpus.js` changes 30 values: 10 each of
    `ding_dy`, `f_ding`, `r_ding`. "ET-2 rim/bottom/inner angles follow
    CLAUDE.md zig-zags" passes unchanged.
  - `tests/app.test.js`: "AP3-0 generated faces and rail DOM match the
    committed digest" and "every built-in card face still matches the
    committed digest of card_face_v1.json". Both read
    `tests/fixtures/gen_face_v1.json`. Regenerate with
    `node tools/regen_card_fixture.js --gen` (reviewer F3: without `--gen`
    the tool rewrites the built-in fixture instead). 58 leaves change, all
    under `decks`; `rails` 0.
- **Suites that pass unchanged under the prototype:** share 51, select 51,
  preview 14, sequence 43, voicing 16, naming 35, pdf 11, pdfcards 16,
  pdf_builtin 13, mutation_harness 53. After the two fixture regenerations:
  core 53 of 53, app 282 of 282, Python 223 tests OK.
- **Mutants touching `layout.js`: 14, all verified.** Each applies to the
  prototype and dies under its own named test (base passes, mutant fails):
  `eg_slotorder_swapped`, `et_rim_angle_direction_flipped` (ET-2),
  `g_bottom_cap_seven`, `g_mirror_ignored`, `g_ext_fixed`,
  `g_geom_key_dropped`, `g_inner_pair_with_rim`, `g_r_note_constant`,
  `g_zone_rewritten`, `l_order_ignored`, `l_order_length_unchecked`, and
  three that touch only comment context (`qb_core_badnote_no_truncate`,
  `qb_core_err_no_substitution`, `qb_core_fieldsof_ignores_wrapper`). None
  names one of the five tests being rewritten.
- **Sequences do not move.** `src/engine/sequence.js` reads no angle and no
  geom key; `tests/sequence.test.js` is 43 of 43 under the prototype.
- **e2e impact is UNVERIFIED.** No e2e test was run against the prototype.
  Tests that add a custom deck and measure the card may see a different
  diagram.
- **Docs.** `docs/ENGINE-SPEC.md` section 4 and `docs/SCALE_ENGINE_PLAN.md`
  row D12 ("Layout default = Pygmy pattern, mirrored right-first") record
  the offset ding as the default. Lane E updates both.

### 6.7 The no-shrink tests and the new decks (closed by D9)

The engine emits `f_note` 0.1454, which is `0.19 x 0.765 = 0.14535` rounded
up. The pre-rule app baseline is `f_note x 1.05 = 0.15267`. The label rule
draws `0.19 x 0.80325 = 0.15262`, 0.03% under. Both no-shrink tests fail on
the rim names of both new decks, on the app side only (E22):

- `test_no_label_is_smaller_than_what_either_renderer_drew_before`: "10.6527
  pt, under the 10.6564 pt".
- `test_neither_renderer_draws_smaller_than_it_did_before_the_rule`: "15.262,
  under the 15.267".

The failure is unchanged under the Lane E prototype (E27; `f_note` and
`r_note` do not move in E29 either) and does not depend on the cap. D9: "Test the old
three only". Both tests iterate a named tuple of Hijaz, Pygmy and Amara 9.
No tolerance and no rounding change. The name-larger-than-number test, the
3.6 pt floor test and render agreement keep running on all five decks. The
lane must not touch `f_note`.

### 6.8 Mutant impact

- Corpus is 682 patches (E1).
- 12 patches carry the whole DECKS line as context and go stale on any data
  change: the 11 `b_*` patches produced by `tools/regen_data_mutants.py`, and
  `c_deck_data_drift.patch`, which is cut by hand (E22).

**First review F1, non-unique anchors: holds, on two tool patches and the
hand-cut one.** The simulation below ran on the CAPPED five-deck file. Lane
U2 inserts two Amara 9 cards and Lane B adds Fadd9 and Cadd9 to Amara 10,
both of which also exist on Amara 9, so the preimage counts must be
re-simulated in Lane B on the real data. The retargets are a starting point,
UNVERIFIED on the revision 4 data.
The tool cuts each patch with eight lines of context from the indented
`data/decks.json`. With Amara 10 in the file, an Amara 9 card that is
byte-identical to an Amara 10 card no longer has a unique preimage. Simulated
over the five-deck file (E23):

| Patch | Today's target | Preimage count | Retarget | Count after |
|---|---|---|---|---|
| `b_duplicate_voicing` | Amara `Csus4` given `[2,4,6]` | 2 | Amara 9 `F6/9` given Fmaj9's fields `[5,1,2,4,6]` | 1 |
| `b_root_not_in_voicing` | Amara `Fmaj7` `roots=[7]` | 2 | Amara 9 `Gsus4` `roots=[7]` | 1 |
| `c_deck_data_drift` | drop the last field of Amara `Fmaj7` | 2 | drop the last field of Amara 9 `F6/9` (`[5,1,2,3]`) | 1 |
| the other nine `b_*` | | 1 | none | 1 |

`b_power_chord_fifth` targets Amara G5 `[6,3]`, one of the three cards that
differ, so it is already unique. Kill check in scratch: the F6/9 duplicate
fails `test_voicings_unique_within_deck` and the Gsus4 roots mutant fails
`test_roots_appear_in_voicing` (E23). `KNOWN_NON_UNIQUE_ANCHORS` stays empty.
No lint exception is added.

**F3, the seam's mutants: holds, with one addition.** Eight `d_*` patches
sit on lines Lane A changes (E28):

| Patch | Relation to the seam | Action |
|---|---|---|
| `d_deck_copies_registry` | removes the `const deck = () => ...` line | hand re-cut |
| `d_no_deck_fallback` | removes the same line | hand re-cut |
| `d_registry_ignored` | removes the same line | hand re-cut |
| `d_deck_id_untyped` | removes the `let deckId` line | hand re-cut |
| `d_delete_keeps_record` | `DECKS[0]` as context | `tools/refresh_mutants.py` |
| `d_delete_moves_selection` | `DECKS[0]` as context | refresh |
| `d_delete_silent` | `DECKS[0]` as context | refresh |
| `d_edit_moves_selection` | ADDS a line `selectDeck(replaced ? DECKS[0].id : d.id);` | Whether it needs a refresh was not run. UNVERIFIED |

- Lane E touches `layout.js`; its 14 mutants are in 6.6, all re-proven.
- Lane U1 touches `select.js`; its 20 mutants are in 6.10.
- Net change: +3 (E), -5 +1 (U1), +2 (B), +1 (C). 682 + 2 = 684.

### 6.9 Fit of a five-deck picker (closed by D7)

Measured on the decided names and order, five built-in chips, real fonts
(E12). The probe tree still boots Hijaz, so the strip is scrolled to the
fourth chip.

| Viewport | Strip width | Box | Fits |
|---|---|---|---|
| 380x780 | 642 | 356 | no |
| 320x568 | 642 | 296 | no |
| 390x844 | 642 | 366 | no |
| 667x375 | 634 | 590 | no |
| 844x390 | 767 | 767 | yes |
| 926x428 | 849 | 849 | yes |
| 1280x500 | 1203 | 1203 | yes |
| 1280x800 | 760 | 760 | yes |

- The strip is built to scroll (`.decks` has `overflow-x:auto` and a fade).
  `buildChips` scrolls the active chip into view: with Hijaz active at 380
  wide its chip ends at 356 of 356.
- Real-font chip widths at 380 wide: Kurd 110, Amara 10 121, Amara 9 114,
  Hijaz 109, Pygmy 156, with 8px gaps.
- After Lane C a cold boot shows Kurd, Amara 10 and most of Amara 9 at 380
  wide. Hijaz and Pygmy are reached by swiping. DERIVED from the widths
  above, not measured with Kurd active.
- D7: "Accept scrolling". No CSS change. The last block of "the landscape
  deck strip scrolls rather than clips, at both ends" asserts that the strip
  FITS at four landscape sizes with one custom deck added. On the earlier
  five-deck tree it measured 780 against 767 at 844x390 and 780 against 590
  at 667x375 (E11, old names; the decided names are 5px wider in total). That
  block is rewritten to expect scrolling.
- The picker lives in the header, not the settings panel. The `panel-fit`
  job is not expected to move. UNVERIFIED: `panel-fit` runs in CI only.

### 6.10 Removing the cap (D16), measured

Scratch worktree, Lane E prototype plus the two cap lines deleted from
`build` in `src/engine/select.js` (E30, E31).

**Deck sizes** are in section 5. Other uncapped sizes, cards / names: twelve
note pan 35 / 27; nineteen field maximum 74 / 43; octatonic 42 / 42;
augmented hexatonic 14 / 14. Presets of `tools/gen_deck.js`: `d_kurd_9`
49 / 49, `d_celtic_minor_9` 16 / 14, `csharp_annaziska_9` 27 / 27,
`e_la_sirena_9` 19 / 19, `f_low_pygmy_9` 13 / 11, `g_hijaz_9` 30 / 30.

**No bound remains.** Worst case tried: a chromatic 19-field pan
`(C3) C#3 D3 ... C#4 | D4 D#4 E4 F4 F#4` gives 329 cards / 295 names. The
build takes 6 ms and three sequence picks 31 ms. Its client PDF is 37 sheets
(0.27 s, about 6 MB). Kurd's 49 cards are 6 sheets, full and shop alike
(0.07 s, about 0.68 MB). This is OQ-U2.

**Existing users.** Persisted state holds no card index. Saved custom scales
and share links hold the seed only and rebuild at boot, so every stored
custom deck that the cap was trimming grows on the next visit with no action
by the user. A saved D Kurd 9 goes from 25 to 49 cards.

**Pygmy is not pure engine output (the finding).** The capped engine run of
the Pygmy seed gives 52 cards / 31 names and differs from the shipped deck
in ONE card: the engine voices `Fm9` as `[5,7,8,9,6]`; the shipped card is
`[5,7,8,9,11]`, a declared register exception recorded in
`tests/fixtures/divergence_v1.json` ("Declared register exception (spec
section 6 / D11, plan Premise 2)"). The solver's geom for Pygmy also differs
from the shipped literals (6.6). Uncapped, the engine gives 53 / 32: one
more card, `Fmadd9 [5,7,8,6]` at position 6, before Fm9. So applying
"Everywhere" to Pygmy by regeneration would also rewrite Fm9 and the geom,
which D16 did not ask for. The only way to apply it is to hand-insert one
card. That, and its effect on MEDIUM progressions (6.11), is OQ-U1.

**Hijaz** is 19 / 19 capped and uncapped, identical to shipped.

**Every cap site** (grep plus the scratch failures):

| Site | Anchor | What it holds |
|---|---|---|
| `src/engine/select.js` | `CAP_BASE`, `CAP_HINGE`, `cap(fields)`, `trimToNames(list, limit)`, the two lines in `build`, the export `cap: cap` | the cap itself |
| `index.html` | `<!-- engine:select begin -->` region | generated copy |
| `tests/select.test.js` | six tests listed below; uses `HPE.select.cap` | cap behaviour |
| `tests/fixtures/divergence_v1.json` | Pygmy and Amara `extra` lists | pinned by "the generated decks diverge from the built-ins exactly as committed" |
| `tests/fixtures/engine_corpus_v1.json` | chord lists of the synthetic entries | "ET-1 engine corpus matches" |
| `tests/sequence.test.js` | "S7: a custom D Kurd 9 deck deals HARD with no extended card" | relies on capped Kurd 9 having no extended card; uncapped it has 14 |
| `tests/test_gen_deck.py` | `CHORDS_TOP_ONLY = 25`; the 3-sheet page count | Kurd 9 preset size |
| `tests/test_pdf_parity.py` | `SEEDS[0]` (the Amara 9 string), `test_a4_is_letter_shifted_on_the_page` | see below |
| `tools/gen_deck.js` | preset comment "three 25-chord decks ... a 3-sheet and a 2-sheet print run" | prose |
| `docs/ENGINE-SPEC.md` | section 8: `cap = 25 + max(0, fieldCount - 12)`, the worked example 29 to 27 to 25, "Ranking, applied to trim to the cap" | spec |
| `docs/SCALE_ENGINE_PLAN.md` | row D1 "Core drill deck, ~18-25 cards" | superseded decision |
| `README.md`, `CLAUDE.md` | "D Amara 9, 25 cards", "96 cards total", "fully re-ranked to 25 cards", "25 chords", "all 96 cards" | prose pinned by tests |
| `tests/e2e.test.js` | none found: the only size check is the regex `/cards generated/` | grep only, not run |

**Tests that fail with the engine uncapped and shipped data untouched**
(Lane U1's work list):

- `tests/select.test.js`, 7 of 51: "a deck that overflows its cap loses whole
  names, never half a name"; "canonical order: root degree, then tier, then
  the quality rank" (its expected literal lacks `Gadd9`); "no generated deck
  exceeds its own size-scaled cap"; "the cap bites on the 12-note pan: 27
  candidates, 25 cards"; "the cap scales with pan size: the 18-field Pygmy
  pan caps at 31"; "the deck cap counts chord NAMES, so alternates cannot
  evict a chord"; "the generated decks diverge from the built-ins exactly as
  committed".
- `tests/core.test.js`: "ET-1 engine corpus matches".
- `tests/sequence.test.js`: "S7: a custom D Kurd 9 deck deals HARD with no
  extended card".
- `tests/app.test.js`: none (282 of 282).
- Python, 4: `test_a_generated_deck_builds_a_pdf_with_the_expected_page_count`
  (two subtests, 6 sheets against 3);
  `test_a_warning_survives_the_adapter_and_reaches_the_title_blurb` (49
  against `CHORDS_TOP_ONLY`); `test_a4_is_letter_shifted_on_the_page`.
- **The A4 failure is a test artifact, not a PDF defect.** The test sorts
  glyphs by rounded (x, y, size, char) and zips Letter against A4. On page 3
  of the 27-card deck two glyphs, `-` and `G`, sit at x 310.213013 against
  310.212997 and 310.213027 and swap order after the A4 shift: 2 of 901
  glyphs. Lane U1 makes the comparison order-stable and re-proves
  `g_pdfcards_a4_rescales`.

**Further tests that fail once Amara 9's data is 27 cards** (Lane U2's work
list):

- `tests/sequence.test.js`: "anchors pick one simple chord per root on every
  built-in deck" (the literal `amara: [1, 9, 15, 17, 22]`); "built-in
  INTERMEDIATE/ADVANCED deals match the tier golden fixture"; "length-4 loops
  migrate per the §2 table on every built-in deck"; "MEDIUM enumeration
  visits exactly the section 4 node counts and finds the exhaustive set";
  "pick(..., undefined) and pick(..., \"basic\") reproduce the EASY golden
  fixture"; "S2: 300 public pick() deals per tier classify as their tier and
  keep the shape"; "S4: colourFamily names every built-in colour card's
  family (sus before 7)"; "sequences match the approved golden table on
  every built-in deck"; "tierOf classifies the golden fixtures and every
  BASIC sequence". The goldens are index-based.
- `tests/app.test.js`, 4: the `card_face_v1.json` digest; "every rendered
  face is well-formed markup (96 cards x 2 modes)"; "modes A and B render
  byte-identical DOM to the pre-lane base, for all three decks at idx 0 and
  1"; the `pan_render_v1.json` digest.
- `tests/pdf_builtin.test.js`: "every voicing field and every root field
  survives, for all 96 cards" (asserts `19 + 52 + 25`).
- Python, 12 more: `test_all_six_pdfs_build_with_the_expected_page_counts`,
  `test_amara_blurb_is_unchanged`, `test_committed_pdfs_match_a_fresh_build`,
  `test_deck_dicts_match_the_pre_refactor_snapshot`, `test_deck_inventory`,
  `test_every_card_is_compared`,
  `test_every_deck_is_named_with_its_own_chord_count`,
  `test_fixture_deep_equals_live_decks`,
  `test_printer_only_sheets_contain_only_chord_cards`,
  `test_shape_and_card_counts`,
  `test_the_adapter_leaves_the_builtin_decks_untouched`,
  `test_total_card_count_matches_the_deck_data`.
- The two committed Amara 9 PDFs are rebuilt (4 sheets, was 3). The 11
  `b_*` data mutants and `c_deck_data_drift.patch` go stale.

**Mutants on `select.js`: 20** (E30).

- 13 still die under the uncapped engine: `et_no_thirds_misses_minor_third`,
  `f1b_collapse_two_root_symmetric`, `n_subtitle_cap_25`,
  `qb_core_isding_wrong_zone`, `qb_core_pc_no_wrap`,
  `s_auto_name_excludes_ding`, `s_no_equivalence_annotation`, `s_m6_survives`,
  `s_extended_off_top_shell`, `s_no_thirds_never`,
  `s_rank_home_first_reversed`, `s_rank_group_scoring_collapsed`,
  `s_six_chord_survives`.
- 5 are deleted with the code they mutate: `s_cap_slope`, `s_cap_flat`,
  `s_cap_removed`, `s_cap_hinge`, `s_cap_widened`.
- 2 name "canonical order: root degree, then tier, then the quality rank":
  `s_registerclass_guard_dropped` and `s_tier_order_swapped`. Re-prove both
  after that test's literal is updated. NOT re-proven in scratch.
- Mutants outside `select.js` whose named test moves:
  `sqr_15_hard_two_nonanchor_branch_dropped` (S7; verified to still die when
  S7's seed is swapped to the augmented hexatonic
  `(C3) Eb3 E3 G3 Ab3 B3 C4 Eb4 E4`, 14 cards, no extended card, HARD deals
  50 of 50); `c_gen_page_count`, `c_blurb_spurious_line`,
  `c_gen_chord_count_off_by_one`, `c_gen_warning_off_the_sheet`
  (`tests/test_gen_deck.py` literals); `g_pdfcards_a4_rescales`;
  `c_chords_only_padding` (six-PDF page counts); `et_corpus_check_blind`
  (ET-1). Only the first was re-proven.

### 6.11 Do the deck changes change the progressions? (measured)

`src/engine/sequence.js`, 3,000 deals per tier with `mulberry32(7)`, capped
against uncapped, per deck (E32).

| Deck | Anchors and BASIC pool | MEDIUM | HARD |
|---|---|---|---|
| Hijaz | identical (pool 71) | identical | identical |
| Amara 9 | identical (Dm, F, Gsus4, Am, C; pool 30) | card pool 20 to 22 (adds Fadd9, Cadd9); distinct deals 997 to 1104; family shares unchanged (seventh 33.9 / other 32 / sus-power 34.1) | pool 25 to 27; extended share 70.2 to 66.2; home start 32.6 to 30.5 |
| Amara 10 | identical (same five; pool 30) | pool 20 to 22 | pool 26 to 29; extended share 75.7 to 77.3 |
| Kurd | identical (Dm, E°, F, Gm, Am, Bb, C; pool 170) | pool 25 to 35; families go from two (seventh 51.4 / sus-power 48.6) to three (33.9 / 32 / 34.1) | pool 25 to 49; extended share 0.0 to 83.3; non-anchor share 70.1 to 85.1 |
| Pygmy, only if Fmadd9 is inserted (OQ-U1 B) | identical (pool 170) | pool 30 to 31; **families go from two (seventh 51.4 / sus-power 48.6) to three (33.9 / 32 / 34.1)** | pool 52 to 53; extended share 84.9 to 83.1 |

- BASIC and EASY deal exactly the same sequences by chord name on every
  deck. Uncapping changes MEDIUM and HARD only, by adding cards to their
  pools.
- Capped Kurd had no extended card at all, so its HARD tier could not deal
  one. Uncapped it behaves like the other decks.
- Lane E changes nothing here (6.6).
- **Pinned fixtures.** The engine change alone moves no sequence golden,
  because built-ins read `data/decks.json`. `sequence_basic_golden.json` and
  `sequence_tier_golden.json` are index-based and move when Amara 9's data
  gains its two cards (Lane U2), even though the BASIC sequences are the
  same chords.
- **Not asked for by the owner:** the Pygmy MEDIUM change. One inserted card
  opens a third colour family and takes about a third of MEDIUM colour deals
  from the other two. The S1 test pins Pygmy's families as
  `[seventh, susPower]`. This is part of OQ-U1 and is not designed around.

## 7. Persistence

### 7.1 Today

`localStorage["hpfc"]` holds `{deck, mode, tier, printPaper}`. `deck` is a
string id. `save()` read-modify-writes the object inside try/catch. Boot calls
`setMode(mode)`, which calls `save()`, so a first visit writes
`deck: "hijaz"` at once (E4). Every existing visitor therefore holds
`deck: "hijaz"` whether or not they chose it.

### 7.2 Design

- One named constant, `DEFAULT_DECK`, holds the cold-start id. Lane A
  introduces it with value `"hijaz"` (no behaviour change). Lane C sets it to
  `"kurd"`.
- The three fallbacks (`let deckId` initialiser, `deck()`, `deleteDeck`)
  resolve through `DEFAULT_DECK`. `DECKS[0]` stays only as the last resort
  inside `deck()`, for a constant that names a missing deck.
- Picker order stays the array order of `data/decks.json`.
- **No migration (D1).** A stored id is always honoured. Nothing is added to
  `hpfc`.

### 7.3 Decision table

| # | Scenario | Today (evidence) | Target | Test (Lane C unless noted) |
|---|---|---|---|---|
| 1 | First visit, no storage | boots Hijaz, writes `deck:"hijaz"` (E4) | boots D Kurd 10, writes `deck:"kurd"` | "a first visit with empty storage opens D Kurd 10" (`tests/app.test.js`); e2e "a cold start shows D Kurd 10 and a reload keeps the deck the user picked" |
| 2 | Returning user, stored built-in | stored `amara` boots Amara (E4) | unchanged | existing "deck and mode round-trip through localStorage (subset semantics)"; new "a stored built-in deck wins over the default" |
| 3 | Value stored by the shipped app | `deck:"hijaz"` (E4) | **stays on Hijaz** (D1) | "a store holding hijaz from before the default changed still opens Hijaz" |
| 4 | Stored id gone or malformed | `"nope"` boots Hijaz and rewrites the store; numeric `2` boots Hijaz (E4) | boots `DEFAULT_DECK`, rewrites the store | Lane A renames "an unknown stored deck id falls back to the first deck" to "... falls back to the default deck"; "a non-string stored deck id is ignored and never eats a share link" asserts the default id |
| 5 | Last selection was a custom deck | `restoreScales` rebuilds `CUSTOM` before `deck()` resolves; a missing `custom:` id falls back and warns (code read) | unchanged, fallback is `DEFAULT_DECK` | existing e2e using `custom:gone`; new "a stored custom deck wins over the default" |
| 6 | Share URL plus a stored choice | `openShare` runs after boot and calls `selectDeck`, which saves. The share wins. Code read, UNVERIFIED by run | unchanged | new "a share link wins over the stored deck and becomes the stored deck" |
| 7 | Storage unavailable or throwing | boots, nothing persists (existing test) | boots D Kurd 10 every time | existing "a throwing localStorage breaks neither boot nor navigation", extended to assert the deck id |
| 8 | Two tabs | no `storage` listener (E19). Last writer wins | unchanged; non-goal to sync | new "two boots over one store: the last selection wins and sibling keys survive" |

**Accepted consequence (what remains of F4).** A browser tab still running a
cached copy of the old app writes `deck: "hijaz"` on its first boot, as it
always did. If that happens after the user's first visit to the new app in
the same browser, the stored deck becomes Hijaz and the new app honours it.
With no migration there is no marker to protect, so nothing else can go
wrong. The owner accepted "New visitors only"; this is inside that answer.

## 8. Identity and collisions

| | D Kurd 10 | D Amara 10 |
|---|---|---|
| id | `kurd` | `amara10` (shipped `amara` unchanged) |
| `name` | `D KURD 10` (9 chars) | `D AMARA 10` (10 chars) |
| `sub` | `9 + 1` | `9 + 1` |
| `tools/decks.py` constant | `KURD` | `AMARA10` |
| Root / tone | `#2563B0` / `#C0452C` | `#3B7A2A` / `#B3263A` |
| Client PDF filename (name stem rule in `downloadDeckPDF`) | `D_KURD_10_Cards_Letter.pdf` | `D_AMARA_10_Cards_Letter.pdf` |
| Committed PDFs | none (D6) | none (D6) |
| Print title | `D Kurd 10 - Chord Cards` | `D Amara 10 - Chord Cards` |
| Print credit | `D KURD 10 / D MINOR` | `D AMARA 10 / D MINOR` |

- **Chip label.** Capped at 16 characters (`CHIP_CAP`, E17). Both names fit.
- **Near-twin names.** `D AMARA 10` and `D AMARA 9` sit side by side in the
  picker with the same header layout. They differ by sub-line (`9 + 1`
  against `8 + 1`) and by colour (green against teal). This follows from D2
  and D3.
- **Client filename.** `D_AMARA_10_Cards_Letter.pdf` does not collide with
  the committed `D_Amara_9_Cards_Letter.pdf`.
- **id `amara10` against `amara`.** Lookups use equality
  (`DECKS.find(d => d.id === deckId)`), so the shared prefix is safe. No CSS
  rule is keyed by a deck id (E18 found none; not an exhaustive search).
- **Storage.** `hpfc.deck` holds the id. Neither can collide with a
  `custom:` id.
- **Custom entry of the same maker string.** Today that creates a separate
  custom deck (`custom:cb5fe66a = D AEOLIAN 10` beside built-in `kurd`, E14).
  Unchanged. OQ10.

Per-deck tables keyed by deck id that need a new row:

| Table | Where | Source of the new rows |
|---|---|---|
| `degrees` | `data/decks.json` | engine (E2) |
| `DEGREES`, `LAYOUTS`, `CHORD_COUNTS` | `tests/test_deck_data.py` | copied from engine output as a spec pin |
| Print overlay | `data/decks.json` `print` key | `from_generated` (E20) plus section 8 text |
| `PY`, `DECK_BY_ID`, `ALL_DECKS`, `BUILTINS` | tools and tests in 6.3 | mechanical |
| `card_face_v1.json` | `tests/fixtures` | `node tools/regen_card_fixture.js` |
| `pan_render_v1.json` | `tests/fixtures` | `node tools/regen_pan_fixture.js` |
| `golden_decks_v7.json` | `tests/fixtures` | recipe in Lane B (F2); `v6` is Lane U2's, for the 27-card Amara 9 |
| `print_decks_v1.json`, sequence goldens | `tests/fixtures` | not extended to the new decks (AD6); regenerated for Amara 9 in Lane U2 |
| CLAUDE.md degrees bullet, layouts, palettes | CLAUDE.md | section 13 |

## 9. Decisions and open questions

### 9.1 Closed by the owner

OQ1 (D3), OQ2 (D5), OQ3 (D2, D11), OQ4 (D6), OQ5 (D4, D12), OQ6 (D9), OQ7
(D1), OQ8 (D7), OQ9 (D16), OQ12 (D10), OQ-L1 (D15), OQ-L2 (D13), OQ-L3
(D14). See section 2.

Contrast of the chosen colours against white (WCAG ratio, E16). Shipped for
scale: Hijaz 3.54 / 3.07, Pygmy 7.21 / 2.65, Amara 5.12 / 2.62.

| Colour | Hex | Ratio | Hue |
|---|---|---|---|
| Kurd root, blue | `#2563B0` | 6.02 | 213 |
| Kurd tone, brick | `#C0452C` | 5.09 | 10 |
| Amara 10 root, green | `#3B7A2A` | 5.25 | 107 |
| Amara 10 tone, crimson | `#B3263A` | 6.45 | 351 |

### 9.2 Auto-decisions made by this plan (F10)

The owner did not pick these. Each is the conservative option. Any of them
can be overruled before the lane that uses it starts.

| # | Decision | Why |
|---|---|---|
| AD1 | Deck ids `kurd` and `amara10`; constants `KURD`, `AMARA10` | short, stable, `amara` untouched |
| AD2 | Print titles and credits as in section 8 | same shape as the shipped overlays |
| AD3 | Overlay numbers (`R`, `cy`, `y_note`, `y_num`, `legend_demo`, blurb, legend lines) taken from `decks.from_generated` verbatim | no hand-tuned print number |
| AD4 | At adoption drop `options`, `warnings` and `geom.ext`; keep every other solver geom key | a test forbids `ext` on built-ins; keeping the rest makes the engine-equality test a plain comparison |
| AD5 | `golden_decks_v6.json` (Lane U2) and `v7` (Lane B) list decks in `data/decks.json` order | one order everywhere |
| AD6 | `print_decks_v1.json`, both sequence goldens, `tests/test_gen_deck.py` loops and `tests/test_font_subset.py` get no rows for the NEW decks | other tests cover the new decks (section 16) |
| AD7 | **Changed in revision 4, adopting the reviewer's recommendation.** `freshLoad()` stays as it is (empty storage). The e2e tests that read `meta[0]` as "the booted deck" are fixed in Lane A to look the booted deck up by id. No `deck: "hijaz"` seed and no `coldLoad()` | a permanent seed would leave the real default under-tested. Cost, stated: after Lane C every e2e test that names no deck runs on Kurd (49 cards), and which of them carry Hijaz-specific numbers is UNVERIFIED (the full suite cannot run locally). Lane C has a stop condition for it |
| AD8 | Mutant retargets in 6.8 (F6/9, Gsus4, F6/9) are a starting point, re-simulated in Lane B | measured on capped data only |
| AD9 | Centred ding radius is 0.2 | the literal Amara 9 and Hijaz ship |
| AD10 | Even rim counts keep today's angles under the centred default | the two anchors coincide for even counts |
| AD11 | Constant name `DEFAULT_DECK` | none |
| AD12 | Lane E adds three mutants; the 14 existing mutants touching `layout.js` are kept | all 14 re-proven on the prototype (6.6) |
| AD13 | The new decks' layouts are documented as "solver-generated, not verified against an instrument" | they were not measured from a physical pan |
| AD15 | Amara 9 is updated by inserting the engine's two extra cards at the engine's positions (12 and 26) into the shipped entry. `degrees`, `geom`, `fields`, `colors`, `print` are not regenerated | the engine's `degrees` differ from the shipped ones (6.2); D16 asked for cards only |
| AD16 | `rank`, `cap`'s callers' ordering and `ALTERNATE_CAP` stay. `cap`, `trimToNames`, `CAP_BASE`, `CAP_HINGE` and the `cap` export are deleted | dead code after D16; `rank` still orders the deck |
| AD17 | Both sequence goldens are regenerated in Lane U2. Acceptance for the BASIC golden: mapped from index to chord name, every Amara 9 row equals the old row | BASIC deals the same chords (6.11); only indices shift. The tier golden's Amara 9 rows change in content, which follows from D16 |
| AD18 | "S7: a custom D Kurd 9 deck deals HARD with no extended card" moves to the augmented hexatonic seed `(C3) Eb3 E3 G3 Ab3 B3 C4 Eb4 E4` | the only measured seed with no extended card uncapped; its mutant still dies (6.10) |
| AD19 | Stored custom decks grow under D16 and redraw under D14 with no notice to the user | follows from both decisions; ids and share links are stable |

AD14 of revision 3 is gone: it is owner decision D14.

### 9.3 Open

Each open question names its lane and the acceptance for each supported
answer. Any other answer means: stop and re-plan. Do not improvise.

| # | Question | Recommendation | Blocks | Supported answers and acceptance |
|---|---|---|---|---|
| OQ-U1 | D16 said "Everywhere". Pygmy cannot be regenerated without also changing its hand-declared Fm9 voicing and its geom (6.10). Should Pygmy gain the one card the uncapped engine adds, `Fmadd9 [5,7,8,6]` at position 6? Doing so also changes Pygmy's MEDIUM progressions: a third colour family appears and takes about a third of colour deals (6.11) | **A: leave Pygmy at 52.** The owner's option text said Pygmy was unmeasured, and the MEDIUM shift was not asked for | Lane U2 | **A, leave:** Pygmy byte-identical; `divergence_v1.json` records Fmadd9 as a declared difference; totals 98 and 176. **B, insert Fmadd9 only:** Lane U2 also owns the Pygmy entry, the two Pygmy PDFs, the Pygmy rows of every fixture, the `pygmy` literals in `tests/sequence.test.js` (S1 colour families, "MEDIUM enumeration reports truncation ...", "R-9 ...", "tierOf returns null ..."), and CLAUDE.md "52 chords, 31 distinct chord names" becomes 53 and 32; totals 99 and 177. **C, regenerate Pygmy from the engine:** not supported, it rewrites Fm9 and the geom. Re-plan |
| OQ-U2 | With no cap, nothing bounds a custom deck. Worst case measured: 329 cards, a 37-sheet PDF, built in well under a second (6.10). Is "no bound" intended, or does the owner want a high safety bound | **No bound**, as the owner said. Nothing measured is slow | nothing (informational) | **No bound:** as planned. **A bound:** Lane U1 keeps `trimToNames` with the owner's number and `s_cap_*` are rewritten rather than deleted. Re-plan Lane U1's mutant list |
| OQ10 | A custom deck with a built-in's exact notes is allowed (section 8) | Leave as is | none | **Leave:** no lane, no test. **Detect:** new behaviour for all five decks. Separate plan |
| OQ11 | Rerun the Amy progression evaluation for the two decks and for the grown Amara 9 | Later, separately | none | **Later:** no lane. **Now:** a docs-only task after Lane B |

Closed in revision 4: OQ-L1 (D15), OQ-L2 (D13), OQ-L3 (D14), OQ9 (D16).

## 10. Lanes

**Strictly serial. Parallel dispatch is forbidden.** Reasons: all six lanes
edit `index.html`; Lanes A, U2, B and C edit `tests/app.test.js`; Lanes E
and U1 each rewrite an engine region and Lanes U2 and B rewrite the DECKS
line, each of which mutants anchor on. Two branches that merge cleanly as
text can still redden `main` here (CLAUDE.md, "Hard constraints"). Each lane
branches from `main` only after the previous lane's PR is merged and `main`
is fast-forwarded. This is a single serial lane run six times, not a
`/swarm` wave.

Order and why:

1. **Lane A**, the seam. It removes the tests' assumption that `DECKS[0]` is
   the default or the booted deck. No behaviour change.
2. **Lane E**, the engine's centred default. Before the data, because the
   two decks must be generated by the solver that ships.
3. **Lane U1**, the engine cap removal. Before the data for the same reason.
   After E so the engine corpus fixture is regenerated on a settled layout.
4. **Lane U2**, Amara 9 grows to 27 cards. Blocked on OQ-U1. Before B so the
   three-deck fixtures move once on their own, and B then only adds rows.
5. **Lane B**, the two decks.
6. **Lane C**, the default flip.

`main` is shippable after every lane. After U1: custom decks uncapped,
built-ins unchanged. After B: five decks, Hijaz still the default.

Standing merge gates for every lane:

- Work in a dedicated worktree on a `claude/*` branch. Never the live
  checkout.
- Tests first, then implementation.
- CI green at the head SHA, verified with
  `gh pr view <n> --json state,headRefOid` against the local tip.
- A fresh reviewer subagent returns PASS or PASS_WITH_NITS at that same SHA.
- No full `tests/e2e.test.js` and no full `tests/mutation_check.sh` locally.
  CI is the oracle. Never edit a worktree while `mutation_check.sh` runs.
- `FLOORS` rows in `tests/suite_health.py` (test counts per test file) and
  the README mutant count are set from the CI run's artifacts, not computed
  locally.
- New CLAUDE.md text carries no `file:line` reference.
- Every new or re-cut patch follows the authoring rules in section 11.
- A third review FAIL on one lane: regroup per the global AFK rule.

### Lane A: default-deck seam (no behaviour change)

**Goal:** one named constant holds the cold-start deck, and no test treats
array position 0 as the default or the booted deck.

**Owns:**
- `index.html` app JS outside every generated region: the `let deckId`
  initialiser, `deck()`, `deleteDeck`, the new constant, and the stale
  comment "the three built-ins on one line" (reworded to name no count).
- `tests/app.test.js`: "an unknown stored deck id falls back to the first
  deck" (renamed "... falls back to the default deck"), "a non-string stored
  deck id is ignored and never eats a share link", "the hit layer is emitted
  after everything it sits over", "a note name cannot break out of the hit
  target's attributes".
- `tests/layout.test.js`: `labelShape()` only.
- `tests/e2e.test.js` (second review F1, widened by third review F1), owned
  BY PATTERN, not by name: every test that reads the booted deck by array
  position, in either spelling - `meta[0]` (7 occurrences on `main`) or
  `(await decksMeta())[0]` (50 occurrences across 46 tests on `main`). The
  earlier named list was wrong twice over: three of the seven `meta[0]`
  tests were unnamed, and "only the face that is showing ..." has no
  `meta[0]` at all. Also owned: "deleting the selected deck falls back to a
  built-in with a visible message"; "six custom decks keep the chip row on
  one line with the active chip in view"; plus one new page helper,
  `bootMeta`, beside `decksMeta`. Within an owned test the lane changes the
  position read and nothing else.
- Mutants, hand re-cut: `d_deck_copies_registry.patch`,
  `d_no_deck_fallback.patch`, `d_registry_ignored.patch`,
  `d_deck_id_untyped.patch`.
- Mutants, context refresh by `tools/refresh_mutants.py`:
  `d_delete_keeps_record.patch`, `d_delete_moves_selection.patch`,
  `d_delete_silent.patch`, and `d_edit_moves_selection.patch` if the refresh
  check flags it.

**Reads only:** `data/decks.json`, `tools/sandbox.js`,
`tests/suite_health.py`.

**Changes:**
- Add `const DEFAULT_DECK = "hijaz";` beside `STORE_KEY`.
- The initialiser, `deck()` and `deleteDeck` use it. `DECKS[0]` stays only as
  the last resort inside `deck()`.
- `labelShape()` and the two `DECKS[0]` app tests pick Hijaz by id.
- The two fallback tests assert the default id, read from the app.
- e2e: a helper beside `decksMeta` returns the meta row of the deck the page
  booted (looked up by the page's own `DEFAULT_DECK`, not by position).
  Every `meta[0]` and every `(await decksMeta())[0]` reader uses it. A read
  that genuinely means "the first deck in the picker" (not "the booted
  deck") keeps its position read and is listed in the PR body with the
  reason; the acceptance greps then exempt exactly those lines. The delete-fallback test asserts the active
  chip is the `DEFAULT_DECK` chip instead of `on[0] === chips[0]`, and takes
  its chip count from `decksMeta().length` instead of the literal 3. The
  six-custom-decks test asserts `decksMeta().length + 6` instead of `3 + 6`.

**TDD order:**
1. Edit the four app tests and `labelShape()` to read by id and to expect
   the app's `DEFAULT_DECK`. They go red (no such constant).
2. Add the constant and route the three fallbacks through it. Green.
3. Convert every position reader in `tests/e2e.test.js`. On `main`'s data
   they must pass unchanged in meaning: Hijaz is both position 0 and the
   default.
4. Re-cut and refresh the mutants.

**Acceptance:**
- `node --test tests/app.test.js tests/layout.test.js` green.
- `node tools/boot_sim.js` prints `count = 1 / 19`.
- `git diff main -- index.html` touches no generated region.
  `python3 tools/validate.py` passes.
- `node --test tests/mutation_harness.test.js` green.
- `python3 tools/refresh_mutants.py --check` exits 0.
- `grep -c 'meta\[0\]' tests/e2e.test.js` is 0 and
  `grep -c 'decksMeta())\[0\]' tests/e2e.test.js` is 0 (or equals the
  number of exempted first-in-picker reads named in the PR body), and the
  literals `chips.length, 3` and `3 + 6` are gone.
- e2e is green in CI at the head SHA. No local full e2e run.
- Each of the four re-cut patches still names the same `# kills:` test and
  dies for that reason in CI output.
- Mutant count unchanged at 682.

**Verify:**
`node --test tests/app.test.js tests/layout.test.js tests/mutation_harness.test.js && node tools/boot_sim.js && python3 tools/validate.py`,
then a sample of the converted e2e tests by name (the two fallback tests
and three position readers), CI being the oracle for the rest:
`CHROME_BIN=<path> node --test --test-name-pattern "<name>" tests/e2e.test.js`.

**Non-goals:** changing the default; adding a deck; touching `save()`; any
engine file; any e2e test that reads no deck by position; any change inside
an owned e2e test beyond the position read.

**Stop conditions:** any hand re-cut outside the named four; any e2e test
fails in CI that does not fail on `main`; an e2e mutant whose `# suite:`
names a converted test survives.

### Lane E: centred-ding default in the layout solver

**Goal:** a seed with no inner notes draws a centred ding with its lowest
rim note at bottom centre; a seed with inner notes draws exactly what it
draws today (D12 to D15).

**Owns:**
- `src/engine/layout.js`, including its header comment.
- The `<!-- engine:layout begin -->` region of `index.html`, written by
  `python3 tools/inline_engine.py` only.
- `tests/layout.test.js`: the five tests named in 6.6, plus the new tests
  below.
- `tests/fixtures/engine_corpus_v1.json` (by `node tools/regen_engine_corpus.js`).
- `tests/fixtures/gen_face_v1.json` (by
  `node tools/regen_card_fixture.js --gen`; the `--gen` flag is required).
- Three new patches: `g_centred_default_ignored.patch`,
  `g_bottom_anchor_dropped.patch`, `g_bottom_anchor_side_flipped.patch`.
  The 14 existing patches touching `layout.js` only if
  `tools/refresh_mutants.py --check` flags their context.
- `docs/ENGINE-SPEC.md` (section 4: the ding rule, the odd-rim anchor, the
  mirror polarity note), `docs/SCALE_ENGINE_PLAN.md` (row D12, marked
  superseded with a pointer to this plan), `CLAUDE.md` and `README.md` (the
  Lane E text in section 13), `tests/suite_health.py` (`FLOORS` row for
  `tests/layout.test.js`), `README.md` (mutant count).

**Reads only:** `data/decks.json`, the `const DECKS` line, every other engine
module, `tools/gen_deck.js`, `tests/fixtures/card_face_v1.json`,
`pan_render_v1.json`, `golden_decks_v5.json`.

**Changes (shape of the prototype in 6.6, written fresh, not copied):**
- `isCentred(counts)`: `counts.inner === 0`, evaluated after positional
  spill.
- `rimAnglesFromBottom(count)`: `rimAngles(count)` for even counts; for odd
  counts 270 first, second note to the left. `rimAngles` stays for the
  offset branch.
- `geometry()` uses `ding_dy` 0 and `r_ding` 0.2 when centred, for the ding
  point, the clearance, the reach and the emitted keys.

**TDD order (red first):**
1. "a pan with no inner notes draws a centred ding, and any inner note moves
   it off centre": asserts `ding_dy` and `r_ding` at 5 to 11 rim notes
   (centred), at 9 rim `/` 2 inner (offset), at 12 top notes with NO `/`
   (offset: 11 rim + 1 inner; reviewer F4), at 13 top notes with no `/`
   (offset), and at 9 rim + 2 bottom with no inner (centred).
2. "an odd centred rim starts at bottom centre and keeps each note on its
   side": asserts the 5, 7, 9 and 11 rows of the table in 6.6, unmirrored
   and mirrored, and that every note other than the first and last has the
   same sign of `cos(angle)` as on `main` (D14).
3. "a stored order and mirror draw the same sides on an odd rim" (reviewer
   F2): builds a nine-rim seed with a non-default `order` and with
   `mirror: true`, and pins the full angle list for each.
4. "even rim counts are untouched by the centred default": 6, 8 and 10,
   both hands, equal the literals in 6.6.
5. "the centred default reproduces the shipped Amara 9 and Hijaz layouts":
   runs both maker strings with mirror and compares angles and `rim`,
   `r_ding`, `r_note`, `n_in`, `inner_ring` with the shipped entries.
6. Rewrite the five pinned tests. The two nine-field zig-zag tests move to
   the Pygmy seed (inner pair, offset branch). "the default is right-first
   and mirror is left-first" states the polarity per parity: even counts as
   today, odd counts second-note-left. "the ding keeps the D12 offset
   geometry on every generated pan" splits by branch. "the rim ends at top
   centre and is evenly spread" asserts the bottom anchor for odd centred
   rims and the top anchor otherwise.
7. Implement. Run `python3 tools/inline_engine.py`. Regenerate the two
   fixtures.
8. Three new mutants (section 11).
9. Docs.

**Acceptance:**
- `git diff main -- data/decks.json` is empty, and the `const DECKS` line is
  byte-identical.
- `node tools/regen_card_fixture.js` and `node tools/regen_pan_fixture.js`
  leave `card_face_v1.json` and `pan_render_v1.json` byte-identical: no
  shipped card redraws.
- `python3 -m unittest discover -s tests -t .` green with no Python test
  edited.
- `node --test` green for `layout`, `core`, `app`, `share`, `select`,
  `preview`, `sequence`, with `share`, `select`, `preview` and `sequence`
  unedited.
- `python3 tools/inline_engine.py --check` and `python3 tools/validate.py`
  pass.
- `node tools/gen_deck.js "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5"` (no
  `--mirror`) gives field angles 270, 230, 310, 190, 350, 150, 30, 110, 70
  and `ding_dy` 0.
- The diff of `engine_corpus_v1.json` touches only `r_ding`, `ding_dy` and
  `f_ding`.
- The label-fits-its-circle bound and the no-overlap sweep in
  `tests/layout.test.js` hold over N = 5 to 19, centred and offset.
- Each of the 14 existing mutants still dies in CI for the test its
  `# kills:` names.
- A custom deck's id and share URL are the same before and after
  (`tests/share.test.js` green with no edit).
- Mutant count 685.
- CI green, including the e2e job.

**Verify:**
`python3 tools/inline_engine.py --check && python3 tools/validate.py && for f in layout core app share select preview sequence mutation_harness; do node --test tests/$f.test.js || break; done && python3 -m unittest discover -s tests -t .`

**Non-goals:** any other engine module; deck data; the three shipped decks'
geom; label ratios; `ext` derivation; bottom-shell layout; inner-pair
layout; the mirror toggle's polarity; a layout version in the seed.

**Stop conditions:**
- Any shipped deck's data, rendered card or fixture row changes.
- A deck id or share URL changes.
- Any seed with an inner note changes any angle or geom key.
- Any of the 14 existing mutants needs a retarget (all 14 died on the
  prototype, so a survivor means the implementation differs from it).
- More than five e2e tests fail in CI that pass on `main`. Stop and report
  the list.
- The label-fit bound fails for any centred pan.

### Lane U1: remove the deck size cap from the engine

**Goal:** `HPE.select.build` returns every ranked card for every seed (D16).
No shipped deck's data changes in this lane.

**Owns:**
- `src/engine/select.js`; the `<!-- engine:select begin -->` region of
  `index.html`, written by `python3 tools/inline_engine.py` only.
- `tests/select.test.js`: the seven tests named in 6.10 and one new test.
- `tests/fixtures/divergence_v1.json` (the `extra` lists for Pygmy and
  Amara).
- `tests/fixtures/engine_corpus_v1.json` (by
  `node tools/regen_engine_corpus.js`).
- `tests/sequence.test.js`: "S7: a custom D Kurd 9 deck deals HARD with no
  extended card" only (AD18).
- `tests/test_gen_deck.py`: `CHORDS_TOP_ONLY` and the page-count
  expectations. `tests/test_pdf_parity.py`:
  `test_a4_is_letter_shifted_on_the_page` only.
- Mutants deleted: `s_cap_slope.patch`, `s_cap_flat.patch`,
  `s_cap_removed.patch`, `s_cap_hinge.patch`, `s_cap_widened.patch`. New:
  `s_trim_reintroduced.patch`. Re-proven, refreshed if flagged:
  `s_registerclass_guard_dropped`, `s_tier_order_swapped`,
  `sqr_15_hard_two_nonanchor_branch_dropped`, `c_gen_page_count`,
  `c_blurb_spurious_line`, `c_gen_chord_count_off_by_one`,
  `c_gen_warning_off_the_sheet`, `g_pdfcards_a4_rescales`,
  `et_corpus_check_blind`.
- `tools/gen_deck.js` (the preset comment only), `docs/ENGINE-SPEC.md`
  (section 8), `docs/SCALE_ENGINE_PLAN.md` (row D1, marked superseded),
  `tests/suite_health.py` (`FLOORS` rows of the edited test files),
  `README.md` (mutant count and any sentence naming the cap).

**Reads only:** `data/decks.json`, the `const DECKS` line, the six PDFs,
`src/engine/sequence.js`, every other fixture.

**Changes:**
- Delete the two cap lines in `build`, then `cap`, `trimToNames`,
  `CAP_BASE`, `CAP_HINGE` and the `cap: cap` export (AD16). `rank`, `order`
  and `ALTERNATE_CAP` are untouched.

**TDD order (red first):**
1. New test "no deck is trimmed: every ranked card of a seed is in the
   deck": D Kurd 9 builds 49 names, the twelve-note pan 35 cards / 27 names,
   the nineteen-field maximum 74 / 43.
2. Rewrite or delete the cap tests. "a deck that overflows its cap loses
   whole names ...", "no generated deck exceeds its own size-scaled cap",
   "the cap bites on the 12-note pan ...", "the cap scales with pan size
   ...": deleted (they test deleted code). "the deck cap counts chord NAMES,
   so alternates cannot evict a chord": rewritten to assert that alternates
   sit beside their primary and none is dropped. "canonical order: root
   degree, then tier, then the quality rank": expected literal gains the
   cards the cap was removing.
3. `divergence_v1.json`: Amara `extra` gains Fadd9 `[5,7,8,6]` and Cadd9
   `[2,4,6,3]`; Pygmy `extra` gains Fmadd9 `[5,7,8,6]`. Lane U2 then
   removes the Amara rows again.
4. S7 moves to the augmented hexatonic seed.
5. `tests/test_gen_deck.py`: the Kurd 9 preset is 49 chords and 6 sheets.
6. `test_a4_is_letter_shifted_on_the_page`: compare glyphs with an order
   that survives sub-rounding x ties (for example, match each Letter glyph
   to the nearest unused A4 glyph of the same character). The assertion
   itself (A4 equals Letter shifted, same sizes) does not weaken.
7. Implement. `python3 tools/inline_engine.py`. Regenerate the corpus.
8. Mutants. Docs.

**Acceptance:**
- `git diff main -- data/decks.json` is empty; the `const DECKS` line is
  byte-identical; `git status` shows no PDF changed.
- `grep -n 'CAP_BASE\|CAP_HINGE\|trimToNames' src/engine/select.js index.html`
  finds nothing.
- `node tools/gen_deck.js "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5"` gives 49
  chords; the Amara 10 string gives 29; the Amara 9 string with `--mirror`
  gives 27; the Hijaz string gives 19.
- `node --test` green for `select`, `core`, `sequence`, `app`, `share`,
  `preview`, `pdf`, `pdfcards`, `pdf_builtin`, `mutation_harness`.
- `python3 -m unittest discover -s tests -t .` green.
- `python3 tools/inline_engine.py --check` and `python3 tools/validate.py`
  pass.
- The 13 `select.js` mutants listed as surviving the change in 6.10 still
  die for their named tests; the nine re-proven patches die for theirs.
- Mutant count 681.
- CI green, including the e2e job.

**Verify:**
`python3 tools/inline_engine.py --check && python3 tools/validate.py && for f in select core sequence app pdf pdfcards pdf_builtin mutation_harness; do node --test tests/$f.test.js || break; done && python3 -m unittest discover -s tests -t .`

**Non-goals:** any shipped deck's data; any PDF; `rank`; `ALTERNATE_CAP`;
the sequence engine; a replacement bound (OQ-U2); UI for long decks.

**Stop conditions:**
- Any built-in's rendered card, fixture row or PDF text changes.
- A sequence test other than S7 fails.
- An e2e test fails in CI that passes on `main` and the fix is not a test
  literal. Stop and report.
- `s_registerclass_guard_dropped` or `s_tier_order_swapped` survives after
  the literal update.

### Lane U2: D Amara 9 gains its two uncapped cards

Blocked on OQ-U1. Written for answer A. Answer B adds the Owns items listed
in 9.3.

**Goal:** shipped Amara 9 holds the 27 cards the shipped engine generates
for its maker string (D16, AD15). Nothing else in the deck changes.

**Owns:**
- `data/decks.json` (the `amara` entry's `chords` list only; the printed
  chord count is derived, the stored `print.blurb` is not edited); the
  `const DECKS` line (by `tools/sync_decks.py` only).
- `D_Amara_9_Cards_Letter.pdf` and its CHORD_ONLY sibling (by
  `python3 tools/decks.py`; the other four are restored with
  `git checkout --`).
- `tests/fixtures/card_face_v1.json`, `pan_render_v1.json` (by their regen
  tools); `golden_decks_v5.json` renamed to `golden_decks_v6.json` with
  `git mv`; `print_decks_v1.json` (Amara row); `sequence_basic_golden.json`
  and `sequence_tier_golden.json` (Amara rows); `divergence_v1.json` (the
  Amara `extra` rows added in U1 are removed).
- `tests/test_deck_data.py` (`CHORD_COUNTS`, `test_deck_inventory`),
  `tests/test_fixture_integrity.py`, `tests/test_render_agreement.py`
  (`test_every_card_is_compared`), `tests/test_readme_currency.py` only if
  its literals name a count, `tests/test_pdf_build.py` (the Amara page
  counts and `test_printer_only_sheets_contain_only_chord_cards` literals,
  which live here, not in `test_print.py`), `tests/test_print.py`
  (`test_amara_blurb_is_unchanged`), `tests/test_gen_deck.py` (the
  `len(decks.AMARA["chords"]) == 25` literal).
- `tests/sequence.test.js` (third review F2): the literal
  `amara: [1, 9, 15, 17, 22]`; the Amara node counts
  (`amara: { intermediate: 1548, ... }`); `COUNT = { ..., amara: 15, ... }`;
  the in-file golden table's Amara rows; and S2's sample size (below). The
  third review measured 9 sequence tests, 4 app tests, 1 `pdf_builtin` test
  and 12 Python tests failing on the data change; every one of them is
  owned by this lane, by failure, whether or not it is named here.
- S2 ("amara advanced length 6 ... within 6 pp of 33.3%") fails at the
  current sample size from sampling noise alone (27.3% observed; 3000 deals
  give 32.1%). Fix: raise N, keep the 6 pp band unchanged. Widening the
  band is not allowed.
- `tests/app.test.js`: "every rendered face is well-formed markup (96 cards
  x 2 modes)" (renamed to 98) and the pre-lane-base DOM test's Amara rows.
  `tests/pdf_builtin.test.js`: the `19 + 52 + 25` literal and the test name.
- `tests/mutants/b_*.patch` (11 regenerated), `c_deck_data_drift.patch`
  (hand re-cut), `f_fixture_sha.patch` (path follows the rename).
- `tests/suite_health.py` (`FLOORS`), `README.md`, `CLAUDE.md` (the Lane U2
  text in section 13), `tests/CONTRACT.md` (the two mentions of 96).

**Reads only:** `src/engine/*.js`, the engine regions, `tools/gen_deck.js`,
`tools/hifi.py`, the Hijaz and Pygmy entries.

**Procedure (no hand-written voicing):**
1. `node tools/gen_deck.js "(D3) A3 C4 D4 E4 F4 G4 A4 C5" --mirror --out <scratch>/amara9.json`.
2. A throwaway script outside the repo replaces the shipped `amara.chords`
   with the engine's 27 chord objects. TDD step 1 proves the other 25 did
   not move.
3. `python3 tools/sync_decks.py`; `python3 tools/decks.py`; restore the four
   non-Amara PDFs; regenerate the card and pan fixtures; bump the golden
   fixture to v6 (recipe in Lane B, step 5); regenerate both sequence
   goldens with the capture scripts RECORDED in the header comments of
   `tests/sequence.test.js`, and `print_decks_v1.json`'s Amara row with the
   normaliser `tests/test_deck_data.py` names for that fixture (third
   review F3: the methods are recorded, no new script is invented). The
   check stays: the output for Hijaz and Pygmy must equal the committed
   rows before the Amara output is trusted.
4. Commit so the tree is clean. `python3 tools/regen_data_mutants.py`.
   Re-cut `c_deck_data_drift.patch` by hand.

**TDD order (red first):**
1. `tests/test_gen_deck.py` or `tests/test_deck_data.py` (Lane U2 owns the
   new test wherever it lands): `test_amara_9_chords_equal_a_fresh_engine_run`
   asserts the canonical `amara.chords` equal the engine's output for the
   maker string with mirror, and that removing Fadd9 and Cadd9 leaves the
   25 chords of `golden_decks_v5.json` in order.
2. Count literals: 27, 98, the Amara PDFs at 4 sheets.
3. Sequence: the anchor index literal; the goldens. Assert AD17's
   name-equivalence for the BASIC golden in a scratch script outside the
   repo and record its output in the PR.
4. Data, sync, fixtures, PDFs, mutants. Docs.

**Acceptance:**
- The Hijaz and Pygmy entries are byte-identical to `main` when extracted
  by id. Amara 9's `geom`, `fields`, `degrees`, `colors` and `print`
  keys are byte-identical.
- `python3 tools/validate.py` prints "all checks passed (98 cards)".
- `python3 tools/sync_decks.py --check` reports no drift.
- Exactly two PDFs differ from `main`; `test_committed_pdfs_match_a_fresh_build`
  passes.
- `git diff main -- src/engine` is empty.
- All Node unit suites and the Python suite green.
- Every `b_*` patch and `c_deck_data_drift.patch` has a preimage that occurs
  exactly once. `KNOWN_NON_UNIQUE_ANCHORS` stays empty.
- Mutant count 681.
- CI green, including all mutation shards, e2e and both `panel-fit` jobs.

**Verify:**
`python3 tools/validate.py && python3 tools/sync_decks.py --check && python3 tools/regen_data_mutants.py --check && python3 tools/refresh_mutants.py --check && python3 -m unittest discover -s tests -t . && for f in app sequence select pdf_builtin mutation_harness; do node --test tests/$f.test.js || break; done`

**Non-goals:** Hijaz; Pygmy (answer A); any engine file; Amara 9's geometry,
degrees or subtitles; the new decks.

**Stop conditions:**
- Any of the 25 existing Amara 9 cards changes in `fields`, `roots` or
  `subtitle`.
- The BASIC golden, mapped to chord names, is not identical to the old one.
- A sequence test fails for Hijaz or Pygmy.
- The recorded capture scripts cannot reproduce the committed Hijaz and
  Pygmy rows.
- S2 still fails after N is raised with the band unchanged.
- A test outside the Owns list fails.

### Lane B: the two decks (data, print, counts, fixtures, mutants, docs)

Blocked on Lanes E, U1 and U2 being merged.

**Goal:** `kurd` (49 cards) and `amara10` (29 cards) are the first two
built-ins, adopted from the shipped engine with no hand-written number.

**Owns:**
- `data/decks.json`; the `const DECKS` line of `index.html` (written by
  `tools/sync_decks.py` only).
- `tools/decks.py` (`KURD`, `AMARA10` only; not `__main__`),
  `tools/validate.py` (`PY`), `tools/regen_data_mutants.py` (`MUTANTS`),
  `tools/pdf_build.js` (header comment).
- `tests/test_deck_data.py`, `tests/test_print.py`,
  `tests/test_render_agreement.py`, `tests/test_fixture_integrity.py`,
  `tests/test_pdf_parity.py` (`BUILTINS` and the id-set literal),
  `tests/test_gen_deck.py` (one new test), `tests/pdf_builtin.test.js`,
  `tests/app.test.js` (the four data tests in 6.3 plus the new order test),
  `tests/e2e.test.js` ("the landscape deck strip scrolls rather than clips,
  at both ends" and the "three built-ins" comment only),
  `tests/CONTRACT.md`.
- `tests/fixtures/card_face_v1.json`, `pan_render_v1.json`;
  `golden_decks_v6.json` renamed to `golden_decks_v7.json` with `git mv`.
- `tests/mutants/b_*.patch` (11 regenerated, 2 new),
  `tests/mutants/c_deck_data_drift.patch` (hand re-cut),
  `tests/mutants/f_fixture_sha.patch` (header paths and context follow the
  rename).
- `tests/suite_health.py` (`FLOORS`), `README.md`, `CLAUDE.md`.

**Reads only:** `src/engine/*.js`, `tools/gen_deck.js`, `tools/hifi.py`,
`tools/sync_decks.py`, the engine regions and app JS of `index.html`,
`tests/paths.py`, `tests/test_pdf_build.py`, `tests/fixtures/golden_decks_v3.json`,
`print_decks_v1.json`, both sequence goldens, the six committed PDFs.

**Adoption procedure (no hand-written data):**
1. `node tools/gen_deck.js "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5" --name "D KURD 10" --out <scratch>/kurd.json`.
   Same for `"(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5"` with `--name "D AMARA 10"`.
   **No `--mirror`** (D12, D14).
2. Build each canonical entry from the payload per 6.5. Use a throwaway
   script outside the repo. TDD step 1 is what proves the result.
3. Insert at the front, then move the shipped entries into the order
   `amara, hijaz, pygmy`. Each shipped entry moves as a whole and stays
   byte-identical. Write with `json.dump(indent=2)` plus a newline, as the
   file is today.

**Sync steps, in this order:**
1. Edit `data/decks.json`.
2. `python3 tools/sync_decks.py`
3. `python3 tools/decks.py`, then `git checkout --` the six PDFs. The tool
   rewrites them with a new creation date and no text change. No PDF is
   committed in this lane.
4. `node tools/regen_card_fixture.js` and `node tools/regen_pan_fixture.js`
   (no `--gen`: these are the built-in fixtures).
5. Golden fixture: `git mv` to the next version. Add two deck rows with the
   keys in `DECK_KEYS` (`id, name, sub, colors, degrees, geom, fields,
   chords, maker_string`), copied from the canonical entries, in data order.
   Bump `version`. Recompute `sha256` as the SHA-256 of
   `json.dumps({"version": ..., "decks": ...}, sort_keys=True,
   separators=(",", ":"))`. In `tests/test_fixture_integrity.py` update
   `FIXTURE`, `EXPECTED_SHA256`, `BUMP` (it names the next version), the
   docstring and the dated comment block. Update `f_fixture_sha.patch` to
   the new path. The file is never regenerated from the engine; the rows are
   copied from the canonical data this same PR adds.
6. Re-simulate anchor uniqueness on the real five-deck file (6.8), then edit
   `MUTANTS` in `tools/regen_data_mutants.py`: the retargets that simulation
   requires and the two new entries.
7. Commit everything so the tree is clean.
8. `python3 tools/regen_data_mutants.py` on the clean tree. Commit.
9. Re-cut `c_deck_data_drift.patch` by hand on a target the simulation
   shows unique. `git diff > patch`, strip every `index a..b` line, keep the
   header lines byte for byte.
10. `python3 tools/regen_data_mutants.py --check`,
    `python3 tools/refresh_mutants.py --check`,
    `node --test tests/mutation_harness.test.js`.

**TDD order (each test is written red first):**
1. `tests/test_gen_deck.py`:
   `test_engine_adopted_builtins_equal_a_fresh_engine_run`. For `kurd` and
   `amara10`, run `tools/gen_deck.js` with the recorded maker string and no
   mirror, and assert `fields`, `chords`, `degrees` and `geom` (minus `ext`)
   equal the canonical entry.
2. `tests/test_deck_data.py`: extend `CHORD_COUNTS` (49, 29), `LAYOUTS`
   (the nine angles of D13 on both), `DEGREES`; `test_deck_inventory`
   asserts 176; `test_power_chords_are_root_and_fifth` asserts the count
   read from the adopted data.
3. `tests/app.test.js`: "the deck picker lists Kurd 10, Amara 10, Amara 9,
   Hijaz, Pygmy in that order". Rename the 98-card test to 176.
4. `tests/test_render_agreement.py`: `DECK_BY_ID` gains two ids;
   `test_every_card_is_compared` asserts 176.
5. `tests/test_print.py`: `ALL_DECKS` gains two decks. Per D9 the two
   no-shrink tests (one here, one in render agreement) iterate a named tuple
   of the three pre-rule decks.
6. `tests/test_pdf_parity.py`: `BUILTINS` gains two ids and
   `test_the_sweep_covers_every_builtin_and_both_variants` names five.
7. `tests/pdf_builtin.test.js`: loops read the ids from the canonical file;
   the count assertion becomes 176.
8. `tests/test_fixture_integrity.py`: point at the new golden version.
9. `tests/e2e.test.js`: per D7 the last block of the strip test asserts, on
   every landscape row with one custom deck added, that the strip scrolls to
   both ends and the active chip is inside the box.

**Acceptance:**
- `python3 tools/validate.py` prints "all checks passed" and "(176 cards)".
- `python3 tools/sync_decks.py --check` reports no drift.
- `python3 -m unittest discover -s tests -t .` green.
- The thirteen Node unit suites in E22 green.
- `node tools/boot_sim.js` prints `count = 1 / 19` and "exercised 176 cards".
- The picker shows five chips in the D3 order.
- Both new entries have field angles 270, 230, 310, 190, 350, 150, 30, 110,
  70 for fields 1 to 9, `ding_dy` 0 and `r_ding` 0.2.
- Each of the three shipped entries is byte-identical to `main` when
  extracted by id from `data/decks.json`.
- `git diff main -- src/engine` is empty.
- `git status` shows no PDF changed. Six PDFs are tracked.
- **Every `b_*` patch and `c_deck_data_drift.patch` has a preimage that
  occurs exactly once in `data/decks.json`.** `KNOWN_NON_UNIQUE_ANCHORS` is
  still empty and "no mutant patch outside the tracked exceptions rides a
  non-unique anchor" passes.
- Mutant count 683.
- CI green, including all mutation shards and both `panel-fit` jobs.

**Verify:**
`python3 tools/validate.py && python3 tools/sync_decks.py --check && python3 tools/regen_data_mutants.py --check && python3 -m unittest discover -s tests -t . && for f in app core layout naming select share preview pdf pdfcards pdf_builtin sequence voicing mutation_harness; do node --test tests/$f.test.js || break; done && node tools/boot_sim.js`.
Single e2e tests by name:
`CHROME_BIN=<path> node --test --test-name-pattern "<name>" tests/e2e.test.js`
for the strip test, "card lines and diagram stay inside the card at 380px"
and the seven Lane A tests.

**Non-goals:** changing the default deck; any CSS; any engine file; the three
shipped decks; sequence goldens; `print_decks_v1.json`; any PDF.

**Stop conditions:**
- The engine-equality test cannot be made green without editing a number by
  hand.
- A deck comes out with a card count other than 49 and 29. The engine in
  `main` is then not the one this plan measured.
- Any shipped deck's rendered card, fixture row or PDF text changes.
- A retargeted mutant survives, or dies for a test other than the one it
  names.
- A test outside the Owns list fails.
- `panel-fit` fails in CI.

### Lane C: Kurd as the cold-start default (no migration)

Blocked on nothing but Lane B.

**Goal:** a visitor with no stored deck boots D Kurd 10. Every stored id is
honoured as today.

**Owns:** `index.html` app JS outside every generated region (`DEFAULT_DECK`
only); `tests/app.test.js` (persistence tests in 7.3); `tests/e2e.test.js`
(the new cold-start test, and any test this lane's stop condition allows it
to edit); `tools/boot_sim.js` only if it names a count;
`tests/mutants/d_default_deck_hijaz.patch` (new) and any `d_*` patch the
one-line change moves; `tests/suite_health.py` (`FLOORS`); `README.md` and
`CLAUDE.md` (default-deck sentences).

**Reads only:** `data/decks.json`, the `const DECKS` line, engine regions,
`tests/helpers/cdp.js`.

**Changes:**
- `DEFAULT_DECK = "kurd"`. Nothing else in the app.

**e2e (AD7, reviewer's recommendation adopted).** `freshLoad()` is not
edited. Lane A already made the position readers follow `DEFAULT_DECK`, so
after this lane every e2e test that names no deck runs on Kurd: 49 cards,
nine rim fields, the longest built-in after Pygmy. That is the point of the
reviewer's recommendation (the real default is what gets tested) and its
risk (a test carrying a Hijaz-specific number fails). Which tests those are
is UNVERIFIED: the full suite cannot run locally. A failing test is fixed by
making it read its expectation from the page, or by having it select Hijaz
by id when the number is about Hijaz itself. It is never fixed by seeding
`freshLoad()`.

**TDD order:** the tests in 7.3 rows 1, 2, 3, 5, 6, 7, 8, red first. Then
the one-line change. Then the mutant. Then push and read the e2e job.

**Acceptance:**
- All tests named in 7.3 exist and pass.
- `node tools/boot_sim.js` prints `count = 1 / 49`.
- `node --test tests/app.test.js` green.
- Named e2e tests green locally: the new cold-start test, "deck and mode
  round-trip through localStorage (subset semantics)", "the card fits a
  380px viewport on load, with no horizontal overflow", "the header and
  footer stay inside their pixel budget, so the card keeps its size", "the
  full-screen settings panel fits with no scroll in every mode, at 320x568
  and every landscape size".
- `hpfc` gains no key. A store holding `deck: "hijaz"` boots Hijaz.
- Mutant count 684.
- CI green at the head SHA, e2e and both `panel-fit` jobs included.

**Verify:**
`node --test tests/app.test.js tests/mutation_harness.test.js && node tools/boot_sim.js`,
then the named e2e tests one at a time.

**Non-goals:** deck data; CSS; a migration; stopping boot from writing the
default; cross-tab sync; duplicate detection against built-ins; a seed in
`freshLoad()`.

**Stop conditions:**
- More than ten e2e tests need an individual edit. Stop and report the
  list; the fallback (seeding `freshLoad()`, revision 3's AD7) is an owner
  or reviewer call, not the lane's.
- A test fails on Kurd and the fix would need CSS. Stop: CSS is a non-goal
  and D7 covers the strip only.
- An e2e mutant survives because its `# suite:` test now runs on a
  different deck.

## 11. Test matrix

| Test | File | Asserts | Lane | Mutant that proves it bites |
|---|---|---|---|---|
| "... falls back to the default deck" | `tests/app.test.js` | unknown id | A | `d_no_deck_fallback`, re-cut |
| "a non-string stored deck id is ignored and never eats a share link" | `tests/app.test.js` | type guard | A | `d_deck_id_untyped`, re-cut |
| the seven e2e tests in Lane A's Owns | `tests/e2e.test.js` | booted deck and fallback read by id | A | existing mutants that name them; the lane greps `# suite:` and `# kills:` for each name and confirms in CI |
| "a pan with no inner notes draws a centred ding, and any inner note moves it off centre" | `tests/layout.test.js` | D15, including the 12-top-note no-slash seed | E | new `g_centred_default_ignored.patch`: `isCentred` always returns false |
| "an odd centred rim starts at bottom centre and keeps each note on its side" | `tests/layout.test.js` | D13, D14 | E | new `g_bottom_anchor_dropped.patch`: the centred branch calls `rimAngles`; new `g_bottom_anchor_side_flipped.patch`: the sign in `rimAnglesFromBottom` is inverted (reviewer F6) |
| "a stored order and mirror draw the same sides on an odd rim" | `tests/layout.test.js` | reviewer F2 | E | `g_bottom_anchor_side_flipped` as secondary; `l_order_ignored` and `g_mirror_ignored` keep their own named tests |
| "even rim counts are untouched by the centred default" | `tests/layout.test.js` | AD10 | E | none new; a regression pin |
| "the centred default reproduces the shipped Amara 9 and Hijaz layouts" | `tests/layout.test.js` | angles and circle geom | E | `g_centred_default_ignored` as secondary |
| "ET-1 engine corpus matches" | `tests/core.test.js` | regenerated corpus | E, U1 | `et_corpus_check_blind` |
| "no deck is trimmed: every ranked card of a seed is in the deck" | `tests/select.test.js` | D16 | U1 | new `s_trim_reintroduced.patch`: `build` slices the ranked list to 25 names |
| "canonical order: root degree, then tier, then the quality rank" | `tests/select.test.js` | order, new literal | U1 | `s_registerclass_guard_dropped`, `s_tier_order_swapped`, re-proven |
| "the generated decks diverge from the built-ins exactly as committed" | `tests/select.test.js` | `divergence_v1.json` | U1, U2 | existing mutants that name it |
| S7, on the augmented hexatonic seed | `tests/sequence.test.js` | HARD with no extended card | U1 | `sqr_15_hard_two_nonanchor_branch_dropped` (re-proven in scratch) |
| `test_a4_is_letter_shifted_on_the_page` | `tests/test_pdf_parity.py` | A4 is Letter shifted | U1 | `g_pdfcards_a4_rescales`, re-proven |
| `test_amara_9_chords_equal_a_fresh_engine_run` | Lane U2 picks the file | 27 chords equal engine output; the old 25 intact | U2 | regenerated `b_*` family |
| the sequence golden tests | `tests/sequence.test.js` | regenerated goldens | U2 | existing `sq*` mutants; the lane confirms in CI |
| `test_engine_adopted_builtins_equal_a_fresh_engine_run` | `tests/test_gen_deck.py` | canonical Kurd and Amara 10 equal engine output | B | new `b_adopted_deck_drifts.patch`: one Kurd voicing field changed in both files |
| "the deck picker lists Kurd 10, Amara 10, Amara 9, Hijaz, Pygmy in that order" | `tests/app.test.js` | chip id order | B | new `b_picker_order_swapped.patch`: the `kurd` and `amara10` entries swapped in both files |
| `test_deck_inventory` | `tests/test_deck_data.py` | 3 decks, 98 cards (U2); 5 decks, 176 cards (B) | U2, B | regenerated `b_*` family |
| `test_voicings_unique_within_deck`, `test_roots_appear_in_voicing` | `tests/test_deck_data.py` | data invariants | B | `b_duplicate_voicing`, `b_root_not_in_voicing`, retargeted per the Lane B simulation |
| `test_committed_pdfs_match_a_fresh_build` | `tests/test_pdf_build.py` | six PDFs current | U2, B | `c_deck_data_drift`, re-cut |
| the two no-shrink tests | `tests/test_print.py`, `tests/test_render_agreement.py` | three pre-rule decks | B | existing mutants that name them; the lane confirms each still dies in CI |
| "the landscape deck strip scrolls rather than clips, at both ends" | `tests/e2e.test.js` | scrolling, active chip in view | B | existing mutants that name it; the lane confirms each still dies |
| "a first visit with empty storage opens D Kurd 10" | `tests/app.test.js` | cold-start id | C | new `d_default_deck_hijaz.patch`: constant back to `"hijaz"` |
| "a store holding hijaz from before the default changed still opens Hijaz" | `tests/app.test.js` | no migration | C | none; pins D1. Gap in section 16 |
| "a share link wins over the stored deck and becomes the stored deck" | `tests/app.test.js` | scenario 6 | C | none new; pins current behaviour |
| "two boots over one store: the last selection wins and sibling keys survive" | `tests/app.test.js` | scenario 8 | C | existing `d_save_no_guard` family |

The seven new mutants are designs. None has been written or run. The Lane E
three are expected to die on the tests above because those tests fail on
`main`'s solver for the same reason; that expectation is UNVERIFIED.

Mutant authoring rules for every new or re-cut patch:

- `# kills:` equals the test name exactly.
- `# suite:` is word-split with no shell quoting. Use `.` for every space or
  quote in a test-name pattern. No quoted patterns.
- Strip every `index a..b` line.
- The preimage must occur exactly once in the file it patches.
- The two new `b_*` mutants touch the DECKS line, so they are added to
  `MUTANTS` and produced by the tool. That makes 13 entries.
- If `tools/refresh_mutants.py` empties a patch or cannot re-anchor it, re-cut
  by hand against a stabler anchor and confirm the kill reason in CI output.

`FLOORS` rows expected to move (set from CI artifacts): `layout.test.js`
(about +4, Lane E), `select.test.js` (about -3, Lane U1), `test_gen_deck.py`
or `test_deck_data.py` (+1, Lane U2), `test_gen_deck.py` (+1, Lane B),
`app.test.js` (+1 in B, about +6 in C), `e2e.test.js` (+1 in C). README's
mutant count moves 682, 685, 681, 681, 683, 684.

## 12. Risks

| Risk | Detection | Fallback |
|---|---|---|
| Lane E redraws a shipped card | `card_face_v1.json` and `pan_render_v1.json` must be byte-identical; Python suite must pass unedited | stop condition; the shipped decks do not pass through the solver, so this means a wiring mistake |
| Lane E changes a seed that has inner notes | TDD step 1 and the corpus diff (only `r_ding`, `ding_dy`, `f_ding`) | stop condition |
| Lane E or U1 breaks e2e tests that build a custom deck | CI e2e job on the first push | stop and report (five for E; any non-literal fix for U1) |
| A user's saved custom deck looks different after Lane E, or has more cards after Lane U1 | none; by decision (D14, D16, AD19) | note in the PR body; ids and links are stable |
| A 49-card deck does not fit somewhere a 25-card deck did (counter text, sheet count in the print controls, PDF build time on a phone) | e2e and `panel-fit` in CI after Lane C; nothing measured in a browser | report to the owner; CSS is out of scope |
| An unbounded custom deck is slow or huge | measured worst case 329 cards: 6 ms build, 37-sheet PDF in 0.27 s under Node (6.10). Not measured in a phone browser | OQ-U2 |
| Lane U2's golden regeneration silently changes a Hijaz or Pygmy row | the throwaway script must reproduce the committed Hijaz and Pygmy rows first | stop condition |
| Lane U1 leaves a cap mutant or cap test half-alive | the grep acceptance line; `mutation_harness` | delete, do not rewrite |
| The default flip breaks many e2e tests | CI on Lane C's first push | fix by id or page-read; stop at ten |
| A lane hand-tunes `f_note`, an angle or a voicing to pass a test | the two engine-equality tests go red | revert; D9 scoping is the only sanctioned fix |
| Stale, ambiguous or wrong-reason mutants | `tests/mutation_harness.test.js`, `regen_data_mutants.py --check`, the CI gate, the exactly-once acceptance line | re-cut per section 11; rerun a lone unrelated survivor once at the same SHA |
| PDFs get committed with new bytes and no text change | `git status` after `tools/decks.py` | `git checkout --` them (all six in B; the four non-Amara in U2) |
| Real fonts make a chip wider than measured | E12 real-font rows; CI `panel-fit (real)` | no CSS in scope; report to the owner |
| Two Amara chips confuse users | none automatic | sub-lines and colours differ (section 8); owner chose the name |
| An old cached app rewrites the stored deck to Hijaz | none; accepted (7.3) | none needed |

## 13. CLAUDE.md and README edits (text, applied by the lanes)

**Lane E.** CLAUDE.md, "Instrument layouts", add after the session research
paragraph:

> **Generated layouts (2026-10-06, owner decisions).** The layout solver
> defaults to the Amara 9 arrangement: ding in the centre, lowest rim note at
> bottom centre (270). It moves the ding toward the player, Pygmy style, only
> when the seed has inner notes ("Only with inner notes") - whether written
> after a `/` or spilled there as top notes 12 and 13. With an odd number of
> rim notes no note sits at top centre; the two highest flank it. An even
> rim draws exactly as before. The mirror option means opposite hands on odd
> and even rims: unmirrored, an even rim puts note 2 on the right and an odd
> rim puts it on the left. That predates this change and was kept so saved
> and shared scales keep each note on its side ("Keep their sides"). Do not
> "fix" it without the owner. The three original decks are literal data and
> never pass through the solver.

`docs/ENGINE-SPEC.md` section 4 gets the same three facts as spec text: the
ding rule (`inner === 0` after spill gives `r_ding` 0.2, `ding_dy` 0;
otherwise 0.19 and 0.1425); the odd-rim anchor (lowest at 270, second note
at `270 - step`); the polarity note. `docs/SCALE_ENGINE_PLAN.md` row D12
gains "Superseded 2026-10-06: see the two-beginner-decks plan, D12 to D15."
The `layout.js` header states the same rule in one paragraph. README: the
sentence that describes generated layouts as following the Pygmy pattern
(wording UNVERIFIED, README layout text not re-read this session) is
replaced with "Generated layouts put the ding in the centre unless the scale
has inner notes."

**Lane U1.** `docs/ENGINE-SPEC.md` section 8: the cap formula, its worked
example and "applied to trim to the cap" are replaced with:

> A deck holds every card the ranking produces. There is no size cap (owner,
> 2026-10-06: "let's remove that cap", "Everywhere"). Ranking still orders
> the deck: by root degree, then tier, then quality rank, with alternates
> beside their primary. `ALTERNATE_CAP` still limits voicings per name.

`docs/SCALE_ENGINE_PLAN.md` row D1 gains "Superseded 2026-10-06: no cap."
`tools/gen_deck.js` preset comment: "three 25-chord decks and two small
ones (so a preset exercises both a 3-sheet and a 2-sheet print run)" becomes
a sentence naming no count ("decks from 13 to 49 cards, so the presets
exercise short and long print runs").

**Lane U2.** CLAUDE.md, "Decks:" paragraph: "**D Amara 9** (25 chords, fully
re-ranked by the scale engine ..." becomes "(27 chords ...". In "Verified
card conventions", the D11 supersession paragraph: "fully re-ranked to 25
cards" becomes "fully re-ranked to 25 cards, then 27 on 2026-10-06 when the
engine's size cap was removed (Fadd9 and Cadd9 joined; the other 25 cards
are byte-identical and keep their relative order)". "Known pitfalls": "all
96 cards" becomes "all 98 cards". README: "D Amara 9, 25 cards" becomes 27
and "96 cards total" becomes 98.

**Lane B.** CLAUDE.md, "What this project is": "three specific handpans"
becomes "five handpans". The "Decks:" paragraph opens:

> Decks, in picker order: **D Kurd 10** (49 chords) and **D Amara 10** (29
> chords, 27 distinct chord names), both added 2026-10-06 as engine output
> for their maker strings and never hand-edited; then **D Amara 9** (27
> chords), **C# Hijaz / Orion 9** (19 chords) and **F3 Low Pygmy 18** (52
> chords, 31 distinct chord names). 176 cards in all. The two new decks have
> no committed PDF; the app builds theirs in the browser.

CLAUDE.md, a NEW subsection after "Instrument layouts (verified - do not
"correct")", so the new pans are not filed under "verified":

> ## Solver-generated layouts (not verified against an instrument)
>
> **D Kurd 10** - Ding D3 centre. Nine rim fields, same direction as Amara 9
> (even numbers on the left): 1 A3 @270, 2 Bb3 @230, 3 C4 @310, 4 D4 @190,
> 5 E4 @350, 6 F4 @150, 7 G4 @30, 8 A4 @110, 9 C5 @70. Nothing at top
> centre.
> **D Amara 10** - the same nine angles: A3, C4, D4, E4, F4, G4, A4, C5, D5.
> Fields 1 to 8 carry the same notes as D Amara 9; field 9 is D5.
> These are engine output for the maker strings, generated WITHOUT the
> mirror option. Nobody measured them from a physical pan. Change them by
> changing the solver or the seed, never by hand.

CLAUDE.md, "Design system", palettes list, add:

> - Kurd: blue `#2563B0` / brick `#C0452C`
> - Amara 10: green `#3B7A2A` / crimson `#B3263A`

CLAUDE.md, degrees bullet, add:

> Kurd {D:i, E:ii°, F:III, G:iv, A:v, Bb:VI, C:VII};
> Amara 10 {D:i, E:ii°, F:III, G:iv, A:v, C:VII} - E keeps `ii°` with no card
> rooted on E (owner, 2026-10-06). Amara 9 has no E entry and stays so.

CLAUDE.md, label rule section, after the sentence that defines the no-shrink
baseline (D9):

> The no-shrink baseline is asserted for the three decks that existed before
> the rule: Hijaz, Pygmy and Amara 9 (owner, 2026-10-06: "Test the old three
> only"). A deck adopted from the engine after the rule never drew anything
> before it, so it has no baseline. Its `f_note` is the solver's rounded
> figure and can sit 0.03% above what the rule draws. Every other label test
> (name larger than number, the 3.6 pt floor, render agreement) runs on all
> five decks.

CLAUDE.md, "Known pitfalls": "all 98 cards" becomes "all 176 cards". Other
"96 cards" mentions in the label-rule section ("any of the 96 cards") are
updated to the count of the lane that touches them.

README, "Decks included": five decks with 49, 29, 27, 19 and 52 cards and
"176 cards total". "the three instrument layouts" becomes "the five
instrument layouts". "the six committed PDFs" stays, with one added sentence:
the two beginner decks print from the app only. The mutant count follows CI.

If the owner answers OQ-U1 with B, every 52 above is 53, "31 distinct chord
names" is 32, and the totals are 99 and 177.

**Lane C.** CLAUDE.md, "Known pitfalls", add:

> **Default deck:** the cold-start deck is the `DEFAULT_DECK` constant
> (`kurd`), not `DECKS[0]`. Picker order is the array order of
> `data/decks.json`. They are two facts. A stored deck id is always honoured;
> nothing migrates a visitor who stored `hijaz` before 2026-10-06.

## 14. Rollback

- Revert in reverse order: C, B, U2, U1, E, A.
- Reverting C alone: the default returns to Hijaz. A browser that stored
  `kurd` or `amara10` still opens that deck. No stored key needs cleaning,
  because none was added.
- Reverting B after C: a browser that stored `kurd` or `amara10` falls back
  to the default deck and the store is rewritten on that boot (E4, the
  `"nope"` case). Custom decks are untouched.
- Reverting B without C leaves `DEFAULT_DECK` naming a missing deck. `deck()`
  uses its last resort. It works. Do not do it.
- Reverting U2 alone: Amara 9 returns to 25 cards and its two PDFs to 3
  sheets. `divergence_v1.json` must get its two Amara rows back, or the
  select suite is red.
- Reverting U1 or E after B: an engine-equality test goes red, because the
  adopted data no longer equals engine output. Revert B (and U2 for U1)
  first. Reverting either alone, before B, returns custom decks to the cap
  or to the offset ding. Ids and links are stable both ways.
- No migration or deploy step exists to undo.

## 15. Questions the third eng review should press

- **Is one card worth a hand edit of Pygmy?** OQ-U1. The plan recommends no.
- **Is Lane U2's golden regeneration trustworthy without a committed tool?**
  The guard is "reproduce the committed Hijaz and Pygmy rows first". The
  reviewer should say whether a committed regen tool belongs in the lane.
- **Is AD7's reversal safe?** Revision 3 seeded `freshLoad()` because the
  full e2e suite cannot run locally. Revision 4 follows the reviewer and
  does not seed. Lane C's stop at ten is the only brake.
- **Does anything in the UI assume a deck of about 25 cards?** Not measured
  in a browser (section 17).
- **Does Lane E change anything a user stored?** Not ids or links. It changes
  how stored rim-only custom decks draw, each note staying on its side.
- **Why do E and U1 come before the data?** The adopted decks must equal the
  shipped engine's output, or the equality tests are red from day one.
- **Should U1 and U2 be one lane?** They are split so that `main` between
  them has an uncapped engine and untouched shipped data, with the
  difference recorded in `divergence_v1.json`.
- **Data flow.** `tools/gen_deck.js` payload, adopted into
  `data/decks.json`, then `tools/sync_decks.py` writes the `const DECKS`
  line, and `tools/decks.py` reads the same file through
  `_from_canonical(id)`. `tools/validate.py` check 1 pins the app copy and
  check 1b the print adapter (E22).
- **Performance.** The DECKS line was 13,873 bytes and grew to 21,353 with
  the two CAPPED decks (E27). With 49 and 29 cards it will be larger; the
  size was NOT measured. Render agreement and parity will cover 176 cards,
  not 96; their run time was not measured.
- **Does the print floor hold?** On capped data yes (E22, E27). The uncapped
  decks add cards, not fields, so no new glyph size arises; not rerun.
- **Do the tiers work on the new decks?** Yes, with the pools in 6.11.

## 16. Coverage gaps, stated

- The NEW decks get no sequence goldens, `print_decks_v1.json` rows,
  `tests/test_gen_deck.py` loops or `tests/test_font_subset.py` rows (AD6).
  Their print dicts are covered by `validate.py` check 1b, render agreement
  and PDF parity.
- The no-shrink baseline does not cover the new decks (D9).
- No mutant proves "a stored hijaz is not migrated". There is no code to
  mutate.
- `DEFAULT_DECK` replaced by `DECKS[0].id` is an equivalent mutant while Kurd
  is first.
- No committed PDF pins the new decks' print output. PDF parity compares the
  browser build with a fresh reportlab build on every run instead.
- The new layouts are not checked against a physical instrument (AD13).
- Nothing tests an upper bound on deck size, because there is none (OQ-U2).
- The mirror polarity split is pinned by tests but not explained to users
  anywhere in the app.

## 17. What was not read or run

Lane E:

- No e2e test was run against the prototype engine.
- The three new `g_*` mutants were not written or run.
- The five rewritten layout tests were not written. Only their failure under
  the prototype was observed.
- The stored-`order` test (reviewer F2) was not prototyped: no seed with a
  non-default `order` was run under the new odd-rim function.
- Only rim-only seeds of 5 to 11 notes, five seeds with inner notes and one
  seed with bottom notes and no inner were run.
- The README sentence about generated layouts was not re-read.

Lanes U1 and U2:

- No e2e test was run against the uncapped engine or against 27-card Amara
  9. The e2e literal check was a grep.
- Nothing was measured in a browser with a 49-card deck: the counter, the
  print controls' sheet count, PDF build time on a phone, `panel-fit`.
- `s_trim_reintroduced` was not written. `s_registerclass_guard_dropped`,
  `s_tier_order_swapped` and the `c_gen_*`, `g_pdfcards_a4_rescales`,
  `c_chords_only_padding`, `et_corpus_check_blind` patches were not
  re-proven after their tests change.
- The fix for `test_a4_is_letter_shifted_on_the_page` was not written. Only
  the cause was shown.
- How `sequence_basic_golden.json`, `sequence_tier_golden.json`,
  `print_decks_v1.json` and `divergence_v1.json` were first produced. No
  tool under `tools/` names them.
- AD17's claim that the BASIC golden is name-identical after the insert was
  inferred from the pool measurement in 6.11, not checked row by row.
- Pygmy with Fmadd9 inserted was run for the sequence and select suites
  only. Its print, fixtures and PDFs were not built.
- Power-chord counts on the uncapped decks.
- Whether the engine's chord objects for Amara 9 match the shipped ones in
  every key. `fields`, `roots` and `subtitle` were compared.

Lane B and C:

- Every run in E11, E12, E15, E20, E22, E23 and E27 used the capped decks
  generated with `--mirror`. None was repeated on the 49-card and 29-card
  unmirrored decks. That covers: failure tallies, anchor uniqueness, the
  overlay numbers, the DECKS line size, the seven named e2e tests, the strip
  measurements.
- The strip was measured with Hijaz active, not Kurd (E12).
- Which e2e tests fail when the booted deck becomes Kurd.
- Page counts of the browser-built PDFs for the new decks, except Kurd's 6
  sheets under Node.

Everything else:

- The full `tests/e2e.test.js`, `tests/harness.test.js` and
  `tests/mutation_check.sh`.
- Whether `d_edit_moves_selection.patch` needs a refresh.
- `tests/CONTRACT.md`, `tools/regen_pan_fixture.js`,
  `tools/probe/panel_fit.js`.
- The share-link boot path was read in code and not executed.
- A second uncapped run for byte-identical determinism.

## 18. Self-review

Rubric, 0 to 10, one sentence of evidence each.

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | Evidence | 7 | The layout and cap findings were measured in scratch with named failing tests and re-proven mutants; but every Lane B number from revision 3 was measured on capped, mirrored data and is carried forward as a site list only. |
| 2 | Executability | 7 | Six lanes each have goal, Owns, TDD order, acceptance, verify and stop conditions; Lane U2 depends on a throwaway golden script whose method is unverified, and Lane C cannot see its e2e blast radius locally. |
| 3 | Owner authority | 9 | Sixteen answers are quoted as picked with the planner's readings set apart; the one place a decision could not be applied as worded (Pygmy) is an open question, not a design. |
| 4 | Completeness | 8 | F1 to F7 and AD7 each have a disposition and a lane line; cap sites were enumerated by grep and by failure; `tests/CONTRACT.md` is still unread. |
| 5 | Ownership | 8 | Every file a lane changes is in its Owns list by path, test name or patch name; Lane U2's new test has no fixed file, and Lane C's e2e Owns is open-ended by nature. |
| 6 | Scope | 7 | The plan grew from two decks to two engine changes and a shipped-deck change, all by owner decision; six serial PRs is long, and the U1/U2 split is a judgement the reviewer may reverse. |
| 7 | Persistence | 9 | Eight scenarios with current behaviour, target and a named test; the new facts (stored custom decks grow and redraw) are stated, not tested in a browser. |
| 8 | Pitfalls | 8 | Unique-anchor acceptance, clean-tree regen, `--gen`, header rules, `FLOORS` as test counts from CI, PDF date churn and no full local suites are lines in a lane. |

This plan is not ready to execute. It needs a third eng review and the
owner's answer to OQ-U1.

Adversarial pass: the five most likely ways execution fails, and the patch
made to this plan for each.

1. **Lane U2's regenerated goldens bake in a wrong sequence.** Nothing
   committed regenerates them.
   Patch: the script must first reproduce the committed Hijaz and Pygmy
   rows; the BASIC golden must be name-identical; both are stop conditions.
2. **Lane C drowns in e2e failures it cannot see locally.**
   Patch: Lane A removes the position readers first; Lane C has a stop at
   ten and names the fallback as someone else's call.
3. **Lane B merges with an ambiguous data mutant.** The capped simulation
   no longer describes the data.
   Patch: Lane B re-simulates on the real file before editing `MUTANTS`,
   with an exactly-once acceptance line. No lint exception.
4. **A lane adopts decks from an engine other than the measured one** (for
   example U1 lands with a residual bound).
   Patch: Lane B stops if the counts are not 49 and 29.
5. **A lane "fixes" the 0.03% no-shrink failure, or the Pygmy divergence,
   by editing data.**
   Patch: D9 scoping is the only sanctioned fix for the first; OQ-U1 gates
   the second; the engine-equality tests turn a hand edit red.

## 19. Questions remaining open

| # | Question | Options | Recommendation | Blocks |
|---|---|---|---|---|
| OQ-U1 | Should Pygmy gain `Fmadd9`, the one card the uncapped engine adds, given that regeneration is not possible and the insert changes MEDIUM progressions | A leave at 52; B hand-insert the one card (53) | A | Lane U2 |
| OQ-U2 | Custom decks now have no size bound (329 cards measured at the extreme) | no bound; a high safety bound | no bound | nothing |
| OQ10 | Custom deck with a built-in's notes | leave; detect | Leave as is | none |
| OQ11 | Amy progression rerun for the new decks and the grown Amara 9 | later; now | Later, separately | none |

Also needed before execution: a third `/plan-eng-review`.

## Evidence appendix

`$S` is the session scratch directory outside the repo. `exp` was a detached
worktree at `e25f3f2` made with `git worktree add --detach` and removed with
`git worktree remove --force` when done. Nothing in the repo was modified
except this file. Entries E2, E5 to E11 and E13 to E15, E17, E20 were run in
the first drafting session with the second deck named `D CELTIC 10`, id
`celtic`, placed before Hijaz. They are kept where the fact does not depend
on the name or order. E12 and E22 to E28 are from the decided name and order,
on capped decks generated with `--mirror`. E29 to E32 are revision 4: a second
scratch worktree `r4`, also detached at `e25f3f2` and removed when done.

**E1. Base state.**
```
$ git rev-parse --short HEAD; git rev-parse --short origin/main
e25f3f2
e25f3f2
$ ls tests/mutants | wc -l
682
$ wc -c index.html
509747 index.html
```

**E2. Engine output, whole, today's solver, default hand.** Chords, degrees
and card counts are independent of name, hand and the Lane E change.
```
$ node tools/gen_deck.js "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5" | shasum -a 256 | cut -c1-16
cfa99a697b20b4f6
cfa99a697b20b4f6        (second run, identical)
$ node tools/gen_deck.js "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5" | shasum -a 256 | cut -c1-16
fbe49d7f0155e742
fbe49d7f0155e742        (second run, identical)
```
```
$ node tools/gen_deck.js "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5" --name "D Kurd 10"
seed    "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5"
id      custom:cb5fe66a
options {"palette": 0, "mirror": false, "parent": 1}
colors  {"root": "#E0559A", "tone": "#E2761B", "ga": "#E0559A", "gb": "#E2761B"}
degrees {"0": "VII", "2": "i", "4": "ii°", "5": "III", "7": "iv", "9": "v", "10": "VI"}
warnings []
geom    {"rim": 0.745, "inner": 0, "bottom": 0, "r_ding": 0.19, "ding_dy": 0.1425, "r_note": 0.19, "r_bnote": 0, "inner_ring": 0.355, "f_ding": 0.114, "f_note": 0.1454, "f_bnote": 0, "f_num": 0.1216, "n_in": 0.085, "n_out": 0, "rim_num_out": false, "ext": 1.06}
fields  0 D3 ding; 1 A3 @290; 2 Bb3 @250; 3 C4 @330; 4 D4 @210; 5 E4 @10; 6 F4 @170; 7 G4 @50; 8 A4 @130; 9 C5 @90
chords  (25)
   1  Dm           D MINOR                            fields [4, 6, 8]              roots [4]
   2  D5           POWER CHORD                        fields [4, 8]                 roots [4]
   3  Dsus4        SUSPENDED CHORD                    fields [4, 7, 8]              roots [4]
   4  D7sus4       SUSPENDED DOMINANT 7               fields [4, 7, 8, 9]           roots [4]
   5  Dm7          D MINOR 7 ( = F6 )                 fields [4, 6, 8, 9]           roots [4]
   6  E°           DIMINISHED                         fields [5, 7, 2]              roots [5]
   7  Em7b5        HALF-DIMINISHED ( = Gm6 )          fields [5, 7, 2, 4]           roots [5]
   8  F            F MAJOR                            fields [6, 8, 9]              roots [6]
   9  F5           POWER CHORD                        fields [6, 9]                 roots [6]
  10  Fsus4        SUSPENDED CHORD                    fields [6, 2, 3]              roots [6]
  11  Fmaj7sus4    SUSPENDED MAJOR 7                  fields [6, 2, 3, 5]           roots [6]
  12  Gm           G MINOR                            fields [7, 2, 4]              roots [7]
  13  G5           POWER CHORD                        fields [7, 4]                 roots [7]
  14  Gsus4        SUSPENDED CHORD                    fields [7, 3, 4]              roots [7]
  15  G7sus4       SUSPENDED DOMINANT 7               fields [7, 3, 4, 6]           roots [7]
  16  Am           A MINOR                            fields [1, 3, 5]              roots [1]
  17  A5           POWER CHORD                        fields [1, 5]                 roots [1]
  18  Asus4        SUSPENDED CHORD                    fields [1, 4, 5]              roots [1]
  19  A7sus4       SUSPENDED DOMINANT 7               fields [1, 4, 5, 7]           roots [1]
  20  Bb           Bb MAJOR                           fields [2, 4, 6]              roots [2]
  21  Bb5          POWER CHORD                        fields [2, 6]                 roots [2]
  22  C            C MAJOR                            fields [3, 5, 7]              roots [3]
  23  C5           POWER CHORD                        fields [3, 7]                 roots [3]
  24  Csus4        SUSPENDED CHORD                    fields [3, 6, 7]              roots [3]
  25  C7sus4       SUSPENDED DOMINANT 7               fields [3, 6, 7, 2]           roots [3]

$ node tools/gen_deck.js "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5"
seed    "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5"
id      custom:b174242c
degrees {"0": "VII", "2": "i", "4": "ii°", "5": "III", "7": "iv", "9": "v"}
warnings []
geom    identical to the Kurd geom above
fields  0 D3 ding; 1 A3 @290; 2 C4 @250; 3 D4 @330; 4 E4 @210; 5 F4 @10; 6 G4 @170; 7 A4 @50; 8 C5 @130; 9 D5 @90
chords  (26)
   1  Dm           D MINOR                            fields [3, 5, 7]              roots [3]
   2  D5           POWER CHORD                        fields [3, 7]                 roots [3]
   3  Dsus4        SUSPENDED CHORD                    fields [3, 6, 7]              roots [3]
   4  D7sus4       SUSPENDED DOMINANT 7               fields [3, 6, 7, 8]           roots [3]
   5  Dm7          D MINOR 7 ( = F6 )                 fields [3, 5, 7, 8]           roots [3]
   6  Dmadd9       D MINOR ADD 9                      fields [3, 5, 7, 4]           roots [3]
   7  Dm9          D MINOR 9                          fields [3, 5, 7, 8, 4]        roots [3]
   8  Dm11         D MINOR 11                         fields [3, 5, 7, 8, 4, 6]     roots [3]
   9  F            F MAJOR                            fields [5, 7, 8]              roots [5]
  10  F5           POWER CHORD                        fields [5, 8]                 roots [5]
  11  Fmaj7        F MAJOR 7                          fields [5, 1, 2, 4]           roots [5]
  12  F6/9         F MAJOR 6/9                        fields [5, 7, 8, 9, 6]        roots [5]
  13  Fmaj9        F MAJOR 9                          fields [5, 1, 2, 4, 6]        roots [5]
  14  G5           POWER CHORD                        fields [6, 9]                 roots [6]
  15  Gsus4        SUSPENDED CHORD                    fields [6, 8, 9]              roots [6]
  16  G7sus4       SUSPENDED DOMINANT 7               fields [6, 2, 3, 5]           roots [6]
  17  Am           A MINOR                            fields [1, 2, 4]              roots [1]
  18  A5           POWER CHORD                        fields [1, 4]                 roots [1]
  19  Asus4        SUSPENDED CHORD                    fields [1, 3, 4]              roots [1]
  20  A7sus4       SUSPENDED DOMINANT 7               fields [1, 3, 4, 6]           roots [1]
  21  Am7          A MINOR 7 ( = C6 )                 fields [1, 2, 4, 6]           roots [1]
  22  C            C MAJOR                            fields [2, 4, 6]              roots [2]
  23  C5           POWER CHORD                        fields [2, 6]                 roots [2]
  24  Csus4        SUSPENDED CHORD                    fields [2, 5, 6]              roots [2]
  25  C6/9         C MAJOR 6/9                        fields [2, 4, 6, 7, 3]        roots [2]
  26  C6/9         C MAJOR 6/9 - HIGH VOICING         fields [8, 4, 6, 7, 9]        roots [8]

--mirror, fields only (chords, degrees, geom identical to the default run):
  Kurd:     1 A3@250  2 Bb3@290  3 C4@210  4 D4@330  5 E4@170  6 F4@10  7 G4@130  8 A4@50  9 C5@90
  Amara 10: 1 A3@250  2 C4@290  3 D4@210  4 E4@330  5 F4@170  6 G4@10  7 A4@130  8 C5@50  9 D5@90
```
F8: `trimToNames(list, limit)` in `src/engine/select.js` was read. It counts
distinct `root|suffix` names and lets a later voicing of a kept name through.

**E3. Amara 9 through the engine.**
`node tools/gen_deck.js "(D3) A3 C4 D4 E4 F4 G4 A4 C5"`: a Python comparison
of `deck.chords` against the `amara` entry of `data/decks.json` reported the
25 chords equal (`main`, `fields`, `roots`, `subtitle`). Shipped Amara
`degrees` is `{"0":"VII","2":"i","5":"III","7":"iv","9":"v"}`; shipped `geom`
is `{"rim":0.745,"r_ding":0.2,"r_note":0.19,"inner_ring":0.355,"f_ding":0.135,
"f_note":0.128,"f_num":0.105,"n_in":0.085,...}` with no `ding_dy` and no
`ext`.

**E4. Persistence today** (`main`, sandbox boot with a seeded `hpfc`).
```
no storage         -> deck hijaz; store becomes {"deck":"hijaz","mode":"A","tier":"basic","printPaper":"letter"}
{"deck":"amara"}   -> deck amara
{"deck":"nope"}    -> deck hijaz; store rewritten to hijaz
{"deck":2}         -> deck hijaz
```

**E7. Python suite on five decks, tools and tests untouched** (first
session; the count was reproduced on the decided order in E22).
`Ran 223 tests ... FAILED (failures=7, errors=17)`. Errors:
`test_degrees_cover_chord_roots` (two decks); `test_layouts_match_spec` (two
decks); `test_validate_py_passes`; twelve `RenderAgreement` tests (`KeyError`
in `DECK_BY_ID`). Failures: `test_deck_inventory`; `test_layouts_match_spec`;
`test_power_chords_are_root_and_fifth` (30 != 19);
`test_shape_and_card_counts`;
`test_every_deck_is_named_with_its_own_chord_count`;
`test_total_card_count_matches_the_deck_data`; `test_every_card_is_compared`.

**E9. Node failures that do not depend on order** (first session).
"the built-in decks keep the derived extent they have always rendered" fails
with "kurd geom grew an ext key" when `ext` is left in. `tests/core.test.js`
"the three built-in maker strings parse to the golden fields" reads
`golden_decks_v3.json` and passes.

**E11. Seven e2e tests by name, five decks, default `kurd`** (first session,
name `D CELTIC 10`, order Kurd, Celtic, Hijaz, Pygmy, Amara).
```
$ CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node --test --test-name-pattern "<seven names joined by |>" tests/e2e.test.js
tests 7  pass 6  fail 1
```
Pass: "the panel's media conditions are exactly the listed ones"; "the
full-screen settings panel fits with no scroll in every mode, at 320x568 and
every landscape size"; "in landscape every control stays tappable and the
card fits, at every size and state"; "the header and footer stay inside their
pixel budget, so the card keeps its size"; "the header shrinks in landscape
and hands the room to the card"; "portrait is byte-identical: the landscape
header never reaches it". Fail: "the landscape deck strip scrolls rather than
clips, at both ends", with "at 844x390 the deck strip no longer fits (780 >
767) ... every landscape row in the budget table should fit a custom deck's
four chips". Six chips: 844x390 sw 780 cw 767; 926x428 849/849; 667x375
780/590.

**E12. Strip probe, decided names and order** (`$S/strip_probe.js $S/exp`,
`tests/helpers/cdp.js` `launch({realFonts})`, five built-in chips, default
still Hijaz, so the strip is scrolled to the active chip, marked `*`).
```
REAL FONTS (4 faces loaded)
380x780  sw 642 cw 356  D KURD 10:-122--12 | D AMARA 10:-4-117 | D AMARA 9:125-239 | C# HIJAZ 9:247-356* | F3 LOW PYGMY 18:364-520
320x568  sw 642 cw 296  D KURD 10:-182--72 | D AMARA 10:-64-57 | D AMARA 9:65-179 | C# HIJAZ 9:187-296* | F3 LOW PYGMY 18:304-460
390x844  sw 642 cw 366
667x375  sw 634 cw 590  D KURD 10:0-110 | D AMARA 10:116-237 | D AMARA 9:243-357 | C# HIJAZ 9:363-472* | F3 LOW PYGMY 18:478-634
844x390  767/767   926x428 849/849   1280x500 1203/1203   1280x800 760/760
FALLBACK FONTS
380x780 sw 639 cw 356   320x568 639/296   390x844 639/366   667x375 631/590
844x390 767/767   926x428 849/849   1280x500 1203/1203   1280x800 760/760
```

**E13. Sequence picks, 200 per tier per deck** (first session, sandbox boot,
`HPE.sequence.pick(d, rng, null, tier)` with a fixed LCG). Both new decks and
the three shipped decks: 200/200 on basic, intermediate and advanced.

**E14. Custom entry of a built-in's notes** (sandbox boot, `generateDeck`).
```
main: generateDeck("(D3) A3 C4 D4 E4 F4 G4 A4 C5")       -> custom:977311b5 = D AEOLIAN 9, beside built-in amara
exp:  generateDeck("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5")   -> custom:cb5fe66a = D AEOLIAN 10, beside built-in kurd
```

**E15. Page weight** (first session, 17-character second name).
`index.html` 509,747 to 517,269 bytes. See E27 for the DECKS line on the
decided data.

**E16. Contrast.** Python, WCAG 2 relative luminance against `#FFFFFF`.
Shipped: `#E0559A` 3.54, `#E2761B` 3.07, `#6D40A3` 7.21, `#C9971E` 2.65,
`#0B7B75` 5.12, `#DD8F00` 2.62, `#E27005` 3.20. Chosen: `#2563B0` 6.02,
`#C0452C` 5.09, `#3B7A2A` 5.25, `#B3263A` 6.45.

**E17. Chip cap.**
```
const CHIP_CAP = 16;
const chipLabel = n => (n.length > CHIP_CAP ? n.slice(0, CHIP_CAP - 1) + "…" : n);
```

**E18. Site enumeration.** Grep counts per file over `git ls-files` minus
`docs/plans`, `tests/mutants`, PDFs, PNGs and fonts, for
`hijaz|pygmy|amara`, `\b96\b`, indexed deck access, and "three"/"six"
phrases. Then targeted greps for `ALL_DECKS`, `D.HIJAZ`, `decks.HIJAZ`,
`BUILTINS`, `DECK_BY_ID`, `PY`, and `DECKS[` in the test files. Position
readers found by the `DECKS[` grep: `labelShape()`; the two `tests/app.test.js`
tests in 6.3; `selectDeck(i, meta)` and the `DECKS[${i}]` loop in
`tests/e2e.test.js`.

**E19. App greps and reads** (`main`).
```
$ grep -n 'addEventListener("storage\|onstorage\|hashchange' index.html      -> no match
runGenerate: refusal = "Another deck already uses this scale."  (guard checks CUSTOM[id] only, and only while editing)
downloadDeckPDF: const stem = d.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                 pdfDeck = builtin ? HPE.pdfdeck.fromBuiltin(d, d.print) : HPE.pdfdeck.fromGenerated(d)
openShare(text): decode -> generateDeck -> rememberScale -> selectDeck(built.value.id)
selectDeck(id):  deckId = id; storedDeck = id; save(); setOrder(); buildChips(); render();
restoreScales:   rebuilds each stored custom deck from its seed through HPE.select.build
core.deckId:     "custom:" + fnv1a32(formatSeed(fields))
```

**E20. Print overlay derived by `decks.from_generated`** (`main`, read-only
import).
```
kurd     title 'D Kurd 10 - Chord Cards'  sub '9 + 1'  credit 'D KURD 10'
         blurb ['D3  |  A3  Bb3  C4  D4  E4  F4  G4  A4  C5', '25 CHORDS - ONE CARD PER CHORD']
         legend_lines ['NOTE NAME + OCTAVE INSIDE EACH TONEFIELD', 'TONEFIELD NUMBERS RUN 1 - 9 FROM THE LOWEST NOTE']
         legend_demo (6, 4)  R 69.8  cy 124.0  y_note 30.0  y_num 14.0
amara10  blurb ['D3  |  A3  C4  D4  E4  F4  G4  A4  C5  D5', '26 CHORDS - ONE CARD PER CHORD']
         legend_demo (5, 3)  R 69.8  cy 124.0  y_note 30.0  y_num 14.0
```

**E21. Mutant patches and data.** A grep of `tests/mutants/*.patch` for
`const DECKS = ` found 12 files. Three more touch `data/decks.json` on
indented context (`qd_p_pygmy_blank_cards_drifts`, `w1b_hijaz_credit_damaged`,
`w1b_pygmy_geometry_drifts`) and still apply with five decks.

**E22. Decided order, today's solver, `--mirror`** (`exp`; entries `kurd`,
`amara10`, `amara`, `hijaz`, `pygmy`; name `D AMARA 10`; D5 colours).
```
$ python3 tools/sync_decks.py                  -> ok
$ node tools/boot_sim.js                       -> boot OK - default deck rendered, count = 1 / 19
                                                  exercised 147 cards x 2 modes
$ python3 tools/validate.py                    -> 1b FAILED - 'kurd'
Stage 1 (tools and tests untouched):
$ python3 -m unittest discover -s tests -t .   -> Ran 223 tests  FAILED (failures=7, errors=17)
Stage 2 (KURD, AMARA10, PY, DECK_BY_ID, ALL_DECKS, BUILTINS extended):
$ python3 tools/validate.py                    -> all checks passed (147 cards)
$ python3 -m unittest discover -s tests -t .   -> Ran 223 tests  FAILED (failures=27, errors=4)
```
Stage 2 failures: the E7 data-table set (`test_deck_inventory`,
`test_layouts_match_spec`, `test_degrees_cover_chord_roots`,
`test_power_chords_are_root_and_fifth`, `test_shape_and_card_counts`, the two
README tests, `test_every_card_is_compared`); the two no-shrink tests, app
side, rim names only ("10.6527 pt, under the 10.6564 pt"; "15.262, under the
15.267"); and `test_the_sweep_covers_every_builtin_and_both_variants` (its
literal id set). The per-deck PDF parity cases pass for `kurd` and `amara10`.
```
$ for f in app core layout naming select share preview pdf pdfcards pdf_builtin sequence voicing mutation_harness; do node --test tests/$f.test.js; done
app               tests 282  pass 278  fail 4
core 53/53   naming 35/35   select 51/51   share 51/51   preview 14/14
pdf 11/11    pdfcards 16/16 pdf_builtin 13/13   sequence 43/43   voicing 16/16
layout            file crashes in labelShape: "DECKS[0] grew a ding_dy ..."
mutation_harness  tests 53  pass 51  fail 2
```
`app` failures: "a non-string stored deck id is ignored and never eats a
share link"; "every built-in card face still matches the committed digest of
card_face_v1.json"; "every rendered face is well-formed markup (96 cards x 2
modes)"; "the card render still matches the committed digest of every
built-in card". `mutation_harness` failures: "every mutant patch applies to
the tree it will run against" and "no mutant patch outside the tracked
exceptions rides a non-unique anchor", both listing exactly the 11 `b_*`
patches and `c_deck_data_drift`.

**E23. F1: anchor uniqueness on the five-deck file** (`$S/uniq.py`, which
imports the `MUTANTS` table text from `tools/regen_data_mutants.py`, applies
each mutation to the five-deck `data/decks.json`, cuts the hunk with eight
lines of context and counts occurrences of the preimage).
```
card comparison: 22 of amara's 25 cards are byte-identical to an amara10 card
                 amara-only: F6/9 [5,1,2,3,6]  G5 [6,3]  Gsus4 [6,2,3]
                 no amara or amara10 card equals a kurd card; hijaz shares none
preimage counts: b_duplicate_voicing 2   b_root_not_in_voicing 2   the other nine b_* 1
retargets:       b_duplicate_voicing -> amara F6/9 fields=[5,1,2,4,6]     count 1
                 b_root_not_in_voicing -> amara Gsus4 roots=[7]           count 1
                 c_deck_data_drift -> amara F6/9 drop last field          count 1
kill check:      F6/9 duplicate    -> FAIL test_voicings_unique_within_deck
                 Gsus4 roots=[7]   -> FAIL test_roots_appear_in_voicing
```

**E24. D6: what builds PDFs.** `tools/decks.py` `__main__` was read: it
builds six named jobs from `HIJAZ`, `PYGMY`, `AMARA` and does not iterate
`data/decks.json`. `tests/paths.py` `PDFS` has six keys.
`tests/test_pdf_build.py` `JOBS` has six rows. With `KURD` and `AMARA10`
added and `__main__` untouched, the stage 2 run in E22 shows no PDF-build
test failing.

**E25. F2: the golden fixture** (`main`).
```
golden_decks_v5.json: keys version, decks, sha256; version 5; decks is a list: hijaz, pygmy, amara
row keys: id, name, sub, colors, degrees, geom, fields, chords, maker_string
tests/test_fixture_integrity.py: FIXTURE, DECK_KEYS, EXPECTED_SHA256, BUMP ("bump it to golden_decks_v6.json and regenerate sha256, do not edit in place"),
  docstring "it is never regenerated from the engine"
tests/mutants/f_fixture_sha.patch: header paths name tests/fixtures/golden_decks_v5.json
```
The digest recipe (canonical dump of `version` and `decks`, sorted keys,
compact separators) was confirmed against the pinned v5 digest in the earlier
session. `print_decks_v1.json` is not read by this test.

**E26. Lane E prototype** (`$S/layout.proto.js`, inlined into `exp` with
`tools/inline_engine.py`; scratch only).
```
today, --mirror, both new pans:
  geom  rim 0.745  r_ding 0.19  ding_dy 0.1425  r_note 0.19  f_ding 0.114  f_note 0.1454  f_num 0.1216  n_in 0.085  inner_ring 0.355  ext 1.06
  rim   1@250 2@290 3@210 4@330 5@170 6@10 7@130 8@50 9@90
prototype, --mirror, both new pans:
  geom  rim 0.745  r_ding 0.2   ding_dy 0       r_note 0.19  f_ding 0.12   f_note 0.1454  f_num 0.1216  n_in 0.085  inner_ring 0.355  ext 1.06
  rim   1@270 2@230 3@310 4@190 5@350 6@150 7@30 8@110 9@70
shipped amara 9: 1@270 2@225 3@315 4@180 5@0 6@135 7@45 8@90

prototype on "(D3) A3 C4 D4 E4 F4 G4 A4 C5" --mirror and on the Hijaz string --mirror:
  angles equal the shipped angles; rim, r_ding, r_note, n_in, inner_ring equal the shipped values
  differs: f_ding 0.12 (ship 0.135), f_note 0.1454 (0.128), f_num 0.1216 (0.105); extra keys inner, bottom, ding_dy, rim_num_out, ext
  today's solver on the same strings: r_ding 0.19, ding_dy 0.1425

pygmy seed "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5", today and prototype identical:
  all 17 angles equal shipped
  r_note 0.1456 (ship 0.1425)  f_note 0.1114 (0.109)  f_num 0.0932 (0.0912)  inner_ring 0 (null)  ext 1.462 (absent)

rim-only sweep, N = 5..11, centred against offset:
  r_note 0.19 for N 5..10, 0.1783 for N 11, identical both ways; ext 1.06 both ways

prototype engine, shipped three-deck data:
  python3 -m unittest discover -s tests -t .   -> Ran 223 tests  OK
  layout 53 tests, 4 fail (named in 6.6)
  core   "ET-1 engine corpus matches" fails; regen changes 30 values (r_ding, ding_dy, f_ding) in 10 of 20 synthetic entries
  app    "AP3-0 generated faces and rail DOM match the committed digest" and the card_face digest test fail on gen_face_v1.json (58 mismatches)
  preview 14/14   share 51/51   select 51/51
  git apply --check for the 11 layout.js mutants: all apply
```

**E27. Decided order, prototype solver** (`exp`, stage 3: both decks
generated by the prototype with `--mirror`, tables extended as in E22).
```
$ python3 tools/validate.py                    -> all checks passed (147 cards)
$ node tools/boot_sim.js                       -> count = 1 / 19; exercised 147 cards x 2 modes
$ python3 -m unittest discover -s tests -t .   -> Ran 223 tests  FAILED (failures=27, errors=4)   (same set as E22 stage 2)
app 282/277 (the E22 four plus AP3-0)   core 53/52 (ET-1)   layout: labelShape crash   mutation_harness 53/51
naming, select, share, preview, pdf, pdfcards, pdf_builtin, sequence, voicing: all pass
DECKS line 13,873 -> 21,353 bytes
adopted geom carries ding_dy 0 and r_ding 0.2
```

**E28. F3: `d_*` patches on the seam** (grep of `tests/mutants/d_*.patch` for
the `const deck = ` line, the `let deckId` line and `DECKS[0]`). Removed-line
matches: `d_deck_copies_registry`, `d_no_deck_fallback`, `d_registry_ignored`
(the `deck()` line); `d_deck_id_untyped` (the `let deckId` line).
Context-only matches on `DECKS[0]`: `d_delete_keeps_record`,
`d_delete_moves_selection`, `d_delete_silent`. Added-line match:
`d_edit_moves_selection` adds `selectDeck(replaced ? DECKS[0].id : d.id);`.

**E29. Lane E, keep-sides prototype** (revision 4; scratch worktree `r4`,
detached at `e25f3f2`, `src/engine/layout.js` edited and inlined with
`tools/inline_engine.py`). It supersedes E26 for odd rim counts: E26's
prototype anchored at 270 with the second note on the RIGHT; this one puts
it on the LEFT (D14). E26 still stands for even counts and for the Amara 9,
Hijaz and Pygmy comparisons.

- Angle table for rim-only seeds of 5 to 11 notes, both hands, `main`
  against the prototype: section 6.6.
- Geometry for the same seeds, and the five inner-note seeds and the one
  bottom-notes seed: section 6.6.
- Node suites, one file at a time with `node --test`: layout 53 with 5
  failing (named in 6.6); core fails ET-1 only until
  `node tools/regen_engine_corpus.js` (30 values change); app fails the two
  `gen_face_v1.json` readers until `node tools/regen_card_fixture.js --gen`
  (58 leaves, all under `decks`). After both: core 53 of 53, app 282 of 282.
  share 51, select 51, preview 14, sequence 43, voicing 16, naming 35, pdf
  11, pdfcards 16, pdf_builtin 13, mutation_harness 53 pass unchanged.
- `python3 -m unittest discover -s tests -t .`: 223 tests OK.
- `python3 tools/sync_decks.py --check` clean; `data/decks.json` and the
  DECKS line unchanged; `regen_card_fixture.js` (no flag) and
  `regen_pan_fixture.js` write byte-identical fixtures.
- The 14 patches under `tests/mutants/` that touch `layout.js`: each applied
  with `git apply`, its named test run on base (pass) and on the mutant
  (fail), then reverted with `git apply -R`.
- No e2e test was run.

**E30. `select.js` mutants with the cap removed** (`r4`, the two cap lines
deleted from `build`, inlined). The 20 patches that touch
`src/engine/select.js` were listed by grep. 13 were applied one at a time and
died under their named tests. 5 (`s_cap_*`) no longer apply to anything
meaningful. 2 name the canonical-order test, which fails on base until its
literal is updated; they were not re-proven.
`sqr_15_hard_two_nonanchor_branch_dropped` was re-proven with S7's seed
swapped to `(C3) Eb3 E3 G3 Ab3 B3 C4 Eb4 E4`. The lists are in 6.10.

**E31. Uncapped engine output** (`r4`, as E30).

- `node tools/gen_deck.js "<seed>"` for the five pans, capped (`main`
  engine) and uncapped: sizes in section 5, card lists compared by name and
  `fields`. Amara 9 uncapped equals the shipped 25 cards plus `Fadd9
  [5,7,8,6]` at position 12 and `Cadd9 [2,4,6,3]` at position 26. Hijaz is
  identical. Pygmy differs from shipped by the Fm9 voicing (capped) plus
  `Fmadd9 [5,7,8,6]` at position 6 (uncapped).
- The six presets, the twelve-note pan, the nineteen-field maximum, the
  octatonic and augmented-hexatonic seeds, and the chromatic 19-field worst
  case: sizes and timings in 6.10. PDFs for Kurd and the worst case were
  built under Node through the client PDF module.
- Failing-test lists with the engine uncapped and shipped data untouched,
  and again with Amara 9's data at 27 cards (a scratch merge script wrote
  the two cards into `data/decks.json`, with `ensure_ascii=False`, then
  `tools/sync_decks.py`): 6.10.
- The A4 test: the two glyphs and their x values were printed from the
  failing comparison (6.10).
- `grep -n "25\|cards generated" tests/e2e.test.js` for size literals: only
  the `/cards generated/` regex. Not run.

**E32. Sequence probe** (`r4`; a scratch script loading the engine through
`tools/engine_loader.js`, 3,000 `pick` deals per tier per deck with
`mulberry32(7)`, capped engine against uncapped; Pygmy run a third time with
`Fmadd9` hand-inserted). Anchors, pool sizes, distinct-deal counts, colour
family shares, extended and non-anchor shares: table in 6.11. Under the
Lane E prototype alone `tests/sequence.test.js` is 43 of 43.

## Second eng review (2026-10-06): disposition

Verdict was READY_WITH_CHANGES. Every finding is folded into revision 4.

| # | Finding | Disposition | Where |
|---|---|---|---|
| F1 | e2e tests read `meta[0]` as the active deck; the delete-fallback test hard-codes 3 chips and `chips[0]` | Accepted. Lane A owns the seven tests by name and rewrites them to read by id and by `decksMeta().length`. Lane B owns counts only | 6.3, Lane A Owns |
| F2 | Lane E mirrored stored custom decks on odd rims | Went to the owner. D14 "Keep their sides": the odd-rim function keeps each note on its side; the new decks are generated without `--mirror`. The stored `order` and `mirror` test is in Lane E | D14, 6.6, Lane E |
| F3 | `gen_face_v1.json` needs `--gen` | Accepted. `--gen` in every place the fixture is regenerated | 6.6, Lanes E and U1 |
| F4 | Inner notes do not need a `/` | Accepted. The rule tests `counts.inner` after spill; a 12-top-note no-slash seed is in the rule test and in the CLAUDE.md text | D15, 6.6, Lane E, section 13 |
| F5 | Lane E must own the docs that record the old default | Accepted. Lane E owns `docs/SCALE_ENGINE_PLAN.md` row D12, `docs/ENGINE-SPEC.md` section 4, the README sentence and the `layout.js` header; text in section 13 | Lane E Owns, section 13 |
| F6 | A third `g_*` mutant for direction | Accepted: `g_bottom_anchor_side_flipped`. The counts were recomputed with the cap lanes: 682, 685, 681, 681, 683, 684 | section 5, section 11 |
| F7 | Strip row cited four chips | Accepted. Row corrected to five | 6.3 |
| AD7 | Fix the `meta[0]` readers; no permanent seed in `freshLoad()` | Accepted. No seed. Lane C stops at ten failing e2e tests | 9.2, Lanes A and C |

The reviewer's scratch confirmation (4 layout failures, 11 mutants) was of
the revision 3 prototype. Revision 4's prototype differs on odd rims and was
re-measured: 5 layout failures, 14 mutants (E29).

## Third eng review disposition (2026-10-06)

Verdict: READY_WITH_CHANGES. All four findings folded in place.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| F1 | HIGH | Lane A missed 50 `(await decksMeta())[0]` readers across 46 e2e tests; three `meta[0]` tests unnamed; one named test has no `meta[0]` | Lane A owns e2e position readers by pattern, converts all to `bootMeta`, second acceptance grep added |
| F2 | MEDIUM | Lane U2 Owns narrower than its failures; S2 fails from sampling noise | Owns widened (sequence literals, `test_gen_deck.py`, ownership by failure); S2 fixed by larger N, band unchanged |
| F3 | LOW | Golden capture methods are recorded, plan said unverified | Lane U2 procedure uses the recorded scripts; reproduce-Hijaz-and-Pygmy check kept |
| F4 | LOW | Print credit `D KURD` vs deck name `D KURD 10`; test filed under wrong file | Credit row reads `D KURD 10 / D MINOR`; test moved to `tests/test_pdf_build.py` in Lane U2 Owns |

Not verified by the review, carried as lane risks: Lane E's three new
mutants and `s_trim_reintroduced` (CI mutation shards decide); Lane B
`b_*` anchor uniqueness on five decks (acceptance already requires it);
Lane C's e2e blast radius on Kurd (CI decides; Lane A's `bootMeta`
conversion is what makes it tractable). The UI-fit evidence in 6 was
measured on capped, mirrored decks: Lane B re-measures at 380px on the
shipped 49-card Kurd.

New questions for the owner: OQ13 one e2e test on a pre-seeded stored
custom deck (it redraws and grows silently, AD19); OQ14 Hijaz loses
default-path e2e coverage once Kurd is the cold-start deck.

