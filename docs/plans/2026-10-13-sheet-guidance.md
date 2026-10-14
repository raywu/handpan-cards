# Plan: the sheet's guidance sits with SAVE CHANGES

Planned against `main` 49b895c (branch base 6f830c0 adds only the prompt file). Owner request, 2026-10-13, verbatim:

> "Layout not saved yet. SAVE CHANGES keeps it." And other instructions or error messages should be right above or below the "Save Changes" button on the drawer, so that the guidance to user is visible and never hidden due to viewport size and scrolling. Consult /frontend-design:frontend-design for placement and usability.

**VERDICT: SMALL.** Recommended design: one reserved two-line slot, `#scale-guidance`, between `.sheetbody` and `#scale-generate`, holding `#scale-msg` (warning or error first) and `#scale-layout-state` (notice second, nearest the button it names). Everything else stays where it is, `#scale-refusal` stays under the seed box by the owner's 2026-09-21 decision (a flag for the owner is in N-4), and no string, engine file, fixture or `#settings-panel` rule changes.

Measured in gstack `$B` (headless Chromium) with fonts from `tools/fonts/` injected. "Prototype" means the slot was injected by script, `index.html` untouched. CI blocks web fonts, so wrap counts there can differ (E).

## A. The slot

**Design consultation (`frontend-design:frontend-design`, invoked with a one-slot brief; its verdict, adopted as this plan's own).** Slot ABOVE the primary, left-aligned like the sheet's other text, two lines reserved, existing tokens only, no motion. Reasons: a message is read before the action it names; below the primary is already the delete row's (`#scale-del-note` explains DELETE) and a second note region there would stack two unrelated notes under the thumb on Edit. Stack warning/error first, notice second (fixed order, no priority contest): the notice is the one that names the button, so it hugs it. One type system: the notice drops to `#scale-msg`'s 12px/1.5 Nunito Sans (Bitter 11.5 beside Nunito 12 reads as two voices) and keeps its amber `#e3b25c`; the `#scale-msg` tiers are inherited, not redefined. No copy change proposed.

**N-1 above (recommended, closed by the consultation).** The footer today is `.sheetsurf`'s flex column: `.sheethead`, `.sheetbody` (`overflow-y:auto`, `border-bottom` hairline), `#scale-generate`, `#scale-delete-row` (hidden on create). `.sheetsurf` has `gap: var(--sp-4)` and `overflow-y:auto` as the backstop.

**N-2 reserved height: two lines, 36px (recommended).** Longest strings at 336px content width (380px viewport minus 2 x 22px padding), real fonts:

| string | lines |
|---|---|
| "Layout not saved yet. SAVE CHANGES keeps it." (and GENERATE CARDS) | 1 |
| longest `layoutNoticeText()`: notice plus both " seats were reset." suffixes | 2 |
| `NO_THIRDS` | 1 |
| `SMALL_LABELS` (the longest single `say()` string in the sheet) | 2 |
| `NO_THIRDS` + `SMALL_LABELS` joined by `openEditSheet()` | 3 |
| "Keep at least one deck. Add a scale before deleting <name>." | 2 (3 with a 40-char name) |

CSS, all existing rules: `#scale-guidance{flex:0 0 auto; min-height:36px; display:flex; flex-direction:column; justify-content:flex-end; margin-block:calc(var(--sp-2) - var(--sp-4))}`; the negative margins tuck the slot to `--sp-2` from the hairline and from the button instead of two full `--sp-4` gaps (22px each on a phone); `#scale-guidance #scale-msg{min-height:0}` (the wrapper owns the reservation; `#scale-msg`'s own 1.5em floor would leave a dead line above a lone notice); `#scale-guidance #scale-layout-state{font:400 12px/1.5 "Nunito Sans"}` (colour stays `#e3b25c`). `flex:0 0 auto` is load-bearing: without it the slot is a shrinkable flex item and a three-line message spills over the button (prototype: `msgLine` 54px in a 36px box, scrollport unchanged at 99). Measured with it: scrollport 99px with a 1-line and a 2-line warning, 81px with a 3-line one, 99px again once cleared.

Cost of two lines is 30px off every scrollport (36 minus the 6px the tuck gives back; prototype). Alternatives: one line (18px) costs 12px but SMALL_LABELS then grows the slot while the player types; three lines (54px) costs 48px and leaves about 3px of Edit headroom at the 395px keyboard (estimate). Two lines holds every single message and the notice alone with no resize.

**Growth beyond two lines is allowed in exactly these states, and nowhere else (requirement 4).** Total text over two lines: (a) a two-line warning plus a one-line notice (a crowded pan whose layout the player has changed), (b) joined warnings (three lines) at Edit open, (c) their combinations with a notice, (d) the delete refusal with a long deck name. Each adds 18px per line. Why acceptable: (b) and (d) happen with no finger on the scroller. (a) fires on the pointer-up that ends the first layout change (`paintLayout()` writes the notice there, never mid-drag); the scrollport shrinks 18px at its bottom edge and the content above does not move unless the body is scrolled to its maximum. When the body does not overflow (390x844, create, closed) the primary moves 18px instead: the one residual jump, crowded pans only. N-6 records the owner's alternative (one message wins) if they prefer none.

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

**N-3 move `#scale-msg` (recommended).** Its markup comment says it sits "Above the control row, so the soft keyboard never covers it"; the control row moved into the scroll on 2026-09-17, so the sentence is dead. In-sheet writers are `syncParseState()` (crowded warning, cleared on every valid parse), `openEditSheet()` (deck warnings), `runGenerate()` (clear) and `deleteDeck()` (the "Keep at least one deck" warning); the success, "Removed", "deck is gone", share-error and RESET writers fire with the sheet closed, where only `.announce` is visible, so moving the element changes nothing for them. Moving it also takes 32px out of the scroll (`scrollH` 805 to 773 on Edit).

**N-4 `#scale-refusal` and `#scale-parse` stay (recommended; owner to confirm).** The owner's 2026-09-21 words: a refusal "belongs directly under the field it is about". The 2026-10-13 request says "error messages" should be at the button, so the two sets of owner words disagree about refusals; this plan keeps the older, narrower, field-specific decision (AFK default) and puts the question to the owner. Measured cost of staying: a two-line refusal needs 93.2px from the box top to its last line; the Edit scrollport under the 395px keyboard is 99px today (5.8px spare) and 69px with the slot, so that one refusal case stops fitting; at 336 and 365 it still fits (158/129 before, 128/99 after). A move would cost the `.fieldrow` grouping, `showRefusal()`'s mutual exclusion with `showParse()`, the two `#scale-refusal` e2e tests ("the seed refusal sits above the pan", "the pan does not move when the seed goes bad") and mutants `a_seed_refusal_below_the_pan`, `a_msg_row_not_shared`, and the refusal would compete with warnings for the slot.

**N-5 `#scale-drawer-status` stays (recommended).** It is the pick-and-drag readout about the pan; the band is sticky so it stays with the pan. `layoutStatus()`'s repeat rule is untouched.

**N-6 two messages stack, warning/error first, notice second (recommended; closed by the consultation).** Alternative: the notice wins and the warning is hidden while it holds; rejected because it hides guidance, which is the request's whole point.

## C. Accessibility and focus

`#scale-msg` keeps its own `aria-live="polite"`. `#scale-layout-state` gains `aria-live="polite"` (N-8, recommended): `#scale-sheet` is `aria-modal`, so the page-level `.announce` is outside the dialog (the `#scale-refusal` comment's reason). A live region announces only on a text change, so it speaks on first appearance and between the unsaved, changed and reset sentences, not on every drag end. The wrapper has no live role (nested regions announce twice). Nothing in the slot is focusable: the `sheetRoute` tab-stop list and `showSheet()`'s focus-on-open (BACK) are unaffected, and `#scale-generate` stays the only full-width primary.

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

## E. Risk register

| what breaks | caught today by | new test must catch |
|---|---|---|
| Footer alone exceeds the cap and `.sheetsurf`'s `overflow-y:auto` clips the notice | nothing for the notice; the fold tests cover the primary | N-A5: notice rect inside the viewport and the surface at every `FOLD_VIEWPORTS` size, each `KEYBOARDS` cap, create and Edit, drawer open, `scrollTop` 0 and max |
| Scrollport resizes on a message change (requirement 4) | `a_msg_row_not_shared` family cover the seed row only | N-A6: `clientHeight` identical across empty, 1-line, 2-line notice and warning states, and exactly +18 per extra line in the enumerated growth states |
| "a hairline divides the pinned footer from the scroll" asserts `.sheetbody`'s next sibling is `scale-generate` | that test | re-pointed: the sibling is `scale-guidance`, whose next sibling is `scale-generate` |
| DR1 line 33 `_markupParent` walk, the DR2a order array (begins `scale-layout-toggle`, `scale-layout-state`) | those tests | re-pointed; notice order asserted against the slot |
| `ELEMENT_IDS`: SB-2 demands every served id be looked up by `getElementById` | SB-2 | the wrapper is markup-only and NOT added (SB-2 would fail); unit tests reach it through `_markupParent` of `#scale-msg`. Every existing id survives |
| `primaryFold` reads `#scale-generate` and `.sheetbody`'s last child only | fold tests | unaffected; stated, not assumed |
| DR2a browser (84) "with and without the notice" and the pan-does-not-move tests rest on the notice and `#scale-msg` being in the scroll | those tests | re-pointed by the app lane (8.3) |
| CI wrap counts differ under fallback fonts | n/a | N-A6 asserts with strings that stay at or under two lines at fallback metrics, and takes the 3-line state from a measured line count, not a fixed string length |
| `panel-fit` | n/a | cannot move: `#settings-panel` is a body-level sibling of the sheet; verdicts unchanged |
| `app_surface_v1` | n/a | checked: the fixture carries none of `scale-msg`, `scale-layout-state` or the notice strings (0 matches); no digest moves, nor `pan_render_v1`, `card_face_v1`, `engine_corpus_v1` |
| FLOORS rows (`app.test.js`, `e2e.test.js`) and the README mutant count (929 now) | `suite_health.py`, `test_readme_currency` | set from CI artifacts only |

## F. Copy

All strings byte-identical. **N-7 (recommended OUT):** the consultation proposes no copy change; the notice already names the primary the page shows. If a later change is wanted, it re-points `dr1Notice` tests, the `S_NOTICE` table, "SD: the layout notice on a seeded deck names SAVE CHANGES" and mutants `d_layout_notice_fork_copy`, `d_seeded_sheet_layout_changed`.

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
| N-8 | notice gets `aria-live="polite"`; notice adopts `#scale-msg`'s font inside the slot | yes (AFK pick) |

## Lanes (/swarm)

**Goal.** The notice and every page-state or error message the sheet writes stay on screen with the primary at every viewport and keyboard. **Non-goals.** No change to any `layoutNoticeText()`, `say()` or refusal string; no toasts, timers or animation; no change to the primary's label logic; no sticky footer; no move of `#scale-del-note`; no change to `#settings-panel`, `panelStops()` or `panel-fit`; no engine, data or fixture change; `assertSeedBoxReadable` not lowered.

**Ownership rule (editable-defaults 8.3, verbatim).** Lane app owns, in EVERY test file, EVERY EXISTING test that its behaviour changes (B1..B5) redden or whose purpose they defeat, found by two steps rather than by a list: (1) running the suites at the lane head, and (2) because a green test on the wrong path never fails (the five collision tests), auditing every existing test whose setup selects a chip by index or `chips.length` arithmetic, taps a chip that is already on, scrolls the strip before reading `.chip.on`, or reads `sheetState().primaries` (R9). Bounds: no test is renamed or deleted (so every `# kills:` and `# suite:` header stays true verbatim); every mutant whose `# kills:` names a touched test must still die (the mutant may be re-anchored, never re-targeted to another test); a touched test keeps its purpose (its assertions move to the new behaviour, as the pencil test already does; the five collision tests keep testing the EDIT path by selecting the older custom); the lane report carries a base-to-head inventory of every touched test (title, file:line, what moved, the mutants that name it), which the reviewer verifies against the diff. Lane app ALSO owns every existing MUTANT, whatever its target, that its source changes invalidate (`refresh_mutants.py --check` red at the lane head because the removed-lines run no longer exists verbatim): the run is rewritten against the lane head so the mutant demonstrates the same defect and still dies (R7; `e_panel_moved_into_header` is the known one). Lane e2e owns only the NEW tests it adds plus the new mutants that name them. R3 and R4 stay as the known list, now a FLOOR of what lane app touches, not a boundary; section 8.2 is the current floor (seventeen tests, two files) and ED-A17 the mutant floor.

(Here "lane app" is this plan's lane app, and the e2e tests it adds are its own: there is no separate e2e lane.)

### Lane app (`claude/sheet-guidance-app`, worktree `.claude/worktrees/sheet-guidance-app`)
**Owns.** `index.html` outside the engine regions and the `const DECKS` line (markup: `#scale-guidance` between `.sheetbody` and `#scale-generate` holding `#scale-msg` then `#scale-layout-state`; CSS: the rules in A; the stale `#scale-msg` comment corrected); `tests/app.test.js`, `tests/e2e.test.js`, `tests/drawer_seats.test.js`; `tests/mutants/*` (new `sg_*`, plus any existing mutant the change invalidates); FLOORS rows for the two suites (CI count only); README mutant count. **Reads only.** `src/engine/`, `data/decks.json`, `tools/sandbox.js` (no entry added, see E), fixtures, `#settings-panel`.
**Tests first**, then markup/CSS. Likely re-pointed (found by running, not by this list): the `dr1Notice` tests and `S_NOTICE` table (position, not text), DR1 line 33, the DR2a order test (`scale-layout-state` leaves the array; asserted after `.sheetbody` and before `#scale-generate`), "lane F: the drawer hint comes first in the drawer", the hairline test, DR2a browser (84), "the pan does not move when the seed goes bad", "a pan warning on the Edit open does not move the pan", `tests/drawer_seats.test.js` `notice:` reads.
**Acceptance (proofs).**
- N-A1: every `layoutNoticeText()` string, and every `S_NOTICE` row, byte-identical, read through the new position. Proof: the re-pointed `dr1Notice` and SD tests.
- N-A2: markup order is `.sheetbody`, `#scale-guidance` (`#scale-msg`, `#scale-layout-state`), `#scale-generate`, `#scale-delete-row`; both ids are outside `.sheetbody` and `#scale-drawer`. Proof: new app test.
- N-A3: no id removed; `ELEMENT_IDS` unchanged; SB-2 green.
- N-A4: `#scale-layout-state` has `aria-live="polite"`, `#scale-msg` keeps its own, the wrapper has none; nothing in the slot is focusable. Proof: new app test.
- N-A5: visibility proof of E row 1. Proof: new e2e test.
- N-A6: no-resize proof of E row 2 and the enumerated growth. Proof: new e2e test.
- N-A7: "with a real keyboard up, the seed box is not clipped by the sheet's own scroller" green unchanged; the plan's table D is reproduced in the lane report from a probe.
- N-A8: stale `#scale-msg` comment replaced by one stating where the messages live and why.
**New mutants (`# kills:` names the new test).** `sg_notice_back_in_the_scroll` (notice returned to `#scale-layout-zone`; kills N-A2 and N-A5), `sg_msg_left_in_the_scroll` (kills N-A2), `sg_slot_reserved_height_dropped` (`min-height:36px` removed; kills N-A6), `sg_slot_shrinks` (`flex:0 0 auto` dropped; kills N-A6's growth case), `sg_slot_live_dropped` (notice `aria-live` removed; kills N-A4), `sg_slot_below_primary` (kills N-A2). Mutant count never drops.
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
