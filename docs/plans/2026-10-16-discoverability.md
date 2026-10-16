# Discoverability: GA4, SEO, AEO and metadata (2026-10-16)

Consumed by `/swarm`. Section 9 lifts into `docs/plans/discoverability-coordination.md` unchanged. Owner decisions O1-O4 (brief, 2026-10-16) are binding and restated where a lane needs them. Sources are cited as S1..S25 (section 13). Section 14 is the engineering review record; its findings are already applied in sections 4, 5.4, 7, 9 and 10. Everything in sections 3-7 was re-checked against main `be288a7` on 2026-10-16.

## 1. Goal and non-goals

**Goal:** after wave 1 merges, a `curl` of `https://handpan.raywu.org/` returns the O4 title, a 155-character-or-shorter description, a visible value line naming the five built-in decks, one JSON-LD block, `robots.txt` and `sitemap.xml` resolve, and a production boot sends GA4 hits while `file://`, localhost and every CI boot send none (section 11 lists the exact checks).

**Non-goals:** no audio, stats, SM-2 or PWA (ideas not tracked; never listed as work); no deck data or geometry change; no paid tools; no ranking promise; no change to card copy, deck chips, the Resources links or any existing control; no consent banner or new UI (O2); no landing page in this workstream (O3).

## 2. Positioning

