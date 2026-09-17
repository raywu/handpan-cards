# Scale add/edit: from drawer to page

Owner request, 2026-09-16, with four decisions taken in the interview that
followed. This plan covers the whole of that request and nothing else.

## Goal

Adding and editing a scale happen on a **full-screen page with a back button**,
not in a bottom drawer; the page **does not steal focus** on open; and on the
Edit page the LAYOUT controls act on a **pan diagram you can see and tap**,
so ROTATE and MOVE have a visible effect at the moment you press them.

## Non-goals

- No change to deck data, diagram geometry, the scale engine, chord selection,
  ranking, palettes, or the card renderer's output. `pan()` gains an OPTIONAL
  interactive layer; its existing two-argument output stays byte-identical.
- No change to the print pipeline. This workstream does not touch `tools/`.
- No new persisted fields. `options.order` already carries the layout
  correction; it is the same value, produced by a different interface.
- Not a visual restyle. Type, palette, spacing tokens and card anatomy are
  untouched.
- No desktop redesign. The page must not be WORSE on desktop, but the
  phone is what is broken and the phone is what this fixes.

## Why the controls read as meaningless today

Not a labelling problem. `previewLayout()` (`index.html:4160`) already
previews every ROTATE and MOVE live - by mutating the edited deck's fields and
calling `render()`, which repaints the deck's **real card behind the sheet**.
On a desktop window the drawer leaves the card visible and the feature works as
designed. On an iPhone the drawer covers the viewport completely, so the
preview is painted somewhere the owner can never see.

The Edit path deliberately has no pan mock. `index.html:4301` states the
reason: "at 380px a mock on top of those pushes the primary button off the
screen, which is the one thing a phone sheet may never do." That constraint is
real and it is a **drawer** constraint. Going full-screen dissolves it, which
is why the owner's two requests compose rather than merely coexist.

Three further contributors, all visible in the owner's screenshots:

- The chip grid is a **selection list in slot order**, wrapped 6-per-row.
  Position 7 renders directly below position 1 with no relationship to
  anything on the pan. It looks like a scale. It is a radio group.
- Tapping a chip selects and nothing else moves, so the first interaction a
  user tries returns no feedback at all.
- ROTATE and MOVE are separated by the chip grid and land in different
  scroll positions on a phone (screenshots 3 and 4: ROTATE is off-screen by
  the time MOVE is on it), so they do not read as one control group.

## Owner decisions

**D1 - selection is on the pan.** Tap a note on the pan diagram to select it;
MOVE walks it from there. The chip grid is **removed**, not demoted. Its
keyboard affordance (roving tabindex, arrow keys) moves onto the pan, which
becomes the single tab stop.

**D2 - ROTATE follows the selection's zone.** Today `rotateLayout()` hard-codes
`zoneBlock(d.fields, 0)`, the rim. It becomes `zoneBlock(d.fields, layoutSel)`,
so selecting a bottom note and pressing ROTATE turns the bottom ring. This
matches `moveNote()`, which is already zone-locked, and it makes the bottom
shell's orientation correctable for the first time - the zone where makers
vary most.

**D3 - a real URL route.** `#add` and `#edit-<id>` are pushed to history, so
the iOS edge-swipe-back gesture and Safari's back button both close the page
instead of leaving the site.

Two corrections to how this was first written, both from the review:

- **There is no routing precedent.** `grep -c "pushState\|popstate\|replaceState"
  index.html` returns **0**. `index.html:4662` is a one-shot boot read of
  `location.hash` for the `#s=` share scheme, not a router. The app owns a hash
  SCHEME; this introduces the history API to it for the first time.
- **The route is back-gesture only, not a deep link.** Boot consumes `#s=` and
  nothing else, so a reload or a bookmark on `#edit-<id>` would land on the deck
  list with a stale hash - and `<id>` names a CUSTOM deck that lives in this
  browser's localStorage and may not exist in another. Stage 2 therefore
  `replaceState`s the hash away on boot rather than opening a page from it.
  Deep-linkable edit URLs are an explicit **non-goal**.

