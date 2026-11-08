# Print controls: one style for DOWNLOAD PDF and the paper dropdown

Status: QUEUED, P2 (owner 2026-11-07). Not started.
Trigger: after the editor RC refresh (#912) and the Serenity template rebuild (TRI-70) lanes finish.

## Goal
In the menu's "Print this scale" row, the DOWNLOAD PDF trigger (`#print-download`, a button
opening `#print-menu`) and the paper dropdown (`#print-paper-select`, a native `<select>`)
look like two different kinds of control. Give them one style.

## Non-goals
- No change to what either control does: `togglePrintMenu`, `downloadDeckPDF`, `setPrintPaper`,
  the paper storage key, the menu items and the PDF output stay the same.
- No change to other `.prints`, `.modebar` or `#lang-select` controls except where they share the rule being edited (see R1).
- No new labels. If a label changes, it needs an i18n step and the owner's say.

## Decision (recommendation, AFK default; gated on P0)
Both controls already share one CSS rule set (`appearance:none`, font, colours, border, padding,
44px floor); the only rule difference is `#print-download{flex:3 1 auto; padding 6px}` (review F1).
So the mismatch the owner sees is not in the shared rules. Possible causes: a platform rendering
(iOS Safari select), the width ratio, or a missing "opens a choice" cue on one control. P0 finds the
real cause; the fix follows that evidence:
- (a) Platform rendering differs: add per-platform resets to the select only.
- (b) A choice cue is missing: add one shared chevron, scoped by id to `#print-download` and
  `#print-paper-select` only (never `.prints button`, which also styles the menu items; F3). Draw it
  as follows: `#print-download` gets a `::after` with `mask-image` + `background-color:currentColor`;
  the select gets per-theme `background-image` data URIs (#a9a39a dark, #242424 light). Convert every
  `background:` shorthand touching these two ids to `background-color`: hover, focus, `:active`
  (light panel `#F6F4ED`), the panel themes and the dark desktop `@media (min-width:1024px) and
  (min-height:700px)` block (F2, G2). Padding stays symmetric so the label stays centred (G3).
- (c) Width ratio: equal flex, but only if every locale still fits in the print-row MEASURE test.
**Superseded 2026-11-08 (owner, iPhone screenshot):** the native paper select opened the grey iOS popup beside our white DOWNLOAD PDF menu. Owner chose a CUSTOM MENU FOR BOTH: `#print-paper` button + `#print-paper-menu` (LETTER, A4), shipped on `claude/print-controls-style`. This overrides the paragraph below.

Keep the native select in every case (mobile picker, keyboard). Rejected: a custom menu for paper
(more JS and focus work for a cosmetic gain).
If P0 shows none of (a)-(c), stop and ask the owner with screenshots.

## Assumptions
- A1 (gated by P0): the cause is one of (a)-(c) above.
- A2 (verified): `#lang-select` is in every shared rule; leave it untouched (R1).

## Phases
P0 Evidence (lane, read-only):
- Screenshot the row on main at 375px and 1280px, light and dark panel themes, Chrome and iOS Safari
  (owner's iPhone screenshot if no simulator; owner action, asked at P0 start; G4).
- Dump computed styles of both controls, including hover.
- Deliverable: cause named as (a), (b) or (c), with screenshots. Acceptance: the owner's complaint is
  visible in the screenshots.

P1 Fix (lane, TDD):
- Test first in tests/e2e.test.js: both ids have equal computed height, font, border, background-color
  and the cue (for (b): `::after` mask on the button, background-image on the select, each present in
  both themes, on hover, on `:active` and at the desktop breakpoint; F4, G1). Menu items have no cue.
- Then the CSS-only change in index.html, scoped by id.
- Must still pass the existing select label-centring test (2px tolerance) and the per-locale print-row
  MEASURE test (trigger width, row height, spill) (F5); run both locally with real fonts (R4).
- Update the "DOWNLOAD PDF is a menu" entry in docs/CARD-SPEC.md (F7).
- Verify: `node --test tests/app.test.js`, the three e2e tests with CHROME_BIN, `python3 tools/validate.py`.

P2 Ship:
- Main PR M (held) and dev PR D; validate green at the exact head with scoped mutation.
- Independent reviewer on M; D merges; check served DEV. Owner looks at DEV (iPhone) before M is released.

## Verification
- Automated: the new parity test plus the centring and MEASURE tests, and validate.
- Self: before and after screenshots, both themes, hover.
- Independent: reviewer at the verified head.
- Human: owner DEV check on iPhone.

## Risks and edge cases
- R1: shared selectors include `#lang-select`; scope edits by id.
- R2: background shorthands reset images on hover and in themes (F2).
- R3: no chevron rotation when the menu is open.
- R4: CI blocks web fonts; check fit with the real fonts locally.

## Recovery
CSS-only. Revert the commit.

## Continuation point
Start P0 on a fresh `claude/print-controls-style` worktree from main.

## Stop
The plan is queued. Implementation starts only when the trigger is met.

## Review log
2026-11-07 independent eng+design review: NOT READY.
- F1 high: A1 is false. `appearance:none` and the font, colour, border, padding and 44px floor are already shared by `.prints button, .prints select, #lang-select` (index.html CSS just after `.prints #print-menu button`). No UA arrow exists today. The only rule-level differences are `#print-download` flex:3 and 6px side padding. Re-derive the mismatch in P0 (screenshots, iOS included) before fixing the Decision.
- F2 high: every `background:` shorthand on hover, focus and the #settings-panel themes (dark block plus the light block near `#settings-panel .mode, #scale-sheet .mode`) resets `background-image`, so a background-image chevron would disappear on hover and focus and in the panel themes. Use `background-color` overrides or `mask-image` + currentColor on a wrapper, and test the hover state.
- F3 high: a chevron on `.prints button` would also land on the #print-menu items (EASY / EASY + MEDIUM / ALL). Scope it to `#print-download` and `#print-paper-select` by id.
- F4 medium: P1's test asserts a "chevron pseudo-element", which contradicts R2 (a select has no ::after; use background-image). Pick one mechanism and assert it, e.g. a computed background-image or mask-image on both ids, in each theme and on hover.
- F5 medium: existing e2e already covers these controls: the label-centring test (checks paper select text-align and text-align-last) and the per-locale print-row test (trigger width, row height, item spill). Chevron padding can break the centring check. The plan must list both as constraints and run them.
- F6 medium: data-URI colours are fixed, but the chevron needs #a9a39a in dark and #242424 in light. Pick per-theme URIs or currentColor via a mask.
- F7 low: this is a design-system change, so record it in docs/CARD-SPEC.md (the "DOWNLOAD PDF is a menu" entry) in the same lane.

### Round 2
2026-11-07 independent eng+design review: READY (no open blocker/high). F1-F7 addressed: F1 (Decision now says rules are shared, P0 derives cause, stop-and-ask if none), F2 (background-color conversion), F3 (id scoping), F4 (one asserted cue, themes + hover), F5 (centring + MEASURE listed and run), F6 (per-theme colours), F7 (CARD-SPEC step). Remaining:
- G1 medium: Decision (b) mechanism sentence is garbled ("a `background-image` on the select set via `background-color`-safe rules"). State it plainly: button gets a `::after` with `mask-image` + `background-color:currentColor`; select gets per-theme `background-image` data URIs (#a9a39a dark, #242424 light) plus right padding. P1's test then asserts the mechanism per element (mask-image on `#print-download::after`, background-image on the select), not "the same" property on both.
- G2 medium: F2's list omits the `:active` shorthands (`.prints button:active` light-panel block `background:#F6F4ED`) and the dark `@media (min-width:1024px) and (min-height:700px)` block, which also use `background:`. Name both in (b) and test `:active` plus the desktop breakpoint.
- G3 low: a chevron's right padding shifts the centred label; say whether symmetric padding is used so the 2px centring test still holds rather than being loosened.
- G4 low: P0 acceptance relies on the owner's iPhone screenshot if no simulator; mark it as an owner action in the queue so P0 does not stall silently.
- Owner decision 2026-11-08: custom menu for both controls; no chevron; native select dropped. P0 finding stands (Chrome looked alike; the mismatch was the native iOS popup).
