# Prompt: backlog triage + implementation review, as a /swarm plan

You are planning, not fixing. Repo: `/Users/ray/Projects/handpan-cards`, base
`origin/main` @ `e428946` (chord-progression mode shipped: #161 engine, #162
UI). Read `CLAUDE.md` first, then §1 (severity scale), §6 (merge gates) and the
non-goals N1-N10 of `docs/plans/2026-09-24-quality-eval.md`; they carry over
unchanged. Use `docs/plans/2026-09-27-followup-triage.md` as the structural and
voice template: it is the last triage of this kind and its verdict vocabulary
is the one to reuse.

Two questions, answered together because they compete for the same lanes:

1. **Refactor:** after ~160 PRs, what in the existing implementation is worth
   restructuring now, and what is fine as it is?
2. **Backlog:** which outstanding tasks are worth doing, and which should be
   closed?

## Context that changes the weighting (unchanged from 2026-09-27)

The app is **live but lightly used, and volume is not expected to grow**. There
is no server, no accounts, and no user data beyond one browser's localStorage.

- A defect a real musician can hit in normal use matters at any volume.
- Risks that only matter at scale or under an adversary get LOW weight.
- Test-quality items earn a FIX only if they close a path by which a
  user-visible or wrong-artifact regression could ship with CI green. A test
  that is merely imprecise, with no named regression it would miss, is DROP.
- **Maintenance cost is real and is now the dominant cost.** The owner
  maintains every test, mutant and comment. Prefer fewer, sharper changes.
  "Nothing here is worth doing" is an acceptable answer for any group, and
  **closing rows is a first-class outcome**: a DROP clears a row for good.

## Part A - implementation review (what to refactor)

Measure before judging. Sizes at `e428946`, to re-verify:

- `index.html` 8299 lines.
- Tests: `tests/e2e.test.js` 7616, `tests/app.test.js` 4773.
- Mutants: 441 patches in `tests/mutants/`.
- Engine: 8+ modules in `src/engine/`.

Review these candidate pain points. Each is a hypothesis to confirm or reject
with evidence (`file:line`, counts, a timing, a CI log), not a conclusion:

1. **The app JS in `index.html`.** Look for these, and cite line ranges:
   - duplicated render paths;
   - state spread across module-level `let`s (`mode`, `seq`, `order`, `idx`,
     `flipped`, `shuffled`, `refusal`, `layoutOrder`...);
   - handlers that mutate state before a guard;
   - comments that cite raw line numbers or dead code (for example
     `void noPrints`).

   Decide whether any seam is worth extracting into `src/engine/`, which is
   tested, inlined and synced. Keep the single-file, no-build hard
   constraint. An extraction is only worth it if it removes a class of bug
   the queues keep reopening (the scale-sheet `refusal` rows 114-116, 122,
   135-136 are the obvious candidate).
