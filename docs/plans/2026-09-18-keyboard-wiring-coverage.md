# Keyboard wiring coverage (lane S6)

> **READ FIRST - one of this plan's prescriptions was overturned during
> execution.** Everywhere below that this document argues for measuring the
> keyboard as `vv.height * vv.scale` and `vv.offsetTop * vv.scale` rather than
> branching on `vv.scale`, it is WRONG and was reversed in `c7098df` after the
> independent review FAILed `a434058`. `vv.offsetTop` is already in layout px,
> so scaling it is a unit error and the lift and the cap end up answering
> opposite questions as the reader pans. What shipped: while `vv.scale > 1.01`
> the page clears BOTH writes and makes no claim. The full reasoning is in the
> Task 2 block below and in queue row 87 of
> `docs/plans/2026-09-16-remaining-work-coordination.md`, which is the
> authoritative record. The rest of this plan - the CDP seam, the mutants, the
> teardown fix - executed as written.

**Goal:** close the coverage gap that has kept the keyboard fix unverifiable by
CI (queue row 54), and fix the two real defects that gap was hiding
(rows 87, 88/55).

**Why now:** row 54 says the wiring is "invisible to every environment CI can
run" because headless Chromium's `visualViewport` always equals the layout
viewport. Two spikes (2026-09-18) proved that is only half true. Both
measurements below were taken at a **390x844 mobile-emulated viewport** against
this branch's shipped `index.html`:

| state | `innerHeight` | `vv.height` x `vv.width` | `vv.scale` | `sheetSurf.transform` | `sheetSurf.maxHeight` |
|---|---|---|---|---|---|
| base | 844 | 844 x 390 | 1 | `""` | `""` |
| `setPageScaleFactor 2` | 844 | 422 x 195 | 2 | `translateY(-422px)` | `414px` |
| back to `1` | 844 | 844 x 390 | 1 | `""` | `""` |
| faked `vv.height 400` | 844 | 400 x 390 | 1 | `translateY(-444px)` | `392px` |
| `clearKeyboard()` | 844 | 844 x 390 | 1 | `""` | `""` |

- `Emulation.setPageScaleFactor: 2` produces a REAL shrunken visual viewport
  with `scale === 2`. That is a genuine pinch-zoom, not a fake, and row 2 of the
  table is **row 87 reproduced in CI**: the shipped app lifts and caps the sheet
  for a reader who is only zooming.
- An in-page `Object.defineProperty(visualViewport, "height", ...)` + a real
  `dispatchEvent(new Event("resize"))` drives `applyKbOffset()` end to end
  against the shipped file (row 4).
- Rows 3 and 5 are the teardown evidence: both levers restore every observable
  cleanly, which is what makes them safe to use inside the one shared browser
  session (see Task 1, Step 3).
- What does NOT work, and must not be claimed:
  `Emulation.setDeviceMetricsOverride`'s `viewport` clip leaves `visualViewport`
  untouched. It clips the render surface only. There is no CDP soft-keyboard
  emulation.

(An earlier draft of this section quoted `vv 195x350` against `inner 390x700`.
That was a 390x700 spike and does not match the 390x844 viewport every task
below uses. The table above supersedes it.)

So the harness tests the WIRING, not the premise. The premise - that a real iOS
keyboard shrinks `visualViewport.height` - stays an owner-device claim
(rows 51, 67) and this plan does not pretend to close it.

**Tech:** vanilla JS in `index.html`; `node --test`; the CDP helper at
`tests/helpers/cdp.js`; the mutant corpus under `tests/mutants/` gated by
`tests/mutation_check.sh`.

## Global constraints

- Single-file app: no `<script src>` in `index.html`.
- Engine regions and the `const DECKS` line are GENERATED; never hand-edit.
- Do not alter deck data or diagram geometry.
- TDD: the failing test lands before the implementation.
- Test at 380px viewport; mobile target iPhone 14 / iOS 26.6.
- Mutation gate must end at 100% with no stale patches.
- `CHROME_BIN` must be exported or e2e mutants report NOT EVALUATED.
- **Every CDP emulation lever is torn down in the same test that sets it.**
  `tests/e2e.test.js` shares ONE browser session across all 4706 lines;
  `setPageScaleFactor` and the `defineProperty` shadowing are global page state
  that survives a test boundary. A leaked lever reproduces the known false-kill
  signature (~24 unrelated e2e tests failing in 0.1ms).

- **`interactive-widget=resizes-content` (`index.html:13`) is an opt-out this
  plan must state.** Where a browser honours that hint it shrinks the LAYOUT
  viewport on keyboard open, so `innerHeight - vv.height` is 0 and the whole
  fix is inert by design. The faked-viewport tests below assert behaviour that
  never occurs on such an engine. They are still correct tests - they pin the
  fallback path for engines that do not honour it, which is what iOS Safari
  has historically been. Nothing here should be read as "the lift fires on
  every browser".

## Non-goals

- Emulating a soft keyboard. It is not possible here; saying otherwise is the
  failure mode this plan exists to avoid.
- Row 78's `color:transparent` case (owner-deferred).
- Row 86's N3, N4, N7 (copy and unreachable-path nits).
- Rows 46-50, 67-69, 81, 91. The gstack upgrade stays deferred.
- A `vv.scale > 1` early return. An earlier draft of this plan chose one; the
  outside-voice review killed it. See Task 2.

## Ownership

