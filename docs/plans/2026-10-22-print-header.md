# Plan: move the print chord name off the top-right (E3, eng- and design-reviewed)

Base: `origin/main` d8d2a2da962df44e7de4c859f08365a90732cb09. Exploration
outputs in `$S/explore-print-header/` (`learning2.md`, `evidence2.md`,
`options2.html`, `patch_tree2.py`, `port_js2.py`). This is `plan2.md` with the
E3 path only and the second eng review's amendments AM1-AM12 (below) applied
inline. Iteration-1 amendments (eng AM1-AM9, AM11, AM12; design D1-D4, D8, D9)
were already folded in by `plan2.md`. The second /plan-design-review's
amendments D1-D5 (section "Design review amendments") are applied inline,
each marked `[Dn]`.

## Supersessions

- Owner picked E3 (gate 1, 2026-10-22). Sections 10 (B23) and 11 (C3) of
  `plan2.md` are DROPPED, not deferred: no lane, mutant, test or anatomy
  sentence from them survives here. The B23/C3 probes under `$S` stay as
  exploration history only.
- Gate 2 is answered "no change" to `cy` / `R` / `y_note` / `y_num`; gate 3's
  anatomy sentence is confirmed as written below.
- The app keeps its top-right chord name (owner, print only). Lane A of the
  iteration-1 plan and gate 5 stay dropped.

## Goal

The printed chord card's name is the first thing read: centred over the pan at
up to 27 pt on a w x 0.80 budget, the subtitle centred ABOVE it on the top line
that the degree opens (degree top-left, subtitle centred) [D1], the deck name and `#n` together on a footer line that the pan warning
shares (right-aligned). Both renderers (`tools/hifi.py`,
`src/engine/pdfcards.js`) draw it identically; the three committed PDFs are
rebuilt. The app card is unchanged.

## Non-goals

- No change to the app card (owner gates G2-G4: "Print only, app stays").
- No change to R, cy, y_note, y_num, any deck data, diagram geometry, fonts,
  the frozen font CHARSET (`tools/inline_fonts.py`: printable ASCII plus the
  degree sign; AM5), palettes or card dimensions (E3 needs none).
- No change to the title or legend cards, the credit text, the badge copy or the
  badge position; the warning badge keeps its y and copy and changes alignment
  only.
- No i18n, free note placement, refactor, order-free input (see Conflicts).
- The shipped header's own exposure to a long custom deck name (a 40-character
  name under a right-aligned subtitle) is removed by E3 and is not a regression
  to test for (D9).

## Owner gates (answered)

1. Option: E3 (owner, 2026-10-22).
2. cy / R / y_note / y_num: no change (`data/decks.json` print overlays stay
   Kurd/Amara 10 R 69.8 cy 124, Amara/Hijaz R 73 cy 126, Pygmy R 60 cy 121,
   y_note 30, y_num 14 on all five).
