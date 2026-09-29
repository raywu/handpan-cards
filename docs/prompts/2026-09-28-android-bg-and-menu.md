# Prompt: Android background + settings menu, as a /swarm plan

You are planning, not building. Repo: `/Users/ray/Projects/handpan-cards`, base
`origin/main` @ `879499d`. Read `CLAUDE.md`, then §6 (merge gates) and the
non-goals of `docs/plans/2026-09-24-quality-eval.md`; they carry over unchanged.
Use `docs/plans/2026-09-27-followup-triage.md` as the structural template.

## Owner feedback (verbatim)

> The UI has a white bar on some Android phones. Make sure the background
> covers all viewport sizes. Also - is there room for a hamburger menu to bring
> up the print options, so they are not inline on the card? ... identify and
> bring some of the settings into a neat submenu; for example, scales / add,
> name --> notes vs notes --> name.

## Part A - the white bar

Nobody has reproduced it; the owner has not named a device, browser or
orientation. Do not guess one cause. Verify each candidate against the code at
`879499d` (cite `file:line`) and say what a fix would change and how a test
would see it:

1. `html` has no `background-color`; the dark comes only from `body`'s
   radial-gradient (`index.html:63-81`) propagated to the canvas.
2. No `<meta name="theme-color">` - Android Chrome paints its own status/URL
   bar light when a page gives it no colour, which a user will describe as "a
   white bar".
3. No `color-scheme: dark` - form controls, scrollbars and the pre-paint canvas
   default to light.
4. `min-height:100dvh`, `#scale-sheet` at `height:100dvh`, and
   `interactive-widget=resizes-content`: during URL-bar collapse or keyboard
   resize, is any band of the viewport not covered by a painted box?
5. Edge-to-edge Android (gesture bar, `viewport-fit=cover`,
   `env(safe-area-inset-*)`).

The fix must be CSS/meta only, and must leave every CHROME_BUDGET,
LANDSCAPE_BUDGET and "portrait is byte-identical" row where it is (Part A
moves no box). CDP cannot emulate browser chrome (the URL/status bar), so
state which candidates CI can prove (computed styles, canvas pixels at the
edges of an oversized or overscrolled viewport, across a viewport matrix of
portrait/landscape/tall 20:9/foldable-unfolded) and which stay an
**owner-device gate**. The plan is not done until it names that gate.

## Part B - the settings menu

Run `/frontend-design:frontend-design` for direction, inside the hard
constraint "preserve the visual system" (fonts, palettes, card anatomy, the
spacing ramp, `.mode`/`.chip` styling). Then decide, per control, MOVE to the
menu or STAY one tap away, with the reason:

- the card's `.prints` row (FULL DECK PDF, PRINT-ONLY PDF, paper select) -
  owner asked for this one; it moves;
- the NAME->NOTES / NOTES->NAME modebar;
- `+ ADD` (first chip of the deck strip);
- deck chips, Shuffle, prev/next, the counter.

Constraints the design must survive, each with the test that pins it today:
44px targets; the landscape one-row header (`@media (max-height:520px)`,
h1 visually hidden, exactly ONE media block containing `clip-path`);
CHROME_BUDGET (one-sided: chrome may only shrink, card only grow - a lane
that frees room tightens the table onto the new measurement); portrait
byte-identical; the card-fit rule; the hidden face's controls out of the tab
order; Enter/Space on a control never flipping the card; the print flow
(`downloadDeckPDF`, `setPrintPaper`, iOS `window.open`, afterprint teardown);
focus return after the scale sheet closes (today to `#deck-add`); a printed
card carries no screen furniture.

A11y: a button with `aria-expanded`/`aria-controls` and an accessible name;
Escape closes and returns focus to the trigger; focus contained while open;
state (current mode, paper) announced. Reuse the app's existing dialog/focus
code rather than adding a second pattern.

## Method and budget

Read-only evaluation. You may run single tests
(`node --test --test-name-pattern=...`) and single e2e tests with `CHROME_BIN`.
Never run the full `tests/mutation_check.sh` or the full e2e file locally.
List every mutant under `tests/mutants/` whose target code a lane will move or
delete (`grep -l` the removed lines, not the hunk headers), and say for each:
context refresh, re-target, or retire.

## Output

Write `docs/plans/2026-09-28-android-bg-and-menu.md`, /swarm-shaped:

1. Header: goal (one testable sentence), date, base SHA, shape, related docs.
2. §1 Goal and non-goals (carry quality-eval's; add new ones).
3. §2 Findings: Part A candidates, each with verdict (FIX / NOT A CAUSE /
   DEVICE-GATE); Part B MOVE/STAY table and design direction.
4. §3 Lanes: `| Lane | Owns | Never touches | Acceptance | Verify |`. Two lanes
   touching `index.html` must own disjoint line regions or be serialised; say
   which and why. Name FLOORS rows and mutant prefixes per lane.
5. §4 Order and dependencies. §5 Merge gates (deltas only). §6 Owner
   decisions with recommended defaults. §7 Owner-device gate.

Do not commit. Then run `/plan-eng-review` on the plan.
