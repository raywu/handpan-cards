# Phone-check fixes (2026-10-20)

Owner phone check of DEV (dev 7c24639, sheet-tabs T1+T2) returned four items. Item 3 (bottom notes) passed. This plan covers items 2 and 4 now; item 1 joins the same lane once the iPhone recorder (https://claude.ai/artifact/ELd5U6bbaJ2ap62Si6B2pg) has a diagnosis.

Owner words (verbatim):
- (1) "Footer does not stay minimized when scrolling down. Debug this."
- (2) "The empty state of handpan visual shows an E Amara 20 which is confusing. It needs to match the empty state / examples of the input fields and make the visual even more gray out. Ideally empty state cta should be directly on the visual"
- (4) "The tabs are currently buttons. They don't look like tabs. We need a tab UI."

## Goal
On DEV, an empty Add sheet draws the example pan from the four field placeholders, greyed further, with the CTA on the pan; Scale/Layout read as tabs; and (after diagnosis) the footer collapses to the lip on an iPhone scroll down.

## Non-goals
No engine edit, no data/decks.json edit, no share/route/record change, no #import-row unhide (prod), no About/settings/card change, no change to the lip's values (24px/150ms, 180ms, 25px zone) unless item 1's diagnosis names one, no rAF or ResizeObserver, no change to the advanced scale-line textarea's placeholder text.

## Lane P (single serial lane; owns index.html sheet CSS/markup/JS for #scale-tabs, the example plate and #scale-layout-hint; tests/app.test.js and tests/e2e.test.js additions, plus the amendments named below (the e2e 0.5 opacity floor, any test pinning the hint in flow); tests/mutants/ new ph_* patches; `pf_` is taken by three print-pipeline mutants)
Branch claude/phone-fixes from 56892f8 (T2 head, PR #416 HELD). PR M into main (HELD, owner merges), PR D into dev after the gate.

### P1 example pan = field placeholders (item 2)
- showPlaceholderPan() draws the seed the four dual-input fields would produce from their placeholder ATTRIBUTES (ding D3, top "A Bb C D E F G A", inner "C5 D5", bottom "C3 Eb3"), through the same field-to-seed function typing uses, `HPE.importer.compose(values)` (what fieldsInput() calls), not from #scale-box's placeholder and not from a JS literal copy of the scale. Concretely: build `values` from `fieldEls[k].placeholder` for FIELD_KEYS (the fieldValues() shape), take `r.line` when `r.ok`, and keep the existing tail: `HPE.core.parseSeed(r.line, sheetOptions())` then `paintPan(..., "example")`, `clearPanPreview()` on any failure. Verified at 56892f8: compose returns ok with line `[C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5`, it parses, its layout solves, and it carries no SMALL_LABELS warning.
- The drawn example therefore has ding D3, eight rim notes A3 Bb3 C4 D4 E4 F4 G4 A4, inner C5 D5, bottom C3 Eb3. Test asserts the plate's field labels equal the parse of `HPE.importer.compose(<the four served placeholders>).line` (computed in the test, not a literal) AND contain none of E3/B3/F#5 (the old example's ding, first rim note and first inner note, checked at 56892f8).
- Stale comments updated in the same PR: the `#scale-preview.stale` CSS comment ("ONE treatment for both"), the PAN_NAMES comment ("share one dim treatment") and showPlaceholderPan()'s own comment (it names the placeholder attribute of the scale box).
- Greyed further: the example state gets its own treatment, separate from "held" (held keeps opacity .62 and the `.stale` class, which app.test.js "DR1 line 31" asserts on a held plate). markPan() adds a second class for the example (e.g. `.example`, toggled `state === "example"`) beside `.stale`; CSS `#scale-preview.stale.example` sets the lower opacity plus `filter:grayscale(1)`. Example: desaturated and dimmer (target opacity about .35 plus grayscale), no lit fields (already true: paintPan draws unhighlighted). Test pins example and held as different computed opacities, example lower.
- The e2e test "a held pan is never announced as the current one" asserts `held.opacity >= 0.5 && empty.opacity >= 0.5` ("the 0.5 contrast floor"). The owner's "even more gray out" overrides that floor for the example only: amend the assertion so held keeps `>= 0.5` and the example is asserted `< held.opacity`; the name assertions are unchanged.
- CTA on the visual: the plate (#scale-preview) exists only in #scale-panel-layout at 56892f8; the Scale tab has no pan. So the CTA is the existing `#scale-layout-hint` ("Type a scale to adjust its layout.", HINT_EMPTY, id kept: tools/sandbox.js ELEMENT_IDS and the DR1/TB tests read it), moved from above the plate into `#scale-plate-band` right after `#scale-preview` and positioned absolutely, centred over the plate. No Scale-tab copy, no second string. Its visibility rule is unchanged (`layoutHint.hidden = boxOk` in paintLayout()), so it shows over the example AND over a held plate, as the hint shows today over both; the DR1 and S_HINT state-model tests stay as they are.
- It must NOT be a child of #scale-preview: paintPan() rewrites that element's innerHTML on every paint, and the plate's opacity/filter would dim the text with it. Contrast: the CTA carries its own opaque backing (the sheet's #1f1b15 with #eae6df text, or equivalent), so its >= 4.5:1 is measured against its own background, not the pan's ink; `pointer-events:none` so it never takes a plate tap.
- Anchor: #scale-plate-band is `position:sticky` by default, which anchors an absolute child, but it is `position:static` in two rules (`.sheetbody:has(#scale-layout-zone.nostick) #scale-plate-band` and the two-column container query); change both to `position:relative`. #scale-drawer-status (also in the band) is hidden while `!boxOk`, so centring over the band's preview box is unaffected by it.
- No resize from the CTA: it is out of flow, so with the example seed the plate's rect is identical with the CTA shown and hidden. (The plate's own height follows the drawn seed's extent, so it may change when a typed seed replaces the example; that is not the CTA's doing and is not asserted.) Moving the hint out of flow also removes the line it took above the plate; any e2e test pinning #scale-layout-hint in flow above the plate is updated in the same PR.
- Test: at 380x780 and 844x390 (the two-column case) on the Layout tab of an empty Add sheet, the CTA's rect is inside #scale-preview's rect and its own text/background contrast is >= 4.5:1; hidden after a valid seed.
- Accessible name for the example stays "Example pan for the placeholder seed".

### P2 a real tab UI (item 4)
- #scale-tabs becomes a tab strip: two text tabs sharing one baseline rule, the selected tab marked by a 2px underline in the cream (#f1ece1) and full-strength label, the other tab muted (#a79d8b) with no fill and no border box. Nunito Sans 600, uppercase tracking as .sheetlabel family, 44px min target height, full width split equally. No rounded button fill.
- Tabs drop the .mode class (so .mode styles and panelStops-style selectors do not catch them); ids, roles, aria-selected, tabindex, arrow-key behaviour unchanged. paintTabs() keeps toggling `.on` (app.test.js reads `classList.contains("on")` on the Layout tab in DR1 and the S_HINT state model). The new rule restates what `.mode` gave them (44px min-height, Nunito Sans 600, centred label); `#scale-tabs .mode` (CSS) becomes the new tab selector. Checked at 56892f8: no test, tools/sandbox.js or tools/probe/panel_fit.js selector finds the tabs through `.mode`; e2e "while the sheet is open Generate is the only reachable primary button" queries `button.mode.on` only on the practice screen and filters by width in the sheet, so it is unaffected. A grep for `.mode` in tests is still part of the lane's verify.
- Reduced motion: no transition on the underline (instant in every mode, per plan 3.7).
- Test: computed background of the selected tab is transparent, its border-bottom (or ::after) is 2px cream; unselected label colour differs from selected; both 44px tall at 380x780 and 844x390; the kbup.side rule still hides the strip.

### P3 lip on iPhone (item 1), added by message after diagnosis
Smallest change that makes the recorded iPhone trace collapse; a test reproducing the recorded event sequence in the sandbox or e2e first.

## Acceptance / verify
- `python3 tools/sync_decks.py --check && python3 tools/inline_engine.py --check && node --test tests/app.test.js && python3 tools/validate.py` (app.test.js fully green on this base: real GA id).
- Targeted e2e: `node --test --test-name-pattern 'PH:' tests/e2e.test.js` with CHROME_BIN.
- New tests are titled "PH: ...". At least one new ph_* mutant per sub-item (P1 example seed source: back to `scaleBox.placeholder`; P1 example opacity: `.example` rule dropped; P1 CTA position: hint back in flow above the plate; P2 tab underline), each dying for its titled reason.
- CI validate green at the pushed head SHA (the evidence).

## Gates
Fresh swarm-reviewer at the verified head; PR D into dev merges on green validate at that SHA on PR M + reviewer PASS; owner retests on DEV; main stays HELD for the owner.

## GSTACK REVIEW REPORT

Target: plan-phone-fixes.md (scratchpad), code base 56892f8. Mode: HOLD SCOPE (spawned session, recommended options auto-chosen).

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 1 | ISSUES FIXED IN PLAN | 6 issues, 0 critical gaps |
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | not run | n/a |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | n/a |
| Outside Voice | codex | Independent second opinion | 0 | skipped (spawned, bounded plan) | n/a |

Findings (all fixed in place above):
1. [P1] (9/10) The plate exists only in #scale-panel-layout (index.html@56892f8, `<div id="scale-panel-layout" ...>` holds #scale-plate-band/#scale-preview); the plan's Scale-tab CTA and "inside the plate in both tabs" test could not exist. Dropped; CTA is #scale-layout-hint on the Layout tab.
2. [P1] (9/10) e2e "a held pan is never announced as the current one" asserts `empty.opacity >= 0.5`; the .35 target fails it. Plan now amends that assertion (held floor kept).
3. [P1] (8/10) A CTA inside #scale-preview would be wiped by `previewBox.innerHTML = pan(...)` and dimmed by the plate's opacity; contrast "against what is behind it" was unmeasurable over pan ink. Plan: sibling in the band, opaque backing, pointer-events none; `position:static` band rules become relative.
4. [P2] (9/10) Named the field-to-seed function: `HPE.importer.compose` (fieldsInput), output verified by running the 56892f8 engine.
5. [P2] (9/10) `pf_` mutant prefix already used (pf_short_line_dropped_in_js/python, pf_title_warning_maps_disagree). Renamed to ph_/PH:.
6. [P2] (8/10) "Plate keeps its size" overclaimed (height follows the seed's extent); restated as "the CTA is out of flow". Also: keep `.on` on tabs (tests read it); no test finds tabs via `.mode` (checked).

Auto-decision: the CTA keeps today's visibility rule (shown whenever no seed parses, held plate included) rather than example-only, so DR1 line 31 and the S_HINT state model stay unchanged.

VERDICT: ENG CLEARED (plan revised in place).

NO UNRESOLVED DECISIONS