2. **CSS layering after the full-screen menu (#162).** Count the overrides the
   desktop sidebar now needs to undo the mobile base rule. Also count the
   `max-height:520px` blocks, and check whether `CHROME_BUDGET` /
   `LANDSCAPE_BUDGET` still match the layout.
3. **Test-suite shape.**
   - e2e: count the tests in `tests/e2e.test.js` and time the file in CI. The
     full file is known to starve the browser locally (queue row 119), and
     row 68 is a flake.
   - Duplicate coverage between `app.test.js` (sandbox) and e2e.
   - The `tests/helpers/sandbox.js` element-id list, which every lane has to
     edit.
   - FLOORS slack: row 144 recorded 112 against 158.
4. **The mutant corpus.** The costs to measure:
   - line-anchored patches go stale on unrelated edits (rows 19 and 24, and
     the memory notes on `h_*` and `# suite:` word-splitting);
   - 12 unanchored patterns (row 139);
   - 65 prose `# kills:` (row 153);
   - mutation-gate wall time: about 10 minutes per PR.

   Decide whether the corpus should shrink, for example by retiring
   equivalent or duplicate patches (row 5). Also decide whether some patch
   class could be anchored on a stable marker instead of line context.
   **No new harness.** A refactor of `tests/mutation_check.sh` is in scope
   only if it cuts recurring stale-patch work, and it must say which `h_*`
   mutants patch the script.
5. **The coordination docs themselves.** Four plan docs still carry `| OPEN |`
   rows, over 150 of them in total. Recommend an archive or consolidation, so
   the next session reads one short backlog and not four ledgers.

For each candidate: verdict REFACTOR (in this workstream), DEFER (name the
trigger), or LEAVE (one line on why the current shape is acceptable). A
REFACTOR must name the recurring cost it removes, with evidence that the cost
recurred (at least two past PRs or queue rows). "It is big" is not evidence.
Every REFACTOR must be behaviour-preserving and provably so. Say how:
- the byte-identical DOM fixture (`tests/fixtures/seq_ui_base_e728912.json`
  is the pattern);
- the render-agreement suite;
- an unchanged test list.

## Part B - outstanding tasks (what is worth doing)

Sources. Verify each item against `e428946` before judging it, and mark it
STALE if it no longer holds:

1. **Open queue rows**, by number (`grep -n '| OPEN |'`). Do not re-list them
   in prose.
   - `docs/plans/2026-09-16-remaining-work-coordination.md`: rows 2-157.
   - `docs/plans/2026-09-24-one-pdf-path-coordination.md`.
   - `docs/plans/2026-09-28-android-bg-and-menu.md`: Q3-Q26.
   - `docs/plans/scale-engine-coordination.md`: rows 82-83.

   Group related rows. For example:
   - the scale-sheet refusal/arming rows: 86, 91, 114-117, 122, 135, 136;
   - the suite_health process-hygiene rows: 69, 98, 107-110, 124-130;
   - the iOS print rows: 147-151;
   - the menu focus rows: Q9, Q21, Q22.

   Judge each group, not each row, unless the rows in a group diverge.
2. **PR #162 reviewer nits (2026-09-29):**
   - the X glyph's `::after` rotation is unasserted;
   - `.seq` staying on `#count` after leaving S is unasserted;
   - `README.md:127` says 440 mutants against 441 on disk.
3. **Unplanned owner requests:**
   - **card swipe animation.** The prompt is
     `docs/prompts/2026-09-29-card-swipe-animation.md`; no plan exists yet.
     Decide whether it is next and whether it should be sequenced before or
     after any refactor that touches the same swipe, flip or render code.
     Do not plan it here; name the dependency.
4. **Owner-approved roadmap** (`CLAUDE.md`):
   - spaced repetition (SM-2);
   - practice stats;
   - PWA;
   - audio arpeggio.

   Do not plan these either. Say which refactor, if any, each one needs
   first, and which it would be cheaper to do before or after. The
   chord-progression plan (§ "roadmap relation") already names what S mode
   must not preclude.
5. **Owner-device checks** (row 12, rows 23/34, row 133, Q3, the iOS print rows).
   These are `covered_by: neither`. Collect them into ONE owner checklist,
   rather than leaving them spread across the queues.

Method, for each item or group:
- verify it;
- assign severity S1-S4 and cost C1-C3;
- give a verdict: FIX, DEFER (name the trigger), DROP (one line on why),
  STALE, or OWNER (a question with a recommended default).
- A FIX must name the concrete regression or user-visible failure it
  prevents. No named failure, no FIX.

## Budget

Evaluation is read-only. You may run single tests
(`node --test --test-name-pattern=...`, `python3 -m unittest <one test>`) and
single e2e tests with
`CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
You may also apply one mutant at a time to check a claim, reverting with
`git apply -R`. You may read CI timings with `gh run view`. Never run the full
`tests/mutation_check.sh` or the full `tests/e2e.test.js` locally (N9). Never
edit a tracked file except the plan you write. For every lane, list the
mutants whose target code it will move or delete. Find them with `grep -l` on
the removed lines, not from hunk headers. Say for each one: context refresh,
re-target, or retire.

## Output

Write `docs/plans/2026-09-29-backlog-and-refactor.md`, shaped for `/swarm` and
TDD-first, in the voice and structure of
`docs/plans/2026-09-27-followup-triage.md`:

1. **Header:** goal (one testable sentence), date, base SHA, shape, and related
   docs.
2. **§1 Goal and non-goals.**
   - Carry N1-N10.
   - Add: no new features; no roadmap items; no swipe animation; no
     deck-data or geometry change.
   - No refactor that is not behaviour-preserving.
3. **§2 Findings.**
   - Part A: a table `| # | Candidate | Evidence | Recurring cost | Verdict |
     Proof of no behaviour change |`.
   - Part B: a triage table `| # | Item/group | Verified at | Sev | Cost |
     Verdict | Why / failure prevented |`, sorted FIX first, then OWNER,
     DEFER, DROP, STALE.
   - The single owner-device checklist.
4. **§3 Lanes**, for REFACTOR and FIX rows only, split by file ownership:
   `| Lane | Owns | Never touches | Rows | Acceptance | Verify |`.
   - Two lanes that touch `index.html` either own disjoint line regions or
     are serialised. Say which, and why.
   - Refactor lanes go first when a FIX lane edits the same region, so fixes
     land on the new shape rather than being rebased onto it.
   - Every lane lists its failing tests first (name and assertion). For a
     pure refactor, the "failing test" is the behaviour-lock it adds before
     moving code.
   - Name the mutant prefix and the FLOORS rows per lane.
   - Prefer the fewest lanes; one lane is fine.
5. **§4 Order and dependencies.** Include where the swipe animation and each
   roadmap item slot in afterwards.
6. **§5 Merge gates:** deltas from quality-eval §6 only.
7. **§6 Owner decisions**, with recommended defaults. At least:
   - the refactor scope;
   - the queue-doc consolidation;
   - the mutant-corpus policy;
   - what comes next among swipe animation and the roadmap.
8. **§7 Queue disposition:** every open row number mapped to FIX lane, DEFER,
   DROP, STALE or OWNER. This makes the old ledgers closable.
9. **A closing line with counts:** REFACTOR / LEAVE and FIX / OWNER / DEFER /
   DROP / STALE.

Do not commit. Then run `/plan-eng-review` on the plan.

Return:
- the plan path;
- the verdict counts;
- every item where verification contradicted a queue row's claim;
- the top three owner decisions.
