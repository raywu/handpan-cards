# Direction B: brand board, faithful

**Idea.** I built the owner's board and phone mock as closely as CSS allows. The ground is near-black `#0F0E0B`, with one very faint lift behind the header (`#15130F` at the top, fading to `#0F0E0B` by 55%). Every control is a `surface` `#1A1814` box with a 1px `hairline` `#3A352D` border and no shadow. The link button, menu button, arrows and reroll are `radius-md` (12px) squares. The scale chips are pills, and the active chip has a plain 1.5px border in its root colour (I dropped the two-colour border-image and the glow). The `horizontal-full` lockup sits at 64px in the h1 row between the link button and the menu button, as in the mock. The h1 text stays in the DOM, set transparent at 0px, with the lockup as its background image. Body text is `#F6F4ED` and secondary text is `#A9A39A`. Teal `#44E0D8` appears only as the focus ring and the active sheet-tab underline. Gold `#F5C78E` appears only as the link underline in About and on handpan-101. The progression underline stays in the root colour, as in the mock. The scale pages and handpan-101 use the same tokens: board dark on dark pages, the board's light theme (`#F6F4ED` ground, `horizontal-mono-light` lockup, never the glow on light) on light pages. Each scale page keeps a per-scale root accent, recomputed for the new grounds.

Files: `app.css`, `pages.css` (= `pages-base.css` + generated `accents.css`; `accents.py` regenerates it; table in `accents.md`), `shots/`, `measure-*.json`.

## What changes

| Area | Today | B |
|---|---|---|
| Ground | `#1a1815` + radial `#26221c` | `#0F0E0B`, faint radial `#15130F` near the top only (`--table`/`--table2` both `#0F0E0B`) |
| Header | Marcellus "Handpan Chords" text | `horizontal-full.svg` lockup, 64px tall, centred in the 44/1fr/44 grid; h1 text kept for SEO |
| Icon buttons | 8px radius, `#211d16`/`#433b2c` | 12px radius-md, `surface` + 1px `hairline`, `text-primary` icon (link stroke 2.4 → 2) |
| Chips | `#272219`, no border, 11px; active has a two-colour border-image and a glow shadow | `surface` + 1px hairline pill, 12px/.12em label in `text-secondary`; active has a 1.5px root-colour border, `text-primary`, no shadow |
| Buttons (.mode) | `#211d16`, cream `.on` | `surface`/hairline; `.on` filled `text-primary` (neutral, never an accent) |
| Footer | 10px radius nav | 12px radius-md nav/reroll; count and shuffle in `text-secondary` |
| Focus | 2px `#e3b25c` | 2px teal `#44E0D8` |
| Sheets | `#1f1b15` | settings takeover and scale sheet on `surface`, inputs on `background`; active tab underline teal; desktop sidebar on `background` with a hairline edge |
| About | `#1a1815`, gold `#e3b25c` h3 and links | `background`, h3 in `text-primary`, links `text-primary` with a gold underline, hairline under the sticky head, BACK on one line |
| Scale pages | `#fbfaf8` / `#15181b`, root accent; CTA filled in the accent | `#F6F4ED` / `#0F0E0B`, lockup bar above the breadcrumb (mono-light on light, full on dark), accent recomputed (table below); CTA filled `text-primary`, ghost CTA `surface` + hairline; arrows radius-md |
| handpan-101 | `#1a1815`, gold h2 and links | dark board tokens, lockup bar, h2 `text-primary`, links `text-primary` + gold underline |

## Palette numbers (worst first; 10 palettes)

| Ground | Frames < 3:1 | Worst frame | Worst chip mark (on `#1A1814`) | Card vs ground |
|---|---|---|---|---|
| Baseline `#1a1815` (chip `#272219`) | 1, 6, 9 | purple 2.46 | 2.19 | — |
| **B `#0F0E0B`** (chip `#1A1814`) | **1, 9** | **purple `#6D40A3` 2.68**; crimson `#B3263A` 2.99 | purple 2.46 | 19.3 |
| B gradient top `#15130F` | 1, 9 | purple 2.57 | 2.46 | 18.55 |
| B light pages `#F6F4ED` (chip `#ECE8DE`) | 3, 4, 5 | amber `#DD8F00` 2.38 | 2.14 | **1.10** (white card nearly vanishes; only the frame and shadow separate it) |

On dark, B is better than the baseline: Kurd blue goes from 2.9 to 3.21, and purple from 2.46 to 2.68. Two frames still fall below 3:1. CVD minimum pair distance (ΔE76; this does not depend on the ground): protan 14.6 (0,2), deutan **3.3 (7,9)**, tritan 10.6. The deutan pair is Amara 10 and its swapped twin, and the ground cannot fix it.

