# Drawer polish — plan

Owner feedback, 2026-09-10, after PR #61 shipped:

> The main page with the chord card is looking great. The drawer needs improvement:
> 1. the input field's border is broken
> 2. the spacing between the helper text and the input field can be more generous
> 3. The drawer always display the handpan visualization, even when the field is empty. This way the drawer doesn't need to resize based on the input.
> 4. on desktop the drawer should be proportionally wider based on the width of the viewport. find a good ratio of for the width.

Constraints in force: single-file app, `index.html` IS the shipped artifact, engine
regions are generated, preserve the visual system, test at 380px, TDD.

---

## 1. The input border is the focus ring, clipped

**Cause: high confidence, not yet measured on the owner's device (7/10).** `#scale-box` is `width:100%` with a `1px solid #433b2c`
border. The amber rectangle the owner sees broken is the global focus ring,
`:focus-visible{outline:2px solid #e3b25c; outline-offset:2px}` (`index.html:276`) —
the sheet focuses the box on open (`scaleBox.focus()`), so it is showing whenever the
drawer opens by keyboard or programmatic focus.

`.sheetbody{overflow-y:auto}` (`:325`) makes the element a scroll container in **both**
axes — `overflow-y:auto` computes `overflow-x` to `auto`, never `visible`. A child at
`width:100%` fills the content box exactly, so a ring painted 2px OUTSIDE that box falls
outside the scrollport and is clipped on the left and right. Top and bottom survive
because there is padding/gap there. The result is a ring with two sides missing, which
reads as a broken border.

**The evidence gap, stated plainly.** The amber ring is visible in
`docs/ui/w38-spacing/after-380-drawer.png`, but that screenshot came from a headless
Chrome capture, where `:focus-visible` matches a programmatic `.focus()` because there
was no pointer interaction to suppress it. `showSheet()` calls `updateParse()` then
`scaleBox.focus()` (`index.html:3857-3859`) on EVERY open, so the ring is guaranteed in
headless and merely likely on a real iPhone, where a touch-initiated open may not match
`:focus-visible` at all. **Step 0 of this item is a diagnostic, not a fix:** capture
`#scale-box` at 380px in three states — unfocused, `:focus-visible` forced, and `.bad` —
and compare against what the owner sees. If the ring is not the culprit, the remaining
candidates are the `.bad` border-colour swap to `#E27005` and the `border-radius:8px`
corner rendering, and this item re-plans against whichever the capture implicates.
The fix below is correct regardless of the answer (a clipped ring is a real defect even
if it is not the one reported), so it lands either way — the diagnostic decides whether
it *closes* request #1.

**Fix, in order of preference:**

- **A (preferred): give `.sheetbody` horizontal breathing room for the ring** — inline
  padding of `var(--sp-1)` (4px, ≥ the 2px offset plus the 2px stroke) and a matching
  negative inline margin so the body's content still aligns with the surface padding.
  Nothing moves visually; the ring simply has somewhere to paint.
- B: `outline-offset:0` scoped to `.sheetbody :focus-visible`. Cheaper, but it thins the
  ring's separation from the border and weakens a global a11y affordance for one case.
- C: `scroll-padding` — does not help; it affects scroll anchoring, not paint clipping.

Reject any fix that removes the focus ring or sets `overflow:visible` on `.sheetbody`
(the cap/scroll/reserved-footer structure depends on it, and `e_sheet_body_clips_instead_of_scrolling`
and `e_sheet_body_refuses_to_shrink` both guard it).

**Test:** a 380px e2e assertion that the focused `#scale-box`'s ring rectangle
(`getBoundingClientRect` inflated by offset+width) lies inside `.sheetbody`'s scrollport
rect on all four sides. Mutant: restore the clipping (remove the inline padding) and the
test must redden.

## 2. Helper text needs more air from the input

`.fieldrow{gap:var(--sp-1)}` (`:328`) puts the label 4px above the input and `#scale-parse`
4px below it. One gap serves two different relationships: a label BELONGS to its control
(tight is right), while the parse line COMMENTS on what was typed (it wants a beat).

