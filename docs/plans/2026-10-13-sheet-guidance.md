# Plan: the sheet's guidance sits with SAVE CHANGES

Planned against `main` 49b895c (branch base 6f830c0 adds only the prompt file). Owner request, 2026-10-13, verbatim:

> "Layout not saved yet. SAVE CHANGES keeps it." And other instructions or error messages should be right above or below the "Save Changes" button on the drawer, so that the guidance to user is visible and never hidden due to viewport size and scrolling. Consult /frontend-design:frontend-design for placement and usability.

**VERDICT: SMALL.** Recommended design: one reserved two-line slot, `#scale-guidance`, between `.sheetbody` and `#scale-generate`, holding `#scale-msg` (warning or error first) and `#scale-layout-state` (notice second, nearest the button it names). Everything else stays where it is, `#scale-refusal` stays under the seed box by the owner's 2026-09-21 decision (a flag for the owner is in N-4), and no string, engine file, fixture or `#settings-panel` rule changes.

Measured in gstack `$B` (headless Chromium) with fonts from `tools/fonts/` injected. "Prototype" means the slot was injected by script, `index.html` untouched. CI blocks web fonts, so wrap counts there can differ (E).

## A. The slot

**Design consultation (`frontend-design:frontend-design`, invoked with a one-slot brief; its verdict, adopted as this plan's own).** Slot ABOVE the primary, left-aligned like the sheet's other text, two lines reserved, existing tokens only, no motion. Reasons: a message is read before the action it names; below the primary is already the delete row's (`#scale-del-note` explains DELETE) and a second note region there would stack two unrelated notes under the thumb on Edit. Stack warning/error first, notice second (fixed order, no priority contest): the notice is the one that names the button, so it hugs it. One type system: the notice drops to `#scale-msg`'s 12px/1.5 Nunito Sans (Bitter 11.5 beside Nunito 12 reads as two voices); the `#scale-msg` tiers are inherited, not redefined. No copy change proposed. **Design review 2026-10-13, D3:** inside the slot the notice takes the sheet's neutral text colour `#c4bcab` and drops its amber; amber is reserved for `warn`, orange for `err`. Both outside voices read the prototype's warning-plus-notice stack (`variant-warn.png`) as one three-line amber paragraph; colour is the split, because a `--sp-1` gap between the two (the other remedy offered) costs 6px that the 395px-keyboard growth case does not have (headroom 3px to -3px, table D). The band (`#scale-drawer-status`, Bitter) and the slot (Nunito Sans) now describe the same gesture in two faces; accepted (D7). Provenance: the `frontend-design` skill returned general guidance and the planning lane applied it itself; `$D variants` could not run (no OpenAI key on this machine, owner-only setup), so the mockups are prototype screenshots of the real app (Approved Mockups below).

**N-1 above (recommended, closed by the consultation).** The footer today is `.sheetsurf`'s flex column: `.sheethead`, `.sheetbody` (`overflow-y:auto`, `border-bottom` hairline), `#scale-generate`, `#scale-delete-row` (hidden on create). `.sheetsurf` has `gap: var(--sp-4)` and `overflow-y:auto` as the backstop.

**N-2 reserved height: two lines, 36px (recommended).** Longest strings at 336px content width (380px viewport minus 2 x 22px padding), real fonts:

| string | lines |
|---|---|
| "Layout not saved yet. SAVE CHANGES keeps it." (and GENERATE CARDS) | 1 |
| longest `layoutNoticeText()`: notice plus all three " seats were reset." suffixes (`LAYOUT_RINGS` is rim, inner, bottom; eng review R9 corrected "both") | 3 at 380px, so a growth state (e), not the reserve |
| `NO_THIRDS` | 1 |
| `SMALL_LABELS` (the longest single `say()` string in the sheet) | 2 |
| `NO_THIRDS` + `SMALL_LABELS` joined by `openEditSheet()` | 3 |
| "Keep at least one deck. Add a scale before deleting <name>." | 2 (3 with a 40-char name) |

CSS, all existing rules: `#scale-guidance{flex:0 0 auto; min-height:calc(2 * 1.5 * 12px); display:flex; flex-direction:column; justify-content:flex-end; margin-block:calc(var(--sp-2) - var(--sp-4))}`; the negative margins tuck the slot to `--sp-2` from the hairline and from the button instead of two full `--sp-4` gaps (22px each on a phone); `#scale-guidance #scale-msg{min-height:0}` (the wrapper owns the reservation; `#scale-msg`'s own 1.5em floor would leave a dead line above a lone notice); inside `@media (max-height:520px)`, where `.sheetsurf`'s gap is `--sp-3`, `#scale-guidance{margin-block:calc(var(--sp-2) - var(--sp-3))}` (eng review R1); `#scale-guidance #scale-layout-state{font:400 12px/1.5 "Nunito Sans"; color:#c4bcab}` (D3). The reserve is two 18px lines, 36px, written as its derivation (D9: the sheet has no height token; this is the one new figure). Empty states: the notice keeps its `hidden` attribute; an empty `#scale-msg` is a 0px block (`min-height:0`, no `display:none` needed), so `justify-content:flex-end` bottom-aligns whichever line is lit (D6). The negative `margin-block` only trims the surface's two `--sp-4` gaps to `--sp-2` (8px on a phone); the slot's box never reaches the primary's hit area, and nothing in the slot is interactive. `flex:0 0 auto` is load-bearing: without it the slot is a shrinkable flex item and a three-line message spills over the button (prototype: `msgLine` 54px in a 36px box, scrollport unchanged at 99). Measured with it: scrollport 99px with a 1-line and a 2-line warning, 81px with a 3-line one, 99px again once cleared.

Cost of two lines is 30px off every scrollport (36 minus the 6px the tuck gives back; prototype). Alternatives: one line (18px) costs 12px but SMALL_LABELS then grows the slot while the player types; three lines (54px) costs 48px and leaves about 3px of Edit headroom at the 395px keyboard (estimate). Two lines holds every single message and the notice alone with no resize.

**Growth beyond two lines is allowed in exactly these states, and nowhere else (requirement 4).** Total text over two lines: (a) a two-line warning plus a one-line notice (a crowded pan whose layout the player has changed), (b) joined warnings (three lines) at Edit open, (c) their combinations with a notice, (d) the delete refusal with a long deck name, (e) the notice with all three ring-reset suffixes (eng review R9). Each adds 18px per line. Why acceptable: (b) and (d) happen with no finger on the scroller. (a) fires on the pointer-up that ends the first layout change (`paintLayout()` writes the notice there, never mid-drag); the scrollport shrinks 18px at its bottom edge and the content above does not move unless the body is scrolled to its maximum. When the body does not overflow (390x844, create, closed) the primary moves 18px instead: the one residual jump, crowded pans only. N-6 records the owner's alternative (one message wins) if they prefer none.

**Design review 2026-10-13, D5 (the biggest risk both voices named).** The slot's promise is the owner's: guidance visible, never hidden by scrolling or the viewport. "Never resizes" is this plan's own stricter goal, and it holds except in the enumerated growth states, where the slot grows by exactly 18px per line and N-A6 asserts that figure rather than exempting the state. The three hard-cap remedies were rejected: clamping `#scale-msg` to two lines or collapsing a warning to its first clause hides guidance text, which is the opposite of the request; a three-line reserve costs 18px on every scrollport and leaves 3px of Edit headroom at the 395px keyboard for every player, crowded pan or not. Growth state (a) is measured under the keyboard in table D and `assertSeedBoxReadable` runs in it (N-A7). The delete refusal (d) and `#scale-del-note` CAN be on screen together (eng review R6, Codex): the refusal is written by `deleteDeck()` into `#scale-msg`, and a further DELETE tap re-arms and writes `#scale-del-note` without clearing `#scale-msg`. The note stays pinned under DELETE outside the slot, so the slot holds one message; N-A6 includes the refuse-then-re-arm sequence (slot height unchanged, note visible).

## B. Which surfaces move

**The rule (one sentence).** A line that explains or reads out the control it sits beside stays beside that control; a line that tells the player what the page will or will not do next, or that something went wrong, goes to the slot. The owner's words win on a conflict, and they conflict once (N-4).

| surface | class | placement |
|---|---|---|
| `#scale-layout-state` (notice) | page state | slot (owner, binding) |
| `#scale-msg` (everything `say()` writes) | page state / error | slot, N-3 |
| `#scale-parse` | reads out the box | stays in `.fieldrow` |
| `#scale-refusal` | error about the box | stays by owner decision 2026-09-21, N-4 |
| `#scale-drawer-status` | readout of the pan | stays in the sticky `#scale-plate-band`, N-5 |
| `#scale-layout-hint` | about ADJUST LAYOUT | stays |
| `#scale-drawer-hint` | about the plate gestures | stays |
| the two anonymous `.sheethint` paragraphs in `#scale-drawer` | about the orientation and mirror buttons | stay |
| `#scale-del-note` | about DELETE | stays, already pinned |
| `.sheetlabel` captions | labels | out of scope |

Correction to the prompt: `#scale-drawer` holds TWO anonymous `.sheethint` paragraphs, not three.

**N-3 move `#scale-msg` (recommended).** Its markup comment says it sits "Above the control row, so the soft keyboard never covers it"; the control row moved into the scroll on 2026-09-17, so the sentence is dead. In-sheet writers are `syncParseState()` (crowded warning, cleared on every valid parse), `openEditSheet()` (deck warnings), `runGenerate()` (clear) and `deleteDeck()` (the "Keep at least one deck" warning); the success, "Removed", "deck is gone", share-error and RESET writers fire with the sheet closed, where only `.announce` is visible, so moving the element changes nothing for them. Moving it also takes 32px out of the scroll (`scrollH` 805 to 773 on Edit). **D4:** no in-sheet writer uses the `err` tier (the only `say(.., "err")` calls are `openShare()`'s, with the sheet closed), so the slot's in-sheet contract is `warn`, `ok` and empty; the `.err` rule is inherited but unexercised. The `#scale-parse` CSS comment's claim that `runGenerate()`'s duplicate-scale refusal writes `#scale-msg` is stale (refusals go through `showRefusal()`; `runGenerate()` only clears) and is corrected by lane app with the other stale comment (N-A8).

**N-4 `#scale-refusal` and `#scale-parse` stay (recommended; owner to confirm).** The owner's 2026-09-21 words: a refusal "belongs directly under the field it is about". The 2026-10-13 request says "error messages" should be at the button, so the two sets of owner words disagree about refusals; this plan keeps the older, narrower, field-specific decision (AFK default) and puts the question to the owner. Measured cost of staying: a two-line refusal needs 93.2px from the box top to its last line; the Edit scrollport under the 395px keyboard is 99px today (5.8px spare) and 69px with the slot, so that one refusal case stops fitting; at 336 and 365 it still fits (158/129 before, 128/99 after). A move would cost the `.fieldrow` grouping, `showRefusal()`'s mutual exclusion with `showParse()`, the two `#scale-refusal` e2e tests ("the seed refusal sits above the pan", "the pan does not move when the seed goes bad") and mutants `a_seed_refusal_below_the_pan`, `a_msg_row_not_shared`, and the refusal would compete with warnings for the slot. **Design review 2026-10-13, D8 (UNRESOLVED, owner):** Codex rates the stay a documented regression, not a taste call: with the slot, the seed box plus a two-line refusal (93.2px) no longer fits the 69px Edit scrollport at the 395px keyboard, so a player can see the box and SAVE CHANGES but not why the seed was refused. Its fix is to route refusals into the slot with `aria-describedby` and `aria-invalid` on the box, keep the parse readout by the field, and re-point the two refusal tests and two mutants. AFK cannot overturn the 2026-09-21 owner decision; the lane ships N-4 as written unless the owner picks the move first.

**N-5 `#scale-drawer-status` stays (recommended).** It is the pick-and-drag readout about the pan; the band is sticky so it stays with the pan. `layoutStatus()`'s repeat rule is untouched.

**N-6 two messages stack, warning/error first, notice second (recommended; closed by the consultation).** Alternative: the notice wins and the warning is hidden while it holds; rejected because it hides guidance, which is the request's whole point.

## C. Accessibility and focus

`#scale-msg` keeps its own `aria-live="polite"`. `#scale-layout-state` gains `aria-live="polite" aria-atomic="true"` (N-8, recommended; `aria-atomic` added by D6 because `layoutNoticeText()` appends " The <ring> seats were reset." suffixes and a non-atomic region may read only the appended fragment; `#scale-drawer-status` already carries it): `#scale-sheet` is `aria-modal`, so the page-level `.announce` is outside the dialog (the `#scale-refusal` comment's reason). A live region announces on a DOM change, and `paintLayout()` assigns `layoutNote.textContent` on every paint (drags, picks, parses), which replaces the text node even when the string is unchanged (eng review R8, Codex). The lane guards the assignment (`if (layoutNote.textContent !== note)`), so it speaks on first appearance and between the unsaved, changed and reset sentences, not on every drag end; N-A10 asserts it. The wrapper has no live role (nested regions announce twice). Nothing in the slot is focusable: the `sheetRoute` tab-stop list and `showSheet()`'s focus-on-open (BACK) are unaffected, and `#scale-generate` stays the only full-width primary. Contrast on the sheet ground `#1f1b15` (D6): neutral `#c4bcab` about 9:1, amber `#e3b25c` about 8.6:1, orange `#E27005` about 5.3:1; all pass AA for 12px text (4.5:1), orange is the nearest to the line.

## D. Viewports (prototype, two-line slot, create and Edit pages with ADJUST LAYOUT closed and open)

Scrollport is `.sheetbody` `clientHeight`; footer is surface bottom minus scrollport bottom. Open and closed give identical figures (the drawer is inside the scroll).

| viewport / page | footer before -> after | scrollport before -> after |
|---|---|---|
| 380x800 create | 96 -> 126 | 623 -> 593 |
| 380x800 Edit | 162 -> 192 | 557 -> 527 |
| 390x844 create | 120.6 -> 152.6 (spare room absorbs it) | 642 -> 610 (content shrank 32, so nothing newly scrolls) |
| 390x844 Edit | 162 -> 192 | 601 -> 571 |
| 390x745 create | 96 -> 126 | 568 -> 538 |
| 390x745 Edit | 162 -> 192 | 502 -> 472 |
| 844x390 create | 75 -> 104 | 255 -> 226 |
| 844x390 Edit | 128 -> 157 | 202 -> 173 |

Edit page, 390x745, keyboard up (`b.fakeKeyboard(745 - kb)`; headroom is scrollport minus the 48px seed box, which is what `assertSeedBoxReadable` needs to be non-negative):

| keyboard | scrollport before -> after | headroom before -> after |
|---|---|---|
| 336 | 158 -> 128 | 110 -> 80 |
| 365 | 129 -> 99 | 81 -> 51 |
| 395 | 99 -> 69 | 51 -> 21 |

The primary's top is unchanged at every keyboard (269/240/210 on Edit). `assertSeedBoxReadable` stays as it is and stays green by the measure. Not measured: a real iOS keyboard (owner-device claim).

Growth state (a), a two-line warning plus the notice (54px slot), the state a crowded pan is in once its layout is changed (D5; `variant-keyboard395.png` is this state):

| viewport | scrollport | headroom |
|---|---|---|
| 390x745 Edit, keyboard 336 | 110 | 62 |
| 390x745 Edit, keyboard 365 | 81 | 33 |
| 390x745 Edit, keyboard 395 | 51 | 3 (non-negative; the ring is clipped) |
| 844x390 Edit, no keyboard | 155 | 107 |

The lane reproduces these from its probe (N-A7) and `assertSeedBoxReadable` runs in this state at every `KEYBOARDS` entry.

## E. Risk register

| what breaks | caught today by | new test must catch |
|---|---|---|
| Footer alone exceeds the cap and `.sheetsurf`'s `overflow-y:auto` clips the notice | nothing for the notice; the fold tests cover the primary | N-A5: notice rect inside the viewport and the surface at every `FOLD_VIEWPORTS` size, each `KEYBOARDS` cap, create and Edit, drawer open, `scrollTop` 0 and max |
| Scrollport resizes on a message change (requirement 4) | `a_msg_row_not_shared` family cover the seed row only | N-A6: `clientHeight` identical across empty, 1-line, 2-line notice and warning states, and exactly +18 per extra line in the enumerated growth states |
| "a hairline divides the pinned footer from the scroll" asserts `.sheetbody`'s next sibling is `scale-generate` | that test | re-pointed: the sibling is `scale-guidance`, whose next sibling is `scale-generate` |
| DR1 line 33 `_markupParent` walk, the DR2a order array (begins `scale-layout-toggle`, `scale-layout-state`) | those tests | re-pointed; notice order asserted against the slot |
| `ELEMENT_IDS`: SB-2 demands every served id be looked up by `getElementById` | SB-2 | the wrapper is markup-only and NOT added: the app never looks it up, and an `ELEMENT_IDS` entry without a lookup is what fails SB-2 (an extra markup id fails nothing); `tools/sandbox.js` links `_markupParent` only to ancestors whose id is in `ELEMENT_IDS` (line 363), so the sandbox cannot see the wrapper at all; N-A2 is asserted from the served markup string, as the DR2a order test does, and from the browser DOM in N-A5 (eng review R7, Codex). Every existing id survives |
| `primaryFold` reads `#scale-generate` and `.sheetbody`'s last child only | fold tests | unaffected; stated, not assumed |
| DR2a browser (84) "with and without the notice" and the pan-does-not-move tests rest on the notice and `#scale-msg` being in the scroll | those tests | re-pointed by the app lane (8.3) |
| CI wrap counts differ under fallback fonts | n/a | N-A6 asserts with strings that stay at or under two lines at fallback metrics, and takes the 3-line state from a measured line count, not a fixed string length |
| `panel-fit` | n/a | cannot move: `#settings-panel` is a body-level sibling of the sheet; verdicts unchanged |
| `app_surface_v1` | n/a | checked: the fixture carries none of `scale-msg`, `scale-layout-state` or the notice strings (0 matches); no digest moves, nor `pan_render_v1`, `card_face_v1`, `engine_corpus_v1` |
| FLOORS rows (`app.test.js`, `e2e.test.js`) and the README mutant count (929 now) | `suite_health.py`, `test_readme_currency` | set from CI artifacts only |

## F. Copy

All strings byte-identical. **N-7 (recommended OUT):** the consultation proposes no copy change; the notice already names the primary the page shows. **D7:** the first copy change wanted, if the owner opens N-7, is `SMALL_LABELS`: it is the slot's longest tenant and the only message with no next action, and directly above the primary it reads as a reason not to press it ("Nothing is left out." is the reassurance; a next step is missing). If a later change is wanted, it re-points `dr1Notice` tests, the `S_NOTICE` table, "SD: the layout notice on a seeded deck names SAVE CHANGES" and mutants `d_layout_notice_fork_copy`, `d_seeded_sheet_layout_changed`.

## Decision ledger (AFK auto-picks marked)

| id | decision | recommended |
|---|---|---|
| N-1 | slot above or below the primary | above (AFK pick) |
| N-2 | reserved height | two lines, 36px (AFK pick); one line or three rejected with numbers |
| N-3 | `#scale-msg` | move into the slot (AFK pick) |
| N-4 | `#scale-refusal`, `#scale-parse` | stay (AFK pick); owner may overturn, cost in B |
| N-5 | `#scale-drawer-status` | stay (AFK pick) |
| N-6 | two messages | stacked, warning first (AFK pick) |
| N-7 | copy change | out (AFK pick) |
| N-8 | notice gets `aria-live="polite" aria-atomic="true"`; notice adopts `#scale-msg`'s font and the neutral colour inside the slot | yes (AFK pick; atomic and colour from the design review, D3/D6) |

Design review 2026-10-13 (`/plan-design-review`, AFK auto-picks): D1 all seven passes; D2 outside voices run (Codex and a Claude design subagent); D3 colour split, no gap; D4 `.err` out of the in-sheet contract, stale parse comment corrected; D5 growth kept and measured, hard caps rejected; D6 `aria-atomic`, contrast, empty mechanism; D7 N-7 stays out, SMALL_LABELS recorded; D8 N-4 escalated to the owner, not overturned; D9 colour variables out of scope, 36px derived; D10 consultation provenance recorded.

## Lanes (/swarm)

**Goal.** The notice and every page-state or error message the sheet writes stay on screen with the primary at every viewport and keyboard. **Non-goals.** No change to any `layoutNoticeText()`, `say()` or refusal string; no toasts, timers or animation; no change to the primary's label logic; no script change beyond the one-line notice guard of R8; no sticky footer; no move of `#scale-del-note`; no change to `#settings-panel`, `panelStops()` or `panel-fit`; no engine, data or fixture change; `assertSeedBoxReadable` not lowered.

**Ownership rule (editable-defaults 8.3, verbatim).** Lane app owns, in EVERY test file, EVERY EXISTING test that its behaviour changes (B1..B5) redden or whose purpose they defeat, found by two steps rather than by a list: (1) running the suites at the lane head, and (2) because a green test on the wrong path never fails (the five collision tests), auditing every existing test whose setup selects a chip by index or `chips.length` arithmetic, taps a chip that is already on, scrolls the strip before reading `.chip.on`, or reads `sheetState().primaries` (R9). Bounds: no test is renamed or deleted (so every `# kills:` and `# suite:` header stays true verbatim); every mutant whose `# kills:` names a touched test must still die (the mutant may be re-anchored, never re-targeted to another test); a touched test keeps its purpose (its assertions move to the new behaviour, as the pencil test already does; the five collision tests keep testing the EDIT path by selecting the older custom); the lane report carries a base-to-head inventory of every touched test (title, file:line, what moved, the mutants that name it), which the reviewer verifies against the diff. Lane app ALSO owns every existing MUTANT, whatever its target, that its source changes invalidate (`refresh_mutants.py --check` red at the lane head because the removed-lines run no longer exists verbatim): the run is rewritten against the lane head so the mutant demonstrates the same defect and still dies (R7; `e_panel_moved_into_header` is the known one). Lane e2e owns only the NEW tests it adds plus the new mutants that name them. R3 and R4 stay as the known list, now a FLOOR of what lane app touches, not a boundary; section 8.2 is the current floor (seventeen tests, two files) and ED-A17 the mutant floor.

(Here "lane app" is this plan's lane app, and the e2e tests it adds are its own: there is no separate e2e lane.)

### Lane app (`claude/sheet-guidance-app`, worktree `.claude/worktrees/sheet-guidance-app`)
**Owns.** `index.html` outside the engine regions and the `const DECKS` line (markup: `#scale-guidance` between `.sheetbody` and `#scale-generate` holding `#scale-msg` then `#scale-layout-state`; CSS: the rules in A; the stale `#scale-msg` comment corrected); `tests/app.test.js`, `tests/e2e.test.js`, `tests/drawer_seats.test.js`; `tests/mutants/*` (new `sg_*`, plus any existing mutant the change invalidates); FLOORS rows for the two suites (CI count only); README mutant count. **Reads only.** `src/engine/`, `data/decks.json`, `tools/sandbox.js` (no `ELEMENT_IDS` entry added, see E's `ELEMENT_IDS` row), fixtures, `#settings-panel`.
**Tests first**, then markup/CSS. Likely re-pointed (found by running, not by this list): the `dr1Notice` tests and `S_NOTICE` table (position, not text), DR1 line 33, the DR2a order test (`scale-layout-state` leaves the array; asserted after `.sheetbody` and before `#scale-generate`), "lane F: the drawer hint comes first in the drawer", the hairline test, DR2a browser (84), "the pan does not move when the seed goes bad", "a pan warning on the Edit open does not move the pan", `tests/drawer_seats.test.js` `notice:` reads.
**Acceptance (proofs).**
- N-A1: every `layoutNoticeText()` string, and every `S_NOTICE` row, byte-identical, read through the new position. Proof: the re-pointed `dr1Notice` and SD tests.
- N-A2: markup order is `.sheetbody`, `#scale-guidance` (`#scale-msg`, `#scale-layout-state`), `#scale-generate`, `#scale-delete-row`; both ids are outside `.sheetbody` and `#scale-drawer`. Proof: new app test over the served markup string (`html.indexOf` order and the `#scale-guidance` open/close span; the sandbox's `_markupParent` cannot reach an id outside `ELEMENT_IDS`, R7), plus `parentElement.id` checks in N-A5's browser DOM.
- N-A3: no id removed; `ELEMENT_IDS` unchanged; SB-2 green.
- N-A4: `#scale-layout-state` has `aria-live="polite"` and `aria-atomic="true"`, `#scale-msg` keeps its own, the wrapper has none; nothing in the slot is focusable. Proof: new app test.
- N-A5: visibility proof of E row 1. Proof: new e2e test.
- N-A6: no-resize proof of E row 2 and the enumerated growth, and the slot's top and bottom gaps equal to the computed `--sp-2` at 380x800 AND 844x390 (eng review R1: the landscape media query changes `.sheetsurf`'s gap). Proof: new e2e test.
- N-A7: "with a real keyboard up, the seed box is not clipped by the sheet's own scroller" green unchanged, and `assertSeedBoxReadable` also asserted in growth state (a) at every `KEYBOARDS` entry on Edit; ALSO probed, base and head, on the Pygmy Edit page, whose seed wraps to three rows (`#scale-box` max-height is 3 x 1.3em + 26px = 88.4px, not the 48px table D assumes; eng review R5, Codex): the lane reports visible/height per `KEYBOARDS` entry for both commits. A state that already fails on main is reported as pre-existing, not fixed and not hidden; one that passes on main and fails at the head is a stop; both tables in D reproduced in the lane report from a probe.
- N-A8: stale `#scale-msg` markup comment replaced by one stating where the messages live and why; the `#scale-parse` CSS comment's "runGenerate()'s duplicate-scale refusal" sentence corrected (refusals go through `showRefusal()`); the `showRefusal()` comment's "#scale-msg sits below the pan" corrected (eng review R3).
- N-A10: a repeated `paintLayout()` with an unchanged notice performs no childList mutation on `#scale-layout-state` (MutationObserver in e2e, zero records across ten drag-end paints with the same text), and a changed notice performs exactly one. Proof: new e2e test (R8).
- N-A9: inside the slot the notice computes to `#c4bcab` and `#scale-msg.warn` to `#e3b25c` (D3). Proof: new e2e assertion in N-A5's test.
**New mutants (`# kills:` names the new test).** `sg_notice_back_in_the_scroll` (notice returned to `#scale-layout-zone`; kills N-A2 and N-A5), `sg_msg_left_in_the_scroll` (kills N-A2), `sg_slot_reserved_height_dropped` (`min-height:36px` removed; kills N-A6), `sg_slot_shrinks` (`flex:0 0 auto` dropped; kills N-A6's growth case), `sg_slot_live_dropped` (notice `aria-live` removed; kills N-A4), `sg_slot_below_primary` (kills N-A2), `sg_notice_amber_in_slot` (the colour rule dropped; kills N-A9), `sg_notice_rewritten_every_paint` (the textContent guard dropped; kills N-A10). Mutant count never drops.
**Verify.** `node --test --test-name-pattern 'SG|dr1|DR1|hairline' tests/app.test.js` and the named single e2e tests locally (never the full e2e suite); CI at the head SHA is the evidence.
**Stop.** Any need to change a string, an engine file, a fixture or `#settings-panel`; a re-pointed test that must lose its purpose; a fourth `.sheetsurf` child beyond the wrapper.

### Lane docs (after app merges; `claude/sheet-guidance-docs`)
**Owns.** `docs/plans/2026-10-07-scale-drawer-design-spec.md` (the lines that place `#scale-layout-state`, `#scale-msg` and the wireframe lines for them, each marked "SUPERSEDED 2026-10-13 (this plan)" in the house style, never rewritten); `CLAUDE.md` (one bullet under "Known pitfalls": the page's messages live in `#scale-guidance` except the refusal, parse line, status and hints, which stay by their controls, with the reserved two lines and the enumerated growth states; each sentence cites a test by name: N-A2, N-A5, N-A6). **Reads only.** Everything else.

### Standing gates (refactor-pass-4 section 5, verbatim)
1. CI green at a head SHA verified against the local tip (`gh pr view <n> --json state,headRefOid`).
2. Independent reviewer PASS or PASS_WITH_NITS at that SHA, briefed with this plan's lane text verbatim (no added rules).
3. `python3 tools/refresh_mutants.py --check` green; mutant count reconciled in the PR (added, replaced `old -> new`, re-pointed - each named).
4. `panel-fit` verdicts unchanged (real and fallback).
5. `inline_engine.py --check`, `sync_decks.py --check`, `validate.py`, `boot_sim.js` green; no fixture digest moved; `data/decks.json` untouched.
6. FLOORS rows moved only as section 4 allows, only to CI's count for the branch; README counts within `test_readme_currency`'s band.
7. Rebase procedure of the house format (§20.24 of the drawer plan): fetch + rebase; both `--check`s; `refresh_mutants.py` committed on its own; own FLOORS rows + README counts from main's artifacts; push and wait for CI.

**Merge order:** app, then docs. **Estimates:** app ~1 day human / ~60 min CC; docs ~2 h human / ~15 min CC.

VERDICT: SMALL

## Design review 2026-10-13: required outputs

**NOT in scope (decided here, not forgotten).** Colour variables for the sheet (Codex finding 4): the whole app uses hex literals; a token pass is the `TODOS.md` DESIGN.md entry, not this lane. A compact keyboard layout that drops the empty reserve and moves DELETE into the scroll (Codex finding 2): it reintroduces the resize-while-typing the slot exists to remove and breaks the delete-row non-goal; rejected with reasons in A. Any string change (N-7). Routing refusals into the slot (N-4): owner's call, see Unresolved Decisions.

**What already exists.** `#scale-msg` with its three tiers and `aria-live`; `#scale-layout-state` with `hidden` and `layoutNoticeText()`; `#scale-drawer-status` with `aria-live aria-atomic`; `#scale-del-note` pinned under DELETE; `.sheetsurf` flex column with the `.sheetbody` hairline; the fold and keyboard e2e harness (`FOLD_VIEWPORTS`, `KEYBOARDS`, `b.fakeKeyboard`, `assertSeedBoxReadable`, `primaryFold`); `#scale-parse:empty, #scale-refusal:empty{display:none}`.

**TODOS.md.** One entry added: `SMALL_LABELS` copy has no next action (D7). The DESIGN.md entry already covers colour tokens; nothing added for it.

### Implementation Tasks

- [ ] **T1 (P1, human: ~1 day / CC: ~60min)** — scale sheet — Lane app: the `#scale-guidance` slot, colour split, `aria-atomic`, growth-state measurements, N-A1..N-A9, seven `sg_*` mutants
  - Surfaced by: Pass 1, 2, 3 (D3, D4, D5, D6)
  - Files: `index.html` (markup, CSS, two comments), `tests/app.test.js`, `tests/e2e.test.js`, `tests/drawer_seats.test.js`, `tests/mutants/sg_*`
  - Verify: `node --test --test-name-pattern 'SG|dr1|DR1|hairline' tests/app.test.js`; the named single e2e tests; CI green at the head SHA; `python3 tools/refresh_mutants.py --check`
- [ ] **T2 (P1, human: ~2h / CC: ~15min)** — docs — Lane docs: drawer spec SUPERSEDED marks and the CLAUDE.md pitfall bullet, each sentence citing N-A2, N-A5, N-A6
  - Surfaced by: Lanes section (unchanged by review)
  - Files: `docs/plans/2026-10-07-scale-drawer-design-spec.md`, `CLAUDE.md`
  - Verify: reviewer re-verifies every sentence against the named tests
- [ ] **T3 (P2, human: ~2h / CC: ~20min)** — scale sheet — Owner decision N-4: route `#scale-refusal` into the slot with `aria-describedby`/`aria-invalid`, or keep it by the field and accept the 395px-keyboard case
  - Surfaced by: Pass 5 (D8, Codex finding 3)
  - Files: `index.html`, `tests/e2e.test.js`, mutants `a_seed_refusal_below_the_pan`, `a_msg_row_not_shared`
  - Verify: the two refusal e2e tests re-pointed; refusal rect inside the viewport at the 395px keyboard
- [ ] **T4 (P3, human: ~1h / CC: ~10min)** — copy — Give `SMALL_LABELS` a next action
  - Surfaced by: Pass 4 (D7)
  - Files: `src/engine/*.js` REASONS, `tests/fixtures/engine_corpus_v1.json`, the `dr1Notice`/`S_NOTICE` tests
  - Verify: `tools/regen_engine_corpus.js --check` after the change

_No new tasks from Pass 6 (consistency) or Pass 7 (process)._

### Completion Summary

```
Design review: docs/plans/2026-10-13-sheet-guidance.md
Before: 8/10 (Step 0)   After: 8/10 (lowest pass: hierarchy/risk, held at 8 by N-4 open)
Pass scores before -> after: IA 7->9, States 7->9, A11y 7->9, Copy 8->9,
  Hierarchy/risk 6->8, Consistency 8->8, Process 7->8
Decisions made: 10 (D1-D10, all AFK auto-picks)   Unresolved: 1 (N-4 / D8)
Outside voices: Codex completed (4 findings), Claude design subagent 7/10
```

### Unresolved Decisions

- **N-4 / D8 (owner):** `#scale-refusal` stays by the seed box (2026-09-21 decision) or moves into the slot (2026-10-13 words "error messages ... at the button", Codex finding 3). Measured: with the slot, a two-line refusal no longer fits the Edit scrollport under the 395px keyboard (93.2px needed, 69px available); it fits at 336 and 365. The lane ships "stays" unless the owner picks the move first.

### Approved Mockups

| Screen/Section | Mockup Path | Direction | Notes |
|---|---|---|---|
| Edit sheet, slot empty, 380x800 | `~/.gstack/projects/raywu-handpan-cards/designs/sheet-guidance-slot-20261013/variant-empty.png` | prototype screenshot | 36px band between hairline and SAVE CHANGES |
| Edit sheet, notice only | `.../variant-notice.png` | prototype screenshot | one line above the button; colour becomes neutral under D3 (not re-shot) |
| Edit sheet, warning + notice | `.../variant-warn.png` | prototype screenshot | growth state (a), 54px slot, scrollport 509 |
| Edit sheet, 390x745, 395px keyboard | `.../variant-keyboard395.png` | prototype screenshot | seed box, slot and button all visible, scrollport 51 |

`$D variants` could not run (no OpenAI key; owner-only setup), so these are `$B` screenshots of the real app with the slot prototyped in the DOM.

## Eng review 2026-10-13 (`/plan-eng-review`, AFK auto-picks marked)

### Scope challenge

1. **Real problem?** Yes. The owner stated it: the notice and the sheet's messages scroll away under `.sheetbody`'s own scroller and the fold viewports, so a player can press SAVE CHANGES without having read "Layout not saved yet. SAVE CHANGES keeps it."
2. **Smallest change?** Yes. One markup move (two existing elements into one new wrapper), three CSS rules, one attribute. A sticky footer, a toast and a second primary were rejected in A with numbers.
3. **Deletion?** None available: both elements already exist; the change is position, not count. The `.sheetbody` hairline rule, the `:empty` rules and `say()` stay.
4. **Reuse?** Yes: the slot reuses `#scale-msg`'s font and colours and the notice keeps `.sheethint` outside the slot's override; no new component family.
5. **Speculative parts?** The enumerated growth states (two messages, three lines) are driven by real producers (`openEditSheet` writes a warning while the notice stands), not by hypothetical copy. The 36px reservation is derived, not guessed.
6. **Over-testing?** Seven mutants for nine acceptance items, each mutant naming one test; no mutant tests the same removal twice. Proportionate.
7. **Complexity gate (8+ files: `index.html`, three test files, seven mutants, `suite_health.py`, README, the drawer spec, `CLAUDE.md`).** D2 fired (below). The smaller arrangement would be one lane and no docs lane; the original two-lane shape stands because the docs lane edits files whose claims a reviewer must verify against merged code (feedback_docs_lane_cites_tests), which needs the app merge first.

### Findings

**Section 1, Architecture**

- `[HIGH] (confidence: 8/10) index.html:902-903 — the plan's tuck margin assumes `.sheetsurf`'s gap is `--sp-4`, and under `@media (max-height:520px)` it is not.` The surface gap becomes `var(--sp-3)` (9px) and the tokens become 3/6/9/14, so `margin-block:calc(var(--sp-2) - var(--sp-4))` evaluates to -8px against a 9px gap: 1px between the hairline, the slot and the button at 844x390, the one landscape entry in `FOLD_VIEWPORTS`. Table D's 844x390 row (29px against 30) is consistent with the prototype not modelling this. **Remedy (adopted, R1):** inside that media query add `#scale-guidance{margin-block:calc(var(--sp-2) - var(--sp-3))}`, so the slot sits `--sp-2` (6px) from both neighbours at every breakpoint; N-A6 asserts the slot's top and bottom gaps equal the computed `--sp-2` at 844x390 as well as 380x800.
- `[LOW] (confidence: 9/10) docs/plans/2026-10-13-sheet-guidance.md, E row 5 — "SB-2 would fail" overstates SB-2.` `tests/app.test.js` SB-2 checks that every `ELEMENT_IDS` entry is in the markup AND looked up by the app; an extra markup id that is NOT in `ELEMENT_IDS` fails nothing. The wrapper is still correctly left out (the app never looks it up, so adding it to the list is what would fail). **Remedy (R2):** the row now reads "not added: the app never looks it up, and an `ELEMENT_IDS` entry without a lookup fails SB-2".
- `[LOW] (confidence: 9/10) Lane app "Reads only" — "`tools/sandbox.js` (no `ELEMENT_IDS` entry added, see E's `ELEMENT_IDS` row)" points at a row E does not have.` The relevant row is the `ELEMENT_IDS` row. **Remedy (R2):** reference corrected.

**Section 2, Code quality**

- `[LOW] (confidence: 8/10) index.html:8943 — a third stale comment.` N-A8 names two (the markup comment above `#scale-msg` and the `#scale-parse` CSS comment); the `showRefusal()` comment also says "#scale-msg sits below the pan". **Remedy (R3):** N-A8 covers all three.
- Checked and clean: `say()` (8945) writes by reference and does not care where `msgLine` sits; no `scrollIntoView` call targets `#scale-msg` or the notice (9083, 9102-9103 target the input, the layout zone and the drawer button); `#scale-guidance #scale-layout-state` (two ids) out-specifies both `#scale-layout-state{color}` (989) and `.sheethint`, and sets no `display`, so the `hidden` attribute keeps working; the `.sheetbody` hairline stays above the slot; `#scale-del-note`'s `:empty{display:none}` is untouched. The `_markupParent` walk in `tools/sandbox.js` (89) follows the served markup but links only ids in `ELEMENT_IDS` (363), so the wrapper is invisible to the sandbox (corrected by Codex, R7; the DR1 line-33 walk still passes because `#scale-msg`'s linked parent becomes `#scale-sheet`, which is not the drawer).

**Section 3, Tests**

Coverage of the change, by producer:

```
producer                       -> surface              -> test that sees the new position
layoutNoticeText()/paintLayout -> #scale-layout-state  -> dr1Notice tests, S_NOTICE, DR2a order (re-pointed), N-A2, N-A5
say() warn/ok (openEditSheet)  -> #scale-msg           -> "a pan warning on the Edit open does not move the pan" (re-pointed), N-A6 growth (a)
say() err (save refusals)      -> #scale-msg.err       -> N-A6 (one-line err state), N-A9 colour
showRefusal()/showParse()      -> #scale-refusal/parse -> UNCHANGED (stay in .sheetbody, N-4)
viewport/keyboard              -> whole slot           -> N-A5 (FOLD_VIEWPORTS x KEYBOARDS x scrollTop 0/max), N-A7, hairline test (re-pointed)
                                                          landscape 844x390 gap: N-A6 (added, R1)
```

REGRESSION RULE: a test that goes red at the lane head is re-pointed to the new position and keeps its assertion; it is never deleted, renamed or weakened, and every mutant whose `# kills:` names it must still die (the ownership rule above). Test plan artifact: `~/.gstack/projects/raywu-handpan-cards/ray-claude-sheet-guidance-plan-eng-review-test-plan-20261013.md`.

- `[LOW] (confidence: 7/10) N-A6 "exactly +18 per extra line" is a real-font number.` CI serves fallback fonts (ci-harness-blocks-web-fonts), where Nunito Sans 12px/1.5 still gives 18px lines because line-height is set in the stylesheet, not by the font; the risk is the WRAP COUNT, not the line height, and E row 8 already takes the three-line state from a measured line count. No change; stated so the lane does not "fix" it.

**Section 4, Performance**

Nothing measurable: one extra flex item, no script change, no layout thrash (the slot reserves its height, so message changes do not resize the scrollport; that is the point, and N-A6 asserts it).

### Decision ledger (eng review)

- **R1 (from F1):** adopt the landscape margin override and the 844x390 gap assertion. Plan text in A and N-A6 updated below. Recorded as an eng-review remedy, not a new owner decision.
- **R2 (F2, F3):** wording corrections in E and the lane's "Reads only" line.
- **R3 (F4):** N-A8 names three comments.
- **R4 (N-A6 fallback-font note):** no plan change; note recorded.
- **D1 (AFK auto-pick):** `/office-hours` prerequisite skipped; the owner stated the problem and the scope.
- **D2 (AFK auto-pick, complexity gate):** Original arrangement (lane app then lane docs) over a single lane. Reason: the docs lane's sentences must be verified against MERGED code by a fresh reviewer (feedback_docs_lane_cites_tests); folding them into the app lane makes the same reviewer verify both and has cost two FAILs before (#299, #301).
- **D3 (AFK auto-pick, TODOS):** B, skip: nothing new to add; "SMALL_LABELS has no next action" already covers the only follow-up the review surfaced.
- **D4 (AFK auto-pick, Next steps):** C, ready to implement via `/swarm` with the lane text above.

### Outside voice (Codex, gpt-6-astra, read-only, `codex exec`, 2026-10-13)

OUTSIDE_STATUS: completed provider=codex host=claude

```
CODEX SAYS (plan review — outside voice):
[HIGH] (confidence: 10/10) docs/plans/2026-10-13-sheet-guidance.md:82 — The keyboard headroom calculation assumes a 48px seed field, but index.html:788 permits three rows totaling 88.4px, which cannot fit the reported 69px or 51px scrollports. Recalculate using the actual textarea rectangle and require keyboard visibility tests with real multiline crowded seeds.
[MEDIUM] (confidence: 10/10) docs/plans/2026-10-13-sheet-guidance.md:34 — The claimed exclusion between the delete refusal and delete note is false: after a refused deletion, another DELETE click writes `delNote` without clearing `msgLine` (index.html:10213). Include the refusal-then-rearm sequence in footer visibility and height tests, and accommodate both messages.
[MEDIUM] (confidence: 10/10) docs/plans/2026-10-13-sheet-guidance.md:257 — The sandbox cannot reach the unregistered wrapper through `_markupParent`, because tools/sandbox.js:363 selects only ancestors present in `els`, skipping `scale-guidance`. Assert wrapper structure from parsed markup or browser DOM while retaining the correct `ELEMENT_IDS` exclusion.
[MEDIUM] (confidence: 9/10) docs/plans/2026-10-13-sheet-guidance.md:65 — The promised change-only live announcements lack an implementation guard: index.html:9057 unconditionally replaces notice text during picks, parsing and repeated layout updates. Guard the assignment against unchanged text and test repeated updates, since the proposed attribute-removal mutant does not cover this behavior.
[MEDIUM] (confidence: 10/10) docs/plans/2026-10-13-sheet-guidance.md:22 — The "longest" notice accounts for two reset suffixes, but index.html:9018 iterates all three rings—rim, inner and bottom—so its sizing inventory omits a supported longer notice. Measure and test simultaneous resets of all three stored rings, including their combination with warnings under the keyboard.
no finding — SB-2 exclusion, listed DOM-order/hairline test updates, and the proposed hidden, `:empty` and colour-specificity handling.
VERDICT: REVISE — The plan underestimates supported content heights and relies on incorrect sandbox and announcement assumptions.
```

**Cross-model tension.** All five verified against the code and adopted (D5, AFK auto-pick: adopt each verified finding over "note only"):
- R5 (Codex HIGH): `#scale-box` max-height 88.4px confirmed at index.html:788; the shipped keyboard test types Amara (one row). N-A7 now probes the Pygmy Edit page base and head; pre-existing failures are reported, not hidden. Table D's 48px rows stay as the one-row case.
- R6 (Codex MEDIUM 1): the delete refusal and `#scale-del-note` coexist after refuse-then-re-arm (`deleteDeck()` 10014, `delBtn.onclick` 10213); the exclusion sentence in A is withdrawn and the sequence joins N-A6.
- R7 (Codex MEDIUM 2): `tools/sandbox.js:363` confirmed; N-A2 moves to the markup string and the browser DOM, and my own "checked and clean" line is corrected.
- R8 (Codex MEDIUM 3): `paintLayout()` 9057 confirmed unconditional; one-line guard, N-A10 and mutant `sg_notice_rewritten_every_paint` added; the non-goal "no script change" narrowed to allow it.
- R9 (Codex MEDIUM 4): `LAYOUT_RINGS` 9180 is three rings; the longest notice is three lines at 380px and becomes growth state (e).
Codex found nothing in the SB-2 exclusion, the listed test re-points, or the `hidden`/`:empty`/specificity handling, which agrees with Section 2.

- **D5 (AFK auto-pick, cross-model):** adopt all five Codex findings as R5-R9.

Approval readiness: PASS

## Eng review 2026-10-13: required outputs

**NOT in scope.** Copy changes (N-7), `#scale-refusal`/`#scale-parse` placement (N-4, owner), `#scale-drawer-status` (N-5), `#scale-del-note`, `#settings-panel` and `panel-fit`, engine, data and fixtures, a sticky footer, toasts, animation, colour variables (D9).

**What already exists.** Everything the slot holds and reads: `#scale-msg` (`say()`, three tiers, `aria-live`), `#scale-layout-state` (`layoutNoticeText()`, `hidden`), the `.sheetsurf` flex column with the `.sheetbody` hairline, the fold and keyboard e2e harness (`FOLD_VIEWPORTS`, `KEYBOARDS`, `assertSeedBoxReadable`), the mutant harness, the served-markup order tests.

**Diagram (surface, after).**
```
.sheetsurf (100dvh flex column, gap --sp-4; --sp-3 under max-height:520px)
  .sheethead
  .sheetbody (scrolls; hairline at its foot)   <- #scale-parse, #scale-refusal, pan, drawer, degrees, swatches
  #scale-guidance (flex:0 0 auto; min-height 36px; margin-block tucks to --sp-2 at every breakpoint, R1)
      #scale-msg            (say(): warn/ok/err)
      #scale-layout-state   (notice; aria-live polite atomic; textContent guarded, R8)
  #scale-generate (SAVE CHANGES / GENERATE CARDS)
  #scale-delete-row (#scale-del-note stays here)
```

**Failure modes.**
| failure | caught by |
|---|---|
| slot clipped by `.sheetsurf` overflow at a fold or keyboard | N-A5 |
| scrollport resizes on a message change | N-A6 |
| landscape tuck leaves 1px gaps | N-A6 at 844x390 (R1) |
| notice re-announced on every drag end | N-A10 (R8) |
| three-suffix notice or refuse-then-re-arm not modelled | N-A6 states (e) and the re-arm sequence (R6, R9) |
| three-row seed under the 395px keyboard unreadable | N-A7 probe, base and head (R5); pre-existing on main is reported, a new failure is a stop |
| wrapper asserted through a sandbox link that does not exist | N-A2 over the markup string (R7) |
No critical gap: every failure mode above has a named test.

**Worktree parallelization.** Two lanes, serial: lane docs depends on lane app's merge (its sentences cite N-A2/N-A5/N-A6 by name and a reviewer verifies them against merged code). No file is shared between the lanes.

| lane | depends on | files |
|---|---|---|
| app | nothing | `index.html` (outside generated regions), `tests/app.test.js`, `tests/e2e.test.js`, `tests/drawer_seats.test.js`, `tests/mutants/sg_*` and any re-anchored mutant, `tests/suite_health.py` FLOORS, README mutant count |
| docs | app merged | `docs/plans/2026-10-07-scale-drawer-design-spec.md`, `CLAUDE.md` |

### Implementation Tasks (eng review)
- [ ] E1 lane app: tests first (N-A2, N-A4, N-A5, N-A6 incl. 844x390 gaps, states (e) and refuse-then-re-arm, N-A9, N-A10; N-A7 probe base and head on Pygmy Edit), then markup, CSS incl. the `max-height:520px` override, the notice guard, three comment corrections; eight `sg_*` mutants; FLOORS and README from CI.
- [ ] E2 lane docs: drawer spec SUPERSEDED marks; `CLAUDE.md` pitfall bullet citing N-A2, N-A5, N-A6, N-A10.
- [ ] T3 (owner): N-4 / D8 `#scale-refusal` placement.
- [ ] T4 (owner): N-7 copy, SMALL_LABELS next action (TODOS).

Tasks JSONL: `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-20261013.jsonl`.

**Unresolved decisions.** N-4 / D8 only (owner). R5's Pygmy keyboard probe may surface a pre-existing failure at 395px; that is reported to the owner, not decided by the lane.

**Completion summary.** Four own findings (one HIGH: the landscape gap override), five Codex findings all verified and adopted, nine remedies R1-R9, one new acceptance item (N-A10), one new mutant, no scope growth beyond a one-line guard. Lake Score: 8/10 (the plan was prototype-measured and test-anchored; it under-counted content heights in three places, which the outside voice caught).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO | owner-directed scope | not needed: the owner stated problem and placement | 0 | not run | - |
| Outside | design and eng reviews | second model on the plan | 2 | completed | design: 4 (dispositioned); eng: 5 (all adopted, R5-R9) |
| Eng | `/plan-eng-review` 2026-10-13 | lock the execution plan | 1 | done | 4 own (1 HIGH, 3 LOW) + 5 Codex, all remedied; Approval readiness: PASS |
| Design | `/plan-design-review` 2026-10-13 | UI placement | 1 | done | 8/10, 10 decisions, 1 unresolved |
| DX | - | no developer-facing surface | 0 | not run | - |

OUTSIDE COVERAGE: design voices completed (codex + in-host subagent); eng voice completed (codex, gpt-6-astra, read-only).

CROSS-MODEL: Codex REVISE on five content-height and assumption findings; all five verified in the code and adopted (R5-R9); no disagreement remains.

VERDICT: APPROVED for execution via `/swarm` (lane app, then lane docs). Under AFK the lane ships N-4 as "stays"; the owner may overturn it on return (T3).

**UNRESOLVED DECISIONS:**
- N-4 / D8: `#scale-refusal` placement (owner).
