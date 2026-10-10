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

**Change.** Add one app-block helper, `layoutOptions()`: `const o =
sheetOptions(); delete o.name; return o;` (eng review R1: the name is a
plain key on the options object, so omitting it duplicates no
normalisation). In `syncParseState`'s refusal branch, when `editingId` is
set AND the first parse's options carried a `name` (the second parse is
otherwise byte-identical to the first and is skipped), run a second
`HPE.core.parseSeed` of the same text with `layoutOptions()`. When that
second parse is `ok`, the name was the only problem: treat the layout as
live - `boxOk = true`, the ok path's bottom-shell sync (`hadBottom` /
`bottomHeld`, outside voice O1: without it the bottom mirror control goes
stale when bottom notes appear or disappear under a bad name),
`noteCounts(second.value.fields)`, `paintLayout()`,
and when `paint` the pan preview painted as on the ok path
(`showPanPreview(second.value)`, plus the `solvePreviewLayout` crowded-pan
`say(..., "warn")` as the ok path does) - while the refusal line still shows
the FIRST parse's `res.reason`, `scaleBox` still carries `bad`, and `genBtn`
stays disabled. `hasTwoNoteRing()` (called by `openDrawer()`) parses with
`layoutOptions()` too (eng review R2: with the name included it returns
`true` on a name refusal and masks the "no ring of two notes" status once
the drawer is enabled). No change to the engine, to `sheetOptions()`, or to
the ok path. A refusal whose scale ALSO fails is unchanged (the second parse
is not ok). The second parse runs only on the refusal path, so the ok path
costs nothing. `resyncSheet`'s standing-refusal repaint parses with
`layoutOptions()` as well (outside voice O2: a collision refusal proves the
name was valid THEN, but the name box's `input` handler calls
`resyncSheet(true)` without clearing the refusal, so `D Kürd` typed after a
collision and then an orientation tap would skip the repaint; that parse
only feeds `noteCounts` and `paintPan`, never a generate). The placeholder
parse and `generateDeck` keep the name, deliberately: generate must keep
refusing a bad name.

