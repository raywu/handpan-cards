<!-- Copy of ~/Projects/fp-kit/plan.final.md, 2026-10-23. Lane PRs: L #502, S #501, D #510, P #506, W (this PR). -->

# Plan (final): free placement of bottom notes on the generated layout

Consolidated 2026-10-23 from `plan.md` (draft), `plan.eng-reviewed.md` (eng
A1-A12), `plan.design-reviewed.md` (design A1-A12) and `feasibility.md`, all
beside this file. This file is self-contained: a lane brief quotes it and needs
nothing else. Where it differs from those inputs, "Merge resolutions" says why.

**Base for every lane: `8d0dd899e6f72204b3fee45602b608dbca044bac`**, the head of
#490 (`claude/order-free-od`, order-free lane OD). That PR is open with base
`main`, held for the owner, and stacked on #485 and #479. It is not
`origin/main` (1f4e343) and it is not `origin/dev`. Every anchor below was
re-read at that commit with `git -C ~/Projects/handpan-cards show 8d0dd89:<path>`.
Anchors are functions, markers or test titles, never line numbers.

## Goal

A custom deck's bottom notes can be slid along the dashed bottom ring in the
ADJUST LAYOUT drawer, and the drawing survives SAVE, Edit and the share link.
The top shell, the inner notes and the ding stay engine-placed. Geometry, label
sizes, warnings and the five built-ins do not change.

## Binding decisions

The owner answered on 2026-10-22: model (b), bottom ring only, and the
recommended answer to every feasibility question.

1. **Step.** 5 degrees. A dropped note snaps to the nearest multiple of 5.
2. **Scope.** Bottom ring only. The rim and the inner ring get no option.
3. **Overlap.**
   - The drawer snaps a dropped note away from a neighbour that is too close.
   - The engine refuses (BAD_NOTE) any link or record under the floor.
   - The floor is a centre distance of 2 x r_bnote on the bottom orbit plus one
     step. That is 15 degrees on every bottom ring whose default spacing allows
     it.
   - An overlap is never allowed.
   - The exact definition is under "Data model".
4. **`seats.bottom` is subsumed.** A deck with bottom angles writes no bottom
   seats entry. Rim and inner seats are untouched.
5. **Wire version 6.** `HPE.share.VERSION` goes from 5 to 6.
   `HPE.share.RECORD_VERSION` stays 4. A v5 app answers NEEDS_NEWER_APP to a v6
   link. The v5 reader is kept.
6. **Absolute degrees,** 0 to 355. Never deltas on the solved angle.
7. **Rule N.** A moved note keeps the label of the seat it left. No card's
   number line changes because a note slid.
8. **RESET LAYOUT clears angles** together with seats, mirror and anchor.
   - The notice suffix " The bottom seats were reset." becomes " The bottom
     seats and angles were reset." when both were set and the count changed.
   - It becomes " The bottom angles were reset." when only angles were set.

**Drop timing.** The push happens at release, so a drop on a note still swaps
and no existing gesture changes meaning.

## AFK auto-decisions (binding)

- **Eng A9 (the fold).** The first slide on a ring that carries
  `seats.bottom` folds the seats: every bottom note gets its current effective
  angle as an explicit entry and `seats.bottom` is dropped. The label
  consequence is the one unresolved item at the end of this plan.
- **Design OQ1.** While a bottom note is held, a drop on a note of another
  ring is a move.

## Data model

**Record option.** `options.angles = {bottom: [a1, ..., an]}` on the deck's
record options object.
- There is one entry per bottom note, in ascending field-id order (U1..Un).
- Each entry is an integer multiple of 5 in [0, 360), or `null` for the solved
  angle.
- The option is written only when some entry is not null.
- `RECORD_VERSION` stays 4. An older app ignores the key; it is never written
  by one.

**Wire.** `at-<list>` is the new last rank of `OPTION_ORDER` and is valid on
version 6 only.
- The list is comma-separated, with an empty entry for null, e.g.
  `at-125,20,,215,180`.
- The three-ring form `at-;;...` from the exploration is dropped with the
  scope.
- Beside `at-`, a `seats-` option may carry rim and inner lists only. Its bottom
  list must be empty, for example `seats-1,0;;` with nothing after the second
  `;`.

**Carry.** The option is carried past `core.parseSeed` the same way `seats` is:
- through `carry` in `share.js`;
- through the deck build block in `generateDeck` in `index.html`.

`src/engine/core.js` is not edited.

**Where it is applied.** In `HPE.layout.solve`, the pipeline is `collect`,
`resolveMirrors`/`resolveAnchor`, `countsOf`, `readSeats`, `placeZones`,
`geometry`, `reseat`, `merge`. The option enters as follows:

- A new `readAngles(value, counts)` sits beside `readSeats`. It checks shape
  only: length equals the bottom count, every entry is an integer or null, on
  the 5-degree step, and in range.
- Override after reseat. The non-null entries replace the bottom angles after
  `reseat` and before `merge`.
- Floor check. The floor is then checked over the effective placement.
- Geometry unchanged. `geometry` still computes from the DEFAULT placement, so
  `r_*`, `f_*`, `ext`, `ding_dy` and `SMALL_LABELS` are byte-identical with and
  without the option.
- Refusals. `solve` refuses with BAD_NOTE:
  - when given both a non-empty `seats.bottom` and `angles`;
  - when it finds a shape or floor violation.

  The reason names the value.

**Labels (rule N, decision 7).** With `angles` set and no `seats.bottom`,
`merge` writes slot 4 only for bottom fields. Slot 5 keeps the source label, so
a note's label never moves with its angle.

**The floor, made exact.**
- Let `touch = 2 * asin(r_bnote / g.bottom)` in degrees. This is the angle at
  which two bottom circles meet.
- Let `F` = the smallest multiple of 5 strictly greater than `touch`. At the
  standard Pygmy-ratio figures this is 15 (touch = 11.86 for r_bnote 0.1188 on
  the 1.15 R orbit).
- Let `G0` = the smallest short-way angular gap between two bottom notes in the
  default placement. It is infinite with one bottom note.
- The floor is `min(F, G0)`. The `G0` cap is "whose default spacing allows it":
  the default placement and every seats permutation of it always pass.
- The check runs on the EFFECTIVE list: nulls are filled with the solved angle
  after `mirrorBottom` and `seats` (eng A6).
- It runs over every pair, distance taken the short way round, so 355 against 0
  is 5.
- **Top-shell clearance.** A bottom circle at an entry's angle must also not
  meet any top-shell circle (rim, inner, ding), measured with the default
  radii. That is the literal reading of "never allow an overlap". L's sweep
  proves whether the case can arise. The predicate exists either way.
- **One predicate, exported.** `HPE.layout.bottomClash(geom, fields, list, i)`
  returns the id of the first field that note `i` at `list[i]` is too close to,
  or `null`.
  - `solve` uses it for the floor.
  - Lane D uses it for snap-away and for the nudge refusal.
  - The drawer never computes geometry itself.

## Hard constraints (every lane)

- **Engine regions are generated.** Everything between `<!-- engine:<name>
  begin -->` and `<!-- engine:<name> end -->` in `index.html` is written by
  `python3 tools/inline_engine.py`.
  - Never hand-edit a region.
  - A region conflict is resolved by taking either side and re-running the
    tool.
- **The DECKS line is generated.** `const DECKS` comes from
  `python3 tools/sync_decks.py`. No lane edits `data/decks.json`, so
  `--check` must stay green untouched.
- **No data or geometry change.** No change to deck data or to any built-in's
  geometry, and no change to the label rule constants.
  - No change to `tools/hifi.py` drawing code or to `pdfcards.js` drawing code.
  - No change to `core.js`.
  - `tests/fixtures/engine_corpus_v1.json` stays byte-identical
    (`node tools/regen_engine_corpus.js --check`).
- **Visible text says "scale", never "deck".** Identifiers, ids and code
  comments keep "deck".
