# EASY tier: length 4 and any-anchor start

Follow-up to `docs/plans/2026-10-04-amy-naylor-progression-eval.md` (PR
#232). Owner decisions from the 2026-10-04 interview, all four the
recommended option: EASY deals 2, 3 or 4 chords drawn evenly; EASY and MEDIUM
may start on any anchor; the D-1 byte-identical BASIC pin from
`2026-10-02-sequence-difficulty.md` is lifted and re-pinned to the new EASY;
one serial lane, plan and eng review first, then build under AFK auth. No
named presets. Gap (3) of the eval (MEDIUM's card-based pool) is not taken
up.

## 1. Goal and non-goals

Goal: every one of Amy's ten progressions whose chords all exist as anchors
on a deck is in that deck's EASY pool (Pygmy 10 of 10, Amara A3 and A10 with
Gsus4 for Gm, Hijaz A6 with F#sus4 and G#°), and the tier nesting
EASY ⊂ MEDIUM ⊂ HARD still holds by construction.

Non-goals: no change to `connects()`, `anchors()`, the distinct-roots rule,
MEDIUM's per-card checks (≤4 fields, no LOW/HIGH except anchors, D-14),
HARD's lengths 4-6 or its catch-all, the `prev` rule, the DFS budget, the
app's tier buttons or copy, deck data, diagram geometry. No weighting toward
Amy's shapes, no triad-first MEDIUM pool, no presets. No change to any
refusal reason or its priority.

## 2. The new rules (binding once eng-reviewed)

- **R1 EASY lengths.** `{2, 3, 4}`. Length is drawn uniformly among the
  lengths whose pool is non-empty after `prev` exclusion, exactly as today
  with one more bucket. `LENGTH_ORDER` becomes `[4, 3, 2]` (order still
  immaterial to the draw).
- **R2 EASY start.** The first chord is ANY anchor. The home anchor is no
  longer special in the EASY pool. `NO_HOME_CHORD` is still checked first
  (D-6 keeps priority on every tier; the ding is the pan's tonal centre and
  the app's empty-tier copy presumes it). Auto-decision, see §7.
- **R3 EASY loop.** Every consecutive pair connects AND the last chord
  connects back to the FIRST chord, at every length (`connects` is
  symmetric, so length 2 is unchanged by the wrap). Today's "length 3 loops
  back home" is the special case where the first chord is home.
- **R4 EASY content.** Anchors only, distinct roots, no two identical cards.
  Unchanged.
- **R5 MEDIUM start.** The start set is the union of today's set (pool cards
  whose root is home) and the anchors. Anything else about MEDIUM is
  unchanged. HARD is unchanged.
- **R6 Classification.** `basicGate` = R1-R4 with the wrap checked by
  `makeAccept` as today; `intermediateGate` = lengths 3-4, first chord's root
  is home OR first chord is an anchor, the rest unchanged. `classifyTier`
  keeps trying BASIC, then INTERMEDIATE, then the 4-6 catch-all, so nesting
  is by construction: an anchor-only 4-chord loop that starts away from home
  now classifies `basic`, never `intermediate` or `advanced`. D-15 (length 3
  failing INTERMEDIATE is `null`) stands.
- **R7 `sequences(deck, length)`.** Accepts 2, 3 and 4; enumerates R1-R4
  over every anchor as the start. A throw for any other length stays.
- **R8 Rotations are distinct sequences.** `[Fm, Db, Ab, Eb]` and
  `[Db, Ab, Eb, Fm]` are both in the pool and `prev` excludes only the
  identical ordering. The player experiences a different first chord as a
  different drill, and Amy's own set treats A7 / A8 as different. Auto-
  decision, see §7.

Measured pools under R1-R4 (probe at `01915a6`, the same enumeration the
lane's test must reproduce):

| deck | anchors | today 2 / 3 | new 2 / 3 / 4 | total |
|---|---|---|---|---|
| Hijaz | 6 | 5 / 18 | 28 / 96 / 264 | 388 |
| Pygmy | 7 | 6 / 30 | 42 / 210 / 840 | 1,092 |
| Amara | 5 | 4 / 12 | 20 / 60 / 120 | 200 |

All eight of Amy's four-chord rows and both three-chord rows are in Pygmy's
new pool. A specific four-chord row is one deal in 2,520 on Pygmy (one third
for length 4, then 1 in 840); reachability, not frequency, was the goal.

Consequences for the other tiers, to ASSERT, not just note (eng review
2026-10-04, finding E1, confirmed by an exhaustive probe of every connected
loop at lengths 2, 3 and 4 on the three built-ins at `01915a6`). "HARD is
unchanged" holds for HARD's RULES only; at the behaviour level R5 moves every
anchor-start length-4 sequence that passes MEDIUM's per-card and repeat checks
out of HARD. The full migration, counted over loops that `makeAccept` admits
(every pair connects, the wrap connects, no consecutive identical card):

| deck | length | old -> new | count |
|---|---|---|---|
| Hijaz | 4 | HARD -> MEDIUM | 5,712 |
| Hijaz | 4 | HARD -> EASY | 216 |
| Hijaz | 4 | MEDIUM -> EASY | 48 |
| Hijaz | 3 | null -> MEDIUM / null -> EASY | 663 / 78 |
| Hijaz | 2 | null -> EASY | 23 |
| Pygmy | 4 | HARD -> MEDIUM | 58,016 |
| Pygmy | 4 | HARD -> EASY | 720 |
| Pygmy | 4 | MEDIUM -> EASY | 120 |
| Pygmy | 3 | null -> MEDIUM / null -> EASY | 3,253 / 180 |
| Pygmy | 2 | null -> EASY | 36 |
| Amara | 4 | HARD -> MEDIUM | 7,465 |
| Amara | 4 | HARD -> EASY | 96 |
| Amara | 4 | MEDIUM -> EASY | 24 |
| Amara | 3 | null -> MEDIUM / null -> EASY | 824 / 48 |
| Amara | 2 | null -> EASY | 16 |

Nothing moves in the other direction and no sequence that was MEDIUM becomes
HARD. Resulting length-4 pools: MEDIUM Hijaz 4,321 -> 10,033, Pygmy 41,012 ->
98,908, Amara 7,776 -> 15,241; HARD Hijaz 89,879 -> 83,951, Pygmy 5,322,120 ->
5,263,384, Amara 289,254 -> 281,693. The length-3 and length-2 `null -> *` rows
are sequences no tier could deal before (D-15 and the length-2 BASIC-only
rule) that EASY or MEDIUM now deals; they are new reachability, not migration.
Neither tier can go empty on a built-in deck. The lane's test reproduces the
length-4 MEDIUM and HARD totals above with the same enumeration (acceptance
criterion below), so a later change to R5 or R6 that silently re-shapes
MEDIUM fails a test rather than a review.

## 3. Lane (one, serial)

Branch `claude/easy-tier-amy`, worktree `.claude/worktrees/easy-tier`, base
main `01915a6`. Owns:

- `src/engine/sequence.js` (R1-R8) and the regenerated
  `<!-- engine:sequence -->` region of `index.html` via
  `python3 tools/inline_engine.py` (never by hand).
- `tests/sequence.test.js`, `tests/fixtures/sequence_basic_golden.json`,
  `tests/fixtures/sequence_tier_golden.json` (both re-captured with the
  capture snippets at the top of the test file; the commit message states
  the rule change that invalidates the old capture).
- `tests/mutants/sq_*.patch`, `tests/mutants/sqd_*.patch`: refresh contexts;
  rewrite `sq_home_not_first` as "start not an anchor" and
  `sq_loop_not_checked` as "wrap to the first chord dropped"; add one mutant
  per new rule (length 4 bucket dropped; MEDIUM start set loses the anchors;
  `intermediateGate` start clause loses the anchor branch). Per
  `mutant-patches-reject-index-lines`, strip `index a..b` lines.
- `tests/e2e.test.js`: the one assertion that EASY's rail has 2 or 3 chords
  (the "sequence mode: entering and leaving rebuilds the order" test) becomes
  2 to 4. No other app change. D-12 was superseded on 2026-10-02 ("Scroll,
  one line", the comment above `.seq-rail` in `index.html`): the rail never
  wraps, it overflows and scrolls horizontally, and card and footer
  dimensions never change with chord count. The existing "progression rail
  scroll continuity" e2e describe already covers rails longer than the
  viewport, so no new layout test is owed; the one assertion above is the
  whole e2e change (eng review finding E3).
- `tests/suite_health.py` FLOORS row for `sequence.test.js` and the README
  mutant count, set from THIS BRANCH's CI run artifacts (`by_module` /
  `files[].total`) on the commit that adds the mutants, pushed as a follow-up
  commit; CI reruns and the reviewer reads the FINAL head SHA. Main's
  artifacts cannot be the source, they only change when this PR lands
  (`floors-rows-lag-ci-count` says where the numbers live, not that they
  wait for main; eng review finding E4).
- `docs/plans/2026-10-02-sequence-difficulty.md`: a dated "superseded"
  note under D-1 and D-15's start wording, pointing here. CLAUDE.md gains
  one line under "Roadmap and ideas" is NOT needed; CLAUDE.md does not
  describe EASY's rules.

Not owned: `data/decks.json`, `tools/*`, any app JS or CSS outside the
engine region, `docs/SCALE_ENGINE_PLAN.md`.

### Steps (TDD)

1. Tests first in `tests/sequence.test.js`: (a) `sequences(deck, 4)` exists
   and the three built-in pool sizes equal the table in §2; (b) every EASY
   sequence starts on an anchor, visits distinct roots, connects every pair
   and wraps to its first chord; (c) length is drawn 2 / 3 / 4 within 3 pp of
   one third each over 6,000 seeded deals on Pygmy; (d) each of Amy's ten
   rows that exists on a deck (list them literally by chord name) has
   `tierOf === "basic"` and appears in `sequences(deck, n)`; (e) a 4-chord
   anchor-only loop starting away from home is `basic`, a 4-chord loop with
   one non-anchor ≤4-field card starting on an anchor is `intermediate`, the
   same starting on a non-anchor non-home card is `advanced`; (f) synthetic
   decks from the existing tests re-stated under the new rules (the two-
   anchor deck now yields `[home, B]` AND `[B, home]`); (g) the DFS fallback
   fixture (eng review finding E2): the existing four-card all-anchor deck
   (C / Dm / Em / G, stuck-at-zero rng) can no longer prove MEDIUM's DFS
   recovery, because under R5/R6 every loop it can form classifies `basic`.
   Give it a fifth card that is a non-anchor with 4 or fewer fields and no
   register (a 7th chord on one of the four roots) so MEDIUM has at least one
   admissible sequence that the sampler cannot hit with a stuck rng and the
   DFS must find; keep the four-card variant as a new case asserting
   `NO_TIER_SEQUENCE` for intermediate across 200 seeds while advanced still
   deals (lengths 5 and 6 with a sus-resolve-free repeat are HARD's catch-
   all); (h) the migration table in §2: enumerate every connected length-4
   loop on each built-in with the engine's own `buildConnectMatrix` and
   `classifyTier` and assert the new MEDIUM totals 10,033 / 98,908 / 15,241
   and HARD totals 83,951 / 5,263,384 / 281,693. Run, watch them fail.
2. Implement R1-R8 in `src/engine/sequence.js`; `python3 tools/inline_engine.py`.
3. Re-capture both golden fixtures; update the e2e length assertion.
4. Mutants: refresh, rewrite, add. `bash tools/mutation_check.sh` on a clean
   tree, never editing while it runs.
5. Superseded notes in the difficulty plan. FLOORS and README count from
   this branch's CI artifacts, as a follow-up commit (see ownership list).
6. Push, CI green at the head SHA, fresh reviewer at that SHA, merge under
   AFK auth with `gh pr merge <n> --merge`.

### Acceptance criteria

- `node --test tests/sequence.test.js` green; pool sizes 388 / 1,092 / 200.
- Amy's rows: Pygmy 10 of 10 `basic`; Amara A3 `[Dm, F, C, Gsus4]` and A10
  `[Gsus4, C, F]` `basic`; Hijaz A6 `[C#, F#sus4, G#°]` `basic`.
- `tierOf` on the eval's probe rows no longer returns `null` for Pygmy A6
  and A10.
- `python3 tools/validate.py` green (check 4 engine parity, check 1 DECKS).
- `python3 tools/inline_engine.py --check` clean.
- MEDIUM and HARD on the three built-ins still deal (3,000 seeded picks per
  tier, no `NO_TIER_SEQUENCE`), and no MEDIUM or HARD deal classifies
  `basic`.
- Perf bound of D1 step 6 (< 50 ms per pick in CI) still holds; the stuck-
  rng DFS test, on its replaced fixture (step 1(g)), still passes (the EASY
  path never enters the DFS).
- Every new and rewritten mutant is killed; the mutation gate green in CI.
- e2e: the rail at EASY shows 2 to 4 chords at 380 px; card and footer
  dimensions are unchanged by design (one-line scrolling rail, D-12
  superseded 2026-10-02), so no layout assertion is added.
- Migration (§2 table) asserted: length-4 MEDIUM pools 10,033 / 98,908 /
  15,241 and HARD pools 83,951 / 5,263,384 / 281,693 on Hijaz / Pygmy /
  Amara, by exhaustive enumeration in `tests/sequence.test.js`.
- The replaced DFS fixture (step 1(g)) deals MEDIUM through the DFS with a
  stuck rng, and the four-card all-anchor variant returns `NO_TIER_SEQUENCE`
  for intermediate.

Verify: `node --test tests/sequence.test.js tests/app.test.js && python3 tools/validate.py && python3 tools/inline_engine.py --check && bash tools/mutation_check.sh`, then CI at the head SHA.

## 4. Standing merge gates

CI green at the verified head SHA; independent reviewer PASS or
PASS_WITH_NITS at that SHA; no change outside the ownership list; the
engine region regenerated by the tool; both golden fixtures re-captured in
the same commit as the rule change.

## 5. Cost

Engine diff about 60 lines; tests about 150 lines plus two fixture files;
8 to 10 mutant patches. One PR. Human: about a day. CC: one lane, one review
bounce budgeted.

## 6. Risks

- The MEDIUM start-set union (R5) changes MEDIUM's sampling distribution on
  every deck. If the eng review prefers MEDIUM start = anchors only (drop the
  home-root non-anchor starts such as Dsus4), say so; the lane's tests
  change in one place.
- Rotations (R8) quadruple the length-4 pool. If the owner later wants
  "one deal per loop", a canonicalisation at enumeration time is a small
  follow-up; it is not in this lane.
- The e2e harness blocks web fonts; the rail-width check at 4 chords is
  measured on fallback fonts (`ci-harness-blocks-web-fonts`). The rail is a
  one-line horizontal scroller whose dimensions do not depend on chord count
  (D-12 superseded 2026-10-02), so font metrics cannot change the footer
  height at 4 chords; only the scroll-continuity behaviour matters and its
  e2e describe already runs at 6 chords.
- MEDIUM's sampling distribution changes more than R5 reads: on Pygmy its
  length-4 pool grows from 41,012 to 98,908 because 58,016 anchor-start
  sequences leave HARD (§2 table). HARD shrinks by about 1 percent on every
  deck. This is the intended reading of "EASY and MEDIUM, any anchor"
  (interview B); it is asserted, not left to the reader.

## 7. AFK auto-decisions

- R2 keeps `NO_HOME_CHORD` first even though EASY no longer needs the home
  anchor to start: the conservative branch (no refusal changes, D-6 and the
  E1 tests untouched). Alternative not taken: drop the refusal on EASY.
- R5 start set = union, not "anchors only", so no MEDIUM start a player can
  get today disappears.
- R8 rotations distinct. Alternative not taken: canonical loop with a random
  rotation at deal time (same reachability, smaller pool, more code).
- Ownership widened at execution (2026-10-04): `tests/app.test.js` pins mode S
  face digests (`tests/fixtures/card_face_v1.json`, `gen_face_v1.json`) that
  `tools/regen_card_fixture.js` enumerates over `sequences(deck, 2|3)`, and
  two app tests pinned EASY to 2 or 3 chords. Under R1 those went red in CI,
  so the lane also owns: the fixture tool's enumeration extended to length 4
  (comments updated), both digests regenerated (mode A and B digests checked
  byte-identical to main; only mode S keys changed and grew), and the two app
  assertions widened to 2 to 4. Alternative not taken: leave them red for a
  separate lane, which would block merge. No other app or `tools/*` change.
- The eval fixture for the five-card DFS deck gave `Dm` four fields as `Dm7`
  so chord 0 is the only legal MEDIUM start under R5; the old
  `sq_home_not_first` / `sq_loop_not_checked` mutants were renamed to
  `sq_start_not_anchor` / `sq_wrap_not_checked`; the golden tests were renamed
  to say "EASY golden fixture" / "tier golden fixture".
- Perf fix at execution (2026-10-04, commit `d639e95`): CI run 37232221226
  at `777e882` timed out `tests/sequence.test.js` at the 180 s suite limit
  (73 s locally against main's 49.5 s), because `pickBasic` enumerated three
  per-length DFS pools per deal with `connects()` recomputed at every node.
  `basicPools` builds the anchor adjacency once and emits every 2-, 3- and
  4-chord cycle from one DFS; `sequences()` and `pickBasic` both read it.
  Pool contents and order are unchanged (goldens and face digests byte-
  identical), so this is inside the lane's engine ownership and changes no
  rule. The two mutants whose hunks targeted the removed DFS
  (`sq_start_not_anchor`, `sq_wrap_not_checked`) were re-anchored on
  `basicPools` and are still killed by the named test. Alternative not
  taken: raise `NODE_SUITE_TIMEOUT`, which would hide the regression.
- Main gained `c1f145d` (`tools/preview.sh` only) during the lane; merged
  into the branch as `c3bafea`, no overlap with the ownership list.

## Eng review (2026-10-04, `/plan-eng-review`, HEAD `01915a6`)

Scope Challenge: scope accepted as-is. The plan touches nine files but they
are one rule change plus its generated copy, its tests, its mutants and its
counts; splitting would put the engine and its goldens in different commits,
which §4's merge gate forbids. Auto-decided under AFK (D1 in this invocation
was the office-hours skip; the complexity selector is a setup gate and takes
no D-number).

### Section 1: Architecture

- **E1 (P1, confidence 10/10, codex + probe).** §2 said "HARD is unchanged"
  and "HARD loses the anchor-only non-home-start 4-chord loops the same way".
  At the rule level HARD is untouched; at the behaviour level R5 + R6 move
  every anchor-start length-4 sequence passing MEDIUM's per-card and repeat
  checks from HARD to MEDIUM: 58,016 on Pygmy, 5,712 Hijaz, 7,465 Amara,
  besides the anchor-only loops that go to EASY. Confirmed by an exhaustive
  enumeration using the engine's own `buildConnectMatrix` and `classifyTier`
  (`src/engine/sequence.js:400-410`) against a re-implementation of R5/R6.
  Disposition: §2 now carries the full table and the lane asserts it.
- **E5 (P3, confidence 9/10, native).** `basicGate`
  (`src/engine/sequence.js:352`) takes `homeAnchorIdx` only for the
  start-on-home check that R2 removes. After R2 the parameter is dead;
  `classifyTier` still passes `ctx.homeAnchorIdx`. The lane drops the
  parameter rather than leaving an unused argument that a mutant could
  "break" without a kill. `homeOrRefuse` and `pick()`'s NO_HOME_CHORD check
  keep using `homeAnchorIdx`; nothing else changes. Recorded as part of R6's
  accepted scope, no separate decision (routine mechanics of the approved
  rule).
- No change to `connects()`, `tierPool`, `TIER_LENGTHS` for MEDIUM/HARD or
  the DFS. `tierStartSet` (`:440`) gains the anchor union for
  `intermediate` only; `advanced` keeps `pool`.

### Section 2: Code quality

- `LENGTH_ORDER` (`:28`) becomes `[4, 3, 2]`; `sequences()` (`:182`) keeps
  the throw for lengths outside 2..4 so `sqd`-style length mutants still have
  a target. The "no outer length pre-filter in `classifyTier`" rule from the
  sqd_05 mutant note stands: `basicGate`'s own first line does the 2..4 check.
- The wrap check for EASY lives in `sequences()`'s enumerator (the pool is
  built there, not sampled) AND in `makeAccept` (`:515`) for the tiered path.
  Both read the same `connects()`; no third copy.
- No new abstraction. The only new helper is "is an anchor" for the start
  test, and `anchorsList.indexOf` already is that.

### Section 3: Tests

```
pick(deck, rng, prev, "basic")
  |- NO_HOME_CHORD ............ E1 test (existing, unchanged)
  |- pools 2/3/4 after prev ... new (a) sizes 388/1,092/200, (b) invariants
  |- even length draw ......... new (c) 6,000 deals, 3 pp tolerance
  |     (sigma at p=1/3, n=6,000 is 0.61 pp; 3 pp is ~5 sigma: no flake,
  |      a dropped bucket moves a share by 33 pp: caught)
  |- Amy rows reachable ....... new (d) literal chord names
  |- rotations distinct ....... new (f) [home,B] and [B,home]
classifyTier
  |- nesting ................ new (e) basic / intermediate / advanced triples
  |- migration .............. new (h) exhaustive length-4 totals
pickTiered (MEDIUM)
  |- start set union ........ new (e) + golden re-capture
  |- DFS fallback ........... REPLACED fixture (g) five-card deck
  |- NO_TIER_SEQUENCE ....... new (g) four-card all-anchor deck
app
  |- rail 2..4 .............. tests/e2e.test.js:7475 widened
mutants
  |- sq_home_not_first -> "start not an anchor"
  |- sq_loop_not_checked -> "wrap to first dropped"
  |- + length-4 bucket dropped, + MEDIUM start loses anchors,
  |  + intermediateGate start loses anchor branch
```

- **E2 (P2, confidence 10/10, codex + native).** The four-card all-anchor
  fixture (`tests/sequence.test.js:778-831`) proves MEDIUM's DFS recovery
  today only because its loops are MEDIUM. Under R5/R6 every distinct-root
  loop of anchors is EASY and the deck has no non-anchor, so
  `pickTiered(..., "intermediate")` returns `NO_TIER_SEQUENCE` and the test
  would pass vacuously or fail, either way proving nothing about the DFS.
  Disposition: step 1(g).
- **E3 (P2, confidence 10/10, codex + native).** §3 and §6 cited D-12's
  "two-line wrap"; `index.html`'s `.seq-rail` comment records D-12 superseded
  2026-10-02 by "Scroll, one line". Disposition: wording corrected, assertion
  widened to 2..4, no layout test added because dimensions are invariant by
  design and the scroll-continuity describe already runs at 6 chords.
- Gaps identified: 2 (E2, E3), both closed in the plan.
- Test Plan Artifact:
  `~/.gstack/projects/raywu-handpan-cards/ray-claude-easy-tier-amy-eng-review-test-plan-2026-10-04.md`.

### Section 4: Performance

- EASY enumerates, it does not sample: length-4 candidates on Pygmy are
  7 x 6 x 5 x 4 = 840 orderings before the connect filter, well under one
  millisecond. The 50 ms bound (D1 step 6) is a MEDIUM/HARD concern and the
  MEDIUM start set only grows, which makes the 512-draw sampler hit sooner
  and the DFS run less, never more.
- **E4 (P2, confidence 10/10, codex + native): process, not runtime.** FLOORS
  and the README count were to come "from main's CI artifacts after the
  mutants land", but they ship in the same PR. Disposition: branch CI
  artifacts, follow-up commit, reviewer at the final SHA.
- Issues found: 0 runtime, 1 process (E4).

### Suppressed findings

- Codex's recommendation to "specify and test the complete migration before
  replacing goldens" is E1's disposition, not a separate item.
- The reviewer of PR #232 noted the forward reference from the eval doc to
  this plan dangles until this lane lands. Known, by design; this lane is the
  one that resolves it.

## Decision ledger

Authorization for every answer below: AFK mode armed (owner, global
CLAUDE.md "AFK mode", "Decisions while I'm away": pick the option I would
have recommended, record it). Each is the recommended, non-destructive option.

### C1: Migration statement and assertion (E1)
Finding: E1, P1, 10/10, `docs/plans/2026-10-04-easy-tier-amy.md` §2 "Consequences", codex + native probe
Plan baseline: original proposal, "HARD is unchanged ... loses the anchor-only non-home-start 4-chord loops the same way" (no prior approval)
Runtime evidence: exhaustive probe at 01915a6 (scratchpad `migration_probe.js`): Pygmy 58,016 HARD->MEDIUM, 720 HARD->EASY, 120 MEDIUM->EASY at length 4; Hijaz 5,712/216/48; Amara 7,465/96/24
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| §2 consequences text | understated | full table, all lengths | unchanged | unchanged pending probe | unchanged, follow-up |
| Lane asserts MEDIUM/HARD length-4 totals | none | yes, exhaustive | no | no | no |
| R5 / R6 themselves | as proposed | unchanged | unchanged | unchanged | unchanged |
Question D2:
D2 - Should the plan state and assert the full HARD->MEDIUM migration?
Project/branch/task: handpan-cards, claude/easy-tier-amy, EASY-tier rules.
ELI10: Letting MEDIUM start on any anchor also pulls tens of thousands of four-chord loops out of HARD. The plan said HARD was untouched. If we do not write that down and test it, the next person who edits the start rule re-shapes MEDIUM without anyone noticing.
Stakes if we pick wrong: a reviewer or a future lane reads "HARD unchanged", changes R5 or R6, and the tier distribution the owner asked for silently drifts.
Recommendation: A because the probe already exists, the counts are exact, and the test is one enumeration.
Completeness: A=10/10, B=3/10, C=5/10, D=5/10
A) Apply: full table in §2 and an exhaustive-enumeration test (recommended)
  ✅ Every tier's behaviour change is written and locked by a test, no reader is misled
  ✅ The enumeration takes about two seconds on Pygmy, cheap enough for the unit suite
  ❌ Three more fixed numbers to update if R5 or R6 ever change on purpose
B) Keep the plan as written
  ✅ No extra test or table to maintain
  ❌ The plan states something false about HARD and MEDIUM's pool more than doubles unasserted
