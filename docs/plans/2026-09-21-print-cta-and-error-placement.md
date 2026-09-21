# Custom-deck print CTA + seed-error placement

Two independent pieces of owner feedback from the 2026-09-21 iPhone 14 /
iOS 26.6 device pass. Serial, not parallel: both touch `index.html`, so
there is no ownership boundary to split on. A lands and merges first
because it is small and its e2e assertions are in the same file B will
grow.

**Owner decisions carried in (2026-09-21):**

- **D12 - seed refusals render directly under the seed field.** Owner's
  words: "Error message such as 'No ding. Start with the ding note, e.g.
  (D) or D/.' Should be directly under the scale field otherwise it's
  hidden below the fold."
- **D13 - custom decks get a PDF via the BROWSER's print path, not
  reportlab.** Owner was offered a hosted `decks.py` service and GitHub
  Actions and chose browser print after being told, explicitly, that the
  output cannot be byte-identical and that glyph positions will drift.
  Owner's words: "I don't need byte size exact but I want to make sure
  the output pdf has two versions - full deck vs print shop. The
  variability is acceptable as long as the main handpan, chords, notes
  are legible and does not deviate much from the app's design. Browser
  print is a better and less complex option if the output's quality
  matches my expectations."
- **D14 - two variants, matching the committed PDFs.** "Full deck" =
  title card, legend card, chord cards, blank padding. "Print shop" =
  chord cards only, padded to a multiple of 9. Same split
  `tools/hifi.py:379 build(..., chords_only=)` already makes.
- **D15 - no separate CTA (owner, 2026-09-21).** "If browser print is
  programmatic, we do not need a separate CTA to generate PDF and can
  directly show the two print options like the seed scales." A custom
  deck shows the SAME `.prints` row in the SAME place with the SAME two
  labels as a built-in deck (`index.html:4008-4010`). The only
  difference is what the control does: a built-in navigates to its
  committed file, a custom one builds the sheet and calls
  `window.print()`. No new affordance, no new vocabulary for the user to
  learn, and the print story stops being two different things.

**Device pass that produced this (closed rows 51, 67, 93):** ADD and EDIT
sheets both hold the seed field, the primary button and the sheet's top
edge on screen with the keyboard up; hands-off-under-zoom accepted.

## Non-goals

- Changing `tools/hifi.py`, `tools/decks.py`, or any committed PDF. The
  three built-in decks keep their reportlab files and their existing
  FULL DECK PDF / PRINT-ONLY PDF links untouched.
- Byte-identical or glyph-identical output against reportlab. Ruled out
  by D13 and stated to the owner before the decision.
- Deck data or diagram geometry changes (CLAUDE.md hard constraint).
- A second renderer for the PAN. Print reuses `pan()`, the same function
  the cards use, so the instrument cannot drift.
- Any backend, serverless function, or new network dependency.

---

# Workstream A - seed refusals under the field

## The defect

`syncParseState()` (`index.html:4583`) routes an invalid parse two ways:
it BLANKS `#scale-parse` (`:4602`), the reserved line directly under the
seed box, and sends `res.reason` to `say()` (`:4230`), which paints
`#scale-msg` at markup `:803`. `#scale-msg` sits below `#scale-preview`
(up to 300px, CSS `:496`) and the layout row, so on a phone with the
keyboard up the refusal is below the fold while the one line that IS
under the field is deliberately empty.

The comment at `:802` claims `#scale-msg` is "Above the control row, so
the soft keyboard never covers it". The device pass shows that reasoning
does not survive the preview being in the flow.

## Approach

Move the `<div id="scale-msg">` in the DOM from `:803` to immediately
after `.fieldrow` (after `:757`). Markup-only: no JS change, no CSS
change, no new element, and every existing test that queries `#scale-msg`
by id keeps passing. `say()` stays the one adapter and keeps its
`aria-live`, which also moves nearer the control it describes.

