# Landscape Settings/Resources menu — future usability plan

2026-10-26. **PLANNING ONLY; IMPLEMENTATION PAUSED.** V2 prompt executed; independent
ENG/design review pending. This is a nonblocking follow-on to released RC587,
not an app change for that release. Scope: Settings and its Resources controls.
Add/Edit Scale/Layout, its drawer/swipe and global application navigation excluded.

## Recommendation and independently inspected baseline

Recommend one ordered vertical Settings list in the existing full-height modal
for compact-height windows, with deliberate vertical scrolling and a continuously
reachable close control. Preserve the permanent desktop sidebar and existing
portrait behavior. Use current controls/DOM order and visual system; do not add
category navigation or a second menu. This is a provisional UX choice, not measured
superiority: no browser/prototype/device tests were run for this documentation.
Intentional landscape scrolling requires owner-approved specification/oracle change
before implementation; the current project explicitly requires no-scroll fit.

Inspected local reconcile HEAD ed9554b16776eb2c1c46d0f3caa831310088fcd0;
coordinator reports main release7d80d65d603d9e8ab468a08d616d59dfac0245ce using
source3542/app7fe75f54…, production source match, main CI still running at request.
Do not turn those reports into this author's independent deployment verification.

| Observation | Evidence / qualification |
|---|---|
| Short-height grid is not phone-specific | index.html:344 @media(max-height:520px), auto-fit minmax(200px,1fr); several groups can produce three or more columns. Trigger is height alone. |
| Modal vs persistent sidebar | index.html CSS and desktopMQ require width≥1024 AND height≥700 for sidebar;1280×500 is still modal. |
| Shared controls and state | panelStops/openPanel/closePanel, desktopMQ change listener; one DOM tree, mobile role/dialog+inert/trap vs desktop nonmodal region. |
| Existing close behavior | Trigger remains outside inert background; Escape/scrim/trigger close, focus returns to trigger, RESET disarms, LINK UI retires. Preserve unless separately approved. |
| Existing fit obligation | tests/e2e.test.js “the full-screen settings panel fits with no scroll in every mode, at320x568 and every landscape size”; panel_fit judges rendered-set/control bottoms, not just scrollbars. |
| Perceived three-column difficulty | Owner report accepted; exact scanning/tap/scroll causes and preferred alternative remain unmeasured, not evidence of a functional bug. |

Frontend reference consulted: local gstack plan-design-review/SKILL.md hierarchy,
responsive, visible affordance and44px sections; repository CLAUDE/browser/test
contracts. Reference only, no skill bootstrap, new framework or global behavior change.

## Bounded primary research, inspected2026-10-26

