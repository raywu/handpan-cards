# Field guide plan: design review R2

**Verdict: NOT READY.** There are 2 high findings and 6 medium. The scope, the protected boundary and the settled visuals are handled well. What blocks readiness is that existing hard-coded colours keep their dark-ground values, and on the new light ground they fail contrast. The plan names these as "check" items but gives no values for them.

Method: the gstack plan-design-review and Impeccable dimensions were applied directly, without running either skill interactively. Read-only. Contrast is WCAG 2.x, computed from the hex values.

## Findings

**DES-R2-1 (high). Focus has no specified value on light ground, and the inherited one would be invisible.**
- Evidence: `index.html` sets `:focus-visible{outline:2px solid #44e0d8}`. That teal on paper #F6F4ED is 1.48:1, and on field white it is 1.63:1. The 3:1 minimum for non-text indicators fails. The reading pages use the same teal (`a:focus-visible` in 404.html, handpan-101 and `CSS_HEAD` `--t`).
- A violet ring would disappear on violet-filled selected controls (EASY, STANDARD, SAVE): action against action is 1:1. The brand sheet says "Keep focus visibly distinct from selection". `token-check.json` covers only `focusOnDark` (3.29).
- Fix: define one focus token for light ground, for example a 2px #242424 ink outline with a 2px offset (14.1:1 on paper), and keep teal on canvas. Scope it to `#settings-panel`, `.sheetsurf`, `#about` and the reading pages. Leave `.prog`, `.flip` and the card rings untouched. Add a gate: "focus on a selected violet control is distinguishable at 380px."

**DES-R2-2 (high). The error colour fails on paper.**
- Evidence: `#scale-msg.err`, `.announce.err` and `#scale-refusal.err` use #E27005. That is 2.91:1 on paper and 3.2:1 on white, below 4.5:1 for 12–14px text. The brand palette has no error role, and the plan lists "validation/error states remain reachable" without giving a colour.
- Fix: add an error role darker than 4.5:1 on paper. Have the owner approve it as a token addition, since it is not part of the approved palette, or else use ink text plus an icon and an `aria-invalid` field border. Add the pair to token-check.

**DES-R2-3 (medium). The reading-page colour scheme is ambiguous.**
- Evidence: `CSS_HEAD` is `color-scheme:light dark` and follows the system setting, and `SCALE_LOCKUP_IMG` switches its `<picture>` on `prefers-color-scheme`. The hub, handpan-101 and 404 are dark only. The owner rule is reading on light ground, but the plan never says whether that means light only or follows the system.
- Fix: state "reading pages are light-only (`color-scheme:light`, ink lockup always); `.prog` keeps its dark plate values unconditionally, not via the `@media (prefers-color-scheme:light)` rule."

**DES-R2-4 (medium). Native controls and the fixed meta tag.**
- Evidence: `<meta name="color-scheme" content="dark">` and `:root{color-scheme:dark}`. A comment says these deliberately cover the paper `<select>` popup and the theme bar.
- Fix: keep the meta tag and root dark. Set `color-scheme:light` only on `#settings-panel`, `.sheetsurf` and `#about`. Verify the Paper/Language select popups and `#scale-neotone` in Safari and Chromium.

**DES-R2-5 (medium). The disabled, expanded and checkbox states are carried over from dark ground.**
- Evidence:
  - `#scale-generate:disabled:active{background:#f6f4ed}` and `.mode.on{background:#f6f4ed}` are ivory fills, which vanish on paper.
  - The disabled state is `opacity:.5`.
  - `#settings-trigger[aria-expanded=true]` is #221f1a, and violet against it is 2.8:1. The mocks show a light X with a violet ring instead.
  - `#scale-neotone` uses `accent-color:#E27005`, but the mocks show grey.
- Fix: write a small state table (rest, hover, focus, selected, disabled, expanded, checked) for light-ground controls, with hex values and contrast for each. Selected must be shown by fill, not by hue alone: violet against border is 1.59:1.

**DES-R2-6 (medium). `token-check.json` does not cover the real UI pairs.**
- Evidence: the "muted" 7.03 is actually muted on white. Muted on paper is 6.39.
- Missing pairs: white on action 5.87, border on paper 3.37, focus on light, error, action on the expanded trigger.
- Fix: in phase 0, regenerate token-check with labelled foreground/background pairs for every state in DES-R2-5.

**DES-R2-7 (medium). The favicon tile and crop are unspecified.**
- Evidence: the master is 1154×979 (not square) and ivory on transparent. The current favicon is `mark-small.svg` on a #0f0e0b round tile. A transparent ivory mark disappears on light browser tab strips.
- Fix: specify a #0F0E0B tile, a centred square fit using the half-mark clear space, and the same master. Make 16px evidence on both light and dark tab chrome a phase 1 acceptance item. If it fails, record the result as an accepted limitation; do not simplify the mark.

**DES-R2-8 (medium). The 320px lockup budget has no defined minimum.**
- Evidence: the `.hrow` grid is `44px 1fr 44px` with 12px gaps, which leaves the h1 about 170px wide at 320px. The current lockup (684×196) already shrinks below 64px there. The new mark-plus-wordmark ratio is not stated, and the selected browser tests cover 380px only.
- Fix: state the lockup aspect ratio and a minimum wordmark cap height (for example ≥11px) at 320px. Add the existing 320px header-budget cell to the phase 2 acceptance list.

**DES-R2-9 (low). Impeccable init could re-open settled decisions.**
- Evidence: Impeccable routes a missing PRODUCT.md on a redesign through init and then new-work. The plan only produces DESIGN.md at the end.
- Fix: in phase 0, seed PRODUCT.md and surface briefs from the brand sheet and manifest only. Use Operate mode for root, menu and forms, and Read mode for the learning pages, About and 404. Answer init with no new questions.

**DES-R2-10 (low). The selected-learning-reference image adds things the plan should rule out explicitly.**
- Evidence: the image shows a dark header band, Practice/Scales/101 navigation and violet-tinted section bands.
- Fix: add one sentence. No new navigation, and no violet fills for decoration. Section emphasis uses neutral rules, and violet appears only on links and the action pill.

The plan already handles these adequately:
- 16px/1.5 reading text kept separate from protected cards (`.fname`, `.notesline` and `.prog` are scoped).
- CJK and long-locale labels, through per-locale panel_fit.
- One master logo at every size, with no small mark.
- No print change.
- The full "Handpan Theory" name.

## Readiness criteria

| # | Criterion | Result |
|---|---|---|
| 1 | No open blocker/high | **FAIL** (DES-R2-1, DES-R2-2) |
| 2 | Assumptions verified/gated | **FAIL** (DES-R2-3, DES-R2-6) |
| 3 | Smallest approach | PASS |
| 4 | Phases have prereqs/owner/deliverable/observable acceptance | **FAIL** (state acceptance not observable: DES-R2-5, DES-R2-8) |
| 5 | Dependencies | PASS |
| 6 | Verification covers affected behaviour and failure cases | **FAIL** (focus/error/320px/favicon chrome) |
| 7 | Recovery | PASS |
| 8 | Continuation | PASS |
| 9 | Scope/stop | PASS (with DES-R2-10 recommended) |
| 10 | Protected boundary explicit | PASS |
| 11 | Self-contained | PASS |

pending-linear-writes: []