- **Test at 380px.** Every e2e step runs at 380x780 among its viewports.
- **Single-file app.** No new external script and no `<script src>`.
- **Tests first.** Each step writes its test, shows it red at the lane's base,
  then implements it. The fail-before is recorded in the PR body.
- **Test titles.** New test titles carry the prefix `FPL:` (L), `FPS:` (S),
  `FPD:` (D) or `FPP:` (P), so a verify command can select a lane's tests with
  `--test-name-pattern`.
- **New mutants** are named `fpl_*`, `fps_*`, `fpd_*` and `fpp_*` (see
  resolution R8).
  - No `index ...` lines in a patch.
  - In `# suite:` headers, use `.` wildcards rather than quotes.
- **No new test files.** No lane adds a test file, so the README suite counts
  ("25 node suites and 16 python suites") do not move.

## Lanes

Ownership is exclusive. "NEVER TOUCH" lists the files a lane is most likely to
reach for and must not.

### Lane L: engine

- **GOAL.** `HPE.layout.solve` accepts `options.angles.bottom`, places bottom
  fields at those angles, and refuses every invalid list. All geometry is
  byte-identical to the run without the option.
- **NON-GOALS.**
  - No rim or inner option.
  - No radius override.
  - No share or app change.
  - No change to `GEOM_KEYS`, `geometry` or any built-in output.
- **OWNS.**
  - `src/engine/layout.js`
  - `tests/layout.test.js`
  - `tests/mutants/fpl_*.patch`
  - The engine regions of `index.html`, regenerated only.
  - The `tests/layout.test.js` row of `tests/suite_health.py` FLOORS.
  - In `docs/ENGINE-SPEC.md`, the `seats` sentences wherever they stand, each
    gaining its `angles` twin (eng A1). These are:
    - section 1, "The result contract": the sentence saying `readSeats`
      validates `options.seats`;
    - section 4, "Zone assignment, field ids and layout rules": rule N;
    - section 11, "The generated deck object": the `options` shape;
    - section 13, "Options: palette, mirror, name": the layout options list and
      the D5 `seats` bullet.
- **NEVER TOUCH.**
  - `src/engine/share.js`, `src/engine/core.js`, `src/engine/pdfcards.js`
  - `data/decks.json`
  - the app script and CSS of `index.html`
  - `tests/share.test.js`, `tests/app.test.js`, `tests/e2e.test.js`
  - `docs/ENGINE-SPEC.md` section 14
  - `CLAUDE.md`, `README.md`

Steps:

1. **`readAngles` shape refusals.**
   - Tests: `FPL: readAngles refuses wrong length, non-integer, off-step and
     out-of-range entries with BAD_NOTE naming the value`, and `FPL: readAngles
     accepts nulls and an all-null list reads as absent`.
   - Accept: both tests are red at base and green after.
   - Verify: `node --test tests/layout.test.js --test-name-pattern 'FPL: readAngles'`
2. **Floor and clearance in `solve` (A6).**
   - Tests:
     - `FPL: an entry under the floor of another bottom note is BAD_NOTE`
     - `FPL: a numeric entry under the floor of a null neighbour's solved angle
       is BAD_NOTE`
     - `FPL: the wraparound pair (355 and 0) is checked`
     - `FPL: the floor is 15 at the standard bottom radius and never above the
       default gap`
     - `FPL: bottomClash names the note in the way, top shell included`
   - Accept: `HPE.layout.bottomClash` is exported and `solve` calls it. The
     default placement and every seats permutation of it pass.
   - Verify: `node --test tests/layout.test.js --test-name-pattern 'FPL: (an entry|a numeric|the wraparound|the floor|bottomClash)'`
3. **An override changes angles and nothing else (rule N, A7).**
   - Test: `FPL: an override changes bottom slot 4 and nothing else`. It covers:
     - `solve` with and without `angles` gives deep-equal `geom`, `ext`
       included and asserted by name;
     - every non-bottom field is equal;
     - bottom fields differ in slot 4 only, and slot 5 is unchanged.
   - Accept: green.
   - Verify: `node --test tests/layout.test.js --test-name-pattern 'FPL: an override'`
4. **Composition and exclusivity.**
   - Tests:
     - `FPL: mirrorBottom reflects, seats permute, then angles override last`,
       on a 5-note bottom ring with rim seats, mirror and angles;
     - `FPL: seats.bottom beside angles is BAD_NOTE, rim and inner seats beside
       angles are accepted`.
   - Accept: green.
   - Verify: `node --test tests/layout.test.js --test-name-pattern 'FPL: (mirrorBottom|seats.bottom)'`
5. **Sweep with random valid overrides (A7).**
   - Test: `FPL: under random valid bottom angles no two circles overlap, every
     name fits and every circle and number sits inside ext`.
     - It runs N=5..19 rims with 1..6 bottoms and 200 seeded-random valid lists
       each, built only through `bottomClash`.
     - Its comment states why `ext` cannot be left: `ext` is the outermost
       orbit plus `r_bnote` plus the number reach, never an angle.
     - It reuses the predicates of "no two field circles overlap, anywhere in
       the N=5..19 sweep", "every name the app draws fits inside the field it
       labels" and "every field circle and its number label sits inside ext",
       and those three tests are unchanged.
   - Accept: green, in under 10 s locally.
   - Verify: `node --test tests/layout.test.js --test-name-pattern 'FPL: under random'`
6. **Nothing else moved.**
   - Accept:
     - "the solver seats every built-in field where its diagram has it, from
       the deck's scale string" is green and untouched;
     - `GEOM_KEYS` is unchanged;
     - the corpus is byte-identical.
   - Verify: `node --test tests/layout.test.js && node tools/regen_engine_corpus.js --check`
7. **Mutants**, each killed by a test above:
   - `fpl_floor_unchecked`
   - `fpl_step_unchecked`
   - `fpl_range_unchecked`
   - `fpl_wrap_pair_unchecked`
   - `fpl_override_before_geometry`
   - `fpl_override_before_reseat`
   - `fpl_seats_and_angles_accepted`

   Accept: each one reds a test. Verify: `bash tests/mutation_check.sh tests/mutants/fpl_*.patch` (a clean tree first).
8. **ENGINE-SPEC twins.** Add an `angles` twin to each `seats` sentence listed
   in OWNS, and leave section 14 alone.
   - Accept: green.
   - Verify: `python3 -m unittest tests.test_readme_currency && node --test tests/layout.test.js`
9. **Sync and FLOORS.**
   - Accept:
     - `python3 tools/inline_engine.py` has been run and its output committed;
     - `--check` is green;
     - `python3 tools/validate.py` is green;
     - the `tests/layout.test.js` FLOORS row is raised from the CI artifact at
       the lane's head.
   - Verify: `python3 tools/inline_engine.py --check && python3 tools/validate.py && python3 tests/suite_health.py`

### Lane S: share

- **GOAL.** The app writes wire v6 with `at-` and reads v1 to v6. The check
  covers the angles. A link under the floor is refused. Stored records stay at
  version 4.
- **NON-GOALS.**
  - No drawer UI.
  - No new record version.
  - No change to v1 to v5 decoding.
  - No change to the five built-ins' link bodies other than the version byte
    and the check.
- **OWNS.**
  - `src/engine/share.js` and `tests/share.test.js`
  - `tests/mutants/fps_*.patch`
  - The engine regions of `index.html`, regenerated only (eng A2).
  - In the `index.html` app script, the deck build block inside `function
    generateDeck` (the `wanted` / `HPE.layout.solve(...)` call that copies
    slots 4 and 5) and the `SHARE_VERSION` line.
  - In `tests/app.test.js`, only the `SV:` tests that pin versions and links,
    plus the new `FPS:` app tests.
  - The FLOORS rows of `tests/share.test.js` and `tests/app.test.js`.
