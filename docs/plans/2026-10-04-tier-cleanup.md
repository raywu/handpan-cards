# Tier rebalance cleanup (2026-10-04)

Follow-up to `docs/plans/2026-10-04-tier-rebalance.md` (PR #236, main
`3c97d40`). The owner picked exactly three cleanups in the 2026-10-04
interview: "Stale plan text, Relative-major naming, Dead HARD assertion".

## 0. Goal and non-goals

**Goal.** One small PR that (C1) makes the tier-rebalance plan text match
what shipped, (C2) makes the engine comments and test names say what
`tierContext` actually accepts as the second BASIC start, and (C3) replaces
the S3 assertion that can never fail with one that can, proven by a mutant.

**Non-goals.** No engine behaviour change: `src/engine/sequence.js` changes
in comments only, and every golden and face digest stays byte-identical. No
HARD home-start weight (owner, same interview: "Leave as is"). No change to
`pick()`'s context cost (offered, not selected). No change to the N = 300
sweep draws. No deck data, geometry, markup, CSS or app JS change. No new
test beyond the C3 assertion. No tightening of the home+3 start to major
triads only.

## 1. C1: stale plan text

Edit `docs/plans/2026-10-04-tier-rebalance.md` only. Each spot is found by
its quoted text, not a line number:

| section | stale text | becomes |
|---|---|---|
| 0 goal | "HARD stops being a catch-all and always contains an extended card" | HARD stops being a catch-all: it needs an extended card or two non-anchor cards (R-7 as amended) |
| 7 M-5 row | "Pygmy 40.5 > 15.5, Amara 40.5 > 33.7", "Hijaz (26.7 vs 37.3)" | the section 2 figures: HARD 16.0 / 32.8 / 34.3 |
| 7 S2 | "HARD extended 100%" | every HARD deal meets the R-7 predicate and the register bound (what S2 asserts) |
| 8 step 1, T1 row | "15 mutants", "15 `sqr_*` mutants" | 17 |
| 8 step 5, verify command | `bash tools/mutation_check.sh` | `bash tests/mutation_check.sh` |
| 8 reviewer brief (3) | "contains no extended card" | "has no extended card and at most one non-anchor card" (TR-5 as restated) |
| 7 M-5 row; 11 row keyed `TR-6` | (append to each) | owner decision 2026-10-04: leave as is, no HARD home-side weight |
| intro, "1,000 per row of the generated sweep" | 1,000 | 300 (TR-15) |
| 3 R-4, "H 37.3 is the h! case of M-5" | 37.3 | 34.3 |
| 7 intro, "3,000 draws per tier on built-ins, 1,000 on" the sweep | 1,000 | 300 (TR-15) |

The MEDIUM home figure in the M-5 row is checked against section 2 and
corrected only if it differs. Sections 13 (review record) and 14 (execution
notes) are history and are NOT rewritten, including their "15 mutants" and
"1,000 draws" mentions; neither is the section 9 "Recorded for the owner"
sentence, which is about a different decision. Nothing else is rewritten.

## 2. C2: relative-major naming

`tierContext` adds, for a MINOR-triad home, every anchor of
`chordShape(...).tier === 0` (major OR minor triad) rooted 3 semitones above
home. Comments and test names call that "the relative major". The code is
the shipped behaviour and stays. The fix is a single definition:

- At the `basicStarts` comment above `tierContext`: state the exact rule
  (major or minor triad anchor rooted a minor third above a minor-triad
  home), and that the engine calls this the "relative" start because on the
  built-in decks it is the relative major.
- Every other "relative major" in `src/engine/sequence.js` comments and in
  `tests/sequence.test.js` comments, messages and the one test name
  ("R-9: every rotation ...") becomes "relative start" (or "relative-start
  rotation"). Deck-specific messages that are literally true ("Fm home, Ab
  relative major") stay.
- The `side: "relative"` key and `BASIC_SIDE_WEIGHT.relative` are unchanged.
- Run `python3 tools/inline_engine.py`, then COMMIT: both
  `tools/refresh_mutants.py` and `tests/mutation_check.sh` refuse a tree
  with uncommitted changes to mutant targets. Commit again before the
  mutation gate. Re-anchor every `tests/mutants/*`
  patch whose context lines moved (`python3 tools/refresh_mutants.py`, hand
  rewrite against a stabler anchor where it cannot); `git apply --check`
  every `sq*` patch and `eg_prevvalid_inverted.patch`. A mutant `# suite:`
  header that names the renamed test is updated (none does today; the only
  other mention of the old name is tier-rebalance section 3, which is
  updated to match).

## 3. C3: dead HARD assertion

`assertMonotonic` in `tests/sequence.test.js` has
`assert.ok(H.nonAnchorRegister >= 0, ...)`: a share is never negative.
M-3 is "B = M = 0 <= H", so the only side that can fail is: a deck whose
HARD pool holds a non-anchor register card must show H > 0.

TDD order:
1. Add mutant `tests/mutants/sqr_18_hard_register_cards_refused.patch`:
   in `hardGate`, `return register * 3 <= seq.length;` becomes
   `return register === 0;`. Suite header names the S3 test with `.`
   wildcards. Confirm it SURVIVES the current S3 (that is the proof the old
   assertion is dead).
2. Replace the dead line. `assertMonotonic` takes one more argument,
   `expectRegister`; when true it asserts `H.nonAnchorRegister > 0`, when
   false it asserts nothing about HARD's share (0 <= H holds by
   construction). The S3 test passes true for Pygmy ONLY: it is the one
   deck whose HARD deals are measured to carry non-anchor register cards
   (tier-rebalance section 2: 20.3% of HARD chords). Hijaz, Amara and every
   sweep row pass false. Eligibility is stated per deck by name, not derived
   from `tierPool` (which lists every card and proves nothing about what a
   connected HARD sequence can contain; outside voice, 2026-10-04).
