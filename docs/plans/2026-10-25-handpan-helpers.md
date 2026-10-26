# Handpan Helpers resource — implementation plan

**Planning draft; implementation is not authorized.** Produced by running the
refined [planning prompt](2026-10-25-handpan-helpers-prompt.md), after independent
engineering and frontend reconnaissance. Independent engineering/design plan
reviews are **not yet completed**; root will append their findings and revisions.
Saved-variants delivery retains priority. No application, test, instruction, skill
or integration changes have been made by this task.

## Decision, scope and evidence

Add a native outbound Handpan Helpers link beside HANDPAN 101, on its left, using
the existing two-column Resources pattern. Preserve all six existing destinations,
HANDPAN 101 as the last outbound link, ABOUT alone/full-width and Language after
Resources. This is a source-feasible recommendation, **not measured fit or usability
acceptance**. Full labels, current typography and existing fit budgets are fixed.

```text
Resources
[ HANDPANER | DING & TONES | HTC ]
[ AMY: PROGRESSIONS | AMY: BOTTOM NOTES ]
[ HANDPAN HELPERS | HANDPAN 101 ]
[ ABOUT ]
Language
```

| Evidence | Status and implication |
|---|---|
| DEV582 source `92d6516bd533abb4a1e4fb7c8116b9836f648296`; local `/private/tmp/handpan-share-hotfix.urAbvO/integration` | Inspected immutable baseline for this plan. Resolve live DEV at implementation activation; do not ship partial saved-variants integration or overwrite its work. |
| `index.html:306–323`, `1734–1770` | Existing `.modebar.duo` keeps two equal-flex siblings on one row; labels wrap, horizontal padding is 6px. Current third row contains 101 alone. Reuse is a hypothesis requiring geometry checks. |
| `CLAUDE.md:411–429` | Explicit 101-alone/full-width rule must change. Owner requires exact instruction-diff approval; plan approval alone does not waive it. ABOUT and budget rules stay. |
| `index.html:13804`, `panelStops()` | Native `a.mode[id^="res-"]` already enter the focus sequence in DOM order. No new production event handler is needed. |
| `tests/app.test.js:3650`, PM rule7; `10730`, ABOUT; `14877`, language stops | Existing literal requirements must retain all unaffected assertions; change only approved row composition/count expectation. |
| `tests/e2e.test.js:1395`, `RESOURCES`; `1882`, structure; `2100`, activation | Explicit six-link table becomes seven; rows become `[3,2,2,0]`. Shared click/Enter journey can cover the new entry. |
| `tools/probe/panel_fit.js:42–87` | Existing tolerances and Resources64px/About52px/Language88px allowances remain unchanged. New `res-*` activates existing Resources allowance; it does not excuse moving prior controls under rule2. |
| Public `https://handpanhelpers.klangzeug.de/` observation | Root fetched HTTP200, no redirect, title Handpan Helpers and a client-rendered SPA shell. Web-reader/search were unavailable. Rendered destination features and usability are unverified; no feature description is justified. |
| Frontend-design skill, shared browser runbook and HTC compact plan | Consulted for restraint, subject-specific copy, responsive critique and measurable acceptance. Preserve established branding; no generic redesign. Original global gstack setup/telemetry/runtime was not activated. |

Alternatives considered: pairing with ABOUT mixes external navigation and a dialog
and violates its alone/full-width contract; four links in the sites row disturbs
the accepted trio and adds narrow-label risk; another full-width row adds height.
None has been measured infeasible. The proposed third-row pair changes fewer
contracts while avoiding a new row. If it fails geometry, revise and re-review;
do not quietly choose a weaker alternative.

**Not in scope:** site embedding or content scraping, new analytics, third-party
assets/scripts/fonts, card/scale/parser/storage changes, locale tone changes,
other resource URLs, global skills/configuration or main release. No new design
system, animation, loading/error widget, abbreviation, ellipsis or font reduction.

## Exact link and interaction contract

