# Plan: move About off the main page (2026-10-17)

This is a plan only. It adds no production code, deploys, dependencies or paid services.
It is based on `origin/main` at 75c2862.

Evidence marks:
- **[V]** verified against a primary source or the repo at that commit.
- **[O]** observed by running something here.
- **[A]** an assumption or an inference.

Code is cited by function, marker or test title, never by line number.

## 1. Recommendation

**Choose Option A: turn About into a full-screen overlay inside `index.html`.**

- `<section id="about">` keeps its position in the markup and every word of its copy.
- It gains `hidden`, `role="dialog"`, `aria-modal="true"`, a sticky exit row and a Contact line.
- Only a new `ABOUT` button (`#about-open`) opens it. The button has its own full-width row at the end of the settings panel, after the HANDPAN 101 row (owner, G1, 2026-10-17).
- Opening About pushes one `#about` history entry. The exit control, Escape and Back each consume that entry and return the app untouched.

Why A:
- **The served HTML of `/` keeps everything it has today.** That is the whole About text, its five `<a href="#deck=...">` links and the JSON-LD. A curl of `/` sees more than today, because the Contact line is added [O: the 140 served About words stay in the file]. Google lists content that a toggle hides as something that does "not violate our policies" [V, section 2].
- **It reuses a pattern that already works.** The scale sheet already does this with `showSheet`, `closeScaleSheet`, `pendingPop`, the `popstate` listener, `setInert` and `cycleTabStops` [V].
- **`#deck=` links still switch decks in place, without a reload.** Option B loses this.
- **There is no new file.** Nothing changes in the sitemap, and nothing risks the single-file constraint.
- **The ABOUT row grows the panel by 47 to 50px, and one scoped oracle allowance admits it.** I probed this exact markup and stop order with `node tools/probe/panel_fit.js --base origin/main --font both --workers 2` (section 4, "Panel fit") [O].

The alternatives are B (a static `about.html` page) and C (A plus that page). Both are compared in section 3. C stays open as a later owner gate (G8).

**Confidence**
- High on UX and testability. The pattern exists in the repo, and the panel growth was measured over every cell the oracle measures.
- Medium on SEO. No primary Google source mentions a full-screen overlay. The claim that it ranks like the visible section rests on the analogy with accordions and tabs [A].

## 2. SEO findings (primary Google sources only, accessed 2026-10-17)

| # | Case | Source | Quote (under 15 words) | Mark |
|---|---|---|---|---|
| E1 | (a) | https://developers.google.com/search/docs/essentials/spam-policies | "Accordion or tabbed content that toggle between hiding and showing additional content" (listed as not violating) | [V] |
| E2 | (a) | https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing | "consider moving content into accordions or tabs to save space." | [V] |
| E3 | (a) | same | "Don't lazy-load primary content upon user interaction." | [V] |
| E4 | (a) | same | "Google won't load content that requires user interactions" | [V] |
| E5 | (b) | https://developers.google.com/search/docs/crawling-indexing/links-crawlable | "Google can only crawl your link if it's an <a> HTML element" | [V] |
| E6 | (b) | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | "Include the URLs in your sitemap that you want to see" | [V] |
| E7 | (b), routes | https://developers.google.com/search/docs/crawling-indexing/url-structure | "Google Search generally doesn't support URL fragments." | [V] |
| E8 | routes | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics | "don't use fragments to load different page content." | [V] |
| E9 | (c) | https://developers.google.com/search/docs/appearance/structured-data/sd-policies | "Don't mark up content that is not visible to readers of the page." | [V] |
| E10 | (c) | same (in its list of reasons a rich result may not show) | "The content referred to by the structured data is hidden from the user" | [V] |
| E11 | (c) | https://developers.google.com/search/docs/appearance/structured-data/software-app | "You must include one of the following properties: aggregateRating" | [V] |

**(a) Text hidden until a tap**
- The About text is in the served bytes and in the rendered DOM. Nothing fetches it on interaction, so E3 and E4 (which are about lazy-loading) do not apply [V: the markup is static].
- E1 and E2 allow content that a toggle reveals. An overlay opened by a menu button is a toggle in the same sense [A].
- Google publishes no weight for hidden text. This plan claims no ranking effect either way [A].

**(b) A separate static page**
- Google can crawl it only if `/` links to it with `<a href>` (E5). It is listed by adding it to `sitemap.xml` (E6).
- It moves the 140 About words off `/`, so `/` itself gets thinner [O: word count].

**Routes**
- `#about` and `#deck=` are fragments. Google does not index fragments as URLs, and pages should not rely on them to load content (E7, E8) [V].
- Neither option turns a fragment into an indexable URL. Only B's `about.html` is a new URL.

**(c) Structured data and the word "free"**
- After the move, the value line ("A free chord ...") is visible only after one tap.
- E9 forbids marking up content that readers cannot see. E10 lists hidden content as a reason a rich result may not show.
- By design, the WebApplication block has no `aggregateRating` or `review`. The test "the JSON-LD block parses and states only what the page shows" forbids both.
- E11 makes one of those two properties required for the software-app rich result. So `/` is not eligible for that rich result today, and the move cannot cost one. [V for the requirement; A for the conclusion]
- Google does not say whether a fact one tap away counts as "visible" [A]. This is owner gate G5.

**Q4: does `/` keep enough crawlable text?**
- The served bytes keep the title, the meta description, the JSON-LD, the static `#app` markup (about 181 words) and all 140 About words. The Contact line is added [O: word counts of the `#app` and `#about` markup with tags stripped].
- Apart from that addition, the served set is unchanged.
- The rendered first screen already showed only the app. About sat below the fold (test "the card keeps its origin/main size with the about section below the first screen").
- What changes is that a renderer that scrolls the page no longer reaches visible About text [A on how much that matters].

## 3. Options