3. S3 green on a clean tree; the mutant is now killed by S3 on Pygmy.

## 4. Lane (one, serial)

Branch `claude/tier-cleanup`, worktree `scratchpad/cleanupwt`, base
`3c97d40`. The three items share `tests/sequence.test.js` and the mutant
directory, so they do not split.

**Ownership:** `docs/plans/2026-10-04-tier-rebalance.md`;
`docs/plans/2026-10-04-tier-cleanup.md`; `src/engine/sequence.js` (comments
only); the `<!-- engine:sequence -->` region of `index.html` via
`tools/inline_engine.py`; `tests/sequence.test.js`; `tests/mutants/*.patch`
that patch `src/engine/sequence.js` (re-anchor) plus the new `sqr_18`; the
mutant count line in `README.md`; the `tests/sequence.test.js` FLOORS row
in `tests/suite_health.py` only if the test count changes (it should not).

**Acceptance criteria:**
1. Every row of the section 1 table is applied in the tier-rebalance plan.
2. `git diff 3c97d40 -- src/engine/sequence.js` touches comment lines only;
   `tests/fixtures/` is unchanged.
3. "relative major" survives in the engine and the sequence tests only at
   the one definition and in deck-specific messages that name a major triad.
4. The dead assertion is gone; `sqr_18` survives S3 at `3c97d40` and is
   killed by S3 at the head SHA.
5. `python3 tools/inline_engine.py --check` and `python3 tools/validate.py`
   pass; CI is green at the head SHA, mutation gate included, with 647
   mutants; README states 647.
6. No file outside the ownership list changed.

**Verify command:**
`node --test tests/sequence.test.js tests/app.test.js && python3 tools/validate.py && python3 tools/inline_engine.py --check && bash tests/mutation_check.sh`

**Merge gates:** CI green at a head SHA verified against the local tip;
independent reviewer PASS or PASS_WITH_NITS at that SHA; merge with
`gh pr merge <n> --merge`, no `--delete-branch`.

## 5. Risks

- Comment edits move mutant context lines; a patch that no longer applies
  reddens the mutation gate. Mitigation: `git apply --check` over every
  patch that touches `src/engine/sequence.js` before pushing.
- `sqr_18` could be killed for the wrong reason (a golden test) if its suite
  header is too broad. The header names S3 only.

## 6. Execution notes

(filled in by the lane)

## 7. Eng review record (2026-10-04, AFK auto-decisions)

Probe: with `return register === 0;` in `hardGate`, S3 passes at `3c97d40`
(2.7 s). The old assertion is dead and `sqr_18` survives it, as section 3
step 1 expects.

- A1 (AFK auto): skipped the gstack upgrade offer and the design-doc
  prerequisite; neither changes this plan.
- A2 (outside voice P2, accepted): C3 eligibility by `tierPool` was
  unjustified. Section 3 step 2 now names Pygmy; the sweep fallback is gone.
- A3 (outside voice P2, accepted): commit checkpoints before
  `refresh_mutants.py` and before the mutation gate (section 2).
- A4 (outside voice P2, accepted in part): three more stale spots added to
  the section 1 table; the review record and execution notes of the old
  plan stay as history, stated explicitly.
- A5 (own finding P3): the renamed R-9 test is also quoted in tier-rebalance
  section 3; updated with it.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 4 issues, 0 critical gaps, all resolved in the plan |
| Outside Voice | codex | Independent 2nd opinion | 1 | completed | 3 P2, all accepted (A2-A4) |

- **Scope:** 6 files plus mutant patches, no new modules; no complexity gate.
- **Architecture / performance:** no issues; comment-only engine diff.
- **Tests:** one assertion replaced, proven by `sqr_18`; coverage of the
  changed path is complete.
- **UNRESOLVED:** 0.
- **VERDICT:** ENG CLEARED, ready to implement.
