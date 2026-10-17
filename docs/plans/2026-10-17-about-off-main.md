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
- Only a new `ABOUT` button (`#about-open`) opens it. The button sits beside HANDPAN 101 in the last Resources row.
- Opening About pushes one `#about` history entry. The exit control, Escape and Back each consume that entry and return the app untouched.

Why A:
- **The served HTML of `/` keeps everything it has today.** That is the whole About text, its five `<a href="#deck=...">` links and the JSON-LD. A curl of `/` sees more than today, because the Contact line is added [O: the 140 served About words stay in the file]. Google lists content that a toggle hides as something that does "not violate our policies" [V, section 2].
- **It reuses a pattern that already works.** The scale sheet already does this with `showSheet`, `closeScaleSheet`, `pendingPop`, the `popstate` listener, `setInert` and `cycleTabStops` [V].
- **`#deck=` links still switch decks in place, without a reload.** Option B loses this.
- **There is no new file.** Nothing changes in the sitemap, and nothing risks the single-file constraint.
- **The ABOUT button does not grow the panel.** I probed this exact markup and stop order with `node tools/probe/panel_fit.js --base origin/main --font both --workers 2`. It printed "panel fit: PASS" for real and fallback fonts. No rule failed, and no viewport where the base fits made the candidate overflow [O].

The alternatives are B (a static `about.html` page) and C (A plus that page). Both are compared in section 3. C stays open as a later owner gate (G8).

**Confidence**
- High on UX and testability. The pattern exists in the repo and the panel fit was measured.
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
| Analytics | Optional `about_open` event (G4) | Needs a GA loader on a second page, or none | Both |
| Single-file constraint | Kept; no new file | A sibling file is allowed, but it duplicates CSS and fonts | As B |
| Tests changed | 6 existing tests changed, 20 added, 3 sandbox ids | Site-file tests, a new test file for the page, the About tests moved | Both sets |
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

**Cost**
- Two author runs and two reviewer runs.
- Lane O will likely bounce once, which adds one author run and one reviewer run.
- That is about six subagent runs and three to four full CI runs. No time estimate is given.

### Ownership (no file has two owners in a wave)

| Path | Lane O | Lane D |
|---|---|---|
| `index.html`: About CSS, `#about` markup, the last Resources row, About JS, the `syncRoute` and `hashchange` guards, the `popstate` branch, the `document` keydown branch | owns | - |
| `tools/sandbox.js` (`ELEMENT_IDS` only) | owns | - |
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

**Objective:** build what sections 4 and 6 of this plan describe, with the owner gates as decided. Until the owner answers, use the "Default while unanswered" column of section 5 (the recommended options, except G4).

**TDD order.** Write every test listed below first. Watch each one fail on `origin/main` for the stated reason. Then implement.

**Implementation (anchors, not line numbers)**

1. **Markup.**
   - Add `role="dialog" aria-modal="true" hidden` to `<section id="about" aria-labelledby="about-title">`.
   - Keep the section's opening tag right after `#app`'s closing `</div>`. The test "#app wraps header, main, footer..." asserts that literal.
   - As the section's first child, add `<div class="abouthead"><button type="button" class="mode" id="about-close" aria-label="Close About">&larr; BACK</button></div>`.
   - After the Privacy paragraph, add `<h3>Contact</h3><p><a href="mailto:handpan@raywu.org">handpan@raywu.org</a></p>`.
2. **Menu.**
   - The HANDPAN 101 row `<div class="modebar">` becomes `<div class="modebar duo">`.
   - Add `<button class="mode" type="button" id="about-open" aria-haspopup="dialog">ABOUT</button>` after `#res-handpan-101`.
   - `panelStops()` appends `document.getElementById("about-open")` after the `res-` links. This is the order that was probed.
3. **CSS** (placed before `@media print{`, which must stay last).
   - `#about` becomes `position:fixed; inset:0; z-index:50; overflow-y:auto; overscroll-behavior:contain; background:#1f1b15`.
   - Its inline padding is `max(16px, calc((100% - 520px) / 2))`, plus the left and right safe-area insets.
   - `.abouthead` is `position:sticky; top:0`, on the same background, with the top safe-area inset.
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
     - calls `track("about_open")` if G4 is yes
   - `hideAbout()` reverses those steps. It then focuses `settingsTrigger`, or `#about-open` when `desktopMQ.matches`, because the trigger is `display:none` on desktop.
   - `closeAbout()` calls `hideAbout()`, sets `pendingPop = true` and calls `history.back()`, exactly like `closeScaleSheet()`.
