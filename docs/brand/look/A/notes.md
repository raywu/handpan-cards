# Direction A: Conservative ("today, rebranded")

**Idea.** Change only what the rebrand needs and nothing else. The app keeps its warm `#1a1815` ground and radial gradient, its chips, buttons, sheets and gold links. The "Handpan Chords" text title becomes the Handpan Theory horizontal lockup (`horizontal-full.svg`: mark, wordmark and CHORDS & PROGRESSIONS), and the same lockup heads About, handpan-101 and the scale pages. The h1/h2 text stays in the DOM. I fixed one inconsistency because the case for it is clear: the scale pages' dark scheme used a cool slate `#15181b`, while the app and handpan-101 use warm `#1a1815`, and the scale pages' own arrow buttons were already the app's warm `#211d16`/`#433b2c`. They now use the warm ground. I deliberately did **not** change the scale pages' green links to gold. Those links are the per-scale root accent, which the owner likes, so I kept it on links, h2, the section rule and the CTA. Every card stays exactly as it is.

Files: `app.css` (app), `pages.css` (scale pages, handpan-101), `shots/`, `measure-1a1815.json`, `measure-26221c.json`. Extra screenshot: `shots/main-375x667-2x.png` (short-phone header).

## What changes

| Area | Today | A |
| --- | --- | --- |
| Ground (app) | `#1a1815` + radial to `#26221c` | unchanged |
| Header | Marcellus text "Handpan Chords" 20-27px | `horizontal-full` lockup in the h1's 1fr column, 72px tall (80px at >=640px wide, 44px when vh < 740). h1 text kept (font-size 0) |
| Links | gold `#e3b25c` (app, About, handpan-101); scale accent (scale pages) | unchanged |
| Chips | `#272219` pills, root-colour active border | unchanged |
| Buttons | `.mode` warm squares | unchanged |
| Sheets (settings, edit) | `#1a1815` panel | unchanged |
| About | sticky head: BACK + "About Handpan Chords" h2 | sticky head: BACK + lockup (56px) on row 1, h2 under it (24-34px, was 30-44px). Text unchanged |
| Scale pages | cool `#15181b` dark / `#fbfaf8` light, text breadcrumb first | lockup above the breadcrumb (full lockup on dark, `horizontal-mono-light` on light); dark ground becomes **flat** `#1a1815`; per-scale accent kept |
| handpan-101 | `#1a1815`, "<- Handpan Chords" back link first | lockup above the back link; everything else unchanged |
| 404 | unstyled light page | not mocked (shoot.js skips it). Proposal: same lockup on `#1a1815` with gold links, about six lines of CSS |

## Worst-palette numbers (all 10 palettes; the ground is unchanged, so they equal the baseline)

| Ground | Worst frame (>=3:1) | Frames below 3:1 | Worst chip dot on `#272219` | Card vs ground | CVD min pair dE (CIE76) |
| --- | --- | --- | --- | --- | --- |
| `#1a1815` (darkest stop) | purple `#6D40A3` **2.46** | 1, 6 (blue 2.94), 9 (crimson 2.75) | purple 2.19 | 17.72 | protan 14.6, **deutan 3.3** (Amara 10 green/crimson vs its swap), tritan 10.6 |
| `#26221c` (lightest stop, behind the header) | purple **2.19** | 1, 6, 9 | 2.19 | 15.81 | same |

A fixes none of the existing palette shortfalls. That is the honest cost of the smallest change: on this ground purple, blue and crimson frames stay under 3:1.

Scale-page accents on the new dark ground (`accents()` needs 4.5:1). On flat `#1a1815`, 14 of 16 pages pass as they are. **D Kurd 9 and D Sabye 9** (`#3D81D6`) come out at **4.48** and fail. Recomputing them with `BG_DARK="#1a1815"` gives `#4184D7`. I dropped the gradient on the scale pages for a reason: on its top stop `#26221c` every accent falls to about 4.0-4.2:1, right behind the breadcrumb link.

## Pinned values that move (grep of devtree `tests/`)

- `tests/e2e.test.js` `CHROME_BUDGET`: the 72px lockup adds **+28px chrome** (225.67 to 253.67 at 390x844 and 390x745; desktop 245.67 to 281.67). At 390 wide the card width does not change (343px), but the `maxChrome` rows need re-measuring. Without the short-screen rule the card shrinks below `minCardW` at 375x667 (306.8 to 299.3) and 320x568 (247.9 to 227.6). With the `max-height:739px` 44px rule, chrome there is identical to today. `tests/mutants/e_target_chrome_eats_card.patch` may need a re-check.
- `tests/test_scale_pages.py` `BG_DARK = "#15181b"` plus its 4.5:1 dark-accent assertion. Both move to `#1a1815`, together with `BG_DARK` in `tools/gen_scale_page.py`, and every scale page is regenerated (Kurd 9 and Sabye 9 accents change).
- `tests/test_scale_pages.py` regex `\.abouthead\{[^}]*background:#1a1815` still holds. A adds properties, not a new background.
- No change to theme-color (`#1a1815` app and handpan-101; scale pages use the root colour), to the `--table` tokens or to font sizes outside the About h2.
- The h1 text "Handpan Chords" and the og:site_name/publisher strings belong to the rebrand-copy plan, not to this direction.

## Effort and reversibility

**S.** About 25 lines of CSS in `index.html` (outside the generated regions), a few lines in the `gen_scale_page.py` and handpan-101 templates, the logo SVG shipped as a sibling file (or inlined as a data: URI to keep the single file self-contained), CHROME_BUDGET re-measured, and scale pages regenerated. No i18n keys, since no visible text changes. Fully reversible: delete the rules and restore `BG_DARK`.

## Honest weaknesses

- **The tagline is too small at phone width.** At 72px the lockup is about 252px wide, and CHORDS & PROGRESSIONS renders about 4px tall: a texture at 1x DPR, barely legible at 2-3x. At the 44px short-screen size it is decoration. The horizontal lockup was drawn for wider placements. A real lane may want a phone lockup with a larger tagline, or a wordmark-only header.
- The 44px short-screen lockup is below the README's 64px minimum. It is an owner call: the README minimum, or no cost to the card.
- The full-glow lockup is the brightest object above the card. It is small, but it is new light in the chrome.
- The lockup is a picture, not a link home. On the static pages a real lane should wrap it in `<a href="/">`, which CSS alone cannot do.
- Leaving the ground alone means the 3 frames below 3:1 stay below 3:1, and deutan green/crimson stays at dE 3.3. A is the "accept today's readability" baseline.
- About gets taller by about 60px in its sticky head (lockup row plus h2 row).