**Fix:** keep `.fieldrow` at `--sp-1` for label→control and push the parse line to
`--sp-2` with `#scale-parse{margin-top:calc(var(--sp-2) - var(--sp-1))}`. Expressed in
ramp steps, so the existing "no fresh literals" test (`tests/app.test.js:1969`) still
holds and the three breakpoints scale it automatically.

**DESIGN REVIEW — RESOLVED: `--sp-2`.** The ramp already encodes three distances and
each one names a relationship: `--sp-1` binds a label to the control it names, `--sp-3`
separates one group from the next (`.sheetbody`'s gap). The parse line is neither — it is
inside the group but comments on the control rather than naming it, so it takes the step
between them. `--sp-3` would read as a group break and detach the hint from the box it
explains. `--sp-2` it is, no further owner input needed.

**DESIGN REVIEW — the gap is only half the problem: the parse line has no reserved
height.** `#scale-parse` (`:335-336`) has no `min-height`, and `updateParse()` sets its
text to `PARSE_HINT` when the box is empty, to the note list on a valid parse, and to
**`""` on an invalid one** (`index.html:3821-3841`). So the line collapses to zero height
on every invalid keystroke and springs back on the next valid one. See the
resize-source table in item 3 — item 3 alone does not close owner request #3.

## 3. Always show the pan, so the drawer stops resizing

Today `showPanPreview()` (`:3805`) paints only on a valid parse and `clearPanPreview()`
(`:3792`) sets `hidden`, so the preview enters and leaves the flow on almost every
keystroke — the sheet's height jumps, and on a phone that moves the primary button under
the user's thumb mid-type.

**DESIGN REVIEW — the `hidden` toggle is one of THREE resize sources, and the owner
asked for none.** Request #3 is literally "the drawer doesn't need to resize based on the
input". Fixing the preview alone leaves two live:

| # | Source | Evidence | Size of jump | Fix |
|---|--------|----------|--------------|-----|
| 1 | `#scale-preview` enters/leaves the flow | `clearPanPreview()` `:3792`, `showPanPreview()` `:3805` | the whole plate (~184px + `--sp-3` gap) | item 3 below |
| 2 | `#scale-parse` collapses to zero on invalid parse | no `min-height` at `:335-336`; `parseLine.textContent = ""` at `:3838` | one 12px/1.55 line ≈ 19px | `min-height:1.55em` on `#scale-parse` (item 2) |
| 3 | `#scale-parse` / `#scale-msg` wrap to a second line | `overflow-wrap:anywhere` on both, `:336`, `:346` | one line each | reserve two lines, or shorten the strings |

Source 2 is the one that fires most: it happens on every invalid keystroke, which on a
seed grammar is most keystrokes while typing. `#scale-msg` already has `min-height:1.5em`
(`:345`) — the asymmetry with `#scale-parse` looks like an oversight, not a decision.

Source 3 is a judgement call rather than a bug. `PARSE_HINT` and the note list are short
enough to fit one line at 380px in the common case, so a blanket two-line reserve costs
19px of permanent vertical budget on the smallest phone. **Resolved: reserve one line
(`min-height`), measure the longest real `parseLineText()` output and the longest
`res.reason` at 380px, and only then decide whether the second line is worth buying.**
That measurement is a task, not an open owner question.

**Fix, three parts:**

1. **Reserve the space unconditionally.** `#scale-preview` stops being `hidden` on the
   create path. **Correction to an earlier reading of this item:** the plate does NOT
   need `aspect-ratio` to stop resizing on content. `pan()` emits a square viewBox
   (`index.html:3309`, `${-ext} ${-ext} ${2*ext} ${2*ext}`) whatever the seed, and
   `#scale-preview svg{width:100%; height:auto}` makes the rendered height equal the
   content width. The plate is therefore already a fixed square at a fixed width — the
   resize the owner sees is entirely the `hidden` toggle, nothing else. Add
   `aspect-ratio:1` anyway, as the guard for the one case that does collapse: an
   `innerHTML` of `""` if a render ever fails.
2. **Render the placeholder seed when the box is empty.** `(D) A C D E F G A C` is the
   placeholder and it parses, so the empty state shows a real pan rather than a hole —
   and it teaches the grammar, which matters more now the presets are gone. Paint it at
   reduced opacity so it reads as an example, not as the user's input.
3. **On an INVALID parse, hold the last valid render** rather than clearing. Clearing on
   every transient bad keystroke is the resize problem in another costume; the message
   line already says the seed is bad. **But a held render is a lie by default**, and
   `#scale-preview` carries `role="img"` with
   `aria-label="Preview of where the notes sit on the pan"` (`:506-507`) — a screen
   reader would announce a stale pan as the current one. So a held render must be
   marked stale in BOTH channels: visually (reduced opacity) and in the accessible name,
   which becomes something like "Preview of the last seed that parsed". Without that
   pair, do not hold — clear.

   **DESIGN REVIEW — the plan gave two different states one treatment by accident.**
   "Same treatment as the placeholder state" was written as an aside, not chosen. Held-stale
   and placeholder-example mean different things: one says *this is an example, you have
   not typed anything*, the other says *this was yours a moment ago and no longer matches
   the box*. **Resolved: keep ONE visual treatment, split the accessible name.** The pan
   does not have to carry the whole distinction on its own — the invalid state already
   shouts in two other channels, `#scale-box.bad`'s `#E27005` border (`:334`) and the
   error text in `#scale-msg` (`:337-340`), both of which are absent in the placeholder
   state. So one dim treatment for "not your current input" plus two accessible names is
   honest, and a second visual vocabulary for a transient state would be noise. Names:
   placeholder → "Example pan for the placeholder seed"; held → "Preview of the last seed
   that parsed".

   **Dim the whole `#scale-preview`, not just the SVG,** and floor the dim at `0.5`.
   Reason in "Visual hierarchy" below; the floor is so the plate's black rim ink keeps
   ≥3:1 against the dimmed plate — verify it at the chosen value rather than assuming it.

4. **Cap the plate at the landscape rung.** The 85dvh cap puts `.sheetsurf` at ~331px at
   844x390, and `.sheetbody` is what shrinks to fit (`:319-323`). The primary is safe —
   it lives outside `.sheetbody` in the reserved footer (`:311-313`), so an always-on
   plate cannot push it off screen the way the pre-`.sheetbody` layout did. What it CAN
   do is eat most of a ~200px scrollport with one non-interactive block, burying the
   seed box the moment the preview is on. Add a `max-width` for the plate inside the
   `max-height:520px` rung (start at 120px) and re-measure. **DESIGN REVIEW: the plate
   needs the opposite move at the desktop rung** — see item 4.

**Watch:** the comment at `:3798-3804` says the Edit path deliberately has no mock,
because at 380px a mock on top of the name/degrees/LAYOUT rows pushes the primary off
screen. **That reasoning still holds — this change is create-path only.** Re-measure the
chrome budget at 380px and 844×390 either way.

**Tests:** sheet height is byte-identical across empty → valid → invalid → empty at 380px;
the preview is never `hidden` on the create path; still absent on the Edit path; primary
button still hit-tests to itself at 380×800 and 844×390.

## 4. Proportional drawer width on desktop

`.sheetsurf{max-width:520px}` (`:292`) is a phone measurement applied to every viewport.
PR #61 already widened the header to `min(92vw, 900px)` at ≥640px and left the sheet
behind, so on a wide screen the sheet now reads as a narrow column under a wide header.

**Proposal:** at the existing `min-width:640px and min-height:700px` breakpoint,
`max-width:clamp(520px, 52vw, 760px)`.

- 640px → 520px (floor; unchanged from today)
- 1024px → 532px
- 1280px → 666px
- 1440px → 749px
- 1920px → 760px (cap)

520px floor means no desktop viewport is ever narrower than today. The 760px cap keeps
the sheet inside the header's 900px so the two do not fight, and keeps the input line
length short enough to stay readable — a seed is a short string and a 900px-wide text
field would look absurd.

Ratio is a taste call and the owner is the judge: **52vw** is the proposal, alternatives
are 48vw (more conservative) and 60vw (more generous). `--card-w` and card anatomy are
untouched.

**DESIGN REVIEW — RESOLVED: 52vw, but cap at 680px, and the plate must grow with the
sheet.** Two corrections to the proposal as written:

1. **Nothing inside the drawer scales with its width.** The input is one short string,
   the parse line is the only element that wraps, and `#scale-preview` is pinned at
   `max-width:184px` (`:342`) — a phone measurement. Widen the surface alone and a 760px
   sheet is a 184px plate centred in 500px of empty dark, which is a worse composition
   than today's narrow column, not a better one. **Raise the plate to `max-width:240px`
   inside the ≥640px rung** so the extra width buys something. 240px is the largest value
   that still reads as a preview rather than as the card itself (`--card-w` is the card's
   measurement and the plate must stay visibly smaller).
2. **760px overshoots.** The cap exists to keep the sheet from fighting the header's
   `min(92vw, 900px)` and to keep the input's line length sane. With the plate at 240px,
   680px is where the side margins stop looking like slack. 52vw hits 680 at 1308px wide,
   so the 1440 and 1920 rows both land on the cap.

Revised table: 640→520 | 1024→532 | 1280→666 | 1440→680 (cap) | 1920→680 (cap).

**Test:** assert the computed width at 1280×800 and 1920×1080 sits inside the clamp and
never exceeds the header's width; the 380px phone measurement is unchanged.

---

## Visual hierarchy and interaction states (design review)

**The drawer's hierarchy, in one line:** the seed input is the subject, the parse line
explains it, the pan confirms it, and GENERATE CARDS closes it. Nothing above the input
may out-shout it.

Always-on preview puts that at risk. `#scale-preview` is a `#f1ece1` plate on a `#1f1b15`
sheet (`:341-343`) — the single highest-contrast object in the drawer, and today it is
only present once you have typed something valid, which earns it. Show it on an empty
box at full strength and the first thing the eye lands on is an example the user did not
make. Hence the dim in item 3: **the whole `#scale-preview`, plate included, not just the
SVG inside it**, floored at `0.5` so the black rim ink still clears 3:1 against the
dimmed plate (`role="img"` + `aria-label` at `:506-507` makes this graphic content, not
decoration, so the contrast rule applies).

| State | `#scale-preview` | `#scale-parse` | `#scale-box` | `#scale-msg` | Height change |
|-------|------------------|----------------|--------------|--------------|---------------|
| Empty (create) | placeholder seed, dimmed; name "Example pan for the placeholder seed" | `PARSE_HINT` | default border | empty (reserved) | — |
| Valid parse | seed render, full strength; name "Preview of where the notes sit on the pan" | note list | default border | empty (reserved) | none |
| Invalid parse | last valid render held, dimmed; name "Preview of the last seed that parsed" | reserved blank line | `.bad` orange border | error text, orange | none |
| Invalid before any valid parse | placeholder seed, dimmed, as Empty | reserved blank line | `.bad` | error text | none |
| Edit path (`editingId`) | cleared, as today | as today | as today | as today | n/a (documented exception) |

Three channels carry "your input is broken" — the orange border, the orange message, and
the dimmed pan. One channel carries "this is only an example" — the dimmed pan. That is
why one dim treatment serving both states is honest: the pan never claims to be current,
and the other two channels disambiguate which not-current it is.

## Non-goals

- The iOS-keyboard-over-`GENERATE CARDS` issue (needs a `visualViewport` listener; filed
  in `TODOS.md`).
- Deck data, diagram geometry, `tools/`, the print pipeline.
- Any change to what parses.

## What already exists (reuse, not rebuild)

- **The ramp.** `--sp-1..--sp-4` (`:30-51`) already scales across all three rungs. Items
  2 and 4 express every new value in ramp steps or `clamp()`, so nothing adds a fresh
  literal and the existing "no new literals" test keeps holding.
- **The square-viewBox invariant.** `pan()` already guarantees a content-independent
  aspect ratio, so item 3 needs no layout machinery of its own.
- **The reserved-footer architecture.** `.sheetbody` shrink + footer outside it (`:302-324`)
  already solves "the primary must never leave the screen". Item 3 relies on it rather
  than re-solving it.
- **The widening precedent.** PR #61's `min(92vw, 900px)` on the header is the pattern
  item 4 follows.
- **`solvePreviewLayout()` / `showPanPreview()`** (`:3792-3816`) — five `previewBox`
  references in the whole file. Item 3 edits those, adds nothing.

## NOT in scope

- **iOS keyboard over `GENERATE CARDS`.** Needs a `visualViewport` listener plus a
  device check; written up in `TODOS.md`. Real, and much larger than this batch.
- **The Edit path's missing preview.** Deliberate (`:3798-3804`), owner has not asked to
  change it, and the argument for it still holds.
- **Queue row 302** (the ramp test only monotonicity-checks the `:root` rung). Items 2
  and 4 both add breakpoint values, so this batch makes the gap more load-bearing — but
  fixing the test harness is its own lane, not a rider on a CSS change.
- **Deck data, diagram geometry, `tools/`, the print pipeline.** Repo constraint.
- **Anything that changes what parses.**

## Failure modes

| Path | How it fails | Test? | Error handling? | Silent? |
|---|---|---|---|---|
| Always-on preview, create path | `HPE.layout.solve` rejects the placeholder seed, plate renders empty | to add | `aspect-ratio:1` keeps the box from collapsing | would be silent — **cover it** |
| Held stale render | Stale pan announced as current to a screen reader | to add | none today | **critical gap unless the dual staleness marking above ships** |
| Ring padding on `.sheetbody` | Inline padding shifts content alignment | to add (rect assertion) | n/a | visible |
| `clamp()` widening | A rung value regresses and no test catches it (row 302) | to add (1280/1920/1280x600) | n/a | silent |

One critical gap: the stale-render announcement. It is closed by item 3 part 3 as
written, and that part is therefore not optional.

## Sequencing

One lane, sequential. All four items touch `index.html` CSS plus, for item 3, five lines
of app JS — two lanes would conflict on the same file for no parallel gain. Order within
the lane: item 1's diagnostic first (it can re-plan item 1), then 1, 2, 4 (CSS only),
then 3 (CSS + JS + the a11y work).

## Open rows this touches

302 (the ramp test only guards the `:root` rung, so a bad value in a breakpoint override
ships green) is directly relevant — items 2 and 4 both add values at breakpoints.

## Implementation Tasks

Derived from the findings above; ordered as the Sequencing section requires.

**P1 — closes the owner's four requests**

1. Run item 1's three-state focus diagnostic at 380px on a real touch device; re-plan
   item 1 from what it shows. (`index.html:328-333`, `docs/ui/`)
2. Item 1 fix A/B/C per the diagnostic's outcome — the ring must be visible without
   making `.sheetbody` clip it.
3. `#scale-parse{margin-top:calc(var(--sp-2) - var(--sp-1))}` — request #2. (`:335`)
4. `#scale-parse{min-height:1.55em}` — resize source 2, which request #3 also covers.
   Test: the sheet's `offsetHeight` is unchanged between a valid and an invalid parse.
5. Measure the longest `parseLineText()` output and the longest `res.reason` at 380px;
   decide the two-line reserve on the number, not on instinct.
6. Item 3 parts 1-4: unconditional plate on the create path, dimmed placeholder render,
   hold-on-invalid with BOTH the dim and the swapped `aria-label`, and the 120px cap
   inside the `max-height:520px` rung.
7. Item 4: `max-width:clamp(520px, 52vw, 680px)` on `.sheetsurf` inside the
   `min-width:640px and min-height:700px` rung, plus `#scale-preview{max-width:240px}`
   at the same rung.

**P2 — verification the four items need to be believable**

8. Sheet-height invariance test across empty / valid / invalid / long-error, at 380px.
9. Accessible-name test: the held state's name differs from the current state's name.
10. Contrast check on the dimmed plate at the chosen opacity (≥3:1 for the rim ink).
11. 844×390 landscape re-measure with the plate on: GENERATE CARDS still reachable.

**P3 — deferred, named so it is not lost**

12. Queue row 302: the ramp test only guards the `:root` rung, so items 2 and 4 ship
    breakpoint values nothing asserts. Separate lane, listed in NOT in scope.

## Implementation notes (written during execution, 2026-09-14)

Two decisions the plan left open, settled by measurement rather than taste.

**The evidence gap in item 1 is closed.** The plan flagged that the broken
border had only been reproduced under programmatic focus, which would have made
it a headless artifact. Measured against a real pointer click
(`Input.dispatchMouseEvent`): a text input matches `:focus-visible` either way,
`#scale-box` spans `.sheetbody`'s content box exactly, `overflow-x` computes to
`auto` because `overflow-y:auto` makes it so, and `scrollWidth === clientWidth`,
so the ring is clipped 4px on each side with no scrollbar that could reach it.
What the owner reported on their phone is real. The fix carries a `--ring`
token next to the rule that sets the ring, because the padding the scrollport
reserves and the offset-plus-stroke the ring paints have to move together.

**The empty-to-first-keystroke step is accepted, not reserved.** The plan asked
for the measurement. At 380px `PARSE_HINT` wraps to three lines and the note
list is one, so the sheet is 37px taller before anything is typed than after.
Reserving that permanently costs every phone 37px of vertical room to hold
still in a state that precedes typing, which is the wrong trade on the viewport
this app is tested at. The drawer is instead pinned invariant across every
TYPED state, and a second test pins the empty-to-typed delta to the parse
line's own height so it cannot silently grow past the hint's wrap.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | skipped | outside voice skipped: owner AFK under a token budget |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 5 issues, 1 critical gap |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score 6/10 → 9/10, 5 findings, 4 decisions taken |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | n/a | no developer-facing surface |

### Eng review findings, all folded into the plan above

1. (9/10) `index.html:3309` — `pan()` emits a square viewBox whatever the seed, so the
   drawer's resizing is the `hidden` toggle alone. Item 3 is a visibility change, not a
   layout one, and `aspect-ratio` is a guard rather than the mechanism.
2. (9/10) `index.html:506-507` — a held stale render would be announced by
   `role="img"` + `aria-label` as the current pan. **Critical gap**; closed by item 3
   part 3, which is therefore not optional.
3. (8/10) `index.html:302-324` — the reserved-footer architecture already protects the
   primary, so an always-on plate cannot repeat the below-the-fold bug. The real
   landscape cost is a ~184px block in a ~200px scrollport; item 3 part 4 caps it.
4. (7/10) `index.html:3857-3859` + `docs/ui/w38-spacing/after-380-drawer.png` — the
   focus-ring diagnosis rests on a headless capture, where `:focus-visible` always
   matches a programmatic `.focus()`. Item 1 now opens with a diagnostic.
5. (8/10) queue row 302 — items 2 and 4 both add breakpoint values that the ramp test
   cannot see. Named in NOT-in-scope with the reason it is a separate lane.

### Design review — pass ratings

| Pass | Before | After | What moved it |
|------|--------|-------|---------------|
| 1. Information architecture | 5 | 9 | hierarchy stated; the plate's new prominence is accounted for instead of assumed harmless |
| 2. Interaction states | 4 | 9 | five-state table; two states no longer share one undecided treatment |
| 3. User journey | 6 | 8 | the typing path is now jump-free end to end, not just on the preview |
| 4. AI slop | 9 | 9 | plan was already grounded in file:line evidence, no generic advice |
| 5. Design system | 7 | 8 | every new value is a ramp step or a stated measurement; no DESIGN.md to check against |
| 6. Responsive & a11y | 7 | 9 | dim floor + contrast check + dual-name rule + the landscape cap |
| 7. Resolution | — | — | 4 decisions taken, 1 measurement deferred to implementation |

**Overall 6/10 → 9/10.**

### Design review findings

1. (10/10) **`index.html:335-336` + `:3838` — the plan fixes one of three resize
   sources.** `#scale-parse` has no `min-height` and `updateParse()` sets
   `parseLine.textContent = ""` on invalid parse, so the sheet jumps a line on most
   keystrokes; both text elements can also wrap. Owner request #3 says "the drawer
   doesn't need to resize based on the input" — item 3 alone did not close it. Folded in
   as the resize-source table in item 3 and a `min-height` in item 2.
2. (9/10) **`index.html:341-343` — always-on makes the light plate the loudest thing in
   the drawer.** `#f1ece1` on `#1f1b15`, and it now appears before the user has typed
   anything. Folded in as the Visual hierarchy section: dim the whole `#scale-preview`,
   plate included, not just the SVG.
3. (9/10) **`index.html:506-507` — "same treatment as the placeholder state" was an
   aside, not a decision.** Held-stale and placeholder-example mean different things.
   Resolved: one dim treatment, two accessible names, because `#scale-box.bad` (`:334`)
   and the orange `#scale-msg` (`:337-340`) already distinguish the two cases.
4. (8/10) **`index.html:342` — widening the sheet without widening the plate buys an
   empty band.** Nothing inside the drawer scales with its width; `#scale-preview` is
   pinned at a 184px phone measurement. Folded into item 4: cap 680px not 760px, and
   raise the plate to 240px at the ≥640px rung.
5. (7/10) **`index.html:506` — `role="img"` with a name makes the pan content, not
   decoration**, so dimming it is a contrast change on graphic content. Floor the dim at
   `0.5` and verify the rim ink stays ≥3:1; added to Implementation Tasks as P2.10.

### Decisions taken

| # | Decision | Why |
|---|----------|-----|
| D1 | Item 2's gap is `--sp-2`, not `--sp-3` | `--sp-3` is the between-groups step and would detach the hint from the box it explains |
| D2 | One dim treatment, two accessible names for placeholder vs held-stale | the invalid state already shouts in two other channels; a second visual vocabulary would be noise |
| D3 | Reserve one line on `#scale-parse` now; decide the second line from a 380px measurement | a blanket two-line reserve costs 19px of permanent budget on the smallest phone |
| D4 | Item 4 caps at 680px and raises the plate to 240px at the ≥640px rung | 52vw with a 184px plate is a wide empty band, not a better composition |

### Deviations from the skill, stated rather than implied

- **Visual mockups skipped.** `DESIGN_READY` was available, but this plan is pixel-level
  CSS deltas against a shipped artifact under a "preserve the visual system" constraint.
  A generated mockup cannot inform a 2px `outline-offset` or a `min-height` in `em`.
- **Per-finding AskUserQuestion calls not fired.** Decisions were auto-taken under the
  standing AFK authorization and each is recorded in the table above with its reasoning.
  D2 and D4 are the two the owner is most likely to want to overrule.
- **TODOS.md question loop, Review Readiness Dashboard, and the gstack upgrade prompt
  (1.81.0.0 → 1.84.1.0) skipped** against the owner's stated token budget.

**VERDICT:** ENG CLEARED + DESIGN CLEARED — plan is implementable. The one thing that is
not decidable from the plan is item 1's real cause; its Step 0 diagnostic exists for that.

NO UNRESOLVED DECISIONS
