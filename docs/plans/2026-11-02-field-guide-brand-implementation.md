# Field guide brand implementation — handoff plan

Status: **planned / not started; independently reviewed for handoff.** Planning only, 2026-11-02. No implementation, push, PR, merge or deployment is authorized. Creating this planning worktree does not mean building has begun.

Intended archive: `docs/plans/2026-11-02-field-guide-brand-implementation.md`. Current planning checkout: `/Users/ray/Projects/handpan-theory-brand`, branch `design/handpan-theory-brand`, initial verified base `19a918836242` (short `19a91883`); local documentation-only handoff commits follow that base. At initial verification, only the approved visual package was untracked; inspect status again because the planning integrator may add handoff documents. This document transfers work to a different integrator; it does not appoint its author as implementer.

## Goal and hard boundaries

Apply the selected **01 / Field guide** direction and **Two contours** identity to the actual root app, menu, Add/Edit Scale and Layout views, About reading overlay, scale hub, all 16 scale learning pages, Handpan 101 and 404. Preserve existing information, modes and workflows. Make the learning surfaces recognizably part of the same product without adding facts, content features or speculative navigation.

Protected: every card and progression renderer, palette, font, readability, diagram geometry, note/index conventions, data and print layout; engine behavior, saved-scale/storage semantics and existing share links. Protect root cards and progression rails and learning-page shadow cards, progression rails/controls/geometry. The Layout diagram is a protected rendering within a restyled form. No watermark, print cover, margin mark or other PDF change. No framework, bundler, new runtime dependency, new performance harness, frame-timing/rAF A-B-A/profiler infrastructure or saved-variants redesign.

Full untranslated **Handpan Theory** at every branded placement; never HPT. Existing localization tables, CJK/font fallbacks, input grammar, focus/inert behavior, keyboard navigation, accessibility, touch targets, source links, mode and difficulty controls, print/paper controls and language selector stay functional. Active-scale-chip Edit, menu Add, Scale/Layout tabs and the existing desktop sidebar breakpoint stay.

## Settled decisions and durable evidence

The evidence package is `docs/plans/assets/2026-11-02-field-guide/`; `manifest.json` records hashes, provenance, planning-only status and source-app hash. Read it and verify the bytes before continuing. Required references: `approved-brand-sheet.png`, `approved-root-mobile.png`, `approved-layout-editor.png`, `approved-tablet.png`, `approved-desktop.png`, `approved-logo-master.png`. Only the 01 row/column of comparison boards is selected. `selected-learning-reference.png` is directional, **not exact pixel/color/layout approval**; brand-sheet roles govern.

Approved roles: canvas `#0F0E0B`, paper `#F6F4ED`, field `#FFFFFF`, ink `#242424`, muted `#5E5850`, border `#8A847B`, action `#6756B5`. Practice stays warm dark; menus/forms/reading use light ground; violet belongs to links/actions/states, never the logo or protected instrument colors. Inactive controls remain neutral. Nunito Sans is the UI/reading face; protected Marcellus chord/progression names and Bitter note typography stay. The sheet proposes learning body 16px/1.5 and half-mark clear space; validate those applications rather than shrinking protected content to fit. Preserve the 64px compact header budget and existing spacing ramp/breakpoints.

The transparent master is ivory and appears blank on a white viewer background; alpha was confirmed and a dark composite inspected. The package includes `approved-logo-on-dark.png` as a viewing aid, with its manifest hash; the transparent PNG remains the master. Preserve ding, pan body, note dots, contour paths, openings, relative proportions and shape at every size. Ink/ivory recoloring is allowed by the sheet. A simplified small mark is forbidden. Recognition at 16px is unproven; show 16/32/48px actual-size evidence and report limitations without changing the master.

`token-check.json` checks proposed color pairs only; it is not a completed UI accessibility audit. `preservation-evidence.json` and source captures show historical mock preservation, not current implementation parity. Refresh baselines from the same implementation base, state, deck/chord, font mode, viewport, zoom and browser; freeze deterministic progression state before comparison. Never substitute historical screenshots for these baselines.

## Verified source map and smallest approach

Read `CLAUDE.md`, `docs/testing/browser.md`, `tests/CONTRACT.md` before work. Product ground truth remains `docs/CARD-SPEC.md` and `docs/ENGINE-SPEC.md`; inspect relevant sections before any scope amendment. Current generator interfaces and test titles below were inspected, not executed during drafting.

`index.html` is the independently functional app. `tools/make_icons.py` owns its brand lockup region and favicon URI plus `apple-touch-icon.png` and `og.png`, using `brand/horizontal-full.svg`, `mark-small.svg`, `app-icon-full.svg` and `stacked-full.svg`. Reading headers also consume `horizontal-mono-light.svg` and 2x/3x PNG counterparts. Existing `docs/brand/make_logo.py` procedurally generates the old artwork, including a simplified small mark; do not rerun it unchanged or claim it creates Two contours. Decide and document one faithful new master/source path before asset work; keep `make_icons.py` as the public sync entry point and make its source dimensions/transforms/render recipes fit that master. Cover the reading-header raster derivatives through that deterministic generator path; do not maintain unrelated redraws or stale srcsets.