**Tests** (`tests/app.test.js`, sandbox - eng review R3:
`tests/drawer_seats.test.js` is browser-only and skips as a whole without
`CHROME_BIN`): (a) on Edit, name `D Kürd` with a valid scale:
`#scale-layout-toggle` enabled, GENERATE CARDS disabled, `#scale-refusal`
names the bad name; (b) the same name with an unparseable scale: toggle
disabled, as today; (c) a built-in's Add path (no `editingId`) is unchanged
by the change; (d) name `D Kürd` with a VALID scale that has no ring of two
notes (the lane picks the string; `hasTwoNoteRing` exists for such pans):
opening the drawer shows the "no ring with two notes" status (outside voice
O4: asserting the status ABSENT would pass against today's `return true`,
so the test asserts it PRESENT despite the bad name); (e) bottom notes added
to, then removed from, (a)'s scale under the bad name: `#scale-mirror-bottom`
enabled then disabled, as on the ok path (O1). **Mutant**
`r4f_f4_name_refusal_disables_drawer` removes the second parse (restores
today's behaviour); killed by (a). Its `# suite:` names the app.test.js
test.

**Stop.** If `badNote(name)` cannot be told from a scale refusal by the
second parse alone, stop and report; do not touch `core.js`.

### F-2. `#1 / #2` gets an `aria-label` (10.5 item 2)

**Change.** `<button id="scale-anchor-between">` gains
`aria-label="#1 / #2, notes 1 and 2 either side of centre"` (eng review R4:
the accessible name starts with the visible text, WCAG 2.5.3 label-in-name,
so voice-control users who say what they see still hit it); visible text
`#1 / #2` and `aria-pressed` unchanged. `#scale-anchor-one` keeps its visible text as
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

Eng review R3 and outside voice O3 (placement and shape of test (a)):
`tests/drawer_seats.test.js` is browser-only - it skips as a whole without
`CHROME_BIN` - and the sandbox (`tools/sandbox.js`) does not populate static
children: `firstElementChild` is defined only on the synthetic `#scale-sheet`
surface, so a sandbox `firstElementChild` read on `#scale-drawer` proves
nothing. Test (a) is therefore a SOURCE-MARKUP pin in `tests/app.test.js`
(the house pattern of "DR2a (83, 132, 130)" and "DR3 order"): within the
`id="scale-drawer"` slice of `index.html`, `id="scale-drawer-hint"` comes
before `id="scale-anchor-label"`; plus the existing sandbox read that the
hint carries `DRAWER_HINT` and is shown when the drawer opens. Two existing
tests pin the hint LAST and the lane updates both to the new order, by
ownership: "DR2a (83, 132, 130): the DOM carries the new controls in the
order of 20.24 ..." and "DR3 order: orientation, mirrors, disclosure, finer
rows, RESET LAYOUT, hint" (its title changes to say the hint comes first).
Mutant `r4f_drawer_hint_last_child` names the updated "DR3 order" test in
its `# suite:`, so it is killable on a shell without a browser. Test (b)
stays in `drawer_seats.test.js`.

### F-4. Underline `#scale-fine-toggle` (10.5 item 4, verbatim brief)

> **(4) Finer-controls toggle underlined.** `#scale-fine-toggle` ("HARD TO TAP? SHOW FINER CONTROLS", a `<button>` styled as quiet text) reads as a link and is not underlined. Add `text-decoration: underline; text-underline-offset: .18em` to the `#scale-fine-toggle` rule and nothing else (the 44 px height, the 9.5 px type, the colour and the `:active` colour stay). Test: `tests/app.test.js` source-text pin on the rule (the house pattern for CSS pins), mutant `r4f_fine_toggle_no_underline`. `panel-fit` is not involved: the button is inside the sheet, not the settings panel.

> Stop conditions: any change to `DRAWER_HINT` copy, to `panelStops()`, to a fixture digest, or a `drawer_*` FLOORS row falling. Non-goals: tooltips, onboarding overlays, animation, changes to the step buttons or to RESET LAYOUT.

### F-5. `degSel` `change` handler has no killing test (routed from PR #285 review)

**Today.** `degSel.addEventListener("change", () => resyncSheet(true))` in
the app block. The PR #285 reviewer neutered it and `tests/app.test.js`
stayed green; the sandbox CAN dispatch `change`.

**Change.** None to the app. **Test** (`tests/app.test.js`, sandbox): on
Edit with a parsed scale, wrap `HPE.core.parseSeed` through `app.get` to
record the `parent` of the options it was last called with (the house spy
pattern: app.test.js already wraps `HPE.core.parseSeed = (function (real)
...)`), set `app.els["scale-degrees"].value` to a different index, dispatch
`{ type: "change" }` on it, and assert the recorded `parent` equals the new
value. Eng review R5: neither the parse line (`parseLineText` prints ding and
shell counts only) nor the pan preview carries a degree label, so the
observable effect of `resyncSheet(true)` is the re-parse with the new
parent, and the spy is the only sandbox-visible witness. **Mutant**
`r4f_degsel_change_unwired` removes the listener.

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
identical bytes passes. **Change** (test only): also assert `mtimeMs` is
unchanged across the four invocations (a rewrite with equal bytes still
bumps it; read it once before the first and once after the last), for BOTH
fixtures the tool can write - `card_face_v1.json` and, for the `--gen`
invocation, `gen_face_v1.json` (outside voice O5: today's bytes check never
looks at the `--gen` target). No app change, no mutant (a test-only
hardening; the existing `r4a_*` mutant for R4-A29 still names this test).
Evidence for F-A7 (O5): "remove the guard" is not it - that already fails
the exit-status assertion. The lane shows a local run with the tool
TEMPORARILY made to rewrite each fixture with its own bytes before refusing
(same message, same non-zero exit), where the only failing assertion is the
new mtime one; the change is reverted before commit.

## 4. Tests, mutants, FLOORS, README

- Mutants: `r4f_` prefix, `# suite:` header per `tests/CONTRACT.md`, patches
  with no `index a..b` lines. Expected count: five (`r4f_f4_name_refusal_disables_drawer`,
  `r4f_anchor_between_no_aria`, `r4f_drawer_hint_last_child`,
  `r4f_fine_toggle_no_underline`, `r4f_degsel_change_unwired`). README mutant
  count set exact at the head.
- FLOORS: `tests/app.test.js` and `tests/drawer_seats.test.js` rows rise to
  CI's `js-results` `files[].total` for the branch; no row falls.
- The one new browser test in `drawer_seats.test.js` (F-3 (b)) follows that
  file's existing helpers; no new helper file. Every other new test is a
  sandbox test in `tests/app.test.js` (eng review R3), and every mutant's
  `# suite:` names a test that runs without `CHROME_BIN`.

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
| F-A1 | Edit with `D Kürd` + valid scale: drawer toggle enabled, GENERATE disabled, refusal shown; the no-two-note-ring status still appears on open; bottom mirror control tracks bottom notes | app.test tests (a), (d), (e); mutant killed |
| F-A2 | `#scale-anchor-between` carries the aria-label starting with `#1 / #2`; visible text unchanged | app.test pin; mutant killed |
| F-A3 | `#scale-drawer-hint` first in `#scale-drawer` (source pin; DR2a and DR3 order tests updated); inside the scrollport at 380 x 667 with the drawer open at scroll top | app.test test (a) and drawer_seats test (b); mutant killed |
| F-A4 | `#scale-fine-toggle` rule has `text-decoration: underline; text-underline-offset: .18em` and nothing else changed | app.test pin; mutant killed |
| F-A5 | removing the `degSel` change listener fails a test | mutant killed |
| F-A6 | no change to the `pan()` comment (F-6 verified current) | diff shows none |
| F-A7 | R4-A29 test fails on an equal-bytes rewrite of either fixture | mtime assertions present for both fixtures; lane shows a local run with the tool temporarily rewriting equal bytes before refusing, where only the mtime assertion fails |
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

## 9. Engineering review (2026-10-09, `/plan-eng-review`, AFK: recommended options auto-decided)

### 9.1 Scope challenge

Seven items, all app-block, all sized at one function or one rule each. Nothing
to cut: F-6 is already closed by verification, F-7 is a test-only hardening
that costs one `statSync`. Nothing to add: the review found three plan
inaccuracies (R3, R5, R1's second-parse guard) and one accessibility
refinement (R4), none of which widens the lane. The simplest version of F-1
(a `delete o.name` on a copy of `sheetOptions()`) is the one the plan now
names.

### 9.2 Findings (R-ids) and decisions

| id | item | finding | confidence | decision |
|---|---|---|---|---|
| R1 | F-1 | "`sheetOptions()` minus name" is `delete o.name` on the returned object: no normalisation is duplicated, so stop condition 1 was moot and is dropped. The second parse is wasted when the first carried no `name` (identical options): guard on `o.name !== undefined`. The live path consumes the SECOND parse's `value`; the refusal line keeps the FIRST parse's reason. | 9 | D1: A, apply (plan text corrected in F-1) |
| R2 | F-1 | `hasTwoNoteRing()` parses with `sheetOptions()` and returns `true` on `!res.ok`; once the drawer is enabled on a bad-name deck it masks the "no ring of two notes" status. `resyncSheet`'s standing-refusal repaint and `generateDeck` are safe: a collision refusal follows a parse that accepted the name, and generate must keep refusing. | 7 | D2: A, route `hasTwoNoteRing()` through `layoutOptions()` and add test (d) |
| R3 | F-1, F-3, §4 | `tests/drawer_seats.test.js` skips as a whole without `CHROME_BIN`, so the plan's "sandbox" tests there could not run locally and their mutants were killable only in CI. | 9 | D3: A, sandbox tests move to `tests/app.test.js`; the browser test (b) stays; mutants point at app.test.js |
| R4 | F-2 | `aria-label` REPLACES the accessible name; dropping the visible `#1 / #2` fails WCAG 2.5.3 (label in name) for voice control. | 6 | D4: A, prefix the visible text |
| R5 | F-5 | Neither the parse line nor the pan preview renders degree labels, so the plan's observable effect did not exist. The house `parseSeed` spy makes the re-parse with the new `parent` observable. | 9 | D5: A, spy test |
| R6 | F-3 | Test (b) at 380 x 667 measures fallback fonts in CI (harness blocks Google Fonts); real fonts are taller. The hint is a `<p>` at the top of the drawer, so a fallback-font pass bounds the real case from above only by a few px. Acceptable: the stop condition already asks the lane to report the measured bottom edge. | 5 | D6: B, keep as planned, record the caveat |
| R7 | F-7 | `mtimeMs` on APFS has ns resolution; an equal-bytes rewrite always bumps it. Read it once before the first invocation and once after the last. | 8 | D7: A, apply (no plan text change needed) |

Outside voice (codex, `gpt-6-astra`, read-only, completed): five findings,
each verified against the code before acceptance.

| id | item | finding (verified at) | decision |
|---|---|---|---|
| O1 | F-1 | The ok path syncs `hadBottom` / `bottomHeld` (`syncParseState`, just after `boxOk = true`); the live path skipped it, leaving the bottom mirror control stale. | D8: A, carry the sync over; test (e) |
| O2 | F-1 | R2's exemption of `resyncSheet`'s standing-refusal repaint was false: the name box's `input` handler calls `resyncSheet(true)` without clearing the refusal, so a bad name typed after a collision skips the repaint on the next orientation tap. | D9: A, that parse uses `layoutOptions()` too |
| O3 | F-3 | The sandbox defines `firstElementChild` only on `#scale-sheet` (`tools/sandbox.js`, layout boot) and never populates static children, so the sandbox child-order read proves nothing; two existing tests ("DR2a (83, 132, 130) ..." and "DR3 order ...") pin the hint LAST and would break. | D10: A, source-markup pin; update both tests |
| O4 | F-1 | Test (d) as written asserted the status ABSENT, which today's `return true` also satisfies. | D11: A, assert PRESENT on a no-two-note-ring scale |
| O5 | F-7 | "Guard removed" fails the exit-status assertion first, so it validates nothing new; `--gen` writes `gen_face_v1.json`, which the bytes check never reads. | D12: A, both fixtures; equal-bytes-rewrite probe as evidence |

Codex's recommendation was "revise before implementation"; the revisions
above are applied in the item text. No finding was rejected.

Auto-decisions D1 to D12 are listed for the owner on return. None is
destructive; every one keeps the lane inside section 1's goal and non-goals.

### 9.3 Architecture and data flow

```
scaleBox.value ──> parseSeed(text, sheetOptions())   ─ok─> ok path (unchanged)
                          │
                       refused
                          │ editingId && options.name !== undefined
                          v
                   parseSeed(text, layoutOptions())  ─ok─> boxOk=true, noteCounts(2nd),
                          │                                paintLayout(), showPanPreview(2nd)
                       refused                             refusal line = 1st reason
                          v                                genBtn.disabled stays true
                   today's refusal branch (unchanged)
```

No new state, no new element, no engine change. `layoutOptions()` is the one
new function and has three callers (`syncParseState` refusal branch,
`hasTwoNoteRing`, `resyncSheet`'s standing-refusal repaint).

### 9.4 Failure modes

- F-1: second parse also refused (scale really is bad): falls through to
  today's branch. Covered by test (b).
- F-1: `editingId` unset (Add path): no second parse. Covered by test (c).
- F-1: drawer opened on a name-refused deck: `openDrawer()` ->
  `hasTwoNoteRing()` with `layoutOptions()` -> real answer. Covered by (d).
- F-1: bottom notes appear or disappear under a bad name: `hadBottom` /
  `bottomHeld` sync carried over. Covered by (e).
- F-1: bad name typed after a standing collision refusal, then an
  orientation tap: `resyncSheet`'s repaint parses without the name. Covered
  by the lane's test of the refusal branch (an extension of (a)).
- F-3: `paintDrawer` reads the hint by id; the move cannot break it. The
  spec's five "last" lines are marked superseded, not rewritten.
- F-4: `panel-fit` does not see `#scale-fine-toggle` (inside the sheet).
- F-5: a `change` with the same value still re-parses; the test changes the
  value so the spy sees a difference.

### 9.5 Test coverage

```
item   unit/sandbox (app.test.js)     browser (drawer_seats)   mutant
F-1    (a)(b)(c)(d)(e)                -                        r4f_f4_name_refusal_disables_drawer
F-2    markup pin                     -                        r4f_anchor_between_no_aria
F-3    (a) source pin + DRAWER_HINT;  (b) 380x667 scrollport   r4f_drawer_hint_last_child
       DR2a + DR3 order updated
F-4    CSS pin                        -                        r4f_fine_toggle_no_underline
F-5    parseSeed spy + change         -                        r4f_degsel_change_unwired
F-6    none (no change)               -                        -
F-7    R4-A29 mtime, both fixtures    -                        existing r4a_* mutant
```

Framework: node `--test` (JS), python `unittest`; mutation gate
`tests/mutation_check.sh` in CI. Every mutant's `# suite:` runs without
`CHROME_BIN`.

### 9.6 Performance

One extra synchronous `parseSeed` on the refusal path only, per keystroke
while the sheet is in a name-refused state. The ok path is untouched.

### 9.7 Parallelisation

Sequential implementation, no parallelization opportunity: one lane, one PR,
seven items that share `index.html` and `tests/app.test.js`.

### 9.8 Implementation tasks

1. `layoutOptions()` + the refusal-branch second parse with the bottom sync +
   `hasTwoNoteRing()` and `resyncSheet` reroutes; tests (a)-(e); mutant.
2. `aria-label` on `#scale-anchor-between`; pin; mutant.
3. Move `#scale-drawer-hint`; app.test.js (a) source pin, DR2a and DR3 order
   updated; drawer_seats (b); mutant; spec lines marked superseded.
4. `#scale-fine-toggle` underline; pin; mutant.
5. `degSel` spy test; mutant.
6. R4-A29 mtime assertions for both fixtures; equal-bytes probe evidence.
7. `refresh_mutants.py --check`, FLOORS rows from CI, README count, PR.

### 9.9 Approval readiness

## Decision ledger

D1 A, D2 A, D3 A, D4 A, D5 A, D6 B, D7 A, D8 A, D9 A, D10 A, D11 A, D12 A -
all recommended options, auto-decided under AFK and recorded in 9.2.

Approval readiness: PASS

## GSTACK REVIEW REPORT

| # | Finding | Severity | Decision | Status | Where |
|---|---|---|---|---|---|
| R1 | second parse = `delete o.name`; guard on a present name; second value feeds the live path | medium | D1 A | applied | F-1 |
| R2 | `hasTwoNoteRing()` masks the no-ring status on a name refusal | medium | D2 A | applied | F-1 |
| R3 | `drawer_seats.test.js` is browser-only; sandbox tests belong in `app.test.js` | high | D3 A | applied | F-1, F-3, §4 |
| R4 | aria-label must start with the visible `#1 / #2` | low | D4 A | applied | F-2 |
| R5 | no degree label is observable; use the `parseSeed` spy | high | D5 A | applied | F-5 |
| R6 | 380 x 667 measure is fallback-font only | low | D6 B | recorded | F-3 |
| R7 | mtime read once before and once after | low | D7 A | applied | F-7 |
| O1 | bottom-shell sync missing on the live path | high | D8 A | applied | F-1 |
| O2 | standing-refusal repaint still parses with the name | medium | D9 A | applied | F-1 |
| O3 | sandbox cannot see child order; DR2a and DR3 order pin the hint last | high | D10 A | applied | F-3 |
| O4 | test (d) asserted the wrong direction | high | D11 A | applied | F-1 |
| O5 | F-A7 evidence proves nothing new; `--gen` fixture unobserved | medium | D12 A | applied | F-7 |

OUTSIDE COVERAGE: codex (gpt-6-astra) completed; 5 findings, 5 accepted, 0 rejected.

VERDICT: READY. Scope unchanged (seven items, one PR, section 10.5 of the
refactor-4 plan plus the routed items); five plan inaccuracies and five
outside findings corrected in the item text; approval readiness PASS.

NO UNRESOLVED DECISIONS
