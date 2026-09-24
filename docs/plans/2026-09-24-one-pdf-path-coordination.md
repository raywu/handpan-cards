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
- The D2 browser-print cutover. `openPrintSheet` (`index.html:6119`) and
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
| plan #128 | merged | MERGED | PASS_WITH_NITS | 2026-09-24 |
| W0 | merged | MERGED | PASS_WITH_NITS | 2026-09-24 |
| W1a | claude/w1a-print-overlay | IN FLIGHT | - | 2026-09-23 |
| W1b | claude/w1b-print-pins | IN FLIGHT | - | 2026-09-23 |
| W2 | - | blocked on W1a | - | 2026-09-24 |
| W3 | - | blocked on W2 | - | 2026-09-24 |
| W3d | - | blocked on W2 | - | 2026-09-24 |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| 129 | W0 | PASS_WITH_NITS | 1 major + 5 nits. Major F1: the oracle is half-HEAD - reference from `git show HEAD:`, build side still worktree-sourced. Plus no mutant guards the new path (F2), and a pre-existing text-only-comparison overclaim (F6). | Merged; all filed as queue rows 4-7. Ownership respected, no out-of-scope files, CI success at the reviewed SHA. |
| 128 | plan doc | PASS_WITH_NITS | 2 nits: (1) §9.5 D1's quoted "Pygmy-shaped seed" omits the `/` inner separator, so it solves 11 rim / 0 inner (ext 1.4767, R 50.1, -16.5%) not Pygmy's 9 rim / 2 inner (-15.7%); the -15.7% used elsewhere is correct. (2) the §3 lane table's W3 Owns cell omits `tests/mutants/`, which W3 step 6 requires it to edit - C3 reached the W1b row only. | Merged; both filed as queue rows 2 and 3. Ownership respected, CI success at the reviewed SHA, no out-of-scope files. |

## Cycle state

Cycle: 1   Wave: 2 in flight (W1a, W1b spawned 2026-09-23)   Merged this batch: c37a7f9 (PR 128), db59b2c (PR 129)

| Lane | Agent ID | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|---|
| plan | - | removed | deleted | 128 | c37a7f9 | all 5 green at c37a7f9 | PASS_WITH_NITS | 0 | yes | - | no |
| W0 | - | removed | deleted | 129 | db59b2c | all 5 green at db59b2c | PASS_WITH_NITS | 0 | yes | - | no |
| W1a | (live, see transcript) | /private/tmp/claude-501/wt-w1a | claude/w1a-print-overlay | - | base 2865044 | - | - | 0 | no | - | yes |
| W1b | (live, see transcript) | /private/tmp/claude-501/wt-w1b | claude/w1b-print-pins | - | base 2865044 | - | - | 0 | no | - | yes |
| W2 | - | - | - | - | - | - | - | 0 | no | W1a | no |
| W3 | - | - | - | - | - | - | - | 0 | no | W2 | no |
| W3d | - | - | - | - | - | - | - | 0 | no | W2 | no |

## Resume here (written for a fresh session)

State as of 2026-09-23: wave 2 in flight. W1a and W1b lane subagents were
spawned from `origin/main` 2865044 into `/private/tmp/claude-501/wt-w1a` and
`wt-w1b`. If this session died, their agent IDs are gone: check each branch
for a PR (`gh pr list --head <b>`), verify head == remote tip, and either
review it or re-spawn the lane from its Briefing. Merge order is AD-4
(W1a first, then re-brief W1b to rebase and re-target its mutants).

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
