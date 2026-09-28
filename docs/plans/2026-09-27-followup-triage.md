# Phase F follow-up triage

- **Goal:** after the lanes below merge, (a) the deadzone mutant `e_swipe_deadzone_dropped` is killed on every CI run at the head SHA, because each negative swipe check reads the counter only after that swipe's `touchend` is acknowledged, and (b) a scale name typed with iOS `--` or `...` saves instead of being refused. Every other Phase F follow-up has a recorded verdict.
- **Date:** 2026-09-27
- **Base:** `main` @ `6f341ab` (merge of PR #148). Every file:line below was read at that SHA in a detached worktree.
- **Shape:** /swarm with two disjoint lanes, F2b (`tests/e2e.test.js`) and F6b (`index.html` `sheetOptions` + `tests/app.test.js`). Revised by /plan-eng-review (see the review sections at the end).
- **Related docs:**
  - `docs/plans/2026-09-24-quality-eval.md` (the "quality-eval" plan): the severity scale, N1-N10, the §6 gates and D1-D7.
  - `docs/plans/2026-09-24-one-pdf-path-coordination.md` (the "one-pdf" doc). Its OPEN rows are 4, 5, 6 and 30-35.
  - `docs/plans/scale-engine-coordination.md` (the "scale-engine" doc). Its OPEN rows are 82 and 83.
  - None of those OPEN rows duplicates items 1-10. Scale-engine row 325 (closed) is the CI evidence for row T1 below and is referenced, not re-listed.

## §1 Goal and non-goals

**Goal.** A regression that a real user can hit must not ship with CI green.

This list comes from the Phase F reviewers: items 1-10 plus their nits. Most items are test-precision nits on paths that no user reaches. The app is live, lightly used and not expected to grow. So:
- a defect a user can reach earns FIX;
- a test-quality item earns FIX only if it closes an S1 or S2 escape path;
- an item that is only imprecise is DROP;
- scale, adversary, performance and CI-flake concerns carry little weight.

Severity (S1-S4) and cost (C1-C3) use the scales in quality-eval §1.

**Non-goals.** N1-N10 from quality-eval §1 carry over unchanged. New ones:

| # | Non-goal |
|---|---|
| N11 | No product change to `index.html` or `src/engine/*` in this workstream, except F6b's one normalisation line in `sheetOptions` (eng-review E3). The comment-only findings in §2 (T13, T16) ride along with the next lane that owns those lines; no lane is opened for them |
| N12 | No hardening of the share decoder against crafted links (item 1). Links are checksum-gated and re-parsed. There is no adversary model (the context weighting above) |
| N13 | No edits to `tests/mutation_check.sh`, since every edit there stales the h_* patches (memory: mutation-check-edits-stale-h-patches). Its comment nit is DROP, not deferred |
| N14 | Mutation-gate flakes other than the one T1 fixes are handled by gate 3 (re-run once at the same SHA), not by test rewrites |

## §2 Triage

Sorted FIX, OWNER, DEFER, DROP, STALE. "Verified at" means `6f341ab`.

| # | Item | Verified at | Sev | Cost | Verdict | Why / failure prevented |
|---|---|---|---|---|---|---|
| T1 | 3: the Q27 negative swipe checks run -50 then +50, a pair that can cancel out. The comments contradict each other | `tests/e2e.test.js:462-492`<br>`tests/mutants/e_swipe_deadzone_dropped.patch`<br>`index.html:7559` | S1 | C1 | **FIX** (F2b) | See "T1 in detail" below |
| T3 | 4: Q29 normalises only `‘’“”` and misses em dash and ellipsis | `index.html:6815-6824` (`sheetOptions`)<br>`src/engine/core.js:265, 295` (`NAME_RE`, BAD_NOTE)<br>`tests/app.test.js:1476-1500` (U+2019 only) | S2 | C1 | **FIX** (F6b) | iOS Smart Punctuation turns a typed `--` into U+2014 and `...` into U+2026 (a single `-` is not converted). `NAME_RE` is ASCII-only, so GENERATE refuses the whole save with BAD_NOTE, the engine's code for any rejected option (`core.js:266-267`). Reachable in normal use on the app's primary device; reclassified from DEFER by eng-review E3 (outside voice O5) |
| T2 | 2: Q16 reads only `px`, only the first `font-size` in each rule, and only exact selector matches | `tests/app.test.js:~3453-3503` (`sizeOf`)<br>`index.html:478-479, 642, 643` | S3 | C1 | DEFER | See "T2 in detail" below. **Trigger:** the next edit to the sizing of `#scale-box`, `#scale-name` or `#scale-degrees` |
| T4 | 1: `utf8String` accepts overlong sequences and surrogates | `src/engine/share.js:134-164`, called from `decodeSeed` `:374` after the checksum gate at `:367` | S4 | C1 | DROP | Confirmed: `C1 82` decodes to "B". No victim, for three reasons:<br>1. Encode never emits overlong bytes, so no genuine link is affected.<br>2. A crafted link must still pass the checksum.<br>3. The decoded text still goes through `parseSeed`, so the worst case is a deck the sender could have shared openly.<br>No owner sign-off is needed, because nothing ships (N12) |
| T5 | 2: Q26 ignores the `font:` shorthand | `tests/app.test.js:~3506-3545` (`familyOf`)<br>`index.html:358, 373, 375` use `font-family` | S4 | C1 | DROP | The three families Q26 checks are all declared with `font-family` today. Switching to the shorthand fails loudly (the test finds no family), which is the safe direction |
| T6 | 3: the print re-enable test never proves the build ran | `tests/e2e.test.js:837-857` | S4 | C1 | DROP | True: `disabled===false` also holds if the build never ran. But a build that is never wired up is caught by the double-tap build-count test, so there is no escape |
| T7 | 3: the Q1 share test rebuilds the link origin itself | `tests/e2e.test.js:1323-1383`<br>`index.html:5618` (`shareLink`) | S4 | C1 | DROP | **Contradicts the reviewer's weighting.** `shareLink` has no UI caller (D3), so the origin half is unreachable by a user. The inbound half is covered, and `f2_share_boot_dropped` kills it |
| T8 | 3: the `e_kb_cap_outlives_the_sheet` kill is intermittent | `tests/mutants/e_kb_cap_outlives_the_sheet.patch`<br>`index.html:7216-7222` | S4 | C1 | DROP | Low-weight CI flake (N14). Gate 3 covers it. The underlying fix (row 88) is also pinned by the translate half of the same test |
| T9 | 3: a `sheetOpen` gate mutant survives. The negative read at :4905 has no sentinel, and Q8's caution list missed it | `index.html:7061` (`!sheetOpen`)<br>`tests/e2e.test.js:4904-4907` | S4 | C1 | DROP | See "T9 in detail" below |
| T10 | 4: the arrow-key test starts on slot 0, so ArrowUp mapped to Home would pass | `tests/app.test.js:1922-1948`<br>`index.html:7467-7468` | S4 | C1 | DROP | Needs a contrived mutant. Home and End are pinned separately (`:2139-2170`) |
| T11 | 4: Shift+Tab from a middle stop is untested | `tests/app.test.js:2139-2170` (first stop only) | S4 | C1 | DROP | Imprecise, not an escape. The focus order is DOM order, and the first-stop test pins the wrap |
| T12 | 4: Q23 calls `generateDeck`, not the GENERATE path | `tests/app.test.js:572-605`<br>`tests/helpers/sandbox.js:372-375`<br>`index.html:7272` (`runGenerate`) | S4 | C1 | DROP | `runGenerate`'s `!res.ok` branch is generic and shared with every other refusal, which other tests already drive |
| T13 | 4: the `openShare` comment is stale | `index.html:5624-5627` claims "nothing here composes a sentence of its own"<br>`generateDeck` `:5551-5567` does compose one (D7) | S4 | C1 | DROP | Confirmed. It is comment-only, and editing `index.html` stales app-anchored mutants. Fix it in the next lane that owns those lines (N11) |
| T14 | 4: a zero-chord scale saved by an old build is dropped at boot but never removed from storage | `index.html:5690` (`restoreScales`) | S4 | C1 | DROP | Invisible to the user: the record is skipped on every boot. No build ever wrote one except before D7, a window of about a day on a lightly used app |
| T15 | 5: removing the new `set -f` survives | `tests/mutation_check.sh:86-89` | S4 | C1 | DROP | The mutant is equivalent today: `grep '[][*?]'` over every `# suite:` header matches 0 headers |
| T16 | 5: the `run_suite` comment says "line 27", but nullglob is at line 30 | `tests/mutation_check.sh:81` (the reviewer cited :80), nullglob at `:30` | S4 | C1 | DROP | Confirmed. The fix is comment-only and would stale h_* patches (N13) |
| T17 | 5: the `e_sheet_ctlrow_pinned_again` header's apostrophe should be `.` | the header vs `tests/e2e.test.js:4796` | — | — | DROP | **Contradicts the reviewer.** The literal `'` matches the test name byte for byte, and word-splitting does not touch `'` inside a word, so the header selects its test |
| T18 | 5: narrowing `h_run_node` left `test_check_node_names_the_missing_binary_as_a_problem` with no mutant | `tests/test_suite_health.py:411`<br>`tests/mutants/h_run_node_file_missing_node_raises.patch` | S4 | C1 | DROP | True, but its group still has a mutant, and D2 requires one per group only |
| T19 | 5: `h_e2e_mutant_skipped_by_filename.patch` is not byte-length-neutral | that patch | — | — | DROP | **Contradicts the reviewer on impact.** It patches bash, not Python. Byte-length neutrality matters only for `.pyc` timestamp/size invalidation, and a non-neutral patch is the safe direction anyway |
| T20 | 6: a lead byte at the true payload end (`[0x0a, 0xe2]`) is untested | `tests/share.test.js:432-469` | S4 | C1 | DROP | **Contradicts the reviewer.** A boundary mutant is equivalent: the missing byte reads `undefined`, and `undefined & 0xc0` fails the continuation check anyway |
| T21 | 6: the prefix literal is duplicated | `tests/share.test.js:440, 475` (the reviewer cited 445/477) | S4 | C1 | DROP | Style only (N5) |
| T22 | 6: Q18 lacks a `checksum("")` pin and a golden decode | `tests/share.test.js:124-132, 954-1010` | S4 | C1 | DROP | **Contradicts the reviewer on the golden decode.** The encode is pinned and the round trip holds, which together imply the decode. `checksum("")` is unreachable, because a seed head is never empty |
| T23 | 6: Q21's row text says "iv" but the engine gives "IV" | `docs/plans/2026-09-24-quality-eval.md:336`<br>`tests/naming.test.js:465-472` (asserts "IV") | S4 | C1 | DROP | Doc-only, in a closed plan. The test asserts the right value |
| T24 | 6: the comment at :467 is muddled | `tests/share.test.js:467` | S4 | C1 | DROP | Comment only (N5) |
| T25 | 6: Q22 uses a synthetic suffix, and one collapse mutant is probably equivalent | `tests/select.test.js:286-303`<br>`tests/mutants/f1b_collapse_two_root_symmetric.patch` | S4 | C1 | DROP | **Contradicts the reviewer.** The mutant (`> 1` changed to `> 2`) is killed, and the synthetic suffix pins spec behaviour, which is the intent |
| T26 | 7: the legendDemo test can't tell field 1 from field 2 | `tests/pdfcards.test.js:280-297`<br>`src/engine/pdfdeck.js:132-141` | S4 | C1 | DROP | **Contradicts the reviewer's weighting.** The branch is the chordless-deck fallback, and since D7 no chordless deck reaches a PDF from the app |
| T27 | 7: the badge check reads a total count and only the first glyph's colour | `tests/pdfcards.test.js:167, 207-225` | S4 | C1 | DROP | See "T27 in detail" below |
| T28 | 8: nothing pins stack line numbers, and the comment at :149 doesn't say that lines outside scripts read as covered | `tests/helpers/sandbox.js:141-161, 332` | S4 | C1 | DROP | Line mapping serves coverage only, and coverage is never a gate (N6). No test reads `Error.stack` line numbers (checked: none match `index.html:NNNN` or `.stack`) |
| T29 | 8: boot got slower, so switch to `.replace(/[^\n]/g," ")` | `tests/helpers/sandbox.js:141-161` | S4 | C1 | DROP | **Contradicts the reviewer.** Measured on the 421 KB `index.html`: the per-char loop takes 2.7 ms per boot and the proposed regex 3.3 ms, so the regex is slower. A whole boot is 7.3 ms, and `tests/app.test.js` finishes in 2.1 s |
| T30 | 9: the asserts at `tests/test_deck_data.py:252` and `:303` sit outside `subTest` | `tests/test_deck_data.py:252, 303` | S4 | C1 | DROP | Both still fail the test. `subTest` changes only how the failure is reported (N5) |
| T31 | 9: `tests/test_font_subset.py:76-79` checks only the return code, not "DESYNC" | `tests/test_font_subset.py:76-79`<br>`tools/inline_fonts.py:148-161` | S4 | C1 | DROP | `--check` returns 1 only on drift, and any other non-zero exit (usage 2, a crash) also fails the test. Matching the string adds nothing |
| T32 | 10: `test_band_and_hairline_agree` and the numberFills check have no count guards, and the `render_app_badge_fill` regex is fragile | `tests/test_render_agreement.py:497-517` (zip), `:530-545` (`if lab in`), `:276-283` (regex) | S4 | C1 | DROP | See "T32 in detail" below |

**T1 in detail.**
- **User-visible failure it prevents:** the 55px deadzone collapses. Every tap whose thumb slides a pixel then both flips the card and throws it away.
- **CI evidence:** the mutant survived once in CI (scale-engine row 325, run 35908013774). Locally it was killed 4/4 times.
- **Mechanism:** `b.swipe` (`tests/helpers/cdp.js:234-243`) returns before the touch handler runs. The first `expectCount("1/n")` can therefore pass on its first poll. The mutant's +50 then undoes its -50, and the trailing -120 lands on "2/n" either way.
- **The comments:** the comment at `:469-473` says the events resolve before the handler runs, while the one at `:486-490` says they dispatch synchronously. They cannot both be right.

**T2 in detail (T3 now FIX).**
- **T2:** confirmed. The reviewer said `clamp()` is already in use. It is, at `index.html:112, 374, 376, 608`, but not on the three controls Q16 guards. So Q16 is exact for today's CSS, and the gap opens only when someone edits those rules.
- **T3:** moved to FIX (F6b). Correction to the triage draft: iOS does not type an en dash for a single hyphen; it converts `--` to an em dash and `...` to an ellipsis. U+2013 is still normalised for pasted text.

**T9 in detail.**
- **Confirmed:** removing `|| !sheetOpen` survives. The read at `:4905` comes right after `fakeKeyboard`, with no barrier.
- **Why DROP:** there is no user path. A lift re-applied to a closed sheet lands on a `hidden` element (`:7205`). `showSheet()` re-measures synchronously (`:7147`) before the next paint, so the stale value is overwritten unseen.

**T27 in detail.**
- The count is compared against `chords.length`, and `b_pygmy_badge_count` and `r_badge_count` kill it.
- The badge is drawn in one colour per string, so a mixed-colour badge would need a new code path.

**T32 in detail.**
- **Count guards:** the count guard exists in the same class. `test_tonefield_positions_agree` (`:369`) asserts field-count equality before its own zip, and `test_every_card_is_compared` pins 96/96. The lit-state gate that the band test relies on is pinned by the highlighting test.
- **The regex:** it fails loudly (AttributeError) on a reformat. It does not pass silently.
- **Mutants:** `f7_app_band_width` and `d_pan_no_hairline` kill the band test.

## §3 Lanes

| Lane | Owns | Never touches | Rows | Acceptance | Verify |
|---|---|---|---|---|---|
| F2b swipe deadzone | the body of the test `a swipe shorter than the threshold does not navigate` in `tests/e2e.test.js` (currently `:462-492`), new `tests/mutants/f2b_*.patch` if any, and the `"tests/e2e.test.js"` FLOORS row in `tests/suite_health.py` (`:51`, 113; it rises only if the lane adds a test) | `index.html`, `tests/helpers/cdp.js`, every other test in `tests/e2e.test.js`, `tests/mutation_check.sh`, every existing mutant body | T1 | See "F2b acceptance" below | See "F2b verify" below |
| F6b name punctuation | the `.replace` chain in `sheetOptions` (`index.html` ~`:6822-6823`, outside every engine region and the DECKS line), a new test next to Q29 in `tests/app.test.js`, new `tests/mutants/f6b_*.patch`, and the `"tests/app.test.js"` FLOORS row (`tests/suite_health.py:50`, 194 -> 195) | `src/engine/*` (`NAME_RE` stays ASCII-only), every other line of `index.html`, `tests/e2e.test.js`, `tests/mutation_check.sh`, existing mutant bodies | T3 | See "F6b acceptance" below | `node --test --test-name-pattern '^a.name.typed.with.iOS.dashes.and.ellipsis.saves,.normalised.to.ASCII$' tests/app.test.js` |

**F6b acceptance.**
1. **Test first.** New test `a name typed with iOS dashes and ellipsis saves, normalised to ASCII`, modelled on Q29 (`tests/app.test.js:1482`): name `KURD – LOW — PAN…` (U+2013, U+2014, U+2026) saves as `KURD - LOW - PAN...` in the chip row and in storage after a re-boot. It fails before the fix.
2. **Fix:** extend the chain with `.replace(/[–—]/g, "-").replace(/…/g, "...")`, and extend the comment above it by one clause. Nothing else in `sheetOptions` changes. Length: `...` can push a 38-40 char name over the 40 cap; that refusal is correct and stays.
3. **Mutant** `tests/mutants/f6b_name_dash_not_normalised.patch` drops the dash replace; header `# kills:` the new test name, `# suite:` with `.` wildcards (memory: mutant-suite-headers-are-word-split). It must be killed locally.
4. **Stale check:** `git apply --check` on every `tests/mutants/*.patch` whose target is `index.html`. `d_add_keeps_edit_seed` and `d_edit_not_prefilled` anchor near `nameBox.value` but not on the replaced line; a context-only refresh of either is granted if needed.
5. **Parity:** run `python3 tools/validate.py` (check 4 must pass; no engine region is touched).
6. **FLOORS** row `tests/app.test.js` rises to 195.

**F2b acceptance.**
1. **Keep the test name byte for byte.** The headers of `e_swipe_deadzone_dropped` and `e_swipe_direction_inverted`'s neighbours select by name.
2. **Acknowledge every swipe before reading the counter.** After `freshLoad()`, install a test-side one-shot counter via `b.eval`: a passive `touchend` listener on `#card`, registered AFTER the app's own listener, that increments `window.__swipeAck`. Same target, later registration, so it runs after the app's handler, and `step()` renders synchronously (`index.html:7509-7512`). After swipe k, `b.waitFor("window.__swipeAck === k")`, then read `#count` ONCE with an exact comparison (no `expectCount` polling). This proves both delivery and ordering; a dropped touch sequence fails the ack wait instead of passing vacuously. No click barrier, no double-rAF (eng-review E1, outside voice O1/O2).
3. **Keep both sub-threshold directions.** -50 (ack, exact `1 / n`), +50 (ack, exact `1 / n`), then -120 (ack, exact `2 / n`). With a per-swipe ack and exact read, the -50/+50 pair cannot cancel out: the mutant fails at the first read. Dropping the +50 would lose right-hand deadzone coverage (outside voice O4).
4. **Replace the two contradictory comments** (`:469-473`, `:486-490`) with one accurate sentence: `b.swipe` resolves when CDP accepts the events, which for passive listeners is before the page handles them, hence the ack. Keep the `#next`/`#prev` harness sentinel as is.
5. **Show the kill is timing-independent, not just repeated.** With `e_swipe_deadzone_dropped` applied, the test must fail, and its failure message must be the -50 exact read (not a timeout further down). Run mutated and unmutated 5x each locally as a smoke test only; local repetition is not race evidence (the old test was also 4/4 locally). The evidence is the ack-before-read construction plus the CI mutation job at the head SHA (§5).
6. **Leave the FLOORS row unchanged** unless the lane adds a test. It never goes down.

**F2b verify.**
```
export CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; node --test --test-name-pattern '^a.swipe.shorter.than.the.threshold.does.not.navigate$' tests/e2e.test.js
```
Run it with `e_swipe_deadzone_dropped` applied and without. The evidence is CI `validate` 5/5 at the head SHA, with the mutation gate killing `e_swipe_deadzone_dropped`.

- **Mutant prefix:** `f2b_`. There are no existing `f2b_` patches (`f2_` holds 2). A new patch is needed only if the barrier introduces a new failure mode. The existing `e_swipe_deadzone_dropped` is the lane's killing mutant.
- **FLOORS:** the lane owns only the `tests/e2e.test.js` row.
- **Patches the lane's edit may stale:** `tests/mutants/e_listen_error_never_settles.patch`. It is the one mutant that patches `tests/e2e.test.js` itself, at a hunk anchored near `:80`. It is far from `:462`, so offset-tolerant `git apply` should still take it. **Grant:** a context-only refresh of that patch, with the body unchanged, if `git apply --check` fails after the edit. Nothing else anchors on `tests/e2e.test.js`, and the lane does not touch `cdp.js`, so the 3 cdp-anchored patches (`e_launch_failure_orphans`, `e_launch_retry_swallows_real_failure`, `e_reap_ignores_signals`) are not at risk. Before pushing, run `git apply --check` on each of the 4 patches.

## §4 Order and dependencies

- F2b and F6b own disjoint files and both start at `6f341ab`; they run in parallel worktrees and merge in either order.
- Item 1 (T4) **does not need owner sign-off**. It is DROP, and no product change ships (N11, N12). It would need sign-off only if someone reopened it as a decoder change to `src/engine/share.js`. That change would re-inline the engine region (`tools/inline_engine.py`) and touch shipped bytes.
- The DEFER row (T2) has its own trigger. If it fires, the lane that owns the triggering edit also owns T2.
- F6b edits `index.html` but not the lines T13 names (`:5624-5627`); T13 stays with a future lane (no scope widening).
- T13 and T16 wait for the next lane that already owns those lines (N11, N13).

## §5 Merge gates

The gates are quality-eval §6 gates 1-4, unchanged, with these deltas:

1. **Gate 1:** on top of the 5/5 green result, the mutation-gate job at the head SHA must list `e_swipe_deadzone_dropped` as killed. A green run that skipped it is not evidence.
2. **Gate 3 does not apply to this lane's own target.** If `e_swipe_deadzone_dropped` survives at the head SHA, that is a lane failure, not a flake to re-run. Other lone survivors are re-run once, as usual.
3. **Reviewer brief:** the reviewer gets this plan's T1/T3 rows and the lane's acceptance criteria. For F2b it checks that every `#count` read after a swipe follows that swipe's ack and is exact, not polled. For F6b it checks the diff inside `index.html` is confined to the `.replace` chain and its comment.
4. **F6b gate 1:** the mutation job must list `f6b_name_dash_not_normalised` as killed.

## §6 Owner decisions

None needed. The items that could have been owner questions resolve under standing decisions:

| Item | Resolves under |
|---|---|
| T7 | D3 |
| T14 | D7 |
| T18 | D2 |
| T4 | N12 |

If the owner wants the decoder hardened anyway (T4), that is a new product change, with a recommended default of **no**.

**Counts:** FIX 2 / OWNER 0 / DEFER 1 / DROP 29 / STALE 0 (after eng-review; the triage draft had FIX 1 / DEFER 2)

## Cycle state (/swarm, main agent is the sole writer)

Cycle: 1   Wave: 1   Base: 6f341ab   Merged this batch: 819e067 (#150), c414b25 (#149). Workstream goal met.
Standing merge auth: AFK grant (CI 5/5 at verified head + reviewer PASS/PASS_WITH_NITS at same SHA). Cost: 2 lanes -> ~4 subagent runs, ~2 CI runs, +1 reviewer and +1 CI per bounce.

| Lane | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|
| F2b | agent a6c0f17f (returned done) | claude/fu-f2b-swipe-ack | #149 | eb2a807 | CI 5/5 (408/408), e_swipe_deadzone_dropped killed | PASS_WITH_NITS | 1 | yes (c414b25) | - | released |
| F6b | agent aef18a82 (returned done) | claude/fu-f6b-name-dashes | #150 | 5a07bf4 | CI 5/5, f6b_name_dash_not_normalised killed | PASS_WITH_NITS | 0 | yes (819e067) | - | released |

## Review log

| PR | Lane | Reviewer verdict | Findings | Outcome |
|---|---|---|---|---|
| #149 @dfe9b30 | F2b | FAIL | Acc. 4 unmet: Q27 and N1 comments kept, contradict new one ("dispatched synchronously"). Nits: ack proves touchend reached #card, not app action (-120 read is the guard); exact reads rely on sync step(); 91 not 6 e_* patches. Mechanism, mutant kill, ownership all PASS. | Bounced to lane, attempt 1 |
| #150 @5a07bf4 | F6b | PASS_WITH_NITS | d_degrees_ignored refresh verified context-only (409/409 killed). Nits: (1) a name of 38-39 chars containing U+2026 expands past the 40 cap and is refused with a misleading BAD_NOTE - not a regression (all U+2026 names were refused before), fix needs a cap change outside N11 -> follow-up; (2) `--` saves as single `-`, to spec; (3) name box shows the glyph until reopen, cosmetic. | Merged 819e067, worktree + branch released |
| #149 @eb2a807 | F2b | PASS_WITH_NITS (fresh reviewer) | Fix commit verified comment-only; all 6 acceptance PASS; mutant fails at -50 read 3/3. Nit: comment cites `index.html ~:7509` for step(); naming the function would not drift. | Merged c414b25, worktree + branch released |

## Eng review (2026-09-27, /plan-eng-review)

**Step 0, scope.** Two lanes, three files of product/test code, no new abstractions. Accepted after the E3 addition; no complexity gate fires.

**Findings.**

| ID | Section | Finding | Disposition |
|---|---|---|---|
| E1 | Tests | F2b's barrier options were unsound. `b.click("#next")` proves ordering only for touches that were delivered; a dropped touch sequence followed by a good click still passes the negative reads. A double-rAF proves two frames ran, not that `touchend` arrived. | Applied: per-swipe test-side `touchend` ack (F2b acceptance 2) |
| E2 | Tests | Acceptance 5 (5/5 local) cannot evidence a race that the old test also won 4/4 locally. | Applied: local runs relabelled smoke; evidence is the ack construction, the failure landing on the -50 read, and CI's mutation job at the head SHA |
| E3 | Scope | T3 is reachable in normal use (iOS `--` and `...` in a scale name) and cheap; the triage's own weighting rule 1 makes it FIX. The draft's "en dash" wording was also wrong. | Applied: T3 -> FIX, new lane F6b, N11 amended for one line |
| E4 | Tests | The draft acceptance example (-50, -120) dropped the +50 right-hand check. | Applied: both directions kept (F2b acceptance 3) |

Architecture: no issues (test-only lane plus a one-line normalisation beside an existing one). Code quality: E1. Performance: none (one extra listener in a test; two regex replaces on a <=40-char string).

**Coverage diagram (after the lanes).**
```
touchend handler (index.html card listener)
  |dx| <= 55, leftward   -> -50 swipe, ack, exact 1/n      [F2b]  kills e_swipe_deadzone_dropped
  |dx| <= 55, rightward  -> +50 swipe, ack, exact 1/n      [F2b]
  |dx| >  55             -> -120 swipe, ack, exact 2/n     [F2b]  + existing 60px / wrap tests
  direction              -> existing e_swipe_direction_inverted
sheetOptions name
  ' "  curly quotes      -> Q29 test (existing)
  – — …  dashes/ellipsis -> new F6b test                   kills f6b_name_dash_not_normalised
  other non-ASCII        -> BAD_NOTE refusal (unchanged, by design)
```

**Failure modes.** Dropped synthetic touch: F2b ack wait times out (loud). A 38-40 char name with `...` exceeds 40: correct BAD_NOTE refusal (loud, pre-existing rule). No critical gaps (none untested, unhandled and silent).

**NOT in scope.** T2 (Q16 units; trigger unchanged). T13 openShare comment (not on F6b's lines). Normalising any other non-ASCII in names (NAME_RE policy is the engine's). Hardening `b.swipe` in `cdp.js` itself (the ack lives in the one test; a helper change would touch 3 cdp-anchored mutants for no second caller).

**What already exists.** Q29's quote normalisation and test (F6b extends both, rebuilds nothing). The `#next`/`#prev` harness sentinel and the -120 positive check (kept). `b.waitFor` (used for the ack).

**Parallelization.** Lane F2b: `tests/e2e.test.js` (independent). Lane F6b: `index.html` + `tests/app.test.js` + `tests/suite_health.py` app row (independent). Launch both; merge in either order. Shared file: `tests/suite_health.py`, different rows; a textual conflict is resolved by keeping both rows.

**Outside voice:** codex (`codex exec`, read-only), completed. O1-O5 were all accepted: O1/O2 -> E1, O3 -> E2, O4 -> E4, O5 -> E3. No cross-model disagreement remained.

## Implementation Tasks

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** — tests/e2e.test.js — ack each swipe before an exact counter read
  - Surfaced by: E1, E2, E4
  - Files: `tests/e2e.test.js`
  - Verify: F2b verify command, with and without `e_swipe_deadzone_dropped`
- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — index.html sheetOptions — normalise U+2013/2014/2026 in scale names
  - Surfaced by: E3
  - Files: `index.html`, `tests/app.test.js`, `tests/mutants/f6b_name_dash_not_normalised.patch`, `tests/suite_health.py`
  - Verify: F6b verify command, `python3 tools/validate.py`

## Decision ledger

AFK mode is armed, so each choice below was auto-decided on the recommended option and is listed for the owner.

| ID | Decision | Answer | Basis |
|---|---|---|---|
| A1 | gstack upgrade prompt | Not now (snoozed) | AFK, conservative |
| A2 | /office-hours prerequisite | Skipped | AFK; a triage plan, not a feature |
| A3 | E1 barrier | Per-swipe test-side ack | AFK, recommended; outside voice agrees |
| A4 | E2 evidence | Local runs are smoke only; CI mutation job is the evidence | AFK, recommended |
| A5 | E3 scope: T3 | Include as lane F6b (FIX) | AFK, recommended; follows the triage's own rule 1; not destructive |
| A6 | E4 | Keep +50 check | AFK, recommended |
| A7 | TODOS.md | None proposed; the repo tracks follow-ups in coordination docs, and the DEFER row carries its trigger here | AFK |

Approval readiness: PASS (E1->A3, E2->A4, E3->A5, E4->A6).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex via `/plan-eng-review` | Independent 2nd opinion | 1 | completed | 5 findings, all accepted |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN (resolved in plan) | 4 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review phase, completed, 5 findings (all folded into E1-E4).
- **VERDICT:** Eng review found 4 issues, all applied to the plan; no open decisions. Ready to execute via /swarm (2 lanes).

NO UNRESOLVED DECISIONS
