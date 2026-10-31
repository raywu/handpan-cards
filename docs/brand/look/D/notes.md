# D - The measured stage

**Idea.** Let measure.py pick the ground. A scripted sweep (`search.py`, 1,024 neutral and warm candidates from #000 to #fff, plus OKLab checks) shows that **no single ground gets all 10 frames to 3:1**. The roots run from purple #6D40A3 (relative luminance 0.096) to amber #DD8F00 (0.350). A 3:1 frame for purple needs a ground darker than black. A 3:1 frame for amber needs a ground lighter than white. Pure black is the best possible single ground, and purple still reaches only 2.91. Light grounds do worse: on #F6F4ED amber, gold and orange fail (worst 2.36) and the white card all but disappears (1.11). A mid-tone fails all 10. So D splits the screen into two zones. The **stage** is flat warm black #080706, the best warm option, used everywhere a card sits. It passes 9 of 10 frames (worst purple 2.79), separates the white card at 20:1, and has no radial lift because any lift lowers the numbers. The **chrome** (header band, sidebar, sheets, About) is brand `surface` #1A1814 with `hairline` borders and never touches a card. Scale pages keep a readable text ground in the viewer's scheme, but the progression sits on a warm-black stage plate in **both** schemes, because no light ground can hold the amber, gold and orange frames. The full-colour lockup only ever appears on dark grounds, and the light scale page uses `horizontal-mono-light`.

## What changes

| Area | D |
| --- | --- |
| Ground | App: flat #080706 (was the #1a1815 radial). No gradient. |
| Header | Full-bleed `surface` #1A1814 band with a `hairline` bottom rule. The h1 becomes `horizontal-full.svg` at 64px tall; its text stays (font-size 0, background-image). |
| Links | About links in `text-primary`, with a `accent-teal` underline. Scale pages keep their per-scale root accent. |
| Chips | Pills filled with the stage colour (#080706) inside the surface band, a 1px hairline, `text-secondary` labels. The active chip keeps its root/tone border. The dots are measured against the stage, not the band. |
| Buttons | `surface` fill, `hairline` border, `text-primary`. The on state is inverted (#F6F4ED on #0F0E0B). Focus ring is `accent-teal`. |
| Sheets | Settings panel, sidebar and edit sheet use `surface` #1A1814. Non-.mode buttons in settings use #0F0E0B. |
| About | `surface` ground; h3 in board gold #F5C78E (was app gold #E3B25C); links have a teal underline. |
| Scale pages | Ground is brand #0F0E0B (dark) or #F6F4ED (light). A lockup sits above the breadcrumb (mono-light on light). `.prog` becomes a 16px-radius #080706 stage plate holding the card, the rail and the arrows, in both schemes. |
| handpan-101 | Ground is #0F0E0B with a full lockup. Its gold --r is untouched (open conflict: #E3B25C vs board #F5C78E). |

## Worst-palette numbers (measure-*.json)

| Ground | Use | Frames < 3:1 | Worst frame | Worst chip dot | White card vs ground |
| --- | --- | --- | --- | --- | --- |
| #080706 stage | behind every card, chip fill | 1 (purple) | **2.79** purple #6D40A3 | 2.79 purple | 20.1 |
| #1A1814 chrome | band, sheets (no card) | 1, 6, 9 | 2.46 | n/a (chips are filled with the stage) | 17.7 |
| #0F0E0B page dark | scale-page text ground (cards on the stage) | 1, 9 | 2.68 | n/a | 19.3 |
| #F6F4ED page light | scale-page text ground (cards on the stage) | 3, 4, 5 | 2.38 amber | n/a | 1.10 |
| today #1a1815 | baseline | 1, 6, 9 | 2.46 | | 17.7 |
| best possible #000000 | theoretical | 1 | 2.91 | | 21.0 |

The colour-vision numbers do not depend on the ground (they compare palettes with each other): protan 14.6, **deutan 3.3 (palettes 7 and 9, green/crimson vs crimson/green)**, tritan 10.6. No ground fixes the deutan pair, because the two palettes are the same colours in swapped order. Scale-page accents (generator values for #fbfaf8 and #15181b), re-checked on the new grounds: dark worst 4.88 (passes). **Light worst 4.27 on c-sharp-mystic-8, below 4.5.** `accents()` in `tools/gen_scale_page.py` must be recomputed against #F6F4ED.

**Honest verdict:** D cannot reach ≥3:1 for all 10. It improves the baseline from 3 failing palettes to 1 and moves the worst frame from 2.46 to 2.79. The rest of purple's edge comes from the white card margin. To fix purple fully, someone would have to change the palette, which is engine data (a separate proposal, not this direction).

## Pinned values that would move (devtree tests/)

- `--table #1a1815` / `<meta name="theme-color" content="#1a1815">` would become #080706. Affected: `tests/e2e.test.js` (`TABLE = [26,24,21]`, and the rail-colour AA message "on #1a1815"; the ratio rises, but the constant changes), `tests/test_scale_pages.py` (`BROWN`, `SHARED_ROOT`, the About and `.abouthead` `background:#1a1815` asserts), and the mutants `ab_theme_color_dropped`, `ab_color_scheme_dropped`, `ao_about_width_capped`, `nm_*` and `ui_rail_small` (their patch context contains #1a1815).
- `BG_LIGHT #fbfaf8` / `BG_DARK #15181b` in `tools/gen_scale_page.py` and `tests/test_scale_pages.py` would become #F6F4ED / #0F0E0B. The accents must be regenerated. `test_handpan_101_page.py` asserts that #fbfaf8 is absent (unaffected).
- The 64px lockup row (was a 44px h1 row) adds 20px to the header. `tests/e2e.test.js` `CHROME_BUDGET` ("the header and footer stay inside their pixel budget") will fail, and the card loses about 20px on phones. Alternative: put the lockup at 44px, which breaks the 64px brand minimum.
- No font-size or letter-spacing changes.

## Effort and reversibility

M. The app is CSS-token swaps plus a header band. Scale pages need generator changes (grounds, accents, the stage plate, and the 16 regenerated pages plus their fixtures). Fully reversible: colour constants and one new rule block, with no markup change except the lockup.

## Weaknesses

- Purple still fails (2.79). The goal is unreachable with locked palettes, and D says so rather than hiding it.
- The flat near-black stage is starker than today's warm room. It loses the radial glow that gave the app depth, and it can read as "OLED black" rather than "warm".
- Two zones mean two dark tones about 1.2:1 apart. The band edge depends on the hairline, so on poor screens it reads as a single field.
- The light scale page with a black plate is a strong contrast jump. It is deliberate (measured), but it is the most visible stylistic choice here and may feel heavy beside the text.
- Some settings controls (PDF, letter, language) are matched by a broad `#settings-panel button` selector, which is rough.
- The about-header strip keeps #1a1815 (it is 1 step off `surface`, invisible in practice).

Files: `app.css`, `pages.css`, `search.py`, `ok.py`, `search-output.txt`, `extra.js` (stage close-ups `shots/stage-*`), `measure-{stage,chrome,pagedark,pagelight}.json`, `shots/`.