Rejected alternative - render the refusal INTO `#scale-parse` and leave
`#scale-msg` where it is. It reads well (that line already "comments on
what was typed") but it splits seed refusals from deck-level warnings
across two visible surfaces, and `say()` would need a quiet-mode option
so the `.announce` region still speaks exactly once. More code for a
worse invariant.

Accepted cost: `#scale-parse` still blanks on an invalid parse, so the
refusal sits one reserved blank line below the field rather than flush
against it. That blank line is what keeps the sheet from jumping on every
keystroke (`tests/e2e.test.js:4558`), so it stays.

## Acceptance criteria

- **AC-A1** With an invalid seed at a 380px viewport, `#scale-msg`'s
  bottom edge is ABOVE `#scale-preview`'s top edge. A geometric
  assertion, not a DOM-order one: it fails on any reordering, on the
  preview being moved above the message, and on absolute positioning
  that reinstates the old stacking.
  Verify: `node --test --test-name-pattern 'refusal sits above the pan' tests/e2e.test.js`
- **AC-A2** Every existing assertion on `#scale-msg` text, tier class and
  `aria-live` still passes - the element is moved, not changed.
  Verify: `node --test tests/app.test.js && node --test tests/e2e.test.js`
- **AC-A3** The sheet does not change height as the seed is typed, and
  the first keystroke still moves only the parse line's own wrap. Both
  existing tests must stay green unmodified; if either needs editing,
  stop and re-plan.
  Verify: `node --test --test-name-pattern 'does not change height|first keystroke changes' tests/e2e.test.js`
- **AC-A5** `#scale-preview`'s TOP edge does not move between a valid
  seed and an invalid one at 380px. Today a wrapping refusal grows BELOW
  the preview and `.sheetbody`'s scroll absorbs it; after the move it
  grows ABOVE, so the pan slides down a line as the user types, right
  where they are looking. `#scale-msg` reserves one line only
  (`index.html:507` `min-height:1.5em`) and the long-reason case at
  `tests/e2e.test.js:4594` exists precisely because reasons wrap.
  Implementation, AS BUILT (2026-09-21, supersedes "reserve two lines
  in the sheet context"): a SECOND reserved line is not affordable. The
  Edit sheet's slack at 380x780 was measured at 20.9px
  (`#scale-layout-row`'s bottom 759.09 against `innerHeight` 780) and a
  second reserved line costs 22px (18px box + a 4px `--sp-1` gap); it
  broke "ROTATE makes its correction from the keyboard alone at 380px".
  What shipped FIRST was a shared reserved row: `syncParseState()`
  blanked `#scale-parse` on the same branch that wrote a refusal into
  `#scale-msg`, which had been moved into the `.fieldrow`. The reviewer
  FAILED that (2026-09-21, PR #101): the exclusivity was a property of
  one function's call order, not of the design, so every OTHER writer of
  `#scale-msg` - the pan warning on Edit open, the SAVE collision, the
  DELETE disarm - could land in the seed's row on top of a full parse
  line and push the pan down. One element was carrying two roles.

  What ships now is a SECOND element. `#scale-refusal` lives in the
  `.fieldrow` and holds refusals only; `#scale-msg` goes back above the
  D10 degrees row and holds pan-level messages only. Two writers,
  `showParse()` and `showRefusal()` (`index.html:4312-4326`), each blank
  the other, so exclusivity is STRUCTURAL - no caller can stack them.
  `#scale-refusal` carries its own `aria-live="polite"` because
  `#scale-sheet` is `aria-modal="true"` and `say()`'s page-level
  `.announce` div sits outside it, hidden from AT while the sheet is
  open. Both elements keep `:empty{display:none}`, so neither reserves
  a line it is not using and the fieldrow still costs one line.
  Accepted exemption, unchanged: a refusal long enough to WRAP still
  steps the pan one line. It needs a bad token near `core.js:125`'s
  12-character slice; every reason at a short token renders in one line.

  Second-order fix, same task: the DELETE arming confirmation moved out
  of `#scale-msg` into its own `#scale-del-note` beside the button.
  `disarmDelete()` fires on `pointerdown`, and clearing the warning in
  the old shared element sprang the pan up under the finger - the
  tap-swallowing of queue rows 91 and 117 by a new route.
  `tests/app.test.js`'s two DELETE assertions and
  `tests/helpers/sandbox.js`'s id registry were repointed with it.
  This AC was ADDED by the eng review; no AC in the original draft
  caught it, and neither existing height test can - both compare states
  in which the refusal element is empty. Note the SHEET's own height
  cannot witness a second line either: `.sheetsurf` is capped at 100dvh
  and scrolls internally, which is why AC-A5 measures the pan's top edge
  and not the sheet.
  Verify: `node --test --test-name-pattern 'the pan does not move when the seed goes bad' tests/e2e.test.js`
- **AC-A4** Every direction of the two-element contract has a killing
  mutant. CONTRACT.md rule 3 - AC-A5 is its own test group and needs its
  own. Shipped as, all verified killed at c48d396 (CI's mutation gate at
  the branch head is the standing oracle - read it, not this list):
  `a_seed_refusal_below_the_pan` (moves `#scale-refusal` below the
  preview), `a_msg_row_not_shared` (drops `#scale-parse` from the shared
  `:empty` rule), `e_refusal_row_collapses` (`showRefusal()` stops
  writing), `e_refusal_stacks_on_the_parse_line` (`showRefusal()` stops
  blanking the parse line - the structural half the reviewer FAILED on),
  `d_msg_no_error_tier` (`showRefusal()` drops the tier), and the two
  that prove the OTHER writers stayed out of the seed's row:
  `a_warning_shares_the_seed_row` and
  `a_collision_refusal_below_the_pan`.
  Verify: `bash tests/mutation_check.sh`

## Tasks

- **A1** Write the failing e2e test for AC-A1 first: open the ADD sheet
  at 380px, type an invalid seed, read both rects, assert
  `msg.bottom <= preview.top`. Run it, watch it fail on the current tree.
- **A2** Move the markup. Replace the stale `:802` comment with what the
  device actually showed.
- **A3** Re-run A1's test (passes) and the full JS suites (AC-A2, AC-A3).
- **A3b** Reserve the second line and write AC-A5's test alongside it.
- **A4** Generate `tests/mutants/a_seed_refusal_below_the_pan.patch` per
  CONTRACT.md rule 4 - edit a committed tree, `git diff`, strip the
  `index ` blob header (`tests/mutation_harness.test.js:344`), keep the
  `# kills:` / `# suite:` header. Confirm `git apply --check` passes.
- **A5** Push, let CI run, read `ran N` from CI's own suite-health line,
  raise the `tests/e2e.test.js` floor at `tests/suite_health.py:47` in a
  second commit. Two-push protocol - never compute the floor locally.

---

# Workstream B - the print row on custom decks

## The gap

`PRINT_PDFS` (`index.html:3997`) maps the three built-in deck ids to
committed files, and `headerHTML()` renders the two links only when that
lookup hits (`:4004`). A custom deck has no entry, so it shows nothing.
Custom scales are made on the phone; that is exactly where no print path
exists.

Per D15 the fix is not a new control - it is making the row that already
exists unconditional, and giving the custom branch a different handler
behind the same two labels.

## Approach

A `@media print` stylesheet plus a hidden print-sheet container the CTA
fills on demand, then `window.print()`. The user saves as PDF from the OS
dialog.

Geometry is copied from `tools/hifi.py`, which is the spec: `PAGE`
612x792pt (`:35`), 3x3 slots centred by `slots()` (`:356`), card
177.6x247.2pt, gutters 12.2/9.4pt, crop marks 8pt at 6pt from each edge
(`crop_marks()` `:365`), and the 144pt (2.00in) calibration bar at
x=12 y=220 on page 1 only (`build.calibration()` `:396`). Expressed in
CSS `pt`, which is a physical unit in print.

Card content reuses the app's own renderers - `headerHTML()` minus the
`.prints` row, `nameHTML()`, `pan()`, `linesHTML()` (which already
carries the bottom-note badge, `:4036`). Title, legend and blank cards
are new HTML mirroring `hifi.title_card` (`:474`), `legend_card` (`:490`)
and `blank_card` (`:514`).

### The two failure modes that decide whether this ships

1. **Background graphics.** `.face` paints the paper as a CSS
   `background` (`:316`) and `.face::before` draws the root-coloured
   frame as a padding-plus-background trick (`:320`). Chrome's print
   dialog defaults "Background graphics" OFF, which prints white cards
   with no frame. Mitigation: `print-color-adjust: exact` on the print
   card, AND the frame re-expressed as a real `border` rather than the
   `::before` trick in print context, so the frame survives even when the
   toggle is honoured badly. The pan is inline SVG with `fill`
   attributes, which is content and is NOT suppressed by that toggle -
   verified by reading the markup, to be confirmed on a real print
   preview in B6.
2. **User scale.** "Fit to page" silently rescales and the calibration
   bar stops reading 2.00in. Mitigation is the same one the committed
   PDFs use: print the instruction on the sheet. `@page{margin:0}` plus
   the bar's own label.

### B0 spike result - RUN 2026-09-21, desktop Chrome half PASSES

Built in the scratchpad (throwaway, nothing committed): the app's own
captured card markup laid out 3x3 at 62.65x87.21mm with the spec gutters
and the vertical 2.00in bar placed the way `hifi.calibration()` places
it, printed through CDP `Page.printToPDF` and measured out of the
resulting PDF.

1. **The masked frame does NOT survive print, and this sinks B4 as
   drafted.** Chrome's print export drops `-webkit-mask-composite:xor`
   and flattens `.face::before` to a SOLID block of root colour over the
   whole card. Confirmed in two renderers (pymupdf and Quartz), so it is
   the PDF, not one viewer. Every card printed as a filled rectangle.
   **Fix, verified in the spike:** in print context
   `.face::before{display:none}` plus
   `box-shadow: inset 0 0 0 3.2px var(--ga)` on `.face`. A real `border`
   also works but shrinks the content box by 3.2px a side; the inset ring
   does not, so the ring is what B4 ships. The draft's mitigation ("a
   real `border`") was right about the cause and wrong about the remedy.
2. **`print-color-adjust: exact` is load-bearing and now measured.**
   Background graphics OFF without it: 0 frame paths in the PDF. With
   it: 18, two per card across all nine. Failure mode 1 is closed.
3. **Geometry is exact.** Letter: one page 612x792pt, cards 177.8pt wide
   (62.7mm), bar 1.9896in measured to the stroke centre = 2.00in true.
   A4 with `@page{size:A4}`: one page 595x842pt, cards still 177.8pt, bar
   still 2.00in. Card size in mm is paper-independent.
4. **`body`'s safe-area padding must be reset.** `index.html:65` sets
   `padding:max(10px, env(safe-area-inset-top)) ...`, which pushed the
   sheet 2.6mm down and spilled a tenth card onto page 2 until the print
   stylesheet zeroed it. B4 must reset `body` padding, `min-height`,
   `display:flex` and `height:100%` (`index.html:64-65`).
5. **The back face alone is not a print card.** It carries header,
   diagram, note line and number line, but the Marcellus chord name
   lives on the FRONT face. `hifi.chord_card` draws both. B3 must
   compose the two faces, not print `#back`.

### AC-B6 iOS Safari half - RUN 2026-09-21, owner device, PARTIAL PASS

iPhone 14 / iOS 26.6, Safari, the same spike page over LAN, printed via
the share sheet at Paper Size US Letter, Scaling 100%.

1. **The inset-ring frame SURVIVES iOS.** Card frames render as thin
   coloured rings, not the solid blocks desktop Chrome produced before
   the `.face::before` fix. The B0 remedy holds on a second engine.
2. **`print-color-adjust: exact` is honoured.** Frames, pan diagrams and
   the coloured note/number rings are all present in the iOS preview.
3. **`@page { margin: 0 }` is IGNORED, and this is the finding.** iOS
   Safari imposes its own page margins and prints furniture along the
   bottom - source URL, date, "Page 1 of 2". No CSS or JS suppresses it;
   unlike desktop Safari, the iOS print sheet exposes no headers-and-
   footers toggle. The reserved strip drops printable height below the
   ~268mm that three card rows plus gutters need (3 x 247.2pt + 2 x
   9.4pt = 760.4pt = 268.26mm; the card's 247.2pt is its 87.21mm height),
   so the third ROW spills and a 9-card sheet becomes Pages 1-2.
   Width is unaffected: all three columns fit.

Note the axis. The overflow is VERTICAL. Reducing columns would not fix
it - a first draft of decision D17 proposed 2 columns and was corrected
before implementation.

Scaling is not an escape. It sits at 100% and must stay there: the whole
card spec is true physical size (62.65 x 87.21mm, printers instructed
"100% / Actual Size"). Scaling to fit would silently ship wrong-sized
cards, which is worse than a second page.

**Still owed on device:** a measurement of iOS's actual printable
height, and a re-run at the reduced density decided in D17 below
(6 cards per page on a narrow viewport) confirming one page. Both land
in B7, and AC-B6 stays OPEN until then.

### D16 - paper size (owner decision, 2026-09-21)

The browser never tells the page which paper the user picked: no media
query, no API. Measured consequence of guessing wrong - CSS declaring
`size:letter` printed onto A4 paper is silently scaled to 97.4%, cards
come out 61.0mm instead of 62.65 and the bar reads 1.9376in. Nothing
warns the user except the bar.

So the print path carries an explicit Letter/A4 control that sets BOTH
the `@page size` and the sheet height (279.4mm / 297mm), defaulting to
Letter to match the six committed PDFs. The calibration bar stays the
ruler check, and its label keeps saying 100% / Actual Size.

- **AC-B8** Selecting A4 emits `@page{size:A4}` and a 297mm sheet;
  selecting Letter emits `size:letter` and 279.4mm. Card geometry in mm
  is identical under both.
  Verify: `node --test --test-name-pattern 'print sheet paper size' tests/app.test.js`

### D17 - mobile print page density (owner decision, 2026-09-21)

**On a narrow viewport the print sheet emits 3 columns x 2 rows = 6
cards per page instead of 3x3 = 9.** Cards keep their true size on every
platform and print scaling stays at 100% on every platform - the density
change is the ONLY lever this decision pulls. A deck simply takes more
pages on a phone. The owner was offered "ship it and accept 2 pages on
iOS" and "hide print on mobile entirely", and chose reduced density.

**D16 and D17 are orthogonal controls.** Paper size does not change the
row count. A4 is 297mm against Letter's 279.4mm, nowhere near the ~97mm
a third card row plus its gutter would need, and the strip that caused
D17 is OS-imposed print furniture rather than anything paper size
affects. So 6-per-page applies under both papers, and the choice stays
driven purely by viewport width. B7 measures iOS + A4 + narrow on device
rather than assuming it, or AC-B6 closes on an untested combination.

Consequence for **AC-B3**: the geometry pin against `hifi.slots()` is
now conditional. The CARD constants (62.65 x 87.21mm) and the gutters
stay invariant and stay pinned; only SLOTS-PER-PAGE differs, and the
narrow-viewport layout is 3x2 built from the same card and gutter
constants, not a new geometry. It is NOT simply `slots()`'s first 6
entries: `slots()` centres its block on `th_ = 3*CH + 2*GY`, so reusing
the top 6 verbatim would leave a 6-card page top-heavy - `slots()`
emits row 0 first and row 0 is the TOP row at `y0 + th_ - CH`, so the
cards sit high in a block centred for three rows and all the slack
falls below them. Re-deriving
the vertical centring for 2 rows is expected and allowed.
The test must pin the 3x3 case against `hifi.slots()` exactly as drafted
AND assert the 3x2 case reuses the same card and gutter constants -
never a second set of literals.

### The copy a custom deck does not have

`hifi.title_card`, `legend_card` and `blank_card` read title, credit,
blurb, legend copy and `blank_cards` out of a deck dict that a
user-generated deck has none of - `tools/decks.py` carries those as
print-overlay literals per built-in deck. B3 and AC-B2 do not say where
that copy comes from for a custom deck, and an implementer would invent
it. Decision: the full-deck variant's title card uses the seed string as
the title, the engine's own reason string as the blurb (the app already
holds it), no credit line, and `blank_cards: 0`. The legend card is the
same static legend for every deck - it teaches the card anatomy, not the
deck.

## Acceptance criteria

- **AC-B1** A custom deck's card header renders the `.prints` row with
  the same two labels, in the same position, as a built-in deck's; a
  built-in deck's header markup is UNCHANGED from today's. The existing
  print-button e2e test must stay green unmodified - if it needs
  editing, the built-in path was touched and that is a plan violation.
  Verify: `node --test --test-name-pattern 'print' tests/e2e.test.js`
- **AC-B1b** The hidden card face's print controls are out of the tab
  order. `render()` (`index.html:4080-4081`) manages this with the
  selector `.prints a`; a custom deck's controls are `<button>`, not
  `<a>`, so an unwidened selector leaves two focusable buttons inside an
  `aria-hidden` subtree - the exact defect that selector was written to
  prevent. Assert it for a CUSTOM deck, which is the case no existing
  test covers. **This covers EVERY control the custom branch adds to the
  hidden face, not just the two print buttons** - D16's Letter/A4 picker
  included. A `<select>` or radio group added under B4/B5 and left out of
  the widened selector is the same defect in a new element type, and it
  exists on the custom path only, so nothing in the built-in tests would
  catch it.
  Verify: `node --test --test-name-pattern 'print controls on the hidden face' tests/e2e.test.js`
- **AC-B2** The control offers both variants (D14) and each builds the
  right card list: full = title + legend + chords + blank padding to a
  multiple of the page's slot count; print-shop = chords only, padded the
  same way. **The function takes slots-per-page as an ARGUMENT** and
  never reads the viewport itself - a function that reads
  `window.innerWidth` internally is not pure and is not testable without
  viewport mocking this repo does not otherwise use. The test calls it
  once with 9 and once with 6 against the same fixture deck. Hardcoding
  `% 9` inside the function is a plan violation: it forces either a
  second function or an untested conditional for the 6 case.
  Asserted as a pure function over a fixture deck, not through a print
  dialog.
  Verify: `node --test --test-name-pattern 'print sheet card list' tests/app.test.js`
- **AC-B3** Print geometry matches `hifi.slots()` to within 0.1pt for all
  9 slots, computed from the same page and card constants. **Carve-out
  (D17):** that 9-slot pin covers the wide-viewport layout. The narrow
  layout emits 6 slots per page - same card constants, same gutters,
  re-centred for 2 rows rather than the top 6 of the 3x3 block. **There
  is no Python oracle for it:** `hifi.slots()` (`tools/hifi.py:354-362`)
  is hardwired to `3*CW+2*GX` / `3*CH+2*GY` and `for row in range(3)`,
  so there is nothing 3x2 in `hifi.py` to compare against, and the
  carve-out CANNOT be a value-equality check against Python. What the
  test asserts instead is SINGLE DEFINITION SITE: extract the CW/CH/GX/GY
  declaration the JS slot code uses (already pinned against `hifi.py` by
  the 9-slot half of this criterion) and assert the 3x2 emitter
  references that same declaration rather than embedding numeric
  literals of its own. Numeric equality alone is insufficient - two
  independently typed copies of 177.6/247.2/12.2/9.4 pass a value check
  today and drift apart tomorrow. Card mm size is invariant across both. A unit test
  over the JS that emits the CSS, compared against the numbers read out
  of `tools/hifi.py` at test time so the two cannot silently diverge.
  This is a PYTHON test, not a JS one. No JS test in this repo reads a
  `.py` file; the established cross-renderer pin is
  `tests/test_render_agreement.py`, which imports `hifi` and regex-reads
  `index.html` (`:236-241`). Follow that pattern, and raise the
  `"tests/test_render_agreement.py": 11` floor in `tests/suite_health.py`
  as well as the e2e one. Corrected by the eng review; the draft said
  `node --test tests/app.test.js`, which cannot read `tools/hifi.py`.
  Also: `tests/test_render_agreement.py:238` does a whole-file
  `re.search(r"\.face::before\{([^}]*)\}", html)` and takes the FIRST
  match, so the print stylesheet MUST go at the END of the `<style>`
  block and must not define a second `.face::before` rule above
  `index.html:320`.
  Verify: `python3 -m unittest tests.test_render_agreement -v`
- **AC-B4** Every chord in a custom deck appears exactly once across the
  emitted sheet, with its own index number, and every voicing field is
  lit on its card - the same invariant the app's 96-card check makes.
  Verify: `node --test --test-name-pattern 'print sheet covers every chord' tests/app.test.js`
- **AC-B5** The print container is `hidden` and contributes nothing to
  screen layout or the accessibility tree until the CTA fills it, and is
  emptied afterwards. A stray print sheet in the DOM (9 cards on a wide
  viewport, 6 on a narrow one - see D17) is a real regression risk for
  the practice screen.
  Verify: `node --test --test-name-pattern 'print sheet leaves no residue' tests/app.test.js`
- **AC-B5b (D17 source of truth)** Slots-per-page is decided ONCE, in JS,
  when the CTA fires: `window.innerWidth >= 640` (the app's own existing
  breakpoint, `index.html:41`), and that one value both parameterizes the
  card list (AC-B2) and selects the grid by toggling a class on the print
  container. The `@media print` block READS that class and never
  re-decides the width itself - a second breakpoint in CSS is the drift
  vector that ships 9 padded cards into a 6-slot grid. The test stubs
  `innerWidth`, runs the CTA path, and asserts the emitted list length is
  a multiple of the slot count the container's class selects.
  Verify: `node --test --test-name-pattern 'print sheet slot count agrees' tests/app.test.js`
- **AC-B6 - OWNER DEVICE CHECK, covered_by: neither.** *Partially run
  2026-09-21 on the owner's iPhone 14 - see "AC-B6 iOS Safari half"
  above for what passed, what failed, and what is still owed.*
  Headless Chromium
  cannot open a print dialog, so no automated oracle exists for the thing
  that actually matters. The owner prints one custom deck to PDF from
  desktop Chrome AND from iOS Safari and confirms: cards are
  poker-sized against a ruler, the calibration bar reads 2.00in, the
  root-coloured frame is present, pan labels and the note/number lines
  are legible, and the chord name is not clipped. This is the D13
  quality bar and it CANNOT be recorded as met by CI.
- **AC-B7** A mutant per test group. At minimum: the slot arithmetic
  off by a gutter (kills B3), the blank padding dropped (kills B2), the
  print container left populated (kills B5).
  Verify: `bash tests/mutation_check.sh`

## Tasks

- **B0** DONE 2026-09-21. Throwaway print spike, desktop Chrome half
  passed; see "B0 spike result" above. B1-B5 are unblocked on desktop
  and carry its three fixes (inset ring, `print-color-adjust:exact`,
  body reset). The iOS Safari half HAS now been run - see "AC-B6 iOS
  Safari half" above. It passes on the frame and colour findings and
  fails on `@page` margins, which is what produced D17. B1-B5 carry
  D17's 6-per-page narrow layout as well as the three B0 fixes.
- **B1** Extract the print-sheet card list into a pure function, WIDE AND
  NARROW IN ONE PASS, and write its tests first (AC-B2, AC-B4). It takes
  slots-per-page as an argument; test it at both 9 and 6. No DOM, no CSS
  yet. Shipping a 9-only signature here forces a rework in B3-B5, which
  would already have been built against it.
- **B2** Slot/geometry emitters, 3x3 AND 3x2 in one pass, + their tests:
  the 3x3 against `tools/hifi.py`'s own constants, the 3x2 against the
  single-definition-site assertion (AC-B3). Same reasoning as B1 - the
  narrow branch is not a follow-on patch.
- **B3** Print card markup: chord card from the existing renderers, then
  title, legend and blank mirroring `hifi.py:474-523`.
- **B4** The `@media print` stylesheet: the inset-ring frame,
  `print-color-adjust:exact`, the `body` reset, and the D16 paper
  control. Place the block at the END of the `<style>` element and
  define no second `.face::before` rule - see AC-B3.
- **B5** Make `.prints` unconditional in `headerHTML()`: built-ins keep
  their `<a href>` exactly as-is, custom decks get `<button>` controls
  carrying the same labels and calling the print path (AC-B1). Widen
  `render()`'s tab-order selector to cover both element types (AC-B1b).
- **B6** Mutants (AC-B7), then push and the two-push floor protocol.
- **B7** Hand AC-B6 to the owner with exact steps, the way the 2026-09-21
  device pass was run. It must cover iOS + A4 + narrow as well as
  iOS + Letter + narrow - see D16/D17 orthogonality. Do not close B until
  it comes back.

## What could sink this

If AC-B6 comes back "the frame is missing" or "the pan labels are
unreadable" on either browser, the mitigations in B4 have failed and the
honest move is to stop and revisit D13 - the hosted `decks.py` option is
still on the table and was rejected on complexity, not on capability.
Plan for that outcome rather than patching around it.

---

## GSTACK REVIEW REPORT

Skill: `/plan-eng-review`. Target: this file. Branch: `main`.
Date: 2026-09-21.

| Run | Status | Findings |
|---|---|---|
| Step 0 scope challenge | complete | 4 |
| Architecture + code quality | complete | 1 (report placement of the print stylesheet) |
| Tests | complete | 2 (AC-B3 runner, uncovered A regression) |
| Performance | complete | 0 |
| Empirical B0 spike | complete, desktop PASS | 5 measured results |

**Findings, all folded into the plan above:**

1. `[HIGH] (confidence: 9/10)` `index.html:507`, `tests/e2e.test.js:4594`
   - moving `#scale-msg` above `#scale-preview` makes a wrapping refusal
   push the pan down a line. No AC caught it; neither height test can,
   because both compare states where `#scale-msg` is empty. Added as
   **AC-A5** plus task A3b.
2. `[HIGH] (confidence: 10/10)` AC-B3's verify command named
   `node --test tests/app.test.js`, but no JS test in this repo reads a
   `.py` file. Rewritten as a Python test in the
   `tests/test_render_agreement.py` style, with its floor row named.
3. `[MEDIUM] (confidence: 9/10)` `tests/test_render_agreement.py:238`
   takes the FIRST whole-file match for `.face::before`, so a print
   block redefining it above `index.html:320` silently poisons that
   test. Constrained in AC-B3 and task B4.
4. `[MEDIUM] (confidence: 9/10)` `tools/decks.py`'s print overlay (title,
   credit, blurb, legend copy, `blank_cards`) does not exist for a
   user-generated deck. Resolved under "The copy a custom deck does not
   have".
5. `[HIGH] (confidence: 10/10, measured)` the `.face::before`
   mask-composite frame flattens to a solid block in Chrome's print
   export. The draft's mitigation named the wrong remedy. Corrected to
   the inset ring, verified in the spike.

**Complexity gate:** fired, owner chose spike-first. The spike ran and
retired the two failure modes that decided whether B ships on desktop.

**Decisions taken under the standing AFK authorization** (owner grant:
follow recommendations): D16 paper size, the custom-deck title/legend
copy, and the inset-ring remedy. Each is recorded above with its
measurement, so any of them is cheap to reverse.

**VERDICT: PROCEED.** Workstream A is unblocked. Workstream B is
unblocked on desktop Chrome and carries one open device check (AC-B6,
iOS Safari), which by its own terms cannot be closed by CI. That check
has since been run once and produced D17; it stays OPEN pending a re-run
at the new 6-per-page density.

NO UNRESOLVED DECISIONS
