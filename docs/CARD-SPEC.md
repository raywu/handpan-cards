# CARD-SPEC: decks, layouts, cards and app behaviour

Product spec for the five built-in decks and their cards, moved verbatim from
`CLAUDE.md` (TRI-37, 2026-10-30) so `CLAUDE.md` holds guardrails only. Items marked
verified were measured against the physical instruments or decided by the owner:
treat them as ground truth. Tests derive their assertions from this file
(`tests/CONTRACT.md` rule 1), so a fact stated here is a spec, not a note. The scale
engine, scale-string grammar and share links are in `docs/ENGINE-SPEC.md`.

## Decks

Decks, in picker order: **D Kurd 10** (49 chords), **D Amara 10** (29 chords,
27 distinct names), **D Amara 9** (27), **C# Hijaz / Orion 9** (19), **F3 Low
Pygmy 18** (53 chords, 32 distinct names). 177 cards in all.

## Instrument layouts (verified - do not "correct")

Angles are math-convention degrees (0 = right, 90 = up), y-up.

**C# Hijaz / Orion 9** - Ding C#3 centre. Standard zig-zag, note 1 at bottom centre, odd-numbered notes on the right and even-numbered on the left:
1 G#3 @270, 2 B3 @225, 3 C#4 @315, 4 D4 @180, 5 F4 @0, 6 F#4 @135,
7 G#4 @45, 8 B4 @90. (F is functionally E#, the major third of C#.)

**F3 Low Pygmy 18** - Ding F3, enlarged and offset toward the player
(r=0.19R, dy=0.1425R below centre). Top rim is the SAME zig-zag direction as Hijaz and Amara (odd notes right, even left); what differs is the anchor: bottom centre falls between notes 1 and 2: 1 G3 @290 (bottom-right), 2 Ab3 @250, 3 C4 @330, 4 Eb4 @210,
5 F4 @10, 6 G4 @170, 7 Ab4 @50, 8 C5 @130, 9 Eb5 @90 (top centre).
Inner pair beside the ding: 10 F5 @128 (left), 11 G5 @52 (right) - note
the inner pair ascends OPPOSITE to the rim direction; that is the real
instrument. Bottom notes drawn as an outer dashed ring in **x-ray view
(seen from above)**: U1 C3 @300, U2 Db3 @240, U3 Eb3 @0, U4 Bb3 @180,
U5 Db4 @60, U6 Ab5 @120. **Bb and Db exist only on the bottom shell.**
Any chord whose voicing uses a bottom-shell field carries an orange
"N BOTTOM NOTES" badge, where N counts bottom-shell FIELDS in the voicing -
not Bb/Db occurrences (Cm7 is C4 Eb4 G4 Bb3, so it reads "1 BOTTOM NOTE";
Eb7 is Eb4 G4 Bb3 Db4, "2 BOTTOM NOTES").
Pygmy ships Cm7 and Eb7 in two registers each (owner instruction): the LOW
VOICING card roots on the bottom shell (Cm7 on C3/U1, Eb7 on Eb3/U3). Both
registers light the IDENTICAL diagram fields; only the note line, number line
and badge differ. Pitch-class set is complete F natural minor. Pygmy's chord
list is engine output for its maker string ("keep engine output as sot"),
including `Fmadd9` before Fm9 and Fm9 = F4 Ab4 C5 Eb5 G4.
Pygmy's `geom` is engine output of `node tools/gen_deck.js "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]" --anchor between`, stored without `ext`. Its field angles, chords and print overlay are hand-verified data.

**D Amara 9** - Ding D3. Standard zig-zag: 1 A3 @270, 2 C4 @225, 3 D4 @315,
4 E4 @180, 5 F4 @0, 6 G4 @135, 7 A4 @45, 8 C5 @90.

There is **no universal maker convention** for bottom-note placement; layouts
are per-instrument. Bottom shells, projected to top view, typically run
opposite the top zig-zag.

### Solver-generated layouts (not measured from an instrument)

**D Kurd 10** - Ding D3 centre. Nine rim fields, same direction as Amara 9
(even numbers on the left): 1 A3 @270, 2 Bb3 @230, 3 C4 @310, 4 D4 @190,
5 E4 @350, 6 F4 @150, 7 G4 @30, 8 A4 @110, 9 C5 @70. Nothing at top centre.
**D Amara 10** - the same nine angles: A3, C4, D4, E4, F4, G4, A4, C5, D5.
Generated WITHOUT the mirror option. Change them by changing the solver or the
seed, never by hand. The solver must seat every field of every built-in
exactly where its diagram has it.

### Generated-layout rules

- One direction: odd rim notes right, even left. `anchor: one` (default) puts
  note 1 at bottom centre; `anchor: between` (Pygmy) puts bottom centre between
  notes 1 and 2, note 1 on the right. "left-first"/"right-first" are retired words.
