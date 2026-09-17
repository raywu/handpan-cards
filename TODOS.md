# TODOS

## Write DESIGN.md via /design-consultation

- **What:** Run `/design-consultation` and commit a `DESIGN.md` that records the app's tokens (Marcellus / Bitter / Nunito Sans roles, the three palettes plus swaps, `.chip` / `.mode` / `.dot` / `button.nav` anatomy, the `#e3b25c` focus ring, `--card-w`, the dark ground `#26221c` -> `#1a1815`).
- **Why:** The scale-engine design review (2026-09-08) scored consistency 8/10 only because the tokens live in `index.html` CSS and nowhere else; every new surface (the scale sheet, the Edit sheet) has to be reverse-engineered from the stylesheet.
- **Pros:** One reference for Phase 3/4 UI work and future roadmap items; reviewers can check a spec instead of a stylesheet.
- **Cons:** A second place to keep in sync with `index.html`; only worth it if it is short.
- **Context:** `docs/SCALE_ENGINE_PLAN.md` "What already exists" lists the tokens; the approved wireframe at `~/.gstack/projects/raywu-handpan-cards/designs/scale-input-20260908/approved-sheet.html` already uses them.
- **Depends on:** nothing; best done before Phase 3 starts.

## The iOS keyboard covers GENERATE CARDS while typing a seed

- **What:** On an iPhone 14 (iOS 26.6, Safari) the soft keyboard sits over the bottom of the scale sheet, so the primary the owner is aiming for - `GENERATE CARDS`, and `SAVE CHANGES` on the Edit path - is behind the keyboard for as long as the caret is in `#scale-box`. Owner's screenshot 2, 2026-09.
- **Why it is not fixed by the spacing work (lane 38):** the drawer was decompressed and the primary is reserved outside the scrolling body, which is what keeps it above the fold - measured at 844x390 the body still has 100px+ of its own to scroll and the button opens at rest, hit-testable at its own centre, at 380x800, 390x844, 390x745 and 844x390 (`tests/e2e.test.js`, "GENERATE CARDS is reachable without scrolling at every phone viewport"). None of that helps here: iOS Safari resizes the VISUAL viewport, not the layout viewport, so `dvh`, `85dvh` and every layout unit the sheet is built from are unchanged while the keyboard is up. No amount of spacing can move a button out from under it.
- **What a real fix needs:** the `visualViewport` API, in TWO parts - translating alone is not enough and was disproved on hardware. (a) listen for `resize`/`scroll` on `window.visualViewport` and translate the sheet surface by `innerHeight - visualViewport.height - visualViewport.offsetTop`; (b) ALSO cap the surface's height to the shrunken visual viewport, because `85dvh` is a layout-viewport unit that does not shrink for the keyboard - without (b) the translate lifts a full-height surface until the seed field leaves the top of the screen, while the reserved footer rides up into view and makes it look fixed. That is new runtime behaviour in the sheet, it needs its own tests, and headless Chromium cannot reproduce the condition at all (the e2e suite's shrunken viewports are a documented PROXY for a keyboard, not the thing), so it needs a device check.
- **Cons of doing it:** a viewport listener that runs on every keyboard show/hide and on every Safari toolbar collapse, on a surface that is already the most layout-sensitive thing in the app.
- **Context:** `.sheetsurf` / `.sheetbody` / `#scale-generate` in `index.html`; the fold tests and their "what this CANNOT see" note in `tests/e2e.test.js`.
- **Depends on:** nothing; wants a physical iOS device to verify.

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
