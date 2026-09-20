# Swipe Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the card's swipe handler real browser coverage by wiring up the
dead `swipe()` CDP helper, so the README's "touch navigation" claim becomes
true and can be restored.

**Architecture:** Three tests in `tests/e2e.test.js`'s existing navigation
group, driven through `b.swipe()`, plus two mutants that make them non-decorative.
No app code changes: the handler is correct, it was simply never exercised.

**Tech Stack:** `node --test` over the CDP helper in `tests/helpers/cdp.js`,
against a real headless Chrome. No new dependencies (there is no `package.json`).

**Spec:** the two queue rows left open by PR #88's round-2 review, recorded in
`docs/plans/2026-09-18-readme-refresh.md`, "PR #88 review round 2".

## Global Constraints

- Single-file app: no `<script src>` in `index.html`, no build step.
- Do not alter deck data or diagram geometry.
- Engine regions in `index.html` are GENERATED; this plan touches none of them.
- Every test group ships a mutant patch that must make it fail
  (`tests/CONTRACT.md`); the gate is all-or-nothing.
- Mutant headers: `# kills:` names the test, `# suite:` is the sole selection
  mechanism. For node, `--test-name-pattern ^<regex>$` with **dots for spaces**.
- `tests/suite_health.py` `FLOORS` rows are per-file minimums; raise only this
  lane's own row.
- Test at a 380px viewport.
- TDD: the failing test comes first, and is *seen* to fail.

---

## What is actually true today (verified, not assumed)

| Claim | Evidence |
|---|---|
| `swipe()` is dead code | `grep -rn 'swipe(' tests/` finds only its definition, `tests/helpers/cdp.js:234` |
| `swipe()` nonetheless WORKS | spike at `4c2d420`: `b.swipe("#card", -120)` moved the counter `1 / 19` → `2 / 19`; the `touchend` listener saw `changedTouches.length === 1` |
| the handler has ZERO coverage | no `touch` test in `tests/app.test.js`; no mutant matches `touchend\|touchstart\|changedTouches` |
| the handler is at `index.html:5084-5090` | `touchstart` stores `e.touches[0].clientX`; `touchend` computes `dx` from `e.changedTouches[0].clientX` and calls `step(dx < 0 ? 1 : -1)` only when `Math.abs(dx) > 55` |

The spike matters: the obvious reading of `swipe()` is that it is BROKEN, because
it ends with `touchEnd` carrying an empty `touchPoints` array while the handler
reads `e.changedTouches[0]`. Chrome populates `changedTouches` with the released
point anyway. Deleting the helper on that misreading would have thrown away a
working tool, which is why this plan spiked before choosing.

## The decision: use it, do not delete it

The round-2 reviewer offered both. Use wins because the alternative leaves
`index.html:5084-5090` as the only navigation path in the app with no test of any
kind, on the input method the app is primarily used with (a phone). Deleting the
helper would make that gap permanent and silent. Wiring it up costs three tests
and two mutants and closes the gap that forced "and touch" out of the README.

## Non-goals

- No change to `index.html`. The handler is correct; this is coverage, not a fix.
- No unit-level touch simulation in `tests/app.test.js`. Touch dispatch is exactly
  the kind of thing the e2e suite exists for (`tests/e2e.test.js:1-6`).
- No new swipe FEATURES: no vertical swipe, no velocity, no per-deck threshold.
- No change to the 55px threshold itself. It is owner-shipped behaviour; this
  plan pins it, it does not tune it.
- No `tests/helpers/cdp.js` change. The spike shows the helper needs none.

## File Structure

- `tests/e2e.test.js` — three tests appended to the section 4 navigation group
  (after the wrap test that ends near `:400`). MODIFY.
- `tests/mutants/e_swipe_direction_inverted.patch` — CREATE.
- `tests/mutants/e_swipe_deadzone_dropped.patch` — CREATE.
- `tests/suite_health.py:47` — `"tests/e2e.test.js": 68` → the count the run
  reports (expected `88`; the file already defines 85 tests). MODIFY.
