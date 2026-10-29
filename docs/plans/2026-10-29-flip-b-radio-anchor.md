# Lane B subplan: where the step radios sit

Mode: subplan, after the third review FAILed. AFK armed. Branch `claude/scale-page-flip-b`, PRs 686 (dev) and 685 (main, held).

## Cause (probe evidence)
- A label click focuses its radio, and Chrome scrolls a focused element into view when it is not fully visible.
- 6963305: the radios were in flow, so every tap scrolled.
- 150d59d: the radios were fixed at (0,0). Taps were fine, but a Tab focus scrolled nothing, so the stepper could stay off screen.
- 8dbe692: the radio was 1px at the bottom of `.prog`. With the label 1px below the fold, a tap scrolled 0px. With 16px below, it scrolled +225px at 844x390. Probe `scratchpad/probe/edge2.js`: 30 of 80 taps moved more than 16px.
- Rejected after probing: a 44px-tall radio over the nav row (26 of 80 bad), and a radio as tall as `.prog` (48 of 80 bad). Any in-flow radio that is partly off screen gets scrolled.

## Fix
- The radio is `position:fixed` at the viewport centre while it is not `:focus-visible`. A focus from a click is already in view, so nothing scrolls.
- On `:focus-visible` (Tab, arrows) the radio goes back to `position:absolute` at the nav row (`bottom:22px`). Chrome scrolls it into view, and the stepper comes with it.
- The only change is in `CSS_EXTRA` in `tools/gen_scale_page.py`. The 16 pages, the hub and the fixture are regenerated. No JS, and no deck data is touched.

## Tests (written first; red on 8dbe692 with 6 of 6 failing, green after)
- `tests/e2e.test.js` "FT: <slug> at <w>x<h>: NEXT and PREV tapped with the label 1, 16 and 32px below the fold do not scroll the page".
  - Pages: d-kurd-9, e-amara-20, f-low-pygmy-18. Viewports: 380x780 and 844x390.
  - d-kurd-9 must not scroll at all. The two tall-chord pages allow 16px, the growth of their next chord.
- All existing FT tests stay green (19 of 19), including Tab and Shift+Tab bringing the ringed step into view.

## Non-goals
The third-review nits stay out of scope: the hardcoded 3, the radiogroup role, and the frozen d-kurd-10 labels.

## Rubric (each item scored 0-2; the target is 10)
1. The cause is shown by measurement: 2.
2. Rejected alternatives were probed, not guessed: 2.
3. The fix covers mouse, touch and keyboard: 2 (edge.js covers mouse and touch, tab.js covers keyboard).
4. The tests fail before the fix and pass after: 2.
5. The scope is minimal: one CSS rule pair, nothing else: 2.
Score 10/10. Revision 1 added f-low-pygmy-18 and the touch probe.

## Review
`/plan-eng-review` by a fresh subagent was not run: this fork may not spawn agents. The parent's lane reviewer covers it.

## Revision 2: pinch-zoom (fourth review FAIL)
Cause: the fixed radio sat at the centre of the layout viewport. A label tap focuses it, and under a 2.5x pinch Chrome panned the visual viewport to it (117px down at 844x390, 113px left at 380x780).
JS check: no owner rule forbids JS, but `test_no_script_but_the_json_ld_block_on_non_frozen_pages` pins no script on the scale pages, so the fix stays CSS only.
Fix: each unfocused or focused radio is a 1px absolute box on the top edge of the nav label that targets it. A radio after the checked one sits on NEXT (right), and the others sit on PREV (left). A tap lands on a label whose top is in view, so focus has nothing to scroll to. That holds under zoom, at the fold and with the keyboard. The `:focus-visible` override is gone, which also removes mutant m3.
Tests (red before, green after):
- FT pinch-zoom 2.5x then NEXT twice, at 380x780 and 844x390.
- FT touch tap at the fold, 16px.
- FT placement: every radio, focused or not, sits on its label's top edge, at 380x780, 844x390 and 1280x800.
Limit: if the zoomed view shows only the bottom of a label, the 1px focus target sits up to 43 CSS px above the view.