- **NEVER TOUCH.**
  - `src/engine/layout.js`, `src/engine/core.js`
  - the drawer code, the CSS and `tests/e2e.test.js` (which goes to D, eng A5)
  - the drawer and SG/SPC suites of `tests/app.test.js`
  - `docs/`, `CLAUDE.md`, `README.md`

**Ordering.**
- Steps 1 to 6 run from base in parallel with L. The engine side of angles is
  stubbed by a carry-only object; no layout call is needed yet.
- Steps 7 to 9 run after S is rebased onto L's verified head. S's PR title then
  says "stacked on #<L>".

Steps:

1. **v6 writer (decision 5).**
   - `VERSION` becomes 6. `encode` writes `6/...` and adds `at-` as rank 5 of
     `OPTION_ORDER` (palette 0, parent 1, mirror 2, between 3, seats 4, at 5).
     `at-` is written only when some entry is non-null.
   - A bottom seats list is never written beside `at-`.
   - Tests:
     - `FPS: at- is the last option and appears only when an entry is set`
     - `FPS: a deck with bottom angles encodes no bottom seats entry`
   - Update "SV: this app writes wire version 5 and keeps records at 4" to v6
     and record 4. Its new title is "SV: this app writes wire version 6 and keeps
     records at 4".
   - Accept: green.
   - Verify: `node --test tests/share.test.js --test-name-pattern 'FPS: (at- is|a deck with)|SV: this app'`
2. **Version byte in the check meaning; `at-` is v6-only (eng A3).**
   - `decodeReadable` currently hardcodes `var meaning = ["5", scale];` and
     tests `text.charAt(1) !== "/"`. After this step it takes the version byte
     from the text for the check meaning. `at-` is legal only when the byte is
     6.
   - Tests: `FPS: at- on a v5 link is BAD_NOTE, on a v6 link it is read`, and
     `FPS: a v6 check is computed over the byte 6`.
   - Update "SV: a 5 not followed by / is BAD_NOTE, and 6 or above is
     NEEDS_NEWER_APP". It becomes "SV: a 5 or 6 not followed by / is BAD_NOTE,
     and 7 or above is NEEDS_NEWER_APP", because it breaks at VERSION 6 as
     written.
   - Accept: green.
   - Verify: `node --test tests/share.test.js --test-name-pattern 'FPS: (at- on|a v6 check)|SV: a 5'`
3. **Readers and pins.**
   - v5 links decode unchanged. "SV: the five built-in decks' v5 links are
     pinned" keeps its v5 fixtures as reader pins.
   - New tests:
     - `FPS: the five built-in decks' v6 links are pinned` (they differ from v5
       by the version byte and the check only);
     - `FPS: a v6 link is NEEDS_NEWER_APP to an app pinned at v5`.
   - "SV: a v5 link is NEEDS_NEWER_APP to an app pinned at v4" stays green.
   - Accept: green.
   - Verify: `node --test tests/share.test.js --test-name-pattern 'FPS: (the five|a v6 link)|SV: a v5 link'`
4. **Check, absence and spelling.** Tests:
   - `FPS: changing any angle changes the check`
   - `FPS: absent round-trips as absent and clearing restores the default link
     byte for byte`
   - `FPS: an at- list with a wrong length, a bad entry, a bottom seats list
     beside it, or out of order is BAD_NOTE`
   - "SV: every option has one spelling and a default writes nothing" and "SV:
     an unknown, duplicated or out-of-order option is BAD_NOTE" extended to
     `at-`.

   Accept: green. Verify: `node --test tests/share.test.js --test-name-pattern 'FPS: (changing|absent|an at-)|SV: (every option|an unknown)'`
5. **Cap and identity.** Tests:
   - `FPS: a 120-note pan with every bottom note moved stays under the cap`
   - `FPS: angles change the share string but never the deckId`, beside "D5-5:
     seats change the share string but never the deckId".

   Accept: green. Verify: `node --test tests/share.test.js --test-name-pattern 'FPS: (a 120|angles change)'`
6. **App carry and versions.**
   - `SHARE_VERSION` stays bound to `HPE.share.RECORD_VERSION`.
   - The build block passes `options.angles` into `solve` beside `seats` and
     copies slot 4.
   - Tests (`tests/app.test.js`):
     - `FPS: stored records keep v 4 after a v6 boot`
     - `FPS: a v5 #s= boot imports once and ends with the v6 code in the bar
       through one replaceState`
     - `FPS: a hashchange to the v5 spelling of the deck shown rewrites the bar
       to v6 and imports nothing`
   - Rename the existing SV app tests ("SV: a v4 #s= boot imports once and ends
     with the v5 code in the bar through one replaceState" and its hashchange
     twin) to end on v6, keeping their v4 input.
   - The e2e twin is D's (eng A5).
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPS:|SV:'`
7. **Rebase on L's verified head; the floor at decode.**
   - `decode` re-attaches `angles` after `HPE.layout.readAngles`, beside the
     `readSeats`/`seatsFromOrder` re-attach. It then runs `HPE.layout.solve` on
     the decoded seed and turns a refusal into BAD_NOTE on the whole link.
   - The app build block returns a refused solve the same way (`if (!built.ok)
     return built`).
   - Test: `FPS: a v6 link under the floor, or with a bottom seats list beside
     at-, is BAD_NOTE and the app imports nothing`.
   - Accept: green on L's head.
   - Verify: `node --test tests/share.test.js tests/app.test.js --test-name-pattern 'FPS: a v6 link under'`
8. **Mutants**, each killed:
   - `fps_option_dropped_on_encode`
   - `fps_out_of_order_accepted`
   - `fps_check_skips_option`
   - `fps_bottom_seats_beside_angles`
   - `fps_v5_reader_accepts_at` (A3)
   - `fps_decode_skips_floor`

   Accept: each one reds a test. Verify: `bash tests/mutation_check.sh tests/mutants/fps_*.patch`
9. **Sync and FLOORS (eng A2).**
   - Accept:
     - the inline tool has been run and its output committed;
     - `--check` and `validate.py` are green;
     - the FLOORS rows for share and app are raised from CI at the head.
   - Verify: `python3 tools/inline_engine.py --check && python3 tools/validate.py && python3 tests/suite_health.py`

### Lane D: drawer

- **GOAL.** In ADJUST LAYOUT, a bottom note can be dragged along its ring or
  nudged by buttons to a 5-degree step, and is snapped away from a neighbour.
  The drawing survives SAVE, Edit and the link.
- **NON-GOALS.**
  - No change to rim or inner pick, drag or drop rules, or to their copy.
  - No live push while dragging.
  - No step ticks or degree readout on the ring.
  - No angle memo across count changes. Unlike `seatMemo`, decision 8 resets
    angles.
  - No i18n string table.
  - No change to engine files.
- **OWNS.**
  - The `index.html` app script and CSS outside the engine regions, except the
    two lines S owns.
  - `tests/app.test.js`: the drawer, DR*, SG, SPA, SPB, SPC and `FPD:` suites.
  - `tests/e2e.test.js`
  - `tests/drawer_drag.test.js`, `tests/drawer_seats.test.js`,
    `tests/drawer_grid.test.js`
  - `tests/seat_sweeps_keys.test.js`, `tests/seat_sweeps_tap_add.test.js`,
    `tests/seat_sweeps_tap_edit.test.js`
  - `tools/sandbox.js` ELEMENT_IDS (for the two new ids)
  - `tests/mutants/fpd_*.patch` and those files' FLOORS rows (eng A4)
