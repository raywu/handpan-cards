# Scale / Layout tabs for the Add/Edit sheet (2026-10-19)

Subplan. Code reference: `origin/dev` (d375f8a, includes lane P). Lane base: lane P's head branch `claude/dual-input-ux-p` (PR #408), never `origin/dev`, which carries `claude/dev-overlay` (`_headers`, commits 619201e / c0cc1fc) - see section 6 (review fold E1).
Sources, cited by section or anchor: repo `CLAUDE.md`; `docs/plans/2026-10-19-dual-input-sheet-ux.md`
(on `origin/claude/dual-input-ux-plan`, "ux plan"), sections 1-3, 3.4 (lane L) and its "Lane L
subplan record" Q1-Q10, lane P, sections 6-7; `docs/plans/2026-10-18-dual-input.md` (on
`origin/claude/dual-input-plan`, "dual-input plan"), sections 2.1-2.5, A1-A22 and E1-E9; `origin/dev`
`index.html`, `src/engine/core.js`, `src/engine/importer.js`, `tools/sandbox.js`.

Owner input O1-O4 (2026-10-19, phone check on DEV) and amendments A2-A5 are binding. **O1 was amended by the owner later on 2026-10-19** (verbatim: "Bottom notes should start in octave below ding but can go higher than the ding. This is an amendment from previous interview."); the amended O1 replaces A1's right-to-left rule. Owner answers of 2026-10-19: Q1 "I prefer a single rule for both add/edit and decode (everywhere) but let's evaluate backwards compatibility"; Q2 tabs beside the pan in the wide landscape block; Q3 closed by the amendment. **Second amendment, 2026-10-19 (owner, verbatim):** "The scale line is definitive if it's in a linear order. It's only when the bottom notes are input from the note by note text field where we need to infer." Asked about legacy v1-v3 links, the owner chose "One engine, new rule": the legacy `|` bottom list is also an inference path and uses the same function as the fields. So the 4.1 rule applies only to the BOTTOM NOTES field and the legacy bottom list; the v4+ scale line (`parseSeed`) is unchanged, post-ding brackets included. This supersedes the re-review F1 fold at 8c8ea93.

## 1. Goal and non-goals

**Goal (one testable sentence).** On DEV, the Add/Edit sheet shows two tabs, Scale then Layout,
with full-width note fields, an OR rule between the fields and the scale line, a Layout tab whose
pan is wider than lane P's small pan and never smaller than lane P's Adjust pan at every viewport in section 3.6, a footer that collapses to
the lane L lip and carries NEXT / GENERATE CARDS / SAVE CHANGES by flow and tab, and unoctaved bottom
notes that the sheet places below the ding: D3 with "g a b c" gives G2 A2 B2 C3.

**Non-goals.**
- No deck data or diagram geometry change. `data/decks.json`, the DECKS line, `layout.solve` and every
  built-in's drawing stay byte-identical (CLAUDE.md "Hard constraints", "Instrument layouts").
- No change to SAVE or DELETE semantics, `HPE.share`, `formatSeed`, `parseSeed` or `scaleInfer`: the
  scale line is definitive (owner, 2026-10-19). The only decode change is O1 in `parseLegacySeed`'s `|`
  bottom list (v1-v3, owner Q4 (a)), measured in section 4.3.
- No engine change beyond O1: one shared bottom-inference function in `core.js`, used by
  `parseLegacySeed` (in place of `nearestToDing` + `nextAbove` for bottoms) and by `importer.composeBottoms`.
- `#import-row` stays `hidden`; the memory rule "Import hidden until DEV-proven" stands.
- Nothing goes to `main` except this plan PR (held) and, later, the lanes' main PRs after the owner's
  explicit go.
- No new fonts or colours, no new external asset, no `<script src>` (CLAUDE.md "Single-file app").
- No change to the chord card, the deck strip, the settings panel or About.

## 2. Supersession table

"P" is lane P on dev (ux plan, lane P). "L" is lane L (ux plan 3.4 and the Lane L subplan record).
"DI" is the dual-input plan.

