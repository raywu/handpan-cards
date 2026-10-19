# Plan: dual-path scale input (four fields by default, the line kept)

Status: draft for `/plan-eng-review`, owner answers folded in (2026-10-18, section 7). Base: `claude/dual-input-base` e722c96 (revision 2026-10-19; this plan was first written against origin/dev b153406). Chosen design: candidate C6, which is the owner's pick C5 with the "Line: ..." caption dropped (owner decision Q7; `D/rubric.md`, `D/mocks/C6.html`, `D/mocks/measure-C6.json`, `D/pub/compare.html.new`). "Candidate C5" and "candidate C6" name designs; "#374's C5" and "#374's C6" name #374's label and placeholder copy, an unrelated numbering.

D = the scratchpad folder `dual-input`; H = the scratchpad folder `import-helper` (#374, `H/subplan-v13.md`).

## Revision 2026-10-19

Amended for the new base `claude/dual-input-base` e722c96: dev minus the DEV overlay, that is lanes E #377, T #379 and C #381 merged on top of l1b 5a5f7f0. The owner decisions of 2026-10-19 are binding. Changes:
- R1. Base and branch points. H1 branches from `claude/dual-input-base` (e722c96); each later lane branches from the previous lane's head (Status line, section 4).
- R2. Counts re-taken from the files at e722c96, where README:77 is 1164 and FLOORS are app 633, e2e 336, import 84. After H1: README:77 1182, import 102. After H2a: 1149, app 607, e2e 331. After H2b': 1180, app 629, e2e 340 (sections 4 and 8). All arithmetic; CI governs.
- R3. H1 takes lane T's nit N1: one engine test and one mutant on DING_NOT_LOWEST's `<`. H1 now adds 18 tests and 18 `ih_e_*` mutants. Compose still applies to `importer.js` at e722c96 with no conflict (section 4, H1).
- R4. H2a's removal list, acceptance grep and Verify are re-taken at e722c96 and written out in full in section 4. They now also remove lane E/T/C's UI work: the copy rendering, CONFIRM ticks and ding-picker flag copy, 26 app tests, 5 e2e tests and 33 app mutants (18 `ib_*`, 12 `ic_*`, 3 `ix_*`). The importer engine stays: `src/engine/importer.js`, its tests, the 57 `i_*` and the 16 engine `ix_*` mutants.
- R5. Lane C's copy nits are retired with the UI copy H2a deletes, not fixed: DUPLICATE_PITCH "B3, B3"; the CONFLICTING_DING comma join; NO_OCTAVE without octaves; CONFIRM lines with no action word.
- R6. The L1 DEV e2e of the paste UI is done (2026-10-19, PASS, at dev 2f51721), so Q10's dev-merge wait is satisfied (G-C, section 4, H0a, section 5, Q10).
- R7. Main merges of #370, #372, #377, #379 and #381 are held until dual input is DEV e2e validated and the owner says merge. Main merge order: #370, #372, #377, #379, #381, H1, H2a, H2b', H3' (G-F', section 5).
- R8. H0a syncs H2a onto dev, which also carries the lane E/T/C UI; taking H2a's side removes that UI from dev too (section 4, H0a).
- R9. H3' also retires the CLAUDE.md "Scale import" sentences that lanes E and C added citing deleted IM: and IC: tests (section 4, H3').
- R10. The import-fix plan's section 7 line 510 is ignored (owner, 2026-10-19).

Everything else is unchanged.

## 0. What this plan does to #374

This plan amends #374 (`H/subplan-v13.md`, v13). Where the two disagree, this plan wins.