- **NEVER TOUCH.**
  - `src/engine/*.js` and the engine regions
  - the `SHARE_VERSION` line and the `generateDeck` build block (both S's)
  - `data/decks.json`
  - `docs/`, `CLAUDE.md`, `README.md`
- **Base.** D's branch is cut from S's head after S step 7, so it carries both
  L and S. Its title says "stacked on #<S>" (eng A5).

**State.** `layoutAngles` is the drawer's working list, null or
`{bottom:[...]}`. `layoutBase` gains `angles`. `sheetOptions` and
`layoutOptions` write `options.angles` only when some entry is set. Every drop
or nudge validates through `HPE.layout.bottomClash` and redraws through
`solve`.

Steps:

1. **The ghost rides the ring; a clear release is a move (design A1, A3).**
   - Behaviour while the picked note is a bottom note:
     - `makeGhost`/`seatGhost` draw the ghost ON the bottom orbit, at the
       snapped step of the hit point's angle from the pan centre. There is no
       `GHOST_LIFT` offset and no transition while dragging.
     - `targetAt` still decides swap versus move.
     - A clear release writes the step into `layoutAngles` and redraws.
   - The status line is "C3 moved to 310°, lower right. Seat U1 stays its
     number.". The place word comes from `placeOf`. The second sentence shows
     only on the first move of the sheet session.
   - Degrees always use `°`, and 0 is `0°`. No live status during the drag.
   - Test: `FPD: a bottom note dragged clear of other notes lands on the nearest
     5° step, the ghost sits on the orbit, and the status names note, angle and
     place`.
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: a bottom note dragged'`
2. **A drop on a note still swaps (eng A4, R1).**
   - A drop on a same-ring bottom note swaps.
   - On a ring with active angles, the swap exchanges the two angle entries and
     the labels stay with the notes.
   - Tests that must stay green, untouched:
     - `tests/drawer_drag.test.js` "DR2b browser rule D (41, 42, 47): a real
       touch hold-and-drag swaps one pair per ring of Pygmy";
     - the DR2b block of `tests/app.test.js`;
     - the `dropNote` row "Not moved. Drop A3 on another rim note to swap.".
   - New test: `FPD: under active angles a drop on a bottom note exchanges the
     two angles and keeps each note's label`.
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: under active|DR2b|Not moved' && node --test tests/drawer_drag.test.js`
3. **Other-ring drop while a bottom note is held is a move (OQ1, design A2).**
   - `targetAt`'s `other` kind is read as a move to the hit point's step for a
     bottom pick.
   - "Not moved. X moves only within the ring." stays for rim and inner picks.
   - Test: `FPD: releasing a held bottom note over a rim note moves it, and a
     held rim note over a bottom note is still refused`.
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: releasing a held'`
4. **Snap-away (decision 3, design A3).**
   - A release within the floor of another note, or of a top-shell field,
     lands on the nearest free step on the side the finger came from.
   - The status is the warn line "C3 was too close to G3, so it sits at 310°,
     lower right." through `layoutStatus(text, true)`.
   - The landed note flashes through the `panFlash` state for 600ms, as a swap
     does, including under reduced motion.
   - Test: `FPD: a release under the floor snaps to the nearest free step on the
     approach side, warns and flashes`.
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: a release under'`
5. **The fold (AFK A9, R2).**
   - On a ring with a non-identity `seats.bottom`, the first slide:
     - writes every bottom note's current effective angle as an explicit entry;
     - drops `seats.bottom`;
     - moves no field position.
   - Labels follow the recommended option of "Unresolved decisions" U1: they
     are relabelled once to pitch order. The status line appends "Bottom seat
     numbers now run low to high." to the move line.
   - Test: `FPD: the first slide on a seated bottom ring folds seats into angles:
     no position changes, the record carries no seats.bottom, and the labels
     run U1..Un low to high`.
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: the first slide'`
6. **Sole bottom note (design A10, R3).**
   - A bottom note lifts, drags and nudges even when it is alone on its ring.
     The `liftNote`/`activateNote` `n.k < 2` refusal stays for rim and inner
     notes.
   - PREVIOUS NOTE / NEXT NOTE (`ringPickable`) include a sole bottom note.
   - "This pan has no ring with two notes, so there is nothing to rearrange."
     shows only when `!hasTwoNoteRing()` AND there is no bottom note.
   - Test: `FPD: a scale with one bottom note opens the drawer with it pickable,
     a drag moves it, and the nothing-to-rearrange line never shows`.
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: a scale with one bottom'`
7. **Hint and pick copy (design A5).**
   - `DRAWER_HINT` gains "Bottom notes also slide along their ring: hold one
     and drag it to where it sits on your pan." only while the pan has a bottom
     ring.
   - A bottom pick says "Picked up C3. Drag it along the ring to move it, or
     drop it on another bottom note to swap.", plus ", or use the finer
     controls below." when `#scale-fine` is open.
   - Rim and inner copy is unchanged.
   - Test: `FPD: the hint and the pick announcement name the slide only on a pan
     with bottom notes`.
   - Accept: green. The hint wraps to at most one extra line at 380px.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: the hint'`
8. **Keyboard parity (design A4, R1, R3).**
   - New `.mirror` pair in `#scale-fine` after PREVIOUS SEAT / NEXT SEAT:
     ANTICLOCKWISE `#scale-angle-prev` and CLOCKWISE `#scale-angle-next`.
     - `aria-label`s: "Move 5 degrees anticlockwise" and "Move 5 degrees
       clockwise".
     - The pair is hidden unless the picked note is a bottom note.
     - It is enabled for a sole bottom note (R3).
   - A nudge into the floor is refused with the warn "G3 is in the way." and
     changes nothing; it never snaps past.
   - A successful nudge says "C3 at 315°, lower right." through
     `#scale-drawer-status`.
   - PREVIOUS SEAT / NEXT SEAT (`stepSeat`) on an angled ring exchange angle
     entries (as in step 2).
   - Arrow keys keep the `walkFocus` contract. Space and Enter keep pick.
     Escape keeps `putDownPick`.
   - `putDownPick` says "The moves you made are kept." when an angle changed.
   - Add both ids to `tools/sandbox.js` ELEMENT_IDS.
   - Tests:
     - `FPD: with a bottom note picked by PREVIOUS NOTE, CLOCKWISE moves it 5°
       and a nudge into the floor is refused`
     - `FPD: the angle pair is hidden for rim and inner picks and moves no
       existing control`
   - Accept: green. The Tab-order tests (SPB) are updated only by inserting
     the two stops.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: (with a bottom|the angle pair)|SPB'`
9. **Notices, RESET and count changes (decision 8, design A6, A11, R9).**
   - `layoutNoticeText` reads `layoutBase.angles` in both its `same` and
     `custom` tests.
   - The suffix loop writes " The bottom seats and angles were reset." or " The
     bottom angles were reset." per decision 8.
   - `syncRingCounts`/`fitSeats` gain `fitAngles`. Its sentence is the same one
     as today's: "The bottom now has N notes, so its seats and angles were
     reset." or "... so its angles were reset."
   - RESET LAYOUT (`resetLayout`, `#scale-layout-reset`) is enabled when angles
     are set, and clears them.
   - An angles list on a deck with no bottom notes is dropped at build with no
     notice.
   - Tests:
     - `FPD: an angle-only change shows Layout not saved yet, and a reopened
       angle-only record shows Layout changed from the default with RESET
       enabled`
     - `FPD: RESET LAYOUT clears angles and a bottom count change resets them
       with one sentence`
     - `FPD: angles on a pan with no bottom notes are dropped silently`
   - Accept: green.
   - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: (an angle-only|RESET LAYOUT clears|angles on a pan)'`
10. **SAVE, Edit and the link (D5, eng A5).**
    - SAVE stores `options.angles` and Edit restores the moved drawing.
    - `syncRoute` writes a `#s=` code carrying `at-`.
    - SAVE from Edit after a move stores the same record as opening the
      resulting link.
    - Tests:
      - `FPD: SAVE after a move stores options.angles, Edit redraws it, and
        opening the bar's link stores the same record`
      - e2e `FPD: a v5 link opens, the bar ends on v6, and Back leaves the
        page`. This is the twin of "SV: a v4 link opens, the bar ends on v5,
        and Back leaves the page", which stays.
    - Accept: green.
    - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: SAVE after' && CHROME_BIN=$CHROME_BIN node --test tests/e2e.test.js --test-name-pattern 'FPD: a v5 link|SV: a v4 link'`
11. **Hit layer (design A7).**
    - `panHitRadii`/`sizePanHits` targets follow moved notes.
    - Test: `FPD: after a move each hit target is centred on its drawn note, and
      two bottom notes at the floor at 380x780 get their actual pairwise size
      (about 35px)`. It asserts the measured size, not 44px.
    - Accept: green.
    - Verify: `node --test tests/app.test.js --test-name-pattern 'FPD: after a move'`
12. **e2e at three viewports (design A7, A8, A12).**
    - Real touch drags use `Input.dispatchTouchEvent`, the existing hold-timing
      helpers, at 380x780 and 844x390, and a mouse drag at 1280x800.
    - Each viewport covers:
      - a clear release landing within one step;
      - a release on a note (swap);
      - a snap-away release;
      - a cancel (second touch or Escape);
      - the drawer not scrolling during the drag;
      - the status line, `#scale-fine` and the primary in view or reachable by
        the sheet's scroll.
    - At 380x780, a release at 270° leaves the lip state unchanged and no
      control sits under the lip's tap zone.
    - At 844x390, the drag runs from 90° to 180°, the band does not scroll, and
      the status line heads the controls column.
    - Tests:
      - `FPD: a touch drag on the bottom ring at 380x780 moves, swaps, snaps
        away and cancels without scrolling the drawer or touching the lip`
      - `FPD: at 844x390 a drag from 90° to 180° lands with the band pinned and
        the status heading the controls column`
      - `FPD: at 1280x800 a mouse drag moves a bottom note`
    - Accept: green on CI at the head SHA. Locally, run one test at a time,
      because the full suite starves Chrome.
    - Verify: `CHROME_BIN=$CHROME_BIN node --test tests/e2e.test.js --test-name-pattern 'FPD: (a touch drag|at 844x390 a drag|at 1280x800 a mouse)'`
13. **Mutants**, each killed:
    - `fpd_drawer_writes_no_option`
    - `fpd_snap_away_disabled`
    - `fpd_nudge_snaps_past`
    - `fpd_other_ring_refuses_bottom`
    - `fpd_sole_bottom_refused`
    - `fpd_notice_ignores_angles`
    - `fpd_notice_suffix_missing`
    - `fpd_reset_keeps_angles`
    - `fpd_fold_keeps_seats`

    Accept: each one reds a test. Verify: `bash tests/mutation_check.sh tests/mutants/fpd_*.patch`
14. **Gates and FLOORS.**
    - Accept:
      - `python3 tools/inline_engine.py --check`, `python3 tools/sync_decks.py
        --check` and `python3 tools/validate.py` are green;
      - FLOORS rows are raised for every owned file that grew.
    - Verify: `python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py && python3 tests/suite_health.py`
15. **DEV hand check.** After the dev PR merges, on
    handpan-cards-dev.pages.dev at phone width:
    - drag a bottom note;
    - reload the link;
    - build the PDF.

    Accept: the note is where it was dropped in all three. Record the result
    in the PR body.

### Lane P: print parity (tests only)

- **GOAL.** Show that the app `pan()`, `pdfcards.js` and `hifi.draw_pan` draw
  moved bottom notes at the same centres.
- **NON-GOALS.**
  - No drawing change in any renderer.
  - No `tools/gen_deck.js` flag.
  - No change to built-in cases.
- **OWNS.**
  - `tests/test_pdf_parity.py`: `CASES` and a fourth case kind in
    `_build_pair`.
  - `tests/pdf.test.js`
  - one fixture, `tests/fixtures/free_placement_case_v1.json`: a `build`
    output with `angles` set on three bottom notes (eng A8 option i)
  - `tests/mutants/fpp_*.patch` (one)
  - the FLOORS rows of `tests/test_pdf_parity.py` and `tests/pdf.test.js`
- **NEVER TOUCH.**
  - `src/engine/*.js` and `tools/hifi.py`
  - `tools/gen_deck.js`
  - `index.html`
  - `tests/test_render_agreement.py` and `tests/test_deck_data.py`
- **Base.** P's branch is cut from L's verified head. Its title says "stacked
  on #<L>".

Steps:

1. **Fixture and case kind.**
   - The fixture is written by a one-off `node -e` call into
     `HPE.layout.solve`. The command is recorded in the fixture's
     `_generated_by` key.
   - `_build_pair` reads it as a payload case. `test_the_sweep_actually_ran`
     counts it.
   - Test: `FPP: the free-placement fixture is a solve output with three bottom
     angles set`.
   - Accept: green.
   - Verify: `python3 -m unittest tests.test_pdf_parity -k FPP`
2. **Per-field agreement.**
   - Test: `FPP: app, pdfcards and hifi agree per field to 0.5 pt on moved
     bottom notes`. It runs through the existing `_glyphs(nd=1)` comparator,
     and its JS side is in `tests/pdf.test.js`.
   - Accept: green.
   - Verify: `python3 -m unittest tests.test_pdf_parity && node --test tests/pdf.test.js --test-name-pattern 'FPP:'`
3. **Built-ins untouched.**
   - Accept: `tests/test_render_agreement.py` and `tests/test_deck_data.py`
     are green and unedited.
   - Verify: `python3 -m unittest tests.test_render_agreement tests.test_deck_data`
4. **Mutant** `fpp_pdfcards_bottom_at_default`. It makes `pdfcards.js` draw
   bottom fields at `bottomAngles()` instead of slot 4.
   - Accept: it reds step 2.
   - Verify: `bash tests/mutation_check.sh tests/mutants/fpp_*.patch`
5. **FLOORS.**
   - Accept: the rows are raised from CI at the head.
   - Verify: `python3 tests/suite_health.py`

### Lane W: docs

- **GOAL.** `CLAUDE.md`, `README.md` and `docs/ENGINE-SPEC.md` describe free
  placement. Every sentence names its test, or says "(no test; true by
  <file>)".
