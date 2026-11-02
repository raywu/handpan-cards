# Direction C: bolder than the board, led by the scale's colour

**Idea.** The scale's root colour leaves the card and becomes the colour of the room. The card's surroundings are the darkest value on the page (`#0A0908`, darker than the board's `#0F0E0B`), so the frame gets as much contrast as a dark ground can give it. The root colour goes into the margins instead: a soft wash 150px down from the top edge behind the lockup and chips, a fainter one 96px up from the bottom behind the arrows, the active chip (tinted fill, ring and halo), selected mode buttons, arrow glyphs, panel headings, About headings, link underlines, the focus ring and the progression underline. All of these use the root raised to OKLCH L ≥ 0.74 with CSS relative colour syntax (`oklch(from var(--root) max(l,.74) c h)`). That way one rule follows every palette, custom swatches included, with no JS and no per-scale table. The teal-to-gold orbit is repeated as a 1.5px rule under the header lockup. Switching scales recolours the whole page: green for Amara 10, blue for Kurd, magenta for Hijaz, violet for Pygmy.

Files: `app.css`, `pages.css` (scale pages, handpan-101, 404), `shots/`, `measure-*.json`, `tools/ok.py` (OKLCH lift + WCAG), `tools/extra.js` (landscape, progression, chrome-budget probe).

## What changes

| Area | Change |
| --- | --- |
| Ground | Flat `#0A0908` where the card sits. Root-colour radial washes at fixed px sizes: 42% at the top edge fading out by 150px, 24% at the bottom fading out by 96px. Landscape (≤520px tall): top wash only, 46px. The old `--table2` radial highlight is gone. |
| Header | `horizontal-full.svg` lockup 64px tall as the h1's background. The h1 text stays in the DOM (`font-size:0`, transparent). A teal→gold 1.5px rule sits under the row. The rule is scoped to `min-height:521px`, so landscape keeps today's visually hidden h1. |
| Links | Text stays `text-primary`. The underline is the lifted root colour, 2px thick. |
| Chips | Board surface `#1A1814` with a `#3A352D` hairline. Every dot gets a 1.5px light keyline, so dark roots read on the dark chip. Active chip: a 24% root tint fill, a 1.5px lifted-root ring and a 3px soft halo in the root colour. The two-colour `border-image` is dropped. |
| Buttons | Surface plus hairline, 12px radius on the icon and nav buttons. Arrow glyphs use the lifted root. `.mode.on` and the open menu trigger use a root tint with a root ring and white text, where today they are a cream fill. |
| Sheets | Panel `#12100D` with a root wash at the top (mobile). Headings (`.panel-heading`, `.sheetlabel`) use the lifted root. The desktop sidebar's left border is tinted toward the root. |
| About | Flat ground; the sticky head carries a 2px root rule that fades to the right; h3 in the lifted root; links use root underlines. The wash is not used here because the 520px-wide head showed hard sides on desktop. |
| Scale pages | Same ground, a 220px root wash at the top, and the lockup plus orbit rule as `body::before/::after` (no markup change). h2 and the section rule (a gradient that fades out) use the accent, re-derived in CSS for the new grounds. Buttons become pills filled with the accent. The light scheme uses cream `#F6F4ED`, the `horizontal-mono-light` lockup and the accent capped at L ≤ 0.48. |
| handpan-101 | Same pages.css, dark only; its gold `--r` gets the same treatment. Light rules are scoped to `:root:has(section.scale)`, so 101 and 404 stay dark. |

## Numbers (worst palette, not averages)

Edge sampling: the ground just outside the card measures `#080707`–`#090807` at 380, 1280 and 844×390, on Amara 10, Kurd, Hijaz and Pygmy. No wash reaches the card. The first landscape pass did reach it; the 46px landscape wash fixed that.

| Ground | Card vs bg | Frames < 3:1 | Worst frame | Chip dot (raw, vs chip) | CVD min ΔE (protan/deutan/tritan) |
| --- | --- | --- | --- | --- | --- |
| C ground `#0A0908` | 19.9 | **#1 purple only** | purple 2.76 (blue 3.31, crimson 3.08) | purple 2.46 on `#1A1814` | 14.6 / **3.3** (7 vs 9) / 10.6 |
| board `#0F0E0B` (ref) | 19.3 | 1, 9 | purple 2.68 | 2.46 | same |
| panel `#12100D` | 19.0 | 1, 9 | purple 2.63 | 2.46 | same |
| wash peak (purple, `#2C1C3D`), never behind a card | 15.7 | 1, 6, 7, 9 | 2.17 | — | same |
| scale page light `#F6F4ED` | **1.1** | 3, 4, 5 (orange/gold/amber roots) | amber 2.38 | teal 2.14 | same |

Today's baseline on `#1a1815` has 1, 6 and 9 below 3:1. C fixes 6 (blue) and 9 (crimson). Purple cannot reach 3:1 on any dark ground: it measures 2.91 even on pure `#000`. Fixing it would need a lighter ground (direction D's territory). Its frame still has white on the inside, and the card edge is 19.9:1. Chip dots: the light keyline is `#CECCC6`, which is 11.0:1 against the chip, so every dot reads as a mark whatever its colour. Chip and accent text:

