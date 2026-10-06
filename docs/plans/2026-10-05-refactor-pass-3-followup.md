# Refactor pass 3 follow-up: restore lost coverage, four owner-approved deletions

Date: 2026-10-05. Parent plan: `docs/plans/2026-10-05-refactor-pass-3.md` (all seven lanes merged).
One serial lane. Section 4.3 and section 6 of the parent plan apply unchanged, with two exceptions. Gate 5: a third
failed review of this lane triggers the regroup rule in the owner's AFK instructions. FLOORS: the parent's "FLOORS is
CL only" is overridden for the rows FU-9 names.

## 1. Goal

1. Put back coverage that pass 3 reviewers found weakened (PG nits N1 and N2; SB nits on SB-2, SB-4, SB-6 and
   `diffGen`).
2. Carry out the four deletions the owner approved on 2026-10-05 from the parent plan's section 10: Q1, Q9, Q10, Q12.

Done when: every step below is done or took its named STOP branch, CI `validate` is green at the PR head, and
`ls tests/mutants/*.patch | wc -l` equals the README figure.

## 2. Non-goals

- Q4 (disarming DELETE wipes a standing pan warning): owner said leave untouched. Q2, Q5, Q6, Q7, Q8, Q9b, Q11, Q13.
- Any app behaviour change. FU-5 removes an unread field and nothing else from `index.html`.
- Deck data, diagram geometry, engine regions, the `const DECKS` line, the visual system.
- Stale-comment nits from the pass 3 reviews, except comments on lines this plan already rewrites
  (`tests/e2e.test.js` near `hpfc` stays).
- The repo CLAUDE.md sentence under "Verification style" that lists the `check_2` invariants: left for the owner.
- Renaming any existing test. Deleting any test other than the one FU-5 names.
- The two body-sharing mutant pairs judged by DIFFERENT tests (`sw_wheel_flight_guard_dropped` /
  `us_wheel_ignores_flight`, `ap3_raildiff_always_same_deal` / `uid_rail_new_deal_inherits_scroll`): they stay.

## 3. Lane FU: `claude/rp3-followup`

**Owns.**
- `tests/test_suite_health.py`, `tests/test_render_agreement.py`
- `tests/app.test.js`: the `SB-2`, `SB-4`, `SB-6` tests, new tests beside them, and the test
  `PRINT_PAPER carries no page-box height` with its comment. Nothing else in the file.
- `tests/mutation_harness.test.js`: one new test, appended next to
  `every mutant patch's # kills: line is actually selected by its # suite: command`.
- `tools/regen_card_fixture.js`: `diffAll` and `diffGen` only.
- `index.html`: the `const PRINT_PAPER` line and the comment directly above it. Nothing else.
- `tools/validate.py`: `check_2` and the docstring lines that describe it. `tests/test_deck_data.py`: the module
  docstring sentence saying root/tone non-overlap and "every voicing field is lit" belong to validate.py (FU-7
  makes it false; reword it to say where highlighting is pinned: `tests.test_print`, `tests.test_render_agreement`).
- `README.md`: the section `## Optional: Claude Code follow-up prompt` and the line containing `mutant patches under`.
- `tests/CONTRACT.md`: the bullet starting ``- `localStorage` key `hpfc` will be shared``.
- `tests/suite_health.py`: FLOORS rows for `tests/test_render_agreement.py`, `tests/mutation_harness.test.js`,
  `tests/test_suite_health.py`, nothing else.
- `tests/mutants/`: new `r3f_*` patches, the three deletions below, refreshes forced by this lane's diff.

**Never touches.** Everything else. `tests/e2e.test.js`, `src/engine/`, `data/`, `tools/hifi.py`, `tools/sandbox.js`.

**Order.** Each step is a test commit, then the change commit, except FU-1 (a single commit: its change is in the
test file). FU-1 to FU-4 first, deletions after. New JS test names start with `FU-<step> ` (parent 4.3).

### FU-1 (PG N1) shipped kill-path timings are exercised again