**D4 - the mock is the only preview.** `previewLayout()` stops mutating the
edited deck. Nothing touches the real deck until SAVE CHANGES. This retires
`layoutPreviewFields` / `layoutPreviewOf` / `restoreLayoutPreview()` and the
whole restore-on-cancel path, and it makes cancel free by construction rather
than by remembering to undo.

## What this costs, stated up front

`index.html` is the entire application in one file, so **these stages cannot
run as parallel `/swarm` lanes** - every one of them edits the same file, and
worktree isolation does not help when the conflict is guaranteed. This runs as
a **single serial lane**, one PR per stage, each reviewed before the next
starts. The `/swarm` disciplines that still apply are worktree isolation, TDD,
CI-at-the-final-commit as the evidence, and a fresh non-author reviewer per PR.

Measured blast radius on today's `main`:

| Surface | Count | Note |
|---|---|---|
| Mutants whose FILENAME matches sheet/layout/slot/focus/edit/backdrop | 43 | the set named below |
| Mutants whose PATCH BODY touches that code | 103 of 268 | the real blast radius; a mutant named for something else can still anchor on a line this plan moves |
| `tests/app.test.js` + `tests/e2e.test.js` tests naming those | 51 | 26 app + 25 e2e |
| CSS rules under `.sheet*` / `#scale*` | 40 | |

Three named behaviours are **asserted today and deliberately inverted by this
plan**. Each needs its test rewritten and its mutant replaced by the inverse
mutant, or the mutation gate will pass while guarding the old world:

- `d_sheet_focus_stays` kills "the deck row opens with a + ADD chip that opens
  the sheet, **focusing the box**". D-request 2 removes that focus. The
  replacement mutant must RE-ADD `scaleBox.focus()` and be killed by a test
  asserting the box is NOT focused on open.
- `d_layout_preview_sticks` kills "Escape closes the sheet without keeping the
  previewed correction". Under D4 there is no preview to stick. The
  replacement must assert the real deck is untouched until SAVE.
- `d_layout_slots_all_tabstops` and `e_layout_slot_under_44` guard the chip
  grid's roving tabindex and 44px targets. Both move to the pan's hit layer.

## Prerequisite

**PR #74 merges first.** It is green, MERGEABLE, and held only on the owner's
Edit-sheet device check. It touches `.sheetsurf`'s max-height and the
`visualViewport` listeners - exactly the code Stage 2 rewrites. Landing this
plan's first PR on top of an unmerged #74 puts the same lines in two places.

Note that Stage 2 may make W4's `kbCap` **unnecessary**: a full-screen page
that is not bottom-anchored has no surface to lift. The keyboard handling is
re-derived in Stage 2 rather than carried over, and if `kbOffset`/`kbCap`
survive it will be because the page still anchors its action row to the
bottom, not by default. Deleting them is in scope for Stage 2; deciding that
is not a separate decision for the owner.

---

## Stage 1 - the pan becomes interactive

**Files:** `index.html` (the `pan()` renderer and its CSS), `tests/app.test.js`,
`tests/layout.test.js`, `tests/mutants/`.

`pan(d, ch)` gains an optional third argument, `pan(d, ch, opts)`. With no
third argument its output is **byte-identical to today** - that is the
acceptance criterion, not an aspiration, because the card path and
`tests/test_render_agreement.py` both depend on it.

With `{ interactive: true }` it appends, after all existing field drawing, one
transparent hit target per non-ding field:

    <circle class="panhit" data-field="<id>" cx=… cy=… r=…
            tabindex="-1" role="button" aria-label="<note>, position N of M"/>

Two details that are easy to get wrong:

