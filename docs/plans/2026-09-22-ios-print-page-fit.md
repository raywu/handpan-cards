# iOS print page fit: the narrow sheet still overflows the printable width

> **For agentic workers:** this plan is executed in the existing `claude/ios-print-teardown`
> worktree on top of PR #106. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the narrow (phone) print sheet renders every card COMPLETE - all four border
sides and all header copy - inside the printable area iOS Safari actually grants, with
the card still at its 62.65 x 87.21 mm spec size.

**Non-goals:** changing deck data or diagram geometry; changing the wide (desktop)
layout's card count; scaling the card below spec; adding a manual scaling instruction
for the user to follow; touching queue rows 140-143.

**Spec / provenance:** `tools/hifi.py` is the print spec (`CW, CH = 177.6, 247.2`;
`PAGE = (612, 792)`). Workstream B's goal is that custom decks get the same two print
options the built-in decks have. This plan closes B7, the owner device check, which is
the last gate on PR #106.

---

## What the second device check actually established

The owner reloaded and re-ran both print options on an iPhone 14 (iOS 26.6) and reported
the same edge cutoff. Pixel measurement of the print-preview screenshot settles three
things that the first round left as guesses.

1. **The zero-gutter fix IS live on the device.** Adjacent card borders render as a
   single 7px band (x=420-426 and x=741-747 at y=760 and y=900). At the old 12.2pt
   gutter those two borders would sit ~22px apart. The phone is not serving a stale
   cache, so cache is eliminated as a variable and `de89547` did what it claimed.
2. **The overflow is now about 1.2pt, not 25pt.** Scale from the paper: the white sheet
   spans x=48..1121 = 1073px = 612pt, so 1.7533 px/pt. Drawn content spans x=117..1049 =
   932px = **531.6pt**. Our narrow sheet is `3 x 177.6 = 532.8pt`. We are over the
   printable width by ~1.2pt total, which costs exactly the outer hairline borders and a
   sliver of the leading glyph - matching "D AEOLIAN 9" reading as ") AEOLIAN 9".
3. **iOS's real margin here is ~40.2pt per side (0.558in), not the 0.5in assumed in
   `de89547`.** That assumption is the defect: `(612 - 531.6) / 2 = 40.2`. The comment
   at `index.html:4164` and the test at `tests/app.test.js` both encode `PW - 72`
   (0.5in), which is the number that let a sheet 1.2pt too wide pass as fitting.

**Therefore three full-size columns cannot be made to fit a PORTRAIT Letter page on
iOS.** 532.8pt needs margins of at most 39.6pt per side; iOS grants ~40.2pt. There is no
gutter left to remove - `de89547` already spent that slack. The remaining levers are the
page box, the column count, and the card size, and the owner has already ruled the card
size out (2026-09-22: scaling would put the card ~5% under spec and loose in a sleeve).

## The `@page` lever does not exist on iOS (research, 2026-09-21)

The earlier draft of this plan proposed putting the narrow sheet on a
LANDSCAPE page (`@page{size:letter landscape}`) and gating it behind a device
check. **That fix is dead.** iOS Safari does not support the `@page` at-rule's
`size` descriptor at all: neither page-size keywords nor orientation values.
Sources: MDN browser-compat-data issue #28626; MDN `@page/page-orientation`;
W3cubDocs `@page/size`; Apple Developer Forums threads 695544 and 114327.
There is no direct CSS-based workaround.

Three consequences, all load-bearing for everything below:

1. **On iOS the page box is entirely platform-chosen** — paper AND margins.
   Our CSS controls only the CONTENT that lands inside it.
2. `PRINT_PAPER` (`index.html:4174`) and the `@page{size:...}` half of
   `printGridCSS()` are **inert on iOS**. The A4/Letter control the app
   exposes does nothing there. That is a documentation and follow-up item,
   not something this plan fixes.
3. `@page{margin:0}` is equally ignored, which is why a measured margin
   (~40.2pt/side) shows up at all.

