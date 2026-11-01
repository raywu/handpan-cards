# Shared brief: Handpan Theory look around the cards (exploration, nothing ships)

Full prompt: /home/user/handpan-cards/docs/prompts/2026-10-31-app-look-around-the-cards.md (read it).
Design system: docs/brand/look/README.md and docs/brand/look/tokens.json.
Brand references: /home/user/handpan-cards/docs/brand/reference/brand-board.webp and app-mock-phone.webp (view them).

## Setup (already running)
- The dev branch is checked out at <dev checkout> and served at http://127.0.0.1:8765/ .
  NEVER edit tracked files in <dev checkout>. The logo SVGs are served from /_look/logo/
  (horizontal-full.svg, horizontal-single.svg, stacked-full.svg, mark-small.svg, mark-full.svg ...).
  You may add files under <dev checkout>/_look/<your-direction>/ only.
- Screens: node docs/brand/look/shoot.js <app.css> <outdir> http://127.0.0.1:8765/ [pages.css]
  injects app.css into the app and pages.css (defaults to app.css) into scale pages, handpan-101.
  Writes main/flipped/settings/about at 380 and 1280, scalepage-{dark,light}-{380,1280},
  handpan101-{380,1280}, and scale-<id>-380 for the five built-ins. Baseline (today): docs/brand/look/base/.
- Measures: python3 docs/brand/look/measure.py NAME BG CHIP_BG  -> JSON (frame contrast per palette, chip
  contrast, card vs bg, colour-blind min pair distance). Run it for each ground colour your
  direction uses (if a gradient, measure its lightest and darkest stop).
  Baseline: on #1a1815 palettes 1,6,9 frames are below 3:1 (worst purple 2.46).

## Fixed
- No change to cards: nothing on, over or touching a card; no glow/gradient bleeding into it;
  card size/anatomy unchanged. Do not restyle .card or anything inside it. The scale-page cards
  are in shadow roots, so page CSS cannot reach them anyway.
- No functional change: hide/restyle only, never remove controls; visible text unchanged except the
  header title may become the Handpan Theory lockup (logo image; keep the h1 text for SEO, e.g.
  visually hidden text + background-image, or ::before).
- Use CSS only (plus background-image SVGs you put under _look/). No JS.

## Deliverable (in docs/brand/look/<your-direction>/)
- app.css, pages.css (if different), shots/ from shoot.js, measure-*.json
- notes.md: 1 paragraph idea; a table "what changes" (ground, header, links, chips, buttons, sheets,
  About, scale pages, handpan-101); worst-palette numbers; which pinned values would move (colours
  like --table #1a1815 / theme-color, font sizes; look at tests/ in devtree with grep for any value
  you change); effort (S/M/L) and reversibility; honest weaknesses.
- Look at your own screenshots (Read the PNGs) and iterate at least once. Timebox ~25 minutes.
  Rough beats polished. Final reply: 5-10 lines summary + path to notes.md.
