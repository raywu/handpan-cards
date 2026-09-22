# TODOS

## Write DESIGN.md via /design-consultation

- **What:** Run `/design-consultation` and commit a `DESIGN.md` that records the app's tokens (Marcellus / Bitter / Nunito Sans roles, the three palettes plus swaps, `.chip` / `.mode` / `.dot` / `button.nav` anatomy, the `#e3b25c` focus ring, `--card-w`, the dark ground `#26221c` -> `#1a1815`).
- **Why:** The scale-engine design review (2026-09-08) scored consistency 8/10 only because the tokens live in `index.html` CSS and nowhere else; every new surface (the scale sheet, the Edit sheet) has to be reverse-engineered from the stylesheet.
- **Pros:** One reference for Phase 3/4 UI work and future roadmap items; reviewers can check a spec instead of a stylesheet.
- **Cons:** A second place to keep in sync with `index.html`; only worth it if it is short.
- **Context:** `docs/SCALE_ENGINE_PLAN.md` "What already exists" lists the tokens; the approved wireframe at `~/.gstack/projects/raywu-handpan-cards/designs/scale-input-20260908/approved-sheet.html` already uses them.
- **Depends on:** nothing; best done before Phase 3 starts.

## The iOS keyboard covers GENERATE CARDS while typing a seed

**Shipped, device check outstanding.** Both halves of the fix below are in
`index.html`: `kbOffset()` translates the sheet surface by
`innerHeight - visualViewport.height - visualViewport.offsetTop`, and `kbCap()`
caps the surface to the shrunken visual viewport so the translate cannot lift
`#scale-box` off the top of the screen. Both are pure functions and unit-tested
in `tests/app.test.js`, and since lane S6 the listener that feeds them is
covered too: `b.fakeKeyboard()` shadows `visualViewport.height` and fires a
real resize, so e2e drives the whole path against the shipped file.

- **What was wrong:** on an iPhone 14 (iOS 26.6, Safari) the soft keyboard sat
  over the bottom of the scale sheet, so `GENERATE CARDS` - and `SAVE CHANGES`
  on the Edit path - was behind the keyboard for as long as the caret was in
  `#scale-box`. Owner's screenshot 2, 2026-09.
- **Why spacing could never fix it:** iOS Safari resizes the VISUAL viewport,
  not the layout viewport, so `dvh`, `85dvh` and every layout unit the sheet is
  built from are unchanged while the keyboard is up.
- **What is still open:** the owner check on hardware. CI drives the wiring but
  cannot produce a real keyboard - no CDP soft-keyboard emulation exists - so
  the PREMISE that iOS shrinks the visual viewport is the part nothing in CI
  can close. Tracked as queue row 67 in
  `docs/plans/2026-09-16-remaining-work-coordination.md`: iPhone 14 / iOS 26.6,
  BOTH the ADD and the EDIT page, keyboard up.
- **Context:** `kbOffset` / `kbCap` and the `visualViewport` listener in
  `index.html`; the fold tests and their "what this CANNOT see" note in
  `tests/e2e.test.js`.

## Scale engine

### Part B: root-instance enumeration in select.build

**What:** Generate one candidate voicing per root-field instance via `choose(fields, rootPc, ivs, {rootId})`, rank and cap them, and give alternates the HIGH/LOW VOICING subtitle rule.

**Why:** Under the current rule the enumeration already reproduces 60/61 shipped cards (all six hand-authored Pygmy alternates and Hijaz Bm HIGH VOICING) but over-generates (pygmy 51 vs 27). The owner asked for a generalized engine that produces a useful, comprehensive set without hand data.

**Context:** Gated on the trigger-aware cluster rule landing (`docs/plans/2026-09-15-trigger-aware-cluster-rule.md`, Part B section lists the four owner decisions needed first: ranking/cap, subtitle rule, built-in vs generated decks, spec section 7 rewrite). Hook point `src/engine/select.js:239-262 voice()`.