Owns: `applyKbOffset` / `kbOffset` / `kbCap` / `showSheet` / `hideSheet` in
`index.html`, the `#scale-*` sheet CSS, `tests/e2e.test.js`,
`tests/app.test.js`, `tests/helpers/cdp.js`, `tests/mutants/`, and
`docs/plans/2026-09-16-remaining-work-coordination.md`.
Touches nothing in `src/engine/`, `data/`, or `tools/`.

## Task order, and why it is not the obvious one

The implementation tasks (2 and 3) come BEFORE the mutant-corpus task (4).
A patch in `tests/mutants/` carries a context window around the mutated line;
cutting mutants against `applyKbOffset` and `hideSheet` and then editing those
exact functions strands every patch just cut. The corpus is cut once, against
the final shape of the code.

```
T1 seam (cdp.js)
  |
  +-- T2 row 87  (applyKbOffset)  --+
  +-- T3 rows 88/55 (hideSheet)   --+--> T4 row 54 corpus --> T5 hygiene --+
                                                                          |
                                     T6 bookkeeping (docs only) ----------+--> T7 deliver
```

---

### Task 1: a CDP seam for a shrunken visual viewport

**Files:** Modify `tests/helpers/cdp.js`, `tests/e2e.test.js`.

**This task MOVES an existing helper; it does not invent one.**
`tests/e2e.test.js:3591-3597` already defines a local
`raiseKeyboard(vvHeight)` - the identical `Object.defineProperty` +
`dispatchEvent(new Event("resize"))` stub, landed by lane S5 in `d644491`
(queue row 82) and used at `:3661`, `:3665`, `:3677`, `:3682`. Adding a second
keyboard stub in the same file is the failure mode here. Promote that one to
`cdp.js`, rewrite its four call sites, and add only what is genuinely new
(`clearKeyboard`, `setPageScale`).

**Interfaces produced:**
- `b.fakeKeyboard(vvHeight, vvOffsetTop = 0)` - shadows `visualViewport.height`
  and `.offsetTop` on the instance and dispatches a real `resize`. Returns the
  values the page then reports.
- `b.clearKeyboard()` - deletes the shadowing properties and dispatches `resize`.
- `b.setPageScale(factor)` - wraps `Emulation.setPageScaleFactor`.

Each carries a comment saying what it does and does NOT prove.

- [ ] **Step 1: failing e2e test** - "the sheet answers a shrunken visual
      viewport by lifting and capping the surface": open the Add page at
      390x844, `fakeKeyboard(400)`, assert `transform` is
      `translateY(-444px)` and `maxHeight` is `392px`.
- [ ] **Step 2: run it, watch it fail** on `b.fakeKeyboard is not a function`.
      Expectations are DERIVED, not hard-coded: compute them in-test from
      `innerHeight` and the faked height (`off = inner - vvH`,
      `cap = round(vvH - 8)`), so a neighbouring test that leaves a different
      viewport set (`:3682`'s teardown uses `setViewport(900,900)`) fails
      loudly instead of asserting a stale `-444px`.
- [ ] **Step 3: add the three helpers**, and the two teardown rules that make
      them safe in a shared session:
      - every test that calls `fakeKeyboard` ends with `clearKeyboard()` and
        every test that calls `setPageScale(n)` ends with `setPageScale(1)`,
        both in a `try { ... } finally { ... }` or a `t.after(...)` so an
        assertion failure cannot leak the lever into the next test;
      - `fakeKeyboard`'s doc comment states that the shadowing is per-document
        and **does not survive `goto()`**. A test that navigates after faking
        silently gets an unshrunk page and passes for the wrong reason; fake
        after the last navigation, never before.
- [ ] **Step 4: run it, watch it pass.** Then run the WHOLE file
      (`node --test tests/e2e.test.js`) and confirm no test after it regressed -
      that is the teardown evidence, and a `--test-name-pattern` run cannot
      produce it.
- [ ] **Step 5: commit.**

### Task 2 (row 87): a pinch-zoom is not a keyboard

**Files:** Modify `index.html` (`applyKbOffset`, and the comment block above
`kbOffset` at `index.html:4591`). Test: `tests/e2e.test.js`, `tests/app.test.js`.

A pinch-zoom shrinks `visualViewport.height` the same way a keyboard does, so
today the sheet lifts and caps for a reader who is only zooming in (measured:
`translateY(-422px)` / `414px` at scale 2, no keyboard).

**SUPERSEDED IN EXECUTION - read this block for history only.** The plan
prescribed arithmetic rather than a branch, and it shipped that way in
`a434058`:

```js
const vh = vv.height * vv.scale;      // WRONG - see below
const vt = vv.offsetTop * vv.scale;
const off = kbOffset(window.innerHeight, vh, vt);
const cap = kbCap(window.innerHeight, vh);
```

The independent review FAILed it, and correctly. `vv.offsetTop` is ALREADY in
layout px and saturates at `innerHeight - vv.height`, so multiplying it by the
scale is a unit error: measured at 390x844, scale 2, a 336px keyboard, the lift
decayed from `translateY(-336px)` at `offsetTop 0` to nothing at `offsetTop
168` and beyond, while the cap - which never sees `offsetTop` - went on
reporting `500px`. Two halves of one fix, opposite answers, and at
`offsetTop 300` a regression against the pre-lane code.

The claim above that this was "verified at every pan position in the probe" was
false: the probe only ever measured `offsetTop 0`, the one value at which the
defect is invisible.

**What shipped instead** (`c7098df`): while `vv.scale > 1.01` the page makes no
claim at all - both the lift and the cap are cleared together, and panning is
the reader's. No arithmetic gets both halves right, because the surface is laid
out at `100dvh`, so a zoomed page is taller than the screen and "stay above the
keyboard" and "leave the zoom alone" are not simultaneously satisfiable (the
fully geometric lift at scale 2 is ~590 layout px, which IS the
treat-zoom-as-keyboard behaviour row 87 forbids).