3. CLAUDE.md "Card anatomy" sentence, replaced by lane D with: "header
   (root-coloured scale-degree label top-left, small-caps subtitle centred on
   the same line), Marcellus chord name centred with superscript, diagram,
   optional bottom-note badge, note line, number line, footer (deck name and
   #index left, pan-warning badge right-aligned)".

## Lane P: print

Owns `tools/hifi.py`, `src/engine/pdfcards.js`, the `index.html` engine regions
through `tools/inline_engine.py`, `tests/test_print.py`,
`tests/test_pdf_build.py`, `tests/pdfcards.test.js`,
`tests/test_render_agreement.py` (the P8 docstring only; AM6), `tests/mutants/`
(the patches named below and the new ones), `tests/suite_health.py` (its own
FLOORS rows only), the three `*_CHORD_ONLY_Letter.pdf`. Not `README.md`: the
mutant-count test (`tests/test_readme_currency.py`
`test_the_mutant_count_is_stated_within_a_lane_of_the_truth`) accepts any stated
count between 90% of the corpus and the corpus; README says 1348 against 1348
on disk today, and P's nine new patches keep it in the band (AM10). Lane D may
restate it.

### Spec (both renderers, identical)

- Widths are computed by the caller and PASSED IN: `card_header(c, x, y, w, h,
  deck, num, subtitle, main, sup, warn_w=0.0)` / `cardHeader(..., warnW)` with
  `warnW = warnW || 0` (AM4: the default keeps the two direct callers in
  `tests/test_print.py` `CardWidthBudgetTest`, lines 348 and 371, valid without
  an edit; `chord_card` / `chordCard` always pass it). `warn_w` is the widest
  `card_warnings(deck)` line at LabelSB 4.0 track 0.7 (0 when none). The
  prototype's module global `HDR` is not shipped.
- Chord name: `size = 27.0`, step `-= 0.5` while
  `tw(main, "Display", size, size*0.02) + tw(sup, "Display", size*0.52, 0) > w * 0.80`
  (floor 8 as today); name plus superscript as one block centred on `x + w/2`,
  superscript at `base + size*0.46`; baseline `base = y + h - 18 - size*0.70`.
- Degree: `tracked(c, x + 9, y + h - 13.5, deg, "LabelSB", 6.0, 0.4, "l", BLUE)`
  in `chord_card` / `chordCard` (from `y + CH - 31.5`).
- Subtitle: `s = fit(subtitle, "LabelSB", 4.2, w * 0.65, track=0.55)`;
  `tracked(c, x + w/2, y + h - 11.5, subtitle, "LabelSB", s, s*0.055*2.4, "c", INK)`.
- Footer: `numw = tw(num, "Label", 4.4, 0.4)`; `right = x + w - 16 - warn_w - 4`
  when `warn_w` else `x + w - 16`; deck name through the NEW helper
  `fit_clip(text, font, size, maxw, track, floor=3.6)` / `fitClip(...)` in both
  renderers (AM5): `fit` to the floor 3.6, then, while still too wide, drop
  trailing characters and append `"..."` (three ASCII periods, NOT U+2026: the
  font subset's CHARSET is frozen to printable ASCII plus the degree sign, so
  `pdfcards.js` has neither glyph nor advance for the ellipsis and
  `test_the_charset_covers_every_glyph_the_decks_draw` would not see the gap on
  the built-ins). Budget `right - (x + 9) - numw - 6`, track 0.5, drawn
  `tracked(c, x + 9, y + 6.5, ..., "l", INK)` returning its width `dw`; `#n` at
  `(x + 9 + dw + 6, y + 6.5)` Label 4.4 track 0.4 SEP.
- Warning: `tracked(c, x + CW - 16, y + 6.0 - i*5.5, line, "LabelSB", 4.0, 0.7, "r", ORANGE)`
  (from centred). Badge (`y + y_note + 13`), note line, number line, credit:
  unchanged.
- One warning line only [D4]: `CARD_WARNINGS` has one entry (`NO_THIRDS`), so
  `i` is always 0 and the line sits at `y + 6.0`. The `- i*5.5` stack is kept
  as written but a second line would land at `y + 0.5`, on the frame; adding a
  second `CARD_WARNINGS` entry is out of scope here and must re-plan the footer
  (stack upward or wrap), not inherit this formula.
- Top-line hierarchy [D5]: degree (LabelSB 6.0, root colour) at left and
  subtitle (LabelSB <= 4.2, INK) centred share the top line; they read as one
  quiet label row above the name, and the name (>= 14 pt on every shipped and
  synthetic card, P2) dominates by size alone. No weight, colour or size change
  to either label.
- The title card's `fit("How to read", "Display", 20, CW * 0.62)` is untouched;
  only the chord header's `while` condition moves from 0.62 to 0.80.
- Once-per-language rule (AM9, verified against
  `test_each_label_rule_number_is_written_once_per_language`): the test greps
  the six figures `0.70875 0.80325 0.8232 1.47 0.64 0.66` with
  `(?<![0-9.])fig(?![0-9])` over non-comment lines of `src/engine/*.js`,
  `index.html` outside engine regions and `tools/*.py`. E3 writes none of them:
  `0.80 0.65 0.70 0.46 0.52 0.02 27.0 18 16 13.5 11.5 6.5 6.0 4.6 4.4 4.0 0.5 0.4
  0.7 3.6` are all safe. Write the subtitle budget as `0.65` (never `0.66`) and
  never introduce a `0.64` for anything in the header or footer.

### Acceptance criteria (verify command, fail-before, mutants)

- P1 Position-aware staleness (AM2). New test
  `test_committed_pdfs_place_every_glyph_where_a_fresh_build_does` in
  `tests/test_pdf_build.py`: for each committed PDF (bytes through
  `_committed_pdf_bytes`, i.e. `git show HEAD:<pdf>`) and the fresh build, take
  the `page.get_text("dict")` spans of every page in stream order, assert equal
  counts, then pair them in order and assert equal (text, font, size) and every
  bbox corner within 0.5 pt. Verify `python3 -m unittest tests.test_pdf_build`.
  The three PDFs MUST be rebuilt and committed in lane P: E3 moves every header
  glyph, so P1 is red on the unrebuilt tree. The existing
  `test_committed_pdfs_match_a_fresh_build` is text-only (`squeeze(doc_text)`,
  whitespace stripped) and the string stream order is unchanged by E3 (deck,
  `#n`, subtitle, name, sup, degree, ...), so it may stay GREEN on the unrebuilt
  tree; that is the gap P1 closes, not a fail-before. Fail-before is shown two
  ways: (i) P1 red on the branch before the rebuild; (ii) on the rebuilt tree
  the mutant `p_name_baseline_1pt_py` (`base = y + h - 19 - ...`) turns P1 red
  while `test_committed_pdfs_match_a_fresh_build` stays green. Mutants:
  `p_name_baseline_1pt_py` (`# kills: test_committed_pdfs_place_every_glyph_where_a_fresh_build_does`,
  `# suite: python3 -m unittest -k test_committed_pdfs_place_every_glyph_where_a_fresh_build_does tests.test_pdf_build`)
  and `p_name_baseline_1pt_js` (`# kills: test_every_glyph_lands_where_print_puts_it`,
  suite `tests.test_pdf_parity`).
- P2 Worst cases clean (AM8 definitions). A test in `tests/test_print.py`
  renders two synthetic cards through `render_chord_card`: (a) a copy of
  `decks.PYGMY` whose chords are `("Dbmaj7sus4add", "#11", "SUSPENDED MAJOR 7
  ADD SHARP 11 LOW VOICED", chords[50][3], chords[50][4])`; (b) the same with
  the deck name `"D CELTIC MINOR 10 WITH SIX BOTTOM NOTESS"` (40 chars) and a
  NO_THIRDS warning (a `warnings: ["NO_THIRDS"]` key as `CardWarningTest` sets
  it). Over `runs(canvas)` (upright only, so the rotated credit is excluded) in
  Label, LabelSB and Display: two runs "share a band" when
  `abs(y1 - y2) < 0.7 * max(size1, size2)` and "intersect horizontally" when
  `min(right1, right2) - max(left1, left2) > 0`; no pair does both. The name
  >= 14 pt; the deck name >= 3.6 pt; on (b) the deck name's right end is >= 4 pt
  before `#n`'s left and `#n`'s right >= 4 pt before the warning's left, and the
  drawn deck-name text ends in `"..."`. On (b) also [D2]: the warning run's
  right end is >= 4 pt left of the rotated credit's left edge
  (`x + CW - 6.0 - 3.5`, computed from `side_credit`'s translate and the
  Label 3.5 size, since `runs()` excludes rotated text), and the warning's cap
  top (`y + 6.0 + 0.7*4.0`) is below the credit's start `y + 12`. Measured
  today: 7.5 pt horizontal and 3.2 pt vertical clearance, so the assertion is
  green on E3 and red only if a later change pushes the warning right. Fail-before: red on shipped
  `card_header` (synth 1 collision at x 57) and on E3 without the clip (deck
  name across the warning). Twin in `tests/pdfcards.test.js` on the no-thirds
  fixture of `pdfcards.test.js:208` with the 40-char name; it must draw the
  clipped name through the JS `tw` width table (AM5: an unsubset glyph has no
  advance there, which is how the U+2026 choice would have failed).
- P3 Subtitle clearance (AM3). `test_drawn_subtitle_never_collides_with_the_deck_name`
  rewritten (it FLIPS: evidence2.md section 4): render the whole card through
  `render_chord_card`, pick the subtitle run by its key `(round(y + CH - 11.5, 3),
  "LabelSB", *)` and the degree by `(round(y + CH - 13.5, 3), "LabelSB", 6.0)`
  (by BASELINE, not by `size <= 4.2`: on a warned deck the LabelSB 4.0 warning
  run would match a size test, and `fit` can take the subtitle under 4.0 anyway);
  assert `subtitle.left - degree.right >= 4.0` and the superscript's cap top
  (`base + size*0.46 + 0.7*size*0.52`) >= 2 pt below the subtitle baseline on all
  177 cards (Kurd Bbmaj7#11 tightest). `SUBTITLE_BUDGET` 0.65 (the budget test
  keeps calling `card_header` alone; `warn_w` defaults to 0). Verify
  `python3 -m unittest tests.test_print`.
- P4 JS pins (AM1). `tests/pdfcards.test.js:549` budget 0.80 with the sweep
  `n = 4..12`, `shrunk >= 3`. New test: footer runs (deck name at `y + 6.5` from
  `x + 9`, `#n` 6 pt after it at 4.4), degree at `y + CH - 13.5`, subtitle
  centred at `y + CH - 11.5`, and on the no-thirds fixture the warning
  right-aligned to `x + CW - 16` with the deck name ending 4 pt before it. "a no
  thirds pan draws the NO 3RDS warning badge, in orange, on every chord card"
  (line 208) asserts COUNT and COLOUR only (`coloursOf` reads glyph colour, not
  position), so it STAYS as written and is not re-pinned; evidence2.md section 2
  mislists it as FLIPS. Verify `node --test tests/pdfcards.test.js`.
- P5 Parity: `python3 -m unittest tests.test_pdf_parity` green (JS and Python
  change in one commit). The parity SEEDS include a NO_THIRDS pan
  (`(C3) G3 D4 G4 D5`, finding N-F1), so parity exercises the right-aligned
  warning and the `warn_w` budget as well as the header (AM7).
- P6 Mutants (AM7). `c_subtitle_overflow` and `c_subtitle_tracking` REWRITTEN
  by hand against the new subtitle line (`x + w / 2 + 60`: the centred
  subtitle's right edge then passes 177.6, so
  `test_all_drawn_card_text_stays_inside_the_card` still kills it; `s * 0.055 *
  24`); `qp_nothirds_badge_y` REWRITTEN against the right-aligned warning line
  in `pdfcards.js` ONLY, header unchanged (`# kills:
  test_every_glyph_lands_where_print_puts_it`): parity kills it because the JS
  side alone moves; `r4e_pdfcards_header_shrink_step_one_pt` re-anchored by
  `tools/refresh_mutants.py` (context lines `w * 0.62` and `y + h - 24` change;
  its `size -= 0.5` target does not). The badge patches
  `r4e_pdfcards_badge_always_singular`, `r4e_pdfcards_badge_not_orange`,
  `r_badge_count` touch the unchanged badge line and need nothing (a
  context-line scan of all 1348 patches against the changed bodies finds no
  other). New: `p_degree_y_py` / `p_degree_y_js` (degree line +1 pt; killed by P1
  / parity), `p_warn_align_py` / `p_warn_align_js` (warning back to centred;
  killed by P2 / P4 and parity), `p_footer_budget_py` / `p_footer_budget_js`
  (drop the `- warn_w - 4`; killed by P2 / its JS twin), `p_clip_py` /
  `p_clip_js` (no `"..."`, name overruns; killed by P2 / its JS twin). Every
  header names ONE test on `# kills:` and a `-k <test>` or `--test-name-pattern`
  on `# suite:` with no spaces or quotes (the header is word-split, a quoted
  pattern selects nothing and "survives"); strip `index a..b` lines from
  git-made patches. `git apply --check` each; `tests/mutation_check.sh` on the
  named patches locally; CI's mutation gate at the head SHA is the evidence.
- P7 Rebuild: `python3 tools/decks.py`; `python3 tools/validate.py` (checks 1,
  1b, 2, 3, 4, 5), `python3 tools/inline_engine.py --check` green; FLOORS rows
  for `tests/test_print.py` (44), `tests/test_pdf_build.py` (13),
  `tests/pdfcards.test.js` raised by exactly the tests added.
- P8 `python3 -m unittest tests.test_render_agreement` green (the E3 unittest
  log shows it already is: `in_diagram` pairs Label glyphs within 1.25R of the
  pan centre, and the footer at `y + 6.5` lies outside it on all five decks),
  with the header exception recorded: no render-agreement test compares header
  POSITIONS (`test_chord_names_line_up` compares the name text; the geometry
  tests cover the diagram and lines), so the exception is a docstring on
  `test_chord_names_line_up` stating that the print header's placement is
  print-only and pinned by `tests/test_print.py` P3/P2 and
  `tests/pdfcards.test.js` P4 (fields exempted from app/print agreement: deck
  name, `#n`, degree, subtitle and warning positions). No field of the diagram,
  note line, number line or badge is exempted. The floor test
  `test_no_label_falls_below_the_print_floor` and `hifi.fit_note` read
  `draw_pan` glyphs only and are untouched (verified).

## Lane D: docs

Owns `CLAUDE.md`, `README.md` (prose; the mutant count only if it restates it),
`docs/plans/2026-10-22-print-header.md` (this plan, with the owner's gate
answers). Every sentence cites a test by name (P1-P8). Replaces the "Card
anatomy" sentence per gate 3; in "Pan-wide warnings" adds that the badge is
right-aligned on the footer line (AM11); states that
`test_committed_pdfs_match_a_fresh_build` is text-only and P1 is the position
check; states the render-agreement header exception (P8) and that `fit_clip`
clips with ASCII `"..."` because CHARSET is frozen. Runs after P. Shares no
file with P (verified: P excludes README, D excludes every test and tool).

## Base and sequencing

Branch from `origin/main` (never `origin/dev`): P `claude/print-header-p`, D
`claude/print-header-d` from P's merged head. Refactor pass 7 lands first; it
does not touch `card_header` / `cardHeader` (its reviewed plan says so). Dev
first: each lane opens PR M to `main` and the integrator opens PR D to `dev`;
D merges on a green `validate` run at the head SHA; on DEV
(handpan-cards-dev.pages.dev) print D Kurd 10 through `pdf_download` and compare
its Bbmaj7#11 card to `$E/png2/E3-kurd-Bbmaj7s11.png`, then D Amara 9's C major
to `$E/png2/E3-amara-Cmajor.png`; then [D3] add a custom scale
`(C3) G3 D4 G4 D5` named with 40 characters, print it, and check its chord
cards: deck name clipped and ending in three ASCII periods (NOT the single
ellipsis glyph that `$E/png2/E3-synth-worst2.png` shows, which predates AM5),
`#n` after it, NO 3RDS badge right-aligned clear of the rotated credit. M is HELD: it merges only on the owner's word,
with a green `validate` run at the verified head SHA and an independent reviewer
PASS at that SHA. Main-to-dev sync PR after each main merge (restore `_headers`
and the GA placeholder on the sync branch).

## Conflicts with queued explorations

- Refactor pass 7 runs FIRST (approved 2026-10-22; its plan excludes
  `card_header` / `cardHeader`). It must not rename, split or move
  `card_header` / `cardHeader`, `chord_card` / `chordCard` or the
  `tracked`/`fit` helpers; P's mutants and tests name them. If it has, P rebases
  and re-anchors against the new names before its first commit.
- Order-free input: the sheet and `importer.js`; no overlap.
- Free note placement: `src/engine/layout.js`, deck geom; no overlap with P
  (print overlay keys untouched by E3).
- i18n (UI only): `index.html` UI strings; no overlap with P (print copy stays
  English, `test_no_german_card_copy`).

## No-regression oracle

1. `tests.test_pdf_parity` glyph and vector sweeps green at the head SHA
   (SEEDS plus the five built-ins, both variants).
2. `$E/probe2.py` on the rebuilt PDFs, compared per card and per defect pair
   with `probe2-E3.json`: the tight set is exactly the 36 Pygmy badge pairs;
   synth 1 and 2 (`PROBE_OUT`, `build_synth2.py`) carry the badge pair only. The
   integrator runs it once; it is not committed (P2 is the in-repo version and
   covers both synthetic cards; P3 covers all 177 cards).
3. `tools/validate.py` checks 1, 1b, 4 (and 5, untouched); `inline_engine.py
   --check`; `sync_decks.py --check` green.
4. CI `validate` green at the head SHA including the mutation gate (no survivor
   among the new and rewritten patches).

## Eng review amendments (2026-10-22, second /plan-eng-review, E3 only, base d8d2a2d)

Score before 7/10, after 9/10. Verdict: APPROVED WITH AMENDMENTS. Each entry
names the `plan2.md` text replaced; all are applied above.

### AM1 (P4, L123-125): the badge test STAYS
Replace "'a no-thirds pan draws the NO 3RDS warning badge' re-pinned to the
right-aligned x" with: the test asserts count and colour only (`coloursOf`,
`pdfcards.test.js:167`) and stays; the right-aligned x is an assertion of the
NEW P4 test. evidence2.md section 2 mislists it as FLIPS.

