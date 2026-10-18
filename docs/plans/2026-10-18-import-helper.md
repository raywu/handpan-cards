# Subplan v13: "Need help?" scale helper (four fields, live preview)

Date: 2026-10-18. Supersedes `subplan-v12.md` (kept untouched), which superseded `subplan-v11.md`, which superseded `subplan-v10.md`, which superseded `subplan-v9.md`, which superseded `subplan-v8.md`, which superseded `subplan-v7.md`, which superseded `subplan-v6.md`, which superseded `subplan-v5.md`, which superseded `subplan-v4.md`, which superseded `subplan-v3.md`, which superseded `subplan-v2.md`, which superseded `subplan.md` (v1). Supplements `docs/plans/2026-10-17-import-v2.md` (not edited here).

Read against:
- origin/dev b153406 (merge of #373, L1b's PR D; L1b head 5a5f7f0). The section 3 inventory was re-taken there (eng-review-v2): it matches, plus the three items v3 folds (the IM describe wrapper and two dev CLAUDE.md bullets);
- PR #370 (L1) and PR #372 (L1b, head 5a5f7f0), both OPEN to main;
- origin/claude/dev-overlay 619201e;
- origin/main 02f4e0f.

Every claim about current code names a function, id, test title or a probe run on origin/dev b153406 (its engine is the #372 head's). UNVERIFIED count: 0.

## 0. What changed

### v13 (from eng-review-v12 and design-review-v12)

Eng-review-v12 returned APPROVE_WITH_CHANGES (RC-1, N-1, N-2); design-review-v12 scored 9.5/10 with no required change (nits 1 and 2). v13 folds exactly those five items. No rule, state, copy, test row or mutant is added or removed.

| Source | Item | Where it landed |
|---|---|---|
| Eng-v12 RC-1 | The 2b label bullet gains the reviewer's text verbatim: the label listener is one delegated `mousedown` listener on `#scale-helper` that checks for a `LABEL` target, and no code reads an element-scoped lookup or an input's label list, which the sandbox lacks. The 2.7 SCROLL guard sentence is replaced verbatim: `reveal(f)` reads `.helperbody` through the document-level compound selector first and returns before touching f's input when it is absent; f's row is reached only after that. No other sentence prescribes a lookup for the labels, `.helperbody` or `.fieldrow` | 2b label bullet, 2.7 SCROLL |
| Eng-v12 N-1 | IH-E13f's RC-5 clause waits for `--helper-vh` to be absent from `#scale-helper .helpersurf`'s inline style, which the helper writes, in place of a wait on a property it never writes | IH-E13f |
| Eng-v12 N-2 | H2b acceptance states that IH-E13f carries two mutants, so its 62 test rows hold 63 patches | H2b acceptance |
| Design-v12 nit 1 | The section 7 gap names double-click word selection beside drag-selection, in the reviewer's sentence; the 2b bullet's closing sentence says the same | section 7 accepted gaps, 2b label bullet |
| Design-v12 nit 2 | IH-E13f's label clause gains one check in the same clause: from a typed field (a space and then Backspace typed with real keys into BOTTOM, so its value and message do not change) while an error shows, the label's top is the same at `mousedown` and at `click`. No new test row and no new mutant | IH-E13f |

After eng-review-v13 (APPROVE, 10/10/10/10/9.5/10/10/9.5): its three nits are folded in place. N-1, 2.7 SCROLL reaches f's row through the literal id lookups the focus listeners use; N-2, IH-E13b's mutant text names the `reveal(f)` call; N-3, IH-E13f asserts both recorded tops exist before comparing them. No count changes.

Totals after v13, unchanged from v12: 17 E (H1), 39 app A and 23 IH-E (H2b) tests, 79 in all. Mutants: 17 `ih_e_*` (H1) and 63 other `ih_*` (H2b). Mutation-gate total: 1195 after H2b (README:77). FLOORS unchanged.

### v12 (from eng-review-v11 and design-review-v11)

Eng-review-v11 returned APPROVE_WITH_CHANGES (RC-1, RC-2, N-1 to N-4); design-review-v11 scored 9.5/10 with no required change (nits 1 and 2). v12 keeps the state plus pure render model (`regroup-v9-cause.md`): RC-1 adds a `mousedown` listener on the helper labels that writes no state and moves no focus, and RC-2 is guard wording for reads the sandbox lacks. The label fix was probed in headless Chrome against a detached worktree of origin/dev b153406 (`v12probe/`). With it, a mouse press, a synthesized touch tap (`synthesizeTapGesture`), a drag and an assistive-technology style `label.click()` on the TOP INNER NOTES label each log `blur bottom rt=inner`, `focus inner`, leave `scrollTop` at 178 and keep INNER's accessible name. Without it, the mouse press and the tap leave focus on the body.

| Source | Item | Where it landed |
|---|---|---|
| Eng-v11 RC-1 | Each helper `.sheetlabel` gets a `mousedown` listener that calls `preventDefault()`, so a label press keeps focus in the field until the label's click moves it to the label's own input. That blur carries the input as `relatedTarget`, keeps `revealed`, and SC1 does not scroll the list under the pointer. The listener moves no focus itself, and the label stays associated through `for=`. IH-E13f gains a label-click regression clause; R-1b gains a real-phone label tap | 2b bullet list, IH-E13f, section 6 R-1b |
| Eng-v11 RC-2 | The helper surface is read at each use (`applyKbOffset()` and `hideHelper()`) and skipped when falsy (the sandbox gives `undefined`, and its `style` stub has no `removeProperty`). `kbUp` opens `false` when `window.visualViewport` is absent | 2b, 2.3 "Close helpers", 2.7 `kbUp` row |
| Eng-v11 N-1 | A17b's reopen clause becomes two clauses that can fail: the open paint clears `#helper-live` before any flush, and a pending M16 write does not survive BACK and a reopen. Section 9 does not count A17b as covering A1's open-paint rule | A17b, section 9 |
| Eng-v11 N-2 | The A-test note says sandbox events carry no `target`, so each input's listeners take the field from their closure | H2b A-test note |
| Eng-v11 N-3 | A note after H2b's Verify block: the H2a, H2b and H3 blocks cannot go green on a dev-based worktree (35 dev-overlay failures), and CI on the main PR at the verified head SHA is the evidence | H2b, after the Verify block |
| Eng-v11 N-4 | No action: the `.stale` grey's missing mutant is already recorded | section 9 |
| Design-v11 nit 1 | Scenario rows S19 to S24 are indented by four spaces, so the table renders as one table | 2.7 |
| Design-v11 nit 2 | New mutant `ih_blur_keeps_revealed` (the `blur` writer leaves `revealed` alone, so S24's reveal never runs), killed by IH-E13f's S24 clause | IH-E13f, H2b `M=` list and counts |

Where v12 adapts a reviewer's text, the reason is in section 7, "v12 adaptations". Totals after v12: 17 E (H1), 39 app A and 23 IH-E (H2b) tests, unchanged. Mutants: 17 `ih_e_*` (H1) and 63 other `ih_*` (H2b), 80 new patches; every test carries one mutant except IH-E13f, which carries two. H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1195 after H2b. Expected FLOORS, unchanged because FLOORS count tests, not mutants (CI's artifact governs): `tests/import.test.js` 80 after H1; app 607 and e2e 331 after H2a; app 646 and e2e 354 after H2b.

Owner flags (a) to (d) stand as v11 left them. No new copy; M2, M10, M14, M18, NEED HELP?, the stacked plate and the BB refusal are unchanged. The label listener changes nothing a user sees.

### v11 (from eng-review-v10 and design-review-v10)

Eng-review-v10 returned APPROVE_WITH_CHANGES (RC-A, RC-B, nits 1 to 6); design-review-v10 scored 8/10 (RC-1, N-1 to N-5). v11 keeps the state plus pure render model (`regroup-v9-cause.md`): RC-1 is one more value on an existing writer (`blur`), not a visibility rule per event. The RC-1 fix was probed on a detached worktree of origin/dev b153406 at 320x568 in both keyboard orders (`rv11/`): the reveal fires once focus leaves, and a keyboard cycle with focus kept still does not re-reveal.

| Source | Item | Where it landed |
|---|---|---|
| Eng-v10 RC-A | A reopen prefills from `#scale-box` or starts blank (2.6, owner Q3), never with the fields as the user left them. S16's Messages cell and A17b's regression clause take the reviewer's text: type BOTTOM `c eb`, close with BACK, reopen with `#scale-box` empty; the four fields are empty, no message shows and `#helper-live` is empty after `app.flushTimers()`. v10 adaptation 7 is corrected in place | 2.7 S16, A17b clause, section 7 v10 adaptation 7 |
| Eng-v10 RC-B | `applyKbOffset()` reads the helper surface as `scaleHelper.firstElementChild` at the call; when it is null (the sandbox) the two style writes are skipped and the `kbUp` edge, `paint()` and SC3 still run, so A28 and A29 reach the edge | 2b `applyKbOffset()` bullet |
| Design-v10 RC-1 | A `blur` on a helper input whose `relatedTarget` is not one of the four helper inputs (`null` included) sets `revealed = null` before that blur's single paint, so a settled paint with the keyboard down reveals the field the USE note names once focus has left the fields. Written as a value of the existing `blur` writer, not a second listener. New scenario S24; IH-E13f gains a regression clause (click `#helper-title`, then DING's row is wholly inside `.helperbody`); no new mutant | 2.7 STATE, `revealed` row, SC1, S13, S24, IH-E13f |
| Eng-v10 N-2 and design-v10 N-3 (one fix) | A1: each settled write cancels a pending one (`clearTimeout`) before it schedules its own | 2.7 ANNOUNCE |
| Eng-v10 N-1, N-3 to N-6, design-v10 N-1, N-2, N-4, N-5 | Folded or declined, each with its reason | section 7 nits |

Where v11 adapts a reviewer's text, the reason is in section 7, "v11 adaptations". Totals are unchanged from v10: 17 E (H1), 39 app A and 23 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 62 other `ih_*` (H2b), 79 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1194 after H2b. Expected FLOORS (CI's artifact governs): `tests/import.test.js` 80 after H1; app 607 and e2e 331 after H2a; app 646 and e2e 354 after H2b.

Owner flags (a) to (d) stand as v10 left them. No new copy; M2, M10, M14, M18, NEED HELP?, the stacked plate and the BB refusal are unchanged.

### v10 (from eng-review-v9 and design-review-v9)

Eng-review-v9 returned APPROVE_WITH_CHANGES (RC-1 to RC-5); design-review-v9 scored 7/10 (RC-1 to RC-3). v10 keeps v9's state plus pure render (`regroup-v9-cause.md`): each fold is a writer's value, a render output or a scroll call site, never a visibility decision taken per event.

| Source | Item | Where it landed |
|---|---|---|
| Eng-v9 RC-1 | Compose runs the full line for NO_FIFTH only when TOP is non-empty and steps 3 and 4 produced no error, so DING `F3` alone carries no DING error. E12's title gains that clause; its mutant and the counts are unchanged | 2.5 step 4, E12 |
| Eng-v9 RC-2 | `reveal(f)` writes nothing without geometry, so the sandbox never scrolls. No A test asserts a scroll position; SC1, SC2 and SC3 are proved only by IH-E13b to IH-E13g in Chrome | 2.7 SCROLL, A-test note |
| Eng-v9 RC-3 and design-v9 RC-2 (one fix) | Pinch-zoom freezes `kbUp`: while `visualViewport.scale > 1.01` no keyboard edge is read, so zooming never ends an edit, and the unzoom compares against the kept value. New A29, mutant `ih_zoom_reads_edge`. Eng's A28 regression clause is not added, because A29 covers the same path (v10 adaptation 1) | 2.7 STATE, A29 |
| Eng-v9 RC-4 | R3 keeps an entry only while its field's eligible message is the same kind (error or the M16 info). A22 gains a regression clause (BOTTOM `Eb3 C3` edited to `Eb3 c`) | 2.7 R3, A22 |
| Eng-v9 RC-5 | SC1 sets `revealed = null` while a field is being typed in and leaves it alone on a paint with no target, so a keyboard cycle with no input does not reveal again. IH-E13f gains a regression clause | 2.7 SC1 and STATE, IH-E13f |
| Design-v9 RC-1 | SC3: the keyboard-open edge reveals the focused helper input's field. It reads `document.activeElement` to pick a scroll target and nothing else. New IH-E13g, mutant `ih_no_kb_open_reveal`; real-phone check R-1b | 2.7 SC3, IH-E13g, section 6 R-1b |
| Design-v9 RC-3 | A kept message whose text no longer matches its field renders stale: the same text in `.sheethint` grey, so nothing reflows; `invalid` still follows R4 and nothing is announced. New A22b, mutant `ih_stale_keeps_error_colour`; IH-E16 gains the colour clause | 2.7 R3, A22b, IH-E16 |
| Eng-v9 N-1 to N-7, design-v9 N-1 to N-5 | Folded or declined, each with its reason | section 7 nits |

Where v10 adapts a reviewer's text, the reason is in section 7, "v10 adaptations". Totals after v10: 17 E (H1), 39 app A and 23 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 62 other `ih_*` (H2b), 79 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1194 after H2b. Expected FLOORS (CI's artifact governs): `tests/import.test.js` 80 after H1; app 607 and e2e 331 after H2a; app 646 and e2e 354 after H2b.

**Owner flags (v9's four, with the v10 outcome; behaviour only, no copy change):**
- (a) M6 and M8 (empty DING, empty TOP) are never shown under a field; the USE note's C9 says the same thing. **Accepted, unchanged.**
- (b) A message waits until its field, or the field being typed in, is left. **Accepted, pending iOS R-6:** whether a tap on the disabled USE blurs the focused field on iOS Safari is recorded on a real phone (section 6).
- (c) While a field is being typed in, a message already shown keeps its old text. **Changed:** a kept message whose text no longer matches what the field now holds renders in the hint grey, not orange, until the field is left (design-review-v9 RC-3). An orange message therefore never states something the field no longer says.
- (d) Pinch-zoom. **Changed:** pinch-zoom freezes `kbUp`; it is never read as the keyboard closing; zooming does not finish the field being typed in (design-review-v9 RC-2, eng-review-v9 RC-3).

No new copy.

### v9 regroup (after design-review-v8 and eng-review-v8)

Design scores v5 to v8 were 9.5, 9.6, 9.3 and 9.4, and every round's required changes were about when a message shows, which field it is attributed to, or when the list scrolls to it. v9 does not patch v8's rules; it replaces them. The cause is in `regroup-v9-cause.md` (scratch dir): v8 decides visibility per event (blur of X, input into a later field, `relatedTarget`, `applyKbOffset` writes) instead of deriving it from state, and it holds a message by the field that shows it (M15 under DING) instead of by whether any edit is in progress, so every new event path (a DING-caused M9 under TOP, Android Back without a blur, an iOS null `relatedTarget`, an unrelated keyboard-offset write) opened a new case.

| Source | Item | Where it landed |
|---|---|---|
| Regroup | One message model: four state variables with named writers (`editing`, `kbUp`, `shown`, `revealed`), one pure render (R1 to R5), one announce rule (A1), one error-scroll trigger (SC1) and the focus scroll (SC2), both through a pure `revealTop`. It replaces v8's 20 timing, hold, scroll and live rules; v8 reacted to 9 event kinds, v9's visibility reacts to 3 (input, blur, the keyboard-close edge) plus the open | 2.7 |
| Regroup | Scenario table S1 to S18, each row naming its test | 2.7 |
| Design-v8 RC-1 | A DING-caused error under TOP waits for DING's blur and then shows, touched or not: render gates on `editing`, not on the field that shows the message. A15d rewritten, mutant `ih_hold_only_typed_field` | 2.7 R3, A15d |
| Design-v8 RC-2 | The error scroll runs only when `paint()` changes its target, never on an `applyKbOffset` write. New IH-E13f, mutant `ih_error_scroll_every_write` | 2.7 SC1, IH-E13f |
| Design-v8 RC-3 | The keyboard-close edge ends `editing`, so Android Back settles and reveals with focus kept. New A28 (sandbox, `ih_kb_close_keeps_editing`); IH-E13e gains an Android Back phase and its mutant is renamed `ih_no_settle_reveal` | 2.7 STATE and SC1, A28, IH-E13e |
| Eng-v8 RC-1 | Moot: the model reads no `relatedTarget`. A15d still blurs with `relatedTarget` TOP and A15 without, so a reintroduced branch fails one of them | 2.7 STATE, A15, A15d |
| Design-v8 N-4 | M16 is announced once at settle, not per keystroke. A15c rewritten, mutant `ih_text_updates_while_editing` | 2.7 A1, A15c |
| Design-v8 N-1, N-2, N-3, N-5; eng-v8 N-1 to N-8 | Folded or moot, each with its reason | section 7 nits |

Where v9 adapts the regroup prompt or a reviewer's text, the reason is in section 7, "v9 adaptations". Totals after v9: 17 E (H1), 37 app A and 22 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 59 other `ih_*` (H2b), 76 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1191 after H2b. Expected FLOORS (CI's artifact governs): `tests/import.test.js` 80 after H1; app 607 and e2e 331 after H2a; app 644 and e2e 353 after H2b.

**Flagged for the owner (behaviour, no copy change):** (1) M6 and M8 (empty DING, empty TOP) are never shown under a field; the USE note's C9 says the same thing. (2) A message waits until its field, or the field being typed in, is left; v8 showed a complete bad token at once and showed earlier fields' messages on input into a later field. (3) While a field is being typed in, a message already shown keeps its old text (it leaves as soon as it no longer applies); the new text appears when the field is left. (4) A pinch-zoomed page (scale over 1.01) counts as keyboard down, as `helperBox` already does. No new copy.

### v8 (from eng-review-v7 and design-review-v7)

| Source | Item | Where it landed |
|---|---|---|
| Eng-v7 RC-1 | A15c's steps are pinned: the input sequence, the assertions after each input, the dispatched `blur`, the `addEventListener("blur", ...)` listener and the hold flag that never reads `document.activeElement` | A-table note, 2.7 |
| Design-v7 RC-1 | M15 never newly appears while DING or TOP has focus; it appears when neither has focus, stays while either is refocused and edited, and clears on the first input after which compose no longer reports NO_FIFTH. A15c is retitled and gains a clearing step; new A15d with `ih_no_fifth_while_ding_focused` | 2.7, 2.5 step 4, A15c, A15d, H2b |
| Design-v7 RC-2 | The 380x780 unfocused budget row: with the two-line M16 line showing, the list scrolls by 3.4px and USE stays in view (auto-decision: accept the scroll) | 2b budget table |
| Design-v7 RC-3 | With no helper input focused, the first invalid field's row is scrolled into view after a blur that leaves the helper inputs and after the `applyKbOffset` write that follows the keyboard closing; focus does not move. New IH-E13e with `ih_error_scroll_on_blur` | 2.7, IH-E13e, 2b, H2b |
| Eng-v7 N-1 | M17 also covers a guessed bottom whose octave number would be below -1 (`B#-2` under ding `B#-1`); 2.5 step 3 says step 6's final parse cannot reach M12 | 2.5 step 3, 2.5 step 5.3 |
| Eng-v7 N-2 | v3 adaptation 3 notes the v7 M16 wording | 7 |
| Eng-v7 N-3 | H3's sentence says IH titles are written as `test("...")` string literals | H3 |
| Design-v7 N-1 | M12 can take up to four lines at 320 and three at 380 | 2.5 step 3, 2.7 |
| Design-v7 N-2 | M1's 4.8px of slack at 320 (271.2 of 276px) is recorded and M1 is named in the one-line list | 2.7 |
| Design-v7 N-3 | "Fix DING to continue." for M15 is recorded as intended | 7 nits |
| Design-v7 N-4 | New real-phone check R-6: a tap on the disabled USE on iOS Safari | 6 |
| Design-v7 N-5 | Section 9's one-line claim excludes M15, M16 and M4 with a long token | 9 |

Where v8 adapts a reviewer's text, the reason is in section 7, "v8 adaptations". Totals after v8: 17 E (H1), 36 app A and 21 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 57 other `ih_*` (H2b), 74 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1189 after H2b. Expected FLOORS (CI's artifact governs): `tests/import.test.js` 80 after H1; app 607 and e2e 331 after H2a; app 643 and e2e 352 after H2b.

### v7 (from eng-review-v6 and design-review-v6)

| Source | Item | Where it landed |
|---|---|---|
| Design-v6 RC-1 | M15 waits for TOP to be finished: it appears on TOP's blur, or when INNER or BOTTOM receives input, never while TOP has focus; until then the USE note reads C10. New A15c with `ih_no_fifth_while_top_focused`; H2b mutants 55 (`-eq 55`); README:77 1187 after H2b | 2.5 step 4, 2.7, A15c, H2b, 5, 9 |
| Design-v6 RC-2 | M1 is "Type notes only: the line is written for you." (one line at 320 and 380); section 9's Mobile row reads "every fixed-text message but M15 is one line at 320 (M1 after design-review-v6 RC-2)" | 2.10, 9 |
| Eng-v6 RC-1 | H3's title check is the reviewer's `node -e` block, which reads each `test("...")` title with escapes decoded and matches titles with inner double quotes whole; the reviewer's explanatory sentence follows the block | H3 verify |
| Eng-v6 N-1 | `hideHelper()` and `closeHelper()` are defined once, with the ordering the `liftSheetInert()` guard relies on | 2.3, 2b |
| Eng-v6 N-2 | H1's Verify checks `test $(ls tests/mutants/ih_e_*.patch \| wc -l) -eq 17` before `LOG=$(mktemp)` | H1 verify |
| Eng-v6 N-3 | H2a's and H2b's blocks open with `test -x "$CHROME_BIN" \|\| { echo "set CHROME_BIN to a Chromium binary"; exit 1; }` | H2a, H2b verify |
| Eng-v6 N-4, Design-v6 N-5 | IH-E13d's first bound is "within 8px" (kill margin 15px under the no-cap mutant); the measured headroom is recorded beside "Tightest margin" | IH-E13d, 2b |
| Eng-v6 N-5 | Section 7 v5 adaptation 6 notes 351 after v6 adaptation 1 | 7 |
| Eng-v6 N-6 | A25's pointer-BACK clause and A27's post-Escape clause are named as regression clauses with no mutant of their own | A25, A-table note |
| Design-v6 N-1 | M9 is "<X> is not above the ding, <D>." | 2.10 |
| Design-v6 N-2 | M16 is "Octaves guessed: <names>. Type an octave to change a guess." | 2.7, 2.10, 6 step 3 |
| Design-v6 N-3 | The 380x780 unfocused budget row records the two-line M16 fit (0.6px spare; corrected in v8: the list scrolls by 3.4px, design-review-v7 RC-2) | 2b |
| Design-v6 N-4 | 2.5 step 3 states that no code is known to reach M12, why, and what a long reason does | 2.5 step 3, 2.7 |

Where v7 adapts a reviewer's text, the reason is in section 7, "v7 adaptations". Totals after v7: 17 E (H1), 35 app A and 20 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 55 other `ih_*` (H2b), 72 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1187 after H2b. Expected FLOORS (CI's artifact governs): `tests/import.test.js` 80 after H1; app 607 and e2e 331 after H2a; app 642 and e2e 351 after H2b.

### v6 (from eng-review-v5 and design-review-v5)