- Fact: `tests/test_suite_health.py` sets `suite_health.GROUP_TERM_GRACE = 2` and `DRAIN_TIMEOUT = 1`
  unconditionally in the fake-node fixture (search `suite_health.GROUP_TERM_GRACE = 2`), so no test fails when the
  shipped values in `tests/suite_health.py` (`GROUP_TERM_GRACE = 10`) change.
- Change: `suite_health.GROUP_TERM_GRACE = min(old_grace, 2)` and `suite_health.DRAIN_TIMEOUT = min(old_drain, 1)`.
- Prove: with `GROUP_TERM_GRACE = 0` in `tests/suite_health.py` (throwaway edit, reverted), at least one test in
  `tests.test_suite_health` fails (the eng review saw
  `test_a_grandchild_in_its_own_session_is_reaped_by_its_parent` fail 3 of 3). Paste the failing line in the PR body.
- STOP: if no test fails under grace 0, keep the `min()` form and add one test
  `test_shipped_grace_gives_the_reaper_a_budget` asserting `GROUP_TERM_GRACE >= 2` and `DRAIN_TIMEOUT >= 1`
  (the values the fixture needs); say so in the PR body.
- Mutant: `r3f_grace_zero` (sets shipped grace to 0); `# kills:` and `# suite:` name the test Prove found
  (`python3 -m unittest -k <test> tests.test_suite_health`), or the STOP test. `DRAIN_TIMEOUT` gets no mutant, on purpose.
- Verify: `python3 -m unittest tests.test_suite_health` `OK`.

### FU-2 (PG N2) a plain `rect` on the frame is recorded again

- Fact: `RecordingCanvas` in `tests/test_render_agreement.py` records `roundRect` into `rec.rects`; `rect` was
  removed in pass 3 and now falls through `__getattr__` to a no-op. A tone-coloured `c.rect` across the frame in
  `hifi.duo_frame` therefore no longer fails `BorderAgreementTest.test_print_frame_is_a_single_root_coloured_band`.
- Test first: `test_recording_canvas_records_plain_rects` in the same file: after `setFillColor` and
  `rec.rect(x, y, w, h, stroke=0, fill=1)`, `rec.rects` holds one entry with that geometry and fill. Red at base.
- Change: restore a `rect` method that appends to `self.rects` in the same shape `roundRect` uses. This puts back,
  on purpose, what PG-6 removed as unused.
- Mutant: `r3f_frame_tone_rect` adds `c.setFillColor(gb or GREEN); c.rect(x, y, w, h, stroke=0, fill=1)` to
  `hifi.duo_frame` (full card width and filled, or `render_border` ignores it); `# kills:` names
  `test_print_frame_is_a_single_root_coloured_band` and `# suite:` selects only that test. The patch targets
  `tools/hifi.py`; the lane does not edit that file.
- Verify: `python3 -m unittest tests.test_render_agreement` `OK`; the mutant dies on the named test.

### FU-3 (SB nits) SB-2, SB-4 and SB-6 assert what their titles say

- SB-4: no test change. The existing `startsWith(origin + pathname)` already fails when the path is dropped (the
  sandbox pathname is `/index.html`); what is missing is a mutant. Cut `r3f_sharelink_drops_path` (`shareLink` builds
  from `location.origin` alone) and paste its `not ok` line.
- SB-6: replace `length === 1` with `deepStrictEqual` on the exact problem strings, and add the reverse direction
  for rails (fixture has a rail the render lacks). Strings at base: `gen d mode A card 1: missing from fixture`;
  `rail advanced: fixture undefined != current r`; `gen d mode B card 0: missing from current render` (FU-4 rewrites
  this one); reverse rail `rail basic: fixture r != current undefined`. Mutant `r3f_diffgen_ignores_fixture_rail`: the rail loop
  iterates `Object.keys(actual.rails)` only.
