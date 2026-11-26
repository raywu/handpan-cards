# Scale editor: v4 gap analysis and lane plan (TRI-59, plan only, 2026-11-07)

Parent plans: `docs/plans/2026-11-05-scale-editor-reinvent.md` (D1-D23, parity tests) and
`docs/plans/2026-11-06-scale-editor-u2-split.md` (lanes U2a-U2j, owner feedback). Where this file and
those disagree, they win, except where a row below is marked **owner decision**.

## 0. Goal and owner rule

- Goal: the editor's add-and-edit UX matches mock v4 ("artifact v4 is exactly what we want", owner
  2026-11-06).
- Owner clarification (2026-11-06): pixel-perfect is NOT required. Keep the app's own visual system.
  The UX of adding and editing notes must match v4 as closely as possible. That covers tap and drag
  placement, move, swap, remove, pills and areas, octave and flats, Undo, and the order of steps.
- Classification used below:
  - **UX**: must close.
  - **visual**: close only if it is cheap or hurts usability; otherwise it is ACCEPTED as is.
- Non-goals:
  - pixel-matching v4's fonts, radii, colours or icon buttons;
  - the v4 walkthrough strip (`?demo=tour`) and the mock-only "Reset to D Kurd 9" button;
  - any change to deck data, verified layouts, CARD-SPEC geometry, the engine, share/record formats,
    caps 12/6/12 or the "scale" visible-text rule;
  - the keyboard lane's scope beyond what v4 shows (U2g stays as planned).

## 1. Sources and evidence

- TARGET: mock v4 `scale-editor-mock-v4.html` (session scratchpad). Functions cited by name: `put`,
  `nearest`, `preview`, `tapNote`, `renderPalette`, `renderZones`, `canEnter`, `canLeave`,
  `removeNote`, `snapScope`, the pointer handlers.
- BUILT: qa-harness preview at cffc731a (U2a-U2d, `ONE_PANEL = true`). Functions: `editorOpen`,
  `editorRender`, `editorRenderTray`, `editorRenderAreas`, `editorWithOverlay`, `editorTrade`,
  `editorSelectTap`, `editorPlaceHeld`, `editorHitAt`.