- `README.md:95` — restore "and touch" to the e2e bullet. MODIFY.
- `docs/plans/2026-09-18-readme-refresh.md` — banner on the Step 1 sketch. MODIFY.

`tests/e2e.test.js` is a large file that is NOT split by this plan: it is one
harness with one browser lifecycle, and the repo's own comment at its head says
the scope is deliberately small. Splitting it is a separate decision.

---

### Task 1: Swipe navigation gets browser coverage

**Files:**
- Modify: `tests/e2e.test.js` (append to the section 4 group, after `:400`)
- Create: `tests/mutants/e_swipe_direction_inverted.patch`
- Create: `tests/mutants/e_swipe_deadzone_dropped.patch`
- Modify: `tests/suite_health.py:47`
- Modify: `README.md:95`

**Interfaces:**
- Consumes: `b.swipe(selector, dx)` (`tests/helpers/cdp.js:234`), and the group's
  existing `freshLoad()`, `decksMeta()`, `expectCount(text, label)` helpers
  (`tests/e2e.test.js:224`).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the three failing tests**

Append inside the section 4 navigation group in `tests/e2e.test.js`:

```js
  /* The swipe handler (index.html:5084-5090) is the primary way the app is
     navigated on a phone and had no test of any kind until this group. A unit
     test cannot reach it: it is real touch dispatch, not a click. */
  test("a swipe past the threshold steps the deck in the swiped direction", async () => {
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.swipe("#card", -120);
    await expectCount(`2 / ${n}`, "swiping left did not step forward");

    await b.swipe("#card", 120);
    await expectCount(`1 / ${n}`, "swiping right did not step back");

    // Just past the 55px threshold. Paired with the 50px drag in the next test
    // this brackets the constant to within 10px, so a mutant that moves it
    // anywhere inside (50, 60) still dies. 54/56 would be tighter and would
    // flake: CDP rounds a touch point off a fractional getBoundingClientRect
    // centre by up to a pixel.
    await b.swipe("#card", -60);
    await expectCount(`2 / ${n}`, "a 60px drag did not clear the 55px threshold");
  });

  test("a swipe shorter than the threshold does not navigate", async () => {
    // The card is BOTH the flip target and the swipe target, so the deadzone is
    // the whole of what keeps an ordinary tap - and the small drag a thumb makes
    // while tapping - from also throwing the card away to the next one.
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.swipe("#card", -50);
    await expectCount(`1 / ${n}`, "a 50px drag navigated; the deadzone shrank");

    await b.swipe("#card", 50);
    await expectCount(`1 / ${n}`, "a 50px drag back navigated; the deadzone shrank");
  });

  test("swipe wraps at both ends of the deck like the buttons do", async () => {
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.swipe("#card", 120);
    await expectCount(`${n} / ${n}`, "swiping back from the first card did not wrap to the last");

    await b.swipe("#card", -120);
    await expectCount(`1 / ${n}`, "swiping forward from the last card did not wrap to the first");
  });
```

- [ ] **Step 2: Run them and SEE them fail**

```bash
unset E2E_PORT
export CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
node --test --test-name-pattern 'swipe' tests/e2e.test.js
```

Expected at this point: **they PASS**, because the handler already works. That is
correct and is not a TDD violation — this task adds no behaviour, so there is
nothing to see go red. The red proof for coverage-only work is the MUTANT, not
the implementation, which is exactly why `tests/CONTRACT.md` requires one. Do not
fabricate a red by breaking `index.html`. Proceed to Step 3 and get the red there.

- [ ] **Step 3: Write the direction mutant**

`tests/mutants/e_swipe_direction_inverted.patch`. Cut it with `diff -u` against a
`sed`-edited copy, NOT `git diff` (which diffs against the index and will capture
unrelated working-tree changes), then rewrite the `---`/`+++` headers to
`a/index.html` / `b/index.html`.

