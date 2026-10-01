# Post-refactor triage (2026-10-01)

Every open item, checked against origin/main **aff9fd1**. Each label comes from
reading the code or running a single targeted test; doc wording alone decided
nothing. Line numbers are at aff9fd1.

## Sources

1. `docs/plans/2026-09-30-nit-queue.md`: the OPEN rows. The brief named Q17-Q30,
   but Q31-Q35 are also OPEN, so they are included.
2. `docs/plans/2026-09-30-quality-refactor-coordination.md`, "Queue rows to
   file": rows P (#178), M (#179), T (#183), F (#184), B (#185), C (#182),
   A (#188) and E (#190). It also includes the #180 and #186 rows, which sit in
   the same section.
3. `gh pr list --state open` and `gh issue list --state open`: both return
   **empty**.
4. Unqueued smells, each shown at file:line (ids S1-S4).

Out of scope by owner instruction (2026-09-30): audio, stats, SM-2 and PWA.
Q19, Q20 and Q25 are closed on that basis. The quality-refactor owner gates
G1, G3 and G5 are still unanswered. They are not sources here, so they are not
re-asked.

## Counts

80 rows. Q28 is counted as FIX; its CLOSE part is not counted. Duplicates are
merged into one row each: M179-3 = T183-4, E190-4 + S3, and D180-8 into Q29.

| Label | Count |
|---|---|
| FIX | 37 (6 of them cosmetic) |
| CLOSE | 21 |
| DEFER | 20 |
| ASK-OWNER | 2 |

## Classification

### Nit queue

| id | Claim | Evidence | Label | Reason |
|---|---|---|---|---|
| Q17 | AD8 ("parallel") contradicts lane S sequencing | `docs/plans/2026-09-30-nit-touchup.md:35` vs `:313-327` | CLOSE | Historical record of a merged plan; rewriting it buys nothing |
| Q18 | `r1_print_ios` hunk shared with another mutant | No other patch touches `isIOS` (`index.html:6533`); `git apply --check` passes | CLOSE | The "sharing" was between two lanes, and both have merged |
| Q19 | Go-signals in the parked audio plan | `docs/plans/2026-09-30-audio-arpeggio.md:1-3` is headed "Parked" | CLOSE | Audio is out of scope by owner instruction |
| Q20 | Dangling "roadmap item N" references | `docs/SCALE_ENGINE_PLAN.md:174,759`, `scale-engine-coordination.md:703,1448`, `tests/helpers/cdp.js:410` | CLOSE | All of them point at untracked ideas, which are out of scope |
| Q21 | The Q15 CDP test needs a closing `mouseReleased` | `tests/e2e.test.js:8398` sends it (143414e) | CLOSE | Already fixed |
| Q22 | `mutation_harness` childEnv comment gives the wrong reason | `tests/mutation_harness.test.js:47-48` | FIX | Wrong rationale |
| Q23 | `staleMutants` calls a deletion-only patch stale | `mutation_harness.test.js:504-511`; `grep -l '^+++ /dev/null' tests/mutants/*.patch` finds 0 | DEFER | Reopen when the first file-deleting mutant is added |
| Q24 | The HEAD-diff check masks stale patches mid-sweep | `mutation_harness.test.js:597-605`; CI also runs it on a clean tree (`validate.yml:90`) | CLOSE | The clean-tree CI run catches it |
| Q25 | backlog §7 says "four roadmap items" | `2026-09-29-backlog-and-refactor.md:371`; the ideas note is already at `:159,287,317` | CLOSE | Ideas topic, and the doc already says it three times |
| Q26 | The `mutation_harness` floor is 18 while 21 tests run | `tests/suite_health.py:64` is now 43; 45 tests run | CLOSE | Lane C (#182) superseded it |
| Q27 | Out-of-plan edits in #173 | Informational | CLOSE | Nothing to do |
| Q28 | `armTransitionRun` double listener; loose print-block rationale; "Literal basenames" | "Literal basenames" is gone (8eb7fac). `armTransitionRun` lives in `e2e.test.js:9049-9070` and asserts `=== 0`. The rationale is backwards at `index.html:962-966` and `test_render_agreement.py:564-568` | FIX (comment); CLOSE (rest) | The cascade reason is inverted. The listener part cannot hide a failure |
| Q29 | The mouse-drag "spring-back must not flip" test flakes | Lane E (#190): `e2e.test.js:7786-7806` uses `settle()` and logs a diagnosis; 3 green reruns at 8e8bbb5 | CLOSE | Fixed. Reopen on the next CI failure, which now explains itself |
| Q30 | Stale eatClick comment in `release()` | `index.html:8231-8238` matches the code at `:8239` (4e7d715) | CLOSE | Already fixed |
| Q31 | The `sw_eatclick_armed_on_cancel` header says "stuck true" | The mutant still schedules a decay (`index.html:8159-8164`) | FIX | The header describes the wrong failure mode |
| Q32 | The e2e eatClick comment is contradicted by the code | Rewritten in d763e2b; accurate at `e2e.test.js:7833-7846` | CLOSE | Already fixed |
| Q33 | No mutant drops the eatClick decay | Only `sw_eatclick_armed_on_cancel` and `sw_mouse_decay_too_long` touch the decay; the timer branch at `index.html:8162-8164` is unmutated. The killer exists at `e2e.test.js:7950` | FIX | A gap on a path users would feel |
| Q34 | No test asserts `#card`'s computed touch-action | Only `main` and `.scene` are asserted (`e2e.test.js:7604,7615-7620`); the comment at `index.html:468-476` says the rule is inert | DEFER | Reopen if `#card` leaves `.scene`/`main` |
| Q35 | `sw_pinch_zoom_blocked` is misnamed | It mutates `.scene{touch-action}` to `pan-y` | FIX (cosmetic) | The name misleads anyone triaging a survivor |

### Coordination doc: P, M, T, F, B and C

| id | Claim | Evidence | Label | Reason |
|---|---|---|---|---|
| P/N1 | The floor comment names Amara shop 676 as the smallest case | `tests/test_pdf_parity.py:63-65`; measured Hijaz shop = 524 | FIX | Wrong; the real headroom is 24, not 176 |
| P/N2 | "2-field instrument" | `test_pdf_parity.py:62`; the seed is a ding plus 4 notes | FIX | Wrong comment |
| P/N3 | `test_the_sweep_actually_ran` does not pin the no-thirds seed | `test_pdf_parity.py:227-236`; the seed is at `:43-45` | FIX | It is the only NO_THIRDS badge coverage, and dropping it stays green |
| M-1 | `f_fixture_sha` is a non-unique-anchor exception, and its rationale is wrong | `mutation_harness.test.js:966-978`; the patch targets `golden_decks_v4.json`, not `mutation_check.sh` | FIX | Re-anchor it and empty the list. The `nowFixed` guard forces that edit |
| M-2 | `refresh_mutants` anchors on removed lines only | `tools/refresh_mutants.py:186-197` | DEFER | By design (-U0), and each refresh diff is reviewed. Reopen when a refresh relocates a mutant across functions |
| M-3 | The refusal lists every target, not just the dirty ones | `refresh_mutants.py:303-306` | FIX | It sends the user hunting for clean files |
| M-4 | `git diff` runs without `--no-color --no-ext-diff` | `refresh_mutants.py:273` | FIX | A user's `diff.external` or `color.diff=always` writes a corrupt patch |
| M-5 | `--check` is not in CI | `.github/workflows/validate.yml:28` runs it | CLOSE | Already wired |
| M179-1 | `parse_chunks` loops on an unknown hunk-line prefix | `refresh_mutants.py:140-158`; `timeout 5 python3 -c "...parse_chunks([' a','xbogus','-b'])"` gives `exit=124` | FIX | One malformed patch hangs the `--check` CI step |
| M179-2 | The `-U8` comment is wrong | `mutation_harness.test.js:415` says "3-line"; `regen_data_mutants.py:250` uses `-U8` | FIX | Wrong comment. Not a duplicate of Q22 |
| M179-3 = T183-4 | `sync_decks.main()` duplicates `inject()` | `tools/sync_decks.py:89-100` vs `:34-61` | FIX | Two injection paths for the generated DECKS line |
| M179-4 | The dirty check misses staged-only edits | `refresh_mutants.py:303` and `regen_data_mutants.py:243` both use `git diff --quiet --` | FIX | A staged edit gets baked into the mutant body |
| M179-5 | The regen-in-worktree test lacks a git guard | `mutation_harness.test.js:454-461` | CLOSE | Cut: every runner is a git checkout, so a guard buys nothing |
| M179-6 | A missing target file gives a traceback | `refresh_mutants.py:226`; `main()` catches only Ambiguous/Unfixable (`:310-322`) | FIX | Should report UNFIXABLE |
| M179-7 | Two `diff --git` sections for one file lose the first splice | `refresh_mutants.py:256-271`; a scan of 519 patches finds 0 such patches | DEFER | Reopen at the first patch with two sections for the same file |
| M179-8 | No fixtures for the lint's bare-blank line or the pure-insertion path | The lint at `mutation_harness.test.js:519-580` has none; 33 patches are pure insertions | FIX | Untested path used by 33 patches |
| T183-1 | The stale half of `_diff_refs` is untested | `tests/test_readme_currency.py:358-383` only ever asserts `stale == []` | FIX | A ratchet that cannot fail on stale entries |
| T183-2 | `import validate` stubs `sys.modules["hifi"]` | `tools/validate.py:24`; worked around in `test_failure_diagnosability.py:35-50` | DEFER | Reopen when a second module imports validate |
| T183-3 | `run_check` catches only AssertionError | `validate.py:54` | FIX | A KeyError stops the remaining checks, which is the failure mode finding 15 was about |
| F184-1 | Fixed e2e ports race | Grepping for 8099, 8079 and 8128 finds nothing; `e2e.test.js:28` uses port 0 | CLOSE | Already ephemeral |
| F184-2 | The fly-out is matched by duration 220 | `e2e.test.js:299,315,7920`; `index.html:8133` | DEFER | It fails loudly. Reopen if `SWIPE_OUT_MS` is retuned |
| B185-1 | Dedupe gaps remain | `voicing.js:35-37`, `select.js:84`/`voicing.js:62`, `sequence.js:30`, `pdfcards.js:439-448` | DEFER | Cut: an engine sync plus mutant refreshes for no behaviour change. Reopen in the next lane that touches those modules |
| B185-2 | The `qb_core_pc_no_wrap` header claims voicing inherits the bug | `voicing.js:36` keeps its own copy | FIX | Wrong mutant header |
| B185-3 | The `core.test.js` floor is 42, but 49 tests run | `tests/suite_health.py:55`; `node --test --test-reporter=tap tests/core.test.js` prints `# tests 49` | FIX | 7 tests can vanish unnoticed |
| B185-4 | voicing's BAD_NOTE `<X>` substitution is untested | `voicing.test.js:571-572` checks only for a non-empty reason; the substitution is at `voicing.js:51-54` | FIX | A literal `<X>` survives |
| C182-1 | `.get(...,0)` defaults fail open | `suite_health.py` `verify_js`, `cancelled`/`returncode` | FIX | A partial artifact reads green |
| C182-2 | Shard headroom | Longest shard 5m33s against a 6 min target | DEFER | Reopen when the longest shard exceeds 6:00 (see the R1 risk below) |
| C182-3 | An unexpected success is not named in the log | `suite_health.py:169-171`; no real `@expectedFailure` exists | DEFER | Reopen at the first `@expectedFailure` |
| C182-4 | The python excerpt is shorter than the old `-v` | `suite_health.py:141,201-208` | DEFER | Reopen on the first CI failure that cannot be diagnosed from the log |
| C182-5 | The MUTANT_SHARD dirty check is shard-only | `tests/mutation_check.sh:150-157` | DEFER | Local-only. Reopen when someone runs local sharded sweeps |
| C182-6 | The `collect_js` error string is unbounded | `suite_health.py` `collect_js`/`emit_js` | FIX | One bad file can flood the CI log; use `excerpt()` |
| C182-7 | Redundant aggregate floors | `suite_health.py:77-96` | CLOSE | Cut: harmless, and removing them means a CONTRACT change |

### Coordination doc: #180, #186, A and E

| id | Claim | Evidence | Label | Reason |
|---|---|---|---|---|
| D180-1 | Settle logic is triplicated, and e2e writes `b._pendingSettle` | `cdp.js:319-361`, `e2e.test.js:8536-8566,8615-8648` | DEFER | Cut: refactoring the mouse-drag harness, which only just stopped flaking, costs more than the duplication. Reopen at the next change to mouse settle |
| D180-2 | A mouse settle always takes the 1 s timeout | Probe: about 1030 ms mouse vs 33 ms touch; 2 call sites | DEFER | Reopen if the number of mouse `drag()` sites grows or a shard nears 6 min |
| D180-3 | The re-press retry's release click flips the card | `e2e.test.js:8502`; masked because `step()` resets `flipped` (`index.html:7944`) | DEFER | Reopen if a `startMouseDrag` test asserts flip state without stepping |
| D180-4 | The re-press log never shows in CI | `e2e.test.js:8510` is gated on `E2E_LOG_REPRESS`, which nothing sets | FIX | The retry rate is invisible, and it is the flake signal |
| D180-5 | Wheel and drag spring-backs can overlap | `index.html:8287,8321-8331,8340` | DEFER | Needs a simultaneous scroll and drag. Reopen on an owner report |
| D180-6 | The desktop-swipe plan's mutants were never committed | `docs/plans/2026-09-30-desktop-swipe.md:110-112`; nothing mutates `WHEEL_COMMIT_PX`, the 400 to 0 decay, or `clearTimeout(eatClickTimer)` | FIX | Three unguarded constants or paths |
| D180-7 | The click-capture `land()` cuts the mouse fly-out | `index.html:8393-8395` calls `land()` before the eatClick check; probe: `flight===null` right after a mouse release | ASK-OWNER | User-visible on desktop: a mouse swipe never shows the 220 ms fly-out. Q14 called this informational before #180 made mouse a supported path |
| D180-8 | The main-side mouse-drag test flakes | Same test as Q29 | CLOSE | Duplicate of Q29, which is fixed |
| R186-1 | The 1024x700 test asserts horizontal overflow only | `e2e.test.js:1546-1576` reads `scrollH` but never asserts on it | FIX | A vertical-scroll regression passes |
| R186-2 | The planned wrong-href, noopener and landscape mutants are missing | `docs/plans/2026-10-01-resources-menu.md:85-86,133`; the killers exist at `e2e.test.js:1436,1505` | FIX | Unguarded link attributes (noopener is a safety property) |
| R186-3 | The Tab-trap loop has a fixed 12 presses | `e2e.test.js:1301`; `panelStops()` (`index.html:7993`) includes the trigger, so 12 presses close a 12-stop cycle exactly | FIX (cosmetic) | Not a current defect (eng review, OV-5). Future-proofing: the next added stop gives a loud false red |
| R186-4 | Backward Tab is covered only via the wrap | A full reverse cycle runs at `e2e.test.js:7026` (`cycleTabStops`, `index.html:7912`) | CLOSE | Already covered |
| R186-5 | Resources labels wrap at 320px | Probe: "DING & TONES" and "TRAINING CARDS" take two lines; "TRAINING CARDS" also wraps at 380px | ASK-OWNER | Visual-system call |
| A188-1 | `render()` duplicates the A/B counter tail | `index.html:6773-6774` and the B branch below it | FIX (cosmetic) | Done together with A188-2, which needs the same lines |
| A188-2 | Dropping B's `classList.remove("seq")` survives | `app.test.js:4243-4252` checks `#foot`, never `#count` | FIX | S then B would leave `.count.seq` styling, with no test to catch it |
| A188-3 | A comment points at "CLAUDE.md G5" | `index.html:7956`; G5 is in `2026-09-30-quality-refactor.md:97` | FIX | Wrong pointer |
| A188-4 | `opBudget` counts `voicing.choose` only | `app.test.js:734-751`; `layout.js:206` `solve()` is closed-form | DEFER | Reopen if `solve` gains a search step |
| A188-5 | The PR body omits the 22 edited mutants | Merged #188 | CLOSE | Only affects the historical PR text |
| E190-1 | `doesNotMatch survived` is vacuous | `mutation_harness.test.js:268` also asserts `skipped`; it passes | CLOSE | Redundant, not vacuous |
| E190-2 | The `shard_mutants.js` header says e2e-only and "161 of 477" | `tests/shard_mutants.js:6-13`, `mutation_harness.test.js:1259`; actual count is 183 of 519 by `isE2ESelecting` | FIX | Wrong doc |
| E190-3 | Two finally comments say "rest of this test" | `e2e.test.js:8200,8246` | FIX | Both blocks guard the next test |
| E190-4 + S3 | `withViewport` has no callers; a comment says to use it | Defined at `e2e.test.js:239`; the comment is at `:216-221` | FIX (cosmetic) | Dead helper that a comment advertises |
| E190-5 | Duplicate touch-point literals | `cdp.js:256,276` | DEFER | Reopen if the touch-point shape changes |
| E190-6 | The print-spy parameter is named `variant` | `e2e.test.js:1040`, read as `.variant` at `:1060` | FIX (cosmetic) | Misleading name |
| E190-7 | The settle() self-tests skip without a browser | `harness.test.js:20-28` | DEFER | CI always has a browser, and moving the tests changes FLOORS. Reopen if `settle()` changes |
| E190-8 | settle() waits 500 ms under a persistent animation | `cdp.js:179-187`; the app has no infinite animation | DEFER | Reopen if a persistent animation is added |

### Unqueued smells

| id | Claim | Evidence | Label | Reason |
|---|---|---|---|---|
| S1 | A stale line ref "e2e:1170" | `e2e.test.js:6976`; the test is now at `:1277` | FIX | Wrong pointer. Name the test instead |
| S2 | The cdp.js "roadmap: audio" comment moved | `cdp.js:410` | CLOSE | Merged into Q20; audio is out of scope |
| S4 | The README says "477 mutant patches", but there are 519 | `README.md:127`; `ls tests/mutants/*.patch \| wc -l` gives 519; the test tolerates 90% (`test_readme_currency.py:119`) | DEFER | The tolerance is by design. Reopen when `test_readme_currency` fails |

(S3 is merged into E190-4. `shareLink`, which has no callers, was already kept by quality-eval D3, so it is not new.)

## ASK-OWNER

1. **D180-7. Should a desktop mouse swipe show the fly-out animation?** Today
   the trailing click calls `land()` and snaps the card.
   - **Recommendation: yes.** In the capture handler at `index.html:8393-8395`,
     when `eatClick` is armed, eat the click without calling `land()`. Size S,
     split by ownership: EH adds the e2e test (fly-out still live 30 ms after a
     real mouse release), and AP changes the handler and adds one `sw_` mutant,
     merging after EH.
   - Until answered, it is not worked.
2. **R186-5. Are two-line Resources labels acceptable at 320px and 380px?**
   - **Recommendation: accept and close.** The text stays inside its 44px
     targets. A fix would mean changing the copy or the type scale, which the
     visual system governs.

## FIX ranking

No FIX item is a confirmed user-visible bug today; the only one, D180-7, is
owner-gated.

1. **Flake and CI trust:**
   - M179-1, C182-1, B185-3, M179-4, M-4, M-1, M179-6, T183-3
   - Q33, D180-6, R186-2, A188-2
   - T183-1, P/N3, B185-4, M179-8, R186-1, D180-4, C182-6, M179-3/T183-4
2. **Wrong comments and docs:**
   - P/N1, P/N2, M179-2, Q22, Q28, Q31, B185-2
   - A188-3, E190-2, E190-3, S1
3. **Cosmetic:** M-3, Q35, A188-1, E190-4, E190-6, R186-3.

**Cut,** because the fix costs more than the problem:
- M179-5: a git guard on runners that are always git checkouts.
- C182-7: needs a CONTRACT edit.
- D180-1: harness churn on a test that was flaky until #190.
- B185-1: an engine resync plus mutant refreshes for no behaviour change.

## Lanes (/swarm)

Ownership is split by file. **The mutant rule:** a lane may add, refresh or
edit a `tests/mutants/*.patch` only when every `+++ b/` target of that patch is
a file the lane owns. 341 patches target `index.html` (lane AP), 21 target
`tests/suite_health.py` (lane HF), 5 target `tests/helpers/cdp.js` (lane EH),
and 1 targets `tools/sync_decks.py` (lane MT). Patches that target lane-owned
TEST files belong to that lane too:
- `d_caller_scan_counts_lines`, `d_caller_scan_blind_to_escapes` (`tests/app.test.js`): AP
- `e_listen_error_never_settles` (`tests/e2e.test.js`): EH
- `qd_p_sweep_iterates_seeds` (`tests/test_pdf_parity.py:233`, which is exactly where P/N3 edits): HF
- `mh_reverse_apply_skip_dropped`, `mh_head_diff_guard_dropped` (`tests/mutation_harness.test.js`) and `qe_shard_forgets_harness_suite` (`tests/shard_mutants.js`): MT

Two explicit exceptions to the rule:
- `qb_core_pc_no_wrap` targets `src/engine/core.js`, which nobody owns. HF may
  edit its header lines only.
- The mixed-target patches (`b_*` and `c_deck_data_drift`, which target
  `index.html` and `data/decks.json`) may be refreshed by AP with
  `refresh_mutants.py` only. They are never hand-edited or regenerated.

Each lane runs `python3 tools/refresh_mutants.py --check` before pushing.

No lane touches `data/decks.json`, the `const DECKS` line, the engine regions,
or diagram geometry. There is no data lane, so the `b_*` patches are
regenerated by nobody. Re-running `regen_data_mutants.py` is not allowed.

All four lanes are file-disjoint, so they are dispatched in **one wave**. They
merge serially in the order **MT, HF, EH, AP**. After each merge, the next lane
rebases and reruns `--check`. AP goes last because two of its mutants
(`sw_eatclick_timer_not_cleared`, and the D180-7 one if approved) need killer
tests that EH writes. AP adds those mutants only after rebasing onto EH's merge.

### Lane MT: mutant tooling

- **Goal:** the mutant tooling cannot hang, corrupt or mislead.
- **Non-goals:** no change to mutant semantics or to `mutation_check.sh`; no new
  mutants beyond the M-1 re-anchor.
- **Owns:**
  - `tools/refresh_mutants.py`, `tools/regen_data_mutants.py`, `tools/sync_decks.py`, `tools/validate.py`
  - `tests/mutation_harness.test.js`, `tests/shard_mutants.js`, `tests/test_failure_diagnosability.py`
  - `tests/fixtures/golden_decks_v4.json`: no edit expected; owned only because `f_fixture_sha.patch` targets it
  - `tests/mutants/f_fixture_sha.patch`
  - the patches that target the files above
- **Never touches:** `index.html`, `tests/e2e.test.js`, `tests/suite_health.py`, `data/`, `src/`.
- **Steps (TDD: each test is seen red first):**
  1. M179-1 + M179-6. Add fixture tests: an unknown hunk prefix exits nonzero
     within 5 s, and a missing target reports UNFIXABLE. Then raise in
     `parse_chunks` and catch FileNotFoundError.
     - **Accept:** both tests pass, and the timeout probe returns non-124.
     - **Verify:** `node --test --test-name-pattern refresh_mutants tests/mutation_harness.test.js`
  2. M179-4 + M-3 + M-4. Add a test: a staged-only edit is refused, and the
     message lists only the dirty files. Then use `git diff --quiet HEAD --` in
     both tools, add `--no-color --no-ext-diff`, and list the dirty files.
     - **Accept:** the test passes.
     - **Verify:** same command as step 1.
  3. M179-8. Add two tests named `M179-8 lint accepts a bare blank context
     line` and `M179-8 refresh re-anchors a pure-insertion patch`. Use those
     names: the pattern `bare.blank` already matches the refresh test at
     `mutation_harness.test.js:822`, which would make a looser verify vacuous.
     - **Accept:** 2 new tests pass, and each fails against a hand-broken copy
       of its code path.
     - **Verify:** `node --test --test-reporter=tap --test-name-pattern "M179-8" tests/mutation_harness.test.js | grep '^# pass 2$'`
  4. M-1. Re-anchor `f_fixture_sha.patch` with unique context, then empty
     `KNOWN_NON_UNIQUE_ANCHORS` and fix its comment.
     - **Accept:** the list is empty, the patch still applies, and CI's mutation
       gate kills it at the head SHA. The local command does not prove the
       kill; CI does.
     - **Verify:** `node --test --test-name-pattern "non-unique anchor" tests/mutation_harness.test.js && git apply --check tests/mutants/f_fixture_sha.patch`
  5. T183-3. Add a test: a check raising KeyError is reported and the next check
     still runs. Then change `run_check` to `except Exception`.
     - **Verify:** `python3 -m unittest tests.test_failure_diagnosability`
  6. M179-3/T183-4. Make `sync_decks.main()` call `inject()`. This is a
     refactor; the existing tests are the oracle.
     - **Verify:** `python3 tools/sync_decks.py --check && python3 -m unittest tests.test_failure_diagnosability && python3 tools/validate.py`
  7. Comments: Q22 (`mutation_harness.test.js:47-48`), M179-2 (`:415`), and
     E190-2 (drop the hard-coded counts at `shard_mutants.js:6-13` and
     `mutation_harness.test.js:1259`).
     - **Verify:** `! grep -rn "161 of 477" tests && node --test tests/mutation_harness.test.js`
  8. **Verify:** `python3 tools/refresh_mutants.py --check`

### Lane HF: suite health and floors

- **Goal:** the floors and the result verification fail closed, and the weak
  assertions can fail.
- **Non-goals:** no floor lowered; no aggregate removal (C182-7 is cut).
- **Owns:**
  - `tests/suite_health.py`, `tests/test_suite_health.py`, `tests/test_pdf_parity.py`, `tests/voicing.test.js`, `tests/test_readme_currency.py`
  - `tests/mutants/qb_core_pc_no_wrap.patch` (header lines only)
  - `tests/mutants/qd_p_sweep_iterates_seeds.patch` (refresh only; P/N3 edits its anchor)
  - the 21 patches targeting `suite_health.py` (refresh only)
- **Never touches:** `tools/`, `index.html`, `tests/e2e.test.js`, `tests/mutation_harness.test.js`, `src/`.
- **Steps:**
  1. C182-1 + C182-6. Add tests in `test_suite_health.py`: an artifact missing
     `cancelled` or `returncode` fails, and a huge error string is excerpted.
     Then require the keys and wrap the string in `excerpt()`.
     - **Verify:** `python3 -m unittest tests.test_suite_health`
  2. B185-3. Raise the `core.test.js` floor from 42 to 49.
     - **Accept:** suite health passes at 49.
     - **Verify:** `node --test --test-reporter=tap tests/core.test.js | grep '^# tests'` gives 49, and `python3 -m unittest tests.test_suite_health` passes.
  3. B185-4. Assert that the reason names the pitch class and contains no
     literal `<X>`. Confirm red by hand-breaking `voicing.js:51-54` locally,
     then revert.
     - **Verify:** `node --test tests/voicing.test.js`
  4. P/N3, then P/N1 and P/N2. Make `test_the_sweep_actually_ran` require the
     no-thirds seed, and fix the comments at `:62-65` (524 Hijaz shop; 4 fields).
     - **Verify:** `python3 -m unittest tests.test_pdf_parity`
  5. T183-1. Add one synthetic stale allowlist entry and assert `stale == [it]`.
     - **Verify:** `python3 -m unittest tests.test_readme_currency`
  6. B185-2. Rewrite the header only; the body stays byte-identical.
     - **Verify:** `git apply --check tests/mutants/qb_core_pc_no_wrap.patch && ! grep -n voicing tests/mutants/qb_core_pc_no_wrap.patch`, then `python3 tools/refresh_mutants.py --check`

### Lane AP: app shell and index.html mutants

- **Goal:** close the mutant gaps on swipe, Resources and the counter; fix the
  wrong app comments.
- **Non-goals:**
  - no behaviour change, except D180-7 and only if the owner says yes
  - nothing inside the engine regions or the DECKS line
  - no label or copy changes (R186-5)
- **Owns:**
  - `index.html` (app JS and CSS only)
  - `tests/app.test.js`
  - `tests/test_render_agreement.py`: the docstring at `:564-568` only
  - `tests/fixtures/card_face_v1.json`: regenerate only if the check demands it, and it must not
  - every `tests/mutants/*.patch` whose targets are only `index.html` and/or `tests/app.test.js`
  - refreshing the `b_*` and `c_deck_data_drift` patches, with `refresh_mutants.py` only
- **Never touches:** `tests/e2e.test.js`, `tests/helpers/`, `tools/`, `data/`, `src/`.
- **Steps:**
  1. A188-2, then A188-1. Add an `app.test.js` case: after S then B, `#count`
     lacks `.seq` (red under a hand-dropped `remove`). Then hoist the shared
     counter tail once, and add `qa_count_seq_kept_in_b.patch`.
     - **Accept:** the card faces stay byte-identical.
     - **Verify:** `node --test tests/app.test.js && node tools/regen_card_fixture.js --check`
  2. Q33 + D180-6. Add these mutants, all killed by existing e2e tests:
     `sw_eatclick_decay_dropped`, `sw_wheel_commit_threshold`,
     `sw_mouse_decay_zero`, `sw_eatclick_timer_not_cleared`. Each `# suite:`
     line uses `.` wildcards, not quotes. `sw_eatclick_timer_not_cleared` has
     NO killer today: `e2e.test.js:8754` asserts only that the handle is null,
     and `setEatClick` (`index.html:8160`) nulls it separately from
     `clearTimeout`. Add that mutant only after rebasing onto EH's step 5.
     - **Accept:** each applies, and CI's mutation gate kills each one.
     - **Verify:** `for p in tests/mutants/sw_{eatclick_decay_dropped,wheel_commit_threshold,mouse_decay_zero,eatclick_timer_not_cleared}.patch; do git apply --check $p; done`. Locally, kill one with a single `--test-name-pattern` e2e test. CI is the oracle.
  3. R186-2. Add `qr_res_wrong_href`, `qr_res_no_noopener` and
     `qr_res_hidden_landscape`.
     - **Accept / Verify:** as in step 2.
  4. Q31. Rewrite the header only: the click is eaten within the decay window.
     Q35. `git mv` to `sw_scene_touch_action_loosened.patch`, keeping the body
     byte-identical.
     - **Verify:** `git apply --check` on both, and `python3 -m unittest tests.test_readme_currency`
  5. Q28. Fix the cascade rationale at `index.html:962-966` and
     `test_render_agreement.py:564-568`, leaving the `:960` heading line alone.
     A188-3. Repoint the comment at `index.html:7956`.
     - **Verify:** `python3 -m unittest tests.test_render_agreement && python3 tools/validate.py && ! grep -n "CLAUDE.md G5" index.html`
  6. **Verify:** `python3 tools/refresh_mutants.py --check && python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check`
- **Lane risk R1.** Steps 2 and 3 add 7 e2e-selecting mutants. The longest
  shard is 5m33s against the 6 min target, and 7 more mutants is about 2 per
  shard. AP reports the per-shard wall-clock at its head SHA. If any shard
  exceeds 6:00, the C182-2 trigger fires; that is recorded and does not block
  the merge (the 6 min target belongs to the closed workstream).

### Lane EH: e2e harness

- **Goal:** the e2e tests assert what they claim, and the harness comments are
  true.
- **Non-goals:**
  - no settle refactor (D180-1 is cut)
  - no migration of the 100 hand-rolled viewport restores
  - no test renames, so the mutant `# suite:` patterns keep matching
- **Owns:**
  - `tests/e2e.test.js`, `tests/helpers/cdp.js`
  - the 5 patches targeting `cdp.js` and `e_listen_error_never_settles.patch` (refresh only)
- **Never touches:** `index.html`, `tests/mutants/*` (except those 6), `tests/suite_health.py`, `tools/`.
- **Steps:**
  1. R186-1. Add a NEW test, `the desktop sidebar at 1024x700 gains no new
     VERTICAL scroll ...`, asserting `scrollH <= clientH + 1` in modes A, B and
     S. The existing test is named "HORIZONTAL", and renames are a non-goal.
     - **Verify:** `node --test --test-name-pattern 'desktop.sidebar.at.1024x700' tests/e2e.test.js` (needs CHROME_BIN; 2 tests run)
  2. R186-3. Read the bound from `panelStops().length + 1` through `b.eval`.
     - **Verify:** `node --test --test-name-pattern 'Tab.is.trapped.inside.the.settings' tests/e2e.test.js`
  3. D180-4. Log the re-press count to stderr unconditionally.
     - **Verify:** `! grep -n E2E_LOG_REPRESS tests/e2e.test.js`
  4. Comments and dead code: E190-3 (`:8200,8246`), S1 (`:6976`), E190-4/S3
     (delete `withViewport` at `:239` and the comment at `:216-221`), and
     E190-6 (rename the parameter to `opts`).
     - **Verify:** `! grep -nE "withViewport|rest of this test|e2e:1170" tests/e2e.test.js && node --check tests/e2e.test.js`, then `python3 tools/refresh_mutants.py --check`
  5. Killer for AP's `sw_eatclick_timer_not_cleared`. Add a test: release, then
     re-arm `eatClick` via a second release inside the first decay window, and
     wait past the FIRST decay. `eatClick` must still be armed. It passes on
     main now, and is red when `clearTimeout` is dropped by hand locally.
     If the owner approves D180-7, EH also adds its fly-out test here.
     - **Verify:** run the new test alone with `--test-name-pattern`
- **CI is the oracle for the full e2e suite.** Run only single tests locally.

## Standing gates

- CI is green at the **verified head SHA**: `gh pr view <n> --json state,headRefOid`
  matches the local tip. A lone survivor on an unrelated mutant is rerun at the
  same SHA first.
- A fresh `swarm-reviewer` returns PASS or PASS_WITH_NITS at that SHA, briefed
  with the lane's goal, non-goals, ownership and acceptance criteria.
- **Bounce cap 2** per lane, with one counter for every retry path.
- Merge is operator-gated unless AFK is armed. AFK is armed per memory, so
  `gh pr merge <n> --merge` is allowed once both gates hold.
- Never run the full `mutation_check.sh` or the full e2e suite locally.

## Close-out

After the last lane merges, one docs PR updates the queues:
- `2026-09-30-nit-queue.md`: Q17-Q35 rows get CLOSED, RESOLVED (#PR) or
  DEFERRED (trigger).
- The coordination doc's "Queue rows to file": each row points here.

## Projected cost

| | Count |
|---|---|
| Lanes | 4 (MT, HF, AP, EH) plus 1 close-out docs PR |
| Subagent runs | 4 lane runs, 5 reviewers, and about 3 expected bounces (each a lane run plus a reviewer): about 15 |
| CI runs | About 2 per lane plus 1 docs, plus about 3 flake reruns: about 12 |

D180-7, if approved, adds one bounce-free step to AP: one extra CI run.

## Auto-decisions

- Q31-Q35 are included although the brief named Q17-Q30; they are OPEN rows of
  the same queue.
- The #180 and #186 rows are included because they sit under "Queue rows to
  file".
- Cuts (M179-5, C182-7, D180-1, B185-1) follow the cost-over-problem rule.
- One wave for all four lanes, because their file sets are disjoint under the
  mutant-target rule.
- /plan-eng-review ran as a spawned session, so every decision point took the
  recommended option. Its /office-hours prerequisite offer was skipped, because
  this is a triage plan, not a product design.
- Complexity gate (more than 8 files): kept the original four-lane
  arrangement. The lanes are already split by file ownership, and reducing
  scope would only re-defer FIX rows that are verified.
- OV-1..OV-6 and ENG-7/ENG-8 (see the Decision ledger) were all applied as
  proposed. The one ordering change: merges go MT, HF, EH, AP, and AP adds
  `sw_eatclick_timer_not_cleared` only after EH's killer test has merged.
- D180-7's test moves to EH and its handler fix stays in AP, so the wave
  stays file-disjoint.
- R186-3 stays FIX but is re-tiered to cosmetic: there is no current
  off-by-one.
- S4 stays DEFER. After AP, the corpus is 527 patches, or 528 with D180-7.
  README's 477 holds until 531.
- No TODOS.md entries. The DEFER rows and their triggers in this doc are the
  backlog.

## Eng review

### NOT in scope
- The DEFER and cut rows above: each one has its own reason and reopen trigger.
- Audio, stats, SM-2 and PWA: excluded by owner instruction.
- The quality-refactor owner gates G1, G3 and G5: not a source for this plan.

### What already exists
- `refresh_mutants.py --check` already runs in CI (`validate.yml:28`).
- The shard balancer already spreads e2e mutants dynamically: 46/46/46/45
  today.
- The README count band in `test_readme_currency.py:113-130`.
- The FLOORS rows in `suite_health.py`.

The plan reuses all four and rebuilds none of them.

### Failure modes
| New path | Realistic failure | Test? | Handling? | Silent? |
|---|---|---|---|---|
| `parse_chunks` raises on an unknown prefix | A hang in CI's `--check` step | MT step 1 | raise, then exit nonzero | No |
| New `sw_`/`qr_` mutants | A mutant with no killer turns the gate red | EH step 5 adds the missing killer | CI gate | No (loud) |
| Floor 42 to 49 | A test is renamed, so the count drops | suite health | gate | No |
| `run_check` catches `Exception` | A real bug is reported as a failed check | MT step 5 | reported | No |

Critical gaps: 0.

### Worktree parallelization
| Step | Modules touched | Depends on |
|---|---|---|
| MT | `tools/`, mutation-harness tests | — |
| HF | `tests/` health and parity | — |
| EH | `tests/e2e`, `tests/helpers` | — |
| AP | `index.html`, `tests/app` | EH (2 mutants only) |

Launch MT, HF, EH and AP in parallel worktrees. Merge them serially: MT, then
HF, then EH, then AP. The one conflict point is `tests/mutants/`, which is
split by target file under the mutant rule.

## Implementation Tasks
- [ ] **T1 (P1)** Mutant ownership names the test-file-target patches and the two exceptions. Done in this doc (OV-1).
- [ ] **T2 (P1)** EH adds the stale-decay killer before AP adds `sw_eatclick_timer_not_cleared` (OV-2). Files: `tests/e2e.test.js`, `tests/mutants/`. Verify: the CI mutation gate.
- [ ] **T3 (P2)** MT step 3 uses unique test names, and its verify counts 2 passes (OV-3).
- [ ] **T4 (P2)** D180-7, if approved, is split: the test in EH, the handler in AP (OV-4).
- [ ] **T5 (P3)** Re-word R186-3 as future-proofing (OV-5). Done.
- [ ] **T6 (P2)** The M-1 kill is proven by CI, not by the local command (OV-6).
- [ ] **T7 (P3)** R186-1 becomes a new VERTICAL test rather than an extended HORIZONTAL one (ENG-7).
- [ ] **T8 (P3)** Narrow the Tab-trap verify pattern to the settings-panel test (ENG-8).

Every task is folded into the lane steps above.

## Decision ledger
| ID | Source | Finding | Answer |
|---|---|---|---|
| OV-1 | codex | Patches targeting lane-owned test files were unassigned; the `qb_core` and `c_deck_data_drift` exceptions were unstated | A) Apply (auto, recommended) |
| OV-2 | codex, verified | `sw_eatclick_timer_not_cleared` has no killer (`e2e.test.js:8754`, `index.html:8160`) | A) Apply: EH writes the killer, AP merges last (auto) |
| OV-3 | codex, verified | The `bare.blank` pattern already matches `mutation_harness.test.js:822` | A) Apply (auto) |
| OV-4 | codex | The D180-7 e2e test was assigned to AP, which does not own `e2e.test.js` | A) Apply: split (auto) |
| OV-5 | codex, verified | There is no current R186-3 off-by-one: `panelStops()` includes the trigger | A) Apply: re-word and re-tier (auto) |
| OV-6 | codex | The M-1 verify does not prove the kill | A) Apply: CI is the oracle (auto) |
| ENG-7 | in-host | Extending a test named HORIZONTAL with a vertical assertion misleads | A) Apply: add a new test (auto) |
| ENG-8 | in-host | The `Tab.is.trapped` pattern also matches the Edit-sheet test at `e2e.test.js:3706` | A) Apply: narrow it (auto) |

