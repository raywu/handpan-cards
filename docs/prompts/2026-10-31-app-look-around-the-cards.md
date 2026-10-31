# Prompt: explore the Handpan Theory look around the chord cards

Paste everything below the line into a fresh Claude Code session on
`raywu/handpan-cards`. It asks for explorations and a plan, not a shipped
change. Companion to `docs/prompts/2026-10-31-handpan-theory-rebrand-plan.md`
(name, logo, domain move); this prompt owns the visual look of the app and
pages around the cards.

---

You are exploring, then planning. Nothing you do in this session ships.

## What the app is

Handpan Theory (today "Handpan Chords") teaches chords and chord
progressions on a handpan. Each chord is a card: a white face with a
coloured four-sided frame, a top-view diagram of the pan with the chord's
notes lit, a note line and a number line, and under the card the progression
it belongs to (`Dm → F → Am → C`). The cards are the product. Everything
else on screen exists to make them easy to read and practise with.

Each card needs a two-colour palette pair: a **root** colour (the root
note's fields, the frame, the root in the note line) and a **tone** colour
(the other chord tones). Bottom-shell notes use one fixed orange,
`#E27005`. The engine ships 10 palettes in `HPE.select.PALETTES`
(`src/engine/select.js`): 5 pairs plus each pair with its two colours
swapped. The 5 built-in scales each use one pair, and the swatch picker
offers all 10. The owner thinks of these as "8 pairs by default"; check the
running app and report what a user actually sees, but treat the engine's
set as fixed either way.

## Fixed: do not touch

1. **Cards and the engine.** No change to anything under `src/engine/`, the
   inlined engine regions, `data/decks.json`, the palettes, card anatomy,
   diagram geometry, the label rule or print output. If an idea needs one,
   write it down as a separate proposal and move on.
2. **Cards stay clean and easy to read.** Nothing new on, over or touching a
   card; no glow, texture or gradient that bleeds into it. Every one of the
   10 palettes must read well on whatever surrounds the card (measures
   below).
3. **No functional or SEO-structure change.** Same features, routes,
   storage, analytics events, gestures; same canonical/og/JSON-LD/sitemap
   structure. `CLAUDE.md` rules all hold (single-file app, generated
   regions, "scale" never "deck" in visible text, every UI change ends with
   the i18n step, dev-first lanes).

## Open: owner decisions (2026-10-31)

Default to keeping what exists; change it where a direction makes a clear case.

- **Background:** explore both today's warm `#1A1815` with its radial
  gradient and the brand board's near-black `#0F0E0B`, plus any third idea.
  Judge them by how the 10 palettes and the white cards read on each.
- **May be restyled:** the header and links (logo lockup, title and
  subtitle, link colours and underlines); controls (scale chips, icon
  buttons, arrows, the progression line); sheets and overlays (settings and
  edit sheet, About, menus); other pages (`handpan-101/`, `404.html`, and
  the scale pages around their cards).
- **Scale pages:** bring them onto the Handpan Theory look and keep each
  page's accent in its scale's root colour where it reads well. The owner
  likes that touch but it is not a must; if a direction drops it, say why.
  Today the accent is lightened or darkened until it has 4.5:1 contrast on
  the page's own grounds, `#fbfaf8` light and `#15181b` dark
  (`accents()` in `tools/gen_scale_page.py`). New grounds mean recomputing
  that.
- **Card match between app and scale pages:** evaluate, then the owner
  decides (next section). No change in this session.

## Evaluate: should scale-page cards match the app's?

They currently differ. The diagram is the same by construction: the
generator runs the app's own `pan()` (`tools/gen_scale_page.py` docstring).
The card around it is not: a first look at D Amara 10 card 1 at 390px wide
showed a smaller card on the scale page and different header and note-line
sizes (`docs/brand/reference/card-app-vs-scale.png`). Do this:

1. Render the same card in both places at the same card width, for each
   built-in scale and at least one scale page made from the engine, light
   and dark scheme on the scale page.
2. List every difference: card size and aspect, frame width and corner
   radius, header (scale name, #n, degree, subtitle), diagram scale,
   note-line and number-line font and size, spacing, reveal behaviour, and
   the progression line under the card.
3. Mark each one deliberate (page layout, crawlable text, no-JS fallback,
   performance) or drift, with evidence from the code or git history.
4. Recommend one of: identical (and how, without touching the engine, for
   example by having the generator reuse the app's card markup and CSS), a
   list of drift fixes, or leave as is. The owner decides.

## Inputs

- Design system: https://claude.ai/artifact/93knqkDWTEUZe8iGLktZYB. Read its
  `project/README.md` and `project/tokens.json`. It holds the brand board,
  logo files and tokens. Its app inventory is incomplete: on `dev` the app
  CSS uses 37 colours, a dozen font sizes, eight letter-spacings and 12 box
  shadows the design system does not record yet. Three conflict with the
  board: app gold `#E3B25C` vs `#F5C78E`, app text `#EAE6DF` vs `#F6F4ED`,
  and app background `#1A1815` vs `#0F0E0B`.
- `docs/brand/logo/` (the measured logo set) and `docs/brand/make_logo.py`.
- `CLAUDE.md` "Design system" and "Hard constraints".
- Check both branches before you trust a fact: `git fetch origin main dev`.
  Explore on `dev`'s tree and say where `main` differs.

## How to work (optimise for speed and range)

1. **Ask only what blocks you,** at most three questions, each with your
   default, then proceed on the defaults.
2. **Use the real app, not drawings of it.** The fastest faithful mock is a
   CSS override: serve the repo (`python3 -m http.server`), load the app and
   a scale page in the preinstalled Playwright, inject a direction's
   stylesheet, and screenshot. Real cards, real layout, nothing committed. A
   direction is then one CSS file plus a note, and the same file can be
   tried on every scale.
3. **Diverge, in parallel.** 3 to 5 directions, one subagent each, all
   with the same inputs and told to differ from one another. At least one
   is conservative (today's look with the new header and logo) and at least
   one is bolder than the brand board. The suggested axes are examples:
   ground colour and gradient, how the chrome recedes or frames the card,
   link style, chip treatment, how the scale's colour enters the page. Find
   others.
4. **Measure every direction the same way.** For each of the 10 palettes,
   on each direction's background:
   - frame colour against the background: at least 3:1 (a meaningful
     graphic edge);
   - chip dots and any root-colour accent against their ground: at least
     3:1 for marks and 4.5:1 for text;
   - the white card's edge against the background;
   - a colour-vision-deficiency simulation of the chip row and the card
     frames (protan, deutan, tritan): the 10 palettes stay distinguishable
     from each other in the picker.
   Report the worst pair per direction, not an average.
   Reuse what exists: `contrast()` in `tools/gen_scale_page.py` already
   computes WCAG contrast, and `docs/brand/redraw/render.js` renders an SVG
   or page to PNG.
5. **Screens:** 380px and 1280px wide, the main card view, an open settings
   sheet, About, and one scale page, for each direction. Timebox each
   direction; rough beats polished.
6. **Converge:** one table per direction with what it changes, its
   worst-palette numbers, risk to pinned tests (which strings or values
   move), effort and reversibility, then your pick with a reason. Stop and
   let the owner choose before writing lane-level detail.

## The plan document

Write `docs/plans/2026-10-31-look-around-the-cards.md`, short:

- The directions, their screenshots (a few under `docs/brand/reference/`)
  and the comparison table.
- The palette readability numbers per direction.
- The card-match evaluation: the difference list, deliberate vs drift, and
  your recommendation.
- An app-to-brand mapping table for every colour, type size,
  letter-spacing, shadow and radius the app uses: keep, change to a token,
  or drop. Mark the three conflicts above for the owner. This becomes the
  next design-system update.
- For the pick, once chosen: lanes (dev-first per `CLAUDE.md`), files
  touched, pinned tests that change and why, i18n steps, and rollback.
- Open questions, each with your default.

## Done for this session

The owner has 3 to 5 directions to look at on real cards, the measured
palette table, the card-match evaluation, the mapping table, and the plan
on a `claude/` branch, pushed, no PR unless asked. Nothing under `src/`,
`index.html`, `data/`, `tools/` or `scales/` has changed.