C) Investigate further before deciding (bounded: rerun the probe at length 3 and 2 too)
  ✅ Completes the picture for the shorter lengths
  ❌ Already done: the length 3 and 2 rows are in the table; nothing is left to investigate
D) Defer to a follow-up lane
  ✅ Keeps this lane's diff smaller
  ❌ Goldens get re-captured in this lane on an unstated pool; the follow-up would re-capture them again
Net: write it down and assert it now, or re-do the goldens later.
Header: Migration assertion
Options:
A) Apply: table + exhaustive test
B) Keep as written
C) Investigate (length 3 and 2 probe)
D) Defer to follow-up lane
State: approved
Actual answer: A (AFK auto-decision, recommended option, 2026-10-04)
Accepted scope: §2 migration table (all three lengths); TDD step 1(h); acceptance criterion asserting MEDIUM 10,033 / 98,908 / 15,241 and HARD 83,951 / 5,263,384 / 281,693 at length 4
History: none

### C2: DFS fallback fixture (E2)
Finding: E2, P2, 10/10, `tests/sequence.test.js:778-831`, codex + native
Plan baseline: original proposal kept "the existing stuck-rng DFS test still passes" (no prior approval)
Runtime evidence: the fixture is four anchors C / Dm / Em / G; under R5/R6 every distinct-root loop on it is `basic`; `tierPool(intermediate)` contains no non-anchor, so no MEDIUM sequence exists
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| Fixture for MEDIUM DFS proof | four anchors | five cards, one non-anchor 7th | unchanged | unchanged pending | drop the MEDIUM DFS assertion |
| Four-card deck kept | yes | yes, as NO_TIER_SEQUENCE case | yes | yes | yes |
| HARD DFS proof | same fixture | same fixture, unchanged | unchanged | unchanged | unchanged |
Question D3:
D3 - Replace the MEDIUM DFS fixture or let it go vacuous?
Project/branch/task: handpan-cards, claude/easy-tier-amy, EASY-tier rules.
ELI10: One test proves the search can rescue MEDIUM when random draws keep failing. The deck it uses only has simple chords, and under the new rules every loop of simple chords is now EASY, so MEDIUM on that deck has nothing to find. The test would stop proving what its name says.
Stakes if we pick wrong: a DFS regression in the MEDIUM path ships green.
Recommendation: A because one extra card keeps the proof and costs ten lines.
Completeness: A=10/10, B=2/10, C=4/10, D=3/10
A) Apply: add a fifth non-anchor card; keep the four-card deck as a NO_TIER_SEQUENCE case (recommended)
  ✅ The DFS-recovery proof for MEDIUM survives the rule change with the same stuck rng
  ✅ The all-anchor deck becomes a second useful case: MEDIUM refuses, HARD still deals
  ❌ The fixture needs a 7th chord's fields spelled out by hand, about ten lines
