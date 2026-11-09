# Editor control-panel simplification (two tabs: Scale | Layout)

Status: READY_WITH_NITS (independent review, round 9, 2026-11-09). Earlier: REVISED (round 6) 2026-11-09. Owner answers recorded in section 15: Q1-Q9 all answered (Q9: Rotate dropped), plus the round-6 answers (R6 below): "#1 centred" and "#1 / #2" stay two buttons; the Neotone "#1 / #2" engine work is a separate lane PL-b in the same editor release; then (owner 2026-11-09, SUPERSEDES the Mirror Top/Bottom split) the editor Mirror Top / Mirror Bottom controls are DROPPED on BOTH profiles and Rotate stays dropped (Rotate left/right by one note is a P3 future idea, not tracked or scheduled). The Layout tab is just the two anchor buttons. OWNER-VISIBLE SCOPE CHANGE: this removes the editor Mirror controls (live on dev since #996) from the successor of RC #912; the app-wide MIRROR feature (layout sheet, engine, saved and shared layouts) is untouched. Question numbers cited inside the review and disposition logs are HISTORIC (pre-renumbering); section 15 is authoritative. SECTIONS 1-16 ARE THE CURRENT PLAN; section 17, the eng review and the review rounds 2-6 are the review logs and are SUPERSEDED by the body (their verdict lines describe the earlier drafts); every finding has a disposition in the Disposition log at the end. Blocking items: none of Q1-Q8; the editor RC must pass owner manual QA before any panel M can merge. Facts marked "exists on dev" were read at origin/dev 8d08667a and are re-verified at the successor SHA in P0. Plan only. No code, no commits, no Linear or GitHub writes made.
Refs: TRI-59 (scale editor). Code facts below were read from `origin/dev:index.html`
on 2026-11-08 (`git show origin/dev:index.html`); anchors are symbol names, not lines.
Approved mock (illustrative only; its pan, bottom ring and caps are not the real ones):
`/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/86550be0-8308-46ce-9e79-1d7585ec807b/scratchpad/editor_panel_a.html`.

## 1. Goal

Replace the stacked control panel under the pan in the one-panel scale editor with two
tabs, Scale and Layout, so the pan stays visible and the controls shrink to what a
player needs, without changing how the pan looks or how notes are dragged, dropped,
held, tapped or moved.

## 2. Non-goals

- No change to the pan SVG, its rings, note rendering, hit targets, `EDITOR_SCALE`,
  `EDITOR_HIT_AREA`, `editorHitAt`, `editorDropPlan`, `editorNeoDropPlan`, drag code
  (`editorDragDown` to `editorDragEnd`), or the model (`editorPlace`, caps logic,
  Neotone fixed fields).
- No auto-fill of the rim. No "Add to" pills. No caps change (dev caps stay rim 12,
  cyclops 6, bottom 12, per `EDITOR_CAPS`).
- No deck data, share-link, saved-scale, or `#s=` change. No new analytics events.
- `ONE_PANEL` is not turned into a user-facing toggle and not touched by this work (see 5.8).
- No implementation, no main merge in this plan. No audio, stats, PWA.

## 3. Decisions with sources

All owner-approved in chat and artifact comments, 2026-11-08, unless marked.

| # | Decision | Source |
|---|---|---|
| D1 | Option A: two tabs, Scale and Layout | owner, artifact comment |
| D2 | Handpan visible on both tabs at all times | owner |
| D3 | Scale tab, in order: scale name field first, then the 12 chromatic note chips, then the octave row | owner |
| D4 | Sharps/Flats is a two-state toggle on the octave row (replaces the single `#editor-flats` button) | owner |
| D5 | No "Add to" pills; zone counts shown as labels: Rim n/12, Cyclops n/6, Bottom n/12, Ding 1/1 (Neotone: see 5.4) | owner |
| D6 | Redo, Remove selected, Reset spacing, Delete live in a "..." more menu; Delete removes the whole scale | owner |
| D7 | The Layout tab holds only the two anchor buttons "# 1 centered" and "#1 / #2", the same on both profiles; editor Mirror Top/Bottom and Rotate are dropped (Q8, Q9, Q10, lane PL) | owner |
| D8 | Neotone is chosen with the header switch (existing `#editor-type-*` group) | owner |
| D9 | Tapping a tray chip HOLDS it; tapping a pan spot places it (as on the branch). No rim auto-fill | owner |
| D10 | HARD: drag and drop unchanged on the branch; handpan visual UI and UX (rings, note rendering, hit targets) unchanged | owner |
| D11 | HARD: `ONE_PANEL` must not ship as a toggle | owner |
| D12 | Dev first; no main merge | owner, CLAUDE.md |

All owner questions in section 15 are answered (2026-11-08). The approved mock is
illustrative for the panel only; its violet hot ring, "drop on a full ring fills the next open
slot" and shaking count are NOT specs (they would change drag feedback, D10).

## 4. Verified code facts (origin/dev)

Read, not recalled:

- `editorOpen` builds the whole editor DOM imperatively: head (`editor-back`, title,
  `editor-type` group, `editor-delete` only when editing), `#editor-line` (editable
  scale-notes string via `editorStartEdit`, NOT a name), `#editor-status` (aria-live), `.editor-panbox` with
  `#editor-pan`, `#editor-areas` (`#editor-pills` three ring pills plus
  `#editor-replace-ding`, `#editor-hint`), `#editor-layout` (mirror top/bottom, anchor
  one/between, Neotone rotate ccw/cw; the mirror pair and the rotate pair are removed by lane PL, Q9/Q10), `.editor-toolbar` (undo, redo, remove, reset,
  save), `#editor-tray` (`#editor-notes` 12 `.tray-note`, octave row with
  `#editor-oct-down/up`, `#editor-flats`, `#editor-palette`, `#editor-swatches`),
  `#editor-dialog`.
- `ONE_PANEL` is already `true` on dev (`const ONE_PANEL = true ;`). The editor opens
  via `if (ONE_PANEL) editorOpen(...)`. `tests/helpers/editor_flag.js` rewrites that
  exact line to produce flag-off builds; the one-line shape is load-bearing for it.
- `EDITOR_CAPS = { rim: 12, inner: 6, bottom: 12 }`, applied only when
  `!m.options.profile` (`editorPlace`), so Neotone is uncapped by the model.
  `NEO_MAIN = 9`, `NEO_SLOTS = 18` (9 main fields, 9 mutants).
- Pills: `editorRenderAreas` hides `#editor-pills` for Neotone; `editorPillTap(ring)`
  places a held note via `editorPlaceHeld`, moves a selection via `editorMoveSelected`,
  else says "pick a note first" or "zone is full". Removing pills removes only this path;
  the same placements stay reachable by pan tap (`editorPanTap` to `editorHitAt` kind
  `spot`) and by drag.
- Placement logic is already isolated and pure enough to freeze: `editorDropPlan(m, src,
  target)` returns `{step, say}`, `{trade}`, `{refuse}`, `{snap}`, or `{info}` (the `{info}` result comes only from `editorDingButtonPlan`, which calls
  `editorDropPlan`, not the reverse; it is retired with the button, Q5). Tap, pill and drag route through it.
- Drag: `editorDragDown` is bound by `pointerdown` on `#editor`; sources found by
  `editorDragSource` (tray chips are `.tray-note` inside `#editor-tray`, pan notes
  `.ehit`). `editorDragLift` adds `#editor.dragging`, which slides `#editor-areas`,
  `#editor-layout`, `.editor-toolbar`, `#editor-tray` down and hides them, and
  `editorDragMeasure` magnifies `.editor-panbox` using the room below it
  (`root bottom - padding - panbox bottom`). `touch-action:none` is set on
  `#editor-pan svg` and `.tray-note` under `.dragtouch`.
- Keyboard and a11y on dev: `editorPanKey` (Enter/Space select or place, arrows move
  focus, Left/Right nudge a selected pinned note, Home/End), roving `tabindex` via
  `editorPanFocus`, `editorTabStops` (focus trap scope), dialog `role="alertdialog"`.
- Delete exists in the head as `editorDeleteButton` / `editorDeleteTap`: two-press arm
  (`delArmed`, `.armed` red `#B3261E`), refusal when `wouldEmpty(editingId)`, a status
  note (`sheet.del_note_seeded` / `_custom`), disarm on outside `pointerdown`. Rendered
  only when editing an existing scale (`edit` truthy).
- Save: `editorSave` with `editorSaveCommand`; `#editor-save` is `.mode.primary`, styled
  `background:#242424; color:#F6F4ED` (ink, not violet) in `#editor .editor-toolbar`.
- There is NO name input in the editor on dev. A saved scale's `options.name` is carried
  through unchanged (`editorModelFor` clones `d.options`; `editorCommitOptions` keeps
  `name` for Neotone, passes `m.options` whole for Standard; `build` uses
  `seedOptions.name || autoName(...)`). The legacy sheet's `#scale-name` has
  `maxlength="40"`. So the name field is new editor model surface (5.2).
- i18n: editor strings are `editor.*` keys in `data/i18n/*.json` (eight files: de, en,
  es, fr, it, ja, zh-Hans, zh-Hant), synced into `const I18N` by `tools/sync_i18n.py`.
  Keys this change makes dead on dev: `editor.pill.*`, `editor.pill_aria.*`,
  `editor.areas.aria`; `editor.area.aria.*` and `editor.full.*` stay used.
- Existing frozen pan fixture: `tests/fixtures/pan_render_v1.json` pins the
  two-argument card `pan()` render for built-in decks only. It does not cover the
  editor's `editorWithOverlay(pan(...))` output, so lane T0 adds that.

## 5. Design of the change

### 5.1 Structure (DOM only)

Wrap, do not rewrite. The pan box, status and `#editor-line` stay where they are and keep
their ids. Below the pan, in order:

1. Counts block (5.3), outside both panels, visible on both tabs (matches the mock).
2. Hint element (R4-4): outside both panels, directly under the counts block, visible on both tabs and hidden under `.dragging` (5.5). Two English lines verbatim: "Tap a note to hold it, then tap a ring on the pan, or drag it onto the pan." and "Drop or tap a note on the ding to swap it with the root." Replaces `editor.hint` (key retired, new keys added in all eight tables). It also carries the ding "what it does" text, so the SVG ding label stays untouched (R4-3).
3. Held banner: the existing `editor.held` status with Cancel (`#editor-cancel`) lives in
   `#editor-status`, which is outside both panels, so the held note's name and Cancel are
   reachable from both tabs.
4. Tab strip, `role="tablist"`, two `role="tab"` buttons (see tab semantics).
5. Two `role="tabpanel"` containers, same fixed `min-height` on both tabs (value taken from
   the 5.9 measurement; the mock uses 236px) so switching tabs never moves the pan or changes
   the room below it. Inactive panel is `hidden`.
6. Always-visible action row: Undo, Save, "..." (more). Redo, Remove selected, Reset spacing
   and Delete are in the menu (D6, 5.6).

Default tab (R4-4): Scale on open, after a Standard/Neotone switch and after a palette swap. Cost the owner sees: tray chips are drag sources only on the Scale tab (`editorDragSource` needs `#editor-tray`); on the Layout tab chips are not draggable, while pan-note drags and held placement still work; drag-ux E1-E7 run on the Scale tab unmodified.

Tab semantics: each tab has `aria-controls` the panel id and `aria-selected`; each panel has
`aria-labelledby` its tab; roving `tabindex` (selected tab 0, other -1); Left/Right move and
activate, Home/End jump; activation is automatic (panels are cheap). Switching tab never
clears `s.held` or `s.sel`.

Panels:
- Scale panel: name field (5.2), the existing `#editor-tray` block (12 `.tray-note` chips,
  octave row with the Sharps|Flats two-state control replacing `#editor-flats`, palette chip).
- Layout panel: the `#editor-layout` block as lane PL leaves it (D7). Owner Q8/Q10: the same two anchor buttons on both profiles (no Mirror, no Rotate); the panel code adds NO per-profile hiding. See 5.4.

Coupling rules (tested, M5): `#editor-tray` and `#editor-notes` keep their ids and DOM
ancestry; `.tray-note` chips keep their class; the 12 chips are the ONLY children of
`#editor-notes` (`editorDragSource` derives the chip index from `chip.parentNode.children`),
so the Sharps|Flats control, octave row and palette chip stay outside `#editor-notes`. The
`editorRenderPalette` swatch swap hides `#editor-notes` as today.

Existing handlers (`editorHold`, `editorUndoStep`, `editorRedoStep`, `editorRemoveSelected`,
`editorResetTap`, `editorDeleteTap`) are re-pointed, not rewritten.

Landscape (min-width 900px landscape, M3): dev's editor is a CSS grid with
`grid-template-areas:"head head" "pan ." "pan line" "pan status" "pan areas" "pan bar" "pan tray" "pan ."`.
P1 redefines the right column areas as `line`, `status`, `counts`, `tabs`, `panel`, `bar`
(the old `areas`/`tray` areas are folded into `panel`), keeps `pan` spanning all rows
unchanged, and adds a test that the pan column's rect equals the T0 landscape rect.

Targets: every tab, chip, toggle half, menu item, "..." button, name field and the existing
header Standard/Neotone group is measured to be >= 44px (the mock's 42px `.acc`/`.seg`
buttons must not be copied). At 320px the chips are 6 columns with gap 6 and padding 12
(exactly 44.0px, zero slack); fallback decided now: gap 4, or a 4x3 grid below 340px. The
octave row must not wrap at 320 in de and ja; the Sharps|Flats halves may drop the glyph
before wrapping.

### 5.2 Scale name field

New model setter (pure, undoable like other steps): `editorSetName(m, text)` writing
`options.name`; blank clears it so `autoName` applies; trimmed, max 40 characters (legacy
`#scale-name` `maxlength`). Wired through `editorApply` so Undo covers it and `editorIsDirty`
sees it. Input rules: font-size >= 16px (no iOS zoom); placeholder shows the `autoName`
result so blank is understood; commit on Enter and blur, AND `editorSave`, Back, the dialog
actions and the "..." open handler call the name commit first, so a Save tap that races an iOS
blur never loses the edit (test: type a name, tap Save immediately, saved name equals typed,
one undo step). A press on the input starts no drag, with NO change to `editorDragDown`: `editorDragSource` returns null for a target that is neither `.tray-note` nor inside `#editor-pan` (test that a press on the input starts no drag). The keyboard raising over the pan while typing
is accepted: D2 "pan always visible" applies to tab states, not to an open soft keyboard (recorded as DR2's disposition).

Two inputs (C6). `#editor-line` on dev is an EDITABLE text input that looks readonly until
tapped: `editorStartEdit` sets `s.editing` and clears `readOnly`, `editorDragDown` and the
panel handlers return early while `s.editing`, Enter/Escape/blur commit or cancel
(`editorCommitLine`, `editorCancelEdit`, `editorStopEdit`). (The first draft wrongly called it "readonly".) The
new name input is a second editable field and must not break that machinery:
- The name input does NOT set `s.editing` (that flag means "typing the scale string"); it has
  its own `s.naming` flag. `editorDragDown` and the frozen drag source are NOT edited (R4-2);
  `s.naming` is checked only in `editorPanTap` and `editorPanKey` (no pan taps while typing; a
  mutant proves it), and a press on the field starts no drag because `editorDragSource` is null there.
- Focus handoff: focusing one input commits the other first (name blur commits the name;
  focusing `#editor-line` while naming commits the name, and the reverse). Only one is active.
- Escape: in the name input it cancels the name edit and restores the stored name, stops
  propagation so the editor Back/dialog does not also fire; in `#editor-line` unchanged.
  Escape ordering: more menu, then name/line edit, then dialog, then editor.
- `editorTabStops` includes the name input (it already collects `input`); order is name
  before the tabs/chips in DOM order; the dialog trap is unchanged.
- Dirty tracking: the name is part of the model (`options.name`), so `editorIsDirty` sees it;
  `editorLineText` (the notes string) does not include the name.
- The soft keyboard and "type a name, tap Save" tests exercise the NAME input; a separate
  test exercises `#editor-line` then Save so the existing path stays covered.

Neotone: the legacy sheet appends `sheet.neotone_name_suffix`. The editor field edits the
stored `options.name` verbatim. A NEW Neotone scale is seeded with the suffixed autoName stored in
`options.name` (Q6). If the user blanks the field, nothing is stored (`options.name` cleared, as on
Standard) and the display falls back to the same suffixed autoName the sheet shows, so the editor
and the sheet always agree. The placeholder shows that suffixed autoName. N1's round-trip test
covers: seeded, edited, blanked, saved, reopened.
Whether the suffix is stored or only displayed is Q6 (owner decision), answered (stored with the suffix); the Neotone zone-label wording check in 8 languages is a P1 prerequisite.

### 5.3 Zone counts block

A read-only block directly under the pan, outside both tab panels, so it is visible on both
tabs (a Layout-tab pan tap that hits a full zone still shows the count). Four labels from
the same `ringIds(m.fields, ring)` counts and `EDITOR_CAPS` that `editorRenderAreas` uses
today: "Rim 9/12", "Cyclops 1/6", "Bottom 0/12", "Ding 1/1". Not buttons, not focus stops,
NOT `aria-live` (placements already announce through `#editor-status`). Full and over-cap
(14/12) carry a non-colour cue: bold weight plus the word "full" (`editor.zone_full` exists).
Text >= 12px with >= 4.5:1 contrast on its ground (the muted `#5E5850` on `#F6F4ED` passes;
check the dark ground). The `{zone} {n}/{max}` key must tolerate ja/zh word order. Over-cap
scales show the true count; the "caps refuse only a NEW add" rule is unchanged. Full-zone
refusal copy `editor.full.*` stays and stays tested (P1 coverage table).

### 5.4 Neotone vs Standard (explicit)

| | Standard | Neotone (`m.options.profile`) |
|---|---|---|
| Zone labels | Rim n/12, Cyclops n/6, Bottom n/12, Ding 1/1 | Fixed fields: placeholder labels Main n/9, Mutant n/9, Ding 1/1 until the P1 wording check (Q6) fixes the per-language terms. No caps, never "full" |
| Placement | `editorPlace` with caps and `TOO_CROWDED` check | `editorNeoPut` into a field slot; refusals are `editor.neo.own_row`, `editor.neo.field_empty` |
| Layout tab | Two anchor buttons only: "# 1 centered" and "#1 / #2" (they stay two buttons, not the unified plan's single toggle). No Mirror, no Rotate (dropped, Q9, Q10) | the same two; "#1 / #2" is present but disabled until PL-b lands |
| Reset spacing | per pinned ring | disabled (`editorResetLabel` already returns `enabled` false for a profile) |
| Switch | header Standard/Neotone group, unchanged | same |

The Neotone labels reuse the existing slot arithmetic (`NEO_MAIN` and the profile map);
no new constants. Neotone labels use the Neotone page's own terms per language (Q6 answered).

Layout-tab control matrix (owner Q8, superseded by Q10; the panel code never hides or adds a control by profile):

| Profile | "# 1 centered" | "#1 / #2" | Mirror Top / Bottom | Rotate |
|---|---|---|---|---|
| Standard | shown, works (`editorSetAnchor`) | shown, works | removed (Q10) | n/a (dropped, Q9) |
| Neotone, after PL-a | shown, current state, no-op | shown, DISABLED with a reason until PL-b | removed (Q10) | removed (Q9) |
| Neotone, after PL-b | works | works (wire v9 / record 7) | removed | removed |

History: Q8 (2026-11-08) asked for the same four controls on both profiles; Q9 dropped Rotate; Q10 (2026-11-09) then dropped Mirror Top and Mirror Bottom as well ("I don't find it very useful on either standard or neotone"; "rotate left or rotate right by one note is more useful but maybe something we consider as p3 in the future" - recorded as a P3 idea only, not tracked or scheduled). Lane PL-a delivers the removal AFTER T0 (green) and BEFORE P1 (section 8); P1 only re-parents the Layout block. The exact-controls assertions live in PL-a (for the row it leaves) and P1 (for the re-parented block, including "Neotone #1 / #2 disabled until PL-b"); T0 asserts no Layout control.

Round-6 owner answers kept (2026-11-09, via the coordinator): (1) "#1 centred" and "#1 / #2" stay TWO buttons; the unified plan's single `editor-anchor-toggle` is not used. (2) The Neotone "#1 / #2" engine work (share wire v9, saved record v7, approved earlier as option B of `docs/plans/2026-11-08-unified-first-toggle.md`) is a SEPARATE lane PL-b in the SAME editor release; PL-a (the UI row) ships the Neotone "#1 / #2" button present but disabled until PL-b lands. The earlier round-6 answer 3 (Neotone Mirror Top = main ring, Mirror Bottom = mutant ring) is SUPERSEDED by Q10: there is no Mirror control to define.

### 5.5 Tap, hold, drag

Unchanged logic. Tap chip -> `editorHold(k)` -> held; the status shows `editor.held`
with Cancel; tap a pan spot -> `editorPanTap` -> `editorPlaceHeld` -> `editorDropPlan`.
Drag of a chip or pan note is unchanged. The one required drag interaction with the
new DOM: `#editor.dragging` must also hide the tab strip, both panels and the action
row, so the hide selector list is extended (CSS only). The tab strip is hidden for the
duration of a drag exactly as the panel is today. The counts block and the held banner ALSO
hide during a drag (R3-6), because the scaled pan would otherwise overlap them (R4-9: `editorDragMeasure` reads rects, so the hide does not change `room`). The hint element (5.1) hides too. T0 pins VISIBILITY of these elements in the `.dragging` state, not magnification.

### 5.6 More menu and Delete

"..." opens a menu (`role="menu"`, items `menuitem`; same closed-button and popup
treatment as the existing PDF tier and paper menus so the idiom is consistent). Items:
Redo, Remove selected, Reset spacing, Delete scale. Disabled states mirror today's
(`editorCanRedo`, `s.sel` non-ding, `reset.enabled`, `!!editingId`). Escape closes the
menu only and returns focus to "...".

Menu behaviour (tested): on open, focus goes to the first enabled item; Up/Down move,
Home/End jump; Tab closes the menu and returns focus to "..."; Escape closes only the menu
and returns focus to "..."; outside pointerdown and the start of a drag close it and disarm
Delete. Disabled items stay in the menu with `aria-disabled="true"`, not removed (parity for
Neotone, where Reset spacing is disabled, not hidden). The menu is positioned to stay inside
the viewport at 320px and above the soft keyboard area.

Delete confirmation (required): Delete scale removes the whole saved scale. It is the LAST
item, under a divider, apart from Remove selected. Two-press arm kept: the first press
changes the item to an armed red (`#B3261E`) text "Press again to delete {name}" with the
name truncated by ellipsis while the verb stays visible, and shows the existing
`sheet.del_note_*` status; a second press within ~400 ms of arming is ignored (double-tap
guard); a later press calls `deleteDeck(editingId)`. Escape, outside press, drag start and
menu close disarm (`editorDisarmDelete`). `wouldEmpty` refusal keeps `sheet.del_refusal`.
Absent for a new, unsaved scale. Delete while `s.held` is set: owner Q4: allowed; the hold is kept and
is not part of the destructive path. Delete with unsaved changes
needs no extra dialog (the scale is going away); the arm text names the scale. `deleteDeck`
is unchanged.

### 5.7 Save button fill and tab state (owner decision, Q2)

PRODUCT.md: violet `#6756B5` "belongs to actions, links and states"; anti-reference
"decorative violet fills"; principle 3 inactive controls stay neutral and focus is visibly
distinct from selection. On dev everything uses the same ink fill (active tab-like state,
Standard/Neotone, Sharps|Flats, Mirror pairs, Save), so Save is indistinguishable from a
toggle state (design review DR4). The approved mock fills Save violet and underlines the
selected tab with 3px violet. Owner decision Q2 (violet Save, reverses the first draft): Save is the
single violet-filled action (`#6756B5`, white text, >= 4.5:1, disabled back to neutral, >= 44px);
selected tab = ink text plus a 3px violet underline (a state); all toggles stay ink;
focus ring stays distinct from selection. This is the only violet fill in the editor.
Verification: P1 asserts Save text/fill contrast >= 4.5:1 against `docs/plans/assets/2026-11-02-field-guide/token-check.json` pairs (R4-10); I1 re-checks the rest.

### 5.8 ONE_PANEL

Dev already has it `true`. This lane does not edit the `const ONE_PANEL` line and does
not add any runtime switch for the old panel. The tab layout is the only one-panel
layout, so there is nothing to toggle. The existing line stays byte-identical because
`tests/helpers/editor_flag.js` depends on it, and the flag-off mutants (if any) still
apply. Retiring the constant is a separate later cleanup after the editor ships; it is
listed as a continuation item, not part of this work. Release-gate check (section 13, and T0's byte test of the line): the
main release PR must have `ONE_PANEL` true with no UI or storage path that reads
a user setting for it.

### 5.9 Pan size, panel height and drag magnification (C1, A4, DR3) - Q1 ANSWERED (a)

Fact (dev CSS): `#editor .editor-panbox{flex:1 1 0; min-height:0}` and `#editor-pan svg{height:100%}`:
the pan's on-screen size is a function of the height the controls leave. Owner decision (Q1,
2026-11-08, chat): (a) the pan may grow into freed height while SVG content, ring and note
geometry and hit areas stay scale-identical. Oracle: T0 asserts SVG hashes, the `viewBox`, the
growth-proof invariants only: each `.ehit` width, height and offset (relative to the svg origin) divided by the svg's rendered scale (`getScreenCTM().a`), which must equal the fixture's viewBox-unit values, plus the `viewBox` itself. The svg-to-panbox ratio is NOT asserted (it changes when the pan grows, Q1 a). Absolute pixel rects are NOT asserted. Cost accepted by the owner: the pan's pixel
size and the rest `--ed-mag` differ from dev (bigger pan, smaller magnification factor).

Both tabs share one fixed panel min-height so a tab switch never moves the pan. P1's first step
is to measure dev and a prototype at 375x667 and 390x844 and record the pan growth and
`--ed-mag` in the PR. The "slightly taller editor" idea is withdrawn.

## 6. Assumptions (each verified or gated)

| ID | Assumption | Status |
|---|---|---|
| A1 | `editorDropPlan` and `editorHitAt` are independent of the DOM around the pan | Verified: they take `(m, src, target)` and a solved geometry; no DOM reads |
| A2 | Re-parenting `#editor-tray` inside a tab panel keeps drag working | Gated: drag-ux E1-E7 (E7 exists on dev, plus E6b, E6c and X4) and the T0 DOM-agnostic tests must pass unmodified. `editorDragSource` selectors need a read at lane start |
| A3 | Saving `options.name` for Standard flows through `buildGenerated` | Partly verified (`seedOptions.name` in the engine, `editorCommitOptions` passes Standard options whole). Gated: lane N1 adds a failing round-trip test first (name typed, saved, reload, name equals typed, no `#s=` impact) |
| A4 | Magnification (`editorDragMeasure`) depends on room below the pan box | Corrected: `editorDragMeasure` is layout-based (root bottom minus panbox bottom, pan rest position), so a shorter panel DOES reduce drag magnification; this is the accepted Q1 (a) cost (the panel itself is hidden during a drag). Gated by 5.9 measurement and T0 rects |
| A5 | Held PRs #977, #982, #985, #988, #992, #994 and the dev merges cover the editor code this change edits | Verified 2026-11-08 by the eng review: all six OPEN with base `main`; #985, #988, #992 heads are ancestors of dev; #977 (1 commit) and #982 (2) have commits not on dev; #994 has about 40 lines of `index.html` diff vs #992 (zero only vs dev, because its code reached dev via #996; F2) Gated: P0 records `git diff origin/dev <head> -- index.html` per PR and fixes ONE base (section 8) |
| A6 | Fit evidence needs real fonts | Corrected: the CDP e2e harness blocks web fonts (memory `ci-harness-blocks-web-fonts.md`), but `tools/probe/panel_fit.js` real mode uses checked-in fonts (docs/testing/browser.md). The editor probe cell (M2) runs both font modes; the e2e fit stays a fallback-font floor |
| A7 | The eight `data/i18n/*.json` files all carry `editor.*` | Verified for `en.json`; the seven others to be checked by `sync_i18n.py` audit at lane start |
| A8 | Delete's `deleteDeck` is out of scope and safe | Verified: only the trigger moves; the function and `wouldEmpty` guard are untouched |

## 7. Why this is the smallest approach

The panel is DOM plus handlers around a stable core. Every behaviour the owner locked
(drag, drop plan, hit areas, rings, caps, Neotone fields) sits in pure functions and
SVG generation that this change does not edit. Tabs are a re-parenting of existing
blocks plus CSS; the more menu re-points four existing handlers; zone labels reuse the
existing counts; only the name field and the Sharps|Flats two-state control add new
behaviour (one tiny pure setter, one toggle bound to the existing `flats` view flag).
Alternatives rejected: rewriting the editor render as components (touches the frozen
paths and the drag selectors); a second layout behind a flag (violates D11); moving
placement logic into the tabs (touches `editorDropPlan`).

## 8. Phases and lanes

Single owner of `index.html` per lane; lanes are serial because they share the file. Every
lane: tests first, smallest adjustment on any error, no scope widening, adds its own i18n
keys (CLAUDE.md: every UI feature ends with an i18n step) and ends its report with
`pending-linear-writes`. Worktrees off the single base fixed by P0. Lane order (F4): T0 first on the P0 successor SHA (tests only), then PL-a with T0 green, then P1, N1, I1, D1 (PL-b after the panel lanes). Branch names:
`claude/editor-panel-pl`, `-t0`, `-p1`, `-n1`, `-i1`, `-d1`.

### P0: base and prerequisites (integrator, before dispatch)

1. Build the base (R4-1): the integrator builds branch `claude/editor-rc-successor` = RC #912
   head (`origin/claude/release-rc-2026-11-06`) merged with the six held heads (#977, #982,
   #985, #988, #992, #994), AFTER the editor RC has passed owner manual QA. Verify it: `grep -c
   "function editorDropPlan" index.html` is 1, the line `const ONE_PANEL = true ;` is present
   byte-identically, `git diff origin/dev claude/editor-rc-successor -- index.html` is NOT empty by design (dev's
   login-sync and generated I18N region); only the editor symbols must match dev's (R5-6). Merging
   RC and the six heads in order has exactly one conflict, `README.md` (identical on every merge;
   take either side); `index.html` and `tests/app.test.js` auto-merge. Record its SHA; T0's fixture header records it. Re-read the section 4 facts at
   that SHA (they were read from dev 8d08667a) and correct the plan before dispatch. Nothing is
   landed on dev first. Each dev PR D is a `claude/dev-merge-<lane>` PR that merges the lane head
   into dev, resolving toward dev's versions (R5-2): merging the successor into dev conflicts in
   `README.md`, `tests/app.test.js` and 16 `tests/mutants/*.patch` (including
   `i18n_region_inside_wrapper`, `i18n_swap_two_keys`, `u2e_move_no_swap`, which P1 re-anchors),
   because the RC base has older versions of files dev changed.
2. Create worktrees off that SHA, reserve the host-browser lease. Note (R4-10): each lane M is a
   100+ commit diff against main (the stack on the RC), so scoped mutation and `validate` effectively
   cover the whole editor, and a red on the RC side blocks every D merge; the review reads
   `git diff <successor sha>...<lane head>` for the lane-only change.
3. Section 15 status: Q1-Q8 are answered. Nothing blocks dispatch except the
   editor RC passing owner QA, the Q6 wording check below, and the lane order below (T0, then PL-a, then P1).
   Q9 is answered (Rotate dropped); PL removes it (see PL, "Rotate removal").

### Lane PL: Layout-tab control removal and anchor parity (after T0, before P1; Q8, Q9, Q10, R5-1, R6-1)

PL has two parts. PL-a is the UI row and runs after T0 and before P1. PL-b is the Neotone "#1 / #2" engine work, a separate lane in the same editor release (owner round-6 answer 2).

Why before P1 (F4): the removal lands before P1 re-parents the layout row, and T0 (pan, drag, drop, source hashes) is unaffected by it, so T0 freezes the oracle first on the P0 SHA and PL-a must keep it green. Owner answers: Q8 same controls on both profiles; Q9 DROP Rotate; Q10 (2026-11-09) DROP Mirror Top / Mirror Bottom on both profiles. The Layout tab is therefore the two anchor buttons "# 1 centered" and "#1 / #2" on both profiles. OWNER-VISIBLE SCOPE CHANGE: this removes the editor Mirror controls (live on dev since #996) from the successor of RC #912.

PL-a (UI row; no engine, share or storage code).
Prereq: T0 on dev (F4). Owns only the editor layout row in `index.html` (`#editor-layout` block, the editor mirror and rotate code listed below, the two "#1" buttons, the Neotone `editorRenderLayout` branch), its i18n keys (all 8), `tests/app.test.js` (the `addedKeys` list and the `keyCount + 16 - retired + addedKeys.length` arithmetic, for the keys PL-a retires), its tests and mutants, the `docs/CARD-SPEC.md` "Neotone Mirror and Rotate" paragraph removal (F9), `tests/suite_health.py` FLOORS rows and the README mutant count (`tests/test_readme_currency.py`) for the mutants it retires or adds (F8). Owns nothing in the pan, drag, tray, counts or panel shell and NOTHING app-wide (see "Mirror boundary"). Deliverables: Rotate removal (Q9); Mirror removal (Q10); the Neotone "#1 / #2" button shown but DISABLED (with a status/aria reason) until PL-b lands, and "# 1 centered" shown on Neotone as the current state. Nothing writes `anchor` for a profile in PL-a: `editorSetAnchor` stays a no-op for a profile and `HPE.core.readProfile` still refuses `anchor`. Acceptance: a test per profile asserts exactly the two expected Layout controls (listed under P1); drag, pan SVG and drop plans unchanged (the full existing editor suite unmodified except layout-row tests); full CI at the head SHA. Verify (F8): `node --test tests/editor_model.test.js tests/editor_shell.test.js tests/editor_e2e.test.js tests/app.test.js` plus the four share/storage corpus tests (`tests/link_corpus.test.js`, `tests/share.test.js`, `tests/storage_corpus.test.js`, `tests/persist.test.js`), `python3 tools/validate.py`, scoped mutation on the changed modules, and the CI `validate` run conclusion at the verified head SHA. Standing rules (F2, F4, F6, round 8): see "Standing lane rules (round 8)" below; PL-a's gate additionally requires T0 green AFTER the removals (T0 builds mirrored and Neotone models from option literals only, never via `editorSetMirror`, so the removal cannot break it).

Neotone anchor buttons in PL-a (F6): both are `disabled` on Neotone until PL-b. "# 1 centered" is disabled with `aria-pressed="true"` (Neotone is always centred; a disabled pressed button states the fact without a tap that does nothing). "#1 / #2" is disabled with `aria-pressed="false"`. The reason is the new key `editor.neo.anchor_pending` (English: "Not available for Neotone yet."), added to all 8 tables and to `addedKeys` by PL-a, used as the buttons' `title` and appended to their `aria-label`; PL-b removes the key, the disabled branch and the `addedKeys` entry (it owns that hunk). P1's test asserts "disabled until PL-b" on both buttons; PL-b's A2 takes the Neotone-anchor hunks of the editor tests that P1 writes.

PL-b (Neotone "#1 / #2" engine; separate lane, same editor release).
It is lanes E / A1 / A2 of `docs/plans/2026-11-08-unified-first-toggle.md`, amended by the owner's round-6 answers: two anchor buttons, not one toggle, and no Mirror controls. It lifts the PROFILE_CONFLICT on `anchor`, turns fixture angles by 20 degrees (`geom.turn`), adds share wire v9 and saved record v7, and touches `pdfcards`/`hifi.py` consumers, engine corpus additions and ENGINE-SPEC. Gates: its OWN `/plan-eng-review` BEFORE PL-b is built (the unified plan is DRAFT and untracked; it does not start until that review passes); FULL mutation (saved-scale and engine change, CLAUDE.md); the wire 7 -> 9 and record 5 -> 7 version bumps are FLAGGED and owner-gated for a main release; old v7 links and records must still decode (fixtures cover it, section 13); the Neotone "#1 / #2" button flips from disabled to enabled in PL-b's A2 step. Ordering: PL-b stacks on PL-a and is dispatched after the panel lanes (it must keep every T0 oracle green for the default, non-"between" state; its new "between" fixtures are additions, not edits). It is part of the same editor RC successor release, so its M stays open with the others. The unified plan's release-sequencing text ("ONE release, E + A1 + A2") is reconciled there: the three waves stack on the panel lanes' head.

Mirror boundary (verified on origin/dev 8d08667a; re-verified at the successor SHA in P0 by enumerating callers of each symbol, not by one grep pattern). "Mirror" covers two separate things:
- EDITOR-ONLY, removed by PL-a: buttons `#editor-mirror-top` and `#editor-mirror-bottom` (built in `editorOpen`), their row entries and label block in `editorRenderLayout`, their two `onclick` lines in `editorWire`, the "mirror keeps numbers" status branch in `editorLayoutTap`, and the functions `editorNeoMirror`, `editorNeoPermute` (its only callers are Mirror and Rotate; drag-swap writes through `editorNeoBuild`), `editorSetMirror`, `editorBottomMirror`, `editorHasBottom` (only if the P0 caller enumeration finds no other caller). KEEP `editorNeoBuild`, `editorLayoutTap` (the anchor buttons use it) and `editorSetAnchor`. The #994/#996 neotone-mirror-rotate content is exactly this plus Rotate.
- APP-WIDE, NOT touched: the layout sheet's MIRROR TOP / MIRROR BOTTOM buttons (`#scale-mirror`, `#scale-mirror-bottom`) and the i18n keys `sheet.mirror_*` they use; the engine (`options.mirror`, `options.mirrorBottom`, `layout.resolveMirrors`, `mirrored`, `mirrorPartner`); `buildGenerated`, pdfcards and `hifi.py` consumers; share encode/decode of the mirror options; the "MIRROR moves notes, never index numbers" rule in CLAUDE.md and docs/CARD-SPEC.md. Under `ONE_PANEL` the legacy sheet is not opened (`editorOpen` replaces it), so after PL the editor cannot toggle mirror on any scale; PL-a does not delete the legacy sheet code.
- Flagged for the owner (F5, acknowledgement requested in Q10): the editor release ships with `ONE_PANEL` true, so the legacy sheet is gone for EVERYONE. A prod user's existing mirrored saved scale or shared link can therefore never be un-mirrored, and a rim-only `mirror: true` scale that later gains a bottom note has that note mirrored with no control to flip it. Such scales still open, render mirrored, stay fully editable by drag, and save with the flags unchanged (tested, PL tests). Mirrored data is only the `options.mirror`/`mirrorBottom` flags (Standard) or a permuted `options.profile.map` (Neotone, from the dev Mirror and Rotate), both read by the unchanged decoder and renderer.
- Each `sheet.mirror_*` key keeps a non-editor reference in the legacy sheet code; P0 checks this per key. A key that loses its last reference joins the removal list and the `tests/app.test.js` arithmetic.

Rotate and Mirror removal (Q9, Q10), owned by PL-a only. What exists on dev (from #994/#996; re-verified at the successor SHA in P0): `editorNeoRotate`
(a `const` beside `editorNeoPermute`), buttons `#editor-rotate-ccw` and `#editor-rotate-cw` built in
`editorOpen`, their show/disable loop in the layout-row sync, their two `onclick` lines in
`editorWire`, and keys `editor.neo.rotate_ccw`, `.rotate_ccw.aria`, `.rotate_cw`, `.rotate_cw.aria`,
`.say_rotate_cw`, `.say_rotate_ccw` in all eight `data/i18n/*.json`, plus the three Mirror keys `editor.neo.mirror`, `editor.neo.mirror.aria`, `editor.neo.say_mirror` (nine in all, matching #994's "nine Neotone mirror and rotate keys").
- Remove in `index.html`: `editorNeoRotate`, the two rotate buttons, the loop that shows them for a
  profile, the two rotate `onclick` lines, and the Mirror set listed under "Mirror boundary"
  (`#editor-mirror-top`, `#editor-mirror-bottom`, their row entries, label block and `onclick` lines, `editorNeoMirror`, `editorNeoPermute`, `editorSetMirror`, `editorBottomMirror`, `editorHasBottom`, the keeps-numbers status branch). KEEP `editorNeoBuild`. Remove the nine keys from all eight tables, run
  `python3 tools/sync_i18n.py`, audit, fit check, same PR. Edit `tests/app.test.js` in the same PR: drop the nine keys from `addedKeys` and fix the `keyCount + 16 - retired + addedKeys.length` arithmetic for every key PL-a retires (PL-a, P1 and N1 each own their hunk).
- Tests (F1; the deletions are enumerated by SYMBOL at P0, `editorSetMirror`, `editorNeoMirror`, `editorNeoRotate`, `editor-mirror-*`, `editor-rotate-*`, not by name list alone). `tests/editor_model.test.js`: delete TRI59c-M1, M2, M5, M6 and M7 and every other test whose subject is `editorNeoRotate`, `editorNeoMirror`, `editorSetMirror` or `editorBottomMirror`. `tests/editor_shell.test.js`: U2e2-3, 4, 5, 9 (drive `editorSetMirror`) are deleted; U2e2-6 and U2e2-8 are SPLIT, not dropped (the mirror assertions go, the rest stay); U2e2-10 and U2e2-11 become "a mirrored scale still opens, edits and saves unchanged" tests built from option literals (`mirror: true`, `mirrorBottom: true`; a Neotone scale with a permuted `profile.map`); U2e2-7 stays; the layout-row control lists lose the mirror ids. New (F5): a mirrored scale stays fully editable by drag and by save (place, move, trade, remove keep the flags; a rim-only `mirror: true` scale that later gains a bottom note saves with the flags unchanged), and opens, renders and re-saves byte-identically.
  `tests/editor_e2e.test.js`: delete "TRI59c a rotation is not kept when the last mutant note goes (accepted)" (it clicks `#editor-rotate-cw`), "each rotate tap moves every Neotone note one fixture step", "MIRROR TOP on a scale with a pinned cyclops..." and "MIRROR BOTTOM flips the bottom ring only..."; EDIT (not delete) "the mirror and anchor controls are at least 44px, and the numbers toast shows on MIRROR BOTTOM only" so it keeps the anchor 44px check and loses the mirror and toast parts; remove the rotate and mirror ids from the e2e fit test's per-language id loop; SPLIT "MIRROR BOTTOM flips the bottom ring only...; the anchor splits notes 1 and 2" (F1, round 8): delete the mirror assertions, keep the Standard anchor half (the "between" anchor changes the rim, `aria-pressed` follows, the share code contains `between`, a repeat press adds no step); EDIT "U2e-2 palette chip, mirror and anchor" test "375x667: the octave row holds the flats chip..." (drop the two `editor-mirror-*` ids, keep the rest); rewrite "TRI59c the Neotone layout row offers Mirror and two rotate buttons" to assert the TWO-control set (`#editor-anchor-one`, `#editor-anchor-between`) on BOTH profiles with `#editor-rotate-*` and `#editor-mirror-*` absent from the DOM and both Neotone buttons disabled; INVERT "a rotated Neotone arrangement is dropped by Cancel and kept through SAVE, reload and the share link": the permuted `profile.map` is now seeded from the hand-built fixture (below), not a button, and the test still asserts Cancel drops any edit and SAVE, reload and the link keep the arrangement. The same for a Standard scale saved with `mirror`/`mirrorBottom` true: it reopens mirrored and re-saves byte-identically.
  `tests/app.test.js` mentions of "rotating"/"rotation"/"mirror" in the layout-sheet tests concern the legacy sheet and engine, which stay; only the `addedKeys` list and count arithmetic change (PL-a owns that hunk).
- Mutants: retire the five `tri59c_rotate_*` (`tri59c_rotate_buttons_always_shown`, `tri59c_rotate_ccw_goes_clockwise`, `tri59c_rotate_reversed`, `tri59c_rotate_says_nothing_of_direction`, `tri59c_rotate_wraps_at_nine`), the four `u2e2_*` mutants that patch `editorSetMirror` (`u2e2_bottom_skips_reflection`, `u2e2_top_drops_held_bottom`, `u2e2_top_rim_only_skips_pin`, `u2e2_top_skips_cyclops_reflection`), the three `tri59c_mirror_*` (`tri59c_mirror_tap_inert`, `tri59c_mirror_unpaired_moves`, `tri59c_mirror_wrong_axis`), `tri59c_mutant_ring_stays` and `tri59c_neotone_mirror_pressed` (their subjects are gone). Re-anchor `tri59c_neotone_controls_all_shown` to the two-anchor row. Add mutants: an editor Mirror or Rotate button re-added (hidden or shown); the Neotone "#1 / #2" enabled before PL-b; the editor save dropping `mirror`/`mirrorBottom`. Apply-check (re-anchor if a hunk fails) `u2e2_anchor_same_adds_step` (kept), `i18n_region_inside_wrapper`, `i18n_swap_two_keys` and the `b_*` patches that textually mention these keys or lines after the removal; refresh with `tools/refresh_mutants.py` if an anchor moved. Enumerate the mutants by the symbols and ids above, not by one grep pattern.
- Docs (F9): the `docs/CARD-SPEC.md` "Neotone Mirror and Rotate" paragraph (added by #994) is REMOVED by PL-a in the same PR (no stale doc between lanes); sheet/engine MIRROR rules stay. `docs/ENGINE-SPEC.md` has no #994 text, so D1's check there is a no-op. `docs/plans/2026-11-08-neotone-mirror-rotate.md` is marked SUPERSEDED. D1 rewrites the CARD-SPEC editor Layout-row sentence to the two-anchor row only if PL-a left it stale.
- Compatibility (release safety): Mirror (Neotone) and Rotate only ever wrote the permuted tonefield order into
  `options.profile.map` (via `editorNeoBuild`), the same data drag-swap writes (Standard Mirror wrote only the existing `options.mirror`/`mirrorBottom` flags). Removing
  the control changes no decoder, encoder or renderer: `#s=` links, saved scales and local handles
  that hold a rotated `profile.map` must still decode and render the same arrangement. Proof: PL
  runs the unedited share/storage corpus tests (`tests/link_corpus.test.js`, `tests/share.test.js`,
  `tests/storage_corpus.test.js`, `tests/persist.test.js`) and adds a test that a Neotone scale with
  a rotated map (a hand-built fixture committed as data (F9: a permuted `options.profile.map` literal needs no dev build) opens, renders the same SVG hash, round-trips through the share link, and re-saves byte-identically (not only the SVG hash); a Standard scale with `mirror`/`mirrorBottom` true gets the same round-trip proof. Rotate exists on dev only (origin/main has no editor code), so such data exists only in DEV links and DEV saved records. Once PL-b adds wire v9, the same fixtures also cover "old v7 links still decode". T0's pan
  hashes are unaffected because the pan SVG is a function of `profile.map`. PL-a touches the layout
  row, its keys and `tests/app.test.js` only; no engine, share or storage code (those are PL-b).

### Standing lane rules (round 8)

- F2: any lane that changes i18n keys (PL-a, P1, N1, I1) regenerates the `const I18N` line, and 13 of 21 `tests/mutants/b_*.patch` at origin/dev carry it as context (re-count at lane start; 21 `i18n_*` patches also exist). Each such lane runs `git apply --check` on every patch in `tests/mutants/`, runs `tools/refresh_mutants.py`, and OWNS `b_*` and `i18n_*` patch regeneration (memory "Data lanes own tests/mutants/").
- F6: every lane's verify also runs `node --test tests/app.test.js`, `python3 tests/suite_health.py`, `python3 -m unittest tests.test_readme_currency` and the mutant apply check. FLOORS rows move DOWN for deleted tests (PL-a, P1) and UP for added ones (T0, PL-a, P1, N1, I1).
- F8: PL-a's i18n step rewrites `editor.layout.aria` ("Mirror and orientation") in all 8 tables, since no Mirror control remains (e.g. "Orientation"/"Anchor", translated per table).
- F9: `addedKeys` net deltas in `tests/app.test.js`: PL-a -9 (six rotate, three mirror) +1 (`editor.neo.anchor_pending`) = -8; P1 and N1 own their own add/retire hunks; PL-b removes `editor.neo.anchor_pending`.

### Lane T0: freeze the oracle (tests only; no `index.html` change)

Base: the P0 successor SHA (F4: T0 is the first lane; it freezes no Layout control), written into the fixture header. Owns: `tests/editor_freeze.test.js` (new),
`tests/fixtures/editor_pan_v1.json` (new), `tools/regen_editor_pan_fixture.js` (new), its row
in `tests/suite_health.py` FLOORS, and the `tests/mutants/` entries it needs (named
`ef_*.patch`, each with `# suite:` and `# kills:` headers; hunks stripped of `index` lines). F4: T0 builds mirrored and Neotone models only from option literals (`mirror: true`, `profile.map`), never via `editorSetMirror` or any function PL-a removes.

- Pan oracle: for about a dozen models (default Kurd, mirrored top and bottom, pinned
  cyclops and bottom, bottom 12, rim at cap, cyclops at cap, over-cap load, Neotone empty,
  Neotone 9+9, selected note, held note, zone selected) sha256 of `editorWithOverlay(pan(...))`
  and of `#editor-pan` innerHTML after `editorRender()`.
- Geometry oracle (H1, C3): for the same dozen models as the hash oracle, at 375x667, 390x844
  and 900x600 landscape, record in four states (rest, `.dragging`, `.settling`, and a
  selected/held state): the bounding rects of `.editor-panbox`, `#editor-pan svg` and every
  `.ehit`, and the computed `--ed-mag`. `.dragging` and `.settling` are captured because P1
  edits those selector groups (M4). Store, per `.ehit`, its width, height and offset from the svg origin divided by `getScreenCTM().a` of `#editor-pan svg` (viewBox units, invariant when the pan grows) and the viewBox; assert only those (Q1 a, F-T0-1). The svg-to-panbox and ehit-to-svg pixel ratios are NOT used: they are not invariant when the pan grows into freed height. Absolute rects may be
  logged but are never asserted.
- Computed-style oracle (C2, deterministic, replaces a pixel diff): `getComputedStyle` of
  `.editor-panbox`, `#editor-pan`, its svg and every distinct class present in `#editor-pan`
  (`ehit`, `etarget`, `epin`, `eslot`, `esel`, `edrop`, note text and the others found by
  enumeration at T0 time), for the properties that draw the pan (stroke, fill, dash, opacity,
  transform, font-family/size/weight, pointer-events, cursor, touch-action, visibility), in
  rest, selected, held, `.dragging` and `.settling`. `transform` values that carry `--ed-mag`
  (the `.dragging` and `.settling` pan transforms) legitimately differ under Q1 (a) and are
  excluded from the comparison (or compared as a normalised scale factor); the other properties
  are compared exactly. No pixel screenshot is stored: a pixel
  fixture made on macOS cannot gate on Linux CI with web fonts blocked, so it is dropped. If a
  pixel check is ever added it is generated in CI's own environment, and a skip on CI is a
  FAILURE (the test reads `process.env.CI`).
- No oracle in this lane may skip on CI: every skip path checks `CI` and fails instead.
- Drop-plan oracle: for each model, every tray note name and pan ref as source, every target
  kind (`spot` with and without angle per ring, `note`, `ding`, `outside`, trash/tray/off),
  call `editorDropPlan` (incl. `editorNeoDropPlan`; NOT `editorDingButtonPlan`, which P1 removes with the Replace-ding button, Q5) and record the
  canonical result (the ding as a target kind goes through `editorDropPlan`/`editorPlaceHeld`/`editorSelectTap` -> `editorTrade` and `editorPanKey`, all frozen): keys present; for `step`, the exported model after applying it
  (or refusal code and reason); `say`; `trade`; `refuse`; `snap`.
- Source-hash oracle (R4-2): sha256 of the source text of the frozen functions and constants: `editorDragSource` through `editorDragEnd` (`editorDragDown`, `editorDragLift`, `editorDragMeasure`), `editorHitAt`, `editorDropPlan`, `editorNeoDropPlan`, `EDITOR_HIT_AREA`, `EDITOR_SCALE`. Any edit fails T0; a mutant edits one byte of `editorDragDown`.
- Line oracle: the `const ONE_PANEL = true ;` line is byte-identical (regex of
  `tests/helpers/editor_flag.js`).
- Behavioural oracle: the existing drag-ux E1-E7, E6b, E6c, X4 and the tap/hold tests; T0
  pins their selected count.
- Contract: a fixture of frozen pre-change values (CONTRACT rule 2 carve-out in the fixture
  header); regenerated only by an owner-approved render change, never to make a lane pass.
- Mutants (T0 owns): change `EDITOR_HIT_AREA`; change a `say` key; reorder `editorDropPlan`
  branches; change the svg `viewBox` width by 1, or shift one `.ehit` offset by 1px (a panbox height shift is NOT a mutant: the viewBox-unit `.ehit` values divided by `getScreenCTM().a` are invariant to it under Q1 a); change a ring `stroke-dasharray` in the editor CSS; alter the ONE_PANEL line. Each killed.
- Verify: `node --test tests/editor_freeze.test.js`; scoped mutation on `ef_*`.

### Lane P1: panel shell (tabs, counts, action row, more menu, pills retired)

Prereq: T0 and PL-a on dev, and the Q6 wording check (Q11 is answered: chips on the Scale tab only): the Neotone zone-label terms in all 8 languages are checked against the Neotone page's own terms and recorded before P1 starts. Owns: `index.html` (editor DOM in `editorOpen`, `editorRender*`,
`editorWire`, the editor CSS block incl. the landscape grid, and its generated I18N region);
`data/i18n/*.json` keys it adds or retires (all 8); `tests/app.test.js` (its `addedKeys` hunk and the count arithmetic); `tests/editor_shell.test.js`,
`tests/editor_e2e.test.js`, `tests/editor_model.test.js`; `tests/mutants/` entries for P1;
`tests/suite_health.py` FLOORS rows and the README mutant count.

Tests first (Q11): chips are drag sources ONLY with the Scale tab active (a chip drag from the Layout tab starts nothing); the test names this as the owner-accepted exception (Q11, 2026-11-09) to "drag and drop unchanged". Tab semantics (aria-controls/labelledby, roving tabindex, Left/Right/Home/End,
automatic activation, inactive panel `hidden`), pan visible and rect-identical on both tabs,
counts block on both tabs (not aria-live; full and over-cap non-colour cue), no `#editor-pill-*`,
Sharps|Flats two-state, chip tap holds / pan-spot tap places, hold survives a tab switch,
held banner with Cancel on both tabs, menu spec of 5.6 (focus in, arrows, Tab/Escape return,
outside and drag-start close, disabled items kept), Delete (last under divider, ~400 ms second
press ignored, outside press disarms, name truncated, absent for a new scale, allowed while
held and the hold is kept (owner Q4), refusal when it would empty), ding reachability (below), Neotone
parity (labels, Layout controls, Reset disabled not hidden), and the EXACT expected Layout controls per profile (R5-1): Standard = "# 1 centered", "#1 / #2" (two anchor buttons, not the unified plan's single `editor-anchor-toggle`); Neotone = the same two, with "#1 / #2" disabled until PL-b lands; no Mirror and no Rotate on either profile (Q9, Q10); no other control, no per-profile hiding in panel code, chips are the only children of
`#editor-notes`, and chip state classes (held/selected/used) unchanged from dev.

Ding reachability tests (DR10): Enter on the focused ding with a held note replaces the ding;
tap ding with a selected note trades (`editorSelectTap` -> `editorTrade`); tap ding with a held
note places via `editorPlaceHeld`; Enter on the focused ding with a held note goes through
`editorPanKey`; the ding `.ehit` markup (including `editor.note.aria_ding`) stays byte-identical because it is inside the hashed SVG (R4-3); the "what it does" text lives in the visible cue and `#editor-status`, and the test asserts the cue, not the SVG label; the visible cue (counts
"Ding 1/1" plus the second hint line) is rendered. Q5 answer: Replace ding is dropped, so
these are the only ding routes and must be green.

CSS selector groups (M4): `.dragging` hide/slide, `.settling` (pointer-events) and the
reduced-motion block each get the new tab strip, panels, counts and action row added; one
mutant per group.

Retired and re-anchored (H4), all owned by P1: mutants `oqa_a_full_not_dashed`,
`oqa_a_full_pill_pick_first`, `oqa_a_pill_count_line_dropped`, `oqa_a_pill_full_dropped`,
`u2f2_pill_*` (4), `dux_flash_not_marked_on_pill`, `dux_flash_not_marked_on_replace_ding`,
`u2e3_ding_button_ignores_held`, and the U2e3-3 button tests (Q5 = drop: all retired; the
`editorDingButtonPlan` and `editorReplaceDingTap` functions, the `#editor-replace-ding` button
and the `editor.replace_ding*` keys in all eight tables are REMOVED in P1), `oqa_a_tray_offpan_removes`, `i18n_region_inside_wrapper`, `i18n_swap_two_keys` (apply-check and re-anchor to moved DOM), `oqa_a_toolbar_undo_always_visible` (re-anchored to the
new action row); and the nine the confirm review found (the tenth, `tri59c_mirror_tap_inert`, is retired by PL-a, F3), with re-anchor targets: `dux_panel_only_faded_not_hidden`, `oqa_a_zone_kept_on_lift`, `oqa_b_lift_keeps_rings`, `oqa_a_stack_not_centred` (re-anchor to the `.dragging` hide group and the new panel stack centring; retire `oqa_a_stack_not_centred` if the pill stack no longer exists), `tri59_delete_first_tap_deletes`, `tri59_delete_never_disarms`, `tri59b_disarm_repaints_the_pan` (re-anchor to the menu's Delete item arm/disarm path), `tri59_octave_cell_wide` (to the Sharps|Flats octave row), `u2e3_toolbar_nowrap` (to the new action row). Siblings `oqa_a_zone_kept_on_switch`, `tri59_delete_on_unsaved_scale` get an apply-check too; stale-patch rule: apply-check every patch after the move (memory
`mutation-check-edits-stale-h-patches`, `hand-regenerated-mutants-drift`). About 30 pill
e2e tests (D16, D17, D18, U2f-2 parity, OQA, and E4 "after a pill") are deleted or rewritten per
this coverage table, kept in the PR description and checked by the reviewer:

| Removed pill test family | Replacement (pan-tap or drag equivalent) |
|---|---|
| D16 cap refusal via pill | Held note, tap a spot in a full ring: `editor.full.*` refusal copy shown |
| D17 TOO_CROWDED via pill | Same path through `editorPanTap` with a crowded ring |
| D18 pill labels/counts | Counts block text per ring and Neotone (5.3/5.4) |
| U2f-2 pill/tap parity | Tap parity with drag: same `editorDropPlan` result for tap vs drop (T0 oracle) |
| OQA pill full state, dashed | Counts block non-colour cue for full |
| OQA pick-first message | Tap a zone spot with nothing held or selected: `editor.say.pick_first` |
| E4 highlight "after a pill" | Highlight after a pan tap placement |
| `editor-hint` text assertion in `editor_e2e` | Both hint lines (5.1) rendered on both tabs |

(The exact test titles are filled in at lane start from `grep -n pill tests/editor_e2e.test.js`;
the table is a gate, a deleted test with no row is a reviewer FAIL.)

i18n in P1 (C8): P1 REMOVES the keys its code retires in the same PR (`editor.pill.*`, `editor.pill_aria.*`, `editor.areas.aria`, and `editor.hint` if replaced) from all eight tables, because `tools/sync_i18n.py` has no unused-key check to rely on and a stale key left to I1 would be dead data in the generated block; I1 only sweeps what remains. Keys added by P1: tabs, tab list aria, counts, more menu and items, Delete armed text,
Sharps, accidentals aria, mock-style hint (see Q5), "..." aria (`editor.more.aria`). English
and the seven tables, `python3 tools/sync_i18n.py`, audit, in the same PR.

Acceptance (C1): T0 oracles unchanged: SVG hashes, viewBox, drop plans, ONE_PANEL line and computed styles always; `.ehit` size and offsets in viewBox units (divided by the svg `getScreenCTM().a`) and viewBox at 375x667, 390x844, 900x600 (Q1 a; no absolute rects). Existing editor tests
unmodified except the table above; full CI at the head SHA. Verify: `node --test tests/editor_freeze.test.js tests/editor_model.test.js tests/editor_shell.test.js tests/editor_e2e.test.js`, `python3 tools/validate.py`, CI `validate` at the verified head SHA. Plus the standing rules F2/F6.

### Lane N1: scale name field

Prereq: P1 on dev. Owns: `index.html` (`editorSetName`, name input, wiring, generated I18N
region), `data/i18n/*.json` name keys (all 8), `tests/app.test.js` (its `addedKeys` hunk and the count arithmetic), `tests/editor_model.test.js`,
`tests/editor_e2e.test.js` name rows, its mutants. Runs FULL mutation (M1: `options.name`
persists into saved scales; CLAUDE.md requires the full suite for saved-scale changes).
Tests first: setter pure and undoable; blank restores `autoName`; trim; 40 cap; type-then-Save
immediately; drag pointerdown ignores the input; placeholder equals `autoName`; Neotone name
per Q6; save round trip (create and update); name never enters a share link; dirty tracking;
dialog Save/Discard. Acceptance: T0 oracles unchanged; share/storage corpus tests unedited. Verify: the same node test set as P1, `python3 tools/validate.py`, full mutation green in CI at the verified head SHA. Plus the standing rules F2/F6.

### Lane I1: fit and dead-key cleanup

Prereq: P1, N1 on dev. Owns: the `tools/probe/panel_fit.js` editor cell (with a test of `parseArgs` and an absolute-mode run for the new `--absolute` flag), the e2e fit test, and
a final sweep of any dead i18n keys still left in the eight `data/i18n/*.json`, plus the generated
`const I18N` region of `index.html` (named as owned: it is regenerated by
`python3 tools/sync_i18n.py`, commit the result; conflicts are resolved by re-running the tool).
- Probe cell (M2): the editor, 8 languages x 375 and 320 x both font modes (`--font both`),
  cell receipt in the format documented in docs/testing/browser.md, cited in the PR.
- Asserts (R4-5): every tab, chip, toggle half, menu item, "..." and name field >= 44px; no wrap of the octave row at 320 in de and ja; counts text >= 12px; no horizontal overflow at 320 and 375 in all 8 languages. Contrast of the Save/tab/hint/counts pairs against `docs/plans/assets/2026-11-02-field-guide/token-check.json`.
- Adjusts nothing in the pan or drag.
- Owner phone check (Q7): the owner checks served DEV on a real iPhone in German and Chinese (zh-Hans and zh-Hant) after I1 merges to dev; I1 is not DEV QA-passed until then.
- Acceptance: probe cell receipts for all 8 languages at 375 and 320 pass both font modes; T0 oracles unchanged; the fit test is green at the head SHA. Verify (F5, round 8): `tools/probe/panel_fit.js` defaults `--base origin/main`, which has no editor, so the editor cell runs in an absolute-assert mode: I1 adds a flag `--absolute` (candidate-only, asserts the thresholds below without a base diff) or, failing that, runs `--base <successor SHA>`; the PR names which. Command: `node tools/probe/panel_fit.js --absolute --font both` (or `--base <successor SHA> --font both`) plus the e2e fit test. Plus the standing rules F2/F6.
- Regenerate `tests/fixtures/i18n_contract_v1.json`/`i18n_english_dom_v1.json` only with an
  explained diff.

### Lane D1: docs and spec

Prereq: P1, N1 on dev. Test: the doc claims cite test names that exist (a grep gate in the review). Verify: `python3 tools/validate.py`; full CI at the head SHA.

Owns: `docs/CARD-SPEC.md` editor section; `docs/testing/browser.md` only if the check list
changes. Claims cite test names. Runs full CI (not doc-only; it edits CARD-SPEC).

### Order against held PRs

Hard prerequisite, not carried here: #977 (keyboard/a11y), #982 (turns the flag on), #985 (drag
UX), #988 (delete in editor, Neotone reason, compact octave), #992 (delete nits) and #994 (Neotone
mirror/rotate) are all on `claude/editor-rc-successor` (P0 step 1) before T0 starts. This work
depends on #988/#992 for `editorDeleteTap`/`editorDisarmDelete`, #977 for `editorPanKey`/roving
focus/`editorTabStops`, and #994/#996 only for what they share with the rest of the stack (their Neotone mirror/rotate content is removed by PL, Q9/Q10, so the dependency on them is the removal itself). Conflict rule when
building the successor: take the held PR's version of those functions and re-run the
generated-region tools.

How the lane PRs are built (C4, Q3 reframed 2026-11-08). Verified fact: origin/main has NO editor
code (`editorDropPlan` is absent), and the held PRs #977, #982, #985, #988, #992, #994 each carry
about 93-100 commits: they are the tail of the editor release candidate (successor of #912).
So there is no "main with the editor" to base on, and the panel cannot reach main before the
editor RC. Rule: every panel lane stacks on the editor RC successor head (`claude/editor-rc-successor`, P0). Each PR M to `main` is labelled
"stacked on editor RC <sha>" and is never based on bare main; the panel diff is reviewed as
`git diff <RC sha>...<lane head>`. PR D targets `dev` from the same head per CLAUDE.md. Lane N+1
branches from lane N's head (RC plus all earlier lane diffs), so P1's M carries T0's tests and
fixture. M stays open: it merges only after the editor RC has merged to main, and the owner's
manual QA on the editor RC comes first. There is no "merged main SHA" language anywhere. P0 also
records whether `validate` can run on such an M (the workflow has no `workflow_dispatch`); if it
cannot, the D gate falls back to the lane's own CI evidence named in the PR, flagged to the
owner. The earlier "cut after the held PRs reach main" and "base is the dev tip" statements are
superseded.

## 13. Release and gates

Dev first: each lane opens PR M to `main` (labelled "stacked on editor RC <sha>") and PR D from the same head to `dev`. Lane N+1 branches from lane N's head, the first from the editor RC head (section 8 "How the lane PRs are built"). D merges on a green
`validate` on M at the exact head, an addressed independent review, not CONFLICTING;
then check served DEV. M stays open until the owner says merge. No main merge. A
future release PR to main: full mutation, RC review, e2e on served DEV. Doc-only lanes
(D1 if only `docs/plans`) skip CI per `tools/ci_scope.py`; D1 edits `docs/CARD-SPEC.md`
so it runs full CI.

Owner gate (Q7): before the panel is called DEV QA-passed, the owner's manual iPhone check of served DEV in German and Chinese (zh-Hans, zh-Hant) passes; this is a release gate, not a CI check.

Release gate (F7, round 8): the main release PR requires PL-b merged to the same editor release, OR a recorded owner decision to ship with Neotone's "#1 / #2" disabled. Recommended default: PL-b required (AFK auto-decision, owner may override). Owner-visible (F10): until PL-b lands, the Neotone Layout tab holds two disabled buttons ("# 1 centered" pressed, "#1 / #2" with the reason "Not available for Neotone yet.").

Release safety (CLAUDE.md "Release safety"): the panel lanes (PL-a, T0, P1, N1, I1, D1) do not touch `#s=`,
share-link decoding, saved-scale storage, `commitSaved` internals, or local handles. The exception is PL-b (the Neotone "#1 / #2" engine lane, same editor release): it adds share wire v9 and saved record v7, so it gets its own `/plan-eng-review`, FULL mutation, owner-gated version bumps, the frozen main-with-profile client fixtures, and fixtures proving old v7 links and records still decode; its gates are in `docs/plans/2026-11-08-unified-first-toggle.md`. For the panel lanes, checked by: (a) the unchanged share link corpus (`tests/link_corpus.test.js`,
`tests/share.test.js`, `tests/storage_corpus.test.js`, `tests/persist.test.js`) passing
without edits; (b) a grep gate in the review that `index.html` diff contains no change
to the share encoder/decoder or storage keys; (c) a test that a saved scale edited
with the new UI re-opens identically (T0-style round trip). The new `options.name` is
an existing option, not a new field.

Analytics privacy: no new event; no param over 40 chars; no name in any event
(`scale_create` params unchanged).

## 14. Observable acceptance (summary)

1. On a phone, the pan is visible on both tabs and its SVG is byte-identical (T0 hashes,
   viewBox, computed styles); its on-screen size may grow into freed height with identical viewBox-unit geometry
   (`.ehit` values divided by `getScreenCTM().a`, owner Q1 a).
2. Dragging a chip or a pan note behaves as before (T0 drop plans; drag-ux E1-E7).
3. Tapping a chip holds it; tapping a pan spot places it; no rim auto-fill.
4. Scale tab shows name, 12 chips, octave row with Sharps|Flats; Layout tab shows exactly two
   controls on both profiles ("# 1 centered", "#1 / #2"; Neotone's disabled until PL-b), no
   Mirror and no Rotate (dropped, Q9, Q10).
5. Zone labels read Rim n/12, Cyclops n/6, Bottom n/12, Ding 1/1; Neotone shows fixed
   fields with no caps.
6. "..." holds Redo, Remove selected, Reset spacing, Delete; Delete needs two presses and
   disarms on outside press.
7. All eight languages fit at 375 with real fonts; 44px targets.
8. Share links and saved scales are unaffected.

## 15. Owner decisions (recommended option first)

1. **ANSWERED (a) 2026-11-08, owner chat: "pan may grow, geometry/ratios identical".** Was: what "visual UI unchanged" means for the pan's size. The pan is sized by the
   height the controls leave (5.9). Recommended (a): the pan may grow into the height the
   simpler panel frees, with SVG, ring geometry and hit areas scale-identical; this is the only
   option that delivers the simplification; cost: the pan's pixel size and drag magnification
   at rest differ from dev and the owner must accept the bigger pan. Alternative (b), not chosen: identical
   on-screen size, no height gained.
2. **ANSWERED 2026-11-08, owner chat: violet Save, ink tab text, violet underline.** Was: Save fill and tab state. Recommended: the mock's treatment: Save is the single violet fill
   (`#6756B5`, white text), selected tab is ink text with a 3px violet underline, all toggles
   stay ink. Alternative: keep ink everywhere and give Save a distinct treatment (full width,
   heavier weight). 
3. **ANSWERED (reframed) 2026-11-08, owner chat.** origin/main has no editor code and the held PRs are the tail of the editor RC (about 93-100 commits each), so panel lanes stack on the named base branch `claude/editor-rc-successor` (RC #912 head merged with the six held heads, built after RC owner QA, P0), M PRs are labelled "stacked on editor RC <sha>", and the panel reaches main only after the editor RC merges, after owner manual QA on the RC. Original question (superseded): how the lane PRs are built while #977, #982 and #994 are open. Recommended: the owner
4. **ANSWERED 2026-11-08, owner chat: allow, keep the hold.** (Alternative, not chosen: cancel the hold when Delete arms.)
5. **ANSWERED 2026-11-08, owner chat: drop the Replace-ding button; add the visible ding cue (counts "Ding 1/1" plus a second hint line).** Was: ding swap control and hint (merged). Dropping the Replace-ding button and the hint
   `editor.hint` ("Drop a bottom note on the ding to swap it with the root") removes ALL sighted
   discoverability of the ding swap; only an aria-label remains. Recommended: drop the button,
   use the mock hint for placement, and add a visible cue: a ding label in the counts block
   ("Ding 1/1") plus a second hint line "Drop or tap a note on the ding to swap it with the
   root", proven by the ding reachability tests and a visible-affordance check (the cue is
   rendered, not aria-only). Alternative: keep the "Replace ding" button on the Scale tab; cost:
   one more control.
6. **ANSWERED 2026-11-08, owner chat:** Neotone zone labels use the Neotone page's own terms per language; the stored name carries the suffix. A wording check in the 8 languages is a P1 prerequisite.
7. **ANSWERED 2026-11-08, owner chat:** phone check in German and Chinese (not Japanese).
8. **ANSWERED 2026-11-08, owner chat:** "Neotone and standard pan should have same controls with same behaviors." Then: the Layout tab shows the SAME four controls on both profiles: Mirror Top, Mirror Bottom (mutants), "# 1 centered", "#1 / #2". Delivered by lane PL-a before T0 (section 8). Round-6 follow-ups (2026-11-09): the two anchor buttons stay two; the Neotone "#1 / #2" engine work is lane PL-b in the same editor release (PL-a ships it disabled). The four-control list was then narrowed by Q10.
9. **ANSWERED 2026-11-08, owner chat: DROP Rotate.** Both profiles get identical controls: Mirror Top, Mirror Bottom, #1 centred, #1 / #2. The Neotone Rotate built in #994/#996 is removed by lane PL (section 8).
10. **ANSWERED 2026-11-09, owner chat: DROP Mirror Top / Mirror Bottom on both profiles.** "If mirror top / mirror bottom is too complex for neotone, let's consider dropping this feature completely. I don't find it very useful on either standard or neotone. Arguably rotate left or rotate right by one note is more useful but maybe something we consider as p3 in the future." Recorded: editor Mirror controls removed by lane PL (OWNER-VISIBLE SCOPE CHANGE on the successor of RC #912); Rotate stays dropped; Rotate left/right by one note is a P3 future idea, not tracked or scheduled. The app-wide MIRROR feature is untouched. #994's mirror/rotate content is superseded, but #994 itself stays in the successor (F2, section 16). **ANSWERED 2026-11-09 (F5), owner via AskUserQuestion: "Accept, drop Mirror".** Existing mirrored scales and links open, draw and save unchanged but cannot be un-mirrored (`ONE_PANEL` true on release); a rim-only `mirror: true` scale that later gains a bottom note has it mirrored with no control to flip it.
11. **Q11 - ANSWERED 2026-11-09, owner via AskUserQuestion: "Scale tab only" (option a).** Tray chips are drag sources only with the Scale tab active (`editorDragSource` needs `#editor-tray`); no chip strip on the Layout tab. The owner knowingly accepts this as a deliberate exception to "drag and drop unchanged".

Decided, not asked: Undo and Save always visible, Redo in "..." (D6); one base state (Q3 and P0).

Accepted without a question: the soft keyboard may cover the pan while the name field is
focused (D2 applies to tab states).

## 16. Continuation point and stop

Checklist for the next session (nothing below has been done; no branch, commit, push, Linear
or GitHub write exists):

- [x] Q1-Q8 answered (section 15). [x] Q9 answered. [x] Q10 answered (Mirror dropped). [ ] Q6 wording check in 8 languages before P1. [x] unified-first-toggle plan amended 2026-11-09 (two buttons, no Mirror controls, back-reference). [ ] unified-first-toggle plan eng-reviewed before PL-b (PL-a does not wait on it).
- [ ] P0: build and verify `claude/editor-rc-successor` (RC plus #977, #982, #985, #988, #992,
      #994; README conflict only); check whether `validate` can be dispatched for a main PR from a lane head (the
      workflow has no `workflow_dispatch`); record the base SHA here: `________`.
- [ ] #994 / #996 (F2): the successor INCLUDES #994 (P0 step 1 unchanged). Its commit also removes `#editor-layout-note`, `NEO_REASON` and the `tri59_neotone_reason_hidden` mutant, which dev already has via #996 (#996 is merged to dev); leaving #994 out would put them back on the successor. PL-a removes the Neotone Mirror/Rotate content on top. Never close #994 before the owner agrees; there is no close-unmerged path in this plan.
- [ ] Worktrees created off the base SHA; lane branches `claude/editor-panel-pl`, `-t0`, `-p1`,
      `-n1`, `-i1`, `-d1`; host-browser lease reserved.
- [ ] Integrator writes Linear (`Key:` search first under TRI-59): new workstream comment
      `lifecycle planned: editor panel simplify; evidence: plan path; next: P0`.
- [ ] Dispatch T0, then PL-a (T0 green), then P1 (after Q6), N1, I1, D1, each through its own independent reviewer and dev merge; PL-b (separate, own eng review) after the panel lanes.
- Cleanup, separate plan: retire `const ONE_PANEL` and `tests/helpers/editor_flag.js` after
  the editor ships on main.

## 17. Independent design review (2026-11-08, plan-design-review, non-interactive)

SUPERSEDED by the plan body (sections 1-16, round 2): the verdict below describes the first draft; each finding's disposition is in the Disposition log.

Verdict: NOT READY (3 high findings; all are plan edits, none block the direction).

High
- DR1 Plan contradicts the approved mock on counts, Save and tab state. Mock: zone counts sit under the pan (visible on both tabs), Save is violet fill (`.go`), selected tab has a 3px violet underline. Plan 5.1/5.3 puts counts inside the Scale panel (invisible while on Layout, so a Layout-tab pan tap that hits a full zone gives no visible count), 5.7 keeps an ink Save, and 5.7 forbids violet on tab selection. Fix: counts live in a block under the pan outside both panels; owner decides Save and tab-underline explicitly (see DR4); update 5.x to match the mock or list each deviation as a question.
- DR2 Name field vs pan-visible goal and Save race. Focusing the first field on a phone raises the keyboard and covers the pan (D2 fails during edit); input font under 16px triggers iOS zoom (mock uses 14px); commit-on-blur (5.2) races a Save tap on iOS (blur can fire after click), so the last edit may be lost or saved without undo step. Fix: input font >= 16px; Save/Back/menu handlers must call the name commit first; test "type name, tap Save immediately"; verify `editorDragDown` (pointerdown on `#editor`) ignores the input so selection and caret work; placeholder shows the `autoName` result so blank is understood.
- DR3 Drag magnification claim is inconsistent. A4 says a shorter panel changes `room`, but `editorDragMeasure` uses root bottom minus panbox bottom, and the panel is hidden during drag; the real dependency is root height. Q6's recommended "slightly taller editor" contradicts the goal (controls shrink). Fix: measure `--ed-mag` on dev vs a prototype at 375x667 and 390x844 first; give both tabs the same fixed panel min-height (mock uses 236px) so tab switching never moves the pan or changes room; reword Q6 on the measurement.

Medium
- DR4 Hierarchy of ink fills. Active tab, Standard/Neotone, Sharps/Flats, Mirror pairs and Save (if ink) all use the same ink fill, so the primary action is indistinguishable from a toggle state. Recommend Save violet fill (single filled action, mock-approved, PRODUCT.md "actions"), tab selection = ink text + violet underline (state), toggles stay ink. This reverses Q4's recommendation. If owner keeps ink, give Save a distinct treatment (full-width, heavier weight) and keep focus ring distinct from selection (principle 3).
- DR5 Tab semantics under-specified: needs `aria-controls`/`aria-labelledby`, roving tabindex (Left/Right/Home/End), `hidden` inactive panel, and an explicit activation model (recommend automatic, panels are cheap). Held chip: pressed state is invisible on Layout, so the held banner (outside panels, per R3) must also name the note; Cancel must be reachable from both tabs.
- DR6 More menu a11y: specify focus to first enabled item on open, Up/Down/Home/End, Tab closes and returns focus to "...", outside pointerdown and drag start close it (and disarm Delete), menu not clipped at 320px and not covered by the keyboard. Disabled items must stay in the menu with `aria-disabled`, not vanish.
- DR7 Delete safety. Press-press in the same position invites a double tap; the label also changes length ("Press again to delete {name}" with a 40-char name can wrap or truncate). Fix: separate Delete from Remove selected with a divider and put it last; ignore a second press for ~400 ms after arming; armed text must not be colour-only (it is text, good) and the name truncates with ellipsis but keeps the verb visible; closing via Escape/outside disarms (already). Edge: Delete while unsaved changes exist and while `s.held` - plan leaves "decide in T-lane"; decide now: Delete disarms hold? Recommend allow, keep hold off the destructive path.
- DR8 Touch targets: mock `.acc button` and `.seg button` are 42px (below 44). Plan 9.3 asserts 44, so the implementation must not copy the mock CSS. Also the Neotone/Standard header group (existing) must be measured, not assumed.
- DR9 Hint (Q3). The approved mock hint is about hold/tap/drag ("Tap a note to hold it, then tap a ring on the pan, or drag it onto the pan"), which teaches the pill-less flow; the plan's hint is the ding-swap line. Recommend: replace with the mock hint (new i18n key, 8 tables) and drop `editor.hint`; keep ding swap discoverable in the Replace-ding answer. Hint is 12px muted: check 4.5:1 on paper (#5E5850 on #F6F4ED passes).
- DR10 Q1 (drop Replace ding) recommendation is right only if the ding route is proven reachable by keyboard and by tap: held or selected note then tap ding via `editorDingButtonPlan`. Add tests: keyboard Enter on ding with a held note; tap ding with a selected note; the pill had a visible label, the ding has none, so the hint/aria-label on the ding must say what it does.
- DR11 Neotone parity: tab/layout differences are fine, but the Layout tab for Neotone has Mirror + Rotate only (shorter) and Reset spacing is disabled; show disabled not hidden for parity. The name field edits `options.name` with no suffix while the legacy sheet appends `sheet.neotone_name_suffix`: a user sees different names for the same scale across surfaces; decide before N1. "Main/Mutant" (Q5) must be checked against the Neotone page's existing vocabulary in all 8 languages; fall back to the page's own terms if they differ. Recommendation to show labels (not hide) stands.

Low
- DR12 Counts block: 12px text on `#0F0E0B`; contrast passes at #D8D3C6 but over-cap (14/12) and full need a non-colour cue (weight or "full" text), and the count line must not be `aria-live` (placements already announce via `#editor-status`).
- DR13 320px: mock chips are 6 columns, gap 6, padding 12 = 44.0px at 320 with zero slack; any border/padding drift fails 44px. Plan the fallback now (gap 4, or 4x3 grid below 340px). Octave row (octave control + Sharps|Flats) in German/Japanese: assert no wrap at 320, allow the toggle labels to drop the glyph text before wrapping.
- DR14 Language fit: tab labels are one word in en; verify German "Layout"/"Skala" equivalents and zh/ja stay one line; the "..." button needs a localized aria-label (`editor.more.aria` is listed, good); `editor.zone_count` with a placeholder must tolerate ja/zh word order.
- DR15 Q7 and Q8 recommendations are fine (German + Japanese; stack on the held lane head). Q2, Q5 right. Q9 (Rotate beside Mirror) right: Rotate is a layout operation and hiding it in "..." harms discoverability.

Owner hard conditions: pan SVG, hit targets and drag are untouched by design and pinned by T0 (frozen oracle lane is a strong control). The mock itself changes drag feedback (violet hot ring, "drop on full ring fills next open slot", shaking count); these are NOT in scope per D10 and the mock must not be read as a spec for them.

Verdict: NOT READY. Resolve DR1-DR3 (and decide DR4) in the plan, then READY.

## Independent eng review (2026-11-08, fresh reviewer, read-only)

SUPERSEDED by the plan body (sections 1-16, round 2): its "NOT READY" verdict describes the first draft; dispositions are in the Disposition log.

Verdict: NOT READY (4 high findings). Checked against `origin/dev` index.html and tests.
Verified true: `const ONE_PANEL = true ;` is one line on dev and `tests/helpers/editor_flag.js` depends on its exact shape; `EDITOR_CAPS` is rim 12, inner 6, bottom 12; `NEO_MAIN` 9, `NEO_SLOTS` 18; `editorDropPlan`, `editorNeoDropPlan`, `editorDragMeasure`, `editorDeleteTap`, `editorDisarmDelete`, `editorPanKey`, `editorTabStops`, `editorPillTap` exist; drop target is geometry only (`editorDropTarget` to `editorHitAt`), so A1 holds; there is no name input in the editor; `editorNeoMirror` and `editorNeoRotate` are consts on dev (via #996).

- H1 (high) Pan oracle ignores size and CSS. T0 hashes SVG markup and overlay only; D10 also covers how the pan looks on screen. A shorter panel changes `.editor-panbox` flex size, so the pan can render larger with byte-identical SVG. Fix: add bounding rects of `.editor-panbox`, `#editor-pan svg` and `.ehit` at 375x667 and 390x844 (and 900 landscape), plus an element screenshot diff of `#editor-pan`, to T0.
- H2 (high) Held-PR order and base are contradictory and stale. All six PRs are OPEN with base `main`. #985, #988, #992 heads are ancestors of dev; #977 (1 commit) and #982 (2) have commits not on dev; #994 has 4 commits not on dev but zero `index.html` diff (its code reached dev via #996). Section 8 says all must be on dev first; Q7 says stack on the latest held head. T0 "runs against unmodified dev" would freeze overlay output before #977 (a11y attributes) lands, then break. Fix: P0 records per PR `git diff origin/dev <head> -- index.html` and chooses ONE base; T0 base is the dev tip after every editor-touching PR is on dev; fixture header records that SHA.
- H3 (high) i18n sequencing breaks per-lane CI. P1 and N1 add visible strings but all keys land in I1 last; CLAUDE.md puts the i18n step inside each UI feature. I1 also "owns data/i18n only" yet regenerates `const I18N` inside `index.html`, against the single-owner rule. Fix: each lane adds its own keys (en plus 7 tables), syncs and audits in the same PR; I1 becomes fit/dead-key cleanup and names `index.html` generated region as owned.
- H4 (high) Mutants and tests retired by pill removal are unowned. Patches that target pill code: `oqa_a_full_not_dashed`, `oqa_a_full_pill_pick_first`, `oqa_a_pill_count_line_dropped`, `oqa_a_pill_full_dropped`, `u2f2_pill_*` (4), `dux_flash_not_marked_on_pill`, `dux_flash_not_marked_on_replace_ding` (dies if Q1 drops Replace ding), plus `oqa_a_toolbar_undo_always_visible`. They will fail to apply or survive, turning mutation red. editor_e2e has ~30 pill tests (D16, D17, D18, U2f-2 parity, OQA). Fix: P1 owns `tests/mutants/` retire/re-anchor list, FLOORS and README mutant-count updates, and a coverage-preservation table mapping each deleted pill test to its pan-tap replacement (full-zone refusal copy must stay tested).
- M1 (medium) Mutation scope. N1 persists `options.name` into saved scales. CLAUDE.md: a PR touching saved scales runs the full suite. Plan escalates only if `commitSaved` or storage changes. Fix: N1 runs full mutation.
- M2 (medium) Fit tooling. `tools/probe/panel_fit.js` has no editor cell and no lane owns it; A6 is stale because panel-fit real mode uses checked-in fonts (docs/testing/browser.md). Fix: assign the probe editor cell (8 languages, 375 and 320, both font modes) to a lane; cite the receipt format.
- M3 (medium) Landscape grid. At min-width 900 landscape the editor is a CSS grid with areas `areas`, `bar`, `tray`, `line`, `status`; the plan covers phones only. Fix: define tab strip/panel/action-row grid areas and test them.
- M4 (medium) Drag CSS list. Hide/slide rules also exist for `.settling` (pointer-events) and the reduced-motion block, not only `.dragging`. Fix: extend all three selector groups and add a mutant for each.
- M5 (medium) Tray index coupling. `editorDragSource` derives the chip index from `chip.parentNode.children`, so chips must stay the only children of `#editor-notes`. Fix: state it in 5.1 and test it.
- M6 (medium) Delete with a held note is deferred to "decide in the T-lane test" (section 11). Fix: specify it now.
- L1 (low) Dangling references: 5.8 cites 6.4, 6.1 and 8.3 (should be 13, T0, 9.3); header says owner questions are section 14 (they are 15). T0 mutants need an `index.html` patch but T0 "owns" no `tests/mutants/`. "drag-ux E1-E7": E1-E6 plus X4 found; confirm E7. Menu focus management (open, arrow keys, return focus) is not specified.
- L2 (low) Continuation point names no base SHA, worktree, lane branch names or Linear write; make it a checklist.

Checklist: no open blocker/high (FAIL: H1-H4); assumptions verified (partial: A5 unresolved); phases with prereqs/owner/deliverable/acceptance/verify (mostly; I1, D1 weak); pan-unchanged oracle (FAIL: H1); i18n (FAIL: H3); 375px real-font fit (partial: M2); recovery (pass); continuation point (partial: L2).

## Disposition log

Design review (section 17)
- DR1 fixed: counts block outside both panels (5.1, 5.3); Save and tab state is Q1.
- DR2 fixed: 16px input, autoName placeholder, commit before Save/Back/menu, drag ignores input (5.2, N1 tests). Soft-keyboard cover accepted (15).
- DR3 fixed: A4 corrected, fixed panel min-height, measurement first, "taller editor" withdrawn (5.9, Q6).
- DR4 owner decision: Q1 recommends violet Save, ink tab text with violet underline (reverses first draft).
- DR5 fixed: tab semantics, held banner on both tabs (5.1).
- DR6 fixed: menu keyboard, focus return, disabled kept, outside/drag close (5.6).
- DR7 fixed: Delete last under divider, ~400 ms guard, truncated name; Delete while held is Q7 (recommended allow).
- DR8 fixed: 44px measured, no mock CSS copied, header group measured (5.1).
- DR9 owner decision: Q3 recommends the mock hint, drops `editor.hint`.
- DR10 fixed: ding reachability tests gate dropping Replace ding (P1, Q2).
- DR11 fixed/owner decision: Neotone disabled-not-hidden parity (5.6); vocabulary and name suffix are Q5.
- DR12 fixed: non-colour cue, not aria-live, contrast (5.3).
- DR13 fixed: 320px chip fallback, octave row no-wrap (5.1).
- DR14 fixed: per-language fit and key word-order tolerance (5.3, I1 probe).
- DR15 noted: Q7/Q8/Q2/Q5/Q9 recommendations confirmed; renumbered in section 15.
- Owner hard conditions: unchanged; mock hot ring, fill-next-slot and shake explicitly out of scope (section 3).

Eng review
- H1 fixed: T0 geometry oracle (rects at 3 viewports, `--ed-mag`, element screenshot).
- H2 fixed: P0 per-PR diff, one base, fixture header records SHA; Q8.
- H3 fixed: each lane adds its own 8-table keys and syncs/audits; I1 is fit + dead-key cleanup and names the generated I18N region.
- H4 fixed: P1 owns pill mutant retire/re-anchor, ~30 pill tests via a coverage table, FLOORS and README counts; full-zone refusal copy stays tested.
- M1 fixed: N1 runs full mutation.
- M2 fixed: I1 owns the `panel_fit.js` editor cell, both font modes; A6 corrected.
- M3 fixed: landscape grid areas defined and tested (5.1).
- M4 fixed: `.dragging`, `.settling`, reduced-motion groups extended, one mutant each (P1).
- M5 fixed: chips are the only children of `#editor-notes`, tested (5.1).
- M6 fixed: Delete while held specified (5.6, Q7).
- L1 fixed: dangling refs corrected; T0 owns its mutants; E7 confirmed present on dev (E1-E7, E6b, E6c, X4); menu focus spec added.
- L2 fixed: continuation point is a checklist (16).

## Disposition log, round 2 (confirm review C1-C11)

- C1 NOT decided: made blocking owner Q1 (a: pan may grow with scale-identical geometry, recommended; b: identical absolute size); 5.9, R2, P1 acceptance, 9.1, 14.1, T0 geometry oracle rewritten.
- C2 fixed: T0 computed-style oracle per state; pixel fixture dropped; no skip on CI.
- C3 fixed: geometry oracle states its dozen models and captures `.dragging` and `.settling`.
- C4 fixed in the plan, owner Q3: M never carries held content; lanes cut after held PRs reach main; P0 checks validate dispatchability; contradictory "stack"/"dev tip" wording replaced.
- C5 fixed (round 8 F3: now nine): ten mutants listed with re-anchor targets; siblings apply-checked.
- C6 fixed: 5.2 two-input paragraph (`s.naming`, focus handoff, Escape order, tab stops, dirty, tests); "readonly" wording corrected; dead tmp reference removed.
- C7 fixed: merged Q5 states the loss of sighted ding discoverability; recommends a visible cue plus a visible-affordance test.
- C8 fixed: P1 removes retired keys (no unused-key check exists in `tools/sync_i18n.py`).
- C9 fixed: Q4 (Redo) decided, withdrawn alternatives dropped, Q2+Q3 merged; section 15 renumbered Q1-Q8 and in-body references updated.
- C10 fixed: Delete-while-held labelled "default, pending Q4".
- C11 fixed: supersede pointers under section 17 and the eng review; header status updated.

## Disposition log, round 3 (R3-1..R3-9)

- R3-1 fixed: lane N+1 stacks on lane N head, first lane on the editor RC head; M labelled "stacked on editor RC <sha>"; "merged main SHA" deleted (sections 8, 13, P0).
- R3-2 fixed: Q5 = drop; `editorDingButtonPlan`, `editorReplaceDingTap`, the button, `u2e3_ding_button_ignores_held`, U2e3-3 tests and `editor.replace_ding*` keys are retired in P1; T0 oracle no longer calls `editorDingButtonPlan`; reachability tests use pan tap, `editorSelectTap`/`editorTrade`, `editorPlaceHeld` and `editorPanKey`.
- R3-3 moot: Q1 (a) answered; branch (b) text removed.
- R3-4 fixed: T0 mutants defined for a ratios-only assertion; `--ed-mag`-dependent transforms excluded from the computed-style comparison.
- R3-5 fixed: P0 step 3 lists answered and open questions.
- R3-6 fixed: 5.5 hides counts and held banner during a drag; pinned in T0 `.dragging`.
- R3-7 fixed: D1 prereq/test/verify, I1 acceptance and verify, P1 and N1 verify lines.
- R3-8 fixed: "state-chip rule" replaced by a concrete statement; header notes log Q numbers are historic.
- R3-9 fixed: Q6 label wording needed before P1, fallback Main/Mutant/Ding.

## Independent confirm review (2026-11-08, fresh reviewer, report-only)

Checked against `origin/dev` (8d08667a) `index.html`, `tests/mutants/`, `tests/helpers/editor_flag.js`. Verdict: NOT READY (1 blocker, 3 high, 4 medium, 3 low). Of the 30 DR/H/M/L findings, 28 are fixed in the plan body; the exceptions are H1 (partly) and H4 (partly), below.

Blocker
- C1 P1 acceptance contradicts the goal. Evidence: dev CSS `#editor .editor-panbox{flex:1 1 0; min-height:0}` and `#editor-pan svg{height:100%}`: the pan's on-screen size is a direct function of the height left over by the controls. A shorter panel makes the pan larger, so "T0 rects identical at 375x667/390x844/900" (P1 acceptance, 9.1, 14.1) is either unsatisfiable or satisfied only by making the new panel exactly as tall as the old stack (no gain, goal 1 void). 5.9 and Q6 frame the issue as magnification drift only and say "same fixed min-height on both tabs", never against the old stack height. Fix: owner states which he means by "visual UI unchanged": (a) pan pixel size at rest may grow with freed space, rings/notes/hit geometry scale-identical (then the oracle compares the SVG size normalised by panbox size, and T0 pins the panbox-to-svg ratio and viewBox, not absolute rects), or (b) pan size must stay identical (then the panel min-height must equal the dev stack height; say so and drop the "pan stays visible" gain). Make this Q6 and a blocker for P1.

High
- C2 T0 screenshot oracle will skip in CI. Evidence: T0 records pixel-zero diff "and skips with a printed reason if the Chromium build differs"; fixture would be generated on the owner's macOS, CI is Linux with web fonts blocked (memory ci-harness-blocks-web-fonts). Result: the only check on ring/note CSS (stroke, fill, dash, font) never runs where it gates. Fix: generate the screenshot fixture in CI's environment (or drop pixel diff) and add a deterministic computed-style oracle: getComputedStyle of `.editor-panbox`, `#editor-pan`, svg, and every distinct class in `#editor-pan` (`ehit`, `etarget`, `epin`, `eslot`, `esel`, `edrop`, note text), recorded per state (rest, selected, held, dragging). Make the skip a failure on CI.
- C3 T0 geometry oracle is rest-state only and model-unspecified. Evidence: rects are listed "at 3 viewports" with no model list; drag-time geometry is `--ed-mag` after "a synthetic drag lift" only. Fix: state the models (reuse the dozen from the hash oracle) and capture rects during `.dragging` and `.settling`, since P1 edits those selector groups (M4).
- C4 "Main PR stacks on main" vs "base is the dev tip" contradiction. Evidence: section 8 "Order against held PRs" says this lane's main PRs stack on main with held PRs open and unmerged; section 13 and P0 say the base is the dev tip after every held PR is on dev (and cites `lane-branches-stack-on-main-not-dev`, which warns that dev-based main PRs go red/carry dev content). A dev-based PR M would carry #977/#982 content into main ahead of the owner's merge. Fix: say how M is built (e.g. M targets main only after those PRs merge, or M is a branch off main with the held PRs' diffs cherry-picked and flagged), and reconcile section 8 with section 13.

Medium
- C5 H4 is incomplete. Evidence: mutants whose patches reference moved DOM and are not in the P1 retire/re-anchor list: `dux_panel_only_faded_not_hidden`, `oqa_a_stack_not_centred`, `oqa_a_zone_kept_on_lift`, `oqa_b_lift_keeps_rings`, `tri59_delete_first_tap_deletes`, `tri59_delete_never_disarms`, `tri59_octave_cell_wide`, `tri59b_disarm_repaints_the_pan`, `tri59c_mirror_tap_inert`, `u2e3_toolbar_nowrap`. The generic "apply-check every patch" rule catches them but the named list and the lane-ownership claim do not. Fix: add them to the list with re-anchor targets (Delete mutants move to the menu item; `tri59_octave_cell_wide` to the Sharps|Flats row).
- C6 Second text input not addressed. Evidence: `#editor-line` on dev is already an editable input (`editorStartEdit` sets `s.editing`; `editorDragDown` returns early while `s.editing`; `editorStopEdit`). Plan 4/5.2 calls it "readonly" and adds a name input beside it with its own commit/blur and a drag guard on the press target. Not covered: how the two inputs interact (focus, Escape, Enter, `editorTabStops` trap, dirty tracking, whether typing a name sets `s.editing`), and which one the soft keyboard and "type name then Save" tests exercise. Fix: add a 5.2 paragraph and tests for focus handoff between the two inputs and Escape ordering.
- C7 Q2 + Q3 together remove all sighted discoverability of the ding swap. Evidence: dev `editor.hint` is "Drop a bottom note on the ding to swap it with the root"; Q3 drops it, Q2 drops the Replace-ding button, and the replacement is an aria-label (screen readers only). Fix: make the Q2 question state this cost plainly and recommend a visible cue (ding label in the counts block or the hint kept as a second line), or have the reachability tests include a visible-affordance check.
- C8 H3 residual. Evidence: P1 retires pill code while `editor.pill.*` / `editor.pill_aria.*` / `editor.areas.aria` keys stay until I1; if the i18n audit flags unused keys, P1's CI fails. Fix: P1 states whether the audit tolerates unused keys, or removes them in P1.

Low
- C9 Q4 (Redo in "...") and Q8 (base, "alternative withdrawn") and Q6 ("taller editor withdrawn") are not real trade-offs: D6 already owner-approved Redo in the menu; Q8/Q6 list a withdrawn alternative. Fix: move to Decisions, keep owner questions to Q1, Q2/Q3 (merge), Q5, Q7, Q9, Q10 plus the new C1 question.
- C10 Delete-while-held (5.6, 11, P1 tests) is stated as "decided" while still open as Q7. Fix: label it "default, Q7".
- C11 Sections 17 and the eng review still read "Verdict: NOT READY" with no pointer that the body now supersedes them; add one line so a reader of the file top-down is not misled. Dead reference: 5.1 says the pan "keeps its ids"; header comment cites `/tmp/dev_index_plan.html` which no longer exists (harmless, anchors are symbols).

Checked and fine: ONE_PANEL line shape, byte-test in T0 and no-toggle stance (D11) consistent across 5.8, T0, 13; drop-plan oracle and A1; chips-only-children coupling (`editorDragSource` uses `chip.parentNode.children`, confirmed); E7 exists; landscape grid description matches dev; N1 full mutation; per-lane i18n; lane sequence is serial with disjoint ownership except shared `tests/suite_health.py` FLOORS and README count (T0 then P1 then N1, serial, acceptable); verify commands present for T0, P1, N1 (inherits 9.1); Delete spec, menu spec and tab semantics are complete.

pending-linear-writes: []

## Independent round-3 review (2026-11-08, fresh reviewer, report-only)

Checked against `origin/dev` (8d08667a) `index.html`, `tests/mutants/`, `tests/helpers/editor_flag.js`. Verdict: NOT READY (2 high, 4 medium, 3 low). All DR, H, M, L and C1-C11 findings are fixed or correctly escalated in the body, except where noted below. Q1 is treated as open; the findings marked (Q1) only check that the plan branches on it correctly.

High
- R3-1 Section 13 contradicts itself and the "no main merge" rule. Evidence: section 13 says "each next lane's base is the previous lane's merged main SHA" but also "M stays open until the owner says merge. No main merge." No lane M merges, so there is no merged main SHA for N1 to base on. Section 8 says the lane branch is "main plus the lane diff", so P1's M (cut from main) lacks T0's fixture and tests, though P1's prereq is "T0 on dev" and its acceptance is "T0 oracles unchanged" (validate on M would not run them). Memory `lane-branches-stack-on-main-not-dev` says to base on the previous lane head. Fix: state that lane N+1 branches from lane N's head (main plus all earlier lane diffs), M carries the stacked diff and is labelled, D targets dev; delete "merged main SHA".
- R3-2 Dropping Replace ding (Q5 recommendation) strands code and tests the plan freezes. Evidence: on dev `editorDingButtonPlan` is called only by `editorReplaceDingTap`, bound to `#editor-replace-ding`; pan-tap on the ding goes through `editorPlaceHeld`/`editorSelectTap` (-> `editorTrade`), not that function. T0's drop-plan oracle calls `editorDingButtonPlan` and P1's reachability test cites it, yet with the button gone it is dead code (P1 deleting it fails the T0 "unchanged" acceptance). The retire list names `dux_flash_not_marked_on_replace_ding` only; mutant `u2e3_ding_button_ignores_held` (patches `editorDingButtonPlan`), the U2e3-3 button tests and the `editor.replace_ding*` keys are not listed or branched on Q5. Fix: branch the P1 retire list on Q5 (button dropped: retire that mutant and the button tests, remove the keys, and either keep `editorDingButtonPlan` as a frozen pure function or take it out of the T0 oracle; reachability tests assert `editorSelectTap`/`editorPlaceHeld`/`editorPanKey` instead).

Medium
- R3-3 (Q1) Branch (b) oracle is not satisfiable as written. Evidence: dev's control stack height varies by model and language (`#editor-pills` hidden for Neotone, wrapping `editor.hint`), so "panel min-height equals today's control-stack height" and "absolute rects equal" for the whole dozen-model set cannot hold with one fixed value. Fix: under (b) say which stack the min-height matches (Standard, English) and restrict absolute-rect assertions to it, or assert per model and accept that Neotone differs.
- R3-4 (Q1) T0 mutant "shift `.editor-panbox` height by 1px" survives under (a): there `#editor-pan svg{height:100%}` keeps the svg-to-panbox and ehit-to-svg ratios unchanged and only ratios and viewBox are asserted. Fix: define the mutant per branch (a: change the svg width/viewBox or an ehit offset; b: the 1px shift). Also under (a) the computed `transform` in `.dragging` carries `--ed-mag`, which legitimately differs; exclude it or compare normalised.
- R3-5 P0 step 3 says defaults apply "except the Save fill, which blocks P1", but section 15 and 16 say Q1 (pan size) and Q2 (Save) block P1 and Q3 blocks any lane push. Fix: align P0 step 3 to "Q1 and Q2 block P1, Q3 blocks pushing".
- R3-6 Drag room measure vs counts block. 5.5 lists the tab strip, panels and action row as hidden under `#editor.dragging`; the P1 CSS group text adds "counts". On dev `editorDragMeasure` computes `room` from `root bottom - panbox bottom`, so whether the counts block and held banner stay visible during a drag changes the magnification. Fix: state in 5.5 whether counts and the held banner hide or stay, and pin it in T0's `.dragging` state.

Low
- R3-7 Lane completeness: D1 has no prereq, deliverable test or verify command; I1 has no explicit acceptance line; P1 and N1 verify only by reference to 9.1. Fix: one line each.
- R3-8 Dangling references: P1 tests list a "state-chip rule" defined nowhere; the Disposition logs cite pre-renumbering question numbers (DR3 "Q6", DR4 "Q1", DR9 "Q3", DR10 "Q2", DR11 "Q5", DR7/M6 "Q7", H2 "Q8"). Fix: define or drop the rule; add one line saying log Q numbers are historic.
- R3-9 Section 5.4/Q6: P1 adds the Neotone count labels but the wording is Q6, decided "before N1". Fix: say Q6 wording is needed before P1 (fallback "Main/Mutant/Ding" applies if unanswered).

Checked and fine: lane order and ownership overlap (serial; shared FLOORS and README count acceptable); N1 full mutation; per-lane i18n and P1 key removal (no fixture holds `editor.pill*`, so R8 is benign); ONE_PANEL line handling and the `editor_flag.js` single-line constraint; PR M/PR D construction otherwise matches CLAUDE.md "Dev first" and the Q3 dependency is real (validate runs only on PRs into main); 5.2 two-input handling; Q1 branches in acceptance, 9.1, 14.1 and R2; section 15 questions are real trade-offs with the recommendation first (Q4, Q7 and Q8 are minor but legitimate).

pending-linear-writes: []

## Independent round-4 review (2026-11-08, fresh reviewer, report-only)

Checked against `origin/dev` (8d08667a) `index.html`, `tests/mutants/` (the 20 named mutants all exist), `tests/helpers/editor_flag.js`, and origin branch ancestry. Verdict: NOT READY (1 high, 3 medium, 6 low). All DR, H, M, L, C1-C11 and R3-1..R3-9 findings are fixed in the body except as noted. Q4, Q6, Q7, Q8 are treated as open owner decisions, not defects.

High
- R4-1 "The editor RC head" is not an existing, identifiable base. Evidence: `origin/claude/release-rc-2026-11-06` (#912) does NOT contain #985, #988, #992 or #994 (none are ancestors of it; the four are ancestors of dev or of #994), and #977 (`scale-editor-u2g`) and #982 (`scale-editor-u2h`) are in neither chain. No branch holds RC plus the held tail. P0 step 1 says land any non-empty-diff PR on dev first AND "ONE base: the editor RC head"; "Order against held PRs" says all six on dev before T0; Q3 says stack on the RC head. A fresh implementer cannot pick a SHA, and every fact in section 4 was read from dev, not from that base. Fix: P0 must name the exact branch and SHA (or the step that builds it, for example a `claude/editor-rc-base` merge of the RC and the six heads, verified to carry dev's editor code), state that section 4 facts are re-read at that SHA, and delete one of the two contradictory prerequisite statements.

Medium
- R4-2 T0 does not freeze the drag source, and N1 edits it against the non-goal. Evidence: section 2 freezes `editorDragDown` to `editorDragEnd`, but 5.2 has N1 add an `s.naming` early return in `editorDragDown` (also `editorPanTap`, `editorPanKey`). T0 is behavioural plus pure-function only, so such an edit passes silently. It is also unnecessary: `editorDragSource` returns null for a press on an input (target is neither `.tray-note` nor inside `#editor-pan`). Fix: add a T0 source-hash test over the named frozen functions and constants (`editorDragSource`..`editorDragEnd`, `editorHitAt`, `editorDropPlan`, `editorNeoDropPlan`, `EDITOR_HIT_AREA`, `EDITOR_SCALE`); in 5.2 drop the `editorDragDown` guard (keep the test that a press on the input starts no drag), and limit `s.naming` to `editorPanTap`/`editorPanKey` if those are not in the frozen list, or add a mutant proving it.
- R4-3 The ding aria-label requirement conflicts with the pan hash oracle. Evidence: the ding `.ehit` label is `editor.note.aria_ding`, emitted inside the pan SVG by `editorWithOverlay`, which T0 hashes. P1 tests require "the ding has an aria-label that says what it does". Changing it breaks the "SVG hashes unchanged" acceptance and D10; leaving it fails the P1 test. Fix: state that the ding `.ehit` markup stays byte-identical, and put the "what it does" text in the visible cue element outside the SVG (and `#editor-status`); change the P1 test to assert the cue, not the SVG label.
- R4-4 Where the hint and ding cue live is unspecified. Evidence: 5.1's ordered list (counts, held banner, tabs, panels, action row) has no hint element; Q5 requires a rendered second hint line and a visible-affordance test; the hint wording itself is only in the scratchpad mock and in the logs. If placed in the Scale panel it vanishes on Layout; if outside it also needs the `.dragging` hide group (5.5). Fix: add the hint to 5.1 (outside both panels, beside the counts), state both English lines verbatim, add it to the 5.5 hide list and to T0's `.dragging` pin. Related: the default tab on open, after Neotone/Standard switch and after palette swap is never stated; Scale must be default (tray chips are drag sources, drag-ux E1-E7 run unmodified), and the plan should say chips are not draggable from the Layout tab (pan-note drags and held placement still work) so the owner sees that cost.

Low
- R4-5 I1 cites "Asserts (see 9.3)" and the logs cite 9.1, R2, section 11; the body has no sections 9-12. Inline the I1 assertion list (44px targets, no wrap at 320 de/ja, contrast pairs, counts text >= 12px).
- R4-6 Section 4 says `editorDropPlan` returns `{info}` "via `editorDingButtonPlan`"; it is the reverse (`editorDingButtonPlan` calls `editorDropPlan` and is the only `{info}` source). No effect on the retire list.
- R4-7 Stale text: the "Not decided" paragraph in section 3 still lists Save fill, Replace ding and lane base (answered); 5.7 still reads "Revised recommendation ... if the owner keeps ink" though Q2 is answered violet Save; Q3 in section 15 ends mid-sentence ("Recommended: the owner"). Tidy so an implementer does not pick the alternative.
- R4-8 Retire list omits mutants that grep onto moved DOM: `oqa_a_tray_offpan_removes`, `i18n_region_inside_wrapper`, `i18n_swap_two_keys`; the generic apply-check covers them, but name them. The `editor_e2e` hint assertion (`editor-hint` text) is not in the coverage table.
- R4-9 R3-6 rationale is wrong: `editorDragMeasure` reads geometry (rects), so hiding the counts block does not change `room`; hiding is still right (the scaled pan would overlap it), but T0 should pin visibility, not magnification, for it.
- R4-10 M is a 100+ commit diff against main (stack on RC), so "scoped mutation" and the validate gate effectively run the whole editor; P0 should note this and that an RC-side red blocks every D merge. P1's acceptance has no contrast check for the violet Save (deferred to I1).

Checked and fine: Q5 drop is consistent (`editorDingButtonPlan` has exactly two references, both in the removed path; ding tap/trade stays reachable via `editorSelectTap`/`editorPlaceHeld`/`editorPanKey`); ONE_PANEL line and `editor_flag.js` byte shape; chips-only-children coupling (`editorDragSource` uses `chip.parentNode.children`); `editor.zone_full`, `editor.say.pick_first`, `editor.full.*` stay used so the P1 key-removal list is right; the 20 named mutants exist; T0 ratio, computed-style and drop-plan oracles are sufficient for "pan visual unchanged" once R4-2 and R4-3 are fixed; lane order, ownership, verify lines coherent; stacking on the RC head matches the owner answer and CLAUDE.md Dev-first apart from R4-1/R4-10.

pending-linear-writes: []

## Disposition, round 4 (R4-1..R4-10) and owner answers

| Finding | Disposition |
|---|---|
| R4-1 | Fixed: base is the named branch `claude/editor-rc-successor` (RC #912 head plus #977, #982, #985, #988, #992, #994, built after RC owner QA); P0 step 1 builds and verifies it (`function editorDropPlan` count, ONE_PANEL line), records the SHA, re-reads section 4 facts; "land on dev first" deleted. |
| R4-2 | Fixed: T0 source-hash oracle over the frozen drag/plan functions and constants; 5.2 no longer edits `editorDragDown`; `s.naming` only in `editorPanTap`/`editorPanKey` with a mutant. |
| R4-3 | Fixed: ding `.ehit` markup stays byte-identical; "what it does" text in the visible cue and `#editor-status`; test asserts the cue. |
| R4-4 | Fixed: hint element specified in 5.1 with both English lines, hidden during drag; default tab Scale; chip-drag cost on the Layout tab stated. |
| R4-5 | Fixed: I1 assertion list inlined. |
| R4-6 | Fixed: section 4 sentence corrected. |
| R4-7 | Fixed: section 3 "Not decided" replaced, 5.7 reads as the owner decision, Q3 sentence completed. |
| R4-8 | Fixed: three mutants named; hint assertion row added to the coverage table. |
| R4-9 | Fixed: 5.5 rationale corrected; T0 pins visibility, not magnification. |
| R4-10 | Fixed: P0 notes the 100+ commit M diff and RC-side red blocking D merges; P1 asserts Save contrast. |
| Q4 | Answered: allow, keep the hold. |
| Q6 | Answered: Neotone page's own terms; suffix stored; 8-language wording check is a P1 prerequisite. |
| Q7 | Answered: German and Chinese. |
| Q8 | Answered: same controls, same behaviour on both profiles; named dependency on `docs/plans/2026-11-08-unified-first-toggle.md`, no scope widening. |

## Independent round-5 review (2026-11-08, fresh reviewer, report-only)

Checked against `origin/dev` (8d08667a), `origin/claude/release-rc-2026-11-06` (#912, 293cda3e), the six held heads (all OPEN, base main), `tests/helpers/editor_flag.js`, and a throwaway worktree (discarded) that merged the RC and the six heads in order. Verdict: NOT READY (1 high, 3 medium, 4 low). All R4 findings are fixed in the body; the problems below are new or are gaps in how the owner answers are carried.

Merge-test result: RC + #977, #982, #985, #988, #992, #994 merged in that order with ONE conflict, `README.md` (identical on every merge; take either side). `index.html` and `tests/app.test.js` auto-merge. The result has exactly one `function editorDropPlan`, `const ONE_PANEL = true ;` byte-identical, and zero editor-code lines different from dev (its `index.html` diff against dev is only dev's login-sync and I18N region, not editor code), so the section 4 facts hold at that base.

High
- R5-1 The Q8 owner answer has no lane that delivers it. Evidence: 5.4 and P1 defer Rotate/Mirror parity to `docs/plans/2026-11-08-unified-first-toggle.md`, which is untracked, status DRAFT, "nothing built", and whose own Non-goals (line 22) and L9 say "Rotate buttons stay Neotone-only and Mirror Bottom stays Standard-only". So the named dependency can never produce the owner's "same controls, same behaviours"; P1's parity test asserts against "the base's control set" (vacuous), and the fallback is "ship the base's controls, record the gap". Also unordered: that plan edits `#editor-layout`, which P1 re-parents, and neither plan says which lands first. Fix: either add a lane (after P1, owner of Rotate/Mirror parity on both profiles) or amend the unified plan's L9/Q2 and order it explicitly (before T0, so T0 freezes the final controls, or after P1 with a re-point step); and make P1's test list the exact expected Layout controls per profile instead of "the base's set".

Medium
- R5-2 The lane D PRs cannot merge to dev as described. Evidence: merging the successor head into `origin/dev` conflicts in `README.md`, `tests/app.test.js` and 16 `tests/mutants/*.patch` (including `i18n_region_inside_wrapper`, `i18n_swap_two_keys`, `u2e_move_no_swap`, which P1 must re-anchor), because the RC base has older versions of files dev changed. Section 13 requires D "not CONFLICTING" from the same head as M. The conflict rule in "Order against held PRs" covers only building the successor. Fix: state that each D is a `claude/dev-merge-<lane>` PR that merges the lane head into dev and resolves these files taking dev's version, or build D from dev plus the lane diff; and add the `README.md` conflict (take either side) to P0 step 1.
- R5-3 Stale contradiction with Q8. Evidence: section 14 item 4 still reads "Layout tab shows Mirror, Note 1 (Standard) or Mirror/Rotate (Neotone)", and the 5.4 table gives Neotone zone labels "Main n/9, Mutant n/9" while Q6 says the Neotone page's own terms. An implementer testing against 14.4 would assert per-profile control sets. Fix: rewrite 14.4 to "same controls on both profiles"; mark the 5.4 labels as placeholders until the P1 wording check.
- R5-4 Owner answer Q7 (phone check in German and Chinese) is wired to nothing. Evidence: appears only in section 15 and the disposition table; no lane, acceptance line or release gate names a de/zh phone check, and I1 covers all 8 languages by probe only. Fix: add it to I1 acceptance or section 13 as the owner's manual phone check (de, zh-Hans/zh-Hant) on served DEV.

Low
- R5-5 N1/Neotone name is ambiguous: "edits the stored name verbatim" but Q6 says "stored with the suffix". State: blank name on Neotone stores the suffixed `autoName` or stores nothing and displays the suffix; N1's round-trip test needs one answer.
- R5-6 P0 "git diff origin/dev successor -- index.html empty or explained": it is non-empty (dev's login-sync and I18N region, not editor code); say that diff is expected and only editor symbols must match.
- R5-7 No broken earlier fix found in T0 source-hash vs N1/P1: the frozen range (`editorDragSource` to `editorDragEnd`, `editorDragMeasure`) references only `#editor-pan`, `#editor-tray .tray-note`, `#editor-status` and `.editor-panbox`, all kept; N1's `s.naming` is limited to `editorPanTap`/`editorPanKey`, outside the hash. Note `editorDragMeasure`'s `room` is layout-based (root bottom minus panbox bottom), so a shorter panel does reduce drag magnification; this is the accepted Q1 cost, but 5.9's A4 wording ("depends on root height") understates it.
- R5-8 Header line 3 says "sections 17, the eng review" (typo for section 17); log Q numbers are historic, already noted.

Checked and fine: owner hard conditions (drag and pan visuals frozen by T0 hashes, source hash, computed styles and ratios; no ONE_PANEL toggle; line untouched); ding cue and reachability; chip-only `#editor-notes`; pill retire list; per-lane i18n; Delete spec.

pending-linear-writes: []

## Disposition, round 5 (R5-1..R5-8)

| Finding | Disposition |
|---|---|
| R5-1 | Planned (round 6: the unified plan amendment is now written, its eng review is still pending): owner answer recorded (originally four controls; narrowed by Q10 to "# 1 centered" and "#1 / #2"); new lane PL before T0 owns the layout row and the unified-first-toggle outcome; that plan is to be amended (Mirror Bottom non-goal superseded) and needs its own eng review before build; P1's test lists exact controls per profile; Rotate unchanged and open as Q9 (later answered: dropped). |
| R5-2 | Fixed: each D PR is a `claude/dev-merge-<lane>` PR resolving toward dev; README conflict and the dev-side conflict files added to P0 step 1. |
| R5-3 | Fixed: 14.4 rewritten; 5.4 Neotone labels marked placeholders until the Q6 wording check. |
| R5-4 | Fixed: Q7 German and Chinese owner phone check on served DEV added to I1 and section 13. |
| R5-5 | Fixed: blank Neotone name stores nothing and displays the suffixed autoName; new scale is seeded with it; N1 round-trip test. |
| R5-6 | Fixed: P0 says the successor-vs-dev index.html diff is non-empty by design; only editor symbols must match. |
| R5-7 | Fixed: A4 wording says a shorter panel does reduce drag magnification (accepted Q1 a cost). |
| R5-8 | Fixed: header typo corrected. |

## Disposition, Q9 (owner 2026-11-08: drop Rotate)

Q9 closed. Rotate is removed from the control set, the 5.4 matrix, 14.4, P1's expected controls and the checklist. Lane PL owns the removal (files, tests deleted, rewritten or inverted, mutants retired or re-anchored, i18n keys) and the compatibility proof that stored rotated `profile.map` layouts, share links and saved scales still decode and render; D1 rewrites the CARD-SPEC paragraph. Review-log mentions of Rotate (DR11, DR15) are historic.

## Independent round-6 review (2026-11-09, fresh reviewer, report-only)

Checked against `origin/dev` (8d08667a) `index.html`, tests, mutants and i18n tables; the untracked `docs/plans/2026-11-08-unified-first-toggle.md`; remote branch list (no `claude/editor-rc-successor` yet, by design). Verdict: NOT READY (1 blocker, 2 high, 3 medium, 2 low).

Blocker
- R6-1 PL cannot deliver the Neotone "#1 centred / #1 / #2" control within its own scope. Evidence: on dev `editorRenderLayout` hides `editor-anchor-one`/`-between` for a profile and `editorSetAnchor` is a no-op for a profile; `HPE.core.readProfile` refuses `anchor` (PROFILE_CONFLICT). The only designed route is unified-first-toggle Option B: lift the conflict, `solve` turns fixture angles by 20 degrees, new `geom.turn`, share wire v9, saved record v7, `pdfcards`/`hifi.py` consumers, engine corpus additions, ENGINE-SPEC edits, full mutation. PL says "no engine, share or storage code" and section 13 says the change does not touch `#s=` or saved-scale storage; both are false once PL includes that outcome. Fix: split PL into PL-a (UI row: Mirror Bottom on Neotone, Rotate removal; no engine) and PL-b (the unified-toggle engine lanes E/A1/A2, own review, full mutation, version bumps owner-gated per its D2), or state the Neotone anchor control is disabled until PL-b; correct PL's ownership list and section 13 release-safety text.

High
- R6-2 Mirror Bottom has no defined behaviour on Neotone. Evidence: dev `editorNeoMirror` permutes main AND mutant rings together (`tri59c_mutant_ring_stays` pins that mutants stay under their field); the unified plan says "Neotone has no separate bottom mirror" (Q2 default no change). The panel plan only writes "Mirror Bottom (mutants)". Fix: specify Mirror Top = main ring only, Mirror Bottom = mutant ring only (a slot-9..17 permutation, no stored field), disabled with no mutant note, with undo and the status line; say what happens to Mirror Top's current both-rings behaviour and its mutants/tests; add PL tests and mutants for it.
- R6-3 Test and mutant ownership gaps in the Rotate removal list. Evidence (dev): (a) `tests/app.test.js` i18n contract test enumerates `addedKeys` (it contains the six `editor.neo.rotate*`/`say_rotate*` keys, and `editor.replace_ding*`) and asserts `Object.keys(en).length === keyCount + 16 - retired + addedKeys.length`; deleting or adding any key (PL, P1, N1) fails it unless that list is edited, but PL says app.test.js is "apply-check only" and no lane owns app.test.js. (b) `editor_e2e.test.js` "TRI59c a rotation is not kept when the last mutant note goes (accepted)" clicks `#editor-rotate-cw` and is not in the delete list. (c) The e2e fit test lists the rotate ids in its per-language loop (harmless, `if (!e) continue`, but should be cleaned). (d) `tri59c_mirror_tap_inert` has the two rotate `onclick` lines as hunk context, so it fails to apply after removal (PL lists it for re-anchor; confirm). Fix: add tests/app.test.js (the `addedKeys` list and count arithmetic) to PL, P1 and N1 ownership; add (b) and (c) to PL.

Medium
- R6-4 Four controls versus one toggle. The owner list and P1's test say four controls (Mirror Top, Mirror Bottom, "#1 centred", "#1 / #2"); the unified plan D4 replaces the two anchor buttons with ONE toggle `editor-anchor-toggle` (three controls). PL claims to deliver the unified outcome. Decide one and write it in 5.4, P1 and PL (owner decision, below).
- R6-5 R5-1's disposition says the unified plan "is amended"; it is not. `docs/plans/2026-11-08-unified-first-toggle.md` is untracked and still says "Rotate buttons stay Neotone-only and Mirror Bottom stays Standard-only" (non-goals, L9, Q2), and has no back-reference to this plan. The checklist box is correctly unticked; the disposition word "Fixed" overclaims. Fix: amend it (or mark the disposition "planned") and have its own `/plan-eng-review` before PL; the unified plan's headline sequencing (one main release, E + A1 + A2) must also be reconciled with panel lanes stacking on the editor RC.
- R6-6 Compatibility proof is sound in design but narrower than claimed. Rotate exists on dev only (origin/main has no editor code), so rotated `profile.map` data exists only on DEV links and DEV saved records; Rotate writes only a permuted `options.profile.map` through `editorNeoBuild`, so removal changes no decoder. The proposed committed rotated-map fixture is the right proof. Add: generate it from a dev build before removal, and assert share round-trip and re-save byte equality, not only SVG hash. Once R6-1 adds wire v9, the same fixtures must also cover "old v7 links still decode" (already in the unified plan).

Low
- R6-7 `token-check.json` is cited bare; it lives at `docs/plans/assets/2026-11-02-field-guide/token-check.json` (not under tests/fixtures). Name the path.
- R6-8 Header line 3 still calls sections 1-16 current while PL's text carries phrases like "What exists after P0 (from #994/#996)"; dev already has #996, so say "exists on dev" and re-verify at the successor SHA (P0 already does).

Prior findings verified in the repo: R4-1 (named base and merge-test result consistent with branch list: RC 293cda3e, six heads present; the successor branch is created in P0, not yet), R4-2/R4-3/R4-6 (symbols exist: `editorDingButtonPlan`, `editorDropPlan`, frozen range), R4-8 (the 20 mutants and `tri59c_*` set exist), R5-2, R5-3 (14.4 and 5.4 now read same-controls), R5-4 (Q7 in I1 and section 13), R5-5, R5-6, R5-7, R5-8. Rotate removal list matches dev for: `editorNeoRotate` (const beside `editorNeoPermute`), the two buttons in `editorOpen`, the show/disable loop in `editorRenderLayout`, the two `onclick` lines in `editorWire`, six keys x 8 tables, five `tri59c_rotate_*` mutants, TRI59c M1/M2/M5/M6/M7 and the three named e2e tests. Not fixed: R5-1 (see R6-1, R6-2, R6-5).

pending-linear-writes: []

## Disposition, round 6 (R6-1..R6-8) and owner answers

Owner answers (2026-11-09, via the coordinator): (1) "#1 centred" and "#1 / #2" stay TWO buttons. (2) Neotone "#1 / #2" engine work is a separate lane PL-b in the same editor release; PL-a is the UI row and ships it disabled. (3) Neotone Mirror Top = main ring only; Mirror Bottom = mutant ring only.

| Finding | Disposition |
|---|---|
| R6-1 | Fixed: PL split into PL-a (UI row, no engine/share/storage code; Neotone "#1 / #2" present but disabled) and PL-b (unified-toggle engine lanes E/A1/A2: own `/plan-eng-review`, full mutation, owner-gated version bumps, old v7 links still decode). PL ownership list and section 13 release-safety text corrected. |
| R6-2 | MOOT (owner Q10, 2026-11-09): the Mirror controls are dropped on both profiles, so there are no Mirror semantics to define. The interim Mirror split text was replaced by the removal list; `tri59c_mirror_*`, `tri59c_mutant_ring_stays` and `tri59c_neotone_mirror_pressed` are retired, not rewritten. |
| R6-3 | Fixed (counts now nine keys after Q10): `tests/app.test.js` (`addedKeys`, count arithmetic) owned by PL-a, P1 and N1; the "a rotation is not kept when the last mutant note goes (accepted)" e2e added to PL's delete list; fit-loop rotate ids cleanup added; `tri59c_mirror_tap_inert` confirmed as needing re-anchor. |
| R6-4 | Fixed: "two anchor buttons" written in 5.4, P1 and PL (the control set is now just the two anchor buttons after Q10); owner confirmed two buttons, not the unified single toggle. |
| R6-5 | Planned/Fixed in text: `2026-11-08-unified-first-toggle.md` amended (non-goal, L9, Q2, two buttons, Mirror split, back-reference, sequencing reconciled with the panel lanes). Its own `/plan-eng-review` before PL-b is still PENDING. R5-1 disposition re-marked "Planned". |
| R6-6 | Fixed: rotated-map fixture generated from a dev build before removal; asserts share round-trip and byte-identical re-save, not only SVG hash; PL-b fixtures add "old v7 links still decode". |
| R6-7 | Fixed: path named `docs/plans/assets/2026-11-02-field-guide/token-check.json` at the 5.7 Verification line. |
| R6-8 | Fixed: PL says "exists on dev", re-verified at the successor SHA in P0; header status line says so. |

Round 6b (owner Q10, 2026-11-09): Mirror Top / Mirror Bottom dropped on both profiles. Verified on origin/dev 8d08667a before writing: the editor Mirror code and keys are editor-only and are listed under PL "Mirror boundary"; the layout-sheet MIRROR buttons, `sheet.mirror_*` keys, engine mirror options, `resolveMirrors`, share/storage and the CARD-SPEC MIRROR rules are app-wide and stay. Superseded: round-6 answer 3 (Neotone ring split), R6-2. Scope change listed as owner-visible in the header, PL and Q10. (Superseded by round 7: #994 stays in the successor, section 16.) pending-linear-writes: [].

## Independent round-7 review (2026-11-09, fresh reviewer, report-only): NOT READY, no blockers, 3 high

Findings F1..F9 as sent by the coordinator; dispositions below.

| Finding | Disposition |
|---|---|
| F1 (high) PL-a removal lists incomplete | Fixed: PL tests list names editor_shell U2e2-3,4,5,9 (delete), 6 and 8 (split), 10 and 11 (convert to "mirrored scale still opens, edits and saves unchanged" from option literals), 7 (keep); e2e deletions and the 44px/toast EDIT; four `u2e2_*` mutants retired, `u2e2_anchor_same_adds_step` apply-checked; deletions enumerated by symbol at P0. |
| F2 (high) successor must include #994 | Fixed: section 16 and A5 rewritten: #994 stays in the successor (its commit also removes `#editor-layout-note`, `NEO_REASON` and the `tri59_neotone_reason_hidden` mutant that dev has via #996); PL-a removes Mirror/Rotate on top; never close #994 before the owner agrees. |
| F3 (high) tray chips Scale-tab-only | ANSWERED 2026-11-09 (Q11): Scale tab only, owner-accepted exception; P1 asserts it; no longer a P1 prerequisite. |
| F4 lane order | Fixed: T0 first on the P0 SHA, then PL-a with T0 green, then P1; Layout-control assertions in PL-a and P1. |
| F5 Q10 wording | Fixed: ONE_PANEL-true consequences stated; owner acknowledgement OPEN in Q10; test added that a mirrored scale stays fully editable by drag and save. |
| F6 disabled reason | Fixed: key `editor.neo.anchor_pending` x 8 owned by PL-a, removed by PL-b; "# 1 centered" on Neotone is disabled with `aria-pressed="true"`, "#1 / #2" disabled `aria-pressed="false"`. |
| F7 unified body | Fixed in the unified plan: pre-build rewrite list (D4, D6, D8, D9, A2 `editorNeoMirror` edits, base/R5-1 "#994 head is base of E", header "Sequenced AFTER"); A2 takes the Neotone-anchor hunks of tests P1 writes; P1 asserts "disabled until PL-b". |
| F8 PL-a verify | Fixed: node --test set, four corpus tests, validate.py, scoped mutation, CI validate at verified head; FLOORS and README mutant count added to PL-a ownership. |
| F9 docs and fixture | Fixed: CARD-SPEC paragraph removal moved into PL-a; D1's ENGINE-SPEC check is a no-op; permuted-map fixture is hand-built data. |

Round 7b (2026-11-09): Q11 and the Q10 acknowledgement are ANSWERED (section 15); neither blocks P1 or any lane. Remaining open before P1: only the Q6 wording check.

## Disposition, round 8 (F-T0-1, F1-F10)

| Finding | Disposition |
|---|---|
| F-T0-1 (blocker) geometry oracle not growth-proof | Fixed: T0 asserts `.ehit` size and offsets divided by the svg `getScreenCTM().a` (viewBox units) plus the viewBox; the svg-to-panbox and ehit-to-svg pixel ratios are dropped; oracle bullet, 5.9 fact, mutant note, P1 acceptance and 14.1 reworded. |
| F1 (high) missing e2e tests | Fixed: PL-a edits "U2e-2 palette chip, mirror and anchor" (drops `editor-mirror-*` ids) and splits the "MIRROR BOTTOM flips..." test, keeping the Standard anchor half. |
| F2 (high) `b_*` patches carry the I18N line | Fixed: standing rule for PL-a, P1, N1, I1 (apply-check all, `refresh_mutants.py`, own `b_*` and `i18n_*`). |
| F3 | Fixed: P1's `tri59c_mirror_tap_inert` re-anchor and `tri59c_mirror_*` sibling check deleted; the list is nine. |
| F4 | Fixed: T0 uses option literals only; "T0 green after removals" added to PL-a's gate. |
| F5 | Fixed: I1 specifies `--absolute` mode (or `--base <successor SHA>`). |
| F6 | Fixed: per-lane verify adds app.test.js, suite_health.py, test_readme_currency, mutant apply check; FLOORS down/up stated. |
| F7 | Fixed: section 13 release gate, default "PL-b required" (AFK auto-decision, owner may override). |
| F8 | Fixed: PL-a rewrites `editor.layout.aria` in 8 tables. |
| F9 | Fixed: PL-a `addedKeys` net -9 +1. |
| F10 | Fixed: disabled Neotone buttons until PL-b recorded as owner-visible, tied to F7. |
| Round 9 (READY_WITH_NITS) | N1: F2 count corrected to 13 of 21 b_* patches at origin/dev (re-count at lane start). N2: I1 owns a `parseArgs` test and an absolute-mode run for `--absolute`. N3: P1, N1 and I1 Verify lines add the standing rules F2/F6. |


## Resume checkpoint (2026-11-09, integrator)

Owner confirmed PL-b is REQUIRED in the editor release and #994 stays OPEN until the successor is
reviewed and ready to supersede it; this grants no closure or main merge. The current PL-b operative body
in `2026-11-08-unified-first-toggle.md` has been rewritten and independently confirmed READY_WITH_NITS;
the remaining LOW renderer wording nit is corrected there. The existing panel round-9 nits are represented
in this copied body (13/21 b_* count, I1 parseArgs/absolute-mode proof, standing verification references).
The canonical untracked original is preserved. Source refs remain RC912293cda3e, #994462beef8 and
DEV8d08667a until reverified. `claude/editor-rc-successor` is absent; P0 requires editor RC manual QA
before creation. Login RC QA comes first, then editor RC QA. No panel code has started. After those
prerequisites, retain T0→PL-a→P1→N1→I1→D1→PL-b. German and Chinese phone QA remain before the
panel release; no permission or successful device test is inferred from plan readiness.