### AM2 (P1, L89-97): rebuild is mandatory and the fail-before is the mutant
Replace "Fail-before: E3 code on the branch with the PDFs not yet rebuilt is
red" with the two-way fail-before above. The text-only staleness test may stay
green on the unrebuilt tree because `squeeze(doc_text)` strips whitespace and
E3 keeps the string stream order; it is not the discriminator. Define "in
order" (span pairing, equal count first).

### AM3 (P3, L113-114): select runs by baseline, not size
Replace "`k[1] == "LabelSB" and k[2] <= 4.2`, the degree by `k[2] == 6.0`" with
the baseline keys `CH - 11.5` and `CH - 13.5`.

### AM4 (Spec, L62-63): `warn_w` defaults to 0
`card_header(..., warn_w=0.0)` / `warnW || 0`, so the two direct callers in
`CardWidthBudgetTest` (lines 348, 371) need no edit and P3's "passing
`warn_w=0`" becomes the default.

### AM5 (Spec, L76-78): no U+2026
`fit_clip` / `fitClip` are new helpers in BOTH renderers and clip with ASCII
`"..."`: `tools/inline_fonts.py` CHARSET is frozen to printable ASCII plus `°`,
so the JS subset has no glyph or advance for `…`. The P2 JS twin exercises the
clip.