The block above also rejected a `vv.scale > 1` branch as "strictly worse on
device - it disables the fix whenever iOS auto-zoom fires". That premise is
false for this page: `#scale-box`, `#scale-name` and `#scale-degrees` pin 16px
(`index.html:460,583,584`), and iOS only auto-zooms a focused input BELOW 16px.
Every `scale > 1` here is two deliberate fingers.

Queue row 87 of `docs/plans/2026-09-16-remaining-work-coordination.md` carries
the authoritative resolution. Pinned by
`tests/mutants/e_kb_zoom_reads_as_a_keyboard.patch`.

- [ ] **Step 1: failing e2e test** - "pinch-zooming the page does not lift the
      sheet". The oracle is POSITIVE THEN NEGATIVE in one test, or it is
      satisfied by the very mutants Task 4 exists to kill (a gutted
      `applyKbOffset` passes any assert-empty test):
      open the sheet, `fakeKeyboard(400)`, assert the transform is NON-empty
      and the cap is set; `clearKeyboard()`; `setPageScale(2)`; assert both
      are `""`; `setPageScale(1)` in `finally`.
- [ ] **Step 2** Run it; expect FAIL with `translateY(-422px)`.
- [ ] **Step 3** Apply the four-line change above. Make both style writes
      conditional (`if (el.style.x !== v)`) so the `visualViewport` `scroll`
      listener, which fires at frame rate during a pinch-pan, does no style
      writes when nothing changed.
- [ ] **Step 4: rewrite the stale comment.** The block above `kbOffset`
      currently claims "headless Chromium cannot open a real keyboard, so that
      pure function is the only part of this fix CI can verify (see TODOS.md
      and the PR body)". That was already half-false when S5 landed
      `raiseKeyboard`; Task 1 finishes the job. Replace it with what is now
      true: CI drives the whole wiring through the real event path, and what
      remains unverifiable is only the premise. Note the
      `interactive-widget=resizes-content` opt-out there too. Update the
      matching claim in `TODOS.md`.
- [ ] **Step 5: pin the 16px input font-size.** iOS Safari auto-zooms into any
      input with `font-size < 16px`. Under the arithmetic that no longer
      disables the fix, but it does change what the lift is computed against,
      and the owner's reported geometry assumes no auto-zoom. `#scale-box`
      (`index.html:460`) and `#scale-name` (`index.html:583`) are both 16px
      today and nothing holds them there. Add a test asserting both compute to
      `>= 16px`, with a comment naming this as the reason.
- [ ] **Step 6** Run the whole e2e file plus `tests/app.test.js`. The existing
      S5 keyboard tests at `:3661`-`:3682` run at scale 1 and must be
      byte-for-byte unaffected; if any moves, the arithmetic is wrong.
- [ ] **Step 7** Commit.

### Task 3 (rows 88 and 55): close resets both writes - VERIFY BEFORE BUILDING

**Files:** `index.html` - **`hideSheet()` at `index.html:4745`**, not
`closeScaleSheet()`. Test: `tests/e2e.test.js`.

**This task starts with a question, not a test, because the obvious TDD step
cannot fail.** The `visualViewport` `resize` listener (`index.html:4634-4636`)
is NOT gated on `sheetOpen`. So `clearKeyboard()` dispatches a resize that runs
`applyKbOffset()` while the sheet is hidden and writes `maxHeight = ""` before
any reopen. The sequence an earlier draft prescribed - `fakeKeyboard(400)` ->
open -> close -> `clearKeyboard()` -> reopen -> assert `maxHeight === ""` -
PASSES on unfixed code. Row 55's own note already said the asymmetry is
unobservable on every reachable path.

- [ ] **Step 1: establish reachability, and be willing to conclude it is not
      reachable.** Find an ordering where the stale `maxHeight` is observable:
      the sheet must reopen with the viewport still shrunk from a PREVIOUS
      session and no intervening `resize`. Candidates: reopen via keyboard nav
      with no viewport event between; a `history.back()` path that re-shows
      without a resize. Write the test and watch it FAIL against today's code.
- [ ] **Step 2a (reachable)** Add the `maxHeight` reset beside the `transform`
      reset in `hideSheet()`, extend that function's comment to cover both, and
      carry a mutant for it into Task 4.
- [ ] **Step 2b (NOT reachable)** Then this is a comment-only tidy and it ships
      with **no mutant** - a patch nothing can kill fails the gate at 100%,
      which is the cost Task 4 must not pay. Add the reset anyway (it is
      correct and free), record in the queue that rows 55/88 closed as
      unobservable-by-construction with the reason, and say so in the PR body.
      Do not manufacture a test that only passes because it asserts nothing.
- [ ] **Step 3** Re-cut `tests/mutants/d_layout_preview_sticks.patch` and sweep:
      `for f in tests/mutants/*.patch; do git apply --check "$f" || echo STALE $f; done`
- [ ] **Step 4** Commit.

