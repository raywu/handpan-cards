# SEO long-tail plan (research only)

Date: 2026-10-27. Branch `claude/seo-long-tail`. Status: DRAFT, not eng-reviewed. Nothing here is built; no page, sitemap, robots or app change ships from this document.

## Goal and non-goals

Goal: decide which long-tail queries a chord-card site can plausibly win, what content form serves each, and how to ship it without breaking the single-file rule.

Non-goals: editing `index.html`, `sitemap.xml`, `robots.txt`, deck data or geometry; Search Console or GA4 changes; requesting indexing; link schemes; any new external script.

Owner facts (do not re-ask): `raywu.org` is a verified Search Console Domain property covering `handpan.raywu.org`; the GA4 `ui_lang` dimension is registered.

## Evidence limits

- Web search was run 2026-10-27 (US index, no location tuning). It returns result lists, not rankings, volumes or word counts. Every row below is UNVERIFIED on volume and difficulty; competitor claims are VERIFIED only as "this page exists and offers X".
- The owner's own data (about one week of Search Console and GA4, per `~/Projects/seo-kit/prompt.md`) is not in this lane. Phase 0 reads it before any page is built. One week cannot show seasonality, stable position or per-query CTR.
- Google's fragment guidance: the old ajax-crawling URL now redirects to the JavaScript SEO basics page (https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), which says to use the History API rather than URL fragments for distinct pages. The page itself was not re-fetched in this lane (redirect observed via search results), so Phase 0 re-confirms the wording; the Search Engine Land report is corroboration only.

## What competitors offer (the gap)

All of these are commercial or generic; none found is a free, per-scale, printable-and-interactive chord chart.

| Competitor | What it offers | Source |
|---|---|---|
| Handpan Temple | Free D Kurd chord chart download (beginner, note map, inversions) | https://www.skool.com/the-handpan-temple-3021 |
| Master the Handpan | Paid course, lesson on basic D Kurd chords | https://www.masterthehandpan.com/masterclass/the-handpan-cookbook |
| Sven Kirchhofer card decks | Paid (about 16 to 25 EUR) chord card sets per scale: D Kurd 13 (24 cards), D Amara 10 (17), D Aegean 18, F# Nordlys 17 | https://www.digistore24.com/product/578022 |
| Handpan Chordbook | Chords mapped to standard scales (natural minor, Dorian, major, harmonic minor) plus fill-in cards | https://handpanchordbook.com/cards |
| Open Hijaz playing cards | 22-card Hijaz deck for sale | https://www.thegamecrafter.com/games/open-hijaz-handpan-playing-cards |
| Instruments du Monde | How-to-play blog; Hijaz product page | https://instruments-du-monde.com/en/blogs/handpan/how-to-play-handpan |
| Udemy beginner course | Paid, chords as notes struck together, recorded in D Kurd | https://www.udemy.com/course/handpan-beginners-course/ (curl 403, possibly bot-blocked; unverified) |

Reading: the results for chord queries are dominated by paid products and maker shop pages. A free page listing the exact chords per scale, with a diagram, is rare. Our edge: 49 chords on D Kurd 10 and 29 on D Amara 10 (CLAUDE.md), engine-ranked, free, with a PDF.

## Candidate queries

Intent: I = informational, T = transactional. Volume is UNVERIFIED for all; Phase 0 ranks them by Search Console impressions.