Approval readiness: PASS. OV-1 to OV-6, ENG-7 and ENG-8 are each answered by a
recorded spawned-session auto-decision.

### Completion summary
- Step 0 (Scope Challenge): scope accepted as-is.
- Architecture: 3 issues (OV-1, OV-2, OV-4). Code quality: 0. Tests: 5 gaps
  (OV-3, OV-5, OV-6, ENG-7, ENG-8). Performance: 0 new; R1 shard headroom is
  already tracked.
- NOT in scope: written. What already exists: written. TODOS.md: 0 proposed.
- Failure modes: 0 critical gaps. Unresolved review decisions: 0. The two
  ASK-OWNER rows are owner questions that the plan carries; they are not
  review decisions.
- Outside voice: codex (`codex exec`, read-only), completed, 6 findings.
- Parallelization: 4 lanes, dispatched in parallel, merged sequentially.
- Lake Score: N/A.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex (`codex exec`, via /plan-eng-review) | Independent 2nd opinion | 1 | issues_found | 6 findings, all applied |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 8 issues, 0 critical gaps (all 8 resolved into the plan) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**OUTSIDE COVERAGE:** codex, plan-review phase, completed. It found 6 issues
(OV-1 to OV-6), and all 6 were applied.

**VERDICT:** no review is CLEAR. Eng Review logged `issues_open` because 8
findings were found, all of them mapped into the lane steps, with 0 critical
gaps. Eng review required: re-run after the doc lands, or accept the mapped
fixes.

NO UNRESOLVED DECISIONS