| Source | Item | Where it landed |
|---|---|---|
| Eng-v5 RC-1 | Every Verify block (H1, H2a, H2b, H3) is wrapped in `bash <<'VERIFY'` ... `VERIFY`; each mutant loop runs `if $cmd >/dev/null 2>&1 </dev/null; then`; `CHROME_BIN` is exported before the H2a and H2b blocks; the reviewer's bash sentence follows H1's loop-shape paragraph | H1, H2a, H2b, H3 verify |
| Eng-v5 RC-2 | The `#helper-done` write happens after a USE only, never after BACK, Escape or a popstate; A25's title gains the pointer-BACK clause and keeps `ih_use_silent` | 2.3, 2.8, A25 |
| Eng-v5 N-1 | A27 asserts `#scale-sheet` carries no inert or aria-hidden immediately after Escape closes it, before any advance or reopen; the note's "pins hideSheet" claim is corrected | A27 and its note |
| Eng-v5 N-2 | `e.detail > 0` is a pointer, anything else a keyboard activation; A27's keyboard USE passes `{ detail: 0 }` | 2.3, A27 |
| Eng-v5 N-3 | The focus move lives in `liftSheetInert()` behind its guard; `hideSheet()` calls it after `sheetOpen = false` | 2.3 |
| Eng-v5 N-4 | Keyboard USE's deferred `#helper-done` write runs on `helperInertTimer` at 0ms, so `resetHelper()` and helper open clear it | 2.3, 2.8 step 8 |
| Eng-v5 N-5 | H2b's loop runs the `i_*` STALE pass and its final grep includes STALE | H2b verify |
| Eng-v5 N-6 | The message scroll runs each time a message appears, or its text changes, under the focused field | 2.7 |
| Eng-v5 N-7 | FLOORS bases are node-reported counts (a `test(` regex gives 588 and 324); CI's artifact governs | H2a Owns |
| Design-v5 RC-1 | The message scroll is capped so at most 4px of the input's top is hidden; new IH-E13d with `ih_msg_scroll_cap` (realFonts); H2b mutants 54 (`-eq 54`); README:77 1186 after H2b; budget row updated | 2.7, 2b, IH-E13c, IH-E13d, H2b, 5, 9 |
| Design-v5 RC-2 | M4, M9, M10, M13, M14, M17 and M18 shortened to one line at 320 (M4 up to about 10 characters of token); M10, M14 and M18 are one string | 2.5, 2.10, E11, E13, 6 step 6 |
| Owner, 2026-10-18 | M2 is "Use letter names, like D A Bb." (owner's text; design-v5 N-1 offered "like D, A or Bb."); the order message "<X> is lower than <P>: list low to high." is approved | 2.10, E8, 6 step 5, 8 |
| Design-v5 N-2 | M11 is one string, "<X> is already in the top or inner notes." | 2.5 steps 3 and 4, 2.10 |
| Design-v5 N-3 | The landscape keyboard caption crop (844x390, 200px keyboard) is recorded under R-4 | 6 R-4, 7 nits |
| Design-v5 N-4 | M15 and M16 stay two lines at 320, covered by the cap | 2.7, 7 nits |
| Design-v5 N-5, N-6 | No action | 7 nits |

Where v6 adapts a reviewer's text, the reason is in section 7, "v6 adaptations". Totals after v6: 17 E (H1), 34 app A and 20 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 54 other `ih_*` (H2b), 71 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1186 after H2b.

### v5 (from eng-review-v4 and design-review-v4)

| Source | Item | Where it landed |
|---|---|---|
| Eng-v4 RC-1 | The acceptance grep filters with `grep -v 'import-v2'`, because `tests/import_gold.test.js` line 1 cites `docs/plans/2026-10-17-import-v2.md` (checked at origin/dev b153406); reviewer's replacement text verbatim | H2a acceptance and verify, H2b acceptance and verify |
| Eng-v4 RC-2 | H2a's PR D to dev is CONFLICTING (dev carries the overlay's `#import-row` un-hide). H0a: merge H2a's verified head on `claude/dev-sync-h2a` cut from dev, taking H2a's side, and close PR D as superseded. H0b: the help-row un-hide goes on `claude/dev-sync-h0b` cut from dev. `claude/dev-overlay` is never rebased and stays at 619201e; the escape hatch must re-apply the help-row un-hide. Both dev merges fall under the existing `claude/dev-sync-*` grant | H0, 4 intro, 5, 6 intro, H3, 7 rollback, 8 FYI |
| Eng-v4 RC-3 | One `liftSheetInert()` (clears `helperInertTimer`, `setInert(false, [scaleSheet])`), called from the timer, keyboard USE and BACK, Escape and popstate while the helper is open, `resetHelper()` and `hideSheet()`; only the focus move and the `#helper-done` write are conditional. A27 gains the Escape-at-100ms reopen clause and keeps its one mutant | 2.3, 2.8, A27 |
| Eng-v4 N-1 | 15 app IM tests sit in the IM describe; the 16th ("IM: importing tracks one scale_import per IMPORT ...") sits in `describe("discoverability: analytics events")` and is deleted alone. The "no event param ..." test keeps running but loses its `scale_import` assertion in H2a | 3, H2a |
| Eng-v4 N-2 | H2a lowers its own `tests/suite_health.py` rows, app 623 to 607 and e2e 335 to 331, for a deliberate removal | H2a |
| Eng-v4 N-3 | The four inputs and four `-msg` paragraphs are literal `id="helper-<f>"` markup and literal lookups (`$("helper-ding")`, never a template) | 2.2, 3 |
| Eng-v4 N-4 | Expected README:77 counts: 1149 after H1, 1132 after H2a, 1185 after H2b (eng-v4's 1184 plus `ih_msg_scroll`) | H1, H2a, H2b acceptance |
| Eng-v4 N-5 | Every mutant loop runs `git apply --check` first, prints NOAPPLY and skips on failure, resets `cmd` each pass, and the chain fails on any SURVIVED or NOAPPLY line | H1, H2a, H2b verify |
| Eng-v4 N-6 | `#helper-use` and `#helper-back` are wired with `addEventListener("click", ...)`; in A27 "GENERATE CARDS runs" is a liveness check only | 2.3, A27 note |
| Eng-v4 N-7 | Between H2a and H3, CLAUDE.md cites the deleted "IM: the import row ships hidden ..." test; H3's brief names the fix | H3, 7 accepted gaps |
| Design-v4 RC-1 | C11 names the field DING, TOP RIM NOTES, TOP INNER NOTES or BOTTOM NOTES; A6b adds the BOTTOM-only clause; 2.7 item 1 and section 6 step 4 point to C11 | 2.7, 2.10 C11, A6b, 6 step 4 |
| Design-v4 RC-2 | A message that appears under the focused field calls `msg.scrollIntoView({block:"nearest"})` once; new IH-E13c with `ih_msg_scroll` (realFonts); H2b mutants 53 (`-eq 53`); budget row and tightest-margin paragraph updated | 2.7, 2b, IH-E13c, H2b, 9 |
| Design-v4 N-1 | Final periods on M2, M3, M9, M10, M13, M14 and M18, and on every test title and DEV step that quotes them | 2.10, 2.5, E7, E8, E11, E13, 6 steps 4 to 6 |
| Design-v4 N-2 | IH-E14's Edit bound is 58.5px | IH-E14 |
| Design-v4 N-3 | A caption tap with the keyboard up collapses the field region until the keyboard closes: an accepted transient | 7 accepted gaps |
| Design-v4 N-4 | A deliberate tap inside the 350ms window after a pointer USE or BACK is swallowed, by design | 7 accepted gaps |

Where v5 adapts a reviewer's text, the reason is in section 7, "v5 adaptations". Totals after v5: 17 E (H1), 34 app A and 19 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 53 other `ih_*` (H2b), 70 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3. Mutation-gate total: 1132 at dev, 1149 after H1, 1132 after H2a, 1185 after H2b.

### v4 (from eng-review-v3 and design-review-v3)

Locations in the v3 and v2 tables below that say H2 now read H2a (removal of the paste UI) or H2b (the helper); the split is the eng-v3 lane-shape row.

| Source | Item | Where |
|---|---|---|
| Eng-v3 A | ELEMENT_IDS holds exactly the 18 ids the app looks up (SB-2 needs markup and a lookup); `help-hint`, `helper-title`, `helper-plate` and `helper-seed-box` are markup-only. H2a removes the 12 import ids, H2b adds the 18 | 3, 7 v3 adaptation 2, H2a, H2b |
| Eng-v3 B | The acceptance grep drops `import-v2-gold` lines and must print nothing; `ls tests/mutants/ib_*.patch` prints nothing | H2a, H2b acceptance and verify |
| Eng-v3 C (integrator: apply) | After a pointer USE or BACK (`e.detail > 0`) `#scale-sheet` stays inert for 350ms, then focus goes to `#help-open`; a keyboard activation lifts it at once. New A27 with `ih_use_ghost_tap`. "Within one task" is replaced by the measured popstate latency, 0.8-2.4ms. USE's announcement and focus move to the inert lift | 2.3, 2.8, A25, A27, 6 step 7, 7 accepted gaps and v4 adaptations 1 and 3 |
| Eng-v3 D | IH-E1, IH-E2b, IH-E11, IH-E13, IH-E13b, IH-E14 and IH-E15 launch with `launch({ realFonts: true })` | H2b |
| Eng-v3 E | IH-E16 (dotted grey guess underline, 14px orange field error) with `ih_guess_orange` | H2b |
| Eng-v3 lane shape (integrator: split) | H2 splits into H2a (removal of the paste UI; the importer engine stays) and H2b (the helper), serial, H2b branching from H2a's head. Tests, mutants, acceptance and verify are redistributed; main merge order is #370, #372, H1, H2a, H2b, H3; H0 runs in two steps | 4, 5, 6, 7 rollback, 9 |
| Eng-v3 nit 1 | "11 dev-only commits" (l1b..dev), not 34 (dev..main) | 5 |
| Eng-v3 nit 2 | The caption-box example is the full M16 string | 2.7 |
| Eng-v3 nit 3 | Every new H2b patch and each re-anchored patch has a `# suite:` header with `.` wildcards and no quotes | H2a, H2b |
| Eng-v3 nit 4 | Step 5.3 says "strictly above ... by midi" | 2.5 step 5 |
| Eng-v3 nit 5 | A fragment navigation consumes the helper's history entry, as it does the sheet's | 7 accepted gaps |
| Eng-v3 nit 6 | The hint width cites the measured 286.7px | 2.1, 7 v3 adaptation 5 |
| Design-v3 RC-1 (integrator: one-line row) | `#help-row` is one 44px line, the hint beside NEED HELP?; IH-E14 rewritten to the `.sheetbody` scrollport edge on Add and a 58px cost on Edit; section 6 steps 1 and 10 and the v3 RC6 row rewritten; the "NEED HELP? in the sheet header" alternative is an owner FYI | 2.1, IH-E14, 6, 0, 8 |
| Design-v3 RC-2 | Helper inputs are a fixed 44px with zero block padding | 2.4 |
| Design-v3 RC-3 | Focus scrolls the input's `.fieldrow` into view (`block:"nearest"`); IH-E13 reworded; new IH-E13b with `ih_focus_scroll_row` | 2.4, IH-E13, IH-E13b, 7 v4 adaptation 2 |
| Design-v3 RC-4 | Focused compaction changes block padding only: `padding:var(--sp-2) var(--sp-4)` | 2b |
| Design-v3 N-1 | Desktop rows are 64.25 (desktop `--sp-1` 6): 293 needed, 5px to spare | 2b |
| Design-v3 N-2 | Landscape tokens (3/6/9/14, USE 44) and the expected wraps are recorded | 2b |
| Design-v3 N-3 | A layout-viewport shrink only compacts further | 7 R1 |
| Design-v3 N-4 | Section 9 cites design-review-v3's browser measurement of the budgets | 9 |
| Design-v3 N-5 | The 2.6px slack at 320x568/260 is guarded by IH-E13; any new focused-column term re-runs it | 2b |

Where v4 adapts a reviewer's text, the reason is in section 7, "v4 adaptations". Totals after v4: 17 E (H1), 34 app A and 18 IH-E (H2b) tests, each with one mutant: 17 `ih_e_*` (H1) and 52 other `ih_*` (H2b), 69 new patches; H2a adds none, deletes 17 `ib_*` and re-anchors 3.

### v3 (from eng-review-v2 and design-review-v2)

| Source | Item | Where |
|---|---|---|
| Eng-v2 1 (FAIL) | The eng 4 scenario is not an error: INNER `Bb` over top C4 reads Bb4 and is accepted. Step 4 now uses INNER `C4` (NOTE_REPEATED) and `Bb3` (NOTE_OUT_OF_ORDER); E11 retitled with the reviewer's text | 2.5 step 4, E11 |
| Eng-v2 2 | An inner repeat names the field that holds the first copy | 2.5 step 4, 2.10 M11 |
| Eng-v2 3 | Ding pitch compared by midi; step 5.3 wording covers `C2 Eb`; E4 gains "Db under ding C#3 reads Db2" | 2.5 step 5, E4 |
| Eng-v2 4 | H1 and H3 counts match the E table: 17, because v3 adds E17 (a later guess that lands on the ding's midi had no test) | H1, H3 |
| Eng-v2 5 | H3 deletes the dev "Flag copy" bullet and keeps "Engine pins (lane L1b)" | H3 |
| Eng-v2 6 | The `describe("IM: import text on the sheet")` wrapper is deleted with its 16 tests | 3 |
| Eng-v2 7 | Lane bases and main merge order | 5 |
| Eng-v2 8 | NO_FIFTH copy reads "add <L>", not "add a <L>" | 2.5 step 4, 2.10 M15 |
| Eng-v2 nits | Examples use C3, Eb3; "tenth and eleventh events"; H2 verify uses an explicit mutant list (the old `ih_[!e]*` glob also skipped `ih_escape_*`, `ih_edit_*`, `ih_enter_*` and `ih_example_*`); the H2 acceptance grep names the paths it may still match; inventory re-taken at b153406 | 2.5, H3, H2, header |
| Eng-v2 9(a) | Fragment navigation while the helper is open is now a tested behaviour (A26); the double-pop gap stays recorded with its reason | 2.3, A26, 7 |
| Eng-v2 9(b) | The real-phone pass is a recorded pass/fail exit criterion for the prod un-hide | 1 G-F, 6 |
| Eng-v2 9(c) | Every test that carried two mutants is split into two titles | A3/A3b, A7/A7b, A8/A8b, A10/A10b, A15/A15b |
| Eng-v2 9(d) | compose's steps 1 to 6 are one numbered block; every message cites its 2.10 row | 2.5, 2.10 |
| Design-v2 RC1 | USE note hidden while an input has focus, USE `aria-describedby` it, reserved one-line height otherwise, compact padding with no safe-area term; budget recomputed with every term; one e2e fit assertion | 2b, 2.7, IH-E13, IH-E15 |
| Design-v2 RC2 | Pending USE note "Finish the field you are typing in to check it."; a field message clears on the first input that makes the field valid | 2.7, C10, A21, A22 |
| Design-v2 RC3 | The example pan is the placeholders' scale; `held` with no history keeps the example caption | 2.7, A23, A24 |
| Design-v2 RC4 | No `aria-label` on `#helper-seed`; guessed octaves are stated in the BOTTOM info line and announced | 2.7, A17, A17b |
| Design-v2 RC5 | USE note names the field ("Fix TOP RIM NOTES to continue."); the guess underline uses the hint colour `#a79d8b` | 2.7, C11, A6b |
| Design-v2 RC6 | `#help-row` is one 44px line (button, hint beside it, wrapping in its column); the Add sheet's pan stays inside the scrollport and the Edit sheet's preview moves at most 58px (measured, design-review-v3 RC-1) | 2.1, IH-E14, 6 steps 1 and 10 |
| Design-v2 N-1 | Landscape grid areas for the header, the plate, the fields, the USE note and USE | 2b |
| Design-v2 N-3 | USE announces "Scale added to the box." (see 7, adaptation 2, for where) | 2.1, 2.8, A25 |
| Design-v2 N-4 | The preview's `aria-label` speaks accidentals ("B flat 3") | 2.7, A4b |
| Design-v2 N-6 | No `#E27005` text below 14px: field errors are 14px | 2b, 2.7 |
| Design-v2 N-7 | "scale syntax" kept: owner wording | 2.1 |

Where v3 adapts a reviewer's text, the reason is in section 7, "v3 adaptations".

### v2 (from v1; locations are v3's)

| Source | Item | Where |
|---|---|---|
| Owner Q1 + round 4 | Bottom octave is guessed and shown: the first bottom starts in the ding's octave (an octave down if it lands on the ding's pitch), later ones step upward, so a bottom may sit above the ding | 2.5 step 5, 2.7, E4, E5, E16, E17, A17 |
| Owner round 4 | Bottom notes are typed low to high, refused out of order like the top | 2.5 step 5, E13 |
| Owner round 4 | EB, AB, DB and every uppercase-B flat are refused like BB | 2.5 step 1, E7 |
| Owner Q3 | Prefill from `#scale-box` when it parses | 2.6, A11 |
| Owner Q10 | Out-of-order notes refused with "C4 is lower than D4: list top notes from low to high" | 2.5, 2.10 M10, E11 |
| Owner T2 | Stacked plate; caption is a fixed 2-line box; full line on focus and, as text, in the accessibility tree | 2.7, 2b, A4, IH-E2b, IH-E11 |
| Owner T3 + round 3 | Lowercase accepted; uppercase second B refused with "BB is not a note: write B-flat as Bb" | 2.4, 2.5 step 1, E6, E7 |
| Owner round 3 | Solfege refused with "Use letter names, e.g. D A Bb" | 2.4, E8 |
| Owner round 3 | CTA stays "NEED HELP?" | 2.1 |
| Integrator | L1b merges to dev as is; H2 deletes its app copy | 3, 5 |
| Owner 2026-10-18 | Keep importer.js, its tests and `i_*`; H2 removes only the paste-box UI, its app copy, app IM tests and UI `ib_*` | 1 non-goals, 3, H2 non-goals |
| Design R1 | `autocapitalize="off" autocorrect="off" spellcheck="false"` on every helper input | 2.4, A18 |
| Design R2 | Fixed caption height; first-field-does-not-move check | 2.7, IH-E2b |
| Design R3 | Plate sized from the visual viewport; compact layout while an input is focused; three keyboards | 2b, IH-E1, IH-E13 |
| Design R4 | `#helper-title` joins the `#scale-title` rule ("ENTER YOUR SCALE") | 2.2, 2b |
| Design R5 | Labels, `aria-describedby`, `aria-invalid`, one live region, `enterkeyhint`, ring padding | 2.4, 2.7, A15, A18 |
| Eng 1 | Bottoms placed by `serialise` from a REVIEW result built from parsed notes; Pygmy round trip | 2.5 step 6, E2, E3 |
| Eng 2 | Case normaliser | 2.5 step 1, E6, E7 |
| Eng 3 | compose has its own list reader | 2.5 step 1 |
| Eng 4 | Staged parse owns the field message | 2.5 steps 3 and 4, E11, E12 |
| Eng 5 | Forward guard | 2.3, A16, IH-E10 |
| Eng 6 | Removal inventory; sections 3 and 5 agree | 3, 5 |
| Eng 7 | Synchronous redraw, no `requestAnimationFrame` | 2.7 |
| Eng 8 | Landscape gate `(max-height:520px) and (min-width:560px)` | 2b |
| Eng 9 | H3 owns the Discoverability analytics bullet | H3 |
| Brief | IH-A9 and `ih_boot_opens_helper` dropped | 3 (reason), 7 |
| Brief | `/qa-only` with `/browse` is THE DEV e2e plan | 6 |

Nit dispositions are in section 7.

## 1. Goal, non-goals, standing gates

**Goal.** On the Add and Edit sheets, a hidden-on-main NEED HELP? control opens a full-screen helper. The helper has:
- four fields: Ding, Top rim notes, Top inner notes, Bottom notes;
- a pinned live pan preview, with the composed line in a fixed 2-line caption.

USE THIS SCALE writes into `#scale-box`, through the `input` event, exactly the line that typing it would leave. This is proven by the IH: tests at 380x780 with 300px and 340px simulated keyboards, and at 320x568 with a 260px one.

**Non-goals.**
- No paste box, URL reading, URL_ONLY line or parens tap: all parked.
- No solfege in the helper (owner round 3).
- No presets, catalog picker, audio, new font or new colour.
- No change to:
  - GENERATE CARDS;
  - `parseSeed`, `formatSeed`, `interpret` or `serialise` behaviour;
  - the layout solver;
  - deck data or diagram geometry.
- No revert of L1's engine work (owner decision, 2026-10-18, appended to owner-answers.md). `src/engine/importer.js` (`interpret`, `serialise`), its `engine:importer` region in `index.html`, `tests/import.test.js`, `tests/import_gold.test.js`, `tools/regen_import_gold.js` and the 57 `i_*` mutants all stay. H2a removes only the paste-box UI, its app copy (`IMPORT_FLAG_TEXT`, `importFlagLine`), the app-side IM tests and the `ib_*` mutants that target that UI, and H2b adds the helper (section 3).
- No layout controls (anchor, mirror, seats) in the helper.
- No un-hiding on main.

**Standing gates.**
- G-A. Lanes merge to `dev` first. Main PRs stay open until the owner says merge (memory "Dev first, never merge to main").
- G-B. Main merge gate: the `validate` run conclusion is green at the verified head SHA (`gh run list --commit <sha> --workflow validate.yml`), and an independent reviewer returns PASS or PASS_WITH_NITS at that SHA.
- G-C. Dev gate (CLAUDE.md "DEV environment", lane flow D2): PR D to `dev` merges when its head SHA has a green `validate` run on PR M, and D is not CONFLICTING.
- G-D. `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` are clean, and `python3 tools/validate.py` is green.
- G-E. The mutation gate is green. The README:77 count and the `tests/suite_health.py` FLOORS rows are set from the previous lane's CI artifacts (memory "FLOORS rows lag the CI count").
- G-F. The helper is un-hidden on prod only after section 6 passes on DEV, including the recorded real-phone pass, AND the owner says so (memory "Import hidden until DEV-proven").

## 2. Interaction spec

### 2.1 Entry point on the sheet

`#import-row` sits inside `.sheetbody`, after the `.fieldrow` holding `#scale-box`, `#scale-parse` and `#scale-refusal`. Replace it with:

```
<div class="fieldrow" id="help-row" hidden>
  <button type="button" class="mode" id="help-open" aria-haspopup="dialog" aria-controls="scale-helper">NEED HELP?</button>
  <p class="sheethint" id="help-hint">Enter your scale and we will generate the scale syntax.</p>
  <p class="sr-only" id="helper-done" aria-live="polite"></p>
</div>
```

- It ships `hidden`, as `#import-row` does today ("IM: the import row ships hidden: ...").
- `#help-open` joins the sheet's Tab trap (the `sheet` keydown listener's stop list) in the slot the import stops use today (`importRow.hidden ? [] : [...]`), only while `#help-row` is not hidden.
- `#help-row` is one line: `#help-row{flex-direction:row; align-items:center; gap:var(--sp-2)}`, with `#help-open{flex:0 0 auto}`. The hint sits beside the button and wraps inside its own column (measured: two lines, 34.5px, at 380 and 320), so the row is exactly the button's 44px at every phone width. A stacked row (button, then hint) is 65.25px at 380 and 82.5px at 320, and at 380x780 it pushes the bottom 20px of the Add sheet's pan under the `.sheetbody` scrollport. (The hint copy measures 286.7px in Bitter 11.5px, eng-review-v3; it is the owner's, "scale syntax" stays, design-v2 N-7.)
- `#helper-done` is the sheet-side live region for USE's announcement (2.8). It is `.sr-only`, so the row's flex gap does not count it (`.sr-only` is `position:absolute`, index.html `.sr-only` rule).

### 2.2 The overlay surface

A sibling after `#scale-sheet`:

```
<section id="scale-helper" role="dialog" aria-modal="true" aria-labelledby="helper-title" hidden>
  <div class="helpersurf">
    <div class="sheethead">
      <button class="mode" type="button" id="helper-back" aria-label="Back to the scale sheet">&larr; BACK</button>
      <h2 id="helper-title">Enter your scale</h2>
    </div>
    <div id="helper-plate">
      <div id="helper-preview" role="img" aria-label="Example pan"></div>
      <div id="helper-seed-box"><p id="helper-seed" tabindex="0"></p></div>
    </div>
    <div class="helperbody"> four .fieldrow groups (2.4), each written out literally: label, `<input id="helper-<f>">`, `<p class="sheethint" id="helper-<f>-msg">` for f = ding, top, inner, bottom </div>
    <p class="sheethint" id="helper-use-note"></p>
    <button type="button" id="helper-use" aria-describedby="helper-use-note" disabled>USE THIS SCALE</button>
    <p class="sr-only" id="helper-live" aria-live="polite"></p>
  </div>
</section>
```

- The eight field ids are literal in the served markup (`id="helper-ding"`, `id="helper-ding-msg"` and so on, never generated by a template) and are looked up as literal strings (`$("helper-ding")`, never ``$(`helper-${f}`)``), because SB-2 needs both (eng-review-v4 N-3).
- `#helper-title` is added to the `#scale-title` rule (`600 13px/1.4 "Nunito Sans"`, `.09em`, uppercase), so it renders ENTER YOUR SCALE like ADD A SCALE (R4).
- `#helper-use` is added to the `#scale-generate` rule.
- `#scale-helper` sets `position:fixed; inset:0; background:#1f1b15; z-index:45`. The z-index sits above `#settings-trigger` (42) and below `#about` (50) and `.panghost` (60) (N1).
- `#helper-live` uses the existing `.sr-only` class and sits inside the helper's dialog, because a region outside an `aria-modal` dialog is out of reach (index.html's `#scale-refusal` comment says so for the sheet). `.announce` is not reused: it is the practice screen's visible message line, which `say()` writes.

### 2.3 Open, close, history, keys

| Event | Behaviour | Precedent in today's code |
|---|---|---|
| Tap `#help-open` | Clear `helperInertTimer`; un-hide `#scale-helper`; `setInert(true, [scaleSheet])`; `helperOpen = true`; `history.pushState({ scaleHelper: true }, "", location.href)`; clear `#helper-done`; prefill (2.6); paint (2.7); focus `#helper-back`; `track("scale_helper_open")`. | `openAbout` |
| `#helper-back` | `hideHelper()`, then `pendingPop = true; history.back()`. A pointer BACK holds `#scale-sheet` inert for 350ms (ghost-tap window, below); a keyboard BACK calls `liftSheetInert()` at once. | `closeScaleSheet`: it calls `hideSheet()` before `pendingPop=true; history.back()` (verified) |
| Escape | Same as BACK, and calls `liftSheetInert()` at once (not an activation). | global keydown |
| popstate while `helperOpen` (Back gesture) | `hideHelper()`; `liftSheetInert()`; the sheet stays. | popstate listener |
| Fragment navigation while `helperOpen` (a typed or linked `#...`) | Its popstate closes the helper through listener step 3 below and writes nothing; the sheet stays and no history step is taken. The `hashchange` that follows finds the destination in the bar and returns, as it does for any open sheet (its first line is `if (sheetOpen \|\| aboutOpen) return;`, verified). | "AO: a fragment navigation while About is open closes About and leaves the destination hash for hashchange" |
| popstate onto `{scaleHelper:true}` while the helper is closed (Forward, or Back from a fragment destination) | `pendingPop = true; history.back()`. The helper stays closed, the sheet stays open, and the position returns to the sheet's entry. | "AO: a Forward traversal onto #about leaves About closed and rewrites the bar" |
| `#helper-use` | Write, then close as BACK (2.8). | `useImport` |

**popstate listener order after H2b:**
1. `pendingPop` (unchanged). Its `syncRoute()` returns at once while `sheetOpen` (verified: `syncRoute` starts `if (sheetOpen \|\| aboutOpen) return;`).
2. `aboutOpen` (unchanged).
3. NEW: `if (helperOpen) { hideHelper(); liftSheetInert(); return; }`.
4. `location.hash === ABOUT_ROUTE` (unchanged).
5. NEW Forward guard: `if (sheetOpen && history.state && history.state.scaleHelper) { pendingPop = true; history.back(); return; }`.
6. `if (!sheetOpen) return;` and the sheet close (unchanged).

Why the guard steps back instead of only returning: a plain `return` leaves the position on the helper entry. The next Back would then land on the sheet's own entry, and the `sheetOpen` branch would close the sheet while the bar still read the sheet route. Stepping back keeps one Back equal to "close the sheet".

**Global `document` keydown order after H2b:**
1. `aboutOpen` (unchanged).
2. NEW `if (helperOpen) { ... return; }` branch, before `sheetOpen`:
   - Escape runs `closeHelper()`, which lifts inert at once through `liftSheetInert()`;
   - Tab runs `cycleTabStops(helperStops(), e)`;
   - every other key returns, as the `sheetOpen` branch does, so arrow keys never step the card.
3. `sheetOpen` (unchanged).
4. panel (unchanged).

`helperStops()` is `#helper-back`, `#helper-seed`, the four inputs, then `#helper-use` only when enabled. `#scale-helper` sits outside `#scale-sheet`, so the sheet's own Tab trap never sees these keys.

**Other behaviour:**
- **Ghost-tap window (eng-review-v3 C).** After a pointer-initiated USE or BACK, `#scale-sheet` stays `inert` for 350ms; then inert is lifted and focus goes to `#help-open`. The test is `e.detail > 0` is a pointer; anything else is a keyboard activation (eng-review-v5 N-2). A keyboard activation lifts inert at once; Escape and a popstate are not activations and also lift it at once. Why: USE copies the `#scale-generate` rule (52px) and `.helpersurf` copies `.sheetsurf`'s padding, so at 380x780 USE occupies y 706-758, GENERATE CARDS's box; writing the seed fires `input`, and `syncParseState` enables GENERATE CARDS synchronously, so the second tap of a double-tap would run `runGenerate` before the seed is reviewed (owner Q4). On Edit the tap would only arm DELETE, and a double-tap on BACK would reach the sheet's own BACK; the window covers all three. One timer, `helperInertTimer`, and one lift, `liftSheetInert()`: it clears the timer, runs `setInert(false, [scaleSheet])`, then moves focus to `#help-open` behind its guard, `sheetOpen && !helperOpen`. `hideSheet()` calls it after `sheetOpen = false`, so focus never lands on `#help-open` inside a closing sheet (eng-review-v5 N-3). The `#helper-done` write is not in `liftSheetInert()`: it runs on `helperInertTimer`, armed by USE only, behind the same guard (a pointer USE: the 350ms callback lifts, then writes; a keyboard USE: lift at once, then the same callback runs at 0ms, where its lift is a no-op; eng-review-v5 N-4). BACK's timer callback only lifts. Every path that ends the window calls it: the timer, a keyboard USE or BACK, Escape and popstate while the helper is open, `resetHelper()`, and `hideSheet()`. The timer always lifts. Only the focus move to `#help-open` and, after a USE only (never after BACK, Escape or a popstate), the `#helper-done` write are conditional on `sheetOpen && !helperOpen`. Opening the helper clears the timer before it sets inert again.
- **Close helpers (eng-review-v6 N-1).** `hideHelper()` sets `#scale-helper` hidden and `helperOpen = false`, cancels any pending `#helper-live` write (A1, eng-review-v10 N-3), then removes `--helper-vh` and `--helper-top` from the helper surface, skipped when the surface is falsy (2b, eng-review-v11 RC-2), and calls `applyKbOffset()` once. `closeHelper()` is BACK's body (`hideHelper(); pendingPop = true; history.back();`) followed by `liftSheetInert()`. Escape and a keyboard BACK run `closeHelper()`; a pointer BACK runs the same body and arms `helperInertTimer` in place of the lift. `helperOpen` is false before any `liftSheetInert()` runs, so its `sheetOpen && !helperOpen` guard is true when the lift moves focus to `#help-open` and when the USE callback writes `#helper-done`; clearing `helperOpen` after the lift would skip both silently.
- **Wiring (eng-review-v4 N-6).** `#helper-use` and `#helper-back` are wired with `addEventListener("click", ...)`, as `importUseBtn` is today, never `onclick`: the sandbox's `click()` reaches only `addEventListener` listeners. A sandbox click without `detail` has `e.detail` undefined, which the `e.detail > 0` test reads as a keyboard activation; A27 still passes `{ detail: 0 }` explicitly for its keyboard USE (eng-review-v5 N-2).
- **Focus on close (every path):** `#help-open`, when the sheet's inert lifts (at once, or after the 350ms window). Focusing `#scale-box` would raise the keyboard over the parse line.
- **Inert:** `setInert` sets inert and aria-hidden on `#scale-sheet`. `showSheet` has already made the rest inert through `background`.
- **Reload on the helper entry:** covered by the existing test "booting on a page route opens nothing and leaves a clean hash". Boot reads no `history.state`, so the helper cannot open. `syncRoute` writes `replaceState(history.state, ...)`, so a reload carries `{scaleHelper:true}` forward on the deck route. That is harmless: the Forward guard needs `sheetOpen`, which a boot never sets. IH-A9 is dropped (brief).
- **resetSheetState(edit):** calls `resetHelper()` (fields emptied, `helperOpen=false`, helper hidden, `#helper-done` cleared, `helperInertTimer` cleared, inert lifted through `liftSheetInert()`) in place of `resetImport()`.

### 2.4 Fields

| Input | Label (`<label class="sheetlabel" for>`) | Placeholder | Required | Octave | `enterkeyhint` |
|---|---|---|---|---|---|
| `#helper-ding` | DING | D3 | exactly one note | optional; default 3 | next |
| `#helper-top` | TOP RIM NOTES, LOW TO HIGH | A Bb C D E F G A | one or more | optional; inferred upward | next |
| `#helper-inner` | TOP INNER NOTES (OPTIONAL) | C5 D5 | no | optional; inferred upward from the last rim note | next |
| `#helper-bottom` | BOTTOM NOTES (OPTIONAL) | C3 Eb3 | no | optional; guessed (2.5 step 5) | done |

**Attributes on every input:**
- `type="text" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"`. These match `#scale-box`, verified on the textarea.
- `aria-describedby="helper-<f>-msg"`, and `aria-invalid="true"` only while that field has an error.
- 16px Bitter at a fixed 44px height (the Box item below). 16px is what stops iOS auto-zoom: the `#scale-box-wrap` rule pins it, and `applyKbOffset`'s zoom guard comment explains why.
- Box: `.helperbody input{box-sizing:border-box; height:44px; padding:0 var(--sp-3); font:400 16px/1.3 Bitter, serif; border:1px solid #433b2c; border-radius:8px; background:#151310; color:#eae6df}`. The height is fixed, not a minimum: `#import-ding`'s `padding:12px` renders 46.8px, a 65px row, which does not fit the 64.9px field region at 320x568 with a 260px keyboard (measured, design-review-v3 RC-2).

**Enter key:** Enter in the first three inputs moves focus to the next input and calls `preventDefault`. Enter in BOTTOM blurs. Enter never triggers USE.

**Focus scroll:** a `focus` listener on each helper input calls `reveal(f)` (2.7, SC2), which scrolls the whole `.fieldrow` (label, input and any shown message) into `.helperbody`, so the label scrolls in with its input. The browser's own focus scroll targets only the input; at 320x568 with a 260px keyboard it leaves TOP's label 7.7px under the caption (measured, design-review-v3 RC-3).

**What a field accepts** (2.5 step 1 is the rule):
- Letter names in either case: `a3`, `A3`, `bb3`, `Bb3`, `eb`.
- Accidentals `#`, `b`, `♯`, `♭`.
- Octaves -1 to 9; the `SCALE_NOTE_RE` range, probed: `(D-1) A-1` parses.
- Separators: spaces, commas, semicolons and line breaks.

**What a field refuses:**
- An uppercase second B.
- Solfege.
- Brackets and bars.
- Any other token.

### 2.5 Composition: `HPE.importer.compose({ding, top, inner, bottom})`

It lives in `src/engine/importer.js`, beside `interpret` and `serialise`, and is exported. `tools/inline_engine.py` copies it into the `engine:importer` region.

It returns:

```
{ ok, empty, line, seed, errors:{ding,top,inner,bottom}, info:{bottom}, guessed:[names], notes:{ding,top,inner,bottom} }
```

- `errors.<f>` is a string or null.
- `guessed` lists the bottom notes whose octave compose chose, written with that octave (e.g. `"C3"`, `"Eb3"`), in typed order.
- `notes` holds the resolved names per field, for the caption and for prefill symmetry.
- `empty` is true when all four fields are blank. In that case `ok` is false and every error is null.
- `ok` is true when the ding and at least one top note resolve, every error is null, and the final parse (step 6) is ok.

**The steps.** Every message cites its row in 2.10 (`M<n>`); `<X>` is the offending note as resolved, `<P>` the note before it in the same field, `<D>` the ding, `<T>` the highest top note.