### AM6 (Lane P ownership, L52-56): `tests/test_render_agreement.py` joins P
P8 edits a docstring there and the file was in no lane.

### AM7 (P6, L128-138): kill paths and header rules
`qp_nothirds_badge_y` is rewritten JS-only so parity still kills it; the parity
SEEDS already hold a NO_THIRDS pan, so `p_warn_align_js` is killed by parity
too; the three badge patches need nothing (context-line scan of all 1348
patches); `# suite:` patterns carry no spaces or quotes; strip `index` lines.

### AM8 (P2, L103-106): define the collision predicate
"baseline bands intersect" = `abs(y1 - y2) < 0.7 * max(size1, size2)`;
"intersect horizontally" = `min(r1, r2) - max(l1, l2) > 0`; assert the drawn
name ends in `"..."` on (b).

### AM9 (Spec, L74): the once-per-language rule, stated exactly
The six figures, the regex and the safe literals are listed in the spec; E3
introduces none of the six.

### AM10 (Lane P, L56-58): README count arithmetic
README states 1348 = today's corpus; nine new patches keep it within the 90%
band, so no README edit is forced on P.

### AM11 (Lane D, L153-160): "Pan-wide warnings" sentence
Lane D also notes the badge is right-aligned on the footer line and that the
clip marker is `"..."`.