**Naming correction, carried into the queue doc by Task 6:** row 54's fourth
mutant and row 55 both say `closeScaleSheet` (row 55 cites `index.html:4493`).
The transform reset has never lived there - `closeScaleSheet()` only guards
`sheetOpen`, clears `sheetRouted`, calls `hideSheet()` and pops history. A
mutant cut against `closeScaleSheet` would mutate the wrong function.

### Task 4 (row 54): re-measure first, then kill what actually survives

**Files:** Test: `tests/e2e.test.js`. Patches in `tests/mutants/`.

**Row 54 was written at `2ec374d`, before lane S5 landed its honest keyboard
test and `tests/mutants/e_kb_sheet_never_translates.patch`.** That patch
already mutates the transform write and already kills. S5's oracle clips by
`vv.offsetTop + vv.height` and by `.sheetbody`, so row 54's mutations 1 and 2
are plausibly dead too. Budgeting new tests for coverage that already exists
is the waste this task is reordered to avoid.

- [ ] **Step 1: re-run the four row-54 mutations against TODAY's suite** before
      writing anything. Apply each by hand, run the full e2e file, record
      killed-or-survived in the queue row. Only survivors get new tests.
- [ ] **Step 2** For each survivor, name the test that will kill it, then write
      it. Likely remaining: `showSheet` no longer calling `applyKbOffset()`
      (fake the keyboard BEFORE the open, assert the transform after it), and
      the new `vv.scale` arithmetic (Task 2 Step 1 covers it). Every oracle is
      positive-then-negative per Task 2 Step 1's rule.
- [ ] **Step 3** Commit the tests, then generate every patch from a real
      `git diff` on the committed tree - never hand-written; `mk()` runs
      `git checkout -- index.html` and destroys uncommitted work.
- [ ] **Step 4** Full gate with `CHROME_BIN` exported; zero survivors, zero
      NOT EVALUATED. Read the verdict line, not the exit code.
- [ ] **Step 5** Commit.

### Task 5 (row 86 N6 and N9): corpus hygiene

**Files:** `tests/mutants/`.

- [ ] **Step 1** N6: name the test that should kill a mutant dropping
      `delBtn.onclick`'s `if (!editingId) return;` BEFORE cutting it. If no
      existing test covers it, write that test first, watch it fail against a
      hand-applied mutation, then cut the patch. (Precondition asserts on the
      delete button must use `hasAttribute("data-armed")`, not `textContent` -
      the app-test DOM stub initialises `button.textContent` to `''`.)
- [ ] **Step 2** N9: four patches carry stale `index 169aa79..` blob headers
      (`d_delete_stays_armed_across_visits`, `d_page_layer_closes_on_tap`,
      `e_edit_back_ignored`, `e_sheet_primary_back_in_the_scroll`). Re-cut each
      from the committed tree so the header states the truth.
- [ ] **Step 3** Full gate green, no stale patches.
- [ ] **Step 4** Commit.

### Task 6: cycle bookkeeping

**Files:** `docs/plans/2026-09-16-remaining-work-coordination.md`.

- [ ] **Step 1** Row 89: correct row 84's description of the disarm mechanism
      (it says `onblur`; it is a `pointerdown` on the sheet plus `onblur`).
- [ ] **Step 2** Correct the `closeScaleSheet` -> `hideSheet` naming in rows 54
      and 55 (see Task 3) so the queue does not outlive this lane with a
      wrong function name in it.
- [ ] **Step 3** Mark rows 54, 55, 87, 88 resolved with their SHAs; mark the
      N6/N9 half of row 86 resolved and leave N3/N4/N7/N10 open.
- [ ] **Step 4** Rewrite **Cycle state**: it still describes wave 2 and does not
      mention lanes S5 or S6, PRs #83, #85, #86, or the merges at `916d502`
      and `8733493`. Record that #85 closed as MERGED because its head
      `4d4dddc` is an ancestor of main.
- [ ] **Step 5** Commit.

### Task 7: deliver

- [ ] `python3 tools/validate.py`, both JS suites in FULL (`node --test
      tests/*.test.js`, not name-filtered), the full gate with `CHROME_BIN`
      exported and `E2E_PORT` unset. Row-68's known flake
      (`tests/e2e.test.js:384`, `CDP timeout: Input.dispatchMouseEvent`) is
      re-run alone before it is called a flake.
- [ ] Push, open a PR, wait for CI at the final SHA. CI's run at that SHA is the
      evidence; the local run is a smoke test.
- [ ] Verify `pr_url` (`gh pr view <n> --json state,headRefOid`, head SHA ==
      local tip) BEFORE spawning the reviewer.
- [ ] A FRESH independent reviewer at the verified head SHA, read-and-report
      only, mutant budget 5. Then merge (`gh pr merge <n> --merge`, no
      `--delete-branch`).

## Acceptance criteria

Every verify command runs the WHOLE file. `--test-name-pattern` runs a test in
isolation, which is strictly weaker: it cannot see a leaked CDP lever and it
cannot see row 68's order-dependent flake. Name-filtered runs are for the
red/green loop inside a task, never for acceptance.