- SB-2: the "served but the app never looks it up" half gets its own mutant `r3f_served_id_never_looked_up`. The
  existing `r3s_served_id_not_in_markup` covers only the markup half. The test's subject is its cross-check of
  `tools/sandbox.js` `ELEMENT_IDS` against `index.html`, and a mutant changes a shipped file, never the test: cut it
  as a patch to `tools/sandbox.js` that adds to `ELEMENT_IDS` `settings-title`, which IS in the markup but which the app never
  looks up by `getElementById` or `$`, on a different `ELEMENT_IDS` line from `r3s_served_id_not_in_markup`. No test change is needed for this half; the lane does not otherwise edit
  `tools/sandbox.js`.
  STOP: no markup id exists that the app never looks up: ship no SB-2 mutant and say so with the grep that shows it.
- Verify: `node --test --test-reporter=tap --test-name-pattern '^SB-' tests/app.test.js`.

### FU-4 (SB nit) `diffGen` reports a deck or mode present on one side with zero cards

- Fact: `diffAll` in `tools/regen_card_fixture.js` unions card keys, so a deck or mode that exists on one side with
  no cards yields no problem.
- Test first: new test `FU-4 diffGen reports a deck or a mode that exists on one side only, even with no cards`
  beside SB-6: fixture has mode `B: {}`, render lacks `B` (and the reverse; and the same for a whole deck). Red at base.
- Change: in `diffAll`, a deck key present on exactly one side pushes exactly `${deckId}: missing from fixture` or
  `${deckId}: missing from current render` and `continue`s; a mode key present on exactly one side pushes
  `${deckId} mode ${mode}: missing from fixture` (or `... from current render`) and `continue`s. Their cards are not
  listed separately. The change commit rewrites SB-6's missing-mode expectation to
  `gen d mode B: missing from current render`; SB-6 keeps its name.
- Verify: `node --test --test-reporter=tap --test-name-pattern '^FU-4|^SB-6' tests/app.test.js`.
- Regression guard: `node tools/regen_card_fixture.js --check` and the generated-fixture check still report no
  problems on main's fixtures. Do NOT rewrite any fixture. The pass 3 reviewer reported, unverified, that
  `tools/regen_pan_fixture.js --check` rewrites its fixture: do not run that tool.