- **The hit radius is not the field radius, and CSS cannot supply it.**
  `vector-effect` holds STROKE width against the viewBox scale; it does nothing
  for a `<circle>`'s hit radius. There is no CSS route. The radius in viewBox
  units is `44 / 2 * (2 * ext) / renderedWidthPx`, and `renderedWidthPx` is not
  known at render time, so the hit layer is sized in a post-insert pass from the
  measured container width (and re-sized on `resize` / orientation change).
  Fallback if that proves fragile: an absolutely-positioned HTML overlay over
  the SVG, same semantics, easier sizing, more layout code.
- **44px targets do not fit the mock as it is sized today.** `#scale-preview` is
  `max-width:184px` (`index.html:472`) and `120px` on a landscape phone
  (`index.html:519`). Pygmy has **17 non-ding fields**; seventeen disjoint 44px
  targets cannot exist inside 184px. The Edit page therefore renders the pan at
  PAGE scale - a full-screen page has the room a drawer did not, which is the
  whole reason the owner's two requests compose - and Stage 2 gives
  `#scale-preview` a page-context width of at least 300px at a 380px viewport.
  The 184/120/240px caps stay for the Add drawer... which no longer exists, so
  in practice they are replaced, not overridden. Where geometry still forbids
  disjoint 44px targets on a dense pan, the keyboard path (pan as one tab stop,
  arrow keys walking the selection) is the guaranteed path and the pointer
  target is best-effort: state which one a given deck gets, do not silently
  ship overlapping targets.
- **The ding is not selectable.** `layoutIds()` excludes it and the layout
  correction has no slot for it.

**Acceptance criteria**

1. `pan(d, ch)` with two arguments produces output identical to `main`'s for
   all three built-in decks and all 96 cards.
2. `pan(d, null, {interactive:true})` emits exactly one `.panhit` per non-ding
   field, each carrying the correct `data-field`.
3. At a 380px viewport, on the page-scale pan, no two `.panhit` targets
   overlap, and each measures at least 44x44 CSS px on all three built-in decks.
   If a deck cannot satisfy both, non-overlap wins and the test records the
   measured size rather than asserting the 44px floor away.

**Verify:** `python3 tools/validate.py && node --test tests/*.test.js && python3 -m pytest tests/ -q`

---

## Stage 2 - the drawer becomes a page

**Files:** `index.html` (markup, `.sheet*` CSS, `showSheet`/`closeScaleSheet`,
the `visualViewport` block), `tests/app.test.js`, `tests/e2e.test.js`,
`tests/mutants/`.

The same DOM, re-presented. `#scale-sheet` stops being a bottom-anchored
`.sheetsurf` over a backdrop and becomes a full-viewport surface with a header
carrying a back control and the page title. `.sheetbody` keeps its role as the
scrolling region; the action row keeps its place outside it, which is what
`e_sheet_primary_back_in_the_scroll` guards and that guarantee survives the
move.

Focus: `showSheet()` drops `scaleBox.focus()` (`index.html:4390`). The
replacement is **not** "focus the container or the heading" - that still moves
focus, and a heading is not focusable without a `tabindex` that then sits in the
tab order forever. Focus goes to the **BACK control**, which is a real button:
no soft keyboard appears, the page is announced through the container's
`role="dialog"` + `aria-labelledby`, and Tab from there walks the page in
reading order. Focus return on close is unchanged - `(sheetOpener ||
addChip).focus()` still runs, and `e_focus_not_returned` still guards it.