5. **Routing.**
   - `syncRoute()` and the `hashchange` listener return early while `aboutOpen` is true. Put each guard beside the existing `sheetOpen` guard.
   - The `popstate` listener closes an open About after its `pendingPop` branch. It calls `hideAbout()` and does not call `back()` a second time.
   - When About is closed and the hash is `ABOUT_ROUTE` (a Forward traversal onto a stale entry), the `popstate` listener calls `syncRoute()`.
   - Extract the deck branch of the `hashchange` listener into `routeToDeck(routed)`, which returns the id of the deck shown. The listener and `aboutLink(href)` both call it.
   - A click on `#about a[href^="#deck="]` calls `preventDefault()` and then `aboutLink(href)`.
   - `aboutLink(href)` first resolves the link to a deck id. Compare resolved ids, not route strings.
     - If it is the deck already shown, call `closeAbout()`.
     - Otherwise call `hideAbout()`, then `replaceState(null, "", href)`, then `routeToDeck`, then `syncRoute()`.
6. **Keyboard.** In the `document` keydown handler, add an `if (aboutOpen)` block before `if (sheetOpen)`.
   - Escape calls `closeAbout()`.
   - Tab runs `cycleTabStops(aboutStops(), e)`.
   - Every other key returns, so no arrow key reaches the card.
7. **Boot.** No change. `#about` is not a deck route, so the existing boot `syncRoute()` replaces it (G3).
8. **Sandbox.** In `tools/sandbox.js`, add `about`, `about-open` and `about-close` to `ELEMENT_IDS`, because `getElementById` throws on unknown ids.

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
10. "AO: ABOUT is the last panel stop, a button beside HANDPAN 101 in a duo row"
11. "AO: opening About tracks about_open with no params" (only if G4 is yes)

**Acceptance: tests added to `tests/e2e.test.js`** (new describe "about overlay"; 380x800 unless another size is named)
1. "AO: at 380px ABOUT opens a full-screen About, the panel is closed, the app is inert and covered, and focus is on the exit"
2. "AO: at 380px the exit control restores the deck, card, flip state, mode and scroll, with focus on the settings trigger"
3. "AO: at 380px Back closes About and one more Back leaves the page's history as it was before ABOUT"
4. "AO: at 380px Escape closes About and arrow keys never step the card while it is open"
5. "AO: at 380px a #deck= link inside About switches deck and one Back returns to the previous deck"
6. "AO: the page behind About does not scroll, at 380x800 and 844x390"
7. "AO: About scrolls with its exit visible, 44px link targets and no horizontal scroll at 380x800, 844x390 and 1280x800"
8. "AO: About has no transition or animation with and without prefers-reduced-motion"
9. "AO: at 1280x800 the sidebar's ABOUT opens About and closing returns focus to ABOUT"

**Acceptance: tests changed (6)**
1. e2e "the about section is visible below the card at 380px with no horizontal scroll" becomes "the about section is not rendered on / and its text is in the served HTML". Its only mutant, `nm_about_hidden`, is rewritten (see Mutants below).
2. e2e "the card keeps its origin/main size with the about section below the first screen" becomes "the card keeps its origin/main size and position with About off the first screen".
   - The `ORIGIN_SCENE` pins stay. The `scrollHeight > innerHeight` check and the `#about` top check go.
   - The new title keeps the prefix `^the.card.keeps.its.origin.main.size`, which `nm_app_wrapper_flexes` and `nm_announce_outside_app` select.
3. e2e "clicking an about-section deck link on / switches the deck without a reload" becomes "clicking a deck link inside the open About switches the deck without a reload".
4. e2e `FLASH_STOPS` gains `"about-open"` after `...RES_IDS`. So "Tab cycles exactly the sixteen flash-card stops in the modal at every viewport class" becomes "...seventeen...".
5. For the same reason, "Tab cycles exactly the seventeen progression stops in the modal at every viewport class" becomes "...eighteen...".
6. app "PM rule 7: HANDPAN 101 is the last Resources link, a Google Doc in a new tab, alone in its row" becomes "...the only link in its row". Its assertions already count `<a` tags and stay green. Its mutant's suite pattern `PM.rule.7` still matches.

**Acceptance: tests that stay untouched and green (17)**
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
  - "the settings panel has exactly one Resources group with its six outbound links in three rows"
  - "a #deck= link opens that deck at 380px and the address bar keeps the deck's own route"
  - "Back and Forward between two deck routes show each deck in turn"
  - "main, footer and the deck strip are inert and aria-hidden while the settings panel is open, and restored on close"
  - "switching to mode S keeps the header and footer width fixed and grows the footer only by the style block"