| # | Query | Intent | Evidence it is wanted and who answers it | Our form |
|---|---|---|---|---|
| 1 | "D Kurd handpan chords" | I | Handpan Temple free chart, Master the Handpan lesson, paid cards: https://www.skool.com/the-handpan-temple-3021 | Per-scale page `/scales/d-kurd-10/` |
| 2 | "D Kurd handpan chord chart" | I | Same set. ASSUMPTION: no free neutral chart with finger positions exists; the search surfaced none, and the cited paid product page (https://www.digistore24.com/product/554153) shows only what is sold, not what is absent | Same page; chart table plus link to the app |
| 3 | "handpan chord chart" | I | Generic; Handpan Chordbook and card sellers answer it: https://handpanchordbook.com/cards | Hub page `/chords/` linking all five scales |
| 4 | "D Amara handpan chords" | I | Retailer listings and a paid card set (16 chords on the 9-note): https://www.digistore24.com/product/581392 | Per-scale page `/scales/d-amara-10/` |
| 5 | "D Amara 9 notes chords" (and D Celtic Minor alias) | I | Thomann lists the scale, no chords: https://www.thomann.co.uk/sela_harmony_handpan_d_amara_341.htm (curl 404/403, possibly bot-blocked; SEL listing unverified) | Per-scale page `/scales/d-amara-9/` |
| 6 | "C# Hijaz handpan chords" | I | Layout pages and a card deck, no chord chart: https://instruments-du-monde.com/en/products/handpan-hijaz | Per-scale page `/scales/c-sharp-hijaz-9/` |
| 7 | "F low pygmy handpan chords" / "F pygmy 18 chords" | I | Aya Sain's F# pygmy listing (19 notes, DISCONTINUED, not our 18-note F3 Low Pygmy) mentions bottom-note chord combinations, no chart: https://shop.ayasainstruments.com/product/Fispygmy19; no F Low Pygmy 18 listing found, so demand is an ASSUMPTION | Per-scale page `/scales/f-low-pygmy-18/`, with the bottom-note badge explained |
| 8 | "how to play chords on handpan" | I | Course sellers and one blog; no authoritative free guide: https://instruments-du-monde.com/en/blogs/handpan/how-to-play-handpan | Article `/guides/how-to-play-chords/` |
| 9 | "handpan chord flashcards" / "printable handpan chord cards" | T/I | Sold on Digistore24 and soundjourneystore: https://soundjourneystore.com/blogs/tongue-drums-hand-pans/hand-pan-flash-cards | Hub copy plus PDF call to action; our differentiator |
| 10 | "handpan chords for custom scale" | I | Already position 1 per owner (seo-kit prompt); defend, do not rebuild | Keep the app; one internal link from the hub |
| 11 | "D Kurd handpan notes layout" / "Hijaz handpan scale notes" | I | Retailer pages list notes: https://www.thomann.co.uk/patera_hpdm_12_d_kurd_es_compact.htm (curl 404/403, possibly bot-blocked) | Notes and layout section on each scale page |
| 12 | "handpan scales" | I | Broad; maker catalogues dominate | Hub only; not a primary target |

Priority: 1, 2, 4, 6, then 7 only if Phase 0 shows impressions (per-scale, little free competition), then 3, 8, 9. Queries 5, 11, 12 are secondary phrases for the same pages. Drop a candidate whose page has zero impressions for two straight weeks after indexing.

## Content form

Decision: static per-scale pages, plus one hub and (optionally) one guide. Not one long article.

Why: fragment routes (`#deck=`, `#s=`) are not crawled as separate URLs (Google JS SEO basics, which replaced the ajax-crawling page and says to use the History API, not fragments: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics; corroboration: https://searchengineland.com/the-right-way-to-apply-javascript-to-your-links-for-seo-333888). Each scale needs its own path to rank for its own query. The app stays one URL for practice.

Each per-scale page, generated from `data/decks.json`:
- `<title>` and `<h1>` naming the scale and the query ("D Kurd 10 handpan chords"); visible text says "scale", never "deck".
- Crawlable table of every chord: name, note line, number line, bottom-note badge, as plain HTML text (49, 29, 27, 19 and 53 chords).
- Layout shown as a plain note list (name and number per field) in the first release. A static SVG of the layout is deferred to the optional Phase P6 (below).
- Links: "Practice these as cards" to `/#deck=<slug>` (existing route), PDF note, hub and sibling scales.
- English only; hreflang deferred (D3).
- Structured data: reuse the existing WebSite graph; per-page `BreadcrumbList` only. No `Review`, `Rating` or `HowTo` markup.

Thin-content risk: a table of generated chords alone could read as doorway pages. Mitigation: each page carries unique prose written once per scale (what the scale is, which chords need bottom notes, three practice progressions). If pages are indexed as "Crawled - currently not indexed", stop and consolidate into the hub.

## Fit with the single-file constraint

CLAUDE.md "Hard constraints": `index.html` is the single self-contained shipped artifact; PWA manifest and service worker are acceptable as sibling files, and additions must keep `index.html` independently functional. Sibling static HTML pages leave `index.html` untouched, so the app constraint holds, but they extend the sibling-file allowance, so this is OWNER DECISION D1.

Constraints that bind the pages: no external script (gtag stays in `index.html`; D2); fonts by system fallback or the app's existing Google Fonts link; pages generated by a sync-style tool (`tools/sync_seo_pages.py` with `--check`, like `sync_decks.py`) so deck data is never hand-copied and `tools/validate.py` fails on drift.

## Sitemap and robots

- `robots.txt` already allows all and names the sitemap. No change needed; do not block `/scales/`.
- `sitemap.xml` lists only `/`, no `lastmod` (tests `test_sitemap_lists_exactly_the_site_root` and `test_no_lastmod_and_nojekyll_is_empty`). Phase P2 changes those tests in the same PR: exactly the root, hub, five scale pages (and the guide if D4 is yes), absolute clean URLs, still no `lastmod`.
- The `_headers` noindex is for DEV; confirm the new pages are not noindexed on prod.
- Never submit or request indexing from this plan; the owner decides after DEV review.

## Risks

1. Thin or duplicate pages. Mitigation: unique prose; consolidate on poor indexing.
2. Hijaz (19) and Pygmy (53) tables are long; keep a plain `<table>` and a jump list.
3. Cannibalizing the app's #1 long-tail ranking ("handpan chords for custom scale"). Per-scale pages target different queries; watch that query weekly.
4. Tests assume a one-URL site: `test_site_files.py`, the provenance guard and DS1 ("no served text says deck") must be extended to the new pages.
5. Chord correctness: generation from `data/decks.json` means pages cannot disagree with the cards.
6. Low volume: long-tail by design; one week of data cannot size it. Time to index is UNVERIFIED.
7. Naming: the repo's F3 Low Pygmy 18 matches no maker listing found; the nearest, Aya Sain's F# pygmy, is 19-note and discontinued, so query 7 demand is an assumption (rank it by Search Console in Phase 0, and drop it from the priority list if impressions are nil). Describe the scale by notes, not a maker term.

## Owner decisions

- D1: allow sibling static pages under `/scales/`, `/chords/`, `/guides/`. Recommended: yes.
- D2: gtag on sibling pages? Recommended: no; use Search Console alone first.
- D3: hreflang and translated pages. Recommended: defer until the i18n lanes ship.
- D4: the guide article. Recommended: after the scale pages show impressions.

## Lanes

Serial. Each lane is based on the previous lane's head; main PRs per repo rules.

### Phase 0: data and confirmation (owner-assisted; no app change, it appends to this plan only)
Steps: export Search Console queries (28 days, positions 1-3 vs 4-30) and GA4 landing pages; rank candidates 1-12 by impressions; fetch current Google Search Central docs on JS SEO, sitemaps and fragments.
Acceptance: a section headed exactly `## Appendix: Search Console impressions` is appended to this plan, holding an impressions table per candidate and at least three cited developers.google.com/search URLs. That heading must exist.
Verify: `sed -n '/^## Appendix: Search Console impressions/,$p' docs/plans/2026-10-27-seo-long-tail.md | grep -c 'developers.google.com/search'` prints at least 3 (it prints 0 while the heading is absent, so the check cannot pass on this lane's own text).

### Lane P1: generator and tests (owns `tools/sync_seo_pages.py`, `tests/test_seo_pages.py`, `tools/validate.py`, the generated `scales/*/index.html` and `chords/index.html`, and the `tests/suite_health.py` FLOORS row for `tests/test_seo_pages.py` (a new row) plus the raised `tests/test_site_files.py` row; the sitemap and its two tests are handed to P2, see below)
Steps: 1) tests first: every chord in `data/decks.json` appears in its page; one `<h1>`; canonical link; no `<script src>`; no "deck" in visible text; `--check` fails on drift; a prose test (stub until P2 supplies copy): count words outside `<table>` per page, at least 300; and pairwise Jaccard similarity of word 5-grams of the prose between any two pages below 0.3. 2) implement the generator and template. 3) wire `tools/validate.py` to run `--check`.
Acceptance: generated files equal generator output; `index.html` byte-identical.
Verify: `python3 tools/sync_seo_pages.py --check && python3 -m unittest tests.test_seo_pages tests.test_site_files tests.test_suite_health && git diff --quiet $(git merge-base HEAD origin/dev) -- index.html`