## The fix: rotate the narrow sheet 90 degrees, and never let iOS pick `wide`

Two changes, both content-side, neither depending on `@page`.

**Part 1 — rotate the narrow sheet.** The narrow sheet is 3 x 177.6 = 532.8pt
wide by 2 x 247.2 = 494.4pt tall (zero gutters, shipped in `de89547`). Rotated
90 degrees it presents 494.4pt horizontally and 532.8pt vertically against a
measured iOS printable area of roughly 531.6 x 711.6pt. Both axes fit, and
they still fit at the suspected ~3% card oversize (509.2 x 548.8). Cards are
cut out of the sheet, so the sheet's orientation on paper is invisible to the
user: 6 cards per page and 10 pages are preserved, and the card keeps its
exact 177.6 x 247.2pt spec size.

Why a transform is not the same gamble `@page` was: `.printscale`
(`index.html:744-782`, emitted at `index.html:4193-4195`) **already** applies a
CSS transform to every printed card and has survived every device check in
this workstream, including the one that printed the card sheet correctly on
iOS. Transform-in-print is proven in this exact element tree; `@page` never was.

**Part 2 — iOS must never select the wide layout.** `printLayoutName(w)`
(`index.html:4180`) keys on viewport width alone. An iPad in portrait
(744/768/810/820/834 CSS px) and an iPhone 14 in landscape (844) both select
`wide` on the same iOS Safari. The wide sheet is 557.2 x 760.4pt and misses the
measured printable box on BOTH axes, and rotation cannot save it (760.4 > 711.6).
So the selector gains a platform clause: on iOS, always `narrow`. This is the
PR #106 reviewer's finding N3, promoted from a false code comment to a real
defect — the comment at `index.html:4163` currently asserts a safety that does
not hold.

### Rejected alternatives

- **`@page{size:landscape}`** — refuted above. Dead.
- **Scale the card down to fit** — the owner ruled this out on 2026-09-22: a
  card under spec is loose in a poker sleeve.
- **Trim the sheet to 531pt** — that is scaling the card by another name.
- **2 cols x 2 rows portrait** — fits with enormous slack and carries zero
  untested assumptions, but costs 2 cards per page (10 pages becomes 15) and
  REVERSES the owner's explicit ratification of "3 cols x 2 rows is right".
  **Retained as the designated fallback** if the device check in Task 3 shows
  iOS mis-renders the rotation.
- **Detect the real printable area at runtime** — no media query and no JS API
  exposes it (prior learning `browser-print-cannot-read-paper-size`,
  confidence 10/10). Measurement stays a constant we maintain by hand.

## Known open risks carried in from the PR #106 review

The reviewer (PASS_WITH_NITS at `39db0e3`) surfaced four that this plan must
either fix or file, not silently inherit:

- **N1** `PRINT_LAYOUTS.wide.gx/gy` are no longer pinned to `PRINT_GEOM` by any
  test; zeroing them stays green. The 3x3 desktop sheet is the one layout
  value-pinned to `tools/hifi.py`'s print spec. **Fixed in Task 4.**
- **N2** `PRINT_LAYOUTS.narrow.gy` is unpinned on its own axis (free anywhere
  from 0 to 225.6pt under the current bound). **Fixed in Task 4.**
- **N3** the width-only layout selector. **Fixed in Task 2.**
- **N4** `printSlots()` (`index.html:4198-4210`) still computes the OLD 557.2pt
  narrow geometry and `tests/test_render_agreement.py:531` pins it. It stays
  green only because `printSlots()` has no production caller. **Filed, not
  fixed** — queue row 140 already tracks the dead code; this plan adds the
  inconsistency to that row so whoever wires it up does not reintroduce B7
  with a green test vouching for it.
- **N6** `tests/app.test.js:3560-3564` uses a bare `72`. **Fixed in Task 1** by
  naming the constant.

## Global constraints