| | A: overlay in `index.html` (recommended) | B: sibling `about.html` | C: A plus `about.html` |
|---|---|---|---|
| SEO | Served text unchanged, plus Contact. Hidden until a tap (E1, E2) | `/` loses 140 words. A new thin URL goes in the sitemap (E5, E6) | The same text on two URLs; one copy must be canonical |
| 380px first screen | Unchanged (About was below the fold). The page stops scrolling | Unchanged | Unchanged |
| History and routes | One `#about` entry, consumed on exit. `syncRoute()` is guarded | A full page navigation. Back reloads `/` or restores it from bfcache [A] | As A, plus B's |
| App returns exactly as it was | Yes: nothing in the app is touched | Lost unless bfcache restores the page [A] | As A |
| Focus and inert | `setInert([#app, #settings-panel])`. Focus goes to the exit control, then back to the trigger | Browser default | As A |
| `#deck=` links | Switch in place by replacing the `#about` entry | `/#deck=...` does a full boot (the routed boot works) | Both paths |
| Print | Unchanged (`@media print` keeps `#about{display:none}`) | A second page to style | As A |
| Analytics | `about_open` event, no params (G4) | Needs a GA loader on a second page, or none | Both |
| Single-file constraint | Kept; no new file | A sibling file is allowed, but it duplicates CSS and fonts | As B |
| Tests changed | 8 existing tests changed, 25 added, 3 sandbox ids, one scoped oracle allowance | Site-file tests, a new test file for the page, the About tests moved | Both sets |
| Size | One implementation lane plus a docs lane | Two lanes plus site files | Three lanes |

**Rejected for now**
- B fails "returns exactly as it was" and thins `/`.
- C duplicates the copy for no measured gain. It can be revisited with the deferred landing pages (discoverability plan, section 5).

## 4. Implementation plan (/swarm)

**North star.** About leaves the main page, opens as a full-screen overlay from the menu, and closes back to the identical app state. `/` serves at least the text it serves today.

**Non-goals**
- No change to the About copy except the Contact line.
- No change to deck data, geometry, the card, the deck strip or the Add-a-Scale sheet.
- No new sibling page, and no sitemap or robots change.
- No transition or animation.
- No line-number references in comments (`tests/test_readme_currency.py` ratchets them).

### Lanes, waves and cost

| Wave | Lane | Branch | In flight |
|---|---|---|---|
| 1 | O: overlay, menu control, Contact line | `claude/about-overlay` | 1 |
| 2 | D: docs | `claude/about-docs` | 1 |

Only one lane is in flight at a time, because the work does not split by file. `index.html`, `tests/app.test.js` and `tests/e2e.test.js` all change together, and TDD keeps each test in the lane that makes it pass.