```
# kills: a swipe past the threshold steps the deck in the swiped direction
# suite: node --test --test-name-pattern ^a.swipe.past.the.threshold.steps.the.deck.in.the.swiped.direction$ tests/e2e.test.js
# The swipe steps the wrong way: dragging the card left, which should pull the
# next card in, walks backwards instead. Both buttons and both arrow keys still
# work, so nothing outside the touch path notices.
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -5086,7 +5086,7 @@
 card.addEventListener("touchend", e => {
   if (tx === null) return;
   const dx = e.changedTouches[0].clientX - tx; tx = null;
-  if (Math.abs(dx) > 55) step(dx < 0 ? 1 : -1);
+  if (Math.abs(dx) > 55) step(dx < 0 ? -1 : 1);
 }, { passive: true });
```

- [ ] **Step 4: Write the deadzone mutant**

`tests/mutants/e_swipe_deadzone_dropped.patch`, same cutting method:

```
# kills: a swipe shorter than the threshold does not navigate
# suite: node --test --test-name-pattern ^a.swipe.shorter.than.the.threshold.does.not.navigate$ tests/e2e.test.js
# The 55px deadzone collapses to any movement at all. The card is both the flip
# target and the swipe target, so every tap whose thumb slides a pixel now flips
# AND navigates, and the card the reader meant to turn over is gone.
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -5086,7 +5086,7 @@
 card.addEventListener("touchend", e => {
   if (tx === null) return;
   const dx = e.changedTouches[0].clientX - tx; tx = null;
-  if (Math.abs(dx) > 55) step(dx < 0 ? 1 : -1);
+  if (Math.abs(dx) > 0) step(dx < 0 ? 1 : -1);
 }, { passive: true });
```

- [ ] **Step 5: Prove each mutant is killed, and reverts**

```bash
for m in e_swipe_direction_inverted e_swipe_deadzone_dropped; do
  git apply tests/mutants/$m.patch || { echo "APPLY FAILED: $m"; break; }
  node --test --test-name-pattern 'swipe' tests/e2e.test.js; echo "$m exit=$?  (want NON-zero)"
  git apply -R tests/mutants/$m.patch
done
git status --porcelain -- index.html   # must be EMPTY
```

Expected: a non-zero exit for each, and a clean `index.html` afterwards.

Note the wrap test ships no mutant of its own on purpose: wrapping is already
pinned by the existing button/arrow wrap test, and a wrap mutant would be killed
by that older test first. It is here because swipe reaches `step()` by a
different path, not as a new coverage claim.

- [ ] **Step 6: Raise this lane's floor**

`tests/suite_health.py:47`: raise the row to **the total the e2e run actually
reports at this lane's head commit**, not to `68 + 3`. The floor is 68 while the
file defines 85 tests (`grep -c '^  test(' tests/e2e.test.js`), so 71 would leave
14 tests of slack and the guard would not notice all three new tests being
deleted. Expected value **88**; take the number from the `tests/e2e.test.js: ran
N, ...` line of a `python3 tests/suite_health.py` run made NOW, before editing
the row, and use that N verbatim (Step 8 re-confirms it). Do not guess it - a floor above the real count reddens CI, and one
below it guards nothing.
No aggregate constant changes (they are minimums, `tests/suite_health.py:61-84`).

- [ ] **Step 7: Restore the README claim the coverage now earns**

`README.md:95`, back to what round-2 correctly removed:

```
- **Browser e2e** - real Chromium: deck switching, the 3D card flip, keyboard
  and touch navigation, reload persistence, clipping at a 380px viewport, and
```

Re-wrap the bullet to 78 columns. `tests/test_readme_currency.py` does not assert
this line (prose, an accepted non-goal), so the guard here is Step 5: the claim
is true exactly as long as the two mutants stay killed.

- [ ] **Step 8: Verify the whole lane locally, then let CI be the evidence**