**Effort:** L
**Priority:** P2
**Depends on:** Nothing. Part A merged 2026-09-16 (PR 67). All five owner decisions taken 2026-09-16 and recorded in the plan's Part B section: built-in decks are in scope with Amara as the exactness gate, home card is the lowest non-bottom-shell root instance, an alternate survives only if a non-root tone moves AND register class changes, cap 3 per name, Hijaz `Bm - HIGH VOICING` is deleted. Measured under those rules: amara 16/16 exact, hijaz 17, pygmy 36. Ready to plan.

### Pygmy title-card blurb says 25 CHORDS

**What:** `tools/decks.py:124` blurb still reads "25 CHORDS"; Pygmy ships 27 since the Cm7/Eb7 LOW VOICING cards. Fix the cause, not the string: make the three built-in decks derive their count the way generated decks already do, via `_blurb` (`tools/decks.py:365`, called at `:443` as `_blurb(spec, len(chords), warnings)`), instead of hardcoding the whole blurb text.

**Why:** A hardcoded count goes stale on every deck-data change and nothing catches it. Hijaz (`:52`, "18 CHORDS") is correct today by luck; Amara carries no count at all, so the three built-ins are already inconsistent with each other and with the generated path.

**Context:** Found during the 2026-09-15 eng review; deliberately left out of the trigger-aware PR to keep that diff to the rule change. The built-in blurbs carry pan-specific note lines that `_blurb` does not produce, so this is not a straight swap: either extend `_blurb` to accept a custom prefix, or keep the hand-written lines and append a derived count line. Add a test that asserts each built-in deck's printed count equals `len(chords)` (see the existing generated title-card text test row). Requires a PDF rebuild.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Python oracle lacks a tie-break when a pitch appears in two zones

**What:** `tests/test_deck_data.py:338` picks a tone's highest lower instance with `max(instances(f, True), key=midi)`. When one MIDI exists as both a top-shell and a bottom-shell field, `max` returns whichever the enumeration happened to reach first. Fix: `key=lambda g: (midi(g), zone(g) != "bottom")`, which matches the engine's top-first tie-break.

**Why:** Reachable, not latent. Dedup keys are namespaced `"top "`/`"bottom "` at `src/engine/core.js:395,413`, so a seed can legitimately carry the same MIDI in two zones. On the seed `(C3) G3 B3 D4 E4 G4 B4 | Bb2 B3 D4`, D4 parses as both rim id 3 and bottom id 103 at MIDI 62; on Em7 rooted E4 the engine emits correct all-top-shell output, and the oracle enumerated bottom-first computes `forced=False` and rejects it with three assertion failures. Confirmed both orderings: top-first `(True, [])`, bottom-first `(False, [3 failures])`.

**Context:** Surfaced by the independent reviewer on PR 67 as Nit 2, not a blocker there because no shipped deck hits it. It becomes a live false failure as soon as generated decks from user seeds are exercised, which is Part B territory.

**Effort:** S
**Priority:** P2
**Depends on:** None

### layout.test.js infers every zone's label shape from one ding label

**What:** `labelShape()` in `tests/layout.test.js` reads only the first emitted label, the ding of the first deck, and generalises its baseline, octave-tspan ratio and dy to every zone. Add a guard that asserts the same shape holds on a bottom-zone label.

**Why:** Correct today because `pan()` uses one set of numbers everywhere, but a future change giving bottom labels a different baseline would be silently modelled with the ding's, and the overflow assertion would stop testing what it claims. Pre-existing in shape: the old hardcoded literals made the same assumption.

**Context:** Reviewer nit on PR 68, non-blocking. While there, rewrap the four over-long comment lines added to `tools/hifi.py` in the same PR; one runs to 82 columns against the file's roughly 76-column norm.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Chord-card border: single primary colour, slightly heavier

**What:** Replace the two-tone split border (root colour top half, tone colour bottom half, hard split at mid-height) with the primary/root colour all the way around, and increase the border thickness slightly so the card carries more weight. Apply to BOTH outputs.