- U2f (PR #920, head 658db05d, open, not shipped): `editorDropPlan`, `editorDragDown/Move/Up`,
  `editorDropTarget`, `editorTrashNode`, `DRAG_ON_TOUCH`.
  - Caution: `git diff cffc731a 658db05d` also shows unrelated deletions (for example
    `tests/sync.test.js`), because the merge base is 9815fa6.
  - Before review, re-check that U2f stacks on cffc731a lineage (memory: lane branches stack on
    main lineage).
- Screenshots in `<scratchpad>/gap/`:
  - `v4-375.png`, `v4-375-held.png`, `v4-1280-pinned.png`
  - `built-375.png`, `built-375-held.png`, `built-1280-held.png`
  - The built shots were taken on D Kurd 10, entered via "Edit D KURD 10". Both builds measure
    667x375 with no scroll.
  - Limitation: the gstack browse daemon cannot drive pointer drags. Drag rows rest on code reading
    of v4 and U2f, not on recorded gestures.

## 2. Gap table

Gap: none / missing / different / extra. Class: UX / visual. Lane: where it closes.

| # | Element | v4 | Built (cffc731a) + U2f | Gap | Class | Lane |
|---|---|---|---|---|---|---|
| 1 | Layout, phone | Header, line, pan (37vh), pills, toolbar, tray. No scroll. | Same order, no scroll (`built-375-held.png`). | none | - | - |
| 2 | Layout, desktop >=900px | Two columns: pan left, controls right (`v4-1280-pinned.png`) | Single column inside the sheet (`built-1280-held.png`) | different | visual | ACCEPTED. Revisit only if the owner asks at the phone or desktop check. |
| 3 | Status position | Phone: overlays the top of the pan. Desktop: above the pan. Undo/Cancel chip inline. | Line above the pan with an inline Cancel or Undo button. | different | visual | ACCEPTED. Same copy, same chips. |
| 4 | Tray note chips | Flats by default; the octave is shown as a subscript (`G4`). | Sharps by default; the name only (`G`). | different | UX: the user should see the note that will be placed. | U2e (extend): octave subscript on each chip. Default spelling: see OD-V2. |
| 5 | Octave control | A row of direct buttons, one per engine octave (2-6), current one pressed. | `-` / Octave / `n` / `+` stepper, with an "Octave" label (U2d). | different | UX: one tap versus several; "order of steps". | U2e (extend): replace the stepper with one direct button per octave from `editorOctaveRange()`. Keep "Octave N" aria; the visible "Octave" label becomes a group label. |
| 6 | Flats/sharps toggle | One-glyph chip (flat/sharp sign) at the start of the octave row, in Undo. | "Flats" toggle button, in Undo. | different | visual | ACCEPTED. It sits in the octave row with U2e's rework. |
| 7 | Palette chip | Chip at the end of the octave row; swaps the note grid for 10 swatches; a pick recolours and closes; in Undo. | Not built. | missing | UX | U2e (already planned: "D20 palette chip at the end of the octave row ..."). |
| 8 | Hold from tray | Tap a chip: holds it. Status "Holding G4: tap a spot, an area, or the ding." plus Cancel. Tap the same chip again: cancels. Esc: cancels. | Same (`editorHold`, `editorCancelHold`). | none | - | Esc is U2g. |
| 9 | Pills | "+ Rim 9 of 12" etc. Always tappable. With nothing held, they say "Pick a note below, or on the pan, first." A **selected placed note** also moves into that area by pill (`addToZone` uses `armed or selected`). Pills read as "ready" while holding. | Disabled unless a tray note is held (`editorRenderAreas`: `b.disabled = !holding`). No move-by-pill. No ready style. | different | UX | U2f (open, cheap): pills enabled when a note is held OR selected. A selected placed note moves to that area at its auto position via the move step `editorDropPlan` already builds. With neither, the pill says the "pick a note first" copy. Ready style. |
| 10 | Full pill | `aria-disabled`; a tap says "The rim is full ..." | Same copy (U2d). | none | - | - |
| 11 | Empty-area targets | Cyclops arc and bottom ring always drawn as zones (dashed arc, outer band). CYCLOPS and BOTTOM RING captions. Tappable to select the zone for Reset spacing. | Dashed rings drawn only while holding and only when that ring is empty (`editorWithOverlay` `etarget`). No captions. | different | UX: v4 shows where a first cyclops or bottom note can go before you pick a note. | U2f (extend): draw the cyclops arc and bottom band as zones at all times (standard pan), from engine radii, in the app's palette. Captions are visual: add only if they pass the phone fit check, otherwise ACCEPTED. |
| 12 | Tap place, held note | Tap a spot, rim, ding or note: place, replace or ding-replace. Exact cyclops and bottom angles snap to 5 degrees. | Same (`editorPlaceHeld`). | none | - | - |
| 13 | Tap select, then move | Tap a placed note: "G5 picked. Tap another note to swap, or tap a spot to move it." Then tap any spot: move, including **cross-zone** (rim to bottom ring, etc.). | Select, then a spot moves only within the same pinnable ring (`editorSelectTap`). A cross-zone spot clears the selection. No "picked" status line. | different | UX | U2f (extend): select then spot reuses `editorDropPlan`'s move path (remove + place, one Undo step, `canLeave` mins), so tap and drag share it (D3). Add the picked status copy. |
| 14 | Tap two notes | Swap (`swapSeats`, clash refusal) | Swap (`editorTrade`, `sheet.cannot_trade`) | none | - | - |
| 15 | Drop a placed note on the ding | Any placed note swaps with the ding ("A3 is the ding. D3 took its seat."). | Only a bottom note: "Only a bottom note can swap with the ding." (AFK AD-U2c-1, engine rule: the ding is the lowest of rim and cyclops). | different | UX | **OD-V1** |
| 16 | Drag tray note to pan | Ghost follows. Live landing preview: a ring at the snap spot and the zone highlights (`preview`, `hot`). | U2f: ghost plus drop; no landing preview, no zone highlight. | missing (in U2f) | UX: needed for exact cyclops and bottom placement by drag. | U2f (extend): landing ring + zone highlight from `editorHitAt`, on every pointermove after the 8px threshold. |
| 17 | Drag a placed note | Lifts: source fades. Move or swap by drop, cross-zone included. Drop on trash or tray removes. Other drops snap back with "G4 went back. Drop on the trash to remove it." | U2f: move or swap/replace, trash and tray remove, snap back. Source does not fade. No snap-back copy. Cyclops and bottom drag-to-move are in U2f per owner. | partly | UX: fade and snap-back copy | U2f (extend): source fade + snap-back status copy (new i18n key). |
| 18 | Trash target | Fixed pill at the bottom, "Drop here to remove", shown only while dragging a placed note. Highlights when hovered. | U2f: same text, but shown for any drag, tray chips included. | different | visual | U2f (cheap): show it only for placed-note drags, as v4 does. |
| 19 | Remove | Trash button (enabled with a selection, not the ding). The ding refuses: "Every scale needs a ding ..." Mins enforced (rim 1). | Remove button; disabled on the ding. | partly | UX: the ding and min-rim refusal copy when dragged to trash | U2f (extend): trash drop of the ding or the last rim note refuses with v4 copy (today it silently snaps back). |
| 20 | Rim join order | Pitch-order seat; "Custom seat order reset" + Undo | Same (U2c) | none | - | - |
| 21 | Caps and crowded | 12/6/12; crowded label-floor refusal | Same (U2d) | none | - | - |
| 22 | Reset spacing | Scoped by selection or zone; labels; disabled on Neotone and when empty | Same (U2d) | none | visual: v4 icon | ACCEPTED |
| 23 | Pin marker | Dotted ring around a hand-placed cyclops or bottom note | Not drawn | missing | UX: the only cue that a note "stays there" and that Reset spacing has a scope | U2f (extend): pin ring overlay in `editorWithOverlay` for pinned inner and bottom notes. |
| 24 | Placement status copy | "G5 placed on the cyclops at 320 degrees. It stays there." / "added to the rim" | Place has no status line (`editorPlaceHeld` `spot` sets no `say`); move says "{name} moved." | different | UX: feedback | U2f (extend): v4 copy for place, add and move (i18n keys). |
| 25 | Neotone | 9 fields + 9 mutants; empty slots drawn; empty-field refusal; no pills | Not built | missing | UX | U2e (planned "D19/SE-13 ..."). Add: draw empty field and mutant slots as targets (U2f mutant `u2f_neotone_shows_targets` suggests part of this is in U2f; U2e confirms). |
| 26 | Pan type switch | One Undo step | One Undo step (U2b) | none | - | - |
| 27 | Text line | Read-only, tap to edit, parse error keeps text, "Pins reset" | Same (U2b) | none | visual: v4 count "13 notes" on desktop | ACCEPTED |
| 28 | Undo/Redo | Icon buttons; Cmd-Z / Shift-Cmd-Z; inline Undo on status | Text buttons; inline Undo; keyboard in U2g | none (keys: U2g) | visual: icons | ACCEPTED |
| 29 | Save / Back | Save as a new copy for a built-in; Back prompt Save/Discard/Keep | Same (U2b) | none | - | - |
| 30 | Header | Chevron back, scale name as the title | "BACK" plus "EDIT THIS SCALE" (title truncates at 375px) | different | visual | U2e (cheap): use the scale name as the title (`sheet.title_edit` stays as aria). Otherwise ACCEPTED. |
| 31 | Arrow-key nudge | Left/Right moves a selected cyclops or bottom note 5 degrees | Not built | missing | UX (keyboard) | U2g (planned). |
| 32 | Note-size/selection visuals | Selected note: thick purple stroke; filled tone colours | `esel` ring; card palette | different | visual | ACCEPTED |
| 33 | Desktop hint paragraph | Long hint text | One hint line (bottom-to-ding wording) | different | visual | Follows OD-V1. |
| 34 | Motion | 150-200ms ease on zone and fill; reduced-motion respected | None | missing | visual | ACCEPTED |

## 3. Owner decisions

- **OD-V1: ding swap scope (row 15).**
  - The conflict: v4 and D23 say any placed note dropped on the ding swaps with it. AFK decision
    AD-U2c-1 kept the engine rule instead: the ding must be the lowest of rim and cyclops
    (ENGINE-SPEC). So only bottom notes can swap.
  - Making v4 work needs the engine to accept a ding above a rim note. That is an engine and data-model
    change, and it touches the share and record meaning of existing scales.
  - **Recommended: keep AD-U2c-1** (engine rule; copy says "Only a bottom note can swap with the ding").
    It is safe for share compatibility and release safety.
  - Alternative: allow a rim or cyclops swap only when the result still satisfies the engine rule (the
    dropped note is lower than every other rim and cyclops note), refusing otherwise. This is a small
    app-side change in U2f, with no engine change.
  - Not recommended: changing the engine rule.
- **OD-V2: tray default spelling (row 4).** v4 defaults to flats; the build defaults to sharps.
  - **Recommended:** default to the scale's own spelling: flats if the line contains `b`, sharps if
    it contains `#`, otherwise flats. This is in U2e. It is reversible, with no data impact.
  - Alternative: always flats, as in v4.
- **OD-V3: cross-zone move by tap or pill (rows 9 and 13).** v4 lets a placed rim note move to the
  bottom ring or cyclops by spot or pill. It goes through the existing remove+place path (U2f already
  does this for drag), with caps and mins. This is in scope of D4 and D17 and needs no new decision.
  It is listed only because AD-U2c-1 may make some moves refuse. **Recommended: proceed.**
- No row conflicts with deck data, geometry, caps 12/6/12, the "scale" rule (v4 copy uses "scale"
  throughout; "Reset to D Kurd 9" is mock-only) or share compatibility. The palette chip keeps
  `palette-N` (D20).

## 4. Lane changes (smallest change: extend existing lanes)

Standing rules from the U2 split section 2 apply unchanged: TDD, worktree, parity, i18n, mutants,
gates.

### U2f (open, PR #920): extend

- Owns: as planned, plus the items below. The owned files do not change: pointer controller,
  `editorWithOverlay` overlay layer, `editorSelectTap`, `editorRenderAreas`, editor tests and i18n
  rows.
- Adds (UX rows 9, 11, 13, 16, 17, 19, 23, 24; visual row 18):
  1. Live landing preview and zone highlight while dragging (row 16).
  2. Source fade while dragging. Snap-back copy "{name} went back. Drop on the trash to remove it."
     (row 17).
  3. Trash shown only for placed-note drags (row 18).
  4. Trash drop of the ding gives "Every scale needs a ding. Drop another note on it to swap." The
     last rim note gives "The rim needs at least 1 note." (row 19).
  5. Tap-select then any spot moves through the drag move path, cross-zone included, one Undo step.
     Status "{name} picked. Tap another note to swap, or tap a spot to move it." (row 13).
  6. Pills enabled for a held OR selected note; with neither, the "pick a note first" copy; ready
     style (row 9).
  7. Cyclops arc and bottom band always drawn as targets on the standard pan (row 11).
  8. Pin ring on pinned inner and bottom notes (row 23).
  9. Place, add and move status copy as in v4 (row 24).
  10. If OD-V1 picks the alternative: a rim or cyclops-to-ding swap when legal.
- Acceptance (observable):
  - Holding nothing, a tap on "+ Bottom" shows "Pick a note below, or on the pan, first."
  - Select A3 and tap "+ Bottom": A3 is on the bottom ring and the rim count drops by 1. One Undo
    restores it byte-equal.
  - A fresh Kurd 10 shows the cyclops arc and bottom band with 0 notes. A held G5 tapped on the arc
    places it at the 5-degree angle under the pointer, with a pin ring, and the status reads
    "... It stays there."
  - During a drag, `.editor-landing` is visible at the `editorHitAt` target; the source note carries a
    `lift` class.
  - Dragging a placed note off the pan (not on the trash) restores the state and shows the snap-back
    copy.
  - Dragging from the tray does not show the trash.
  - Dropping the ding on the trash refuses with the copy; the state is unchanged.
  - Parity: records and share links from these edits equal the same edits through the model
    primitives (U2a fixtures).
- e2e (mouse + CDP touch):
  - "pill moves a selected note", "pill without a note asks to pick"
  - "empty cyclops arc accepts a first note"
  - "tap select then cross-zone spot moves"
  - "drag shows landing ring", "drag off pan snaps back with copy", "trash only for placed notes"
  - "ding to trash refused", "pin ring on pinned note"
- Mutants:
  - pill enabled on selection
  - always-on zone targets
  - snap-back vs remove copy branch
  - ding-trash refusal
  - pin ring only when pinned
- Split clause: if over size, U2f-2 takes items 5-9 (tap and pill parity). U2f-1 ships drag as it is
  under review now, plus items 1-4.

### U2e: extend

- Planned items unchanged: Neotone, palette chip, mirror/anchor.
- Adds:
  - octave chip subscripts (row 4);
  - direct octave buttons from `editorOctaveRange()`, replacing the stepper; "Octave" kept as the
    visible group label (row 5);
  - flats toggle moved into the octave row (row 6);
  - default spelling per OD-V2;
  - scale name as the title (row 30);
  - empty Neotone field and mutant slots drawn as targets, if not already in U2f (row 25).
- Acceptance:
  - At 375x667, the octave row shows the flats chip, octave buttons for the engine range and the
    palette chip, with no horizontal or vertical scroll.
  - Tapping octave 3 then G gives held "G3"; that is one tap fewer than the stepper path.
  - Chips read "G3".
  - Each octave change is one Undo step (as today).
  - The phone fit check is green in English.
- e2e: "octave buttons pick directly", "chips show octave", "spelling follows the scale" (OD-V2),
  plus the planned palette 0/9 and Neotone e2e.
- Mutants: octave range bounds (min and max button present), spelling default branch.

### U2g, U2h, U2i, U2j

- Unchanged. U2g already covers row 31 (arrow nudge), Esc and the Cmd-Z keys.

### No new lane

## 5. Ordering

1. U2f: finish the current review, then the extension (or U2f-1 then U2f-2).
2. U2e.
3. U2g.
4. Owner phone check on qa-harness: the UX rows of section 2 are the script.
5. U2h, U2i, U2j.

OD-V1 and OD-V2 must be answered before U2f item 10 and U2e respectively. The AFK defaults are the
recommended options.

## 6. Risks

- Cross-zone move by tap or pill may hit AD-U2c-1 and the engine refusals more often than in v4. The
  copy must explain each refusal (row 13).
- Always-on zone targets can steal taps meant for rim notes. Keep D22: the drawn circle is hit first,
  with a test.
- The U2f diff base looks different from cffc731a (unrelated deletions). Verify the branch lineage
  before review, or the merge could drop `tests/sync.test.js`.
- Octave buttons for a wide engine range may not fit at 375px; the fit check gates this.

## 7. Verification

- Automated:
  - every lane's named e2e plus `node --test tests/`
  - `python3 tools/validate.py`, `python3 tools/inline_engine.py --check`
  - the mutation gate
  - CI `validate` at the verified head SHA is the evidence
- Independent reviewer subagent at that SHA per lane. Its brief quotes the section 2 rows the lane
  owns.
- Owner phone check on the qa-harness preview at 375x667 and on desktop:
  1. Hold a note and place it on rim, cyclops and bottom by tap and by drag.
  2. Move a cyclops and a bottom note by drag.
  3. Move a rim note to the bottom by tap and by pill.
  4. Swap two notes.
  5. Ding swap and ding replace.
  6. Remove by trash, by tray and by button.
  7. Octave and flats.
  8. Palette.
  9. Undo and Redo of each.

## 8. Continuation point

next: answer OD-V1, OD-V2, OD-V3 (AFK default = the recommended options). Then brief the U2f lane with
section 4's U2f additions on its current head 658db05d, after confirming its base lineage.

STOP: plan only. No code, no commits, no Linear writes from this file's author.

## Review

Independent eng + design review, 2026-11-06. Evidence: v4 mock source, `git show cffc731a:index.html`,
`gh pr view 920` (base `main`, head 658db05d, OPEN).

Spot-checked rows 9, 12, 13, 14, 15, 17, 19, 24 against v4 (`addToZone`, `tapNote`, `put`,
`removeNote`, pointerup snap-back, `swapSeats`) and cffc731a (`editorRenderAreas`
`b.disabled = !holding`, `editorSelectTap`, `editorPlaceHeld`, `etarget`). All eight match the table.

- **R1 (medium) OD-V1 alternative is vacuous.** Under the engine rule the current ding is already
  lower than every rim and cyclops note, so a rim or cyclops note dropped on the ding can never be
  lower than "every other rim and cyclops note" once the old ding takes its seat. The alternative
  would always refuse and reads as a real middle option. Fix: say so in OD-V1 and present only
  "keep AD-U2c-1" vs "change the engine rule (not recommended)"; drop U2f item 10.
- **R2 (medium) Row 11 / item 7 drops v4's zone-select tap.** v4's pan click with nothing held
  selects an empty cyclops or bottom zone (`pickedZone`, "Cyclops selected.") for Reset spacing.
  Built `editorSelectTap` sets `s.zone` only from a `spot` hit, and empty rings yield no spot unless
  held. Item 7 draws the targets but no acceptance says tapping them with nothing held selects the
  zone. Fix: add to item 7 and acceptance: "nothing held, tap the empty cyclops arc: status
  'Cyclops selected.' and Reset spacing scopes to it"; add an e2e.
- **R3 (low) Base-risk wording is wrong.** `git diff --diff-filter=D 9815fa6 658db05d` is empty;
  the deletions (`tests/sync.test.js`, `src/engine/sync.js`, sync mutants, two plan docs) are files
  that exist only on dev lineage (cffc731a is a dev-sync + "Preview only, never merge" commit). PR
  #920 targets `main` and a 3-way merge of D into dev keeps them. The lineage is correct per the
  "lanes stack on main" rule. Fix: reword the section 1 caution and the section 6 risk to "diff
  against the merge base, not cffc731a"; keep the check that D is not CONFLICTING.
- **R4 (low) U2f item 5 acceptance lacks the picked copy and a refusal case.** Fix: add "tap A3:
  status '{name} picked. ...'" and "move the last rim note to the bottom: refused with the min copy,
  state unchanged".
- **R5 (low) i18n step not named per lane.** Items 2, 4, 5, 6, 9 add copy. Fix: acceptance line per
  lane: keys in every `data/i18n/*.json`, `sync_i18n.py`, audit, phone fit check (CLAUDE.md).
- **R6 (low) Lanes to dev only not restated.** Fix: section 5 says each lane merges to dev only;
  main PRs stay held.

Ordering, acceptance and e2e per lane are otherwise observable and sound; OD-V2 and OD-V3 are framed
fairly. No constraint violation (caps, share format, deck data, geometry, "scale" text untouched).

Verdict: **READY** (no blocker or high finding; fold R1-R2 in before briefing U2f).

## Review dispositions (integrator, 2026-11-07)
- R1 fixed: OD-V1 reduced to two options: keep AD-U2c-1 (recommended), or change the engine rule (not recommended). The "legal rim/cyclops swap" alternative is dropped (it can never hold), and so is U2f item 10.
- R2 fixed: item 7 acceptance adds the following. With nothing held, tapping an empty cyclops/bottom zone selects it (status "Cyclops selected." / bottom equivalent). Reset spacing then scopes to that zone. e2e at 375x667.
- R3 fixed: the #920 caution is reworded. Diff against the merge base, not cffc731a (a preview-only commit on the dev lineage). Keep the check that the dev PR is not CONFLICTING.
- R4 fixed: item 5 acceptance adds the "picked" status copy, plus a refusal case: moving the last rim note out is refused with the minimum copy.
- R5 fixed: every lane that adds copy (items 2, 4, 5, 6, 9) ends with the i18n step: keys in every data/i18n/*.json, sync_i18n.py, the audit, and the phone fit check.
- R6 fixed: lanes merge to dev only. Main PRs stay held until the owner says merge.

Readiness: READY (independent review, no open blocker/high). Open owner decisions: OD-V1, OD-V2, OD-V3. Until they are answered, lanes proceed on the recommended options as AFK routine reversible defaults.
- Owner 2026-11-07: OD-V1 = keep engine rule. OD-V2: owner noted "V4 supports both sharp and flat". Both v4 and the build keep the sharps/flats toggle, so only the starting spelling is open. Proceeding with "follow the scale, flats when it has neither", toggle kept (U2e).

## Subplan S-RESPELL: tray spelling and the engine (owner 2026-11-07)

Goal: pin down by test that the spelling a note is added with is the spelling the cards show, and make the tray default to the scale's own spelling so a scale never holds the same pitch under two names by accident.

Verified (read-only, 2026-11-07): the engine does not respell.
- `spellingOf` and `spellingOfPc` in src/engine/select.js take a chord root's name from the seed field's own spelling ("a pan written with F reads F and never E#").
- `spellingOfPc` returns the first field with a matching pitch class. A scale mixing A# and Bb therefore names the chords on that pitch from whichever field comes first.
- `identitySeed` in src/engine/core.js hashes the spelled seed, so a respelled note gives a different deck id. That is existing behaviour, and it is not changed here.

Non-goals:
- No engine change.
- No respelling of existing saved scales, deck data or share links.
- No change to the sharps/flats toggle (v4 and the build both keep it).

Decision (owner-recorded): tray default = follow the scale's spelling; flats when the scale has neither sharps nor flats; the toggle overrides.

Phases (all in lane U2e, which owns the tray; no new lane):
1. Tests first.
   - Engine test (tests/ engine suite): a seed holding Bb names a chord rooted on that field "Bb...", never "A#...".
   - App e2e at 375x667:
     - D Kurd (has Bb): the tray shows flats on entry, adding that pitch inserts "Bb", and a card name uses Bb.
     - A scale written with sharps (pick one from data/decks.json that has a #): the tray shows sharps on entry.
     - A scale with no accidentals: the tray shows flats.
     - After the toggle is flipped, an added note uses the toggled spelling.
2. Implement the default in the tray render (the U2e tray function; find it by name, not by line).
3. Add one mutant that forces the tray default to sharps; the e2e must kill it.
4. i18n step: only if any copy changes (none expected); otherwise record "no copy change".

Acceptance: the tests above pass in CI's validate run at the lane's exact head SHA; the mutant is killed; the independent reviewer returns PASS or PASS_WITH_NITS.

Risks:
- A scale mixing both spellings: the default follows the first accidental in the seed, and that is tested.
- Ids: unaffected, since the default changes only notes added afterwards.

Recovery: revert the U2e commit; nothing is persisted differently.

Continuation point: brief this subplan into U2e after U2f merges to dev. Stop: U2e on dev plus the preview refreshed for the owner's phone check.

## Review S-RESPELL

Verdict: READY (fold R1-R3 into the U2e brief).

Verified claims: all three hold. `spellingOf` returns the field's own spelling (`record[0]`); `spellingOfPc` walks fields in numeric id order and returns the first pc match; `identitySeed` concatenates spelled names, which feed the `custom:` FNV hash, so a respelling changes the id.

- R1 medium: "first accidental in the seed" has no defined order. Seed text order, field id order (ding 0, then top, then bottom, which is what `spellingOfPc` uses) and a sharps/flats majority can give different answers. Fix: define it as field id order, ding included, bottom included. That matches the engine's own tie-break.
- R2 medium: Phase 1 has no mixed-spelling test, yet Risks says "that is tested". Add an e2e (or a unit test on the tray default helper) on a custom seed with Bb on the ding/top and a later C#. The tray must show flats.
- R3 low: the ding and bottom notes are not named. Say that they count toward the default, and that the bottom row of the tray uses the same default.
- R4 low: the e2e for a scale with sharps is feasible. `hijaz` (C# HIJAZ 9) uses only C#, F#, G#. `kurd` uses only Bb; `pygmy` uses only flats; the Amaras use none.
- R5 low: "the tray shows flats on entry" needs a named observable: the toggle's pressed state or the label on a black-key button. Name the selector in the brief so the mutant kill is unambiguous.
- R6 low: the engine test (Bb seed names Bb) passes on today's code. It pins behaviour and is not red-first. That is acceptable, but the record should say so.
- R7 low: the plan does not say whether the toggle state survives a reload or a scale switch. State that the default is recomputed on each tray entry.

Owner requirements: no engine or deck-data change, ids untouched, share links untouched, no saved-scale rewrite, no copy change. All are satisfied as written. "Follow the scale's spelling" is a sound default, because it keeps the cards consistent with `spellingOfPc`.

### S-RESPELL dispositions (integrator)
- R1 fixed: "first accidental" means field id order (ding 0, then rim, cyclops, bottom), the same order spellingOfPc uses.
- R2 fixed: Phase 1 adds an e2e. A seed with Bb before a later C# opens the tray in flats.
- R3 fixed: the ding and the bottom notes count toward the default, and the tray's bottom row uses the same default.
- R4: e2e scales are kurd (flats), hijaz (sharps) and an Amara (no accidentals, so flats).
- R5 fixed: the tests and the mutant assert the black-key button label (e.g. "Bb" vs "A#") plus the toggle's aria-pressed.
- R6 noted: the engine test pins existing behaviour; it is not a fail-first test.
- R7 fixed: the default is recomputed each time the tray opens for a scale, and the toggle is not persisted.
Verdict: READY (independent review, no blocker/high).

## Subplan OQA: owner QA lane (TRI-59, plan only, 2026-11-07)

Closes the eight owner-QA gaps no lane owns yet. Mock v5 is byte-identical to v4, so section 2 stands.
Owner decisions override the mock. Sources: "Owner QA, qa-harness 08545d88", "Review #921" and
"Review #920" in `docs/plans/2026-11-06-scale-editor-u2-split.md`; that file's section 2 standing rules
apply to both lanes unchanged.

### OQA.0 Code baseline (verified)

- Read at the tip of local `claude/scale-editor-u2f-2` = 51c7bd38. Every function named below exists
  there (checked by `git show 51c7bd38:index.html`).
- The #920 empty-ring fix is merged: 064c9454 ("landing ring over an empty cyclops or bottom ring uses
  the orbit fallbacks", adds `editorOrbit`, `editorNoteReach`, used by `editorWithOverlay` and
  `editorMarkDrop`) is on `claude/scale-editor-u2f`, and 51c7bd38 merges it into u2f-2.
  `git log claude/scale-editor-u2f-2..claude/scale-editor-u2f` is empty.
- Gap 8 dedupe against 064c9454: it closes only the #920 BLOCKER. #920 nits 1, 4 and 6 and the BAD_NOTE
  copy are untouched by it, so all four stay in OQA-B. Nits 2 and 3 fold into gap 6 (OQA-A); nit 5 stays
  with U2e.
- Hit path today: `editorHitAt(solved, pt, holding)` returns a drawn-circle hit first (D22), then, only
  when `!holding`, a wide `EDITOR_HIT_AREA` (0.43) hit for cyclops/bottom, then falls to
  `HPE.layout.snapTarget`, which biases to the rim. `editorDropTarget` calls it with `holding = true`,
  `editorSelectTap` with `false` (#921 N2). This is the cause of cyclops drops landing on the rim.
- Trash today: `editorTrashNode` builds `#editor-trash`; `editorDragLift` unhides it, `editorDragMove`
  toggles `.on`, `editorDropTarget` returns `{kind:"trash"}`, `editorDragEnd` hides it and writes
  `editor.say.went_back` ("Drop on the trash to remove it"). `editor.dragging`, `editor.trash`,
  `editor.trash_aria` also name the trash.
- Pills: `editorRenderAreas` writes `editor.pill.{rim,inner,bottom}` ("+ Rim {n} of {max}") and
  `editor.pill_aria.*`. Status Undo: `editorRender` appends `#editor-notice-undo` in the status line
  next to the toolbar `#editor-undo`.
- Layout: one `@media (min-width:900px)` block sets the two-column grid for `#scale-sheet.onepanel #editor`.
- Drawn bubbles come from the engine `pan()` markup (radius `geom.r_note` / `r_bnote`); the editor's
  `.ehit` overlay circles are transparent hit shapes.

### OQA.1 Goal

Gaps 1-8 below are closed on the standard pan, shipped through dev first, with main held.

### OQA.2 Non-goals

- Any change to `data/decks.json`, verified layouts, CARD-SPEC geometry, `src/engine/*` or the engine
  region, share/record formats, caps 12/6/12, `HPE.pdfcards`, print, card output.
- Neotone zone logic: U2e owns Neotone. OQA-A changes zone-first hit, zone highlight and the
  smaller-bubble factor on the standard pan only; Neotone keeps today's `editorHitAt` path and
  draws no zone highlight. The one Neotone touch is drag-off removal (OQA.4 D-OQA-6).
- U2g keyboard work, U2h flag flip, translation of strings other than `editor.say.*` (Lane I).
- Visual restyle beyond the named items.

### OQA.3 Decisions (source)

| id | Decision | Source |
|---|---|---|
| D-OQA-1 | Pill line 1 "Add to rim" / "Add to cyclops" / "Add to bottom"; line 2 "{n} of {max}"; full: "Rim full" / "Cyclops full" / "Bottom full"; aria "Add the held note to the rim, {n} of {max} used". Replaces `editor.pill.{rim,inner,bottom}`; closes #921 N6. | owner |
| D-OQA-2 | Editor-only drawn and hit radius factor: rim 0.85, cyclops 0.75, bottom 0.85. **owner may adjust at device check.** | AFK (critique fix 6) |
| D-OQA-3 | Drag a pan note off the pan removes it, followed by an Undo toast; a tray drag released off the pan cancels; ghost shows "Release to remove" with `.remove` class (red/faded) past the margin; `#editor-trash` and the trash copy retire. | owner |
| D-OQA-4 | Two columns only at `(min-width:900px) and (orientation:landscape)`; portrait stacks like the phone; landscape control stack vertically centred against the pan; pan = min(column width, viewport height minus header). | owner |
| D-OQA-5 | One visible Undo control per state; Reset spacing on one line; U1/U2 labels clear the pin ring and shell outline. | owner |
| D-OQA-6 | Off-pan boundary is computed in SVG pan units from `editorPanPoint(e)` (which maps client to viewBox through the SVG matrix), not from the client rect: off when the point's radius exceeds the outer drawn extent (bottom orbit + bottom reach via `editorOrbit`/`editorNoteReach`, or the rim shell edge when there is no bottom band) + margin 0.08. Same rule on Neotone, using its viewBox extent, since trash retirement must not leave Neotone without drag removal. | AFK (feasibility item 1) |
| D-OQA-7 | Drag-off of the ding: refuse with `editor.say.ding_required` (no trash wording), note snaps back. Drag-off of the last rim note: refuse with `editor.say.rim_min`, snaps back. Ghost shows the refusal state (`.refuse`), not "Release to remove". | owner (gap 3) + AFK on the ghost state |
| D-OQA-8 | The Undo toast is the status line with its inline Undo chip (`#editor-notice-undo`). While that chip is shown, the toolbar `#editor-undo` is `visibility:hidden` (keeps layout, no jump); otherwise the toolbar Undo is the one control. Redo unaffected. | AFK (gap 5 vs gap 3) |
| D-OQA-9 | Zone-first: on the standard pan, after the D22 drawn-circle hit (with D-OQA-2 radii), the zone is picked by radius: cyclops below the midpoint of cyclops orbit and rim orbit (using `editorOrbit` for an empty ring); rim from there to the midpoint of rim orbit and bottom orbit; bottom from there to the off-pan boundary. The seat inside the zone comes from `HPE.layout.snapTarget` restricted to that zone (pass occupancy of that zone only and keep the angle), or the zone's next free seat when snapTarget returns another zone. Tap (`editorSelectTap`) and drop (`editorDropTarget`) use the same function, closing #921 N2. | owner (gap 6) |
| D-OQA-10 | During a drag the zone under the pointer gets `.ezone.on` (also when the zone has notes); a zone at its cap gets `.ezone.full` (dashed) with a "Full" label (`editor.zone_full`). | owner |
| D-OQA-11 | N3: ding selected + spot tap says `editor.say.ding_stays` ("The ding stays put. Tap another note to swap with it."). N4: pill tap on the selection's own ring says `editor.say.same_zone` ("{name} is already on the {zone}."). N5: full pill with nothing held says `editor.say.zone_is_full` ("The {zone} is full."). | AFK copy, owner-decided behaviour |

### OQA.4 Assumptions

- A1 (verified): the #920 fix is in the u2f-2 tip 51c7bd38. The prerequisite is still recorded:
  OQA lanes start from the u2f-2 tip that contains the #920 fix (064c9454 or later); if #921 gets more
  commits first, base on that newer tip.
- A2 (AFK): the drawn-radius change is made outside the engine region, in `editorWithOverlay`, either by
  a CSS `transform-box:fill-box; transform:scale(f)` on each note's drawn group or by rewriting the
  note circle `r` in the markup string. The lane picks whichever the `pan()` markup supports without
  touching the engine, and records which in its report. Label text inside the bubble scales with it in
  the editor only; the print label floor (`HPE.layout.LABEL_FLOOR_PT`, `editor.crowded`) reads engine
  geometry and is unchanged, so the crowded refusal fires exactly as today.
- A3 (AFK): D22 keeps working with smaller bubbles because `editorHitAt`'s first test uses the scaled
  drawn radius, so "the drawn circle is hit first" still holds for what is drawn. The 0.43 wide areas
  for cyclops/bottom taps are replaced by zone-first (D-OQA-9); no test may depend on 0.43 afterwards.
- A4 (AFK): margin 0.08 pan units (about one third of a rim bubble) for off-pan. Owner may adjust.
- A5 (verified): `DRAG_ON_TOUCH = true`; touch scroll vs drag is decided by `editorDragKind` before
  `editorDragLift`, so a vertical touch scroll that never lifts never reaches the off-pan rule.
- A6 (AFK): in portrait (stacked) the pan is sized min(column width, viewport height minus header minus
  the control stack's height), per owner item 6; the critique's min(column width, vh - header) rule is
  applied to landscape.
- A7 (verified): 8 tables in `data/i18n/` (de, en, es, fr, it, ja, zh-Hans, zh-Hant).

### OQA.5 Why this is the smallest approach

Two lanes, both editing existing editor functions in `index.html` and the existing editor test files;
no new files beyond mutants, no engine or data change. Retiring the trash removes code (`editorTrashNode`,
its CSS, two keys) rather than adding a target. Zone-first replaces two hit paths with one.

### OQA.6 Lanes, ownership and sequence

| Lane | Owns | Gaps |
|---|---|---|
| OQA-A | `index.html` editor app code and editor CSS (outside generated regions), `tests/editor_e2e.test.js`, `tests/editor_shell.test.js`, `tests/editor_model.test.js`, the `editor.*` rows in all 8 `data/i18n/*.json`, the I18N region via `sync_i18n.py`, new `tests/mutants/oqa_a_*.patch`, context refresh of existing mutants its edits touch, README mutant count, FLOORS rows for its files | 1-7 |
| OQA-B | the same `index.html` editor functions it names, `tests/editor_e2e.test.js`, `editor.say.*`/BAD_NOTE-copy rows in the 8 tables if copy changes, new `tests/mutants/oqa_b_*.patch` | 8 |

Parallel: no. Both edit `editorDragLift`/`editorDragEnd` in `index.html` and the same e2e file. Sequence:
OQA-A first; OQA-B branches from OQA-A's verified head (lane branches stack on the previous lane head,
not on dev). OQA-B's brief may be written while OQA-A runs.

Base: `claude/scale-editor-u2f-2` tip containing the #920 fix (A1). Per lane: PR M to `main` (held) and
PR D to `dev` from the same head.

### OQA.7 Lane OQA-A (gaps 1-7)

Prereqs: A1 base; OD answers of this subplan stand as AFK defaults; CHROME_BIN available locally for
single e2e and the real-font fit run.

Deliverable and observable acceptance:

1. Pills (gap 1). `editorRenderAreas` renders each `#editor-pill-<ring>` as two spans
   (`.pill-act` = `editor.pill.add_<ring>`, `.pill-count` = `editor.pill.count`), or one span
   `editor.pill.full_<ring>` when n >= cap; aria-label = `editor.pill_aria.<ring>` (new copy with
   "used"). `white-space:nowrap` per line. At 375x667 and 820x1180 (en): text "Add to rim" / "9 of 12",
   full rim "Rim full", each line one line box (span height <= 1.3 x line-height). Old
   `editor.pill.{rim,inner,bottom}` keys deleted from all 8 tables.
2. Bubbles (gap 2). On the standard pan, each drawn rim note circle's rendered r = 0.85 x `geom.r_note`
   x 100 (+-0.5), cyclops 0.75 x, bottom 0.85 x `r_bnote`; the `.ehit` drawn hit radius matches; card
   view, print and `HPE.pdfcards` output byte-identical to base (existing card/print tests unchanged).
3. Drag off the pan (gap 3 + D-OQA-6/7/8). Past the boundary the ghost has class `remove` and text
   includes `editor.release_remove` ("Release to remove"). Release removes the note (one history step)
   and the status reads `editor.say.removed` with `#editor-notice-undo` visible; clicking it restores
   the note. Tray drag released off pan: no history step, no status message. Ding or last rim note:
   ghost class `refuse`, release leaves the model unchanged and shows the refusal copy.
   `#editor-trash` absent from the DOM; keys `editor.trash`, `editor.trash_aria` deleted;
   `editor.say.went_back` = "{name} went back."; `editor.dragging` = "Dragging {name}: drop on a spot or
   a note, or off the pan to remove it." No visible string in any table contains "trash".
4. Tablet (gap 4). Media query becomes `(min-width:900px) and (orientation:landscape)`; landscape
   `#editor` body min-height = 100vh minus header, control stack one flex column with
   `align-self:center`. Numeric, by `getBoundingClientRect` of `.editor-panbox svg` (pan) and the
   control stack, at each viewport:
   - 820x1180, 1024x1366 (portrait): controls top >= pan bottom; pan size within 4px of
     min(column width, vh - header h - control stack h) (A6); no horizontal scroll
     (`scrollWidth <= clientWidth`).
   - 1180x820, 1366x1024, 1440x960 (landscape): |controls centre y - pan centre y| <= 8px; pan size
     within 4px of min(pan column width, vh - header h); no horizontal scroll.
5. Leftovers (gap 5). In every status state (idle, holding, said-with-undo, notice, error) exactly one
   visible element with text `editor.undo` (offsetParent non-null and visibility visible). `#editor-reset`
   is one line box at 375, 820 and 1440 widths (`nowrap`). U1/U2 bottom labels: each label's bbox does
   not intersect its `.epin` ring bbox or the shell outline path bbox at 375x667 and 1440x960 with a
   pinned bottom note.
6. Zone-first (gap 6, D-OQA-9/10). One function (e.g. `editorZoneAt`) used by both `editorSelectTap`
   and `editorDropTarget` on the standard pan. Drag over a point at radius just inside the cyclops/rim
   midpoint lands on cyclops (landing ring on the inner orbit) even with an empty cyclops; just outside
   lands on rim. During drag the hovered zone element has `.ezone.on`, also when occupied; at cap it has
   `.ezone.full` and shows "Full".
7. #921 nits (gap 7). N1: `s.zone` is null after `editorDragLift` and after a pan-type switch in
   `editorDo`/`editorPanType`; Reset acts on the new ring. N3-N5 copy per D-OQA-11 instead of a silent
   deselect. N7: tap path and drag path from the same start produce deep-equal models. N8: the six
   `editor.say.*` keys (and the new ones) translated in the 7 non-English tables.

Named tests (TDD: these land in the first commit, red):

- `tests/editor_e2e.test.js`, mouse and CDP touch (`Input.dispatchTouchEvent`) each:
  `OQA pill copy two lines and full`, `OQA bubbles 0.85 rim 0.75 cyclops`, `OQA drag off removes with
  undo toast`, `OQA tray drag off cancels`, `OQA ding drag off refuses`, `OQA last rim drag off
  refuses`, `OQA release to remove ghost`, `OQA no trash node`, `OQA tablet portrait stacks` (820x1180,
  1024x1366), `OQA tablet landscape centred` (1180x820, 1366x1024, 1440x960), `OQA one visible undo`,
  `OQA reset one line`, `OQA bottom labels clear pin ring`, `OQA cyclops drop near midpoint`,
  `OQA zone highlight occupied`, `OQA zone full dashed`, `OQA tap equals drag model` (N7),
  `OQA touch scroll does not remove` (vertical touch swipe on the pan never lifts).
- `tests/editor_shell.test.js`: `OQA zone split midpoint` (pure function over fixtures incl. empty
  cyclops), `OQA zone clear on lift and pan switch` (N1), `OQA N3 N4 N5 copy`, `OQA neotone untouched`
  (Neotone `editorHitAt` result equals base on a fixture grid).
- Timer-guarded checks use `waitElapsed` with main's ms, never sleep-to-waitFor (memory).

Mutants (one per branch, `tests/mutants/oqa_a_*.patch`, `# suite:` headers with `.` wildcards, no
`index` lines): `oqa_a_pill_full_dropped`, `oqa_a_pill_count_line_dropped`, `oqa_a_bubble_factor_one`,
`oqa_a_cyclops_factor_rim`, `oqa_a_offpan_never`, `oqa_a_offpan_margin_zero`, `oqa_a_tray_offpan_removes`,
`oqa_a_ding_offpan_removes`, `oqa_a_last_rim_offpan_removes`, `oqa_a_ghost_no_remove_class`,
`oqa_a_toolbar_undo_always_visible`, `oqa_a_grid_portrait`, `oqa_a_stack_not_centred`,
`oqa_a_reset_wraps`, `oqa_a_zone_split_rim_bias` (restores snapTarget fallback), `oqa_a_tap_wide_area`
(restores 0.43 for tap), `oqa_a_zone_highlight_empty_only`, `oqa_a_full_not_dashed`,
`oqa_a_zone_kept_on_lift`, `oqa_a_zone_kept_on_switch`, `oqa_a_ding_spot_silent`,
`oqa_a_own_ring_silent`, `oqa_a_full_pill_pick_first`, `oqa_a_neotone_zone_first`. Delete the trash
mutants together with the trash code and tests they alone killed; refresh context for every patch the
edits touch; `git apply --check` all `h_*` patches.

i18n step (OQA-A): new/changed keys `editor.pill.add_{rim,inner,bottom}`, `editor.pill.count`,
`editor.pill.full_{rim,inner,bottom}`, `editor.pill_aria.*`, `editor.release_remove`, `editor.zone_full`,
`editor.say.went_back`, `editor.dragging`, `editor.say.ding_stays`, `editor.say.same_zone`,
`editor.say.zone_is_full`; deleted `editor.pill.{rim,inner,bottom}`, `editor.trash`, `editor.trash_aria`.
Rows in all 8 `data/i18n/*.json` tables (translated for `editor.say.*` per N8, others English
placeholder unless translated), `python3 tools/sync_i18n.py`, the i18n audit (validate check 6), then
the fit check: the existing app fit tests in CI, plus a local real-font run with CHROME_BIN rendering
the longest pill line, longest full label and `editor.reset` per table at 375px and 820px (CI blocks
web fonts, so the local run is the real-font evidence; record widths in the lane report).

Verify: `node --test tests/`; `CHROME_BIN=... node --test --test-name-pattern 'OQA' tests/editor_e2e.test.js
tests/editor_shell.test.js`; `python3 tools/validate.py`; `python3 tools/inline_engine.py --check`;
`python3 tools/sync_i18n.py` then clean `git diff --exit-code`; `tests/mutation_check.sh` (or the CI
mutation job; never edit the worktree while it runs, it restores the tree); CI `validate` green at the
exact verified head SHA of PR M (`gh run list --commit <sha> --workflow validate.yml`).

### OQA.8 Lane OQA-B (gap 8)

Prereqs: OQA-A verified head (branch from it).

Deliverable and observable acceptance:

1. #920 nit 1: `editorDragLift` leaves no stale selection/held rings: after lift, `#editor-pan` has no
   `.pansel`/held ring element (re-render the selection layer or remove the rings in place).
2. #920 nit 4: the D8 scroll e2e asserts a measured scroll distance (`scrollTop` delta >= 40px, or the
   touch swipe's distance minus slop) and that no drag lifted.
3. #920 nit 6: the 50ms click-eat in `editorDragEnd` is replaced by eating exactly the next `click`
   from the same pointer (one-shot listener removed on the first click or the next `pointerdown`); the click the
   drop itself synthesises is eaten, and a later click on another control still fires. (Dropped from scope if OQA-A already rewrote it; lane checks first.)
4. BAD_NOTE copy: a refused angle or place never renders "90,, is not a note". Anchors:
   `editorSetAngle` and `editorPlace` (partial pins passed into `editorRefusal`) and `reasonText` in
   `editorDo`. Acceptance: the repro shows a single clean sentence naming the note or angle, no doubled
   comma, in en and one non-English table.

Named tests: `OQB lift clears rings` (mouse + touch), `OQB scroll measures distance` (touch),
`OQB click after drop eaten once`, `OQB click elsewhere after drop fires`, `OQB bad note copy clean`
(shell). Mutants: `oqa_b_lift_keeps_rings`, `oqa_b_eat_all_clicks`, `oqa_b_eat_none`,
`oqa_b_bad_note_partial_pin`. i18n step: only if a refusal string changes; then rows in all 8 tables,
`sync_i18n.py`, audit, fit check as OQA-A; otherwise state "no visible string changed" in the report.
Verify: same commands as OQA-A with `--test-name-pattern 'OQB'`.

### OQA.9 Verification

- Automated: each lane's named tests, `node --test tests/`, validate, inline check, mutation gate; CI
  `validate` at the exact head SHA of PR M is the evidence; a local green is only a smoke test.
- Independent reviewer: a fresh `swarm-reviewer` per lane at the verified head SHA, briefed with this
  subplan's lane section quoted verbatim, ownership, non-goals and the CI run id; read-and-report;
  FAIL needs a concrete scenario.
- Owner device check on the qa-harness preview after both lanes reach DEV: iPhone (375-wide), iPad
  portrait and landscape, Surface Pro 10 portrait and landscape. Script: pill wording and fit; bubble
  size (adjust D-OQA-2 if asked); drop on cyclops near the rim; zone highlight; drag a note off to
  remove, then Undo; ding and last rim off-pan refusals; tray drag off cancels; one Undo visible;
  Reset on one line; U1/U2 labels clear; tablet layouts.

### OQA.10 Gates (restated)

Dev first: PR D merges only on green full `validate` on PR M at the exact verified head, an addressed
independent review (PASS/PASS_WITH_NITS) at that SHA, and D not CONFLICTING; then check served DEV
(`docs/testing/browser.md`). PR M stays held until the owner says merge. CI runs only on PRs into main.
`Refs TRI-59`, never `Fixes`. Lanes return `pending-linear-writes`; only the integrator writes Linear.

### OQA.11 Risks and recovery

- Zone-first can move taps meant for an existing note into a zone: D22 first, test `OQA zone split
  midpoint` plus the existing D22 test.
- Off-pan removal by accident during a fast touch flick: margin + `editorDragKind` gate + Undo toast;
  `OQA touch scroll does not remove`.
- Smaller cyclops labels may be hard to read on phone: owner adjusts D-OQA-2 at the device check.
- Fit tests green in CI on fallback fonts while real fonts overflow: the local real-font run is required.
- Mutant drift from heavy edits in `editorDragEnd`/`editorRenderAreas`: refresh context, apply-check
  `h_*`.
- Recovery: a rejected lane is reverted on dev via a `claude/dev-revert-oqa-<a|b>` PR; if it later
  reaches main, unrevert on `claude/dev-unrevert-oqa-<a|b>` before the next main-to-dev sync.

### OQA.12 Rubric check (frozen rubric)

- No open blocker or high: yes (A2's mechanism choice is a lane-time pick, not a blocker).
- Every gap 1-8 maps to a lane item with observable acceptance and a named test: yes (OQA.7 items 1-7,
  OQA.8 items 1-4).
- No change to deck data, CARD-SPEC geometry, engine, share formats, caps: yes (non-goals; item 2
  byte-identical card/print).
- i18n step named per lane: yes.
- Dev-first and held-main gates restated: yes (OQA.10).
- Continuation point precise: yes (OQA.13).

Verdict: Ready.

### OQA.13 Continuation point

next: integrator runs `/plan-eng-review` on this subplan, then dispatches lane OQA-A in a fresh
worktree from `claude/scale-editor-u2f-2` at 51c7bd38 (or the newer tip that still contains 064c9454),
branch `claude/editor-oqa-a`, first commit = the red named tests. OQA-B dispatches from OQA-A's verified
head after OQA-A's PR D is on dev.

STOP: plan only. No code, commits or Linear writes from this section's author.

## Review OQA (independent eng + design, 2026-11-06)

Spot-check at 51c7bd38: `editorHitAt`, `editorDropTarget`, `editorTrashNode`, `editorRenderAreas`, `editorOrbit`, `editorNoteReach`, `editorPanPoint`, `editorDragKind` (const arrow), `DRAG_ON_TOUCH = true` all exist. Gaps 1-8 each map to an item with observable acceptance, named test and mutant. No deck/geometry/engine/share/caps change; dev-first + held main restated; OQA-A then OQA-B stacked is correct (shared `editorDragEnd` + e2e file).

- R-OQA-1 medium: pill strings (`editor.pill.*`, `release_remove`, `zone_full`) ship as English placeholders in 7 tables, a visible regression if the old pill keys were translated. Fix: translate every new visible key in all 8 tables, not only `editor.say.*`.
- R-OQA-2 medium: drag-off removal has no rule for `pointercancel` / release outside the window (phone pan near screen edge, OS gesture). Fix: pointercancel and lostpointercapture always cancel (snap back, no history step); add `OQA pointercancel never removes` + mutant.
- R-OQA-3 medium: A6 portrait pan size subtracts the control stack height, deviating from frozen critique fix 7 (min(column, vh - header)). Owner item 6 justifies it; fix: label A6 explicitly as an owner-sourced override of the critique rule so the reviewer does not FAIL it.
- R-OQA-4 low: D-OQA-6 applies drag-off to Neotone but no named test covers it. Fix: add `OQA neotone drag off removes` (e2e) + mutant `oqa_a_neotone_offpan_never`.
- R-OQA-5 low: D-OQA-8 hides toolbar Undo with `visibility:hidden`; if focus is on it when the chip appears, focus is lost. Fix: move focus to `#editor-notice-undo` in that case, or assert in `OQA one visible undo`.
- R-OQA-6 low: OQA-B nit 4 (scroll e2e) is test-only and has no mutant; fine, but say so so the reviewer does not flag a missing mutant.

AFK assumptions A2-A6, D-OQA-2/6/7/8/11: routine and reversible (constants, copy, CSS); none needs an owner decision before dispatch. Design: drag-off removal + Undo toast, zone-first by radius midpoints, one-Undo rule and landscape-only two-column are sound.

Verdict: READY (no blocker/high; apply R-OQA-1..3 in the lane brief).
