# Lane F - drawer follow-up (one small lane after refactor pass 4)

Owner, 2026-10-09: "One small lane after refactor 4." Scope fixed by
`docs/plans/2026-10-09-refactor-pass-4.md` section 10.5 (binding) plus the
items the refactor-4 reviewers routed to "the lane that owns the app block"
(section 11 of that plan). Nothing else. Base: main after lane C merges
(PR #287).

## 1. Goal and non-goals

**Goal.** Seven small, independent app-block changes, each with its own
test and mutant, delivered as ONE PR under the refactor-4 section 5 gates.

**Non-goals.** Tooltips, onboarding overlays, animation, timers, new state,
changes to `DRAWER_HINT` copy, to the step buttons, to RESET LAYOUT, to
`panelStops()`, to any engine module (`src/engine/*`, so `NAME_RE` stays
ASCII-only), to deck data or geometry, to any fixture digest, to CSS outside
the two rules named below. No refactoring around the touched lines.

## 2. Ownership

| Files | Owner |
|---|---|
| `index.html` app block only (markup, CSS, app JS; never an `engine:` region or the `DECKS` line) | F |
| `tests/app.test.js`, `tests/drawer_seats.test.js` | F |
| `tests/mutants/r4f_*.patch` (new) | F |
| `tests/suite_health.py` FLOORS rows for the two test files above (values only, from CI's `js-results` for the branch) | F |
| `README.md` mutant count (exact, `ls tests/mutants/*.patch \| wc -l` at the head) | F |
| `docs/plans/2026-10-07-scale-drawer-design-spec.md`: only the lines that place `#scale-drawer-hint` (section 2 table row, the wireframe line, the focus/order lists at "7. `#scale-drawer-hint`, last", section 20's "6. `#scale-drawer-hint`, last", and the "Drawer hint" paragraph), each marked "SUPERSEDED 2026-10-09 (lane F)" in the house style, never rewritten | F |

Everything else is out of bounds. `tests/e2e.test.js` is NOT owned: the
browser test for item 3 lives in `tests/drawer_seats.test.js`, which is
already in `E2E_FILES`.

## 3. Items

Anchors are function names and ids, not line numbers.

### F-1. F4: a non-ASCII deck name must not disable ADJUST LAYOUT (10.5 item 1)

**Today.** `sheetOptions()` normalises curly quotes, dashes and the
ellipsis to ASCII, then passes the name to `HPE.core.parseSeed`. Any other
non-ASCII character (`D Kürd`) fails `NAME_RE` in `readOptions`, which
returns `badNote(name)`: the WHOLE parse is refused, `syncParseState` leaves
`boxOk` false, and `paintLayout()` disables `#scale-layout-toggle`
(`const off = !boxOk && !drawerOpen`). The scale itself parsed fine; only
the name is bad. GENERATE CARDS is rightly disabled; the drawer is wrongly
disabled.

**Change.** In `syncParseState`'s refusal branch, when `editingId` is set
and the name is the only problem - decided by a second `parseSeed` of the
same text with `sheetOptions()` minus `name`, which must return `ok` - treat
the layout as live: `boxOk = true`, `noteCounts`, `paintLayout()`, the pan
preview painted as on the ok path (`showPanPreview` when `paint`, else
nothing new), while the refusal line still shows `res.reason`, `scaleBox`
still carries `bad`, and `genBtn` stays disabled. No change to the engine, to
`sheetOptions()`, or to the ok path. A refusal whose scale ALSO fails is
unchanged (the second parse is not ok). The second parse runs only on the
refusal path, so the ok path costs nothing.

**Tests** (`tests/drawer_seats.test.js`, sandbox): (a) on Edit, name
`D Kürd` with a valid scale: `#scale-layout-toggle` enabled, GENERATE CARDS
disabled, `#scale-refusal` names the bad name; (b) the same name with an
unparseable scale: toggle disabled, as today; (c) a built-in's Add path
(no `editingId`) is unchanged by the change. **Mutant**
`r4f_f4_name_refusal_disables_drawer` removes the second parse (restores
today's behaviour); killed by (a).

**Stop.** If `sheetOptions()` cannot be called with the name omitted
without duplicating its normalisation, or if `badNote(name)` cannot be told
from a scale refusal by the second parse alone, stop and report; do not
touch `core.js`.

### F-2. `#1 / #2` gets an `aria-label` (10.5 item 2)

**Change.** `<button id="scale-anchor-between">` gains
`aria-label="Notes 1 and 2 either side of centre"`; visible text `#1 / #2`
and `aria-pressed` unchanged. `#scale-anchor-one` keeps its visible text as
its name (`#1 CENTRED` reads as "number 1 centred"); if the lane finds a
screen reader reads `#` as nothing, give it `aria-label="Note 1 at centre"`
too and say so in the PR. **Test** (`tests/app.test.js` source-text pin on
the markup, the house pattern). **Mutant** `r4f_anchor_between_no_aria`
drops the attribute.

### F-3. Move `#scale-drawer-hint` to the first child of `#scale-drawer` (10.5 item 3, verbatim brief)

> **(3) Rearrange instruction.** The drawer already carries the instruction: `DRAWER_HINT` = "Tap a note, then tap another note in the same ring to swap them. Or hold a note and drag it.", painted into `#scale-drawer-hint`. The defect is PLACEMENT, not copy: the paragraph is the LAST child of `#scale-drawer`, under RESET LAYOUT, so at 380 x 667 it is below the fold when the drawer opens and a first-time user sees the pan and the orientation buttons with no instruction. Least lift, least risk: move the `<p class="sheethint" id="scale-drawer-hint" hidden></p>` element to be the FIRST child of `#scale-drawer`, directly under the plate band, and change nothing else - no new element, no tooltip, no timer, no new state, no copy change, no CSS beyond what the move needs. `#scale-drawer-hint` is a `<p>`, so `panelStops()`, the sheet's Tab order and every focus test are untouched; the `drawerHint` reads in `paintDrawer` (`textContent`, `hidden`) are by id and do not move. A tooltip is REJECTED for this lane: it needs a trigger, dismissal, touch handling and a new focus stop, each a new state the spec would have to describe. Tests: (a) `tests/drawer_seats.test.js` asserts `#scale-drawer-hint` is the first element child of `#scale-drawer` and carries `DRAWER_HINT` when the drawer opens; (b) a browser test at 380 x 667 (fallback fonts, the CI harness) that with the drawer open and the sheet at scroll top the hint's bottom edge is inside the scrollport; mutant `r4f_drawer_hint_last_child` moves it back. The design spec's wireframe and the acceptance line that place the hint are updated to say first.

Coordinator note (checked at main `e185207`): `#scale-plate-band` is a
sibling BEFORE `#scale-drawer`, not inside it, so "directly under the plate
band" and "first child of `#scale-drawer`" are the same place: the hint goes
before the `.editrow` that holds `#scale-anchor-label`. Test (b) uses a
380 x 667 browser helper of `tests/drawer_seats.test.js`'s own (that file
already skips without `CHROME_BIN` and is in `E2E_FILES`).

### F-4. Underline `#scale-fine-toggle` (10.5 item 4, verbatim brief)

> **(4) Finer-controls toggle underlined.** `#scale-fine-toggle` ("HARD TO TAP? SHOW FINER CONTROLS", a `<button>` styled as quiet text) reads as a link and is not underlined. Add `text-decoration: underline; text-underline-offset: .18em` to the `#scale-fine-toggle` rule and nothing else (the 44 px height, the 9.5 px type, the colour and the `:active` colour stay). Test: `tests/app.test.js` source-text pin on the rule (the house pattern for CSS pins), mutant `r4f_fine_toggle_no_underline`. `panel-fit` is not involved: the button is inside the sheet, not the settings panel.

> Stop conditions: any change to `DRAWER_HINT` copy, to `panelStops()`, to a fixture digest, or a `drawer_*` FLOORS row falling. Non-goals: tooltips, onboarding overlays, animation, changes to the step buttons or to RESET LAYOUT.

### F-5. `degSel` `change` handler has no killing test (routed from PR #285 review)

**Today.** `degSel.addEventListener("change", () => resyncSheet(true))` in
the app block. The PR #285 reviewer neutered it and `tests/app.test.js`
stayed green; the sandbox CAN dispatch `change`.

**Change.** None to the app. **Test** (`tests/app.test.js`, sandbox): on
Edit with a parsed scale, dispatch `change` on `#scale-degrees` (the
`degSel` binding) after changing its value and assert an observable effect
of `resyncSheet(true)` - the parse line or the preview's degree labels
re-derive from the new parent. **Mutant** `r4f_degsel_change_unwired`
removes the listener.

### F-6. Comment above `pan()` (routed from PR #285 review) - VERIFIED CURRENT, no change

The PR #285 reviewer flagged the "diagram label sizing" comment above
`pan()` (`name = r * labelRatio(zone) (HPE.pdfcards owns the three
ratios)`) as stale. Checked 2026-10-09 at main `e185207`: `labelRatio` and
`labelSize` are defined inside the `engine:pdfcards` region and exported on
`HPE.pdfcards`; the app block binds `const labelSize =
HPE.pdfcards.labelSize` and calls it in `pan()`. The comment is accurate.
Lane F makes no change here; this item is closed by this plan.

### F-7. R4-A29 test side effect (routed from PR #285 review)

`tests/app.test.js` "R4-A29 regen_card_fixture --html without a value exits
non-zero with a message" compares the fixture's bytes before and after. A
regressed guard that rewrites `tests/fixtures/card_face_v1.json` with
identical bytes passes. **Change** (test only): also assert the file's
`mtimeMs` is unchanged across the four invocations (a rewrite with equal
bytes still bumps it). No app change, no mutant (a test-only hardening; the
existing `r4a_*` mutant for R4-A29 still names this test).

## 4. Tests, mutants, FLOORS, README

- Mutants: `r4f_` prefix, `# suite:` header per `tests/CONTRACT.md`, patches
  with no `index a..b` lines. Expected count: five (`r4f_f4_name_refusal_disables_drawer`,
  `r4f_anchor_between_no_aria`, `r4f_drawer_hint_last_child`,
  `r4f_fine_toggle_no_underline`, `r4f_degsel_change_unwired`). README mutant
  count set exact at the head.
- FLOORS: `tests/app.test.js` and `tests/drawer_seats.test.js` rows rise to
  CI's `js-results` `files[].total` for the branch; no row falls.
- The two new sandbox/browser tests in `drawer_seats.test.js` follow that
  file's existing helpers; no new helper file.

## 5. Verify (lane, before push)

```
node --test tests/app.test.js tests/drawer_seats.test.js
python3 tools/refresh_mutants.py --check
python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check && python3 tools/validate.py
node tools/boot_sim.js
python3 -m unittest tests.test_readme_currency tests.test_suite_health
```
No full e2e run and no full `tests/mutation_check.sh` locally; CI at the head
SHA is the oracle.

## 6. Acceptance

| id | criterion | evidence |
|---|---|---|
| F-A1 | Edit with `D Kürd` + valid scale: drawer toggle enabled, GENERATE disabled, refusal shown | drawer_seats test (a); mutant killed |
| F-A2 | `#scale-anchor-between` carries the aria-label; visible text unchanged | app.test pin; mutant killed |
| F-A3 | `#scale-drawer-hint` first in `#scale-drawer`; inside the scrollport at 380 x 667 with the drawer open at scroll top | drawer_seats tests (a) and (b); mutant killed |
| F-A4 | `#scale-fine-toggle` rule has `text-decoration: underline; text-underline-offset: .18em` and nothing else changed | app.test pin; mutant killed |
| F-A5 | removing the `degSel` change listener fails a test | mutant killed |
| F-A6 | no change to the `pan()` comment (F-6 verified current) | diff shows none |
| F-A7 | R4-A29 test fails on an equal-bytes rewrite | mtime assertion present; lane shows a local run with the guard removed failing |
| F-A8 | spec lines placing the hint read "first", marked superseded, nothing else in the spec changed | diff |
| F-A9 | section 5 gates of the refactor-4 plan all green; FLOORS rows only rose; README mutant count exact | CI at head SHA; PR body |

## 7. Standing merge gates (verbatim from the refactor-4 plan, section 5)

1. CI green at a head SHA verified against the local tip (`gh pr view <n> --json state,headRefOid`).
2. Independent reviewer PASS or PASS_WITH_NITS at that SHA, briefed with this plan's lane text verbatim (no added rules).
3. `python3 tools/refresh_mutants.py --check` green; mutant count reconciled in the PR (added, replaced `old -> new`, re-pointed - each named).
4. `panel-fit` verdicts unchanged (real and fallback).
5. `inline_engine.py --check`, `sync_decks.py --check`, `validate.py`, `boot_sim.js` green; no fixture digest moved; `data/decks.json` untouched.
6. FLOORS rows moved only as section 4 allows, only to CI's count for the branch; README counts within `test_readme_currency`'s band.
7. Rebase procedure of the house format (§20.24 of the drawer plan): fetch + rebase; both `--check`s; `refresh_mutants.py` committed on its own; own FLOORS rows + README counts from main's artifacts; push and wait for CI.

## 8. Stop conditions (lane reports, does not widen)

Any of: a `drawer_*` or `app.test.js` FLOORS row would fall; a fixture
digest moves; `panelStops()` or `DRAWER_HINT` would change; F-1's second
parse cannot distinguish a name-only refusal; the sandbox cannot dispatch
`change` for F-5; the hint at 380 x 667 is still outside the scrollport
after the move (report the measured bottom edge; do not add CSS).