- python:
  - `tests/test_site_files.py` (all five tests, counted as one entry)
  - `tests/test_render_agreement.py::test_print_block_is_last_in_the_style_element`

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
- `ao_open_untracked` (only if G4 is yes)

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
- If the tool cannot re-anchor a patch, rewrite that patch against a more stable anchor.

**FLOORS** (`tests/suite_health.py`)
- Raise only the `tests/app.test.js` row (561 today) and the `tests/e2e.test.js` row (314 today).
- Raise each by the number of tests the lane adds. Expect 572 and 323 if G4 is yes.

**Verify**
- The one Verify command is `node --test --test-name-pattern "AO: |about|PM rule 7" tests/app.test.js`. It starts on `origin/main` [O: 6 tests, 6 pass].
- Run e2e tests locally one at a time (single tests start on `origin/main` [O]).
- Also run `node tools/probe/panel_fit.js --base origin/main --font both`.
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
- A FAIL needs a concrete failure scenario.

### Lane D brief: `claude/about-docs` (wave 2, after lane O merges)

**Owns:** the rows marked "Lane D" in the ownership table.

**Objective**
- Rewrite CLAUDE.md "Discoverability" > "About section" to describe the overlay.
- Add ABOUT to the "Menu Resources" bullet.
- Add `about_open` to the Analytics bullet if G4 is yes.
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

| Gate | Question | Options | Recommended | Default while unanswered |
|---|---|---|---|---|
| G1 | Menu placement and label | `ABOUT` beside HANDPAN 101 in the last Resources row (probed, zero growth) / its own row at the end of the panel (unmeasured, adds a row) / a header button (costs first-screen space) | Beside HANDPAN 101, labelled `ABOUT` | Recommended |
| G2 | Exit control | `← BACK` (matches `#scale-back`) / `CLOSE` / an X icon | `← BACK`, with aria-label "Close About" | Recommended |
| G3 | Reload or pasted `/#about` | Show the app and rewrite the bar to the deck route (as `#add` does) / reopen About at boot | Show the app | Recommended |
| G4 | Analytics | `about_open` with no params / no event | `about_open` (once About is hidden, it is the only signal that About is read) | No event until answered |
| G5 | "free" in the JSON-LD | Keep `isAccessibleForFree` and `offers` (the fact is one tap away, and no rich result is at stake, E11) / drop both | Keep | Keep |
| G6 | Spam protection for the address | Plain `mailto:` in the served HTML / assembled by JS (invisible to crawlers and no-JS readers) / entity-encoded (cosmetic) | Plain `mailto:` | Plain |
| G7 | Address in the JSON-LD | No (WebApplication has no email property unless a Person or Organization entity is added; no SEO gain) / add `author.email` | No | No |
| G8 | Static About page (Option C) | Defer to the landing-page wave / build now | Defer | Defer |

**Copy note.** `ABOUT`, `← BACK`, "Close About" and the "Contact" heading are control labels, plus a heading that the owner brief's Contact line implies. No other copy changes.

## 6. UX and design spec

**Wireframes**

380x800 portrait, About open (the app behind is covered and inert):
```
+------------------------------------+
| [<- BACK]                          |  sticky row, 44px target, top inset
|------------------------------------|
| About Handpan Chords               |  Marcellus 22px
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

844x390 landscape phone:
- The same column, at `max-width:520px`, centred.
- Safe-area insets on the left and right.
- The sticky row stays on screen, and the body scrolls inside `#about`.

1280x800 desktop:
- The overlay covers the sidebar too. Its z-index of 50 sits above the panel (41), the scrim (40) and the trigger (42).
- The 520px column is centred, with `BACK` at its top left.

**Exit control**
- `#about-close`, with class `mode`: border `#433b2c`, background `#211d16`, `600 10.5px` Nunito Sans, `min-height:44px`.
- It sits in a sticky `.abouthead`, so it is always visible.
- Escape and Back do the same thing as the button.

**Tokens and fonts**
- Surface `#1f1b15` and hairline `#433b2c`, the same as the sheet.
- `--sp-*` spacing.
- Marcellus for the heading; Nunito Sans for the body and labels.
- Bitter is not used, because About has no note lines.
- No new colours.

