# Landscape Settings/Resources usability — plan prompt V2

Planning-only follow-on,2026-10-26. Released RC is not blocked; all implementation
remains paused for Claude handoff. Produce docs/plans/2026-10-26-landscape-settings-menu.md
and independent engineering/design review afterward. Do not edit application,
tests, CLAUDE.md, hooks/config, install tools, commit/push or run browser checks.
Scope is the Settings menu, INCLUDING Resources, not Add/Edit Scale/Layout.

## Outcome

Investigate why the current three-column short-height menu is difficult to use;
compare actual adaptive patterns and recommend the smallest evidence-qualified
improvement. Do not force portrait, add global navigation or copy native widgets
without assessing browser semantics. Preserve all settings/resources and practice.

Read current source/ref and report it separately from production/deployment claims.
Inspect index.html Settings CSS/markup, desktopMQ, panelStops/openPanel/closePanel,
About and LINK lifecycle; existing settings-fit tests, tools/probe/panel_fit.js,
shared browser runbook and tests/CONTRACT.md. Baseline: max-height520px uses
auto-fit minmax200 grid; persistent sidebar uses min-width1024 AND min-height700.
Short desktop windows are affected too. Verify these facts and exact edit paths.

Consult local frontend UX guidance as REFERENCE only, including gstack
plan-design-review/SKILL.md hierarchy/responsive/44px/edge-state sections; no
bootstrap, new framework/library or global mutation. Read primary guidance:
- Apple HIG popovers, layout and sheets at developer.apple.com/design/human-interface-guidelines/.
- Android official layout/navigation patterns at developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns.
- W3C WAI reflow, orientation, focus-not-obscured and APG modal-dialog pattern.
Cite direct sources/date, summarize relevant behavior, and distinguish web guidance
from native platform ideas/units. If JS docs are unreadable use their official
Markdown/read-only source or mark unavailable. No secondary-source policy claims.

Compare at least three credible patterns: ordered scrollable full-height menu,
explicit two-column grouping, category navigation/progressive disclosure, optionally
anchored popover. Explain scanning/discovery, low-height tradeoffs, keyboard and
implementation complexity. Recommend one provisionally; no fictional usability score.

Required plan contents (~170–220 lines, plain/actionable):
1. Scope/current-state evidence; user complaint vs unmeasured cause.
2. Primary research synthesis and pattern tradeoff table with recommendation.
3. Portrait/landscape/short desktop/sidebar/rotation wireframes and state matrix;
   current DOM/group order, semantic headings and Resources discoverability.
4. Eight locales/two fonts, project44CSSpx minimum, browser chrome/safe-area/zoom/
   virtual keyboard, one-axis scroll, visible dismissal/focus, no forced orientation.
5. Exact modal-vs-sidebar lifecycle, rotation across1024/700 and520 boundaries,
   settings toggle/Resource new tab/About/LINK/practice state/accessibility checks.
6. Fit-oracle impact: current no-scroll and control-bottom assertions are a contract.
   Intentional scroll needs an explicit owner-approved exact specification/CLAUDE
   packet and independent oracle migration; never disable tests/loosen tolerances
   or call hidden offscreen controls absent. Retain coverage for unchanged states.
7. Exact paths, lean swarm/file ownership, test-first implementation after approval,
   generated mutants, pairwise baseline/candidate checks and representative native
   QA. No tests run merely to write this plan; no physical-device claim from CDP.
8. Observable acceptance matrix, independent plan/final review, full exact-headCI,
   actual DEV and owner QA, release gates, rollback/data preservation and resumable
   Claude breadcrumbs. No new persisted preferences or route identities by default.
9. Bounded adversarial review: lost controls, localization wrapping, wrong modal
   trap/sidebar, focused item hidden, hover-only discoverability, scroll stealing,
   reset/LINK/About regressions and Add/Edit accidentally affected.

V1 critique: “fix three columns” was underspecified, conflated Settings with
Add/Edit, ignored short desktops/modal transitions and could waive existing no-scroll
oracles. V2 closes those gaps and requires primary research, explicit contract
approval and preserved lifecycle evidence. Run V2 to create the plan, independently
ENG/design review the actual output, revise material gaps and rereview. No claimed
10/10 self-score; fourth failed review round triggers regroup. Record retained
uncertainties and owner decisions needed only when resuming this future work.

Output-review refinement: freeze scroll-position/focus policy (new-open top; same-open
rotation/resize/resource-return retention), and make the changed viewport domain
explicit before tests. V2 output independently ENG/design CLEAR; future execution
still requires owner resumption/exact specification approval. No numeric score claim.