- The lifted root as text or marks is at least 7.72:1 on `#0A0908` and 6.87:1 on `#1A1814` (worst: crimson to `#FF767E`).
- White text on the active-chip tint is at least 11.7:1.
- Secondary text `#A9A39A` is 7.08:1 on the chip surface.
- Scale-page accent: dark ≥ 7.72; light ≥ 5.63 on `#F6F4ED` and ≥ 5.07 on `#ECE8DE`.

CVD: the palettes are unchanged, so these figures are the same in every direction. The weak pair is deutan 3.3: pair 7/9, which is Amara 10 green/crimson against its own swap.

## Pinned values that would move (grep of devtree `tests/`)

- `theme-color` `#1a1815` (`app.test.js` theme-color assert; `test_handpan_101_page.py`) → `#0A0908`.
- `e2e.test.js` "page background covers every viewport": `TABLE` `[26,24,21]` and `TABLE2` `[38,34,28]` frame sampling. The root wash makes the top and bottom edge band scale-coloured, so this test needs a new rule: sample the side bands, or allow a root-tinted top band.
- `e2e.test.js` rail underline: `decorationColor` must equal the raw `deck().colors.root` → C uses the lifted root. Contrast is checked on `#1a1815` → `#0A0908`.
- `e2e.test.js` `CHROME_BUDGET`: the 64px lockup adds **+28px** of portrait chrome (225.67 → 253.67). The card loses 7.5px wide at 375×667 (306.81 → 299.30) and 18.8px at 320×568 (246.44 → 227.61). It is unchanged at 390×844, 390×745 and in landscape. The owner must agree to this, or the lockup goes to about 48px on short phones, which is below the 64px brand minimum.
- `app.test.js` `.shuffle.reroll` and `#share-copy:disabled:active` `#433b2c`/`#211d16` → `#3A352D`/`#1A1814`.
- `e2e.test.js` DR1 focus ring "2px `#e3b25c`" → lifted root.
- `test_scale_pages.py` `SHARED_ROOT` (`--bg:#1a1815…--r:#e3b25c`), `BROWN`, the About pins (`background:#1a1815`, `.abouthead` bg, `#about h3/h4/a` colours `#e3b25c`/`#c4bcab`), and `.nav label` `#211d16`/`#433b2c`.
- `tools/gen_scale_page.py` `BG_LIGHT`/`BG_DARK` + `accents()`: replace with the L-floor/cap rule, or keep `accents()` and point it at the new grounds. The CSS relative-colour version needs Safari 16.4+ / Chrome 119+. A fallback would be precomputed `--rootL` in the generator for pages, and in `applyDeck()` for the app. That touches app JS, which is still allowed outside the engine regions.
- `.mode.on` `#f1ece1` cream fill → root tint (the pinned assert on `#272219` is the diagram ink, which is not affected).

## Effort and reversibility

**M.** In the app it is about 90 lines of CSS plus about 6 test updates. On the pages it is the generator's CSS head plus the about/101 pins, and the scale pages need regenerating. It is fully reversible: everything is CSS, and the only data-like change is the accent rule. The CHROME_BUDGET change is the costly part to revert, because it is a deliberate pixel trade.

## Honest weaknesses

- **It works against the brand README** ("never colour a whole control with an accent", "no glow on chrome"). The active chip halo and the tinted `.mode.on` break those rules on purpose. If the owner wants the board's restraint, this is the direction to take pieces from, not to ship whole.
- Purple stays below 3:1 (2.76). C improves it from 2.46 but nothing dark fixes it.
- The colour washes compete a little with the card for attention on loud palettes. The Hijaz magenta at 42% is the loudest; 30–34% may be the right production value.
- The chip ring and halo repeat the root that the card frame already shows. On Kurd's blue everything blue can look monochrome.
- The scale-page light scheme leaves the white card on cream at 1.1:1 (today's `#fbfaf8` is worse) and amber/gold/orange frames below 3:1. This was not addressed here.
- About lost its wash (the box-limited sticky head); it is flat with a root rule.
- Relative colour syntax is new. On older iOS (< 16.4) `--rootL` is invalid, so the accent declarations fall back to inherited or initial colours. Production should precompute it.
- The +28px header in portrait shrinks the card on small phones (see CHROME_BUDGET).