| # | Source rule | Status | New rule |
|---|---|---|---|
| S1 | P: a small pan (`#scale-sheet:not(.adjusting) #scale-preview{width:clamp(88px, 30cqw, 160px)}`) sits in `#scale-pancol` beside `.scalecol` in the `.scalestage` grid | **Replaced** | The Scale tab draws no pan. `.scalestage` becomes one column, and the fields take the full content width. |
| S2 | P: tapping the pan or ADJUST LAYOUT (`#scale-layout-toggle`) calls `showAdjust()`, which pushes `{scalePage:true, adjust:true}` and calls `enterAdjust()` (full-screen Adjust with `#scale-adjust-head` and BACK `#scale-adjust-back`) | **Replaced** | No Adjust overlay. The Layout tab replaces it. `showAdjust`, `enterAdjust`, `hideAdjust`, `closeAdjust`, `pendingAdjustPop`, `closeAfterAdjustPop`, the `adjust` history-state branch of the popstate listener, the `adjusting` class, and the `#scale-adjust-head` / `#scale-adjust-back` / `#scale-adjust-title` markup are removed. `ELEMENT_IDS` drops the three adjust ids. |
| S3 | P: LARGE pan `clamp(160px, min(100cqw, calc(100cqh - var(--adj-reserve))), 480px)` with `--adj-reserve:232px` (72px in the wide container block) | **Kept, re-keyed** | The same clamp sizes the pan on the Layout tab. EVERY `#scale-sheet.adjusting` selector on dev is re-keyed to `#scale-sheet[data-tab="layout"]` or deleted: the preview clamp, the landscape `@media (orientation:landscape) and (max-height:500px)` `.sheetsurf{max-width:none}` rule, and the whole `@container surf (min-width:600px) and (min-aspect-ratio:1/1)` block (`--adj-reserve:72px`, the two-column `.sheetbody` grid, `#scale-pancol` placement re-targeted to `#scale-plate-band`, the drawer-status width rule). The `display:none` list that hid the Scale controls under `.adjusting` is deleted (tabpanel `hidden` does that job). Acceptance: `grep -c adjusting index.html` is 0. `--adj-reserve` keeps P's values, 232px and 72px in the wide block, so the Layout pan equals P's Adjust pan (section 3.6). `#scale-tabs` takes `grid-column:2; grid-row:1` in that block (3.1). |
| S4 | P D11 (revised): on entering Adjust, focus goes to `#scale-adjust-title` | **Replaced** | On a tab switch, focus goes to the tab that was activated (section 3.3). On NEXT, focus goes to `#scale-tab-layout`. |
| S5 | P: the drawer (`#scale-drawer`) opens only inside Adjust; `openDrawer()` returns early if `!boxOk` | **Modified** | The drawer controls live permanently in the Layout panel and are never `hidden`. While the scale is empty or invalid they are `disabled` (section 3.5). `#scale-layout-toggle` is removed, and `drawerOpen` reads "Layout tab selected and `boxOk`". |
| S6 | P: ADJUST LAYOUT row with hint "Type a scale to adjust its layout." (`#scale-layout-hint`) | **Modified** | `#scale-layout-hint` moves to the top of the Layout panel. It shows the same sentence while the scale is empty or invalid, and is hidden while the scale is valid. |
| S7 | L 3.4: lip markup `#scale-foot > #scale-footclip > #scale-footslide` (`#scale-generate`, `#scale-delete-row`) plus `#scale-lip` | **Modified** | Same markup. `#scale-footslide` also holds `#scale-next`. The lip's aria-label names the primary currently shown: "Show NEXT", "Show GENERATE CARDS" or "Show SAVE CHANGES". |
| S8 | L 3.4 motion and geometry: 4px grabber row + 1px #332c22 hairline, 36x4 #a79d8b pill, 25px invisible tap zone, 180ms `cubic-bezier(.3,0,.2,1)` FLIP slide, classes `lipped`/`lipshut`/`lipnow`, reduced motion instant | **Kept** | Unchanged. |
| S9 | L 3.4 scroll rule: 24px hysteresis, 150ms user window, `lipQuietUntil`, end restore at `t >= M-1`, range-change re-baseline, guard `M-t > E`, suspended while `kbup`; swipe 16px; `scroll-padding-bottom` 21px | **Kept, per panel** | The rule reads the scroll position of the selected panel's scroller (`.sheetbody` is one scroller). A tab switch counts as a range change: it re-baselines and restores the full footer (section 3.7). |
| S10 | L Q-record: guidance sits above the lip; an empty slot goes out of flow and a slot with text stays above the lip | **Kept** | Unchanged on both tabs. |
| S11 | L Q-record: Tab-list keyed on `lipshut`; a 220ms timer plus `lipGen`; no rAF or ResizeObserver | **Kept** | The sheet Tab list (section 3.3) adds `#scale-next` where GENERATE sat. |
| S12 | DI 2.4: sheet Tab order `[backBtn, nameBox (Edit), drawerBtn, ding, top, inner, bottom, scaleBox, ...swatches, genBtn, delBtn (Edit)]` | **Replaced** | Per-tab order in section 3.3. `drawerBtn` is gone, and the tab strip has a single roving stop. |
| S13 | DI 2.1: the four fields sit in a column beside the pan | **Modified** | Same four fields, same order (DING, TOP, INNER, BOTTOM), at full width. |
| S14 | DI 2.3 mirror: fields to line through `HPE.importer.compose`; line to fields through `parseSeed`, writing explicit octaves | **Kept, O1 inserted** | Bottom placement in `compose` follows section 4.1 (section 4.2). Line to fields is unchanged: `parseSeed` reads the line as written and the fields show back its explicit octaves. |
| S15 | DI 2.5 / `#scale-guidance` order (`#scale-field-msg`, `#scale-msg`, `#scale-layout-state`) between `.sheetbody` and the footer | **Kept** | One slot, shared by both tabs, outside both panels (section 3.4). `#scale-layout-state` is shown only on the Layout tab. |
| S16 | CLAUDE.md "Scale strings": "square brackets mark a bottom note at its pitch position" | **Kept (owner, 2026-10-19: the scale line is definitive)** | No change to the line grammar, before or after the ding: `(D3) [G] A3` still reads G3. The plan adds one CLAUDE.md sentence after it: "Octaves are inferred only where bottom notes come as a list: the BOTTOM NOTES field and a legacy `|` bottom list. The first unoctaved one takes the octave below the ding and each later one the nearest instance above the one before it (`HPE.core.inferBottoms`)." |
| S17 | `importer.composeBottoms`: the first unoctaved bottom starts at `ding.octave` (one octave down only on a hit at the ding's midi); later ones use `composeAbove` | **Replaced** | Section 4.1's left-to-right rule (first unoctaved note in the octave below the ding). |
| S18 | DI: the Add CTA is GENERATE CARDS and the Edit CTA is SAVE CHANGES, both as `#scale-generate` | **Modified** | Add/Scale shows NEXT (`#scale-next`). Add/Layout shows GENERATE CARDS. Edit shows SAVE CHANGES on both tabs. |
| S19 | ux plan section 7 gates (dev-sync after CI plus reviewer, phone check) | **Kept** | Section 6.4. PR #408 (lane P's main PR) is closed unmerged once lane T's dev PR lands and the owner's phone check passes. |
| S20 | P's phone-check steps (ux plan section 7) | **Replaced** | Section 6.5. |

## 3. Spec: O2, O3, O4

### 3.1 Markup (served order)

```
#scale-sheet[role=dialog][aria-labelledby=scale-title][data-tab=scale|layout]
  .sheetsurf
    .sheethead        #scale-back, h2#scale-title                         (kept)
    .sheetbody                                                            (kept, one scroller)
      #scale-tabs[role=tablist][aria-label="Scale sheet"]                 NEW, first child of .sheetbody
        button#scale-tab-scale.mode[role=tab][aria-controls=scale-panel-scale]   NEW  "Scale"
        button#scale-tab-layout.mode[role=tab][aria-controls=scale-panel-layout] NEW  "Layout"
      #scale-panel-scale[role=tabpanel][aria-labelledby=scale-tab-scale]  NEW
        #scale-name-row > #scale-name                                     (kept)
        .scalestage > .scalecol > #scale-fields[role=group] ...           (kept ids, one column)
        #scale-or[role=separator][aria-label="or"]  <span>OR</span>       NEW
        line .fieldrow: #scale-label-2, #scale-box-wrap > #scale-box,
                        #scale-parse, #scale-refusal, #scale-line-note    (kept)
        .ctlrow > #scale-swatches                                         (kept)
      #scale-panel-layout[role=tabpanel][aria-labelledby=scale-tab-layout][hidden]  NEW
        #scale-layout-hint                                                (moved)
        #scale-plate-band: #scale-preview, #scale-drawer-status           (moved from #scale-pancol)
        #scale-layout-zone > #scale-drawer (never hidden; controls disabled when !boxOk)
          #scale-drawer-hint, #scale-anchor-one/-between, #scale-mirror/-bottom,
          #scale-fine-toggle, #scale-fine (#scale-note-prev/-next, #scale-seat-prev/-next),
          #scale-layout-reset                                             (kept)
    #scale-guidance (#scale-field-msg, #scale-msg, #scale-layout-state)   (kept)
    #scale-foot > #scale-footclip > #scale-footslide                      (lane L ids)
        #scale-next.primary "NEXT"                                        NEW
        #scale-generate "GENERATE CARDS" | "SAVE CHANGES"                 (kept)
        #scale-delete-row (#scale-delete, #scale-del-note)                (kept)
      #scale-lip                                                          (lane L id)
```

- **Tab strip placement (one rule, used by 3.6 and 3.7):** `#scale-tabs` is the first child of `.sheetbody`.
  In portrait it is a full-width row above the panel. In the wide `@container surf (min-width:600px) and
  (min-aspect-ratio:1/1)` block it takes `grid-column:2; grid-row:1`, the RIGHT column beside the plate,
  above the drawer; the plate band is `grid-column:1`.
- **Removed ids:** `#scale-pancol`, `#scale-layout-row`, `#scale-layout-toggle`, `#scale-adjust-head`,
  `#scale-adjust-back`, `#scale-adjust-title`.
- **New ids:** `scale-tabs`, `scale-tab-scale`, `scale-tab-layout`, `scale-panel-scale`,
  `scale-panel-layout`, `scale-or`, `scale-next`.
- **Lane L ids, first built here:** `scale-foot`, `scale-footclip`, `scale-footslide`, `scale-lip`.
- **`tools/sandbox.js` `ELEMENT_IDS`:** add only ids the app looks up: `"scale-tabs", "scale-tab-scale",
  "scale-tab-layout", "scale-panel-scale", "scale-panel-layout", "scale-next", "scale-foot",
  "scale-footslide", "scale-lip"`. `scale-or` and `scale-footclip` are markup-only. Remove `"scale-layout-toggle", "scale-adjust-back",
  "scale-adjust-title", "scale-adjust-head", "scale-pancol", "scale-layout-row"` (only those present on
  dev).

### 3.2 O2: the OR rule

- `#scale-or` is a flex row: a 1px #433b2c line, then `OR`, then another line.
  - #433b2c is the field-border token, already used by the field `input` rule.
  - The word is 600 9.5px Nunito Sans at .13em in #a79d8b, the existing `.sheetlabel` token.
- The block margin is `var(--sp-3)` above and below.
- It is a `role=separator` with `aria-label="or"`. It is not a focus stop.
- It is unmistakable because it is the only full-width rule inside the panel. It sits between
  `#scale-fields` and the line row, which are the only two inputs that can each define the scale.
- It shows on the Scale tab in both flows and every scale state.

### 3.3 O3: tabs, ARIA, focus and CTAs

**ARIA and keyboard (WAI-ARIA tabs, automatic activation)**
- Exactly one tab has `aria-selected="true"` and `tabindex="0"`; the other has `aria-selected="false"`
  and `tabindex="-1"`.
- ArrowLeft and ArrowRight move between the two tabs, wrapping, and activate the tab they land on.
  Home and End go to Scale and Layout.
- The unselected panel carries `hidden`. `#scale-sheet[data-tab]` mirrors the selection for CSS.

**Tabs use the existing `.mode` class**
- Each tab is a 44px-tall half-width `.mode` button. The selected tab uses `.mode.on` (the existing
  selected style), so no new token is needed.
- Labels are "Scale" and "Layout" as the owner wrote them. They are rendered uppercase by `.mode`'s
  existing text-transform, consistent with every other `.mode` control.

**Tab switches and history**
- A tab switch pushes NO history entry and calls no `replaceState`. The sheet's single history entry
  (`{scalePage:true}` at `sheetRoute()`, `#add` or `#edit-<id>`) stays the only one.
- This keeps CLAUDE.md's `pendingPop` / `syncRoute` rules exact: `closeScaleSheet()` →
  `history.back()` → popstate with `pendingPop` → `syncRoute()`. Lane P added a second
  `{adjust:true}` entry, and that entry is retired (S2).

**Back, Escape and popstate (identical on both tabs and in both flows)**
- `#scale-back`, Escape (when no tab-strip-internal action consumes it, and none does) and a browser
  Back popstate each close the sheet through the existing `closeScaleSheet()` / popstate paths.
- Back from Layout does NOT return to Scale. Reasons:
  - one Back press = one history entry;
  - the Layout tab is always one tap away at the top;
  - the sheet's existing Back already means "leave the sheet".
- An unsaved Add is discarded exactly as today.

**Focus**
- **On open:** `#scale-back`, as today (DI 2.4). The Scale tab is selected on every open, Add and Edit.
- **On a tab click or arrow key:** focus stays on, or moves to, the activated tab. The panel scroll
  resets to the top on a switch.
- **On NEXT:** select Layout and focus `#scale-tab-layout`. The screen-reader user hears
  "Layout, tab, selected", then Tab moves into the panel.
- **Tab order, Scale tab:**
  `[backBtn, selectedTab, nameBox (Edit), ding, top, inner, bottom, scaleBox, ...swatches, primary, delBtn (Edit)]`.
  `primary` is `#scale-next` in Add and `#scale-generate` in Edit.
- **Tab order, Layout tab:**
  `[backBtn, selectedTab, plate .panhit[tabindex="0"], anchorOne, anchorBetween, mirrorTop, mirrorBot, fineBtn, notePrev, noteNext, seatPrev, seatNext, resetBtn, primary, delBtn (Edit)]`.
  `primary` is `#scale-generate` in both flows.
- Both lists are filtered by the existing `isStop` (disabled controls drop out).
- While `lipshut`, the footer stops are replaced by `#scale-lip` (L, S11).

**CTA per flow, tab and state**

| flow | tab | scale empty | scale invalid | scale valid |
|---|---|---|---|---|
| Add | Scale | NEXT enabled | NEXT enabled | NEXT enabled |
| Add | Layout | GENERATE CARDS disabled | GENERATE CARDS disabled | GENERATE CARDS enabled |
| Edit | Scale | SAVE CHANGES disabled | SAVE CHANGES disabled | SAVE CHANGES enabled |
| Edit | Layout | SAVE CHANGES disabled | SAVE CHANGES disabled | SAVE CHANGES enabled |

- NEXT is always enabled because the Layout tab is always tappable (owner answer). NEXT never validates;
  it is a route.
- GENERATE and SAVE keep today's enabling (`genBtn.disabled` from `syncParseState`'s `boxOk`, with
  `runGenerate` returning early when disabled).