One sentence (owner): **a custom-scale chord and progression practice tool.** Verified claims: *free* (static GitHub Pages site, `localStorage` only, no account or payment code in `index.html`); *generate for your own scale* (`generateDeck(text, options, guard)` runs `HPE` on any scale string from the Add-scale sheet); *progressions* (`#panel-prog-heading` "Chord progression" with EASY/MEDIUM/HARD; `setTier()` switches to mode S, where `setOrder()` builds a sequence from the deck's chords through `HPE.sequence.pick` (`src/engine/sequence.js`); nothing stored); *F Low Pygmy* is 53 chord cards, 32 distinct names (`data/decks.json`), so copy says "53 chord cards", never "53 chords". Banned words: chord finder, chord generator, AI, best, ultimate.

| Intent | Queries | Serves now | After the deferred wave |
|---|---|---|---|
| Generic | handpan chords; handpan chord chart; handpan chord flashcards; handpan chord progressions | `/` | `/` |
| Scale | d kurd chords; d kurd handpan chords; d amara chords; celtic minor handpan chords; f low pygmy chords; pygmy handpan chords; hijaz handpan chords | `/` (section 4 names every deck in visible text) | `/d-kurd-10/`, `/d-amara-10/`, `/f-low-pygmy-18/`, `/c-sharp-hijaz-9/` |
| Task | chords for my handpan scale; what chords can I play on my handpan; handpan chord practice; custom scale handpan chords | `/` | `/` |

Resources that rank today (S17-S19): The Handpan Temple (free static D Kurd PDF chord chart, one scale), Master the Handpan (paid video course, chords on D Kurd, F Pygmy, E Amara), Sven Kirchhofer's printed training cards (paid, per scale). None takes an arbitrary scale as input, none runs in the browser, none builds progressions. The copy says exactly that difference and nothing more.

## 3. Metadata spec

| Tag | Current | New (recommended) | Tests and mutants touched |
|---|---|---|---|
| `<title>` | Handpan Chords | **Handpan Chords: Custom Scale Chord and Progression Practice** (O4, 59 chars) | `tests/app.test.js` "the visible name is one string: title, h1, og:title and twitter:title" is REPLACED by "the title is the positioning string; og:title and twitter:title equal it; the h1 is the app name" (asserts `<title>` == O4 string, `og:title` == `<title>`, `twitter:title` == `<title>`, `<h1>` == "Handpan Chords"). `tests/mutants/nm_og_title_drifts.patch` keeps its diff, its `# kills:` and `# suite:` lines name the new test. New mutant `nm_title_shrinks_to_app_name.patch` (title back to "Handpan Chords"). |
| `<h1>` | Handpan Chords | unchanged (O4) | same test |
| `og:title`, `twitter:title` | Handpan Chords | == `<title>` | same test and mutant |
| `description`, `og:description` | "Learn handpan chords and play chord progressions in your scale. Flashcards show each chord lit on your pan: drill it, then connect chords into progressions." (155) | D3: **"Chord flashcards and progressions for your handpan scale, free and without an account. Type any scale to generate its chords, or pick a built-in deck."** (150) | `tests/app.test.js` "the description says progressions early, equals og:description and fits 120..160": upper bound becomes 155 (O4) and a `free` assertion is added; new mutant `nm_description_drops_free.patch`. |
| `twitter:description` | absent | absent, AUTO: X's cards markup table documents `og:description` as the fallback (S10) | none |
| `canonical`, `og:url` | `https://handpan.raywu.org/` | unchanged, trailing slash is the site convention | none |
| `og:image` | `og.png` with "Learn chords. Play progressions. / For your handpan scale." (`OG_LINES` in `tools/make_icons.py`) | OWNER D9: leave, or re-render with the value line | `tests/test_icons.py` `test_the_pngs_are_current_against_the_svg_in_index_html` fails until `python3 tools/make_icons.py` re-renders |
| JSON-LD | none | section 6 | `tests/app.test.js` new "the JSON-LD block parses and states only what the page shows"; sandbox skip (lane W2) |

Description candidates: D1 "Free handpan chord flashcards and chord progressions for your own scale. Type any scale and the tool generates its chords; five built-in decks, no account." (155); D2 "Practice handpan chords and chord progressions for your own scale, free. Five built-in decks (D Kurd, D Amara, F Low Pygmy, C# Hijaz) or type any scale." (152); **D3 recommended**: it leads with the noun a searcher types, says free and no-account in one clause, and keeps "progressions" inside the first 110 characters the existing test demands.

Value line candidates (visible, section 4): V1 "A free chord and progression practice tool for your own handpan scale." (70); V2 "Free chord flashcards and progressions for any handpan scale." (61); V3 "Chords and progressions for your handpan scale, as flashcards. Free." (68). **V1 recommended**: it is the owner's sentence verbatim.

## 4. Crawlable content (home page, no JS)

A `curl` of `/` must contain, as visible text: `<h1>Handpan Chords</h1>` (exists); the value line; a three-step "how it works" (pick a built-in deck or type your scale; flip a card to see the chord lit on the pan; switch to Chord progression for a sequence to play); the five built-in decks by explicit name with card counts from `data/decks.json` (D Kurd 10, 49 chord cards; D Amara 10, 29; D Amara 9, 27; F3 Low Pygmy 18, 53; C# Hijaz 9, 19) and "D Amara is also sold as Celtic Minor" (S16); one sentence "A custom scale lives only in your browser"; one link each to the deck route of section 5.4 when D7 ships.

**Position (AUTO, D10):** a `<section id="about">` AFTER `<footer id="foot">`, before the live region, static markup, no ids the app script reads. **First screen (AUTO, D20; outside voice P1):** `html,body{height:100%}` and `main{flex:1; min-height:0}` mean a fourth flex child of `body` would SHRINK the card, not extend the page. W1 therefore wraps `<header>`, `<main>` and `<footer id="foot">` in `<div id="app">` with `flex:none; height:100%; width:100%; min-height:0; display:flex; flex-direction:column; align-items:center` (`body` keeps every rule it has; `@media print` adds `#app{display:block; height:auto}` and `#about{display:none}`, paper is not the screen), and `#about` (`flex:none; width:100%`) overflows below the first screen. The card keeps its size: the new e2e test pins `.scene`'s `getBoundingClientRect().height` at 380x780, 320x568 and 1024x700 to figures measured on `origin/main` (constants in the test, 1px tolerance, the way the 1024x700 sidebar test records its baseline) and asserts `document.scrollingElement.scrollHeight > innerHeight`. `tests/e2e.test.js` "the card fits a 380px viewport on load, with no horizontal overflow" (scene inside 380x780) and "the full-screen settings panel fits with no scroll in every mode, at 320x568 and every landscape size" are untouched; `tools/probe/panel_fit.js` measures the panel, not the page. Rejected: a value line under the `<h1>` costs vertical space in the 320x568 cell. No `display:none`, no `<noscript>`-only text, no `.sr-only` (S13: markup must match visible content). The section is readable at 380px with no horizontal scroll (new e2e test, lane W1 step 3). Count text is written by hand and pinned by a test against `data/decks.json` (same lane), so a deck change reddens it rather than letting it lie.

## 5. Landing pages (O3: decided and deferred)

**Trigger:** Search Console shows a scale-named query (section 2 table) with impressions over a 4-week window, or the owner promotes one scale. Start with that ONE scale.

**Stand-in experiment (wave 1):** section 4's deck names on `/`. Metric: Search Console, Performance, query filter on each deck name; threshold: any scale-named query with 50 or more impressions over 4 weeks, or a scale-named query in the home page's top 10 queries, fires the trigger for that scale.

**Held design (not spawned here):**

| Slug (fixed, O3) | Title (under 60) | Decks | App link |
|---|---|---|---|
| `/d-kurd-10/` | D Kurd 10 Handpan Chords: 49 Chord Cards and Progressions (57) | kurd | `/#deck=d-kurd-10` |
| `/d-amara-10/` | D Amara 9 and 10 Handpan Chords: Chord Cards and Progressions (61, trim "and Progressions" if the owner wants under 60) | amara10 with amara's 27 shared cards marked, D5 extras marked | `/#deck=d-amara-10` and `/#deck=d-amara-9` |
| `/f-low-pygmy-18/` | F3 Low Pygmy 18 Handpan Chords: 53 Chord Cards and Progressions (63, same trim) | pygmy | `/#deck=f-low-pygmy-18` |
| `/c-sharp-hijaz-9/` | C# Hijaz 9 Handpan Chords: 19 Chord Cards and Progressions (58) | hijaz | `/#deck=c-sharp-hijaz-9` |

Content outline per page: h1 (deck name), the notes line from `fields`, every chord name as text (`main` + `sup`, subtitle), the bottom-note badge text where present, the progressions (edge case 5, D11), one app link, one line "This page shows the deck as shipped; if you have edited it in the app, the app shows your version" (routing point 7, AUTO: say it, one line). Description per page under 155 under the no-interpretation rule, written when the wave starts.

**Sync tool:** `tools/gen_landing.js` (Node, D11), inputs `data/decks.json` and `src/engine/sequence.js` through `tools/engine_loader.js` as `tools/gen_deck.js` does; outputs `<slug>/index.html` per deck and the sitemap entries; `--check` re-renders in memory and diffs; `tools/validate.py` gains check 6 calling it. CSS: the tool copies the block between `/* landing-css begin */` and `/* landing-css end */` markers inside `index.html`'s `<style>` into each page (D12), so `index.html` stays self-contained and `--check` catches drift. Pages carry GA by inlining `GA_MEASUREMENT_ID` and the consent snippet from `index.html` between `<!-- ga begin -->` and `<!-- ga end -->` markers (D13), pinned by the same `--check`. Smoke test per page (edge case 10): no horizontal scroll at 380px, the h1 and the notes heading, every chord name from `data/decks.json`, the app link resolves to its deck through the section 5.4 route.

### 5.4 The deck route (routing points 1-7)

| # | Decision | Choice |
|---|---|---|
| 1 | Form | `#deck=<slug>`, `DECK_ROUTE = "#deck="`, disjoint from `#add`, `#edit-`, `#s=`. `DECK_SLUGS = {"d-kurd-10":"kurd","d-amara-10":"amara10","d-amara-9":"amara","f-low-pygmy-18":"pygmy","c-sharp-hijaz-9":"hijaz"}`. A `custom:` id is never a value; an unknown slug falls back silently like an unknown stored built-in id. |
| 2 | Resolution | `routeDeck()` reads the hash BEFORE `const wantedDeck = deckId` in the go block and, for a known slug, sets `deckId` to the mapped id; the existing lines then resolve it through `deck()`: untouched seed shows the seed; edited seed shows its replacement (what a stored id of a replaced seed shows today); deleted seed falls to `fallbackDeck()` and the existing "That deck is gone." branch fires because `wantedDeck` now holds the routed id and `hidden.includes(wantedDeck)` is its condition. (Outside voice P2: that warning runs before the hash branches, so a route read beside them would come too late to reuse it.) No fourth state. |
| 3 | Persistence | persist like a chip tap: a routed boot calls `save()` after `setMode(mode)` (what `selectDeck(id)` does: `deckId`, `storedDeck`, `save()`), then `track("deck_route", ...)`. Alternative, visit-only: skip `save()`; cost: a visitor from the Kurd page lands on Kurd today and on their old deck tomorrow, which reads as the link breaking. Recommended: persist. |
| 4 | Precedence | the route beats the stored deck, like a share link; `#s=` and `#deck=` cannot coexist, so no order question. |
| 5 | Consumption | the hash is replaced away in the `/* ---------------- go ---------------- */` block by a third `else if (location.hash.indexOf(DECK_ROUTE) === 0)` beside the `ADD_ROUTE` branch, `history.replaceState(null, "", location.pathname + location.search)`; never `pushState`. **In-page links (AUTO, D21; outside voice P1):** an about-section `href="#deck=..."` clicked on `/` changes the hash without a reload, so no boot code runs; the same `routeDeck()` therefore also runs from a `hashchange` listener, which calls `selectDeck()` with the resolved id (the "gone" warning through the same `hidden` test), tracks `deck_route`, and replaces the hash away. `replaceState` fires no `hashchange`; the listener returns at once for `#add`, `#edit-` and `#s=`. |
| 6 | Timing | OWNER D7, recommend SHIP in wave 1 as lane W1 step 6: the owner can post `handpan.raywu.org/#deck=f-low-pygmy-18` today; cost one step, three e2e tests, two mutants. Defer: nothing else needs it until the pages ship; cost: a second `index.html` lane later. |
| 7 | Static page truth | one line on each landing page (above). |

## 6. Structured data

JSON-LD in `<head>`, `<script type="application/ld+json">`, one `WebApplication` (S12 recommends JSON-LD; S13 forbids marking up what the page does not show). Every property below is visible on the page after section 4 ships.

| Property | Value | Visible where |
|---|---|---|
| `@type` | `WebApplication` | the page is an app |
| `name` | Handpan Chords | h1 |
| `url` | `https://handpan.raywu.org/` | canonical |
| `description` | the D3 string | meta description, value line |
| `applicationCategory` | `MusicApplication` (S14 lists it) | h1, about section |
| `operatingSystem` | `Any` | runs in a browser |
| `browserRequirements` | `Requires JavaScript` | the app needs JS |
| `isAccessibleForFree` | `true` | value line "free" |
| `offers` | `{"@type":"Offer","price":"0","priceCurrency":"USD"}` | value line "free" |
| `featureList` | "Chord flashcards; chord progressions; custom scale input; printable PDF" | how-it-works, the Print group |

Omitted on purpose: `aggregateRating` and `review` (never fabricated; S2 requires one for the SoftwareApplication rich result, so **this block earns no rich result** and the plan does not claim one); `FAQPage` (S1: the FAQ rich result stopped showing on 2026-05-07); `HowTo` (not in the gallery, S4). What the block is for: an unambiguous machine statement of name, price and purpose. Evidence on AEO (S4, S5, S20): Google's AI features need no special markup and ask only that markup match visible text; the Ahrefs matched study found no citation lift from adding JSON-LD on ChatGPT or Perplexity; retrieval tests show those systems read visible HTML. So the block is cheap insurance, not the AEO lever; the visible section 4 text is. `llms.txt` (S6, S7): Google Search ignores it and says so; no AI platform requires it; cost is one static file and a self-written claim nobody verifies. AUTO D14: do not ship it.

## 7. Analytics

**Loader (O1, edge cases 1-3):** no static `<script src>`. `index.html` `<head>` carries an inline consent snippet (`window.dataLayer`, `function gtag`, the two `consent default` calls, `gtag('js', new Date())`) that only pushes to an array, so the sandbox executes it harmlessly. App JS defines `const GA_MEASUREMENT_ID = "G-XXXXXXXXXX"` (the placeholder, one named constant) and `function loadAnalytics()`, called once as the FIRST statement of the go block (outside voice P1: `gtag` is a `dataLayer` queue, so `config` is queued before any `track()` call and `deck_route` and a boot-time `share_open` are recorded instead of dropped by `track()`'s guard; `page_location` is passed explicitly, so the loader's position relative to the hash branches changes nothing about privacy), which appends `<script async src="https://www.googletagmanager.com/gtag/js?id=...">` (S9 snippet) and calls `gtag('config', GA_MEASUREMENT_ID, {page_location: location.origin + location.pathname})` ONLY when `analyticsAllowed()` holds. `page_location` is set without the hash so a `#s=` payload (a free-text scale string) never reaches GA. The app never awaits the script; blocked or offline, nothing else changes (test: boot with the GA hosts blocked, every e2e assertion already holds; the zero-request test below is the proof).

**Predicate** `analyticsAllowed()` returns false when any clause holds; each clause has its test:

| Clause | Test |
|---|---|
| `location.protocol === "file:"` | `tests/app.test.js` sandbox boot with `href: "file:///index.html"` |
| hostname in `localhost`, `127.0.0.1`, `[::1]` | `tests/app.test.js` sandbox boot per host; `tests/e2e.test.js` (served at 127.0.0.1) asserts `analyticsAllowed()` is false |
| `navigator.webdriver` | sandbox stub sets `webdriver: true` by default (W2); `tests/app.test.js` boot at `https://example.test` with a real-looking ID and `webdriver: false` shows injection, `true` shows none |
| `GA_MEASUREMENT_ID === "G-XXXXXXXXXX"` | `tests/app.test.js` boot at `https://example.test`, `webdriver: false`, placeholder: no script element appended |

**Consent (O2, edge case 11, S8):** `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'})` first, then `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:[EEA_UK_CH]})` with `EEA_UK_CH = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB","CH"]` (27 EU + IS, LI, NO per S15; GB and CH added by O2). S8: a default without `region` applies to everyone not matched; a more specific region wins; the default commands must precede `config`. Denied `analytics_storage` sends cookieless pings only (S11: timestamp, user agent, referrer, consent state, a per-load random number; no cookies). A test boots the sandbox at `https://example.test` with `webdriver: false` and a real-looking ID and reads `window.dataLayer`: the first two entries are the two `consent default` calls in that order, the second carries the 32-code region list, the three ad signals are denied in both, and `config` follows them (asserting on the queue, not on snippet text).

**Privacy note (O2 asks):** advisable. UK PECR and most EEA regimes treat analytics cookies as consent-gated; with storage denied there, no cookie is set, so a note is transparency rather than a legal gate. OWNER D8: one `.mode` link `PRIVACY` in the Resources group (`#res-privacy`, the `res-*` 64px `panel-fit` allowance covers it) pointing at an anchor `#privacy` inside the about section, versus one sentence at the foot of the about section with no new control (recommended: it adds no panel stop and no `panel-fit` risk).

**Events** (S3: names under 40 chars, letters/digits/underscore, under 25 params; none is a reserved web name such as `page_view`, `scroll`, `click`):

| Event | Trigger anchor | Params | Owner question |
|---|---|---|---|
| `deck_select` | `selectDeck(id)` after `save()` | `deck_kind` seeded or custom; `deck_id` for seeded ids only | which built-in decks are used; how many custom decks exist |
| `deck_route` | the `DECK_ROUTE` branch of the go block (if D7 ships) | `deck_id` | do posted deck links bring visitors |
| `scale_create` | `generateDeck()` ok branch inside the sheet's submit | `note_count` (integer), `has_bottom` (1 or 0; GA4 params are strings and numbers) | is the custom-scale feature used, and for what sizes |
| `card_flip` | `flip()` | `mode` A, B or S | is the practice loop used |
| `progression_view` | `setTier(t)` | `tier` | do players use progressions, which tier |
| `pdf_download` | `downloadDeckPDF(variant, btn)` | `paper`, `deck_kind` | is print wanted |
| `share_open` | `openShare(text)` ok branch | none | do shared links get opened |

No PII, no scale strings, no custom deck ids or names (a custom id hashes the seed and a name is free text). Enhanced measurement's outbound-click event covers the Resources links for free. Every `gtag('event', ...)` goes through one `function track(name, params)` that returns early unless `loadAnalytics()` injected; the sandbox and e2e therefore exercise the call sites with no hits.

**Success metrics (4 weeks after the real ID lands and the custom definitions of section 10 exist; S25: a parameter is not reportable until defined):** GA: users per week and the share from organic search (answers "does anyone arrive"); `scale_create` per 100 users (is the custom-scale promise used); `progression_view` per 100 users; `deck_select` by `deck_id` (which scale to promote first, feeds O3). Search Console: total impressions, clicks, and the scale-named query threshold of section 5.

## 8. Decisions

| ID | Question | Options and cost | Recommendation | Type | Blocks |
|---|---|---|---|---|---|
| D1 | GA loading | O1 fixed: injected by `loadAnalytics()`, one external script | as O1 | owner decided | W1 |
| D2 | Consent regions | O2 fixed | as O2 | owner decided | W1 |
| D3 | Title | O4 fixed | as O4 | owner decided | W1 |
| D4 | Description | D1 155 / D2 152 / D3 150 (section 3) | D3 | OWNER | W1 (uses D3 until told) |
| D5 | Value line | V1 / V2 / V3 (section 3) | V1 | OWNER | W1 (uses V1 until told) |
| D6 | Deck route form | `#deck=<slug>` with explicit seed slugs; alternative `#deck=<internal id>` leaks ids and breaks the slug symmetry | `#deck=<slug>` | AUTO | W1 |
| D7 | Deck route timing | ship in wave 1 (one step, 3 tests, 2 mutants) vs defer (a later `index.html` lane) | ship | OWNER | W1 step 6 only |
| D8 | Privacy note | sentence in the about section (no control) vs `#res-privacy` link (one panel stop, `panel-fit` 64px allowance) | sentence | OWNER | W1 step 3 |
| D9 | og.png | keep (zero cost) vs re-render with V1 through `tools/make_icons.py` (new `OG_LINES`, PNG churn) | keep | OWNER | none |
| D10 | Crawlable content position | after `#foot` (fold tests untouched) vs under `<h1>` (320x568 risk) | after `#foot` | AUTO | W1 |
| D11 | Landing progressions | Node tool with the engine (progressions on page) vs Python tool without | Node, `tools/gen_landing.js` | AUTO | deferred wave |
| D12 | Landing CSS | copied between markers by the tool vs sibling stylesheet linked by pages | markers (one source, `--check`) | AUTO | deferred wave |
| D13 | Landing GA | inline from `index.html` markers vs no GA on pages | inline from markers | AUTO | deferred wave |
| D14 | llms.txt | ship (one file, unverified self-claim) vs skip | skip | AUTO | none |
| D15 | `.nojekyll` | add (page dirs may start with anything; also stops Jekyll processing `_` paths) vs rely on names | add | AUTO | W3 |
| D16 | Search Console verification | DNS TXT (one record at the registrar, a Domain property covering every URL form, nothing in the repo) vs HTML meta (one more head tag, a W1-sized `index.html` change, URL-prefix property only) vs HTML file (a stray root file, same prefix limit) | DNS TXT | OWNER | none |
| D17 | Sitemap `lastmod` | omit (no real source) vs write | omit | AUTO | W3 |
| D18 | GA event list | the seven above (seven anchors, seven sandbox tests, two mutants) vs `card_flip` and `scale_create` only (two anchors; loses the deck and progression questions that feed O3) | the seven | OWNER | none (W1 ships all seven; the owner can drop rows before W1 spawns) |
| D19 | CLAUDE.md amendment wording | "exactly one external script, GA4 gtag.js, appended at runtime by `loadAnalytics()` after `analyticsAllowed()`; the committed bytes still carry no `<script src=`, which `tests/app.test.js` "index.html carries the whole engine inline, with no external script" keeps asserting; nothing else external" | as quoted | OWNER (ships with W1 per O1) | W1 |
| D20 | First screen with the about section | `#app` wrapper holding header, main and footer at `height:100%` (card size pinned by test) vs `#about` as a fourth `body` flex child (shrinks the card: `main` is `flex:1; min-height:0` inside `height:100%`) | wrapper | AUTO (outside voice P1) | W1 step 2 |
| D21 | In-page `#deck=` links | `hashchange` listener sharing `routeDeck()` with boot vs plain anchors (no reload on `/`, so nothing happens) vs no links in the about section | listener | AUTO (outside voice P1) | W1 step 6 |

Edge-case map: 1 D1 and W1 step 4; 2 the predicate table; 3 W2 step 2; 4 section 5.4 and D6-D7; 5 D11; 6 D13; 7 D12; 8 D10; 9 section 3 row 1; 10 section 5 smoke test; 11 the consent paragraph; 12 the events table; 13 S16 in section 4; 14 W3 brief.

## 9. Lanes (the /swarm section)

Projected cost: 4 lanes -> ~8 subagent runs, ~4 CI runs, +1 reviewer and +1 CI run per bounce. Concurrency never exceeds 3.

### Hard rules
1. Only the main agent merges, deploys, or touches shared infra. Lanes NEVER deploy.
2. The main agent is the sole writer of the coordination doc; lanes return reports and never edit it. Every PR passes `/review` by a non-author reviewer before merge, and verdicts are recorded.
3. File ownership per the Ownership table. Crossing a boundary is a queue row, never a direct edit.
4. No deploys mid-batch.
5. Delivery is PR-based, CI green at the verified head SHA, in the lane's branch namespace.
6. Lanes run local tests as smoke only; CI's run at the head SHA is the evidence.
7. ERROR PROTOCOL: on any error or blocker, re-read the Goal, make the smallest adjustment that still serves it, record the blocker in the return report, keep working whatever is unblocked. The goal never changes without the operator.
8. Standing authorization (owner, AFK grant): ordinary code merges flow with `gh pr merge --merge` once CI is green at the verified SHA and a fresh reviewer returned PASS or PASS_WITH_NITS at that SHA. Excluded and owner-only: creating the GA4 property, supplying the real Measurement ID, Search Console verification, sitemap submission, anything destructive or irreversible.

### Ownership
| Lane | Branch namespace | Worktree | Owns | Never touches |
|---|---|---|---|---|
| W1 head-copy-ga | `discoverability/w1-head-copy-ga` | `.claude/worktrees/w1` | `index.html` (head, about section, app JS outside engine regions and the DECKS line), `tests/app.test.js`, `tests/e2e.test.js` in wave 1b only (append-only, its own `describe`; W2 holds it in wave 1a, so no two live lanes share it), `tests/mutants/nm_og_title_drifts.patch`, new `nm_*.patch`, `dg_*.patch` and `dq_*.patch` (the `h_`, `dr2*` and `dr3` prefixes are taken by older corpora), CLAUDE.md "Hard constraints" bullet only | engine regions, `const DECKS`, `data/`, `tools/`, `tests/helpers/`, `tests/suite_health.py`, README |
| W2 harness | `discoverability/w2-harness` | `.claude/worktrees/w2` | `tools/sandbox.js`, `tests/helpers/cdp.js`, `tests/harness.test.js`, `tests/e2e.test.js` in wave 1a only (one new `describe` "analytics hosts"), new `tests/mutants/dh_*.patch` | `index.html`, README, CLAUDE.md, `tests/app.test.js` |
| W3 site-files | `discoverability/w3-site-files` | `.claude/worktrees/w3` | `robots.txt`, `sitemap.xml`, `.nojekyll`, new `tests/test_site_files.py`, its FLOORS row in `tests/suite_health.py`, the README python-suite count sentence, `tests/mutants/ds_*.patch` | `index.html`, `tools/`, every other test file |
| W4 docs-counts | `discoverability/w4-docs-counts` | `.claude/worktrees/w4` | CLAUDE.md (all but the W1 bullet), README (mutant count, routes, GA note), `tests/suite_health.py` FLOORS rows for `app.test.js` and `e2e.test.js` | code, tests other than FLOORS, mutants |

`index.html` has exactly one owner per wave (W1). Tests/mutants and FLOORS/README counts: W4 owns the counts; W1-W3 own their own patches.

### Sequencing
1. Wave 1a, parallel: W2 and W3 (both depend only on main).
2. Gate: CI green at the verified SHA plus reviewer PASS; merge W2, then W3 (serialized, contract section 7).
3. Wave 1b: W1 spawns the moment W2 merges (its JSON-LD breaks every sandbox test until the skip lands; its zero-request test needs the host block). W3 need not have merged.
4. Gate as above; merge W1.
5. Wave 1c: W4 spawns after W1 and W3 merge; sets counts from main's CI artifacts.
6. Deferred wave (O3): W5 landing tool and pages, W6 sitemap entries and validate check; briefs below, never spawned by this workstream.

Reviewer brief inputs for every lane: the lane's NEXT acceptance criteria, its Ownership row, goal and non-goals, the verified head SHA, the CI check names at that SHA (`data integrity`, `python suites`, `js suites (unit + e2e)`, `suite health`, `mutation gate shard 1/4` .. `4/4`, `mutation gate`, `panel fit (real)`, `panel fit (fallback)`), mutant budget 5 for W1-W3 (each ships patches) and 10 for W4.

Mutant verify form (the repo's gate takes no single-patch argument): `git apply tests/mutants/<p>.patch && <suite command from the header>; echo rc=$?; git apply -R tests/mutants/<p>.patch` must print a non-zero rc; `python3 tools/refresh_mutants.py --check` must stay 0.

### Briefing W2 (harness)
You are lane W2 (harness) of discoverability. GOAL: the test harness tolerates a non-JS `<script type>` in `index.html` and proves no analytics request leaves a test boot. NON-GOALS: no change to `index.html`, no GA code, no docs, no deck data. YOU OWN: `tools/sandbox.js`, `tests/helpers/cdp.js`, `tests/harness.test.js`, one new `describe("analytics hosts")` appended to `tests/e2e.test.js`, new `tests/mutants/dh_*.patch` (never `h_*`, an older corpus that patches the gate itself). YOU NEVER TOUCH: `index.html`, README, CLAUDE.md, `tests/app.test.js`, `data/`. BRANCH: `discoverability/w2-harness`. Work only in the worktree you were given. Facts: `boot()` in `tools/sandbox.js` collects every inline script with `blockMatches` (regex on `<script` without `src`) and runs them as one script; `launch()` in `tests/helpers/cdp.js` blocks `*fonts.googleapis.com*` and `*fonts.gstatic.com*` with `Network.setBlockedURLs` and, with `realFonts`, through `Fetch.enable` patterns; the sandbox navigator stub takes `userAgent` and `maxTouchPoints` options.
NEXT:
1. Test first in `tests/harness.test.js`: "boot skips a script whose type is not JavaScript" writes a temp copy of `index.html` with `<script type="application/ld+json">{"a":1}</script>` added in `<head>` and boots it; fails today. Then change `blockMatches` to skip `type` values other than empty, `text/javascript`, `module`. Criterion: test green, `node tools/boot_sim.js` prints `boot OK`. Verify: `node --test tests/harness.test.js && node tools/boot_sim.js`.
2. Test first in `tests/e2e.test.js` `describe("analytics hosts")`: "a full boot sends zero requests to googletagmanager.com and google-analytics.com" enables `Network` events, records every request URL across `freshLoad()`, asserts none matches either host AND that the blocked-URL list `launch()` returns (expose it on the launch result) contains both patterns; the second assertion fails today. (`Network.setBlockedURLs` still emits `requestWillBeSent` before `loadingFailed`, so an empty request list proves `analyticsAllowed()` returned false in the harness; the block is a second fence, pinned by the list assertion.) Then add `*googletagmanager.com*` and `*google-analytics.com*` to both block sites in `cdp.js`. Verify: `node --test --test-name-pattern "analytics.hosts" tests/e2e.test.js`.
3. Sandbox navigator stub gains `webdriver: true` by default with an opt-out option `webdriver: false`; test in `tests/harness.test.js` "the sandbox reports navigator.webdriver true unless told otherwise". The `document` stub (it has `documentElement` and a `body` getter, no `head`) gains `head`: an element whose `appendChild` records its children, exposed on the boot result; test "the sandbox document has a head that records appended children". Verify: `node --test tests/harness.test.js`.
4. Mutants: `dh_sandbox_runs_ldjson.patch` (restores the old regex; `# kills: boot skips a script whose type is not JavaScript`, `# suite: node --test --test-name-pattern boot.skips.a.script.whose.type.is.not.JavaScript tests/harness.test.js`), `dh_cdp_unblocks_ga.patch` (drops the two patterns; kills the e2e test), `dh_sandbox_webdriver_false.patch`, `dh_sandbox_no_head.patch`. Verify each with the mutant verify form; `python3 tools/refresh_mutants.py --check`.
5. Full smoke: `./tests/run.sh`.
ERROR PROTOCOL: on any error or blocker, re-read the goal, make the smallest adjustment that still serves it, and continue. If genuinely blocked, record the blocker in your return report and switch to whatever is not blocked. Never change the goal, your lane boundary, or another lane's plan. Never deploy.
DELIVERY: commit, push the branch, open a PR, wait for CI. Your local run is a smoke test; CI's run at your final commit is the evidence, so push and let it finish rather than reporting a local green. Push before you return; anything left only in the worktree is lost. Return the structured report and nothing else.

### Briefing W3 (site files)
You are lane W3 (site-files) of discoverability. GOAL: `robots.txt`, `sitemap.xml` and `.nojekyll` exist at the repo root, are tested, and a landing page is one more sitemap entry. NON-GOALS: no `index.html` change, no landing pages, no GA. YOU OWN: `robots.txt`, `sitemap.xml`, `.nojekyll`, new `tests/test_site_files.py`, its row in `FLOORS` in `tests/suite_health.py`, the README sentence "14 python suites" (becomes 15), new `tests/mutants/ds_*.patch`. YOU NEVER TOUCH: `index.html`, `tools/`, every other test file, CLAUDE.md. BRANCH: `discoverability/w3-site-files`. Facts: GitHub Pages serves committed files only and runs Jekyll unless `.nojekyll` exists; the site is `https://handpan.raywu.org/` with a trailing slash; sitemaps need absolute URLs and `lastmod` only when accurate (S21), robots.txt needs an absolute `Sitemap:` line (S22); `tests/test_readme_currency.py` `test_the_suite_counts_match_the_files_on_disk` requires the README python-suite count to equal the files on disk; `suite_health.py` refuses a test file with no FLOORS row.
NEXT:
1. Tests first in `tests/test_site_files.py`: robots.txt has `User-agent: *`, `Allow: /`, `Sitemap: https://handpan.raywu.org/sitemap.xml`; sitemap.xml parses (`xml.etree`), every `<loc>` is absolute on `https://handpan.raywu.org/`, ends with `/`, has no `#`, and the set equals exactly `{"https://handpan.raywu.org/"}`; no `<lastmod>`; `.nojekyll` exists and is empty. Add `"tests/test_site_files.py": 5` to FLOORS and the README count. Verify: `python3 -m unittest tests.test_site_files -v && python3 tests/suite_health.py && python3 -m unittest tests.test_readme_currency -v`.
2. Write the three files to make the tests green. Verify: same command.
3. Mutants: `ds_sitemap_fragment.patch` (a `#deck=` loc), `ds_robots_no_sitemap.patch`, `ds_sitemap_lastmod_fake.patch`; headers in the corpus's python form, `# kills: <test_name>` and `# suite: python3 -m unittest -k <test_name> tests.test_site_files` (see `tests/mutants/b_decks_json_desync.patch`). Verify with the mutant verify form; `python3 tools/refresh_mutants.py --check`.
4. Full smoke: `./tests/run.sh`.
ERROR PROTOCOL and DELIVERY: as in W2's brief, verbatim.

### Briefing W1 (head, copy, GA, route)
You are lane W1 (head-copy-ga) of discoverability. GOAL: `index.html` carries the O4 title, the D4 description, the section 4 about section, the section 6 JSON-LD, the O1/O2 analytics loader and the section 7 events, with the CLAUDE.md "Hard constraints" bullet amended in the same PR; CI boots send nothing. NON-GOALS: no engine region or `const DECKS` edit, no deck data, no new control in the settings panel, no banner, no README or other CLAUDE.md edits, no harness edits. YOU OWN: `index.html` outside the generated regions, `tests/app.test.js`, your own `describe("discoverability")` appended to `tests/e2e.test.js`, `tests/mutants/nm_og_title_drifts.patch`, new `tests/mutants/nm_*.patch`, `dg_*.patch` and `dq_*.patch`, the one CLAUDE.md bullet under "Hard constraints" that reads "no `<script src>` may appear in it". YOU NEVER TOUCH: engine regions, the DECKS line, `data/`, `tools/`, `tests/helpers/`, `tests/suite_health.py`, README. BRANCH: `discoverability/w1-head-copy-ga`. Base: main after W2 merged (sandbox skips non-JS script types, navigator stub has `webdriver`, e2e blocks the GA hosts). Facts you need: the exact strings, the predicate table, the consent snippet and region list, the events table and the route design are sections 3, 4, 5.4, 6 and 7 of `docs/plans/2026-10-16-discoverability.md`; read them. Anchors: `<title>`, `<h1>Handpan Chords</h1>`, `<footer id="foot">`, `const DEFAULT_DECK`, `const deck = () =>`, `function selectDeck(id)`, `function flip()`, `function setTier(t)`, `function downloadDeckPDF(variant, btn)`, `function openShare(text)`, `function generateDeck(text, options, guard)`, `const SHARE_PREFIX`, `const ADD_ROUTE`, the `/* ---------------- go ---------------- */` block, `tests/app.test.js` "the visible name is one string: title, h1, og:title and twitter:title" and "the description says progressions early, equals og:description and fits 120..160", `tests/e2e.test.js` "the card fits a 380px viewport on load, with no horizontal overflow".
NEXT:
1. Title and description (TDD): rewrite the two `tests/app.test.js` tests per section 3 (title == O4 string, og:title and twitter:title == title, h1 == "Handpan Chords"; description <= 155, contains "free", "progressions" in the first 110 characters). Then change the four tags. Update `nm_og_title_drifts.patch` headers; add `nm_title_shrinks_to_app_name.patch`, `nm_description_drops_free.patch`. Verify: `node --test tests/app.test.js` and the mutant verify form for the three patches.
2. About section (TDD): `tests/app.test.js` "the about section names every built-in deck with its card count from data/decks.json and the value line" reads `index.html` and `data/decks.json`; `tests/e2e.test.js` "the about section is visible below the card at 380px with no horizontal scroll" (scroll to `#about`, assert `getBoundingClientRect().width > 0`, `getComputedStyle(...).display !== "none"`, `body.scrollWidth <= clientWidth + 1`) and "the card keeps its origin/main size with the about section below the first screen" (D20: measure `.scene` height on `origin/main` at 380x780, 320x568 and 1024x700 first, pin the three figures as constants with 1px tolerance, assert `document.scrollingElement.scrollHeight > innerHeight` at each), plus a re-run of the existing fold test. Then wrap header, main and footer in `<div id="app">` per D20 and add `<section id="about">` after `</div>` with the V1 line, three steps, the deck list, the custom-scale sentence, the D8 privacy sentence. Mutants: `nm_about_hidden.patch` (`display:none`), `nm_about_drops_a_deck.patch`, `nm_app_wrapper_flexes.patch` (`#app{flex:1}`; kills the card-size test). Verify: `node --test tests/app.test.js && node --test --test-name-pattern "about.section|380px.viewport" tests/e2e.test.js && node tools/probe/panel_fit.js --base origin/main --font fallback`.
3. JSON-LD (TDD): `tests/app.test.js` "the JSON-LD block parses and states only what the page shows" parses the block, asserts the section 6 properties, asserts no `aggregateRating`/`review`, and that `name`, `description` and `isAccessibleForFree` match the h1, the meta description and the word "free" in the about section. Then add the block in `<head>`. Mutant `nm_ldjson_rating.patch`. Verify: `node --test tests/app.test.js && node tools/boot_sim.js`.
4. Loader (TDD): sandbox tests per the predicate table (four boots: `file:`, each local host, `webdriver`, placeholder) asserting whether a `script` child with the gtag src was appended to `document.head` (W2's `head` stub records its children); the `window.dataLayer` consent test of section 7; "a routed boot queues config before deck_route" (boot at `https://example.test/index.html#deck=d-kurd-10`, `webdriver: false`, real-looking ID: `dataLayer` reads consent, consent, js, config, then the `deck_route` event); `tests/e2e.test.js` "analyticsAllowed() is false in the harness and the boot sends zero analytics requests". Then add the consent snippet in `<head>`, `GA_MEASUREMENT_ID`, `analyticsAllowed()`, `loadAnalytics()`, `track()`, and the go-block call as its first statement. Mutants: `dg_predicate_ignores_file.patch`, `dg_predicate_ignores_localhost.patch`, `dg_predicate_ignores_webdriver.patch`, `dg_predicate_ignores_placeholder.patch`, `dg_consent_regional_first.patch`, `dg_consent_ads_granted.patch`, `dg_page_location_keeps_hash.patch`, `dg_loader_after_route.patch` (moves the call below the hash branches; kills the routed-boot test). Verify: `node --test tests/app.test.js && node --test --test-name-pattern "analyticsAllowed" tests/e2e.test.js`.
5. Events (TDD): sandbox tests that each anchor calls `track()` with the section 7 name and params and that `track()` pushes nothing when `loadAnalytics()` did not inject; a test that no param value is a string longer than 40 characters or contains a `custom:` id. Mutants: `dg_track_sends_custom_id.patch`, `dg_flip_untracked.patch`. Verify: `node --test tests/app.test.js`.
6. Deck route (D7, ships unless the owner says otherwise): sandbox tests for the three visitor states at `href: "https://example.test/index.html#deck=d-kurd-10"` (untouched seed selected and persisted; edited seed shows its replacement; deleted seed falls back and `say("That deck is gone...")` fires), an unknown slug falls back silently, the hash is replaced away, `#s=` is untouched; a sandbox test that dispatching `hashchange` with `#deck=f-low-pygmy-18` after boot selects Pygmy and clears the hash (D21); e2e "a #deck= link opens that deck at 380px and the address bar loses the hash" (a fresh load) and "clicking an about-section deck link on / switches the deck without a reload" (click the real anchor, assert the chip, the hash and that `performance.getEntriesByType("navigation").length` is still 1). Then add `DECK_ROUTE`, `DECK_SLUGS`, `routeDeck()`, the read before `const wantedDeck`, the `save()` and `track()` after `setMode(mode)`, the hash branch, the `hashchange` listener, the about-section links. Mutants: `dq_route_pushstate.patch`, `dq_route_accepts_custom_id.patch`, `dq_route_not_persisted.patch`, `dq_route_read_after_warning.patch` (moves the read below the "gone" warning; kills the deleted-seed test), `dq_route_no_hashchange.patch`. Verify: `node --test tests/app.test.js && node --test --test-name-pattern "deck=.link" tests/e2e.test.js`.
7. CLAUDE.md: replace the bullet's clause with D19's wording; `tests/app.test.js` "index.html carries the whole engine inline, with no external script" stays as it is and stays green (its regex runs over the committed bytes, which never carry `src=`). Verify: `grep -n "loadAnalytics" CLAUDE.md && node --test --test-name-pattern "no.external.script" tests/app.test.js`.
8. Full smoke: `./tests/run.sh && python3 tools/refresh_mutants.py --check`.
ERROR PROTOCOL and DELIVERY: as in W2's brief, verbatim.

### Briefing W4 (docs and counts)
You are lane W4 (docs-counts) of discoverability. GOAL: CLAUDE.md and README describe what shipped (the deck route, the about section, robots/sitemap/.nojekyll, the GA loader and placeholder swap, the sandbox type skip, the e2e host block) and the counts match main. NON-GOALS: no code, no tests beyond FLOORS rows. YOU OWN: CLAUDE.md (all but the W1 bullet, already merged), README (mutant count, suite counts, a "Discoverability" subsection), FLOORS rows for `tests/app.test.js` and `tests/e2e.test.js` in `tests/suite_health.py`. YOU NEVER TOUCH: `index.html`, `data/`, `tools/`, mutants, other tests. BRANCH: `discoverability/w4-docs-counts`. Facts: every doc claim must cite the test that proves it (repo rule); counts come from main's CI artifacts (`by_module`, `files[].total` in `python-results.json` and `js-results.json`), never from a local run; `tests/test_readme_currency.py` bands the mutant count at 90%.
NEXT:
1. Read the merged W1-W3 diffs on main (`git log --oneline -20`, `git show <sha> --stat`). Verify: the three merge SHAs listed in your report.
2. CLAUDE.md: a "Discoverability" section (route form and consumption, about section position and its two tests, JSON-LD and the sandbox skip, `GA_MEASUREMENT_ID` swap procedure of section 10, consent regions, the e2e host block). Each sentence names its test. Verify: `python3 -m unittest tests.test_readme_currency -v`.
3. README: mutant count and suite counts from main's CI artifacts; one paragraph on robots/sitemap. Verify: `python3 -m unittest tests.test_readme_currency -v && python3 tests/suite_health.py`.
4. FLOORS rows for `app.test.js` and `e2e.test.js` raised to main's counts. Verify: `python3 tests/suite_health.py`.
ERROR PROTOCOL and DELIVERY: as in W2's brief, verbatim.

### Briefing W5 (deferred: landing tool and pages) and W6 (deferred: sitemap entries and validate)
Spawned only after the section 5 trigger, cold, from this file. W5 owns `tools/gen_landing.js`, `tests/test_gen_landing.py` or `tests/gen_landing.test.js`, the four `<slug>/index.html`, the `landing-css` and `ga` markers in `index.html` (the one `index.html` owner of that wave), `tests/mutants/dl_*.patch`; W6 owns `tools/validate.py` check 6, `sitemap.xml`, `tests/test_site_files.py` (the set of locs grows by one per page), and runs after W5 merges. Both briefs reuse section 5 verbatim for GOAL and NEXT: tool with `--check` (TDD), pages readable without JS, 380px smoke test, the deck route resolving, every chord name present, `python3 tools/validate.py` green.

### Status
| Lane | Current branch | State | Last update (UTC) | Last verdict |
|---|---|---|---|---|
| W1 | | unspawned | | |
| W2 | | unspawned | | |
| W3 | | unspawned | | |
| W4 | | unspawned | | |

### Handoff queue (append-only)
| # | From | Ask | Status |
|---|---|---|---|

### Review log
| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|

### Cycle state
```
Cycle: 0   Wave: 1a   Merged this batch: none
| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
```

## 10. Owner-gated actions (outside every lane)

| Action | How | When |
|---|---|---|
| Create the GA4 property and web data stream; copy the Measurement ID | GA Admin | any time |
| Supply the real ID | the owner (or a lane the owner spawns) replaces the one `GA_MEASUREMENT_ID` literal in `index.html`; the placeholder test flips from "nothing injected" to "injected at https://example.test with webdriver false"; `./tests/run.sh`; PR; ordinary merge | after W1 merges |
| Verify Search Console | D16: DNS TXT on `raywu.org` for a Domain property (S23), covers `handpan.raywu.org` and every URL form | any time |
| Submit the sitemap | Search Console, Sitemaps, `https://handpan.raywu.org/sitemap.xml` | after W3 merges and Pages has deployed |
| Register the custom definitions (outside voice P2) | GA Admin, Custom definitions: event-scoped dimensions `deck_kind`, `deck_id`, `mode`, `tier`, `paper`, `has_bottom`; custom metric `note_count` (S25: a parameter is not reportable until defined, 24-48 h to appear, 50 event-scoped dimensions per standard property) | after the real ID lands, before the 4-week window starts |

## 11. Verification after merge (main agent, contract section 8)

- `curl -s https://handpan.raywu.org/ | grep -c "Handpan Chords: Custom Scale Chord and Progression Practice"` is 2 or more (title and og:title); `grep -c 'name="description"'` is 1 with the D3 string; `grep -c 'application/ld+json'` is 1; `grep -c 'id="about"'` is 1; `grep -o 'D Kurd 10\|D Amara 10\|D Amara 9\|F3 Low Pygmy 18\|C# Hijaz 9' | sort -u | wc -l` is 5.
- `curl -sI https://handpan.raywu.org/robots.txt` and `/sitemap.xml` return 200; `curl -s .../robots.txt | grep Sitemap`.
- Rich Results Test on `/` (expect: no rich result, no errors); schema.org validator on `/` (expect: no errors).
- GA DebugView with Tag Assistant on a production visit (S24) after the real ID: `page_view` then `card_flip`; a localhost visit shows nothing.
- Search Console URL inspection of `/` after submission.
- CDP captures: one production boot showing the `gtag/js?id=` request, one `http://127.0.0.1` boot showing none (the W2 e2e test, run against production with a one-off `href`).
- Repeat the Rich Results and validator steps on each landing page when the deferred wave ships.

## 12. Merge gates

CI green at a head SHA verified against the local tip (`gh pr view <pr> --json state,headRefOid`); a fresh swarm-reviewer PASS or PASS_WITH_NITS at that SHA; `gh pr merge <n> --merge` only; CLAUDE.md updated in the same wave for every new constraint, sync tool or file (W1 carries its bullet, W4 the rest; W6 would carry the landing tool's).

## 13. Sources (accessed 2026-10-16)

| # | Source | Used for |
|---|---|---|
| S1 | https://developers.google.com/search/docs/appearance/structured-data/faqpage | FAQ rich result stopped showing 2026-05-07; doc removed 2026-06-15 |
| S2 | https://developers.google.com/search/docs/appearance/structured-data/software-app | SoftwareApplication rich result requires `aggregateRating` or `review` |
| S3 | https://support.google.com/analytics/answer/9267744 and https://support.google.com/analytics/answer/13316687 | 40-char names, 25 params, 100-char values, reserved web names |
| S4 | https://developers.google.com/search/docs/appearance/ai-features | "no special schema.org structured data that you need to add"; markup must match visible text (updated 2025-12-10) |
| S5 | https://ahrefs.com/blog/schema-ai-citations/ | matched study: no citation lift from adding JSON-LD (ChatGPT +2.2%, not significant) |
| S6 | https://llmstxt.org/ | the proposal and its intended consumers |
| S7 | https://searchengineland.com/google-says-llms-txt-files-wont-harm-or-help-your-search-rankings-480264 | Google's 2026-06-15 guide revision: Search ignores llms.txt |
| S8 | https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced | `region` ISO 3166-2 array; default without region covers everyone else; more specific wins; defaults before `config` |
| S9 | https://developers.google.com/tag-platform/gtagjs/install | the five-line snippet, placed in `<head>` |
| S10 | https://developer.x.com/cards/markup (fetch returned 402 on 2026-10-16; table confirmed through its quoted copies) | `twitter:description` falls back to `og:description`; `twitter:card` has no fallback |
| S11 | https://developers.google.com/tag-platform/security/concepts/consent-mode | cookieless ping contents |
| S12 | https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data | JSON-LD recommended, head or body, not about invisible content |
| S13 | https://developers.google.com/search/docs/appearance/structured-data/sd-policies | no invisible or misleading markup; fake ratings draw manual action |
| S14 | https://schema.org/WebApplication | `applicationCategory`, `browserRequirements`, `featureList`, `isAccessibleForFree` |
| S15 | https://www.gov.uk/eu-eea | the 30 EEA countries; CH and GB are not EEA |
| S16 | https://www.sound-sculpture.de/en/pages/handpan-scales | "D-Celtic Minor scale (also known as D-Amara)" |
| S17 | https://www.thehandpantemple.com.au/product-page/d-kurd-handpan-guide-note-mapping-chord-chart | free static D Kurd chord chart |
| S18 | https://masterthehandpan.com/masterclass/applied-music-theory-for-handpan | paid course, chords on D Kurd, F Pygmy, E Amara |
| S19 | CLAUDE.md, "What this project is" (the commercial "Handpan Training Cards" D Amara set this repo measured its card size from; no product URL was reachable on 2026-10-16) | Kirchhofer printed training cards, paid, one scale per set |
| S20 | https://developers.google.com/search/docs/crawling-indexing/url-structure | "Google Search generally doesn't support URL fragments" |
| S21 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | absolute URLs; `lastmod` only when accurate |
| S22 | https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt | root location, `Sitemap:` absolute |
| S23 | https://support.google.com/webmasters/answer/9008080 | verification methods; DNS for Domain properties |
| S24 | https://support.google.com/analytics/answer/7201382 | DebugView, `debug_mode`, Tag Assistant |
| S25 | https://support.google.com/analytics/answer/14240153 | custom dimensions and metrics: "You create a custom dimension or metric so you can analyze the data from the event parameter"; 24-48 h; 50 event-scoped per standard property |

## 14. Engineering review record (/plan-eng-review, 2026-10-16, spawned session, auto-chosen recommendations)

Scope Challenge: no feature answers proposed; structure kept as written (the complexity gate trips at 8+ files; "Original arrangement" is the recommended option and was auto-chosen); accepted scope: the plan as written plus the remedies below. Prerequisite `/office-hours` offer: skipped (recommended for a plan this constrained). Review ledger (gstack numbering, distinct from the plan's D1-D21): D1 prerequisite skip; D2 original arrangement; D3 apply every native finding; D4 apply every outside-voice finding. Approval readiness: PASS (D1-D4 answered by the spawned-session rule, nothing destructive).

| # | Finding (native unless marked) | Applied in |
|---|---|---|
| F1 P1 | `tools/sandbox.js`'s `document` stub has `documentElement` and `body` but no `head`; W1's loader tests assert a child appended to `document.head` and would throw | W2 step 3 (`head` stub, its test, `dh_sandbox_no_head.patch`); W1 step 4 names it |
| F2 P2 | the loader's position in the go block was unstated | section 7: first statement; W1 step 4; `dg_loader_after_route.patch` (reversed from "after the hash branches" by C3) |
| F3 P2 | the consent test parsed snippet text | section 7 consent paragraph: assert on `window.dataLayer` |
| F4 P3 | `has_bottom` as a boolean | events table: 1 or 0 |
| F5 P3 | the existing no-external-script test was unnamed | D19 row and W1 step 7 |
| F6 note | `Network.setBlockedURLs` still emits `requestWillBeSent` | W2 step 2 parenthesis |
| C1 P1 (outside) | a fourth `body` flex child shrinks the card (`html,body{height:100%}`, `main{flex:1; min-height:0}`) | section 4 "First screen", D20, W1 step 2 test and `nm_app_wrapper_flexes.patch` |
| C2 P1 (outside) | in-page `#deck=` links change the hash without a reload; boot-only handling does nothing | section 5.4 row 5, D21, W1 step 6 (`hashchange`, two tests, `dq_route_no_hashchange.patch`) |
| C3 P1 (outside) | `deck_route` and boot `share_open` would call `track()` before injection | section 7 loader paragraph; W1 step 4 routed-boot `dataLayer` test |
| C4 P2 (outside) | the "gone" warning runs before the hash branches, so a route read there cannot reuse it | section 5.4 rows 2, 3 and 5 (`routeDeck()` reads before `const wantedDeck`); `dq_route_read_after_warning.patch` |
| C5 P2 (outside) | custom parameters are not reportable until defined in GA | section 10 new row; section 7 metrics sentence; S25 |

NOT in scope: landing pages (O3, section 5 trigger), `llms.txt` (D14), a consent banner (O2), a privacy link control (D8 recommends the sentence), og.png re-render (D9). What already exists and is reused: `deck()`, `replacements()`, `fallbackDeck()` and the "gone" warning (route resolution); `selectDeck()` and `save()` (persistence); `openShare()` and the `SHARE_PREFIX` branch (hash handling pattern); `launch()`'s block lists; `blockMatches` in `boot()`; the 1024x700 baseline-in-test pattern. Nothing is rebuilt. Failure modes with no test, no handling and a silent result: none (an offline or blocked gtag script changes nothing, by design and by the zero-request test; a wrong Measurement ID sends hits nowhere, visible in DebugView, section 11). Worktree parallelization: the Sequencing table of section 9 (W2 and W3 parallel; W1 after W2; W4 after W1 and W3); the one shared file, `tests/e2e.test.js`, is held by one live lane per wave.

Completion summary: Scope Challenge, scope accepted as-is; Architecture 4 issues (F1, C1, C2, C4); Code Quality 3 (F2, F4, F5); Test review, diagram is the predicate table and the section 4 and 5.4 test lists, 2 gaps (F3, C3); Performance 0; NOT in scope and What already exists written; TODOS.md 0 items (nothing here belongs there); Failure modes 0 critical gaps; Unresolved decisions 0 in this review; Outside voice codex, completed, 5 findings (3 P1, 2 P2), all applied; Parallelization 4 lanes, 2 parallel and 2 sequential; Lake Score N/A (every choice differs in kind). Test plan artifact: `~/.gstack/projects/raywu-handpan-cards/ray-claude-discoverability-plan-eng-review-test-plan-20261016-111540.md`; tasks: `tasks-eng-review-20261016-111540.jsonl` beside it.

## Implementation Tasks
Synthesized from this review's findings; every task is already a step in a lane brief above.

- [ ] **T1 (P1, human: ~3h / CC: ~10min)** W1 step 2: `#app` wrapper, card-size test, `nm_app_wrapper_flexes.patch` (C1). Files: `index.html`, `tests/e2e.test.js`, `tests/mutants/`. Verify: `node --test --test-name-pattern "about.section|origin/main.size" tests/e2e.test.js`.
- [ ] **T2 (P1, human: ~3h / CC: ~10min)** W1 step 6: `routeDeck()` read before `const wantedDeck`, `hashchange` listener, two tests, two mutants (C2, C4). Files: `index.html`, `tests/app.test.js`, `tests/e2e.test.js`, `tests/mutants/`. Verify: `node --test tests/app.test.js && node --test --test-name-pattern "deck=.link|about-section.deck.link" tests/e2e.test.js`.
- [ ] **T3 (P1, human: ~2h / CC: ~5min)** W1 step 4: `loadAnalytics()` first in the go block, routed-boot `dataLayer` test, `dg_loader_after_route.patch` (C3, F2). Files: `index.html`, `tests/app.test.js`, `tests/mutants/`. Verify: `node --test tests/app.test.js`.
- [ ] **T4 (P1, human: ~1h / CC: ~5min)** W2 step 3: `document.head` stub, test, `dh_sandbox_no_head.patch` (F1). Files: `tools/sandbox.js`, `tests/harness.test.js`, `tests/mutants/`. Verify: `node --test tests/harness.test.js`.
- [ ] **T5 (P2, human: ~1h / CC: ~5min)** W1 step 4: consent assertions on `window.dataLayer` (F3). Files: `tests/app.test.js`. Verify: `node --test tests/app.test.js`.
- [ ] **T6 (P2, human: ~20min / CC: n/a, owner)** section 10: register the custom definitions in GA Admin (C5). Verify: the GA Explore report shows `deck_id` as a dimension.
- [ ] **T7 (P3)** `has_bottom` 1 or 0 (F4); **T8 (P3)** D19 names the no-external-script test (F5); **T9 (P3)** W2 step 2 states what the empty request list proves (F6). All three are wording already in this file.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | none |
| Outside Review | codex (`codex exec`, model gpt-6-astra) via `/plan-eng-review` | Independent 2nd opinion | 1 | completed, issues_found (applied) | 5 findings, 5 applied |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (this run; logged after the Read-back gate) | 11 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | none |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | none |

- **OUTSIDE COVERAGE:** provider codex, phase plan-review, completed; 5 findings (C1-C5), every one applied in the sections named in section 14.
- **CROSS-MODEL:** native (Claude, this harness) and codex (gpt-6-astra) overlap on none of the eleven findings; the outside voice found the three P1 behavioural gaps (layout, in-page links, event ordering) that the native pass, anchored on the harness, missed; the native pass found the harness gaps the outside voice could not see. Both sets are applied; no disagreement remains.
- **VERDICT:** ENG CLEARED, outside review completed and applied; ready for `/swarm`.

NO UNRESOLVED DECISIONS