| Direct source | Application here / limits |
|---|---|
| [Apple HIG Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers/) | Popovers suit small related tasks and avoid compact presentations; supports rejecting an overcrowded anchored menu. Native guidance, not a web mandate. |
| [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout/) | Hierarchy/grouping, both size dimensions, text changes and safe regions support a predictable sequence; does not mandate columns or a CSS breakpoint. |
| [Apple HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets/) | Scoped contextual tasks and clear dismissal support existing modal context; native detents/Save/Cancel conventions need not be added to instant settings. |
| [Android layout/navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns) | Adaptive patterns depend on usable window space/task hierarchy. Settings are actions/supplementary controls; adding primary app navigation is unwarranted. Native dp/size classes are not CSSpx breakpoints. |
| [WAI Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Settings text/actions should remain usable at320CSSpx without two-axis scrolling; no diagram exception justifies a wide Settings grid. |
| [WAI Orientation](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html) | Keep portrait and landscape usable; never tell users to rotate as the fix. |
| [WAI Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Sticky chrome must not wholly hide focused controls; this project should keep full target/focus-ring visibility, a stronger planned acceptance. |
| [WAI APG Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Preserve focus containment/Escape/return and inert background for modal presentation, not for desktop sidebar. Audit existing external-trigger exit semantics; do not claim existing APG conformance from visual fit. |

Apple pages initially exposed JS shells; their official .md versions were read
without browser execution. WAI Understanding/APG are explanatory implementation
guidance, not evidence that this app currently conforms.44CSSpx is the existing
project floor; do not attribute that exact floor to Android/Apple native units.

## Alternatives and tradeoffs

| Pattern | Benefit | Cost/risk / decision |
|---|---|---|
| A: ordered full-height modal list with one scroll area | Familiar sequence, no multi-column hunt, unchanged controls/DOM and simple CSS scope; adequate width for labels. | More vertical travel and Resources below fold; explicit scroll discoverability/reachability and approved no-scroll contract migration required. RECOMMEND provisionally. |
| B: explicit maximum two columns | Fewer scan lanes; more width than current three-column grid. | Still cross-column reading/order problems, localized groups uneven, low heights still require scroll; cannot promise current no-scroll fit. Keep as design alternative if owner prefers side-by-side. |
| C: category list→detail/drilldown | Only relevant controls visible; clear sections at low heights. | New navigation/focus/back state, hidden-control semantics and extra taps; disproportionate for this small menu. Defer. |
| D: anchored popover | Practice stays visible; convenient for few settings. | Many controls/Resources exceed compact popup scope, scarce vertical room and layered focus/LINK/About conflicts; reject here. |

Choose A over B for stable scan order and minimum state/JS change, not because
vertical scrolling is universally better. At resumption show A/B static wireframes
to owner; preference can change recommendation before code, with no new research
framework or broad redesign. Do not promise all Resources initially above fold.

## Proposed layout and interaction

```text
Compact-height modal (e.g.844×390; also1280×500)
[existing always-reachable Settings X; reserved top/safe region]
                  Flash cards / progression controls
                  Scales
                  Print
                  Resources: sites → Amy → Helpers/101 → About
                  Language
                  ↕ one vertical scroll area, readable labels
Portrait: retain existing presentation and fit contract.
≥1024×700 sidebar: retain current always-visible240px nonmodal region.
```
Retain existing group order and Resources pair order/complete labels. Keep current
Nunito/Marcellus, colors, minimum44px targets, control identity and link attributes.
Use a bounded centered content width (start with existing420px group maximum),
not edge-to-edge stretched buttons on wide short monitors. Final width/padding
is measured with all locales/fonts, not declared successful from this wireframe.
No new persisted preference, URL fragment, route or menu category is needed.

Scrolling should be obvious through visible section continuation/standard scrollbar
where platform shows it; do not rely on hover-only cues or scrollbars alone. Use
real Resources heading and predictable order; if prototype users cannot discover
it, evaluate a small accessible in-menu jump link separately, not silently add it.
The Settings container is the sole menu scroller; avoid nested scroll regions,
horizontal scroll, wheel/pan leaking into practice and double-scrolling page+menu.
No added sticky footer. Existing close trigger must remain hit-testable/visible;
reserve its row/inset and avoid overlapping focused controls or long locale text.
If accessible in-dialog dismissal requires a new control, stop for its own exact
semantics/focus/test/spec packet rather than copy a second unsynchronized X.

## State and transition matrix

| Situation | Required behavior |
|---|---|
| Closed→open compact modal | Same current settings/practice state and modal lifecycle; initial top or previously specified scroll position, close reachable, no synthetic route push. |
| Scroll/Tab/ShiftTab | Focused target and ring fully visible; all controls reachable in DOM order, modal trap includes current controls; no card flips/navigation underneath. |
| Mode/tier/scale/print activation | Retain each current close/stay-open action exactly; no extra activation from scrolling, no changed scale data or print content. |
| Resource click/Enter | Exact destination in new tab with noopener, complete labels; menu/practice state follows existing approved contract, never accidental close or mode reset. |
| About and LINK | Existing About route/Back/Escape/focus restoration unchanged; mobile modal still prevents background LINK, stale async LINK UI never resurfaces. |
| Rotate/resize within modal | Stay usable without resetting settings; preserve visible focused item and stable section position, clamp scroll to content; no duplicated listeners/reopen. |
| Cross520px boundary | Layout can change, but no hidden controls, trap leak or focus loss;520is a starting existing threshold, not proof of ideal usable-height cutoff. |
| Cross1024/700 sidebar boundary | Existing CSS/desktopMQ must agree; remove modal inert/trap/scrim on entering sidebar, return to closed modal when leaving, preserve selection and logical focus. |
| Browser UI/zoom/keyboard/safe areas | Dismissal and focused action stay accessible in actual visible region; text reflows without two-axis scrolling; no fixed tall header consuming a short viewport. |
| Cancel/Escape/close/back | Preserve current distinction: Settings applies actions immediately, no invented Save/Cancel transaction; About Back behavior remains existing contract. |

Do not change Add/Edit scroll/keyboard/drawer/Scale↔Layout behavior. Rotation while
Add/Edit is open is a regression case proving Settings changes remain isolated.
Use CSS available-height/safe-area support progressively with existing fallback;
no new VisualViewport controller unless measured browser behavior requires one.

## Intentional fit-oracle contract migration — explicit approval gate

A removes the current landscape no-scroll promise. Before source edits, present
owner the exact proposed CLAUDE.md/settings-spec diff and measured prototype
expectation: single-axis menu scrolling is intentional only for the approved
compact-height modal domain, with every action reachable and close/focus visible.
Owner exact CLAUDE approval remains required; planning/AFK does not waive it.
Freeze approved affected domain and old/new acceptance before modifying tests.
Preserve portrait/sidebar/unchanged fit obligations and all current typography,
44px, horizontal spill, DOM rendered-set/stop inventory and unrelated budgets.

Do NOT just increase FIT_TOL/CTRL_TOL, res-* allowances, remove a failing landscape
cell or call offscreen controls absent. Keep existing panel_fit historical judges
for unchanged domains. Add independently reviewed reachability/focus/scroll-extent
judges for the explicit new domain; all rendered controls remain inventoried even
below fold. Show old baseline results plus proposed-rule results separately.
New oracle must fail genuine clipped/unreachable targets, overlapping close,
missing controls and focus-obscuration mutants; passing scrollHeight alone is weak.
Exact change to tools/probe/panel_fit.js and its own tests is part of review, not
an excuse to rewrite the whole probe or weaken baseline comparisons globally.

## Paths, swarm and phased implementation after resumption

| Lane / verified path | Responsibility |
|---|---|
| T: tests/app.test.js, tests/e2e.test.js | Spec-first modal/rotation/Resources/lifecycle and immutable unchanged-domain witnesses before source. |
| U: index.html CSS/Settings markup only | Remove automatic many-column compact-height presentation inside approved domain; preserve IDs/DOM/order and desktop rules. Minimal JS only for proven focus/viewport gap. |
| O: tools/probe/panel_fit.js | Exact approved domain/scroll-reachability judges; T owns related oracle groups in existing tests/app.test.js and tests/e2e.test.js, avoiding shared-file writers. No invented panel_fit_probe.test.js file. |
| M: tests/mutants/*.patch, tests/suite_health.py | Generated intent-specific faults and observed additive floors; no handwritten patch bodies or lowered unrelated counts. |
| Coordinator: docs/WORKSTREAMS.md/plan, approved exact instruction packet | Separate worktrees/file ownership, one integrator/browser lease; independent ENG/design plan and final reviews. |

Phase1: owner A/B preference and exact contract/instruction approval, current-base
refresh, frozen selectors/counts/viewports and baseline witness. Phase2: T RED then
minimal U+O GREEN, generated fault/restored proofs; phase3: independent final review,
full exact-headCI, actual servedDEV and owner landscape/device QA. Implementation
remains paused until explicitly resumed; release/main consent remains separate.

## Acceptance matrix and retained uncertainties

| Input / baseline | Observable pass/fail |
|---|---|
|844×390,926×428,667×375,1280×500; A/B/S | One readable ordered menu, no accidental multi-column grid, all controls reachable, only intended vertical scroll. |
|320×568 portrait,1024×700+,1280×800 sidebar | Existing fit/layout/semantics unchanged; boundary pairs1023/1024,699/700 and519/520/521 checked. |
| Eight actual supported locales × real/fallback fonts | Complete labels/44px targets/no horizontal clipping; browser actual language/font stamps, not English-only inference. |
| Keyboard + touch scroll + orientation changes | Full focus visibility, Escape/return/trap correct, no background gestures or duplicate actions; unknown native behavior stays unverified. |
| Browser chrome, safe insets,200% text/400% reflow | No lost controls, close/focus reachable; physicalSafari/iOS andAndroid QA separate from CDP emulation. |
| Resources/About/LINK/practice snapshot | Exact inventory/destinations/opener isolation/routes and practice state preserved; stale callback/background control mutants fail. |
| Faults and scope | Missing last control, blocked scroll, wrong domain/sidebar trap, hidden focus and Add/Edit leakage each produce intended assertion failures. |

No usability improvement or browser/device conformance is validated yet. Prototype
scroll depth/discoverability and dynamic browser chrome remain empirical gates.
Rollback restores the owned committed CSS/UI/oracle packet together after review;
no storage migration, saved-scale deletion or global changes are needed. Preserve
failed evidence and local worktrees. Claude continuation: read prompt+plan, resolve
fresh release/paused state, interview only A/B/contract decisions, obtain explicit
resumption/exact patch approval, then run the bounded swarm. Fourth failed review
round triggers regroup. No landscape fix was applied to the released RC.

## Independent review closure

Engineering and operational/design reviewers both CLEAR for future planning; no
material omission remains. Before T freezes fixtures, include this proposed scroll
policy in the exact owner-approved contract: reset to top on a genuinely new menu
open; preserve section/anchor during same-open resize/rotation and resource-new-tab
return, bringing focused controls fully into view. Compact-height domain, including
any very short portrait behavior, must be explicit; portrait/sidebar stay unchanged
unless separately approved. No implementation or usability validation is claimed.