### AM12 (P7/P8, L139-151): name the untouched guards
Floor test and `fit_note` read `draw_pan` only; `validate.py` has checks 1, 1b,
2, 3, 4, 5 (not only 1, 1b, 4); FLOORS rows raised by exactly the tests added.

### Decisions auto-chosen (owner AFK, recommended option taken)
- AD1 AM4: default parameter rather than editing the two tests (smallest
  change; `chord_card` always passes it).
- AD2 AM5: `"..."` rather than widening CHARSET (CHARSET is frozen by design
  and a widen would regenerate `src/engine/fontdata.js` and the font tests).
- AD3 AM2: keep `test_committed_pdfs_match_a_fresh_build` as is and add P1
  beside it rather than folding positions into the text test (its name and
  `_stale_reason` message are cited by docs and a mutant).

## Review body

### Scope Challenge
Two lanes, two files per renderer, nine mutants: proportionate. The
`fit_clip` helper is the only new surface and is forced by the 40-char custom
name. Nothing to cut; the JS twin of P2 is the one addition the review insists
on (AM5 would otherwise ship a Python-only green).

### Section 1: Architecture
Caller-computed `warn_w` keeps `card_header` pure and parity-testable; the
HDR global is correctly rejected. Rendering order unchanged, so the text
staleness oracle is blind to this change: P1 is the right fix and must live
beside, not inside, the text test.

