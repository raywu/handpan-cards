# Plan: the Handpan Theory look around the cards

Status: EXPLORED 2026-10-31, waiting on the owner's pick. Review page:
https://claude.ai/artifact/WLJN6SePLb9kTzE8gdhAfp. Prompt:
`docs/prompts/2026-10-31-app-look-around-the-cards.md`. Nothing under
`src/`, `index.html`, `data/`, `tools/` or `scales/` changed.

Four directions were built as CSS overrides injected into the real `dev`
app and pages (Playwright), so every screen shows real cards. Each
direction's CSS, notes and numbers are in `docs/brand/look/<A-D>/`; the
harness is `docs/brand/look/shoot.js` (screens) and `measure.py` (palette
numbers). Phone contact sheets: `docs/brand/reference/look/*-phone.webp`.

## The directions

| | A: today, rebranded | B: brand board | C: colour-led | D: measured stage |
| --- | --- | --- | --- | --- |
| Idea | smallest credible change | the board and mock, faithfully | the scale's colour enters the chrome | let the palette numbers pick the ground |
| Ground | `#1a1815` + radial (unchanged) | `#0F0E0B`, faint lift behind header | `#0A0908` + root-colour wash far from the card | stage `#080706` flat, chrome band `#1A1814` |
| Header | horizontal-full lockup, 72-80px | lockup 64px between link and menu buttons (mock) | lockup 64px + teal-to-gold rule | lockup 64px in a full-width surface band |
| Links | unchanged gold | gold `#F5C78E` underline in About, handpan-101 | root colour, lightened | unchanged |
| Chips, buttons | unchanged | `surface` + hairline, 12px squares, plain 1.5px root border on the active chip | tinted active chip with halo, keyline on dots | hairline buttons; chip pills on the stage colour |
| Sheets, About | unchanged + lockup | board tokens | root-coloured headings | brand surface |
| Scale pages | lockup; dark ground warmed to `#1a1815`; green accent kept | `#0F0E0B` / `#F6F4ED`, accents recomputed (all ≥4.5) | accent re-derived, logo | brand grounds; progression on a dark stage plate in both schemes |
| Breaks a README rule | no | no | yes: colours whole controls, glow on chrome | no |
| Effort, reversibility | S, full | M, full | M, full | M, full |

## Palette readability (all 10 engine palettes)

Frame vs ground at least 3:1; worst pair reported.

| Ground | Frames below 3:1 | Worst frame | Worst chip dot | White card vs ground |
| --- | --- | --- | --- | --- |
| today app `#1a1815` (also A) | purple, blue, crimson | purple 2.46 | 2.19 | 17.7 |
| today radial top `#26221c` (A) | same | purple 2.19 | 2.19 | 15.8 |
| B `#0F0E0B` | purple, crimson | purple 2.68 | 2.46 | 19.3 |
| C `#0A0908` | purple | purple 2.76 | 2.46 (dots get a keyline: 11:1) | 19.9 |
| C wash peak (Pygmy) `#2C1C3D` | 4 palettes | purple 2.17 | | 15.7 |
| D stage `#080706` | purple | purple 2.79 | 2.79 | 20.1 |
| today light scale page `#fbfaf8` | amber, gold, orange | amber 2.52 | | 1.04 |
| B/C/D light page `#F6F4ED` | amber, gold, orange | amber 2.38 | 2.14 | 1.1 |

What the numbers say:

- **No ground passes everything.** D swept 1,024 grounds: purple
  `#6D40A3` needs a ground darker than black (2.91 on pure black) and
  amber `#DD8F00` one lighter than white. Only a palette change fixes it,
  and palettes are locked. On dark grounds the white card carries the
  outline (17-20:1), so the frame is a colour cue, not the edge.
- **Darker is better for the cards.** Moving from `#1a1815` to the board's
  `#0F0E0B` drops the failing frames from three to two; going further
  (`#080706`) leaves only purple, for little visible gain.
- **Light page grounds are already weak** for the yellow palettes and lose
  the white card; that is true today and in every direction.
- **Colour-blind check:** the weakest pair everywhere is Amara 10 against
  its own swap (green/crimson vs crimson/green), deutan ΔE 3.3. Grounds
  cannot change it; the swatch picker's order or labels could (proposal,
  not in scope).