**Why:** Owner changed their mind on the border treatment (2026-09-15). The split reads as decoration; a single heavier frame gives the card more presence.

**Context:** Two hooks, must move together or app and print diverge.
- App: `index.html:207-210` `.face::before` uses `padding:2.5px` and `background:linear-gradient(180deg,var(--ga) 0 50%,var(--gb) 50% 100%)`. Becomes a solid `var(--ga)` with a larger padding. The `--gb` custom property stays in the deck JSON and is still used by the deck chips (`index.html:155-158`, `:446`) and the title/edit-sheet gradients, so do not delete it, only stop using it for the card frame.
- PDF: `tools/hifi.py:90-105` `duo_frame(c, x, y, w, h, bw=2.2, rad=7.0, ga, gb)` fills a `ga` top-half rect and a `gb` bottom-half rect then knocks out the interior. Becomes one fill in `ga` with a larger `bw`. Call sites `tools/hifi.py:366` (chord card) and `:442`. Keep `plain_frame` (`:108`) as-is for title/legend/blank cards unless the owner asks otherwise.
- Pick one thickness and use the print value as the source of truth, then match it optically in CSS (print `bw` is in points, app padding in px). Suggest `bw` 2.2 -> 3.0 pt and padding 2.5px -> 3.5px, to be eyeballed against a printed proof.
- CLAUDE.md "Design system" documents the split as ground truth ("card border is a TWO-TONE SPLIT ... deliberately NOT a gradient"); that paragraph must be rewritten in the same PR.
- `tests/CONTRACT.md` mentions `duo_frame`; check whether a layout or PDF test pins the two-tone behaviour before changing it.
- Rebuild the six PDFs (`python3 tools/decks.py`) and test the app at 380px.

**Effort:** S
**Priority:** P2
**Depends on:** None (independent of the trigger-aware rule; can land before or after)

## The page-level print oracle reconstructs the sheet instead of letting the app produce it

- **What:** Rework `tests/e2e.test.js:1189` ("every printed card keeps its full height on every page") so it drives the real CTA and rasterizes whatever the app's own sequence leaves in the DOM, instead of stubbing `window.print()`, capturing `#printroot.innerHTML`, and re-injecting that HTML plus the `printing` class before `Page.printToPDF`.
- **Why:** This is the test that let the iOS teardown race ship. A test that reconstructs the state it wants to measure is structurally blind to defects in how that state is produced - it validated the print CSS perfectly while the app was printing the wrong document on iOS. `tests/app.test.js`'s `printed()` helper has the same shape for the same reason.
- **Pros:** Closes the only category of print defect the suite cannot currently see; the 346-mutant gate would gain real teeth on the print lifecycle rather than just the print CSS.
- **Cons:** Non-trivial. CDP's `Page.printToPDF` does not go through `window.print()`, so "let the app's own sequence deliver it" needs a different mechanism than the current test uses - probably emulating print media and rasterizing after the CTA rather than calling printToPDF on injected HTML. The owner explicitly chose "add a sequencing test, keep the oracle" on 2026-09-22 to keep the fix small, so this is deliberate debt, not an oversight.
- **Context:** Recorded as AC-C4 in `docs/plans/2026-09-22-ios-print-teardown-race.md`, which also carries the full root-cause writeup and the reason the existing oracle is blind. The sequencing tests added by that plan (AC-C1/C2/C3) cover the teardown lifecycle at unit level; this TODO is about the remaining gap where nothing rasterizes a sheet the app itself produced.
- **Depends on:** the iOS teardown fix landing first (that plan's C1-C7), so the oracle is reworked against corrected behaviour rather than the buggy one.

## Print teardown: coverage and residue gaps the PR #106 review surfaced

Six nits from the independent review of PR #106 at `b943483` (verdict
PASS_WITH_NITS). None blocks the iOS teardown fix; all are follow-up.

