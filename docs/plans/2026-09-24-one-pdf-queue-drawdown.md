# One-PDF-path queue drawdown - plan and coordination

Source: the handoff queue (rows 1-29) of
`docs/plans/2026-09-24-one-pdf-path-coordination.md`, plus the two nits from the
PR 135 review. Owner instruction (2026-09-24): "address small queue and nits
unless there's no need". AFK armed; /swarm, integrator is the sole writer of this
doc.

## 1. Goal and non-goals

GOAL: every small, still-true queue row from the one-pdf-path workstream is
either fixed on main (test first, CI green, independent review) or closed with a
recorded reason.

NON-GOALS:
- Rows 4, 5, 6 (the committed-PDF staleness oracle: half-HEAD sourcing, no
  mutant for it, text-only comparison). Row 4 was filed as "needs its own lane";
  it is a design change to the gate, not a drawdown item. They stay OPEN.
- Row 24 (double-click cooldown): closed with no change, see AD-Q1.
- JS-side aliasing twin of row 9: `pdfdeck.js:252` shares `legend_lines`, `grad`, `col_*` with `DECKS[i].print`. No mutator exists; accepted, not fixed.
- Any change to deck data, geometry, card copy, print layout or the six
  committed PDFs. Retiring `tools/hifi.py`. The D2 browser-print cutover.

## 2. Triage

| Row | Disposition | Where |
|---|---|---|
| 1 | RESOLVED - owner, 2026-09-24: "iPhone verified all points" (all six plan §6 checks pass: built-in and generated decks behave alike, A4 persists and prints A4, the row fits at 380px). Also close the duplicate rows 332, 335 in `scale-engine-coordination.md` | integrator |
| 2, 3 | fix: plan prose (`docs/plans/2026-09-24-one-pdf-path.md` §9.5 D1 seed; §3 W3 Owns cell) | integrator (docs) |
| 4, 5, 6 | DEFERRED - non-goal | - |
| 7 | fix: `tests/test_pdf_build.py` accumulate misses, accurate diagnostic, basename assumption | lane P |
| 8 | fix the last stale comment `tests/app.test.js:3397-3398` ("the app's data has none"; Pygmy carries `print.blank_cards: 7`) | lane J |
| 15 | RESOLVED - `tests/pdf_builtin.test.js:41` asserts `built.R == deck.print.R`; parity sweep compares built-ins with Python | integrator |
| 9 | fix: `_overlay_from_print` deep-copies | lane P |
| 10, 21, 22 | RESOLVED - process lessons, recorded in memory | integrator |
| 11 | fix: `tests/mutants/w1b_*.patch` headers cite the seed-pdf plan Q1, not CLAUDE.md | lane P |
| 12, 13 | fix: `tests/test_print.py` docstrings | lane P |
| 14 | add mutant for Pygmy `blank_cards` 7 pin | lane P |
| 16 | fix: drop the dead blank_cards lift (`pdfdeck.js:267-272`; the own-key flatten at `:250-252` already copies it) and re-story `tests/pdf_builtin.test.js:54-68` plus comments `index.html:6074`, `tests/app.test.js:3922-3923` | lane J |
| 17 | add test for the `/g` blurb substitution | lane J |
| 18 | fix: `tests/test_pdf_parity.py` floor proves the loops iterate CASES/VARIANTS | lane P |
| 19 | fix: `fromBuiltin` returns `warnings: []` | lane J |
| 20 | fix: `tools/pdf_build.js --builtin` with no value prints usage, exit 2 | lane J |
| 23, 25 | fix: printPaper boot guard - own key only, string only; tests for inherited key and array value; mutant | lane J |
| 24 | CLOSED, no change - AD-Q1 | integrator |
| 26 | fix: stale comment `index.html:6229`/`:6236` | lane J |
| 27, 28 | fix: `docs/plans/scale-engine-coordination.md` queue rows 352 / 333 (file lines 1628 / 1609) wording | integrator (docs) |
| 29 | fix: `README.md:159` name hifi.py; also refresh the mutant count | integrator (docs) |
| nit a | row 24's citation: guard at `index.html:6273-6275`, re-enable `:6297-6298` - folded into row 24's close text | integrator |
| nit b | review log order in the one-pdf-path coord doc - reorder | integrator |