## Card match (app vs scale pages)

Full table: `docs/brand/look/cardmatch.md`. The scale pages copy the app's
**progression mode**, not its flash-card mode, so face order and the missing
hint already match (the prompt's starting table compared with the wrong
mode). The diagram face is the app's anatomy at different proportions; the
name face is a leftover page-only design; behaviour matches except that
Enter does not flip on the page.

**Recommendation: drift fixes** in `tools/gen_scale_page.py` (63:87 aspect,
header inset, lines in container units, the app's name face, Enter flips;
the 3.2px frame optional). Not shared markup: the app's card CSS is sized by
the viewport and would still not match. Binding cost: about 1 KB of byte
budget left on the largest page. Lower-churn option: name face and Enter
only.

## App-to-brand mapping

`docs/brand/look/mapping.md` / `.json`: 154 rows. Chrome uses 38 colours,
10 font stacks, 17 font sizes, 8 letter-spacings, 5 shadows, 8 radii, 30
spacing values (93 of 226 uses already on `--sp-n`). Each row: keep and
name as a token, change to a token, or drop. The three board conflicts,
with defaults:

1. **Gold:** keep app `#E3B25C` as a new functional token `signal` (focus
   ring, links, warnings); the board's `#F5C78E` stays in the mark. The
   board's peach is too close to the cream fills for a warning to read.
2. **Text:** adopt the board's `#F6F4ED`, folding `#EAE6DF` and `#F4F0E8`
   into it.
3. **Background:** adopt the board's `#0F0E0B` and drop the radial; the
   frame numbers above favour it, and the board's surface `#1A1814` absorbs
   three near-identical browns.

## Pick: B, with one borrowing from C

B is the brand board as designed, and the mapping's three defaults are
B's values. It improves the card frames (three failing to two) without
colouring the chrome, and stays inside the README's rules. Borrow C's
light keyline on chip dots, which lifts every dark dot to 11:1 against its
chip at no cost to the cards.

Keep the scale pages' per-scale accent (B recomputes it for both new
grounds; all ≥4.5:1).

C is the alternative if you want the scale's colour in the chrome; it
needs the README rules relaxed and a precomputed accent for older iOS. A
and D are reference points: A changes the least but fixes nothing; D's
two-zone stage buys purple 0.11 more contrast at the cost of the warm glow.

## Open questions (defaults in bold)

1. **Header lockup height.** At the board's 64px minimum the lockup adds
   20-28px to portrait chrome: the card shrinks by up to 19px at 320x568
   and the e2e `CHROME_BUDGET` rows fail; the tagline renders about 5px
   tall. Options: **64px on screens 740px tall and up, 48px below, and
   lower the README minimum to 48px**; or 64px everywhere and accept the
   smaller card; or the mark plus a text title.
2. **Which direction:** **B + chip keyline**, C, A or D.
3. **Card match:** **the six drift fixes**, the low-churn two, or leave as
   is.
4. **Light scale pages:** keep a light scheme (yellow frames below 3:1 and
   the white card lost, as today), or **keep it and put the progression on
   a dark plate** as D does.

## After the pick (outline; lane detail once chosen)

Dev-first lanes per `CLAUDE.md`:

1. **Tokens and chrome:** `index.html` CSS only (`--table`, theme-color,
   surfaces, hairlines, text, chip keyline), the header lockup. Pinned tests:
   theme-color and page-background asserts in `tests/app.test.js` and
   `tests/e2e.test.js`, the reroll and share-copy colours, focus-ring colour
   if it moves, `CHROME_BUDGET`; mutant patches that quote changed values
   (about 120 in `tests/mutants/`) are regenerated. i18n: none unless the
   header gains visible text.
2. **Pages:** `tools/gen_scale_page.py` grounds and `accents()`, the
   handpan-101 and 404 heads; regenerate `scales/`. Tests:
   `tests/test_scale_pages.py`, `tests/test_handpan_101_page.py`.
3. **Card match** (if chosen): `tools/gen_scale_page.py` card CSS and
   markup; see `cardmatch.md` for tests and bytes.
4. **Design system:** add the mapping's new tokens, the conflict
   decisions and the header rule to the artifact.

Rollback: each lane is a CSS or generator change on its own PR; revert the
PR (on `dev` via `claude/dev-revert-<lane>`).