### Lane P2: copy, hub and sitemap (owns scale prose sources, hub page, `sitemap.xml`, and the sitemap tests in `tests/test_site_files.py` (`test_sitemap_lists_exactly_the_site_root`, `test_no_lastmod_and_nojekyll_is_empty`), handed over from P1; re-runs the generator so `scales/*/index.html` carry the prose; raises the `tests/suite_health.py` FLOORS rows it changes)
Steps: unique prose per scale; hub `/chords/`; sitemap and its two tests updated in one commit; internal links to `/#deck=<slug>`.
Acceptance: sitemap lists exactly the intended URLs; every page renders its table without JS; each page has at least 300 words of prose outside `<table>` (INFERRED threshold, adjust in review) and every page pair has word-5-gram Jaccard below 0.3 (INFERRED cap), both enforced by `tests/test_seo_pages.py`.
Verify: `python3 -m unittest tests.test_seo_pages tests.test_site_files tests.test_suite_health && python3 tools/validate.py`, then on DEV `curl -s https://handpan-cards-dev.pages.dev/scales/d-kurd-10/ | grep -c '<table'` is at least 1.

### Lane P3: DEV check and measurement (no repo change; owner gate)
Steps: owner reviews on https://handpan-cards-dev.pages.dev/; after release, read Search Console weekly for 8 weeks.
Acceptance: readouts at weeks 4 and 8: indexed yes/no per page, impressions, clicks, and whether query 10 lost position.
Verify: the Search Console page report lists the new URLs as indexed (owner reads it; not machine-checkable).