| # | Criterion | Verify |
|---|---|---|
| A1 | A shrunken visual viewport lifts and caps the surface, driven through the real event path | `node --test tests/e2e.test.js` |
| A2 | All four mutations named in row 54, plus the two new guards, are killed | `bash tests/mutation_check.sh` |
| A3 | A pinch-zoom leaves the sheet alone, and a real shrink still lifts it, in one test | `node --test tests/e2e.test.js` |
| A4 | Rows 55/88 are either closed by a failing-then-passing test, or recorded as unobservable with the reason | `node --test tests/e2e.test.js` + the queue row |
| A5 | Gate at 100%, zero stale patches, zero NOT EVALUATED | `bash tests/mutation_check.sh` with `CHROME_BIN` exported |
| A6 | No CDP lever leaks: the full e2e file is green, and green again on a second consecutive run | `node --test tests/e2e.test.js` twice |
| A7 | The seed and name inputs stay at >= 16px | `node --test tests/app.test.js` |
| A10 | The four S5 keyboard tests at `tests/e2e.test.js:3661-3682` are unchanged in behaviour | `node --test tests/e2e.test.js` |
| A11 | Exactly one keyboard stub exists in the repo | `grep -c 'defineProperty(vv, "height"' tests/e2e.test.js tests/helpers/cdp.js` |
| A8 | The comment above `kbOffset` and the matching line in `TODOS.md` no longer claim CI cannot verify the wiring | `grep -n "only part of this fix CI can verify" index.html TODOS.md` returns nothing |
| A9 | The doc says what actually happened this cycle | read the Cycle state section |

## Coverage diagram

```
CODE PATHS                                          USER FLOWS
[~] index.html applyKbOffset()                      [~] Seed entry with keyboard up
  |- vv null / sheetSurf null                         |- [GAP] [->E2E] open sheet, kb up, lift  -> T1 S1
  |   `- [**  TESTED] app.test.js DOM stub            |- [GAP] [->E2E] kb up BEFORE open        -> T4 S1
  |- scale term (NEW)                                 |- [GAP] [->E2E] close under kb, reopen   -> T3 S1
  |   `- [GAP] [->E2E] pinch, no lift    -> T2 S1     `- [GAP] [->E2E] pinch while lifted       -> T2 S6
  |- zoom AND keyboard together (NEW)                   [~] Pinch-zoom to read the page
  |   `- [ NOT COVERED ] no real keyboard in CI      |- [GAP] [->E2E] sheet must not move      -> T2 S1
  |- off > 0  -> transform write                      `- [ NOT COVERED ] zoom AND keyboard together
  |   `- [GAP] [->E2E] translateY(-444)  -> T1 S1         (physically unreachable in CI; see
  |- off == 0 -> transform ""                             "The premise this plan cannot close")
  |   `- [***TESTED] hideSheet reopen    -> T3 S1     [~] Error / boundary states
  |- cap > 0  -> maxHeight write                       |- [GAP] input font-size >= 16px          -> T2 S5
  |   `- [GAP] [->E2E] 392px             -> T1 S1      `- [**  TESTED] sheet with no vv at all
  `- cap == 0 -> maxHeight ""
      `- [GAP] [->E2E] scale-2 clears    -> T2 S1
[~] index.html hideSheet()
  |- transform reset   [*   TESTED] existing mutant survives -> T4 #4
  `- maxHeight reset   [GAP] reachability UNPROVEN            -> T3 S1
[+] tests/helpers/cdp.js
  |- fakeKeyboard / clearKeyboard / setPageScale  [GAP] -> T1
  `- teardown after an assertion failure          [GAP] -> A6 (second consecutive full run)