B) Keep the existing fixture
  ✅ Zero test churn
  ❌ The test either fails or passes vacuously; either way it proves nothing about MEDIUM
C) Investigate (bounded: run the existing test against a local R5/R6 sketch first)
  ✅ Confirms the vacuity empirically
  ❌ The pool argument is exhaustive already; the lane's first red run shows the same thing
D) Drop the MEDIUM assertion, keep HARD
  ✅ Smallest diff
  ❌ Loses coverage the previous workstream added on purpose (PR #202 perf review)
Net: ten lines of fixture versus a silent coverage hole.
Header: DFS fixture
Options:
A) Add a fifth non-anchor card
B) Keep the fixture
C) Investigate first
D) Drop the MEDIUM assertion
State: approved
Actual answer: A (AFK auto-decision, recommended option, 2026-10-04)
Accepted scope: TDD step 1(g); acceptance criterion for the replaced fixture and the four-card NO_TIER_SEQUENCE case
History: none

### C3: Rail acceptance criterion (E3)
Finding: E3, P2, 10/10, plan §3 and §6, `index.html` `.seq-rail` comment, codex + native
Plan baseline: original proposal "D-12's rail already wraps to two lines"; "stays within D-12's two-line bound" (no prior approval)
Runtime evidence: `index.html` comment above `.seq-rail`: D-12 superseded 2026-10-02, "Scroll, one line", dimensions identical to BASIC; e2e describe "progression rail scroll continuity" exists
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| §3/§6 wording | two-line wrap | one-line scroll, superseded D-12 | unchanged | unchanged pending | unchanged |
| e2e assertion | 2 or 3 | 2..4 | 2..4 | 2..4 | 2..4 |
| New layout test | none | none (dimensions invariant) | none | none | deterministic 4-chord visibility test |
Question D4:
D4 - Correct the rail criterion to the current one-line design?
Project/branch/task: handpan-cards, claude/easy-tier-amy, EASY-tier rules.
ELI10: The plan describes the chord rail as wrapping onto a second line. The shipped app stopped doing that two days ago; it scrolls sideways and never changes height. An acceptance criterion against a design that no longer exists cannot be checked.
Stakes if we pick wrong: the reviewer checks a bound that nothing implements, and either fails the lane for nothing or passes it without looking.
Recommendation: A because the dimensions cannot change by construction and the scroll behaviour already has a describe.
Completeness: A=10/10, B=2/10, C=4/10, D=10/10
A) Apply: fix the wording, widen the assertion to 2..4, add no layout test (recommended)
  ✅ The criterion matches the shipped design and is checkable in one assertion
  ✅ No new e2e test on a harness that blocks web fonts and starves the browser locally
  ❌ Relies on the existing scroll-continuity describe rather than a 4-chord-specific case