- Exactly one primary is visible: `#scale-next` and `#scale-generate` toggle `hidden`. The cream
  #f1ece1 fill stays only on the full primary button (pinned below).
- DELETE (`#scale-delete-row`) shows in Edit on both tabs, unchanged.

### 3.4 Messages per tab

- **`#scale-guidance`** (`#scale-field-msg`, `#scale-msg`, `#scale-layout-state`) stays one slot,
  outside both panels and above the footer.
  - On Scale it shows `#scale-field-msg` and `#scale-msg`, as today.
  - On Layout it shows `#scale-msg` and `#scale-layout-state`. `#scale-field-msg` is hidden there,
    since it names fields that are not on screen.
  - The SG rules hold on each tab: a two-line reserve, 18px per extra line, a `.warn.pan` warning that
    yields to the notice via `#scale-sheet.noticed`, and the slot above the primary (CLAUDE.md
    "Known pitfalls", sheet guidance).
- **`#scale-refusal`** stays by `#scale-box` in the Scale panel. On Layout, an invalid scale shows the
  empty state in 3.5 instead. The refusal text is not duplicated.

### 3.5 Layout tab: empty and invalid state (Add and Edit)

When `!boxOk`:
- `#scale-layout-hint` is shown at the top of the panel: "Type a scale to adjust its layout." (P's
  sentence, kept).
- `#scale-preview` draws its existing empty plate, the same as the Scale-less preview today.
- Every drawer control is `disabled`, so it drops out of the Tab order through `isStop`.
- GENERATE CARDS or SAVE CHANGES is disabled.
- Focus stays on the tab.

When the user returns to Layout after fixing the scale, the controls are enabled and
the hint is hidden.

### 3.6 Pan size on the Layout tab (A5)

The clamp is kept from P (S3): `width:clamp(160px, min(100cqw, calc(100cqh - var(--adj-reserve))), 480px)`.
`--adj-reserve` keeps P's values: **232px**, and **72px** in the wide container block.

Why this holds the pan at P's Adjust size:
- `cqw` and `cqh` resolve against the **content box** of `.sheetsurf` (the `surf` container), not the
  viewport. The tab strip, the head, the guidance slot and the footer sit inside that box and do not
  change it.
- So with the same reserve, the Layout pan equals P's Adjust pan at every viewport by construction.
- Re-measuring the reserve for the tab strip and footer (the earlier 300px) would shrink it, so it is
  not done.
- The tab strip sits in the scroller (3.1). In portrait it takes the 44px row that P's
  `#scale-adjust-head` took. The kept `.sheethead` and the footer take what Adjust hid. In the wide block
  the tabs are in column 2 and cost the plate nothing.

**Measured** in headless Chrome on the lane base's `index.html` (`file://`, device scale 1, no
scrollbars):
- Adjust: `showAdjust()` after typing `(D3) A3 C4 D4 E4 F4 G4 A4 C5`.
- Layout: a prototype of 3.1 on that page, i.e. Adjust with `.sheethead` shown,
  `#scale-adjust-head` hidden, `#scale-generate` shown and a 44px first child in `.sheetbody`.
- Content box: `clientWidth` / `clientHeight` minus padding.

| viewport | content box (w x h) | P small pan `clamp(88px,30cqw,160px)` | P Adjust pan (measured) | Layout pan (measured, prototype) | e2e floor (value - 2px) |
|---|---|---|---|---|---|
| 320x568 | 276 x 532 | 88 | 276 | **276** | 274 |
| 380x780 | 336 x 744 | 101 | 336 | **336** | 334 |
| 393x852 | 349 x 816 | 105 | 349 | **349** | 347 |
| 844x390 | 826 x 378 (side padding 9px under `max-height:520px`; `max-width:none` from the landscape rule, re-keyed per S3) | 160 | 306 (378 - 72) | **306** | 304 |
| 1280x800 | 610 x 752 | 160 | 480 (cap) | **480** | 478 |

The Layout pan is never smaller than the Adjust pan, and it is 1.9x to 3.3x P's small pan.

What the extra chrome costs is the fold, not the size. Measured, with the plate band's top and bottom
against the bottom of the `.sheetbody` scroller:

| viewport | Adjust: pan bottom / scroller bottom | Layout: pan bottom / scroller bottom |
|---|---|---|
| 320x568 | 356 / 516 | 414 / 442 (whole pan visible; the lower 12px of the 40px status line under it is below the fold) |
| 380x780 | 416 / 728 | 474 / 654 |
| 393x852 | 429 / 800 | 487 / 726 |
| 844x390 | 362 / 342 (20px below the fold today) | 362 / 292 (70px below the fold) |
| 1280x800 | 572 / 740 | 636 / 660 |

**AFK decision TB-A2 (recorded for the owner).** At 844x390 the size rule and the fold rule conflict.
- The visible scroller is 236px tall (56 to 292) once the 44px footer and its gap return.
- A pan that fits it whole would be about 236px, 70px smaller than Adjust's 306.
- Picked: keep **306**, the largest pan the reserve allows, equal to Adjust. The plate's lower 70px is
  reached by scrolling the panel, as Adjust's lower 20px is today. The tabs, in column 2, stay in view.
- The alternative (fit the plate whole at 236px) breaks D3's "never smaller than Adjust".
- No portrait viewport has this conflict.

Lane T measures every row in e2e (5.3) and holds the floors in the last column.

### 3.7 O4: the lip on the tabbed footer

- **Built once, from L 3.4.** Values are kept as in S7-S11: the 180ms slide with
  `cubic-bezier(.3,0,.2,1)` FLIP, the 1-5px lip (owner D6(b)), the 36x4 pill, the 25px tap zone, the
  24px / 150ms rule, `lipQuietUntil`, the 16px swipe, `scroll-padding-bottom` 21px, guidance above the
  lip, the 220ms timer plus `lipGen`, and no rAF or ResizeObserver.