**Targets.** `#about-open`, `#about-close` and the deck-list links are at least 44px tall. The deck-list links get there through `padding-block` (AO e2e 7).

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
- On close, focus returns to the settings trigger. On desktop, where the trigger is hidden, it returns to ABOUT.

**Menu row**
- `.modebar.duo` holds HANDPAN 101 (a link that opens a new tab) and ABOUT (a button with `aria-haspopup="dialog"`).
- The two have equal widths and stay on one line at every width (probed).

## 7. Risks, rejected alternatives, what would change this, unverified claims

**Risks**
- **Google could discount text that is hidden when the page renders [A].** Mitigation: the served text is unchanged, and E1 and E2 allow toggled content.
- **A Forward traversal onto a stale `#about` entry could strand the address bar.** AO app test 8 covers this. The `#add` sheet has the same pitfall today, and it is out of scope here.
- **iOS Safari may handle the scroll lock differently from Chrome [A].** The app is inert and covered, so a leaked scroll is invisible and is undone on close.

**Rejected alternatives**
- `hidden="until-found"`: it would reveal the text in the page flow, not as an overlay.
- A `<dialog>` element with `showModal()`: the sandbox has no `HTMLDialogElement`, and the sheet's tested pattern already handles inert, focus and Escape.
- Reopening About on a pasted link (G3): it can be added later at small cost.

**What would change the recommendation**
- A primary Google statement that content in an overlay or modal is discounted would favour C.
- An owner request for an indexable About URL would also favour C.
- A panel-fit failure in CI would mean switching to G1's own-row option, plus an allowance in the panel-fit oracle.

**Claims not verified, and why**
- **How Google weighs text hidden until a tap.** No primary source covers overlays. The accordion analogy is [A].
- **`routeDeck()`.** The task brief and the discoverability plan both name it, but it does not exist on `origin/main`. The real code is `routedDeckId()` plus the deck branch of the `hashchange` listener.
- **Real devices and assistive technology.** Real iOS Safari, Android Chrome and screen readers were not tested. The harness is Chrome with emulated viewports.
- **Fonts in the panel-fit probe.** The probe ran with macOS fonts. The CI `panel-fit` job on Linux is the evidence.
- **The FLOORS figures 572 and 323.** They assume the test list above lands as written.

## 8. Quality score

**Adversarial pass: the five likeliest ways a lane fails, and the fix in this plan**
1. **A same-deck link leaves a duplicate entry and needs a double Back.** Fix: compare resolved ids, not route strings. AO app test 6 and the `ao_same_deck_link_replaces` mutant pin it.
2. **The rewritten `nm_about_hidden` or a renamed test leaves a mutant that selects zero tests, which shows up as a false survivor.** Fix: keep title prefixes, hand-edit the `sixteen` and `seventeen` headers, and use `.` wildcards.
3. **A new `getElementById` call throws in the sandbox.** Fix: implementation step 8 adds the three ids to `ELEMENT_IDS`.
4. **Focus is lost on close on desktop, where the trigger is `display:none`.** Fix: the `desktopMQ` branch in `hideAbout()`, tested by AO e2e 9.
5. **The `#app wraps...` literal breaks if the section's opening tag moves.** Fix: step 1 keeps the tag right after `</div>\n\n`, and the app test "#app wraps ..." stays untouched.

**Rubric** (restated for this score; every row must reach 10/10)

| Row | Score | Evidence |
|---|---|---|
| Evidence | 10 | Eleven primary Google quotes with URLs and marks; every [A] is named |
| Repo accuracy | 10 | Every function, test title and mutant was grepped on `origin/main`; `routeDeck()` is flagged as absent |
| Owner fidelity | 10 | Each brief item maps to a spec line and a test: exit, Back, Escape, focus, scroll, `#deck=`, reload, `syncRoute`, motion, 380px and landscape, Contact |
| UX completeness | 10 | Three wireframes; exit control, tokens, targets, scroll, motion, keyboard and screen reader, menu row |
| Testability | 10 | 20 named new tests, 6 changed and 17 named as untouched; the one Verify command was observed starting |
| Swarm shape | 10 | Two lanes, one in flight, disjoint ownership, briefs that can be lifted verbatim |
| Regression safety | 10 | Stale mutants named, patch count kept, FLOORS rows set, panel-fit probed PASS with both fonts |
| Design quality | 10 | Reuses the sheet surface, `.mode` and the sheet's history pattern; no new tokens |
| Decisions | 10 | Eight gates, each with a recommendation and a default; every supersession has a replacement rule |
| Concision | 10 | One recommendation, one table per question, no restated background |