- MIRROR reflects the NOTES of the rim and inner rings; `mirrorBottom` does the
  same for the bottom ring and defaults to `mirror`. Index numbers never move:
  each position keeps its unmirrored number and the note mirrored into it takes
  that number on the diagram, the number line and the drawer (owner 2026-10-30;
  rule N extended). The sheet's MIRROR BOTTOM toggle reflects EVERY note, the
  hand-placed ones included: an explicit angle `a` in `options.angles.bottom`
  becomes `180 - a mod 360` (`HPE.layout.reflectAngles`; null entries stay null
  because `solve` already reflects them), so a note at 285 goes to 255 and the
  note that was at its mirror partner goes the other way (owner 2026-10-31,
  superseding MN2's hold-the-orphans rule S). Numbers stay with positions: after
  the reflection they are re-ranked around the ring by the cyclic rule N against
  the unmirrored home. Pygmy C3 slid 300 -> 285 reads U1; with MIRROR BOTTOM on
  C3 is at 255 and reads U2, and Db3 (home 240, now at 300) reads U1. Multiples
  of 5 reflect to multiples of 5 and the top shell is symmetric, so the toggle is
  never refused for an accepted layout (any ring size, the 5- and 7-note rings
  included); toggling twice returns the identical layout. Stored angles are
  drawn angles in their own frame, so saved scales and share links draw exactly
  as before (tests "MN3: reflectAngles reflects explicit entries ...", "MN3 release
  safety: records and v6 links ...", "MN3: across bottom rings of 2..8 notes ...").
  RESET LAYOUT clears every angle.
- Inner notes (after the inner bar): one at top centre, two at 128 and 52, more
  fan across the top half; they push the ding toward the player by at least
  0.1425R, raised step by step while an inner index number would touch the ding
  (`HPE.layout` `geometry` loop). No
  inner notes means a centred ding.
- No note-count caps: a crowded pan draws smaller with `SMALL_LABELS`; never refused.
  `SMALL_LABELS` (`labelFloor`) ignores bottom octave digits; the separate print
  3.6 pt floor covers every glyph, bottom octave digits included, except Neotone
  lens names (below). `labelFloor` reads pre-fit sizes (`src/engine/layout.js`), so a
  lens name shrunk under 3.6 pt does not fire `SMALL_LABELS` (intended under the
  exemption; the PA lens-shrink test in `tests/pdfcards.test.js`).
- Bottom angle overrides (`options.angles.bottom`, custom decks only): multiples
  of 5 in [0, 360) or null; bottom ring only; applied LAST (after mirrorBottom
  and seats); an overlap is never allowed (floor = smallest multiple of 5 above
  the touching angle, at most 15); `seats.bottom` and `angles` never coexist.
  Seat numbers belong to the seat (rule N, owner 2026-10-23): a swap trades only
  the two labels, a slide that passes a note renumbers by home cyclic order, and
  the first slide on a seated ring folds seats into angles keeping every seat's
  number.

## Verified card conventions

1. **Pitch-class-complete highlighting.** The diagram lights EVERY field whose
   pitch class is in the chord, ding and bottom notes included. Root pitch
   class -> root colour on all its instances; other tones -> tone colour.
   Highlighting is derived at render time from midi % 12, never stored.
2. **Bottom lines are in chord-spelling order from the root**, not pitch order
   (Amara 9: G5 = "6-3", Fmaj7 = "5-1-2-4"). Note and number lines are coloured
   per note (root / tone), grey separators.
3. **Voicing rules.** The ding never appears in a voicing; no doubled pitch
   classes; power chords are root+5th; one card per pitch set (no sus2, no
   6-chords duplicating m7 sets). "Root position" means the spelling order
   starts at the root; it says nothing about register.
   **Cluster rule:** if no non-root tone is forced below the root, every
   non-root tone sits above it (register otherwise free; Fm9's low G4 under its
   Eb5 is fine). If ANY non-root tone is only available below the root AND its
   highest lower instance is on the top shell, every CHORD TONE (3rd, 5th, 7th;
   a sus chord's 4th; a 6-chord's 6th) moves to its highest instance below the
   root; one with no lower instance stays put. EXTENSIONS (add9, 9, b9, 11ths,
   13ths, #11) keep their nearest instance ABOVE the root unless themselves
   forced. A tone whose highest lower instance is on the bottom shell takes
   that field and forces NOTHING (Cm7 is C4 Eb4 G4 Bb3). Root and spelling
   order never change. Owner decisions: the "highest lower instance" reading,
   the bottom-shell choice, the chord-tone/extension split, the top-shell
   clause. Amara 9's three forced cards (G5, Gsus4, Fmaj7) are owner-fixed.
   Enforced by `tests/test_deck_data.py::test_forced_tones_cluster_below_root`.
   **Amara 9 card order** is the engine's ranking for `(D3) A3 C4 D4 E4 F4 G4
   A4 C5` (owner chose full re-ranking); card content still obeys every rule here.
4. **Highlighted field:** thin black circle, coloured band at 0.87r with stroke
   0.24r, inner black hairline at 0.74r, label auto-fit inside. Unhighlighted
   bottom fields: dashed grey circle, grey label.

## Design system

- **Type:** Marcellus (chord names, display), Bitter (note and number lines),
  Nunito Sans (labels/UI). All OFL; print embeds TTFs from `tools/fonts/`.
- **Palettes** (root / tone; the card border is a single-colour four-sided frame
  in the root colour):
  - Hijaz: pink `#E0559A` / orange `#E2761B`
  - Pygmy: purple `#6D40A3` / gold `#C9971E`
  - Kurd: blue `#2563B0` / brick `#C0452C`
  - Amara 10: green `#3B7A2A` / crimson `#B3263A`
  - Amara: teal `#0B7B75` / amber `#DD8F00`
  - Bottom-shell accents (U-labels, badges): orange `#E27005`, app and print
    (`hifi.ORANGE`), one orange only.
- **Diagram label rule** (owner decision). One rule sizes every glyph, every
  deck, both outputs; `r` is the field's own drawn radius:

      name   = r x RATIO[zone]   ding 0.70875, rim/inner 0.80325, bottom 0.8232
      number = r_note x 0.64
      octave digit = 0.66 x its name

  No density factor on top of the radius term. `f_*` geom keys are solver
  outputs; no renderer sizes from them. The ding, rim/inner and number ratios are the larger of the Hijaz/Amara and
  Pygmy ratio families; the bottom ratio is Pygmy's alone (0.784 x 1.05, only Pygmy had a
  bottom shell); never lower one to match the other (`tests/pdfcards.test.js` "the label rule is public: HPE.pdfcards.labelRatio and labelSize match the internal figures"). **No-shrink (owner):** the baseline is
  the PRE-RULE size per renderer - print vs `f_*`, app vs `f_* x 1.05` - asserted
  for Hijaz, Pygmy and Amara 9 only. Note name larger than its index number on
  the five built-ins. Print floor 3.6 pt for every diagram glyph
  (`fit_note`'s own floor is 2.5 pt, so the test is the guard), except Neotone
  lens names: they shrink to fit the lens and may go below 3.6 pt
  (`LENS_FIT_FLOOR` = 0.1 pt, owner 2026-11-01).
  **Neotone lens (owner 2026-11-03, option D):** a lit lens is filled with its state
  colour mixed half with white (`LENS_TINT` 0.5 in `HPE.pdfcards.lensTint`, `tools/hifi.py`
  `lens_tint`, and `neoSvg` in `index.html`); there is no lens band stroke. The name ink
  (#242424) reaches 4.5:1 on that tint for every palette colour (`tests/pdfcards.test.js`
  "NL: lensTint ..."), and the tint against a plain white lens is 1.6 to 2.35:1, so the
  plate edge is carried by the black lens outline. The lens depth is 0.45 of the main
  diameter (fixture rev 4), a lens about a third of a main note by area (0.34, test
  "NL: the lens is 0.32 to 0.35 ...").
  **Solid tint (owner 2026-11-03):** on a Neotone card with a mutant note (`plan.hasMut`) a
  lit main note and a lit ding are filled with the same half tint, the tint being the fill
  of the existing outline circle. One tint serves main notes, lens and ding: `lensTint` in
  `src/engine/pdfcards.js` (print) and `tintHex` in `neoSvg` in `index.html` (app),
  `lens_tint` in `tools/hifi.py`. The crescent band and the ding ring are not drawn
  (`crescentBand` stays computed for the name fit). A placed card without a mutant note, and
  every standard card, keep their ring bands and a white ding, byte for byte (`tests/pdfcards.test.js`
  "NS: ..."; `tests/test_render_agreement.py` reads lit state from the tint fill).
  K1 delta: the card reference's `lens_orbit` (0.4917) no longer holds; the lens centre is
  0.536 (the "PA: K1" test names the exception). The inner lens edge (0.346R) clears the
  decor ring (0.355R) by only 0.009R.
  `hifi.LABEL_WIDTH_RATIO` = 1.47. Constants are written once per language:
  `HPE.core.LABEL_RULE` in `src/engine/core.js` and `tools/hifi.py`; a second
  copy fails `tests/test_render_agreement.py`.
- **Card anatomy (print):** header (root-coloured degree top-left, small-caps
  subtitle centred), Marcellus chord name centred with superscript (up to 27 pt),
  diagram, optional bottom-note badge, note line, number line, footer (deck name
  and #index left, pan-warning badge right). The footer deck name clips with
  ASCII `"..."`, never U+2026 (the font subset is printable ASCII plus the degree sign).
- **Pan warnings:** `NO_THIRDS` prints `NO 3RDS ON THIS PAN` on chord cards (one
  footer warning line only); `SMALL_LABELS` is title card only. The title blurb
  fits to six rows, sits on the frame at seven and leaves the card past that;
  nothing is refused and no row is dropped (owner, 2026-10-07).
- **App/print agreement:** only the print header's placement (deck name, #n,
  degree, subtitle, warning positions) is exempt; no field of the diagram, note
  line, number line or badge is exempt.
- **Scale degrees** per deck:
  Hijaz {C#:I, D:II, F:iii°, F#:iv, G#:v°, B:vii};
  Pygmy {F:i, G:ii°, Ab:III, Bb:iv, C:v, Db:VI, Eb:VII};
  Amara {D:i, F:III, G:iv, A:v, C:VII};
  Kurd {D:i, E:ii°, F:III, G:iv, A:v, Bb:VI, C:VII};
  Amara 10 {D:i, E:ii°, F:III, G:iv, A:v, C:VII} (E keeps ii° with no E card).
  Owner: the parent scale's seven steps take no accidental; case and ° carry
  quality. A root outside the parent scale takes `#`/`b` (default, generated decks only).

## Data model

Per deck: `id, name, sub, colors{root,tone,ga,gb}, degrees{pc:label},
geom{...fractions of R}, fields{id:[name, octave, midi, zone, angle, label]},
chords[{main, sup, subtitle, fields[], roots[]}]`. Zones: `ding | rim | inner |
bottom`. `chords[].fields` is the canonical voicing in spelling order.
`options.parent` is null on decks saved from the sheet; the engine infers it.

- **Typed order seats the rim and inner rings** (owner 2026-10-23); the drawer is the
  correction path. Do not "fix" it to ascending. Tests: `tests/app.test.js` "OF:".
- **Saved instances:** local handles, not engine IDs, identify a saved scale; `#s=`
  never carries a handle. `docs/ENGINE-SPEC.md` sections 12 and 14.

## Print pipeline

- `python3 tools/decks.py OUT_DIR` builds the three CHORD_ONLY PDFs (refuses
  without OUT_DIR). Needs `reportlab`; tests add `pymupdf`, `fonttools`.
- Card **62.65 x 87.21 mm (177.6 x 247.2 pt, poker size)**, US Letter 3x3,
  gutters 12.2/9.4 pt, crop marks at all card edges, 2.00-inch calibration bar
  on page 1 (print at 100% / Actual Size).
- The browser build can print a subset of a scale's cards (`opts.cards`, engine rule in
  `docs/ENGINE-SPEC.md` section 19): cards keep their app `#n`, gaps allowed, and the
  `tools/hifi.py` / `tools/decks.py` output stays the full set.

## App behaviour

- While no sheet is open the address bar holds the shown deck's link
  (`routeInfo`/`syncRoute`), written with `replaceState`, never `pushState`.
- **Default deck** is the `DEFAULT_DECK` constant (`kurd`), not `DECKS[0]`. A
  stored id of a visible deck is always honoured; a hidden one is not; a replaced
  seed shows its replacement.
- **Chip order is not picker order:** chips are custom decks newest first, then
  seeded slots in `data/decks.json` order (each slot shows its newest
  replacement). A test picking a custom deck by chip index targets older customs with `+ 1`.
- **Seeded decks:** SAVE writes a custom record with `replaces: "<seed id>"`;
  DELETE adds the id to `hidden` in the `hpfc` blob; RESET SEEDED SCALES clears both.
- `analyticsAllowed()` is false on `.pages.dev`, `file:`, `localhost`, `127.0.0.1`, `[::1]`, webdriver and the `G-XXXXXXXXXX` placeholder id (`tests/app.test.js` "analyticsAllowed is false for the DEV host on Cloudflare Pages: no gtag script, no config, no event" and its sibling per-condition titles).
- **DOWNLOAD PDF is a menu** (PDF tier options D1-D9): `#print-download` toggles `#print-menu` with
  three cumulative items, EASY, EASY + MEDIUM, ALL (`HPE.sequence.tierCards`, computed once per
  scale and cached in `pdfTierSets`). Nothing is remembered. The menu stays inside `.prints`, opens
  upward when it would cross the panel bottom, and Escape closes only the menu. An option whose set
  is empty is disabled. Filenames: `<Name>_CHORD_ONLY_EASY_<paper>.pdf`,
  `<Name>_CHORD_ONLY_EASY_MEDIUM_<paper>.pdf`; ALL keeps the old name and passes no `cards`, so its
  bytes are unchanged. `pdf_download` carries `cards` = `easy` / `easy_medium` / `all`
  (`tests/app.test.js` "PDF tier menu (lane U)").
- **The paper choice is a menu too** (owner 2026-11-08, from an iPhone screenshot where the native
  select opened the grey system popup beside our white menu): `#print-paper` (button, label =
  current paper, LETTER or A4) toggles `#print-paper-menu` with two `menuitemradio` items,
  `#print-paper-letter` and `#print-paper-a4`, inside `#print-paper-wrap` in `.prints`. It shares
  the closed-button rules with `#print-download` and the popup rules with `#print-menu`. Choosing
  an item calls `setPrintPaper` (same storage key, same PDF output), closes the menu, returns
  focus to `#print-paper` and keeps the panel open. Only one of the two menus is open at a time;
  outside tap, Escape and a choice close it, and Escape closes only the menu. No chevron.
  Tests: `tests/app.test.js` "PDF tier menu (lane U)" paper-menu cases, `tests/e2e.test.js` "the
  paper button is styled like DOWNLOAD PDF" and the per-locale PDF tier menu test. `#lang-select`
  stays a native select.
- The sheet guidance slot (`#scale-guidance`) reserves nothing: with no message it
is out of flow and 0px tall (owner 2026-10-20, superseding the guidance plan's
36px reserve).
- The importer (`HPE.importer`) is engine-only: the paste-text
import UI and the `scale_import` event were removed; do not rebuild them.

## Scale editor

The scale editor is one panel: a header (Back, title, Standard / Neotone switch), the notes
line, a status line, the pan drawing, the zone counts and hint, a two-tab control area
(Scale, Layout) and an action row (Undo, Save, `...`). It replaces the legacy sheet
editor. Plans: the editor release candidate plan and the editor panel simplify plan (tabs,
counts, menu). Claims below cite
the test that pins them; items marked PLANNED or PENDING have no passing test yet and
carry the lane that lands them, so a reviewer can re-check each after that lane merges.

- **Shell and Save.** A new scale opens empty with the empty copy shown and Save disabled; a
  built-in opens with its notes and saves as a NEW scale (the built-in is untouched); a
  saved scale updates in place, one more revision; a saved scale opened and saved untouched
  is byte-equal. Tests: `tests/editor_e2e.test.js` "a new scale opens empty",
  "editing a built-in saves a NEW scale", "a saved scale opened and saved untouched is
  byte-equal", "a changed saved scale updates in place". Back on a clean panel closes with
  no prompt; with changes it asks Save, Discard or Keep editing, and Escape is Keep
  editing. Tests: "a clean panel closes with no prompt", "Keep editing returns to the
  panel", "Escape while the prompt is open is Keep editing", "Discard closes and saves
  nothing". Share links and saved records are unchanged by the editor: an over-cap scale
  saves with the same record and link ("parity 9 save").
- **Pan type.** The header Standard / Neotone switch changes the pan type as one Undo step
  each way and returns the panel to the Scale tab. Tests: "switching the pan type returns
  the panel to the Scale tab", "Standard to Neotone and back are one Undo step each".
- **Scale name.** The Scale panel opens with a name field: 40 characters at most, trimmed,
  16px or larger so iOS does not zoom, a 44px target, and a tab stop. A name the user
  blanks stores nothing and the auto name shows (placeholder = the auto name; on Neotone it
  carries the Neotone suffix); a new Neotone scale saved with its name never typed stores the
  suffixed auto name. Enter or leaving the field commits it as one Undo step; Escape restores
  the stored name without closing the editor. Typing a name and tapping Save at once saves
  the typed name. A name change alone makes the editor dirty. Pressing the field starts no
  drag, and taps or keys on the pan do nothing while it is being typed in. Tests:
  "the name field leads the Scale panel and meets the phone input rules", "the placeholder is
  the auto name", "Enter commits the name as one Undo step", "leaving the field commits it,
  a blank restores the auto name", "Escape in the field restores the stored name", "type a
  name and tap Save at once", "a press on the name field starts no drag", "while the name is
  being typed a tap or key on the pan changes nothing", "the two inputs hand over", "Back,
  the ... button and the dialog save all commit a pending name first", "a name change alone
  makes the editor dirty", "a new Neotone scale stores the suffixed auto name"; model
  `tests/editor_model.test.js` "N1-M1" to "N1-M7".
- **Tabs.** Two tabs, Scale and Layout (`role="tablist"`, roving tabindex, Arrow, Home and
  End move and activate; the other panel is `hidden`). The pan, status, counts and hint sit
  outside both panels and show on both tabs. Scale holds the name, the 12 note chips, the
  octave row and the Sharps|Flats control; Layout holds the anchor buttons and the card
  palette. A held note survives a tab switch. Tests: "tabs: tablist semantics",
  "tabs: Scale holds the notes, octave and Sharps|Flats", "tabs: a held note survives a tab
  switch", "counts: both hint lines render under the counts on both tabs".
- **Swipe between tabs.** A horizontal swipe on the Scale panel, the tab strip, the counts
  row, the hint or the Layout panel switches tabs. A swipe that starts on the pan, a note
  chip or a text field, starts within 24px of a screen edge, is held past the hold time, is
  short, slow or mostly vertical, or happens while a note is held or selected, the line is
  edited, a dialog is open or a drag is live, switches nothing. With reduced motion the cue
  does not slide. Tests: "a left swipe on the Scale panel opens Layout", "a swipe that
  starts on the tab strip", "a press held past the hold time is not a swipe", "with reduced
  motion the swipe cue does not slide", "a short, slow or mostly vertical swipe changes
  nothing", "a swipe that starts on the pan, a tray note or a text field", "a swipe does not
  switch tabs while a note is held or selected", "a swipe does not switch tabs while the
  line is being edited or a dialog is open", "a swipe that starts within 24px of either
  screen edge", "a swipe does not switch tabs mid-drag".
- **Notes, octave, Sharps|Flats.** The tray has the 12 chromatic note names and no Ding or
  Root button. Octave is a stepper (visible Octave label, accessible name `Octave n`) and
  Sharps|Flats is ONE two-state control, Sharps by default; both are Undo steps and never
  make a scale dirty. Tests: "the tray has the 12 note names", "the octave stepper and the
  flat toggle are Undo steps", "Sharps|Flats: one two-state control", "the octave stepper
  carries a visible Octave label", "TRI59 octave stepper is compact at every phone and
  tablet size".
- **Zones, counts and caps.** Standard shows `Rim n/12`, `Cyclops n/6`, `Bottom n/12` and
  `Ding n/1`; a zone at its cap reads Full and refuses a further add with the exact copy;
  a crowded cyclops/bottom is refused with the pt figures. Neotone shows `Main n/9`,
  `Mutant n/9` and `Ding`, with no Full mark and no area caps. An over-cap saved scale
  loads and saves unchanged; only a further add is refused. Tests: "D17: the counts read",
  "D16: a full area reads Full", "D16 e2e: the 6th cyclops note is refused as crowded",
  "counts: Standard shows Rim, Cyclops, Bottom and Ding; Neotone shows Main, Mutant and
  Ding"; model `tests/editor_shell.test.js` "U2d-2", "U2d-3", "U2d-5", "U2f-7".
- **Hold, tap and place.** Tapping a note chip HOLDS it (status line with a Cancel chip;
  tapping it again, Cancel and Escape cancel); tapping a pan spot, a ring or the ding places
  it. There is no "Add to" pill and no auto-fill. A rim note lands in pitch order; a cyclops or
  bottom note tapped at a free spot lands at that spot's 5 degree angle and is pinned, and one
  added to the area as a whole (the keyboard area stop, or a tap with no free angle) takes its
  auto position, unpinned. A held note replaces a placed note in its
  seat; a tray note on the ding replaces it; a placed bottom note on the ding swaps seats
  with it. Tests: "holding a note shows the status with a Cancel chip", "tap-tap placement",
  "a held note tapped on a placed note replaces it", "D23: a tray note on the ding replaces
  it", "the ding takes a held tray note or a selected bottom note through the pan, with no
  Replace ding button".
- **Remove and pins.** Remove (in the menu) deletes the selected note and Undo restores it.
  A cyclops or bottom note placed at an exact angle stays pinned and saves as record v6;
  adding a note keeps pins; Reset spacing re-spaces and unpins (scoped to the selected note's
  zone, else the selected zone, else every pinned zone); changing the notes line while pins
  exist says `Pins reset` with Undo. Tests: "Remove deletes the selected note",
  "D5: a cyclops note tapped at an exact angle saves as record v6", "parity 6 / Re-space e2e",
  "D18 zone", "changing the notes while pins exist says Pins reset".
- **Drag and drop.** A drag starts after more than 8px of movement (8px or less is a tap).
  From a tray chip or a placed note it can land on a rim, cyclops or bottom spot, on a note
  (replace or swap) or on the ding; a placed note released off the pan is removed with Undo,
  the ding and the last rim note are refused, a tray note off the pan is cancelled with no
  step, and a pointercancel never removes. Tests: "D3: a tray note dragged to a rim spot",
  "D4: a drag swaps two placed notes", "D4 / SE-6: dropping a placed note off the pan",
  "OQA ding drag off refuses", "OQA last rim drag off refuses", "OQA pointercancel never
  removes", "D3: 8px or less of movement is a tap".
- **Editor drag layout** (owner 2026-11-07, magnify committed 2026-11-12): while a note is held
  in a live drag, from `editorDragLift` to `editorDragEnd`, the control panel (areas, tabs,
  panels, counts, toolbar, tray) is hidden outright (`#editor.dragging`: slid down, opacity
  0, `visibility:hidden`, `pointer-events:none`) and the pan magnifies from its top edge into
  the freed space by `--ed-mag` (measured once at the lift, at most 1.35, never past the
  screen width, never below 1). The panel returns after the drop is painted, at once on a
  cancel (Escape, pointercancel, resize, orientationchange, a hidden page), and ignores taps
  for 250ms (`.settling`). With reduced motion the pan stays at 1x, there is no slide, and the
  new-note stroke fades statically. A note placed by drag, tap, a zone add, a ding swap, a trade or the
  keyboard carries `.editor-new` once; Undo does not. Tests: `tests/editor_e2e.test.js`
  "drag ux E1" to "E7", "the tabs and both panels leave play with the rest of the controls
  while a note is dragged", "with reduced motion the tabs and panels do not animate in or
  out of play"; `tests/editor_shell.test.js` "drag ux unit 1" to "4".
- **Undo and Redo.** Every edit is one history step; Undo and Redo walk back through drops,
  a pan-type switch and Reset spacing; a refused or no-op action adds none. Exactly one
  Undo is visible at a time. Cmd or Ctrl+Z is Undo, with Shift it is Redo, except while the
  notes line is being typed in, while naming, in a dialog and mid-drag. Tests: "Undo and Redo walk back through drops, a pan-type
  switch and Reset spacing", "OQA one visible undo: exactly one visible Undo", "Cmd/Ctrl+Z is
  Undo and Shift+Cmd/Ctrl+Z is Redo"; model `tests/editor_model.test.js` "U2a-H1" to "U2a-H3".
- **Action row and menu.** The row is Undo, Save (violet, white text, 4.5:1 or better) and
  the `...` button. The menu holds Redo, Remove note, Reset spacing and, only on an edited
  scale, Delete scale after a separator: arrows move, Escape and an outside tap close it,
  Tab closes it and returns focus, disabled items are `aria-disabled`. Delete takes two
  presses (the first arms and says what will go, a press inside the 400ms guard does
  nothing, the second removes the saved scale and closes the editor); an armed Delete
  disarms on Escape, an outside tap or the next press, and a failed delete leaves it
  disarmed. Tests: "menu: the ... button opens a menu", "menu: an outside tap closes it",
  "menu: Redo and Remove note act and close the menu", "menu: Save is violet with white
  text", "menu: Delete is in the menu only on an edited scale", "menu: an armed Delete
  disarms when the menu closes", "TRI59 delete first tap arms", "TRI59b a delete that fails
  shows the error in the editor", "TRI59b the last-scale refusal resets the button title".
- **Layout tab: anchors.** Exactly two buttons, `#1 CENTRED` and `#1 / #2`
  (`sheet.anchor_one`, `sheet.anchor_between`), 44px or larger and in view at 320, 375 and
  820 wide; no Mirror and no Rotate (the app-wide MIRROR feature, saved and shared mirrored
  layouts are untouched; a scale saved mirrored keeps its flags and stays editable by swap,
  remove and save). With no notes both are disabled (on Neotone they are also hidden); that is the only
  disabled state. Standard: the anchor splits notes 1 and 2,
  `aria-pressed` follows, a repeat adds no step. Tests: "PL-a the Layout row holds only the
  two anchor buttons", "PLa-N2: with no notes both anchor buttons are disabled", "the anchor
  splits notes 1 and 2", "the anchor controls are at least 44px", "PL-a a permuted Neotone
  arrangement is dropped by Cancel and kept through SAVE"; model `tests/editor_shell.test.js`
  "U2e2-7", "U2e2-8", "PLa-1".
- **Layout tab: card palette.** Ten palettes; a pick is one Undo step, picking the current
  palette adds none, palette 0 writes no option, and a swatch pick keeps the Layout tab.
  Today a chip toggles the swatch group open (PLANNED below replaces it). Tests: "the palette
  chip opens ten 44px swatches in the Layout tab", "picking the current palette closes the
  swatches", "tabs: choosing a palette swatch keeps the Layout tab"; model
  `tests/editor_shell.test.js` "U2e2-1", "U2e2-2".
- **Neotone.** The Neotone pan has 9 main fields and 9 mutant fields, each mutant in the field
  of its main; a tray note fills the first empty main field; a mutant needs its field filled
  (`Field n is empty`); a note moves only inside its own row; tap-swap and tap-move take the
  drag's path; the hit test names the field under the pointer. Reset spacing is disabled and
  no pin is made. Tests: "a tray note dragged to an empty main field fills it", "a mutant
  dragged into an empty field is refused", "D3 tap parity: tapping a main note then another
  swaps them"; model `tests/editor_shell.test.js` "U2e-1" to "U2e-11". The `#1 CENTRED` and
  `#1 / #2` buttons are never greyed out on Neotone (owner 2026-11-11) and work as on
  Standard, including with and without mutant notes: PENDING lane A1/A2 (PL-b). Until then
  the pair is hidden on Neotone, never disabled (test: "the Neotone pair is hidden, never
  disabled"). Those lanes also cover wire v9 and record 7, owned by `docs/ENGINE-SPEC.md`.
- **Keyboard and accessibility.** Every placed note, the cyclops area and the bottom ring
  are named stops with one tab stop in the pan; Enter picks, arrows move between seats,
  Enter on another note swaps; Left and Right nudge a picked cyclops or bottom note 5
  degrees; Escape cancels a pick and, with nothing picked, is Back; Tab stays inside the
  panel; the status is a live region. Tests: "every placed note, the cyclops area and the
  bottom ring are named stops", "keyboard pick and drop", "Left and Right nudge a picked
  bottom or cyclops note 5 degrees", "Escape cancels a pick and does not leave the panel",
  "focus order and accessibility of the panel".
- **Fit.** Every label in the tabs and toolbar fits its button at 390, 375 and
  320 wide in all eight UI languages with the real fonts. The fit test covers the tabs and
  toolbar buttons only. Tests: "every label in the tabs, the count row and the toolbar fits
  its button", "TRI59 octave label and delete fit in all
  eight locales".
- **Legacy sheet editor: removed.** Once lane U2j-2 lands, the editor above is the only way
  to add or edit a scale, and the `ONE_PANEL` flag, the sheet tabs, drawer and its swipe are
  gone (U2j-1 removed the sheet swipe; its tab swipe is the editor's). PENDING lane U2j-2:
  until it merges, `ONE_PANEL` is still present and the test "with the flag off no editor
  panel is ever built and the legacy sheet opens" still exists; the RC gate is zero hits of
  `ONE_PANEL` in `index.html`.

### Planned (lane W5a, not yet built)

Three owner-approved changes land together in lane W5a after U2j-1. They are described
here as the intended behaviour; every test named is specified by the plan and does not
exist yet, so re-check this block after W5a merges and delete the PLANNED marks.

- **PLANNED (W5a): quieter selected tab**.
  The selected tab shows through `aria-selected` only: transparent background, a 3px accent
  underline (`#6756B5`), full-strength text (`#242424`, weight 600); unselected tabs are muted
  (`#5E5A53`); no `.on` class on editor tabs, no fill on hover or `:active`, so `#1 CENTRED`
  is the only filled control on Layout. Test: a selected-tab computed-style test in
  `tests/editor_e2e.test.js` (to be added; mutant `ets_tab_filled_on_select`).
- **PLANNED (W5a): flat card palette**.
  The `#editor-palette` chip is removed; `#editor-swatches` is always shown on Layout under a
  visible label (`editor.palette`, "Card palette") as a 5x2 grid of 44px dots with
  `aria-labelledby`; one tap picks, the group stays open, Undo covers it, the palette is
  absent from the Scale tab, a pick during a dialog is refused. The ten chip tests in
  `tests/editor_e2e.test.js` are rewritten to the flat behaviour (to be added; mutants
  `epf_swatches_hidden_again`, `epf_pick_needs_two_taps`).
- **PLANNED (W5a): message placement**.
  `#editor-status` moves to just under the pan box, before the counts; an error shows as an
  ink pill (`#242424` background, white text, 14px/600, radius 8px, a leading warning
  glyph, no red, no hover) and plays one 180ms settle only when the error text changes (none
  under reduced motion); notices stay plain text. During a drag the status stays visible below
  the magnified pan (the pan's grow room excludes the status height in portrait). The
  reserved height is 40px, 56px at 360px wide or less. Tests to be added in
  `tests/editor_e2e.test.js` (mutants `emp_status_back_on_top`, `emp_error_plain_text`,
  `emp_status_under_drag_pan`).

## Feature plans

Sheet guidance and footer lip: `docs/plans/2026-10-13-sheet-guidance.md`,
`docs/plans/2026-10-21-sheet-polish.md`, `docs/plans/2026-10-20-phone-fixes.md`. Sheet tabs and landscape plate:
`docs/plans/2026-10-19-sheet-tabs.md`. Dual input:
`docs/plans/2026-10-19-dual-input-sheet-ux.md`. Importer:
`docs/plans/2026-10-16-scale-import.md`. Discoverability, routes, GA, JSON-LD:
`docs/plans/2026-10-16-discoverability.md`. About overlay:
`docs/plans/2026-10-17-about-off-main.md`. DEV env: `docs/plans/2026-10-17-dev-env.md`.
Scale engine roadmap and owner decisions: `docs/SCALE_ENGINE_PLAN.md`. Scale editor: the editor release candidate plan.