- **NON-GOALS.**
  - No code.
  - No test edits beyond FLOORS.
  - No rewrite of sections unrelated to placement or sharing.
- **OWNS.**
  - `CLAUDE.md`
  - `README.md`: the feature line and the mutant count, which is set from the
    corpus on disk at W's head. It is 1357 at base plus the 23 patches above,
    about 1380.
  - `docs/ENGINE-SPEC.md` outside L's sentences, including section 14.
  - `docs/plans/2026-10-23-free-placement.md`, a copy of this plan with lane
    PR numbers filled in.
- **NEVER TOUCH.** All code, all tests, and `data/`.
- **Base.** W's branch is cut from D's head with P's head merged in. Its title
  says "stacked on #<D> and #<P>".

Steps:

1. **CLAUDE.md.**
   - A "Share link v6" paragraph beside the v5 one, for the `at-` shape. It
     says `at-` is v6-only, VERSION is 6 and RECORD_VERSION is 4, and it cites
     the `FPS:` titles.
   - In "Generated layouts", a sentence that bottom notes may carry absolute
     angle overrides on a 5° step, with the floor, citing the `FPL:` titles.
   - In the "Known pitfalls" drawer bullets, these sentences, citing the `FPD:`
     titles:
     - the slide, snap-away, the angle pair and the fold;
     - the pitfall that `seats.bottom` and `angles` never coexist.
   - The eight decisions and the two AFK decisions, as a dated owner-decision
     note.
   - Accept: every new sentence names a test that exists at W's head.
   - Verify: `python3 -m unittest tests.test_readme_currency tests.test_ci_scope && node --test tests/app.test.js --test-name-pattern 'about section'`
2. **ENGINE-SPEC section 14.**
   - Correct the stale "shipped `share.VERSION` is 4" sentence to 6, in the
     same sentence that adds the v6 shape.
   - Accept: the sentence matches `share.js`.
   - Verify: `git grep -n 'share.VERSION' docs/ENGINE-SPEC.md`, plus the step 1
     verify