Routing per D3: `#add` / `#edit-<id>` pushed on open, popped on close, with a
`popstate` handler that closes the page. On boot, a `#add` / `#edit-` hash is
`replaceState`d away without opening anything (D3's non-goal). The existing
`SHARE_PREFIX` read at `index.html:4662` must keep working and must not be
shadowed by the new prefixes - `SHARE_PREFIX` is `"#s="` (`index.html:3562`),
so the prefixes are disjoint by construction, but the test asserting a share URL
still opens a shared deck is mandatory, not optional.

Keyboard handling is **re-derived here, not carried over.** If the action row
is bottom-anchored on the page, the `visualViewport` translate and cap stay and
their tests stay. If it scrolls with the page, they are deleted along with
their tests and mutants. Either way `#scale-box` and the primary button are
both reachable with the keyboard up at 380px, which is the criterion that
matters and the one the owner's first device check failed.

**Acceptance criteria**

1. Opening ADD or EDIT fills the viewport; no backdrop, no page behind it.
2. The box is NOT focused on open; no keyboard appears until the box is tapped.
   Focus is on the BACK control, and `document.activeElement` is asserted.
3. A back control closes the page and returns focus to the chip that opened it.
4. `history.back()` closes the page and does not leave the app.
5. With the keyboard up at 380px, `#scale-box` and the primary button are both
   fully within the visual viewport - on the ADD page and the EDIT page.
6. The background stays `inert` and `aria-hidden` while the page is open.
7. Booting on `#add` or `#edit-x` opens nothing and leaves a clean hash; booting
   on a `#s=` share URL still opens the shared deck.

**Verify:** `python3 tools/validate.py && node --test tests/*.test.js && python3 -m pytest tests/ -q`

---

## Stage 3 - LAYOUT moves onto the pan

**Files:** `index.html` (the LAYOUT region, `rotateLayout`, `moveNote`,
`buildSlots`, `previewLayout` and friends), `tests/app.test.js`,
`tests/e2e.test.js`, `tests/mutants/`.

The Edit page gets the pan mock in the flow - the same `#scale-preview` the
Add page already draws, now in interactive mode, and now the LAYOUT control
group's target. The `if (editingId) { clearPanPreview(); return; }` guards in
`showPanPreview`, `showPlaceholderPan` and `holdPanPreview`
(`index.html:4320`, `4330`, `4339`) are what suppress it today and they come
out.

**Where the Edit mock's fields come from, stated explicitly.** The Add path
paints from `solvePreviewLayout(seed)` (`index.html:4262`), which passes only
`{ mirror }` and knows nothing about `order`. The Edit mock must instead paint
from `solveSheetLayout(layoutOrder)` (`index.html:4149`), which solves the
EDITED DECK's fields under the current correction - otherwise ROTATE and MOVE
change `layoutOrder` and the mock does not move, which is the exact bug this
plan exists to fix. `paintPan()` gains that seam (a solved value in, rather than
a seed) rather than being called twice with different meanings.

**And what happens when the seed box is edited on the Edit page.** Today the
guards above mean nothing repaints. Once they come out, a keystroke in
`#scale-box` re-parses and the field set can change size, which invalidates
`layoutOrder`. `buildSlots()` already carries that guard - `if (layoutOrder &&
layoutOrder.length !== n) layoutOrder = null` (`index.html:4131`) - and
**that guard must move with the slots**, not be deleted with them, or a stale
correction gets applied to a different pan.

- `#scale-slots` and `buildSlots()` are deleted (D1).
- Selection lives on the pan. **`layoutSel` is a SLOT index, not a field.**
  A `.panhit` carries a field id, so the tap handler converts:
  `layoutSel = (layoutOrder || identityOrder(n))[layoutIds(d.fields).indexOf(id)]`,
  since `order[field] = slot` (`orderFromSlots`, `index.html:4100`). Getting
  this backwards selects the wrong note on any deck whose order is not the
  identity - which is every deck the user has already corrected. The
  selected field draws a visible selection ring; the pan is one tab stop with
  arrow keys walking the selection, replacing the chip grid's roving tabindex.
- `rotateLayout()` takes its zone from `layoutSel` (D2).
- ROTATE, MOVE and RESET sit together in one group directly under the pan, so
  the whole control cluster and its target are on screen at once at 380px.
- `previewLayout()` repaints the **mock** and stops mutating the deck (D4);
  `layoutPreviewFields`, `layoutPreviewOf`, `restoreLayoutPreview()` and
  `dropLayoutPreview()` are removed with it, and SAVE CHANGES applies the
  order exactly as it does today via `sheetOptions().order`.

**Acceptance criteria**

1. Tapping a note on the Edit page's pan selects it; the selection is visible.
2. ROTATE turns the ring the selected note belongs to - assert on a bottom-shell
   note, which is uncorrectable today.
3. MOVE swaps within the zone, the pan redraws immediately, and the deck's real
   card is unchanged until SAVE.
4. Escape or back leaves the deck byte-identical to before opening.
5. The whole LAYOUT group and the pan are visible without scrolling at 380px.
6. Selection, ROTATE, MOVE and RESET are all reachable with the keyboard alone,
   with the pan as a single tab stop.

**Verify:** `python3 tools/validate.py && node --test tests/*.test.js && python3 -m pytest tests/ -q`

---

## Stage 4 - sweep

**Files:** `tests/mutants/`, `docs/`, `TODOS.md`.

The three stages above each re-anchor the mutants they break. This stage
audits the rest of the 103 content-matching mutants against the new world, retires the ones whose premise is
gone, and adds mutants for behaviour that is new and currently unguarded -
at minimum: the pan hit layer missing, ROTATE ignoring the selected zone,
the route not closing the page, and the box being focused on open.

**Acceptance criteria**

1. `node --test tests/mutation_harness.test.js` passes with every mutant
   applying cleanly and killing.
2. No mutant's `# kills:` line names a test that no longer exists.
3. The layout controls are explained in the page itself, not only in a doc.

**Verify:** `node --test tests/mutation_harness.test.js && python3 tools/validate.py`

---

## Open risks

- **The 44px hit target inside a scaled SVG** is the one piece of genuinely
  new geometry here and the likeliest source of a Stage 1 bounce. Two separate
  problems, both now stated in Stage 1: CSS cannot size it (no `vector-effect`
  route), and the mock's current 184px cap cannot hold 17 of them. The fallback
  for the first is an HTML overlay; the answer to the second is page scale.
- **`d_layout_slots_all_tabstops`'s guarantee must survive the move.** The
  reason the chip grid is one tab stop is that nineteen tab stops make Tab
  unusable. The pan must inherit that, not just the selection.
- **Route collision with `SHARE_PREFIX`.** Adding hash prefixes to an app that
  already parses `location.hash` on boot is exactly the kind of change that
  silently breaks a share link. Stage 2 must include a test that a share URL
  still opens a shared deck.
- **Stage 2 is the largest single diff** and the one with no natural way to
  split, since presentation, focus and routing all land in the same commit or
  the page is broken between them.

---

## Worktree / parallelization strategy

There is none, and that is the finding rather than an omission. `index.html`
is the whole application, every stage edits it, and two lanes in two worktrees
would conflict on every hunk. Stages 1-4 run **serially in one worktree**, one
PR each, each reviewed by a fresh non-author reviewer before the next starts.
The only work that could genuinely fan out is Stage 4's mutant triage, and it
is not worth a lane.

## Failure modes

| Failure | Blast radius | Detection | Mitigation |
|---|---|---|---|
| `pan()`'s two-arg output drifts | every card in app AND print | `tests/test_render_agreement.py`, `tests/test_print.py` | Stage 1 AC1 is byte-identity, asserted before the interactive layer exists |
| Field id read as a slot index | wrong note selected on any corrected deck; MOVE silently mangles the layout | new unit test on the mapping | the mapping is written out in Stage 3, not left to the implementer |
| Hit targets overlap on a dense pan | taps land on the wrong note, no error | Stage 1 AC3 non-overlap assertion at 380px | page-scale pan; keyboard is the guaranteed path |
| Stale `layoutOrder` applied to a re-parsed seed | correction lands on a different pan | the length guard moved out of `buildSlots` | Stage 3 states the guard moves, not dies |
| New hash prefixes shadow `#s=` | share links stop working, silently | mandatory share-URL test in Stage 2 | prefixes are disjoint (`#s=` vs `#add`/`#edit-`) |
| Mutants re-anchor but never re-run | gate green over a dead world | Stage 4 AC1/AC2 | 103-mutant sweep, not 43 |

## GSTACK REVIEW REPORT

| Run | Status | Findings |
|---|---|---|
| Step 0 evidence probes (`index.html`, `tests/mutants/`, `tests/*.test.js`) | done | 3 stale figures in the draft, 1 overstated claim |
| Prior learnings (10 loaded, cross-project) | done | `handpan-e2e-runs-locally-via-chrome-bin` and `eng-review-measure-dont-infer-counts` applied: counts measured, e2e criteria kept runnable |
| Architecture / code quality / tests / performance | done | 8 findings, all landed in the plan above |
| Outside voice (`codex exec`, 57k tokens) | done | 5 findings; 1 duplicated mine, 4 were new and all 4 were real |

**Findings and what changed**

1. `clearPanPreview()` guard line numbers were wrong (`4283/4324/4335`). Actual: **4320, 4330, 4339**. Corrected, and the guards named by their functions so the next drift is survivable.
2. Blast radius understated: **103 of 268** mutants match by patch body, not 43 by filename. Table now carries both. Stage 4's sweep retargeted.
3. Test count was 53; measured **51** (26 app + 25 e2e).
4. "Routing precedent exists" was false — `pushState|popstate|replaceState` appears **0 times** in `index.html`. D3 rewritten, and deep-linkable edit URLs made an explicit non-goal (an `#edit-<id>` bookmark names a localStorage deck another browser does not have).
5. `vector-effect` cannot size an SVG hit radius — it holds stroke width. Stage 1 now names the post-insert measurement pass as the primary approach.
6. **The 44px target does not fit the mock as sized today.** `#scale-preview` is `max-width:184px` (`index.html:472`), `120px` in landscape (`:519`); Pygmy has 17 non-ding fields. Stage 1's AC3 was unsatisfiable. Now: page-scale pan (>=300px at 380px), non-overlap wins over the 44px floor, keyboard is the guaranteed path.
7. **`layoutSel` is a slot index, not a field id.** "Tapping a `.panhit` sets `layoutSel`" is wrong by one indirection and silently selects the wrong note on any already-corrected deck. The exact mapping is now written into Stage 3. Found independently by me and by codex.
8. The Edit mock's source of truth was undefined. Add paints from `solvePreviewLayout(seed)`, which ignores `order`; the Edit mock must paint from `solveSheetLayout(layoutOrder)` or ROTATE/MOVE move nothing — the exact bug the plan exists to fix. Also: `buildSlots()`'s stale-order length guard (`index.html:4131`) must **move** with the slots, not be deleted with them.
9. "Focus the page container or its heading" still steals focus, and a heading is not focusable without a permanent tab stop. Focus goes to the BACK control: a real button, no soft keyboard, page announced via `role="dialog"` + `aria-labelledby`.

Test plan artifact: `~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-test-plan-20260916-233627.md`

**Decisions auto-taken under the standing AFK authorization** (owner is away; each is the option I would have recommended, recorded here rather than asked):

- F4 → route is back-gesture only; `replaceState` the hash away on boot. Deep links deferred.
- F6 → page-scale pan on the Edit page; non-overlap outranks the 44px floor where a dense pan forbids both.
- F9 → focus the BACK control on open.
- F5 → post-insert measurement as primary, HTML overlay as the named fallback.

Any of these is cheap to reverse before Stage 1 starts.

**VERDICT: APPROVED WITH CHANGES — the changes are applied above. Stage 1 may start once PR #74 merges.**

NO UNRESOLVED DECISIONS