## 3. Lanes

### Lane J - app + engine JS (`claude/qd-js`)
OWNS: `index.html` (application JS outside engine regions; engine region only via
`python3 tools/inline_engine.py`), `src/engine/pdfdeck.js`, `tools/pdf_build.js`,
`tests/app.test.js`, `tests/pdf_builtin.test.js`, `tests/pdfcards.test.js`,
`tests/e2e.test.js`, new `tests/mutants/qd_j_*.patch`, and ONLY the JS rows of
`FLOORS` in `tests/suite_health.py`.
NEVER: `data/decks.json`, DECKS line, other engine modules, Python files, docs,
README.
NEXT (tests first each time):
1. Rows 23+25: one helper `isPaper(p)` = `typeof p === "string" &&
   Object.prototype.hasOwnProperty.call(PRINT_PAPER, p)` (NOT `Object.hasOwn`:
   Safari < 15.4 would throw at boot and kill the app), used by the boot guard
   (`index.html:6165-6166`) AND `setPrintPaper` (`:6167`). Tests: stored
   `{"printPaper":"toString"}` and stored `["a4"]` each boot as "letter";
   `setPrintPaper("toString")` is refused. Mutants `qd_j_paper_inherited_key`
   and `qd_j_paper_not_string`, each killed. Verify: `node --test tests/app.test.js`.
2. Row 26: comment at `index.html:6228-6236` describes every deck and says
   `openPrintSheet` sits above. Row 8: fix `tests/app.test.js:3397-3398`.
3. Row 16: remove the lift at `src/engine/pdfdeck.js:267-272`; rename the
   "LIFTED" test at `tests/pdf_builtin.test.js:54-68` to say the overlay flatten
   carries it (its `built.blank_cards === 7` assertion stays); fix the comments
   at `index.html:6074` and `tests/app.test.js:3922-3923`; run
   `python3 tools/inline_engine.py`. Verify:
   `python3 tools/inline_engine.py --check && node --test tests/pdf_builtin.test.js tests/app.test.js`.
4. Row 17: test in `tests/pdf_builtin.test.js` with a synthetic blurb whose last
   line has two counts before CHORDS, both replaced; mutant `qd_j_blurb_drops_g`
   (drop `/g`) naming that test in its `# suite:` header, killed.
5. Row 19: `fromBuiltin` returns `warnings: []`; test; update the
   "statement-for-statement port of `_from_canonical`" comment at
   `pdfdeck.js:204-209` to name this one deliberate extra key.
6. Row 20: tests spawning `node tools/pdf_build.js --out x --builtin` and
   `... --builtin --out x` with `input: ""`: both exit 2 with /usage/ on stderr
   (red today: exit 1 / "no built-in deck '--out'"). No open-stdin or timeout
   test. Fix: a value starting with `--` or missing is a usage error.
7. `python3 tools/validate.py` green; raise own FLOORS rows; push; CI green.

### Lane P - Python print tests (`claude/qd-py`)
OWNS: `tools/decks.py`, `tests/test_pdf_build.py`, `tests/test_print.py`,
`tests/test_pdf_parity.py`, `tests/mutants/w1b_*.patch` (headers only), new
`tests/mutants/qd_p_*.patch`, and ONLY the Python rows of `FLOORS`.
NEVER: `tools/hifi.py`, `data/decks.json`, `index.html`, the six PDFs, JS, docs.
NEXT (tests first each time):
1. Row 9: test that mutating `decks.PYGMY['legend_lines']` does not change
   `_CANONICAL`; fix with `copy.deepcopy`. Verify: `python3 -m unittest tests.test_print`.