3. **README.**
   - Add the feature line.
   - Set the mutant count from `ls tests/mutants/*.patch | wc -l` at the head.
   - Accept: `tests.test_readme_currency` is green.
   - Verify: `python3 -m unittest tests.test_readme_currency`
4. **Plan copy.** Write `docs/plans/2026-10-23-free-placement.md` with the PR
   numbers filled in.
   - Accept: the file exists. CI runs anyway, because `CLAUDE.md` and
     `README.md` changed (doc-only applies only to `docs/plans/` and
     `docs/prompts/`).
   - Verify: `python3 tools/ci_scope.py < <(git diff --no-renames --name-only HEAD^1 HEAD)`, which must print a run verdict.

## Sequencing

```
8d0dd89 (#490)
 ├─ L  (stacked on #490)
 │   ├─ P  (cut from L's verified head; stacked on #L)
 │   └─ S steps 7-9 rebase onto L (stacked on #L)
 └─ S  steps 1-6 in parallel with L
          └─ D  (cut from S's head after S step 7; stacked on #S)
                 └─ W  (D's head with P merged; stacked on #D and #P)
```

- L and S start together from 8d0dd89, in two worktrees.
- P starts once L has a verified head and a reviewer PASS.
- S takes steps 7 to 9 after rebasing onto L's verified head.
- D is cut from S's head after S step 7.
- W goes last.
- **`tests/app.test.js` is edited by S, then D, never at the same time**
  (eng A5).
- **`tests/suite_health.py` FLOORS rows** are per file. A textual conflict
  between P and D at W's merge is resolved by keeping both rows.
- **Engine regions:** L and S both regenerate them. A conflict is resolved by
  re-running `python3 tools/inline_engine.py`, never by hand.
- Each lane works in its own `git worktree add` from its base. The live
  checkout is never used.

## Merge gates (every lane)

1. **CI green at the verified head.** CI `validate` is green at the verified
   head SHA.
   - Read it with `gh run list --commit <sha> --workflow validate.yml`, never
     from `gh pr checks` buckets.
   - `gh pr view <n> --json state,headRefOid,mergeable`: the head equals the
     local tip, re-queried once if it lags. The PR is not CONFLICTING, because a
     CONFLICTING PR queues no CI.
   - The mutation gate has no survivor among the new patches. A lone survivor
     on an unrelated patch gets a rerun at the same SHA first.
2. **Independent reviewer.** A fresh reviewer subagent returns PASS or
   PASS_WITH_NITS at that same SHA. A FAIL needs a concrete failure scenario.
   - It checks out `review-<lane>` at the SHA in its own worktree, with no
     `node_modules`.
   - It runs `/review` read-and-report, with `OPENCLAW_SESSION=1` on every
     Bash call.
   - It is briefed with this lane's GOAL, NON-GOALS, OWNS, NEVER TOUCH and
     steps, quoted verbatim.
