# Search performance and /scales Practice CTA (plan, 2026-11-23, TRI-91, P2)

Mode: plan only. Prompt: `docs/prompts/2026-11-23-search-perf-practice-cta.md`. Author does not review; eng review by a fresh plan-reviewer, design review by a fresh reviewer (frozen rubric in the prompt). Draft brief: `docs/plans/2026-11-23-brief-scales-practice-cta.md` (UNAPPROVED). Scope of this plan stops at owner approval of that brief.

## Goal
1. Improve handpantheory.com search performance with changes ranked by impact x uncertainty.
2. Add a Practice CTA beside each scale on the `/scales/` rows, judged by retention and bounce.

## Non-goals
Deck data, layouts, diagram geometry, app UI, zh/ja/de SEO (TRI-73..75, parked), new dependencies, paid tools, any build before the brief is approved, CLAUDE.md edit, merge to main.

## Evidence (Search Console, 3 months to 2026-11-21, both screenshots read)
- 11 clicks, 124 impressions, CTR 8.9%, avg position 7.9. All queries are singles or near: "handpan chords" 5 impr / 0 clicks, "e amara 20" 2, four queries at 1 ("hand part", "d kurd 9 handpan notes", "d amara", "amara scale").
- Pages (clicks/impr): d-kurd-10 3/27, /scales/ 2/25, e-amara-20 1/22, d-kurd-9 1/10, d-amara-9 1/6, c-sharp-hijaz-9 1/4, d-integral-9 1/3, f-sharp-serenity-neotone 1/3, /handpan-101/ 0/11, home 0/6.
- Read-only checks (curl, 2026-11-23): `handpan.raywu.org/` returns 301 to `https://handpantheory.com/`; `/scales/` title "Handpan scale chord charts", description "...16 scales, grouped by sound...", canonical self; home and /handpan-101/ have titles, descriptions and canonical; `sitemap.xml` on handpantheory.com has 21 locs (home, 101, hub, 16 scales, neotone, serenity). Old-host sitemap returns 301.
- Static pages contain no GA (`grep gtag` on `scales/index.html` and `scales/d-kurd-10/index.html`: 0; `index.html`: 8). GA4 therefore cannot see sessions that land on `/scales/*` at all.

## What cannot be concluded
With 11 clicks and 124 impressions nothing is statistically distinguishable: not a CTR difference between pages, not a title effect, not that any page "underperforms". Position 7.9 is a mean over ~124 impressions across different queries. The CTR of 8.9% is not low for position 7.9 on that volume. "handpan chords" 0/5 is 5 impressions: noise-level. Do not claim a ranking cause from these numbers; treat everything below as hypotheses with cheap, reversible tests.

