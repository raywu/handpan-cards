# Scale / Layout tabs for the Add/Edit sheet (2026-10-19)

Subplan. Base: `origin/dev` (d375f8a, "Merge #409 dev-sync-ux-p"; includes lane P).
Sources, cited by section or anchor: repo `CLAUDE.md`; `docs/plans/2026-10-19-dual-input-sheet-ux.md`
(on `origin/claude/dual-input-ux-plan`, "ux plan"), sections 1-3, 3.4 (lane L) and its "Lane L
subplan record" Q1-Q10, lane P, sections 6-7; `docs/plans/2026-10-18-dual-input.md` (on
`origin/claude/dual-input-plan`, "dual-input plan"), sections 2.1-2.5, A1-A22 and E1-E9; `origin/dev`
`index.html`, `src/engine/core.js`, `src/engine/importer.js`, `tools/sandbox.js`.

Owner input O1-O4 (2026-10-19, phone check on DEV) and amendments A1-A5 are binding.

## 1. Goal and non-goals

**Goal (one testable sentence).** On DEV, the Add/Edit sheet shows two tabs, Scale then Layout,
with full-width note fields, an OR rule between the fields and the scale line, a Layout tab whose
pan is wider than lane P's small pan at every viewport in section 3.6, a footer that collapses to
the lane L lip and carries NEXT / GENERATE CARDS / SAVE CHANGES by flow and tab, and unoctaved bottom
notes that the sheet places below the ding: D3 with "g a b c" gives G2 A2 B2 C3.

**Non-goals.**
- No deck data or diagram geometry change. `data/decks.json`, the DECKS line, `layout.solve` and every
  built-in's drawing stay byte-identical (CLAUDE.md "Hard constraints", "Instrument layouts").
- No change to share-link, stored-record, SAVE or DELETE semantics. `HPE.share` is untouched, and
  `formatSeed` / `parseSeed` / `parseLegacySeed` keep their output (CLAUDE.md "Share link v5",
  "Known pitfalls" on seeded SAVE / DELETE).