2. Rows 12, 13: docstrings. Row 11: mutant headers. Verify: `bash tests/mutation_check.sh` is NOT run locally; CI.
3. Row 14: mutant `qd_p_pygmy_blank_cards_drifts` - a patch on `data/decks.json`
   (allowed as a patch file, as the `w1b_*` mutants are) changing Pygmy's
   `print.blank_cards` 7, killed by `test_pygmy_blank_cards_is_pinned`
   (`tests/test_print.py:948`).
4. Row 7: extract the `git show HEAD:<pdf>` step into a helper; red-first tests
   run it against a temp non-checkout dir (diagnostic says "no git or not a
   checkout", not "not committed at HEAD") and against a set with two missing
   PDFs (both reported, not just the first); tmp names derive from
   `os.path.basename`. Deferred row 4 will rework this function later - keep the
   change minimal. Verify: `python3 -m unittest tests.test_pdf_build`.
5. Row 18: ONE order-independent test: stub `_pair` / `_pair_drawings` with a
   recorder, call each sweep method directly, assert the recorded pairs equal
   CASES x VARIANTS (must pass under `-k` single-test runs - the mutation harness
   runs that way). Mutant `qd_p_sweep_iterates_seeds` (one loop back to SEEDS),
   killed. Verify: `python3 -m unittest tests.test_pdf_parity`.
6. `python3 tools/validate.py` green; raise own FLOORS rows; push; CI green.

Both lanes: local runs are smoke tests, CI at the pushed head is the evidence.
Never run a full local mutation sweep; never `pgrep -f` a pattern in your own
command line; never `cp -r` a linked worktree. `README.md` mutant count is left to
the integrator (the currency test tolerates a lane's worth of drift).

### Integrator docs (this branch)
Rows 1, 2, 3, 10, 21, 22, 24, 27, 28, 29, nits a/b; queue status updates in the
one-pdf-path coordination doc; README mutant count after both lanes merge.

## 4. Gates
Per lane: all 5 CI checks green at a head verified against the remote tip; a
fresh `swarm-reviewer` returns PASS/PASS_WITH_NITS at that SHA; merge with
`gh pr merge --merge`. Cap 2 attempts per lane. Lanes J and P share only
`tests/suite_health.py` (disjoint rows) and `tests/mutants/` (disjoint names):
merge serially; rebase only on a real conflict.

## 5. Auto-decisions

| # | Decision | Why |
|---|---|---|
| AD-Q1 | Row 24 closed with no change | The build is synchronous. Desktop: a second click 100-300 ms later downloads the same PDF a second time. iOS (`index.html:6279-6285`): a second tap that lands before Safari switches to the new tab opens a second viewer tab holding a second ~1 MB blob for 60 s; if the popup fallback fired, the page has already navigated and there is no second tap. Worst case is a duplicate tab/file - no corruption, no error. The device pass did not test a double tap, so this rests on the code reading, not on evidence. A cooldown costs a timer, a test and a mutant for that. Reopen if the build becomes async or the owner sees duplicate tabs. |
| AD-Q2 | Rows 4-6 deferred | Not small: a redesign of the staleness gate. |
| AD-Q3 | Rows 10, 21, 22 closed as lessons | They are process notes; recorded in project memory so future briefs carry them. |
| AD-Q4 | Two lanes, split JS / Python | Clean file ownership; docs stay with the integrator. |

## 6. Status

| Lane | Branch | PR | Head | State | Verdict |
|---|---|---|---|---|---|
| J | claude/qd-js | - | - | spawned (wt-qd-js @ 90a5aed) | - |
| P | claude/qd-py | - | - | spawned (wt-qd-py @ 90a5aed) | - |

## 7. Review log

| PR | Lane | Verdict | Findings | Outcome |
|---|---|---|---|---|
