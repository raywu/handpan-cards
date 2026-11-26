# Brief: Practice CTA on the /scales index rows

Status: APPROVED, 2026-11-25. Owner approved the outlined Practice link for rows with an existing practice destination, and then requested the same row treatment for the Neotone section.

## Job
Someone lands on `/scales/` from search, sees the list of chord-chart links, and has no direct way to practise a scale. A "Practice" link on each row with a named scale destination opens that scale in the app, so a visit can turn into practice instead of a bounce. The row link to the chord chart stays.

## Keep from main
- Row link text and href unchanged: "<name> handpan chords" to `/scales/<slug>/`, still the primary SEO link (internal link anchor text and crawl path).
- Group headings, blurbs, order (`GROUPS` in `tools/gen_scale_page.py`), hub title, description, canonical, h1, intro, footer line.
- The hub stays static HTML and CSS: no `<script>`, no analytics (`test_the_hub_has_no_swipe_script`).
- Existing hub palette, fonts, 44px row height, focus ring; scale pages' Practice button recipe (`.open`: 14px, 700, letter-spacing .06em, radius 12px).
- Visible text says "scale", never "deck". English only (static pages are English-only; no i18n tables change).

## Controls in
- Six groups contain 18 matching list rows. The 16 existing chart titles and links retain their order. The Neotone section presents the generic chart and F# Serenity with the same list styling and touch targets.
- The 17 outlined Practice links use the visible label “Practice” and unique accessible names of “Practice <scale name>.” They open in the same tab.
- The first five groups use the existing scale detail destinations in `tools/scale_pages.json`. Serenity uses the same generated share link as its detail page. The generic Neotone row has a chart link. Its detail-page Practice action opens the F2 Astronaut example.
- A row with no button: the chart link takes the full row width; no placeholder, no `aria-hidden` spacer. Test: such a row contains exactly one `<a>`.

## Controls out
- No new page, no JS, no analytics script, no modal, no per-row preview, no "add your own" link on the hub, no sort/filter, no change to the app.

## Viewports and numeric targets
- 320, 375, 380, 768 and 1280 CSS px widths with real fonts and fallback.
Testable now (script at each viewport, local static build):
- Bounding box of the row link and of Practice at least 44 x 44 CSS px at 320, 375, 768, 1280 (production rows are `ul.rel a{min-height:44px}` plus a 1px rule = 45px; the mock uses the real hub CSS).
- `document.documentElement.scrollWidth <= innerWidth` at 320.
- Button on one line, at most 120px wide, at least 8px from the chart link. At 320 content is 288px, so the link gets about 186px after the button and 12px gap: long names wrap to 2 lines, assert it, never the button. At 375 the link gets about 241px.
- Row height: 45px for one line, at most two lines for chart names. Record measured wrapping and total list height.
- Unique aria-label per row (WCAG 2.5.3 label-in-name: visible "Practice" is contained in "Practice <name>"); each Practice href equals its scale page's Practice href.
- 768 and 1280: the hub list gets `ul.rel{max-width:640px}` (hub only) so the link-to-button gap stays bounded and buttons do not float about 700px from short labels at 1280; record the measured gap; the button stays right-aligned in the row.
- Contrast: label `#242424` on `#fff` 15.5:1; variant C violet `#6756b5` on page background `#f6f4ed` 5.34:1 (5.87:1 only for white on violet or violet on `#fff`); ghost border `#8a847b` 3.71:1 on `#fff`, 3.37:1 on `#f6f4ed` (non-text bar 3:1); focus ring `#242424` (2px, offset 2px) on `#f6f4ed` 14.1:1.
Owner judgment (not a pass/fail test): whether Practice reads as primary or secondary to the chart link; density feel; hover, active and focus appearance.

## Non-goals
Deck data, layouts, diagram geometry, app UI, zh/ja/de SEO, new dependencies, paid tools, SEO copy changes, hub restructure.

## Approved treatment

Use the neutral 12px outlined style with the violet, underlined chart links as the primary path. The Practice link has a square 44px minimum target, one line of text, and a 2px focus outline with a 2px offset. Retain the Neotone titles and destinations and use the shared row component.