```bash
unset E2E_PORT
export CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
python3 tests/suite_health.py            # want SUITE HEALTH OK
./tests/run.sh mutants 2>&1 | tail -3    # want 314/314 mutants killed, MUTATION GATE PASSED
```

A full-file `tests/e2e.test.js` run cascades into CDP timeouts on this machine
(the known rows 68/69 environmental flake) — the same tests pass in isolation and
in CI. **CI's run at the final pushed commit is the evidence**, not the local run.

- [ ] **Step 9: Commit**

```bash
git add tests/e2e.test.js tests/mutants/e_swipe_direction_inverted.patch \
        tests/mutants/e_swipe_deadzone_dropped.patch tests/suite_health.py README.md
git commit   # message: the swipe handler gets browser coverage; README claim restored
```

---

### Task 2: Unstale the readme-refresh plan's Step 1 sketch

**Files:**
- Modify: `docs/plans/2026-09-18-readme-refresh.md` (the Step 1 code block, ~`:98-155`)

**Interfaces:** none.

The sketch shows the PRE-review version of `tests/test_readme_currency.py`: bare
`open()`, no `[;.]` window split, no phantom-module check, a bare upper bound
instead of the band. A reader hitting the sketch before the findings sections
below it copies code that two review rounds already rejected.

Do NOT re-sync the sketch to the shipped file. That is what made it stale in the
first place, and it would go stale again on the next edit. Point at the file.

- [ ] **Step 1: Add a banner immediately above the Step 1 code block**

```markdown
> **SUPERSEDED — do not copy this sketch.** This is the pre-review draft. It was
> changed in review by findings 9 and 10 below and by round 1's N2/N3/N4/N6:
> the bare `open()` became a `with` block, the deck-name window gained a
> `re.split(r"[;.]", ...)` clause, the engine check gained a phantom-module
> direction, and the bare upper bound on the mutant count became a band. The
> shipped file is `tests/test_readme_currency.py`; read that, not this.
```

- [ ] **Step 2: Verify nothing else reads the sketch as current**

```bash
grep -rn "readme-refresh.md" --include=*.md --include=*.py --include=*.js . | grep -v docs/plans/2026-09-18-readme-refresh.md
```

Expected: only `tests/test_readme_currency.py`'s docstring pointer to the
"CONTRACT carve-out" section, which is a different section and still accurate.

- [ ] **Step 3: Commit**

```bash
git add docs/plans/2026-09-18-readme-refresh.md
git commit   # message: mark the readme-refresh Step 1 sketch superseded
```

---

## Delivery

One branch, `tests/swipe-coverage`, in a dedicated worktree; one PR carrying both
tasks. Merge gate: all 5 required checks SUCCESS at the final pushed SHA, plus an
independent reviewer at that verified SHA (fresh subagent, `/review`
read-and-report only, two-attempt cap).

## Failure modes this plan is braced against

- **Cutting a mutant with `git diff`.** It diffs against the index, so it
  captures the whole working tree. Steps 3 and 4 say `diff -u` against a `sed`ed
  copy for exactly this reason; it cost a cycle on PR #88.
- **A mutant that does not revert.** Step 5 asserts `git status --porcelain`
  is empty afterwards. A mutant left applied makes the next gate run refuse to
  start (`tests/mutation_check.sh:99-112`).
- **Reading Step 2's green as a TDD failure and breaking `index.html` to force a
  red.** Step 2 says so explicitly.
- **Treating the local e2e cascade as a regression.** Step 8 names it.
- **Line-number drift in the mutant hunks.** `index.html:5084-5090` is current at
  `4c2d420`; if Task 1 lands after anything else touches `index.html`, re-cut the
  hunks rather than hand-editing the `@@` lines.

## Self-review

- **Spec coverage:** queue row 1 (dead `swipe()`) → Task 1. Queue row 2 (stale
  sketch) → Task 2. Both covered.