**Survives unchanged.**
- Lane H1, engine `HPE.importer.compose` (#374 2.5 and its H1 lane): the 17 tests E1 to E17, the 17 `ih_e_*` mutants, its Verify block and its acceptance, word for word, plus N1 and the e722c96 counts (revision 2026-10-19, section 4).
- Lane H2a, removing the paste UI (#374 section 3 and its H2a lane): its order and non-goals. Its removal list, acceptance grep, Verify, FLOORS rows and README:77 are re-taken at e722c96 in section 4 (revision 2026-10-19).
- H0a, the dev sync that stands in for H2a's CONFLICTING PR D (it now also drops the lane E/T/C UI from dev; section 4).
- The owner copy M1 to M19 (#374 2.10), including M2 "Use letter names, like D A Bb.", M3 "BB is not a note: write B-flat as Bb.", and M10, M14 and M18 "<X> is lower than <P>: list low to high.".
- The bottom-octave rule (#374 2.5, E4, E16, E17): a guessed octave is shown in M16 and written explicit in the line.
- Owner answers Q1 (lowercase accepted, letters only, octave guessed and shown), Q3 (prefill from `#scale-box` when it parses), T2, T3 and rounds 3 and 4 (`H/owner-answers.md`).
- The verify-loop shape under `bash <<'VERIFY'`, the `# suite:` header rules and the gates G-A to G-E.

**Changes.**
- #374 2.7's message model is kept in a reduced form (section 2.5 here): STATE `editing`, settle-only RENDER R1 to R3, and ANNOUNCE A1 survive. `kbUp`, `revealed`, SC1 and SC3 do not carry over, because the fields sit on the sheet's own scroller, not in an overlay list. R4 (USE) and R5 (the USE note) become the GENERATE rule and the slot. Messages show in one slot in `#scale-guidance`, not under each field.
- #374's H2b ("app helper") is replaced by H2b' (dual input). None of its 63 `ih_*` app mutants or its IH-A and IH-E test titles carry over.
- #374's H3 docs lane becomes H3' (section 4).
- G-F (un-hide on prod) is replaced by G-F' (section 1): the main PR stays open; nothing ships hidden.

**Dropped.**
- The NEED HELP? overlay as the entry point: `#help-row`, `#help-open`, `#help-hint`, `#scale-helper`, USE THIS SCALE, `#helper-done`, the `{scaleHelper:true}` history entry, copy C1 to C4 and C7 to C15, and the 18 helper ids in `tools/sandbox.js`.
- H0b (the dev-sync un-hide of `#help-row`): there is no hidden row to un-hide.
- The IH-E13b to IH-E13g overlay scroll tests and real-phone checks R-1b, R-6 and R-7, which were written for overlay behaviour.

## 1. Goal, non-goals, standing gates

**Goal.** On the Add and Edit sheets, four note fields (DING, TOP RIM NOTES, TOP INNER NOTES, BOTTOM NOTES) are the default input and `#scale-box` the alternative. Each mirrors the other live through `compose` and `parseSeed`, and focusing one dims the other. This is proven by the DI: tests in `tests/app.test.js` and `tests/e2e.test.js` (section 4). At 320x568 and 380x780 with a 260px simulated keyboard, the focused field stays fully in view, and the pan shows at least 136px at 320 and 218px at 380 (candidate C6 measured on macOS Chrome; DI-E1 and DI-E2 assert floors of 130 and 212 so Linux CI fonts have 6px of margin).

**Non-goals.**
- No paste box, NEED HELP? overlay, URL reading, presets, solfege, audio, new font or new hue. The passive look's two tints, `#b3aa98` (input text) and `#4a4233` (dashed border), are the only colour values not already in dev's stylesheet; both are greys of the sheet's existing warm-grey family.
- No new analytics event. `scale_import` retires with H2a's removal of the paste UI, and "no event param is a string over 40 characters or names a custom: id" then runs with no import step (H2a's edit, unchanged here). Whether to track path usage is open question OQ-2.
- No change to the behaviour of `parseSeed`, `formatSeed`, `interpret` or `serialise`, or to the layout solver, deck data, diagram geometry, share link format (v5) or stored record format (v4).
- No layout options (anchor, mirror, mirror bottom, seats, palette) in the fields: they stay in the drawer and swatches.
- No change to GENERATE CARDS, SAVE or DELETE beyond the stale-line rule (section 2.3).
- No revert of L1's engine work: `src/engine/importer.js`, its region, `tests/import.test.js`, `tests/import_gold.test.js`, the 57 `i_*` mutants and the 16 engine `ix_*` mutants all stay.

**Standing gates.**
- G-A. Lanes merge to `dev` first. Main PRs stay open until the owner says merge (memory "Dev first, never merge to main").
- G-B. Main merge gate: the `validate` run conclusion is green at the verified head SHA (`gh run list --commit <sha> --workflow validate.yml`), and a fresh independent reviewer returns PASS or PASS_WITH_NITS at that SHA.
- G-C. Dev gate (CLAUDE.md "DEV environment", lane flow D2): PR D to `dev` merges when its head SHA has a green `validate` run on PR M, and D is not CONFLICTING. Q10's wait for the L1 DEV e2e of the paste UI is satisfied: it ran and passed on 2026-10-19 at dev 2f51721 (section 5).
- G-D. `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` are clean, and `python3 tools/validate.py` is green.
- G-E. The mutation gate is green. README:77 and the `tests/suite_health.py` FLOORS rows are set from the previous lane's CI artifacts (memory "FLOORS rows lag the CI count").
- G-F'. No main merge of #370, #372, #377, #379, #381, H1, H2a, H2b' or H3' (owner, 2026-10-19) before the section 6 DEV e2e passes, including the real-phone pass, AND the owner says merge. The paste-import row stays hidden on prod throughout: `#import-row` keeps `hidden` on main until H2a deletes it, and H2a reaches main only under G-F' (memory "Import hidden until DEV-proven"). The fields ship visible; they are held back by the open main PR, not by a hidden attribute (owner decision Q9).

## 2. Interaction spec (candidate C6)

### 2.1 Markup and order

Inside `.sheetbody`, after `#scale-name-row`:

```
div.scalestage                       (new, class only)
  #scale-plate-band                  (moved here from #scale-layout-zone)
    #scale-preview, #scale-drawer-status (unchanged)
  div.scalecol                       (new, class only)
    div#scale-fields role="group" aria-labelledby="scale-fields-head"
      p.sheetlabel#scale-fields-head   YOUR SCALE, NOTE BY NOTE
      4 x div.fieldrow: label#scale-<f>-label for=scale-<f>, input#scale-<f>
      p.sheethint#scale-fields-note    (passive caption, empty when active)
      p.sr-only#scale-fields-live      (aria-live="polite", visually hidden)
    div.fieldrow (today's #scale-box row, unchanged inside)
      + p.sheethint#scale-line-note     (passive caption, empty when active)
div#scale-layout-zone (now: #scale-layout-row and #scale-drawer only)
```

`f` is `ding`, `top`, `inner` or `bottom`. Each input is `type="text"` with `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"`, at 16px (the iOS auto-zoom floor that `applyKbOffset`'s zoom branch depends on), `enterkeyhint="next"` (BOTTOM: `"done"`), and `aria-describedby="scale-field-msg"`. Labels are #374's C5: DING; TOP RIM NOTES, LOW TO HIGH; TOP INNER NOTES (OPTIONAL); BOTTOM NOTES (OPTIONAL). Placeholders are #374's C6: `D3`; `A Bb C D E F G A`; `C5 D5`; `C3 Eb3` (owner decision Q3). `#scale-guidance` gains `p#scale-field-msg` before `#scale-msg`. The live region `p.sr-only#scale-fields-live` (`aria-live="polite"`) is the last child of `#scale-fields`, not a child of the surface or of `#scale-guidance`, so the surface's children are unchanged and the slot's children change only by `#scale-field-msg` (the orders pinned by the two SG: N-A2 tests named in H2b' Acceptance).

The ids the app looks up join `tools/sandbox.js` ELEMENT_IDS: `scale-fields`, `scale-ding`, `scale-top`, `scale-inner`, `scale-bottom`, `scale-ding-label`, `scale-top-label`, `scale-inner-label`, `scale-bottom-label`, `scale-field-msg`, `scale-fields-live`, `scale-fields-note` and `scale-line-note` (13). `scale-fields-head` and the two wrappers are markup-only, so SB-2 ("SB-2 every served id is in the markup and is looked up by the app") stays green without them.

The import row is gone (H2a), so no import control sits between the line and the plate.

### 2.2 States

One variable decides which path is active: `inputPath`, `"fields"` or `"line"`.
- Sheet open (Add and Edit): `"fields"`.
- `focus` on any of the four inputs: `"fields"`. `focus` on `#scale-box`: `"line"`.
- `input` on a field: `"fields"`; on `#scale-box`: `"line"`, unless the module flag `mirroring` is set. `mirroring` is true only around the app's own write and `input` dispatch on `#scale-box` (2.3), and is cleared in a `finally`.
- Focus writes `inputPath` and repaints the passive look. It rewrites neither path's text (DI-A10).

Two flags mark a passive path that could not follow:
- `lineStale`: the fields hold text that does not compose. `#scale-box` keeps its last good value.
- `fieldsStale`: the line holds text that does not parse. The fields keep their last good values.

Each flag is cleared by the next successful mirror in its direction, by clearing the active path, and on sheet open.

Passive look (`#scale-fields.passive` or `.fieldrow.passive` on the line row):
- The input text is `#b3aa98` on a transparent background, with a dashed `#4a4233` border, and labels are `#a79d8b`. The contrast numbers are in DI-E7, measured in Chrome.
- A stale passive path adds `text-decoration: line-through #e3b25c`.
- Passive captions:
  - `#scale-line-note`: "Follows the notes above. Tap to type the line instead." or, while stale, "Not updated: the notes above have a problem."
  - `#scale-fields-note`: "Follows the line below. Tap a field to type notes instead." or, while stale, "Not updated: the line below does not read as a scale yet."
- `#scale-parse` is hidden while the line is passive. While typing in the fields, the pan is the confirmation: with the keyboard up at both phone sizes the line row is below the fold (owner decision Q7 dropped the caption that showed it). When the fields have a problem, the slot names it, GENERATE is disabled and the pan is held; the line row, once scrolled to or tapped, shows its last good value struck through with "Not updated".
- A passive input stays focusable and editable. A tap on it is the switch.

### 2.3 Mirror rules

**Fields to line.** On every `input` of a field, run `r = HPE.importer.compose(values)` (H1).
- `r.empty` (all four blank): write `""` into `#scale-box` and clear `lineStale`.
- `r.ok`: when `#scale-box.value !== r.line`, set `mirroring`, write `r.line`, dispatch one `input` event, and clear `mirroring`. The parse line, pan, GENERATE and drawer state follow through today's `#scale-box` listener, exactly as typing the line would. While `mirroring` is set, the line-to-fields branch below does not run and `inputPath` stays `"fields"`, so the field typed in keeps its text as typed (lowercase or octaveless) and its caret does not move. Clear `lineStale`.
- Otherwise: leave `#scale-box` as it is, set `lineStale`, call `holdPanPreview()` (today's held pan), disable GENERATE CARDS, and clear the parse line.

A guessed bottom octave is explicit in `r.line` (`formatSeed` writes every octave). It shows in M16 in the slot, and in `#scale-box` itself.

**Line to fields.** On every user `input` of `#scale-box` (`mirroring` clear), today's listener runs first, unchanged.
- Blank: clear the four fields and `fieldsStale`.
- `parseSeed(text).ok`: write the four fields from the parsed `fields` by zone, in midi order, each note with its explicit octave (`D3`, `A3 Bb3 ...`), and clear `fieldsStale`.
- Otherwise: leave the fields as they are and set `fieldsStale`. The line's own refusal shows as today in `#scale-refusal`.

**Who wins on a switch.** Nothing is rewritten on a switch, so nothing is lost:
- The passive path holds the last value that mirrored.
- The first `input` in the newly active path overwrites the passive one.
- A stale passive path is overwritten the same way. Until then it shows its stale mark, so the user sees that the two disagree.

**GENERATE CARDS** reads `#scale-box`, as today. While `inputPath === "fields"` and `lineStale`, it stays disabled (DI-A12). While `inputPath === "line"`, today's rules apply unchanged; a stale field set does not block a line that parses.

**Round trips.**
- The fields express everything `formatSeed` writes. `formatSeed` writes notes only, and every option (palette, mirror, mirrorBottom, anchor, seats) is sheet state read by `sheetOptions()`, untouched by either path (DI-A13).
- Measured on the dev engine: `parseSeed` refuses a rim note below the ding ("A2 (D3) E3 ...", NO_DING) and a bottom after the bar or out of pitch order. Bottoms are written where their pitch falls, so their position carries no information beyond their pitch. Decomposing by zone and recomposing with `compose` is therefore lossless for every line that parses. H1's E3 proves this for the five built-ins: "IH: compose of each built-in's decomposed fields equals formatSeed of that deck, Pygmy included".
- What is not kept: the user's spelling of the line. Examples are legacy `D3/`, octaveless `(D) A C`, extra spaces and lowercase. The box keeps that spelling until a field edit rewrites the line canonically (DI-A21). Today's SAVE stores `formatSeed` of the parse either way, so the record is unchanged.

**Edit, share links and stored records.**
- Edit: today `resetSheetState(edit)` writes `formatSeed(edit.fields)` into `#scale-box`. H2b' then writes the four fields from the same `edit.fields` by zone, sets `inputPath = "fields"`, and leaves both flags clear (DI-A3).
- A share link (`#s=`) or stored record opens as a deck, not a sheet; its Edit is the Edit above.
- A seeded deck's Edit works the same way. Pygmy's bottoms land in BOTTOM NOTES with explicit octaves: `C3 Db3 Eb3 Bb3 Db4 Ab5`.

### 2.4 Keyboard and screen reader

- **Open.** BACK is focused, as today: `showSheet`'s "do not steal focus into the box" (no new keyboard on open).
- **Tab order.** BACK, then DECK NAME (Edit), then DING, TOP, INNER, BOTTOM, then `#scale-box`, then today's stops from the plate hit onward (DI-A20). The four inputs go into the `stops` array of the `#scale-sheet` keydown Tab listener, before `scaleBox`.
- **Enter.** Enter in DING, TOP or INNER moves focus to the next field; in BOTTOM it blurs (DI-A18). An `isComposing` Enter is ignored.
- **Labels.** A `mousedown` on a field label is `preventDefault()`ed and focuses its field, so a tap does not scroll-jump (#374 eng-review-v11 RC-1; DI-A19). Labels are bound through their ids (the sandbox has no `input.labels` and no element `querySelectorAll`).
- **Group and descriptions.** `#scale-fields` is a `role="group"` named by its heading. Each input is described by `#scale-field-msg`, so a shown message is read with the focused field.
- **Passive line.** `#scale-box` stays in the accessibility tree while passive, so a screen reader can reach the mirrored line by Tab (DI-A20). There is no visual caption of the line (owner decision Q7).
- **Announcements.** Settle-only, as #374 A1 (section 2.5).
- **Keyboard up.** While the keyboard is up (`kbup`) and the surface is under 420px tall (`side`), the sheet head (BACK and title) is hidden to give the pan 52px (owner decision Q1). Escape and the platform Back still close the sheet, and BACK returns when the keyboard closes. A hidden BACK has no client rects, so the Tab listener's `isStop` drops it and Tab cycles through the remaining stops. iOS Safari has no platform Back: there, Done on BOTTOM (or a tap outside the fields) closes the keyboard and BACK returns (P-7).
- **Settings trigger.** `#settings-trigger` paints over the open sheet on dev today, as seen in the mock screenshots built from dev. It is hidden while `#scale-sheet` is open (DI-E8; owner decision Q2).

### 2.5 Messages (reduced #374 2.7)

**State.**
- `editing`: the field being typed in, or `null`. Set by `input` on field f to f. Set to `null` by `blur` on any field and by sheet open.
- `shown`: field to `{text, kind}`, written only by `paintFields()`.

`r` is derived, never stored.

**Render, pure:** `renderFieldMessages(r, values, editing, shown)` returns `shown'`.
- R1 as #374: `msg(f) = r.errors[f] ?? (f === "bottom" ? r.info.bottom : null)`, eligible only while f's value is non-empty. M6 and M8 are never displayed.
- R2 (settled, `editing === null`): every eligible message, with its current text.
- R3 (editing): only entries already in `shown` whose field still has an eligible message of the same kind, with their old text. A kept entry whose text differs renders in the stale grey `#a79d8b`. Nothing joins while a field is typed in.
- While `inputPath === "line"`, `shown'` is empty. The line's refusal speaks for it.

**Display.** One slot, `#scale-field-msg` in `#scale-guidance`, shows the first entry of `shown'` in visual order, errors before the M16 info.
- The text is prefixed with the field's short name. Example: "TOP RIM NOTES: BB is not a note: write B-flat as Bb." (DI-A15)
- Error text is `#e3b25c` and info `#c4bcab`, at Nunito Sans 12px/1.5 (the slot's type).
- While the slot holds text, `#scale-msg` yields (`display:none`).
- A field whose entry in `shown'` is an error carries `aria-invalid="true"` and a `#E27005` border. Both are written from `shown'`, so they follow the settle-only rule: they never change while a field is typed in, and a fixed error clears them at the next settle.
- The slot is inside `#scale-guidance`, which is already outside the scroller and above GENERATE. That is why it was in view at both phone sizes with the keyboard up (section 3).

**Why one slot, not one message under each field (#374's design).** At 320x568 with the keyboard up, D's under-field message was out of view (top 117 to 135 against a 308px visual viewport, `mocks/measure-error.json` D-320). The slot was in view in every C variant at both sizes. The slot also needs no SC1/SC3 scroll machinery, which cost #374 rounds 8 to 13 (`H/regroup-v9-cause.md`).

**Slot height.** The slot shares #303's two-line reservation.
- A message joins the existing states. M12 (an engine reason) can run past two lines; it then grows by 18px a line, as state (b) does today.
- The "SG: N-A6 the scrollport does not resize ..." test enumerates the growth states. H2b' adds the field-message state to its enumeration rather than weakening it (risk K2).

**Announce (A1, kept).** After a settled render other than the open paint, the texts in `shown'` that are new or changed are joined and written to `#scale-fields-live`. The region is cleared at once and the text is written on a `setTimeout` 0 tick, which cancels any pending write. Renders while editing, and the open paint, write nothing (DI-A17).

**GENERATE rule in place of USE.** There is no USE button. GENERATE CARDS is the commit. It is disabled while the fields are active and stale, and otherwise follows today's `syncParseState`.

## 3. Layout spec (measured)

All numbers were measured in Chrome through `tests/helpers/cdp.js` with real fonts, on the candidate C6 mock (`D/mocks/C6.html`, which is `C5.html` with the caption removed; C5 was built from `wt/index.html` at b153406). Source: `D/mocks/measure-C6.json`, which holds the C6 entries of `tools/run_mocks.js`, `run_open.js`, `run_err.js` and `run_drawer.js`, run on 2026-10-18 in the same session as a C5 re-run that reproduced every C5 figure (`measure-kb-C5C6.json`, `measure-open-C5C6.json`, `measure-error-C5C6.json`, `drawer-C5C6.json`). The keyboard is the harness's 260px fake (visual viewport 308 at 320x568, 520 at 380x780).

**Scores (`D/rubric.md`, P K S A M Y T X N L).** Candidate C5: 8 10 9 8 8 7 7 8 8 8 (81). Candidate C6: 8 10 8 7 8 7 7 8 8 8 (79); S and A each lose a point because no copy of the line is visible while typing at phone sizes (Q7).

**CSS (candidate C6, binding for H2b').**
- `.sheetsurf` becomes a size container (`container: surf / size`).
- `.scalestage` is a flex column. `#scale-plate-band` inside it is `position:sticky; top:0; z-index:2; background:#1f1b15`.
- The pan width is `clamp(110px, calc(100cqh - 260px), 300px)` (C5 used 284px to make room for the caption).
- `.sheetbody` gets `scroll-padding-top` equal to the band height, written on change from the band's measured height, so a focused field is never under the band.
- Under 560px of surface, the `short` padding applies. Under 420px, `side`: the stage becomes a two-column grid (pan left, fields and line right), with labels at 8.5px and the group heading hidden.
- At 600px of container width or more: the two-column stage at every height, pan `clamp(200px, calc(100cqh - 306px), 300px)` (C5: 330px; the 24px reclaimed is the caption's. At 1280x800 the pan still measures 274px, so the change is a no-op there.)
- The `kbup`, `short` and `side` classes are written by `applyKbOffset` (read once per call, written only on change). Its zoom branch, which today clears `transform` and `maxHeight`, also clears `kbup`, so a pinch zoom never leaves the head hidden. No `ResizeObserver` and no `requestAnimationFrame`, because the sandbox has neither.

**Keyboard up, typing in each field (focus first and keyboard first, 20 of 20 cases with the focused field fully in view and uncovered, 1280x800 included).**

| Viewport | Pan visible | Median label (min) | Focused field |
|---|---|---|---|
| 320x568, 260 kb | 136px in all 8 positions (C5: 136; the side layout's 50cqw cap binds, not the caption) | 8px (7) | 44/44 |
| 380x780, 260 kb | 218px in all 8 positions (C5: 194) | 12px (10.3) (C5: 11) | 44/44 |

**Open state (no keyboard).**

| Case | Pan | First field | Sheet body scroll height / client |
|---|---|---|---|
| 320x568 Add | 254px | DING 14.5 of 44px in view, below the fold | 905 / 361 |
| 380x780 Add | 282px | DING 44/44 | 919 / 573 |
| 380x780 Edit | 282px | DING 44/44 (C5: 30.3) | 997 / 507 |
| 380x780 Edit, keyboard up, TOP focused | 218px | TOP 44/44 | 879 / 295 |
| 844x390 Add, drawer closed | 196px, beside the fields (C5: 196) | DING 44/44 | 483 / 235 |
| 1280x800 Edit | 274px, beside the fields | DING 44/44 | 748 / 495 (C3, one column: 1050, DING 0) |

**Error in view.** "TOP RIM NOTES: BB is not a note: write B-flat as Bb." was in view with the keyboard up: at 320, top 230 to 248 against a 308px visual viewport; at 380, top 442 to 460 against 520 (C6 and C5 identical). The line held "(D3) A3 Bb3 C4 B4", struck through (below the fold while typing), and GENERATE was disabled.

**The 320 ceiling.** The surface is 300px with the keyboard up. GENERATE (44px), the slot (36px) and the gaps (24px) leave about 196px. That is why the side layout puts the pan beside the field row, and why the pan stops at 136px. Hiding the head (Q1) is what reaches 136; with the head kept, the pan is 102px with a 5px median label (candidate C).

**Drawer open (D-9, gap found after scoring; `D/rubric.md` "Gap found after scoring").**
- At 380x780 the C6 mock keeps the sticky plate above the drawer (band top 30, drawer top 440; C5: 462). At 1280x800 the plate stays in view (top 34).
- At 844x390, drawer open, the mock loses the plate (band top -195; C5: -216), because the band left `#scale-layout-zone`. Today's "DR1 lines 36 and 88: at 844 x 390 the open drawer is two columns with a 220px plate, and at 500 x 390 one column" would fail.
- **Decision D-9 (integrator, recommended):** the drawer-open rules move from `#scale-layout-zone.open #scale-plate-band` to the stage. With the drawer open and `max-height:520px` and `min-width:560px`, `.scalestage` is the two-column grid: the band in column 1, spanning, at today's `clamp(150px, calc(100dvh - 170px), 232px)`, and `.scalecol` plus `#scale-layout-zone` in column 2.
- With the drawer open, the band is `position:static` while a field or the line has focus (today's DR1 line 34 rule). It is sticky otherwise.
- This is unmeasured. H2b' measures it first (TDD) and rewrites three DR1 tests' selectors (risk K1).

## 4. Lanes (/swarm)

The lanes run serially: H1, then H2a, then H2b', then H3'. H0a is an integrator step. They are serial for the reason #374 gave: H1, H2a and H2b' all touch README:77 and FLOORS, and H2a and H2b' own the same app block and test files. Each lane:
- opens PR M to main (it stays open, G-A and G-F');
- opens PR D to dev, merged under G-C, whose L1 DEV e2e wait is satisfied (except H2a, whose PR D is superseded by H0a);
- works in a `claude/dual-input-<lane>` worktree, tests first.

Branches: H1 from `claude/dual-input-base` (e722c96), each later lane from the previous lane's head. Each PR M to main then carries only lane commits on top of the held #370, #372, #377, #379 and #381 stack.

Each patch header is `# kills: <title>` and `# suite: node --test --test-name-pattern ^DI:.<words-with-dots> tests/<file>`, with `.` wildcards and no quotes (memory "Mutant `# suite:` headers are word-split"), and no `index` lines (memory "Mutant patches reject index lines").

### H1: engine `compose` (#374, plus N1)

Owner files, the 17 tests E1 to E17, the 17 `ih_e_*` mutants, acceptance and Verify are exactly #374's "H1: engine `compose`", with these changes (revision 2026-10-19):
- **N1** (lane T nit, folded here because H1 is the first lane that owns `tests/import.test.js`). One more test and one more mutant:
  - test "IH: N1 DING_NOT_LOWEST names only notes strictly below the ding: Ding: D3 Top: D3 A3 Bb3 C4 D4 is NEEDS_INPUT with REPEATED_IN_SHELL alone";
  - mutant `ih_e_n1_ding_not_lowest_counts_unison`, which turns `n.midi < ding.midi` into `n.midi <= ding.midi` in the `under` filter that raises DING_NOT_LOWEST (its one comparison in `src/engine/importer.js`), with `# suite: node --test --test-name-pattern ^IH:.N1 tests/import.test.js`.
  - Probed at e722c96: the fixture gives NEEDS_INPUT with REPEATED_IN_SHELL alone, and under the mutant DING_NOT_LOWEST and REPEATED_IN_SHELL, so the test kills it.
- So H1 adds 18 tests and 18 `ih_e_*` patches. In Verify, the count check reads `-eq 18`, and the `git apply --check` loop runs over `tests/mutants/i_*.patch tests/mutants/ix_*.patch`. That is 57 plus 19 at e722c96: the 3 app `ix_*` still apply until H2a deletes them. Acceptance's "all 57 `i_*` patches still `git apply --check` and stay killed" covers the 19 `ix_*` too.
- **Compose against e722c96.** Lanes E and T changed `src/engine/importer.js` by 57 lines added and 12 removed since 5a5f7f0. None of it touches what compose uses:
  - the export object `HPE.importer = { interpret: interpret, serialise: serialise }` is unchanged, so adding `compose: compose` to it does not conflict;
  - `serialise` is unchanged apart from its comment;
  - `interpret` now wraps `interpretRaw` in `guard` (SEED_REFUSED), and compose calls neither.
  The one constraint: compose's private helpers must not reuse the new names `guard` and `interpretRaw`. No fix is needed.
- Expected README:77 is 1182 (1164 plus 18), and the `tests/import.test.js` row 102 (84 plus 18). Arithmetic; CI governs.

### H2a: remove the paste UI (re-taken at e722c96; the importer engine stays)

#374 section 3 took its inventory at b153406. Lanes E, T and C then added UI on top: the copy rendering, CONFIRM ticks, the ding-pick flag copy, and their tests and mutants. The owner retired that UI work on 2026-10-19 (their engine tests and mutants stay), so H2a removes it with the rest. This list replaces #374's section 3 lists and its H2a Owns, Acceptance and Verify. #374's "Tests first" order, non-goals and its rule to run Verify in the lane worktree, never on a dev checkout, all stand.

How it was enumerated, at e722c96, by reading rather than one grep (memory "Enumerate callers, do not grep for them"):
- every hit of `import-`, `importRow`, `showImport`, `scale_import`, `IMPORT_` and `I[MC]: ` was read across `index.html`, `tools/` and `tests/`;
- every identifier the import block declares was traced to its callers outside the block;
- each mutant was classified by its `+++` target and its `# kills:` title.

**index.html, outside engine regions:**
- CSS: the block from the comment `/* Import (lane B)` through the `#import-ding-row` rule. It holds `#import-row[hidden]`, `#import-open`, `#import-area`, `#import-result`, `#import-review`, `#import-text`, `#import-ding`, `#import-run`, `#import-use`, `#import-use:disabled`, `#import-rows`, `#import-flags` and its `.block`, `.confirm`, `label` and `input` rules.
- Markup: the "Import (scale-import lane B)" comment and `<div class="fieldrow" id="import-row" hidden>`. It holds the 11 looked-up ids `import-open`, `import-area`, `import-text`, `import-run`, `import-result`, `import-status`, `import-review`, `import-rows`, `import-flags`, `import-ding` and `import-use`, the markup-only `import-ding-row`, and the dynamic `import-tick-<code>` boxes.
- The whole app block headed `/* ---------------- import text (scale-import lane B) ---------------- */`:
  - the 12 element consts: `importRow`, `importOpenBtn`, `importArea`, `importTextBox`, `importRunBtn`, `importResult`, `importStatus`, `importReview`, `importRowsEl`, `importFlagsEl`, `importDingSel`, `importUseBtn`;
  - `IMPORT_INSUFFICIENT`, plus lane C's `IMPORT_LINKS_NOT_OPENED` and `IMPORT_LEAD`;
  - the state: `importSource`, `importRes`, `importPick`, `importTicks` and `importTicked`;
  - lane C's helpers: `importNameList`, `importNames`, `importJoinAnd`, `importUnique`, `importPitchClass`, `importTicksShown`, `importAccept`;
  - `IMPORT_FLAG_TEXT`, all 23 codes, including the lines lanes E and C added;
  - the functions:
    - `importInsufficientLine`, `importFlagLine`, `importRoleOf`, `importNeedsTick`;
    - `paintImportUse`, `paintImportBody` (and the tick `change` listener it adds), `paintImport`;
    - `buildImportPicker`, `runImport` (with `track("scale_import", ...)`), `pickImportDing`, `useImport`, `setImportOpen`, `resetImport`;
  - the four listeners: `importOpenBtn` click, `importRunBtn` click, `importDingSel` change, `importUseBtn` click.
- The two callers outside that block:
  - `resetImport();` in `resetSheetState`;
  - the `...(importRow.hidden ? [] : [importOpenBtn, importTextBox, importRunBtn, ...importTicks, importDingSel, importUseBtn])` stops in the sheet Tab trap.

**tools/sandbox.js ELEMENT_IDS:** the 12 import ids and their comment line.

**tests/app.test.js: 26 tests deleted, 2 rewritten.**
- In describe "discoverability: analytics events": "IM: importing tracks one scale_import per IMPORT with the status only and no pasted text".
- Describe "IM: import text on the sheet", with its setup and its 16 tests: #374's 15, plus lane E's "IM: the six ding-pick flags read as their copy, and SEED_REFUSED shows no parseSeed reason".
- Describe "IC: import copy" (lane C), with its setup and its 9 tests:
  - "IC: C1 BOTTOM_NO_OCTAVE names pitch classes, not guessed octaves";
  - "IC: C2 NO_OCTAVE names the notes that lack an octave";
  - "IC: C3 INSUFFICIENT points to the box above and mentions images nowhere";
  - "IC: C4 UNDECLARED_PARENS tells the user to type the line in the box above with the bracket rules";
  - "IC: C5 no flag line starts with BLOCK: or CONFIRM:, and the status lines never say blocks";
  - "IC: every IMPORT_FLAG_TEXT line that tells the user to type says the box above, and every line about notes names them";
  - "IC: A2 a list reads 'A and B' or 'A, B and C', and a repeated note is named once";
  - "IC: CONFIRM ticks under SEED_REFUSED";
  - "IC: a re-pick clears every CONFIRM tick, so USE needs a fresh confirmation".
- The helper `function showImport(app)`.
- Rewritten as #374 section 3 says:
  - "DR3 Tab order on Add and Edit, finer controls closed and open" drops `showImport(app)` and `"import-open"`;
  - "no event param is a string over 40 characters or names a custom: id" drops its import step and its `scale_import` assertion.

**tests/e2e.test.js: 5 tests deleted, 2 rewritten.**
- Describe "import text on the sheet", with its `REVIEW` and `runImport` helpers and its 5 tests: #374's 4, plus lane C's "IC: at 380px a ticked import never shows a parseSeed refusal under the box".
- The describe-scope `const showImport`.
- Rewritten as #374 section 3 says:
  - "DR1 focus order: on Edit the plate is a tab stop only while the drawer is open, and comes before the toggle" drops `showImport()` and `"import-open"`;
  - "RD: the Edit page's Tab order is BACK, name, box, ADJUST LAYOUT, swatches, SAVE CHANGES, DELETE with the drawer closed, forward and back, and no stop is a select" drops `showImport()` and `"import-open"`, and `select:not(#import-ding)` becomes `select`.

**Mutants: 33 deleted.** Each patches `index.html` app code, and each `# kills:` names a test deleted above.
- All 18 `ib_*`: #374's 17, plus `ib_ticks_shown_under_seed_refused`.
- All 12 `ic_*`:
  - `ic_a2_join_comma`, `ic_a2_repeat_not_unique`;
  - `ic_c1_bottom_octaves_guessed`, `ic_c2_no_octave_old_copy`;
  - `ic_c3_insufficient_below`, `ic_c3_url_sentence_missing`, `ic_c4_parens_old_copy`;
  - `ic_c5_level_prefix`, `ic_c5_status_blocks`;
  - `ic_repick_keeps_ticks`, `ic_table_notes_unnamed`, `ic_table_type_below`.
- The 3 `ix_*` that patch `IMPORT_FLAG_TEXT`: `ix_cue_dropped_text_missing`, `ix_ding_clause_text_missing`, `ix_seed_refused_reason_shown`.

**Mutants re-anchored, not deleted:** the same three as #374: `a_seed_refusal_below_the_pan`, `d_sheet_focus_stays`, `dr3_tab_list_omits_disclosure`. At e722c96 they are still the only kept patches with import text in their context. #374's re-anchor rules apply: a stable anchor, the reviewer reads the failing assertion, no `index` lines, and `# suite:` headers use `.` wildcards and no quotes.

**Kept:**
- `src/engine/importer.js` and the `engine:importer` region;
- `tests/import.test.js`, with lanes E and T's IX: engine tests;
- `tests/import_gold.test.js` and `tools/regen_import_gold.js`;
- the 57 `i_*` patches;
- the 16 engine `ix_*` patches, each patching `src/engine/importer.js` with its suite in `tests/import.test.js`:
  - `ix_cross_shell_repeat_blocks`, `ix_ding_clause_drop_wide`, `ix_ding_clause_many_skipped`;
  - `ix_ding_not_lowest_pick_only`, `ix_ding_not_lowest_skipped`, `ix_ding_on_bottom_skipped`;
  - `ix_dropped_cue_kept_as_top`, `ix_dropped_cue_serialised`, `ix_guard_skipped`;
  - `ix_property_sweep_pick_skipped`, `ix_repeat_in_shell_confirm`, `ix_seed_refused_appended`;
  - `ix_t_dropped_cue_counted_bare`, `ix_t_dropped_cue_in_pitch_check`;
  - `ix_t_not_lowest_inner_skipped`, `ix_t_stray_mark_not_contested`.

**Owns:**
- `index.html` outside engine regions and the DECKS line, for removals only (the list above);
- the `tests/app.test.js` and `tests/e2e.test.js` deletions and the H2a half of the four rewrites above;
- `tools/sandbox.js` ELEMENT_IDS: removing the 12 import ids;
- deleting the 33 patches, and re-anchoring the three;
- `tests/suite_health.py` rows `"tests/app.test.js"` (633 at e722c96) and `"tests/e2e.test.js"` (336), lowered to 607 and 331. These are this lane's own rows, lowered for a deliberate removal, so #374's note on tests/CONTRACT.md (eng-review-v4 N-2) stands;
- README:77 (after H1's number).

**Acceptance:**
- the 26 app and 5 e2e tests, the "IM: import text on the sheet" and "IC: import copy" describes, the e2e "import text on the sheet" describe and both `showImport` helpers are gone;
- every other test passes, and "no event param is a string over 40 characters or names a custom: id" still runs, without its `scale_import` assertion;
- `grep -rnE 'import-|showImport|importRow|scale_import|IMPORT_' index.html tests tools | grep -v 'import-v2\|import-fix'` prints nothing. The allowed hits are the kept `import-v2` gold paths and the `docs/plans/2026-10-18-import-fix.md` comment in `tests/import.test.js`;
- `grep -nE 'I[MC]: ' tests/app.test.js tests/e2e.test.js` prints nothing;
- no `ib_*` or `ic_*` patch remains and none of the three app `ix_*` patches exists, so `ls tests/mutants/ix_*.patch | wc -l` is 16;
- the three re-anchored patches each make their suite fail, for the reason the reviewer reads in the failing assertion;
- all 57 `i_*`, 16 `ix_*` and 18 `ih_e_*` patches still `git apply --check`;
- `#import-row` is absent from the served markup and nothing replaces it yet;
- FLOORS and README:77 equal CI's counts. Expected README:77 is 1149 (1182 minus 33), with the rows 607 (633 minus 26) and 331 (336 minus 5). Arithmetic; CI governs.

**Verify:**

```
export CHROME_BIN
bash <<'VERIFY'
test -x "$CHROME_BIN" || { echo "set CHROME_BIN to a Chromium binary"; exit 1; }
node --test tests/app.test.js tests/harness.test.js tests/import.test.js tests/import_gold.test.js \
 && CHROME_BIN="$CHROME_BIN" node --test --test-name-pattern '^DR1.focus|^RD:.the.Edit.page' tests/e2e.test.js \
 && python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py \
 && test -z "$(grep -rnE 'import-|showImport|importRow|scale_import|IMPORT_' index.html tests tools | grep -v 'import-v2\|import-fix')" \
 && test -z "$(grep -nE 'I[MC]: ' tests/app.test.js tests/e2e.test.js)" \
 && test -z "$(ls tests/mutants/ib_*.patch tests/mutants/ic_*.patch 2>/dev/null)" \
 && test $(ls tests/mutants/ix_*.patch | wc -l) -eq 16 && LOG=$(mktemp) \
 && { for p in tests/mutants/i_*.patch tests/mutants/ix_*.patch tests/mutants/ih_e_*.patch; do git apply --check "$p" || echo "STALE $p"; done; \
      for p in tests/mutants/a_seed_refusal_below_the_pan.patch tests/mutants/d_sheet_focus_stays.patch tests/mutants/dr3_tab_list_omits_disclosure.patch; do cmd=; git apply --check "$p" || { echo "NOAPPLY $p"; continue; }; git apply "$p"; cmd=$(grep -m1 '^# suite:' "$p" | sed 's/^# suite:[[:space:]]*//'); if CHROME_BIN="$CHROME_BIN" $cmd >/dev/null 2>&1 </dev/null; then echo "SURVIVED $p"; fi; git apply -R "$p"; done; } 2>&1 | tee "$LOG" \
 && ! grep -q 'SURVIVED\|NOAPPLY\|STALE' "$LOG"
VERIFY
```

CI `validate` at the verified head SHA is the evidence.

### H2b': dual input (replaces #374 H2b)

**Owns:**
- `index.html` outside engine regions and the DECKS line: the markup in 2.1, the CSS in section 3, and the app code in 2.2 to 2.5;
- `tests/app.test.js`: describe "DI: dual input", and the extensions of "SG: N-A2 the served markup order is ..." and "DR3 Tab order on Add and Edit, finer controls closed and open" named under Acceptance;
- `tests/e2e.test.js`: the DI-E tests, the rewrites of the three DR1 drawer tests and the extensions of "SG: N-A2 and N-A9 in the live DOM: ..." and "SG: N-A6 ..." named under Acceptance;
- `tests/drawer_grid.test.js`, `tests/drawer_seats.test.js` and `tests/drawer_drag.test.js`: selector edits only, where the plate band's move breaks one (K3), each listed in the PR;
- `tools/sandbox.js` ELEMENT_IDS: adding the 13 ids in 2.1;
- 31 new `tests/mutants/di_*.patch`;
- re-anchoring any existing patch whose anchor H2b' moves;
- `tests/suite_health.py` rows `"tests/app.test.js"` and `"tests/e2e.test.js"`;
- README:77.

**Tests first, app (sandbox), one mutant each:**

| # | Title | Mutant |
|---|---|---|
| A1 | DI: the sheet serves DING, TOP RIM NOTES, TOP INNER NOTES and BOTTOM NOTES in that order before #scale-box, each a text input with autocapitalize off, enterkeyhint next and BOTTOM done | di_fields_after_box |
| A2 | DI: Add opens with the four fields empty, the fields path active, #scale-box empty and BACK focused | di_add_opens_line_active |
| A3 | DI: Edit of each built-in fills the four fields with that deck's notes by zone with explicit octaves, and #scale-box holds formatSeed of the deck | di_edit_skips_decompose |
| A4 | DI: typing in the fields writes compose's line into #scale-box through one input event, the parse line and the pan match typing that line, and the field typed in keeps its text as typed | di_fields_write_without_input_event |
| A5 | DI: clearing every field clears #scale-box | di_empty_fields_keep_line |
| A6 | DI: a field error keeps #scale-box at its last good line, marks it Not updated, holds the pan and disables GENERATE CARDS | di_stale_line_generates |
| A7 | DI: fixing the field error rewrites the line and clears the stale mark | di_stale_mark_sticks |
| A8 | DI: typing a line that parses rewrites the four fields by zone with explicit octaves | di_line_not_decomposed |
| A9 | DI: typing a line that does not parse leaves the fields as they were and marks them Not updated | di_fields_cleared_on_bad_line |
| A10 | DI: focusing a field or #scale-box switches the active path and rewrites neither path | di_focus_rewrites_box |
| A11 | DI: only the passive path carries the passive class and its caption | di_both_paths_active |
| A12 | DI: GENERATE CARDS follows the active path: a stale line never generates, and a line that parses generates while the fields are stale | di_generate_reads_passive |
| A13 | DI: palette, anchor, mirror, mirror bottom and seats survive a field edit and a line edit | di_field_edit_resets_options |
| A14 | DI: a guessed bottom octave is written explicit in the line and named by M16 in the slot | di_guess_left_implicit |
| A15 | DI: the slot shows the first shown message in visual order prefixed by its field's short name, and #scale-msg yields while it holds text | di_slot_not_prefixed |
| A16 | DI: a field message joins only at settle: nothing while a field is typed in, the message at its blur | di_message_while_typing |
| A17 | DI: a settled new message is announced once through #scale-fields-live on a deferred tick, and the open paint announces nothing | di_announce_while_editing |
| A18 | DI: Enter in DING, TOP and INNER moves to the next field, and Enter in BOTTOM blurs it | di_enter_submits |
| A19 | DI: a mousedown on a field label is prevented and focuses its field | di_label_mousedown_default |
| A20 | DI: the sheet's Tab order is BACK, the deck name on Edit, DING, TOP, INNER, BOTTOM, then #scale-box and the existing stops | di_tab_skips_fields |
| A21 | DI: a typed line keeps its spelling until a field edit rewrites it canonically | di_line_reformatted_on_focus |
| A22 | DI: SAVE from Edit after a field edit stores the same record as typing the composed line | di_save_reads_fields_raw |

**Tests first, e2e (Chrome), one mutant each:**

| # | Title | Mutant |
|---|---|---|
| E1 | DI: at 320x568 with a 260px keyboard each field typed in stays fully in view with at least 130px of pan in view and the sheet head hidden, and BACK shows again once the keyboard closes | di_e_pan_unpinned |
| E2 | DI: at 380x780 with a 260px keyboard each field typed in stays fully in view with at least 212px of pan in view | di_e_pan_clamp_low |
| E3 | DI: keyboard before focus and focus before keyboard both leave the focused field fully in view at 320x568 and 380x780 | di_e_no_scroll_padding |
| E4 | DI: at 1280x800 the Edit sheet shows the pan beside the four fields and DING without scrolling | di_e_no_wide_grid |
| E5 | DI: at 844x390 the Add sheet shows the pan beside the fields at least 190px wide, with the group heading hidden | di_e_side_stack |
| E6 | DI: with the keyboard up at 320x568 and 380x780 the TOP error is fully in view in the slot | di_e_slot_in_scroller |
| E7 | DI: the passive path's input text is at least 7:1 and its label at least 4.5:1 against the sheet | di_e_passive_low_contrast |
| E8 | DI: the settings trigger is neither visible nor hit-testable while the scale sheet is open | di_e_trigger_visible |
| E9 | DI: with the drawer open at 844x390 the plate stays beside the drawer controls at 220px, and at 380x780 above them | di_e_drawer_band_lost |

The E1 and E2 floors (130 and 212) sit 6px under the candidate C6 macOS figures (136 and 218). The Linux CI fonts may differ, so CI's first run at the head SHA governs. The lane may move a floor once, with the measured figure in its PR, but never under the rubric's 8 anchor (130 at 320, 190 at 380 less 2px of rounding).

**Acceptance:**
- all 22 A and 9 E tests pass, and each `di_*` patch makes its suite fail for the reason its title names (the reviewer reads the failing assertion);
- every existing test passes, except these three, whose selectors H2b' rewrites with no weaker assertion:
  - "DR1 line 34: the open plate band stays in the scrollport at the end of the body, and is static while the field has focus";
  - "DR1 line 35: at 380 x 667 the open plate is no wider than 42 percent of the viewport height";
  - "DR1 lines 36 and 88: at 844 x 390 the open drawer is two columns with a 220px plate, and at 500 x 390 one column".
- these four are extended, never weakened (a reviewer FAILs a dropped or loosened assertion):
  - app "SG: N-A2 the served markup order is .sheetbody, #scale-guidance (#scale-msg, #scale-layout-state), #scale-generate, #scale-delete-row": the slot list gains `scale-field-msg` first, and the title names it;
  - e2e "SG: N-A2 and N-A9 in the live DOM: both messages are children of #scale-guidance, ...": the slot children gain `scale-field-msg` first; the surface children are unchanged;
  - app "DR3 Tab order on Add and Edit, finer controls closed and open": the `want` lists gain the four fields before `scale-box`;
  - e2e "SG: N-A6 the scrollport does not resize between empty, notice and one- or two-line states, ...": gains the field-message state.
  Any other test the lane edits is listed in the PR with the reason.
- SB-2 is green with the 13 new ids;
- all 57 `i_*`, 16 `ix_*` and 18 `ih_e_*` patches still `git apply --check`;
- FLOORS and README:77 equal CI's counts. Expected README:77 is 1180 (1149 plus 31), and the rows 629 and 340 (607 plus 22 and 331 plus 9; arithmetic, CI's artifact governs).

**Verify** (in the lane worktree, never on a dev checkout: dev's overlay fails app tests, #374 eng-review-v8 N-8):

```
export CHROME_BIN
bash <<'VERIFY'
test -x "$CHROME_BIN" || { echo "set CHROME_BIN to a Chromium binary"; exit 1; }
node --test tests/app.test.js tests/harness.test.js tests/import.test.js \
 && CHROME_BIN="$CHROME_BIN" node --test --test-name-pattern '^DI:|^DR1.lines?.3[456]|^SG:.N-A|^DR1.focus' tests/e2e.test.js \
 && CHROME_BIN="$CHROME_BIN" node --test tests/drawer_grid.test.js tests/drawer_seats.test.js tests/drawer_drag.test.js \
 && python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py \
 && test $(ls tests/mutants/di_*.patch | wc -l) -eq 31 && LOG=$(mktemp) \
 && { for p in tests/mutants/i_*.patch tests/mutants/ix_*.patch tests/mutants/ih_e_*.patch; do git apply --check "$p" || echo "STALE $p"; done; \
      for p in tests/mutants/di_*.patch; do cmd=; git apply --check "$p" || { echo "NOAPPLY $p"; continue; }; git apply "$p"; cmd=$(grep -m1 '^# suite:' "$p" | sed 's/^# suite:[[:space:]]*//'); if CHROME_BIN="$CHROME_BIN" $cmd >/dev/null 2>&1 </dev/null; then echo "SURVIVED $p"; fi; git apply -R "$p"; done; } 2>&1 | tee "$LOG" \
 && ! grep -q 'SURVIVED\|NOAPPLY\|STALE' "$LOG"
VERIFY
```

The local run is a smoke test. The full e2e suite starves the browser here (memory "CHROME_BIN available locally"), so CI `validate` at the verified head SHA is the evidence.

**Non-goals:**
- no engine edit, and no change to `compose`'s output (H1 owns it);
- no options in the fields;
- no change to share, record, SAVE or DELETE semantics;
- no CLAUDE.md or README prose beyond line 77;
- no `requestAnimationFrame` or `ResizeObserver`;
- no change to `#scale-refusal`'s place or job.

**Sandbox limits** (`tools/sandbox.js`):
- no `querySelectorAll` on elements, no `input.labels`, and a compound `document.querySelector` returns null; so labels and inputs are looked up by id;
- `window.visualViewport` is absent on a default boot, so `kbup`, `short` and `side` stay off in the A tests, and every layout claim is an E test;
- no `requestAnimationFrame`, so the mirror and paint run synchronously.

### H3': docs

**Owns** `CLAUDE.md`:
- "Scale import": "Hidden" and "Sheet" rewritten for the dual input, citing DI-A and DI-E titles; "Engine" and "After-list scan" kept; a "Helper engine" bullet citing E1 to E17; "No network" kept for the engine only.
- "Known pitfalls": the sheet guidance bullet gains the field-message slot (citing DI-A15 and the extended N-A6).
- "DEV environment": the overlay's import-row un-hide is gone (H0a), and the production-pin sentence no longer cites the deleted "IM: the import row ships hidden: ..." test.
- "Scale strings": one sentence saying the fields compose the same line (citing DI-A4 and E3).
- "Scale import", lanes E and C's sentences (revision 2026-10-19): lane C's flag-copy sentences (they cite "IC: C1" to "IC: C5", "IC: every IMPORT_FLAG_TEXT line ..." and "IC: A2 ...") are removed; in lane E's "Ding-pick flags (lane E)" bullet, the SEED_REFUSED sentence keeps its IX: citation and loses its IM: citation and its CONFIRM-tick clause; the "Sheet" clause citing "IC: a re-pick clears every CONFIRM tick, ..." goes with the picker. The IX: engine sentences stay.
- "Discoverability", analytics bullet: the tenth event `scale_import` is removed (it no longer fires after H2a), and the sentence on "no event param is a string over 40 characters or names a custom: id" no longer says it runs an import first.

**Acceptance:** every sentence names an existing test title or says "(no test; true by <file>)". `grep -n '"IM: ' CLAUDE.md` and `grep -n '"IC: ' CLAUDE.md` print nothing.

**Verify:** #374's H3 Verify block, with `IH: ` replaced by `DI: ` in the title regex and a second pass for `IH: compose`.

**Non-goals:** README, `docs/plans/2026-10-17-import-v2.md`.

### H0a: dev sync (unchanged from #374)

`claude/dev-sync-h2a` from origin/dev; merge H2a's verified head and take H2a's side for the whole import block; keep the GA placeholder and `_headers`. Dev also carries the lane E/T/C UI (#377, #379, #381). H2a deletes it, so taking H2a's side removes it from dev too, along with its IM: and IC: tests and its `ib_*`, `ic_*` and app `ix_*` mutants (revision 2026-10-19). It merges under the dev-sync grant once H2a's PR M is green, and H2a's PR D is closed as superseded. Q10's wait is satisfied: the L1 DEV e2e passed on 2026-10-19 at dev 2f51721.

## 5. Sequencing against in-flight work

- **#370 (L1), #372 (L1b), #377 (lane E), #379 (lane T) and #381 (lane C)**: open to main and HELD until dual input is DEV e2e validated (section 6) and the owner says merge (owner, 2026-10-19). All five are on dev; `claude/dual-input-base` (e722c96) is dev minus the overlay. Main merge order: #370, #372, #377, #379, #381, H1, H2a, H2b', H3'.
- **#374** (the helper plan PR): close it as superseded by this plan once it is reviewed, or amend it to point here. Its H1, H2a and H0a text is reused by reference (section 0), with the e722c96 changes in section 4.
- **The L1 DEV e2e** of the paste UI is DONE: 2026-10-19, PASS, at dev 2f51721. Q10's wait is satisfied, so H0a and every dev merge of this plan may proceed under G-C.

**Now unblocked:** H1, H2a, H2b' and H3', in that order, each built, reviewed and green on PR M; each PR D merges to dev under G-C. H0a stands in for H2a's PR D, and H2b' PR D also needs H0a on dev.

**Still held:** every main merge (the five PRs above and every lane here) until the section 6 DEV e2e passes and the owner says merge (G-F', Q9).

## 6. DEV e2e checklist (phone-first)

This runs after H0a and H2b' PR D are on dev and the Cloudflare build for that commit is live. The integrator first confirms the deployed `index.html` contains `id="scale-ding"`. The run is `/qa-only` with gstack `/browse` against https://handpan-cards-dev.pages.dev, in a subagent with `OPENCLAW_SESSION=1` on every Bash call, read-and-report only.

Viewports, in this order: 380x780, 320x568, 844x390, 1280x800. At each:

1. ADD A SCALE: the four fields are the first inputs. BACK is focused and no keyboard opens. The pan placeholder is visible, and the line row reads "Follows the notes above. Tap to type the line instead.".
2. Type `d3`, then `a bb c d e f g a`, then `c eb` in BOTTOM. After each field:
   - the pan redraws;
   - after BOTTOM's blur, scrolling to the line row shows `#scale-box` reading "[C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4", dimmed, with no "Line: ..." caption under the pan at any viewport;
   - after BOTTOM's blur, the slot reads "BOTTOM NOTES: Octaves guessed: C3, Eb3. Type an octave to change a guess.";
   - GENERATE CARDS is enabled;
   - with no keyboard up, the sheet head (BACK and the title) is visible at every viewport. `/browse` raises no real keyboard, so the hidden head (Q1) is proved by DI-E1 and P-7.
3. TOP `a bb c BB`, then tap INNER. The slot reads "TOP RIM NOTES: BB is not a note: write B-flat as Bb." The line is struck through and holds its last good value. The pan is held, and GENERATE is disabled. Fix to `Bb`: the line updates and the strike clears.
4. `Re` in DING, then Tab: "DING: Use letter names, like D A Bb.". `A3 G3` in TOP, then Tab: "TOP RIM NOTES: G3 is lower than A3: list low to high.".
5. Tap the line. The fields dim and read "Follows the line below. Tap a field to type notes instead.". Type `(D3) A3 C4 D4 E4 F4 G4 A4 C5`: the fields fill with explicit octaves. Type `(D3) A3 X`: the fields keep their values, marked "Not updated: the line below does not read as a scale yet.".
6. Tap DING: the fields are active again and nothing was rewritten. Edit TOP: the line is rewritten canonically.
7. Open ADJUST LAYOUT, then set #1 / #2, mirror and a swatch. Edit a field: the options are kept. At 844x390 the plate sits beside the drawer controls.
8. GENERATE CARDS: the deck is built from the line shown.
9. Edit F3 Low Pygmy 18. BOTTOM NOTES reads `C3 Db3 Eb3 Bb3 Db4 Ab5`, and the line equals the deck's. SAVE without changes changes nothing.
10. The settings trigger is not visible over the open sheet.
11. Network: zero requests to googletagmanager.com and google-analytics.com, and none while typing.

**Real phones (owner or integrator; one iOS Safari, one Android Chrome).** Record pass or fail per phone, with the device, OS and browser version.
- P-1. Steps 2 and 3 with the keyboard up: the pan's top and the focused field are visible together at every field.
- P-2. Enter moves DING to TOP to INNER to BOTTOM, and Enter on BOTTOM closes the keyboard.
- P-3. Tap each field label with the keyboard up: its field is focused and the page does not jump.
- P-4. Landscape with the keyboard up: the field typed in and GENERATE are reachable. The pan may crop (an accepted gap, as #374 R-4).
- P-5. With VoiceOver or TalkBack on: the fields are announced as a group "YOUR SCALE, NOTE BY NOTE", and a field error is announced once, after leaving the field.
- P-6. On a 320pt-wide phone or simulator, if available: the pan labels are readable at 8px (owner decision Q8).
- P-7. On a phone whose sheet is under 420px tall with the keyboard up (a 320pt-wide phone, or any phone in landscape): BACK and the title hide while typing (Q1). On iOS Safari, which has no platform Back, Done on BOTTOM closes the keyboard and BACK returns; on Android, the system Back closes the sheet.

**Exit.** Every step passes at every viewport, and P-1 to P-5 and P-7 pass on both phones (or the owner accepts a named failure in writing). The integrator records both result sets in the queue doc and asks the owner to merge the main PRs (G-F').

## 7. Risks, accepted gaps, owner decisions

**Risks.**
- K1. The drawer-open stage (D-9) is unmeasured. The three DR1 tests named in H2b' Acceptance must be rewritten, and the 844x390 drawer layout re-proved. Mitigation: H2b' measures it first, and DI-E9 pins it.
- K2. `#scale-guidance` growth. M12 (an engine reason) can be three lines. "SG: N-A6 ..." pins an 18px-a-line growth set; H2b' extends the set, and a reviewer FAILs any weakening.
- K3. Existing e2e tests may pin the plate's old DOM position (`scale-plate-band` appears in `tests/e2e.test.js` 5 times, `tests/app.test.js` 3, `tests/drawer_drag.test.js` 5, `tests/drawer_seats.test.js` 4 and `tests/drawer_grid.test.js` 1). Which ones break is unknown until CI; H2b' lists every edit.
- K4. Real keyboards differ from the 260px fake: iOS's accessory bar and Android's resize mode. Only P-1 to P-4 prove them.
- K5. A long-held main PR (G-F') drifts from main. Rebasing is the lane's job, under the usual gates.
- K6. Linux CI fonts may move E1 and E2 by a few pixels (the floors' margin is 6px).

**Accepted gaps.**
- At 320x568 with no keyboard, DING is 14.5 of 44px in view on Add (the pan is 254px above it); the first tap scrolls it.
- With the keyboard up at 320 and 380, the line row is below the fold while typing in a field: no copy of the line is visible (Q7). The pan is the live confirmation.
- 320 labels are 8px median, 7px minimum, with the keyboard up.
- The stale line holds an intermediate keystroke value, e.g. "(D3) A3 Bb3 C4 B4" while `BB` is typed (Q4).
- The line's spelling is normalised by the next field edit (2.3).

**Owner decisions** (2026-10-18, answered on the artifact https://claude.ai/artifact/P361top5eoK3x3EYPHPXU7; design: the owner picked candidate C5, and Q7 turns it into candidate C6).
- Q1. Hide the sheet head (BACK and the title) while the keyboard is up and the sheet is under 420px tall. Escape and the platform Back still close the sheet; the pan is 136px at 320 (102px, 5px median label, with the head kept).
- Q2. Hide the settings trigger while the scale sheet is open.
- Q3. Placeholders are the example line split by field: #374's C6, `D3`, `A Bb C D E F G A`, `C5 D5`, `C3 Eb3`. (The owner's wording, "split the example line by field", is recorded as this option, per the integrator; if it meant today's 20-note placeholder split by zone, only the four placeholder strings in 2.1 and DI-A3 change.)
- Q4. While the fields have an error, the line shows its last good value struck through, marked "Not updated: the notes above have a problem.", and GENERATE CARDS is disabled.
- Q5. Field messages show in one slot in `#scale-guidance`, prefixed with the field name.
- Q6. Heading "YOUR SCALE, NOTE BY NOTE" (hidden in landscape), with today's line label unchanged.
- Q7. Drop the "Line: ..." caption under the pan (the owner overrode the recommendation to keep it). The pan grows from 194 to 218px at 380 and stays 136px at 320. What now carries confirmation: the pan, live, while typing; the dimmed line row, struck through with its "Not updated" note when stale, when scrolled to; and M16 in the slot for a guessed bottom octave.
- Q8. Accept 8px median, 7px minimum, pan labels at 320 with the keyboard up; P-6 checks it on a phone.
- Q9. The main PRs stay open (G-F') until the owner says merge: no flag, no un-hide lane. Dev only until then.
- Q10. Run the L1 DEV e2e of the paste UI before H0a removes it from dev. Lane builds may start in parallel; every dev merge waits for that e2e (section 5). Done: the L1 DEV e2e passed on 2026-10-19 at dev 2f51721 (revision 2026-10-19).

**Open owner questions (from the plan review, 2026-10-18).**
- OQ-1. In the `side` layout (844x390, and keyboard-up phones under 420px tall) the field labels drop to 8.5px. Q8 accepted 8px pan labels, not field labels. Recommended: accept, with P-7 also checking the labels are readable; the alternative is to measure the stage with 10px labels before H2b' starts.
- OQ-2. Path-usage analytics: with `scale_import` retired, nothing records whether people use the fields or the line. Recommended: no event (the non-goal stands); the alternative is one `scale_path` event with `{path}` only, which adds a test, a mutant and a CLAUDE.md sentence.
- OQ-3. Q3's wording (see Q3 above): confirm the four placeholders are #374's C6 split, not today's 20-note placeholder split by zone.

**Integrator decisions (recorded, not owner decisions).**
- D-9: the drawer-open stage (section 3).
- D-10: the four inputs go before `#scale-box` in the Tab list, and the plate hit stays after it.
- D-11: H2b' ids use the `scale-` prefix, matching the sheet.

## 8. Self-check

- **Counts.**
  - H1: 18 tests, 18 mutants (E1 to E17, plus N1).
  - H2a: minus 26 app tests, minus 5 e2e tests, minus 33 mutants (re-taken at e722c96).
  - H2b': 22 app tests, 9 e2e tests, 31 mutants, 13 ELEMENT_IDS. An earlier draft's `#scale-mirror` caption, its test (then numbered A21) and its mutant `di_mirror_caption_stale_text` were removed by Q7; today's A21 is the line-spelling test.
  - README:77: 1164 at e722c96, 1182 after H1, 1149 after H2a, 1180 after H2b'.
  - FLOORS at e722c96: app 633, e2e 336, import 84. After H1: import 102. After H2a: app 607, e2e 331. After H2b': app 629, e2e 340, import 102.
  - All of these are arithmetic; CI's artifacts and counts at the head SHA govern.
- **Cited existing test titles, checked in `wt/tests` at b153406 and again at e722c96:**
  - "SB-2 every served id is in the markup and is looked up by the app";
  - "DR1 line 34: ...", "DR1 line 35: ...", "DR1 lines 36 and 88: ...";
  - "SG: N-A6 the scrollport does not resize between empty, notice and one- or two-line states, ...";
  - "IM: the import row ships hidden: ..." (deleted by H2a).
  - "SG: N-A2 the served markup order is ...", "SG: N-A2 and N-A9 in the live DOM: ...", "DR3 Tab order on Add and Edit, finer controls closed and open", "DR1 focus order: ...", "no event param is a string over 40 characters or names a custom: id".
  The E3 title is #374's (new in H1). Every DI: title is new and listed in section 4.
- **Measured, not claimed.** Every number in section 3 comes from the files it names. The drawer-open stage after D-9, the real-keyboard behaviour and the Linux CI font figures are stated as unmeasured.
- **Style.** No em dashes and no emojis. Anchors are cited, not line numbers, except README:77, which the repo itself names by line.

## Owner answers to OQ-1 to OQ-3 (2026-10-18)

- OQ-1: accept 8.5px field labels in the side layout; P-7 adds a readability check on a real device.
- OQ-2: no new event.
- OQ-3: placeholders are #374 C6 example, split by field.