- Mutant: `r3f_diffall_ignores_empty_mode`.
- STOP: if the shipped fixtures contain an empty deck or mode so the new check fires on main, stop the lane before
  FU-5 and report the fixture path (FU-5 removes a test and needs FU-4's to keep the `tests/app.test.js` count).

### FU-5 (Q1) remove the unread `PRINT_PAPER[*].css`

- Fact: `index.html` reads `PRINT_PAPER` only through `isPaper` (`hasOwnProperty`). `css` is read by one test.
- Change: `const PRINT_PAPER = { letter: true, a4: true };` and reword the `/* No page-box height here ... */` comment directly above it (no size
  keyword survives; the object is the list of valid paper names). The `/** ... */` block above that stays. Delete the test `PRINT_PAPER carries no page-box height`
  and its comment. Delete `tests/mutants/p_print_paper_height_restored.patch`.
- Prove first: `git grep -n 'PRINT_PAPER' -- index.html src tools tests ':!tests/mutants'` shows no read of `.css`
  or `.h` other than the deleted test. Paste it.
- Forces: none expected; `qd_j_paper_inherited_key` and `qd_j_paper_not_string` anchor on `isPaper`. Confirm with
  `python3 tools/refresh_mutants.py --check`.
- Accept: `tests/app.test.js` total is unchanged across the lane (FU-4 adds one test, FU-5 removes one).
- STOP: any other read of `.css`: stop, change nothing, report it.

### FU-6 (Q9) delete the two true duplicate mutants, and lint for the next one

- Test first: in `tests/mutation_harness.test.js`,
  `FU-6 no two mutant patches share a diff body and a selected test`: body = the patch minus `#`, `index` and `@@`
  lines; selected test = the `# kills:` line. Red at base on exactly two pairs:
  `ap3_railbuild_live_region_off_by_one` / `sqe_count_not_positional` and `d_panhit_undercuts_its_note` /
  `qa_pan_hit_radii_drops_note_floor`.
- Change: delete the later-added patch of each pair: `ap3_railbuild_live_region_off_by_one.patch` (2026-10-03; kept
  `sqe_count_not_positional`, 2026-09-29) and `qa_pan_hit_radii_drops_note_floor.patch` (2026-10-01; kept
  `d_panhit_undercuts_its_note`, 2026-09-17).
- Mutant: none for the lint (a harness lint over the corpus; the red-at-base run is its proof). Paste it.
- STOP: the lint is red on any other pair: do not delete it; list it in the PR body and exempt it by name in the
  test with a one-line reason only if the two patches are judged by different tests.

### FU-7 (Q10) delete the three assertions in `check_2` that cannot fire

- Change in `tools/validate.py` `check_2`: delete `assert not (root_f & tone_f)`, the
  `for f in ch["fields"]: assert f in root_f or f in tone_f` loop, and `assert total == expected_total`, with the
  now-unused `root_f`, `tone_f`, `expected_total`. Keep `rpc in pcs`, the doubled-pc assertion, and the
  `(%d cards)` line. Make the check's title and the module docstring say what is left.
- Verify: `python3 tools/validate.py` exits 0 and still prints `(96 cards)`;
  `python3 -m unittest tests.test_deck_data` `OK`.
- Forces: none; no patch targets `tools/validate.py`.

### FU-8 (Q12) remove two invitations to un-tracked work

- Change: delete README section `## Optional: Claude Code follow-up prompt` through the end of its blockquote.
  Delete the `tests/CONTRACT.md` bullet starting ``- `localStorage` key `hpfc` will be shared`` (both lines).
- Verify: `python3 -m unittest tests.test_readme_currency` `OK`.

### FU-9 counts

- README `mutant patches under` figure = `ls tests/mutants/*.patch | wc -l` at the lane head
  (expected 669 - 3 + the `r3f_` patches shipped).
- FLOORS: `tests/app.test.js` nets 0 and its row is unchanged. Raise `tests/test_render_agreement.py` (+1),
  `tests/mutation_harness.test.js` (+1) and, only if FU-1 took its STOP, `tests/test_suite_health.py` (+1) to the
  totals in the CI artifacts of this PR's own run at the pushed head (`js-results` `files[].total`,
  `python-results` `by_module`), push that commit and let CI rerun. The reviewer is spawned only after CI is green at
  the SHA that contains the FLOORS commit.
- STOP: any row would have to be lowered: stop and report.

**Mutants.** New prefix `r3f` (not present on main). Up to 6 new, 3 deleted. Cap 40 patch files touched.
Strip `index a..b` lines; `.` wildcards in `# suite:`; every new mutant dies on exactly the test its `# kills:` names.

**Reviewer must check.**
- Each new test is red at the base commit and green at head; each `r3f_` mutant dies on the test it names.
- The three deleted patches are exactly the ones named; the lint is red at base on exactly those two pairs.
- `index.html` diff is the `PRINT_PAPER` line and its comment only; no fixture file changed.
- The three deleted `check_2` assertions are the three named; the two that can fire remain.
- README figure equals the directory listing at the head SHA; no FLOORS row lowered; each raised row equals the
  artifact total.
- Every STOP branch taken is named in the PR body with its evidence.

**Split size and cut.** About 120 lines added, 60 removed. Only FU-3's SB-2 mutant may be cut. Expected mutant
count: 669 - 3 + 6 = 672.

## 4. Decisions recorded (AFK auto-decisions, overturnable)

1. The plan ships as the first commit of the lane branch instead of its own plan PR: one small lane, and the
   reviewer reads the plan at that commit's SHA so the lane cannot move its own goalposts.
2. Q9 gains a lint test. The owner approved the deletion; the lint is the failing test TDD needs and stops the pair
   coming back.
3. Q1 keeps `PRINT_PAPER` as an object (`{ letter: true, a4: true }`) so `isPaper` and its two mutants keep their
   anchors.
4. Of each duplicate pair the later-added patch is deleted.
5. Eng review (fresh agent, 2026-10-05): READY_WITH_CHANGES, twelve findings, all folded in. Where it proposed a
   permitted FLOORS lowering if FU-4 were cut, FU-4 was made uncuttable instead, so no row is ever lowered.
