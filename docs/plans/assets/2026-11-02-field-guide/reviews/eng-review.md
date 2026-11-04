# Eng review R2: Field guide brand plan (sha256 7b5c32c8, same bytes as the committed plan in 0e085950)

Method: I did not load the plan-eng-review skill. I reviewed directly on its dimensions (architecture, data flow, edge cases, tests, performance, failure modes). Static checks only; nothing was executed except greps, git and JSON reads.

## Verdict: READY (for handoff; no blocker or high findings). Fix the medium findings before Phase 0 starts.

## Verified
- All 8 quoted e2e titles, FT included, occur exactly once each as `test("…")` in tests/e2e.test.js. Every named unittest and tool file exists.
- panel_fit.js `parseArgs` accepts --base, --candidate, --font, --workers and --lang. Under `runFont` the base Root gets no lang, so the base stays English, as the plan says.
- gen_scale_page.py `main` accepts slugs, --hub, --fixture and --check. scale_pages.json has 16 rows and there are 16 scale dirs. CSS_HEAD, INDEX_CSS_HEAD, CSS_EXTRA, CARD_CSS and card_html all exist.
- Leakage claims hold:
  - index.html `:root` sets `--paper:#ffffff`.
  - `.mode` is shared by the trigger and the bars.
  - Cards use declarative shadow DOM (`template shadowrootmode`).
  - `.prog` in CSS_EXTRA reads --fg, --h, --muted, --r, --s and --t from CSS_HEAD.
- Ancestry: origin/main...origin/dev is 0/37. `git diff 19a91883 origin/dev` is empty. main vs dev differs only under docs/plans and docs/prompts. The 18 manifest files are all tracked.

## Findings
**ENG-R2-1 medium: tests/app.test.js also pins the old logo, and no lane owns it.**
- Evidence: in app.test.js, the favicon test expects `#E6C99B` ≥8, `fav-smm` and the teal/amber ban; the `LG:` lockup tests sit nearby; there is a `tests/mutants/nm_favicon_ink_dropped.patch`. Lane A owns only test_icons.py, and Phase 1 runs only `tests.test_icons`.
- Fix: add the app.test.js favicon and LG tests and their mutants to Lane A, and add `node --test --test-name-pattern='favicon|LG:' tests/app.test.js` to Phase 1.

**ENG-R2-2 medium: make_icons.py does not produce the srcset PNGs, and the 223×64 slot is pinned in several places.**
- Evidence: commit a9e247b9 says the PNGs were "rendered from brand/*.svg in Chromium". make_icons only renders touch and og via fitz, and the current SVGs use feGaussianBlur filters. 223×64 appears in gen_scale_page `LOCKUP` / `SCALE_LOCKUP_IMG`, in handpan-101 and in 404.html. test_scale_pages `FULL_IMG`, `MONO_SOURCE` and `test_lockup_rasters_exist_at_two_and_three_times_the_slot` pin `223*scale x 64*scale`.
- Fix: state that make_icons gains the four @2x/@3x outputs under `--check`, with a named renderer (fitz needs a filter-free vector). If the lockup's aspect ratio changes, the width/height attributes, the three page sources and the HeaderLockupTest oracles all change in one owned step.

**ENG-R2-3 medium: whether reading pages follow the system color scheme is undecided.**
- Evidence: CSS_HEAD sets `color-scheme:light dark` with a dark media block. `SCALE_LOCKUP_IMG` switches to mono-light only under `prefers-color-scheme: light`. The plan says "outer reading light" while also saying protected plates stay unchanged "under both system schemes". Read together, an always-light ground would show the ivory lockup on a light background in dark mode.
- Fix: decide either always-light outer reading (one ink lockup, drop the `<picture>` switch) or scheme-adaptive, and name the test changes that follow.

**ENG-R2-4 medium: Phase 0 ancestry text is stale and over-specified.**
- Evidence: the plan says main/dev diverge 1/36. Actual is 0/37 and the code trees are equal.
- Fix: replace that text with: "If `git diff --quiet origin/main origin/dev -- . ':!docs/plans' ':!docs/prompts'`, branch from origin/main and open M and D from that one head. Otherwise stop and amend." Drop the dev-implementation-then-transfer procedure. A dev-based head would carry dev's merge commits into M.

**ENG-R2-5 medium: the Linear section is stale.**
- Evidence: TRI-49 exists with priority High (owner mapping P1=High, 2026-10-28). The plan still says the connector is missing and "do not assume P1 equals High".
- Fix: record TRI-49 and High, use `Refs TRI-49`, and remove the connect/resolve and create steps. Mark linear-pending.json as applied.

**ENG-R2-6 medium: the vector-conversion method has no concrete procedure or objective check.** This is a gate, not a blocker.
- Evidence: approved-logo-master.png is 1154×979 with a 2-bit colormap (4 colors), so tracing each palette layer is bounded. potrace is at /opt/homebrew/bin and is not a CI dependency.
- Fix: name the method (potrace per palette layer, or hand-built primitives). Before the owner gate, require an alpha-mask overlay: `make_icons.raster` at 1154 px compared with `differing_fraction`, under a stated threshold.

**ENG-R2-7 medium: the i18n step is conditional and its locale set is ambiguous.**
- Evidence: CLAUDE.md requires keys, sync, audit and a fit check for every UI feature, and no repo tool defines "audit". The plan says "each affected supported candidate locale". A CSS change affects all 8 tables.
- Fix: make the step unconditional:
  - run `python3 tools/sync_i18n.py --check`;
  - confirm the I18N block has no key diff against $BASE;
  - run panel_fit `--lang` for de, es, fr, it, ja, zh-Hans and zh-Hant;
  - define "audit" as that key-parity check.

**ENG-R2-8 low: panel_fit cannot give a per-locale baseline.**
- Evidence: the base is English, and `baseHtml === candHtml` short-circuits to 0 cells.
- Fix: state how a `--lang` failure is split between locale growth and brand growth, for example by inspecting the cell against `LANG_ALLOWANCE_PX`.

**ENG-R2-9 low: FLOORS and the README mutant count have no owner.**
- Evidence: suite_health `FLOORS` has rows for test_icons.py (6), test_scale_pages.py (84) and app.test.js (1011). README says 1753 mutants, checked by test_readme_currency as `<=`.
- Fix: give Lane I tests/suite_health.py and README.md for row raises and the count, set from main CI artifacts.

## Criteria
| # | Criterion | Result |
|---|---|---|
| 1 | No open blocker/high | PASS |
| 2 | Assumptions verified or gated | PASS, with notes (R2-4, R2-5 stale) |
| 3 | Smallest approach justified | PASS |
| 4 | Phase owner and acceptance | PASS (Phase 1 acceptance is subjective; R2-6) |
| 5 | Dependencies listed | PASS |
| 6 | Verification coverage | PASS (app.test.js runs in Phase 2; R2-1 is about ownership) |
| 7 | Recovery feasible | PASS |
| 8 | Continuation precise | PASS, with notes (R2-4, R2-5) |
| 9 | Scope and stop clear | PASS (R2-3 should be decided) |
| 10 | Protected boundary and same-base proof | PASS |
| 11 | Self-contained handoff | PASS |

pending-linear-writes: []
