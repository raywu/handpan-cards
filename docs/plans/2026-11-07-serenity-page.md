# Dedicated page: F# Serenity (Reo Matsumoto) for Neotone Mutant

Status: plan only (2026-11-07). Key: handpan-cards#serenity-page. Research: docs/plans/2026-11-07-serenity-page-research.md.
Trigger: after the "Reo Matsumoto" credit fix (PR #954, branch `claude/neotone-fs-serenity`) is pushed. Base: the head of
`claude/neotone-fs-serenity` at dispatch (NOT main; main has no Serenity row).

## Goal (owner 2026-11-07)
One static page `/scales/f-sharp-serenity-neotone/` (flat slug, Q3) that ranks and answers for F# Serenity: what it is, who
created it, notes by tonefield, how to practise it in Handpan Theory, linked from the Neotone page.

## Non-goals
- No `data/decks.json`, engine, share-format, `index.html` app or i18n change. No change to the Neotone row's notes.
- No new card deck/PDF. No video embed unless Q2 says so. No images of him or his instrument. No claims not in the research file.
- Neotone page stays under `NEO_SIZE_CAP`; no cap raise (past decision 2026-11-04).

## Decisions
- D1 page model [recommendation; source tools/gen_scale_page.py]: add a `--serenity` mode reusing the Neotone page's
  head builder (canonical at line building `<link rel="canonical">`, og tags, shared brown head, lockup) and its
  defaults-row renderer for the one Serenity row; data from the existing Serenity row in `tools/neotone_page.json`
  (single source; no copy of notes).
- D2 canonical/duplication [recommendation]: new page self-canonical; Neotone page keeps its row (short) plus one
  "More about F# Serenity" link. Practice link identical on both (same `/#s=` code). No hreflang (scales/ pages are English-only, convention).
- D3 sitemap + llms.txt [convention]: both are hand-maintained; hand-edit one entry each.
- D3b hub [checked: scales/index.html lists every sibling page, incl. /scales/neotone/]: recommend listing the new page
  in the scales/index.html hub (hand edit, one link) so the hub stays complete.
- D4 JSON-LD [convention; gen_scale_page.py emits ld+json graph]: WebPage + BreadcrumbList (Scales > Neotone > F# Serenity)
  + FAQPage (4 Q/A from research) + `citation`/`isBasedOn` = the YouTube Short URL; `creator` Person "Reo Matsumoto"
  with `sameAs` only for URLs the owner approves (Q1).
- D5 copy [requirement: CLAUDE.md]: "scale" never "deck"; product "Handpan Theory"; English only; name spelled "Reo".
  Wording "a scale by Reo Matsumoto" (research: player/teacher, no maker evidence). Bio limited to H/M facts, no
  championship year, no birthplace (conflicts). Philosophy paraphrased, one short attributed fragment at most, presented as
  his general approach, attributed to its sources, never linked to or claimed about this scale.
- D5b FAQ origin wording: "created by Reo Matsumoto and shared in his video". Never state or imply it is not a factory
  scale (no evidence either way).
- D5c layout [reuse]: reuse the Neotone page notes table and its responsive CSS unchanged. Page order: H1 "F# Serenity
  handpan scale (Neotone Mutant)" pattern; one-sentence answer; breadcrumb; Practice CTA; drawing: no (none exists for
  the row; no new geometry). Visible FAQ text equals the FAQPage JSON-LD text byte for byte.
- D6 analytics [requirement]: page uses the same gated loader as other scale pages; no new event params.
- D7 size [assumption]: new page cap = existing `SIZE_CAP` (62 KiB-800); Neotone page gains only one link, budget < 120 B (headroom 283 B), asserted in a test.
- D8 i18n [rule check]: none; no app UI strings change.

## Assumptions (verified / gated)
- Verified: Serenity row and owner link decode (2026-11-07-neotone-fs-serenity.md). Verified: no competing page names the scale.
- Gated (human): the Short's channel, date, description (fetch returned title only); Reo's consent/preferred links (Q1);
  mode name for the pitch set (do not print unless owner confirms).

## Why smallest
One generator mode reusing existing builders and one JSON row; no new data file, no app change, tests extend existing classes.

## Phases
1. P0 prereq: PR #954 head (`claude/neotone-fs-serenity`) carries the Serenity row in tools/neotone_page.json and it reads
   "Reo Matsumoto"; owner answers Q1-Q4; owner records the Short's channel and date in this file. Owner: owner.
   Accept: row exists and reads "Reo Matsumoto" at that head; answers and Short channel+date recorded here.
2. P1 lane `claude/serenity-page` (worktree based on the head of `claude/neotone-fs-serenity`, PR #954):
   tests first, then generator mode, generate page, sitemap/llms/hub hand edits, Neotone link. Deliverable: PR M (main, held) + PR D (dev).
   Accept: page at slug renders row, FAQ, Practice link; Neotone page links it and stays < NEO_SIZE_CAP; 375px viewport shows no page horizontal scroll.
   Verify: `python3 -m unittest tests.test_scale_pages tests.test_site_files && python3 tools/gen_scale_page.py --serenity --check && python3 tools/gen_scale_page.py --neotone --check && python3 tools/validate.py && git diff --exit-code origin/claude/neotone-fs-serenity -- data/decks.json index.html src data/i18n && python3 -m unittest discover`
3. P2 DEV check + owner QA, then main stays held for owner.

## Lane ownership
`claude/serenity-page`: tools/gen_scale_page.py (new mode + Neotone link only), scales/f-sharp-serenity-neotone/index.html
(generated), scales/neotone/index.html (generated), tests/test_scale_pages.py (new SerenityPageTest; NeotonePageTest link test),
sitemap.xml, llms.txt, scales/index.html (one hub link), one tests/mutants/sp_serenity_*.patch, README mutant count / FLOORS from CI artifacts.

## Tests (by behaviour)
- Page exists, self-canonical, title contains "F# Serenity" + "Neotone Mutant", description <= existing limit.
- Notes table equals the Neotone row (read from neotone_page.json, not restated).
- Practice href byte-equal to the Neotone row's href.
- JSON-LD parses; no FAQ section and no FAQPage; citation URL = Short; no "deck" in visible text; "Reo Matsumoto" present, "Rep" absent.
- Neotone page links the new page, the link adds < 120 B, and the page stays < NEO_SIZE_CAP; new page < SIZE_CAP.
- Visible FAQ text equals the JSON-LD FAQPage text; page order H1 > answer > breadcrumb > Practice CTA.
- Page is caught by the existing one-level `scales/*/index.html` globs (shared head, analytics, sitemap equality).
- 375px: no page horizontal scroll (e2e or browser check, per docs/testing/browser.md).
- Sitemap/llms list the URL exactly once; GA loader gating test pattern reused (SeoDeltaTest/SharedBrownHeadTest style).
- Mutants: drop the FAQ block; swap the canonical to the Neotone URL. Strip index lines, `.` wildcards in `# suite:`.

## Verification split
Automated: verify command + CI `validate` at verified head (scoped mutation). Self: byte counts, diff stat.
Independent: fresh reviewer at head SHA (/review read-only) incl. fact check of every bio sentence vs research URLs.
Human: served DEV `/scales/f-sharp-serenity-neotone/` (docs/testing/browser.md), owner QA; main merge owner-gated.

## Risks
- Facts about a living person: only H/M facts, cited; owner/Reo review (Q1). Remove on request.
- Attribution: "by Reo Matsumoto", link his video; never imply Neotone endorsement.
- Image/copyright: no thumbnails or frames; no transcript text; short fragment max.
- Page size: Neotone 283 B headroom; link only.
- Duplication: self-canonical new page, short Neotone row, distinct titles.
- Credit-fix conflict: stack on its head; generated files regenerated, never hand-merged.

## Recovery
Revert the lane commit; on dev via `claude/dev-revert-serenity-page`; sitemap entry leaves with it.

## Open owner questions (max 4)
- Q1 Contact/credit links: recommend linking his Short and masterthehandpan profile only, and messaging him for a check before main release.
- Q2 Video: recommend a plain link (no embed: no third-party script, privacy and size).
- Q3 Slug: recommend flat `/scales/f-sharp-serenity-neotone/` (joins the one-level globs in tests/test_site_files.py and
  tests/test_scale_pages.py). Alternative: nested `/scales/neotone/f-sharp-serenity/`; extra cost: recursive globs in both
  test files and the lane must own tests/test_site_files.py.
- Q4 Bio depth: recommend a 2-3 sentence bio (Amsterdam-based Japanese handpan player, teacher, beatboxer) plus philosophy paraphrase.

## Continuation point / stop
Next: owner answers Q1-Q4 and records the Short's channel/date; integrator dispatches P1. Stop: plan ready, gated on P0.

## Review log
- 2026-11-07 independent review (eng + design), verdict NOT READY. Highs: R1 nested slug escapes every
  `scales/*/index.html` glob guard (test_site_files sitemap equality fails once the entry is added; shared-head /
  analytics / header tests skip the page) and test_site_files.py is not owned; R2 the "existing Serenity row" is on
  dev only (origin/dev 6612beec), not main, so a main-based lane has no row. Mediums: R3 Short metadata gate missing
  from P0 acceptance; R4 FAQ "not a factory Neotone scale" rests on absence of evidence; R5 11-column notes table at
  375px unspecified; R6 philosophy must be framed as general, not about Serenity. Details in the reviewer report.

### Round 1 dispositions
- R1: flat slug `/scales/f-sharp-serenity-neotone/` recommended (Goal, Q3, ownership); nested kept as Q3 alternative with recursive globs + test_site_files.py ownership as its cost.
- R2: P0 requires the Serenity row reading "Reo Matsumoto" at the PR #954 head; lane based on `claude/neotone-fs-serenity` head, not main.
- R3: P0 acceptance adds owner-recorded Short channel and date.
- R4: FAQ says "created by Reo Matsumoto and shared in his video"; never denies factory origin (D5b).
- R5: D5c reuses Neotone table + responsive CSS, fixes page order, no drawing, FAQ text == JSON-LD; 375px no-horizontal-scroll check in P1 accept + tests.
- R6: philosophy framed as his general approach, attributed, not tied to this scale (D5).
- R7: sitemap/llms.txt are hand edits (D3); hub listing recommended yes, every sibling is listed in scales/index.html (D3b, ownership).
- R8: Neotone link budget < 120 B, asserted in a test (D7, Tests).
- R9: verify adds tests.test_site_files and `python3 -m unittest discover`.

## Round 2 review (2026-11-07, independent)
R1-R9 verified resolved against the repo: one-level globs at tests/test_site_files.py (sitemap equality) and
tests/test_scale_pages.py (PAGES, NEO_TEXT_RULE) catch the flat slug; origin/claude/neotone-fs-serenity head f6a023f2 (PR #954,
OPEN, base main) carries the Serenity row with credit "by Reo Matsumoto"; Neotone page 67301 B vs NEO_SIZE_CAP 67584 = 283 B.
- S1 high: D3b/ownership say hand-edit scales/index.html, but the hub is GENERATED (`hub_page` in gen_scale_page.py, hard-coded
  Neotone section; `--hub --check` asserted in test_scale_pages). A hand edit fails the suite. Fix: add the link in `hub_page`,
  regenerate with `--hub`; ownership reads "gen_scale_page.py hub_page + scales/index.html (generated)"; verify adds `--hub --check`.
- S2 low: research file's AEO line still says FAQ "is it a factory Neotone scale - no" and a mode inference "F# natural minor";
  D5b/gate override them. Fix: brief lane + reviewer that D5b and the gate win over the research file; print neither.
- S3 low: P1 base is a moving PR head; record the #954 head SHA at dispatch and rebase-regenerate if it moves.
- S4 low (design): breadcrumb below the H1 and answer departs from sibling pages; follow the existing page's breadcrumb position.
Readiness: 1 FAIL (S1), 2-9 PASS. Verdict: NOT READY until S1 is applied (one-line fix).

## Owner answers (2026-11-07) and round 2 dispositions

These override any earlier text in this plan and in the research file.

- Q1: owner: "He's not a maker. He's a well known handpan musician and beatboxer. A scale by Reo is accurate." Credit line: "a scale by Reo Matsumoto". Bio calls him a handpan musician and beatboxer, never a maker.
- Q2: plain link to the Short, no embed.
- Q3: flat slug `/scales/f-sharp-serenity-neotone/`.
- Q4: not answered; AFK default = recommendation (2-3 sourced sentences + attributed paraphrase of his general philosophy).
- S1 (fixed): the hub is generated. Add the Serenity link in `hub_page` in `tools/gen_scale_page.py`, regenerate with `python3 tools/gen_scale_page.py --hub`. Ownership: "gen_scale_page.py hub_page + scales/index.html (generated)". Verify adds `python3 tools/gen_scale_page.py --hub --check`. No hand edit of scales/index.html.
- S2 (fixed): D5b and the gates win over the research file. Never print "not a factory scale" or "F# natural minor/Aeolian".
- S3 (fixed): record #954's head SHA at dispatch; if it moves, rebase and regenerate.
- S4 (fixed): breadcrumb sits where sibling scale pages place it.
- P0 owner action still open: record the Short's channel and upload date (lane may proceed; the page cites only the Short URL until then).