**Scale-page accents** (`gen_scale_page._shift`, same algorithm, new grounds; ≥4.5:1 each):

| Root | Light on `#F6F4ED` | Dark on `#0F0E0B` |
|---|---|---|
| Hijaz `#E0559A` | `#CF267A` 4.53 | `#E0559A` 5.46 |
| Mystic `#E2761B` | `#A95814` 4.66 | `#E2761B` 6.29 |
| Amara 10 / Aegean `#3B7A2A` | `#3B7A2A` 4.77 | `#448C30` 4.63 |
| Amara 9 / E Amara 20 `#0B7B75` | `#0B7B75` 4.65 | `#0D8C86` 4.70 |
| Integral `#C9971E` | `#8A6715` 4.73 | `#C9971E` 7.29 |
| Kurd 10/9, Sabye `#2563B0` | `#2563B0` 5.47 | `#357CD4` 4.58 |
| Equinox `#B3263A` | `#B3263A` 5.86 | `#D8465B` 4.55 |
| Pygmy 18/9 `#6D40A3` | `#6D40A3` 6.55 | `#9269C4` 4.63 |
| Magic Voyage `#C0452C` | `#C0452C` 4.62 | `#D15238` 4.57 |
| Akebono `#DD8F00` | `#996300` 4.61 | `#DD8F00` 7.36 |

(Today d-kurd-10's dark accent is a hand-set `#7fb0ee`. B replaces it with the computed `#357CD4`.) In the real generator this is two constants, `BG_LIGHT`/`BG_DARK`, and the CSS selectors in `accents.css` go away.

## Pinned values that would move

- **Chrome budget (the biggest one).** The 64px lockup row adds 20px to the header (96 → 116). Portrait chrome goes from 225.67 to 245.67 at every row of `CHROME_BUDGET` in `tests/e2e.test.js`, which fails. The card shrinks at 375x667 (306.81 → 305.09) and at 320x568 (247.89 → 233.41). At 390x844 it is unchanged. Landscape is unchanged (h1 hidden). Fallback: a 48–52px lockup on short viewports, which is below the board's 64px minimum.
- **Chip label 11 → 12px.** The strip's scrollWidth goes from 659 to 734 at 390px and from 714 to 726 in landscape. Check the landscape "every control stays tappable" and strip tests.
- `--table #1a1815` / theme-color: `tests/app.test.js` ("theme-color ... matching --table", literal `#1a1815`), `tests/e2e.test.js` page-background `TABLE=[26,24,21]`, `tests/test_handpan_101_page.py` (theme-color, `--r:#e3b25c`, `.open` colour `#1a1815`, contrast set), `tests/test_scale_pages.py` (`BROWN`, `SHARED_ROOT`, About `background:#1a1815`, About h3/link `#e3b25c` regexes).
- Focus ring `#e3b25c` → teal: `tests/e2e.test.js` "DR1 line 38 ... 2px #e3b25c focus ring".
- The scale-page `BG_LIGHT`/`BG_DARK` move to `#F6F4ED`/`#0F0E0B`, which regenerates every `scales/*/index.html` and the accent assertions in `tests/test_scale_pages.py`. The rail-colour contrast test (`e2e` "rail current-chord colour ... on #1a1815") changes its ground.
- I left the warn amber `#e3b25c` (sheet `.warn`, pinned by N-A9) alone. It is a status colour, and gold is "never body text".
- i18n: none (no visible text changes; the lockup replaces the h1 visually, and the text stays).

**Effort:** M. It is one CSS pass over about 40 rules plus the generator constants, but the test re-pinning is broad. **Reversibility:** high. Every change is a colour or radius token except the lockup row height.

## Honest weaknesses

- Near-black flatters the bright palettes but does little for the dark ones. Purple (2.68) and crimson (2.99) frames are still below 3:1, and the purple chip dot is 2.46 on `surface`. Only a lighter ground (direction D) fixes that.
- The 64px lockup costs card height on small phones. Its tagline renders at about 5px at that size and is decorative rather than legible.
- On the light scale pages, the white card on `#F6F4ED` is 1.10:1, so the coloured frame does all the separation work, and amber/orange frames are about 2.4:1 there. That is worse than today's `#fbfaf8`, which is nearly the same problem.
- The settings takeover on `surface` with `background`-coloured buttons inverts the usual layering. It reads fine, but it is a judgement call.
- The scale-page accents come from `:has(link[rel=canonical])` selectors. That is a mock-only trick: a real change sets them in the generator.
- The desktop header has the lockup centred with an empty 44px slot on the right (menu hidden at ≥1024px), the same as today's title.