**Sequencing with other plans.** Scale-import lane B never runs in the same wave as About lane O (both own index.html app JS, ELEMENT_IDS, app/e2e tests and their FLOORS rows); lane A1 may run beside O since it touches only the engine region, its two module lists and its own FLOORS row, and whichever of O and A1 merges second resets FLOORS from its own CI artifacts; share v5 starts after O and D (PR #335 §4.1).

**Cost**
- Two author runs and two reviewer runs.
- Lane O will likely bounce once, which adds one author run and one reviewer run.
- That is about six subagent runs and three to four full CI runs. No time estimate is given.

### Ownership (no file has two owners in a wave)

| Path | Lane O | Lane D |
|---|---|---|
| `index.html`: About CSS, `#about` markup, the last Resources row, About JS, the `syncRoute` and `hashchange` guards, the `popstate` branch, the `document` keydown branch | owns | - |
| `tools/sandbox.js` (`ELEMENT_IDS` only) | owns | - |
| `tools/probe/panel_fit.js` (the About-row allowance only) | owns | - |
| `tests/app.test.js`, `tests/e2e.test.js` | owns | - |
| `tests/mutants/`: new `ao_*` patches, the rewrite of `nm_about_hidden.patch`, refreshes, two header edits | owns | - |
| `tests/suite_health.py` (only the FLOORS rows for `tests/app.test.js` and `tests/e2e.test.js`) | owns | - |
| `CLAUDE.md` ("Discoverability" and "Menu Resources") | - | owns |
| `README.md` (the About sentence in its discoverability paragraph) | - | owns |
| `docs/plans/2026-10-16-discoverability.md` (a supersession note at the top) | - | owns |

### Standing gates (every lane)

1. **CI is green at the head SHA.**
   - First verify that `gh pr view <n> --json headRefOid` equals the local tip. Re-query once, because it lags a push.
   - Read the run conclusion through `gh run list`.
2. **Review passes at that SHA.** A fresh reviewer returns PASS or PASS_WITH_NITS at that same SHA.
3. **The sync and validation tools are clean.** These must run clean: `python3 tools/inline_engine.py --check`, `python3 tools/sync_decks.py --check` and `python3 tools/validate.py` [O: all three are clean on `origin/main`].
4. **Every mutant patch applies.** `python3 tools/refresh_mutants.py --check` prints "all mutant patches apply cleanly; nothing to refresh" [O on `origin/main`].
5. **The operator merges.** Merging is operator-gated.

### Lane O brief: `claude/about-overlay` (wave 1)

**Owns:** the rows marked "Lane O" in the ownership table.

**Objective:** build what sections 4 and 6 of this plan describe, with the owner gates as decided in section 5 (all eight decided by the owner, 2026-10-17).

**TDD order.** Write every test listed below first. Watch each one fail on `origin/main` for the stated reason. Then implement.

**Implementation (anchors, not line numbers)**

1. **Markup.**
   - Add `role="dialog" aria-modal="true" hidden` to `<section id="about" aria-labelledby="about-title">`.
   - Keep the section's opening tag right after `#app`'s closing `</div>`. The test "#app wraps header, main, footer..." asserts that literal.
   - As the section's first child, add `<div class="abouthead">`. It holds `<button type="button" class="mode" id="about-close" aria-label="Back to the practice screen">&larr; BACK</button>` followed by the existing `<h2 id="about-title">`, which moves into it.
   - `#about-close` carries aria-label "Back to the practice screen", the same name as `#scale-back`, so its accessible name contains its visible label BACK [V: the `#scale-back` markup].
   - After the Privacy paragraph, add `<h3>Contact</h3><p><a href="mailto:handpan@raywu.org">handpan@raywu.org</a></p>`.
2. **Menu.**
   - The HANDPAN 101 row is unchanged.
   - After it, as the last row of the Resources group, add `<div class="modebar"><button class="mode" type="button" id="about-open" aria-haspopup="dialog">ABOUT</button></div>`. A plain `.modebar` with one child is full width, like the HANDPAN 101 row.
   - Update the Resources comment above the rows to name the fourth row.
   - `panelStops()` appends `document.getElementById("about-open")` after the `res-` links. This is the order that was probed.
   - ABOUT's stop is defined as "last, after the res- links", independent of share-copy. The readable-share-v5 plan moves COPY LINK out of `#settings-panel` to a main-page share icon. Whichever of the two plans merges second re-counts FLASH_STOPS/PROG_STOPS, the sixteen/seventeen titles and the suite headers of `pm_handpan101_outside_tab_trap` and `uid_panelstops_misses_tier`.
3. **CSS** (placed before `@media print{`, which must stay last).
   - Replace the existing `#about` rule's `flex:none`, `width:100%`, `max-width:520px`, `margin-top:24px` and `padding:0 4px 48px` (keep `color`, `font`, `user-select` and `-webkit-user-select`), so the fixed overlay fills the viewport at every width. The 520px measure comes only from the inline padding below (design re-review F1).
   - `#about` becomes `position:fixed; inset:0; z-index:50; overflow-y:auto; overscroll-behavior:contain; background:#1f1b15`.
   - `#about{padding-bottom:max(48px, calc(var(--sp-4) + env(safe-area-inset-bottom)))}` (design re-review F2).
   - z-index 50 sits above the mobile panel (41), the desktop sidebar (20) and the sheet (30), and below the pan ghost (60) [V: the z-index values in `index.html`].
   - Inline padding is `max(calc(16px + env(safe-area-inset-left)), calc((100% - 520px) / 2))` (and `-right` on the right), so the insets set the minimum and never shrink the 520px column.
   - `.abouthead` is `position:sticky; top:0; display:flex; align-items:center; gap:var(--sp-3)`, on the same background. It holds `#about-close` followed by the `<h2>`, matching `.sheethead`, so the title stays visible while the body scrolls.
   - `.abouthead` has `padding-top:max(var(--sp-3), env(safe-area-inset-top))` and `padding-bottom:var(--sp-3)` on the `#1f1b15` background, and `.abouthead h2{margin:0}` cancels the `#about h2` bottom margin inside the header (design re-review F4).
   - `#about{scroll-padding-top:var(--about-head-h, 0px)}`, where `--about-head-h` is written by `openAbout()` (JS step 4), mirroring `.sheetbody{scroll-padding-top:var(--plate-band-h, 0px)}` and `syncBand()` (design re-review F3). BACK's focus ring stays fully visible and Tab never parks a link under the header.
   - The 44px link rows deliberately loosen the deck list and the Contact gap. `#about h3 + ul` and `#about h3 + p` keep `margin-top:0`, so the heading-to-row gap is only the row's own centring (design re-review F6).
   - `#about ul a, #about a[href^="mailto:"]{display:flex; align-items:center; min-height:44px}` gives each About link a 44px target that does not overlap its neighbours. Padding on an inline link is not used.
   - `#about a` keeps its default underline. Link and body text differ by about 1.5:1 in contrast, so the underline is the only cue that something is a link.
   - Add `html.about-open{overflow:hidden}`.
   - Leave the typography unchanged. Add no `transition` and no `animation`.
   - Leave the print block's `#about{display:none}` unchanged.
4. **JS** (next to `openPanel` and `closePanel`).
   - Add `ABOUT_ROUTE = "#about"` and `let aboutOpen = false`.
   - `openAbout()`:
     - calls `closePanel()`
     - unhides the section and sets `aboutOpen`
     - calls `setInert(true, [#app, #settings-panel])` and adds `html.about-open`
     - calls `pushState({ about: true }, "", ABOUT_ROUTE)`
     - sets `scrollTop = 0` and focuses `#about-close`
     - calls `track("about_open")` with no params (G4)
   - `openAbout()` also writes `--about-head-h` on `document.documentElement` from `.abouthead.offsetHeight`, and rewrites it on `resize` while About is open, mirroring how `syncBand()` writes `--plate-band-h` for `.sheetbody` (CSS step 3 reads it).
   - `hideAbout()` reverses those steps and then focuses `settingsTrigger`, or `#about-open` when `desktopMQ.matches`, because the trigger is `display:none` on desktop.
   - **`hideAbout()` does not call `syncRoute()`** (eng re-review F1). The `popstate` listener syncs only under `pendingPop`, because a fragment navigation fires `popstate` before `hashchange` (test "a pop that follows a fragment navigation leaves the destination hash alone"). A `syncRoute()` inside `hideAbout()` would run on the pop of a typed `#deck=c-sharp-hijaz-9` or a pasted `#s=` while About is open, overwrite that destination with the deck still shown, and the `hashchange` listener's idempotence guard (`location.hash === routeFor(deck())`) would then drop it. The two exits that change the bar sync on their own: `closeAbout()` through the existing `pendingPop` sync at its pop, and `aboutLink()` through its own `syncRoute()`. Nothing else can change the deck while About is open, so a COPY LINK outside the panel (readable-share v5) has nothing to refresh on any other close.
   - BACK, Back and Escape return to the practice screen with the deck, card, mode and scroll position unchanged and the settings menu closed, as `+ ADD A SCALE` does. Focus goes to the settings trigger (or to `#about-open` in the desktop sidebar, which stays open).
   - `closeAbout()` calls `hideAbout()`, sets `pendingPop = true` and calls `history.back()`, exactly like `closeScaleSheet()`. The bar is synced by the `popstate` listener's existing `pendingPop` branch at that pop, not by `hideAbout()`.
5. **Routing.**
   - `syncRoute()` and the `hashchange` listener return early while `aboutOpen` is true. Put each guard beside the existing `sheetOpen` guard.
   - The `popstate` listener closes an open About after its `pendingPop` branch. That branch calls `hideAbout()` only: no `syncRoute()` and no second `back()`. On a plain Back the restored hash is already the shown deck's route, so the following `hashchange` is a no-op; on a typed or pasted fragment, the following `hashchange` (no longer guarded, because `aboutOpen` is now false) routes the destination. AO app test 14 pins this.
   - When About is closed and the hash is `ABOUT_ROUTE` (a Forward traversal onto a stale entry), the `popstate` listener calls `syncRoute()`.
   - Insert both About branches immediately after the `pendingPop` branch and BEFORE `if (!sheetOpen) return;`, so they run while no sheet is open.
   - The hashchange `aboutOpen` guard is defensive (popstate closes About first on a real traversal). An AO app test (4) asserts it via the sandbox `hashchange()` helper with `aboutOpen` forced true.
   - Extract the deck branch of the `hashchange` listener into `routeToDeck(routed)`, which returns the id of the deck shown. The listener and `aboutLink(href)` both call it.
   - A click on `#about a[href^="#deck="]` calls `preventDefault()` and then `aboutLink(href)`.
   - `aboutLink(href)` first resolves the link to a deck id. Compare resolved ids, not route strings.
     - If it is the deck already shown, call `closeAbout()`.
     - Otherwise call `hideAbout()`, then `replaceState(null, "", href)`, then `routeToDeck`, then `syncRoute()`.
     - When the link's slug resolves through `fallbackDeck()` (a hidden seed with no replacement), route it through the different-deck path so the "That deck is gone." warning still fires.
6. **Keyboard.** In the `document` keydown handler, add an `if (aboutOpen)` block before `if (sheetOpen)`.
   - Escape calls `closeAbout()`.
   - Tab runs `cycleTabStops(aboutStops(), e)`.
   - Define `aboutStops()` as [#about-close, the five `#deck=` anchors, the mailto anchor] in DOM order, filtered by `isStop`. Tab and Shift+Tab cycle it through `cycleTabStops`.
   - Every other key returns, so no arrow key reaches the card.
7. **Boot.** No change. `#about` is not a deck route, so the existing boot `syncRoute()` replaces it (G3).
8. **Sandbox.** In `tools/sandbox.js`, add `about`, `about-open` and `about-close` to `ELEMENT_IDS`, because `getElementById` throws on unknown ids.
9. **Panel-fit oracle** (`tools/probe/panel_fit.js`, beside `RES_ALLOWANCE_PX`). The ABOUT row does not fit the existing oracle, so this is the smallest change that admits it (see "Panel fit" below).
   - Add `const ABOUT_ALLOWANCE_PX = 52;` and `aboutAllowance(baseControls, candControls)`, which returns 52 only when the candidate has `about-open` and the base lacks it. Export both.
   - Rule 1 adds it to the fit bound beside `resA`.
   - Rule 3 uses `b.needed + aboutA` as the bound for the key `about-open` only, as it does `resA` for `res-` keys.
   - Rule 2 and every other control are judged exactly as before. The allowance expires once main has the row.

**Acceptance: tests added to `tests/app.test.js`** (new describe "about overlay")
1. "AO: the about section ships hidden as a dialog, in place after #app, with every existing sentence"
2. "AO: ABOUT closes the panel, pushes one #about entry, inerts #app and the panel, and focuses the exit"
3. "AO: the exit control, Escape and a popstate each close About, consume the #about entry and focus the settings trigger"
4. "AO: syncRoute and hashchange write nothing while About is open"
5. "AO: a #deck= link inside About replaces the #about entry with the deck's route and selects the deck"
6. "AO: a #deck= link to the deck already shown closes About like the exit control"
7. "AO: a boot on #about leaves About closed and ends on the deck's route"
8. "AO: a Forward traversal onto #about leaves About closed and rewrites the bar"
9. "AO: About ends with a Contact heading and a mailto link to handpan@raywu.org"
10. "AO: ABOUT is the last panel stop, a full-width button alone in the last Resources row"
11. "AO: opening About tracks about_open with no params" (G4, owner 2026-10-17: it asserts one `about_open` event and that the event carries no params)
12. "panel fit: the About-row allowance is 52, owed only for an about-open control the base lacks"
13. "panel fit rule 1 and rule 3: a new about-open earns the About-row allowance and nothing else does"
14. "AO: a fragment navigation while About is open closes About and leaves the destination hash for hashchange" (eng re-review F1). With About open, set the location to `#deck=c-sharp-hijaz-9`, call `popstate()`, and assert About is closed, the hash is unchanged and no history call was made; then call `hashchange()` and assert Hijaz is shown. It sits beside "a pop that follows a fragment navigation leaves the destination hash alone", which it extends to the About-open case.
15. "panel fit rule 2: the About-row allowance does not move any existing control" (eng re-review N2), mirroring "panel fit rule 2: the Resources allowance does not move any existing control".

Tests 12, 13 and 15 go in the "panel fit judge" describe of `tests/app.test.js`, beside the three `res-` rule tests ("panel fit rule 1: a new res- control earns the Resources allowance and nothing else does", "panel fit rule 3: a new res- control may sit below avail within the Resources allowance, any other new control may not", "panel fit rule 2: the Resources allowance does not move any existing control") and "panel fit: the Resources allowance is 64, owed only for a res- control the base lacks". Test 13 covers rule 1 and rule 3 in one title; test 15 covers rule 2.

AO app tests 5 and 6 call `aboutLink(href)` directly. The click delegation and preventDefault path is covered only by AO e2e 5, and the lane's reviewer brief says so. The reason is that the sandbox `queryAll` cannot see anchor nodes.

**Acceptance: tests added to `tests/e2e.test.js`** (new describe "about overlay"; 380x800 unless another size is named)
1. "AO: at 380px ABOUT opens a full-screen About, the panel is closed, the app is inert and covered, and focus is on the exit"
2. "AO: at 380px the exit control restores the deck, card, flip state, mode and scroll, with focus on the settings trigger"
3. "AO: at 380px Back closes About and one more Back leaves the page's history as it was before ABOUT"
4. "AO: at 380px Escape closes About and arrow keys never step the card while it is open"
5. "AO: at 380px a #deck= link inside About switches deck and one Back returns to the previous deck"
6. "AO: the page behind About does not scroll, at 380x800 and 844x390"
7. "AO: About scrolls with its exit visible, non-overlapping 44px link targets and no horizontal scroll at 380x800, 844x390 and 1280x800". It measures the mailto link as well as the five deck links, and asserts that no two link rects overlap.
8. "AO: About has no transition or animation with and without prefers-reduced-motion"
9. "AO: at 1280x800 the sidebar's ABOUT opens About and closing returns focus to ABOUT"
10. "AO: the About content box is at least min(520, viewport - 32)px wide at 380x800 and 1280x800" (design re-review F1). It measures `#about`'s content box (client width less computed inline padding) and asserts it is at least `min(520, innerWidth - 32)`, so a leftover `max-width:520px` on the fixed overlay, which would let the inline padding shrink the column below 520 at 1280, goes red.

**Acceptance: tests changed (8)**
1. e2e "the about section is visible below the card at 380px with no horizontal scroll" becomes "the about section is not rendered on / and its text is in the served HTML". Its only mutant, `nm_about_hidden`, is rewritten (see Mutants below).
2. e2e "the card keeps its origin/main size with the about section below the first screen" becomes "the card keeps its origin/main size and position with About off the first screen".
   - The `ORIGIN_SCENE` pins stay. The `scrollHeight > innerHeight` check and the `#about` top check go.
   - The new title keeps the prefix `^the.card.keeps.its.origin.main.size`, which `nm_app_wrapper_flexes` and `nm_announce_outside_app` select.
3. e2e "clicking an about-section deck link on / switches the deck without a reload" becomes "clicking a deck link inside the open About switches the deck without a reload".
4. e2e `FLASH_STOPS` gains `"about-open"` after `...RES_IDS`. So "Tab cycles exactly the sixteen flash-card stops in the modal at every viewport class" becomes "...seventeen...".
5. For the same reason, "Tab cycles exactly the seventeen progression stops in the modal at every viewport class" becomes "...eighteen...".
6. app "PM rule 7: HANDPAN 101 is the last Resources link, a Google Doc in a new tab, alone in its row" keeps its title, which stays true. Its "three modebar rows" assertion becomes four rows, and a new assertion says the fourth row holds `#about-open` and no `<a`. Its mutant's suite pattern `PM.rule.7` still matches.
7. Changed: `AP2-2 setInert applies each caller's own background set`. Adding `about` to the sandbox ELEMENT_IDS makes `#about` resolve, so the expected `background` ids become ['settings-panel','about','main'] and `panelBackground` ids gain 'about'. The inert-set expectations after openScaleSheet()/openPanel() gain 'about' likewise. Re-run tests/mutants/ap2_panel_inerts_the_sheet_set.patch to confirm it is still killed. The engineering review proved that AP2-2 goes red when `about` is added to ELEMENT_IDS. The title does not change.
8. e2e "the settings panel has exactly one Resources group with its six outbound links in three rows" keeps its title, because four mutant headers anchor it with `^...$`. Its `rowSizes` expectation becomes `[3, 2, 1, 0]`, with the message "three link rows, then the ABOUT row with no link".

**Acceptance: tests that stay untouched and green (16)**
- app:
  - "#about is in both inert lists and #app in neither"
  - "#app wraps header, main, footer and the live region in that order, and #about follows it before the sheet"
  - "the about section names every built-in deck with its card count from data/decks.json and the value line"
  - "the about section links every built-in deck by its slug"
  - "the JSON-LD block parses and states only what the page shows" (if G5 is keep)
  - "hashchange to a deck link selects that deck and clears the hash"
  - "a pop that follows a fragment navigation leaves the destination hash alone"
  - "SU: syncRoute is idempotent"
- e2e:
  - "Tab is trapped inside the settings panel and cycles every stop, wrapping both ways"
  - "the sidebar's native Tab order is the panel's DOM order"
  - "a #deck= link opens that deck at 380px and the address bar keeps the deck's own route"
  - "Back and Forward between two deck routes show each deck in turn"
  - "main, footer and the deck strip are inert and aria-hidden while the settings panel is open, and restored on close"
  - "switching to mode S keeps the header and footer width fixed and grows the footer only by the style block"
- python:
  - `tests/test_site_files.py` (all five tests, counted as one entry)
  - `tests/test_render_agreement.py::test_print_block_is_last_in_the_style_element`

**Panel fit** [O: macOS Chrome, `--font both`, every cell the oracle measures: 2673 width x height rows x 3 modes per font]
- Measured growth of the ABOUT row, candidate `needed` minus base `needed`, identical for real and fallback fonts:
  - 47px in the h320-520 band
  - 48px in the h521-699 band
  - 50px at h700 and above (mode S, 640-1025 wide, and the sidebar widths)
  - the largest shortfall at a threshold height is 50.1px (1024x712 mode S real, 1024x707 fallback)
- Unmodified oracle: FAIL. Rule 1 fails 9356 cells (real) and 9600 (fallback); rule 3 fails 4447 and 4505.
- 50px is inside the 64px Resources allowance in size, but that allowance does not apply: `isRes` matches only `res-` ids, and CLAUDE.md says it admits `res-*` controls "and nothing else". So the row does NOT fit the oracle as it stands.
- With the allowance applied to `about-open` (a local experiment, reverted): PASS at 49, 50, 51, 52 and 64; FAIL at 48 (398 cells per font, 640x700 S, 708 / 658 / 700), 47, 46 and 45.
- The change is item 9 above. 52 is the measured 50px plus 2px for Linux font rounding, as AD7 set 64 over a measured 60.4. The row is a 44px button plus a gap, which is why both font modes measure the same.
- Rejected: renaming the button `res-about` to ride the 64px allowance. It mislabels an in-app view as an outbound resource (D8) and grants 14px more than the row needs.
- Tests that pin the new limit, in `tests/app.test.js` beside "panel fit: the Resources allowance is 64, owed only for a res- control the base lacks":
  - "panel fit: the About-row allowance is 52, owed only for an about-open control the base lacks"
  - "panel fit rule 1 and rule 3: a new about-open earns the About-row allowance and nothing else does"
  - "panel fit rule 2: the About-row allowance does not move any existing control"

**Mutants**

Use the `ao_` prefix, because `ab_` is taken. In `# suite:` patterns, use `.` wildcards, never quotes.

New patches:
- `ao_open_keeps_panel_open`
- `ao_exit_not_focused`
- `ao_close_focus_lost`
- `ao_background_not_inert`
- `ao_syncroute_writes_under_about`
- `ao_hashchange_under_about`
- `ao_deck_link_pushes`
- `ao_same_deck_link_replaces`
- `ao_escape_ignored`
- `ao_forward_leaves_about_hash`
- `ao_page_scrolls`
- `ao_transition_added`
- `ao_contact_not_mailto`
- `ao_open_not_a_stop`
- `ao_open_untracked`
- `ao_fit_about_allowance_grown` (52 becomes 64)
- `ao_fit_about_allowance_ungated` (the allowance is owed whether or not the base has the row)
- `ao_fit_about_allowance_all_controls` (rule 3 gives every new key `b.needed + aboutA`, not only `about-open`; killed by AO app test 13), mirroring `mr_fit_res_allowance_all_controls`
- `ao_fit_about_allowance_on_rule_2` (rule 2 adds `aboutA`; killed by AO app test 15), mirroring `mr_fit_res_allowance_on_rule_2`
- `ao_pop_syncs_under_fragment_nav` (`hideAbout()` calls `syncRoute()`, so the About-open `popstate` branch overwrites a typed destination; killed by AO app test 14)
- `ao_about_width_capped` (the `#about` rule keeps `max-width:520px`; killed by AO e2e 10)

Rewrite `nm_about_hidden.patch` in place. It now drops `hidden` from the section and kills AO app test 1. The patch count does not fall, so the README mutant-count band test stays green.

Hand-edit two `# suite:` headers:
- `pm_handpan101_outside_tab_trap`: change `sixteen` to `seventeen`.
- `uid_panelstops_misses_tier`: change `seventeen` to `eighteen`.

Then run `python3 tools/refresh_mutants.py`, followed by `python3 tools/refresh_mutants.py --check`.
- These patches are expected to go stale, because their hunks sit in the edited regions. The tool decides which ones actually need a refresh.
  - `nm_about_drops_a_deck`
  - `nm_app_wrapper_flexes`
  - `pm_handpan101_not_last`
  - `pm_handpan101_same_tab`
  - `pm_handpan101_outside_tab_trap`
  - `qr_res_link_not_a_stop`
  - `mr_stops_omit_amy`
  - `uid_panelstops_misses_tier`
  - `su_hashchange_ignores_sheet_open`
  - `dq_route_no_hashchange`
  - `su_popstate_sync_unconditional`
  - `su_pop_not_synced`
  - `mr_fit_res_allowance_ungated`, `mr_fit_res_allowance_grown`, `mr_fit_res_allowance_all_controls`, `mr_fit_res_allowance_on_rule_2` and `r4h_judge_rule1_never_fires`, whose hunks sit beside the edited allowance lines and the rule 2 and rule 3 conditions in `judgeCell` in `tools/probe/panel_fit.js`
- If the tool cannot re-anchor a patch, rewrite that patch against a more stable anchor.

**FLOORS** (`tests/suite_health.py`)
- Raise only the `tests/app.test.js` row (561 today) and the `tests/e2e.test.js` row (314 today).
- Set each from the executed-test count that CI reports for that file in the lane's own run artifacts at the head SHA, not from the old row plus the number of tests added. The rows drift under parallel lanes. Expect roughly 576 (561 + 15) and 324 (314 + 10).
- If scale-import lane A1 merges between lane O's branch point and its merge, whichever of O and A1 merges second resets FLOORS from its own CI artifacts (section 7, "Sequencing with other plans").

**Verify**
- The one Verify command is `node --test --test-name-pattern "AO: |about|About-row|PM rule 7" tests/app.test.js`. It starts on `origin/main` [O: 6 tests, 6 pass]. `About-row` selects the three panel-fit tests, whose titles capitalise About.
- Run e2e tests locally one at a time (single tests start on `origin/main` [O]).
- Verify also runs each new AO e2e title singly with CHROME_BIN set. CI at the head SHA is the evidence for the e2e suite.
- Also run `node tools/probe/panel_fit.js --base origin/main --font both`. It must print "panel fit: PASS" with the allowance in place.
- CI at the head SHA is the evidence.

**Non-goals.** The plan non-goals, plus:
- no change to `panelBackground` or the sheet's `background` list
- no change to the `#app` wrapper

**Reviewer brief (lane O)**
- Inputs: the branch, base `origin/main`, the verified head SHA, this lane brief verbatim, and the ownership table.
- Check out the SHA in a `review-about-overlay` worktree.
- Run `/review` read-and-report only, with every Bash call prefixed `OPENCLAW_SESSION=1`.
- Read CI's run conclusion at that SHA.
- Mutant budget: 5, because the lane changes the harness (`tools/sandbox.js`). Spend it on the history paths: the same-deck link, Forward onto `#about`, and Back after a deck link.
- AO app tests 5 and 6 call `aboutLink(href)` directly. The click delegation and preventDefault path is covered only by AO e2e 5, so judge that path by AO e2e 5 at the head SHA.
- A FAIL needs a concrete failure scenario.

### Lane D brief: `claude/about-docs` (wave 2, after lane O merges)

**Owns:** the rows marked "Lane D" in the ownership table.

**Objective**
- Rewrite CLAUDE.md "Discoverability" > "About section" to describe the overlay.
- Add ABOUT and its own fourth row to the "Menu Resources" bullet.
- Add `about_open` to the Analytics bullet.
- In "Menu Resources", replace "The CI `panel-fit` oracle allows `res-*` controls 64px of growth and nothing else" with a sentence that also names the 52px About-row allowance and its two tests.
- Restate the supersessions listed below.
- Update README's About sentence.
- Add a dated supersession note at the top of the discoverability plan.
- Every sentence names the test that proves it. Copy the test titles from the merged files, not from this plan.

**Supersessions to record**
- **S13, section 4 ("No `display:none`").** Replaced by: the About text stays in the served HTML of `/`, in its original position, and renders only while the overlay is open.
- **D10 (position).** The markup position stands, so the served order is unchanged. The section no longer renders in the page flow.
- **D20 (`#app` wrapper).** Stands, and the card-size test still pins it. Its reason (About as a fourth flex child of `body`) is gone.
- **D21 (in-page `#deck=` links).**
  - The `hashchange` listener stands for typed and external fragments.
  - Links inside About go through `aboutLink()`, which shares `routeToDeck()` with the listener.
  - The discoverability plan calls this function `routeDeck()`, a name that does not exist on main.
- **D22 (classic scrollbars).** Moot, because the page no longer scrolls to About.
- **Section 6, the "visible" claim for `isAccessibleForFree`.** Replaced by the outcome of G5.

**Acceptance**
- Each test title quoted in a new sentence matches exactly once when grepped in `tests/`.
- `python3 -m unittest tests.test_readme_currency` passes.

**Verify:** `python3 -m unittest tests.test_readme_currency`. It starts and passes on `origin/main` [O].

**Non-goals:** no code, test or mutant change.

**Reviewer brief (lane D)**
- Re-verify every sentence against the merged code and tests.
- Mutant budget: 10, because the lane adds no harness. Mutate each claimed behaviour and confirm that its named test goes red.

### E2E coverage at 380px (required set)

| Behaviour | AO e2e test |
|---|---|
| Open | 1 |
| Exit | 2 |
| Back | 3 |
| Escape | 4 |
| A `#deck=` link | 5 |
| Focus return | 2 (and 9 on desktop) |

## 5. Owner gates

Every gate is decided (owner, 2026-10-17).

| Gate | Question | Options | Recommended | Decision |
|---|---|---|---|---|
| G1 | Menu placement and label | `ABOUT` beside HANDPAN 101 in the last Resources row (probed, zero growth) / its own row at the end of the panel / a header button (costs first-screen space) | Beside HANDPAN 101, labelled `ABOUT` | **Decided (owner, 2026-10-17): its own full-width row at the end of the panel, labelled `ABOUT`.** It grows the panel 47-50px and needs the 52px About-row allowance (section 4, "Panel fit"). Note: closing About leaves the settings menu closed, as `+ ADD A SCALE` does |
| G2 | Exit control | `← BACK` (matches `#scale-back`) / `CLOSE` / an X icon | `← BACK`, with aria-label "Back to the practice screen" (as `#scale-back`) | **Decided (owner, 2026-10-17): as recommended.** BACK, Back and Escape all return to the practice screen with the menu closed |
| G3 | Reload or pasted `/#about` | Show the app and rewrite the bar to the deck route (as `#add` does) / reopen About at boot | Show the app | **Decided (owner, 2026-10-17): show the app** |
| G4 | Analytics | `about_open` with no params / no event | `about_open` (once About is hidden, it is the only signal that About is read) | **Decided (owner, 2026-10-17): add `about_open` with no params**, pinned by AO app test 11 and `ao_open_untracked` |
| G5 | "free" in the JSON-LD | Keep `isAccessibleForFree` and `offers` (the fact is one tap away, and no rich result is at stake, E11) / drop both | Keep | **Decided (owner, 2026-10-17): keep** |
| G6 | Spam protection for the address | Plain `mailto:` in the served HTML / assembled by JS (invisible to crawlers and no-JS readers) / entity-encoded (cosmetic) | Plain `mailto:` | **Decided (owner, 2026-10-17): plain `mailto:`** |
| G7 | Address in the JSON-LD | No (WebApplication has no email property unless a Person or Organization entity is added; no SEO gain) / add `author.email` | No | **Decided (owner, 2026-10-17): no** |
| G8 | Static About page (Option C) | Defer to the landing-page wave / build now | Defer | **Decided (owner, 2026-10-17): defer** |

**Copy note.** `ABOUT`, `← BACK`, "Back to the practice screen" (reused from `#scale-back`) and the "Contact" heading are control labels, plus a heading that the owner brief's Contact line implies. No other copy changes.

## 6. UX and design spec

**Wireframes**

380x800 portrait, About open (the app behind is covered and inert):
```
+------------------------------------+
| [<- BACK]  About Handpan Chords    |  sticky .abouthead: flex, gap --sp-3,
|                                    |  44px BACK + Marcellus 22px, top inset
|------------------------------------|
| A free chord and progression ...   |  Nunito Sans 14/1.6, #c4bcab
| HOW IT WORKS                       |  600 11px caps, #a79d8b
| 1. Pick a built-in deck ...        |
| BUILT-IN DECKS                     |
| - D Kurd 10: 49 chord cards        |  links #eae6df
| ...                                |
| PRIVACY ...                        |
| CONTACT                            |
| handpan@raywu.org                  |  mailto link
+------------------------------------+   16px side gutters; scrolls inside
```

380x800 settings panel, foot of the Resources group (closed About):
```
| RESOURCES                          |
| [HANDPANER] [HANDPAN.CO] [HTC]     |  trio, unchanged
| [AMY: PROGRESSIONS][AMY: BOTTOM ..]|  duo, unchanged
| [         HANDPAN 101            ] |  full width, unchanged
| [            ABOUT               ] |  NEW own row, full width, last stop
+------------------------------------+
```

844x390 landscape phone:
- The same 520px column, centred by the inline padding (the overlay itself has no `max-width`).
- Safe-area insets on the left and right.
- The sticky row (BACK and the title) stays on screen, and the body scrolls inside `#about`.

1280x800 desktop:
- The overlay covers the sidebar too. z-index 50 sits above the mobile panel (41), the desktop sidebar (20) and the sheet (30), and below the pan ghost (60).
- The 520px column is centred, with `BACK` and the title on one row at its top left.

**Exit control**
- `#about-close`, with class `mode`: border `#433b2c`, background `#211d16`, `600 10.5px` Nunito Sans, `min-height:44px`.
- It sits in a sticky `.abouthead` beside the title, matching `.sheethead`, so both stay visible.
- Its accessible name is "Back to the practice screen", as on `#scale-back`.
- Escape and Back do the same thing as the button.

**Tokens and fonts**
- Surface `#1f1b15` and hairline `#433b2c`, the same as the sheet.
- `--sp-*` spacing.
- Marcellus for the heading; Nunito Sans for the body and labels.
- Bitter is not used, because About has no note lines.
- No new colours.

**Targets**
- `#about-open`, `#about-close`, the five deck-list links and the mailto link are at least 44px tall.
- The links get there through `display:flex; align-items:center; min-height:44px`. Padding on an inline link is not used, because in the design review's render it made neighbouring targets overlap.
- AO e2e 7 measures all six links and asserts that no two link rects overlap.

**Links.** `#about a` keeps its default underline. Link and body text differ by about 1.5:1 in contrast, so the underline is the only cue that something is a link.

**Scroll**
- `html.about-open{overflow:hidden}` locks the page behind.
- `#about` scrolls on its own, with `overscroll-behavior:contain`.
- The window's `scrollY` is identical after close (AO e2e 2 and 6).

**Motion.** None. About appears and disappears instantly, like the sheet and the panel, so reduced motion holds in both settings (AO e2e 8).

**Keyboard and screen readers**
- `#about-title` names the dialog.
- Focus lands on BACK when About opens.
- Tab cycles through BACK, the deck links and the mailto link.
- Escape closes About.
- The background is `inert` and `aria-hidden`.
- Tab order is `aboutStops()`: BACK, the five deck links, then the mailto link, in DOM order. `scroll-padding-top` keeps a focused link clear of the sticky header.
- On close, the deck, card, mode and scroll are unchanged and the settings menu is closed, as `+ ADD A SCALE` does.
- Focus returns to the settings trigger. On desktop, where the trigger is hidden and the sidebar stays open, it returns to ABOUT.

**Menu row**
- ABOUT has its own plain `.modebar` row, the last row of the Resources group and the last thing in the panel. It is full width, like HANDPAN 101 above it.
- It is a button with `aria-haspopup="dialog"`, class `mode`, and the panel's centred label.
- The HANDPAN 101 row is unchanged.
- No Resources control carries a visible outbound cue; ABOUT differs from the res-* links only by aria-haspopup="dialog" and opening in place.

## 7. Risks, rejected alternatives, what would change this, unverified claims

**Risks**
- **Google could discount text that is hidden when the page renders [A].** Mitigation: the served text is unchanged, and E1 and E2 allow toggled content.
- **A Forward traversal onto a stale `#about` entry could strand the address bar.** AO app test 8 covers this. The `#add` sheet has the same pitfall today, and it is out of scope here.
- **Accepted: one Back press can be a no-op.** After Forward onto a stale #about, or a reload of #about, the replaced entry duplicates its predecessor, so one Back press is a visible no-op. AO e2e 3 asserts the shown deck and the bar, not history.length.
- **Merge order with readable-share v5.** That plan moves COPY LINK out of `#settings-panel`. Whichever plan merges second re-counts the panel stops, titles and suite headers (implementation step 2).
- **Sequencing with scale import and share v5.** Scale-import lane B never runs in the same wave as About lane O (both own index.html app JS, ELEMENT_IDS, app/e2e tests and their FLOORS rows); lane A1 may run beside O since it touches only the engine region, its two module lists and its own FLOORS row, and whichever of O and A1 merges second resets FLOORS from its own CI artifacts; share v5 starts after O and D (PR #335 §4.1).
- **A sync on the About-open pop would eat a typed fragment.** `hideAbout()` therefore never calls `syncRoute()` (implementation step 4); AO app test 14 and `ao_pop_syncs_under_fragment_nav` pin it.
- **iOS Safari may handle the scroll lock differently from Chrome [A].** The app is inert and covered, so a leaked scroll is invisible and is undone on close.

**Rejected alternatives**
- `hidden="until-found"`: it would reveal the text in the page flow, not as an overlay.
- A `<dialog>` element with `showModal()`: the sandbox has no `HTMLDialogElement`, and the sheet's tested pattern already handles inert, focus and Escape.
- Reopening About on a pasted link (G3): it can be added later at small cost.

**What would change the recommendation**
- A primary Google statement that content in an overlay or modal is discounted would favour C.
- An owner request for an indexable About URL would also favour C.
- A CI panel-fit failure on Linux at more than 52px would mean re-measuring there and raising the About-row allowance to the CI figure, with the pinning test changed in the same commit.

**Claims not verified, and why**
- **How Google weighs text hidden until a tap.** No primary source covers overlays. The accordion analogy is [A].
- **`routeDeck()`.** The task brief and the discoverability plan both name it, but it does not exist on `origin/main`. The real code is `routedDeckId()` plus the deck branch of the `hashchange` listener.
- **Real devices and assistive technology.** Real iOS Safari, Android Chrome and screen readers were not tested. The harness is Chrome with emulated viewports.
- **Fonts in the panel-fit probe.** The 47-50px growth was measured with macOS fonts. The CI `panel-fit` job on Linux is the evidence. Both font modes measured the same growth here, so a large Linux difference is unlikely [A].
- **The FLOORS figures 576 and 324.** They assume the test list above lands as written and no other lane moves the rows first.

## 8. Quality score

**Adversarial pass: the seven likeliest ways a lane fails, and the fix in this plan**
1. **A same-deck link leaves a duplicate entry and needs a double Back.** Fix: compare resolved ids, not route strings. AO app test 6 and the `ao_same_deck_link_replaces` mutant pin it.
2. **The rewritten `nm_about_hidden` or a renamed test leaves a mutant that selects zero tests, which shows up as a false survivor.** Fix: keep title prefixes, hand-edit the `sixteen` and `seventeen` headers, and use `.` wildcards.
3. **A new `getElementById` call throws in the sandbox.** Fix: implementation step 8 adds the three ids to `ELEMENT_IDS`.
4. **Focus is lost on close on desktop, where the trigger is `display:none`.** Fix: the `desktopMQ` branch in `hideAbout()`, tested by AO e2e 9.
5. **The `#app wraps...` literal breaks if the section's opening tag moves.** Fix: step 1 keeps the tag right after `</div>\n\n`, and the app test "#app wraps ..." stays untouched.
6. **The About `popstate` branches sit after `if (!sheetOpen) return;` and never run.** Fix: step 5 places them before that guard (eng review N2).
7. **A `syncRoute()` in `hideAbout()` overwrites a typed or pasted fragment on the pop that precedes its `hashchange`.** Fix: `hideAbout()` never syncs; `closeAbout()` relies on the `pendingPop` sync and `aboutLink()` syncs itself (eng re-review F1). AO app test 14 and `ao_pop_syncs_under_fragment_nav` pin it.

**Rubric** (restated for this score; every row must reach 10/10)

| Row | Score | Evidence |
|---|---|---|
| Evidence | 10 | Eleven primary Google quotes with URLs and marks; every [A] is named |
| Repo accuracy | 10 | Every function, test title and mutant was grepped on `origin/main`; `routeDeck()` is flagged as absent. The first draft missed AP2-2 and the `popstate` guard position, and the second had `hideAbout()` breaking the `pendingPop`-only sync invariant; all three review findings are now fixed in the plan |
| Owner fidelity | 10 | Each brief item maps to a spec line and a test: exit, Back, Escape, focus, scroll, `#deck=`, reload, `syncRoute`, motion, 380px and landscape, Contact |
| UX completeness | 10 | Three wireframes; exit control, tokens, targets, scroll, motion, keyboard and screen reader, menu row |
| Testability | 10 | 25 named new tests (15 app, 10 e2e), 21 new mutants, 8 changed and 16 named as untouched; the one Verify command was observed starting; the click-delegation path the sandbox cannot see is assigned to AO e2e 5 |
| Swarm shape | 10 | Two lanes, one in flight, disjoint ownership, briefs that can be lifted verbatim; wave rules against scale-import lanes A1 and B and share v5 stated |
| Regression safety | 10 | Stale mutants named, patch count kept, FLOORS rows set; the own-row growth measured in every oracle cell with both fonts, the oracle FAIL stated, and the one scoped allowance that admits it bracketed (49 passes, 48 fails) and pinned by three tests and four mutants, mirroring the four `mr_fit_res_allowance_*` mutants |
| Design quality | 10 | Reuses the sheet surface, the `.sheethead` layout, `#scale-back`'s accessible name, `.mode` and the sheet's history pattern; no new tokens. The first draft's overlapping link targets and inset-shrunk column were fixed after the design review; the re-review's full-width overlay (pinned by AO e2e 10), bottom safe-area padding, measured header scroll padding, header spacing and list rhythm are specified |
| Decisions | 10 | Eight gates, all decided by the owner on 2026-10-17 and recorded with the recommendation they answered; every supersession has a replacement rule |
| Concision | 10 | One recommendation, one table per question, no restated background |