### Lane P4: guide article (only if D4 = yes; owns `guides/how-to-play-chords/index.html`)
Acceptance: at least 800 words, links to all five scale pages, sitemap updated (P4 owns the `sitemap.xml` and sitemap-test hand-off for the guide URL, and the FLOORS row).
Verify: `python3 -m unittest tests.test_site_files tests.test_seo_pages && python3 -c "import re,sys;t=open('guides/how-to-play-chords/index.html').read();b=re.sub(r'<(script|style)[^>]*>.*?</\\1>','',t,flags=re.S);w=len(re.sub(r'<[^>]+>',' ',b).split());l=len(set(re.findall(r'href=\"[^\"]*/scales/[a-z0-9-]+/',t)));print(w,l);sys.exit(0 if w>=800 and l>=5 else 1)"`

### Lane P6: static layout SVG (optional, only after P3 shows indexing; owns the SVG template in `tools/sync_seo_pages.py`)
Risk to settle first: the label-rule single-copy test (`tests/test_render_agreement.py` `test_each_label_rule_number_is_written_once_per_language`) fails on a second copy of a label-rule constant, so the SVG must call the engine's `labelSize`/`numSize` path or take sizes from `HPE.core.LABEL_RULE`, never re-spell the ratios. A third renderer also widens the app/print agreement surface.
Acceptance: SVG field centres equal the fixture centres to 0.5 pt; the single-copy test stays green.
Verify: `python3 -m unittest tests.test_render_agreement tests.test_seo_pages`

### Lane P5: docs (owns `CLAUDE.md` "Discoverability" section)
Every sentence cites a test name (repo rule). Adds the sentences for sibling pages, the sitemap URLs and the prose test.
Verify: `python3 -m unittest tests.test_site_files tests.test_seo_pages`, then `for t in test_seo_pages test_site_files; do grep -c "$t" CLAUDE.md; done` prints two nonzero counts, then `grep -n 'sync_seo_pages' CLAUDE.md` finds the generator sentence; the reviewer checks each sentence against its test.

## TDD notes

Tests precede generator code in P1 and sitemap changes in P2. CI at the pushed SHA is the evidence.

## Standing gates

Independent reviewer before merge; merges go to `dev` first; no `main` merge without the owner's word. No deploys from any lane.