### Section 2: Code Quality
Constants are plain literals as today; none collide with the once-per-language
figures (verified by regex). `fit_clip` mirrors `fit` (0.25 steps to 3.6) then
clips; its JS twin must use the same width table.

### Section 3: Tests
FLIPS set verified: only `test_drawn_subtitle_never_collides_with_the_deck_name`
fails on E3 (log), and it is rewritten by P3. The badge test is STAYS (AM1).
Mutant list complete (context-line scan). Floor test, `fit_note`,
render-agreement `in_diagram` unaffected. Oracle covers 177 cards (P3) and both
synthetic cards (P2, both renderers).

### Section 4: Performance
Not applicable; one extra `tw` per card.

### Failure modes
- Lane P forgets the rebuild: P1 red, CI red. Covered.
- A 1-pt drift ships with rebuilt PDFs: caught only by P1's mutant pair and the
  parity sweep; text test blind by design.
- U+2026 in JS: `tw` returns NaN/undefined width, the clip loop never
  terminates or the glyph draws as notdef. Closed by AM5.
- Mutant header quoting: a quoted `-k` selects nothing and the gate reports
  survived. Closed by AM7.

### NOT in scope / what already exists
`runs()`, `render_chord_card`, `every_card()`, `CardWarningTest`'s warned-deck
copy, `_committed_pdf_bytes`, `tools/refresh_mutants.py`, the parity NO_THIRDS
seed: all reused, none rebuilt.