B) Keep the wording
  ✅ No edit
  ❌ Cites a superseded decision; unverifiable
C) Investigate (bounded: read the D-12 supersession commit)
  ✅ Confirms the supersession date
  ❌ The `index.html` comment already records it; nothing to learn
D) Apply wording fix plus a deterministic 4-chord current-card-visible e2e test
  ✅ Directly exercises a 4-chord EASY rail
  ❌ Adds a seeded e2e case for behaviour the 6-chord describe already covers; more harness time for no new coverage
Net: fix the words; the existing test already proves the behaviour.
Header: Rail criterion
Options:
A) Fix wording, widen to 2..4
B) Keep wording
C) Investigate the supersession
D) Fix wording + new 4-chord e2e
State: approved
Actual answer: A (AFK auto-decision, recommended option, 2026-10-04)
Accepted scope: §3 ownership wording; §6 risk wording; acceptance criterion rewritten; `tests/e2e.test.js:7475` widened to 2..4
History: none

### C4: FLOORS and README count source (E4)
Finding: E4, P2, 10/10, plan §3 ownership and step 5, codex + native
Plan baseline: original proposal "set from main's CI artifacts after the mutants land" (no prior approval)
Runtime evidence: the FLOORS row and README count ship in the same PR as the mutants; main's artifacts change only after merge
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| Count source | main's CI, post-land | this branch's CI run artifacts | main (impossible before merge) | pending | main, in a follow-up PR |
| Reviewer SHA | head | final head after the count commit | head | head | head |
Question D5:
D5 - Where do the FLOORS row and README mutant count come from?
Project/branch/task: handpan-cards, claude/easy-tier-amy, EASY-tier rules.
ELI10: The suite-health floor and the README's mutant count must match what CI actually counts. The plan said to read them off main after the PR lands, but they are edited inside the PR, so that is a loop with no entry.
Stakes if we pick wrong: the lane stalls waiting for numbers that only exist after it merges, or ships guessed counts that fail suite health.
Recommendation: A because the branch's own CI run has the artifacts and a follow-up commit plus a final-SHA review is the standard loop here.
Completeness: A=10/10, B=0/10, C=3/10, D=7/10
A) Apply: branch CI artifacts, follow-up commit, reviewer at the final SHA (recommended)
  ✅ The numbers exist before merge and match the gate that will judge them
  ✅ Matches `floors-rows-lag-ci-count`'s real intent: the artifacts, not the branch they live on
  ❌ One more CI round trip for the count commit
