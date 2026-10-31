# Card match: scale-page cards vs the app's

Measured 2026-10-31 on `dev`. Card 1 of each page's progression, the same
card rendered in both places at the same width (322 CSS px, 2x, reduced
motion): scale page at a 390px viewport (card `min(322px,100%)`), app at a
366px viewport (card 322 x 444.8, exactly 63:87). Scales: the five built-ins
plus `d-sabye-9` (engine-made), light and dark schemes. Extra cards: Dsus4
and C#sus4 (superscripts), Pygmy Bbm (bottom-note badge). Results agree on
every scale and scheme. Evidence:
`docs/brand/reference/look/card-match-d-amara-10.webp`.

## Correction to the prompt's starting table

The prompt compared the page with the app's flash-card mode (mode A). The
scale pages copy the app's **progression mode (mode S)**: owner decision D2
in `docs/plans/2026-10-29-scale-page-app-ux.md`. Against mode S, two listed
differences are not differences:

- **Face order matches.** Mode S also shows the diagram first and the name
  on the flip.
- **No reveal hint matches.** Mode S has none either; the page's hint was
  removed in 27069af / 4fe4a0a and a test asserts there is no `.hint`.

## Differences (page vs app mode S, same width)

| # | Aspect | App (mode S) | Scale page | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Face shown first | diagram; name on the flip | same | same | D2; `test_the_answer_face_is_the_default_and_the_name_face_the_flip` |
| 2 | Size, aspect | 322 x 444.8, fixed 63:87 | 322 x 400.1, height follows content; 415.1 with a badge, so cards in one progression differ in height | drift | plan goal "the same card anatomy"; D6 copied radius, shadow, frame, flip timing but not the aspect; height from the pre-flip card d5d6c12 |
| 3 | Frame | `::before` ring, 3.2px | `border:3.2px`, Chrome draws 3px | drift (tiny) | `test_the_card_css_copies_the_apps_values` checks the string |
| 4 | Corner radius | 12px | 12px | same | D6 |
| 5 | Shadow | `0 12px 34px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.4)` | same | same on purpose (D6); reads as a heavy grey halo on the light page, never checked because the app has no light scheme | D6 |
| 6 | Diagram-face header | inset 11 / 13px; scale name, #n, degree, subtitle | same items and type; inset 15 / 16px | drift (spacing) | d5d6c12 |
| 7 | Diagram size | 310 x 351 | 288 x 288, about 7% smaller | drift | same cause as 2 |
| 8 | Diagram drawing | `pan()` | the app's `pan()` via `tools/sandbox.js` | same | generator docstring |
| 9 | Note and number lines | Bitter, `clamp(12px,4.4vw,19px)` / `clamp(12px,4.2vw,18px)`, at the card foot | Bitter, fixed 19 / 18px, under the diagram | drift | the page froze the app's desktop maximum |
| 10 | Bottom-note badge | 9px `#E27005` | identical | same | `BADGE_CSS` |
| 11 | Name-face header | scale name, #n, degree, subtitle | degree only | drift | the pre-D2 page-only front (6963305) rotated to the back (27069af); the plan listed it as a difference to remove |
| 12 | Chord name | Marcellus, scales with the card (69.5px here), `#545454`, line-height .95 | Marcellus 44px, root colour, line-height 1.1 | drift | same origin as 11 |
| 13 | Superscript | `sup{font-size:.5em; vertical-align:.55em}` | browser default (83%); "Dsus4" reads nearly full size | drift | no `.fname sup` rule |
| 14 | Reveal hint | none in mode S | none | same | 4fe4a0a |
| 15 | Flip motion | 0.45s, perspective 1400px, none under reduced motion | same | same | D6 |
| 16 | Flip control, keyboard | focusable button "Flip card"; click, Enter, Space flip | invisible checkbox; click and Space flip, **Enter does nothing** | checkbox deliberate (no-JS flip); Enter is drift | plan non-goals; D7 |
| 17 | Focus ring | 2px `#e3b25c` | 3px root colour, 3px offset | close enough | FT test needs only a visible ring |
| 18 | Screen reader, diagram face | "Flip card", chord name not spoken | "Flip card: Dm, not checked", header, image "Dm chord card: D4 F4 A4" | deliberate (a reference page names its chords) | 150d59d |
| 19 | Screen reader, name face | "D AMARA 10 #1 i D MINOR Dm" | "Flip card: Dm, checked", "i Dm" | header part drift (follows 11) | |
| 20 | Hidden face | `aria-hidden` | `aria-hidden` set by script; both read with scripts off | deliberate (no-JS) | 221c148 |
| 21 | Counter | screen-reader only | visible "1 / 3", `role=status` | deliberate | D4, D4a |
| 22 | Progression line | 20px Marcellus in the footer | 20px Marcellus under the card, accent underline | deliberate | owner addition A1 |
| 23 | Swipe, step, wrap | `HPE.swipe` | same code | same | D1, D3 |
| 24 | Page background | app brown | light or dark per scheme | deliberate | page theme |

## Recommendation: drift fixes, not shared markup

Reusing the app's card CSS does not give a match: it sizes type in `vw` and
lays the faces out inside a viewport-sized `.scene`. Instead, six fixes in
`tools/gen_scale_page.py`, page-only, no `index.html` or engine change:

1. Aspect: `:host{container-type:inline-size}`, `.inner{aspect-ratio:63/87}`,
   the diagram fills, the lines sit at the foot (rows 2, 7).
2. Header inset 11 / 13px (row 6).
3. Lines in container units: `clamp(12px,5cqw,19px)` and
   `clamp(12px,4.773cqw,18px)` (row 9).
4. Name face = the app's mode-S name face: full header, `#545454`,
   line-height .95, size computed per name in container units, the app's
   `sup` rule (rows 11-13, 19).
5. Optional: the 3.2px `::before` frame (row 3).
6. Enter flips (row 16), about 40 bytes.

Owner's call, both away from "identical": a lighter shadow in the light
scheme only, and the accent focus ring.

Keep as is: face order, no hint, the chord-naming aria labels, the checkbox
and radios, both faces readable with scripts off, the counter, the rail,
the page backgrounds.

Lower-churn option: fixes 4 and 6 only (about 0.6 KB), leaving the height.

### Cost

- About one lane, page-only.
- Bytes bind: `scales/e-amara-20/index.html` is 61654 B against a cap of
  62688 B, about 1 KB left. Fix 4 adds 150-200 B per card, three cards per
  page. Measure before committing; raising the cap needs the owner.
- Fix 1 makes the card about 45px taller, so `scroll-margin-top` in
  `CSS_EXTRA` (set from a measured 301px card, f9bb3d1) must be re-measured.
- Tests that move: in `tests/test_scale_pages.py` the front-face regex,
  the border regex (if fix 5), `test_the_card_css_copies_the_apps_values`
  (extend it), `test_js_off_markup_is_unchanged` (needs a named owner
  exception and a refreshed `scale_pages_pre_swipe` fixture), byte-identical
  regeneration, the 60 KB budget, the swipe budget (fix 6). FT block in
  `tests/e2e.test.js` plus a new "Enter flips" case. Page-byte mutants need
  re-anchoring. `tests/fixtures/scale_pages_v1.json` does not change.