COVERAGE BEFORE: 3/16 paths (19%)   AFTER: 15/16 (94%), 1 physically unreachable
QUALITY: ***:1  **:2  *:1  |  GAPS CLOSED: 12 (all E2E except T2 S5)
```

Legend: `***` behavior + edge + error | `**` happy path | `*` smoke
`[->E2E]` = needs integration test

## Failure modes

> **SUPERSEDED - read for history only.** The first two of the five rows
> below analyze the `vv.height * vv.scale` arithmetic this plan originally
> prescribed. That arithmetic was reversed in `c7098df` (see the READ FIRST
> banner at the top of this document); the shipped code has no such term.
> Left as-is rather than rewritten so this table still records what was
> analyzed at the time.

| New codepath | Realistic production failure | Test? | Error handling? | Silent? |
|---|---|---|---|---|
| `vv.height * vv.scale` term | An input drops below 16px, iOS auto-zooms on focus, and the lift is computed against a geometry the owner never reported | YES (A7, after T2 S5) | n/a - arithmetic | **would be silent** - this is why A7 exists |
| `vv.height * vv.scale` term | `interactive-widget=resizes-content` is honoured, the layout viewport shrinks, `inner - vv.height` is 0, and the whole fix is inert | NO - not reproducible in CI | deliberate: no lift needed | silent, and CORRECT on such an engine |
| conditional style writes | A stale cached value diverges from the real style after an external write | YES (A6, second run) | n/a | no |
| `maxHeight` reset in `hideSheet` | Reset added to `hideSheet` but the sheet is also hidden by some other path that bypasses it | YES (T4 #6 mutant) | n/a | no |
| `fakeKeyboard` shadowing | A future test navigates after faking and asserts against an unshrunk page - passes for the wrong reason | partial: doc comment only | none | **yes** - accepted, cheap to hit, cheap to spot |

**Critical gaps (no test AND no error handling AND silent): 0.** The font-size
one would have been critical; A7 removes it.

## NOT in scope

- **A `vv.scale > 1` early return.** Considered and rejected in favour of the
  arithmetic in Task 2. It is strictly worse on device: it disables the fix
  whenever iOS auto-zoom raises the scale, which is the exact moment the
  keyboard opens.
- **Fixing queue rows 68 and 69** (the shared-CDP-session flake and the
  SIGKILL-orphaned Chrome). The outside voice argued these should come first
  because every e2e mutant this lane adds runs a full e2e file under a 180s cap
  on a harness known to cascade, so fixing 69 makes everything after it
  cheaper. That is a real sequencing argument and it is the owner's call, not
  this plan's. Recorded, not taken.
- **A CSS-variable or test-constant home for the 16px floor.** A7 asserts the
  value; centralising it is a refactor this lane does not need.
- **Row 68's flake.** Re-run-alone is the accepted treatment; a real fix is its
  own lane.
- **Row 78's `color:transparent`** - owner-deferred, unchanged.
- **The gstack 1.81.0.0 -> 1.87.4.0 upgrade** - explicitly deferred by the owner
  and not reopened here.

## What already exists

| Existing | Reused or rebuilt |
|---|---|
| `kbOffset` / `kbCap` as pure functions with unit tests in `tests/app.test.js` | **Reused unchanged.** Task 2 adds a guard in `applyKbOffset`, not in the pure functions, so those tests stay valid. |
| `tests/helpers/cdp.js` `setViewport()` (`Emulation.setDeviceMetricsOverride`) | **Reused.** Task 1 does NOT extend it - the spike proved the `viewport` clip does not touch `visualViewport`, so a fourth parameter there would be a trap. The three new helpers are separate. |
| `hideSheet()`'s existing transform reset and its comment | **Extended, not rebuilt** - Task 3 adds the sibling write and widens the comment. |
| `tests/mutation_check.sh` and the `mk()` patch-cutting flow | **Reused as-is**, including its `git checkout -- index.html` hazard, which Tasks 4 and 5 route around by committing first. |
| The e2e suite's single shared browser session | **Reused** - which is precisely why the teardown rule is a global constraint rather than a per-task note. |

## Parallelization

| Step | Modules touched | Depends on |
|---|---|---|
| T1 seam | `tests/helpers/` | - |
| T2 row 87 | `index.html`, `tests/`, `TODOS.md` | T1 |
| T3 rows 88/55 | `index.html`, `tests/` | T1 |
| T4 corpus | `tests/mutants/`, `tests/` | T2, T3 |
| T5 hygiene | `tests/mutants/` | T4 |
| T6 bookkeeping | `docs/plans/` | - |
| T7 deliver | all | T5, T6 |

`Lane A: T1 -> T2 -> T3 -> T4 -> T5` (sequential; T2 and T3 both edit
`index.html` and T4 cuts patches whose context windows cover both edits).
`Lane B: T6` (docs only, independent).
Execution: **Lane A and Lane B in parallel, then T7.** One conflict flag:
nothing else. This is effectively sequential implementation with one detachable
docs task - do not split T2 and T3 across worktrees, they touch adjacent lines
of the same function region.

## The premise this plan cannot close

Everything above tests that the app reacts correctly to a shrunken visual
viewport. That a real iOS 26.6 keyboard produces one is still asserted only by
the owner's photograph and rows 51/67. No task here changes that, and the PR
body must say so.

A second, narrower gap joins it after Task 2: **zoom and keyboard together.**
CDP can produce a real zoom and a faked shrink, but not a real keyboard, so the
combined state is unreachable in CI.

> **SUPERSEDED - read for history only.** The sentence below argued the
> arithmetic was correct by construction. That arithmetic was reversed in
> `c7098df` (see the READ FIRST banner at the top of this document) in favor
> of clearing both writes while `vv.scale > 1.01`; left as-is rather than
> rewritten so this records what was argued at the time.

The arithmetic handles it correctly by
construction - `vv.height * vv.scale` is the layout height in every state - but
"correct by construction" is not "verified", and it should be the first thing
checked if the owner reports the fix misbehaving after this lands.

A third: **`interactive-widget=resizes-content`** (`index.html:13`). On an
engine that honours it the layout viewport shrinks instead, `inner - vv.height`
is 0, and none of this code does anything. That is the correct outcome there,
but it means a green CI run says nothing about which path a given browser
takes.

## Implementation Tasks

Synthesized from this review's findings. Each derives from a specific finding
above.

- [ ] **T1 (P1, human: ~20min / CC: ~3min)** - plan - Reorder implementation
      before corpus-cutting
  - Surfaced by: Architecture - mutants cut against `applyKbOffset`/`hideSheet`
    go stale when Tasks 2/3 edit those functions
  - Files: this plan
  - Verify: task order reads T1 seam, T2 row 87, T3 rows 88/55, T4 corpus
- [ ] **T2 (P1, human: ~30min / CC: ~5min)** - tests/helpers - Mandate CDP lever
      teardown
  - Surfaced by: Architecture - `setPageScaleFactor` is global state on the one
    shared browser session `tests/e2e.test.js` uses for 4706 lines
  - Files: `tests/helpers/cdp.js`, `tests/e2e.test.js`
  - Verify: A6 - `node --test tests/e2e.test.js` green on two consecutive runs
- [ ] **T3 (P1, human: ~20min / CC: ~3min)** - index.html - Pin the 16px input
      font-size
  - Surfaced by: Test review - `index.html:460` and `:583` are `font-size:16px`
    and nothing holds them there; below 16px iOS auto-zoom changes the
    geometry the owner's report assumes
  - Files: `tests/app.test.js`
  - Verify: A7
- [ ] **T4 (P1, human: ~15min / CC: ~2min)** - index.html - Rewrite the comment
      claiming CI cannot verify the wiring
  - Surfaced by: Code quality - `index.html:4591` says the pure function is
    "the only part of this fix CI can verify"; Task 1 falsifies it
  - Files: `index.html`, `TODOS.md`
  - Verify: A8
- [ ] **T5 (P2, human: ~20min / CC: ~3min)** - docs - Correct
      `closeScaleSheet` -> `hideSheet` in queue rows 54 and 55
  - Surfaced by: Code quality - the transform reset is at `index.html:4745` in
    `hideSheet()`; a mutant cut against `closeScaleSheet` mutates nothing
  - Files: `docs/plans/2026-09-16-remaining-work-coordination.md`
  - Verify: `grep -n closeScaleSheet` on rows 54-55 returns nothing
- [ ] **T6 (P2, human: ~25min / CC: ~4min)** - tests - Document the
      `interactive-widget=resizes-content` opt-out
  - Surfaced by: outside voice #7 - on an engine honouring it the fix is inert
    by design and the faked-viewport tests assert an unreachable state
  - Files: `tests/e2e.test.js`
  - Verify: A3
- [ ] **T7 (P2, human: ~10min / CC: ~2min)** - plan - Replace
      `--test-name-pattern` acceptance commands with full-file runs
  - Surfaced by: Test review - isolated runs cannot see a leaked lever or row
    68's order-dependent flake
  - Files: this plan
  - Verify: acceptance table has no `--test-name-pattern`
- [ ] **T10 (P1, human: ~30min / CC: ~5min)** - tests - Promote the existing
      `raiseKeyboard` instead of adding a second stub
  - Surfaced by: outside voice #1 - `tests/e2e.test.js:3591` already has it
  - Files: `tests/helpers/cdp.js`, `tests/e2e.test.js`
  - Verify: A11
- [ ] **T11 (P1, human: ~40min / CC: ~6min)** - index.html - Use
      `vv.height * vv.scale` rather than a `vv.scale > 1` early return
  - Surfaced by: outside voice #5, which correctly identified that my stated
    reason for rejecting the arithmetic (a pure-function signature change) was
    false - it is a call-site change
  - Files: `index.html`
  - Verify: A3 + A10

  > **SUPERSEDED - not adopted.** This task's arithmetic was tried in
  > `a434058` and reversed in `c7098df` after the independent review FAILed
  > it (see the READ FIRST banner at the top of this document). The shipped
  > discriminator is `vv.scale > 1.01`, clearing both writes rather than
  > scaling them. Left as-is rather than rewritten so this records what T11
  > proposed at the time.
- [ ] **T12 (P1, human: ~45min / CC: ~8min)** - tests - Prove rows 55/88 are
      reachable before cutting a mutant for them
  - Surfaced by: outside voice #3/#4 - the resize listener is not gated on
    `sheetOpen`, so the prescribed TDD step passes on unfixed code, and an
    unkillable mutant blocks A5 at 100%
  - Files: `tests/e2e.test.js`
  - Verify: A4
- [ ] **T13 (P1, human: ~20min / CC: ~3min)** - tests - Make every oracle
      positive-then-negative
  - Surfaced by: outside voice #6 - assert-empty oracles are satisfied by the
    gutted-`applyKbOffset` mutant Task 4 exists to kill
  - Files: `tests/e2e.test.js`
  - Verify: A2
- [ ] **T14 (P2, human: ~15min / CC: ~2min)** - tests - Derive expected pixel
      values from inputs instead of hard-coding them
  - Surfaced by: outside voice #8 - `-444px`/`392px` in a shared, order-
    dependent session next to a test that tears down with `setViewport(900,900)`
  - Files: `tests/e2e.test.js`
  - Verify: A6
- [ ] **T8 (P3, human: ~15min / CC: ~2min)** - index.html - Make the two style
      writes conditional
  - Surfaced by: Performance - `applyKbOffset` is bound to `visualViewport`
    `scroll`, which fires at frame rate during a pinch-pan; two unconditional
    style writes per frame force a style recalc
  - Files: `index.html`
  - Verify: A1/A3 unchanged
- [ ] **T9 (P3, human: ~10min / CC: ~2min)** - tests/helpers - Document that
      `fakeKeyboard` shadowing does not survive `goto()`
  - Surfaced by: Code quality - a test that navigates after faking passes for
    the wrong reason
  - Files: `tests/helpers/cdp.js`
  - Verify: comment present in Task 1 Step 3

## OUTSIDE VOICE (Claude subagent)

`CODEX_MODE: model_unusable` - the configured Codex model is a dead pin in
`~/.codex/config.toml` (one-line fix: update the `model =` line). The outside
voice below is a Claude subagent with fresh context. **Same model family, not
a cross-model read** - discount it accordingly. Findings verbatim:

1. **Task 1 rebuilds a seam that already shipped.** `tests/e2e.test.js:3591-3597` already has `raiseKeyboard(vvHeight)` - the identical `defineProperty` + `dispatchEvent(new Event("resize"))` stub, landed by lane S5 in `d644491` (row 82). The plan never mentions it, so Task 1 as written lands a second, divergent keyboard stub in the same file. The only real work is *moving* the existing helper to `cdp.js` and adding `clearKeyboard`/`setPageScale`.
2. **Row 54's premise is stale and the plan takes it on trust.** Row 54 was written at `2ec374d`, before S5's honest test and `tests/mutants/e_kb_sheet_never_translates.patch`. That mutant already kills on the shipped suite, and the S5 oracle clips by `vv.offsetTop + vv.height` and by `.sheetbody`, so mutants 1 and 2 are very likely already dead. Task 2 must *start* by re-running the four mutations against today's suite.
3. **Task 4's TDD step cannot fail.** The resize listener (`index.html:4634-4636`) is not gated on `sheetOpen`, so `clearKeyboard()`'s dispatched `resize` runs `applyKbOffset()` while the sheet is hidden and writes `maxHeight = ""` before the reopen. The prescribed test passes on unfixed code.
4. **Worse, Task 4's mutant is probably unkillable, which blocks A5 at 100%.** Row 55 already states the asymmetry is unobservable on every reachable path. If no test can observe the missing reset, no test can kill "drops the new reset" - and the gate refuses a surviving patch. Same exposure in Task 5 Step 1 (`!editingId` guard on a button only rendered in edit mode).
5. **`vv.scale > 1` is the wrong discriminator, and a simpler fix exists.** Pinch-zoom and keyboard are simultaneous states on iOS; an early return abandons the user in exactly the configuration row 51 photographed. `vv.height * vv.scale` is the visible *layout* height, so `kbOffset(inner, vv.height*vv.scale, vv.offsetTop*vv.scale)` handles both with no branch - and it reproduces your own probe exactly: 422 x 2 = 844 = innerHeight -> offset 0. `kbCap` wants the same term.

   > **SUPERSEDED - kept verbatim for the record.** This finding's arithmetic
   > was tried and reversed in `c7098df`; `vv.offsetTop` turned out to already
   > be in layout px, so scaling it was a unit error the independent review
   > caught (see the READ FIRST banner at the top of this document). Not
   > rewritten so the outside voice's findings stay verbatim.
6. **Tasks 3 and 4's oracles are negative-only and are satisfied by the very mutants Task 2 exists to kill.** "assert `transform` and `maxHeight` are both `""`" passes under `applyKbOffset(){return;}`. Each needs a positive assertion in the same test.
7. **`interactive-widget=resizes-content` (index.html:13) is an unstated contradiction.** Where that hint is honoured, the browser shrinks the *layout* viewport on keyboard open, `innerHeight - vv.height` is 0, and the whole fix is inert.
8. **Strategic: this lane adds ~6 e2e tests plus ~6 e2e mutants to a 308-patch corpus while declaring rows 68 and 69 out of scope.** Hard-coding `translateY(-444px)`/`392px` in a shared, order-dependent session compounds it; derive the expectations from `kbOffset`/`kbCap` inputs instead. Fixing 69 first would make everything after it cheaper.

**Tension analysis.** Findings 1, 2, 3, 6 and 8 were verified directly against
the tree and folded in whole - 1 and 2 by reading `tests/e2e.test.js:3591` and
`tests/mutants/e_kb_sheet_never_translates.patch`, 3 by reading the ungated
listener at `index.html:4634-4636`. Finding 5 **reverses this review's own
conclusion**: my Section-1 finding A1 had rejected the arithmetic partly
because it "changes the signature of two pure functions row 54's mutants
target", and that is simply wrong - `kbOffset` and `kbCap` are untouched and
the change is at the call site. With the false cost removed, the arithmetic
dominates on every axis. Finding 4 is accepted as a RISK rather than a fact:
whether rows 55/88 are observable is now Task 3 Step 1's job to determine, and
the plan branches on the answer instead of assuming one. Finding 7 is folded in
as a documented constraint. Finding 8's sequencing argument (fix row 69 first)
is recorded under "NOT in scope" and left to the owner - it would re-scope the
lane, which is not a reviewer's call.

## GSTACK REVIEW REPORT

**Plan:** `docs/plans/2026-09-18-keyboard-wiring-coverage.md`
**Branch:** `scale-page/s6-kb-wiring`
**Date:** 2026-09-18

| Run | Status | Findings |
|---|---|---|
| Prior Learnings | done | 10 loaded (6 pitfalls, 1 pattern, 3 operationals); `handpan-card-keydown-swallows-child-link-activation` (9/10) noted, not applicable to this lane |
| 1. Architecture | done | 3 (A1 task sequencing, A2 shared-session CDP state, A3 zoom/keyboard discriminator) |
| 2. Code quality | done | 4 (stale comment, `closeScaleSheet` misnaming, TDD inversion, `goto()` and the stub) |
| 3. Tests | done | 4 (name-filtered acceptance, unpinned 16px, uncovered branch, unspecified app.test.js step) + coverage diagram + Test Plan Artifact |
| 4. Performance | done | 1 (unconditional style writes on a frame-rate `scroll` listener) |
| Outside voice | done, degraded | 8; `CODEX_MODE: model_unusable`, so same-family subagent rather than a cross-model read |

**Lake Score: 12/14** - twelve findings folded into the plan; two (the
arithmetic-vs-guard reversal and the rows-55/88 reachability question) changed
the plan's shape rather than adding to it.

**VERDICT: PASS WITH CHANGES.** The plan is executable as amended. Its original
form was not: it would have landed a duplicate keyboard stub, cut mutants
against functions it was about to edit, written a TDD step that cannot fail,
and shipped a guard that disables itself on the owner's device at the moment
the keyboard opens.

**Highest-risk item at execution time:** `setPageScale(2)` is global CDP state
on the one browser session all 4706 lines of `tests/e2e.test.js` share. Left
set, it reproduces the known false-kill signature (~24 unrelated tests failing
in 0.1ms). A6 exists to catch it and must not be skipped.

NO UNRESOLVED DECISIONS
