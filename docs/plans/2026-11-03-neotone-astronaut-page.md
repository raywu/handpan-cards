# Neotone F2 Astronaut 16 scale page

Mode: plan (via /reviewed-plan, small task: one boundary). AFK armed. Stop: plan ready / not ready.
Stacks on `claude/neotone-defaults` (PR #870, head b365b03). Owner approved the goal 2026-11-03
(CEO report C3 in `docs/plans/2026-11-03-neotone-default-scales.md`).

## Goal
A dedicated page `scales/neotone-f2-astronaut-16/` for the Neotone One Mutant factory scale F2 Astronaut 16:
three chord cards with mutant lenses, its field table, a PRACTICE link, and a link back to `/scales/neotone/`.
The Neotone page's factory section keeps the Astronaut heading + hotkey but replaces its table and practice
link with one link to the new page. Hub, sitemap and llms.txt list the page.

## Non-goals
- No deck data, Neotone profile angle, geometry, or orientation change (orientation flip PARKED by owner).
- No page for La Sirena, Onoleo, or the six 10-note factory scales (CEO C1).
- No change to the 16-row `tools/scale_pages.json` or its "All 16 ... chord charts" count.
- No new test harness, no app (`index.html`) change, no i18n (static English-only page).
- Never cite lesagedavid.fr. Neotone 10 = 9 tonefields; Neotone 19 = 9 tonefields, each with a mutant field inside.

## Settled inputs (source)
- Seed `(F2) [A#2] [C3] C#3 D#3 F3 G3 G#3 C4 D#4 F4 G4 [G#4] [C5] [D#5] [G5]`, map
  `r49,r51,r53,r55,r56,r60,r63,r65,r67,b46,b48,-,-,b79,b75,b72,b68,-` (paired rev 2): pinned and round-trip
  verified in the default-scales plan review (A1 TRUE); already in `tools/neotone_page.json` `defaults[8]`.
- Cells: manual p.25 blueprint, confirmed by integrator (default-scales plan evidence table).

## Evidence (this session, read-only, at origin/claude/neotone-defaults)
- `scales/neotone/index.html` = 65,767 B; shared `SIZE_CAP` = 62,688 B; `NEO_SIZE_CAP` = 73,728 B
  (`tests/test_scale_pages.py`, top constants). Gap = 3,079 B.
- Astronaut block inside the factory section = 934 B; replacing it with a link saves ~800 B.
  Cards alone are 42,957 B; head style 4,455 B; factory section 6,348 B.
- **Finding F-size:** moving Astronaut's detail cannot bring the Neotone page under `SIZE_CAP`
  (~64.9 KB after the move). `NEO_SIZE_CAP` cannot be dropped by this change alone.
- `render()` branches on `neo = row["slug"] == NEOTONE_SLUG`; `neotone_page()` runs `engine([row], defaults)`;
  the hub hard-codes one Neotone link in `hub_page()`; `NeotonePageTest` (sitemap/llms test
  `test_sitemap_and_llms_list_the_page`, hub test `test_the_hub_links_the_page_once_under_its_own_heading`).

## Decisions (AFK, routine reversible, recommended option)
- D1 slug `neotone-f2-astronaut-16` (flat, like every other scale folder; `emit()` writes `scales/<slug>/`).
- D2 row file `tools/neotone_astronaut_page.json` (shape of `tools/neotone_page.json`, no `defaults`),
  copy at `scales/neotone-f2-astronaut-16/copy.json`. Not added to `scale_pages.json` (keeps the 16-row
  oracle and hub groups untouched).
- D3 generator: `neo` becomes "row has a `profile`"; the Neotone-only parts (factory section, make-your-own
  steps, "example scale" lead) stay keyed on `slug == NEOTONE_SLUG`. The Astronaut page renders its own
  table via the same table helper factored out of `defaults_html()` (one function, two callers), then a
  "Back to Neotone handpan chords" link. `--neotone` writes and checks both pages; the Neotone fixture
  `tests/fixtures/neotone_page_v1.json` gains the Astronaut slug (same fixture function, one more row).
- D4 size (F-size): keep `NEO_SIZE_CAP`, lower it to 66 * 1024 (the new page must sit under it with
  margin); the Astronaut page must pass the shared `SIZE_CAP`. Dropping the Neotone cap needs a content
  cut the owner has not asked for: logged as owner question Q1, not auto-picked.
- D5 hub: under the existing Neotone heading add one link "F2 Astronaut 16 handpan chords"; sitemap and
  `llms.txt` gain `/scales/neotone-f2-astronaut-16/`.
- D6 card picks: the three cards are the engine's `auto_pick` for the Astronaut seed+profile (computed in
  phase 1, stored as `pick`, asserted against the fixture like every other page).