- **Two surviving mutants on the NEW logic.** `{once:true}` on the
  `afterprint` registration (`index.html:5268`) survives, because
  `tests/helpers/sandbox.js:265` is `(t, fn) => ...` and drops the options
  argument entirely - so a second print in a session would never tear down and
  no test would notice. `setTimeout(teardownPrintSheet, 2000)` after
  `print()` also survives: nothing distinguishes "torn down on `afterprint`"
  from "torn down on a timer slower than the test". Fix: have the sandbox
  carry the options argument, add a second CTA press with an `afterprint`
  between, and assert across an async turn.
- **`#printroot { display: none }` (`index.html:744`) is now load-bearing and
  untested.** Plan D20 rests its whole accepted failure mode on that one line.
  Assert `getComputedStyle(root).display === "none"` in the new e2e test.
- **`@page { size: letter; margin: 0 }` is residue D20 does not price.**
  `printGridCSS()` emits it unscoped to `#printroot` and ungated by
  `body.printing`. If `afterprint` never fires, every later user-initiated
  print is forced to that paper size with zero margins - D20's risk row only
  reasons about `#printroot` contents and `body.printing`. The owner should
  know the accepted risk is broader than written.
- **`root.className = name` is dead** - no `#printroot.wide` / `.narrow`
  selector exists - and teardown does not reset it. (Overlaps the existing
  AC-B5b queue row.)
- **Two stale comments** still narrate the old synchronous teardown:
  `index.html:5613` and the section banner at `index.html:4282`.
- **`teardownPrintSheet()` has no null guard** and can mask the original
  exception on the catch path. Unreachable today: both ids are static markup
  and `openPrintSheet()` already dereferenced `#printroot` before its `catch`
  can run.

**Effort:** S each
**Priority:** P2
**Depends on:** PR #106 landing (so the follow-ups build on the shipped shape)

### The card may render 2-3% over spec on iOS

Pixel forensics on the owner's 2026-09-21 iPhone 14 screenshot (1170x2532,
paper white region 1073px wide = 612pt, so 1.7533 px/pt): column pitch
measured 321.5px = 183.4pt against a 177.6pt spec (ratio 1.033), row pitch
444px = 253.2pt against 247.2 (1.024). If real, a printed card is ~64.7 x
89.3 mm instead of 62.65 x 87.21 and will not sit right in a poker sleeve.

Candidate root cause: `.printscale`'s `transform:scale(g.CW / 72 * 96 /
PRINT_DESIGN_W)` (`index.html:4194`) assumes 96 CSS px per inch in print
context. WebKit's print px/pt basis may differ.

Confirmed or refuted by the B7 ruler check (expect 62.65 x 87.21 mm).
Deliberately NOT fixed alongside the page-fit work: two failures at once
makes the device check unreadable.

### The A4/Letter paper control is inert on iOS

`PRINT_PAPER` (`index.html:4174`) and the `@page{size:...}` half of
`printGridCSS()` do nothing on iOS Safari, which ignores the `@page` at-rule
outright (MDN bcd #28626; Apple Developer Forums 695544, 114327). The picker
therefore promises a control the platform does not give it. Either hide it on
iOS or label it as a hint. Note `printLayoutName` already detects iOS via
`isIOS()`, so the predicate exists.

### RESOLVED - `.printpage` emitted a 792pt block into a ~711.6pt printable box

`#printroot .printpage{height:${p.h}pt}` hard-set the full PAPER height as if
it were the PRINTABLE height. It did not clip and it did not yield the odd
blank sheet: a block taller than the page box PAGINATES, deterministically,
so every sheet became two physical pages - measured at 8 PDF pages for 4
sheets, which is the owner's "Page 1 of 10" for a 5-sheet deck.

Fixed in PR #106 (merged 2026-09-22) by reserving only the SHEET's own
footprint as a `min-height` floor and pairing it with a percentage fill
(`html,body{height:100%}` plus `body.printing #printroot, body.printing
#printroot .printpage{height:100%}`), so the platform resolves the page area
it chose and the flex centring still has free space. Floor and fill; neither
alone is correct. `PRINT_PAPER` no longer carries a height at all.
Owner device confirmation on iOS is workstream B's B7 and is still open.