Proposed anchor, inserted immediately before the existing `res-handpan-101`:

```html
<a class="mode" id="res-handpan-helpers"
   href="https://handpanhelpers.klangzeug.de/"
   target="_blank" rel="noopener">HANDPAN HELPERS</a>
```

Change only that containing row to `class="modebar duo"`. The visible proper name
is its native accessible name, consistent with HANDPANER/DING & TONES/HTC. No
new translation key or redundant aria-label is required. Test all eight existing
languages because surrounding localized controls affect panel height/fit. If a
review demonstrates extra descriptive copy is necessary, hold for a scoped plan
amendment covering all locale tables and generated inline i18n, with visible-name
inclusion and existing Du/Dein/vous conventions.

| State/journey | Observable requirement |
|---|---|
| Ready/modal/sidebar | Seven resource anchors in exact order; four rows; pair and all existing controls rendered, readable and reachable. ABOUT remains a button alone; Language remains next. |
| Hover/focus | Existing control treatment; focus ring visible and unobscured. No new CSS override unless demonstrated necessary within the same limits. |
| Tab/Shift+Tab | Helpers is one new stop immediately before101;101→ABOUT→Language remains; existing modal trap/wrap and Escape return still work. |
| Click/Enter | Exactly one native activation to the literal HTTPS destination in a new tab with opener isolation; Settings, practice mode and displayed card remain unchanged. |
| Destination slow/unavailable | Browser owns navigation/error UI; original app stays usable. App tests verify outbound intent without requiring this independent site's uptime. |
| Print/offline | No resource insertion into deck/card/print output, no new app dependency; a link may fail offline without affecting practice. |

## Instruction approval packet — proposed text only

Do **not** apply this patch until the owner explicitly approves this exact diff.
Rebase the proposal against the actual current file and re-request if meaning
changes. This replaces only the third-row description and the quoted test title:

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@
-  labels wrap inside their boxes), then `HANDPAN 101` alone (2026-10-08, lane PM:
-  a Google Doc link, `#res-handpan-101`, full width, the last panel stop, so no
-  earlier control moved). They are links only, never on a deck or card,
+  labels wrap inside their boxes), then `HANDPAN HELPERS` (`#res-handpan-helpers`,
+  https://handpanhelpers.klangzeug.de/) and `HANDPAN 101` (a Google Doc link,
+  `#res-handpan-101`) in one equal-width `duo` row, in that order. Complete labels
+  wrap inside 44px-minimum targets; HANDPAN 101 remains the last outbound
+  Resources link. They are links only, never on a deck or card,
@@
-  link, a Google Doc in a new tab, alone in its row" asserts four rows and that
+  link, a Google Doc in a new tab, beside Handpan Helpers" asserts four rows and that
```

The existing preceding heading, three link rows plus fourth ABOUT row, About
semantics, remaining test description, fit allowances and all workflow rules stay
unchanged. Proposed markup comment should likewise describe the pair accurately.
Existing `.duo` comment saying only Amy uses it needs a factual comment update;
no functional shared-CSS change is planned.

## Swarm lanes and dependency graph

Root is sole integrator/browser operator. On activation record actual owner, clean
branch/ref/worktree and last/next in the shared DEV ledger. Allocate fresh isolated
worktrees; do not edit original locked/dirty trees. Respect actual four-agent
concurrency limit: T and U preparation can overlap, mutation follows committed
source; independent ENG/design reviews can run together once an immutable
candidate exists. One owner per file; root resolves any intersecting test support.

| Lane | Owned files/deliverable | Dependencies and boundary |
|---|---|---|
| T — spec-first acceptance | `tests/app.test.js`, `tests/e2e.test.js`; literal resource inventory, row/navigation/geometry oracles and baseline assertionRED | Approved exact requirement; no app edits or worker browsers. Preserve original registrations and meaningful assertions. |
| U — resource markup | `index.html` markup plus relevant factual comments only; exact approved `CLAUDE.md` packet applied by root | T freezes required assertions; separate tree, no concurrent index writer, no engine/generated-data edits. Locale files unchanged. |
| M — mutation proof | `tests/mutants/hhr_*.patch` and necessary intent-preserving contextual refreshes | Frozen passing source/tests; disposable committed scratch. Generate diffs, omit blob-index lines; never mutate another lane's tree. |
| Root — narrow support/integration | Conditional ID registration in `tools/sandbox.js`, targeted fixture delta in `tests/fixtures/i18n_english_dom_v1.json` if discovery requires it; `tests/suite_health.py` only observed own-floor increases; plan/ledger | Inspect necessity before writing. No fake DOM behavior for fit; no broad fixture regeneration. Root serializes support handoff so T never edits those files concurrently. |
| Independent ENG/design | Read-only exact plan/candidate findings, evidence review and final disposition | Non-author contexts, no hidden application edits, no self-review substituted for independence. |

```text
reviewed plan + implementation scope + exact CLAUDE approval
  -> freeze live DEV baseline / lane ownership
  -> T acceptance RED -> U minimal markup -> same acceptance GREEN
  -> M baseline-green / intended-fault-red -> independent final reviews
  -> exact-head full Linux validate -> actual served DEV verification
  -> owner QA / separate explicit main decision