B) Keep: main's artifacts after landing
  ✅ None beyond "no edit"
  ❌ Circular; cannot be executed
C) Investigate (bounded: check whether suite health tolerates a stale floor)
  ✅ Might show the floor can lag one PR
  ❌ The README count is asserted exactly; a lag would redden main
D) Defer: ship without the counts, fix them in a follow-up PR
  ✅ Lane merges sooner
  ❌ Main goes red on suite health until the follow-up lands
Net: read the branch's own run; one extra CI round trip beats a red main.
Header: Count source
Options:
A) Branch CI artifacts + follow-up commit
B) Keep: main after landing
C) Investigate floor tolerance
D) Defer to follow-up PR
State: approved
Actual answer: A (AFK auto-decision, recommended option, 2026-10-04)
Accepted scope: §3 ownership bullet and step 5 rewritten
History: none

Approval readiness: PASS. Checked C1 (D2, A), C2 (D3, A), C3 (D4, A), C4
(D5, A); E5 carried as routine mechanics of R6 (no separate approval
needed). No deferrals.

## NOT in scope

- Gap (3) of the eval, a triad-first or weighted MEDIUM pool: the owner did
  not ask for it in interview B.
- Named presets of Amy's progressions: owner said "No, generator only".
- Canonical loops with a random rotation at deal time (R8 alternative):
  more code for the same reachability; recorded in §7.