1. **Read each field** (one reader per field; `readList` stays unexported and unused, eng 3).
   1. Trim, then split on `/[\s,;]+/`. Drop empty tokens.
   2. A token that contains `(`, `)`, `[`, `]` or `|` refuses the field: M1.
   3. A token matching `/^(do|r[eé]|mi|fa|sol|la|si|ti)(#|b|♯|♭)?(-1|[0-9])?$/i` refuses the field: M2 (owner).
   4. A token matching `/^([A-Ga-g])B(-1|[0-9])?$/` refuses the field: M3, with the letter upper-cased. For `BB3` this is the owner's "BB is not a note: write B-flat as Bb" with the final period every M-string carries (design-review-v4 N-1): "BB is not a note: write B-flat as Bb.". Every uppercase-B form (`EB`, `AB`, `DB`, `GB`, `CB`, `FB`, `BB`) gets the same message (owner round 4). `B` alone, or `b` alone, is the note B.
   5. Normalise: upper-case the first character, then map `♯` to `#` and `♭` to `b`. The second character, if it is `b` or `#`, is the accidental. So `bb3` becomes `Bb3`, `eb` becomes `Eb` and `a3` becomes `A3`.
   6. The result must match `/^([A-G])(#|b)?(-1|[0-9])?$/` (the `SCALE_NOTE_RE` shape), or the field is refused: M4.
   7. Range: a note with an octave, or after inference, outside C-1 to G9 is refused: M5. `Ab9` and `B9` are NOTE_OUT_OF_RANGE in `parseSeed` (probed). Compose reports that code under the field being staged.
2. **Ding.** There must be exactly one token: zero gives M6, two or more give M7. With no octave, the ding is octave 3, as `parseSeed` does (probe: `(D)` reads D3). The ding is validated by the reader alone, because `(D3)` on its own is NO_FIFTH (probed).
3. **Top (staged, eng 4).** An empty TOP gives M8. Otherwise, for k = 1..n, run `parseSeed("(" + ding + ") " + top[0..k-1].join(" "))`, ignoring NO_FIFTH, which `parseSeed` checks last (probe: `(D3) Bb3 G3` is NOTE_OUT_OF_ORDER, not NO_FIFTH). The first k that refuses owns the TOP message; names come from the accepted prefix's fields, so octaves read as inferred:
   - NOTE_OUT_OF_ORDER, k = 1: M9.
   - NOTE_OUT_OF_ORDER, k > 1: M10 (owner-approved wording, 2026-10-18).
   - NOTE_REPEATED: M11.
   - NOTE_OUT_OF_RANGE: M5.
   - any other code: M12, the engine's `reason` unchanged.

   No code is known to reach M12 here or in step 4 (design-review-v6 N-4). On origin/dev, `parseSeed` refuses with BAD_NOTE, NO_DING, NO_FIFTH, NOTE_OUT_OF_RANGE, NOTE_OUT_OF_ORDER and NOTE_REPEATED (`src/engine/core.js`, read). Steps 3 and 4 map the last three and ignore NO_FIFTH. BAD_NOTE does not arise: the reader has already refused brackets and bars (M1), solfege (M2), `BB`-style names (M3), any other token that is not a note (M4) and a pitch out of range (M5), and compose passes no options. NO_DING does not arise: compose writes exactly one ding, in parentheses, first. M12 stays as a fail-safe for a code a later engine adds. Step 6's final parse is covered by the same reasoning, with M17's octave-number clause (5.3) closing the one bottom spelling, `B#-2`, that is in range by pitch but not by octave (probed, eng-review-v7 N-1). Such a reason can run to four lines at 320 (three at 380, design-review-v7 N-1) and cite bracket syntax that M1 tells the user not to type; the cap (2.7) keeps its first line in view (measured, design-review-v6), and `#helper-live` speaks it in full.
4. **Inner (staged).** For j = 1..m, run `parseSeed("(" + ding + ") " + top.join(" ") + " | " + inner[0..j-1].join(" "))`, ignoring NO_FIFTH. The first refusal owns the INNER message:
   - NOTE_OUT_OF_ORDER, j = 1: M13 (N2).
   - NOTE_OUT_OF_ORDER, j > 1: M14.
   - NOTE_REPEATED, a duplicate of a top note or of an earlier inner note: M11, "<X> is already in the top or inner notes." One string covers both, so compose does not tell them apart (design-review-v5 N-2).
   - NOTE_OUT_OF_RANGE, any other code: as step 3 (M5, M12).

   The eng 4 scenario resolves by staging, not by string match. TOP `A Bb C` with INNER `C4` is NOTE_REPEATED under INNER ("C4 is already in the top or inner notes."); with INNER `Bb3` it is NOTE_OUT_OF_ORDER under INNER ("Bb3 is below the highest top note, C4."). An octaveless INNER `Bb` reads Bb4 and is accepted (probed).

   Then, only when TOP is non-empty and steps 3 and 4 produced no error, run the full ding+top+inner line once without ignoring anything (eng-review-v9 RC-1). If it is NO_FIFTH, the message goes under DING: M15, shown when the 2.7 message model settles, that is, once no field is being typed in (regroup v9). The fifth is sought among top and inner, not bottom (probes: `(D3) Bb3 | A4` parses; `[A2] (D3) Bb3` is NO_FIFTH). That rule is `parseSeed`'s; compose only places the message.
5. **Bottom (owner Q1, round 4).**
   1. Read tokens, in typed order. Bottoms are typed low to high (owner round 4).
   2. A token with an octave keeps it.
   3. A token without one gets a guess, walking left to right:
      - An octaveless bottom with no bottom before it (typed or guessed) takes the ding's octave number. If that gives the ding's midi, it goes one octave down (owner round 4: `D` under ding D3 is D2; `Db` under ding C#3 is Db2).
      - Every other octaveless bottom takes the lowest octave that puts it strictly above the bottom before it, by midi (typed or guessed). If that gives the ding's midi, it goes one octave higher.
      - So a guessed bottom may sit above the ding (owner round 4: "accept that a bottom note could be higher than the ding").
      - Examples with ding D3: `C Eb` gives C3 Eb3; `Bb` alone gives Bb3; `D` gives D2; `C D` gives C3 D4; `A Bb C` gives A3 Bb3 C4; `C2 Eb` gives C2 Eb2. With ding C#3, `Db` gives Db2.
      - Pygmy, ding F3, `C Db Eb Bb Db Ab` gives C3 Db3 Eb3 Bb3 Db4 Ab4 (the real pan has Ab5: one visible wrong guess, R4).
      - A guess outside C-1 to G9, or one whose octave number would be below -1 (only `B#` can do this, as `B#-2` under ding `B#-1`), gives M17.
      - The guessed names go into `guessed`, and `info.bottom` becomes M16.
   4. A bottom with the same midi as the bottom before it gives M19. This check runs before the order check (5.5), so equal pitches never read as out of order.
   5. Order: a bottom whose resolved pitch is not above the bottom before it is refused with M18 (the same owner-approved string as M10 and M14). Guessed octaves never trigger it (each guess steps upward); only a typed octave can.
   6. A bottom equal to a top pitch is allowed (probe: `(D3) A3 [A3] Bb3` parses to `(D3) [A3] A3 Bb3`). A bottom at the ding's midi can only be typed with an explicit octave (5.3 moves every guess off it); it is passed to `parseSeed` and takes whatever it says (probe: `[Db3] (C#3) G#3` parses).
6. **Line (eng 1).** Build `{status:"REVIEW", roles:{ ding:{note}, top:[{note}], inner:[{note}], bottom:[{note}] }}` from the step 3 and 4 parsed fields (`zone` rim and inner, octaves resolved) and the step 5 bottoms, and call `serialise` on it. `serialise` sorts by midi with tie rank bottom 0, ding 1, top 2, inserts `|` before the first inner note, then runs `parseSeed` and `formatSeed` (verified). This places Pygmy's `[Ab5]` after the bar (v1's naive "bottom before |" was refused: "F5 comes after the | but is below Ab5", probed) and puts a bottom that ties the ding before it (`[D3] (D3)` parses; `(D3) [D3]` is NOTE_OUT_OF_ORDER, probed). Compose then runs `parseSeed(line)` for `seed`. If that final parse refuses, which no test corpus reaches, its reason goes under BOTTOM (M12) and `ok` is false.

### 2.6 Prefill (owner Q3)

On open:
- If `parseSeed(scaleBox.value, sheetOptions())` is ok, fill the four fields from its `fields` by zone (`ding`, `rim`, `inner`, `bottom`). Every note is written with its octave and the notes are sorted by midi within a zone. Prefilled bottoms carry octaves, so nothing reads as guessed.
- Otherwise all four fields start empty.

Probe on the #372 head: for all five built-ins, the decomposed fields fed back through compose give `formatSeed` of the deck's fields. Pygmy gives `[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]`.

### 2.7 Live preview, caption and messages

- **Redraw:** synchronously on every `input` event of any helper field, with no `requestAnimationFrame` (eng 7: `tools/sandbox.js` defines none). The per-keystroke cost is one compose plus one solve. `updateParse` already does one parse plus one `paintPan` per keystroke of `#scale-box`.
- **Renderer:** `solvePreviewLayout(seed)` (reads the session `mirror`, `anchor`, `bottomMirror()`, `fitSeats`; writes no globals), then `pan({ geom, fields, colors:{root,tone} }, null, null)` into `#helper-preview`, with colours from `HPE.select.PALETTES[palette]`, as `paintPan` builds them. It never calls `paintPan`, which writes `#scale-preview`, `lastSeed` and `lastSolved`.
- **States:**
  - `example`: draws the scale composed from the four field placeholders, `[C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5`, dimmed, caption "Example pan. Yours appears here as you type." It is `compose` of the four inputs' `placeholder` values (the line parses on origin/dev, probed), drawn with the sheet's layout options and dimmed with `.stale` (opacity .62, the `#scale-preview.stale` value). Shown while all four fields are blank (C7).
  - `current`: compose ok. Full opacity. The caption is the line.
  - `held`: compose not ok and not empty. Show the last current drawing, dimmed, with caption C8 ("Showing your last valid scale."). If no `current` pan has existed since the helper opened, `held` shows the example and its caption ("Example pan. Yours appears here as you type.") instead of "Showing your last valid scale." The field message is already visible under the field, so the caption does not repeat it.
- **Caption box (owner T2, R2):**
  - `#helper-seed-box` has a fixed height of two lines: Bitter 14px/1.45, so `height: 2.9em`, plus `overflow:visible`.
  - `#helper-seed` uses `display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere`, colour `#c4bcab`.
  - On `:focus` (Tab, or a tap, since it has `tabindex="0"`), the clamp lifts. The caption then draws over the top of `.helperbody`, with `position:relative; z-index:1; background:#1f1b15`, inside the fixed box. Fields never move.
  - `#helper-seed` carries no `aria-label`. Guessed bottom octaves are stated in text in the BOTTOM NOTES info line ("Octaves guessed: Eb3. Type an octave to change a guess."), which is announced through `#helper-live` when it changes. The clamp is visual only, so the full line is already in the accessibility tree.
- **Preview label (design-v2 N-4):** `#helper-preview`'s `aria-label` is "Pan preview: " plus the full line, "Example pan" or "Last valid pan". In the label only, each note's accidental is spoken: `b` becomes " flat " and `#` becomes " sharp " (`Bb3` reads "B flat 3", `F#4` reads "F sharp 4"); brackets, parens and the bar are kept. The visible caption is unchanged.
- **Guessed octaves in the caption:**
  - Each bracketed token whose name is in `compose().guessed` is wrapped in `<span class="guess">`, styled `text-decoration: underline dotted #a79d8b`: the hint colour, not `#E27005`; orange stays reserved for errors and bottom-shell accents.
  - The match is exact on `[<name>]`, because `formatSeed` writes bottoms bracketed and two bottoms never share a midi.
  - `info.bottom` (M16) shows under BOTTOM in `.sheethint` grey. It is not an error: no `aria-invalid`, and USE stays enabled.
- **Field messages (display):**
  - Each `#helper-<f>-msg` is a `<p class="sheethint helpermsg">` directly under its input. `.helpermsg` carries `text-wrap:pretty`, so M16 at 380x780 does not end on a one-word line (design-review-v8 N-3, measured: no height change).
  - Error text is `#E27005` (the `#scale-box.bad` border colour, verified) at Bitter 14px/1.45, overriding `.sheethint`'s 11.5px (design-v2 N-6: `#E27005` on `#1f1b15` is about 4.5:1, so no orange text below 14px). The input border also turns `#E27005`.
  - Line counts: every fixed-text message but M15 is one line at 320, M1 included (M4 up to a token of about 10 characters, measured on real fonts); M4 with a longer token, M15 and the M16 info line can take two lines, and M12 up to four at 320 and three at 380; reveal's 4px cap (SC2 below) covers them (design-review-v5 N-4, design-review-v6 N-4, design-review-v7 N-1). M1 is one line at 320 since design-review-v6 RC-2, with 4.8px of slack (271.2 of 276px, design-review-v7 N-2): any edit to M1, or a font change, re-measures it on real fonts at 320.