- **Placeholder scan:** no TBDs; every step carries its actual code or command.
- **Type consistency:** the three test names in Step 1 match the `# kills:` and
  `--test-name-pattern` lines in Steps 3 and 4 character for character, with
  dots substituted for spaces. The wrap test is deliberately mutant-free and is
  named as such.

## Plan File Review Report

`/plan-eng-review`, 2026-09-18. Target: this file. Scope accepted as drafted
(6 files, 0 new classes/services - the complexity STOP did not fire).

| Section | Runs | Status | Findings |
|---|---|---|---|
| 0. Scope | 1 | PASS | Scope accepted. `/office-hours` offer skipped: coverage-only lane, no problem statement to develop. |
| 1. Architecture | 1 | PASS | No issues. Touches no engine region, no `DECKS` line, no deck data, no diagram geometry. |
| 2. Code quality | 1 | PASS WITH FIX | F1 applied. |
| 3. Tests | 1 | PASS WITH FIX | F2 applied; F3, F4 accepted as documented limits. |
| 4. Performance | 1 | PASS | Two extra Chrome boots in the mutation gate, against 83 existing `e_` mutants. Marginal. |

**F1 (HIGH, confidence 8/10) - plan Task 1 Step 1: the threshold was bracketed
only to the open band (30, 120).** `index.html:5088` is
`if (Math.abs(dx) > 55) step(dx < 0 ? 1 : -1);`, and the drafted tests probed
+/-30 and +/-120, so a mutant moving 55 anywhere inside (30, 120) survived both
while the plan's non-goals claimed the pair "pins" the threshold. FIXED: the
deadzone drags are now +/-50 and a +/-60 assertion was added to the direction
test, bracketing 55 to within 10px. +/-54 / +/-56 was rejected: CDP rounds a
touch point off a fractional `getBoundingClientRect()` centre by up to a pixel,
so an exact-boundary probe would flake.

**F2 (HIGH, confidence 9/10) - plan Step 6: the floor raise 68 -> 71 was
nearly vacuous.** `tests/suite_health.py:47` carries `"tests/e2e.test.js": 68`
while the file defines 85 tests (`grep -c '^  test(' tests/e2e.test.js`), so the
row already trails reality by 17 and 71 would still leave 14 tests of slack -
all three new tests could be deleted without the guard noticing. FIXED: Step 6
now sets the row to the total the run actually reports (expected 88), read from
a `suite_health.py` run rather than guessed, because a floor above the real
count reddens CI and one below it guards nothing.

**F3 (LOW, confidence 8/10) - accepted limit.** `touchstart`'s capture, the
`if (tx === null) return` guard and the `tx = null` reset (`index.html:5085-5087`)
stay uncovered. They are unreachable through `swipe()`, which always dispatches
`touchStart` first and reassigns `tx` on every one. A documented coverage limit,
not a fillable gap; no mutant is owed.

**F4 (LOW, confidence 7/10) - not a contract violation.** `tests/CONTRACT.md:76`
requires a killing mutant per test GROUP, not per test. Two mutants for three
tests satisfies it, and the wrap test's mutant-free status is justified in
Step 5's note (wrapping is already pinned by the button/arrow wrap test).

Coverage after this lane, swipe path:

```
  touchstart -> tx captured          [ uncovered - unreachable via swipe() ]
  touchend   -> dx computed
               |
               +-- |dx| >  55  -> step(+/-1)   [ covered: +/-60, +/-120 ]
               |                   direction   [ covered: e_swipe_direction_inverted ]
               |                   wrap        [ covered by test, mutant owed to buttons ]
               +-- |dx| <= 55  -> no navigate  [ covered: +/-50 ]
                                   threshold   [ covered: e_swipe_deadzone_dropped ]
```

Worktree parallelization: none. Task 1 and Task 2 touch disjoint files but ship
as one PR, so sequential implementation in one worktree.

VERDICT: APPROVED - execute as amended.

NO UNRESOLVED DECISIONS