- Dropping NO_HOME_CHORD on EASY: would change a refusal reason, outside §1's
  non-goals.
- A 4-chord-specific rail e2e test: the one-line rail's dimensions do not
  depend on chord count (C3).

## What already exists

- `sequences(deck, length)` already enumerates with the wrap for length 3;
  the lane generalises the start set and the length, it does not rebuild it.
- `makeAccept` already checks the wrap for every tier; no second wrap check.
- `tierPool` already admits every anchor into MEDIUM's pool (D-14), so R5's
  union is a start-set change only.
- The migration probe (scratchpad, 2 s on Pygmy) is the lane's test (h),
  re-expressed with the engine's own internals.
- The stuck-rng fixture pattern and the NO_TIER_SEQUENCE cases exist; (g)
  extends them.

## Diagrams

```
pick(deck, rng, prev, tier)
   |
   |-- NO_HOME_CHORD? ---------------------------> refuse (all tiers, D-6)
   |
   |-- tier = basic: pickBasic
   |       pools = {2,3,4} -> sequences(deck, n) minus prev
   |       drop empty buckets, draw length evenly, draw sequence
   |       sequences(): start ANY anchor -> anchors only, distinct roots,
   |                    every pair connects, last connects to FIRST
   |
   |-- tier = intermediate | advanced: pickTiered
           startSet: intermediate = pool.filter(root==home) UNION anchors
                     advanced     = pool
           512 draws then DFS; accept = wrap + classifyTier == tier

classifyTier: basicGate(2..4, start anchor, all anchors, distinct roots)
              -> intermediateGate(3..4, start home-root OR anchor, ...)
              -> 4..6 advanced -> null
```