## Review fixes (folded in)
- R1: render() gets an explicit third branch for the Astronaut page (profile, not NEOTONE_SLUG). It has its own
  tail: table, a back link to `/scales/neotone/`, an "All 16 ... chord charts" link, the updated date, the
  disclaimer and SWIPE_JS. It never uses the standard `cross`/`siblings`/`group` tail. Astronaut `copy.json` carries
  `lead_html`, `history_heading`, `history_html`, `progression_tail_html`, `disclaimer_html`, `og_description`.
- R2: the factored table helper takes `practice=False` on the Astronaut page (no duplicate link); a test asserts the
  row `cta` equals the engine share for the Astronaut default.
- R3: `--neotone` emits both pages and returns the max exit code; `--neotone --stdout` prints the Neotone page
  only; fixture built from one engine call over both rows.
- R4 (AFK, accepted): breadcrumb Home > Neotone > F2 Astronaut 16 chords, header and JSON-LD.
- A1 verified by reviewer: 50 cards, auto_pick [1,25,30] = Fm (i), A#m (iv, strikes mutant A#2 "M1"), Cm (v);
  store `pick` [1,25,30]. Hub link is a `<p>`, not `<li>` (keeps the 16-item hub count).

## Assumptions
- A1 (verify in phase 1, gate): the engine yields >= 3 cards for the Astronaut seed under the paired profile,
  and at least one carries a mutant lens. If false: stop and report; no fallback picks invented.
- A2 (verified): seed + map parse and round-trip (default-scales review).

## Why smallest
Reuses `render()`, `engine()`, `card_html()`, the table markup, `emit()` and the Neotone test class; one new
row JSON + one copy JSON; no new tool, flag or harness.

## Phase 1 - tests first (owner: lane; prereq: worktree from b365b03)
Add to `NeotonePageTest` (or a sibling `AstronautPageTest` reusing its helpers):
- page file equals generator output; `--neotone --check` exits 0 for both pages;
- head/h1/canonical `https://handpan.raywu.org/scales/neotone-f2-astronaut-16/`, title "F2 Astronaut 16 handpan chords";
- captioned table equals the manual cells (reuse the factory-table oracle);
- PRACTICE link decodes via `HPE.share.decode` to the pinned seed+map and re-encodes canonically;
- cards carry a mutant lens; no "bottom shell" text; visible text "scale" never "deck"; allowed hosts; scripts;
- page links to `/scales/neotone/`; Neotone factory section's Astronaut entry has heading + hotkey + one link
  to the new page and no table/practice link; other six tables unchanged;
- hub links the page once under the Neotone heading; sitemap + llms.txt list it;
- size: Astronaut page < `SIZE_CAP`; Neotone page < new `NEO_SIZE_CAP`.
Acceptance: new tests fail on b365b03 for the expected reason. Verify: `python3 -m unittest tests.test_scale_pages tests.test_site_files`.

## Phase 2 - implement (owner: lane)
Row + copy JSON, `render()`/`defaults_html()` refactor per D3, `hub_page()` link, sitemap.xml, llms.txt,
regenerate: `python3 tools/gen_scale_page.py --neotone`, `--neotone --fixture`, `--hub`.
Acceptance: phase-1 tests pass; every existing page byte-identical except `scales/neotone/index.html` and
`scales/index.html` (`test_every_existing_page_regenerates_byte_identical_from_its_copy`). Verify:
`python3 tools/gen_scale_page.py --neotone --check && python3 tools/gen_scale_page.py --hub --check && python3 tools/validate.py`.