- **Message model (regroup v9).** When a message shows, which field it sits under, what is announced and when the list scrolls are all derived from four state variables by one pure function. This replaces v8's per-event timing rules, the M15 hold flag and the RC-3 scroll trigger (cause: `regroup-v9-cause.md`).
  - **STATE.** Render, announce and SC1 read nothing else: no `document.activeElement` and no `relatedTarget`, so what shows and what is announced after an iOS blur with a null `relatedTarget` is exactly Chromium's. Two other reads exist, and neither decides what shows: SC3's `document.activeElement`, which picks a scroll target and writes no state (design-review-v9 RC-1), and the `blur` writer's `relatedTarget` (the `revealed` row), which decides only whether the next settled paint with the keyboard down may scroll (design-review-v10 RC-1). An iOS blur between two helper fields that reports a null `relatedTarget` counts as leaving; it costs at most one S10-style reveal at a later keyboard-close with focus kept, which the plan accepts (the blocking error wins, SC1). The writers and `paint()` run only while the helper is open (`helperOpen`): `applyKbOffset` and the field listeners write no state while it is closed, so a reopen starts from the open's own values (eng-review-v9 N-4).

    | Variable | Meaning | Writers (event, value) |
    |---|---|---|
    | `editing` | the helper field being typed in, or `null` | `input` on field f: f. `blur` on any helper input: `null`. The keyboard-close edge (a `kbUp` true-to-false edge, written by `applyKbOffset` after its style writes): `null`. A pinch-zoom is never this edge (the `kbUp` row). Helper open and `resetHelper()`: `null`. |
    | `kbUp` | a keyboard is up: `helperBox(...)` was non-null when last read at a scale of 1.01 or less (2b) | `applyKbOffset`: `next = helperBox(...) !== null`; when `visualViewport.scale <= 1.01` and `next !== kbUp`, set `kbUp = next` (compared against `kbUp`, never against the previous `helperBox` result; eng-review-v10 N-1). While the page is zoomed, `kbUp` keeps its value and no edge is read. The style writes still follow `helperBox` (zoom removes the offset as today). When the scale returns to `<= 1.01`, the next `applyKbOffset` compares against the kept value, so a keyboard that closed during the zoom produces exactly one close edge then (design-review-v9 RC-2, eng-review-v9 RC-3, A29). Helper open: `false` when `window.visualViewport` is absent (a default sandbox boot), else `helperBox(innerHeight, vv.height, vv.offsetTop, vv.scale) !== null`, computed once (a page zoomed at open starts with `false`). `resetHelper()`: `false`. |
    | `shown` | field to message currently on screen: its text, its kind (error or the M16 info) and whether it is stale | `paint()` only (render's output); helper open and `resetHelper()`: empty, and the open paint then fills it from R2 without announcing (A1). |
    | `revealed` | the field the error scroll last brought into view, or `null` | `paint()` (SC1): `null` after a paint while a field is being typed in; the C11 field after a settled paint with the keyboard down that has one; unchanged by any other paint, so a keyboard cycle with no input does not reveal again (eng-review-v9 RC-5). `blur` on a helper input whose `relatedTarget` is not one of the four helper inputs (`null` included): `null`, written before that blur's single paint, so a settled paint with the keyboard down reveals the C11 field again once focus has left the fields; a blur to another helper input leaves it alone (design-review-v10 RC-1, S24, IH-E13f). Helper open and `resetHelper()`: `null`. |

    `r = compose(values)` is derived on every paint, never stored. `paint()` runs after every write to `editing` or `kbUp` and after every `input` (which also redraws the preview, above), and does three things in order: RENDER, ANNOUNCE, SC1. Focus writes no state; it only scrolls (SC2). The keyboard-open edge scrolls after its paint (SC3).
  - **RENDER** `renderMessages(r, values, editing, shown)`, pure, returns `{shown', stale, invalid, useEnabled, note}`:
    - R1. `msg(f) = r.errors[f] ?? (f === "bottom" ? r.info.bottom : null)`, eligible only while f's value is non-empty; empty means `value.trim() === ""`, here and in R5 (eng-review-v9 N-3). Its kind is error when `r.errors[f]` is set and info otherwise. M6 and M8 describe an empty field, so they are never displayed; C9 says the same in the USE note.
    - R2. Settled (`editing === null`): `shown'` is every eligible message with its current text.
    - R3. Editing (`editing !== null`): `shown'` is the entries of `shown` whose field still has an eligible message of the same kind (error or the M16 info), each with its old text (eng-review-v9 RC-4). Nothing joins and no text changes while any field is being typed in; a message leaves on the first input, in any field, after which its field has none. This gates on "an edit is in progress", not on which field shows the message, so an error that DING causes under TOP (M9) waits exactly as M15 under DING does (design-review-v8 RC-1). A changed kind drops the entry, so an error never stands in for the info line, or the reverse (A22). A kept entry whose old text differs from its field's current `msg(f)` is stale: it renders in the `.sheethint` grey (`#a79d8b`), not orange, with the same text, size and position, so nothing reflows (class `stale` on `#helper-<f>-msg`). `invalid(f)` (border and `aria-invalid`) still follows R4: the field still has an error, so its border stays orange while the old text greys. A stale render is not announced. At settle, R2 restores the current text and colour (design-review-v9 RC-3, A22b). The M16 info line is already grey, so a stale M16 looks unchanged.
    - R4. `invalid(f)` (`aria-invalid` and the orange border) is true when `shown'[f]` is an error, stale or not, and not the M16 info. `useEnabled = r.ok`.
    - R5. USE note (`#helper-use-note`, `.sheethint` grey), exactly one string: if `r.ok`, C12 ("This replaces what is in the scale box.") when the box held text that did not parse (2.8), else empty; otherwise C11 ("Fix {FIELD} to continue.", the first field in visual order with an error in `shown'`); otherwise C9 ("Add the ding and the top notes to continue.") when DING or TOP is empty; otherwise C10 ("Finish the field you are typing in to check it."). C10 is reached only while editing: once settled, every error of a non-empty field is shown (R2), and the only errors of empty fields are M6 and M8, which C9 covers. So the note never names a message that is not shown. USE carries `aria-describedby="helper-use-note"`, so the reason is read even while the note is hidden (2b, focused compaction).
  - **ANNOUNCE.** A1. After a settled render other than the open paint, the texts in `shown'` that are new or differ from `shown`, in visual order and joined by a space, are announced: `#helper-live` is cleared at once and the text is written on a deferred tick (`setTimeout` 0, the share-copy precedent), so a string that left and returned is spoken again (eng-review-v9 N-2, A15b). A settled render with no new text, every render while editing (stale renders included) and the open paint write nothing. The open paint seeds `shown` from R2, clears `#helper-live` and any pending write, and leaves the messages it shows to each input's `aria-describedby` (design-review-v9 N-3, A17b); `resetHelper()` and `hideHelper()` also clear a pending write (eng-review-v10 N-3). Each settled write cancels any pending one (`clearTimeout`) before it schedules its own, so two settled paints in one task speak only the newer text (eng-review-v10 N-2, design-review-v10 N-3). Texts change only at settle, so each settled text is spoken once, and the M16 line that a ding being typed re-guesses on every keystroke is spoken once, after DING is left (design-review-v8 N-4). USE's announcement goes to `#helper-done` on the sheet (2.8).
  - **SCROLL.** `reveal(f)` sets `.helperbody.scrollTop` from `revealTop(top, h, rowTop, inputTop, rowBottom)`, a pure function over `.helperbody`'s scroll position and height and f's `.fieldrow` (label, input and shown message) in `.helperbody`'s content coordinates: `null` (no write) when the row is wholly inside; `rowTop` or `rowBottom - h`, whichever is nearer, when the row fits; `inputTop + 4` when it does not (the input's top sits 4px above the list's top and the message's first line follows it). The write is a plain `scrollTop` assignment, which is instant (`behavior:"auto"`), and `.helperbody` never declares `scroll-behavior` (design-review-v8 N-1). `reveal` never moves focus. `reveal(f)` first reads `document.querySelector("#scale-helper .helperbody")` and returns when it is null or has no `getBoundingClientRect`, before it touches f's input. It reaches f's row only after that, through f's input, taken from the same literal lookups the focus listeners use (`$("helper-ding")` and so on), and that input's `.closest(".fieldrow")` (eng-review-v13 N-1). (The sandbox's `document.querySelector` returns null for any compound selector, and its elements have no `querySelector`, `labels` or, outside a layout boot, `closest`.) The A tests therefore exercise `paint()`'s render, announce and `revealed` bookkeeping but never its scroll. SC1, SC2 and SC3 scrolls are proved only by IH-E13b to IH-E13g, which run in Chrome (eng-review-v9 RC-2).
    - SC1 (errors). In `paint()`: `t = (editing === null && !kbUp) ? the C11 field : null`; if `t` is not null and `t !== revealed`, `reveal(t)`. Then, if `editing !== null`, `revealed = null`; otherwise, if `t` is not null, `revealed = t` (a paint while the keyboard is up and no field is being typed in leaves `revealed` alone, so a keyboard cycle with no input does not re-reveal; eng-review-v9 RC-5, IH-E13f). When focus leaves the helper fields, the `blur` writer returns `revealed` to `null` before its paint, so the field the USE note names is in view whenever nothing is focused and the keyboard is down (design-review-v10 RC-1, S24). This acts only when focus leaves the four inputs, which are the only focusable elements inside `.helperbody` (2.2), so it never scrolls a focused field out of view; a keyboard cycle with focus kept still does not re-reveal. With the keyboard still up at that blur (S2, S7, S11), `t` stays null until the keyboard-close edge, which then reveals. An `applyKbOffset` write that leaves `kbUp` unchanged, a visual-viewport scroll and a user scroll do not call `paint()`, so they never scroll the list (design-review-v8 RC-2, IH-E13f). With the keyboard up and no field focused, `.helperbody` is 0px at 320x568 (eng-review-v8 N-7; the collapse lasts as long as the keyboard animation and is accepted, design-review-v8 N-2), so the error reveal waits for `kbUp` to fall. That edge also ends `editing`, so Android Back, which closes the keyboard and keeps focus, settles and reveals (design-review-v8 RC-3, A28, IH-E13e). The reveal may scroll the field just left out of view; the blocking error wins (design-review-v9 N-2). On a desktop Tab out of a field with no visual-viewport keyboard, SC1 reveals the first error and SC2 then reveals the newly focused field: two scroll writes in one task, the focused field's position final. That is intended (eng-review-v9 N-5).
    - SC2 (focus). The `focus` listener on each helper input calls `reveal(f)` (2.4). A message shown under a field that then receives focus is inside the row, so the row (or, too tall, its input and the message's first line) comes into view (IH-E13b, IH-E13c, IH-E13d).
    - SC3 (keyboard open). In `applyKbOffset`, on the edge where `kbUp` goes from false to true, after its style writes and the paint that the `kbUp` write runs: if `document.activeElement` is one of the four helper inputs, `reveal()` that input's field. It writes no state, and it is the only other `reveal` call site. An `applyKbOffset` write that leaves `kbUp` unchanged still scrolls nothing. A field focused before the keyboard opens is revealed by SC2 into the tall list and again by SC3 into the short one (design-review-v9 RC-1, IH-E13g).
  - **Scenarios.** Each row is the model's output; the last column names the test that proves it.

    | # | Scenario | Messages | USE | Note | Announced | Scroll | Test |
    |---|---|---|---|---|---|---|---|
    | S1 | DING `F3`, TOP typed `G`, `G Ab` with TOP focused | none | disabled | C10 (hidden by focused compaction; read via USE's description) | nothing | none | A15 |
    | S2 | S1, then TOP blurs at `G Ab` | M15 under DING | disabled | "Fix DING to continue." | M15, once | SC1 reveals DING if out of view and the keyboard is down | A15 |
    | S3 | S2, then TOP refocused and typed to `G Ab C` | M15 leaves at the input that adds C | enabled | empty | nothing | none | A15 |
    | S4 | Hijaz Edit: DING `C`, `C#`, `C#3` with DING focused | none | disabled, then enabled at `C#3` | C10, then empty (hidden by focused compaction; read via USE's description) | nothing | none | A15d |
    | S5 | S4, then Tab to TOP, then a tap outside | none | enabled | empty | nothing | SC2 reveals TOP | A15d, IH-E13b |
    | S6 | Hijaz Edit, TOP untouched: DING `A` (mid-typing, on the way to `A2`), DING still focused | none (no flash) | disabled | C10 (hidden by focused compaction; read via USE's description) | nothing | none | A15d |
    | S7 | S6, then DING blurs (to TOP, or a tap outside) | M9 under TOP (no stuck state) | disabled | "Fix TOP RIM NOTES to continue." | M9, once | SC1 reveals TOP when the keyboard is down | A15d |
    | S8 | S7 with TOP touched first (focused, input, blurred) | same as S6 then S7: there is no per-field touched state | as S7 | as S7 | as S7 | as S7 | A15d |
    | S9 | BOTTOM `c eb` settled with M16, then DING retyped (each key re-guesses) | M16 keeps its old text while DING is focused; the new text after DING blurs | enabled | empty | the new M16 text, once, after the blur | none | A15c |
    | S10 | Android Back: a later field (BOTTOM here, TOP in A28) focused and typed in, keyboard closes, focus kept, M15 under DING above the fold | M15 under DING | disabled | "Fix DING to continue." (hidden by focused compaction; read via USE's description) | M15, once | SC1 reveals DING; focus stays on BOTTOM | A28, IH-E13e |
    | S11 | iOS Done: blur, then the keyboard closes | settled at the blur | as the result | C11 or empty | once, at the blur | SC1 reveals at the keyboard-close edge | IH-E13e |
    | S12 | List scrolled by the user, keyboard up, a keyboard height change writes the offset | unchanged | unchanged | unchanged | nothing | none | IH-E13f |
    | S13 | iOS blur with a null `relatedTarget`, DING to TOP | as S7 (render and announce read no `relatedTarget`) | as S7 | as S7 | as S7 | as S7, except that the null `relatedTarget` also returns `revealed` to `null`, so a later keyboard-close with TOP still focused may reveal the C11 field once, as S10 does | A15 (blur with no `relatedTarget`) and A15d (blur carrying `relatedTarget` TOP) give the same outputs |
    | S14 | Disabled USE tapped while TOP (no fifth) is focused | Chromium and Android: the tap blurs TOP, so S2; iOS: if focus stays, none | disabled; the click writes nothing | C10 while focus stays | as the platform's blur | as S2 | A6, A15; iOS by R-6 |
    | S15 | BACK, Escape or a popstate while typing | the helper closes and writes nothing | n/a | n/a | the blur's settle, if any (pointer only, best-effort: its deferred write lands only if it fires before the click, and `hideHelper()` cancels it otherwise); nothing from the close | none | A8, A8b |
    | S16 | Helper open and `resetHelper()` | the open paint is settled: the prefill (valid, nothing shown) or blank fields (nothing eligible); a reopen prefills again from the box or starts blank (2.6), never the fields as left | from compose | empty, C9 or C11 | nothing (A1) | none | A11, A5, A17b |
    | S17 | A message's own field fixed, before any blur | it leaves at that input | from compose | from R5 | nothing | none | A22 |
    | S18 | A bad token typed, no message yet | none | disabled | C10 (hidden by focused compaction; read via USE's description) | nothing | none | A21 |
    | S19 | TOP being typed in with the keyboard up, holding a real error (A29: DING `F3`, TOP `G3 Ab3 Eb4 F4 G4 Ab4`, so M15 is pending; design-review-v10 N-5); a pinch-zoom (scale over 1.01), then the scale returns to 1 with the keyboard closed | nothing changes during the zoom; the settle happens once, at the unzoom | from compose | C10 (hidden by focused compaction; read via USE's description) during the zoom | nothing during the zoom; the settled text once | none during the zoom | A29 |
    | S20 | S2 settled, then DING retyped from `F3` to `G3`, DING focused | M15 keeps its F3 text, in grey (stale); DING keeps its orange border; the G3 text in orange after DING blurs | disabled | "Fix DING to continue." (hidden by focused compaction; read via USE's description) | nothing; the G3 text once after the blur | none | A22b |
    | S21 | BOTTOM `Eb3 C3` settled with its order error, then edited to `Eb3 c`, no blur | the error leaves at that input (its kind changed to info); M16 joins at the blur | enabled | empty | nothing; M16 once after the blur | none | A22 |
    | S22 | Keyboard down, M16 under BOTTOM, BOTTOM focused, then the keyboard opens | unchanged | unchanged | unchanged | nothing | SC3 reveals BOTTOM at the keyboard-open edge | IH-E13g |
    | S23 | S10's settle, then the keyboard opens and closes again with focus kept and no input | unchanged | unchanged | unchanged | nothing | none (`revealed` is still DING) | IH-E13f |
    | S24 | S23, then a tap outside the helper fields (focus leaves, keyboard down) | unchanged | unchanged | "Fix DING to continue." | nothing | SC1 reveals DING (`revealed` was returned to `null` by the blur) | IH-E13f |

    S16's reset of `editing` has no observable effect, so no test and no mutant: until the first `input`, `blur` or keyboard edge after an open, the fields are either a valid prefill (compose ok, nothing to show) or blank (nothing eligible, C9 either way), and any of those three events overwrites `editing` (eng-review-v8 N-5, section 7 v9 adaptation 6). `shown` and `revealed` are recomputed by the open paint itself, which announces nothing (A1). Two accepted states leave the USE note naming a field that is out of view, and neither is a defect (design-review-v10 N-2): a user scroll after the settle with nothing focused (probe X2; a user scroll is never undone, design-review-v8 RC-2), and the keyboard-up transient after a blur (S2, S7 and S11 with the keyboard up), which lasts until the keyboard-close edge reveals the field (design-review-v8 N-2).

### 2.8 USE THIS SCALE

- Enabled only while `compose().ok`.
- On click:
  1. `scaleBox.value = line`;
  2. dispatch `input` as `useImport` does today (`new Event("input",{bubbles:true})`, with the sandbox fallback object);
  3. `hideHelper()`;
  4. `pendingPop = true; history.back()`;
  5. focus `#help-open` when the sheet's inert lifts (`liftSheetInert()`, 2.3): at once for a keyboard USE, after the 350ms ghost-tap window for a pointer USE, and only while `sheetOpen && !helperOpen`;
  6. `#scale-parse.scrollIntoView({block:"nearest"})` (N8);
  7. `track("scale_helper_use")`;
  8. when the sheet's inert lifts (after a keyboard USE, on `helperInertTimer` armed at 0ms, so `resetHelper()` and helper open clear it as they clear the 350ms window; 350ms after a pointer USE, on the same timer), write "Scale added to the box." (C14) into `#helper-done`. The sheet must be back in the accessibility tree first, and an inert sheet is not (precedent for the deferred write: `#share-copy` writes LINK COPIED after a deferred tick, "SI: a second COPY LINK clears the message line before writing LINK COPIED again"). Opening the helper clears it.
- The line holds every guessed bottom octave explicitly, so the box never relies on `parseSeed`'s own positional bottom inference. That inference differs from the owner's rule: `(D3) A3 [C]` reads `[C4]` (probed).
- Overwrite with no confirm (owner Q4); BACK is the cancel. If the box held text that did not parse, the USE note reads C12 while USE is enabled.

### 2.9 Analytics (owner Q8)

- `scale_helper_open` and `scale_helper_use`, both with no params.
- `scale_import` stops firing when `runImport` is removed.
- The test "no event param is a string over 40 characters or names a custom: id" swaps its import step for a helper USE, and asserts that a `scale_helper_use` event exists.

### 2.10 Copy (all of it)

Chrome and notes (`C<n>`):

| ID | Where | Text |
|---|---|---|
| C1 | `#help-open` | NEED HELP? |
| C2 | `#help-hint` | Enter your scale and we will generate the scale syntax. |
| C3 | `#helper-title` | Enter your scale (renders ENTER YOUR SCALE) |
| C4 | `#helper-back` | ← BACK, accessible name "Back to the scale sheet" |
| C5 | Labels | DING; TOP RIM NOTES, LOW TO HIGH; TOP INNER NOTES (OPTIONAL); BOTTOM NOTES (OPTIONAL) |
| C6 | Placeholders | D3; A Bb C D E F G A; C5 D5; C3 Eb3 |
| C7 | Caption, example (and `held` with no history) | Example pan. Yours appears here as you type. |
| C8 | Caption, held | Showing your last valid scale. |
| C9 | USE note, missing | Add the ding and the top notes to continue. |
| C10 | USE note, pending | Finish the field you are typing in to check it. |
| C11 | USE note, error | Fix {FIELD} to continue., where {FIELD} is the first invalid field in visual order, named DING, TOP RIM NOTES, TOP INNER NOTES or BOTTOM NOTES (its C5 label up to the first comma or parenthesis, trimmed). Example: "Fix TOP RIM NOTES to continue." |
| C12 | USE note, overwrite | This replaces what is in the scale box. |
| C13 | Primary | USE THIS SCALE |
| C14 | `#helper-done` after USE | Scale added to the box. |
| C15 | Preview `aria-label` | Pan preview: <line, accidentals spoken> / Example pan / Last valid pan |

Field messages (`M<n>`, cited by 2.5):

| ID | Where | Text |
|---|---|---|
| M1 | Bracket or bar | Type notes only: the line is written for you. |
| M2 | Solfege | Use letter names, like D A Bb. |
| M3 | Uppercase B | <L>B is not a note: write <L>-flat as <L>b. |
| M4 | Other token | "<token>" is not a note: try C, F# or Bb. |
| M5 | Range | <X> is outside C-1 to G9. |
| M6 | Ding empty | Enter the ding, like D3. |
| M7 | Ding, two notes | Enter one note for the ding. |
| M8 | Top empty | Enter the top notes, low to high. |
| M9 | Top order, first note | <X> is not above the ding, <D>. |
| M10 | Top order, later note | <X> is lower than <P>: list low to high. |
| M11 | Repeated | <X> is already in the top or inner notes. |
| M12 | Any other engine refusal | the engine's `reason` string, unchanged |
| M13 | Inner order, first note | <X> is below the highest top note, <T>. |
| M14 | Inner order, later note | <X> is lower than <P>: list low to high. |
| M15 | No fifth (DING) | No fifth above the ding <D>: add <L> to the top notes, or check the ding. |
| M16 | Bottom guess (info) | Octaves guessed: <names>. Type an octave to change a guess. |
| M17 | Bottom, no octave fits | <L> has no octave that fits: type one. |
| M18 | Bottom order | <X> is lower than <P>: list low to high. |
| M19 | Bottom repeat | <X> is already in the bottom notes. |

## 2b. Design and layout

**Within the system:**
- Existing tokens only. Surface `#1f1b15`; `.mode`; `.sheetlabel`; `.sheethint` and its `#a79d8b`; error `#E27005` (text only at 14px or larger); the deck palette for the pan.
- Labels and buttons are Nunito Sans caps, as on the sheet. Inputs and the caption use Bitter. The title follows the `#scale-title` rule, not Marcellus (R4).
- One bold element, the live pan. No cards, no numbering, no motion (About precedent: "AO: About has no transition or animation with and without prefers-reduced-motion").
- `.helpersurf` copies `.sheetsurf`'s padding (`var(--sp-3) var(--sp-4) max(var(--sp-4), env(safe-area-inset-bottom))`) and is a flex column with `gap:var(--sp-3)`.
- `.helperbody` gets `overflow-y:auto; overscroll-behavior:contain; padding-inline:var(--ring); margin-inline:calc(-1 * var(--ring))`, copied from `.sheetbody`, so focus rings are not clipped (R5), and `gap:var(--sp-2)` between its four field rows.

**Plate (stacked, owner T2):**
- The pan square is `clamp(72px, calc(var(--helper-vh, 100dvh) * 0.32 - 24px), 220px)`.
- The caption box sits under it at a fixed 2.9em (41px).
- `--helper-vh` is the visual viewport height (keyboard model below).

**Focused compaction (RC1).** Under `.helpersurf:has(.helperbody input:focus)` (keyboard up): `#helper-use-note` is `display:none` and USE carries `aria-describedby="helper-use-note"`, so the reason is still read; `.helpersurf` block padding becomes `var(--sp-2)` top and bottom with no safe-area term (`padding:var(--sp-2) var(--sp-4)`); the inline padding stays `var(--sp-4)` so the column never changes width on focus (design-review-v3 RC-4; the budget counts block terms only); gaps become `--sp-2`; USE is 44px. While no field is focused, `#helper-use-note` keeps a reserved 1-line height (`min-height:1.45em`) whether or not it has text, so the column never reflows as compose flips. (The selector is `:has(... input:focus)`, not RC1's `:focus-within`; section 7, adaptation 1. Precedent: `.sheetbody:has(input:focus, ...)`, index.html:1071.)

**Keyboard model (one formula, eng nit):**
- New pure function `helperBox(innerHeight, vvHeight, vvOffsetTop, scale)`. It returns `null` when `scale > 1.01` (the `applyKbOffset` zoom guard) or when `vvHeight >= innerHeight`. Otherwise it returns `{ height: round(vvHeight), top: round(vvOffsetTop) }`.
- `applyKbOffset()` keeps its gate `if (!vv || !sheetSurf || !sheetOpen) return;`. While `helperOpen` it writes `--helper-vh` and `--helper-top` on `.helpersurf` from `helperBox(...)` (or removes both on null), only on change, and does not touch `sheetSurf`. Otherwise it runs exactly as today. The helper surface is `scaleHelper.firstElementChild`, read at each use (`applyKbOffset()` and `hideHelper()`). When it is falsy (the sandbox gives `undefined`: it builds that child for `#scale-sheet` only, and its `style` stub has no `removeProperty`), the style writes and removals are skipped, and the `kbUp` edge, `paint()` and SC3 still run. The write is guarded and the function never returns early, so A28 and A29 exercise the edge in the sandbox and the e2e tests exercise the writes (eng-review-v10 RC-B).
- `.helpersurf` is `position:fixed; left:0; right:0; top:var(--helper-top,0px); height:var(--helper-vh,100dvh)`.
- `hideHelper()` (defined in 2.3, "Close helpers") removes both properties from the helper surface, skipped when it is falsy as above (eng-review-v11 RC-2), and calls `applyKbOffset()` once, so the sheet surface resyncs.
- A `mousedown` on any helper `.sheetlabel` calls `preventDefault()` (through the one delegated listener described at the end of this bullet). A press on a label then leaves focus in the field being typed in until the label's click moves it to the label's own input, so that blur carries the input as `relatedTarget`, keeps `revealed`, and SC1 does not scroll the list under the pointer. Without it, the press blurs the field with a null `relatedTarget`, SC1 scrolls `.helperbody` during the press, and the click lands on another node, leaving focus on the body (eng-review-v11 RC-1). The listener does nothing else: it moves no focus and writes no state. The focus move is the browser's own label activation through `for=`, which also keeps each label as its input's accessible name. Activation that is not a press (a screen reader's click; keyboard users never land on a label) is unchanged, and a touch tap focuses the input as a mouse press does (probed, `v12probe/`). The one cost is that a mouse drag-selection or double-click that starts on a label selects nothing (section 7, accepted gaps). The listener is one delegated `mousedown` listener on `#scale-helper` that calls `preventDefault()` when `e.target.tagName === "LABEL"` (or `e.target.classList` contains `sheetlabel`). No code calls `scaleHelper.querySelectorAll`, `querySelector` on any element, or `input.labels`: the sandbox's elements have none of them, and a throw at boot reddens every app test.

**Budgets (every rendered term; tokens at index.html `:root`: phone `--sp-2` 8, `--sp-3` 14, `--sp-4` 22; desktop, `min-width:640px and min-height:700px`, 12, 20, 28).** The e2e relations in IH-E1, IH-E13, IH-E13b and IH-E2 are the proof, measured on real fonts (H2b). design-review-v3 built the column from this plan's CSS in Chromium with web fonts and measured every row below within 1px of this arithmetic, except the desktop row term, corrected here (N-1).
- Focused: padding 8 + 8, header 44, caption 41, USE 44, three gaps of 8 (the note is `display:none`): **pan + 169**.
- Unfocused: padding 14 + max(22, safe area) (34 on a notched phone), header 44, caption 41, note 17 (1.45em of 11.5px), USE 52 (the `#scale-generate` rule), four gaps of 14: **pan + 246** (258 notched).
- A field row is label 14 (9.5px x 1.5) + 4 (`--sp-1`) + input 44 = 62 (measured 62.25; the input is a fixed 44, 2.4 Box). Four empty rows with three `--sp-2` gaps: 272 on a phone. On desktop `--sp-1` is 6 and `--sp-2` 12, so a row is 64.25 and four rows need 293 (design-review-v3 N-1). A showing message adds 20 a line (14px x 1.45).

| Viewport, keyboard, focus | Visual viewport | Pan | Region for fields | Needs |
|---|---|---|---|---|
| 380x780, 300, focused | 480 | 130 | 181 | the focused row, 62 |
| 380x780, 340, focused | 440 | 117 | 154 | 62 |
| 320x568, 260, focused | 308 | 75 | 64 (measured 64.9) | 62.25: label and input fit with 2.6px once the focus scroll (2.4) brings the label in; when focus arrives on a field with a shown message, reveal's 4px cap (2.7 SC2) keeps the input's text and the message's first line in view (IH-E13, IH-E13b, IH-E13c, IH-E13d) |
| 380x780, none, unfocused | 780 | 220 | 314 (302 notched) | 272: no scroll. With the two-line M16 info line showing (section 6 step 3), the content is 273 + 4 (row gap) + 40.6 = 317.6 against a measured 314.2, so the list scrolls by 3.4px; USE stays pinned below the list and in view, so nothing the user needs is hidden (design-review-v7 RC-2) |
| 320x568, none, unfocused | 568 | 158 | 164 (152 notched) | 272: the field list scrolls |
| 1280x800, none, unfocused | 800 | 220 | 298 (desktop tokens: padding 20 + 28, gaps 20) | 293 (rows 64 at desktop `--sp-1` 6): no scroll with no messages showing, 5px to spare |

**Tightest margin (design-review-v3 N-5).** The 2.6px slack at 320x568 with a 260px keyboard is the tightest number in the plan. IH-E13 guards the label and input, IH-E13b the focus row scroll, IH-E13c the message under a field that receives focus (design-review-v4 RC-2), and IH-E13d reveal's 4px cap that keeps the typed text in view under a two-line message (design-review-v5 RC-1). Any new rendered term in the focused column (a gap, a border, a line of copy) must re-run that case before it lands. IH-E13d's own bounds (design-review-v6 N-5, eng-review-v6 N-4): 4.5px of the input is hidden (scrollTop rounds to whole pixels) against the 8px bound, and 21.4px of the message is inside `.helperbody` against the 20px bound, 1.4px of headroom; under the no-cap mutant the input is hidden by 23.5px, so the 8px bound kills it with 15px to spare. A copy or spacing change that moves either figure re-runs IH-E13d on real fonts. IH-E13e guards the error row once the keyboard closes at 320x568: the row (input 44, gap 4, a two-line message 40.6) needs about 89px, more than the 64px region with the keyboard up and less than the 164px region with it down (design-review-v7 RC-3). With the keyboard up and no field focused the region is 0px (measured, eng-review-v8 N-7), so the error reveal waits for the keyboard-close edge (2.7 SC1); IH-E13f guards that no other keyboard-offset write scrolls the list (design-review-v8 RC-2). IH-E13g guards SC3, the focus-then-keyboard order of a real phone (design-review-v9 RC-1). The 2.6px figure above was measured with the keyboard raised first. H2b re-measures it in the focus-then-keyboard order on real fonts and records the figure in its PR (design-review-v9 N-5).

**Wireframe A (380x780, 300px keyboard, focus in TOP):**

```
+--------------------------------------+ 0
| [<- BACK]  ENTER YOUR SCALE          | 52
|            (pan 130, stacked)        |
| (D3) A3 Bb3 C4 D4 E4 F4 G4 A4        | caption box 41, fixed, 2 lines max
|--------------------------------------| 239
| TOP RIM NOTES, LOW TO HIGH           | .helperbody scrolls, focused field
| [ A Bb C D E F G A|               ]  |   kept in view
| (message)                            |
|--------------------------------------| 420
| [ USE THIS SCALE ] 44 (focused mode) |
+--------------------------------------+ 480 keyboard top
```

**Wireframe B (320x568, 260px keyboard):** the same column with a 75px pan. One field shows at a time between the caption and USE.

**Landscape (eng 8, design-v2 N-1):**
- `@media (max-height:520px) and (min-width:560px)` makes `.helpersurf` a grid: `grid-template-columns:auto 1fr; grid-template-rows:auto 1fr auto auto; grid-template-areas:"head head" "plate body" "plate note" "plate use"`.
- `.sheethead` spans both columns at the top. `#helper-plate` (pan plus caption) fills the left column below it, with the pan at `clamp(120px, calc(100dvh - 170px), 232px)`, the same expression as `#scale-layout-zone.open #scale-preview`. `.helperbody`, `#helper-use-note` and `#helper-use` stack in the right column.
- The same `max-height:520px` query swaps the spacing tokens to 3/6/9/14 (index.html `:root`) and USE to 44px. Measured at 844x390 with those tokens and the 520px surface cap (design-review-v3 N-2): the pan is 220, the plate ends at 376, and USE ends at 376 unfocused or 384 focused; the 258px right column wraps TOP's label to two lines (row 75.5) and the USE note to two lines, and the field list scrolls (292 in 218). These wraps and that scroll are expected: H2b does not "fix" them.
- With the keyboard up, the preview may crop (owner Q7).

**Desktop (1280x800):** the surface width matches `.sheetsurf` at that width, centred. The pan caps at 220. With no messages showing, nothing scrolls (budget above).

## 3. What is removed (inventory re-taken at origin/dev b153406)

L1b merged to dev in #373 (b153406). eng-review-v2 re-took this inventory there: it matches, plus the IM describe wrapper and two dev CLAUDE.md bullets, both folded below.

**Owner decision (2026-10-18, binding):** keep `src/engine/importer.js`, its tests (`tests/import.test.js`, `tests/import_gold.test.js`) and the `i_*` mutants. H2a removes only:
- the paste-box UI (`#import-row` and its controls, CSS and listeners);
- its app copy (`IMPORT_FLAG_TEXT`, `importFlagLine`, `IMPORT_INSUFFICIENT`);
- the app-side IM tests in `tests/app.test.js` and `tests/e2e.test.js`;
- the `ib_*` mutants that target that UI. All 17 patch `index.html` app code outside the engine region (checked: each `+++ b/index.html` hunk changes import UI or `IMPORT_FLAG_TEXT` copy), so all 17 go.

Nothing under `src/engine/`, no engine region, and no `i_*` patch is touched by H2a or H2b.

Enumerated by reading every hit of `import-`, `importRow`, `showImport`, `scale_import`, `IMPORT_` and `import(Row|OpenBtn|Text|Run|Use|Ding|Ticks|Flag)` across `tests/`, `tools/` and `tests/mutants/`, then reading each enclosing test title. I did not trust one pattern (memory "Enumerate callers, do not grep for them"). `tests/import_gold.test.js` and `tools/regen_import_gold.js` match only engine and gold paths, and are kept. No `i_*` patch matches those patterns (checked at b153406).

**index.html (outside the engine region):**
- Markup `#import-row` with its 12 ids, plus `#import-ding-row` and the dynamic `import-tick-*` boxes.
- The import CSS block.
- Constants `importRow` to `importUseBtn`, `IMPORT_INSUFFICIENT` and `IMPORT_FLAG_TEXT`, including L1b's added lines.
- Functions `importFlagLine`, `paintImportUse`, `paintImportBody`, `paintImport`, `buildImportPicker`, `runImport`, `pickImportDing`, `useImport`, `setImportOpen`, `resetImport` and their listeners.
- The import stops in the sheet Tab trap.
- `track("scale_import", ...)`.

H2a removes all of these. H2b then adds the 2.1 to 2.8 helper code in their place.

**tools/sandbox.js ELEMENT_IDS:** H2a removes the 12 import ids. H2b adds exactly the ids the H2b app code looks up (SB-2, "every served id is in the markup and is looked up by the app", requires both markup and a lookup), these 18, each a literal `id="..."` in the served markup and a literal-string lookup in the app (SB-2; eng-review-v4 N-3):
- on the sheet: `help-row`, `help-open`, `helper-done`;
- `scale-helper`, `helper-back`, `helper-preview`, `helper-seed`;
- `helper-ding`, `helper-top`, `helper-inner`, `helper-bottom`;
- `helper-ding-msg`, `helper-top-msg`, `helper-inner-msg`, `helper-bottom-msg`;
- `helper-use-note`, `helper-use`, `helper-live`.

`help-hint`, `helper-title`, `helper-plate` and `helper-seed-box` are markup-only. If later code looks one up, add it in the same commit.

**Kept:** `HPE.importer.interpret`, `serialise`, `tests/import.test.js`, `tests/import_gold.test.js`, the 57 `i_*` mutants, `tools/regen_import_gold.js`.

**tests/app.test.js, 16 IM tests** (15 in `describe("IM: import text on the sheet")`; the first row below sits at 9593 in `describe("discoverability: analytics events")`, eng-review-v4 N-1):

| Test | Fate |
|---|---|
| "IM: importing tracks one scale_import per IMPORT with the status only and no pasted text" | deleted; IH-A10, IH-A10b |
| "IM: USE writes exactly serialise(r) into #scale-box, fires input, and the parse line matches typing it" | deleted; IH-A7, IH-A7b |
| "IM: any BLOCK disables USE, and a click on it writes nothing" | deleted; IH-A6 |
| "IM: a CONFIRM needs a tick before USE enables, and unticking disables it again" | deleted; no ticks |
| "IM: a DING_CUE CONFIRM is satisfied by a tick or by a picked ding" | deleted; no picker |
| "IM: picking a ding on the Ding: D Top: E F G Bb fixture leaves the picker enabled and the flag set equals interpret(text, {ding: i})" | deleted; no picker |
| "IM: a picked ding refreshes every inferred octave and clears the NO_OCTAVE tick" | deleted; no picker |
| "IM: a picked ding clears CONFLICTING_DING" | deleted; no picker |
| "IM: the ding picker shows on every NEEDS_INPUT or REVIEW list, including a REVIEW list with no DING_CUE" | deleted; no picker |
| "IM: a NO_OCTAVE row marks each inferred octave, and an inferred bottom row says its placement is a guess" | deleted; IH-A17 (guess marking) |
| "IM: INSUFFICIENT shows one line, writes nothing to #scale-box and offers no preset" | deleted; IH-A6 |
| "IM: opening the sheet again drops the old paste and review" | deleted; IH-A11 |
| "IM: every code in the engine's FLAG_ORDER has an IMPORT_FLAG_TEXT line, and the L1 codes read in plain English" (L1b) | deleted with `IMPORT_FLAG_TEXT` |
| "IM: the import row ships hidden: #import-row carries the hidden attribute in the served markup and IMPORT TEXT is not in the sheet's focus order" | deleted; IH-A1 |
| "IM: the import controls join the sheet's focus order, in visual order, only while shown" | deleted; IH-A2 |
| "IM: importing makes no fetch and sends no beacon" | deleted; IH-A12 |

app.test.js `describe("IM: import text on the sheet")` (10646 at b153406) and its setup lines before the first IM test: deleted with its 15 tests; the 16th, at 9593 in the analytics describe, is deleted alone. Locate each by title, not by line. `showImport` is called at 7387 (DR3), 9596 (inside that 16th test) and 9616 (the "no event param ..." test).

**tests/app.test.js, rewritten (not IM):**
- H2a deletes the helper `function showImport(app)`; H2b adds `showHelp(app)`, which un-hides `#help-row`;
- "DR3 Tab order on Add and Edit, finer controls closed and open": H2a drops its `showImport(app)` call and `"import-open"` from its `want` list; H2b adds `showHelp(app)` and `"help-open"` in the same slot;
- "no event param is a string over 40 characters or names a custom: id": H2a drops the import step and its `scale_import` assertion, so between H2a and H2b the test keeps running with no event-existence assertion (eng-review-v4 N-1); H2b adds a helper USE and asserts a `scale_helper_use` event exists.

**tests/e2e.test.js:**
- H2a deletes describe "import text on the sheet" with its 4 tests (their H2b successors):
  - "IM: at 380x780 and 320x568 an open import with a result has no horizontal scroll, runs off no side, and leaves the guidance slot and the primary where they were" becomes IH-E3;
  - "IM: at 380px the Add sheet shows no IMPORT TEXT control" becomes IH-E0;
  - "IM: real Tab keys walk scale-box, then IMPORT TEXT, and an open area adds the paste box and IMPORT" becomes IH-E6;
  - "IM: an import sends zero network requests" becomes IH-E8.
- Rewritten (H2a removes the import part, H2b adds the help part):
  - the describe-scope helper `const showImport`: H2a deletes it, H2b adds `showHelp`;
  - "DR1 focus order: on Edit the plate is a tab stop only while the drawer is open, and comes before the toggle": H2a drops `showImport()` and `"import-open"`; H2b adds `showHelp()` and `"help-open"`;
  - "RD: the Edit page's Tab order is BACK, name, box, ADJUST LAYOUT, swatches, SAVE CHANGES, DELETE with the drawer closed, forward and back, and no stop is a select": H2a drops `showImport()` and `"import-open"`, and `select:not(#import-ding)` becomes `select`; H2b adds `showHelp()` and `"help-open"`.

**Mutants:**
- H2a deletes all 17 `ib_*` patches:
  - block_does_not_disable_use
  - bottom_guess_unmarked
  - confirm_needs_no_tick
  - conflicting_list_variants_merged
  - flag_text_parens_missing
  - import_controls_not_tab_stops
  - import_row_not_hidden_e2e
  - import_row_not_hidden
  - inferred_octave_unmarked
  - insufficient_shows_review
  - insufficient_writes_box
  - pick_keeps_inference
  - pick_keeps_octave_tick
  - picker_needs_ding_cue
  - scale_import_untracked
  - use_fires_no_input
  - use_writes_nothing
- H2a re-anchors three non-ib patches, not deleting them (H2b re-checks that they still apply after its code lands, and re-anchors again only if one breaks):
  - `a_seed_refusal_below_the_pan` (import markup comment in context);
  - `d_sheet_focus_stays` (the `/* ---- import text (scale-import lane B) ---- */` comment in context);
  - `dr3_tab_list_omits_disclosure` (the `importRow.hidden ? [] : [...]` stops line in context).
  - Each is rewritten against a stable anchor, and the reviewer applies it and reads the failing assertion (memory "Hand-regenerated mutants drift"). `index` lines are stripped (memory "Mutant patches reject index lines"), and each `# suite:` header uses `.` wildcards and no quotes (memory "Mutant `# suite:` headers are word-split").
- The two `i_*` hits (`i_earlier_run_not_flagged`, `i_parens_as_bottom_not_flagged`) touch `src/engine/importer.js` only. H1 must keep them applying: compose is appended, and H1 runs `git apply --check` over all 57.

**CLAUDE.md:** "Scale import" ("Hidden", "Sheet", "No network" and "Flag copy" bullets; "Engine pins (lane L1b)" stays) and the Discoverability analytics bullet (the tenth event `scale_import`). See H3.

**Dropped from v1:** IH-A9 and `ih_boot_opens_helper`. The test duplicated "booting on a page route opens nothing and leaves a clean hash", and the mutant had no state reader to mutate.

## 4. Lanes (/swarm)

The lanes run serially: H1, then H2a, then H2b, then H3. H0 is an integrator step in two parts (H0a in place of H2a's PR D, H0b after H2b's PR D merges), both on `claude/dev-sync-*` branches cut from dev. H1, H2a and H2b all touch README:77 and FLOORS, H2a and H2b both own `index.html`'s app block and the two app test files, and H2b and H3 both touch tests that CLAUDE.md cites, so parallel lanes would conflict. Serial order keeps one owner per file at a time. Each lane:
- opens PR M to main (stays open, G-A);
- has PR D to dev merged under G-C (except H2a, whose PR D is CONFLICTING and is superseded by H0a);
- uses a `claude/import-helper-h<n>` worktree, TDD;
- branches as section 5 says.

### H1: engine `compose`

**Owns:**
- `src/engine/importer.js`;
- the `engine:importer` region of `index.html` (via `python3 tools/inline_engine.py` only);
- `tests/import.test.js`;
- new `tests/mutants/ih_e_*.patch`;
- `tests/fixtures/engine_corpus_v1.json` only if `node tools/regen_engine_corpus.js --check` reports drift (it should not: compose is additive);
- `tests/suite_health.py` row `"tests/import.test.js"` (63 at b153406);
- `README.md` line 77 count, and line 55 (`importer.js` description: "product text, or the helper's four fields, to a scale string").

**Tests first** (`tests/import.test.js`, describe "IH: compose"), each with its mutant:

| # | Title | Mutant |
|---|---|---|
| E1 | IH: compose infers rim and inner octaves exactly as parseSeed does for the same line | ih_e_inner_octave_not_inferred |
| E2 | IH: compose places bottoms through serialise, after the bar when they sit above an inner note and before a ding of the same pitch | ih_e_bottom_before_bar |
| E3 | IH: compose of each built-in's decomposed fields equals formatSeed of that deck, Pygmy included | ih_e_builtin_roundtrip |
| E4 | IH: compose guesses the first octaveless bottom in the ding's octave, an octave down when it names the ding, and lists it in guessed, and Db under ding C#3 reads Db2 | ih_e_ding_match_by_letter (the ding test compares letter and accidental, not midi: Db under C#3 reads Db3; replaces v2's ih_e_guess_ding_named_kept, which it subsumes) |
| E5 | IH: compose keeps a typed bottom octave, lists no guess for it, and sets info only when something was guessed | ih_e_typed_octave_marked_guessed |
| E6 | IH: compose reads lowercase notes: a3, bb3 and eb read as A3, Bb3 and Eb | ih_e_lowercase_refused |
| E7 | IH: compose refuses an uppercase second B: BB3 gives "BB is not a note: write B-flat as Bb." and EB gives "EB is not a note: write E-flat as Eb." | ih_e_bb_read_as_flat |
| E8 | IH: compose refuses solfege with "Use letter names, like D A Bb." | ih_e_solfege_message_generic |
| E9 | IH: compose reads # b ♯ ♭ and splits on spaces, commas, semicolons and line breaks | ih_e_unicode_flat_unread |
| E10 | IH: compose refuses brackets and bars typed into a field | ih_e_bracket_accepted |
| E11 | IH: compose stages its parse: a top order error is under TOP with "X is lower than Y: list low to high.", a top note below the ding says so, a top pitch repeated in INNER is NOTE_REPEATED under INNER, and an octaveless inner Bb over top C4 reads Bb4 | ih_e_stage_skipped |
| E12 | IH: compose puts NO_FIFTH under DING and never NO_FIFTH under TOP while a prefix is staged, and reports no NO_FIFTH while TOP is empty (DING F3 alone carries no DING error) | ih_e_no_fifth_on_top |
| E13 | IH: compose refuses bottoms out of order with "X is lower than Y: list low to high.", refuses a repeated bottom, and accepts a bottom copy of a rim pitch | ih_e_bottom_order_unchecked |
| E14 | IH: compose refuses notes outside C-1 to G9 in each field, and an octaveless bottom whose guess falls outside that range | ih_e_range_unchecked |
| E15 | IH: compose of four blank fields is empty, not ok, and carries no errors | ih_e_empty_reports_errors |
| E16 | IH: compose steps each later octaveless bottom to the lowest octave above the one before it, so Pygmy's octaveless bottoms read C3 Db3 Eb3 Bb3 Db4 Ab4 | ih_e_guess_restarts_at_ding (every guess from the ding's octave) |
| E17 | IH: compose steps a later octaveless bottom past the ding's midi: under ding D3, bottoms C D read C3 D4 | ih_e_later_guess_lands_on_ding (the later guess stays on D3; the line `[C3] [D3] (D3) A3` still parses, probed, so only this test sees it) |

Each patch header is `# kills: <title>` and `# suite: node --test --test-name-pattern ^IH:.compose.<words-with-dots> tests/import.test.js` (memory "Mutant `# suite:` headers are word-split").

**Acceptance:**
- all 17 pass;
- each `ih_e_*` patch makes its suite fail;
- all 57 `i_*` patches still `git apply --check` and stay killed;
- `inline_engine.py --check` is clean;
- FLOORS and README:77 equal CI's counts; expected README:77 is 1149 (1132 at dev plus 17) and the `tests/import.test.js` row 80 (63 plus 17, arithmetic; CI's artifact governs);
- `interpret`, `serialise`, `parseSeed` and `formatSeed` outputs are unchanged (engine corpus `--check` clean).

**Verify:**

```
bash <<'VERIFY'
node --test tests/import.test.js tests/import_gold.test.js tests/core.test.js \
 && python3 tools/inline_engine.py --check && node tools/regen_engine_corpus.js --check \
 && python3 tools/validate.py && test $(ls tests/mutants/ih_e_*.patch | wc -l) -eq 17 && LOG=$(mktemp) \
 && { for p in tests/mutants/i_*.patch; do git apply --check "$p" || echo "STALE $p"; done; \
      for p in tests/mutants/ih_e_*.patch; do cmd=; git apply --check "$p" || { echo "NOAPPLY $p"; continue; }; git apply "$p"; cmd=$(grep -m1 '^# suite:' "$p" | sed 's/^# suite:[[:space:]]*//'); if $cmd >/dev/null 2>&1 </dev/null; then echo "SURVIVED $p"; fi; git apply -R "$p"; done; } 2>&1 | tee "$LOG" \
 && ! grep -q 'SURVIVED\|NOAPPLY\|STALE' "$LOG"
VERIFY
```

The loop shape is eng-review-v4 N-5: a patch that does not apply prints NOAPPLY and is skipped, `cmd` is reset each pass so a stale suite never runs, a missing `# suite:` header leaves `cmd` empty and reads as SURVIVED (fail closed), and the final `grep` fails the chain on any SURVIVED, NOAPPLY or STALE line. The H2a and H2b loops have the same shape.

Every Verify block runs under bash: paste it between `bash <<'VERIFY'` and `VERIFY`, never bare into the Bash tool, whose shell here is zsh. zsh does not word-split `$cmd` or `$M` and aborts a loop on an unmatched glob, which reads a surviving or missing mutant as killed (eng-review-v5 RC-1). `CHROME_BIN` must be exported for the inner shell to see it, and the H2a and H2b blocks open with a check that it names an executable, because an unset `CHROME_BIN` skips the e2e step and reports a pass (eng-review-v6 N-3).

Each loop's `if $cmd >/dev/null 2>&1 </dev/null; then` gives the suite an empty stdin, so a missing `# suite:` header cannot hang on a bare redirection (eng-review-v5 RC-1). Every block's body passes `bash -n`.

`tests/mutation_check.sh` has no name filter (only `MUTANT_SHARD`, verified), hence the loop. CI `validate` at the pushed head SHA is the evidence.

**Non-goals:** no app code; no change to existing engine exports' behaviour.

### H2a: remove the paste UI (the importer engine stays)

**Owns:**
- `index.html` outside engine regions and the DECKS line, for removals only (the section 3 index.html list);
- `tests/app.test.js` and `tests/e2e.test.js`: deleting the 16 app IM tests (15 in the IM describe, the 16th alone in the analytics describe), the 4 e2e IM tests, both IM describe wrappers and both `showImport` helpers, and the H2a half of the rewrites in section 3;
- `tools/sandbox.js` ELEMENT_IDS: removing the 12 import ids;
- deleting the 17 `ib_*` patches;
- re-anchoring the three patches named in section 3;
- `tests/suite_health.py` rows `"tests/app.test.js"` (623 at b153406) and `"tests/e2e.test.js"` (335). H2a lowers them to 607 and 331. 623 and 335 are node-reported counts (a `test(` regex gives 588 and 324); CI's artifact governs (eng-review-v5 N-7). These are this lane's own rows for files it owns, lowered for a deliberate removal of 16 and 4 tests; tests/CONTRACT.md's "never lower someone else's row" does not apply, and a reviewer must not FAIL the lane for it (eng-review-v4 N-2);
- README:77 (after H1's number).

**Tests first.** H2a adds no behaviour, so it adds no test and no mutant. Its order is: delete the IM tests and the `showImport` helpers, apply the H2a half of the three rewrites (section 3), re-anchor the three patches, then remove the app code. SB-2 ("every served id is in the markup and is looked up by the app") and the acceptance grep are the guards against a half-removal.

**Acceptance:**
- the 16 app and 4 e2e IM tests, both IM describe wrappers and both `showImport` helpers are gone; every other test passes, and "no event param is a string over 40 characters or names a custom: id" still runs, without its `scale_import` assertion until H2b;
- no IM test, `showImport`, import id or `ib_*` patch remains: `grep -rn 'import-\|showImport\|importRow\|scale_import' index.html tests tools | grep -v 'import-v2'` prints nothing (the kept `import-v2` plan and gold paths in tests/import_gold.test.js, tools/regen_import_gold.js and tests/fixtures/import_gold_v1.json are the only allowed hits), and `ls tests/mutants/ib_*.patch 2>/dev/null` prints nothing;
- the three re-anchored patches each make their suite fail, for the reason the reviewer reads in the failing assertion (R2), and each `# suite:` header uses `.` wildcards and no quotes;
- all 57 `i_*` patches still `git apply --check`;
- `#import-row` is absent from the served markup and nothing replaces it yet;
- FLOORS and README:77 equal CI's counts; expected README:77 is 1132 (1149 minus 17) and the rows 607 and 331.

**Verify:**

```
export CHROME_BIN
bash <<'VERIFY'
test -x "$CHROME_BIN" || { echo "set CHROME_BIN to a Chromium binary"; exit 1; }
node --test tests/app.test.js tests/harness.test.js tests/import.test.js tests/import_gold.test.js \
 && CHROME_BIN="$CHROME_BIN" node --test --test-name-pattern '^DR1.focus|^RD:.the.Edit.page' tests/e2e.test.js \
 && python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py \
 && test -z "$(grep -rn 'import-\|showImport\|importRow\|scale_import' index.html tests tools | grep -v 'import-v2')" \
 && test -z "$(ls tests/mutants/ib_*.patch 2>/dev/null)" && LOG=$(mktemp) \
 && { for p in tests/mutants/i_*.patch; do git apply --check "$p" || echo "STALE $p"; done; \
      for p in tests/mutants/a_seed_refusal_below_the_pan.patch tests/mutants/d_sheet_focus_stays.patch tests/mutants/dr3_tab_list_omits_disclosure.patch; do cmd=; git apply --check "$p" || { echo "NOAPPLY $p"; continue; }; git apply "$p"; cmd=$(grep -m1 '^# suite:' "$p" | sed 's/^# suite:[[:space:]]*//'); if $cmd >/dev/null 2>&1 </dev/null; then echo "SURVIVED $p"; fi; git apply -R "$p"; done; } 2>&1 | tee "$LOG" \
 && ! grep -q 'SURVIVED\|NOAPPLY\|STALE' "$LOG"
VERIFY
```

CI `validate` at the verified head SHA is the evidence. Run H2a's, H2b's and H3's Verify blocks in the lane worktree (based on 5a5f7f0 or its descendants), never on a dev checkout: dev's overlay fails 35 app tests (eng-review-v8 N-8).

**Non-goals:**
- no helper markup, CSS, code, ids, tests or mutants (H2b);
- no engine edits: `src/engine/importer.js`, the `engine:importer` region, `tests/import.test.js`, `tests/import_gold.test.js` and the `i_*` mutants stay as they are (owner decision, section 3);
- no CLAUDE.md edits;
- no change to the drawer, the guidance slot, `#scale-preview`, GENERATE CARDS or `pendingPop`'s type.

### H2b: app helper

Branches from H2a's head.

**Owns:**
- `index.html` outside engine regions and the DECKS line (the 2.1 to 2.8 and 2b helper code);
- `tests/app.test.js`; `tests/e2e.test.js` (the IH tests and the H2b half of the rewrites in section 3);
- `tools/sandbox.js` ELEMENT_IDS: adding the 18 ids in section 3;
- the 63 new `tests/mutants/ih_*.patch` named below (none starts `ih_e_`);
- re-anchoring any of the three section 3 patches again, only if H2b's code breaks its anchor;
- `tests/suite_health.py` rows `"tests/app.test.js"` and `"tests/e2e.test.js"` (from H2a's CI artifacts; expected 646 and 354, which is 607 plus 39 and 331 plus 23, arithmetic);
- README:77 (after H2a's number).

**Tests first, app** (`tests/app.test.js`, describe "IH: scale helper"), one mutant each:

| # | Title | Mutant |
|---|---|---|
| A1 | IH: the help row ships hidden: #help-row carries the hidden attribute in the served markup and NEED HELP? is not in the sheet's focus order | ih_help_row_not_hidden |
| A2 | IH: NEED HELP? joins the sheet's focus order after #scale-box only while shown | ih_help_not_tab_stop |
| A3 | IH: NEED HELP? opens the helper, pushes one {scaleHelper:true} entry with the URL unchanged and focuses BACK | ih_no_history_entry |
| A3b | IH: while the helper is open #scale-sheet is inert and aria-hidden | ih_sheet_not_inert |
| A4 | IH: each input event redraws the preview synchronously and the caption text carries the full composed line | ih_preview_not_redrawn |
| A4b | IH: the preview's aria-label is "Pan preview: " and the line with accidentals spoken, so Bb3 reads B flat 3 and F#4 reads F sharp 4 | ih_aria_flat_as_b |
| A5 | IH: the preview shows the example when empty and holds the last valid pan, dimmed, when a field is invalid | ih_no_held_state |
| A6 | IH: USE THIS SCALE is disabled while compose is not ok, the USE note says why, and a click writes nothing | ih_use_enabled_on_error |
| A6b | IH: the USE note names the first invalid field in visual order ("Fix TOP RIM NOTES to continue." with TOP and BOTTOM both invalid), and USE is aria-describedby the note, and with only BOTTOM invalid the note reads "Fix BOTTOM NOTES to continue." | ih_use_note_last_field |
| A7 | IH: USE THIS SCALE writes compose's line into #scale-box, the parse line matches typing it, and focus lands on NEED HELP? | ih_use_writes_nothing |
| A7b | IH: USE THIS SCALE fires one bubbling input event on #scale-box | ih_use_fires_no_input |
| A8 | IH: BACK and Escape each close the helper, keep the sheet open, write nothing and focus NEED HELP? | ih_escape_closes_sheet |
| A8b | IH: a popstate while the helper is open closes only the helper, keeps the sheet open and writes nothing | ih_popstate_closes_sheet |
| A10 | IH: opening the helper tracks scale_helper_open with no params | ih_open_untracked |
| A10b | IH: USE tracks scale_helper_use with no params, never the line | ih_use_tracks_line |
| A11 | IH: opening the helper on a box that parses fills the four fields by zone with octaves; on an empty or unparsed box they start empty | ih_no_prefill |
| A12 | IH: the helper makes no fetch and sends no beacon | ih_use_beacons |
| A13 | IH: the helper opens from the Edit sheet and USE leaves the deck unsaved until SAVE | ih_edit_no_helper |
| A14 | IH: typing in the helper never writes #scale-preview, lastSeed or lastSolved | ih_writes_last_seed |
| A15 | IH: no field message appears while a field is being typed in: G and G Ab in TOP under ding F3 show nothing and the USE note reads C10; TOP's blur shows M15 under DING with aria-invalid, announces it once and the note names DING; typing C clears it | ih_message_on_first_key (render shows every eligible message while editing) |
| A15b | IH: only a new message reaches #helper-live; a re-render with the same text writes nothing | ih_live_repeats |
| A15c | IH: while a field is being typed in, a shown message keeps its text and nothing is announced; leaving the field updates the text and announces it once | ih_text_updates_while_editing (R3 takes the current text) |
| A15d | IH: an error that DING causes under TOP waits for DING's blur, whether or not TOP was touched, and DING's blur shows it even when the blur carries TOP as relatedTarget | ih_hold_only_typed_field (while editing, messages join in every field but the one being typed in) |
| A16 | IH: a Forward traversal onto the helper's entry leaves the helper closed, keeps the sheet open and steps back to the sheet's entry | ih_forward_closes_sheet |
| A17 | IH: a guessed bottom octave is underlined in the caption, named in the BOTTOM info line, leaves USE enabled, and USE writes the octave | ih_guess_unmarked |
| A17b | IH: a changed BOTTOM info line is announced once through #helper-live, and #helper-seed has no aria-label | ih_guess_info_silent |
| A18 | IH: every helper input has autocapitalize off, autocorrect off, spellcheck false, a label, and enterkeyhint next or done; Enter moves to the next field and Enter on BOTTOM never triggers USE | ih_enter_triggers_use |
| A19 | IH: helperBox is null with no keyboard or when zoomed, and otherwise the visual viewport's height and offsetTop | ih_helper_box_ignores_offset |
| A20 | IH: Tab cycles BACK, the caption, the four inputs and an enabled USE, a disabled USE is not a stop, and Escape inside the helper never closes the sheet | ih_disabled_use_tab_stop |
| A21 | IH: while a field holds a bad token that no message shows yet, the USE note reads "Finish the field you are typing in to check it." | ih_pending_note_missing |
| A22 | IH: a field message clears on the first input that makes the field valid, before any blur | ih_message_waits_for_blur |
| A22b | IH: a kept message whose text no longer matches its field renders stale: after DING changes F3 to G3 with TOP G Ab, #helper-ding-msg keeps its old text with class stale and DING keeps aria-invalid; after the blur it has no stale class and reads the new message | ih_stale_keeps_error_colour (render never marks a kept entry stale) |
| A23 | IH: the example pan is compose of the four placeholders, [C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4 \| C5 D5, dimmed | ih_example_from_scale_box (draws `scaleBox.placeholder`, v2's source) |
| A24 | IH: an invalid field before any valid pan keeps the example and its caption, never "Showing your last valid scale." | ih_held_caption_without_history |
| A25 | IH: after USE, "Scale added to the box." is written into #helper-done on the sheet once the sheet's inert lifts (a deferred tick after a keyboard USE), and opening the helper clears it, and a pointer BACK (click detail 1) leaves #helper-done empty after advance(350) | ih_use_silent (its pointer-BACK clause is a regression clause with no mutant of its own) |
| A26 | IH: a fragment navigation while the helper is open closes the helper, keeps the sheet open, steps no history and leaves the destination hash for hashchange | ih_fragment_nav_stepped_back (the helper's popstate branch also runs `pendingPop = true; history.back()`) |
| A28 | IH: the keyboard closing with focus kept ends the edit: M15 shows under DING, the note names DING, and focus stays on TOP | ih_kb_close_keeps_editing (the keyboard-close edge leaves editing set) |
| A29 | IH: a pinch-zoom never ends the edit: with TOP being typed in and the keyboard up, a resize at scale 2 and full height shows no message and announces nothing, and a later resize at scale 1 and full height settles once | ih_zoom_reads_edge (kbUp follows helperBox's null-ness at any scale, so the zoom reads as a close edge) |
| A27 | IH: after a pointer USE (click detail 1) on the Add sheet, #scale-sheet is still inert at 100ms and no longer inert at 350ms, focus then lands on NEED HELP? and GENERATE CARDS runs; after a keyboard USE (click detail 0, passed explicitly) inert lifts at once; a pointer USE followed by Escape at 100ms closes the sheet, and #scale-sheet carries no inert or aria-hidden immediately after Escape closes it, before any advance or reopen, and reopening it leaves `#scale-sheet` without `inert` or `aria-hidden` | ih_use_ghost_tap (no inert window) |

A9 is intentionally absent (section 3). A28 and A29 sit before A27 in the table and after it in number. 39 app tests. No A test asserts a scroll position; `reveal` is a no-op in the sandbox (2.7 SCROLL). A1 writes `#helper-live` on a deferred tick, so each test that reads it after a settle first calls `app.flushTimers()` (precedent: "SI: a second COPY LINK clears the message line before writing LINK COPIED again"); an assertion that it is unchanged needs no flush. A27 runs on the sandbox's virtual clock (`boot` with `opts.clock`, then `advance(100)` and `advance(250)`) and fires the pointer USE with `click(el, { detail: 1 })` and the keyboard USE with `click(el, { detail: 0 })` (eng-review-v5 N-2). "GENERATE CARDS runs" is a liveness check only: `genBtn.onclick = runGenerate` runs whether or not the sheet is inert, so the inert assertions carry the kill (eng-review-v4 N-6). The assertion made immediately after Escape, before any advance or reopen, pins `liftSheetInert()` on the `hideSheet()` path; the reopen clause alone would not, because reopening runs `resetSheetState`, then `resetHelper()`, which lifts too (eng-review-v4 RC-3, eng-review-v5 N-1). Neither clause adds a mutant. A25's pointer-BACK clause and A27's post-Escape clause are regression clauses with no mutant of their own (eng-review-v6 N-6). The message-model tests (2.7, regroup v9) drive the state through the sandbox's real event paths: `input` is dispatched after setting a value, a blur is `app.els[id].dispatchEvent({ type: "blur" })` (with `relatedTarget` only where stated; the sandbox passes the object as is, with no `target`, so each input's `input` and `blur` listeners take their field from their closure, one listener per input, never from `ev.target`, eng-review-v11 N-2), and the sandbox's `focus()` and `blur()` set focus but dispatch no event, so a test that needs a settled render dispatches `blur` itself. Each expected message is read from `HPE.importer.compose(values)` in the test, never typed out. A6, A6b, A15b, A17, A17b and IH-E16 dispatch a `blur` on the field they typed into before asserting a field message or the info line. A15's steps: open the helper on the Add sheet with an empty box; set DING to `F3`, dispatch `input`, then `blur`; record `#helper-live`'s text; call `app.els["helper-top"].focus()`, then set TOP to `G`, `G `, `G Ab` and `G Ab ` in turn, dispatching `input` after each; after each, assert that `#helper-ding-msg` is hidden, `#helper-ding` has no `aria-invalid`, `#helper-live` is unchanged and the USE note is C10. The mutant fails at `G`, because `(F3) G3` is already NO_FIFTH (eng-review-v8 N-1). Then dispatch `blur` (no `relatedTarget`) on `#helper-top`: M15 shows under DING, `#helper-ding` has `aria-invalid="true"`, `#helper-live` holds M15 and the note is "Fix DING to continue.". Then focus TOP, set `G Ab C`, dispatch `input`: `#helper-ding-msg` is hidden and `#helper-ding` has no `aria-invalid`. A15c's steps: open on an empty box; set DING `F3`, TOP `G3 Ab3 C4` and BOTTOM `c eb`, dispatching `input` then `blur` on each; BOTTOM shows `compose(...).info.bottom` (T1) and `#helper-live` holds T1. Assert that compose with DING `C3` gives a non-null `info.bottom` T2 different from T1. Focus DING, set `C3`, dispatch `input`: BOTTOM's message is still T1 and `#helper-live` still holds T1 (the mutant fails here, showing T2). Dispatch `blur` on DING: BOTTOM shows T2 and `#helper-live` holds T2. A15d's steps: open the helper from the Edit sheet on C# Hijaz 9 (DING `C#3`, TOP `G#3 B3 C#4 D4 F4 F#4 G#4 B4`), record `#helper-live`; focus DING, set `C`, `C#` and `C#3` in turn with `input` after each, asserting after each that `#helper-ding-msg` and `#helper-top-msg` are hidden and `#helper-live` is unchanged; dispatch `blur`: no message, USE enabled. Focus DING, set `A` (`(A) G#3 B3 ...` is NOTE_OUT_OF_ORDER, design-review-v8), dispatch `input`: `#helper-top-msg` is hidden, `#helper-live` unchanged, the note is C10 (the mutant fails here, joining M9 under TOP). Dispatch `{ type: "blur", relatedTarget: app.els["helper-top"] }` on DING: M9 shows under TOP, which was never touched, `#helper-top` has `aria-invalid="true"`, `#helper-live` holds M9 and the note is "Fix TOP RIM NOTES to continue.". Then the touched variant: focus TOP, set TOP to its own value, dispatch `input` and `blur`: M9 is still shown and `#helper-live` is unchanged. A15 blurs with no `relatedTarget` and A15d with one, so a reintroduced `relatedTarget` branch fails one of them (eng-review-v8 RC-1). A28's steps: `boot({ layout: true, innerHeight: 800, visualViewport: { height: 400, offsetTop: 0, scale: 1 } })` (the sandbox's visual viewport, as app.test.js already uses it), open the helper on the Add sheet, set DING `F3` with `input` and `blur`, focus TOP, set `G3 Ab3 Eb4 F4 G4 Ab4` and dispatch `input`: no DING message. Set `window.visualViewport.height = 800` and dispatch `resize` on it: M15 shows under DING, the note is "Fix DING to continue.", `#helper-live` holds M15, and the sandbox's focused element is still `#helper-top` (the mutant fails here: no message). A29's steps: boot and open as A28, set DING `F3` with `input` and `blur`, focus TOP, set `G3 Ab3 Eb4 F4 G4 Ab4` and dispatch `input`, then `app.flushTimers()` and record `#helper-live`. Set `window.visualViewport.scale = 2` and `height = 800` and dispatch `resize`: after `app.flushTimers()`, `#helper-ding-msg` is hidden, `#helper-live` is unchanged and the note is C10 (the mutant fails here: the zoom reads as a close edge and M15 shows). Set `scale = 1` (height stays 800) and dispatch `resize`: after `app.flushTimers()`, M15 shows under DING and `#helper-live` holds M15. Dispatch `resize` once more: `#helper-live` receives no second write. Design-review-v9's "no `scrollTop`" clause is not stated, because the sandbox cannot observe it (v10 adaptation 1). A22b's steps: open on an empty box; set DING `F3` and TOP `G Ab`, dispatching `input` then `blur` on each; M15 (from compose) shows under DING. Assert that compose with DING `G3` and TOP `G Ab` puts an error under DING whose text differs from the F3 one (a precondition). Focus DING, set `G3` and dispatch `input`: `#helper-ding-msg` keeps the F3 text and carries class `stale`, `#helper-ding` keeps `aria-invalid="true"`, and `#helper-live` is unchanged (the mutant fails here: no `stale` class). Dispatch `blur` and `app.flushTimers()`: `#helper-ding-msg` has no `stale` class, reads compose's G3 text, and `#helper-live` holds it. The sandbox computes no styles, so the grey itself is IH-E16's stale clause. A22's regression clause (eng-review-v9 RC-4, no mutant of its own): with DING `D3` and TOP `A Bb C D E F G A` (eng-review-v10 N-4), BOTTOM `Eb3 C3` settled shows the order error; set `Eb3 c` and dispatch `input` with no blur: `#helper-bottom` has no `aria-invalid` and `#helper-bottom-msg` is hidden. A15b's regression clause (eng-review-v9 N-2, no mutant of its own): with M15 shown and announced, TOP's `C` added and then deleted, each with `input`, then `blur`, writes `""` to `#helper-live` and, after `app.flushTimers()`, M15 again. A17b's two regression clauses (design-review-v9 N-3, eng-review-v10 RC-A, eng-review-v11 N-1, no mutant of their own). (1) Set DING `D3`, TOP `A Bb C D E F G A` and BOTTOM `c eb`, dispatching `input` then `blur` on each, and call `app.flushTimers()`, so `#helper-live` holds the M16 line; close with BACK, then reopen on the same Add sheet with `#scale-box` empty. Before any flush, the four fields are empty (2.6), no message shows and `#helper-live` is empty; this fails if the open paint leaves the old text in the live region. (2) Set the same three values again, dispatching `input` then `blur` on each, with no `app.flushTimers()` after BOTTOM's blur, so the M16 write is pending; close with BACK, reopen with `#scale-box` empty, then call `app.flushTimers()`: `#helper-live` is empty; this fails if neither `hideHelper()` nor the open paint cancels the pending write. Neither clause isolates A1's rule that the open paint announces nothing (eng-review-v11 N-1).

**Tests first, e2e** (`tests/e2e.test.js`, describe "scale helper"; keyboards via `b.fakeKeyboard(vvHeight)` from `tests/helpers/cdp.js`; tests un-hide `#help-row` through `showHelp`), one mutant each except IH-E13f, which carries two:

| # | Title | Mutant |
|---|---|---|
| IH-E0 | IH: at 380px the Add sheet shows no NEED HELP? control | ih_help_row_not_hidden_e2e |
| IH-E1 | IH: at 380x780 with 300 and 340px keyboards and at 320x568 with 260, for each of the four fields, the focused input is inside the visual viewport and not under USE, and the pan's top edge is visible | ih_kb_not_applied |
| IH-E2 | IH: at 380x780 keyboard down, 844x390 (two columns) and 1280x800 the preview, every field and USE THIS SCALE are reachable and USE never overlaps a field | ih_landscape_one_column |
| IH-E2b | IH: the first field's top does not move between an empty helper and the F3 Low Pygmy prefill, and the caption box height is the same in both | ih_caption_grows |
| IH-E3 | IH: at 380x780 and 320x568 the open helper has no horizontal scroll and runs off no side | ih_overflow_x |
| IH-E4 | IH: every helper control is a 44px target at 380x780 | ih_small_target |
| IH-E6 | IH: real Tab keys cycle inside the helper and never reach the sheet; real Escape closes only the helper | ih_tab_escapes |
| IH-E7 | IH: real keys typed into the four fields, then USE, leave #scale-box byte-equal to typing the line and the sheet preview equal to the typed one | ih_use_line_differs_e2e |
| IH-E8 | IH: the helper sends zero network requests | ih_helper_fetch_e2e |
| IH-E9 | IH: the Back gesture closes the helper and one more Back closes the sheet | ih_back_gesture_closes_sheet |
| IH-E10 | IH: at 1280x800 BACK then Forward leaves the sheet open and the helper closed, and one Back then closes the sheet and the bar ends on the deck's route | ih_forward_closes_sheet_e2e |
| IH-E11 | IH: focusing the caption on the Pygmy prefill shows the whole line without moving the first field | ih_caption_not_expandable |
| IH-E12 | IH: at 380x780 the settings trigger is not hit-testable over the open helper | ih_trigger_over_helper |
| IH-E13 | IH: at 320x568 with a 260px keyboard and TOP focused, TOP's label top is at or below .helperbody's top and its input's bottom is at or above .helperbody's bottom, and both are inside the visual viewport | ih_use_note_kept_focused (the note stays displayed while an input is focused) |
| IH-E13b | IH: at 320x568 with a 260px keyboard, focusing TOP from BOTTOM scrolls TOP's whole .fieldrow, label included, inside .helperbody | ih_focus_scroll_row (drops the `reveal(f)` call in the focus listener, SC2) |
| IH-E13c | IH: at 320x568 with a 260px keyboard, after `A BB C` in TOP, Tab to INNER and Shift+Tab back to TOP show TOP's message wholly inside .helperbody with TOP's input top within 8px of .helperbody's top | ih_msg_scroll (reveal's row omits the shown message) |
| IH-E13d | IH: at 320x568 with a 260px keyboard, after `A pentatonicscale C` in TOP (a two-line message), Tab and Shift+Tab keep TOP's input top within 8px of .helperbody's top while the message's top is at or below .helperbody's top and at least 20px of the message is inside it | ih_msg_scroll_cap (revealTop's too-tall branch returns the nearest edge in place of `inputTop + 4`) |
| IH-E13e | IH: at 320x568, an error under DING comes wholly inside .helperbody when the keyboard closes, after a blur and with focus kept, and focus does not move | ih_no_settle_reveal (SC1's reveal call removed; it is the only error-scroll call site) |
| IH-E13f | IH: at 320x568, with an error under DING and BOTTOM focused, a user scroll of .helperbody survives a keyboard height change | ih_error_scroll_every_write (the error reveal runs on every applyKbOffset write, ignoring kbUp and revealed); ih_blur_keeps_revealed (the blur writer leaves revealed alone, so S24's reveal never runs) |
| IH-E13g | IH: at 320x568 and at 380x780, with the M16 line under BOTTOM and no keyboard, focusing BOTTOM and then opening the keyboard brings BOTTOM into .helperbody before any key is typed (at 320x568 the label may be out of view) | ih_no_kb_open_reveal (SC3's reveal call removed) |
| IH-E14 | IH: at 380x780 with the help row shown, #help-row is 44px tall; on the Add sheet #scale-preview's bottom edge is at or above .sheetbody's bottom edge at scrollTop 0; on the Edit sheet (F3 Low Pygmy 18) the help row moves #scale-preview down by at most 58.5px (row 44 + `--sp-3`, plus 0.5px subpixel tolerance) | ih_help_row_pushes_preview (adds `margin-block:var(--sp-4)` to `#help-row`) |
| IH-E15 | IH: with no field focused, the USE note keeps one line's height whether or not it has text | ih_use_note_collapses |
| IH-E16 | IH: on the Pygmy-less walkthrough input `c eb` with ding D3, each guessed octave's `.guess` has text-decoration-style dotted and text-decoration-color rgb(167,157,139); a field error (`\| Bb3` in INNER) renders at 14px in rgb(226,112,5); a stale message renders in rgb(167,157,139) | ih_guess_orange (guess underline in #E27005) |

v1's IH-E5 is folded into IH-E7, which types real keys. 23 e2e tests. IH-E13c's and IH-E13d's steps: at 320x568, open the Add sheet and the helper, call `b.fakeKeyboard(308)` (a 260px keyboard), type the TOP text with real keys, press Tab (to INNER; TOP's message appears at the blur) and Shift+Tab (back to TOP; SC2 reveals TOP's row), then assert the bounds in the titles; the bounds and measurements are v8's (2b "Tightest margin"), because the final scroll position is the same 4px cap. IH-E13e's steps: at 320x568, open the Add sheet and the helper and call `b.fakeKeyboard(308)`. Phase 1 (iOS Done): type `F3` into DING, Tab, `G3 Ab3 Eb4 F4 G4 Ab4` into TOP (no C, so no fifth), press Tab twice (through INNER) to BOTTOM (eng-review-v8 N-2) and type `c3 eb`; run `document.activeElement.blur()` through `b.eval` and call `b.clearKeyboard()`; with `b.waitFor` assert that `#helper-ding`'s top is at or below `.helperbody`'s top and `#helper-ding-msg`'s bottom is at or above `.helperbody`'s bottom. Phase 2 (Android Back): call `b.fakeKeyboard(308)`, click BOTTOM, assert that DING's row is no longer wholly inside `.helperbody`, press End and type a space, then call `b.clearKeyboard()` with focus kept; with `b.waitFor` assert the same bounds and that `document.activeElement.id` is `helper-bottom`. `b.clearKeyboard()` also runs in a `finally`. The mutant fails phase 1's `waitFor`: the message stays at about 196 to 237px against a visible top of 284px (design-review-v7). IH-E13f's steps: phase 1 of IH-E13e, then `b.fakeKeyboard(308)` and a click on BOTTOM; set `.helperbody.scrollTop` to its maximum through `b.eval`, record it and assert that DING's row is not wholly inside; call `b.fakeKeyboard(300)` (a larger keyboard, so the list's maximum scroll only grows and the browser clamps nothing), wait with `b.waitFor` for `applyKbOffset`'s write to land on the helper surface, and assert that `.helperbody.scrollTop` equals the recorded value within 1px. The mutant reveals DING in that write and fails the assertion. Then (eng-review-v9 RC-5, a regression clause): call `b.clearKeyboard()` with focus kept and no input; with `b.waitFor` for `--helper-vh` to be absent from `#scale-helper .helpersurf`'s inline style (eng-review-v12 N-1), assert DING's row is still not wholly inside `.helperbody`. Then (design-review-v10 RC-1, S24; this clause kills `ih_blur_keeps_revealed`, design-review-v11 nit 2): click `#helper-title`, the helper's non-focusable heading, so BOTTOM blurs with a `relatedTarget` that is not a helper input, and with `b.waitFor` assert that DING's row is wholly inside `.helperbody`. Then (eng-review-v11 RC-1, a regression clause with no mutant of its own), with the keyboard down: focus `#helper-bottom` through `b.eval`, then type a space and Backspace into it with real keys, so it is a typed field while DING's error shows and its value and message do not change; set `.helperbody.scrollTop` so INNER's row is at the list top (its offset within `.helperbody`, clamped to the maximum); assert that `scrollHeight > clientHeight`, that DING's row is not wholly inside `.helperbody` and that `label[for="helper-inner"]` is wholly inside it; through `b.eval`, add capture listeners for `mousedown` and `click` on that label that each record its `getBoundingClientRect().top`; then `b.click('label[for="helper-inner"]')`, which presses and releases at the label's centre: `document.activeElement.id` is `helper-inner`, both recorded tops exist (eng-review-v13 N-3), and the label's top recorded at `mousedown` equals the one recorded at `click`, so the label does not move between press and click (design-review-v12 nit 2). If the list is not scrollable at 320x568 with the keyboard down, the clause runs at 1280x800 with M15 shown, where the list scrolls by about 40px; the implementer measures this once, and the clause starts from `scrollHeight > clientHeight` (v12 adaptation 1). IH-E13g's steps (design-review-v9 RC-1): at each viewport, open the Add sheet and the helper with no keyboard, type `D3` into DING, `A3 Bb3 C4 D4 E4 F4 G4 A4` into TOP and `c eb` into BOTTOM with real keys, press Tab (M16 shows under BOTTOM at the blur), set `.helperbody.scrollTop` to 0 through `b.eval`, focus BOTTOM through `b.eval`, then call `b.fakeKeyboard(308)` at 320x568 or `b.fakeKeyboard(480)` at 380x780. With `b.waitFor`, before any key: at 380x780, BOTTOM's label and input are wholly inside `.helperbody`; at 320x568, where the row with its two-line message is taller than the 64px region, BOTTOM's input top is within 8px of `.helperbody`'s top and at least 20px of the message is inside it (IH-E13d's bounds, v10 adaptation 3). `b.clearKeyboard()` also runs in a `finally`. IH-E16's stale clause (design-review-v9 RC-3, a regression clause): type `F3` into DING and `G Ab` into TOP, Tab twice, click DING, and with real keys replace `F` with `G`; `#helper-ding-msg` has class `stale` and computed colour rgb(167,157,139).

IH-E1, IH-E2b, IH-E11, IH-E13, IH-E13b, IH-E13c, IH-E13d, IH-E13e, IH-E13f, IH-E13g, IH-E14 and IH-E15 launch with `launch({ realFonts: true })` (precedent: e2e.test.js "realFonts" uses at 8322, 8960, 9649, 11980, 12476); a layout assertion measured on fallback fonts is not evidence.

An e2e test that clicks USE or BACK with a real pointer waits out the 350ms ghost-tap window with `waitElapsed(350, ...)` before it asserts focus or clicks the sheet (memory "Sleep-to-waitFor loses the timing bound").

**Rewrites:** the H2b half of the non-IM rewrites listed in section 3.

**Mutant headers:** each patch has `# kills: <title>` and `# suite: node --test --test-name-pattern ^IH:.<words-with-dots> tests/<file>.test.js`, with `.` wildcards and no quotes (memory "Mutant `# suite:` headers are word-split").

**Acceptance:**
- every IH test passes (39 app, 23 e2e);
- the H2a grep still prints nothing: `grep -rn 'import-\|showImport\|importRow\|scale_import' index.html tests tools | grep -v 'import-v2'` (the kept `import-v2` plan and gold paths in tests/import_gold.test.js, tools/regen_import_gold.js and tests/fixtures/import_gold_v1.json are the only allowed hits), and `ls tests/mutants/ib_*.patch 2>/dev/null` prints nothing;
- each of the 63 `ih_*` patches below makes its suite fail (IH-E13f carries two, so the 62 H2b test rows hold 63 patches, eng-review-v12 N-2), all 57 `i_*` patches still `git apply --check`, and the three section 3 patches still apply and still make theirs fail;
- ELEMENT_IDS holds the 18 ids in section 3 and SB-2 passes;
- `#help-row` is hidden in the served markup;
- FLOORS and README:77 equal CI's counts; expected README:77 is 1195 (1132 plus 63);
- IH-E13e's, IH-E13f's and IH-E13g's bounds were not measurable on dev; the first H2b CI run at the verified head SHA is their evidence, as CI's artifact governs FLOORS (eng-review-v9 N-7).

**Verify** (explicit mutant list, eng-v2 nit):

```
export CHROME_BIN
bash <<'VERIFY'
test -x "$CHROME_BIN" || { echo "set CHROME_BIN to a Chromium binary"; exit 1; }
M="help_row_not_hidden help_not_tab_stop no_history_entry sheet_not_inert preview_not_redrawn aria_flat_as_b \
 no_held_state use_enabled_on_error use_note_last_field use_writes_nothing use_fires_no_input escape_closes_sheet \
 popstate_closes_sheet open_untracked use_tracks_line no_prefill use_beacons edit_no_helper writes_last_seed \
 message_on_first_key live_repeats text_updates_while_editing hold_only_typed_field kb_close_keeps_editing zoom_reads_edge forward_closes_sheet guess_unmarked guess_info_silent enter_triggers_use \
 helper_box_ignores_offset disabled_use_tab_stop pending_note_missing message_waits_for_blur stale_keeps_error_colour example_from_scale_box \
 held_caption_without_history use_silent fragment_nav_stepped_back use_ghost_tap \
 help_row_not_hidden_e2e kb_not_applied landscape_one_column caption_grows overflow_x small_target tab_escapes \
 use_line_differs_e2e helper_fetch_e2e back_gesture_closes_sheet forward_closes_sheet_e2e caption_not_expandable \
 trigger_over_helper use_note_kept_focused focus_scroll_row msg_scroll msg_scroll_cap no_settle_reveal error_scroll_every_write blur_keeps_revealed no_kb_open_reveal help_row_pushes_preview use_note_collapses guess_orange"
node --test tests/app.test.js tests/harness.test.js \
 && CHROME_BIN="$CHROME_BIN" node --test --test-name-pattern '^IH:|^DR1.focus|^RD:.the.Edit.page' tests/e2e.test.js \
 && python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py \
 && test -z "$(grep -rn 'import-\|showImport\|importRow\|scale_import' index.html tests tools | grep -v 'import-v2')" \
 && test $(echo $M | wc -w) -eq 63 && LOG=$(mktemp) \
 && { for p in tests/mutants/i_*.patch; do git apply --check "$p" || echo "STALE $p"; done; \
      for p in $(for m in $M; do echo tests/mutants/ih_$m.patch; done) tests/mutants/a_seed_refusal_below_the_pan.patch tests/mutants/d_sheet_focus_stays.patch tests/mutants/dr3_tab_list_omits_disclosure.patch; do cmd=; git apply --check "$p" || { echo "NOAPPLY $p"; continue; }; git apply "$p"; cmd=$(grep -m1 '^# suite:' "$p" | sed 's/^# suite:[[:space:]]*//'); if $cmd >/dev/null 2>&1 </dev/null; then echo "SURVIVED $p"; fi; git apply -R "$p"; done; } 2>&1 | tee "$LOG" \
 && ! grep -q 'SURVIVED\|NOAPPLY\|STALE' "$LOG"
VERIFY
```

The full e2e suite starves a local browser (memory "CHROME_BIN available locally"). CI `validate` at the verified head SHA is the evidence.

The H2a, H2b and H3 Verify blocks cannot go green on a worktree cut from dev: the 35 dev-overlay GA and placeholder failures stop them at the first `node --test tests/app.test.js`. Lanes are cut from main, and CI on the main PR at the verified head SHA is the evidence (eng-review-v11 N-3).

**Non-goals:**
- no engine edits: `src/engine/importer.js`, the `engine:importer` region, `tests/import.test.js`, `tests/import_gold.test.js` and the `i_*` mutants stay as they are (owner decision, section 3);
- no CLAUDE.md edits;
- no change to the drawer, the guidance slot, `#scale-preview`, GENERATE CARDS or `pendingPop`'s type (section 7).

### H3: docs

**Owns** `CLAUDE.md`:
- "Scale import": rewrite "Hidden", "Sheet" and "No network" for the helper; keep "Engine" and "After-list scan"; add a "Helper engine" bullet citing E1 to E17; delete the "Flag copy" bullet (its test is deleted by H2a); keep the "Engine pins (lane L1b)" bullet unchanged.
- "DEV environment": the overlay's import-row un-hide is gone (H0a took H2a's side on `claude/dev-sync-h2a`); `#help-row` is un-hidden on dev by `claude/dev-sync-h0b` (H0b), not by `claude/dev-overlay`, which predates it; the escape hatch (re-opening the overlay PR from `claude/dev-overlay`) must re-apply the help-row un-hide; the production-pin sentence cites IH-A1 in place of "IM: the import row ships hidden: ...".
- Stale cites (eng-review-v4 N-7): from H2a's merge to dev until H3's, CLAUDE.md's "DEV environment" and "Scale import" bullets cite the deleted test "IM: the import row ships hidden: #import-row carries the hidden attribute in the served markup and IMPORT TEXT is not in the sheet's focus order". No test checks citations, so CI stays green in that window. H3 removes every such cite; its brief names this test title.
- The Discoverability analytics bullet (eng 9): the tenth and eleventh events are `scale_helper_open` and `scale_helper_use`, citing IH-A10 and IH-A10b. The "no event param" sentence now runs a helper USE and asserts a `scale_helper_use` event.

**Acceptance:** every sentence names an existing test title or says "(no test; true by <file>)" (memory "Docs lane claims must cite a test"). No sentence names a deleted IM test or `scale_import` as current behaviour: `grep -n '"IM: ' CLAUDE.md` prints nothing.

**Verify:**

```
bash <<'VERIFY'
python3 -m pytest tests/test_ci_scope.py -q && node --test tests/app.test.js \
 && test -z "$(grep -n '"IM: ' CLAUDE.md)" \
 && node -e '
const fs = require("fs");
const src = fs.readdirSync("tests").filter((f) => f.endsWith(".test.js")).map((f) => fs.readFileSync("tests/" + f, "utf8")).join("\n");
const titles = [...src.matchAll(/test\("(IH: (?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse("\"" + m[1] + "\""));
const md = fs.readFileSync("CLAUDE.md", "utf8");
let bad = 0;
for (const m of md.matchAll(/"IH: /g)) {
  const rest = md.slice(m.index);
  if (!titles.some((t) => rest.startsWith("\"" + t + "\""))) { bad++; console.log("MISSING " + rest.slice(0, 80)); }
}
process.exit(bad ? 1 : 0);'
VERIFY
```

The check reads each test title from its `test("...")` string with escapes decoded, and requires every `"IH: ` in CLAUDE.md to open a quoted, complete title. A title with inner double quotes, such as E8's, is matched whole. IH titles are written as `test("...")` string literals, so the check can read them, and a cite of a title that does not exist prints MISSING (eng-review-v7 N-3).

CI at the head SHA is the evidence.

**Non-goals:** `docs/plans/2026-10-17-import-v2.md` is not edited; README is not touched.

### H0: dev sync (integrator, two steps; eng-review-v4 RC-2)

- **H0a, with H2a's PR D (dev).** H2a's PR D conflicts on `#import-row`: dev carries the overlay's un-hide, and H2a deletes the block (verified with `git merge-file` against base 5a5f7f0). Do not merge PR D. Instead, branch `claude/dev-sync-h2a` from origin/dev, `git merge <H2a verified head>`, and resolve by taking H2a's side for the whole import block, which drops the overlay's import-row un-hide. Keep the GA placeholder and `_headers`. Open it to dev and merge it with `gh pr merge --merge` once H2a's PR M has a green `validate` run at that head (the dev-sync grant). Close PR D as superseded. DEV then shows neither the paste UI nor the helper until H2b lands.
- **H0b, after H2b's PR D merges to dev.** Branch `claude/dev-sync-h0b` from origin/dev, change `<div class="fieldrow" id="help-row" hidden>` to `<div class="fieldrow" id="help-row">`, and merge to dev. `claude/dev-overlay` (619201e) predates `#help-row` and stays as is. Record in the queue doc that the dev-env escape hatch (re-opening the overlay PR from `claude/dev-overlay`) must re-apply the help-row un-hide.
- Both merges to dev fall under the owner's existing dev-merge grant for `claude/dev-sync-*` PRs (CLAUDE.md "DEV environment", lane flow D2; global AFK grant). No new grant is needed.
- `claude/dev-overlay` is never rebased: dev moves only by merge commits, and the overlay branch stays at 619201e through both steps.
- H2b's PR D merges cleanly under G-C: after H0a, dev's import block equals H2a's, and l1b..dev touches no other byte H2b changes.
- IH-A1 pins `hidden` on main, so a stray dev-sync or overlay commit cannot reach main green.
- Never PR the overlay or a dev-sync branch to main; never delete the overlay.

## 5. In-flight work

- **L1b (#372)** merged to dev as is (integrator decision; #373, origin/dev b153406). Its `IMPORT_FLAG_TEXT` lines, its app test "IM: every code in the engine's FLAG_ORDER has an IMPORT_FLAG_TEXT line, ..." and its two `ib_*` patches are on dev and are deleted by H2a (section 3). There is no contradiction: L1b ships that copy, and H2a removes it with the import UI. PR #372 to main stays open (G-A).
- **RE-CHECK done:** the section 3 enumeration was re-taken on origin/dev b153406 (eng-review-v2) and the differences are folded. If origin/dev moves before H2a starts, H2a reruns it and adds anything new to its brief.
- **Lane bases and main merge order (eng-v2 7).** H1 branches from `claude/import-v2-l1b` (5a5f7f0), H2a from H1's head, H2b from H2a's head, H3 from H2b's head, so each PR M to main carries only lane commits plus the unmerged L1/L1b stack and no dev sync merges. Main merge order is #370, #372, H1, H2a, H2b, H3; each PR D to dev is opened from the same head. Failure without it: a lane branched from origin/dev drags 11 dev-only commits (l1b..dev, measured by eng-review-v3) (overlay-free but including sync merges) into its PR M.
- **FLOORS and README:77** move in H1, H2a and H2b. Each lane sets them from the previous lane's CI artifacts. Expected README:77: 1149 after H1, 1132 after H2a, 1195 after H2b.
- **Dev merges (eng-review-v4 RC-2).** H1's, H2b's and H3's PR D merge to dev under G-C. H2a's PR D is CONFLICTING against the overlay's `#import-row` un-hide on dev and is never merged: H0a's `claude/dev-sync-h2a` takes its place, and H0b's `claude/dev-sync-h0b` adds the help-row un-hide after H2b. Nothing rebases `claude/dev-overlay`.
- **Superseded parts of `docs/plans/2026-10-17-import-v2.md`** (listed, not edited):
  - the section 1 user-facing goal;
  - from L1b's section 7 acceptance, items (a), (b), (d) and (e);
  - lanes L2a, L2b, L3 and V-L3: parked;
  - section 8 phases 2a+, 2c and 2d: replaced for the helper by section 6;
  - decisions D-B, D-D and D-E: moot while paste is parked.

## 6. DEV e2e plan (https://handpan-cards-dev.pages.dev)

This runs after H2b's PR D merges to dev, H0b's `claude/dev-sync-h0b` PR is merged to dev, and the Cloudflare build for that dev commit is live. The integrator confirms the deployed `index.html` contains `id="help-row"` without `hidden`.

**The plan is `/qa-only` with gstack `/browse` against the DEV URL.** It runs in a subagent with every Bash call prefixed `OPENCLAW_SESSION=1`, per the global instructions. It is read-and-report only. The harness has no deployed-URL switch: `tests/e2e.test.js` serves the local file, and `tests/helpers/cdp.js` `goto` has no origin switch. CI's IH-E tests prove the same bytes locally, and this run proves the deployed page.

Viewports: 380x780, 320x568, 844x390, 1280x800. A field message appears once its field is left (Tab, a tap elsewhere, or the keyboard closing), never while a field is being typed in (2.7). At each:

1. Add a scale. NEED HELP? and the hint are visible under the scale box. At 380x780 NEED HELP? and the hint share one 44px line, and the whole pan is visible above the bottom of the scrolling area without scrolling (RC6).
2. NEED HELP? gives a full-screen helper, BACK focused, title ENTER YOUR SCALE, no settings trigger over it. With all fields blank the dimmed example pan is `[C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5`, the scale the placeholders spell, captioned "Example pan. Yours appears here as you type."
3. Type `d3` / `a bb c d e f g a` / blank / `c eb`, then press Tab. The caption reads `[C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4`, with C3 and Eb3 dotted-underlined in grey, not orange (ding D3: C becomes C3, Eb becomes Eb3). The BOTTOM info line reads "Octaves guessed: C3, Eb3. Type an octave to change a guess." USE is enabled.
4. `A BB C` in TOP, then focus the caption: "BB is not a note: write B-flat as Bb." shows under TOP in 14px orange, USE is disabled, and the USE note reads "Fix TOP RIM NOTES to continue." (the C11 short field name). At 320x568 with the keyboard up, Tab to INNER and Shift+Tab back to TOP: the message is in view and TOP's typed text stays readable (2.7 SC2).
5. `Re` in DING, then Tab, shows "Use letter names, like D A Bb.".
6. `A3 G3` in TOP, then Tab, shows "G3 is lower than A3: list low to high.".
7. USE leaves the box holding the line, with the parse line and the sheet preview matching and GENERATE CARDS enabled. Then reopen, and double-tap USE (two taps in quick succession): the sheet stays open and GENERATE CARDS has not run (eng-review-v3 C).
8. Reopen: the four fields hold the scale with octaves.
9. Browser Back inside the helper closes only the helper; a second Back closes the sheet. Forward after the helper's BACK (1280x800) leaves the sheet open.
10. Edit F3 Low Pygmy 18. At 380x780, before opening the helper, the help row sits on one line and the pan's top half is visible without scrolling (the Edit sheet clips the pan's foot today with no row; RC6 limits the row's cost to 58px, it does not fix Edit). NEED HELP?: the fields decompose. The caption is two lines and expands on focus. USE without changes leaves the box unchanged.
11. At 844x390: the header spans both columns, the plate is on the left, and the fields, the USE note and USE are on the right; USE is reachable.
12. Network: zero requests to googletagmanager.com and google-analytics.com, and zero requests while using the helper.

The report is a pass or fail per step per viewport, with screenshots.

**Real phones (owner or integrator; one iOS Safari, one Android Chrome).** These are the only proof of a real keyboard, because CDP simulates one. Each check below is recorded as pass or fail per phone, with the device, OS and browser version:
- R-1. Steps 3, 4 and 10 with the keyboard up.
- R-1b. On both phones, tap BOTTOM with the keyboard down; the field and its label are visible when the keyboard finishes opening (2.7 SC3, design-review-v9 RC-1). Then, with the keyboard up and BOTTOM focused, tap the TOP INNER NOTES label: INNER is focused (2b label listener, eng-review-v11 RC-1).
- R-2. The pan's top and the focused field are visible together at every step.
- R-3. Enter moves to the next field, and Enter on BOTTOM dismisses the keyboard.
- R-4. Landscape with the keyboard up: the field and USE are reachable, and the preview may crop. Measured: at 844x390 with a 200px keyboard the pan's `clamp(120px, calc(100dvh - 170px), 232px)` ignores `--helper-vh`, so the pan ends at 276 and the caption at 316.6, both below the 200px surface. That crop is accepted under this check (design-review-v5 N-3).
- R-5. With a screen reader on (VoiceOver on iOS, TalkBack on Android): a field error is announced once, the preview reads "B flat 3" for Bb3, and USE announces "Scale added to the box."
- R-6. On iOS Safari, with TOP lacking the fifth and TOP focused, tap the disabled USE. Record whether TOP blurs and M15 appears. If focus stays, no message appears and the note (hidden while focused, read through `aria-describedby`) is C10, which is accurate; a fail is recorded for the owner, not fixed in this plan (design-review-v7 N-4). On Android Chrome the same tap blurs TOP and M15 appears (measured in Chromium, design-review-v7).
- R-7. On Android Chrome, with an error under DING, focus BOTTOM, type one character and close the keyboard with the Back gesture: the DING row scrolls into view and focus stays on BOTTOM (2.7 SC1, design-review-v8 N-5). On iOS Safari, move DING to TOP by tap and by the accessory-bar arrows: no message appears while TOP is typed in, and DING's message (if any) appears at the move; the model reads no `relatedTarget`, so the result must be the same either way.

**Exit (the prod un-hide criterion).** Every `/qa-only` step passes at every viewport, AND every real-phone check (R-1, R-1b and R-2 to R-7) is recorded as a pass on both phones, or the owner accepts a named failure in writing. The integrator records both result sets in the queue doc (memory "Scale import investigation") and asks the owner whether to un-hide on prod (G-F). The un-hide lane does not open while any real-phone check is unrecorded. Un-hiding is a separate one-line lane: remove `hidden` from `#help-row`, flip IH-A1 and IH-E0 to assert visible, and update their mutants.

## 7. Risks, accepted gaps, nit dispositions

**Risks:**
- R1. A real iOS keyboard plus the accessory bar exceeds the 340px simulation. Mitigations:
  - the plate scales from `--helper-vh`, with a 72px floor;
  - the 320x568/260 case (IH-E1, IH-E13, IH-E13b);
  - the recorded real-phone checks (section 6 exit).
  - Where the keyboard shrinks the layout viewport (Android `interactive-widget=resizes-content`), portrait heights under 520 also pick up the landscape tokens. Measured by design-review-v3, this only compacts further (focused field region 191.8 at 380x480, against 181.8), and the `(min-width:560px)` guard keeps the grid off portrait (design-v3 N-3).
- R2. The re-anchored mutants kill for the wrong reason. Mitigation: the reviewer applies each one and reads the failing assertion.
- R3. The sheet preview after USE differs from the helper's, because `fitSeats` keeps seats only when ring sizes match. Mitigation: IH-E7 compares the sheet preview after USE with typing the line.
- R4. The guess can still be wrong on pans whose bottoms span more than one octave step: Pygmy typed without octaves guesses Ab4 for its real Ab5 (the other five are right). Mitigation: the owner chose guess-and-show; the caption and info line make every guess visible before USE, and prefill from a deck always carries real octaves.
- R5. RC1 and RC2 together: the pending note (C10) applies while a field is being typed in, which is exactly when RC1 hides the note. It is still USE's description (`aria-describedby`) and shows if focus leaves for BACK or the caption before a blur message appears. Kept because RC2 asks for the string and it costs one line of copy.
- R6. At 320x568 with a 260px keyboard the pan clamps to 75px: readable as a shape, not as labels (design-v2 N-5). Accepted.

**Accepted gaps (recorded, not tested):**
- `pendingPop` stays one boolean. The helper closes synchronously before `history.back()`. A second `back()` queued before the first popstate needs a sheet tap before the first popstate; measured popstate latency after `history.back()` is 0.8-2.4ms in Chrome 156 (20 trials), below any human double-tap interval. The 350ms inert window after a pointer USE or BACK (2.3, A27) also blocks that tap. A counter would change `closeScaleSheet` and About's paths for no reachable case.

Fragment navigation while the helper is open is no longer a gap: A26 tests it (2.3). The `hashchange` that follows still returns while the sheet is open, as it does today for the sheet alone; that is the sheet's existing behaviour and is unchanged here. Likewise, after a fragment navigation while the helper is open, `history.back()` consumes the helper's history entry, the same class of behaviour as the sheet's (eng-v3 nit 5).

- **Caption tap with the keyboard up (design-review-v4 N-3), an accepted transient.** Tapping the caption while a field has focus blurs the input, so the unfocused budget (pan + 246 = 320.5 at 320x568) briefly applies to a 308px visual viewport and the field region collapses to 0 until the viewport resize lands. On a soft keyboard the blur closes the keyboard, so the state lasts one resize. No layout change.
- **Swallowed tap in the ghost-tap window (design-review-v4 N-4), by design.** The 350ms inert window after a pointer USE or BACK has no visible state, and a deliberate tap on the sheet inside it is swallowed. That is the double-tap guard working (2.3); nothing is shown for it.
- **Stale CLAUDE.md cites between H2a and H3 (eng-review-v4 N-7).** From H2a's merge to dev until H3's, CLAUDE.md cites the deleted test "IM: the import row ships hidden: ...". No test checks citations, so CI stays green; H3 closes the window and its brief names the title.
- **Zoomed Android Back with focus kept (eng-review-v10 N-5), bounded by owner flag (d).** While the page is pinch-zoomed, `kbUp` is frozen (2.7), so an Android Back that closes the keyboard and keeps focus settles nothing until the scale returns to 1.01 or less or the field is left. Meanwhile C10 is hidden by focused compaction and read only through USE's description, so a user who never unzooms and never leaves the field sees no message. Owner flag (d) chose that zooming never ends an edit.
- **Mouse drag-select or double-click from a helper label (eng-review-v11 RC-1 fix), accepted.** A mouse drag-selection or double-click that starts on a helper label selects nothing; the press focuses the field instead. Selections that start elsewhere, select-all and touch long-press are unaffected. (Probed, `v12probe/` and design-review-v12: the fixed page selects nothing, the control selects "DING". The labels are fixed caps UI text with nothing to copy.)

**v3 adaptations of review text:**
1. RC1's selector `.helpersurf:focus-within` is written `.helpersurf:has(.helperbody input:focus)`. Opening the helper focuses BACK (2.3) and the caption is a stop, so `:focus-within` would compact the surface and hide the USE note at open and while the caption is focused. The rest of RC1's text is verbatim.
2. Design-v2 N-3's announcement ("write it into the sheet's live region") goes to a new `.sr-only` `#helper-done` inside `#help-row` on the sheet, not to `#helper-live`: at that moment `#helper-live` is inside the hidden helper, and a region outside the sheet's `aria-modal` dialog is out of reach (index.html's `#scale-refusal` comment). ELEMENT_IDS holds the 18 looked-up ids (section 3).
3. RC4's info-line example "Octaves guessed: Eb3." is adopted as the copy row M16 ("Octaves guessed: <names>. Type an octave to change it."), replacing v2's singular "Octave guessed:". (v7: "Type an octave to change a guess.", design-review-v6 N-2).
4. Eng-v2 4's counts read 17, not 16: v3 adds E17 for the "later guess lands on the ding's midi" clause of step 5.3, which no test covered. E4 takes the reviewer's title verbatim and swaps its mutant to the letter-versus-midi one, which only the Db clause kills.
5. RC6's "shorten the copy if it wraps": it does not wrap at 380px (measured 286.7px of 336px), and the copy is the owner's, so a future wrap goes to the owner. Under design-v3 RC-1 (one-line row) the point is moot.

**v4 adaptations of review text:**
1. Eng-v3 C's A27 is written as a sandbox-observable state test, not the reviewer's behavioural wording ("a second click 100ms after a pointer USE ... does not run GENERATE CARDS"). The sandbox's `click()` calls listeners directly with no hit-testing, so `inert` cannot block a sandbox click; A27 asserts `#scale-sheet` is inert at 100ms and not at 350ms on the virtual clock, and that GENERATE CARDS runs after the lift. The behavioural double-tap is checked on DEV (section 6 step 7). The mutant (ih_use_ghost_tap) is unchanged, so the count is 52 (49 + ghost tap + design-v3 RC-3 + eng-v3 E), not the reviewer's 50.
2. Design-v3 RC-3 asks to reword IH-E13 and add ih_focus_scroll_row. To keep one mutant per test (eng-v2 9(c)), IH-E13 takes the reworded title and keeps ih_use_note_kept_focused, and a new IH-E13b carries the row-scroll assertion and ih_focus_scroll_row.
3. The USE announcement (A25, 2.8 step 8) and the focus move to NEED HELP? (2.8 step 5) now happen when the sheet's inert lifts: a deferred tick after a keyboard USE, 350ms after a pointer USE. Focus cannot land in an inert subtree.
4. The lane split puts the overlay change in two steps (H0a drops the import hunk after H2a, H0b adds the help-row hunk after H2b).
5. Eng-v3 D names the layout IH-E tests for `realFonts`; IH-E13b is added to that list because it is a layout assertion.

**v5 adaptations of review text:**
1. Eng-v4 N-4 gives 1184 for H2b's README:77 count with 52 mutants; v5 has 53 (design-review-v4 RC-2 adds `ih_msg_scroll`), so H2b's expected count is 1185. H1 (1149) and H2a (1132) are the reviewer's numbers.
2. Eng-v4 N-5 asks for `git apply --check ... || { echo NOAPPLY; continue; }` plus `tee` and `! grep -q 'SURVIVED\|NOAPPLY'`. v5 also resets `cmd` at the top of each pass, and in H1 and H2a pipes the existing `i_*` STALE loop into the same log, so a stale `i_*` patch fails the chain too (both acceptances already require all 57 to apply; before v5 a STALE line was printed and ignored).
3. Eng-v4 RC-2's H0 text is verbatim. v5 adds three consequential bullets the reviewer's text implies: the `claude/dev-sync-*` grant covers both merges, the overlay is never rebased, and H2b's PR D merges cleanly after H0a. The rollback paragraph and H3's "DEV environment" bullet are rewritten to the dev-sync mechanism, and the integrator's choice of the dev-sync path is recorded as an owner FYI (section 8), as eng-review-v4's owner-fidelity row asks.
4. Design-v4 N-1 adds a final period to M2, M3 and M10, whose text is owner wording (rounds 3 and Q10). The words are unchanged; only the terminal period is added, for consistency with the M-strings beside them. Recorded as an owner FYI (section 8). The section 0 v2 rows keep the owner's wording as quoted at the time.
5. Design-v4 RC-1's A6b clause is appended to A6b's title verbatim. A6b keeps its one mutant, `ih_use_note_last_field`; the BOTTOM-only clause also fails if the C11 trim is skipped, and needs no second mutant.
6. Eng-v4 N-2's floors (607, 331) are the reviewer's. v5 also states the arithmetic floors for H1 (`tests/import.test.js` 80) and H2b (641, 350) (351 after v6 adaptation 1), marked as expected, with CI's artifact governing (G-E).

**v6 adaptations of review text:**
1. Design-v5 RC-1's IH-E13c carries two mutants and builds its two-line case on `A3 G3`. Under design-v5 RC-2, M10 ("G3 is lower than A3: list low to high.") is one line at 320 (measured on real fonts), so that case can no longer kill `ih_msg_scroll_cap`. To keep one mutant per test (eng-v2 9(c), as v4 adaptation 2 did for IH-E13), IH-E13c keeps the one-line clause and `ih_msg_scroll`, and a new IH-E13d carries the two-line clause and `ih_msg_scroll_cap`, typed as `A pentatonicscale C ` (M4, measured two lines at 320 and one at 380). Counts: 20 IH-E tests, 54 H2b mutants, e2e FLOORS 351, README:77 1186; the reviewer's 54 and 1186 stand.
2. Owner text replaces design-v5 N-1: M2 is "Use letter names, like D A Bb." (the owner's 2026-10-18 wording, no commas), not the reviewer's "like D, A or Bb.". It shares the reviewer's "like" voice. Measured one line at 320.
3. Design-v5 N-2's single M11 string replaces 2.5 step 4's two wordings ("top notes" and "inner notes", eng-v2 2). Compose no longer looks the pitch up in the top notes; the message still sits under the field being typed. No test asserted the two wordings, so no title or mutant changes.
4. Eng-v5 N-3 and N-4 together: the focus move lives in `liftSheetInert()` behind its guard, while the `#helper-done` write lives in a USE-only `helperInertTimer` callback, so RC-2's "after a USE only" holds by construction and BACK's callback only lifts. A keyboard USE lifts at once, then arms the same lift-then-write callback at 0ms, so "the timer always lifts" still holds.
5. Design-v5 RC-2 says M4 stays one line for tokens up to about 5 characters. Measured on real fonts at 320, it stays one line up to about 10 (`xylophone`, `pentatonic`, `Kurd-scale` are one line; `handpanning` is two). 2.7 states the measured figure.
6. The v5 owner FYI on periods (section 8) is superseded by the owner's approval of the new M2 and order strings; v5 adaptation 4 is kept as history.

**v7 adaptations of review text:**
1. Eng-v6 N-1's definitions are verbatim. Read alone, "`closeHelper()` is BACK's body followed by `liftSheetInert()`" would lift at once on a pointer BACK and drop its 350ms ghost-tap window (2.3), so v7 adds that Escape and a keyboard BACK run `closeHelper()`, while a pointer BACK runs the same body and arms `helperInertTimer` in place of the lift.
2. Eng-v6 N-4 loosens IH-E13d's first bound from 5px to 8px. IH-E13c has no pixel bound ("wholly inside"), so nothing there loosens. The 20px message bound stays, and its 1.4px headroom is recorded in 2b with design-v6 N-5's figure (which now reads 4.5px against 8px, not against 5px).
3. Design-v6 N-4 offered two answers; v7 takes "state that none is known", with the code list read from origin/dev's `src/engine/core.js` and the reason each pre-empted code cannot arise (2.5 step 3). No probe ran compose, which does not exist yet.
4. Design-v6 RC-1's A15c sits after A15b. Its counts follow: 35 app tests, 55 H2b mutants, app FLOORS 642 (607 plus 35), README:77 1187; the reviewer's 55 and 1187 stand. The new M15 sentence is placed in the 2.7 bullet that begins "A message appears on the field's blur", as the reviewer asked, and 2.5 step 4 points to it.
5. Design-v6 N-3's 273 is the measured sum (four rows of 62.25 plus three gaps of 8), beside 2b's rounded arithmetic of 272; the row keeps both.

**v8 adaptations of review text:**
1. Design-v7 RC-1 and eng-v7 RC-1 both write the hold, eng's for TOP only. v8 merges them into one 2.7 sentence that covers DING too: input into DING or TOP sets the flag, and DING's or TOP's `blur` releases it unless the event's `relatedTarget` is the other of the two, so moving from DING to TOP shows nothing (the reviewer's "a blur of either to anywhere but the other"). `relatedTarget` is read from the event, not `document.activeElement`, so eng's constraint holds; the sandbox's dispatched blur has none and releases. Eng's A15c note keeps its own TOP-only sentence verbatim, which A15c's steps exercise.
2. Design-v7 RC-1's A15c title adds "typing C clears it". Eng-v7 RC-1's steps end at the blur, so v8 appends one step to them: set TOP to `G Ab C`, dispatch `input`, and assert DING's message and `aria-invalid` are gone.
3. Design-v7 RC-1 named A15d and its mutant and left the steps to v8. The steps take eng-v7 RC-1's style. The no-fifth step uses DING `C3` over Hijaz's own top notes, the reviewer's probed `(C3) G#3 B3 C#4 ...`, rather than switching to Kurd's top; the mutant is killed at the first input, `C`.
4. Design-v7 RC-3 titled the test "IH-E: at 320x568, ...". Every e2e title in this plan starts `IH:` (the H2b suite pattern is `^IH:`), so the title reads "IH: at 320x568, ..." and its ID is IH-E13e, after IH-E13d, which tests the same viewport and keyboard. Its steps are v8's: the reviewer's Pygmy-like scenario with real keys, then a blur to the body, then the keyboard closing.
5. Design-v7 RC-3 states the counts as "37 app tests, 57 mutants, README 1189, FLOORS 644". IH-E13e is an e2e test, so v8 has 36 app and 21 e2e tests: app FLOORS 643 (607 plus 36) and e2e FLOORS 352 (331 plus 21). The 57 mutants and README 1189 stand.
6. Design-v7 N-2 asks to add M1 to "the one-line assertion list". No test asserts message line counts; the list is 2.7's sentence of one-line messages, which now names M1 with its 4.8px of slack and a re-measure rule. Adding an e2e line-count test would be a new test beyond the review items.
7. Design-v7 RC-2 asks to fix section 9's "0.6px spare". That mention is in the v7 self-check, which is history; v8 marks it corrected there and in v7's section 0 row rather than rewriting it.

**v9 adaptations of the regroup prompt and review text:**
1. The regroup prompt offered `settled` (fields the user has left at least once) as a state variable. v9 does not keep it: R1's "eligible only while the field is non-empty" does the same job with no extra state. The consequence is that M6 and M8 never show under a field (C9 covers them), flagged for the owner in section 0.
2. The prompt offered two render rules: hide only the cross-field messages whose verdict the edited field could still change, or show nothing new while any field is being typed in. v9 takes the second (R3). The first needs a dependency map from each error to the fields that can change it; the second needs one variable, and its cost is latency only (a message waits for the field to be left), which the prompt ranks below rule count.
3. Design-review-v8 RC-1 offered fixes inside the hold flag. v9 removes the flag: a DING-caused M9 under TOP is held by R3 because DING is being typed in, and shown by R2 at DING's blur whether or not TOP was touched.
4. Design-review-v8 RC-2 asked for a scroll on edges only. SC1 is the only error-scroll call site, and it runs inside `paint()`, which runs only on `input`, `blur`, open and a change of `kbUp`, so an `applyKbOffset` write that leaves `kbUp` unchanged cannot scroll. The reviewer's auto-decision ("a separate mutant") is IH-E13f's `ih_error_scroll_every_write`.
5. v8's message-appears scroll (its rule that scrolled when a message appeared under the focused field) is gone: a message appears only at a settle, and a message under a field that then receives focus is brought in by SC2 with the same 4px cap. IH-E13c and IH-E13d keep their bounds and mutant names; their steps add Tab and Shift+Tab, and `ih_msg_scroll` now omits the message from reveal's row.
6. Eng-review-v8 N-5 asked that open and `resetHelper()` clear the hold flag. The flag is gone; open and `resetHelper()` write `editing = null`, and the open paint recomputes `shown` and `revealed`. No test is written for the `editing` reset, because no output can observe it (2.7, after the scenario table); a mutant that removed it would survive every possible test.
7. Mutant renames, one per rewritten rule: `ih_no_fifth_while_top_focused` becomes `ih_text_updates_while_editing` (A15c), `ih_no_fifth_while_ding_focused` becomes `ih_hold_only_typed_field` (A15d), `ih_error_scroll_on_blur` becomes `ih_no_settle_reveal` (IH-E13e). New: `ih_kb_close_keeps_editing` (A28), `ih_error_scroll_every_write` (IH-E13f). H2b goes from 57 to 59 mutants, app tests from 36 to 37, e2e from 21 to 22; README:77 after H2b is 1191 and FLOORS after H2b are app 644 and e2e 353.
8. The prompt names "A15c, A15d, IH-E13c-e" as the rows to rewrite. A15 is rewritten too (its v8 title, "appears on blur, not on the first keystroke", described one of the removed rules), and A21 and A22 keep their titles and mutants because their rules (C10 while a bad token waits; a message leaves on the input that clears it) survive unchanged as R5 and R3.

**v10 adaptations of review text:**
1. Eng-review-v9 RC-3 and design-review-v9 RC-2 describe the same pinch-zoom defect, and v10 fixes it once. It takes design's `kbUp` wording and design's A29 with `ih_zoom_reads_edge`. A29 also proves the unzoom settles exactly once, and it carries its own mutant. Eng's A28 regression clause (keyboard up again, an order error typed into TOP, then a zoom) is not added: it asserts the same output as A29's zoom step, no message and no new `#helper-live` text, on the same writer. A29's "no `scrollTop`" clause is dropped as unobservable, because `reveal` is a no-op in the sandbox (eng-review-v9 RC-2). A29 asserts no message and no live text and states why.
2. Design-review-v9 RC-3 asked that A22 assert the stale class. That would give A22 two mutants (`ih_message_waits_for_blur` and `ih_stale_keeps_error_colour`), against the one-mutant-per-row convention and the self-check's row parse. The stale assertion is therefore its own row, A22b. `tools/sandbox.js` defines no `getComputedStyle` (grepped on origin/dev b153406), so A22b asserts the `stale` class, and the computed grey is asserted in Chrome as a regression clause of IH-E16.
3. Design-review-v9 RC-1's IH-E13g asserts "the input and its label are wholly inside `.helperbody`" at both viewports. At 320x568 that contradicts the plan's own reveal rule. With the two-line M16 line under it, BOTTOM's row needs about 107px (62.25 + 4 + 40.6) against the 64px region, so `revealTop`'s too-tall branch puts the input's top 4px above the list's top by design (IH-E13d). At 320x568, IH-E13g therefore asserts IH-E13d's bounds: the input's top is within 8px of `.helperbody`'s top, and at least 20px of the message is inside. At 380x780 (region 181) it asserts the design's bounds unchanged. The mutant fails both: BOTTOM is the last row, so without SC3 the list shrinks beneath it and the row leaves view.
4. SC3 runs after the paint that its `kbUp` write triggers, not straight after the style writes. With `kbUp` true, SC1's target is null, so the two never compete. Running SC3 last means it is the final scroll write of that edge.
5. The STATE sentence "Nothing else is read" is scoped to render, announce and SC1. SC3 reads `document.activeElement` only to choose a scroll target. Visibility still reads only the four variables and the compose result.
6. Eng-review-v9 N-2 offered two options. v10 takes the first, the share-copy precedent: clear `#helper-live`, then write on a deferred tick. Writing only when the text differs would leave the case the nit names (M15 leaves, then returns with the same string) unspoken. Tests that read `#helper-live` after a settle call `app.flushTimers()` first. The repeat case is a regression clause of A15b; `ih_live_repeats` is unchanged.
7. Design-review-v9 N-3 is folded as a rule in A1: the open paint seeds `shown` from R2 and announces nothing. It is tested as a regression clause of A17b with no mutant of its own: type `c eb` in BOTTOM, close with BACK, then reopen on the same Add sheet with `#scale-box` empty. The four fields are empty (2.6), no message shows, and after `app.flushTimers()` `#helper-live` is empty (corrected in v11, eng-review-v10 RC-A).
8. Design-review-v9 N-4, splitting C9, is not taken. It would add two strings. They are not owner-locked, but they are new copy, and v10 adds none. C9 stays accurate when only one field is empty, because it names both fields.
9. E12's appended clause is written "(DING F3 alone carries no DING error)", without backticks, because no other test title in the plan carries code formatting.
10. Mutants added: `ih_stale_keeps_error_colour` (A22b), `ih_zoom_reads_edge` (A29) and `ih_no_kb_open_reveal` (IH-E13g); nothing is renamed. H2b's mutant count, app and e2e test counts, README:77 and FLOORS after H2b are the totals in section 0.

**v11 adaptations of review text:**
1. Design-review-v10 RC-1 wrote the fix as a `focusout` listener that sets `revealed = null` and then calls `paint()`. v11 writes it as a value of the existing `blur` writer instead: `blur` already sets `editing = null` and runs one paint, so a second listener would run a second paint for the same event. The `blur` on the input and the `focusout` that bubbles from it carry the same `relatedTarget`, so the outcome is the one the reviewer specified, with one paint (probed, `rv11/`).
2. Design-review-v10 RC-1's IH-E13f clause clicks "`#scale-back`'s row outside the helper". While the helper is open the sheet is inert (A3b), so that click would land nowhere. v11 clicks `#helper-title`, the helper's own non-focusable heading, which moves focus to the body with a null `relatedTarget`, as the probe did. The clause is a regression clause with no mutant of its own, like IH-E13f's RC-5 clause, so the counts are unchanged.
3. RC-1 makes one writer read `relatedTarget`. The STATE sentence is rescoped: render, announce and SC1 still read neither `relatedTarget` nor `document.activeElement`, so what shows and what is announced after an iOS blur with a null `relatedTarget` is exactly Chromium's. An iOS blur between two helper fields that reports a null `relatedTarget` counts as leaving; its only cost is that a later keyboard-close with focus kept may reveal the C11 field once, which is S10's outcome, already accepted ("the blocking error wins", design-review-v9 N-2). iOS Done is itself a blur with a null `relatedTarget`, so it resets `revealed` exactly as a Chromium tap outside does.
4. Eng-review-v10 RC-B names the bullet "2.10 `applyKbOffset()`"; the bullet is in 2b, and the text is appended there verbatim.
5. Eng-review-v10 RC-A's clause is taken verbatim, with DING `D3` and TOP `A Bb C D E F G A` added before BOTTOM `c eb` so the M16 line is settled and announced before BACK (BOTTOM's guesses read the ding's octave, eng-review-v10 N-4's point). A prefill is always valid and octaved, so the open paint never has a message to stay silent about; the clause proves that a reopen shows and speaks nothing, and A1's open-paint rule stays a rule without a dedicated mutant, as in v10.
6. Eng-review-v10 N-3 offered two options; v11 takes both. `hideHelper()` cancels a pending `#helper-live` write, as `resetHelper()` already does, and S15 says the pointer-BACK announcement is best-effort, because the blur's deferred write fires before the click only when a task boundary separates them.
7. Design-review-v10 N-1 (an italic on `.helpermsg.stale`) is declined: it is optional, it adds a fourth text style to the helper, and the field's amber focus ring and orange border already carry the state while the text is grey. Opacity is not used on any message text.

**v12 adaptations of review text:**
1. Eng-review-v11 RC-1's IH-E13f clause sets `.helperbody`'s `scrollTop` to its maximum. At 320x568 with M15 under DING and M16 under BOTTOM, the maximum (about 197 of about 361px of content in a 164px region, by 2b's row arithmetic) can lift the TOP INNER NOTES label above the region's top, so a click at its centre would miss it for a reason unrelated to the fix. v12 scrolls so INNER's row is at the list top and asserts three preconditions first: the list scrolls (`scrollHeight > clientHeight`), DING's row is not wholly inside, and INNER's label is wholly inside. A DING reveal during the press still moves the label away from the pointer, so the clause fails on a tree without the listener, as the reviewer intended. The reviewer's 1280x800 fallback is kept.
2. Eng-review-v11 RC-1's 2b bullet is taken verbatim. v12 appends what the brief asked to verify: the listener moves no focus (the browser's label activation does), the label stays the input's accessible name through `for=`, activation that is not a press is unchanged, a touch tap focuses the input as a press does, and a mouse drag-select that starts on a label is blocked (accepted gap, above).
3. Design-review-v11 nit 2 asked for a mutant beside IH-E13f. The tables give each test one mutant cell, so v12 puts a second name in IH-E13f's cell, separated by "; ", in place of a new test row: the S24 clause is the only step that kills it, and a separate test would repeat IH-E13e's phase 1 for one assertion. The check script counts mutants per cell.
4. Eng-review-v11 N-1 said to keep A17b as is and not credit it in section 9. v12 also makes it able to fail: a clause that cannot fail proves nothing. The reopen is read before any flush (the open paint must clear `#helper-live`), and a second pass leaves the M16 write pending across BACK (`hideHelper()` or the open paint must cancel it). Neither has a mutant, so the counts do not move.
5. R-1b gains a label tap with the keyboard up, because CDP's mouse and synthesized tap cannot show iOS Safari's label-to-input focus with a real keyboard.

**Nits:**

| Nit | Disposition |
|---|---|
| Eng: IH-A9 duplicate | folded: dropped with its mutant |
| Eng: `pendingPop` boolean | rejected with reason (above) |
| Eng: one keyboard model | folded: `helperBox` plus A19 |
| Eng: keydown Tab and Escape | folded: 2.3 |
| Eng: fragment navigation | v2: an accepted gap; v3: tested (A26, eng-v2 9(a)) |
| Eng: H1 verify runs its mutants | folded: loop in H1 verify |
| Eng: `/qa-only` is the plan | folded: section 6 |
| Eng: self-scores high | folded: section 9 scores lower where due |
| Design N1 z-index | folded: 45 plus IH-E12 |
| Design N2 cross-field inner copy | folded: M13 |
| Design N3 disabled USE reason | folded: `#helper-use-note` |
| Design N4 caption copy | first half folded; second half ("Fix TOP RIM NOTES") rejected in v2, folded in v3 by design-v2 RC5 into the USE note (C11), not the caption |
| Design N5 rim overflow on 14+ notes | rejected for now: inputs scroll horizontally natively, and every built-in fits; revisit if DEV shows otherwise |
| Design N6 landscape keyboard header | rejected: the owner accepted the crop (Q7) |
| Design N7 Enter-to-next on desktop | folded: A18 |
| Design N8 scroll `#scale-parse` into view | folded: 2.8 step 6 |
| Eng-v2: v1-rule examples "Bb2" | folded: "C3", "Eb3" (2.5); the v2 aria-label sentence that held the other is gone (RC4) |
| Eng-v2: tenth event wording | folded: "the tenth and eleventh events are" (H3) |
| Eng-v2: `ih_[!e]*` glob | folded: explicit name list in H2b verify (49 in v3, 52 in v4, 53 in v5, 54 in v6) |
| Eng-v2: acceptance grep paths | v3: H2 acceptance named the paths; v4: replaced by eng-v3 B's grep in H2a and H2b |
| Eng-v2: section 0 header | folded: header and section 3 say re-taken at b153406 |
| Design-v2 N-1 landscape areas | folded: 2b grid areas, section 6 step 11 |
| Design-v2 N-2 clamped guess | covered by RC4 (the guess is in the info line) |
| Design-v2 N-3 announce USE | folded: C14, 2.8 step 8, A25 (adaptation 2) |
| Design-v2 N-4 "B flat 3" | folded: 2.7 preview label, C15, A4b |
| Design-v2 N-5 75px pan | recorded as R6 |
| Design-v2 N-6 orange below 14px | folded: field errors at 14px (2.7, 2b) |
| Design-v2 N-7 "scale syntax" | kept: owner wording |
| Eng-v3 nit 1 "34 dev-only commits" | folded: 11 (section 5) |
| Eng-v3 nit 2 full M16 example | folded: 2.7 |
| Eng-v3 nit 3 `# suite:` headers | folded: H2a and H2b |
| Eng-v3 nit 4 "strictly above by midi" | folded: 2.5 step 5.3 |
| Eng-v3 nit 5 fragment nav consumes the helper entry | folded: accepted-gap paragraph above |
| Eng-v3 nit 6 286.7px | folded: 2.1, adaptation 5 |
| Design-v3 N-1 desktop row term | folded: 2b 1280x800 row, 293 with 5px to spare |
| Design-v3 N-2 landscape tokens | folded: 2b landscape bullet |
| Design-v3 N-3 layout-viewport shrink | folded: R1 |
| Design-v3 N-4 groundedness cites measurement | folded: section 9 |
| Design-v3 N-5 tightest margin | folded: 2b "Tightest margin" |
| Eng-v4 N-1 15 plus 1 app IM tests, 9616 assertion loss | folded: 3, H2a |
| Eng-v4 N-2 H2a lowers its own FLOORS rows | folded: H2a Owns |
| Eng-v4 N-3 literal field ids and lookups | folded: 2.2, 3 |
| Eng-v4 N-4 README counts | folded: H1, H2a, H2b acceptance, 5 (H2b 1185, v5 adaptation 1) |
| Eng-v4 N-5 verify loop fails closed | folded: H1, H2a, H2b verify (v5 adaptation 2) |
| Eng-v4 N-6 addEventListener, A27 liveness | folded: 2.3, A27 note |
| Eng-v4 N-7 stale CLAUDE.md cites | folded: H3, accepted gaps |
| Design-v4 N-1 M-string periods | folded: 2.10 and every quote (v5 adaptation 4) |
| Design-v4 N-2 IH-E14 58.5 | folded: IH-E14 |
| Design-v4 N-3 caption-tap transient | recorded: accepted gaps |
| Design-v4 N-4 swallowed tap | recorded: accepted gaps, by design |
| Eng-v5 N-1 A27 hideSheet clause | folded: A27 and its note |
| Eng-v5 N-2 `e.detail > 0` | folded: 2.3, A27 |
| Eng-v5 N-3 where focus moves | folded: 2.3 (`liftSheetInert()`, v6 adaptation 4) |
| Eng-v5 N-4 second timer | folded: 2.3, 2.8 step 8 |
| Eng-v5 N-5 H2b STALE pass | folded: H2b verify |
| Eng-v5 N-6 "once" | folded: 2.7 |
| Eng-v5 N-7 node-reported FLOORS | folded: H2a Owns |
| Design-v5 N-1 one voice for M2 | folded with the owner's text (v6 adaptation 2) |
| Design-v5 N-2 M11 slash | folded: 2.5, 2.10 (v6 adaptation 3) |
| Design-v5 N-3 landscape keyboard crop | recorded: section 6 R-4, accepted; the one-token clamp change is not taken |
| Design-v5 N-4 M15 and M16 two lines | no change: covered by the cap (2.7) |
| Design-v5 N-5 "B-flat" vs "B flat" | no action (reviewer) |
| Design-v5 N-6 M12 engine reason | no action (reviewer) |
| Eng-v6 N-1 close helpers | folded: 2.3, 2b (v7 adaptation 1) |
| Eng-v6 N-2 H1 patch count | folded: H1 verify |
| Eng-v6 N-3 CHROME_BIN unset | folded: H2a and H2b verify |
| Eng-v6 N-4 IH-E13d flake margin | folded: IH-E13d, 2b (v7 adaptation 2) |
| Eng-v6 N-5 floors 350 in section 7 | folded: v5 adaptation 6 |
| Eng-v6 N-6 regression clauses | folded: A25, A-table note |
| Design-v6 N-1 M9 comma | folded: 2.10 |
| Design-v6 N-2 M16 "change a guess" | folded: 2.7, 2.10, section 6 step 3 |
| Design-v6 N-3 380x780 budget | folded: 2b budget table (v7 adaptation 5) |
| Design-v6 N-4 M12 reachable codes | folded: 2.5 step 3, 2.7 (v7 adaptation 3) |
| Design-v6 N-5 IH-E13d headroom | folded: 2b "Tightest margin" |
| Eng-v7 N-1 M12 via `B#-2` | folded: 2.5 step 3, 2.5 step 5.3 |
| Eng-v7 N-2 v3 adaptation 3 old M16 | folded: section 7 v3 adaptation 3 |
| Eng-v7 N-3 H3 `test("` titles | folded: H3 sentence |
| Design-v7 N-1 M12 four lines | folded: 2.5 step 3, 2.7 |
| Design-v7 N-2 M1 slack | folded: 2.7 (v8 adaptation 6) |
| Design-v7 N-3 "Fix DING to continue." for M15 | intended, no change: C11 names the field that holds the message, and M15 sits under DING; its text names both the top notes and the ding |
| Design-v7 N-4 iOS disabled-USE tap | folded: section 6 R-6 and the exit criterion |
| Design-v7 N-5 section 9 one-line claim | folded: section 9 v8 Mobile row |
| Design-v8 N-1 `behavior:"auto"`, no smooth scroll | folded: 2.7 SCROLL (`scrollTop` assignment, `.helperbody` never declares `scroll-behavior`) |
| Design-v8 N-2 the 0px list between blur and keyboard close | folded: accepted as intended (2.7 SC1, 2b); the error reveal waits for the keyboard-close edge, so it never runs into a 0px list |
| Design-v8 N-3 M16 orphan word | folded: `text-wrap:pretty` on `.helpermsg` (2.7) |
| Design-v8 N-4 M16 re-announced per keystroke | folded: A1 announces only at settle; A15c |
| Design-v8 N-5 real-phone R-7 | folded: section 6 R-7 (the Android Back half and the iOS DING-to-TOP half; the iOS half now checks the model's claim that `relatedTarget` does not matter) |
| Eng-v8 N-1 A15c kill point | folded: A15's steps (A15c's v8 content moved to A15) state that the mutant fails at `G` |
| Eng-v8 N-2 Tab twice to BOTTOM | folded: IH-E13e steps |
| Eng-v8 N-3 scroll mutant shape | folded: SC1 is the only error-scroll call site, and `ih_no_settle_reveal` removes it |
| Eng-v8 N-4 `relatedTarget` definition for RC-3 | moot: no rule reads `relatedTarget` or which element has focus |
| Eng-v8 N-5 reset clears the hold flag | folded as v9 adaptation 6: no flag; `editing` reset stated, unobservable, untested |
| Eng-v8 N-6 iOS `relatedTarget` real-phone check | moot as a correctness check (the model ignores it); kept as half of R-7 to confirm |
| Eng-v8 N-7 0px list at 320 with the keyboard up | folded: 2b "Tightest margin" and 2.7 SC1 |
| Eng-v8 N-8 Verify on a dev checkout | folded: the line under H2a's Verify |
| Eng-v9 N-1 S15 with a pointer BACK | folded: S15's Announced cell reads "the blur's settle, if any (pointer only); nothing from the close" |
| Eng-v9 N-2 repeat announcement | folded: A1 clears `#helper-live` and writes on a deferred tick (v10 adaptation 6); A15b's repeat clause |
| Eng-v9 N-3 "empty" undefined | folded: R1 defines empty as `value.trim() === ""` for R1 and R5 |
| Eng-v9 N-4 writers while hidden | folded: 2.7 STATE, the writers and `paint()` run only while the helper is open |
| Eng-v9 N-5 SC1 then SC2 on desktop Tab | folded: recorded as intended in SC1 |
| Eng-v9 N-6 S10 against A28 | folded: S10 names "a later field (BOTTOM here, TOP in A28)" |
| Eng-v9 N-7 IH-E13e and IH-E13f evidence | folded: H2b acceptance names the first H2b CI run as their evidence, IH-E13g included |
| Design-v9 N-1 Note cells while focused | folded: S1, S4, S6, S10, S18 and the new S19 and S20 add "(hidden by focused compaction; read via USE's description)" |
| Design-v9 N-2 the reveal moves the field just left | folded: SC1, "the blocking error wins" |
| Design-v9 N-3 announce at open | folded: A1 (the open paint announces nothing), A17b clause (v10 adaptation 7) |
| Design-v9 N-4 split C9 | not taken: two new strings, and v10 adds no copy (v10 adaptation 8) |
| Design-v9 N-5 re-measure IH-E13's slack in the focus-then-keyboard order | folded: 2b "Tightest margin"; H2b re-measures on real fonts and records the figure in its PR |
| Eng-v10 N-1 `kbUp` writer wording | folded: the `kbUp` row states `next = helperBox(...) !== null` and compares `next` against `kbUp` |
| Eng-v10 N-2 and design-v10 N-3 pending write | folded once: A1, each settled write cancels a pending one before scheduling |
| Eng-v10 N-3 S15 pointer-BACK settle | folded: `hideHelper()` cancels a pending write and S15 says best-effort (v11 adaptation 6) |
| Eng-v10 N-4 A22 clause values | folded: A22's clause names DING `D3` and TOP `A Bb C D E F G A` |
| Eng-v10 N-5 zoomed Android Back | folded: section 7 accepted gaps, bounded by owner flag (d) |
| Eng-v10 N-6 `.stale` has no mutant | folded: recorded in section 9 with the other mutant-less clauses |
| Design-v10 N-1 italic stale text | not taken: optional, and focus ring and border carry the state (v11 adaptation 7); no opacity |
| Design-v10 N-2 name the accepted note-out-of-view states | folded: the note under the 2.7 scenario table names X2 and the keyboard-up transient |
| Design-v10 N-4 IH-E13g label at 320 | folded: IH-E13g's title says the label may be out of view at 320x568 |
| Design-v10 N-5 S19 keeps a real error | folded: S19 names A29's values, whose M15 is a real error the zoom must hold |
| Eng-v11 N-1 A17b near-vacuous | folded: two clauses that can fail (v12 adaptation 4); section 9 does not count A17b for A1's open-paint rule |
| Eng-v11 N-2 sandbox events carry no `target` | folded: the A-test note; listeners take the field from their closure |
| Eng-v11 N-3 Verify blocks red on dev | folded: a note after H2b's Verify block |
| Eng-v11 N-4 `.stale` has no mutant | no action: already recorded in section 9 |
| Design-v11 nit 1 S19 to S24 indent | folded: 2.7 |
| Design-v11 nit 2 mutant for the blur release | folded: `ih_blur_keeps_revealed` on IH-E13f (v12 adaptation 3) |

**Rollback:** each lane is merge commits on dev and is reverted with a `claude/dev-revert-<lane>` PR. Reverting H2b reverts H0b's `claude/dev-sync-h0b` merge first (its one line edits H2b's `#help-row`), then H2b's merge. Reverting H2a as well reverts H0a's `claude/dev-sync-h2a` merge, which carries H2a onto dev; that restores dev's import block as it was before H0a, the overlay's `#import-row` un-hide included. H2a is never reverted alone while H2b stands on it. `claude/dev-overlay` is not touched by any rollback. Prod is unaffected: main PRs stay open and `#help-row` ships hidden.

## 8. Owner answers, round 4 (2026-10-18)

- **Q-1.** EB, AB, DB and the rest refused like BB: **yes, same message.**
- **Q-2.** Bottom order: **low to high**, refused out of order like the top.
- **Q-3.** Ding-named octaveless bottom: **an octave down** (D under D3 is D2).
- **Q-4.** Guess rule: **start in the ding's octave and allow a bottom above the ding.** The left-to-right stepping for later notes (step 5.3) is the integrator's reading of "start within the same octave" combined with low-to-high order; it is the only reading under which an octaveless low-to-high list can never trip the order check. The owner can veto it at the plan PR.

**FYIs (no decision needed; veto at the plan PR):**
- Design-review-v3 RC-1 offered two fixes for the help row's height: a one-line row under the scale box (taken) or NEED HELP? in the sheet header (not taken). The one-line row keeps the owner's placement "under the scale box"; the header option would have moved it.
- Between H2a's and H2b's merges to dev, DEV shows neither the paste UI nor the helper. Prod is unaffected (the import row ships hidden on main today).
- Integrator auto-decision (eng-review-v4 RC-2): H2a reaches dev through `claude/dev-sync-h2a` (H2a's side taken on the import block) in place of its CONFLICTING PR D, and the help-row un-hide goes on `claude/dev-sync-h0b`, both under the existing dev-sync grant. The alternative, editing `claude/dev-overlay`, was not taken: the overlay predates `#help-row`, and dev moves only by merge commits. Consequence: the dev-env escape hatch (re-opening the overlay PR) must re-apply the help-row un-hide, recorded in the queue doc.
- Owner copy approved 2026-10-18: M2 "Use letter names, like D A Bb." and the order message "<X> is lower than <P>: list low to high." (M10, M14 and M18). The other v6 copy changes (M4, M9, M11, M13, M17) are design-review-v5's one-line rewrites of non-owner copy.

No owner question is open.

## 9. Self-check

### v12 (after eng-review-v11 and design-review-v11)

Scored against the regroup rubric. A row is 10 only if nothing in it is unproven by this plan's own evidence.

| Rubric row | v12 | Evidence |
|---|---|---|
| 1. Root cause stated and evidenced | 10 | Unchanged. RC-1 (a label press lost to SC1's scroll) was reproduced by the reviewer and by `v12probe/`, and the fix was probed in four input modes; RC-2 is the sandbox's own `undefined` and missing `removeProperty`, read in `tools/sandbox.js`. |
| 2. State plus pure render | 10 | Still four variables. The label listener writes no state and moves no focus; RC-2 changes guards only. |
| 3. Scenario coverage with tests | 9.5 | S1 to S24 each name a test, and the table renders as one table. Not 10: S14's iOS half needs R-6 on a real phone, and the label tap's iOS half needs R-1b. |
| 4. Rule, test, mutant at a named step | 9.5 | v11's map, plus the `revealed` release now has a mutant (`ih_blur_keeps_revealed`, killed at IH-E13f's S24 clause). Not 10: regression clauses without a mutant of their own are A22's kind clause, A15b's repeat write, A17b's two reopen clauses (which do not isolate A1's open-paint rule, eng-review-v11 N-1), IH-E13f's RC-5 and label clauses, and IH-E16's stale colour (the `.stale` grey has no mutant, eng-review-v10 N-6); and the steps are written, not run. |
| 5. Counts consistent; self-check passes | 10 | Script below: PASS. |
| 6. Owner decisions and scope untouched | 10 | M2, M10, M14, M18, NEED HELP?, the stacked plate, the BB refusal, the lanes and the scope are unchanged; no new copy. |
| 7. Simpler than v8 | 10 | Rules: still 10. States read: still 4 variables plus the compose result. One listener added, with no state. |

**Scripted self-check (v12).** Run over this file: no test ID appears in two table rows; no mutant name appears in two cells (a cell may hold several names separated by "; "); the H2b `M=` list has 63 names, each matching an A or IH-E row's mutant and none missing; the current text reads `-eq 63` and `-eq 17`, and no older count line; no current-version sentence carries a stale count or a rule v12 replaced (the surface "read at the call" and "when it is null" wording, the unguarded `hideHelper()` removal, the unguarded `kbUp` open value, A17b's single flushed clause); rows S1 to S24 are all indented; every Verify block's body passes `bash -n`. Result (script `v12tools/check.py`, scratch dir): PASS. 79 test rows (17 E, 39 A, 23 IH-E) holding 80 mutants (17 `ih_e_*`, 63 other), no duplicate ID, no duplicate mutant; the `M=` list is 63 unique names equal to the 63 non-`ih_e_` table mutants; four Verify blocks, each body `bash -n` clean, three mutant loops with `</dev/null` and none without, `CHROME_BIN` exported before H2a and H2b and checked by the guard as each block's first line, and H1, H2a and H2b each grep for STALE. History (section 0's v11 and older entries, section 7's v3 to v11 adaptations and the nit table, section 9's v11 and older tables) is excluded from the stale scan.

### v11 (after eng-review-v10 and design-review-v10)

Scored against the regroup rubric. A row is 10 only if nothing in it is unproven by this plan's own evidence.

| Rubric row | v11 | Evidence |
|---|---|---|
| 1. Root cause stated and evidenced | 10 | Unchanged. RC-1 is a missing value on the `blur` writer (`revealed` was never released when focus left), probed in `rv11/`; RC-A and RC-B are test text that contradicted 2.6 and the sandbox. |
| 2. State plus pure render | 10 | Still four variables. RC-1 adds a value to an existing writer; render, announce and SC1 still read only the four variables and the compose result. |
| 3. Scenario coverage with tests | 9.5 | S1 to S24 each name a test. Not 10: S14's iOS half needs R-6 on a real phone. |
| 4. Rule, test, mutant at a named step | 9.5 | v10's map, plus the `revealed` release (IH-E13f's RC-1 clause) and the reopen (A17b's corrected clause). Not 10: regression clauses without a mutant of their own are A22's kind clause, A15b's repeat write, A17b's reopen, IH-E13f's RC-5 and RC-1 clauses and IH-E16's stale colour (the `.stale` grey has no mutant; eng-review-v10 N-6), and the steps are written, not run. |
| 5. Counts consistent; self-check passes | 10 | Script below: PASS. |
| 6. Owner decisions and scope untouched | 10 | M2, M10, M14, M18, NEED HELP?, the stacked plate, the BB refusal, the lanes and the scope are unchanged; no new copy; the reopen follows owner Q3. |
| 7. Simpler than v8 | 10 | Rules: still 10. States read: still 4 variables plus the compose result. |

**Scripted self-check (v11).** Run over this file: no test ID appears in two table rows; no mutant name appears in two rows; the H2b `M=` list has 62 names, each matching an A or IH-E row's mutant and none missing; the current text reads `-eq 62` and `-eq 17`, and no older count line; no current-version sentence carries a stale count or a rule v11 replaced (the reopen with the fields as left, the `kbUp` writer's null-ness wording, the "never reads `relatedTarget`" scenario cell, the `paint()`-only `revealed` writer); every Verify block's body passes `bash -n`. Result (script `v11tools/check.py`, scratch dir): PASS. 79 test rows (17 E, 39 A, 23 IH-E), no duplicate ID, no duplicate mutant; the `M=` list is 62 unique names equal to the 62 non-`ih_e_` table mutants; four Verify blocks, each body `bash -n` clean, three mutant loops with `</dev/null` and none without, `CHROME_BIN` exported before H2a and H2b and checked by the guard as each block's first line, and H1, H2a and H2b each grep for STALE. History (section 0's v10 and older entries, section 7's v3 to v10 adaptations and the nit table, section 9's v10 and older tables) is excluded from the stale scan.

### v10 (after eng-review-v9 and design-review-v9)

Scored against the regroup rubric. A row is 10 only if nothing in it is unproven by this plan's own evidence.

| Rubric row | v10 | Evidence |
|---|---|---|
| 1. Root cause stated and evidenced | 10 | Unchanged from v9. Each v9 finding is a missing writer condition (zoom, kind), a missing call site (SC3) or a render output (stale), not a new visibility rule per event. |
| 2. State plus pure render | 10 | Four variables, each with its writers. The zoom freeze is a condition on `kbUp`'s writer; the stale grey and the kind check are render outputs; SC3 reads `document.activeElement` for a scroll target only and writes no state. |
| 3. Scenario coverage with tests | 9.5 | S1 to S23 each name a test. Not 10: S14's iOS half needs R-6 on a real phone. |
| 4. Rule, test, mutant at a named step | 9.5 | v9's map, plus: the zoom freeze (A29 at the scale-2 resize), the kind check (A22's clause), stale (A22b at the G3 input), SC3 (IH-E13g before any key), `revealed` reset (IH-E13f clause), open silence (A17b clause), the repeat write (A15b clause). Not 10: three of those are regression clauses without a mutant, and the steps are written, not run. |
| 5. Counts consistent; self-check passes | 10 | Script below: PASS. |
| 6. Owner decisions and scope untouched | 10 | M2, M10, M14, M18, NEED HELP?, the stacked plate, the BB refusal, the lanes and the scope are unchanged; no new copy; C9 not split. |
| 7. Simpler than v8 | 10 | Rules: v9's 9 plus SC3, so 10. States read: still 4 variables plus the compose result. |

**Scripted self-check (v10).** Run over this file: no test ID appears in two table rows; no mutant name appears in two rows; the H2b `M=` list has 62 names, each matching an A or IH-E row's mutant and none missing; the current text reads `-eq 62` and `-eq 17`, and no older count line; no current-version sentence carries a stale count (1191, 644, 353, "37 app", "22 e2e", "59 `ih_*`") or v9's zoom rule; every Verify block's body passes `bash -n`. Result (script `v10tools/check.py`, scratch dir): PASS. 79 test rows (17 E, 39 A, 23 IH-E), no duplicate ID, no duplicate mutant; the `M=` list is 62 unique names equal to the 62 non-`ih_e_` table mutants; four Verify blocks, each body `bash -n` clean, three mutant loops with `</dev/null` and none without, `CHROME_BIN` exported before H2a and H2b and checked by the guard as each block's first line, and H1, H2a and H2b each grep for STALE. History (section 0's v9 and older entries, section 7's v3 to v9 adaptations and the nit table, section 9's v9 and older tables) is excluded from the stale scan.

### v9 (regroup after design-review-v8 and eng-review-v8)

Scored against the regroup rubric. A row is 10 only if nothing in it is unproven by this plan's own evidence; "unreviewed" alone does not cost a point here, because the regroup is reviewed next.

| Rubric row | v9 | Evidence |
|---|---|---|
| 1. Root cause stated and evidenced | 10 | `regroup-v9-cause.md`: both halves of the hypothesis confirmed; each v6 to v8 finding mapped to the event path the rules missed; the 9 event kinds, 10 states and 20 rules listed. |
| 2. State plus pure render | 10 | 2.7 STATE: four variables, each with its writers and events; RENDER, ANNOUNCE and `revealTop` are pure; no `document.activeElement`, no `relatedTarget`; no rule names an event except the writers. |
| 3. Scenario coverage with tests | 9.5 | S1 to S18 cover every case in the regroup prompt and the v6 to v8 reviews, and each names its test. Not 10: S14's iOS half (whether a tap on a disabled USE blurs) is platform behaviour that only R-6 on a real phone can prove. |
| 4. Rule, test, mutant at a named step | 9.5 | R1 (A15, eligibility), R2 (A15 blur step, A15d blur step), R3 (A15 at `G`, A15d at `A`, A15c at `C3`, A22), R4 (A6, A15), R5 (A6b, A21, A15, A15d), A1 (A15b, A15c, A17b), SC1 (IH-E13e phase 1, IH-E13f), the keyboard edge (A28, IH-E13e phase 2), SC2 and `revealTop` (IH-E13b, IH-E13c, IH-E13d). Not 10: the open's `editing = null` writer has no mutant because no output can observe it (v9 adaptation 6), and the steps are written, not run (H2b writes them). |
| 5. Counts consistent; self-check passes | 10 | Script below: PASS. |
| 6. Owner decisions and scope untouched | 10 | M2, M10, M14, M18, NEED HELP?, the stacked plate, the BB refusal, the lanes and the scope are unchanged; no new copy. Four behaviour changes are flagged for the owner in section 0. |
| 7. Simpler than v8 | 10 | Rules: 20 in v8 (26 with the v8 reviews' asks) to 9 in v9 (R1 to R5, A1, SC1, SC2, `revealTop`). Event kinds the rules react to: 9 to 5 (input, blur, the keyboard-close edge, open, focus), of which 3 decide visibility. States read: 10 to 4 variables plus the compose result. |

**Scripted self-check (v9).** Run over this file: no test ID appears in two table rows; no mutant name appears in two rows; the H2b `M=` list has 59 names, each matching an A or IH-E row's mutant and none missing; the current text reads `-eq 59` and `-eq 17`, and no older count line; no current-version sentence carries a stale count (1189, 643, 352, "36 app", "21 e2e", "57 `ih_*`") or a removed rule ("hold flag", "relatedTarget is not the other", "a later field receives input", "A complete bad token", the three renamed mutants); every Verify block's body passes `bash -n`. Result (script `v9tools/check.py`, scratch dir): PASS. 76 test rows (17 E, 37 A, 22 IH-E), no duplicate ID, no duplicate mutant; the `M=` list is 59 unique names equal to the 59 non-`ih_e_` table mutants; four Verify blocks, each body `bash -n` clean, three mutant loops with `</dev/null` and none without, `CHROME_BIN` exported before H2a and H2b and checked by the guard as each block's first line, and H1, H2a and H2b each grep for STALE. History (section 0's v8 and older entries, section 7's v3 to v8 adaptations and the nit table, section 9's v8 and older tables) is excluded from the stale scan.

### v8 (after eng-review-v7 and design-review-v7)

A row is 10 only if no v7 review left anything open on it and v8 added nothing unreviewed to it. The v7 column is this plan's v7 self-score; eng-review-v7 scored Groundedness 9.5, Interaction completeness 9.5, Testability 9 and Clarity 9.5, and design-review-v7 scored 9.3 overall, with States 9, Small-viewport fit 9 and Error discoverability 8.5.

| Row | v7 | v8 | Evidence |
|---|---|---|---|
| Owner-decision fidelity | 10 | 10 | Owner copy (M2, M10, M14, M18), the CTA NEED HELP?, the stacked plate and the BB refusal are unchanged. |
| Groundedness | 9.5 | 10 | The one reachable M12 path (`B#-2`) is closed by M17's octave clause, as eng-review-v7 probed (N-1); the 380x780 row carries the measured 3.4px scroll (RC-2); M1's 4.8px slack and M12's four lines are the reviewer's measurements. |
| Interaction completeness | 9.5 | 9.5 | M15 waits for DING as well as TOP (design RC-1), and an error left out of view after a blur is scrolled in (RC-3). Not 10: the `relatedTarget` reading of "anywhere but the other" (v8 adaptation 1) and the RC-3 trigger points are v8 text no reviewer has read. |
| Mobile and keyboard proof | 10 | 9.5 | Every fixed-text message but M15 is one line at 320, M1 included with 4.8px of slack; M16 is two lines by design, and M4 with a long token and M12 can wrap, all under the cap (N-5). R-6 records the iOS disabled-USE tap. Not 10: IH-E13e's geometry (the row fits only once the keyboard closes) is v8's arithmetic from 2b, not measured on the new code. |
| Testability | 9.5 | 9.5 | A15c's steps are pinned (eng RC-1) with a clearing step; A15d and IH-E13e each carry one mutant: 17 E, 36 A and 21 IH-E, 74 new patches. Not 10: A15d's and IH-E13e's steps are v8's and unreviewed. |
| Lane shape | 10 | 10 | Unchanged. |
| Scope discipline | 10 | 10 | Two tests and two mutants (A15d, IH-E13e), one scroll rule and doc fixes; nothing beyond the review items. |
| Clarity | 10 | 10 | The hold flag is stated once in 2.7 and once per test; counts are checked by the script below. |

**Scripted self-check (v8).** Run over this file: no test ID appears in two table rows; no mutant name appears in two rows; the H2b `M=` list has 57 names, each matching an A or IH-E row's mutant and none missing; the current text reads `-eq 57` and `-eq 17`, and no older count line; no current-version sentence carries a stale count (1187, 642, 351, "35 app", "20 e2e", "0.6px") or stale text ("up to three", A15c's old title, M16's "change it.", "while TOP has focus" as the whole rule); every Verify block's body passes `bash -n`. Result (script `v8tools/check.py`, scratch dir): PASS. 74 test rows (17 E, 36 A, 21 IH-E), no duplicate ID, no duplicate mutant; the `M=` list is 57 unique names equal to the 57 non-`ih_e_` table mutants; four Verify blocks, each body `bash -n` clean, three mutant loops with `</dev/null` and none without, `CHROME_BIN` exported before H2a and H2b and checked by the guard as each block's first line, and H1, H2a and H2b each grep for STALE. Every remaining hit of a stale value is a pixel size (USE 52px, the wireframe header), the 350ms window, the owner's bottom-note rule ("sit above the ding", 2.5 step 5.3), a v8 adaptation naming the value it supersedes (644, 0.6px), or this paragraph's own list.

### v7 (after eng-review-v6 and design-review-v6)

A row is 10 only if no v6 review left anything open on it and v7 added nothing unreviewed to it. The v6 column is this plan's v6 self-score; eng-review-v6 scored Groundedness 9.5, Interaction completeness 9.5, Mobile and keyboard 9.5, Testability 8 and Clarity 9, and design-review-v6 scored Interaction states 9, Copy 9.5 and Accessibility 9.5.

| Row | v6 | v7 | Evidence |
|---|---|---|---|
| Owner-decision fidelity | 10 | 10 | Owner copy (M2, M10, M14, M18) is unchanged; M1, M9 and M16 are non-owner copy. |
| Groundedness | 10 | 9.5 | Every new figure is a reviewer measurement (M1 one line, 0.6px budget spare (corrected to a 3.4px scroll in v8, design-review-v7 RC-2), 4.5px and 21.4px, 23.5px under the mutant), and line 1010's 350 is corrected (N-5). Not 10: the "no code reaches M12" statement is read from `core.js`, not probed through compose, which does not exist yet (v7 adaptation 3). |
| Interaction completeness | 9 | 9.5 | `hideHelper()` and `closeHelper()` are defined with the guard's ordering (N-1), and M15 waits for TOP (RC-1). Not 10: the pointer-BACK clarification (v7 adaptation 1) and M15's timing are v7 text no reviewer has read. |
| Mobile and keyboard proof | 10 | 10 | Every fixed-text message but M15 is one line at 320 (M1 after design-review-v6 RC-2); IH-E13d's bound is 8px with a 15px kill margin (N-4); the 380x780 two-line M16 fit is in the budget table (N-3). |
| Testability | 9 | 9.5 | H3's title check is the reviewer's verified node block (RC-1), H1 checks its patch count (N-2), H2a and H2b refuse an unset `CHROME_BIN` (N-3); each test keeps one mutant: 17 E, 35 A and 20 IH-E, 72 new patches. Not 10: A15c is new and unreviewed. |
| Lane shape | 10 | 10 | Unchanged. |
| Scope discipline | 10 | 10 | One test and one mutant (A15c, RC-1), copy edits and doc fixes; nothing beyond the review items. |
| Clarity | 10 | 10 | The close helpers, the regression clauses (N-6) and the M12 reachability are stated once each; counts are checked by the script below. |

**Scripted self-check (v7).** Run over this file: no test ID appears in two table rows; no mutant name appears in two rows; the H2b `M=` list has 55 names, each matching an A or IH-E row's mutant and none missing; the current text reads `-eq 55` and `-eq 17`, and no older count line; no current-version sentence carries a stale count (1186, 641, "34 app", "within 5px") or old copy (M1's "The scale line", M9 without its comma, M16's "change it.") or the old `grep -o` title check; every Verify block's body passes `bash -n`. Result (script `v7tools/check.py`, scratch dir): PASS. 72 test rows (17 E, 35 A, 20 IH-E), no duplicate ID, no duplicate mutant; the `M=` list is 55 unique names equal to the 55 non-`ih_e_` table mutants; four Verify blocks, each body `bash -n` clean, three mutant loops with `</dev/null` and none without, `CHROME_BIN` exported before H2a and H2b and checked by the guard as each block's first line, and H1, H2a and H2b each grep for STALE. Every remaining hit of 52 or 350 is a pixel size (USE 52px, the wireframe header), the 350ms window, or the Groundedness row naming the corrected floor; "sit above the ding" survives only in the owner's bottom-note rule (2.5 step 5.3). H3's `node -e` check was also run on a scratch tree: 0 with a cite whose title has inner double quotes, 1 with MISSING after a stale cite was added.

### v6 (after eng-review-v5 and design-review-v5)

A row is 10 only if no v5 review left anything open on it and v6 added nothing unreviewed to it. The v5 column is this plan's v5 self-score; eng-review-v5 scored Groundedness 9, Interaction completeness 9, Mobile and keyboard 9.5, Testability 7 and Clarity 9, and design-review-v5 scored Copy 9 and Keyboard-up layout 9.

| Row | v5 | v6 | Evidence |
|---|---|---|---|
| Owner-decision fidelity | 10 | 10 | The owner's 2026-10-18 copy (M2, the order message) is used verbatim, over the reviewer's M2 (v6 adaptation 2); section 8 records the approval and drops the superseded periods FYI. |
| Groundedness | 10 | 10 | The "pins hideSheet" claim is corrected and made true by A27's immediate assertion (N-1). Every new copy line was measured on real fonts at 320 and 380; the M4 limit is the measured 10 characters, not the reviewer's 5 (v6 adaptation 5). |
| Interaction completeness | 10 | 9 | The done-write is USE-only, focus moves in one place, and one timer covers both USE paths (RC-2, N-3, N-4). Not 10: the split between `liftSheetInert()` and the USE-only timer callback is v6's shape for N-3 and N-4 and has not been reviewed. |
| Mobile and keyboard proof | 10 | 10 | The capped scroll keeps the typed text in view under a two-line message at 320x568/260 (RC-1, IH-E13d); every fixed-text message but M15 is one line at 320 (RC-2). |
| Testability | 10 | 9 | Every Verify block runs under bash with an empty stdin for the suite (RC-1), H2b also checks the `i_*` patches (N-5), and each test keeps one mutant: 17 E, 34 A and 20 IH-E, 71 new patches. Not 10: the IH-E13c/IH-E13d split is unreviewed (v6 adaptation 1). |
| Lane shape | 10 | 10 | Unchanged; eng-review-v5 scored it 10. |
| Scope discipline | 10 | 10 | One new test and one mutant (the cap), shorter copy and doc fixes; nothing beyond the review items. |
| Clarity | 10 | 10 | The bash sentence (RC-1), "each time a message appears, or its text changes" (N-6), the `e.detail > 0` test (N-2) and the node-reported FLOORS note (N-7) are in; counts are checked by the script below. |

**Scripted self-check (v6).** Run over this file: no test ID appears in two table rows; no mutant name appears in two rows; the H2b `M=` list has 54 names, each matching an A or IH-E row's mutant and none missing; the verify line reads `-eq 54`; no current-version sentence carries a stale count (53 mutants, 19 e2e tests, 1185, 350) or old copy; every Verify block's body passes `bash -n`. Result (script `v6tools/check.py`, scratch dir): PASS. 71 test rows (17 E, 34 A, 20 IH-E), no duplicate ID, no duplicate mutant; the `M=` list is 54 unique names equal to the 54 non-`ih_e_` table mutants; the current text counts `-eq 54` only; four Verify blocks, each body `bash -n` clean, three mutant loops with `</dev/null` and none without, `CHROME_BIN` exported before H2a and H2b, and H1, H2a and H2b each grep for STALE. Every remaining hit of 52, 53, 350, 1185 or "19 e2e" is a pixel size (USE 52px), the 350ms window, a history row, or this paragraph's list of stale values; "sit above the ding" survives only in the owner's bottom-note rule (2.5 step 5.3), not in copy.

### v5 (after eng-review-v4 and design-review-v4)

A row is 10 only if no v4 review left anything open on it and v5 added nothing unreviewed to it. The reviewers' own scores are cited; the v4 column is this plan's v4 self-score.

| Row | v4 | v5 | Evidence |
|---|---|---|---|
| Owner-decision fidelity | 10 | 10 | Rounds 1 to 4 are unchanged. The dev-sync path (RC-2) is recorded as the integrator's auto-decision with an owner FYI, and the M-string periods on owner copy are an FYI too (section 8), which is what eng-review-v4's 9 asked for. |
| Groundedness | 10 | 10 | eng-review-v4 scored 8 because the H0 mechanism and the acceptance grep were not run against the tree. v5 takes the reviewer's `git merge-file` result (RC-2) and the line 1 of tests/import_gold.test.js, re-read at origin/dev b153406 for v5; FLOORS 623, 335 and 63 and README:77 1132 were re-read there too. |
| Interaction completeness | 9 | 10 | One `liftSheetInert()` on every path that ends the window (RC-3), the A27 reopen clause, and the message scroll under the focused field (design RC-2, IH-E13c). The caption-tap transient and the swallowed tap are recorded, not left open. |
| Mobile and keyboard proof | 10 | 10 | design-review-v4 measured the plan's 2b CSS on real fonts; the one unreadable state it found (320x568/260, message under TOP) now scrolls into view and has a test. The real-keyboard gap stays inherent and gated (section 6 exit). |
| Testability | 9 | 10 | 17 E, 34 A and 19 IH-E tests, one mutant each, 70 new patches; every verify loop fails closed on a patch that does not apply (N-5); A27's liveness clause is labelled as such (N-6). |
| Lane shape | 9 | 10 | H2a's dev path is now mergeable (H0a on `claude/dev-sync-h2a`), H0b has a branch that can carry it, and H2a's own FLOORS lowering is stated for the reviewer (N-2). |
| Scope discipline | 10 | 10 | No new behaviour beyond the review items: one helper function, one scroll call, one test and one mutant. |
| Clarity | 10 | 10 | The 15 plus 1 IM test split, the expected README and FLOORS numbers per lane, the C11 short field names and the stale-cite window are stated; counts are checked by the script in this section. |

**Scripted self-check (v5).** Run over this file: no test ID appears in two table rows; no mutant name appears in two rows; the H2b `M=` list has 53 names, each matching an A or IH-E row's mutant and none missing; the verify line reads `-eq 53`; no current-version sentence carries a stale count (52 mutants, 18 e2e tests, 1184, `import-v2-gold`). Result (script `v5tools/check.py`, scratch dir): PASS. 70 test rows (17 E, 34 A, 19 IH-E), no duplicate ID, no duplicate mutant, the `M=` list is 53 unique names equal to the 53 non-`ih_e_` table mutants, the H2b verify counts 53 and no verify line counts 52. Every remaining hit of 52, 1184, "rebase" or `import-v2-gold` is a pixel size (USE 52px), a history row, or a sentence that says the old value is superseded.

### v4

A row is 10 only if no v3 review left anything open on it and v4 added nothing unreviewed to it. The real-phone keyboard pass (section 6 exit) is an inherent plan limit: design-review-v3 says that after RC-1 to RC-4 "the plan does everything a plan can".

| Row | v3 | v4 | Evidence |
|---|---|---|---|
| Owner-decision fidelity | 10 | 10 | Every round 1 to 4 answer is mapped in section 0 with the owner's copy verbatim; RC-1 keeps NEED HELP? under the scale box and records the header alternative as an FYI (section 8). |
| Groundedness | 9 | 10 | design-review-v3 measured the budget table in a browser: it matches the arithmetic within 1px on all six rows, and its one miss (the desktop row term) is folded (N-1, 293 with 5px to spare). The hint is cited at the measured 286.7px; the dev-only commit count is the measured 11. |
| Interaction completeness | 9 | 9 | The ghost tap and the double-pop case are closed by the 350ms inert window (A27, section 6 step 7), and the measured popstate latency replaces "within one task". Not 10: A27's sandbox wording and the move of the announcement and focus to the inert lift are v4 adaptations no review has seen. |
| Mobile and keyboard proof | 9 | 10 | Fixed 44px inputs (RC-2), focus scrolls the whole field row (RC-3, IH-E13b), compact focused padding (RC-4), real fonts on every layout test (eng-v3 D), so the CI emulation is faithful (eng-review-v3 section 5). The remaining gap is inherent and gated: CI simulates the keyboard, and the recorded real-phone pass is the prod un-hide exit criterion (section 6). |
| Testability | 9 | 9 | Every test carries exactly one mutant (17 E, 34 A, 18 IH-E; 69 new mutants), the guess and error colours now have a test (IH-E16), and the verify loops name every mutant. Not 10: the IH-E13 split and A27's state-based wording are unreviewed. |
| Lane shape | 9 | 9 | H2 is split into H2a (removal, no new behaviour) and H2b (helper), serial, each with Owns, tests, mutants, acceptance, verify and non-goals; bases and merge order are stated (section 5). Not 10: the split's details, the two-step H0 and the re-anchor hand-off from H2a to H2b are unreviewed. |
| Scope discipline | 10 | 10 | No solfege, presets, layout controls or `pendingPop` refactor; every v4 addition (A27, IH-E13b, IH-E16, the inert window) answers a review item. |
| Clarity | 9 | 10 | One lane per job, counts consistent across sections 0, 4, 7 and 9 (checked by grep), adaptations listed per version. |