## Decisions (draft, owner confirms)
- D1: the old host is not the cause to fix. The 301 and Change of Address are live (verified 301); the page-4 ranking of handpan.raywu.org for "handpan chords" is a stale index entry that fades as Google recrawls. Not verifiable from here whether it is still indexed: gated H1 (owner: Search Console URL Inspection on the old host's top URL; nothing to build).
- D2: CTA mapping reuses the destination each scale page already uses: the row's fixed `cta` field in `tools/scale_pages.json`, read by `render` in `tools/gen_scale_page.py`. No new route, no engine call. Neotone section (2 plain `<p><a>` rows, not `ul.rel li`): recommended default is leave it exactly as is, no Practice button on either Neotone row, so Practice links = 16 (the list rows only). Alternative, owner decision: convert the two Neotone rows to `ul.rel li` rows and add a Practice button on Serenity (and optionally generic Neotone); that is a deliberate exception to the no-restructure non-goal and changes the tests that match the exact row/count (Lane T).
- D3: the hub CTA is static HTML/CSS only; no script, no analytics on static pages (pinned by `test_the_hub_has_no_swipe_script`, SEO-AEO plan Non-goals).

## Part 1: ranked search levers (impact x uncertainty)
Existing SEO plans are settled (`2026-10-28-seo-aeo-release.md`, `2026-10-28-scale-pages-rollout.md`, `2026-10-27-seo-long-tail.md`); nothing in the evidence contradicts them. zh/ja/de are not duplicated.

| # | Lever | Evidence | Impact | Uncertainty | Cost | Verdict |
|---|---|---|---|---|---|---|
| L1 | Hub to app Practice CTA and hub internal links already exist; the Practice CTA is part 2 | /scales/ is #2 page by clicks (2/25); no onward path | medium (behaviour, not rank) | low on mechanics, high on effect | small | part 2 |
| L2 | Home to scale pages: add crawlable links from `/` or `#about` to `/scales/` and top scales | home 0/6 and scale pages carry the clicks; measured 2026-11-23: `index.html` already has 18 distinct `/scales/` hrefs (19 occurrences), so crawlable links exist | none new | low | would need `index.html` text: app change, owner gate | no-op: recorded, nothing to propose unless phase 1 shows the live home differs |
| L3 | /handpan-101/ title and description vs query intent | 0/11 impr. Title is long ("...Parts, Scales and First Practice"); queries unknown | low to medium | high (no query data for the page) | small, generator or page edit | gather page-level queries first (phase 1); do not rewrite from 0/11 |
| L4 | "handpan chords" head term | 5 impr / 0 clicks; home title leads "Custom Scale Chord and Progression Practice", hub title "Handpan scale chord charts" | high if won, but head term, competitive | very high | title edits are cheap and reversible | test one title change on the hub, measure over 8 weeks, accept inconclusive |
| L5 | Long-tail scale pages (e-amara-20 22 impr 1 click; d-kurd-10 27/3) | the working surface: 7 of 8 clicking pages are scale pages | high | low (already the strategy) | per rollout plan | continue the rollout plan; no new work here |
| L6 | Hub title and description match scale-name queries ("d kurd 9 handpan notes", "amara scale") | the hub description says "16 scales" and is generic | low to medium | high | small | bundle with L4 as a single hub meta test |
| L7 | Old host index decay | D1 | low | low | none | owner check only |

Smallest approach for part 1: no code. Phase 1 gathers three missing facts (home link inventory, per-page queries for /handpan-101/ and the hub, old-host index status) and then the owner picks L2/L4/L6 changes, each its own tiny lane later. Nothing from part 1 is built in this plan.

## Part 2: CTA mapping (verified)
- Exact row list: `hub_page` (`tools/gen_scale_page.py`) renders the 16 built rows as `<li><a href="/scales/<slug>/">` via `link_item`, under the 5 `GROUPS` in order: Minor 5, Celtic minor 3, Pentatonic minor 3, Major and bright 2, Middle Eastern and Japanese 3. A sixth section, "Neotone", holds two plain `<p><a>` rows (generic Neotone, F# Serenity), not `<li>`: no 44px rule, no flex, no row rule, and the Serenity link text is "F# Serenity handpan scale (Neotone Mutant)", not "<name> handpan chords" (keep from main). Total 18 rows; Practice links: 16 by default (D2: Neotone section exempt and unchanged); 17 or 18 only under the alternative. No CTA on the hub today.
- Each row's CTA is a fixed `cta` field in `tools/scale_pages.json`, used by `render` for the scale page's `<a class="open">PRACTICE <NAME></a>`. Five built-in rows use `/#deck=<slug>` (d-kurd-10, d-amara-9, d-amara-10, f-low-pygmy-18, c-sharp-hijaz-9); the other 11 use `/#s=` links. The hub links each row to its own `row["cta"]`; the engine is not needed. A `#s=` link on a built-in row would be handled as a share import (`share_open`) and add a duplicate custom scale, so never regenerate a built-in row's CTA as `#s=`.
- Serenity (alternative only): `row["cta"] = "/#s=" + data["share"]` is computed from the engine at its page build (`serenity_page`), so it is not in `scale_pages.json`. Under the alternative the hub must read it from that same source, and a test must assert the hub's Serenity Practice href equals the Practice link in `scales/f-sharp-serenity-neotone/index.html`; that test is part of the alternative. The generic Neotone page's Practice CTA is `cta` in `tools/neotone_page.json`.
- `link_item` also builds the related-scales list on every scale page (`<li><a href="/scales/<slug>/">`; the "Also try" list), so it must not change: add a hub-only helper (e.g. `hub_item`) used by `hub_page`.
- i18n: static scale pages are English-only generator output; no app string changes, so the i18n step does not apply (verify by `git diff --stat` touching no `index.html`/`data/i18n`). Not to be asserted until phase 3 acceptance.

## Design direction (impeccable, shape mode; no owner interview was possible, assumptions marked)
Surface mode: Operate/Read, restrained. Three variants, mocks at `/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/86550be0-8308-46ce-9e79-1d7585ec807b/scratchpad/cta-variants.html` (static HTML, nothing published). None is approved.
- A filled: reuses the scale-page `.open` recipe (violet fill, white text, 12px radius). Strongest conversion cue; 16 filled buttons in a column dominate the list and compete with the SEO link.
- B ghost outline (recommended): white fill, 1px `#8a847b` border, neutral `#242424` label (not violet, not underlined, so the underlined violet chart link keeps more weight). Practice clearly a button, matches the page's `.open.ghost`. Hover: border `#242424`. Active: `#f6f4ed` fill. Focus: the shared `a:focus-visible` rule sets `border-radius:2px` and the global `a` rule sets underline, weight 600 and violet, so the Practice button needs its own more specific rules: `text-decoration:none`, `#242424` label, and its own focus ring with a radius equal to the button radius (12px), not clipped by the li. Layout: the `li` becomes the flex container (`display:flex;align-items:center;gap:12px`), the chart link gets `flex:1;min-width:0`, and the Practice link is `flex:none`; the existing `ul.rel a{display:flex;min-height:44px}` rule must not style the Practice link by accident (scope it to the chart link or override on the button).
- C text action with play glyph: no box, least weight; 44px target via padding; weakest affordance, easily missed on phone.
All: 44 x 44 minimum, label "Practice", `aria-label="Practice <name>"` (no "handpan chords"; unique per row; WCAG 2.5.3 label-in-name: the visible "Practice" is contained in the accessible name), opens in the same tab, button does not wrap, link text wraps first at 320px. Whether practice is the "primary" action is an owner judgment; assumption: the hub's SEO link stays first.
Absolute numbers (production rows are `ul.rel a{min-height:44px}` plus a 1px `li` rule = 45px; the mock now uses the real hub CSS, 45px rows, underlined chart links and the shared focus ring): at 375 content is 343px, button about 90px (cap 120) + 12px gap leaves about 241px for the link; at 320 content is 288px and the link gets about 186px, so long names wrap to 2 lines: assert it. Expected row height 45px for 1 line, about 49px for 2 lines (16px/1.5) and button width about 90px; these are MEASURE-BEFORE-APPROVAL values, asserted with +-1px tolerance (90 +-1, 49 +-1). Total list height change at 375 and 320 is recorded by the QA script before approval. Wide screens: cap the list measure with `ul.rel{max-width:640px}` on the hub only (N6), so the gap between a short label and its button never exceeds the cap minus the label; without it the button floats about 700px from the label at 1280. Record the measured gap at 768 and 1280. Contrast: label `#242424` on `#fff` 15.5:1; variant C violet `#6756b5` on the page background `#f6f4ed` 5.34:1 (5.87:1 applies only to white on violet, or violet on `#fff`); ghost border `#8a847b` is 3.71:1 on `#fff` but 3.37:1 on `#f6f4ed`, both clear the 3:1 non-text bar; focus ring `#242424` on `#f6f4ed` 14.1:1.

## Measurement
- GA4 cannot see static-page sessions (no tag, verified). So GA4 "bounce" for a `/scales/` landing is not measurable today and the hub CTA cannot report a click.
- What can be measured without breaking the script-free rule: (a) GA4 sessions on `/` whose `page_referrer` is `https://handpantheory.com/scales/`. A hub-to-app hop is same-site, so it is not a new session source: G1 must read `page_referrer` (GA4 Explorations), not session source/medium (GA4 records page_referrer by default; UNVERIFIED, gated G1: confirm in GA4 on prod, since analytics never runs on DEV or local); (b) existing app events after arrival (`deck_route`, fired by a `#deck=` arrival, covers the five built-in rows; `deck_select`, `share_open`, `card_flip`), no new event names; `share_open` does not fire for a restored tab, and regions with opt-in consent undercount referral sessions; (c) Search Console clicks to `/scales/` as the denominator.
- Adding a tag to static pages or a new event is a separate owner decision (changes D3 and the SEO-AEO non-goal); not proposed here. If ever added, events obey "Analytics privacy": no `custom:` id, no string param over 40 characters, no hash in `page_location`; candidate `scales_practice_click { group: <group, <=40 chars> }`, never the scale name or share code.
- Baseline window: 28 days of Search Console and GA4 immediately before release; compare the 28 days after. At about 11 clicks per quarter (about 4 per month) a before/after comparison is statistically unsound: expect 0 to 3 `/scales/` landers per window. Counts as evidence: individual referral sessions from `/scales/` to `/` and their onward events (existence proof the CTA is used), zero regressions in Search Console clicks to `/scales/`. Owner judgment: whether the CTA is "working"; retention and bounce deltas cannot be claimed.

## Smallest approach
Part 1: facts first, no code. Part 2: one generator change, one regeneration, test updates: a single lane (generator, hub file, tests share one dependency chain: hub HTML is asserted verbatim against `gen.hub_page()`).

## Lanes (point to /swarm; one lane is correct, split only if the owner wants it)
- Lane H (generator + generated): owns `tools/gen_scale_page.py`, `scales/index.html` (regenerated, never hand-edited).
- Lane T (tests): owns `tests/test_scale_pages.py` hub tests: the 4 `assertEqual(html, gen.hub_page())` sites AND the row regex in `test_the_hub_lists_all_sixteen_under_the_five_headings_in_order` (`<li><a href=...>...</a></li>` requires `</a></li>` right after the chart link, so a Practice link inside the `li` turns it red) and the `len(...) == 16` count in `test_the_hub_links_the_page_once_under_its_own_heading`; any mutant under `tests/mutants/` that patches `link_item` or the hub (grep `hub_page|link_item` in `tests/mutants`: none found by filename; phase 3 greps contents), `tests/suite_health.py` floors if counts move. T pre-adds failing tests (TDD) before H.
- Lane M (measurement): docs only if the owner wants a baseline note; no code.

## Phases
| # | Phase | Prereqs | Owner | Deliverable | Acceptance | Verify |
|---|---|---|---|---|---|---|
| 0 | This plan and brief | none | author | two docs, mocks in scratchpad | both exist; brief says UNAPPROVED | `test -f docs/plans/2026-11-23-brief-scales-practice-cta.md && grep -c UNAPPROVED docs/plans/2026-11-23-brief-scales-practice-cta.md` |
| 1 | Part 1 facts | 0 | integrator + owner | note of: home `<a>` count to `/scales/`; page-level queries for hub and 101 (Search Console); old-host inspect result (G-H1) | numbers recorded, none inferred | read-only: `curl -s https://handpantheory.com/ | grep -o 'href="/scales/' | wc -l` |
| 2 | Owner reviews brief, picks variant D1, D2, D3 | 0 | owner | brief marked APPROVED with decisions and date | brief header says APPROVED; plan cites it | `grep -n "Status: APPROVED" docs/plans/2026-11-23-brief-scales-practice-cta.md` |
| 3 | Lane T then H, worktree off main, TDD | 2 | swarm lanes | failing tests then generator change (hub-only helper; `link_item` untouched); `python3 tools/gen_scale_page.py --hub` regenerates `scales/index.html` | 16 Practice links by default (17 or 18 only under the D2 alternative), the Neotone section byte-identical to main by default, each with a distinct `Practice <name>` label and href equal to that row's scale-page CTA href (the row's `cta`); row chart link unchanged; a row with no button has exactly one `<a>`; no `<script>`; every scale page still passes `python3 tools/gen_scale_page.py <slug> --check` unchanged | `python3 -m unittest tests.test_scale_pages -v` (gate by `ok` per title; `tools/validate.py` does not inspect scale pages and cannot catch hub drift, `tests/test_scale_pages.py` is the check); `python3 tools/gen_scale_page.py --hub --check`; `python3 tools/gen_scale_page.py --neotone --check`; `python3 tools/gen_scale_page.py --serenity --check`; per-slug `--check` loop |
| 4 | Visual QA (local static) | 3 | self + independent reviewer | screenshots at 320, 375, 768, 1280 of the generated `scales/index.html` served locally | testable now: bounding box >= 44px at 320/375/768/1280; `scrollWidth <= innerWidth` at 320; button on one line and <= 120px wide; focus ring radius equals the button radius and is not clipped (computed style plus screenshot); at 320 the longest names (C# Hijaz / Orion 9, F3 Low Pygmy 18) wrap in the link, never the button; unique aria-label per row; >= 8px between link and button; row max-width and gap measured at 768 and 1280 (state whether the measure is the `ul` max-width or `main`). Owner judgment: hierarchy, density feel | `docs/testing/browser.md` flow against the local file; probe script in the lane report |
| 5 | PR M to main + PR D to dev; CI; served-DEV check after D merges | 4 | integrator | PRs per CLAUDE.md dev-first flow | `validate` green at verified head SHA; independent review addressed; DEV checked; M stays open until owner says merge | `gh run list --commit <sha> --workflow validate.yml`; after D merges, re-run the phase 4 probe on served DEV (DEV builds from `dev`, so it cannot precede PR D) |
| 6 | Baseline and read-out | 5 on main | owner | 28-day before/after note per Measurement | claims limited to what Measurement allows | n/a (owner judgment) |

Mutation (the full suite, not scoped, as this paragraph concludes): the hub change touches only the scale-page generator and tests, but `tools/ci_scope.py` scans changed test lines for `#s=` (its `FS_KEYWORDS`), and the new hub tests assert `#s=` hrefs, so expect the full mutation suite to trigger; budget the CI time instead of assuming scoped-only. Confirm in phase 3 which mutants patch `gen_scale_page.py` (grep contents, not filenames).

## Verification split
- Automated: unit tests above, `validate.py`, CI `validate`, the full mutation run (not scoped; see the mutation paragraph).
- Self: row/CTA href parity script across all rows; 320px overflow probe.
- Independent: fresh reviewer at the verified head SHA (CLAUDE.md); design review of the shipped hub against the approved brief.
- Human: owner approves brief and variant, phone check on DEV, judges effect.

## Risks and edge cases
- Hub HTML is asserted verbatim in 4 tests, and the row regex in the hub-list test breaks on any markup after the chart link: all change in lockstep or the lane goes red. Lane T exact-match list and change under each option: (1) the 4 `assertEqual(html, gen.hub_page())` sites: unchanged code, new hub output both ways; (2) the row regex in `test_the_hub_lists_all_sixteen_under_the_five_headings_in_order` needing `</a></li>`: default relaxes it to `</a>` plus an optional Practice link before `</li>`; alternative same; (3) `len(...) == 16` in `test_the_hub_links_the_page_once_under_its_own_heading`: unchanged by default (chart-link count stays 16, Practice links counted separately); under the alternative any exact match on the Neotone `<p><a>` rows changes with the new `li` markup, and the Serenity href equality test is added.
- CTA hrefs are long (up to about 106 chars for the 16 list rows, e-amara-20 about 105; Serenity about 180 and Neotone 172 only under the alternative): hub HTML grows; fine for crawl, check page weight stays small.
- Anchor-in-anchor must be avoided: Practice is a sibling of the row link inside the `<li>`, not nested.
- Duplicate link text for crawlers: aria-label only; visible text "Practice" repeated 16 times is acceptable but owner may prefer D3.
- Five rows use `#deck=<slug>`, not `#s=`: link to `row["cta"]` verbatim; never derive a `#s=` link for them (share import, `share_open`, duplicate custom scale).
- Editing `link_item` would change the related list on 16+ scale pages: use a hub-only helper; acceptance is every scale page `--check` unchanged.
- Overclaim risk: any "improved" statement from n of single digits is forbidden.

## Recovery
Revert the hub commit (generated file plus generator); nothing else depends on it. If the lane is rejected on dev, revert via `claude/dev-revert-<lane>`.

## Continuation point
Owner reads the brief, picks D1/D2 (default leave Neotone unchanged)/D3, and approves or edits it. Then run `/reviewed-plan`-equivalent review of this plan (fresh plan-reviewer + design reviewer), then phase 1 facts, then lanes T and H.

## Stop
Plan READY for review, not for execution. Next action: owner approves or edits the brief; independent plan review runs in parallel. No code, push, merge, Linear or memory write was made.

## Approved implementation scope · November 25

Owner approved outlined variant B, the visible Practice label, and existing Neotone rows unchanged. The generator and static verification run in an isolated branch. Use real Nunito Sans and blocked-font measurements at 320, 380, 768 and 1280. Record actual widths and wrapping instead of treating the old 90px estimate as measured. Keep the 44px target, 12px column gap, 120px link width ceiling, and 640px list cap.

The subsequent owner update extends the row layout to both Neotone entries. The named Serenity scale links to its existing Practice destination. The generic Neotone row is a full-width chart link because the detail-page example is specifically F2 Astronaut. Both plan reviews passed, including the Neotone amendment.