- **The primary inside `#scale-footslide`** is whichever of `#scale-next` / `#scale-generate` is
  visible. The lip's aria-label names it: "Show NEXT", "Show GENERATE CARDS" or "Show SAVE CHANGES".
- **Lip and tab switches:**
  - Activating either tab, or NEXT, removes `lipshut` with `lipnow` (instant, no slide), and the full
    footer is shown.
  - The scroll baseline resets to the new panel's position (a range change, L's re-baseline).
  - NEXT can never be tapped while hidden: under `lipshut` the tap zone reveals the footer first (L),
    and the second tap hits NEXT.
- **Keyboard up** (`kbup`, existing `applyKbOffset`):
  - The lip logic is suspended, as L says, and the footer stays full above the keyboard.
  - `kbup.side` hides `.sheethead` as today (DI 2.4). The tab strip is hidden with it, so the field
    gets the space; it returns on `kbup` end.
  - The Layout tab has no text inputs, so the keyboard cannot rise there.
- **Reduced motion** (`prefers-reduced-motion: reduce`): the lip slide is instant (L) and tab switches
  have no transition at all, in any mode.

### 3.8 State matrix (R3)

Rows are flow x tab x scale state x keyboard. Each cell gives the visible UI, the CTA and the focus.

| flow/tab | state | keyboard down | keyboard up |
|---|---|---|---|
| Add/Scale | empty | fields + OR + line, empty placeholders; NEXT on; focus Back on open | head + tabs hidden; focused field revealed (`revealField`); footer full above keyboard; NEXT on |
| Add/Scale | invalid | `#scale-refusal` / field messages; NEXT on | same as down, with the head hidden |
| Add/Scale | valid | parse line; NEXT on | same |
| Add/Layout | empty | hint + empty plate + disabled controls; GENERATE off; focus on tab | n/a (no text input; any keyboard closes on switch, since the Scale field blurs when its panel hides) |
| Add/Layout | invalid | same as empty | n/a |
| Add/Layout | valid | large pan + enabled controls + `#scale-layout-state`; GENERATE on | n/a |
| Edit/Scale | empty | as Add, with the name row; SAVE off | as Add; SAVE off |
| Edit/Scale | invalid | SAVE off | SAVE off |
| Edit/Scale | valid | SAVE on (today's rule) | SAVE on |
| Edit/Layout | empty or invalid | hint + disabled controls; SAVE off | n/a |
| Edit/Layout | valid | large pan; SAVE on | n/a |

A tab switch while a Scale field holds focus blurs it, because hiding the panel hides the input.
`kbup` ends through the existing visualViewport handler.

### 3.9 Design grounding (A4, frontend-design)

**Pinned tokens (L 3.4 / Q10):**
- surface #1f1b15;
- focus ring `:focus-visible{outline:2px solid #e3b25c}`;
- cream #f1ece1 only on the full primary button;
- field border #433b2c;
- label #a79d8b.

Every new element uses these tokens or `.mode`. No new fonts (Marcellus / Bitter / Nunito Sans) and no
new colours.

Principles applied:
- "Visual structure is information." The OR rule encodes a real either/or between two inputs, and the
  tab strip encodes a two-step flow. Neither is decoration.
- "Spend your boldness in one place." The memorable element is the big pan on Layout. Tabs, the OR rule
  and NEXT stay quiet in existing tokens.
- "A CTA says exactly what happens." NEXT routes, GENERATE CARDS generates and SAVE CHANGES saves.
  Each action keeps its name through the flow.
- "Treat emptiness as direction." Layout's empty state says what to do ("Type a scale to adjust its
  layout.") rather than showing a blank pan.
- "Motion that answers a person's action is welcome." Only the lip slides, and only in answer to
  scroll. Tab switches are instant.
- "Quality floor: responsive, visible focus, reduced motion." 44px targets, 320px width and the
  #e3b25c ring are covered.

Principles rejected, with one line why each:
- "Avoid all caps for labels." Rejected: the shipped `.mode` and `.sheetlabel` system is uppercase, and
  CLAUDE.md says to preserve the visual system.
- "Take aesthetic risk, distinctive palette and type." Rejected: this is an edit inside a fixed design
  system, not a new identity.
- "Numbered markers only for sequences." Not used: two tabs need no numbers, even though they are a
  sequence in Add, because Edit uses them freely.

## 4. O1: bottom-note placement (amended O1)

### 4.1 Algorithm

Input: the ding D (octaved) and the bottom list b1..bn in typed order. Left to right:

```
prev = none
for i = 1 to n:
  if b_i has a typed octave: m_i = its midi                         (kept as typed)
  else if prev is none:      m_i = the instance with D-12 <= m_i < D (the octave below the ding)
  else:                      m_i = the nearest instance strictly above prev   (may rise above the ding)
  if m_i < 0:                error "<name> has no octave that fits: type one."   (existing, range floor)
  if m_i equals an earlier m_j: error "<name> is already in the bottom notes."   (existing)
  if prev and m_i < prev:    error composeLower: "X is lower than P: list low to high." (existing)
  prev = m_i
info: "Octaves guessed: <unoctaved notes as placed>. Type an octave to change a guess."  (existing)
```

Precisely:
- **First note octaved:** kept. Every later unoctaved note goes strictly above the note before it.
- **After a typed-octave note:** the next unoctaved note takes the nearest instance strictly above that typed note, wherever it sits relative to the ding.
- **First note unoctaved:** the octave below the ding, never above it; a note with the ding's pitch class is D-12.
- Only the first note uses the ding; nothing else is capped by it.
- **AFK decision TB-A1:** step 3 does NOT skip the ding's midi. Under ding D3, `c d` gives C3 D3. This
  follows the owner's rule literally ("can go higher than the ding", nothing about skipping it). It also
  matches the other two paths, since `parseSeed` and the legacy list already accept a bottom on the ding's
  midi; measured: legacy `(A4) G B F# G B E | B G A E F Gb` places a bottom A4 under the new rule. Lane P's
  importer stepped past it (D3, `C D` gave C3 D4), and that test is rewritten (4.4).

Worked examples (ding D3 unless stated):

| input | result |
|---|---|
| `g a b c` | G2 A2 B2 C3 |
| `c d e f g` | C3 D3 E3 F3 G3 (C3 is in D2..C#3; the run then rises past the ding) |
| `g A2 c` | G2 A2 C3 |
| `A3 c` | A3 C4 (first octaved; c above A3) |
| `g A1` | G2 then A1 → "A1 is lower than G2: list low to high." |
| `d` | D2 (same pitch class as the ding) |
| `A2 a` | A2 then A3 (strictly above), accepted |
| `c d` | C3 D3 (the second lands on the ding's midi and stays there, TB-A1) |
| `C1 c1`-style repeat `G2 G2` | "G2 is already in the bottom notes." |
| ding F3, `C Db Eb Bb Db Ab` (Pygmy unoctaved) | C3 Db3 Eb3 Bb3 Db4 Ab4 |
| ding F3, `c Db4` | C3 Db4 |
| ding F3, `C3 Db3 Eb3 Bb3 Db4 Ab5` (Pygmy, all typed) | unchanged |
| ding C0, `b` | B-1 (midi 11) accepted; ding C-1 `b` → "B has no octave that fits: type one." |

Line to fields: the fields path writes octaved `[..]` tokens into the line through `compose`; the line
path writes explicit octaves back into BOTTOM NOTES (`formatSeed`).

### 4.2 Where each input is placed today (checked on origin/dev)

- **Fields (Add/Edit):** `importer.composeBottoms` - the first unoctaved bottom starts at `ding.octave`
  and moves down only on the ding's own midi; that is the observed bug (D3 + g → G3).
- **v4+ scale line (`core.parseSeed`, also stored records and v4/v5 links):** definitive, unchanged
  (owner, 2026-10-19). A bracket before the ding lands below it, one after it takes its pitch position
  (`(D3) [G] A3` reads G3, `(D3) A3 C5 [G]` reads G5, `(D3) A3 [G] C4` is NOTE_OUT_OF_ORDER, on origin/main
  and on the lane base alike). A guard test pins these outputs (5.1).
- **v1-v3 links and legacy strings (`core.parseLegacySeed`):** `validate` places the first bottom with
  `nearestToDing` (nearest instance either side, ties below) and the rest with `nextAbove`. This is the one
  decode path that disagrees with O1: D3 with bottom `g` gives G3.

So the two inference paths share ONE function, defined once in `core.js` and called by the importer, so
they cannot drift (owner, 2026-10-19, "One engine, new rule"):
1. `HPE.core.inferBottoms(dingMidi, notes)` implements 4.1's placement.
   - **Input:** `notes` is an array of `{letter, accidental, octave}`, with `octave` null when unoctaved.
     The importer's note objects carry `acc`, so `composeBottoms` maps `acc` to `accidental` when it
     builds the array.
   - **Returns** `{midis, failAt}`. `failAt` is the index of the first note whose midi falls outside
     0..127, typed or inferred, or -1 when there is none.
   - `midis` is filled for every index up to and including `failAt`. At `failAt` it holds the raw
     out-of-range midi, which legacy `outOfRange(low, low.midi)` reports.
   - Example: a typed `Cb-1` gives midi -1 at its index. Ding C-1 with `b` gives a raw -1. After a typed
     G9, `a` gives a raw 129.
   - It does not check order or repeats. Callers keep their own refusal codes and wording:
     - legacy keeps `outOfRange` / `outOfOrder`;
     - the importer keeps "is outside C-1 to G9." for a typed note at `failAt` and "has no octave that
       fits: type one." for an inferred one, plus its duplicate and composeLower refusals.
2. `validate` (inside `parseLegacySeed`) places its `|` bottom list with it, replacing the
   `nearestToDing` + `nextAbove` pair for bottoms; `nearestToDing` is removed if nothing else calls it
   (enumerate callers, do not grep).
3. `importer.composeBottoms` calls it instead of its own `ding.octave` seed + `composeAbove`.

Because both files are engine modules: `python3 tools/inline_engine.py`; `node tools/regen_engine_corpus.js --check`
then regenerate on drift; `tools/validate.py` check 4.

### 4.3 Backwards compatibility (measured)

Method (re-run 2026-10-19 for the second amendment): the lane base `origin/claude/dual-input-ux-p` `core.js`
against a copy whose `nearestToDing` returns `below` (the 4.1 first-note rule; later notes were already
`nextAbove`), both loaded in a `node:vm` context, over every string in `tests/fixtures/*.json` and
`data/decks.json` that contains `(` (424 candidates), plus `tests/fixtures/deck_ids_v1.json`
(5 `pinned` + 513 `strings`).
What was counted: `run.js` collects every string VALUE and object KEY in `tests/fixtures/*.json`, plus
`data/decks.json`, that contains `(` and a capital A-G and is under 300 characters. That gives 424
distinct strings. A different filter gives a different total: one that also took `[` or `|`, lowercase
letters or test-file literals counts more, and the reviewer's 445 is such a count. The decode and id
rows below come from the 424 and from the two `deck_ids_v1.json` lists, re-run 2026-10-19 with the same
results.

| input | parsed | decode differs | deck id changes |
|---|---|---|---|
| fixture strings through `parseLegacySeed` (v1-v3 `|` bottom list) | 261 | **27** | - |
| fixture strings through `parseSeed` (v4/v5 line, unchanged by design) | 228 | **0** | - |
| frozen legacy strings (`deck_ids_v1.json` `strings`, test "every frozen legacy string keeps its deck id") | 513 | - | **73 of 513** |
| the five `pinned` strings in that file (the built-ins) | 5 | 0 | 0 |
| the five built-in decks (`data/decks.json`, `formatSeed` then `parseSeed`) | 5 | 0 | 0 |
| stored records (v4 shape, octaved) | - | 0 by construction | 0 |
| "SV: the five built-in decks' v5 links are pinned" | - | 0 | stays green |

Owner's worked example (measured): `(D3) A3 C4 D4 E4 F4 G4 A4 C5 | F G A` decodes today to bottoms
F3 G3 A3 (custom:c5690316) and under the new rule to F2 G2 A2 (custom:0a03f67f). `(D3) A3 C4 D4 E4 F4 G4 A4 C5 | C E`
is unchanged (C3 E3, custom:addbfb13), and Pygmy's legacy bottom list, octaved
(`| C3 Db3 Eb3 Bb3 Db4 Ab5`) or not (`| C Db Eb Bb Db Ab`), is unchanged.

Examples of moved ids: `D/ A Db F A# G E B D# Ab E | F# E Cb F` custom:cd34cf4b → custom:6a11a741;
`(G3) A B Bb F E D F B# Db | Ab A D` custom:e147519d → custom:0d484d2a.

Consequences:
- No built-in, no stored record, no v4/v5 link and no pinned v5 link moves.
- 73 frozen legacy strings move their id, so "every frozen legacy string keeps its deck id" goes red and
  would have to be re-pinned (`deck_ids_v1.json` regenerated). A person opening an old v1-v3 link with an
  unoctaved bottom note would get different bottom octaves and a new custom deck id, so the same link
  opened before and after would give two decks. `engine_corpus_v1.json` moves only where it holds such a
  legacy string; lane E regenerates it.
- Owner decision Q4 (a) and "One engine, new rule", 2026-10-19, binding: one inference function for the field and the legacy list; lane E re-pins the 73 ids and lists each old and new id in its PR body.

### 4.4 Existing tests that pin current behaviour

- `tests/import.test.js` "Octaves guessed: C3, Db3, Eb3, Bb3, Db4, Ab4." (Pygmy, ding F3, unoctaved): the
  amended rule gives the same notes, so it is **unchanged**. The earlier retirement (review fold E4) is withdrawn.
- `tests/import.test.js` `two.info.bottom` "C3, Eb3" and `mixed.info.bottom` "Eb3" (ding F3): unchanged.
- "IH: compose refuses bottoms out of order ..., refuses a repeated bottom, and accepts a bottom copy of a
  rim pitch": rechecked; any input whose first unoctaved note sat above the ding is rewritten to the 4.1
  result, and all three refusal kinds stay asserted.
- "every frozen legacy string keeps its deck id" is re-pinned with the 73 new ids,
  each listed in the PR body, and the five named built-in rows stay literal and unchanged.
- `tests/mutants/ih_e_bottom_order_unchecked.patch`: re-anchored if its line moves; `# kills:` kept.

Rewrite these to the new rule (old expectation in brackets). Every test whose title states the old rule is
retitled, and the PR body lists old and new titles:
- `tests/core.test.js` "bottom inference restarts nearest the ding, ties going below": `(F3) G3 Ab3 C4 | G`
  gives **G2** [G3]. The F, B, E and "E G" rows are unchanged (F2, B2, E3, then E3 G3). Retitled "bottom
  inference starts in the octave below the ding".
- `tests/import.test.js` "IH: compose guesses the first octaveless bottom in the ding's octave, an octave
  down when it names the ding, ...": D3 with `Bb` gives **Bb2** [Bb3]; `D` (D2) and `Db` under C#3 (Db2)
  are unchanged. Retitled "IH: compose guesses the first octaveless bottom in the octave below the ding,
  ...".
- "IH: compose reads lowercase notes: a3, bb3 and eb read as A3, Bb3 and Eb": `eb` gives **Eb2** [Eb3],
  and the line becomes `[Eb2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4` [`(D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4`].
- "IH: compose refuses notes outside C-1 to G9 in each field, and an octaveless bottom whose guess falls
  outside that range": the `{ding: "G9", bottom: "A"}` row is dropped, because it now gives A8 (midi 117).
  The guess clause stays asserted by `{ding: "D3", top: "A3", bottom: "G9 A"}` (A9 > 127). Retitled
  "IH: compose refuses notes outside C-1 to G9 in each field, and an octaveless bottom placed above G9".
- "IH: compose steps a later octaveless bottom past the ding's midi: under ding D3, bottoms C D read C3
  D4" becomes "IH: compose lets a later octaveless bottom land on the ding's midi: under ding D3, bottoms
  C D read C3 D3" (`guessed` C3 D3 [C3 D4], line `[C3] [D3] (D3) A3` [`[C3] (D3) A3 [D4]`]; TB-A1).
- Unchanged and rechecked: "IH: compose keeps a typed bottom octave ..." (C3 Eb → Eb3; C Eb → C3 Eb3)
  and "IH: compose steps each later octaveless bottom ... C3 Db3 Eb3 Bb3 Db4 Ab4".

Existing mutants that pin the old rule (all four anchor on lines lane E removes):
- **Retired, with their `# kills:` clauses:** `ih_e_ding_match_by_letter.patch`,
  `ih_e_guess_restarts_at_ding.patch` and `ih_e_later_guess_lands_on_ding.patch`. Each patches the
  `if (at === ding.midi)` / `ding.octave` seed in `composeBottoms`, which `inferBottoms` replaces.
  Their behaviours are covered by `o1_first_at_ding_octave`, `o1_paths_diverge` and
  `o1_ding_midi_skipped` (5.4).
- **Re-anchored:** `u_order_collapses_to_bad_note.patch`. Its context line
  `: place(low, bottomNotes[n - 1].midi, nextAbove);` goes away. It is re-anchored on the `outOfOrder`
  return in `validate`, with `# kills:` and `# suite:` unchanged.
- **Counts:** the corpus changes by (new `o1_*` rows) - 3. The README's mutant sentence must stay
  within `tests/test_readme_currency.py`'s band (at most the on-disk count, at least 90% of it). Lane E
  restates it only if the band fails. The `tests/suite_health.py` FLOORS rows for
  `tests/core.test.js` and `tests/import.test.js` are raised to the lane's new test counts, taken from
  the lane's CI run artifacts (memory: FLOORS rows lag the CI count).

## 5. Test plan (TDD: tests first, red, then implement)

Sandbox tests are in `tests/app.test.js`, engine tests in `tests/import.test.js`, and real Chrome tests
in `tests/e2e.test.js`. Prefixes: `O1:` (engine and sheet placement), `TB:` (tabs), `OR:`, `LP:` (lip).

### 5.1 Engine (`tests/import.test.js`, `tests/core.test.js`)
- "O1: compose places the first octaveless bottom in the octave below the ding: D3 g a b c gives G2 A2 B2 C3"
- "O1: an octaveless bottom run may rise past the ding: D3 c d e f g gives C3 D3 E3 F3 G3"
- "O1: a typed bottom octave is kept and the next octaveless note goes above it: D3 g A2 c gives G2 A2 C3, D3 A3 c gives A3 C4"
- "O1: Pygmy's octaveless bottoms under F3 give C3 Db3 Eb3 Bb3 Db4 Ab4, and F3 c Db4 gives C3 Db4"
- "O1: a typed note below the one before it refuses with composeLower: D3 g A1 says A1 is lower than G2"
- "O1: a repeated bottom refuses: D3 G2 G2 says G2 is already in the bottom notes"
- "O1: a bottom with no octave at or above zero refuses: ding C-1 b says B has no octave that fits: type one"
- "O1: Pygmy's bottoms typed with octaves are unchanged: F3 C3 Db3 Eb3 Bb3 Db4 Ab5"
- "O1: the scale line is definitive: (D3) [G] A3, (D3) A3 C5 [G], (D3) A3 [G] C4 and [G] [A] [B] [C] (D3) A3 C4 E4 decode as on origin/main" (guard, green before and after: G3, G5, NOTE_OUT_OF_ORDER, G2 A2 B2 C3 pinned as literals measured on origin/main)
- "O1: the two inference paths agree: compose and parseLegacySeed give the same bottom midis for D3 g; D3 g a b c; D3 c d e f g; F3 C Db Eb Bb Db Ab" - each case as fields and as a v1-v3 string with a `|` bottom list
- "O1: the owner's legacy example: (D3) A3 C4 D4 E4 F4 G4 A4 C5 | F G A gives F2 G2 A2, and | C E gives C3 E3"
- `tests/core.test.js`: "O1: parseLegacySeed places the first octaveless bottom in the octave below the ding: (D3) A3 C4 E4 | G gives G2"
- `tests/core.test.js`: "O1: inferBottoms returns {midis, failAt}: a typed Cb-1 fails at its index with midi -1, ding C-1 with b fails with -1, G9 then a fails with 129, and a clean list has failAt -1"
- "O1: a later octaveless bottom may land on the ding's midi: D3 c d gives C3 D3" (TB-A1; this is the rewritten "IH: compose lets a later ..." test in 4.4)

### 5.2 Sandbox (`tests/app.test.js`)
- "O1: typing g a b c in BOTTOM NOTES with ding D3 writes [G2] [A2] [B2] [C3] into the line"
- "O1: typing (D3) [G] A3 in the line writes G3 back into BOTTOM NOTES: the line is definitive"
- "O1: a v5 link and a stored record open with the same fields as before O1"
- "TB: the served markup has a tablist with Scale then Layout, two tabpanels, and the Scale tab selected with tabindex 0 on open, Add and Edit"
- "TB: ArrowRight, ArrowLeft, Home and End move and activate the tabs, wrap, and keep exactly one tabindex 0"
- "TB: a tab switch pushes no history entry and calls no replaceState"
- "TB: Back, Escape and a popstate close the sheet from the Layout tab exactly as from the Scale tab, with one history.back"
- "TB: NEXT shows only in Add on the Scale tab, is enabled in every scale state, selects Layout and focuses the Layout tab"
- "TB: on Add Layout GENERATE CARDS is the primary and is disabled until the scale is valid"
- "TB: in Edit SAVE CHANGES is the primary on both tabs with today's enabling, and DELETE shows on both"
- "TB: the Layout tab with an empty or invalid scale shows the hint, the empty plate and every drawer control disabled and out of the Tab order"
- "TB: the sheet Tab order on each tab and flow is the section 3.3 list filtered by isStop"
- "TB: the Adjust overlay is gone: no showAdjust, no adjust history state, no #scale-adjust-head, #scale-layout-toggle or adjusting class, and a pan tap on Layout opens nothing" — the lane P retirement test.
- "TB: #scale-field-msg shows on Scale only, #scale-layout-state on Layout only, and #scale-guidance keeps its SG order and two-line reserve on both"
- "TB: ELEMENT_IDS carries scale-tabs, scale-tab-scale, scale-tab-layout, scale-panel-scale, scale-panel-layout, scale-next, scale-foot, scale-footslide and scale-lip, and none of the retired adjust ids"
- "O1: GENERATE CARDS and SAVE CHANGES from fields D3 / A3 C4 E4 / g store G2, equal to the parse line"
- "TB: switching to Layout with #scale-box focused and the keyboard up ends kbup and shows the tab strip"
- "OR: #scale-or sits between #scale-fields and the scale line, is a separator named or, and is not a Tab stop"
- "LP: the lip's aria-label names the visible primary: Show NEXT, Show GENERATE CARDS, Show SAVE CHANGES"
- "LP: a tab switch or NEXT clears lipshut with lipnow and re-baselines the scroll"
- "LP: while lipshut the footer stops are replaced by #scale-lip in the Tab order on both tabs"
- Lane L was never built: dev has no `uxl_*` mutant and no `#scale-lip`. Lane T2 AUTHORS lane L's A1-A19 sandbox tests from ux plan section 8, titles verbatim. Each title that names "GENERATE CARDS" as the primary is re-run once per primary (NEXT, GENERATE CARDS, SAVE CHANGES) by its existing loop.

### 5.3 Real Chrome (`tests/e2e.test.js`)
- "TB: at 320x568, 380x780, 393x852, 844x390 and 1280x800 the Layout pan is wider than the old small pan clamp(88px, 30cqw, 160px) and at least the section 3.6 width minus 2px" (floors 274, 334, 347, 304, 478)
- "TB: at 844x390 the Layout tab's .sheetsurf is wider than 600px, the tab strip sits right of the plate and the pan is at least 304px"
- "TB: at 320x568, 380x780 and 393x852 the whole Layout pan is inside the .sheetbody box when the tab opens"
- "TB: at 380x780 the four note fields and the scale line take the full content width on the Scale tab"
- "TB: at 380x780 Add: type a scale, NEXT, adjust anchor, GENERATE CARDS opens the deck, and one Back from the deck leaves no sheet entry"
- "TB: at 380x780 Edit: SAVE CHANGES from the Layout tab saves and the bar ends on the deck's route"
- "TB: at 320x568 the tab strip, both tabs and NEXT are 44px targets with no horizontal scroll"
- "OR: at 380x780 the OR rule spans the content width between the fields and the scale line"
- "LP: at 380x780 scrolling the Scale panel collapses the footer to the lip and a tap on the lip restores NEXT"
- "LP: the lip slide takes 180ms and is instant under prefers-reduced-motion; tab switches have no transition"
- "TB: at 380x780 with the keyboard up the head and tab strip hide and the footer stays above the keyboard"
- Lane T2 authors lane L's E1-E12 e2e tests from ux plan section 8, titles verbatim, re-based on the tabbed footer.

**Retired or rewritten (each with a reason, never weakened silently):**
- Lane P's tests asserting the small pan beside the fields, `showAdjust` / `enterAdjust` /
  `#scale-adjust-title` focus, the `{adjust:true}` history entry and its popstate branches, and P's
  e2e small-pan width rows.
  - Reason: S1, S2, S4. Retired for P's DEV-only behaviour, which never reaches main.
  - Their replacements are the TB tests above. The lane removes them by exact title and lists each
    retired title in its PR body.
- DI 2.4 Tab-order tests that list `drawerBtn`: rewritten to the 3.3 lists (S12).

### 5.4 Mutants (`tests/mutants/`, no `index` lines, `.`-wildcard `# suite:`)

| file | change | `# kills:` | `# suite:` |
|---|---|---|---|
| `o1_first_at_ding_octave.patch` | first octaveless bottom seeded at `ding.octave` (old rule) | O1: compose places the first octaveless bottom in the octave below the ding: D3 g a b c gives G2 A2 B2 C3 | `O1:.compose.places.the.first` |
| `o1_run_capped_at_ding.patch` | later notes capped below the ding | O1: an octaveless bottom run may rise past the ding: D3 c d e f g gives C3 D3 E3 F3 G3 | `O1:.an.octaveless.bottom.run` |
| `o1_typed_octave_replaced.patch` | an octaved note also gets placed | O1: a typed bottom octave is kept and the next octaveless note goes above it: D3 g A2 c gives G2 A2 C3, D3 A3 c gives A3 C4 | `O1:.a.typed.bottom.octave` |
| `o1_paths_diverge.patch` | `composeBottoms` stops calling `HPE.core.inferBottoms` and seeds from `ding.octave` again; `parseLegacySeed` untouched | O1: the two inference paths agree: compose and parseLegacySeed give the same bottom midis for D3 g; D3 g a b c; D3 c d e f g; F3 C Db Eb Bb Db Ab | `O1:.the.two.inference.paths` |
| `o1_legacy_nearest_kept.patch` | `validate` places the legacy `|` list's first bottom by the nearest instance again (old `nearestToDing`) | O1: parseLegacySeed places the first octaveless bottom in the octave below the ding: (D3) A3 C4 E4 &#124; G gives G2 | `O1:.parseLegacySeed.places` |
| `tb_tab_pushes_history.patch` | the tab switch calls `pushState` | TB: a tab switch pushes no history entry and calls no replaceState | `TB:.a.tab.switch.pushes` |
| `tb_back_returns_to_scale.patch` | Back on Layout selects Scale instead of closing | TB: Back, Escape and a popstate close the sheet from the Layout tab exactly as from the Scale tab, with one history.back | `TB:.Back..Escape` |
| `tb_next_validates.patch` | NEXT disabled while `!boxOk` | TB: NEXT shows only in Add on the Scale tab, is enabled in every scale state, selects Layout and focuses the Layout tab | `TB:.NEXT.shows` |
| `tb_roving_two_zeros.patch` | both tabs `tabindex=0` | TB: ArrowRight, ArrowLeft, Home and End move and activate the tabs, wrap, and keep exactly one tabindex 0 | `TB:.ArrowRight` |
| `tb_layout_controls_enabled_invalid.patch` | drawer controls enabled with `!boxOk` | TB: the Layout tab with an empty or invalid scale shows the hint, the empty plate and every drawer control disabled and out of the Tab order | `TB:.the.Layout.tab.with` |
| `tb_pan_small_on_layout.patch` | Layout pan uses `clamp(88px,30cqw,160px)` | TB: at 320x568, 380x780, 393x852, 844x390 and 1280x800 the Layout pan is wider than the old small pan clamp(88px, 30cqw, 160px) and at least the section 3.6 width minus 2px | `TB:.at.320x568` |
| `lp_label_fixed.patch` | lip label always "Show GENERATE CARDS" | LP: the lip's aria-label names the visible primary: Show NEXT, Show GENERATE CARDS, Show SAVE CHANGES | `LP:.the.lip.s.aria.label` |
| `lp_tab_keeps_lipshut.patch` | a tab switch leaves `lipshut` | LP: a tab switch or NEXT clears lipshut with lipnow and re-baselines the scroll | `LP:.a.tab.switch.or.NEXT` |

Lane T2 authors lane L's `uxl_*` mutant table from ux plan section 8 (none exist on dev), anchored on its own code. Added rows:

| `o1_ding_midi_skipped.patch` | `inferBottoms` steps a later note past the ding's midi (lane P's rule) | IH: compose lets a later octaveless bottom land on the ding's midi: under ding D3, bottoms C D read C3 D3 | `IH:.compose.lets.a.later` |
| `o1_no_range_floor.patch` | placement drops the midi >= 0 floor | O1: a bottom with no octave at or above zero refuses: ding C-1 b says B has no octave that fits: type one | `O1:.a.bottom.with.no.octave` |
| `tb_landscape_unlifted.patch` | the landscape max-width:none rule left on `.adjusting` | TB: at 844x390 the Layout tab's .sheetsurf is wider than 600px, the tab strip sits right of the plate and the pan is at least 304px | `TB:.at.844x390` |
| `tb_landscape_tabs_on_top.patch` | the wide block keeps the tab strip above the plate | TB: at 844x390 the Layout tab's .sheetsurf is wider than 600px, the tab strip sits right of the plate and the pan is at least 304px | `TB:.at.844x390` |

## 6. Lanes (/swarm)

`index.html` cannot split, so the tabs, OR rule and lip are serial lanes on it. The
engine is a separate file-ownership boundary.

### Lane E: engine O1
- **Base:** `origin/claude/dual-input-ux-p` (lane P head, PR #408). Branch `claude/sheet-tabs-e`.
- **Owns:** `src/engine/importer.js`; the `<!-- engine:importer -->` and `<!-- engine:core -->` regions of
  `index.html`, written only by `tools/inline_engine.py`; `tests/import.test.js`;
  `tests/fixtures/engine_corpus_v1.json` (regen only); `src/engine/core.js` (the new `inferBottoms`, its use in `validate`, and `nearestToDing`'s removal), and
  `tests/core.test.js`; `tests/fixtures/deck_ids_v1.json`: no tool writes it, so lane E rewrites the 73 changed `strings`
  entries with a one-off `node:vm` script that is not committed, leaves `pinned` and `note` untouched, and
  lists every old -> new id in the PR body;
  `tests/fixtures/engine_corpus_v1.json` regenerated with `node tools/regen_engine_corpus.js` in the same commit
  as the engine change; `tests/mutants/o1_*` engine rows; re-anchoring `ih_e_bottom_order_unchecked.patch` and any
  existing mutant whose anchor is in `nearestToDing`/`validate` or the importer region; retiring
  `ih_e_ding_match_by_letter`, `ih_e_guess_restarts_at_ding` and `ih_e_later_guess_lands_on_ding`;
  re-anchoring `u_order_collapses_to_bad_note` (4.4); the README mutant sentence (only if its band
  fails) and the `tests/suite_health.py` FLOORS rows for `tests/core.test.js` and `tests/import.test.js`. No data mutant
  (`tools/regen_data_mutants.py`) is owned or regenerated: `data/decks.json` and the DECKS line do not change.
- **Acceptance:** 5.1 green; `parseSeed` and `scaleInfer` byte-identical to the base (the function-text
  diff in Verify); the 4.4 rewrites and mutant retirements done; `tests/scale.test.js`, `scale_grammar_v1.json` and `import_cases_v1.json` unedited; 4.4 rewrites done with reasons; "SV: the five built-in decks' v5 links are pinned" green unedited;
  exactly the 73 measured ids re-pinned, five named rows unchanged, and the PR body lists all 73 old -> new ids.
- **Verify:**
  ```
  python3 tools/inline_engine.py --check && node tools/regen_engine_corpus.js --check && git diff --exit-code origin/claude/dual-input-ux-p -- data/decks.json && node --test tests/import.test.js tests/core.test.js tests/scale.test.js tests/share.test.js && git diff --exit-code origin/claude/dual-input-ux-p -- tests/scale.test.js tests/fixtures/scale_grammar_v1.json tests/fixtures/import_cases_v1.json && python3 tools/validate.py && for m in tests/mutants/o1_*.patch tests/mutants/ih_e_bottom_order_unchecked.patch tests/mutants/u_order_collapses_to_bad_note.patch; do git apply --check "$m" || exit 1; done && python3 tools/refresh_mutants.py --check && node --test --test-name-pattern "every mutant patch applies to the tree it will run against|a patch whose anchor became non-unique IS reported stale|no mutant patch outside the tracked exceptions rides a non-unique anchor" tests/mutation_harness.test.js && python3 -m unittest tests.test_readme_currency && for f in parseSeed scaleInfer; do diff <(git show origin/claude/dual-input-ux-p:src/engine/core.js | awk "/^  function $f\\(/,/^  }\$/") <(awk "/^  function $f\\(/,/^  }\$/" src/engine/core.js) || exit 1; done
  ```
  The last loop compares the text of `function parseSeed` and `function scaleInfer` (from the
  two-space-indented `function` line to the first two-space `}`, 47 and 72 lines on the base) with the base.
  It is bash, for the process substitution. A changed helper they call is caught by the 5.1 guard test,
  not by this diff.
- **Non-goals:** no `index.html` edit outside the engine regions; no `share.js`, `formatSeed`, `parseSeed` or `scaleInfer` edit; no UI.

### Lane T1: tabs and OR (then T2: the lip), serial
- **Base:** lane E's head. Branch `claude/sheet-tabs-t1`. Lane T2 (`claude/sheet-tabs-t2`) bases on T1's head and owns only the lip: `#scale-foot`/`#scale-footclip`/`#scale-footslide`/`#scale-lip` markup, CSS and JS, the authored lane L A1-A19 / E1-E12 tests and `uxl_*` mutants, and the LP tests and mutants. T1 owns everything else listed below. Lane T2's M PR carries lane P's net code minus Adjust and supersedes #408.
- **Owns:** `index.html` outside engine regions and outside the DECKS line; `tools/sandbox.js`
  (ELEMENT_IDS); `tests/app.test.js`; `tests/e2e.test.js`; `tools/probe/panel_fit.js` only if the
  sheet change moves a panel control (expected: no change); `tests/mutants/tb_*`, `lp_*`,
  the sandbox O1 tests in 5.2, and the authored `uxl_*`.
- **Acceptance:**
  - 5.2 and 5.3 green;
  - 5.3's retirements listed by exact title in the PR body;
  - `python3 tools/sync_decks.py --check` reports no drift;
  - `python3 tools/inline_engine.py --check` reports no drift;
  - all 3.8 cells covered by a TB/LP test.
- **Verify:**
  ```
  python3 tools/sync_decks.py --check && python3 tools/inline_engine.py --check && node --test tests/app.test.js && python3 tools/validate.py && bash tests/mutation_check.sh
  ```
  The e2e suite is run by CI (memory: the full e2e suite starves the local browser; CI at the head SHA
  is the evidence).
- **Non-goals:** no engine edit, no `data/decks.json` edit, no share/route/record change, no
  `#import-row` unhide, no About / settings / card change.

Lanes are serial E -> T1 -> T2 (T1 runs on lane E's inlined engine; T1 and T2 share `index.html`). There is no parallel `index.html` lane.

### 6.4 Gates (owner's dev-first rule)
0. Before opening M: `git diff origin/main...HEAD --name-only` lists no `_headers`, and `git log origin/main..HEAD` contains no `claude/dev-overlay` commit (619201e, c0cc1fc).
1. Each lane opens PR M into `main`, which is **HELD** and never merged without the owner's explicit
   go. The integrator opens PR D from the same head into `dev`.
2. PR D merges (`gh pr merge <D> --merge`) only when:
   - the `validate` run on M is green at a head SHA verified equal to the local tip
     (`gh pr view --json headRefOid`, re-query once on lag);
   - an independent reviewer subagent returned PASS or PASS_WITH_NITS at that SHA;
   - D is not CONFLICTING.
   After the merge, the integrator runs the main-to-dev sync rules (CLAUDE.md "DEV environment").
3. After lane T reaches dev: the owner's phone check on https://handpan-cards-dev.pages.dev/ (6.5).
4. When the phone check passes, close PR #408 unmerged. Lane P never reaches main (O4).
5. M PRs go to main only on the owner's explicit go.

### 6.5 Owner phone check (DEV, iPhone, portrait unless stated)
1. **+ ADD A SCALE.** The sheet opens on the Scale tab. The four fields span the full width, and an OR
   rule sits between them and the scale line. The footer shows NEXT.
2. Type ding D3, top `A3 C4 D4 E4 F4 G4 A4 C5`, bottom `g a b c`. The line shows
   `[G2] [A2] [B2] [C3]`, and BOTTOM NOTES shows `G2 A2 B2 C3` after the mirror.
3. Type `[G] [A] (D3) A3 C4`: BOTTOM NOTES shows G2 A2. Type `(D3) [G] [A] A3 C4`: it shows G3 A3 (the scale line is definitive).
4. Scroll down. The footer slides to the lip. Tap the lip and NEXT returns.
5. Tap NEXT. The Layout tab opens with a pan as large as the old Adjust layout's. Tap anchor and mirror,
   then GENERATE CARDS. The deck opens.
6. **Add again.** Tap Layout with nothing typed. It shows "Type a scale to adjust its layout.", the
   controls are greyed and GENERATE CARDS is off.
7. On Layout press the phone's Back. The sheet closes, and it does not return to the Scale tab.
8. **Edit the deck from step 5.** SAVE CHANGES shows on both tabs. Change a note, switch to Layout, SAVE.
9. **Rotate to landscape.** The Layout pan is about 306px (the same as the old Adjust layout), with the tabs to its right. Scroll the panel to see the plate's lower edge (TB-A2).
10. **Settings > Accessibility > Reduce Motion on.** The lip and tab switches are instant.
11. Add a scale with ding F3 and bottoms `C Db Eb Bb Db Ab` (no octaves). They read `C3 Db3 Eb3 Bb3 Db4 Ab4`.
12. Open the Pygmy deck's Edit. Its bottom notes `C3 Db3 Eb3 Bb3 Db4 Ab5` are unchanged.

## 7. Open questions (real forks only, recommendation first)

Closed on 2026-10-19 by the owner: Q1 (one rule for every INFERENCE path, subject to the compatibility check, which
became Q4, also closed below), Q2 (tabs beside the plate in the wide landscape block, folded into 3.6), Q3 (closed by the
amended O1).

**Q4 closed (owner, 2026-10-19): (a), then narrowed the same day to "One engine, new rule":** one inference function for the BOTTOM NOTES field and the legacy `|` list; the scale line is definitive and unchanged. The legacy first-bottom rule changes and the 73 frozen ids are re-pinned (sections 4.2, 4.3, lane E).

No open questions remain. AFK decisions for the owner to confirm: TB-A1 (4.1) and TB-A2 (3.6).

Everything else is decided above:
- tab switches push no history;
- Back from Layout closes the sheet;
- NEXT is never disabled;
- the Layout tab is the only place the pan draws;
- the lip is kept from L.

## Appendix: self-check (R1-R8, after the amended O1)

| line | score | evidence |
|---|---|---|
| R1 Owner fidelity | 9 | Amended O1, both amendments and Q1-Q4 folded; the 73 moved ids are decided by the owner: re-pin the 73. TB-A1 and TB-A2 are recorded for the owner. |
| R2 Grounding | 9 | Placement claims checked by running the lane base `core.js`; every 3.6 pan size measured in headless Chrome on the lane base, the Layout column on a prototype. |
| R3 State completeness | 9 | 3.8 covers every cell; landscape is now defined (tabs beside the plate). |
| R4 Constraint safety | 9 | v4/v5, stored records and built-ins measured unchanged; the legacy change is the owner's Q4 (a) decision, its cost measured. |
| R5 Testability | 9 | Every 4.1 branch has a test and a mutant; lane L tests are authored from the ux plan, not yet written. |
| R6 Swarm shape | 9 | E -> T1 -> T2 serial with owns, verify and gates. |
| R7 Design quality | 9 | The Layout pan equals the Adjust pan at all five viewports (276, 336, 349, 306, 480, measured); the cost is the fold at 844x390 (70px vs 20px today), recorded as TB-A2. |
| R8 Decisiveness | 9 | No open fork; the 73 ids are decided by the owner: re-pin the 73. Two AFK decisions are recorded with numbers. |