## Phase 3 - mutants (owner: lane)
One patch in `tests/mutants/` (no `index` lines; `.` wildcards in `# suite:`) that drops the factory-section
link to the Astronaut page, killed by phase 1; README/FLOORS count from CI artifacts.
Verify: `bash tools/mutation_check.sh` scoped run or CI mutation job.

## Verification
- Automated: CI `validate` at the exact pushed head (merge gate).
- Self: open both pages from disk; table, three cards flip, links resolve.
- Independent: fresh reviewer subagent (`/review`, read-only) at the verified head SHA.
- Human: owner DEV check of `/scales/neotone-f2-astronaut-16/` and the Neotone factory link
  (https://handpan-cards-dev.pages.dev/). No phone QA needed (not a saved-scale release).

## Risks / edge cases
- Making `neo` profile-based could leak Neotone-only sections into the new page: tests assert absence of
  "Make your own Neotone scale" and the factory section on the Astronaut page.
- Fixture churn: `neotone_page_v1.json` grows; `test_main_fixture_writes_only_the_neotone_fixture` must still hold.
- PR #870 changes before it lands: rebase the lane on its new head; regenerate rather than hand-merge.
- Neotone page JSON-LD/description unchanged except via regenerated factory section.

## Recovery
All generated files regenerate from JSON; revert the lane commit(s); a rejected lane is reverted on dev via
`claude/dev-revert-<lane>`.

## Delivery
Lane branch `claude/neotone-astronaut-page` from `claude/neotone-defaults`; PR M to `main` stacked behind #870
(or based on it), PR D to `dev` per project gates; main stays owner-gated. PRs say `Refs TRI-n`.

## Continuation point
Phase 1: create worktree from b365b03 (or #870's current head), write the failing tests.

## Open owner question
- Q1: to drop `NEO_SIZE_CAP` the Neotone page needs ~2.3 KB more cut after this move (e.g. render the six
  no-mutant factory scales as one note line each instead of tables, or drop their empty "Mutant" rows).
  Recommended: keep `NEO_SIZE_CAP` at 66 KB for now. Not part of this plan.

## Decision log
D1-D6 above (AFK, recommended option, reversible). F-size recorded; Q1 left to owner.

## Review log

### Review (independent, 2026-11-03, at origin/claude/neotone-defaults b365b03) - READY
- F-size CONFIRMED: neotone page 65,767 B; SIZE_CAP 62,688; Astronaut block 934 B -> ~64.9 KB after move. 66*1024 cap leaves ~2.6 KB margin.
- A1 CONFIRMED (engine run, temp row from defaults[8], no pick): count 50, auto_pick [1,25,30] = Fm (i), A#m (iv), Cm (v); A#m numbers "M1 - 1 - 3" (mutant A#2). Store pick [1,25,30].
- R1 medium: D3 as written leaves render()'s neo tail as one early-return block (defaults_html, steps, related, disclaimer). The Astronaut page needs a third tail (own table + back link + "All N" link + updated + disclaimer); it must not fall to the non-neo tail (cross/siblings/group -> KeyError/wrong related list). Name that branch explicitly; copy.json must carry history_heading, history_html, disclaimer_html, progression_tail_html, lead_html, og_description.
- R2 low: the factored table helper emits its own "Practice <name>" link; on the Astronaut page that duplicates the PRACTICE CTA under the cards. Add a flag to omit it, and assert row cta == engine share (decode test).
- R3 low: main() --neotone emits one page; writing both needs max() of two emits, and --stdout is ambiguous with two pages (refuse or print Neotone only). --fixture: one engine call over both rows.
- R4 low: breadcrumb (header + JSON-LD) reads Home > F2 Astronaut 16 chords; consider a Neotone crumb. Optional.
- Coverage note: sitemap/llms equality tests and the glob-based page-style class (test_scale_pages PAGES glob) pick up the new folder automatically, so sitemap/llms omissions fail CI. Hub test test_the_hub_links_the_page_once_under_its_own_heading stays valid (counts /scales/neotone/ only); the 16 <li> count stays valid if the new link is a <p>, not <li>.