`tools/gen_scale_page.py` owns `scales/index.html` and all `scales/<slug>/index.html`: edit `CSS_HEAD`, `INDEX_CSS_HEAD`, `head`/lockup templates as needed, then regenerate. Leave `CARD_CSS`, `CSS_EXTRA`, `card_html`, swipe module/driver, scale rows, copy, fixture, colors and engine data intact. `handpan-101/index.html` and `404.html` are direct reading-page sources. About is `#about` in root. The smallest approach is source artwork plus scoped CSS and existing generator sync, retaining DOM structure and interactions; no shared stylesheet extraction or new site framework is necessary.

**CSS leakage risks:** root `--paper` is white card paper, not the new warm UI paper; `--ink`, `--root`, `--tone`, `--ga`, `--gb`, `--card-w`, spacing and `--ring` feed protected output/layout. Do not repurpose them globally. `.mode` is shared by header/menus; global `h1`, `header`, `button`, `a`, `svg`, `input`, body font/color and `color-scheme` can change cards, controls, native selects or inherited SVG paints. Scope new UI tokens/rules under `#settings-panel`, `.sheetsurf`, `#about` and explicit branding selectors, with deliberate expanded-trigger styling. Keep practice controls/chips' instrument accents. Scope reading text styles outside protected cards/progressions; shadow DOM isolates selectors but not inherited custom properties. Learning `.prog` uses `--bg/--fg/--muted/--s/--h/--t/--r`; explicitly preserve its existing values/plate and `.rail` typography in both system color schemes when making outer reading light. Do not let a parent UI font replace note-input or diagram typography.

## Ownership, waves and gates

Preserve this planning-only checkout and its committed package. After explicit implementation approval, create/use a separately named isolated code worktree (proposed `../handpan-theory-brand-implementation`, branch `design/handpan-theory-brand-implementation`) from the verified current development base; carry the owned planning commit/package forward without overwriting another worktree. This future worktree is not created by this plan. One future editor/integrator owns all shared files sequentially in that code worktree; no parallel editors are needed. Independent engineering and design reviewers are read-only and different from the author. If parallel editing becomes necessary, amend ownership first and give every editor a separate worktree. One integrator schedules the sole host-browser lease; other worktrees do not provide separate browser capacity.

| Lane / wave | Exclusive file ownership | Dependencies |
| --- | --- | --- |
| P / 0 readiness | This plan and evidence receipts only | Independent plan reviews; owner implementation grant; source/base recheck |
| A / 1 identity | `brand/*`, `tools/make_icons.py`, identity-specific `tests/test_icons.py`/generated mutants; old artwork generator only if replaced/retired deliberately | Visible approved master; reviewed faithful-conversion method; owner fidelity gate |
| U / 2 app surfaces | `index.html` outside generated regions; relevant localization sources only if copy must change | A accepted; same-base protected baselines |
| R / 3 reading | `tools/gen_scale_page.py`, `handpan-101/index.html`, `404.html` | A accepted; U CSS protection audit |
| I / 4 integration and evidence | Generated root regions, icons/OG, generated scale pages, plan receipts, final `DESIGN.md`/`.impeccable/design.json`; narrowly necessary tests/mutants | A/U/R finished; editor ownership yielded |

All phases below are **proposed future work**, not commands to run for this draft. `$BASE` and `$HEAD` mean immutable recorded SHAs, not branch names; `$ART` is a fresh owned absolute directory outside the checkout. Re-read candidate titles and freeze counts after any rebasing or test change.

### Phase 0 — continuation prerequisites

Owner: future integrator. Prerequisites: reviewed plan, owner explicitly authorizes implementation, no high/blocker plan finding, correct archived package, clean isolated checkout based on the then-current `dev`, named reviewers and browser lease/supervisor available. Do not implement from stale design-branch ancestry without comparing the new dev base and amending the plan for conflicts. Planning integrator reports origin/main...origin/dev divergence of 1 left / 36 right at this planning base: dev is not a simple main superset. Reconcile future base/paired-PR CI ancestry before editing; isolate brand commits so a branding main PR cannot bring unrelated DEV work into main. Preserve both histories; no reset/discard or base switch is authorized now. The future integrator must document a compatible dev-based implementation and main-PR strategy, then reverify ancestry. Bounded default: recheck ancestry and file-tree differences before editing. Review-time comparison found the two upstream code trees equal, with differences confined to three planning documents; do not assume that remains true. Implement in the verified dev-based code worktree, then transfer only owned branding/planning commits to a separate main-based release worktree/branch. Compare all affected application, generated, test and protected-source bytes against the dev implementation. When the only upstream differences remain documentation, use that isolated release head for the paired main/dev PRs required by CLAUDE.md, run full validate at that shared head, and hold main. If upstream code differences/dependencies prevent byte-equivalent isolation, stop and amend the strategy with the integrator; a held combined-DEV CI companion may be needed to validate the actual dev candidate, never permission to import unrelated DEV history into main or waive the same-head/CI gates. Neither release nor CI-companion branch may merge to main without owner consent.

