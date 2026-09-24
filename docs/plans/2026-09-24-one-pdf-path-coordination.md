# One PDF path coordination

Execution record for `docs/plans/2026-09-24-one-pdf-path.md` (as amended by its
section 9 review). The plan is the task list; this doc is the bus. **If it isn't
in the doc, it did not happen.**

## Goal (read this first, every session, every cycle)

Every deck in the app - built-in and generated - produces its print PDF through
one code path, with one set of controls, one delivery behaviour, and one
remembered paper size.

**NON-goals** (adjacent work a blocked lane drifts into - do not):

- Retiring `tools/hifi.py`. Owner decision D-0(a) keeps it.
- The D2 browser-print cutover. `openPrintSheet` (`index.html:6119` at bootstrap base 1185886; `:6204` on main after W3) and
  `PRINT_LAYOUTS` stay in place, unreferenced.
- Changing chord data, voicings, ranking, card copy, or the print layout.
- Adopting generated geometry (it shrinks Pygmy's diagram 15.7%).
- The iOS `Unknown.pdf` filename - queue row 316, WONTFIX.
- Fixing the engine's degree derivation for Pygmy `Fm9`.

## Hard rules

1. Only the integrator (main agent) merges, deploys, or touches shared infra.
   Lanes NEVER deploy and never merge.
2. **The main agent is the sole writer of this doc.** Lanes return structured
   reports and never edit it. Never renumber the queue.
3. **Every PR passes `/review` by a non-author reviewer subagent before merge,
   and the verdict is recorded in the Review log.**
4. File ownership per the Ownership table. Crossing a boundary is a queue row
   asking the owner, never a direct edit.
5. Delivery is PR-based, CI green at a verified head SHA, in the lane's own
   worktree and branch namespace.
6. A lane's local test run is a **smoke test**. CI's run at the lane's final
   pushed commit is the evidence. Push before you return.
7. **ERROR PROTOCOL:** on any error or blocker - re-read the Goal, make the
   smallest adjustment to your approach that still serves it, record the blocker
   in your return report, and keep working whatever is unblocked. The goal never
   changes without the operator.

A discovery that invalidates part of a briefing is not a blocker, it is a
finding: record it and do the still-valid remainder.

## Ownership

| Lane | Branch | Worktree | Owns | Never touches |
|---|---|---|---|---|
| W0 oracle | `claude/w0-pdf-build-oracle` | `/private/tmp/claude-501/wt-w0` | `tests/test_pdf_build.py` | everything else |
| W1a overlay | `claude/w1a-print-overlay` | `/private/tmp/claude-501/wt-w1a` | `data/decks.json` (new `print` key), `tools/decks.py`, CLAUDE.md repo-layout paragraph, the regenerated `const DECKS` line via `tools/sync_decks.py` | `index.html` by hand, `src/engine/`, `tests/`, `tools/validate.py` |
| W1b print tests | `claude/w1b-print-pins` | `/private/tmp/claude-501/wt-w1b` | `tests/test_print.py`, `tests/mutants/w1b_*.patch` (new) | `tools/`, `data/`, `index.html` |
| W2 emitter | `claude/w2-pdfdeck-builtin` | `/private/tmp/claude-501/wt-w2` | `src/engine/pdfdeck.js`, `tools/pdf_build.js`, `tests/pdf_builtin.test.js` (new), `tests/test_pdf_parity.py`, the `engine:pdfdeck` region of `index.html` via `tools/inline_engine.py` | app JS/markup/CSS in `index.html`, `tools/decks.py`, `tools/hifi.py` |
| W3 UX | `claude/w3-one-print-ux` | `/private/tmp/claude-501/wt-w3` | app JS, markup and CSS in `index.html` (OUTSIDE every engine region), `tests/e2e.test.js`, `tests/app.test.js`, `tests/mutants/p_paper_picker_forgets_its_state.patch`, `d_esc_attr_leaves_quote`, `p_print_cta_drops_the_platform` | `src/engine/`, `tools/`, `data/`, any engine region |
| W3d docs | `claude/w3d-docs` | `/private/tmp/claude-501/wt-w3d` | `README.md`, `docs/plans/scale-engine-coordination.md`, the memory file `print-button-opens-existing-pdf.md` | code, tests |

W2 and W3 both write `index.html` and must not overlap: W2 only regenerates an
engine region via `tools/inline_engine.py`; W3 only edits outside every region;
W3 starts after W2 merges.

## Sequencing

A chain, not a fan. Concurrency never exceeds 2.

- **Wave 1: W0 alone.** The only lane whose dependencies are already on main.
  Every later lane's acceptance depends on the committed-bytes oracle not
  passing vacuously.
- **Wave 2: W1a || W1b.** Both gated on W0 merging. They share no file.
- **Wave 3: W2.** Gated on W1a merging (needs the `print` key in
  `data/decks.json`).
- **Wave 4: W3 || W3d.** Both gated on W2 merging.

**Merge gate, every lane, no exceptions** (plan section 5): (1) all five CI
checks - data integrity, js suites, mutation gate, python suites, suite health -
green at a head SHA verified equal to the branch tip via
`gh pr view <n> --json state,headRefOid`; and (2) an independent reviewer
subagent returning PASS or PASS_WITH_NITS at that same SHA. A FAIL is never
merge-able. PASS_WITH_NITS merges and the nits become queue rows.

**Cap: two attempts per lane**, one counter covering every retry path (review
FAILs, CI failures, `pr_url` verification failures, rebase re-reviews, null
returns). On exhaustion, escalate - do not loop.

## Operator gates and auto-decisions

AFK mode is ARMED, so merge authorization is standing for ordinary code merges
under the two gates above. Still gated, always: deploys, migrations,
force-pushing main or any shared branch, anything destructive or irreversible.

| # | Decision | Taken | Rationale |
|---|---|---|---|
| AD-1 | Standing merge authorization treated as granted at bootstrap | yes | Global CLAUDE.md AFK grant covers `gh pr merge <n> --merge` once CI is green at a verified head SHA and a fresh reviewer returns PASS/PASS_WITH_NITS. |
| AD-2 | This doc lives on `claude/one-pdf-path-coordination`, not main | yes | Swarm's own advice: Cycle-state commits on main would advance main after every transition. A branch that never merges mid-cycle costs nothing and keeps lanes from looking stale. Merged by PR at cycle close. |
| AD-3 | Plan PR #128 is merged under the same two gates as a lane | yes | It is an ordinary docs PR; the reviewer and CI gates still apply. |
| AD-4 | Merge order in wave 2 is W1a before W1b | yes | W1b's two mutants must patch the literals in `tools/decks.py` at base; W1a deletes those lines. Merging W1b first would leave W1a's CI red on stale mutants it does not own. After W1a merges, W1b is re-briefed to rebase and re-target its mutants at `data/decks.json`, then re-reviewed. |
| AD-5 | W1b's review is held until its post-W1a re-target, not run now | yes | Reviewing 1a73f65 now and again after the re-target spends two reviewers and one of W1b's two attempts on a rebase re-review. One review of the final head costs one. W1b's lane context stays live for the re-brief. |
| AD-6 | W2 may edit `tests/suite_health.py` to add one FLOORS row for its new suite | yes | The suite-health gate fails any new test file with no floor row, so the row is a mandated consequence of W2's owned `tests/pdf_builtin.test.js` (same class as row 10). Floor set to the collected count, not 0. The README suite-count bump in PR 132 is the same class. |
| AD-7 | W3 may raise the e2e/app FLOORS rows in `tests/suite_health.py`; the memory file `print-button-opens-existing-pdf.md` is updated by the integrator, not W3d | yes | Plan §8 names the floor raise as a W3 obligation, so it is a mandated consequence (as AD-6). The memory file lives under ~/.claude, outside any worktree, so no lane PR can carry it; and it only becomes false once W3 merges. |
| AD-8 | W3d's review and merge are held until W3 merges; then W3d rebases onto post-W3 main and re-derives its 5 `index.html:N` citations | yes | PR 133's README prose describes W3's end state, which would be false on main if W3d merged first, and its rows cite index.html:2183-2187, :2760, :5982, :6198, :6268 measured at 866bb4e - W3 edits index.html, so those move. One review of the final head costs one reviewer; reviewing now and again after the rebase costs two and an attempt. Same reasoning as AD-5. |

## Projected cost

6 lanes -> ~12 subagent runs, ~6 CI runs, +1 reviewer and +1 CI run per bounce.
The mutation gate alone is ~11 min per run, so budget ~90 min of CI wall-clock
before bounces. Concurrency never exceeds 2, well under the default cap of 4.

## Briefings (source text for spawn prompts - each must be self-contained)

### W0 - make the committed-bytes oracle real

Why it serves the goal: every later lane's acceptance leans on
`test_committed_pdfs_match_a_fresh_build`. Today it compares a fresh build
against the working tree, which a rebuild silently satisfies - a green that
could not have gone red.

NEXT: plan section 4, "W0 - make the committed-bytes oracle real", verbatim.

### W1a - the print overlay becomes data

Why: under D-0(a) the browser needs the print overlay, and the only channel into
the browser is `data/decks.json` -> `const DECKS`.

NEXT: plan section 4, "W1a - the print overlay becomes data", as amended by
review A1 (no new file; a per-deck `print` key; no new sync step and no new
validate check).

### W1b - pin what must not move

Why: Q1/Q2/Q4 values that a later "just use the solver" refactor would move.

NEXT: plan section 4, "W1b - pin what must not move", as amended by review A2
(assertions read the constructed deck objects, never the module source) and C3
(ship two `w1b_*.patch` mutants).

### W2 - the emitter can build a built-in deck

Why: `fromBuiltin` is the single runtime path the whole plan converges on.

NEXT: plan section 4, "W2 - the emitter can build a built-in deck", plus
`docs/plans/2026-09-22-seed-pdf-one-source.md` B0-B5 as the authoritative task
list, as amended by review C1 (parameterization coverage floor).

### W3 - one UX

Why: the only lane the owner sees.

NEXT: plan section 4, "W3 - one UX", as amended by review C2 (run the three
named patches through `tests/mutation_check.sh`, `--check` is only a pre-flight)
and D1 (disable both buttons for the duration of the build).

### W3d - docs and queue

Why: the repo's own prose is the last place the old two-path story survives.

NEXT: plan section 4, "W3d - docs and queue".

## Status

| Lane | Current branch | State | Last verdict | Last update (UTC) |
|---|---|---|---|---|
| plan #128 | merged | MERGED 0d727f5 | PASS_WITH_NITS | 2026-09-24 |
| W0 | merged | MERGED 2865044 | PASS_WITH_NITS | 2026-09-24 |
| W1a | merged | MERGED 4d9d372 | PASS_WITH_NITS | 2026-09-24 |
| W1b | merged | MERGED 7d1edb9 | PASS_WITH_NITS | 2026-09-24 |
| W2 | merged | MERGED 866bb4e | PASS_WITH_NITS | 2026-09-24 |
| W3 | merged | MERGED f78ed0b | PASS_WITH_NITS | 2026-09-24 |
| W3d | merged | MERGED 560bf9a | PASS_WITH_NITS (attempt 2) | 2026-09-24 |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| 130 | W1a | PASS_WITH_NITS | 3 nits: (1) `print.blank_cards` is nested but app/pdfcards read top-level `blank_cards`, and index.html ~5994 / tests/app.test.js:3397 comments say decks.json carries no such key; (2) `_overlay_from_print` shallow-copies, so `legend_lines` aliases `_CANONICAL`; (3) 12 `tests/mutants/` files touched outside the row - judged a necessary consequence (regen reproduces b_* byte for byte; c_deck_data_drift keeps intent and is killed). All literals re-derived byte for byte; 5/5 reviewer mutants killed. | Merged 4d9d372; nits filed as rows 8-10; nit 1 briefed into W2 and carried to W3. |
| 131 | W1b | PASS_WITH_NITS | 5 nits (rows 11-15). Reviewer re-derived every pin, confirmed each mutant is killed by its own `# suite:` header, and ran 10 hand mutations across all decks/field classes, each caught. CI run 35969288841 success at 47e99e9. | Merged 7d1edb9; nits filed as rows 11-15; nit 5 carried to W2 review and W3 parity. |
| 132 | W2 | PASS_WITH_NITS | 5 nits (rows 16-20). Parity re-derived: 3 built-ins x full/shop, glyph counts equal per case; `--builtin` exits in <0.1s with no stdin; R from print.R (solver-R mutant killed on 3 decks). Hand mutants 3/5 killed; the 2 survivors are nits 16-17. Attempt 1 was a CI bounce (no suite_health floor row). | Merged 866bb4e; nits filed as rows 16-20. |
| 134 | W3 | FAIL | 2 majors, both reproduced in real Chrome over CDP: (1) the review-D1 double-tap guard re-enables in the same task, so two queued taps on Pygmy's FULL DECK PDF ran 2 builds; (2) the card keydown guard `closest("a, button")` misses the paper `<select>`, which is now on built-ins, so Space/Enter on it flips the Hijaz card. 3 nits: stale print-CTA and e2e comments; no test for the window.open success path (mutant survived); no test for the printPaper boot type guard (mutant survived). Six collateral mutant repairs were judged justified and not weakened. Hand mutants: 7/10 killed. | Bounced to the authoring lane with the majors and nits (attempt 1 of 2); a fresh reviewer re-reviews. |
| 134 | W3 | PASS_WITH_NITS (fresh reviewer, at 70ea8ad) | Both majors re-verified with real CDP mouse and touch events: two taps together, 50 ms apart and with a 300 ms slowed build all build once; Enter/Space on the paper select no longer flip any built-in card, while on #card they still do; every focusable element inside #card enumerated (no anchors), so dropping `a` from the guard is safe. New tests red at ec39760, green at 70ea8ad. CI run 36036245284 all 5 green, 385/385 mutants killed. Hand mutants 4/5 killed; the survivor (boot guard without typeof) is row 25. Nits -> rows 23-26. | MERGED f78ed0b. AD-7 memory update done by the integrator. |
| 135 | coord (integrator) | FAIL (at de1a631) | Major F1: the Cycle state 'Merged this batch' listed PR head SHAs c37a7f9/db59b2c/6d530ab as the merges of PRs 128-130 (real merge commits 0d727f5/2865044/4d9d372); a resumer reverting PR 130 by that SHA would revert only its last commit. Nits: Status 'Current branch' named deleted branches; row 26 cited :6227 (comment at :6229); non-goal cited :6119 without its base. All other SHAs, runs, queue numbering and citations verified. | Integrator fixed all four (it authored the doc); a fresh reviewer re-reviews. Stray local branch review-w0-129 (merged, in main) deleted. |
| 133 | W3d | PASS_WITH_NITS (fresh reviewer, at 8f63ce6) | F1 and N1-N7 all fixed; 24 citations and counts re-derived, all match; code identical to f78ed0b; CI run 36041426757 green at the reviewed SHA. 3 nits -> queue rows 27-29. | Merged as 560bf9a. |
| 133 | W3d | FAIL (at a4640eb) | Blocker F1: README.md:72-73 says the PDF is built by the same scale-engine code (HPE.pdfdeck) that drives the flip cards; false - pdfdeck is called only by downloadDeckPDF, the flip cards are drawn by pan(), the PDF by HPE.pdfcards, and README.md:110-111 itself says the renderers are independent. Failure scenario: a contributor changes pan() label sizes expecting the PDF to follow. Nits N1-N7: row 334 should be resolved (memory already superseded), status casing, row 344 names the wrong doc, row 352 VARIANTS wording, 'this worktree' in the intro, row 342 blank_cards deck, README:38-39 omits fromBuiltin. All 30+ citations re-derived correct; CI green; ownership clean. | Bounced to the authoring lane (attempt 1 of 2); a fresh reviewer re-reviews. |
| 129 | W0 | PASS_WITH_NITS | 1 major + 5 nits. Major F1: the oracle is half-HEAD - reference from `git show HEAD:`, build side still worktree-sourced. Plus no mutant guards the new path (F2), and a pre-existing text-only-comparison overclaim (F6). | Merged; all filed as queue rows 4-7. Ownership respected, no out-of-scope files, CI success at the reviewed SHA. |
| 128 | plan doc | PASS_WITH_NITS | 2 nits: (1) §9.5 D1's quoted "Pygmy-shaped seed" omits the `/` inner separator, so it solves 11 rim / 0 inner (ext 1.4767, R 50.1, -16.5%) not Pygmy's 9 rim / 2 inner (-15.7%); the -15.7% used elsewhere is correct. (2) the §3 lane table's W3 Owns cell omits `tests/mutants/`, which W3 step 6 requires it to edit - C3 reached the W1b row only. | Merged; both filed as queue rows 2 and 3. Ownership respected, CI success at the reviewed SHA, no out-of-scope files. |

## Cycle state

Cycle: 1   Wave: 4 complete; all lanes merged - cycle close pending (coord PR, AD-2)   Merged this batch (merge commits): 0d727f5 (PR 128), 2865044 (PR 129), 4d9d372 (PR 130), 7d1edb9 (PR 131), 866bb4e (PR 132), f78ed0b (PR 134), 560bf9a (PR 133)

| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| plan | - | removed | deleted | 128 | c37a7f9 | all 5 green at c37a7f9 | PASS_WITH_NITS | 0 | 0d727f5 | - | no |
| W0 | - | removed | deleted | 129 | db59b2c | all 5 green at db59b2c | PASS_WITH_NITS | 0 | 2865044 | - | no |
| W1a | - | removed | deleted | 130 | 6d530ab | all 5 green at 6d530ab | PASS_WITH_NITS | 0 | 4d9d372 | - | no |
| W1b | - | removed | deleted | 131 | 47e99e9 | all 5 green | PASS_WITH_NITS | 0 | 7d1edb9 | - | no |
| W2 | - | removed | deleted | 132 | 44cdf07 | all 5 green | PASS_WITH_NITS | 1 | 866bb4e | - | no |
| W3 | - | removed | deleted | 134 | 70ea8ad | all 5 green at 70ea8ad (run 36036245284) | PASS_WITH_NITS (fresh reviewer, attempt 2) | 1 | f78ed0b | - | no |
| W3d | - | removed | deleted | 133 | 8f63ce6 | all 5 green at 8f63ce6 (run 36041426757) | PASS_WITH_NITS (fresh reviewer, attempt 2) | 1 | 560bf9a | - | no |

## Resume here (written for a fresh session)

State as of 2026-09-24: every lane merged - W0, W1a, W1b, W2, W3 (f78ed0b, PR 134),
W3d (560bf9a, PR 133). All lane worktrees and branches released. The plan's goal is
met on main. Remaining: cycle close - this coord branch merges via its own PR (AD-2)
behind CI and a fresh reviewer. Queue rows 1-29 stay OPEN for follow-up work; row 24
needs an owner call. Device-only checks (plan section 6: iOS window.open/blob delivery)
cannot run in CI and are the owner's.

## Handoff queue (append-only)

| # | From | Ask | Status |
|---|---|---|---|
| 1 | bootstrap | Owner device pass, plan section 6 - CI cannot check D-2's iOS branch | OPEN |
| 2 | PR 128 review | Plan §9.5 D1 quotes a seed missing its `/` inner separator and calls it "the Pygmy-shaped seed". Restate it with the separator, or say plainly it is a 52-chord Pygmy-SIZED seed and not Pygmy's geometry. Nothing D1 concludes changes. | OPEN |
| 4 | PR 129 review | **F1 (major, non-blocking).** The oracle is half-HEAD: the reference PDFs come from `git show HEAD:<pdf>` but the BUILD side still reads `data/decks.json` off the working tree, so the test answers "do HEAD's PDFs match a build of the WORKTREE's data", not "is HEAD self-consistent". Reproduced: commit stale data, then an uncommitted `git checkout HEAD~1 -- data/decks.json index.html` makes a genuinely inconsistent HEAD go green. Also a deterministic FALSE RED in the correct pre-commit state (edit, sync, rebuild, nothing committed -> red), so the local loop is now edit -> rebuild -> red -> commit -> green. Fails safe in CI, whose tree is always clean. Fix direction: source BOTH sides from the same revision, e.g. `git show HEAD:data/decks.json` into the tmpdir and build against that. Needs its own lane. | OPEN |
| 5 | PR 129 review | **F2.** No mutant distinguishes the old implementation from the new one, so this change ships unproven by the repo's own red-proof gate: `c_deck_data_drift.patch` mutates the WORKING TREE and is killed under both. A future revert to `os.path.join(paths.ROOT, rel)` would go green on all five CI jobs - verified. `tests/mutants/` is outside W0's ownership row, so this is the integrator's row, not a lane defect. | OPEN |
| 6 | PR 129 review | **F6 (pre-existing, not introduced by W0).** The comparison is page_count + squeezed extracted TEXT, so anything that changes ink but not characters is ungated: geom fractions, `LABEL_RATIO_*`/`NUM_RATIO`, colours set in `tools/hifi.py`, fonts, frame and badge geometry. Changing `hifi.FAINT` and committing without rebuilding leaves the gate, the full Python suite and `tools/validate.py` all green. A colour changed in `data/decks.json` IS caught (validate check 1b); a `hifi.py`-side one is caught by nothing. The new docstring at `:256` restates the overclaim. Later lanes lean on this gate - do not read it as stronger than it is. | OPEN |
| 7 | PR 129 review | Three minor nits in `tests/test_pdf_build.py`, all fail-red-never-green: fail-fast `assertEqual` on `proc.returncode` (`:270`) aborts the loop at the first missing PDF instead of accumulating all six into `stale`; the `:271` diagnostic says "not committed at HEAD" when the real cause is no git / not a checkout (a source tarball now fails); `:274`'s `'head-' + rel` assumes every `paths.PDFS` value is a bare basename (true for all six today). | OPEN |
| 3 | PR 128 review | Plan §3 lane table: add `tests/mutants/p_paper_picker_forgets_its_state.patch`, `d_esc_attr_leaves_quote`, `p_print_cta_drops_the_platform` to W3's Owns cell, the reciprocal of C3. **Already correct in this doc's Ownership table**, which is what the W3 spawn prompt and reviewer brief are built from, so the risk is contained to the plan's own prose. | OPEN |
| 8 | PR 130 review | `print.blank_cards` is nested under `print`, but index.html ~6069 and src/engine/pdfcards.js ~557 read top-level `d.blank_cards`; stale comments at index.html ~5994-6001 and tests/app.test.js:3397 say decks.json has no such key. W2 briefed to lift it in fromBuiltin; W3 to fix the comments. | OPEN |
| 9 | PR 130 review | `tools/decks.py` `_overlay_from_print` shallow-copies, so `decks.<DECK>['legend_lines']` aliases `_CANONICAL[...]['print']['legend_lines']`. No mutator today. | OPEN |
| 10 | PR 130 review | Ownership rows for data lanes should name `tests/mutants/` (b_* via regen_data_mutants.py, plus c_deck_data_drift.patch by hand - the tool does not cover it) as a mandated consequence of any data/decks.json change. | OPEN |
| 11 | PR 131 review | Mutant headers in `tests/mutants/w1b_*.patch` cite CLAUDE.md as the source of the pinned values; the real source is Q1 of `docs/plans/2026-09-22-seed-pdf-one-source.md`. | OPEN |
| 12 | PR 131 review | Stale docstring at `tests/test_print.py:918` says "W1a runs concurrently" - no longer true after the rebase. | OPEN |
| 13 | PR 131 review | `PinnedPrintValuesTest` overlaps `PrintDeckSnapshotTest`; the docstring should say why the pins are kept anyway (they name the owner-approved literals; the snapshot only freezes whatever is there). | OPEN |
| 14 | PR 131 review | Only 2 of the 5 new pin tests have a mutant; add one for `blank_cards` (pygmy 7) at minimum. | OPEN |
| 15 | PR 131 review | The Python pins cannot see the JS path: W2/W3 must take R from `print.R`, not the layout solver. Carried into the W2 reviewer brief and W3 parity. | OPEN |
| 16 | PR 132 review | `src/engine/pdfdeck.js` fromBuiltin's explicit blank_cards lift is dead code: the overlay flatten above it already copies `print.blank_cards` to top level. Removing the lift kills nothing. Drop it or fix the comment and the "LIFTED" test's story. | OPEN |
| 17 | PR 132 review | No test proves the `/g` on fromBuiltin's blurb substitution (drop-/g mutant survived). Add a synthetic two-count last line. | OPEN |
| 18 | PR 132 review | `tests/test_pdf_parity.py` coverage floor checks only the constants, not that the sweep loops iterate CASES; VARIANTS is used by no loop. Reverting a loop to SEEDS stays green. | OPEN |
| 19 | PR 132 review | fromBuiltin returns no `warnings` key (matches Python; pdfcards guards with `|| []`). A future unguarded read would throw for built-ins only. | OPEN |
| 20 | PR 132 review | `tools/pdf_build.js --builtin` with no value falls through to stdin mode and waits on a TTY instead of printing usage. | OPEN |
| 21 | W3 lane report | During local mutant verification W3 `cp -r`'d its linked worktree; the copy shared the real per-worktree git dir, so a scratch commit landed on `claude/w3-one-print-ux`. The lane undid it with `git reset --mixed 866bb4e` (not --hard; working tree kept). Pushed history is one clean commit (ec39760), and the copy is gone. Lesson for briefs: never copy a linked worktree to run tools. | OPEN |
| 22 | integrator | W3's fix lane committed 70ea8ad at 02:22 and then sat ~8 h without pushing, waiting on `until ! pgrep -f "tests/mutation_check.sh"`, which matched the polling shell's OWN command line and so never ended. The sweep itself had aborted at 02:26 on the known local macOS SigintDuringRunTest timeout and tested nothing. The integrator killed the two loops and re-briefed the lane to push; CI was the oracle. Lesson for briefs: never poll a process with `pgrep -f` on a pattern that appears in your own command; do not run a full local mutation sweep at all - CI's mutation gate is the evidence. | OPEN |
| 23 | PR 134 review | `index.html:6165` (and 6167): the printPaper boot guard indexes the plain object `PRINT_PAPER`, so an inherited key passes. Stored `{"printPaper":"toString"}` boots printPaper as "toString", the select shows LETTER, and both PDF buttons throw `non-finite coordinate: NaN` until the user picks A4. Only reachable by hand-editing localStorage. Fix: `Object.hasOwn(PRINT_PAPER, ...)`. | OPEN |
| 24 | PR 134 review | `index.html:6296`: the double-tap guard covers taps that arrive DURING the build (plan D1), but the build takes ~20 ms on desktop, so a human double-click 100-300 ms apart still builds and downloads twice. It would also stop working if `HPE.pdfcards.build` became async. Owner call whether to add a short cooldown. | OPEN |
| 25 | PR 134 review | Hand mutant M5 SURVIVED: dropping the `typeof ... === "string"` check from the printPaper boot guard is not caught. Under it a stored `["a4"]` boots an array: the select shows LETTER and the filename says Letter while pdfcards draws A4. Add a test with a stored array value, and a mutant for it. | OPEN |
| 26 | PR 134 review | Stale comment at `index.html:6229` (the "`openPrintSheet` below" sentence at `:6236`; first filed as :6227, corrected by the PR 135 review): still says "The custom-deck print CTA" and "`openPrintSheet` below"; the CTA now serves every deck and `openPrintSheet` sits above it. | OPEN |
| 27 | PR 133 review | `docs/plans/scale-engine-coordination.md` row 352 overstates: "every other test method ... hard-codes its own \"full\"/\"shop\" literal" - `test_the_sweep_actually_ran` (`tests/test_pdf_parity.py:214`) and `test_a4_is_letter_shifted_on_the_page` (`:267`) pass no variant literal. The finding itself (the floor guards the constants, not the loops) holds. | OPEN |
| 28 | PR 133 review | Row 333 of `scale-engine-coordination.md`: "unreferenced by any caller" is exact for `openPrintSheet` but loose for `PRINT_LAYOUTS`, which `printGridCSS` (`index.html:6042`) and `printSheetHTML` (`:6175`) read - both reachable only via `openPrintSheet`. | OPEN |
| 29 | PR 133 review | `README.md:159` names `tools/decks.py` as the PDF rebuild step without naming `tools/hifi.py` there (it is at `README.md:42`; decks.py drives hifi.py). Not false; cosmetic. | OPEN |

## Lane reports

**W0, returned `done` at `db59b2c`.** Both acceptance commands met. The lane
reports it constructed the vacuous case itself: after `python3 tools/decks.py`
rewrote the six PDFs uncommitted the suite stayed green, and clobbering the
worktree copy of `CSharp_Hijaz_Orion_9_Cards_Letter.pdf` with garbage left
`test_committed_pdfs_match_a_fresh_build` still passing (it reads
`git show HEAD:<pdf>`); a scratch commit editing `data/decks.json` without
rebuilding turned it red. Scratch commits discarded, `git status` clean of
rebuilt PDFs before push. **These are the lane's own claims** - the reviewer is
reproducing them independently rather than confirming them.