- Single-file app. No `<script src>` in `index.html`.
- Engine regions in `index.html` are generated - none of this work touches them.
- The `const DECKS` line is generated - untouched.
- Do not alter deck data or diagram geometry.
- TDD: test first, then implement. Every behavioural change gets a mutant.
- `tests/mutation_check.sh` takes no arguments and globs `tests/mutants/*.patch`; every
  patch needs `# kills:` and `# suite:` headers; no embedded quotes in `# suite:`.
- Floors in `tests/suite_health.py` are minimums and only ratchet. Never compute the
  e2e/app floor locally - push, read CI's own `ran N` line, raise in a second commit.
- `CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` or e2e
  silently no-ops.
- CI at the head SHA is the evidence, not a local green.

---

## Implementation tasks

### Task 1: Name the platform margin and rewrite the fit test so it FAILS first

**Files:** Modify `tests/app.test.js:3540-3570` (the test
`"the narrow print sheet fits inside a platform-enforced page margin"`).

The existing oracle is wrong, and that is why a 1.2pt-too-wide sheet shipped:
it asserts `w <= g.PW - 72`, i.e. a 36pt/side margin, against a device that
grants ~40.2pt/side. 532.8 <= 540 passes while the print clips.

- [ ] **Step 1.1** Replace the bare `72` with a named constant in the test,
      sourced from the app: `PRINT_SAFE.margin`, value **45pt**. 45 is the
      measured 40.2 rounded up with ~12% headroom, because the measurement
      came from one device at one scale factor.
- [ ] **Step 1.2** Rewrite the assertion to loop **every** entry of
      `PRINT_LAYOUTS` that a margin-constrained platform can select, and to
      compare the layout's **presented footprint** (rotated where the layout
      declares rotation) against the safe box
      `(PW - 2*margin) x (PH - 2*margin)` = 522 x 702.
- [ ] **Step 1.3** Re-assert `g.CW === 177.6` and `g.CH === 247.2` in the same
      test, so a future "fix" that shrinks the card to pass this test fails
      loudly instead.
- [ ] **Step 1.4** Add a second test asserting `printLayoutName` returns
      `"narrow"` for an iOS user agent at every wide-side viewport width
      (744, 768, 810, 820, 834, 844, 1024), and `"wide"` for a non-iOS UA at
      those same widths.
- [ ] **Step 1.5** Run `node --test tests/app.test.js`. Expected: **FAIL** on
      both new tests (532.8 > 522 unrotated; no iOS clause exists yet).

### Task 2: Add `PRINT_SAFE`, rotation, and the iOS clause

**Files:** Modify `index.html` (app JS region only, outside every engine block).

- [ ] **Step 2.1** Add beside `PRINT_PAPER` (`index.html:4174`):
      `const PRINT_SAFE = { margin: 45 };` with a comment recording the
      measurement (612pt paper, drawn content 531.6pt, therefore 40.2pt/side)
      and the date.
- [ ] **Step 2.2** Add `rotate: true` to `PRINT_LAYOUTS.narrow`, leave
      `wide` unrotated.
- [ ] **Step 2.3** In `printGridCSS()` (`index.html:4186-4195`), when the
      layout declares `rotate`, emit
      `#printroot .printsheet{transform:rotate(-90deg)}` alongside the existing
      grid rules. `.printpage` already flex-centres its child and `.printsheet`
      keeps its layout box under a transform, so the rotated sheet stays
      centred on both axes; no change to `.printpage` is needed.
- [ ] **Step 2.4** Rewrite `printLayoutName` to take the platform as well as
      the width, with the iOS clause first:
      `function printLayoutName(w, ua) { return isIOS(ua) ? "narrow" : (w >= 640 ? "wide" : "narrow"); }`
      Keep `isIOS` a small, testable UA predicate in the same region; pass
      `navigator.userAgent` at the single call site.
- [ ] **Step 2.5** Fix the false comment at `index.html:4163` — the wide
      layout keeps hifi's gutters because it is the **non-iOS** path, not the
      "desktop" path — and fix the stale breakpoint citation at
      `index.html:4176` (line 41 is
      `@media (min-width:640px) and (min-height:700px)`, a two-condition query
      that a landscape phone fails while `printLayoutName` matched it).