No implementation file needs an inline diagram; the comment block above
`classifyTier` already explains the nesting and should gain one sentence on
the anchor start.

## Failure modes

| Path | Failure | Test | Handling | User sees |
|---|---|---|---|---|
| EASY, deck with one anchor | all buckets empty | existing TOO_FEW_CHORDS test | refusal reason | clear message |
| EASY, length-4 bucket empty on a 3-anchor deck | draw among 2 and 3 only | new (c) on a synthetic 3-anchor deck | even draw over non-empty pools | unaffected |
| MEDIUM, all-anchor deck | nothing left for MEDIUM | new (g) | NO_TIER_SEQUENCE | existing empty-tier copy |
| MEDIUM start on an anchor whose root is not home | wrap or repeat rule fails | (e) and goldens | accept() rejects, resampled | unaffected |
| Golden drift after rule change | stale fixture | re-capture in the same commit (§4 gate) | validate.py | n/a |
| Rail at 4 chords | overflow | scroll-continuity describe | one-line scroller | scrolls |

Critical gaps: 0.

## Worktree parallelization

One lane, serial: engine, inlined copy, tests, goldens, mutants and counts
all depend on the same rule change and §4 forbids splitting the goldens from
the engine commit. Lanes: 1, parallel 0, sequential 1.