```

## Tests, mutants and usability acceptance

T must identify current exact titles/counts at activation rather than reuse today's
numbers. Existing Resources tests gain a literal Helpers entry, not an expected
value read back from production. PM rule7 changes only approved row composition
and its title to “PM rule 7: HANDPAN 101 is the last Resources link, a Google Doc
in a new tab, beside Handpan Helpers”; retain href, opener isolation, no script,
ABOUT alone and four-row assertions. Preserve TR-1's sites-trio behavior.

| Requirement | Existing test or proposed new group | Discriminating fault |
|---|---|---|
| Exact destination/native semantics/order | PM rule7 plus new `HHR: the Helpers resource is a native new-tab link immediately before HANDPAN 101`; native Resources structure table becomes seven and `[3,2,2,0]` | Missing anchor, wrong href, same-tab, no noopener; each targeted test must pass clean and fail at its intended assertion. |
| Keyboard and unchanged practice | Existing “Resources links activate on click and on Enter…” and panel-stop/About/Language tests, literal new stop included | Omit new stop; prevent Enter; close panel/change card on activation. Preserve state before/after in every mode. |
| Shared third-row geometry | New native `HHR: Helpers and HANDPAN 101 remain equal usable targets with complete labels` | Drop duo, unequal flex, clip target/text/ancestor or hide Helpers; fault must reach a real measured cell and fail geometry. |
| Whole-panel regression | Existing panel-fit and Resources desktop/landscape/phone journeys | Preserve current budgets and all old control position assertions. A nominal allowance or removal of an old test is not proof. |
| Existing visual/data contracts | Existing English DOM fixture, locale parity, engine/data sync and print/card checks | Only exact new DOM node delta may change approved fixture; no old text, key, card, deck, PDF or generated-engine change. |

Review `pm_handpan101_not_last`, `pm_handpan101_outside_tab_trap`,
`pm_handpan101_same_tab`, `qr_res_wrong_href`, `qr_res_no_noopener`,
`qr_res_link_not_a_stop`, `qr_res_link_inert`, `qr_res_hidden_landscape`,
`mr_amy_*`, `tr_trio_*` and any patch context touching the Resources block.
Retain each behavioral intent, refreshing only stale context or expressly
superseded 101-alone policy. No syntax/setup/timeout/skip kill credit.

**Geometry oracle:** both controls have positive equal widths within existing
1px comparison tolerance, common visual row, minimum44px width and height, complete
nonempty label rectangles contained by targets and every clipping ancestor, no
overlap/ellipsis/hidden content, centered labels and readable line spacing.
Capture actual element/text rectangles and focus state. Do not infer success from
`.duo`, screenshots alone, measured zero-size elements or programmatic clicks.

**Matrix:** eight resolved locales `en,de,fr,it,es,ja,zh-Hant,zh-Hans`; modesA/B/S;
verified real and fallback font modes. Required representative cells include
320×568,380×700,380×740,844×390,1280×320,1024×700,1024×746,1280×746, and actual
CSSOM-derived media-query edges from both frozen baseline and candidate. Run the
existing complete panel-fit domain, not only those examples. Include desktop
sidebar and modal transitions, zoom/text enlargement within existing supported
behavior; explicitly report uncovered native Safari/device/screenreader behavior.
Retain existing tolerances and allowance equations. Nonresource controls must not
move offscreen where the baseline showed them.

For planning, **no candidate HTML was added and no browser/probe ran**. Label fit
and touch/keyboard usability remain unverified until the same oracle runs on
baselineRED and candidateGREEN. Existing capture-based outbound tests intentionally
prevent real destination navigation; separately check the exact destination's
HTTP identity/availability and opener-safe new-tab behavior without claiming the
capture test proves the remote application is usable.

## Execution gates, stop conditions and rollback

1. **Activation:** fresh live DEV/ledger/ownership and relevant tests confirmed;
   dedicated worktree; reviewed plan and explicit implementation scope. Exact
   CLAUDE packet separately approved. If approval/ref/ownership is absent, stop.
2. **TDD:** freeze literal requirements; root runs bounded targeted unit/native
   baseline. Missing-link/row assertion must fail as intended, not from a browser
   startup error. Keep raw logs, source/test hashes, selected/executed counts and
   cleanup. Then U changes minimal markup and the same oracles must pass.
3. **Regression:** root runs full existing panel-fit probe per actual language and
   font, from candidate tree with immutable `--base <DEV_SHA>` and explicit
   `--candidate <CANDIDATE_SHA> --font both --lang <code>`, plus native journeys.
   Example CLI is a template: replace both placeholders; freeze exact commands,
   expected nonzero cell/test counts and outer bounds before execution. No worker
   browser jobs, shared-owner profile use or unknown process cleanup.
4. **Mutation/final review:** all new-group meaningful mutants proved with actual
   runner protocol; independent non-author ENG/design final review at exact
   resulting head, all material findings addressed. Raise own test floors only
   after observed passing counts; never lower existing floors.
5. **Delivery:** full exact-head Linux `validate`/all required CI artifacts, actual
   served DEV bytes/revision and affected journeys independently verified. Keep
   application/locale synchronization and current workstream ledger intact in
   any integration merge. Main remains held without explicit owner consent.

If a label clips, target shrinks, fit fails or prior controls move, first revise
the minimal scoped row treatment with TDD and fresh design review. Do not hide
controls, shrink typography, add allowances, increase tolerances or alter fit
equations. A different layout or modified contract needs a plan amendment and
approval. Missing tools/font/device coverage means unverified, not pass.

Rollback before delivery: revert only owned unmerged feature changes in the
isolated worktree, preserving test failures/evidence and unrelated edits. After
DEV delivery use a reviewed reversible DEV revert; never reset shared branches
or clear saved data. Restore exact instruction text with the corresponding
approved change if the feature is reverted; no broader Claude behavior change.

## Readiness and handoff

- Current last completed action: prompt executed to this plan using inspected
  source and independent reconnaissance; no application or usability execution.
- Next: independent engineering and design plan review, address/re-review findings
  at final plan hash, then root publishes plan/ledger through authorized document
  workflow. Do not let this optional Resources addition interrupt saved variants.
- Required owner decisions before code: implementation scope and the exact
  CLAUDE patch above. No new resource label/content preference needs interviewing
  now: owner specified destination and permits pairing a full-width row.
- Current quality status: evidence-grounded plan drafted; runtime feasibility and
  independent plan clearance **not yet demonstrated**. “Near10/10” means no
  unresolved material omission against the prompt criteria, never a self-score.