- No engine change beyond O1. O1 touches `HPE.importer` only; `src/engine/core.js` is untouched
  (section 4.2).
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
| S3 | P: LARGE pan `clamp(160px, min(100cqw, calc(100cqh - var(--adj-reserve))), 480px)` with `--adj-reserve:232px` (72px in the wide container block) | **Kept, re-keyed** | The same clamp sizes the pan on the Layout tab. The selector becomes `#scale-sheet[data-tab="layout"] #scale-preview`, and `--adj-reserve` is re-measured for the tab strip and footer (section 3.6). |
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
| S14 | DI 2.3 mirror: fields to line through `HPE.importer.compose`; line to fields through `parseSeed`, writing explicit octaves | **Kept, O1 inserted** | Bottom placement in `compose` follows section 4. A typed line goes through the same placement before `parseSeed` (section 4.2). The fields then show back the explicit octaves. |
| S15 | DI 2.5 / `#scale-guidance` order (`#scale-field-msg`, `#scale-msg`, `#scale-layout-state`) between `.sheetbody` and the footer | **Kept** | One slot, shared by both tabs, outside both panels (section 3.4). `#scale-layout-state` is shown only on the Layout tab. |
| S16 | CLAUDE.md "Scale strings": "square brackets mark a bottom note at its pitch position" | **Modified, sheet path only** | In the sheet, an unoctaved bracketed note is placed by section 4's rule, which can move it away from its pitch position: `[g] (D3)` reads G2, not G3. `parseSeed`, stored records and share links are unchanged. The sentence gains: "In the sheet, an unoctaved bracketed note is placed below the ding (O1)." |
| S17 | `importer.composeBottoms`: the first unoctaved bottom starts at `ding.octave` (one octave down only on a hit at the ding's midi); later ones use `composeAbove` | **Replaced** | Section 4.1's right-to-left rule. |
| S18 | DI: the Add CTA is GENERATE CARDS and the Edit CTA is SAVE CHANGES, both as `#scale-generate` | **Modified** | Add/Scale shows NEXT (`#scale-next`). Add/Layout shows GENERATE CARDS. Edit shows SAVE CHANGES on both tabs. |
| S19 | ux plan section 7 gates (dev-sync after CI plus reviewer, phone check) | **Kept** | Section 6.4. PR #408 (lane P's main PR) is closed unmerged once lane T's dev PR lands and the owner's phone check passes. |
| S20 | P's phone-check steps (ux plan section 7) | **Replaced** | Section 6.5. |

## 3. Spec: O2, O3, O4

### 3.1 Markup (served order)

```
#scale-sheet[role=dialog][aria-labelledby=scale-title][data-tab=scale|layout]
  .sheetsurf
    .sheethead        #scale-back, h2#scale-title                         (kept)
    #scale-tabs[role=tablist][aria-label="Scale sheet"]                   NEW
      button#scale-tab-scale.mode[role=tab][aria-controls=scale-panel-scale]   NEW  "Scale"
      button#scale-tab-layout.mode[role=tab][aria-controls=scale-panel-layout] NEW  "Layout"
    .sheetbody                                                            (kept, one scroller)
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

- **Removed ids:** `#scale-pancol`, `#scale-layout-row`, `#scale-layout-toggle`, `#scale-adjust-head`,
  `#scale-adjust-back`, `#scale-adjust-title`.
- **New ids:** `scale-tabs`, `scale-tab-scale`, `scale-tab-layout`, `scale-panel-scale`,
  `scale-panel-layout`, `scale-or`, `scale-next`.
- **Lane L ids, first built here:** `scale-foot`, `scale-footclip`, `scale-footslide`, `scale-lip`.
- **`tools/sandbox.js` `ELEMENT_IDS`:** add `"scale-tabs", "scale-tab-scale", "scale-tab-layout",
  "scale-panel-scale", "scale-panel-layout", "scale-or", "scale-next", "scale-foot", "scale-footclip",
  "scale-footslide", "scale-lip"`. Remove `"scale-layout-toggle", "scale-adjust-back",
  "scale-adjust-title", "scale-adjust-head", "scale-pancol", "scale-layout-row"` (only those present on
  dev). The sheet-guidance rule "no served id is removed" (test "SG: N-A3 no served id is removed and
  the wrapper is markup-only") lists ids by name; if any removed id is in its list, section 5.3
  rewrites that test with a reason.

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

When `boxOk` turns true while the user is on Layout (it cannot, since inputs live on Scale), nothing
special happens. When the user returns to Layout after fixing the scale, the controls are enabled and
the hint is hidden.

### 3.6 Pan size on the Layout tab (A5)

The clamp is kept from P (S3): `width:clamp(160px, min(100cqw, calc(100cqh - var(--adj-reserve))), 480px)`.

`--adj-reserve` is re-measured as the panel chrome below and above the plate inside `surf`: tab strip
(44 + `--sp-4` gap), hint/status line, the drawer rows and the footer.
- The plan sets `--adj-reserve:300px` for the narrow layout.
- In the existing `@container surf (min-width:600px) and (min-aspect-ratio:1/1)` block, where the
  drawer sits beside the plate, it keeps `72px` plus the 60px tab strip, so `132px`.

All px are **computed from the shipped CSS**, not measured:
- `cqw` is the `.sheetsurf` content width: viewport minus 2 x `--sp-4` side padding (44px total), capped
  at max-width 520px.
- `cqh` is `.sheetsurf` height at the dynamic viewport height.

Lane T's E2E test (section 5) measures the real values and must hold the "bigger than small pan" row.

| viewport | content width | P small pan `clamp(88px,30cqw,160px)` | P Adjust LARGE (reserve 232) | Layout tab (this plan) |
|---|---|---|---|---|
| 320x568 | 276 | 88 | 276 | min(276, 568-300=268) = **268** |
| 380x780 | 336 | 101 | 336 | min(336, 480) = **336** |
| 393x852 | 349 | 105 | 349 | min(349, 552) = **349** |
| 844x390 | 476 (max-width lifted to none under landscape <=500px high, as P) | 148 | ~290-318 | wide block: min(800, 390-132=258) = **258**, floor 160 |
| 1280x800 | 476 (520 cap) | 160 | 480 | wide block: min(476, 668) = **476** |

The Layout pan is 1.8x to 3.3x P's small pan at every viewport. At 320x568 it is 8px under P's Adjust
pan because of the tab strip. That is accepted: Adjust hid the CTA, and the Layout tab keeps it.

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

## 4. O1: bottom-note placement

### 4.1 Algorithm (A1)

Input: the ding D (always octaved, since compose already resolves it), and the bottom list
b1..bn in typed order.

```
limit = D.midi
for i = n down to 1:
  if b_i has a typed octave: m_i = its midi                     (kept as typed)
  else: m_i = highest midi with b_i's pitch class and m_i < limit,
              where limit = min(D.midi, m_{i+1}) (D.midi alone when i = n)
  next limit = min(D.midi, m_i)
then, left to right:
  if m_i == m_j for some j < i:  error "<name> is already in the bottom notes."   (existing)
  else if m_i < m_{i-1}:         error composeLower(b_i, b_{i-1}) "X is lower than P: list low to high." (existing)
info: "Octaves guessed: <placed unoctaved notes>. Type an octave to change a guess."  (existing text)
```

Rules:
- "Strictly below both" uses `min(D, right neighbour)`. An unoctaved note is therefore never above the
  ding, even beside a typed note that is (A1).
- The duplicate check runs before the order check, so "A2 a" reports the duplicate.

Worked examples (ding D3 unless stated):

| input | placement (right to left) | result |
|---|---|---|
| `g a b c` | c < D3 → C3; b < C3 → B2; a < B2 → A2; g < A2 → G2 | G2 A2 B2 C3 |
| `c d e f g` | g → G2; f → F2; e → E2; d → D2; c → C2 | C2 D2 E2 F2 G2 |
| `g A2 c` | c → C3; A2 kept; g < A2 → G2 | G2 A2 C3 |
| `c E2` | E2 kept; c < E2 → C2 | C2 E2 |
| `g A3 c` | c → C3; A3 kept; g < min(D3, A3) → G2 | G2 A3 C3: A3 then C3 descends → **"C3 is lower than A3: list low to high."** |
| `A2 a` | a < D3 → A2; A2 kept | A2 A2 → **"A2 is already in the bottom notes."** |
| ding F3, `c Db4` | Db4 kept; c < min(F3, Db4) → C3 | C3 Db4 |
| ding F3, `C3 Db3 Eb3 Bb3 Db4 Ab5` (Pygmy, all typed) | all kept | unchanged, C3 Db3 Eb3 Bb3 Db4 Ab5 |

**Line to fields (DI 2.3).** The line `(D3) [g] [a] [b] [c] A3 ...` places its bracketed unoctaved notes
by the same rule, so the line reads `[G2] [A2] [B2] [C3]`. The mirror then writes the explicit octaves
back into BOTTOM NOTES as `G2 A2 B2 C3` (`formatSeed` always writes octaves).

### 4.2 Code sites and compatibility (A2)

Checked on `origin/dev`:
- `core.formatSeed` always writes an octave on every field (`"[" + fields[id][0] + fields[id][1] + "]"`).
  Every stored record (v4 shape, `formatSeed` plus options) and every v4/v5 share link
  (`share.js`, "core.formatSeed <-> the link's scale segment") therefore carries octaved bottoms
  only, and is unaffected by any rule for unoctaved input.
- v1-v3 links decode through `HPE.core.parseLegacySeed` (`share.js`,
  `version <= 3 ? parseLegacySeed : parseSeed`). Frozen legacy strings can carry unoctaved bottom
  notes. They are placed by `core.validate`'s `nearestToDing` (first bottom) and `nextAbove` (the
  rest). Changing `nearestToDing` would change what an old link or a boot-rewritten legacy record
  decodes to, and could move a deck id.

**Decision: `src/engine/core.js` does NOT change.** `nearestToDing`, `parseSeed` and `parseLegacySeed`
keep their behaviour. "every frozen legacy string keeps its deck id" (`tests/core.test.js`) and
"SV: the five built-in decks' v5 links are pinned" (`tests/share.test.js`) stay green and unedited.

The rule is confined to the sheet path, in `src/engine/importer.js`:
1. `composeBottoms(notes, ding)` is rewritten to 4.1. This is the fields path through
   `HPE.importer.compose`.
2. New `HPE.importer.placeLineBottoms(text)` returns the line with each unoctaved bracketed note given
   its 4.1 octave, or the text unchanged when there is no ding or no unoctaved bracket.
   - The sheet's line handlers call it before `HPE.core.parseSeed`. These are the `scaleBox` input path
     in `index.html` (the `parseSeed(String(scaleBox.value || ""), layoutOptions())` call sites inside
     the sheet's parse, layout and generate handlers).
   - Share decode, boot, records and `interpret` (the import row) do not call it.

Because this is an engine-module change:
- run `python3 tools/inline_engine.py`;
- run `node tools/regen_engine_corpus.js` if `tests/fixtures/engine_corpus_v1.json` covers `compose`
  (lane E checks `--check` first and regenerates only on drift);
- `tools/validate.py` check 4 must pass.

### 4.3 Existing tests that pin current behaviour

These live in `tests/import.test.js`, and lane E rewrites each in the same PR with the reason "O1
(owner 2026-10-19)":
- `IH: compose ... (info lines)`, the block asserting `two.info.bottom` = "Octaves guessed: C3, Eb3.
  ..." and `mixed.info.bottom` = "Octaves guessed: Eb3. ...". With ding F3 these stay C3 / Eb3 (both
  below F3, ascending), so they are **unchanged**. Lane E confirms they pass untouched and does not edit
  them if so.
- The test asserting `r.info.bottom` = "Octaves guessed: C3, Db3, Eb3, Bb3, Db4, Ab4. ..." (Pygmy with
  unoctaved bottoms) **changes**. The old upward build gave Bb3 Db4 Ab4 above the ding. Under O1 every
  unoctaved note goes below F3, so the run ends below F3 and the expected value is rewritten from 4.1
  (right to left: Ab < F3 → Ab2; Db < Ab2 → Db2; Bb < Db2 → Bb1; Eb < Bb1 → Eb1; Db < Eb1 →
  Db1; C < Db1 → C1), giving "Octaves guessed: C1, Db1, Eb1, Bb1, Db2, Ab2.". The test title is kept;
  only the expected string changes, and the commit names O1.
- "IH: compose refuses bottoms out of order with "X is lower than Y: list low to high.", refuses a
  repeated bottom, and accepts a bottom copy of a rim pitch": its `order` / `repeat` / `typedLow`
  inputs are rechecked against 4.1. Any expectation that moves is rewritten to the 4.1 result. The
  three refusal kinds stay asserted, so nothing is weakened.
- `tests/app.test.js` "BOTTOM NOTES: Octaves guessed: C3, Eb3. ..." (sheet field message): ding F3 with
  C Eb, so it is unchanged.
- Mutant `tests/mutants/ih_e_bottom_order_unchecked.patch`: its anchor line is re-checked with
  `git apply --check`. If the rewrite moves the order check, the patch is re-anchored on the new line
  (memory "Hand-regenerated mutants drift"), and its `# kills:` stays.

## 5. Test plan (TDD: tests first, red, then implement)

Sandbox tests are in `tests/app.test.js`, engine tests in `tests/import.test.js`, and real Chrome tests
in `tests/e2e.test.js`. Prefixes: `O1:` (engine and sheet placement), `TB:` (tabs), `OR:`, `LP:` (lip).

### 5.1 Engine (`tests/import.test.js`)
- "O1: compose places unoctaved bottoms right to left below the ding: D3 g a b c gives G2 A2 B2 C3" — asserts the line and the info names G2, A2, B2, C3.
- "O1: an ascending unoctaved run ends below the ding: D3 c d e f g gives C2 D2 E2 F2 G2"
- "O1: a typed bottom octave is kept and its unoctaved neighbours go below it: D3 g A2 c gives G2 A2 C3, D3 c E2 gives C2 E2"
- "O1: an unoctaved bottom never sits above the ding beside a typed one that does: F3 c Db4 gives C3 Db4"
- "O1: a typed list that does not ascend after placement refuses with composeLower: D3 g A3 c says C3 is lower than A3"
- "O1: a placed note equal to a typed one refuses as a repeat: D3 A2 a says A2 is already in the bottom notes"
- "O1: Pygmy's bottoms typed with octaves are unchanged: F3 C3 Db3 Eb3 Bb3 Db4 Ab5"
- "O1: placeLineBottoms gives unoctaved bracketed notes their O1 octave and leaves octaved ones and a ding-less line unchanged"
- "O1: core.parseSeed still places an unoctaved bracketed note by nearestToDing" — pins the A2 confinement: `(D3) [g] A3` through `parseSeed` alone still reads G3.

### 5.2 Sandbox (`tests/app.test.js`)
- "O1: typing g a b c in BOTTOM NOTES with ding D3 writes [G2] [A2] [B2] [C3] into the line"
- "O1: typing (D3) [g] [a] [b] [c] A3 in the line writes G2 A2 B2 C3 back into BOTTOM NOTES"
- "O1: a share link and a stored record with octaved bottoms open unchanged after the sheet rule" — boots a v5 link and a stored record, and asserts no `placeLineBottoms` call and identical fields.
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
- "TB: ELEMENT_IDS carries the seven tab, OR and NEXT ids and the four lip ids, and none of the retired adjust ids"
- "OR: #scale-or sits between #scale-fields and the scale line, is a separator named or, and is not a Tab stop"
- "LP: the lip's aria-label names the visible primary: Show NEXT, Show GENERATE CARDS, Show SAVE CHANGES"
- "LP: a tab switch or NEXT clears lipshut with lipnow and re-baselines the scroll"
- "LP: while lipshut the footer stops are replaced by #scale-lip in the Tab order on both tabs"
- Lane L's A1-A19 sandbox titles (ux plan section 8) are carried verbatim. Each title that names "GENERATE CARDS" as the primary is re-run once per primary (NEXT, GENERATE CARDS, SAVE CHANGES) by its existing loop.

### 5.3 Real Chrome (`tests/e2e.test.js`)
- "TB: at 320x568, 380x780, 393x852, 844x390 and 1280x800 the Layout pan is wider than the old small pan clamp(88px, 30cqw, 160px) and at least the section 3.6 width minus 2px"
- "TB: at 380x780 the four note fields and the scale line take the full content width on the Scale tab"
- "TB: at 380x780 Add: type a scale, NEXT, adjust anchor, GENERATE CARDS opens the deck, and one Back from the deck leaves no sheet entry"
- "TB: at 380x780 Edit: SAVE CHANGES from the Layout tab saves and the bar ends on the deck's route"
- "TB: at 320x568 the tab strip, both tabs and NEXT are 44px targets with no horizontal scroll"
- "OR: at 380x780 the OR rule spans the content width between the fields and the scale line"
- "LP: at 380x780 scrolling the Scale panel collapses the footer to the lip and a tap on the lip restores NEXT"
- "LP: the lip slide takes 180ms and is instant under prefers-reduced-motion; tab switches have no transition"
- "TB: at 380x780 with the keyboard up the head and tab strip hide and the footer stays above the keyboard"
- Lane L's E1-E12 titles are carried verbatim, re-based on the tabbed footer.

**Retired or rewritten (each with a reason, never weakened silently):**
- Lane P's tests asserting the small pan beside the fields, `showAdjust` / `enterAdjust` /
  `#scale-adjust-title` focus, the `{adjust:true}` history entry and its popstate branches, and P's
  e2e small-pan width rows.
  - Reason: S1, S2, S4. Retired for P's DEV-only behaviour, which never reaches main.
  - Their replacements are the TB tests above. The lane removes them by exact title and lists each
    retired title in its PR body.
- "SG: N-A3 no served id is removed and the wrapper is markup-only": if its list contains a retired id,
  that id is removed from the list with reason S2 / S5. The rest of the assertion is kept.
- DI 2.4 Tab-order tests that list `drawerBtn`: rewritten to the 3.3 lists (S12).

### 5.4 Mutants (`tests/mutants/`, no `index` lines, `.`-wildcard `# suite:`)

| file | change | `# kills:` | `# suite:` |
|---|---|---|---|
| `o1_bottom_left_to_right.patch` | place left to right from the ding's octave (old rule) | O1: compose places unoctaved bottoms right to left below the ding: D3 g a b c gives G2 A2 B2 C3 | `O1:.compose.places` |
| `o1_limit_ignores_ding.patch` | `limit = m_{i+1}` without `min(D, ...)` | O1: an unoctaved bottom never sits above the ding beside a typed one that does: F3 c Db4 gives C3 Db4 | `O1:.an.unoctaved.bottom.never` |
| `o1_typed_octave_replaced.patch` | an octaved note also gets placed | O1: a typed bottom octave is kept and its unoctaved neighbours go below it: D3 g A2 c gives G2 A2 C3, D3 c E2 gives C2 E2 | `O1:.a.typed.bottom.octave` |
| `o1_line_prepass_skipped.patch` | the sheet line handler skips `placeLineBottoms` | O1: typing (D3) [g] [a] [b] [c] A3 in the line writes G2 A2 B2 C3 back into BOTTOM NOTES | `O1:.typing..D3.` |
| `o1_core_rule_leaked.patch` | `nearestToDing` takes the O1 rule | O1: core.parseSeed still places an unoctaved bracketed note by nearestToDing | `O1:.core.parseSeed.still` |
| `tb_tab_pushes_history.patch` | the tab switch calls `pushState` | TB: a tab switch pushes no history entry and calls no replaceState | `TB:.a.tab.switch.pushes` |
| `tb_back_returns_to_scale.patch` | Back on Layout selects Scale instead of closing | TB: Back, Escape and a popstate close the sheet from the Layout tab exactly as from the Scale tab, with one history.back | `TB:.Back..Escape` |
| `tb_next_validates.patch` | NEXT disabled while `!boxOk` | TB: NEXT shows only in Add on the Scale tab, is enabled in every scale state, selects Layout and focuses the Layout tab | `TB:.NEXT.shows` |
| `tb_roving_two_zeros.patch` | both tabs `tabindex=0` | TB: ArrowRight, ArrowLeft, Home and End move and activate the tabs, wrap, and keep exactly one tabindex 0 | `TB:.ArrowRight` |
| `tb_layout_controls_enabled_invalid.patch` | drawer controls enabled with `!boxOk` | TB: the Layout tab with an empty or invalid scale shows the hint, the empty plate and every drawer control disabled and out of the Tab order | `TB:.the.Layout.tab.with` |
| `tb_pan_small_on_layout.patch` | Layout pan uses `clamp(88px,30cqw,160px)` | TB: at 320x568, 380x780, 393x852, 844x390 and 1280x800 the Layout pan is wider than the old small pan clamp(88px, 30cqw, 160px) and at least the section 3.6 width minus 2px | `TB:.at.320x568` |
| `lp_label_fixed.patch` | lip label always "Show GENERATE CARDS" | LP: the lip's aria-label names the visible primary: Show NEXT, Show GENERATE CARDS, Show SAVE CHANGES | `LP:.the.lip.s.aria.label` |
| `lp_tab_keeps_lipshut.patch` | a tab switch leaves `lipshut` | LP: a tab switch or NEXT clears lipshut with lipnow and re-baselines the scroll | `LP:.a.tab.switch.or.NEXT` |

Lane L's `uxl_*` mutants are carried, re-anchored on the lane T code.

## 6. Lanes (/swarm)

`index.html` cannot split, so the tabs, OR rule, lip and the sheet's O1 line hook are one lane. The
engine is a separate file-ownership boundary.

### Lane E: engine O1
- **Base:** origin/dev. Branch `claude/sheet-tabs-e`.
- **Owns:** `src/engine/importer.js`; the `<!-- engine:importer -->` region of `index.html`, written
  only by `tools/inline_engine.py`; `tests/import.test.js`;
  `tests/fixtures/engine_corpus_v1.json` (regen only); `tests/mutants/o1_bottom_left_to_right.patch`,
  `o1_limit_ignores_ding.patch`, `o1_typed_octave_replaced.patch`, `o1_core_rule_leaked.patch`;
  re-anchoring `ih_e_bottom_order_unchecked.patch`.
- **Acceptance:** 5.1 green; 4.3 rewrites done with reasons; `core.js` byte-identical to origin/dev;
  "every frozen legacy string keeps its deck id" and "SV: the five built-in decks' v5 links are pinned"
  green unedited.
- **Verify:**
  ```
  python3 tools/inline_engine.py --check && node tools/regen_engine_corpus.js --check && node --test tests/import.test.js tests/core.test.js tests/share.test.js && python3 tools/validate.py && git diff --exit-code origin/dev -- src/engine/core.js
  ```
- **Non-goals:** no `index.html` edit outside the engine region, no `core.js` or `share.js` edit, no UI.

### Lane T: tabs, OR, lip and the sheet O1 hook (after lane E is on dev)
- **Base:** origin/dev after lane E's dev merge. Branch `claude/sheet-tabs-t`.
- **Owns:** `index.html` outside engine regions and outside the DECKS line; `tools/sandbox.js`
  (ELEMENT_IDS); `tests/app.test.js`; `tests/e2e.test.js`; `tools/probe/panel_fit.js` only if the
  sheet change moves a panel control (expected: no change); `tests/mutants/tb_*`, `lp_*`,
  `o1_line_prepass_skipped.patch` and the carried `uxl_*`.
- **Acceptance:**
  - 5.2 and 5.3 green;
  - 5.3's retirements listed by exact title in the PR body;
  - `node tools/sync_decks.py --check` reports no drift;
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

Lanes are serial (T depends on E's `placeLineBottoms`). There is no parallel `index.html` lane.

### 6.4 Gates (owner's dev-first rule)
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
3. Clear the line, then type `(D3) [g] [a] A3 C4`. BOTTOM NOTES shows `G2 A2`.
4. Scroll down. The footer slides to the lip. Tap the lip and NEXT returns.
5. Tap NEXT. The Layout tab opens with a pan much larger than the old small pan. Tap anchor and mirror,
   then GENERATE CARDS. The deck opens.
6. **Add again.** Tap Layout with nothing typed. It shows "Type a scale to adjust its layout.", the
   controls are greyed and GENERATE CARDS is off.
7. On Layout press the phone's Back. The sheet closes, and it does not return to the Scale tab.
8. **Edit the deck from step 5.** SAVE CHANGES shows on both tabs. Change a note, switch to Layout, SAVE.
9. **Rotate to landscape.** The Layout pan is about 258px, and the tabs still fit.
10. **Settings > Accessibility > Reduce Motion on.** The lip and tab switches are instant.
11. Open the Pygmy deck's Edit. Its bottom notes `C3 Db3 Eb3 Bb3 Db4 Ab5` are unchanged.

## 7. Open questions (real forks only, recommendation first)

**Q1. Should the O1 rule also apply when an old v1-v3 share link or legacy string carries an
unoctaved bottom note?**
- **Recommended: (a) no, sheet path only.** The deck a person already shared or stored keeps its
  notes, and the two pinned tests stay green unchanged.
- (b) Yes, change `core.nearestToDing` too. This rewrites what some old links decode to and can move a
  legacy deck id.

Everything else is decided above:
- tab switches push no history;
- Back from Layout closes the sheet;
- NEXT is never disabled;
- the Layout tab is the only place the pan draws;
- the lip is kept from L.

## Appendix: self-check (R1-R8)

| line | score | evidence |
|---|---|---|
| R1 Owner fidelity | 10 | O1 (both inputs, per A1), O2 OR rule, O3 two tabs with NEXT / GENERATE / SAVE CHANGES and an always-tappable Layout, O4 lip folded in, P DEV-only and #408 closed; nothing else added (accessibility, history and lip mechanics are delivery per A3). |
| R2 Grounding | 10 | Every current-code claim names an id or function on origin/dev (`composeBottoms`, `nearestToDing`, `formatSeed`, `showAdjust`, `closeScaleSheet`, `#scale-guidance`, `ELEMENT_IDS`); new ids are listed as new. |
| R3 State completeness | 10 | Section 3.8 defines every flow x tab x state x keyboard cell, plus the 3.3 CTA table and focus rules. |
| R4 Constraint safety | 10 | `core.js`, share, DECKS and deck data are untouched; engine regions are changed only through `inline_engine.py`; the history model keeps one sheet entry with `pendingPop` / `syncRoute`. |
| R5 Testability | 10 | Every behaviour has a verbatim title; 13 mutants cover each risky branch, each with one `# kills:` and a `.`-wildcard suite; retirements are named with reasons. |
| R6 Swarm shape | 10 | Two lanes split on the engine / `index.html` boundary, serialised with the reason given, each with owns, acceptance, verify and non-goals; the dev-first gates and phone steps are included. |
| R7 Design quality | 10 | Existing tokens and `.mode`; 44px targets; 320 and 380 covered by tests; the Layout pan is 1.8-3.3x the small pan (3.6); the OR rule is the panel's only full-width rule. |
| R8 Decisiveness | 10 | One real fork (legacy compatibility), with a recommendation; the rest is decided with rationale. |
EOF'