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
  rule N extended). Under `options.angles` MIRROR BOTTOM moves only the notes
  whose entry is null (to their mirrored solved angle); explicitly placed notes
  stay, and every number stays at its angle.
- Inner notes (after the inner bar): one at top centre, two at 128 and 52, more
  fan across the top half; they push the ding toward the player by at least
  0.1425R, raised step by step while an inner index number would touch the ding
  (`HPE.layout` `geometry` loop). No
  inner notes means a centred ding.
- No note-count caps: a crowded pan draws smaller with `SMALL_LABELS`; never refused.
  `SMALL_LABELS` (`labelFloor`) ignores bottom octave digits; the separate print
  3.6 pt floor covers every glyph, bottom octave digits included.
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
  (`fit_note`'s own floor is 2.5 pt, so the test is the guard).
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
- The sheet guidance slot (`#scale-guidance`) reserves nothing: with no message it
is out of flow and 0px tall (owner 2026-10-20, superseding the guidance plan's
36px reserve).
- The importer (`HPE.importer`) is engine-only: the paste-text
import UI and the `scale_import` event were removed; do not rebuild them.

## Feature plans

Sheet guidance and footer lip: `docs/plans/2026-10-13-sheet-guidance.md`,
`docs/plans/2026-10-21-sheet-polish.md`, `docs/plans/2026-10-20-phone-fixes.md`. Sheet tabs and landscape plate:
`docs/plans/2026-10-19-sheet-tabs.md`. Dual input:
`docs/plans/2026-10-19-dual-input-sheet-ux.md`. Importer:
`docs/plans/2026-10-16-scale-import.md`. Discoverability, routes, GA, JSON-LD:
`docs/plans/2026-10-16-discoverability.md`. About overlay:
`docs/plans/2026-10-17-about-off-main.md`. DEV env: `docs/plans/2026-10-17-dev-env.md`.
Scale engine roadmap and owner decisions: `docs/SCALE_ENGINE_PLAN.md`.