## Implementation Tasks

| # | Task | Files | Verify |
|---|---|---|---|
| 1 | Tests (a)-(h) first, red | `tests/sequence.test.js` | `node --test tests/sequence.test.js` fails on the new cases only |
| 2 | R1-R8 in the engine; drop `basicGate`'s `homeAnchorIdx`; inline | `src/engine/sequence.js`, `index.html` region | `python3 tools/inline_engine.py --check` |
| 3 | Re-capture both goldens; widen e2e to 2..4 | `tests/fixtures/sequence_*_golden.json`, `tests/e2e.test.js` | `node --test tests/sequence.test.js tests/app.test.js`; `python3 tools/validate.py` |
| 4 | Mutants: refresh, rewrite two, add three | `tests/mutants/sq_*.patch`, `sqd_*.patch` | `bash tools/mutation_check.sh` on a clean tree |
| 5 | Superseded notes in the difficulty plan | `docs/plans/2026-10-02-sequence-difficulty.md` | read |
| 6 | Push; FLOORS row + README count from the branch's CI artifacts; follow-up commit | `tests/suite_health.py`, `README.md` | CI green at the final head SHA |
| 7 | Fresh reviewer at the final SHA; merge under AFK | - | `gh pr view --json headRefOid` == local tip; reviewer PASS |

## Unresolved decisions

None in this review.

## Completion summary

- Step 0: Scope Challenge: scope accepted as-is
- Architecture Review: 2 issues found (E1, E5)
- Code Quality Review: 0 issues found
- Test Review: diagram produced, 2 gaps identified (E2, E3)
- Performance Review: 1 issue found (E4, process)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex (cli 0.156.1), completed, 4 findings, all four applied
- Parallelization: 1 lane, 0 parallel / 1 sequential
- Lake Score: 4/4

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | NOT RUN | - |
| Outside Review | codex via `/plan-eng-review` | Independent 2nd opinion | 1 | COMPLETED | 4 findings, 4 applied |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN (PLAN) | 5 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | NOT RUN | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | NOT RUN | - |

- **OUTSIDE COVERAGE:** codex (cli 0.156.1, model probe MODEL_OK), phase plan-review, completed, 4 findings (migration understated; DFS fixture vacuous; rail criterion stale; FLOORS source circular).
- **CROSS-MODEL:** native review (claude, this harness) and codex overlap on all four codex findings; the native review added E5 (dead `homeAnchorIdx` parameter) and the length-3/length-2 reachability rows that codex did not raise. Model identities: codex CLI 0.156.1 (model slug not recorded by the harness), claude-fable-5-1 native.
- **VERDICT:** ENG CLEARED (issues mapped to tasks, none open) — ready to implement.

NO UNRESOLVED DECISIONS
