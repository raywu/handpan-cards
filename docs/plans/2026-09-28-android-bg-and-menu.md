# Android background and settings menu

> **Closed 2026-09-29.** The OPEN rows below were triaged by `docs/plans/2026-09-29-backlog-and-refactor.md` §7 (base `e428946`). New work goes to that plan's §7 carried list, not here. Row bodies are unchanged so history stays greppable.

- **Goal:** after the lanes below merge, (a) no box, canvas or browser-chrome colour that the page controls paints anything but the table colour at any viewport size, and CI proves that for every candidate CDP can see; (b) the print options, the NAME->NOTES / NOTES->NAME toggle and "+ Add a scale" live in one settings menu, opened from the header, and the card face carries no controls.
- **Date:** 2026-09-28
- **Base:** `main` @ `879499d` (merge of PR #151). Every file:line below was read at that SHA.
- **Shape:** /swarm, four lanes. A (background) runs in parallel with M1 (menu shell + print + mode). M2 (+ Add a scale) waits for M1 to merge, and M3 (desktop sidebar) waits for M2.
- **Prompt:** `docs/prompts/2026-09-28-android-bg-and-menu.md`
- **Related docs:**
  - `docs/plans/2026-09-24-quality-eval.md` (the "quality-eval" plan): N1-N10 and the §6 gates.
  - `docs/plans/2026-09-27-followup-triage.md`: N11-N14 and the structural template.

## §1 Goal and non-goals

**Why.** The owner reported two things:
- a white bar on some Android phones;
- print controls sitting inline on the card.

Neither is a data or geometry change. Both touch the chrome that the CHROME_BUDGET, LANDSCAPE_BUDGET and "portrait is byte-identical" tests pin. Those tests are the contract every lane works against.

**Non-goals.** N1-N10 (quality-eval) carry over unchanged. N13 carries over from the follow-up triage: no edits to `tests/mutation_check.sh`. New non-goals:

| # | Non-goal |
|---|---|
| N15 | No change to deck data, diagram geometry, card anatomy, fonts or palettes. The menu reuses `.mode`, the sheet surface `#1f1b15` and the spacing ramp. It introduces no new colour or typeface |
| N16 | Part A moves no box. Every CHROME_BUDGET, LANDSCAPE_BUDGET and portrait-identity row is unchanged by lane A |
| N17 | No history entry for the menu. Android back with the menu open behaves as it does today (DEFER. Trigger: an owner report) |
| N18 | Deck chips, Shuffle, prev/next and the counter do not move |
| N19 | No PWA manifest in this workstream. `theme-color` is a `<meta>`, not a manifest field |

## §2 Findings

### Part A: the white bar

The bar has not been reproduced, and no device was named. Each candidate below was checked at `879499d`.

| # | Candidate | Verified at | Verdict | What the fix changes / how a test sees it |
|---|---|---|---|---|
| A1 | No `<meta name="theme-color">` | `index.html:12-13` (head: viewport only) | **FIX, DEVICE-GATE** | Android Chrome, Samsung Internet and most Chromium browsers tint the status bar and URL bar from this meta. Without it they paint them light. That is the likeliest thing a user calls "a white bar". The fix adds `content="#1a1815"`. CI can assert the meta exists and equals `--table`. Only a device can show the bar's colour |
| A2 | No `color-scheme` | none in `index.html` | **FIX** | The canvas before first paint, and the UA widgets (the paper `<select>` popup, scrollbars, autofill) default to light. The fix is `:root{color-scheme:dark}` plus `<meta name="color-scheme" content="dark">`. The meta covers the pre-CSS paint. CI asserts `getComputedStyle(documentElement).colorScheme === "dark"` |
| A3 | `html` has no `background-color`. The dark comes only from `body`'s radial-gradient, which propagates to the canvas | `index.html:63-81` | **FIX (hardening)** | Propagation does cover the canvas today. But it rests on a gradient image with no colour under it. Any frame where the image is not yet painted, or where the root box is re-sized mid-resize, shows the canvas's default white. The fix is `html{background-color:var(--table)}`. `body` keeps its gradient, so body's background no longer propagates and the gradient paints on body's own box. That box is at least `100dvh` (`:79`), so nothing visible moves; the portrait tests prove it. CI checks canvas pixels at the four edges and just past the document end |
| A4 | `min-height:100dvh` on body. `#scale-sheet` is `position:fixed; inset:0` | `:79`, `:421` | **NOT A CAUSE after A3** | A band between `dvh` and `lvh` during URL-bar collapse falls on the canvas, and after A3 the canvas is table-coloured. CI cannot emulate this: `setViewport` makes CDP relay the page out, so no unpainted band ever exists in the capture (eng review F2). The oversized case stays in the matrix as a smoke check, but the band itself is **DEVICE-GATE** (§7 step 2) |
| A5 | Edge-to-edge Android (gesture bar), `viewport-fit=cover` | `:12`, body padding `:80` | **DEVICE-GATE** | The area under the gesture bar is canvas, which A3 covers. CDP cannot emulate the system bars, so only a device confirms it |

**Test matrix for lane A** (the e2e test):
- portrait: 360x800 (20:9), 412x915, 390x844, 320x568;
- landscape: 915x412, 844x390;
- foldable unfolded: 673x841;
- tablet: 800x1280;
- desktop: 1280x800;
- each also run with an oversized viewport after load (A4).

At every size, read a full-viewport screenshot (`Page.captureScreenshot`) and assert that every pixel in the outer 4px frame is within ΔE of `#1a1815`/`#26221c`, never `#ffffff`. Also run the check once with the scale sheet open.

At base this check passes already, because propagation paints the canvas (eng review F3). So one row also sets `document.body.style.backgroundImage = "none"` to simulate an unpainted gradient, and asserts that the edges stay table-coloured. That row fails at `879499d` and passes only with A3, so it is what kills `ab_root_bg_dropped`.

Print hardening (eng review F1): A3 puts a dark background on `html`, and the print block's `*{print-color-adjust:exact}` (`:767`) would print it on the margins or overflow pages of a browser Cmd+P. So lane A also adds `background:#fff` to the print block's `html,body` rule (`:775`). CI asserts that under `emulateMediaType("print")`, `html`'s computed `background-color` is white.

### Part B: the menu

**Design direction** (from /frontend-design, under the hard constraint N15).

The menu is a panel that drops from a single header button. It is not a new visual language: it is the scale sheet's surface in miniature. The one memorable thing is restraint. It opens under the trigger like a drawer pulled out of the table, has three short groups, and is gone on the next tap. Every control in it is an existing control, moved.

```
portrait (390)                          landscape (844x390)
+----------------------------------+    +-------------------------------------------+
| [  ]  Handpan Chord Cards   [==] |    | (Hijaz)(Pygmy)(Amara)(My scale)  ...  [==] |
| (Hijaz)(Pygmy)(Amara)(My scale)> |    +-------------------------------------------+
+----------------------------------+
                      +------------------+  <- panel, anchored top-right,
                      | Practice         |     max-width 320px, #1f1b15,
                      | [NAME→NOTES][NOTES→NAME]    1px #433b2c, radius 12px
                      | Scales           |
                      | [+ ADD A SCALE]  |   (M2)
                      | Print this deck  |
                      | [FULL DECK PDF]  |
                      | [PRINT-ONLY PDF] |
                      | Paper [LETTER ▾] |
                      +------------------+
```

Decisions:
- **Trigger.** A 44x44 button with a three-line glyph drawn in CSS (no icon font), styled as `.mode`, accessible name "Settings". Portrait: it sits in the h1 row, which becomes a `44px 1fr 44px` grid so the title stays optically centred. Landscape: it is the last item in the one-row header, after the deck strip. The modebar row is gone in both.
- **Panel.** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at a visually hidden "Settings" heading. It has a translucent scrim over the practice screen. Group headings are Marcellus at 14px in `#c4bcab`, sentence case (the display face, used as it is used on the sheet title). Controls keep their existing ALL-CAPS Nunito styling because that is the app's button voice (N15).
- **Placement (eng review F4).** The panel and its scrim are body-level siblings of `#scale-sheet`, NOT children of `<header>`. The sheet inerts `header, main, footer` (`:6546`, set at `:7148`, restored at `:7231`), so a panel inside the header would be inert whenever the sheet is open, and the M2 hand-off would break.
- **Dismissal.** Escape, a scrim tap or the trigger closes the panel and returns focus to the trigger. The sheet has no generic helper to reuse. What it has is a pattern, and the panel copies that pattern with its own data:
  - background `inert` on `header, main, footer` while open (`:7148`/`:7231`);
  - an explicit Tab stops list (`:7489-7505`), built from the panel's own controls.
- **Keyboard ownership (eng review C3).** While the panel is open, the document keydown handler (`:7547-7556`) handles only Escape, the same guard `sheetOpen` gets. ArrowLeft/ArrowRight do not step the card, and Enter/Space do not flip it.
- **Targets (eng review C4).** Every panel control is at least 44x44, including both print buttons and the paper select. The `.prints` 7px type grows to the `.mode` size. These IDs join the 44px target test (`tests/e2e.test.js:2430-2440`).
- **After an action.** Choosing a mode closes the panel, since that one tap was the whole task. A print button starts the build and closes the panel. The paper choice keeps the panel open, because the next tap is a print button. "+ Add a scale" closes the panel and opens the scale sheet.
- **Focus after the sheet (eng review C2).** On Back, Escape or popstate from the create state, focus goes to the settings trigger. Generate, Save and Delete keep today's contract: focus goes to the selected deck chip (`selectDeck` `:5700-5715`; e2e `:5583`). Delete opens from Edit, whose opener is a chip, so it never returned to `#deck-add` in the first place.
- **IDs are kept.** `#modeA`, `#modeB`, `#deck-add` and the `.prints` class move with their controls. `downloadDeckPDF`'s `btn.closest(".prints")` (`:6304`), `setMode` (`:7535-7537`) and the tests and mutants aimed at those IDs keep their anchors.

| Control | Verdict | Reason |
|---|---|---|
| `.prints` row (`index.html:6342-6349`) | **MOVE** (M1) | The owner asked for it. At 7px it is the smallest type on the screen. It renders into both faces and needs a tab-order workaround (`:6412-6424`) that goes away with it |
| Modebar (`:790-792`) | **MOVE** (M1) | The owner named it. It is a set-once preference. Removing it takes out a 44px row plus `--sp-3` (about 58px). The h1 row grows to 44px for the trigger, so the net chrome saving is about 41px (eng review C5). The card does not get all of that: it grows only where height binds, and it is capped by `--card-w`. On width-bound rows (390x844, 926x428) only the chrome shrinks. In landscape it hands the strip about 241px, which ends the strip overflow measured at 844x390 |
| `+ ADD` chip | **MOVE** (M2) | The owner named "scales / add". Adding a scale is rare, and the strip is for switching decks. Editing a custom deck stays on its selected chip (`.chip.editable`) |
| Deck chips | STAY | Primary navigation, one tap |
| Shuffle, prev/next, counter | STAY | In use every few seconds during practice |

**Desktop: an expanded sidebar (M3, owner follow-up 2026-09-28).** The owner said the hamburger is assumed on mobile and asked for a judgement on desktop. The verdict is **sidebar**, from `@media (min-width:1024px) and (min-height:700px)`.
- **The card gives nothing up.** It is capped at `--card-w:min(88vw, 46vh, 420px)` (`index.html:23`), so from 1024px wide it is bound by height or the 420px cap, never by width. At 1280x800 the card is about 368px wide and roughly 450px on each side is empty. A 240px sidebar takes empty table, not card.
- **Desktop is where printing happens.** The PDFs go to a print shop. A permanently visible print group makes that one click, with nothing to discover.
- **Mobile keeps the hamburger** as designed. The breakpoint excludes every phone in both orientations: landscape phones are at most 520px tall, and portrait phones are narrower than 1024px. iPad landscape (1024x768) gets the sidebar, which is correct because it has the room.
- **One markup, two presentations. There is no second component.** The panel is an `<aside aria-label="Settings">`.
  - Below the breakpoint, it behaves exactly as M1 builds it: it gains `role="dialog"`/`aria-modal` only while open, plus the inert background, the stops list and the keydown guard.
  - At the breakpoint, CSS shows it as a static column on the right, hides the trigger and the scrim, and no modal state ever applies.
  - A `matchMedia` change listener closes an open modal panel, restoring inert and focus, if the viewport crosses the breakpoint while it is open.
- **Look.** It uses the same `#1f1b15` surface, `1px #433b2c` hairline and group headings as the panel. It is full height, with no radius on the outer edge, so it reads as a panel set into the table edge. Nothing new visually (N15).
- **Keyboard.** The sidebar sits after `main` and `footer` in DOM and Tab order. The arrow keys and Enter keep driving the card, because the sidebar is not modal.


## §3 Lanes

Lanes A and M1 both edit `index.html` but own disjoint line regions:
- A owns the `<head>` meta block, the `html`/`body` rules at `:63-82`, and the single print-block line `:775`;
- M1 owns header markup and CSS, `headerHTML`, and the mode and print wiring.

Neither touches the other's lines, so the two are safe in parallel. `tests/suite_health.py` FLOORS is a shared single-number row; the second lane to merge rebases and adds (see §5). M2 is serialised after M1 because it edits the panel markup that M1 creates. M3 is serialised after M2 because it restyles the same panel and gates the modal wiring. Running them in parallel would put three lanes in one small region of CSS and JS, and at this app's volume the wait costs nothing.

| Lane | Owns | Never touches | Acceptance | Verify |
|---|---|---|---|---|
| **A** `claude/bg-android` | `index.html` `<head>` meta tags, `:63-82` (html/body rules) and print-block line `:775` only. A new `describe("page background covers every viewport")` block appended at the END of `tests/e2e.test.js`, plus one sandbox test in `tests/app.test.js` for the meta tags. Its own FLOORS rows (+ its tests). Mutants `ab_*` (new) | Header/menu markup, CSS below `:81`, JS, any budget table, `f_overscroll_x_dropped.patch` hunk text (context-refresh only, if staled) | (1) `theme-color` meta equals `--table` `#1a1815`. (2) Computed `color-scheme` is `dark`, and a `color-scheme` meta is present. (3) `html` computed `background-color` is `rgb(26, 24, 21)`. (4) The §2 matrix: no edge pixel is white or off-palette, with the sheet open too. The body-image-removed row fails at base and passes on the lane head. (4b) Under print media, `html` computes `background-color` white. (5) CHROME_BUDGET, LANDSCAPE_BUDGET and "portrait is byte-identical" pass unchanged. (6) Mutants `ab_theme_color_dropped`, `ab_root_bg_dropped` and `ab_color_scheme_dropped` are killed | `CHROME_BIN=... node --test --test-name-pattern="page background" tests/e2e.test.js` then CI 5/5 at head |
| **M1** `claude/menu-shell` | `index.html` header markup (`:790-792`), header/h1/`.modebar`/`.mode` CSS (`:111-300`, keeping exactly ONE `@media` block containing `clip-path`), `.prints` CSS (`:340-355`), `headerHTML` (`:6332-6354`), the `printCtrls` tab-order block (`:6412-6424`), mode wiring (`:7535-7560`), the new panel markup/CSS/JS. Tests in `tests/e2e.test.js` and `tests/app.test.js` that reference `.prints`, `#modeA`/`#modeB`, `.modebar` or the tables below. CHROME_BUDGET and LANDSCAPE_BUDGET, tightened onto the new measurements. Mutants listed below. Its own FLOORS rows | `<head>`, `:63-82`, print-block `:775`, `#deck-add`/strip code (M2), `src/engine/*`, generated regions, `data/`, `tests/mutation_check.sh` | (1) No card face contains a `button` or `select` (`#front`/`#back`, every deck, both modes). (2) The trigger is 44x44 with `aria-expanded` and `aria-controls`; open/close toggles `aria-expanded`; Escape and a scrim tap close the panel and return focus to the trigger; Tab never leaves the open panel. (3) Mode buttons in the panel keep `aria-pressed`, `setMode` runs, and the mode survives a reload. (4) FULL DECK and PRINT-ONLY from the panel produce the PDF on every built-in and on a generated deck. The paper choice survives a reload. The re-enable-after-error path is intact. (5) CHROME_BUDGET: every portrait row's chrome is smaller and its card is at least as wide as before; the table is rewritten to the new measurements, with the commit message saying what the card gained. (6) LANDSCAPE_BUDGET: header ≤ 44 and card ≥ its old floor. The strip scrolls-not-clips test passes, and the overflow sign assertion is updated if the strip now fits. (7) "portrait is byte-identical" still finds exactly 1 landscape block and passes. (8) At 320x568 the h1 is one line with no overflow, or it wraps into the grid cell with no overlap of the 44px trigger (measure both rects). (9) The panel fits 320x568 and 844x390 with no clipping; it scrolls internally if needed. (10) The printed card is still free of controls (`tests/app.test.js:3710`). (11) The panel is not a descendant of `header`/`main`/`footer`. With the panel open, ArrowRight and Enter leave the card's index and flip state unchanged. (12) Every panel control, the paper select included, passes the 44px target test. (13) `e_a11y_both_faces_exposed` is re-targeted, not retired: the hidden face stays `aria-hidden` (`:6398-6410`), and that behaviour survives the move. (14) The PR body reports the chrome saving and the card growth as two separate numbers per row. Commit order: panel and print first, then mode | Single e2e tests by name (`--test-name-pattern`), `node --test tests/app.test.js`, then CI 5/5 at head |
| **M2** `claude/menu-add-scale` | `+ ADD`: markup in `#decks` (`:790`), `.chip.add` CSS (`:138-190`), the strip/add JS, the panel's "Scales" group, focus-return after the scale sheet, and every test/mutant aimed at `#deck-add` as a strip chip. Its own FLOORS rows | Everything M1 owns except the panel's Scales group slot, `<head>`, `:63-82`, `:775` | (1) `#decks` contains only deck chips. (2) The "+ ADD A SCALE" panel item opens the scale sheet in create state (`openScaleSheet`), Cancelling the sheet (Back, Escape, popstate) returns focus to the settings trigger. Generate, Save and Delete leave focus on the selected deck chip, as today (e2e `:5583`). (3) "the owner's journey at 380px" is rewritten to start from the trigger and passes. (4) The strip still scrolls rather than clips at both ends, and the end-chip auto margins still centre a fitting strip. (5) CHROME_BUDGET/LANDSCAPE_BUDGET unchanged or tightened | Same as M1 |
| **M3** `claude/menu-sidebar` | One new `@media (min-width:1024px) and (min-height:700px)` block for the panel, trigger and scrim. The panel's modal gating: role, aria-modal, inert, stops and the keydown guard apply only below the breakpoint. A `matchMedia` change listener. A new `describe("desktop sidebar")` block in `tests/e2e.test.js`. Its own FLOORS rows. Mutants `ms_*` | Panel markup and groups (M1/M2), `<head>`, `:63-82`, `:775`, the `(max-height:520px)` blocks (the single `clip-path` block stays single), `--card-w`, budget tables except to add desktop rows | (1) At 1280x800 and 1024x768 the sidebar is visible, the trigger and scrim are `display:none`, and the panel has no `role=dialog` or `aria-modal`. `header`, `main` and `footer` are not inert. (2) The card rect at 1280x800 and 1024x768 equals the base measurement (width and height, ±0.5px). (3) ArrowRight steps the card and Enter flips it, with focus on the card. (4) FULL DECK and PRINT-ONLY in the sidebar produce the PDF. (5) At 1023x800, 844x390 and 390x844 the M1 hamburger behaviour is unchanged, and all M1 tests pass untouched. (6) With the panel open at 900x800, resizing to 1280x800 leaves no inert element, no scrim, and focus on a live element. (7) The sidebar never overlaps the card or the footer controls (rects are disjoint) at 1024x700 and 1920x1080. (8) Every M1 44px target test row passes in the sidebar too. (9) Mutants `ms_breakpoint_dropped` (sidebar never shows), `ms_modal_not_gated` (sidebar is aria-modal/inert) and `ms_resize_leaves_inert` are killed | Same as M1 |

**Mutants whose target moves.** Grep the removed line, not the hunk header (memory: mutant-hunk-headers-are-not-line-refs). Each owning lane gets explicit grants:
- context-only refresh where the mutation lines survive byte-identical;
- re-target where the tested behaviour survives on new lines;
- retire (delete, and name it in the PR body) only where the behaviour itself is removed.

| Lane | Mutants (confirm each with `git apply --check` on the lane head) | Expected |
|---|---|---|
| A | `f_overscroll_x_dropped` | refresh |
| M1 | `e_a11y_mode_pressed_frozen`, `e_target_mode_shuffle_short`, `e_target_chrome_eats_card`, `e_a11y_both_faces_exposed`, `p_tab_order_selector_narrowed_to_links`, `p_paper_picker_forgets_its_state`, `qd_j_paper_not_string`, `qd_j_paper_inherited_key`, `e_landscape_card_overflows_main`, `e_shuffle_active_dims_with_opacity` | refresh or re-target. `p_tab_order_selector_narrowed_to_links` retires if the `printCtrls` tab-order block is deleted. `e_a11y_both_faces_exposed` is **re-targeted, never retired**, because the aria-hidden face logic stays (eng review C1) |
| M3 | none expected. It moves no tested line. New mutants `ms_*` | new |
| M2 | `e_add_chip_appended_last`, `e_chip_no_press_state`, `e_deck_order`, `e_edit_focus_to_add`, `e_add_chip_overlaps_strip` | re-target to the panel item, or retire where the chip behaviour is gone |

The broad grep in the prompt also matched `p_print_*`, `h_*`, `u_*` and `s_*` patches. Those match on the word "prints" in comments or in `mutation_check.sh`. A lane touches them only if `git apply --check` fails on its head.

## §4 Order and dependencies

1. Wave 1: A and M1 in parallel. No shared lines.
2. M2 spawns when M1 merges. It builds on M1's panel.
3. M3 spawns when M2 merges, so the sidebar ships with the Scales group already in it.
4. Owner-device gate (§7) after A merges. It does not block M1-M3.

## §5 Merge gates

quality-eval §6 unchanged: CI 5/5 at a verified head SHA, then a fresh swarm-reviewer PASS or PASS_WITH_NITS at that SHA, then `gh pr merge --merge --match-head-commit`. Deltas:
- **FLOORS rebase.** The second of A/M1 to merge rebases onto the first and sums the e2e and app rows. That is a one-number conflict. Resolve by adding, never by taking one side.
- **Budget tables.** Only M1 and M2 may edit CHROME_BUDGET or LANDSCAPE_BUDGET, and only to tighten. The reviewer checks every changed number moved the right way.
- **380px.** Each menu lane attaches the measured header, card and panel rects at 380x800 and 320x568 to its PR body.

## §6 Owner decisions (auto-decided under AFK; overridable)

| # | Decision | Default taken | Why |
|---|---|---|---|
| O1 | Move the mode toggle into the menu | Yes | The owner named it. It frees about 41px net of portrait chrome. The card grows only where height binds (C5) |
| O2 | Move + ADD into the menu | Yes (M2, separable) | The owner named it. M2 is a separate PR, so declining it costs nothing already merged |
| O3 | Menu form | Anchored modal panel with scrim, reusing the sheet's containment | One dialog pattern in the app. Unlike a popover, a scrim tap has an obvious meaning |
| O4 | Android back closes the menu | No (N17) | It would add a second history-routed surface. DEFER until reported |
| O5 | Mode visibility after the toggle leaves the header | The card face already shows which side leads | No persistent mode badge. Adding one would spend the chrome that O1 frees |
| O6 | Desktop: hamburger or sidebar | Sidebar at >=1024x700 (M3) | The owner left it open. The card is height- or cap-bound there, so the sidebar costs it nothing, and printing, the main desktop task, becomes one click. It is separable: declining M3 leaves the hamburger everywhere |

## §7 Owner-device gate

After lane A merges, on the Android phone that showed the bar:
1. Open the site in portrait. Check the status bar, the URL bar and the area under the gesture bar are dark.
2. Scroll so the URL bar collapses. Check that no light band appears at the bottom.
3. Rotate to landscape and check the same.
4. Open "+ ADD" or the settings panel and check the same.

If the bar persists, report the browser (Chrome, Samsung Internet, Firefox) and whether it sits in the system bar or inside the page. Anything the page paints is a new lane; system-bar colour under Firefox is out of the page's control.

## Eng review (/plan-eng-review, 2026-09-28, at `879499d`)

Mode: FULL_REVIEW. AFK is armed, so every decision was auto-picked on its recommended option and is recorded below. The amendments are already folded into §2, §3 and §6 above.

**Scope challenge.** The plan touches 3 files: `index.html`, `tests/e2e.test.js` and `tests/app.test.js`, plus `tests/suite_health.py` FLOORS and the mutant patches. That is well under the 8-file complexity gate. It adds no new abstraction, because the panel copies the sheet's inert and stops pattern. Minimum viable version: lane A alone fixes the owner's bug report. M1 and M2 are the owner's separate design ask, and each merges on its own.

**Architecture.**
- F4 [P1, conf 9]: the plan cited `:7551` as the sheet's containment, which is wrong. The real containment is `inert` on header, main and footer (`:6546`/`:7148`) plus a Tab stops list (`:7489`). So a panel nested in `<header>` would go inert under the sheet. **Fixed:** the panel is a body-level sibling, and acceptance (11) checks that.
- F1 [P2, conf 6]: a dark `html` background can print through `*{print-color-adjust:exact}`. **Fixed:** A takes `:775`, and acceptance (4b) checks it.

**Code quality.**
- F6 [P3]: M1 is large for one lane. **Kept as one lane**, since splitting it would put the header markup in two lanes. Commit order is panel and print first, then mode.
- F5 [P3, conf 5]: at 320px the h1 may wrap in the `44px 1fr 44px` grid. Already covered by acceptance (8).

**Tests.**
- F3 [P2, conf 8]: the edge-pixel test passes at base, so it cannot kill `ab_root_bg_dropped`. **Fixed:** added a body-image-removed row that fails at base.
- F2 [P2, conf 8]: the oversized-viewport case cannot show an unpainted band under CDP. **Fixed:** that case is now a device gate (§7 step 2).

```
CODE PATH                                   TEST (after amendments)                          STATUS
<meta theme-color / color-scheme>           app.test sandbox: meta present, == --table       NEW  (A1, A2)
:root color-scheme:dark                     e2e computed colorScheme == dark                 NEW  (A2)
html{background-color}                      e2e edge pixels, body image removed row          NEW  (A3; kills ab_root_bg_dropped)
print block html,body{background:#fff}      e2e emulateMediaType(print) computed bg          NEW  (F1)
URL-bar collapse band                       -- CDP cannot --                                 DEVICE GATE (§7)
gesture bar / system bars                   -- CDP cannot --                                 DEVICE GATE (§7)
settings trigger aria-expanded/controls     e2e open/close, Escape, scrim, focus return      NEW  (M1 2)
panel Tab containment + background inert    e2e Tab cycle; panel not in header/main/footer   NEW  (M1 2, 11)
keydown guard while open                    e2e ArrowRight/Enter: idx + flip unchanged       NEW  (C3)
panel 44px targets incl. paper select       e2e :2430 target test extended                   EXTEND (C4)
mode buttons aria-pressed + persistence     existing mode tests, re-anchored                 KEEP (e_a11y_mode_pressed_frozen)
print from panel, all decks + generated     existing downloadDeckPDF tests, re-anchored      KEEP
hidden face aria-hidden                     both-faces a11y test :5699                       KEEP (re-target, C1)
card face has no button/select              e2e every deck, both modes                       NEW  (M1 1)
CHROME_BUDGET / LANDSCAPE_BUDGET            tables tightened, one-sided                      TIGHTEN (M1 5, 6)
+ ADD from panel -> sheet create state      owner journey at 380px, rewritten                REWRITE (M2 3)
sheet cancel -> focus trigger               e2e Back/Escape/popstate                         NEW  (M2 2)
Generate/Save/Delete -> focus chip          e2e :5583 unchanged                              KEEP (C2)
```

**Performance.** No issues found. The change is static CSS and meta, plus one panel toggled on demand, with no work per frame.

**Outside voice (codex, completed).** 5 findings, all verified against the code and all accepted:
- C1 [P1]: re-target `e_a11y_both_faces_exposed` instead of retiring it.
- C2 [P1]: the sheet's commit paths keep focus on the chip.
- C3 [P2]: the menu owns the keyboard while open.
- C4 [P2]: menu controls get 44px targets.
- C5 [P2]: the 58px gain was overstated. The net is about 41px, and the card grows only where height binds.

### Decision ledger (auto-decided under AFK)

| # | Finding | Decision | Where |
|---|---|---|---|
| F1 | Dark html bg prints under exact colour | Fix in A (`:775`) | §2 A, lane A (4b) |
| F2 | Oversized viewport not a real band under CDP | Device gate | §2 A4, §7 |
| F3 | Edge test cannot fail at base | Add body-image-removed row | §2 A, lane A (4) |
| F4 | Panel inside header goes inert under the sheet | Body-level sibling | §2 B, M1 (11) |
| F5 | h1 wrap at 320px | Covered by M1 (8) | - |
| F6 | M1 size | One lane, ordered commits | M1 (14) |
| C1 | Retiring the a11y mutant | Re-target | §3 mutants, M1 (13) |
| C2 | Focus after Generate/Save/Delete | Stays on chip | §2 B, M2 (2) |
| C3 | Arrows/Enter under open menu | Guard like `sheetOpen` | §2 B, M1 (11) |
| C4 | Menu targets < 44px | 44px, extend test | §2 B, M1 (12) |
| C5 | Card gain overstated | Report chrome and card separately | §2 B, §6 O1, M1 (14) |

Approval readiness: **PASS**. No P1 is open. Every finding has a disposition and an acceptance line.

### NOT in scope
- PWA manifest (N19).
- History entry for the menu, and Android back (N17/O4).
- A persistent mode badge (O5).
- Moving chips, Shuffle, prev/next or the counter (N18).
- The legacy `openPrintSheet` path (`:6179`), which is unreferenced; only the F1 hardening touches its surface.
- `TODOS.md`: no overlapping item (grep for android, theme-color, menu and settings: 0 hits).

### What already exists
- The sheet's inert-background + stops-list containment (`:7148`, `:7489`). The panel copies this pattern.
- The `sheetOpen` keydown guard (`:7547`).
- `downloadDeckPDF` / `setPrintPaper`, whose `.prints` anchor at `:6304` is kept.
- The `.mode` styling and `aria-pressed`.
- The 44px target test (`:2430`).
- The one-sided budget tables.

### Failure modes
| Failure | Test catches? | Error handling? | Visible? |
|---|---|---|---|
| Panel nested in header, inert under sheet | Yes (M1 11) | n/a | Would be silent: dead menu after sheet |
| Arrow key steps card behind open menu | Yes (C3) | n/a | Visible, confusing |
| Cmd+P prints dark margins | Yes (4b) | n/a | Visible on paper |
| URL-bar band still light on device | No (CDP) | n/a | Device gate §7 |
| Firefox Android ignores theme-color | No | n/a | Out of page control, §7 note |

No failure is silent while also going untested. The panel-in-header row would be silent in use, but acceptance (11) tests it.

### Worktree parallelization
| Lane | Modules | Depends on |
|---|---|---|
| A | `<head>`, `:63-82`, `:775`, e2e tail block | - |
| M1 | header CSS/markup, `headerHTML`, keydown, panel | - |
| M2 | `#decks`, `.chip.add`, panel Scales slot | M1 |
| M3 | panel `@media` block, modal gating + `matchMedia` hook | M2 |

Wave 1 runs A and M1 in parallel on disjoint lines. The only conflict is the FLOORS number, which is summed. M2 follows M1's merge.

### Implementation tasks
1. A: tests first (the meta sandbox test, the edge-pixel matrix with the body-image-removed row, the print bg) -> meta tags + `color-scheme` + html bg + `:775` -> `ab_*` mutants -> PR.
2. M1a: tests (no controls on the face, panel a11y, keyboard guard, 44px, not in header) -> panel + print move -> commit.
3. M1b: mode move -> budget tables tightened -> mutant re-anchors -> PR.
4. M2: tests (the owner's journey from the trigger, focus split C2) -> `+ ADD` into the panel -> mutants -> PR.
5. M3: tests (sidebar visible, trigger hidden, not modal, arrows step the card, card rect unchanged, crossing the breakpoint while open restores inert) -> `@media` block + gating -> `ms_*` mutants -> PR.
6. Owner: the §7 device gate after A merges. Also check the desktop sidebar by eye at 1280x800.

### Completion summary
- Step 0 Scope: accepted as is (3 files + tests).
- Architecture: 2 issues (F4 P1, F1 P2), both fixed in the plan.
- Code quality: 2 issues (F5, F6), no change needed.
- Tests: diagram produced, 2 gaps fixed (F2, F3).
- Performance: 0 issues.
- NOT in scope: written.
- What already exists: written.
- TODOS.md: 0 new items proposed.
- Failure modes: 0 critical gaps.
- Outside voice: codex ran, 5 findings, all accepted.
- Parallelization: 4 lanes, 2 in parallel, then 2 serial.
- Lake score: 11/11 took the complete option.

### Addendum: M3 desktop sidebar (owner follow-up, same day)

The owner left desktop open ("either way works"). The verdict and its reasons are in §2 B and O6. This delta was reviewed on its own:
- **Scope.** +1 lane. No new file, no new component, and no new visual token. It adds one CSS block and gates M1's existing modal wiring.
- **Architecture risk.** One panel has two roles. The failure to guard against is modal state leaking into the static presentation, which would inert the whole app on desktop, or the reverse. Acceptance (1), (5) and (6) pin both directions, and the three `ms_*` mutants each target one of them.
- **Budget.** The card must not move at desktop sizes. Acceptance (2) asserts it directly, because CHROME_BUDGET has no desktop row to lean on.
- **Order.** Serialised after M2, so no three-way conflict in the panel code.
- **Unresolved.** Nothing new. O6 is auto-decided under AFK and overridable. Declining M3 costs nothing already merged.

## Cycle state (/swarm, main agent is the sole writer)

```
Cycle: 1 CLOSED 2026-09-29 (all lanes merged; worktrees and lane/review branches removed after `gh pr list --state merged` + ancestry checks). Wave 3 was M3b, a fresh follow-up lane (AUTO-DECISION: Q18 was a user-visible desktop keyboard regression from #157 and M3's attempts were exhausted)   Merged this batch: eaef663 (#152), 9e9f42e (#154), 3dd104d (#153), ed38ff5 (#155), 7a64a69 (#156), 7d1b733 (#157), d5af67b (#158)
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A  | lane-A (bg) | agent worktree | claude/bg-android     | #152 | 7c84256 | CI 5/5 | PASS_WITH_NITS | 1 (CI stale-mutant bounce, self-fixed) | eaef663 | - | worktree locked by harness; clean at close |
| M1 | lane-M1 (menu) | agent worktree | claude/menu-shell     | #153 | 2b8f1c2 | 2b8f1c2 CI 5/5 | PASS_WITH_NITS | 1 | 3dd104d | - | locked |
| A2 | lane-A2 (bg-nits) | agent worktree | claude/bg-nits        | #154 | 888cb90 | 888cb90 CI 5/5 | PASS_WITH_NITS | 1 | 9e9f42e | - | locked |
| M2 | lane-M2 (add-scale) | agent worktree | claude/menu-add-scale | #155 | 047d2f3 | 047d2f3 CI 5/5 | PASS_WITH_NITS | 1 CI bounce (self-fixed) | ed38ff5 | - | locked |
| M3 | lane-M3 (sidebar) | agent worktree | claude/menu-sidebar | #157 | c113ab0 | c113ab0 CI 5/5 (1d63be5 was red: N4 order bug) | PASS_WITH_NITS | 2 | 7d1b733 | - | locked |
| M3b | lane-M3b (sidebar nits) | agent worktree | claude/menu-sidebar-nits | #158 | f4f982f | f4f982f CI 5/5 | PASS_WITH_NITS | 1 | d5af67b | - | locked |
| M2b | lane-M2b (test gaps) | agent worktree | claude/menu-test-gaps | #156 | 6b1c656 | 6b1c656 CI 5/5 | PASS_WITH_NITS | 1 | 7a64a69 | - | locked |
```

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #152 | A | PASS_WITH_NITS @7c84256 | Q1, Q2 below; import line e2e:15 touched (benign) | merged eaef663 |
| #154 | A2 | PASS_WITH_NITS @888cb90 | Q4 (comment cites 12.08; tripping pixel is 10.44), Q5 (tol 5 margin 2.0 vs head) | merged 9e9f42e |
| #153 | M1 | PASS_WITH_NITS @2b8f1c2 | crit 14 unmet in PR body (landscape numbers misattributed, no per-row card growth, no §5 rects): integrator corrected the PR body before merge, code unchanged. Tab trap and background inert untested (2 hand mutants survived); keys test presses no Enter/Space; 320 h1/trigger overlap untested -> folded into M2 NEXT. Q6-Q9 below | merged 3dd104d |
| #155 | M2 | PASS_WITH_NITS @047d2f3 | PR body overclaims (#decks already inert at base; residual-state test is e2e; two mutant dispositions; measurements base = head): integrator appended corrections before merge, code unchanged. Test gaps -> lane M2b (Q10-Q14) | merged ed38ff5 |
| #156 | M2b | PASS_WITH_NITS @07b6a50 | N1: Enter/Space half still vacuous (focus on body; inert-drop mutant survives); N2: m2b_panel_key_guard_dropped duplicates e_menu_keys_leak_to_card; N3: e_edit_focus_to_add comment inaccurate. AUTO-DECISION: held merge and bounced N1-N3 to the lane, because N1 was this lane's own NEXT item 2 (precedent eb2a807); counts as attempt 1 | fix round |
| #156 | M2b (re-review) | PASS_WITH_NITS @6b1c656 | inert mutant killed; Enter press is an independent 2nd check. Nits: Q16 (Tab-trap test derives stops from panelStops, so a dropped stop survives), PR body listed the deleted mutant (integrator appended corrections before merge), 'row 7621' line ref in comment, window.panelStops dependency (relayed to M3) | merged 7a64a69 |
| #157 | M3 | FAIL @90903b6 (CI green) | F1 sidebar covers right end of #decks at 1024x768 (selected chip unreachable, tap hits #modeA); F2 desktop focus falls to BODY after scale sheet closes (opener is display:none trigger); F3 sidebar z41 over #scale-sheet z30. Nits: N1 JS/CSS breakpoint drift untested (1100px mutant survived), N2 unreachable desktopMQ return in openPanel, N3 arrows on sidebar select also step card, N4 resize test accepts BODY focus. Bounced F1-F3 + N1/N3/N4 to lane (attempt 2 of 2) | fix round |
| #157 | M3 (re-review) | PASS_WITH_NITS @c113ab0 (CI run 36556708027 success) | F1-F3, N1, N3 fixed with killed mutants; N4 code fixed. Nits -> Q18-Q24. /review ran partly (preamble refused by worktree guard); checklist done by hand | merged 7d1b733 |
| #158 | M3b | PASS_WITH_NITS @f4f982f (CI run 36561446199 success) | Q18-Q20 fixed, 3 m3b_* mutants killed; shadow test judged non-tautological. Nits -> Q25, Q26 | merged d5af67b |

## Queue

| # | Item | Status |
|---|---|---|
| Q1 | `tests/e2e.test.js` `edgeCheck` uses one tolerance (9) for two jobs; matrix rows sit 0.63 from it. Split: ~20 for matrix/sheet rows, ~5 for the gradient-removed row (or point `ab_root_bg_dropped`'s suite at the computed-style test). Risk: Chrome gradient/dither change reddens main, or a canvas-colour change lets the mutant survive | RESOLVED #154 |
| Q2 | `tests/mutants/p_print_page_fill_dropped.patch` `+` line lost `background:#fff`, so the mutant now changes two things (still killed via height) | RESOLVED #154 |
| Q3 | Owner-device gate §7 on the Android phone (A merged at eaef663) | OPEN |
| Q4 | `tests/e2e.test.js` edgeCheck comment cites 12.08 as the mutant measurement; the pixel that trips the assert is rgb(18,18,18), 10.44 from TABLE. Comment-only; no regression it would miss. DROP-level unless the block is touched again | OPEN |
| Q6 | Stale comments after M1: card keydown comment (~index.html:7636) says .prints lives in the card; landscape @media comment mentions the mode bar and 241px; CHROME_BUDGET comment in tests/e2e.test.js repeats the landscape misattribution (251.67->158.67, +67.3% belongs to an earlier lane) | OPEN |
| Q7 | `void noPrints;` in `headerHTML` is dead; drop the parameter | OPEN |
| Q8 | Re-targeted `e_landscape_title_crowds_strip` (`h1{width:300px;font-size:14px}`) no longer models a visible landscape h1 crowding the strip | OPEN |
| Q9 | Opening the panel leaves focus on the trigger (first Tab stop), not inside the dialog. Acceptable; unusual for aria-modal | OPEN |
| Q5 | Tight tol 5 sits 2.0 above head (3.0) and 5.44 below mutant (10.44); ~6.5 centres it. Matters only if screenshot colour error grows past 2 | OPEN |
| Q10 | Overflowing deck strip untested: `.decks{justify-content:center}` survives both strip tests (strands first chips off-screen) | RESOLVED #156 |
| Q11 | Enter/Space panel-keys test cannot fail (Space activates the focused trigger; #card is in inert main) | RESOLVED #156 |
| Q12 | Tab-trap test: Shift+Tab half does not assert landing on the last stop | RESOLVED #156 |
| Q13 | `#deck-add` lost `aria-haspopup="dialog"` (it opens the scale sheet) | RESOLVED #156 |
| Q14 | Stale comments in `e_chip_no_press_state.patch` and `e_edit_focus_to_add.patch:3-4` | RESOLVED #156 |
| Q15 | closePanel-before-openScaleSheet ordering pinned only by the older "background ... hidden from assistive tech" test. No regression it would miss today | OPEN |
| Q16 | Tab-trap test takes its stop list from `panelStops()`, so narrowing it (e.g. dropping `.prints select`) survives; compare against a DOM-derived focusable list in the panel. Predates #156; shipped code correct | OPEN |
| Q17 | e2e comment ~:1043 cites "row 7621" (raw index.html line) for the card keydown listener; name the listener instead | OPEN |
| Q18 | Desktop: the N3 keydown guard returns for ANY target inside `#settings-panel` (index.html ~:7825), so after clicking NOTES->NAME, a PDF button, or cancelling the add sheet, ArrowLeft/Right no longer step the card until focus moves. Narrow to SELECT/INPUT/TEXTAREA. User-visible | RESOLVED #158 |
| Q19 | Desktop header cap `calc(100vw - 480px - 2*var(--sp-3))` (index.html ~:264) drops the old 900px ceiling: at 1920 the header spans 1400px. Use `min(900px, calc(...))` | RESOLVED #158 |
| Q20 | Resize test does not kill a revert of the round-2 N4 fix (dropping the `display !== "none"` check in `stillLive` survives locally; probe shows it strands focus on BODY). No committed mutant covers the line | RESOLVED #158 |
| Q21 | Resize down (1280 -> 900) with focus in the sidebar drops focus to BODY; the desktopMQ change handler only handles `e.matches` | OPEN |
| Q22 | Sheet opened below the breakpoint, then resized to desktop, then Escape: focus lands on BODY (stale opener, F2 class via resize) | OPEN |
| Q23 | `ms_modal_not_gated` is misnamed (it restores static role/aria-modal markup); `openPanel`'s `if (desktopMQ.matches) return;` is unreachable at desktop and unmutated (likely equivalent) | OPEN |
| Q24 | #157 bookkeeping: sandbox.js matchMedia stub and `selectDeck` rehome edit were outside the listed ownership (both necessary); FLOORS row is 133 -> 146, not 141 -> 146 as briefed | CLOSED (recorded) |
| Q25 | e2e ~:6774-6784: the `st.active.id === "card"` assertion added to the existing resize test claims to pin stillLive's display check but kills that mutant only intermittently; the shadow test is the reliable killer. Reword the comment | OPEN |
| Q26 | Shadow test's getter fallback `return document.body` is unreachable after `delete document.activeElement`; dead code | OPEN |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES (folded in) | 5 findings, all accepted |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (plan amended; M3 addendum) | 11 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | - | - |

- **VERDICT:** ENG CLEARED. The plan is ready for /swarm once the owner says go.
- **Outside voice:** codex, completed.

NO UNRESOLVED DECISIONS