3. **Dev first.** The lane opens PR M (base `main`, title "<lane>: ... (stacked
   on #<prior>)"). The integrator then opens PR D from the same head to `dev`.
   PR D merges with `gh pr merge <D> --merge` when its head SHA has a green
   `validate` run on M and it is not CONFLICTING.
   - Lane D also needs the DEV hand check (D step 15).
   - After each dev merge there is no overlay restore. The overlay was retired
     in pass 7 (#481/#482).
4. **Main PRs are HELD for the owner.** M merges only on the owner's word,
   after #490 and the PRs it stacks on.
5. **Standing checks.** These run at every head:
   - `python3 tools/validate.py`
   - `python3 tools/inline_engine.py --check`
   - `python3 tools/sync_decks.py --check`
   - `node tools/regen_engine_corpus.js --check`

   FLOORS rows are set from main's CI artifacts (`by_module` / `files[].total`)
   after the merge before them. The README count moves with W.

## Mutant matrix

| Lane | Patches | Kills |
|---|---|---|
| L | 7: `fpl_floor_unchecked`, `fpl_step_unchecked`, `fpl_range_unchecked`, `fpl_wrap_pair_unchecked`, `fpl_override_before_geometry`, `fpl_override_before_reseat`, `fpl_seats_and_angles_accepted` | L steps 1-4 |
| S | 6: `fps_option_dropped_on_encode`, `fps_out_of_order_accepted`, `fps_check_skips_option`, `fps_bottom_seats_beside_angles`, `fps_v5_reader_accepts_at`, `fps_decode_skips_floor` | S steps 1-7 |
| D | 9: `fpd_drawer_writes_no_option`, `fpd_snap_away_disabled`, `fpd_nudge_snaps_past`, `fpd_other_ring_refuses_bottom`, `fpd_sole_bottom_refused`, `fpd_notice_ignores_angles`, `fpd_notice_suffix_missing`, `fpd_reset_keeps_angles`, `fpd_fold_keeps_seats` | D steps 1-10 |
| P | 1: `fpp_pdfcards_bottom_at_default` | P step 2 |

The total is 23, so the README goes from 1357 to about 1380. It is a band test
(at least 90% of the corpus), so intermediate lanes do not edit the README.

## Conflicts with queued work

- **#496 (OEC nits) and #498 (parent inferred).** Both are stacked on #490 and
  held.
  - They touch `tests/share.test.js`, `tests/app.test.js`, `tests/e2e.test.js`,
    `index.html` (app script), `tests/suite_health.py`, `CLAUDE.md`,
    `README.md` and `docs/ENGINE-SPEC.md`.
  - Whichever lands second rebases. S, D and W re-run their verify commands
    after the rebase.
  - Neither touches `layout.js`, so L and P are clear.
- **Print-header #469 and #486.** They touch `pdfcards.js` drawing code,
  `tools/hifi.py`, `tests/test_render_agreement.py`, `tests/pdfcards.test.js`,
  `tests/test_print.py`, `tests/app.test.js` and `p_*` mutants.
  - P is test-only and uses `fpp_*`, so the only overlap is FLOORS rows and
    `tests/app.test.js` (D).
  - The pdf-cleanup lanes wait for those PRs. If they reach `pdfcards.js`
    bottom drawing, P re-runs.
- **i18n.** The drawer status copy becomes a string table. D lands first, or
  i18n rebases on D.
- **Order-free (#479, #485, #490).** They are the base, so there is no
  conflict.

## Cost

L 1 d, S 1 d, D 3.5 d (design A9), P 0.25 d, W 0.5 d: about 6.5 lane-days with
reviewer bounces.

## Merge resolutions

- **R1. Label rule under active angles.**
  - Eng A9 says a swap exchanges the two angle entries and the labels stay with
    the notes.
  - Design A4 says a swap exchanges the angles AND the seat labels.
  - Chosen: eng. Decision 4 forbids `seats.bottom` beside `angles`, and a label
    permutation needs `seats.bottom`, so design's version cannot be stored.
    Decision 7 also reads that way.
  - Applied in D steps 2 and 8. Design A4's "one meaning for PREVIOUS SEAT /
    NEXT SEAT" is kept: the buttons and the drop do the same thing.
- **R2. The fold.** AFK A9 is binding: fold on the first slide. Eng A9 claims
  "nothing visibly moves". That holds for positions but not for labels on a
  non-identity seated ring.
  - Folding drops `seats.bottom`, and `merge` then writes source labels, which
    are in pitch order.
  - That conflicts with decision 7 and needs the owner: see U1.
  - The plan is written to U1's recommended option. D step 5 is the only step
    U1 affects.
- **R3. Sole bottom note.**
  - Design A4 disables the angle pair on a one-note ring. Design A10 enables it.
  - Chosen: A10. It is the later and more specific amendment, and A4's
    disabled state would ship a control the commonest bottom shell cannot use.
  - Applied in D steps 6 and 8.
- **R4. Cost.**
  - Eng keeps about 6 lane-days. Design A9 puts D at 3.5 d.
  - Chosen: design. It is the amendment that added the work. The total is
    about 6.5.
- **R5. Base and sync.**
  - The draft and eng say `origin/main` d8d2a2d, and the draft's sync step
    restores `_headers` and the GA placeholder.
  - Chosen: 8d0dd89, per the brief. There is no restore step, because the
    overlay was retired in pass 7 (#481/#482).
  - Lane PRs say "stacked on #490" (L, S) or on the prior lane.
- **R6. Where the floor is checked.**
  - The draft has `readAngles` check the floor. The floor needs geometry and
    the effective placement (eng A6), which `readAngles` does not have.
  - Chosen:
    - `readAngles` checks shape only;
    - `solve` checks the floor through the exported `bottomClash`;
    - S's `decode` and the app build block call `solve` and turn a refusal into
      BAD_NOTE.
  - This keeps decision 3's "the engine refuses" and the draft's "decode never
    repairs".
- **R7. One floor predicate.**
  - The draft has the drawer snap away and the engine refuse, with no shared
    code. Two copies of the floor would drift.
  - Chosen: `HPE.layout.bottomClash` is the only implementation, and D calls it.
  - The predicate includes top-shell clearance, so "never allow an overlap"
    holds whatever L's sweep finds.
- **R8. Mutant prefixes.**
  - Eng A10 names the prefixes `l_`, `s_`, `d_` and `p_`. The `p_` prefix is
    already taken by print-header patches (`p_clip_js`, `p_degree_y_py`, ...)
    in #469/#486.
  - Chosen: `fpl_`, `fps_`, `fpd_` and `fpp_`.
- **R9. Decision 8's wording against design A6.** These are not in conflict:
  they are two sites.
  - Decision 8's suffix is the `layoutNoticeText` suffix loop (shipped as " The
    ${ring} seats were reset.").
  - A6's "so its seats and angles were reset." is the drawer status sentence
    in `syncRingCounts` (shipped as "The ${ring} now has N notes, so its seats
    were reset.").
  - Both are applied, in D step 9.
- **R10. Floor figure.**
  - Decision 3 says "2 x r_bnote plus one step = 15". Read literally, 11.86 + 5
    is about 16.9, not 15.
  - Chosen: the smallest multiple of 5 strictly greater than the touching
    angle, capped by the default gap. That gives the owner's figure, 15, on
    every standard ring, and keeps the default placement legal.
  - Recorded in "Data model".
- **R11. e2e twin ownership.**
  - The draft puts the v5-to-v6 e2e twin in S6. Eng A5 moves it to D.
  - Chosen: eng. `tests/e2e.test.js` is D-owned. Applied in D step 10.
- **R12. The SV version test.**
  - "SV: a 5 not followed by / is BAD_NOTE, and 6 or above is NEEDS_NEWER_APP"
    fails as soon as VERSION is 6, and no review listed it.
  - Chosen: S step 2 rewrites it for 6 and 7.

## Anchors re-verified at 8d0dd89

All of these exist at 8d0dd89, except the ones marked as moved or vanished.

- **`src/engine/layout.js`.** `solve`, `collect`, `resolveMirrors`,
  `resolveAnchor`, `countsOf`, `readSeats`, `placeZones`, `bottomAngles`,
  `geometry`, `reseat`, `merge`, `seatsFromOrder` and `GEOM_KEYS`.
  - The file is unchanged since d8d2a2d.
- **`src/engine/share.js`.**
  - `var VERSION = 5;` and `var RECORD_VERSION = 4;`
  - `OPTION_ORDER` is `{ palette: 0, parent: 1, mirror: 2, between: 3, seats: 4 }`.
  - `decodeReadable` still hardcodes `var meaning = ["5", scale];`.
  - `decodeSeed` routes `version >= 5` to `decodeReadable`.
  - Moved: the checksum now calls `HPE.core.fnv1a32`. The local `fnv1a` went
    to `core.js` in the order-free stack. The behaviour is unchanged.
- **`index.html` app script.**
  - Drawer state and copy: `DRAWER_HINT` (text unchanged), `layoutBase`
    (`{ anchor, mirror, mb, seats }`), `layoutStatus`, `layoutNoticeText` and
    its suffix loop.
  - Picking and seats: `ringNotes`, `swapSeats`, `pickAnnouncement`,
    `activateNote`, `stepSeat`, `putDownPick` and `resetLayout`.
  - Drag: `dropNote`, `targetAt`, `makeGhost`, `seatGhost`, `returnGhost`,
    `liftNote`, `repaintPlate`, `ringPickable`, `hasTwoNoteRing` and
    `walkFocus`.
  - Seats bookkeeping: `fitSeats`, `setRingSeats`, `syncRingCounts`,
    `sheetOptions`, `layoutOptions` and `layoutSeats`.
  - Plate and decks: `panHitRadii`, `sizePanHits`, `pan`, `generateDeck` (the
    build block), `SHARE_VERSION`, `syncRoute`, `shareCode`, `openShare` and
    `const DECKS`.
  - Markup and markers: `#scale-fine`, `#scale-seat-prev`/`#scale-seat-next`,
    `#scale-drawer-status`, `#scale-layout-reset`, and the `<!-- engine:share
    begin -->` / `<!-- engine:layout begin -->` markers.
  - Moved: every app-script anchor sits about 18 lines lower than at d8d2a2d.
    The drawer code is otherwise unchanged by the order-free stack.
  - Not a function: `placeOf` is a `const` arrow beside `const PLACES`, and
    `seatsKey` is a `const` arrow. `GHOST_LIFT` is a `const` on the `HOLD_MS`
    line.
  - Vanished: there is no `function panFlash`. `panFlash` is a `let` state
    variable passed as `flash:` to `pan()`, with a 600ms `flashTimer` set in
    `swapSeats`. The design review's "flashes through `panFlash`" means that
    state.
- **Tests.**
  - `tests/drawer_drag.test.js` "DR2b browser rule D (41, 42, 47): a real touch
    hold-and-drag swaps one pair per ring of Pygmy".
  - `tests/app.test.js` "Not moved. Drop A3 on another rim note to swap." and
    the SV app tests.
  - `tests/e2e.test.js` "SV: a v4 link opens, the bar ends on v5, and Back
    leaves the page".
  - `tests/share.test.js`: "D5-5: seats change the share string but never the
    deckId" and every SV title quoted above.
  - `tests/layout.test.js`: the three sweep titles and the built-in seating
    title.
  - `tests/test_pdf_parity.py`: `_generate` (`gen_deck.js --legacy`), `CASES =
    SEEDS + BUILTINS`, `VECTOR_FLOORS`, `_build_pair` and
    `test_the_sweep_actually_ran`.
- **`docs/ENGINE-SPEC.md`.** The draft and eng cite section 13/14 line
  numbers. Section 14 "Sharing" still says "shipped `share.VERSION` is 4",
  which is stale against 5 at base. The `seats` sentences are cited by section
  in L's OWNS.
- **Constants.**
  - `HPE.share.VERSION` is 5 and `RECORD_VERSION` is 4.
  - The README mutant count is 1357. Eng cited 1348 at d8d2a2d.
  - The README suite counts are 25 node and 16 python.
  - FLOORS rows at base: app.test.js 762, e2e.test.js 460, share.test.js 90,
    layout.test.js 91, drawer_drag 33, drawer_seats 28, drawer_grid 3,
    seat_sweeps keys 4 / tap_add 3 / tap_edit 3, pdf.test.js 14,
    test_pdf_parity.py 13.

## Unresolved decisions

**U1. Labels at the fold** (R2: AFK A9 against decision 7). It applies to a
bottom ring whose `seats.bottom` is not the identity. The owner's own E Amara
link carries `seats-;;4,2,0,1,3`, so it is the first case anyone will hit. On
such a ring, a note shows the label of the seat it was swapped into. The fold
drops `seats.bottom`, and without it no label permutation can be stored.

1. **Recommended: relabel once at the fold, to pitch order.**
   - The first slide keeps every position, renumbers the bottom labels U1..Un
     low to high (the Pygmy convention), and says so in the status line:
     "Bottom seat numbers now run low to high."
   - It keeps decisions 4 and 5 and the S wire shape intact.
   - It breaks decision 7 once, at a visible and announced event. Every later
     slide keeps labels.
   - Cost: none beyond D step 5 as written.
2. **Alternative: keep `seats.bottom` as a label-only permutation beside
   `at-`.** Labels never change. This reverses decision 4.
   - Steps that change:
     - L step 4: `seats.bottom` beside angles becomes valid, and `merge` takes
       labels from seats and angles from the list. The mutant
       `fpl_seats_and_angles_accepted` is dropped.
     - S steps 1, 4 and 7: the bottom seats list is written beside `at-`, and
       `fps_bottom_seats_beside_angles` is dropped.
     - D steps 2, 5 and 8: a swap exchanges angles and labels, which is design
       A4's original reading.
     - W's pitfall sentence.
   - Cost: about +0.5 lane-day.

No other decision is open. OQ1 and eng A9 are settled by the AFK decisions
above, and every other amendment is folded in.

## Integrator decisions (2026-10-23, AFK)

- **U1 = option 1 (relabel once at the fold, low to high, with the status line "Bottom seat numbers now run low to high.").** Recorded for the owner as an AFK auto-decision that bends decision 7 once at an announced event. Only D step 5 depends on it, so the owner can flip it to option 2 before lane D starts; L and S are written for option 1.
- **"Rebase onto L" means merge, not rebase.** S takes L's verified head with `git merge <L-sha>` (a merge commit on S's own branch) instead of rewriting history, so no force-push is needed. Engine-region conflicts are resolved by re-running `python3 tools/inline_engine.py`.
- **PR bases.** Every lane PR has base `main` (CI only runs on PRs into main) and names its stack in the title, e.g. "FP-L: ... (stacked on #490) - HELD". A PR whose base is a lane branch gets no CI.
- **Branches / worktrees.** L: `claude/fp-l`, `/Users/ray/Projects/wt-fp-l`. S: `claude/fp-s`, `/Users/ray/Projects/wt-fp-s`. D: `claude/fp-d`. P: `claude/fp-p`. W: `claude/fp-w`.
- **FP-S1 (2026-10-23, AFK, plan gap).** S step 2 flips VERSION to 6, so R11's move of the e2e twin to D leaves S's own PR red until D. Reverting R11 for that one test: S owns the edit of `tests/e2e.test.js` "SV: a v4 link opens, the bar ends on v5, and Back leaves the page" (its expectation and title move to v6; nothing else in e2e.test.js). D step 10 keeps every other e2e edit. S also owns re-anchoring the existing mutants its share.js/generateDeck changes staled: dr3_deck_build_copies_angle_only, r4e_share_encode_cap_unchecked, r4e_share_seats_only_rim_written, s3_share_anchor_dropped, s_share_order_dropped, s_share_order_unchecked, sv_auto_label_read_as_name, sv_check_over_raw_text, sv_record_version_follows_wire, w1_generatedeck_omits_mirrorbottom, sv_same_deck_v4_reimports (same mutation, re-anchored, kills/suite lines matching the renamed tests; never weakened). Mutant count is unchanged by a re-anchor.
- **FP-L1 (2026-10-23, AFK).** L step 7: `fpl_override_before_geometry` and `fpl_override_before_reseat` are equivalent mutants (geometry is computed from the default placement and `seats.bottom` is refused beside angles, so neither ordering is observable; 300 random overrides x 6 shapes showed 0 geom differences). Dropped rather than kept as permanent survivors; `fpl_null_not_solved_angle` added. L ships 6 fpl mutants, not 7; the mutant matrix total drops by 1. Reviewer to confirm the equivalence claim.
- **FP-L1 amended (2026-10-23, after L review 1 FAIL).** The reviewer refuted half of FP-L1: `fpl_override_before_geometry` is NOT equivalent (panFields(9,2,35), U1=275: r_bnote 0.0860 vs 0.0869). It returns, killed by a new test. `fpl_override_before_reseat` stays dropped (confirmed equivalent). L ships 7 fpl mutants.

- **FP-S2 (2026-10-23, after S review 1 FAIL).** S's edits to `sv_sharp_written_as_hash.patch` (header only) and to the four non-SV app tests that pin a version or link string ("S3: seats, anchor and a one-ring mirror travel...", "rule N: a moved deck's stored record...", "SU: syncRoute is idempotent", "SU: a hashchange to an unsorted v5 spelling...") are accepted as forced by VERSION 6 and fall inside S's ownership. README.md stays NEVER TOUCH for S (reverted to the base count; the integrator reconciles on dev and lane W at release). S may add one mutant, `fps_decode_floor_ignores_mirror`, for the mirror fix.

- **FP-P1 (2026-10-23, after P review 1 FAIL).** The app `pan()` side of P's GOAL had no test. P adds a test that boots the sandbox, calls `pan()` on the fixture deck and checks the bottom-circle centres against the fixture angles and the pdfcards centres. P may also ship a second mutant, `fpp_app_pan_ignores_angles`, taken from the reviewer's M3, which that test kills.

- **FP-S3 (2026-10-23, at the S dev sync).** PI (#498, parentless decks) and S are siblings on #490, and together they break. PI's four `PI:` tests in `tests/app.test.js` pin v5 links, and the "rule N: a moved deck's stored record…" test needs PI's parentless record together with S's v6 link (merged: `#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/mirror/between/seats-1,0,2,3,4,5,6,7;;/bbc2db`). Fix: S merges PI's head and re-points those tests to v6, so the stack runs linearly #490 → #498 → #501. S may retitle the four PI tests and the rule N test, from v5 to v6, and may edit CLAUDE.md only where it quotes those retitled titles. For this merge only, S may also set the README mutant count to the `ls` count (1372).

## Superseded 2026-10-23 (seat order)

No history above is rewritten. Owner decision 2026-10-23 (bottom-seat-order workstream, lane SO-C): a seat's number belongs to the seat, not the note. Three passages are superseded.

- `:45`, "A moved note keeps the label of the seat it left. No card's number line changes because a note slid." now reads: the U-numbers keep their home order around the ring; a swap trades only the two labels ("SO: a swap from any accepted bottom layout trades only the two swapped labels, pinned at C3 140 and Bb3 105, with MIRROR BOTTOM off and on") and a slide that passes a note renumbers by that order ("SO: a slide that crosses a note keeps the cyclic order: Eb3 to 90 reads Eb3 U5 and Db4 U3").
- `:110-112`, "With `angles` set and no `seats.bottom`, `merge` writes slot 4 only for bottom fields. Slot 5 keeps the source label, so a note's label never moves with its angle." now reads: `merge` writes slot 4, then relabels slot 5 of the bottom fields by the cyclic-order rule ("SO: an angles swap of Db3 and Db4 on Pygmy draws U5 at 60 and U2 at 240, as the seats swap does"; "SO: on a cost tie the bottom labels take the rotation that turns the notes furthest anticlockwise: Pygmy at 75 285 0 180 60 120 reads C3 U5 Db3 U2 Eb3 U1 Bb3 U4 Db4 U3 Ab5 U6, and mirrored at 75 285 180 0 120 60 reads C3 U6 Db3 U1 Eb3 U3 Bb3 U2 Db4 U5 Ab5 U4").
- `:1050`, "U1 = option 1 (relabel once at the fold, low to high, with the status line "Bottom seat numbers now run low to high.")" is superseded: the fold keeps the seated labels and announces nothing ("SO: the first slide on a seated bottom ring folds seats into angles: no position changes, the record carries no seats.bottom, and every seat keeps its number").