Deliverable: readiness receipt with exact base, tool availability, package hashes and ownership. Observable acceptance: all assumptions below are resolved or explicit later gates; no hidden install requirement. Read-only proposed commands:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
node --version
python3 --version
node -e 'console.log(require("./tests/helpers/cdp.js").findBrowser())'
python3 -c 'import hashlib,json,pathlib; p=pathlib.Path("docs/plans/assets/2026-11-02-field-guide"); m=json.loads((p/"manifest.json").read_text()); assert all(hashlib.sha256((p/f["path"]).read_bytes()).hexdigest()==f["sha256"] for f in m["files"])'
```

Node 22, Python 3.12 and `requirements-ci.txt` PDF/font packages are CI prerequisites; unavailable local packages/browsers are gates, not implicit install authorization. Mac browser path must be set explicitly per runbook. Use a dedicated shell; unset inherited timeout/port/coverage overrides as documented. No browser launch until a single lease and reviewed bounded supervisor/cleanup are recorded.

### Phase 1 — faithful identity, before UI application

Owner: A editor; independent design reviewer plus owner decide fidelity. Prerequisite: phase 0 complete and inspect master with correct alpha/ground. Deliverable: one vector master with derived lockups, original master provenance and generator recipe; side-by-side and overlay evidence at master size, intended header slot and 16/32/48px, ivory/dark and ink/light. Observable acceptance: owner recognizes faithful shape/proportions with no simplification and full-name wordmark; no drift in generated consumers, accessible home/title names retained. Raster approval does not approve an independently drawn vector. If faithful conversion fails, stop asset application, retain evidence and request a focused master/fidelity decision.

Proposed sync/check commands after a reviewed source/generator edit:

```sh
python3 tools/make_icons.py
python3 tools/make_icons.py --check
python3 -m unittest tests.test_icons -v
```

Self-review must confirm the same master geometry drives favicon, touch, OG and every header, including srcset rasters. The sync check proves source/output consistency, not visual fidelity or tiny recognition. Do not lower pixel tolerances to hide drift. Do not add visual tests that merely mirror the new implementation. Existing `tests/test_icons.py` pins the old transform, gold counts, IDs and teal/gold mutation targets. A owns migration of those obsolete artwork-specific oracles to the approved identity contract, preserving source/output synchronization, accessible stripping, ID safety and meaningful negative recoloring/geometry checks. Generate any required killing mutants under tests/CONTRACT.md; preserve tolerances, floors and substantive failure sensitivity. Do not merely delete old assertions to make the replacement pass.

### Phase 2 — root menu and forms

Owner: U editor, followed by independent engineering/design review. Prerequisites: identity fidelity gate passed and fresh protected baselines captured under the reserved browser job. Deliverable: scoped light menu/forms/About and violet UI states using the approved hierarchy; unchanged practice card/progression geometry and behavior. Acceptance: modes A/B/S, difficulties, Share, Add/Edit/Delete, built-in/custom scales, Standard/Neotone/Mirror, Scale/Layout, validation/error/disabled states, menu restoration and language selection remain reachable. Check expanded menu header contrast and visible focus separately from selected state. Preserve root device/color-scheme behavior and native select readability.

Proposed nonbrowser commands:

```sh
node --test tests/app.test.js
node tools/boot_sim.js
python3 tools/validate.py
```

For each following browser selector, run the exact command template below separately; each literal title is expected to select **one executed passing test**, with filtered tests counted separately. Required skips, cancellation, timeout and zero matches fail coverage.

```sh
node --test --test-name-pattern='boots with the default deck loaded' tests/e2e.test.js
node --test --test-name-pattern='card lines and diagram stay inside the card at 380px' tests/e2e.test.js
node --test --test-name-pattern='the settings trigger opens and closes the full-screen panel, and reports its own state' tests/e2e.test.js
node --test --test-name-pattern='Tab is trapped inside the settings panel and cycles every stop, wrapping both ways' tests/e2e.test.js
node --test --test-name-pattern='NEO: in every locale at 380px the switch, checkbox, name field and hints fit inside the sheet' tests/e2e.test.js
node --test --test-name-pattern='the header and footer stay inside their pixel budget, so the card keeps its size' tests/e2e.test.js
node --test --test-name-pattern='SV-PG: with 200 saved variants, 30 chip taps each select the tapped scale within 500 ms' tests/e2e.test.js
node tools/probe/panel_fit.js --base "$BASE" --candidate "$HEAD" --font both --workers 1
```

Use the existing reviewed bounds; raw Node commands need the runbook's bounded supervisor and one job at a time. Panel-fit acceptance preserves full existing viewport/state domain and budgets, real and fallback fonts; record measured cells/skips/invariance, not just exit status. Repeat that exact probe command with `--lang CODE` for each affected supported candidate locale, first deriving CODE from inspected `data/i18n/*.json`; base stays English, so label comparison correctly. Root locale count and actual selected tests must be frozen at implementation readiness. No text change is planned; if unavoidable, add every locale key, run `python3 tools/sync_i18n.py`, audit and repeat language/fit checks.

### Phase 3 — actual learning pages and 404

Owner: R editor; independent design/engineering review. Prerequisites: identity and CSS protection gates complete. Deliverable: light reading typography/surfaces and violet links/actions on existing hub, all scale pages, Handpan 101, About and 404, retaining copy/URLs/metadata facts, cards and navigation. Acceptance: 380px and wider actual pages are readable with real/fallback fonts; no clipped text or unreachable links; cards/progression plates/rails remain unchanged under both system schemes, JS on/off and reduced motion. Do not reproduce invented reference pixels or add navigation from the directional screenshot automatically.

Proposed regeneration/checks (all 16 actual table rows, one engine run):

```sh
python3 -c 'import json,subprocess; s=[r["slug"] for r in json.load(open("tools/scale_pages.json"))]; subprocess.run(["python3","tools/gen_scale_page.py",*s],check=True)'
python3 tools/gen_scale_page.py --hub
python3 -c 'import json,subprocess; s=[r["slug"] for r in json.load(open("tools/scale_pages.json"))]; subprocess.run(["python3","tools/gen_scale_page.py",*s,"--check"],check=True)'
python3 tools/gen_scale_page.py --hub --check
python3 tools/gen_scale_page.py --fixture --check
python3 -m unittest tests.test_scale_pages tests.test_handpan_101_page -v
node --test --test-name-pattern='FT: the shipped scroll margin covers the tallest nav-bottom to chord-name-top distance over every scale page at 380x780' tests/e2e.test.js
```

The browser selector expects one executed passing test. Existing tests assert old shared-dark reading styles and per-row accent behavior; review legitimate outer-reading assertions against the approved role change, preserving protected progression accent/geometry oracles. Change tests only when a spec-backed observable contract changes; follow `tests/CONTRACT.md`, retain floors and generated killing mutants for every new/changed group. Do not blindly update snapshots or the scale-card fixture. No new harness is planned. Manually inspect real routes (hub, all 16 scale pages, Handpan 101, About and 404); the scroll-margin test alone does not validate their branding.

### Phase 4 — protection, final review and authorized delivery

Owner: I integrator; independent final reviewers; owner for device QA and approvals. Prerequisites: lanes yielded files, source outputs synchronized, findings addressed. Deliverable: exact final-head evidence receipt, protected-region comparisons and review dispositions. Acceptance commands:

```sh
python3 tools/make_icons.py --check
python3 tools/gen_scale_page.py --fixture --check
python3 -m unittest tests.test_render_agreement tests.test_pdf_build -v
python3 tools/validate.py
python3 tools/refresh_mutants.py --check
python3 tests/suite_health.py
```

Run mutations only in a clean committed disposable checkout using the contract's generated patches/bytecode safeguards: `./tests/run.sh mutants`. Do not mutate a live editor's tree. Do not regenerate mutants or lower floors solely to obtain green. Existing full workflow remains authoritative; local commands do not establish a green Linux CI run.

Use `$impeccable` for the implementation: load context once, inherit the pinned Field guide world rather than re-rolling, and apply Operate/Read and craft-floor guidance. Treat the retained confirmed product/visual evidence as context; init must not reopen settled owner decisions. At the completed implementation stage, run the skill’s independent finish review and documenter; record the actual implemented token-bearing `DESIGN.md` plus `.impeccable/design.json` in the code worktree. These are future implementation outputs, not files to fabricate during planning.

Independent engineering review reads the exact final SHA, generated-source diffs, protected code/data/print diffs, failure paths, tests and raw evidence; independent design review inspects actual rendering and focus, localization, overflow, responsive states and fidelity. Self-review is labeled self-review and cannot substitute for either. Any fix changes the reviewed head; repeat affected checks and exact-head full gate.

Future authorized delivery: code branch starts on `dev`, follows repository paired main/dev PR model, with separate owner authorization for push/PR and dev integration/deployment. Before dev integration, verify **full Linux `validate` success at the exact final code SHA**, addressed independent review and nonconflicting PR. Inspect `gh run list --commit "$HEAD" --workflow validate.yml`; save actual run URL/jobs/conclusion. Doc-only `docs/plans/` success skips jobs and is no implementation/CI claim. Main PR remains held: only explicit owner main-merge consent permits main integration, including a documentation release.

After authorized dev integration, verify actual served DEV revision (not merely branch/CI SHA) and repeat affected root/menu/Add/Edit/Scale/Layout, reading/404 and link journeys on `https://handpan-cards-dev.pages.dev/`; record served identity, viewport/font/locale/state and evidence per runbook. Never claim deployment from a local capture. Main deployment remains separately gated.

## Verification split, risks and recovery

Automation: generator drift, existing app/engine/storage/share regression suites, panel fit, meaningful e2e, print/render parity and full Linux validate. Self-review: source ownership/scoping, same-master consumer audit, protected diffs and screenshots. Independent review: engineering plus design at frozen head, findings closed with evidence. Human owner: side-by-side vector fidelity, tiny actual-size favicon judgment, physical phone/Safari interactions/keyboard/fonts and visual approval. Saved-variants performance additionally requires existing SV-PG plus **owner phone QA**; no profiler substitute.

Capture root front/back and all progression modes with fixed state; Layout diagram; learning cards/rails/controls at 380px, 1024×768 and desktop reference widths, plus existing 320px/landscape budgets. Compare protected region bounds, fonts, colors and pixels to fresh same-base baselines; explain antialiasing differences rather than accepting moved geometry. Include long/non-ASCII names, all supported locales/CJK, error/disabled states, restored saved selection, paper select, hash/share navigation, menu open/close and keyboard focus. Historical mock zero-diff is not a candidate pass.

Main risks: inherited CSS/custom properties tint protected output; light `color-scheme` changes UA controls; expanded header loses contrast; full master/wordmark consumes card space; long locale labels clip; generator transforms/crops and srcsets disagree; old tests encode replaced reading style. Stop on protected output change, unexplained baseline mismatch, unfaithful master, missing required test, absent browser lease/supervisor or failing final gate. Classify and retain failure logs; after three unsuccessful same-hypothesis attempts revise investigation. No speculative harness/browser flags, broader redesign or data fixes.

Recovery: keep original source assets and base SHA; revert only owned unmerged edits/commits, regenerate outputs from retained sources, then rerun affected gates. Integrated regression requires a scoped reviewed dev-revert PR under existing dev authorization; never reset shared history, delete owner data/profiles or broadly kill Chrome. Production rollback needs owner decision. Record owned Chrome/process/profile/server cleanup before releasing the lease. Historical full Mac CDP timeout remains unresolved; targeted Mac/headless Chromium success proves neither full Mac completion nor Safari, real iOS keyboard, live Google Fonts or owner phone QA.

## Pending Linear handoff (no remote write performed)

`.linear.json` binds workspace `bamboo-grove`, team `TRI`, delivery group `delivery`, integrator owner session only. Linear plugin is missing/not connected; remote issue/P1 state is **not verified**. Pending payload: `docs/plans/2026-11-02-field-guide-linear-pending.json`; continuation brief: `docs/prompts/2026-11-02-field-guide-integrator.md`. Preserve `priorityRequested: "P1"` until the connector mapping is verified. Do not fall back to API keys, guessed IDs or another workspace. Integrator first connects the approved connector, lists tools and resolves owner Ray, team, Todo and planned label.

One issue for this workstream; search exact key `raywu/handpan-cards#field-guide-brand` before creating to avoid duplicates. Pending title: **Apply Field guide brand across Handpan Theory**. Status Todo; delivery planned; priority requested literally **P1**; resolve the connector’s priority schema and owner/workspace meaning before choosing a numeric value (do not assume P1 equals High or write an unverified numeric mapping); assignee resolved owner Ray. Preserve unrelated labels/project on any existing issue. Description begins exactly:

```text
Plan: docs/plans/2026-11-02-field-guide-brand-implementation.md
Key: raywu/handpan-cards#field-guide-brand
Planning only; implementation not authorized. Apply approved 01 Field guide / Two contours across root UI and actual learning pages. Preserve all cards/progressions, geometry/fonts/colors/data, engine/storage/share links and print layout. Faithful vector conversion and owner fidelity review precede application. Full exact-head validate, independent reviews, actual served DEV checks and owner phone QA remain future gates. See plan for assets, ownership, commands and approval boundaries.
```

Only the future integrator updates lifecycle at authorized events. Worktree creation/plan handoff keeps planned; use `Refs TRI-n` after resolving real issue, never Fixes. Add remote URL and verified priority/status receipt here when actually completed.

## Frozen readiness rubric and continuation

Review this plan against these nine criteria, plus two explicit workstream protections: (1) no open blocker/high finding; (2) every assumption verified, explicitly gated, accepted, or an AFK-routine choice; (3) smallest approach justified; (4) each phase has prerequisites/owner/deliverable/observable acceptance; (5) dependencies verified or listed prerequisites; (6) validation covers affected behavior and failure cases; (7) recovery feasible; (8) continuation precise; (9) scope/stop conditions unambiguous; (10) protected card/progression boundary and same-base proof explicit; (11) handoff self-contained with durable references and no dependency on temporary artifacts. “Ready for handoff” means no open high/blocker **plan finding**, never implementation authorization.

Verified: branch/base, actual generator entry points, 16-row learning route structure, current styles/shared-variable risks, named existing tests, transparent approved master and selected boards. Gates: owner implementation approval; faithful vector production/fidelity acceptance; new dev-base compatibility; actual test selections/runtime/browser prerequisites, fresh baselines and exact-head evidence; owner phone/Safari QA; connected Linear identity/issue/P1 verification. Existing visual approval is settled, not a question to repeat.

Next integrator: read this plan and package, confirm review dispositions, then stop awaiting explicit implementation authorization. Once granted, complete phase 0, implement waves in order and record evidence. Do not push/PR, dev-merge/deploy or main-merge without their separate grants. Plan author makes no code/application/asset edits and runs no tests/browser jobs.

Review/decision log (fill with reviewer, reviewed plan hash/SHA, finding severity, disposition and evidence):

- Independent engineering plan review: `brand_plan_handoff_eng_review`, report-only gstack plan-eng-review dimensions, original plan SHA256 `67223e0c85f408c0fd9a32532ba5dc2b116dd5e72547f139bbb44e50ade491b1`: Ready for handoff, no blocker/high. ENG-01–04 medium findings fixed in the final revision: exact pending Linear text aligned; planning/code checkout ownership separated; old-logo tests/mutants migration assigned; bounded ancestry/release-head procedure recorded. Final fix verification recorded below.
- Independent design plan review: `brand_plan_handoff_design_review`, report-only gstack plan-design-review dimensions, same original plan hash: Ready for handoff, no material findings. No browser/tests or implementation performed.
- Prompt critique: `brand_handoff_prompt_review` (fresh independent reviewer). Resolved output ownership, exact worktree/evidence paths, generated-source ownership, literal P1 mapping and authorization/verification boundaries before plan generation. Plan author `brand_plan_handoff_author` is distinct from both reviewers.
- Author self-review: source/test references inspected; no execution evidence claimed. Planning integrator verified all 18 retained asset hashes; proposed test selectors were independently verified statically, not executed.
- Owner gates/decisions and Linear receipt: pending future authorization/connection; selected direction and protected scope settled above.

### Final independent verdict and readiness

- Engineering fix verification: `brand_plan_handoff_eng_review` — **Ready for handoff; ENG-01–04 resolved; no new findings**, reviewed plan content SHA256 `1f444fcc80d5febb9701022e31a4f386ec0efc1da4da99f3a17dcf13aee6e2ed` before this log-only append. Impeccable sequencing, title/description parity, checkout ownership, identity oracles and ancestry procedure verified statically.
- Design update verification: `brand_plan_handoff_design_review` — **Ready for handoff; no material issues in the updates**. Visual approval/protection and no-execution boundaries preserved.
- Readiness criteria 1–11: **PASS for planning handoff**, respectively: no open blocker/high; assumptions explicitly verified/gated; smallest approach justified; phases owned and observable; dependencies listed; behavior/failure verification covered; recovery feasible; continuation precise; scope/stop explicit; protected-region proof specified; durable evidence self-contained. These passes do not satisfy future execution gates.
- Current stop: **Queued locally, not started. Linear publication/P1 assignment remains pending connector connection and verification.** Current owner instruction is plan-only; no implementation, remote branch/PR, integration or deployment action has been taken.

## Round-2 review amendments (2026-11-02). Binding; override the sections above where they differ.
Sources: design-review.md (DES-R2-*), eng-review.md (ENG-R2-*), same folder.

- A1 (DES-R2-1, AFK routine): light-ground focus ring = 2px solid #242424, offset 2px (14.1:1 on paper), scoped to #settings-panel, .sheetsurf, #about and reading pages. Teal #44e0d8 stays on dark ground. .prog, .flip and card rings untouched. Phase 2 test: focus ring computed colour on a violet-selected control differs from the selection fill and is >=3:1 against both paper and violet.
- A2 (DES-R2-2, OWNER DECISION; AFK default recorded): error state on light ground = ink #242424 text + leading error icon + aria-invalid with a 2px #242424 border; #E27005 stays on dark ground only. Alternative for the owner: approve a new error token >=4.5:1 on paper. token-check covers whichever is chosen.
- A3 (DES-R2-3, ENG-R2-3, AFK routine): reading pages (hub, 16 scale pages, 101, 404) become light-only: `color-scheme:light`, the `<picture>` prefers-color-scheme switch is removed, ink lockup always. .prog keeps its dark plate unconditionally. Test changes owned by Lane R: test_scale_pages.py SCALE_LOCKUP_IMG/MONO_SOURCE assertions rewritten to the single ink source.
- A4 (DES-R2-4): root stays `color-scheme:dark`; `color-scheme:light` scoped to the panel, sheet and About. Phase 2 self-check: Paper select, Language select and Neotone checkbox rendered in Safari and Chromium, screenshots in the evidence folder.
- A5 (DES-R2-5): Phase 0 deliverable adds a state table for every light-ground control (rest, hover, focus, selected, disabled, expanded, checked): hex + contrast per state. Fixes required by the table: disabled uses #8A847B text not opacity alone; expanded trigger ground is paper with ink border (no #221f1a under violet); checkbox accent-color #6756B5 on light ground.
- A6 (DES-R2-6): token-check.json regenerated in Phase 0 with labelled pairs: ink/paper, muted/paper, muted/field, border/paper (>=3:1 non-text), white/violet, focus/paper, focus/violet, error/paper, expanded state. Phase 0 fails if any text pair <4.5 or non-text <3.
- A7 (DES-R2-7): favicon = master fitted centred on a #0F0E0B square tile with 12% clear space; 16/32px renders checked against light and dark tab chrome; if the mark fails legibility at 16px, record an accepted limitation for owner review, do not redraw.
- A8 (DES-R2-8): Phase 2 states the lockup aspect ratio and a minimum wordmark cap height of 11px; header-budget check adds a 320px-wide cell (available ~170px).
- A9 (DES-R2-9): Impeccable init seeds PRODUCT.md and surface briefs only from the approved brand sheet and manifest; modes Operate (root, menu, forms) and Read (learning pages, About, 404); asks no new questions.
- A10 (DES-R2-10): no new navigation, no dark header band, no decorative violet fills; the reference image is a palette and type reference only.
- A11 (ENG-R2-1): Lane A also owns the tests/app.test.js favicon and `LG:` tests and tests/mutants/nm_favicon_ink_dropped.patch; Phase 1 verify adds `node --test --test-name-pattern='favicon|LG:' tests/app.test.js`.
- A12 (ENG-R2-2): Lane A extends tools/make_icons.py to render the reading-header @2x/@3x PNGs (fitz, same as touch icon/og) and covers them under `--check`. If the lockup aspect ratio changes, Lane R updates LOCKUP, SCALE_LOCKUP_IMG, handpan-101, 404.html and test_scale_pages.py (FULL_IMG, MONO_SOURCE, the 2x/3x slot test) in one commit.
- A13 (ENG-R2-4): Phase 0 ancestry check: `git diff --quiet origin/main origin/dev -- . ':!docs/plans' ':!docs/prompts'`. Pass: branch from origin/main and open M and D PRs from that one head. Fail: stop and amend the plan. The implement-on-dev-then-transfer procedure is removed.
- A14 (ENG-R2-5): Linear: TRI-49, priority High (P1 = High, owner 2026-10-28), PRs say `Refs TRI-49`. The "connector missing" and "do not assume P1 = High" text is void; linear-pending.json is marked applied when the planning branch next changes.
- A15 (ENG-R2-6): vectorisation method: potrace per colour layer of the 4-colour master (local tool, output committed; not a CI dependency). Objective gate before owner fidelity review: rasterise the SVG via make_icons.raster at 1154px and compare to the master with differing_fraction <= 0.02.
- A16 (ENG-R2-7): i18n step is unconditional: `python3 tools/sync_i18n.py --check`, no I18N key diff against $BASE (this is the "audit"), and panel_fit `--lang` for de, es, fr, it, ja, zh-Hans, zh-Hant.
- A17 (ENG-R2-8): a panel_fit `--lang` failure is attributed by rerunning the same locale with base = candidate minus the brand CSS; a fail on both is a pre-existing translation-length issue, logged, not fixed in this workstream.
- A18 (ENG-R2-9): Lane I owns tests/suite_health.py FLOORS rows (test_icons, test_scale_pages, app.test.js) and the README mutant count, set from the CI run artifacts at the final head.

## Round-3 amendments (2026-11-02, AFK). Binding; override A1-A18 where they differ.
Regroup lesson: round-3 failures were all precision gaps in A1-A18 (test math, selector lists), not structural; the approach is unchanged.
- A19 (R3-1): A1 test replaced: the 2px offset places the ring on paper, so assert ring #242424 vs adjacent paper >=3:1 (14.1:1) and ring colour != the violet selection fill. No ring-vs-violet contrast assertion.
- A20 (R3-2): A2 applies only to `#scale-box.bad`, `#scale-fields input.bad`, `#scale-refusal.err`, `#scale-msg.err`, `.announce.err` (plus the `#scale-neotone` accent per A5). #E27005 in `#scale-preview .nhit:focus-visible`, `.panhit:active`, `.panghost`, card `.badge` and all card/diagram renderer fills is PROTECTED and unchanged.
- A21 (R3-3): Lane R owns every color-scheme assertion in tests/test_scale_pages.py (`color-scheme:light dark`, the `.prog` prefers-color-scheme:light query, `prefers-color-scheme:dark{:root`, SHARED_ROOT `color-scheme:dark`) and tests/test_handpan_101_page.py. Hub, 101 and 404 move dark -> light. The `.prog` light media query is unwrapped so its dark plate applies unconditionally with today's values.
- A22 (R3-4): A5 expanded-state rows: `#settings-trigger[aria-expanded=true]` is on the dark header and keeps its current dark treatment (no paper ground; A10). `#scale-fine-toggle` and `#scale-lip` carry aria-expanded with no expanded style; they get no new style, only the light-ground focus ring (A1). The #221f1a fix in A5 is void.
- A23 (R3-5): A5 state table adds `#scale-generate:disabled:active` and `#share-copy:disabled:active`.
- A24 (R3-6): A15 comparison flattens both the master and the rasterised SVG onto #0F0E0B at 1154px RGB before differing_fraction.

## Regroup-1 amendments (2026-11-02, AFK). Binding.
- A25 (G1-1, G1-L1): A6's `focus/violet` pair is replaced by `focus/paper` plus a recorded `focus != violet fill` row; the `expanded state` pair covers only `#settings-trigger[aria-expanded=true]` vs the dark header per A22.
- A26 (G1-L2): A21 adds to A3's Lane R test list; it does not replace it.

## Regroup-2 lows (2026-11-02, AFK). Binding.
- A27 (G2-L1): A5 disabled rows are labelled WCAG 1.4.3-exempt, informational only.
- A28 (G2-L2): Phase 0 records the computed colours for `#settings-trigger[aria-expanded=true]` vs the dark header; below 3:1 is a pre-existing defect, logged, not fixed here.
- A29 (G2-L3): the "Pending Linear handoff" section is superseded by A14.

## Review log
Rounds: DES-R2 NOT READY, ENG-R2 READY w/ mediums, R3 NOT READY (1 high), regroup-1 NOT READY (1 medium), regroup-2 READY (lows only, applied as A27-A29).
AFK decisions: A1 ink focus ring; A2 error = ink + icon + aria-invalid border (OWNER may instead approve a >=4.5:1 error token); A3 reading pages light-only; A15 potrace + 2% overlay gate; A22 trigger keeps dark treatment.

## Build receipts (lane P/A, 2026-11-02)
Phase 0: `docs/plans/assets/2026-11-02-field-guide/phase0-receipt.md` (base, tools, hashes, ownership, token gate, A5 state table). `PRODUCT.md` and `surface-briefs.md` seeded per A9. Phase 1: `phase1-evidence/` and `phase1-receipt.md` in the same folder. Stopped at the Phase 1 owner fidelity gate; Phases 2-4 not started.

## Phase 1 gate and decision log (2026-11-02, AFK)
- Phase 1 owner gate: owner accepted fidelity of the vector master, "continue without pixel exact" (overlay differing_fraction 0.006577, edge fringes only).
- AFK auto-decisions (owner may revisit): (a) the 16px favicon stays the faithful master downscaled, no separate simplified 16px mark; (b) the master stays single-colour as shipped in Phase 1, no 4-colour variant in this lane.
- Ownership record: the `hn_h1_name_span_dropped` mutant context refresh in 04ce3f3e was outside the Lane A list; it is required because the new lockup changes the h1 span context the mutant anchors on. Added to Lane A.
- Phase 2 (lane U): implemented as ONE scoped override block (`field-guide:begin/end` in the index.html stylesheet, before the CJK block so the print block stays last). Existing dark rules are left byte-identical because tests/test_scale_pages.py (Lane R) pins the About rules; the block wins by cascade order at equal specificity. Error border keeps the 1px border and adds an inset 1px ink shadow (a real 2px border would grow the 48px fields). Desktop sidebar keeps a 4px `#0F0E0B` inset edge so the existing "outer 4px frame is table-coloured" e2e guard holds (owner may prefer a full-bleed paper sidebar, which needs that test changed). Header controls (`#settings-trigger`, `#share-copy`, `#share-url`, chips) and page-level `.announce` sit on dark ground and are unchanged.
- Ownership record (Phase 2): tests/e2e.test.js `edgeCheck` now accepts an alternate edge colour; the sheet-open test accepts the table colour or paper #F6F4ED (white still rejected), because the light scale sheet fills the viewport. Outside the Lane U list; required by the paper ground, recorded here.
- Phase 2 evidence: `docs/plans/assets/2026-11-02-field-guide/phase2-evidence/` (menu, form scale/layout/error, About; mobile and desktop; prefers-color-scheme light and dark) and `a4.json` (select colour-scheme and accent checks). Open owner question: desktop sidebar keeps a 4px dark inset edge versus the full-bleed paper in the approved mock.
- AFK auto-decision (Phase 2): warn messages and the armed delete moved from amber to ink, because amber fails contrast on paper (A2/A20).
- Review fix (Phase 2, PR #836 FAIL at 75045a49): the sheet focus ring no longer reaches the Layout diagram targets (`.panhit`, `.nhit` keep `outline:none`, as on base 04ce3f3e); `#scale-lip` keeps its inset offset; the sheet-open edge check compares paper with a tight tolerance.