### Unresolved decisions
None.

## Design review amendments (2026-10-22, /plan-design-review, E3 only, base d8d2a2d)

Evidence: the E3 renders in `$E/png2/` (Kurd Bbmaj7#11, Amara C major, Hijaz
F#maj7sus4 and G#m7b5, Pygmy Eb7 and C7sus4 low, synth worst 1 and 2),
`evidence2.md` (0 tight defects on four decks; Pygmy's 36 are the pre-existing
badge-over-bottom-ring pairs), `rubric2.md`, and `side_credit` in
`tools/hifi.py`. Mockups not generated: the real renders beat AI mockups for a
print layout already drawn by both renderers.

- D1 (Goal): the subtitle sits ABOVE the name on the degree's top line, not
  "beneath it". The Goal now agrees with the spec (`y + h - 11.5` vs the name
  baseline `y + h - 18 - size*0.70`), the renders and gate 3's anatomy text.
- D2 (P2): assert warning-to-credit clearance (>= 4 pt horizontally, warning
  cap top below the credit's start). P2 excludes rotated runs, so nothing
  checked it; measured 7.5 pt / 3.2 pt today.
- D3 (DEV check): add a warned, clipped custom deck to the DEV visual check and
  expect ASCII `"..."`; the synth-2 PNG shows U+2026 because it predates AM5.
  Kurd and Amara alone exercise neither the clip nor the warning.
- D4 (Spec): one warning line only; a second `CARD_WARNINGS` entry would draw
  at `y + 0.5` on the frame and must re-plan the footer.
- D5 (Spec): top-line hierarchy recorded as intended (two quiet labels, name
  dominant by size); no change.

### Passes (0-10, before -> after)

| Pass | Before | After | Note |
|---|---|---|---|
| 1 Information architecture | 7 | 9 | D1 fixed the one contradictory reading-order sentence; D5 states the hierarchy |
| 2 States (empty subtitle, no warning, clip, long name) | 8 | 9 | D4 bounds the multi-line warning state; empty subtitle and no-warning are the default path |
| 3 Journey (print -> read card in hand) | 9 | 9 | name first, pan, then lines; footer is reference data |
| 4 AI slop | 10 | 10 | no generic patterns; own palette and type kept |
| 5 Design system | 9 | 9 | fonts, palettes, frame, badge unchanged; CLAUDE.md anatomy rewritten by Lane D |
| 6 Print readability / a11y | 7 | 9 | 3.6 pt floor kept; D2 closes the untested warning/credit adjacency; D3 makes the human check see the worst case |

Overall (lowest of 1-6): 7 -> 9. Not 10: the 3.6 pt clipped footer is legible
but small, an accepted trade (the full deck name stays in the rotated credit).

### Decisions auto-chosen (spawned session, recommended option taken)
- AD-D1: mockups skipped (real renders exist).
- AD-D2: outside voices skipped (subagents forbidden by the brief).
- AD-D3 (D2): add the clearance assertion to P2 rather than only documenting
  the measurement (cheap, and catches a later rightward drift).
- AD-D4 (D4): document the one-line limit rather than redesign the stack now
  (no second warning code exists; widening scope is a non-goal).
- AD-D5 (D3): extend the DEV check with a custom deck rather than committing a
  new PNG fixture (no new committed artifact).

### Implementation tasks (delta from the eng plan)
1. Lane P: P2 gains the D2 assertion in `tests/test_print.py` (and its JS twin
   on the no-thirds fixture in `tests/pdfcards.test.js`).
2. Integrator: run the D3 DEV check after PR D merges to `dev`.
3. Lane D: carry D1's wording into `docs/plans/2026-10-22-print-header.md`.

### NOT in scope
App card layout; `cy` / `R` / `y_note` / `y_num`; the title card; a second
pan-warning line; CHARSET widening; the Pygmy badge-over-ring overlap (pre-existing).

### What already exists
`side_credit`, `runs()`, `render_chord_card`, the parity NO_THIRDS seed and
`CardWarningTest`'s warned deck cover everything D2 and D3 need.

### Completion summary
Five amendments, all inline; no owner decision reopened; gates 1-3 and AM1-AM12
untouched.

## GSTACK REVIEW REPORT

| Review | Status | Score | Findings |
|---|---|---|---|
| plan-eng-review | done (AM1-AM12) | PASS | 0 unresolved |
| plan-design-review | done (D1-D5) | 7 -> 9 | 0 unresolved |

VERDICT: PASS. Ready for lanes P and D after refactor pass 7.

NO UNRESOLVED DECISIONS