- [ ] **Step 2.6** Run `node --test tests/app.test.js`. Expected: **PASS**,
      including both Task 1 tests.
- [ ] **Step 2.7** Run `python3 tools/validate.py` (checks 1 and 4 must stay
      green: no DECKS drift, no engine-region drift).

### Task 3: Device gate — the owner runs B7 before anything else lands

This is the gate the last two attempts skipped, and both shipped a fix that
did not work. **Nothing downstream of this task starts until it returns.**

- [ ] **Step 3.1** Push the branch, wait for CI green, confirm the LAN server
      at `192.168.68.90:8732` serves the new bytes (it sends no
      `Cache-Control`, only `Last-Modified`, so verify the served line, not the
      worktree line).
- [ ] **Step 3.2** **Run A** — Full deck PDF on iPhone 14 / iOS 26.6. Pass
      criterion: every card border complete on all four sides, no clipped
      glyph anywhere on the sheet.
- [ ] **Step 3.3** **Run B** — Print shop version. Same criterion.
- [ ] **Step 3.4** **Run C** — Share, then Print with no CTA pressed. Must show
      the APP page, not a stale card sheet (D20's accepted risk).
- [ ] **Step 3.5** **Ruler check** — measure one printed card. Expected
      62.65 x 87.21 mm. The screenshot forensics suggest iOS may render
      ~2.4-3.3% over spec; if the ruler confirms it, that is a SEPARATE defect
      (see Task 5), not a reason to re-open this fix.
- [ ] **Step 3.6** If any of A/B fails, **stop and switch to the 2x2 portrait
      fallback** rather than iterating on rotation. Two device round-trips is
      the budget.

### Task 4: Mutants (close the reviewer's N1 and N2, and pin the new behaviour)

**Files:** Create five patches in `tests/mutants/`.

Build each by `git add`-ing the FIXED file, mutating the working copy, then
`git diff -- index.html | grep -v '^index [0-9a-f]*\.\.'`. Every patch needs
`# kills:` and `# suite:` headers, and `# suite:` must carry **no embedded
quotes** (use a dotted regex) because `tests/mutation_check.sh` runs the suite
through `eval`.

- [ ] **4.1** `p_print_narrow_not_rotated.patch` — drop `rotate: true`.
- [ ] **4.2** `p_print_safe_margin_understated.patch` — `45` to `36`.
- [ ] **4.3** `p_print_ios_selects_wide.patch` — remove the iOS clause from
      `printLayoutName`.
- [ ] **4.4** `p_print_wide_gutters_zeroed.patch` — reviewer N1:
      `wide: { gx: 0, gy: 0 }`. Needs a new assertion
      `PRINT_LAYOUTS.wide.gx === PRINT_GEOM.GX && .gy === PRINT_GEOM.GY`.
- [ ] **4.5** `p_print_narrow_gy_restored.patch` — reviewer N2: `gy` only,
      `gx` left at 0. Needs `narrow.gx === 0 && narrow.gy === 0` asserted
      explicitly, not merely bounded by arithmetic.
- [ ] **4.6** Run `tests/mutation_check.sh` on a clean tree (no arguments; it
      globs `tests/mutants/*.patch`, ~8 min, and refuses a dirty tree).
      Expected: all patches killed, none reported `(stale)`.
- [ ] **4.7** Update the README's stated mutant count.
      `tests/test_readme_currency.py` asserts it is within 10% of disk
      (`said >= int(n * 0.9)`); 350 on disk becomes 355.

### Task 5: File what this plan deliberately does not fix

**Files:** Modify `TODOS.md` and
`docs/plans/2026-09-16-remaining-work-coordination.md` (queue row 140).

- [ ] **5.1** New row: **the card renders ~2.4-3.3% over spec on iOS.** Column
      pitch measured 183.4pt against a 177.6pt spec (ratio 1.033), row pitch
      253.2pt against 247.2 (1.024). Candidate root cause: `.printscale`'s
      `scale(g.CW / 72 * 96 / PRINT_DESIGN_W)` (`index.html:4194`) assumes 96
      CSS px per inch in print context, which WebKit may not honour. Confirmed
      or refuted by Task 3's ruler check.
- [ ] **5.2** New row: **the A4/Letter paper control is inert on iOS.**
      `PRINT_PAPER` and the `@page{size:...}` emission do nothing there. The
      UI should say so, or the control should be hidden on iOS.
- [ ] **5.3** Amend queue row 140 with reviewer finding N4: `printSlots()` and
      `tests/test_render_agreement.py:531` pin a 557.2pt narrow geometry the
      shipped grid no longer uses. Anyone wiring `printSlots()` up
      reintroduces B7 with a green test vouching for it.
- [ ] **5.4** New row: `#printroot .printpage{height:${p.h}pt}` emits a hard
      792pt block into a ~711.6pt printable box. Pre-existing, unchanged here,
      survivable because narrow's rotated 532.8pt clears it either way — but
      the fragmentation behaviour is unverified on iOS.

**Explicit non-goal:** this plan does NOT change the wide layout's geometry.
Task 2 only stops iOS from selecting it. On a real desktop, `margin:0` is
honoured and 557.2 x 760.4pt is correct.

### Task 6: Push, CI, floors, fresh review, merge

- [ ] **6.1** Commit and push to `claude/ios-print-teardown` (PR #106).
- [ ] **6.2** Wait for all five checks: `data integrity`, `python suites`,
      `js suites (unit + e2e)`, `suite health`, `mutation gate`.
- [ ] **6.3** **Two-push floor protocol** — never compute the app/e2e floor
      locally. Read CI's own
      `tests/<file>: ran N, failed 0, skipped 0, floor M` line, then raise the
      floor in a second commit.
- [ ] **6.4** Spawn a **fresh** reviewer subagent at the final head SHA
      (`git checkout -B review-<lane> <sha>`, never by branch name), briefed
      with the rotation decision, the iOS clause, and findings N1-N6 so it can
      confirm they are closed. A reviewer that already said FAIL is anchored
      and must not be reused.
- [ ] **6.5** Merge `gh pr merge 106 --merge` (no `--delete-branch`) only once
      BOTH hold: CI green at a head SHA verified against the local tip, AND the
      fresh reviewer returned PASS or PASS_WITH_NITS at that same SHA, AND
      Task 3's device runs A, B and C are clean. **B7 is the gate; workstream
      B does not close without it.**

## NOT in scope

| Deferred | Why |
|---|---|
| The ~3% card oversize on iOS | A separate defect with a separate root cause (`.printscale`'s 96px/in assumption). Filed as Task 5.1. Fixing it here would conflate two failures and make the device check unreadable. |
| The wide layout's 557.2 x 760.4pt geometry | Correct on every platform that honours `margin:0`. Task 2 stops iOS reaching it; changing it would break desktop print for no gain. |
| `printSlots()` dead code and its stale 557.2pt test | Queue row 140 already owns it. No production caller, so it cannot cause the reported defect. Amended, not fixed (Task 5.3). |
| The A4/Letter control being inert on iOS | A UI-honesty problem, not a clipping problem. Filed as Task 5.2. |
| `.printpage{height:792pt}` fragmentation | Pre-existing and unchanged; narrow survives it either way. Filed as Task 5.4. |
| Queue rows 140-143 (dead code and test gaps) | Owner-selected next work, deliberately not started: it edits `index.html` and would invalidate the bytes the owner is device-checking. |
| Detecting the printable area at runtime | No API exposes it. Prior learning `browser-print-cannot-read-paper-size`, confidence 10/10. |

## What already exists and is being reused

- `.printscale`'s transform-in-print, already proven on iOS in this workstream
  — Part 1 rests on it rather than on a new platform capability.
- The zero-gutter narrow sheet from `de89547`, verified live on the device by
  pixel measurement (adjacent borders render as one ~7px band). That commit
  was correct; only its margin premise was wrong.
- `tests/mutation_check.sh`'s existing 350-patch corpus and the two-push floor
  protocol.
- `PRINT_GEOM`, `PRINT_LAYOUTS`, `printGridCSS` — all three keep their shape;
  the change is two new fields and one new emitted rule.

## Failure modes

| Failure | Detected by | Mitigation |
|---|---|---|
| iOS mis-renders `rotate(-90deg)` in print (blank page, sheared cards) | Task 3 runs A and B | Switch to the 2x2 portrait fallback. Budget: two device round-trips total. |
| The rotated sheet fits width but the platform's vertical margin is larger than its horizontal | Task 3 runs A and B | 532.8 against 702pt of safe vertical is 169pt of slack; a margin that eats it would be ~95pt/side, far outside anything observed. |
| The 45pt safe margin is still under-measured on another iOS device | Only a second device would show it | The measurement is now a NAMED constant with its derivation in a comment, so the next correction is a one-line change with a mutant guarding it. |
| Card prints over spec, so the rotated sheet grows | Task 3.5 ruler check | 509.2 x 548.8 at 3% still clears 522 x 702. A defect, but not a clipping defect. |
| The iOS UA predicate misses a future iPadOS UA string (desktop-class Safari) | Nothing automated | `p_print_ios_selects_wide.patch` pins the clause exists; the predicate's breadth is a known soft spot and a candidate follow-up. |

## Self-review

Three weaknesses I can name in this plan:

1. **The fit test still derives the footprint from `PRINT_LAYOUTS` rather than
   parsing `printGridCSS()`'s output.** A layout that declares `rotate: true`
   while the emitter fails to emit the rule would pass. Mutant 4.1 is the only
   thing covering that gap, and it covers it by deleting the flag, not by
   breaking the emission. Accepted: parsing emitted CSS in a DOM-stub test is
   a larger change than the defect warrants.
2. **The entire fix still rests on arithmetic over a DOM stub.** The reviewer's
   own note stands: `tests/e2e.test.js:1219` prints with
   `preferCSSPageSize:true`, which honours `@page{margin:0}` and therefore
   cannot reproduce a platform-enforced margin, and it runs at the default
   (wide) viewport. The narrow layout has zero rendered coverage anywhere.
   Task 3 is the only real oracle, which is exactly why it gates.
3. **`isIOS(ua)` is a user-agent sniff**, which this codebase otherwise avoids.
   The honest alternative — feature-detect whether `@page` is honoured — does
   not exist. Recorded rather than hidden.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | - |
| Outside Review | `codex-plan-review` (fell back to a Claude opus subagent; codex CLI decode error) | Independent 2nd opinion | 1 | unavailable | outside coverage not established |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 6 issues, 1 critical gap |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | - |

- **OUTSIDE COVERAGE:** provider `codex`, phase `plan-review`, status `unavailable` (CLI cannot decode the models response; `npm install -g @openai/codex` fixes it). The prior fallback was a native Claude subagent, which does not establish outside coverage. No completed external review exists for this plan.
- **VERDICT:** ENG CLEARED — ready to implement, gated on Task 3's device runs. The critical gap is that the narrow layout has no rendered test coverage anywhere, so Task 3 is the only real oracle and Task 6 must not merge without it.

**Auto-decisions taken under the standing AFK grant (owner to review on return):**
- **D1 — layout strategy.** Auto-picked **rotate the narrow sheet 90 degrees** over 2x2 portrait. Rationale: it preserves the owner's ratified "3 cols x 2 rows", keeps 6 cards/page and 10 pages, holds the card at exact spec size, and rests on a transform this codebase already runs successfully in print (`.printscale`) rather than on an unverified platform capability. 2x2 portrait is retained as the designated fallback in Task 3.6 and would reverse an explicit owner decision, so it was not auto-picked.
- **D2 — `/office-hours` prerequisite.** Skipped. The pixel forensics already supply the problem statement it would produce, and the owner is blocked on a device fix.

NO UNRESOLVED DECISIONS
